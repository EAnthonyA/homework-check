import type { HomeworkEvaluation, HomeworkEvaluationDebug } from "./ai";

type Check = HomeworkEvaluationDebug["checks"][number];

function normalizeReading(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim().replace(/[.;]$/u, "");
}

function normalizePart(value: string): string {
  return normalizeReading(value)
    .replace(/grammar|užduoties|užduotis|dalis|pratimas|pratimo/gu, "")
    .match(/[\p{L}\p{N}]+/gu)?.join("-") ?? "";
}

function normalizeQuestion(value: string): string {
  return normalizeReading(value).replace(/^\d+\s*\(\d+\)\s*[.):]\s*/u, "");
}

function normalizeAnswer(value: string): string {
  return normalizeReading(value).replace(/^(?:atsakymas|answer)\s*:\s*/u, "");
}

export function sameCorrectEvidence(first: HomeworkEvaluation, second: HomeworkEvaluation): boolean {
  if (!first.done || !second.done || !first.canVerifyCorrectness || !second.canVerifyCorrectness
    || first.correct !== true || second.correct !== true || first.debug.model === second.debug.model) return false;
  const checks = first.debug.checks;
  const other = second.debug.checks;
  if (!checks.length || checks.length !== other.length) return false;
  const indexed = new Map(other.map((check) => [normalizePart(check.part), check]));
  if (indexed.size !== other.length || new Set(checks.map((check) => normalizePart(check.part))).size !== checks.length) return false;
  return checks.every((check) => {
    const part = normalizePart(check.part);
    const match = indexed.get(part);
    const readings = [check.questionRead, check.answerRead, match?.questionRead ?? "", match?.answerRead ?? ""];
    if (!part || !match || check.verdict !== "correct" || match.verdict !== "correct"
      || readings.some((value) => !value.trim() || /neįskaitom/iu.test(value))) return false;
    return normalizeQuestion(check.questionRead) === normalizeQuestion(match.questionRead)
      && normalizeAnswer(check.answerRead) === normalizeAnswer(match.answerRead);
  });
}

function incorrectChecks(evaluation: HomeworkEvaluation): Map<string, Check> | null {
  const checks = evaluation.debug.checks.filter((check) => check.verdict === "incorrect");
  const indexed = new Map<string, Check>();

  for (const check of checks) {
    const part = normalizePart(check.part);
    const readings = [check.questionRead, check.answerRead];
    const unreadable = readings.some((reading) =>
      !reading.trim() || /neįskaitom/iu.test(reading) || reading.length >= 2_000,
    );

    if (!part || /neįskaitom/iu.test(part) || indexed.has(part) || unreadable) return null;

    indexed.set(part, check);
  }

  return indexed.size > 0 ? indexed : null;
}

function readableIncorrectChecks(evaluation: HomeworkEvaluation): Map<string, Check> {
  const checks = evaluation.debug.checks.filter((check) => check.verdict === "incorrect");
  const counts = new Map<string, number>();
  for (const check of checks) {
    const part = normalizePart(check.part);
    counts.set(part, (counts.get(part) ?? 0) + 1);
  }
  const result = new Map<string, Check>();
  for (const check of checks) {
    const part = normalizePart(check.part);
    const readings = [check.questionRead, check.answerRead];
    if (!part || counts.get(part) !== 1 || /neįskaitom/iu.test(part)
      || readings.some((reading) => !reading.trim() || /neįskaitom/iu.test(reading) || reading.length >= 2_000)) continue;
    result.set(part, check);
  }
  return result;
}

function confirmsSameErrors(first: HomeworkEvaluation, second: HomeworkEvaluation): boolean {
  if (!second.done || !second.canVerifyCorrectness || second.correct !== false) return false;
  if (first.debug.model === second.debug.model) return false;

  const initial = incorrectChecks(first);
  const verification = incorrectChecks(second);

  if (!initial || !verification || initial.size !== verification.size) return false;

  // Deliberately conservative: paraphrases require parent review rather than
  // letting matching exercise numbers confirm errors in different questions.
  return [...initial].every(([part, check]) => {
    const other = verification.get(part);

    return other !== undefined
      && normalizeQuestion(check.questionRead) === normalizeQuestion(other.questionRead)
      && normalizeAnswer(check.answerRead) === normalizeAnswer(other.answerRead);
  });
}

export function reconcileHomeworkEvaluations(
  initial: HomeworkEvaluation,
  verification: HomeworkEvaluation,
): HomeworkEvaluation {
  const confirmed = initial.canVerifyCorrectness && confirmsSameErrors(initial, verification);
  const firstChecks = readableIncorrectChecks(initial);
  const secondChecks = readableIncorrectChecks(verification);
  const matching = initial.debug.model !== verification.debug.model
    ? [...firstChecks].filter(([part, check]) => {
      const other = secondChecks.get(part);
      return other && normalizeQuestion(check.questionRead) === normalizeQuestion(other.questionRead)
        && normalizeAnswer(check.answerRead) === normalizeAnswer(other.answerRead);
    })
    : [];
  const debug: HomeworkEvaluationDebug = {
    ...initial.debug,
    initialAssessmentRejected: !confirmed,
    verification: verification.debug,
    verificationRawResponse: verification.debug.rawResponse,
  };

  if (confirmed) return { ...initial, debug };

  if (matching.length > 0) {
    const parts = matching.map(([, check]) => check.part);
    const needsWork = initial.needsWork.filter((entry) =>
      parts.some((part) => normalizePart(entry.split(" — ")[0]) === normalizePart(part)),
    );
    if (needsWork.length > 0) {
      return {
        ...initial,
        correct: false,
        summary: "Patikrink pažymėtas dalis. Kitas dalis gali reikėti nufotografuoti aiškiau.",
        goodParts: [],
        needsWork,
        debug: { ...debug, confirmedChecks: matching.map(([, check]) => check) },
      };
    }
  }

  return {
    ...initial,
    correct: null,
    needsClearerPhoto: false,
    summary: "Patikrinimai nesutapo. Pabandyk nufotografuoti užduotį ir atsakymą iš arčiau arba pateik dar kartą.",
    goodParts: [],
    needsWork: [],
    debug,
  };
}

export function unconfirmedHomeworkEvaluation(initial: HomeworkEvaluation): HomeworkEvaluation {
  return {
    ...initial,
    correct: null,
    needsClearerPhoto: false,
    summary: "Pakartotinis patikrinimas nepavyko. Pabandyk pateikti nuotraukas dar kartą.",
    goodParts: [],
    needsWork: [],
    debug: {
      ...initial.debug,
      initialAssessmentRejected: true,
      notes: ["Pirminė klaida nepatvirtinta: nepriklausomas AI patikrinimas nepasiekiamas.", ...initial.debug.notes].slice(0, 10),
    },
  };
}

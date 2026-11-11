import type { HomeworkEvaluation, HomeworkEvaluationDebug } from "./ai";

type Check = HomeworkEvaluationDebug["checks"][number];

function normalizeReading(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function incorrectChecks(evaluation: HomeworkEvaluation): Map<string, Check> | null {
  const checks = evaluation.debug.checks.filter((check) => check.verdict === "incorrect");
  const indexed = new Map<string, Check>();

  for (const check of checks) {
    const part = normalizeReading(check.part).replace(/[^\p{L}\p{N}]/gu, "");
    const readings = [check.questionRead, check.answerRead];
    const unreadable = readings.some((reading) =>
      !reading.trim() || /neįskaitom/iu.test(reading) || reading.length >= 2_000,
    );

    if (!part || /neįskaitom/iu.test(part) || indexed.has(part) || unreadable) return null;

    indexed.set(part, check);
  }

  return indexed.size > 0 ? indexed : null;
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
      && normalizeReading(check.questionRead) === normalizeReading(other.questionRead)
      && normalizeReading(check.answerRead) === normalizeReading(other.answerRead);
  });
}

export function reconcileHomeworkEvaluations(
  initial: HomeworkEvaluation,
  verification: HomeworkEvaluation,
): HomeworkEvaluation {
  const confirmed = initial.canVerifyCorrectness && confirmsSameErrors(initial, verification);
  const debug: HomeworkEvaluationDebug = {
    ...initial.debug,
    initialAssessmentRejected: !confirmed,
    verification: verification.debug,
    verificationRawResponse: verification.debug.rawResponse,
  };

  if (confirmed) return { ...initial, debug };

  return {
    ...initial,
    correct: null,
    needsClearerPhoto: false,
    summary: "Du nepriklausomi AI vertinimai nesutapo. Nuotraukos išsaugotos tėvų peržiūrai — vaiko taisyti neprašoma.",
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
    summary: "Pakartotinis AI patikrinimas nepasiekiamas. Nuotraukos išsaugotos tėvų peržiūrai — vaiko taisyti neprašoma.",
    goodParts: [],
    needsWork: [],
    debug: {
      ...initial.debug,
      initialAssessmentRejected: true,
      notes: ["Pirminė klaida nepatvirtinta: nepriklausomas AI patikrinimas nepasiekiamas.", ...initial.debug.notes].slice(0, 10),
    },
  };
}

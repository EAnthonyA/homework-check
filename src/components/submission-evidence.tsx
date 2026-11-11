"use client";

import { useState } from "react";
import { AiVerdict } from "./ai-verdict";
import type { AssessmentEvidence, SubmissionView } from "./types";

const visibilityLabel = {
  clear: "aiškiai matomas",
  partial: "matomas tik iš dalies",
  missing: "nematomas",
  unknown: "nepateikta",
} as const;

const legibilityLabel = {
  clear: "aiški",
  mixed: "vietomis neaiški",
  unclear: "neaiški",
  unknown: "nepateikta",
} as const;

const checkLabel = {
  correct: "teisinga",
  incorrect: "klaida",
  unverifiable: "nepavyko patikrinti",
} as const;

export function SubmissionEvidence({ submission }: { submission: SubmissionView }) {
  const [unpreviewablePhotos, setUnpreviewablePhotos] = useState(new Set<string>());
  const timestamp = new Intl.DateTimeFormat("lt-LT", {
    timeZone: "Europe/Vilnius", dateStyle: "short", timeStyle: "short",
  }).format(new Date(submission.createdAt));
  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">
        {submission.userName} · pateikė <time dateTime={submission.createdAt}>{timestamp}</time>
      </p>
      <div className="flex flex-wrap gap-3">
        {submission.imagePaths.map((src, index) => (
          <a key={src} href={src} target="_blank" rel="noopener noreferrer"
            className="group block min-w-0 rounded-lg text-ink-soft hover:text-ink"
            aria-label={`${submission.userName}: ${index + 1} nuotrauka, atverti visą dydį`}>
            {unpreviewablePhotos.has(src) ? (
              <span className="flex h-28 w-20 items-center justify-center rounded-lg border border-dashed border-rule bg-paper px-2 text-center text-xs leading-snug">
                Peržiūra<br />nepasiekiama ↗
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`${index + 1} namų darbų nuotrauka`} loading="lazy"
                onError={() => setUnpreviewablePhotos((current) => new Set(current).add(src))}
                className="h-28 w-20 rounded-lg border border-rule bg-paper object-cover transition-colors group-hover:border-pen" />
            )}
            <span className="mt-1 block text-center text-xs">{index + 1} / {submission.imagePaths.length} ↗</span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-ink-soft">AI vertinimas</p>
      <AiVerdict submission={submission} />
      {submission.manualTaskText && (
        <p className="mt-3 border-l-2 border-honey/60 pl-3 text-sm leading-relaxed text-ink-soft">
          Ranka patikslinta užduoties sąlyga: <span className="text-ink">{submission.manualTaskText}</span>
        </p>
      )}
      {submission.aiDone === null && !submission.aiError && (
        <p className="font-hand mt-1 text-xl text-slate">Neįvertinta · nuotraukas gali peržiūrėti tėvai.</p>
      )}
      {submission.aiDebug && (
        <details className="mt-4 border-t border-dashed border-rule pt-3 text-sm text-ink-soft">
          <summary className="cursor-pointer font-medium text-ink marker:text-pen">AI vertinimo detalės tėvams</summary>
          <div className="mt-3 space-y-4 leading-relaxed">
            {submission.aiDebug.initialAssessmentRejected && (
              <p className="font-semibold text-honey-deep">
                Pirminė klaida nepatvirtinta. Šis vertinimas atmestas — vaiko taisyti neprašoma.
              </p>
            )}
            <AssessmentDetails evidence={submission.aiDebug} title="Pirminis vertinimas" />
            {submission.aiDebug.verification && (
              <AssessmentDetails evidence={submission.aiDebug.verification} title="Nepriklausomas pakartotinis vertinimas" />
            )}
            {!submission.aiDebug.verification && submission.aiDebug.verificationRawResponse && (
              <details className="text-xs text-ink-faint">
                <summary className="cursor-pointer">Žalias pakartotinio tikrinimo atsakymas</summary>
                <p className="mt-1 break-words font-mono leading-relaxed">{submission.aiDebug.verificationRawResponse}</p>
              </details>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function AssessmentDetails({ evidence, title }: { evidence: AssessmentEvidence; title: string }) {
  return (
    <section className="space-y-3">
      <p className="font-semibold text-ink">{title} · {evidence.model}</p>
      <p>
        Užduoties tekstas: <strong className="font-semibold text-ink">{visibilityLabel[evidence.taskTextVisibility]}</strong>
        {" · "}Rašysena: <strong className="font-semibold text-ink">{legibilityLabel[evidence.handwritingLegibility]}</strong>
      </p>
      <ul className="space-y-3 border-l-2 border-rule pl-3">
        {evidence.checks.map((check, index) => (
          <li key={`${check.part}-${index}`}>
            <p className="font-medium text-ink">{check.part} — {checkLabel[check.verdict]}</p>
            <p>Užduotis perskaityta: {check.questionRead}</p>
            <p>Atsakymas perskaitytas: {check.answerRead}</p>
            <p>Priežastis: {check.reason}</p>
          </li>
        ))}
      </ul>
      <ul className="list-disc space-y-1 pl-4">
        {evidence.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      {evidence.rawResponse && (
        <details className="text-xs text-ink-faint">
          <summary className="cursor-pointer">Žalias AI atsakymas</summary>
          <p className="mt-1 break-words font-mono leading-relaxed">{evidence.rawResponse}</p>
        </details>
      )}
    </section>
  );
}

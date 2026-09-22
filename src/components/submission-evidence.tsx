"use client";

import { useState } from "react";
import { AiVerdict } from "./ai-verdict";
import type { SubmissionView } from "./types";

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
      {submission.aiDone === null && !submission.aiError && (
        <p className="font-hand mt-1 text-xl text-slate">Neįvertinta · nuotraukas gali peržiūrėti tėvai.</p>
      )}
    </div>
  );
}

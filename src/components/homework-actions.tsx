"use client";

import { useState } from "react";
import { PhotoSubmission } from "./photo-submission";
import { StartingHelp } from "./starting-help";

export function HomeworkActions({ homeworkId, description, replacing, imagePaths, submissionKey, onResult }: {
  homeworkId: string;
  description: string;
  replacing: boolean;
  imagePaths: string[];
  submissionKey: string;
  onResult: (message: string) => void;
}) {
  const [path, setPath] = useState<"submit" | "help" | null>(null);

  return (
    <div className="mt-4 border-t border-dashed border-rule pt-4">
      {path === null ? (
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary flex-col !items-start text-left" onClick={() => setPath("submit")}>
            <span>{replacing ? "Pateikti iš naujo" : "Atlikau — pateikti"}</span>
            <span className="text-xs font-normal">Įkelk savo sprendimą patikrinti</span>
          </button>
          <button type="button" className="btn btn-outline flex-col !items-start text-left" onClick={() => setPath("help")}>
            <span>Nesuprantu — padėk</span>
            <span className="text-xs font-normal text-ink-soft">Gauk paaiškinimą prieš pradėdamas</span>
          </button>
        </div>
      ) : (
        <button type="button" className="min-h-11 text-left text-sm font-medium text-pen-deep underline underline-offset-4"
          onClick={() => setPath(null)}>
          ‹ Pasirinkti kitą veiksmą
        </button>
      )}
      <PhotoSubmission key={submissionKey} homeworkId={homeworkId} replacing={replacing} imagePaths={imagePaths} onResult={onResult} visible={path === "submit"} />
      <StartingHelp homeworkId={homeworkId} description={description} visible={path === "help"} />
    </div>
  );
}

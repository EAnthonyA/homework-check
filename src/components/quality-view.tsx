"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "./header";
import type { SessionProp } from "./types";

type QualityReport = {
  since: string;
  summary: {
    assignments: number;
    first_check_correct: number | null;
    recovered_by_ai: number | null;
    parent_completed: number | null;
    unresolved: number | null;
  };
  reasons: Array<{ reason: string | null; count: number }>;
  reopenings: { count: number };
  repeatedEvidenceRequests: { count: number };
};

const reasonLabels: Record<string, string> = {
  correct: "AI įvertino kaip teisingą",
  incorrect: "Reikėjo pataisyti",
  incomplete: "Trūko atliktų dalių",
  missing_evidence: "Trūko užduoties duomenų",
  uncertain: "AI negalėjo nuspręsti",
  error: "Tikrinimas nepavyko",
  manual_review: "Reikėjo peržiūrėti patikslintą sąlygą",
};

function ReportRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-rule py-3">
      <dt className="text-sm leading-snug text-ink-soft">{label}</dt>
      <dd className="shrink-0 font-display text-xl font-bold tabular-nums text-ink">{value ?? 0}</dd>
    </div>
  );
}

export function SuccessRate({ report }: { report: QualityReport }) {
  const total = report.summary.assignments;
  const confirmed = (report.summary.first_check_correct ?? 0) + (report.summary.recovered_by_ai ?? 0);
  const percent = Math.round(confirmed / total * 100);
  let message = "AI patvirtino šiuos darbus iš pirmo karto arba po pakartotinio bandymo iki tėvų pažymėjimo.";
  if (total < 5) {
    message = "Dar per mažai duomenų išvadoms. Rezultatas taps aiškesnis pateikus daugiau darbų.";
  } else if (percent < 70) {
    message = "Oho, AI patvirtina nedaug darbų. Surinkite daugiau duomenų ir parodykite šią apžvalgą agentui, kad galėtų padėti tobulinti programėlę.";
  }
  return (
    <div className="mt-5 border-t border-dashed border-rule pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">AI patvirtino per pirmą ar vėlesnį bandymą</p>
        <p className={`shrink-0 whitespace-nowrap font-display text-3xl font-bold tabular-nums ${total < 5 ? "text-ink-soft" : percent < 70 ? "text-pen-deep" : "text-leaf-deep"}`}>{percent} %</p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">{confirmed} iš {total} per šį laikotarpį pateiktų darbų, įskaitant dar neatliktus</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{message}</p>
    </div>
  );
}

function QualityResults({ report }: { report: QualityReport }) {
  const { summary } = report;
  if (summary.assignments === 0) {
    return (
      <div className="sheet p-6 pl-10">
        <p className="font-hand text-3xl text-ink-soft">Kol kas duomenų nėra.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Čia matysite rezultatus, kai vaikas pateiks namų darbus AI patikrinimui.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="sheet p-5 pl-10" aria-labelledby="quality-outcomes">
        <p className="font-hand text-xl text-pen-deep">Per paskutines 30 dienų</p>
        <h2 id="quality-outcomes" className="font-display mt-1 text-xl font-bold text-ink">Kaip sekėsi atlikti darbus</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Darbai, kuriuos vaikas pateikė tikrinti per šį laikotarpį.</p>
        <dl className="mt-4">
          <ReportRow label="Pateikta darbų" value={summary.assignments} />
          <ReportRow label="AI patvirtino iš pirmo karto" value={summary.first_check_correct} />
          <ReportRow label="AI patvirtino po pakartotinio pateikimo, prieš tėvų žymėjimą" value={summary.recovered_by_ai} />
          <ReportRow label="Šiuo metu tėvų pažymėti kaip atlikti" value={summary.parent_completed} />
          <ReportRow label="Dar neatlikti" value={summary.unresolved} />
        </dl>
        <SuccessRate report={report} />
        <p className="text-xs leading-relaxed text-ink-faint">Rodikliai gali sutapti, jei darbas buvo grąžintas ir pažymėtas iš naujo.</p>
      </section>
      <section className="sheet p-5 pl-10" aria-labelledby="quality-checks">
        <h2 id="quality-checks" className="font-display text-xl font-bold text-ink">AI patikrinimai</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Kiekvienas pakartotinis tikrinimas skaičiuojamas atskirai.</p>
        <dl className="mt-4">
          {report.reasons.map((item) => (
            <ReportRow key={item.reason ?? "unknown"} label={reasonLabels[item.reason ?? ""] ?? "Kitas rezultatas"} value={item.count} />
          ))}
        </dl>
      </section>
      <section className="sheet p-5 pl-10" aria-labelledby="quality-followup">
        <h2 id="quality-followup" className="font-display text-xl font-bold text-ink">Kur reikėjo grįžti</h2>
        <dl className="mt-4">
          <ReportRow label="Darbuose pakartotinai prašyta papildomų duomenų arba bandyti dar kartą" value={report.repeatedEvidenceRequests.count} />
          <ReportRow label="Po AI patvirtinimo grąžinta taisyti" value={report.reopenings.count} />
        </dl>
      </section>
    </div>
  );
}

export function QualityView({ session }: { session: SessionProp }) {
  const { data, isLoading, error, refetch } = useQuery<QualityReport>({
    queryKey: ["homework", "quality"],
    queryFn: async () => {
      const response = await fetch("/api/homework/quality");
      if (!response.ok) throw new Error("Nepavyko įkelti duomenų.");
      return response.json();
    },
  });

  return (
    <main className="flex flex-1 flex-col pb-10">
      <Header session={session} />
      <section className="px-5 pt-8">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-pen-deep">
          <ArrowLeft className="h-4 w-4" /> Namų darbai
        </Link>
        <h1 className="font-display mt-3 text-[2rem] font-black leading-[1.05] tracking-tight text-ink">AI tikrinimo apžvalga</h1>
        <p className="mt-2.5 max-w-[42ch] text-sm leading-relaxed text-ink-soft">Stebėkite, kaip vaikui sekasi užbaigti darbus ir kada prireikia jūsų pagalbos.</p>
      </section>
      <div className="mt-7 px-5">
        {isLoading && <p role="status" className="py-8 text-ink-soft">Kraunama…</p>}
        {error && (
          <div role="alert" className="sheet p-5 pl-10">
            <p className="text-pen-deep">Nepavyko įkelti apžvalgos.</p>
            <button type="button" className="btn btn-outline mt-3" onClick={() => refetch()}>Bandyti dar kartą</button>
          </div>
        )}
        {data && <QualityResults report={data} />}
        <p className="mt-5 text-xs leading-relaxed text-ink-faint">Duomenys renkami nuo šios funkcijos įdiegimo. Ankstesni bandymai čia nerodomi.</p>
      </div>
    </main>
  );
}

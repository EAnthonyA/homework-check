import { Clock3, MapPin } from "lucide-react";
import type { CSSProperties } from "react";

type Consultation = {
  subject: string;
  teacher: string;
  room: string;
  time: string;
  grades: string;
};

const schedule: Array<{ day: string; consultations: Consultation[] }> = [
  {
    day: "Pirmadienis",
    consultations: [
      { subject: "Matematika", teacher: "Renata Grinevičienė", room: "A2", time: "14.10–14.55", grades: "5 klasės" },
    ],
  },
  {
    day: "Antradienis",
    consultations: [
      { subject: "Matematika", teacher: "Simona Belous", room: "A6", time: "14.10–14.55", grades: "5 klasės" },
      { subject: "Informatika / dronų pradžiamokslis", teacher: "Irina Seliščevienė", room: "B8", time: "15.00–15.45", grades: "5 klasės" },
    ],
  },
  {
    day: "Trečiadienis",
    consultations: [
      { subject: "Anglų kalba", teacher: "Agnieška Scarpetta", room: "A7", time: "14.10–14.55", grades: "5 klasės" },
    ],
  },
  {
    day: "Ketvirtadienis",
    consultations: [
      { subject: "Lietuvių kalba", teacher: "Gintarė Motiekaitienė", room: "A6", time: "14.10–14.55", grades: "5 klasės" },
    ],
  },
];

export function ConsultationsPanel() {
  return (
    <section aria-labelledby="consultations-heading" className="anim-fade">
      <div className="mb-5">
        <p className="font-hand text-xl leading-none text-pen-deep">2026–2027 m. m.</p>
        <h2 id="consultations-heading" className="font-display mt-1 text-2xl font-bold text-ink">Konsultacijos</h2>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
          Mokytojų konsultacijų laikas mokymosi spragoms šalinti, pasiekimams gerinti ir ilgalaikiams projektams.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {schedule.map(({ day, consultations }, dayIndex) => (
          <section key={day} className="sheet anim-rise overflow-hidden p-5 pl-10" style={{ "--i": dayIndex } as CSSProperties}>
            <h3 className="font-display text-xl font-bold text-ink">{day}</h3>
            <div className="mt-4 divide-y divide-dashed divide-rule">
              {consultations.map((consultation, index) => (
                <article key={`${consultation.subject}-${consultation.time}-${index}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold leading-snug text-ink">{consultation.subject}</h4>
                      {consultation.teacher && <p className="mt-0.5 text-sm text-ink-soft">{consultation.teacher}</p>}
                    </div>
                    <span className="font-hand shrink-0 text-lg leading-none text-leaf-deep">{consultation.grades}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-pen" aria-hidden="true" />{consultation.time}</span>
                    {consultation.room && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-pen" aria-hidden="true" />{consultation.room}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-5 text-sm text-ink-faint">Penktadienį konsultacijų nėra.</p>
    </section>
  );
}

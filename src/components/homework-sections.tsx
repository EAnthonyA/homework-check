import type { ReactNode } from "react";
import type { HomeworkItemView } from "./types";

export function HomeworkSections({ items, today, children }: {
  items: HomeworkItemView[];
  today: string;
  children: (item: HomeworkItemView, index: number) => ReactNode;
}) {
  const groups = [
    { label: "Vėluojantys darbai", overdue: true, items: items.filter((item) => item.dueDate < today) },
    { label: "Šiandien ir artimiausiomis dienomis", overdue: false, items: items.filter((item) => item.dueDate >= today) },
  ];
  return groups.filter((group) => group.items.length).map((group) => (
    <section key={group.label} className="flex flex-col gap-5" aria-label={group.label}>
      <h2 className={`font-hand text-2xl ${group.overdue ? "text-pen-deep" : "text-ink-soft"}`}>{group.label}</h2>
      {group.items.map(children)}
    </section>
  ));
}

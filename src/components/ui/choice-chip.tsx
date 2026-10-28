import type { ComponentProps } from "react";

type ChoiceChipProps = ComponentProps<"button"> & {
  selected: boolean;
};

export function ChoiceChip({ selected, className = "", ...props }: ChoiceChipProps) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
        selected
          ? "border-pen bg-pen/10 text-pen-deep"
          : "border-rule bg-sheet text-ink-soft hover:border-pen/40"
      } ${className}`}
    />
  );
}

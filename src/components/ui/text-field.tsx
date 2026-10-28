import type { ComponentProps } from "react";

const fieldStyles = "w-full rounded-lg border border-rule bg-sheet px-3 py-2 text-sm text-ink placeholder:text-ink-faint";

export function TextField({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${fieldStyles} ${className}`} />;
}

export function TextArea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${fieldStyles} resize-y leading-relaxed ${className}`} />;
}

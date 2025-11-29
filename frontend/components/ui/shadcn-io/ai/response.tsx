import { cn } from "@/lib/utils";

type ResponseProps = {
  content: string;
  className?: string;
  animated?: boolean;
};

export function Response({ content, className, animated }: ResponseProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-muted-foreground/20 bg-background/60 p-4 text-sm shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/40",
        className,
      )}
      role={animated ? "status" : undefined}
      aria-live={animated ? "polite" : undefined}
    >
      <p className="whitespace-pre-line leading-relaxed">{content}</p>
    </div>
  );
}


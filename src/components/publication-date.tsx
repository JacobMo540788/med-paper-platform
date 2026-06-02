import { formatPublicationDate, formatPublicationDateIso } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PublicationDate({
  date,
  className,
  showIso = false,
  size = "sm",
}: {
  date: Date | string;
  className?: string;
  showIso?: boolean;
  size?: "sm" | "md";
}) {
  const iso = formatPublicationDateIso(date);
  const label = formatPublicationDate(date);

  return (
    <div className={cn("text-muted-foreground", size === "md" && "text-base", className)}>
      <span className="font-medium text-foreground">发表时间 Publication Date：</span>
      <time dateTime={iso || undefined}>{label}</time>
      {showIso && iso && (
        <span className="ml-2 text-xs opacity-70">({iso})</span>
      )}
    </div>
  );
}

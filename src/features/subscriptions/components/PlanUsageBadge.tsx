// Compact "Plano X · n de m mapas" indicator with a usage bar.
import { Link } from "@tanstack/react-router";
import { usageOf } from "../entitlements";
import { useEntitlements } from "../useEntitlements";

export function PlanUsageBadge() {
  const entitlements = useEntitlements((state) => state.entitlements);
  if (!entitlements) return null;

  const maps = usageOf(entitlements, "max_maps");
  const label = maps.limit === null ? `${maps.used} mapas` : `${maps.used} de ${maps.limit} mapas`;

  return (
    <Link
      to="/plans"
      className="flex shrink-0 flex-col gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary/40"
      title={maps.reached ? "Você atingiu o limite — veja os planos" : "Ver planos"}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">Plano {entitlements.plan.name}</span>
        <span className={maps.reached ? "font-medium text-destructive" : "text-muted-foreground"}>
          {label}
        </span>
      </div>
      {maps.ratio !== null && (
        <div
          role="progressbar"
          aria-label="Mapas utilizados"
          aria-valuemin={0}
          aria-valuemax={maps.limit ?? undefined}
          aria-valuenow={maps.used}
          className="h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full transition-[width] ${maps.reached ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.round(maps.ratio * 100)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "10 min", "1 dia", "3 dias", "2 meses" — how long until a card comes back. */
export function formatInterval(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} ${Math.round(days) === 1 ? "dia" : "dias"}`;
  if (days < 365)
    return `${Math.round(days / 30)} ${Math.round(days / 30) === 1 ? "mês" : "meses"}`;
  return `${Math.round(days / 365)} ${Math.round(days / 365) === 1 ? "ano" : "anos"}`;
}

/** "amanhã", "em 3 dias", "em 10 minutos" — when the next review is due. */
export function formatDue(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

// Translates the database's `PLAN_LIMIT:<key>` refusals into a typed error with a friendly message.
import type { CountLimitKey } from "./types";

const LIMIT_PREFIX = "PLAN_LIMIT:";

const LIMIT_LABELS: Record<CountLimitKey, (limit: number | null) => string> = {
  max_maps: (limit) =>
    limit === null
      ? "Você atingiu o limite de mapas do seu plano."
      : `Seu plano permite até ${limit} mapas ativos.`,
  max_nodes_per_map: (limit) =>
    limit === null
      ? "Este mapa atingiu o limite de nós do seu plano."
      : `Seu plano permite até ${limit} nós por mapa.`,
  max_folders: (limit) =>
    limit === null
      ? "Você atingiu o limite de pastas do seu plano."
      : `Seu plano permite até ${limit} pastas.`,
};

const LIMIT_HINTS: Record<CountLimitKey, string> = {
  max_maps: "Seus mapas atuais continuam disponíveis. Faça upgrade para criar mais.",
  max_nodes_per_map: "Nada foi apagado. Remova alguns nós ou faça upgrade para continuar salvando.",
  max_folders: "Suas pastas atuais continuam disponíveis. Faça upgrade para criar mais.",
};

export class PlanLimitError extends Error {
  constructor(public readonly limitKey: CountLimitKey) {
    super(`${LIMIT_PREFIX}${limitKey}`);
    this.name = "PlanLimitError";
  }

  friendlyMessage(limit: number | null = null) {
    return LIMIT_LABELS[this.limitKey](limit);
  }

  hint() {
    return LIMIT_HINTS[this.limitKey];
  }
}

const isLimitKey = (value: string): value is CountLimitKey => value in LIMIT_LABELS;

/** Returns a PlanLimitError if `error` is a plan-limit refusal from the database. */
export const asPlanLimitError = (error: unknown): PlanLimitError | null => {
  if (error instanceof PlanLimitError) return error;
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (!message.startsWith(LIMIT_PREFIX)) return null;
  const key = message.slice(LIMIT_PREFIX.length).trim();
  return isLimitKey(key) ? new PlanLimitError(key) : null;
};

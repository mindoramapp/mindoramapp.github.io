import { describe, expect, it } from "vitest";
import { normalizeAuthError } from "@/store/auth";

describe("normalizeAuthError", () => {
  it("explains undeliverable email addresses instead of a generic failure", () => {
    expect(normalizeAuthError('Email address "gabriel@mindoramapp.com" is invalid')).toBe(
      "Este e-mail não é válido ou não pode receber mensagens. Use um endereço que você acessa.",
    );
  });

  it("explains rate limits", () => {
    expect(normalizeAuthError("email rate limit exceeded")).toMatch(/Aguarde alguns minutos/);
  });

  it("keeps the generic message for unknown errors", () => {
    expect(normalizeAuthError("something odd")).toMatch(/Tente novamente/);
  });
});

import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16, plain } from "../pix";

describe("crc16", () => {
  it("matches the standard CRC-16/CCITT-FALSE check value", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("buildPixPayload", () => {
  it("follows the Banco Central BR Code layout field by field", () => {
    const payload = buildPixPayload({
      key: "123e4567-e12b-12d1-a456-426655440000",
      receiverName: "Fulano de Tal",
      receiverCity: "BRASILIA",
      txid: "***",
    });
    expect(payload.slice(0, -4)).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304",
    );
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("writes names without accents, in capitals ('João Ação' → 'JOAO ACAO')", () => {
    expect(plain("João Ação", 25)).toBe("JOAO ACAO");
    const payload = buildPixPayload({
      key: "b26ee480-c458-4a1c-8d5c-229087cf62ca",
      receiverName: "João Ação",
      receiverCity: "",
      amountCents: 990,
      txid: "MND-7F3K2Q",
    });
    expect(payload).toContain("5909JOAO ACAO");
    expect(payload).toContain("6006BRASIL");
    expect(payload).toContain("54049.90");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("includes the amount, order reference and a valid checksum", () => {
    const payload = buildPixPayload({
      key: "pix@exemplo.com",
      receiverName: "Gabriel Nunes",
      receiverCity: "Salvador",
      amountCents: 1490,
      txid: "MND-7F3K2Q",
      description: "Mindora Plus MND-7F3K2Q",
    });
    expect(payload).toContain("540514.90");
    expect(payload).toContain("0509MND7F3K2Q");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("strips accents and symbols that banks reject, and enforces field sizes", () => {
    const payload = buildPixPayload({
      key: "+5571999999999",
      receiverName: "João da Conceição & Filhos Comércio Ltda",
      receiverCity: "São Gonçalo dos Campos",
      amountCents: 2490,
    });
    expect(payload).toContain("5924JOAO DA CONCEICAO FILHOS");
    expect(payload).toContain("6015SAO GONCALO DOS");
    expect(payload).toContain("540524.90");
  });

  it("refuses to build a charge without a PIX key", () => {
    expect(() => buildPixPayload({ key: " ", receiverName: "A", receiverCity: "B" })).toThrow(
      /Chave Pix/,
    );
  });
});

describe("payment helpers", () => {
  it("warn about keys that expose a CPF or phone", async () => {
    const { pixKeyWarning } = await import("../format");
    expect(pixKeyWarning("123.456.789-09")).toMatch(/CPF/);
    expect(pixKeyWarning("71999428340")).toMatch(/telefone/);
    expect(pixKeyWarning("+55 (71) 99942-8340")).toMatch(/telefone/);
    expect(pixKeyWarning("b26ee480-c458-4a1c-8d5c-229087cf62ca")).toBeNull();
    expect(pixKeyWarning("pix@exemplo.com")).toBeNull();
  });

  it("build the WhatsApp link with the plan, the amount and the order", async () => {
    const { paymentMessage, whatsappLink } = await import("../format");
    const message = paymentMessage("Estudante semestral", 4990, "MND-7F3K2Q");
    expect(message.replace(/\u00a0/g, " ")).toBe(
      "Olá! Realizei o pagamento do Mindora Estudante semestral – R$ 49,90 (pedido MND-7F3K2Q). Aguardo meu código de acesso. Obrigado!",
    );
    const link = whatsappLink("5571999428340", message);
    expect(link.startsWith("https://wa.me/5571999428340?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(message);
  });
});

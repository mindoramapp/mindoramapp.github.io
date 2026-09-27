import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16 } from "../pix";

describe("crc16", () => {
  it("matches the standard CRC-16/CCITT-FALSE check value", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("buildPixPayload", () => {
  it("reproduces the example from the Banco Central BR Code manual", () => {
    expect(
      buildPixPayload({
        key: "123e4567-e12b-12d1-a456-426655440000",
        receiverName: "Fulano de Tal",
        receiverCity: "BRASILIA",
        txid: "***",
      }),
    ).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
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
    expect(payload).toContain("5925Joao da Conceicao Filhos");
    expect(payload).toContain("6015Sao Goncalo dos");
    expect(payload).toContain("540524.90");
  });

  it("refuses to build a charge without a PIX key", () => {
    expect(() => buildPixPayload({ key: " ", receiverName: "A", receiverCity: "B" })).toThrow(
      /Chave Pix/,
    );
  });
});

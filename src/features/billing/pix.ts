// PIX "BR Code" (copia e cola / QR) for a static charge, following the Banco Central EMV MPM
// layout: each field is ID (2 digits) + length (2 digits) + value, ending with a CRC16 checksum.

const field = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by the BR Code spec. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Banks reject accents and some symbols in name/city; keep plain ASCII letters, digits, spaces. */
const plain = (value: string, max: number) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export interface PixCharge {
  key: string;
  receiverName: string;
  receiverCity: string;
  /** Omit for an open amount. */
  amountCents?: number;
  /** Reference shown to the receiver where the bank supports it (letters and digits only). */
  txid?: string;
  /** Short message attached to the payment. */
  description?: string;
}

export function buildPixPayload(charge: PixCharge): string {
  const key = charge.key.trim();
  if (!key) throw new Error("Chave Pix não configurada.");

  const account =
    field("00", "br.gov.bcb.pix") +
    field("01", key) +
    (charge.description ? field("02", plain(charge.description, 40)) : "");
  const txid =
    charge.txid === "***"
      ? "***"
      : (charge.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (charge.amountCents ? field("54", (charge.amountCents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", plain(charge.receiverName, 25) || "RECEBEDOR") +
    field("60", plain(charge.receiverCity, 15) || "BRASIL") +
    field("62", field("05", txid)) +
    "6304";

  return payload + crc16(payload);
}

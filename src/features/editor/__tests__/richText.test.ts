import { describe, expect, it } from "vitest";
import { hasFormatting, parseRich, plainText, toggleMark } from "../richText";

describe("parseRich", () => {
  it("reads bold, italic, strike and nesting", () => {
    expect(parseRich("A **forte** e *leve* ~~não~~")).toEqual([
      { text: "A " },
      { text: "forte", bold: true },
      { text: " e " },
      { text: "leve", italic: true },
      { text: " " },
      { text: "não", strike: true },
    ]);
    expect(parseRich("**muito *importante***")).toEqual([
      { text: "muito ", bold: true },
      { text: "importante", bold: true, italic: true },
    ]);
  });

  it("leaves math, snake_case and unclosed marks alone", () => {
    for (const label of ["x * y * z", "nome_do_arquivo", "**aberto", "2 ** 3", "6CO2 + 6H2O"]) {
      expect(plainText(label)).toBe(label);
      expect(hasFormatting(label)).toBe(false);
    }
  });

  it("keeps line breaks", () => {
    expect(plainText("linha 1\n**linha 2**")).toBe("linha 1\nlinha 2");
  });
});

describe("toggleMark", () => {
  it("formats the whole text when nothing is selected, and undoes it", () => {
    const on = toggleMark("Fotossíntese", 3, 3, "bold");
    expect(on.value).toBe("**Fotossíntese**");
    expect(toggleMark(on.value, 0, 0, "bold").value).toBe("Fotossíntese");
  });

  it("wraps just the selection, without the spaces around it", () => {
    expect(toggleMark("ciclo de Calvin", 5, 9, "italic").value).toBe("ciclo *de* Calvin");
    const wrapped = toggleMark("a b c", 2, 3, "strike");
    expect(wrapped).toEqual({ value: "a ~~b~~ c", start: 4, end: 5 });
    expect(toggleMark(wrapped.value, wrapped.start, wrapped.end, "strike").value).toBe("a b c");
  });
});

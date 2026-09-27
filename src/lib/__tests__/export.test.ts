import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import { parseImportedMap, toJson, toMarkdown } from "@/lib/export";
import { createBlankMap, type MindNodeData } from "@/store/maps";

const owner = { id: "user-1", email: "pessoa@ufba.br" };

const node = (id: string, y: number, data: Partial<MindNodeData> = {}): Node<MindNodeData> => ({
  id,
  type: "mind",
  position: { x: 0, y },
  data: { label: id, ...data },
});

const tree = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { kind: "tree" },
});

describe("toMarkdown", () => {
  it("renders the tree as a nested list ordered by position, with cross-links apart", () => {
    const map = createBlankMap(owner, "Estudo");
    const nodes = [
      node("root", 0, { label: "Estudo", isRoot: true }),
      node("b", 100, { label: "Segundo" }),
      node("a", -100, { label: "Primeiro", kind: "checklist", checked: true }),
      node("a1", -100, { label: "Site", kind: "link", url: "https://ufba.br" }),
    ];
    const edges = [
      tree("root", "b"),
      tree("root", "a"),
      tree("a", "a1"),
      { id: "x", source: "a1", target: "b", data: { kind: "graph" } },
    ];

    expect(toMarkdown(map, nodes, edges)).toBe(
      [
        "# Estudo",
        "",
        "- Estudo",
        "  - [x] Primeiro",
        "    - [Site](https://ufba.br)",
        "  - Segundo",
        "",
        "## Conexões",
        "",
        "- Site ↔ Segundo",
        "",
      ].join("\n"),
    );
  });

  it("includes disconnected nodes and survives cycles", () => {
    const map = createBlankMap(owner, "Ciclo");
    const nodes = [node("root", 0, { isRoot: true }), node("a", 10), node("solto", 20)];
    const edges = [tree("root", "a"), tree("a", "root")];

    const lines = toMarkdown(map, nodes, edges).split("\n");
    expect(lines).toContain("- root");
    expect(lines).toContain("  - a");
    expect(lines).toContain("- solto");
  });
});

describe("parseImportedMap", () => {
  it("round-trips a JSON export", () => {
    const map = createBlankMap(owner, "Backup", "study");
    const nodes = [node("root", 0, { label: "Backup", isRoot: true }), node("a", 50)];
    const edges = [tree("root", "a")];

    const imported = parseImportedMap(toJson(map, nodes, edges));
    expect(imported.title).toBe("Backup");
    expect(imported.mode).toBe("study");
    expect(imported.nodes.map((n) => n.id)).toEqual(["root", "a"]);
    expect(imported.edges.map((e) => e.id)).toEqual(["root-a"]);
  });

  it("rejects files that are not Mindora exports", () => {
    expect(() => parseImportedMap("não é json")).toThrow("JSON válido");
    expect(() => parseImportedMap(JSON.stringify({ nodes: [] }))).toThrow("Mindora");
  });

  it("drops invalid nodes, dangling edges and unsafe URLs", () => {
    const raw = JSON.stringify({
      format: "mindora-map",
      version: 1,
      title: "  ",
      mode: "hack",
      nodes: [
        node("root", 0, { isRoot: true, url: "javascript:alert(1)", linkedMapId: "outro" }),
        { id: "sem-posicao", data: { label: "x" } },
      ],
      edges: [tree("root", "fantasma")],
    });

    const imported = parseImportedMap(raw);
    expect(imported.title).toBe("Mapa importado");
    expect(imported.mode).toBe("brainstorm");
    expect(imported.nodes).toHaveLength(1);
    expect(imported.nodes[0].data.url).toBe("");
    expect(imported.nodes[0].data.linkedMapId).toBeUndefined();
    expect(imported.edges).toHaveLength(0);
  });
});

describe("anotações dos nós", () => {
  const map = createBlankMap(owner, "Estudo");
  const nodes = [
    node("root", 0, {
      label: "Estudo",
      isRoot: true,
      note: "Linha 1\n<b>negrito</b> [x](javascript:1)",
    }),
  ];

  it("sobrevivem à exportação e importação em JSON", () => {
    const imported = parseImportedMap(toJson(map, nodes, []));
    expect(imported.nodes[0].data.note).toBe(nodes[0].data.note);
  });

  it("aparecem no Markdown abaixo do tópico, sem HTML ou links ativos", () => {
    const md = toMarkdown(map, nodes, []);
    expect(md).toContain("  > Linha 1");
    expect(md).not.toMatch(/<b>|\]\(javascript:/);
  });
});

describe("temas no backup JSON", () => {
  it("preserva tema do mapa e aparências válidas, descartando o resto", () => {
    const map = createBlankMap(owner, "Tema");
    const nodes = [
      node("root", 0, { label: "Tema", isRoot: true, mapTheme: "neon" }),
      node("a", 50, { appearance: { bg: "#fbcfe8", border: "rounded" } }),
    ];
    const edges: Edge[] = [
      {
        ...tree("root", "a"),
        data: { kind: "tree", appearance: { color: "#ef4444", line: "wavy" } },
      },
    ];
    const imported = parseImportedMap(toJson(map, nodes, edges));
    expect(imported.nodes[0].data.mapTheme).toBe("neon");
    expect(imported.nodes[1].data.appearance).toEqual({ bg: "#fbcfe8", border: "rounded" });
    expect(imported.edges[0].data).toMatchObject({
      appearance: { color: "#ef4444", line: "wavy" },
    });

    const evil = parseImportedMap(
      toJson(
        map,
        [
          node("root", 0, {
            isRoot: true,
            mapTheme: "hack" as never,
            appearance: { bg: "expression(alert(1))" } as never,
          }),
        ],
        [],
      ),
    );
    expect(evil.nodes[0].data.mapTheme).toBeUndefined();
    expect(evil.nodes[0].data.appearance).toBeUndefined();
  });
});

// Simulated attacks on the browser side: stored XSS through node content, malicious links and
// poisoned import files. Each test is an attack that must fail.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "reactflow";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MindNode } from "@/components/MindNode";
import { parseImportedMap, toMarkdown } from "@/lib/export";
import { isSafeNodeUrl, sanitizeNodeUrl } from "@/lib/security";
import { createBlankMap, type MindNodeData } from "@/store/maps";

const XSS_PAYLOADS = [
  "<img src=x onerror=alert(1)>",
  "<script>alert(1)</script>",
  '"><svg onload=alert(1)>',
  "<iframe src=javascript:alert(1)>",
];

const MALICIOUS_URLS = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "  javascript:alert(document.cookie)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "vbscript:msgbox(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
  "blob:https://evil.example/1",
  "\u0000javascript:alert(1)",
];

const renderNode = (data: MindNodeData) =>
  render(
    <ReactFlowProvider>
      <MindNode
        id="n1"
        type="mind"
        data={data}
        selected={false}
        isConnectable
        xPos={0}
        yPos={0}
        zIndex={0}
        dragging={false}
      />
    </ReactFlowProvider>,
  );

describe("ataque: XSS armazenado no conteúdo do nó", () => {
  it.each(XSS_PAYLOADS)("rótulo %s é exibido como texto, nunca executado", (payload) => {
    const { container } = renderNode({ label: payload, kind: "text" });
    expect(container.querySelector("img, script, svg[onload], iframe")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it.each(MALICIOUS_URLS)("link %j não vira href executável", (url) => {
    const { container } = renderNode({ label: "clique", kind: "link", url });
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    for (const href of hrefs)
      expect(href.toLowerCase().replace(/\s/g, "")).not.toMatch(
        /^(javascript|vbscript|data|file|blob):/,
      );
  });
});

describe("ataque: sanitização de URLs", () => {
  it.each(MALICIOUS_URLS)("rejeita %j", (url) => {
    expect(sanitizeNodeUrl(url)).toBe("");
    expect(isSafeNodeUrl(url)).toBe(false);
  });

  it.each(["//evil.example/phish", "/\\evil.example", "\\\\evil.example"])(
    "não aceita %j como caminho interno (redirecionamento para outro site)",
    (url) => {
      expect(sanitizeNodeUrl(url)).toBe("");
    },
  );

  it("mantém links legítimos", () => {
    expect(sanitizeNodeUrl("https://ufba.br/igeo")).toBe("https://ufba.br/igeo");
    expect(sanitizeNodeUrl("/editor/123")).toBe("/editor/123");
  });
});

describe("ataque: arquivo de importação envenenado", () => {
  const wrap = (nodes: unknown[], extra: Record<string, unknown> = {}) =>
    JSON.stringify({ format: "mindora-map", version: 1, title: "x", nodes, edges: [], ...extra });

  it("não polui o protótipo de objetos (prototype pollution)", () => {
    const raw =
      '{"format":"mindora-map","version":1,"title":"x","__proto__":{"polluted":true},' +
      '"nodes":[{"id":"root","position":{"x":0,"y":0},"data":{"label":"a","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}}],"edges":[]}';
    parseImportedMap(raw);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("descarta links perigosos e referências a mapas de outras contas", () => {
    const imported = parseImportedMap(
      wrap([
        {
          id: "root",
          position: { x: 0, y: 0 },
          data: { label: "a", kind: "link", url: "javascript:alert(1)", linkedMapId: "vitima" },
        },
      ]),
    );
    expect(imported.nodes[0].data.url).toBe("");
    expect(imported.nodes[0].data.linkedMapId).toBeUndefined();
  });

  it("não aceita propriedades de ReactFlow que alterariam o comportamento do editor", () => {
    const imported = parseImportedMap(
      wrap([
        {
          id: "root",
          position: { x: 0, y: 0 },
          data: { label: "a" },
          style: { position: "fixed", inset: 0, zIndex: 99999 },
          className: "overlay",
          hidden: true,
          draggable: false,
          parentNode: "outro",
        },
      ]),
    );
    expect(Object.keys(imported.nodes[0]).sort()).toEqual(["data", "id", "position", "type"]);
  });

  it("recusa arquivos gigantes antes de processar", () => {
    const huge = wrap(
      Array.from({ length: 20_000 }, (_, i) => ({
        id: `n${i}`,
        position: { x: 0, y: 0 },
        data: { label: "x".repeat(200) },
      })),
    );
    expect(() => parseImportedMap(huge)).toThrow(/muito grande/);
  });

  it("recusa tipos de dados inesperados nos campos", () => {
    const imported = parseImportedMap(
      wrap([
        {
          id: "root",
          position: { x: 0, y: 0 },
          data: { label: "a", kind: "<script>", checked: "sim" },
        },
      ]),
    );
    expect(imported.nodes[0].data.kind).toBe("text");
    expect(imported.nodes[0].data.checked).toBeUndefined();
  });
});

describe("ataque: exportação Markdown", () => {
  it("não transforma rótulos em links ou HTML ativos", () => {
    const map = createBlankMap({ id: "u", email: "u@x.com" }, "Mapa");
    const md = toMarkdown(
      map,
      [
        {
          id: "root",
          position: { x: 0, y: 0 },
          data: {
            label: "[clique](javascript:alert(1)) <img src=x onerror=alert(1)>",
            isRoot: true,
          },
        },
      ],
      [],
    );
    expect(md).not.toMatch(/\]\(javascript:/);
    expect(md).not.toMatch(/<img/);
  });
});

describe("defesas do documento HTML", () => {
  const html = readFileSync(join(__dirname, "..", "..", "..", "index.html"), "utf8");
  const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/)?.[1] ?? "";

  it("CSP de scripts não permite scripts inline nem eval", () => {
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
  });
});

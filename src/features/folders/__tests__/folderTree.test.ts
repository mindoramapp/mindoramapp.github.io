import { describe, expect, it } from "vitest";
import {
  buildFolderExport,
  canMoveFolder,
  childrenByParent,
  parseFolderImport,
  subtreeIds,
} from "../folderTree";
import { createBlankMap, type MindFolder } from "@/store/maps";

const owner = { id: "u", email: "u@x.com" };
const folder = (id: string, parentId: string | null, name = id): MindFolder => ({
  id,
  parentId,
  name,
  ownerId: "u",
  ownerEmail: "u@x.com",
  createdAt: 0,
  updatedAt: 0,
});
// Faculdade > (Cálculo > Provas), Física
const folders = [
  folder("fac", null, "Faculdade"),
  folder("calc", "fac", "Cálculo"),
  folder("prov", "calc", "Provas"),
  folder("fis", "fac", "Física"),
  folder("pes", null, "Pessoal"),
];

describe("folder hierarchy", () => {
  it("groups children by parent and sorts by name", () => {
    const children = childrenByParent(folders);
    expect(children.get(null)!.map((f) => f.name)).toEqual(["Faculdade", "Pessoal"]);
    expect(children.get("fac")!.map((f) => f.name)).toEqual(["Cálculo", "Física"]);
  });

  it("finds a whole subtree", () => {
    expect([...subtreeIds("fac", folders)].sort()).toEqual(["calc", "fac", "fis", "prov"]);
  });

  it("never lets a folder move into itself or its descendants", () => {
    expect(canMoveFolder("fac", "prov", folders)).toBe(false);
    expect(canMoveFolder("fac", "fac", folders)).toBe(false);
    expect(canMoveFolder("prov", "pes", folders)).toBe(true);
    expect(canMoveFolder("calc", null, folders)).toBe(true);
  });

  it("survives cycles in stored data", () => {
    const cyclic = [folder("a", "b"), folder("b", "a")];
    expect(() => subtreeIds("a", cyclic)).not.toThrow();
  });
});

describe("folder export / import", () => {
  const maps = [
    { ...createBlankMap(owner, "Limites"), folderId: "calc" },
    { ...createBlankMap(owner, "P1 2026"), folderId: "prov" },
    { ...createBlankMap(owner, "Fora"), folderId: "pes" },
  ];

  it("round-trips a folder with its subfolders and maps (and nothing outside it)", () => {
    const exported = buildFolderExport("fac", folders, maps);
    const imported = parseFolderImport(JSON.stringify(exported));
    expect(imported.name).toBe("Faculdade");
    expect(imported.folders.map((f) => f.name).sort()).toEqual([
      "Cálculo",
      "Faculdade",
      "Física",
      "Provas",
    ]);
    // Parents always come before their children, so the tree can be recreated in order.
    const position = new Map(imported.folders.map((f, i) => [f.key, i]));
    for (const f of imported.folders)
      if (f.parentKey) expect(position.get(f.parentKey)!).toBeLessThan(position.get(f.key)!);
    expect(imported.folders[0].parentKey).toBeNull();
    expect(imported.maps.map((m) => m.map.title).sort()).toEqual(["Limites", "P1 2026"]);
  });

  it("rejects files that are not folder exports or have a broken structure", () => {
    expect(() => parseFolderImport('{"format":"mindora-map"}')).toThrow(/pasta exportada/);
    expect(() =>
      parseFolderImport(
        JSON.stringify({
          format: "mindora-folder",
          version: 1,
          folders: [
            { key: "a", parentKey: null, name: "A" },
            { key: "b", parentKey: null, name: "B" },
          ],
          maps: [],
        }),
      ),
    ).toThrow(/estrutura/);
  });

  it("validates every map inside the folder like a single-map import", () => {
    const exported = buildFolderExport("calc", folders, maps);
    (exported.maps[0].map as { nodes: { data: { url?: string } }[] }).nodes[0].data.url =
      "javascript:alert(1)";
    const imported = parseFolderImport(JSON.stringify(exported));
    expect(imported.maps[0].map.nodes[0].data.url).toBe("");
  });
});

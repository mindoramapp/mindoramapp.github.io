import { beforeEach, describe, expect, it } from "vitest";
import type { MindMap } from "@/store/maps";
import { clearDraft, readDraft, withNewerDraft, writeDraft } from "../draftBackup";

const map = (updatedAt: number, label = "Raiz"): MindMap =>
  ({
    id: "m1",
    ownerId: "u1",
    title: "Mapa",
    nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: { label, isRoot: true } }],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    updatedAt,
  }) as unknown as MindMap;

describe("draftBackup", () => {
  beforeEach(() => window.localStorage.clear());

  it("writes and reads a draft per owner and map", () => {
    writeDraft(map(10));
    expect(readDraft("u1", "m1")?.updatedAt).toBe(10);
    expect(readDraft("u2", "m1")).toBeNull();
  });

  it("keeps a draft newer than the save that finished", () => {
    writeDraft(map(20));
    clearDraft("u1", "m1", 10);
    expect(readDraft("u1", "m1")).not.toBeNull();
    clearDraft("u1", "m1", 20);
    expect(readDraft("u1", "m1")).toBeNull();
  });

  it("restores the content of a newer draft", () => {
    writeDraft(map(50, "Editado offline"));
    const result = withNewerDraft({ ...map(40), title: "Nome do servidor" });
    expect(result.restored).toBe(true);
    expect(result.map.title).toBe("Nome do servidor");
    expect(result.map.nodes[0].data.label).toBe("Editado offline");
  });

  it("drops an older draft and keeps the server copy", () => {
    writeDraft(map(30, "Velho"));
    const result = withNewerDraft(map(40, "Servidor"));
    expect(result.restored).toBe(false);
    expect(result.map.nodes[0].data.label).toBe("Servidor");
    expect(readDraft("u1", "m1")).toBeNull();
  });

  it("ignores corrupted drafts", () => {
    window.localStorage.setItem("mindora-draft:u1:m1", "{not json");
    expect(readDraft("u1", "m1")).toBeNull();
    window.localStorage.setItem("mindora-draft:u1:m1", JSON.stringify({ id: "m1", ownerId: "u1" }));
    expect(readDraft("u1", "m1")).toBeNull();
  });
});

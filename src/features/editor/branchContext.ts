// Child and descendant counts per node, for the fold button on each topic (see branches.ts).
import { createContext } from "react";
import type { BranchInfo } from "./branches";

export const BranchInfoContext = createContext<ReadonlyMap<string, BranchInfo>>(new Map());

/** Whether the selected topic shows the Tab / Enter hint (small maps, mouse and keyboard). */
export const KeyHintContext = createContext(false);

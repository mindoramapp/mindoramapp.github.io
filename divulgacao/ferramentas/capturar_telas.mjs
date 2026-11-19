// Still screenshots of the real app for the landing (showcase and the "Como funciona" steps),
// taken with the demo account session in ~/.cache/mindora-gravacao (see 00_PLANO_DE_ACAO.md).
// Output: divulgacao/brutos/telas/*.png (the landing uses optimized WebP copies in src/assets).
// Usage: node divulgacao/ferramentas/capturar_telas.mjs
import { spawn } from "node:child_process";
import { mkdirSync, readlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(resolve(HERE, ".."), "brutos", "telas");
const APP = process.env.MINDORA_URL ?? "https://mindoramapp.github.io/";
const PROFILE = join(homedir(), ".cache", "mindora-gravacao");
const PORT = 9334;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
mkdirSync(OUT, { recursive: true });

try {
  process.kill(Number(readlinkSync(join(PROFILE, "SingletonLock")).split("-").pop()), 0);
  throw new Error("O perfil de gravação está aberto em outro Chrome. Feche essa janela.");
} catch (error) {
  if (error.message.startsWith("O perfil")) throw error;
}

const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "--window-size=1280,800",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let socketUrl;
for (let i = 0; i < 50 && !socketUrl; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    socketUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl;
  } catch {
    // still starting
  }
  if (!socketUrl) await sleep(200);
}
const ws = new WebSocket(socketUrl);
await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
const send = (method, params = {}) =>
  new Promise((ok, fail) => {
    const id = ++nextId;
    pending.set(id, (message) =>
      message.error ? fail(new Error(message.error.message)) : ok(message.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result
    .value;

await send("Page.enable");
// Same clean setup as gravar.mjs: dark theme, no tour, tips, install card or floating panels.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => { try {
    localStorage.setItem("mm_theme", "dark");
    localStorage.setItem("mindora-perf", "full");
    localStorage.setItem("mindora-install-dismissed-at", String(Date.now()));
    localStorage.setItem("mindora-editor-panels-v1", JSON.stringify({
      inspector: { show: false, minimized: true, position: { x: 12, y: 12 } },
      help: { show: false, minimized: true, position: { x: 12, y: 12 } },
      minimap: { show: false, minimized: true, position: { x: 12, y: 12 } } }));
    for (const key of Object.keys(localStorage)) {
      if (!/^sb-.*-auth-token$/.test(key)) continue;
      const id = JSON.parse(localStorage.getItem(key))?.user?.id;
      if (!id) continue;
      localStorage.setItem("mm_onboard_v2_" + id, "done");
      localStorage.setItem("mm_tips_v2_" + id, JSON.stringify(["first-child", "connect-ideas", "organize", "context-menu"]));
    }
  } catch {} })();`,
});

async function viewport(width, height, scale, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}
async function go(hash, wait = 3500) {
  await send("Page.navigate", { url: `${APP}${hash}` });
  await sleep(wait);
}
async function center(selector, text) {
  return evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((node) => node.getBoundingClientRect().width > 0 && node.textContent.includes(${JSON.stringify(text ?? "")}));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
}
async function click(selector, text) {
  const point = await center(selector, text);
  if (!point) throw new Error(`Não encontrei ${selector} "${text ?? ""}"`);
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  await sleep(400);
}
async function key(name, code, keyCode, text) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: name,
    code,
    windowsVirtualKeyCode: keyCode,
    text,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: name,
    code,
    windowsVirtualKeyCode: keyCode,
  });
  await sleep(500);
}
async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`${name}.png`);
}
async function openMap(title) {
  await go("#/dashboard");
  if (await center("h1", "Entrar"))
    throw new Error("A sessão da conta demo expirou: entre de novo no perfil de gravação.");
  // Exact title: "Fotossíntese" must not match "Fotossíntese (Enem)".
  const card = await evaluate(`(() => {
    const h = [...document.querySelectorAll("h3")].find((n) => n.textContent.trim() === ${JSON.stringify(title)});
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!card) throw new Error(`Mapa não encontrado: ${title}`);
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, ...card, button: "left", clickCount: 1 });
  await sleep(3500);
  await evaluate(`window.dispatchEvent(new Event("mm-center"))`);
  await sleep(700);
  // Click empty canvas: nothing selected, nothing dimmed.
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, x: 30, y: 300, button: "left", clickCount: 1 });
  await sleep(500);
}

try {
  // Showcase: the full map on a laptop and on a phone.
  await viewport(1280, 800, 2);
  await openMap("Fotossíntese (Enem)");
  await shot("vitrine_computador");
  await viewport(390, 844, 3, true);
  await openMap("Fotossíntese (Enem)");
  await shot("vitrine_celular");

  // Step 1: the new map dialog, with a name and the Study template.
  await viewport(1280, 800, 2);
  await go("#/dashboard");
  await click("button", "Novo mapa");
  await sleep(500);
  await click('input[aria-label="Nome do mapa"]');
  await send("Input.insertText", { text: "Revolução Francesa" });
  await click('[role="radio"]', "Estudo");
  await sleep(400);
  await shot("passo1_novo_mapa");
  await key("Escape", "Escape", 27);

  // Step 2: the branches growing (the typing-scene map from the video).
  await openMap("Fotossíntese");
  await shot("passo2_ramos");

  // Step 3: a review card with the answer shown.
  await openMap("Fotossíntese (Enem)");
  await click("button", "Revisar");
  await sleep(2000);
  await key("Enter", "Enter", 13, "\r");
  await key(" ", "Space", 32, " ");
  await sleep(600);
  await shot("passo3_revisao");
} finally {
  ws.close();
  chrome.kill();
}

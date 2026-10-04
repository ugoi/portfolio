import { cameraAtDive, depthAtScroll, MAX_DIVE_DEPTH } from "../dive";
import type { OceanController } from "../ocean";

const select = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const site = select(".site");
const journey = select(".dive-journey");
const viewport = select(".dive-viewport");
const scene = select<HTMLDivElement>(".hero-scene");
const interaction = select<HTMLDivElement>(".buoy-interaction");
const fallback = select(".fallback-world");
const surface = select(".surface-content");
const meter = select(".depth-display");
const reading = select(".depth-reading strong");
const depthLabel = select(".depth-display .micro-label");
const marker = select(".depth-marker");
const chapter = select("[data-chapter]");
const pause = select<HTMLButtonElement>(".motion-button");
const hint = select(".ring-hint");
const media = matchMedia("(prefers-reduced-motion: reduce)");
const listeners = new AbortController();
let controller: OceanController | null = null;
let disposed = false;
let blueprint = false;
let paused: boolean | null = null;
let frame = 0;
let previousDepth = -1;

function showDepth(nominal: number, immersion: number) {
  journey.style.setProperty("--surface-visibility", String(Math.max(0, 1 - nominal / .65)));
  journey.style.setProperty("--dive-progress", String(immersion / MAX_DIVE_DEPTH));
  journey.style.setProperty("--town-visibility", String(Math.max(0, Math.min(1, (immersion / MAX_DIVE_DEPTH - .96) / .04))));
  surface.inert = nominal >= .65;
  site.classList.toggle("is-underwater", immersion > 0);
  const depth = Math.round(immersion * 10) / 10;
  if (depth === previousDepth) return;
  previousDepth = depth;
  meter.setAttribute("aria-valuenow", String(depth));
  reading.textContent = Math.round(depth).toLocaleString("de-CH");
  marker.style.top = `${depth / MAX_DIVE_DEPTH * 100}%`;
  depthLabel.textContent = depth >= MAX_DIVE_DEPTH * .985 ? "BIKINI BOTTOM" : depth >= MAX_DIVE_DEPTH * .4 ? "IM BLAU" : depth > 0 ? "UNTER WASSER" : "OBERFLÄCHE";
}
function update() {
  frame = 0;
  const top = journey.getBoundingClientRect().top + scrollY;
  const depth = depthAtScroll(scrollY, top, journey.offsetHeight, viewport.offsetHeight);
  const immersion = cameraAtDive(depth, viewport.clientWidth < 600).depth;
  if (controller) controller.setDive(depth);
  else showDepth(depth, immersion);
  const chapters = [["contact", "06 / FEIERABEND"], ["bikini-bottom", "05 / BIKINI BOTTOM"], ["tech", "04 / DIE NEUGIER"], ["elements", "03 / DER ANTRIEB"], ["about", "02 / DER MENSCH"]];
  chapter.textContent = chapters.find(([id]) => document.getElementById(id)!.getBoundingClientRect().top <= viewport.clientHeight * .55)?.[1] ?? (immersion > 0 ? "01 / ABTAUCHEN" : "01 / OBERFLÄCHE");
}
function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(update); }
function syncPause() {
  const stopped = paused ?? media.matches;
  pause.textContent = stopped ? "▶" : "Ⅱ";
  pause.setAttribute("aria-label", stopped ? "Animation starten" : "Animation pausieren");
  controller?.setPaused(paused);
}
function unavailable() {
  fallback.hidden = false;
  viewport.classList.add("is-fallback");
  pause.hidden = true;
  hint.hidden = true;
  // A lost context cannot animate; dispose listeners and GPU resources too.
  queueMicrotask(() => { controller?.dispose(); controller = null; schedule(); });
}
function supportsWebGL2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
}
async function startScene() {
  if (disposed || !supportsWebGL2()) return;
  try {
    const { createOcean } = await import("../ocean");
    if (disposed) return;
    controller = createOcean(scene, interaction, unavailable, showDepth);
    controller.setBlueprint(blueprint);
    syncPause();
    fallback.hidden = true;
    viewport.classList.remove("is-fallback");
    pause.hidden = false;
    hint.hidden = false;
    update();
  } catch { unavailable(); }
}

select(".scene-controls").hidden = false;
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-blueprint]")) {
  button.addEventListener("click", () => {
    blueprint = button.dataset.blueprint === "true";
    site.classList.toggle("is-blueprint", blueprint);
    for (const control of document.querySelectorAll<HTMLButtonElement>("[data-blueprint]")) {
      const active = (control.dataset.blueprint === "true") === blueprint;
      control.classList.toggle("selected", active);
      control.setAttribute("aria-pressed", String(active));
    }
    controller?.setBlueprint(blueprint);
  }, { signal: listeners.signal });
}
pause.addEventListener("click", () => { paused = !(paused ?? media.matches); syncPause(); }, { signal: listeners.signal });
media.addEventListener("change", syncPause, { signal: listeners.signal });
const observer = new ResizeObserver(schedule);
observer.observe(journey);
observer.observe(viewport);
window.addEventListener("scroll", schedule, { passive: true, signal: listeners.signal });
window.addEventListener("resize", schedule, { signal: listeners.signal });
window.addEventListener("pagehide", (event) => {
  if (event.persisted) { controller?.setPaused(true); return; }
  disposed = true;
  cancelAnimationFrame(frame);
  observer.disconnect();
  listeners.abort();
  controller?.dispose();
  controller = null;
}, { signal: listeners.signal });
window.addEventListener("pageshow", () => { syncPause(); schedule(); }, { signal: listeners.signal });
update();
// Give static content a paint before probing and importing the 3D world.
requestAnimationFrame(() => requestAnimationFrame(() => { void startScene(); }));

// Retire only the site's former cache-first service worker.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      if (registration.active?.scriptURL === `${location.origin}/sw.js`) void registration.update().catch(() => {});
    }
  }).catch(() => {});
}

import htmx from "htmx.org";

const form = document.querySelector<HTMLFormElement>("#contact-form")!;
const status = document.querySelector<HTMLElement>("#contact-status")!;
const area = document.querySelector<HTMLElement>(".contact-form-area")!;
const again = document.querySelector<HTMLButtonElement>(".contact-again")!;
const dialog = document.querySelector<HTMLDialogElement>(".contact-dialog");
let opener: HTMLElement | null = null;
if (dialog && typeof dialog.showModal === "function") {
  document.querySelectorAll<HTMLAnchorElement>("[data-contact-open]").forEach(link => {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      opener = link;
      dialog.showModal();
      document.documentElement.classList.add("contact-open");
      dialog.querySelector<HTMLElement>("#dialog-title")!.focus({ preventScroll: true });
    });
  });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const stops = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const first = stops[0], last = stops[stops.length - 1];
    if (!first) return;
    const outsideStops = !stops.includes(document.activeElement as HTMLElement);
    if (event.shiftKey && (document.activeElement === first || outsideStops)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || outsideStops)) {
      event.preventDefault(); first.focus();
    }
  });
  dialog.querySelector(".contact-close")!.addEventListener("click", () => dialog.close());
  // Only a full click on the backdrop closes; dragging from a field must not.
  let backdropDown = false;
  function onBackdrop(event: MouseEvent) {
    const box = dialog!.getBoundingClientRect();
    return event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
  }
  dialog.addEventListener("pointerdown", event => { backdropDown = onBackdrop(event); });
  dialog.addEventListener("click", event => { if (backdropDown && onBackdrop(event)) dialog.close(); backdropDown = false; });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("contact-open");
    opener?.focus({ preventScroll: true });
  });
}
again.addEventListener("click", () => {
  area.classList.remove("contact-sent");
  again.hidden = true;
  status.replaceChildren();
  form.hidden = false;
  form.querySelector<HTMLInputElement>("input")!.focus({ preventScroll: true });
});
// Never evaluate attributes or run scripts from server responses.
htmx.config.allowEval = false;
htmx.config.allowScriptTags = false;
htmx.config.selfRequestsOnly = true;
htmx.config.includeIndicatorStyles = false;
htmx.process(form);

type HtmxEvent = CustomEvent<{ target: HTMLElement; xhr: XMLHttpRequest; shouldSwap: boolean; isError: boolean }>;
document.addEventListener("htmx:beforeSwap", (event) => {
  const detail = (event as HtmxEvent).detail;
  if (detail.target !== status) return;
  // Our endpoint sends accessible HTML for validation, throttling and provider errors.
  if ([400, 403, 413, 415, 422, 429, 503].includes(detail.xhr.status) && detail.xhr.getResponseHeader("X-Contact-Response") === "1") {
    detail.shouldSwap = true;
    detail.isError = false;
  }
});
form.addEventListener("htmx:afterRequest", (event) => {
  const detail = (event as HtmxEvent).detail;
  if (detail.xhr.getResponseHeader("X-Contact-Sent") === "1") {
    form.reset();
    form.hidden = true;
    area.classList.add("contact-sent");
    again.hidden = false;
  }
  if (detail.xhr.status >= 400 && detail.xhr.getResponseHeader("X-Contact-Response") !== "1") networkError();
});
document.addEventListener("htmx:afterSwap", (event) => {
  if ((event as HtmxEvent).detail.target === status) focusStatus();
});
function focusStatus() {
  // A response may arrive after the visitor closed the dialog. Keep the result
  // for reopening, without stealing focus or moving the page underneath.
  if (dialog && !dialog.open) return;
  status.focus({ preventScroll: true });
  if (dialog) {
    const body = dialog.querySelector<HTMLElement>(".contact-dialog-body")!;
    const overflow = status.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom + 24;
    if (overflow > 0) body.scrollTop += overflow;
  } else status.scrollIntoView({ block: "nearest", behavior: "instant" });
}
function networkError() {
  status.textContent = "Die Übertragung konnte nicht bestätigt werden. Deine Nachricht bleibt im Formular. Versuche es später erneut oder nutze den E-Mail-Link.";
  focusStatus();
}
form.addEventListener("htmx:sendError", networkError);
form.addEventListener("htmx:timeout", networkError);

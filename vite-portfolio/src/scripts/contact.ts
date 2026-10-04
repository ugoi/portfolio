import htmx from "htmx.org";

const form = document.querySelector<HTMLFormElement>("#contact-form")!;
const status = document.querySelector<HTMLElement>("#contact-status")!;
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
  if (detail.xhr.getResponseHeader("X-Contact-Sent") === "1") form.reset();
  if (detail.xhr.status >= 400 && detail.xhr.getResponseHeader("X-Contact-Response") !== "1") networkError();
});
document.addEventListener("htmx:afterSwap", (event) => {
  if ((event as HtmxEvent).detail.target === status) status.focus();
});
function networkError() {
  status.textContent = "Die Übertragung konnte nicht bestätigt werden. Deine Nachricht bleibt im Formular. Versuche es später erneut oder nutze den E-Mail-Link.";
  status.focus();
}
form.addEventListener("htmx:sendError", networkError);
form.addEventListener("htmx:timeout", networkError);

export type ContactFields = { name: string; email: string; message: string; website: string };
export const emptyFields: ContactFields = { name: "", email: "", message: "", website: "" };
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function formMarkup(fields: ContactFields = emptyFields) {
  return `<form id="contact-form" method="post" action="/api/contact" hx-post="/api/contact" hx-target="#contact-status" hx-swap="innerHTML" hx-disabled-elt="find button" hx-indicator="#sending" hx-request='{"timeout":20000}'>
<div class="contact-field"><label for="contact-name">Dein Name</label><input id="contact-name" name="name" autocomplete="name" required maxlength="100" value="${escapeHtml(fields.name)}" placeholder="Wie heisst du?"></div>
<div class="contact-field"><label for="contact-email">Deine E-Mail</label><input id="contact-email" name="email" type="email" autocomplete="email" required maxlength="254" value="${escapeHtml(fields.email)}" placeholder="du@beispiel.ch"></div>
<div class="contact-field contact-message"><label for="contact-message">Deine Nachricht</label><textarea id="contact-message" name="message" rows="4" placeholder="Was möchtest du mir erzählen?" minlength="10" maxlength="5000" required>${escapeHtml(fields.message)}</textarea></div>
<div class="contact-honeypot" aria-hidden="true"><label for="contact-website">Dieses Feld bitte leer lassen</label><input id="contact-website" name="website" tabindex="-1" autocomplete="off"></div>
<p class="contact-privacy" id="contact-privacy">Deine Angaben werden per E-Mail an mich geschickt. Für den Versand nutze ich Resend. Ich verwende deine Nachricht zur Beantwortung deiner Anfrage.</p>
<div class="contact-submit"><button type="submit" aria-describedby="contact-privacy">Nachricht senden <span aria-hidden="true">↗</span></button><span id="sending" class="htmx-indicator" role="status">Wird gesendet …</span></div>
</form>`;
}

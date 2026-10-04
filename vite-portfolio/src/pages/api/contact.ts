import type { APIRoute } from "astro";
import { createServices, handleContact } from "../../server/contact";
export const prerender = false;
export const POST: APIRoute = ({ request, clientAddress }) => {
  // Vercel supplies clientAddress through the adapter. Do not trust a visitor's
  // arbitrary X-Forwarded-For value in application code.
  return handleContact(request, createServices(process.env), clientAddress);
};

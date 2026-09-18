import "./index.css";
import App from "./App.tsx";
import { ViteReactSSG } from "vite-react-ssg/single-page";

// Retire the previous cache-first worker so returning visitors receive the redesign.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        if (
          registration.active?.scriptURL === `${window.location.origin}/sw.js`
        ) {
          registration.update().catch(() => {});
        }
      }
    })
    .catch(() => {});
}
export const createRoot = ViteReactSSG(<App />);

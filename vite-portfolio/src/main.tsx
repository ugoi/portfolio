import "./index.css";
import App from "./App.tsx";
import { ViteReactSSG } from "vite-react-ssg/single-page";

// Register Service Worker for offline functionality
if (typeof window !== 'undefined') {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "Service Worker registered successfully:",
            registration.scope
          );
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error);
        });
    });
  }
}

export const createRoot = ViteReactSSG(<App />);

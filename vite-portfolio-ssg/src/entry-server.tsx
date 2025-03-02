import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./App";

export function render(url: string, manifest?: Record<string, string[]>) {
  const appHtml = renderToString(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // Generate preload directives for any assets needed by this route
  const preloadLinks = manifest ? generatePreloadLinks(manifest) : "";

  return [appHtml, preloadLinks];
}

function generatePreloadLinks(manifest: Record<string, string[]>) {
  // This is a basic implementation - you might want to customize based on your needs
  let links = "";
  const seen = new Set();

  Object.entries(manifest).forEach(([id, files]) => {
    files.forEach((file) => {
      if (!seen.has(file)) {
        seen.add(file);
        if (file.endsWith(".js")) {
          links += `<link rel="modulepreload" crossorigin href="${file}">\n`;
        } else if (file.endsWith(".css")) {
          links += `<link rel="stylesheet" href="${file}">\n`;
        } else if (file.endsWith(".woff2")) {
          links += `<link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>\n`;
        }
      }
    });
  });

  return links;
}

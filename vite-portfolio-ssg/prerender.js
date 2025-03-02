import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p) => path.resolve(__dirname, p);

async function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function prerender() {
  // Create static directory
  const staticDir = toAbsolute("dist/static");
  fs.mkdirSync(staticDir, { recursive: true });

  // Copy all assets from client build
  await copyDir(
    toAbsolute("dist/client/assets"),
    toAbsolute("dist/static/assets")
  );

  // Copy public files
  if (fs.existsSync(toAbsolute("public"))) {
    const files = fs.readdirSync(toAbsolute("public"));
    for (const file of files) {
      fs.copyFileSync(
        toAbsolute(`public/${file}`),
        toAbsolute(`dist/static/${file}`)
      );
    }
  }

  // Read the template
  const template = fs.readFileSync(
    toAbsolute("dist/client/index.html"),
    "utf-8"
  );

  // Get the SSR manifest
  const manifest = JSON.parse(
    fs.readFileSync(toAbsolute("dist/client/.vite/ssr-manifest.json"), "utf-8")
  );

  // Import the server entry
  const { render } = await import("./dist/server/entry-server.js");

  // Define routes to pre-render
  const routes = ["/", "/about", "/projects", "/contact"];

  // Pre-render each route
  for (const url of routes) {
    try {
      const { html: appHtml } = await render(url, manifest);

      const html = template.replace("<!--app-html-->", appHtml);

      const filePath = `dist/static${url === "/" ? "/index" : url}.html`;
      const fileDir = path.dirname(toAbsolute(filePath));

      // Ensure the directory exists
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      fs.writeFileSync(toAbsolute(filePath), html);
      console.log("Pre-rendered:", filePath);
    } catch (e) {
      console.error(`Error pre-rendering ${url}:`, e);
    }
  }

  // Clean up the SSR manifest after pre-rendering
  try {
    fs.rmSync(toAbsolute("dist/client/.vite"), { recursive: true });
  } catch (e) {
    console.error("Error cleaning up SSR manifest:", e);
  }
}

prerender();

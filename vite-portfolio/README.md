# Stefan Dukic — In meinem Element

Personal website combining water, hands-on work and technology. Built with React,
TypeScript, Vite, static prerendering and a custom Three.js ocean / mechanical ring.
The original portfolio is preserved in Git history.

## Development

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run preview -- --host 127.0.0.1 --port 5186
```

Production output: `dist/`. The existing Vercel project uses this directory
(`vite-portfolio`) as its root. No runtime secrets or backend are required.

## Behavior

- Procedural 3D scene loads independently of the static page content.
- Ozean / Bauplan switches the real scene between shaded and wireframe modes.
- Animation respects reduced-motion settings, can be paused, and stops when the
  hero leaves the viewport or the tab is hidden. Rendering is capped at about 30 fps.
- A CSS illustration remains when WebGL is unavailable or its context is lost.
- Images, fonts and geometry are served locally; there is no Bunny dependency,
  external font request, analytics script or AI chatbot in the new page.
- `sw.js` retires only the previous `stefan-portfolio-*` caches and unregisters
  itself so returning visitors are not stuck on the old cache-first website.
- The public contact email is retained from the previously published site.

## Assets

Existing photos are retained from this repository. Space Grotesk is self-hosted
under the SIL Open Font License; see `public/fonts/OFL.txt`. The mechanical object,
water shader and CSS illustrations are original procedural work.

## Visual research

- https://bruno-simon.com/ — an interactive Three.js world, with source and rendering notes.
- https://www.bluemarinefoundation.com/the-sea-we-breathe/ — ocean-led storytelling.
- https://immersive-g.com/ — cinematic art direction and transitions.
- https://threejs.org/examples/webgl_shaders_ocean.html — official water-rendering example.

Native web search and Brave Search were used. A bounded Brave Research pass was
also attempted; it returned search leads but no final answer within its limits.
No reference artwork, model or proprietary source code was copied.

## Verification (2026-09-18)

Production build and ESLint pass. Desktop and 390 px mobile screenshots inspected.
The personal browser has WebGL disabled, so its CSS fallback was checked there;
the real WebGL scene was tested in an isolated Chromium process with SwiftShader,
without changing the personal profile. This does not establish iPhone/Safari
performance. Images, anchor targets, absence of external asset requests and
horizontal overflow are checked in the browser.

`npm audit fix` removed the original high-severity dependency findings. Three
moderate findings remain in the existing `vite-react-ssg` / React Router dependency
chain, for which npm reports no fix. This is a statically generated single page,
without router Link components, remote loader data or a live SSR backend.

## Hosting and rollback

Vercel project: `ugois-projects/portfolio`. Cloudflare fronts the domain.
The redesign does not require DNS changes. The prior main commit is
`204138db52b6acc615c14fdef05867e6608f7b81`.
Deploy the reviewed branch as a Vercel preview; production can then use the same
build. Roll back by promoting the previous successful Vercel deployment, or by
reverting the redesign commit and allowing the existing Git integration to build.
Do not delete Bunny storage or old DNS records merely because the new page no
longer uses them; other consumers have not been inventoried.

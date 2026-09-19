import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OceanController } from "./ocean";
import { cameraAtDive, depthAtScroll, MAX_DIVE_DEPTH } from "./dive";

const Arrow = ({ down = false }: { down?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" style={down ? { transform: "rotate(90deg)" } : undefined}>
    <path d="M4 12h15M13 5l7 7-7 7" />
  </svg>
);
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function App() {
  const journeyRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const controller = useRef<OceanController | null>(null);
  const [depth, setDepth] = useState(0);
  const [atSurface, setAtSurface] = useState(true);
  const [currentChapter, setCurrentChapter] = useState("01 / OBERFLÄCHE");
  const [blueprint, setBlueprint] = useState(false);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, () => true);
  const motionPaused = paused ?? reducedMotion;

  useEffect(() => {
    let disposed = false;
    const element = sceneRef.current;
    const interaction = interactionRef.current;
    if (!element || !interaction) return;
    import("./ocean").then(({ createOcean }) => {
      if (disposed) return;
      try {
        controller.current = createOcean(element, interaction, () => setSceneReady(false));
        setSceneReady(true);
      } catch {
        // The CSS water world and all native document content remain available.
      }
    }).catch(() => {});
    return () => {
      disposed = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => { controller.current?.setBlueprint(blueprint); }, [blueprint, sceneReady]);
  useEffect(() => { controller.current?.setPaused(paused); }, [paused, sceneReady]);

  useEffect(() => {
    const journey = journeyRef.current;
    const viewport = viewportRef.current;
    if (!journey || !viewport) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = journey.getBoundingClientRect().top + window.scrollY;
      const next = depthAtScroll(window.scrollY, top, journey.offsetHeight, viewport.offsetHeight);
      const immersion = cameraAtDive(next, viewport.clientWidth < 600).depth;
      controller.current?.setDive(next);
      journey.style.setProperty("--surface-visibility", String(Math.max(0, 1 - next / .65)));
      journey.style.setProperty("--dive-progress", String(immersion / MAX_DIVE_DEPTH));
      journey.style.setProperty("--town-visibility", String(Math.max(0, Math.min(1, (immersion - 920) / 70))));
      setDepth(Math.round(immersion * 10) / 10);
      setAtSurface(next < .65);
      const chapters = [
        ["contact", "06 / FEIERABEND"], ["bikini-bottom", "05 / BIKINI BOTTOM"], ["tech", "04 / DIE NEUGIER"],
        ["elements", "03 / DER ANTRIEB"], ["about", "02 / DER MENSCH"],
      ];
      const active = chapters.find(([id]) => {
        const section = document.getElementById(id);
        return section && section.getBoundingClientRect().top <= viewport.clientHeight * .55;
      });
      setCurrentChapter(active?.[1] ?? (immersion > 0 ? "01 / ABTAUCHEN" : "01 / OBERFLÄCHE"));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(journey);
    observer.observe(viewport);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [sceneReady]);


  return (
    <div className={`site ${blueprint ? "is-blueprint" : ""} ${depth > 0 ? "is-underwater" : ""} ${depth > 900 ? "is-in-town" : ""}`}>
      <a className="skip-link" href="#about">Direkt zum Inhalt</a>
      <div className="site-chrome">
        <header className="site-header">
          <a className="wordmark" href="#top" aria-label="Stefan Dukic – zurück zur Oberfläche">
            <span className="brand-symbol" aria-hidden="true">s<span>d</span>.</span>
            <span>STEFAN DUKIC<small>IN MEINEM ELEMENT</small></span>
          </a>
          <nav aria-label="Hauptnavigation">
            <a href="#about">Der Mensch</a>
            <a href="#elements">Der Antrieb</a>
            <a className="nav-contact" href="#contact">Sag Hallo <span>↗</span></a>
          </nav>
        </header>
        <aside aria-label="Tauchgang und Darstellung">
        <div className="depth-instrument">
          <div className="depth-display" role="meter" aria-label="Virtuelle Tauchtiefe in Metern" aria-valuemin={0} aria-valuemax={MAX_DIVE_DEPTH} aria-valuenow={depth}>
            <span className="micro-label">{depth >= 985 ? "BIKINI BOTTOM" : depth >= 200 ? "TIEF IM BLAU" : depth > 0 ? "UNTER WASSER" : "OBERFLÄCHE"}</span>
            <span className="depth-reading"><strong>{Math.round(depth).toLocaleString("de-CH")}</strong><span>m</span></span>
          </div>
          <div className="depth-ruler" aria-hidden="true">
            {[0, 250, 500, 750, 1000].map(mark => <span key={mark}>{mark === 1000 ? "1k" : mark}</span>)}
            <i className="depth-marker" style={{ top: `${depth / MAX_DIVE_DEPTH * 100}%` }} />
          </div>
          <span className="depth-end" aria-hidden="true">1.000 M</span>
        </div>
        <div className="journey-controls">
          <span className="journey-position" aria-hidden="true"><i />{currentChapter}</span>
          <div className="scene-controls" role="group" aria-label="Darstellung der Wasserwelt">
            <button type="button" className={!blueprint ? "selected" : ""} aria-pressed={!blueprint} onClick={() => setBlueprint(false)}>Wasser</button>
            <button type="button" className={blueprint ? "selected" : ""} aria-pressed={blueprint} onClick={() => setBlueprint(true)}>Bauplan</button>
            {sceneReady && <button className="motion-button" type="button" onClick={() => setPaused(!motionPaused)} aria-label={motionPaused ? "Animation starten" : "Animation pausieren"}>{motionPaused ? "▶" : "Ⅱ"}</button>}
          </div>
        </div>
        </aside>
      </div>

      <main className="dive-journey" id="top" ref={journeyRef}>
        <div className={`dive-viewport ${sceneReady ? "" : "is-fallback"}`} ref={viewportRef}>
          <div className="hero-scene" ref={sceneRef} aria-hidden="true" />
          <div className="buoy-interaction" ref={interactionRef} />
          {!sceneReady && <div className="fallback-world" aria-hidden="true"><div className="fallback-sky" /><div className="fallback-sea" /><div className="fallback-ring" /><div className="fallback-depth" /><div className="fallback-town"><span>🪨</span><span>🗿</span><span>🍍</span></div></div>}
          <div className="scene-atmosphere" aria-hidden="true" />
          <div className="destination-badge" aria-hidden="true"><span>1.000 M UNTER DEM ALLTAG</span>Bikini Bottom.</div>
        </div>
        <div className="journey-content">
          <section className="surface-section" aria-labelledby="hero-title">
            <div className="surface-content" inert={!atSurface}>
              <p className="eyebrow"><span className="fine-line" />WASSER. WEITBLICK. EIN BISSCHEN WAHNSINN.</p>
              <h1 id="hero-title">In meinem<br /><em>Element.</em></h1>
              <div className="hero-detail">
                <p>Bademeister von Beruf.<br />Macher aus Überzeugung.</p>
                <a className="dive-link" href="#dive-start"><span>Tauch ein</span><span className="arrow-circle"><Arrow down /></span></a>
              </div>
            </div>
            <p className="surface-location"><span>47° N / 8° E</span>ZÜRICH, SCHWEIZ</p>
            <p className="ring-hint">Einfach den Ring greifen.<span>Den Rest machen die Wellen.</span></p>
          </section>
          <div id="dive-start" className="dive-anchor" aria-hidden="true" />
          <div className="open-water">
            <p><span className="eyebrow">UNTER DER OBERFLÄCHE</span>Immer tiefer.<br /><em>Immer neugieriger.</em></p>
            <span className="descent-line" aria-hidden="true" />
          </div>

          <section className="chapter about-chapter" id="about" aria-labelledby="about-title">
            <article className="chapter-card about-card">
              <div className="chapter-topline"><span>01 / DER MENSCH</span><span className="small-star" aria-hidden="true">✳</span></div>
              <div className="profile-heading">
                <h2 id="about-title">Wasser im Blut.<br /><em>Technik im Kopf.</em></h2>
                <div className="portrait"><img src="/images/stefan-greece.webp" alt="Stefan Dukic" width="1108" height="1108" loading="lazy" /></div>
              </div>
              <p>Hey, ich bin Stefan. Heute bin ich Bademeister. Am Wasser fühle ich mich zuhause. Hier zählen ein wacher Blick, ein ruhiger Kopf und die Bereitschaft, anzupacken.</p>
              <p>Meine Neugier hört am Beckenrand nicht auf. Ich mag Technik, tüftle an eigenen Ideen und will verstehen, wie Dinge funktionieren.</p>
              <div className="card-signoff"><span>Stefan Dukic</span><span>ZÜRICH ↗</span></div>
            </article>
          </section>
          <div className="water-space" aria-hidden="true" />
          <section className="chapter craft-chapter" id="elements" aria-labelledby="craft-title">
            <article className="chapter-card">
              <div className="chapter-topline"><span>02 / DER ANTRIEB</span><span className="small-star" aria-hidden="true">✳</span></div>
              <h2 id="craft-title">Ärmel hoch.<br /><em>Etwas bewegen.</em></h2>
              <p>Ich mag Dinge, die man anfassen kann. Ausprobieren, reparieren, verbessern. Und am Ende sehen, was man geschafft hat.</p>
              <div className="craft-values"><span>AUSPROBIEREN<i>01</i></span><span>ANPACKEN<i>02</i></span><span>WEITERKOMMEN<i>03</i></span></div>
              <p className="card-footnote">Zwischen Wasser und Werkbank.</p>
            </article>
          </section>
          <div className="water-space" aria-hidden="true" />
          <section className="chapter tech-chapter" id="tech" aria-labelledby="tech-title">
            <article className="chapter-card">
              <div className="chapter-topline"><span>03 / DIE NEUGIER</span><span className="small-star" aria-hidden="true">✳</span></div>
              <h2 id="tech-title">Tiefer schauen.<br /><em>Weiterdenken.</em></h2>
              <p>Früher war Software mein Beruf. Heute bleibt die Freude am Tüfteln: Systeme verstehen, Ideen verbinden und Neues bauen.</p>
              <p>Vom ersten Gedanken bis zu dem Moment, in dem alles zusammenpasst.</p>
              <div className="thought-line"><span aria-hidden="true">↳</span>Stillstand? Nicht mein Element.</div>
            </article>
          </section>
          <section className="arrival-chapter" id="bikini-bottom" aria-labelledby="arrival-title">
            <div><p className="eyebrow">IRGENDWO ZWISCHEN TIEFSEE UND KINDHEIT.</p><h2 id="arrival-title">Da unten wohnt<br /><em>noch jemand.</em></h2><span className="descent-line" aria-hidden="true" /></div>
          </section>
          <section className="contact-chapter" aria-labelledby="contact-title">
            <div className="contact-inner" id="contact">
              <p className="eyebrow"><span className="fine-line" />FEIERABEND. AUCH UNTER WASSER.</p>
              <a className="contact-link" href="mailto:codecraftingpro@gmail.com">
                <h2 id="contact-title">Noch auf <em>Empfang?</em></h2><span className="contact-arrow"><Arrow /></span>
              </a>
              <div className="contact-details">
                <a href="mailto:codecraftingpro@gmail.com">codecraftingpro@gmail.com <span>↗</span></a>
                <a href="https://www.linkedin.com/in/stefan-dukic-68682b20b/" target="_blank" rel="noreferrer">LinkedIn <span>↗</span></a>
              </div>
              <footer className="site-footer"><span>STEFAN DUKIC — IN MEINEM ELEMENT</span><a href="#top">ZURÜCK ZUR SONNE ↑</a></footer>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
export default App;

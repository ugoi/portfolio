import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OceanController } from "./ocean";

const Arrow = ({ down = false }: { down?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
    style={down ? { transform: "rotate(90deg)" } : undefined}
  >
    <path d="M4 12h15M13 5l7 7-7 7" />
  </svg>
);

const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function App() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const controller = useRef<OceanController | null>(null);
  const [blueprint, setBlueprint] = useState(false);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    () => true,
  );
  const motionPaused = paused ?? reducedMotion;

  useEffect(() => {
    let disposed = false;
    const element = sceneRef.current;
    if (!element) return;
    import("./ocean")
      .then(({ createOcean }) => {
        if (disposed) return;
        try {
          controller.current = createOcean(element, () => setSceneReady(false));
          setSceneReady(true);
        } catch {
          // The illustration and all content remain available without WebGL.
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.setBlueprint(blueprint);
  }, [blueprint, sceneReady]);
  useEffect(() => {
    controller.current?.setPaused(paused);
  }, [paused, sceneReady]);

  return (
    <div className={`site ${blueprint ? "is-blueprint" : ""}`}>
      <a className="skip-link" href="#about">
        Zum Inhalt
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="#top"
          aria-label="Stefan Dukic – Startseite"
        >
          <span className="brand-icon" aria-hidden="true">
            S<span>D</span>
          </span>
          <span>
            STEFAN
            <br />
            DUKIC<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Hauptnavigation">
          <a href="#about">Der Mensch</a>
          <a href="#elements">Die Elemente</a>
          <a className="nav-contact" href="#contact">
            Kontakt <span>↗</span>
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-scene" ref={sceneRef} aria-hidden="true" />
          {!sceneReady && (
            <div className="fallback-art" aria-hidden="true">
              <div />
            </div>
          )}
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-cross cross-one" aria-hidden="true">
            +
          </div>
          <div className="hero-cross cross-two" aria-hidden="true">
            +
          </div>
          <div className="hero-content">
            <p className="eyebrow">
              <span className="status-dot" /> WASSER. WERKSTATT. WEITBLICK.
            </p>
            <h1 id="hero-title">
              IN MEINEM
              <br />
              <span>ELEMENT.</span>
            </h1>
            <p className="hero-intro">
              Bademeister von Beruf.
              <br />
              Macher aus Überzeugung.
            </p>
            <a className="primary-link" href="#about">
              Tauch ein <Arrow down />
            </a>
          </div>
          <div className="scene-label" aria-hidden="true">
            <span className="label-line" />
            <span>
              01 / WASSER TRIFFT TECHNIK
              <br />
              <b>DER EIGENE KURS.</b>
            </span>
          </div>
          <div className="hero-bottom">
            <span className="location">
              <span>◎</span> ZÜRICH, SCHWEIZ
            </span>
            <div
              className="scene-controls"
              role="group"
              aria-label="Darstellung der Wasserwelt"
            >
              <button
                type="button"
                className={!blueprint ? "selected" : ""}
                aria-pressed={!blueprint}
                onClick={() => setBlueprint(false)}
              >
                Ozean
              </button>
              <button
                type="button"
                className={blueprint ? "selected" : ""}
                aria-pressed={blueprint}
                onClick={() => setBlueprint(true)}
              >
                Bauplan
              </button>
              {sceneReady && (
                <button
                  className="motion-button"
                  type="button"
                  onClick={() => setPaused(!motionPaused)}
                  aria-label={
                    motionPaused ? "Animation starten" : "Animation pausieren"
                  }
                >
                  {motionPaused ? "▶" : "Ⅱ"}
                </button>
              )}
            </div>
            <a className="scroll-cue" href="#about">
              MEHR ENTDECKEN <Arrow down />
            </a>
          </div>
        </section>

        <div className="element-strip" aria-hidden="true">
          <span>WASSER</span>
          <i>✳</i>
          <span>HANDWERK</span>
          <i>✳</i>
          <span>TECHNIK</span>
          <i>✳</i>
          <span>NEUGIER</span>
          <i>✳</i>
        </div>

        <section
          className="about section-shell"
          id="about"
          aria-labelledby="about-title"
        >
          <div className="section-index">
            <span>01 — DER MENSCH</span>
            <span>MEHR ALS EINE ROLLE</span>
          </div>
          <div className="about-grid">
            <div className="portrait-block">
              <div className="portrait-frame">
                <img
                  src="/images/stefan-greece.webp"
                  alt="Stefan in einem Restaurant in Griechenland"
                  width="1108"
                  height="1108"
                  loading="lazy"
                />
                <span className="image-corner top-left" />
                <span className="image-corner bottom-right" />
                <span className="photo-label">EINFACH STEFAN.</span>
              </div>
              <div className="portrait-caption">
                <span>STEFAN DUKIC</span>
                <span>IN SEINEM ELEMENT ↗</span>
              </div>
            </div>
            <div className="about-copy">
              <p className="eyebrow">HEY, ICH BIN STEFAN.</p>
              <h2 id="about-title">
                Wasser im Blut.
                <br />
                <span>Technik im Kopf.</span>
              </h2>
              <p>
                Heute bin ich Bademeister. Am Wasser fühle ich mich zuhause.
                Hier zählen ein wacher Blick, ein ruhiger Kopf und die
                Bereitschaft, anzupacken.
              </p>
              <p>
                Meine Neugier hört am Beckenrand nicht auf. Ich mag Technik,
                tüftle an eigenen Ideen und will verstehen, wie Dinge
                funktionieren. Vom ersten Gedanken bis zu dem Moment, in dem
                alles zusammenpasst.
              </p>
              <div className="signature">
                Stefan<span>↗</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="elements section-shell"
          id="elements"
          aria-labelledby="elements-title"
        >
          <div className="section-index">
            <span>02 — DIE ELEMENTE</span>
            <span>DREI SEITEN. EIN MENSCH.</span>
          </div>
          <div className="section-heading">
            <h2 id="elements-title">
              DAS TREIBT
              <br />
              <span>MICH AN.</span>
            </h2>
            <p>
              Zwischen Wasser und Werkbank.
              <br />
              Mit beiden Füssen im Leben
              <br />
              und dem Kopf voller Ideen.
            </p>
          </div>
          <div className="element-grid">
            <article className="element-card water-card">
              <div className="card-top">
                <span>01 / WASSER</span>
                <span>↗</span>
              </div>
              <div className="water-graphic" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="card-copy">
                <h3>
                  Ruhe bewahren.
                  <br />
                  Präsent sein.
                </h3>
                <p>
                  Wasser ist mein Arbeitsplatz und mein Element. Verantwortung
                  übernehmen. Menschen im Blick haben. Da sein, wenn es zählt.
                </p>
                <span className="card-tag">BADEMEISTER</span>
              </div>
            </article>
            <article className="element-card craft-card">
              <div className="card-top">
                <span>02 / HANDWERK</span>
                <span>↗</span>
              </div>
              <div className="craft-graphic" aria-hidden="true">
                <div />
                <div />
                <div />
                <i />
              </div>
              <div className="card-copy">
                <h3>
                  Ärmel hoch.
                  <br />
                  Etwas bewegen.
                </h3>
                <p>
                  Ich mag Dinge, die man anfassen kann. Ausprobieren,
                  reparieren, verbessern. Und am Ende sehen, was man geschafft
                  hat.
                </p>
                <span className="card-tag">MACHERMENTALITÄT</span>
              </div>
            </article>
            <article className="element-card tech-card">
              <div className="card-top">
                <span>03 / TECHNIK</span>
                <span>↗</span>
              </div>
              <div className="tech-graphic" aria-hidden="true">
                <div />
                <div />
                <div />
                <span>SD</span>
              </div>
              <div className="card-copy">
                <h3>
                  Neugierig bleiben.
                  <br />
                  Weiterdenken.
                </h3>
                <p>
                  Früher war Software mein Beruf. Heute bleibt die Freude am
                  Tüfteln: Systeme verstehen, Ideen verbinden und Neues bauen.
                </p>
                <span className="card-tag">ENTDECKERGEIST</span>
              </div>
            </article>
          </div>
        </section>

        <section className="manifesto" aria-label="Mein Antrieb">
          <p className="eyebrow">IM WASSER. IM KOPF. IM LEBEN.</p>
          <p className="manifesto-text">
            STILLSTAND?
            <br />
            <span>NICHT MEIN ELEMENT.</span>
          </p>
          <div className="manifesto-ripple" aria-hidden="true" />
        </section>
        <section
          className="contact section-shell"
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className="section-index">
            <span>03 — KONTAKT</span>
            <span>VON MENSCH ZU MENSCH</span>
          </div>
          <p className="eyebrow">EINE IDEE? EINFACH HALLO SAGEN?</p>
          <a className="contact-link" href="mailto:codecraftingpro@gmail.com">
            <h2 id="contact-title">
              LASS UNS
              <br />
              <span>REDEN.</span>
            </h2>
            <Arrow />
          </a>
          <div className="contact-bottom">
            <a href="mailto:codecraftingpro@gmail.com">
              codecraftingpro@gmail.com ↗
            </a>
            <a
              href="https://www.linkedin.com/in/stefan-dukic-68682b20b/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn ↗
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a className="footer-name" href="#top">
          STEFAN DUKIC<span>↗</span>
        </a>
        <span>WASSER IM BLUT. TECHNIK IM KOPF.</span>
        <a href="#top">ZURÜCK NACH OBEN ↑</a>
      </footer>
    </div>
  );
}
export default App;

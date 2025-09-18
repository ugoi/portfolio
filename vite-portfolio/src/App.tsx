import { useState, lazy, Suspense, useEffect, useRef } from "react";
import { useIsMobile } from "./hooks/useIsMobile";
import ChatBot from "./components/ChatBot";

// Lazy load the Projects component
const Projects = lazy(() => import("./components/Projects"));
const Experience = lazy(() => import("./components/Experience"));

function App() {
  // Animation states
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isEmojiFlagHovered, setIsEmojiFlagHovered] = useState(false);
  const [introOpacity, setIntroOpacity] = useState(1);
  const [navBorderThickness, setNavBorderThickness] = useState(0);

  // Use the custom hook for mobile detection
  const isMobile = useIsMobile();

  // Refs for parallax sections
  const projectsRef = useRef<HTMLDivElement>(null);
  const experienceRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const contactTextRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const threshold = 1; // 1px threshold
      const shouldBeVisible = currentScrollY < threshold;

      // Immediately set the target opacity without animation
      setIntroOpacity(shouldBeVisible ? 1 : 0);

      // Apply parallax effect to Intro section - slower movement
      if (introRef.current) {
        // Use very slow speed for intro section
        const speed = isMobile ? 1.05 : 1.5;
        introRef.current.style.transform = `translateY(${
          currentScrollY * (speed - 1)
        }px)`;
      }

      // Get in touch section scroll animation
      if (contactRef.current && contactTextRef.current) {
        const rect = contactRef.current.getBoundingClientRect();
        const sectionTop = rect.top;
        const windowHeight = window.innerHeight;

        // Calculate how far the section is into the viewport
        // We want the animation to complete when the section is halfway through the viewport
        const sectionHeight = rect.height;
        const topOffset = 300;
        const startPoint = windowHeight + topOffset; // When section first appears at bottom of viewport
        const endPoint = windowHeight / 2 - sectionHeight / 2; // When section is centered

        // Calculate progress (0 to 1)
        let progress = 0;
        if (sectionTop < startPoint) {
          progress = Math.min(
            (startPoint - sectionTop) / (startPoint - endPoint),
            1
          );
        }

        // Use a percentage of the section height as the starting offset
        // Using 60% of the section height as the initial offset
        const startingOffset = sectionHeight * 0.5;
        const translateY = -startingOffset * (1 - progress);
        contactTextRef.current.style.transform = `translateY(${translateY}px)`;
        // Force browser to process the style change immediately
        void contactTextRef.current.offsetHeight;
      }

      // Check if we've scrolled past 1/4 of the page height to trigger navbar border
      const triggerHeight = window.innerHeight / 4;
      setNavBorderThickness(currentScrollY > triggerHeight ? 2 : 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      {/* Navbar */}
      <div className="sticky top-0 z-50 flex justify-center px-3 pt-3 md:px-0 md:pt-8">
        <nav
          className="w-full max-w-[960px] flex items-center justify-between bg-[var(--color-navbar)] backdrop-blur-sm rounded-[var(--radius-navbar)] px-[var(--spacing-navbar)] h-[var(--height-navbar)]"
          style={{
            border: `${navBorderThickness}px solid var(--color-border)`,
            transition: "border-width 500ms ease-in-out",
          }}
        >
          <div className="font-['Inter',sans-serif] text-[12px] md:text-[14px] tracking-[2px] leading-[160%] text-[var(--color-text-muted)] uppercase hover:text-[var(--color-hover)] transition-colors">
            stefan dukic
          </div>

          <div className="flex items-center gap-[var(--spacing-icon-gap)] text-[var(--color-text-muted)]">
            <a
              href="https://cdn.stefandukic.com/resume-one-pager.pdf"
              className="hover:text-[var(--color-hover)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download Resume"
            >
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/stefan-dukic-68682b20b/"
              className="hover:text-[var(--color-hover)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit LinkedIn Profile"
            >
              <svg
                className="w-7 h-7"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
            </a>
            <a
              href="https://github.com/ugoi"
              className="hover:text-[var(--color-hover)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit GitHub Profile"
            >
              <svg
                className="w-7 h-7"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
              </svg>
            </a>
            <a
              href="mailto:codecraftingpro@gmail.com"
              className="hover:text-[var(--color-hover)] transition-colors"
              aria-label="Send Email"
            >
              <svg
                className="w-7 h-7"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </a>
          </div>
        </nav>
      </div>

      {/* Content container */}
      <div className="max-w-[1200px] mx-auto">
        {/* Parallax wrapper */}
        <div ref={introRef} className="relative will-change-transform">
          {/* Intro Section with constrained width */}
          <div className="max-w-[960px] mx-auto px-8 md:px-6">
            <section
              className="pt-8 md:pt-60 pb-18 transition-[opacity_200ms_ease-in-out]"
              style={{
                opacity: introOpacity,
                transitionDuration: introOpacity === 0 ? "1000ms" : "200ms",
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 md:gap-0">
                <div className="block md:hidden">
                  <div className="relative w-[175px] h-[175px] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] rounded-xl">
                    <picture>
                      <source
                        srcSet="https://cdn.stefandukic.com/images/stefan-portrait-175.webp"
                        type="image/webp"
                        width="175"
                        height="175"
                      />
                      <img
                        src="https://cdn.stefandukic.com/images/stefan-portrait-175.jpeg"
                        alt="Stefan Dukic - Full-stack developer and AI enthusiast professional headshot"
                        className="w-full h-full object-cover rounded-xl bg-[#1a1a1a]"
                        width="175"
                        height="175"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                      />
                    </picture>
                    <div className="absolute inset-0 rounded-xl shadow-inner pointer-events-none"></div>
                  </div>
                </div>

                <div className="max-w-[500px] animate-slide-from-left">
                  <h1 className="text-5xl font-bold mb-4">
                    Stefan Dukic - Full-Stack Developer & AI Enthusiast
                    <span className="ml-2 inline-flex items-center">
                      <div className="relative inline-block group">
                        {/* Rotating container for the peace emoji and the serbian flag */}
                        <div
                          className={`
                          ${
                            hasInteracted && isEmojiFlagHovered
                              ? "animate-rotate-wiggle-45"
                              : ""
                          } 
                          ${
                            hasInteracted && isEmojiFlagHovered === false
                              ? "animate-rotate-unwiggle-45"
                              : ""
                          }
                          [animation-duration:500ms] cursor-pointer
                        `}
                          onMouseEnter={() => {
                            setIsEmojiFlagHovered(true);
                            setHasInteracted(true);
                          }}
                          onMouseLeave={() => setIsEmojiFlagHovered(false)}
                          onTouchStart={() => {
                            if (isEmojiFlagHovered === false) {
                              setIsEmojiFlagHovered(true);
                            } else {
                              setIsEmojiFlagHovered(false);
                            }
                            setHasInteracted(true);
                          }}
                        >
                          {/* Peace Emoji: rotates and fades out when the container is hovered/tapped */}
                          <span
                            className={`
                          block text-[42px] transition-all duration-200 transform 
                          ${isEmojiFlagHovered ? "opacity-0" : "opacity-100"}
                        `}
                          >
                            ✌️
                          </span>
                          {/* Serbian Flag: fades in when the container is hovered/tapped */}
                          <span
                            className={`
                          absolute inset-0 flex items-center justify-center text-[42px] 
                          pointer-events-none transition-opacity rotate-315 duration-200
                          ${isEmojiFlagHovered ? "opacity-100" : "opacity-0"}
                        `}
                          >
                            🇷🇸
                          </span>
                        </div>
                      </div>
                    </span>
                  </h1>

                  <p className="text-xl text-[var(--color-text-secondary)] leading-relaxed">
                    driven by a desire to build a legacy, i continuously refine
                    both my full-stack and ai skills through a dedicated
                    practice–feedback–learn loop{" "}
                    <svg
                      className="w-5 h-5 inline-block animate-spin-slow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2"
                        strokeLinecap="round"
                        strokeOpacity="0.2"
                      />
                    </svg>
                    . today, i develop robust apps that pave the way for
                    innovative ventures.
                  </p>
                </div>

                <div className="hidden md:block transition-all duration-1000 animate-slide-from-right">
                  <div className="relative w-[220px] h-[220px] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] rounded-xl">
                    <picture>
                      <source
                        srcSet="https://cdn.stefandukic.com/images/stefan-portrait-220.webp"
                        type="image/webp"
                        width="220"
                        height="220"
                      />
                      <img
                        src="https://cdn.stefandukic.com/images/stefan-portrait-220.jpeg"
                        alt="Stefan Dukic - Full-stack developer and AI enthusiast professional portrait"
                        className="w-full h-full object-cover rounded-xl bg-[#1a1a1a]"
                        width="220"
                        height="220"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                      />
                    </picture>
                    <div className="absolute inset-0 rounded-xl shadow-inner pointer-events-none"></div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Projects Section - only wrap the non-modal content in parallax */}

        {/* Parallax wrapper */}
        <div
          ref={projectsRef}
          className="relative will-change-transform px-0 md:px-12"
        >
          <Suspense
            fallback={
              <section className="md:py-12 relative">
                <div className="max-w-[1104px] mx-auto">
                  <h2 className="sr-only">Featured Projects</h2>
                  <div className="flex overflow-x-auto hidescrollbar md:py-22 md:bg-[rgb(18,18,18)] md:rounded-[60px] md:border md:border-white/[0.08] md:shadow-[0_0_40px_rgb(10,10,10),0_0_80px_rgb(5,5,5),0_0_120px_rgb(0,0,0)] relative">
                    <div
                      className="shrink-0 w-[30px] md:w-[88px]"
                      aria-hidden="true"
                    ></div>
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`min-w-[220px] md:min-w-[266px] h-[450px] md:h-[575px] relative rounded-[20px] overflow-hidden
                                   bg-white/[0.03] animate-pulse my-2 ${
                                     index !== 1 ? "ml-4 md:ml-12" : ""
                                   }`}
                      >
                        <div className="absolute bottom-6 left-5 w-3/4">
                          <div className="h-6 bg-white/[0.07] rounded mb-2"></div>
                          <div className="h-4 bg-white/[0.07] rounded w-2/3"></div>
                        </div>
                      </div>
                    ))}
                    <div className="shrink-0 w-[88px]" aria-hidden="true"></div>
                  </div>
                </div>
              </section>
            }
          >
            <Projects />
          </Suspense>
        </div>

        {/* Experience Section */}

        {/* Parallax wrapper */}
        <div ref={experienceRef} className="relative will-change-transform">
          <Suspense
            fallback={
              <section className="py-20 relative">
                <div className="max-w-[960px] mx-auto px-8 md:px-6">
                  <div className="flex justify-center mb-12">
                    <div className="bg-white/5 rounded-full p-1">
                      <div className="px-6 py-2 rounded-full bg-white/10 animate-pulse"></div>
                      <div className="px-6 py-2 rounded-full bg-white/10 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    {[1, 2, 3].map((index) => (
                      <div key={index} className="relative pl-24">
                        <div className="absolute left-0 w-16 h-16 rounded-full bg-white/5 animate-pulse"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-white/5 rounded animate-pulse"></div>
                          <div className="h-6 w-48 bg-white/5 rounded animate-pulse"></div>
                          <div className="h-5 w-36 bg-white/5 rounded animate-pulse"></div>
                          <div className="space-y-2">
                            <div className="h-4 w-full bg-white/5 rounded animate-pulse"></div>
                            <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            }
          >
            <Experience />
          </Suspense>
        </div>

        {/* Get in Touch Section */}
        <section
          ref={contactRef}
          className="min-h-screen flex items-center justify-center relative"
        >
          <h2 className="sr-only">Contact Information</h2>
          <div className="max-w-[960px] mx-auto px-8 md:px-6">
            <div
              ref={contactTextRef}
              className="flex items-center justify-center gap-4"
            >
              <div className="text-[42px]">👨‍💻</div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-white/90 to-white/60 bg-clip-text text-transparent">
                get in touch
              </h2>
            </div>
          </div>
        </section>
      </div>

      {/* Chat bot */}
      <ChatBot />
    </div>
  );
}

export default App;

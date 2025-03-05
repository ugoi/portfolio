import { useState, useRef, useEffect } from "react";
import fullscreen from "../utils/fullscreen";

interface Project {
  id: number;
  title: string;
  shortDescription: string;
  detailedDescription: string;
  technologies: string[];
  hlsUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  githubUrl: string;
  captionsUrl: string;
}

const projects: Project[] = [
  {
    id: 1,
    title: "Matcha",
    shortDescription: "Dating platform",
    detailedDescription:
      "A full-featured dating platform with real-time matching and communication. Features include user profiles with photos and interests, GPS-based location matching, real-time chat, and notifications. Built with modern web technologies and robust security measures.",
    technologies: [
      "Express",
      "React",
      "TypeScript",
      "PostgreSQL",
      "WebSocket",
      "OAuth2",
    ],
    hlsUrl:
      "https://vz-3314a557-61f.b-cdn.net/d96c4e96-e4f7-464c-883c-c9ecb38947b3/playlist.m3u8",
    previewUrl:
      "https://vz-3314a557-61f.b-cdn.net/d96c4e96-e4f7-464c-883c-c9ecb38947b3/preview.webp",
    thumbnailUrl:
      "https://vz-3314a557-61f.b-cdn.net/d96c4e96-e4f7-464c-883c-c9ecb38947b3/thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Matcha",
    captionsUrl: "https://cdn.stefandukic.com/captions/matcha.vtt",
  },
  {
    id: 2,
    title: "Camagru",
    shortDescription: "Photo editing platform",
    detailedDescription:
      "A web-based photo editing platform that combines webcam captures with superposable images. Features include user authentication, gallery management, real-time webcam preview, image uploads, and social features like likes and comments. Built with modern web technologies and robust security measures.",
    technologies: [
      "React",
      "TypeScript",
      "Java",
      "PostgreSQL",
      "WebRTC",
      "Image Processing",
    ],
    hlsUrl:
      "https://vz-3314a557-61f.b-cdn.net/fbcc624d-70a8-459d-88eb-4591f98a52a0/playlist.m3u8",
    previewUrl:
      "https://vz-3314a557-61f.b-cdn.net/fbcc624d-70a8-459d-88eb-4591f98a52a0/preview.webp",
    thumbnailUrl:
      "https://vz-3314a557-61f.b-cdn.net/fbcc624d-70a8-459d-88eb-4591f98a52a0/thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Camagru",
    captionsUrl: "",
  },
  {
    id: 3,
    title: "Swifty Companion",
    shortDescription: "42 Student Info App",
    detailedDescription:
      "A mobile application that retrieves and displays information about 42 students using the 42 API. Features include user profiles, skills display, project history, and responsive layouts.",
    technologies: ["Swift", "iOS", "OAuth2", "REST API"],
    hlsUrl:
      "https://vz-3314a557-61f.b-cdn.net/7f1f61c7-5c6b-48ab-b50f-ce5d2d4ca804/playlist.m3u8",
    previewUrl:
      "https://vz-3314a557-61f.b-cdn.net/7f1f61c7-5c6b-48ab-b50f-ce5d2d4ca804/preview.webp",
    thumbnailUrl:
      "https://vz-3314a557-61f.b-cdn.net/7f1f61c7-5c6b-48ab-b50f-ce5d2d4ca804/thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Swifty-Companion",
    captionsUrl: "",
  },
  {
    id: 4,
    title: "ft_hangouts",
    shortDescription: "Contact Management App",
    detailedDescription:
      "A mobile application for managing contacts and sending text messages. Features include persistent SQLite storage, bilingual support, conversation history, and customizable UI elements.",
    technologies: ["Android", "iOS", "SQLite", "Mobile SDK"],
    hlsUrl:
      "https://vz-3314a557-61f.b-cdn.net/10b2b5b0-bdff-4364-be2b-b1848492d26d/playlist.m3u8",
    previewUrl:
      "https://vz-3314a557-61f.b-cdn.net/10b2b5b0-bdff-4364-be2b-b1848492d26d/preview.webp",
    thumbnailUrl:
      "https://vz-3314a557-61f.b-cdn.net/10b2b5b0-bdff-4364-be2b-b1848492d26d/thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/ft_hangouts",
    captionsUrl: "",
  },
  {
    id: 5,
    title: "cub3D",
    shortDescription: "RayCaster Game",
    detailedDescription:
      "A 3D ray-casting game inspired by Wolfenstein 3D. Features include textured walls, smooth movement controls, and a custom map parser. Built using miniLibX graphics library.",
    technologies: ["C", "miniLibX", "RayCasting", "Graphics"],
    hlsUrl:
      "https://vz-3314a557-61f.b-cdn.net/4d80c645-4596-45ff-890c-7bbfc9642316/playlist.m3u8",
    previewUrl:
      "https://vz-3314a557-61f.b-cdn.net/4d80c645-4596-45ff-890c-7bbfc9642316/preview.webp",
    thumbnailUrl:
      "https://vz-3314a557-61f.b-cdn.net/4d80c645-4596-45ff-890c-7bbfc9642316/thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/cub3d",
    captionsUrl: "",
  },
  {
    id: 6,
    title: "ft_transcendence",
    shortDescription: "Multiplayer Arcade Game",
    detailedDescription:
      "A multiplayer online game project that combines classic arcade games like Pong and Breakout with modern features. Includes special abilities, power-ups, leveling system, real-time matches, ranking system, and matchmaking functionality.",
    technologies: [
      "NestJS",
      "React",
      "Docker",
      "PostgreSQL",
      "WebSocket",
      "TypeScript",
    ],
    hlsUrl: "",
    previewUrl: "https://cdn.stefandukic.com/images/ft-transcendence-web.png",
    thumbnailUrl: "https://cdn.stefandukic.com/images/ft-transcendence-web.png",
    githubUrl: "https://github.com/FVNRLS/ft_transcendence",
    captionsUrl: "",
  },
  {
    id: 7,
    title: "ft_irc",
    shortDescription: "IRC Server",
    detailedDescription:
      "A robust Internet Relay Chat server implementation in C++98. Features include multi-client support, channel management, private messaging, operator commands, and non-blocking I/O operations. Built with modern networking practices and strict protocol compliance.",
    technologies: ["C++98", "TCP/IP", "Socket Programming", "Non-blocking I/O"],
    hlsUrl: "",
    previewUrl: "https://cdn.stefandukic.com/images/ft-irc-web.png",
    thumbnailUrl: "https://cdn.stefandukic.com/images/ft-irc-web.png",
    githubUrl: "https://github.com/Qfinel/42School_ft_irc",
    captionsUrl: "",
  },
];

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement }>({});
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const [loadedVideos, setLoadedVideos] = useState<Set<number>>(new Set());
  const videoTimestampsRef = useRef<{ [key: number]: number }>({});
  const [isMobile, setIsMobile] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(true);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Consider it mobile if either width or height is less than 768px
      setIsMobile(width < 768 || height < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, []);

  useEffect(() => {
    // Initialize HLS for each video when they become visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          const video = entry.target as HTMLVideoElement;
          const projectId = Number(video.dataset.projectId);

          if (entry.isIntersecting) {
            try {
              // Dynamically import HLS.js only when needed
              const { default: Hls } = await import("hls.js");

              if (Hls.isSupported() && projects[projectId - 1].hlsUrl) {
                const hls = new Hls();
                hls.loadSource(projects[projectId - 1].hlsUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  // Resume from timestamp if exists, otherwise play from start
                  if (videoTimestampsRef.current[projectId]) {
                    video.currentTime = videoTimestampsRef.current[projectId];
                  }
                  video.play().catch(() => {});
                });

                // Listen for when video starts playing
                video.addEventListener("playing", () => {
                  setLoadedVideos((prev) => new Set([...prev, projectId]));
                });

                // Track time when video is paused
                video.addEventListener("pause", () => {
                  videoTimestampsRef.current[projectId] = video.currentTime;
                  // remove video from loadedVideos
                  setLoadedVideos((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(projectId);
                    return newSet;
                  });
                });
              }
            } catch (error) {
              console.error("Error loading HLS:", error);
            }
          } else {
            // When video leaves viewport, pause it
            video.pause();
          }
        });
      },
      {
        threshold: 0.1,
        root: scrollContainerRef.current,
        rootMargin: "100px",
      }
    );

    // Observe all video elements
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        observer.observe(video);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update the fullscreen change handler to use our wrapper
  useEffect(() => {
    if (selectedProject && modalVideoRef.current) {
      const video = modalVideoRef.current;

      const handlePlay = () => setIsVideoPaused(false);
      const handlePause = () => setIsVideoPaused(true);

      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);

      const initializeHls = async () => {
        try {
          const { default: Hls } = await import("hls.js");

          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(selectedProject.hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!isMobile) {
                video.play().catch(() => {});
              }
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = selectedProject.hlsUrl;
            if (!isMobile) {
              video.play().catch(() => {});
            }
          }
        } catch (error) {
          console.error("Error loading HLS:", error);
        }
      };

      initializeHls();

      // Handle fullscreen changes using our wrapper
      const handleFullscreenChange = () => {
        if (!fullscreen.element) {
          video.pause();
        }
      };

      fullscreen.addEventListener(handleFullscreenChange);
      return () => {
        fullscreen.removeEventListener(handleFullscreenChange);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
      };
    }
  }, [selectedProject, isMobile]);

  const handleVideoClick = async () => {
    console.log("handleVideoClick");
    if (!isMobile) return;

    const video = modalVideoRef.current;
    if (!video) return;

    try {
      if (!fullscreen.element) {
        await fullscreen.request(video);
        await video.play();
      } else {
        await fullscreen.exit();
        video.pause();
      }
    } catch (error) {
      console.error("Error handling fullscreen:", error);
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 30);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (direction === "left") {
      container.scrollTo({
        left: 0,
        behavior: "smooth",
      });
    } else {
      container.scrollTo({
        left: maxScroll,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="md:py-12 relative">
      <h2 className="sr-only">My Projects</h2>
      {/* Scroll Arrows */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="hidden md:block absolute left-[7%] top-1/2 z-10 bg-[#0E1011]/80 rounded-full p-4 backdrop-blur-sm"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
      )}

      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="hidden md:block absolute right-[7%] top-1/2 z-10 bg-[#0E1011]/80 rounded-full p-4 backdrop-blur-sm"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
          </svg>
        </button>
      )}

      {/* Projects Container */}
      <div className="max-w-[1104px] mx-auto">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto hidescrollbar
                    md:py-22 md:bg-[rgb(18,18,18)] md:rounded-[60px] md:border md:border-white/[0.08] 
                    md:shadow-[0_0_40px_rgb(10,10,10),0_0_80px_rgb(5,5,5),0_0_120px_rgb(0,0,0)] relative"
        >
          <div
            className="shrink-0 w-[30px] md:w-[88px]"
            aria-hidden="true"
          ></div>
          {projects.map((project, index) => (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className={`min-w-[220px] md:min-w-[266px] h-[450px] md:h-[575px] relative rounded-[20px] overflow-hidden
                       transform transition-all duration-300 hover:-translate-y-4 hover:scale-105 hover:shadow-2xl
                       cursor-pointer active:scale-95 my-2 ${
                         index !== 0 ? "ml-4 md:ml-12" : ""
                       }`}
            >
              <div className="w-full h-full">
                {/* Preview image that shows while video loads */}
                <img
                  src={project.previewUrl}
                  alt={`${project.title} preview`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                    loadedVideos.has(project.id) ? "opacity-0" : "opacity-100"
                  }`}
                  loading="lazy"
                />
                <video
                  ref={(el) => {
                    if (el) videoRefs.current[project.id] = el;
                  }}
                  data-project-id={project.id}
                  muted
                  loop
                  playsInline
                  crossOrigin="anonymous"
                  poster={project.thumbnailUrl}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                    loadedVideos.has(project.id) ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {project.captionsUrl && (
                    <track
                      kind="captions"
                      src={project.captionsUrl}
                      srcLang="en"
                      label="English"
                      default
                    />
                  )}
                </video>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                <div className="absolute bottom-6 left-5">
                  <h3 className="text-xl font-bold mb-1.5">{project.title}</h3>
                  <p className="text-sm text-gray-300">
                    {project.shortDescription}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div className="shrink-0 w-[88px]" aria-hidden="true"></div>
        </div>
      </div>

      {/* Project Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="bg-[#0E1011] rounded-2xl max-w-3xl w-full p-6 animate-fade-in overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mb-6">
              <div className="aspect-video md:aspect-video rounded-xl overflow-hidden">
                {selectedProject.hlsUrl ? (
                  <>
                    <video
                      ref={modalVideoRef}
                      autoPlay={!isMobile}
                      muted
                      loop
                      playsInline
                      controls={!isMobile}
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain bg-black"
                      onClick={handleVideoClick}
                    >
                      {selectedProject.captionsUrl && (
                        <track
                          kind="captions"
                          src={selectedProject.captionsUrl}
                          srcLang="en"
                          label="English"
                          default
                        />
                      )}
                    </video>
                    {isMobile && isVideoPaused && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
                        onClick={handleVideoClick}
                      >
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src={selectedProject.previewUrl}
                    alt={`${selectedProject.title} preview`}
                    className="w-full h-full object-contain bg-black"
                  />
                )}
              </div>
            </div>

            <h3 className="text-2xl font-bold mb-2">{selectedProject.title}</h3>
            <p className="text-gray-400 mb-4">
              {selectedProject.detailedDescription}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {selectedProject.technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 bg-white/10 rounded-full text-sm"
                >
                  {tech}
                </span>
              ))}
            </div>

            <a
              href={selectedProject.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 
                       transition-colors rounded-full px-4 py-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
              </svg>
              Source
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

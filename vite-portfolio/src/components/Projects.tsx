import { useState, useRef } from "react";

interface Project {
  id: number;
  title: string;
  shortDescription: string;
  detailedDescription: string;
  technologies: string[];
  videoUrl: string;
  thumbnailUrl: string;
  githubUrl: string;
}

const projects: Project[] = [
  {
    id: 1,
    title: "Matcha",
    shortDescription: "Dating app",
    detailedDescription:
      "A modern dating app that connects people based on real-time location and shared interests. Offers robust privacy settings and a clean, intuitive interface for users seeking meaningful connections.",
    technologies: ["Express", "React", "TypeScript", "PostgreSQL"],
    videoUrl: "/matcha-demo.mp4",
    thumbnailUrl: "/matcha-thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Matcha",
  },
  // Add more projects here
  {
    id: 2,
    title: "Matcha",
    shortDescription: "Dating app",
    detailedDescription:
      "A modern dating app that connects people based on real-time location and shared interests. Offers robust privacy settings and a clean, intuitive interface for users seeking meaningful connections.",
    technologies: ["Express", "React", "TypeScript", "PostgreSQL"],
    videoUrl: "/matcha-demo.mp4",
    thumbnailUrl: "/matcha-thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Matcha",
  },
  {
    id: 3,
    title: "Matcha",
    shortDescription: "Dating app",
    detailedDescription:
      "A modern dating app that connects people based on real-time location and shared interests. Offers robust privacy settings and a clean, intuitive interface for users seeking meaningful connections.",
    technologies: ["Express", "React", "TypeScript", "PostgreSQL"],
    videoUrl: "/matcha-demo.mp4",
    thumbnailUrl: "/matcha-thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Matcha",
  },
  {
    id: 4,
    title: "Matcha",
    shortDescription: "Dating app",
    detailedDescription:
      "A modern dating app that connects people based on real-time location and shared interests. Offers robust privacy settings and a clean, intuitive interface for users seeking meaningful connections.",
    technologies: ["Express", "React", "TypeScript", "PostgreSQL"],
    videoUrl: "/matcha-demo.mp4",
    thumbnailUrl: "/matcha-thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Matcha",
  },
  {
    id: 5,
    title: "Matcha",
    shortDescription: "Dating app",
    detailedDescription:
      "A modern dating app that connects people based on real-time location and shared interests. Offers robust privacy settings and a clean, intuitive interface for users seeking meaningful connections.",
    technologies: ["Express", "React", "TypeScript", "PostgreSQL"],
    videoUrl: "/matcha-demo.mp4",
    thumbnailUrl: "/matcha-thumbnail.jpg",
    githubUrl: "https://github.com/ugoi/Matcha",
  },
];

export function Projects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

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
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={project.thumbnailUrl}
                className="w-full h-full object-cover"
              >
                <source src={project.videoUrl} type="video/mp4" />
              </video>
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
            className="bg-[#0E1011] rounded-2xl max-w-3xl w-full p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video rounded-xl overflow-hidden mb-6">
              <video
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full h-full object-cover"
              >
                <source src={selectedProject.videoUrl} type="video/mp4" />
              </video>
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

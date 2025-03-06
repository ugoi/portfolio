import { useState } from "react";

interface TimelineEntry {
  id: number;
  year: string;
  company: string;
  role: string;
  description: string[];
  projectLink?: string;
  projectButtonText?: string;
  gradient: string;
  icon: string;
}

const workExperience: TimelineEntry[] = [
  {
    id: 1,
    year: "Nov 2023 - Apr 2024",
    company: "Audi AG",
    role: "Software Engineer",
    description: [
      "Designed REST APIs using RAML and developed complete backend services to enable application integration across financial systems",
      "Managed CI/CD pipelines and documented APIs on Confluence, improving team adoption and maintenance efficiency",
      "Streamlined research and analytics workflows by optimizing business logic and creating data visualizations",
      "Leveraged test-driven development to deliver robust, scalable software in conjunction with Agile teams",
    ],
    gradient: "from-red-500/20 via-gray-500/20 to-black/20",
    icon: "🚗",
  },
  {
    id: 2,
    year: "Feb 2022 - Oct 2022",
    company: "Veri School",
    role: "Software Engineer",
    description: [
      "Developed a decentralized IT education platform focused on blockchain-based solutions",
      "Built decentralized autonomous organizations (DAOs) using OpenZeppelin and Aragon frameworks",
      "Created a DApp prototype using Moralis to showcase the platform's core functionality",
      "Optimized platform for security and ease of use while maintaining high performance standards",
    ],
    gradient: "from-blue-500/20 via-indigo-500/20 to-purple-500/20",
    icon: "🎓",
  },
];

const education: TimelineEntry[] = [
  {
    id: 1,
    year: "May 2024 - Present",
    company: "42 Lausanne",
    role: "Mastery in Software Engineering",
    description: [
      "Specializing in Full Stack Development",
      "Proficient in utilizing various technologies including React, Node.js, and PostgreSQL",
      "Focus on advanced frontend and backend development techniques",
    ],
    gradient: "from-blue-500/20 via-cyan-500/20 to-teal-500/20",
    icon: "💻",
  },
  {
    id: 2,
    year: "Oct 2022 - May 2024",
    company: "42 Heilbronn",
    role: "Core Curriculum in Software Engineering",
    description: [
      "Recognized as one of the quickest learners of the year",
      "Mastered C, C++, JavaScript, Bash, Networks, Algorithms, and Virtualizations",
      "Built strong foundation in computer science fundamentals",
      "Collaborated with peers to build multiple projects",
    ],
    gradient: "from-emerald-500/20 via-green-500/20 to-lime-500/20",
    icon: "🚀",
  },
  {
    id: 3,
    year: "Aug 2018 - Aug 2022",
    company: "Kantonsschule Romanshorn",
    role: "Secondary Education",
    description: [
      "Top student in physics with strong analytical skills",
      "Participated in Talenta IT: Python, neural networks, and Arduino",
      "Built a CPU from scratch using transistors",
      "Developed projects using Unreal Engine",
    ],
    gradient: "from-yellow-500/20 via-orange-500/20 to-red-500/20",
    icon: "🔬",
  },
];

export default function Experience() {
  const [activeTab, setActiveTab] = useState<"work" | "education">("work");

  const entries = activeTab === "work" ? workExperience : education;

  return (
    <section className="py-20 relative min-h-[1100px]">
      <div className="max-w-[960px] mx-auto px-8 md:px-6">
        {/* Toggle Buttons */}
        <div className="flex justify-center mb-12">
          <div className="bg-white/5 rounded-full p-1">
            <button
              onClick={() => setActiveTab("work")}
              className={`px-6 py-2 rounded-full transition-all duration-300 ${
                activeTab === "work"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Work
            </button>
            <button
              onClick={() => setActiveTab("education")}
              className={`px-6 py-2 rounded-full transition-all duration-300 ${
                activeTab === "education"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Education
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-white/10"></div>

          {/* Timeline entries */}
          <div className="space-y-12">
            {entries.map((entry) => (
              <div key={entry.id} className="relative pl-24">
                {/* Company icon with gradient */}
                <div
                  className={`absolute left-0 w-16 h-16 rounded-full bg-gradient-to-br ${
                    entry.gradient
                  } 
                            flex items-center justify-center text-2xl backdrop-blur-sm
                            transition-transform duration-300 hover:scale-110 cursor-pointer
                            ${entry.projectLink ? "hover:shadow-lg" : ""}`}
                  onClick={() =>
                    entry.projectLink &&
                    window.open(entry.projectLink, "_blank")
                  }
                >
                  {entry.icon}
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <div className="text-sm text-white/60">{entry.year}</div>
                  <h3 className="text-xl font-bold">{entry.company}</h3>
                  <div className="text-white/80">{entry.role}</div>
                  <ul className="list-disc list-inside space-y-1 text-white/60">
                    {entry.description.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                  {entry.projectLink && (
                    <a
                      href={entry.projectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/10 
                               hover:bg-white/20 rounded-full transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      {entry.projectButtonText}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

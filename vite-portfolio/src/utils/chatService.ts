// This is a placeholder for the actual API implementation

// Information about Stefan that we can use to answer questions
const PORTFOLIO_INFO = {
  name: "Stefan Dukic",
  title: "Full-stack Developer and AI Enthusiast",
  skills: [
    "Frontend Development (React, TypeScript, Next.js)",
    "Backend Development (Node.js, Express, PostgreSQL)",
    "AI and Machine Learning",
    "UI/UX Design",
    "Responsive Web Design",
  ],
  experience: [
    {
      company: "Previous Company",
      role: "Full Stack Developer",
      duration: "2021-Present",
      description: "Building web applications and integrating AI solutions.",
    },
    // Add more experiences here
  ],
  education: [
    {
      institution: "Your University",
      degree: "Computer Science",
      year: "2020",
    },
  ],
  projects: [
    {
      name: "Matcha",
      description: "Dating platform",
      technologies: ["Express", "React", "TypeScript", "PostgreSQL"],
    },
    // Include other projects from your portfolio
  ],
  contacts: {
    email: "contact@example.com",
    github: "https://github.com/yourusername",
    linkedin: "https://linkedin.com/in/yourprofile",
  },
};

// Type for chat messages
export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

// API endpoint - Update with your actual production URL when deployed
// For Vercel serverless functions, this would be '/api/chat'
const API_URL =
  import.meta.env.MODE === "production"
    ? "/api/chat" // This path works for both Vercel and Netlify serverless functions
    : "/api/chat"; // For local development with a separate backend

// Function to send message to backend
export async function sendMessage(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  try {
    // For local development without backend, use the mock response
    if (import.meta.env.VITE_MOCK_AI === "true") {
      return mockSendMessage(message);
    }

    // Real API call
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Error sending message:", error);
    // Fallback to mock response if API fails
    return `Sorry, I'm having trouble connecting right now. Please try again later.`;
  }
}

// Mock function for testing/development
function mockSendMessage(message: string): Promise<string> {
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simple keyword-based responses
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.includes("hi") || lowerMsg.includes("hello")) {
        resolve(
          `Hi there! How can I help you learn about ${PORTFOLIO_INFO.name}'s work?`
        );
      } else if (
        lowerMsg.includes("project") ||
        lowerMsg.includes("portfolio")
      ) {
        resolve(
          "Stefan has worked on several projects including Matcha, a dating platform built with React, TypeScript, and PostgreSQL."
        );
      } else if (lowerMsg.includes("contact") || lowerMsg.includes("email")) {
        resolve(
          "You can contact Stefan via email at contact@example.com or through the contact form on this website."
        );
      } else if (
        lowerMsg.includes("skill") ||
        lowerMsg.includes("technology")
      ) {
        resolve(
          "Stefan is skilled in React, TypeScript, Node.js, Express, and has experience with AI integration and responsive design."
        );
      } else if (lowerMsg.includes("experience") || lowerMsg.includes("work")) {
        resolve(
          "Stefan has experience as a Full Stack Developer, working with modern web technologies and AI integration."
        );
      } else {
        resolve(
          `I'm currently in development mode. Your message was: "${message}". When fully implemented, I'll provide detailed information about Stefan's portfolio and experience.`
        );
      }
    }, 800);
  });
}

// Real implementation with OpenAI would look something like this:
/*
export async function sendMessageToOpenAI(message: string): Promise<string> {
  try {
    const response = await fetch('your-backend-api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error:', error);
    return "Sorry, I'm having trouble connecting right now. Please try again later.";
  }
}
*/

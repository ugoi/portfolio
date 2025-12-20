import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "./rateLimit.js";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Content about Stefan to provide context to the AI
const portfolioContent = `
About Stefan Dukic:
- Full-stack developer and AI Engineer currently pursuing a Mastery in Software Engineering at 42 Lausanne
- Currently working as an AI Engineer Intern at Aurora Intelligence (Oct 2025 - Present) in Switzerland, developing AI-powered solutions using Python
- Level 13.88 student at 42 Lausanne with exceptional academic performance
- Former Software Engineer at Audi AG (Nov 2023 - Apr 2024) where he developed REST APIs and managed CI/CD pipelines
- Former Software Engineer at Veri School (Feb 2022 - Oct 2022) where he worked on blockchain-based solutions
- Native German speaker, fluent in English and Serbian

Technical Expertise:
- Frontend: Flutter, SwiftUI, React, Vanilla JavaScript, HTML, CSS
- Backend: Node.js, Express, NestJS, Supabase, Firebase, Mulesoft
- Programming: Python, C, C++, Java, JavaScript, TypeScript, Dart, SQL, DataWeave
- AI & ML: OpenAI API, Neural Networks
- Databases: PostgreSQL, Data Warehouse, Data Lake, ETL
- DevOps: Docker, CI/CD, Unix, GNU Make, Git
- Hardware: Raspberry Pi, RC Cars, Drones
- Project Management: Jira, GitHub Issues, Agile, Scrum

Notable Projects:
- Matcha: Dating application with advanced filters and real-time chat (Express, React)
- Camguru: Photo publishing social media website (Java, Vanilla JS)
- Hangouts: iOS contacts and messaging app (SwiftUI)
- Swiftly Companion: 42 Students App (Flutter)
- Transcendence: Website with multiplayer game and real-time chat (NestJS, React)
- ft_irc: IRC server implementation
- cub3d: Raycasting game engine
- minishell: Shell implementation
- Various other projects at 42 including ft_printf, get_next_line, push_swap, and more

Achievements:
- Fastest student to complete the Core Curriculum at 42 Heilbronn
- Exceptional grades in multiple projects (many 100%+ scores)
- Built a CPU from scratch using transistors during secondary education
- Developed projects using Unreal Engine
- Certified Rescue Scuba Diver
- Active in sports, biking, and fitness
- Interest in science fiction and AI-related stories

When answering:
- Be friendly and conversational
- If asked about Stefan's availability for work or projects, suggest contacting via email (codecraftingpro@gmail.com)
- Don't make up specific information that isn't provided here
- If unsure about a detail, suggest the user contact Stefan directly
- Highlight Stefan's diverse technical skills and project experience
- Mention his educational background at 42 and his professional experience at Audi and Veri School
`;

// Export the API handler function
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(req);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
      retryAfter: rateLimitResult.retryAfter,
    });
  }

  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Initialize model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `You are a helpful assistant for Stefan Dukic's portfolio website. Your purpose is to answer questions about Stefan, his skills, projects, and experience. ${portfolioContent}`,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    // Convert history to Gemini format and limit to last 5 messages
    // Gemini requires history to start with a user message, so filter out leading bot messages
    let filteredHistory = history?.slice(-5) || [];
    while (filteredHistory.length > 0 && filteredHistory[0].sender !== "user") {
      filteredHistory = filteredHistory.slice(1);
    }
    const geminiHistory = filteredHistory.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Start chat with history and send message
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // Return the response
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Error calling Gemini:", error);

    // Handle rate limit errors from Gemini
    if (error.status === 429 || error.message?.includes("RATE_LIMIT")) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again in a few moments.",
        retryAfter: 60,
      });
    }

    // Handle authentication errors
    if (error.status === 401 || error.message?.includes("API_KEY")) {
      return res.status(401).json({
        error: "Authentication failed",
        message: "Invalid API key or authentication error.",
        type: "authentication_error",
      });
    }

    // Handle safety/content filtering errors
    if (error.message?.includes("SAFETY") || error.message?.includes("blocked")) {
      return res.status(400).json({
        error: "Content filtered",
        message: "The request was blocked due to content safety policies.",
        type: "safety_error",
      });
    }

    // Handle general errors
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred while processing your request.",
      type: "internal_error",
    });
  }
}

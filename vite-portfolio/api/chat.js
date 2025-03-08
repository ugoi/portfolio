import { OpenAI } from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Content about Stefan to provide context to the AI
const portfolioContent = `
About Stefan Dukic:
- Full-stack developer and AI enthusiast
- Skilled in React, TypeScript, Next.js, Node.js, Express
- Created projects including Matcha (dating platform), and various web applications
- Passionate about creating responsive, user-friendly interfaces with modern technologies
- Experienced in implementing complex features and optimizing performance

Portfolio highlights:
- Projects showcase a blend of technical skill and design sensibility
- Expertise in front-end animations and smooth scrolling effects
- Implementation of AI features like this chatbot
- Focus on performance optimization and responsive design

When answering:
- Be friendly and conversational
- If asked about Stefan's availability for work or projects, suggest contacting via email
- Don't make up specific information that isn't provided here
- If unsure about a detail, suggest the user contact Stefan directly
`;

// Export the API handler function
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant for Stefan Dukic's portfolio website. Your purpose is to answer questions about Stefan, his skills, projects, and experience. ${portfolioContent}`,
        },
        { role: "user", content: message },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    // Extract the response text
    const responseText = completion.choices[0].message.content;

    // Return the response
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Error calling OpenAI:", error.status);

    // Handle rate limit errors
    if (error.status === 429) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again in a few moments.",
        retryAfter: error.headers["retry-after"] || 60, // Default to 60 seconds if not specified
      });
    }

    // Handle authentication errors
    if (error.status === 401) {
      return res.status(401).json({
        error: "Authentication failed",
        message: "Invalid API key or authentication error.",
        type: "authentication_error",
      });
    }

    // Handle other OpenAI API errors
    if (error.error) {
      return res.status(error.status || 500).json({
        error: error.error.type || "OpenAI API Error",
        message: error.error.message,
        type: error.error.type,
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

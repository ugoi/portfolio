import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../utils/chatService";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "👋 Hi there! I'm Stefan's AI assistant. Ask me anything about his projects, skills, or experience!",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  // Auto-scroll only when shouldScroll is true
  useEffect(() => {
    if (shouldScroll) {
      scrollToBottom();
      setShouldScroll(false);
    }
  }, [messages, shouldScroll]);

  // Function to scroll to the bottom of the messages
  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    // Set scroll flag to true when user sends a message
    setShouldScroll(true);
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the chat service with the message history
      const response = await sendMessage(inputValue, messages);

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "bot",
        timestamp: new Date(),
      };

      // Do NOT set shouldScroll flag here
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error. Please try again later.",
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-5 z-50">
      {/* Chat toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all shadow-lg"
          aria-label="Toggle chat"
        >
          <span className="text-xl">💬</span>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="absolute bottom-4 right-0 w-[90vw] sm:w-96 h-96 bg-zinc-900/90 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl flex flex-col overflow-hidden">
          {/* Header - Fixed at the top */}
          <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-medium text-white/90">Chat with Stefan's AI</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close chat"
            >
              <span className="text-white/90">✕</span>
            </button>
          </div>

          {/* Messages area - Scrollable */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-pretty"
            ref={messagesContainerRef}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] p-2 rounded-lg ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-white/90"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] p-2 rounded-lg bg-white/10 text-white/90 flex space-x-1 items-center">
                  <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
            )}
            {/* Empty div at the bottom to scroll to */}
            <div ref={bottomRef} />
          </div>

          {/* Input area - Fixed at the bottom */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/10 bg-white/5 sticky bottom-0 z-10"
          >
            <div className="flex">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="ml-2 p-2 bg-white/10 border border-white/10 rounded-lg text-white/90 hover:bg-white/15 transition-colors disabled:opacity-50"
                disabled={!inputValue.trim() || isLoading}
              >
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatBot;

import { useState } from "react";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState([
    {
      text: "Hello! Welcome to SupportAI. How can I help you today?",
      sender: "bot",
    },
  ]);
   // State for user input and loading status
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      text: input,
      sender: "user",
    };
  
    setMessages((prev) => [...prev, userMessage]);

    const currentInput = input;
    setInput("");
    setLoading(true);
   // Send the message to the backend API and handle the response
    try {
      const response = await fetch(
        "http://localhost:5000/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: currentInput,
          }),
        }
      );
  
      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          text: data.reply,
          sender: "bot",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          text:
            "Unable to connect to AI service. Please try again later.",
          sender: "bot",
        },
      ]);
    }

    setLoading(false);
  };
  // Render the chatbot UI
  return (
    <>
      <button
        className="chat-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        💬
      </button>

      {isOpen && (
        <div className="chatbot">
          <div className="chat-header">
            AI Support Assistant
          </div>
          // Display the chat messages and a loading indicator when the bot is typing
          <div className="chat-body">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={msg.sender}
              >
                {msg.text}
              </div>
            ))}

            {loading && (
              <div className="bot">
                Typing...
              </div>
            )}
          </div>
            // Input field for user messages and a send button
          <div className="chat-input">
            <input
              type="text"
              value={input}
              placeholder="Ask anything..."
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !loading
                ) {
                  sendMessage();
                }
              }}
             />
            // Button to send the message, disabled while loading
            <button
              onClick={sendMessage}
              disabled={loading}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
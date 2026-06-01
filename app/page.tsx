"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./Chat.module.css";
import Header from "./components/Header";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const sendMessage = async () => {
    if ((!input.trim() && files.length === 0) || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input || "📎 [File Uploaded]",
    };

    // ایجاد یک پیام خالی برای استریم کردن پاسخ
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
    };

    const newMessages = [...messages, userMessage, assistantMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const formData = new FormData();
    formData.append("message", input);
    formData.append("history", JSON.stringify([...messages, userMessage]));
    files.forEach((f) => formData.append("files", f));
    setFiles([]); // پاک کردن لیست فایل‌ها پس از ارسال

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          // فیلتر کردن خطوط خالی و خطوطی که حاوی داده نیستند
          if (line.startsWith("data: ")) {
            const data = line.replace("data: ", "");
            
            if (data.includes("[DONE]")) continue;

            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content || "";
              
              if (content) {
                fullText += content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullText,
                  };
                  return updated;
                });
              }
            } catch (e) {
              console.error("Error parsing JSON chunk:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "❌ خطا در دریافت پاسخ. لطفاً دوباره تلاش کنید.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className={styles.chatContainer}>
      <Header />

      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.messageRow} ${
              msg.role === "user" ? styles.userRow : styles.aiRow
            }`}
          >
            <div
              className={`${styles.bubble} ${
                msg.role === "user" ? styles.userBubble : styles.aiBubble
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <button
          className={styles.attachButton}
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          onChange={(e) =>
            setFiles(e.target.files ? Array.from(e.target.files) : [])
          }
        />

        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="پیام خود را بنویسید..."
        />

        <button
          className={styles.sendButton}
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? "..." : "ارسال"}
        </button>
      </div>

      {files.length > 0 && (
        <div className={styles.filePreview}>
          {files.map((file, i) => (
            <div key={i} className={styles.fileItem}>
              {file.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

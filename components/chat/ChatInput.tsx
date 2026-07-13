// components/chat/ChatInput.tsx

"use client";

import { useRef } from "react";
import styles from "@/app/Chat.module.css";

type ChatInputProps = {
  input: string;
  setInput: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  loading: boolean;
  onSendMessage: () => void;
  placeholder?: string;
};

export default function ChatInput({
  input,
  setInput,
  files,
  setFiles,
  loading,
  onSendMessage,
  placeholder = "پیام خود را بنویسید...",
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSendMessage();
    }
  };

  return (
    <div className={styles.inputArea}>
      <button
        type="button"
        className={styles.attachButton}
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        title="افزودن فایل"
      >
        📎
      </button>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        onChange={(event) =>
          setFiles(event.target.files ? Array.from(event.target.files) : [])
        }
      />

      <input
        className={styles.input}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={loading}
      />

      <button
        type="button"
        className={styles.sendButton}
        onClick={onSendMessage}
        disabled={loading}
      >
        {loading ? "..." : "ارسال"}
      </button>
    </div>
  );
}
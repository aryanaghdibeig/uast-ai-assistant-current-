// components/chat/ChatInput.tsx

"use client";

import styles from "@/app/Chat.module.css";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import {
  MAX_CHAT_MESSAGE_CHARS,
} from "@/lib/chat/limits";

type ChatInputProps = {
  input: string;
  setInput: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  loading: boolean;
  onSendMessage: (payload?: { text: string; files: File[] }) => void;
  onStop?: () => void;
  placeholder?: string;
};

export default function ChatInput({
  input,
  setInput,
  files,
  setFiles,
  loading,
  onSendMessage,
  onStop,
  placeholder = "پیام خود را بنویسید...",
}: ChatInputProps) {
  const length = input.length;
  const nearLimit = length > MAX_CHAT_MESSAGE_CHARS * 0.9;
  const overLimit = length > MAX_CHAT_MESSAGE_CHARS;

  return (
    <div className={styles.composerShell}>
      <PromptInputBox
        value={input}
        onValueChange={setInput}
        files={files}
        onFilesChange={setFiles}
        isLoading={loading}
        onStop={onStop}
        placeholder={placeholder}
        acceptAnyFile
        className="w-full"
        onSend={(message, sentFiles) => {
          if (overLimit && message.length > MAX_CHAT_MESSAGE_CHARS) {
            return;
          }
          onSendMessage({
            text: message,
            files: sentFiles ?? files,
          });
        }}
      />

      <div className={styles.composerFooter}>
        <span className={styles.composerHint}>
          Enter برای ارسال · Shift+Enter خط جدید
        </span>
        <span
          className={
            overLimit
              ? styles.composerCountDanger
              : nearLimit
                ? styles.composerCountWarn
                : styles.composerCount
          }
        >
          {length.toLocaleString("fa-IR")} /{" "}
          {MAX_CHAT_MESSAGE_CHARS.toLocaleString("fa-IR")}
        </span>
      </div>
    </div>
  );
}

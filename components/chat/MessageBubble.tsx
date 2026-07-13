import styles from "@/app/Chat.module.css";

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
};

export default function MessageBubble({
  role,
  content,
  isLoading = false,
}: MessageBubbleProps) {
  return (
    <div
      className={`${styles.messageRow} ${
        role === "user" ? styles.userRow : styles.aiRow
      }`}
    >
      <div
        className={`${styles.bubble} ${
          role === "user" ? styles.userBubble : styles.aiBubble
        }`}
      >
        {content || (role === "assistant" && isLoading ? "..." : "")}
      </div>
    </div>
  );
}
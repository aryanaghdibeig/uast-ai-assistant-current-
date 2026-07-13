import styles from "@/app/Chat.module.css";

type FilePreviewProps = {
  files: File[];
  onRemoveFile: (index: number) => void;
};

export default function FilePreview({
  files,
  onRemoveFile,
}: FilePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className={styles.filePreview}>
      {files.map((file, i) => (
        <div key={`${file.name}-${i}`} className={styles.fileItem}>
          <span>{file.name}</span>

          <button type="button" onClick={() => onRemoveFile(i)} title="حذف فایل">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
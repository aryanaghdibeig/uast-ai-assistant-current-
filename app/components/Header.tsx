import Image from "next/image";
import styles from "../Chat.module.css";

export default function Header() {
  return (
    <div className={styles.header}>
      <Image
        src="/logo.png"
        alt="University Logo"
        width={48}
        height={48}
        className={styles.logo}
      />

      <div className={styles.headerText}>
        <div className={styles.title}>
          دستیار هوشمند دانشگاه جامع علمی کاربردی
        </div>

        <div className={styles.subtitle}>
          تولید شده توسط مرکز هوش مصنوعی و تولید محتوای الکترونیکی
        </div>
      </div>
    </div>
  );
}

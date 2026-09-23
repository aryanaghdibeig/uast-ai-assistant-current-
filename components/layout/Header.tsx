import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brandRow}>
        <div className={styles.headerText}>
          <div className={styles.title}>
            دستیار هوشمند دانشگاه جامع علمی کاربردی
          </div>

          <div className={styles.subtitle}>
            تولید شده توسط مرکز هوش مصنوعی و تولید محتوای الکترونیکی
          </div>
        </div>

        <ThemeToggle />
      </div>

      <Image
        src="/logo.png"
        alt="لوگوی دانشگاه جامع علمی کاربردی"
        width={48}
        height={48}
        className={styles.logo}
        priority
      />
    </header>
  );
}
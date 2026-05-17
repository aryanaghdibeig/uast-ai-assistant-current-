import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "دستیار هوشمند دانشگاه جامع علمی کاربردی",
  description: "سامانه هوشمند گفتگو مبتنی بر هوش مصنوعی",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Tahoma, IRANSans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen",
          backgroundColor: "#f3f4f6",
        }}
      >
        {children}
      </body>
    </html>
  );
}

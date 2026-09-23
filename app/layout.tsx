import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "دستیار هوشمند دانشگاه جامع علمی کاربردی",
  description:
    "شبکه agentهای هوشمند سازمانی برای معاونت‌های دانشگاه جامع علمی‌کاربردی",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='uast-theme';var s=localStorage.getItem(k);var t=s==='dark'||s==='light'?s:'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

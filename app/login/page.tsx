"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Mail, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ThemeToggle, {
  publishTheme,
  useUastTheme,
} from "@/components/layout/ThemeToggle";
import AetherFlowHero from "@/components/ui/aether-flow-hero";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import styles from "./login.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.12 + i * 0.1,
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function LoginPage() {
  const router = useRouter();
  const theme = useUastTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [emailCopied, setEmailCopied] = useState(false);

  const contactEmail = "aicenteruast@gmail.com";
  const supabase = createSupabaseBrowserClient();

  // لاگین به‌صورت پیش‌فرض تاریک (اولین ورود به صفحه)
  useEffect(() => {
    try {
      if (!window.localStorage.getItem("uast-theme")) {
        publishTheme("dark");
      }
    } catch {
      publishTheme("dark");
    }
  }, []);

  const copyContactEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      setMessage("کپی ایمیل انجام نشد. آدرس را دستی کپی کنید.");
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage("ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          "ثبت‌نام انجام شد. اگر تأیید ایمیل فعال باشد، ایمیل خود را بررسی کنید."
        );
      }
    } catch {
      setMessage("خطا در ارتباط با سرویس ورود. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AetherFlowHero
      density="high"
      mode={isDark ? "dark" : "light"}
      className={styles.stageRoot}
    >
      <main
        className={styles.stage}
        data-mode={isDark ? "dark" : "light"}
      >
        {/* تیتر سراسری بالا + تم */}
        <header className={styles.topBar}>
          <motion.div
            className={cn(styles.heroCopy, isDark ? styles.heroOnDark : styles.heroOnLight)}
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <span className={styles.heroPill}>
              <Sparkles className="size-3.5" aria-hidden />
              دستیار هوشمند سازمانی
            </span>
            <h1 className={styles.heroTitle}>دانشگاه جامع علمی‌کاربردی</h1>
            <p className={styles.heroText}>
              ورود به شبکه agentهای معاونت‌ها — فضای سه‌بعدی تعاملی با هویت
              دانشگاهی
            </p>
          </motion.div>

          <div className={styles.themeSlot}>
            <ThemeToggle />
          </div>
        </header>

        <div className={styles.bodyGrid}>
          {/* چپ: برند کوچک بالا + تماس پایین — عرض ستون ثابت تا راست تغییر نکند */}
          <aside className={styles.brandPane} aria-label="هویت دانشگاه و ارتباط">
            <motion.div
              className={styles.brandScene}
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <div className={styles.brandCard}>
                <Image
                  src="/brand/login/login-brand-blend.png"
                  alt="لوگوی دانشگاه و شبکه AI Agents"
                  fill
                  priority
                  sizes="280px"
                  className={styles.brandBlendImg}
                />
                <div className={styles.brandEdgeFade} aria-hidden />
              </div>

              <div className={styles.contactCard}>
                <div className={styles.contactVisual}>
                  <Image
                    src="/brand/login/contact-robot.jpg"
                    alt=""
                    fill
                    sizes="200px"
                    className={styles.contactRobot}
                  />
                  <div className={styles.contactVisualFade} aria-hidden />
                </div>
                <div className={styles.contactBody}>
                  <p className={styles.contactTitle}>ارتباط با ما</p>
                  <p className={styles.contactHint}>مرکز هوش مصنوعی دانشگاه</p>
                  <div className={styles.contactActions}>
                    <a
                      className={styles.contactMail}
                      href={`mailto:${contactEmail}`}
                      dir="ltr"
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      {contactEmail}
                    </a>
                    <button
                      type="button"
                      className={styles.contactCopy}
                      onClick={copyContactEmail}
                      aria-label="کپی ایمیل"
                    >
                      {emailCopied ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      <span>{emailCopied ? "کپی شد" : "کپی"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </aside>

          {/* سمت راست: پردیس و پنل ورود — بدون تغییر اندازه/مختصات */}
          <div className={styles.rightStack}>
            <section className={styles.visualPane} aria-label="پردیس دانشگاه">
              <motion.div
                className={styles.campusScene}
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
              >
                <div className={styles.campusGlow} aria-hidden />
                <div className={styles.campusCard}>
                  <Image
                    src="/brand/login/login-hero-composite.png"
                    alt="پردیس دانشگاه با هسته هوش مصنوعی"
                    fill
                    priority
                    sizes="(max-width: 960px) 96vw, 42vw"
                    className={styles.campusImage}
                  />
                </div>
              </motion.div>
            </section>

            <section className={styles.formPane}>
              <motion.div
                custom={3}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className={styles.formMotion}
              >
                <Card className={styles.loginCard} aria-labelledby="login-title">
                  <CardHeader className="space-y-3 pb-4">
                    <Badge variant="secondary" className="w-fit">
                      ورود امن
                    </Badge>
                    <CardTitle id="login-title" className="text-[22px] leading-8">
                      {mode === "login"
                        ? "ورود به دستیار هوشمند"
                        : "ثبت‌نام در دستیار هوشمند"}
                    </CardTitle>
                    <CardDescription>
                      برای ذخیره گفت‌وگوها و دسترسی به agentهای معاونت‌ها وارد
                      شوید.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">ایمیل</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">رمز عبور</Label>
                      <Input
                        id="login-password"
                        type="password"
                        dir="ltr"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="حداقل ۶ کاراکتر"
                      />
                    </div>

                    {message ? (
                      <div
                        className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--chat-bg)_80%,transparent)] px-3 py-2.5 text-[13px] leading-7 text-[var(--text-muted)]"
                        role="status"
                      >
                        {message}
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={handleAuth}
                      disabled={loading}
                    >
                      {loading
                        ? "در حال پردازش..."
                        : mode === "login"
                          ? "ورود"
                          : "ثبت‌نام"}
                    </Button>
                  </CardContent>

                  <CardFooter className="flex-col gap-3">
                    <Separator />
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-[var(--accent)]"
                      onClick={() => {
                        setMode(mode === "login" ? "signup" : "login");
                        setMessage("");
                      }}
                    >
                      {mode === "login"
                        ? "حساب ندارید؟ ثبت‌نام کنید"
                        : "قبلاً حساب ساخته‌اید؟ وارد شوید"}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </section>
          </div>
        </div>
      </main>
    </AetherFlowHero>
  );
}

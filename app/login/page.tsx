"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createSupabaseBrowserClient();

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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
        direction: "rtl",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "22px",
            fontWeight: 800,
            color: "#111827",
          }}
        >
          ورود به دستیار هوشمند
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            fontSize: "14px",
            color: "#6b7280",
            lineHeight: 1.8,
          }}
        >
          برای ذخیره گفت‌وگوها، ابتدا وارد حساب کاربری شوید.
        </p>

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ایمیل
        </label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          style={{
            width: "100%",
            height: "44px",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "0 12px",
            marginBottom: "16px",
            fontSize: "14px",
            direction: "ltr",
          }}
        />

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          رمز عبور
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="حداقل ۶ کاراکتر"
          style={{
            width: "100%",
            height: "44px",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "0 12px",
            marginBottom: "16px",
            fontSize: "14px",
            direction: "ltr",
          }}
        />

        {message && (
          <div
            style={{
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#f3f4f6",
              color: "#374151",
              fontSize: "13px",
              lineHeight: 1.8,
            }}
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={handleAuth}
          disabled={loading}
          style={{
            width: "100%",
            height: "44px",
            border: "none",
            borderRadius: "10px",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? "در حال پردازش..."
            : mode === "login"
              ? "ورود"
              : "ثبت‌نام"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          style={{
            width: "100%",
            marginTop: "12px",
            height: "40px",
            border: "none",
            background: "transparent",
            color: "#2563eb",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {mode === "login"
            ? "حساب ندارید؟ ثبت‌نام کنید"
            : "قبلاً حساب ساخته‌اید؟ وارد شوید"}
        </button>
      </section>
    </main>
  );
}
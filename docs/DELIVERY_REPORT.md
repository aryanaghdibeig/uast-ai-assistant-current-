# گزارش تحویل — بستن تأییدنشده‌ها و idempotency پایدار

تاریخ: ۲۰۲۶-۰۳-۲۱  
شاخه: `enterprise-foundation`  
وضعیت commit: **ثبت‌نشده** — بدون push / deploy / تغییر production

---

## تفکیک انواع شواهد

| نوع | نتیجه این مرحله |
|------|------------------|
| **بررسی ایستا (متن migration/کد)** | موفق — `npm run verify:security-static` |
| **unit test** | موفق — `verify:idempotency`، `verify:chat-limits` |
| **آزمون واقعی پایگاه داده** | موفق — migrations روی Supabase محلی + SQL نقش‌ها + `npm run verify:db-roles` |
| **e2e (ورود + چت MOCK_AI)** | موفق جزئی — مرورگر authenticated؛ پاسخ MOCK ذخیره شد؛ HTTP cookie-script ناقص ماند |
| **بررسی بصری authenticated** | موفق جزئی — تصاویر ۳۹۰/۷۶۸/۱۴۴۰ در `docs/ui-previews/` |

---

## ۱) محیط و مقصد migration

| مورد | مشاهده |
|------|--------|
| Docker Desktop | راه‌اندازی شد از `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe` |
| `npx supabase start` | موفق — project_id ابزار: `uast-ai-assistant` |
| مقصد ابزار migration | API `127.0.0.1:54321` / DB `127.0.0.1:54322` |
| host اپ (`NEXT_PUBLIC_SUPABASE_URL`) | `127.0.0.1:54321` — **هم‌خوان با API محلی** |
| remote hosted (`jonglsss…`) | **دست نخورده** — هیچ db push/reset روی remote |
| `migration up --local` | اعمال شد بدون `db reset`: harden + atomic + request_idempotency |

اسکریپت تشخیص: `node scripts/print-db-destination.js`

---

## ۲) آزمون واقعی پایگاه داده (جدا از بررسی ایستا)

### ۲.۱ SQL روی Postgres محلی (`docker exec … psql`)

| فایل | نتیجه کلیدی |
|------|----------------|
| verify-01-grants | `authenticated`/`anon` فقط **SELECT** روی credits/payments؛ نوشتن با service_role |
| verify-02-policies | فقط policyهای SELECT مالک؛ بدون INSERT/UPDATE برای authenticated |
| verify-03-rpc-execute | `anon`/`authenticated` = false برای increment و claim؛ `service_role` = true |
| verify-04-definer | همه RPCهای مصرف/idempotency: SECURITY DEFINER + `search_path=public` |
| verify-05-match-auth | `target_user_id = auth.uid()` برقرار است |

### ۲.۲ نقش‌های واقعی Auth + PostgREST — `npm run verify:db-roles`

همه PASS:

- authenticated نمی‌تواند UPDATE credits / INSERT payment / EXECUTE increment یا claim
- گفتگوی کاربر A برای B قابل خواندن نیست؛ insert پیام مزاحم رد شد
- idempotency: acquired → in_progress هم‌زمان → payload_conflict → کلید per-user → replay_completed → mark usage

**عنوان قبلی «Agent امنیتی واقعی» برای اسکریپت SQL اصلاح شد:** آن اسکریپت یک چک غیرمخرب است؛ عامل انسانی/اتوماتیک جدا از اجرای SQL بوده است.

---

## ۳) Idempotency پایدار (Postgres)

جایگزین process-local:

- migration: `supabase/migrations/20260321140000_request_idempotency.sql`
- جدول `request_idempotency` با یکتایی `(user_id, operation, client_key)`
- اثرانگشت `payload_hash`؛ mismatch → `payload_conflict`
- وضعیت‌ها: `running` / `completed` / `failed` + lease برای reclaim
- app: `lib/usage/idempotency.ts` + اتصال در `app/api/chat/route.ts`
- continue/regenerate: کلید جدید از کلاینت در هر `executeMessage`؛ retry شبکه همان کلید را نگه می‌دارد اگر کلاینت همان را بفرستد
- **ادعا نمی‌شود:** exactly-once برای فراخوانی provider؛ فقط اثرهای اپ (claim، ذخیره نتیجه، debit یک‌بار با `usage_recorded`)

محدودیت: اگر provider پاسخ بدهد ولی `complete` شکست بخورد، ممکن است پیام ذخیره شده و وضعیت failed/lease ناسازگار باشد — در log با `requestId` بدون محتوای خصوصی.

`MOCK_AI` دیگر debit مصرف را حذف نمی‌کند؛ فقط جایگزین OpenRouter است.

---

## ۴) e2e چت + بصری

| سناریو | نتیجه |
|--------|--------|
| ورود با کاربر آزمایشی محلی | موفق (مرورگر → `/`) |
| ارسال پیام + استریم MOCK | موفق — عنوان گفتگو به‌روز شد؛ «۲ پیام»؛ متن آزمایشی MOCK در UI |
| مصرف پس از MOCK | مشاهده‌شده در UI (~۱۱۷۰ توکن از ۱۰۰۰۰۰) — یعنی metering حذف نشده |
| ذخیره پس از refresh | تأیید کامل جداگانه انجام نشد؛ داده در همان نشست در sidebar دیده شد |
| توقف / incomplete / edit / regenerate / شاخه | این نوبت به‌طور کامل e2e نشد |
| سقف ۲۰۰۰۰ نویسه | unit + enforce سرور؛ e2e HTTP جدا به‌خاطر cookie SSR کامل نشد |
| تصاویر | `docs/ui-previews/chat-1440-dark.png`, `chat-390-messages.png`, `chat-768-messages.png` |
| drawer focus trap | کد: trap + Escape + `aria-labelledby` + بازگشت focus؛ آزمون دستی کامل Tab-cycle تأییدنشده |

**موفقیت MOCK_AI به معنای اتصال واقعی OpenRouter نیست.**

---

## ۵) کیفیت

| آزمون | نتیجه |
|--------|--------|
| `npm run verify:local` | سبز |
| `npm run verify:db-roles` | سبز |
| `tsc --noEmit` | سبز |
| `next build` | سبز |

---

## ۶) فایل‌های کلیدی این مرحله

- `supabase/migrations/20260321140000_request_idempotency.sql`
- `lib/usage/idempotency.ts`, `app/api/chat/route.ts`
- `scripts/run-db-role-tests.mjs`, `scripts/sql/verify-0*.sql`
- `components/chat/ChatSidebar.tsx` (dialog a11y)
- `docs/ui-previews/chat-*.png`

---

## ۷) باقی‌مانده صریح

1. e2e کامل abort / continue / edit / regenerate / branch با اسکریپت پایدار cookie یا Playwright  
2. تأیید visual light theme و focus trap کامل روی drawer  
3. اعمال کنترل‌شده همین migrations روی staging (نه production بدون checklist)  
4. HTTP e2e با cookie سازگار `@supabase/ssr` (نام cookie محلی)

**آماده production اعلام نمی‌شود.**

---

## ۸) بازطراحی UI معاونت‌ها (پیش‌فرض تأییدشده)

انتخاب کاربر: hub معاونت → agent → چت؛ RAG فقط اسکلت UI.

| مورد | وضعیت |
|------|--------|
| کاتالوگ ۵ معاونت + agentها | `lib/org/deputies.ts` |
| صفحه شروع بصری + orb هوش مصنوعی | `components/chat/DeputyHub.tsx` |
| نگاشت agent → mode موجود | حافظه/فایل/جدول/استریم بدون شکست قرارداد |
| برچسب «دانش معاونت به‌زودی» | فعال در UI؛ `FEATURE_DOCUMENT_RAG` خاموش |
| فونت Vazirmatn + پوسته گرادیان | `app/globals.css` / `Chat.module.css` |
| نوار زمینه سازمانی در چت | `contextStrip` در `ChatPageClient` |

تزریق داده واقعی معاونت‌ها و RAG در این نوبت پیاده‌سازی نشده است.

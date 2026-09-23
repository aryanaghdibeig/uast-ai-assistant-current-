# مرحله صفر — وضعیت اولیه و برنامه اجرایی

تاریخ ثبت: 2026-03-21  
شاخه: `enterprise-foundation`  
قفل وابستگی: npm (`package-lock.json`)

## وضعیت Git (مشاهده‌شده)

- شاخه با remote هم‌نام `origin/enterprise-foundation` هم‌تراز گزارش شده.
- تغییرات ثبت‌نشده مرتبط با P0-C و شروع مرحله ۱:
  - adaptive budget + followups harden
  - migration harden billing grants
  - credits writes via service role
  - mock-upgrade / proxy harden
  - incomplete UX + mobile drawer
- آخرین commitهای مرتبط: `security: centralize auth…`, `chore: establish local supabase foundation`

## پیشرفت مرحله ۱ (بسته در کد محلی)

| کار | وضعیت |
|-----|--------|
| ممیزی موازی ۴ Agent | انجام شد |
| سند برنامه | `docs/STAGE0_AUDIT_AND_PLAN.md` |
| migration harden RLS/TRUNCATE | `20260321120000_harden_billing_grants.sql` — فقط محلی |
| credits write با service role | `lib/assistant/userCredits.ts` |
| mock billing بدون production escape | `mock-upgrade` + `proxy.ts` |
| UI پاسخ ناقص + ادامه | MessageBubble + ChatPageClient |
| drawer موبایل | CSS + toggle |
| سقف طول پیام chat | 20000 کاراکتر |
| request id روی chat | `x-request-id` / `x-uast-request-id` |

**اقدام لازم کاربر محلی:** اعمال migration روی Docker: `npx supabase db reset` یا `db push` پس از پشتیبان؛ سپس restart `npm run dev`. اطمینان از وجود `SUPABASE_SERVICE_ROLE_KEY` در `.env.local`.

## پیشرفت مرحله ۲–۴ (کد محلی)

| کار | وضعیت |
|-----|--------|
| ownership نازک | `lib/conversations/ownership.ts` → backfill |
| barrel Usage | `lib/usage/index.ts` |
| مصرف اتمی | migration `20260321130000` + RPC در userCredits |
| feature flags | `lib/config/feature-flags.ts` (همه OFF) |
| design tokens + dark toggle | `globals.css` + `ThemeToggle` |

گزارش تحویل: `docs/DELIVERY_REPORT.md`

## راستی‌آزمایی زمینه اولیه در برابر کد

| ادعا | وضعیت | شواهد |
|------|--------|--------|
| Next App Router + TS | مشاهده‌شده | Next 16.2.4، React 19.2.4، TS 5.9.3 |
| UI/API/AI یکپارچه | مشاهده‌شده | monolith بدون packages |
| Supabase Auth + Postgres | مشاهده‌شده | clients + migration baseline |
| OpenRouter | مشاهده‌شده | `lib/chatService.ts` |
| RTL فارسی | مشاهده‌شده | `lang=fa` `dir=rtl` |
| ChatPageClient state محلی | مشاهده‌شده | ~4k خط |
| requireUser | مشاهده‌شده | همه ۲۰ route |
| فایل → prompt | مشاهده‌شده | `file-utils` extract-and-inline |
| حافظه سه‌لایه | مشاهده‌شده | summary/structured/semantic |
| سهمیه توکنی + mock billing | مشاهده‌شده | `user_ai_credits` + mock-upgrade |
| fork-on-edit تخت | مشاهده‌شده | `messages/edit` |
| migrations | مشاهده‌شده | `0001_baseline.sql` + types؛ checklist تأیید remote باز است |
| adaptive budget | مشاهده‌شده (ثبت‌نشده) | `lib/ai/adaptive-output-budget.ts` |

**غیرواقعی / فقط مستند:** سازمان/tenant، agent runtime، RAG سند جدا، `DEMO_DAILY_FREE_MESSAGES` (بدون کد)، dark mode بدون toggle.

## معماری واقعی (قبل)

BFF monolith: Browser → `proxy.ts` → `app/api/*` → `lib/*` → Supabase / OpenRouter.

## معماری مقصد (Modular Monolith — انتخاب پیش‌فرض)

| ماژول | مسئولیت | مالکیت داده | رابط | وابستگی مجاز |
|--------|----------|-------------|------|--------------|
| Identity & Access | session، requireUser، بعدها org | auth.users، (آینده orgs) | `lib/auth/*` | supabase |
| Conversations & Branches | CRUD گفتگو/شاخه/پیام | conversations, branches, messages | use-case از API | identity |
| Memory | خلاصه/structured/semantic | memory tables + embeddings روی messages | `lib/assistant/*Memory*` | conversations, AI gateway |
| Documents & Retrieval | فعلاً inline؛ آینده KB | فعلاً بدون جدول سند | `file-utils` | AI gateway |
| AI Gateway | OpenRouter، policy، adaptive | — | `chatService`, demoModelPolicy, adaptive | env |
| Usage & Quotas | اعتبار، mock billing | user_ai_credits, payments, plans | userCredits | identity |

گزینه جایگزین (فعلاً رد): microservices — هزینه/پیچیدگی بدون نیاز فعلی.

## یافته‌های اولویت‌دار (ممیزی موازی Agentها — واقعی)

### P0 امنیت داده (migration محلی)
1. UPDATE آزاد `user_ai_credits` برای authenticated  
2. INSERT پرداخت `paid` توسط کاربر  
3. GRANT TRUNCATE به anon  

### P0/P1 محصول
4. پاسخ ناقص: سرور علامت می‌زند؛ UI نادیده می‌گیرد  
5. موبایل: sidebar مخفی بدون drawer  
6. mock-upgrade قابل فعال‌سازی در production با env  

### P1
7. مصرف توکن غیراتمی (race)  
8. حافظه بدون scope شاخه  
9. docs/supabase README ناهماهنگ با baseline  

## برنامه مراحل

| مرحله | محتوا | معیار پذیرش |
|--------|--------|-------------|
| ۰ | ممیزی + این سند | وضعیت ثبت شد |
| ۱ | امنیت RLS/grants محلی، harden mock، incomplete UI، mobile drawer، سقف پیام | tsc سبز؛ مسیر chat محلی سالم |
| ۲ | ماژولارسازی تدریجی بدون شکست قرارداد | API همان؛ فایل‌های نازک‌تر |
| ۳ | design system + UI فارسی | بدون دکمه جعلی |
| ۴ | org/RAG پشت flag و فقط با زیرساخت | بدون فعال‌سازی ناقص |
| ۵ | آزمون یکپارچه + تحویل | گزارش تست دقیق |

## محدودیت تأیید

- RLS روی remote production: **تأییدنشده**  
- build کامل / screenshot مرورگر: در گزارش‌های بعدی  
- ادعای «آماده production» ممنوع بدون شواهد

## مالکیت فایل‌ها (جلوگیری از تداخل)

| محدوده | مالک |
|--------|------|
| migrations، proxy، billing mock، auth | Backend |
| chat stream client incomplete، CSS mobile | UI |
| adaptive/followups (انجام‌شده P0-C) | AI — فعلاً تثبیت |
| docs برنامه | راهبر |

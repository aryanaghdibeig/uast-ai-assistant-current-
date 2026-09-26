// proxy.ts

import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


/* =====================================================
   Development and maintenance routes
===================================================== */

/**
 * این مسیرها فقط برای توسعه،
 * تست و عملیات نگهداری ساخته شده‌اند.
 *
 * در محیط Production عمومی
 * نباید مستقیماً قابل دسترسی باشند.
 */
const RESTRICTED_PRODUCTION_ROUTES = [
  "/api/auth-test",

  "/api/embeddings-test",

  "/api/network-diagnostics",

  "/api/openrouter-key-test",

  "/api/semantic-search-test",

  "/api/supabase-test",

  "/api/embeddings/backfill",

  "/api/embeddings/backfill-all",
];


/**
 * بررسی می‌کند که آدرس فعلی
 * یکی از مسیرهای آزمایشی یا مدیریتی است یا خیر.
 */
function isRestrictedProductionRoute(
  pathname:
    string
) {
  return RESTRICTED_PRODUCTION_ROUTES
    .some(
      (
        restrictedPath
      ) =>
        pathname ===
          restrictedPath ||

        pathname.startsWith(
          `${restrictedPath}/`
        )
    );
}


/* =====================================================
   Next.js Proxy
===================================================== */

export async function proxy(
  request:
    NextRequest
) {
  const pathname =
    request.nextUrl
      .pathname;


  /* -------------------------------------------------
     Protect test routes in Production
  -------------------------------------------------- */

  /**
   * در اجرای محلی:
   *
   * NODE_ENV = development
   *
   * بنابراین مسیرهای تست همچنان
   * قابل استفاده خواهند بود.
   *
   * در Vercel Production:
   *
   * NODE_ENV = production
   *
   * بنابراین مسیرهای تست و نگهداری
   * با پاسخ 404 بسته می‌شوند.
   */
  if (
    process.env.NODE_ENV ===
      "production" &&

    isRestrictedProductionRoute(
      pathname
    )
  ) {
    return new NextResponse(
      "Not Found",

      {
        status:
          404,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }


  /* -------------------------------------------------
     Continue normal request
  -------------------------------------------------- */

  let response =
    NextResponse.next({
      request,
    });


  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;


  /**
   * اگر متغیرهای Supabase
   * هنوز تنظیم نشده باشند،
   * درخواست معمولی ادامه پیدا می‌کند.
   */
  if (
    !supabaseUrl ||

    !supabaseAnonKey
  ) {
    return response;
  }


  /* -------------------------------------------------
     Supabase SSR client
  -------------------------------------------------- */

  const supabase =
    createServerClient(
      supabaseUrl,

      supabaseAnonKey,

      {
        cookies: {
          getAll() {
            return request
              .cookies
              .getAll();
          },


          setAll(
            cookiesToSet
          ) {
            /**
             * Cookieهای جدید ابتدا
             * روی Request اعمال می‌شوند.
             */
            cookiesToSet
              .forEach(
                ({
                  name,

                  value,
                }) => {
                  request
                    .cookies
                    .set(
                      name,

                      value
                    );
                }
              );


            /**
             * سپس Response جدید
             * با Request به‌روزشده ساخته می‌شود.
             */
            response =
              NextResponse.next({
                request,
              });


            /**
             * Cookieهای Supabase
             * روی Response نیز ثبت می‌شوند.
             */
            cookiesToSet
              .forEach(
                ({
                  name,

                  value,

                  options,
                }) => {
                  response
                    .cookies
                    .set(
                      name,

                      value,

                      options
                    );
                }
              );
          },
        },
      }
    );


  /**
   * Session کاربر بررسی و در صورت نیاز
   * Refresh می‌شود.
   */
  await supabase
    .auth
    .getUser();


  return response;
}


/* =====================================================
   Proxy matcher
===================================================== */

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
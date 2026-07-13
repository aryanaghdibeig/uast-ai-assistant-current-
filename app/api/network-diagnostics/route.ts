// app/api/network-diagnostics/route.ts

import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


/* =====================================================
   Types
===================================================== */

type IpifyResponse = {
  ip?:
    string;
};


type IpApiResponse = {
  ip?:
    string;

  version?:
    string;

  city?:
    string;

  region?:
    string;

  region_code?:
    string;

  country?:
    string;

  country_name?:
    string;

  country_code?:
    string;

  continent_code?:
    string;

  timezone?:
    string;

  utc_offset?:
    string;

  asn?:
    string;

  org?:
    string;

  error?:
    boolean;

  reason?:
    string;
};


/* =====================================================
   Constants
===================================================== */

const REQUEST_TIMEOUT_MS =
  10000;


/* =====================================================
   Helpers
===================================================== */

async function fetchWithTimeout(
  url:
    string
) {
  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },

      REQUEST_TIMEOUT_MS
    );


  try {
    return await fetch(
      url,

      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "UAST-Intelligent-Assistant-Network-Diagnostics",
        },

        cache:
          "no-store",

        signal:
          controller.signal,
      }
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
}


function normalizeText(
  value:
    unknown
) {
  return typeof value ===
    "string"
      ? value.trim()
      : "";
}


/* =====================================================
   GET /api/network-diagnostics
===================================================== */

export async function GET() {
  try {
    /* -------------------------------------------------
       1. Disable diagnostics in production by default
    -------------------------------------------------- */

    const diagnosticsEnabled =
      process.env.NODE_ENV !==
        "production" ||

      process.env
        .ENABLE_NETWORK_DIAGNOSTICS ===
        "true";


    if (
      !diagnosticsEnabled
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Network diagnostics are disabled in production.",
        },

        {
          status:
            404,
        }
      );
    }


    /* -------------------------------------------------
       2. Authentication
    -------------------------------------------------- */

    const supabase =
      await createSupabaseServerClient();


    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await supabase
        .auth
        .getUser();


    if (
      userError ||

      !user
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Unauthorized",
        },

        {
          status:
            401,
        }
      );
    }


    /* -------------------------------------------------
       3. Detect public server egress IP
    -------------------------------------------------- */

    const ipResponse =
      await fetchWithTimeout(
        "https://api.ipify.org?format=json"
      );


    if (
      !ipResponse.ok
    ) {
      throw new Error(
        `Public IP lookup failed with status ${ipResponse.status}.`
      );
    }


    const ipData =
      await ipResponse
        .json() as
        IpifyResponse;


    const publicIp =
      normalizeText(
        ipData.ip
      );


    if (
      !publicIp
    ) {
      throw new Error(
        "The public-IP service returned an empty IP address."
      );
    }


    /* -------------------------------------------------
       4. Approximate IP geolocation
    -------------------------------------------------- */

    let location:
      IpApiResponse | null =
      null;


    let locationError:
      string | null =
      null;


    try {
      const locationResponse =
        await fetchWithTimeout(
          `https://ipapi.co/${encodeURIComponent(
            publicIp
          )}/json/`
        );


      const locationData =
        await locationResponse
          .json()
          .catch(
            () => ({})
          ) as
          IpApiResponse;


      if (
        !locationResponse.ok
      ) {
        locationError =
          `IP geolocation failed with status ${locationResponse.status}.`;
      } else if (
        locationData.error
      ) {
        locationError =
          locationData.reason ||

          "IP geolocation service returned an error.";
      } else {
        location =
          locationData;
      }
    } catch (
      error
    ) {
      locationError =
        error instanceof
        Error
          ? error.message
          : "Unknown geolocation error";
    }


    /* -------------------------------------------------
       5. Interpret country
    -------------------------------------------------- */

    const countryCode =
      normalizeText(
        location
          ?.country_code
      )
        .toUpperCase();


    const isIranEgress =
      countryCode ===
      "IR";


    const isVercel =
      process.env.VERCEL ===
      "1";


    /* -------------------------------------------------
       6. Final response
    -------------------------------------------------- */

    return NextResponse.json({
      ok:
        true,


      message:
        "Server outbound network information was detected.",


      environment: {
        executionLocation:
          isVercel
            ? "vercel"
            : "local-development",


        nodeEnvironment:
          process.env.NODE_ENV ||

          "unknown",


        vercelEnvironment:
          process.env.VERCEL_ENV ||

          null,


        vercelRegion:
          process.env.VERCEL_REGION ||

          null,
      },


      network: {
        publicIp,


        countryCode:
          countryCode ||

          null,


        countryName:
          normalizeText(
            location
              ?.country_name
          ) ||

          null,


        region:
          normalizeText(
            location
              ?.region
          ) ||

          null,


        city:
          normalizeText(
            location
              ?.city
          ) ||

          null,


        timezone:
          normalizeText(
            location
              ?.timezone
          ) ||

          null,


        asn:
          normalizeText(
            location
              ?.asn
          ) ||

          null,


        organization:
          normalizeText(
            location
              ?.org
          ) ||

          null,


        isIranEgress,


        geolocationAvailable:
          Boolean(
            location
          ),


        geolocationError:
          locationError,
      },


      interpretation:
        isIranEgress
          ? "درخواست‌های سمت سرور Next.js در حال حاضر با یک IP منتسب به ایران از شبکه خارج می‌شوند."
          : countryCode
            ? `درخواست‌های سمت سرور Next.js با IP منتسب به کشور ${countryCode} از شبکه خارج می‌شوند.`
            : "IP عمومی سرور شناسایی شد، اما کشور آن قابل تشخیص نبود.",


      note:
        "موقعیت جغرافیایی IP تقریبی است و لزوماً محل فیزیکی دقیق دستگاه یا سرور را نشان نمی‌دهد.",
    });
  } catch (
    error
  ) {
    console.error(
      "Network diagnostics error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Network diagnostics failed.",

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown error",
      },

      {
        status:
          500,
      }
    );
  }
}
// app/api/embeddings-test/route.ts

import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  cosineSimilarity,
  createEmbedding,
  getEmbeddingConfiguration,
} from "@/lib/assistant/embeddings";


export const runtime =
  "nodejs";


export async function GET() {
  try {
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


    const firstText =
      "تدوین برنامه اجرایی برای توسعه پژوهش سازمان";


    const secondText =
      "برای گسترش فعالیت‌های پژوهشی سازمان یک برنامه عملیاتی تهیه کن";


    const firstEmbedding =
      await createEmbedding(
        firstText,

        {
          inputType:
            "search_document",
        }
      );


    const secondEmbedding =
      await createEmbedding(
        secondText,

        {
          inputType:
            "search_query",
        }
      );


    const similarity =
      cosineSimilarity(
        firstEmbedding
          .embedding,

        secondEmbedding
          .embedding
      );


    return NextResponse.json({
      ok:
        true,

      message:
        "Embedding engine is working.",

      configuration:
        getEmbeddingConfiguration(),

      test: {
        firstText,

        secondText,

        source:
          firstEmbedding
            .source,

        model:
          firstEmbedding
            .model,

        dimensions:
          firstEmbedding
            .dimensions,

        similarity:
          Number(
            similarity.toFixed(
              6
            )
          ),

        firstVectorPreview:
          firstEmbedding
            .embedding
            .slice(
              0,

              8
            ),

        secondVectorPreview:
          secondEmbedding
            .embedding
            .slice(
              0,

              8
            ),

        firstContentHash:
          firstEmbedding
            .contentHash,

        secondContentHash:
          secondEmbedding
            .contentHash,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Embedding test error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Embedding test failed.",

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
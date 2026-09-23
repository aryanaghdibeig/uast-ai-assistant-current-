// app/api/knowledge/org/reindex/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  getOrgKnowledgeSourceDir,
  rebuildOrgKnowledgeIndex,
} from "@/lib/assistant/orgKnowledge";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;


function isReindexAllowed() {
  if (process.env.NODE_ENV === "production") {
    return process.env.ALLOW_ORG_KNOWLEDGE_REINDEX?.trim().toLowerCase() === "true";
  }

  return process.env.ALLOW_ORG_KNOWLEDGE_REINDEX?.trim().toLowerCase() !== "false";
}


export async function POST(_request: NextRequest) {
  try {
    if (!isReindexAllowed()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Org knowledge reindex is disabled.",
        },
        { status: 403 },
      );
    }

    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const index = await rebuildOrgKnowledgeIndex();

    return NextResponse.json({
      ok: true,
      sourceDir: getOrgKnowledgeSourceDir(),
      builtAt: index.builtAt,
      model: index.model,
      dimensions: index.dimensions,
      documents: index.documents,
      chunkCount: index.chunks.length,
    });
  } catch (error) {
    console.error("Org knowledge reindex error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Org knowledge reindex failed.",
      },
      { status: 500 },
    );
  }
}


export async function GET() {
  try {
    if (!isReindexAllowed()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Org knowledge reindex is disabled.",
        },
        { status: 403 },
      );
    }

    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { loadOrgKnowledgeIndex, getOrgKnowledgeSourceDir } = await import(
      "@/lib/assistant/orgKnowledge"
    );

    const index = await loadOrgKnowledgeIndex(true);

    return NextResponse.json({
      ok: true,
      sourceDir: getOrgKnowledgeSourceDir(),
      indexed: Boolean(index),
      builtAt: index?.builtAt ?? null,
      model: index?.model ?? null,
      documents: index?.documents ?? [],
      chunkCount: index?.chunks.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not read org knowledge index.",
      },
      { status: 500 },
    );
  }
}

// app/api/conversations/[conversationId]/model/route.ts

import {
  NextRequest,
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

type ModelSelectionMode =
  | "auto"
  | "preset"
  | "advanced";


type ModelPreferences =
  Record<
    string,
    unknown
  >;


type ModelSelectionRecord = {
  id:
    string;

  title:
    string;

  selected_model:
    string;

  model_selection_mode:
    ModelSelectionMode;

  model_preferences:
    ModelPreferences | null;

  model_updated_at:
    string | null;
};


type RouteContext = {
  params:
    Promise<{
      conversationId:
        string;
    }>;
};


/* =====================================================
   Constants
===================================================== */

const ALLOWED_SELECTION_MODES =
  new Set<
    ModelSelectionMode
  >([
    "auto",

    "preset",

    "advanced",
  ]);


const DEFAULT_MODEL =
  "openrouter/auto";


const DEFAULT_SELECTION_MODE:
  ModelSelectionMode =
  "auto";


const MAX_MODEL_ID_LENGTH =
  250;


const MAX_PREFERENCES_SIZE =
  20_000;


/* =====================================================
   Validation helpers
===================================================== */

function isValidUuid(
  value:
    string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


function normalizeModelId(
  value:
    unknown
) {
  return typeof value ===
    "string"
      ? value.trim()
      : "";
}


/**
 * شناسه‌های معمول OpenRouter
 * به این شکل هستند:
 *
 * openrouter/auto
 *
 * openrouter/free
 *
 * anthropic/claude-...
 *
 * openai/gpt-...
 */
function isValidModelId(
  value:
    string
) {
  if (
    !value ||

    value.length >
      MAX_MODEL_ID_LENGTH
  ) {
    return false;
  }


  if (
    /\s/.test(
      value
    )
  ) {
    return false;
  }


  return /^[a-z0-9._:-]+(?:\/[a-z0-9._:-]+)+$/i.test(
    value
  );
}


function isValidSelectionMode(
  value:
    unknown
):
  value is
    ModelSelectionMode {
  return (
    typeof value ===
      "string" &&

    ALLOWED_SELECTION_MODES.has(
      value as
        ModelSelectionMode
    )
  );
}


function isPlainObject(
  value:
    unknown
):
  value is
    ModelPreferences {
  return (
    typeof value ===
      "object" &&

    value !==
      null &&

    !Array.isArray(
      value
    )
  );
}


function getPreferencesSize(
  value:
    ModelPreferences
) {
  try {
    return JSON.stringify(
      value
    ).length;
  } catch {
    return Number
      .POSITIVE_INFINITY;
  }
}


function normalizePreferences(
  value:
    unknown
):
  ModelPreferences {
  if (
    !isPlainObject(
      value
    )
  ) {
    return {};
  }


  return value;
}


/* =====================================================
   Response normalization
===================================================== */

function normalizeSelectionResponse(
  record:
    ModelSelectionRecord
) {
  return {
    conversationId:
      record.id,


    title:
      record.title,


    selectedModel:
      record
        .selected_model ||

      DEFAULT_MODEL,


    modelSelectionMode:
      record
        .model_selection_mode ||

      DEFAULT_SELECTION_MODE,


    modelPreferences:
      normalizePreferences(
        record
          .model_preferences
      ),


    modelUpdatedAt:
      record
        .model_updated_at,
  };
}


/* =====================================================
   GET
   Read current model selection
===================================================== */

export async function GET(
  _request:
    NextRequest,

  context:
    RouteContext
) {
  try {
    /* -------------------------------------------------
       1. Conversation ID
    -------------------------------------------------- */

    const {
      conversationId,
    } =
      await context.params;


    if (
      !isValidUuid(
        conversationId
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Invalid conversation ID.",
        },

        {
          status:
            400,
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
       3. Load conversation selection
    -------------------------------------------------- */

    const {
      data,

      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select(
          `
          id,
          title,
          selected_model,
          model_selection_mode,
          model_preferences,
          model_updated_at
          `
        )
        .eq(
          "id",

          conversationId
        )
        .eq(
          "user_id",

          user.id
        )
        .maybeSingle();


    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }


    if (
      !data
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation was not found.",
        },

        {
          status:
            404,
        }
      );
    }


    const selection =
      normalizeSelectionResponse(
        data as
          ModelSelectionRecord
      );


    /* -------------------------------------------------
       4. Response
    -------------------------------------------------- */

    return NextResponse.json({
      ok:
        true,


      message:
        "Conversation model selection was loaded.",


      selection,
    });
  } catch (
    error
  ) {
    console.error(
      "Load conversation model error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not load the conversation model.",

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


/* =====================================================
   PATCH
   Save selected model
===================================================== */

export async function PATCH(
  request:
    NextRequest,

  context:
    RouteContext
) {
  try {
    /* -------------------------------------------------
       1. Conversation ID
    -------------------------------------------------- */

    const {
      conversationId,
    } =
      await context.params;


    if (
      !isValidUuid(
        conversationId
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Invalid conversation ID.",
        },

        {
          status:
            400,
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
       3. Read request body
    -------------------------------------------------- */

    const body =
      await request
        .json()
        .catch(
          () => null
        );


    if (
      !isPlainObject(
        body
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Request body must be a valid JSON object.",
        },

        {
          status:
            400,
        }
      );
    }


    /* -------------------------------------------------
       4. Validate selected model
    -------------------------------------------------- */

    const selectedModel =
      normalizeModelId(
        body.selectedModel
      );


    if (
      !isValidModelId(
        selectedModel
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "The selected model ID is invalid.",
        },

        {
          status:
            400,
        }
      );
    }


    /* -------------------------------------------------
       5. Validate selection mode
    -------------------------------------------------- */

    const requestedMode =
      body
        .modelSelectionMode;


    if (
      !isValidSelectionMode(
        requestedMode
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "modelSelectionMode must be auto, preset, or advanced.",
        },

        {
          status:
            400,
        }
      );
    }


    /* -------------------------------------------------
       6. Validate model preferences
    -------------------------------------------------- */

    const modelPreferences =
      normalizePreferences(
        body
          .modelPreferences
      );


    if (
      getPreferencesSize(
        modelPreferences
      ) >
      MAX_PREFERENCES_SIZE
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Model preferences are too large.",
        },

        {
          status:
            400,
        }
      );
    }


    /* -------------------------------------------------
       7. Update conversation
    -------------------------------------------------- */

    const currentTime =
      new Date()
        .toISOString();


    const {
      data,

      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .update({
          selected_model:
            selectedModel,


          model_selection_mode:
            requestedMode,


          model_preferences:
            modelPreferences,


          model_updated_at:
            currentTime,


          updated_at:
            currentTime,
        })
        .eq(
          "id",

          conversationId
        )
        .eq(
          "user_id",

          user.id
        )
        .select(
          `
          id,
          title,
          selected_model,
          model_selection_mode,
          model_preferences,
          model_updated_at
          `
        )
        .maybeSingle();


    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }


    if (
      !data
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation was not found.",
        },

        {
          status:
            404,
        }
      );
    }


    const selection =
      normalizeSelectionResponse(
        data as
          ModelSelectionRecord
      );


    /* -------------------------------------------------
       8. Response
    -------------------------------------------------- */

    return NextResponse.json({
      ok:
        true,


      message:
        "The conversation model was saved successfully.",


      selection,
    });
  } catch (
    error
  ) {
    console.error(
      "Save conversation model error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not save the conversation model.",

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
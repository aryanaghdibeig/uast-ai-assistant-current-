    -- Drop existing foreign keys that cause conflicts
    ALTER TABLE IF EXISTS "public"."conversation_branches" DROP CONSTRAINT IF EXISTS "conversation_branches_conversation_id_fkey";
    ALTER TABLE IF EXISTS "public"."conversation_memory_items" DROP CONSTRAINT IF EXISTS "conversation_memory_items_conversation_id_fkey";
    ALTER TABLE IF EXISTS "public"."messages" DROP CONSTRAINT IF EXISTS "messages_conversation_id_fkey";

    -- Add the foreign keys again
    ALTER TABLE ONLY "public"."conversation_branches"
        ADD CONSTRAINT "conversation_branches_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;

    ALTER TABLE ONLY "public"."conversation_memory_items"
        ADD CONSTRAINT "conversation_memory_items_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;

    ALTER TABLE ONLY "public"."messages"
        ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;

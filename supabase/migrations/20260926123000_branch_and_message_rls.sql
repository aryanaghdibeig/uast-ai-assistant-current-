-- Hosted RLS was enabled on conversation_branches with no policies,
-- so chat could not read or create the active branch and every reply failed.
-- Local Docker still had the older policies, which is why only the domain broke.

DROP POLICY IF EXISTS "Users can view their own branches" ON public.conversation_branches;
DROP POLICY IF EXISTS "Users can create their own branches" ON public.conversation_branches;
DROP POLICY IF EXISTS "Users can update their own branches" ON public.conversation_branches;
DROP POLICY IF EXISTS "Users can delete their own branches" ON public.conversation_branches;

CREATE POLICY "Users can view their own branches"
  ON public.conversation_branches
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = conversation_branches.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own branches"
  ON public.conversation_branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = conversation_branches.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own branches"
  ON public.conversation_branches
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = conversation_branches.conversation_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = conversation_branches.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own branches"
  ON public.conversation_branches
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = conversation_branches.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

CREATE POLICY "Users can view their own messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

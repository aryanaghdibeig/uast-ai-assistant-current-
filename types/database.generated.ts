export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      conversation_branches: {
        Row: {
          branch_order: number
          conversation_id: string
          created_at: string
          forked_from_message_id: string | null
          id: string
          parent_branch_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_order?: number
          conversation_id: string
          created_at?: string
          forked_from_message_id?: string | null
          id?: string
          parent_branch_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_order?: number
          conversation_id?: string
          created_at?: string
          forked_from_message_id?: string | null
          id?: string
          parent_branch_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_branches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_branches_forked_from_message_id_fkey"
            columns: ["forked_from_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "conversation_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_memory_items: {
        Row: {
          confidence: number
          content: string
          conversation_id: string
          created_at: string
          first_seen_at: string
          id: string
          importance: number
          is_pinned: boolean
          last_confirmed_at: string
          memory_key: string
          memory_type: string
          source_message_ids: string[]
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
          user_id: string
          value_json: Json
        }
        Insert: {
          confidence?: number
          content: string
          conversation_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          importance?: number
          is_pinned?: boolean
          last_confirmed_at?: string
          memory_key: string
          memory_type: string
          source_message_ids?: string[]
          status?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          value_json?: Json
        }
        Update: {
          confidence?: number
          content?: string
          conversation_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          importance?: number
          is_pinned?: boolean
          last_confirmed_at?: string
          memory_key?: string
          memory_type?: string
          source_message_ids?: string[]
          status?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "conversation_memory_items_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_memory_items_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "conversation_memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          active_branch_id: string | null
          assistant_mode: string
          behavior_profile: Json
          behavior_profile_updated_at: string | null
          conversation_summary: string
          created_at: string | null
          id: string
          memory_enabled: boolean
          model_preferences: Json
          model_selection_mode: string
          model_updated_at: string | null
          selected_model: string
          summary_message_count: number
          summary_updated_at: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_branch_id?: string | null
          assistant_mode?: string
          behavior_profile?: Json
          behavior_profile_updated_at?: string | null
          conversation_summary?: string
          created_at?: string | null
          id?: string
          memory_enabled?: boolean
          model_preferences?: Json
          model_selection_mode?: string
          model_updated_at?: string | null
          selected_model?: string
          summary_message_count?: number
          summary_updated_at?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_branch_id?: string | null
          assistant_mode?: string
          behavior_profile?: Json
          behavior_profile_updated_at?: string | null
          conversation_summary?: string
          created_at?: string | null
          id?: string
          memory_enabled?: boolean
          model_preferences?: Json
          model_selection_mode?: string
          model_updated_at?: string | null
          selected_model?: string
          summary_message_count?: number
          summary_updated_at?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_active_branch_id_fkey"
            columns: ["active_branch_id"]
            isOneToOne: false
            referencedRelation: "conversation_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          branch_id: string | null
          content: string
          conversation_id: string
          created_at: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_content_hash: string | null
          embedding_dimensions: number | null
          embedding_model: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_content_hash?: string | null
          embedding_dimensions?: number | null
          embedding_model?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_content_hash?: string | null
          embedding_dimensions?: number | null
          embedding_model?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "conversation_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          allowed_model_tier: string
          code: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          monthly_token_limit: number
          price_amount: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          allowed_model_tier?: string
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean
          monthly_token_limit: number
          price_amount?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          allowed_model_tier?: string
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          monthly_token_limit?: number
          price_amount?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_ai_credits: {
        Row: {
          access_mode_preference: string
          allowed_model_tier: string
          created_at: string
          last_access_mode_change_at: string | null
          last_auto_downgrade_at: string | null
          monthly_period_started_at: string | null
          monthly_token_limit: number
          monthly_tokens_used: number
          payment_provider: string | null
          payment_reference_id: string | null
          plan: string
          subscription_active: boolean
          subscription_expires_at: string | null
          subscription_note: string | null
          subscription_started_at: string | null
          trial_token_limit: number
          trial_tokens_used: number
          updated_at: string
          user_id: string
          warning_shown: boolean
        }
        Insert: {
          access_mode_preference?: string
          allowed_model_tier?: string
          created_at?: string
          last_access_mode_change_at?: string | null
          last_auto_downgrade_at?: string | null
          monthly_period_started_at?: string | null
          monthly_token_limit?: number
          monthly_tokens_used?: number
          payment_provider?: string | null
          payment_reference_id?: string | null
          plan?: string
          subscription_active?: boolean
          subscription_expires_at?: string | null
          subscription_note?: string | null
          subscription_started_at?: string | null
          trial_token_limit?: number
          trial_tokens_used?: number
          updated_at?: string
          user_id: string
          warning_shown?: boolean
        }
        Update: {
          access_mode_preference?: string
          allowed_model_tier?: string
          created_at?: string
          last_access_mode_change_at?: string | null
          last_auto_downgrade_at?: string | null
          monthly_period_started_at?: string | null
          monthly_token_limit?: number
          monthly_tokens_used?: number
          payment_provider?: string | null
          payment_reference_id?: string | null
          plan?: string
          subscription_active?: boolean
          subscription_expires_at?: string | null
          subscription_note?: string | null
          subscription_started_at?: string | null
          trial_token_limit?: number
          trial_tokens_used?: number
          updated_at?: string
          user_id?: string
          warning_shown?: boolean
        }
        Relationships: []
      }
      user_subscription_payments: {
        Row: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          plan: string
          provider: string | null
          provider_reference_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan?: string
          provider?: string | null
          provider_reference_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan?: string
          provider?: string | null
          provider_reference_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_request_idempotency: {
        Args: {
          p_client_key: string
          p_lease_seconds?: number
          p_operation: string
          p_payload_hash: string
          p_user_id: string
        }
        Returns: {
          error_code: string | null
          outcome: string
          record_id: string
          result_ref: Record<string, unknown> | null
          status: string
          tokens_debited: number
          usage_recorded: boolean
        }[]
      }
      complete_request_idempotency: {
        Args: {
          p_record_id: string
          p_result_ref: Record<string, unknown>
          p_tokens_debited?: number
          p_usage_recorded?: boolean
        }
        Returns: Record<string, unknown>
      }
      fail_request_idempotency: {
        Args: {
          p_error_code?: string
          p_record_id: string
        }
        Returns: Record<string, unknown>
      }
      mark_request_idempotency_usage: {
        Args: {
          p_record_id: string
          p_tokens_debited: number
        }
        Returns: Record<string, unknown>
      }
      increment_user_ai_credit_usage: {
        Args: {
          p_bucket: string
          p_tokens: number
          p_user_id: string
        }
        Returns: {
          access_mode_preference: string | null
          created_at: string | null
          monthly_token_limit: number
          monthly_tokens_used: number
          subscription_expires_at: string | null
          subscription_plan_code: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          trial_token_limit: number
          trial_tokens_used: number
          updated_at: string | null
          upgrade_warning_shown_at: string | null
          user_id: string
        }
      }
      match_conversation_messages: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          target_conversation_id: string
          target_user_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          role: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const


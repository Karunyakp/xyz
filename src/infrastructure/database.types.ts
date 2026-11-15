// Generated from migrations using PostgreSQL information_schema. Do not hand edit.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface Database {
  public: {
    Tables: {
      academic_terms: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          academic_year: string;
          starts_on: string;
          ends_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          academic_year: string;
          starts_on: string;
          ends_on: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['academic_terms']['Insert']>;
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string | null;
          title: string;
          body: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id?: string | null;
          title: string;
          body: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>;
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          reviewer_id: string;
          decision: string;
          comments: string;
          version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          reviewer_id: string;
          decision: string;
          comments?: string;
          version: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          registration_id: string;
          user_id: string;
          checked_in_by: string;
          checked_in_at: string;
          method: string;
          note: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          registration_id: string;
          user_id: string;
          checked_in_by: string;
          checked_in_at?: string;
          method: string;
          note?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          institution_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        Relationships: [];
      };
      budget_entries: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          kind: string;
          category: string;
          description: string;
          amount: number;
          status: string;
          receipt_path: string | null;
          created_by: string;
          reviewed_by: string | null;
          review_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          kind: string;
          category: string;
          description: string;
          amount: number;
          status?: string;
          receipt_path?: string | null;
          created_by: string;
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['budget_entries']['Insert']>;
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          registration_id: string;
          recipient_name: string;
          event_title: string;
          verification_code: string;
          issued_by: string;
          issued_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          registration_id: string;
          recipient_name: string;
          event_title: string;
          verification_code?: string;
          issued_by: string;
          issued_at?: string;
          revoked_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['certificates']['Insert']>;
        Relationships: [];
      };
      club_memberships: {
        Row: {
          id: string;
          institution_id: string;
          club_id: string;
          user_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          club_id: string;
          user_id: string;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['club_memberships']['Insert']>;
        Relationships: [];
      };
      clubs: {
        Row: {
          id: string;
          institution_id: string;
          department_id: string | null;
          name: string;
          description: string;
          logo_path: string | null;
          accepting_members: boolean;
        };
        Insert: {
          id?: string;
          institution_id: string;
          department_id?: string | null;
          name: string;
          description?: string;
          logo_path?: string | null;
          accepting_members?: boolean;
        };
        Update: Partial<Database['public']['Tables']['clubs']['Insert']>;
        Relationships: [];
      };
      completion_reports: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          summary: string;
          outcomes: string;
          status: string;
          submitted_by: string;
          reviewed_by: string | null;
          comments: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          summary: string;
          outcomes: string;
          status?: string;
          submitted_by: string;
          reviewed_by?: string | null;
          comments?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['completion_reports']['Insert']>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          code: string;
          description: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          code: string;
          description?: string;
        };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          institution_id: string;
          department_id: string | null;
          club_id: string | null;
          created_by: string;
          title: string;
          description: string;
          objectives: string;
          category: string;
          event_type: string;
          mode: string;
          status: string;
          starts_at: string;
          ends_at: string;
          registration_deadline: string;
          timezone: string;
          venue_id: string | null;
          online_url: string;
          capacity: number;
          waitlist_enabled: boolean;
          manual_approval: boolean;
          is_team: boolean;
          team_min: number;
          team_max: number;
          allow_external: boolean;
          eligible_departments: string[];
          eligible_years: number[];
          questions: Json;
          agenda: Json;
          faqs: Json;
          rules: string;
          instructions: string;
          contact: string;
          cover_path: string | null;
          attachments: Json;
          estimated_budget: number;
          fee: number;
          featured: boolean;
          created_at: string;
          updated_at: string;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          institution_id: string;
          department_id?: string | null;
          club_id?: string | null;
          created_by: string;
          title: string;
          description?: string;
          objectives?: string;
          category?: string;
          event_type?: string;
          mode?: string;
          status?: string;
          starts_at: string;
          ends_at: string;
          registration_deadline: string;
          timezone?: string;
          venue_id?: string | null;
          online_url?: string;
          capacity: number;
          waitlist_enabled?: boolean;
          manual_approval?: boolean;
          is_team?: boolean;
          team_min?: number;
          team_max?: number;
          allow_external?: boolean;
          eligible_departments?: string[];
          eligible_years?: number[];
          questions?: Json;
          agenda?: Json;
          faqs?: Json;
          rules?: string;
          instructions?: string;
          contact?: string;
          cover_path?: string | null;
          attachments?: Json;
          estimated_budget?: number;
          fee?: number;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          rating: number;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          rating: number;
          comment?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['feedback']['Insert']>;
        Relationships: [];
      };
      global_categories: {
        Row: {
          id: string;
          name: string;
          enabled: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          enabled?: boolean;
        };
        Update: Partial<Database['public']['Tables']['global_categories']['Insert']>;
        Relationships: [];
      };
      institutions: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_path: string | null;
          status: string;
          plan: string;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_path?: string | null;
          status?: string;
          plan?: string;
          settings?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['institutions']['Insert']>;
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          institution_id: string;
          email: string;
          role: string;
          scope_type: string;
          scope_id: string;
          department_id: string | null;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          email: string;
          role: string;
          scope_type?: string;
          scope_id: string;
          department_id?: string | null;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          institution_id: string;
          user_id: string;
          department_id: string | null;
          kind: string;
          status: string;
          student_number: string | null;
          academic_year: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          user_id: string;
          department_id?: string | null;
          kind?: string;
          status?: string;
          student_number?: string | null;
          academic_year?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memberships']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          institution_id: string;
          user_id: string;
          title: string;
          body: string;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          user_id: string;
          title: string;
          body?: string;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      permissions: {
        Row: {
          key: string;
        };
        Insert: {
          key: string;
        };
        Update: Partial<Database['public']['Tables']['permissions']['Insert']>;
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
        };
        Insert: {
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['platform_admins']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_path: string | null;
          interests: string[];
          skills: string[];
          bio: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_path?: string | null;
          interests?: string[];
          skills?: string[];
          bio?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          team_id: string | null;
          status: string;
          registration_number: string;
          answers: Json;
          invitation_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          team_id?: string | null;
          status: string;
          registration_number?: string;
          answers?: Json;
          invitation_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['registrations']['Insert']>;
        Relationships: [];
      };
      resource_allocations: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          resource_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          resource_id: string;
          quantity: number;
        };
        Update: Partial<Database['public']['Tables']['resource_allocations']['Insert']>;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          quantity: number;
          description: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          quantity: number;
          description?: string;
        };
        Update: Partial<Database['public']['Tables']['resources']['Insert']>;
        Relationships: [];
      };
      role_assignments: {
        Row: {
          id: string;
          institution_id: string;
          user_id: string;
          role: string;
          scope_type: string;
          scope_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          user_id: string;
          role: string;
          scope_type: string;
          scope_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['role_assignments']['Insert']>;
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role: string;
          permission: string;
        };
        Insert: {
          role: string;
          permission: string;
        };
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>;
        Relationships: [];
      };
      roles: {
        Row: {
          key: string;
          label: string;
          scopes: string[];
        };
        Insert: {
          key: string;
          label: string;
          scopes: string[];
        };
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
        Relationships: [];
      };
      saved_events: {
        Row: {
          institution_id: string;
          event_id: string;
          user_id: string;
        };
        Insert: {
          institution_id: string;
          event_id: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['saved_events']['Insert']>;
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          features: Json;
          active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          features?: Json;
          active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['subscription_plans']['Insert']>;
        Relationships: [];
      };
      support_requests: {
        Row: {
          id: string;
          institution_id: string;
          created_by: string;
          subject: string;
          body: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          created_by: string;
          subject: string;
          body: string;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['support_requests']['Insert']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          title: string;
          assigned_to: string | null;
          due_at: string | null;
          status: string;
          notes: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          title: string;
          assigned_to?: string | null;
          due_at?: string | null;
          status?: string;
          notes?: string;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          name: string;
          leader_id: string;
          join_code: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          name: string;
          leader_id: string;
          join_code?: string;
        };
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
        Relationships: [];
      };
      venue_bookings: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          venue_id: string;
          starts_at: string;
          ends_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          venue_id: string;
          starts_at: string;
          ends_at: string;
          status?: string;
        };
        Update: Partial<Database['public']['Tables']['venue_bookings']['Insert']>;
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          building: string;
          room: string;
          floor: string;
          capacity: number;
          equipment: string[];
          restrictions: string;
          maintenance: boolean;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          building?: string;
          room?: string;
          floor?: string;
          capacity: number;
          equipment?: string[];
          restrictions?: string;
          maintenance?: boolean;
        };
        Update: Partial<Database['public']['Tables']['venues']['Insert']>;
        Relationships: [];
      };
      volunteers: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          status: string;
          duty: string;
          starts_at: string | null;
          ends_at: string | null;
          attended: boolean;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          user_id: string;
          status?: string;
          duty?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          attended?: boolean;
        };
        Update: Partial<Database['public']['Tables']['volunteers']['Insert']>;
        Relationships: [];
      };
      workflow_history: {
        Row: {
          id: string;
          institution_id: string;
          event_id: string;
          previous_status: string | null;
          new_status: string;
          actor_id: string | null;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          event_id: string;
          previous_status?: string | null;
          new_status: string;
          actor_id?: string | null;
          reason?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workflow_history']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_invitations: { Args: Record<string, Json | undefined>; Returns: Json };
      allocate_resource: { Args: Record<string, Json | undefined>; Returns: Json };
      analytics: { Args: Record<string, Json | undefined>; Returns: Json };
      assign_coordinator: { Args: Record<string, Json | undefined>; Returns: Json };
      check_in: { Args: Record<string, Json | undefined>; Returns: Json };
      claim_notification_emails: { Args: Record<string, Json | undefined>; Returns: Json };
      club_action: { Args: Record<string, Json | undefined>; Returns: Json };
      completion_report: { Args: Record<string, Json | undefined>; Returns: Json };
      coordinators: { Args: Record<string, Json | undefined>; Returns: Json };
      correct_attendance: { Args: Record<string, Json | undefined>; Returns: Json };
      create_invitation: { Args: Record<string, Json | undefined>; Returns: Json };
      create_support: { Args: Record<string, Json | undefined>; Returns: Json };
      eligible_event_ids: { Args: Record<string, Json | undefined>; Returns: Json };
      event_counts: { Args: Record<string, Json | undefined>; Returns: Json };
      finish_notification_email: { Args: Record<string, Json | undefined>; Returns: Json };
      institution_users: { Args: Record<string, Json | undefined>; Returns: Json };
      issue_certificates: { Args: Record<string, Json | undefined>; Returns: Json };
      issue_ticket: { Args: Record<string, Json | undefined>; Returns: Json };
      join_institution: { Args: Record<string, Json | undefined>; Returns: Json };
      manage_member: { Args: Record<string, Json | undefined>; Returns: Json };
      member_options: { Args: Record<string, Json | undefined>; Returns: Json };
      my_context: { Args: Record<string, Json | undefined>; Returns: Json };
      participant_directory: { Args: Record<string, Json | undefined>; Returns: Json };
      platform_action: { Args: Record<string, Json | undefined>; Returns: Json };
      platform_metrics: { Args: Record<string, Json | undefined>; Returns: Json };
      process_waitlist: { Args: Record<string, Json | undefined>; Returns: Json };
      publish_announcement: { Args: Record<string, Json | undefined>; Returns: Json };
      read_notification: { Args: Record<string, Json | undefined>; Returns: Json };
      register_event: { Args: Record<string, Json | undefined>; Returns: Json };
      registration_action: { Args: Record<string, Json | undefined>; Returns: Json };
      reschedule_event: { Args: Record<string, Json | undefined>; Returns: Json };
      review_budget: { Args: Record<string, Json | undefined>; Returns: Json };
      review_comment: { Args: Record<string, Json | undefined>; Returns: Json };
      revoke_certificate: { Args: Record<string, Json | undefined>; Returns: Json };
      run_waitlist_jobs: { Args: Record<string, Json | undefined>; Returns: Json };
      save_academic_term: { Args: Record<string, Json | undefined>; Returns: Json };
      save_budget: { Args: Record<string, Json | undefined>; Returns: Json };
      save_directory: { Args: Record<string, Json | undefined>; Returns: Json };
      save_event: { Args: Record<string, Json | undefined>; Returns: Json };
      save_settings: { Args: Record<string, Json | undefined>; Returns: Json };
      save_task: { Args: Record<string, Json | undefined>; Returns: Json };
      set_branding: { Args: Record<string, Json | undefined>; Returns: Json };
      submit_feedback: { Args: Record<string, Json | undefined>; Returns: Json };
      toggle_saved: { Args: Record<string, Json | undefined>; Returns: Json };
      transition_event: { Args: Record<string, Json | undefined>; Returns: Json };
      update_profile: { Args: Record<string, Json | undefined>; Returns: Json };
      verify_certificate: { Args: Record<string, Json | undefined>; Returns: Json };
      volunteer_action: { Args: Record<string, Json | undefined>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

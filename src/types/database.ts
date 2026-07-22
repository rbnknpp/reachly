// Spiegelt das bereits deployte Supabase-Schema (Backend-Repo). Nur konsumieren, nie hier aendern –
// Schemaaenderungen passieren ausschliesslich per Migration im Backend-Repo.

export type UserRole = "agency" | "client";

export type ConversationChannel = "whatsapp" | "sms" | "email";
export type ConversationStatus = "ai_active" | "human_handoff" | "closed";

export type MessageDirection = "inbound" | "outbound";
export type MessageSender = "customer" | "ai" | "human" | "system";

export type MissedCallStatus = "detected" | "sms_sent" | "sms_failed" | "converted";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type ReviewRequestStatus = "scheduled" | "sent" | "failed" | "skipped";

export interface Profile {
  id: string;
  role: UserRole;
  client_id: string | null;
  display_name: string | null;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export interface ClientSettings {
  client_id: string;
  business_phone: string | null;
  sms_sender_number: string | null;
  wa_phone_number_id: string | null;
  wa_business_number: string | null;
  calcom_event_type_id: string | null;
  calcom_username: string | null;
  timezone: string;
  google_review_url: string | null;
  review_delay_hours: number;
  business_description: string | null;
  ai_tone: string | null;
  ai_enabled: boolean;
  missed_call_sms_text: string | null;
  widget_accent_color: string;
  widget_position: "left" | "right";
  widget_greeting: string;
  widget_whatsapp_prefill_text: string;
  widget_action_whatsapp: boolean;
  widget_action_callback: boolean;
  widget_action_booking: boolean;
  widget_social_instagram_url: string | null;
  widget_action_instagram: boolean;
  widget_social_facebook_url: string | null;
  widget_action_facebook: boolean;
  widget_social_tiktok_url: string | null;
  widget_action_tiktok: boolean;
}

export interface EndCustomer {
  id: string;
  client_id: string;
  phone: string;
  wa_id: string | null;
  name: string | null;
}

export interface Conversation {
  id: string;
  client_id: string;
  end_customer_id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  last_inbound_at: string | null;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender: MessageSender;
  body: string;
  wa_message_id: string | null;
  created_at: string;
}

export interface MissedCall {
  id: string;
  client_id: string;
  caller_phone: string;
  status: MissedCallStatus;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  end_customer_id: string;
  conversation_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
}

export interface ReviewRequest {
  id: string;
  client_id: string;
  appointment_id: string;
  scheduled_for: string;
  status: ReviewRequestStatus;
  sent_at: string | null;
}

// Praktisch fuer UI-Joins (z.B. Inbox-Liste mit Kundenname)
export interface ConversationWithCustomer extends Conversation {
  end_customers: Pick<EndCustomer, "id" | "name" | "phone"> | null;
}

export interface AppointmentWithCustomer extends Appointment {
  end_customers: Pick<EndCustomer, "id" | "name" | "phone"> | null;
}

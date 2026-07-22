export interface WidgetActionFlags {
  whatsapp: boolean;
  callback: boolean;
  booking: boolean;
}

export interface WidgetSocialLinks {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

export interface WidgetConfig {
  key: string;
  accentColor: string;
  position: "left" | "right";
  greeting: string;
  actions: WidgetActionFlags;
  whatsappNumber: string | null;
  whatsappPrefillText: string | null;
  social: WidgetSocialLinks;
}

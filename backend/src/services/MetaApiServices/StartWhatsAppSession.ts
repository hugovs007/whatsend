import WhatsApp from "../../models/Whatsapp";

export const StartWhatsAppSession = async (
  whatsapp: WhatsApp
): Promise<void> => {
  // TODO: Meta API has no "sessions", but we might need to initialize webhooks
  console.log("StartWhatsAppSession: Meta Cloud API integration dummy started");
};

export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  console.log("StartAllWhatsAppsSessions: Meta Cloud API integration dummy started");
};

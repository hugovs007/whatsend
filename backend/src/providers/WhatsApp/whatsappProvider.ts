import Whatsapp from "../../models/Whatsapp";

export const whatsappProvider = {
  sendMessage: async (ticket: any, body: any, quotedMsg?: any): Promise<void> => {
    console.log("Meta API Dummy: sendMessage");
  },
  sendSeen: async (whatsappId: number, number: string): Promise<void> => {
    console.log("Meta API Dummy: sendSeen");
  },
  removeSession: (whatsappId: number): void => {
    console.log("Meta API Dummy: removeSession", whatsappId);
  },
  logout: async (whatsappId: number): Promise<void> => {
    console.log("Meta API Dummy: logout", whatsappId);
  }
};

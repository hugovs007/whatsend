import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<Message> => {
  // TODO: Implement REST API call to Meta Graph API
  console.log("Meta API: Sending message to", ticket.contact.number);
  
  // Dummy message return to satisfy types
  return {} as Message;
};

export default SendWhatsAppMessage;

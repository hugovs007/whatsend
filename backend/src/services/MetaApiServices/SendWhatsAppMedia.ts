import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const SendWhatsAppMedia = async ({
  media,
  ticket
}: Request): Promise<Message> => {
  // TODO: Implement REST API call to Meta Graph API (Upload media, then send)
  console.log("Meta API: Sending media to", ticket.contact.number);
  
  // Dummy message return to satisfy types
  return {} as Message;
};

export default SendWhatsAppMedia;

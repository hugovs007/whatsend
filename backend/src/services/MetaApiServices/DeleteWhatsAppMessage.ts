import Message from "../../models/Message";

const DeleteWhatsAppMessage = async (messageId: string): Promise<Message> => {
  // TODO: Implement REST API call to Meta Graph API to delete message
  console.log("Meta API: Deleting message id", messageId);
  
  // Dummy message return to satisfy types
  return { id: messageId, ticketId: 1 } as any as Message;
};

export default DeleteWhatsAppMessage;

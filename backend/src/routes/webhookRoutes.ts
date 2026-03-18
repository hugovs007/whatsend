import { Router, Request, Response } from "express";

const webhookRoutes = Router();

// GET endpoint is required by Meta to verify the webhook URL
webhookRoutes.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // The verify token should match the one configured in the Meta App Dashboard
  // TODO: Add META_VERIFY_TOKEN to .env
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "whatsend_secret";

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// POST endpoint receives message events from Meta
webhookRoutes.post("/webhook", (req: Request, res: Response) => {
  const body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      const from = body.entry[0].changes[0].value.messages[0].from; // Extract the phone number from the webhook payload
      const msgBody = body.entry[0].changes[0].value.messages[0].text.body; // Extract the message text from the webhook payload

      console.log(`Received message from ${from}: ${msgBody} on ID ${phoneNumberId}`);
      // TODO: Call existing services (FindOrCreateTicket, CreateMessageService)
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

export default webhookRoutes;

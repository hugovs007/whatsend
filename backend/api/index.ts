import app from "../src/app";
import { initRedis } from "../src/libs/redisStore";
import { StartAllWhatsAppsSessions } from "../src/services/MetaApiServices/StartWhatsAppSession";
import { logger } from "../src/utils/logger";

// Initialize external connections that only need to happen once per serverless worker cold start
try {
  initRedis();
  StartAllWhatsAppsSessions();
} catch (error) {
  logger.error(error, "Error initializing serverless worker components");
}

export default app;

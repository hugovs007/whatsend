import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { initRedis } from "./libs/redisStore";
import { StartAllWhatsAppsSessions } from "./services/MetaApiServices/StartWhatsAppSession";

const port = process.env.PORT || process.env.BACKEND_PORT || "8080";

const server = app.listen(port, () => {
  logger.info(`Server started on port: ${port}`);
});

initIO(server);
initRedis();
StartAllWhatsAppsSessions();
gracefulShutdown(server);

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});

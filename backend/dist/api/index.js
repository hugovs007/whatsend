"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("../src/app"));
const redisStore_1 = require("../src/libs/redisStore");
const StartWhatsAppSession_1 = require("../src/services/MetaApiServices/StartWhatsAppSession");
const logger_1 = require("../src/utils/logger");
// Initialize external connections that only need to happen once per serverless worker cold start
try {
    (0, redisStore_1.initRedis)();
    (0, StartWhatsAppSession_1.StartAllWhatsAppsSessions)();
}
catch (error) {
    logger_1.logger.error(error, "Error initializing serverless worker components");
}
exports.default = app_1.default;

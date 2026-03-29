"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const level = process.env.LOG_LEVEL || "info";
const isProduction = process.env.NODE_ENV === "production";
const logger = (0, pino_1.default)({
    level,
    prettyPrint: isProduction
        ? false
        : {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard"
        }
});
exports.logger = logger;

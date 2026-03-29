"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = exports.deleteFromRedis = exports.getFromRedis = exports.setInRedis = exports.initRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
let redisClient = null;
const REDIS_SESSION_TTL = 604800; // 7 days
const initRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.REDIS_URL || redisClient)
        return;
    try {
        redisClient = new ioredis_1.default(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            db: parseInt(process.env.REDIS_DB || "0", 10),
            disableClientInfo: true
        });
        redisClient.on("connect", () => {
            logger_1.logger.info("Redis connected successfully");
        });
        redisClient.on("error", err => {
            logger_1.logger.error({ info: "Redis connection error", err });
        });
        redisClient.on("close", () => {
            logger_1.logger.warn("Redis connection closed");
        });
        redisClient.on("reconnecting", () => {
            logger_1.logger.info("Redis reconnecting...");
        });
        yield redisClient.connect();
        logger_1.logger.info("Redis session store initialized");
    }
    catch (err) {
        logger_1.logger.error({ info: "Failed to initialize Redis", err });
    }
});
exports.initRedis = initRedis;
const setInRedis = (key, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redisClient)
        return;
    try {
        yield redisClient.setex(key, REDIS_SESSION_TTL, data);
        logger_1.logger.debug(`Data saved to Redis: ${key}`);
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error inserting/updating data on Redis",
            key,
            err
        });
    }
});
exports.setInRedis = setInRedis;
const getFromRedis = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redisClient)
        return null;
    try {
        const value = yield redisClient.get(key);
        if (!value)
            return null;
        logger_1.logger.debug(`Data found on Redis: ${key}`);
        return value;
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error getting data from Redis",
            key,
            err
        });
        return null;
    }
});
exports.getFromRedis = getFromRedis;
const deleteFromRedis = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redisClient)
        return;
    try {
        yield redisClient.del(key);
        logger_1.logger.debug(`Data deleted from Redis: ${key}`);
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error deleting data from Redis",
            key,
            err
        });
    }
});
exports.deleteFromRedis = deleteFromRedis;
const getRedisClient = () => redisClient;
exports.getRedisClient = getRedisClient;

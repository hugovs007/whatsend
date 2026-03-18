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
const whaileys_1 = require("whaileys");
const WppKey_1 = __importDefault(require("../../models/WppKey"));
const redisStore_1 = require("../../libs/redisStore");
const logger_1 = require("../../utils/logger");
const REDIS_KEY_TYPES = ["session", "sender-keys", "sender-key-memory"];
const StoreWppSessionKeys = ({ connectionId, deviceId, type, id, value }) => __awaiter(void 0, void 0, void 0, function* () {
    const valueJson = JSON.stringify(value, whaileys_1.BufferJSON.replacer);
    if (REDIS_KEY_TYPES.includes(type)) {
        const redisKey = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
        yield (0, redisStore_1.setInRedis)(redisKey, valueJson);
        return;
    }
    try {
        yield WppKey_1.default.upsert({
            connectionId,
            type,
            keyId: id,
            value: valueJson
        });
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error storing key in database",
            connectionId,
            type,
            keyId: id,
            err
        });
    }
});
exports.default = StoreWppSessionKeys;

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
const GetWppSessionKeys = ({ connectionId, deviceId, type, ids }) => __awaiter(void 0, void 0, void 0, function* () {
    const data = {};
    if (REDIS_KEY_TYPES.includes(type)) {
        yield Promise.all(ids.map((id) => __awaiter(void 0, void 0, void 0, function* () {
            const key = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
            const stored = yield (0, redisStore_1.getFromRedis)(key);
            if (stored) {
                data[id] = JSON.parse(stored, whaileys_1.BufferJSON.reviver);
            }
        })));
        return data;
    }
    try {
        yield Promise.all(ids.map((id) => __awaiter(void 0, void 0, void 0, function* () {
            const keyRecord = yield WppKey_1.default.findOne({
                where: {
                    connectionId,
                    type,
                    keyId: id
                }
            });
            if (keyRecord) {
                data[id] = JSON.parse(keyRecord.value, whaileys_1.BufferJSON.reviver);
            }
        })));
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error getting keys from database",
            connectionId,
            type,
            err
        });
    }
    return data;
});
exports.default = GetWppSessionKeys;

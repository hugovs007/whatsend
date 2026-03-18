"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.WhaileysProvider = void 0;
const fs_1 = require("fs");
const pino_1 = __importDefault(require("pino"));
const whaileys_1 = __importStar(require("whaileys"));
const lru_cache_1 = require("lru-cache");
const https_proxy_agent_1 = require("https-proxy-agent");
const node_cache_1 = __importDefault(require("node-cache"));
const Whatsapp_1 = __importDefault(require("../../../models/Whatsapp"));
const socket_1 = require("../../../libs/socket");
const logger_1 = require("../../../utils/logger");
const AppError_1 = __importDefault(require("../../../errors/AppError"));
const StoreWppSessionKeys_1 = __importDefault(require("../../../services/WppKeyServices/StoreWppSessionKeys"));
const GetWppSessionKeys_1 = __importDefault(require("../../../services/WppKeyServices/GetWppSessionKeys"));
const redisStore_1 = require("../../../libs/redisStore");
const sleep_1 = require("../../../utils/sleep");
const handleWhatsappEvents_1 = require("../../../handlers/handleWhatsappEvents");
const whaileyLogger = (0, pino_1.default)({
    level: process.env.WHAILEYS_LOG_LEVEL || "silent"
});
const sessions = new Map();
const stores = new Map();
const msgRetryCounterLRU = new lru_cache_1.LRUCache({
    max: 5000,
    ttl: 600 * 1000,
    allowStale: false,
    updateAgeOnGet: true
});
const msgRetryCounterMap = new Proxy({}, {
    get(target, prop) {
        if (typeof prop === "string") {
            return msgRetryCounterLRU.get(prop);
        }
        return Reflect.get(target, prop);
    },
    set(target, prop, value) {
        if (typeof prop === "string" && typeof value === "number") {
            msgRetryCounterLRU.set(prop, value);
            return true;
        }
        return Reflect.set(target, prop, value);
    },
    deleteProperty(target, prop) {
        if (typeof prop === "string") {
            msgRetryCounterLRU.delete(prop);
            return true;
        }
        return Reflect.deleteProperty(target, prop);
    },
    has(target, prop) {
        if (typeof prop === "string") {
            return msgRetryCounterLRU.has(prop);
        }
        return Reflect.has(target, prop);
    },
    ownKeys() {
        return Array.from(msgRetryCounterLRU.keys());
    },
    getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === "string" && msgRetryCounterLRU.has(prop)) {
            return {
                configurable: true,
                enumerable: true,
                value: msgRetryCounterLRU.get(prop)
            };
        }
        return undefined;
    }
});
const msgCacheLRU = new lru_cache_1.LRUCache({
    max: 5000,
    ttl: 600 * 1000,
    allowStale: false,
    updateAgeOnGet: true
});
const sentMessagesCache = new node_cache_1.default({
    stdTTL: 60,
    useClones: false
});
const normalizeJid = (jid) => {
    if (!jid)
        return jid;
    if (!jid.includes("@"))
        return `${jid}@s.whatsapp.net`;
    return jid.replace(/@c\.us$/i, "@s.whatsapp.net");
};
const msgCache = {
    get: (key) => {
        const { id } = key;
        if (!id)
            return undefined;
        const data = msgCacheLRU.get(id);
        if (data) {
            try {
                const msg = JSON.parse(data);
                return msg === null || msg === void 0 ? void 0 : msg.message;
            }
            catch (_a) {
                return undefined;
            }
        }
        return undefined;
    },
    save: (msg) => {
        const { id } = msg.key;
        if (!id)
            return;
        try {
            msgCacheLRU.set(id, JSON.stringify(msg));
        }
        catch (e) {
            logger_1.logger.debug({ info: "Error caching message", messageId: id, err: e });
        }
    }
};
const clearSessionKeys = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = (0, redisStore_1.getRedisClient)();
    if (!client)
        return;
    try {
        const match = `wpp:${sessionId}:*`;
        const scanAndDelete = (cursor) => __awaiter(void 0, void 0, void 0, function* () {
            const [nextCursor, keys] = yield client.scan(cursor, "MATCH", match, "COUNT", 100);
            if (keys.length > 0) {
                yield client.del(keys);
            }
            if (nextCursor !== "0") {
                yield scanAndDelete(nextCursor);
            }
        });
        yield scanAndDelete("0");
        logger_1.logger.info({ info: "Cleared Redis session keys", sessionId });
    }
    catch (err) {
        logger_1.logger.error({ info: "Error clearing Redis session keys", sessionId, err });
    }
});
const assertUnique = (sessionId) => {
    const wbot = sessions.get(sessionId);
    if (wbot) {
        wbot.ev.removeAllListeners("connection.update");
        sessions.delete(sessionId);
        stores.delete(sessionId);
        wbot.end(undefined);
    }
};
const saveSessionCreds = (whatsapp, creds) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield whatsapp.update({
            session: JSON.stringify(creds, whaileys_1.BufferJSON.replacer),
            status: "CONNECTED",
            qrcode: ""
        });
        logger_1.logger.debug({
            info: "Creds saved to database",
            whatsappId: whatsapp.id
        });
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error saving creds to database",
            whatsappId: whatsapp.id,
            err
        });
    }
});
const credsDebounceTimers = new Map();
const pendingCredsSaves = new Map();
const flushPendingCredsSave = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const existingTimer = credsDebounceTimers.get(sessionId);
    if (existingTimer) {
        clearTimeout(existingTimer);
        credsDebounceTimers.delete(sessionId);
    }
    const pending = pendingCredsSaves.get(sessionId);
    if (pending) {
        pendingCredsSaves.delete(sessionId);
        yield saveSessionCreds(pending.whatsapp, pending.creds);
    }
});
const debouncedSaveCreds = (whatsapp, creds, delayMs = 1000) => {
    const sessionId = whatsapp.id;
    const existingTimer = credsDebounceTimers.get(sessionId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }
    pendingCredsSaves.set(sessionId, { whatsapp, creds });
    const timer = setTimeout(() => {
        credsDebounceTimers.delete(sessionId);
        pendingCredsSaves.delete(sessionId);
        saveSessionCreds(whatsapp, creds);
    }, delayMs);
    credsDebounceTimers.set(sessionId, timer);
};
const useSessionAuthState = (whatsapp) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = whatsapp.id;
    const creds = whatsapp.session
        ? JSON.parse(whatsapp.session, whaileys_1.BufferJSON.reviver)
        : (0, whaileys_1.initAuthCreds)();
    return {
        state: {
            creds: creds,
            keys: {
                get: (type, ids) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a, _b;
                    const deviceId = ((_b = (0, whaileys_1.jidDecode)((_a = creds === null || creds === void 0 ? void 0 : creds.me) === null || _a === void 0 ? void 0 : _a.id)) === null || _b === void 0 ? void 0 : _b.device) || 1;
                    const data = yield (0, GetWppSessionKeys_1.default)({
                        connectionId: sessionId,
                        deviceId,
                        type,
                        ids
                    });
                    return data;
                }),
                set: (data) => __awaiter(void 0, void 0, void 0, function* () {
                    var _c, _d;
                    const deviceId = ((_d = (0, whaileys_1.jidDecode)((_c = creds === null || creds === void 0 ? void 0 : creds.me) === null || _c === void 0 ? void 0 : _c.id)) === null || _d === void 0 ? void 0 : _d.device) || 1;
                    try {
                        const promises = [];
                        Object.entries(data).forEach(([category, categoryData]) => {
                            if (!categoryData)
                                return;
                            Object.entries(categoryData).forEach(([id, value]) => {
                                promises.push((0, StoreWppSessionKeys_1.default)({
                                    connectionId: sessionId,
                                    deviceId,
                                    type: category,
                                    id,
                                    value
                                }));
                            });
                        });
                        yield Promise.all(promises);
                    }
                    catch (err) {
                        logger_1.logger.error({
                            info: "Error setting keys",
                            sessionId,
                            err
                        });
                    }
                })
            }
        }
    };
});
const mapMessageType = (msg) => {
    var _a, _b;
    const messageType = (0, whaileys_1.getContentType)(msg.message || undefined);
    if (messageType === "audioMessage" && ((_b = (_a = msg.message) === null || _a === void 0 ? void 0 : _a.audioMessage) === null || _b === void 0 ? void 0 : _b.ptt)) {
        return "ptt";
    }
    const typeMap = {
        conversation: "chat",
        extendedTextMessage: "chat",
        imageMessage: "image",
        videoMessage: "video",
        audioMessage: "audio",
        documentMessage: "document",
        stickerMessage: "sticker",
        locationMessage: "location",
        contactMessage: "vcard",
        contactsArrayMessage: "vcard"
    };
    return typeMap[messageType || ""] || "chat";
};
const getMessageBody = (msg) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    try {
        const messageType = (0, whaileys_1.getContentType)(msg.message || undefined);
        if (messageType === "conversation") {
            return ((_a = msg.message) === null || _a === void 0 ? void 0 : _a.conversation) || "";
        }
        if (messageType === "extendedTextMessage") {
            return ((_c = (_b = msg.message) === null || _b === void 0 ? void 0 : _b.extendedTextMessage) === null || _c === void 0 ? void 0 : _c.text) || "";
        }
        if (messageType === "imageMessage") {
            return ((_e = (_d = msg.message) === null || _d === void 0 ? void 0 : _d.imageMessage) === null || _e === void 0 ? void 0 : _e.caption) || "";
        }
        if (messageType === "videoMessage") {
            return ((_g = (_f = msg.message) === null || _f === void 0 ? void 0 : _f.videoMessage) === null || _g === void 0 ? void 0 : _g.caption) || "";
        }
        if (messageType === "documentMessage") {
            return ((_j = (_h = msg.message) === null || _h === void 0 ? void 0 : _h.documentMessage) === null || _j === void 0 ? void 0 : _j.caption) || "";
        }
        if (messageType === "contactMessage") {
            return ((_l = (_k = msg.message) === null || _k === void 0 ? void 0 : _k.contactMessage) === null || _l === void 0 ? void 0 : _l.vcard) || "";
        }
        if (messageType === "contactsArrayMessage") {
            const contacts = ((_o = (_m = msg.message) === null || _m === void 0 ? void 0 : _m.contactsArrayMessage) === null || _o === void 0 ? void 0 : _o.contacts) || [];
            return contacts.map(c => c.vcard).join("\n");
        }
        if (messageType === "locationMessage") {
            const location = (_p = msg.message) === null || _p === void 0 ? void 0 : _p.locationMessage;
            if (!location)
                return "";
            const gmapsUrl = `https://maps.google.com/maps?q=${location.degreesLatitude}%2C${location.degreesLongitude}&z=17&hl=pt-BR`;
            const description = location.name ||
                `${location.degreesLatitude}, ${location.degreesLongitude}`;
            return `${gmapsUrl}|${description}`;
        }
        return "";
    }
    catch (err) {
        logger_1.logger.error({ info: "Error getting message body", err });
        return "";
    }
};
const getQuotedMessageId = (msg) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const quotedMessageId = ((_c = (_b = (_a = msg.message) === null || _a === void 0 ? void 0 : _a.extendedTextMessage) === null || _b === void 0 ? void 0 : _b.contextInfo) === null || _c === void 0 ? void 0 : _c.stanzaId) ||
        ((_f = (_e = (_d = msg.message) === null || _d === void 0 ? void 0 : _d.imageMessage) === null || _e === void 0 ? void 0 : _e.contextInfo) === null || _f === void 0 ? void 0 : _f.stanzaId) ||
        ((_j = (_h = (_g = msg.message) === null || _g === void 0 ? void 0 : _g.videoMessage) === null || _h === void 0 ? void 0 : _h.contextInfo) === null || _j === void 0 ? void 0 : _j.stanzaId) ||
        ((_m = (_l = (_k = msg.message) === null || _k === void 0 ? void 0 : _k.documentMessage) === null || _l === void 0 ? void 0 : _l.contextInfo) === null || _m === void 0 ? void 0 : _m.stanzaId) ||
        undefined;
    return quotedMessageId;
};
const hasMedia = (msg) => {
    const messageType = (0, whaileys_1.getContentType)(msg.message || undefined);
    return [
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "documentMessage",
        "stickerMessage"
    ].includes(messageType || "");
};
const mapMessageAck = (status) => {
    if (status === null || status === undefined)
        return 0;
    if (status >= 4)
        return 4;
    if (status >= 3)
        return 3;
    if (status >= 2)
        return 2;
    if (status >= 1)
        return 1;
    return 0;
};
const shouldHandleMessage = (msg) => {
    const messageType = (0, whaileys_1.getContentType)(msg.message || undefined);
    const validTypes = [
        "conversation",
        "extendedTextMessage",
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "documentMessage",
        "stickerMessage",
        "locationMessage",
        "contactMessage",
        "contactsArrayMessage"
    ];
    if (!validTypes.includes(messageType || ""))
        return false;
    const body = getMessageBody(msg);
    if (/\u200e/.test(body[0]))
        return false;
    if (!msg.key.fromMe)
        return true;
    const allowedFromMeTypes = [
        "locationMessage",
        "conversation",
        "extendedTextMessage",
        "contactMessage"
    ];
    return hasMedia(msg) || allowedFromMeTypes.includes(messageType || "");
};
const convertToMessagePayload = (msg) => {
    const fromJid = msg.key.remoteJid || "";
    const toJid = msg.key.fromMe ? fromJid : msg.key.participant || fromJid;
    const fromMe = msg.key.fromMe || false;
    return {
        id: msg.key.id || "",
        body: getMessageBody(msg),
        fromMe,
        hasMedia: hasMedia(msg),
        type: mapMessageType(msg),
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now(),
        from: fromJid,
        to: toJid,
        hasQuotedMsg: Boolean(getQuotedMessageId(msg)),
        quotedMsgId: getQuotedMessageId(msg),
        ack: fromMe ? 1 : 0
    };
};
const convertToContactPayload = (jid, msg, wbot) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
    const keyExt = (msg.key || {});
    const content = msg.message || {};
    const ctx = (((_e = content === null || content === void 0 ? void 0 : content.extendedTextMessage) === null || _e === void 0 ? void 0 : _e.contextInfo) ||
        ((_f = content === null || content === void 0 ? void 0 : content.imageMessage) === null || _f === void 0 ? void 0 : _f.contextInfo) ||
        ((_g = content === null || content === void 0 ? void 0 : content.videoMessage) === null || _g === void 0 ? void 0 : _g.contextInfo) ||
        ((_h = content === null || content === void 0 ? void 0 : content.documentMessage) === null || _h === void 0 ? void 0 : _h.contextInfo) ||
        ((_j = content === null || content === void 0 ? void 0 : content.audioMessage) === null || _j === void 0 ? void 0 : _j.contextInfo) ||
        ((_k = content === null || content === void 0 ? void 0 : content.stickerMessage) === null || _k === void 0 ? void 0 : _k.contextInfo) ||
        undefined);
    let resolvedJid = jid || "";
    const lidCandidates = [
        keyExt.senderLid,
        keyExt.participantLid,
        keyExt.recipientLid,
        ctx === null || ctx === void 0 ? void 0 : ctx.senderLid,
        ctx === null || ctx === void 0 ? void 0 : ctx.participantLid,
        ctx === null || ctx === void 0 ? void 0 : ctx.recipientLid,
        keyExt.sender_lid,
        keyExt.participant_lid,
        keyExt.recipient_lid,
        ctx === null || ctx === void 0 ? void 0 : ctx.sender_lid,
        ctx === null || ctx === void 0 ? void 0 : ctx.participant_lid,
        ctx === null || ctx === void 0 ? void 0 : ctx.recipient_lid,
        ((_l = (keyExt.senderPn || keyExt.sender_pn)) === null || _l === void 0 ? void 0 : _l.includes("@lid"))
            ? keyExt.senderPn || keyExt.sender_pn
            : undefined,
        ((_m = (keyExt.participantPn || keyExt.participant_pn)) === null || _m === void 0 ? void 0 : _m.includes("@lid"))
            ? keyExt.participantPn || keyExt.participant_pn
            : undefined,
        ((_o = (keyExt.peerRecipientPn || keyExt.peer_recipient_pn)) === null || _o === void 0 ? void 0 : _o.includes("@lid"))
            ? keyExt.peerRecipientPn || keyExt.peer_recipient_pn
            : undefined
    ];
    const lid = lidCandidates.find(cand => typeof cand === "string" && cand.includes("@lid"));
    const pnCandidates = [
        keyExt.senderPn || keyExt.sender_pn,
        keyExt.participantPn || keyExt.participant_pn,
        keyExt.peerRecipientPn || keyExt.peer_recipient_pn
    ];
    const preferPn = pnCandidates.find(v => typeof v === "string" && /@s\.whatsapp\.net$/i.test(v));
    if (resolvedJid.endsWith("@lid") && preferPn) {
        resolvedJid = preferPn;
    }
    else if (resolvedJid &&
        !resolvedJid.endsWith("@s.whatsapp.net") &&
        !resolvedJid.endsWith("@g.us") &&
        preferPn) {
        resolvedJid = preferPn;
    }
    const safeNormalized = (value) => {
        if (!value)
            return "";
        try {
            return (0, whaileys_1.jidNormalizedUser)(value);
        }
        catch (_a) {
            return value;
        }
    };
    const normalizedJid = safeNormalized(resolvedJid);
    const contactInfo = ((_q = (_p = wbot.store) === null || _p === void 0 ? void 0 : _p.contacts) === null || _q === void 0 ? void 0 : _q[resolvedJid]) ||
        ((_s = (_r = wbot.store) === null || _r === void 0 ? void 0 : _r.contacts) === null || _s === void 0 ? void 0 : _s[normalizedJid]);
    const chatInfo = ((_v = (_u = (_t = wbot.store) === null || _t === void 0 ? void 0 : _t.chats) === null || _u === void 0 ? void 0 : _u.get) === null || _v === void 0 ? void 0 : _v.call(_u, resolvedJid)) ||
        ((_y = (_x = (_w = wbot.store) === null || _w === void 0 ? void 0 : _w.chats) === null || _x === void 0 ? void 0 : _x.get) === null || _y === void 0 ? void 0 : _y.call(_x, normalizedJid));
    let profilePicUrl;
    if (normalizedJid) {
        try {
            const url = yield wbot.profilePictureUrl(normalizedJid, "image");
            profilePicUrl = url || undefined;
        }
        catch (err) {
            logger_1.logger.debug({
                info: "Could not get profile picture",
                jid: normalizedJid,
                err
            });
        }
    }
    if ((0, whaileys_1.isJidGroup)(resolvedJid)) {
        const groupNumber = normalizedJid.split("@")[0];
        const groupName = (contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.name) ||
            (contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.notify) ||
            (chatInfo === null || chatInfo === void 0 ? void 0 : chatInfo.name) ||
            (chatInfo === null || chatInfo === void 0 ? void 0 : chatInfo.subject) ||
            groupNumber;
        if (!contactInfo && (!groupName || groupName === groupNumber)) {
            try {
                const meta = yield wbot.groupMetadata(normalizedJid);
                const metaName = typeof (meta === null || meta === void 0 ? void 0 : meta.subject) === "string" ? meta.subject : "";
                if (metaName) {
                    return {
                        name: metaName,
                        number: groupNumber,
                        isGroup: true,
                        profilePicUrl
                    };
                }
            }
            catch (_3) {
                /* ignore */
            }
        }
        return {
            name: groupName,
            number: groupNumber,
            isGroup: true,
            profilePicUrl
        };
    }
    const decoded = (0, whaileys_1.jidDecode)(resolvedJid);
    const sessionPushName = (_0 = (_z = wbot.user) === null || _z === void 0 ? void 0 : _z.name) === null || _0 === void 0 ? void 0 : _0.trim().toLowerCase();
    const incomingPushName = (_1 = msg.pushName) === null || _1 === void 0 ? void 0 : _1.trim();
    const pushName = incomingPushName &&
        sessionPushName &&
        incomingPushName.toLowerCase() === sessionPushName
        ? undefined
        : incomingPushName;
    const number = ((0, whaileys_1.isJidUser)(resolvedJid) && (decoded === null || decoded === void 0 ? void 0 : decoded.user)) ||
        ((_2 = (0, whaileys_1.jidDecode)(preferPn || "")) === null || _2 === void 0 ? void 0 : _2.user) ||
        normalizedJid.split("@")[0];
    const lidValue = (0, whaileys_1.isLidUser)(resolvedJid) && (decoded === null || decoded === void 0 ? void 0 : decoded.user) ? `${decoded.user}@lid` : lid;
    const name = (contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.name) ||
        (contactInfo === null || contactInfo === void 0 ? void 0 : contactInfo.notify) ||
        pushName ||
        number ||
        lidValue ||
        "";
    return {
        name,
        number,
        lid: lidValue,
        isGroup: false,
        profilePicUrl
    };
});
const convertToMediaPayload = (msg, wbot) => __awaiter(void 0, void 0, void 0, function* () {
    var _4, _5, _6, _7, _8, _9, _10, _11, _12;
    if (!hasMedia(msg))
        return undefined;
    // TODO save direct to disc using stream
    try {
        const buffer = yield (0, whaileys_1.downloadMediaMessage)(msg, "buffer", {}, {
            logger: whaileyLogger,
            reuploadRequest: wbot.updateMediaMessage
        });
        const messageType = (0, whaileys_1.getContentType)(msg.message || undefined);
        const getExtension = (mimetype, fallback) => { var _a; return ((_a = mimetype.split("/")[1]) === null || _a === void 0 ? void 0 : _a.split(";")[0]) || fallback; };
        if (messageType === "imageMessage") {
            const mimetype = ((_5 = (_4 = msg.message) === null || _4 === void 0 ? void 0 : _4.imageMessage) === null || _5 === void 0 ? void 0 : _5.mimetype) || "image/jpeg";
            return {
                filename: `image-${Date.now()}.${getExtension(mimetype, "jpg")}`,
                mimetype,
                data: buffer.toString("base64")
            };
        }
        if (messageType === "videoMessage") {
            const mimetype = ((_7 = (_6 = msg.message) === null || _6 === void 0 ? void 0 : _6.videoMessage) === null || _7 === void 0 ? void 0 : _7.mimetype) || "video/mp4";
            return {
                filename: `video-${Date.now()}.${getExtension(mimetype, "mp4")}`,
                mimetype,
                data: buffer.toString("base64")
            };
        }
        if (messageType === "audioMessage") {
            const mimetype = ((_9 = (_8 = msg.message) === null || _8 === void 0 ? void 0 : _8.audioMessage) === null || _9 === void 0 ? void 0 : _9.mimetype) || "audio/ogg; codecs=opus";
            return {
                filename: `audio-${Date.now()}.ogg`,
                mimetype,
                data: buffer.toString("base64")
            };
        }
        if (messageType === "documentMessage") {
            const docMsg = (_10 = msg.message) === null || _10 === void 0 ? void 0 : _10.documentMessage;
            const mimetype = (docMsg === null || docMsg === void 0 ? void 0 : docMsg.mimetype) || "application/octet-stream";
            const ext = getExtension(mimetype, "bin");
            return {
                filename: (docMsg === null || docMsg === void 0 ? void 0 : docMsg.title) || `document-${Date.now()}.${ext}`,
                mimetype,
                data: buffer.toString("base64")
            };
        }
        if (messageType === "stickerMessage") {
            const mimetype = ((_12 = (_11 = msg.message) === null || _11 === void 0 ? void 0 : _11.stickerMessage) === null || _12 === void 0 ? void 0 : _12.mimetype) || "image/webp";
            return {
                filename: `sticker-${Date.now()}.webp`,
                mimetype,
                data: buffer.toString("base64")
            };
        }
        return {
            filename: "",
            mimetype: "",
            data: buffer.toString("base64")
        };
    }
    catch (err) {
        logger_1.logger.error({
            info: "Error downloading media",
            err,
            messageId: msg.key.id
        });
        return undefined;
    }
});
const getMessageData = (msg, wbot) => __awaiter(void 0, void 0, void 0, function* () {
    const remoteJid = msg.key.remoteJid || "";
    const isGroup = (0, whaileys_1.isJidGroup)(remoteJid);
    let contactJid = remoteJid;
    let groupContact;
    if (!msg.key.fromMe && isGroup && msg.key.participant) {
        contactJid = msg.key.participant;
        groupContact = yield convertToContactPayload(remoteJid, msg, wbot);
    }
    const contactPayload = yield convertToContactPayload(contactJid, msg, wbot);
    const messagePayload = convertToMessagePayload(msg);
    const mediaPayload = yield convertToMediaPayload(msg, wbot);
    const contextPayload = {
        whatsappId: wbot.id,
        unreadMessages: 0,
        groupContact
    };
    return {
        messagePayload,
        contactPayload,
        contextPayload,
        mediaPayload
    };
});
const getWbot = (sessionId) => {
    const wbot = sessions.get(sessionId);
    if (!wbot) {
        throw new AppError_1.default("ERR_WAPP_NOT_INITIALIZED");
    }
    return wbot;
};
const removeSession = (whatsappId) => __awaiter(void 0, void 0, void 0, function* () {
    var _13, _14, _15, _16;
    yield flushPendingCredsSave(whatsappId);
    const wbot = sessions.get(whatsappId);
    if (wbot) {
        wbot.ev.removeAllListeners("connection.update");
        wbot.ev.removeAllListeners("creds.update");
        wbot.ev.removeAllListeners("messages.upsert");
        wbot.ev.removeAllListeners("messages.update");
        wbot.ev.removeAllListeners("message-receipt.update");
        wbot.ev.removeAllListeners("presence.update");
        wbot.ev.removeAllListeners("groups.upsert");
        wbot.ev.removeAllListeners("groups.update");
        wbot.ev.removeAllListeners("group-participants.update");
        wbot.ev.removeAllListeners("contacts.upsert");
        wbot.ev.removeAllListeners("contacts.update");
        wbot.ev.removeAllListeners("chats.upsert");
        wbot.ev.removeAllListeners("chats.update");
        wbot.ev.removeAllListeners("chats.delete");
        wbot.ev.removeAllListeners("blocklist.set");
        wbot.ev.removeAllListeners("blocklist.update");
        try {
            wbot.end(undefined);
        }
        catch (e) {
            logger_1.logger.debug({ info: "Error ending wbot", err: e });
        }
        try {
            (_14 = (_13 = wbot.ws) === null || _13 === void 0 ? void 0 : _13.removeAllListeners) === null || _14 === void 0 ? void 0 : _14.call(_13);
            yield ((_16 = (_15 = wbot.ws) === null || _15 === void 0 ? void 0 : _15.close) === null || _16 === void 0 ? void 0 : _16.call(_15));
        }
        catch (e) {
            logger_1.logger.debug({ info: "Error closing websocket", err: e });
        }
    }
    sessions.delete(whatsappId);
    stores.delete(whatsappId);
});
const init = (whatsapp) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = whatsapp.id;
    const io = (0, socket_1.getIO)();
    const { state } = yield useSessionAuthState(whatsapp);
    const store = (0, whaileys_1.makeInMemoryStore)({ logger: whaileyLogger });
    stores.set(sessionId, store);
    let waVersionToUse;
    if (process.env.WA_SOCKET_VERSION) {
        try {
            const parsed = JSON.parse(process.env.WA_SOCKET_VERSION);
            if (Array.isArray(parsed) && parsed.length >= 3) {
                waVersionToUse = parsed;
                logger_1.logger.info({
                    info: "Using WA_SOCKET_VERSION from env",
                    version: waVersionToUse.join(".")
                });
            }
        }
        catch (_17) {
            logger_1.logger.warn({
                info: "Failed to parse WA_SOCKET_VERSION, fetching latest"
            });
        }
    }
    if (!waVersionToUse) {
        try {
            const fetchedVersionData = yield (0, whaileys_1.fetchLatestWaWebVersion)({});
            if (fetchedVersionData === null || fetchedVersionData === void 0 ? void 0 : fetchedVersionData.version) {
                waVersionToUse = fetchedVersionData.version;
                logger_1.logger.info({
                    info: "Using latest WA Web version",
                    version: waVersionToUse.join(".")
                });
            }
        }
        catch (e) {
            logger_1.logger.warn({ info: "Failed to fetch latest WA version, using default" });
        }
    }
    const connOptions = {
        logger: whaileyLogger,
        browser: whaileys_1.Browsers.ubuntu(process.env.WHATSAPP_BROWSER_NAME || "Chrome"),
        emitOwnEvents: true,
        auth: {
            creds: state.creds,
            keys: (0, whaileys_1.makeCacheableSignalKeyStore)(state.keys, whaileyLogger, new node_cache_1.default({
                useClones: false,
                stdTTL: 60 * 60,
                checkperiod: 60 * 5
            }))
        },
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: jid => {
            if (typeof jid !== "string")
                return false;
            return ((0, whaileys_1.isJidBroadcast)(jid) ||
                (jid === null || jid === void 0 ? void 0 : jid.endsWith("newsletter")) ||
                jid === "status@broadcast");
        },
        syncFullHistory: false,
        version: waVersionToUse,
        msgRetryCounterMap,
        markOnlineOnConnect: false,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        linkPreviewImageThumbnailWidth: 192,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 25000,
        retryRequestDelayMs: 500,
        transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
        sentMessagesCache,
        getMessage: (key) => __awaiter(void 0, void 0, void 0, function* () {
            var _18;
            const cached = msgCache.get(key);
            if (cached)
                return cached;
            const msg = (_18 = store.messages[key.remoteJid]) === null || _18 === void 0 ? void 0 : _18.get(key.id);
            if (msg === null || msg === void 0 ? void 0 : msg.message)
                return msg.message;
            return undefined;
        })
    };
    const proxyAddress = process.env.PROXY_ADDRESS || "";
    if (proxyAddress) {
        const proxyAuth = process.env.PROXY_AUTH || "";
        const proxyUrl = proxyAuth
            ? `http://${proxyAuth}@${proxyAddress}`
            : `http://${proxyAddress}`;
        connOptions.agent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
        connOptions.fetchAgent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
    }
    assertUnique(sessionId);
    const wbot = (0, whaileys_1.default)(connOptions);
    wbot.id = sessionId;
    wbot.store = store;
    store.bind(wbot.ev);
    sessions.set(sessionId, wbot);
    wbot.ev.on("creds.update", () => {
        debouncedSaveCreds(whatsapp, state.creds);
    });
    wbot.ev.on("messages.upsert", ({ messages, type }) => __awaiter(void 0, void 0, void 0, function* () {
        messages.forEach(msg => {
            msgCache.save(msg);
            logger_1.logger.debug({
                info: "[RAW] Message received",
                sessionId,
                type,
                key: msg.key,
                messageTimestamp: msg.messageTimestamp,
                pushName: msg.pushName,
                status: msg.status,
                messageType: Object.keys(msg.message || {}),
                rawMessage: JSON.stringify(msg, null, 2)
            });
        });
        const validMessages = messages.filter(msg => {
            if (!msg.message || !shouldHandleMessage(msg))
                return false;
            if (type === "notify")
                return true;
            if (type === "append" && msg.key.fromMe)
                return true;
            return false;
        });
        if (validMessages.length === 0)
            return;
        yield Promise.all(validMessages.map((msg) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { messagePayload, contactPayload, contextPayload, mediaPayload } = yield getMessageData(msg, wbot);
                yield (0, handleWhatsappEvents_1.handleMessage)(messagePayload, contactPayload, contextPayload, mediaPayload);
            }
            catch (err) {
                logger_1.logger.error(err, "Error handling message upsert");
            }
        })));
    }));
    wbot.ev.on("connection.update", (update) => __awaiter(void 0, void 0, void 0, function* () {
        var _19, _20, _21, _22, _23, _24;
        const { connection, lastDisconnect, qr } = update;
        if (connection === "close") {
            const statusCode = (_20 = (_19 = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _19 === void 0 ? void 0 : _19.output) === null || _20 === void 0 ? void 0 : _20.statusCode;
            const errorMessage = ((_23 = (_22 = (_21 = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _21 === void 0 ? void 0 : _21.output) === null || _22 === void 0 ? void 0 : _22.payload) === null || _23 === void 0 ? void 0 : _23.message) ||
                ((_24 = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _24 === void 0 ? void 0 : _24.message) ||
                "";
            if (errorMessage === "Intentional Logout") {
                yield whatsapp.update({
                    status: "DISCONNECTED",
                    qrcode: "",
                    retries: 0
                });
                const updatedWhatsapp = yield Whatsapp_1.default.findByPk(sessionId);
                if (updatedWhatsapp) {
                    io.emit("whatsappSession", {
                        action: "update",
                        session: updatedWhatsapp
                    });
                }
                logger_1.logger.info({ info: "Session intentionally logged out", sessionId });
                yield clearSessionKeys(sessionId);
                yield removeSession(sessionId);
                return;
            }
            if (statusCode === whaileys_1.DisconnectReason.loggedOut) {
                yield whatsapp.update({
                    status: "DISCONNECTED",
                    qrcode: "",
                    retries: 0
                });
                const updatedWhatsapp = yield Whatsapp_1.default.findByPk(sessionId);
                if (updatedWhatsapp) {
                    io.emit("whatsappSession", {
                        action: "update",
                        session: updatedWhatsapp
                    });
                }
                yield removeSession(sessionId);
                return;
            }
            const shouldReconnect = statusCode !== whaileys_1.DisconnectReason.loggedOut; // TODO handle other cases
            if (shouldReconnect) {
                yield flushPendingCredsSave(sessionId);
                yield whatsapp.update({ status: "OPENING" });
                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
                logger_1.logger.info({
                    info: "Connection closed, reconnecting...",
                    sessionId,
                    statusCode
                });
                yield (0, sleep_1.sleep)(3000);
                init(whatsapp);
            }
        }
        if (connection === "open") {
            yield flushPendingCredsSave(sessionId);
            yield whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0
            });
            const updatedWhatsapp = yield Whatsapp_1.default.findByPk(sessionId);
            if (updatedWhatsapp) {
                io.emit("whatsappSession", {
                    action: "update",
                    session: updatedWhatsapp
                });
            }
            logger_1.logger.info({ info: "Session connected", sessionId });
        }
        if (qr !== undefined) {
            yield whatsapp.update({
                qrcode: qr,
                status: "qrcode"
            });
            io.emit("whatsappSession", {
                action: "update",
                session: whatsapp
            });
            logger_1.logger.info({ info: "QR Code generated", sessionId });
        }
    }));
    wbot.ev.on("messages.update", (updates) => __awaiter(void 0, void 0, void 0, function* () {
        yield Promise.all(updates.map((event) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (!event.update.status || !event.key.id)
                    return;
                const ack = event.update.status || 0;
                yield (0, handleWhatsappEvents_1.handleMessageAck)(event.key.id, ack);
            }
            catch (err) {
                logger_1.logger.error({
                    info: "Error handling message update",
                    err,
                    messageId: event.key.id
                });
            }
        })));
    }));
    wbot.ev.on("message-receipt.update", (updates) => __awaiter(void 0, void 0, void 0, function* () {
        yield Promise.all(updates.map(({ key, receipt }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (!key.id)
                    return;
                let ack = 2;
                if (receipt.playedTimestamp) {
                    ack = 4;
                }
                else if (receipt.readTimestamp) {
                    ack = 3;
                }
                else if (receipt.receiptTimestamp) {
                    ack = 2;
                }
                yield (0, handleWhatsappEvents_1.handleMessageAck)(key.id, ack);
                logger_1.logger.debug({
                    info: "Message receipt update processed",
                    messageId: key.id,
                    ack,
                    sessionId
                });
            }
            catch (err) {
                logger_1.logger.error({
                    info: "Error processing message receipt",
                    err,
                    messageId: key.id
                });
            }
        })));
    }));
});
const logout = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    yield flushPendingCredsSave(sessionId);
    const wbot = sessions.get(sessionId);
    if (wbot) {
        yield wbot
            .logout()
            .catch(err => logger_1.logger.error({ info: "Error on logout", sessionId, err }));
    }
    yield removeSession(sessionId);
    const whatsapp = yield Whatsapp_1.default.findByPk(sessionId);
    if (whatsapp) {
        yield whatsapp.update({
            status: "DISCONNECTED",
            qrcode: "",
            session: "",
            retries: 0
        });
        const updatedWhatsapp = yield Whatsapp_1.default.findByPk(sessionId);
        if (updatedWhatsapp) {
            (0, socket_1.getIO)().emit("whatsappSession", {
                action: "update",
                session: updatedWhatsapp
            });
        }
        logger_1.logger.info({ info: "Session logged out", sessionId });
    }
    yield clearSessionKeys(sessionId);
});
const sendMessage = (sessionId, to, body, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _25, _26;
    const wbot = getWbot(sessionId);
    const toJid = normalizeJid(to);
    const messageContent = (options === null || options === void 0 ? void 0 : options.quotedMessageId)
        ? {
            text: body,
            contextInfo: {
                stanzaId: options.quotedMessageId,
                participant: options.quotedMessageFromMe ? (_25 = wbot.user) === null || _25 === void 0 ? void 0 : _25.id : toJid
            }
        }
        : { text: body };
    const sentMsg = yield wbot.sendMessage(toJid, messageContent);
    if (!(sentMsg === null || sentMsg === void 0 ? void 0 : sentMsg.key.id)) {
        throw new AppError_1.default("ERR_SENDING_WAPP_MSG");
    }
    logger_1.logger.debug({
        info: "[RAW] Message sent",
        sessionId,
        to: toJid,
        key: sentMsg.key,
        messageTimestamp: sentMsg.messageTimestamp,
        status: sentMsg.status,
        rawMessage: JSON.stringify(sentMsg, null, 2)
    });
    msgCache.save(sentMsg);
    return {
        id: sentMsg.key.id,
        body,
        fromMe: true,
        hasMedia: false,
        type: "chat",
        timestamp: sentMsg.messageTimestamp
            ? Number(sentMsg.messageTimestamp)
            : Date.now(),
        from: ((_26 = wbot.user) === null || _26 === void 0 ? void 0 : _26.id) || "",
        to,
        ack: 1
    };
});
const sendMedia = (sessionId, to, media, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _27, _28;
    const wbot = getWbot(sessionId);
    const toJid = normalizeJid(to);
    const mediaBuffer = media.path ? (0, fs_1.readFileSync)(media.path) : media.data;
    if (!mediaBuffer)
        throw new AppError_1.default("ERR_NO_MEDIA_DATA");
    const contextInfo = (options === null || options === void 0 ? void 0 : options.quotedMessageId)
        ? { stanzaId: options.quotedMessageId, participant: toJid }
        : undefined;
    const buildPayload = () => {
        const base = {
            caption: options === null || options === void 0 ? void 0 : options.caption,
            mimetype: media.mimetype,
            contextInfo
        };
        if (media.mimetype.startsWith("image/")) {
            return {
                message: Object.assign({ image: mediaBuffer }, base),
                type: "image"
            };
        }
        if (media.mimetype.startsWith("video/")) {
            return {
                message: Object.assign({ video: mediaBuffer }, base),
                type: "video"
            };
        }
        if (media.mimetype.startsWith("audio/")) {
            const ptt = Boolean(options === null || options === void 0 ? void 0 : options.sendAudioAsVoice);
            return {
                message: {
                    audio: mediaBuffer,
                    mimetype: media.mimetype,
                    ptt,
                    contextInfo
                },
                type: ptt ? "ptt" : "audio"
            };
        }
        return {
            message: {
                document: mediaBuffer,
                caption: options === null || options === void 0 ? void 0 : options.caption,
                mimetype: media.mimetype,
                fileName: media.filename,
                contextInfo
            },
            type: "document"
        };
    };
    const { message, type } = buildPayload();
    const sent = yield wbot.sendMessage(toJid, message);
    if (!((_27 = sent === null || sent === void 0 ? void 0 : sent.key) === null || _27 === void 0 ? void 0 : _27.id))
        throw new AppError_1.default("ERR_SENDING_WAPP_MEDIA_MSG");
    logger_1.logger.debug({
        info: "[RAW] Media sent",
        sessionId,
        to: toJid,
        mediaType: type,
        mimetype: media.mimetype,
        filename: media.filename,
        key: sent.key,
        messageTimestamp: sent.messageTimestamp,
        status: sent.status,
        rawMessage: JSON.stringify(sent, null, 2)
    });
    msgCache.save(sent);
    return {
        id: sent.key.id,
        body: (options === null || options === void 0 ? void 0 : options.caption) || media.filename,
        fromMe: true,
        hasMedia: true,
        type,
        timestamp: sent.messageTimestamp
            ? Number(sent.messageTimestamp)
            : Date.now(),
        from: ((_28 = wbot.user) === null || _28 === void 0 ? void 0 : _28.id) || "",
        to,
        ack: 1
    };
});
const deleteMessage = (sessionId, chatId, messageId, fromMe) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const normalizedChatId = normalizeJid(chatId);
    const key = {
        remoteJid: normalizedChatId,
        id: messageId,
        fromMe
    };
    yield wbot.sendMessage(normalizedChatId, { delete: key });
});
const checkNumber = (sessionId, number) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const cleanNumber = number.replace(/\D/g, "");
    const [result] = yield wbot.onWhatsApp(cleanNumber);
    if (!(result === null || result === void 0 ? void 0 : result.exists)) {
        throw new AppError_1.default("ERR_NUMBER_NOT_ON_WHATSAPP", 404);
    }
    return result.jid;
});
const getProfilePicUrl = (sessionId, number) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
    try {
        const url = yield wbot.profilePictureUrl(jid, "image");
        return url || "";
    }
    catch (err) {
        logger_1.logger.debug({
            info: "Could not get profile picture",
            number,
            err
        });
        return "";
    }
});
const getContacts = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    var _29;
    const wbot = getWbot(sessionId);
    const contacts = [];
    if ((_29 = wbot.store) === null || _29 === void 0 ? void 0 : _29.contacts) {
        Object.values(wbot.store.contacts).forEach(contact => {
            if (contact.id && (0, whaileys_1.isJidUser)(contact.id)) {
                contacts.push({
                    id: contact.id,
                    number: (0, whaileys_1.jidNormalizedUser)(contact.id).replace("@s.whatsapp.net", ""),
                    name: contact.name || contact.notify || "",
                    pushname: contact.notify || "",
                    isGroup: false
                });
            }
        });
    }
    return contacts;
});
const sendSeen = (sessionId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    var _30, _31, _32, _33;
    const wbot = getWbot(sessionId);
    const normalizedChatId = normalizeJid(chatId);
    const lastMessages = ((_33 = (_32 = (_31 = (_30 = wbot.store) === null || _30 === void 0 ? void 0 : _30.messages) === null || _31 === void 0 ? void 0 : _31[normalizedChatId]) === null || _32 === void 0 ? void 0 : _32.array) === null || _33 === void 0 ? void 0 : _33.slice(-5)) || [];
    if (lastMessages.length === 0) {
        return;
    }
    const keys = lastMessages
        .filter(msg => !msg.key.fromMe && msg.key.id)
        .map(msg => ({
        remoteJid: normalizedChatId,
        id: msg.key.id,
        participant: msg.key.participant
    }));
    if (keys.length > 0) {
        yield wbot.readMessages(keys);
    }
});
const fetchChatMessages = (sessionId, chatId, limit = 100) => __awaiter(void 0, void 0, void 0, function* () {
    var _34, _35, _36;
    const wbot = getWbot(sessionId);
    const normalizedChatId = normalizeJid(chatId);
    const messagesFromStore = ((_36 = (_35 = (_34 = wbot.store) === null || _34 === void 0 ? void 0 : _34.messages) === null || _35 === void 0 ? void 0 : _35[normalizedChatId]) === null || _36 === void 0 ? void 0 : _36.array) || [];
    const messages = messagesFromStore.slice(-limit);
    return messages.map(msg => ({
        id: msg.key.id || "",
        body: getMessageBody(msg),
        fromMe: msg.key.fromMe || false,
        hasMedia: hasMedia(msg),
        type: mapMessageType(msg),
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now(),
        from: msg.key.participant || msg.key.remoteJid || "",
        to: normalizedChatId,
        ack: mapMessageAck(msg.status)
    }));
});
exports.WhaileysProvider = {
    init,
    removeSession,
    logout,
    sendMessage,
    sendMedia,
    deleteMessage,
    checkNumber,
    getProfilePicUrl,
    getContacts,
    sendSeen,
    fetchChatMessages
};

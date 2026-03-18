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
exports.WhatsappWebJsProvider = void 0;
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const whatsapp_web_js_1 = require("whatsapp-web.js");
const socket_1 = require("../../../libs/socket");
const AppError_1 = __importDefault(require("../../../errors/AppError"));
const logger_1 = require("../../../utils/logger");
const handleWhatsappEvents_1 = require("../../../handlers/handleWhatsappEvents");
const sessions = [];
const getWbot = (whatsappId) => {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex === -1) {
        throw new AppError_1.default("ERR_WAPP_NOT_INITIALIZED");
    }
    return sessions[sessionIndex];
};
const mapMessageType = (wbotType) => {
    const typeMap = {
        chat: "chat",
        audio: "audio",
        ptt: "ptt",
        video: "video",
        image: "image",
        document: "document",
        vcard: "vcard",
        sticker: "sticker",
        location: "location"
    };
    return typeMap[wbotType] || "chat";
};
const mapMessageAck = (wbotAck) => {
    const ackMap = {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 4
    };
    return ackMap[wbotAck] || 0;
};
const convertToProviderMessage = (wbotMessage) => {
    return {
        id: wbotMessage.id.id,
        body: wbotMessage.body,
        fromMe: wbotMessage.fromMe,
        hasMedia: wbotMessage.hasMedia,
        type: mapMessageType(wbotMessage.type),
        timestamp: wbotMessage.timestamp,
        from: wbotMessage.from,
        to: wbotMessage.to,
        hasQuotedMsg: wbotMessage.hasQuotedMsg,
        ack: mapMessageAck(wbotMessage.ack)
    };
};
const getSerializedMessageId = (chatId, fromMe, messageId) => {
    const serializedMsgId = `${fromMe}_${chatId}_${messageId}`;
    return serializedMsgId;
};
const convertToContactPayload = (msgContact) => __awaiter(void 0, void 0, void 0, function* () {
    const profilePicUrl = yield msgContact.getProfilePicUrl();
    return {
        name: msgContact.name || msgContact.pushname || msgContact.id.user,
        number: msgContact.id.user,
        profilePicUrl,
        isGroup: msgContact.isGroup
    };
});
const verifyQuotedMessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (!msg.hasQuotedMsg)
        return undefined;
    const wbotQuotedMsg = yield msg.getQuotedMessage();
    return wbotQuotedMsg.id.id;
});
const prepareLocation = (msg) => {
    const { location } = msg;
    const gmapsUrl = `https://maps.google.com/maps?q=${location.latitude}%2C${location.longitude}&z=17&hl=pt-BR`;
    msg.body = `data:image/png;base64,${msg.body}|${gmapsUrl}`;
    msg.body += `|${location.description
        ? location.description
        : `${location.latitude}, ${location.longitude}`}`;
    return msg;
};
const convertToMessagePayload = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    let processedMsg = msg;
    if (msg.type === "location") {
        processedMsg = prepareLocation(msg);
    }
    const quotedMsgId = yield verifyQuotedMessage(processedMsg);
    return {
        id: processedMsg.id.id,
        body: processedMsg.body,
        fromMe: processedMsg.fromMe,
        hasMedia: processedMsg.hasMedia,
        type: mapMessageType(processedMsg.type),
        timestamp: processedMsg.timestamp,
        from: processedMsg.from,
        to: processedMsg.to,
        hasQuotedMsg: processedMsg.hasQuotedMsg,
        quotedMsgId
    };
});
const convertToMediaPayload = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (!msg.hasMedia)
        return undefined;
    const media = yield msg.downloadMedia();
    if (!media)
        return undefined;
    return {
        filename: media.filename || "",
        mimetype: media.mimetype,
        data: media.data
    };
});
const shouldHandleMessage = (msg) => {
    if (msg.from === "status@broadcast")
        return false;
    if (!(msg.type === "chat" ||
        msg.type === "audio" ||
        msg.type === "ptt" ||
        msg.type === "video" ||
        msg.type === "image" ||
        msg.type === "document" ||
        msg.type === "vcard" ||
        msg.type === "sticker" ||
        msg.type === "location")) {
        return false;
    }
    // Check for Unicode direction mark
    if (/\u200e/.test(msg.body[0]))
        return false;
    // Additional validation for messages from me
    if (msg.fromMe) {
        if (!msg.hasMedia &&
            msg.type !== "location" &&
            msg.type !== "chat" &&
            msg.type !== "vcard") {
            return false;
        }
    }
    return true;
};
const getMessageData = (msg, wbot) => __awaiter(void 0, void 0, void 0, function* () {
    let msgContact;
    let groupContact;
    if (msg.fromMe) {
        msgContact = yield wbot.getContactById(msg.to);
    }
    else {
        msgContact = yield msg.getContact();
    }
    const chat = yield msg.getChat();
    if (chat.isGroup) {
        let msgGroupContact;
        if (msg.fromMe) {
            msgGroupContact = yield wbot.getContactById(msg.to);
        }
        else {
            msgGroupContact = yield wbot.getContactById(msg.from);
        }
        groupContact = yield convertToContactPayload(msgGroupContact);
    }
    const unreadMessages = msg.fromMe ? 0 : chat.unreadCount;
    const contactPayload = yield convertToContactPayload(msgContact);
    const messagePayload = yield convertToMessagePayload(msg);
    const mediaPayload = yield convertToMediaPayload(msg);
    const contextPayload = {
        whatsappId: wbot.id,
        unreadMessages,
        groupContact
    };
    return {
        messagePayload,
        contactPayload,
        contextPayload,
        mediaPayload
    };
});
const syncUnreadMessages = (wbot) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const chats = yield wbot.getChats();
        /* eslint-disable no-restricted-syntax */
        /* eslint-disable no-await-in-loop */
        for (const chat of chats) {
            if (chat.unreadCount > 0) {
                const unreadMessages = yield chat.fetchMessages({
                    limit: chat.unreadCount
                });
                for (const msg of unreadMessages) {
                    if (shouldHandleMessage(msg)) {
                        const { messagePayload, contactPayload, contextPayload, mediaPayload } = yield getMessageData(msg, wbot);
                        (0, handleWhatsappEvents_1.handleMessage)(messagePayload, contactPayload, contextPayload, mediaPayload);
                    }
                }
                yield chat.sendSeen();
            }
        }
    }
    catch (err) {
        logger_1.logger.error(err, "Error syncing unread messages");
    }
});
const removeSession = (whatsappId) => {
    try {
        const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
        if (sessionIndex !== -1) {
            sessions[sessionIndex].destroy();
            sessions.splice(sessionIndex, 1);
        }
    }
    catch (err) {
        logger_1.logger.error(err);
    }
};
const sendMessage = (sessionId, to, body, options) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const quotedMsgSerializedId = (options === null || options === void 0 ? void 0 : options.quotedMessageId)
        ? getSerializedMessageId(to, Boolean(options === null || options === void 0 ? void 0 : options.quotedMessageFromMe), options === null || options === void 0 ? void 0 : options.quotedMessageId)
        : "";
    const sentMessage = yield wbot.sendMessage(to, body, {
        quotedMessageId: quotedMsgSerializedId,
        linkPreview: options === null || options === void 0 ? void 0 : options.linkPreview
    });
    return convertToProviderMessage(sentMessage);
});
const sendMedia = (sessionId, to, media, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const wbot = getWbot(sessionId);
    const messageMedia = media.path
        ? whatsapp_web_js_1.MessageMedia.fromFilePath(media.path)
        : new whatsapp_web_js_1.MessageMedia(media.mimetype, ((_a = media.data) === null || _a === void 0 ? void 0 : _a.toString("base64")) || "", media.filename);
    const mediaOptions = {
        caption: options === null || options === void 0 ? void 0 : options.caption,
        sendAudioAsVoice: options === null || options === void 0 ? void 0 : options.sendAudioAsVoice,
        quotedMessageId: options === null || options === void 0 ? void 0 : options.quotedMessageId
    };
    if (messageMedia.mimetype.startsWith("image/") &&
        !/^.*\.(jpe?g|png|gif)?$/i.exec(media.filename)) {
        mediaOptions.sendMediaAsDocument = (options === null || options === void 0 ? void 0 : options.sendMediaAsDocument) || true;
    }
    const sentMessage = yield wbot.sendMessage(to, messageMedia, mediaOptions);
    return convertToProviderMessage(sentMessage);
});
const checkNumber = (sessionId, number) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const validNumber = yield wbot.getNumberId(`${number}@c.us`);
    return (validNumber === null || validNumber === void 0 ? void 0 : validNumber.user) || "";
});
const getProfilePicUrl = (sessionId, number) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const profilePicUrl = yield wbot.getProfilePicUrl(`${number}@c.us`);
    return profilePicUrl;
});
const sendSeen = (sessionId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const chat = yield wbot.getChatById(chatId);
    yield chat.sendSeen();
});
const fetchChatMessages = (sessionId, chatId, limit = 100) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const chat = yield wbot.getChatById(chatId);
    const messages = yield chat.fetchMessages({ limit });
    return messages.map(convertToProviderMessage);
});
const getContacts = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const contacts = yield wbot.getContacts();
    return contacts.map(contact => ({
        id: contact.id.user,
        name: contact.name || contact.pushname,
        pushname: contact.pushname,
        number: contact.id.user,
        profilePicUrl: undefined,
        isGroup: contact.isGroup
    }));
});
const logout = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    yield wbot.logout();
});
const deleteMessage = (sessionId, chatId, messageId, fromMe) => __awaiter(void 0, void 0, void 0, function* () {
    const wbot = getWbot(sessionId);
    const serializedMsgId = getSerializedMessageId(chatId, fromMe, messageId);
    const message = yield wbot.getMessageById(serializedMsgId);
    yield message.delete(true);
});
const init = (whatsapp) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        removeSession(whatsapp.id);
        const io = (0, socket_1.getIO)();
        const sessionName = whatsapp.name;
        const args = process.env.CHROME_ARGS || "";
        const wbot = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({ clientId: `bd_${whatsapp.id}` }),
            puppeteer: {
                // headless: false, // TODO make sure chromium closes on session disconnection / delete
                executablePath: process.env.CHROME_BIN || undefined,
                browserWSEndpoint: process.env.CHROME_WS || undefined,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                    ...args.split(" ")
                ]
            }
        });
        wbot.on("qr", (qr) => __awaiter(void 0, void 0, void 0, function* () {
            logger_1.logger.info("Session:", sessionName);
            qrcode_terminal_1.default.generate(qr, { small: true });
            yield whatsapp.update({ qrcode: qr, status: "qrcode", retries: 0 });
            const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
            if (sessionIndex === -1) {
                wbot.id = whatsapp.id;
                sessions.push(wbot);
            }
            io.emit("whatsappSession", {
                action: "update",
                session: whatsapp
            });
        }));
        wbot.on("authenticated", () => __awaiter(void 0, void 0, void 0, function* () {
            logger_1.logger.info(`Session: ${sessionName} AUTHENTICATED`);
        }));
        wbot.on("auth_failure", (msg) => __awaiter(void 0, void 0, void 0, function* () {
            console.error(`Session: ${sessionName} AUTHENTICATION FAILURE! Reason: ${msg}`);
            if (whatsapp.retries > 1) {
                yield whatsapp.update({ session: "", retries: 0 });
            }
            yield whatsapp.update({
                status: "DISCONNECTED",
                retries: whatsapp.retries + 1
            });
            io.emit("whatsappSession", {
                action: "update",
                session: whatsapp
            });
        }));
        wbot.on("ready", () => __awaiter(void 0, void 0, void 0, function* () {
            logger_1.logger.info(`Session: ${sessionName} READY`);
            try {
                yield whatsapp.update({
                    status: "CONNECTED",
                    qrcode: "",
                    retries: 0
                });
                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
                const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                if (sessionIndex === -1) {
                    wbot.id = whatsapp.id;
                    sessions.push(wbot);
                }
                wbot.sendPresenceAvailable();
                yield syncUnreadMessages(wbot);
            }
            catch (err) {
                logger_1.logger.error(err, "Error on whatsapp ready event");
            }
        }));
        wbot.on("change_state", (newState) => __awaiter(void 0, void 0, void 0, function* () {
            logger_1.logger.info(`Monitor session: ${sessionName}, ${newState}`);
            try {
                yield whatsapp.update({ status: newState });
                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
            }
            catch (err) {
                logger_1.logger.error(err, "Error on whatsapp change state event");
            }
        }));
        wbot.on("disconnected", (reason) => __awaiter(void 0, void 0, void 0, function* () {
            logger_1.logger.info(`Disconnected session: ${sessionName}, reason: ${reason}`);
            try {
                yield whatsapp.update({ status: "OPENING", session: "" });
                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
                logger_1.logger.warn(`Session ${sessionName} disconnected. Restarting in 2 seconds...`);
                yield new Promise(r => setTimeout(r, 2000));
                init(whatsapp);
            }
            catch (err) {
                logger_1.logger.error(err, "Error on whatsapp disconnected event");
            }
        }));
        wbot.on("message_create", (msg) => __awaiter(void 0, void 0, void 0, function* () {
            if (!shouldHandleMessage(msg))
                return;
            try {
                const { messagePayload, contactPayload, contextPayload, mediaPayload } = yield getMessageData(msg, wbot);
                yield (0, handleWhatsappEvents_1.handleMessage)(messagePayload, contactPayload, contextPayload, mediaPayload);
            }
            catch (err) {
                logger_1.logger.error(err, "Error on whatsapp message create event");
            }
        }));
        wbot.on("media_uploaded", (msg) => __awaiter(void 0, void 0, void 0, function* () {
            if (!shouldHandleMessage(msg))
                return;
            try {
                const { messagePayload, contactPayload, contextPayload, mediaPayload } = yield getMessageData(msg, wbot);
                yield (0, handleWhatsappEvents_1.handleMessage)(messagePayload, contactPayload, contextPayload, mediaPayload);
            }
            catch (err) {
                logger_1.logger.error(err, "Error on whatsapp media uploaded event");
            }
        }));
        wbot.on("message_ack", (msg, ack) => __awaiter(void 0, void 0, void 0, function* () {
            (0, handleWhatsappEvents_1.handleMessageAck)(msg.id.id, mapMessageAck(ack));
        }));
        yield wbot.initialize();
    }
    catch (err) {
        logger_1.logger.error(err, "Error on whatsapp session");
    }
});
exports.WhatsappWebJsProvider = {
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

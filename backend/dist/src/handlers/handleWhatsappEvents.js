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
exports.handleMessageAck = exports.handleMessage = void 0;
const path_1 = require("path");
const util_1 = require("util");
const fs_1 = require("fs");
const Sentry = __importStar(require("@sentry/node"));
const socket_1 = require("../libs/socket");
const logger_1 = require("../utils/logger");
const Debounce_1 = require("../helpers/Debounce");
const Mustache_1 = __importDefault(require("../helpers/Mustache"));
const Message_1 = __importDefault(require("../models/Message"));
const CreateMessageService_1 = __importDefault(require("../services/MessageServices/CreateMessageService"));
const CreateOrUpdateContactService_1 = __importDefault(require("../services/ContactServices/CreateOrUpdateContactService"));
const FindOrCreateTicketService_1 = __importDefault(require("../services/TicketServices/FindOrCreateTicketService"));
const ShowWhatsAppService_1 = __importDefault(require("../services/WhatsappService/ShowWhatsAppService"));
const UpdateTicketService_1 = __importDefault(require("../services/TicketServices/UpdateTicketService"));
const CreateContactService_1 = __importDefault(require("../services/ContactServices/CreateContactService"));
const whatsappProvider_1 = require("../providers/WhatsApp/whatsappProvider");
const writeFileAsync = (0, util_1.promisify)(fs_1.writeFile);
const makeRandomId = (length) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
};
const processLocationMessage = (messagePayload) => {
    if (messagePayload.type !== "location")
        return messagePayload;
    return messagePayload;
};
const saveMediaFile = (mediaPayload) => __awaiter(void 0, void 0, void 0, function* () {
    const randomId = makeRandomId(5);
    const { filename: originalFilename } = mediaPayload;
    let filename;
    if (!originalFilename) {
        const [extension] = mediaPayload.mimetype.split("/")[1].split(";");
        filename = `${randomId}-${new Date().getTime()}.${extension}`;
    }
    else {
        const baseName = originalFilename.split(".").slice(0, -1).join(".");
        const extension = originalFilename.split(".").slice(-1)[0];
        filename = `${baseName}.${randomId}.${extension}`;
    }
    try {
        yield writeFileAsync((0, path_1.join)(__dirname, "..", "..", "public", filename), mediaPayload.data, "base64");
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(err);
    }
    return filename;
});
const processVcardMessage = (messagePayload) => __awaiter(void 0, void 0, void 0, function* () {
    if (messagePayload.type !== "vcard")
        return;
    try {
        const array = messagePayload.body.split("\n");
        const phoneNumbers = [];
        let contactName = "";
        array.forEach(line => {
            const values = line.split(":");
            values.forEach((value, index) => {
                if (value.indexOf("+") !== -1) {
                    phoneNumbers.push({ number: value });
                }
                if (value.indexOf("FN") !== -1 && values[index + 1]) {
                    contactName = values[index + 1];
                }
            });
        });
        yield Promise.all(phoneNumbers.map(({ number }) => (0, CreateContactService_1.default)({
            name: contactName,
            number: number.replace(/\D/g, "")
        })));
    }
    catch (error) {
        logger_1.logger.error("Error processing vcard message:", error);
    }
});
const handleQueueLogic = (whatsappId, messageBody, ticket, contactPayload) => __awaiter(void 0, void 0, void 0, function* () {
    const { queues, greetingMessage } = yield (0, ShowWhatsAppService_1.default)(whatsappId);
    if (queues.length === 1) {
        yield (0, UpdateTicketService_1.default)({
            ticketData: { queueId: queues[0].id },
            ticketId: ticket.id
        });
        return;
    }
    const selectedOption = messageBody;
    const choosenQueue = queues[+selectedOption - 1];
    if (choosenQueue) {
        yield (0, UpdateTicketService_1.default)({
            ticketData: { queueId: choosenQueue.id },
            ticketId: ticket.id
        });
        const body = (0, Mustache_1.default)(`\u200e${choosenQueue.greetingMessage}`, contactPayload);
        try {
            yield whatsappProvider_1.whatsappProvider.sendMessage(whatsappId, `${contactPayload.number}@c.us`, body);
        }
        catch (error) {
            logger_1.logger.error("Error sending queue greeting message:", error);
        }
    }
    else {
        let options = "";
        queues.forEach((queue, index) => {
            options += `*${index + 1}* - ${queue.name}\n`;
        });
        const body = (0, Mustache_1.default)(`\u200e${greetingMessage}\n${options}`, contactPayload);
        const debouncedSentMessage = (0, Debounce_1.debounce)(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield whatsappProvider_1.whatsappProvider.sendMessage(whatsappId, `${contactPayload.number}@c.us`, body);
            }
            catch (error) {
                logger_1.logger.error("Error sending queue options message:", error);
            }
        }), 3000, ticket.id);
        debouncedSentMessage();
    }
});
const handleMessage = (messagePayload, contactPayload, contextPayload, mediaPayload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const processedMessage = processLocationMessage(messagePayload);
        const contact = yield (0, CreateOrUpdateContactService_1.default)({
            name: contactPayload.name,
            number: contactPayload.number,
            lid: contactPayload.lid,
            profilePicUrl: contactPayload.profilePicUrl,
            isGroup: contactPayload.isGroup
        });
        let groupContact;
        if (contextPayload.groupContact) {
            groupContact = yield (0, CreateOrUpdateContactService_1.default)({
                name: contextPayload.groupContact.name,
                number: contextPayload.groupContact.number,
                lid: contextPayload.groupContact.lid,
                profilePicUrl: contextPayload.groupContact.profilePicUrl,
                isGroup: contextPayload.groupContact.isGroup
            });
        }
        const whatsapp = yield (0, ShowWhatsAppService_1.default)(contextPayload.whatsappId);
        if (contextPayload.unreadMessages === 0 &&
            whatsapp.farewellMessage &&
            (0, Mustache_1.default)(whatsapp.farewellMessage, contact) === processedMessage.body) {
            return;
        }
        const ticket = yield (0, FindOrCreateTicketService_1.default)(contact, contextPayload.whatsappId, contextPayload.unreadMessages, groupContact);
        const messageData = {
            id: processedMessage.id,
            ticketId: ticket.id,
            contactId: processedMessage.fromMe ? undefined : contact.id,
            body: processedMessage.body,
            fromMe: processedMessage.fromMe,
            read: processedMessage.fromMe,
            mediaType: processedMessage.type,
            quotedMsgId: processedMessage.quotedMsgId,
            ack: processedMessage.ack !== undefined ? processedMessage.ack : 0
        };
        if (mediaPayload && processedMessage.hasMedia) {
            const filename = yield saveMediaFile(mediaPayload);
            messageData.mediaUrl = filename;
            messageData.body = processedMessage.body || filename;
            const [mediaType] = mediaPayload.mimetype.split("/");
            messageData.mediaType = mediaType;
        }
        let lastMessageText = "";
        if (processedMessage.type === "location") {
            lastMessageText = processedMessage.body.includes("Localization")
                ? processedMessage.body
                : "Localization";
        }
        else {
            lastMessageText = processedMessage.body || (mediaPayload === null || mediaPayload === void 0 ? void 0 : mediaPayload.filename) || "";
        }
        yield ticket.update({ lastMessage: lastMessageText });
        yield (0, CreateMessageService_1.default)({ messageData });
        yield processVcardMessage(processedMessage);
        if (!ticket.queue &&
            !contextPayload.groupContact &&
            !processedMessage.fromMe &&
            !ticket.userId &&
            whatsapp.queues.length >= 1) {
            yield handleQueueLogic(contextPayload.whatsappId, processedMessage.body, ticket, contactPayload);
        }
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error({
            info: "Error handling message",
            err,
            messagePayload,
            contactPayload,
            contextPayload,
            mediaPayload
        });
    }
});
exports.handleMessage = handleMessage;
const handleMessageAck = (messageId, ack) => __awaiter(void 0, void 0, void 0, function* () {
    yield new Promise(r => setTimeout(r, 500));
    const io = (0, socket_1.getIO)();
    try {
        const messageToUpdate = yield Message_1.default.findByPk(messageId, {
            include: [
                "contact",
                {
                    model: Message_1.default,
                    as: "quotedMsg",
                    include: ["contact"]
                }
            ]
        });
        if (!messageToUpdate) {
            return;
        }
        yield messageToUpdate.update({ ack });
        io.to(messageToUpdate.ticketId.toString()).emit("appMessage", {
            action: "update",
            message: messageToUpdate
        });
    }
    catch (err) {
        Sentry.captureException(err);
        logger_1.logger.error(`Error handling message ack: ${err}`);
    }
});
exports.handleMessageAck = handleMessageAck;

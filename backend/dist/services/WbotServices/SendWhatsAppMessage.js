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
const AppError_1 = __importDefault(require("../../errors/AppError"));
const WhatsApp_1 = require("../../providers/WhatsApp");
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
const SendWhatsAppMessage = ({ body, ticket, quotedMsg }) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ticket.whatsappId) {
        throw new AppError_1.default("ERR_TICKET_NO_WHATSAPP");
    }
    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
    try {
        const sentMessage = yield WhatsApp_1.whatsappProvider.sendMessage(ticket.whatsappId, chatId, (0, Mustache_1.default)(body, ticket.contact), {
            quotedMessageId: quotedMsg === null || quotedMsg === void 0 ? void 0 : quotedMsg.id,
            quotedMessageFromMe: quotedMsg === null || quotedMsg === void 0 ? void 0 : quotedMsg.fromMe,
            linkPreview: false
        });
        yield ticket.update({ lastMessage: body });
        return sentMessage;
    }
    catch (err) {
        throw new AppError_1.default("ERR_SENDING_WAPP_MSG");
    }
});
exports.default = SendWhatsAppMessage;

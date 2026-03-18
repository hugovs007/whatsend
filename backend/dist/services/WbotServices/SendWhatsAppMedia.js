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
const fs_1 = __importDefault(require("fs"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const WhatsApp_1 = require("../../providers/WhatsApp");
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
const SendWhatsAppMedia = ({ media, ticket, body }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!ticket.whatsappId) {
            throw new AppError_1.default("ERR_TICKET_NO_WHATSAPP");
        }
        const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
        const hasBody = body
            ? (0, Mustache_1.default)(body, ticket.contact)
            : undefined;
        const mediaInput = {
            filename: media.filename,
            mimetype: media.mimetype,
            path: media.path
        };
        const mediaOptions = {
            caption: hasBody,
            sendAudioAsVoice: true,
            sendMediaAsDocument: media.mimetype.startsWith("image/") &&
                !/^.*\.(jpe?g|png|gif)?$/i.exec(media.filename)
        };
        const sentMessage = yield WhatsApp_1.whatsappProvider.sendMedia(ticket.whatsappId, chatId, mediaInput, mediaOptions);
        yield ticket.update({ lastMessage: body || media.filename });
        fs_1.default.unlinkSync(media.path);
        return sentMessage;
    }
    catch (err) {
        console.log(err);
        throw new AppError_1.default("ERR_SENDING_WAPP_MSG");
    }
});
exports.default = SendWhatsAppMedia;

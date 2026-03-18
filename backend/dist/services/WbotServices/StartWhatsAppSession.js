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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartWhatsAppSession = void 0;
const WhatsApp_1 = require("../../providers/WhatsApp");
const socket_1 = require("../../libs/socket");
const logger_1 = require("../../utils/logger");
const StartWhatsAppSession = (whatsapp) => __awaiter(void 0, void 0, void 0, function* () {
    yield whatsapp.update({ status: "OPENING" });
    const io = (0, socket_1.getIO)();
    io.emit("whatsappSession", {
        action: "update",
        session: whatsapp
    });
    try {
        console.log("VAI!");
        yield WhatsApp_1.whatsappProvider.init(whatsapp);
    }
    catch (err) {
        logger_1.logger.error(err);
    }
});
exports.StartWhatsAppSession = StartWhatsAppSession;

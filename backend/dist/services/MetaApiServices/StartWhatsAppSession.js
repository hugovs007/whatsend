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
exports.StartAllWhatsAppsSessions = exports.StartWhatsAppSession = void 0;
const StartWhatsAppSession = (whatsapp) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO: Meta API has no "sessions", but we might need to initialize webhooks
    console.log("StartWhatsAppSession: Meta Cloud API integration dummy started");
});
exports.StartWhatsAppSession = StartWhatsAppSession;
const StartAllWhatsAppsSessions = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("StartAllWhatsAppsSessions: Meta Cloud API integration dummy started");
});
exports.StartAllWhatsAppsSessions = StartAllWhatsAppsSessions;

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
const SendWhatsAppMessage = ({ body, ticket, quotedMsg }) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO: Implement REST API call to Meta Graph API
    console.log("Meta API: Sending message to", ticket.contact.number);
    // Dummy message return to satisfy types
    return {};
});
exports.default = SendWhatsAppMessage;

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
const socket_1 = require("../../libs/socket");
const Contact_1 = __importDefault(require("../../models/Contact"));
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const logger_1 = require("../../utils/logger");
const emitContact = (action, contact) => {
    const io = (0, socket_1.getIO)();
    io.emit("contact", { action, contact });
};
const CreateOrUpdateContactService = ({ name, number: rawNumber, lid, profilePicUrl, isGroup, email = "", extraInfo = [] }) => __awaiter(void 0, void 0, void 0, function* () {
    const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
    if (!number && !lid)
        throw new Error("Either number or lid must be provided");
    const [contactByNumber, contactByLid] = yield Promise.all([
        number ? Contact_1.default.findOne({ where: { number } }) : null,
        lid ? Contact_1.default.findOne({ where: { lid } }) : null
    ]);
    const shouldMerge = contactByNumber && contactByLid && contactByNumber.id !== contactByLid.id;
    if (shouldMerge) {
        yield Ticket_1.default.update({ contactId: contactByNumber.id }, { where: { contactId: contactByLid.id } });
        yield contactByLid.destroy();
        yield contactByNumber.update({
            lid: contactByLid.lid,
            profilePicUrl
        });
        logger_1.logger.info({
            info: "Merged contacts by number and lid",
            primaryContactId: contactByNumber.id,
            mergedContactId: contactByLid.id
        });
        emitContact("update", contactByNumber);
        return contactByNumber;
    }
    if (contactByNumber) {
        yield contactByNumber.update({
            lid: lid || contactByNumber.lid,
            profilePicUrl
        });
        emitContact("update", contactByNumber);
        return contactByNumber;
    }
    if (contactByLid) {
        yield contactByLid.update({
            number: number || contactByLid.number,
            profilePicUrl
        });
        emitContact("update", contactByLid);
        return contactByLid;
    }
    const created = yield Contact_1.default.create({
        name,
        number,
        lid,
        profilePicUrl,
        email,
        isGroup,
        extraInfo
    });
    emitContact("create", created);
    return created;
});
exports.default = CreateOrUpdateContactService;

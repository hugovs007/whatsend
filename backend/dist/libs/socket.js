"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initIO = void 0;
// Mock IO to satisfy compiler and remove socket.io dependency.
// In the Serverless + Supabase architecture, the backend no longer emits websocket events.
// The frontend will listen directly to Supabase PostgREST Realtime changes.
const dummyIO = {
    on: () => { },
    to: () => dummyIO,
    emit: () => { },
    join: () => { },
    disconnect: () => { }
};
const initIO = (httpServer) => {
    return dummyIO;
};
exports.initIO = initIO;
const getIO = () => {
    return dummyIO;
};
exports.getIO = getIO;

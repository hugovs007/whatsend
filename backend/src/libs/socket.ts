import { Server } from "http";

// Mock IO to satisfy compiler and remove socket.io dependency.
// In the Serverless + Supabase architecture, the backend no longer emits websocket events.
// The frontend will listen directly to Supabase PostgREST Realtime changes.

const dummyIO = {
  on: () => {},
  to: () => dummyIO,
  emit: () => {},
  join: () => {},
  disconnect: () => {}
};

export const initIO = (httpServer: Server): any => {
  return dummyIO;
};

export const getIO = (): any => {
  return dummyIO;
};

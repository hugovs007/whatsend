import { createClient } from "@supabase/supabase-js";

// Initialize Supabase.
// The user MUST provide these in .env (or Vercel environment variables)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder_key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let isConnected = false;
let listeners = [];

export function subscribeToSupabase() {
  if (isConnected) return;
  
  // Create a single global channel to listen to all public table changes
  // Note: The user MUST enable Physical Replication / Realtime on the Supabase Dashboard
  // for the tables: Messages, Tickets, Contacts, Users, etc.
  supabase
    .channel("public-db-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public" },
      (payload) => {
        const { table, eventType, new: newRec, old: oldRec } = payload;
        
        // Very basic mapping from Postgres Events to legacy Socket.io Events
        const action = eventType === "INSERT" ? "create" : eventType === "UPDATE" ? "update" : "delete";
        const record = eventType === "DELETE" ? oldRec : newRec;
        
        let eventName = "";
        let data = { action };

        switch (table.toLowerCase()) {
          case "messages":
            eventName = "appMessage";
            data.message = record;
            break;
          case "tickets":
            eventName = "ticket";
            data.ticket = record;
            break;
          case "contacts":
            eventName = "contact";
            data.contact = record;
            break;
          case "users":
            eventName = "user";
            data.user = record;
            break;
          default:
            return;
        }

        // Notify all registered mock socket listeners
        listeners.forEach((listener) => {
          if (listener.event === eventName) {
            listener.callback(data);
          }
        });
      }
    )
    .subscribe();
    
    isConnected = true;
}

// Map the old Socket.io API methods to our new Supabase listeners array
export function initSocket() {
  subscribeToSupabase();
  
  const mockSocket = {
    on: (event, callback) => {
      listeners.push({ event, callback });
    },
    off: (event, callback) => {
      listeners = listeners.filter(
        (l) => l.event !== event || l.callback !== callback
      );
    },
    emit: (event, data) => {
      // In Serverless, we don't send socket emits back to the backend.
      // E.g., "joinChatBox" is unnecessary because Supabase RLS handles permissions,
      // and we just filter locally.
      console.log(`Mock socket emit ignored in serverless: ${event}`);
    },
    disconnect: () => {
      // We don't actually disconnect Supabase on unmount because 
      // multiple components use the same channel. We just remove listeners.
    },
  };

  // Simulate immediate connection success for components that rely on it
  setTimeout(() => {
    listeners.forEach((listener) => {
      if (listener.event === "connect") {
        listener.callback();
      }
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
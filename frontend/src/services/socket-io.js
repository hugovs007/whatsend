import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder_key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let isConnected = false;
let listeners = [];

export function subscribeToSupabase() {
  if (isConnected) return;
  
  supabase
    .channel("public-db-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public" },
      (payload) => {
        const { table, eventType, new: newRec, old: oldRec } = payload;
        
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
      console.log(`Mock socket emit ignored: ${event}`);
    },
    disconnect: () => {},
  };

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
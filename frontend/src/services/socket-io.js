// src/services/socket-io.js

// Tenta importar o módulo normalmente, mas se falhar, usa a versão global (CDN)
let supabase;
try {
  // Tenta importar o módulo ES (pode falhar em alguns ambientes)
  const { createClient } = require("@supabase/supabase-js");
  const SUPABASE_URL = "https://xhepyqsasoudtreiltxk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("✅ Supabase via módulo ES");
} catch (error) {
  console.warn("Falha ao importar módulo ES, usando versão global (CDN)");
  // Usa a versão global disponível via CDN
  if (window.supabase) {
    const SUPABASE_URL = "https://xhepyqsasoudtreiltxk.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase via CDN (global)");
  } else {
    console.error("❌ Supabase não disponível");
  }
}

let isConnected = false;
let listeners = [];

export function subscribeToSupabase() {
  if (isConnected) return;
  if (!supabase) {
    console.error("❌ Cliente Supabase não inicializado");
    return;
  }

  console.log("🔌 Conectando canal Supabase...");
  try {
    const channel = supabase.channel("public-db-changes");
    channel.on(
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
          if (listener.event === eventName) listener.callback(data);
        });
      }
    ).subscribe((status) => {
      console.log("📡 Status do canal:", status);
    });
    isConnected = true;
    console.log("✅ Canal conectado!");
  } catch (error) {
    console.error("❌ Erro ao conectar canal:", error);
  }
}

export function initSocket() {
  console.log("🎯 Inicializando socket...");
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
      if (listener.event === "connect") listener.callback();
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
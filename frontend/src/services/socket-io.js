// src/services/socket-io.js

let supabase = null;
let isConnected = false;
let listeners = [];

// Função que espera o Supabase estar disponível (CDN)
function waitForSupabase() {
  return new Promise((resolve) => {
    if (window.supabase) {
      resolve(window.supabase);
      return;
    }
    const checkInterval = setInterval(() => {
      if (window.supabase) {
        clearInterval(checkInterval);
        resolve(window.supabase);
      }
    }, 50);
  });
}

// Inicialização assíncrona
async function initSupabase() {
  console.log("⏳ Aguardando Supabase (CDN)...");
  const supabaseGlobal = await waitForSupabase();
  console.log("✅ Supabase CDN carregado!");

  const SUPABASE_URL = "https://xhepyqsasoudtreiltxk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";

  try {
    supabase = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Cliente Supabase criado via CDN");
  } catch (error) {
    console.error("❌ Erro ao criar cliente Supabase:", error);
  }
}

export function subscribeToSupabase() {
  if (isConnected) return;
  if (!supabase) {
    console.warn("⚠️ Cliente Supabase ainda não inicializado");
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
          if (listener.event === eventName) {
            try {
              listener.callback(data);
            } catch (err) {
              console.error("Erro no callback:", err);
            }
          }
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
  // Inicia a inicialização do Supabase
  initSupabase().then(() => {
    // Tenta conectar após o cliente estar pronto
    subscribeToSupabase();
  }).catch(err => {
    console.error("Falha na inicialização do Supabase:", err);
  });

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
        try {
          listener.callback();
        } catch (err) {
          console.error("Erro no callback connect:", err);
        }
      }
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
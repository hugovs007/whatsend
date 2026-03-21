// src/services/socket-io.js
import { supabase } from "../supabase"; // ajuste o caminho se necessário

console.log("🚀 Iniciando socket-io.js");

let isConnected = false;
let listeners = [];

export function subscribeToSupabase() {
  if (isConnected) return;

  // Verificar se o cliente está disponível e possui o método channel
  if (!supabase || typeof supabase.channel !== "function") {
    console.error("❌ Cliente Supabase não disponível ou método channel não encontrado");
    console.log("Supabase disponível?", !!supabase);
    console.log("Tipo do supabase:", typeof supabase);
    return;
  }

  console.log("🔌 Conectando canal Supabase...");

  try {
    const channel = supabase.channel("public-db-changes");

    if (!channel || typeof channel.on !== "function") {
      console.error("❌ Canal não criado corretamente");
      return;
    }

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public" },
      (payload) => {
        console.log("📨 Evento recebido:", payload);
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
              console.error("❌ Erro no callback:", err);
            }
          }
        });
      }
    ).subscribe((status) => {
      console.log("📡 Status do canal:", status);
    });

    isConnected = true;
    console.log("✅ Canal Supabase conectado!");
  } catch (error) {
    console.error("❌ Erro ao conectar canal:", error);
  }
}

export function initSocket() {
  console.log("🎯 Inicializando socket...");

  // Tentar conectar sem esperar
  try {
    subscribeToSupabase();
  } catch (error) {
    console.error("❌ Erro ao iniciar socket:", error);
  }

  const mockSocket = {
    on: (event, callback) => {
      console.log(`📝 Registrando listener: ${event}`);
      listeners.push({ event, callback });
    },
    off: (event, callback) => {
      listeners = listeners.filter(
        (l) => l.event !== event || l.callback !== callback
      );
    },
    emit: (event, data) => {
      console.log(`📤 Mock emit: ${event}`);
    },
    disconnect: () => {
      console.log("🔌 Socket desconectado");
    },
  };

  setTimeout(() => {
    console.log("🔄 Emitindo connect para", listeners.length, "listeners");
    listeners.forEach((listener) => {
      if (listener.event === "connect") {
        try {
          listener.callback();
        } catch (err) {
          console.error("❌ Erro no callback connect:", err);
        }
      }
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
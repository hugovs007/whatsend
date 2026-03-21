// socket-io.js
import { createClient } from "@supabase/supabase-js";

console.log('🚀 Iniciando socket-io.js');

// Verificar se o createClient existe
if (!createClient) {
  console.error('❌ createClient não encontrado!');
}

// Valores diretos (sem depender de variáveis de ambiente)
const SUPABASE_URL = "https://xhepyqsasoudtreiltxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";

console.log('📡 Tentando criar cliente Supabase...');

// Criar cliente com try-catch
let supabase = null;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Cliente Supabase criado com sucesso!');
  console.log('🔍 Cliente:', supabase ? 'objeto criado' : 'null');
} catch (error) {
  console.error('❌ Erro fatal ao criar cliente:', error);
}

export { supabase };

let isConnected = false;
let listeners = [];

export function subscribeToSupabase() {
  if (isConnected) return;
  
  // Verificar se o cliente foi criado
  if (!supabase) {
    console.error('❌ Cliente Supabase não disponível para conectar');
    return;
  }
  
  console.log('🔌 Conectando canal Supabase...');
  
  try {
    const channel = supabase.channel("public-db-changes");
    
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public" },
      (payload) => {
        console.log('📨 Evento recebido:', payload);
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
              console.error('❌ Erro no callback:', err);
            }
          }
        });
      }
    ).subscribe((status) => {
      console.log('📡 Status do canal:', status);
    });
    
    isConnected = true;
    console.log('✅ Canal Supabase conectado!');
  } catch (error) {
    console.error('❌ Erro ao conectar canal:', error);
  }
}

export function initSocket() {
  console.log('🎯 Inicializando socket...');
  
  // Tentar conectar sem esperar
  try {
    subscribeToSupabase();
  } catch (error) {
    console.error('❌ Erro ao iniciar socket:', error);
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
      console.log('🔌 Socket desconectado');
    },
  };

  setTimeout(() => {
    console.log('🔄 Emitindo connect para', listeners.length, 'listeners');
    listeners.forEach((listener) => {
      if (listener.event === "connect") {
        try {
          listener.callback();
        } catch (err) {
          console.error('❌ Erro no callback connect:', err);
        }
      }
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
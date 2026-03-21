// socket-io.js
let supabase = null;
let isInitialized = false;
let isConnected = false;
let listeners = [];

// Função para inicializar o Supabase de forma assíncrona
const initializeSupabase = async () => {
  if (isInitialized) return supabase;
  
  try {
    console.log('🔄 Inicializando Supabase...');
    
    // Importar dinamicamente o módulo
    const { createClient } = await import("@supabase/supabase-js");
    
    const supabaseUrl = "https://xhepyqsasoudtreiltxk.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";
    
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    isInitialized = true;
    console.log('✅ Supabase inicializado com sucesso!');
    return supabase;
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    throw error;
  }
};

// Exportar uma Promise que resolve com o cliente
export const getSupabase = async () => {
  return await initializeSupabase();
};

export function subscribeToSupabase() {
  if (isConnected) return;
  
  // Aguardar inicialização antes de usar
  initializeSupabase().then(client => {
    if (!client) {
      console.error('❌ Cliente Supabase não disponível');
      return;
    }
    
    console.log('🔌 Conectando ao Supabase...');
    const channel = client.channel("public-db-changes");
    
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
            listener.callback(data);
          }
        });
      }
    ).subscribe((status) => {
      console.log('📡 Status do canal:', status);
    });
    
    isConnected = true;
  }).catch(error => {
    console.error('❌ Falha ao conectar ao Supabase:', error);
  });
}

export function initSocket() {
  console.log('🎯 Inicializando socket...');
  subscribeToSupabase();
  
  const mockSocket = {
    on: (event, callback) => {
      console.log(`📝 Listener registrado: ${event}`);
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
    console.log('🔄 Emitindo connect...');
    listeners.forEach((listener) => {
      if (listener.event === "connect") {
        listener.callback();
      }
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
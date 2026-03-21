import { createClient } from "@supabase/supabase-js";

// Função para obter as variáveis de ambiente de forma segura
const getEnvVariables = () => {
  // Tentar diferentes formas de obter as variáveis
  let url = null;
  let key = null;
  
  // Tentar import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    url = import.meta.env.VITE_SUPABASE_URL;
    key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    console.log('📦 Carregando via import.meta.env');
  }
  
  // Tentar process.env (para Node.js)
  if (!url && typeof process !== 'undefined' && process.env) {
    url = process.env.VITE_SUPABASE_URL;
    key = process.env.VITE_SUPABASE_ANON_KEY;
    console.log('📦 Carregando via process.env');
  }
  
  // Se ainda não encontrou, usar os valores diretos (apenas para desenvolvimento)
  if (!url || !key) {
    console.warn('⚠️ Variáveis de ambiente não encontradas, usando valores padrão');
    url = "https://xhepyqsasoudtreiltxk.supabase.co";
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";
  }
  
  return { url, key };
};

// Inicializar o cliente Supabase de forma síncrona
let supabaseClient = null;
let isInitialized = false;

const initializeSupabase = () => {
  if (isInitialized) return supabaseClient;
  
  try {
    const { url, key } = getEnvVariables();
    
    if (!url || !key) {
      throw new Error('URL ou chave do Supabase não definidas');
    }
    
    console.log('✅ Inicializando Supabase com:', { url: url.substring(0, 30) + '...', keyExists: !!key });
    supabaseClient = createClient(url, key);
    isInitialized = true;
    return supabaseClient;
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    throw error;
  }
};

// Exportar o cliente, mas inicializar quando for usado
export const supabase = new Proxy({}, {
  get: function(target, prop) {
    if (!isInitialized) {
      initializeSupabase();
    }
    return supabaseClient[prop];
  }
});

let isConnected = false;
let listeners = [];

export function subscribeToSupabase() {
  if (isConnected) return;
  
  try {
    // Garantir que o cliente está inicializado
    if (!isInitialized) {
      initializeSupabase();
    }
    
    if (!supabaseClient) {
      console.error('❌ Cliente Supabase não inicializado');
      return;
    }
    
    console.log('🔌 Conectando ao Supabase...');
    const channel = supabaseClient.channel("public-db-changes");
    
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
    )
    .subscribe((status) => {
      console.log('📡 Status do canal Supabase:', status);
    });
    
    isConnected = true;
  } catch (error) {
    console.error('❌ Erro ao conectar ao Supabase:', error);
  }
}

export function initSocket() {
  console.log('🎯 Inicializando socket...');
  
  try {
    subscribeToSupabase();
  } catch (error) {
    console.error('❌ Erro ao iniciar socket:', error);
  }
  
  const mockSocket = {
    on: (event, callback) => {
      console.log(`📝 Registrando listener para evento: ${event}`);
      listeners.push({ event, callback });
    },
    off: (event, callback) => {
      listeners = listeners.filter(
        (l) => l.event !== event || l.callback !== callback
      );
    },
    emit: (event, data) => {
      console.log(`📤 Mock socket emit ignorado: ${event}`);
    },
    disconnect: () => {
      console.log('🔌 Socket desconectado');
    },
  };

  setTimeout(() => {
    console.log('🔄 Emitindo evento connect para listeners');
    listeners.forEach((listener) => {
      if (listener.event === "connect") {
        listener.callback();
      }
    });
  }, 100);

  return mockSocket;
}

export default initSocket;
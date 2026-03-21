// src/supabase.js
import { createClient } from "@supabase/supabase-js";

// URLs e chaves fixas (substitua se necessário)
const SUPABASE_URL = "https://xhepyqsasoudtreiltxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZXB5cXNhc291ZHRyZWlsdHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDY3OTAsImV4cCI6MjA4OTI4Mjc5MH0.p0FSwZvzRQwDjzPbFlA2oz_N7RGNRXKcKGFOYq4f2-k";

console.log("🔧 Inicializando cliente Supabase...");

let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("✅ Cliente Supabase criado com sucesso!");
} catch (error) {
  console.error("❌ Erro ao criar cliente Supabase:", error);
  // Fallback: objeto mock para evitar quebra da aplicação
  supabase = {
    channel: () => ({
      on: () => ({
        subscribe: () => console.warn("Supabase mock: canal criado (offline)")
      })
    })
  };
}

export { supabase };
let cachedClient = null;

function getConfig() {
  if (typeof window === 'undefined') {
    throw new Error('Entorno sin ventana disponible para configurar Supabase.');
  }
  const config = window.APP_CONFIG || {};
  const url = config.supabaseUrl || config.supabase_url || '';
  const key = config.supabaseAnonKey || config.supabaseAnon || config.supabase_key || '';
  return { url, key };
}

export function resetSupabaseClient() {
  cachedClient = null;
}

export function getSupabaseClient() {
  if (!window.supabase) {
    throw new Error('La librería de Supabase no está cargada.');
  }
  if (cachedClient) {
    return cachedClient;
  }
  const { url, key } = getConfig();
  if (!url || !key) {
    throw new Error('Configura window.APP_CONFIG.supabaseUrl y supabaseAnonKey antes de usar Supabase.');
  }
  cachedClient = window.supabase.createClient(url, key, {
    auth: { persistSession: false }
  });
  return cachedClient;
}

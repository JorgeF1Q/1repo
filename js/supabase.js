const SUPABASE_URL = 'https://iqpgmxoeovuhpfbqjqme.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HLG7PbaLAfqWhsMwxNV2Og_77GoRrOR';

const REST_URL = `${SUPABASE_URL}/rest/v1`;

function buildHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

async function supabaseRequest(path, { method = 'GET', headers = {}, body, params } = {}) {
  const url = new URL(`${REST_URL}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: buildHeaders(headers),
    body,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('Respuesta inválida de Supabase');
    }
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error || data.msg)) || `Error Supabase ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export function select(table, query = '*', { filter = {}, single = false, order } = {}) {
  const params = { select: query };
  Object.entries(filter).forEach(([key, value]) => {
    if (value === undefined) return;
    params[`${key}`] = value;
  });
  if (order) {
    params.order = order;
  }
  return supabaseRequest(`/${table}`, { params }).then((data) => {
    if (single) {
      return Array.isArray(data) ? data[0] || null : data;
    }
    return data || [];
  });
}

export function insert(table, payload) {
  const body = JSON.stringify(Array.isArray(payload) ? payload : [payload]);
  return supabaseRequest(`/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body,
  }).then((data) => (Array.isArray(data) ? data : data ? [data] : []));
}

export function upsert(table, payload, onConflict) {
  const headers = { 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (onConflict) headers['Prefer'] += `,resolution=merge-duplicates`;
  const body = JSON.stringify(Array.isArray(payload) ? payload : [payload]);
  const params = {};
  if (onConflict) params.on_conflict = onConflict;
  return supabaseRequest(`/${table}`, { method: 'POST', headers, body, params });
}

export function update(table, payload, filters) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    params[key] = value;
  });
  return supabaseRequest(`/${table}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(payload),
    params,
  });
}

export function remove(table, filters) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    params[key] = value;
  });
  return supabaseRequest(`/${table}`, { method: 'DELETE', params });
}

export async function ensureAdminSeed() {
  const existing = await select('usuario', '*', {
    filter: { 'email': `eq.admin@joyeria.com` },
  });

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // Hash calculado previamente para "Admin#2025"
  const adminPasswordHash = '$2b$10$eW4pzqTubcz48SJoW1hjjeqWbtaq4o1oWrUWDPBb4CSjOtQmz50I2';

  const rol = await select('rol', '*', { filter: { nombre: 'eq.Admin' }, single: true });
  let rolId = rol?.rol_id;
  if (!rolId) {
    const [createdRole] = await insert('rol', { nombre: 'Admin' });
    rolId = createdRole?.rol_id ?? 2;
  }

  const [user] = await insert('usuario', {
    nombre: 'Jorge',
    email: 'admin@joyeria.com',
    password_hash: adminPasswordHash,
    rol_id: rolId,
    estado: 'activo',
  });

  return user;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };

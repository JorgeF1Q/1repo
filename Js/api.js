// /public/js/api.js
export const API_BASE = '';

const REMOTE_BASE = 'https://joyeria-full-stack-production.up.railway.app';
const LOCAL_PRODUCTS_ENDPOINT = '/api/products.php';
const LOCAL_CATEGORIES_ENDPOINT = '/api/categories.php';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.message || `Error de solicitud (${res.status})`);
  }
  return data;
}

// Productos
export async function getProducts() {
  try {
    const data = await fetchJson(LOCAL_PRODUCTS_ENDPOINT);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.products)) return data.products;
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch (err) {
    console.warn('Fallo la carga local de productos, intentando con la API remota.', err);
    const data = await fetchJson(`${REMOTE_BASE}/api/products`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.products)) return data.products;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }
}

// Categorías
export async function getCategories() {
  try {
    const data = await fetchJson(LOCAL_CATEGORIES_ENDPOINT);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.categories)) return data.categories;
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch (err) {
    console.warn('Fallo la carga local de categorías, intentando con la API remota.', err);
    const data = await fetchJson(`${REMOTE_BASE}/api/categories`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.categories)) return data.categories;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }
}

// Alias comunes
export const listProducts = getProducts;
export const listCategories = getCategories;

// Cupones
export async function validateCoupon(code, subtotal) {
  if (!code) {
    return { valid: false, ok: false, message: 'Ingresa un cupón', tipo: null, valor: 0, descuento: 0 };
  }

  const url = new URL(`${REMOTE_BASE}/api/coupons/validate`);
  url.searchParams.set('codigo', code);
  url.searchParams.set('subtotal', String(subtotal));

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));

  return {
    valid: !!(data.valid ?? data.ok),
    ok: !!(data.ok ?? data.valid),
    codigo: data.codigo ?? code,
    tipo: data.tipo ?? null,
    valor: Number(data.valor ?? 0),
    descuento: Number(data.descuento ?? 0),
    message: data.message || data.error || ''
  };
}

// Ordenes
export async function createOrder(payload) {
  const res = await fetch(`${REMOTE_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Error creando pedido');

  return data; // { ok: true, id: ... }
}

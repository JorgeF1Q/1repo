// /public/js/api.js
export const API_BASE = 'https://joyeria-full-stack-production.up.railway.app';

// Productos
export async function getProducts() {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error('No se pudieron cargar productos');
  return res.json();
}

// Cupones
export async function validateCoupon(code, subtotal) {
  if (!code) {
    return { valid: false, ok: false, message: 'Ingresa un cupón', tipo: null, valor: 0, descuento: 0 };
  }

  const url = new URL(`${API_BASE}/api/coupons/validate`);
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
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Error creando pedido');

  return data; // { ok: true, id: ... }
}

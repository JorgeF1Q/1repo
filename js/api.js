import { insert, select, SUPABASE_URL } from './supabase.js';

export const API_BASE = SUPABASE_URL;

function normalizeProduct(row) {
  return {
    Id: row.id ?? row.Id ?? row.producto_id ?? row.ID ?? row.id_producto,
    Codigo: row.codigo ?? row.Codigo ?? row.code ?? '',
    Nombre: row.nombre ?? row.Nombre ?? row.name ?? '',
    Precio: Number(row.precio ?? row.Precio ?? row.price ?? 0),
    Stock: Number(row.stock ?? row.Stock ?? row.existencias ?? 0),
    Activo: row.activo ?? row.Activo ?? row.enabled ?? true,
    Categoria: row.categoria ?? row.Categoria ?? row.category ?? '',
    Material: row.material ?? row.Material ?? row.material ?? '',
    ImagenUrl: row.imagen_url ?? row.ImagenUrl ?? row.image ?? '',
    Descripcion: row.descripcion ?? row.Descripcion ?? row.description ?? '',
  };
}

export async function getProducts() {
  const rows = await select('producto', '*', { order: 'id.asc' }).catch(() => select('producto', '*'));
  return rows.map(normalizeProduct);
}

export async function validateCoupon(code, subtotal = 0) {
  if (!code) {
    return { valid: false, ok: false, message: 'Ingresa un cupón', tipo: null, valor: 0, descuento: 0 };
  }

  try {
    const coupon = await select(
      'cupon',
      'cupon_id,codigo,tipo,valor,porcentaje,maximo,activo',
      { filter: { codigo: `eq.${code}` }, single: true }
    );

    if (!coupon || coupon.activo === false || coupon.activo === 'false') {
      return { valid: false, ok: false, message: 'Cupón inválido o inactivo', tipo: null, valor: 0, descuento: 0 };
    }

    const tipo = (coupon.tipo || (coupon.porcentaje ? 'porcentaje' : 'monto') || '').toLowerCase();
    const valor = Number(coupon.valor ?? coupon.porcentaje ?? 0);
    let descuento = 0;

    if (tipo === 'porcentaje') {
      descuento = (subtotal * valor) / 100;
      const maximo = Number(coupon.maximo ?? 0);
      if (maximo > 0) {
        descuento = Math.min(descuento, maximo);
      }
    } else {
      descuento = valor;
    }

    return {
      valid: true,
      ok: true,
      codigo: coupon.codigo,
      tipo,
      valor,
      descuento,
      message: 'Cupón aplicado correctamente',
    };
  } catch (err) {
    console.error('Error validando cupón', err);
    return { valid: false, ok: false, message: err.message || 'Error validando cupón', tipo: null, valor: 0, descuento: 0 };
  }
}

export async function createOrder(payload) {
  try {
    const [order] = await insert('orden', payload);
    return { ok: true, order };
  } catch (err) {
    console.error('Error creando orden', err);
    throw new Error(err.message || 'Error creando orden');
  }
}

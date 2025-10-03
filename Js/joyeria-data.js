import { getSupabaseClient } from './supabase-client.js';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLOR_PALETTE = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#a4de6c', '#d0ed57', '#ffa07a'];

function firstAvailable(obj, keys, fallback = undefined) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]+/g, '');
    if (!cleaned) return fallback;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
}

function getMonthParts(date) {
  const monthNumber = date.getMonth() + 1;
  return {
    monthNumber,
    monthName: MONTH_NAMES[monthNumber - 1] || 'Mes',
    monthAbbr: MONTH_ABBR[monthNumber - 1] || String(monthNumber),
    year: date.getFullYear()
  };
}

function formatISO(date) {
  return date ? date.toISOString().slice(0, 10) : '';
}

function guessRegion(addressEntries) {
  if (!addressEntries) {
    return 'Guatemala';
  }

  let address = '';
  if (Array.isArray(addressEntries)) {
    const envio = addressEntries.find(entry => {
      const type = String(firstAvailable(entry, ['tipo', 'type'], '')).toLowerCase();
      return type === 'envio' || type === 'shipping';
    });
    address = firstAvailable(envio || addressEntries[0], ['direccion', 'address', 'detalle', 'linea', 'line1'], '');
  } else if (typeof addressEntries === 'string') {
    address = addressEntries;
  } else if (typeof addressEntries === 'object') {
    address = firstAvailable(addressEntries, ['direccion', 'address', 'detalle'], '');
  }

  if (!address) return 'Guatemala';

  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return 'Guatemala';

  const last = parts[parts.length - 1];
  if (last.toLowerCase().includes('zona') && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return last || 'Guatemala';
}

function humanize(value, fallback = 'Pendiente') {
  if (!value && value !== 0) return fallback;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function formatCode(prefix, value) {
  if (value === null || value === undefined) return `${prefix}-—`;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `${prefix}-${String(numeric).padStart(3, '0')}`;
  }
  return `${prefix}-${String(value).trim()}`;
}

async function fetchTable(client, table) {
  const { data, error } = await client.from(table).select('*');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchJoyeriaData() {
  const client = getSupabaseClient();
  const tableDefs = [
    { key: 'orders', table: 'orden' },
    { key: 'orderDetails', table: 'orden_detalle' },
    { key: 'products', table: 'producto' },
    { key: 'categories', table: 'categoria' },
    { key: 'clients', table: 'cliente' },
    { key: 'addresses', table: 'direccion_cliente' },
    { key: 'suppliers', table: 'proveedor' },
    { key: 'supplierProducts', table: 'proveedor_producto' },
    { key: 'inventoryMovements', table: 'inventario_movimiento' },
    { key: 'returns', table: 'devolucion' },
    { key: 'payments', table: 'pago' },
    { key: 'orderPayments', table: 'orden_metodo_pago' },
    { key: 'paymentMethods', table: 'metodo_pago' },
    { key: 'paymentReceipts', table: 'comprobante_pago' },
    { key: 'purchases', table: 'compra' },
    { key: 'purchaseDetails', table: 'compra_detalle' },
    { key: 'shippers', table: 'transportista' },
    { key: 'shipments', table: 'envio' },
    { key: 'shipmentDetails', table: 'envio_detalle' }
  ];

  const results = await Promise.allSettled(tableDefs.map(def => fetchTable(client, def.table)));

  const tables = {};
  const warnings = [];
  results.forEach((result, index) => {
    const { key, table } = tableDefs[index];
    if (result.status === 'fulfilled') {
      tables[key] = result.value;
    } else {
      tables[key] = [];
      warnings.push(`${table}: ${result.reason?.message || 'no se pudo cargar'}`);
    }
  });

  const computed = computeAggregates(tables);
  return { tables, computed, warnings };
}

function computeAggregates(tables) {
  const orders = tables.orders || [];
  const orderDetails = tables.orderDetails || [];
  const products = tables.products || [];
  const categories = tables.categories || [];
  const clients = tables.clients || [];
  const addresses = tables.addresses || [];
  const supplierProducts = tables.supplierProducts || [];
  const inventoryMovements = tables.inventoryMovements || [];
  const returns = tables.returns || [];

  const orderMap = new Map();
  orders.forEach(order => {
    const id = firstAvailable(order, ['orden_id', 'id', 'order_id']);
    if (id !== undefined && id !== null) {
      orderMap.set(String(id), order);
    }
  });

  const productMap = new Map();
  products.forEach(product => {
    const id = firstAvailable(product, ['producto_id', 'id', 'product_id']);
    if (id !== undefined && id !== null) {
      productMap.set(String(id), product);
    }
  });

  const categoryMap = new Map();
  categories.forEach(category => {
    const id = firstAvailable(category, ['categoria_id', 'id', 'category_id']);
    if (id !== undefined && id !== null) {
      categoryMap.set(String(id), category);
    }
  });

  const clientMap = new Map();
  clients.forEach(client => {
    const id = firstAvailable(client, ['cliente_id', 'id', 'client_id']);
    if (id !== undefined && id !== null) {
      clientMap.set(String(id), client);
    }
  });

  const addressMap = new Map();
  addresses.forEach(address => {
    const clientId = firstAvailable(address, ['cliente_id', 'client_id']);
    if (clientId === null || clientId === undefined) return;
    const key = String(clientId);
    if (!addressMap.has(key)) {
      addressMap.set(key, []);
    }
    addressMap.get(key).push(address);
  });

  const costMap = new Map();
  supplierProducts.forEach(row => {
    const productId = firstAvailable(row, ['producto_id', 'product_id']);
    if (productId === null || productId === undefined) return;
    const cost = toNumber(firstAvailable(row, ['costo', 'cost', 'precio']), 0);
    const key = String(productId);
    if (!costMap.has(key) || cost < costMap.get(key)) {
      costMap.set(key, cost);
    }
  });

  const orderTotals = new Map();
  const orderProfit = new Map();
  const orderProducts = new Map();
  const monthlyMap = new Map();
  const categoryTotals = new Map();
  const countryTotals = new Map();

  const records = [];

  orderDetails.forEach(detail => {
    const orderId = firstAvailable(detail, ['orden_id', 'order_id', 'id_orden']);
    const productId = firstAvailable(detail, ['producto_id', 'product_id']);
    if (orderId === null || orderId === undefined || productId === null || productId === undefined) {
      return;
    }
    const orderKey = String(orderId);
    const productKey = String(productId);
    const order = orderMap.get(orderKey);
    const product = productMap.get(productKey);
    if (!order || !product) return;

    const clientId = firstAvailable(order, ['cliente_id', 'client_id', 'clienteId']);
    const clientKey = clientId === null || clientId === undefined ? null : String(clientId);
    const quantity = toNumber(firstAvailable(detail, ['cantidad', 'quantity', 'qty', 'unidades']), 0);
    const unitPrice = toNumber(firstAvailable(detail, ['precio_unitario', 'precio', 'price', 'importe']), toNumber(firstAvailable(product, ['precio', 'price']), 0));
    const grossSales = quantity * unitPrice;
    const discountTotal = toNumber(firstAvailable(order, ['descuento', 'descuentos', 'discount']), 0);
    const discounts = discountTotal > 0 ? discountTotal : 0;
    const sales = grossSales - discounts;
    const cost = costMap.get(productKey);
    const manufacturingPrice = cost && cost > 0 ? cost : Math.round(unitPrice * 0.55 * 100) / 100;
    const cogs = manufacturingPrice * quantity;
    const profit = sales - cogs;

    const rawDate = firstAvailable(order, ['fecha', 'fecha_creacion', 'created_at', 'fecha_registro', 'fecha_pago']);
    const date = parseDate(rawDate) || parseDate(firstAvailable(detail, ['fecha', 'created_at'])) || new Date();
    const { monthNumber, monthName, monthAbbr, year } = getMonthParts(date);

    const categoryId = firstAvailable(product, ['categoria_id', 'category_id']);
    const category = categoryMap.get(String(categoryId));
    const segment = category?.nombre || category?.name || 'Sin categoría';
    const country = guessRegion(addressMap.get(clientKey));

    if (!orderTotals.has(orderKey)) {
      orderTotals.set(orderKey, 0);
    }
    orderTotals.set(orderKey, orderTotals.get(orderKey) + sales);

    if (!orderProfit.has(orderKey)) {
      orderProfit.set(orderKey, 0);
    }
    orderProfit.set(orderKey, orderProfit.get(orderKey) + profit);

    if (!orderProducts.has(orderKey)) {
      orderProducts.set(orderKey, product?.nombre || product?.name || `Producto ${productKey}`);
    }

    const monthKey = `${year}-${String(monthNumber).padStart(2, '0')}`;
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        label: `${monthName} ${year}`,
        abbr: monthAbbr,
        ventas: 0,
        profit: 0,
        orders: new Set(),
        clients: new Set()
      });
    }
    const monthEntry = monthlyMap.get(monthKey);
    monthEntry.ventas += sales;
    monthEntry.profit += profit;
    monthEntry.orders.add(orderKey);
    if (clientKey) {
      monthEntry.clients.add(clientKey);
    }

    if (!categoryTotals.has(segment)) {
      categoryTotals.set(segment, { ventas: 0, profit: 0, unidades: 0 });
    }
    const categoryEntry = categoryTotals.get(segment);
    categoryEntry.ventas += sales;
    categoryEntry.profit += profit;
    categoryEntry.unidades += quantity;

    if (!countryTotals.has(country)) {
      countryTotals.set(country, { ventas: 0, profit: 0 });
    }
    const countryEntry = countryTotals.get(country);
    countryEntry.ventas += sales;
    countryEntry.profit += profit;

    records.push({
      orderId: orderId,
      clientId,
      segment,
      country,
      product: product?.nombre || product?.name || `Producto ${productKey}`,
      discountBand: discounts > 0 ? 'Con descuento' : 'Sin descuento',
      unitsSold: quantity,
      manufacturingPrice,
      salePrice: unitPrice,
      grossSales,
      discounts,
      sales,
      cogs,
      profit,
      date: date.toISOString(),
      monthNumber,
      monthName,
      monthAbbr,
      year
    });
  });

  const sortedMonthKeys = Array.from(monthlyMap.keys()).sort();
  const salesData = sortedMonthKeys.map(key => {
    const entry = monthlyMap.get(key);
    return {
      month: entry.abbr,
      label: entry.label,
      ventas: entry.ventas,
      ordenes: entry.orders.size,
      clientes: entry.clients.size,
      profit: entry.profit
    };
  });

  const totalSales = salesData.reduce((sum, row) => sum + row.ventas, 0);
  const totalOrders = salesData.reduce((sum, row) => sum + row.ordenes, 0);
  const totalClients = salesData.reduce((max, row) => Math.max(max, row.clientes), 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const last = salesData[salesData.length - 1] || { ventas: 0, ordenes: 0 };
  const prev = salesData[salesData.length - 2] || last;
  const salesGrowth = prev.ventas ? ((last.ventas - prev.ventas) / prev.ventas) * 100 : 0;
  const ordersGrowth = prev.ordenes ? ((last.ordenes - prev.ordenes) / prev.ordenes) * 100 : 0;

  const totalCategorySales = Array.from(categoryTotals.values()).reduce((sum, entry) => sum + entry.ventas, 0);
  const productCategories = Array.from(categoryTotals.entries())
    .map(([name, entry], index) => ({
      name,
      value: totalCategorySales > 0 ? Number(((entry.ventas / totalCategorySales) * 100).toFixed(1)) : 0,
      ventas: entry.ventas,
      profit: entry.profit,
      unidades: entry.unidades,
      color: COLOR_PALETTE[index % COLOR_PALETTE.length]
    }))
    .sort((a, b) => b.ventas - a.ventas);

  const clientStats = new Map();
  orders.forEach(order => {
    const orderId = firstAvailable(order, ['orden_id', 'id']);
    const clientId = firstAvailable(order, ['cliente_id', 'client_id']);
    if (orderId === null || orderId === undefined || clientId === null || clientId === undefined) return;
    const orderKey = String(orderId);
    const clientKey = String(clientId);
    const stats = clientStats.get(clientKey) || { total: 0, compras: 0, ultimaCompra: null };
    stats.total += orderTotals.get(orderKey) ?? toNumber(firstAvailable(order, ['total', 'monto_total', 'importe']), 0);
    stats.compras += 1;
    const orderDate = parseDate(firstAvailable(order, ['fecha', 'created_at', 'fecha_creacion']));
    if (orderDate && (!stats.ultimaCompra || orderDate > stats.ultimaCompra)) {
      stats.ultimaCompra = orderDate;
    }
    clientStats.set(clientKey, stats);
  });

  const topClients = Array.from(clientStats.entries())
    .map(([clientId, stats]) => {
      const client = clientMap.get(clientId);
      return {
        id: clientId,
        nombre: client?.nombre || client?.name || `Cliente ${clientId}`,
        compras: stats.compras,
        total: stats.total,
        ultimaCompra: stats.ultimaCompra ? formatISO(stats.ultimaCompra) : ''
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const recentOrders = [...orders]
    .map(order => {
      const orderId = firstAvailable(order, ['orden_id', 'id']);
      const orderKey = String(orderId);
      const clientId = firstAvailable(order, ['cliente_id', 'client_id']);
      const client = clientMap.get(String(clientId));
      const date = parseDate(firstAvailable(order, ['fecha', 'created_at', 'fecha_creacion', 'fecha_registro']));
      return {
        raw: order,
        orderId,
        orderKey,
        cliente: client?.nombre || client?.name || `Cliente ${clientId}`,
        estado: humanize(firstAvailable(order, ['estado', 'status']), 'Pendiente'),
        fecha: date,
        monto: orderTotals.get(orderKey) ?? toNumber(firstAvailable(order, ['total', 'monto_total', 'importe']), 0)
      };
    })
    .sort((a, b) => {
      const dateA = a.fecha ? a.fecha.getTime() : 0;
      const dateB = b.fecha ? b.fecha.getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 6)
    .map(entry => ({
      id: formatCode('ORD', entry.orderId),
      cliente: entry.cliente,
      producto: orderProducts.get(entry.orderKey) || '—',
      monto: entry.monto,
      estado: entry.estado,
      fecha: entry.fecha ? formatISO(entry.fecha) : ''
    }));

  const lowStockProducts = products
    .map(product => ({
      nombre: product?.nombre || product?.name || 'Producto',
      stock: toNumber(firstAvailable(product, ['stock', 'cantidad']), 0)
    }))
    .filter(item => item.stock <= 15)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)
    .map(item => ({
      ...item,
      level: item.stock <= 3 ? 'low' : item.stock <= 8 ? 'medium' : 'ok'
    }));

  const inventoryByProduct = new Map();
  inventoryMovements.forEach(movement => {
    const productId = firstAvailable(movement, ['producto_id', 'product_id']);
    if (productId === null || productId === undefined) return;
    const key = String(productId);
    if (!inventoryByProduct.has(key)) {
      inventoryByProduct.set(key, { entradas: 0, salidas: 0 });
    }
    const entry = inventoryByProduct.get(key);
    const quantity = toNumber(firstAvailable(movement, ['cantidad', 'quantity', 'qty']), 0);
    const type = String(firstAvailable(movement, ['tipo', 'type'], '')).toLowerCase();
    if (type === 'entrada' || type === 'in') {
      entry.entradas += quantity;
    } else {
      entry.salidas += quantity;
    }
  });

  const returnsByProduct = new Map();
  returns.forEach(row => {
    const detailId = firstAvailable(row, ['orden_detalle_id', 'detalle_id']);
    if (!detailId) return;
    returnsByProduct.set(String(detailId), humanize(firstAvailable(row, ['motivo', 'reason']), 'Sin motivo'));
  });

  return {
    records,
    salesData,
    productCategories,
    topClients,
    recentOrders,
    lowStockProducts,
    orderTotals,
    orderProfit,
    orderProducts,
    orders,
    orderDetails,
    products,
    categories,
    clients,
    addresses,
    supplierProducts,
    inventoryMovements,
    returns,
    countryTotals,
    metrics: {
      totalSales,
      totalOrders,
      totalClients,
      avgOrderValue,
      salesGrowth,
      ordersGrowth
    }
  };
}

const dataset = {
  reportesKpi: [],
  roles: [],
  permisos: [],
  rolPermisos: [],
  usuarios: [],
  bitacoraAccion: [],
  auditoria: [],
  categorias: [],
  materiales: [],
  productos: [],
  productoMaterial: [],
  imagenesProducto: [],
  inventarioMovimientos: [],
  clientes: [],
  direccionesCliente: [],
  eventosCliente: [],
  notificaciones: [],
  clienteNotificacion: [],
  chatbotLogs: [],
  carritos: [],
  carritoDetalle: [],
  ordenes: [],
  ordenDetalle: [],
  devoluciones: [],
  metodosPago: [],
  pagos: [],
  ordenMetodoPago: [],
  comprobantesPago: [],
  proveedores: [],
  proveedorProducto: [],
  compras: [],
  compraDetalle: [],
  transportistas: [],
  envios: [],
  envioDetalle: []
};

let client = null;
let datasetWarnings = [];

const INFO_CONTAINERS = [
  'dashboardKpiGrid',
  'productSummaryCards',
  'salesSummaryCards',
  'revenueSummaryCards'
];

const TABLE_IDS = [
  'dashboardRolesTable',
  'dashboardPermisosTable',
  'dashboardUsuariosTable',
  'dashboardBitacoraTable',
  'dashboardAuditoriaTable',
  'datasetProductosTable',
  'datasetCategoriasTable',
  'datasetMaterialesTable',
  'datasetMovimientosTable',
  'salesClientesTable',
  'salesEventosTable',
  'salesNotificacionesTable',
  'salesChatbotTable',
  'salesOrdenesTable',
  'salesDetalleTable',
  'salesDevolucionesTable',
  'revenuePagosTable',
  'revenueOrdenMetodoTable',
  'revenueMetodosTable',
  'revenueComprobantesTable',
  'revenueComprasTable',
  'revenueCompraDetalleTable',
  'revenueEnviosTable',
  'revenueEnvioDetalleTable'
];

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const number = new Intl.NumberFormat('es-GT');

function normalizeId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }
  return value;
}

function stringOr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]+/g, '');
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeEstado(value) {
  if (typeof value === 'boolean') {
    return value ? 'Activo' : 'Inactivo';
  }
  const text = stringOr(value, 'Activo');
  if (!text) return 'Activo';
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function idsEqual(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

function findById(collection, id, key = 'id') {
  if (!Array.isArray(collection)) return undefined;
  return collection.find(item => idsEqual(item[key], id));
}

function formatCode(prefix, value) {
  const normalized = normalizeId(value);
  if (normalized === null || normalized === undefined) return '—';
  if (typeof normalized === 'number' && Number.isFinite(normalized)) {
    return `${prefix}-${normalized.toString().padStart(3, '0')}`;
  }
  const text = String(normalized).trim();
  return text ? `${prefix}-${text}` : '—';
}

function humanize(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/_/g, ' ')
    .replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
}

function setTableMessage(tableId, message, tone = 'muted') {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const cols = table.querySelectorAll('thead th').length || 1;
  const toneClass = tone === 'error' ? 'text-danger' : tone === 'info' ? 'text-info' : 'text-muted';
  tbody.innerHTML = `
    <tr>
      <td colspan="${cols}" class="text-center ${toneClass} py-3">${message}</td>
    </tr>
  `;
}

function fillTable(tableId, rows, renderRow, emptyMessage = 'Sin datos registrados.') {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  if (!rows || !rows.length) {
    const cols = table.querySelectorAll('thead th').length || 1;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted py-3">${emptyMessage}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(renderRow).join('');
}

function renderInfoCards(containerId, cards, emptyMessage = 'Sin datos disponibles.') {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!cards || !cards.length) {
    container.innerHTML = `
      <article class="info-card">
        <h3>${emptyMessage}</h3>
        <strong></strong>
        <span></span>
      </article>
    `;
    return;
  }

  container.innerHTML = cards
    .map(card => `
      <article class="info-card">
        <h3>${card.title}</h3>
        <strong>${card.value}</strong>
        <span>${card.caption ?? ''}</span>
      </article>
    `)
    .join('');
}

function showLoadingState() {
  const card = {
    title: 'Conectando a Supabase…',
    value: 'Cargando',
    caption: 'Obteniendo datos en vivo.'
  };
  INFO_CONTAINERS.forEach(id => renderInfoCards(id, [card]));
  TABLE_IDS.forEach(id => setTableMessage(id, 'Cargando datos desde Supabase…', 'info'));
}

function showConfigMissingState() {
  const card = {
    title: 'Configura Supabase',
    value: 'Datos no disponibles',
    caption: 'Copia Js/config.sample.js como Js/config.js y agrega tu anon key.'
  };
  INFO_CONTAINERS.forEach(id => renderInfoCards(id, [card]));
  TABLE_IDS.forEach(id => setTableMessage(id, 'Configura tu URL y anon key de Supabase en Js/config.js.', 'error'));
}

function showErrorState(message) {
  const card = {
    title: 'Error al cargar datos',
    value: 'Sin conexión',
    caption: message
  };
  INFO_CONTAINERS.forEach(id => renderInfoCards(id, [card]));
  TABLE_IDS.forEach(id => setTableMessage(id, 'No se pudieron recuperar los datos de Supabase.', 'error'));
}

function mapRole(row) {
  return {
    id: normalizeId(row?.rol_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    descripcion: stringOr(row?.descripcion ?? row?.description, ''),
    nivel: row?.nivel ?? row?.level ?? null
  };
}

function mapPermiso(row) {
  const nombre = stringOr(row?.nombre ?? row?.codigo ?? row?.name);
  return {
    id: normalizeId(row?.permiso_id ?? row?.id),
    nombre,
    codigo: stringOr(row?.codigo ?? nombre),
    categoria: stringOr(row?.categoria ?? ''),
    descripcion: stringOr(row?.descripcion ?? '')
  };
}

function mapRolPermiso(row) {
  return {
    rolId: normalizeId(row?.rol_id ?? row?.rolId ?? row?.role_id),
    permisoId: normalizeId(row?.permiso_id ?? row?.permisoId ?? row?.permission_id)
  };
}

function mapUsuario(row) {
  return {
    id: normalizeId(row?.usuario_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    email: stringOr(row?.email ?? row?.correo ?? ''),
    telefono: stringOr(row?.telefono ?? row?.phone ?? ''),
    rolId: normalizeId(row?.rol_id ?? row?.role_id),
    estado: normalizeEstado(row?.estado ?? row?.status ?? row?.activo),
    ultimoAcceso: row?.ultimo_acceso ?? row?.last_login_at ?? row?.updated_at ?? null
  };
}

function mapBitacora(row) {
  return {
    id: normalizeId(row?.bitacora_id ?? row?.id),
    usuarioId: normalizeId(row?.usuario_id ?? row?.usuarioId),
    accion: stringOr(row?.accion ?? row?.action),
    fecha: row?.fecha ?? row?.created_at ?? null
  };
}

function mapAuditoria(row) {
  return {
    id: normalizeId(row?.auditoria_id ?? row?.id),
    usuarioId: normalizeId(row?.usuario_id ?? row?.usuarioId),
    descripcion: stringOr(row?.descripcion ?? row?.detalle ?? ''),
    fecha: row?.fecha ?? row?.created_at ?? null
  };
}

function mapCategoria(row) {
  return {
    id: normalizeId(row?.categoria_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name)
  };
}

function mapMaterial(row) {
  return {
    id: normalizeId(row?.material_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name)
  };
}

function mapProducto(row) {
  return {
    id: normalizeId(row?.producto_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    descripcion: stringOr(row?.descripcion ?? row?.description, ''),
    precio: toNumber(row?.precio ?? row?.price),
    stock: toNumber(row?.stock ?? row?.existencia ?? row?.cantidad),
    categoriaId: normalizeId(row?.categoria_id ?? row?.categoriaId ?? row?.category_id)
  };
}

function mapProductoMaterial(row) {
  return {
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    materialId: normalizeId(row?.material_id ?? row?.materialId),
    porcentaje: toNumber(row?.porcentaje ?? row?.porcentaje_composicion ?? row?.porcentaje_material ?? 0)
  };
}

function mapImagenProducto(row) {
  return {
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    url: stringOr(row?.url ?? row?.imagen ?? row?.image_url ?? '')
  };
}

function mapInventarioMovimiento(row) {
  return {
    id: normalizeId(row?.movimiento_id ?? row?.id),
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    tipo: stringOr(row?.tipo ?? row?.type).toLowerCase(),
    cantidad: toNumber(row?.cantidad ?? row?.quantity),
    fecha: row?.fecha ?? row?.created_at ?? null
  };
}

function mapCliente(row) {
  return {
    id: normalizeId(row?.cliente_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    email: stringOr(row?.email ?? row?.correo ?? ''),
    telefono: stringOr(row?.telefono ?? row?.phone ?? '')
  };
}

function mapDireccionCliente(row) {
  return {
    id: normalizeId(row?.direccion_id ?? row?.id),
    clienteId: normalizeId(row?.cliente_id ?? row?.clienteId),
    tipo: stringOr(row?.tipo ?? row?.type),
    direccion: stringOr(row?.direccion ?? row?.address ?? '')
  };
}

function mapEventoCliente(row) {
  return {
    id: normalizeId(row?.evento_id ?? row?.id),
    clienteId: normalizeId(row?.cliente_id ?? row?.clienteId),
    tipo: stringOr(row?.tipo ?? row?.type),
    fecha: stringOr(row?.fecha ?? row?.event_date ?? '')
  };
}

function mapNotificacion(row) {
  return {
    id: normalizeId(row?.notificacion_id ?? row?.id),
    titulo: stringOr(row?.titulo ?? row?.title),
    mensaje: stringOr(row?.mensaje ?? row?.message ?? '')
  };
}

function mapClienteNotificacion(row) {
  return {
    clienteId: normalizeId(row?.cliente_id ?? row?.clienteId),
    notificacionId: normalizeId(row?.notificacion_id ?? row?.notificacionId)
  };
}

function mapChatbotLog(row) {
  return {
    id: normalizeId(row?.log_id ?? row?.id),
    clienteId: normalizeId(row?.cliente_id ?? row?.clienteId),
    mensaje: stringOr(row?.mensaje ?? row?.message)
  };
}

function mapCarrito(row) {
  return {
    id: normalizeId(row?.carrito_id ?? row?.id),
    clienteId: normalizeId(row?.cliente_id ?? row?.clienteId)
  };
}

function mapCarritoDetalle(row) {
  return {
    id: normalizeId(row?.detalle_id ?? row?.id),
    carritoId: normalizeId(row?.carrito_id ?? row?.carritoId),
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    cantidad: toNumber(row?.cantidad ?? row?.quantity),
    precioUnitario: toNumber(row?.precio_unitario ?? row?.precio ?? row?.price)
  };
}

function mapOrden(row) {
  return {
    id: normalizeId(row?.orden_id ?? row?.id),
    clienteId: normalizeId(row?.cliente_id ?? row?.clienteId),
    estado: stringOr(row?.estado ?? row?.status ?? '').toLowerCase(),
    total: toNumber(row?.total ?? row?.monto ?? row?.amount)
  };
}

function mapOrdenDetalle(row) {
  return {
    id: normalizeId(row?.detalle_id ?? row?.id),
    ordenId: normalizeId(row?.orden_id ?? row?.ordenId),
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    cantidad: toNumber(row?.cantidad ?? row?.quantity),
    precioUnitario: toNumber(row?.precio_unitario ?? row?.precio ?? row?.price)
  };
}

function mapDevolucion(row) {
  return {
    id: normalizeId(row?.devolucion_id ?? row?.id),
    ordenDetalleId: normalizeId(row?.orden_detalle_id ?? row?.detalle_id ?? row?.ordenDetalleId),
    motivo: stringOr(row?.motivo ?? row?.reason)
  };
}

function mapMetodoPago(row) {
  return {
    id: normalizeId(row?.metodo_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name)
  };
}

function mapPago(row) {
  const estado = stringOr(row?.estado ?? row?.status ?? 'pendiente').toLowerCase();
  return {
    id: normalizeId(row?.pago_id ?? row?.id),
    ordenId: normalizeId(row?.orden_id ?? row?.ordenId),
    monto: toNumber(row?.monto ?? row?.total ?? row?.amount),
    estado
  };
}

function mapOrdenMetodoPago(row) {
  return {
    ordenId: normalizeId(row?.orden_id ?? row?.ordenId),
    metodoId: normalizeId(row?.metodo_id ?? row?.metodoId ?? row?.payment_method_id),
    monto: toNumber(row?.monto ?? row?.amount)
  };
}

function mapComprobantePago(row) {
  return {
    id: normalizeId(row?.comprobante_id ?? row?.id),
    pagoId: normalizeId(row?.pago_id ?? row?.pagoId),
    url: stringOr(row?.url ?? row?.archivo ?? row?.file_url ?? '')
  };
}

function mapProveedor(row) {
  return {
    id: normalizeId(row?.proveedor_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    nit: stringOr(row?.nit ?? ''),
    telefono: stringOr(row?.telefono ?? row?.phone ?? ''),
    direccion: stringOr(row?.direccion ?? row?.address ?? '')
  };
}

function mapProveedorProducto(row) {
  return {
    proveedorId: normalizeId(row?.proveedor_id ?? row?.proveedorId),
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    costo: toNumber(row?.costo ?? row?.precio ?? row?.cost),
    tiempoEntrega: toNumber(row?.tiempo_entrega ?? row?.lead_time ?? 0)
  };
}

function mapCompra(row) {
  return {
    id: normalizeId(row?.compra_id ?? row?.id),
    proveedorId: normalizeId(row?.proveedor_id ?? row?.proveedorId),
    total: toNumber(row?.total ?? row?.monto ?? row?.amount)
  };
}

function mapCompraDetalle(row) {
  return {
    id: normalizeId(row?.detalle_id ?? row?.id),
    compraId: normalizeId(row?.compra_id ?? row?.compraId),
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    cantidad: toNumber(row?.cantidad ?? row?.quantity),
    precioUnitario: toNumber(row?.precio_unitario ?? row?.precio ?? row?.price)
  };
}

function mapTransportista(row) {
  return {
    id: normalizeId(row?.transportista_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    telefono: stringOr(row?.telefono ?? row?.phone ?? '')
  };
}

function mapEnvio(row) {
  return {
    id: normalizeId(row?.envio_id ?? row?.id),
    ordenId: normalizeId(row?.orden_id ?? row?.ordenId),
    transportistaId: normalizeId(row?.transportista_id ?? row?.transportistaId),
    estado: stringOr(row?.estado ?? row?.status ?? '').toLowerCase(),
    tracking: stringOr(row?.tracking ?? row?.codigo_tracking ?? row?.tracking_code ?? '')
  };
}

function mapEnvioDetalle(row) {
  return {
    id: normalizeId(row?.detalle_id ?? row?.id),
    envioId: normalizeId(row?.envio_id ?? row?.envioId),
    productoId: normalizeId(row?.producto_id ?? row?.productoId),
    cantidad: toNumber(row?.cantidad ?? row?.quantity)
  };
}

function mapReporteKpi(row) {
  return {
    id: normalizeId(row?.kpi_id ?? row?.id),
    nombre: stringOr(row?.nombre ?? row?.name),
    valor: stringOr(row?.valor ?? row?.value ?? '')
  };
}

const TABLE_MAPPERS = [
  { key: 'reportesKpi', table: 'reportes_kpi', mapper: mapReporteKpi },
  { key: 'roles', table: 'rol', mapper: mapRole },
  { key: 'permisos', table: 'permiso', mapper: mapPermiso },
  { key: 'rolPermisos', table: 'rol_permiso', mapper: mapRolPermiso },
  { key: 'usuarios', table: 'usuario', mapper: mapUsuario },
  { key: 'bitacoraAccion', table: 'bitacora_accion', mapper: mapBitacora },
  { key: 'auditoria', table: 'auditoria', mapper: mapAuditoria },
  { key: 'categorias', table: 'categoria', mapper: mapCategoria },
  { key: 'materiales', table: 'material', mapper: mapMaterial },
  { key: 'productos', table: 'producto', mapper: mapProducto },
  { key: 'productoMaterial', table: 'producto_material', mapper: mapProductoMaterial },
  { key: 'imagenesProducto', table: 'imagenes_producto', mapper: mapImagenProducto },
  { key: 'inventarioMovimientos', table: 'inventario_movimiento', mapper: mapInventarioMovimiento },
  { key: 'clientes', table: 'cliente', mapper: mapCliente },
  { key: 'direccionesCliente', table: 'direccion_cliente', mapper: mapDireccionCliente },
  { key: 'eventosCliente', table: 'eventos_cliente', mapper: mapEventoCliente },
  { key: 'notificaciones', table: 'notificacion', mapper: mapNotificacion },
  { key: 'clienteNotificacion', table: 'cliente_notificacion', mapper: mapClienteNotificacion },
  { key: 'chatbotLogs', table: 'chatbot_logs', mapper: mapChatbotLog },
  { key: 'carritos', table: 'carrito', mapper: mapCarrito },
  { key: 'carritoDetalle', table: 'carrito_detalle', mapper: mapCarritoDetalle },
  { key: 'ordenes', table: 'orden', mapper: mapOrden },
  { key: 'ordenDetalle', table: 'orden_detalle', mapper: mapOrdenDetalle },
  { key: 'devoluciones', table: 'devolucion', mapper: mapDevolucion },
  { key: 'metodosPago', table: 'metodo_pago', mapper: mapMetodoPago },
  { key: 'pagos', table: 'pago', mapper: mapPago },
  { key: 'ordenMetodoPago', table: 'orden_metodo_pago', mapper: mapOrdenMetodoPago },
  { key: 'comprobantesPago', table: 'comprobante_pago', mapper: mapComprobantePago },
  { key: 'proveedores', table: 'proveedor', mapper: mapProveedor },
  { key: 'proveedorProducto', table: 'proveedor_producto', mapper: mapProveedorProducto },
  { key: 'compras', table: 'compra', mapper: mapCompra },
  { key: 'compraDetalle', table: 'compra_detalle', mapper: mapCompraDetalle },
  { key: 'transportistas', table: 'transportista', mapper: mapTransportista },
  { key: 'envios', table: 'envio', mapper: mapEnvio },
  { key: 'envioDetalle', table: 'envio_detalle', mapper: mapEnvioDetalle }
];

async function loadDataset() {
  const errors = [];
  await Promise.all(
    TABLE_MAPPERS.map(async ({ key, table, mapper }) => {
      try {
        const { data, error } = await client.from(table).select('*');
        if (error) throw error;
        dataset[key] = Array.isArray(data) ? data.map(mapper) : [];
      } catch (error) {
        dataset[key] = [];
        const message = error?.message ?? String(error ?? 'Error desconocido');
        errors.push(`${table}: ${message}`);
        console.error(`[dashboard] Error cargando tabla ${table}`, error);
      }
    })
  );

  if (errors.length === TABLE_MAPPERS.length) {
    throw new Error('No se pudo cargar ninguna tabla desde Supabase. Verifica tus credenciales y conexión.');
  }

  return errors;
}

function buildWarningCard() {
  if (!datasetWarnings.length) return null;
  const preview = datasetWarnings.slice(0, 2).join(' · ');
  const suffix = datasetWarnings.length > 2 ? ` · +${datasetWarnings.length - 2} tablas` : '';
  return {
    title: 'Advertencia de datos',
    value: `${datasetWarnings.length} tabla(s) con incidencia`,
    caption: `${preview}${suffix}`
  };
}

function renderDashboard() {
  const warningCard = buildWarningCard();
  const cards = dataset.reportesKpi.map(kpi => ({
    title: kpi.nombre,
    value: kpi.valor,
    caption: 'Dato proveniente de reportes_kpi'
  }));
  renderInfoCards('dashboardKpiGrid', warningCard ? [warningCard, ...cards] : cards, datasetWarnings.length ? 'Advertencias registradas' : 'No hay KPIs configurados.');

  const permisoMap = new Map(dataset.permisos.map(p => [String(p.id), p]));
  const rolRows = dataset.roles.map(rol => {
    const permisos = dataset.rolPermisos
      .filter(rp => idsEqual(rp.rolId, rol.id))
      .map(rp => {
        const permiso = permisoMap.get(String(rp.permisoId));
        const nombre = permiso?.nombre || permiso?.codigo || '';
        return humanize(nombre.toLowerCase());
      })
      .filter(Boolean);
    return {
      rol: rol.nombre,
      permisos: permisos.length ? permisos.join(', ') : 'Sin permisos asignados'
    };
  });

  fillTable('dashboardRolesTable', rolRows, row => `
    <tr>
      <td>${row.rol}</td>
      <td>${row.permisos}</td>
    </tr>
  `);

  fillTable('dashboardPermisosTable', dataset.permisos, permiso => {
    const nombre = permiso.nombre || permiso.codigo || 'Permiso';
    const descripcion = permiso.descripcion
      ? permiso.descripcion
      : nombre.includes('_')
        ? `Permite ${humanize(nombre).toLowerCase()}`
        : 'Permiso operativo';
    return `
      <tr>
        <td>${humanize(nombre)}</td>
        <td>${descripcion}</td>
      </tr>
    `;
  });

  const rolMap = new Map(dataset.roles.map(r => [String(r.id), r.nombre]));
  fillTable('dashboardUsuariosTable', dataset.usuarios, usuario => `
    <tr>
      <td>${usuario.nombre}</td>
      <td>${usuario.email}</td>
      <td>${rolMap.get(String(usuario.rolId)) ?? '—'}</td>
      <td>${usuario.estado}</td>
    </tr>
  `);

  fillTable('dashboardBitacoraTable', dataset.bitacoraAccion, bitacora => {
    const usuario = findById(dataset.usuarios, bitacora.usuarioId);
    return `
      <tr>
        <td>${usuario?.nombre ?? '—'}</td>
        <td>${bitacora.accion}</td>
      </tr>
    `;
  });

  fillTable('dashboardAuditoriaTable', dataset.auditoria, registro => {
    const usuario = findById(dataset.usuarios, registro.usuarioId);
    return `
      <tr>
        <td>${usuario?.nombre ?? '—'}</td>
        <td>${registro.descripcion}</td>
      </tr>
    `;
  });
}

function renderProductos() {
  const stockTotal = dataset.productos.reduce((acc, p) => acc + toNumber(p.stock), 0);
  const valorInventario = dataset.productos.reduce((acc, p) => acc + toNumber(p.precio) * toNumber(p.stock), 0);
  const entradas = dataset.inventarioMovimientos.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + toNumber(m.cantidad), 0);
  const salidas = dataset.inventarioMovimientos.filter(m => m.tipo === 'salida').reduce((acc, m) => acc + toNumber(m.cantidad), 0);

  renderInfoCards('productSummaryCards', [
    { title: 'Productos activos', value: number.format(dataset.productos.length), caption: 'Registros en catálogo' },
    { title: 'Stock disponible', value: `${number.format(stockTotal)} uds`, caption: 'Unidades totales' },
    { title: 'Valor inventario', value: money.format(valorInventario), caption: 'Precio x stock actual' },
    { title: 'Movimientos netos', value: `${number.format(entradas - salidas)} uds`, caption: 'Entradas menos salidas' }
  ]);

  const categoriaMap = new Map(dataset.categorias.map(c => [String(c.id), c.nombre]));
  const productoMaterialMap = new Map(dataset.productoMaterial.map(pm => [String(pm.productoId), pm.materialId]));
  const materialMap = new Map(dataset.materiales.map(m => [String(m.id), m.nombre]));

  const productoRows = dataset.productos.map(producto => ({
    nombre: producto.nombre,
    categoria: categoriaMap.get(String(producto.categoriaId)) ?? '—',
    material: materialMap.get(String(productoMaterialMap.get(String(producto.id)))) ?? '—',
    precio: toNumber(producto.precio),
    stock: toNumber(producto.stock)
  }));

  fillTable('datasetProductosTable', productoRows, row => `
    <tr>
      <td>${row.nombre}</td>
      <td>${row.categoria}</td>
      <td>${row.material}</td>
      <td>${money.format(row.precio)}</td>
      <td>${number.format(row.stock)}</td>
    </tr>
  `);

  const categoriaRows = dataset.categorias.map(cat => {
    const count = dataset.productos.filter(p => idsEqual(p.categoriaId, cat.id)).length;
    return { nombre: cat.nombre, count };
  });
  fillTable('datasetCategoriasTable', categoriaRows, row => `
    <tr>
      <td>${row.nombre}</td>
      <td>${number.format(row.count)}</td>
    </tr>
  `);

  const materialRows = dataset.materiales.map(mat => {
    const productoRelacionado = dataset.productoMaterial.find(pm => idsEqual(pm.materialId, mat.id));
    const productoNombre = productoRelacionado ? findById(dataset.productos, productoRelacionado.productoId)?.nombre : null;
    return {
      nombre: mat.nombre,
      uso: productoNombre ?? 'Pendiente de asignación'
    };
  });
  fillTable('datasetMaterialesTable', materialRows, row => `
    <tr>
      <td>${row.nombre}</td>
      <td>${row.uso}</td>
    </tr>
  `);

  const movimientoRows = dataset.inventarioMovimientos.map(mov => ({
    producto: findById(dataset.productos, mov.productoId)?.nombre ?? '—',
    tipo: humanize(mov.tipo),
    cantidad: toNumber(mov.cantidad)
  }));
  fillTable('datasetMovimientosTable', movimientoRows, row => `
    <tr>
      <td>${row.producto}</td>
      <td>${row.tipo}</td>
      <td>${number.format(row.cantidad)}</td>
    </tr>
  `);
}

function renderVentas() {
  const totalClientes = dataset.clientes.length;
  const totalCarritos = dataset.carritos.length;
  const totalOrdenes = dataset.ordenes.length;
  const totalIngresos = dataset.ordenes.reduce((acc, ord) => acc + toNumber(ord.total), 0);

  const completadas = dataset.ordenes.filter(o => {
    const estado = stringOr(o.estado, '').toLowerCase();
    return ['pagado', 'enviado', 'entregado', 'completado'].includes(estado);
  }).length;

  renderInfoCards('salesSummaryCards', [
    { title: 'Clientes activos', value: number.format(totalClientes), caption: 'Registrados en CRM' },
    { title: 'Carritos abiertos', value: number.format(totalCarritos), caption: 'En seguimiento' },
    { title: 'Órdenes generadas', value: number.format(totalOrdenes), caption: `${number.format(completadas)} completadas` },
    { title: 'Ventas proyectadas', value: money.format(totalIngresos), caption: 'Total órdenes registradas' }
  ]);

  fillTable('salesClientesTable', dataset.clientes, cliente => `
    <tr>
      <td>${cliente.nombre}</td>
      <td>${cliente.email}</td>
      <td>${cliente.telefono}</td>
    </tr>
  `);

  const eventosRows = dataset.eventosCliente.map(evento => {
    const cliente = findById(dataset.clientes, evento.clienteId)?.nombre ?? '—';
    const fechaObj = new Date(`${evento.fecha}T00:00:00`);
    const fecha = Number.isNaN(fechaObj.getTime()) ? evento.fecha : fechaObj.toLocaleDateString('es-GT');
    return {
      cliente,
      tipo: humanize(evento.tipo),
      fecha
    };
  });
  fillTable('salesEventosTable', eventosRows, row => `
    <tr>
      <td>${row.tipo} - ${row.cliente}</td>
      <td>${row.fecha}</td>
    </tr>
  `);

  const notificacionAudiencia = dataset.notificaciones.map(notificacion => {
    const audiencia = dataset.clienteNotificacion.filter(cn => idsEqual(cn.notificacionId, notificacion.id)).length;
    return {
      titulo: notificacion.titulo,
      audiencia
    };
  });
  fillTable('salesNotificacionesTable', notificacionAudiencia, row => `
    <tr>
      <td>${row.titulo}</td>
      <td>${number.format(row.audiencia)} clientes</td>
    </tr>
  `);

  const chatbotRows = dataset.chatbotLogs.map(log => ({
    cliente: findById(dataset.clientes, log.clienteId)?.nombre ?? '—',
    mensaje: log.mensaje
  }));
  fillTable('salesChatbotTable', chatbotRows, row => `
    <tr>
      <td>${row.cliente}</td>
      <td>${row.mensaje}</td>
    </tr>
  `);

  const ordenRows = dataset.ordenes.map(orden => ({
    orden: formatCode('ORD', orden.id),
    cliente: findById(dataset.clientes, orden.clienteId)?.nombre ?? '—',
    estado: humanize(orden.estado),
    total: toNumber(orden.total)
  }));
  fillTable('salesOrdenesTable', ordenRows, row => `
    <tr>
      <td>${row.orden}</td>
      <td>${row.cliente}</td>
      <td>${row.estado}</td>
      <td>${money.format(row.total)}</td>
    </tr>
  `);

  const detalleRows = dataset.ordenDetalle.map(det => ({
    orden: formatCode('ORD', det.ordenId),
    producto: findById(dataset.productos, det.productoId)?.nombre ?? '—',
    cantidad: toNumber(det.cantidad),
    precio: toNumber(det.precioUnitario)
  }));
  fillTable('salesDetalleTable', detalleRows, row => `
    <tr>
      <td>${row.orden}</td>
      <td>${row.producto}</td>
      <td>${number.format(row.cantidad)}</td>
      <td>${money.format(row.precio)}</td>
    </tr>
  `);

  const devolucionRows = dataset.devoluciones.map(dev => {
    const detalle = dataset.ordenDetalle.find(det => idsEqual(det.id, dev.ordenDetalleId));
    const ordenId = detalle?.ordenId;
    const producto = detalle ? findById(dataset.productos, detalle.productoId)?.nombre : null;
    return {
      orden: formatCode('ORD', ordenId),
      motivo: producto ? `${dev.motivo} · ${producto}` : dev.motivo
    };
  });
  fillTable('salesDevolucionesTable', devolucionRows, row => `
    <tr>
      <td>${row.orden}</td>
      <td>${row.motivo}</td>
    </tr>
  `);
}

function renderIngresos() {
  const ingresosCompletados = dataset.pagos.filter(p => p.estado === 'completado').reduce((acc, pago) => acc + toNumber(pago.monto), 0);
  const ingresosPendientes = dataset.pagos.filter(p => p.estado !== 'completado').reduce((acc, pago) => acc + toNumber(pago.monto), 0);
  const comprasTotal = dataset.compras.reduce((acc, compra) => acc + toNumber(compra.total), 0);
  const enviosEnCurso = dataset.envios.filter(envio => stringOr(envio.estado, '').toLowerCase() !== 'entregado').length;

  renderInfoCards('revenueSummaryCards', [
    { title: 'Ingresos confirmados', value: money.format(ingresosCompletados), caption: 'Pagos en estado completado' },
    { title: 'Cobros pendientes', value: money.format(ingresosPendientes), caption: 'Pagos por finalizar' },
    { title: 'Compras realizadas', value: money.format(comprasTotal), caption: 'Inversión en inventario' },
    { title: 'Envíos activos', value: number.format(enviosEnCurso), caption: 'Pedidos en proceso logístico' }
  ]);

  fillTable('revenuePagosTable', dataset.pagos, pago => `
    <tr>
      <td>${formatCode('ORD', pago.ordenId)}</td>
      <td>${money.format(toNumber(pago.monto))}</td>
      <td>${humanize(pago.estado)}</td>
    </tr>
  `);

  fillTable('revenueOrdenMetodoTable', dataset.ordenMetodoPago, registro => `
    <tr>
      <td>${formatCode('ORD', registro.ordenId)}</td>
      <td>${findById(dataset.metodosPago, registro.metodoId)?.nombre ?? '—'}</td>
      <td>${money.format(toNumber(registro.monto))}</td>
    </tr>
  `);

  const metodoUso = dataset.metodosPago.map(metodo => {
    const usos = dataset.ordenMetodoPago.filter(omp => idsEqual(omp.metodoId, metodo.id)).length;
    return {
      nombre: metodo.nombre,
      disponibilidad: usos ? `${number.format(usos)} órdenes` : 'Disponible'
    };
  });
  fillTable('revenueMetodosTable', metodoUso, row => `
    <tr>
      <td>${row.nombre}</td>
      <td>${row.disponibilidad}</td>
    </tr>
  `);

  fillTable('revenueComprobantesTable', dataset.comprobantesPago, comprobante => {
    const pago = findById(dataset.pagos, comprobante.pagoId);
    return `
      <tr>
        <td>Pago #${comprobante.pagoId ?? '—'}${pago ? ` (${money.format(toNumber(pago.monto))})` : ''}</td>
        <td><a href="${comprobante.url}" target="_blank" rel="noopener">${comprobante.url}</a></td>
      </tr>
    `;
  });

  const compraRows = dataset.compras.map(compra => ({
    compra: formatCode('COMP', compra.id),
    proveedor: findById(dataset.proveedores, compra.proveedorId)?.nombre ?? '—',
    total: toNumber(compra.total)
  }));
  fillTable('revenueComprasTable', compraRows, row => `
    <tr>
      <td>${row.compra}</td>
      <td>${row.proveedor}</td>
      <td>${money.format(row.total)}</td>
    </tr>
  `);

  const compraDetalleRows = dataset.compraDetalle.map(det => ({
    compra: formatCode('COMP', det.compraId),
    producto: findById(dataset.productos, det.productoId)?.nombre ?? '—',
    cantidad: toNumber(det.cantidad),
    precio: toNumber(det.precioUnitario)
  }));
  fillTable('revenueCompraDetalleTable', compraDetalleRows, row => `
    <tr>
      <td>${row.compra}</td>
      <td>${row.producto}</td>
      <td>${number.format(row.cantidad)}</td>
      <td>${money.format(row.precio)}</td>
    </tr>
  `);

  const enviosRows = dataset.envios.map(envio => ({
    orden: formatCode('ORD', envio.ordenId),
    transportista: findById(dataset.transportistas, envio.transportistaId)?.nombre ?? '—',
    estado: humanize(envio.estado),
    tracking: envio.tracking || '—'
  }));
  fillTable('revenueEnviosTable', enviosRows, row => `
    <tr>
      <td>${row.orden}</td>
      <td>${row.transportista}</td>
      <td>${row.estado}</td>
      <td>${row.tracking}</td>
    </tr>
  `);

  const envioDetalleRows = dataset.envioDetalle.map(det => ({
    envio: formatCode('ENV', det.envioId),
    producto: findById(dataset.productos, det.productoId)?.nombre ?? '—',
    cantidad: toNumber(det.cantidad)
  }));
  fillTable('revenueEnvioDetalleTable', envioDetalleRows, row => `
    <tr>
      <td>${row.envio}</td>
      <td>${row.producto}</td>
      <td>${number.format(row.cantidad)}</td>
    </tr>
  `);
}

function renderDataset() {
  renderDashboard();
  renderProductos();
  renderVentas();
  renderIngresos();
}

async function initializeDashboardData() {
  const config = window.APP_CONFIG || {};

  if (!window.supabase) {
    showErrorState('Biblioteca Supabase no disponible.');
    return;
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    showConfigMissingState();
    return;
  }

  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false }
  });

  showLoadingState();
  datasetWarnings = [];

  try {
    const warnings = await loadDataset();
    datasetWarnings = warnings;
    renderDataset();

    if (warnings.length) {
      console.warn('[dashboard] Tablas con incidencias:', warnings);
    }
  } catch (error) {
    console.error('[dashboard] Error crítico al cargar datos', error);
    showErrorState(error?.message ?? 'Error cargando datos de Supabase.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboardData);
} else {
  initializeDashboardData();
}


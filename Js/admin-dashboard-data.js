const dataset = {
  roles: [
    { id: 1, nombre: 'Administrador' },
    { id: 2, nombre: 'Vendedor' },
    { id: 3, nombre: 'Inventario' },
    { id: 4, nombre: 'Cliente' }
  ],
  permisos: [
    { id: 1, nombre: 'gestionar_usuarios' },
    { id: 2, nombre: 'gestionar_productos' },
    { id: 3, nombre: 'ver_reportes' },
    { id: 4, nombre: 'realizar_ventas' },
    { id: 5, nombre: 'gestionar_inventario' }
  ],
  rolPermisos: [
    { rolId: 1, permisoId: 1 },
    { rolId: 1, permisoId: 2 },
    { rolId: 1, permisoId: 3 },
    { rolId: 1, permisoId: 4 },
    { rolId: 1, permisoId: 5 },
    { rolId: 2, permisoId: 4 },
    { rolId: 2, permisoId: 3 },
    { rolId: 3, permisoId: 2 },
    { rolId: 3, permisoId: 5 }
  ],
  usuarios: [
    { id: 1, nombre: 'María González', email: 'maria@joyeriamares.com', telefono: '+502 1111-2222', passwordHash: 'sha256$abc123', rolId: 1, estado: 'Activo' },
    { id: 2, nombre: 'Carlos López', email: 'carlos@joyeriamares.com', telefono: '+502 3333-4444', passwordHash: 'sha256$def456', rolId: 2, estado: 'Activo' },
    { id: 3, nombre: 'Ana Martínez', email: 'ana@joyeriamares.com', telefono: '+502 5555-6666', passwordHash: 'sha256$ghi789', rolId: 3, estado: 'Activo' }
  ],
  bitacoraAccion: [
    { usuarioId: 1, accion: 'Inició sesión en el sistema' },
    { usuarioId: 2, accion: 'Realizó venta #001' },
    { usuarioId: 1, accion: 'Actualizó producto #1' }
  ],
  auditoria: [
    { usuarioId: 1, descripcion: 'Creación de nuevo usuario: Carlos López' },
    { usuarioId: 2, descripcion: 'Venta registrada: ORD-001' },
    { usuarioId: 3, descripcion: 'Ajuste de inventario: Producto #1' }
  ],
  categorias: [
    { id: 1, nombre: 'Anillos' },
    { id: 2, nombre: 'Collares' },
    { id: 3, nombre: 'Pulseras' },
    { id: 4, nombre: 'Aretes' },
    { id: 5, nombre: 'Relojes' }
  ],
  materiales: [
    { id: 1, nombre: 'Oro 18k' },
    { id: 2, nombre: 'Plata 925' },
    { id: 3, nombre: 'Acero Inoxidable' },
    { id: 4, nombre: 'Oro Blanco' },
    { id: 5, nombre: 'Titanio' }
  ],
  productos: [
    { id: 1, nombre: 'Anillo Solitario Diamante', descripcion: 'Anillo en oro 18k con diamante central 0.5ct', precio: 2500.0, stock: 5, categoriaId: 1 },
    { id: 2, nombre: 'Collar Corazón Plata', descripcion: 'Collar de plata 925 con dije corazón', precio: 450.0, stock: 12, categoriaId: 2 },
    { id: 3, nombre: 'Pulsera Eslabones Oro', descripcion: 'Pulsera en oro 18k con eslabones entrelazados', precio: 1800.0, stock: 8, categoriaId: 3 },
    { id: 4, nombre: 'Aretes Florales', descripcion: 'Aretes de plata con diseño floral', precio: 280.0, stock: 15, categoriaId: 4 },
    { id: 5, nombre: 'Reloj Deportivo', descripcion: 'Reloj acero inoxidable resistente al agua', precio: 1200.0, stock: 6, categoriaId: 5 }
  ],
  productoMaterial: [
    { productoId: 1, materialId: 1, porcentaje: 100 },
    { productoId: 2, materialId: 2, porcentaje: 100 },
    { productoId: 3, materialId: 1, porcentaje: 100 },
    { productoId: 4, materialId: 2, porcentaje: 100 },
    { productoId: 5, materialId: 3, porcentaje: 100 }
  ],
  imagenesProducto: [
    { productoId: 1, url: '/uploads/anillo-diamante-1.jpg' },
    { productoId: 2, url: '/uploads/collar-corazon-1.jpg' },
    { productoId: 3, url: '/uploads/pulsera-eslabones-1.jpg' },
    { productoId: 4, url: '/uploads/aretes-florales-1.jpg' },
    { productoId: 5, url: '/uploads/reloj-deportivo-1.jpg' }
  ],
  inventarioMovimientos: [
    { productoId: 1, tipo: 'entrada', cantidad: 10 },
    { productoId: 2, tipo: 'entrada', cantidad: 20 },
    { productoId: 1, tipo: 'salida', cantidad: 5 },
    { productoId: 2, tipo: 'salida', cantidad: 8 },
    { productoId: 3, tipo: 'entrada', cantidad: 15 }
  ],
  clientes: [
    { id: 1, nombre: 'Laura Hernández', email: 'laura.h@email.com', telefono: '+502 1234-5678' },
    { id: 2, nombre: 'Roberto Morales', email: 'roberto.m@email.com', telefono: '+502 2345-6789' },
    { id: 3, nombre: 'Sofia Ramírez', email: 'sofia.r@email.com', telefono: '+502 3456-7890' },
    { id: 4, nombre: 'Diego Castillo', email: 'diego.c@email.com', telefono: '+502 4567-8901' }
  ],
  direccionesCliente: [
    { clienteId: 1, tipo: 'envio', direccion: '12 Avenida 5-67, Zona 10, Ciudad de Guatemala' },
    { clienteId: 1, tipo: 'facturacion', direccion: '12 Avenida 5-67, Zona 10, Ciudad de Guatemala' },
    { clienteId: 2, tipo: 'envio', direccion: '8 Calle 3-45, Zona 1, Mixco' },
    { clienteId: 3, tipo: 'envio', direccion: '15 Calle 8-23, Zona 15, Guatemala' }
  ],
  eventosCliente: [
    { clienteId: 1, tipo: 'cumpleaños', fecha: '2024-06-15' },
    { clienteId: 2, tipo: 'aniversario', fecha: '2024-07-20' },
    { clienteId: 3, tipo: 'cumpleaños', fecha: '2024-08-10' }
  ],
  notificaciones: [
    { id: 1, titulo: 'Oferta Especial', mensaje: 'Descuento del 20% en toda la colección de verano' },
    { id: 2, titulo: 'Nuevos Productos', mensaje: 'Descubre nuestra nueva línea de joyería vintage' },
    { id: 3, titulo: 'Recordatorio de Evento', mensaje: 'No te pierdas nuestro evento exclusivo este sábado' }
  ],
  clienteNotificacion: [
    { clienteId: 1, notificacionId: 1 },
    { clienteId: 2, notificacionId: 1 },
    { clienteId: 3, notificacionId: 1 },
    { clienteId: 4, notificacionId: 1 },
    { clienteId: 1, notificacionId: 2 },
    { clienteId: 3, notificacionId: 2 }
  ],
  chatbotLogs: [
    { clienteId: 1, mensaje: 'Consulta sobre anillos de compromiso' },
    { clienteId: 2, mensaje: 'Pregunta sobre garantía de productos' },
    { clienteId: 3, mensaje: 'Solicitud de catálogo completo' }
  ],
  carritos: [
    { id: 1, clienteId: 1 },
    { id: 2, clienteId: 2 },
    { id: 3, clienteId: 3 }
  ],
  carritoDetalle: [
    { carritoId: 1, productoId: 1, cantidad: 1, precioUnitario: 2500.0 },
    { carritoId: 1, productoId: 2, cantidad: 1, precioUnitario: 450.0 },
    { carritoId: 2, productoId: 3, cantidad: 1, precioUnitario: 1800.0 },
    { carritoId: 3, productoId: 4, cantidad: 2, precioUnitario: 280.0 }
  ],
  ordenes: [
    { id: 1, clienteId: 1, estado: 'pagado', total: 2950.0 },
    { id: 2, clienteId: 2, estado: 'enviado', total: 1800.0 },
    { id: 3, clienteId: 3, estado: 'pendiente', total: 560.0 }
  ],
  ordenDetalle: [
    { id: 1, ordenId: 1, productoId: 1, cantidad: 1, precioUnitario: 2500.0 },
    { id: 2, ordenId: 1, productoId: 2, cantidad: 1, precioUnitario: 450.0 },
    { id: 3, ordenId: 2, productoId: 3, cantidad: 1, precioUnitario: 1800.0 },
    { id: 4, ordenId: 3, productoId: 4, cantidad: 2, precioUnitario: 280.0 }
  ],
  devoluciones: [
    { ordenDetalleId: 1, motivo: 'Talla incorrecta' }
  ],
  metodosPago: [
    { id: 1, nombre: 'Tarjeta de Crédito' },
    { id: 2, nombre: 'Tarjeta de Débito' },
    { id: 3, nombre: 'Transferencia Bancaria' },
    { id: 4, nombre: 'Efectivo' },
    { id: 5, nombre: 'PayPal' }
  ],
  pagos: [
    { id: 1, ordenId: 1, monto: 2950.0, estado: 'completado' },
    { id: 2, ordenId: 2, monto: 1800.0, estado: 'completado' },
    { id: 3, ordenId: 3, monto: 560.0, estado: 'pendiente' }
  ],
  ordenMetodoPago: [
    { ordenId: 1, metodoId: 1, monto: 2950.0 },
    { ordenId: 2, metodoId: 3, monto: 1800.0 },
    { ordenId: 3, metodoId: 4, monto: 560.0 }
  ],
  comprobantesPago: [
    { pagoId: 1, url: '/comprobantes/pago-001.pdf' },
    { pagoId: 2, url: '/comprobantes/pago-002.pdf' }
  ],
  proveedores: [
    { id: 1, nombre: 'Joyas Internacionales S.A.', nit: '123456-7', telefono: '+502 5555-1234', direccion: 'Centro Comercial Miraflores, Local 45' },
    { id: 2, nombre: 'Metales Preciosos GT', nit: '765432-1', telefono: '+502 5555-5678', direccion: '5a Avenida 8-90, Zona 4' },
    { id: 3, nombre: 'Relojería Europea', nit: '987654-3', telefono: '+502 5555-9012', direccion: 'Plaza Fontabella, Nivel 2' }
  ],
  proveedorProducto: [
    { proveedorId: 1, productoId: 1, costo: 1800.0, tiempoEntrega: 15 },
    { proveedorId: 1, productoId: 3, costo: 1200.0, tiempoEntrega: 10 },
    { proveedorId: 2, productoId: 2, costo: 300.0, tiempoEntrega: 7 },
    { proveedorId: 2, productoId: 4, costo: 180.0, tiempoEntrega: 5 },
    { proveedorId: 3, productoId: 5, costo: 800.0, tiempoEntrega: 20 }
  ],
  compras: [
    { id: 1, proveedorId: 1, total: 3000.0 },
    { id: 2, proveedorId: 2, total: 960.0 }
  ],
  compraDetalle: [
    { compraId: 1, productoId: 1, cantidad: 1, precioUnitario: 1800.0 },
    { compraId: 1, productoId: 3, cantidad: 1, precioUnitario: 1200.0 },
    { compraId: 2, productoId: 2, cantidad: 2, precioUnitario: 300.0 },
    { compraId: 2, productoId: 4, cantidad: 2, precioUnitario: 180.0 }
  ],
  transportistas: [
    { id: 1, nombre: 'Servicios Express GT', telefono: '+502 5555-4444' },
    { id: 2, nombre: 'Mensajería Rápida', telefono: '+502 5555-5555' },
    { id: 3, nombre: 'Envíos Nacionales', telefono: '+502 5555-6666' }
  ],
  envios: [
    { id: 1, ordenId: 1, transportistaId: 1, estado: 'entregado', tracking: 'TRK001234567' },
    { id: 2, ordenId: 2, transportistaId: 2, estado: 'enviado', tracking: 'TRK001234568' },
    { id: 3, ordenId: 3, transportistaId: 3, estado: 'pendiente', tracking: null }
  ],
  envioDetalle: [
    { envioId: 1, productoId: 1, cantidad: 1 },
    { envioId: 1, productoId: 2, cantidad: 1 },
    { envioId: 2, productoId: 3, cantidad: 1 },
    { envioId: 3, productoId: 4, cantidad: 2 }
  ],
  reportesKpi: [
    { nombre: 'Ventas del Mes', valor: 'Q45,800.00' },
    { nombre: 'Productos Vendidos', valor: '156 unidades' },
    { nombre: 'Clientes Nuevos', valor: '23 clientes' },
    { nombre: 'Tasa de Conversión', valor: '4.5%' },
    { nombre: 'Inventario Valorizado', valor: 'Q189,500.00' }
  ]
};

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const number = new Intl.NumberFormat('es-GT');

function humanize(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/_/g, ' ')
    .replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
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

function renderInfoCards(containerId, cards) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = cards
    .map(card => `
      <article class="info-card">
        <h3>${card.title}</h3>
        <strong>${card.value}</strong>
        <span>${card.caption}</span>
      </article>
    `)
    .join('');
}

function renderDashboard() {
  renderInfoCards('dashboardKpiGrid', dataset.reportesKpi.map(kpi => ({
    title: kpi.nombre,
    value: kpi.valor,
    caption: 'Dato proveniente de reportes_kpi'
  })));

  const permisoMap = new Map(dataset.permisos.map(p => [p.id, p]));
  const rolRows = dataset.roles.map(rol => {
    const permisos = dataset.rolPermisos
      .filter(rp => rp.rolId === rol.id)
      .map(rp => humanize(permisoMap.get(rp.permisoId)?.nombre ?? ''));
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

  fillTable('dashboardPermisosTable', dataset.permisos, permiso => `
    <tr>
      <td>${humanize(permiso.nombre)}</td>
      <td>${permiso.nombre.includes('_') ? `Permite ${humanize(permiso.nombre).toLowerCase()}` : 'Permiso operativo'}</td>
    </tr>
  `);

  const rolMap = new Map(dataset.roles.map(r => [r.id, r.nombre]));
  fillTable('dashboardUsuariosTable', dataset.usuarios, usuario => `
    <tr>
      <td>${usuario.nombre}</td>
      <td>${usuario.email}</td>
      <td>${rolMap.get(usuario.rolId) ?? '—'}</td>
      <td>${usuario.estado}</td>
    </tr>
  `);

  fillTable('dashboardBitacoraTable', dataset.bitacoraAccion, bitacora => `
    <tr>
      <td>${dataset.usuarios.find(u => u.id === bitacora.usuarioId)?.nombre ?? '—'}</td>
      <td>${bitacora.accion}</td>
    </tr>
  `);

  fillTable('dashboardAuditoriaTable', dataset.auditoria, registro => `
    <tr>
      <td>${dataset.usuarios.find(u => u.id === registro.usuarioId)?.nombre ?? '—'}</td>
      <td>${registro.descripcion}</td>
    </tr>
  `);
}

function renderProductos() {
  const stockTotal = dataset.productos.reduce((acc, p) => acc + p.stock, 0);
  const valorInventario = dataset.productos.reduce((acc, p) => acc + p.precio * p.stock, 0);
  const entradas = dataset.inventarioMovimientos.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.cantidad, 0);
  const salidas = dataset.inventarioMovimientos.filter(m => m.tipo === 'salida').reduce((acc, m) => acc + m.cantidad, 0);

  renderInfoCards('productSummaryCards', [
    { title: 'Productos activos', value: number.format(dataset.productos.length), caption: 'Registros en catálogo' },
    { title: 'Stock disponible', value: number.format(stockTotal) + ' uds', caption: 'Unidades totales' },
    { title: 'Valor inventario', value: money.format(valorInventario), caption: 'Precio x stock actual' },
    { title: 'Movimientos netos', value: number.format(entradas - salidas) + ' uds', caption: 'Entradas menos salidas' }
  ]);

  const categoriaMap = new Map(dataset.categorias.map(c => [c.id, c.nombre]));
  const productoMaterialMap = new Map(dataset.productoMaterial.map(pm => [pm.productoId, pm.materialId]));
  const materialMap = new Map(dataset.materiales.map(m => [m.id, m.nombre]));

  const productoRows = dataset.productos.map(producto => ({
    nombre: producto.nombre,
    categoria: categoriaMap.get(producto.categoriaId) ?? '—',
    material: materialMap.get(productoMaterialMap.get(producto.id) ?? null) ?? '—',
    precio: producto.precio,
    stock: producto.stock
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
    const count = dataset.productos.filter(p => p.categoriaId === cat.id).length;
    return { nombre: cat.nombre, count };
  });
  fillTable('datasetCategoriasTable', categoriaRows, row => `
    <tr>
      <td>${row.nombre}</td>
      <td>${number.format(row.count)}</td>
    </tr>
  `);

  const materialRows = dataset.materiales.map(mat => {
    const productoRelacionado = dataset.productoMaterial.find(pm => pm.materialId === mat.id);
    const productoNombre = productoRelacionado ? dataset.productos.find(p => p.id === productoRelacionado.productoId)?.nombre : null;
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
    producto: dataset.productos.find(p => p.id === mov.productoId)?.nombre ?? '—',
    tipo: humanize(mov.tipo),
    cantidad: mov.cantidad
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
  const totalIngresos = dataset.ordenes.reduce((acc, ord) => acc + ord.total, 0);

  const completadas = dataset.ordenes.filter(o => {
    const estado = (o.estado ?? '').toString().toLowerCase();
    return ['pagado', 'enviado', 'entregado'].includes(estado);
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
    const cliente = dataset.clientes.find(c => c.id === evento.clienteId)?.nombre ?? '—';
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
    const audiencia = dataset.clienteNotificacion.filter(cn => cn.notificacionId === notificacion.id).length;
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
    cliente: dataset.clientes.find(c => c.id === log.clienteId)?.nombre ?? '—',
    mensaje: log.mensaje
  }));
  fillTable('salesChatbotTable', chatbotRows, row => `
    <tr>
      <td>${row.cliente}</td>
      <td>${row.mensaje}</td>
    </tr>
  `);

  const ordenRows = dataset.ordenes.map(orden => ({
    orden: `ORD-${orden.id.toString().padStart(3, '0')}`,
    cliente: dataset.clientes.find(c => c.id === orden.clienteId)?.nombre ?? '—',
    estado: humanize(orden.estado),
    total: orden.total
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
    orden: `ORD-${det.ordenId.toString().padStart(3, '0')}`,
    producto: dataset.productos.find(p => p.id === det.productoId)?.nombre ?? '—',
    cantidad: det.cantidad,
    precio: det.precioUnitario
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
    const detalle = dataset.ordenDetalle.find(det => det.id === dev.ordenDetalleId);
    const ordenId = detalle?.ordenId;
    const producto = detalle ? dataset.productos.find(p => p.id === detalle.productoId)?.nombre : null;
    return {
      orden: ordenId ? `ORD-${ordenId.toString().padStart(3, '0')}` : '—',
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
  const ingresosCompletados = dataset.pagos.filter(p => p.estado === 'completado').reduce((acc, pago) => acc + pago.monto, 0);
  const ingresosPendientes = dataset.pagos.filter(p => p.estado !== 'completado').reduce((acc, pago) => acc + pago.monto, 0);
  const comprasTotal = dataset.compras.reduce((acc, compra) => acc + compra.total, 0);
  const enviosEnCurso = dataset.envios.filter(envio => (envio.estado ?? '').toString().toLowerCase() !== 'entregado').length;

  renderInfoCards('revenueSummaryCards', [
    { title: 'Ingresos confirmados', value: money.format(ingresosCompletados), caption: 'Pagos en estado completado' },
    { title: 'Cobros pendientes', value: money.format(ingresosPendientes), caption: 'Pagos por finalizar' },
    { title: 'Compras realizadas', value: money.format(comprasTotal), caption: 'Inversión en inventario' },
    { title: 'Envíos activos', value: number.format(enviosEnCurso), caption: 'Pedidos en proceso logístico' }
  ]);

  fillTable('revenuePagosTable', dataset.pagos, pago => `
    <tr>
      <td>ORD-${pago.ordenId.toString().padStart(3, '0')}</td>
      <td>${money.format(pago.monto)}</td>
      <td>${humanize(pago.estado)}</td>
    </tr>
  `);

  fillTable('revenueOrdenMetodoTable', dataset.ordenMetodoPago, registro => `
    <tr>
      <td>ORD-${registro.ordenId.toString().padStart(3, '0')}</td>
      <td>${dataset.metodosPago.find(m => m.id === registro.metodoId)?.nombre ?? '—'}</td>
      <td>${money.format(registro.monto)}</td>
    </tr>
  `);

  const metodoUso = dataset.metodosPago.map(metodo => {
    const usos = dataset.ordenMetodoPago.filter(omp => omp.metodoId === metodo.id).length;
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
    const pago = dataset.pagos.find(p => p.id === comprobante.pagoId);
    return `
      <tr>
        <td>Pago #${comprobante.pagoId} (${pago ? money.format(pago.monto) : '—'})</td>
        <td><a href="${comprobante.url}" target="_blank" rel="noopener">${comprobante.url}</a></td>
      </tr>
    `;
  });

  const compraRows = dataset.compras.map(compra => ({
    compra: `COMP-${compra.id.toString().padStart(3, '0')}`,
    proveedor: dataset.proveedores.find(p => p.id === compra.proveedorId)?.nombre ?? '—',
    total: compra.total
  }));
  fillTable('revenueComprasTable', compraRows, row => `
    <tr>
      <td>${row.compra}</td>
      <td>${row.proveedor}</td>
      <td>${money.format(row.total)}</td>
    </tr>
  `);

  const compraDetalleRows = dataset.compraDetalle.map(det => ({
    compra: `COMP-${det.compraId.toString().padStart(3, '0')}`,
    producto: dataset.productos.find(p => p.id === det.productoId)?.nombre ?? '—',
    cantidad: det.cantidad,
    precio: det.precioUnitario
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
    orden: `ORD-${envio.ordenId.toString().padStart(3, '0')}`,
    transportista: dataset.transportistas.find(t => t.id === envio.transportistaId)?.nombre ?? '—',
    estado: humanize(envio.estado),
    tracking: envio.tracking ?? '—'
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
    envio: `ENV-${det.envioId.toString().padStart(3, '0')}`,
    producto: dataset.productos.find(p => p.id === det.productoId)?.nombre ?? '—',
    cantidad: det.cantidad
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderDataset);
} else {
  renderDataset();
}

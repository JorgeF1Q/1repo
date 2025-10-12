const API_BASE = 'https://joyeria-full-stack-production.up.railway.app'; // ✅

/* ====== Guardas de sesión ====== */
const token = localStorage.getItem('token');
const role  = localStorage.getItem('role');
// En auth.js guardas con la clave 'email', no 'userEmail'
const email = localStorage.getItem('email'); // ✅

if (!token || role !== 'admin') {
  const next = encodeURIComponent('admin.html');
  window.location.href = `login.html?next=${next}`;
}

document.getElementById('adminEmail').textContent = email || '';

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('email'); // ✅ coherente con auth.js
  window.location.href = 'index.html';
});

/* ====== UI refs ====== */
const $tbody        = document.querySelector('#tblProductos tbody');
const $ordersTbody  = document.querySelector('#tblPedidos tbody');
const salesNavBtn   = document.querySelector('.nav-btn[data-section="sales"]');
const $modal        = $('#modalProducto');
const $frm          = document.getElementById('frmProducto');
const money         = new Intl.NumberFormat('es-GT', { style:'currency', currency:'GTQ' });

/* Dropzone refs */
const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const imgPreview = document.getElementById('imgPreview');

/* ====== Helpers HTTP ====== */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

/* ====== Tabla ====== */
function rowHTML(p) {
  return `
    <tr data-id="${p.Id}">
      <td>${p.Id}</td>
      <td>${p.Codigo ?? ''}</td>
      <td>${p.Nombre}</td>
      <td>${money.format(p.Precio)}</td>
      <td>${p.Stock}</td>
      <td>${Number(p.Activo) ? 'Sí' : 'No'}</td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline-secondary btn-edit">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-del">Borrar</button>
      </td>
    </tr>
  `;
}


const numberFormatter = new Intl.NumberFormat('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateTimeFormatter = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

const ordersAlert = document.getElementById('ordersAlert');
const ordersReloadBtn = document.getElementById('btnPedidosReload');
const ordersSearchInput = document.getElementById('ordersSearch');
const ordersClearBtn = document.getElementById('ordersClearFilters');
const ordersStatusCheckboxes = document.querySelectorAll('[data-order-status-filter]');
const orderModalElement = document.getElementById('modalPedidoEstado');
const orderModal = $('#modalPedidoEstado');
const orderModalForm = document.getElementById('frmPedidoEstado');
const orderModalTitle = document.getElementById('orderModalTitle');
const orderModalAlert = document.getElementById('orderModalAlert');
const orderModalIdInput = document.getElementById('orderModalId');
const orderModalCustomer = document.getElementById('orderModalCustomer');
const orderModalContact = document.getElementById('orderModalContact');
const orderModalAddress = document.getElementById('orderModalAddress');
const orderModalCode = document.getElementById('orderModalCode');
const orderModalDate = document.getElementById('orderModalDate');
const orderModalPayment = document.getElementById('orderModalPayment');
const orderModalTotal = document.getElementById('orderModalTotal');
const orderModalTimeline = document.getElementById('orderModalTimeline');
const orderModalItemsBody = document.getElementById('orderModalItemsBody');
const orderStatusSelect = document.getElementById('orderStatusSelect');
const orderDeliveryNameInput = document.getElementById('orderDeliveryName');
const orderDeliveryContactInput = document.getElementById('orderDeliveryContact');
const orderPaymentConfirmedInput = document.getElementById('orderPaymentConfirmed');
const orderNotesInput = document.getElementById('orderNotes');
const orderModalCancelBtn = document.getElementById('orderModalCancelBtn');
const orderModalSubmitBtn = document.getElementById('orderModalSubmitBtn');

const DEFAULT_ORDER_STATUSES = ['pendiente', 'enviado'];
const ordersState = {
  list: [],
  loading: false,
  statusFilters: new Set(DEFAULT_ORDER_STATUSES),
  search: '',
};

let ordersAlertTimer = null;
let currentOrderDetail = null;

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStatusValue(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const map = {
    pending: 'pendiente',
    procesando: 'pendiente',
    processing: 'pendiente',
    nuevo: 'pendiente',
    new: 'pendiente',
    enviado: 'enviado',
    enviada: 'enviado',
    despachado: 'enviado',
    despachada: 'enviado',
    shipped: 'enviado',
    delivery: 'enviado',
    pagado: 'pagado',
    pagada: 'pagado',
    paid: 'pagado',
    completado: 'pagado',
    completada: 'pagado',
    completed: 'pagado',
    cancelado: 'cancelado',
    cancelada: 'cancelado',
    cancelled: 'cancelado',
    anulado: 'cancelado',
    anulada: 'cancelado',
    void: 'cancelado',
  };
  const normalized = map[key] ?? key;
  const allowed = new Set(['pendiente', 'enviado', 'pagado', 'cancelado']);
  if (allowed.has(normalized)) return normalized;
  return 'pendiente';
}

function formatStatusLabel(status) {
  switch (status) {
    case 'pendiente': return 'Pendiente';
    case 'enviado': return 'Enviado';
    case 'pagado': return 'Pagado';
    case 'cancelado': return 'Cancelado';
    default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pendiente';
  }
}

function parseDateValue(value) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getTimestamp(value) {
  const date = parseDateValue(value);
  return date ? date.getTime() : 0;
}

function formatDateTime(value) {
  const date = parseDateValue(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

function normalizeOrderFromApi(order = {}) {
  const rawId = order.id ?? order.Id ?? order.orden_id ?? order.order_id ?? order.OrdenId;
  const status = normalizeStatusValue(order.status ?? order.estado ?? order.Status ?? order.Estado ?? '');
  const totalValue = order.total ?? order.Total ?? order.monto_total ?? order.TotalPedido ?? null;
  const numericTotal = Number(totalValue);
  const numericId = Number(rawId);
  const hasNumericId = rawId !== null && rawId !== undefined && !Number.isNaN(numericId);

  return {
    id: rawId === null || rawId === undefined ? null : (hasNumericId ? numericId : rawId),
    code: order.code ?? order.codigo ?? order.numero ?? order.numero_orden ?? null,
    status,
    status_label: formatStatusLabel(status),
    total: Number.isFinite(numericTotal) ? numericTotal : (typeof totalValue === 'number' ? totalValue : null),
    payment_method: order.payment_method ?? order.metodo_pago ?? order.MetodoPago ?? null,
    payment_reference: order.payment_reference ?? order.referencia_pago ?? order.Referencia ?? null,
    coupon_code: order.coupon_code ?? order.cupon_codigo ?? order.Cupon ?? null,
    customer: {
      name: order.customer?.name ?? order.customer ?? order.cliente ?? order.Nombre ?? null,
      email: order.customer?.email ?? order.cliente_email ?? order.Email ?? null,
      phone: order.customer?.phone ?? order.cliente_telefono ?? order.Telefono ?? null,
      address: order.customer?.address ?? order.customer_address ?? order.cliente_direccion ?? order.Direccion ?? null,
    },
    delivery: {
      person: {
        id: order.delivery?.person?.id ?? order.repartidor_id ?? null,
        name: order.delivery?.person?.name ?? order.repartidor_nombre ?? null,
        contact: order.delivery?.person?.contact ?? order.repartidor_contacto ?? null,
      },
      payment_confirmed: Boolean(order.delivery?.payment_confirmed ?? order.pago_confirmado),
      notes: order.delivery?.notes ?? order.notas ?? null,
      assigned_at: order.delivery?.assigned_at ?? order.fecha_asignacion ?? null,
      shipped_at: order.delivery?.shipped_at ?? order.fecha_envio ?? null,
      paid_at: order.delivery?.paid_at ?? order.fecha_pago ?? null,
      canceled_at: order.delivery?.canceled_at ?? order.fecha_cancelacion ?? null,
      updated_at: order.delivery?.updated_at ?? order.gestion_actualizado_en ?? null,
    },
    created_at: order.created_at ?? order.creado_en ?? order.Fecha ?? null,
    updated_at: order.updated_at ?? order.actualizado_en ?? null,
    items: Array.isArray(order.items) ? order.items : undefined,
  };
}

function upsertOrder(order) {
  const normalized = normalizeOrderFromApi(order);
  const id = normalized.id;
  if (id === null || id === undefined) return;
  const index = ordersState.list.findIndex(item => item.id === id);
  if (index >= 0) {
    const current = ordersState.list[index];
    ordersState.list[index] = {
      ...current,
      ...normalized,
      customer: { ...current.customer, ...normalized.customer },
      delivery: {
        ...current.delivery,
        ...normalized.delivery,
        person: {
          ...(current.delivery ? current.delivery.person : {}),
          ...(normalized.delivery ? normalized.delivery.person : {}),
        },
      },
      items: normalized.items !== undefined ? normalized.items : current.items,
    };
  } else {
    ordersState.list.push(normalized);
  }
}

function renderOrdersLoading() {
  if (!$ordersTbody) return;
  $ordersTbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-muted py-4">Cargando pedidos...</td>
    </tr>
  `;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'pendiente': return 'badge-soft-warning';
    case 'enviado': return 'badge-soft-info';
    case 'pagado': return 'badge-soft-success';
    case 'cancelado': return 'badge-soft-danger';
    default: return 'badge-soft-secondary';
  }
}

function pedidoRowHTML(order) {
  const idLabel = order.code ? escapeHtml(order.code) : (order.id !== null && order.id !== undefined ? `#${order.id}` : '—');
  const statusBadge = `<span class="status-badge ${getStatusBadgeClass(order.status)}">${escapeHtml(order.status_label)}</span>`;
  const customerName = escapeHtml(order.customer?.name || 'Cliente sin nombre');
  const addressLine = order.customer?.address ? `<div class="order-mini-meta"><i class="fas fa-map-marker-alt mr-1"></i>${escapeHtml(order.customer.address)}</div>` : '';
  const phoneLine = order.customer?.phone ? `<div class="order-mini-meta"><i class="fas fa-phone mr-1"></i>${escapeHtml(order.customer.phone)}</div>` : '';
  const emailLine = order.customer?.email ? `<div class="order-mini-meta"><i class="fas fa-envelope mr-1"></i>${escapeHtml(order.customer.email)}</div>` : '';
  const deliveryName = order.delivery?.person?.name
    ? `<span class="order-delivery-chip">${escapeHtml(order.delivery.person.name)}</span>`
    : `<span class="order-delivery-chip unassigned">Sin asignar</span>`;
  const deliveryContact = order.delivery?.person?.contact ? `<div class="order-mini-meta">${escapeHtml(order.delivery.person.contact)}</div>` : '';
  const assignedLine = order.delivery?.assigned_at ? `<div class="order-mini-meta">Asignado: ${formatDateTime(order.delivery.assigned_at)}</div>` : '';
  const shippedLine = order.delivery?.shipped_at ? `<div class="order-mini-meta">Enviado: ${formatDateTime(order.delivery.shipped_at)}</div>` : '';
  const paymentChipClass = order.delivery?.payment_confirmed ? 'order-payment-chip confirmed' : 'order-payment-chip pending';
  const paymentChipText = order.delivery?.payment_confirmed ? 'Pago confirmado' : 'Pendiente de cobro';
  const paymentMethodLine = order.payment_method ? `<div class="order-mini-meta"><i class="fas fa-money-bill-wave mr-1"></i>${escapeHtml(order.payment_method)}</div>` : '';
  const paymentReferenceLine = order.payment_reference ? `<div class="order-mini-meta">Ref: ${escapeHtml(order.payment_reference)}</div>` : '';
  const paidLine = order.delivery?.paid_at ? `<div class="order-mini-meta">Pagado: ${formatDateTime(order.delivery.paid_at)}</div>` : '';
  const updatedRef = order.delivery?.updated_at || order.updated_at || order.delivery?.paid_at || order.delivery?.shipped_at || order.created_at;
  const updatedLabel = updatedRef ? formatDateTime(updatedRef) : '—';
  const createdLabel = order.created_at ? formatDateTime(order.created_at) : null;
  const total = typeof order.total === 'number' && Number.isFinite(order.total) ? money.format(order.total) : '—';

  const actions = [];
  actions.push(`<button class="btn btn-sm btn-outline-primary" data-order-action="manage" data-order-id="${order.id}">Gestionar</button>`);
  if (order.status === 'pendiente') {
    actions.push(`<button class="btn btn-sm btn-outline-info" data-order-action="ship" data-order-id="${order.id}">Marcar enviada</button>`);
  }
  if (order.status !== 'pagado' && order.status !== 'cancelado') {
    actions.push(`<button class="btn btn-sm btn-outline-success" data-order-action="mark-paid" data-order-id="${order.id}">Marcar pagada</button>`);
  }
  if (order.status !== 'cancelado') {
    actions.push(`<button class="btn btn-sm btn-outline-danger" data-order-action="cancel" data-order-id="${order.id}">Cancelar</button>`);
  }

  const contactBlock = phoneLine || emailLine ? `${phoneLine}${emailLine}` : '<div class="order-mini-meta text-muted">Sin contacto</div>';

  return `
    <tr data-id="${order.id ?? ''}">
      <td>
        <div><strong>${idLabel}</strong></div>
        <div class="order-mini-meta">${statusBadge}</div>
      </td>
      <td>
        ${customerName}
        ${addressLine}
      </td>
      <td>
        ${contactBlock}
      </td>
      <td>
        ${deliveryName}
        ${deliveryContact}
        ${assignedLine}
        ${shippedLine}
      </td>
      <td>
        <span class="${paymentChipClass}">${paymentChipText}</span>
        ${paymentMethodLine}
        ${paymentReferenceLine}
        ${paidLine}
      </td>
      <td>${total}</td>
      <td>
        <span class="order-mini-meta">Actualizado: ${updatedLabel}</span>
        ${createdLabel ? `<span class="order-meta-muted">Creado: ${createdLabel}</span>` : ''}
      </td>
      <td class="text-right actions-column">
        ${actions.join(' ')}
      </td>
    </tr>
  `;
}

function renderOrders() {
  if (!$ordersTbody) return;
  const searchTerm = ordersState.search.trim().toLowerCase();
  const statuses = ordersState.statusFilters;
  const filtered = ordersState.list
    .filter(order => !statuses.size || statuses.has(order.status))
    .filter(order => {
      if (!searchTerm) return true;
      const haystack = [
        order.id ? `#${order.id}` : '',
        order.code || '',
        order.status_label || '',
        order.customer?.name || '',
        order.customer?.address || '',
        order.customer?.phone || '',
        order.customer?.email || '',
        order.payment_method || '',
        order.delivery?.person?.name || '',
        order.delivery?.person?.contact || '',
      ].join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    })
    .sort((a, b) => {
      const bTime = getTimestamp(b.updated_at || b.delivery?.updated_at || b.delivery?.paid_at || b.delivery?.shipped_at || b.created_at);
      const aTime = getTimestamp(a.updated_at || a.delivery?.updated_at || a.delivery?.paid_at || a.delivery?.shipped_at || a.created_at);
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });

  if (!filtered.length) {
    $ordersTbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron pedidos con los filtros seleccionados.</td></tr>`;
    return;
  }

  $ordersTbody.innerHTML = filtered.map(pedidoRowHTML).join('');
}

function showOrdersAlert(type, message, options = {}) {
  if (!ordersAlert) return;
  ordersAlert.className = `alert alert-${type}`;
  ordersAlert.textContent = message;
  ordersAlert.classList.remove('d-none');
  if (ordersAlertTimer) clearTimeout(ordersAlertTimer);
  const autoHide = options.autoHide !== undefined ? options.autoHide : type === 'success';
  if (autoHide) {
    const timeout = options.timeout ?? 4000;
    ordersAlertTimer = window.setTimeout(() => {
      hideOrdersAlert();
    }, timeout);
  }
}

function hideOrdersAlert() {
  if (!ordersAlert) return;
  ordersAlert.classList.add('d-none');
  ordersAlert.textContent = '';
  if (ordersAlertTimer) {
    clearTimeout(ordersAlertTimer);
    ordersAlertTimer = null;
  }
}

function showOrderModalAlert(message, type = 'danger') {
  if (!orderModalAlert) return;
  orderModalAlert.className = `alert alert-${type}`;
  orderModalAlert.textContent = message;
  orderModalAlert.classList.remove('d-none');
}

function hideOrderModalAlert() {
  if (!orderModalAlert) return;
  orderModalAlert.classList.add('d-none');
  orderModalAlert.textContent = '';
}

function setLoadingButton(btn, isLoading, loadingText = 'Procesando...') {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
    }
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>${loadingText}`;
  } else {
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
    btn.disabled = false;
  }
}

function setOrderModalDisabled(disabled) {
  [orderStatusSelect, orderDeliveryNameInput, orderDeliveryContactInput, orderPaymentConfirmedInput, orderNotesInput].forEach(el => {
    if (el) el.disabled = disabled;
  });
}

function setOrderModalFetching(isFetching) {
  setLoadingButton(orderModalSubmitBtn, isFetching, 'Cargando...');
  if (orderModalCancelBtn) orderModalCancelBtn.disabled = isFetching;
  setOrderModalDisabled(isFetching);
}

function setOrderModalLoading(isLoading) {
  setLoadingButton(orderModalSubmitBtn, isLoading, 'Guardando...');
  if (orderModalCancelBtn) orderModalCancelBtn.disabled = isLoading;
  setOrderModalDisabled(isLoading);
}

function resetOrderModal() {
  currentOrderDetail = null;
  hideOrderModalAlert();
  if (orderModalForm) {
    orderModalForm.reset();
    orderModalForm.dataset.orderId = '';
  }
  if (orderModalIdInput) orderModalIdInput.value = '';
  if (orderModalCustomer) orderModalCustomer.textContent = '—';
  if (orderModalContact) orderModalContact.innerHTML = '<span class="text-muted">Sin contacto</span>';
  if (orderModalAddress) orderModalAddress.textContent = '—';
  if (orderModalCode) orderModalCode.textContent = '—';
  if (orderModalDate) orderModalDate.textContent = '—';
  if (orderModalPayment) orderModalPayment.textContent = '—';
  if (orderModalTotal) orderModalTotal.textContent = '—';
  if (orderModalTimeline) orderModalTimeline.innerHTML = '<li class="text-muted">Cargando...</li>';
  if (orderModalItemsBody) {
    orderModalItemsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Cargando productos...</td></tr>';
  }
  if (orderModalSubmitBtn && orderModalSubmitBtn.dataset.originalHtml) {
    setLoadingButton(orderModalSubmitBtn, false);
  }
  if (orderModalCancelBtn) orderModalCancelBtn.disabled = false;
  setOrderModalDisabled(false);
}

async function fetchOrderDetail(orderId) {
  const url = `/api/orders.php?id=${orderId}&with=items`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || data.message || 'No se encontró la orden solicitada.');
  }
  return normalizeOrderFromApi(data.order ?? {});
}

async function updateOrderStatus(id, payload, { includeItems = false } = {}) {
  const params = new URLSearchParams();
  if (includeItems) params.set('with', 'items');
  const res = await fetch(`/api/orders.php?id=${id}${params.toString() ? `&${params.toString()}` : ''}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || data.message || 'No se pudo actualizar el pedido.');
  }
  return normalizeOrderFromApi(data.order ?? {});
}

function fillOrderModal(order, options = {}) {
  if (!orderModalTitle) return;
  if (orderModalTitle) orderModalTitle.textContent = order.code ? `Orden ${order.code}` : `Orden #${order.id}`;
  if (orderModalIdInput) orderModalIdInput.value = order.id ?? '';
  if (orderModalForm) orderModalForm.dataset.orderId = order.id ?? '';
  if (orderModalCustomer) orderModalCustomer.textContent = order.customer?.name || 'Cliente sin nombre';
  if (orderModalContact) {
    const parts = [];
    if (order.customer?.phone) parts.push(`<div class="order-mini-meta"><i class="fas fa-phone mr-1"></i>${escapeHtml(order.customer.phone)}</div>`);
    if (order.customer?.email) parts.push(`<div class="order-mini-meta"><i class="fas fa-envelope mr-1"></i>${escapeHtml(order.customer.email)}</div>`);
    orderModalContact.innerHTML = parts.length ? parts.join('') : '<span class="text-muted">Sin contacto</span>';
  }
  if (orderModalAddress) orderModalAddress.textContent = order.customer?.address || 'Sin dirección registrada';
  if (orderModalCode) orderModalCode.textContent = order.code ? order.code : (order.id ? `#${order.id}` : '—');
  if (orderModalDate) orderModalDate.textContent = order.created_at ? formatDateTime(order.created_at) : '—';
  if (orderModalPayment) orderModalPayment.textContent = order.payment_method || '—';
  if (orderModalTotal) orderModalTotal.textContent = typeof order.total === 'number' && Number.isFinite(order.total) ? money.format(order.total) : '—';

  if (orderStatusSelect) {
    const preset = options.presetStatus && ['pendiente','enviado','pagado','cancelado'].includes(options.presetStatus)
      ? options.presetStatus
      : order.status;
    orderStatusSelect.value = preset;
  }
  if (orderDeliveryNameInput) orderDeliveryNameInput.value = order.delivery?.person?.name || '';
  if (orderDeliveryContactInput) orderDeliveryContactInput.value = order.delivery?.person?.contact || '';
  if (orderPaymentConfirmedInput) orderPaymentConfirmedInput.checked = !!order.delivery?.payment_confirmed;
  if (orderNotesInput) orderNotesInput.value = order.delivery?.notes || '';

  if (orderModalTimeline) {
    const timeline = [];
    if (order.created_at) timeline.push({ label: 'Creado', date: order.created_at });
    if (order.delivery?.assigned_at) timeline.push({ label: 'Repartidor asignado', date: order.delivery.assigned_at, detail: order.delivery?.person?.name ? `a ${order.delivery.person.name}` : '' });
    if (order.delivery?.shipped_at) timeline.push({ label: 'Enviado', date: order.delivery.shipped_at });
    if (order.delivery?.paid_at) timeline.push({ label: 'Pago confirmado', date: order.delivery.paid_at });
    if (order.delivery?.canceled_at) timeline.push({ label: 'Cancelado', date: order.delivery.canceled_at });

    orderModalTimeline.innerHTML = timeline.length
      ? timeline.map(item => `<li>${escapeHtml(item.label)}${item.detail ? ` <span class="order-meta-muted">${escapeHtml(item.detail)}</span>` : ''}<div class="order-mini-meta">${formatDateTime(item.date)}</div></li>`).join('')
      : '<li class="text-muted">Sin movimientos registrados.</li>';
  }

  if (orderModalItemsBody) {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      orderModalItemsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin productos registrados.</td></tr>';
    } else {
      orderModalItemsBody.innerHTML = items.map(item => {
        const productName = item.product_name ? escapeHtml(item.product_name) : (item.product_id ? `#${item.product_id}` : 'Producto');
        const quantity = item.quantity !== undefined && item.quantity !== null ? numberFormatter.format(item.quantity) : '—';
        const unitPrice = item.unit_price !== undefined && item.unit_price !== null && Number.isFinite(Number(item.unit_price)) ? money.format(Number(item.unit_price)) : '—';
        const lineTotalValue = item.line_total !== undefined && item.line_total !== null ? Number(item.line_total) : (item.quantity !== undefined && item.unit_price !== undefined ? Number(item.quantity) * Number(item.unit_price) : NaN);
        const lineTotal = Number.isFinite(lineTotalValue) ? money.format(lineTotalValue) : '—';
        return `<tr><td>${productName}</td><td class="text-right">${quantity}</td><td class="text-right">${unitPrice}</td><td class="text-right">${lineTotal}</td></tr>`;
      }).join('');
    }
  }

  if (options.focusField === 'delivery' && orderDeliveryNameInput) {
    setTimeout(() => orderDeliveryNameInput.focus(), 200);
  }
}

async function openOrderModal(orderId, options = {}) {
  if (!orderModalElement) return;
  resetOrderModal();
  setOrderModalFetching(true);
  hideOrdersAlert();
  orderModal.modal('show');
  try {
    const detail = await fetchOrderDetail(orderId);
    currentOrderDetail = detail;
    upsertOrder(detail);
    renderOrders();
    fillOrderModal(detail, options);
  } catch (err) {
    console.error(err);
    showOrderModalAlert(err.message || 'No se pudo cargar la orden.');
  } finally {
    setOrderModalFetching(false);
  }
}

async function submitOrderModalUpdate(extra = {}) {
  if (!currentOrderDetail) return;
  const id = currentOrderDetail.id;
  const status = extra.status ?? (orderStatusSelect ? orderStatusSelect.value : currentOrderDetail.status);
  const deliveryName = (extra.delivery_person !== undefined ? extra.delivery_person : (orderDeliveryNameInput ? orderDeliveryNameInput.value : '')).trim();
  const deliveryContact = (extra.delivery_contact !== undefined ? extra.delivery_contact : (orderDeliveryContactInput ? orderDeliveryContactInput.value : '')).trim();
  let paymentConfirmed = extra.payment_confirmed !== undefined ? !!extra.payment_confirmed : !!(orderPaymentConfirmedInput && orderPaymentConfirmedInput.checked);
  const notes = (extra.notes !== undefined ? extra.notes : (orderNotesInput ? orderNotesInput.value : '')).trim();

  if (status === 'enviado' && !deliveryName) {
    showOrderModalAlert('Debes asignar un repartidor antes de marcar la orden como enviada.');
    if (orderDeliveryNameInput) orderDeliveryNameInput.focus();
    return;
  }

  if (status === 'pagado') {
    paymentConfirmed = true;
  }

  if (status === 'cancelado' && !extra.skipConfirm) {
    const confirmed = window.confirm('¿Seguro que deseas cancelar la orden? Se devolverá el inventario de los productos.');
    if (!confirmed) return;
  }

  hideOrderModalAlert();
  setOrderModalLoading(true);

  try {
    const updated = await updateOrderStatus(id, {
      status,
      delivery_person: deliveryName || null,
      delivery_contact: deliveryContact || null,
      payment_confirmed: paymentConfirmed,
      notes: notes || null,
    }, { includeItems: true });

    currentOrderDetail = updated;
    upsertOrder(updated);
    renderOrders();
    fillOrderModal(updated, { presetStatus: status });
    showOrderModalAlert('Pedido actualizado correctamente.', 'success');
    hideOrdersAlert();
    if (status === 'cancelado') {
      showOrdersAlert('success', 'Pedido cancelado y productos devueltos al inventario.');
    }
  } catch (err) {
    console.error(err);
    showOrderModalAlert(err.message || 'No se pudo actualizar el pedido.');
  } finally {
    setOrderModalLoading(false);
  }
}

async function performOrderUpdate(id, payload, { successMessage, confirmMessage, trigger, includeItems = false } = {}) {
  if (confirmMessage && !window.confirm(confirmMessage)) {
    return;
  }
  if (trigger) setLoadingButton(trigger, true, 'Actualizando...');
  hideOrdersAlert();
  try {
    const updated = await updateOrderStatus(id, payload, { includeItems });
    upsertOrder(updated);
    renderOrders();
    if (currentOrderDetail && currentOrderDetail.id === updated.id) {
      currentOrderDetail = includeItems ? updated : { ...currentOrderDetail, ...updated, items: currentOrderDetail.items };
      fillOrderModal(currentOrderDetail);
      showOrderModalAlert(successMessage || 'Pedido actualizado correctamente.', 'success');
    } else if (successMessage) {
      showOrdersAlert('success', successMessage);
    }
  } catch (err) {
    console.error(err);
    showOrdersAlert('danger', err.message || 'No se pudo actualizar el pedido.');
    if (currentOrderDetail && currentOrderDetail.id === id) {
      showOrderModalAlert(err.message || 'No se pudo actualizar el pedido.');
    }
  } finally {
    if (trigger) setLoadingButton(trigger, false);
  }
}

function handleOrdersTableClick(event) {
  const btn = event.target.closest('[data-order-action]');
  if (!btn) return;
  const id = Number(btn.dataset.orderId);
  if (!id) return;
  const action = btn.dataset.orderAction;
  switch (action) {
    case 'manage':
      openOrderModal(id);
      break;
    case 'ship':
      openOrderModal(id, { presetStatus: 'enviado', focusField: 'delivery' });
      break;
    case 'mark-paid':
      performOrderUpdate(id, { status: 'pagado', payment_confirmed: true }, {
        successMessage: 'Pedido marcado como pagado.',
        confirmMessage: '¿Confirmar que se recibió el pago de la orden?',
        trigger: btn,
        includeItems: currentOrderDetail?.id === id,
      });
      break;
    case 'cancel':
      performOrderUpdate(id, { status: 'cancelado' }, {
        successMessage: 'Pedido cancelado y productos devueltos al inventario.',
        confirmMessage: '¿Seguro que deseas cancelar la orden? Se devolverá el inventario.',
        trigger: btn,
        includeItems: currentOrderDetail?.id === id,
      });
      break;
    default:
      break;
  }
}

async function loadPedidos({ showLoader = true } = {}) {
  if (!$ordersTbody || ordersState.loading) return;
  ordersState.loading = true;
  if (showLoader) {
    renderOrdersLoading();
  }
  if (ordersReloadBtn) setLoadingButton(ordersReloadBtn, true, 'Actualizando...');
  hideOrdersAlert();

  try {
    const params = new URLSearchParams();
    if (ordersState.statusFilters.size) {
      params.set('status', Array.from(ordersState.statusFilters).join(','));
    }
    if (ordersState.search.trim()) {
      params.set('q', ordersState.search.trim());
    }
    params.set('limit', '200');

    const res = await fetch(`/api/orders.php${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || data.message || 'No se pudieron cargar los pedidos.');
    }
    const orders = Array.isArray(data.orders)
      ? data.orders
      : Array.isArray(data.data)
        ? data.data
        : [];
    ordersState.list = orders.map(normalizeOrderFromApi);
    renderOrders();
  } catch (err) {
    console.error(err);
    showOrdersAlert('danger', err.message || 'Error al cargar pedidos.');
    if (!$ordersTbody.innerHTML.trim()) {
      $ordersTbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${escapeHtml(err.message || 'Error al cargar pedidos.')}</td></tr>`;
    }
  } finally {
    ordersState.loading = false;
    if (ordersReloadBtn) setLoadingButton(ordersReloadBtn, false);
  }
}

if ($ordersTbody) {
  $ordersTbody.addEventListener('click', handleOrdersTableClick);
}

ordersStatusCheckboxes.forEach(cb => {
  cb.addEventListener('change', () => {
    const selected = new Set();
    ordersStatusCheckboxes.forEach(box => {
      if (box.checked) selected.add(normalizeStatusValue(box.value));
    });
    if (!selected.size) {
      DEFAULT_ORDER_STATUSES.forEach(status => selected.add(status));
      ordersStatusCheckboxes.forEach(box => {
        box.checked = selected.has(normalizeStatusValue(box.value));
      });
    }
    ordersState.statusFilters = selected;
    renderOrders();
    loadPedidos({ showLoader: true });
  });
});

if (ordersSearchInput) {
  ordersSearchInput.addEventListener('input', () => {
    ordersState.search = ordersSearchInput.value || '';
    renderOrders();
  });
}

if (ordersClearBtn) {
  ordersClearBtn.addEventListener('click', () => {
    ordersState.search = '';
    if (ordersSearchInput) ordersSearchInput.value = '';
    ordersState.statusFilters = new Set(DEFAULT_ORDER_STATUSES);
    ordersStatusCheckboxes.forEach(box => {
      box.checked = ordersState.statusFilters.has(normalizeStatusValue(box.value));
    });
    renderOrders();
    loadPedidos({ showLoader: true });
  });
}

if (orderModalForm) {
  orderModalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOrderModalUpdate();
  });
}

if (orderModalCancelBtn) {
  orderModalCancelBtn.addEventListener('click', () => {
    submitOrderModalUpdate({ status: 'cancelado' });
  });
}

if (orderModalElement) {
  orderModal.on('hidden.bs.modal', () => {
    resetOrderModal();
  });
}

if (ordersReloadBtn) {
  ordersReloadBtn.addEventListener('click', () => {
    loadPedidos({ showLoader: true });
  });
}

async function loadProductos() {
  const list = await apiFetch('/api/products'); // ✅ absoluto
  $tbody.innerHTML = list.map(rowHTML).join('');
}
loadProductos();

if (salesNavBtn) {
  salesNavBtn.addEventListener('click', () => {
    loadPedidos();
  });
}

loadPedidos();

/* ====== Crear ====== */
document.querySelector('[data-target="#modalProducto"]').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Nuevo producto';
  $frm.reset();
  document.getElementById('p_id').value = '';
  imgPreview.classList.add('d-none');
  imgPreview.src = '';
});

/* ====== Guardar (crear/editar) ====== */
$frm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('p_id').value.trim();

  const payload = {
    Codigo:    document.getElementById('p_codigo').value.trim(),
    Nombre:    document.getElementById('p_nombre').value.trim(),
    Precio:    Number(document.getElementById('p_precio').value || 0),
    Stock:     Number(document.getElementById('p_stock').value || 0),
    Activo:    Number(document.getElementById('p_activo').value || 1),
    Categoria: document.getElementById('p_categoria').value.trim(),
    Material:  document.getElementById('p_material').value.trim(),
    ImagenUrl: document.getElementById('p_imagen').value.trim()
  };

  const opts = {
    method: id ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  };

  const path = id ? `/api/products/${id}` : '/api/products';
  await apiFetch(path, opts); // ✅ absoluto + manejo de error
  $modal.modal('hide');
  await loadProductos();
});

/* ====== Editar / Borrar ====== */
$tbody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.getAttribute('data-id');

  if (e.target.classList.contains('btn-edit')) {
    document.getElementById('modalTitle').textContent = 'Editar producto';
    const p = await apiFetch(`/api/products/${id}`); // ✅

    document.getElementById('p_id').value        = p.Id;
    document.getElementById('p_codigo').value    = p.Codigo || '';
    document.getElementById('p_nombre').value    = p.Nombre || '';
    document.getElementById('p_precio').value    = p.Precio || 0;
    document.getElementById('p_stock').value     = p.Stock || 0;
    document.getElementById('p_activo').value    = Number(p.Activo ? 1 : 0);
    document.getElementById('p_categoria').value = p.Categoria || '';
    document.getElementById('p_material').value  = p.Material || '';
    document.getElementById('p_imagen').value    = p.ImagenUrl || '';

    if (p.ImagenUrl) {
      imgPreview.src = p.ImagenUrl;
      imgPreview.classList.remove('d-none');
    } else {
      imgPreview.classList.add('d-none');
      imgPreview.src = '';
    }

    $modal.modal('show');
  }

  if (e.target.classList.contains('btn-del')) {
    if (!confirm('¿Borrar este producto?')) return;
    await apiFetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }); // ✅
    await loadProductos();
  }
});

/* ====== Drag & Drop / Subida de imagen ====== */

function openFilePicker() {
  fileInput.click();
}

// click en el dropzone
dropZone.addEventListener('click', openFilePicker);

// resaltar cuando arrastras
['dragenter', 'dragover'].forEach(ev =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach(ev =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragover');
  })
);

// soltar archivo
dropZone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files && files[0]) handleFile(files[0]);
});

// file input manual
fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
});

async function handleFile(file) {
  const productId = document.getElementById('p_id').value.trim();
  if (!productId) {
    alert('Primero guarda el producto (para obtener su ID), luego vuelve a editar y sube la imagen.');
    return;
  }

  // preview inmediata
  const reader = new FileReader();
  reader.onload = () => {
    imgPreview.src = reader.result;
    imgPreview.classList.remove('d-none');
  };
  reader.readAsDataURL(file);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/api/products/${productId}/image`, { // ✅
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Error subiendo imagen');

    // Actualiza el input de URL con la ruta subida
    document.getElementById('p_imagen').value = data.url || '';
  } catch (err) {
    console.error(err);
    alert('Error al subir imagen');
  }
}

const ORDERS_ENDPOINT = '/api/orders.php';

function normalizeRole(rawRole) {
  if (rawRole === null || rawRole === undefined) return '';
  const numeric = Number(rawRole);
  if (!Number.isNaN(numeric)) {
    if (numeric === 1 || numeric === 4) return 'admin';
    if (numeric === 2) return 'ventas';
  }
  const text = rawRole.toString().trim().toLowerCase();
  if (['1', '4', 'admin', 'administrator', 'administrador'].includes(text)) return 'admin';
  if (['2', 'ventas', 'vendedor', 'seller', 'sales', 'salesperson'].includes(text)) return 'ventas';
  return text;
}

const token = localStorage.getItem('token');
const storedRole = normalizeRole(localStorage.getItem('role') ?? localStorage.getItem('role_raw'));
if (!token || !['ventas', 'vendedor', 'seller'].includes(storedRole)) {
  const next = encodeURIComponent('ventas.html');
  window.location.href = `login.html?next=${next}`;
}

const vendorName = localStorage.getItem('name') || '—';
const vendorEmail = localStorage.getItem('email') || '—';

const vendorNameLabel = document.getElementById('vendorName');
const vendorEmailLabel = document.getElementById('vendorEmail');
if (vendorNameLabel) vendorNameLabel.textContent = vendorName;
if (vendorEmailLabel) vendorEmailLabel.textContent = vendorEmail;

const logoutBtn = document.getElementById('logoutVendor');
logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('role_raw');
  localStorage.removeItem('name');
  localStorage.removeItem('email');
  window.location.href = 'index.html';
});

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const dateTime = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

const $ordersTbody = document.querySelector('#tblPedidos tbody');
const ordersAlert = document.getElementById('ordersAlert');
const ordersReloadBtn = document.getElementById('btnPedidosReload');
const ordersSearchInput = document.getElementById('ordersSearch');
const ordersClearBtn = document.getElementById('ordersClearFilters');
const ordersStatusCheckboxes = document.querySelectorAll('[data-order-status-filter]');

const orderModalElement = document.getElementById('modalPedidoEstado');
const orderModal = window.jQuery ? window.jQuery('#modalPedidoEstado') : null;
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

const ordersState = {
  list: [],
  loading: false,
  statusFilters: new Set(['pendiente', 'enviado']),
  search: '',
};

let currentOrder = null;
let alertTimer = null;

function buildHeaders(extra = {}) {
  const headers = { Accept: 'application/json', ...extra };
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

function normalizeStatus(value) {
  const text = (value || '').toString().trim().toLowerCase();
  if (!text) return 'pendiente';
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
    completed: 'pagado',
    cancelado: 'cancelado',
    cancelada: 'cancelado',
    cancelled: 'cancelado',
    void: 'cancelado',
  };
  return map[text] || text;
}

function statusLabel(status) {
  switch (status) {
    case 'pendiente': return 'Pendiente';
    case 'enviado': return 'Enviado';
    case 'pagado': return 'Pagado';
    case 'cancelado': return 'Cancelado';
    default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pendiente';
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'pendiente': return 'badge-soft-warning';
    case 'enviado': return 'badge-soft-info';
    case 'pagado': return 'badge-soft-success';
    case 'cancelado': return 'badge-soft-danger';
    default: return 'badge-soft-secondary';
  }
}

function parseDate(value) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? dateTime.format(date) : '—';
}

function normalizeOrder(raw = {}) {
  const status = normalizeStatus(raw.status ?? raw.estado ?? raw.estado_gestion ?? '');
  return {
    id: raw.id ?? raw.Id ?? null,
    code: raw.code ?? raw.codigo ?? `#${raw.id ?? raw.Id ?? ''}`,
    status,
    status_label: raw.status_label ?? statusLabel(status),
    total: Number(raw.total ?? raw.Total ?? 0) || 0,
    payment_method: raw.payment_method ?? raw.metodo_pago ?? null,
    payment_reference: raw.payment_reference ?? raw.referencia_pago ?? null,
    coupon_code: raw.coupon_code ?? raw.cupon_codigo ?? null,
    customer: {
      name: raw.customer?.name ?? raw.cliente ?? null,
      email: raw.customer?.email ?? raw.cliente_email ?? null,
      phone: raw.customer?.phone ?? raw.cliente_telefono ?? null,
      address: raw.customer?.address ?? raw.cliente_direccion ?? null,
    },
    delivery: {
      person: {
        name: raw.delivery?.person?.name ?? raw.repartidor_nombre ?? null,
        contact: raw.delivery?.person?.contact ?? raw.repartidor_contacto ?? null,
        id: raw.delivery?.person?.id ?? raw.repartidor_id ?? null,
      },
      payment_confirmed: Boolean(raw.delivery?.payment_confirmed ?? raw.pago_confirmado ?? false),
      notes: raw.delivery?.notes ?? raw.notas ?? null,
      assigned_at: raw.delivery?.assigned_at ?? raw.fecha_asignacion ?? null,
      shipped_at: raw.delivery?.shipped_at ?? raw.fecha_envio ?? null,
      paid_at: raw.delivery?.paid_at ?? raw.fecha_pago ?? null,
      canceled_at: raw.delivery?.canceled_at ?? raw.fecha_cancelacion ?? null,
      updated_at: raw.delivery?.updated_at ?? raw.actualizado_en ?? raw.gestion_actualizado_en ?? null,
    },
    created_at: raw.created_at ?? raw.creado_en ?? null,
    updated_at: raw.updated_at ?? raw.actualizado_en ?? null,
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

async function fetchOrders(filters = {}) {
  const params = new URLSearchParams();
  if (Array.isArray(filters.statuses) && filters.statuses.length) {
    params.set('status', filters.statuses.join(','));
  }
  if (filters.search) {
    params.set('q', filters.search.trim());
  }
  params.set('limit', String(filters.limit ?? 200));

  const res = await fetch(`${ORDERS_ENDPOINT}?${params.toString()}`, {
    headers: buildHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || data.message || 'No se pudieron cargar los pedidos.');
  }
  const collection = Array.isArray(data.orders)
    ? data.orders
    : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];
  return collection.map(normalizeOrder);
}

async function fetchOrderDetail(id) {
  const res = await fetch(`${ORDERS_ENDPOINT}?id=${encodeURIComponent(id)}&with=items`, {
    headers: buildHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || data.message || 'No se pudo cargar el pedido.');
  }
  const order = data.order ?? data.data ?? data;
  return normalizeOrder(order);
}

async function updateOrder(id, payload = {}) {
  const res = await fetch(`${ORDERS_ENDPOINT}?id=${encodeURIComponent(id)}&with=items`, {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || data.message || 'No se pudo actualizar el pedido.');
  }
  const order = data.order ?? data.data ?? data;
  return normalizeOrder(order);
}

function showOrdersAlert(message, type = 'danger', timeout = 4000) {
  if (!ordersAlert) return;
  ordersAlert.className = `alert alert-${type}`;
  ordersAlert.textContent = message;
  ordersAlert.classList.remove('d-none');
  if (alertTimer) {
    clearTimeout(alertTimer);
  }
  if (timeout) {
    alertTimer = window.setTimeout(() => {
      ordersAlert.classList.add('d-none');
      alertTimer = null;
    }, timeout);
  }
}

function hideOrdersAlert() {
  if (!ordersAlert) return;
  ordersAlert.classList.add('d-none');
  ordersAlert.textContent = '';
  if (alertTimer) {
    clearTimeout(alertTimer);
    alertTimer = null;
  }
}

function renderOrders() {
  if (!$ordersTbody) return;
  if (ordersState.loading) {
    $ordersTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Cargando pedidos...</td></tr>';
    return;
  }

  const search = ordersState.search.trim().toLowerCase();
  const statuses = ordersState.statusFilters;
  const filtered = ordersState.list.filter(order => {
    const statusOk = !statuses.size || statuses.has(order.status);
    if (!statusOk) return false;
    if (!search) return true;
    const haystack = [
      order.code,
      order.customer?.name,
      order.customer?.email,
      order.customer?.phone,
      order.delivery?.person?.name,
      order.delivery?.person?.contact,
      order.status_label,
    ].join(' ').toLowerCase();
    return haystack.includes(search);
  });

  if (!filtered.length) {
    $ordersTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No hay pedidos con los filtros seleccionados.</td></tr>';
    return;
  }

  $ordersTbody.innerHTML = filtered.map(order => {
    const deliveryName = order.delivery?.person?.name || 'Sin asignar';
    const deliveryContact = order.delivery?.person?.contact || '—';
    const paymentConfirmed = order.delivery?.payment_confirmed;
    const updatedAt = order.delivery?.updated_at || order.updated_at;
    const createdAt = order.created_at ? `<span class="order-meta-muted">Creado: ${formatDate(order.created_at)}</span>` : '';
    const statusBadge = `<span class="status-badge ${statusBadgeClass(order.status)}">${order.status_label}</span>`;
    const paymentChip = paymentConfirmed
      ? '<span class="order-payment-chip confirmed">Pago confirmado</span>'
      : '<span class="order-payment-chip pending">Pago pendiente</span>';

    return `
      <tr data-id="${order.id}">
        <td>
          <strong>${order.code || `#${order.id}`}</strong><br>
          ${statusBadge}
          ${createdAt}
        </td>
        <td>
          <strong>${order.customer?.name || 'Sin nombre'}</strong>
          <span class="order-mini-meta">${order.customer?.address || 'Sin dirección registrada'}</span>
        </td>
        <td>
          <span class="order-mini-meta">Tel: ${order.customer?.phone || '—'}</span>
          <span class="order-mini-meta">Email: ${order.customer?.email || '—'}</span>
        </td>
        <td>
          <span class="order-delivery-chip ${deliveryName === 'Sin asignar' ? 'unassigned' : ''}">${deliveryName}</span>
          <span class="order-mini-meta">Contacto: ${deliveryContact}</span>
        </td>
        <td>
          <span class="order-mini-meta">Método: ${order.payment_method || '—'}</span>
          ${paymentChip}
        </td>
        <td>${money.format(order.total)}</td>
        <td>
          <span class="order-mini-meta">Actualizado: ${formatDate(updatedAt)}</span>
        </td>
        <td class="text-right actions-column">
          <button class="btn btn-sm btn-primary" data-order-id="${order.id}">
            Gestionar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadOrders({ showLoader = false } = {}) {
  if (ordersState.loading) return;
  ordersState.loading = true;
  if (showLoader && $ordersTbody) {
    $ordersTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Actualizando pedidos...</td></tr>';
  }
  try {
    hideOrdersAlert();
    const statuses = Array.from(ordersState.statusFilters);
    const orders = await fetchOrders({ statuses, search: ordersState.search });
    ordersState.list = orders;
    renderOrders();
  } catch (err) {
    showOrdersAlert(err.message || 'No se pudieron cargar los pedidos.');
    if ($ordersTbody) {
      $ordersTbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${err.message || 'Error al cargar pedidos.'}</td></tr>`;
    }
  } finally {
    ordersState.loading = false;
  }
}

function resetOrderModal() {
  currentOrder = null;
  if (orderModalForm) orderModalForm.reset();
  if (orderModalAlert) {
    orderModalAlert.classList.add('d-none');
    orderModalAlert.textContent = '';
  }
  if (orderModalItemsBody) {
    orderModalItemsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin productos.</td></tr>';
  }
  if (orderModalTimeline) {
    orderModalTimeline.innerHTML = '<li class="text-muted">Sin eventos registrados.</li>';
  }
}

function fillOrderModal(order) {
  currentOrder = order;
  if (!order) return;
  if (orderModalIdInput) orderModalIdInput.value = order.id ?? '';
  if (orderModalTitle) orderModalTitle.textContent = `Pedido ${order.code || `#${order.id}`}`;
  if (orderModalCustomer) orderModalCustomer.textContent = order.customer?.name || 'Sin nombre';
  if (orderModalContact) orderModalContact.textContent = [order.customer?.email, order.customer?.phone].filter(Boolean).join(' · ') || 'Sin contacto';
  if (orderModalAddress) orderModalAddress.textContent = order.customer?.address || 'Sin dirección registrada';
  if (orderModalCode) orderModalCode.textContent = order.code || `#${order.id}`;
  if (orderModalDate) orderModalDate.textContent = formatDate(order.created_at);
  if (orderModalPayment) orderModalPayment.textContent = order.payment_method || '—';
  if (orderModalTotal) orderModalTotal.textContent = money.format(order.total);
  if (orderStatusSelect) orderStatusSelect.value = order.status;
  if (orderDeliveryNameInput) orderDeliveryNameInput.value = order.delivery?.person?.name || '';
  if (orderDeliveryContactInput) orderDeliveryContactInput.value = order.delivery?.person?.contact || '';
  if (orderPaymentConfirmedInput) orderPaymentConfirmedInput.checked = !!order.delivery?.payment_confirmed;
  if (orderNotesInput) orderNotesInput.value = order.delivery?.notes || '';

  if (orderModalItemsBody) {
    if (!order.items || !order.items.length) {
      orderModalItemsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin productos en la orden.</td></tr>';
    } else {
      orderModalItemsBody.innerHTML = order.items.map(item => {
        const quantity = Number(item.quantity ?? item.cantidad ?? 0);
        const unitPrice = Number(item.unit_price ?? item.precio ?? 0);
        const lineTotal = Number(item.line_total ?? item.total_linea ?? quantity * unitPrice);
        return `
          <tr>
            <td>${item.product_name || item.nombre || `#${item.product_id}`}</td>
            <td class="text-right">${quantity}</td>
            <td class="text-right">${money.format(unitPrice)}</td>
            <td class="text-right">${money.format(lineTotal)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  if (orderModalTimeline) {
    const timeline = [];
    if (order.created_at) timeline.push({ label: 'Creado', value: order.created_at });
    if (order.delivery?.assigned_at) timeline.push({ label: 'Asignado a repartidor', value: order.delivery.assigned_at });
    if (order.delivery?.shipped_at) timeline.push({ label: 'Enviado', value: order.delivery.shipped_at });
    if (order.delivery?.paid_at) timeline.push({ label: 'Pago confirmado', value: order.delivery.paid_at });
    if (order.delivery?.canceled_at) timeline.push({ label: 'Cancelado', value: order.delivery.canceled_at });
    if (order.delivery?.updated_at) timeline.push({ label: 'Última actualización', value: order.delivery.updated_at });

    if (!timeline.length) {
      orderModalTimeline.innerHTML = '<li class="text-muted">Sin historial registrado.</li>';
    } else {
      orderModalTimeline.innerHTML = timeline.map(entry => `
        <li>
          <strong>${entry.label}:</strong>
          <span class="d-block text-muted">${formatDate(entry.value)}</span>
        </li>
      `).join('');
    }
  }
}

function showOrderModalAlert(message) {
  if (!orderModalAlert) return;
  orderModalAlert.textContent = message;
  orderModalAlert.classList.remove('d-none');
}

function hideOrderModalAlert() {
  if (!orderModalAlert) return;
  orderModalAlert.classList.add('d-none');
  orderModalAlert.textContent = '';
}

async function openOrderModal(orderId) {
  resetOrderModal();
  if (!orderModalElement) return;
  if (orderModalTitle) orderModalTitle.textContent = 'Cargando pedido...';
  if (orderModalItemsBody) {
    orderModalItemsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Cargando productos...</td></tr>';
  }
  orderModal?.modal('show');
  try {
    const detail = await fetchOrderDetail(orderId);
    fillOrderModal(detail);
  } catch (err) {
    showOrderModalAlert(err.message || 'No se pudo cargar el pedido.');
  }
}

function updateOrderInState(order) {
  const index = ordersState.list.findIndex(item => item.id === order.id);
  if (index >= 0) {
    ordersState.list[index] = order;
  } else {
    ordersState.list.unshift(order);
  }
}

async function submitOrderModalUpdate({ status: forcedStatus, skipConfirm = false } = {}) {
  if (!currentOrder) return;
  const id = currentOrder.id;
  const status = forcedStatus ?? (orderStatusSelect ? orderStatusSelect.value : currentOrder.status);
  const deliveryName = orderDeliveryNameInput ? orderDeliveryNameInput.value.trim() : '';
  const deliveryContact = orderDeliveryContactInput ? orderDeliveryContactInput.value.trim() : '';
  let paymentConfirmed = orderPaymentConfirmedInput ? orderPaymentConfirmedInput.checked : currentOrder.delivery?.payment_confirmed;
  const notes = orderNotesInput ? orderNotesInput.value.trim() : '';

  if (status === 'enviado' && !deliveryName) {
    showOrderModalAlert('Debes asignar un repartidor antes de marcar la orden como enviada.');
    orderDeliveryNameInput?.focus();
    return;
  }

  if (status === 'pagado') {
    paymentConfirmed = true;
  }

  if (status === 'cancelado' && !skipConfirm) {
    const confirmed = window.confirm('¿Seguro que deseas cancelar la orden? Se devolverá el inventario correspondiente.');
    if (!confirmed) return;
  }

  hideOrderModalAlert();
  if (orderModalSubmitBtn) {
    orderModalSubmitBtn.disabled = true;
    orderModalSubmitBtn.textContent = 'Guardando...';
  }
  orderModalCancelBtn && (orderModalCancelBtn.disabled = true);

  try {
    const updated = await updateOrder(id, {
      status,
      delivery_person: deliveryName,
      delivery_contact: deliveryContact,
      payment_confirmed: paymentConfirmed,
      notes,
    });
    updateOrderInState(updated);
    renderOrders();
    fillOrderModal(updated);
    showOrdersAlert('Pedido actualizado correctamente.', 'success');
  } catch (err) {
    showOrderModalAlert(err.message || 'No se pudo actualizar el pedido.');
  } finally {
    if (orderModalSubmitBtn) {
      orderModalSubmitBtn.disabled = false;
      orderModalSubmitBtn.textContent = 'Guardar cambios';
    }
    orderModalCancelBtn && (orderModalCancelBtn.disabled = false);
  }
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

if ($ordersTbody) {
  $ordersTbody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-order-id]');
    if (!button) return;
    const id = button.getAttribute('data-order-id');
    if (!id) return;
    openOrderModal(id);
  });
}

ordersStatusCheckboxes.forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const selected = new Set();
    ordersStatusCheckboxes.forEach(box => {
      if (box.checked) {
        selected.add(normalizeStatus(box.value));
      }
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
    ordersState.statusFilters = new Set(['pendiente', 'enviado']);
    ordersStatusCheckboxes.forEach(box => {
      box.checked = ordersState.statusFilters.has(normalizeStatus(box.value));
    });
    renderOrders();
    loadPedidos({ showLoader: true });
  });
}

if (ordersReloadBtn) {
  ordersReloadBtn.addEventListener('click', () => {
    loadOrders({ showLoader: true });
  });
}

loadOrders({ showLoader: true });

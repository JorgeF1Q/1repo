/**
 * Panel de configuración conectado a Supabase.
 * Tablas esperadas:
 *  - usuario: usuario_id (PK), nombre, email, telefono, rol_id (FK rol.rol_id), estado, password_hash, ultimo_acceso.
 *  - rol: rol_id (PK), nombre, descripcion, nivel.
 *  - permiso: permiso_id (PK), codigo, categoria, descripcion.
 *  - rol_permiso: (PK opcional), rol_id, permiso_id.
 *  - auditoria: auditoria_id (PK), entidad, accion, detalle, usuario/usuario_id/usuario_email, fecha/timestamp.
 */
const settingsWrapper = document.getElementById('settingsWrapper');
const settingsStatus = document.getElementById('settingsStatus');
const settingsPlaceholder = document.getElementById('settingsPlaceholder');

const state = {
  users: [],
  roles: [],
  permissions: [],
  rolePermissions: [],
  auditRaw: [],
  audit: [],
  auditFilters: {
    entidad: '',
    usuario: ''
  },
  clients: [],
  suppliers: [],
  products: [],
  orders: [],
  orderItems: [],
  selectedOrderId: null
};

let client = null;
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

function showStatus(message, type = 'info', timeout = 4500) {
  if (!settingsStatus) return;
  settingsStatus.textContent = message;
  settingsStatus.classList.toggle('error', type === 'error');
  settingsStatus.style.display = 'block';

  window.clearTimeout(showStatus._timeoutId);
  if (timeout && timeout > 0) {
    showStatus._timeoutId = window.setTimeout(() => {
      settingsStatus.style.display = 'none';
    }, timeout);
  }
}

function hideStatus() {
  if (!settingsStatus) return;
  window.clearTimeout(showStatus._timeoutId);
  settingsStatus.style.display = 'none';
}

function setPlaceholderVisible(visible) {
  if (!settingsPlaceholder) return;
  if (visible) {
    settingsPlaceholder.hidden = false;
    settingsPlaceholder.style.display = '';
  } else {
    settingsPlaceholder.hidden = true;
    settingsPlaceholder.style.display = 'none';
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableValue(value) {
  const cleaned = normalizeString(value);
  return cleaned ? cleaned : null;
}

function firstAvailable(obj, candidates, fallback = undefined) {
  if (!obj) return fallback;
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }
  return fallback;
}

function humanizeStatus(value, fallback = 'Pendiente') {
  if (!value) return fallback;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function formatOrderCode(value) {
  if (value === null || value === undefined) return 'ORD-—';
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `ORD-${String(numeric).padStart(3, '0')}`;
  }
  return `ORD-${String(value).trim()}`;
}

function formatDateTime(value) {
  if (!value) return '';
  let date = value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      date = new Date(parsed);
    }
  }
  if (typeof date === 'number') {
    date = new Date(date);
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

async function hashPassword(plain) {
  if (!plain) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function renderUsers() {
  const tbody = settingsWrapper?.querySelector('[data-users-body]');
  if (!tbody) return;

  if (!state.users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="settings-empty">Sin usuarios registrados todavía.</td></tr>';
    return;
  }

  const rows = state.users.map(user => {
    const id = firstAvailable(user, ['usuario_id', 'id']);
    const roleId = firstAvailable(user, ['rol_id', 'role_id']);
    const roleName = state.roles.find(r => firstAvailable(r, ['rol_id', 'id']) === roleId)?.nombre ?? '—';
    const status = normalizeString(firstAvailable(user, ['estado', 'status', 'activo'])) || 'activo';
    const lastAccess = firstAvailable(user, ['ultimo_acceso', 'last_login_at', 'updated_at', 'fecha_acceso']);

    return `
      <tr data-id="${id ?? ''}">
        <td>${user.nombre ?? user.name ?? '—'}</td>
        <td>${user.email ?? '—'}</td>
        <td>${roleName}</td>
        <td class="text-capitalize">${status}</td>
        <td>${lastAccess ? formatDateTime(lastAccess) : '—'}</td>
        <td class="text-right">
          <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
          <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');
}

function renderRoles() {
  const tbody = settingsWrapper?.querySelector('[data-roles-body]');
  const userRoleSelect = document.getElementById('userRol');
  const rpRolSelect = document.getElementById('rpRol');

  if (tbody) {
    if (!state.roles.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="settings-empty">Sin roles disponibles.</td></tr>';
    } else {
      tbody.innerHTML = state.roles
        .map(role => {
          const id = firstAvailable(role, ['rol_id', 'id']);
          const nivel = firstAvailable(role, ['nivel', 'priority']);
          const descripcion = firstAvailable(role, ['descripcion', 'description']);
          return `
            <tr data-id="${id ?? ''}">
              <td>${role.nombre ?? role.name ?? '—'}</td>
              <td>${nivel ?? '—'}</td>
              <td>${descripcion ?? '—'}</td>
              <td class="text-right">
                <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
                <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  const buildOptions = (select) => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Selecciona rol</option>' +
      state.roles
        .map(role => {
          const id = firstAvailable(role, ['rol_id', 'id']);
          const name = role.nombre ?? role.name ?? `Rol ${id}`;
          return `<option value="${id}">${name}</option>`;
        })
        .join('');
    if (currentValue) {
      select.value = currentValue;
    }
  };

  buildOptions(userRoleSelect);
  buildOptions(rpRolSelect);
}

function renderPermissions() {
  const tbody = settingsWrapper?.querySelector('[data-permissions-body]');
  const rpPermisoSelect = document.getElementById('rpPermiso');

  if (tbody) {
    if (!state.permissions.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="settings-empty">Aún no has definido permisos.</td></tr>';
    } else {
      tbody.innerHTML = state.permissions
        .map(permission => {
          const id = firstAvailable(permission, ['permiso_id', 'id']);
          const codigo = firstAvailable(permission, ['codigo', 'code']);
          const categoria = firstAvailable(permission, ['categoria', 'category']);
          const descripcion = firstAvailable(permission, ['descripcion', 'description']);
          return `
            <tr data-id="${id ?? ''}">
              <td>${codigo ?? '—'}</td>
              <td>${categoria ?? '—'}</td>
              <td>${descripcion ?? '—'}</td>
              <td class="text-right">
                <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
                <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  if (rpPermisoSelect) {
    const currentValue = rpPermisoSelect.value;
    rpPermisoSelect.innerHTML = '<option value="">Selecciona permiso</option>' +
      state.permissions
        .map(permission => {
          const id = firstAvailable(permission, ['permiso_id', 'id']);
          const code = firstAvailable(permission, ['codigo', 'code', 'nombre']) ?? `Permiso ${id}`;
          return `<option value="${id}">${code}</option>`;
        })
        .join('');
    if (currentValue) {
      rpPermisoSelect.value = currentValue;
    }
  }
}

function renderRolePermissions() {
  const container = document.getElementById('rolePermissionList');
  if (!container) return;

  if (!state.rolePermissions.length) {
    container.innerHTML = '<p class="settings-empty mb-0">Aún no hay permisos asociados a roles.</p>';
    return;
  }

  const grouped = new Map();
  for (const link of state.rolePermissions) {
    const roleId = firstAvailable(link, ['rol_id', 'role_id']);
    const permId = firstAvailable(link, ['permiso_id', 'permission_id']);
    if (!roleId || !permId) continue;

    const role = state.roles.find(r => firstAvailable(r, ['rol_id', 'id']) === roleId);
    const permission = state.permissions.find(p => firstAvailable(p, ['permiso_id', 'id']) === permId);
    const roleName = role?.nombre ?? role?.name ?? `Rol ${roleId}`;
    const permName = firstAvailable(permission, ['codigo', 'code', 'nombre', 'name']) ?? `Permiso ${permId}`;

    if (!grouped.has(roleId)) {
      grouped.set(roleId, {
        name: roleName,
        permissions: []
      });
    }

    grouped.get(roleId).permissions.push({
      id: permId,
      name: permName
    });
  }

  const sections = Array.from(grouped.entries()).map(([roleId, info]) => {
    const chips = info.permissions
      .map(perm => `
        <span class="settings-chip" data-role="${roleId}" data-permission="${perm.id}">
          ${perm.name}
          <button type="button" title="Quitar" data-action="remove-rp" data-role="${roleId}" data-permission="${perm.id}">×</button>
        </span>
      `)
      .join('');

    return `
      <div class="mb-2" data-role="${roleId}">
        <strong>${info.name}</strong>
        <div class="mt-1">${chips || '<span class="text-muted">Sin permisos asignados.</span>'}</div>
      </div>
    `;
  });

  container.innerHTML = sections.join('');
}

function renderAudit() {
  const tbody = settingsWrapper?.querySelector('[data-audit-body]');
  if (!tbody) return;

  if (!state.audit.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="settings-empty">No hay registros de auditoría para los filtros actuales.</td></tr>';
    return;
  }

  tbody.innerHTML = state.audit
    .map(entry => {
      const fecha = firstAvailable(entry, ['fecha', 'created_at', 'fecha_evento', 'timestamp']);
      const entidad = firstAvailable(entry, ['entidad', 'tabla', 'entity']);
      const accion = firstAvailable(entry, ['accion', 'accion_realizada', 'action']);
      const detalle = firstAvailable(entry, ['detalle', 'descripcion', 'description']);
      const usuario = firstAvailable(entry, ['usuario', 'usuario_id', 'user_email', 'usuario_email']);

      return `
        <tr>
          <td>${fecha ? formatDateTime(fecha) : '—'}</td>
          <td>${entidad ?? '—'}</td>
          <td>${accion ?? '—'}</td>
          <td>${detalle ?? '—'}</td>
          <td>${usuario ?? '—'}</td>
        </tr>
      `;
    })
    .join('');
}

function renderClients() {
  const tbody = settingsWrapper?.querySelector('[data-clients-body]');
  if (!tbody) return;

  if (!state.clients.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="settings-empty">Conecta Supabase para listar clientes.</td></tr>';
  } else {
    tbody.innerHTML = state.clients
      .map(client => {
        const id = Number(firstAvailable(client, ['cliente_id', 'id']));
        const nombre = client.nombre || client.name || '—';
        const correo = client.email || '—';
        const telefono = client.telefono || client.phone || '—';
        return `
          <tr data-id="${id}">
            <td>${nombre}</td>
            <td>${correo}</td>
            <td>${telefono}</td>
            <td class="text-right">
              <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
              <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  populateClientOptions();
}

function renderSuppliers() {
  const tbody = settingsWrapper?.querySelector('[data-suppliers-body]');
  if (!tbody) return;

  if (!state.suppliers.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="settings-empty">Registra tus proveedores para verlos aquí.</td></tr>';
  } else {
    tbody.innerHTML = state.suppliers
      .map(supplier => {
        const id = Number(firstAvailable(supplier, ['proveedor_id', 'id']));
        const nombre = supplier.nombre || supplier.name || '—';
        const nit = supplier.nit || '—';
        const telefono = supplier.telefono || '—';
        const direccion = supplier.direccion || '—';
        return `
          <tr data-id="${id}">
            <td>${nombre}</td>
            <td>${nit}</td>
            <td>${telefono}</td>
            <td>${direccion}</td>
            <td class="text-right">
              <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
              <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }
}

function populateClientOptions() {
  const select = document.getElementById('orderCliente');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Selecciona cliente</option>';
  state.clients.forEach(client => {
    const id = firstAvailable(client, ['cliente_id', 'id']);
    if (id === null || id === undefined) return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = client.nombre || client.name || `Cliente ${id}`;
    select.appendChild(option);
  });
  if (current) {
    select.value = current;
  }
}

function populateProductOptions() {
  const select = document.getElementById('orderItemProducto');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Selecciona producto</option>';
  state.products.forEach(product => {
    const id = firstAvailable(product, ['producto_id', 'id']);
    if (id === null || id === undefined) return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = product.nombre || product.name || `Producto ${id}`;
    select.appendChild(option);
  });
  if (current) {
    select.value = current;
  }
}

function renderOrders() {
  const tbody = settingsWrapper?.querySelector('[data-orders-body]');
  if (!tbody) return;

  if (!state.orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="settings-empty">Crea tu primera orden para verla aquí.</td></tr>';
    toggleOrderItemsSection(false);
    return;
  }

  tbody.innerHTML = state.orders
    .map(order => {
      const id = Number(firstAvailable(order, ['orden_id', 'id']));
      const clientId = firstAvailable(order, ['cliente_id', 'client_id']);
      const clientName = state.clients.find(c => Number(firstAvailable(c, ['cliente_id', 'id'])) === Number(clientId))?.nombre || '—';
      const estado = humanizeStatus(firstAvailable(order, ['estado', 'status']), 'Pendiente');
      const total = money.format(Number(firstAvailable(order, ['total', 'monto_total', 'importe'])) || 0);
      const fecha = formatDateTime(firstAvailable(order, ['fecha', 'created_at', 'fecha_creacion', 'fecha_registro'])) || '—';
      const rowClass = state.selectedOrderId === id ? 'table-active' : '';
      return `
        <tr data-id="${id}" class="${rowClass}">
          <td>${formatOrderCode(id)}</td>
          <td>${clientName}</td>
          <td>${estado}</td>
          <td>${total}</td>
          <td>${fecha}</td>
          <td class="text-right">
            <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
            <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function toggleOrderItemsSection(visible) {
  const section = document.getElementById('orderItemsSection');
  if (!section) return;
  section.style.display = visible ? '' : 'none';
  const form = document.getElementById('orderItemForm');
  if (form) {
    Array.from(form.elements).forEach(element => {
      if (element.tagName === 'BUTTON') return;
      element.disabled = !visible;
    });
  }
}

function renderOrderItems() {
  const tbody = settingsWrapper?.querySelector('[data-order-items-body]');
  const hint = document.getElementById('orderItemsHint');
  if (!tbody) return;

  if (!state.selectedOrderId) {
    if (hint) hint.textContent = '';
    toggleOrderItemsSection(false);
    tbody.innerHTML = '<tr><td colspan="5" class="settings-empty">Selecciona una orden para gestionar sus productos.</td></tr>';
    return;
  }

  toggleOrderItemsSection(true);

  const order = state.orders.find(item => Number(firstAvailable(item, ['orden_id', 'id'])) === state.selectedOrderId);
  if (hint && order) {
    hint.textContent = `Orden ${formatOrderCode(state.selectedOrderId)} · ${humanizeStatus(firstAvailable(order, ['estado', 'status']), 'Pendiente')}`;
  }

  if (!state.orderItems.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="settings-empty">Aún no hay productos asociados a esta orden.</td></tr>';
    return;
  }

  const productMap = new Map(state.products.map(product => [String(firstAvailable(product, ['producto_id', 'id'])), product]));

  tbody.innerHTML = state.orderItems
    .map(item => {
      const id = Number(firstAvailable(item, ['orden_detalle_id', 'id']));
      const productId = firstAvailable(item, ['producto_id', 'product_id']);
      const product = productMap.get(String(productId));
      const cantidad = Number(firstAvailable(item, ['cantidad', 'quantity', 'qty'])) || 0;
      const precio = Number(firstAvailable(item, ['precio_unitario', 'precio', 'price'])) || 0;
      const total = money.format(cantidad * precio);
      return `
        <tr data-id="${id}">
          <td>${product?.nombre || product?.name || 'Producto'}</td>
          <td>${cantidad}</td>
          <td>${money.format(precio)}</td>
          <td>${total}</td>
          <td class="text-right">
            <button class="btn btn-link btn-sm" data-action="edit" data-id="${id}">Editar</button>
            <button class="btn btn-link btn-sm text-danger" data-action="delete" data-id="${id}">Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function setSelectedOrder(orderId) {
  const normalized = Number(orderId) || null;
  state.selectedOrderId = normalized;
  const orderItemForm = document.getElementById('orderItemForm');
  if (orderItemForm) {
    resetForm(orderItemForm);
  }
  renderOrders();
  if (normalized) {
    loadOrderItems(normalized);
  } else {
    state.orderItems = [];
    renderOrderItems();
  }
}

function applyAuditFilters(data) {
  const entidadFilter = normalizeString(state.auditFilters.entidad).toLowerCase();
  const usuarioFilter = normalizeString(state.auditFilters.usuario).toLowerCase();

  if (!entidadFilter && !usuarioFilter) return data;

  return data.filter(entry => {
    const entidad = normalizeString(firstAvailable(entry, ['entidad', 'tabla', 'entity'])).toLowerCase();
    const usuario = normalizeString(firstAvailable(entry, ['usuario', 'usuario_id', 'user_email', 'usuario_email'])).toLowerCase();

    const matchesEntidad = entidadFilter ? entidad.includes(entidadFilter) : true;
    const matchesUsuario = usuarioFilter ? usuario.includes(usuarioFilter) : true;

    return matchesEntidad && matchesUsuario;
  });
}

function sortAudit(data) {
  return [...data].sort((a, b) => {
    const dateA = Date.parse(firstAvailable(a, ['fecha', 'created_at', 'fecha_evento', 'timestamp'])) || 0;
    const dateB = Date.parse(firstAvailable(b, ['fecha', 'created_at', 'fecha_evento', 'timestamp'])) || 0;
    return dateB - dateA;
  });
}

function attachTableActions() {
  const usersTbody = settingsWrapper?.querySelector('[data-users-body]');
  const rolesTbody = settingsWrapper?.querySelector('[data-roles-body]');
  const permissionsTbody = settingsWrapper?.querySelector('[data-permissions-body]');
  const clientsTbody = settingsWrapper?.querySelector('[data-clients-body]');
  const suppliersTbody = settingsWrapper?.querySelector('[data-suppliers-body]');
  const ordersTbody = settingsWrapper?.querySelector('[data-orders-body]');
  const orderItemsTbody = settingsWrapper?.querySelector('[data-order-items-body]');
  const rpContainer = document.getElementById('rolePermissionList');

  usersTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !client) return;
    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const user = state.users.find(item => Number(firstAvailable(item, ['usuario_id', 'id'])) === id);
      if (!user) return;
      const form = document.getElementById('userForm');
      if (!form) return;
      form.usuario_id.value = id;
      form.nombre.value = user.nombre ?? user.name ?? '';
      form.email.value = user.email ?? '';
      form.telefono.value = firstAvailable(user, ['telefono', 'phone']) ?? '';
      form.rol_id.value = firstAvailable(user, ['rol_id', 'role_id']) ?? '';
      form.estado.value = normalizeString(firstAvailable(user, ['estado', 'status', 'activo'])) || 'activo';
      form.password.value = '';
      showStatus('Editando usuario seleccionado. Guarda para aplicar cambios.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
      try {
        const { error } = await client.from('usuario').delete().eq('usuario_id', id);
        if (error) throw error;
        showStatus('Usuario eliminado correctamente.');
        await loadUsers();
      } catch (error) {
        console.error('[settings] Error al eliminar usuario', error);
        showStatus(`No se pudo eliminar el usuario: ${error.message}`, 'error', 6500);
      }
    }
  });

  rolesTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !client) return;
    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const role = state.roles.find(item => Number(firstAvailable(item, ['rol_id', 'id'])) === id);
      if (!role) return;
      const form = document.getElementById('roleForm');
      if (!form) return;
      form.rol_id.value = id;
      form.nombre.value = role.nombre ?? role.name ?? '';
      form.nivel.value = firstAvailable(role, ['nivel', 'priority']) ?? '';
      form.descripcion.value = firstAvailable(role, ['descripcion', 'description']) ?? '';
      showStatus('Editando rol seleccionado.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este rol? También se eliminarán sus asignaciones.')) return;
      try {
        const { error: relError } = await client.from('rol_permiso').delete().eq('rol_id', id);
        if (relError) throw relError;
        const usersWithRole = state.users.some(user => Number(firstAvailable(user, ['rol_id', 'role_id'])) === id);
        if (usersWithRole) {
          const { error: usersError } = await client.from('usuario').update({ rol_id: null }).eq('rol_id', id);
          if (usersError) {
            console.warn('[settings] No se pudo limpiar rol en usuarios', usersError);
          }
        }
        const { error } = await client.from('rol').delete().eq('rol_id', id);
        if (error) throw error;
        showStatus('Rol eliminado correctamente.');
        await Promise.all([loadRoles(), loadRolePermissions(), loadUsers()]);
      } catch (error) {
        console.error('[settings] Error al eliminar rol', error);
        showStatus(`No se pudo eliminar el rol: ${error.message}`, 'error', 6500);
      }
    }
  });

  permissionsTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !client) return;
    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const permission = state.permissions.find(item => Number(firstAvailable(item, ['permiso_id', 'id'])) === id);
      if (!permission) return;
      const form = document.getElementById('permissionForm');
      if (!form) return;
      form.permiso_id.value = id;
      form.codigo.value = firstAvailable(permission, ['codigo', 'code', 'nombre']) ?? '';
      form.categoria.value = firstAvailable(permission, ['categoria', 'category']) ?? '';
      form.descripcion.value = firstAvailable(permission, ['descripcion', 'description']) ?? '';
      showStatus('Editando permiso seleccionado.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este permiso? Se quitará de todos los roles.')) return;
      try {
        const { error: relError } = await client.from('rol_permiso').delete().eq('permiso_id', id);
        if (relError) throw relError;
        const { error } = await client.from('permiso').delete().eq('permiso_id', id);
        if (error) throw error;
        showStatus('Permiso eliminado correctamente.');
        await Promise.all([loadPermissions(), loadRolePermissions()]);
      } catch (error) {
        console.error('[settings] Error al eliminar permiso', error);
        showStatus(`No se pudo eliminar el permiso: ${error.message}`, 'error', 6500);
      }
    }
  });

  rpContainer?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action="remove-rp"]');
    if (!button || !client) return;
    const rolId = Number(button.dataset.role);
    const permisoId = Number(button.dataset.permission);
    if (!rolId || !permisoId) return;

    try {
      const { error } = await client.from('rol_permiso').delete().match({ rol_id: rolId, permiso_id: permisoId });
      if (error) throw error;
      showStatus('Permiso retirado del rol.');
      await loadRolePermissions();
    } catch (error) {
      console.error('[settings] Error al quitar permiso del rol', error);
      showStatus(`No se pudo quitar el permiso: ${error.message}`, 'error', 6500);
    }
  });

  clientsTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !client) return;
    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const record = state.clients.find(item => Number(firstAvailable(item, ['cliente_id', 'id'])) === id);
      if (!record) return;
      const form = document.getElementById('clientForm');
      if (!form) return;
      form.cliente_id.value = id;
      form.nombre.value = record.nombre ?? record.name ?? '';
      form.email.value = record.email ?? '';
      form.telefono.value = firstAvailable(record, ['telefono', 'phone']) ?? '';
      showStatus('Editando cliente seleccionado.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return;
      try {
        const { error } = await client.from('cliente').delete().eq('cliente_id', id);
        if (error) throw error;
        showStatus('Cliente eliminado correctamente.');
        await loadClients();
        await loadOrders();
      } catch (error) {
        console.error('[settings] Error al eliminar cliente', error);
        showStatus(`No se pudo eliminar el cliente: ${error.message}`, 'error', 6500);
      }
    }
  });

  suppliersTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !client) return;
    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const record = state.suppliers.find(item => Number(firstAvailable(item, ['proveedor_id', 'id'])) === id);
      if (!record) return;
      const form = document.getElementById('supplierForm');
      if (!form) return;
      form.proveedor_id.value = id;
      form.nombre.value = record.nombre ?? record.name ?? '';
      form.nit.value = firstAvailable(record, ['nit', 'tax_id']) ?? '';
      form.telefono.value = record.telefono ?? '';
      form.direccion.value = record.direccion ?? '';
      showStatus('Editando proveedor seleccionado.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este proveedor?')) return;
      try {
        const { error } = await client.from('proveedor').delete().eq('proveedor_id', id);
        if (error) throw error;
        showStatus('Proveedor eliminado correctamente.');
        await loadSuppliers();
      } catch (error) {
        console.error('[settings] Error al eliminar proveedor', error);
        showStatus(`No se pudo eliminar el proveedor: ${error.message}`, 'error', 6500);
      }
    }
  });

  ordersTbody?.addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-id]');
    if (!row || !client) return;
    const id = Number(row.dataset.id);
    if (!id) return;

    const button = event.target.closest('button[data-action]');
    if (button) {
      if (button.dataset.action === 'edit') {
        const record = state.orders.find(item => Number(firstAvailable(item, ['orden_id', 'id'])) === id);
        if (!record) return;
        const form = document.getElementById('orderForm');
        if (!form) return;
        form.orden_id.value = id;
        const clientId = firstAvailable(record, ['cliente_id', 'client_id']);
        if (clientId !== undefined && clientId !== null) {
          form.cliente_id.value = clientId;
        }
        const estado = normalizeString(firstAvailable(record, ['estado', 'status'])) || 'pendiente';
        form.estado.value = estado;
        const totalValue = firstAvailable(record, ['total', 'monto_total', 'importe']);
        form.total.value = totalValue === null || totalValue === undefined || Number.isNaN(Number(totalValue)) ? '' : Number(totalValue);
        showStatus('Editando orden seleccionada.', 'info', 3200);
        setSelectedOrder(id);
      } else if (button.dataset.action === 'delete') {
        if (!window.confirm('¿Eliminar esta orden y sus productos asociados?')) return;
        try {
          const { error: detailError } = await client.from('orden_detalle').delete().eq('orden_id', id);
          if (detailError) throw detailError;
          const { error } = await client.from('orden').delete().eq('orden_id', id);
          if (error) throw error;
          showStatus('Orden eliminada correctamente.');
          if (state.selectedOrderId === id) {
            state.selectedOrderId = null;
          }
          await loadOrders();
        } catch (error) {
          console.error('[settings] Error al eliminar orden', error);
          showStatus(`No se pudo eliminar la orden: ${error.message}`, 'error', 6500);
        }
      }
      return;
    }

    setSelectedOrder(id);
  });

  orderItemsTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !client) return;
    const id = Number(button.dataset.id);
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const record = state.orderItems.find(item => Number(firstAvailable(item, ['orden_detalle_id', 'id'])) === id);
      if (!record) return;
      const form = document.getElementById('orderItemForm');
      if (!form) return;
      form.orden_detalle_id.value = id;
      const productId = firstAvailable(record, ['producto_id', 'product_id']);
      if (productId !== undefined && productId !== null) {
        form.producto_id.value = productId;
      }
      const quantityValue = Number(firstAvailable(record, ['cantidad', 'quantity', 'qty'])) || 1;
      form.cantidad.value = quantityValue;
      const priceValue = Number(firstAvailable(record, ['precio_unitario', 'precio', 'price']));
      form.precio_unitario.value = Number.isFinite(priceValue) ? priceValue : '';
      showStatus('Editando producto de la orden.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este producto de la orden?')) return;
      try {
        const { error } = await client.from('orden_detalle').delete().eq('orden_detalle_id', id);
        if (error) throw error;
        showStatus('Producto eliminado de la orden.');
        await loadOrderItems();
        await loadOrders();
      } catch (error) {
        console.error('[settings] Error al eliminar producto de la orden', error);
        showStatus(`No se pudo eliminar el producto: ${error.message}`, 'error', 6500);
      }
    }
  });
}

async function loadUsers() {
  if (!client) return;
  try {
    const { data, error } = await client.from('usuario').select('*');
    if (error) throw error;
    state.users = Array.isArray(data) ? data : [];
    renderUsers();
  } catch (error) {
    console.error('[settings] Error al cargar usuarios', error);
    showStatus(`Error al cargar usuarios: ${error.message}`, 'error', 6500);
  }
}

async function loadRoles() {
  if (!client) return;
  try {
    const { data, error } = await client.from('rol').select('*');
    if (error) throw error;
    state.roles = Array.isArray(data) ? data : [];
    renderRoles();
  } catch (error) {
    console.error('[settings] Error al cargar roles', error);
    showStatus(`Error al cargar roles: ${error.message}`, 'error', 6500);
  }
}

async function loadPermissions() {
  if (!client) return;
  try {
    const { data, error } = await client.from('permiso').select('*');
    if (error) throw error;
    state.permissions = Array.isArray(data) ? data : [];
    renderPermissions();
  } catch (error) {
    console.error('[settings] Error al cargar permisos', error);
    showStatus(`Error al cargar permisos: ${error.message}`, 'error', 6500);
  }
}

async function loadRolePermissions() {
  if (!client) return;
  try {
    const { data, error } = await client.from('rol_permiso').select('*');
    if (error) throw error;
    state.rolePermissions = Array.isArray(data) ? data : [];
    renderRolePermissions();
  } catch (error) {
    console.error('[settings] Error al cargar asignaciones', error);
    showStatus(`Error al cargar asignaciones: ${error.message}`, 'error', 6500);
  }
}

async function loadAudit() {
  if (!client) return;
  try {
    const { data, error } = await client.from('auditoria').select('*').limit(200);
    if (error) throw error;
    const sorted = sortAudit(Array.isArray(data) ? data : []);
    state.auditRaw = sorted;
    state.audit = applyAuditFilters(sorted);
    renderAudit();
  } catch (error) {
    console.error('[settings] Error al cargar auditoría', error);
    showStatus(`Error al cargar auditoría: ${error.message}`, 'error', 6500);
  }
}

async function loadClients() {
  if (!client) return;
  try {
    const { data, error } = await client.from('cliente').select('*');
    if (error) throw error;
    state.clients = Array.isArray(data) ? data : [];
    renderClients();
    renderOrders();
  } catch (error) {
    console.error('[settings] Error al cargar clientes', error);
    showStatus(`Error al cargar clientes: ${error.message}`, 'error', 6500);
  }
}

async function loadSuppliers() {
  if (!client) return;
  try {
    const { data, error } = await client.from('proveedor').select('*');
    if (error) throw error;
    state.suppliers = Array.isArray(data) ? data : [];
    renderSuppliers();
  } catch (error) {
    console.error('[settings] Error al cargar proveedores', error);
    showStatus(`Error al cargar proveedores: ${error.message}`, 'error', 6500);
  }
}

async function loadProducts() {
  if (!client) return;
  try {
    const { data, error } = await client.from('producto').select('*');
    if (error) throw error;
    state.products = Array.isArray(data) ? data : [];
    populateProductOptions();
    renderOrderItems();
  } catch (error) {
    console.error('[settings] Error al cargar productos', error);
    showStatus(`Error al cargar productos: ${error.message}`, 'error', 6500);
  }
}

async function loadOrders() {
  if (!client) return;
  try {
    const { data, error } = await client.from('orden').select('*');
    if (error) throw error;
    const records = Array.isArray(data) ? data : [];
    records.sort((a, b) => {
      const dateA = Date.parse(firstAvailable(a, ['fecha', 'created_at', 'updated_at', 'fecha_actualizacion'])) || 0;
      const dateB = Date.parse(firstAvailable(b, ['fecha', 'created_at', 'updated_at', 'fecha_actualizacion'])) || 0;
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      const idA = Number(firstAvailable(a, ['orden_id', 'id'])) || 0;
      const idB = Number(firstAvailable(b, ['orden_id', 'id'])) || 0;
      return idB - idA;
    });
    state.orders = records;
    if (state.selectedOrderId) {
      const exists = state.orders.some(order => Number(firstAvailable(order, ['orden_id', 'id'])) === state.selectedOrderId);
      if (!exists) {
        state.selectedOrderId = null;
      }
    }
    renderOrders();
    if (state.selectedOrderId) {
      await loadOrderItems(state.selectedOrderId);
    } else {
      state.orderItems = [];
      renderOrderItems();
    }
  } catch (error) {
    console.error('[settings] Error al cargar órdenes', error);
    showStatus(`Error al cargar órdenes: ${error.message}`, 'error', 6500);
  }
}

async function loadOrderItems(orderId = state.selectedOrderId) {
  if (!client) return;
  const targetId = Number(orderId) || null;
  if (!targetId) {
    state.orderItems = [];
    renderOrderItems();
    return;
  }

  try {
    const { data, error } = await client.from('orden_detalle').select('*').eq('orden_id', targetId);
    if (error) throw error;
    state.orderItems = Array.isArray(data) ? data : [];
    renderOrderItems();
  } catch (error) {
    console.error('[settings] Error al cargar productos de la orden', error);
    showStatus(`Error al cargar productos de la orden: ${error.message}`, 'error', 6500);
  }
}

async function saveClient(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('cliente_id')) || null;

  const payload = {
    nombre: nullableValue(formData.get('nombre')),
    email: nullableValue(formData.get('email')),
    telefono: nullableValue(formData.get('telefono'))
  };

  if (!payload.nombre) {
    showStatus('El nombre del cliente es obligatorio.', 'error', 5000);
    return;
  }

  if (payload.email) {
    payload.email = payload.email.toLowerCase();
  }

  try {
    if (id) {
      const { error } = await client.from('cliente').update(payload).eq('cliente_id', id);
      if (error) throw error;
      showStatus('Cliente actualizado correctamente.');
    } else {
      const { error } = await client.from('cliente').insert(payload);
      if (error) throw error;
      showStatus('Cliente creado correctamente.');
    }
    resetForm(form);
    await loadClients();
    await loadOrders();
  } catch (error) {
    console.error('[settings] Error al guardar cliente', error);
    showStatus(`No se pudo guardar el cliente: ${error.message}`, 'error', 6500);
  }
}

async function saveSupplier(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('proveedor_id')) || null;

  const payload = {
    nombre: nullableValue(formData.get('nombre')),
    nit: nullableValue(formData.get('nit')),
    telefono: nullableValue(formData.get('telefono')),
    direccion: nullableValue(formData.get('direccion'))
  };

  if (!payload.nombre) {
    showStatus('El nombre del proveedor es obligatorio.', 'error', 5000);
    return;
  }

  try {
    if (id) {
      const { error } = await client.from('proveedor').update(payload).eq('proveedor_id', id);
      if (error) throw error;
      showStatus('Proveedor actualizado correctamente.');
    } else {
      const { error } = await client.from('proveedor').insert(payload);
      if (error) throw error;
      showStatus('Proveedor creado correctamente.');
    }
    resetForm(form);
    await loadSuppliers();
  } catch (error) {
    console.error('[settings] Error al guardar proveedor', error);
    showStatus(`No se pudo guardar el proveedor: ${error.message}`, 'error', 6500);
  }
}

async function saveOrder(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('orden_id')) || null;

  const payload = {
    cliente_id: Number(formData.get('cliente_id')) || null,
    estado: nullableValue(formData.get('estado')) || 'pendiente'
  };

  const totalRaw = formData.get('total');
  if (totalRaw !== null && totalRaw !== undefined && totalRaw !== '') {
    const parsedTotal = Number(totalRaw);
    if (Number.isNaN(parsedTotal)) {
      showStatus('Ingresa un total válido para la orden.', 'error', 5000);
      return;
    }
    payload.total = parsedTotal;
  }

  if (!payload.cliente_id) {
    showStatus('Selecciona un cliente para la orden.', 'error', 5000);
    return;
  }

  let targetOrderId = id;

  try {
    if (id) {
      const { error } = await client.from('orden').update(payload).eq('orden_id', id);
      if (error) throw error;
      showStatus('Orden actualizada correctamente.');
    } else {
      const { data, error } = await client.from('orden').insert(payload).select().single();
      if (error) throw error;
      targetOrderId = Number(firstAvailable(data, ['orden_id', 'id'])) || targetOrderId;
      showStatus('Orden creada correctamente.');
    }
    resetForm(form);
    await loadOrders();
    if (targetOrderId) {
      setSelectedOrder(targetOrderId);
    }
  } catch (error) {
    console.error('[settings] Error al guardar orden', error);
    showStatus(`No se pudo guardar la orden: ${error.message}`, 'error', 6500);
  }
}

async function saveOrderItem(event) {
  event.preventDefault();
  if (!client) return;
  if (!state.selectedOrderId) {
    showStatus('Selecciona una orden antes de agregar productos.', 'error', 5000);
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('orden_detalle_id')) || null;

  const payload = {
    orden_id: state.selectedOrderId,
    producto_id: Number(formData.get('producto_id')) || null,
    cantidad: Number(formData.get('cantidad')) || 0,
    precio_unitario: formData.get('precio_unitario') !== null && formData.get('precio_unitario') !== ''
      ? Number(formData.get('precio_unitario'))
      : null
  };

  if (!payload.producto_id) {
    showStatus('Selecciona un producto para la orden.', 'error', 5000);
    return;
  }

  if (!payload.cantidad) {
    showStatus('Indica la cantidad del producto.', 'error', 5000);
    return;
  }

  if (payload.precio_unitario === null || Number.isNaN(payload.precio_unitario)) {
    showStatus('Ingresa un precio unitario válido.', 'error', 5000);
    return;
  }

  try {
    if (id) {
      const { error } = await client.from('orden_detalle').update(payload).eq('orden_detalle_id', id);
      if (error) throw error;
      showStatus('Producto actualizado en la orden.');
    } else {
      const { error } = await client.from('orden_detalle').insert(payload);
      if (error) throw error;
      showStatus('Producto agregado a la orden.');
    }
    resetForm(form);
    await loadOrderItems();
    await loadOrders();
  } catch (error) {
    console.error('[settings] Error al guardar producto de la orden', error);
    showStatus(`No se pudo guardar el producto: ${error.message}`, 'error', 6500);
  }
}

async function saveUser(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('usuario_id')) || null;

  const payload = {
    nombre: nullableValue(formData.get('nombre')),
    email: nullableValue(formData.get('email')),
    telefono: nullableValue(formData.get('telefono')),
    rol_id: Number(formData.get('rol_id')) || null,
    estado: nullableValue(formData.get('estado')) || 'activo'
  };

  if (!payload.nombre || !payload.email) {
    showStatus('Completa nombre y correo electrónico.', 'error', 5000);
    return;
  }

  payload.email = payload.email.toLowerCase();

  const password = normalizeString(formData.get('password'));
  if (!id && !password) {
    showStatus('Ingresa una contraseña temporal para nuevos usuarios.', 'error', 5000);
    return;
  }

  if (password) {
    payload.password_hash = await hashPassword(password);
  }

  try {
    if (id) {
      const { error } = await client.from('usuario').update(payload).eq('usuario_id', id);
      if (error) throw error;
      showStatus('Usuario actualizado correctamente.');
    } else {
      const { error } = await client.from('usuario').insert(payload);
      if (error) throw error;
      showStatus('Usuario creado correctamente.');
    }
    resetForm(form);
    await loadUsers();
  } catch (error) {
    console.error('[settings] Error al guardar usuario', error);
    showStatus(`No se pudo guardar el usuario: ${error.message}`, 'error', 6500);
  }
}

async function saveRole(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('rol_id')) || null;

  const payload = {
    nombre: nullableValue(formData.get('nombre')),
    nivel: formData.get('nivel') ? Number(formData.get('nivel')) : null,
    descripcion: nullableValue(formData.get('descripcion'))
  };

  if (!payload.nombre) {
    showStatus('El nombre del rol es obligatorio.', 'error', 5000);
    return;
  }

  try {
    if (id) {
      const { error } = await client.from('rol').update(payload).eq('rol_id', id);
      if (error) throw error;
      showStatus('Rol actualizado correctamente.');
    } else {
      const { error } = await client.from('rol').insert(payload);
      if (error) throw error;
      showStatus('Rol creado correctamente.');
    }
    resetForm(form);
    await loadRoles();
  } catch (error) {
    console.error('[settings] Error al guardar rol', error);
    showStatus(`No se pudo guardar el rol: ${error.message}`, 'error', 6500);
  }
}

async function savePermission(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = Number(formData.get('permiso_id')) || null;

  const payload = {
    codigo: nullableValue(formData.get('codigo')),
    categoria: nullableValue(formData.get('categoria')),
    descripcion: nullableValue(formData.get('descripcion'))
  };

  if (!payload.codigo) {
    showStatus('El código del permiso es obligatorio.', 'error', 5000);
    return;
  }

  try {
    if (id) {
      const { error } = await client.from('permiso').update(payload).eq('permiso_id', id);
      if (error) throw error;
      showStatus('Permiso actualizado correctamente.');
    } else {
      const { error } = await client.from('permiso').insert(payload);
      if (error) throw error;
      showStatus('Permiso creado correctamente.');
    }
    resetForm(form);
    await loadPermissions();
  } catch (error) {
    console.error('[settings] Error al guardar permiso', error);
    showStatus(`No se pudo guardar el permiso: ${error.message}`, 'error', 6500);
  }
}

async function saveRolePermission(event) {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const rolId = Number(formData.get('rol_id'));
  const permisoId = Number(formData.get('permiso_id'));
  if (!rolId || !permisoId) {
    showStatus('Selecciona un rol y un permiso para continuar.', 'error', 4000);
    return;
  }

  const exists = state.rolePermissions.some(link => {
    const rId = Number(firstAvailable(link, ['rol_id', 'role_id']));
    const pId = Number(firstAvailable(link, ['permiso_id', 'permission_id']));
    return rId === rolId && pId === permisoId;
  });

  if (exists) {
    showStatus('Ese permiso ya está asignado al rol.', 'info', 3200);
    return;
  }

  try {
    const { error } = await client.from('rol_permiso').insert({ rol_id: rolId, permiso_id: permisoId });
    if (error) throw error;
    showStatus('Permiso asignado correctamente.');
    resetForm(form);
    await loadRolePermissions();
  } catch (error) {
    console.error('[settings] Error al asignar permiso', error);
    showStatus(`No se pudo asignar el permiso: ${error.message}`, 'error', 6500);
  }
}

function handleAuditFilter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  state.auditFilters.entidad = normalizeString(form.entidad?.value);
  state.auditFilters.usuario = normalizeString(form.usuario?.value);
  state.audit = applyAuditFilters(sortAudit(state.auditRaw));
  renderAudit();
}

function resetForm(form) {
  if (!form) return;
  form.reset();
  const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
  hiddenInputs.forEach(input => {
    input.value = '';
  });
  if (form.id === 'userForm') {
    const estadoField = form.querySelector('[name="estado"]');
    if (estadoField) {
      estadoField.value = 'activo';
    }
  }
  if (form.id === 'orderForm') {
    const estadoField = form.querySelector('[name="estado"]');
    if (estadoField) {
      estadoField.value = 'pendiente';
    }
  }
}

async function initialize() {
  if (!settingsWrapper) {
    console.warn(
      '[settings] No se encontró el bloque Supabase en admin.html. Mantén el marcado con id="settingsWrapper" para activar la configuración conectada.'
    );

    const settingsSection = document.querySelector('#section-settings .section-card');
    if (settingsSection && !settingsSection.querySelector('[data-missing-supabase]')) {
      const notice = document.createElement('div');
      notice.dataset.missingSupabase = 'true';
      notice.className = 'settings-status error';
      notice.textContent =
        'Falta el bloque de configuración Supabase en esta página. Copia nuevamente la sección con id="settingsWrapper" desde admin.html para recuperar el panel.';
      settingsSection.insertBefore(notice, settingsSection.firstChild);
    }

    return;
  }

  const config = window.APP_CONFIG || {};
  if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) {
    setPlaceholderVisible(true);
    showStatus('Configura tu URL y anon key de Supabase en Js/config.js para activar este módulo.', 'error', 0);
    return;
  }

  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });

  setPlaceholderVisible(false);
  settingsWrapper.hidden = false;

  attachTableActions();

  document.getElementById('userForm')?.addEventListener('submit', saveUser);
  document.getElementById('roleForm')?.addEventListener('submit', saveRole);
  document.getElementById('permissionForm')?.addEventListener('submit', savePermission);
  document.getElementById('rolePermissionForm')?.addEventListener('submit', saveRolePermission);
  document.getElementById('auditFilterForm')?.addEventListener('submit', handleAuditFilter);
  document.getElementById('clientForm')?.addEventListener('submit', saveClient);
  document.getElementById('supplierForm')?.addEventListener('submit', saveSupplier);
  document.getElementById('orderForm')?.addEventListener('submit', saveOrder);
  document.getElementById('orderItemForm')?.addEventListener('submit', saveOrderItem);

  document.getElementById('userReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('userForm'));
    hideStatus();
  });
  document.getElementById('roleReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('roleForm'));
    hideStatus();
  });
  document.getElementById('permissionReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('permissionForm'));
    hideStatus();
  });
  document.getElementById('clientReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('clientForm'));
    hideStatus();
  });
  document.getElementById('supplierReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('supplierForm'));
    hideStatus();
  });
  document.getElementById('orderReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('orderForm'));
    hideStatus();
  });
  document.getElementById('orderItemReset')?.addEventListener('click', () => {
    resetForm(document.getElementById('orderItemForm'));
    hideStatus();
  });
  document.getElementById('auditReset')?.addEventListener('click', async () => {
    resetForm(document.getElementById('auditFilterForm'));
    state.auditFilters = { entidad: '', usuario: '' };
    await loadAudit();
  });

  await Promise.all([loadRoles(), loadPermissions()]);
  await Promise.all([loadUsers(), loadRolePermissions(), loadAudit()]);
  await Promise.all([loadClients(), loadSuppliers(), loadProducts()]);
  await loadOrders();
  showStatus('Panel de configuración conectado correctamente.', 'info', 3200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

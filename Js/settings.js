/**
 * Panel de configuración conectado a la API interna (MySQL).
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

const API_ENDPOINT = 'api/settings.php';

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
  }
};

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, value);
  });
  const query = searchParams.toString();
  return query ? `&${query}` : '';
}

async function apiRequest(entity, { method = 'GET', query = {}, body = null } = {}) {
  const url = `${API_ENDPOINT}?entity=${encodeURIComponent(entity)}${buildQuery(query)}`;
  const options = {
    method,
    headers: {
      Accept: 'application/json'
    }
  };

  if (body !== null && body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { error: text || 'Respuesta no válida del servidor.' };
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

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
  const rpContainer = document.getElementById('rolePermissionList');

  usersTbody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;
    const numericId = Number(id);

    if (button.dataset.action === 'edit') {
      const user = state.users.find(item => {
        const value = firstAvailable(item, ['usuario_id', 'id']);
        return value !== undefined && value !== null && String(value) === String(id);
      });
      if (!user) return;
      const form = document.getElementById('userForm');
      if (!form) return;
      form.usuario_id.value = user.usuario_id ?? user.id ?? numericId ?? '';
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
        await apiRequest('users', { method: 'DELETE', query: { id } });
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
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;
    const numericId = Number(id);

    if (button.dataset.action === 'edit') {
      const role = state.roles.find(item => {
        const value = firstAvailable(item, ['rol_id', 'id']);
        return value !== undefined && value !== null && String(value) === String(id);
      });
      if (!role) return;
      const form = document.getElementById('roleForm');
      if (!form) return;
      form.rol_id.value = role.rol_id ?? role.id ?? numericId ?? '';
      form.nombre.value = role.nombre ?? role.name ?? '';
      form.nivel.value = firstAvailable(role, ['nivel', 'priority']) ?? '';
      form.descripcion.value = firstAvailable(role, ['descripcion', 'description']) ?? '';
      showStatus('Editando rol seleccionado.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este rol? También se eliminarán sus asignaciones.')) return;
      try {
        await apiRequest('roles', { method: 'DELETE', query: { id } });
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
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;
    const numericId = Number(id);

    if (button.dataset.action === 'edit') {
      const permission = state.permissions.find(item => {
        const value = firstAvailable(item, ['permiso_id', 'id']);
        return value !== undefined && value !== null && String(value) === String(id);
      });
      if (!permission) return;
      const form = document.getElementById('permissionForm');
      if (!form) return;
      form.permiso_id.value = permission.permiso_id ?? permission.id ?? numericId ?? '';
      form.codigo.value = firstAvailable(permission, ['codigo', 'code', 'nombre']) ?? '';
      form.categoria.value = firstAvailable(permission, ['categoria', 'category']) ?? '';
      form.descripcion.value = firstAvailable(permission, ['descripcion', 'description']) ?? '';
      showStatus('Editando permiso seleccionado.', 'info', 3200);
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('¿Eliminar este permiso? Se quitará de todos los roles.')) return;
      try {
        await apiRequest('permissions', { method: 'DELETE', query: { id } });
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
    if (!button) return;
    const rolId = button.dataset.role;
    const permisoId = button.dataset.permission;
    if (!rolId || !permisoId) return;

    try {
      await apiRequest('role-permissions', {
        method: 'DELETE',
        query: { rol_id: rolId, permiso_id: permisoId }
      });
      showStatus('Permiso retirado del rol.');
      await loadRolePermissions();
    } catch (error) {
      console.error('[settings] Error al quitar permiso del rol', error);
      showStatus(`No se pudo quitar el permiso: ${error.message}`, 'error', 6500);
    }
  });
}

async function loadUsers() {
  try {
    const response = await apiRequest('users');
    state.users = Array.isArray(response.data) ? response.data : [];
    renderUsers();
    return true;
  } catch (error) {
    console.error('[settings] Error al cargar usuarios', error);
    showStatus(`Error al cargar usuarios: ${error.message}`, 'error', 6500);
    return false;
  }
}

async function loadRoles() {
  try {
    const response = await apiRequest('roles');
    state.roles = Array.isArray(response.data) ? response.data : [];
    renderRoles();
    return true;
  } catch (error) {
    console.error('[settings] Error al cargar roles', error);
    showStatus(`Error al cargar roles: ${error.message}`, 'error', 6500);
    return false;
  }
}

async function loadPermissions() {
  try {
    const response = await apiRequest('permissions');
    state.permissions = Array.isArray(response.data) ? response.data : [];
    renderPermissions();
    return true;
  } catch (error) {
    console.error('[settings] Error al cargar permisos', error);
    showStatus(`Error al cargar permisos: ${error.message}`, 'error', 6500);
    return false;
  }
}

async function loadRolePermissions() {
  try {
    const response = await apiRequest('role-permissions');
    state.rolePermissions = Array.isArray(response.data) ? response.data : [];
    renderRolePermissions();
    return true;
  } catch (error) {
    console.error('[settings] Error al cargar asignaciones', error);
    showStatus(`Error al cargar asignaciones: ${error.message}`, 'error', 6500);
    return false;
  }
}

async function loadAudit() {
  try {
    const response = await apiRequest('audit');
    const rows = Array.isArray(response.data) ? response.data : [];
    const sorted = sortAudit(rows);
    state.auditRaw = sorted;
    state.audit = applyAuditFilters(sorted);
    renderAudit();
    return true;
  } catch (error) {
    console.error('[settings] Error al cargar auditoría', error);
    showStatus(`Error al cargar auditoría: ${error.message}`, 'error', 6500);
    return false;
  }
}

async function saveUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const idValue = formData.get('usuario_id');
  const id = idValue ? Number(idValue) || String(idValue) : null;

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
      await apiRequest('users', {
        method: 'PUT',
        query: { id },
        body: payload
      });
      showStatus('Usuario actualizado correctamente.');
    } else {
      await apiRequest('users', {
        method: 'POST',
        body: payload
      });
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
  const form = event.currentTarget;
  const formData = new FormData(form);
  const idValue = formData.get('rol_id');
  const id = idValue ? Number(idValue) || String(idValue) : null;

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
      await apiRequest('roles', {
        method: 'PUT',
        query: { id },
        body: payload
      });
      showStatus('Rol actualizado correctamente.');
    } else {
      await apiRequest('roles', {
        method: 'POST',
        body: payload
      });
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
  const form = event.currentTarget;
  const formData = new FormData(form);
  const idValue = formData.get('permiso_id');
  const id = idValue ? Number(idValue) || String(idValue) : null;

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
      await apiRequest('permissions', {
        method: 'PUT',
        query: { id },
        body: payload
      });
      showStatus('Permiso actualizado correctamente.');
    } else {
      await apiRequest('permissions', {
        method: 'POST',
        body: payload
      });
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
    await apiRequest('role-permissions', {
      method: 'POST',
      body: { rol_id: rolId, permiso_id: permisoId }
    });
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
}

async function initialize() {
  if (!settingsWrapper) return;

  attachTableActions();

  document.getElementById('userForm')?.addEventListener('submit', saveUser);
  document.getElementById('roleForm')?.addEventListener('submit', saveRole);
  document.getElementById('permissionForm')?.addEventListener('submit', savePermission);
  document.getElementById('rolePermissionForm')?.addEventListener('submit', saveRolePermission);
  document.getElementById('auditFilterForm')?.addEventListener('submit', handleAuditFilter);

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
  document.getElementById('auditReset')?.addEventListener('click', async () => {
    resetForm(document.getElementById('auditFilterForm'));
    state.auditFilters = { entidad: '', usuario: '' };
    await loadAudit();
  });

  setPlaceholderVisible(false);
  settingsWrapper.hidden = false;

  showStatus('Sincronizando datos de configuración...', 'info', 2400);

  const firstBatch = await Promise.all([loadRoles(), loadPermissions()]);
  const secondBatch = await Promise.all([loadUsers(), loadRolePermissions(), loadAudit()]);

  const batches = [...firstBatch, ...secondBatch];
  const allOk = batches.every(result => result !== false);

  if (allOk) {
    showStatus('Panel de configuración conectado correctamente.', 'info', 3200);
  } else {
    showStatus('Algunas secciones no pudieron cargarse. Revisa la conexión de tu API.', 'error', 0);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

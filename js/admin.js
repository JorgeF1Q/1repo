import { ensureAdminSeed, insert, remove, select, update } from './supabase.js';
import { hashPassword } from './security.js';

const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const email = localStorage.getItem('email');

if (!token || role !== 'admin') {
  const next = encodeURIComponent('admin.html');
  window.location.href = `login.html?next=${next}`;
}

document.getElementById('adminEmail').textContent = email || '';

document.getElementById('logoutBtn').addEventListener('click', () => {
  ['token', 'role', 'email', 'name', 'userId'].forEach((key) => localStorage.removeItem(key));
  window.location.href = 'index.html';
});

try {
  await ensureAdminSeed();
} catch (err) {
  console.warn('No se pudo garantizar el usuario admin:', err?.message || err);
}

/* =======================
   Productos
======================= */
const $tbody = document.querySelector('#tblProductos tbody');
const modalElement = document.getElementById('modalProducto');
const modalInstance = window.jQuery ? window.jQuery(modalElement) : null;
const $frm = document.getElementById('frmProducto');
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

function normalizeProduct(row) {
  if (!row) return null;
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
  };
}

function productToPayload(product) {
  return {
    codigo: product.Codigo || null,
    nombre: product.Nombre,
    precio: Number(product.Precio) || 0,
    stock: Number(product.Stock) || 0,
    activo: Boolean(Number(product.Activo ?? 1)),
    categoria: product.Categoria || null,
    material: product.Material || null,
    imagen_url: product.ImagenUrl || null,
  };
}

function rowHTML(p) {
  return `
    <tr data-id="${p.Id}">
      <td>${p.Id ?? ''}</td>
      <td>${p.Codigo ?? ''}</td>
      <td>${p.Nombre ?? ''}</td>
      <td>${money.format(p.Precio || 0)}</td>
      <td>${p.Stock ?? 0}</td>
      <td>${Number(p.Activo) ? 'Sí' : 'No'}</td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline-secondary btn-edit">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-del">Borrar</button>
      </td>
    </tr>
  `;
}

async function loadProductos() {
  const list = await select('producto', '*', { order: 'id.desc' }).catch(() => select('producto', '*'));
  const normalized = list.map(normalizeProduct).filter(Boolean);
  $tbody.innerHTML = normalized.map(rowHTML).join('');
}

await loadProductos();

document.querySelector('[data-target="#modalProducto"]').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Nuevo producto';
  $frm.reset();
  document.getElementById('p_id').value = '';
});

$frm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('p_id').value.trim();

  const payload = {
    Codigo: document.getElementById('p_codigo').value.trim(),
    Nombre: document.getElementById('p_nombre').value.trim(),
    Precio: Number(document.getElementById('p_precio').value || 0),
    Stock: Number(document.getElementById('p_stock').value || 0),
    Activo: Number(document.getElementById('p_activo').value || 1),
    Categoria: document.getElementById('p_categoria').value.trim(),
    Material: document.getElementById('p_material').value.trim(),
    ImagenUrl: document.getElementById('p_imagen').value.trim(),
  };

  try {
    if (id) {
      await update('producto', productToPayload(payload), { id: `eq.${id}` });
    } else {
      await insert('producto', productToPayload(payload));
    }
    modalInstance?.modal('hide');
    await loadProductos();
  } catch (err) {
    alert(err.message || 'No se pudo guardar el producto');
  }
});

$tbody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.getAttribute('data-id');

  if (e.target.classList.contains('btn-edit')) {
    try {
      const [product] = await select('producto', '*', { filter: { id: `eq.${id}` } });
      const p = normalizeProduct(product);
      if (!p) throw new Error('Producto no encontrado');

      document.getElementById('modalTitle').textContent = 'Editar producto';
      document.getElementById('p_id').value = p.Id ?? '';
      document.getElementById('p_codigo').value = p.Codigo || '';
      document.getElementById('p_nombre').value = p.Nombre || '';
      document.getElementById('p_precio').value = p.Precio || 0;
      document.getElementById('p_stock').value = p.Stock || 0;
      document.getElementById('p_activo').value = Number(p.Activo ? 1 : 0);
      document.getElementById('p_categoria').value = p.Categoria || '';
      document.getElementById('p_material').value = p.Material || '';
      document.getElementById('p_imagen').value = p.ImagenUrl || '';

      modalInstance?.modal('show');
    } catch (err) {
      alert(err.message || 'Error cargando producto');
    }
  }

  if (e.target.classList.contains('btn-del')) {
    if (!confirm('¿Borrar este producto?')) return;
    try {
      await remove('producto', { id: `eq.${id}` });
      await loadProductos();
    } catch (err) {
      alert(err.message || 'No se pudo eliminar');
    }
  }
});

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imgPreview = document.getElementById('imgPreview');

function openFilePicker() {
  fileInput.click();
}

dropZone.addEventListener('click', openFilePicker);
['dragenter', 'dragover'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
  })
);

dropZone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files && files[0]) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    imgPreview.src = reader.result;
    imgPreview.classList.remove('d-none');
  };
  reader.readAsDataURL(file);
  alert('Sube la imagen a tu almacenamiento preferido y pega la URL en el campo "Imagen (URL)".');
}

/* =======================
   Configuración: roles, permisos y usuarios
======================= */
const roleForm = document.getElementById('roleForm');
const roleNameInput = document.getElementById('roleName');
const rolesList = document.getElementById('rolesList');

const permissionForm = document.getElementById('permissionForm');
const permissionNameInput = document.getElementById('permissionName');
const permissionsList = document.getElementById('permissionsList');

const rolePermissionForm = document.getElementById('rolePermissionForm');
const roleSelect = document.getElementById('roleSelect');
const permissionSelect = document.getElementById('permissionSelect');
const rolePermissionsList = document.getElementById('rolePermissionsList');

const userForm = document.getElementById('userForm');
const userNameInput = document.getElementById('userName');
const userEmailInput = document.getElementById('userEmail');
const userPasswordInput = document.getElementById('userPassword');
const userRoleSelect = document.getElementById('userRole');
const userStatusSelect = document.getElementById('userStatus');
const usersTableBody = document.querySelector('#usersTable tbody');

let roles = [];
let permissions = [];
let rolePermissions = [];
let users = [];

async function loadRoles() {
  roles = await select('rol', '*', { order: 'rol_id.asc' });
  renderRoles();
  fillRoleSelects();
}

function renderRoles() {
  rolesList.innerHTML = roles
    .map((r) => `<li data-id="${r.rol_id}"><span>${r.nombre}</span><button class="btn btn-link btn-sm text-danger" data-action="delete-role">Eliminar</button></li>`)
    .join('');
}

function fillRoleSelects() {
  const options = roles.map((r) => `<option value="${r.rol_id}">${r.nombre}</option>`).join('');
  roleSelect.innerHTML = `<option value="">Selecciona rol</option>${options}`;
  userRoleSelect.innerHTML = `<option value="">Selecciona rol</option>${options}`;
}

roleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = roleNameInput.value.trim();
  if (!name) return;
  try {
    await insert('rol', { nombre: name });
    roleNameInput.value = '';
    await loadRoles();
  } catch (err) {
    alert(err.message || 'No se pudo crear el rol');
  }
});

rolesList.addEventListener('click', async (e) => {
  if (e.target.dataset.action !== 'delete-role') return;
  const li = e.target.closest('li');
  const id = li?.dataset.id;
  if (!id) return;
  if (!confirm('¿Eliminar este rol?')) return;
  try {
    await remove('rol', { rol_id: `eq.${id}` });
    await loadRoles();
    await loadRolePermissions();
  } catch (err) {
    alert(err.message || 'No se pudo eliminar el rol');
  }
});

async function loadPermissions() {
  permissions = await select('permiso', '*', { order: 'permiso_id.asc' });
  renderPermissions();
  fillPermissionSelect();
}

function renderPermissions() {
  permissionsList.innerHTML = permissions
    .map((p) => `<li data-id="${p.permiso_id}"><span>${p.nombre}</span><button class="btn btn-link btn-sm text-danger" data-action="delete-permission">Eliminar</button></li>`)
    .join('');
}

function fillPermissionSelect() {
  const options = permissions.map((p) => `<option value="${p.permiso_id}">${p.nombre}</option>`).join('');
  permissionSelect.innerHTML = `<option value="">Selecciona permiso</option>${options}`;
}

permissionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = permissionNameInput.value.trim();
  if (!name) return;
  try {
    await insert('permiso', { nombre: name });
    permissionNameInput.value = '';
    await loadPermissions();
  } catch (err) {
    alert(err.message || 'No se pudo crear el permiso');
  }
});

permissionsList.addEventListener('click', async (e) => {
  if (e.target.dataset.action !== 'delete-permission') return;
  const li = e.target.closest('li');
  const id = li?.dataset.id;
  if (!id) return;
  if (!confirm('¿Eliminar este permiso?')) return;
  try {
    await remove('permiso', { permiso_id: `eq.${id}` });
    await loadPermissions();
    await loadRolePermissions();
  } catch (err) {
    alert(err.message || 'No se pudo eliminar el permiso');
  }
});

async function loadRolePermissions() {
  rolePermissions = await select('rol_permiso', 'id,rol_id,permiso_id,rol:rol_id(nombre),permiso:permiso_id(nombre)', {
    order: 'id.asc',
  });
  renderRolePermissions();
}

function renderRolePermissions() {
  rolePermissionsList.innerHTML = rolePermissions
    .map((rp) => `
      <li data-id="${rp.id}">
        <span>${rp.rol?.nombre || `Rol #${rp.rol_id}`} → ${rp.permiso?.nombre || `Permiso #${rp.permiso_id}`}</span>
        <button class="btn btn-link btn-sm text-danger" data-action="delete-role-permission">Quitar</button>
      </li>
    `)
    .join('');
}

rolePermissionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rolId = roleSelect.value;
  const permisoId = permissionSelect.value;
  if (!rolId || !permisoId) {
    alert('Selecciona un rol y un permiso');
    return;
  }
  try {
    const existing = await select('rol_permiso', '*', { filter: { rol_id: `eq.${rolId}`, permiso_id: `eq.${permisoId}` }, single: true });
    if (existing) {
      alert('El rol ya tiene este permiso');
      return;
    }
    await insert('rol_permiso', { rol_id: Number(rolId), permiso_id: Number(permisoId) });
    rolePermissionForm.reset();
    await loadRolePermissions();
  } catch (err) {
    alert(err.message || 'No se pudo asignar el permiso');
  }
});

rolePermissionsList.addEventListener('click', async (e) => {
  if (e.target.dataset.action !== 'delete-role-permission') return;
  const li = e.target.closest('li');
  const id = li?.dataset.id;
  if (!id) return;
  if (!confirm('¿Quitar este permiso del rol?')) return;
  try {
    await remove('rol_permiso', { id: `eq.${id}` });
    await loadRolePermissions();
  } catch (err) {
    alert(err.message || 'No se pudo quitar el permiso');
  }
});

async function loadUsers() {
  users = await select('usuario', 'usuario_id,nombre,email,rol_id,estado,rol:rol_id(nombre)', { order: 'usuario_id.asc' });
  renderUsers();
}

function renderUsers() {
  usersTableBody.innerHTML = users
    .map((u) => `
      <tr data-id="${u.usuario_id}">
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td>${u.rol?.nombre || `Rol #${u.rol_id || ''}`}</td>
        <td><span class="badge ${String(u.estado).toLowerCase() === 'activo' ? 'badge-success' : 'badge-secondary'}">${u.estado}</span></td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline-secondary" data-action="toggle-status">${String(u.estado).toLowerCase() === 'activo' ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-user">Eliminar</button>
        </td>
      </tr>
    `)
    .join('');
}

userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = userNameInput.value.trim();
  const emailValue = userEmailInput.value.trim();
  const password = userPasswordInput.value;
  const rolId = userRoleSelect.value;
  const estado = userStatusSelect.value;

  if (!nombre || !emailValue || !password || !rolId) {
    alert('Completa todos los campos obligatorios');
    return;
  }

  try {
    const hash = hashPassword(password);
    await insert('usuario', {
      nombre,
      email: emailValue,
      password_hash: hash,
      rol_id: Number(rolId),
      estado,
    });
    userForm.reset();
    await loadUsers();
  } catch (err) {
    alert(err.message || 'No se pudo crear el usuario');
  }
});

usersTableBody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;
  const action = e.target.dataset.action;
  if (!id || !action) return;

  if (action === 'delete-user') {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await remove('usuario', { usuario_id: `eq.${id}` });
      await loadUsers();
    } catch (err) {
      alert(err.message || 'No se pudo eliminar');
    }
  }

  if (action === 'toggle-status') {
    const user = users.find((u) => String(u.usuario_id) === String(id));
    if (!user) return;
    const nextStatus = String(user.estado).toLowerCase() === 'activo' ? 'inactivo' : 'activo';
    try {
      await update('usuario', { estado: nextStatus }, { usuario_id: `eq.${id}` });
      await loadUsers();
    } catch (err) {
      alert(err.message || 'No se pudo cambiar el estado');
    }
  }
});

await Promise.all([loadRoles(), loadPermissions(), loadRolePermissions(), loadUsers()]);

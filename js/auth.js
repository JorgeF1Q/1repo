import { ensureAdminSeed, insert, select } from './supabase.js';
import { hashPassword, verifyPassword } from './security.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);

// ---------- toggle login/registro ----------
const loginForm = $('#loginForm');
const registerCard = $('#registerCard');
const registerForm = $('#registerForm');
const goRegister = $('#goRegister');

goRegister?.addEventListener('click', (e) => {
  e.preventDefault();
  registerCard.classList.toggle('d-none');
  registerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function saveSession({ user, roleName }) {
  const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  const token = hasCrypto ? crypto.randomUUID() : `session_${Date.now()}`;
  localStorage.setItem('token', token);
  localStorage.setItem('role', roleName);
  localStorage.setItem('name', user.nombre || '');
  localStorage.setItem('email', user.email || '');
  localStorage.setItem('userId', user.usuario_id ?? '');
}

function handleRedirectByRole(role) {
  if (role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'index.html';
  }
}

function showError(msg) {
  alert(msg || 'Error inesperado');
}

async function fetchRoleName(rolId) {
  if (!rolId) return '';
  const role = await select('rol', 'rol_id,nombre', { filter: { rol_id: `eq.${rolId}` }, single: true });
  return role?.nombre || '';
}

async function ensureDefaultClienteRole() {
  const role = await select('rol', 'rol_id,nombre', { filter: { nombre: 'eq.Cliente' }, single: true });
  if (role) return role.rol_id;
  const [created] = await insert('rol', { nombre: 'Cliente' });
  return created?.rol_id;
}

async function seedAdmin() {
  try {
    await ensureAdminSeed();
  } catch (err) {
    console.warn('No se pudo garantizar el usuario admin:', err.message);
  }
}

seedAdmin();

// ---------- LOGIN ----------
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;

  if (!email || !password) {
    return showError('Ingresa correo y contraseña.');
  }

  try {
    const users = await select('usuario', '*', { filter: { email: `eq.${email}` } });
    const user = users?.[0];
    if (!user) {
      return showError('Credenciales inválidas');
    }

    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      return showError('Credenciales inválidas');
    }

    const roleNameRaw = await fetchRoleName(user.rol_id);
    const roleName = roleNameRaw?.toLowerCase?.() || '';

    if (roleName !== 'admin' && user.estado && user.estado.toLowerCase() !== 'activo') {
      return showError('Tu usuario está inactivo.');
    }

    saveSession({ user, roleName });
    handleRedirectByRole(roleName);
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
});

// ---------- REGISTRO ----------
registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = $('#r_name').value.trim();
  const email = $('#r_email').value.trim();
  const password = $('#r_pass').value;

  if (!nombre || !email || !password) {
    return showError('Completa todos los campos.');
  }

  try {
    const hash = hashPassword(password);
    const rolId = await ensureDefaultClienteRole();
    if (!rolId) {
      throw new Error('No se encontró el rol de cliente');
    }

    const [user] = await insert('usuario', {
      nombre,
      email,
      password_hash: hash,
      rol_id: rolId,
      estado: 'activo',
    });

    const roleName = await fetchRoleName(user.rol_id);

    saveSession({ user, roleName: roleName.toLowerCase?.() || '' });
    handleRedirectByRole(roleName?.toLowerCase?.() || '');
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
});

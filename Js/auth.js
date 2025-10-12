// Js/auth.js
const API_BASE = 'https://joyeria-full-stack-production.up.railway.app';
const $ = (s, ctx=document) => ctx.querySelector(s);

function normalizeRoleValue(rawRole) {
  if (rawRole === null || rawRole === undefined) return '';

  const numericRole = Number(rawRole);
  if (!Number.isNaN(numericRole) && Number.isFinite(numericRole)) {
    if (numericRole === 1) return 'admin';
    if (numericRole === 2) return 'vendedor';
  }

  const text = rawRole.toString().trim().toLowerCase();
  if (!text) return '';

  if (['1', 'admin', 'administrator', 'administrador'].includes(text)) {
    return 'admin';
  }
  if (['2', 'vendedor', 'seller', 'ventas', 'salesperson', 'sales'].includes(text)) {
    return 'vendedor';
  }
  return text;
}

function saveSession({ token, user }) {
  // ajústalo si tu backend usa mayúsculas distintas
  const rawRole = user.role ?? user.Role ?? user.rol ?? user.Rol ?? user.perfil ?? user.role_id ?? user.RoleId;
  const normalizedRole = normalizeRoleValue(rawRole);
  localStorage.setItem('token', token);
  localStorage.setItem('role',  normalizedRole);
  if (rawRole !== null && rawRole !== undefined) {
    localStorage.setItem('role_raw', rawRole);
  }
  localStorage.setItem('name',  user.nombre || user.name || '');
  localStorage.setItem('email', user.email  || '');
}

function redirectByRole(role) {
  const normalized = normalizeRoleValue(role);
  if (normalized === 'admin') {
    window.location.href = 'admin.html';
  } else if (normalized === 'vendedor' || normalized === 'seller') {
    window.location.href = 'admin.html#sales';
  } else {
    window.location.href = 'index.html';
  }
}

function showError(msg){ alert(msg || 'Error inesperado'); }

async function loginRailway(email, password){
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ Email: email, Password: password })
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Credenciales inválidas');
  }
  return data; // { ok:true, token, user:{ role:'admin', ... } }
}

document.getElementById('loginForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;

  try {
    const data = await loginRailway(email, password);
    saveSession({ token: data.token, user: data.user });
    redirectByRole(localStorage.getItem('role'));
  } catch (err) {
    showError(err.message);
  }
});

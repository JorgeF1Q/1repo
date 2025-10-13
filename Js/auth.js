// Js/auth.js
const LOGIN_ENDPOINT = '/api/login.php';
const $ = (s, ctx=document) => ctx.querySelector(s);

function normalizeRoleValue(rawRole) {
  if (rawRole === null || rawRole === undefined) return '';

  const numericRole = Number(rawRole);
  if (!Number.isNaN(numericRole) && Number.isFinite(numericRole)) {
    if (numericRole === 1 || numericRole === 4) return 'admin';
    if (numericRole === 2) return 'ventas';
  }

  const text = rawRole.toString().trim().toLowerCase();
  if (!text) return '';

  if (['1', '4', 'admin', 'administrator', 'administrador'].includes(text)) {
    return 'admin';
  }
  if (['2', 'ventas', 'vendedor', 'seller', 'sales', 'salesperson'].includes(text)) {
    return 'ventas';
  }
  return text;
}

function saveSession({ token, user }) {
  const rawRole = user.role ?? user.Role ?? user.rol ?? user.Rol ?? user.perfil ?? user.role_id ?? user.RoleId ?? user.roleId;
  const normalizedRole = normalizeRoleValue(rawRole);
  localStorage.setItem('token', token || '');
  localStorage.setItem('role', normalizedRole);
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
  } else if (normalized === 'ventas' || normalized === 'vendedor' || normalized === 'seller') {
    window.location.href = 'ventas.html';
  } else {
    window.location.href = 'index.html';
  }
}

function showError(msg){ alert(msg || 'Error inesperado'); }

async function loginLocal(email, password){
  const res = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Credenciales inválidas');
  }
  return data;
}

document.getElementById('loginForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;

  try {
    const data = await loginLocal(email, password);
    saveSession({ token: data.token, user: data.user });
    redirectByRole(localStorage.getItem('role'));
  } catch (err) {
    showError(err.message);
  }
});

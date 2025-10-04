// Js/auth.js
const API_BASE = 'https://joyeria-full-stack-production.up.railway.app';
const $ = (s, ctx=document) => ctx.querySelector(s);

function saveSession({ token, user }) {
  // ajústalo si tu backend usa mayúsculas distintas
  const role = user.role ?? user.Role ?? user.rol ?? user.Rol ?? user.perfil;
  localStorage.setItem('token', token);
  localStorage.setItem('role',  role);
  localStorage.setItem('name',  user.nombre || user.name || '');
  localStorage.setItem('email', user.email  || '');
}

function redirectByRole(role) {
  window.location.href = (role === 'admin') ? 'admin.html' : 'index.html';
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

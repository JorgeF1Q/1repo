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
let loadingPedidos  = false;

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

function pickValue(obj, keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    return value;
  }
  return undefined;
}

function displayValue(obj, keys, fallback = '—') {
  const value = pickValue(obj, keys);
  if (value === undefined) return fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return String(value);
}

function pedidoRowHTML(order) {
  const nombre     = displayValue(order, ['Nombre', 'CustomerName', 'Cliente', 'name']);
  const direccion  = displayValue(order, ['Direccion', 'Address', 'customerAddress']);
  const metodo     = displayValue(order, ['MetodoPago', 'Metodo', 'PaymentMethod', 'paymentMethod']);
  const referencia = displayValue(order, ['Referencia', 'ReferenciaPago', 'reference']);
  const cupon      = displayValue(order, ['CuponCodigo', 'CupomCodigo', 'Cupon', 'Coupon', 'CodigoCupon']);
  const estado     = displayValue(order, ['Estado', 'estado', 'Status', 'status']);
  const rawTotal   = pickValue(order, ['Total', 'total', 'Monto', 'amount', 'TotalPedido']);

  let total = '—';
  if (rawTotal !== undefined) {
    const numeric = Number(rawTotal);
    total = Number.isFinite(numeric) ? money.format(numeric) : String(rawTotal);
  }

  const id = order?.Id ?? order?.id ?? '';

  return `
    <tr data-id="${id}">
      <td>${nombre}</td>
      <td>${direccion}</td>
      <td>${metodo}</td>
      <td>${referencia}</td>
      <td>${cupon}</td>
      <td>${estado}</td>
      <td class="text-right">${total}</td>
    </tr>
  `;
}

async function loadPedidos() {
  if (!$ordersTbody || loadingPedidos) return;

  loadingPedidos = true;
  $ordersTbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center text-muted py-4">Cargando pedidos...</td>
    </tr>
  `;

  try {
    const data = await apiFetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const orders = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.results)
            ? data.results
            : [];

    if (!orders.length) {
      $ordersTbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-4">No hay pedidos registrados.</td>
        </tr>
      `;
      return;
    }

    $ordersTbody.innerHTML = orders.map(pedidoRowHTML).join('');
  } catch (err) {
    console.error(err);
    $ordersTbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger py-4">Error al cargar pedidos.</td>
      </tr>
    `;
  } finally {
    loadingPedidos = false;
  }
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

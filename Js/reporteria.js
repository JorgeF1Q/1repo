import { fetchJoyeriaData } from './joyeria-data.js';

let salesData = [];
let productCategories = [];
let topClients = [];
let recentOrders = [];
let lowStock = [];
let charts = {
  trend: null,
  categories: null,
  sales: null,
  inventory: null
};
let warnings = [];

const fmtCurrency = (n) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const fmtNumber = (n) => new Intl.NumberFormat('es-GT').format(Math.round(n || 0));

async function initialize() {
  try {
    await loadData();
    renderAll();
    setupTabs();
    setupButtons();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error('[reporteria] Error al cargar datos', error);
    showGlobalMessage('No se pudo sincronizar con Supabase. Revisa tu conexión.');
  }
}

document.addEventListener('DOMContentLoaded', initialize);

async function loadData() {
  const { computed, warnings: loadWarnings } = await fetchJoyeriaData();
  warnings = loadWarnings || [];
  salesData = computed.salesData || [];
  productCategories = computed.productCategories || [];
  topClients = computed.topClients || [];
  recentOrders = computed.recentOrders || [];
  lowStock = computed.lowStockProducts || [];
}

function renderAll() {
  renderMetrics();
  createTrend(getSelectedPeriod());
  createCategories();
  renderTopCategories();
  createSalesBars();
  createInventory();
  renderTopClients();
  renderOrders();
  renderAlerts();
}

function getSelectedPeriod() {
  return document.getElementById('periodSelect')?.value || '9m';
}

function renderMetrics() {
  const { totalSales, totalOrders, totalClients, avgOrderValue, salesGrowth, ordersGrowth } = calcMetrics();
  document.getElementById('metricTotalSales').textContent = fmtCurrency(totalSales);
  renderMetricGrowth(document.getElementById('metricSalesGrowth'), salesGrowth);
  document.getElementById('metricTotalOrders').textContent = fmtNumber(totalOrders);
  renderMetricGrowth(document.getElementById('metricOrdersGrowth'), ordersGrowth);
  document.getElementById('metricTotalClients').textContent = fmtNumber(totalClients);
  document.getElementById('metricAOV').textContent = fmtCurrency(avgOrderValue);
  document.getElementById('metricAOV2').textContent = fmtCurrency(avgOrderValue);
}

function calcMetrics() {
  if (!salesData.length) {
    return { totalSales: 0, totalOrders: 0, totalClients: 0, avgOrderValue: 0, salesGrowth: 0, ordersGrowth: 0 };
  }
  const totalSales = salesData.reduce((sum, item) => sum + (item.ventas || 0), 0);
  const totalOrders = salesData.reduce((sum, item) => sum + (item.ordenes || 0), 0);
  const totalClients = salesData.reduce((max, item) => Math.max(max, item.clientes || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const last = salesData[salesData.length - 1] || { ventas: 0, ordenes: 0 };
  const prev = salesData[salesData.length - 2] || last;
  const salesGrowth = prev.ventas ? ((last.ventas - prev.ventas) / prev.ventas) * 100 : 0;
  const ordersGrowth = prev.ordenes ? ((last.ordenes - prev.ordenes) / prev.ordenes) * 100 : 0;
  return { totalSales, totalOrders, totalClients, avgOrderValue, salesGrowth, ordersGrowth };
}

function renderMetricGrowth(element, value) {
  if (!element) return;
  element.innerHTML = '';
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', value >= 0 ? 'trending-up' : 'trending-down');
  icon.className = 'w-4 h-4';
  const span = document.createElement('span');
  span.className = 'ml-1';
  span.textContent = `${Math.abs(value).toFixed(1)}% vs mes anterior`;
  element.append(icon, span);
  element.className = `flex items-center mt-1 text-sm ${value >= 0 ? 'text-green-600' : 'text-red-600'}`;
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function buildTrendData(period) {
  const map = { '3m': 3, '6m': 6, '9m': 9, '12m': 12 };
  const n = map[period] || 9;
  const slice = salesData.slice(-n);
  return {
    labels: slice.map(x => x.month),
    datasets: [{
      label: 'Ventas ($)',
      data: slice.map(x => x.ventas || 0),
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3,
      backgroundColor: ctx => {
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(136, 132, 216, 0.35)');
        gradient.addColorStop(1, 'rgba(136, 132, 216, 0.05)');
        return gradient;
      },
      borderColor: '#8884d8'
    }]
  };
}

function createTrend(period) {
  const canvas = document.getElementById('chartTrend');
  if (!canvas) return;
  if (!salesData.length) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(canvas, {
    type: 'line',
    data: buildTrendData(period),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: { callbacks: { label: (item) => fmtCurrency(item.parsed.y) } },
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: true, drawBorder: false } },
        y: { grid: { display: true, drawBorder: false } }
      }
    }
  });
}

function createCategories() {
  const canvas = document.getElementById('chartCategories');
  if (!canvas) return;
  if (charts.categories) charts.categories.destroy();
  if (!productCategories.length) return;
  charts.categories = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: productCategories.map(c => `${c.name} (${(c.value || 0)}%)`),
      datasets: [{
        data: productCategories.map(c => c.value || 0),
        backgroundColor: productCategories.map(c => c.color || '#8884d8'),
        borderWidth: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function createSalesBars() {
  const canvas = document.getElementById('chartSalesBars');
  if (!canvas) return;
  if (charts.sales) charts.sales.destroy();
  if (!salesData.length) return;
  charts.sales = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: salesData.map(x => x.month),
      datasets: [
        { label: 'Ventas ($)', data: salesData.map(x => x.ventas || 0), backgroundColor: '#8884d8' },
        { label: 'Órdenes', data: salesData.map(x => x.ordenes || 0), backgroundColor: '#82ca9d' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: false }, y: { beginAtZero: true } }
    }
  });
}

function createInventory() {
  const canvas = document.getElementById('chartInventory');
  if (!canvas) return;
  if (charts.inventory) charts.inventory.destroy();
  if (!productCategories.length) return;
  const data = productCategories.slice(0, 4);
  charts.inventory = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(x => x.name),
      datasets: [{ label: 'Stock (unidades)', data: data.map(x => x.unidades || 0), backgroundColor: '#8884d8' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderTopCategories() {
  const container = document.getElementById('topCategories');
  if (!container) return;
  if (!productCategories.length) {
    container.innerHTML = '<div class="text-gray-500 text-sm">Sin información disponible.</div>';
    return;
  }
  container.innerHTML = productCategories.map(cat => `
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full mr-3" style="background:${cat.color || '#8884d8'}"></div>
          <span class="font-medium">${cat.name}</span>
        </div>
        <div class="text-right">
          <div class="font-semibold">${fmtCurrency(cat.ventas || 0)}</div>
          <div class="text-sm text-gray-500">${cat.value || 0}%</div>
        </div>
      </div>
    `).join('');
}

function renderTopClients() {
  const tbody = document.getElementById('tblTopClients');
  if (!tbody) return;
  if (!topClients.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-3 px-4 text-center text-gray-500">Sin clientes registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = topClients.map(client => `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 px-4">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">${(client.nombre || '?').charAt(0)}</div>
            ${client.nombre || 'Cliente'}
          </div>
        </td>
        <td class="py-3 px-4">${client.compras || 0}</td>
        <td class="py-3 px-4 font-semibold">${fmtCurrency(client.total || 0)}</td>
        <td class="py-3 px-4 text-gray-600">${client.ultimaCompra || ''}</td>
      </tr>
    `).join('');
}

function statusBadge(status) {
  const map = {
    'Completado': 'bg-green-100 text-green-800',
    'Procesando': 'bg-yellow-100 text-yellow-800',
    'Enviado': 'bg-blue-100 text-blue-800',
    'Cancelado': 'bg-red-100 text-red-800'
  };
  return `<span class="chip ${map[status] || 'bg-gray-100 text-gray-800'}">${status}</span>`;
}

function renderOrders() {
  const tbody = document.getElementById('tblOrders');
  if (!tbody) return;
  if (!recentOrders.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-3 px-4 text-center text-gray-500">No hay órdenes registradas.</td></tr>';
    return;
  }
  tbody.innerHTML = recentOrders.map(order => `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 px-4 font-mono text-sm">${order.id}</td>
        <td class="py-3 px-4">${order.cliente}</td>
        <td class="py-3 px-4">${order.producto}</td>
        <td class="py-3 px-4 font-semibold">${fmtCurrency(order.monto || 0)}</td>
        <td class="py-3 px-4">${statusBadge(order.estado || 'Pendiente')}</td>
        <td class="py-3 px-4 text-gray-600">${order.fecha || ''}</td>
      </tr>
    `).join('');
}

function renderAlerts() {
  const container = document.getElementById('alertsInventory');
  if (!container) return;
  const messages = [];
  if (warnings.length) {
    messages.push(`<div class="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">${warnings.join(' · ')}</div>`);
  }
  if (!lowStock.length) {
    messages.push('<div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">Inventario sin alertas críticas.</div>');
    container.innerHTML = messages.join('');
    return;
  }
  lowStock.slice(0, 3).forEach(item => {
    const levelClasses = item.level === 'low'
      ? ['bg-red-50 border-red-200 text-red-700', 'text-red-600']
      : item.level === 'medium'
        ? ['bg-yellow-50 border-yellow-200 text-yellow-700', 'text-yellow-600']
        : ['bg-green-50 border-green-200 text-green-700', 'text-green-600'];
    messages.push(`
      <div class="flex items-center justify-between p-3 ${levelClasses[0]} border rounded-lg">
        <span>${item.nombre}</span>
        <span class="font-semibold ${levelClasses[1]}">Stock: ${item.stock}</span>
      </div>
    `);
  });
  container.innerHTML = messages.join('');
}

function setupTabs() {
  const tabs = ['overview', 'sales', 'customers', 'products'];
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-tab');
      tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== key);
      });
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('bg-white', 'text-purple-600', 'shadow'));
      btn.classList.add('bg-white', 'text-purple-600', 'shadow');
      if (key === 'sales') createSalesBars();
      if (key === 'products') createInventory();
    });
  });
}

function setupButtons() {
  document.getElementById('periodSelect')?.addEventListener('change', (e) => {
    createTrend(e.target.value);
  });

  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    try {
      await loadData();
      renderAll();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    } catch (error) {
      console.error('[reporteria] Error al refrescar datos', error);
      showGlobalMessage('No fue posible actualizar la información.');
    }
  });

  document.getElementById('btnExport')?.addEventListener('click', () => {
    const canvas = document.querySelector('#chartTrend');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'ventas_tendencia.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function showGlobalMessage(message) {
  const container = document.getElementById('alertsInventory');
  if (container) {
    container.innerHTML = `<div class="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">${message}</div>`;
  }
}

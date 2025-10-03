import { fetchJoyeriaData } from './joyeria-data.js';

let rawData = [];
let allData = [];
let filteredData = [];
let charts = {};
let previousMetrics = {};
let warnings = [];
let filtersReady = false;
let datasetMetrics = {
    totalSales: 0,
    totalOrders: 0,
    totalClients: 0,
    avgOrderValue: 0,
    salesGrowth: 0,
    ordersGrowth: 0
};

async function initialize() {
    showInsightsMessage('Cargando datos desde Supabase...');
    try {
        await loadData();
        initializeFilters();
        attachActionButtons();
        updateDashboard();
    } catch (error) {
        console.error('[dashboard-financiero] Error al inicializar', error);
        showInsightsMessage(`No se pudo cargar la información: ${error.message}`);
    }
}

async function loadData() {
    const { computed, warnings: loadWarnings } = await fetchJoyeriaData();
    warnings = loadWarnings || [];
    rawData = Array.isArray(computed.records) ? computed.records : [];
    allData = [...rawData];
    filteredData = [...rawData];
    charts = {};
    datasetMetrics = {
        totalSales: computed.metrics?.totalSales || 0,
        totalOrders: computed.metrics?.totalOrders || 0,
        totalClients: computed.metrics?.totalClients || 0,
        avgOrderValue: computed.metrics?.avgOrderValue || 0,
        salesGrowth: computed.metrics?.salesGrowth || 0,
        ordersGrowth: computed.metrics?.ordersGrowth || 0
    };
    previousMetrics = {};
}

function attachActionButtons() {
    const resetBtn = document.getElementById('resetFiltersBtn');
    const exportBtn = document.getElementById('exportBtn');
    resetBtn?.addEventListener('click', resetFilters);
    exportBtn?.addEventListener('click', exportData);
}

function showInsightsMessage(message) {
    const container = document.getElementById('insightsContainer');
    if (!container) return;
    container.innerHTML = `<div class="loading">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', initialize);

        function formatCurrency(value) {
            return new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value || 0);
        }

        function formatNumber(value) {
            return new Intl.NumberFormat('es-ES').format(Math.round(value || 0));
        }

        function initializeFilters() {
            const filterIds = ['segmentFilter', 'countryFilter', 'productFilter', 'yearFilter', 'discountFilter', 'monthFilter'];
            populateSelect('segmentFilter', getUniqueValues(allData, 'segment'));
            populateSelect('countryFilter', getUniqueValues(allData, 'country'));
            populateSelect('productFilter', getUniqueValues(allData, 'product'));
            populateSelect('yearFilter', getUniqueValues(allData, 'year'));
            populateSelect('discountFilter', getUniqueValues(allData, 'discountBand'));
            populateSelect('monthFilter', getUniqueValues(allData, 'monthName'));

            if (!filtersReady) {
                filterIds.forEach(id => {
                    const element = document.getElementById(id);
                    element?.addEventListener('change', applyFilters);
                });
                filtersReady = true;
            }

            filterIds.forEach(id => {
                const element = document.getElementById(id);
                if (element && !Array.from(element.options).some(option => option.value === 'all')) {
                    const option = document.createElement('option');
                    option.value = 'all';
                    option.textContent = element.dataset.placeholder || 'Todos';
                    element.insertBefore(option, element.firstChild);
                }
                if (element) {
                    element.value = 'all';
                }
            });
        }

        function getUniqueValues(data, field) {
            return [...new Set(data.map(item => item[field]).filter(Boolean))].sort((a, b) => {
                if (typeof a === 'number' && typeof b === 'number') return a - b;
                return String(a).localeCompare(String(b));
            });
        }

        function populateSelect(selectId, options) {
            const select = document.getElementById(selectId);
            if (!select) return;
            while (select.options.length > 1) {
                select.remove(1);
            }
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
        }

        function applyFilters() {
            const filters = {
                segment: document.getElementById('segmentFilter')?.value || 'all',
                country: document.getElementById('countryFilter')?.value || 'all',
                product: document.getElementById('productFilter')?.value || 'all',
                year: document.getElementById('yearFilter')?.value || 'all',
                discountBand: document.getElementById('discountFilter')?.value || 'all',
                month: document.getElementById('monthFilter')?.value || 'all'
            };

            filteredData = allData.filter(row => (
                (filters.segment === 'all' || row.segment === filters.segment) &&
                (filters.country === 'all' || row.country === filters.country) &&
                (filters.product === 'all' || row.product === filters.product) &&
                (filters.year === 'all' || String(row.year) === filters.year) &&
                (filters.discountBand === 'all' || row.discountBand === filters.discountBand) &&
                (filters.month === 'all' || row.monthName === filters.month)
            ));

            updateDashboard();
        }

        function resetFilters() {
            ['segmentFilter', 'countryFilter', 'productFilter', 'yearFilter', 'discountFilter', 'monthFilter'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.value = 'all';
            });
            filteredData = [...allData];
            updateDashboard();
        }

        function updateDashboard() {
            updateKPIs();
            updateCharts();
            generateInsights();
            updateRecordCount();
        }

        function updateRecordCount() {
            document.getElementById('recordCount').textContent = filteredData.length;
        }

        function updateKPIs() {
            const totals = filteredData.reduce((acc, row) => {
                acc.sales += row.sales || 0;
                acc.profit += row.profit || 0;
                acc.units += row.unitsSold || 0;
                acc.discounts += row.discounts || 0;
                return acc;
            }, { sales: 0, profit: 0, units: 0, discounts: 0 });

            const profitMargin = totals.sales > 0 ? (totals.profit / totals.sales * 100) : 0;
            const avgSalePrice = totals.units > 0 ? (totals.sales / totals.units) : 0;

            document.getElementById('totalSales').textContent = formatCurrency(totals.sales);
            document.getElementById('totalProfit').textContent = formatCurrency(totals.profit);
            document.getElementById('profitMargin').textContent = profitMargin.toFixed(1) + '%';
            document.getElementById('totalUnits').textContent = formatNumber(totals.units);
            document.getElementById('avgSalePrice').textContent = formatCurrency(avgSalePrice);
            document.getElementById('totalDiscounts').textContent = formatCurrency(totals.discounts);

            updateKPIChanges({
                sales: totals.sales,
                profit: totals.profit,
                margin: profitMargin,
                units: totals.units,
                avgPrice: avgSalePrice,
                discounts: totals.discounts
            });
        }

        function updateKPIChanges(currentMetrics) {
            const config = [
                { key: 'sales', elementId: 'salesChange', isPercentage: false },
                { key: 'profit', elementId: 'profitChange', isPercentage: false },
                { key: 'margin', elementId: 'marginChange', isPercentage: true },
                { key: 'units', elementId: 'unitsChange', isPercentage: false },
                { key: 'avgPrice', elementId: 'priceChange', isPercentage: false },
                { key: 'discounts', elementId: 'discountChange', isPercentage: false }
            ];

            config.forEach(({ key, elementId, isPercentage }) => {
                const element = document.getElementById(elementId);
                const previous = previousMetrics[key];
                const current = currentMetrics[key];

                if (previous === undefined) {
                    element.textContent = '—';
                    element.className = 'kpi-change';
                    return;
                }

                const difference = current - previous;
                const base = isPercentage ? previous : previous !== 0 ? previous : null;
                const percentageChange = base ? (difference / base) * 100 : 0;
                const direction = difference >= 0 ? '↑' : '↓';
                const className = difference >= 0 ? 'kpi-change positive' : 'kpi-change negative';

                if (isPercentage) {
                    element.textContent = `${direction} ${difference.toFixed(1)} pts`;
                } else {
                    element.textContent = `${direction} ${formatNumber(Math.abs(difference))} (${percentageChange.toFixed(1)}%)`;
                }

                element.className = className;
            });

            previousMetrics = { ...currentMetrics };
        }

        function updateCharts() {
            const palette = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#43cea2', '#185a9d', '#ff9a9e', '#fad0c4', '#36d1dc', '#5b86e5'];

            const segmentAggregation = aggregateByKey(filteredData, 'segment');
            const segmentLabels = Object.keys(segmentAggregation);
            const segmentSales = segmentLabels.map(label => segmentAggregation[label].sales);
            renderChart('segmentChart', 'bar', {
                labels: segmentLabels,
                datasets: [{
                    label: 'Ventas',
                    data: segmentSales,
                    backgroundColor: segmentLabels.map((_, index) => palette[index % palette.length]),
                    borderRadius: 12
                }]
            }, {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } },
                    x: { ticks: { font: { size: 12 } } }
                }
            });

            const countryAggregation = aggregateByKey(filteredData, 'country');
            const countryLabels = Object.keys(countryAggregation);
            const countrySales = countryLabels.map(label => countryAggregation[label].sales);
            const countryProfit = countryLabels.map(label => countryAggregation[label].profit);
            renderChart('countryChart', 'bar', {
                labels: countryLabels,
                datasets: [
                    {
                        label: 'Ventas',
                        data: countrySales,
                        backgroundColor: 'rgba(102, 126, 234, 0.7)',
                        borderColor: '#667eea',
                        borderWidth: 1
                    },
                    {
                        label: 'Utilidad',
                        data: countryProfit,
                        backgroundColor: 'rgba(67, 206, 162, 0.7)',
                        borderColor: '#43cea2',
                        borderWidth: 1
                    }
                ]
            }, {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } },
                    x: { ticks: { font: { size: 12 } } }
                }
            });

            const productAggregation = aggregateByKey(filteredData, 'product');
            const productLabels = Object.keys(productAggregation);
            const productProfit = productLabels.map(label => productAggregation[label].profit);
            renderChart('productChart', 'doughnut', {
                labels: productLabels,
                datasets: [{
                    label: 'Utilidad',
                    data: productProfit,
                    backgroundColor: productLabels.map((_, index) => palette[index % palette.length]),
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            }, {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 18, padding: 15 }
                    }
                }
            });

            const monthlyAggregation = aggregateMonthly(filteredData);
            renderChart('monthlyChart', 'line', {
                labels: monthlyAggregation.labels,
                datasets: [{
                    label: 'Ventas',
                    data: monthlyAggregation.sales,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#667eea'
                }, {
                    label: 'Utilidad',
                    data: monthlyAggregation.profit,
                    borderColor: '#43cea2',
                    backgroundColor: 'rgba(67, 206, 162, 0.2)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#43cea2'
                }]
            }, {
                scales: {
                    y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } }
                }
            });

            const discountAggregation = aggregateByKey(filteredData, 'discountBand');
            const discountLabels = Object.keys(discountAggregation);
            const discountSales = discountLabels.map(label => discountAggregation[label].sales);
            const discountValue = discountLabels.map(label => discountAggregation[label].discounts);
            renderChart('discountChart', 'bar', {
                labels: discountLabels,
                datasets: [
                    {
                        label: 'Ventas',
                        data: discountSales,
                        backgroundColor: 'rgba(102, 126, 234, 0.7)',
                        borderColor: '#667eea',
                        borderWidth: 1
                    },
                    {
                        label: 'Descuentos',
                        data: discountValue,
                        backgroundColor: 'rgba(240, 147, 251, 0.7)',
                        borderColor: '#f093fb',
                        borderWidth: 1
                    }
                ]
            }, {
                scales: {
                    y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } }
                }
            });

            const profitability = segmentLabels.map(label => {
                const data = segmentAggregation[label];
                const margin = data.sales > 0 ? (data.profit / data.sales) * 100 : 0;
                return Number(margin.toFixed(1));
            });
            renderChart('profitabilityChart', 'bar', {
                labels: segmentLabels,
                datasets: [{
                    label: 'Margen %',
                    data: profitability,
                    backgroundColor: segmentLabels.map((_, index) => palette[(index + 2) % palette.length]),
                    borderRadius: 12
                }]
            }, {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: Math.min(100, Math.ceil(Math.max(...profitability, 10) / 10) * 10),
                        ticks: { callback: value => value + '%' }
                    }
                }
            });
        }

        function renderChart(elementId, type, data, options = {}) {
            const ctx = document.getElementById(elementId).getContext('2d');
            if (charts[elementId]) {
                charts[elementId].data = data;
                charts[elementId].options = { ...charts[elementId].options, ...options };
                charts[elementId].update();
            } else {
                charts[elementId] = new Chart(ctx, { type, data, options });
            }
        }

        function aggregateByKey(data, key) {
            return data.reduce((acc, row) => {
                const label = row[key] || 'No definido';
                if (!acc[label]) {
                    acc[label] = { sales: 0, profit: 0, discounts: 0, units: 0 };
                }
                acc[label].sales += row.sales || 0;
                acc[label].profit += row.profit || 0;
                acc[label].discounts += row.discounts || 0;
                acc[label].units += row.unitsSold || 0;
                return acc;
            }, {});
        }

        function aggregateMonthly(data) {
            const monthMap = {};
            data.forEach(row => {
                const key = `${row.year}-${String(row.monthNumber).padStart(2, '0')}`;
                if (!monthMap[key]) {
                    monthMap[key] = {
                        label: `${row.monthName} ${row.year}`,
                        sales: 0,
                        profit: 0
                    };
                }
                monthMap[key].sales += row.sales || 0;
                monthMap[key].profit += row.profit || 0;
            });

            const sortedKeys = Object.keys(monthMap).sort();
            return {
                labels: sortedKeys.map(key => monthMap[key].label),
                sales: sortedKeys.map(key => monthMap[key].sales),
                profit: sortedKeys.map(key => monthMap[key].profit)
            };
        }

        function generateInsights() {
            const container = document.getElementById('insightsContainer');
            container.innerHTML = '';

            if (warnings.length) {
                const warn = document.createElement('div');
                warn.className = 'insight-item';
                warn.innerHTML = `<strong>Advertencia:</strong> ${warnings.join(' · ')}`;
                container.appendChild(warn);
            }

            if (filteredData.length === 0) {
                container.innerHTML += '<div class="loading">No hay registros que coincidan con los filtros seleccionados.</div>';
                return;
            }

            const totalSales = filteredData.reduce((sum, row) => sum + (row.sales || 0), 0);
            const totalProfit = filteredData.reduce((sum, row) => sum + (row.profit || 0), 0);
            const segmentAggregation = aggregateByKey(filteredData, 'segment');
            const countryAggregation = aggregateByKey(filteredData, 'country');
            const productAggregation = aggregateByKey(filteredData, 'product');

            const topSegment = Object.entries(segmentAggregation).sort((a, b) => b[1].sales - a[1].sales)[0];
            const topCountry = Object.entries(countryAggregation).sort((a, b) => b[1].profit - a[1].profit)[0];
            const topMarginProduct = Object.entries(productAggregation).map(([product, values]) => ({
                product,
                margin: values.sales > 0 ? (values.profit / values.sales) * 100 : 0,
                profit: values.profit
            })).sort((a, b) => b.margin - a.margin)[0];

            const insights = [];

            if (topSegment) {
                const share = totalSales > 0 ? ((topSegment[1].sales / totalSales) * 100).toFixed(1) : '0.0';
                insights.push(`El segmento <strong>${topSegment[0]}</strong> concentra el ${share}% de las ventas filtradas, con ${formatCurrency(topSegment[1].sales)} generados.`);
            }

            if (topCountry) {
                const margin = topCountry[1].sales > 0 ? ((topCountry[1].profit / topCountry[1].sales) * 100).toFixed(1) : '0.0';
                insights.push(`El país con mayor utilidad es <strong>${topCountry[0]}</strong>, aportando ${formatCurrency(topCountry[1].profit)} y un margen del ${margin}%.`);
            }

            if (topMarginProduct) {
                insights.push(`El producto con la mejor rentabilidad es <strong>${topMarginProduct.product}</strong>, alcanzando un margen del ${topMarginProduct.margin.toFixed(1)}% y utilidades por ${formatCurrency(topMarginProduct.profit)}.`);
            }

            insights.forEach(text => {
                const item = document.createElement('div');
                item.className = 'insight-item';
                item.innerHTML = text;
                container.appendChild(item);
            });
        }

        function exportData() {
            if (!filteredData.length) {
                alert('No hay datos para exportar con los filtros actuales.');
                return;
            }

            const headers = ['Segmento', 'País', 'Producto', 'Banda de Descuento', 'Unidades Vendidas', 'Precio de Fabricación', 'Precio de Venta', 'Ventas Brutas', 'Descuentos', 'Ventas Netas', 'COGS', 'Utilidad', 'Fecha', 'Mes', 'Año'];
            const rows = filteredData.map(row => [
                row.segment,
                row.country,
                row.product,
                row.discountBand,
                row.unitsSold,
                row.manufacturingPrice,
                row.salePrice,
                row.grossSales,
                row.discounts,
                row.sales,
                row.cogs,

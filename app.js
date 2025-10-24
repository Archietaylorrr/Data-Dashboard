const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Global variables
let allData = [];
let filteredData = [];
let charts = {};
let appData = null;

// Columns to display (as specified by user)
const DISPLAY_COLUMNS = [
    'Sample ID', 'Date', 'Sample type', 'Traverse_new', 'Latitude', 'Longitude',
    'Elevation (m, 30m DEM)', 'T °C', 'pH', 'TDS', 'Alkalinity', 'Sr87/Sr86',
    'd88Sr', 'd7Li', 'd13C DIC', 'd17O', 'd18O', 'd2H', 'd-excess',
    'Na mmolar', 'K mmolar', 'Ca mmolar', 'Mg mmolar', 'Si mmolar',
    'Sr nmolar', 'Al nmolar', 'Ba nmolar', 'Fe nmolar', 'Mn nmolar',
    'Li nmolar', 'Cl mmolar', 'SO4 μmolar', 'S mmolar'
];

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    initializeNavigation();
    await loadData();
    setTimeout(() => {
        setupPlottingTool();
    }, 1000);
});

// Navigation between pages
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPage = item.getAttribute('data-page');
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show target page
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(`${targetPage}-page`).classList.add('active');
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterData(e.target.value);
        });
    }
    
    // Export functionality
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
}

// Load and parse Excel data from main process
async function loadData() {
    try {
        console.log('📊 app.js: Loading data...');
        const { ipcRenderer } = require('electron');
        
        // Get data from main process
        appData = await ipcRenderer.invoke('get-app-data');
        console.log('📦 app.js: Received appData:', appData ? 'YES' : 'NO');
        
        if (!appData || !appData.mainData) {
            showError('Failed to load data from main process');
            return;
        }
        
        const rawData = appData.mainData;
        
        // Process and filter data
        allData = rawData.map(row => {
            const filtered = {};
            DISPLAY_COLUMNS.forEach(col => {
                filtered[col] = row[col] !== undefined ? row[col] : '';
            });
            return filtered;
        });
        
        filteredData = [...allData];
        
        // Update status
        const matchCount = appData.matches ? appData.matches.length : 0;
        const runCount = appData.groupedByRun ? Object.keys(appData.groupedByRun).length : 0;
        console.log(`✅ app.js: ${allData.length} samples, ${runCount} runs, ${matchCount} matches`);
        
        document.querySelector('.data-status').textContent = 
            `${allData.length} samples | ${runCount} ICP-OES runs | ${matchCount} matches`;
        
        // Populate dashboard and table
        populateDashboard();
        populateDataTable(filteredData);
        
        console.log('✅ app.js: Data loaded and displayed');
        
    } catch (error) {
        console.error('❌ app.js: Error loading data:', error);
        showError(`Error loading data: ${error.message}`);
    }
}

// Populate dashboard with analytics
function populateDashboard() {
    if (allData.length === 0) return;
    
    // Calculate summary statistics
    const totalSamples = allData.length;
    const uniqueLocations = new Set(
        allData.map(row => `${row['Latitude']},${row['Longitude']}`).filter(loc => loc !== ',')
    ).size;
    const uniqueTraverses = new Set(
        allData.map(row => row['Traverse_new']).filter(t => t)
    ).size;
    
    // Date range
    const dates = allData.map(row => row['Date']).filter(d => d);
    const dateRange = dates.length > 0 
        ? `${Math.min(...dates.map(d => new Date(d).getFullYear()))} - ${Math.max(...dates.map(d => new Date(d).getFullYear()))}`
        : 'N/A';
    
    // Update cards
    document.getElementById('total-samples').textContent = totalSamples.toLocaleString();
    document.getElementById('unique-locations').textContent = uniqueLocations.toLocaleString();
    document.getElementById('unique-traverses').textContent = uniqueTraverses.toLocaleString();
    document.getElementById('date-range').textContent = dateRange;
    
    // Create charts
    createSampleTypeChart();
    createPHChart();
    
    // Create statistics tables
    createChemicalStatsTable();
    createIsotopeStatsTable();
}

// Create sample type distribution chart
function createSampleTypeChart() {
    const ctx = document.getElementById('sampleTypeChart');
    if (!ctx) return;
    
    // Count sample types
    const sampleTypes = {};
    allData.forEach(row => {
        const type = row['Sample type'] || 'Unknown';
        sampleTypes[type] = (sampleTypes[type] || 0) + 1;
    });
    
    const labels = Object.keys(sampleTypes);
    const data = Object.values(sampleTypes);
    
    if (charts.sampleType) charts.sampleType.destroy();
    
    charts.sampleType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#4facfe',
                    '#43e97b', '#fa709a', '#fee140', '#30cfd0'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Create pH distribution chart
function createPHChart() {
    const ctx = document.getElementById('phChart');
    if (!ctx) return;
    
    // Get pH values
    const phValues = allData
        .map(row => parseFloat(row['pH']))
        .filter(ph => !isNaN(ph));
    
    if (phValues.length === 0) return;
    
    // Create bins for histogram
    const bins = [0, 4, 5, 6, 7, 8, 9, 10, 14];
    const binCounts = new Array(bins.length - 1).fill(0);
    const binLabels = [];
    
    for (let i = 0; i < bins.length - 1; i++) {
        binLabels.push(`${bins[i]}-${bins[i + 1]}`);
    }
    
    phValues.forEach(ph => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (ph >= bins[i] && ph < bins[i + 1]) {
                binCounts[i]++;
                break;
            }
        }
    });
    
    if (charts.ph) charts.ph.destroy();
    
    charts.ph = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Sample Count',
                data: binCounts,
                backgroundColor: '#667eea',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Create chemical parameters statistics table
function createChemicalStatsTable() {
    const container = document.getElementById('chemical-stats');
    if (!container) return;
    
    const chemicalParams = ['pH', 'TDS', 'Na mmolar', 'K mmolar', 'Ca mmolar', 'Mg mmolar'];
    const stats = calculateStats(chemicalParams);
    
    const table = createStatsTableHTML(stats);
    container.innerHTML = table;
}

// Create isotope data statistics table
function createIsotopeStatsTable() {
    const container = document.getElementById('isotope-stats');
    if (!container) return;
    
    const isotopeParams = ['d88Sr', 'd7Li', 'd13C DIC', 'd17O', 'd18O', 'd2H'];
    const stats = calculateStats(isotopeParams);
    
    const table = createStatsTableHTML(stats);
    container.innerHTML = table;
}

// Calculate statistics for parameters
function calculateStats(params) {
    const stats = [];
    
    params.forEach(param => {
        const values = allData
            .map(row => parseFloat(row[param]))
            .filter(val => !isNaN(val));
        
        if (values.length > 0) {
            const sorted = [...values].sort((a, b) => a - b);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const median = sorted[Math.floor(sorted.length / 2)];
            
            stats.push({
                parameter: param,
                count: values.length,
                mean: mean.toFixed(4),
                median: median.toFixed(4),
                min: min.toFixed(4),
                max: max.toFixed(4)
            });
        }
    });
    
    return stats;
}

// Create HTML for statistics table
function createStatsTableHTML(stats) {
    if (stats.length === 0) return '<p>No data available</p>';
    
    let html = '<table><thead><tr>';
    html += '<th>Parameter</th><th>Count</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th>';
    html += '</tr></thead><tbody>';
    
    stats.forEach(stat => {
        html += '<tr>';
        html += `<td>${stat.parameter}</td>`;
        html += `<td>${stat.count}</td>`;
        html += `<td>${stat.mean}</td>`;
        html += `<td>${stat.median}</td>`;
        html += `<td>${stat.min}</td>`;
        html += `<td>${stat.max}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

// Populate data table
function populateDataTable(data) {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const tableInfo = document.getElementById('table-info');
    
    if (!thead || !tbody) return;
    
    // Clear existing content
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 40px;">No data found</td></tr>';
        tableInfo.textContent = 'Showing 0 of 0 samples';
        return;
    }
    
    // Create header row
    const headerRow = document.createElement('tr');
    DISPLAY_COLUMNS.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    
    // Create data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        DISPLAY_COLUMNS.forEach(col => {
            const td = document.createElement('td');
            let value = row[col];
            
            // Format numbers
            if (typeof value === 'number') {
                value = value.toFixed(4);
            }
            
            td.textContent = value !== '' && value !== null && value !== undefined ? value : '-';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    // Update info
    tableInfo.textContent = `Showing ${data.length} of ${allData.length} samples`;
}

// Filter data based on search query
function filterData(query) {
    if (!query) {
        filteredData = [...allData];
    } else {
        const lowerQuery = query.toLowerCase();
        filteredData = allData.filter(row => {
            return Object.values(row).some(val => {
                return String(val).toLowerCase().includes(lowerQuery);
            });
        });
    }
    
    populateDataTable(filteredData);
}

// Export data to CSV
function exportToCSV() {
    try {
        // Create CSV content
        let csv = DISPLAY_COLUMNS.join(',') + '\n';
        
        filteredData.forEach(row => {
            const values = DISPLAY_COLUMNS.map(col => {
                let val = row[col];
                if (val === null || val === undefined) val = '';
                // Escape commas and quotes
                val = String(val).replace(/"/g, '""');
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    val = `"${val}"`;
                }
                return val;
            });
            csv += values.join(',') + '\n';
        });
        
        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `water_chemistry_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Data exported successfully!');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data: ' + error.message);
    }
}

// Show error message
function showError(message) {
    document.querySelector('.data-status').textContent = message;
    document.querySelector('.data-status').style.color = '#ff6b6b';
}

// Setup plotting tool
function setupPlottingTool() {
    console.log('📈 Setting up plotting tool...');
    
    if (allData.length === 0) return;
    
    // Get numeric columns for plotting
    const sampleRow = allData[0];
    const numericCols = Object.keys(sampleRow).filter(col => {
        const val = sampleRow[col];
        return typeof val === 'number' || !isNaN(parseFloat(val));
    });
    
    // Populate axis selectors
    const xAxis = document.getElementById('plot-x-axis');
    const yAxis = document.getElementById('plot-y-axis');
    
    if (xAxis && yAxis) {
        numericCols.forEach(col => {
            const optionX = document.createElement('option');
            optionX.value = col;
            optionX.textContent = col;
            xAxis.appendChild(optionX);
            
            const optionY = document.createElement('option');
            optionY.value = col;
            optionY.textContent = col;
            yAxis.appendChild(optionY);
        });
    }
    
    // Populate filter dropdowns
    populateFilterDropdowns();
    
    // Setup event listeners
    const filterTraverse = document.getElementById('plot-filter-traverse');
    const filterType = document.getElementById('plot-filter-type');
    
    if (filterTraverse) {
        filterTraverse.addEventListener('change', updatePlotSampleCount);
    }
    if (filterType) {
        filterType.addEventListener('change', updatePlotSampleCount);
    }
    
    const plotBtn = document.getElementById('create-plot-btn');
    if (plotBtn) {
        plotBtn.addEventListener('click', createCustomPlot);
    }
    
    updatePlotSampleCount();
    console.log('✅ Plotting tool ready');
}

// Populate filter dropdowns
function populateFilterDropdowns() {
    // Get unique values for filters
    const traverses = [...new Set(allData.map(r => r['Traverse_new']).filter(Boolean))].sort();
    const types = [...new Set(allData.map(r => r['Sample type']).filter(Boolean))].sort();
    
    const traverseSelect = document.getElementById('plot-filter-traverse');
    const typeSelect = document.getElementById('plot-filter-type');
    
    if (traverseSelect) {
        traverses.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            traverseSelect.appendChild(option);
        });
    }
    
    if (typeSelect) {
        types.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            typeSelect.appendChild(option);
        });
    }
}

// Update sample count based on filters
function updatePlotSampleCount() {
    const filtered = getFilteredDataForPlot();
    const countEl = document.getElementById('plot-sample-count');
    if (countEl) {
        countEl.textContent = `${filtered.length} samples`;
        countEl.style.color = filtered.length > 0 ? '#10b981' : '#ef4444';
        countEl.style.fontWeight = '600';
    }
}

// Get filtered data based on current filters
function getFilteredDataForPlot() {
    const traverseFilter = document.getElementById('plot-filter-traverse')?.value;
    const typeFilter = document.getElementById('plot-filter-type')?.value;
    
    let filtered = [...allData];
    
    if (traverseFilter) {
        filtered = filtered.filter(r => r['Traverse_new'] === traverseFilter);
    }
    
    if (typeFilter) {
        filtered = filtered.filter(r => r['Sample type'] === typeFilter);
    }
    
    return filtered;
}

// Create custom plot
function createCustomPlot() {
    const xCol = document.getElementById('plot-x-axis')?.value;
    const yCol = document.getElementById('plot-y-axis')?.value;
    const colorBy = document.getElementById('plot-color-by')?.value;
    
    if (!xCol || !yCol) {
        alert('Please select both X and Y variables');
        return;
    }
    
    const filtered = getFilteredDataForPlot();
    
    if (filtered.length === 0) {
        alert('No data matches the current filters');
        return;
    }
    
    console.log(`📈 Creating plot: ${yCol} vs ${xCol} (${filtered.length} samples)`);
    
    // Prepare data
    const plotData = filtered.map(row => ({
        x: parseFloat(row[xCol]),
        y: parseFloat(row[yCol]),
        label: row['Sample ID'],
        group: colorBy ? row[colorBy] : 'All'
    })).filter(d => !isNaN(d.x) && !isNaN(d.y));
    
    if (plotData.length === 0) {
        alert('No valid numeric data for selected variables');
        return;
    }
    
    // Group by color variable if specified
    let datasets;
    if (colorBy) {
        const groups = {};
        plotData.forEach(d => {
            if (!groups[d.group]) groups[d.group] = [];
            groups[d.group].push({ x: d.x, y: d.y, label: d.label });
        });
        
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
        datasets = Object.entries(groups).map(([group, data], idx) => ({
            label: group,
            data: data,
            backgroundColor: colors[idx % colors.length],
            borderColor: colors[idx % colors.length],
            pointRadius: 5,
            pointHoverRadius: 7
        }));
    } else {
        datasets = [{
            label: 'Samples',
            data: plotData,
            backgroundColor: '#3b82f6',
            borderColor: '#3b82f6',
            pointRadius: 5,
            pointHoverRadius: 7
        }];
    }
    
    // Show plot container
    document.getElementById('custom-plot-container').style.display = 'block';
    document.getElementById('custom-plot-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Update title
    const title = document.getElementById('plot-title');
    if (title) {
        title.textContent = `${yCol} vs ${xCol}${colorBy ? ` (colored by ${colorBy})` : ''}`;
    }
    
    // Create plot
    plotCustomData(datasets, xCol, yCol);
}

// Plot the custom data
function plotCustomData(datasets, xLabel, yLabel) {
    const canvas = document.getElementById('custom-plot-canvas');
    if (!canvas) return;
    
    // Destroy existing chart
    if (charts.customPlot) {
        charts.customPlot.destroy();
    }
    
    // Reset canvas size
    canvas.style.height = '450px';
    canvas.style.width = '100%';
    canvas.height = 450;
    canvas.width = canvas.parentElement.clientWidth;
    
    charts.customPlot = new Chart(canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: xLabel, 
                        font: { size: 13, weight: '600' } 
                    },
                    grid: { color: '#e5e7eb' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: yLabel, 
                        font: { size: 13, weight: '600' } 
                    },
                    grid: { color: '#e5e7eb' }
                }
            },
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    position: 'top',
                    labels: {
                        font: { size: 12 },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const point = context.raw;
                            const label = point.label || '';
                            return `${label}: (${context.parsed.x.toFixed(4)}, ${context.parsed.y.toFixed(4)})`;
                        }
                    }
                }
            },
            onResize: (chart) => {
                chart.canvas.style.height = '450px';
            }
        }
    });
    
    console.log('✅ Custom plot created');
}

// Clear custom plot
window.clearCustomPlot = function() {
    if (charts.customPlot) {
        charts.customPlot.destroy();
        charts.customPlot = null;
    }
    document.getElementById('custom-plot-container').style.display = 'none';
};


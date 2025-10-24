// Dedicated ICP-OES UI Module
// This file handles ONLY the ICP-OES Analysis page UI

const { ipcRenderer } = require('electron');

// State
let icpoesData = null;

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 ICP-OES UI: DOM loaded');
    
    // Wait for page to be fully rendered
    setTimeout(() => {
        initializeICPOESUI();
    }, 1500);
});

// Main initialization function
async function initializeICPOESUI() {
    console.log('🚀 ICP-OES UI: Initializing...');
    
    try {
        // Request data from main process
        console.log('📡 ICP-OES UI: Requesting data via IPC...');
        const data = await ipcRenderer.invoke('get-app-data');
        
        if (!data) {
            console.error('❌ ICP-OES UI: No data received!');
            showError('Failed to load data');
            return;
        }
        
        console.log('✅ ICP-OES UI: Data received');
        console.log('  - ICP-OES files:', Object.keys(data.icpoesData || {}).length);
        console.log('  - Matches:', (data.matches || []).length);
        console.log('  - Grouped runs:', Object.keys(data.groupedByRun || {}).length);
        
        icpoesData = data;
        
        // Update all UI elements
        updateSummaryCards();
        displayRunGroups();
        populateDropdowns();
        
        console.log('✅ ICP-OES UI: Fully initialized');
        
    } catch (error) {
        console.error('❌ ICP-OES UI: Error:', error);
        showError('Initialization failed: ' + error.message);
    }
}

// Update the three summary cards at the top
function updateSummaryCards() {
    console.log('📊 Updating summary cards...');
    
    const runsCount = Object.keys(icpoesData.groupedByRun || {}).length;
    const matchesCount = (icpoesData.matches || []).length;
    
    // Count unique analytes
    const allAnalytes = new Set();
    Object.values(icpoesData.icpoesData || {}).forEach(fileData => {
        (fileData.analytes || []).forEach(a => allAnalytes.add(a));
    });
    
    // Update DOM elements
    setElementText('icpoes-runs-count', runsCount);
    setElementText('icpoes-matches-count', matchesCount.toLocaleString());
    setElementText('icpoes-analytes-count', allAnalytes.size);
    
    console.log(`  ✅ Updated: ${runsCount} runs, ${matchesCount} matches, ${allAnalytes.size} analytes`);
}

// Display run groups
function displayRunGroups() {
    console.log('📦 Displaying run groups...');
    
    const container = document.getElementById('grouped-data-container');
    if (!container) {
        console.error('❌ Container element not found!');
        return;
    }
    
    container.innerHTML = '';
    
    const groupedByRun = icpoesData.groupedByRun || {};
    const runCount = Object.keys(groupedByRun).length;
    
    if (runCount === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #7f8c8d;">No ICP-OES runs found</p>';
        console.log('  ⚠️ No runs to display');
        return;
    }
    
    console.log(`  Creating ${runCount} run group elements...`);
    
    let created = 0;
    for (const [filename, groupData] of Object.entries(groupedByRun)) {
        const runElement = createRunGroupElement(filename, groupData);
        container.appendChild(runElement);
        created++;
    }
    
    console.log(`  ✅ Created ${created} run groups, container has ${container.children.length} children`);
}

// Create a run group element
function createRunGroupElement(filename, groupData) {
    const div = document.createElement('div');
    div.className = 'run-group';
    
    const shortName = filename.replace(/\.xlsx?$/i, '');
    const matches = groupData.matches || [];
    const fileData = groupData.fileData || {};
    const totalSamples = fileData.totalSamples || 0;
    const matchedCount = matches.length;
    const analytes = fileData.analytes || [];
    const matchRate = totalSamples > 0 ? Math.round((matchedCount / totalSamples) * 100) : 0;
    
    // Header (clickable)
    const header = document.createElement('div');
    header.className = 'run-group-header';
    header.innerHTML = `
        <div>
            <div class="run-group-title">${escapeHtml(shortName)}</div>
            <div class="run-group-meta">${matchedCount}/${totalSamples} samples matched (${matchRate}%)</div>
        </div>
        <div class="run-group-badge">${analytes.length} analytes</div>
    `;
    
    // Content (expandable)
    const content = document.createElement('div');
    content.className = 'run-group-content';
    
    if (matches.length > 0) {
        content.innerHTML = createMatchesTable(matches);
    } else {
        content.innerHTML = '<p style="padding: 20px; text-align: center; color: #7f8c8d;">No matches found</p>';
    }
    
    // Toggle expand/collapse
    header.addEventListener('click', () => {
        content.classList.toggle('expanded');
    });
    
    div.appendChild(header);
    div.appendChild(content);
    
    return div;
}

// Create matches table HTML
function createMatchesTable(matches) {
    let html = '<table class="run-group-table"><thead><tr>';
    html += '<th>Main ID</th><th>ICP ID</th><th>Confidence</th>';
    html += '<th>Date</th><th>Sample Type</th><th>Traverse</th>';
    html += '<th>Latitude</th><th>Longitude</th>';
    html += '</tr></thead><tbody>';
    
    matches.forEach(match => {
        const confidence = match.confidence || 0;
        const confidenceClass = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
        const confidencePercent = Math.round(confidence * 100);
        
        const mainSample = match.mainSample || {};
        
        html += '<tr>';
        html += `<td><strong>${escapeHtml(match.mainID || 'N/A')}</strong></td>`;
        html += `<td>${escapeHtml(match.icpID || 'N/A')}</td>`;
        html += `<td><span class="confidence-badge ${confidenceClass}">${confidencePercent}%</span></td>`;
        html += `<td>${escapeHtml(mainSample.Date || '-')}</td>`;
        html += `<td>${escapeHtml(mainSample['Sample type'] || '-')}</td>`;
        html += `<td>${escapeHtml(mainSample.Traverse_new || '-')}</td>`;
        html += `<td>${formatNumber(mainSample.Latitude)}</td>`;
        html += `<td>${formatNumber(mainSample.Longitude)}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

// Populate calibration dropdowns
function populateDropdowns() {
    console.log('🎨 Populating dropdowns...');
    
    // Populate calibration run selector
    const calibRunSelector = document.getElementById('calib-run-selector');
    if (calibRunSelector) {
        calibRunSelector.innerHTML = '<option value="">-- Select Run --</option>';
        Object.keys(icpoesData.groupedByRun || {}).forEach(filename => {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename.replace(/\.xlsx?$/i, '');
            calibRunSelector.appendChild(option);
        });
        console.log(`  ✅ Populated calib-run-selector with ${calibRunSelector.options.length - 1} files`);
    }
    
    console.log('✅ Dropdowns populated');
}

// Update analyte dropdown based on selected file
function updateAnalyteDropdown(filename) {
    const analyteSelector = document.getElementById('quick-analyte-selector');
    if (!analyteSelector || !filename) return;
    
    const fileData = icpoesData.icpoesData?.[filename];
    const analytes = fileData?.analytes || [];
    
    analyteSelector.innerHTML = '<option value="">-- Select Analyte --</option>';
    analytes.forEach(analyte => {
        const option = document.createElement('option');
        option.value = analyte;
        option.textContent = analyte;
        analyteSelector.appendChild(option);
    });
}

// Helper functions
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    } else {
        console.warn(`⚠️ Element '${id}' not found`);
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatNumber(num) {
    if (num === null || num === undefined || num === '') return '-';
    const n = parseFloat(num);
    return isNaN(n) ? '-' : n.toFixed(4);
}

function showError(message) {
    const container = document.getElementById('grouped-data-container');
    if (container) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #e74c3c; background: #fee; border-radius: 8px;">
                <h3>⚠️ Error</h3>
                <p>${escapeHtml(message)}</p>
                <p style="font-size: 12px; color: #7f8c8d; margin-top: 10px;">Check console (F12) for details</p>
            </div>
        `;
    }
}

// Export for refresh button
window.refreshICPOESData = initializeICPOESUI;

console.log('✅ ICP-OES UI module loaded');


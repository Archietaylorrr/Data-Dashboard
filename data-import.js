// Data Import Module
// Handles importing new ICP-OES data into master spreadsheet

console.log('📥 data-import.js loading...');

const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Import state
let importState = {
    selectedFile: null,
    fileData: null,
    sampleMatches: [],
    columnMappings: [],
    masterData: null,
    previewData: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupImportHandlers();
    }, 1500);
});

function setupImportHandlers() {
    console.log('📥 Setting up import handlers...');
    
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
}

// Handle file selection
function handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log(`📂 File selected: ${file.name}`);
    
    const fileNameEl = document.getElementById('import-file-name');
    if (fileNameEl) {
        fileNameEl.textContent = `Selected: ${file.name}`;
    }
    
    // Read the file
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            importState.selectedFile = file.name;
            importState.fileData = workbook;
            
            console.log(`  ✅ Loaded workbook with sheets: ${workbook.SheetNames.join(', ')}`);
            
            // Process the file
            processImportFile(workbook);
            
        } catch (error) {
            console.error('❌ Error reading file:', error);
            alert('Error reading file: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Process imported file
async function processImportFile(workbook) {
    console.log('🔄 Processing import file...');
    
    // Get app data
    const appData = await ipcRenderer.invoke('get-app-data');
    if (!appData || !appData.mainData) {
        alert('Main data not loaded. Please wait and try again.');
        return;
    }
    
    importState.masterData = appData.mainData;
    
    // Find the data sheet (likely the last or named "Final", "Data", etc.)
    const sheetName = findDataSheet(workbook.SheetNames);
    const sheet = workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`  📊 Using sheet: ${sheetName} (${sheetData.length} rows)`);
    
    // Match samples
    matchImportSamples(sheetData);
}

// Find data sheet in workbook
function findDataSheet(sheetNames) {
    const keywords = ['final', 'data', 'samples', 'results'];
    for (const keyword of keywords) {
        const found = sheetNames.find(s => s.toLowerCase().includes(keyword));
        if (found) return found;
    }
    return sheetNames[sheetNames.length - 1];
}

// Match samples between import and master
function matchImportSamples(importData) {
    console.log('🔗 Matching samples...');
    
    const matches = [];
    const importColumns = Object.keys(importData[0] || {});
    const idColumns = importColumns.filter(c => {
        const lower = c.toLowerCase();
        return lower.includes('sample') || lower.includes('id') || lower.includes('name') || lower.includes('label');
    });
    
    const searchCols = idColumns.length > 0 ? idColumns : [importColumns[0]];
    
    importData.forEach((importRow, idx) => {
        for (const col of searchCols) {
            const importID = String(importRow[col] || '').trim();
            if (!importID || importID.length < 2) continue;
            
            // Fuzzy match with master data
            const bestMatch = findBestSampleMatch(importID, importState.masterData);
            
            if (bestMatch && bestMatch.score > 0.6) {
                matches.push({
                    importID: importID,
                    masterID: bestMatch.id,
                    confidence: bestMatch.score,
                    importRowIndex: idx,
                    importRow: importRow
                });
                break;
            }
        }
    });
    
    importState.sampleMatches = matches;
    console.log(`  ✅ Matched ${matches.length}/${importData.length} samples`);
    
    // Display matches
    displaySampleMatches(matches, importData.length);
    
    // Show step 2
    document.getElementById('import-step-2').style.display = 'block';
    document.getElementById('import-step-2').scrollIntoView({ behavior: 'smooth' });
}

// Fuzzy match sample ID
function findBestSampleMatch(importID, masterData) {
    const normalized = normalizeID(importID);
    let bestScore = 0;
    let bestMatch = null;
    
    masterData.forEach(row => {
        const masterID = String(row['Sample ID'] || '').trim();
        if (!masterID) return;
        
        const score = similarityScore(normalized, normalizeID(masterID));
        if (score > bestScore) {
            bestScore = score;
            bestMatch = { id: masterID, score: score };
        }
    });
    
    return bestMatch;
}

function normalizeID(id) {
    return id.toLowerCase().replace(/[-_\s]/g, '').replace(/[^a-z0-9]/g, '');
}

function similarityScore(str1, str2) {
    if (str1 === str2) return 1.0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    if (longer.includes(shorter)) return 0.8 + (shorter.length / longer.length) * 0.2;
    const distance = levenshteinDistance(str1, str2);
    return Math.max(0, 1 - (distance / longer.length));
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2[i - 1] === str1[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// Display sample matches
function displaySampleMatches(matches, totalImported) {
    const container = document.getElementById('import-sample-matches');
    if (!container) return;
    
    const matchRate = Math.round((matches.length / totalImported) * 100);
    
    let html = `<div class="import-summary">`;
    html += `<p><strong>${matches.length} of ${totalImported} samples matched (${matchRate}%)</strong></p>`;
    html += `<p style="font-size: 13px; color: #64748b; margin-top: 8px;">These samples will be updated in the master spreadsheet</p>`;
    html += `</div>`;
    
    html += '<div class="match-preview-container">';
    html += '<table class="match-preview-table"><thead><tr>';
    html += '<th>Import ID</th><th>→</th><th>Master ID</th><th>Confidence</th>';
    html += '</tr></thead><tbody>';
    
    matches.slice(0, 50).forEach(match => {
        const confClass = match.confidence >= 0.9 ? 'high' : match.confidence >= 0.7 ? 'medium' : 'low';
        html += '<tr>';
        html += `<td>${match.importID}</td>`;
        html += `<td style="text-align: center; color: #3b82f6;">→</td>`;
        html += `<td><strong>${match.masterID}</strong></td>`;
        html += `<td><span class="confidence-badge ${confClass}">${Math.round(match.confidence * 100)}%</span></td>`;
        html += '</tr>';
    });
    
    if (matches.length > 50) {
        html += `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 16px;">... and ${matches.length - 50} more matches</td></tr>`;
    }
    
    html += '</tbody></table></div>';
    
    container.innerHTML = html;
}

// Confirm matches and proceed to column mapping
window.confirmMatches = function() {
    console.log('✅ User confirmed matches, proceeding to column mapping');
    
    // Get columns from import file
    const firstMatch = importState.sampleMatches[0];
    if (!firstMatch) {
        alert('No samples matched');
        return;
    }
    
    const importColumns = Object.keys(firstMatch.importRow);
    
    // Find data columns (ppm, ppb, concentration values)
    const dataColumns = importColumns.filter(c => {
        const lower = c.toLowerCase();
        return (lower.includes('ppm') || lower.includes('ppb') || lower.includes('conc')) && 
               !lower.includes('inten') && !lower.includes('cps');
    });
    
    console.log(`  📊 Found ${dataColumns.length} data columns to import`);
    
    // Auto-map to master columns
    autoMapColumns(dataColumns);
    
    // Show step 3
    document.getElementById('import-step-2').style.display = 'none';
    document.getElementById('import-step-3').style.display = 'block';
    document.getElementById('import-step-3').scrollIntoView({ behavior: 'smooth' });
};

// Auto-map import columns to master columns
function autoMapColumns(importColumns) {
    const masterColumns = Object.keys(importState.masterData[0] || {});
    const mappings = [];
    
    importColumns.forEach(importCol => {
        // Try to find matching master column
        const masterCol = findMatchingMasterColumn(importCol, masterColumns);
        
        mappings.push({
            importColumn: importCol,
            masterColumn: masterCol,
            action: masterCol ? 'update' : 'create',
            sampleCount: importState.sampleMatches.length
        });
    });
    
    importState.columnMappings = mappings;
    displayColumnMapping(mappings);
}

// Find matching master column
function findMatchingMasterColumn(importCol, masterCols) {
    // Extract element from import column
    // e.g., "Mg Ax 280.270 nm ppm" → "Mg"
    const elementMatch = importCol.match(/^([A-Z][a-z]?)/);
    if (!elementMatch) return null;
    
    const element = elementMatch[1];
    
    // Look for master column with same element and "ppm"
    // e.g., "Mg_ppm", "Mg ppm", "Mg mmol", etc.
    const matches = masterCols.filter(c => {
        const lower = c.toLowerCase();
        const elemLower = element.toLowerCase();
        return lower.includes(elemLower) && (lower.includes('ppm') || lower.includes('mmol') || lower.includes('concentration'));
    });
    
    // If multiple matches, prefer exact element_ppm format
    if (matches.length > 0) {
        const exactMatch = matches.find(c => c.toLowerCase() === `${element.toLowerCase()}_ppm`);
        return exactMatch || matches[0];
    }
    
    return null;
}

// Display column mapping
function displayColumnMapping(mappings) {
    const container = document.getElementById('import-column-mapping');
    if (!container) return;
    
    const updateCols = mappings.filter(m => m.action === 'update');
    const newCols = mappings.filter(m => m.action === 'create');
    
    let html = `<div class="mapping-summary">`;
    html += `<p><strong>${updateCols.length} columns will update existing data</strong></p>`;
    html += `<p><strong>${newCols.length} new columns will be added</strong></p>`;
    html += `</div>`;
    
    html += '<table class="mapping-table"><thead><tr>';
    html += '<th>Import Column</th><th>→</th><th>Master Column</th><th>Action</th><th>Samples</th>';
    html += '</tr></thead><tbody>';
    
    mappings.forEach((mapping, idx) => {
        const actionBadge = mapping.action === 'update' ? 
            '<span class="action-badge update">Update</span>' :
            '<span class="action-badge create">Create New</span>';
        
        html += '<tr>';
        html += `<td><code>${mapping.importColumn}</code></td>`;
        html += `<td style="text-align: center; color: #3b82f6;">→</td>`;
        html += `<td>`;
        if (mapping.action === 'update') {
            html += `<select class="mapping-select" data-index="${idx}" onchange="updateMapping(${idx}, this.value)">`;
            Object.keys(importState.masterData[0]).forEach(col => {
                const selected = col === mapping.masterColumn ? 'selected' : '';
                html += `<option value="${col}" ${selected}>${col}</option>`;
            });
            html += `<option value="_NEW_">-- Create New Column --</option>`;
            html += `</select>`;
        } else {
            html += `<input type="text" class="column-name-input" data-index="${idx}" value="${mapping.importColumn}" onchange="updateNewColumnName(${idx}, this.value)" placeholder="New column name">`;
        }
        html += `</td>`;
        html += `<td>${actionBadge}</td>`;
        html += `<td>${mapping.sampleCount}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    container.innerHTML = html;
}

// Update mapping
window.updateMapping = function(index, value) {
    if (value === '_NEW_') {
        importState.columnMappings[index].action = 'create';
        importState.columnMappings[index].masterColumn = importState.columnMappings[index].importColumn;
    } else {
        importState.columnMappings[index].action = 'update';
        importState.columnMappings[index].masterColumn = value;
    }
    displayColumnMapping(importState.columnMappings);
};

window.updateNewColumnName = function(index, value) {
    importState.columnMappings[index].masterColumn = value;
};

// Preview import
window.previewImport = function() {
    console.log('👁️ Generating preview...');
    
    const preview = generatePreviewData();
    importState.previewData = preview;
    
    displayPreview(preview);
    
    // Show step 4
    document.getElementById('import-step-3').style.display = 'none';
    document.getElementById('import-step-4').style.display = 'block';
    document.getElementById('import-step-4').scrollIntoView({ behavior: 'smooth' });
};

// Generate preview data
function generatePreviewData() {
    const updates = [];
    const newColumns = [];
    
    importState.columnMappings.forEach(mapping => {
        if (mapping.action === 'create') {
            newColumns.push(mapping.masterColumn || mapping.importColumn);
        }
    });
    
    importState.sampleMatches.forEach(match => {
        const sampleUpdates = {
            sampleID: match.masterID,
            changes: []
        };
        
        importState.columnMappings.forEach(mapping => {
            const importValue = match.importRow[mapping.importColumn];
            const masterCol = mapping.masterColumn || mapping.importColumn;
            
            sampleUpdates.changes.push({
                column: masterCol,
                value: importValue,
                action: mapping.action
            });
        });
        
        updates.push(sampleUpdates);
    });
    
    return { updates, newColumns };
}

// Display preview
function displayPreview(preview) {
    const container = document.getElementById('import-preview');
    if (!container) return;
    
    let html = '<div class="preview-summary">';
    html += `<h4>Import Summary</h4>`;
    html += `<p><strong>${preview.updates.length} samples</strong> will be updated</p>`;
    if (preview.newColumns.length > 0) {
        html += `<p><strong>${preview.newColumns.length} new columns</strong> will be added: ${preview.newColumns.join(', ')}</p>`;
    }
    html += '</div>';
    
    html += '<div class="preview-table-container">';
    html += '<table class="preview-table"><thead><tr>';
    html += '<th>Sample ID</th><th>Column</th><th>New Value</th><th>Action</th>';
    html += '</tr></thead><tbody>';
    
    preview.updates.slice(0, 20).forEach(update => {
        update.changes.forEach((change, idx) => {
            if (idx === 0) {
                html += `<tr><td rowspan="${update.changes.length}"><strong>${update.sampleID}</strong></td>`;
            } else {
                html += '<tr>';
            }
            html += `<td><code>${change.column}</code></td>`;
            html += `<td>${formatPreviewValue(change.value)}</td>`;
            html += `<td><span class="action-badge ${change.action}">${change.action === 'update' ? 'Update' : 'New'}</span></td>`;
            html += '</tr>';
        });
    });
    
    if (preview.updates.length > 20) {
        html += `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 16px;">... and ${preview.updates.length - 20} more samples</td></tr>`;
    }
    
    html += '</tbody></table></div>';
    
    container.innerHTML = html;
}

function formatPreviewValue(val) {
    if (val === undefined || val === null || val === '') return '-';
    if (typeof val === 'number') {
        return val.toExponential(3);
    }
    return String(val);
}

// Execute import
window.executeImport = function() {
    if (!confirm('This will modify MainData.xlsx. A backup will be created. Continue?')) {
        return;
    }
    
    console.log('🚀 Executing import...');
    
    try {
        // Create backup
        const backupPath = createBackup();
        console.log(`  💾 Backup created: ${backupPath}`);
        
        // Apply changes
        applyImportChanges();
        
        // Save master data
        saveMasterData();
        
        // Show success
        showImportSuccess(backupPath);
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        alert('Import failed: ' + error.message + '\n\nYour data has not been modified.');
    }
};

// Create backup
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = path.join(__dirname, `MainData_backup_${timestamp}.xlsx`);
    const originalPath = path.join(__dirname, 'MainData.xlsx');
    
    fs.copyFileSync(originalPath, backupPath);
    return backupPath;
}

// Apply import changes
function applyImportChanges() {
    console.log('  🔄 Applying changes...');
    
    const preview = importState.previewData;
    const masterData = importState.masterData;
    
    // Add new columns if needed
    preview.newColumns.forEach(newCol => {
        masterData.forEach(row => {
            if (!row.hasOwnProperty(newCol)) {
                row[newCol] = '';
            }
        });
    });
    
    // Apply updates
    preview.updates.forEach(update => {
        const masterRow = masterData.find(r => r['Sample ID'] === update.sampleID);
        if (masterRow) {
            update.changes.forEach(change => {
                masterRow[change.column] = change.value;
            });
        }
    });
    
    console.log('  ✅ Changes applied to data');
}

// Save master data back to Excel
function saveMasterData() {
    console.log('  💾 Saving MainData.xlsx...');
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(importState.masterData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    const outputPath = path.join(__dirname, 'MainData.xlsx');
    XLSX.writeFile(workbook, outputPath);
    
    console.log('  ✅ MainData.xlsx saved');
}

// Show success message
function showImportSuccess(backupPath) {
    const preview = importState.previewData;
    
    document.getElementById('import-step-4').style.display = 'none';
    document.getElementById('import-success').style.display = 'block';
    document.getElementById('import-success').scrollIntoView({ behavior: 'smooth' });
    
    const successMsg = document.getElementById('import-success-message');
    if (successMsg) {
        successMsg.innerHTML = `
            <strong>${preview.updates.length} samples</strong> updated with <strong>${importState.columnMappings.length} columns</strong><br>
            ${preview.newColumns.length > 0 ? `<strong>${preview.newColumns.length} new columns</strong> added<br>` : ''}
            Backup saved to: ${path.basename(backupPath)}
        `;
    }
}

// Reset import workflow
window.resetImport = function() {
    importState = {
        selectedFile: null,
        fileData: null,
        sampleMatches: [],
        columnMappings: [],
        masterData: null,
        previewData: null
    };
    
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-file-name').textContent = '';
    document.getElementById('import-step-2').style.display = 'none';
    document.getElementById('import-step-3').style.display = 'none';
    document.getElementById('import-step-4').style.display = 'none';
    document.getElementById('import-success').style.display = 'none';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelImport = resetImport;

window.backToStep = function(step) {
    if (step === 2) {
        document.getElementById('import-step-3').style.display = 'none';
        document.getElementById('import-step-2').style.display = 'block';
        document.getElementById('import-step-2').scrollIntoView({ behavior: 'smooth' });
    } else if (step === 3) {
        document.getElementById('import-step-4').style.display = 'none';
        document.getElementById('import-step-3').style.display = 'block';
        document.getElementById('import-step-3').scrollIntoView({ behavior: 'smooth' });
    }
};

console.log('✅ Data import module loaded');


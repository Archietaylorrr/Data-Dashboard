// Advanced Calibration Module
// Focused on reviewing and improving calibrations

console.log('='.repeat(80));
console.log('🔬🔬🔬 CALIBRATION-ADVANCED.JS IS LOADING NOW 🔬🔬🔬');
console.log('='.repeat(80));

try {
    const { ipcRenderer } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    console.log('✅ calibration-advanced.js: All dependencies loaded successfully');
} catch (error) {
    console.error('❌❌❌ calibration-advanced.js: Failed to load dependencies:', error);
}

// Global state
let calibrationState = {
    currentRun: null,
    standardsData: null,
    calibrations: {}, // Store calibration for each analyte
    excludedStandards: {}, // Track excluded standards per analyte
    currentAnalyte: null, // Current analyte being viewed
    currentIntensityCol: null // Current intensity column being viewed
};

console.log('✅ calibration-advanced.js: State initialized');

// Initialize calibration module
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔬 Calibration-advanced.js: DOM loaded');
    
    // Try multiple times to attach listeners (in case dropdown isn't ready yet)
    let attempts = 0;
    const maxAttempts = 5;
    
    const trySetup = () => {
        attempts++;
        console.log(`🔬 Attempt ${attempts}/${maxAttempts} to setup calibration interface...`);
        
        const runSelector = document.getElementById('calib-run-selector');
        
        if (runSelector && runSelector.options.length > 1) {
            // Dropdown exists AND is populated
            console.log(`  ✅ Dropdown ready with ${runSelector.options.length} options`);
            setupCalibrationInterface();
        } else if (attempts < maxAttempts) {
            // Try again
            console.log(`  ⏳ Dropdown not ready yet (${runSelector ? runSelector.options.length : 0} options), retrying in 1 second...`);
            setTimeout(trySetup, 1000);
        } else {
            console.error(`  ❌ Failed to setup after ${maxAttempts} attempts`);
            setupCalibrationInterface(); // Try anyway as last resort
        }
    };
    
    // Start first attempt after 2 seconds
    setTimeout(trySetup, 2000);
});

function setupCalibrationInterface() {
    console.log('🔬 Setting up advanced calibration interface...');
    
    // Run selector event
    const runSelector = document.getElementById('calib-run-selector');
    if (runSelector) {
        console.log(`  ✅ Found calib-run-selector with ${runSelector.options.length} options`);
        
        // Remove any existing listeners (in case this is called multiple times)
        const newSelector = runSelector.cloneNode(true);
        runSelector.parentNode.replaceChild(newSelector, runSelector);
        
        // Add new listener
        newSelector.addEventListener('change', (e) => {
            console.log(`  🎯 Run selected via event listener: ${e.target.value}`);
            loadRunCalibration(e.target.value);
        });
        
        console.log('  ✅ Event listener attached successfully');
        
        // Test the listener immediately
        console.log('  🧪 Testing event listener...');
        console.log(`  Current value: ${newSelector.value}`);
    } else {
        console.error('  ❌ calib-run-selector not found!');
    }
    
    // Analyte selector event
    const analyteSelector = document.getElementById('calib-analyte-selector');
    if (analyteSelector) {
        console.log('  ✅ Found calib-analyte-selector, adding event listener');
        
        const newAnalyteSelector = analyteSelector.cloneNode(true);
        analyteSelector.parentNode.replaceChild(newAnalyteSelector, analyteSelector);
        
        newAnalyteSelector.addEventListener('change', (e) => {
            console.log(`  🎯 Analyte selected via dropdown: ${e.target.value}`);
            displayAnalyteCalibration(e.target.value);
        });
    } else {
        console.error('  ❌ calib-analyte-selector not found!');
    }
    
    // Export button
    const exportButton = document.getElementById('export-calib-button');
    if (exportButton) {
        console.log('  ✅ Found export-calib-button');
        exportButton.addEventListener('click', exportCalibrationReport);
    } else {
        console.error('  ❌ export-calib-button not found!');
    }
    
    console.log('✅ Calibration interface setup complete');
    console.log('👉 Now try selecting a run from the dropdown!');
}

// Load calibration data for a run
async function loadRunCalibration(filename) {
    if (!filename) {
        console.log('  ⚠️ No filename provided, returning');
        return;
    }
    
    console.log(`📊 Loading calibration for: ${filename}`);
    showLoading(true);
    
    try {
        console.log('  📡 Requesting data from main process...');
        const data = await ipcRenderer.invoke('get-app-data');
        
        if (!data || !data.icpoesData) {
            console.error('  ❌ No ICP-OES data available');
            showMessage('No ICP-OES data available', 'error');
            showLoading(false);
            return;
        }
        
        const fileData = data.icpoesData[filename];
        
        if (!fileData) {
            console.error(`  ❌ File data not found for: ${filename}`);
            showMessage('File data not found', 'error');
            showLoading(false);
            return;
        }
        
        console.log('  ✅ File data found');
        console.log(`  📋 Standards sheet: ${fileData.standardsSheetName || 'NOT FOUND'}`);
        console.log(`  📋 Analytes: ${(fileData.analytes || []).join(', ')}`);
        
        // Standards are in the raw data, so this warning is not needed anymore
        
        // Load standards data from file
        const filepath = path.join(__dirname, 'ICP-OES', filename);
        console.log(`  📂 Reading file: ${filepath}`);
        
        const workbook = XLSX.readFile(filepath);
        console.log(`  ✅ Workbook loaded, sheets: ${workbook.SheetNames.join(', ')}`);
        
        // Load ALL sheets to find standards (A-I labels)
        console.log('  🔍 Searching for standards (A-I) in all sheets...');
        
        let standardsData = [];
        let allRawData = [];
        
        // Try each sheet to find standards
        for (const sheetName of workbook.SheetNames) {
            console.log(`    Checking sheet: ${sheetName}`);
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(sheet);
            
            if (sheetData.length === 0) continue;
            
            // Look for rows with sample IDs that match A-I pattern
            const foundStandards = extractStandardsFromSheet(sheetData);
            
            if (foundStandards.length > 0) {
                console.log(`    ✅ Found ${foundStandards.length} standards in sheet: ${sheetName}`);
                standardsData = foundStandards;
                allRawData = sheetData;
                break; // Use first sheet that has standards
            }
        }
        
        if (standardsData.length === 0) {
            // Fallback: try the final sheet
            console.log('  ⚠️ No standards found by label, trying final sheet...');
            const finalSheet = workbook.Sheets[fileData.finalSheetName];
            allRawData = XLSX.utils.sheet_to_json(finalSheet);
            standardsData = extractStandardsFromSheet(allRawData);
        }
        
        if (standardsData.length === 0) {
            showMessage('No calibration standards (A-I) found in this run', 'error');
            showLoading(false);
            
            // Show what we found for debugging
            if (allRawData.length > 0) {
                console.log('  📊 Sample data columns:', Object.keys(allRawData[0]));
                console.log('  📊 Sample IDs found:', allRawData.slice(0, 10).map(r => findSampleIDValue(r)).filter(Boolean));
            }
            return;
        }
        
        console.log(`  ✅ Extracted ${standardsData.length} standards (A-I)`);
        console.log('  📊 Standards data sample (first row):', Object.keys(standardsData[0]));
        
        calibrationState.currentRun = filename;
        calibrationState.standardsData = standardsData;
        calibrationState.calibrations = {};
        calibrationState.excludedStandards = {};
        
        // Display standards table
        console.log('  🎨 Displaying standards table...');
        displayStandardsTable(standardsData);
        
        // Get all unique analytes from intensity columns
        const detectedAnalytes = detectAnalytesFromStandards(standardsData);
        console.log(`  🔍 Detected ${detectedAnalytes.length} analytes from standards data: ${detectedAnalytes.join(', ')}`);
        
        // Show quality overview for all analytes
        console.log('  🎨 Displaying analytes quality overview...');
        displayAnalytesQualityOverview(detectedAnalytes);
        
        // Show analyte buttons
        console.log('  🎨 Displaying analyte buttons...');
        displayAnalyteButtons(detectedAnalytes);
        
        showLoading(false);
        console.log('✅ Calibration data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading calibration:', error);
        console.error('  Stack:', error.stack);
        showLoading(false);
    }
}

// Display standards table (A-I) - COMPLETE DATA
function displayStandardsTable(standards) {
    console.log(`  🎨 displayStandardsTable called with ${standards.length} standards`);
    const container = document.getElementById('standards-table-container');
    if (!container) {
        console.error('  ❌ standards-table-container not found!');
        return;
    }
    
    if (standards.length === 0) {
        container.innerHTML = '<p style="color: #64748b; padding: 10px;">No standards found</p>';
        return;
    }
    
    // Get ALL columns
    const allColumns = Object.keys(standards[0] || {});
    console.log(`  📊 Standards have ${allColumns.length} total columns`);
    
    // Find label column
    let labelCol = '_standardLabel';
    if (!standards[0]._standardLabel) {
        labelCol = allColumns.find(c => {
            const lower = c.toLowerCase();
            return lower.includes('sample') || lower.includes('label') || lower.includes('id') || lower.includes('name');
        }) || allColumns[0];
    }
    
    // Categorize columns
    const intensityCols = allColumns.filter(c => {
        const lower = c.toLowerCase();
        return (lower.includes('inten') || lower.includes('cps')) && c !== labelCol && c !== '_standardLabel';
    });
    
    const concentrationCols = allColumns.filter(c => {
        const lower = c.toLowerCase();
        return (lower.includes('conc') || lower.includes('ppm') || lower.includes('ppb')) && !lower.includes('inten');
    });
    
    const otherCols = allColumns.filter(c => 
        !intensityCols.includes(c) && 
        !concentrationCols.includes(c) && 
        c !== labelCol && 
        c !== '_standardLabel'
    );
    
    console.log(`  - Intensity columns: ${intensityCols.length}`);
    console.log(`  - Concentration columns: ${concentrationCols.length}`);
    console.log(`  - Other columns: ${otherCols.length}`);
    
    // Create comprehensive table
    let html = '<div class="standards-table-wrapper">';
    html += '<h4>📋 Complete Calibration Standards Data</h4>';
    html += `<p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">`;
    html += `${standards.length} standards found (${standards.map(s => s._standardLabel || s[labelCol]).join(', ')}) • `;
    html += `${intensityCols.length} intensity measurements • ${concentrationCols.length} concentration values`;
    html += '</p>';
    
    html += '<div style="overflow-x: auto; max-height: 500px; overflow-y: auto;">';
    html += '<table class="standards-table"><thead><tr>';
    html += '<th style="position: sticky; left: 0; background: #f8fafc; z-index: 2;">Standard</th>';
    
    // Show concentration columns first
    concentrationCols.forEach(col => {
        html += `<th title="${col}">${col}</th>`;
    });
    
    // Then intensity columns (all of them)
    intensityCols.forEach(col => {
        html += `<th title="${col}">${col}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    // Display all standards
    standards.forEach(row => {
        const label = row._standardLabel || row[labelCol] || '?';
        html += '<tr>';
        html += `<td style="position: sticky; left: 0; background: white; font-weight: 700; z-index: 1;">${label}</td>`;
        
        // Concentration values
        concentrationCols.forEach(col => {
            const val = row[col];
            const formatted = formatValue(val);
            html += `<td style="font-weight: 500;">${formatted}</td>`;
        });
        
        // Intensity values
        intensityCols.forEach(col => {
            const val = row[col];
            const formatted = formatValue(val);
            html += `<td>${formatted}</td>`;
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>';
    html += '</div>';
    
    container.innerHTML = html;
    console.log(`  ✅ Displayed complete standards table: ${standards.length} rows × ${1 + concentrationCols.length + intensityCols.length} columns`);
}

// Format value for display
function formatValue(val) {
    if (val === undefined || val === null || val === '') return '-';
    if (typeof val === 'number') {
        if (val === 0) return '0';
        if (Math.abs(val) >= 1000 || Math.abs(val) < 0.01) {
            return val.toExponential(3);
        }
        return val.toFixed(4);
    }
    return String(val);
}

// Extract standards from a sheet by finding rows with A-I labels
function extractStandardsFromSheet(sheetData) {
    const standardLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const standards = [];
    
    // Find column that contains sample IDs
    const columns = Object.keys(sheetData[0] || {});
    const idColumns = columns.filter(c => {
        const lower = c.toLowerCase();
        return lower.includes('sample') || lower.includes('label') || lower.includes('id') || lower.includes('name');
    });
    
    // If no specific ID column, use first column
    const searchColumns = idColumns.length > 0 ? idColumns : [columns[0]];
    
    // Search through data for standard labels
    sheetData.forEach(row => {
        for (const col of searchColumns) {
            const value = String(row[col] || '').trim().toUpperCase();
            
            // Check if this row is a standard (A-I)
            if (standardLabels.includes(value)) {
                standards.push({
                    ...row,
                    _standardLabel: value // Mark which standard this is
                });
                break;
            }
        }
    });
    
    return standards;
}

// Find the sample ID value in a row (for debugging)
function findSampleIDValue(row) {
    const columns = Object.keys(row);
    const idColumns = columns.filter(c => {
        const lower = c.toLowerCase();
        return lower.includes('sample') || lower.includes('label') || lower.includes('id') || lower.includes('name');
    });
    
    for (const col of idColumns) {
        const val = row[col];
        if (val) return val;
    }
    return row[columns[0]]; // Fallback to first column
}

// Detect analytes from standards data (more accurate than file metadata)
function detectAnalytesFromStandards(standards) {
    if (!standards || standards.length === 0) return [];
    
    const columns = Object.keys(standards[0]);
    const analytesSet = new Set();
    const commonElements = ['Na', 'K', 'Ca', 'Mg', 'Si', 'Sr', 'Al', 'Ba', 'Fe', 'Li', 'Mn', 'S', 'Cl', 'P', 'B', 'Zn', 'Cu', 'Ni', 'Cr', 'Co'];
    
    columns.forEach(col => {
        // Look for intensity or ppm columns
        if (col.toLowerCase().includes('inten') || col.toLowerCase().includes('cps') || col.toLowerCase().includes('ppm')) {
            // Try to extract element name
            for (const element of commonElements) {
                const pattern = new RegExp(`\\b${element}\\b`, 'i');
                if (pattern.test(col)) {
                    analytesSet.add(element);
                    break;
                }
            }
        }
    });
    
    return Array.from(analytesSet).sort();
}

// Display quality overview for all analytes
function displayAnalytesQualityOverview(analytes) {
    const container = document.getElementById('analytes-overview-container');
    if (!container) return;
    
    if (analytes.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="analytes-quality-overview">';
    html += '<h4>📊 Quick Quality Overview</h4>';
    html += '<p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Click any analyte to view detailed calibration. Colors indicate best R² found for that element.</p>';
    html += '<div class="quality-grid">';
    
    // Calculate quick quality for each analyte
    analytes.forEach(analyte => {
        const intensityCols = findIntensityColumnsForAnalyte(analyte);
        let bestR2 = 0;
        let worstR2 = 1;
        
        intensityCols.forEach(col => {
            const points = extractCalibrationPoints(col);
            if (points.length >= 2) {
                const reg = calculateRegression(points);
                if (reg.rSquared > bestR2) bestR2 = reg.rSquared;
                if (reg.rSquared < worstR2) worstR2 = reg.rSquared;
            }
        });
        
        const qualityClass = bestR2 >= 0.9995 ? 'excellent' : bestR2 >= 0.999 ? 'very-good' : bestR2 >= 0.995 ? 'good' : bestR2 >= 0.99 ? 'acceptable' : 'poor';
        const warningIcon = bestR2 < 0.995 ? ' ⚠️' : '';
        
        html += `<button class="analyte-quality-button ${qualityClass}" onclick="selectAnalyteForCalibration('${analyte}')">`;
        html += `<span class="analyte-name">${analyte}${warningIcon}</span>`;
        html += `<span class="analyte-r2">R²: ${bestR2.toFixed(6)}</span>`;
        if (intensityCols.length > 1) {
            html += `<span class="analyte-count">${intensityCols.length} wavelengths</span>`;
        }
        html += '</button>';
    });
    
    html += '</div></div>';
    container.innerHTML = html;
}

// Find intensity columns for a specific analyte
function findIntensityColumnsForAnalyte(analyte) {
    if (!calibrationState.standardsData || calibrationState.standardsData.length === 0) return [];
    
    const columns = Object.keys(calibrationState.standardsData[0]);
    return columns.filter(c => {
        const lower = c.toLowerCase();
        const analyteLower = analyte.toLowerCase();
        const pattern = new RegExp(`\\b${analyteLower}\\b`, 'i');
        return pattern.test(c) && (lower.includes('inten') || lower.includes('cps') || c.match(/\d{3}/));
    });
}

// Display analyte buttons for quick access (removed - using quality overview instead)

// Display calibration for specific analyte
async function displayAnalyteCalibration(analyte) {
    if (!analyte || !calibrationState.standardsData) {
        console.log('  ⚠️ No analyte or standards data');
        return;
    }
    
    console.log(`📊 Displaying calibration for: ${analyte}`);
    
    try {
        // Auto-detect columns
        const columns = Object.keys(calibrationState.standardsData[0] || {});
        console.log(`  📊 Available columns: ${columns.join(', ')}`);
        
        // Find ALL intensity columns for this analyte (different wavelengths/views)
        const intensityCols = columns.filter(c => {
            const lower = c.toLowerCase();
            const analyteLower = analyte.toLowerCase();
            return lower.includes(analyteLower) && (lower.includes('inten') || lower.includes('cps') || c.match(/\d{3}/));
        });
        
        if (intensityCols.length === 0) {
            showMessage(`Could not find intensity column for ${analyte}. Looking for column with "${analyte}" and "Intensity" or "CPS"`, 'warning');
            console.log(`  ❌ No intensity column found for ${analyte}`);
            console.log(`  📋 Searched in: ${columns.filter(c => c.toLowerCase().includes(analyte.toLowerCase())).join(', ') || 'none'}`);
            return;
        }
        
        console.log(`  ✅ Found ${intensityCols.length} intensity column(s): ${intensityCols.join(', ')}`);
        
        // If multiple wavelengths/views, show comparison
        if (intensityCols.length > 1) {
            displayWavelengthComparison(analyte, intensityCols);
            return; // Show comparison view instead of single calibration
        }
        
        const intensityCol = intensityCols[0];
        console.log(`  ➡️ Using: ${intensityCol}`);
        
        // Try to find concentration column
        let concCol = columns.find(c => c.toLowerCase().includes('conc') || c.toLowerCase().includes('known') || c.toLowerCase().includes('ppm'));
        
        // If no concentration column, use standard dilution mapping (common in ICP-OES)
        const useStandardMapping = !concCol;
        if (useStandardMapping) {
            console.log('  ⚠️ No concentration column found, using standard dilution mapping (A=10, B=5, C=2.5, D=1, E=0.5, etc.)');
        } else {
            console.log(`  ✅ Found concentration column: ${concCol}`);
        }
        
        // Use extractCalibrationPoints function to get exact concentration-intensity pairs
        const points = extractCalibrationPoints(intensityCol);
        
        if (points.length === 0) {
            showMessage(`No valid calibration points found for ${analyte}`, 'error');
            console.log(`  ❌ No calibration points extracted`);
            return;
        }
        
        console.log(`  ✅ Extracted ${points.length} valid calibration points`);
        
        // Mark excluded standards
        points.forEach(point => {
            point.excluded = calibrationState.excludedStandards[analyte]?.has(point.index) || false;
        });
        
        if (points.length < 2) {
            showMessage(`Not enough valid points for ${analyte}`, 'warning');
            return;
        }
        
        // Calculate calibration
        const activePoints = points.filter(p => !p.excluded);
        const regression = calculateRegression(activePoints);
        
        // Store calibration
        calibrationState.calibrations[analyte] = {
            points: points,
            regression: regression,
            columns: { concCol, intensityCol, labelCol }
        };
        
        // Display results
        displayCalibrationResults(analyte, points, regression);
        
        // Show results section
        const resultsSection = document.getElementById('calib-results-section');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
    } catch (error) {
        console.error('❌ Error calculating calibration:', error);
    }
}

// Calculate linear regression
function calculateRegression(points) {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.intensity, 0);
    const sumY = points.reduce((sum, p) => sum + p.concentration, 0);
    const sumXY = points.reduce((sum, p) => sum + p.intensity * p.concentration, 0);
    const sumXX = points.reduce((sum, p) => sum + p.intensity * p.intensity, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R² and residuals
    const predicted = points.map(p => slope * p.intensity + intercept);
    const residuals = points.map((p, i) => p.concentration - predicted[i]);
    const meanConc = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.concentration - meanConc, 2), 0);
    const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
    const rSquared = 1 - (ssResidual / ssTotal);
    const rmse = Math.sqrt(ssResidual / n);
    
    return {
        slope,
        intercept,
        rSquared,
        rmse,
        nPoints: n,
        predicted,
        residuals
    };
}

// Display calibration results
function displayCalibrationResults(analyte, points, regression) {
    console.log(`  📊 Displaying results: R² = ${regression.rSquared}, RMSE = ${regression.rmse}`);
    
    // Update quality metrics with full precision
    const r2Element = document.getElementById('calib-r2');
    const rmseElement = document.getElementById('calib-rmse');
    const slopeElement = document.getElementById('calib-slope');
    const interceptElement = document.getElementById('calib-intercept');
    const pointsElement = document.getElementById('calib-points');
    
    if (r2Element) r2Element.textContent = regression.rSquared.toFixed(8); // 8 decimal places for R²
    if (rmseElement) rmseElement.textContent = regression.rmse.toExponential(4);
    if (slopeElement) slopeElement.textContent = regression.slope.toExponential(4);
    if (interceptElement) interceptElement.textContent = regression.intercept.toExponential(4);
    if (pointsElement) pointsElement.textContent = regression.nPoints + '/' + points.length;
    
    // Set R² color based on quality (with more nuanced thresholds)
    const r2Card = document.getElementById('calib-r2');
    if (r2Card && r2Card.parentElement) {
        const r2Value = regression.rSquared;
        if (r2Value >= 0.9995) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else if (r2Value >= 0.999) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #34d399, #10b981)';
        } else if (r2Value >= 0.995) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
        } else if (r2Value >= 0.99) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #fb923c, #f97316)';
        } else {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
    }
    
    // Display standards list with exclusion checkboxes
    displayStandardsList(analyte, points, regression);
    
    // Plot calibration curve
    plotCalibrationCurve(points, regression);
}

// displayStandardsList moved earlier in code

// Toggle standard inclusion
window.toggleStandard = function(analyte, index) {
    if (!calibrationState.excludedStandards[analyte]) {
        calibrationState.excludedStandards[analyte] = new Set();
    }
    
    if (calibrationState.excludedStandards[analyte].has(index)) {
        calibrationState.excludedStandards[analyte].delete(index);
        console.log(`✅ Including standard ${index} for ${analyte}`);
    } else {
        calibrationState.excludedStandards[analyte].add(index);
        console.log(`❌ Excluding standard ${index} for ${analyte}`);
    }
    
    // Automatically recalculate using the current intensity column (stay in detail view)
    if (calibrationState.currentIntensityCol) {
        displaySingleCalibration(analyte, calibrationState.currentIntensityCol);
    }
};

// Plot calibration curve
function plotCalibrationCurve(points, regression) {
    const canvas = document.getElementById('calibration-curve-canvas');
    if (!canvas) {
        console.error('  ❌ Canvas element not found!');
        return;
    }
    
    // Destroy existing chart to prevent size issues
    if (window.calibCurveChart) {
        window.calibCurveChart.destroy();
        window.calibCurveChart = null;
    }
    
    // Reset canvas size explicitly to prevent growth
    const container = canvas.parentElement;
    canvas.style.height = '400px';
    canvas.style.width = '100%';
    canvas.height = 400;
    canvas.width = container.clientWidth;
    
    const activePoints = points.filter(p => !p.excluded);
    const excludedPoints = points.filter(p => p.excluded);
    
    const datasets = [];
    
    // Active points
    if (activePoints.length > 0) {
        datasets.push({
            label: 'Included Standards',
            data: activePoints.map(p => ({ x: p.intensity, y: p.concentration })),
            backgroundColor: '#43e97b',
            borderColor: '#43e97b',
            pointRadius: 8,
            pointHoverRadius: 10
        });
    }
    
    // Excluded points
    if (excludedPoints.length > 0) {
        datasets.push({
            label: 'Excluded Standards',
            data: excludedPoints.map(p => ({ x: p.intensity, y: p.concentration })),
            backgroundColor: '#fa709a',
            borderColor: '#fa709a',
            pointRadius: 8,
            pointHoverRadius: 10,
            pointStyle: 'crossRot'
        });
    }
    
    // Fit line
    const allIntensities = points.map(p => p.intensity);
    const minX = Math.min(...allIntensities);
    const maxX = Math.max(...allIntensities);
    datasets.push({
        label: `Fit: y = ${regression.slope.toExponential(2)}x + ${regression.intercept.toExponential(2)}`,
        data: [
            { x: minX, y: regression.slope * minX + regression.intercept },
            { x: maxX, y: regression.slope * maxX + regression.intercept }
        ],
        type: 'line',
        borderColor: '#667eea',
        borderWidth: 2,
        pointRadius: 0,
        fill: false
    });
    
    window.calibCurveChart = new Chart(canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 300
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Intensity (CPS)', font: { size: 13, weight: '600' } },
                    grid: { color: '#e5e7eb' }
                },
                y: { 
                    title: { display: true, text: 'Concentration (ppm)', font: { size: 13, weight: '600' } },
                    grid: { color: '#e5e7eb' }
                }
            },
            plugins: {
                legend: { 
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
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: (context) => {
                            if (context.datasetIndex < 2) {
                                const point = context.datasetIndex === 0 ? activePoints[context.dataIndex] : excludedPoints[context.dataIndex];
                                return `${point.label}: (${context.parsed.x.toExponential(3)}, ${context.parsed.y.toExponential(3)})`;
                            }
                            return context.dataset.label;
                        }
                    }
                }
            },
            onResize: (chart, size) => {
                // Prevent vertical growth
                chart.canvas.style.height = '400px';
            }
        }
    });
    
    console.log('  ✅ Calibration curve plotted');
}

// Helper functions
function showLoading(show) {
    const indicator = document.getElementById('calib-loading');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
    }
}

function showMessage(message, type) {
    const container = document.getElementById('calib-message');
    if (container) {
        container.textContent = message;
        container.className = 'calib-message ' + (type || 'info');
        container.style.display = 'block';
        setTimeout(function() {
            container.style.display = 'none';
        }, 5000);
    }
}

// Display wavelength/view comparison for an analyte
function displayWavelengthComparison(analyte, intensityCols) {
    console.log(`  📊 Showing comparison for ${intensityCols.length} wavelengths/views`);
    
    // Parse wavelength and view info
    const wavelengthData = intensityCols.map(col => {
        const wavelengthMatch = col.match(/(\d{3})/);
        const wavelength = wavelengthMatch ? wavelengthMatch[1] + ' nm' : 'Unknown';
        const view = col.includes('Ax') || col.includes('ax') ? 'Axial' : 
                     col.includes('R') || col.includes('_r_') || col.includes(' R ') ? 'Radial' : 
                     'Unknown';
        return { column: col, wavelength, view };
    });
    
    // Calculate calibration for each
    const comparisons = [];
    wavelengthData.forEach(wData => {
        const points = extractCalibrationPoints(wData.column);
        if (points.length >= 2) {
            const regression = calculateRegression(points);
            comparisons.push({
                ...wData,
                regression,
                points
            });
        }
    });
    
    // Display comparison view
    const resultsSection = document.getElementById('calib-results-section');
    if (resultsSection) {
        resultsSection.style.display = 'block';
    }
    
    // Show comparison table
    displayComparisonTable(analyte, comparisons);
    
    // Plot all calibrations on same chart
    plotMultipleCalibrations(analyte, comparisons);
}

// Extract calibration points for a specific intensity column
function extractCalibrationPoints(intensityCol) {
    const columns = Object.keys(calibrationState.standardsData[0] || {});
    
    // Find the matching concentration column for this specific intensity column
    // The concentration column should have the same element/wavelength/view info
    // e.g., "Ba R 233.527 nm ppm" matches "Ba R 233.527 nm Intensity"
    
    let concCol = null;
    
    // Extract base name from intensity column (remove "Intensity", "CPS", etc.)
    const baseName = intensityCol
        .replace(/[_\s]?inten(sity)?/i, '')
        .replace(/[_\s]?cps/i, '')
        .replace(/[_\s]?intensity/i, '')
        .trim();
    
    console.log(`  🔍 Looking for concentration column matching: "${baseName}"`);
    
    // Find concentration column with matching base name
    concCol = columns.find(c => {
        const lower = c.toLowerCase();
        const baseNameLower = baseName.toLowerCase();
        
        // Check if column has concentration indicator (ppm, ppb, conc)
        const hasConc = lower.includes('ppm') || lower.includes('ppb') || lower.includes('conc');
        
        // Check if it matches the base name (element, wavelength, view)
        const matchesBase = baseNameLower && c.toLowerCase().includes(baseNameLower);
        
        return hasConc && matchesBase;
    });
    
    if (!concCol) {
        // Try more flexible matching - just look for same element and "ppm"
        const elementMatch = intensityCol.match(/^([A-Z][a-z]?)/);
        if (elementMatch) {
            const element = elementMatch[1];
            concCol = columns.find(c => {
                const lower = c.toLowerCase();
                return lower.includes(element.toLowerCase()) && 
                       (lower.includes('ppm') || lower.includes('ppb') || lower.includes('conc')) &&
                       !lower.includes('inten') && !lower.includes('cps');
            });
        }
    }
    
    if (!concCol) {
        console.warn(`  ⚠️ No matching concentration column found for ${intensityCol}`);
        console.warn(`  📋 Available concentration columns:`, columns.filter(c => c.toLowerCase().includes('ppm') || c.toLowerCase().includes('conc')));
        return [];
    }
    
    console.log(`  ✅ Found matching concentration column: ${concCol}`);
    
    // Extract points using the EXACT matched concentration column
    const points = [];
    calibrationState.standardsData.forEach((row, idx) => {
        const label = row._standardLabel || row[columns[0]] || `Point ${idx + 1}`;
        const conc = parseFloat(row[concCol]);
        const intensity = parseFloat(row[intensityCol]);
        
        if (!isNaN(conc) && !isNaN(intensity)) {
            points.push({ 
                index: idx, 
                label, 
                concentration: conc, 
                intensity, 
                excluded: false 
            });
        } else {
            console.log(`  ⚠️ Skipping row ${idx}: conc=${row[concCol]}, intensity=${row[intensityCol]}`);
        }
    });
    
    console.log(`  ✅ Extracted ${points.length} calibration points from ${concCol} vs ${intensityCol}`);
    
    return points;
}

// Display comparison table for different wavelengths/views
function displayComparisonTable(analyte, comparisons) {
    const container = document.getElementById('standards-list-container');
    if (!container) return;
    
    let html = '<div class="wavelength-comparison">';
    html += `<h4>🔬 ${analyte} - Wavelength & View Comparison</h4>`;
    html += '<p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Compare calibration quality across different wavelengths and detector views</p>';
    
    html += '<table class="comparison-table"><thead><tr>';
    html += '<th>Wavelength</th><th>View</th><th>R²</th><th>RMSE</th><th>Slope</th><th>Intercept</th><th>Points</th><th>Quality</th><th>Action</th>';
    html += '</tr></thead><tbody>';
    
    comparisons.forEach((comp, idx) => {
        const r2 = comp.regression.rSquared;
        const quality = r2 >= 0.9995 ? 'Excellent' : r2 >= 0.999 ? 'Very Good' : r2 >= 0.995 ? 'Good' : r2 >= 0.99 ? 'Acceptable' : 'Poor';
        const qualityColor = r2 >= 0.9995 ? '#10b981' : r2 >= 0.999 ? '#34d399' : r2 >= 0.995 ? '#fbbf24' : r2 >= 0.99 ? '#fb923c' : '#ef4444';
        const rowClass = r2 >= 0.995 ? '' : 'warning-row';
        
        html += `<tr class="${rowClass}">`;
        html += `<td><strong>${comp.wavelength}</strong></td>`;
        html += `<td><span class="view-badge">${comp.view}</span></td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${r2.toFixed(8)}</td>`;
        html += `<td>${comp.regression.rmse.toExponential(3)}</td>`;
        html += `<td>${comp.regression.slope.toExponential(3)}</td>`;
        html += `<td>${comp.regression.intercept.toExponential(3)}</td>`;
        html += `<td>${comp.regression.nPoints}/${comp.points.length}</td>`;
        html += `<td><span class="quality-indicator" style="background: ${qualityColor};">${quality}</span></td>`;
        html += `<td><button class="btn-select-wavelength" onclick="selectWavelength('${analyte}', '${comp.column}')">Use This</button></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '<div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">';
    html += '<p style="font-size: 12px; color: #64748b; font-style: italic;">💡 Tip: Select the wavelength/view with highest R² and lowest RMSE</p>';
    html += `<button class="btn-secondary" onclick="backToAnalyteSelection()">← Back to All Analytes</button>`;
    html += '</div>';
    html += '</div>';
    
    container.innerHTML = html;
    console.log(`  ✅ Displayed comparison for ${comparisons.length} wavelengths/views`);
}

// Back to analyte selection
window.backToAnalyteSelection = function() {
    console.log('  ← Returning to analyte selection');
    const resultsSection = document.getElementById('calib-results-section');
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Plot multiple calibrations on same chart
function plotMultipleCalibrations(analyte, comparisons) {
    const canvas = document.getElementById('calibration-curve-canvas');
    if (!canvas) return;
    
    if (window.calibCurveChart) {
        window.calibCurveChart.destroy();
        window.calibCurveChart = null;
    }
    
    const container = canvas.parentElement;
    canvas.style.height = '450px';
    canvas.style.width = '100%';
    canvas.height = 450;
    canvas.width = container.clientWidth;
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const datasets = [];
    
    comparisons.forEach((comp, idx) => {
        const color = colors[idx % colors.length];
        const label = `${comp.wavelength} (${comp.view}) - R²=${comp.regression.rSquared.toFixed(6)}`;
        
        // Points
        datasets.push({
            label: label,
            data: comp.points.map(p => ({ x: p.intensity, y: p.concentration })),
            backgroundColor: color,
            borderColor: color,
            pointRadius: 6,
            pointStyle: comp.view === 'Axial' ? 'circle' : 'triangle'
        });
        
        // Fit line
        const allX = comp.points.map(p => p.intensity);
        const minX = Math.min(...allX);
        const maxX = Math.max(...allX);
        datasets.push({
            label: `${comp.wavelength} fit`,
            data: [
                { x: minX, y: comp.regression.slope * minX + comp.regression.intercept },
                { x: maxX, y: comp.regression.slope * maxX + comp.regression.intercept }
            ],
            type: 'line',
            borderColor: color,
            borderWidth: 2,
            pointRadius: 0,
            borderDash: comp.view === 'Radial' ? [5, 5] : []
        });
    });
    
    window.calibCurveChart = new Chart(canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            scales: {
                x: { title: { display: true, text: 'Intensity (CPS)', font: { size: 13, weight: '600' } }, grid: { color: '#e5e7eb' } },
                y: { title: { display: true, text: 'Concentration (ppm)', font: { size: 13, weight: '600' } }, grid: { color: '#e5e7eb' } }
            },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } }
            },
            onResize: (chart) => { chart.canvas.style.height = '450px'; }
        }
    });
    
    console.log(`  ✅ Plotted ${comparisons.length} calibrations for comparison`);
}

// Select a specific wavelength to use
window.selectWavelength = function(analyte, intensityCol) {
    console.log(`  🎯 User selected: ${intensityCol} for ${analyte}`);
    
    // Show single calibration for this wavelength
    displaySingleCalibration(analyte, intensityCol);
};

// Display calibration for a specific intensity column
function displaySingleCalibration(analyte, intensityCol) {
    console.log(`📊 Displaying single calibration: ${analyte} using ${intensityCol}`);
    
    // Store current state
    calibrationState.currentAnalyte = analyte;
    calibrationState.currentIntensityCol = intensityCol;
    
    const points = extractCalibrationPoints(intensityCol);
    if (points.length < 2) {
        console.log(`  ⚠️ Not enough points for calibration`);
        return;
    }
    
    // Apply exclusions from state
    points.forEach(point => {
        if (calibrationState.excludedStandards[analyte]) {
            point.excluded = calibrationState.excludedStandards[analyte].has(point.index);
        }
    });
    
    const activePoints = points.filter(p => !p.excluded);
    if (activePoints.length < 2) {
        console.log(`  ⚠️ Not enough active points (${activePoints.length}/${points.length})`);
        return;
    }
    
    const regression = calculateRegression(activePoints);
    
    // Store this calibration
    calibrationState.calibrations[analyte] = {
        points,
        regression,
        intensityCol
    };
    
    // Update quality metrics
    updateQualityMetrics(regression, points);
    
    // Display detailed standards table with back button
    displayStandardsList(analyte, points, regression, intensityCol);
    
    // Plot single calibration
    plotSingleCalibration(points, regression);
}

// Display standards list with checkboxes (for single calibration)
function displayStandardsList(analyte, points, regression, intensityCol) {
    const container = document.getElementById('standards-list-container');
    if (!container) return;
    
    let html = '<div class="standards-list">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">';
    html += `<h4 style="margin: 0;">Standards Quality Analysis - ${intensityCol}</h4>`;
    html += `<button class="btn-secondary" onclick="displayAnalyteCalibration('${analyte}')">← Back to Comparison</button>`;
    html += '</div>';
    html += '<table class="standards-quality-table"><thead><tr>';
    html += '<th>Include</th><th>Label</th><th>Concentration</th><th>Intensity</th><th>Predicted</th><th>Residual</th><th>% Error</th>';
    html += '</tr></thead><tbody>';
    
    const activePoints = points.filter(p => !p.excluded);
    const activeIndices = activePoints.map(p => p.index);
    
    points.forEach((point, idx) => {
        const activeIdx = activeIndices.indexOf(point.index);
        const predicted = activeIdx >= 0 && regression.predicted ? 
            regression.predicted[activeIdx] : 
            (regression.slope * point.intensity + regression.intercept);
        const residual = point.excluded ? '-' : (point.concentration - predicted).toExponential(3);
        const percError = point.excluded ? '-' : (Math.abs((point.concentration - predicted) / point.concentration) * 100).toFixed(2) + '%';
        
        const rowClass = point.excluded ? 'excluded-row' : '';
        html += `<tr class="${rowClass}">`;
        html += `<td><input type="checkbox" ${point.excluded ? '' : 'checked'} onchange="toggleStandard('${analyte}', ${point.index})"></td>`;
        html += `<td><strong>${point.label}</strong></td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${point.concentration.toExponential(3)}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${point.intensity.toExponential(3)}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${point.excluded ? '-' : predicted.toExponential(3)}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${residual}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${percError}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    container.innerHTML = html;
}

// Update quality metric cards
function updateQualityMetrics(regression, points) {
    const r2Element = document.getElementById('calib-r2');
    const rmseElement = document.getElementById('calib-rmse');
    const slopeElement = document.getElementById('calib-slope');
    const interceptElement = document.getElementById('calib-intercept');
    const pointsElement = document.getElementById('calib-points');
    
    if (r2Element) r2Element.textContent = regression.rSquared.toFixed(8);
    if (rmseElement) rmseElement.textContent = regression.rmse.toExponential(4);
    if (slopeElement) slopeElement.textContent = regression.slope.toExponential(4);
    if (interceptElement) interceptElement.textContent = regression.intercept.toExponential(4);
    if (pointsElement) pointsElement.textContent = regression.nPoints + '/' + points.length;
    
    // Set R² card color
    const r2Card = document.getElementById('calib-r2');
    if (r2Card && r2Card.parentElement) {
        const r2Value = regression.rSquared;
        if (r2Value >= 0.9995) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else if (r2Value >= 0.999) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #34d399, #10b981)';
        } else if (r2Value >= 0.995) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
        } else if (r2Value >= 0.99) {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #fb923c, #f97316)';
        } else {
            r2Card.parentElement.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
    }
}

// Plot single calibration
function plotSingleCalibration(points, regression) {
    const canvas = document.getElementById('calibration-curve-canvas');
    if (!canvas) return;
    
    if (window.calibCurveChart) {
        window.calibCurveChart.destroy();
        window.calibCurveChart = null;
    }
    
    const container = canvas.parentElement;
    canvas.style.height = '400px';
    canvas.style.width = '100%';
    canvas.height = 400;
    canvas.width = container.clientWidth;
    
    const activePoints = points.filter(p => !p.excluded);
    const excludedPoints = points.filter(p => p.excluded);
    const datasets = [];
    
    if (activePoints.length > 0) {
        datasets.push({
            label: 'Included Standards',
            data: activePoints.map(p => ({ x: p.intensity, y: p.concentration })),
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            pointRadius: 7
        });
    }
    
    if (excludedPoints.length > 0) {
        datasets.push({
            label: 'Excluded',
            data: excludedPoints.map(p => ({ x: p.intensity, y: p.concentration })),
            backgroundColor: '#ef4444',
            borderColor: '#ef4444',
            pointRadius: 7,
            pointStyle: 'crossRot'
        });
    }
    
    const allX = points.map(p => p.intensity);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    datasets.push({
        label: `Fit Line`,
        data: [
            { x: minX, y: regression.slope * minX + regression.intercept },
            { x: maxX, y: regression.slope * maxX + regression.intercept }
        ],
        type: 'line',
        borderColor: '#3b82f6',
        borderWidth: 2.5,
        pointRadius: 0
    });
    
    window.calibCurveChart = new Chart(canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            scales: {
                x: { title: { display: true, text: 'Intensity (CPS)', font: { size: 13, weight: '600' } }, grid: { color: '#e5e7eb' } },
                y: { title: { display: true, text: 'Concentration (ppm)', font: { size: 13, weight: '600' } }, grid: { color: '#e5e7eb' } }
            },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12 }, padding: 15 } },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            if (context.datasetIndex < 2) {
                                const pointList = context.datasetIndex === 0 ? activePoints : excludedPoints;
                                const point = pointList[context.dataIndex];
                                return `${point.label}: (${context.parsed.x.toExponential(3)}, ${context.parsed.y.toExponential(3)})`;
                            }
                            return context.dataset.label;
                        }
                    }
                }
            },
            onResize: (chart) => { chart.canvas.style.height = '400px'; }
        }
    });
}

// Display comparison table
function displayComparisonTable(analyte, comparisons) {
    const container = document.getElementById('standards-list-container');
    if (!container) return;
    
    let html = '<div class="comparison-wrapper">';
    html += `<h4>🔬 ${analyte} - Wavelength & View Comparison</h4>`;
    html += '<p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Select the wavelength/view combination with best calibration quality</p>';
    
    html += '<table class="comparison-table"><thead><tr>';
    html += '<th>Wavelength</th><th>View</th><th>R² (8 decimals)</th><th>RMSE</th><th>Slope</th><th>Intercept</th><th>Points</th><th>Quality</th><th>Select</th>';
    html += '</tr></thead><tbody>';
    
    comparisons.forEach(comp => {
        const r2 = comp.regression.rSquared;
        const quality = r2 >= 0.9995 ? 'Excellent' : r2 >= 0.999 ? 'Very Good' : r2 >= 0.995 ? 'Good' : r2 >= 0.99 ? 'Acceptable' : 'Poor';
        const qualityColor = r2 >= 0.9995 ? '#10b981' : r2 >= 0.999 ? '#34d399' : r2 >= 0.995 ? '#fbbf24' : r2 >= 0.99 ? '#fb923c' : '#ef4444';
        const recommended = r2 === Math.max(...comparisons.map(c => c.regression.rSquared));
        
        html += `<tr ${recommended ? 'style="background: #f0fdf4; border-left: 3px solid #10b981;"' : ''}>`;
        html += `<td><strong>${comp.wavelength}</strong></td>`;
        html += `<td><span class="view-badge ${comp.view.toLowerCase()}">${comp.view}</span></td>`;
        html += `<td style="font-variant-numeric: tabular-nums; font-weight: 600;">${r2.toFixed(8)}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${comp.regression.rmse.toExponential(3)}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${comp.regression.slope.toExponential(3)}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums;">${comp.regression.intercept.toExponential(3)}</td>`;
        html += `<td>${comp.regression.nPoints}/${comp.points.length}</td>`;
        html += `<td><span class="quality-indicator" style="background: ${qualityColor}; color: white;">${quality}</span></td>`;
        html += `<td><button class="btn-select-wavelength" onclick="selectWavelength('${analyte}', '${comp.column}')">`;
        html += recommended ? '⭐ Use Best' : 'Use This';
        html += '</button></td>';
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    container.innerHTML = html;
}

// Global function for analyte button clicks
window.selectAnalyteForCalibration = function(analyte) {
    console.log(`🔬 Analyte selected via button: ${analyte}`);
    const selector = document.getElementById('calib-analyte-selector');
    if (selector) {
        selector.value = analyte;
    }
    displayAnalyteCalibration(analyte);
};

// Export calibration report
function exportCalibrationReport() {
    if (!calibrationState.currentRun || Object.keys(calibrationState.calibrations).length === 0) {
        alert('No calibration data to export');
        return;
    }
    
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet
    const summaryData = [];
    const calibs = calibrationState.calibrations;
    
    for (const analyte in calibs) {
        if (calibs.hasOwnProperty(analyte)) {
            const cal = calibs[analyte];
            const row = {
                Analyte: analyte,
                R_squared: cal.regression.rSquared,
                RMSE: cal.regression.rmse,
                Slope: cal.regression.slope,
                Intercept: cal.regression.intercept,
                Points_Used: cal.regression.nPoints,
                Points_Total: cal.points.length
            };
            summaryData.push(row);
        }
    }
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Save file
    const runName = calibrationState.currentRun.replace('.xlsx', '');
    const outputPath = path.join(__dirname, 'Calibration_Report_' + runName + '.xlsx');
    XLSX.writeFile(workbook, outputPath);
    alert('Calibration report saved: ' + outputPath);
}

// Make function globally accessible for manual testing
window.testCalibrationSetup = function() {
    console.log('🧪 Manual test triggered');
    const runSelector = document.getElementById('calib-run-selector');
    console.log('  Dropdown exists:', !!runSelector);
    console.log('  Dropdown options:', runSelector ? runSelector.options.length : 0);
    console.log('  Current value:', runSelector ? runSelector.value : 'N/A');
    
    if (runSelector) {
        console.log('  Manually calling loadRunCalibration with first option...');
        if (runSelector.options.length > 1) {
            const firstFile = runSelector.options[1].value;
            console.log(`  Loading: ${firstFile}`);
            loadRunCalibration(firstFile);
        }
    }
};

// Also make loadRunCalibration globally accessible
window.loadRunCalibration = loadRunCalibration;

console.log('='.repeat(80));
console.log('✅✅✅ CALIBRATION-ADVANCED.JS FULLY LOADED ✅✅✅');
console.log('='.repeat(80));
console.log('👉 You can test manually by running: testCalibrationSetup() in console');
console.log('👉 Or manually trigger: loadRunCalibration("filename.xlsx")');



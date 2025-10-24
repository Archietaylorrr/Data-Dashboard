const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

let loadingWindow;
let mainWindow;
let appData = null;

// Removed caching - always process fresh for robustness

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 600,
    height: 500,
    frame: false,
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  loadingWindow.loadFile('loading.html');
  loadingWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'Water Chemistry Dashboard'
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    // Close loading window
    if (loadingWindow) {
      loadingWindow.close();
      loadingWindow = null;
    }
    // Show main window
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Send progress update to loading window
function updateProgress(percent, message, details, step) {
  if (loadingWindow) {
    loadingWindow.webContents.send('loading-progress', {
      percent: percent,
      message: message,
      details: details || '',
      step: step
    });
  }
  console.log(`[${percent}%] ${message}${details ? ' - ' + details : ''}`);
}

// Cache removed - always process fresh

// Save matched results to Excel spreadsheet
function saveMatchedResultsToExcel(matches, groupedByRun) {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: All Matches
    const allMatchesData = matches.map(m => ({
      'ICP_OES_File': m.filename || '',
      'ICP_ID': m.icpID || '',
      'Main_ID': m.mainID || '',
      'Confidence_Score': m.confidence || 0,
      'Confidence_Level': m.confidence >= 0.9 ? 'High' : m.confidence >= 0.7 ? 'Medium' : 'Low',
      'Date': m.mainSample?.Date || '',
      'Sample_Type': m.mainSample?.['Sample type'] || '',
      'Traverse': m.mainSample?.Traverse_new || '',
      'Latitude': m.mainSample?.Latitude || '',
      'Longitude': m.mainSample?.Longitude || ''
    }));
    
    const allMatchesSheet = XLSX.utils.json_to_sheet(allMatchesData);
    XLSX.utils.book_append_sheet(workbook, allMatchesSheet, 'All_Matches');
    
    // Sheet 2: Summary by Run
    const summaryData = Object.entries(groupedByRun).map(([filename, data]) => ({
      'ICP_OES_File': filename,
      'Total_Samples': data.fileData?.totalSamples || 0,
      'Matched_Samples': data.matches?.length || 0,
      'Match_Rate_%': data.fileData?.totalSamples > 0 
        ? Math.round((data.matches?.length || 0) / data.fileData.totalSamples * 100) 
        : 0,
      'Available_Analytes': (data.fileData?.analytes || []).join(', '),
      'Standards_Sheet': data.fileData?.standardsSheetName || 'Not found',
      'Final_Sheet': data.fileData?.finalSheetName || ''
    }));
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary_By_Run');
    
    // Save file
    const outputPath = path.join(__dirname, 'ICP_OES_Matched_Results.xlsx');
    XLSX.writeFile(workbook, outputPath);
    console.log(`✅ Saved matched results to: ICP_OES_Matched_Results.xlsx`);
    
  } catch (error) {
    console.error('Error saving matched results:', error);
  }
}

// Initialize all data (always fresh, no caching)
async function initializeData() {
  updateProgress(0, 'Starting...', '', 1);
  
  try {
    updateProgress(10, 'Loading main data...', 'Reading MainData.xlsx', 1);
    
    // Load main data
    const mainDataPath = path.join(__dirname, 'MainData.xlsx');
    if (!fs.existsSync(mainDataPath)) {
      throw new Error('MainData.xlsx not found');
    }
    
    const mainWorkbook = XLSX.readFile(mainDataPath);
    const mainSheet = mainWorkbook.Sheets[mainWorkbook.SheetNames[0]];
    const mainData = XLSX.utils.sheet_to_json(mainSheet);
    
    updateProgress(20, 'Main data loaded', `${mainData.length} samples found`, 2);
    
    // Scan ICP-OES folder
    const icpoesPath = path.join(__dirname, 'ICP-OES');
    if (!fs.existsSync(icpoesPath)) {
      updateProgress(100, 'No ICP-OES folder', 'Continuing without ICP-OES data', 5);
      appData = { mainData, icpoesData: {}, matches: [] };
      return;
    }
    
    const icpoesFiles = fs.readdirSync(icpoesPath)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    
    updateProgress(25, 'ICP-OES files found', `${icpoesFiles.length} files detected`, 2);
    
    // Load ICP-OES files
    const icpoesData = {};
    let fileCount = 0;
    
    for (const file of icpoesFiles) {
      fileCount++;
      const progress = 25 + (fileCount / icpoesFiles.length) * 30;
      updateProgress(
        Math.round(progress),
        'Reading ICP-OES files...',
        `Loading ${file}`,
        3
      );
      
      try {
        const filepath = path.join(icpoesPath, file);
        const workbook = XLSX.readFile(filepath);
        
        const finalSheetName = autoDetectFinalSheet(workbook.SheetNames);
        const finalSheet = workbook.Sheets[finalSheetName];
        const finalData = XLSX.utils.sheet_to_json(finalSheet);
        
        const standardsSheetName = autoDetectStandardsSheet(workbook.SheetNames);
        let standardsData = null;
        if (standardsSheetName) {
          const standardsSheet = workbook.Sheets[standardsSheetName];
          standardsData = XLSX.utils.sheet_to_json(standardsSheet);
        }
        
        icpoesData[file] = {
          sheetNames: workbook.SheetNames,
          finalSheetName: finalSheetName,
          finalData: finalData,
          standardsSheetName: standardsSheetName,
          standardsData: standardsData,
          analytes: autoDetectAnalytes(finalData)
        };
        
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }
    
    updateProgress(55, 'ICP-OES data loaded', `${Object.keys(icpoesData).length} files processed`, 3);
    
    // Match samples
    updateProgress(60, 'Matching samples...', 'Using fuzzy matching algorithm', 4);
    
    const allMatches = [];
    const groupedByRun = {};
    let processedFiles = 0;
    
    for (const [filename, fileData] of Object.entries(icpoesData)) {
      processedFiles++;
      const progress = 60 + (processedFiles / Object.keys(icpoesData).length) * 30;
      updateProgress(
        Math.round(progress),
        'Matching samples...',
        `Processing ${filename}`,
        4
      );
      
      const matches = matchSamplesForFile(fileData.finalData, mainData, filename);
      
      groupedByRun[filename] = {
        matches: matches,
        fileData: {
          sheetNames: fileData.sheetNames,
          finalSheetName: fileData.finalSheetName,
          standardsSheetName: fileData.standardsSheetName,
          analytes: fileData.analytes,
          totalSamples: fileData.finalData.length,
          matchedCount: matches.length
        }
      };
      
      allMatches.push(...matches);
    }
    
    updateProgress(90, 'Matching complete', `${allMatches.length} total matches found`, 5);
    
    // Prepare final data structure (keep full data in memory)
    appData = {
      mainData: mainData,
      icpoesData: icpoesData,
      matches: allMatches,
      groupedByRun: groupedByRun
    };
    
    console.log('📊 Data prepared:');
    console.log(`  - Main data: ${mainData.length} samples`);
    console.log(`  - ICP-OES files: ${Object.keys(icpoesData).length}`);
    console.log(`  - Total matches: ${allMatches.length}`);
    console.log(`  - Grouped runs: ${Object.keys(groupedByRun).length}`);
    
    // Save matched results to Excel for review/reference
    updateProgress(95, 'Saving matched results...', 'Creating matched samples spreadsheet', 5);
    saveMatchedResultsToExcel(allMatches, groupedByRun);
    
    updateProgress(100, 'Ready!', 'Opening dashboard...', 5);
    
  } catch (error) {
    console.error('Initialization error:', error);
    if (loadingWindow) {
      loadingWindow.webContents.send('loading-error', error.message);
    }
    throw error;
  }
}

// Auto-detect functions
function autoDetectFinalSheet(sheetNames) {
  const lowerNames = sheetNames.map(s => s.toLowerCase());
  const priorities = ['final', 'samples', 'data', 'results'];
  
  for (const priority of priorities) {
    const index = lowerNames.findIndex(s => s.includes(priority));
    if (index >= 0) return sheetNames[index];
  }
  
  return sheetNames[sheetNames.length - 1];
}

function autoDetectStandardsSheet(sheetNames) {
  const lowerNames = sheetNames.map(s => s.toLowerCase());
  const keywords = ['standard', 'std', 'calib', 'cal'];
  
  for (const keyword of keywords) {
    const index = lowerNames.findIndex(s => s.includes(keyword));
    if (index >= 0) return sheetNames[index];
  }
  
  if (sheetNames.length === 2) return sheetNames[0];
  return null;
}

function autoDetectAnalytes(data) {
  if (!data || data.length === 0) return [];
  
  const columns = Object.keys(data[0]);
  const analytes = new Set();
  const elements = ['Na', 'K', 'Ca', 'Mg', 'Si', 'Sr', 'Al', 'Ba', 'Fe', 'Li', 'Mn', 'S', 'Cl'];
  
  columns.forEach(col => {
    for (const element of elements) {
      const upper = col.toUpperCase();
      const elem = element.toUpperCase();
      
      if (upper.includes(elem) && (upper.includes('INTEN') || upper.includes('CPS') || upper.includes('_') || upper.match(/\d{3}/))) {
        analytes.add(element);
      }
    }
  });
  
  return Array.from(analytes).sort();
}

// Match samples for a file
function matchSamplesForFile(icpData, mainData, filename) {
  const matches = [];
  const icpSampleColumns = findSampleIDColumns(icpData);
  
  icpData.forEach((icpRow, index) => {
    for (const col of icpSampleColumns) {
      const icpID = String(icpRow[col] || '').trim();
      if (!icpID || icpID.length < 2) continue;

      const bestMatch = findBestMatch(icpID, mainData);
      if (bestMatch && bestMatch.score > 0.6) {
        const mainSample = mainData.find(row => row['Sample ID'] === bestMatch.id);
        
        matches.push({
          filename: filename,
          icpID: icpID,
          mainID: bestMatch.id,
          confidence: bestMatch.score,
          icpRowIndex: index,
          mainSample: mainSample
        });
        break;
      }
    }
  });
  
  return matches;
}

function findSampleIDColumns(data) {
  if (!data || data.length === 0) return [];
  
  const columns = Object.keys(data[0]);
  const sampleKeywords = ['sample', 'id', 'name', 'label'];
  
  const candidates = columns.filter(col => {
    const lower = col.toLowerCase();
    return sampleKeywords.some(keyword => lower.includes(keyword));
  });
  
  return candidates.length > 0 ? candidates : [columns[0]];
}

function findBestMatch(icpID, mainData) {
  const normalized = normalizeID(icpID);
  let bestScore = 0;
  let bestMatch = null;

  mainData.forEach(row => {
    const mainID = String(row['Sample ID'] || '').trim();
    if (!mainID) return;

    const score = similarityScore(normalized, normalizeID(mainID));
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { id: mainID, score: score };
    }
  });

  return bestMatch;
}

function normalizeID(id) {
  return id.toLowerCase()
    .replace(/[-_\s]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function similarityScore(str1, str2) {
  if (str1 === str2) return 1.0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  if (longer.includes(shorter)) {
    return 0.8 + (shorter.length / longer.length) * 0.2;
  }
  
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
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// IPC handlers
ipcMain.handle('get-app-data', () => {
  console.log('📡 IPC: get-app-data requested');
  if (!appData) {
    console.error('❌ IPC: appData is null!');
    return null;
  }
  console.log(`✅ IPC: Sending data with ${Object.keys(appData.groupedByRun || {}).length} runs`);
  return appData;
});

// App lifecycle
app.on('ready', async () => {
  createLoadingWindow();
  
  // Wait a moment for window to render
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    await initializeData();
    
    // Wait a moment to show completion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (loadingWindow) {
      loadingWindow.webContents.send('loading-complete');
    }
    
    // Wait another moment before showing main window
    await new Promise(resolve => setTimeout(resolve, 500));
    
    createMainWindow();
  } catch (error) {
    console.error('Failed to initialize:', error);
    if (loadingWindow) {
      loadingWindow.webContents.send('loading-error', error.message);
    }
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    app.emit('ready');
  }
});

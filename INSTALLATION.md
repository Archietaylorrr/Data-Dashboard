# Installation & Setup

## System Requirements

- **Windows 10 or later**
- **Node.js 14.0 or higher** (download from https://nodejs.org/)
- **~500MB free disk space** (for Node.js and dependencies)
- **ICP-OES data files** in Excel format (.xlsx)

---

## First-Time Setup

### Step 1: Install Node.js

1. Download Node.js LTS from https://nodejs.org/
2. Run the installer (accept all defaults)
3. **Restart your computer** after installation

### Step 2: Prepare Your Data

Ensure your folder structure looks like this:

```
Data Dashboard 3.0/
├── MainData.xlsx          ← Your main water chemistry data
├── ICP-OES/               ← Create this folder
│   ├── file1.xlsx
│   ├── file2.xlsx
│   └── ...                ← Put all ICP-OES Excel files here
├── launch.bat             ← Launch script
└── ...other files
```

### Step 3: Launch the Application

1. **Double-click `launch.bat`**
2. First launch will:
   - Install dependencies (~2-5 minutes)
   - Load and match all data
   - Create cache file
3. Loading window will show progress
4. Dashboard opens when ready!

---

## What Happens on First Launch

### 1. Dependency Installation

```
Installing dependencies...
This may take a few minutes on first launch.
```

- Downloads Electron, XLSX parser, Chart.js
- Only happens once

### 2. Loading & Caching

```
💧 Water Chemistry Dashboard
Initializing your data...

✓ Loading main data
✓ Scanning ICP-OES files  
✓ Reading ICP-OES data
✓ Matching samples
✓ Finalizing
```

- Reads MainData.xlsx
- Scans ICP-OES folder (finds all .xlsx files)
- Loads each ICP-OES file
- Fuzzy matches sample IDs
- **Saves cache** for fast future launches

### 3. Cache File Created

`data-cache.json` is created automatically containing:

- All matched sample pairs
- ICP-OES file metadata
- Detected analytes per run

---

## Subsequent Launches

### Normal Launch (Data Unchanged)

- Loads from cache instantly
- Opens in 2-5 seconds
- No re-matching needed

### Auto-Refresh (Data Changed)

Cache automatically refreshes if:

- MainData.xlsx is modified
- Any ICP-OES file is added/modified
- Cache file is deleted

You'll see the loading screen again while data is re-matched.

---

## Cache Management

### Cache Location

`Data Dashboard 3.0/data-cache.json`

### When Cache Refreshes

- Modified MainData.xlsx
- Modified ICP-OES files
- New ICP-OES files added
- Cache file deleted

### Manual Cache Refresh

To force a re-match:

1. Delete `data-cache.json`
2. Restart the app

**Why refresh?**

- Sample IDs changed
- Want to verify matches
- Troubleshooting issues

---

## Troubleshooting First Launch

### "Node.js is not installed"

**Solution:**

1. Install Node.js from https://nodejs.org/
2. **Restart computer**
3. Run `launch.bat` again

### "npm install failed"

**Solution:**

1. Check internet connection
2. Delete `node_modules` folder
3. Run `launch.bat` again

### Loading window stuck

**Solution:**

1. Wait 1-2 minutes (large datasets take time)
2. Press F12 to see console errors
3. Check that MainData.xlsx exists
4. Check that ICP-OES folder exists

### "MainData.xlsx not found"

**Solution:**

- Ensure `MainData.xlsx` is in the root folder
- Check file name spelling (case-sensitive)
- File must be `.xlsx` format

### "No ICP-OES files found"

**Solution:**

- Create `ICP-OES` folder in root
- Add your Excel files to this folder
- Files must be `.xlsx` or `.xls` format

### GPU process errors (harmless)

If you see GPU errors in console:

```
GPU process exited unexpectedly
```

**This is normal** - these are warnings, not errors. The app works fine with software rendering.

---

## Performance Tips

### Fast Launches

- Keep cache file (`data-cache.json`)
- Don't modify data files unnecessarily
- Close app when not in use

### Large Datasets

If you have many ICP-OES files (20+):

- First launch may take 30-60 seconds
- Subsequent launches still fast (cache)
- Consider splitting into project folders

### Disk Space

- App: ~10-50 MB
- Node modules: ~300-400 MB
- Cache: ~1-10 MB (depends on data size)
- **Total: ~500 MB**

---

## Updating the Application

### If you receive new files

1. Copy new files to appropriate folders
2. Launch app normally
3. Cache auto-refreshes with new data

### If code is updated

1. Replace files (keep data files)
2. Delete `node_modules` folder
3. Delete `package-lock.json`
4. Run `launch.bat` (reinstalls dependencies)

---

## Uninstallation

To remove the application:

1. Delete the entire `Data Dashboard 3.0` folder
2. Optionally uninstall Node.js (if not needed for other apps)

**Note:** Keep backups of:

- MainData.xlsx
- ICP-OES folder
- Any exported CSV files

---

## Advanced: Command Line Usage

For power users:

### Install dependencies manually

```bash
npm install
```

### Launch without batch file

```bash
npm start
```

### Clear cache and restart

```bash
del data-cache.json
npm start
```

### Force reinstall

```bash
rmdir /s /q node_modules
del package-lock.json
npm install
npm start
```

---

## File Checklist

Before launching, verify these files exist:

**Required:**

- [X] MainData.xlsx (root folder)
- [X] launch.bat (root folder)
- [X] package.json (root folder)
- [X] main.js (root folder)
- [X] index.html (root folder)
- [X] loading.html (root folder)
- [X] app.js (root folder)
- [X] calibration.js (root folder)
- [X] styles.css (root folder)

**Optional but recommended:**

- [X] ICP-OES/ folder with Excel files
- [X] README.md
- [X] QUICK_START.md

**Generated on first launch:**

- [ ] node_modules/ folder
- [ ] package-lock.json
- [ ] data-cache.json

---

## Getting Help

### Check Console Output

Press **F12** in the app to see detailed logs:

- File loading progress
- Match statistics
- Error messages
- Debugging info

### Check Terminal Output

The PowerShell window shows:

- Installation progress
- Loading status
- Error messages
- Cache operations

### Common Solutions

1. **Delete cache and retry**
2. **Reinstall dependencies**
3. **Check file names and locations**
4. **Restart computer** (if Node.js just installed)

---

## Success Indicators

You'll know everything works when:

- ✅ Loading window shows progress smoothly
- ✅ Main window opens with data
- ✅ Status bar shows: "X samples | Y runs | Z matches"
- ✅ "By ICP-OES Run" tab shows grouped data
- ✅ Calibration tab loads analyte dropdowns

---

**Ready to get started?** Just double-click `launch.bat`!

**Version**: 3.0
**Platform**: Windows Desktop (Electron)
**License**: For academic/research use

# Water Chemistry Dashboard

A desktop application for water chemistry data analysis with integrated ICP-OES calibration tools.

## Features

### Analytics Dashboard
- Summary statistics and data overview
- Interactive charts for sample distribution and pH analysis
- Chemical parameters and isotope data summaries
- Custom scatter plots with real-time filtering

### Data Management
- Browse complete dataset in spreadsheet interface
- Search and filter functionality
- CSV export capabilities
- 33 specialized columns for water chemistry analysis

### ICP-OES Analysis and Calibration
- Automatic sample matching across multiple instrument runs
- Fuzzy ID matching algorithm for handling sample name variations
- Calibration standards extraction from raw ICP-OES data
- Quality assessment with R-squared indicators
- Wavelength and detector view comparison (Axial vs Radial)
- Interactive calibration refinement
- High-precision R-squared calculations (8 decimal places)
- Exportable calibration reports

### Data Import System
- Four-step wizard for importing new ICP-OES data
- Automatic sample ID matching with confidence scoring
- Intelligent column mapping between import and master data
- Preview functionality before applying changes
- Automatic backup creation before data modification
- Support for new analytes and existing data updates

## Requirements

- Node.js 14.0 or higher
- Windows 10 or later
- Approximately 500MB free disk space

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Place your MainData.xlsx file in the root directory
4. Create an ICP-OES folder and add ICP-OES Excel files
5. Launch: Double-click `launch.bat` or run `npm start`

First launch takes 2-5 minutes for dependency installation. Subsequent launches take 2-5 seconds.

## Data Format

### MainData.xlsx Structure

Required columns include:
- Sample ID, Date, Sample type, Traverse_new
- Geographic: Latitude, Longitude, Elevation
- Field parameters: Temperature, pH, TDS, Alkalinity
- Isotopes: Sr87/Sr86, d88Sr, d7Li, d13C DIC, d17O, d18O, d2H, d-excess
- Chemical concentrations: Na, K, Ca, Mg, Si, Sr, Al, Ba, Fe, Mn, Li, Cl, SO4, S

### ICP-OES Files
- Excel format (.xlsx or .xls)
- Calibration standards labeled A through I
- Intensity and concentration columns for each analyte
- Sample IDs matching or similar to MainData.xlsx format

## Usage

### Dashboard
View analytics summary and create custom plots with filtering options.

### All Data
Browse the complete dataset in table format with search and export functionality.

### ICP-OES Analysis
Review calibration quality, compare wavelengths and detector views, and refine calibrations by excluding outlier standards.

### Import Data
Add new ICP-OES measurements through a guided four-step process with automatic sample matching and column mapping.

## Technical Details

- Platform: Electron desktop application
- Data processing: xlsx library for Excel file handling
- Visualization: Chart.js for interactive charts
- Architecture: Fully local processing, no server required
- Data loading: Automatic sample matching and calibration extraction on startup

## Calibration Features

### Quality Control
- Automatic detection of calibration standards in raw data
- Comparison across multiple wavelengths
- Axial vs Radial detector view analysis
- Interactive exclusion of problematic standards
- Real-time quality metric updates
- R-squared precision to 8 decimal places

### Column Matching
- Exact pairing of concentration and intensity columns by wavelength and view
- Example: "Ba R 233.527 nm ppm" paired with "Ba R 233.527 nm Intensity"
- No data manipulation or assumptions
- Transparent matching logic with console logging

## Troubleshooting

**Node.js not installed:** Download from nodejs.org and install the LTS version.

**Loading delays:** First launch processes all ICP-OES files. Subsequent launches use optimized data structures.

**No ICP-OES data:** Verify the ICP-OES folder exists with Excel files in the root directory.

**Import failures:** Ensure MainData.xlsx is not open in Excel during import operations.

## Development

Built with vanilla JavaScript, HTML, and CSS for maximum compatibility and maintainability. Uses Electron for cross-platform desktop deployment.

## License

MIT License - Free for academic and research use

## Citation

If used in research publications:

```
Water Chemistry Dashboard v3.0
Desktop application for water chemistry data analysis and ICP-OES calibration
GitHub: https://github.com/YOUR_USERNAME/water-chemistry-dashboard
```

## Version

Version 3.0 - Production release for water chemistry research applications

## Contact

For issues, check the browser console (F12) for detailed logging, or consult INSTALLATION.md for setup guidance.


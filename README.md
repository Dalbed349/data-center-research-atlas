# AI Data Center Intelligence Dashboard

An interactive Next.js dashboard built to track, visualize, and analyze global and US-based AI infrastructure and data center footprints.

## Features
- **Global & US Interactive Maps**: Visualizes global data center distribution and deep-dives into US expansions using custom D3 and React-Leaflet projections.
- **Analytics & Filtering**: Dynamically sort and filter monitored research nodes by aggregate compute capacity (H100 equivalents), estimated capital cost, power draw (MW), and ownership.
- **Timeline & Calculations Integration**: Inline viewer that renders exact calculation sheets and timeline metadata directly alongside the visualizer.
- **Year-over-Year Tracking**: Easily toggle between 2025 and 2026 data to identify new footprint additions and analyze state-by-state expansion.

## Tech Stack
- **Frontend**: Next.js (App Router), React 19
- **Mapping**: D3.js (geoAlbersUsa projections), React-Leaflet (Esri World Imagery overlays), TopoJSON
- **Data Parsing**: PapaParse (CSV processing)
- **Styling**: Tailwind CSS & custom glassmorphism UI

## Data Sources & Citations

This dashboard relies on two primary open-source datasets to populate its map layers and analytics panels:

1. **IM3 Projected US Data Center Locations** (Projected Map Source)
   Mongird, K., Burleyson, C., Akdemir, K. Z., Thurber, T., Vernon, C., & Rice, J. (2025). *IM3 Projected US Data Center Locations (Version v1)* [Data set]. MSD-LIVE Data Repository. 
   [https://doi.org/10.57931/2571680](https://doi.org/10.57931/2571680)

2. **Open Calculations Model** (Analytics & Global Sources)
   Original research dataset (`data_centers.csv`). Compiled and continuously updated by project contributors. 
   *(Accessed May 2026).*

## Getting Started

To run the visualizer locally:

```bash
cd visualizer
npm install
npm run dev
```

The application will spin up at `http://localhost:3000`.
# ZOA Center and Tracon Airspace Visualizer

A web-based visualization tool for Oakland Center (ZOA) and TRACON airspace, built with SolidJS, Mapbox GL, and TailwindCSS.

## Overview

This application provides an interactive visualization of the Oakland Center (ZOA) and TRACON airspace, allowing users to explore and understand the airspace structure.

This application combines the Oakland Center (ZOA) and TRACON airspace visualizers into a single application. Base repositories:

- [ZOA Visualizer](https://github.com/vzoa/ZoaVisualizer)
- [ZOA NCT Visualizer](https://github.com/vzoa/NctVisualizer)

## Features

- Interactive map visualization using Mapbox GL
- Airspace sector display
- SolidJS-powered interface with TailwindCSS styling

## Installation

```bash
pnpm install
```

## Usage

### Development

Start the development server:

```bash
pnpm run dev
# or
pnpm start
```

This will launch the application in development mode.

### Building for Production

```bash
pnpm run build
```

This creates a production-ready build in the `dist` directory.

### Previewing the Production Build

```bash
pnpm run serve
```

## Technologies

- [SolidJS](https://solidjs.com) - UI framework
- [Vite](https://vitejs.dev) - Build tool
- [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/api/) - Map visualization
- [TailwindCSS](https://tailwindcss.com) - Styling

## License

MIT

## Authors

- Ken Greim
- Philippe Dellaert

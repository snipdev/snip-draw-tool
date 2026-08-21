# Snip Draw Tool

A lightweight **candlestick chart annotation tool** built with Electron. Draw trade setups on a chart grid and export the result as PNG — perfect for marking long/short ideas before sharing them.

## Features

- Grid chart canvas with pan, dark + light themes
- Tools: pointer/select (V), candle (C), line (L), arrow (A), rectangle (R), text (T), freehand pencil (P), **long position**, **short position**, eraser (E)
- Select, resize (handles), delete, keyboard shortcuts
- Undo / redo (50-step history)
- Export canvas as PNG
- Windows portable build (`electron-builder`)

## Run

```bash
npm install
npm start          # run
npm run dev        # run with --dev
npm run dist       # build portable exe (dist/)
```

## Structure

```
main.js                  # Electron main process
preload.js               # contextBridge (platform only)
renderer/
  index.html             # UI + toolbar
  app.js                 # app state, events, render loop
  tools.js               # tool behaviors
  chart.js               # grid/chart renderer
  state.js               # shared state
  styles.css             # dark theme
```

## Build

`npm run dist` produces `dist/Snip Draw Tool 1.1.1.exe` (portable).

## License

MIT
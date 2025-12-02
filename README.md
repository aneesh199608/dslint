## DSLint: Color Token Checker

Minimal Figma plugin that inspects the current selection and reports if the fill is bound to a color variable.

### Development
- Install dependencies: `npm install`
- Build once: `npm run build` (outputs to `dist/`)
- Watch for changes: `npm run watch`

### Load in Figma
- In Figma: `Plugins → Development → Import plugin from manifest...`
- Choose `manifest.json` from this repo root.
- Run the plugin from `Plugins → Development` and select a single node to inspect.

### Notes
- Handles a single selection with a solid fill; shows whether a color variable is bound.
- UI messaging lives in `src/ui.html`; plugin logic lives in `src/code.ts`.

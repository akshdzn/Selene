import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Mobile Phone Compatibility & Responsiveness...');

const appCss = fs.readFileSync(path.resolve('src/app.css'), 'utf-8');
const appSvelte = fs.readFileSync(path.resolve('src/App.svelte'), 'utf-8');
const hudSvelte = fs.readFileSync(path.resolve('src/lib/LunarCoordsHUD.svelte'), 'utf-8');
const datePickerSvelte = fs.readFileSync(path.resolve('src/lib/DatePicker.svelte'), 'utf-8');
const timelineSvelte = fs.readFileSync(path.resolve('src/lib/Timeline.svelte'), 'utf-8');
const globeSvelte = fs.readFileSync(path.resolve('src/lib/Globe.svelte'), 'utf-8');
const exportModalSvelte = fs.readFileSync(path.resolve('src/lib/ExportModal.svelte'), 'utf-8');
const landingSvelte = fs.readFileSync(path.resolve('src/lib/landing.svelte'), 'utf-8');

// 1. Global Viewport & Container
assert.ok(appCss.includes('height: 100dvh;'), 'app.css must define 100dvh for mobile dynamic toolbars');
assert.ok(appCss.includes('-webkit-text-size-adjust: 100%;'), 'app.css must prevent automatic font scaling');
assert.ok(appSvelte.includes('height: 100dvh;'), 'App.svelte viewport must use 100dvh');
console.log('✔ Global viewport (100dvh) and font-scaling rules verified.');

// 2. Date Pickers Mobile Responsive Layout
assert.ok(appSvelte.includes('@media (max-width: 768px) and (orientation: portrait)'), 'App.svelte must have portrait mobile query');
assert.ok(appSvelte.includes('top: 92px;'), 'Portrait mobile date pickers must sit at top: 92px below HUD');
assert.ok(appSvelte.includes('calc(50vw - 14px)'), 'Compare sample card width must be responsive on mobile portrait');
console.log('✔ Date picker placement in portrait mobile mode verified (unobstructed central Moon).');

// 3. LunarCoordsHUD Mobile Fluid Sizing
assert.ok(hudSvelte.includes('width: min(423px, calc(100vw - 20px));'), 'HUD container must be fluid with max-width');
assert.ok(!hudSvelte.includes('.lunar-hud-box {\n    width: 423px;'), 'HUD box must not have rigid 423px width');
assert.ok(!hudSvelte.includes('.telemetry-dropdown {\n    width: 423px;'), 'HUD dropdown must not have rigid 423px width');
assert.ok(hudSvelte.includes('clamp(16px, 4.8vw, 24px)'), 'Coord value font size must be fluid clamp');
assert.ok(hudSvelte.includes('max-width: calc(100vw - 32px);'), 'Combobox content portal must not overflow viewport');
assert.ok(hudSvelte.includes('max-height: calc(100dvh - 140px);'), 'Dropdown must contain scrolling on mobile');
console.log('✔ LunarCoordsHUD fluid container, typography clamp, and combobox portal verified.');

// 4. DatePicker Component
assert.ok(datePickerSvelte.includes('max-width: calc(100vw - 20px);'), 'Calendar popover must have responsive max-width');
assert.ok(datePickerSvelte.includes('@media (max-width: 768px)'), 'DatePicker must include mobile breakpoint');
console.log('✔ DatePicker component mobile constraints verified.');

// 5. Timeline Playhead & Mobile Track
assert.ok(timelineSvelte.includes('@media (hover: none)'), 'Timeline must handle touch devices without hover');
assert.ok(timelineSvelte.includes('width: calc(100vw - 16px);'), 'Timeline must widen to full width on mobile screens');
assert.ok(timelineSvelte.includes('max(8px, env(safe-area-inset-bottom))'), 'Timeline must respect bottom safe-area insets');
console.log('✔ Timeline playhead touch visibility and full mobile width verified.');

// 6. 3D Globe Touch & Tap Sensitivity
assert.ok(globeSvelte.includes('dist > 12'), 'Globe onClick tap tolerance must be at least 12px for mobile touch');
assert.ok(globeSvelte.includes('Math.min(160, Math.max(20'), 'Hover box margin must dynamically adjust to screen width');
console.log('✔ 3D Globe mobile touch tap sensitivity and hover bounding verified.');

// 7. Export Modal
assert.ok(exportModalSvelte.includes('@media (max-width: 640px)'), 'ExportModal must have mobile breakpoint');
assert.ok(exportModalSvelte.includes('max-width: calc(100vw - 16px);'), 'Export dialog must fit small screens');
assert.ok(exportModalSvelte.includes('grid-template-columns: 1fr 1fr;'), 'Export date controls must use 2 columns on mobile');
console.log('✔ ExportModal mobile padding, 2-column grid, and dialog constraints verified.');

// 8. Landing Screen Touch Hint
assert.ok(landingSvelte.includes('hint-mobile'), 'Landing screen must include mobile touch hint');
assert.ok(landingSvelte.includes('Touch to rotate'), 'Landing screen mobile touch instruction verified');
console.log('✔ Landing screen touch hint and mobile controls verified.');

console.log('\nALL MOBILE RESPONSIVENESS AND TOUCH CHECKS PASSED SUCCESSFULLY!');

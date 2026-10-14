/**
 * Shared brand styles injected into every Decap CMS live-preview iframe
 * (via `CMS.registerPreviewStyle`), so the editing experience visually
 * matches the real Slow Dough site.
 */
export const PREVIEW_CSS = `
  body { background:#faf8f5; color:#24211e; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; }
  h1,h2,h3,h4,.font-serif { font-family: Georgia, 'Times New Roman', serif; }
  .sd-banner { background:#24211e; color:#e8ded3; font-size:12px; padding:8px 14px; border-radius:8px; display:inline-flex; gap:8px; align-items:center; margin-bottom: 16px; }
  .sd-dot { width:8px; height:8px; border-radius:50%; background:#c85a32; display:inline-block; }
  .sd-eyebrow { display:inline-block; font-size:11px; text-transform:uppercase; letter-spacing: .14em; font-weight:700; color:#8a4224; background:#f0e7dc; border:1px solid #ded2c3; border-radius:999px; padding:6px 12px; margin-bottom:10px; }
  .sd-card { background:#faf7f2; border:1px solid #e5dcce; border-radius:14px; padding:20px; margin:14px 0; }
  .sd-price { float:right; font-weight:700; }
  .sd-tag { display:inline-block; font-size:11px; background:#eee7dd; color:#63574c; border-radius:6px; padding:2px 8px; margin:4px 6px 0 0; }
  .sd-meta { font-size:12px; color:#75685c; margin-bottom: 6px; }
  .sd-quote { border-left:3px solid #c85a32; background:rgba(244,236,224,.6); padding:14px 18px; font-style:italic; margin: 16px 0; }
  .sd-closed { color:#9c5332; font-family: monospace; text-transform:uppercase; font-size:12px; }
`;

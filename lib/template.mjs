// Assemble the printable HTML document: doocs theme CSS + export layout + @page rules.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const read = p => fs.readFileSync(p, 'utf8')

// doocs export extras (apps/web/src/services/export/apply-export-layout.ts EXPORT_LAYOUT_RULES)
const EXPORT_LAYOUT_CSS = `
section:has(> table.preview-table) { overflow: visible !important; }
table.preview-table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
table.preview-table th, table.preview-table td { word-break: break-word !important; white-space: normal !important; overflow-wrap: anywhere !important; }
section[style*="overflow: auto"] { overflow: visible !important; }
pre.code__pre, .hljs.code__pre, pre.code__pre > code, .hljs.code__pre > code { overflow: visible !important; }
pre.code__pre > code { white-space: pre-wrap !important; word-break: break-all !important; min-width: auto !important; max-width: 100% !important; }
.katex-block, .katex-inline { overflow: visible !important; }
`

/** "{n}/{m}" -> CSS content value. */
function pageNumberContent(format) {
  return format.split(/(\{n\}|\{m\})/).filter(Boolean).map((part) => {
    if (part === '{n}') return 'counter(page)'
    if (part === '{m}') return 'counter(pages)'
    return JSON.stringify(part)
  }).join(' ')
}

function pageCss(cfg) {
  const pn = cfg.pageNumber
  const footer = pn.enabled
    ? `
  @bottom-center {
    content: ${pageNumberContent(pn.format)};
    color: ${pn.color};
    font-size: ${pn.fontSize};
    font-family: ${cfg.theme.fontFamily};
    vertical-align: top;
    padding-top: ${pn.gap};
  }`
    : ''
  return `@page {
  size: ${cfg.page.size};
  margin: ${cfg.page.margin};${footer}
}
html, body { margin: 0; }`
}

export function buildHtml({ bodyHtml, title, cfg, baseHref }) {
  const t = cfg.theme
  const cssVars = `:root {
  --foreground: 0 0% 3.9%;
  --blockquote-background: #f7f7f7;
  --md-primary-color: ${t.primaryColor};
  --md-font-family: ${t.fontFamily};
  --md-font-size: ${t.fontSize};
  --md-line-height: ${t.lineHeight};
  --md-block-spacing: ${t.blockSpacing};
  --md-link-color: ${t.linkColor};
}
section.container p { ${t.indent ? 'text-indent: 2em;' : ''} ${t.justify ? 'text-align: justify;' : ''} }`

  const hljsCss = read(require.resolve(`highlight.js/styles/${cfg.codeTheme}.css`))
  const custom = cfg.customCssFile && fs.existsSync(cfg.customCssFile) ? read(cfg.customCssFile) : ''
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
${baseHref ? `<base href="${baseHref}">` : ''}
<style>${cssVars}</style>
<style>${hljsCss}</style>
<style>${read(path.join(ROOT, 'themes/doocs-base.css'))}</style>
<style>${read(path.join(ROOT, 'themes', `doocs-${cfg.theme.name}.css`))}</style>
<style>${EXPORT_LAYOUT_CSS}</style>
<style>
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
${pageCss(cfg)}
${custom}
</style>
</head>
<body>
<div style="width: 100%; max-width: ${cfg.contentWidth}; margin: auto;">
${bodyHtml}
</div>
</body>
</html>`
}

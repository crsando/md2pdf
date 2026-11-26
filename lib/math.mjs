// MathJax (TeX -> SVG) rendering in Node, mirroring doocs/md's browser output
// (packages/core/src/extensions/katex.ts) but fully offline.
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'

export function createMathRenderer({ macrosSource = '', tags = 'none' } = {}) {
  const adaptor = liteAdaptor()
  RegisterHTMLHandler(adaptor)

  let current = null // formula being rendered, for error attribution
  const errors = []

  const tex = new TeX({
    packages: AllPackages.filter(p => p !== 'bussproofs'),
    tags,
    formatError(jax, err) {
      if (current)
        errors.push({ ...current, message: err.message })
      return jax.formatError(err)
    },
  })
  const svg = new SVG({ fontCache: 'local' })
  const doc = mathjax.document('', { InputJax: tex, OutputJax: svg })

  function toSvg(latex, display) {
    const node = doc.convert(latex, { display, em: 16, ex: 8, containerWidth: 80 * 16 })
    let html = adaptor.innerHTML(node) // the <svg> inside <mjx-container>
    // Same tweaks doocs applies: width attr -> style, follow text color.
    const width = /<svg[^>]*?\swidth="([^"]+)"/.exec(html)?.[1] ?? ''
    html = html.replace(/(<svg[^>]*?)\swidth="[^"]+"/, '$1')
    html = html.replace(/<svg([^>]*?)style="([^"]*)"/, (_, a, s) =>
      `<svg${a}style="${s} display: initial; max-width: 300vw !important; flex-shrink: 0; width: ${width};"`)
    html = html.replace(/<g /, '<g fill="currentColor" stroke="currentColor" style="fill: currentColor; stroke: currentColor;" ')
    return html
  }

  // Load user macros once (\newcommand definitions persist across formulas).
  if (macrosSource.trim()) {
    current = { line: 0, raw: 'macros.tex' }
    toSvg(macrosSource, false)
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

  return {
    errors,
    render(latex, display, raw, line) {
      current = { line, raw: raw ?? latex }
      const before = errors.length
      let out = toSvg(latex, display)
      current = null
      const rawAttr = esc(raw ?? latex)
      if (errors.length > before) // show the source in red instead of MathJax's error box
        out = `<span class="math-error" title="${esc(errors.at(-1).message)}" style="color:#e5534b;font-family:monospace;border-bottom:1px dashed #e5534b;">${esc(raw ?? latex)}</span>`
      return display
        ? `<section class="katex-block" data-math-display="true" data-math-raw="${rawAttr}">${out}</section>`
        : `<span class="katex-inline" data-math-display="false" data-math-raw="${rawAttr}">${out}</span>`
    },
  }
}

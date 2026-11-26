// Markdown -> HTML, mirroring doocs/md's renderer (packages/core/src/renderer/renderer-impl.ts):
// marked with breaks:true, doocs math tokenizer rules (nonStandard), GFM alerts, doocs class names.
import { Marked } from 'marked'
import hljs from 'highlight.js'
import * as yaml from 'js-yaml'
import {
  blockLatexRule,
  inlineLatexRule,
  inlineRuleNonStandard,
  findInlineKatexStart,
  matchBlockKatex,
} from '../vendor/mathDetection.ts'
import { markedAlert } from '../vendor/alert.ts'
import { blockScanLimit, findIndentedLineStart } from '../vendor/scan.ts'
import { createMathRenderer } from './math.mjs'

const PAGEBREAK = '<div style="page-break-after: always;"></div>'

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Split optional YAML front matter. */
export function parseFrontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src)
  if (!m)
    return { data: {}, body: src, offsetLines: 0 }
  let data = {}
  try { data = yaml.load(m[1]) || {} }
  catch (e) { console.warn(`front matter 解析失败：${e.message}`) }
  return { data, body: src.slice(m[0].length), offsetLines: m[0].split('\n').length - 1 }
}

/** `\newpage` / `<!-- pagebreak -->` on their own line -> the same div doocs users already write. */
function convertPageBreaks(src) {
  const out = []
  const origLine = [] // output line index -> original (1-based) body line
  let fence = null
  let n = 0
  for (const line of src.split('\n')) {
    n++
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (f) {
      if (!fence) fence = f[1][0]
      else if (line.trim().startsWith(fence)) fence = null
    }
    if (!fence && /^\s*(\\newpage|\\pagebreak|<!--\s*pagebreak\s*-->)\s*$/.test(line))
      { out.push('', PAGEBREAK, ''); origLine.push(n, n, n) }
    else
      { out.push(line); origLine.push(n) }
  }
  return { text: out.join('\n'), origLine }
}

const MAC_SIGN = `<span class="mac-sign" style="padding: 10px 14px 0;"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="45px" height="13px" viewBox="0 0 450 130"><ellipse cx="50" cy="65" rx="50" ry="52" stroke="rgb(220,60,54)" stroke-width="2" fill="rgb(237,108,96)" /><ellipse cx="225" cy="65" rx="50" ry="52" stroke="rgb(218,151,33)" stroke-width="2" fill="rgb(247,193,81)" /><ellipse cx="400" cy="65" rx="50" ry="52" stroke="rgb(27,161,37)" stroke-width="2" fill="rgb(100,200,86)" /></svg></span>`

export function renderMarkdown(source, { macrosSource = '', mathTags = 'none', macCodeBlock = true } = {}) {
  const { data: frontMatter, body, offsetLines } = parseFrontMatter(source.replace(/\r\n/g, '\n'))
  const { text: md, origLine } = convertPageBreaks(body)
  const math = createMathRenderer({ macrosSource, tags: mathTags })

  // Approximate source line for error reports.
  let cursor = 0
  const lineOf = (raw) => {
    const i = md.indexOf(raw, cursor)
    if (i === -1) return undefined
    cursor = i
    return origLine[md.slice(0, i).split('\n').length - 1] + offsetLines
  }
  const mathRenderer = token => math.render(token.text, token.displayMode, token.raw.trim(), lineOf(token.raw))

  const marked = new Marked()
  marked.setOptions({ breaks: true })

  const listOrdered = []
  const listCounters = []
  const styled = (label, content, tag = label, style) =>
    `<${tag} class="${label.replace(/_/g, '-')}"${/^h\d$/.test(tag) ? ' data-heading="true"' : ''}${style ? ` style="${style}"` : ''}>${content}</${tag}>`

  marked.use({
    renderer: {
      heading({ tokens, depth }) { return styled(`h${depth}`, this.parser.parseInline(tokens)) },
      paragraph({ tokens }) {
        const text = this.parser.parseInline(tokens)
        const t = text.trim()
        if (t === '' || (text.includes('<figure') && text.includes('<img')) || /^<section class="katex-block"[\s\S]*<\/section>\s*$/.test(t))
          return text
        return styled('p', text)
      },
      blockquote({ tokens }) { return styled('blockquote', this.parser.parse(tokens)) },
      code({ text, lang = '' }) {
        const l = lang.split(' ')[0]
        const language = hljs.getLanguage(l) ? l : 'plaintext'
        const hl = hljs.highlight(text, { language }).value
          .replace(/\r?\n/g, '<br/>')
          .replace(/(>[^<]+)|(^[^<]+)/g, s => s.replace(/\s/g, '&nbsp;'))
        return `<pre class="hljs code__pre">${macCodeBlock ? MAC_SIGN : ''}<code class="language-${lang}"><span class="code-block__inner" style="display:block">${hl}</span></code></pre>`
      },
      codespan({ text }) { return styled('codespan', escapeHtml(text), 'code') },
      list({ ordered, items, start = 1 }) {
        listOrdered.push(ordered)
        listCounters.push(Number(start))
        const html = items.map(item => this.listitem(item)).join('')
        listOrdered.pop()
        listCounters.pop()
        return styled(ordered ? 'ol' : 'ul', html)
      },
      listitem(token) {
        const ordered = listOrdered.at(-1)
        const idx = listCounters.at(-1)
        listCounters[listCounters.length - 1] = idx + 1
        let content
        try { content = this.parser.parseInline(token.tokens) }
        catch { content = this.parser.parse(token.tokens).replace(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/, '$1') }
        return styled('listitem', `${ordered ? `${idx}. ` : '• '}${content}`, 'li')
      },
      image({ href, title, text }) {
        let alt = text, w = '', h = ''
        const m = text.match(/\|(\d+)(?:x(\d+))?$/)
        if (m) { alt = text.replace(m[0], ''); w = ` width="${m[1]}"`; h = m[2] ? ` height="${m[2]}"` : '' }
        const cap = alt ? styled('figcaption', alt) : ''
        return `<figure><img src="${href}"${title ? ` title="${title}"` : ''}${w}${h} alt="${alt}"/>${cap}</figure>`
      },
      link({ href, title, text, tokens }) {
        const inner = this.parser.parseInline(tokens)
        if (href === text) return inner
        return `<a href="${href}" title="${title || text}">${inner}</a>`
      },
      strong({ tokens }) { return styled('strong', this.parser.parseInline(tokens)) },
      em({ tokens }) { return styled('em', this.parser.parseInline(tokens)) },
      del({ tokens }) { return styled('del', this.parser.parseInline(tokens)) },
      table({ header, rows }) {
        const head = header.map(c => styled('th', this.parser.parseInline(c.tokens), 'th', `text-align: ${c.align || 'left'}`)).join('')
        const body = rows.map(r => styled('tr', r.map(c => this.tablecell(c)).join(''))).join('')
        return `<section style="max-width: 100%; overflow: auto;"><table class="preview-table"><thead>${head}</thead><tbody>${body}</tbody></table></section>`
      },
      tablecell(c) { return styled('td', this.parser.parseInline(c.tokens), 'td', `text-align: ${c.align || 'left'}`) },
      hr(token) {
        const raw = token.raw.trim()
        return `<hr class="hr hr-${raw.includes('*') ? 'star' : raw.includes('_') ? 'underscore' : 'dash'}">`
      },
    },
  })

  marked.use(markedAlert({}))

  // Math extensions — same tokenizer rules doocs uses (nonStandard: true).
  marked.use({
    extensions: [
      {
        name: 'inlineKatex', level: 'inline',
        start: src => findInlineKatexStart(src, true, inlineRuleNonStandard),
        tokenizer(src) {
          const m = src.match(inlineRuleNonStandard)
          if (m) return { type: 'inlineKatex', raw: m[0], text: m[2].trim(), displayMode: m[1].length === 2 }
        },
        renderer: mathRenderer,
      },
      {
        name: 'blockKatex', level: 'block',
        // doocs: only a line starting with `$$` (≤3 spaces) inside the current paragraph may interrupt it.
        start: src => findIndentedLineStart(src, '$$', 3, blockScanLimit(src)),
        tokenizer(src) {
          const m = matchBlockKatex(src)
          if (m) return { type: 'blockKatex', raw: m[0], text: m[2].trim(), displayMode: true }
        },
        renderer: mathRenderer,
      },
      {
        name: 'inlineLatexKatex', level: 'inline',
        start(src) { const i = src.indexOf('\\('); return i !== -1 ? i : undefined },
        tokenizer(src) {
          const m = src.match(inlineLatexRule)
          if (m) return { type: 'inlineLatexKatex', raw: m[0], text: m[1].trim(), displayMode: false }
        },
        renderer: mathRenderer,
      },
      {
        name: 'blockLatexKatex', level: 'block',
        start(src) { const i = src.indexOf('\\['); return i !== -1 ? i : undefined },
        tokenizer(src) {
          const m = src.match(blockLatexRule)
          if (m) return { type: 'blockLatexKatex', raw: m[0], text: m[1].trim(), displayMode: true }
        },
        renderer: mathRenderer,
      },
    ],
  })

  let html = marked.parse(md)
  html = html.replace(/<br\s*\/?>\s*(?=<span class="katex-inline)/gi, '') // doocs stripBreakBeforeInlineKatex
  return { html: `<section class="container">${html}</section>`, frontMatter, mathErrors: math.errors }
}

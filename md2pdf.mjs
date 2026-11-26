#!/usr/bin/env node
// md2pdf — Markdown 数学讲义 -> PDF（doocs/md 视觉风格 + MathJax + 页码）
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderMarkdown } from './lib/render.mjs'
import { buildHtml } from './lib/template.mjs'
import { htmlFileToPdf, closeBrowser } from './lib/pdf.mjs'

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url))

const HELP = `用法: md2pdf <讲义.md ...> [选项]

选项:
  -o, --out <路径>       输出 PDF 路径（单文件）或输出目录（多文件）
  --html                 同时保留中间 HTML（调样式用）
  --config <文件>        指定配置文件（默认：md 同目录的 md2pdf.config.json，其次工具目录的）
  --no-page-number       不加页码
  --strict               有公式报错时不生成 PDF，退出码 1
  -h, --help             显示帮助

换页: 在 Markdown 中单独一行写以下任意一种
  <div style="page-break-after: always;"></div>
  \\newpage
  <!-- pagebreak -->
`

function parseArgs(argv) {
  const a = { files: [], html: false, strict: false, pageNumber: true }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === '-h' || x === '--help') a.help = true
    else if (x === '-o' || x === '--out') a.out = argv[++i]
    else if (x === '--html') a.html = true
    else if (x === '--config') a.config = argv[++i]
    else if (x === '--no-page-number') a.pageNumber = false
    else if (x === '--strict') a.strict = true
    else if (x.startsWith('-')) throw new Error(`未知选项：${x}`)
    else a.files.push(x)
  }
  return a
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
function merge(base, over) {
  const out = { ...base }
  for (const [k, v] of Object.entries(over || {}))
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v
  return out
}

/** Load config layers; file paths inside a layer resolve relative to that layer's file. */
function loadConfig(mdDir, explicit) {
  const layers = [path.join(TOOL_DIR, 'md2pdf.config.json')]
  const local = path.join(mdDir, 'md2pdf.config.json')
  if (explicit) layers.push(path.resolve(explicit))
  else if (fs.existsSync(local) && path.resolve(local) !== layers[0]) layers.push(local)

  let cfg = {}
  for (const file of layers) {
    if (!fs.existsSync(file)) {
      if (file === explicit) throw new Error(`配置文件不存在：${file}`)
      continue
    }
    const layer = JSON.parse(fs.readFileSync(file, 'utf8'))
    const dir = path.dirname(file)
    if (layer.math?.macros) layer.math.macros = path.resolve(dir, layer.math.macros)
    if (layer.customCssFile) layer.customCssFile = path.resolve(dir, layer.customCssFile)
    cfg = merge(cfg, layer)
  }
  return cfg
}

async function convert(file, args, outPath) {
  const t0 = Date.now()
  const mdPath = path.resolve(file)
  const mdDir = path.dirname(mdPath)
  const source = fs.readFileSync(mdPath, 'utf8')

  let cfg = loadConfig(mdDir, args.config)
  const macrosSource = cfg.math?.macros && fs.existsSync(cfg.math.macros) ? fs.readFileSync(cfg.math.macros, 'utf8') : ''

  const { html: bodyHtml, frontMatter, mathErrors } = renderMarkdown(source, { macrosSource, mathTags: cfg.math?.tags, macCodeBlock: cfg.macCodeBlock !== false })
  if (isObj(frontMatter.md2pdf)) cfg = merge(cfg, frontMatter.md2pdf) // per-file overrides
  if (!args.pageNumber) cfg.pageNumber.enabled = false

  const title = frontMatter.title || path.basename(mdPath, path.extname(mdPath))
  const fullHtml = buildHtml({ bodyHtml, title, cfg, baseHref: pathToFileURL(mdDir + path.sep).href })

  const name = path.basename(mdPath, path.extname(mdPath))
  if (mathErrors.length) {
    console.error(`\n⚠ ${file}：${mathErrors.length} 处公式渲染失败`)
    for (const e of mathErrors) console.error(`  第 ${e.line ?? '?'} 行  ${e.message}\n    ${e.raw}`)
    if (args.strict) return { ok: false }
  }

  const htmlPath = args.html
    ? outPath.replace(/\.pdf$/i, '.html')
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-')), `${name}.html`)
  fs.writeFileSync(htmlPath, fullHtml)

  const { pages, brokenImages } = await htmlFileToPdf(htmlPath, outPath)
  if (!args.html) fs.rmSync(path.dirname(htmlPath), { recursive: true, force: true })

  for (const src of brokenImages) console.error(`⚠ 图片加载失败：${src}`)
  console.log(`✓ ${path.relative(process.cwd(), outPath) || outPath}  ${pages} 页  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  return { ok: true }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.files.length) {
    console.log(HELP)
    process.exit(args.help ? 0 : 1)
  }
  let failed = 0
  try {
    for (const file of args.files) {
      let out
      if (args.out && args.files.length === 1 && /\.pdf$/i.test(args.out)) out = path.resolve(args.out)
      else {
        const dir = args.out ? path.resolve(args.out) : path.dirname(path.resolve(file))
        fs.mkdirSync(dir, { recursive: true })
        out = path.join(dir, `${path.basename(file, path.extname(file))}.pdf`)
      }
      try {
        const r = await convert(file, args, out)
        if (!r.ok) failed++
      }
      catch (e) {
        failed++
        console.error(`✗ ${file}：${e.message}`)
      }
    }
  }
  finally {
    await closeBrowser()
  }
  process.exit(failed ? 1 : 0)
}

main()

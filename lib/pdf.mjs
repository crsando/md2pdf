// HTML -> PDF via the locally installed Google Chrome (headless), same engine as doocs' window.print().
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const CHROME_CANDIDATES = [
  process.env.MD2PDF_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean)

export function findChrome() {
  const p = CHROME_CANDIDATES.find(c => fs.existsSync(c))
  if (!p) throw new Error('找不到 Chrome。请安装 Google Chrome，或设置环境变量 MD2PDF_CHROME 指向浏览器可执行文件。')
  return p
}

let browserPromise = null
async function getBrowser() {
  browserPromise ??= chromium.launch({ executablePath: findChrome(), headless: true })
  return browserPromise
}

export async function closeBrowser() {
  if (browserPromise) (await browserPromise).close()
  browserPromise = null
}

/** Render an HTML file to PDF. Returns page count. */
export async function htmlFileToPdf(htmlPath, pdfPath, { timeout = 60000 } = {}) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout })
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r })))
    })
    const broken = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')))
    const buf = await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, timeout })
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    return { pages, brokenImages: broken }
  }
  finally {
    await page.close()
  }
}

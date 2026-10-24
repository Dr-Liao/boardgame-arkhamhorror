// Ad-hoc visual check for the TCU table: real hall → Circle Undone session →
// investigator/deck/lobby → prologue story picker → first chapter table.
// Saves desktop and mobile screenshots plus the table's computed chrome colors.
//
// Run from the repository root:  node games/arkhamhorror/develop/shot-table.mjs table
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.HALL_URL || 'http://127.0.0.1:8811'
const tag = process.argv[2] || 'table'
const outDir = new URL('../../../artifacts/tcu-theme/', import.meta.url)
mkdirSync(outDir, { recursive: true })
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${tag}-${name}.png`, outDir)), fullPage: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

async function settleUi() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await page.locator('.ah-cinematic').count()) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) { await skip.first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(150); continue }
      const next = page.getByRole('button', { name: '继续', exact: true })
      if (await next.count()) { await next.first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(150); continue }
      await page.waitForTimeout(200)
      continue
    }
    await page.waitForTimeout(180)
    if (!(await page.locator('.ah-cinematic').count())) return
  }
}

async function clickSettled(locator, label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await settleUi()
    try { await locator.click({ timeout: 8000 }); return } catch (error) {
      if (attempt === 7) throw new Error(`${label || '点击'}失败：${error.message}`)
      await page.waitForTimeout(350)
    }
  }
}

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' })
await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).first().click({ timeout: 30000 })
const setup = page.locator('.ah-hub-setup')
await setup.locator('select').first().selectOption('theCircleUndone')
await setup.locator('select').filter({ has: page.locator('option', { hasText: '1 个席位' }) }).first().selectOption('1')
const [startResponse] = await Promise.all([
  page.waitForResponse(response => response.url().endsWith('/api/start') && response.request().method() === 'POST', { timeout: 90000 }),
  page.getByRole('button', { name: '开始新游戏' }).click({ timeout: 30000 }),
])
const sessionId = (await startResponse.json())?.session?.sessionId
console.log('session', sessionId)
const hub = page.locator('.ah-hub')
await hub.waitFor({ state: 'visible', timeout: 90000 })
await clickSettled(hub.getByRole('button', { name: '选择调查员', exact: true }), '选择调查员')
await clickSettled(hub.getByRole('button', { name: /选择调查员：/ }).first(), '选择候选人')
await clickSettled(hub.getByRole('button', { name: /自动构筑/ }).first(), '自动构筑')
await clickSettled(hub.getByRole('button', { name: '确认准备', exact: true }).first(), '确认准备')
await clickSettled(hub.getByRole('navigation', { name: '战役局外页面' }).getByRole('button', { name: '开始关卡', exact: true }), '开始关卡标签')
await clickSettled(hub.getByRole('button', { name: '开始当前关卡' }).first(), '开始当前关卡')
const storyPanel = page.locator('.ah-story-picker')
await storyPanel.waitFor({ state: 'visible', timeout: 60000 })
await clickSettled(storyPanel.getByRole('button', { name: /加弗瑞拉/ }).first(), '序章调查员')
// The prologue can chain further choices/presentations before the table mounts.
const sessionState = async () => page.evaluate(async id => {
  const response = await fetch('/api/session?sessionId=' + encodeURIComponent(id))
  const payload = await response.json().catch(() => ({}))
  return payload.session?.state || null
}, sessionId)
let state = null
for (let attempt = 0; attempt < 240; attempt++) {
  state = await sessionState()
  if (state?.uiState === 'inScenario' && !state.pendingChoice) break
  await settleUi()
  await page.waitForTimeout(120)
}
console.log('state', JSON.stringify({ uiState: state?.uiState, pending: state?.pendingChoice?.kind || null }))
if (state?.uiState !== 'inScenario') {
  await shot(page, 'table-stuck')
  throw new Error('未进入牌桌：' + JSON.stringify({ uiState: state?.uiState, pending: state?.pendingChoice?.kind || null }))
}
await page.locator('.ah-table').waitFor({ state: 'visible', timeout: 30000 })
await settleUi()
await page.waitForTimeout(1200)
await shot(page, 'table')

const colors = await page.evaluate(() => {
  const table = document.querySelector('.ah-table')
  const css = element => {
    if (!element) return null
    const style = getComputedStyle(element)
    return { color: style.color, background: style.backgroundColor, backgroundImage: style.backgroundImage.slice(0, 120), borderColor: style.borderColor }
  }
  return {
    theme: {
      campaign: table?.dataset.campaign || null,
      presentationTheme: table?.dataset.presentationTheme || null,
      vars: table ? {
        gold: getComputedStyle(table).getPropertyValue('--ah-gold'),
        edge: getComputedStyle(table).getPropertyValue('--ah-edge'),
        panel: getComputedStyle(table).getPropertyValue('--ah-panel'),
      } : null,
    },
    table: css(table),
    head: css(document.querySelector('.bg-game-head')),
    title: css(document.querySelector('.bg-game-title')),
    status: css(document.querySelector('.bg-game-status')),
    headButtons: [...document.querySelectorAll('.bg-game-actions .bg-btn')].slice(0, 4).map(css),
    shell: css(document.querySelector('.ah-table-shell')),
    script: css(document.querySelector('.ah-table-script')),
    mapViewport: css(document.querySelector('.ah-map-viewport')),
    phaseStrong: css(document.querySelector('.ah-phase-track strong')),
    actionButton: css(document.querySelector('.ah-action')),
  }
})
writeFileSync(new URL(`${tag}-colors.json`, outDir), JSON.stringify({ pageErrors, colors }, null, 2))

await page.setViewportSize({ width: 390, height: 844 })
await settleUi()
await page.waitForTimeout(800)
await shot(page, 'table-mobile')

// Diagnose which visible boxes still paint a green surface.
const greenSurfaces = await page.evaluate(() => {
  const parse = value => { const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null }
  const hue = ({ r, g, b }) => { const max = Math.max(r,g,b), min = Math.min(r,g,b); if (max === min) return -1; const d = max - min; let h; if (max === r) h = ((g-b)/d) % 6; else if (max === g) h = (b-r)/d + 2; else h = (r-g)/d + 4; return (h*60+360)%360 }
  const rows = []
  for (const el of document.querySelectorAll('.ah-table *')) {
    const rect = el.getBoundingClientRect()
    if (rect.width < 40 || rect.height < 20) continue
    const style = getComputedStyle(el)
    const c = parse(style.backgroundColor)
    if (!c || c.a < .3) continue
    const h = hue(c)
    if (h >= 70 && h <= 180 && Math.max(c.r,c.g,c.b) - Math.min(c.r,c.g,c.b) > 8) {
      rows.push({ cls: typeof el.className === 'string' ? el.className.slice(0, 90) : '', tag: el.tagName, bg: style.backgroundColor, hue: Math.round(h), w: Math.round(rect.width), h: Math.round(rect.height) })
    }
  }
  return rows.slice(0, 40)
})
writeFileSync(new URL(`${tag}-greens.json`, outDir), JSON.stringify(greenSurfaces, null, 2))

await browser.close()
console.log(JSON.stringify({ tag, pageErrors, out: fileURLToPath(outDir) }, null, 2))

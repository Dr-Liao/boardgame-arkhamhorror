// Cross-campaign visual regression check for the campaign palettes: opens a hub for
// every shipped campaign with the current theme CSS, plus the committed (pre-change)
// CSS for the two default-palette campaigns, and saves screenshots for comparison.
//
// Run from the repository root:  node games/arkhamhorror/develop/shot-campaigns.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const BASE = process.env.HALL_URL || 'http://127.0.0.1:8811'
const outDir = new URL('../../../artifacts/tcu-theme/', import.meta.url)
mkdirSync(outDir, { recursive: true })

const campaigns = [
  ['nightOfTheZealot', '基础循环'],
  ['theDunwichLegacy', '敦威治'],
  ['thePathToCarcosa', '卡尔克萨'],
  ['theForgottenAge', '失落时代'],
  ['theCircleUndone', '万象无终'],
]
const oldTheme = execFileSync('git', ['show', 'HEAD:web/campaign-theme.css'], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' })

const browser = await chromium.launch({ channel: 'msedge' })

async function shotHub(page, campaignId, slug, useOldCss) {
  if (useOldCss) {
    await page.route('**/campaign-theme.css', route => route.fulfill({ contentType: 'text/css', body: oldTheme }))
  }
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' })
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).first().click({ timeout: 30000 })
  const setup = page.locator('.ah-hub-setup')
  await setup.locator('select').first().selectOption(campaignId)
  await setup.locator('select').filter({ has: page.locator('option', { hasText: '1 个席位' }) }).first().selectOption('1')
  await page.getByRole('button', { name: '开始新游戏' }).click({ timeout: 30000 })
  await page.locator('.ah-hub').waitFor({ state: 'visible', timeout: 90000 })
  await page.waitForTimeout(1500)
  const suffix = useOldCss ? 'old' : 'new'
  await page.screenshot({ path: fileURLToPath(new URL(`hub-${slug}-${suffix}.png`, outDir)), fullPage: true })
  await page.unrouteAll()
}

for (const [campaignId, slug] of campaigns) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
  await shotHub(page, campaignId, slug, false)
  if (campaignId === 'nightOfTheZealot' || campaignId === 'theDunwichLegacy') {
    await shotHub(page, campaignId, slug, true)
  }
  await page.close()
  console.log('shot', campaignId)
}

await browser.close()
console.log('done')

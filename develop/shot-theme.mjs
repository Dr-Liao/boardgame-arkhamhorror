// Ad-hoc visual check for the TCU campaign palette: open the real hall, choose the
// fourth cycle in the setup modal, screenshot it, then start a 1-seat session and
// screenshot the campaign hub. Prints computed colors of the interactive chrome.
//
// Run from the repository root:  node games/arkhamhorror/develop/shot-theme.mjs before
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.HALL_URL || 'http://127.0.0.1:8811'
const tag = process.argv[2] || 'before'
const outDir = new URL('../../../artifacts/tcu-theme/', import.meta.url)
mkdirSync(outDir, { recursive: true })
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${tag}-${name}.png`, outDir)), fullPage: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' })
await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).first().click({ timeout: 30000 })

// 调查准备设置 modal: select[0] campaign, the select with 「1 个席位」 seat count.
const setup = page.locator('.ah-hub-setup')
await setup.waitFor({ state: 'visible', timeout: 30000 })
await setup.locator('select').first().selectOption('theCircleUndone')
const seatSelect = setup.locator('select').filter({ has: page.locator('option', { hasText: '1 个席位' }) }).first()
await seatSelect.selectOption('1')
await page.waitForTimeout(600)
await shot(page, 'setup')

const collect = () => page.evaluate(() => {
  const themeRoot = document.querySelector('.ah-theme')
  const css = element => {
    if (!element) return null
    const style = getComputedStyle(element)
    return {
      color: style.color,
      background: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
    }
  }
  const buttons = [...document.querySelectorAll('.bg-btn')].filter(button => button.getBoundingClientRect().width > 0)
  return {
    theme: {
      campaign: themeRoot?.dataset.campaign || null,
      presentationTheme: themeRoot?.dataset.presentationTheme || null,
      vars: themeRoot ? {
        bg: themeRoot.style.getPropertyValue('--ah-theme-bg'),
        panel: themeRoot.style.getPropertyValue('--ah-theme-panel'),
        accent: themeRoot.style.getPropertyValue('--ah-theme-accent'),
        accentStrong: themeRoot.style.getPropertyValue('--ah-theme-accent-strong'),
        muted: themeRoot.style.getPropertyValue('--ah-theme-muted'),
      } : null,
    },
    modal: css(document.querySelector('.ah-hub-setup')),
    head: css(document.querySelector('.bg-game-head')),
    title: css(document.querySelector('.bg-game-title')),
    eyebrow: css(document.querySelector('.ah-office-eyebrow')),
    hubPane: css(document.querySelector('.ah-hub-pane')),
    activeTab: css(document.querySelector('.ah-hub-tabs button.active')),
    input: css(document.querySelector('.ah-hub-setup input, .ah-hub-setup select')),
    buttons: buttons.slice(0, 10).map(css),
    buttonsText: buttons.slice(0, 10).map(button => (button.textContent || '').trim().slice(0, 20)),
  }
})

const setupColors = await collect()
await page.getByRole('button', { name: '开始新游戏' }).click({ timeout: 30000 })
await page.locator('.ah-hub').waitFor({ state: 'visible', timeout: 90000 })
await page.waitForTimeout(2000)
await shot(page, 'hub')
const hubColors = await collect()

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(600)
await shot(page, 'hub-mobile')

writeFileSync(new URL(`${tag}-colors.json`, outDir), JSON.stringify({ pageErrors, setup: setupColors, hub: hubColors }, null, 2))
await browser.close()
console.log(JSON.stringify({ tag, pageErrors, out: fileURLToPath(outDir) }, null, 2))

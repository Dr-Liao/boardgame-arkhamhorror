import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/migration/tic/p7/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })
async function start(page) {
  const errors = []; let latest
  page.on('pageerror', e => errors.push(e.message))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), l => l.click())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('response', async r => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(r.url()) || !r.ok()) return
    try { const body = await r.json(); if (body.session) latest = body.session } catch {}
  })
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...body, settings: {
      ...body.settings, playerCount: 1, teammates: 0, legacyAutoStart: true, ticScenarioFixture: true,
    } }) })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('dialog', { name: '调查准备设置' }).getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => latest?.state.mechanics?.barriers?.[0]?.count).toBe(1)
  return { latest: () => latest, errors }
}
async function use(page, name) {
  await page.locator('.ah-minicard[data-card-code="testTicP7Interaction"]').first().click()
  await page.locator('.ah-card-action-popover').getByRole('button', { name }).click()
}
async function shot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P7 ${size} 提示卡拿取钥匙使用真实场景来源与彩色选择`,async({page})=>{
    await page.setViewportSize({width,height});const run=await start(page)
    await page.locator('.ah-script-actions').getByRole('button',{name:/拿取本地点的一把钥匙/}).click()
    await expect(page.locator('.ah-choice')).toHaveAttribute('data-mechanic-choice','claimKey')
    await shot(page,`${size}-reference-key-choice`)
    await page.locator('.ah-choice [data-option-id="pick:0"]').click();await page.locator('.ah-choice [data-option-id="confirm"]').click()
    await expect.poll(()=>run.latest()?.state.mechanics.keys.find(key=>key.color==='blue')?.holder).toBe('investigator:0')
    expect(run.latest().state.mechanics.keys.some(key=>key.color==='unrevealed')).toBe(false)
    await shot(page,`${size}-reference-key-claimed`);expect(run.errors).toEqual([])
  })
  test(`P7 ${size} 路障展示与本地点团队付费清除`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    await expect(page.locator('[data-barrier-count="1"]')).toHaveCount(1)
    await shot(page, `${size}-barrier-before`)
    await use(page, /清除路障/)
    await page.locator('.ah-choice [data-option-id="0"]').click()
    await expect.poll(() => run.latest()?.state.mechanics?.barriers?.length || 0).toBe(0)
    expect(run.latest().state.investigators.every(inv => inv.clues === 0)).toBe(true)
    await expect(page.locator('[data-barrier-count]')).toHaveCount(0)
    await shot(page, `${size}-barrier-cleared`); expect(run.errors).toEqual([])
  })
  test(`P7 ${size} 钥匙费用沿用实体选择并支付一次`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    const resources = run.latest().state.investigators[0].resources
    await use(page, /支付钥匙/)
    await expect(page.locator('.ah-choice')).toHaveAttribute('data-mechanic-choice', 'spendKey')
    await shot(page, `${size}-key-cost-choice`)
    await page.locator('.ah-choice [data-option-id="pick:1"]').click()
    await page.locator('.ah-choice [data-option-id="confirm"]').click()
    await expect.poll(() => run.latest()?.state.mechanics.keys.some(k => k.color === 'white' && k.holder === 'reference')).toBe(true)
    expect(run.latest().state.investigators[0].resources).toBe(resources + 1)
    await shot(page, `${size}-key-cost-paid`); expect(run.errors).toEqual([])
  })
  test(`P7 ${size} 私有线索牌库选择并实际抽取敌人`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    await use(page, /调查线索/)
    await expect(page.locator('.ah-choice')).toContainText('选择一张揭示的牌并抽取')
    await shot(page, `${size}-leads-choice`)
    await page.locator('.ah-choice [data-option-id="0"]').click()
    await expect.poll(() => run.latest()?.state.enemies.length).toBe(1)
    expect(run.latest().state.mechanics.scenarioDecks.leads.count).toBe(2)
    await shot(page, `${size}-lead-drawn`); expect(run.errors).toEqual([])
  })
}

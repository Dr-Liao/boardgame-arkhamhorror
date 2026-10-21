import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish', import.meta.url))

test('全员角色、玩家身份、行动切换和四阶段在各尺寸显示', async ({ page }) => {
  let session
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 4, playerInvestigator: '01001', teammates: 3, seed: 'command-deck',
    } }) })
    const payload = await response.json(); session = payload.session
    session.state.pendingChoice = null; session.state.currentSeat = 0; session.state.phase = 'investigation'
    session.state.legalMoves = []
    session.players[1].avatar = '/mods/arkhamhorror/img/ui/chaos-bag.png'
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-cinematic')).toBeVisible()
  await page.getByRole('button', { name: '跳过演出' }).click()
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  const roster = page.getByRole('list', { name: '当前调查员' })
  await expect(roster.getByRole('listitem')).toHaveCount(4)
  await expect(roster.locator('.is-active')).toHaveAttribute('data-seat', '0')
  await expect(roster.locator('[data-seat="0"]')).toContainText('座位 01')
  await expect(roster.locator('[data-seat="1"]')).toContainText(session.players[1].aiId)
  await expect(roster.locator('[data-seat="1"] .ah-roster-avatar img')).toBeVisible()
  await expect(page.locator('.ah-header-phase[aria-current="step"]')).toContainText('调查阶段')
  await expect(page.getByRole('group', { name: '混乱袋与剧本标记' }).locator('.ah-command-token svg')).toHaveCount(2)
  mkdirSync(output, { recursive: true })
  for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 960, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    for (const member of await roster.getByRole('listitem').all()) await expect(member).toBeInViewport({ ratio: 1 })
    await expect(page.locator('.ah-chaos-bag')).toBeVisible()
    for (const phase of await page.locator('.ah-header-phase').all()) await expect(phase).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const deck = await page.locator('.ah-command-deck').boundingBox()
    const map = await page.locator('.ah-table-map').boundingBox()
    expect(deck.y + deck.height).toBeLessThanOrEqual(map.y + 1)
    expect(map.height).toBeGreaterThan(60)
    await page.evaluate(async () => Promise.all([...document.querySelectorAll('.ah-roster-portrait img')].map(img => img.decode().catch(() => {}))))
    await page.screenshot({ path: output + `command-deck-${size.width}.png`, animations: 'disabled' })
  }
  session.state.currentSeat = 2; session.state.revision++
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(roster.locator('.is-active')).toHaveAttribute('data-seat', '2')
  session.state.pendingChoice = { id: 'command-choice', kind: 'target', seat: 1, prompt: '选择目标', options: [] }
  session.state.phase = 'enemy'; session.state.revision++
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(roster.locator('.is-active')).toHaveAttribute('data-seat', '1')
  await expect(roster.locator('.is-active')).toContainText('AI 等待继续')
  await expect(page.locator('.ah-header-phase[aria-current="step"]')).toContainText('敌军阶段')
  session.state.pendingChoice = null; session.state.phase = 'mythos'; session.state.revision++
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(page.locator('.ah-header-phase[aria-current="step"]')).toContainText('神话阶段')
  await roster.locator('[data-seat="0"] button').click()
  await expect(page.getByRole('dialog', { name: '卡牌详情' })).toContainText(session.state.investigators[0].name)
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  session.state.status = 'ended'; session.state.revision++
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(roster.locator('.is-active')).toHaveCount(0)
  await expect(page.locator('.ah-header-phase[aria-current="step"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

import { test, expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { mkdirSync } from 'node:fs'

const output = 'artifacts/arkham-polish/'
mkdirSync(output, { recursive: true })

// 敌人详情同时受两件事影响：
//   1. 面板展示的是目录卡文，结算值必须取场上实例（生命 10，而不是印刷的 7）；
//   2. 「每名调查员 +3 生命」写在剧本定义里，图鉴详情要能把它算进去。
async function fixture(page) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'enemy-health' } }) })
    const payload = await response.json()
    session = payload.session
    const st = session.state
    st.pendingChoice = null; st.currentSeat = 0; st.phase = 'investigation'
    st.locations = ['hallway', 'attic', 'cellar'].map(id => ({ ...scenario.locations[id], revealed: id !== 'attic', clues: 0, maxClues: 2 }))
    // 单人局：实验体 7 点印刷生命 + 每人 3 点 = 10。
    st.cards['02058'] = { ...ALL_CARDS['02058'], healthPerPlayerBonus: 3 }
    st.enemies = [{
      id: 'experiment', code: '02058', name: '实验体', location: 'cellar',
      fight: 4, evade: 2, effectiveFight: 4, effectiveEvade: 2,
      health: 10, damageTaken: 0, damage: 2, horror: 2,
      massive: true, victory: 2, traits: ['Monster', 'Abomination', 'Elite'], exhausted: false, engagedSeat: null,
    }]
    st.investigators[0].location = 'cellar'
    st.legalMoves = []
    st.setAsideCards = [{ code: '02058', count: 1 }]
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '跳过演出' }).click()
}

test('敌人详情显示场上有效生命与每名调查员加值', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await fixture(page)
  await page.locator('.ah-map-node[data-location-id="cellar"] .ah-enemy').filter({ hasText: '实验体' }).click()
  const modal = page.locator('.ah-carddetail-modal')
  await expect(modal).toBeVisible()
  const health = modal.locator('.ah-enemy-health')
  await expect(health).toHaveAttribute('aria-label', '生命 10 / 10（印刷 7 点，每名调查员 +3，共 1 名调查员）')
  await expect(health.locator('.ah-enemy-health-value')).toContainText('10')
  await expect(health.locator('.ah-enemy-health-hint')).toHaveText('每人 +3')
  await expect(modal.locator('.ah-card-full-name')).toHaveText('实验体')
  await page.screenshot({ path: output + 'enemy-health-detail.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: output + 'enemy-health-mobile.png', animations: 'disabled' })
  await page.setViewportSize({ width: 1400, height: 950 })
  // 放在一边的卡没有场上实例，仍要按调查员人数算出 10。
  await modal.getByRole('button', { name: '关闭卡牌详情' }).click()
  await page.getByRole('button', { name: /查看放在一边的卡牌/ }).click()
  const aside = page.locator('.ah-card-zone-modal')
  await expect(aside.locator('.ah-card-zone-card')).toHaveCount(1)
  await aside.locator('.ah-card-zone-card').click()
  const asideDetail = page.locator('.ah-carddetail-modal')
  await expect(asideDetail.locator('.ah-enemy-health .ah-enemy-health-value')).toHaveText('10')
  await expect(asideDetail.locator('.ah-enemy-health .ah-enemy-health-hint')).toHaveText('每人 +3')
  await asideDetail.getByRole('button', { name: '关闭卡牌详情' }).click()
  await aside.getByRole('button', { name: '关闭放在一边的卡牌' }).click()
  // 图鉴在局内打开时没有场上实例，也要按当前调查员人数换算，而不是退回印刷的 7。
  await page.getByRole('button', { name: '全卡图鉴' }).click()
  const catalog = page.locator('.ah-catalog-modal')
  await expect(catalog).toBeVisible()
  await catalog.getByRole('textbox', { name: '卡号或名称' }).fill('02058')
  await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
  await catalog.locator('.ah-catalog-card').click()
  const catalogDetail = page.locator('.ah-carddetail-modal')
  await expect(catalogDetail.locator('.ah-enemy-health .ah-enemy-health-value')).toContainText('10')
  await expect(catalogDetail.locator('.ah-enemy-health .ah-enemy-health-hint')).toHaveText('每人 +3')
  expect(errors).toEqual([])
})

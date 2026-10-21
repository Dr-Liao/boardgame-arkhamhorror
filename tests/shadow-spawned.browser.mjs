import { test, expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { mkdirSync } from 'node:fs'

const output = 'artifacts/arkham-polish/'
mkdirSync(output, { recursive: true })

async function fixture(page) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'shadow-spawned',
    } }) })
    const payload = await response.json(); session = payload.session
    const st = session.state
    st.pendingChoice = null; st.currentSeat = 0; st.phase = 'investigation'; st.legalMoves = []
    st.locations = ['hallway', 'attic', 'cellar'].map(id => ({ ...scenario.locations[id], revealed: id !== 'attic', clues: 0 }))
    st.investigators[0].location = 'cellar'
    st.cards['02141'] = { ...ALL_CARDS['02141'] }
    st.cards['02142'] = { ...ALL_CARDS['02142'] }
    st.enemies = [{
      id: 'hunting-horror', code: '02141', originalCode: '02141', name: '追猎恐魔', type: 'enemy',
      location: 'cellar', health: 9, damageTaken: 1, fight: 5, evade: 4, damage: 2, horror: 2,
      shadowSpawned: true, shadowResources: 1,
    }]
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '跳过演出' }).click()
  return { session, async update(fn) {
    fn(session); session.state.revision++
    await page.getByRole('button', { name: '刷新局势' }).click()
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(session.state.revision))
  } }
}

test('追猎恐魔的暗影之子显示为附属卡并可查看资源', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await fixture(page)
  const enemy = page.locator('.ah-map-node[data-location-id="cellar"] [data-interaction="enemy:hunting-horror"]')
  await expect(enemy).toBeVisible()
  await expect(enemy.locator('[data-card-marker="attached"]')).toHaveAttribute('aria-label', '附属卡 1')
  await enemy.click()
  const modal = page.locator('.ah-carddetail-modal')
  const attachment = modal.locator('.ah-detail-attachment-card[data-attachment-code="02142"]')
  await expect(attachment).toBeVisible()
  await expect(attachment).toContainText('暗影之子')
  await attachment.click()
  await expect(modal.locator('.ah-runtime-host')).toContainText('追猎恐魔')
  const resources = modal.locator('[data-runtime-marker="resources"]')
  await expect(resources).toHaveAttribute('aria-label', '资源 1')
  await resources.scrollIntoViewIfNeeded()
  await page.screenshot({ path: output + 'shadow-spawned-detail.png', animations: 'disabled' })
  expect(errors).toEqual([])
})

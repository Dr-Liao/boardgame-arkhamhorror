// 地点附属卡的主动能力交互验收：左键点地图上的附属卡 → 弹出该卡自己的行动选项；
// 没有主动能力的附属仍按原行为打开卡牌详情。桌面 1440 / 移动 390 各一次。
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const output = path.join(root, 'artifacts/attachment-interaction')

// 真大厅建局，再覆盖成最小牌桌：走廊上有一张带主动能力的 04076「疯狂生长」（TFA 的
// threatAction 通道：行动带 attachmentId），地窖上有一张不带主动能力的玩家卡附属。
async function fixture(page) {
  let session
  const submitted = []
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror',
      settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'attachment-actions' } }) })
    const payload = await response.json()
    session = payload.session
    const st = session.state
    st.pendingChoice = null; st.currentSeat = 0; st.phase = 'investigation'; st.status = 'playing'; st.enemies = []
    st.locations = ['hallway', 'attic', 'cellar'].map(id => ({ ...scenario.locations[id], revealed: true, clues: id === 'cellar' ? 2 : 0 }))
    st.locations.find(loc => loc.id === 'hallway').attachments = [
      { id: 'overgrowth:1:hallway', code: '04076', originalCode: '04076' },
    ]
    st.locations.find(loc => loc.id === 'cellar').attachments = [
      { code: '03038', originalCode: '03038', exhausted: false },
    ]
    Object.assign(st.cards, {
      '04076': { code: '04076', originalCode: '04076', name: 'Overgrowth', nameZh: '疯狂生长', type: 'treachery' },
      '03038': { code: '03038', originalCode: '03038', name: 'Hiding Spot', nameZh: '藏身地点', type: 'event' },
    })
    st.investigators[0].location = 'hallway'
    st.legalMoves = [
      { action: 'encounterAction', rule: 'clearOvergrowth', attachmentId: 'overgrowth:1:hallway', actions: 1, skill: 'combat', label: '♻️ 检定战斗(4)清除疯狂生长' },
      { action: 'encounterAction', rule: 'clearOvergrowth', attachmentId: 'overgrowth:1:hallway', actions: 1, skill: 'intellect', label: '♻️ 检定智识(4)清除疯狂生长' },
      { action: 'endTurn', label: '⏭️ 结束回合' },
    ]
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', route => {
    submitted.push(route.request().postDataJSON())
    session.state.revision++
    session.state.legalMoves = []
    return route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  // 先等牌桌挂载（演出期间牌桌只读），再跳过开场演出，交互才进入可操作状态。
  await expect(page.locator('.ah-table')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  for (let guard = 0; guard < 4 && await skip.count(); guard++) {
    await skip.first().click()
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  await expect(page.locator('.ah-map-node[data-location-id="hallway"]')).toBeVisible()
  return { submitted, get session() { return session } }
}

// 窄屏地图是「适配视口 + 可缩放平移」的画布：地点附属卡挂在地点节点上沿（top:-56px），
// 初始适配后可能落在视口外。玩家先把地图平移到能看见的位置再点，与既有移动端地图操作一致。
async function bringIntoView(page, target) {
  const viewport = page.locator('.ah-map-viewport')
  for (let guard = 0; guard < 6; guard++) {
    const box = await target.boundingBox()
    const region = await viewport.boundingBox()
    if (!box || !region) return
    const top = region.y + 6, bottom = region.y + region.height - 6
    if (box.y >= top && box.y + box.height <= bottom) return
    const dy = box.y < top ? top - box.y + 8 : bottom - (box.y + box.height) - 8
    await page.mouse.move(region.x + 12, region.y + region.height - 12)
    await page.mouse.down()
    await page.mouse.move(region.x + 12, region.y + region.height - 12 + dy, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(150)
  }
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`地点附属的主动能力左键弹出选项（${label}）`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const f = await fixture(page)
    const marker = page.locator('.ah-map-node[data-location-id="hallway"] .ah-map-attachment[data-interaction="attachment:hallway:0"]')
    await expect(marker).toBeVisible()
    // 有可用行动的附属在牌桌上要看得出来（与其他可点卡同一份 ah-card-ready 提示）。
    await expect(marker).toHaveClass(/ah-card-ready/)

    // 键盘焦点 + Enter 与左键走同一条 activate 路径。
    await marker.focus()
    await page.keyboard.press('Enter')
    let popover = page.locator('.ah-card-action-popover')
    await expect(popover).toBeVisible()
    await expect(page.locator('.ah-carddetail-modal')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)

    // 左键点附属卡 → 弹出它自己的两个技能检定选项，而不是打开卡牌详情。
    if (label === 'mobile') await bringIntoView(page, marker)
    await marker.click()
    popover = page.locator('.ah-card-action-popover')
    await expect(popover).toBeVisible()
    await expect(popover.locator('.ah-action').filter({ hasText: '清除疯狂生长' })).toHaveCount(2)
    await expect(page.locator('.ah-carddetail-modal')).toHaveCount(0)
    if (label === 'mobile') {
      const box = await popover.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
      expect(box.y).toBeGreaterThanOrEqual(0)
    }
    fs.mkdirSync(output, { recursive: true })
    await page.screenshot({ path: path.join(output, `location-attachment-actions-${label}.png`), animations: 'disabled' })
    await popover.getByRole('button', { name: /检定战斗\(4\)/ }).click()
    await expect.poll(() => f.submitted.length).toBe(1)
    expect(f.submitted[0].move).toMatchObject({ action: 'encounterAction', rule: 'clearOvergrowth',
      attachmentId: 'overgrowth:1:hallway', skill: 'combat' })

    // 回归：没有主动能力的附属，左键仍然打开卡牌详情（桌面覆盖既有行为）。
    if (label === 'desktop') {
      await page.locator('.ah-map-node[data-location-id="cellar"] .ah-map-attachment[data-interaction="attachment:cellar:0"]').click()
      await expect(page.locator('.ah-carddetail-modal')).toBeVisible()
      await page.getByRole('button', { name: '关闭卡牌详情' }).click()
      await expect(page.locator('.ah-carddetail-modal')).toHaveCount(0)
    }
  })
}

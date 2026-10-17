import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../..', import.meta.url))

async function tableFixture(page, { hand = ['01087'], assets = [], pendingChoice = null, moves = null, enemies = [], onMove = null } = {}) {
  let session
  const submitted = []
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror',
      settings: { legacyAutoStart: true, playerInvestigator: '01001', teammates: 0, seed: 'p4-ui' } }) })
    const payload = await response.json()
    session = payload.session
    const st = session.state
    const inv = st.investigators[0]
    st.pendingChoice = pendingChoice
    st.currentSeat = 0
    st.phase = 'investigation'
    st.status = 'playing'
    st.enemies = structuredClone(enemies)
    inv.hand = [...hand]
    inv.handSize = hand.length
    inv.assets = structuredClone(assets)
    inv.resources = 20
    inv.actionsLeft = 3
    st.legalMoves = moves || [
      { action: 'play', cardId: '01087', label: '打出手电筒' },
      { action: 'play', cardId: '01088', label: '打出应急物品' },
      { action: 'ability', assetId: 'asset-gun', abilityIndex: 0, targetId: 'enemy-1', label: '使用手枪攻击目标' },
    ]
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    submitted.push(body)
    if (onMove) return onMove(route, body, session)
    const st = session.state
    st.revision++
    if (body.move.action === 'play') {
      const inv = st.investigators[0]
      inv.hand.splice(inv.hand.indexOf(body.move.cardId), 1)
      inv.handSize = inv.hand.length
      if (body.move.cardId === '01087') inv.assets.push({ id: 'asset-flash', code: '01087', exhausted: false })
      st.legalMoves = st.legalMoves.filter(move => move.cardId !== body.move.cardId)
    }
    if (body.move.action === 'ability') st.investigators[0].assets.find(asset => asset.id === 'asset-gun').uses--
    if (body.move.action === 'choose') {
      if (st.pendingChoice?.kind === 'commit') {
        st.investigators[0].hand.splice(Number(body.move.optionId), 1)
        st.investigators[0].handSize--
        st.pendingChoice = { id: 'target-1', kind: 'target', seat: 0, prompt: '选择目标敌人', options: [{ id: 'enemy-1', label: '食尸鬼' }] }
        st.legalMoves = [{ action: 'choose', choiceId: 'target-1', optionId: 'enemy-1', label: '选择食尸鬼' }]
      } else { st.pendingChoice = null; st.legalMoves = [] }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
  await page.getByRole('button', { name: '跳过演出' }).click()
  return { submitted, get session() { return session } }
}

for (const count of [0, 1, 5, 12]) {
  test(`P4 手牌 ${count} 张时保持可读且不盖住装备与地图`, async ({ page }) => {
    await tableFixture(page, { hand: Array.from({ length: count }, (_, index) => ['01087', '01088', '01025', '01086', '01090'][index % 5]) })
    const hand = page.locator('.ah-table-player .ah-hand')
    await expect(hand.locator('.ah-hand-card')).toHaveCount(count)
    await expect(page.locator('.ah-table-map')).toBeVisible()
    await expect(page.getByRole('region', { name: '装备与威胁' })).toBeVisible()
    if (count) {
      await hand.locator('.ah-hand-card').last().scrollIntoViewIfNeeded()
      await expect(hand.locator('.ah-hand-card').last()).toBeVisible()
      const box = await hand.locator('.ah-hand-card').last().boundingBox()
      const player = await page.locator('.ah-table-player').boundingBox()
      expect(box.y).toBeGreaterThanOrEqual(player.y - 2)
      expect(box.y + box.height).toBeLessThanOrEqual(player.y + player.height + 2)
    } else await expect(hand).toContainText('当前没有手牌')
  })
}

test('P4 鼠标选择、拖拽高亮、非法原因与资产标记能力', async ({ page }) => {
  const fixture = await tableFixture(page, { hand: ['01088', '01087'], assets: [
    { id: 'asset-gun', code: '01016', uses: 3, damage: 1, horror: 1, exhausted: false },
  ] })
  const hand = page.locator('.ah-table-player .ah-hand')
  await expect(page.getByRole('region', { name: '装备与威胁' })).toBeVisible()
  await hand.locator('[data-card-code="01088"]').click()
  await expect(page.locator('.ah-context-name')).toContainText('应急物品')
  await page.getByRole('button', { name: '取消选择' }).click()
  await page.dragAndDrop('.ah-hand [data-card-code="01088"]', '.ah-equip-slot[data-slot="hand"][data-slot-index="0"]')
  await expect(page.getByText('此处不能使用这张牌，已放回原位。')).toBeVisible()
  expect(fixture.submitted).toHaveLength(0)
  await page.dragAndDrop('.ah-hand [data-card-code="01087"]', '.ah-equip-slot[data-slot="hand"][data-slot-index="0"]')
  await expect.poll(() => fixture.submitted.length).toBe(1)
  expect(fixture.submitted[0].move).toMatchObject({ action: 'play', cardId: '01087' })
  const gun = page.locator('.ah-equip-slot [data-card-code="01016"]')
  await expect(gun.locator('[data-card-marker="uses"]')).toHaveAttribute('aria-label','剩余使用次数 3')
  await expect(gun.locator('[data-card-marker="damage"]')).toHaveAttribute('aria-label','伤害 1')
  await expect(gun.locator('[data-card-marker="horror"]')).toHaveAttribute('aria-label','恐惧 1')
  await gun.click()
  await page.getByRole('button', { name: '使用手枪攻击目标' }).click()
  await expect.poll(() => fixture.submitted.length).toBe(2)
  expect(fixture.submitted[1].move).toMatchObject({ action: 'ability', assetId: 'asset-gun', targetId: 'enemy-1' })
  await expect(gun.locator('[data-card-marker="uses"]')).toHaveAttribute('aria-label','剩余使用次数 2')
})

test('P4 键盘选牌并提交，版本冲突后清除选中状态', async ({ page }) => {
  let conflict = false
  const fixture = await tableFixture(page, { onMove: async (route, body, session) => {
    conflict = true
    session.state.revision++
    session.state.legalMoves = []
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false,
      code: 'STALE_REVISION', error: '状态版本已变化', session }) })
  } })
  const card = page.locator('.ah-hand [data-card-code="01087"]')
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.ah-context-name')).toContainText('手电筒')
  await expect(page.locator('.ah-equip-slot[data-slot="hand"][data-slot-index="0"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect.poll(() => conflict).toBe(true)
  await expect(page.locator('.ah-context-name')).toHaveCount(0)
  await expect(page.getByText('状态版本已变化')).toBeVisible()
  await expect(page.locator('.ah-accepted-feedback')).toHaveCount(0)
  expect(fixture.submitted).toHaveLength(1)
})

test('P4 投入技能卡并在敌人身上续算目标选择', async ({ page }) => {
  const fixture = await tableFixture(page, {
    hand: ['01025', '01087'],
    enemies: [{ id: 'enemy-1', code: 'ghoulMinion', originalCode: '01160', name: '食尸鬼', location: 'study', fight: 2, evade: 2, health: 2, damageTaken: 0 }],
    pendingChoice: { id: 'commit-1', kind: 'commit', seat: 0, prompt: '选择投入卡牌', options: [{ id: 'done', label: '完成' }, { id: '0', label: '投入：致命打击' }] },
    moves: [{ action: 'choose', choiceId: 'commit-1', optionId: 'done', label: '完成' },
      { action: 'choose', choiceId: 'commit-1', optionId: '0', label: '投入：致命打击' }],
  })
  await page.locator('.ah-hand [data-card-code="01025"]').click()
  await expect.poll(() => fixture.submitted.length).toBe(1)
  expect(fixture.submitted[0].move).toMatchObject({ action: 'choose', optionId: '0' })
  const target = page.locator('.ah-enemy[data-choice-target="enemy-1"]')
  await expect(target).toBeVisible()
  await target.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => fixture.submitted.length).toBe(2)
  expect(fixture.submitted[1].move).toMatchObject({ action: 'choose', optionId: 'enemy-1' })
})

test('P4 双手卡占用两个槽位，触屏点选与点击动作同路', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 768, height: 1024 } })
  const page = await context.newPage()
  try {
    const fixture = await tableFixture(page, { hand: ['01087'], assets: [{ id: 'asset-shotgun', code: '01029', exhausted: true, uses: 2, damage: 1 }] })
    await expect(page.getByRole('region', { name: '装备与威胁' })).toBeVisible()
    await expect(page.locator('.ah-equip-slot[data-slot="hand"][data-slot-used="1"]')).toHaveCount(2)
    await expect(page.locator('.ah-slot-occupancy')).toContainText('双手占用')
    await page.locator('.ah-hand [data-card-code="01087"]').tap()
    await expect(page.locator('.ah-context-name')).toContainText('手电筒')
    await page.getByRole('button', { name: '出牌区', exact: true }).tap()
    await expect.poll(() => fixture.submitted.length).toBe(1)
    expect(fixture.submitted[0].move.action).toBe('play')
  } finally { await context.close() }
})

test('P4 拖拽时只高亮合法槽位，Escape 可取消', async ({ page }) => {
  const fixture = await tableFixture(page, { hand: ['01087'] })
  await expect(page.getByRole('region', { name: '装备与威胁' })).toBeVisible()
  const card = page.locator('.ah-hand [data-card-code="01087"]')
  const box = await card.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 - 45, { steps: 8 })
  await expect(page.locator('.ah-drag-proxy')).toHaveCount(1)
  await expect(page.locator('.ah-equip-slot[data-slot="hand"][data-slot-index="0"]')).toHaveClass(/ah-drop-valid/)
  await expect(page.locator('.ah-equip-slot[data-slot="ally"]')).toHaveClass(/ah-drop-invalid/)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.locator('.ah-drag-proxy')).toHaveCount(0)
  await expect(page.locator('.ah-drop-valid, .ah-drop-invalid')).toHaveCount(0)
  expect(fixture.submitted).toHaveLength(0)
})

test('P4 服务端确认后才显示反馈，减弱动画设置生效', async ({ page }) => {
  let release
  let received = false
  const gate = new Promise(resolve => { release = resolve })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const fixture = await tableFixture(page, { hand: ['01087'], onMove: async (route, body, session) => {
    received = true
    await gate
    session.state.revision++
    session.state.investigators[0].hand = []
    session.state.investigators[0].handSize = 0
    session.state.legalMoves = []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session }) })
  } })
  await page.locator('.ah-hand [data-card-code="01087"]').click()
  await page.getByRole('button', { name: '出牌区', exact: true }).click()
  await expect.poll(() => received).toBe(true)
  await expect(page.locator('.ah-accepted-feedback')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '出牌区', exact: true })).not.toHaveClass(/ah-drop-valid/)
  release()
  await expect(page.locator('.ah-accepted-feedback')).toBeVisible()
  expect(await page.locator('.ah-accepted-feedback').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  expect(fixture.submitted).toHaveLength(1)
})

test('P4 实际 Edge 浏览器牌桌验收截图', async ({ page, request }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, playerCount: 1, seed: 'p4-acceptance' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.locator('.ah-hub-setup').getByText('玩家人数').locator('..').locator('select').selectOption('1')
  const started = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const sessionId = (await (await started).json()).session.sessionId
  await page.getByRole('button', { name: '选择调查员', exact: true }).click()
  await page.getByRole('button', { name: /选择调查员：罗兰/ }).first().click()
  await page.getByRole('button', { name: /自动构筑/ }).first().click()
  await page.getByRole('button', { name: '确认准备', exact: true }).first().click()
  await page.getByRole('button', { name: '开始当前关卡' }).first().click()
  await page.getByRole('button', { name: '跳过演出' }).click()
  await page.getByRole('region', { name: '待决选择' }).getByRole('button', { name: '保留起始手牌' }).click()
  const response = await request.get(`/api/session?sessionId=${encodeURIComponent(sessionId)}`)
  let current = (await response.json()).session
  for (let i = 0; current.state.pendingChoice; i++) {
    expect(i).toBeLessThan(20)
    const move = current.state.legalMoves.find(item => ['done', 'skip', 'self'].includes(item.optionId)) || current.state.legalMoves[0]
    const result = await request.post('/api/move', { data: { sessionId, revision: current.state.revision,
      move: { ...move, revision: current.state.revision } } })
    expect(result.ok()).toBe(true)
    current = (await result.json()).session
  }
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(page.getByRole('region', { name: '待决选择' })).toHaveCount(0)
  await expect(page.locator('.ah-table-player .ah-hand-card')).toHaveCount(5)
  const playableAsset = current.state.legalMoves.find(move => move.action === 'play' && current.state.cards[move.cardId]?.type === 'asset')
  if (playableAsset) {
    await page.locator(`.ah-hand-card[data-card-code="${playableAsset.cardId}"]`).first().click()
    await page.getByRole('button', { name: '出牌区', exact: true }).click()
    await expect(page.locator('.ah-table-player .ah-hand-card')).toHaveCount(4)
  }
  current = (await (await request.get(`/api/session?sessionId=${encodeURIComponent(sessionId)}`)).json()).session
  for (let i = 0; current.state.pendingChoice; i++) {
    expect(i).toBeLessThan(20)
    const move = current.state.legalMoves.find(item => ['done', 'skip', 'self'].includes(item.optionId)) || current.state.legalMoves[0]
    const result = await request.post('/api/move', { data: { sessionId, revision: current.state.revision,
      move: { ...move, revision: current.state.revision } } })
    expect(result.ok()).toBe(true)
    current = (await result.json()).session
  }
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(page.getByRole('region', { name: '待决选择' })).toHaveCount(0)
  const showcaseMove = current.state.legalMoves.find(move => move.action === 'play'
    && current.state.cards[move.cardId]?.type !== 'skill')
  const showcaseCard = showcaseMove
    ? page.locator(`.ah-table-player .ah-hand-card[data-card-code="${showcaseMove.cardId}"]`).first()
    : page.locator('.ah-table-player .ah-hand-card').first()
  await showcaseCard.click()
  await expect(page.locator('.ah-context-name')).toBeVisible()
  for (const selector of ['.ah-script-card .ah-table-art', '.ah-table-map .ah-table-art', '.ah-table-player .ah-hand-card .ah-table-art']) {
    await expect(page.locator(selector).first()).toHaveAttribute('data-image-state', 'displayable')
    await expect.poll(() => page.locator(`${selector} img`).first().evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  }
  const output = path.join(root, 'artifacts', 'arkham-p4-acceptance.png')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  await page.screenshot({ path: output, animations: 'disabled' })
  expect(fs.statSync(output).size).toBeGreaterThan(20_000)
})

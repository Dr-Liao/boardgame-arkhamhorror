import { test, expect } from '@playwright/test'

test('N4.6 手牌拖拽、装备栏槽位与地点地图通过 move 校验提交', async ({ page }) => {
  let fakeSession = null
  await page.route('**/api/start', async route => {
    const response = await route.fetch({
      postData: JSON.stringify({
        modId: 'arkhamhorror',
        settings: { seed: 'n4-ui', teammates: 0, opponents: [], playerInvestigator: '01001', legacyAutoStart: true },
      }),
    })
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    fakeSession = payload.session
    const st = fakeSession.state
    const inv = st.investigators[0]
    st.pendingChoice = null
    st.status = 'playing'
    st.currentSeat = 0
    st.phase = 'investigation'
    st.locations = [
      { id: 'study', name: '书房', shroud: 2, clues: 0, connections: ['hallway'], revealed: true, victory: 0 },
      { id: 'hallway', name: '走廊', shroud: 1, clues: 0, connections: ['study'], revealed: false, victory: 0 },
    ]
    inv.location = 'study'
    inv.hand = ['01087']
    inv.handSize = 1
    inv.assets = []
    inv.resources = 20
    inv.actionsLeft = 3
    st.legalMoves = [
      { action: 'play', cardId: '01087', label: '装备手电筒' },
      { action: 'move', locationId: 'hallway', label: '移动到走廊' },
    ]
    await route.fulfill({ response, json: payload })
  })
  const posted = []
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    posted.push(body.move)
    const st = fakeSession.state
    st.revision += 1
    if (body.move.action === 'play') {
      st.investigators[0].hand = []
      st.investigators[0].assets = [{ id: 'asset-01087', code: '01087', exhausted: false }]
      st.legalMoves = [{ action: 'move', locationId: 'hallway', label: '移动到走廊' }]
    } else if (body.move.action === 'move') {
      st.investigators[0].location = body.move.locationId
      st.legalMoves = []
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: fakeSession }) })
  })

  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const startResponse = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await (await startResponse).json()

  const map = page.locator('.ah-location-map')
  await expect(map.locator('[data-location-id="study"]')).toHaveAttribute('data-current-location', 'true')
  await expect(map.locator('[data-location-id="hallway"]')).toHaveAttribute('data-adjacent', 'true')
  await map.locator('[data-location-id="hallway"]').click()
  await expect(page.locator('[data-location-move="hallway"]')).toBeVisible()
  await page.getByRole('button', { name: '展开装备' }).click()
  await expect(page.locator('.ah-equip-slot[data-slot="hand"]')).toContainText('0/2')

  await page.dragAndDrop('.ah-hand [data-card-code="01087"]', '.ah-equip-slot[data-slot="hand"]')
  await expect.poll(() => posted.length).toBe(1)
  expect(posted[0]).toMatchObject({ action: 'play', cardId: '01087' })
  await expect(page.locator('.ah-equip-slot[data-slot="hand"]')).toContainText('手电筒')
  await expect(page.locator('.ah-equip-slot[data-slot="hand"]')).toContainText('1/2')

  await page.getByRole('button', { name: '关闭装备面板' }).click()
  await map.locator('[data-location-id="hallway"]').click()
  await page.locator('[data-location-move="hallway"]').click()
  await expect.poll(() => posted.length).toBe(2)
  expect(posted[1]).toMatchObject({ action: 'move', locationId: 'hallway' })
  await expect(page.locator('[data-location-id="hallway"]')).toHaveAttribute('data-current-location', 'true')
})

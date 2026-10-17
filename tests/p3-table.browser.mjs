import { test, expect } from '@playwright/test'

async function openTable(page) {
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, playerCount: 1, legacyAutoStart: true, seed: 'p3-layout' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const started = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
  return (await (await started).json()).session
}

test('简洁牌桌在桌面、平板和窄屏保持主操作可见，详情按需展开', async ({ page }) => {
  await openTable(page)
  await expect(page.locator('.ah-script-card .ah-table-art').first()).toHaveAttribute('data-image-state', 'displayable')
  await expect(page.locator('.ah-table-map .ah-loc .ah-table-art').first()).toHaveAttribute('data-image-state', 'displayable')
  await expect(page.locator('.ah-table-player .ah-minicard .ah-table-art').first()).toHaveAttribute('data-image-state', 'displayable')
  for (const viewport of [
    { width: 1920, height: 1080 }, { width: 1366, height: 768 },
    { width: 768, height: 1024 }, { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    for (const region of ['剧本区', '地点地图', '玩家区', '上下文动作栏']) {
      const element = page.getByRole('region', { name: region })
      await expect(element).toBeVisible()
      const box = await element.boundingBox()
      expect(box.width).toBeGreaterThan(30)
      expect(box.height).toBeGreaterThan(30)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2)
    }
    await expect(page.locator('.ah-table-map .ah-loc-map-card').first()).toBeVisible()
    await expect(page.locator('.ah-table-player .ah-hand')).toBeVisible()
    await expect(page.getByRole('region', { name: '装备与威胁' })).toBeVisible()
    await expect(page.locator('.ah-equipment-tray')).toHaveCount(0)
    await expect(page.locator('.ah-status-drawer')).toBeHidden()
    const choice = page.getByRole('region', { name: '待决选择' })
    await expect(choice).toBeVisible()
    const choiceBox = await choice.boundingBox()
    expect(choiceBox.y).toBeGreaterThanOrEqual(0)
    expect(choiceBox.y + choiceBox.height).toBeLessThanOrEqual(viewport.height + 2)
    await expect(choice.locator('.ah-choice-option').first()).toBeVisible()
  }
  await page.getByRole('region', { name: '待决选择' }).locator('.ah-choice-option').first().click()
  await expect(page.getByRole('region', { name: '待决选择' })).toHaveCount(0)
  await page.getByRole('button', { name: '局势', exact: true }).click()
  await expect(page.getByRole('region', { name: '队伍条' })).toBeVisible()
  await expect(page.getByRole('region', { name: '阶段轨' })).toBeVisible()
  await page.getByRole('button', { name: '关闭局势详情' }).click()
  await page.getByRole('button', { name: '展开时间线' }).click()
  await expect(page.locator('.ah-table-timeline .ah-log')).toBeVisible()
  await page.getByRole('button', { name: '收起时间线' }).click()
  await expect(page.locator('.ah-table-timeline .ah-log')).toBeHidden()
})

test('P3 卡图不可用时保留卡名与点击详情', async ({ page }) => {
  await page.route('**/mods/arkhamhorror/img/**', route => route.abort())
  await page.route('**://assets.arkhamhorror.app/**', route => route.abort())
  await openTable(page)
  const card = page.locator('.ah-table-player .ah-minicard').first()
  await expect(card).toBeVisible()
  await expect(card.locator('.ah-table-art')).toHaveAttribute('data-image-state', 'text-fallback', { timeout: 20000 })
  await expect(card.locator('.ah-table-art-fallback')).toContainText(/\S/)
  await card.click({ button: 'right' })
  await expect(page.getByRole('dialog', { name: '卡牌详情' })).toBeVisible()
})

test('P3 遭遇敌人展示真实卡图', async ({ page, request }) => {
  let session = await openTable(page)
  for (let i = 0; !session.state.enemies.length; i++) {
    expect(i).toBeLessThan(80)
    const moves = session.state.legalMoves
    const move = session.state.pendingChoice
      ? moves.find(item => ['done', 'skip', 'self'].includes(item.optionId)) || moves[0]
      : moves.find(item => item.action === 'endTurn')
    expect(move).toBeTruthy()
    const response = await request.post('/api/move', { data: { sessionId: session.sessionId,
      revision: session.state.revision, move: { ...move, revision: session.state.revision } } })
    expect(response.ok()).toBe(true)
    session = (await response.json()).session
  }
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(page.locator('.ah-enemy .ah-table-art').first()).toHaveAttribute('data-image-state', 'displayable')
})

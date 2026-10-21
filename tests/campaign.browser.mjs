import { test, expect } from '@playwright/test'

test('N4 真实关间界面：合法动作败退后显示个人XP，购买并继承到下关', async ({ page, request }) => {
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, seed: 'n4-legal-campaign', playerCount: 1, teammates: 0, opponents: [], playerInvestigator: '01001', difficulty: 'standard', legacyAutoStart: true } }) })
  }, { times: 1 })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const startResponse = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const initial = await (await startResponse).json()
  expect(initial.ok).toBe(true)
  let session = initial.session
  // 测试绕过页面直接调接口推进，客户端会把中间每一步都排进演出队列；这里逐幕跳过，
  // 直到牌桌不再处于演出状态。expectedRevision 用来先等客户端追上服务端版本。
  const drainPresentation = async expectedRevision => {
    if (expectedRevision != null) {
      await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(expectedRevision), { timeout: 20000 })
      await page.waitForTimeout(250)
    }
    for (let guard = 0; guard < 80; guard++) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) {
        await skip.first().click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(150)
        continue
      }
      const presenting = await page.locator('.ah-table').evaluate(el => el.classList.contains('ah-presenting'))
      if (!presenting) {
        // 刷新后的演出可能还没排队：再确认一次，避免提前放行后又弹出全屏演出。
        await page.waitForTimeout(250)
        if (!(await page.locator('.ah-table').evaluate(el => el.classList.contains('ah-presenting')))) return
        continue
      }
      await page.waitForTimeout(250)
    }
    await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/, { timeout: 10000 })
  }
  // 进入关卡先播「故事导入 → 密谋揭示」，演完才轮到换牌；先跳过它，后面的接口推进才点得到「刷新局势」。
  await expect(page.locator('.ah-cinematic, [data-choice-kind="mulligan"]').first()).toBeVisible()
  await drainPresentation()
  // 测试绕过页面直接调 API 推进了多步；刷新后必须先消费演示队列，否则面板仍是初始换牌。
  for (let i = 0; session.state.pendingChoice?.kind !== 'interlude'; i++) {
    expect(i).toBeLessThan(150)
    const moves = session.state.legalMoves
    const command = session.state.pendingChoice
      ? moves.find(move => ['done', 'skip', 'self'].includes(move.optionId)) || moves[0]
      : moves.find(move => move.action === 'endTurn')
    expect(command).toBeTruthy()
    const response = await request.post('/api/move', { data: {
      sessionId: session.sessionId, revision: session.state.revision, move: { ...command, revision: session.state.revision },
    } })
    const body = await response.json()
    expect(body.ok, body.error).toBe(true)
    session = body.session
  }
  await page.getByRole('button', { name: '刷新局势' }).click()
  await drainPresentation(session.state.revision)
  const situation = page.getByRole('dialog', { name: '调查局势' })
  const openSituation = async () => { await page.getByRole('button', { name: '局势', exact: true }).click(); await expect(situation).toBeVisible() }
  const closeSituation = async () => { await page.getByRole('button', { name: '关闭局势详情' }).click(); await expect(situation).toHaveCount(0) }
  const panel = page.getByRole('region', { name: '待决选择' })
  await expect(panel).toHaveAttribute('data-choice-kind', 'interlude', { timeout: 20000 })
  await openSituation()
  await expect(situation.locator('[data-campaign-seat="0"]')).toContainText('2 XP')
  await expect(situation.locator('.ah-campaign-panel')).toContainText('关间准备')
  await closeSituation()
  await expect(page.locator('.ah-actions')).toHaveCount(0)
  await panel.locator('[data-option-id="upgrade"]').click()
  await expect(panel).toHaveAttribute('data-choice-kind', 'upgradeCard')
  await panel.locator('.ah-choice-option:not([data-option-id="cancel"])').first().click()
  await expect(panel).toHaveAttribute('data-choice-kind', 'upgradeRemove')
  await panel.locator('.ah-choice-option:not([data-option-id="cancel"])').first().click()
  await expect(panel).toHaveAttribute('data-choice-kind', 'interlude', { timeout: 20000 })
  await openSituation()
  await expect(situation.locator('[data-campaign-seat="0"]')).toContainText('1 XP（已花费 1）')
  await closeSituation()
  await panel.locator('[data-option-id="done"]').click()
  // 下一关同样先播开场故事，演完才弹换牌面板：跳过演出直到换牌出现。
  await expect.poll(async () => {
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) { await skip.first().click(); return false }
    return (await page.locator('[data-choice-kind="mulligan"]').count()) > 0
  }, { timeout: 30000 }).toBe(true)
  await expect(panel).toHaveAttribute('data-choice-kind', 'mulligan')
  await openSituation()
  await expect(situation.locator('.ah-campaign-scenario')).toContainText('午夜假面')
  await closeSituation()
  await panel.locator('[data-option-id="done"]').click()
  await expect(panel).toHaveCount(0, { timeout: 15000 })
  await drainPresentation()
  await expect(page.locator('.ah-actions')).toBeVisible()
  await openSituation()
  await expect(situation.locator('.ah-campaign-panel details')).toHaveCount(1)
  await situation.locator('.ah-campaign-panel summary').click()
  await expect(situation.locator('.ah-campaign-panel details')).toContainText('本关 +2 XP')
  const snapshot = await (await request.get('/api/session?sessionId=' + session.sessionId)).json()
  expect(snapshot.session.state.campaign.investigators[0].purchases).toHaveLength(1)
  expect(snapshot.session.state.investigators[0].handSize).toBe(5)
  expect(snapshot.session.state.investigators[0].resources).toBe(5)
})

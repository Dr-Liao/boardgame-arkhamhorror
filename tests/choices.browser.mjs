import { test, expect } from '@playwright/test'

async function startGame(page, rewrite = session => session) {
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({
      postData: JSON.stringify({
        ...body,
        settings: { ...body.settings, seed: 731, playerCount: 2, teammates: 1, opponents: [null], playerInvestigator: '01001', legacyAutoStart: true },
      }),
    })
    const payload = await response.json()
    if (payload.ok) payload.session = rewrite(payload.session)
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const response = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const payload = await (await response).json()
  expect(payload.ok).toBe(true)
  await expect(page.getByRole('region', { name: '待决选择' })).toBeVisible()
  return payload.session
}

function choiceMoves(session) {
  return session.state.legalMoves.filter(move => move.action === 'choose' && move.choiceId === session.state.pendingChoice.id)
}

function firstCardChoice(session) {
  const moves = choiceMoves(session)
  const move = moves.find(move => !['keep', 'done', 'skip', 'confirm'].includes(move.optionId))
  expect(move, '真实开局必须提供至少一个可换手牌选项').toBeTruthy()
  return move
}

async function clickOption(page, move) {
  await page.locator('[data-option-id="' + move.optionId + '"]:visible').first().click()
}

test('真实开局换牌展示合法回答与隐藏信息计数，提交携带版本且双击只提交一次', async ({ page }) => {
  const session = await startGame(page)
  const panel = page.getByRole('region', { name: '待决选择' })
  expect(session.state.pendingChoice.kind).toBe('mulligan')
  await expect(panel).toHaveAttribute('data-choice-seat', '0')
  await expect(panel).toContainText(session.state.pendingChoice.prompt)
  await expect(panel.locator('.ah-direct-instruction')).toContainText('点选手牌换牌')
  const ids = await page.locator('[data-option-id]:visible').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('data-option-id')))])
  expect(ids.sort()).toEqual(choiceMoves(session).map(move => move.optionId).sort())
  await expect(page.locator('.ah-actions')).toHaveCount(0)
  await page.getByRole('button', { name: '局势', exact: true }).click()
  const situation = page.getByRole('dialog', { name: '调查局势' })
  await expect(situation.locator('.ah-rules-note')).toContainText('简化模式')
  for (const investigator of session.state.investigators) {
    const card = situation.locator(`.ah-situ-inv[data-seat="${investigator.seat}"]`)
    await expect(card).toContainText('牌库 ' + investigator.deckSize)
    await expect(card).toContainText('手牌（' + investigator.handSize + '）')
    expect(investigator.deck).toEqual([])
    if (session.players[investigator.seat].role !== 'human') {
      expect(investigator.hand).toEqual([])
      await expect(card).toContainText('手牌内容未公开')
      await expect(card.locator('.ah-minicard')).toHaveCount(0)
    }
  }
  await page.getByRole('button', { name: '关闭局势详情' }).click()
  await expect(situation).toHaveCount(0)

  const move = firstCardChoice(session)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const submitted = []
  await page.route('**/api/move', async route => {
    submitted.push(route.request().postDataJSON())
    await gate
    await route.continue()
  })
  const response = page.waitForResponse('**/api/move')
  const index = ids.indexOf(move.optionId)
  await page.locator('[data-option-id="' + move.optionId + '"]:visible').first().evaluate(button => { button.click(); button.click() })
  try {
    await expect(panel).toHaveAttribute('aria-busy', 'true')
    await expect(panel.locator('.ah-choice-option:enabled')).toHaveCount(0)
    await expect(page.locator('.ah-session-menu-items button').filter({ hasText: '再来一局' })).toBeDisabled()
  } finally {
    release()
  }
  const payload = await (await response).json()
  expect(payload.ok).toBe(true)
  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toMatchObject({
    revision: session.state.revision,
    move: { action: 'choose', choiceId: session.state.pendingChoice.id, optionId: move.optionId, revision: session.state.revision },
  })
  expect(payload.session.state.revision).toBeGreaterThan(session.state.revision)
  expect(payload.session.state.investigators[0].actionsLeft).toBe(session.state.investigators[0].actionsLeft)
})

test('错误选项不改变规则状态，原版本的合法回答仍可提交', async ({ page }) => {
  const session = await startGame(page)
  const panel = page.getByRole('region', { name: '待决选择' })
  await page.getByRole('button', { name: '展开时间线' }).click()
  const log = await page.locator('.ah-log').innerText()
  const move = firstCardChoice(session)
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body, move: { ...body.move, optionId: '__invalid_choice__' } }) })
  }, { times: 1 })
  const rejected = page.waitForResponse('**/api/move')
  await clickOption(page, move)
  const error = await (await rejected).json()
  expect(error.ok).toBe(false)
  expect(error.session.state).toEqual(session.state)
  await expect(page.getByText(error.error, { exact: true })).toBeVisible()
  await expect(panel).toHaveAttribute('data-choice-id', session.state.pendingChoice.id)
  await expect(panel.locator('.ah-choice-option').first()).toBeEnabled()
  expect(await page.locator('.ah-log').innerText()).toBe(log)
  const accepted = page.waitForResponse('**/api/move')
  await clickOption(page, move)
  const payload = await (await accepted).json()
  expect(payload.ok).toBe(true)
  expect(payload.session.state.revision).toBeGreaterThan(session.state.revision)
})

test('真实陈旧版本错误刷新到最新投影，不自动重放且可再次选择', async ({ page, request }) => {
  const session = await startGame(page)
  const { label, ...move } = firstCardChoice(session)
  const advance = await request.post('/api/move', {
    data: { sessionId: session.sessionId, revision: session.state.revision, move: { ...move, revision: session.state.revision } },
  })
  const latest = await advance.json()
  expect(latest.ok).toBe(true)
  expect(latest.session.state.revision).toBeGreaterThan(session.state.revision)
  const submitted = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/move') submitted.push(request.postDataJSON())
  })
  const rejected = page.waitForResponse('**/api/move')
  await page.locator('.ah-choice-option').first().click()
  const response = await rejected
  expect(response.status()).toBe(409)
  const error = await response.json()
  expect(error.code).toBe('STALE_REVISION')
  expect(error.session.state).toEqual(latest.session.state)
  await expect(page.getByText(error.error, { exact: true })).toBeVisible()
  await expect(page.locator('.bg-game')).toHaveAttribute('data-revision', String(latest.session.state.revision))
  await expect(page.locator('.ah-action').first()).toBeEnabled()
  expect(submitted).toHaveLength(1)
  const accepted = page.waitForResponse('**/api/move')
  await page.locator('.ah-action').first().click()
  const payload = await (await accepted).json()
  expect(payload.ok).toBe(true)
  expect(submitted).toHaveLength(2)
  expect(submitted[1].revision).toBe(latest.session.state.revision)
})

test('刷新局势使用只读快照，不提交或推进待决选择', async ({ page }) => {
  const session = await startGame(page)
  const submitted = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/move') submitted.push(request.url())
  })
  const response = page.waitForResponse(url => new URL(url.url()).pathname === '/api/session')
  await page.getByRole('button', { name: '刷新局势' }).click()
  const payload = await (await response).json()
  expect(payload.ok).toBe(true)
  expect(payload.busy).toBe(false)
  expect(payload.session.state).toEqual(session.state)
  expect(payload.session.events).toEqual(session.events)
  await page.getByRole('button', { name: '局势', exact: true }).click()
  await expect(page.getByText('局势已刷新，请根据当前合法选项操作。')).toBeVisible()
  expect(submitted).toHaveLength(0)
  await expect(page.getByRole('region', { name: '待决选择' })).toHaveAttribute('data-choice-id', session.state.pendingChoice.id)
})

test('UI 响应夹具：答题权限随人类与 AI 待决座位切换而非回合座位', async ({ page }) => {
  const session = await startGame(page, original => {
    original.state.currentSeat = 1
    return original
  })
  const panel = page.getByRole('region', { name: '待决选择' })
  await expect(panel.locator('.ah-choice-option').first()).toBeEnabled()
  await expect(page.locator('.bg-game-status')).toContainText('请你回答')
  const ai = structuredClone(session)
  ai.state.currentSeat = 0
  ai.state.revision += 1
  ai.state.pendingChoice = {
    id: 'ui-ai-choice', kind: 'reaction', seat: 1, source: 'UI 座位切换夹具',
    prompt: '请 AI 队友决定是否反应', options: [], canSkip: true,
  }
  ai.state.legalMoves = []
  await page.route('**/api/move', route => route.fulfill({ json: { ok: true, session: ai } }), { times: 1 })
  await panel.locator('.ah-choice-option').first().click()
  await expect(panel).toHaveAttribute('data-choice-seat', '1')
  await expect(panel.locator('.ah-choice-option')).toHaveCount(0)
  await expect(panel).toContainText('等待队友操作')
  await expect(page.locator('.ah-actions')).toHaveCount(0)
  const human = structuredClone(session)
  human.state.revision = ai.state.revision + 1
  human.state.legalMoves.push({ action: 'draw', label: '不应展示的普通行动' })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, busy: false, session: human } }), { times: 1 })
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(panel).toHaveAttribute('data-choice-seat', '0')
  await expect(panel.locator('.ah-choice-option').first()).toBeEnabled()
  await expect(page.locator('.bg-game-status')).toContainText('请你回答')
  await expect(page.getByText('不应展示的普通行动')).toHaveCount(0)
})

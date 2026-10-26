// 联机快速反应：开了自动跳过时，房主的「忙碌快照」不能先把反应窗口画出来。
// 联机命令会先带着 busy=true 推一份快照（房主还在结算上一步），这时提交会被拒绝；
// 旧实现因为「现在不能行动」而放弃自动跳过，于是玩家会看到反应内容一闪而过。
import { test, expect } from '@playwright/test'

const reactionChoice = () => ({
  id: 'reaction-online', kind: 'reaction', seat: 0, canSkip: true, source: 'scavenging',
  prompt: '快速反应：搜寻是否发动？',
  options: [{ id: 'skip', label: '跳过反应' }, { id: 'trigger', label: '发动反应', cardCode: '01073' }],
})

test('联机忙碌快照不会先画出已关闭的快速反应窗口', async ({ page, request }) => {
  const started = await (await request.post('/api/start', {
    data: { modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 2, seed: 'online-reaction-skip' } },
  })).json()
  expect(started.ok, started.error).toBe(true)
  const base = started.session
  // 借用一份真实对局，只把待决选择换成「唯一可选反应已在本机关闭」的窗口。
  base.events = []
  base.online = true
  base.mySeat = 0
  base.observerSeat = 0
  base.actingSeats = [0]
  base.settings = {}
  // 非首轮、非 0 版本号让牌桌跳过「故事导入」演出，直接进入待决窗口。
  base.state.round = 2
  base.state.revision = 12
  base.state.pendingChoice = reactionChoice()
  base.state.legalMoves = reactionChoice().options.map(option => ({
    action: 'choose', choiceId: 'reaction-online', optionId: option.id, label: option.label,
  }))
  const revision = base.state.revision
  let busy = true, serial = 1, advanced = null

  const view = () => JSON.parse(JSON.stringify(advanced || base))
  const room = { code: 'REACT01', phase: 'playing', capacity: 2, aiSeats: [{ seat: 1, name: 'AI 队友' }],
    game: { id: 'arkhamhorror', name: '诡镇奇谈 · 卡牌版' },
    members: [{ id: 'host-member', name: '房主', seat: 0, host: true, online: true, ready: true }] }

  await page.addInitScript(({ sessionId }) => {
    localStorage.setItem('arkham-presentation', JSON.stringify({ sound: false, fast: true }))
    // 本机把这张卡的反应关掉（等同玩家点了卡面上的闪电开关）。
    localStorage.setItem(`arkham-reactions:${sessionId}:0`, JSON.stringify(['01073']))
    window.__reactionPanels = 0
    new MutationObserver(() => {
      if (document.querySelector('[data-choice-kind="reaction"]')) window.__reactionPanels++
    }).observe(document, { childList: true, subtree: true })
  }, { sessionId: base.sessionId })

  await page.route('**/api/online/status*', async route => {
    // 长轮询：慢一点返回，避免测试里的轮询变成死循环。
    await new Promise(resolve => setTimeout(resolve, 40))
    await route.fulfill({ json: { ok: true, instanceId: 'online-reaction-hall', serial: serial++, connected: true,
      connecting: false, error: '', relayUrl: 'ws://127.0.0.1:1/ws', room, memberId: 'host-member',
      session: view(), busy, lobby: null, signals: [] } })
  })
  const commands = []
  await page.route('**/api/online/command', async route => {
    const body = route.request().postDataJSON()
    commands.push(body)
    if (body.action === 'move') {
      advanced = view()
      advanced.state.revision = revision + 1
      advanced.state.pendingChoice = null
      advanced.state.legalMoves = []
    }
    await route.fulfill({ json: { ok: true, session: view() } })
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('/index.html')
  await expect(page.locator('.ah-table')).toBeVisible()
  await expect(page.locator('.bg-online-banner')).toContainText('房间 REACT01')

  // P1：进局时客户端会把本机「反应关」集合用 prefs 命令同步给房主（不需要等窗口出现）。
  await expect.poll(() => commands.filter(command => command.action === 'prefs').length, { timeout: 10000 }).toBeGreaterThan(0)
  expect(commands.find(command => command.action === 'prefs').body.codes).toEqual(['01073'])

  // 房主还在结算（busy=true）：窗口必须继续藏着，也不能提交 skip。
  await expect(page.locator('.bg-game-status')).toHaveText('正在继续结算…')
  await page.waitForTimeout(600)
  await expect(page.locator('[data-choice-kind="reaction"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.__reactionPanels)).toBe(0)
  expect(commands.filter(command => command.action === 'move')).toEqual([])

  // 结算结束（busy=false）：自动跳过补发，牌桌推进，全程没有画出反应窗口。
  busy = false
  await expect.poll(() => commands.filter(command => command.action === 'move').length, { timeout: 10000 }).toBeGreaterThan(0)
  const moveCommand = commands.find(command => command.action === 'move')
  expect(moveCommand.action).toBe('move')
  expect(moveCommand.body.move).toEqual({ action: 'choose', choiceId: 'reaction-online', optionId: 'skip', revision })
  // 这条兜底 skip 同时把本机「反应关」集合带给房主（房主收到后会代答后续窗口）。
  expect(moveCommand.body.client?.autoPass?.codes).toEqual(['01073'])
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(revision + 1))
  await expect(page.locator('[data-choice-kind="reaction"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.__reactionPanels)).toBe(0)
  expect(errors).toEqual([])
})

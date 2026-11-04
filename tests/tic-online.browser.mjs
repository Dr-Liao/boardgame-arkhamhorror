// 《印斯茅斯暗潮》（TIC）P8 双真人联机浏览器证据（桌面 1440×950 / 移动 390×844）。
//
// 真实联机链路（与 tests/tfa-online.browser.mjs / tests/tde-online.browser.mjs 同构，不用任何
// page.route 改写）：
//   · relay/server.js#createRelay 中转服务 + 两个 lib/server.js#createServer({persist:false}) 大厅；
//   · POST /api/online/create|join|ready|command（x-boardgame-online:1 + 每次操作 operationId），
//     设置 campaignId=theInnsmouthConspiracy；
//   · 两名真人分别用 07001 玛丽修女 / 07002 阿曼达·夏普 准备（真实 /api/online/command move），
//     房主 hubSetLeader → hubBeginScenario → 双方各自结算开局待决选择，进入第一章 thePitOfDespair；
//   · 断言两份真实会话投影都是 TIC/第一章：各自手牌私有（对方座位 hand 为空）、两个页面都渲染
//     .ah-table、各自只看到自己座位的 .ah-hand[data-hand-seat]；
//   · 权限边界：客人用真实联机命令提交不属于自己的行动（离席/越权）必须被拒绝且 revision 不变；
//   · 断线恢复：关闭客人页面再重开，重新进入同一大厅后会话/版本号与房主一致、手牌仍私有。
// 截图与 annotation 交给 tools/playwright-tic-release-reporter.mjs 汇总（phase=online）。
import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { contentRegistry } from '../content/registered.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { createRelay } from '../../../relay/server.js'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import { TIC_CAMPAIGN, shot, annotate } from './tic-browser-helpers.mjs'

const ONLINE_TIMEOUT = 240_000
const FIRST = chapters[0]

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1',
  () => resolve(`http://127.0.0.1:${server.address().port}`)))
const stop = server => new Promise(resolve => {
  server.stopRelay?.(); server.online?.close(); server.closeAllConnections(); server.close(resolve)
})

function ticLaunchable() {
  try {
    contentRegistry.assertLaunchable(TIC_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P8 两名真人经中转服务进入《印斯茅斯暗潮》第一章（${viewport} ${width}×${height}）`, async ({ browser }, testInfo) => {
    test.skip(!ticLaunchable(), 'TIC 尚未在 content/registered.js 注册为可启动战役（等待 P8 生产注册）')
    testInfo.setTimeout(ONLINE_TIMEOUT)
    annotate(testInfo, 'viewport', viewport)
    annotate(testInfo, 'phase', 'online')
    annotate(testInfo, 'scenario', FIRST.id)

    const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
    const relay = createRelay()
    const relayUrl = await listen(relay)
    const halls = []
    let host, guest, guestReconnected, context
    try {
      for (let index = 0; index < 2; index++) {
        const server = createServer({ mods, persist: false })
        await server.ready
        halls.push({ server, url: await listen(server) })
      }
      const api = async (index, route, body) => {
        const response = await fetch(`${halls[index].url}/api/online/${route}`, {
          method: body ? 'POST' : 'GET',
          headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        })
        return response.json()
      }
      const command = (index, action, body = {}) => api(index, 'command',
        { action, body: { operationId: randomUUID(), ...body } })
      const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false,
        settings: { campaignId: TIC_CAMPAIGN, seed: `tic-online-${viewport}` } })
      expect(created.ok, created.error).toBe(true)
      const joined = await api(1, 'join', { relayUrl, code: created.room.code })
      expect(joined.ok, joined.error).toBe(true)
      expect((await api(1, 'ready', { ready: true })).ok).toBe(true)

      // 同一 browser context：两个大厅端口是不同 origin，各自保存自己的会话编号；
      // 断线恢复要重开页面后仍能读回同一 origin 的 localStorage 会话（新 context 会丢）。
      context = await browser.newContext({ viewport: { width, height } })
      host = await context.newPage()
      guest = await context.newPage()
      const errors = []
      for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message))
      await host.goto(halls[0].url)
      await guest.goto(halls[1].url)

      // a. 真实联机开局：房主 /api/online/command start，另一大厅看到同一 TIC 会话。
      const started = await command(0, 'start')
      expect(started.ok, started.error).toBe(true)
      expect(started.session.state.campaign.id).toBe(TIC_CAMPAIGN)
      await expect.poll(async () => (await api(1, 'status')).session?.state.campaign?.id).toBe(TIC_CAMPAIGN)
      expect((await api(0, 'status')).session.state.investigators.length).toBe(2)
      expect((await api(1, 'status')).session.state.investigators.length).toBe(2)

      const act = async (index, action, matches = () => true) => {
        let session, move
        for (let attempt = 0; attempt < 60; attempt++) {
          session = (await api(index, 'status')).session
          move = session.state.legalMoves.find(item => item.action === action && matches(item))
          if (move) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        expect(move, `${action} 不在座位 ${index} 的合法动作里；legal: ${JSON.stringify((session.state.legalMoves || [])
          .filter(item => item.action === action).slice(0, 4))}`).toBeTruthy()
        const result = await command(index, 'move', { revision: session.state.revision, move })
        expect(result.ok, result.error).toBe(true)
        return result.session
      }

      // b. 两名真人各自准备自己的调查员与牌组（真实 /api/online/command）。
      await act(0, 'hubGoSetup')
      await act(0, 'hubSelectInvestigator', move => move.code === '07001')
      await act(0, 'hubAutoDeck')
      await act(0, 'hubDoneSeat')
      await act(1, 'hubSelectInvestigator', move => move.code === '07002')
      await act(1, 'hubAutoDeck')
      await act(1, 'hubDoneSeat')
      await act(0, 'hubSetLeader')
      const entering = await act(0, 'hubBeginScenario')
      expect(entering.state.campaign.id).toBe(TIC_CAMPAIGN)

      // c. 开局待决选择（起手换牌等）由各自座位真实应答，直到双方都进入关卡。
      for (let guard = 0; guard < 100; guard++) {
        let changed = false
        for (let seat = 0; seat < 2; seat++) {
          const revision = (await api(0, 'status')).session.state.revision
          await expect.poll(async () => (await api(seat, 'status')).session.state.revision).toBe(revision)
          const own = (await api(seat, 'status')).session
          const move = own.state.legalMoves.find(item => item.action === 'choose' && ['done', 'skip'].includes(item.optionId))
            || own.state.legalMoves.find(item => item.action === 'choose')
          if (!move) continue
          const result = await command(seat, 'move', { revision: own.state.revision, move })
          expect(result.ok, result.error).toBe(true)
          changed = true
        }
        if (!changed) break
      }
      const hostPlaying = (await api(0, 'status')).session
      const guestPlaying = (await api(1, 'status')).session
      expect(hostPlaying.state.uiState).toBe('inScenario')
      expect(guestPlaying.state.uiState).toBe('inScenario')
      expect(hostPlaying.state.scenario.id).toBe(FIRST.id)
      expect(guestPlaying.state.scenario.id).toBe(FIRST.id)
      expect(hostPlaying.state.campaign.id).toBe(TIC_CAMPAIGN)

      // d. 手牌私有：服务端按座位投影（对方座位 hand 为空），界面各看自己的手牌。
      expect(hostPlaying.state.investigators[0].hand.length).toBeGreaterThan(0)
      expect(hostPlaying.state.investigators[1].hand).toEqual([])
      expect(guestPlaying.state.investigators[1].hand.length).toBeGreaterThan(0)
      expect(guestPlaying.state.investigators[0].hand).toEqual([])
      await expect(host.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
      await expect(guest.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
      await expect(host.locator('.ah-hand[data-hand-seat="0"]')).toBeVisible()
      await expect(guest.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible()
      expect(await host.locator('.ah-hand[data-hand-seat="1"]').count()).toBe(0)
      expect(await guest.locator('.ah-hand[data-hand-seat="0"]').count()).toBe(0)
      await expect(host.locator('.bg-game-title').first()).toContainText(FIRST.name)
      await expect(guest.locator('.bg-game-title').first()).toContainText(FIRST.name)
      annotate(testInfo, 'claim', 'privacy')
      await shot(host, testInfo, `p8-online-host-${viewport}`)
      await shot(guest, testInfo, `p8-online-guest-${viewport}`)

      // e. 权限边界：客人提交不属于自己的行动必须被拒绝，且会话 revision 不变。
      const beforeBoundary = (await api(0, 'status')).session.state.revision
      const denied = await command(1, 'move', { revision: beforeBoundary, move: { action: 'draw' } })
      expect(denied.ok, '越权/非应答座位的联机命令必须被拒绝').toBe(false)
      expect((await api(0, 'status')).session.state.revision).toBe(beforeBoundary)
      annotate(testInfo, 'claim', 'permission')

      // f. 断线恢复：关闭客人页面并重开同一大厅，会话/版本号与房主一致，手牌仍私有。
      await guest.close()
      guest = null
      guestReconnected = await context.newPage()
      guestReconnected.on('pageerror', error => errors.push(error.message))
      await guestReconnected.goto(halls[1].url)
      await expect(guestReconnected.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
      await expect.poll(async () => (await api(1, 'status')).session?.state.revision)
        .toBe((await api(0, 'status')).session.state.revision)
      const resumed = (await api(1, 'status')).session
      expect(resumed.state.scenario.id).toBe(FIRST.id)
      expect(resumed.state.investigators[1].hand.length).toBeGreaterThan(0)
      expect(resumed.state.investigators[0].hand).toEqual([])
      await expect(guestReconnected.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible()
      annotate(testInfo, 'claim', 'disconnect')
      await shot(guestReconnected, testInfo, `p8-online-reconnect-${viewport}`)

      expect(errors).toEqual([])
      expect(await host.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
      expect(await guestReconnected.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    } finally {
      await host?.close()
      await guest?.close()
      await guestReconnected?.close()
      await context?.close()
      await Promise.all(halls.map(hall => stop(hall.server)))
      await stop(relay)
    }
  })
}

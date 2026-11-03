import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createRelay } from '../../../relay/server.js'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

const output = fileURLToPath(new URL('../../../artifacts/tfa-migration/', import.meta.url))
mkdirSync(output, { recursive: true })
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1',
  () => resolve(`http://127.0.0.1:${server.address().port}`)))
const stop = server => new Promise(resolve => {
  server.stopRelay?.(); server.online?.close(); server.closeAllConnections(); server.close(resolve)
})

for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`两名真人经中转服务进入失落的时代 (${viewport})`, async ({ browser }) => {
    test.setTimeout(120_000)
    const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
    const relay = createRelay()
    const relayUrl = await listen(relay)
    const halls = []
    let host, guest
    try {
      for (let i = 0; i < 2; i++) {
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
      const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror',
        capacity: 2, fillAi: false, settings: { campaignId: 'theForgottenAge', seed: `tfa-online-${viewport}` } })
      expect(created.ok, created.error).toBe(true)
      const joined = await api(1, 'join', { relayUrl, code: created.room.code })
      expect(joined.ok, joined.error).toBe(true)
      expect((await api(1, 'ready', { ready: true })).ok).toBe(true)
      host = await browser.newPage({ viewport: { width, height } })
      guest = await browser.newPage({ viewport: { width, height } })
      const errors = []
      for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message))
      await host.goto(halls[0].url)
      await guest.goto(halls[1].url)
      const started = await command(0, 'start')
      expect(started.ok, started.error).toBe(true)
      expect(started.session.state.campaign.id).toBe('theForgottenAge')
      await expect.poll(async () => (await api(1, 'status')).session?.state.campaign?.id)
        .toBe('theForgottenAge')
      const hostStatus = (await api(0, 'status')).session
      const guestStatus = (await api(1, 'status')).session
      expect(hostStatus.state.investigators.length).toBe(2)
      expect(guestStatus.state.investigators.length).toBe(2)
      const act = async (index, action, matches = () => true) => {
        let session, move
        for (let attempt = 0; attempt < 40; attempt++) {
          session = (await api(index, 'status')).session
          move = session.state.legalMoves.find(item => item.action === action && matches(item))
          if (move) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        expect(move, `${action} unavailable to seat ${index}; legal: ${JSON.stringify(session.state.legalMoves.filter(item => item.action === action).slice(0, 4))}`).toBeTruthy()
        const result = await command(index, 'move', { revision: session.state.revision, move })
        expect(result.ok, result.error).toBe(true)
        return result.session
      }
      await act(0, 'hubGoSetup')
      await act(0, 'hubSelectInvestigator', move => move.code === '04001')
      await act(0, 'hubAutoDeck')
      await act(0, 'hubDoneSeat')
      await act(1, 'hubSelectInvestigator', move => move.code === '04002')
      await act(1, 'hubAutoDeck')
      await act(1, 'hubDoneSeat')
      await act(0, 'hubSetLeader')
      const entering = await act(0, 'hubBeginScenario')
      expect(entering.state.campaign.id).toBe('theForgottenAge')
      let progress = entering
      for (let guard = 0; progress.state.uiState !== 'inScenario' && guard < 40; guard++) {
        const pending = progress.state.pendingChoice
        expect(pending, `stalled at ${progress.state.uiState}`).toBeTruthy()
        const seat = pending.seat
        let own, option
        for (let attempt = 0; attempt < 40; attempt++) {
          own = (await api(seat, 'status')).session
          option = own.state.legalMoves.find(move => move.action === 'choose' && move.optionId === 'done')
            || own.state.legalMoves.find(move => move.action === 'choose')
          if (own.state.pendingChoice?.id === pending.id && option) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        expect(option, `no choice for ${pending.kind} on seat ${seat}`).toBeTruthy()
        const chosen = await command(seat, 'move', { revision: own.state.revision, move: option })
        expect(chosen.ok, chosen.error).toBe(true)
        progress = (await api(0, 'status')).session
      }
      expect(progress.state.uiState).toBe('inScenario')
      expect(progress.state.scenario.id).toBe('theUntamedWilds')
      await expect.poll(async () => (await api(1, 'status')).session?.state.scenario?.id)
        .toBe('theUntamedWilds')
      const guestPlaying = (await api(1, 'status')).session
      expect(guestPlaying.state.scenario.id).toBe('theUntamedWilds')
      expect(progress.state.investigators[0].hand.length).toBeGreaterThan(0)
      expect(progress.state.investigators[1].hand).toEqual([])
      expect(guestPlaying.state.investigators[1].hand.length).toBeGreaterThan(0)
      expect(guestPlaying.state.investigators[0].hand).toEqual([])
      await expect(host.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
      await expect(guest.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
      await expect(host.locator('.bg-game-title').first()).toContainText('荒莽密林')
      await expect(guest.locator('.bg-game-title').first()).toContainText('荒莽密林')
      expect(errors).toEqual([])
      expect(await host.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
      expect(await guest.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
      const shot = `${output}online-two-humans-${viewport}.png`
      await guest.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
      test.info().annotations.push({ type: 'screenshot', description: shot })
    } finally {
      await host?.close()
      await guest?.close()
      await Promise.all(halls.map(hall => stop(hall.server)))
      await stop(relay)
    }
  })
}

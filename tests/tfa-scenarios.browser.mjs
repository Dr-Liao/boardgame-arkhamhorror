import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'

const output = fileURLToPath(new URL('../../../artifacts/tfa-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

// Each shell starts one production chapter directly. It keeps the real scenario,
// behavior, pack, and engine, while avoiding choices from earlier chapters.
const sourceCampaign = contentRegistry.getCampaign('theForgottenAge')
const shells = []
for (const chapter of chapters) {
  const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`)
  const scenarioId = `${chapter.id}BrowserShell`
  const campaignId = `${chapter.id}BrowserCampaign`
  shells.push({ chapter, campaignId, scenarioId })
  registerContentBundle({
    campaigns: [{
      ...sourceCampaign, id: campaignId, name: module.scenario.name,
      scenarioIds: [scenarioId], unlock: { [scenarioId]: [] },
      flow: { start: scenarioId, nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
        end: { type: 'end' },
      } },
    }],
    scenarios: [{
      scenario: { ...module.scenario, id: scenarioId },
      behavior: { ...module.behavior, id: scenarioId },
      manifest: { ...module.manifest, id: scenarioId, campaignId,
        behaviorIds: [scenarioId], status: 'playable' },
    }],
  })
}

const { createGameState, applyMove } = await import('../src/engine/engine.js')
const { viewState } = await import('../src/integration/observation.js')

function chapterView(shell) {
  const state = createGameState({
    campaignId: shell.campaignId, seed: `tfa-browser-${shell.chapter.id}`,
    playerInvestigator: '04001',
  }, [{ seat: 0 }])
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const choice = state.pendingChoice
    const optionId = choice.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || choice.options[0]?.id
    if (!optionId) throw new Error(`${shell.chapter.id}: ${choice.kind} has no option`)
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId })
  }
  if (state.pendingChoice) throw new Error(`${shell.chapter.id}: setup did not settle`)
  state.phase = 'investigation'
  state.currentSeat = 0
  state.status = 'playing'
  state.revision = 1
  state.uiState = 'inScenario'
  const view = viewState(state, 0, { includeStatic: true })
  view.uiState = 'inScenario'
  view.revision = 1
  // The browser shell is only a flow shortcut; its chapter guide uses the
  // production scenario id, as it does when reached through the campaign.
  view.scenario.id = shell.chapter.id
  const here = state.locations.find(location => location.id === state.investigators[0]?.location)
    || state.locations[0]
  return { view, name: state.scenario.name, act: state.acts?.[state.actIndex]?.name,
    agenda: state.agendas?.[state.agendaIndex]?.name, location: here?.name,
    locations: state.locations.length }
}

async function openView(page, view) {
  let session
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({
      ...body, settings: { ...body.settings, seed: 'tfa-browser', playerCount: 1,
        teammates: 0, opponents: [], playerInvestigator: '04001', legacyAutoStart: true },
    }) })
    const payload = await response.json()
    if (payload.ok) {
      session = payload.session
      session.state = view
      session.state.revision = 1
    }
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', '1', { timeout: 30_000 })
}

for (const shell of shells) {
  for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
    test(`${shell.chapter.name} (${shell.chapter.id}) 在 ${viewport} 端进入真实章节`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const facts = chapterView(shell)
      await openView(page, facts.view)
      await expect(page.locator('.bg-game-title')).toContainText(facts.name.replace(/^失落的时代 · /, ''))
      // 天机之城：设置阶段把调查员卡替换成 04244「伊斯人身体」。牌桌的可视身份
      // （头像图 + 名字）必须来自换身后的卡，而不是原调查员。
      if (shell.chapter.id === 'theCityOfArchives' && viewport === 'desktop') {
        await expect(page.locator('.ah-dock-name-text')).toContainText('伊斯人身体')
        await expect(page.locator('.ah-dock-portrait .ah-table-art')).toHaveAttribute('data-art-code', '04244')
        await expect(page.locator('.ah-roster-identity strong').first()).toContainText('伊斯人身体')
      }
      await page.getByRole('button', { name: '局势', exact: true }).click()
      const situation = page.getByRole('dialog', { name: '调查局势' })
      await expect(situation).toBeVisible()
      if (facts.act) await expect(situation).toContainText(facts.act)
      if (facts.agenda) await expect(situation).toContainText(facts.agenda)
      await page.getByRole('button', { name: '关闭局势详情' }).click()
      if (facts.location) await expect(page.locator('body')).toContainText(facts.location)
      expect(await page.locator('.ah-map-node').count()).toBeGreaterThanOrEqual(Math.min(facts.locations, 2))
      await page.locator('[data-scenario-setup]').click()
      const guide = page.getByRole('dialog', { name: '关卡设置', exact: true })
      await expect(guide.locator('.ah-guide-block').first()).toBeVisible()
      expect((await guide.locator('.ah-guide-block').allTextContents()).join('').length).toBeGreaterThan(100)
      await page.keyboard.press('Escape')
      await expect(guide).toHaveCount(0)
      expect(errors).toEqual([])
      expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
      const shot = `${output}scenario-${shell.chapter.id}-${viewport}.png`
      await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
      test.info().annotations.push({ type: 'scenario', description: shell.chapter.id })
      test.info().annotations.push({ type: 'screenshot', description: shot })
    })
  }
}

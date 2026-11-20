import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSnapshot, saveSnapshot } from '../../../lib/sessions.js'
import { contentRegistry } from '../content/registered.js'
import { actingSeats, applyMove, createGameState, legalMoves, validateMove } from '../src/engine/engine.js'
import { captureReplayLog, replayLog, stateHash } from '../src/engine/replay.js'
import { changeProgress } from '../src/campaign/progress-tracks.js'
import { CHAOS_BAGS, SCENARIO_IDS } from '../content/campaigns/theDrownedCity/shared.js'
import { TDC_GLYPH_LETTERS, TDC_RLYEH_ARTIFACT_RECORD_KEYS } from '../content/campaigns/theDrownedCity/records.js'

const campaignId = 'theDrownedCity'
const seats = ['11001', '11004']
const submit = (state, seat, move) => {
  assert.ok(move, `${state.uiState}/${state.campaign.flow?.nodeId} @${seat}: ${legalMoves(state, seat).map(row => row.action)}`)
  const command = Object.fromEntries(Object.entries(move).filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
  assert.equal(validateMove(state, seat, command), null, JSON.stringify({ command, seat, status: state.status,
    ui: state.uiState, scenario: state.scenario?.id, choice: state.pendingChoice?.source, acting: actingSeats(state) }))
  applyMove(state, seat, command)
}
const findMove = (state, seat, ...actions) => actions.map(action => legalMoves(state, seat)
  .find(move => move.action === action && !move.disabled)).find(Boolean)

function play({ name, difficulty = 'standard', numberOfSeats = 1, choices = {}, resolutions = {}, onChapter, onStep, onChoice }) {
  const players = seats.slice(0, numberOfSeats).map((_, seat) => ({ seat, role: 'human' }))
  let state = createGameState({ campaignId, difficulty, campaignHub: true,
    playerInvestigator: seats[0], seatInvestigators: seats.slice(0, numberOfSeats), seed: `tdc-p8-${name}` }, players)
  const chapters = []
  const prologueChecks = []
  for (let step = 0; step < 600 && state.status === 'playing'; step++) {
    state = onStep?.(state, players) ?? state
    if (state.pendingChoice) {
      const { id, source, seat, options } = state.pendingChoice
      const preferred = onChoice?.(state) ?? choices[source]
      const option = preferred == null
        ? ['done', 'skip', 'confirm', 'none'].map(key => options.find(row => row.id === key)).find(Boolean) || options[0]
        : options.find(row => row.id === preferred)
      assert.ok(option, `${source}: ${preferred} 不在合法选项中`)
      submit(state, seat, { action: 'choose', choiceId: id, optionId: option.id })
    } else if (state.uiState === 'campaignHub') {
      submit(state, 0, state.campaign.leadConfirmed
        ? findMove(state, 0, 'hubGoSetup', 'hubSelectScenario') : findMove(state, 0, 'hubSetLeader'))
    } else if (state.uiState === 'scenarioSetup') {
      const seat = state.hubReady ? 0 : actingSeats(state)[0]
      submit(state, seat, findMove(state, seat, 'hubBeginScenario', 'hubAutoDeck', 'hubConfirmDeck', 'hubDoneSeat', 'hubSelectInvestigator'))
    } else if (state.uiState === 'inScenario') {
      assert.doesNotThrow(() => structuredClone(state), `${state.scenario.id} 可建立大厅存档检查点`)
      const id = state.scenario.id
      assert.ok(!chapters.includes(id), `${name}: 重复进入 ${id}`)
      chapters.push(id)
      onChapter?.(state)
      const resolutionKey = resolutions[id] ?? 'resolution1'
      // 真实 finishScenario 执行卡牌结算、经验和记录。章内规则与布置由逐章用例验收。
      submit(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
    } else if (state.uiState === 'scenarioResult') {
      submit(state, 0, findMove(state, 0, 'hubContinue'))
    } else if (state.uiState === 'interlude') {
      if (state.campaign.flow.nodeId === 'prologue') {
        assert.deepEqual(state.campaign.chaosBag, CHAOS_BAGS[difficulty])
        assert.equal(state.campaign.records.rlyehMap.length, 7)
        prologueChecks.push(true)
      }
      const seat = actingSeats(state)[0]
      submit(state, seat, findMove(state, seat, 'hubDoneSeat'))
    } else {
      assert.fail(`${name}: 未预期的界面状态 ${state.uiState}`)
    }
  }
  assert.ok(prologueChecks.length > 0, '战役从序章进入')
  assert.equal(state.uiState, 'campaignResult')
  return { state, chapters }
}

const west = ['theWesternWall', 'theApiary', 'theGrandVault', 'courtOfTheAncients', 'obsidianCanyons']
const east = [...west].reverse()
const finale = ['theDoomOfArkhamPartI', 'theDoomOfArkhamPartII']
const westOptions = { expeditionChoice: 'west', westernWallShortcut: 'apiary' }
const westResolutions = { theWesternWall: 'resolution3' }

test('P8 生产清单开放十章，西线跳过淹没城区后胜利，完整动作重放一致', () => {
  assert.deepEqual(contentRegistry.assertLaunchable(campaignId).scenarioIds, SCENARIO_IDS)
  const run = play({ name: 'west', choices: westOptions, resolutions: westResolutions })
  assert.deepEqual(run.chapters, ['oneLastJob', ...west, ...finale])
  assert.equal(run.state.outcome, 'victory')
  assert.equal(run.state.campaign.records.theExpeditionHeadedWest, true)
  assert.equal(run.state.campaign.records.theDrownedQuarterWasSkipped, true)
  assert.ok(run.state.campaign.records.rlyehMap.includes('rlyehDrownedQuarter'))
  assert.equal(run.state.campaign.records.theInvestigatorsStoodTogether, true)
  const replay = replayLog(captureReplayLog(run.state))
  assert.equal(stateHash(replay), stateHash(run.state))
})

test('P8 双人东线、各自领取任务、跳过淹没城区、真实存档续玩到终章失败', () => {
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'tdc-p8-node-'))
  let saved = false
  const seen = []
  try {
    const run = play({ name: 'east', numberOfSeats: 2, difficulty: 'hard',
      choices: { expeditionChoice: 'east', apiaryShortcut: 'westernWall' },
      resolutions: { theApiary: 'resolution4', theDoomOfArkhamPartI: 'noResolution', theDoomOfArkhamPartII: 'noResolution' },
      onChoice(state) {
        if (state.pendingChoice.source !== 'taskChoice') return null
        const { seat } = state.pendingChoice
        seen.push(seat)
        return seat === 0 ? 'walkInFaith' : 'goodMoney'
      },
      onStep(state, players) {
        if (saved || state.pendingChoice?.source !== 'expeditionChoice') return
        const record = { sessionId: 'tdc-p8-east', modId: 'arkhamhorror', state, players, events: [], settings: {} }
        saveSnapshot(record)
        const restored = readSnapshot(record.sessionId).session.state
        assert.equal(stateHash(restored), stateHash(state))
        saved = true
        return restored
      },
    })
    assert.ok(saved)
    assert.deepEqual(seen, [0, 1])
    assert.deepEqual(run.chapters, ['oneLastJob', ...east, ...finale])
    assert.equal(run.state.campaign.records.theExpeditionHeadedEast, true)
    assert.equal(run.state.campaign.records.lostTheirFaith, true)
    assert.equal(run.state.outcome, 'defeat')
    assert.equal(run.state.campaign.scenarioResults.length, run.chapters.length)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
})

function prepareTomb(state) {
  if (state.scenario.id !== 'obsidianCanyons') return
  for (const key of TDC_RLYEH_ARTIFACT_RECORD_KEYS) state.campaign.records[key] = true
  state.campaign.records.discoveredGlyphs = [...TDC_GLYPH_LETTERS]
  state.campaign.records.theInnerSanctumWasUnsealed = true
  changeProgress(state.campaign, 'tdcTask', 0, 5)
}

test('P8 墓穴全部条件满足后实际进场，并按结局直接获胜', () => {
  const run = play({ name: 'tomb', difficulty: 'expert',
    choices: { ...westOptions, sepulchreDecision: 'layItToRest' },
    resolutions: westResolutions, onChapter: prepareTomb })
  assert.deepEqual(run.chapters, ['oneLastJob', ...west, 'sepulchreOfTheSleeper'])
  assert.equal(run.state.outcome, 'victory')
  assert.ok(run.state.campaign.flow.history.some(visit => visit.nodeId === 'epilogue4'))
  const result = run.state.campaign.scenarioResults.at(-1)
  assert.equal(result.investigators[0].xpAwarded, result.victory + 10)
  assert.equal(result.investigators[0].traumaAfter.mental - result.investigators[0].traumaBefore.mental, 2)
})

test('P8 满足墓穴条件后选择绕行，任务成功并进入终章放逐路线', () => {
  const run = play({ name: 'banish', difficulty: 'easy',
    choices: { ...westOptions, taskChoice: 'walkInFaith', sepulchreDecision: 'knowBetter', '11688a': 'alliesPlan' },
    resolutions: westResolutions,
    onChapter(state) {
      prepareTomb(state)
      if (state.scenario.id === 'theDoomOfArkhamPartI') {
        state.investigators[0].assets.push(...['11552', '11672a', '11638', '11611', '11582'].map(code => ({ id: `fixture-${code}`, code })))
      }
      if (state.scenario.id !== 'theDoomOfArkhamPartII') return
      assert.equal(state.campaign.records.yourAlliesHaveAPlan, true)
      assert.equal(state.campaign.records.isStrongInTheirFaith, true)
      assert.ok(state.campaign.investigators[0].deck.includes('11754b'))
    },
  })
  assert.deepEqual(run.chapters, ['oneLastJob', ...west, ...finale])
  assert.equal(run.state.outcome, 'victory')
})

test('P8 拒绝邀约直接结束战役', () => {
  const run = play({ name: 'refuse', choices: { interludeOneDecision: 'refuse' } })
  assert.deepEqual(run.chapters, ['oneLastJob'])
  assert.equal(run.state.outcome, 'defeat')
})

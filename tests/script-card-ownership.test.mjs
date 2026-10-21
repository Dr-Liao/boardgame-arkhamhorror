import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, scriptActionHints, decisionSeat } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { entityMoves } from '../web/card-interactions.js'
import { scriptCardOwner } from '../src/engine/script-cards.js'
import * as theUntamedWilds from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'
import * as theDoomOfEztli from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
import * as threadsOfFate from '../content/campaigns/theForgottenAge/scenarios/threadsOfFate/index.js'
import * as theCityOfArchives from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/index.js'
import * as shatteredAeons from '../content/campaigns/theForgottenAge/scenarios/shatteredAeons/index.js'
import * as turnBackTime from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/index.js'
import * as lostInTimeAndSpace from '../content/campaigns/theDunwichLegacy/scenarios/lostInTimeAndSpace/index.js'
import { scenario as blackStarsRise } from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/definition.js'
import { scenario as dimCarcosa } from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/definition.js'

// 迁移规范 §4.5.1：幕/密谋卡面上的行动必须带 scriptCard，牌桌才会把它放在剧本书
// 对应卡片旁；引擎自带的探索行动没有卡号，由关卡数据的 scriptCards 声明归属。
// 这里同时验证「可执行」「不可执行提示」「地点/敌人行动不被误标」三种情况。

// 用关卡声明直接解析归属：只给当前幕/密谋卡号，不跑完整引擎。
function ownerFor(scenario, { act = null, agenda = null } = {}, move) {
  return scriptCardOwner({
    scenario,
    acts: act ? [{ originalCode: act }] : [],
    actIndex: 0,
    agendas: agenda ? [{ originalCode: agenda }] : [],
    agendaIndex: 0,
  }, move)
}

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, `choice loop: ${state.pendingChoice?.kind}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

function launch() {
  const state = createGameState({
    campaignId: 'theForgottenAge', campaignHub: true, seed: 'script-card-ownership',
    playerInvestigator: '04001',
  }, [{ seat: 0, role: 'human' }])
  const move = action => applyMove(state, decisionSeat(state), action)
  move({ action: 'hubGoSetup' })
  move({ action: 'hubSelectInvestigator', code: '04001' })
  move({ action: 'hubAutoDeck' })
  move({ action: 'hubDoneSeat' })
  move({ action: 'hubBeginScenario' })
  settle(state)
  assert.equal(state.scenario.id, 'theUntamedWilds')
  return state
}

// 把已经建好的 TFA 局换成另一章：只保留本用例需要的公开状态。
function swapScenario(state, module, { act = 0, agenda = 0 } = {}) {
  state.scenario = structuredClone(module.scenario)
  state.acts = structuredClone(module.scenario.acts)
  state.agendas = structuredClone(module.scenario.agendas)
  state.actIndex = act
  state.agendaIndex = agenda
  state.locations = Object.values(module.scenario.locations || {}).map(location => ({
    ...structuredClone(location), id: location.id, revealed: true, clues: 0, maxClues: 0,
  }))
  state.investigators[0].location = module.scenario.startLocation
  state.investigators[0].clues = 0
  state.explorationDeck = []
  state.explorationDiscard = []
  state.scenarioFlags = {}
  state.scenarioZones = { ...(state.scenarioZones || {}), setAside: [], removed: [] }
  state.enemies = []
  state.storyAssets = []
  state.pendingChoice = null
  state.currentSeat = 0
  return state
}

test('三循环幕卡印着的探索显示在密谋卡旁，并且成为可点击的密谋行动', () => {
  const state = launch()
  const explore = legalMoves(state).find(move => move.action === 'explore')
  assert.equal(explore?.scriptCard, 'agenda', '探索行动必须归当前密谋（04044/04045）')
  const hint = scriptActionHints(state, 0).find(move => move.action === 'explore')
  assert.equal(hint?.scriptCard, 'agenda')
  const view = viewState(state, 0)
  assert.ok(view.scriptActions.some(move => move.action === 'explore' && move.scriptCard === 'agenda'))
  // 密谋卡本身可以点开行动：牌桌不用再让玩家去通用动作栏找探索。
  assert.ok(entityMoves(view, 'agenda:current').some(move => move.action === 'explore'))
  assert.ok(!entityMoves(view, 'act:current').some(move => move.action === 'explore'))
})

test('幕卡印着的探索归幕卡：埃兹特里的覆灭与幕三不再探索', () => {
  const state = swapScenario(launch(), theDoomOfEztli)
  state.explorationDeck = ['ancientHall']
  const explore = legalMoves(state).find(move => move.action === 'explore')
  assert.equal(explore?.scriptCard, 'act', '04057/04058 的探索必须归当前幕')
  assert.equal(scriptActionHints(state, 0).find(move => move.action === 'explore')?.scriptCard, 'act')

  state.actIndex = 2
  assert.ok(!legalMoves(state).some(move => move.action === 'explore'))
  assert.ok(!scriptActionHints(state, 0).some(move => move.action === 'explore'),
    '04059 逃出遗迹没有探索行动，不能在幕卡旁留下按钮')
})

test('密谋印着的撤退归密谋，并进入剧本行动提示', () => {
  const state = swapScenario(launch(), threadsOfFate)
  const resign = legalMoves(state).find(move => move.rule === 'resignAgenda')
  assert.equal(resign?.scriptCard, 'agenda', '04114–04116 的撤退必须归当前密谋')
  assert.equal(scriptActionHints(state, 0).find(move => move.rule === 'resignAgenda')?.scriptCard, 'agenda')
  // 地点/旁人行动保持不占剧本区。
  assert.ok(!legalMoves(state).some(move => move.rule === 'parleyHarlan' && move.scriptCard))
})

test('探索暂时不可执行时仍在剧本行动里给出原因', () => {
  const state = launch()
  state.explorationDeck = []
  const hint = scriptActionHints(state, 0).find(move => move.action === 'explore')
  assert.equal(hint?.scriptCard, 'agenda')
  assert.equal(hint.reason, '探索牌库已经空了')
  assert.ok(viewState(state, 0).scriptActions.some(move => move.action === 'explore' && move.reason))
})

test('其余循环的幕/密谋行动归属：敦威治、卡尔克萨', () => {
  assert.equal(ownerFor(lostInTimeAndSpace.scenario, { act: '02316' }, { rule: 'searchEncounterLocations' }), 'act')
  assert.equal(ownerFor(lostInTimeAndSpace.scenario, { act: '02320' }, { rule: 'searchEncounterLocations' }), null)
  assert.equal(ownerFor(lostInTimeAndSpace.scenario, { act: '02316' }, { rule: 'resignBeyond' }), null)
  assert.equal(ownerFor(blackStarsRise, { agenda: '03275' }, { rule: 'hastenAgenda' }), 'agenda')
  assert.equal(ownerFor(blackStarsRise, { agenda: '03278' }, { rule: 'hastenAgenda' }), 'agenda')
  assert.equal(ownerFor(blackStarsRise, { agenda: '03277' }, { rule: 'hastenAgenda' }), null)
  assert.equal(ownerFor(blackStarsRise, { agenda: '03275' }, { rule: 'shiftAgendaDoom' }), null)
  assert.equal(ownerFor(dimCarcosa, { act: '03321a' }, { rule: 'confrontStranger' }), 'act')
  assert.equal(ownerFor(dimCarcosa, { act: '03322a' }, { rule: 'confrontStranger' }), null)
  assert.equal(ownerFor(dimCarcosa, { act: '03324' }, { rule: 'flipCarcosaLocation' }), 'act')
  assert.equal(ownerFor(dimCarcosa, { act: '03320' }, { rule: 'flipCarcosaLocation' }), null)
})

test('失落时代的其余剧本行动归属：撤退、抽取、古代遗物、探索', () => {
  assert.equal(ownerFor(threadsOfFate.scenario, { agenda: '04114' }, { rule: 'resignAgenda' }), 'agenda')
  assert.equal(ownerFor(threadsOfFate.scenario, { agenda: '04114' }, { rule: 'focusAct' }), null)
  assert.equal(ownerFor(theUntamedWilds.scenario, { agenda: '04044' }, { action: 'explore' }), 'agenda')
  assert.equal(ownerFor(theUntamedWilds.scenario, { agenda: '04044' }, { rule: 'resignCamp' }), null)
  assert.equal(ownerFor(theDoomOfEztli.scenario, { act: '04057' }, { action: 'explore' }), 'act')
  assert.equal(ownerFor(theDoomOfEztli.scenario, { act: '04059' }, { action: 'explore' }), null)
  assert.equal(ownerFor(theCityOfArchives.scenario, { act: '04243' }, { rule: 'repossessionDraw' }), 'act')
  assert.equal(ownerFor(theCityOfArchives.scenario, { act: '04242' }, { rule: 'repossessionDraw' }), null)
  assert.equal(ownerFor(theCityOfArchives.scenario, { act: '04243' }, { rule: 'interrogateSubject' }), null)
  for (const rule of ['searchRelic', 'takeRelic']) {
    assert.equal(ownerFor(shatteredAeons.scenario, { act: '04320' }, { rule }), 'act', rule)
  }
  assert.equal(ownerFor(shatteredAeons.scenario, { act: '04321' }, { rule: 'attachLocation' }), 'act')
  assert.equal(ownerFor(shatteredAeons.scenario, { act: '04320' }, { rule: 'attachLocation' }), null)
  assert.equal(ownerFor(shatteredAeons.scenario, { act: '04320' }, { rule: 'exploreFromNode' }), null)
  assert.equal(ownerFor(turnBackTime.scenario, { act: '04345' }, { action: 'explore' }), 'act')
  assert.equal(ownerFor(turnBackTime.scenario, { act: '04347' }, { action: 'explore' }), null)
  assert.equal(ownerFor(turnBackTime.scenario, { act: '04347' }, { rule: 'relicOfAgesStrike' }), 'act')
})

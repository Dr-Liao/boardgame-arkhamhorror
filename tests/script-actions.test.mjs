import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, legalMoves } from './core-fixture.mjs'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { entityMoves } from '../web/card-interactions.js'
import { scriptActionHints } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'

function scene(id) {
  const s = fixture('01005'); s.scenario = structuredClone(SCENARIOS[id]); s.campaign.scenarioIndex = Object.keys(SCENARIOS).indexOf(id)
  s.acts = structuredClone(s.scenario.acts); s.agendas = structuredClone(s.scenario.agendas); s.actIndex = 0; s.agendaIndex = 0
  s.locations = Object.values(s.scenario.locations).map(l => ({ ...l, revealed: true, clues: l.cluesPerInvestigator || 0, maxClues: l.cluesPerInvestigator || 0 }))
  s.investigators[0].location = s.scenario.startLocation
  return s
}
const view = s => ({ ...s, legalMoves: legalMoves(s) })

test('剧本行动：午夜假面幕一抽异教徒归幕，议程赋予的撤退归议程', () => {
  const s = scene('theMidnightMasks'); s.cultistDeck = ['ruthTurner']; s.investigators[0].clues = 2; s.clues = 2
  assert.deepEqual(entityMoves(view(s), 'act:current').map(m => m.action), ['drawCultist'])
  assert.deepEqual(entityMoves(view(s), 'agenda:current').map(m => m.action), ['resign'])
  move(s, { action: 'drawCultist' }); settle(s)
  assert.equal(s.enemies[0].code, 'ruthTurner')
})

test('剧本行动：地底噬魔幕三破坏仪式归幕；地点撤退和献祭丽塔不进入剧本区', () => {
  const s = scene('theDevourerBelow'); s.actIndex = 2; s.investigators[0].clues = 1; s.clues = 1
  assert.deepEqual(legalMoves(s).filter(m => m.scriptCard === 'act').map(m => m.skill), ['willpower', 'agility'])
  assert.ok(!legalMoves(s).some(m => m.scriptCard === 'agenda'))
  s.enemies = [{ id: 'umordhoth', code: 'umordhoth', name: '乌默尔多斯', location: s.investigators[0].location, massive: true, health: 20, damageTaken: 0, damage: 0, horror: 0 }]
  s.investigators[0].assets = [{ id: 'lita', code: '01117', exhausted: false }]
  const sacrifice = legalMoves(s).find(m => m.action === 'sacrificeLita')
  assert.equal(sacrifice.enemyId, 'umordhoth'); assert.equal(sacrifice.scriptCard, undefined)
  assert.ok(entityMoves(view(s), 'enemy:umordhoth').some(m => m.action === 'sacrificeLita'))
  assert.ok(!entityMoves(view(s), 'act:current').some(m => m.action === 'sacrificeLita'))
})

test('剧本行动提示：不可执行时仍列出并给出原因，轮次准备时提示先开始行动', () => {
  const s = scene('theMidnightMasks'); s.cultistDeck = ['ruthTurner']; s.investigators[0].clues = 0; s.clues = 0
  const hints = scriptActionHints(s, 0)
  assert.deepEqual(hints.map(h => [h.scriptCard, h.action, h.reason]), [['act', 'drawCultist', '需要调查员共同花费 2 个线索'], ['agenda', 'resign', null]])
  assert.deepEqual(viewState(s, 0).scriptActions, hints)
  assert.deepEqual(viewState(s, null).scriptActions, [])
  s.pendingChoice = { id: 'order', kind: 'turnOrder', seat: 0, prompt: '', options: [{ id: '0', label: '开始行动' }] }
  assert.equal(scriptActionHints(s, 0).find(h => h.action === 'resign').reason, '先点击「开始行动」')
  assert.deepEqual(scriptActionHints(scene('theGathering'), 0), [])
})

test('剧本行动：线索推进幕同样标记为幕，但仍由独立推进按钮负责', () => {
  const s = scene('theGathering'); s.investigators[0].clues = 2; s.clues = 2
  const advance = legalMoves(s).find(m => m.action === 'advanceAct')
  assert.equal(advance.scriptCard, 'act')
  assert.ok(!legalMoves(s).some(m => m.action === 'resign' && m.scriptCard))
})

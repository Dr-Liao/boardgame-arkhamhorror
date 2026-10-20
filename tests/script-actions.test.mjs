import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, legalMoves } from './core-fixture.mjs'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { entityMoves } from '../web/card-interactions.js'
import { scriptActionHints, describeState, decisionSeat } from '../src/engine/engine.js'
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
  // scriptCard 标明归属：'enemy' 表示挂在乌默尔多斯卡上，不占剧本区。
  assert.equal(sacrifice.enemyId, 'umordhoth'); assert.equal(sacrifice.scriptCard, 'enemy')
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

test('AI 观察：献祭丽塔走不通时也列出缺口，可执行时回到可执行列表且不重复', () => {
  const s = scene('theDevourerBelow'); s.actIndex = 2
  s.enemies = [{ id: 'umordhoth', code: 'umordhoth', name: '乌默尔多斯', location: s.locations[1].id,
    massive: true, health: 20, damageTaken: 0, damage: 3, horror: 3 }]
  let prompt = describeState(s, decisionSeat(s))
  assert.match(prompt, /【暂时不可执行的卡面行动】/)
  assert.match(prompt, /献祭丽塔·钱德勒（→ 结局 3）：需要先控制丽塔·钱德勒/)
  s.investigators[0].assets = [{ id: 'lita', code: '01117' }]
  prompt = describeState(s, decisionSeat(s))
  assert.match(prompt, /献祭丽塔·钱德勒（→ 结局 3）：需要与乌默尔多斯位于同一地点（它在「/)
  s.investigators[0].location = s.enemies[0].location
  prompt = describeState(s, decisionSeat(s))
  assert.ok(!prompt.includes('献祭丽塔·钱德勒（→ 结局 3）：'), '可执行时不再列进条件段')
  assert.ok(prompt.includes('😱 献祭丽塔·钱德勒（→ 结局 3）'), '可执行时应出现在可执行列表')
})

test('AI 观察：客厅谈判丽塔走不通时给出她的地点，但不占牌桌剧本区', () => {
  const s = scene('theGathering'); s.actIndex = 2
  s.locations = ['study', 'hallway', 'parlor'].map(id => ({ ...s.scenario.locations[id], id, revealed: true, clues: 0, maxClues: 0 }))
  s.investigators[0].location = 'study'
  s.storyAssets = [{ id: 'lita', code: '01117', location: 'parlor', controllerSeat: null }]
  assert.match(describeState(s, decisionSeat(s)),
    /谈判丽塔·钱德勒（智识 4，取得控制权）：需要与丽塔位于同一地点（她在「客厅」）/)
  assert.deepEqual(viewState(s, 0).scriptActions, [], '地点绑定的条件行动只喂 AI')
})

test('AI 观察：待决选择期间不追加条件行动，避免与 choose 列表混淆', () => {
  const s = scene('theDevourerBelow'); s.actIndex = 2
  s.enemies = [{ id: 'umordhoth', code: 'umordhoth', name: '乌默尔多斯', location: s.locations[1].id, massive: true, health: 20, damageTaken: 0 }]
  s.pendingChoice = { id: 'q1', kind: 'discard', seat: 0, prompt: '选择弃掉一张手牌。', canSkip: false,
    options: [{ id: 'harm', label: '受到 1 伤害和 1 恐惧' }] }
  assert.ok(!describeState(s, 0).includes('【暂时不可执行的卡面行动】'))
})

// 「冷漠」的有效读点（enemy-aloof.js）与 07086 洛依高尔。
//
// 印刷里的冷漠大多是离散关键词（印刷/藏身处/剧本授予，入场时合成到 enemy.aloof），
// 但 07086 印着**连续条件**：「洛依高尔所在地点有调查员没有手牌时，洛依高尔失去冷漠」。
// 这个条件随手牌变化，不能写进 state，只能在判定发生时求值——攻击合法性、自动交战与
// 描述层都走同一个读点。
//
// 07086 的另一条能力是「敌军阶段结束时：此地和连接地点的每位调查员随机弃 1 张手牌」，
// 窗口 enemyPhaseEnds 只在真有监听者时打开。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle } from './core-fixture.mjs'
import {
  aloofPreventsAttack, describeState, legalMoves as moves, reactionWindow, scenarioRuntime,
} from '../src/engine/engine.js'
import { enemyIsAloof } from '../src/engine/enemy-aloof.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

// 一个只在测试进程里登记的敌人条目：冷漠 + 连续条件由入场时的调查员手牌决定。
const aloofProbe = {
  code: '99094', scope: 'enemy', enemyRule: { losesAloofWhen: (state, enemy) => state.probeLosesAloof === true },
  abilities: [],
}
if (!registeredEntry(aloofProbe.code)) registerCardAbilities([aloofProbe])

function scene(count = 1) {
  const s = chapterFixture('intoTheMaelstrom', count)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  return s
}
const loy = (s, extra = {}) => enemy(s, { code: '07086', aloof: true, printedAloof: true, hunter: true,
  engagedSeat: null, health: 5, fight: 3, evade: 4, ...extra })

test('冷漠读点：没有条件时保持冷漠，条件成立时失去冷漠；文本空白时整段失效', () => {
  const s = scene()
  const plain = enemy(s, { code: '99003', aloof: true, engagedSeat: null })
  assert.equal(enemyIsAloof(s, plain), true, '没有 losesAloofWhen 的条目按实例布尔')
  plain.aloof = false
  assert.equal(enemyIsAloof(s, plain), false)
  const probe = enemy(s, { code: '99094', aloof: true, engagedSeat: null })
  s.probeLosesAloof = false
  assert.equal(enemyIsAloof(s, probe), true)
  s.probeLosesAloof = true
  assert.equal(enemyIsAloof(s, probe), false)
  // 文本被涂白的敌人：印刷冷漠与印刷条件一起失效。
  const blanked = enemy(s, { code: '99094', aloof: true, engagedSeat: null,
    textBlanked: { round: s.round, phase: s.phase } })
  assert.equal(enemyIsAloof(s, blanked, { isBlanked: () => true }), false)
})

test('07086 洛依高尔：本地有调查员没有手牌时失去冷漠，不出现攻击行动；有手牌时仍是冷漠目标', () => {
  const s = scene()
  const target = loy(s)
  const inv = s.investigators[0]
  inv.hand = ['01032']
  assert.equal(aloofPreventsAttack(s, inv, target), true)
  assert.equal(legalMoves(s).some(command => command.action === 'fight' && command.enemyId === target.id), false)
  inv.hand = []
  assert.equal(aloofPreventsAttack(s, inv, target), false, '空手牌时失去冷漠')
  assert.equal(legalMoves(s).some(command => command.action === 'fight' && command.enemyId === target.id), true)
  inv.hand = ['01032']
  assert.equal(aloofPreventsAttack(s, inv, target), true, '重新拿到手牌后恢复冷漠')
})

test('07086 洛依高尔：失去冷漠后会被移动进来的调查员自动交战', () => {
  const s = scene()
  const target = loy(s)
  const elsewhere = s.locations.find(location => location.id !== s.investigators[0].location).id
  target.location = elsewhere
  const inv = s.investigators[0]
  inv.hand = ['01032']
  scenarioRuntime(s, []).moveEnemy(target, inv.location)
  assert.equal(target.engagedSeat, null, '冷漠的敌人不会自动交战')
  inv.hand = []
  target.location = elsewhere
  scenarioRuntime(s, []).moveEnemy(target, inv.location)
  assert.equal(target.engagedSeat, inv.seat, '失去冷漠后自动交战')
})

test('07086 洛依高尔：敌军阶段结束时，此地与连接地点的调查员各随机弃 1 张手牌，更远的调查员不受影响', () => {
  const s = scene(2)
  const target = loy(s)
  const [first, second] = s.investigators
  first.hand = ['01032', '01033']
  second.hand = ['01034', '01035']
  // 第二位调查员放到连接地点：同样在范围内。
  const here = s.locations.find(location => location.id === target.location)
  const linked = { id: 'linkedRoad', code: '07102', originalCode: '07102', name: '连接地点', revealed: true,
    clues: 0, shroud: 1, connections: [here.id] }
  s.locations.push(linked)
  here.connections = [...(here.connections || []), linked.id]
  second.location = linked.id
  reactionWindow(s, 'enemyPhaseEnds', { when: 'enemyPhaseEnds', round: s.round }, [])
  settle(s)
  assert.equal(first.hand.length, 1, '本地调查员弃 1 张')
  assert.equal(second.hand.length, 1, '连接地点的调查员也弃 1 张')
  // 范围外的调查员：不连接的地点。
  const far = { id: 'farRoad', code: '07102', originalCode: '07102', name: '远处地点', revealed: true,
    clues: 0, shroud: 1, connections: [] }
  s.locations.push(far)
  first.location = far.id
  first.hand = ['01032']
  second.hand = ['01034']
  reactionWindow(s, 'enemyPhaseEnds', { when: 'enemyPhaseEnds', round: s.round }, [])
  settle(s)
  assert.equal(first.hand.length, 1, '范围外的调查员不弃牌')
})

test('07086 洛依高尔：描述层按有效冷漠关键词展示（不是印刷快照）', () => {
  const s = scene()
  const target = loy(s)
  const inv = s.investigators[0]
  const keywords = () => {
    const text = typeof describeState(s, 0) === 'string' ? describeState(s, 0) : JSON.stringify(describeState(s, 0))
    return (text.split(/\\n|\n/).find(line => line.includes('战斗3')) || '').trim()
  }
  inv.hand = ['01032']
  assert.ok(keywords().includes('冷漠'), '有手牌时展示冷漠')
  inv.hand = []
  assert.equal(keywords().includes('冷漠'), false, '失去冷漠后不再展示')
})

test('冷漠条件声明必须是函数：注册期直接拒绝', () => {
  assert.throws(() => registerCardAbilities([{ code: '99095', scope: 'enemy',
    enemyRule: { losesAloofWhen: 'always' }, abilities: [] }]), /aloof/)
})

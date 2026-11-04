// 搜索遭遇牌库/弃牌堆（`takeEncounterCard`）、「能否进入地点」只读读点
// （`canEnemyEnterLocation`）与真实卡牌 07090 深潜者来袭。
//
// 07090 的三段：解除本地深潜者的交战 → 本地与连接地点的深潜者与你交战 →
// 若没有任何敌人因此交战，则搜索两个遭遇堆生成一个深潜者、与你交战并洗回牌库。
// 搜索生成走 _shared 的 searchEncounterEnemyAndSpawn，候选用权威只读的
// canEnemyEnterLocation 过滤（进不去当前地点的敌人不算候选）。
//
// 另外覆盖 07088 深潜者巨怪：它的「选择并弃掉你 1 张手牌」此前调用
// `api.discardChosen` 会拿到 undefined（实体能力面没有这个方法），现在委托到
// 场景运行时的同一份实现。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'

// 与其它专项同形的规则事务驱动：执行块可重放，选择按 id 作答。
function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicEncounterSearch' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 60, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const resolveTreachery = (s, seat = 0, pick = () => null) => {
  const entry = registeredEntry('07090')
  assert.ok(entry?.encounterResolve, '07090 必须按条目结算显现')
  transaction(s, draft => entry.encounterResolve(draft, draft.investigators[seat], { code: '07090' },
    scenarioRuntime(draft, [], { type: 'encounter', label: '诡计检定', code: '07090' })), pick)
}
function scene(count = 1) {
  const s = chapterFixture('intoTheMaelstrom', count)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  return s
}
const deepOne = (s, extra = {}) => enemy(s, { code: '07089', health: 9,
  traits: ['Humanoid', 'Monster', 'Deep One'], engagedSeat: null, ...extra })

test('takeEncounterCard：按物理卡从牌库顶或弃牌堆取出一张，找不到返回 null', () => {
  const s = scene()
  const runtime = scenarioRuntime(s, [])
  s.encounterDeck = ['07102', '07089', '07089']
  s.encounterDiscard = ['07088']
  // 牌库是 push/pop 栈：先取顶部那一张。
  assert.deepEqual(runtime.takeEncounterCard('07089', { pile: 'encounterDeck' }), { pile: 'encounterDeck' })
  assert.deepEqual(s.encounterDeck, ['07102', '07089'])
  assert.deepEqual(runtime.takeEncounterCard('07088'), { pile: 'encounterDiscard' }, '牌库里没有时去弃牌堆')
  assert.deepEqual(s.encounterDiscard, [])
  assert.equal(runtime.takeEncounterCard('07088'), null)
})

test('canEnemyEnterLocation：按条目 enterOnlyTraits 判断，卡面不用重写规则', () => {
  const s = scene()
  const runtime = scenarioRuntime(s, [])
  const here = s.locations.find(location => location.id === s.investigators[0].location)
  const cave = { id: 'caveFixture', code: '07102', originalCode: '07102', name: '洞穴', revealed: true,
    clues: 0, shroud: 1, connections: [], traits: ['Cave'] }
  s.locations.push(cave)
  s.scenario.enemies.caveDwellerProbe = { code: 'caveDwellerProbe', name: '洞穴深潜者', type: 'enemy',
    traits: ['Deep One'], fight: 1, evade: 1, health: 2, damage: 0, horror: 0 }
  if (!registeredEntry('caveDwellerProbe')) {
    registerCardAbilities([{ code: 'caveDwellerProbe', scope: 'enemy',
      enemyRule: { enterOnlyTraits: ['Cave'] }, abilities: [] }])
  }
  assert.equal(runtime.canEnemyEnterLocation('caveDwellerProbe', cave.id), true)
  assert.equal(runtime.canEnemyEnterLocation('caveDwellerProbe', here.id), false)
  assert.equal(runtime.canEnemyEnterLocation('07089', here.id), true, '没有限制的敌人哪里都能进')
  assert.equal(runtime.canEnemyEnterLocation(null, here.id), false)
})

test('07090 深潜者来袭：本地深潜者先解除交战，再与本调查员交战', () => {
  const s = scene(2)
  const [first, second] = s.investigators
  const target = deepOne(s, { engagedSeat: second.seat })
  second.engaged = [target.id]
  resolveTreachery(s, first.seat)
  const after = s.enemies.find(item => item.id === target.id)
  assert.equal(after.engagedSeat, first.seat, '解除原交战后与本调查员交战')
  // 事务会用草稿替换 state：查询另一方必须重新取实例。
  assert.equal(s.investigators[1].engaged.includes(target.id), false)
  assert.equal(s.investigators[0].engaged.includes(target.id), true)
})

test('07090 深潜者来袭：连接地点的深潜者被带过来并与你交战', () => {
  const s = scene()
  const inv = s.investigators[0]
  const here = s.locations.find(location => location.id === inv.location)
  const linked = { id: 'linkedRoad', code: '07102', originalCode: '07102', name: '连接洞穴', revealed: true,
    clues: 0, shroud: 1, connections: [here.id] }
  s.locations.push(linked)
  here.connections = [...(here.connections || []), linked.id]
  const remote = deepOne(s, { location: linked.id })
  resolveTreachery(s)
  const after = s.enemies.find(item => item.id === remote.id)
  assert.equal(after.location, inv.location, '连接地点的深潜者被带到你所在地点')
  assert.equal(after.engagedSeat, inv.seat)
})

test('07090 深潜者来袭：没有深潜者交战时，搜索遭遇牌库生成并交战，然后洗回牌库', () => {
  const s = scene()
  const inv = s.investigators[0]
  s.encounterDeck = ['07101', '07089', '07102']
  s.encounterDeck = s.encounterDeck.map(code => code)
  s.encounterDiscard = []
  resolveTreachery(s)
  const spawned = s.enemies.filter(item => item.code === '07089')
  assert.equal(spawned.length, 1, '从遭遇牌库找出一个深潜者并生成')
  assert.equal(spawned[0].location, inv.location)
  assert.equal(spawned[0].engagedSeat, inv.seat)
  assert.equal(s.encounterDeck.length, 2, '取出的卡不再留在牌库')
  assert.equal(s.encounterDeck.includes('07089'), false)
  assert.deepEqual([...s.encounterDeck].sort(), ['07101', '07102'], '其余牌仍在牌库（已洗牌）')
})

test('07090 深潜者来袭：牌库里没有时从弃牌堆找；两个堆都没有则什么也不生成', () => {
  const s = scene()
  const inv = s.investigators[0]
  s.encounterDeck = ['07101', '07102']
  s.encounterDiscard = ['07089']
  resolveTreachery(s)
  const spawned = s.enemies.filter(item => item.code === '07089')
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].engagedSeat, inv.seat)
  assert.deepEqual(s.encounterDiscard, [], '弃牌堆里的那张已经被取出')

  const empty = scene()
  empty.encounterDeck = ['07101', '07102']
  empty.encounterDiscard = []
  resolveTreachery(empty)
  assert.equal(empty.enemies.length, 0, '没有 [[深潜者]] 敌人时不凭空生成')
})

test('07090 深潜者来袭：进不去当前地点的深潜者不算搜索候选', () => {
  const s = scene()
  s.scenario.enemies.caveDwellerProbe = { code: 'caveDwellerProbe', name: '洞穴深潜者', type: 'enemy',
    traits: ['Deep One'], fight: 1, evade: 1, health: 2, damage: 0, horror: 0 }
  if (!registeredEntry('caveDwellerProbe')) {
    registerCardAbilities([{ code: 'caveDwellerProbe', scope: 'enemy',
      enemyRule: { enterOnlyTraits: ['Cave'] }, abilities: [] }])
  }
  s.encounterDeck = ['caveDwellerProbe']
  s.encounterDiscard = []
  resolveTreachery(s)
  assert.equal(s.enemies.length, 0, '受限敌人不能在该地点生成，因此不是候选')
  assert.deepEqual(s.encounterDeck, ['caveDwellerProbe'], '候选被过滤时牌留在原处')
})

test('07088 深潜者巨怪：交战后的「选择并弃掉 1 张手牌」走实体能力面同一份实现', () => {
  const s = scene(2)
  const [first, second] = s.investigators
  first.hand = ['01032', '01033']
  second.hand = ['01034']
  const ghoul = enemy(s, { code: '07088', health: 9, traits: ['Humanoid', 'Monster', 'Deep One'], engagedSeat: null })
  const entry = registeredEntry('07088')
  assert.ok(entry?.abilities?.length)
  transaction(s, draft => {
    const runtime = scenarioRuntime(draft, [])
    const target = draft.enemies.find(item => item.id === ghoul.id)
    runtime.reengageEnemy(target, 0)
  })
  assert.equal(s.investigators[0].hand.length, 1, '交战者选择并弃掉 1 张手牌')
  assert.equal(s.investigators[1].hand.length, 1, '另一位调查员不受影响')
})

// 「放到密谋牌库旁」的遭遇危害：07095 印斯茅斯之雾 / 07107 鬼祟的当地人。
//
// 两张卡共用同一套旁置通道：
//   · `api.putNextToAgenda(code)` 创建真实旁置实例（`state.agendaAside`）；
//   · 旁置实例是修正来源：`entityModifierRows` 的 `aside` 行让 07095 的「每个地点隐藏值 +1」
//     对所有地点生效；`modifierSourceRows` 让声明 `audience:'all'` 的修正对所有调查员生效
//     （07107 的 `capability:parley`「调查员不能谈判」）；
//   · 轮末弃置：`treacheryRule.discardOneAtRoundEnd` 每轮最多弃 1 张同名副本。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { capabilityBlocked } from '../src/engine/modifiers.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const parleyProbe = {
  code: 'ticAsideParleyProbe', scope: 'enemy',
  abilities: [{ kind: 'action', actionKind: 'parley', label: '谈判：测试用', cost: { action: 1 }, resolve: () => {} }],
}
if (!registeredEntry(parleyProbe.code)) registerCardAbilities([parleyProbe])

// 遭遇卡的显现结算：在规则事务里跑条目的 encounterResolve，选择按 id 作答。
function reveal(s, code, { seat = 0, pick = () => null } = {}) {
  const entry = registeredEntry(code)
  assert.ok(entry?.encounterResolve, `${code} 必须有 encounterResolve`)
  const execute = draft => entry.encounterResolve(draft, draft.investigators[seat], { code, name: code },
    scenarioRuntime(draft, [], { type: 'encounter', label: '诡计检定', code }))
  resolveTransaction(s, seat, { action: 'testTicAsideHazard' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 40, `choice loop ${s.pendingChoice.kind}`)
    const choice = s.pendingChoice
    const id = pick(choice, s) ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const scene = (count = 1) => {
  const s = chapterFixture('inTooDeep', count)
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  return s
}
const asideCodes = s => (s.agendaAside || []).map(card => card.code)

test('07095 印斯茅斯之雾：成功时可由调查员选择放到密谋牌库旁，之后每个地点隐藏值 +1', () => {
  const s = scene()
  s.chaosBag = ['+5']
  const [first, second] = s.locations
  const before = scenarioRuntime(s, []).locationShroud(first.id)
  reveal(s, '07095', { pick: choice => choice.options.some(option => option.id === 'place') ? 'place' : null })
  assert.deepEqual(asideCodes(s), ['07095'], '旁置实例入场')
  assert.equal(s.investigators[0].horror, 0, '选择放置时不结算恐惧')
  assert.equal(scenarioRuntime(s, []).locationShroud(first.id), before + 1)
  assert.equal(scenarioRuntime(s, []).locationShroud(second.id), (second.shroud || 0) + 1, '每个地点都 +1')
})

test('07095 印斯茅斯之雾：成功时选择恐惧则不放置；失败时两者都执行', () => {
  const horrorScene = scene()
  horrorScene.chaosBag = ['+5']
  const shroudBefore = scenarioRuntime(horrorScene, []).locationShroud(horrorScene.locations[0].id)
  reveal(horrorScene, '07095', { pick: choice => choice.options.some(option => option.id === 'horror') ? 'horror' : null })
  assert.deepEqual(asideCodes(horrorScene), [], '选择恐惧时不放到场边')
  assert.equal(horrorScene.investigators[0].horror, 1)
  assert.equal(scenarioRuntime(horrorScene, []).locationShroud(horrorScene.locations[0].id), shroudBefore)

  const failed = scene()
  failed.chaosBag = ['autofail']
  reveal(failed, '07095')
  assert.deepEqual(asideCodes(failed), ['07095'], '失败时也放到场边')
  assert.equal(failed.investigators[0].horror, 1, '失败时同时受到 1 点恐惧')
})

test('07107 鬼祟的当地人：放到密谋牌库旁后所有调查员不能谈判', () => {
  const s = scene(2)
  s.chaosBag = ['+5']
  const probe = enemy(s, { code: parleyProbe.code, engagedSeat: null, health: 9 })
  assert.ok(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === probe.id),
    '放在场边之前可以谈判')
  reveal(s, '07107', { pick: choice => choice.options.some(option => option.id === 'place') ? 'place' : null })
  assert.deepEqual(asideCodes(s), ['07107'])
  assert.equal(capabilityBlocked(s, s.investigators[0], 'parley'), true)
  assert.equal(capabilityBlocked(s, s.investigators[1], 'parley'), true, '对每位调查员都生效')
  assert.equal(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === probe.id), false)
  const forged = validateMove(s, 0, { action: 'entityAbility', entityType: 'enemy', entityId: probe.id, abilityIndex: 0 })
  assert.match(String(forged), /谈判/, '伪造的谈判命令同样被拒绝')
})

test('07107 鬼祟的当地人：失败时受到 1 点伤害并放到场边', () => {
  const s = scene()
  s.chaosBag = ['autofail']
  reveal(s, '07107')
  assert.equal(s.investigators[0].damage, 1)
  assert.deepEqual(asideCodes(s), ['07107'])
})

test('轮末弃置：每轮最多从场上弃掉 1 张同名旁置卡，其余留到下一轮', () => {
  const s = scene()
  const runtime = scenarioRuntime(s, [])
  runtime.putNextToAgenda('07095')
  runtime.putNextToAgenda('07095')
  runtime.putNextToAgenda('07107')
  const endRound = () => {
    for (let guard = 0; guard < 12 && s.status === 'playing'; guard++) {
      for (const inv of s.investigators) inv.actionsLeft = 0
      const command = legalMoves(s).find(item => item.action === 'endTurn')
      if (!command) return
      const round = s.round
      move(s, command)
      settle(s)
      if (s.round !== round) return
    }
  }
  endRound()
  assert.deepEqual([...asideCodes(s)].sort(), ['07095'], '两种卡各弃 1 张')
  assert.equal(s.encounterDiscard.filter(code => code === '07095').length, 1)
  assert.equal(s.encounterDiscard.filter(code => code === '07107').length, 1)
  endRound()
  assert.deepEqual(asideCodes(s), [], '下一轮弃掉最后一张')
  assert.equal(s.encounterDiscard.filter(code => code === '07095').length, 2)
})

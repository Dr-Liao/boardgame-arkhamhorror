import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, legalMoves, validateMove } from './core-fixture.mjs'
import { getStat } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { playFlag, weaknessProfile } from '../src/engine/lifecycle.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

// Every player asset is actually paid for and put into play. Expected costs and
// printed counters come from the imported card, not a fabricated asset fixture.
// Phase 5：是不是「弱点资产」与「快速」都走生命周期读点，迁移不再影响这里的筛选。
for (const card of Object.values(ALL_CARDS).filter(c => /^010\d\d$/.test(c.code) && c.type === 'asset' && !weaknessProfile(c.code))) {
  test(`Core ${card.code} ${card.name}: 支付费用、行动和入场计数`, () => {
    const s = fixture(); const before = s.investigators[0].resources
    play(s, card.code); settle(s)
    const inv = s.investigators[0], a = inv.assets.find(a => a.code === card.code)
    assert.ok(a); assert.equal(inv.resources, before - card.cost)
    assert.equal(inv.actionsLeft, 20 - (playFlag(card.code, 'fast') ? 0 : 1) + (['01048', '01054'].includes(card.code) ? 1 : 0))
    assert.ok(!inv.hand.includes(card.code)); assert.ok(!inv.discard.includes(card.code))
    const printedUses = /Uses \((\d+) (ammo|charges|supplies|secrets)\)/.exec(card.text)
    if (printedUses) assert.equal(a.uses, Number(printedUses[1]))
    if (card.code === '01063') assert.equal(a.doom, 1)
  })
}

for (const [code, skill, amount] of [
  ['01018', 'combat', 1], ['01027', 'willpower', 1], ['01028', 'combat', 1], ['01033', 'intellect', 1],
  ['01055', 'agility', 1], ['01059', 'willpower', 1],
]) test(`Core ${code} 常驻属性在横置后仍有效`, () => {
  const s = fixture(); const inv = s.investigators[0]; const before = getStat(s, inv, skill)
  asset(s, code, { exhausted: true }); assert.equal(getStat(s, inv, skill), before + amount)
})

for (const [code, damage, bonus] of [
  ['01006', 2, 3], ['01016', 2, 1], ['01020', 2, 1], ['01029', 5, 3],
  ['01044', 2, 0], ['01047', 2, 2], ['01060', 2, 0], ['01074', 2, 2], ['01086', 1, 1],
]) test(`Core ${code} 武器只在其攻击中生效并支付充能`, () => {
  const s = fixture(); const a = asset(s, code); const e = enemy(s); s.investigators[0].willpower = 4
  use(s, a, { targetId: e.id }); assert.equal(s.skillTest.value, 4 + bonus)
  answer(s, 'done'); settle(s)
  assert.equal(s.enemies[0].damageTaken, damage)
  if (a.uses != null) assert.equal(s.investigators[0].assets[0].uses, a.uses - 1)
  move(s, { action: 'fight', enemyId: e.id }); answer(s, 'done'); settle(s)
  assert.equal(s.enemies[0].damageTaken, damage + 1)
})

for (const [code, skill, action, draw, heal] of [
  ['01089', 'willpower', 'investigate', 1, 0], ['01090', 'intellect', 'investigate', 1, 0],
  ['01091', 'combat', 'fight', 1, 0], ['01092', 'agility', 'evade', 1, 0],
  ['01093', 'intellect', 'investigate', 0, 0], ['01067', 'willpower', 'investigate', 0, 1],
  ['01039', 'intellect', 'investigate', 0, 0], ['01025', 'combat', 'fight', 0, 0],
]) test(`Core ${code} 技能投入成功/失败的奖励和弃牌`, () => {
  for (const success of [true, false]) {
    const s = fixture(); const inv = s.investigators[0]; inv.hand = [code]; inv.horror = 2; inv[skill] = 5
    s.locations[0].investigateSkill = skill; s.locations[0].clues = 10
    s.chaosBag = [success ? '0' : 'autofail']; const e = action !== 'investigate' ? enemy(s) : null
    move(s, { action, ...(e ? { enemyId: e.id } : {}) }); answer(s, '0'); answer(s, 'done'); settle(s)
    const after = s.investigators[0]
    assert.ok(after.discard.includes(code)); assert.equal(after.hand.length, success ? draw : 0)
    assert.equal(after.horror, 2 - (success ? heal : 0))
    if (code === '01039') assert.equal(after.clues, success ? 2 : 0)
    if (code === '01025') assert.equal(s.enemies[0].damageTaken, success ? 2 : 0)
  }
})

test('Core 01070 暗影之书能给已有足额充能的法术加充能', () => {
  const s = fixture(); const book = asset(s, '01070'); const spell = asset(s, '01060')
  use(s, book); settle(s)
  assert.equal(s.investigators[0].assets.find(a => a.id === spell.id).uses, 5)
  assert.equal(s.investigators[0].assets.find(a => a.id === book.id).exhausted, true)
})

test('Core 01014 护身符可打出最上方事件，且反应事件遵守时机并移到牌底', () => {
  const s = fixture('01005'); asset(s, '01014')
  s.investigators[0].discard = ['01088', '01086']
  move(s, { action: 'play', cardId: '01088', fromDiscard: true }); settle(s)
  assert.deepEqual(s.investigators[0].discard, ['01086']); assert.equal(s.investigators[0].deck[0], '01088')
  s.investigators[0].discard = ['01080', '01086']; s.chaosBag = ['-2']
  assert.ok(validateMove(s, 0, { action: 'play', cardId: '01080', fromDiscard: true }))
  move(s, { action: 'investigate' }); answer(s, 'done')
  if (s.pendingChoice.source === 'wendyRedraw') answer(s, 'skip')
  assert.ok(s.pendingChoice.options.some(o => o.id === 'discard')); answer(s, 'discard'); settle(s)
  assert.equal(s.investigators[0].deck[0], '01080'); assert.deepEqual(s.investigators[0].discard, ['01086'])
})

test('Core 01032 图书管理员只在自身入场时检索', () => {
  const s = fixture(); asset(s, '01032'); s.investigators[0].deck.push('01031')
  play(s, '01086'); assert.equal(s.pendingChoice, null)
  assert.equal(s.investigators[0].hand.length, 0)
})

for (const [code, action] of [['01051', 'fight'], ['01066', 'evade'], ['01069', 'evade']]) {
  test(`Core ${code} ${action}事件不引发借机攻击`, () => {
    const s = fixture(); const e = enemy(s, { damage: 2 }); s.investigators[0].agility = 5
    play(s, code); settle(s)
    assert.equal(s.investigators[0].damage, 0)
    assert.ok(action === 'fight' ? s.enemies[0].damageTaken > 0 : s.enemies[0].exhausted)
  })
}

test('Core 01068 记忆抹消只能在阶段开始使用，响应后支付费用并弃牌', () => {
  const s = fixture(); s.locations.push({ id: 'hallway', name: '走廊', connections: ['study'], revealed: true });
  const e = enemy(s, { engagedSeat: null, location: 'hallway', hunter: true }); s.investigators[0].hand = ['01068']
  // Must be at the caster's location; use it to stop the enemy's attack keyword instead.
  e.location = 'study'; e.retaliate = true
  assert.ok(validateMove(s, 0, { action: 'play', cardId: '01068' }))
  move(s, { action: 'endTurn' }); assert.equal(s.pendingChoice.source.when, 'phaseBegins')
  answer(s, '0'); settle(s)
  assert.ok(s.investigators[0].discard.includes('01068'))
})

test('Core 01164 呆若木鸡在个人回合结束检定，不推迟到整备阶段', () => {
  const s = fixture('01001', 2); s.investigators[0].threat.push({ id: 'fear', code: 'frozenInFear' })
  move(s, { action: 'endTurn' }); assert.equal(s.pendingChoice.kind, 'commit'); assert.equal(s.phase, 'investigation')
  answer(s, 'done'); settle(s)
  assert.ok(!s.investigators[0].threat.some(t => t.code === 'frozenInFear'))
  assert.equal(s.currentSeat, 1)
})

for (const [id, code, amount, field] of [['southside', '01126', 3, 'hand'], ['downtown', '01130', 3, 'resources'], ['stMarysHospital', '01128', -3, 'damage']]) {
  test(`Core ${code} 每场游戏限制按各调查员独立计算`, () => {
    const s = fixture('01001', 2); s.locations = [{ ...SCENARIOS.theMidnightMasks.locations[id], revealed: true, clues: 2 }]
    for (const inv of s.investigators) { inv.location = id; inv.damage = 3 }
    move(s, { action: 'locationAbility', locationId: id }); settle(s)
    assert.ok(validateMove(s, 0, { action: 'locationAbility', locationId: id }))
    move(s, { action: 'endTurn' }); settle(s)
    const before = field === 'hand' ? s.investigators[1].hand.length : s.investigators[1][field]
    move(s, { action: 'locationAbility', locationId: id }); settle(s)
    assert.equal(field === 'hand' ? s.investigators[1].hand.length : s.investigators[1][field], before + amount)
  })
}

test('Core 01072 外套仅承受自身的两点伤害，不增加调查员生命', () => {
  const s = fixture(); const coat = asset(s, '01072'); enemy(s, { damage: 2 })
  s.investigators[0].damage = 8
  move(s, { action: 'resource' }); answer(s, coat.id); answer(s, coat.id); settle(s)
  assert.equal(s.investigators[0].damage, 8)
  assert.ok(s.investigators[0].discard.includes('01072'))
  assert.equal(s.investigators[0].defeated, false)
  const t = fixture(); asset(t, '01072'); enemy(t, { damage: 1 }); t.investigators[0].damage = 8
  move(t, { action: 'resource' }); answer(t, 'self')
  assert.equal(t.investigators[0].defeated, true)
})

test('Core 01061 占卜术最后一次充能后保留在场，不能继续使用', () => {
  const s = fixture(); const a = asset(s, '01061', { uses: 1 })
  use(s, a); answer(s, 'deck:0'); settle(s)
  const result = s.investigators[0].assets.find(x => x.id === a.id)
  assert.equal(result.uses, 0); result.exhausted = false
  assert.ok(validateMove(s, 0, { action: 'ability', assetId: a.id, abilityIndex: 0 }))
  assert.ok(!s.investigators[0].discard.includes('01061'))
})

test('Core 01053 机会主义者只能投入自己的检定，不能协助队友', () => {
  const s = fixture('01001', 2)
  s.investigators[1].hand = ['01053', '01093']
  move(s, { action: 'investigate' }); answer(s, 'help')
  assert.equal(s.pendingChoice.seat, 1)
  assert.deepEqual(s.pendingChoice.options.map(o => o.id), ['done', '1'])
  answer(s, 'done'); settle(s)
})

test('Core 01008 书包的两个专用槽位不挤占普通手部槽位', () => {
  const s = fixture('01002'); asset(s, '01008'); asset(s, '01031'); asset(s, '01035')
  play(s, '01086'); settle(s); play(s, '01087'); settle(s)
  assert.equal(s.investigators[0].assets.length, 5)
  assert.deepEqual(s.investigators[0].discard, [])
  play(s, '01086')
  assert.equal(s.pendingChoice.kind, 'assetReplacement')
})

test('Core 01027 警徽只给正在进行回合的调查员增加行动', () => {
  const s = fixture('01001', 2); const a = asset(s, '01027')
  const before = s.investigators.map(i => i.actionsLeft)
  use(s, a); settle(s)
  assert.equal(s.investigators[0].actionsLeft, before[0] + 2)
  assert.equal(s.investigators[1].actionsLeft, before[1])
  assert.ok(s.investigators[0].discard.includes('01027'))
})

test('Core 01021 守卫犬本次被分配致命伤害仍可反击，并且恢复选择不会重复结算', () => {
  const s = fixture(); const dog = asset(s, '01021', { damage: 2 }); const e = enemy(s, { damage: 1 })
  move(s, { action: 'resource' }); answer(s, dog.id)
  assert.equal(s.pendingChoice.kind, 'reaction')
  const restored = structuredClone(s)
  answer(s, 'trigger'); settle(s); answer(restored, 'trigger'); settle(restored)
  assert.deepEqual(s, restored)
  assert.equal(s.enemies.find(x => x.id === e.id).damageTaken, 1)
  assert.ok(s.investigators[0].discard.includes('01021'))
})

test('Core 01021 守卫犬旧伤不触发本次反击，调查员承受伤害时不询问', () => {
  const s = fixture(); asset(s, '01021', { damage: 1 }); enemy(s, { damage: 1 })
  move(s, { action: 'resource' }); answer(s, 'self')
  assert.equal(s.pendingChoice, null)
  assert.equal(s.enemies[0].damageTaken, 0)
})

test('Core 01004 01099 01100 盟友承受恐惧/伤害不触发调查员反应或精神弱点', () => {
  const s = fixture('01004'); const a = asset(s, '01032')
  s.investigators[0].threat.push({ id: 'psychosis', code: '01099' }, { id: 'hypochondria', code: '01100' })
  enemy(s, { damage: 1, horror: 1 })
  move(s, { action: 'resource' }); answer(s, a.id); answer(s, a.id)
  assert.equal(s.pendingChoice, null)
  assert.equal(s.investigators[0].damage, 0); assert.equal(s.investigators[0].horror, 0)
})

test('Core 抽牌耗尽后重新混洗，在完成抽牌后承受一次恐惧', () => {
  const s = fixture(); s.investigators[0].deck = []; s.investigators[0].discard = ['01088']
  const a = asset(s, '01033')
  move(s, { action: 'draw' })
  assert.equal(s.pendingChoice.kind, 'assign-horror')
  assert.deepEqual(s.investigators[0].hand, ['01088'])
  answer(s, a.id); settle(s)
  assert.equal(s.investigators[0].assets.find(x => x.id === a.id).horror, 1)
})

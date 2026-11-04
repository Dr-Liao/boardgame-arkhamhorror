// 07094 长翼者（按攻击来源特性减伤）与 07105 印斯茅斯闹事者（线索最多的生成点 + 谈判）。
//
// 07094 的读点是 combat.js 的攻击伤害段：`enemyRule.damageReductionExceptSourceTraits`
// 按**攻击来源卡**的特性判定（武器支援取 asset 的卡号），空手攻击同样减伤，下限 1 点。
//
// 07105 的生成读点是条目级 `spawnMostClues`（enemies.js#spawnEnemy，与 spawnFarthestFromAll
// 同段）；谈判用「费用扣线索 + returnClueToLocation 放到本地点」两个既有写入口合起来表达
// 「将你的 1 个线索放到你所在地点」，并用 preventEnemyReady 让它在下一个补给阶段不重整。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { drawEncounter, legalMoves } from '../src/engine/engine.js'
import { asset, enemy, move, settle } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicFogAndLocals' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 60, `choice loop ${s.pendingChoice.kind}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
function attackScene() {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  s.chaosBag = ['+5']
  const target = enemy(s, { code: '07094', engagedSeat: 0, health: 40, fight: 3, evade: 4, traits: ['Creature', 'Monster'] })
  s.investigators[0].engaged = [target.id]
  s.investigators[0].combat = 12
  return { s, target }
}
const damageTaken = (s, target) => s.enemies.find(item => item.id === target.id)?.damageTaken ?? 0
const endRound = s => {
  for (let guard = 0; guard < 14 && s.status === 'playing'; guard++) {
    for (const inv of s.investigators) inv.actionsLeft = 0
    const command = legalMoves(s).find(item => item.action === 'endTurn')
    if (!command) return
    const round = s.round
    move(s, command)
    settle(s)
    if (s.round !== round) return
  }
}

test('07094 长翼者：[[近战]]武器攻击被减 1 点伤害，[[枪械]]攻击不受影响', () => {
  const melee = attackScene()
  const machete = asset(melee.s, '01020') // 大砍刀：Item/Weapon/Melee，交战伤害 2
  const meleeMove = legalMoves(melee.s).find(command => command.action === 'ability'
    && command.assetId === machete.id && command.targetId === melee.target.id)
  assert.ok(meleeMove, '近战武器攻击应当可用')
  move(melee.s, meleeMove)
  settle(melee.s)
  assert.equal(damageTaken(melee.s, melee.target), 1, '2 点伤害减为 1 点')

  const firearm = attackScene()
  const gun = asset(firearm.s, '01016') // .45 自动手枪：Item/Weapon/Firearm
  const firearmMove = legalMoves(firearm.s).find(command => command.action === 'ability'
    && command.assetId === gun.id && command.targetId === firearm.target.id)
  assert.ok(firearmMove, '枪械攻击应当可用')
  move(firearm.s, firearmMove)
  settle(firearm.s)
  assert.equal(damageTaken(firearm.s, firearm.target), 2, '枪械来源照常造成完整伤害')
})

test('07094 长翼者：空手攻击同样减伤，但最低仍造成 1 点', () => {
  const { s, target } = attackScene()
  const fight = legalMoves(s).find(command => command.action === 'fight' && command.enemyId === target.id)
  assert.ok(fight)
  move(s, fight)
  settle(s)
  assert.equal(damageTaken(s, target), 1, '基础攻击 1 点：减伤后仍为下限 1 点')
})

test('长翼者减伤规则在注册期校验形状', () => {
  assert.throws(() => registerCardAbilities([{ code: 'ticBadReductionProbe', scope: 'enemy',
    enemyRule: { damageReductionExceptSourceTraits: { amount: 0, traits: ['Weapon'] } }, abilities: [] }]),
  /damage reduction/i)
  assert.throws(() => registerCardAbilities([{ code: 'ticBadReductionProbe2', scope: 'enemy',
    enemyRule: { damageReductionExceptSourceTraits: { amount: 1, traits: [] } }, abilities: [] }]),
  /damage reduction/i)
})

test('07105 印斯茅斯闹事者：从遭遇牌库生成在「线索最多的地点」', () => {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  const richest = s.locations.reduce((best, location) => ((location.clues || 0) > (best.clues || 0) ? location : best))
  richest.clues = 5
  transaction(s, draft => { draft.encounterDeck = ['07105']; drawEncounter(draft, draft.investigators[0], []) })
  const spawned = s.enemies.find(item => item.code === '07105')
  assert.ok(spawned, '遭遇抽牌应当生成闹事者')
  assert.equal(spawned.location, richest.id)
})

test('07105 印斯茅斯闹事者：「线索最多」并列时由领队选择生成地点', () => {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  const [first, second] = s.locations
  for (const location of s.locations) location.clues = 0
  first.clues = 4
  second.clues = 4
  transaction(s, draft => { draft.encounterDeck = ['07105']; drawEncounter(draft, draft.investigators[0], []) },
    choice => choice.options.some(option => option.id === second.id) ? second.id : null)
  const spawned = s.enemies.find(item => item.code === '07105')
  assert.ok(spawned)
  assert.ok([first.id, second.id].includes(spawned.location), '并列时生成在候选之一')
})

test('07105 印斯茅斯闹事者：谈判把 1 个线索放到本地点、横置它，并在下一个补给阶段不重整', () => {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  const inv = s.investigators[0]
  inv.clues = 2
  const here = s.locations.find(location => location.id === inv.location)
  here.clues = 0
  const troublemaker = enemy(s, { code: '07105', engagedSeat: null, health: 8, traits: ['Humanoid', 'Hybrid', 'Criminal'] })
  const command = legalMoves(s).find(move => move.action === 'entityAbility' && move.entityId === troublemaker.id)
  assert.ok(command, '有线索时谈判可用')
  move(s, command)
  settle(s)
  assert.equal(s.investigators[0].clues, 1, '费用扣掉 1 个线索')
  assert.equal(s.locations.find(location => location.id === here.id).clues, 1, '线索被放到所在地点')
  const after = s.enemies.find(item => item.id === troublemaker.id)
  assert.equal(after.exhausted, true)
  assert.deepEqual(after.preventReady, { rounds: 1, from: s.round })
  endRound(s)
  const later = s.enemies.find(item => item.id === troublemaker.id)
  assert.equal(later?.exhausted, true, '下一个补给阶段不重整')
})

test('07105 印斯茅斯闹事者：没有线索时谈判不出现在合法行动里', () => {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  s.investigators[0].clues = 0
  const troublemaker = enemy(s, { code: '07105', engagedSeat: null, health: 8, traits: ['Humanoid', 'Hybrid', 'Criminal'] })
  assert.equal(legalMoves(s).some(move => move.action === 'entityAbility' && move.entityId === troublemaker.id), false)
})

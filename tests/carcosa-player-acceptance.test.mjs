import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { replacementOptions } from '../src/campaign/campaign.js'
import { effectDefinitionError } from '../src/engine/effects.js'
import { getStat, engageEnemy } from '../src/engine/engine.js'
import { expireEffects } from '../src/engine/effect-state.js'
import { getAvailability } from '../src/deck/availability.js'
import { registeredEntry } from '../src/engine/ability.js'
import { DATA_IMPLEMENTED_CODES } from '../src/cards/card-implementation.js'
import { effects, manifest } from '../content/packs/carcosaPlayer/manifest.js'

const codes = manifest.cards.map(card => card.code).sort()
const basicWeaknesses = new Set(manifest.basicWeaknessCodes)
// Phase 2：9 张卡的行为已迁到能力层描述子，本包的 effects 表不再包含它们。
const abilityLayer = new Set(manifest.abilityLayerCodes)

assert.equal(codes.length, 95)
assert.equal(Object.keys(effects).length + abilityLayer.size, 95)
assert.deepEqual([...Object.keys(effects), ...abilityLayer].sort(), codes)

function effectNodes(effect) {
  return [
    effect.event,
    ...(effect.abilities || []).map(ability => ability.effect),
    ...(effect.reactions || []).map(reaction => reaction.effect),
    ...(effect.freeTriggers || []).map(trigger => trigger.effect),
  ].filter(Boolean)
}

for (const code of codes) {
  test(`Carcosa ${code} ${ALL_CARDS[code].nameZh || ALL_CARDS[code].name} 主要印刷效果契约可执行`, () => {
    const card = ALL_CARDS[code]
    const inventory = manifest.cards.find(item => item.code === code)
    assert.ok(card)
    // Phase 2：这一批卡的行为在能力层（描述子）里，本包不再有 EFFECTS 条目。
    if (abilityLayer.has(code)) {
      const entry = registeredEntry(code)
      assert.equal(EFFECTS[code], undefined, '迁移后不应再有旧 DSL 条目')
      // Phase 6（6e-16）：EFFECTS 清空后，条目可能只有规则字段（敌人弱点等），
      // 也可能整张卡走 data 通道（卡面数据即实现，例如 03114 珍爱纪念）。
      const hasEntryData = Boolean(entry) && (entry.abilities.length || entry.modifiers.length
        || entry.freeTriggers.length || entry.passive || entry.enemyWeakness)
      assert.ok(hasEntryData || DATA_IMPLEMENTED_CODES.has(code),
        '能力层条目必须存在（描述子 / 修正 / 天赋档位 / 被动 / 敌人弱点，或 data 通道）')
      assert.equal(inventory.rulesImplemented, true)
      assert.equal(getAvailability(code).availability, 'strict')
      // 基础弱点也走能力层（迁移后不再是 effects 条目），但它们不参与构筑。
      assert.equal(getAvailability(code).deckbuilding, !basicWeaknesses.has(code))
      return
    }
    const effect = EFFECTS[code]
    assert.equal(effect, effects[code])
    assert.equal(inventory.rulesImplemented, true)
    assert.equal(getAvailability(code).availability, 'strict')
    assert.equal(getAvailability(code).deckbuilding, !basicWeaknesses.has(code))
    if (basicWeaknesses.has(code)) {
      assert.ok(effect.weakness || effect.enemyWeakness)
      assert.equal(getAvailability(code).dependencyOnly, true)
    } else {
      assert.ok(Object.keys(effect).length > 0 || card.code === '03114')
    }
    for (const node of effectNodes(effect)) assert.equal(effectDefinitionError(node), null)
    if (effect.weakness?.type !== 'threat') assert.equal(effectDefinitionError(effect.weakness), null)
    if (card.type === 'asset') {
      const state = fixture()
      const instance = asset(state, code)
      if (effect.uses != null) {
        assert.equal(instance.uses, effect.uses)
        assert.equal(instance.usesType, effect.usesType)
      }
    }
  })
}

test('C2 Archaic Glyphs discards an intellect-icon card and unlocks its researched upgrades campaign-wide', () => {
  const state = fixture('01002')
  const inv = state.investigators[0]
  const glyph = asset(state, '03025')
  const record = state.campaign.investigators[0]
  const upgrades = ['03192', '03193']
  const command = { action: 'ability', assetId: glyph.id, abilityIndex: 0 }
  record.xp = 20

  for (const code of upgrades) assert.deepEqual(replacementOptions(record, code, state.campaign.records), [])
  inv.hand = ['01088', '01089']
  assert.equal(validateMove(state, 0, command), '能力成本不足')

  const translate = code => {
    state.investigators[0].hand.push(code)
    move(state, command)
    assert.equal(state.pendingChoice?.kind, 'discard')
    assert.deepEqual(state.pendingChoice.options.map(option => option.cardCode), [code])
    settle(state)
    assert.ok(state.investigators[0].discard.includes(code))
  }
  const resourcesBefore = inv.resources
  translate('01090')
  translate('01030')
  translate('01090')

  assert.ok(!state.investigators[0].assets.some(item => item.id === glyph.id))
  assert.ok(state.investigators[0].discard.includes('03025'))
  assert.equal(state.investigators[0].resources, resourcesBefore + 5)
  assert.equal(state.campaign.records.translatedGlyphs, true)
  const updatedRecord = state.campaign.investigators[0]
  assert.equal(updatedRecord.research.translatedGlyphs, true)
  for (const code of upgrades) assert.ok(replacementOptions(updatedRecord, code, state.campaign.records).length > 0)

  const replacement = structuredClone(updatedRecord)
  delete replacement.research
  for (const code of upgrades) {
    assert.deepEqual(replacementOptions(replacement, code), [])
    assert.ok(replacementOptions(replacement, code, state.campaign.records).length > 0)
  }
})

test('C2 firearm, tool and spell assets execute their printed primary actions', () => {
  const gun = fixture()
  const gunAsset = asset(gun, '03020')
  enemy(gun, { id: 'target', health: 5, fight: 1 })
  move(gun, { action: 'ability', assetId: gunAsset.id, abilityIndex: 0, enemyId: 'target' })
  settle(gun)
  assert.equal(gun.investigators[0].assets.find(item => item.id === gunAsset.id).uses, 5)
  assert.equal(gun.enemies[0].damageTaken, 2)

  const lantern = fixture()
  const lanternAsset = asset(lantern, '03036')
  lantern.locations[0].clues = 2
  lantern.locations[0].shroud = 3
  lantern.chaosBag = ['0']
  move(lantern, { action: 'ability', assetId: lanternAsset.id, abilityIndex: 0 })
  settle(lantern)
  assert.equal(lantern.investigators[0].clues, 1)

  const athame = fixture()
  const athameAsset = asset(athame, '03035')
  enemy(athame, { id: 'athame-target', health: 3, fight: 3 })
  athame.chaosBag = ['0']
  move(athame, { action: 'ability', assetId: athameAsset.id, abilityIndex: 0, enemyId: 'athame-target' })
  settle(athame)
  assert.equal(athame.enemies[0].damageTaken, 1)
})

test('C2 Ever Vigilant choice chain survives JSON save/replay and applies each discount once', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['03023', '03020', '03021', '03114']
  inv.resources = 10
  move(state, { action: 'play', cardId: '03023' })
  const restored = JSON.parse(JSON.stringify(state))
  const choose = pending => pending.options.find(option => option.cardCode)?.id
    ?? pending.options.find(option => option.id === 'done')?.id
  settle(state, choose)
  settle(restored, choose)
  assert.deepEqual(restored, state)
  assert.deepEqual(state.investigators[0].assets.map(item => item.code).sort(), ['03020', '03021', '03114'])
  assert.equal(state.investigators[0].resources, 6)
})

test('C2 Lockpicks combines agility, spends supply below success-by-two, and replays deterministically', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.intellect = 2
  inv.agility = 3
  state.locations[0].shroud = 4
  state.locations[0].clues = 2
  state.chaosBag = ['0']
  const lockpicks = asset(state, '03031')
  move(state, { action: 'ability', assetId: lockpicks.id, abilityIndex: 0 })
  const restored = JSON.parse(JSON.stringify(state))
  settle(state)
  settle(restored)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.investigators[0].assets.find(item => item.id === lockpicks.id).uses, 2)
})

test('C2 Alchemical Transmutation resolves success margin and symbol damage', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.willpower = 4
  const transmutation = asset(state, '03032')
  state.chaosBag = ['skull']
  const before = inv.resources
  move(state, { action: 'ability', assetId: transmutation.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.investigators[0].assets.find(item => item.id === transmutation.id).uses, 2)
  assert.equal(state.investigators[0].resources, before + 3)
  assert.equal(state.investigators[0].damage, 1)
})

test('C2 Composure receives non-direct horror before the investigator', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const composure = asset(state, '03107')
  const painkillers = asset(state, '02117')
  inv.damage = 1
  move(state, { action: 'ability', assetId: painkillers.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.investigators[0].discard.includes('03107'), true)
  assert.equal(state.investigators[0].horror, 0)
})

test('C2 conditional and temporary stat modifiers are applied and expire on their printed boundary', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const dario = asset(state, '03151')
  const baseWill = inv.willpower
  inv.resources = 9
  assert.equal(getStat(state, inv, 'willpower'), baseWill)
  inv.resources = 10
  assert.equal(getStat(state, inv, 'willpower'), baseWill + 1)
  inv.assets.splice(inv.assets.indexOf(dario), 1)
  inv.horror = 3
  inv.hand = ['03155']
  move(state, { action: 'play', cardId: '03155' })
  settle(state)
  assert.equal(getStat(state, state.investigators[0], 'combat'), state.investigators[0].combat + 3)
  // Phase 1（A1）：临时修正到期只走统一过期点（不再靠 round 比较隐式失效）。
  expireEffects(state, 'endOfRound')
  assert.equal(getStat(state, state.investigators[0], 'combat'), state.investigators[0].combat)
})

test('C2 Quantum Flux shuffles discard, draws, and removes itself from the game', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['03196']
  inv.deck = ['01088']
  inv.discard = ['01089', '01090']
  move(state, { action: 'play', cardId: '03196' })
  settle(state)
  assert.equal(state.investigators[0].discard.length, 0)
  assert.equal(state.investigators[0].hand.length, 1)
  assert.equal(state.removedFromGame.includes('03196'), true)
})

test('C2 Emergency Cache (3) divides four tokens between resources and supplies with save/replay', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const target = asset(state, '01087', { uses: 1, usesType: 'supplies' })
  inv.hand = ['03239']
  const before = inv.resources
  move(state, { action: 'play', cardId: '03239' })
  const restored = JSON.parse(JSON.stringify(state))
  const choose = pending => pending.source === '03239' && pending.kind === 'amount' ? '2'
    : pending.options.find(option => option.assetId === target.id || option.id === target.id)?.id
  settle(state, choose)
  settle(restored, choose)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].resources, before + 2)
  assert.equal(state.investigators[0].assets.find(item => item.id === target.id).uses, 3)
})

test('C2 all three basic weaknesses execute and remain outside normal deckbuilding', () => {
  const drawing = fixture()
  drawing.investigators[0].deck = ['03041']
  move(drawing, { action: 'draw' })
  settle(drawing)
  assert.equal(drawing.investigators[0].threat.some(card => card.code === '03041'), true)
  assert.equal(getAvailability('03041').deckbuilding, false)

  const thing = fixture()
  thing.investigators[0].deck = ['03042']
  move(thing, { action: 'draw' })
  settle(thing)
  const weaknessEnemy = thing.enemies.find(item => item.code === '03042')
  assert.ok(weaknessEnemy)
  weaknessEnemy.damageTaken = Math.max(0, weaknessEnemy.health - 2)
  const weapon = asset(thing, '03020')
  thing.investigators[0].combat = 10
  thing.chaosBag = ['0']
  move(thing, { action: 'ability', assetId: weapon.id, abilityIndex: 0, enemyId: weaknessEnemy.id })
  settle(thing)
  assert.equal(thing.investigators[0].deck.includes('03042'), true,
    JSON.stringify({ deck: thing.investigators[0].deck, discard: thing.investigators[0].discard,
      enemies: thing.enemies.map(item => ({ code: item.code, damage: item.damageTaken, health: item.health, bearerSeat: item.bearerSeat })) }))
})

test('C2 runtime gate contains exactly 92 constructible cards and three dependency-only weaknesses', () => {
  assert.equal(manifest.status, 'verified')
  assert.equal(manifest.cards.filter(card => card.deckbuilding).length, 92)
  assert.equal(manifest.cards.filter(card => !card.deckbuilding).length, 3)
  for (const code of codes.filter(code => !basicWeaknesses.has(code))) {
    assert.equal(getAvailability(code).deckbuilding, true)
  }
})

// ---- 回归：效果解释器的「转发层」漏字段（同类问题：卡面写了、引擎没读） ----

test('Carcosa 03028 潜行 躲避值 -2、成功不横置且本回合不能与你交战', () => {
  const s = fixture()
  s.investigators[0].agility = 1
  const card = asset(s, '03028')
  const target = enemy(s, { evade: 2, engagedSeat: 0 })
  s.chaosBag = ['0']
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  const after = s.enemies.find(item => item.id === target.id)
  // 躲避值 2 - 2 = 0：敏捷 1 也能成功。
  assert.ok(s.log.some(line => String(line).includes('躲避成功')), '躲避值修正应生效')
  assert.equal(after.exhausted, false, '成功也不横置敌人')
  assert.equal(after.engagedSeat, null, '成功解除交战')
  assert.equal(after.preventEngageSeat?.seat, 0)
  // 本回合该敌人不能与你重新交战。
  engageEnemy(s, s.enemies.find(item => item.id === target.id), 0)
  assert.equal(s.enemies.find(item => item.id === target.id).engagedSeat, null)
})

test('Carcosa 03192 古代雕文 每超过难度 2 点额外发现 1 条线索', () => {
  const s = fixture()
  s.investigators[0].intellect = 6
  s.locations[0].shroud = 1
  s.locations[0].clues = 6
  const card = asset(s, '03192')
  s.chaosBag = ['0']
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  // 成功 5 点：1 + floor(5 / 2) = 3 条线索。
  assert.equal(s.investigators[0].clues, 3)
})

test('Carcosa 03193 古代雕文 成功后自动躲避一个交战敌人', () => {
  const s = fixture()
  s.investigators[0].intellect = 6
  s.locations[0].shroud = 1
  s.locations[0].clues = 2
  const card = asset(s, '03193')
  const target = enemy(s, { evade: 1, engagedSeat: 0 })
  s.chaosBag = ['0']
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  const after = s.enemies.find(item => item.id === target.id)
  assert.equal(after.exhausted, true)
  assert.equal(after.engagedSeat, null)
})

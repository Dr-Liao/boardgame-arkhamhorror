import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, answer, asset, enemy, play, use, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { commitProfile, playedEffect, weaknessProfile } from '../src/engine/lifecycle.js'
import { registeredEntry } from '../src/engine/ability.js'
import { getStat, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { getAvailability, canSelectInvestigator } from '../src/deck/availability.js'
import { effects as cycleEffects } from '../content/packs/dunwichPlayer/effects.js'
import { abilityLayerCodes } from '../content/packs/dunwichPlayer/manifest.js'
import { effects as supportEffects, abilityLayerCodes as supportAbilityLayerCodes } from '../content/packs/dunwichSupport/manifest.js'

// 可构筑 = 本周期 handlers + 已迁到能力层描述子的卡（后者不再有 EFFECTS 条目）。
const constructible = [...new Set([...Object.keys({ ...cycleEffects, ...supportEffects }),
  ...abilityLayerCodes, ...supportAbilityLayerCodes])].sort()
const investigators = ['02001', '02002', '02003', '02004', '02005']
const signatures = ['02006', '02007', '02008', '02009', '02010', '02011', '02012', '02013', '02014', '02015']
const weaknesses = ['02037', '02038', '02039']
const expectedCodes = [...constructible, ...investigators, ...signatures, ...weaknesses]

assert.equal(constructible.length, 94)
assert.equal(expectedCodes.length, 112)
assert.equal(new Set(expectedCodes).size, 112)

const contracts = {
  '02016': ['abilities.0.effect', { type: 'fight', combatBonus: 1, noFriendlyFire: true }],
  '02017': ['event', { type: 'resolve' }],
  '02018': ['event', { type: 'resolve' }],
  '02019': ['event', { type: 'resolve' }],
  '02020': ['passive.handSizeBonus', 2, 'reactions.0.effect', { type: 'draw', amount: 2 }],
  '02021': ['abilities.0.effect.type', 'researchSolution'],
  '02022': ['event', { type: 'targetedEffect', target: 'location', effect: { type: 'moveTo' } }],
  '02023': ['event.type', 'resolve'],
  '02024': ['uses', 4, 'abilities.0.effect.type', 'resolve'],
  '02025': ['reaction.when', 'enemySpawn', 'event.type', 'moveTo'],
  '02026': ['skill', { doubleDifficultyAndRewards: true, maxPerTest: 1 }],
  '02027': ['passive.stats.combat', 1, 'forcedUpkeepPayOrDiscard', 1],
  '02028': ['uses', 3, 'abilities.0.effect', { type: 'investigate', skill: 'willpower', clueBonus: 1, symbolEndsTurn: true }],
  '02029': ['reactions.0.when', 'symbolRevealed', 'reactions.0.effect', { type: 'addCurrentTest', amount: 1 }],
  '02030': ['uses', 3, 'abilities.0.effect.effect', { type: 'heal', amount: 1, what: 'horror' }],
  '02031': ['event.type', 'resolve'],
  '02032': ['abilities.0.effect', { type: 'fight', fireAxe: true }],
  '02033': ['passive.stats.agility', 1, 'healSelfHorrorAfterTurn', 1],
  '02034': ['event', { type: 'evade', moveEnemyOnSuccess: true }],
  '02035': ['passive.stats', { agility: 1, willpower: 1 }, 'healSelfHorrorAfterTurn', 1],
  '02036': ['abilities.0.effect', { type: 'fight', combatBonus: 1, maySpendActionForDamage: 1 }],
  '02105': ['event', { type: 'healDamageAtLocation', amount: 2 }],  '02106': ['passive', { stats: { willpower: 1 }, assignHarmAtLocation: true }, 'defeatedDamage', 2],
  '02107': ['event', { type: 'fight', skill: 'intellect', damagePerClue: true, maxDamageBonus: 3 }],
  '02108': ['abilities.0.effect', { type: 'moveTo', requiresNoEnemies: true }],
  '02109': ['event', { type: 'resolve' }],
  // Phase 5（5b-9）起「适应性」用条目级 adaptableSwaps 声明；Phase 6 把契约对齐到新形状。
  '02110': ['adaptableSwaps', 2, 'passive.permanent', true],
  '02111': ['event.type', 'resolve', 'addToVictory', true],
  '02112': ['uses', 5, 'abilities.0.effect', { type: 'fight', skill: 'willpower', combatBonus: 1, skullDamageBonus: 2 }],
  '02113': ['reaction', { when: 'attackFail', failedByAtMost: 2 }, 'event.type', 'resolve'],
  '02114': ['abilities.1.cost.exileSelf', true, 'abilities.1.effect', { type: 'evade', bonus: 3, evadeOthersOnSuccess: true }],
  // 第 122 轮：照明弹的「攻击 / 搜索盟友入场」二选一改成条目 resolve。
  '02115': ['event.type', 'resolve', 'exileAfterPlay', true],
  '02116': ['uses', 3, 'abilities.0.effect.effects', [{ type: 'takeDamage', amount: 1 }, { type: 'heal', amount: 1, what: 'horror' }]],
  '02117': ['uses', 3, 'abilities.0.effect.effects', [{ type: 'takeHorror', amount: 1 }, { type: 'heal', amount: 1, what: 'damage' }]],
  '02147': ['passive.extraSlots.handWeapon', 1],
  '02148': ['event.type', 'resolve'],
  '02149': ['reactions.0', { when: 'assetEnteredPlay', assetCode: '02149', effect: { type: 'discoverClue', amount: 1 } }],
  '02150': ['skill', { onSuccess: { clueBonus: 1 }, successBy: { threshold: 2, clueBonus: 1 } }],
  '02151': ['event.type', 'resolve'],
  '02152': ['fast', true, 'abilities.0.effect', { type: 'fight', combatBonus: 2, damageBonus: 1, successBy: 2 }],
  '02153': ['reaction.when', 'enemyAttack', 'event.type', 'resolve'],
  '02154': ['uses', 4, 'abilities.0.effect', { type: 'fight', skill: 'willpower', combatBonus: 2, damageBonus: 1, onChaosSymbolHorror: 1 }],
  '02155': ['passive.investigateBonusIfNoClues', 2],
  '02156': ['event.type', 'resolve'],
  '02157': ['passive.extraSlots.accessory', 1],
  '02158': ['passive.extraSlots.ally', 1],
  '02184': ['event', { type: 'searchTop', amount: 9, trait: 'Weapon', choose: 1 }],
  '02185': ['abilities.0.effect', { type: 'addStatPhase', skill: 'intellect', amount: 1 }, 'abilities.1.effect', { type: 'addStatPhase', skill: 'combat', amount: 1 }],
  '02186': ['playCondition.0', '当前地点没有线索', 'event', { type: 'draw', amount: 3 }],
  '02187': ['minimumHandForBoost', 5, 'freeTriggers.0', { skill: 'willpower', cost: { resources: 1 }, bonus: 2 }],
  '02188': ['reactions.0', { when: 'turnBegins', requiresAlone: true, effect: { type: 'gainResource', amount: 1 } }],
  '02189': ['freeTriggers', [{ skill: 'intellect', cost: { resources: 2 }, bonus: 3 }, { skill: 'agility', cost: { resources: 2 }, bonus: 3 }]],
  '02190': ['skill.defiance', true],
  '02191': ['freeTriggers.0', { skill: 'willpower', cost: { doom: 1 }, bonus: 3 }],
  '02192': ['skill', { selfTestOnly: true, requireDifficultyAboveBase: 2 }],
  '02193': ['freeTriggers', [{ skill: 'combat', cost: { resources: 1 }, bonus: 1 }, { skill: 'agility', cost: { resources: 1 }, bonus: 1 }]],
  '02194': ['event.effects', [{ type: 'gainResource', amount: 3 }, { type: 'draw', amount: 1 }]],
  '02225': ['reaction.when', 'defeatEnemy', 'event.type', 'resolve'],
  '02226': ['uses', 3, 'abilities.0.effect', { type: 'fight', combatBonus: 3, damageBonus: 2, requireNotEngagedTarget: true }],
  '02227': ['skill.requireClueAtLocation', true],
  '02228': ['event.type', 'resolve'],
  '02229': ['skill.successBy', { threshold: 2, gainAction: 1 }],
  // 第 121 轮：重抽混乱标记由条目级 rerollTokenCost 提供，反应描述子只留时机与费用。
  '02230': ['reactions.0', { when: 'chaosTokenRevealed', cost: { resources: 2 }, effect: { type: 'resolve' } }],
  '02231': ['skill', { selfTestOnly: true, returnOnSuccessBy: 2 }],
  // 第 122 轮：查看牌库顶 + 放毁灭改成条目 resolve。
  '02232': ['passive.stats.intellect', 1, 'abilities.0.effect.type', 'resolve'],
  '02233': ['uses', 3, 'abilities.0.effect', { type: 'investigate', skill: 'willpower', bonus: 2, clueBonus: 2, symbolEndsTurn: true }],
  '02234': ['passive', { darkHorse: true, allStatsIfNoResources: 1 }],
  '02235': ['skill.onSuccess', { evadeDisengage: true, mayMoveAfterEvade: true }],
  '02260': ['skill.leadership', true],
  // 第 121 轮：取消伤害/恐惧改成通用原语 api.cancelHarm（条目内唯一实现在 02261 的文件里）。
  '02261': ['event', { type: 'resolve' }],
  '02262': ['uses', 4, 'abilities.0.effect.effect', { type: 'heal', amount: 2, what: 'damage' }],
  '02263': ['uses', 3, 'abilities.0.effect', { type: 'fight', baseValue: 6, damageBonus: 2 }],
  '02264': ['uses', 4, 'abilities.0.effect', { type: 'evade', baseValue: 6 }],
  '02265': ['abilities.0', { cost: { action: false, resources: 1 }, effect: { type: 'resolve' } }],
  '02266': ['event', { type: 'gainAction', amount: 3 }],
  '02267': ['event.type', 'resolve'],
  '02268': ['skill', { onSuccess: { healHorror: 1 }, successBy: { threshold: 2, healHorror: 1 } }],
  '02269': ['reactions.0', { when: 'symbolRevealed', cost: { exhaust: true }, effect: { type: 'chooseOne' } }],
  '02270': ['event.type', 'resolve'],
  '02271': ['skill.selfTestOnly', true],
  '02272': ['passive.parleyDifficultyModifier', -2],
  '02273': ['playCondition.0', '当前地点有敌人', 'event.effects', [{ type: 'heal', amount: 3, what: 'horror' }, { type: 'draw', amount: 1 }]],
  '02299': ['skill', { onSuccess: { damageBonus: 1 }, successBy: { threshold: 2, damageBonus: 1 } }],
  '02300': ['event', { type: 'fight', defeatNonEliteOnSuccess: true }],
  '02301': ['uses', 3, 'abilities.0.effect', { type: 'fight', combatBonus: 5, damageBonus: 2 }],
  // 第 121 轮：取消遭遇并重抽改成通用原语 api.cancelEncounterDraw。
  '02302': ['reactions.0', { when: 'encounterDrawn', cost: { exhaust: true, clues: 1, returnClue: true }, effect: { type: 'resolve' } }],
  '02303': ['event.type', 'resolve'],
  '02304': ['uses', 4, 'abilities.0.effect', { type: 'fight', damageBonus: 2, additionalActionCombatBonus: 2 }],
  '02305': ['phaseControl', true],
  '02306': ['uses', 4, 'abilities.0.effect', { type: 'fight', skill: 'willpower', combatBonus: 3, damageBonus: 2, onChaosSymbolHorror: 2 }],
  '02307': ['reaction', { when: 'encounterDrawn', nonWeaknessOnly: true }, 'event', { type: 'cancelTreachery', horror: 1 }],
  // Phase 5（5b-8）：02308 / 02310 已迁到能力层——攻击转移与入场自选技能不再是旧 reaction 数据。
  '02308': ['redirectAttackToAsset', true],
  '02310': ['fast', true, 'forcedMythosEndDiscard', true, 'entersPlay.0.label', '入场：选择两项技能，其基础值提升为 6'],
  // 第 121 轮：取回投入的技能卡改成通用原语 api.recallCommittedSkill（与 04159 同一实现）。
  '02309': ['reactions.0', { when: 'skillTestFail', cost: { exhaust: true }, effect: { type: 'resolve' } }],
}

function atPath(value, path) {
  return path.split('.').reduce((node, key) => node?.[Number.isInteger(Number(key)) ? Number(key) : key], value)
}

function assertSubset(actual, expected, label = '') {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${label} is not an array`)
    assert.ok(actual.length >= expected.length, `${label} array is too short`)
    expected.forEach((item, index) => assertSubset(actual[index], item, `${label}[${index}]`))
  } else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', `${label} is not an object`)
    for (const [key, value] of Object.entries(expected)) assertSubset(actual[key], value, `${label}.${key}`)
  } else {
    assert.deepEqual(actual, expected, label)
  }
}

function assertContract(code) {
  const checks = contracts[code]
  assert.ok(checks, `${code} has no printed-effect contract`)
  for (let index = 0; index < checks.length; index += 2) {
    const path = checks[index]
    assertSubset(atPath(behaviorOf(code), path), checks[index + 1], `${code}.${path}`)
  }
}

// 行为数据可能还在旧 DSL（EFFECTS），也可能已迁到能力层（played/commit/weakness/abilities/modifiers）。
// 契约断言只看"这张卡声明了什么行为"，与它现在走哪条通道无关。Phase 5 起把迁移后的
// 槽位（abilities / uses / usesType / passive.stats / weakness）也折叠回同一份形状。
function behaviorOf(code) {
  const legacy = EFFECTS[code]
  const entry = registeredEntry(code)
  const played = playedEffect(code)
  const commit = commitProfile(code)
  const weakness = weaknessProfile(code)
  const playCondition = entry?.playCondition?.map(item => item.message || '条件')
  const fromDescriptors = (entry?.abilities || [])
    .filter(descriptor => descriptor.kind === 'action' || descriptor.kind === 'free')
    .map(descriptor => ({
      label: descriptor.label,
      cost: descriptor.cost,
      // 用 resolve 实现的描述子没有 effect 数据体；契约层把它折成 { type: 'resolve' }。
      effect: descriptor.effect ?? (typeof descriptor.resolve === 'function' ? { type: 'resolve' } : undefined),
    }))
  // 用 resolve 实现的 played 事件同样没有 effect 数据体：契约只看「声明了事件行为」。
  const playedResolve = (entry?.abilities || []).find(descriptor => descriptor.kind === 'played' && typeof descriptor.resolve === 'function')
  const event = played || (playedResolve ? { type: 'resolve' } : null)
  // Phase 5（5b-6）：从旧式 reactions 搬来的反应描述子折叠回同一份形状（criteria 是旧条件字段）。
  const fromReactions = (entry?.abilities || [])
    .filter(descriptor => descriptor.kind === 'reaction')
    .map(descriptor => {
      const flags = descriptor.criteria && typeof descriptor.criteria === 'object' && !Array.isArray(descriptor.criteria)
        ? descriptor.criteria
        : {}
      const limit = descriptor.limit && typeof descriptor.limit === 'object' ? descriptor.limit.scope : descriptor.limit
      return {
        id: descriptor.id,
        // 描述子的 trigger 归一化成数组；契约按旧式字符串断言，单窗口时折回字符串。
        when: Array.isArray(descriptor.trigger)
          ? (descriptor.trigger.length === 1 ? descriptor.trigger[0] : descriptor.trigger)
          : descriptor.trigger,
        ...flags,
        ...(['round', 'perRound'].includes(limit) ? { limit: 'round' }
          : ['phase', 'perPhase'].includes(limit) ? { limit: 'phase' }
            : ['turn', 'perTurn'].includes(limit) ? { limit: 'turn' } : {}),
        cost: descriptor.cost,
        effect: descriptor.effect ?? (typeof descriptor.resolve === 'function' ? { type: 'resolve' } : undefined),
      }
    })
  const stats = {}
  for (const modifier of entry?.modifiers || []) {
    if (typeof modifier.target === 'string' && modifier.target.startsWith('skill:') && !modifier.condition
      && typeof modifier.amount === 'number') stats[modifier.target.slice('skill:'.length)] = modifier.amount
  }
  if (!legacy && !event && !commit && !weakness && !entry?.passive
    && !entry?.healSelfHorrorAfterTurn && !entry?.forcedUpkeepPayOrDiscard && !entry?.defeatedDamage && !entry?.freeTriggers?.length && !entry?.fast
    && !entry?.redirectAttackToAsset && !entry?.forcedMythosEndDiscard && !entry?.skipOrRepeatPhase
    && !fromDescriptors.length && !fromReactions.length && !Object.keys(stats).length
    && !playCondition?.length) return null
  const merged = {
    ...(legacy || {}),
    ...(event ? { event } : {}),
    ...(commit ? { skill: commit } : {}),
    ...(weakness ? { weakness } : {}),
    ...(Object.keys(stats).length ? { passive: { ...(legacy?.passive || {}), stats } } : {}),
    ...(entry?.passive ? { passive: { ...(legacy?.passive || {}), ...entry.passive } } : {}),
    ...(entry?.healSelfHorrorAfterTurn != null ? { healSelfHorrorAfterTurn: entry.healSelfHorrorAfterTurn } : {}),
    ...(entry?.forcedUpkeepPayOrDiscard != null ? { forcedUpkeepPayOrDiscard: entry.forcedUpkeepPayOrDiscard } : {}),
    ...(entry?.defeatedDamage != null ? { defeatedDamage: entry.defeatedDamage } : {}),
    ...(entry?.redirectOneHorrorToSelf ? { redirectOneHorrorToSelf: true } : {}),
    ...(entry?.cannotLeavePlay ? { cannotLeavePlay: true } : {}),
    ...(entry?.freeTriggers?.length ? { freeTriggers: entry.freeTriggers } : {}),
    ...(entry?.minimumHandForBoost != null ? { minimumHandForBoost: entry.minimumHandForBoost } : {}),
    ...(entry?.composure ? { composure: true } : {}),
    ...(entry?.fast ? { fast: true } : {}),
    // Phase 5（5b-8）：攻击转移支援与「神话结束弃掉」也折叠进同一份形状。
    ...(entry?.redirectAttackToAsset ? { redirectAttackToAsset: true } : {}),
    ...(entry?.forcedMythosEndDiscard ? { forcedMythosEndDiscard: true } : {}),
    ...(entry?.adaptableSwaps ? { adaptableSwaps: entry.adaptableSwaps } : {}),
    ...(entry?.uses != null ? { uses: entry.uses } : {}),
    ...(entry?.usesType ? { usesType: entry.usesType } : {}),
    ...(playCondition?.length ? { playCondition } : {}),
  }
  if (fromDescriptors.length) merged.abilities = [...(legacy?.abilities || []), ...fromDescriptors]
  if (fromReactions.length) merged.reactions = [...(legacy?.reactions || []), ...fromReactions]
  // Phase 5（5b-8）：入场钩子（原 reactions.when = 'assetEnteredPlay'）折叠成 entersPlay 槽位。
  const fromEnterPlay = (entry?.abilities || [])
    .filter(descriptor => descriptor.kind === 'entersPlay')
    .map(descriptor => ({ label: descriptor.label }))
  if (fromEnterPlay.length) merged.entersPlay = fromEnterPlay
  // 快速反应事件迁走后：trigger → reaction.when，effect 数据体 → event（只补空缺，不覆盖已折叠的 played）。
  const playedDescriptor = entry?.abilities?.find(item => item.kind === 'played')
  const playedFlags = playedDescriptor?.criteria && typeof playedDescriptor.criteria === 'object'
    && !Array.isArray(playedDescriptor.criteria) ? playedDescriptor.criteria : {}
  if (playedDescriptor?.trigger?.length && !merged.reaction) merged.reaction = { when: playedDescriptor.trigger[0], ...playedFlags }
  if (playedDescriptor?.effect && !merged.event) merged.event = playedDescriptor.effect
  // P1：迁移后的「打出后进胜利区 / 流放 / 跳过阶段 / 起始资源」是描述子或条目级字段，
  // 折叠回契约使用的旧槽位名（02305 的旧名是 phaseControl）。
  if (playedDescriptor?.addToVictory || entry?.addToVictory) merged.addToVictory = true
  if (playedDescriptor?.exileAfterPlay || entry?.exileAfterPlay) merged.exileAfterPlay = true
  if (entry?.skipOrRepeatPhase) merged.phaseControl = true
  if (entry?.startingResources != null) merged.startingResources = entry.startingResources
  // 旧打出条件的「字段名」在迁移后变成 playCondition 的文案；契约按字段名断言，
  // 这里把文案确定性反查回字段名（同一份映射见 src/engine/play-condition.js）。
  for (const item of entry?.playCondition || []) {
    const field = LEGACY_CONDITION_BY_MESSAGE[item.message]
    if (field) merged[field] = true
  }
  return merged
}

const LEGACY_CONDITION_BY_MESSAGE = Object.freeze({
  当前地点没有线索: 'requiresClueAtLocation',
  '需要至少 1 个线索才能打出': 'requiresClue',
  '只能作为本回合的第一个行动打出': 'firstActionOnly',
  当前地点有敌人: 'requiresNoEnemies',
  '只能在自己的回合打出': 'ownTurnOnly',
  '场上没有带「撤退」能力的剧本卡': 'requiresResign',
})

function prep(s) {
  const inv = s.investigators[0]
  inv.damage = 3
  inv.horror = 3
  inv.clues = 3
  inv.intellect = inv.willpower = inv.combat = inv.agility = 8
  s.locations[0].clues = 6
  s.locations[0].shroud = 1
  s.locations[0].connections = ['next']
  s.locations.push({ id: 'next', name: '相邻地点', revealed: true, shroud: 1, clues: 3, maxClues: 3, connections: [s.locations[0].id] })
  enemy(s, { id: 'probe-enemy', health: 30, fight: 1, evade: 1, damage: 1, horror: 1, traits: ['Monster'] })
  return inv
}

function engineSurfaceProbe(code) {
  const card = ALL_CARDS[code]
  const effect = behaviorOf(code) || {}
  assert.equal(getAvailability(code).deckbuilding, true)
  assert.ok(card && behaviorOf(code))
  if (card.type === 'asset') {
    const s = fixture('01001', 2)
    const inv = prep(s)
    const a = asset(s, code)
    if (code === '02226') {
      s.enemies[0].engagedSeat = null
      inv.engaged = []
    }
    // 02108 探路者：卡面要求「未与任何敌人交战」，探针默认塞了一个交战敌人，
    // 先让它横置脱离（否则能力本就不该出现在合法行动里）。
    if (effect.abilities?.[0]?.effect?.requiresNoEnemies) {
      for (const probeEnemy of s.enemies) { probeEnemy.engagedSeat = null; probeEnemy.exhausted = true }
      inv.engaged = []
    }
    if (effect.uses != null) assert.equal(a.uses, effect.uses)
    if (effect.passive?.stats) {
      for (const [skill, amount] of Object.entries(effect.passive.stats)) {
        inv.assets.pop()
        const without = getStat(s, inv, skill)
        inv.assets.push(a)
        assert.equal(getStat(s, inv, skill), without + amount)
      }
    }
    if (effect.abilities?.length) {
      const offered = legalMoves(s).filter(command => command.assetId === a.id)
      assert.ok(offered.length > 0, `${code} ability was not offered by the engine`)
      if (effect.abilities[0].cost?.uses) {
        a.uses = 0
        assert.ok(!legalMoves(s).some(command => command.assetId === a.id && command.abilityIndex === 0), `${code} ignored its use cost`)
      }
    }
  } else if (card.type === 'skill') {
    const investigator = { guardian: '01001', seeker: '01002', rogue: '01003', mystic: '01004', survivor: '01005' }[card.klass] || '01001'
    const s = fixture(investigator, 2)
    const inv = prep(s)
    inv.hand = [code]
    const skill = Object.entries(card.icons || {}).find(([name, amount]) => name !== 'wild' && amount > 0)?.[0] || 'intellect'
    const execute = state => performTest(state, 0, skill, 10, { resolve: result => { state.probeResult = result } })
    resolveTransaction(s, 0, { action: 'dunwichPlayerProbe' }, execute)
    const commit = s.pendingChoice
    assert.equal(commit?.kind, 'commit')
    assert.ok(commit.options.some(option => option.id === '0' && option.label.includes(card.nameZh || card.name)),
      `${code} was not offered for a legal matching test`)
  } else if (card.type === 'event') {
    const s = fixture('01001', 2)
    const inv = prep(s)
    if (code === '02273') s.enemies = []
    inv.hand = [code]
    const reactionOnly = effect.reaction || effect.reactions
    const error = validateMove(s, 0, { action: 'play', cardId: code })
    if (reactionOnly) assert.ok(error, `${code} reaction event was playable outside its timing window`)
    else if (!['02151'].includes(code)) assert.equal(error, null, `${code} should be playable in the prepared legal state`)
  }
}

function playAndSettle(code, configure = () => {}, choose = () => null, count = 1) {
  const s = fixture('01001', count)
  configure(s)
  play(s, code)
  settle(s, choose)
  return s
}

const runtime = {
  '02016': () => {
    const s = fixture('01001', 2), inv = s.investigators[0]
    const a = asset(s, '02016')
    const target = enemy(s, { engagedSeat: 1, fight: 20 })
    s.investigators[1].engaged = [target.id]
    s.chaosBag = ['autofail']
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.investigators[1].damage, 0)
  },
  '02017': () => {
    const s = fixture(), inv = s.investigators[0]
    const first = enemy(s, { engagedSeat: null }), second = enemy(s, { engagedSeat: null })
    play(s, '02017'); settle(s)
    assert.deepEqual(new Set(s.investigators[0].engaged), new Set([first.id, second.id]))
  },
  '02018': () => {
    const s = fixture('01001', 2), first = s.investigators[0], second = s.investigators[1]
    first.resources = 5
    play(s, '02018'); settle(s, p => p.source === '02018' && p.options.some(o => o.id === 'resource') ? 'resource' : null)
    assert.equal(s.investigators[0].resources, 4)
    assert.equal(s.investigators[1].resources, 31)
  },
  '02019': () => {
    const s = fixture(), inv = s.investigators[0]
    enemy(s, { engagedSeat: null }); enemy(s, { engagedSeat: null })
    play(s, '02019'); settle(s)
    assert.equal(s.investigators[0].engaged.length, 2)
    assert.equal(s.investigators[0].hand.length, 2)
  },
  '02020': () => {
    const s = playAndSettle('02020', () => {}, p => p.source === 'laboratoryAssistant' ? 'trigger' : null)
    assert.equal(s.investigators[0].hand.length, 2)
    assert.equal(s.investigators[0].assets[0].code, '02020')
  },
  '02021': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.assets = [{ id: 'solution', code: '02021', exhausted: false }]
    inv.deck = ['01088', '01089']; inv.intellect = 8
    move(s, { action: 'ability', assetId: 'solution', abilityIndex: 0 })
    const saved = structuredClone(s)
    settle(s); settle(saved)
    assert.deepEqual(s, saved)
    assert.equal(s.campaign.records.identifiedStrangeSolution, true)
    assert.equal(s.investigators[0].hand.length, 2)
  },
  '02022': () => {
    const s = fixture('01001', 2)
    s.locations[0].connections = ['next']; s.locations.push({ id: 'next', name: '相邻', revealed: true, clues: 0, connections: [s.locations[0].id] })
    play(s, '02022'); settle(s, p => p.kind === 'investigator' ? '1' : null)
    assert.equal(s.investigators[1].location, 'next')
    assert.equal(s.investigators[1].actionsLeft, 20)
  },
  '02023': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.intellect = 8; s.locations[0].shroud = 1; s.locations[0].connections = ['next']
    s.locations.push({ id: 'next', name: '相邻', revealed: true, shroud: 1, clues: 1, maxClues: 1, connections: [s.locations[0].id] })
    play(s, '02023'); settle(s)
    assert.equal(s.investigators[0].clues, 1)
    assert.equal(s.locations[1].clues, 0)
  },
  '02024': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.horror = 2; inv.willpower = 8
    const a = asset(s, '02024')
    use(s, a); settle(s)
    // Heal 1 + successful willpower test heals 1 more.
    assert.equal(s.investigators[0].horror, 0)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
    const f = fixture(), failInv = f.investigators[0]
    failInv.horror = 2; failInv.willpower = 1; failInv.hand = ['01088', '01089']
    f.chaosBag = ['autofail']
    const failAsset = asset(f, '02024')
    use(f, failAsset); settle(f)
    // Failure: no extra heal, discard 1 card at random from hand.
    assert.equal(f.investigators[0].horror, 1)
    assert.equal(f.investigators[0].hand.length, 1)
    assert.equal(f.investigators[0].discard.length, 1)
  },
  '02026': () => {
    const s = fixture('01003'), inv = s.investigators[0]
    inv.hand = ['02026']; inv.intellect = 8; s.locations[0].shroud = 1; s.locations[0].clues = 3
    move(s, { action: 'investigate' })
    settle(s, p => p.kind === 'commit' && p.options.some(o => o.id === '0' && o.label.includes('赌一把')) ? '0' : null)
    assert.equal(s.investigators[0].clues, 2)
  },
  '02027': () => {
    const s = fixture(), inv = s.investigators[0]
    const a = asset(s, '02027')
    assert.equal(getStat(s, inv, 'combat'), 5)
    inv.resources = 0
    move(s, { action: 'endTurn' }); settle(s)
    assert.ok(!s.investigators[0].assets.some(item => item.id === a.id))
  },
  '02030': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.horror = 2
    const a = asset(s, '02030')
    use(s, a); settle(s)
    assert.equal(s.investigators[0].horror, 1)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 2)
  },
  '02031': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.willpower = 8
    const target = enemy(s, { traits: ['Monster'], exhausted: true })
    play(s, '02031'); settle(s)
    assert.deepEqual(s.enemies.find(item => item.id === target.id).bindMonster, { ownerSeat: 0, code: '02031' })
    assert.ok(!s.investigators[0].discard.includes('02031'))
  },
  '02033': () => {
    const s = fixture(), a = asset(s, '02033', { horror: 2 })
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).horror, 1)
  },
  '02034': () => {
    const s = fixture(), inv = s.investigators[0]
    s.locations[0].connections = ['next']; s.locations.push({ id: 'next', name: '相邻', revealed: true, clues: 0, connections: [s.locations[0].id] })
    inv.agility = 8
    const target = enemy(s)
    play(s, '02034'); settle(s, p => p.source === '02034' ? 'next' : null)
    assert.equal(s.enemies.find(item => item.id === target.id).location, 'next')
    assert.equal(s.enemies.find(item => item.id === target.id).exhausted, true)
  },
  '02035': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02035', { horror: 2 })
    assert.equal(getStat(s, inv, 'agility'), 3)
    assert.equal(getStat(s, inv, 'willpower'), 4)
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).horror, 1)
  },
  '02105': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.damage = 3
    play(s, '02105'); settle(s)
    assert.equal(s.investigators[0].damage, 1)
  },
  '02109': () => {
    const s = fixture(), gun = asset(s, '01016', { uses: 2 })
    play(s, '02109'); settle(s, p => p.source === '02109' ? gun.id : null)
    assert.equal(s.investigators[0].assets.find(item => item.id === gun.id).uses, 4)
  },
  '02116': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02116')
    inv.horror = 2
    use(s, a); settle(s)
    const updated = s.investigators[0], pipe = updated.assets.find(item => item.id === a.id)
    assert.equal(updated.damage, 1); assert.equal(updated.horror, 1); assert.equal(pipe.uses, 2); assert.equal(pipe.exhausted, true)
  },
  '02117': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02117')
    inv.damage = 2
    use(s, a); settle(s)
    const updated = s.investigators[0], pills = updated.assets.find(item => item.id === a.id)
    assert.equal(updated.horror, 1); assert.equal(updated.damage, 1); assert.equal(pills.uses, 2); assert.equal(pills.exhausted, true)
  },
  '02148': () => {
    const s = playAndSettle('02148', () => {}, () => null, 2)
    assert.deepEqual(s.investigators.map(inv => inv.resources), [32, 32])
    assert.deepEqual(s.investigators.map(inv => inv.hand.length), [2, 2])
  },
  '02149': () => {
    const s = fixture(), before = s.locations[0].clues
    play(s, '02149'); settle(s, p => p.source === 'artStudent' ? 'trigger' : null)
    assert.equal(s.investigators[0].clues, 1)
    assert.equal(s.locations[0].clues, before - 1)
  },
  '02152': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.combat = 5
    const a = asset(s, '02152'), target = enemy(s, { fight: 1 })
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2)
  },
  '02154': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.willpower = 8
    const a = asset(s, '02154'), target = enemy(s)
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02155': () => {
    const s = fixture(), inv = s.investigators[0]
    asset(s, '02155'); s.locations[0].shroud = 4; s.locations[0].clues = 2
    move(s, { action: 'investigate' }); settle(s)
    assert.equal(s.investigators[0].clues, 1)
    move(s, { action: 'investigate' }); settle(s)
    assert.equal(s.investigators[0].clues, 1)
  },
  '02184': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.deck = ['01016', ...Array(8).fill('01088'), '01086']
    play(s, '02184')
    assert.ok(!JSON.stringify(s.pendingChoice).includes('01016'))
    settle(s, p => p.options.find(o => o.cardCode === '01086')?.id)
    assert.ok(s.investigators[0].hand.includes('01086'))
  },
  '02186': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.hand = ['02186']; s.locations[0].clues = 0
    assert.match(validateMove(s, 0, { action: 'play', cardId: '02186' }), /线索/)
    s.locations[0].clues = 1
    move(s, { action: 'play', cardId: '02186' }); settle(s)
    assert.equal(s.investigators[0].hand.length, 3)
  },
  '02194': () => {
    const s = playAndSettle('02194')
    assert.equal(s.investigators[0].resources, 33)
    assert.equal(s.investigators[0].hand.length, 1)
  },
  '02230': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.assets = [{ id: 'dice', code: '02230', exhausted: false }]; s.chaosBag = ['-1']
    const execute = state => performTest(state, 0, 'intellect', 2, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'diceProbe' }, execute)
    let used = false
    while (s.pendingChoice) {
      const p = s.pendingChoice
      const optionId = p.source === 'dice' && !used ? (used = true, 'trigger') : p.options.find(o => ['done', 'skip'].includes(o.id))?.id || p.options[0].id
      resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId }, execute)
    }
    assert.equal(s.investigators[0].resources, 28)
    assert.deepEqual(s.result.cancelledTokens, ['-1'])
  },
  '02234': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.resources = 0
    const before = getStat(s, inv, 'intellect')
    asset(s, '02234')
    assert.equal(getStat(s, inv, 'intellect'), before + 1)
    inv.resources = 1
    assert.equal(getStat(s, inv, 'intellect'), before)
  },
  '02261': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.hand = ['02261']; inv.resources = 5
    const target = enemy(s, { damage: 3 })
    move(s, { action: 'endTurn' }); settle(s, p => p.options.find(o => o.cardCode === '02261')?.id || (p.source === '02261' ? '3:0' : null))
    assert.ok(target)
    assert.equal(s.investigators[0].damage, 0)
    assert.equal(s.investigators[0].resources, 9)
  },
  '02262': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02262')
    inv.damage = 3
    use(s, a); settle(s)
    assert.equal(s.investigators[0].damage, 1)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02263': () => {
    const s = fixture('01002'), a = asset(s, '02263')
    const target = enemy(s, { code: '02094', name: '鸟之奴仆', fight: 5, health: 4 })
    use(s, a, { targetId: target.id })
    assert.equal(s.pendingChoice?.kind, 'commit')
    assert.equal(s.skillTest.printedValue, 6)
    assert.equal(s.skillTest.value, 6)
    assert.equal(s.skillTest.difficulty, 5)
    settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 2)
  },
  '02264': () => {
    const s = fixture(), a = asset(s, '02264'), target = enemy(s, { evade: 5 })
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).exhausted, true)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02266': () => {
    const s = fixture(), inv = s.investigators[0]
    play(s, '02266'); settle(s)
    assert.equal(s.investigators[0].actionsLeft, 23)
  },
  '02267': () => {
    const s = fixture(), target = asset(s, '02191', { doom: 3 })
    play(s, '02267'); settle(s)
    assert.equal(s.investigators[0].assets.find(item => item.id === target.id).doom, 0)
  },
  '02273': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.hand = ['02273']; inv.horror = 4
    enemy(s, { engagedSeat: null })
    assert.match(validateMove(s, 0, { action: 'play', cardId: '02273' }), /敌人/)
    s.enemies = []
    move(s, { action: 'play', cardId: '02273' }); settle(s)
    assert.equal(s.investigators[0].horror, 1); assert.equal(s.investigators[0].hand.length, 1)
  },
  '02301': () => {
    const s = fixture(), a = asset(s, '02301'), target = enemy(s)
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 2)
  },
  '02303': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.intellect = 8; s.locations[0].shroud = 1; s.locations[0].clues = 2
    s.locations.push({ id: 'other', name: '另一地点', revealed: true, shroud: 3, clues: 2, maxClues: 2, connections: [] })
    play(s, '02303'); settle(s)
    assert.equal(s.investigators[0].clues, 2)
    assert.deepEqual(s.locations.map(loc => loc.clues), [1, 1])
  },
  '02304': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02304'), target = enemy(s, { fight: 8 })
    use(s, a, { targetId: target.id }); settle(s, p => p.source === a.id && p.kind === 'action' ? '2' : null)
    assert.equal(s.investigators[0].actionsLeft, 17)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02305': () => {
    const s = fixture(), inv = s.investigators[0]
    s.enemies = []; s.acts[0].objective = null
    inv.assets = [{ id: 'gold-watch', code: '02305', exhausted: false }]
    const round = s.round
    move(s, { action: 'endTurn' }); settle(s, p => p.source === 'gold-watch' ? 'trigger' : null)
    assert.equal(s.phase, 'investigation'); assert.equal(s.round, round)
    assert.ok(s.removedFromGame.includes('02305'))
  },
  '02306': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02306'), target = enemy(s)
    inv.willpower = 8
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02310': () => {
    const s = playAndSettle('02310', () => {}, p => p.source === 'redGlovedMan' ? 'trigger' : null)
    const updated = s.investigators[0]
    const chosen = ['willpower', 'intellect', 'combat', 'agility']
    assert.equal(chosen.filter(skill => getStat(s, updated, skill) === 6).length, 2)
    // The player chooses the two skills (first offered options here).
    assert.equal(getStat(s, updated, 'willpower'), 6)
    assert.equal(getStat(s, updated, 'intellect'), 6)
    move(s, { action: 'endTurn' })
    settle(s)
    assert.ok(!s.investigators[0].assets.some(item => item.code === '02310'))
  },
}

function runInvestigator(code) {
  assert.equal(canSelectInvestigator(code), true)
  assert.ok(INVESTIGATOR_ABILITIES[code])
  const s = fixture(), inv = s.investigators[0]
  inv.code = code
  if (code === '02001') {
    const before = inv.resources
    const target = enemy(s, { engagedSeat: null })
    move(s, { action: 'engage', enemyId: target.id }); settle(s, p => p.source === 'zoeyResource' ? 'trigger' : null)
    assert.equal(s.investigators[0].resources, before + 1)
  } else if (code === '02002') {
    inv.intellect = 5; s.locations[0].shroud = 1; s.locations[0].clues = 3
    move(s, { action: 'investigate' }); settle(s, p => p.source === 'rexClue' ? 'trigger' : null)
    assert.equal(s.investigators[0].clues, 2)
  } else if (code === '02003') {
    assert.equal(INVESTIGATOR_ABILITIES[code].upkeepResources, 2)
    assert.equal(INVESTIGATOR_ABILITIES[code].elderSign.kind, 'resources')
  } else if (code === '02004') {
    inv.combat = 4; s.chaosBag = ['skull']
    const execute = state => performTest(state, 0, 'combat', 1, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'jimProbe' }, execute)
    while (s.pendingChoice) resolveTransaction(s, s.pendingChoice.seat,
      { action: 'choose', choiceId: s.pendingChoice.id, optionId: s.pendingChoice.options.find(o => ['done', 'skip'].includes(o.id))?.id || s.pendingChoice.options[0].id }, execute)
    assert.equal(s.result.value, 4)
  } else {
    inv.hand = ['01088']; inv.assets = [{ id: 'duke', code: '02014', exhausted: true }]
    move(s, { action: 'freeAction' }); const saved = structuredClone(s)
    settle(s); settle(saved)
    assert.deepEqual(s, saved)
    assert.equal(s.investigators[0].assets[0].exhausted, false)
    assert.ok(validateMove(s, 0, { action: 'freeAction' }))
  }
}

function runSignature(code) {
  assert.equal(getAvailability(code).deckbuilding, false)
  const owner = { '02006': '02001', '02007': '02001', '02008': '02002', '02009': '02002', '02010': '02003',
    '02011': '02003', '02012': '02004', '02013': '02004', '02014': '02005', '02015': '02005' }[code]
  assert.ok(INVESTIGATORS[owner].deckRequirements.signatureCards.includes(code))
  const s = fixture(owner), inv = s.investigators[0]
  if (code === '02006') {
    inv.assets = [{ id: 'cross', code, exhausted: false }]
    const target = enemy(s, { engagedSeat: null, health: 3 })
    move(s, { action: 'engage', enemyId: target.id }); settle(s, p => ['cross', 'zoeysCross'].includes(p.source) ? 'trigger' : null)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 1)
    assert.equal(s.investigators[0].resources, 30)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
  } else if (code === '02007') {
    inv.deck = ['01088', code]; s.encounterDeck = ['ghoulMinion']
    move(s, { action: 'draw' }); settle(s)
    assert.ok(s.enemies.some(item => item.smiteTheWickedSeat === 0))
  } else if (code === '02008') {
    inv.hand = [code]; inv.clues = 6
    move(s, { action: 'play', cardId: code }); settle(s)
    assert.equal(s.investigators[0].hand.length, 5)
  } else if (code === '02009') {
    inv.threat = [{ id: 'curse', code }]; inv.intellect = 3; s.chaosBag = ['0']
    const execute = state => performTest(state, 0, 'intellect', 1, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'curseProbe' }, execute)
    while (s.pendingChoice) resolveTransaction(s, s.pendingChoice.seat,
      { action: 'choose', choiceId: s.pendingChoice.id, optionId: s.pendingChoice.options.find(o => ['done', 'skip'].includes(o.id))?.id || s.pendingChoice.options[0].id }, execute)
    assert.equal(s.result.success, true)
    assert.ok(s.investigators[0].threat.some(item => item.code === code))
    assert.ok(s.log.some(line => String(line?.text ?? line).includes('雷克斯的诅咒')))
  } else if (code === '02010') {
    inv.hand = [code]; inv.resources = 6
    move(s, { action: 'play', cardId: code }); settle(s, p => p.source === code ? '4' : null)
    const gun = s.investigators[0].assets.find(item => item.code === code)
    assert.equal(gun.uses, 4); assert.equal(s.investigators[0].resources, 2)
  } else if (code === '02011') {
    inv.deck = ['01088', code]
    move(s, { action: 'draw' }); settle(s)
    assert.ok(s.locations.some(loc => loc.searchingForIzzieSeat === 0))
  } else if (code === '02012') {
    inv.assets = [{ id: 'trumpet', code, exhausted: false }]; inv.horror = 2; s.chaosBag = ['skull']
    const execute = state => performTest(state, 0, 'willpower', 1, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'trumpetProbe' }, execute)
    while (s.pendingChoice) resolveTransaction(s, s.pendingChoice.seat,
      { action: 'choose', choiceId: s.pendingChoice.id, optionId: s.pendingChoice.source === 'jimsTrumpet' ? 'trigger' : s.pendingChoice.options.find(o => ['done', 'skip'].includes(o.id))?.id || s.pendingChoice.options[0].id }, execute)
    assert.equal(s.investigators[0].horror, 1); assert.equal(s.investigators[0].assets[0].exhausted, true)
  } else if (code === '02013') {
    inv.deck = ['01088', code]; s.chaosBag = ['skull', 'skull', 'autofail', '0', '0']
    move(s, { action: 'draw' }); settle(s)
    assert.equal(s.investigators[0].damage, 3); assert.equal(s.investigators[0].horror, 3)
  } else if (code === '02014') {
    inv.assets = [{ id: 'duke', code, exhausted: false }]
    inv.combat = 0
    const target = enemy(s, { fight: 3 })
    move(s, { action: 'ability', assetId: 'duke', abilityIndex: 0, targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
  } else {
    inv.assets = [{ id: 'duke', code: '02014', exhausted: false }]; inv.deck = ['01088', code]
    move(s, { action: 'draw' }); settle(s)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
  }
}

function runWeakness(code) {
  assert.equal(getAvailability(code).deckbuilding, false)
  // Phase 5：基础弱点可能已经迁到能力层（weakness 描述子），两条通道都算「有实现」。
  assert.ok(EFFECTS[code] || registeredEntry(code))
  if (code === '02037') {
    assert.equal(ALL_CARDS[code].permanent, true)
    assert.equal(ALL_CARDS[code].subtype, 'basicweakness')
    assert.equal(registeredEntry(code).startingResources, -2)
  } else {
    const s = fixture(), inv = s.investigators[0]
    inv.threat = [{ id: 'weakness', code }]
    const before = code === '02038' ? inv.damage : inv.horror
    inv.actionsLeft = 1
    assert.ok(validateMove(s, 0, { action: 'discardWeakness', threatId: 'weakness' }))
    inv.actionsLeft = 20
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0][code === '02038' ? 'damage' : 'horror'], before + 1)
  }
}

for (const code of expectedCodes) {
  const card = ALL_CARDS[code] || INVESTIGATORS[code]
  const name = card.nameZh || card.name
  test(`Dunwich ${code} ${name} 严格验收主要印刷效果`, () => {
    if (constructible.includes(code)) {
      assertContract(code)
      engineSurfaceProbe(code)
      runtime[code]?.()
    } else if (investigators.includes(code)) {
      runInvestigator(code)
    } else if (signatures.includes(code)) {
      runSignature(code)
    } else {
      runWeakness(code)
    }
  })
}

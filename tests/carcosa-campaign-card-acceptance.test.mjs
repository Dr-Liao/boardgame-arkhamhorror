import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { contentRegistry } from '../content/registered.js'
import { carcosaInvestigatorCardVerified } from '../content/packs/carcosaInvestigators/manifest.js'
import { carcosaPlayerCardVerified } from '../src/cards/carcosa-player-acceptance.js'
import { agendaVariants } from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/definition.js'
import { actTwoVariants } from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/definition.js'
import { scenario as dimScenario } from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/definition.js'
import { behavior as dimBehavior } from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js'
import {
  encounterRules,
} from '../content/campaigns/thePathToCarcosa/encounter-rules.js'
import { requestChoice, resolveTransaction } from '../src/engine/resolution.js'
// Phase 3（D1）：敌人/地点的卡面声明也是「逐卡行为证据」。
// 本文件不 import 引擎（只做账本校验），因此在这里完成最小的装配：
// 注册能力条目 + 把注册表注入修正管线，entityModifierTotal 才有内容可读。
import { registerCardAbilities, registeredCodes, registeredEntry } from '../src/engine/ability.js'
import { entityModifierTotal, setModifierRegistry } from '../src/engine/modifiers.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
if (!registeredCodes().length) registerCardAbilities([...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES])
setModifierRegistry(registeredEntry)

const cyclePacks = new Set(['ptc', 'eotp', 'tuo', 'apot', 'tpm', 'bsr', 'dca'])
const hiddenCodes = new Set([
  '03084a', '03084b', '03084c', '03084d', '03186', '03187', '03340', '03341', '03342',
])

// These cards are registered in the scenario data, but their non-generic
// printed behavior has no executable rule path yet. They are deliberately
// inventoried as pending instead of inheriting a chapter-level verified flag.
export const PENDING_CARCOSA_CAMPAIGN_CODES = Object.freeze([
])
const pending = new Set(PENDING_CARCOSA_CAMPAIGN_CODES)

const campaignCards = Object.values(ALL_CARDS)
  .filter(card => cyclePacks.has(card.pack)
    && !carcosaInvestigatorCardVerified(card.code)
    && !carcosaPlayerCardVerified(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))

const scenarioIds = contentRegistry.getCampaign('thePathToCarcosa').scenarioIds
const scenarioData = scenarioIds.map(id => contentRegistry.getScenarioData(id))
const extraDefinitions = [
  ...Object.values(agendaVariants).flat(),
  ...actTwoVariants,
]
const runtimeJson = JSON.stringify([...scenarioData, ...extraDefinitions])
const behaviorSurface = [
  ...scenarioIds.flatMap(id => Object.values(contentRegistry.getBehavior(id))
    .filter(value => typeof value === 'function')
    .map(value => Function.prototype.toString.call(value))),
  // 卡面声明（非玩家卡描述子）与函数体一样是行为证据，只是形式从代码变成数据。
  JSON.stringify(NON_PLAYER_ABILITY_ENTRIES),
].join('\n')

const linkedCodes = new Map()
for (const card of Object.values(ALL_CARDS)) {
  for (const linked of [card.linkedToCode, card.linkedCardCode].filter(Boolean)) {
    linkedCodes.set(card.code, [...new Set([...(linkedCodes.get(card.code) || []), linked])])
    linkedCodes.set(linked, [...new Set([...(linkedCodes.get(linked) || []), card.code])])
  }
}

function collectDefinitions(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectDefinitions(item, result)
    return result
  }
  if (!value || typeof value !== 'object') return result
  if (typeof value.originalCode === 'string') result.push(value)
  for (const item of Object.values(value)) collectDefinitions(item, result)
  return result
}
const definitions = collectDefinitions([...scenarioData, ...extraDefinitions])

function definitionFor(code) {
  return definitions.find(definition => definition.originalCode === code || definition.code === code)
}

function localized(card, field) {
  return card[`${field}Zh`] || card[field] || ''
}

function represented(code) {
  return Boolean(runtimeJson.includes(`"${code}"`)
    || (linkedCodes.get(code) || []).some(linked => runtimeJson.includes(`"${linked}"`)))
}

function behaviorLinked(code) {
  return Boolean(hiddenCodes.has(code) || behaviorSurface.includes(code)
    || (linkedCodes.get(code) || []).some(linked => behaviorSurface.includes(linked)))
}

assert.equal(campaignCards.length, 268)
assert.equal(pending.size, 0)
assert.ok(PENDING_CARCOSA_CAMPAIGN_CODES.every(code =>
  campaignCards.some(card => card.code === code)))

for (const card of campaignCards) {
  const status = pending.has(card.code) ? '待实现' : '已验收'
  test(`Carcosa ${card.code} ${status} · ${card.type} 卡文与运行边界`, () => {
    assert.equal(card.dataStatus, 'validated')
    assert.equal(card.availability, 'catalog-only')
    assert.ok(card.encounterCode)
    assert.ok(localized(card, 'name'))
    assert.equal(represented(card.code), true, `${card.code} 没有进入任何卡尔克萨运行表面`)

    const definition = definitionFor(card.code)
    if (definition) {
      assert.equal(definition.originalCode, card.code)
      if (card.type === 'scenario') {
        assert.ok(definition.name.endsWith(localized(card, 'name')))
      } else {
        assert.equal(definition.name, localized(card, 'name'))
      }
      if (['enemy', 'treachery', 'location', 'act', 'agenda', 'asset'].includes(card.type)) {
        assert.equal(definition.text, localized(card, 'text'))
      }
      if (card.type === 'enemy') {
        assert.equal(definition.fight, card.fight ?? 0)
        assert.equal(definition.evade, card.evade ?? 0)
        assert.equal(definition.health, card.health ?? 1)
        assert.equal(definition.rulesPending, false)
      }
      if (card.type === 'treachery') {
        assert.equal(definition.rulesPending, false)
        assert.deepEqual(definition.effect, { kind: 'campaignRule' })
        if (hiddenCodes.has(card.code)) assert.ok(definition.hiddenRule)
      }
      if (card.type === 'location') {
        assert.equal(definition.shroud, card.shroud)
        assert.equal(definition.cluesPerInvestigator, card.clues || 0)
      }
      if (card.type === 'agenda') assert.equal(definition.doomThreshold, card.doom)
      if (['act', 'agenda'].includes(card.type)) {
        assert.equal(definition.advanceText, localized(card, 'backText'))
      }
    } else {
      const related = linkedCodes.get(card.code) || []
      assert.ok(related.length, `${card.code} 既无独立定义，也不是已登记关联面`)
      assert.ok(related.some(code => runtimeJson.includes(`"${code}"`)))
      assert.ok(localized(card, 'text') || localized(card, 'flavor'))
    }

    const needsBehaviorLink = ['enemy', 'treachery', 'asset', 'story'].includes(card.type)
    if (pending.has(card.code)) {
      assert.equal(needsBehaviorLink, true)
      assert.equal(hiddenCodes.has(card.code) || behaviorSurface.includes(card.code), false,
        `${card.code} 已出现行为路径，应从待实现清单移除并补充专项断言`)
    } else if (needsBehaviorLink) {
      assert.equal(behaviorLinked(card.code), true,
        `${card.code} 缺少逐卡行为证据，不得标记为已验收`)
    }
  })
}

test('C5 shared encounter rules execute every formerly pending enemy and treachery family', () => {
  for (const code of ['03086', '03089', '03093', '03095', '03096', '03098', '03099', '03103',
    '03222', '03258', '03259', '03335', '03336']) assert.equal(registeredEntry(code)?.implemented, true, code)
  for (const code of ['03224', '03225', '03226', '03260', '03261', '03262',
    '03302', '03303', '03337', '03338', '03339']) assert.equal(registeredEntry(code)?.implemented, true, code)

  const state = {
    round: 2, phase: 'investigation', campaign: { leadSeat: 0 },
    investigators: [{ seat: 0, name: '甲', maxSanity: 7, horror: 3, assets: [], threat: [], hand: [], resources: 5 }],
    locations: [{ id: 'hall', name: '大厅', shroud: 4, shroudMod: 1, revealed: true, clues: 2, connections: [] }],
    enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {}, numInvestigators: 1,
  }
  const poltergeist = { id: 'e1', code: '03103', originalCode: '03103', location: 'hall', fight: 2 }
  // Phase 3（D1）：03103 的战斗值修正已搬到卡面条目，读点改为实体修正。
  assert.equal(entityModifierTotal(state, poltergeist, 'enemyFight'), 3)
  const harm = []
  encounterRules.enemyEngaged(state, { id: 'e2', code: '03095' }, state.investigators[0], {
    damage: (seat, amount) => harm.push(['investigator', seat, amount]),
    damageEnemy: (id, amount) => harm.push(['enemy', id, amount]),
  })
  assert.deepEqual(harm, [['investigator', 0, 1], ['enemy', 'e2', 1]])
  let horror = 0
  encounterRules.afterEvade(state, state.investigators[0], { code: '03089' },
    { success: true, value: 5, difficulty: 3 }, { horror: (_seat, amount) => { horror += amount } })
  assert.equal(horror, 1)
})

test('C5 threat treacheries enter play and resolve their printed upkeep boundaries', () => {
  const inv = { seat: 0, name: '甲', maxSanity: 7, horror: 0, assets: [], threat: [], hand: [], discard: [], resources: 5 }
  const state = {
    round: 1, moveCount: 0, campaign: { leadSeat: 0 }, investigators: [inv],
    locations: [{ id: 'hall', shroudMod: 0, attachments: [] }], enemies: [],
    encounterDeck: [], encounterDiscard: [], scenarioFlags: {}, numInvestigators: 1,
  }
  inv.location = 'hall'
  const api = {
    test: (_seat, _skill, difficulty, resolve) => resolve({ success: false, difficulty, value: difficulty - 2 }),
    threat: (_seat, code, extra = {}) => inv.threat.push({ id: `t${inv.threat.length}`, code, ...extra }),
    choose: request => request.options[0].id,
    drawEncounter() {},
  }
  assert.equal(encounterRules.resolveEncounter(state, inv, { code: '03225' }, api), true)
  assert.equal(inv.threat[0].resources, 2)
  assert.equal(encounterRules.resolveEncounter(state, inv, { code: '03226' }, api), true)
  assert.equal(encounterRules.resolveEncounter(state, inv, { code: '03261' }, api), true)
  assert.equal(encounterRules.resolveEncounter(state, inv, { code: '03262' }, api), true)
  assert.equal(state.locations[0].shroudMod, 1)
  assert.equal(state.locations[0].attachments[0].code, '03262')
})

test('C5 final-scenario treacheries apply stage-scaled harm, sanity and doom', () => {
  const inv = {
    seat: 0, name: '甲', maxSanity: 7, horror: 0, damage: 0, actionsLeft: 3,
    assets: [], threat: [], hand: ['03010', '03011'], discard: [], resources: 5,
  }
  const state = {
    actIndex: 0, campaign: { leadSeat: 0 }, investigators: [inv], locations: [], enemies: [],
    encounterDeck: [], encounterDiscard: [], scenarioFlags: {
      agendaDecks: { a: { index: 1 }, c: { index: 1 } },
    }, numInvestigators: 1,
  }
  const api = {
    test: (_seat, _skill, difficulty, resolve) => resolve({ success: false, difficulty, value: 0 }),
    damage: (_seat, amount) => { inv.damage += amount },
    horror: (_seat, amount) => { inv.horror += amount },
    loseActions: (_seat, amount) => { inv.actionsLeft = Math.max(0, inv.actionsLeft - amount) },
    discardChosen: (_seat, amount) => inv.discard.push(...inv.hand.splice(0, amount)),
    addDoom: amount => { state.doom = (state.doom || 0) + amount },
    choose: request => request.options[0].id,
  }
  encounterRules.resolveEncounter(state, inv, { code: '03302' }, api)
  assert.equal(inv.damage, 2)
  assert.equal(inv.actionsLeft, 1)
  encounterRules.resolveEncounter(state, inv, { code: '03303' }, api)
  assert.equal(inv.horror, 2)
  assert.equal(inv.discard.length, 2)
  inv.horror = inv.maxSanity
  encounterRules.resolveEncounter(state, inv, { code: '03339' }, api)
  assert.equal(state.doom, 2)
})

test('C5 Dim Carcosa resolves all thirteen location backs and the Pallid Mask asset', () => {
  const fronts = ['03325', '03326a', '03326c', '03327a', '03327c', '03327e',
    '03328a', '03328c', '03328e', '03329a', '03329c', '03330', '03331']
  for (const front of fronts) {
    const id = Object.values(dimScenario.locations).find(location => location.originalCode === front)?.id
      || Object.entries(dimScenario.locationVariants).find(([, variants]) =>
        variants.some(location => location.originalCode === front))?.[0]
    const definition = (dimScenario.locationVariants[id] || [dimScenario.locations[id]])
      .find(location => location.originalCode === front)
    const other = (dimScenario.locationVariants[id] || [])
      .find(location => location.originalCode !== front)
    const inv = { seat: 0, name: '甲', location: id, horror: 3, assets: [] }
    const state = {
      numInvestigators: 1, campaign: { leadSeat: 0, records: {} }, investigators: [inv],
      enemies: [], locations: [{ ...structuredClone(definition), id, revealed: true, attachments: [] }],
      scenario: dimScenario, scenarioZones: { setAside: other ? [other.originalCode] : [], removed: [] },
      scenarioFlags: {}, locationVariants: {}, encounterDiscard: [],
    }
    const api = {
      choose: request => request.options.at(-1).id,
      test: (_seat, _skill, difficulty, resolve) => resolve({ success: true, difficulty, value: difficulty + 2 }),
      healHorror: (_seat, amount) => { inv.horror = Math.max(0, inv.horror - amount) },
      horror: (_seat, amount) => { inv.horror += amount },
      damageEnemy() {}, evadeEnemy() {}, stepToward() {}, moveEnemy() {}, attack() {},
      checkEnemyDefeat() {}, random: () => 0,
    }
    assert.doesNotThrow(() => dimBehavior.locationStory(state, state.locations[0], api, 0), front)
    assert.ok(state.locations[0].carcosaStoryResolved || state.locations[0].originalCode !== front
      || state.locations[0].storyRefused, front)
  }
  const state = {
    campaign: { leadSeat: 0 }, investigators: [{ seat: 0, assets: [] }],
    enemies: [{ id: 'stranger', code: '03059' }], scenarioFlags: {}, actIndex: 1, numInvestigators: 1,
  }
  let spawned = null
  registeredEntry('03321a').actRule.onAdvance(state, { originalCode: '03321a' }, {
    removeEnemyFromGame: enemy => state.enemies.splice(state.enemies.indexOf(enemy), 1),
    giveAsset: (seat, code, extra) => state.investigators[seat].assets.push({ code, ...extra }),
    spawn: code => { spawned = code },
  })
  assert.deepEqual(state.investigators[0].assets[0],
    { code: '03321b', cannotLeavePlay: true, sanityModifier: -2 })
  assert.equal(spawned, '03334')
})

test('C5 shared enemies preserve stacked timing, spawn selection and King Edict values', () => {
  const puppet = { id: 'puppet', code: '03096', fight: 2 }
  const state = {
    round: 4, phase: 'enemy', campaign: { leadSeat: 0 }, investigators: [{ seat: 0 }],
    enemies: [puppet], locations: [], scenarioFlags: {},
  }
  const api = { choose: () => 'fight', horror() {} }
  encounterRules.enemyEngaged(state, puppet, state.investigators[0], api)
  encounterRules.enemyEngaged(state, puppet, state.investigators[0], api)
  state.round = 5
  state.phase = 'investigation'
  assert.equal(entityModifierTotal(state, puppet, 'enemyFight'), 6)

  const spawn = {
    revision: 0, rngState: 12345, round: 1,
    campaign: { leadSeat: 0 }, investigators: [{ seat: 0, location: 'a' }],
    locations: [
      { id: 'a', name: '甲', revealed: true, clues: 2 },
      { id: 'b', name: '乙', revealed: true, clues: 2 },
      { id: 'c', name: '丙', revealed: false, clues: 9 },
    ], enemies: [], scenarioFlags: {},
  }
  const execute = draft => {
    draft.spawnResult = encounterRules.spawnLocation(draft, '03098', null, 0, {
      choose: request => requestChoice(draft, request),
    })
  }
  resolveTransaction(spawn, 0, { action: 'spawn' }, execute)
  assert.ok(spawn.pendingChoice)
  const restored = structuredClone(spawn)
  const answer = { action: 'choose', choiceId: spawn.pendingChoice.id, optionId: 'b' }
  resolveTransaction(spawn, 0, answer, execute)
  resolveTransaction(restored, 0, answer, execute)
  assert.deepEqual(restored, spawn)
  assert.equal(spawn.spawnResult, 'b')

  const cultist = { code: '03098', traits: ['Cultist'], clues: 2, doom: 1 }
  spawn.scenarioFlags.kingsEdict = true
  assert.equal(encounterRules.enemyStatModifier(spawn, cultist, 'fight'), 3)
})

test('C5 mid-cycle privacy and Behind You ownership rules execute precisely', () => {
  const owner = {
    seat: 0, name: '甲', location: 'catacomb', resources: 2,
    hand: ['01088'], hiddenCards: [], discard: [],
    threat: [{ id: 'shadow', code: '03261' }],
  }
  const helper = {
    seat: 1, name: '乙', location: 'catacomb', resources: 0,
    hand: [], hiddenCards: [], discard: [], threat: [],
  }
  const state = {
    round: 2, campaign: { leadSeat: 0 }, investigators: [owner, helper],
    locations: [{ id: 'catacomb', originalCode: '03247', revealed: false, name: '墓穴' }],
    enemies: [{ id: 'lecturer', code: '03258', location: 'catacomb' }], scenarioFlags: {},
  }
  // 「查看身后」只能由该威胁区的控制者本人执行。
  assert.equal(encounterRules.encounterActions(state, helper).some(action => action.rule === 'lookBehindYou'), false)
  const shadow = encounterRules.encounterActions(state, owner).find(action => action.rule === 'lookBehindYou')
  assert.equal(shadow.threatOwnerSeat, 0)
  encounterRules.performEncounterAction(state, owner, shadow, {})
  assert.equal(owner.threat[0].lookedRound, 2)
  encounterRules.turnEnded(state, owner, { choose: () => 'resources' })
  assert.equal(owner.resources, 2)
  assert.equal(owner.threat.length, 1)

  owner.threat[0].lookedRound = 0
  owner.hiddenCards = ['03341']
  owner.hand = ['03341']
  owner.resources = 0
  // 手牌里只有不能被普通效果弃掉的隐私卡：不存在可弃的资源/手牌时不得弹出无效选择，
  // 但卡面的「然后，弃掉身后暗影」仍然执行（旧实现会把这张强制牌永久留在威胁区）。
  encounterRules.turnEnded(state, owner, { choose: () => { throw new Error('不应要求无效选择') } })
  assert.deepEqual(owner.hand, ['03341'])
  assert.equal(owner.threat.length, 0)

  let privateText = ''
  state.scenarioFlags = {}
  encounterRules.performEncounterAction(state, helper, {
    rule: 'parleyLecturer', enemyId: 'lecturer',
  }, {
    test: (_seat, _skill, _difficulty, resolve) => resolve({ success: true }),
    choose: () => 'catacomb',
    privateInfo: (_seat, text) => { privateText = text },
  })
  assert.match(privateText, /墓穴/)
  assert.equal(state.scenarioFlags.catacombsLecturerUsed, true)
})

test('C5 Dim Carcosa flip windows and Hastur defeat gate use printed ordering', () => {
  assert.equal(dimBehavior.locationsStartRevealed, true)
  const loc = { id: 'target', originalCode: '03325', revealed: true, clues: 0, connections: ['near'] }
  const inv = { seat: 0, location: 'target', clues: 3, assets: [], threat: [] }
  const hastur = { id: 'hastur', code: '03332', health: 3, damageTaken: 3 }
  const state = {
    round: 1, agendaIndex: 0, actIndex: 0, campaign: { leadSeat: 0, records: {} }, investigators: [inv],
    locations: [loc, { id: 'near', connections: ['target'] }], enemies: [hastur],
    scenarioFlags: {}, numInvestigators: 1,
    acts: [{ originalCode: '03324' }],
  }
  assert.ok(dimBehavior.encounterActions(state, inv).some(action => action.rule === 'flipCarcosaLocation'))
  assert.equal(dimBehavior.enemyCanBeDefeated(state, hastur), false)
  state.agendaIndex = 2
  assert.equal(dimBehavior.enemyCanBeDefeated(state, hastur), false)
  state.campaign.records.knowTheSecret = true
  assert.equal(dimBehavior.enemyCanBeDefeated(state, hastur), true)
  assert.equal(dimBehavior.investigatorCanBeDefeated(state, inv, 'horror'), false)

  const order = []
  state.enemies = [
    { id: 'beast', code: '03335', location: 'near', exhausted: false },
    { id: 'spawn', code: '03336', location: 'near', exhausted: false, engagedSeat: null },
  ]
  encounterRules.locationWillFlip(state, loc, {
    attack: () => order.push('attack'),
  })
  encounterRules.locationFlipped(state, loc, {
    stepToward: () => 'target',
    moveEnemy: () => order.push('move'),
  })
  assert.deepEqual(order, ['attack', 'move'])
})

test('C4 covers every 03-cycle card exactly once across investigator, player and campaign acceptance', () => {
  const cycleCards = Object.values(ALL_CARDS).filter(card => cyclePacks.has(card.pack))
  const partitions = cycleCards.map(card => [
    carcosaInvestigatorCardVerified(card.code),
    carcosaPlayerCardVerified(card.code),
    campaignCards.some(candidate => candidate.code === card.code),
  ].filter(Boolean).length)
  assert.equal(cycleCards.length, 383)
  assert.ok(partitions.every(count => count === 1))
  assert.equal(cycleCards.filter(card => carcosaInvestigatorCardVerified(card.code)).length, 20)
  assert.equal(cycleCards.filter(card => carcosaPlayerCardVerified(card.code)).length, 95)
})

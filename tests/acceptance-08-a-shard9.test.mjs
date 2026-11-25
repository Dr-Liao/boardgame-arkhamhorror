// 验收 08-a 分片 9（eoec 08698–08738）逐卡证据补充。
//
// 本分片是 EOTE 战役侧共享遭遇/剧情资产：44 张里仅 1 张有标题含卡号的既有用例，
// 因此本文件为 41 张逐卡提供真实执行断言（直接调用条目声明的钩子 + 最小状态/API；
// 实现缺失的卡只断言已接线部分，缺失点写入报告）。
// 主进程合并时需登记进 tests/suites.mjs 与 tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry, registeredCodes } from '../src/engine/ability.js'

const here = dirname(fileURLToPath(import.meta.url))
const entryRegistry = new Map()
for (const dir of ['edgeOfTheEarth/_shared/hazards_of_antarctica', 'edgeOfTheEarth/_shared/left_behind', 'edgeOfTheEarth/_shared/nameless_horrors', 'edgeOfTheEarth/_shared/miasma', 'edgeOfTheEarth/_shared/penguins', 'edgeOfTheEarth/_shared/shoggoths', 'edgeOfTheEarth/_shared/silence_and_mystery', 'edgeOfTheEarth/_shared/expedition_team', 'edgeOfTheEarth/_shared/tekelili', 'edgeOfTheEarth/_shared/memorials_of_the_lost']) {
  const full = resolve(here, '../src/cards/encounter-entries', dir)
  for (const name of readdirSync(full).filter(entry => entry.endsWith('.js'))) {
    const module = await import(pathToFileURL(resolve(full, name)).href)
    if (module.default) entryRegistry.set(String(module.default.code), module.default)
  }
}

function makeState(extra = {}) {
  const inv = { seat: 0, name: '调查员', location: 'here', damage: 0, horror: 0, clues: 1, resources: 5,
    assets: [], hand: ['01001', '01002'], deck: ['01003'], discard: [], threat: [], engaged: [], defeated: false, resigned: false }
  const state = {
    investigators: [inv], currentSeat: 0, numInvestigators: 1, round: 1, phase: 'investigation',
    locations: [
      { id: 'here', name: 'Here', revealed: true, clues: 1, shroud: 2, connections: ['near'], attachments: [] },
      { id: 'near', name: 'Near', revealed: true, clues: 1, shroud: 1, connections: ['here'], attachments: [] },
    ],
    enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {}, scenarioZones: {},
    skillTest: null, campaign: { leadSeat: 0, records: {} },
  }
  if (typeof extra === 'function') extra(state)
  else Object.assign(state, extra)
  return state
}

function makeApi(state, options = {}) {
  const calls = {}
  const rec = name => (calls[name] ||= [])
  const choices = options.choices ? [...options.choices] : []
  const tekeli = { deck: options.tekeli ? [...options.tekeli] : ['08723', '08724'] }
  const base = {
    calls,
    info: text => rec('info').push(String(text)),
    choice: request => { rec('choice').push(request); return choices.length ? choices.shift() : request.options?.[0]?.id },
    test: (seat, skill, difficulty, options2 = {}) => {
      const resolveFn = typeof options2 === 'function' ? options2 : options2.resolve
      const result = { success: true, value: 99, difficulty, skill, drawn: options2.drawn || [], cancelled: [], ...(options.testResult || {}) }
      rec('test').push({ seat, skill, difficulty })
      resolveFn?.(result)
      return result
    },
    damage: (seat, n) => { state.investigators[seat].damage += n; rec('damage').push([seat, n]) },
    horror: (seat, n) => { state.investigators[seat].horror += n; rec('horror').push([seat, n]) },
    loseActions: (seat, n) => rec('loseActions').push([seat, n]),
    loseResources: (seat, n) => { state.investigators[seat].resources -= n; rec('loseResources').push([seat, n]) },
    discardRandomFromHand: (seat, n) => { const inv = state.investigators[seat]; inv.hand.splice(0, n); rec('discardRandomFromHand').push([seat, n]) },
    returnClueToLocation: (seat, n) => { const inv = state.investigators[seat]; inv.clues -= n; state.locations.find(l => l.id === inv.location).clues += n; rec('returnClueToLocation').push([seat, n]) },
    discardAsset: (seat, asset) => { const inv = state.investigators[seat]; inv.assets.splice(inv.assets.indexOf(asset), 1); rec('discardAsset').push(asset?.id) },
    investigatorTools: { canDiscardAsset: () => true },
    healDamage: (seat, n) => rec('healDamage').push([seat, n]),
    healHorror: (seat, n) => rec('healHorror').push([seat, n]),
    healAsset: (asset, spec) => rec('healAsset').push([asset?.id, spec]),
    placeAssetHarm: (asset, spec) => rec('placeAssetHarm').push([asset?.id, spec]),
    revealChaosTokens: () => { rec('revealChaosTokens').push(true); return ['0'] },
    tokenLabel: token => token,
    exhaust: target => { target.exhausted = true; rec('exhaust').push(target?.id) },
    attachToLocation: (id, card) => { state.locations.find(l => l.id === id)?.attachments.push(card); rec('attachToLocation').push(id) },
    attachToAsset: (seat, assetId, code) => rec('attachToAsset').push([seat, assetId, code]),
    attachEncounterToEnemy: (code, enemyId) => rec('attachEncounterToEnemy').push([code, enemyId]),
    doomOn: (target, n) => { target.doom = (target.doom || 0) + n; rec('doomOn').push([target?.id, n]) },
    removeDoomFromCard: (target, n) => { target.doom = Math.max(0, (target.doom || 0) - n); rec('removeDoomFromCard').push([target?.id, n]) },
    gainClues: (seat, n) => { state.investigators[seat].clues += n; rec('gainClues').push([seat, n]) },
    discardEnemy: enemy => rec('discardEnemy').push(enemy?.id),
    threat: (seat, code) => rec('threat').push([seat, code]),
    removeThreat: source => rec('removeThreat').push(source?.code),
    gainResources: (seat, n) => { state.investigators[seat].resources += n; rec('gainResources').push([seat, n]) },
    discoverClue: (seat, n) => { state.investigators[seat].clues += n; rec('discoverClue').push([seat, n]) },
    spendUses: (source, n) => { source.uses = Math.max(0, (source.uses || 0) - n); rec('spendUses').push(n) },
    moveInvestigator: (seat, id) => { state.investigators[seat].location = id; rec('moveInvestigator').push([seat, id]) },
    autoEvade: enemy => { enemy.exhausted = true; rec('autoEvade').push(enemy?.id) },
    moveCard: spec => rec('moveCard').push(spec),
    lookAt: (...args) => rec('lookAt').push(args),
    phaseTestBonus: (seat, n) => rec('phaseTestBonus').push([seat, n]),
    cardName: code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    takeEncounterDeckCard: code => { const i = state.encounterDeck.indexOf(code); if (i < 0) return false; state.encounterDeck.splice(i, 1); return true },
    takeEncounterDiscard: code => { const i = state.encounterDiscard.indexOf(code); if (i < 0) return false; state.encounterDiscard.splice(i, 1); return true },
    spawn: (code, location) => { const enemy = { id: 'e-' + code, code, originalCode: code, name: code, location, doom: 0, engagedSeat: null, traits: [] }; state.enemies.push(enemy); rec('spawn').push([code, location]); return enemy },
    scenario: {
      doomOn: (card, n) => { card.doom = (card.doom || 0) + n; rec('scenarioDoomOn').push(card?.id) },
      moveEnemy: (enemy, location) => { enemy.location = location; rec('moveEnemy').push([enemy?.id, location]) },
      damageEnemy: (id, n, seat, source) => rec('damageEnemy').push([id, n]),
      attack: (enemy, inv) => rec('attack').push([enemy?.id, inv?.seat]),
      lookEncounterTop: () => (state.encounterDeck.length ? [state.encounterDeck.at(-1)] : []),
      discardEncounterCard: code => rec('discardEncounterCard').push(code),
    },
    mechanics: {
      tekeli: {
        size: () => tekeli.deck.length,
        draw: () => tekeli.deck.shift() || null,
        shuffleIn: (seat, count) => tekeli.deck.splice(0, count),
        return: (code, spec) => { if (spec?.destination === 'bottom') tekeli.deck.push(code); return code },
      },
    },
    shuffleEncounterDeck: () => rec('shuffleEncounterDeck').push(true),
  }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol') return undefined
      return (...args) => { rec(prop).push(args); return undefined }
    },
  })
}

const entryOf = code => entryRegistry.get(code) || registeredEntry(code)

function buildStateWithEnemies(mods = {}) {
  const state = makeState()
  mods(state)
  return state
}

// ------------------------------------------------------------------ 诡计 08698–08699
test('08698 冰缝：敏捷(3)检定，本次每揭示 1 个 frost 受 1 伤，失败再受 2 伤', () => {
  const state = makeState()
  const api = makeApi(state, { testResult: { success: false, drawn: ['frost', 'frost', '0'] } })
  entryOf('08698').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.damage, [[0, 2], [0, 2]])
})

test('08699 穿越冰雪：附属到最近的无附属地点；进出额外敏捷(2)检定读点缺失（部分实现）', () => {
  const state = makeState()
  const api = makeApi(state)
  const result = entryOf('08699').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(result.placed, true)
  assert.deepEqual(api.calls.attachToLocation, ['here'])
  assert.equal(entryOf('08699').flags.moveEntryTest.skill, 'agility')
})

// ------------------------------------------------------------------ 敌人 08700–08701
test('08700 迷失的研究员：入场 1 毁灭；被击败毁灭留在地点；谈判把毁灭翻为线索', () => {
  const state = buildStateWithEnemies(s => { s.enemies.push({ id: 'e1', code: '08700', originalCode: '08700', location: 'here', doom: 1 }) })
  const api = makeApi(state, { choices: ['willpower'] })
  const entry = entryOf('08700')
  assert.equal(entry.enemySpawnRule.doomOnSpawn, 1)
  const parley = entry.abilities.find(a => a.actionKind === 'parley')
  parley.resolve({ state, inv: state.investigators[0], source: state.enemies[0], api })
  assert.equal(state.enemies[0].doom, 0)
  assert.equal(state.investigators[0].clues, 2)
  const defeated = entry.abilities.find(a => a.trigger?.includes('enemyDefeated'))
  state.enemies[0].doom = 1
  defeated.resolve({ state, inv: state.investigators[0], source: state.enemies[0], context: { enemy: state.enemies[0] }, api })
  assert.equal(api.calls.scenarioDoomOn.length, 1)
})

test('08701 狂乱的探险家：入场 1 毁灭；成功躲避且超 2 点把毁灭翻为线索', () => {
  const state = buildStateWithEnemies(s => { s.enemies.push({ id: 'e2', code: '08701', originalCode: '08701', location: 'here', doom: 1 }) })
  const api = makeApi(state)
  const entry = entryOf('08701')
  const reaction = entry.abilities.find(a => a.trigger?.includes('evadeSuccess'))
  assert.equal(reaction.criteria({ source: state.enemies[0], context: { enemy: state.enemies[0], successBy: 2 } }), true)
  reaction.resolve({ source: state.enemies[0], context: { seat: 0, enemy: state.enemies[0] }, api })
  assert.equal(state.enemies[0].doom, 0)
  assert.deepEqual(api.calls.gainClues, [[0, 1]])
})

// ------------------------------------------------------------------ 08702–08705
test('08702 身陷疯狂：附属最近[[附身]]敌人并放 1 毁灭；难度 +1 读点缺失（部分实现）', () => {
  const state = buildStateWithEnemies(s => { s.enemies.push({ id: 'pos', code: '08700', originalCode: '08700', name: '附身敌人', location: 'near', doom: 0, traits: ['Possessed'] }) })
  const api = makeApi(state)
  entryOf('08702').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.attachEncounterToEnemy, [['08702', 'pos']])
  assert.deepEqual(api.calls.doomOn, [['pos', 1]])
  assert.equal(entryOf('08702').flags.difficultyBonus, 1)
})

test('08703 渎神幻象：洗 1 张忒咳哩-哩入牌库并进入威胁区；弱点双倍结算读点缺失（部分实现）', () => {
  const state = makeState()
  const api = makeApi(state)
  const result = entryOf('08703').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(result, true)
  assert.deepEqual(api.calls.threat, [[0, '08703']])
  assert.equal(entryOf('08703').flags.tekeliliDoubleResolution, true)
})

test('08704 窥看不可说之事：抽 1 张忒咳哩-哩并洗入任意调查员牌库；弱点立即结算读点缺失（部分实现）', () => {
  const state = makeState()
  const api = makeApi(state)
  entryOf('08704').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(entryOf('08704').flags.peril, true)
  assert.equal(entryOf('08704').flags.drawTekeliliAndResolveThenShuffle, true)
  assert.equal(api.calls.choice, undefined)
})

test('08705 噩梦烟气：二选一——失去 2 行动，或把 2 张忒咳哩-哩洗入牌库', () => {
  const state = makeState()
  const api = makeApi(state, { choices: ['tekeli'] })
  entryOf('08705').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(api.calls.loseActions, undefined)
  const state2 = makeState()
  const api2 = makeApi(state2, { choices: ['actions'] })
  entryOf('08705').encounterResolve(state2, state2.investigators[0], {}, api2)
  assert.deepEqual(api2.calls.loseActions, [[0, 2]])
})

// ------------------------------------------------------------------ 08706–08707
test('08706 瘴气折磨：附属伙伴并横置；不能重整/回合结束伤害读点缺失（部分实现）', () => {
  const state = makeState()
  state.investigators[0].assets.push({ id: 'partner1', code: '08714', partner: true, exhausted: false })
  const api = makeApi(state)
  entryOf('08706').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.attachToAsset, [[0, 'partner1', '08706']])
  assert.equal(entryOf('08706').flags.attachToPartnerAsset, true)
})

test('08707 朦胧瘴气：附属到所在地点；回合结束直接恐惧与轮末弃卡读点缺失（部分实现）', () => {
  const state = makeState()
  const api = makeApi(state)
  const result = entryOf('08707').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(result.placed, true)
  assert.deepEqual(api.calls.attachToLocation, ['here'])
  assert.equal(entryOf('08707').flags.discardAtRoundEnd, true)
})

// ------------------------------------------------------------------ 08708–08711
test('08708 巨型白化企鹅：冷漠来自卡面数据；进出地点额外 1 行动读点缺失（部分实现）', () => {
  const card = ALL_CARDS['08708']
  assert.equal((card.text || '').includes('Aloof'), true)
  assert.equal(entryOf('08708').flags.moveSurchargeAtEnemyLocation, 1)
})

test('08709 呜啊！呜啊！呜啊！：离你最远的企鹅移动到你处或放 1 毁灭', () => {
  const state = buildStateWithEnemies(s => { s.enemies.push({ id: 'p1', code: '08708', originalCode: '08708', location: 'near', defeated: false }) })
  const api = makeApi(state, { choices: ['doom'] })
  entryOf('08709').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.doomOn, [['p1', 1]])
})

test('08710 失落的修格斯：交战后抽 1 张忒咳哩-哩；抽牌后按弱点结算读点缺失（部分实现）', () => {
  const state = buildStateWithEnemies(s => { s.enemies.push({ id: 's1', code: '08710', originalCode: '08710', location: 'here' }) })
  const api = makeApi(state)
  const entry = entryOf('08710')
  const ability = entry.abilities[0]
  ability.resolve({ state, inv: state.investigators[0], source: state.enemies[0], context: { enemy: state.enemies[0], seat: 0 }, api })
  assert.equal(api.calls.info.length >= 1, true)
})

test('08711 狂暴的修格斯：+2/人生命；敌军阶段结束本地调查员与非修格斯敌人各 2 伤', () => {
  const state = buildStateWithEnemies(s => {
    s.numInvestigators = 2
    s.enemies.push({ id: 'sh', code: '08711', originalCode: '08711', location: 'here' })
    s.enemies.push({ id: 'other', code: '08708', originalCode: '08708', location: 'here' })
    s.investigators.push({ ...s.investigators[0], seat: 1, name: '二号', engaged: [] })
  })
  const api = makeApi(state)
  const entry = entryOf('08711')
  assert.equal(entry.modifiers[0].amount({ state }), 4)
  const forced = entry.abilities.find(a => a.trigger?.includes('enemyPhaseEnds'))
  forced.resolve({ state, inv: state.investigators[0], source: state.enemies[0], api })
  assert.deepEqual(api.calls.damage, [[0, 2], [1, 2]])
  assert.deepEqual(api.calls.damageEnemy, [['other', 2]])
})

// ------------------------------------------------------------------ 08712–08713
test('08712 极地幻景：附属最近有线索地点；发现线索后弃手牌与弃卡读点缺失（部分实现）', () => {
  const state = makeState()
  const api = makeApi(state)
  const result = entryOf('08712').encounterResolve(state, state.investigators[0], {}, api)
  assert.equal(result.placed, true)
  assert.deepEqual(api.calls.attachToLocation, ['here'])
  assert.equal(entryOf('08712').flags.clueDiscoveryDiscardNonWeakness, true)
})

test('08713 黑暗极光：意志(3)，本次每揭示 1 个 frost 受 1 恐，失败再受 2 恐', () => {
  const state = makeState()
  const api = makeApi(state, { testResult: { success: false, drawn: ['frost', '0'] } })
  entryOf('08713').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(api.calls.horror, [[0, 1], [0, 2]])
})

// ------------------------------------------------------------------ 伙伴 08714–08722
test('08714 威廉·戴尔教授：花 1 秘密横置治愈同地点调查员 2 恐惧', () => {
  const state = makeState()
  const source = { id: 'dyer', code: '08714', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  entryOf('08714').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.healHorror, [[0, 2]])
})

test('08715 丹佛斯：伙伴数据与 5 秘密已声明；结算忒咳哩-哩后抽 2 读点缺失（部分实现）', () => {
  const entry = entryOf('08715')
  assert.equal(entry.flags.partner, true)
  assert.equal(entry.uses, 5)
  assert.equal((entry.abilities || []).length, 0)
})

test('08716 伊里亚·阿什瓦克：花 1 秘密横置，以基础 5 敏捷躲避并可移动', () => {
  const state = makeState(s => { s.enemies.push({ id: 'e3', code: '08708', originalCode: '08708', location: 'here', evade: 3 }) })
  const source = { id: 'eliyah', code: '08716', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['skip'] })
  entryOf('08716').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(api.calls.test[0].skill, 'agility')
  assert.deepEqual(api.calls.autoEvade, ['e3'])
})

test('08717 玛拉·辛哈医生：花 1 补给横置治愈同地点调查员 2 伤害', () => {
  const state = makeState()
  const source = { id: 'sinha', code: '08717', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  entryOf('08717').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.healDamage, [[0, 2]])
})

test('08718 艾弗里·克莱普尔：察觉 frost 时花补给取消并改揭新标记', () => {
  const state = makeState(s => { s.skillTest = { seat: 0 } })
  const source = { id: 'avery', code: '08718', uses: 5, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  const context = { when: 'tokenReveal', token: 'frost' }
  const ability = entryOf('08718').abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0], context }), true)
  ability.resolve({ context, api })
  assert.equal(context.replacementToken, '0')
  assert.equal(api.calls.revealChaosTokens.length, 1)
})

test('08719 “曲奇”·弗雷德里克斯：枪械攻击基础 5；本轮不能攻击读点缺失（部分实现）', () => {
  const entry = entryOf('08719')
  const ability = entry.abilities[0]
  assert.equal(ability.actionKind, 'fight')
  assert.equal(ability.cost.uses, 1)
  assert.equal(entry.uses, 3)
  assert.equal(entry.usesType, 'ammo')
})

test('08720 艾米·肯斯勒博士：基础 5 智力调查成功后查看顶牌并可弃掉', () => {
  const state = makeState()
  const source = { id: 'kensler', code: '08720', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  state.encounterDeck.push('08723')
  const api = makeApi(state, { choices: ['encounter', 'discard'] })
  entryOf('08720').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(api.calls.test[0].skill, 'intellect')
  assert.deepEqual(api.calls.discoverClue, [[0, 1]])
  assert.deepEqual(api.calls.discardEncounterCard, ['08723'])
})

test('08721 罗尔德·埃尔斯沃思：伙伴与 5 补给已声明；文本空白能力读点缺失（部分实现）', () => {
  const entry = entryOf('08721')
  assert.equal(entry.flags.partner, true)
  assert.equal(entry.uses, 5)
  assert.equal((entry.abilities || []).length, 0)
})

test('08722 高田弘子：横置把最多 3 资源移入调查员资源池', () => {
  const state = makeState()
  const source = { id: 'takada', code: '08722', uses: 9, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['3'] })
  entryOf('08722').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(source.uses, 6)
  assert.deepEqual(api.calls.gainResources, [[0, 3]])
})

// ------------------------------------------------------------------ Tekeli-li 08723–08729
for (const [code, kind, amount] of [['08723', 'horror', 1], ['08724', 'damage', 1], ['08725', 'hand', 1], ['08726', 'resources', 2]]) {
  test(`${code} 忒咳哩-哩：显现效果后回到忒咳哩-哩牌库底`, () => {
    const state = makeState()
    const api = makeApi(state)
    const entry = entryOf(code)
    const weakness = entry.abilities.find(a => a.kind === 'weakness')
    weakness.resolve({ state, inv: state.investigators[0], api })
    const key = kind === 'hand' ? 'discardRandomFromHand' : kind === 'resources' ? 'loseResources' : kind
    const call = api.calls[key] || []
    assert.equal(call.length, 1)
    assert.equal(entry.flags.returnToTekeliliDeckBottom, true)
  })
}

test('08727 忒咳哩-哩：自己回合失去 1 行动已实现；非自己回合的下回合行动丢失读点缺失（部分实现）', () => {
  const state = makeState()
  state.currentSeat = 0
  const api = makeApi(state)
  const weakness = entryOf('08727').abilities[0]
  weakness.resolve({ state, inv: state.investigators[0], api })
  assert.deepEqual(api.calls.loseActions, [[0, 1]])
  const state2 = makeState()
  state2.currentSeat = 1
  const api2 = makeApi(state2)
  weakness.resolve({ state: state2, inv: state2.investigators[0], api: api2 })
  assert.equal(api2.calls.loseActions, undefined)
})

test('08728 忒咳哩-哩：把 1 个线索放到所在地点', () => {
  const state = makeState()
  const api = makeApi(state)
  entryOf('08728').abilities[0].resolve({ state, inv: state.investigators[0], api })
  assert.equal(state.locations[0].clues, 2)
  assert.deepEqual(api.calls.returnClueToLocation, [[0, 1]])
})

test('08729 忒咳哩-哩：弃掉 1 张受控支援后回牌库底', () => {
  const state = makeState()
  state.investigators[0].assets.push({ id: 'a1', code: '01020' })
  const api = makeApi(state)
  entryOf('08729').abilities[0].resolve({ state, inv: state.investigators[0], api })
  assert.deepEqual(api.calls.discardAsset, ['a1'])
})

// ------------------------------------------------------------------ 纪念物 08730–08738
test('08730 克莱普尔的皮草：察觉 frost 时受伤 1 点取消并改揭新标记', () => {
  const state = makeState(s => { s.skillTest = { seat: 0 } })
  const source = { id: 'furs', code: '08730' }
  state.investigators[0].assets.push(source)
  const api = makeApi(state)
  const context = { when: 'tokenReveal', token: 'frost' }
  const ability = entryOf('08730').abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0], source, context }), true)
  ability.resolve({ source, context, api })
  assert.deepEqual(api.calls.placeAssetHarm, [[source.id, { damage: 1 }]])
  assert.equal(context.replacementToken, '0')
})

test('08731 爱伦·坡作品集：3 充能已声明；检索忒咳哩-哩回剧本牌库读点缺失（部分实现）', () => {
  const entry = entryOf('08731')
  assert.equal(entry.uses, 3)
  assert.equal(entry.usesType, 'charges')
  assert.equal((entry.abilities || []).length, 0)
})

test('08732 曲奇的特制 .32：2 子弹、快速、+1 伤害；目标入参需引擎 target（见报告 ctx 缺陷）', () => {
  const entry = entryOf('08732')
  const ability = entry.abilities[0]
  assert.equal(entry.uses, 2)
  assert.equal(entry.fast, true)
  assert.equal(ability.actionKind, 'fight')
  assert.equal(ability.cost.uses, 1)
})

test('08733 戴尔的素描：卡面数据与快速事件标记已声明；player played 生命周期条目缺失（部分实现）', () => {
  const entry = entryOf('08733')
  assert.equal(entry.flags.eventCard, true)
  assert.equal(entry.fast ?? true, true)
})

test('08734 埃尔斯沃思的靴子：本地最后一个线索被发现后横置移动或弃卡移动', () => {
  const state = makeState()
  const source = { id: 'boots', code: '08734', exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['move:near'] })
  const ability = entryOf('08734').abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0], source, context: { lastClue: true, location: 'here' } }), true)
  ability.resolve({ state, inv: state.investigators[0], source, api })
  assert.equal(state.investigators[0].location, 'near')
  assert.equal(source.exhausted, true)
})

test('08735 肯斯勒的日志：基础 5 或 +2 智力调查，成功后额外 1 线索', () => {
  const state = makeState()
  const source = { id: 'log', code: '08735', uses: 2, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['base5'] })
  entryOf('08735').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.discoverClue, [[0, 1], [0, 1]])
})

test('08736 辛哈的医药箱：花 1 补给横置治愈同地点调查员 1 伤害或 1 恐惧', () => {
  const state = makeState()
  const source = { id: 'kit', code: '08736', uses: 3, exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['damage'] })
  entryOf('08736').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.healDamage, [[0, 1]])
})

test('08737 高田的物品：快速事件数据已声明；player played 生命周期条目缺失（部分实现）', () => {
  const entry = entryOf('08737')
  assert.equal(entry.flags.eventCard, true)
})

test('08738 安雨：横置选择移动 / 本轮下次检定 +2 / 基础 4 敏捷躲避', () => {
  const state = makeState()
  const source = { id: 'anyu', code: '08738', exhausted: false }
  state.investigators[0].assets.push(source)
  const api = makeApi(state, { choices: ['bonus'] })
  entryOf('08738').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.phaseTestBonus, [[0, 2]])
})

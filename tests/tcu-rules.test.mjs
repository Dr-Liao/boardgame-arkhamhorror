// 万象无终（TCU）第 3 步 P4 验收：关键词与规则书。
//
// 路线图 §5 要求每条关键词同时具备：卡面来源、引擎行为、Node 验收、规则书条目与卡文直达；
// 规则书还要桌面 1440 / 移动 390 可读可跳转（浏览器部分在 tests/tcu-rules.browser.mjs）。
// 本文件是**唯一事实源的口径检查**：关键词来自 content/campaigns/theCircleUndone/keywords.js，
// 规则条目来自 web/rulebook-data.js，卡面来自 src/cards/cards-data.js，第 1 步扫描来自
// artifacts/migration/tcu/mechanism-scan.json——四者一旦脱节，这里先失败，审计工具再复算一次。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import {
  TCU_KEYWORDS, TCU_RULE_IDS, TCU_SCANNED_KEYWORD_MECHANISMS, tcuKeyword, tcuKeywordByRule,
} from '../content/campaigns/theCircleUndone/keywords.js'
import { CHAOS_BAGS, chapters, recordTypes } from '../content/campaigns/theCircleUndone/shared.js'
import { missingMechanics, supportedMechanics } from '../content/mechanics.js'
import { contentRegistry } from '../content/registered.js'
import { fixture } from './core-fixture.mjs'

import { hauntedAbilitiesAt, isLocationHaunted, normalizeHauntedAbility, normalizeScenarioHaunted } from '../src/engine/haunted.js'
import {
  buildScenarioLocationDeck, drawFromExtraEncounterDeck, extraEncounterDeckInfo, scenarioLocationDeckInfo,
  setExtraEncounterDeck, shuffleIntoExtraEncounterDeck,
} from '../src/engine/alt-decks.js'
import { isSpectralLocation, spectralFaceOf } from '../src/engine/locations.js'
import { normalizeTestSkills, testSkillLabel } from '../src/engine/tests.js'
import { MAJOR_ARCANA, buildTarotDeck, drawTarot, tarotRemaining } from '../src/engine/tarot.js'
import { isTarotCard, tarotSlotCapacity, tarotSlotUsage } from '../src/engine/tarot-slot.js'
import { entityParleyDescriptors, isParleyAbility, isParleyCard, isParleyDescriptor } from '../src/engine/parley.js'
import { bondedCardList, findBondedMain } from '../src/engine/bonded.js'
import {
  MEMENTOS, crossOffMemento, isBeingHunted, markHunted, markTakenByWatcher, mementoCount,
  mementosDiscovered, recordMemento, takenByWatcher,
} from '../src/campaign/mementos.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { isStoryInvestigator, normalizeStoryInvestigatorConfig, prepareStoryInvestigator } from '../src/engine/story-investigators.js'
import { addBreach, breachTotal, locationFlagOf, locationSkullValue, setLocationFlag } from '../src/engine/location-state.js'
import { currentFaceCode, enemyCannotBeDefeated, enemyFacesOf, faceOf } from '../src/engine/enemy-faces.js'

const scan = JSON.parse(readFileSync(new URL('../artifacts/migration/tcu/mechanism-scan.json', import.meta.url), 'utf8'))
const scannedKeywordIds = scan.mechanisms.filter(mechanism => mechanism.keyword).map(mechanism => mechanism.id).sort()
const TCU_CARDS = Object.entries(ALL_CARDS).filter(([code]) => /^05\d{3}[a-z]?$/.test(code))
const SHARED_RULE_IDS = ['parley', 'script']
const cardTextOf = card => [card?.text, card?.textZh, (card?.traits || []).join(' '), card?.slot].filter(Boolean).join('\n')

test('P4 关键词清单：16 行覆盖第 1 步扫描里的全部关键词机制', () => {
  assert.equal(TCU_KEYWORDS.length, 16)
  assert.equal(new Set(TCU_KEYWORDS.map(keyword => keyword.id)).size, 16, '关键词 id 不能重复')
  assert.equal(new Set(TCU_KEYWORDS.map(keyword => keyword.ruleId)).size, 16, '规则条目 id 不能重复')
  for (const keyword of TCU_KEYWORDS) {
    assert.ok(keyword.zh, `${keyword.id} 缺少中文名`)
    assert.ok(['printed', 'trait', 'mechanism', 'rule'].includes(keyword.kind), `${keyword.id} 的 kind 非法`)
    assert.ok(['text', 'card-kind', 'engine'].includes(keyword.sourceKind), `${keyword.id} 的 sourceKind 非法`)
    assert.ok(Array.isArray(keyword.engine) && keyword.engine.length > 0, `${keyword.id} 缺少引擎证据`)
    if (keyword.kind === 'printed' || keyword.kind === 'trait') assert.ok(keyword.printed, `${keyword.id} 缺印刷词`)
    if (keyword.sourceKind === 'text') assert.ok(keyword.pattern, `${keyword.id} 缺判据 pattern`)
    if (keyword.sourceKind === 'engine') assert.equal(keyword.cardCodes.length, 0, `${keyword.id} 不应列卡号`)
  }
  // 与第 1 步的机制扫描逐条对齐：集合相同、mechanismId 与 ruleId 都能对上。
  assert.deepEqual([...TCU_SCANNED_KEYWORD_MECHANISMS].sort(), scannedKeywordIds)
  assert.deepEqual(TCU_KEYWORDS.map(keyword => keyword.mechanismId).sort(), scannedKeywordIds)
  for (const keyword of TCU_KEYWORDS) {
    const mechanism = scan.mechanisms.find(item => item.id === keyword.mechanismId)
    assert.equal(mechanism.keyword.ruleId, keyword.ruleId, `${keyword.id} 的 ruleId 与机制扫描不一致`)
  }
  // 6 张印刷词 + 1 个特性 + 8 个机制 id + 1 条纯规则条目。
  assert.equal(TCU_KEYWORDS.filter(keyword => keyword.kind === 'printed').length, 6)
  assert.equal(TCU_KEYWORDS.filter(keyword => keyword.kind === 'trait').length, 1)
  assert.equal(TCU_KEYWORDS.filter(keyword => keyword.kind === 'mechanism').length, 8)
  assert.equal(TCU_KEYWORDS.filter(keyword => keyword.kind === 'rule').length, 1)
  assert.ok(tcuKeyword('haunted') && tcuKeywordByRule('tcuHaunted') === tcuKeyword('haunted'))
})

test('P4 每个关键词都有卡面来源、引擎行为、规则书条目与卡文直达', async () => {
  for (const keyword of TCU_KEYWORDS) {
    // 1) 卡面来源：列出的卡号存在，并且确实印刷/承载了该机制。
    assert.ok(keyword.cardCodes.length > 0 || keyword.sourceKind === 'engine', `${keyword.id} 缺卡面来源`)
    const pattern = keyword.pattern ? new RegExp(keyword.pattern, 'i') : null
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      assert.ok(card, `${keyword.id} 的卡号 ${code} 不存在`)
      if (keyword.sourceKind === 'text') assert.match(cardTextOf(card), pattern, `${keyword.id} 在 ${code} 上没有印刷`)
      if (keyword.sourceKind === 'card-kind') assert.ok(keyword.cardTypes.includes(card.type), `${keyword.id} 的 ${code} 类型是 ${card.type}`)
    }
    // 2) 引擎行为：声明的模块真的导出这些函数 / 数据表。
    for (const entry of keyword.engine) {
      const module = await import(`../${entry.module}`)
      for (const name of entry.names || []) assert.equal(typeof module[name], 'function', `${keyword.id} 缺少引擎导出 ${entry.module}#${name}`)
      for (const value of entry.values || []) {
        assert.ok(value.name in module, `${keyword.id} 缺少数据导出 ${entry.module}#${value.name}`)
        if (typeof value.length === 'number') assert.equal(module[value.name].length, value.length, `${keyword.id} 的 ${value.name} 长度不符`)
        if (value.keys) assert.deepEqual(Object.keys(module[value.name]).sort(), [...value.keys].sort(), `${keyword.id} 的 ${value.name} 键不符`)
      }
    }
    // 3) 规则书条目：存在、分组正确、正文非空、搜得到中文名、进了拼音索引。
    const rule = ruleById(keyword.ruleId)
    assert.equal(rule.id, keyword.ruleId, `${keyword.id} 的规则条目不存在`)
    if (keyword.ruleOwned) assert.equal(rule.group, '万象无终', `${keyword.id} 的规则条目分组不对`)
    assert.ok(rule.body.join('').length > 80, `${keyword.id} 的规则条目过短`)
    // 中文名必须原样出现在标题/别名/正文里：搜索框与审计用的是同一条判据。
    assert.ok(`${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.includes(keyword.zh),
      `${keyword.id} 的规则条目搜不到「${keyword.zh}」`)
    assert.ok(rule.aliases.includes(keyword.zh), `${keyword.id} 的中文名必须是别名，搜索框才搜得到`)
    assert.ok(RULE_INDEX.some(entry => entry.id === keyword.ruleId), `${keyword.id} 不在拼音索引里`)
    // 4) 卡文直达：每张来源卡都能跳到该条目。
    for (const code of keyword.cardCodes) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId), `${code} 的规则链接缺少 ${keyword.ruleId}`)
    }
  }
})

test('P4 卡文直达与关键词判据逐张一致（377 条印刷记录）', () => {
  assert.equal(TCU_CARDS.length, 377)
  const unlinked = []
  const foreign = []
  for (const [code, card] of TCU_CARDS) {
    const ids = cardRuleIds(card)
    if (!ids.length) unlinked.push(code)
    for (const id of ids) {
      if (!TCU_RULE_IDS.includes(id) && !SHARED_RULE_IDS.includes(id)) foreign.push(`${code}:${id}`)
    }
  }
  assert.deepEqual(unlinked, [], '每张 05 卡都要至少连到战役条目')
  assert.deepEqual(foreign, [], '05 卡不得连到其他循环的条目')
  // 判据方向：卡面命中哪个关键词判据，就必须连到该条目（比只查代表卡更严）。
  for (const keyword of TCU_KEYWORDS) {
    if (keyword.sourceKind !== 'text') continue
    const pattern = new RegExp(keyword.pattern, 'i')
    for (const [code, card] of TCU_CARDS) {
      if (!pattern.test(cardTextOf(card))) continue
      assert.ok(cardRuleIds(card).includes(keyword.ruleId), `${code} 的卡面命中 ${keyword.id} 但没有连到 ${keyword.ruleId}`)
    }
  }
  // 幕/议程额外连到通用条目；其余 05 卡不得出现无关链接。
  assert.ok(cardRuleIds(ALL_CARDS['05284']).includes('tcuChaos'))
  assert.ok(cardRuleIds(ALL_CARDS['05178a']).includes('tcuHeretics'))
  assert.ok(cardRuleIds(ALL_CARDS['05178a']).includes('parley'))
  assert.ok(cardRuleIds(ALL_CARDS['05023']).includes('tcuTarotSlot'))
})

test('P4 规则书 16 条：分组、拼音索引与相关跳转', () => {
  const tcuRules = RULES.filter(rule => rule.group === '万象无终')
  assert.equal(tcuRules.length, 16)
  assert.deepEqual(tcuRules.map(rule => rule.id).sort(), [...TCU_RULE_IDS].sort())
  assert.equal(new Set(RULES.map(rule => rule.id)).size, RULES.length, '规则 id 必须全局唯一')
  const ids = new Set(RULES.map(rule => rule.id))
  for (const rule of tcuRules) {
    for (const related of rule.related) assert.ok(ids.has(related), `${rule.id} 的相关规则 ${related} 不存在`)
    assert.ok(rule.title && rule.body.length >= 3, `${rule.id} 至少要三段正文`)
    assert.equal(/<[^>]+>/.test(rule.body.join('')), false, `${rule.id} 正文含 HTML`)
    const indexed = RULE_INDEX.find(entry => entry.id === rule.id)
    assert.ok(indexed, `${rule.id} 不在拼音索引里`)
    assert.match(indexed.sortKey, /^[a-z]+$/, `${rule.id} 的拼音键非法`)
    assert.equal(indexed.initial, indexed.sortKey[0].toUpperCase())
  }
})

test('P4 规则描述与当前实现边界一致（不得把未实现写成可用）', () => {
  const body = id => ruleById(id).body.join('')
  const campaign = body('tcuCampaign')
  // 战役总览：九章中文名、仅图鉴状态、审计账本位置、袋数与记录键现状。
  for (const chapter of chapters) assert.ok(campaign.includes(chapter.name), `战役条目缺少章节「${chapter.name}」`)
  assert.match(campaign, /catalog-only/)
  assert.match(campaign, /仅图鉴/)
  assert.match(campaign, /audit\/tcu-migration\.json/)
  assert.match(campaign, /13 枚/)
  assert.match(campaign, /377/)
  // 逐章混乱符号尚未实现，必须显式写出来。
  assert.match(body('tcuChaos'), /尚未实现/)
  assert.match(body('tcuChaos'), /tcu-chaos\.js/)
  // 关键实现细节必须写对，避免规则书与代码各说一套。
  assert.match(body('tcuHaunted'), /调查检定/)
  assert.match(body('tcuHaunted'), /hauntedAbilitiesAt/)
  assert.match(body('tcuSpectral'), /第二遭遇牌堆/)
  assert.match(body('tcuSpectral'), /isSpectral/)
  assert.match(body('tcuCircle'), /相加/)
  assert.match(body('tcuTarot'), /剧本级/)
  assert.match(body('tcuTarotSlot'), /add:slot/)
  assert.match(body('tcuTarotSlot'), /slot:tarot/)
  assert.match(body('tcuBonded'), /场外/)
  assert.match(body('tcuMemento'), /10 条/)
  assert.match(body('tcuWatcher'), /youAreBeingHunted/)
  assert.match(body('tcuPrologue'), /05046/)
  assert.match(body('tcuPrologue'), /无牌组/)
  assert.match(body('tcuBreaches'), /上限 3/)
  assert.match(body('tcuHeretics'), /放逐/)
  assert.match(body('tcuCosmos'), /宇宙牌库|地点牌库/)
  assert.match(body('tcuBraziers'), /brazier/)
  assert.match(body('tcuCampaignAssets'), /不占 30 张/)
  // 不得出现「已发布 / 规则等价」这类越界说法，也不得写 Markdown（规则书按纯文本渲染）。
  for (const rule of RULES.filter(candidate => candidate.group === '万象无终')) {
    const text = rule.body.join('')
    assert.equal(/M5 已完成|规则等价|完全还原|已发布的完整战役/.test(text), false, rule.id)
    assert.equal(/\*\*|__/.test(text), false, `${rule.id} 正文含 Markdown 强调符`)
  }
})

test('P4 搜索能定位关键词条目（中文名与印刷词双向可搜）', () => {
  for (const keyword of TCU_KEYWORDS) {
    assert.ok(matchingRules(keyword.zh).some(rule => rule.id === keyword.ruleId), `${keyword.id} 的中文名搜不到条目`)
    if (keyword.printed) assert.ok(matchingRules(keyword.printed).some(rule => rule.id === keyword.ruleId), `${keyword.id} 的印刷词搜不到条目`)
  }
  assert.ok(matchingRules('闹鬼 - 受到 1 点恐惧').some(rule => rule.id === 'tcuHaunted'))
  assert.ok(matchingRules('结算闹鬼能力').some(rule => rule.id === 'tcuHaunted'))
  assert.ok(matchingRules('在一个阵法行动期间').some(rule => rule.id === 'tcuCircle'))
  assert.ok(matchingRules('查找你的绑定卡牌').some(rule => rule.id === 'tcuBonded'))
  assert.ok(matchingRules('你所在地点的裂口和毁灭').some(rule => rule.id === 'tcuBreaches'))
  assert.ok(matchingRules('抽取“宇宙”顶上的 X 张卡牌').some(rule => rule.id === 'tcuCosmos'))
  assert.ok(matchingRules('熄灭你所在地点的火盆').some(rule => rule.id === 'tcuBraziers'))
  assert.ok(matchingRules('驱除尽可能多的异端者').some(rule => rule.id === 'tcuHeretics'))
  assert.ok(matchingRules('幽灵看守人被击败').some(rule => rule.id === 'tcuWatcher'))
  assert.ok(matchingRules('你拥有额外 2 个塔罗牌槽位').some(rule => rule.id === 'tcuTarotSlot'))
  assert.ok(matchingRules('遗留记忆').some(rule => rule.id === 'tcuMemento'))
  assert.ok(matchingRules('剧本提示卡').some(rule => rule.id === 'tcuChaos'))
})

test('P4 闹鬼 / 幽灵界 / 阵法：注册期校验与失败路径', () => {
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  // 闹鬼：没有能力时是空操作；非法形状在加载期就抛错。
  assert.deepEqual(hauntedAbilitiesAt(state, inv.location), [])
  assert.equal(isLocationHaunted(state, inv.location), false)
  assert.equal(normalizeHauntedAbility({ text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] }).text, '闹鬼 - 受到 1 点恐惧。')
  assert.throws(() => normalizeHauntedAbility({ effect: [] }), /缺少卡面文本/)
  assert.throws(() => normalizeHauntedAbility({ text: '闹鬼 - x', effect: [{ kind: 'nope' }] }), /未知子句/)
  assert.throws(() => normalizeScenarioHaunted({ a: { haunted: 'nope' } }), /闹鬼/)
  // 幽灵界：第二牌堆建堆/抽取/洗回；两堆都空时返回 null。
  const deckState = fixture('01001', 1)
  setExtraEncounterDeck(deckState, 'spectral', ['01004', '01005'], { shuffle: list => [...list] })
  assert.equal(extraEncounterDeckInfo(deckState, 'spectral').deck, 2)
  assert.equal(drawFromExtraEncounterDeck(deckState, 'spectral'), '01005')
  shuffleIntoExtraEncounterDeck(deckState, 'spectral', ['01005'], { shuffle: list => [...list] })
  assert.equal(extraEncounterDeckInfo(deckState, 'spectral').deck, 2)
  assert.throws(() => drawFromExtraEncounterDeck(deckState, 'no-such-deck'), /未知的额外遭遇牌堆/)
  // 阵法：2–4 项技能求和；单技能行为不变。
  assert.deepEqual(normalizeTestSkills(['willpower', 'intellect']), ['willpower', 'intellect'])
  assert.equal(testSkillLabel(['willpower', 'intellect', 'combat', 'agility']), '意志+智识+战斗+敏捷')
  assert.deepEqual(normalizeTestSkills('agility'), ['agility'])
})

test('P4 塔罗牌组 / 塔罗槽位 / 绑定：牌组、槽位与场外集合', () => {
  // 塔罗牌组：22 张唯一、正逆位、抽到见底不自动洗回。
  assert.equal(MAJOR_ARCANA.length, 22)
  const tarotState = fixture('01001', 1)
  buildTarotDeck(tarotState, { shuffle: list => [...list] })
  assert.equal(tarotRemaining(tarotState).length, 22)
  const drawn = drawTarot(tarotState, { count: 2, orientation: 'upright' })
  assert.equal(drawn.length, 2)
  assert.equal(tarotRemaining(tarotState).length, 20)
  assert.equal(drawn[0].orientation, 'upright')
  const restored = JSON.parse(JSON.stringify(tarotState))
  assert.deepEqual(restored.scenarioDecks.tarot.deck, tarotState.scenarioDecks.tarot.deck, '塔罗牌序必须随存档往返')
  // 塔罗槽位：默认 1 个槽；塔罗卡按 slot/trait 识别。
  const slotInv = { seat: 0, assets: [], hand: [], deck: [], threat: [] }
  assert.equal(tarotSlotCapacity(slotInv), 1)
  assert.equal(tarotSlotUsage(slotInv), 0)
  assert.equal(isTarotCard({ code: '05023', slot: 'Tarot', traits: ['Tarot'] }), true)
  assert.equal(isTarotCard({ code: '01001', slot: 'Hand', traits: [] }), false)
  // 绑定：卡面数据解析出 1 主卡 + 3 副本，双向可查。
  assert.deepEqual(bondedCardList(ALL_CARDS['05313']), [{ code: '05314', count: 3 }])
  assert.deepEqual(bondedCardList(ALL_CARDS['05316']), [{ code: '05317', count: 3 }])
  assert.equal(findBondedMain(ALL_CARDS, '05314'), '05313')
  assert.equal(findBondedMain(ALL_CARDS, '05317'), '05316')
})

test('P4 谈判 / 遗留记忆 / 看守人 / 序章调查员：读点与记录往返', () => {
  // 谈判：卡面文本与实体能力两个读点都给同一判断（完整执行路径在 P2.7 原语测试里）。
  assert.equal(isParleyCard(ALL_CARDS['05020']), true)
  assert.equal(isParleyCard(ALL_CARDS['05112']), false)
  assert.equal(isParleyDescriptor({ kind: 'action', actionKind: 'parley', label: '谈判' }), true)
  assert.equal(isParleyDescriptor({ kind: 'action', countsAs: 'parley' }), true)
  assert.equal(isParleyDescriptor({ kind: 'action', label: '攻击' }), false)
  assert.equal(isParleyAbility({ descriptor: { actionKind: 'parley' } }), true)
  assert.deepEqual(entityParleyDescriptors({ code: '01001' }), [])
  // Memento：10 个稳定 id、发现去重、划掉、未知 id 失败。
  assert.equal(MEMENTOS.length, 10)
  const state = fixture('01001', 1)
  recordMemento(state, 'mesmerizingFlute')
  recordMemento(state, 'mesmerizingFlute')
  assert.equal(mementoCount(state), 1)
  crossOffMemento(state, 'mesmerizingFlute')
  assert.deepEqual(mementosDiscovered(state), [])
  assert.throws(() => recordMemento(state, 'unknownRelic'), /未知的遗留记忆/)
  // 看守人：两个 string[] 记录随存档往返。
  markHunted(state, 0)
  markTakenByWatcher(state, '05046')
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(isBeingHunted(restored, 0), true)
  assert.deepEqual(takenByWatcher(restored), ['05046'])
  // 序章调查员：4 位、无牌组准备、非法配置在注册期失败。
  const config = normalizeStoryInvestigatorConfig({ codes: ['05046', '05047', '05048', '05049'], crossOutUnused: true })
  assert.equal(config.codes.length, 4)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: [] }), /codes/)
  assert.throws(() => normalizeStoryInvestigatorConfig({ codes: ['05046', '05046'] }), /重复/)
  const storyState = { storyInvestigators: { chosen: [{ seat: 0, code: '05046' }], crossedOut: ['05049'], config } }
  const storyInvestigator = { seat: 0, code: '05046', deck: ['01001'], hand: ['01002'], discard: ['01003'], threat: [], assets: [], beneath: ['01004'] }
  prepareStoryInvestigator(storyInvestigator, { setupCards: ['05258'] })
  assert.equal(isStoryInvestigator(storyState, storyInvestigator), true)
  assert.equal(isStoryInvestigator(storyState, { seat: 1, code: '05046' }), false)
  assert.equal(storyInvestigator.noDeck, true)
  assert.deepEqual(storyInvestigator.deck, [])
  assert.deepEqual(storyInvestigator.hand, [])
})

test('P4 裂口 / 火盆 / 宇宙牌库 / 异端者 / 战役资产：计数、状态、牌库与面表', () => {
  // 裂口与火盆写在地点实例上。
  const state = fixture('01001', 1)
  const location = state.locations.find(item => item.id === state.investigators[0].location)
  assert.equal(addBreach(state, location.id), 1)
  assert.equal(addBreach(state, location.id, 9), 3, '裂口上限 3')
  assert.equal(breachTotal(state), 3)
  assert.equal(locationSkullValue(state, location.id) >= 3, true)
  assert.equal(locationFlagOf(state.locations.find(item => item.id === location.id), 'brazier'), false)
  setLocationFlag(state, location.id, 'brazier', true)
  assert.equal(locationFlagOf(state.locations.find(item => item.id === location.id), 'brazier'), true)
  assert.throws(() => setLocationFlag(state, location.id, 'lit', true), /未知地点标记/)
  // 宇宙牌库：建堆、抽 X 选 1 的面朝下地点牌库，顺序不外泄。
  const cosmosState = fixture('01001', 1)
  buildScenarioLocationDeck(cosmosState, 'cosmos', ['blackThrone', 'hideousPalace'], { shuffle: list => [...list] })
  assert.equal(scenarioLocationDeckInfo(cosmosState, 'cosmos').deck, 2)
  assert.throws(() => buildScenarioLocationDeck(cosmosState, 'no-such-deck', ['a']), /未知/)
  // 异端者：两面可解析，不能击败由卡面字段表达。
  const heretic = { code: '05178a', side: 'enemy', faces: [{ code: '05178a', side: 'enemy' }, { code: '05178b', side: 'unfinishedBusiness' }], cannotBeDefeated: true }
  assert.equal(enemyFacesOf(heretic).length, 2)
  assert.equal(faceOf(heretic), 'enemy')
  assert.equal(currentFaceCode(heretic), '05178a')
  assert.equal(enemyCannotBeDefeated(heretic), true)
  assert.equal(enemyCannotBeDefeated({}), false)
  // 战役资产：机关盒加入战役牌组（不占 30 张、排序后带入下一章）。
  const assetState = fixture('01001', 1)
  const deck = assetState.campaign.investigators[0].deck
  const before = deck.length
  applyCampaignEffect(assetState, { type: 'addCampaignCardToDeck', code: '05228', seat: 0 })
  assert.equal(deck.length, before + 1)
  assert.ok(deck.includes('05228'))
  assert.throws(() => applyCampaignEffect(assetState, { type: 'addCampaignCardToDeck', code: '99999', seat: 0 }), /无效/)
})

test('P4 混乱袋：四档各 13 枚、骷髅×2，且与战役清单一致', () => {
  const difficulties = Object.keys(CHAOS_BAGS).sort()
  assert.deepEqual(difficulties, ['easy', 'expert', 'hard', 'standard'])
  for (const difficulty of difficulties) {
    const bag = CHAOS_BAGS[difficulty]
    assert.equal(bag.length, 13, `${difficulty} 袋应为 13 枚`)
    assert.equal(bag.filter(token => token === 'skull').length, 2, `${difficulty} 应有 2 个骷髅`)
    assert.ok(bag.includes('autofail') && bag.includes('eldersign'), `${difficulty} 缺自动失败/旧印`)
    for (const symbol of ['cultist', 'tablet', 'elder_thing'])
      assert.equal(bag.includes(symbol), false, `${difficulty} 基础袋不应预置 ${symbol}`)
  }
  const campaign = contentRegistry.getCampaign('theCircleUndone')
  assert.deepEqual(campaign.chaosBags, CHAOS_BAGS)
  for (const type of Object.values(recordTypes)) assert.ok(['boolean', 'number', 'string', 'string[]'].includes(type))
})

test('P4 九章剧本参考卡与混乱符号直达', () => {
  assert.equal(chapters.length, 9)
  for (const chapter of chapters) {
    const card = ALL_CARDS[chapter.code]
    assert.ok(card, `章节 ${chapter.id} 的参考卡 ${chapter.code} 不存在`)
    assert.equal(card.type, 'scenario', `${chapter.code} 不是剧本卡`)
    assert.equal(UI_CARDS.scenarioCards[chapter.id], chapter.code, `章节 ${chapter.id} 缺提示卡映射`)
    const ids = cardRuleIds(card)
    assert.ok(ids.includes('tcuCampaign'), `${chapter.code} 没有连到战役条目`)
    assert.ok(ids.includes('tcuChaos'), `${chapter.code} 没有连到混乱符号条目`)
  }
  // 提示卡映射里不得混入未知章节 id。
  const chapterIds = new Set(chapters.map(chapter => chapter.id))
  const tcuMapped = Object.keys(UI_CARDS.scenarioCards).filter(id => /^(theWitchingHour|atDeathsDoorstep|theSecretName|theWagesOfSin|forTheGreaterGood|unionAndDisillusion|inTheClutchesOfChaos|beforeTheBlackThrone|disappearanceAtTheTwilightEstate)$/.test(id))
  assert.deepEqual(tcuMapped.sort(), [...chapterIds].sort())
})

test('P4 机制登记与关键词表一致（tcuChaos 留给 P8）', () => {
  const tcuMechanics = [...supportedMechanics].filter(id => id.startsWith('tcu')).sort()
  const expected = TCU_KEYWORDS.filter(keyword => keyword.ruleOwned && keyword.implemented !== false).map(keyword => keyword.ruleId).sort()
  assert.deepEqual(tcuMechanics, expected)
  assert.deepEqual(missingMechanics(expected), [])
  // 逐章混乱符号表还没实现：不得提前登记，否则章节声明它会缺少真实能力。
  assert.deepEqual(missingMechanics(['tcuChaos']), ['tcuChaos'])
  for (const keyword of TCU_KEYWORDS.filter(item => item.ruleOwned)) {
    assert.equal(keyword.implemented !== false, supportedMechanics.has(keyword.ruleId), `${keyword.id} 的实现状态与登记不一致`)
  }
})

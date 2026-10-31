// 食梦者（TDE）第 3 步 P4 验收：关键词与规则书。
//
// 路线图 §6 要求每条关键词同时具备：卡面来源、引擎行为、Node 验收、规则书条目与卡文直达；
// 规则书还要桌面 1440 / 移动 390 可读可跳转（浏览器部分在 tests/tde-rules.browser.mjs）。
// 本文件是**单一事实源的口径检查**：关键词来自 content/campaigns/theDreamEaters/keywords.js，
// 规则条目来自 web/rulebook-data.js，卡面来自 src/cards/cards-data.js，第 1 步扫描来自
// artifacts/migration/tde/mechanism-scan.json——四者一旦脱节，这里先失败，审计工具再复算一次。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import {
  TDE_CHAOS_BAGS, TDE_CHAOS_FACTS, TDE_KEYWORDS, TDE_RULE_IDS, TDE_SCANNED_KEYWORD_MECHANISMS,
  tdeKeyword, tdeKeywordByRule,
} from '../content/campaigns/theDreamEaters/keywords.js'
import { PARTS, chapters } from '../content/campaigns/theDreamEaters/shared.js'
import { missingMechanics, supportedMechanics } from '../content/mechanics.js'
import { createGameState } from '../src/engine/engine.js'
import { replacementOptions } from '../src/campaign/campaign.js'
import { settle } from './core-fixture.mjs'

import { MYRIAD_LIMIT, isMyriad, myriadUsage, validateMyriadLimit } from '../src/engine/myriad.js'
import { swarmingCount, swarmingCountForText, swarmingSpec } from '../src/engine/swarming.js'
import { placeSwarmCards, splitSwarmingDamage, swarmBlockedReason, swarmCanBeDefeated, swarmCardsOf, swarmCountOf } from '../src/engine/swarm.js'
import { canFlipVeiledLocation, flipVeiledLocation, isVeiledLocation, shuffleVeiledIntoDeck, veiledFlipBlockedReason } from '../src/engine/veiled.js'
import { bondedCardList, findBondedMain } from '../src/engine/bonded.js'
import { bondedPartnerOf, placeBondedLocation } from '../src/engine/bonded-location.js'
import { counterAtLeast, counterOf, highestCounter, addCounter } from '../src/engine/counters.js'
import { createTokenBag, markInfested, infestedCount, revealTokenFromBag, tokenBagInfo } from '../src/engine/token-bag.js'
import { addLocationDoom, highestLocationDoom, locationDoomOf, removeLocationDoom, totalLocationDoom } from '../src/engine/location-doom.js'
import { addMarker, referenceMarkerCount, resetMarkerCount } from '../src/engine/marker-count.js'
import { epilogueFor, flattenEpilogueMatrix, normalizeEpilogueMatrix } from '../src/campaign/epilogue-matrix.js'

const scan = JSON.parse(readFileSync(new URL('../artifacts/migration/tde/mechanism-scan.json', import.meta.url), 'utf8'))
const scannedKeywordIds = scan.mechanisms.filter(mechanism => mechanism.keyword).map(mechanism => mechanism.id).sort()
const TDE_CARDS = Object.entries(ALL_CARDS).filter(([code]) => /^06\d{3}[a-z]?$/.test(code))
const cardTextOf = card => [card?.text, card?.textZh, (card?.traits || []).join(' '), card?.slot].filter(Boolean).join('\n')
const ruleIds = new Set(RULES.map(rule => rule.id))
const bodyOf = id => ruleById(id).body.join('')
const tdeRules = RULES.filter(rule => rule.group === '食梦者')

test('P4 关键词清单：7 行覆盖第 1 步扫描里的全部关键词机制', () => {
  assert.equal(TDE_KEYWORDS.length, 7)
  assert.equal(new Set(TDE_KEYWORDS.map(keyword => keyword.id)).size, 7, '关键词 id 不能重复')
  assert.equal(new Set(TDE_KEYWORDS.map(keyword => keyword.ruleId)).size, 7, '规则条目 id 不能重复')
  for (const keyword of TDE_KEYWORDS) {
    assert.ok(keyword.zh, `${keyword.id} 缺少中文名`)
    assert.ok(['printed', 'trait', 'mechanism', 'rule'].includes(keyword.kind), `${keyword.id} 的 kind 非法`)
    assert.ok(['text', 'card-kind', 'engine'].includes(keyword.sourceKind), `${keyword.id} 的 sourceKind 非法`)
    assert.ok(Array.isArray(keyword.engine) && keyword.engine.length > 0, `${keyword.id} 缺少引擎证据`)
    assert.ok(Array.isArray(keyword.deferred), `${keyword.id} 缺少 deferred 清单（未接线部分必须显式登记）`)
    if (keyword.sourceKind === 'text') assert.ok(keyword.pattern, `${keyword.id} 缺判据 pattern`)
  }
  // 与第 1 步的机制扫描逐条对齐：集合相同、mechanismId 与 ruleId 都能对上。
  assert.deepEqual([...TDE_SCANNED_KEYWORD_MECHANISMS].sort(), scannedKeywordIds)
  assert.deepEqual(TDE_KEYWORDS.map(keyword => keyword.mechanismId).sort(), scannedKeywordIds)
  for (const keyword of TDE_KEYWORDS) {
    const mechanism = scan.mechanisms.find(item => item.id === keyword.mechanismId)
    assert.equal(mechanism.keyword.ruleId, keyword.ruleId, `${keyword.id} 的 ruleId 与机制扫描不一致`)
  }
  // 新增 4 条 + 待确认 3 条；Alert / Hidden 复用核心规则条目（ruleOwned=false）。
  assert.deepEqual(TDE_KEYWORDS.filter(keyword => keyword.ruleOwned).map(keyword => keyword.id).sort(),
    ['bonded', 'myriad', 'researched', 'swarming', 'veiled'])
  assert.deepEqual(TDE_KEYWORDS.filter(keyword => !keyword.ruleOwned).map(keyword => keyword.id).sort(), ['alert', 'hidden'])
  assert.equal(TDE_KEYWORDS.filter(keyword => keyword.kind === 'printed').length, 7)
  assert.ok(tdeKeyword('veiled') && tdeKeywordByRule('tdeVeiled') === tdeKeyword('veiled'))
})

test('P4 每个关键词都有卡面来源、引擎行为、规则书条目与卡文直达', async () => {
  for (const keyword of TDE_KEYWORDS) {
    // 1) 卡面来源：列出的卡号存在，并且确实印刷/承载了该关键词。
    assert.ok(keyword.cardCodes.length > 0, `${keyword.id} 缺卡面来源`)
    const pattern = new RegExp(keyword.pattern, 'i')
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      assert.ok(card, `${keyword.id} 的卡号 ${code} 不存在`)
      assert.match(cardTextOf(card), pattern, `${keyword.id} 在 ${code} 上没有印刷`)
    }
    // 2) 引擎行为：声明的模块真的导出这些函数 / 数据表。
    for (const entry of keyword.engine) {
      const module = await import(`../${entry.module}`)
      for (const name of entry.names || []) assert.equal(typeof module[name], 'function', `${keyword.id} 缺少引擎导出 ${entry.module}#${name}`)
      for (const value of entry.values || []) {
        assert.ok(value.name in module, `${keyword.id} 缺少数据导出 ${entry.module}#${value.name}`)
        if (typeof value.length === 'number') assert.equal(module[value.name].length, value.length, `${keyword.id} 的 ${value.name} 长度不符`)
      }
    }
    // 3) 规则书条目：存在、分组正确、正文非空、搜得到中文名、进了拼音索引。
    const rule = ruleById(keyword.ruleId)
    assert.equal(rule.id, keyword.ruleId, `${keyword.id} 的规则条目不存在`)
    if (keyword.ruleOwned) assert.equal(rule.group, '食梦者', `${keyword.id} 的规则条目分组不对`)
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

test('P4 卡文直达与关键词判据逐张一致（388 条印刷记录）', () => {
  assert.equal(TDE_CARDS.length, 388)
  const unlinked = []
  const foreign = []
  for (const [code, card] of TDE_CARDS) {
    const ids = cardRuleIds(card)
    if (!ids.length) unlinked.push(code)
    for (const id of ids) {
      if (!TDE_RULE_IDS.includes(id) && !['alert', 'hidden', 'script', 'victory', 'chaos', 'parley'].includes(id)) foreign.push(`${code}:${id}`)
    }
  }
  assert.deepEqual(unlinked, [], '每张 06 卡都要至少连到战役条目')
  assert.deepEqual(foreign, [], '06 卡不得连到其他循环的条目')
  // 判据方向：卡面命中哪个关键词判据，就必须连到该条目（比只查代表卡更严）。
  for (const keyword of TDE_KEYWORDS) {
    const pattern = new RegExp(keyword.pattern, 'i')
    for (const [code, card] of TDE_CARDS) {
      if (!pattern.test(cardTextOf(card))) continue
      assert.ok(cardRuleIds(card).includes(keyword.ruleId), `${code} 的卡面命中 ${keyword.id} 但没有连到 ${keyword.ruleId}`)
    }
  }
  // 幕/议程额外连到通用条目；章节参考卡连到所属线与混乱符号。
  assert.ok(cardRuleIds(ALL_CARDS['06039']).includes('tdeDreamQuest'))
  assert.ok(cardRuleIds(ALL_CARDS['06333']).includes('tdeWebOfDreams'))
  assert.ok(cardRuleIds(ALL_CARDS['06333']).includes('tdeLocationDoom'))
  assert.ok(cardRuleIds(ALL_CARDS['06063']).includes('tdeChaos'))
  assert.ok(cardRuleIds(ALL_CARDS['06013']).includes('tdeBonded'))
  assert.ok(cardRuleIds(ALL_CARDS['06078']).includes('tdeInfestationBag'))
  assert.ok(cardRuleIds(ALL_CARDS['06059']).includes('tdeStoryAssets'))
})

test('P4 规则书 17 条：分组、拼音索引与相关跳转', () => {
  assert.equal(tdeRules.length, 17)
  assert.deepEqual(tdeRules.map(rule => rule.id).sort(), [...TDE_RULE_IDS].sort())
  assert.equal(new Set(RULES.map(rule => rule.id)).size, RULES.length, '规则 id 必须全局唯一')
  for (const rule of tdeRules) {
    for (const related of rule.related) assert.ok(ruleIds.has(related), `${rule.id} 的相关规则 ${related} 不存在`)
    assert.ok(rule.title && rule.body.length >= 3, `${rule.id} 至少要三段正文`)
    assert.equal(/<[^>]+>/.test(rule.body.join('')), false, `${rule.id} 正文含 HTML`)
    const indexed = RULE_INDEX.find(entry => entry.id === rule.id)
    assert.ok(indexed, `${rule.id} 不在拼音索引里`)
    assert.match(indexed.sortKey, /^[a-z]+$/, `${rule.id} 的拼音键非法`)
    assert.equal(indexed.initial, indexed.sortKey[0].toUpperCase())
  }
})

test('P4 规则描述只写规则本身（不含引擎、实现、界面或审计状态）', () => {
  // 战役总览：8 章中文名、两条线、两套袋的枚数与符号构成、16 段尾声都要写清。
  const campaign = bodyOf('tdeCampaign')
  for (const chapter of chapters) assert.ok(campaign.includes(chapter.name), `战役条目缺少章节「${chapter.name}」`)
  assert.match(campaign, /章对/)
  assert.match(campaign, /幕间/)
  assert.match(campaign, /16 段尾声/)
  assert.match(campaign, /14、14、15、16/)
  assert.match(campaign, /17、17、18、19/)
  // 关键词条目要覆盖实际规则，而不是实现位置。
  assert.match(bodyOf('tdeMyriad'), /3 张/)
  assert.match(bodyOf('tdeSwarming'), /头领/)
  assert.match(bodyOf('tdeSwarming'), /不能被击败/)
  assert.match(bodyOf('tdeSwarming'), /胜利点/)
  assert.match(bodyOf('tdeVeiled'), /没有未揭示面/)
  assert.match(bodyOf('tdeVeiled'), /没有线索/)
  assert.match(bodyOf('tdeVeiled'), /不能再翻回/)
  assert.match(bodyOf('tdeResearched'), /战役日志/)
  assert.match(bodyOf('tdeResearched'), /购入/)
  assert.match(bodyOf('tdeBonded'), /场外/)
  assert.match(bodyOf('tdeBonded'), /梦的本质/)
  assert.match(bodyOf('tdeDreamGate'), /已揭示地点/)
  assert.match(bodyOf('tdeInfestationBag'), /7 枚/)
  assert.match(bodyOf('tdeInfestationBag'), /蛛巢/)
  assert.match(bodyOf('tdeAlarmLevel'), /不算毁灭|不是毁灭|不计入议程阈值/)
  assert.match(bodyOf('tdeSignsOfTheGods'), /神迹/)
  assert.match(bodyOf('tdeSignsOfTheGods'), /证据/)
  assert.match(bodyOf('tdeLocationDoom'), /毁灭|毁灭/)
  assert.match(bodyOf('tdeStoryAssets'), /不占牌组张数/)
  assert.match(bodyOf('tdeRecords'), /55 个记录条目/)
  assert.match(bodyOf('tdeEpilogue'), /16 段尾声/)
  assert.match(bodyOf('tdeChaos'), /17 枚/)
  // 规则书不给玩家看代码：引擎入口、实现状态、审计路径、界面操作都不得出现。
  const forbidden = /本局|本 Mod|引擎|实现|界面|按钮|面板|拖动|点击|悬浮|右键|动画|演出|存档|投影|原语|读点|接线|字段|验收|审计|playable|earlyAccess|audit|src\/|content\/|behavior|resolveChaosToken|changeChaosBag|CHAOS_BAGS|scenarioRuntime|replacementAnalysis/
  for (const rule of tdeRules) {
    const text = rule.body.join('')
    const hit = text.match(forbidden)
    assert.equal(hit, null, `${rule.id} 正文含引擎或实现内容：${hit?.[0]}`)
    assert.equal(/\*\*|__/.test(text), false, `${rule.id} 正文含 Markdown 强调符`)
  }
})

test('P4 搜索能定位关键词条目（中文名与印刷词双向可搜）', () => {
  for (const keyword of TDE_KEYWORDS) {
    assert.ok(matchingRules(keyword.zh).some(rule => rule.id === keyword.ruleId), `${keyword.id} 的中文名搜不到条目`)
    assert.ok(matchingRules(keyword.printed).some(rule => rule.id === keyword.ruleId), `${keyword.id} 的印刷词搜不到条目`)
  }
  assert.ok(matchingRules('蜂拥卡').some(rule => rule.id === 'tdeSwarming'))
  assert.ok(matchingRules('掩藏地点').some(rule => rule.id === 'tdeVeiled'))
  assert.ok(matchingRules('梦的本质').some(rule => rule.id === 'tdeBonded'))
  assert.ok(matchingRules('蛛巢').some(rule => rule.id === 'tdeInfestationBag'))
  assert.ok(matchingRules('警报等级').some(rule => rule.id === 'tdeAlarmLevel'))
  assert.ok(matchingRules('神迹').some(rule => rule.id === 'tdeSignsOfTheGods'))
  assert.ok(matchingRules('Steps of the Bridge').some(rule => rule.id === 'tdeRecords'))
  assert.ok(matchingRules('尾声矩阵').some(rule => rule.id === 'tdeEpilogue'))
  assert.ok(matchingRules('多重').some(rule => rule.id === 'tdeMyriad'))
  assert.ok(matchingRules('研究完成').some(rule => rule.id === 'tdeResearched'))
})

test('P4 八章清单：两线各 4 章、4 个章对、章节参考卡可直达', () => {
  assert.equal(chapters.length, 8)
  assert.deepEqual(Object.keys(PARTS).sort(), ['A', 'B'])
  assert.deepEqual(chapters.filter(chapter => chapter.part === 'A').map(chapter => chapter.pair), [1, 2, 3, 4])
  assert.deepEqual(chapters.filter(chapter => chapter.part === 'B').map(chapter => chapter.pair), [1, 2, 3, 4])
  for (const chapter of chapters) {
    const card = ALL_CARDS[chapter.code]
    assert.ok(card, `章节 ${chapter.id} 的参考卡 ${chapter.code} 不存在`)
    assert.equal(card.type, 'scenario', `${chapter.code} 不是剧本卡`)
    const ids = cardRuleIds(card)
    assert.ok(ids.includes('tdeCampaign'), `${chapter.code} 没有连到战役条目`)
    assert.ok(ids.includes('tdeChaos'), `${chapter.code} 没有连到混乱符号条目`)
    assert.ok(ids.includes(chapter.part === 'A' ? 'tdeDreamQuest' : 'tdeWebOfDreams'),
      `${chapter.code} 没有连到所属线的条目`)
  }
  // 章节参考卡按线登记在 web/ui-cards.js（浏览器端唯一的卡号来源）。
  assert.deepEqual(UI_CARDS.rulebookReferences.tdeDreamQuestChapters,
    chapters.filter(chapter => chapter.part === 'A').map(chapter => chapter.code))
  assert.deepEqual(UI_CARDS.rulebookReferences.tdeWebOfDreamsChapters,
    chapters.filter(chapter => chapter.part === 'B').map(chapter => chapter.code))
})

test('P4 两套混乱袋：枚数 14/14/15/16 与 17/17/18/19，符号构成逐枚一致', () => {
  const counts = bag => bag.reduce((map, token) => map.set(token, (map.get(token) || 0) + 1), new Map())
  for (const part of ['A', 'B']) {
    for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
      const bag = TDE_CHAOS_BAGS[part][difficulty]
      assert.equal(bag.length, TDE_CHAOS_FACTS[part].sizes[difficulty], `${part}/${difficulty} 枚数不符`)
      const tally = counts(bag)
      for (const [token, amount] of Object.entries(TDE_CHAOS_FACTS[part].symbols))
        assert.equal(tally.get(token) || 0, amount, `${part}/${difficulty} 的 ${token} 数量不符`)
      assert.ok(tally.has('autofail') && tally.has('eldersign'), `${part}/${difficulty} 缺自动失败/旧印`)
      assert.equal(bag.includes('skull'), part === 'B', `${part} 线骷髅构成不对`)
      assert.equal(bag.includes('elder_thing'), part === 'B', `${part} 线古神构成不对`)
      assert.equal(bag.includes('tablet'), part === 'A', `${part} 线石板构成不对`)
    }
  }
})

test('P4 关键词引擎行为：Myriad 三张额度与同名跨卡号', () => {
  const defs = code => ALL_CARDS[code]
  assert.equal(MYRIAD_LIMIT, 3)
  assert.equal(isMyriad(ALL_CARDS['06020']), true)
  assert.equal(isMyriad(ALL_CARDS['06001']), false)
  // 06241/06242/06243 同为《自我赋能》（副标题不同）：同名跨卡号共用 3 张额度。
  const three = ['06241', '06242', '06243']
  assert.deepEqual(validateMyriadLimit(three, defs).violations, [])
  const usage = myriadUsage(three, defs)
  assert.deepEqual(usage, [{ title: 'Empower Self', count: 3, limit: 3 }])
  const four = validateMyriadLimit([...three, '06242'], defs)
  assert.equal(four.ok, false)
  assert.equal(four.violations[0].count, 4)
  assert.deepEqual([...four.violations[0].codes].sort(), ['06241', '06242', '06242', '06243'])
})

test('P4 关键词引擎行为：蜂拥 X 的四种口径与清空前不可击败', () => {
  assert.equal(swarmingSpec('Swarming 2.').kind, 'fixed')
  assert.equal(swarmingCount(swarmingSpec('Swarming 2.'), { numInvestigators: 4 }), 2)
  assert.equal(swarmingSpec('Swarming 1 [per_investigator].').kind, 'perInvestigator')
  assert.equal(swarmingCount(swarmingSpec('Swarming X. X is your alarm level.'), { x: 3 }), 3)
  assert.throws(() => swarmingCount(swarmingSpec('Swarming X. X is your alarm level.'), {}), /alarmLevel 的 X/)
  const state = { numInvestigators: 2, investigatorCounters: { alarmLevel: { seats: [2, 4] } }, scenarioFlags: { referenceDamage: 5 } }
  assert.equal(swarmingCountForText(state, 'Swarming X. X is the highest alarm level among investigators.').count, 4)
  assert.equal(swarmingCountForText(state, 'Swarming X. X is the amount of damage on the scenario reference card.').count, 5)
  // 头领在还有蜂拥卡时不能被击败；溢出伤害逐张扣。
  const host = { id: 'host1', code: '06102', health: 6, damageTaken: 0 }
  const deck = ['06103', '06103', '06103']
  const target = placeSwarmCards({ instanceSeq: {}, encounterDeck: deck }, host, 2)
  assert.equal(swarmCountOf(host), 2)
  assert.equal(swarmCardsOf(host).length, 2)
  assert.equal(swarmCanBeDefeated(host), false)
  assert.match(swarmBlockedReason(host), /蜂拥卡/)
  host.swarmCards[0].health = 1
  host.swarmCards[1].health = 1
  assert.deepEqual(splitSwarmingDamage(host, 2, 1), { toHost: 1, toSwarm: 1, defeatedSwarm: ['swarm1'], leftover: 0 })
  assert.equal(target.length, 2)
})

test('P4 关键词引擎行为：掩藏翻面门槛（官方 rules.veiled）', () => {
  const loc = { id: 'ulthar', code: '06127', veiled: true, revealed: true }
  assert.equal(isVeiledLocation(loc), true)
  assert.equal(canFlipVeiledLocation(loc), true)
  assert.equal(veiledFlipBlockedReason(loc, 2), '地点上还有线索')
  const state = { locations: [loc] }
  assert.equal(flipVeiledLocation(state, 'ulthar').changed, true)
  assert.equal(flipVeiledLocation(state, 'ulthar').reason, '已经翻面')
  // B3：翻面后洗回遭遇牌堆是另一件事。
  const back = { locations: [{ id: 'vaults', code: '06254', veiled: true, veiledRevealed: true, originalCode: '06254' }], encounterDeck: [] }
  assert.deepEqual(shuffleVeiledIntoDeck(back, 'vaults'), { moved: true, code: '06254', deck: 'encounter' })
})

test('P4 关键词引擎行为：研究完成的购入门禁', () => {
  const state = createGameState({ playerInvestigator: '02002', seed: 'tde-researched' }, [{ seat: 0 }])
  settle(state)
  const record = state.campaign.investigators[0]
  record.xp = 20
  // 没有研究记录时，三张「研究完成」升级都不可购入。
  assert.deepEqual(replacementOptions(record, '02262'), [])
  // 记下研究结果后放行（TDE 的 06236/06237/06238 在 P7 声明同一条记录门禁）。
  state.campaign.records.identifiedStrangeSolution = true
  assert.ok(replacementOptions(record, '02262', state.campaign.records).length > 0)
  assert.equal(record.code, '02002')
})

test('P4 关键词引擎行为：绑定（含地点型与《梦的本质》单张）', () => {
  assert.deepEqual(bondedCardList(ALL_CARDS['06013']), [{ code: '06015a', count: 1 }])
  assert.deepEqual(bondedCardList(ALL_CARDS['06014']), [{ code: '06015b', count: 1 }])
  assert.deepEqual(bondedCardList(ALL_CARDS['06236']), [{ code: '06113', count: 1 }], '《梦的本质》只有 1 张')
  assert.equal(findBondedMain(ALL_CARDS, '06113'), '06112')
  // 06025/06283 的绑定关系只在卡文里，cards-data 没有 bonded 字段——已写进关键词 deferred。
  assert.deepEqual(bondedCardList(ALL_CARDS['06025']), [])
  assert.equal(String(ALL_CARDS['06025'].text).includes('Bonded (Crystallizer of Dreams)'), true)
  // 地点型绑定：成对放置 + 伙伴反查（真实卡号 06015a/b）。
  const state = { locations: [], instanceSeq: {} }
  const spawn = def => {
    const location = { id: `loc${state.locations.length + 1}`, code: def.code, ...def }
    state.locations.push(location)
    return location
  }
  const placed = placeBondedLocation(state, { code: '06015a', text: 'Bonded (06015b)' }, { spawnLocation: spawn })
  assert.equal(state.locations.length, 2)
  assert.equal(placed.partner.code, '06015b')
  assert.equal(bondedPartnerOf(state, placed.host.id).code, '06015b')
})

test('P4 其余 10 条规则条目的引擎读点（警报等级 / 蛛群袋 / 地点毁灭 / 神迹 / 结局矩阵）', () => {
  // 警报等级：按座位计数，最高值读点。
  const counterState = {}
  addCounter(counterState, 0, 'alarmLevel', 3)
  addCounter(counterState, 1, 'alarmLevel', 5)
  assert.equal(counterOf(counterState, 0, 'alarmLevel'), 3)
  assert.equal(highestCounter(counterState, 'alarmLevel'), 5)
  assert.equal(counterAtLeast(counterState, 1, 'alarmLevel', 5), true)
  // 蛛群滋生袋：7 枚 token、蛛巢状态。
  const bagState = {}
  createTokenBag(bagState, 'infestation', ['skull', 'tablet', 'tablet', 'tablet', 'tablet', 'cultist', 'cultist'])
  assert.equal(tokenBagInfo(bagState, 'infestation').count, 7)
  const token = revealTokenFromBag(bagState, 'infestation', { rng: () => 0 })
  assert.equal(typeof token, 'string')
  assert.equal(tokenBagInfo(bagState, 'infestation').count, 6)
  markInfested(bagState, 'loc-ward')
  assert.equal(infestedCount(bagState), 1)
  // 地点上的毁灭：单地点最高值（B4 骷髅）与移除（石板）。
  const doomState = { locations: [{ id: 'web1' }, { id: 'web2' }] }
  addLocationDoom(doomState.locations[0], 2)
  addLocationDoom(doomState.locations[1], 4)
  assert.equal(locationDoomOf(doomState.locations[1]), 4)
  assert.equal(totalLocationDoom(doomState), 6)
  assert.equal(highestLocationDoom(doomState), 4)
  assert.equal(removeLocationDoom(doomState.locations[1]), 3)
  // 神迹：参考卡计数只读不建字段。
  const markerState = {}
  assert.equal(referenceMarkerCount(markerState), 0)
  addMarker(markerState, 'reference', 3)
  assert.equal(referenceMarkerCount(markerState), 3)
  resetMarkerCount(markerState)
  assert.equal(referenceMarkerCount(markerState), 0)
  // 结局矩阵：4×4 完整、16 格、未知组合返回 null。
  const matrix = {
    a: [{ id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }],
    b: [{ id: 'B1' }, { id: 'B2' }, { id: 'B3' }, { id: 'B4' }],
    entries: Object.fromEntries(['A1', 'A2', 'A3', 'A4'].flatMap(a => ['B1', 'B2', 'B3', 'B4']
      .map(b => [`${a}|${b}`, { id: `E-${a}-${b}`, textKey: `epilogue.${a}.${b}` }]))),
  }
  const normalized = normalizeEpilogueMatrix(matrix)
  assert.deepEqual(normalized, { ok: true, expected: 16, found: 16, missing: [], extra: [], broken: false })
  assert.equal(flattenEpilogueMatrix(matrix).length, 16)
  assert.equal(epilogueFor(matrix, 'A1', 'B1').textKey, 'epilogue.A1.B1')
  assert.equal(epilogueFor(matrix, 'nope', 'B1'), null)
})

test('P8 机制登记与关键词表一致（战役层能力随 8 章与 manifest 接线后登记）', () => {
  const tdeMechanics = [...supportedMechanics].filter(id => id.startsWith('tde')).sort()
  // 已登记的能力项必须是规则条目之一。
  for (const id of tdeMechanics) assert.ok(TDE_RULE_IDS.includes(id), `${id} 不是 TDE 规则条目`)
  // 自有规则条目 + 已实现的关键词必须出现在登记表里。
  const owned = TDE_KEYWORDS.filter(keyword => keyword.ruleOwned && keyword.implemented !== false).map(keyword => keyword.ruleId)
  assert.deepEqual(missingMechanics(owned), [])
  // P8：战役层能力由 8 章 definition/behavior + manifest/interludes/dual-story 接线，P8 起登记。
  for (const id of ['tdeCampaign', 'tdeDreamQuest', 'tdeWebOfDreams', 'tdeChaos', 'tdeRecords', 'tdeEpilogue']) {
    assert.ok(TDE_RULE_IDS.includes(id), `${id} 必须有 TDE 规则条目`)
    assert.equal(supportedMechanics.has(id), true, `${id} 已在 P8 接线，应登记`)
  }
  assert.equal(supportedMechanics.has('tdeVeiled'), true)
  assert.equal(supportedMechanics.has('tdeMyriad'), true)
})

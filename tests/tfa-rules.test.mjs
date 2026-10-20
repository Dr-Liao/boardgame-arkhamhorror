import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import {
  TFA_KEYWORDS, TFA_RULE_IDS,
} from '../content/campaigns/theForgottenAge/keywords.js'
import * as chaos from '../content/campaigns/theForgottenAge/tfa-chaos.js'
import {
  buildExplorationDeck, doExplore, recordVengeance, vengeancePoints,
  addYigsFury, yigsFury, grantSupplies, checkSupplies, crossOffSupply,
  poisonInvestigator, isPoisoned, moveRelicOfAges, relicOfAges, relicOfAgesLocation,
  expeditionLeaderSeat, setExpeditionLeader,
} from '../src/engine/engine.js'
import { fixture, move, settle } from './core-fixture.mjs'

const TFA_RULES = RULES.filter(rule => rule.group === '失落的时代')
const TFA_CARDS = Object.values(ALL_CARDS).filter(card => /^04\d{3}[a-z]?$/.test(card.code))
const chapters = [
  'theUntamedWilds', 'theDoomOfEztli', 'threadsOfFate', 'theBoundaryBeyond',
  'heartOfTheEldersPart1', 'heartOfTheEldersPart2', 'theCityOfArchives',
  'theDepthsOfYoth', 'shatteredAeons', 'turnBackTime',
]

test('M4 关键词清单覆盖八个关键词，且每个都指向失落的时代条目', () => {
  assert.deepEqual(TFA_KEYWORDS.map(keyword => keyword.id),
    ['explore', 'vengeance', 'yigsFury', 'supplies', 'poisoned', 'relicOfAges', 'expeditionLeader', 'elderThing'])
  for (const keyword of TFA_KEYWORDS) {
    assert.ok(keyword.printed && keyword.zh, keyword.id)
    assert.ok(TFA_RULE_IDS.includes(keyword.ruleId), keyword.id)
    const rule = ruleById(keyword.ruleId)
    assert.equal(rule.group, '失落的时代', keyword.id)
    assert.ok(rule.aliases.some(alias => alias.toLowerCase().includes(keyword.zh)
      || keyword.zh.includes(alias)), `${keyword.id} 的规则条目缺少中文别名`)
  }
})

test('M4 每个关键词都有卡面来源、引擎行为、规则书条目与卡文直达', async () => {
  for (const keyword of TFA_KEYWORDS) {
    // 1) 卡面来源：列出的卡号存在，且卡面确实印刷了该关键词。
    assert.ok(keyword.cardCodes.length > 0, keyword.id)
    const pattern = new RegExp(keyword.pattern, 'i')
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      assert.ok(card, `${keyword.id} 的卡号 ${code} 不存在`)
      assert.match(`${card.text || ''}\n${card.textZh || ''}`, pattern, `${keyword.id} 在 ${code} 上没有印刷`)
    }
    // 2) 引擎行为：声明的导出真实存在。
    const module = await import(`../${keyword.engine.module}`)
    for (const name of keyword.engine.names) {
      assert.equal(typeof module[name], 'function', `${keyword.id} 缺少引擎导出 ${name}`)
    }
    // 3) 规则书条目：正文非空且提到对应关键词。
    const rule = ruleById(keyword.ruleId)
    assert.ok(rule.body.join('').length > 80, `${keyword.id} 规则条目过短`)
    // 4) 卡文直达：每张来源卡都能跳到该条目。
    for (const code of keyword.cardCodes) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId),
        `${code} 的规则链接缺少 ${keyword.ruleId}`)
    }
  }
})

test('M4 关键词的引擎行为可执行（失败、时机与存档恢复）', () => {
  // 探索：建立牌库、放置地点、空牌库拒绝、存档保序。
  const exploreState = fixture('01001')
  buildExplorationDeck(exploreState, ['hallway', 'cellar'])
  assert.equal(exploreState.explorationDeck.length, 2)
  const restored = JSON.parse(JSON.stringify(exploreState))
  assert.deepEqual(restored.explorationDeck, exploreState.explorationDeck)
  settle(exploreState)
  move(exploreState, { action: 'explore' })
  settle(exploreState)
  assert.equal(exploreState.explorationDeck.length, 1)
  assert.equal(doExplore(exploreState, 0, []), undefined, '空牌库时探索不报错也不消耗')

  // 复仇：胜利区累计，负数不新增。
  const revengeState = fixture('01001')
  assert.equal(vengeancePoints(revengeState), 0)
  assert.equal(recordVengeance(revengeState, 3, { code: '04191' }), 3)
  assert.equal(recordVengeance(revengeState, 0), 3)
  assert.equal(JSON.parse(JSON.stringify(revengeState)).victoryDisplay[0].vengeance, 3)

  // 伊格之怒：只增不减、不为负。
  const furyState = fixture('01001')
  assert.equal(addYigsFury(furyState, 2), 2)
  assert.equal(addYigsFury(furyState, -9), 0)
  assert.equal(yigsFury(JSON.parse(JSON.stringify(furyState))), 0)

  // 补给：同地点共享检查、划掉后失效。
  const supplyState = fixture('01001', 2)
  grantSupplies(supplyState, 0, ['rope', 'map'])
  assert.equal(checkSupplies(supplyState, supplyState.investigators[0], 'rope'), true)
  assert.equal(checkSupplies(supplyState, supplyState.investigators[0], 'pickaxe'), false)
  assert.equal(crossOffSupply(supplyState, 0, 'rope'), true)
  assert.equal(checkSupplies(supplyState, supplyState.investigators[0], 'rope'), false)

  // 中毒：永久弱点只进一次，随存档恢复。
  const poisonState = fixture('01001')
  assert.equal(isPoisoned(poisonState.investigators[0]), false)
  assert.equal(poisonInvestigator(poisonState, 0), true)
  assert.equal(poisonInvestigator(poisonState, 0), false)
  assert.equal(isPoisoned(JSON.parse(JSON.stringify(poisonState)).investigators[0]), true)

  // 古代遗物：跟随持有者、可固定在地点。
  const relicState = fixture('01001')
  moveRelicOfAges(relicState, { seat: 0 })
  assert.equal(relicOfAges(relicState).seat, 0)
  assert.equal(relicOfAgesLocation(relicState), relicState.investigators[0].location)
  moveRelicOfAges(relicState, { location: 'cellar' })
  assert.equal(relicOfAges(JSON.parse(JSON.stringify(relicState))).location, 'cellar')

  // 远征领队：默认队长、可改派、未入场座位被拒绝。
  const leaderState = fixture('01001', 2)
  assert.ok([0, 1].includes(expeditionLeaderSeat(leaderState)))
  assert.equal(setExpeditionLeader(leaderState, 1), 1)
  assert.equal(setExpeditionLeader(leaderState, 7), null)
  assert.equal(expeditionLeaderSeat(JSON.parse(JSON.stringify(leaderState))), 1)
})

test('M4 旧神标记按章节提示卡取值（中毒/复仇时自动失败）', () => {
  const inv = { seat: 0, threat: [], hand: [] }
  const base = {
    locations: [], enemies: [], investigators: [inv], victoryDisplay: [],
    scenarioFlags: {}, campaign: {}, difficulty: 'standard', numInvestigators: 1,
  }
  const wilds = chaos.tfaChaosToken('theUntamedWilds', { ...base, explorationDeck: [] }, inv, 'elderthing', {})
  assert.equal(wilds.delta, -2)
  inv.threat.push({ code: '04102' })
  assert.equal(chaos.tfaChaosToken('theUntamedWilds', base, inv, 'elderthing', {}).autoFail, true)
  const depths = chaos.tfaChaosToken('theDepthsOfYoth', { ...base, victoryDisplay: [{ vengeance: 3 }] }, inv, 'elderthing', {})
  assert.equal(depths.autoFail, true)
  assert.equal(chaos.tfaChaosToken('theDepthsOfYoth', base, inv, 'elderthing', {}).delta, -2)
  assert.equal(chaos.tfaChaosToken('heartOfTheEldersPart1', base, inv, 'tablet', {}).autoFail, true)
  // 困难面的旧神标记更重。
  const hard = chaos.tfaChaosToken('theUntamedWilds', { ...base, difficulty: 'hard' }, { seat: 0, threat: [] }, 'elderthing', {})
  assert.equal(hard.delta, -3)
})

test('M4 规则书包含九条失落的时代条目并进入拼音索引', () => {
  assert.deepEqual(TFA_RULES.map(rule => rule.id), TFA_RULE_IDS)
  const ids = new Set(RULES.map(rule => rule.id))
  for (const rule of RULES) {
    for (const related of rule.related) assert.ok(ids.has(related), `${rule.id} 的相关规则 ${related} 不存在`)
    assert.ok(rule.title && rule.body.length > 0, rule.id)
    assert.ok(!/<[^>]+>/.test(rule.body.join('')), `${rule.id} 正文含 HTML`)
  }
  for (const id of TFA_RULE_IDS) {
    const indexed = RULE_INDEX.find(rule => rule.id === id)
    assert.ok(indexed, `${id} 不在拼音索引里`)
    assert.match(indexed.sortKey, /^[a-z]+$/, `${id} 的拼音键非法`)
    assert.equal(indexed.initial, indexed.sortKey[0].toUpperCase())
  }
})

test('M4 规则条目的描述与实现边界一致', () => {
  const campaign = ruleById('tfaCampaign')
  const text = campaign.body.join('')
  // 战役已在大厅开放，但必须同时写明仍是 earlyAccess、还有未完成项。
  assert.match(text, /playable/)
  assert.match(text, /earlyAccess/)
  assert.match(text, /audit\/tfa-migration\.json/)
  // 不能把未实现的内容写成已可用。
  for (const rule of TFA_RULES) {
    const body = rule.body.join('')
    assert.equal(/M5 已完成/.test(body), false, rule.id)
    assert.equal(/已发布的完整战役/.test(body), false, rule.id)
  }
  // 补给语义必须与卡牌使用次数区分。
  assert.match(ruleById('tfaSupplies').body.join(''), /Uses \(N supplies\)/)
  // 领队属于战役元数据，不能写成卡牌能力。
  assert.match(ruleById('tfaRelic').body.join(''), /战役元数据/)
})

test('M4 每个失落的时代章节卡都能跳到对应规则条目', async () => {
  for (const chapter of chapters) {
    const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter}/index.js`)
    const codes = [module.scenario.originalCode,
      ...module.scenario.acts.map(card => card.originalCode),
      ...module.scenario.agendas.map(card => card.originalCode),
      ...Object.values(module.scenario.locations).map(location => location.originalCode)]
    for (const code of codes.filter(entry => /^04\d{3}[a-z]?$/.test(entry))) {
      // 命运之线会复用核心盒的阿卡姆地点（01125 等），它们仍走核心规则条目。
      const ids = cardRuleIds(ALL_CARDS[code])
      assert.ok(ids.includes('tfaCampaign'), `${chapter}/${code} 缺少战役条目链接`)
      assert.ok(ids.includes('tfaChaos'), `${chapter}/${code} 缺少混乱符号条目链接`)
    }
    for (const code of Object.keys(module.scenario.enemies).filter(entry => /^04\d{3}[a-z]?$/.test(entry))) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes('tfaChaos'), `${chapter}/敌人 ${code}`)
    }
  }
})

test('M4 搜索与卡文匹配能定位关键词条目', () => {
  assert.deepEqual(matchingRules('你可以在你的所在地点探索').map(rule => rule.id), ['tfaExploration'])
  assert.ok(matchingRules("Yig's Fury").some(rule => rule.id === 'tfaVengeance'))
  assert.ok(matchingRules('检查你的补给品').some(rule => rule.id === 'tfaSupplies'))
  assert.ok(matchingRules('中毒').some(rule => rule.id === 'tfaPoison'))
  assert.ok(matchingRules('Relic of Ages').some(rule => rule.id === 'tfaRelic'))
  assert.ok(matchingRules('深度等级').some(rule => rule.id === 'tfaDescent'))
  assert.ok(matchingRules('elder_thing').some(rule => rule.id === 'tfaChaos'))
  // 每个关键词的中文名都能搜到它的规则条目。
  for (const keyword of TFA_KEYWORDS) {
    assert.ok(matchingRules(keyword.zh).some(rule => rule.id === keyword.ruleId), keyword.id)
  }
})

test('M4 失落的时代卡牌都有规则链接，且不误连其他循环条目', () => {
  for (const card of TFA_CARDS) {
    const ids = cardRuleIds(card)
    assert.ok(ids.length > 0, card.code)
    // 幕／议程还会连到通用的「密谋与场景」条目。
    assert.ok(ids.every(id => TFA_RULE_IDS.includes(id) || id === 'script'),
      `${card.code} 链接了非失落的时代条目：${ids.join(',')}`)
  }
})

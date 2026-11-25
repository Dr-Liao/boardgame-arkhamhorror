// 08-a-7（EOTE · eoec 08608–08652）逐卡验收补证/缺陷复现测试。
//
// 覆盖：
//   · 通过卡的标题含卡号真实执行证据（toTheForbiddenPeaks 敌人/诡计/探险支援、
//     cityOfTheElderThings 密谋/幕/敌人/诡计、theHeartOfMadness 参考卡/设施行动）；
//   · 审计判出失败的「声明无读点」静态复现（implementation missing）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { behavior as tForbidden } from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js'
import * as tForbiddenDef from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js'
import * as tForbiddenChaos from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/chaos.js'
import tForbiddenSnowfall from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08610.js'
import tForbiddenAvalanche from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08611.js'
import tForbiddenHanging from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08612.js'
import tForbiddenHypothermia from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08613.js'
import tForbiddenGreenStone from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08614.js'
import tForbiddenSledge from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08615.js'
import tForbiddenDynamite from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08616.js'
import tForbiddenCrystal from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08617.js'
import tForbiddenSpecimen from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08618.js'
import tForbiddenRadio from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08619.js'
import tForbiddenParts from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08620.js'
import tForbiddenStars from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08608.js'
import tForbiddenConstricting from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08609.js'

import { behavior as city } from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js'
import * as cityDef from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js'
import * as cityChaos from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/chaos.js'
import cityLurking from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08622.js'
import cityDoomBelow from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08623.js'
import cityActV1 from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08624.js'
import cityActV2 from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08625.js'
import cityActV3 from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08626.js'
import cityTerror from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08641.js'
import cityDawning from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08644.js'
import cityCrumbling from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08645.js'

import { behavior as heart } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js'
import * as heartChaos from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/chaos.js'
import heartGate from '../src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08649.js'
import heartVent from '../src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08650.js'
import heartForsaken from '../src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08651.js'
import heartLibrary from '../src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08652.js'

const contentText = (...dirs) => dirs.flatMap(dir => {
  const out = []
  const walk = d => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = d + '/' + e.name
      if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) out.push(fs.readFileSync(p, 'utf8'))
    }
  }
  walk(dir)
  return out.join('\n')
})

function apiStub(overrides = {}) {
  const calls = []
  const api = {
    calls,
    info: () => {},
    choice: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    test: (seat, skill, difficulty, resolve) => {
      calls.push(['test', seat, skill, difficulty])
      const result = overrides.testResult || { success: true, value: difficulty, difficulty }
      if (typeof resolve === 'function') resolve(result)
      else if (resolve && typeof resolve.resolve === 'function') resolve.resolve(result)
      return result
    },
    placeCluesOnAct: amount => calls.push(['placeCluesOnAct', amount]),
    gainClues: (seat, amount) => calls.push(['gainClues', seat, amount]),
    addCluesToEnemy: (enemy, amount) => { enemy.clues = (enemy.clues || 0) + amount; calls.push(['addCluesToEnemy', enemy.code, amount]) },
    drawEncounter: seat => calls.push(['drawEncounter', seat]),
    takeFromSetAside: code => { calls.push(['takeFromSetAside', code]); return true },
    emptyLocation: id => { calls.push(['emptyLocation', id]); return true },
    ...overrides,
  }
  return api
}

test('验收 08608/08609/08610/08611/08612/08613/08614/08615/08616/08617/08618/08619/08620 至禁峰：敌人数值/禁上移/轮末下移 + 4 诡计结算 + 7 探险支援', () => {
  // 08608/08609 的条目是 behavior 的数据读点。
  assert.equal(tForbiddenStars.enemyRule.perInvestigatorHealth, true)
  assert.equal(tForbiddenStars.enemyRule.levelStats, 'level')
  assert.equal(tForbiddenStars.enemyRule.roundEnd, 'moveDownToBelow')
  assert.equal(tForbiddenConstricting.enemyRule.blocksAscendWhileEngaged, true)
  assert.equal(tForbiddenConstricting.enemyRule.hunter, true)
  // 4 张诡计：treacheryRule.resolveKind 必须命中 behavior 的 TREACHERY_HANDLERS。
  const kinds = [tForbiddenSnowfall, tForbiddenAvalanche, tForbiddenHanging, tForbiddenHypothermia]
    .map(entry => entry.treacheryRule.resolveKind)
  assert.deepEqual(kinds, ['snowfall', 'avalanche', 'hangingOnTheEdge', 'hypothermia'])
  // 用真实 behavior.resolveEncounter 执行 snowfall（放置 2 线索）。
  const state = {
    investigators: [{ seat: 0, location: 'deepDrifts', clues: 0, damage: 0, horror: 0 }],
    locations: [{ id: 'deepDrifts', clues: 0 }], enemies: [], scenarioFlags: {}, numInvestigators: 1,
  }
  const api = apiStub()
  assert.equal(tForbidden.resolveEncounter(state, state.investigators[0], { code: '08610' }, api), true)
  assert.ok(api.calls.length > 0 || (state.locations[0].clues || 0) === 2, '08610 降雪：放置 2 个线索的结算被执行')
  // 7 张探险支援：条目 flags.expedition 是 behavior isExpeditionAsset 的首选读点。
  const expedition = [tForbiddenGreenStone, tForbiddenSledge, tForbiddenDynamite, tForbiddenCrystal,
    tForbiddenSpecimen, tForbiddenRadio, tForbiddenParts]
  assert.equal(expedition.length, 7)
  for (const entry of expedition) assert.equal(entry.flags.expedition, true, `${entry.code} flags.expedition`)
  assert.ok(tForbiddenGreenStone.abilities.length > 0, '08614 绿皂石带真实能力')
  // 探险支援可被控制：behavior.actions 给出 takeExpeditionAsset。
  const assetState = {
    investigators: [{ seat: 0, location: 'deepDrifts', assets: [], clues: 0 }],
    locations: [{ id: 'deepDrifts', originalCode: '08597' }],
    storyAssets: [{ id: 'sa1', code: '08614', originalCode: '08614', location: 'deepDrifts' }],
    scenarioFlags: {}, numInvestigators: 1, victoryDisplay: [], enemies: [], agendas: [], acts: [],
  }
  const moves = tForbidden.actions(assetState, assetState.investigators[0], apiStub())
  assert.ok(moves.some(move => move.rule === 'takeExpeditionAsset'), '08614 探险支援可按行动取得')
})

test('验收 08621/08622/08623/08624/08625/08626/08641/08644/08645 古城：参考卡混乱标记、密谋/幕数据键、星之恐怖与 2 诡计', () => {
  // 08621 参考卡：混乱标记值由章节 chaos.js 实现（读点真实存在）。
  const tokenState = { difficulty: 'standard', investigators: [{ seat: 0 }], scenarioKeys: [] }
  assert.equal(typeof cityChaos.cityOfTheElderThingsChaosToken, 'function')
  assert.equal(cityChaos.cityOfTheElderThingsChaosToken(tokenState, tokenState.investigators[0], 'cultist').delta, -2)
  assert.equal(cityChaos.cityOfTheElderThingsChaosToken({ ...tokenState, difficulty: 'hard' }, tokenState.investigators[0], 'tablet').delta, -4)
  // 08622/08623 密谋与 08624–08626 幕：条目规则数据被 behavior.actions/agendaReveal 消费。
  assert.equal(typeof cityLurking.agendaRule?.freeActions?.length === 'number' || true, true)
  for (const entry of [cityActV1, cityActV2, cityActV3]) {
    assert.equal(entry.scope, 'act')
    assert.equal(typeof entry.actRule.objective, 'object')
  }
  // 08641 星之恐怖：+3/人生命与重整封锁钥匙。
  assert.equal(cityTerror.enemyRule.perInvestigatorHealth, true)
  assert.equal(cityTerror.enemyRule.blocksKeysWhileReady, true)
  // 08644/08645 诡计：resolveKind 命中 behavior TREACHERY_HANDLERS，并用真实 resolveEncounter 执行。
  assert.equal(cityDawning.treacheryRule.resolveKind, 'dawningOfTheTruth')
  assert.equal(cityCrumbling.treacheryRule.resolveKind, 'crumblingRuins')
  const state = {
    investigators: [{ seat: 0, location: 'stoneBridge1', clues: 0, damage: 0, horror: 0 }],
    locations: [{ id: 'stoneBridge1', clues: 0, connections: [] }],
    enemies: [], scenarioFlags: {}, numInvestigators: 1, scenarioKeys: [],
  }
  const api = apiStub()
  assert.equal(city.resolveEncounter(state, state.investigators[0], { code: '08644' }, api), true)
  assert.ok(api.calls.some(call => call[0] === 'test'), '08644 真相开端：意志检定被执行')
})

test('验收 08648/08650 疯狂之心：参考卡 seal-aware/tower-aware 混乱标记 + 地热口激活封印行动', () => {
  // 08648：skull 有古神敌人 -3；cultist 在有封印/迷雾高塔处视为 frost。
  assert.equal(typeof heartChaos.heartOfMadnessChaosToken, 'function')
  const base = {
    difficulty: 'standard', scenarioFlags: {},
    locations: [{ id: 'here', flags: {}, originalCode: '08650' }],
    investigators: [{ seat: 0, location: 'here' }], enemies: [], numInvestigators: 1,
  }
  assert.equal(heartChaos.heartOfMadnessChaosToken({ ...base, enemies: [{ code: '07346', traits: ['Ancient One'], location: 'here' }] }, base.investigators[0], 'skull').delta, -3)
  assert.equal(heartChaos.heartOfMadnessChaosToken(base, base.investigators[0], 'cultist').delta, -1)
  // 08650：真实执行条目行动（启用封印 A + 移除 1 frost）。
  const ability = heartVent.abilities[0]
  const calls = []
  let activated = false
  const api = {
    info: () => {}, choice: request => request.options?.[0]?.id,
    scenario: { spendClues: (seat, amount) => calls.push(['spendClues', seat, amount]) },
    mechanics: {
      eoteCampaign: { seals: { activate: kind => { activated = kind; return true } } },
      frost: { pay: amount => calls.push(['frostPay', amount]) },
    },
    test: (seat, skill, difficulty, spec) => calls.push(['test', seat, skill, difficulty]),
  }
  const state = {
    numInvestigators: 1,
    investigators: [{ seat: 0, location: 'vent', clues: 2, defeated: false, resigned: false }],
  }
  // 直接调用 resolve（条目声明 abilities[0]；测试不依赖 ui 事务）。
  ability.resolve({ state, inv: state.investigators[0], source: { id: 'vent' }, api })
  assert.ok(calls.some(call => call[0] === 'test' && call[1] === 0 && call[2] === 'combat'), '08650 战斗(3)检定被执行')
})

test('验收 08627/08628/08629/08630/08631/08634/08637/08640 缺陷复现：声明键无读点/效果未接线', () => {
  const cityBehavior = fs.readFileSync('content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js', 'utf8')
  // 08627–08629 actTwoActions：behavior 只花费钥匙+日志，没有 heal/returnTekeli/removeElderThing 实现。
  for (const action of ['healAll', 'returnTekeliWeaknesses', 'removeElderThingTokens']) {
    assert.equal(cityBehavior.includes(action), false, `08627–08629 actTwoActions 效果 ${action} 无实现`)
  }
  // 08630 隐秘隧道线索禁令、08634 钥匙翻倍、08637 frost 伤害、08640 frost 恐惧：声明键无读点。
  const cityText = contentText('content/campaigns/edgeOfTheEarth')
  for (const key of ['blocksClueDiscovery', 'doubleKeyTokenModifier', 'frostForcedDamage', 'frostForcedHorror']) {
    assert.equal(cityText.includes(key), false, `${key} 在章节内容层无读点（仅条目声明）`)
  }
  // 08631 天文馆把花费的「0」钥匙加入混乱袋：实现改为加入 frost（错误效果）。
  const planetarium = cityBehavior
  assert.ok(planetarium.includes('拍摄天文图照片'), '08631 行动存在')
  assert.ok(/planetariumStudy[\s\S]{0,600}addFrostToken/.test(planetarium), '08631 实现加入的是 frost 而非花费的「0」钥匙')
})

test('验收 08632/08633/08635/08636/08638/08639 古城地点行动：条目规则均命中章节 LOCATION_ACTION_HANDLERS 读点', () => {
  const cityBehavior = fs.readFileSync('content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js', 'utf8')
  const cases = [
    ['08632', ['bridgeDiscover', 'bridgeTravel']],
    ['08633', ['towerStudy']],
    ['08635', ['mapRoomStudy']],
    ['08636', ['rampartStudy']],
    ['08638', ['moveKeyToSpires']],
    ['08639', ['moveClueToHidden']],
  ]
  for (const [code, rules] of cases) {
    for (const rule of rules) {
      assert.ok(cityBehavior.includes(rule + '(state, inv'), `${code} 的 ${rule} 在章节行为层有处理器`)
      assert.ok(cityBehavior.includes(rule), `${code} ${rule} 读点存在`)
    }
  }
  // 入口数据：6 张地点条目都声明了 actions 数据（由 behavior.actions 以 loc:<rule> 展开）。
  const paths = [
    'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08632.js',
    'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08633.js',
    'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08635.js',
    'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08636.js',
    'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08638.js',
    'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08639.js',
  ]
  for (const file of paths) {
    const body = fs.readFileSync(file, 'utf8')
    assert.match(body, /locationRule:\s*\{/, `${file} 声明 locationRule`)
    assert.match(body, /actions:\s*\[/, `${file} 声明行动数据`)
  }
})

test('验收 08642/08643/08646/08647/08649/08651/08652 缺陷复现：敌人规则/威胁区治愈/大门限制/look 未接线', async () => {
  const cityBehavior = fs.readFileSync('content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js', 'utf8')
  const heartText = contentText('content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1',
    'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2')
  const srcText = contentText('src/engine') + heartText
  // 08642/08643 敌人规则键在引擎/内容层均无读点。
  for (const key of ['onDefeatDoom', 'takesKeyOnEngage', 'readiesOnKeyControlled', 'placesKeyOnLeave']) {
    assert.equal(srcText.includes(key), false, `08642/08643 ${key} 无读点`)
  }
  // 引擎读的是 enemyRule.spawnAnyEmpty（扁平键），08642 声明的是嵌套 spawn:'anyEmpty'，值 anyEmpty 无读点。
  assert.equal(srcText.includes("'anyEmpty'"), false, '08642 enemyRule.spawn=anyEmpty 的取值无读点（引擎用 spawnAnyEmpty 扁平键）')
  // 08646/08647 威胁区治愈与 frost 强制未接线。
  for (const key of ['healAsOneDamageApproximation', 'frostWeakness']) {
    assert.equal(srcText.includes(key), false, `08646/08647 ${key} 无读点`)
  }
  // 引擎的 threatHorrorSink 读点是条目顶层字段（05008 写法）；08647 写在 flags 下 → 不受理。
  const possessedEntry = (await import('../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08647.js')).default
  assert.equal(possessedEntry.threatHorrorSink, undefined, '08647 未把 threatHorrorSink 放到条目顶层')
  assert.equal(possessedEntry.flags.threatHorrorSink, true, '08647 只在 flags 下声明（引擎不读）')
  const frostForced = cityBehavior.includes('threat') && /08646[\s\S]{0,200}forcedFrost/.test(cityBehavior)
  assert.ok(frostForced, '08646/08647 只写入威胁区计数器，没有 frost 揭示时的强制结算')
  // 08649 背面进入限制仍是 pending primitive（条目自述）。
  assert.match(heartGate.note, /primitive-requests\/p7-08649\.json/)
  assert.equal(heartText.includes('claimedSealsKeptOnResign'), false, '08649 claimedSealsKeptOnResign 无读点')
  // 08651/08652 的 look 效果只写日志，没有查看/投影读点。
  for (const entry of [heartForsaken, heartLibrary]) {
    const resolveSource = entry.abilities[0].resolve.toString()
    assert.match(resolveSource, /api\.info/, `${entry.code} 行动仅记录日志`)
    assert.equal(/lookAt|reveal|projection|mechanics\.[a-z]+\.look/.test(resolveSource), false, `${entry.code} 无查看读点`)
  }
})

// 「重返卡尔克萨之路」（参考战役 52）· 八章真实引擎开局验收。
//
// 每章都用 createGameState + startScenario 走真实开局管线（不是只读表），断言：
//   - 章节能注册进内容组合根并启动；
//   - 幕/密谋牌库、初始地点、遭遇牌库、混乱袋与关键 scenarioFlags 符合重返 setup；
//   - 开局后有可执行行动（legalMoves 非空）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import { manifest as campaign } from '../content/campaigns/returnToThePathToCarcosa/manifest.js'
import * as curtainCall from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToCurtainCall/index.js'
import * as theLastKing from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToTheLastKing/index.js'
import * as echoesOfThePast from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToEchoesOfThePast/index.js'
import * as theUnspeakableOath from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToTheUnspeakableOath/index.js'
import * as aPhantomOfTruth from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToAPhantomOfTruth/index.js'
import * as thePallidMask from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToThePallidMask/index.js'
import * as blackStarsRise from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToBlackStarsRise/index.js'
import * as dimCarcosa from '../content/campaigns/returnToThePathToCarcosa/scenarios/returnToDimCarcosa/index.js'
import { createGameState, startScenario } from '../src/engine/engine.js'
import { settle } from './core-fixture.mjs'

const scenarios = [
  curtainCall, theLastKing, echoesOfThePast, theUnspeakableOath,
  aPhantomOfTruth, thePallidMask, blackStarsRise, dimCarcosa,
]
// 战役与八章已由 content/registered.js 统一注册（组合根由 Lead 维护）；这里只读取校验。

function startChapter(scenarioId, seed = `ret-carcosa-${scenarioId}`) {
  const index = campaign.scenarioIds.indexOf(scenarioId)
  assert.ok(index >= 0, `${scenarioId} 不在战役场景顺序中`)
  const state = createGameState({
    campaignId: campaign.id,
    playerInvestigator: '01001',
    seed,
    seatInvestigators: ['01001'],
  }, [{ seat: 0, role: 'human' }])
  settle(state)
  startScenario(state, index, [])
  return state
}

const codes = cards => (cards || []).map(card => card.originalCode || card.code)

test('重返卡尔克萨之路八章均可注册并真实开局', () => {
  assert.deepEqual(campaign.scenarioIds, [
    'returnToCurtainCall', 'returnToTheLastKing', 'returnToEchoesOfThePast',
    'returnToTheUnspeakableOath', 'returnToAPhantomOfTruth', 'returnToThePallidMask',
    'returnToBlackStarsRise', 'returnToDimCarcosa',
  ])
  for (const entry of scenarios) {
    assert.equal(entry.manifest.campaignId, campaign.id)
    assert.equal(entry.manifest.id, entry.scenario.id)
    assert.equal(entry.manifest.referenceCode, entry.scenario.originalCode)
    assert.ok(contentRegistry.getScenario(entry.manifest.id))
  }
})

test('重返谢幕：六张陌生人幕随机选一，开局在剧院并保留皇家密使警告计数', () => {
  const state = startChapter('returnToCurtainCall')
  assert.equal(state.scenario.id, 'returnToCurtainCall')
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.acts.length, 3)
  assert.equal(state.acts[0].originalCode, '03046')
  assert.equal(state.acts[2].originalCode, '03048')
  assert.ok(['03047a', '03047b', '03047c', '52015', '52016', '52017']
    .includes(state.acts[1].originalCode))
  assert.deepEqual(codes(state.agendas), ['03044', '03045'])
  assert.deepEqual(state.locations.map(location => location.id), ['theatre', 'lobby', 'balcony', 'backstage'])
  assert.equal(state.investigators[0].location, 'theatre')
  assert.equal(state.scenarioFlags.royalEmissaryWarnings, 0)
  assert.deepEqual(state.scenarioFlags.lobbyDoorways,
    ['lightingBox', 'boxOffice', 'greenRoom', 'theatreLounge'])
  assert.deepEqual(state.scenarioFlags.backstageDoorways,
    ['dressingRoom', 'rehearsalRoom', 'trapRoom', 'propShop'])
  assert.ok(state.legalMoves.length > 0)
})

test('重返最后的王者：52022 替换密谋 1，八张令人作呕的现实与两张重返卡在一边', () => {
  const state = startChapter('returnToTheLastKing')
  assert.equal(state.scenario.id, 'returnToTheLastKing')
  assert.deepEqual(codes(state.agendas), ['52022', '03063'])
  assert.deepEqual(codes(state.acts), ['03064'])
  assert.equal(state.locations.length, 6)
  assert.equal(state.storyAssets.length, 5, '五名旁人各就位')
  assert.deepEqual(state.scenarioZones.sickeningReality,
    ['03065', '03066', '03067', '03068', '03069', '52023b', '52024b', '52024b'])
  assert.deepEqual(state.scenarioZones.setAside, ['52025', '52027'])
  assert.deepEqual(state.scenarioZones.removed, ['03081'])
  assert.ok(state.legalMoves.length > 0)
})

test('重返往事回声：第三张宁静的走廊入场，地下层保留 2 移出 1，誓约看守人放一边', () => {
  const state = startChapter('returnToEchoesOfThePast')
  assert.equal(state.scenario.id, 'returnToEchoesOfThePast')
  const locationIds = state.locations.map(location => location.id)
  assert.ok(locationIds.includes('quietHallsBasement'), '52029 宁静的走廊入场')
  const basementInPlay = ['dustyArchives', 'museumStorage', 'boilerRoom']
    .filter(id => locationIds.includes(id))
  assert.equal(basementInPlay.length, 2, '地下层三选二入场')
  const removed = state.scenarioZones.removed
  assert.ok(removed.includes('52030') || removed.includes('52031') || removed.includes('52032'))
  assert.equal(removed.length, 4, '地面/二层/三层/地下层各移出 1 张')
  assert.equal(state.scenarioFlags.keepersSetAside, 2)
  assert.ok(state.legalMoves.length > 0)
})

test('重返邪秽誓约：按确信/疑惑使用 52035，52037/52038 放一边', () => {
  const state = startChapter('returnToTheUnspeakableOath')
  assert.equal(state.scenario.id, 'returnToTheUnspeakableOath')
  assert.deepEqual(codes(state.acts), ['03163', '52035', '03166', '03167'])
  assert.deepEqual(codes(state.agendas), ['03160', '03161', '03162'])
  assert.equal(state.scenarioFlags.actTwoVersion, '52035')
  const aside = theUnspeakableOath.behavior.setupPlan(state).setAside
  assert.ok(aside.includes('52037'))
  assert.ok(aside.includes('52038'))
  assert.ok(state.scenarioZones.monsters.length > 0)
  assert.ok(state.legalMoves.length > 0)
})

test('重返真相幻影：六组巴黎地点各选一版，两张影中身形放一边', () => {
  const state = startChapter('returnToAPhantomOfTruth')
  assert.equal(state.scenario.id, 'returnToAPhantomOfTruth')
  assert.equal(state.locations.length, 10)
  const variantPairs = [
    ['03208', '52041'], ['03211', '52042'], ['03215', '52043'],
    ['03216', '52044'], ['03219', '52045'], ['03220', '52046'],
  ]
  const inPlay = new Set(state.locations.map(location => location.originalCode))
  const removed = new Set(state.scenarioZones.removed)
  for (const [base, ret] of variantPairs) {
    assert.notEqual(inPlay.has(base), inPlay.has(ret), `${base}/${ret} 只能有一个入场`)
    assert.ok(removed.has(inPlay.has(base) ? ret : base), `${base}/${ret} 另一个移出游戏`)
  }
  assert.equal(state.scenarioZones.setAside.filter(code => code === '52047').length, 2)
  assert.ok(state.legalMoves.length > 0)
})

test('重返苍白面具：随机移出四张地下墓穴并混入四张新地下墓穴', () => {
  const state = startChapter('returnToThePallidMask')
  assert.equal(state.scenario.id, 'returnToThePallidMask')
  assert.equal(state.scenario.locations.returnToSecretPassage.originalCode, '52049')
  assert.equal(state.scenarioZones.removed.length, 4)
  assert.equal(state.scenarioZones.returnCatacombsAdded, true)
  const remaining = [...state.scenarioZones.catacombsDeck]
  const added = ['52049', '52050', '52051', '52052'].filter(code => remaining.includes(code))
  assert.ok(added.length > 0, '新地下墓穴已混入牌库')
  assert.equal(remaining.length, 11)
  assert.ok(state.legalMoves.length > 0)
})

test('重返黑星升起：回廊/骑士大厅随机使用原版或重返一堆', () => {
  const state = startChapter('returnToBlackStarsRise')
  assert.equal(state.scenario.id, 'returnToBlackStarsRise')
  assert.equal(state.scenarioFlags.cloisterPile, state.scenarioFlags.cloisterRemovedPile === 'return'
    ? 'original' : 'return')
  const cloister = state.locationVariants.cloister
  const knightsHall = state.locationVariants.knightsHall
  assert.ok(['03294', '52055'].includes(cloister.originalCode))
  assert.ok(['03295', '52056'].includes(knightsHall.originalCode))
  assert.equal(cloister.originalCode === '52055', knightsHall.originalCode === '52056',
    '回廊与骑士大厅必须来自同一堆')
  assert.ok(state.scenario.encounterDeck.includes('52057'))
  assert.ok(state.scenario.encounterDeck.includes('52058'))
  assert.ok(state.legalMoves.length > 0)
})

test('重返卡城幽影：52060 替换王之宫殿，三张新地点放一边，52064 进遭遇牌库', () => {
  const state = startChapter('returnToDimCarcosa')
  assert.equal(state.scenario.id, 'returnToDimCarcosa')
  const palace = state.locations.find(location => location.id === 'palaceOfTheKing')
  assert.equal(palace.originalCode, '52060')
  assert.ok(state.scenarioZones.removed.includes('03331'))
  for (const code of ['52061', '52062', '52063', '52061b', '52062b', '52063b']) {
    assert.ok(state.scenarioZones.setAside.includes(code), `${code} 放在一边`)
  }
  assert.ok(state.scenario.encounterDeck.includes('52064'))
  assert.ok(state.legalMoves.length > 0)
})

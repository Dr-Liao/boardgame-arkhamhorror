// 「重返卡尔克萨之路」· 章节结局、战役记录与存档往返验收。
//
// 白盒部分直接调用章节 behavior.resolution（与引擎结算同一入口）验证记录一致性：
// 每章写入的键必须落在战役 recordSchema 内，且关键分支记录与基础战役口径一致。
// 黑盒部分用真实引擎开局 + JSON 存档往返（migrateState / validateMove / applyMove）。
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
import { applyMove, createGameState, decisionSeat, legalMoves, startScenario, validateMove } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'
import { settle } from './core-fixture.mjs'

const entries = {
  returnToCurtainCall: curtainCall,
  returnToTheLastKing: theLastKing,
  returnToEchoesOfThePast: echoesOfThePast,
  returnToTheUnspeakableOath: theUnspeakableOath,
  returnToAPhantomOfTruth: aPhantomOfTruth,
  returnToThePallidMask: thePallidMask,
  returnToBlackStarsRise: blackStarsRise,
  returnToDimCarcosa: dimCarcosa,
}

function startChapter(scenarioId) {
  const index = campaign.scenarioIds.indexOf(scenarioId)
  const state = createGameState({
    campaignId: campaign.id,
    playerInvestigator: '01001',
    seed: `ret-carcosa-records-${scenarioId}`,
    seatInvestigators: ['01001'],
  }, [{ seat: 0, role: 'human' }])
  settle(state)
  startScenario(state, index, [])
  return state
}

// 章节 resolution 的引擎签名是 (state, key, events, api)；测试提供最小 api 桩。
const stubApi = {
  addTrauma: () => {},
  trauma: () => {},
  choose: request => request.options?.[0]?.id,
  horror: () => {},
  damage: () => {},
  info: () => {},
  clearDoom: () => {},
  spawn: () => null,
  place: () => {},
  advanceAct: () => {},
  advanceAgenda: () => {},
  spawnStoryAsset: () => null,
  random: () => 0,
  shuffle: list => [...list],
}

function recordsWrittenBy(state, entry, key) {
  const before = JSON.parse(JSON.stringify(state.campaign.records || {}))
  entry.behavior.resolution(state, key, [], stubApi)
  const after = state.campaign.records || {}
  return Object.keys(after).filter(name => JSON.stringify(after[name]) !== JSON.stringify(before[name]))
}

const RECORD_KEYS = new Set(Object.keys(campaign.recordSchema))

test('八章结局写入的战役记录都在基础战役 recordSchema 内', () => {
  const cases = [
    ['returnToCurtainCall', ['noResolution', 'r1', 'r2']],
    ['returnToTheLastKing', ['noResolution', 'r1', 'r2', 'r3']],
    ['returnToEchoesOfThePast', ['noResolution', 'r1', 'r2', 'r3', 'r4']],
    ['returnToTheUnspeakableOath', ['noResolution', 'r1', 'r2', 'r3']],
    ['returnToAPhantomOfTruth', ['noResolution', 'r1', 'r2', 'r3']],
    ['returnToThePallidMask', ['noResolution', 'r1', 'r2']],
    ['returnToBlackStarsRise', ['noResolution', 'r1', 'r2', 'r3']],
    ['returnToDimCarcosa', ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5']],
  ]
  for (const [scenarioId, resolutionKeys] of cases) {
    const entry = entries[scenarioId]
    assert.deepEqual(Object.keys(entry.scenario.resolutions), resolutionKeys,
      `${scenarioId} 的结局键必须与基础章节一致`)
    for (const key of resolutionKeys) {
      const state = startChapter(scenarioId)
      const written = recordsWrittenBy(state, entry, key)
      for (const record of written) {
        assert.ok(RECORD_KEYS.has(record), `${scenarioId}/${key} 写入了未声明的记录 ${record}`)
      }
    }
  }
})

test('重返谢幕结局记录与基础战役口径一致（确信/疑惑、追踪陌生人、苍白面具携带者）', () => {
  const state = startChapter('returnToCurtainCall')
  state.scenarioFlags.stoleFromBoxOffice = true
  state.scenarioFlags.boxOfficeUsed = true
  curtainCall.behavior.resolution(state, 'r1', [], stubApi)
  const records = state.campaign.records
  assert.equal(records.theStrangerIsOnToYou, true)
  assert.equal(records.youTriedToWarnThePolice, true)
  assert.equal(records.thePoliceAreSuspiciousOfYou, true)
  assert.equal(records.conviction, 1)
  assert.equal(records.chasingTheStranger, 2)
  assert.equal(records.pallidMaskBearer, state.campaign.investigators[0].id)
  assert.ok(state.campaign.investigators[0].deck.includes('03059'))
})

test('重返邪秽誓约 r2 记录「逃离时遭袭」并结算丹尼尔状态', () => {
  const state = startChapter('returnToTheUnspeakableOath')
  theUnspeakableOath.behavior.resolution(state, 'r2', [], stubApi)
  assert.equal(state.campaign.records.theInvestigatorsWereAttackedAsTheyEscapedTheAsylum, true)
  assert.equal(state.campaign.records.danielStatus, 'didNotSurvive')
})

test('重返往事回声 r1 拿走缟玛瑙扣环并增加确信', () => {
  const state = startChapter('returnToEchoesOfThePast')
  echoesOfThePast.behavior.resolution(state, 'r1')
  const records = state.campaign.records
  assert.equal(records.youTookTheOnyxClasp, true)
  assert.ok(records.conviction >= 1)
})

test('重返苍白面具 r2 记录「知道门扉位置」并加入石板标记', () => {
  const state = startChapter('returnToThePallidMask')
  thePallidMask.behavior.resolution(state, 'r2')
  assert.equal(state.campaign.records.youKnowTheSiteOfTheGate, true)
  assert.equal(state.campaign.chaosBag.filter(token => token === 'tablet').length,
    state.chaosBag.filter(token => token === 'tablet').length)
})

test('重返黑星升起 r1 记录「开启下方之路」', () => {
  const state = startChapter('returnToBlackStarsRise')
  blackStarsRise.behavior.resolution(state, 'r1')
  assert.equal(state.campaign.records.youOpenedThePathBelow, true)
})

test('重返卡城幽影 r1 记录「阻止哈斯塔逃出牢狱」', () => {
  const state = startChapter('returnToDimCarcosa')
  dimCarcosa.behavior.resolution(state, 'r1')
  assert.equal(state.campaign.records.theInvestigatorsPreventedHasturFromEscapingHisPrison, true)
})

test('重返谢幕开局存档 JSON 往返后可继续合法行动并重放一致', () => {
  const state = startChapter('returnToCurtainCall')
  const moves = legalMoves(state)
  assert.ok(moves.length > 0)
  const seat = decisionSeat(state)
  for (const move of moves) assert.equal(validateMove(state, seat, move), null, JSON.stringify(move))

  // 存档往返：save-migration 的标准形状（纯 JSON）+ 迁移入口。
  const restored = migrateState(JSON.parse(JSON.stringify(state)))
  assert.deepEqual(restored.changes, [])
  assert.deepEqual(legalMoves(restored.state).map(move => JSON.stringify(move)).sort(),
    moves.map(move => JSON.stringify(move)).sort())

  // 同一行动在原状态与往返存档上产生相同结果。
  const move = moves.find(candidate => candidate.action === 'move') || moves[0]
  applyMove(state, seat, move)
  applyMove(restored.state, seat, move)
  assert.equal(restored.state.revision, state.revision)
  assert.deepEqual(restored.state.locations.map(location => location.id).sort(),
    state.locations.map(location => location.id).sort())
  assert.deepEqual(restored.state.scenarioFlags, state.scenarioFlags)
  assert.equal(restored.state.scenario.id, state.scenario.id)
})

test('重返卡城幽影注册清单带 52060 参考卡与完整 record 读写声明', () => {
  const manifest = contentRegistry.getScenario('returnToDimCarcosa')
  assert.equal(manifest.referenceCode, '52059')
  assert.ok(manifest.recordReads.includes('youOpenedThePathBelow'))
  assert.ok(manifest.recordWrites.includes('knowTheSecret'))
})

test('520xx 单卡条目已注册并带有本章 behavior 会读取的规则字段', async () => {
  const { nonPlayerEntryFor } = await import('../src/cards/encounter-abilities.js')
  const expectations = [
    ['52023', entry => entry.enemyRule?.afterParleyMoveToward === true],
    ['52024', entry => entry.enemyScript?.encounterAction && entry.enemyRule?.parleyDifficulty === 4],
    ['52025', entry => entry.assetRule?.blocksCluesHere === true],
    ['52026', entry => entry.assetRule?.blocksParleyHere === true],
    ['52033', entry => entry.enemyRule?.conditionalHunter === 'actAheadOfAgenda'],
    ['52053', entry => entry.enemyScript?.onHunterMove && entry.enemyRule?.hunterWhenNoInvestigatorWithin === 2],
    ['52055', entry => entry.locationRule?.parley?.remember === '找到塔楼的钥匙'],
    ['52056', entry => entry.locationRule?.parley?.remember === '找到了一个向导'],
    ['52066', entry => entry.treacheryRule?.test?.skill === 'willpower'],
    ['52069', entry => entry.enemyRule?.lowSanitySwap?.threshold === 4],
  ]
  for (const [code, check] of expectations) {
    const entry = nonPlayerEntryFor(code)
    assert.ok(entry, `${code} 未注册为遭遇条目`)
    assert.equal(entry.code, code)
    assert.ok(check(entry), `${code} 条目字段不符合 behavior 读点`)
  }
})


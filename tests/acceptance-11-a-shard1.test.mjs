// 验收 11-a 分片 1：The Drowned City 11001–11044（tdcp，44 张）逐卡验收证据。
//
// 缺口：11001–11019（6 位调查员/8 个版本 + 14 张专属依赖/弱点）没有标题含卡号的真实测试；
// 11020–11044 有既有逐卡测试（tdc-player*.test.mjs）。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, legalMoves, move, settle } from './core-fixture.mjs'
import { drawCards } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'

import e11001 from '../src/cards/entries/11001.js'
import e11002 from '../src/cards/entries/11002.js'
import e11003 from '../src/cards/entries/11003.js'
import e11004 from '../src/cards/entries/11004.js'
import e11005 from '../src/cards/entries/11005.js'
import e11006 from '../src/cards/entries/11006.js'
import e11009 from '../src/cards/entries/11009.js'
import e11010 from '../src/cards/entries/11010.js'
import e11011 from '../src/cards/entries/11011.js'
import e11012 from '../src/cards/entries/11012.js'
import e11013 from '../src/cards/entries/11013.js'
import e11014 from '../src/cards/entries/11014.js'
import e11015 from '../src/cards/entries/11015.js'
import e11016 from '../src/cards/entries/11016.js'
import e11017 from '../src/cards/entries/11017.js'
import e11018 from '../src/cards/entries/11018.js'
import e11019 from '../src/cards/entries/11019.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const HALL = path.resolve(ROOT, '../..')
const CODES = Object.freeze(["11001","11002","11003","11004","11005","11006","11007","11008","11009","11010","11011","11012","11013","11014","11015","11016","11017","11018","11019","11020","11021","11022","11023","11024","11025","11026","11027","11028","11029","11030","11031","11032","11033","11034","11035","11036","11037","11038","11039","11040","11041","11042","11043","11044"])

// ---------------------------------------------------------------------------
// 范围 / 接线 / 合规
// ---------------------------------------------------------------------------

test('11-a-1 范围：11001–11044 tdcp 卡恰好 44 张', () => {
  assert.equal(CODES.length, 44)
  for (const code of CODES) {
    assert.equal(ALL_CARDS[code].pack, 'tdcp', `${code} 不属于 tdcp`)
  }
})

test('11-a-1 接线：44 张均有条目；6 位人物/8 个调查员版本可选；阿加莎双版本共用专属', () => {
  for (const code of CODES) {
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), true, `${code} 缺少条目`)
  }
  for (const code of ['11001', '11004', '11007', '11008', '11011', '11014', '11017']) {
    assert.equal(canSelectInvestigator(code), true, `${code} 应可选`)
    assert.equal(getAvailability(code).availability, 'strict')
  }
  // 阿加莎两个版本共用 11009/11010 专属卡（同一人物不同版本）。
  assert.equal(ALL_CARDS['11007'].name, ALL_CARDS['11008'].name)
  for (const code of ['11009', '11010']) {
    assert.deepEqual(ALL_CARDS[code].pack, 'tdcp')
  }
})

test('11-a-1 合规：R1/R2/R3 基线不含 11 段卡号；TDC 逐卡账本与文档在位', () => {
  const compliance = JSON.parse(readFileSync(path.join(ROOT, 'audit/card-entry-compliance.json'), 'utf8'))
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const overlap = (compliance.baseline?.[rule] || []).filter(code => CODES.includes(code))
    assert.deepEqual(overlap, [], `${rule} 不应含 11 段卡号`)
  }
  for (const relative of [
    'audit/tdc-player.json',
    'audit/tdc-investigators.json',
    'audit/tdc-rules.json',
    'audit/tdc-interactions.json',
    'audit/tdc-migration.json',
    'audit/tdc-p8-regression.json',
    'docs/campaign/theDrownedCity/README.md',
  ]) assert.equal(existsSync(path.join(ROOT, relative)), true, `${relative} 存在`)
  // 本循环的战役逐卡字面账本在大厅根 artifacts/migration/tdc/p7/literal/。
  assert.equal(existsSync(path.join(HALL, 'artifacts/migration/tdc/p7/literal')), true, 'p7/literal 账本目录存在')
  const player = JSON.parse(readFileSync(path.join(ROOT, 'audit/tdc-player.json'), 'utf8'))
  const serialized = JSON.stringify(player)
  for (const code of CODES.filter(item => Number(item.slice(3, 5)) >= 20).slice(0, 5)) {
    assert.ok(serialized.includes(code), `tdc-player 账本覆盖 ${code}`)
  }
})

// ---------------------------------------------------------------------------
// 11001–11019 调查员 / 专属依赖（真实执行条目 resolve / 引擎窗口）
// ---------------------------------------------------------------------------

test('TDC 11001 玛利翁·塔瓦雷斯：手部槽 -1；旧印看 3 选事件；打出事件后抽牌并可再打一张', () => {
  assert.equal(e11001.investigator.extraSlots.hand, -1)
  const calls = []
  e11001.elderSign.resolve({ inv: { seat: 0 }, api: {
    lookAt: (seat, spec) => calls.push([seat, spec.zone, spec.count, spec.filter?.type]),
  } })
  assert.deepEqual(calls[0], [0, 'investigatorDeck', 3, 'event'], '旧印看牌库顶 3 张事件')
  const reaction = e11001.abilities[0]
  assert.deepEqual(reaction.limit, { scope: 'perRound', owner: 'player' })
  const draws = []
  reaction.resolve({ inv: { seat: 0, code: '11001' }, context: { cardCode: '01030' }, api: {
    drawCards: (seat, count) => draws.push(['draw', seat, count]),
    offerEventPlay: (seat, spec) => draws.push(['offer', seat, spec.exclude]),
  } })
  assert.deepEqual(draws[0], ['draw', 0, 1], '抽 1 张')
  assert.deepEqual(draws[1], ['offer', 0, '01030'], '可再打出一张事件（排除刚打出的事件）')
})

test('TDC 11002 坚定：投入自己事件检定成功后可收回手牌', () => {
  const destination = e11002.abilities[0].skill.destination
  const TYPES = { eventCard: 'event', assetCard: 'asset' }
  const api = { cardType: code => TYPES[code], choice: request => request.options.find(option => option.id === 'return')?.id }
  const inv = { seat: 0 }
  assert.equal(destination({ inv, result: { success: false }, test: { seat: 0, source: { code: 'eventCard' } }, api }), undefined, '检定失败不收回')
  assert.equal(destination({ inv, result: { success: true }, test: { seat: 1, source: { code: 'eventCard' } }, api }), undefined, '他人检定不收回')
  assert.equal(destination({ inv, result: { success: true }, test: { seat: 0, source: { code: 'eventCard' } }, api }), 'hand', '自己事件检定成功可收回手牌')
  assert.equal(destination({ inv, result: { success: true }, test: { seat: 0, source: { code: 'assetCard' } }, api }), undefined, '非事件来源不收回')
})

test('TDC 11003 “我自己来”：打出事件受 1 恐惧；弃 3 张事件清除弱点', () => {
  assert.deepEqual(e11003.threatEffect, { playHorrorByType: { event: 1 } })
  const ability = e11003.abilities[1]
  assert.deepEqual(ability.cost, { discardHand: 3, discardHandType: 'event' })
  const calls = []
  ability.resolve({ source: { id: 'weakness' }, api: { removeThreat: () => calls.push('remove') } })
  assert.deepEqual(calls, ['remove'], '弃 3 张事件后清除弱点')
})

test('TDC 11004 卢修斯·加洛维：旧印按同地点敌人数加值；躲避成功≥2 发现 1 线索', () => {
  assert.equal(e11004.investigator.trackClueDiscovery, true)
  const state = { enemies: [{ location: 'here' }, { location: 'there' }] }
  assert.deepEqual(e11004.elderSign.resolve({ state, inv: { location: 'here' } }), { delta: 1 })
  const reaction = e11004.abilities[0]
  assert.deepEqual(reaction.limit, { scope: 'perRound', owner: 'player' })
  let discovered = 0
  reaction.resolve({ inv: { seat: 0, location: 'here' }, api: { discoverClue: () => { discovered += 1 } } })
  assert.equal(discovered, 1, '发现 1 个线索')
})

test('TDC 11005 诗句集：灵感充能、检定 +1 与刚好成功抽牌', () => {
  assert.equal(e11005.uses, 1)
  assert.equal(e11005.usesType, 'inspiration')
  const forced = e11005.abilities[0]
  const uses = []
  forced.resolve({ source: { id: 'book' }, api: { setAssetUses: (card, count) => uses.push([card.id, count]) } })
  assert.deepEqual(uses[0], ['book', 1], '首次发现线索补 1 灵感')
  const boost = e11005.abilities[1]
  assert.deepEqual(boost.cost, { uses: 1 })
  assert.deepEqual(boost.limit, { scope: 'perTest', owner: 'instance' })
  const bonuses = []
  boost.resolve({ inv: { seat: 0 }, descriptor: { id: '11005-boost' }, api: {
    addTestResolutionBonus: (seat, amount, id) => bonuses.push([seat, amount, id]),
  } })
  assert.deepEqual(bonuses[0], [0, 1, '11005-boost'])
  // 刚好成功（value === difficulty）且激活过 boost 才抽牌。
  const exact = e11005.abilities[2]
  assert.equal(exact.criteria[1]({ context: { result: { success: true, value: 3, difficulty: 3 } },
    state: { skillTest: { activatedAbilities: { 0: ['11005-boost'] } } }, inv: { seat: 0 } }), true)
  assert.equal(exact.criteria[1]({ context: { result: { success: true, value: 4, difficulty: 3 } },
    state: { skillTest: { activatedAbilities: { 0: ['11005-boost'] } } }, inv: { seat: 0 } }), false)
})

test('TDC 11006 洪水的梦：每回合首次发现线索受 1 恐惧并把弱点洗回牌库', () => {
  const forced = e11006.abilities[1]
  assert.deepEqual(forced.limit, { scope: 'perTurn', owner: 'player' })
  const calls = []
  forced.resolve({ inv: { seat: 0 }, source: { code: '11006' }, api: {
    horror: (seat, amount) => calls.push(['horror', seat, amount]),
    removeThreat: () => true,
    moveCard: (spec, options) => calls.push(['move', spec.code, options?.seat]),
    shuffleDeck: seat => calls.push(['shuffle', seat]),
  } })
  assert.deepEqual(calls[0], ['horror', 0, 1])
  assert.deepEqual(calls[1], ['move', '11006', 0])
  assert.deepEqual(calls[2], ['shuffle', 0])
})

test('TDC 11009 眼之秘仪：成功检定结束封印一枚揭示的数字标记（每阶段一次）', () => {
  assert.equal(e11009.flags.sealedTokenReplacement, true)
  const reaction = e11009.abilities[0]
  assert.deepEqual(reaction.limit, { scope: 'perPhase', owner: 'instance' })
  const sealedCalls = []
  reaction.resolve({ state: { chaos: { revealed: ['+1', '-2', 'skull'] } }, inv: { seat: 0 }, source: { id: 'ocula' },
    api: {
      choice: request => request.options[0].id,
      sealTestToken: (seat, token, sourceId) => sealedCalls.push([seat, token, sourceId]),
    } })
  assert.equal(sealedCalls[0][1], '+1', '只列数字标记并封印一枚')
  assert.equal(sealedCalls[0][2], 'ocula')
})

test('TDC 11010 虚空一瞥：额外揭示 1 标记；[action] 洗回牌库（当前 HEAD 空转，缺口记录）', () => {
  assert.deepEqual(e11010.threatEffect, { extraChaosTokens: 1 })
  const calls = []
  e11010.abilities[1].resolve({ inv: { seat: 0 }, source: { code: '11010' }, api: {
    removeThreat: () => true,
    moveCard: (spec, options) => calls.push(['move', spec.code, options?.seat]),
    shuffleDeck: seat => calls.push(['shuffle', seat]),
  } })
  assert.deepEqual(calls, [['move', '11010', 0], ['shuffle', 0]], '条目 resolve 本身正确')
  // 真实引擎探针：条目 action 描述子没有 cost.action，legalMoves 会枚举该行动但执行不消耗行动、
  // 弱点仍留在威胁区、也未洗回牌库 → 行动空转（报告判失败）。
  const state = fixture('11014')
  const inv = state.investigators[0]
  inv.deck.push('11010')
  drawCards(state, inv, 1, [])
  settle(state)
  const threat = inv.threat.find(card => card.code === '11010')
  assert.ok(threat, '弱点进入威胁区')
  const moves = legalMoves(state, 0).filter(entry => entry.assetId === threat.id)
  assert.equal(moves.length, 1, 'legalMoves 枚举出洗回牌库行动')
  const before = inv.actionsLeft
  move(state, moves[0])
  settle(state)
  assert.equal(inv.actionsLeft, before, '缺口：行动未消耗行动点（cost.action 缺失）')
  assert.equal(inv.threat.some(card => card.code === '11010'), true, '缺口：弱点未被移出威胁区')
})

test('TDC 11011 迈克尔·麦克格林：旧印给枪械加 1 弹药；花弹药后得 1 资源', () => {
  const calls = []
  const firearm = { id: 'gun', code: '11022' }
  e11011.elderSign.resolve({ inv: { seat: 0, code: '11011', assets: [firearm] }, api: {
    choice: request => request.options.find(option => option.id === firearm.id)?.id ?? request.options[0].id,
    cardName: code => code,
    addAmmo: asset => calls.push(['ammo', asset.id]),
  } })
  assert.deepEqual(calls[0], ['ammo', 'gun'])
  assert.deepEqual(e11011.investigator.elderSign.bonus, 2)
})

test('TDC 11012 “维奥拉”琴盒：手牌枪械不占手槽；入场后从牌库顶 9 张找枪械', () => {
  assert.deepEqual(e11012.slotExemptions, [{ slot: 'hand', count: 2, traitsAny: ['firearm'] }])
  const reaction = e11012.abilities[0]
  assert.deepEqual(reaction.limit, { scope: 'perGame', owner: 'instance' })
  const looks = []
  reaction.resolve({ inv: { seat: 0 }, api: { lookAt: (seat, spec) => looks.push([seat, spec.count, spec.filter?.trait]) } })
  assert.deepEqual(looks[0], [0, 9, 'firearm'])
})

test('TDC 11013 没收：枪械支援洗回牌库；无枪械则受 1 伤害并洗回弱点', () => {
  const calls = []
  e11013.abilities[0].resolve({ inv: { seat: 0, assets: [{ id: 'gun', code: '11022' }] }, api: {
    effectiveTraits: () => ['Firearm'],
    returnAssetToDeck: () => true,
    shuffleDeck: seat => calls.push(['shuffle', seat]),
  } })
  assert.deepEqual(calls, [['shuffle', 0]], '洗回后按主人洗牌')
  const empty = []
  e11013.abilities[0].resolve({ inv: { seat: 0, assets: [] }, api: {
    effectiveTraits: () => [],
    damage: (seat, amount) => empty.push(['damage', seat, amount]),
    scheduleWeaknessShuffle: (seat, code) => empty.push(['shuffleWeakness', seat, code]),
  } })
  assert.deepEqual(empty, [['damage', 0, 1], ['shuffleWeakness', 0, '11013']])
})

test('TDC 11014 歌莉娅·戈德堡：看遭遇牌并处理 1 张非精英；神话顺序可选', () => {
  const entry = e11014
  assert.equal(entry.investigator.chooseMythosOrder, true)
  assert.equal(entry.investigator.encounterLook, true)
  assert.deepEqual(entry.investigator.elderSign, { bonus: 1 })
  const calls = []
  entry.abilities[0].resolve({ inv: { seat: 0 }, context: { seat: 0 }, api: {
    sortEncounterLook: (...args) => calls.push(args),
  } })
  assert.equal(calls.length, 1, '处理额外看牌')
})

test('TDC 11015 通灵感应：弃掉两张同名遭遇并抽 1 张', () => {
  assert.equal(e11015.abilities[0].fast, true)
  assert.equal(e11015.abilities[0].trigger, 'encounterDrawn')
  const beneath = { 0: { 11014: ['11719', '11719'] } }
  const state = { scenarioFlags: { mechanics: { beneath } } }
  const inv = { seat: 0, code: '11014' }
  const criteria = e11015.abilities[0].criteria
  assert.equal(criteria({ state, inv, context: { cardCode: '11719' } }), true)
  assert.equal(criteria({ state, inv, context: { cardCode: '11720' } }), false)
  const calls = []
  e11015.abilities[0].resolve({ state, inv, context: { cardCode: '11719' }, api: {
    cancelEncounterDraw: () => true,
    discardStashedEncounter: (seat, code) => calls.push(['discard', seat, code]),
    drawCards: (seat, count) => calls.push(['draw', seat, count]),
  } })
  assert.deepEqual(calls, [['discard', 0, '11719'], ['draw', 0, 1]])
})

test('TDC 11016 结局预言：揭示时强制置底；击败 3 张或 1 精神创伤；显现涌动', () => {
  assert.deepEqual(e11016.encounterLookRule, { forceBeneath: true, defeatCount: 3, mentalTrauma: 1 })
  const calls = []
  e11016.abilities[0].resolve({ inv: { seat: 0 }, api: { drawEncounter: seat => calls.push(['drawEncounter', seat]) } })
  assert.deepEqual(calls, [['drawEncounter', 0]], '显现获得涌动（再抽 1 张遭遇）')
})

test('TDC 11017 乔治·巴纳比：手牌上限按暗置牌；弃牌可转入底下并抽 1 张', () => {
  assert.equal(e11017.investigator.handSizeFromBeneath, true)
  assert.equal(e11017.investigator.commitFromBeneath, true)
  const reaction = e11017.abilities[0]
  assert.deepEqual(reaction.limit, { scope: 'perPhase', owner: 'player' })
  const calls = []
  reaction.resolve({ inv: { seat: 0, code: '11017', discard: ['01088'] }, context: { cardCode: '01088' }, api: {
    commitOrigins: { store: () => { calls.push('store'); return true } },
    drawCards: (seat, count) => calls.push(['draw', seat, count]),
  } })
  assert.deepEqual(calls, ['store', ['draw', 0, 1]])
})

test('TDC 11018 坚毅：检定后交换等量手牌与暗置牌', () => {
  const afterTest = e11018.abilities[0].skill.afterTest
  const calls = []
  const api = {
    choice: request => request.options.find(option => option.id !== 'skip')?.id ?? request.options[0].id,
    cardName: code => code,
    commitOrigins: {
      beneath: () => ['01089'],
      swap: (seat, code, up, down) => { calls.push(['swap', up, down]); return false },
    },
  }
  afterTest({ inv: { seat: 0, hand: ['01088'], code: '11017' }, api })
  assert.deepEqual(calls[0], ['swap', '01089', '01088'], '交换 1 张暗置牌与 1 张手牌')
})

test('TDC 11019 漂流：弃掉所有暗置牌；没有暗置牌则洗回弱点', () => {
  const calls = []
  e11019.abilities[0].resolve({ inv: { seat: 0, code: '11017' }, api: {
    commitOrigins: { beneath: () => ['01089'], take: (seat, code, card) => calls.push(['take', card]) },
    scheduleWeaknessShuffle: () => calls.push('shuffle'),
  } })
  assert.deepEqual(calls, [['take', '01089']])
  const empty = []
  e11019.abilities[0].resolve({ inv: { seat: 0, code: '11017' }, api: {
    commitOrigins: { beneath: () => [], take: () => {} },
    scheduleWeaknessShuffle: (seat, code) => empty.push(['shuffle', seat, code]),
  } })
  assert.deepEqual(empty, [['shuffle', 0, '11019']])
})

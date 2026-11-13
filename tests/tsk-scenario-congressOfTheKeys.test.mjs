// 钥匙议会（congressOfTheKeys · 09694 · 通古斯卡终章）章节测试（P7）。
//
// 三层证据：
//   1. 章节装配 —— manifest（11 地点 / 6 张幕（4 张成牌库）/ 3 密谋 / 2 结局）、正文可读、
//      四档混乱标记表、遭遇组与机制声明；
//   2. 章节机械 —— 审判计票（三种结论与三个设置版本）、布置（圣堂/巢穴面、同谋、密钥登记）、
//      异界终局（三张高塔 + 残骸之城迷你卡序列）、绯红密钥判给与变换、空洞与存在抹除、
//      幕/密谋推进、地点规则、拟态克星、JSON 往返（真实 tsk 原语容器校验）；
//   3. 单卡条目 —— 专属组唯一敌人 09715 的可执行声明（趁乱攻击/每调查员生命值/受伤揭示读点）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { playCostDelta } from '../src/engine/modifiers.js'
import * as tskKeys from '../src/engine/tsk-scarlet-keys.js'
import * as tskConcealed from '../src/engine/tsk-concealed.js'
import * as tskHollow from '../src/engine/tsk-hollow.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/index.js'
import {
  ACT1_VERSIONS, ACT_CARDS, CHAPTER_ENTRY_CODES, CONGRESS_KEYS, COTERIE_MEMBERS, ENCOUNTER_DECK, GATHER_GROUPS,
  LOCATIONS, LOCATION_RULES, OTHERWORLD_LOCATION_CODES, RAW_CODES, RECORD_READS, RECORD_WRITES, RED_GLOVED_MAN,
  SET_ASIDE_CODES, SET_ASIDE_LOCATION_CODES, TOWER_LOCATION_IDS, TRIAL_OUTCOME_RECORDS, clueValueOf, scenario,
} from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js'
import {
  applyKeyAwards, behavior, chapterState, chapterSummary, computeKeyAwards, computeTrial, congressPlayCost,
  connectPlacedLocations, ensureCongressKeys, enterClimb, enterOutside, enterVertex,
  eraseHollows, evenPlacements, exposeAt, hasRecord, hideAllConcealed, hollowCommittedCards, keyReliquaryShroud,
  markChapterCompleted, miniCardsAt, otherworldDeckOf, resolveKeyShift, revealMiniCardKeep, setKeyHeld,
  setupLocations, shadowLocationsOf, shiftKeysHeldBy, trialInputs, vertexUnlocked, voteTable,
} from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/behavior.js'
import {
  CONGRESS_TOKEN_MEANINGS, congressAfterTest, congressChaosToken, currentActNumber, readyOutsiderHere,
} from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/chaos.js'

// ---------------------------------------------------------------------------
// 条目注册（真实注册期校验：未知字段/未知 kind/未知窗口都会在这里失败）
// ---------------------------------------------------------------------------
const ENTRIES = []
for (const code of CHAPTER_ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/congressOfTheKeys/${code}.js`)
  ENTRIES.push(module.default)
}
// 密钥面条目落在各自章节目录（本章只读 assetRule.keyShift / assetRule.shift / flags.shiftEffect）。
for (const path of ['onThinIce/09634a.js', 'onThinIce/09634b.js', 'sanguineShadows/09565a.js', 'sanguineShadows/09565b.js',
  'deadHeat/09544a.js', 'deadHeat/09544b.js']) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/${path}`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => JSON.parse(JSON.stringify(value))
const START = 'scarletHallsLair'

// ---------------------------------------------------------------------------
// 状态与 api 桩（TSK 原语用真实模块；剧本运行时用窄桩）
// ---------------------------------------------------------------------------
function stateFor(count = 2, { difficulty = 'standard', seed = 20261111, records = {} } = {}) {
  return {
    scenario: clone(scenario),
    acts: clone([ACT1_VERSIONS[1], ...scenario.acts.slice(1)]),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    numInvestigators: count,
    difficulty,
    round: 1,
    currentSeat: 0,
    doom: 0,
    rngState: seed,
    status: 'playing',
    locations: [],
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: START, klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01002', '01003'], discard: [], actionsLeft: 3, defeated: false, resigned: false,
    })),
    enemies: [], setAsideEnemies: [], storyAssets: [], agendaAside: [], removedFromGame: [],
    encounterDeck: [...ENCOUNTER_DECK], encounterDiscard: [],
    scenarioZones: {}, scenarioFlags: {}, chaosBag: ['+1', '0', '-1', 'skull', 'tablet', 'elderthing'],
    campaign: {
      records: { ...records }, leadSeat: 0,
      investigators: Array.from({ length: count }, () => ({ xp: 0, earnedXp: 0, deck: [] })),
      trauma: Array.from({ length: count }, () => ({ physical: 0, mental: 0 })),
    },
    victoryDisplay: [], victory: 0,
    infos: [], testCalls: [], choices: [], finished: [], advanced: 0, spawned: [], searchCalls: [],
    drawn: [], trauma: [], defeated: [], discovered: [],
  }
}

function apiFor(state, overrides = {}) {
  const api = {
    info: text => state.infos.push(String(text)),
    choose: request => {
      const answer = state.choices.length ? state.choices.shift() : null
      if (answer != null) return answer
      return request?.options?.[0]?.id ?? null
    },
    spawn: (code, locationId, options = {}) => {
      const enemy = {
        id: `enemy-${state.enemies.length + 1}-${code}`, code, originalCode: code,
        name: ALL_CARDS[code]?.nameZh || code, location: locationId, exhausted: Boolean(options.exhausted),
        defeated: false, damageTaken: 0, engagedSeat: null,
        traits: [...(ALL_CARDS[code]?.traits || [])],
      }
      state.enemies.push(enemy)
      state.spawned.push({ code, enemyId: enemy.id, location: locationId })
      return enemy
    },
    spawnStoryAsset: (code, locationId) => {
      state.storyAssets.push({ id: `story-${code}`, code, originalCode: code, location: locationId })
      return state.storyAssets[state.storyAssets.length - 1]
    },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    payGroupClues: (amount, options = {}) => {
      let remaining = amount
      for (const inv of state.investigators) {
        if (remaining <= 0) break
        if (options.atLocation && inv.location !== options.atLocation) continue
        const paid = Math.min(remaining, Number(inv.clues) || 0)
        inv.clues -= paid
        remaining -= paid
      }
      return { paid: amount - remaining, shortfall: remaining }
    },
    advanceAct: () => { state.advanced += 1; state.actIndex += 1 },
    advanceAgenda: () => { state.agendaAdvanced = (state.agendaAdvanced || 0) + 1; state.agendaIndex += 1 },
    addDoom: amount => { state.doom = (Number(state.doom) || 0) + amount; return state.doom },
    finish: key => state.finished.push(key),
    addTrauma: (seat, kind, amount) => { state.trauma.push({ seat, kind, amount }) },
    defeatInvestigator: seat => { state.investigators[seat].defeated = true; state.defeated.push(seat) },
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    directDamage: (seat, n) => { state.investigators[seat].damage += n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n },
    damageEnemy: (enemyId, amount) => {
      const target = state.enemies.find(enemy => enemy.id === enemyId)
      if (target) target.damageTaken = (Number(target.damageTaken) || 0) + amount
    },
    removeEnemyFromGame: enemy => { state.enemies = state.enemies.filter(item => item !== enemy) },
    healDamage: (seat, n) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - n) },
    healHorror: (seat, n) => { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - n) },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => asset.id !== assetId)
    },
    exhaustAsset: asset => { asset.exhausted = true },
    discoverClue: (seat, n, locationId) => {
      const location = state.locations.find(item => item.id === locationId)
      if (!location || (Number(location.clues) || 0) < n) return false
      location.clues -= n
      state.investigators[seat].clues += n
      state.discovered.push({ seat, n, locationId })
      return true
    },
    searchTop: (seat, spec) => { state.searchCalls.push({ seat, ...spec }) },
    drawEncounter: seat => { state.drawn.push(seat) },
    locationDistance: (from, targets) => (targets.includes(from) ? 0 : 1),
    pressureEnemy: () => {},
    mechanics: {
      tsk: {
        keys: {
          initialize: specs => tskKeys.initializeScarletKeys(state, specs),
          all: () => tskKeys.scarletKeys(state),
          get: id => tskKeys.scarletKey(state, id),
          face: id => tskKeys.keyFace(state, id),
          shift: (id, options) => tskKeys.shiftKey(state, id, options),
          shiftedThisRound: (id, round) => tskKeys.keyShiftedThisRound(state, id, round),
          bind: (id, bearer) => tskKeys.bindKey(state, id, bearer),
          steal: (id, bearer) => tskKeys.stealKey(state, id, bearer),
          heldBy: bearer => tskKeys.keysHeldBy(state, bearer),
        },
        concealed: {
          miniCards: () => tskConcealed.concealedMiniCards(state),
          at: (locationId, position) => tskConcealed.concealedAt(state, locationId, position),
          distribute: spec => tskConcealed.distributeConcealed(state, spec),
          expose: id => tskConcealed.exposeMiniCard(state, id),
          setInShadows: (locationId, value) => tskConcealed.setInShadows(state, locationId, value),
          reshuffle: options => tskConcealed.reshuffleConcealed(state, options),
        },
        hollow: {
          cards: () => tskHollow.hollowCards(state),
          hollow: spec => tskHollow.hollowCard(state, spec),
          count: options => tskHollow.hollowCount(state, options),
          erase: codes => tskHollow.eraseFromExistence(state, codes),
          erased: () => tskHollow.erasedFromExistence(state),
        },
      },
    },
    ...overrides,
  }
  return api
}

const setup = (state, api, overrides = {}) => {
  const helper = { api, shuffle: list => [...list], randomValue: () => 0.5, info: () => {}, ...overrides }
  return behavior.setupLocations(state, [], helper)
}
const place = (state, id) => {
  const definition = state.scenario.locations[id]
  const instance = { ...clone(definition), id, revealed: true, clues: clueValueOf(state, id) }
  instance.maxClues = instance.clues
  state.locations.push(instance)
  return instance
}
const enemyByCode = (state, code) => state.enemies.find(enemy => (enemy.originalCode || enemy.code) === code)

// ---------------------------------------------------------------------------
// 1. 装配 / 身份 / 正文
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 清单：playable、11 地点/6 幕（4 张牌库）/3 密谋/3 结局', () => {
  assert.equal(chapter.manifest.id, 'congressOfTheKeys')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '09694')
  assert.equal(chapter.manifest.locations.length, 11)
  assert.equal(Object.keys(LOCATIONS).length, 11)
  // 幕：印刷 6 张（秘密与谎言 v.I/II/III + 登塔 + 登顶 + 最后的疏忽）；牌库只用其中一张 1a。
  assert.equal(ACT_CARDS.length, 6)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1v1', 'act2', 'act3', 'act4'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  // 印刷结局 1/2 + 引擎全灭统一结局键 noResolution（P0 修复：缺它会让全灭结算抛「未知剧本结局」）。
  assert.deepEqual(chapter.manifest.resolutionIds, ['resolution1', 'resolution2', 'noResolution'])
  assert.equal(chapter.manifest.startLocationId, 'scarletHallsSanctum')
  // 区域：三张异界高塔 + 拟态克星放在一边；遭遇牌库按版本 gather 组展开（v.II 缺省牌库）。
  const deckCodes = new Set(chapter.manifest.zones.encounterDeck.map(entry => entry.cardCode))
  assert.ok(deckCodes.size > 0, '遭遇牌库不能为空')
  for (const code of ENCOUNTER_DECK) assert.ok(deckCodes.has(code), `遭遇牌库缺 ${code}`)
  assert.deepEqual(chapter.manifest.zones.setAside.map(entry => entry.cardCode).sort(),
    [RAW_CODES.knottedTower, RAW_CODES.gravityDefyingClimb, RAW_CODES.toweringVertex, RAW_CODES.mimeticNemesis])
  assert.deepEqual(SET_ASIDE_CODES, [RAW_CODES.mimeticNemesis])
  assert.deepEqual(SET_ASIDE_LOCATION_CODES, [RAW_CODES.knottedTower, RAW_CODES.gravityDefyingClimb, RAW_CODES.toweringVertex])
  assert.deepEqual(TOWER_LOCATION_IDS, ['knottedTower', 'gravityDefyingClimb', 'toweringVertex'])
  // 机制 / 遭遇组 / 记录声明。
  assert.deepEqual(chapter.manifest.requiredMechanicIds, ['tskConcealed', 'tskScarletKeys', 'tskHollow', 'tskCoterie', 'tskMap'])
  for (const group of ['beyondTheBeyond', 'redCoterie', 'congressOfTheKeys', 'globetrotting']) {
    assert.ok(chapter.manifest.requiredEncounterGroupIds.includes(group), `缺少遭遇组 ${group}`)
  }
  for (const key of RECORD_READS) assert.ok(chapter.manifest.recordReads.includes(key), `缺少记录读 ${key}`)
  for (const key of RECORD_WRITES) assert.ok(chapter.manifest.recordWrites.includes(key), `缺少记录写 ${key}`)
  // 展示连线都在规则连接里。
  const connections = new Set(chapter.manifest.locations.flatMap(location =>
    location.connections.map(to => `${location.id}>${to}`)))
  for (const edge of chapter.layout.edges) assert.ok(connections.has(`${edge.from}>${edge.to}`), `展示连线 ${edge.from}->${edge.to} 无规则连接`)
})

test('P7 congressOfTheKeys 身份与正文：11 地点 / 6 幕 / 3 密谋都有原卡身份，正文可读', () => {
  for (const category of ['locations', 'acts', 'agendas']) {
    for (const [id, identity] of Object.entries(chapter.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺原卡号`)
      assert.ok(ALL_CARDS[identity.originalCode], `${category}/${id} 原卡不在卡表`)
    }
  }
  assert.ok(chapter.scenario.introTitle.includes('钥匙议会'))
  assert.ok(chapter.scenario.introForced.length > 100, '因时间耗尽的开场缺失')
  assert.ok(chapter.scenario.introVoluntary.length > 200, '主动前往的开场缺失')
  assert.equal(chapter.scenario.introChoices.length, 4)
  assert.ok(chapter.scenario.trialParagraphs[1].length > 50 && chapter.scenario.trialParagraphs[8].length > 50)
  assert.ok(chapter.scenario.setupVersion1.length > 200)
  assert.ok(chapter.scenario.setupVersion2.length > 200)
  assert.ok(chapter.scenario.setupVersion3.length > 200)
  for (const keyword of ['审判', '同志会', '异界', '密钥', '空洞', '混乱标记']) {
    assert.ok(chapter.scenario.specialRules.includes(keyword), `特别规则缺少 ${keyword}`)
  }
  for (const [key, text] of Object.entries(scenario.resolutions)) {
    assert.ok(String(text).length > 100, `${key} 正文缺失`)
  }
  assert.equal(scenario.resolutions.resolution1.includes('域外来客遭到阻止'), true)
  assert.equal(scenario.resolutions.resolution2.includes('特别小组成为空洞'), true)
})

test('P7 congressOfTheKeys 混乱标记：四档表、X=幕编号、[tablet] 自动失败条件', () => {
  assert.equal(CONGRESS_TOKEN_MEANINGS.easy, CONGRESS_TOKEN_MEANINGS.standard)
  assert.equal(CONGRESS_TOKEN_MEANINGS.hard, CONGRESS_TOKEN_MEANINGS.expert)
  assert.equal(CONGRESS_TOKEN_MEANINGS.standard.cultist.delta, -5)
  assert.equal(CONGRESS_TOKEN_MEANINGS.hard.cultist.delta, -7)
  assert.equal(CONGRESS_TOKEN_MEANINGS.standard.cultist.flipDelta, -2)
  assert.equal(CONGRESS_TOKEN_MEANINGS.hard.cultist.flipDelta, -4)
  assert.ok(CONGRESS_TOKEN_MEANINGS.standard.elderthing.text.includes('空洞'))
  const state = stateFor(2)
  place(state, 'scarletHallsLair')
  assert.equal(currentActNumber(state), 1)
  assert.equal(congressChaosToken(state, state.investigators[0], 'skull').delta, -1)
  state.difficulty = 'hard'
  assert.equal(congressChaosToken(state, state.investigators[0], 'skull').delta, -2)
  // [tablet]：简单/普通看「是不是对重整域外敌人的攻击」，困难/专家看本地有没有重整域外敌人。
  assert.equal(congressChaosToken(state, state.investigators[0], 'tablet').autoFail, undefined)
  state.difficulty = 'standard'
  assert.equal(congressChaosToken(state, state.investigators[0], 'tablet', { attackOutsider: true }).autoFail, true)
  state.enemies.push({ id: 'outsider1', code: '09731', originalCode: '09731', traits: ['Outsider'], exhausted: false, location: START })
  state.difficulty = 'expert'
  assert.equal(congressChaosToken(state, state.investigators[0], 'tablet').autoFail, true)
  assert.equal(readyOutsiderHere(state, state.investigators[0]), true)
  const elder = congressChaosToken(state, state.investigators[0], 'elderthing')
  assert.equal(elder.delta, -4)
  assert.equal(elder.cancelCommitted, true)
  // afterTest：投入卡空洞化的 rider（幂等）。
  const riders = congressAfterTest(state, state.investigators[0], { drawn: ['elderthing'], cancelledTokens: [] })
  assert.deepEqual(riders, ['hollowCommitted'])
  assert.deepEqual(congressAfterTest(state, state.investigators[0], { drawn: ['cultist'], cancelledTokens: [] }), ['cultistKeyFlip'])
})

// ---------------------------------------------------------------------------
// 2. 审判：计票与三种结论
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 审判：默认（无记录）赞成居多 → 判为负担 → 设置版本一', () => {
  const trial = computeTrial(trialInputs(stateFor(2)))
  assert.deepEqual(trial.tally, { nay: 2, yea: 6 })
  assert.equal(trial.judgedLiable, true)
  assert.equal(trial.decision, 'deemedALiability')
  assert.equal(trial.votes.redGlovedMan, 'eerilySilent')
  assert.equal(trial.votes.ece, 'nay')
  assert.equal(trial.votes.amaranth, 'yea')
  assert.equal(trial.votes.claretKnight, 'nay')
  assert.equal(trial.rows.length, 11)
  assert.equal(trial.steps.length, 10)
  // 结论 → 记录与版本
  assert.equal(TRIAL_OUTCOME_RECORDS.deemedALiability, 'theCellEscapedTheRedCoterie')

  const state = stateFor(2)
  const api = apiFor(state)
  behavior.preScenarioSetup(state, [], api)
  assert.equal(chapterState(state).outcome, 'deemedALiability')
  assert.equal(chapterState(state).setupVersion, 1)
  assert.equal(hasRecord(state, 'theCellEscapedTheRedCoterie'), true)
  assert.equal(Object.keys(voteTable(state)).length, 11)
  // 密钥在审判前已登记（六把）
  assert.equal((state.campaign.tsk?.keys?.keys ? Object.keys(state.campaign.tsk.keys.keys).length : 0), 6)
})

test('P7 congressOfTheKeys 审判：反对居多 → 颠覆/加入/被当作资产（版本二）', () => {
  // 让 nay 占多数并同时满足颠覆与加入条件。
  const records = {
    theCellAidedTheKnight: true, youHaventSeenTheLastOfTheClaretKnight: false,
    desiIsInYourDebt: true, alikiIsOnYourSide: true, theCellMadeADealWithThorne: true,
    theSanguineWatchersTormentContinues: true, tuwileMasaiIsOnYourSide: true,
    amaranthHasLeftTheCoterie: true, tzuSanNiangIsUnderYourSway: true,
  }
  const trial = computeTrial(trialInputs(stateFor(2, { records })))
  assert.ok(trial.tally.nay > trial.tally.yea, `nay=${trial.tally.nay} yea=${trial.tally.yea}`)
  assert.equal(trial.decision, 'vote')
  assert.equal(trial.canOverthrow, true)
  assert.equal(trial.canJoin, true)
  assert.deepEqual(trial.options.map(option => [option.id, option.available]),
    [['overthrow', true], ['join', true], ['deemedAnAsset', true]])

  const state = stateFor(2, { records })
  const api = apiFor(state)
  state.choices.push('overthrow')
  behavior.preScenarioSetup(state, [], api)
  assert.equal(chapterState(state).outcome, 'overthrow')
  assert.equal(chapterState(state).setupVersion, 2)
  assert.equal(hasRecord(state, 'theCellOverthrewTheRedCoterie'), true)

  // 加入：结论记录 theCellJoinedTheRedCoterie，版本二。
  const joinState = stateFor(2, { records })
  const joinApi = apiFor(joinState)
  joinState.choices.push('join')
  behavior.preScenarioSetup(joinState, [], joinApi)
  assert.equal(hasRecord(joinState, 'theCellJoinedTheRedCoterie'), true)
  assert.equal(chapterState(joinState).setupVersion, 2)
})

test('P7 congressOfTheKeys 审判：已知真相 / 至少 3 人诡异地沉默 → 版本三', () => {
  const knows = computeTrial(trialInputs(stateFor(2, { records: { theCellKnowsTheTrueNatureOfTheCoterie: true } })))
  assert.equal(knows.decision, 'knowsTrueNature')
  const knowsState = stateFor(2, { records: { theCellKnowsTheTrueNatureOfTheCoterie: true } })
  behavior.preScenarioSetup(knowsState, [], apiFor(knowsState))
  assert.equal(chapterState(knowsState).setupVersion, 3)
  assert.equal(hasRecord(knowsState, 'theRedCoterieSparedTheCell'), true)

  const silentRecords = {
    thorneDisappeared: true,
    youHaventSeenTheLastOfAlikiZoniUperetria: true,
    youHaventSeenTheLastOfDesiderioDelgadoAlvarez: true,
  }
  const silent = computeTrial(trialInputs(stateFor(2, { records: silentRecords })))
  assert.equal(silent.decision, 'eerilySilent')
  assert.equal(silent.votes.redGlovedMan, 'eerilySilent')
  const silentState = stateFor(2, { records: silentRecords })
  behavior.preScenarioSetup(silentState, [], apiFor(silentState))
  assert.equal(chapterState(silentState).setupVersion, 3)
  // 参考实现不写记录，卡面/指南要求记「同志会由内部被毁」；本章按指南写并披露。
  assert.equal(hasRecord(silentState, 'theRedCoterieWasDestroyedFromWithin'), true)
})

// ---------------------------------------------------------------------------
// 3. 布置：版本一 / 版本二
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 布置（版本一）：巢穴面圣所、四张移除、异界牌库、隐匿与同谋', () => {
  const state = stateFor(3)
  const api = apiFor(state)
  setup(state, api, { shuffle: list => [...list] })
  const data = chapterState(state)
  // 地点：猩红走廊（巢穴）+ 三张同志会圣所（巢穴面），共 4 座。
  assert.equal(state.locations.length, 4)
  assert.ok(state.locations.some(location => location.id === 'scarletHallsLair'))
  for (const slot of ['congressChamberLair', 'coterieLibraryLair', 'keyReliquaryLair']) {
    assert.ok(state.locations.some(location => location.id === slot), `缺少 ${slot}`)
  }
  // 连接：四座藏身处两两相连。
  const hall = state.locations.find(location => location.id === 'scarletHallsLair')
  assert.equal(hall.connections.length, 3)
  // 区域：圣堂面与高塔在放一边/移除里，但高塔不是「移除」。
  assert.deepEqual(state.scenarioZones.setAside.sort(), [RAW_CODES.knottedTower, RAW_CODES.gravityDefyingClimb,
    RAW_CODES.toweringVertex, RAW_CODES.mimeticNemesis].sort())
  assert.equal(state.scenarioZones.removed.includes(RAW_CODES.scarletHallsSanctum), true)
  assert.equal(state.scenarioZones.removed.includes(RAW_CODES.knottedTower), false)
  // 异界牌库：8 条残骸之城记录。
  assert.equal(otherworldDeckOf(state).length, OTHERWORLD_LOCATION_CODES.length)
  // 戴红手套的男子进场（隐匿 1/调查员：真身 + 3 张诱饵分布在 3 座圣所上）。
  const redGlovedMan = enemyByCode(state, RED_GLOVED_MAN)
  assert.ok(redGlovedMan, '戴红手套的男子未进场')
  assert.ok(LOCATIONS[redGlovedMan.location])
  const minis = tskConcealed.concealedMiniCards(state)
  assert.equal(minis.length, 1 + 1 * 3)
  assert.ok(minis.some(card => card.kind === 'RedGlovedMan' && !card.decoy))
  // 同志会敌人：3 位调查员 → 戴红手套的男子 + 除领队外 2 人各抽 1 张；其余洗入遭遇牌库。
  assert.equal(data.coterieInPlay.filter(entry => entry.code !== RED_GLOVED_MAN).length, 2)
  assert.equal(data.coterieInPlay.length + data.coterieIntoDeck.length,
    1 + COTERIE_MEMBERS.filter(member => member.enemyCode && data.votes[member.id] === 'yea').length)
  // 密钥：六把登记；判给数量 = 6（默认全部跳过），绑定或待绑。
  assert.equal(Object.keys(state.campaign.tsk.keys.keys).length, 6)
  const pending = data.pendingKeyAwards.length
  const awarded = data.awardedKeys.length
  assert.equal(pending + awarded, 6, `pending=${pending} awarded=${awarded}`)
  // 同谋：艾婕投反对 → 在场（09584）。
  assert.ok(data.confidants.some(entry => entry.code === '09584'))
  assert.ok(state.storyAssets.some(asset => asset.code === '09584'))
  // 起始地点：所有调查员在猩红走廊（巢穴）。
  for (const inv of state.investigators) assert.equal(inv.location, 'scarletHallsLair')
})

test('P7 congressOfTheKeys 布置（版本二/三）：圣堂面、戴红手套的男子放在一边、遭遇牌库为空', () => {
  const records = {
    theCellAidedTheKnight: true, desiIsInYourDebt: true, alikiIsOnYourSide: true,
    theCellMadeADealWithThorne: true, theSanguineWatchersTormentContinues: true,
    tuwileMasaiIsOnYourSide: true, amaranthHasLeftTheCoterie: true, tzuSanNiangIsUnderYourSway: true,
  }
  const state = stateFor(2, { records })
  const api = apiFor(state)
  state.choices.push('deemedAnAsset')
  setup(state, api, { shuffle: list => [...list] })
  assert.equal(chapterState(state).setupVersion, 2)
  assert.ok(state.locations.some(location => location.id === 'scarletHallsSanctum'))
  assert.deepEqual(state.locations.filter(location => location.id.endsWith('Lair')), [])
  assert.equal(enemyByCode(state, RED_GLOVED_MAN), undefined, '版本二不生成戴红手套的男子')
  assert.ok(state.scenarioZones.setAside.includes(RED_GLOVED_MAN))
  assert.equal(chapterState(state).coterieInPlay.length, 0, '版本二不生成赞成派的同志会敌人')
  // 版本三：诡异地沉默的成员进场。
  const silent = stateFor(2, { records: { thorneDisappeared: true, youHaventSeenTheLastOfAlikiZoniUperetria: true, youHaventSeenTheLastOfDesiderioDelgadoAlvarez: true } })
  const silentApi = apiFor(silent)
  setup(silent, silentApi, { shuffle: list => [...list] })
  assert.equal(chapterState(silent).setupVersion, 3)
  assert.ok(state.locations.length > 0)
  assert.equal(state.locations.every(location => location.id.endsWith('Sanctum')), true)
})

// ---------------------------------------------------------------------------
// 4. 异界终局：三张高塔 + 残骸之城迷你卡序列
// ---------------------------------------------------------------------------
function outsideState(count = 2, version = 1) {
  const state = stateFor(count)
  const api = apiFor(state)
  const data = chapterState(state)
  data.introResolved = true
  data.setupVersion = version
  data.votes = { beast: 'yea', amaranth: 'yea' }
  setup(state, api, { shuffle: list => [...list] })
  return { state, api }
}

test('P7 congressOfTheKeys 异界：幕 1 背面换成三张高塔，异界牌库顶 3 张进阴影', () => {
  const { state, api } = outsideState()
  const before = otherworldDeckOf(state).length
  behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.locations.length, 3)
  assert.deepEqual(state.locations.map(location => location.id), ['knottedTower', 'gravityDefyingClimb', 'toweringVertex'])
  assert.equal(otherworldDeckOf(state).length, before - 3)
  const shadows = shadowLocationsOf(state)
  assert.equal(shadows.length, 3)
  assert.deepEqual(shadows.map(entry => entry.position), ['left', 'middle', 'right'])
  // 残骸之城迷你卡（左/中/右）环绕万千纠结之塔；诱饵数 = 0（版本一）。
  const minis = miniCardsAt(state, 'knottedTower')
  assert.equal(minis.length, 3)
  assert.deepEqual(minis.map(card => card.position).sort(), ['left', 'middle', 'right'])
  assert.equal(minis.every(card => card.decoy === false), true)
  // 戴红手套的男子在塔顶。
  assert.equal(enemyByCode(state, RED_GLOVED_MAN)?.location, 'toweringVertex')
  // 调查员在塔底。
  for (const inv of state.investigators) assert.equal(inv.location, 'knottedTower')
  // 塔顶在阴影里（setInShadows）。
  assert.equal(tskConcealed.isInShadows(state, 'toweringVertex'), true)
})

test('P7 congressOfTheKeys 异界：版本二的诱饵数 = 密谋 2 上的毁灭数；幕 2/3 的迷你卡布置', () => {
  const { state, api } = outsideState(2, 2)
  state.acts[0] = clone(ACT1_VERSIONS[2])
  state.doom = 3
  behavior.actReveal(state, state.acts[0], api)
  assert.equal(miniCardsAt(state, 'knottedTower').filter(card => card.decoy).length, 3)
  // 幕 2 背面：3 张残骸之城 + 1/调查员 诱饵环绕悖逆重力之阶。
  behavior.actReveal(state, { code: RAW_CODES.act2, originalCode: RAW_CODES.act2 }, api)
  const climb = miniCardsAt(state, 'gravityDefyingClimb')
  assert.equal(climb.filter(card => !card.decoy).length, 3)
  assert.equal(climb.filter(card => card.decoy).length, 2)
  // 幕 3 背面：拟态克星在塔顶 + 2/调查员 诱饵；戴红手套的男子移除。
  behavior.actReveal(state, { code: RAW_CODES.act3, originalCode: RAW_CODES.act3 }, api)
  assert.equal(enemyByCode(state, RED_GLOVED_MAN), undefined)
  assert.equal(enemyByCode(state, RAW_CODES.mimeticNemesis)?.location, 'toweringVertex')
  const vertex = miniCardsAt(state, 'toweringVertex')
  assert.equal(vertex.filter(card => !card.decoy).length, 1)
  assert.equal(vertex.filter(card => card.decoy).length, 4)
})

test('P7 congressOfTheKeys 揭露序列：错序翻回、左→中→右解锁塔顶入口', () => {
  const { state, api } = outsideState()
  behavior.actReveal(state, state.acts[0], api)
  behavior.actReveal(state, { code: RAW_CODES.act2, originalCode: RAW_CODES.act2 }, api)
  // 入口：未解锁时不能进入睥睨众生之巅。
  assert.match(behavior.investigatorEntryError(state, { code: RAW_CODES.toweringVertex, originalCode: RAW_CODES.toweringVertex }, state.investigators[0]), /睥睨众生之巅/)
  // 先进悖逆重力之阶（幕 2 目标），再按序列揭露。
  const climb = miniCardsAt(state, 'gravityDefyingClimb')
  const byPosition = position => climb.find(card => card.position === position && !card.decoy)
  // 错序：先揭中间 → 全部翻回（不混洗），序列为空。
  const mid = byPosition('middle')
  exposeAt(state, 0, mid.id, api)
  assert.deepEqual(chapterState(state).citySequence, [])
  assert.equal(tskConcealed.concealedMiniCards(state).every(card => card.flipped === false), true)
  // 正确顺序：左 → 中 → 右。
  for (const position of ['left', 'middle', 'right']) {
    const card = miniCardsAt(state, 'gravityDefyingClimb').find(item => item.position === position && !item.decoy && item.flipped === false)
    assert.ok(card, `缺少 ${position} 的残骸之城迷你卡`)
    exposeAt(state, 0, card.id, api)
  }
  assert.deepEqual(chapterState(state).citySequence, ['left', 'middle', 'right'])
  assert.equal(vertexUnlocked(state), true)
  assert.equal(behavior.investigatorEntryError(state, { code: RAW_CODES.toweringVertex, originalCode: RAW_CODES.toweringVertex }, state.investigators[0]), null)
})

test('P7 congressOfTheKeys 塔顶揭露：诱饵留在场上，拟态克星真身受 3 伤并翻回混洗', () => {
  const { state, api } = outsideState()
  behavior.actReveal(state, state.acts[0], api)
  behavior.actReveal(state, { code: RAW_CODES.act2, originalCode: RAW_CODES.act2 }, api)
  behavior.actReveal(state, { code: RAW_CODES.act3, originalCode: RAW_CODES.act3 }, api)
  const vertex = miniCardsAt(state, 'toweringVertex')
  const decoy = vertex.find(card => card.decoy)
  const result = exposeAt(state, 0, decoy.id, api)
  assert.equal(result.outcome, 'decoyKept')
  assert.ok(chapterState(state).exposedDecoys.includes(decoy.id))
  // 真身：拟态克星的迷你卡 → 3 点伤害 + 全部翻回 + 混洗。
  const trueForm = miniCardsAt(state, 'toweringVertex').find(card => !card.decoy && card.flipped === false)
  const nemesis = enemyByCode(state, RAW_CODES.mimeticNemesis)
  const outcome = exposeAt(state, 0, trueForm.id, api)
  assert.equal(outcome.outcome, 'nemesisRevealed')
  assert.equal(nemesis.damageTaken, 3)
  assert.equal(tskConcealed.concealedMiniCards(state).length, vertex.length)
})

// ---------------------------------------------------------------------------
// 5. 密谋 / 幕推进
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 密谋：因果汇流的三个版本分支、跳过后面的 b 面、万物尽红全灭', () => {
  // 版本一：每个敌人变换身上附属的钥匙。
  const v1 = outsideState()
  const data = chapterState(v1.state)
  data.setupVersion = 1
  const watcher = v1.api.spawn('09754', 'knottedTower')
  applyKeyAwards(v1.state, v1.api, [{ keyId: '09565', memberId: 'sanguineWatcher' }])
  v1.state.choices.push('skip')
  behavior.agendaReveal(v1.state, v1.state.agendas[0], v1.api)
  assert.equal(tskKeys.scarletKey(v1.state, '09565').bearer.enemyId, watcher.id)
  assert.ok(v1.state.infos.some(text => text.includes('每个敌人变换身上附属的钥匙')))

  // 版本二：在密谋 2a 上放 4 个毁灭 + 推进幕（由 agendaChain 落地）。
  const v2 = outsideState(2, 2)
  const advancedBefore = v2.state.advanced
  behavior.agendaReveal(v2.state, v2.state.agendas[0], v2.api)
  assert.equal(chapterState(v2.state).doomOnNextAgenda, 4)
  assert.equal(v2.state.advanced, advancedBefore + 1)
  behavior.agendaChain(v2.state, v2.state.agendas[1], v2.api)
  assert.equal(v2.state.doom, 4)

  // 幕 2/3/4 推进密谋 1 时跳过 b 面。
  const skip = outsideState()
  skip.state.acts = [clone(ACT1_VERSIONS[1]), ...skip.state.acts.slice(1)]
  skip.state.actIndex = 1
  behavior.agendaReveal(skip.state, skip.state.agendas[0], skip.api)
  assert.ok(skip.state.infos.some(text => text.includes('跳过「因果汇流」的 b 面')))

  // 密谋 3 背面：每位调查员被击败 → 结局 2。
  const red = outsideState()
  behavior.agendaReveal(red.state, red.state.agendas[2], red.api)
  assert.equal(red.state.investigators.every(inv => inv.defeated), true)
  assert.deepEqual(red.state.finished, ['resolution2'])
})

test('P7 congressOfTheKeys 密谋 2 背面：跨维震撼用动荡钥匙取消全部伤害', () => {
  const { state, api } = outsideState()
  ensureCongressKeys(state, api)
  tskKeys.bindKey(state, '09565', { type: 'investigator', seat: 0 })
  // 先把钥匙翻到动荡面。
  tskKeys.shiftKey(state, '09565', { force: true })
  assert.equal(tskKeys.scarletKey(state, '09565').stable, false)
  state.choices.push('unstable')
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].horror, 0)
  assert.ok(state.infos.some(text => text.includes('取消全部伤害与恐惧')))
})

// ---------------------------------------------------------------------------
// 6. 绯红密钥：判给、绑定、变换
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 密钥判给：被跳过的章节把钥匙判给同志会成员', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  ensureCongressKeys(state, api)
  const awards = computeKeyAwards(state, computeTrial(trialInputs(state)))
  assert.deepEqual(awards.map(entry => entry.keyId).sort(), CONGRESS_KEYS.map(key => key.id).sort())
  // 在场敌人 → 直接绑定；不在场 → pending。
  const thorne = api.spawn('09757', 'scarletHallsLair')
  const result = applyKeyAwards(state, api, awards)
  const thorneAward = result.bound.find(entry => entry.memberId === 'thorne')
  assert.ok(thorneAward, '索恩在场却没有拿到玄丧之镜')
  const record = tskKeys.scarletKey(state, '09634')
  assert.deepEqual(record.bearer, { type: 'enemy', enemyId: thorne.id })
  assert.equal(record.stable, false, '敌人持有的密钥在动荡面')
  assert.ok(chapterState(state).pendingKeyAwards.length > 0)
  // 之后再生成敌人 → 待判钥匙自动绑定。
  const amaranth = api.spawn('09759', 'scarletHallsLair')
  behavior.enemySpawned(state, amaranth, api)
  assert.deepEqual(tskKeys.scarletKey(state, '09544').bearer, { type: 'enemy', enemyId: amaranth.id })
})

test('P7 congressOfTheKeys 密钥变换：敌人持钥只结算效果不翻回，调查员变换按声明翻面', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  ensureCongressKeys(state, api)
  state.investigators[0].assets.push({ id: 'asset1', code: '01020', exhausted: false })
  // 调查员持玄丧之镜（09634a 声明 lookAtConcealedAtLocation）：查看并翻至动荡面。
  place(state, 'scarletHallsLair')
  tskConcealed.placeMiniCard(state, { kind: 'CityOfRemnantsL', decoy: false, locationId: 'scarletHallsLair', position: null, known: false })
  tskKeys.bindKey(state, '09634', { type: 'investigator', seat: 0 })
  const shifted = resolveKeyShift(state, 0, api, '09634')
  assert.equal(shifted.effect, 'lookAtConcealedAtLocation')
  assert.equal(shifted.flipped, true)
  assert.equal(tskKeys.scarletKey(state, '09634').stable, false)
  // 敌人持钥（by:'enemy'）：只结算效果，不翻回稳定面。
  const enemy = api.spawn('09757', 'scarletHallsLair')
  tskKeys.bindKey(state, '09634', { type: 'enemy', enemyId: enemy.id })
  const record = tskKeys.scarletKey(state, '09634')
  assert.equal(record.stable, false)
  const enemyShift = resolveKeyShift(state, null, api, '09634', { by: 'enemy' })
  assert.equal(enemyShift.flipped, false)
  // 恸哭女士的旧契约（assetRule.shift：发现 1 个线索）。
  tskKeys.bindKey(state, '09565', { type: 'investigator', seat: 0 })
  const legacy = resolveKeyShift(state, 0, api, '09565')
  assert.equal(legacy.effect, 'discoverClue')
  // 末绽之花的第四种声明（flags.shiftEffect）：治愈持有者所在地点每位调查员 1 伤害/1 恐惧。
  tskKeys.bindKey(state, '09544', { type: 'investigator', seat: 0 })
  state.investigators[0].damage = 2
  state.investigators[0].horror = 2
  state.investigators[1].location = state.investigators[0].location
  state.investigators[1].damage = 1
  const flagShift = resolveKeyShift(state, 0, api, '09544')
  assert.equal(flagShift.effect, 'healInvestigatorsAtBearerLocation')
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].damage, 0)
  // shiftKeysHeldBy：敌人身上的每把钥匙逐一变换。
  const count = shiftKeysHeldBy(state, enemy, api)
  assert.ok(count >= 1)
})

// ---------------------------------------------------------------------------
// 7. 结局：胜利 / 存在抹除
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 结局 1：域外来客遭到阻止（+5 经验、2/2 创伤、密钥归属）', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  ensureCongressKeys(state, api)
  tskKeys.bindKey(state, '09565', { type: 'investigator', seat: 1 })
  const result = behavior.resolution(state, 'resolution1', [], api)
  assert.equal(result.bonus, 5)
  assert.equal(result.alive, true)
  assert.equal(hasRecord(state, 'theOutsidersWereStopped'), true)
  assert.equal(hasRecord(state, 'theCellWasHollowed'), false)
  assert.deepEqual(state.trauma.filter(entry => entry.kind === 'physical').length, 2)
  assert.deepEqual(state.trauma.filter(entry => entry.kind === 'mental').length, 2)
  assert.ok(state.campaign.records.keysHeld.includes('09565'))
  assert.ok(state.campaign.records.chaptersCompleted.includes('congressOfTheKeys'))
  // 终章本身不消耗时间（时间由世界地图/结局流程结算）。
  assert.equal(state.campaign.records.time, undefined)
})

test('P7 congressOfTheKeys 结局 2：特别小组成为空洞 → 空洞卡写入存在抹除名单', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  place(state, 'scarletHallsLair')
  // 先把两张卡放进空洞区（[elderthing] 的口径）。
  const committed = ['01020', '01021']
  for (const code of committed) {
    state.investigators[0].hand.push(code)
  }
  hollowCommittedCards(state, state.investigators[0], {
    committed: committed.map(code => ({ code, seat: 0 })),
  }, api)
  assert.equal(tskHollow.hollowCards(state).length, 2)
  assert.equal(state.investigators[0].hand.length, 0)
  const result = behavior.resolution(state, 'resolution2', [], api)
  assert.equal(result.bonus, 0)
  assert.equal(hasRecord(state, 'theCellWasHollowed'), true)
  assert.deepEqual(tskHollow.erasedFromExistence(state).sort(), [...committed].sort())
  assert.deepEqual(state.campaign.records.erasedCards.sort(), [...committed].sort())
  assert.equal(state.campaign.records.erasedFromExistence, true)
  assert.equal(tskHollow.hollowCards(state).length, 0)
  // 重复结算不会重复抹除（幂等）。
  const again = eraseHollows(state, api)
  assert.deepEqual(again.codes, [])
  // 全灭（noResolution）同样落到结局 2。
  const defeated = stateFor(1)
  const defeatedApi = apiFor(defeated)
  const noRes = behavior.resolution(defeated, 'noResolution', [], defeatedApi)
  assert.equal(noRes.bonus, 0)
  assert.equal(hasRecord(defeated, 'theCellWasHollowed'), true)
  assert.equal(behavior.finalResolution(defeated), 'resolution2')
})

// ---------------------------------------------------------------------------
// 8. 地点规则 / 拟态克星读点
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys 地点规则：议会室加价、书库折扣、藏钥馆帷幕、塔顶入口与爬塔费用', () => {
  const state = stateFor(2)
  const inv = state.investigators[0]
  // 议会室（巢穴）：有重整[[结社]]敌人时每张支援 +2 费用。
  place(state, 'congressChamberLair')
  inv.location = 'congressChamberLair'
  assert.equal(congressPlayCost({ state, inv }), 0)
  state.enemies.push({ id: 'coterie1', code: '09753', originalCode: '09753', traits: ['Coterie'], exhausted: false, location: 'congressChamberLair' })
  assert.equal(congressPlayCost({ state, inv }), 2)
  assert.equal(playCostDelta(state, inv, '01020'), 2, '外部修正源未接线')
  // 书库（圣堂）折扣：本轮下一张支援 -2。
  state.enemies = []
  inv.location = 'coterieLibrarySanctum'
  const data = chapterState(state)
  data.assetDiscount = { seat: inv.seat, amount: 2, round: state.round, used: false }
  assert.equal(congressPlayCost({ state, inv }), -2)
  behavior.assetEntered(state, inv, { code: '01020' })
  assert.equal(congressPlayCost({ state, inv }), 0, '折扣应在支援入场后消耗')
  // 藏钥馆（巢穴）：每个动荡钥匙 +2 帷幕。
  ensureCongressKeys(state, apiFor(state))
  tskKeys.shiftKey(state, '09565', { force: true })
  assert.equal(keyReliquaryShroud(state, { code: RAW_CODES.keyReliquaryLair, originalCode: RAW_CODES.keyReliquaryLair }), 2)
  assert.equal(behavior.locationShroudModifier(state, { code: RAW_CODES.keyReliquaryLair, originalCode: RAW_CODES.keyReliquaryLair }), 2)
  // 塔顶入口未解锁 → 挡路；在塔底共同支付 4/调查员 线索后才能进入悖逆重力之阶。
  const climb = place(state, 'gravityDefyingClimb')
  climb.revealed = false
  for (const one of state.investigators) { one.location = 'knottedTower'; one.clues = 4 }
  place(state, 'knottedTower')
  state.locations.find(location => location.id === 'knottedTower').revealed = true
  assert.equal(behavior.beforeMove(state, inv, climb, apiFor(state), { reason: 'move' }), true)
  assert.equal(chapterState(state).climbCluesPaid, true)
  assert.equal(state.investigators.reduce((sum, one) => sum + one.clues, 0), 0)
  // 线索不足时不能进入。
  const poor = stateFor(2)
  const poorApi = apiFor(poor)
  place(poor, 'knottedTower')
  const poorClimb = place(poor, 'gravityDefyingClimb')
  poorClimb.revealed = false
  for (const one of poor.investigators) one.location = 'knottedTower'
  assert.equal(behavior.beforeMove(poor, poor.investigators[0], poorClimb, poorApi, { reason: 'move' }), false)
})

test('P7 congressOfTheKeys 地点行动与藏钥馆注能：查找/折扣/移动/注能', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  const inv = state.investigators[0]
  place(state, 'congressChamberSanctum')
  place(state, 'coterieLibrarySanctum')
  place(state, 'scarletHallsSanctum')
  inv.assets.push({ id: 'ece', code: '09584', exhausted: false })
  inv.location = 'congressChamberSanctum'
  const moves = behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'loc:searchAsset'))
  assert.equal(behavior.performAction(state, inv, { rule: 'loc:searchAsset' }, api), true)
  assert.equal(state.searchCalls.length, 1)
  assert.equal(inv.assets[0].exhausted, true)
  // 书库圣堂：本轮下一张支援 -2（横置同谋支援改为 [free] 激活）。
  inv.assets[0].exhausted = false
  inv.location = 'coterieLibrarySanctum'
  assert.ok(behavior.actions(state, inv).some(move => move.rule === 'loc:discountAssetFast' && move.actions === 0))
  assert.equal(behavior.performAction(state, inv, { rule: 'loc:discountAssetFast' }, api), true)
  assert.equal(chapterState(state).assetDiscount.amount, 2)
  assert.equal(inv.assets[0].exhausted, true)
  // 藏钥馆圣堂：成功调查后改为注能（不发现线索）。
  place(state, 'keyReliquarySanctum')
  ensureCongressKeys(state, api)
  tskKeys.bindKey(state, '09565', { type: 'investigator', seat: 1 })
  state.investigators[1].location = 'keyReliquarySanctum'
  const keep = behavior.investigateResult(state, inv, { id: 'keyReliquarySanctum', code: RAW_CODES.keyReliquarySanctum, originalCode: RAW_CODES.keyReliquarySanctum },
    { success: true }, { ...api, choose: () => '09565' })
  assert.equal(keep, false, '选择注能后不应发现线索')
  assert.equal(chapterState(state).empowered['09565'], true)
})

test('P7 congressOfTheKeys 条目 09715：庞大/趁乱攻击/每调查员生命值/受伤揭示迷你卡', () => {
  const entry = registeredEntry(RAW_CODES.mimeticNemesis)
  assert.ok(entry, '09715 未注册')
  assert.equal(entry.scope, 'enemy')
  assert.equal(entry.enemyRule?.damageRevealsConcealedMiniCard, true)
  const ruleTargets = entry.modifiers.map(modifier => modifier.target)
  assert.ok(ruleTargets.includes('cannot:opportunityAttack'))
  assert.ok(ruleTargets.includes('enemyHealth'))
  const healthModifier = entry.modifiers.find(modifier => modifier.target === 'enemyHealth')
  assert.equal(healthModifier.amount({ state: { numInvestigators: 3 } }), 9)
  // 受伤读点：诱饵 → 取消全部伤害（返回 false）且诱饵留在场上；真身 → 如常伤害 + 翻回混洗。
  const state = stateFor(2)
  const api = apiFor(state)
  place(state, 'toweringVertex')
  const enemy = api.spawn(RAW_CODES.mimeticNemesis, 'toweringVertex')
  const decoy = tskConcealed.placeMiniCard(state, { kind: 'DecoyMimeticNemesis', decoy: true, locationId: 'toweringVertex', position: 'left', known: false })
  assert.equal(behavior.enemyDamageAllowed(state, enemy, '01020', 0), false)
  assert.equal(tskConcealed.concealedMiniCards(state).find(card => card.id === decoy.id).flipped, true)
  assert.equal(chapterState(state).nemesisShield.decoy, true)
  // 新的真身迷你卡：如常伤害（undefined），其余已揭示卡翻回。
  const trueForm = tskConcealed.placeMiniCard(state, { kind: 'MimeticNemesis', decoy: false, locationId: 'toweringVertex', position: 'middle', known: false })
  assert.equal(behavior.enemyDamageAllowed(state, enemy, '01020', 0), undefined)
  assert.equal(tskConcealed.concealedMiniCards(state).find(card => card.id === trueForm.id).flipped, false)
  assert.equal(tskConcealed.concealedMiniCards(state).find(card => card.id === decoy.id).flipped, false)
})

// ---------------------------------------------------------------------------
// 9. 章节摘要 / JSON 往返 / 遭遇接线
// ---------------------------------------------------------------------------
test('P7 congressOfTheKeys JSON 往返：真实 tsk 容器校验、摘要稳定、结果可重算', () => {
  const { state, api } = outsideState(2)
  behavior.actReveal(state, state.acts[0], api)
  behavior.actReveal(state, { code: RAW_CODES.act2, originalCode: RAW_CODES.act2 }, api)
  const climbCard = miniCardsAt(state, 'gravityDefyingClimb').find(card => card.position === 'left' && !card.decoy)
  exposeAt(state, 0, climbCard.id, api)
  const summary = chapterSummary(state)
  assert.equal(validateTskState(state), true)
  const restored = clone(state)
  assert.equal(validateTskState(restored), true)
  assert.deepEqual(chapterSummary(restored), summary)
  // 恢复后仍能继续揭露与推进。
  const left = miniCardsAt(restored, 'gravityDefyingClimb').find(card => card.position === 'middle' && !card.decoy && card.flipped === false)
  exposeAt(restored, 0, left.id, apiFor(restored))
  assert.deepEqual(chapterState(restored).citySequence, ['left', 'middle'])
  // 审判输入/结论在恢复后一致。
  assert.deepEqual(computeTrial(trialInputs(restored)).tally, computeTrial(trialInputs(state)).tally)
})

test('P7 congressOfTheKeys 遭遇接线与记录：条目清单、共享组声明、记录读写', () => {
  assert.deepEqual(CHAPTER_ENTRY_CODES, [RAW_CODES.mimeticNemesis])
  assert.deepEqual(behavior.implementedEncounterCodes, [RAW_CODES.mimeticNemesis])
  assert.ok(behavior.referencedEncounterCodes.includes('09752'))
  assert.equal(behavior.referencedEncounterCodes.length, COTERIE_MEMBERS.filter(member => member.enemyCode).length + 1)
  assert.equal(behavior.gatherGroups, GATHER_GROUPS)
  assert.equal(behavior.id, 'congressOfTheKeys')
  assert.equal(behavior.recordReads, RECORD_READS)
  assert.equal(behavior.recordWrites, RECORD_WRITES)
  // 场景行动：幕 4 的「翻钥匙移除诱饵」与版本二的出发。
  const state = stateFor(2)
  const api = apiFor(state)
  ensureCongressKeys(state, api)
  place(state, 'scarletHallsLair')
  state.acts = [clone(ACT1_VERSIONS[2]), ...state.acts.slice(1)]
  state.actIndex = 0
  state.investigators[0].location = 'scarletHallsLair'
  state.investigators[1].location = 'scarletHallsLair'
  const depart = behavior.actions(state, state.investigators[0]).find(move => move.rule === 'act1v2:depart')
  assert.ok(depart, '缺少版本二出发行动')
  tskKeys.bindKey(state, '09565', { type: 'investigator', seat: 0 })
  chapterState(state).exposedDecoys = ['mini1']
  state.acts[state.actIndex] = clone(ACT_CARDS.find(act => act.id === 'act4'))
  const remove = behavior.actions(state, state.investigators[0]).find(move => move.rule === 'act4:removeDecoy')
  assert.ok(remove, '缺少幕 4 移除诱饵行动')
  assert.equal(behavior.performAction(state, state.investigators[0], { rule: 'act4:removeDecoy' }, api), true)
  assert.equal(chapterState(state).exposedDecoys.length, 0)
  // 记录辅助：时间/章节/密钥。
  assert.equal(markChapterCompleted(state).includes('congressOfTheKeys'), true)
  assert.deepEqual(setKeyHeld(state, '09565'), ['09565'])
  assert.deepEqual(setKeyHeld(state, '09565', false), [])
})

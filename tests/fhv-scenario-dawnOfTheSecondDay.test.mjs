// P7 第二日黎明（dawnOfTheSecondDay · 提示卡 10677a / 混乱参考卡 10704）章节测试。
//
// 覆盖：章节结构与 manifest（0 张单卡条目、8 地点、1 幕 1 议程、4 个 gather 组、放一边/在场）、
// The Vale 6×3 双格地图（印刷图标连接 ∪ 网格相邻）、第二日白天的布置/时间推进/疲劳换标记、
// The Hemlock Curse / Gnawing Hunger、居民关系与笔记、法典 1/3–17 的分支与效果、
// 地点能力（法典 9–16、治疗、法术/书检索、快速移动、Tad's 谈判）、幕/议程背面与结局记录、
// 下一次勘察（Areas Surveyed 过滤 + 整备 + 跳过开局步骤 1–8 / 不重抽）、10704 四档混乱符号、
// JSON 存档往返与近似披露。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与引擎既有原语（scenario-calendar /
// survey-preparation 等 helper 模块），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { normalizeScenarioMechanics } from '../src/engine/mechanic-state.js'
import { canResolveCodex, codexSelectionFor, resolveCodex } from '../src/engine/scenario-calendar.js'
import { prepareSurvey, restoreSurveyInvestigator } from '../src/engine/survey-preparation.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/index.js'
import {
  scenario, SCENARIO_TEXT, LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, ICON_CONNECTIONS, GRID_ADJACENCY,
  LOCATION_CELLS, LOCATION_TABLE, LOCATION_SYMBOLS, START_LOCATION, ACT_CODE, AGENDA_CODE, ACT_CODES,
  AGENDA_CODES, RESOLUTION_KEYS, GATHER_GROUPS, GATHER_GROUP_IDS, SET_ASIDE_ALIASES, IN_PLAY_ALIASES,
  RESIDENT_ASSET_CODES, RESIDENT_KEYS, RESIDENT_RECORDS, RESIDENT_CODES, RESIDENTS_SPEC, CODEX_IDS,
  CODEX_SPEC, CODEX_BY_LOCATION, JUDITH_CODE, JUDITH_LOCATION, HEMLOCK_CURSE_CODE, UNUSED_TREACHERY_CODE,
  TIME_MARKER_CODE, STEP_CODE, REFERENCE_CODE, SURVEY_DESTINATIONS, CHINESE_GAPS, PRELUDE_DAY,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/definition.js'
import {
  behavior, codex, codexBranchFor, codexAvailable, codexReadCount, isCodexRead,
  relationshipLevel, addRelationship, addNote, notesOf, isRemembered, rememberFact,
  surveyDestinations, surveyedAreas, resolutionChainForKey, scenarioSummary, scenarioApproximations,
  RECORD_KEYS, FATIGUE_REPLACEMENT, PREPARATION_FOR_NEXT_SURVEY, agendaCancelsWeakness, cancelWeaknessDraw,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/behavior.js'
import {
  DAWN_TOKEN_MEANINGS, dawnChaosTokenOutcome, skullValue, tabletValue, isHardSide, dayOf,
  currentDay, isParleyAttempt, TOKEN_FACES,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/chaos.js'

const clone = value => JSON.parse(JSON.stringify(value))
const ENTITY = code => scenario.storyAssets?.[code] || scenario.enemies?.[code] || scenario.treacheries?.[code] || {}

const stateFor = (investigatorCount = 1, { records = {}, flags = {} } = {}) => {
  const investigators = Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, code: '01001', name: `调查员${seat + 1}`, location: null,
    damage: 0, horror: 0, clues: 0, resources: 5, assets: [], hand: [], deck: [], discard: [], threat: [],
    defeated: false, resigned: false,
  }))
  const campaignInvestigators = Object.fromEntries(investigators.map(inv => [inv.seat, {
    id: `inv-${inv.seat}`, code: inv.code, status: 'active', deck: [], earnedXp: 0, xp: 0,
  }]))
  return {
    investigators, locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
    scenarioFlags: { ...flags }, scenarioZones: {},
    campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: campaignInvestigators },
    acts: clone(scenario.acts), agendas: clone(scenario.agendas), actIndex: 0, agendaIndex: 0,
    doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
    phase: 'investigation', round: 1, status: 'playing',
  }
}
const stateWithScenario = (count = 1, options = {}) => {
  const state = stateFor(count, options)
  state.scenario = clone(scenario)
  return state
}

const makeApi = (state, options = {}) => {
  const api = {
    state, finished: null, calls: [], choices: [], campaignCards: [], removed: [], played: [], searches: [],
    info: text => api.calls.push({ kind: 'info', body: String(text || '') }),
    present: (body, meta) => api.calls.push({ kind: 'present', title: meta?.title, body }),
    choose: request => {
      api.choices.push(request)
      const answer = typeof options.choose === 'function' ? options.choose(request) : options.answer ?? null
      return answer
    },
    addDoom: amount => { state.doom += amount; api.calls.push({ kind: 'doom', amount }) },
    addTrauma: (seat, kind, amount = 1) => {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
      api.calls.push({ kind: 'trauma', seat, traumaKind: kind, amount })
    },
    addScenarioXpBonus: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + amount
      api.calls.push({ kind: 'xp', seat, amount })
    },
    gainResources: (seat, amount = 1) => {
      state.investigators[seat].resources += amount
      return amount
    },
    loseResources: (seat, amount = 1) => {
      state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount)
      return amount
    },
    drawCards: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      let drawn = 0
      for (let index = 0; index < amount; index++) {
        const code = inv.deck.pop()
        if (!code) break
        inv.hand.push(code)
        drawn += 1
      }
      return drawn
    },
    healDamage: (seat, amount = 1) => {
      state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount)
      return amount
    },
    healHorror: (seat, amount = 1) => {
      state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount)
      return amount
    },
    moveInvestigator: (seat, locationId) => {
      state.investigators[seat].location = locationId
      api.calls.push({ kind: 'move', seat, locationId })
      return true
    },
    storyAsset: (code, location) => {
      const asset = {
        id: `story-${code}`, code, originalCode: code, location,
        name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
        controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
      }
      state.storyAssets.push(asset)
      api.calls.push({ kind: 'storyAsset', code, location })
      return asset
    },
    campaignCard: (code, seat, reason) => {
      const record = state.campaign.investigators[seat]
      if (record) record.deck.push(code)
      api.campaignCards.push({ code, seat, reason })
    },
    campaignCardChange: (campaign, seat, code, action, reason) => {
      const record = campaign?.investigators?.[seat]
      if (!record) return false
      if (action === 'add') record.deck.push(code)
      else record.deck = record.deck.filter(item => item !== code)
      api.campaignCards.push({ code, seat, action, reason })
      return true
    },
    removeFromGameCards: codes => { api.removed.push(...codes); return codes.length },
    playCardFromHandFree: (seat, code) => {
      const inv = state.investigators[seat]
      if (!inv.hand.includes(code)) return false
      inv.hand = inv.hand.filter(item => item !== code)
      inv.assets.push({ id: `asset-${code}`, code, originalCode: code, controllerSeat: seat })
      api.played.push({ seat, code })
      return true
    },
    searchStartingCards: (seat, filters = {}) => {
      const inv = state.investigators[seat]
      const traits = [
        ...(filters.traitsAny || []),
        ...(Array.isArray(filters.trait) ? filters.trait : filters.trait ? [filters.trait] : []),
      ].map(value => String(value).toLowerCase())
      const index = inv.deck.findIndex(code => {
        const card = ALL_CARDS[code]
        if (!card) return false
        if (filters.type && card.type !== filters.type) return false
        return !traits.length || (card.traits || []).some(trait => traits.includes(String(trait).toLowerCase()))
      })
      if (index < 0) return []
      const [code] = inv.deck.splice(index, 1)
      inv.hand.push(code)
      api.searches.push({ seat, filters, code })
      return [code]
    },
    searchAndPlayFromDeck: (seat, filters = {}) => {
      const found = api.searchStartingCards(seat, filters)
      for (const code of found) {
        const inv = state.investigators[seat]
        inv.hand = inv.hand.filter(item => item !== code)
        inv.assets.push({ id: `asset-${code}`, code, originalCode: code, controllerSeat: seat })
        api.played.push({ seat, code })
      }
      return found
    },
    finish: key => { api.finished = key },
    advanceAct: () => {
      behavior.actReveal(state, state.acts[state.actIndex], api)
      state.actIndex += 1
    },
    setTestAutoSuccess: () => { api.autoSuccess = true; return true },
    mechanics: {
      calendar: {
        set: (day, period) => {
          state.campaign.records[RECORD_KEYS.hemlockDate] = `${day}:${period}`
          api.calls.push({ kind: 'calendar', day, period })
          return { day, period }
        },
        current: () => null,
      },
      chaosTokens: {
        replaceCampaignNumeric: (count, delta) => {
          api.calls.push({ kind: 'fatigue', count, delta })
          return [{ from: '-1', to: '-2' }, { from: '0', to: '-1' }]
        },
      },
      residents: {
        change: (spec, delta) => {
          const current = Number(state.campaign.records[spec.level]) || 0
          const next = Math.max(0, Math.min(spec.max, current + delta))
          state.campaign.records[spec.level] = next
          return next
        },
        note: (spec, note) => {
          const values = state.campaign.records[spec.notes] ||= []
          if (values.includes(note)) return false
          values.push(note)
          return true
        },
        crossOut: spec => { state.campaign.records[spec.crossedOut] = true; return true },
      },
      recordSets: {
        add: (key, value) => {
          const values = state.campaign.records[key] ||= []
          if (values.includes(value)) return false
          values.push(value)
          return true
        },
        values: key => [...(state.campaign.records[key] || [])],
      },
      ...(options.engineCodex ? {
        codex: {
          resolve: (id, seat, resolve) => {
            const ok = resolveCodex(state, id, seat, ctx => resolve(ctx))
            return ok
          },
        },
      } : {}),
    },
  }
  return api
}

const setup = (count = 1, options = {}) => {
  const state = stateWithScenario(count, options)
  const api = makeApi(state, options)
  const report = behavior.setupScenario(state, api)
  return { state, api, report }
}

const at = (state, id) => state.locations.find(location => location.id === id) || null
const locationName = id => LOCATIONS[id]?.name || id

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 章节结构：0 张单卡条目、8 地点、1 幕 1 议程、4 个 gather 组', () => {
  assert.equal(scenario.id, 'dawnOfTheSecondDay')
  assert.equal(scenario.originalCode, '10704')
  assert.equal(scenario.referenceCode, '10704')
  assert.equal(scenario.stepCode, '10677a')
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.equal(chapter.implementedEncounterCodes.length, 0)
  assert.equal(chapter.entryCount, 0)
  assert.equal(LOCATION_IDS.length, 8)
  assert.equal(Object.keys(LOCATIONS).length, 8)
  assert.deepEqual([...ACT_CODES], ['10684'])
  assert.deepEqual([...AGENDA_CODES], ['10683'])
  assert.equal(ACT_CODE, '10684')
  assert.equal(AGENDA_CODE, '10683')
  assert.equal(scenario.acts[0].stage, '1a')
  assert.equal(scenario.agendas[0].stage, '1a')
  assert.equal(scenario.agendas[0].doomThreshold, 6)
  assert.deepEqual([...GATHER_GROUPS], ['the_second_day', 'day_of_rain', 'residents', 'the_vale'])
  assert.deepEqual([...GATHER_GROUP_IDS], ['theSecondDay', 'dayOfRain', 'residents', 'theVale'])
  assert.deepEqual([...RESOLUTION_KEYS], ['resolution1', 'resolution2', 'resolution3'])
  assert.equal(scenario.startLocation, 'boardingHouse')
  assert.equal(scenario.locations.boardingHouse.code, '10705a')
  assert.equal(scenario.locations.theOldMill.cluesFixed, 1)
  for (const id of LOCATION_IDS) {
    assert.equal(Boolean(scenario.locations[id].revealed), false, '地点实例由布置阶段创建')
    assert.equal(scenario.locations[id].connections.length > 0, true, `${id} 必须有连接`)
  }
})

test('P7 dawnOfTheSecondDay manifest：playable、四个 gather 组、放一边/在场与记录键', () => {
  assert.equal(chapter.manifest.id, 'dawnOfTheSecondDay')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.manifest.status, 'playable')
  assert.deepEqual([...chapter.manifest.requiredPackIds], ['core', 'fhvCampaign'])
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds], ['theSecondDay', 'dayOfRain', 'residents', 'theVale'])
  assert.equal(chapter.manifest.zones.encounterDeck.length, 0, '序曲没有遭遇牌库')
  const setAside = chapter.manifest.zones.setAside.reduce((sum, row) => sum + row.count, 0)
  assert.equal(setAside, SET_ASIDE_ALIASES.length)
  const inPlay = chapter.manifest.zones.inPlay.reduce((sum, row) => sum + row.count, 0)
  assert.equal(inPlay, 2)
  assert.deepEqual(chapter.manifest.zones.inPlay.map(row => row.cardCode).sort(), ['10677', '10699'])
  assert.equal(chapter.manifest.prelude.day, 2)
  assert.equal(chapter.manifest.prelude.period, 'day')
  assert.equal(chapter.manifest.isPrelude, true)
  assert.equal(chapter.manifest.day, PRELUDE_DAY)
  assert.equal(chapter.manifest.period, 'day')
  assert.deepEqual(chapter.manifest.surveyDestinations, [...SURVEY_DESTINATIONS])
  assert.equal(chapter.manifest.chineseGaps.length, CHINESE_GAPS.length)
  assert.equal(chapter.manifest.prelude.skipSetupSteps.first, 1)
  assert.equal(chapter.manifest.prelude.skipSetupSteps.last, 8)
  assert.equal(chapter.manifest.recordReads.includes('motherRachelRelationshipLevel'), true)
  assert.equal(chapter.manifest.recordWrites.includes('motherRachelNotes'), true)
  assert.equal(chapter.manifest.approximations.length, scenarioApproximations.length)
})

test('P7 dawnOfTheSecondDay The Vale 地图：印刷图标连接 + 3×3 正交相邻单独导出', () => {
  assert.equal(LOCATION_CELLS.hemlockChapel.y, 0)
  assert.equal(LOCATION_CELLS.tadsGeneralStore.x, 2)
  assert.equal(LOCATION_CELLS.boardingHouse.y, 4)
  assert.equal(LOCATION_SYMBOLS.boardingHouse, 'circle')
  assert.equal(LOCATION_SYMBOLS.hemlockChapel, 'triangle')
  // 印刷图标（TheVale.hs CardDefs）
  for (const target of ['theCrossroads', 'valeSchoolhouse']) {
    assert.equal(ICON_CONNECTIONS.boardingHouse.includes(target), true, `旅舍印刷连接 ${target}`)
  }
  // 双格地图的正交相邻单独导出（boardingHouse 圆 与 theOldMill 心共享一条边）。
  assert.equal(GRID_ADJACENCY.boardingHouse.includes('theOldMill'), true)
  assert.equal(GRID_ADJACENCY.hemlockChapel.includes('tadsGeneralStore'), true)
  // 规则连接只取印刷图标；网格相邻未并入（Location Adjacency 原语 pending，已披露）。
  for (const id of LOCATION_IDS) {
    assert.equal(LOCATION_CONNECTIONS[id].includes(id), false)
    for (const target of LOCATION_CONNECTIONS[id]) {
      assert.equal(LOCATION_CONNECTIONS[target].includes(id), true, `${id} → ${target} 必须双向`)
      assert.equal(ICON_CONNECTIONS[id].includes(target), true, `${target} 必须来自印刷图标`)
    }
  }
  assert.equal(LOCATION_CONNECTIONS.hemlockChapel.includes('tadsGeneralStore'), false, '网格边不并入规则连接')
  assert.equal(LOCATION_CONNECTIONS.boardingHouse.includes('theOldMill'), false, '网格边不并入规则连接')
  // Crossroads 是中央：连接其余 6 个（含 6 个印刷符号；学校只连星/圆）。
  assert.deepEqual([...LOCATION_CONNECTIONS.theCrossroads].sort(),
    ['boardingHouse', 'hemlockChapel', 'tadsGeneralStore', 'theAtwoodHouse', 'theCommons', 'theOldMill'].sort())
  assert.equal(chapter.layout.locations.theCrossroads.x, 1)
  assert.equal(chapter.layout.locations.theCrossroads.y, 2)
  assert.equal(chapter.layout.cellHeight, 2, 'The Vale 地点卡纵向占 2 格')
  assert.equal(chapter.layout.edges.length, LOCATION_IDS.reduce((sum, id) => sum + LOCATION_CONNECTIONS[id].length, 0))
  for (const edge of chapter.layout.edges) {
    assert.equal(LOCATION_CONNECTIONS[edge.from].includes(edge.to), true, '展示连线必须是规则连接')
  }
})

test('P7 dawnOfTheSecondDay 放一边/在场：Residents 整组、Hemlock Curse、Downpour、Judith 在场', () => {
  for (const code of RESIDENT_ASSET_CODES) {
    assert.ok(ALL_CARDS[code], `Residents 卡 ${code} 必须在卡表`)
  }
  assert.equal(SET_ASIDE_ALIASES.includes(JUDITH_CODE), false)
  assert.equal(SET_ASIDE_ALIASES.includes(HEMLOCK_CURSE_CODE), true)
  assert.equal(SET_ASIDE_ALIASES.includes(UNUSED_TREACHERY_CODE), true)
  assert.deepEqual([...IN_PLAY_ALIASES], ['10677', '10699'])
  assert.equal(ALL_CARDS[TIME_MARKER_CODE].name, 'Day Two')
  assert.equal(STEP_CODE, '10677a')
  assert.equal(REFERENCE_CODE, '10704')
})

// ---------------------------------------------------------------------------
// 2. 布置 / 时间推进 / 开场
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 布置：8 地点入场、时间标记、Judith、按人数放毁灭', () => {
  const { state, api, report } = setup(2)
  assert.deepEqual(report.locations, LOCATION_IDS)
  assert.equal(state.locations.length, 8)
  for (const id of LOCATION_IDS) {
    const location = at(state, id)
    assert.ok(location, `${id} 已入场`)
    assert.equal(location.revealed, true, `${id} 白天面已揭示`)
    assert.deepEqual(location.connections, [...LOCATION_CONNECTIONS[id]])
  }
  assert.equal(at(state, 'boardingHouse').clues, 0)
  assert.equal(at(state, 'theOldMill').clues, 1)
  assert.equal(report.timeMarker, TIME_MARKER_CODE)
  assert.equal(state.storyAssets.some(asset => asset.code === TIME_MARKER_CODE && asset.face === 'front'), true)
  assert.equal(report.judith, JUDITH_CODE)
  const judith = state.storyAssets.find(asset => asset.code === JUDITH_CODE)
  assert.equal(judith.location, JUDITH_LOCATION)
  assert.equal(state.doom, 2, '毁灭 = 调查员人数')
  assert.equal(report.residentsSetAside.length, 10, '11 名居民里 Judith 直接入场')
  assert.deepEqual(report.residentsRemoved, [])
  assert.equal(state.scenarioZones.setAsideResidents.length, 10)
})

test('P7 dawnOfTheSecondDay 布置：被划掉的居民移出游戏、不入场也不放一边', () => {
  const { state, report } = setup(1, { records: { motherRachelCrossedOut: true, theoPetersCrossedOut: true } })
  assert.deepEqual(report.residentsRemoved.sort(), ['10693', '10700'])
  assert.equal(state.scenarioZones.setAsideResidents.includes('10693'), false)
  assert.equal(state.scenarioZones.setAsideResidents.includes('10700'), false)
  assert.equal(state.storyAssets.some(asset => asset.code === '10693'), false)
})

test('P7 dawnOfTheSecondDay 时间推进：第 2 日白天写入日历与战役记录', () => {
  const state = stateWithScenario(1, { records: { finishedTheirMeal: true } })
  const api = makeApi(state)
  const report = behavior.preScenarioSetup(state, [], api)
  assert.deepEqual(report.calendar, { day: 2, period: 'day' })
  assert.equal(state.campaign.records.day, 2)
  assert.equal(state.campaign.records.time, 'Day')
  assert.equal(state.campaign.records.hemlockDate, '2:day')
  assert.deepEqual(api.calls.find(call => call.kind === 'calendar'), { kind: 'calendar', day: 2, period: 'day' })
  assert.equal(dayOf(state), 2)
  assert.equal(currentDay(state), 2)
  assert.equal(chapter.dayOfDawn(state), 2)
})

test('P7 dawnOfTheSecondDay 疲劳：两个非符号标记永久降低 1，且只结算一次', () => {
  const state = stateWithScenario(1)
  const api = makeApi(state)
  const first = behavior.preScenarioSetup(state, [], api)
  assert.deepEqual(FATIGUE_REPLACEMENT, { count: 2, delta: -1 })
  assert.deepEqual(behavior.fatigueReplacement().count, 2)
  assert.equal(first.fatigue.applied, true)
  assert.equal(first.fatigue.replaced.length, 2)
  assert.deepEqual(api.calls.filter(call => call.kind === 'fatigue').map(call => [call.count, call.delta]), [[2, -1]])
  behavior.preScenarioSetup(state, [], api)
  assert.equal(api.calls.filter(call => call.kind === 'fatigue').length, 1, '重复进入本序曲不得再次替换')
  assert.equal(state.campaign.records.hemlockFatigueApplied, true)
  // 重开（scenarioFlags 被引擎重置）也不会再次替换战役袋。
  state.scenarioFlags = {}
  behavior.preScenarioSetup(state, [], api)
  assert.equal(api.calls.filter(call => call.kind === 'fatigue').length, 1, '重开不得再次替换')
})

test('P7 dawnOfTheSecondDay 开场：finished their meal → 毒堇诅咒；其他人 → 1 点肉体创伤', () => {
  // 组级记录（true = 全队完成用餐）
  const allFinished = stateWithScenario(2, { records: { finishedTheirMeal: true } })
  const api = makeApi(allFinished)
  const report = behavior.preScenarioSetup(allFinished, [], api)
  assert.deepEqual(report.intro.cursed, [0, 1])
  assert.deepEqual(report.intro.traumatized, [])
  assert.deepEqual(api.campaignCards.filter(card => card.code === HEMLOCK_CURSE_CODE).map(card => card.seat), [0, 1])
  assert.equal(allFinished.campaign.records.hemlockCurseAdded, true)
  assert.equal(api.calls.some(call => call.kind === 'present' && call.title === 'The Hemlock Curse'), true)

  // 座位级记录（只有座位 0 完成用餐）
  const mixed = stateWithScenario(2, { records: { finishedTheirMeal: ['0'] } })
  const api2 = makeApi(mixed)
  const report2 = behavior.preScenarioSetup(mixed, [], api2)
  assert.deepEqual(report2.intro.cursed, [0])
  assert.deepEqual(report2.intro.traumatized, [1])
  assert.equal(mixed.campaign.trauma[1].physical, 1)
  assert.equal(api2.calls.some(call => call.kind === 'present' && call.title === 'Gnawing Hunger'), true)
  // 引擎 introduction 阅读器日志包含标题/疲劳/分支。
  const intro = behavior.introduction(scenario, mixed.campaign.records, mixed)
  assert.equal(intro.version, 3)
  assert.equal(intro.sections.length >= 2, true)
  assert.equal(intro.paragraphs.join('').includes('drained'), true)
})

// ---------------------------------------------------------------------------
// 3. 混乱标记 10704
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 混乱 [skull]：简单/普通 -天数，困难/专家 -(天数+1)', () => {
  const standard = stateWithScenario(1)
  standard.difficulty = 'standard'
  assert.equal(isHardSide(standard), false)
  assert.equal(skullValue(standard), -2)
  standard.difficulty = 'hard'
  assert.equal(isHardSide(standard), true)
  assert.equal(skullValue(standard), -3)
  assert.equal(dawnChaosTokenOutcome(standard, standard.investigators[0], 'skull').delta, -3)
})

test('P7 dawnOfTheSecondDay 混乱 [tablet]：按难度与手牌数取印刷值', () => {
  const standard = stateWithScenario(1)
  standard.difficulty = 'standard'
  assert.equal(tabletValue(standard, 2), 0)
  assert.equal(tabletValue(standard, 3), -2)
  const hard = stateWithScenario(1)
  hard.difficulty = 'expert'
  assert.equal(tabletValue(hard, 1), -2)
  assert.equal(tabletValue(hard, 2), -4)
  const inv = standard.investigators[0]
  inv.hand = ['a', 'b']
  assert.equal(dawnChaosTokenOutcome(standard, inv, 'tablet').delta, 0)
})

test('P7 dawnOfTheSecondDay 混乱 [cultist]：谈判自动成功 / 困难改为 +1', () => {
  const standard = stateWithScenario(1)
  standard.difficulty = 'standard'
  const inv = standard.investigators[0]
  const plain = dawnChaosTokenOutcome(standard, inv, 'cultist')
  assert.equal(plain.delta, 1)
  assert.equal(plain.onDraw.length, 0)
  const parley = dawnChaosTokenOutcome(standard, inv, 'cultist', { parley: true })
  assert.equal(parley.delta, 1)
  assert.deepEqual(parley.onDraw, [{ type: 'scenarioToken', token: 'cultist', autoSuccess: true }])
  const hard = stateWithScenario(1)
  hard.difficulty = 'hard'
  assert.equal(dawnChaosTokenOutcome(hard, inv, 'cultist').delta, -1)
  assert.equal(dawnChaosTokenOutcome(hard, inv, 'cultist', { parley: true }).delta, 1)
})

test('P7 dawnOfTheSecondDay 混乱 [elder_thing]：-1/-3，谈判再揭示一个', () => {
  const standard = stateWithScenario(1)
  standard.difficulty = 'standard'
  const inv = standard.investigators[0]
  assert.equal(dawnChaosTokenOutcome(standard, inv, 'elderthing').delta, -1)
  assert.equal(dawnChaosTokenOutcome(standard, inv, 'elderthing', { parley: true }).drawAnother, true)
  const hard = stateWithScenario(1)
  hard.difficulty = 'hard'
  assert.equal(dawnChaosTokenOutcome(hard, inv, 'elder_thing').delta, -3)
  assert.equal(DAWN_TOKEN_MEANINGS.standard.elderThing.includes('reveal another token'), true)
  assert.equal(TOKEN_FACES.front, 'easyStandard')
})

test('P7 dawnOfTheSecondDay 混乱钩子：behavior.resolveChaosToken 识别谈判并写自动成功', () => {
  const state = stateWithScenario(1)
  state.skillTest = { actionKind: 'parley' }
  assert.equal(isParleyAttempt(state), true)
  const inv = state.investigators[0]
  const outcome = behavior.resolveChaosToken(state, inv, 'cultist', {})
  assert.equal(outcome.onDraw[0].autoSuccess, true)
  assert.equal(state.skillTest.autoSuccess, true, '没有 api 时写引擎既有读点')
  const api = makeApi(state)
  assert.equal(behavior.applyTokenEffect(state, inv, { type: 'scenarioToken', token: 'cultist', autoSuccess: true }, api), true)
  assert.equal(api.autoSuccess, true)
  assert.equal(behavior.chaosTokenValue(state, inv, 'skull'), -2)
  assert.equal(behavior.investigatorCanBeDefeated(state, inv, 'horror'), false)
})

// ---------------------------------------------------------------------------
// 4. 法典（居民分支 / 效果）
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 法典 1 母亲瑞秋：intervened → Corn Husk Doll；否则抽 1 + 免费 Charm/Spell', () => {
  const intervened = stateWithScenario(1, { records: { motherRachelNotes: ['motherRachelIntervened'] } })
  intervened.investigators[0].location = 'theCommons'
  const api = makeApi(intervened)
  assert.equal(codexBranchFor(intervened, 'motherRachel'), 'motherRachel2')
  assert.equal(codex(intervened, 'motherRachel', api), true)
  assert.equal(relationshipLevel(intervened, 'motherRachel'), 1)
  assert.equal(intervened.investigators[0].scenarioXpBonus, 1)
  assert.deepEqual(api.campaignCards.filter(card => card.code === '10714').map(card => card.seat), [0])

  const otherwise = stateWithScenario(1)
  otherwise.investigators[0].deck = ['01016', '01018']
  otherwise.investigators[0].hand = ['01060']
  const api2 = makeApi(otherwise, { answer: '0' })
  assert.equal(codexBranchFor(otherwise, 'motherRachel'), 'motherRachel3')
  assert.equal(codex(otherwise, 'motherRachel', api2), true)
  assert.equal(otherwise.investigators[0].hand.length, 1, '抽 1 张后免费打出 Charm/Spell')
  assert.equal(api2.played.some(played => played.code === '01060'), true)
  assert.equal(relationshipLevel(otherwise, 'motherRachel'), 1)
})

test('P7 dawnOfTheSecondDay 法典 3 席米恩：hatched a plan → 笔记；否则抽 1 + 找战术/诡计', () => {
  const planned = stateWithScenario(1, { records: { simeonAtwoodNotes: ['simeonHatchedAPlan'] } })
  const api = makeApi(planned)
  assert.equal(codexBranchFor(planned, 'simeonAtwood'), 'hatchedAPlan')
  assert.equal(codex(planned, 'simeonAtwood', api), true)
  assert.equal(notesOf(planned, 'simeonAtwood').includes('thePlanIsUnderway'), true)
  // 印刷文本没有关系/经验奖励（base.json 的 codex.xp 也没有 simeonAtwood）。
  assert.equal(relationshipLevel(planned, 'simeonAtwood'), 0)
  assert.equal(planned.investigators[0].scenarioXpBonus, undefined)

  const other = stateWithScenario(1)
  other.investigators[0].deck = ['01023', '01024']
  const api2 = makeApi(other)
  assert.equal(codex(other, 'simeonAtwood', api2), true)
  assert.equal(other.investigators[0].hand.length, 2)
  assert.equal(api2.searches.length, 1)
  assert.deepEqual(api2.searches[0].filters.traitsAny, ['Tactic', 'Trick'])
})

test('P7 dawnOfTheSecondDay 法典 4/5 汉洛克兄妹：笔记、关系增减、经验与资源', () => {
  const state = stateWithScenario(1)
  state.investigators[0].deck = ['01009']
  const api = makeApi(state)
  assert.equal(codex(state, 'williamHemlock', api), true)
  assert.deepEqual(notesOf(state, 'williamHemlock'), ['williamTookHeart'])
  assert.equal(relationshipLevel(state, 'williamHemlock'), 1)
  assert.equal(relationshipLevel(state, 'riverHawthorne'), 0, '不能被减到负数')
  assert.equal(state.investigators[0].scenarioXpBonus, 1)
  assert.equal(api.searches.length, 1)

  const river = stateWithScenario(1)
  const api2 = makeApi(river)
  assert.equal(codex(river, 'riverHawthorne', api2), true)
  assert.deepEqual(notesOf(river, 'riverHawthorne'), ['theSchemeIsInMotion'])
  assert.equal(relationshipLevel(river, 'riverHawthorne'), 2)
  assert.equal(river.investigators[0].scenarioXpBonus, 2)
  assert.equal(river.investigators[0].resources, 9)
})

test('P7 dawnOfTheSecondDay 法典 6 基甸：told the story → 笔记 + 抽 3', () => {
  const state = stateWithScenario(1, { records: { gideonMizrahNotes: ['gideonToldTheStoryOfCaptainHemlock'] } })
  state.investigators[0].deck = ['01016', '01018', '01020', '01022']
  const api = makeApi(state)
  assert.equal(codexBranchFor(state, 'gideonMizrah'), 'gideon2')
  assert.equal(codex(state, 'gideonMizrah', api), true)
  assert.equal(notesOf(state, 'gideonMizrah').includes('gideonToldTheTaleOfTheAnnabelleLee'), true)
  assert.equal(state.investigators[0].hand.length, 3)
  assert.equal(relationshipLevel(state, 'gideonMizrah'), 1)
})

test('P7 dawnOfTheSecondDay 法典 7 朱迪斯：救过 → 二选一；没救过 → 抽 1 + 免费武器', () => {
  const saved = stateWithScenario(1, { records: { judithParkNotes: ['judithSavedYourAss'] } })
  const api = makeApi(saved, { answer: 'iCanHandleMyself' })
  assert.equal(codexBranchFor(saved, 'judithPark'), 'judith2')
  assert.equal(codex(saved, 'judithPark', api), true)
  assert.equal(relationshipLevel(saved, 'judithPark'), 1)
  assert.equal(saved.investigators[0].scenarioXpBonus, 1)

  const thanks = stateWithScenario(1, { records: { judithParkNotes: ['judithSavedYourAss'] } })
  const api2 = makeApi(thanks, { answer: 'thanksForSavingUs' })
  assert.equal(codex(thanks, 'judithPark', api2), true)
  assert.equal(relationshipLevel(thanks, 'judithPark'), 0)
  assert.equal(thanks.investigators[0].scenarioXpBonus, 1)

  const cold = stateWithScenario(1)
  cold.investigators[0].deck = ['01023']
  cold.investigators[0].hand = ['01020']
  const api3 = makeApi(cold)
  assert.equal(codexBranchFor(cold, 'judithPark'), 'judith1')
  assert.equal(codex(cold, 'judithPark', api3), true)
  assert.equal(api3.played.some(played => played.code === '01020'), true, '免费打出 Weapon')
})

test('P7 dawnOfTheSecondDay 法典 8 希奥：distracted the bear → 关系 +1 且可移动；否则只可移动', () => {
  const distracted = stateWithScenario(1, { records: { theoPetersNotes: ['theoDistractedTheBear'] } })
  const api = makeApi(distracted, { answer: 'theOldMill' })
  assert.equal(codexBranchFor(distracted, 'theoPeters'), 'distractedTheBear')
  assert.equal(codex(distracted, 'theoPeters', api), true)
  assert.equal(relationshipLevel(distracted, 'theoPeters'), 1)
  assert.equal(distracted.investigators[0].scenarioXpBonus, 1)
  assert.equal(distracted.investigators[0].location, 'theOldMill')

  const other = stateWithScenario(1)
  const api2 = makeApi(other, { answer: 'skip' })
  assert.equal(codex(other, 'theoPeters', api2), true)
  assert.equal(relationshipLevel(other, 'theoPeters'), 0)
  assert.equal(other.investigators[0].scenarioXpBonus, undefined)
})

test('P7 dawnOfTheSecondDay 法典 9 旅舍：三选一（移动/席米恩/基甸）且可重复触发', () => {
  const state = stateWithScenario(1)
  state.investigators[0].location = 'boardingHouse'
  const api = makeApi(state, { answer: 'simeon' })
  assert.equal(codex(state, 'boardingHouse', api), true)
  assert.equal(state.storyAssets.some(asset => asset.code === '10695' && asset.location === 'theOldMill'), true)
  assert.equal(codexAvailable(state, 'boardingHouse'), true, '法典 9 可再次触发')
  const api2 = makeApi(state, { answer: 'gideon' })
  assert.equal(codex(state, 'boardingHouse', api2), true)
  assert.equal(state.storyAssets.some(asset => asset.code === '10698' && asset.location === 'theCommons'), true)
  assert.equal(codexReadCount(state, 'boardingHouse'), 2)

  const move = setup(1)
  move.state.investigators[0].location = 'boardingHouse'
  const api3 = makeApi(move.state, { answer: 'help' })
  assert.equal(codex(move.state, 'boardingHouse', api3), true)
  assert.equal(move.state.investigators[0].location, 'theCrossroads')
})

test('P7 dawnOfTheSecondDay 法典 10 十字路口：抽 1 并记住 running an errand', () => {
  const state = stateWithScenario(1)
  state.investigators[0].deck = ['01016', '01018']
  const api = makeApi(state)
  assert.equal(codex(state, 'theCrossroads', api), true)
  assert.equal(state.investigators[0].hand.length, 1)
  assert.equal(isRemembered(state, 'youAreRunningAnErrand'), true)
  assert.deepEqual(state.campaign.records.remembered, { youAreRunningAnErrand: true })
  assert.equal(codex(state, 'theCrossroads', api), false, '法典 10 每场一次')
})

test('P7 dawnOfTheSecondDay 法典 11/15：教堂放母亲瑞秋、学校放希奥', () => {
  const state = stateWithScenario(2)
  const api = makeApi(state)
  assert.equal(codex(state, 'hemlockChapel', api), true)
  assert.equal(state.storyAssets.some(asset => asset.code === '10693' && asset.location === 'hemlockChapel'), true)
  assert.equal(codex(state, 'valeSchoolhouse', api), true)
  assert.equal(state.storyAssets.some(asset => asset.code === '10700' && asset.location === 'valeSchoolhouse'), true)
})

test('P7 dawnOfTheSecondDay 法典 12 老磨坊：发现线索后抽 3', () => {
  const state = stateWithScenario(1)
  state.investigators[0].location = 'theOldMill'
  state.investigators[0].deck = ['01016', '01018', '01020', '01022']
  const api = makeApi(state)
  assert.equal(behavior.cluesGained(state, state.investigators[0], 0, api), false)
  assert.equal(behavior.cluesGained(state, state.investigators[0], 1, api), true)
  assert.equal(state.investigators[0].hand.length, 3)
  assert.equal(isCodexRead(state, 'theOldMill'), true)
  assert.equal(behavior.cluesGained(state, state.investigators[0], 1, api), false, '法典 12 每场一次')
})

test('P7 dawnOfTheSecondDay 法典 13 阿特伍德宅：关系门槛与「让他们打」', () => {
  const both = stateWithScenario(1, { records: { williamHemlockRelationshipLevel: 2, riverHawthorneRelationshipLevel: 2 } })
  const api = makeApi(both, { answer: 'william' })
  assert.equal(codex(both, 'theAtwoodHouse', api), true)
  assert.equal(both.storyAssets.some(asset => asset.code === '10696' && asset.location === 'theAtwoodHouse'), true)

  const fight = stateWithScenario(1, { records: { williamHemlockRelationshipLevel: 5, riverHawthorneRelationshipLevel: 5 } })
  const api2 = makeApi(fight, { answer: 'fight' })
  assert.equal(codex(fight, 'theAtwoodHouse', api2), true)
  assert.equal(relationshipLevel(fight, 'williamHemlock'), 4)
  assert.equal(relationshipLevel(fight, 'riverHawthorne'), 4)

  const none = stateWithScenario(1)
  const api3 = makeApi(none)
  assert.equal(codex(none, 'theAtwoodHouse', api3), true)
  const atwoodChoice = api3.choices.find(request => request.source === 'dawnSecondCodexAtwood')
  assert.deepEqual(atwoodChoice.options.map(option => option.id), ['fight'], '关系 <2 时只能让他们打')
})

test('P7 dawnOfTheSecondDay 法典 14 Tad 杂货店：running an errand → 莉亚 +1；否则花 3 资源买 Item', () => {
  const errand = stateWithScenario(1, { records: { remembered: { youAreRunningAnErrand: true } } })
  const api = makeApi(errand)
  assert.equal(codex(errand, 'tadsGeneralStore', api), true)
  assert.equal(relationshipLevel(errand, 'leahAtwood'), 1)
  assert.equal(errand.investigators[0].scenarioXpBonus, 1)
  assert.equal(errand.investigators[0].resources, 5)

  const shopping = setup(1).state
  shopping.investigators[0].location = 'tadsGeneralStore'
  shopping.investigators[0].deck = ['01016', '01009']
  const api2 = makeApi(shopping, { answer: 'buy' })
  assert.equal(codex(shopping, 'tadsGeneralStore', api2), true)
  assert.equal(shopping.investigators[0].resources, 2)
  assert.equal(api2.searches.length, 1)
  assert.equal(api2.played.length, 1, '免费打出 Item')
  assert.equal(api2.played[0].seat, 0)
  // 未跑腿时不能重复触发；拿到 errand 后才可再触发。
  assert.equal(codex(shopping, 'tadsGeneralStore', api2), false)
  assert.equal(behavior.actions(shopping, shopping.investigators[0])
    .find(move => move.rule === 'dawnSecondCodex:tadsGeneralStore').reason != null, true)
  rememberFact(shopping, 'youAreRunningAnErrand', api2)
  assert.equal(codex(shopping, 'tadsGeneralStore', api2), true)

  // 逐座位一次性：座位 0 读过后，座位 1 仍可读；座位 0 不能（除非跑腿）。
  const seats = setup(2).state
  for (const inv of seats.investigators) inv.location = 'tadsGeneralStore'
  const api3 = makeApi(seats, { answer: 'skip' })
  assert.equal(codex(seats, 'tadsGeneralStore', api3, { seat: 0 }), true)
  assert.equal(codex(seats, 'tadsGeneralStore', api3, { seat: 0 }), false)
  assert.equal(codex(seats, 'tadsGeneralStore', api3, { seat: 1 }), true)
})

test('P7 dawnOfTheSecondDay 法典 16 集会厅：移除 Item 剧情资产 → 低关系居民 +1', () => {
  const state = stateWithScenario(1)
  state.investigators[0].deck = ['10714', '01016']
  state.campaign.investigators[0].deck = ['10714']
  const api = makeApi(state, { answer: '0' })
  assert.equal(codex(state, 'theCommons', api), true)
  assert.deepEqual(api.removed, ['10714'])
  assert.equal(state.investigators[0].deck.includes('10714'), false)
  assert.equal(state.campaign.investigators[0].deck.includes('10714'), false)
  assert.equal(state.investigators[0].scenarioXpBonus, 1)
  const chosen = api.choices.find(request => request.kind === 'resident')
  assert.ok(chosen, '低关系居民选择面板')
  assert.equal(chosen.options.every(option => RESIDENT_KEYS.includes(option.id)), true)
})

test('P7 dawnOfTheSecondDay 法典 17 The Curse：加入弱点；已在牌组时改为检索到手；本人 2 点经验', () => {
  const state = stateWithScenario(1)
  const api = makeApi(state)
  assert.equal(codex(state, 'theCurse', api), true)
  assert.equal(api.campaignCards.some(card => card.code === HEMLOCK_CURSE_CODE), true)
  assert.equal(state.investigators[0].scenarioXpBonus, 2)

  const already = stateWithScenario(1)
  already.campaign.investigators[0].deck = [HEMLOCK_CURSE_CODE]
  already.investigators[0].deck = ['01016', HEMLOCK_CURSE_CODE]
  const api2 = makeApi(already)
  assert.equal(codex(already, 'theCurse', api2), true)
  assert.equal(already.investigators[0].hand.includes(HEMLOCK_CURSE_CODE), true)
})

test('P7 dawnOfTheSecondDay 法典事件回派：共享居民条目的事件约定都能命中', () => {
  const state = stateWithScenario(1, { records: { judithParkNotes: ['judithSavedYourAss'] } })
  const api = makeApi(state, { answer: 'iCanHandleMyself' })
  // 共享组条目优先探测 `<章节 id>Codex<居民>`（10693.js#readCodex）。
  assert.equal(typeof behavior.events.dawnOfTheSecondDayCodexJudithPark, 'function')
  assert.equal(behavior.events.dawnOfTheSecondDayCodexJudithPark(state, { seat: 0 }, api), true)
  assert.equal(codexReadCount(state, 'judithPark'), 1)
  assert.equal(relationshipLevel(state, 'judithPark'), 1)
  assert.equal(behavior.events.dawnOfTheSecondDayCodexJudithPark(state, { seat: 0 }, api), false, '每场一次')
  // 通用入口（payload.entry）与 ResidentParley（payload.resident/code）。
  const generic = stateWithScenario(1)
  assert.equal(behavior.events.dawnOfTheSecondDayCodex(generic, { entry: 'motherRachel', seat: 0 }, makeApi(generic)), true)
  const parley = stateWithScenario(1, { records: { motherRachelNotes: ['motherRachelIntervened'] } })
  assert.equal(behavior.events.dawnOfTheSecondDayResidentParley(parley,
    { code: '10693', resident: 'motherRachel', id: '10693', seat: 0 }, makeApi(parley)), true)
  assert.equal(relationshipLevel(parley, 'motherRachel'), 1)
  assert.deepEqual(parley.campaign.investigators[0].deck.filter(code => code === '10714').length, 1)
  // 未知事件返回 false；别名仍然可用。
  assert.equal(chapter.resolveCodexEvent(stateWithScenario(1), 'unknownEvent', { seat: 0 }, makeApi(stateWithScenario(1))), false)
  assert.equal(typeof behavior.events.dawnSecondCodexMotherRachel, 'function')
})

test('P7 dawnOfTheSecondDay 法典限次与居民笔记：引擎 mechanics.codex 分支与一次性', () => {
  const state = stateWithScenario(1, { records: { motherRachelNotes: ['motherRachelIntervened'] } })
  const api = makeApi(state, { engineCodex: true })
  // 引擎分支选择（scenario-calendar.js）与内容镜像一致。
  assert.deepEqual(codexSelectionFor(state, 'motherRachel').branch, 'motherRachel2')
  assert.equal(codexBranchFor(state, 'motherRachel'), 'motherRachel2')
  assert.equal(codex(state, 'motherRachel', api), true)
  assert.equal(codex(state, 'motherRachel', api), false, '法典 1 每场一次')
  assert.equal(state.scenarioFlags.mechanics.resolvedCodex.includes('motherRachel'), true)
  assert.equal(codexReadCount(state, 'motherRachel'), 1)
  // 未满足条件的法典 7（没有 judithSavedYourAss）仍然可读，走 judith1 分支。
  assert.equal(canResolveCodex(state, 'judithPark'), true)
  assert.equal(codexSelectionFor(state, 'judithPark').branch, 'judith1')
})

// ---------------------------------------------------------------------------
// 5. 地点能力 / 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 地点能力：法典动作、快速移动、法术/书检索与每场一次', () => {
  const state = setup(1).state
  const board = state.investigators[0]
  board.location = 'boardingHouse'
  let moves = behavior.actions(state, board)
  assert.equal(moves.some(move => move.rule.startsWith('dawnSecondCodex:')), true)
  assert.equal(moves.some(move => move.rule === 'dawnSecondBoardingHeal'), true)
  board.damage = 1
  const api = makeApi(state)
  assert.equal(behavior.performAction(state, board, { rule: 'dawnSecondBoardingHeal' }, api), true)
  assert.equal(board.damage, 0)
  assert.equal(behavior.performAction(state, board, { rule: 'dawnSecondBoardingHeal' }, api), false, '治疗每场一次')
  assert.equal(behavior.actions(state, board).find(move => move.rule === 'dawnSecondBoardingHeal').reason != null, true)

  const crossroads = state.investigators[0]
  crossroads.location = 'theCrossroads'
  state.numInvestigators = 3
  assert.equal(behavior.actions(state, crossroads).find(move => move.rule === 'dawnSecondCrossroadsMove').reason != null, true)
  state.numInvestigators = 2
  assert.equal(behavior.actions(state, crossroads).find(move => move.rule === 'dawnSecondCrossroadsMove').reason, undefined)
  const api2 = makeApi(state, { answer: 'theOldMill' })
  assert.equal(behavior.performAction(state, crossroads, { rule: 'dawnSecondCrossroadsMove' }, api2), true)
  assert.equal(crossroads.location, 'theOldMill')
  assert.equal(behavior.performAction(state, crossroads, { rule: 'dawnSecondCrossroadsMove' }, api2), false, '每轮团队一次')

  const chapel = state.investigators[0]
  chapel.location = 'hemlockChapel'
  chapel.deck = ['01060', '01023']
  const api3 = makeApi(state)
  assert.equal(behavior.performAction(state, chapel, { rule: 'dawnSecondChapelSearch' }, api3), true)
  assert.equal(api3.searches.length, 1)
  assert.equal(behavior.performAction(state, chapel, { rule: 'dawnSecondChapelSearch' }, api3), false, '每场一次')

  const school = state.investigators[0]
  school.location = 'valeSchoolhouse'
  school.deck = ['01009', '01023']
  const api4 = makeApi(state)
  assert.equal(behavior.performAction(state, school, { rule: 'dawnSecondSchoolSearch' }, api4), true)
  assert.equal(behavior.actions(state, school).find(move => move.rule === 'dawnSecondSchoolSearch').reason != null, true)
})

test('P7 dawnOfTheSecondDay 幕：read 3 codex → 推进幕 → 背面阅读法典 17', () => {
  const state = stateWithScenario(1)
  const api = makeApi(state)
  behavior.preScenarioSetup(state, [], api)
  behavior.setupScenario(state, api)
  state.investigators[0].location = 'theCommons'
  for (const id of ['boardingHouse', 'theCrossroads', 'hemlockChapel']) {
    assert.equal(codex(state, id, api), true)
  }
  assert.equal(codexReadCount(state), 3)
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.actIndex, 1)
  assert.equal(state.scenarioFlags.dawnSecondActAdvanced, true)
  assert.equal(codexReadCount(state, 'theCurse'), 1, '幕背面读法典 17')
  assert.equal(api.campaignCards.some(card => card.code === HEMLOCK_CURSE_CODE), true)
  assert.equal(behavior.checkObjectives(state, api), false, '不会重复推进')
})

test('P7 dawnOfTheSecondDay 议程背面：Bertie 获救 → 结局 1，否则结局 2，两者都链到结局 3', () => {
  const rescued = stateWithScenario(1, { records: { bertieWasRescued: true } })
  const api = makeApi(rescued)
  assert.equal(behavior.agendaReveal(rescued, rescued.agendas[0], api), true)
  assert.equal(api.finished, 'resolution3')
  assert.equal(rescued.campaign.records.dawnSecondResolvedTo, 'resolution1')
  assert.equal(rescued.campaign.records.dawnSecondResolution, 'resolution3')
  assert.equal(api.calls.some(call => call.kind === 'present' && call.title === 'Resolution 1'), true)

  const missing = stateWithScenario(1)
  const api2 = makeApi(missing)
  assert.equal(behavior.agendaReveal(missing, missing.agendas[0], api2), true)
  assert.equal(api2.finished, 'resolution3')
  assert.equal(missing.campaign.records.dawnSecondResolvedTo, 'resolution2')
  assert.deepEqual(resolutionChainForKey('resolution1'), ['resolution1', 'resolution3'])
  assert.deepEqual(resolutionChainForKey('resolution2'), ['resolution2', 'resolution3'])
})

test('P7 dawnOfTheSecondDay 议程正面强制：取消抽到的弱点并弃掉（内容层读点已备，待引擎接线）', () => {
  const state = stateWithScenario(1)
  const api = makeApi(state)
  assert.equal(agendaCancelsWeakness(state), true)
  state.investigators[0].hand = ['01006']
  assert.equal(cancelWeaknessDraw(state, state.investigators[0], '01006', api), true)
  assert.equal(state.investigators[0].hand.includes('01006'), false)
  assert.equal(state.investigators[0].discard.includes('01006'), true)
  state.agendas[0].face = 'back'
  assert.equal(agendaCancelsWeakness(state), false)
  assert.equal(cancelWeaknessDraw(state, state.investigators[0], '01006', api), false)
})

test('P7 dawnOfTheSecondDay 结局 3：不记胜利点、记录结局、整备与勘察候选', () => {
  const state = stateWithScenario(1, { records: { areasSurveyed: { pearlRidge: true } } })
  state.scenario.mechanics.survey.destinations = [...SURVEY_DESTINATIONS]
  const api = makeApi(state)
  state.victory = 7
  const result = behavior.resolution(state, 'resolution3', [], api)
  assert.equal(state.victory, 0, '不记录 Victory X')
  assert.equal(result.award, true)
  assert.equal(result.bonus, 0)
  assert.equal(state.campaign.records.dawnSecondResolution, 'resolution3')
  assert.deepEqual(result.surveyDestinations, SURVEY_DESTINATIONS.filter(id => id !== 'theSilentHeath'))
  assert.deepEqual(state.scenario.mechanics.survey.destinations, result.surveyDestinations)
  assert.equal(api.calls.some(call => call.kind === 'info' && call.body.includes('Resolution 3')), true)
  assert.equal(PREPARATION_FOR_NEXT_SURVEY.length, 5)
})

test('P7 dawnOfTheSecondDay Areas Surveyed：兼容对象/数组/平铺记录并过滤候选', () => {
  const objectForm = stateWithScenario(1, { records: { areasSurveyed: { hemlockHarbor: true, akwanShoreline: true } } })
  assert.deepEqual([...surveyedAreas(objectForm)].sort(), ['hemlockHouse', 'theLostSister'].sort())
  assert.deepEqual(surveyDestinations(objectForm), SURVEY_DESTINATIONS.filter(id => !['hemlockHouse', 'theLostSister'].includes(id)))

  const listForm = stateWithScenario(1, { records: { areasSurveyed: ['northPointMine', 'eastwickBog'] } })
  assert.deepEqual(surveyDestinations(listForm), SURVEY_DESTINATIONS.filter(id => !['writtenInRock', 'theThingInTheDepths'].includes(id)))

  const flatForm = stateWithScenario(1, { records: { areasSurveyedWesternWoods: true, areasSurveyedSouthernFields: true } })
  assert.equal(surveyedAreas(flatForm).has('theTwistedHollow'), true)
  assert.equal(surveyedAreas(flatForm).has('theLongestNight'), true)
  assert.equal(surveyDestinations(flatForm).length, 5)
})

test('P7 dawnOfTheSecondDay 下一次勘察整备：保留 1 支援/弃手牌/资源上限/线索保留/不重抽', () => {
  const state = stateWithScenario(1)
  state.scenario.mechanics = normalizeScenarioMechanics(state.scenario.mechanics)
  state.scenario.mechanics.survey = { destinations: ['writtenInRock', 'hemlockHouse'], resolutions: ['resolution3'] }
  state.resolution = 'resolution3'
  const inv = state.investigators[0]
  inv.assets = [
    { id: 'keep-a', code: '01016', originalCode: '01016', controllerSeat: 0, ownerSeat: 0 },
    { id: 'keep-b', code: '01018', originalCode: '01018', controllerSeat: 0, ownerSeat: 0 },
  ]
  inv.hand = ['01088', '01088', '01088', '01088', '01088', '01090']
  inv.resources = 12
  inv.clues = 3
  state.campaign.investigators[0].deck = ['01016', '01018', '01088', '01090']
  const prepared = prepareSurvey(state, {
    choose: spec => spec.options[0].id,
    cardDef: code => ALL_CARDS[code] || null,
    entryOf: () => null,
    investigatorRule: () => ({}),
  })
  assert.equal(prepared, true)
  const parcel = state.campaign.surveyPreparation
  assert.ok(parcel)
  assert.equal(parcel.destinations.length, 2)
  assert.equal(parcel.seats[0].hand.length, 5, '弃至起始手牌数')
  assert.equal(parcel.seats[0].assets.length, 1, '只保留 1 张非起始支援')
  assert.equal(parcel.seats[0].resources, 5, '资源弃至起始资源')
  assert.equal(parcel.seats[0].clues, 3, '线索全部保留')
  restoreSurveyInvestigator(inv, parcel.seats[0], 1)
  assert.equal(inv.surveyOpening, true, '引擎据此跳发起始手牌/重抽（setup.js completeStartingHand 读点）')
  assert.equal(state.campaign.upgradesAllowed, false)
})

// ---------------------------------------------------------------------------
// 6. 居民记录 / 只读投影 / 存档
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 居民记录：关系等级 0–5、笔记去重、划掉标记', () => {
  const state = stateWithScenario(1)
  const api = makeApi(state)
  assert.equal(addRelationship(state, 'leahAtwood', 7, api), 5, '上限 5')
  assert.equal(addRelationship(state, 'leahAtwood', -9, api), 0, '下限 0')
  assert.equal(addNote(state, 'leahAtwood', 'leahSharedADance', api), true)
  assert.equal(addNote(state, 'leahAtwood', 'leahSharedADance', api), false, '笔记不重复')
  assert.deepEqual(notesOf(state, 'leahAtwood'), ['leahSharedADance'])
  assert.equal(behavior.crossOutResident(state, 'leahAtwood', api), true)
  assert.equal(behavior.isCrossedOut(state, 'leahAtwood'), true)
  assert.equal(rememberFact(state, 'youAreRunningAnErrand', api), true)
  assert.equal(rememberFact(state, 'youAreRunningAnErrand', api), false)
  assert.equal(RESIDENTS_SPEC.length, 8)
  for (const row of RESIDENTS_SPEC) {
    assert.equal(row.record.max, 5)
    assert.equal(typeof row.name, 'string')
  }
})

test('P7 dawnOfTheSecondDay 只读投影：summary 汇总天数/法典/关系/时间标记/勘察候选', () => {
  const { state, api } = setup(1)
  behavior.preScenarioSetup(state, [], api)
  state.currentSeat = 0
  state.investigators[0].location = 'theCrossroads'
  codex(state, 'boardingHouse', api)
  const summary = behavior.scenarioSummary(state)
  assert.equal(summary.day, 2)
  assert.equal(summary.codexRead, 1)
  assert.equal(summary.timeMarker, TIME_MARKER_CODE)
  assert.equal(typeof summary.relationships.motherRachel, 'number')
  assert.deepEqual(summary.residentsInPlay.sort(), ['10699'].sort())
  assert.equal(summary.surveyDestinations.length, 5)
})

test('P7 dawnOfTheSecondDay 存档往返：JSON 克隆后记录/法典/居民状态不丢', () => {
  const { state, api } = setup(2)
  behavior.preScenarioSetup(state, [], api)
  state.currentSeat = 0
  state.investigators[0].location = 'boardingHouse'
  codex(state, 'boardingHouse', api)
  addRelationship(state, 'motherRachel', 2, api)
  addNote(state, 'motherRachel', 'motherRachelSharedHerDoubts', api)
  behavior.resolution(state, 'resolution3', [], api)
  const saved = clone(state)
  assert.deepEqual(saved.campaign.records, state.campaign.records)
  assert.deepEqual(saved.scenarioZones.setAsideResidents, state.scenarioZones.setAsideResidents)
  assert.equal(codexReadCount(saved, 'boardingHouse'), 1)
  assert.equal(relationshipLevel(saved, 'motherRachel'), 2)
  assert.deepEqual(notesOf(saved, 'motherRachel'), ['motherRachelSharedHerDoubts'])
  const summary = scenarioSummary(saved)
  assert.equal(summary.day, 2)
  assert.equal(summary.codexRead, 1)
})

// ---------------------------------------------------------------------------
// 7. 文本 / 近似披露 / 钩子完整性
// ---------------------------------------------------------------------------
test('P7 dawnOfTheSecondDay 指南文本：intro/setup/codex/结局齐全，中文缺失已披露', () => {
  assert.equal(SCENARIO_TEXT.heading, 'Prelude: Dawn of the Second Day')
  assert.equal(SCENARIO_TEXT.intro.length > 500, true)
  assert.equal(SCENARIO_TEXT.setupSteps.length, 10)
  assert.equal(SCENARIO_TEXT.setup.length > 500, true)
  assert.equal(SCENARIO_TEXT.specialRules.length, 5)
  assert.equal(SCENARIO_TEXT.specialRules.every(rule => rule.title && rule.body), true)
  assert.equal(SCENARIO_TEXT.codex.motherRachel.motherRachel2.length > 100, true)
  assert.equal(SCENARIO_TEXT.codex.theCurse.body.length > 100, true)
  for (const key of RESOLUTION_KEYS) {
    assert.equal(SCENARIO_TEXT.resolutions[key].title.length > 0, true)
    assert.equal(SCENARIO_TEXT.resolutions[key].body.length > 100, true)
  }
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.equal(/zh translation pending/.test(SCENARIO_TEXT.textStatus), true)
  assert.equal(Array.isArray(SCENARIO_TEXT.chineseGaps), true)
  assert.equal(SCENARIO_TEXT.chineseGaps.length, CHINESE_GAPS.length)
  assert.equal(SCENARIO_TEXT.tooltips.hemlockChapel.search.length > 10, true)
  assert.equal(SCENARIO_TEXT.noteLabels.motherRachel.motherRachelIntervened.length > 0, true)
})

test('P7 dawnOfTheSecondDay 法典条目：16 条（1/3–17）、每条有分支、地点映射完整', () => {
  assert.equal(CODEX_IDS.length, 16)
  assert.equal(CODEX_SPEC.length, 16)
  assert.equal(CODEX_IDS.includes('motherRachel'), true)
  assert.equal(CODEX_IDS.includes('theCurse'), true)
  assert.equal(CODEX_IDS.includes('leahAtwood'), false, '法典 2 不在本序曲')
  assert.equal(Object.keys(CODEX_BY_LOCATION).length, 8)
  for (const entry of CODEX_SPEC) {
    assert.equal(entry.branches.length >= 1, true)
    assert.equal(SCENARIO_TEXT.codex[entry.id].title.length > 0, true)
  }
  assert.equal(chapter.CODEX_NUMBERS.motherRachel, 1)
  assert.equal(chapter.CODEX_NUMBERS.boardingHouse, 9)
  assert.equal(chapter.CODEX_NUMBERS.tadsGeneralStore, 14)
  assert.equal(chapter.CODEX_NUMBERS.theCurse, 17)
  // 共享组条目（10705a/10710a/10693 等）注释引用的 definition 导出。
  assert.equal(chapter.CODEX_ENTRIES.length, 16)
  assert.equal(chapter.CODEX_ENTRY_BY_NUMBER[14].id, 'tadsGeneralStore')
  assert.equal(chapter.CODEX_ENTRY_BY_ID.theCurse.kind, 'step')
  assert.equal(chapter.CODEX_ENTRY_BY_ID.boardingHouse.kind, 'location')
  assert.equal(chapter.CODEX_ENTRY_BY_ID.motherRachel.kind, 'resident')
  assert.equal(chapter.RESIDENT_CODEX_NUMBERS.judithPark, 7)
  assert.equal(chapter.LOCATION_CODEX_NUMBERS.valeSchoolhouse, 15)
  assert.equal(chapter.CODEX_LIMIT_UNLIMITED, 'unlimited')
  assert.equal(chapter.CODEX_LIMIT_SCENARIO, 'scenario')
})

test('P7 dawnOfTheSecondDay 近似逐条披露：approximations 覆盖已知简化', () => {
  assert.equal(Array.isArray(scenarioApproximations), true)
  assert.equal(scenarioApproximations.length >= 8, true)
  const joined = scenarioApproximations.join('\n')
  for (const needle of ['3 条法典', 'Boarding House', 'Old Mill', '牌库顶 9 张', 'Unspent Experience', 'Location Adjacency', 'Downpour', '英文']) {
    assert.equal(joined.includes(needle), true, `披露缺少：${needle}`)
  }
  assert.equal(SCENARIO_TEXT.textStatus.includes('English'), true)
})

test('P7 dawnOfTheSecondDay 行为钩子完整性：引擎需要的读点都存在', () => {
  for (const hook of [
    'introduction', 'preScenarioSetup', 'setupLocations', 'afterDeckSetup', 'actions', 'performAction',
    'cluesGained', 'actReveal', 'agendaReveal', 'checkObjectives', 'resolution', 'resolveChaosToken',
    'chaosTokenValue', 'applyTokenEffect', 'testAutoFail', 'investigatorCanBeDefeated',
  ]) {
    assert.equal(typeof behavior[hook], 'function', `behavior.${hook}`)
  }
  assert.equal(typeof behavior.events, 'object')
  assert.equal(Object.keys(behavior.events).length, 34, '2 个通用入口 + 16 章名 + 16 别名')
  assert.equal(behavior.id, 'dawnOfTheSecondDay')
  assert.equal(behavior.startLocation(), 'boardingHouse')
  assert.equal(behavior.locationsStartRevealed, true)
  assert.equal(scenario.mechanics.noEncounterDeck, true)
  assert.equal(scenario.mechanics.protectInvestigators, true)
  assert.equal(scenario.mechanics.calendar.maximumDay, 3)
  assert.equal(scenario.mechanics.calendar.record, 'hemlockDate')
  assert.equal(scenario.mechanics.survey.destinations.length, 5)
  assert.deepEqual(scenario.mechanics.survey.resolutions, ['resolution3'])
  assert.equal(chapter.resolveCodexEvent === undefined, false)
  assert.equal(typeof behavior.addCampaignCard, 'function')
})

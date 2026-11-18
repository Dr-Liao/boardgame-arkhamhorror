// 九循环《铁杉谷盛宴》P4 浏览器验收的**测试专用**状态种子与 HARNESS 卡。
//
// 只被 tools/run-fhv-interactions-browser.mjs 在验收进程内 import；不进生产组合根、不注册到
// content/、不新增 HTTP 夹具端点。HARNESS 卡的每个 action 调用一个 `api.interactions.fhv`
// 事务（P4 引擎交互层），让浏览器能走真实 HTTP/引擎路径点击真实选择面板。
//
// 状态种子只通过 P2/P4 通用原语写入（scenario.mechanics 的 calendar/codex/residents/survey、
// 网格、轨道载具、独立 token 袋、敌人-地点、调查员形态），因此 `validateMechanicState()` 能通过；
// 卡号/名称只来自卡表数据。夹具使用核心调查员（FHV 调查员仍 catalog-only，不在此开放）。
import { fixture, asset } from './core-fixture.mjs'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { normalizeScenarioMechanics, validateMechanicState } from '../src/engine/mechanic-state.js'
import { setScenarioDate } from '../src/engine/scenario-calendar.js'
import { configureGrid, placeGridLocation } from '../src/engine/grid-map.js'
import { configureRailGrid } from '../src/engine/rail-grid.js'
import { registerVehicle } from '../src/engine/vehicles.js'
import { createTokenBag } from '../src/engine/token-bag.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

export const HARNESS_CODE = 'testFhvInteractions'
export const HOST = 'fhv-fixture-host'
export const CAMPAIGN_ID = 'theFeastOfHemlockVale'
export const DAY_TIME_RECORD = 'dayTime'
export const RESIDENTS = Object.freeze([
  Object.freeze({
    id: 'motherRachel', name: '母亲瑞秋', nameEn: 'Mother Rachel',
    record: Object.freeze({ level: 'motherRachelTrust', notes: 'motherRachelNotes', crossedOut: 'motherRachelGone', max: 4 }),
  }),
  Object.freeze({
    id: 'riverHawthorne', name: '里弗·霍桑', nameEn: 'River Hawthorne',
    record: Object.freeze({ level: 'riverHawthorneTrust', notes: 'riverHawthorneNotes', crossedOut: 'riverHawthorneGone', max: 3 }),
  }),
])
export const CODEX = Object.freeze([
  Object.freeze({
    id: 'motherRachel', limit: 'scenario',
    resident: Object.freeze({ relationship: 'motherRachelTrust', notes: 'motherRachelNotes', crossedOut: 'motherRachelGone' }),
    branches: Object.freeze([
      Object.freeze({ id: 'mr-low', minRelationship: 0, maxRelationship: 1 }),
      Object.freeze({ id: 'mr-mid', minRelationship: 2, maxRelationship: 2, notes: Object.freeze(['helped']) }),
      Object.freeze({ id: 'mr-high', minRelationship: 3 }),
    ]),
  }),
  Object.freeze({ id: 'boardingHouse', limit: 'act', branches: Object.freeze([Object.freeze({ id: 'bh-1' })]) }),
])
export const SURVEY_DESTINATIONS = Object.freeze(['writtenInRock', 'hemlockHouse', 'theSilentHeath'])
export const GRID_SLIDE_PLANS = Object.freeze([
  Object.freeze({ id: 'swap-l2-l3', label: '交换采矿场与十字路口', changes: Object.freeze([
    Object.freeze({ id: 'l2', x: -1, y: 0 }), Object.freeze({ id: 'l3', x: 1, y: 0 }),
  ]) }),
])
export const PREDATION_TOKENS = Object.freeze(['skull', 'elder_thing'])
export const FORM_CODES = Object.freeze(['10016a', '10016b'])

const cardNameZhOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code

function seedHarnessCard(state) {
  if (state.cards[HARNESS_CODE]) return
  state.cards[HARNESS_CODE] = {
    code: HARNESS_CODE, name: '铁杉谷交互验收', nameZh: '铁杉谷交互验收',
    type: 'asset', klass: 'neutral', slots: [], text: 'P4 交互验收夹具',
  }
}

function location(state, id, name, extra = {}) {
  if (state.locations.some(item => item.id === id)) return id
  state.locations.push({
    id, name, nameEn: extra.nameEn || name, code: id, revealed: true, clues: extra.clues || 0,
    shroud: extra.shroud ?? 2, traits: extra.traits || [], connections: [], attachments: [], ...extra,
  })
  return id
}

if (!registeredEntry(HARNESS_CODE)) {
  registerCardAbilities([{
    code: HARNESS_CODE,
    name: '铁杉谷交互验收',
    abilities: [
      { kind: 'action', label: '法典触读',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.codex.read(inv.seat, { source: source.id }) },
      { kind: 'action', label: '序曲整备',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.survey.prepare(inv.seat, { source: source.id }) },
      { kind: 'action', label: '选择下一次勘察',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.survey.chooseNext(inv.seat, { source: source.id }) },
      { kind: 'action', label: '网格放置',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.grid.place(inv.seat, { locationId: 'newSite', source: source.id }) },
      { kind: 'action', label: '网格无空位放置',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.grid.place(inv.seat, { locationId: 'newSite2', source: source.id }) },
      { kind: 'action', label: '地点滑动',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.grid.slide(inv.seat, { plans: GRID_SLIDE_PLANS, source: source.id }) },
      { kind: 'action', label: '矿车前进',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.rail.advance(inv.seat, { source: source.id }) },
      { kind: 'action', label: '道岔转向',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.rail.steer(inv.seat, { source: source.id }) },
      { kind: 'action', label: '猎杀袋抽取',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.predation.draw(inv.seat, { source: source.id }) },
      { kind: 'action', label: '猎杀袋转移',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.predation.draw(inv.seat, {
          targets: [{ id: 'chaos', label: '混乱袋' }], source: source.id,
        }) },
      { kind: 'action', label: '坚毅形态',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.investigatorState.form(inv.seat, {
          forms: FORM_CODES, context: { when: 'wouldDefeat', seat: inv.seat, cause: 'damage' }, source: source.id,
        }) },
      { kind: 'action', label: '线索搬移',         cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.fhv.investigatorState.transferClue(inv.seat, {
          count: 1, traits: ['Science', 'Tool'], emptyTarget: true, source: source.id,
        }) },
    ],
  }])
}

export function fhvInteractionFixture() {
  const s = fixture('01001', 1)
  s.humanSeats = [0]
  s.currentSeat = 0
  s.turnSeat = 0
  s.round = 2
  for (const loc of s.locations) loc.revealed = true
  s.campaign.id = CAMPAIGN_ID
  s.campaign.leadSeat = 0
  s.campaign.records = {
    dayTime: '2:day',
    motherRachelTrust: 2,
    motherRachelNotes: ['helped'],
    motherRachelGone: false,
    riverHawthorneTrust: 1,
    riverHawthorneNotes: [],
    riverHawthorneGone: true,
  }
  const record = s.campaign.investigators[0]
  record.deck = ['01016', '01018', '01088', '01088', '01088', '01088', '01088', '01088']
  record.status = 'active'
  seedHarnessCard(s)
  // HARNESS 支援：牌桌以 data-interaction="asset:<id>" 渲染，动作条调用交互事务。
  asset(s, HARNESS_CODE, { id: HOST, name: '铁杉谷交互验收' })
  // 场景声明：日历 / 法典 / 居民 / 勘察整备列表（内容层 P7 会提供真实清单，这里只做结构夹具）。
  // 场景 id 保持核心夹具的真实注册值（剧情行为与 legalMoves 需要），FHV 机制只替换 mechanics。
  s.scenario.mechanics = normalizeScenarioMechanics({
    calendar: { maximumDay: 3, record: DAY_TIME_RECORD, periodByLocationTrait: 'Dark' },
    codex: CODEX.map(entry => ({ ...entry, branches: entry.branches.map(branch => ({ ...branch })), ...(entry.resident ? { resident: { ...entry.resident } } : {}) })),
    residents: RESIDENTS.map(row => ({ ...row, record: { ...row.record } })),
    survey: { destinations: [...SURVEY_DESTINATIONS], resolutions: null },
  })
  setScenarioDate(s, 2, 'day')
  const runtime = scenarioRuntime(s, [])
  // 地点：当前地点（[[Dark]]，用于局部昼夜覆盖展示）+ 三个邻居 + 两个待放置地点。
  const here = s.investigators[0].location
  location(s, 'l1', '北角矿井', { traits: [] })
  location(s, 'l2', '采矿场', { traits: ['Dark'] })
  location(s, 'l3', '十字路口', { traits: [] })
  location(s, 'newSite', '岩缝', { traits: [] })
  location(s, 'newSite2', '废料堆', { traits: [] })
  const hereLocation = s.locations.find(item => item.id === here)
  hereLocation.traits = [...(hereLocation.traits || []), 'Dark']
  configureGrid(s, { adjacency: 'orthogonal' })
  const place = (id, x, y) => placeGridLocation(s, id, x, y, {}, {})
  place(here, 0, 0)
  place('l1', 0, -1)
  place('l2', 1, 0)
  place('l3', -1, 0)
  // 轨道/矿车：当前地点朝北，北面矿井另有东、西两个出口（前进时需要选择方向）。
  registerVehicle(s, 'mineCart', { location: here, capacity: 4, running: true })
  configureRailGrid(s, 'mineCart', 'north', {
    [here]: ['north', 'east'],
    l1: ['south', 'east', 'west'],
    l2: ['north', 'west'],
    l3: ['east'],
  }, options => configureGrid(s, options))
  s.locations.find(item => item.id === here).connections = ['l1']
  // 独立猎杀袋：剩 2 枚，袋内标记不进入观察投影。
  createTokenBag(s, 'predation', [...PREDATION_TOKENS])
  // 敌人-地点：把当前地点变成双类型实体（调查员在内，同时接受调查/移动与交战/攻击/躲避）。
  runtime.turnLocationIntoEnemy(here, {
    code: 'livingRoom', name: '活化的会客厅', shroud: 3, traits: ['Dark', 'House'],
    fight: 2, evade: 1, health: 4, damage: 1, horror: 1, victory: 0,
  })
  // 夹具把该敌人-地点置为横置：让验收动作不被借机攻击的演出打断（合法动作集合不变）。
  const enemyLocationEntity = s.enemies.find(item => item.id === here)
  if (enemyLocationEntity) enemyLocationEntity.exhausted = true
  // 调查员状态：受控支援（可接收线索的 Science/Tool 与已带线索的对照），初始 2 条线索。
  // 用未注册行为的测试卡号，避免带出与验收无关的快速窗口能力；特质与线索只由夹具声明。
  for (const [code, name] of [['testClueScience', '实验装置'], ['testClueTool', '便携工具']]) {
    if (!s.cards[code]) s.cards[code] = { code, name, nameZh: name, type: 'asset', traits: [] }
  }
  asset(s, 'testClueScience', { id: 'fhv-science', traits: ['Science'], clues: 0 })
  asset(s, 'testClueTool', { id: 'fhv-tool', traits: ['Tool'], clues: 0 })
  s.investigators[0].clues = 2
  s.investigators[0].damage = 0
  s.investigators[0].actionsLeft = 30
  // 序曲整备验收：手牌 6 > 开手上限 5，资源 30 > 起始资源 5（整备后应收敛到 5/5）。
  s.investigators[0].hand = ['01088', '01088', '01088', '01088', '01088', '01090']
  s.investigators[0].resources = 30
  s.legalMoves = legalMoves(s, 0)
  validateMechanicState(s)
  return s
}

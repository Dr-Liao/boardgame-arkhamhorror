// 八循环《绯红密钥》P4 浏览器验收的**测试专用**状态种子与 HARNESS 卡。
//
// 只被 tools/run-tsk-interactions-browser.mjs 在验收进程内 import；不进生产组合根、不注册到
// content/、不新增 HTTP 夹具端点。HARNESS 卡的每个 action 调用一个 `api.interactions.tsk`
// 事务（P4-A 引擎交互层），让浏览器能走真实 HTTP/引擎路径点击真实选择面板。
//
// 状态种子只通过 P2/P4 通用原语写入（concealedRepository / scarlet keys / hollow / world map /
// customization / crossSeat），因此 `validateTskState()` 能通过；卡号/名称只来自卡表数据。
import { fixture, asset } from './core-fixture.mjs'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

export const HARNESS_CODE = 'testTskInteractions'
export const HOST = 'tsk-fixture-host'
export const LOCATION = 'hallway'
export const OTHER_LOCATION = 'study'
export const WORLD_MAP = Object.freeze({
  nodes: [
    { id: 'hub', connections: ['market', 'port'] },
    { id: 'market', connections: ['hub', 'green1'] },
    { id: 'green1', type: 'side', connections: ['market', 'port'] },
    { id: 'port', connections: ['hub', 'green1', 'far'] },
    { id: 'far', type: 'locked', connections: ['port'] },
  ],
})
export const WORLD_START = 'hub'
export const WORLD_UNLOCKED = Object.freeze(['hub', 'market', 'port', 'green1'])
export const WORLD_FORCED = 'far'
export const KEY_SPECS = Object.freeze([
  Object.freeze({ id: 'keyCrimson', stableFace: 'keyCrimsonStable', unstableFace: 'keyCrimsonUnstable' }),
  Object.freeze({ id: 'keySable', stableFace: 'keySableStable', unstableFace: 'keySableUnstable' }),
])
export const HOLLOW_CODES = Object.freeze(['09059', '09079'])
export const CUSTOM_CODE = 'testTskCustom'
export const CUSTOM_OPTIONS = Object.freeze([
  Object.freeze({ name: '一档强化', checks: 2, text: '勾选 1 格：+1 技能；勾选 2 格：+2 技能' }),
  Object.freeze({ name: '二档强化', checks: 2, text: '勾选 2 格：额外效果' }),
])
export const CUSTOM_XP = 4

const cardNameZhOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code

function seedHarnessCard(state) {
  if (state.cards[HARNESS_CODE]) return
  state.cards[HARNESS_CODE] = {
    code: HARNESS_CODE, name: '绯红密钥交互验收', nameZh: '绯红密钥交互验收',
    type: 'asset', klass: 'neutral', slots: [], text: 'P4 交互验收夹具',
  }
}
function seedCardNames(state, codes) {
  for (const code of codes) {
    if (state.cards[code] || !ALL_CARDS[code]) continue
    state.cards[code] = { code, name: ALL_CARDS[code].name, nameZh: cardNameZhOf(code), type: ALL_CARDS[code].type }
  }
}

if (!registeredEntry(HARNESS_CODE)) {
  registerCardAbilities([{
    code: HARNESS_CODE,
    name: '绯红密钥交互验收',
    abilities: [
      { kind: 'action', label: '隐匿揭露', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.concealed.expose(inv.seat, { source: source.id }) },
      { kind: 'action', label: '密钥变换', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.keys.shift(inv.seat, { source: source.id }) },
      { kind: 'action', label: '密钥夺取', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.keys.transfer(inv.seat, { steal: true, source: source.id }) },
      { kind: 'action', label: '空洞回收', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.hollows.recall(inv.seat, { to: 'deck', source: source.id }) },
      { kind: 'action', label: '世界地图启程', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.map.embark(inv.seat, { graph: WORLD_MAP, source: source.id }) },
      { kind: 'action', label: '快捷旅票', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.map.embark(inv.seat, { graph: WORLD_MAP, expedite: true, source: source.id }) },
      { kind: 'action', label: '定制勾选', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.customizable.upgrade(inv.seat, { code: CUSTOM_CODE, availableXp: CUSTOM_XP, source: source.id }) },
      { kind: 'action', label: '跨座位授权', cost: { action: true },
        resolve: ({ inv, source, api }) => api.interactions.tsk.crossSeat.grant(inv.seat, { source: source.id }) },
      { kind: 'action', label: '跨座位执行', cost: { action: true },
        resolve: ({ api }) => api.interactions.tsk.crossSeat.take(1) != null },
    ],
  }])
}

export function tskInteractionFixture() {
  const s = fixture('01001', 2)
  s.humanSeats = [0, 1]
  s.currentSeat = 0
  s.turnSeat = 0
  s.investigators[1].location = s.investigators[0].location
  for (const loc of s.locations) loc.revealed = true
  s.locations[0].clues = 0
  const currentLocation = s.investigators[0].location
  scenarioRuntime(s, []).place(LOCATION)
  const otherLocation = LOCATION !== currentLocation
    ? LOCATION
    : ((s.locations.find(loc => loc.id !== currentLocation) || {}).id || currentLocation)
  seedHarnessCard(s)
  seedCardNames(s, [...HOLLOW_CODES])
  s.storyAssets ||= []
  const api = createMechanicsApi(s)

  // 支援区 HARNESS 卡（牌桌以 data-interaction="asset:<id>" 渲染，动作条调用交互事务）。
  asset(s, HARNESS_CODE, { id: HOST, name: '绯红密钥交互验收', slots: [] })

  // 隐匿迷你卡：当前地点 2 张（左/右）+ 另一地点 1 张；身份只在揭露后才可见。
  api.tsk.concealed.setInShadows(s.investigators[0].location, true)
  api.tsk.concealed.place({ kind: 'CoterieAgentA', decoy: false, locationId: s.investigators[0].location, position: 'left' })
  api.tsk.concealed.place({ kind: 'Decoy', decoy: true, locationId: s.investigators[0].location, position: 'right' })
  if (otherLocation !== currentLocation) {
    api.tsk.concealed.place({ kind: 'CoterieAgentB', decoy: false, locationId: otherLocation, position: 'middle' })
  }

  // 绯红密钥：一把由座位 0 持有（变换候选），一把由座位 1 持有（夺取候选）。
  api.tsk.keys.initialize(KEY_SPECS)
  api.tsk.keys.bind('keyCrimson', { type: 'investigator', seat: 0 })
  api.tsk.keys.bind('keySable', { type: 'investigator', seat: 1 })

  // 空洞区：两张全队空洞卡。
  for (const code of HOLLOW_CODES) api.tsk.hollow.hollow({ code, scope: 'team', source: 'deck' })

  // 世界地图：当前 hub，已解锁 4 个节点，时间未到强制阈值。
  api.tsk.map.initialize({ graph: WORLD_MAP, start: WORLD_START, unlocked: [...WORLD_UNLOCKED], forcedNode: WORLD_FORCED })

  // 定制卡：注册选项（全局注册表，每个服务器进程只注册一次）并预勾选 1 格（升级候选 = 剩余 3 格）。
  if (!api.tsk.customizable.options(CUSTOM_CODE)) api.tsk.customizable.registerOptions({ [CUSTOM_CODE]: CUSTOM_OPTIONS })
  api.tsk.customizable.upgrade({ seat: 0, code: CUSTOM_CODE, checked: [0], availableXp: CUSTOM_XP })

  // 密档：解锁并读取一份，另一份锁定（锁定内容不得出现在观察投影）。
  api.tsk.map.dossiers.unlock('file-5-A')
  api.tsk.map.dossiers.read('file-5-A')

  s.legalMoves = legalMoves(s, 0)
  validateTskState(s)
  return s
}

// 七循环《地球边缘》（EotE）P6 一般玩家卡浏览器验收的**测试专用**状态夹具。
//
// 只被 tools/run-eote-player-browser.mjs 在验收进程内通过 createState 包装注入；不进生产注册、
// 不加 HTTP 调试端点。夹具用真实引擎 `createGameState`（core-fixture）构造完整可玩状态，
// 再按卡表数据注入代表性 EotE 玩家卡，供浏览器 UI 真实点击：事件（08020 Toe to Toe）、
// 资产（08025 Butterfly Swords）、技能（08024 Defensive Stance）、基础弱点（08130 Arm Injury）。
//
// wave 条目若尚未进入生成索引，本文件会在 createGameState 之后按需 `registerCardAbilities`
// 手动注册（仅服务端夹具进程；浏览器 spec 独立进程不 import 引擎）。
import { fixture, enemy } from './core-fixture.mjs'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

export const EVENT_CODE = '08020'
export const ASSET_CODE = '08025'
export const SKILL_CODE = '08024'
// 印刷 [wild] 图标的技能卡：用于真实 commit 窗口的可投入证据（08024 是动态图标，
// 引擎测试路径把 skillList 数组传给 commitIcons 时其 iconBonus 返回 0，见 spec annotation）。
export const COMMIT_SKILL_CODE = '08052'
export const WEAKNESS_CODE = '08130'
export const HAND_CODES = Object.freeze([EVENT_CODE, SKILL_CODE, ASSET_CODE, '08021', COMMIT_SKILL_CODE])
export const MANUAL_ENTRY_CODES = Object.freeze([EVENT_CODE, ASSET_CODE, SKILL_CODE, COMMIT_SKILL_CODE, WEAKNESS_CODE, '08021'])

// 预加载 wave 条目（仅 import，不注册）：runner 在 createGameState 之前调用，
// 由夹具在创建状态（完整 entries/index 已注册）之后补注册索引缺失的条目。
export async function loadPlayerEntries() {
  const entries = []
  for (const code of MANUAL_ENTRY_CODES) {
    if (registeredEntry(code)) continue
    try {
      const module = await import(`../src/cards/entries/${code}.js`)
      if (module?.default?.code === code) entries.push(module.default)
    } catch {
      // 条目尚未落盘：保留卡面数据，行为测试会按可达子集降级（spec 记录 annotation）。
    }
  }
  return entries
}

export function eotePlayerFixture(prefetchedEntries = []) {
  // 普通核心调查员（Roland，守卫者）1 席：EotE 玩家卡按卡表注入，不依赖构筑/可用性开放。
  const s = fixture('01001', 1)
  // createGameState 之后补注册索引缺失的 wave 条目（不能在此之前注册，否则 engine 会跳过整份 index）。
  const missing = prefetchedEntries.filter(entry => entry?.code && !registeredEntry(entry.code))
  if (missing.length) registerCardAbilities(missing)
  s.humanSeats = [0]
  s.currentSeat = 0
  s.turnSeat = 0
  scenarioRuntime(s, []).place('hallway')
  for (const loc of s.locations) loc.revealed = true
  const location = s.investigators[0].location
  s.locations.find(loc => loc.id === location).clues = 2
  s.locations.find(loc => loc.id === location).shroud = 2
  s.investigators[0].hand = [...HAND_CODES]
  // 牌库顶 = 数组末尾：把弱点放在顶牌，抽牌即触发显现（draw 动作由真实 UI 点击）。
  s.investigators[0].deck = [...Array(9).fill('01088'), WEAKNESS_CODE]
  s.investigators[0].resources = 30
  s.investigators[0].actionsLeft = 20
  // 同地点已交战敌人：供事件/资产卡的战斗效果有真实目标。
  enemy(s, { name: 'P6 测试敌人', fight: 2, evade: 2, health: 6, damage: 1, horror: 1, damageTaken: 0 })
  s.legalMoves = legalMoves(s, 0)
  return s
}

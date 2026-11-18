// 九循环《铁杉谷盛宴》（FHV）P6 一般玩家卡浏览器验收的测试专用状态夹具。
// 只被 tools/run-fhv-player-browser.mjs 在验收进程内通过 createState 包装注入；不进生产注册。
// 不加 HTTP 调试端点。夹具用真实引擎 fixture（core-fixture）构造完整可玩状态，再按卡表注入
// 代表性 FHV 玩家卡，供浏览器 UI 真实点击：
//   事件 10027 Task Force（Double：额外花费 1 行动）/ 资产 10021 Katana（武士刀，[action] 攻击）/
//   技能 10029 Purified / 基础弱点 10135 Maimed Hand（抽牌即显现进威胁区）。
// 条目若尚未进入生成索引，本文件会在 createGameState 之后按需 registerCardAbilities 手动注册。
import { fixture, enemy } from './core-fixture.mjs'
import { legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

export const EVENT_CODE = '10027'
export const ASSET_CODE = '10021'
export const ASSET2_CODE = '10019'
export const SKILL_CODE = '10029'
export const WEAKNESS_CODE = '10135'
export const POOL_CODES = Object.freeze(['10027', '10019', '10029', '10020'])
export const HAND_CODES = Object.freeze([EVENT_CODE, ASSET_CODE, SKILL_CODE, ASSET2_CODE])
export const MANUAL_ENTRY_CODES = Object.freeze([EVENT_CODE, ASSET_CODE, SKILL_CODE, ASSET2_CODE, WEAKNESS_CODE])

export async function loadPlayerEntries() {
  const entries = []
  for (const code of MANUAL_ENTRY_CODES) {
    if (registeredEntry(code)) continue
    try {
      const module = await import(`../src/cards/entries/${code}.js`)
      if (module?.default?.code === code) entries.push(module.default)
    } catch {
      // 条目尚未落盘：夹具仍可用，对应用例按可达子集记录 annotation。
    }
  }
  return entries
}

export function fhvPlayerFixture(prefetchedEntries = []) {
  const s = fixture('01001', 1)
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
  // 牌库顶 = 数组末尾：把弱点放在顶牌，抽牌即触发显现。
  s.investigators[0].deck = [...Array(9).fill('01088'), WEAKNESS_CODE]
  s.investigators[0].resources = 30
  s.investigators[0].actionsLeft = 20
  enemy(s, { name: 'P6 测试敌人', fight: 2, evade: 2, health: 6, damage: 1, horror: 1, damageTaken: 0 })
  s.legalMoves = legalMoves(s, 0)
  return s
}

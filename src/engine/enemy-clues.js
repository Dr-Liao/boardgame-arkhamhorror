// 敌人身上的线索（卡尔克萨「异教徒」机制）：卡片把线索移到敌人身上的唯一写入口。
//
// 2026-10-28 P2-6：03098 / 03099 / 03100 / 03144 / 03145 原先各自直写
// `location.clues--` / `enemy.clues = …`，同一句卡文有 5 份实现；这里收口成两个原语，
// 玩家卡 api（api-clue.js）与遭遇卡 api（scenario-runtime.js）共用。
//
// 卡面模板只有两种来源（原语用 options.from 区分）：
//   1. 'location'（默认）：敌人所在地点的 1 个线索 → 该敌人
//      （03098 狂徒入场 / 03100 王之法令 / 03144 卡尔克萨探求者神话阶段结束）
//   2. 'investigator'：该调查员（options.seat）的 1 个线索 → 敌人
//      （03099 王之特使攻击后 / 03145 引入歧途「将你的 1 个线索放置到一个异教徒敌人上」）
//
// 「往事回声」的议程强制效果：有线索放到敌人身上后立刻翻成毁灭面。判定读当前议程定义上的
// `clueToDoom`（由 echoesOfThePast/definition.js 写入），在其他关卡里是安全的空操作。
// 该判定原先在 _shared.js 的条目辅助函数里，随本批原语一起搬到引擎侧（条目只调 api）。
import { syncClues } from './locations.js'

function flipCluesToDoom(state, enemy) {
  const agenda = state.agendas?.[state.agendaIndex]
  if (!agenda?.clueToDoom) return 0
  const flipped = Number(enemy.clues) || 0
  if (!flipped) return 0
  enemy.doom = (Number(enemy.doom) || 0) + flipped
  enemy.clues = 0
  return flipped
}

/**
 * 把一个线索移动到敌人身上。
 * @param {object} state 权威状态
 * @param {object} enemy 目标敌人实例
 * @param {object} [options] { from: 'location' | 'investigator', seat }
 * @returns {number} 实际移动数量（0 = 来源没有线索或参数非法）
 */
export function moveClueToEnemy(state, enemy, options = {}) {
  if (!state || !enemy) return 0
  if (options.from === 'investigator') {
    const owner = state.investigators?.[options.seat]
    if (!owner || (Number(owner.clues) || 0) < 1) return 0
    owner.clues -= 1
    syncClues(state)
  } else {
    const location = (state.locations || []).find(item => item.id === enemy.location)
    if (!location || (Number(location.clues) || 0) < 1) return 0
    location.clues -= 1
  }
  enemy.clues = (Number(enemy.clues) || 0) + 1
  flipCluesToDoom(state, enemy)
  return 1
}

/**
 * 取走敌人身上的全部线索（「击败它时控制其所有线索」）。返回取走的数量，不做转移。
 * @param {object} enemy 目标敌人实例
 * @returns {number} 被取走的线索数量
 */
export function clearCluesOnEnemy(enemy) {
  const cleared = Number(enemy?.clues) || 0
  if (enemy) enemy.clues = 0
  return cleared
}

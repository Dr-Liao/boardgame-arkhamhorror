// 取消/忽略效果的公开记账 —— 第 5 步 M1 调查员批次（P6）。
//
// 印刷场景：黛安娜·史丹利「你拥有的一张卡牌取消或忽略卡牌效果或游戏效果后，如果黛安娜·
// 史丹利底下的卡牌数量少于 5 张：将该卡牌正面朝下放在她底下。抽取 1 张卡牌并获得 1 资源。
// （每阶段仅限一次。）」
//
// 引擎此前没有「谁取消了什么」的统一事实：取消分散在 `rt.cancelPending`（敌人攻击/诡计）、
// `api.cancelHarm`（伤害/恐惧）、`api.cancelEncounterDraw`（遭遇卡）、以及直接写
// `state._reaction.cancelled` 的旧路径。本文件把那件事收敛成一个函数：
//
//   noteCardCancelled(reactionWindow, state, events, { seat, what })
//
// 上下文读的是 `state._resolvingCardCode` / `_resolvingSeat` —— 由 executeDescriptor 在
// 结算期间写入（「正在结算的是哪张卡」）。这样取消方卡号不需要每个调用点各传一次，
// 也不会因为新增取消路径而漏记。
//
// 约定：只在**卡牌效果**取消时记账；「跳过」类（不取消任何东西）不记账。

import { noteCancelInFrame } from './resolution-scope.js'

export function noteCardCancelled(reactionWindow, state, events, { seat = null, what = null } = {}) {
  const cardCode = state?._resolvingCardCode || null
  const cardSeat = state?._resolvingSeat ?? seat
  if (!cardCode) return null
  // 2026-10-25 第五轮修复 05004：标记「本次描述子结算内已经记过账」（进程内帧，不写 state）。
  noteCancelInFrame()
  const owner = numberSeat(state, cardSeat)
  const context = {
    when: 'cardCancelled',
    seat: cardSeat ?? seat,
    cardSeat: cardSeat ?? seat,
    location: owner?.location ?? null,
    cardCode,
    what: what || null,
    prompt: `${owner?.name || '调查员'} 的「${cardCode}」取消了一项效果`,
  }
  // 2026-10-25 修复：取消记账窗口经常发生在「正在结算一张快速反应卡」的上下文里
  // （playReactionCard 会先写 state._reaction），旧代码被嵌套保护吞掉，黛安娜 05004 的核心
  // 反应因此永远不触发。cardCancelled 是卡牌取消后的独立时点，必须允许嵌套开窗。
  reactionWindow(state, 'cardCancelled', context, events, { allowNested: true })
  return context
}

function numberSeat(state, seat) {
  if (!Number.isInteger(seat)) return null
  return state.investigators?.[seat] || null
}

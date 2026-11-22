// 90038 潮汐信物（Tidal Memento）· 中立 · 支援/道具/守护 · 温蒂·亚当斯（平行）牌库专用 · 永久。
//
// 卡面（cards-data 90038）：
//   Wendy Adams deck only. Permanent.
//   [reaction] When an enemy would ready or doom would be placed on it, release a [bless] or
//     [curse] token sealed on that enemy: Cancel that effect.
//   [reaction] During a skill test you are performing, when a chaos token would be revealed from
//     the chaos bag: Resolve a [bless] or [curse] token sealed on an enemy instead.
//
// 引擎读点与缺口：
//   · 永久卡：entry 无 behavior 时也由 setup.js 的 permanent 分支开局入场（`cardDef(code).permanent`），
//     不需要 setup 描述子。
//   · 「敌人将要重整时」：窗口表没有 `enemyWouldReady`（只有 reaction 型 `enemyReadied`，是「重整后」），
//     无法取消 → 已排队 primitive-requests/core-inv-90038-enemy-would-ready-window.json。
//   · 「敌人身上将要放置毁灭时」：窗口表登记了 `doomWouldBePlaced`（interrupt），但引擎里没有调用点
//     （注册 ≠ 接线），同样无法取消 → 同一 request。
//   · 「改为结算敌人上封印的 bless/curse 标记」：`beforeChaosTokenReveal` 窗口存在，但 API 只有
//     `addChaosRevealCancellation`（取消）与 `modifyChaosRevealEffect`（改效果），没有「把本次揭示
//     替换成另一枚已封印标记」的接口 → 请求 `replaceRevealedChaosTokenWithSealed`。
//   · 释放封印标记的读面已就绪：`api.sealedTokensFrom(card)` / `api.releaseSealedToken(card, token)`、
//     敌人实例带 id；`api.sealChaosTokenFromBag(token, enemy)` 由 90037 使用。
//
// 因此本条目只声明数据与 note；行为等 Lead 实现上述两个原语后补 abilities。

const code = '90038'

export default {
  code,
  abilities: [],
  modifiers: [],
  note: '声明：永久支援（setup 入场的读点是 cardDef.permanent，非本条目）。待原语：enemyWouldReady/doomWouldBePlaced 的取消窗口、以及「用敌人上封印标记替换本次揭示」的替换 API（primitive-requests/core-inv-90038-enemy-would-ready-window.json、core-inv-90038-sealed-token-reveal-replacement.json）。',
}

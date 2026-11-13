// 09560 来访名片（Calling Card）· treachery（附属在地点上）
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   显现 - 附属到没有标的且没有附属来访名片的地点。
//   来访名片在场上时，不能（在任何地点）花费线索。
//   [reaction] 在你成功调查所附属地点且超过难度至少 2 点后：弃掉来访名片。查看任意地点一张
//   隐匿迷你卡牌的已揭示面（不将其揭露）。
//
// 实现口径：
//   · `treacheryRule.resolveKind` → behavior 的 callingCard（选地点并附属到 location.attachments）；
//   · `treacheryRule.attachment: true` 标记它住在 location.attachments（behavior 的
//     `cluesSpendBlocked()` 与附属目标过滤共用这一读点）；
//   · `treacheryRule.blocksClueSpendingEverywhere` → behavior 的 `cluesSpendBlocked()`：
//     本章的地点行动、谈判折扣与调查后花费线索全部因它关闭。
//   · 引擎没有「禁止花费线索」的 capability（capability 表里只有 discoverClue），
//     玩家卡侧的通用花费线索尚未被拦；已登记原语请求 extend.capabilitySpendClues。
export default {
  code: '09560',
  scope: 'treachery',
  implemented: true,
  simplified: true,
  treacheryRule: {
    resolveKind: 'callingCard',
    attachment: true,
    blocksClueSpendingEverywhere: true,
  },
  note: '近似：附属与「不能花费线索」只覆盖本章 content 的花费点（地点行动/谈判折扣）；玩家卡与引擎通用花费线索的拦截需要新 capability，已登记原语请求 extend.capabilitySpendClues。「成功调查超过 2 点后弃掉并查看迷你卡」尚未接调查窗口，同在请求里。',
}

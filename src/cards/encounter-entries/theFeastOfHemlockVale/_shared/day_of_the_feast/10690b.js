// 10690b 十字路口 · 地点（Day of the Feast · 晚上面 [Evening]）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10690b）：[[毒堇谷]]。[[中心]]。晚上面。帷幕 3，线索 0，连接符号 ◆ →
//   ▲ / ■ / ★ / ● / ♥ / ☾。
//   [action]：谈判。你催促当地人提供帮助。检定[意志](3)。如果你检定成功，从你的调查员身上把
//     1 点伤害移动到十字路口的一个[[居民]]敌人上。
//
// 读点（数据型条目，规则在章节层）：preludeTheFinalEvening 用晚上面（LOCATION_TABLE 的 evening 行）；
//   谈判行动（意志 3 + 把 1 点伤害移到[[居民]]敌人）由该章 behavior 的地点行动读点结算。
export default {
  code: '10690b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale', 'Central'],
    side: 'evening', period: 'night', oppositeCode: '10690a', mirrorsCode: '10706b',
    printedShroud: 3, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'diamond',
    connectsTo: ['triangle', 'square', 'star', 'circle', 'heart', 'moon'],
    central: true,
    parley: true,
    actionTest: { skill: 'willpower', difficulty: 3 },
    onSuccessMoveDamageToResidentEnemyHere: 1,
  },
  note: '数据型地点条目：晚上面由 preludeTheFinalEvening 摆出；谈判行动在章节 behavior 的地点行动读点。',
  abilities: [],
}

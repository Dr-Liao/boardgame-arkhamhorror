// 08634 迷宫房间（Labyrinthine Chamber）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   在本地点的技能检定期间，每次揭示混乱标记，如果本地点上的钥匙或者本地点一位调查员控制的钥匙与该混乱标记一致，将该混乱标记的修正值翻倍。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08634",
  scope: "location",
  implemented: true,
  locationRule: {
    flags: {
      doubleKeyTokenModifier: true
    }
  }
}

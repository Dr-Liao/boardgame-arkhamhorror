// 08637 破败街道（Ruinous Streets）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   强制 - 当你在破败街道的技能检定期间揭示1个或更多[frost]混乱标记后：受到1点伤害。
//   [reaction]你发现破败街道上最后的线索后：发现一个连接地点的1个线索。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08637",
  scope: "location",
  implemented: true,
  locationRule: {
    flags: {
      frostForcedDamage: 1
    },
    actions: [
      {
        rule: "streetsReactionClue",
        label: "发现破败街道最后一个线索后：发现连接地点 1 线索"
      }
    ]
  }
}

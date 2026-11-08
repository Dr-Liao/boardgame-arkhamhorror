// 08640 古老者之庙（Temple of the Elder Things）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   强制 - 当你在本地点的一次技能检定期间揭示1个或更多[frost]混乱标记后：受到1点恐惧。
//   [action]如果古老者之庙没有线索：选择2个有钥匙的地点。交换这些地点的所有钥匙。(团队每场游戏仅限一次)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08640",
  scope: "location",
  implemented: true,
  locationRule: {
    flags: {
      frostForcedHorror: 1
    },
    actions: [
      {
        rule: "swapKeys",
        label: "若古老者之庙没有线索：交换两个有钥匙地点的所有钥匙（团队每场一次）",
        teamOnce: true
      }
    ]
  }
}

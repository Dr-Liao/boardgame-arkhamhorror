// 08636 无顶堡垒（Roofless Rampart）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个“-1”钥匙：移除密谋上的1个毁灭标记，或者选择并弃掉场上1个非[[精英]]敌人或诡计。在剧本日志中记录队伍发现了一个古代墓穴。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08636",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "rampartStudy",
        values: [
          "-1",
          "-1"
        ],
        remember: "theTeamStudiedTheHistoryOfTheElderThings",
        label: "花费 2 个「-1」钥匙：移除密谋 1 毁灭，或弃掉一个非精英敌人/诡计（记录）"
      }
    ]
  }
}

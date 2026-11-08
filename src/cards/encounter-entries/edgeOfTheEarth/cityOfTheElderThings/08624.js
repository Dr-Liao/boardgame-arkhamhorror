// 08624 错综复杂之城(版本一)（Sprawling City (v. I)）· act
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个[elder_thing]钥匙：请记住队伍“研究了古老者的历史”。
//   [action]花费2个[tablet]钥匙：请记住队伍“了解了修格斯的起源”。
//   目标 - 如果队伍“研究了古老者的历史”且“了解了修格斯的起源”，推进场景。
// 背面：将放在一边的修格斯遭遇组和遭遇弃牌库混洗入遭遇牌库。 / 你知道去地下城市的通路。揭示隐秘隧道。 / 将放在一边的星之恐怖敌人放置入场，位于隐秘隧道，处于横置状态。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08624",
  scope: "act",
  implemented: true,
  actRule: {
    version: "v1",
    objective: {
      type: "cityKeys",
      remember: [
        "theTeamStudiedTheHistoryOfTheElderThings",
        "theTeamDiscernedTheOriginOfTheShoggoths"
      ]
    },
    keyActions: [
      {
        action: "studyHistory",
        values: [
          "elderthing",
          "elderthing"
        ],
        remember: [
          "theTeamStudiedTheHistoryOfTheElderThings"
        ],
        label: "花费 2 个 [elder_thing] 钥匙：研究古老者的历史"
      },
      {
        action: "discernShoggoths",
        values: [
          "tablet",
          "tablet"
        ],
        remember: [
          "theTeamDiscernedTheOriginOfTheShoggoths"
        ],
        label: "花费 2 个 [tablet] 钥匙：了解修格斯的起源"
      }
    ],
    onReveal: "act1BackV1"
  }
}

// 08626 错综复杂之城(版本三)（Sprawling City (v. III)）· act
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个[tablet]钥匙：请记住队伍“了解了修格斯的起源”。
//   [action]花费2个[cultist]钥匙：请记住队伍“发现了隐藏的力量”。
//   目标 - 如果队伍“了解了修格斯的起源”且“发现了隐藏的力量”，推进场景。
// 背面：将放在一边的修格斯遭遇组和遭遇弃牌库混洗入遭遇牌库。 / 你知道去地下城市的通路。揭示隐秘隧道。 / 按玩家顺序，每位调查员抽取遭遇牌库顶的1张卡牌。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08626",
  scope: "act",
  implemented: true,
  actRule: {
    version: "v3",
    objective: {
      type: "cityKeys",
      remember: [
        "theTeamDiscernedTheOriginOfTheShoggoths",
        "theTeamDiscoveredAHiddenPower"
      ]
    },
    keyActions: [
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
      },
      {
        action: "hiddenPower",
        values: [
          "cultist",
          "cultist"
        ],
        remember: [
          "theTeamDiscoveredAHiddenPower"
        ],
        label: "花费 2 个 [cultist] 钥匙：发现隐藏的力量"
      }
    ],
    onReveal: "act1BackV3"
  }
}

// 08625 错综复杂之城(版本二)（Sprawling City (v. II)）· act
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个[elder_thing]钥匙：请记住队伍“研究了古老者的历史”。
//   [action]花费2个[cultist]钥匙：请记住队伍“发现了隐藏的力量”。
//   目标 - 如果队伍“研究了古老者的历史”且“发现了隐藏的力量”，推进场景。
// 背面：将放在一边的冰中生物遭遇组和遭遇弃牌库混洗入遭遇牌库。 / 你知道去地下城市的通路。揭示隐秘隧道。 / 在混乱袋里加入1个[frost]标记。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08625",
  scope: "act",
  implemented: true,
  actRule: {
    version: "v2",
    objective: {
      type: "cityKeys",
      remember: [
        "theTeamStudiedTheHistoryOfTheElderThings",
        "theTeamDiscoveredAHiddenPower"
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
    onReveal: "act1BackV2"
  }
}

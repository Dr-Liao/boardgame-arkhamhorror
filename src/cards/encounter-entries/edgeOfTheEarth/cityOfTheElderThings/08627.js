// 08627 追寻未知(版本一)（Pursuit of the Unknown (v. I)）· act
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个[cultist]钥匙：每位调查员可以治愈1点伤害、1点恐惧和1点创伤。
//   目标 - 如果每位没有被击败的调查员都在隐秘隧道，且隐秘隧道没有线索，推进场景。
// 背面：(→结局1)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08627",
  scope: "act",
  implemented: true,
  actRule: {
    version: "v1",
    objective: {
      type: "hiddenTunnel"
    },
    actTwoActions: [
      {
        action: "healAll",
        values: [
          "cultist",
          "cultist"
        ],
        label: "花费 2 个 [cultist] 钥匙：每位调查员治愈 1 伤害、1 恐惧、1 创伤"
      }
    ],
    onReveal: "resolution1"
  }
}

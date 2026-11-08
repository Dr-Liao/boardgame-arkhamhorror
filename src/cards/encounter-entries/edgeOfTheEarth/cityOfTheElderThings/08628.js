// 08628 追寻未知(版本二)（Pursuit of the Unknown (v. II)）· act
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个[tablet]钥匙：每位调查员查找各自牌库，找出所有忒咳哩-哩弱点，将这些弱点混洗入忒咳哩-哩牌库，然后混洗各自牌库。
//   目标 - 如果每位没有被击败的调查员都在隐秘隧道，且隐秘隧道没有线索，推进场景。
// 背面：(→结局1)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08628",
  scope: "act",
  implemented: true,
  actRule: {
    version: "v2",
    objective: {
      type: "hiddenTunnel"
    },
    actTwoActions: [
      {
        action: "returnTekeliWeaknesses",
        values: [
          "tablet",
          "tablet"
        ],
        label: "花费 2 个 [tablet] 钥匙：把忒咳哩-哩弱点洗回牌库"
      }
    ],
    onReveal: "resolution1"
  }
}

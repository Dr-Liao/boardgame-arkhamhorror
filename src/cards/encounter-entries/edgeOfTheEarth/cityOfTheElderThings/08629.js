// 08629 追寻未知(版本三)（Pursuit of the Unknown (v. III)）· act
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   强制 - 在一个[[修格斯]]或[[精英]]敌人进入一个地点时：击败该地点的所有[[古老者]]敌人。
//   [action]花费2个[elder_thing]钥匙：从混乱袋里移除所有[elder_thing]标记。
//   目标 - 如果每位没有被击败的调查员都在隐秘隧道，且隐秘隧道没有线索，推进场景。
// 背面：(→结局1)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08629",
  scope: "act",
  implemented: true,
  actRule: {
    version: "v3",
    objective: {
      type: "hiddenTunnel"
    },
    actTwoActions: [
      {
        action: "removeElderThingTokens",
        values: [
          "elderthing",
          "elderthing"
        ],
        label: "花费 2 个 [elder_thing] 钥匙：从混乱袋移除所有 [elder_thing] 标记"
      }
    ],
    forcedOnEnemyEnter: "defeatElderThingsAtLocation",
    onReveal: "resolution1"
  }
}

// 09656 猩红野兽（Scarlet Beast）· 敌人 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。印刷 2 份，进遭遇牌库。
// 卡面（中）：警戒。猎手。反击。
//   猩红野兽位于[[节点地]]地点时得到 +2 攻击值和 -2 躲避值。
//
// 读点：
//   · 警戒/猎手/反击 → definition 的 `enemies` 表（印刷关键字进敌人实例）；
//   · 「位于[[节点地]]时 +2 攻击值 / -2 躲避值」→ behavior.enemyStatModifier 读
//     `enemyRule.locusSiteStatModifier`（引擎 enemyStatModifier 的唯一读点，见 enemies.js）。
export default {
  code: '09656',
  name: '猩红野兽',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    alert: true,
    hunter: true,
    retaliate: true,
    locusSiteStatModifier: { fight: 2, evade: -2, trait: 'Locus Site' },
  },
  note: 'approximation: [[节点地]]按印刷特性 `Locus Site` 判定（在场地点实例的 traits）；'
    + '数值修正走 enemyStatModifier（战斗/躲避读取点），与「同名地点变体」无关。',
}

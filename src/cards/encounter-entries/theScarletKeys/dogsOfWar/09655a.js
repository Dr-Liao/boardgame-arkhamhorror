// 09655a 深红斗篷的恶兽（The Beast in a Cowl of Crimson · Ravager in Red / 红衣毁灭者）· 敌人 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09655b（「披着羊皮的狼」）。
// 卡面（中）：巡逻(有钥匙节点的最近地点)。反击。
//   强制 - 在深红斗篷的恶兽将要被击败时：改为治愈其全部伤害，将其横置并移动到亚历山大地下陵墓，不与调查员交战。
//
// 读点：
//   · 巡逻/反击由 definition 的 `enemies` 表 + 章节 behavior.enemyPhaseStart（tsk-coterie 的
//     `patrolTargetLocation` / `patrolDestination`）结算；
//   · 「将被击败」→ behavior.enemyDamaged（伤害达到生命时治愈全部、横置、解除交战并退到地下陵墓）
//     + behavior.enemyCanBeDefeated（同一次击败返回 false）；
//   · 「不能离开地下陵墓」是版本一地图牌 09651 的印刷规则（地点侧），本条目只披露（见 note）。
export default {
  code: '09655a',
  name: '深红斗篷的恶兽',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrol: { target: 'keyLocus' },
    retaliate: true,
    cannotBeDefeatedHealsAndFlees: true,
    fleesTo: 'catacombs',
    cannotLeaveCatacombsWhileBloodyNexus: true,
    elite: true,
  },
  note: 'approximation: 「不能离开亚历山大地下陵墓」写在版本一的地点牌背面，本章没有为地点建条目'
    + '（movement 的内容层钩子只能加边），因此只用 enemyRule 标记披露、运行时未拦截移动；'
    + '见 primitive-requests/09651.json。「被击败改为治愈+横置+撤退」按「伤害达到生命的那一次」触发。',
}

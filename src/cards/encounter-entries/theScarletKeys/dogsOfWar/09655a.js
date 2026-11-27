// 09655a 深红斗篷的恶兽（The Beast in a Cowl of Crimson · Ravager in Red / 红衣毁灭者）· 敌人 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09655b（「披着羊皮的狼」）。
// 卡面（中）：巡逻(有钥匙节点的最近地点)。反击。
//   强制 - 在深红斗篷的恶兽将要被击败时：改为治愈其全部伤害，将其横置并移动到亚历山大地下陵墓，不与调查员交战。
//
// 读点：
//   · 巡逻/反击由 definition 的 `enemies` 表 + 章节 behavior.enemyPhaseStart（tsk-coterie 的
//     `patrolTargetLocation` / `patrolDestination`）结算；
//   · 「将被击败」→ enemyWouldBeDefeated 中断窗口，替换击败后退到地下陵墓；
//   · 「不能离开地下陵墓」由版本一地点 09651 的未揭示面限制处理。
const CATACOMBS_CODES = new Set(['09650', '09651', '09652'])

export default {
  code: '09655a',
  name: '深红斗篷的恶兽',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrol: { target: 'keyLocus' },
    retaliate: true,
    elite: true,
  },
  abilities: [{
    kind: 'forced', trigger: 'enemyWouldBeDefeated',
    label: '将要被击败时：治愈全部伤害，横置并退到亚历山大地下陵墓',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, source, context, api }) => {
      if (!api.enemyOutcomes.replace(context, { healAllDamage: true })) return
      api.disengageEnemy(source)
      api.exhaust(source)
      const catacombs = state.locations.find(location => CATACOMBS_CODES.has(location.originalCode || location.code))
      if (catacombs && source.location !== catacombs.id) api.moveEnemy(source, catacombs.id)
    },
  }],
}

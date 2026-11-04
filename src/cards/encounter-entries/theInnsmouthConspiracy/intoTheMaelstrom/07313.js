// 07313 天体阵列（密谋 2）· 暗潮之下
//
// 印刷（中文）：
//   正面：空气规则（与 07312/07314 同一段印刷规则，由章节 mechanics.water.air 执行）。
//   背面（推进时）：如果海德拉在场，将她翻至（苏醒狂怒）面。
//                   如果达贡在场且正在沉睡，将他翻至（苏醒狂怒）面。
//
// 引擎读点：
//   · 议程推进时 entry-rules.agendaReveal 会调用本条的 agendaRule.onReveal；此时引擎还没
//     把 agendaIndex 前移，所以这里就是印刷的「翻开背面」时机。
//   · 换面走物理换面 flipEnemy：保留实例 id/计数/附件/钥匙；只翻当前沉睡面，已苏醒的面不动。
//   · 怪物是否「在场」以 state.enemies 为准（setAside 的不在列表里）。

export default {
  code: '07313', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      // 顺序与参考实现一致：先海德拉，后达贡。
      for (const [sleepingFace, awakenedFace] of [['07331a', '07331b'], ['07330a', '07330b']]) {
        const boss = (state.enemies || []).find(enemy => !enemy.defeated && !enemy.removedFromGame
          && (enemy.originalCode || enemy.code) === sleepingFace)
        if (boss) api.flipEnemy(boss, awakenedFace)
      }
    },
  },
}

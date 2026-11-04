// 07314 洪水（密谋 3）· 暗潮之下
//
// 印刷（中文）：
//   正面：如果有一个[[古神]]敌人正在沉睡，将它翻至（苏醒狂怒）面。
//         强制 - 当你回合开始时，若你在完全淹没的地点……（空气规则由章节 mechanics.water.air 执行）
//   背面：（→结局 8）
//
// 引擎读点：
//   · 正面的「若有沉睡古神就翻面」是进行期间的持续规则：参考实现用 AnyWindow 的静默强制，
//     这里挂在每个阶段开始的章节钩子 phaseBegan（读点 turn.js#phaseBeginningWindow），幂等。
//   · 背面（推进时）是结局 8：agendaRule.onReveal 调 api.finish('resolution8')，与
//     content/.../resolutions.js 的 intoTheMaelstrom 分支一致。
//   · 换面走物理换面 flipEnemy（保留实例/计数/附件）。

const SLEEPING_ANCIENT_ONES = [['07330a', '07330b'], ['07331a', '07331b']]

function awakenSlumberingAncientOnes(state, api) {
  let flipped = 0
  for (const [sleepingFace, awakenedFace] of SLEEPING_ANCIENT_ONES) {
    const boss = (state.enemies || []).find(enemy => !enemy.defeated && !enemy.removedFromGame
      && (enemy.originalCode || enemy.code) === sleepingFace)
    if (boss) { api.flipEnemy(boss, awakenedFace); flipped += 1 }
  }
  return flipped
}

export default {
  code: '07314', scope: 'agenda', implemented: true,
  agendaRule: {
    phaseBegan(state, agenda, phase, api) {
      awakenSlumberingAncientOnes(state, api)
    },
    onReveal(state, agenda, api) {
      api.finish('resolution8')
    },
  },
}

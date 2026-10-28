// 05149 那赫卜（Nahab · 于黑书签下姓名）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：猎手、反击；密谋推进时不移除毁灭；
// 攻击 +X（当前密谋编号）；强制 - 敌军阶段开始若重整：放 1 毁灭。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 「攻击 + 密谋编号」走 enemyStatRule.fightPerAgenda（共享读点）；敌军阶段开始/被击败走
// enemyScript.onEnemyPhaseStart / onDefeated。act3 的「击败后不弃掉」是章节流程（需要 agenda 反应），
// 仍在 theSecretName behavior。
export default {
  code: '05149', scope: 'enemy', implemented: true,
  // 卡面「在密谋推进时，不要移除那赫卜的毁灭标记。」（引擎 advanceAgenda 读点）
  doomKeptOnAgendaAdvance: 'self',
  enemyRule: { hunter: true, retaliate: true },
  enemyStatRule: { fightPerAgenda: true },
  enemyScript: {
    onEnemyPhaseStart(state, enemy, api) {
      if (enemy.exhausted) return
      api.doomOn?.(enemy, 1)
      api.info?.('🌑 那赫卜处于重整状态：在其上放置 1 个毁灭标记。')
    },
    onDefeated(state, enemy, api) {
      api.setScenarioFlag?.('nahabDefeated', true)
      return false
    },
  },
}

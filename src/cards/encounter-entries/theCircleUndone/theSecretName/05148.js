// 05148 布朗·詹金（Brown Jenkin · 女巫的魔宠）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：冷漠、猎手；重整的[[生物]]敌人 +2 攻击；
// 强制 - 敌军阶段结束时若重整：本地每位调查员弃掉所有手牌再抽等量。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 三个规则都在条目：光环走 enemyStatRule.aura（共享 attack 读点），
// 敌军阶段结束/被击败分别走 enemyScript.onEnemyPhaseEnd / onDefeated（共享钩子统一派发）。
export default {
  code: '05148', scope: 'enemy', implemented: true,
  enemyRule: { aloof: true, hunter: true },
  enemyStatRule: {
    aura: { stat: 'fight', amount: 2, trait: 'Creature', readyOnly: true },
  },
  enemyScript: {
    onEnemyPhaseEnd(state, enemy, api) {
      if (enemy.exhausted) return
      for (const inv of state.investigators.filter(entry =>
        !entry.defeated && !entry.resigned && entry.location === enemy.location)) {
        const count = (inv.hand || []).length
        if (!count) continue
        api.discardRandom?.(inv.seat, count)
        api.drawCards?.(inv.seat, count)
        api.info?.(`🐀 布朗·詹金：${inv.name} 弃掉全部 ${count} 张手牌后抽取等量卡牌。`)
      }
    },
    onDefeated(state, enemy, api) {
      api.setScenarioFlag?.('brownJenkinDefeated', true)
      return false
    },
  },
}

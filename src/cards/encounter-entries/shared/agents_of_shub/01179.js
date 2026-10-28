// 01179 坚韧的黑山羊幼崽（Relentless Dark Young）
// 归属：关卡专用 · theWitchingHour（P8 w-witch；核心包 agents_of_shub 卡在本章 set aside 后由 act1 生成）。
// 卡面：猎物 - 敏捷最低；强制 - 轮末治愈 2 点伤害。数值由 definition 印刷数据提供；
// 轮末强制在条目 enemyScript.onRoundEnd（共享 encounterRules.roundEnded 统一派发），章节不再按卡号写。
export default {
  code: '01179',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onRoundEnd(state, enemy, api) {
      if ((enemy.damageTaken || 0) <= 0) return
      const healed = api.healEnemy?.(enemy, 2) || 0
      if (healed) api.info?.(`🐐 「坚韧的黑山羊幼崽」治愈 ${healed} 点伤害（剩余 ${enemy.damageTaken}）。`)
    },
  },
}

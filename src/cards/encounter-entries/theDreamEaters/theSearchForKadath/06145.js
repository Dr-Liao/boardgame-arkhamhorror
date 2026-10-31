// 06145 乌撒之猫（theSearchForKadath）· 敌人（生物 / 精英，蜂拥2，胜利1）
// 卡面：蜂拥2。
// 卡面：当你尝试躲避本敌人而揭示混乱标记时，额外揭示1个混乱标记（每次检定仅限一次）。
// 卡面：强制 - 调查员第一次击败乌撒之猫（或其1张蜂拥卡牌）时：加3张蜂拥卡到其头领卡牌，
//       并记录「（该调查员名）已打破乌撒的法则」。
//
// 一卡一文件：行为只在这里维护。
// 简化：①「躲避时额外揭示1个标记」是检定中途的标记修正，条目没有读点（见 primitive-requests/
//       w-p8-b-evade-extra-token.json）；②「击败其蜂拥卡」不经过头领的 onDefeated，未接入。
// 强制记录口径：hasBrokenTheLawOfUlthar 是逐调查员 string[] 战役记录（P8-CAMPAIGN-FACTS §4.2 #24）。
export default {
  code: '06145', scope: 'enemy', implemented: true,
  enemyScript: {
    onDefeated(state, enemy, api) {
      if (api.scenarioFlag?.('catsOfUltharFirstDefeat')) return false
      api.setScenarioFlag?.('catsOfUltharFirstDefeat', true)
      // 「取消这次击败」：把伤害退回到生命值 -1，随后加 3 张蜂拥卡（下一轮才真正可击败）。
      const health = Number(enemy.health) || 1
      const overkill = Math.max(0, Number(enemy.damageTaken || 0) - health + 1)
      if (overkill > 0) api.healEnemy?.(enemy, overkill)
      api.swarm?.place?.(enemy, 3, { source: '06145' })
      const seat = Number.isInteger(state.currentSeat) ? state.currentSeat : Number(state.campaign?.leadSeat ?? 0)
      const inv = state.investigators?.[seat] || null
      const names = [...(api.campaignRecord?.('hasBrokenTheLawOfUlthar') || [])]
      if (inv?.name && !names.includes(inv.name)) names.push(inv.name)
      api.setCampaignRecord?.('hasBrokenTheLawOfUlthar', names)
      api.info?.('🐈 乌撒之猫首次被击败：改为加 3 张蜂拥卡到头领，并记录打破乌撒的法则。')
      return true
    },
  },
}

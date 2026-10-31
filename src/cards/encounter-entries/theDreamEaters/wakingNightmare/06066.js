// 06066 恐怖医院（Hospital of Horrors）· 议程 3
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 正面：强制 - 神话阶段结束时：进行一次蛛群滋生检定（behavior.mythosEnded 分派）。
//   位于蛛巢地点的每个[[蜘蛛]]敌人 +1 攻击值与 +1 躲避值（behavior.enemyStatModifier 读
//   agendaRule.spiderAtInfestedBonus）。
// 背面：在战役日志「桥梁之阶」旁记录 8 个计数标记。（→结局 4）
// 读点：agendaRule.onReveal（章节 behavior.agendaReveal 分派）。
const CODE = '06066'

export default {
  code: CODE,
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    mythosEndInfestationTest: true,
    spiderAtInfestedBonus: { fight: 1, evade: 1 },
    onReveal(state, agenda, api) {
      const current = Number(state.campaign?.records?.stepsOfTheBridge || 0)
      api.setCampaignRecord?.('stepsOfTheBridge', current + 8)
      api.info?.('🕷️ 「恐怖医院」背面：在战役日志「桥梁之阶」旁记录 8 个计数标记（→结局 4）。')
      api.finish?.('resolution4')
      return true
    },
  },
}

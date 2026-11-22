// 51071 潜伏者之仆（Yog-Sothoth's Emissaries）
// 归属：跨关卡共享（重返敦威治遗产 → yog_sothoths_emissaries）
// 卡面：猎手。强制 - 当敌军阶段结束时：潜伏者之仆所在地点的每位调查员弃掉其牌库顶 1 张卡牌。
// 说明：用共享的 enemyScript.onRoundEnd 读点（与 01179 同型），阶段末近似取轮末。
export default {
  code: '51071', scope: 'enemy', implemented: true,
  enemyScript: {
    onRoundEnd(state, enemy, api) {
      for (const inv of state.investigators.filter(other =>
        !other.defeated && !other.resigned && other.location === enemy.location)) {
        api.discardTop(inv.seat, 1)
      }
    },
  },
}

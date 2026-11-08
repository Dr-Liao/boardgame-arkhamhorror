// 08711 狂暴的修格斯（Rampaging Shoggoth）· 敌人 · shoggoths
// 卡面：猎手。庞大。狂暴的修格斯得到 +2[per_investigator] 生命值。强制 - 当敌军阶段结束时：
//   对其所在地点的每位调查员和每个非[[修格斯]]敌人造成 2 点伤害。这些调查员各自抽取忒咳哩-哩
//   牌库顶的 1 张卡牌。
// 读点：生命修正走 modifiers 的 enemyHealth（entityModifierTotal 读点）；敌军阶段结束走
//   forced + trigger 'enemyPhaseEnds'；伤害 api.damage / api.scenario.damageEnemy。
export default {
  code: '08711', scope: 'enemy', implemented: true,
  modifiers: [{ target: 'enemyHealth', amount: ({ state }) => 2 * Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1) }],
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束：本地点每位调查员与非修格斯敌人各受 2 伤害，调查员各抽 1 张忒咳哩-哩',
    criteria: ({ source }) => source && !source.defeated,
    resolve: ({ state, source, api }) => {
      if (!state.locations.some(loc => loc.id === source.location)) return
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === source.location)
      for (const other of mates) {
        api.damage(other.seat, 2)
        api.info('💥 「狂暴的修格斯」：' + (other.name || '调查员') + ' 受到 2 点伤害。')
      }
      for (const enemy of [...state.enemies]) {
        if (enemy === source || enemy.defeated || enemy.location !== source.location) continue
        if ((enemy.traits || []).some(trait => String(trait).toLowerCase() === 'shoggoth')) continue
        api.scenario.damageEnemy(enemy.id, 2, null, '08711')
      }
      for (const other of mates) {
        const code = api.mechanics.tekeli.draw()
        if (!code) continue
        api.info('👁️ 「狂暴的修格斯」：' + (other.name || '调查员') + ' 抽出忒咳哩-哩「' + (api.cardName?.(code) || code) + '」。')
      }
    },
  }],
}


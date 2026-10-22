// 02096 变异野兽
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：beast_thralls
// 卡面：显现 - 如果场上没有[[异形]]敌人，变异野兽获得涌动。否则，选择一个[[异形]]敌人。治愈该敌人的所有伤害，并将变异野兽附属到该敌人。
// 卡面：强制 - 在你进入附属敌人所在地点(或附属敌人进入你所在地点)时：受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02096', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  treacheryRule: { attachedHorror: true },
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const enemies = state.enemies.filter(enemy => enemy.traits?.includes('Abomination'))
    if (!enemies.length) { api.drawEncounter(inv.seat); return false }
    const enemyId = enemies.length === 1 ? enemies[0].id : api.choose({
      kind: 'target', source: code, seat: inv.seat, prompt: '选择一只憎恶，治疗其全部伤害并附属变异野兽。',
      options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
    const chosen = enemies.find(enemy => enemy.id === enemyId)
    if (!chosen) throw new Error('必须选择一只憎恶')
    chosen.damageTaken = 0
    chosen.attachedTreacheries = [...(chosen.attachedTreacheries || []), code]
    return true
  },
}

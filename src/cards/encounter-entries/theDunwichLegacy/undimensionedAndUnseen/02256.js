// 02256 高耸的野兽
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：险境。
// 卡面：显现 - 附属到场上一个犹格·索托斯之子敌人。如果该敌人在你的地点，受到1点伤害。
// 卡面：附属的敌人得到+1攻击和+1生命。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02256', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const brood = state.enemies.filter(enemy => enemy.code === '02255')
    if (!brood.length) return false
    const enemyId = brood.length === 1 ? brood[0].id : api.choose({
      kind: 'target', source: code, seat: inv.seat, prompt: '选择一只子嗣附属「高耸的野兽」。',
      options: brood.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${state.locations.find(loc => loc.id === enemy.location)?.name || enemy.location}）` })),
    })
    const chosen = brood.find(enemy => enemy.id === enemyId)
    if (!chosen) throw new Error('必须选择一只在场的子嗣')
    chosen.toweringBeasts = (chosen.toweringBeasts || 0) + 1
    chosen.health += 1
    chosen.attachedTreacheries = [...(chosen.attachedTreacheries || []), code]
    if (chosen.location === inv.location) api.damage(inv.seat, 1)
    return true
  },
}

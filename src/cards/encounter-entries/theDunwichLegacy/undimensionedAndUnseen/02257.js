// 02257 破坏与毁灭
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：显现 - 如果没有任何调查员与犹格·索托斯之子在同一地点，破坏与毁灭获得涌动。否则，与犹格·索托斯之子在同一地点的每位调查员检定[agility] (3)。其检定失败且每低于难度1点，受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02257', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const brood = state.enemies.filter(enemy => enemy.code === '02255')
    const exposed = state.investigators.filter(target =>
      !target.defeated && !target.resigned && brood.some(enemy => enemy.location === target.location))
    if (!exposed.length) api.drawEncounter(inv.seat)
    else for (const target of exposed) api.test(target.seat, 'agility', 3, result => {
      if (!result.success) api.damage(target.seat, Math.max(0, 3 - result.value))
    })
    return false
  },
}

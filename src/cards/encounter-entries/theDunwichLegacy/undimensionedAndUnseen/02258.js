// 02258 吸引注意
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：涌动。
// 卡面：显现 - 场上每个犹格·索托斯之子敌人朝你移动一次。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { moveBroodToward } from '../../_shared.js'

export default {
  code: '02258', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const brood = state.enemies.filter(enemy => enemy.code === '02255')
    const pending = [...brood]
    while (pending.length) {
      const enemyId = pending.length === 1 ? pending[0].id : api.choose({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择下一只朝你移动的子嗣。',
        options: pending.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${state.locations.find(loc => loc.id === enemy.location)?.name || enemy.location}）` })),
      })
      const chosen = pending.find(enemy => enemy.id === enemyId)
      if (!chosen) throw new Error('必须选择一只待移动的子嗣')
      moveBroodToward(state, chosen, inv.location, api)
      pending.splice(pending.indexOf(chosen), 1)
    }
    api.drawEncounter(inv.seat)
    return { placed: false, surgeHandled: true }
  },
}

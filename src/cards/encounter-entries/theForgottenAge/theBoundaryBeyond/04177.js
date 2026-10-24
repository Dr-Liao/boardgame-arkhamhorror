// 04177 特诺奇蒂特兰神庙
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在特诺奇蒂特兰神庙入场后：在最近的一个敌人上放置1个毁灭标记。
// 卡面：[action]在一个敌人上放置1个毁灭标记：发现本地点的2个线索。(团队每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { teamOnce, discoverAt } from '../../_shared.js'

// 「团队每轮一次」是否已用完：与 _shared.teamOnce 的 tag 口径一致（scope 'round'）。
const roundUsed = (state, key) => Boolean(state.scenarioFlags?.teamOnce?.[`${key}:${state.round}:r`])

export default {
  code: '04177', scope: 'location',
  locationRule: {
    ancientAction: {
      label: '🌑 在一个敌人上放置 1 个毁灭：发现本地点的 2 个线索（团队每轮一次）',
      available(state) {
        if (roundUsed(state, '04177clue')) return false
        return state.enemies.some(enemy => !enemy.defeated)
      },
      perform(state, inv, api, location) {
        if (!teamOnce(state, '04177clue', 'round')) { api.info?.('本轮的团队次数已用完。'); return false }
        const candidates = state.enemies.filter(enemy => !enemy.defeated)
        if (!candidates.length) return false
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choose({
          kind: 'enemy', source: '04177', seat: inv.seat, prompt: '选择要放置 1 个毁灭标记的敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === chosenId)
        if (!enemy || !api.doomOn?.(enemy, 1)) return false
        discoverAt(state, api, inv, location, 2)
        return true
      },
    },
  },
}

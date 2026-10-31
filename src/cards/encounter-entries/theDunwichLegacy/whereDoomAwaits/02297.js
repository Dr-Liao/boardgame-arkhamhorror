// 02297 缝隙空间
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：显现 - 将每个场上的非[[哨兵山]]地点翻至未揭示面并移除上面所有的线索。以此方式翻面的地点的每位调查员和每个敌人立即移动至最近的[[哨兵山]]地点。混洗每个非哨兵山 地点，以使玩家无法分辨。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf, activeInvestigators } from '../../_shared.js'
import { hiddenPathBack } from '../../../../../content/campaigns/thePathToCarcosa/presentation.js'

export default {
  code: '02297', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const paths = state.locations.filter(loc => !loc.traits?.includes('Sentinel Hill'))
    const hills = state.locations.filter(loc => loc.traits?.includes('Sentinel Hill'))
    for (const loc of paths) {
      loc.revealed = false
      loc.clues = 0
      const distance = target => {
        const queue = [[loc.id, 0]], seen = new Set([loc.id])
        for (const [next, count] of queue) {
          if (next === target) return count
          for (const neighbor of state.locations.find(item => item.id === next)?.connections || []) {
            if (!seen.has(neighbor)) { seen.add(neighbor); queue.push([neighbor, count + 1]) }
          }
        }
        return Infinity
      }
      const minimum = Math.min(...hills.map(hill => distance(hill.id)))
      const nearest = hills.filter(hill => distance(hill.id) === minimum)
      const choose = seat => nearest.length === 1 ? nearest[0].id : api.choose({ kind: 'location', source: code, seat,
        prompt: '选择最近的哨兵山地点。', options: nearest.map(hill => ({ id: hill.id, label: hill.name })) })
      for (const target of activeInvestigators(state).filter(item => item.location === loc.id)) api.moveInvestigator(target.seat, choose(target.seat))
      for (const enemy of state.enemies.filter(item => item.location === loc.id)) api.moveEnemy(enemy, choose(state.campaign.leadSeat))
    }
    // The physical card backs still distinguish Diverging Paths from
    // Altered Paths. Shuffle identities only within each matching back.
    const pathGroups = [
      [new Set(['02285', '02286', '02287', '02288']), '02285'],
      [new Set(['02289', '02290', '02291', '02292']), '02289'],
    ]
    const classified = new Set(pathGroups.flatMap(([codes]) => [...codes]))
    pathGroups.push([null, null])
    for (const [codes, artCode] of pathGroups) {
      const group = paths.filter(loc => codes ? codes.has(originalOf(loc)) : !classified.has(originalOf(loc)))
      const shuffled = group.map(loc => structuredClone(loc))
      for (let index = shuffled.length - 1; index > 0; index--) {
        const swap = Math.floor(api.random() * (index + 1))
        ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
      }
      group.forEach((loc, index) => {
        const slot = { id: loc.id, connections: loc.connections }
        for (const key of Object.keys(loc)) delete loc[key]
        Object.assign(loc, shuffled[index], slot)
        loc.hiddenIdentity = true
        if (artCode) loc.artCode = artCode
        // 已经揭示过的地点，名字就是正面；还没揭示的地点，正面记在 unrevealedActualName 里。
        if (!loc.unrevealedActualName) loc.unrevealedActualName = loc.name
        const back = hiddenPathBack(originalOf(loc)) || hiddenPathBack(artCode)
        loc.name = back?.name || '未揭示地点'
        if (back?.nameEn) loc.nameEn = back.nameEn
        state.locationVariants[loc.id] = { ...structuredClone(loc) }
      })
    }
    return false
  },
}

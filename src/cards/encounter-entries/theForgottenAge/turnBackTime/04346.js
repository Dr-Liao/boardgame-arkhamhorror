// 04346 留存的石室
// 归属：关卡专用 · turnBackTime（失落的时代 · 时间倒流）
// 遭遇组：turn_back_time
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
// 卡面：目标 -  只有在时间石室的调查员可以共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '04346', scope: 'act',
  actRule: {
    onReveal(state, act, api, hooks) {
      // 背面：选择时间石室的调查员控制古代遗物；伊格生成在时间石室；进胜利区并获得复仇 2。
      const chamber = state.locations.find(location => originalOf(location) === '04068')
      const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        .filter(inv => chamber && inv.location === chamber.id)
      let seat = null
      if (candidates.length === 1) seat = candidates[0].seat
      else if (candidates.length > 1) {
        seat = Number(api.choose({
          kind: 'investigator', source: '04346', seat: state.campaign.leadSeat,
          prompt: '选择一位位于时间石室的调查员控制古代遗物。',
          options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        if (!Number.isInteger(seat)) seat = candidates[0].seat
      }
      if (seat == null) seat = state.campaign.leadSeat
      const holder = state.investigators[seat]
      if (holder) {
        hooks.removeSetAside('04061')
        api.giveAsset?.(seat, '04061')
        if (api.moveRelicOfAges) api.moveRelicOfAges({ code: '04061', seat })
        else state.relicOfAges = { code: '04061', location: holder.location, seat }
        api.info?.(`🏺 ${holder.name} 控制了古代遗物。`)
      }
      hooks.removeSetAside('04296')
      const spawnAt = chamber?.id || 'chamberOfTime'
      const yig = api.spawn('04296', spawnAt)
      if (yig) {
        yig.damageTaken = 0
        api.info?.(`🐍 伊格在「${yig.location}」现身！`)
      }
      hooks.addActToVictory(act)
    },
  },
}

// 03125 昔日恶果
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'
import { someNonPlayerEntry } from '../../_lookup.js'

export default {
  code: '03125', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      for (const location of state.locations.filter(candidate => candidate.revealed
        && someNonPlayerEntry(entry => entry.code === originalOf(candidate) && entry.historicalRoom))) {
        const max = location.maxClues ?? (location.cluesPerInvestigator || 0) * state.numInvestigators
        location.clues = Math.min(max || Infinity, (location.clues || 0) + state.numInvestigators)
      }
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const seat = active.length === 1 ? active[0].seat : Number(api.choose({
        kind: 'storyAsset', source: '03141', seat: state.campaign.leadSeat,
        prompt: '选择一位调查员控制皮博迪先生。',
        options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      api.giveAsset(seat, '03141')
      api.place('hiddenLibrary')
      // 幕 3（03126）的「带[[通道]]特性的地点互相连接」由 03126 条目的
      // actRule.locationTraitLinks 声明，引擎在幕 3 成为当前幕时自动安装/撤销
      // （见 src/engine/location-traits.js）；本条目只负责放置隐藏的图书馆。
      // 这里不能静态连线：隐藏的图书馆印刷无特性/无连接，只能在特性真的被授予时打通。
    },
  },
}

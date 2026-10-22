// 04319 搜寻兄弟会
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：目标 - 如果有调查员进入时间之窗，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 幕 04319「寻找兄弟会」背面：破碎地点与巫术诡计洗入探索牌库，并按剧本日志决定遗物归属。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '04319', scope: 'act',
  actRule: {
    onReveal(state, act, api, hooks) {
      const flags = hooks.flags()
      for (const id of hooks.shatteredLocations()) {
        hooks.removeSetAsideLocation(id)
        state.explorationDeck = [...(state.explorationDeck || []), id]
      }
      hooks.shuffleInPlace()
      for (const inv of hooks.active()) {
        const index = (state.encounterDiscard || []).findLastIndex(entry =>
          ALL_CARDS[entry]?.traits?.some(trait => String(trait).toLowerCase() === 'hex'))
        if (index < 0) continue
        const [hex] = state.encounterDiscard.splice(index, 1)
        // 同一张巫术诡计只洗入一次（防重复触发时叠加）。
        if (!flags.foundHexFromDiscard.includes(hex)) {
          state.explorationDeck.push(hex)
          flags.foundHexFromDiscard.push(hex)
        }
        api.info?.(`🃏 ${inv.name} 把「${ALL_CARDS[hex]?.nameZh || hex}」洗入探索牌库。`)
      }
      hooks.shuffleInPlace()
      if (hooks.records().theRelicIsMissing) {
        const pocket = hooks.byId(hooks.pocket())
        hooks.removeFromSetAside(hooks.relicAgesUnleash())
        flags.relicCode = hooks.relicAgesUnleash()
        if (pocket) {
          if (api.moveRelicOfAges) api.moveRelicOfAges({ code: hooks.relicAgesUnleash(), location: pocket.id })
          else state.relicOfAges = { code: hooks.relicAgesUnleash(), location: pocket.id, seat: null }
          api.info?.('🏺 遗物已丢失：放在一边的古代遗物（时光涌流）附属到时间之窗。')
        }
      }
    },
  },
}

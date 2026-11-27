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
      const shattered = hooks.shatteredLocations()
      for (const id of shattered) hooks.removeSetAsideLocation(id)
      api.addToExplorationDeck(shattered)
      const found = []
      for (const inv of hooks.active()) {
        const hex = (state.encounterDiscard || []).findLast(code =>
          ALL_CARDS[code]?.type === 'treachery' && ALL_CARDS[code].traits?.some(trait => String(trait).toLowerCase() === 'hex'))
        if (!hex || !api.takeEncounterDiscard(hex)) continue
        found.push(hex)
        api.info?.(`🃏 ${inv.name} 把「${ALL_CARDS[hex]?.nameZh || hex}」洗入探索牌库。`)
      }
      api.setScenarioFlag('foundHexFromDiscard', [...(state.scenarioFlags?.foundHexFromDiscard || []), ...found])
      api.addToExplorationDeck(found)
      if (hooks.records().theRelicIsMissing) {
        const pocket = hooks.byId(hooks.pocket())
        hooks.removeFromSetAside(hooks.relicAgesUnleash())
        api.setScenarioFlag('relicCode', hooks.relicAgesUnleash())
        if (pocket) {
          api.moveRelicOfAges({ code: hooks.relicAgesUnleash(), location: pocket.id })
          api.info?.('🏺 遗物已丢失：放在一边的古代遗物（时光涌流）附属到时间之窗。')
        }
      }
    },
  },
}

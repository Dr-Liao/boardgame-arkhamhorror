// 06064 圣玛丽医院的走廊（Halls of St. Mary's）· 议程 1
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 背面：把放在一边的「蜘蛛」遭遇组与每张放在一边的「爆发」副本，连同遭遇弃牌堆洗入遭遇牌库。
//   抽取放在一边的「蛛群入侵」故事卡并结算其文本。
// 读点：agendaRule.onReveal（章节 behavior.agendaReveal 分派）。故事卡 06078 的「建滋生袋 + 标记蛛巢」
//   需要按 06078 条目的 flags 读取袋内 token 与 token 效果，由章节 behavior 的 agenda 后置流程
//   （definition 的 agenda.chapterFlow = 'theInfestationBegins'）执行；本条目负责可 api 化部分。
import { ALL_CARDS } from '../../_shared.js'

const CODE = '06064'

export default {
  code: CODE,
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const setAside = Array.isArray(state.scenarioZones?.setAside) ? [...state.scenarioZones.setAside] : []
      const spiderCodes = []
      for (const [code, card] of Object.entries(ALL_CARDS)) {
        if (card.encounterCode !== 'spiders') continue
        if (!['enemy', 'treachery'].includes(card.type)) continue
        if (!setAside.includes(code)) continue
        spiderCodes.push(code)
      }
      const outbreaks = setAside.filter(code => code === '06083')
      const codes = [...spiderCodes, ...outbreaks]
      for (const code of codes) api.takeFromSetAside?.(code)
      if (codes.length) api.shuffleIntoEncounterDeck?.(codes)
      api.shuffleDiscard?.()
      api.cardReveal?.('06078', '蛛群入侵')
      api.info?.(`🕷️ 「圣玛丽医院的走廊」背面：蜘蛛群与爆发洗入遭遇牌库；「蛛群入侵」故事卡开始结算。`)
      return true
    },
  },
}

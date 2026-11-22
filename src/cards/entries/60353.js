// 60353 台词娴熟（Know the Line，André Patel 专属技能）
// 卡面：安德烈·帕特尔牌库专用。本卡牌投入到冒险卡牌上的技能检定时，其获得 [wild][wild]。
import { ALL_CARDS } from '../cards-data.js'

const SCENARIO_TYPES = new Set(['act', 'agenda', 'treachery', 'enemy', 'location', 'scenario'])

export default {
  code: '60353',
  abilities: [{
    kind: 'commit',
    label: '投入到冒险卡上的检定时获得 2 个万能图标',
    skill: {
      onCommit: ({ test, api }) => {
        const source = test?.source
        const type = source?.code ? ALL_CARDS[source.code]?.type : null
        if (source?.scenario || SCENARIO_TYPES.has(type)) api.addTestValue(2)
      },
    },
  }],
}

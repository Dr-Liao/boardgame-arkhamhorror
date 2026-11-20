// 11577 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第四轮：显现检定由 encounterResolve 自行发起（api.test，难度 = 所在地点隐藏值），
// 失败分支「弃遭遇牌库顶直到弃到一名[[偷渡者]]敌人并抽取；被弃掉的地点洗回遭遇牌库」用
// 引擎既有 api.discardEncounterTop / api.takeEncounterCard / api.shuffleIntoEncounterDeck /
// api.spawnEngaged 实现（读点：scenario-runtime.js；弃顶后另会打开既有
// encounterCardsDiscardedFromTop 窗口）。
import { cardDefinition } from '../../_shared.js'

const CODE = '11577'

function isStowawayEnemy(code) {
  const card = cardDefinition(code)
  return card?.type === 'enemy' && (card.traits || []).some(trait => String(trait).toLowerCase() === 'stowaway')
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    if (!inv || !api?.test) return false
    const here = (state.locations || []).find(location => location.id === inv.location)
    const difficulty = Math.max(0, Number(here?.shroud || 0) + Number(here?.shroudMod || 0))
    api.test(inv.seat, 'willpower', difficulty, {
      source: { code: CODE, label: '危险的好奇心', name: '危险的好奇心' },
      resolve: result => {
        if (result?.success) return
        api.damage?.(inv.seat, 1)
        const discarded = []
        let stowaway = null
        for (let guard = 0; guard < 200; guard += 1) {
          if (!(state.encounterDeck || []).length) break
          const [code] = api.discardEncounterTop ? api.discardEncounterTop(1, { log: false }) : []
          if (!code) break
          discarded.push(code)
          if (isStowawayEnemy(code)) { stowaway = code; break }
        }
        if (stowaway) {
          api.takeEncounterCard?.(stowaway)
          api.spawnEngaged?.(stowaway, inv.location, inv.seat)
          api.info?.(`危险的好奇心：弃到「${api.cardName?.(stowaway) || stowaway}」，将其抽取。`)
        }
        // 以此效果弃掉的地点洗回遭遇牌库（其余牌留在遭遇弃牌堆）。
        const locations = discarded.filter(code => cardDefinition(code)?.type === 'location')
        if (locations.length) {
          for (const code of locations) api.takeEncounterCard?.(code, { pile: 'encounterDiscard' })
          api.shuffleIntoEncounterDeck?.(locations)
          api.info?.(`把弃掉的 ${locations.length} 处地点洗回遭遇牌库。`)
        }
      },
    })
    return true
  },
  note: "印刷：显现 - 检定意志(X)，X = 你所在地点的隐藏值。如果你失败，受到 1 点伤害，并从遭遇牌库顶弃掉卡牌，直到弃掉一名[[偷渡者]]敌人，将其抽取；将以此效果弃掉的每处地点混洗回遭遇牌库。已接线：encounterResolve 发起 api.test（难度 = 地点隐藏值）；失败分支 api.damage(1) + api.discardEncounterTop 弃到偷渡者敌人 + api.takeEncounterCard 取出 + api.spawnEngaged 生成（抽取）+ api.shuffleIntoEncounterDeck 把弃掉的地点洗回（其余牌留在遭遇弃牌堆）。全部子句已接线。",
  abilities: [],
}

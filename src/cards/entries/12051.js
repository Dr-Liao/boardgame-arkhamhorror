// 12051 血洗全城（Paint the Town Red）· 事件 · 游荡者 0 经验 · 费用 0
// 卡面：谈判。查找遭遇牌库顶 9 张卡牌，找出一个非[[精英]]敌人，将其抽取，
//       获得等于该敌人印刷生命值的资源。混洗遭遇牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Event/Events/PaintTheTownRed.hs
//   （search encounter deck top 9 → non-Elite enemy → DrawFound → gain resources = printed health → shuffle）。
// 读点：played + countsAs:'parley'（按谈判行动结算、不引发借机攻击）；
//   遭遇牌库的读/取/洗统一走 api.scenario（takeEncounterDeckCard / drawEncounter({code,from:'search'}) /
//   shuffleEncounterDeck），资源走 ctx.api.gainResources；印刷生命值读纯数据表 cards-data。
import { ALL_CARDS } from '../../cards/cards-data.js'

const TOP_N = 9
const isEnemy = code => ALL_CARDS[code]?.type === 'enemy'
const isElite = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'elite')

function candidatesFromTop(state) {
  const deck = state.encounterDeck || []
  return deck.slice(-TOP_N).reverse().filter(code => isEnemy(code) && !isElite(code))
}

export default {
  code: '12051',
  playCondition: [{
    when: ({ state }) => (state.encounterDeck || []).length > 0,
    message: '遭遇牌库是空的',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      noOpportunityAttack: true,
      label: '查找遭遇牌库顶 9 张中的非精英敌人：抽取它，获得等同其印刷生命值的资源',
      resolve: ({ state, inv, api }) => {
        const candidates = candidatesFromTop(state)
        if (!candidates.length) {
          api.scenario.shuffleEncounterDeck()
          api.info('血洗全城：遭遇牌库顶 9 张中没有非精英敌人。')
          return
        }
        const picked = candidates.length === 1 ? '0' : api.choice({
          kind: 'card', source: '12051', seat: inv.seat,
          prompt: '血洗全城：选择要抽取的非精英敌人。',
          options: [...new Set(candidates)].map((code, index) => ({ id: String(index), label: api.cardName(code), cardCode: code })),
        })
        const unique = [...new Set(candidates)]
        const code = unique[Number(picked)] || unique[0]
        if (!code) return
        api.scenario.takeEncounterDeckCard(code)
        api.scenario.drawEncounter(inv.seat, { code, from: 'search' })
        const health = Number(ALL_CARDS[code]?.health) || 0
        if (health > 0) api.gainResources(inv.seat, health)
        api.scenario.shuffleEncounterDeck()
        api.info(`血洗全城：抽出「${api.cardName(code)}」并获得 ${health} 资源；遭遇牌库已混洗。`)
      },
    },
  ],
  modifiers: [],
}

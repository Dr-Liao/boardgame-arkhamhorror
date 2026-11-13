// 09764 戴维·伊拉万博士（Dr. Dewi Irawan）· 剧情支援（盟友）· globetrotting
// 卡面：你得到 +1[willpower]。
//   [fast] 横置戴维·伊拉万博士：揭示你一张手牌，以将该卡牌放在一边作为空洞的所有同名卡牌
//   混洗入其所有者牌库；或弃掉你一张手牌，以将任意一个放在一边的空洞混洗入其所有者牌库。
//   无论选择哪一项，每以此方式混洗入一张卡牌，获得 1 资源。
// 读点：modifiers（+1 意志）；free 实体行动（actionKind，玩家窗口内横置）走 ctx.api；
//   空洞回收 api.tsk.hollow.recall → putInHand → moveCard(deckTop) → shuffleDeck（空洞卡不在常规区域，
//   只能先入其所有者手牌再洗进牌库）。
// 近似：① 「揭示一张手牌」是公开揭示，没有展示读点（只用它作筛选条件）；② 回收用「先入手牌再洗入
//   牌库」三段代替一次性洗入（primitive-requests/09764.json）。
const CODE = '09764'

const hollowRecords = api => api.tsk.hollow.cards()
const ownerSeatOf = (record, fallback) => Number.isSafeInteger(record?.seat) ? record.seat : fallback

function shuffleHollowIntoDeck(record, fallbackSeat, api) {
  const recalled = api.tsk.hollow.recall(record.code, { to: 'deck' })
  if (!recalled) return 0
  const owner = ownerSeatOf(recalled, fallbackSeat)
  // 空洞卡的实体位置有两种：手牌/支援空洞用 moveCard(setAside) 离场（可从 setAside 直接洗回），
  // 牌库顶空洞用 takeDeckCard 取出（只存在于空洞记录里，需经手牌中转）。
  const moved = api.moveCard({ code: recalled.code, from: 'setAside', to: 'deckTop', ownerSeat: owner })
  if (!moved) {
    api.putInHand(owner, recalled.code)
    api.moveCard({ code: recalled.code, from: 'hand', to: 'deckTop', ownerSeat: owner })
  }
  api.shuffleDeck(owner)
  return 1
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: { ally: true, scholar: true },
  modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '[fast] 横置：把同名空洞或任意一个空洞洗回其所有者牌库，每张获得 1 资源',
    cost: { exhaust: true },
    resolve: ({ state, inv, api }) => {
      const records = hollowRecords(api)
      const options = []
      if ((inv.hand || []).length && records.length) options.push({ id: 'byHand', label: '揭示一张手牌：把同名空洞洗回牌库' })
      if ((inv.hand || []).length && records.length) options.push({ id: 'byCard', label: '弃一张手牌：把任意一个空洞洗回牌库' })
      if (!options.length) {
        api.info?.('「戴维·伊拉万博士」：没有可回收的空洞，或手牌为空。')
        return false
      }
      const mode = String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择「戴维·伊拉万博士」的方式。', options,
      }))
      let shuffled = 0
      if (mode === 'byHand') {
        const picked = String(api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '揭示一张手牌，把以它为名的空洞洗回牌库。',
          options: [...new Set(inv.hand)].map(code => ({ id: code, label: api.cardName?.(code) || code, cardCode: code })),
        }))
        const matches = records.filter(record => record.code === picked)
        if (!matches.length) {
          api.info?.('「戴维·伊拉万博士」：没有与该手牌同名的空洞。')
          return false
        }
        for (const record of matches) shuffled += shuffleHollowIntoDeck(record, inv.seat, api)
      } else {
        const pickedId = String(api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '选择要洗回所有者牌库的空洞卡。',
          options: records.map(record => ({ id: record.code, label: api.cardName?.(record.code) || record.code })),
        }))
        const record = records.find(item => item.code === pickedId)
        if (!record) return false
        const discarded = String(api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '弃掉一张手牌作为费用。',
          options: [...new Set(inv.hand)].map(code => ({ id: code, label: api.cardName?.(code) || code, cardCode: code })),
        }))
        api.discardFromHand(inv.seat, discarded)
        shuffled += shuffleHollowIntoDeck(record, inv.seat, api)
      }
      if (shuffled > 0) api.gainResources(inv.seat, shuffled)
      api.info?.('「戴维·伊拉万博士」：洗回 ' + shuffled + ' 张空洞，获得 ' + shuffled + ' 资源。')
      return shuffled > 0
    },
  }],
  note: 'approximation: 空洞回收走 recall →（setAside 直接洗回，否则 putInHand 中转）→ moveCard(deckTop) → shuffleDeck；'
    + '「揭示手牌」只作为筛选条件，没有公开揭示的展示读点（primitive-requests/09764.json）。',
}

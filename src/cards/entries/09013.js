// 09013「福言之语」（Word of Weal）· 事件 · 阿米娜专属签名
// 卡面：阿米娜牌库专用。快速。当你在一个带有至少 1 个毁灭标记的支援上进行技能检定时打出。
//   把 [willpower] 加入本次检定的技能值。然后，若「祸言之语」在你的弃牌堆中，你可以将其洗回你的牌库。
export default {
  code: '09013',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testBegins',
      label: '快速：对带毁灭支援的检定加 [willpower]；可洗回「祸言之语」',
      criteria: [({ state, inv }) => {
        const test = state.skillTest
        if (!test || test.seat !== inv.seat) return false
        return (inv.assets || []).some(asset => (Number(asset.doom) || 0) > 0)
      }],
      resolve: ({ inv, api }) => {
        const willpower = api.stat(inv.seat, 'willpower')
        api.addTestValue(willpower)
        api.info(`🔮 福言之语：本次检定 +${willpower}。`)
        if ((inv.discard || []).includes('09012')
          && api.choice({ kind: 'target', source: '09013', seat: inv.seat, prompt: '是否将「祸言之语」洗回牌库？',
            options: [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }] }) === 'yes') {
          api.moveCard({ code: '09012', from: 'discard', to: 'deck', ownerSeat: inv.seat })
          api.shuffleDeck(inv.seat)
        }
      },
    },
  ],
  modifiers: [],
}

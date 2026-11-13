// 09032 鼓舞决心（Bestow Resolve）· 守卫者资产（2 级）· 奥秘槽 · 使用(4 充能)。
// 卡面：[快速] 你所在地点或连接地点的调查员执行技能检定期间，花 1 充能：从手牌将一张非弱点
// 卡牌投入该检定，其所有技能图标视为 [wild]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 时机 = testBegins 窗口（技能检定开始，上下文带 seat / location / skill）；
//     费用 = 1 充能（cost.uses:1，读点 descriptorUsable）；
//   · 「视为 [wild]」= 该卡全部图标都计入本次检定：优先走 api.commitCards（引擎唯一投入入口），
//     图标与本次技能不匹配时按 moveCard 进弃牌堆（投入后本就进弃牌堆）+ addCommittedCardIcons 补齐。
// approximation：图标不匹配的卡不进 committed 列表（少「投入后」窗口），见 note。
export default {
  code: '09032',
  uses: 4,
  usesType: 'charges',
  note: 'approximation: 图标与检定技能不匹配的卡无法走 commitCards（引擎按技能匹配过滤），改用 moveCard + addCommittedCardIcons 补齐全部图标；这类卡不进 committed 列表',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testBegins',
      label: '充能：把一张手牌非弱点卡投入本次检定，其全部图标视为[wild]',
      cost: { uses: 1 },
      criteria: [({ state, inv, context }) => {
        if (!context || !Number.isInteger(context.seat)) return false
        const performer = state.investigators[context.seat]
        if (!performer) return false
        const here = state.locations.find(location => location.id === inv.location)
        const reachable = performer.location === inv.location
          || (here?.connections || []).includes(performer.location)
        if (!reachable) return false
        return (inv.hand || []).some(code => !['weakness', 'basicweakness'].includes(state.cards?.[code]?.subtype))
      }],
      resolve: ({ state, inv, context, api }) => {
        const performer = state.investigators[context.seat]
        if (!performer) return
        const hand = (inv.hand || []).filter(code => api.isNonWeakness(code))
        if (!hand.length) {
          api.info('鼓舞决心：手牌里没有非弱点卡牌。')
          return
        }
        const code = hand.length === 1 ? hand[0] : api.choice({
          kind: 'card', source: '09032', seat: inv.seat,
          prompt: '鼓舞决心：选择要投入本次检定的非弱点卡牌（其图标视为[wild]）。',
          options: hand.map(item => ({ id: item, label: api.cardName(item), cardCode: item })),
        })
        if (!hand.includes(code)) return
        const icons = Object.values(api.cardIcons(code) || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
        const before = (state.skillTest?.committed || []).length
        const added = api.commitCards(performer.seat, [code], { ignoreAdditionalCosts: true })
        const after = (state.skillTest?.committed || []).length
        if (after === before) {
          // 座位属于「谁的手牌」：api.moveCard 的第二参是 options，规格对象只收 MOVE_KEYS（zones.js 严格校验）。
          api.moveCard({ code, from: 'hand', to: 'discard' }, { seat: inv.seat })
          api.addCommittedCardIcons(performer.seat, icons)
          api.info(`鼓舞决心：「${api.cardName(code)}」投入检定，${icons} 个图标视为[wild]。`)
          return
        }
        if (icons > added) api.addCommittedCardIcons(performer.seat, icons - added)
        api.info(`鼓舞决心：「${api.cardName(code)}」投入检定，${icons} 个图标视为[wild]。`)
      },
    },
  ],
  modifiers: [],
}

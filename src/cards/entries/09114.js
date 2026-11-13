// 09114 卡蒂亚·伊斯特班克（Katja Eastbank）· 幸存者盟友 · 2 经验 · 盟友槽
// 卡面：[reaction] 在你从自己牌库顶抽取一张非弱点卡牌时，结算其任何效果前，横置卡蒂亚·伊斯特班克：
//       将该卡牌正面朝下放在她底下（她底下仅限 5 张卡牌）。抽取一张新卡牌以替代。
//       [action]：抽取卡蒂亚·伊斯特班克底下的任意一张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · cardDrawn 窗口（deck-ops.js 抽到非弱点后打开，context.cardCode 是刚抽到的牌）；
//   · 「放在她底下」用支援的 attachments 区（P6 的「附属卡」存储形状之一；moveCard 的
//     to:'attached' + attachTo，读回时 from:'attached'），正面朝下 facedown；
//   · 5 张上限读 attachments 数量；替代抽牌 api.drawCards；抽取底下卡 api.moveCard。
// approximation: 非弱点牌抽到时没有「结算效果前」的独立时机，反应挂在抽牌后的 cardDrawn 窗口
//   （非弱点牌本身没有抽牌时效果，结果等价）；attachments 里同时可能显示为附属卡。
const code = '09114'

const underneath = source => (source?.attachments || []).filter(entry => entry.code && !entry.assetReference)

export default {
  code,
  note: 'approximation: 反应挂在抽牌后的 cardDrawn 窗口（非弱点牌没有抽牌时效果，结果等价）。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'cardDrawn',
      label: '抽到非弱点牌时：横置，将该牌正面朝下放到她底下，抽 1 张替代',
      cost: { exhaust: true },
      criteria: [({ inv, context, source }) => context?.seat === inv.seat
        && context?.cardCode && (inv.hand || []).includes(context.cardCode)
        && underneath(source).length < 5],
      resolve: ({ inv, source, context, api }) => {
        const moved = api.moveCard({
          code: context.cardCode, from: 'hand', to: 'attached', attachTo: source?.id, facedown: true,
        })
        if (!moved) return
        api.drawCards(inv.seat, 1)
        api.info(`📚 「卡蒂亚·伊斯特班克」：${inv.name} 将刚抽到的牌正面朝下放到她底下（${underneath(source).length}/5），并抽 1 张替代。`)
      },
    },
    {
      kind: 'action',
      label: '抽取卡蒂亚底下的任意一张牌',
      cost: { action: true },
      resolve: ({ inv, source, api }) => {
        const cards = underneath(source)
        if (!cards.length) { api.info('「卡蒂亚·伊斯特班克」底下没有卡牌。'); return }
        const chosenId = cards.length === 1 ? cards[0].id : api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '「卡蒂亚·伊斯特班克」：选择抽取的她底下的卡牌。',
          options: cards.map(entry => ({ id: entry.id, cardCode: entry.code, label: api.cardName(entry.code) })),
        })
        const chosen = cards.find(entry => entry.id === chosenId) || cards[0]
        api.moveCard({ id: chosen.id, code: chosen.code, from: 'attached', to: 'hand' })
        api.info(`📖 「卡蒂亚·伊斯特班克」：${inv.name} 抽取了她底下的「${api.cardName(chosen.code)}」。`)
      },
    },
  ],
  modifiers: [],
}

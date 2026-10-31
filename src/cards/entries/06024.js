// 06024 梦境结晶器
// 卡面：作为打出本卡牌的额外费用，你必须查找你的绑定卡牌，找出1张结晶器守卫并将其混洗入你的牌库。
//       [reaction]你打出一张事件后：不将其弃掉，改为将其正面朝下附属到梦境结晶器(最多可附属5张)。
//       附属的事件可以投入到技能检定中，如同其为你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06024 梦境结晶器：
//   · 额外费用：入场时 api.bonded.retrieve(..., { handCount: 0 }) → 1 张 06025 洗入牌库。
//   · 事件附属：eventPlayed 窗口（该窗口在事件处置之后开；被打出的事件此时在弃牌堆）→
//     api.moveCard({ from:'discard', to:'attached', attachTo: source.id, facedown:true }) 改放到宿主附属区。
//   · 显式简化：「附属事件可以投入技能检定」——引擎的投入通道原语（playChannels.commitEntries）
//     目前只支持 05013 银暮匕首的 beneath 通道，attachments 没有投入候选；故该子句未接线。

export default {
  code: '06024',
  simplified: true,
  note: '未实现：附属事件「如同手牌」投入技能检定（playChannels.commitEntries 只有 beneath 通道，attachments 无投入候选）；已实现额外费用检索与事件附属（上限 5）。',
  abilities: [
    {
      kind: 'entersPlay',
      label: '额外费用：查找绑定卡牌，将 1 张结晶器守卫混洗入牌库',
      resolve: ({ inv, api }) => {
        api.bonded.retrieve(inv.seat, '06024', { handCount: 0 })
      },
    },
    {
      kind: 'reaction',
      trigger: 'eventPlayed',
      label: '打出一张事件后：将其正面朝下附属到梦境结晶器',
      criteria: [({ inv, source, context }) => {
        const code = context?.cardCode || context?.cardId
        if (!code || code === '06024') return false
        if (!source || source.code !== '06024') return false
        if ((source.attachments || []).length >= 5) return false
        // 被打出的事件此时已被处置进弃牌堆（本窗口在其后开）。
        return (inv.discard || []).includes(code)
      }],
      resolve: ({ inv, source, context, api }) => {
        const code = context?.cardCode || context?.cardId
        if (!code || !source) return
        // 卡面类型在 resolve 里用引擎读点判定（state.cards 只是建局时的运行时子集）。
        if (api.cardType(code) !== 'event') return
        const index = (inv.discard || []).lastIndexOf(code)
        if (index < 0) return
        api.moveCard({ code, from: 'discard', to: 'attached', attachTo: source.id, facedown: true })
        api.info(`「梦境结晶器」：将「${api.cardName(code)}」正面朝下附属到其上（共 ${(source.attachments || []).length} 张）。`)
      },
    },
  ],
  modifiers: [],
}

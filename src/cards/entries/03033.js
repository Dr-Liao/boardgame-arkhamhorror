// 03033 解锢灵魂
// 卡面：从你手牌打出一张[[法术]]或[[仪式]]卡牌，其资源费用减少3点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03033 解锢灵魂：选择一张法术/仪式，以费用 -3、不花行动打出。
// 候选筛选里的「有没有合法目标」由 api.cardHasLegalTarget 提供（与 effectError 同源），
// 否则会把手上有需要敌人的事件卡也列出来，选中后白打一张。

export default {
  code: '03033',
  abilities: [
    {
      kind: 'played', label: '费用 -3 打出一张法术或仪式',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(inv.hand.filter(code => api.cardTraits(code).some(trait => ['spell', 'ritual'].includes(trait))
          && api.cardHasLegalTarget(inv.seat, code)))]
        if (!candidates.length) { api.info('没有可折扣打出的法术或仪式。'); return }
        const chosen = api.choice({ kind: 'card', source: '03033', seat: inv.seat,
          prompt: '选择要以费用-3打出的法术或仪式。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        api.playCard(inv.seat, chosen, { discount: 3, noAction: true })
      },
    },
  ],
  modifiers: [

  ],
}

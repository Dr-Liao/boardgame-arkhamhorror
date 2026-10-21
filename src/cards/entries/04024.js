// 04024 发掘古物
// 卡面：调查。选择你手中的一张[seeker]支援卡牌。本次技能检定难度等于所选支援的印刷费用。如果你检定成功，不发现线索，改为将该所选支援放置入场。如果该支援有[[遗物]]特性，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04024 发掘古物：智识检定（难度 = 支援费用），成功后把该探求者支援直接放置入场（遗物再抽 1 张）。

export default {
  code: '04024',
  abilities: [
    {
      kind: 'played', id: 'unearthTheAncients', label: '发掘古物',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(inv.hand.filter(code => api.cardType(code) === 'asset'
          && api.cardFactions(code).includes('seeker')))]
        if (!candidates.length) { api.info('手中没有可发掘的探求者支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({ kind: 'target', source: '04024',
          seat: inv.seat, prompt: '选择要放置入场的探求者支援。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        api.startTest({
          skill: 'intellect', difficulty: api.cardCost(chosen), seat: inv.seat,
          source: { label: '发掘古物', code: '04024' },
          resolve: result => {
            if (!result.success) return
            if (!api.putAssetIntoPlay(inv.seat, chosen)) return
            api.info(`「${api.cardName(chosen)}」被直接放置入场。`)
            if (api.cardTraits(chosen).includes('relic')) api.drawCards(inv.seat, 1)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}

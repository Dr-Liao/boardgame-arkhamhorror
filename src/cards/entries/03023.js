// 03023 时刻警惕
// 卡面：依次从你手中打出最多3张支援，每张资源费用减少1点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03023 时刻警惕：最多 3 次，每次以 -1 费打出一张支援。

export default {
  code: '03023',
  abilities: [
    {
      kind: 'played', id: 'everVigilant', label: '连续打出最多 3 张支援（每张 -1 费）',
      resolve: ({ inv, api }) => {
        for (let count = 0; count < 3; count++) {
          const candidates = [...new Set(inv.hand.filter(code => api.cardType(code) === 'asset'
            && inv.resources >= Math.max(0, api.playCost(inv.seat, code) - 1)))]
          if (!candidates.length) break
          const answer = api.choice({ kind: 'card', source: '03023', seat: inv.seat, canSkip: true,
            prompt: `选择要打出的支援（还可打出 ${3 - count} 张；每张费用-1）。`,
            options: [{ id: 'done', label: '完成' },
              ...candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))] })
          if (answer === 'done') break
          api.playCard(inv.seat, answer, { discount: 1, noAction: true })
        }
      },
    },
  ],
  modifiers: [

  ],
}

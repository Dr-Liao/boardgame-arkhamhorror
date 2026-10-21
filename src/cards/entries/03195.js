// 03195 扒窃
// 卡面：快速。
// 卡面：[reaction]在你躲避一个敌人后，横置扒窃：抽取1张卡牌或获得1资源。如果你检定成功且超过难度至少2点，改为执行以上两项。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03195 扒手（Carcosa 版）：快速；躲避成功后横置，抽 1 张或获得 1 资源（超出 2 点时两者都做）。
// 5c-18：抽屉选择、抽牌日志与资源都由 ctx.api 结算，引擎不再认识这张卡。

export default {
  code: '03195',
  fast: true,
  abilities: [
    {
      kind: 'reaction', trigger: 'evadeSuccess', id: 'pickpocketing', legacyReaction: true,
      label: '躲避成功后抽 1 张或获得 1 资源', cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        const successBy = api.reactionContext()?.successBy || 0
        const answer = successBy >= 2 ? 'both' : api.choice({ kind: 'effect', source: '03195', seat: inv.seat,
          prompt: '选择抽1张牌或获得1资源。',
          options: [{ id: 'draw', label: '抽1张牌' }, { id: 'resource', label: '获得1资源' }] })
        if (answer === 'draw' || answer === 'both') api.drawCardsLogged(inv.seat, 1)
        if (answer === 'resource' || answer === 'both') api.gainResources(inv.seat, 1)
      },
    },
  ],
  modifiers: [

  ],
}

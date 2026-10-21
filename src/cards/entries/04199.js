// 04199 危险预感
// 卡面：快速。在任意[free]玩家时间段期间打出。
// 卡面：将危险预感放置入场，从混乱袋中随机揭示一个混乱标记，并将其封印在危险预感上。
// 卡面：强制 - 在将要从混乱袋中揭示一个混乱标记时：改为结算封印在此的标记，如同刚刚从混乱袋中揭示该标记。然后，弃掉危险预感。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04199 危险预感：快速事件——把这张牌放到场上，封印一个随机混乱标记；
// 之后本次检定改为结算封印的那个标记，卡片随后被弃掉（读点在引擎的揭示段）。

export default {
  code: '04199',
  substituteSealedToken: true,
  abilities: [
    {
      kind: 'played', fast: true, becomesAsset: true,
      label: '放入场并封印一个随机混乱标记',
      resolve: ({ inv, api }) => {
        const asset = api.putSelfIntoPlay(inv.seat, '04199')
        const token = asset ? api.sealRandomChaosToken(asset) : null
        api.info(`🔮 ${inv.name} 把「${api.cardName('04199')}」放入场${token ? `并封印了 ${api.tokenLabel(token)}` : ''}。`)
      },
    },
  ],
  modifiers: [

  ],
}

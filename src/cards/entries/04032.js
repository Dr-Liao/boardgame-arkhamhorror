// 04032 黑暗预言
// 卡面：快速。在你将要揭示一个混乱标记时打出。
// 卡面：改为揭示5个混乱标记，而非1个。选择其中1个带有[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号的标记结算并忽略其余标记。(如果没有揭示上述标记，从这些标记中选择任意一个标记结算，忽略其余标记。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04032 黑暗预言：本次检定改为揭示 5 个混乱标记并选 1 个。

export default {
  code: '04032',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'tokenReveal', criteria: { anyLocation: true },
      label: '黑暗预言',
      resolve: ({ inv, api }) => {
        if (!api.planTestReveal({ count: 5, choose: 1, symbolOnly: true, source: '04032' })) {
          api.info('只能在技能检定期间使用。')
          return
        }
        api.info(`${inv.name} 打出「${api.cardName('04032')}」：改为揭示 5 个混乱标记。`)
      },
    },
  ],
  modifiers: [

  ],
}

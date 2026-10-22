// 04308 时间借取
// 卡面：卓越。
// 卡面：[action]：在时间借取上放置1资源，视作一声滴答(时间借取上最多3声滴答)。本行动不会触发趁乱攻击。
// 卡面：强制 - 在你的回合开始时：移除时间借取上所有的滴答。你本回合可以进行额外等量次的行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04308 时间借取：动作在卡上放一声滴答（最多 3 声）。

export default {
  code: '04308',
  noOpportunityAttack: true,
  abilities: [
    {
      kind: 'action', label: '放置 1 声滴答（最多 3）', cost: { action: true }, maxClicks: 3,
      resolve: ({ source, api }) => {
        if (!source || (source.clicks || 0) >= 3) {
          api.info('「时间借取」上已有 3 声滴答。')
          return
        }
        const clicks = api.addClicks(source, 3)
        api.info(`⏳ 「${api.cardName('04308')}」放置第 ${clicks} 声滴答。`)
      },
    },
  ],
  clicksToActions: true,
  modifiers: [

  ],
}

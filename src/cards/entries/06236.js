// 06236 梦境日记（锐目）
// 卡面：研究完成。(FAQ，v2.0)
//       你在隐藏值至少为 4 的地点时，你的梦的本质获得[wild][wild]。
//       [reaction] 在你回合开始时：查找你的绑定卡牌，找出梦的本质，将其加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 研究完成：条目级 researchRequirement（升级池按战役记录门控，通用读点）；
//   · [reaction] 回合开始：turnBegins 窗口 + api.bonded.retrieve（绑定卡检索的唯一入口）。
// 跨卡条件图标由资产级 commitIconBonus 在投入 06113 时授予。

export default {
  code: '06236',
  researchRequirement: 'youHaveInterpretedTheDreams',
  commitIconBonus: ({ inv, committedCode, api }) => committedCode === '06113' && api.locationShroud(inv.location, inv.seat) >= 4 ? 2 : 0,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      label: '回合开始：查找绑定卡牌，将梦的本质加入手牌',
      criteria: [({ inv, context, helpers }) => context?.seat === inv.seat
        && helpers.bondedAvailable(inv.seat, '06236', '06113') > 0],
      resolve: ({ inv, api }) => {
        const taken = api.bonded.retrieve(inv.seat, '06236', { handCount: 1 })
        if (taken.length) api.info(`${inv.name} 用「梦境日记」找出了「${api.cardName('06113')}」。`)
      },
    },
  ],
  modifiers: [],
}

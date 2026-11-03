// 06237 梦境日记（缠斗）
// 卡面：研究完成。(FAQ，v2.0)
//       你与敌人交战时，你的梦的本质获得[wild][wild]。
//       [reaction] 在你回合开始时：查找你的绑定卡牌，找出梦的本质，将其加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 回合开始检索与跨卡投入图标都由通用读点接线。

export default {
  code: '06237',
  researchRequirement: 'youHaveInterpretedTheDreams',
  commitIconBonus: ({ state, inv, committedCode }) => committedCode === '06113'
    && (state.enemies || []).some(enemy => enemy.engagedSeat === inv.seat) ? 2 : 0,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      label: '回合开始：查找绑定卡牌，将梦的本质加入手牌',
      criteria: [({ inv, context, helpers }) => context?.seat === inv.seat
        && helpers.bondedAvailable(inv.seat, '06237', '06113') > 0],
      resolve: ({ inv, api }) => {
        const taken = api.bonded.retrieve(inv.seat, '06237', { handCount: 1 })
        if (taken.length) api.info(`${inv.name} 用「梦境日记」找出了「${api.cardName('06113')}」。`)
      },
    },
  ],
  modifiers: [],
}

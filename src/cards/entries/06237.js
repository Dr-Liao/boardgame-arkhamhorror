// 06237 梦境日记（缠斗）
// 卡面：研究完成。(FAQ，v2.0)
//       你与敌人交战时，你的梦的本质获得[wild][wild]。
//       [reaction] 在你回合开始时：查找你的绑定卡牌，找出梦的本质，将其加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点与简化同 06236：researchRequirement + turnBegins 的绑定卡检索已实现；
// 「交战时梦的本质获得[wild][wild]」是跨卡条件图标修正，没有读点。

export default {
  code: '06237',
  researchRequirement: 'youHaveInterpretedTheDreams',
  simplified: true,
  note: '未实现：「你与敌人交战时，你的梦的本质获得[wild][wild]」——梦的本质是绑定技能卡（06113），跨卡的条件投入图标修正没有读点。已实现：研究完成记录门控（researchRequirement）与回合开始检索绑定卡的反应。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      label: '回合开始：查找绑定卡牌，将梦的本质加入手牌',
      criteria: [({ inv, context }) => Boolean(context) && context.seat === inv.seat],
      resolve: ({ inv, api }) => {
        api.bonded.retrieve(inv.seat, '06237', { handCount: 1 })
        api.info(`${inv.name} 用「梦境日记」找出了「${api.cardName('06113')}」。`)
      },
    },
  ],
  modifiers: [],
}

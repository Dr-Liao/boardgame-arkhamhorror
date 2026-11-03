// 05324 美满结局
// 卡面：快速。在技能检定期间，你揭示一个混乱标记，且该标记将要令你的技能值减少到0时打出(包括[auto_fail]标记)。
// 卡面：取消该标记并改为将其视作[elder_sign]标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
export default {
  code: '05324',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'tokenReveal',
      fromHand: true,
      label: '取消使技能值降为 0 的标记，改为旧印',
      criteria: ctx => {
        const context = ctx.context || {}
        if (context.seat !== ctx.inv?.seat) return false
        return context.autoFail === true || (context.tokenDelta < 0 && Number(context.testValue) <= 0)
      },
      resolve: ({ context, api }) => {
        api.replaceChaosToken(context, 'eldersign')
        api.info('「美满结局」取消了混乱标记，改为结算旧印。')
      },
    },
  ],
  modifiers: [

  ],
}

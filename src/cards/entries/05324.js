// 05324 美满结局
// 卡面：快速。在技能检定期间，你揭示一个混乱标记，且该标记将要令你的技能值减少到0时打出(包括[auto_fail]标记)。
// 卡面：取消该标记并改为将其视作[elder_sign]标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05324 美满结局：显式简化。引擎的 tokenReveal interrupt 未接线（原语请求已 rejected），
// 卡片无法在标记结算前把它替换成 [elder_sign]；这里只实现可观测的一支：
// 负修正标记把技能值降到 0 或以下时，把它翻转为等值的正修正（negativeTokenRevealed 窗口的 flipTokenSign）。
// auto_fail 与符号标记分支未实现（卡面主效果的「视作旧印」需要替换标记值）。

export default {
  code: '05324',
  simplified: true,
  note: '未实现：取消混乱标记并视作 [elder_sign] 的 interrupt（tokenReveal + replacementToken 原语请求已被 rejected）。'
    + '现只实现负修正标记令技能值降到 0 或以下时翻转成正修正的分支；auto_fail 与符号标记分支不可达。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'negativeTokenRevealed',
      fromHand: true,
      label: '把将要令技能值降到 0 的负修正标记翻转为正修正',
      criteria: ctx => {
        const context = ctx.context || {}
        if (context.seat !== ctx.inv?.seat) return false
        const token = String(context.token ?? '')
        if (!/^-?\d+$/.test(token)) return false
        return Number(context.testValue ?? Infinity) <= 0
      },
      resolve: ({ context, api }) => {
        context.flipTokenSign = true
        api.info('「美满结局」取消了这次负修正标记，把它视作等值正修正结算。')
      },
    },
  ],
  modifiers: [

  ],
}

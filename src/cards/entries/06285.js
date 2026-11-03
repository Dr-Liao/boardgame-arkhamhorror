// 06285 黑猫
// 卡面：每当你在技能检定期间揭示[tablet]、[elder_thing]或[elder_sign]符号，你可以不使用该符号的效果，
//       改为选择使用以下效果：
//       [tablet]：-1。黑猫受到1点直接伤害。
//       [elder_thing]：-1。黑猫受到1点直接恐惧。
//       [elder_sign]：+5。治愈黑猫的全部伤害和恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06285 黑猫：在标记效果结算前可选替换其效果，保持揭示的标记身份不变。

export default {
  code: '06285',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'tokenEffectWouldResolve',
      label: '揭示碑文、古老者或旧印时：改为结算黑猫的效果',
      criteria: [({ inv, context }) => context?.seat === inv.seat
        && ['tablet', 'elderthing', 'eldersign'].includes(context?.token)
        && !context.replacementEffect],
      resolve: ({ source, context, api }) => {
        if (!source) return
        const replacement = context.token === 'tablet'
          ? { delta: -1, assetId: source.id, damage: 1 }
          : context.token === 'elderthing'
            ? { delta: -1, assetId: source.id, horror: 1 }
            : { delta: 5, assetId: source.id, healAll: true }
        api.replaceTokenEffect(context, replacement)
      },
    },
  ],
  modifiers: [],
}

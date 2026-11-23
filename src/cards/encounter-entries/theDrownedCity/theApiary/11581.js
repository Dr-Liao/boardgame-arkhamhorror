// 11581 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第二轮：scope:'storyAsset' + controlledAsset:true 已声明（受控剧情资产的身份）。
// P7 第四轮：
//   · 「将要离场时放一边，位于场外」由章节 behavior.assetLeftPlay（引擎既有 assetLeftPlay 读点）接线；
//   · 强制「你受到 1 点或更多伤害后：对古代遗物造成 1 点伤害」用条目 forced 描述子
//     trigger 'harmDealt'（引擎既有伤害分配窗口，context { damage, horror }）+ api.damageControlledAsset(self, 1)；
//   · 「控制它结束游戏时翻面」由章节 behavior 的结局结算（gameEnds 前）翻面，见 note。
export default {
  code: '11581',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  abilities: [{
    kind: 'forced',
    trigger: 'harmDealt',
    label: '古代遗物：你受到 1 点或更多伤害后，对它造成 1 点伤害',
    criteria: ({ state, source, context }) => {
      const owner = (state.investigators || []).find(inv => (inv.assets || []).includes(source))
      if (!owner) return false
      if (context?.seat != null && context.seat !== owner.seat) return false
      return (Number(context?.damage) || 0) >= 1
    },
    resolve: ({ source, api }) => {
      api.damageControlledAsset?.(source, 1)
    },
  }],
  note: "印刷：将要离场时放一边，位于场外；强制：你受到 1 点或更多伤害后，对古代遗物造成 1 点伤害；[reaction] 你控制它结束游戏时翻面结算（符文 [S]「机器」+ 胜利区）。已接线：受控剧情资产身份（controlledAsset:true）；「离场放一边」由章节 behavior.assetLeftPlay（引擎既有 assetLeftPlay 读点）撤销默认弃牌去向并记入章节放一边区；「受到 1+ 伤害后自伤 1」为 forced 描述子 trigger 'harmDealt'（引擎既有伤害窗口，context damage）+ api.damageControlledAsset(self, 1)；「控制它结束游戏时翻面」在 behavior.resolution 结局结算时若任一调查员控制则自动翻面（符文 [S] + 胜利区）。全部子句已接线。",
}

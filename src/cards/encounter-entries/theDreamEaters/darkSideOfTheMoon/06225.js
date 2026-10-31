// 06225 剧情支援「船长」（The Captain · 幻梦境的领航员）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [action] 如果每位未被击败的调查员都位于白船：谈判。检定意志（X）或智力（X）以说服船长启航。
// X 为所有调查员之中最高的警报等级。如果你检定成功，推进场景。位于白船的任意调查员都可以激活此能力。
//
// 依据 Haskell Asset/Cards/...（The Captain，白船揭示时放到白船；任意白船上的调查员可发动）：
//   · 剧情支援的「任意调查员可发动」行动不是普通资产能力（剧情支援不在 inv.assets 里），
//     因此数据放 assetRule.captainParley，由 behavior.actions/performAction 统一提供
//     （与 05177 等「规则在 behavior」的剧情支援同一手法）；本条目只声明数据。
export default {
  code: '06225',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    captainParley: {
      rule: 'tshCaptainSetsSail',
      locationCode: '06223',
      skills: ['willpower', 'intellect'],
      difficulty: { kind: 'highestAlarmLevel' },
      label: '[action] 白船：谈判，检定意志或智力（X = 最高警报等级），成功推进场景',
    },
  },
}

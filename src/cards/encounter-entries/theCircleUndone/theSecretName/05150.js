// 05150 黑书（The Black Book · 血字签名）
// 归属：关卡专用 · theSecretName（P8 w-witch）。剧情资产：act1 背面交给一位调查员控制，
// 结局 1/2 可选择加入战役牌组（api.campaignCard，P2.10 原语）。
// 卡面：你得到 +1[willpower] 和 +1[intellect]；[reaction] 打出一张卡牌时，横置黑书并受到 X 点恐惧，
// 该卡牌费用 -X。
// 实现口径：被动技能加成走条目 passive.stats（引擎技能读点）；「打牌减费」需要费用支付窗口的
// 反应修饰，P8 未接线（见 specs/theSecretName.md §3 与 behavior.scenarioApproximations）。
export default {
  code: '05150',
  scope: 'storyAsset',
  implemented: true,
  passive: { stats: { willpower: 1, intellect: 1 } },
  note: '被动 +1 意志/+1 智识已接线；[reaction] 横置减费近似未接线（P9 交互窗口）。',
}

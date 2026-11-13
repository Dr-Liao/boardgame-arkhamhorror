// 09634b 玄丧之镜（The Sable Glass · Translocated Lens · [[Unstable]] 面）· 绯红密钥
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。物理卡 09634 的动荡面（b 面）。
// 卡面（中）：变换 - 每位调查员将自己手中印刷费用最高的非弱点卡牌放在一边，位于场外，作为一个空洞。
//   然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
//
// 密钥契约（同 09634a）：实体登记在 `campaign.tsk.keys`，Shift 由 behavior.resolveKeyShift 结算；
// 读点：`assetRule.keyShift.effect.kind === 'hollowHighestCostInHand'` → 逐位调查员取「印刷费用最高的
// 非弱点手牌」走 behavior.hollowFromHand（空洞原语 + 索恩反应派发），然后 `keys.shift` 翻回稳定面。
export default {
  code: '09634b',
  name: '玄丧之镜',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    keyShift: {
      keyId: '09634',
      face: 'unstable',
      trigger: 'investigatorFastWindow',
      effect: { kind: 'hollowHighestCostInHand', scope: 'eachInvestigator', excludeWeakness: true },
      flip: 'whenInvestigatorShift',
    },
  },
  note: 'approximation: 「印刷费用最高的非弱点卡」按 cards-data 的 `cost` 排序（同分按卡号，保证确定性）；'
    + '敌人持有的钥匙只结算效果、不翻回稳定面（`by:"enemy"` 时不翻面），与「附属到敌人的钥匙不能翻到稳定面」一致。',
}

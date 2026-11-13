// 09680b 影穑（The Shade Reaper · Harvester of Woe · [[Unstable]] 动荡面）· 绯红密钥 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。物理卡 09680 的另一面（稳定面 09680a）。
// 卡面：
//   变换 - 每位调查员失去 1 个行动（如果现在不是其回合，则其下一个回合期间失去 1 个行动）。
//   然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
//
// 读点：
//   · `assetRule.shift.kind: 'loseActions'` → behavior.shiftShadeReaper 的唯一结算点：
//     当前回合的调查员用 api.loseActions 扣除，其余调查员记入章节状态 `pendingActionLoss`，
//     在 behavior.turnBegins 时扣除；
//   · `flipOnShift: 'investigatorOnly'`：朱三娘变换（by="tzuSanNiang"）时不翻面（参考实现 shift by enemy）；
//   · 影穑的持有者/面由 tsk-scarlet-keys 登记，本条目只声明当前面的效果数据。
export default {
  code: '09680b',
  name: '影穑',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    shift: {
      kind: 'loseActions',
      stableSide: false,
      actionsPerInvestigator: 1,
      flipOnShift: 'investigatorOnly',
    },
  },
  note: 'approximation: 「不在其回合 → 下个回合失去 1 行动」用章节状态 pendingActionLoss + turnBegins 补偿；'
    + '引擎没有延迟失去行动的原语。',
}

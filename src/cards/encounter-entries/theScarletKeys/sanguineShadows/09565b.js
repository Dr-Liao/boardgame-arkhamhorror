// 09565b 恸哭女士（The Weeping Lady · Broken Statuette · [[Unstable]] 面）· 绯红密钥
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   变换 - 如可能，每位调查员必须弃掉自己控制的一个支援。然后，如果是调查员变换了本钥匙，
//   将其翻至 [[Stable]] 面。
//
// 与 09565a 同一把物理密钥（id `09565`，stableFace 09565a / unstableFace 09565b）；
// 本条目声明动荡面的 Shift 效果，章节 behavior 的 `shiftWeepingLady()` 读 `assetRule.shift` 结算。
export default {
  code: '09565b',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    shift: { kind: 'discardAsset', eachInvestigator: 1, flipToStable: true },
  },
  note: '密钥实体由 tsk-scarlet-keys 管理；条目只声明 Shift 效果（动荡面：每位调查员弃 1 个支援 → 翻回稳定面）。',
}

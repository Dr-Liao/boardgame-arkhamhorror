// 09565a 恸哭女士（The Weeping Lady · Broken Statuette · [[Stable]] 面）· 绯红密钥
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   变换 - 发现你所在地点或连接地点的 1 个线索。将本钥匙翻至 [[Unstable]] 面。
//
// 绯红密钥不是场景在场实体（不写 state.assets/enemies/locations）：物理密钥由
// `api.mechanics.tsk.keys`（src/engine/tsk-scarlet-keys.js）以
// `{ id: '09565', stableFace: '09565a', unstableFace: '09565b' }` 注册，翻面走 `keys.shift`。
// 本条目只声明当前面的 Shift 效果；章节 behavior 的 `shiftWeepingLady()` 读
// `assetRule.shift` 结算后翻面（这是该字段的唯一读点）。
export default {
  code: '09565a',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    shift: { kind: 'discoverClue', amount: 1, at: 'hereOrConnecting' },
  },
  note: '密钥实体由 tsk-scarlet-keys 管理；条目只声明 Shift 效果（稳定面：发现 1 个线索 → 翻到动荡面）。',
}

// 09634a 玄丧之镜（The Sable Glass · Translocated Lens · [[Stable]] 面）· 绯红密钥
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。物理卡 09634 的稳定面（a 面）。
// 卡面（中）：变换 - 查看你所在地点每张隐匿迷你卡牌的已揭示面（不将其揭露）。将本钥匙翻至[[动荡]]面。
//
// 密钥契约（docs/campaign/theScarletKeys/primitives.md §2 tsk-scarlet-keys）：
//   · 密钥实体登记在 `campaign.tsk.keys`（id `09634`，stableFace `09634a` / unstableFace `09634b`）；
//   · 密钥卡不是场景在场实体，条目字段只能是注册表允许的键，因此 Shift 声明放在 `assetRule.keyShift`
//     （与同循环《血色阴影》的 09565a/b 同一形状）；
//   · Shift 的结算入口是章节 behavior.resolveKeyShift（内容层唯一执行点），本条目只声明数据；
//   · 读点：`assetRule.keyShift.effect.kind === 'lookAtConcealedAtLocation'` →
//     behavior.resolveKeyShift 把该地点每张迷你卡的 `known` 置真（不翻面、不揭露），再 `keys.shift` 翻面；
//   · 被索恩（敌人）持有时由 behavior.encounterDrawn 以 `by:'enemy'` 触发（不翻回稳定面）。
export default {
  code: '09634a',
  name: '玄丧之镜',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    keyShift: {
      keyId: '09634',
      face: 'stable',
      trigger: 'investigatorFastWindow',
      effect: { kind: 'lookAtConcealedAtLocation', revealSide: 'revealed', expose: false },
      flip: 'always',
    },
  },
  note: 'approximation: 「已揭示面」用迷你卡的 `known` 标记（观察投影只对已知者显示 kind），'
    + '不翻面也不揭露；引擎没有「只对某座位可见」的迷你卡字段，`known` 是全桌可见的近似。',
}

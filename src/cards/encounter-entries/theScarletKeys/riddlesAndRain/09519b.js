// 09519b 渡鸦之眼（The Eye of Ravens） · 绯红密钥 · 动荡面（Macabre Ruby Marble）
// 归属：关卡专用 · theScarletKeys/riddlesAndRain（riddles_and_rain 组；物理卡 09519 的 b 面）。
// 卡面：变换 - 抽取遭遇牌库顶的卡牌。然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
//
// 密钥契约（docs/campaign/theScarletKeys/primitives.md §2 tsk-scarlet-keys）：
//   · 本面只声明 Shift 数据，结算入口是章节 behavior.resolveKeyShift；
//   · 读点（条目字段用 `flags.keyShift`）：
//       - `effect.type = 'drawEncounterTop'` → behavior.resolveKeyShift 抽遭遇牌库顶 1 张；
//       - `flip = 'ifInvestigator'` → 只有调查员触发变换时翻回稳定面（敌人/剧情强制翻面不翻）。
export default {
  code: '09519b',
  scope: 'storyAsset',
  implemented: true,
  note: 'key: 渡鸦之眼动荡面（Shift 由章节 behavior.resolveKeyShift 执行）',
  flags: {
    keyShift: {
      keyId: '09519',
      face: 'unstable',
      trigger: 'shifted',
      effect: { type: 'drawEncounterTop', count: 1 },
      flip: 'ifInvestigator',
    },
  },
}

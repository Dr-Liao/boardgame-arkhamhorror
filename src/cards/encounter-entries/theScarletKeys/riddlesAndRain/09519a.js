// 09519a 渡鸦之眼（The Eye of Ravens） · 绯红密钥 · 稳定面（Macabre Ruby Marble）
// 归属：关卡专用 · theScarletKeys/riddlesAndRain（riddles_and_rain 组；物理卡 09519 的 a 面）。
// 卡面：变换 - 在你地点的技能检定期间，执行检定的调查员将其本次检定的基础技能值设为6。将本钥匙翻至[[动荡]]面。
//
// 密钥契约（docs/campaign/theScarletKeys/primitives.md §2 tsk-scarlet-keys）：
//   · 密钥实体登记在 `campaign.tsk.keys`（id 09519，stableFace 09519a / unstableFace 09519b）；
//   · Shift 的结算入口是章节 behavior.resolveKeyShift（内容层唯一执行点），本条目只声明数据；
//   · 读点（条目字段用 `flags.keyShift`，与引擎 ENTRY_KEYS 的既有自由字段同层）：
//       - `flags.keyShift.effect.value` → behavior.statModifier（检定进行中把基础技能值补到 6；
//         近似：按修正差值实现，见 behavior 文件头近似 2）；
//       - `flags.keyShift.flip` → behavior.resolveKeyShift（稳定面每次触发后必翻到动荡面）。
export default {
  code: '09519a',
  scope: 'storyAsset',
  implemented: true,
  note: 'approximation: 密钥附属地点用章节标记（原语 bearer 无地点类型）；基础技能值 6 由 behavior.statModifier 补足、检定后翻面',
  flags: {
    keyShift: {
      keyId: '09519',
      face: 'stable',
      trigger: 'skillTestAtKeyLocation',
      effect: { type: 'setBaseSkillValue', value: 6, until: 'endOfTest', at: 'keyLocation' },
      flip: 'always',
    },
  },
}

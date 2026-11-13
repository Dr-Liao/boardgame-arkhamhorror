// 09590b 扭曲反棱镜（The Twisted Antiprism · 动荡面 [[Unstable]]）· 绯红密钥 · dealings_in_the_dark
// 卡面：变换 - 最近的调查员必须将 1 个毁灭标记放在其控制的支援上，或其所在地点的遭遇卡牌上，
//       或当前密谋上。然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
// 读点：
//   · 密钥实体是战役级扩展 `campaign.tsk.keys`；本条目只声明面身份与变换效果键，由本章
//     behavior.shiftTwistedAntiprism 读取 `entryFlags(code).shiftRule` 结算。
//   · 「最近的调查员」= behavior.nearestInvestigator + placeUnstableDoom（agi/遭遇卡/密谋三选一，
//     写入口 api.doomOn / api.addDoom）。
//   · 「如果是调查员变换则翻回稳定面」= behavior 按 `by` 决定是否调用 tsk.keys.shift；敌人变换时
//     不翻面（原语 shiftKey 恒翻面，见 primitive-requests/09590b.json）。
const CODE = '09590b'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: {
    scarletKey: 'theTwistedAntiprism',
    keyFace: 'unstable',
    shiftRule: 'twistedAntiprismUnstable',
  },
  note: 'approximation: 敌人变换动荡面时不翻面（原语 shiftKey 恒翻面）——behavior 只结算效果并记录'
    + '每轮一次；见 primitive-requests/09590b.json。',
}

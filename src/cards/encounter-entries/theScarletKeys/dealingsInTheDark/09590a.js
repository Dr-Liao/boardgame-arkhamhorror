// 09590a 扭曲反棱镜（The Twisted Antiprism · 稳定面 [[Stable]]）· 绯红密钥 · dealings_in_the_dark
// 卡面：变换 - 查看你牌库顶的 3 张卡牌。从中抽取 1 张，将其余卡牌洗回你的牌库。将本钥匙翻至[[动荡]]面。
// 读点：
//   · 密钥实体是战役级扩展 `campaign.tsk.keys`（src/engine/tsk-scarlet-keys.js），不是在场卡：
//     本条目只声明「面身份 + 变换效果键」，由本章 behavior.shiftTwistedAntiprism 读取
//     `entryFlags(code).shiftRule` 结算（见 docs/campaign/theScarletKeys/primitives.md §2）。
//   · 「查看牌库顶 3 张、抽 1、其余洗回」= api.lookAt(seat, { zone:'deck', count:3, choose:1,
//     returnStrategy:'shuffle' })（章节 behavior 调用；引擎的看牌/检索统一入口）。
const CODE = '09590a'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: {
    scarletKey: 'theTwistedAntiprism',
    keyFace: 'stable',
    shiftRule: 'twistedAntiprismStable',
  },
  note: '密钥实体与 Shift 记账在 campaign.tsk.keys；本面效果由 behavior.shiftTwistedAntiprism 读取 shiftRule 结算。',
}

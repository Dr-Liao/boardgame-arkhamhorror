// 10522 棱柱碎片 · 剧情资产（writtenInRock）
// 卡面：使用（4  brilliance）。[reaction] 当一张剧本卡或弱点卡效果将要从你手中弃掉任意数量
// 的卡时，横置棱柱碎片并花费 1 brilliance：改为忽略该效果并抽同样数量的卡。
// 一张卡一个文件：碎片在幕间「塌方」放在列 4 最下方（与 10506 的 [action] 取得控制权配对）；
// 取得控制在 behavior.actions（writtenInRockTakeShard）。使用次数/弃牌替代的窗口由
// 引擎的手牌弃置管线读取 flags。
export default {
  code: '10522',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    prismaticShard: true,
    uses: 4,
    useKind: 'brilliance',
    takeControlAction: true,
    ignoreHandDiscardReaction: true,
  },
  note: '近似：「改为忽略弃手并抽等量卡」需要引擎手牌弃置窗口的读点；本章只登记次数/身份与控制权，弃牌替代窗口交给 P8 逐卡验收。',
}

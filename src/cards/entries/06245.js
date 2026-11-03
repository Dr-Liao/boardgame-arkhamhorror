// 06245 希望微光
// 卡面：多重。
//       希望微光只能从你的弃牌堆打出。
//       将你弃牌堆中的所有希望微光加入你的手牌（包括本卡牌）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「只能从弃牌堆打出」= 条目级 playableFromDiscard（弃牌堆通道的唯一声明），
//     弃牌堆里的希望微光因此进入正常出牌候选（legalMoves 的 fromDiscard 通道）；
//   · 结算：把弃牌堆里其余的每一张希望微光用 api.moveCard 移回手牌（统一的区域移动原语）。
// 打出后归处由 returnToHandAfterPlay 控制，本张也返回手牌。

export default {
  code: '06245',
  playableFromDiscard: true,
  playableOnlyFromDiscard: true,
  returnToHandAfterPlay: true,
  abilities: [
    {
      kind: 'played',
      label: '将弃牌堆中的所有希望微光加入手牌',
      resolve: ({ inv, api }) => {
        const copies = (inv.discard || []).filter(code => code === '06245')
        for (let index = 0; index < copies.length; index++) {
          api.moveCard({ code: '06245', from: 'discard', to: 'hand' })
        }
        if (copies.length) api.info(`${inv.name} 将弃牌堆中的 ${copies.length} 张「希望微光」加入手牌。`)
      },
    },
  ],
  modifiers: [],
}

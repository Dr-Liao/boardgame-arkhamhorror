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
// 已知简化：「包括本卡牌」——正在打出的这一张在结算期间不在任何区域，引擎在结算收尾才把它
//   放进弃牌堆；没有「打出的事件改为加入手牌」的读点，因此本张仍按普通事件进弃牌堆（见 note）。

export default {
  code: '06245',
  playableFromDiscard: true,
  simplified: true,
  note: '未实现/简化：「只能从弃牌堆打出」已通过 playableFromDiscard 声明（普通出牌路径仍允许从手牌打出——没有按区域拒绝手牌打出的读点）；「包括本卡牌」——正在打出的这张在结算期间不在任何区域（收尾才进弃牌堆），没有「打出的事件改为加入手牌」的读点，因此本张不进手牌，其余弃牌堆中的希望微光都会回到手牌。',
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

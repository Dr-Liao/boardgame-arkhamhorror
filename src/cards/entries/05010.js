// 05010 悬案
// 卡面：将你的1个线索放在隐藏值最高的地点上。将悬案从游戏中移除。
// 卡面：强制 - 如果悬案将要洗入你的直觉牌库：改为将它加入你的威胁区域。直到游戏结束，它获得：
//       "强制 - 在游戏结束时：乔·戴蒙德本场冒险少取得2点经验值。"
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// simplified：「本场冒险少取得 2 点经验」需要结局结算读点（属于战役层，不在 M1 范围），
// 这里只记录标记；「改为进入威胁区域」由直觉牌库的 avoidHunchShuffle 读点落实。

export default {
  code: '05010',
  avoidHunchShuffle: true,
  simplified: true,
  note: '「游戏结束时少取得 2 点经验」只记录 inv.unsolvedCasePenalty 标记，经验结算读点属 P9/P10。',
  abilities: [
    {
      kind: 'weakness',
      label: '悬案：放 1 个线索到隐藏值最高的地点，然后移出游戏',
      weakness: { type: 'unresolvedCase' },
      resolve: ({ inv, state, api }) => {
        const revealed = (state.locations || []).filter(location => location.revealed)
        const target = revealed.slice().sort((left, right) => ((right.shroud || 0) - (left.shroud || 0))
          || String(left.id).localeCompare(String(right.id)))[0]
        if (target && (inv.clues || 0) > 0) {
          inv.clues = Math.max(0, (inv.clues || 0) - 1)
          target.clues = (target.clues || 0) + 1
          api.info(`${inv.name} 把 1 个线索放在「${target.name}」（隐藏值 ${target.shroud}）。`)
        }
        state.removedFromGame ||= []
        state.removedFromGame.push('05010')
        inv.unsolvedCasePenalty = true
        api.info('「悬案」被移出游戏。')
      },
    },
  ],
  modifiers: [],
}

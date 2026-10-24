// 05010 悬案
// 卡面：将你的1个线索放在隐藏值最高的地点上。将悬案从游戏中移除。
// 卡面：强制 - 如果悬案将要洗入你的直觉牌库：改为将它加入你的威胁区域。直到游戏结束，它获得：
//       "强制 - 在游戏结束时：乔·戴蒙德本场冒险少取得2点经验值。"
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 修复（task-22）：悬案是「弱点事件」，乔的直觉牌库会在调查阶段把它揭示进手牌；旧实现只有
// weakness 描述子、没有 playableWeakness，标准流程里它永远不能被打出（validateMove 返回
// 「该牌不能作为行动打出」），第一段「放 1 个线索 + 移出游戏」不可达。现在：
//   · playableWeakness: true → 允许作为弱点事件打出（src/engine/actions.js:79 读点）；
//   · played 描述子实现第一段：把 1 个线索放到隐藏值最高的地点（平局由玩家选择），
//     随后清掉直觉牌库的 hunchRevealed，避免阶段末被当成「未打出」重复洗回（05002 引擎
//     原语修好前先在本卡兜底）；
//   · 条目级 removeAfterPlay: true → 打出结算后进入 state.removedFromGame，不进弃牌堆
//     （src/engine/actions.js:243-292 读点）。
//
// 剩余未实现（引擎原语，见 artifacts/tcu-fix/primitive-requests/fix-investigator.json）：
//   · 「游戏结束时乔少取得 2 点经验」需要结局/经验结算读点；现在只在（抽到弱点的兜底路径）
//     记 inv.unsolvedCasePenalty 标记。
//   · 「改为加入威胁区域」由直觉牌库的 avoidHunchShuffle 读点落实（src/engine/hunch-deck.js），
//     但该路径目前不会写 unsolvedCasePenalty 标记，需要引擎在 avoidHunchShuffle 分支补记。

const highestShroudLocations = state => {
  const locations = (state.locations || []).filter(location => location && typeof location.shroud === 'number')
  if (!locations.length) return []
  const maxShroud = Math.max(...locations.map(location => location.shroud || 0))
  return locations.filter(location => (location.shroud || 0) === maxShroud)
}

const placeClueOnHighestShroud = ({ inv, state, api }) => {
  const candidates = highestShroudLocations(state)
  if (!candidates.length) return null
  if ((inv.clues || 0) <= 0) {
    api.info(`${inv.name} 没有线索可以放在隐藏值最高的地点上。`)
    return null
  }
  const target = candidates.length === 1 ? candidates[0] : candidates.find(location =>
    String(location.id) === String(api.choice({
      kind: 'location', source: '05010', seat: inv.seat,
      prompt: '「悬案」：选择隐藏值最高的地点（并列）之一放置 1 个线索。',
      options: candidates.map(location => ({
        id: location.id,
        label: `${location.name || location.id}（隐藏值 ${location.shroud}）`,
      })),
    }))) || candidates[0]
  inv.clues = Math.max(0, (inv.clues || 0) - 1)
  target.clues = (target.clues || 0) + 1
  api.info(`${inv.name} 把 1 个线索放在「${target.name || target.id}」（隐藏值 ${target.shroud}）。`)
  return target
}

export default {
  code: '05010',
  avoidHunchShuffle: true,
  playableWeakness: true,
  removeAfterPlay: true,
  simplified: true,
  note: '「游戏结束时少取得 2 点经验」需要结局/经验结算读点（已登记 primitive request）；打出「放线索+移出游戏」与直觉牌库→威胁区两条路径已实现。',
  abilities: [
    {
      kind: 'played',
      label: '悬案：放 1 个线索到隐藏值最高的地点，将悬案移出游戏',
      resolve: ({ inv, state, api }) => {
        placeClueOnHighestShroud({ inv, state, api })
        // 05002 的引擎原语（打出的 hunchRevealed 未清理）修好前，本卡自己兜底：
        // 避免本阶段结束 returnHunchCard 把已移出游戏的悬案再洗回直觉牌库。
        if (inv.hunchRevealed === '05010') inv.hunchRevealed = null
        api.info('「悬案」被移出游戏。')
      },
    },
    {
      kind: 'weakness',
      label: '悬案：抽到弱点时放 1 个线索到隐藏值最高的地点，然后移出游戏',
      weakness: { type: 'unresolvedCase' },
      resolve: ({ inv, state, api }) => {
        placeClueOnHighestShroud({ inv, state, api })
        state.removedFromGame ||= []
        state.removedFromGame.push('05010')
        inv.unsolvedCasePenalty = true
        api.info('「悬案」被移出游戏。')
      },
    },
  ],
  modifiers: [],
}

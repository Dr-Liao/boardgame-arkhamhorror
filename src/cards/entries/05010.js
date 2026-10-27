// 05010 悬案
// 卡面：将你的1个线索放在隐藏值最高的地点上。将悬案从游戏中移除。
// 卡面：强制 - 如果悬案将要洗入你的直觉牌库：改为将它加入你的威胁区域。直到游戏结束，它获得：
//       "强制 - 在游戏结束时：乔·戴蒙德本场冒险少取得2点经验值。"
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 打出通道（两条，都由条目级字段声明，引擎不写死卡号）：
//   · 直觉牌库揭示（2026-10-27 修复）：乔的直觉牌库在调查阶段开始时揭示悬案，05002 允许
//     「以 -2 费用打出该卡牌，如同它是你的手牌」。moves.js 的 fromHunch 通道按
//     playableWeakness 放行弱点事件；此前该通道用 !isWeaknessCard 一刀切，导致第一段
//     「放线索 + 移出游戏」在真实流程里不可达（测试靠 hand 兜底才通过）。
//   · 威胁区打出（playableFromThreat）：被「改为加入威胁区域」之后，这张牌在威胁区里
//     仍可打出（条目级区域许可，读点 play-condition.playAccess().fromThreat / moves.js /
//     actions.js 的 doPlay(fromThreatId)）。威胁区打出没有 -2 折扣（那不是揭示窗口），按印刷费用支付。
//
// 其余行为：
//   · playableWeakness: true → 允许作为弱点事件打出（src/engine/actions.js:82 读点）；
//   · played 描述子实现第一段：把 1 个线索放到隐藏值最高的地点（平局由玩家选择）；
//   · 条目级 removeAfterPlay: true → 打出结算后进入 state.removedFromGame，不进弃牌堆；
//   · 「改为加入威胁区域」由直觉牌库的 avoidHunchShuffle 读点落实（src/engine/hunch-deck.js）；
//   · 「在游戏结束时少取得 2 点经验」→ 条目级 scenarioXpModifier: -2；引擎结局 XP 结算
//     （src/engine/campaign-flow.js:262-270）会扫描威胁区条目并套用该修正；从威胁区打出后
//     卡牌移出游戏，该获得性能力随之消失（威胁区结算只统计仍留在威胁区的条目）。
//
// 说明：兜底路径（非直觉牌库直接抽到该弱点，正常流程不会发生）按普通弱点结算并移出游戏。

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
  // 2026-10-27：被「改为加入威胁区域」后仍可在威胁区打出（区域许可原语，读点
  // play-condition.playAccess().fromThreat / moves.js / actions.js:doPlay(fromThreatId)）。
  playableFromThreat: true,
  removeAfterPlay: true,
  // 「强制 - 在游戏结束时：乔·戴蒙德本场冒险少取得 2 点经验值」：威胁区条目字段，
  // 由 src/engine/campaign-flow.js 的结局 XP 结算统一读取（不写死卡号）。
  scenarioXpModifier: -2,
  note: '打出通道：直觉牌库揭示（playableWeakness + fromHunch）与威胁区（playableFromThreat）均可打出；打出结算「放线索 + 移出游戏」。未打出时由 avoidHunchShuffle 改为进入威胁区，并由 scenarioXpModifier 在结局 XP 结算扣 2 点经验（仅在仍在威胁区时）。',
  abilities: [
    {
      kind: 'played',
      label: '悬案：放 1 个线索到隐藏值最高的地点，将悬案移出游戏',
      resolve: ({ inv, state, api }) => {
        placeClueOnHighestShroud({ inv, state, api })
        // 防御性兜底：fromHunch 通道已在 dispatch 里清掉 hunchRevealed（威胁区通道本来就没有它），
        // 这里再清一次，避免阶段末 returnHunchCard 把已移出游戏的悬案当成「未打出」处理。
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
        api.info('「悬案」被移出游戏。')
      },
    },
  ],
  modifiers: [],
}

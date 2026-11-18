// 10001 威尔森·理查德（Wilson Richards）· 守卫者 · 工人 · 漂泊者
// 卡面：
//   你每轮打出的第一张[[工具]]支援资源费用减少1点。
//   你在[[工具]]支援的技能检定期间得到技能值+1。
//   [elder_sign]效果：+0。你可以将自己游戏区域的一个[[工具]]支援与自己手牌中一个印刷费用相等或更低的
//     [[工具]]支援交换。
//
// 读点（卡面 → 引擎读点）：
//   · 首张工具折扣：`investigator.firstAssetOfRound = { trait: 'tool', amount: 1 }` 是 P2 原语，
//     唯一读点 src/engine/action-history.js#firstAssetDiscount（在 turn-flow.js#playCost 里扣减），
//     记账读点是同文件的 recordPlayedCard（只对 type==='asset' 累积 assetTraits，因此[[工具]]**事件**
//     不会消耗本轮的折扣）。
//   · [[工具]]支援的技能检定 +1：`modifiers` 的 `skill:*` + 声明式条件。检定来源支援的权威读点与
//     api.playerTools.testAssetSource 同源：tests.js#defineMeta 写入的非枚举 `skillTest.assetSourceId`，
//     其次是检定 source 上的 assetId，最后是描述子结算期间的 `state._resolvingAssetId`
//     （reveal.js#executeDescriptor / actions.js、combat.js 的 source.assetId 同一口径）。
//     该支援必须由本人控制、印刷特性含 Tool（特性读 ALL_CARDS，与引擎 cardDef 同一份数据）。
//   · 旧印交换：api.swapControlledAssetFromHand（api-card.js 的唯一互换写点：自带印刷费用比较、
//     [[工具]]特性校验与槽位检查；旧支援退回手牌、新支援在原槽位入场）。
//     「你可以」用 api.choice 让玩家选择；没有合法配对时直接跳过。
import { ALL_CARDS } from '../../cards/cards-data.js'

const ELDER_SIGN_ID = '10001-eldersign'

const traitsOf = code => ALL_CARDS[code]?.traits || []
const isTool = code => traitsOf(code).some(trait => String(trait).toLowerCase() === 'tool')
const printedCost = code => {
  const def = ALL_CARDS[code]
  return def && Number.isFinite(def.cost) ? def.cost : null
}

// 本次技能检定是否由「我控制的[[工具]]支援」发起（与 api.playerTools.testAssetSource 同一份来源）。
const testAssetSourceId = state =>
  state?.skillTest?.assetSourceId
  ?? state?.skillTest?.source?.assetId
  ?? state?._resolvingAssetId
  ?? null

const testedOnOwnTool = (state, inv) => {
  const sourceId = testAssetSourceId(state)
  if (sourceId == null) return false
  const asset = (inv?.assets || []).find(item => item.id === sourceId)
  return Boolean(asset) && isTool(asset.code)
}

export default {
  code: '10001',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0 },
    // P2 原语：每轮打出的第一张 [[工具]] 支援费用 -1（action-history.js#firstAssetDiscount 唯一读点）。
    firstAssetOfRound: { trait: 'tool', amount: 1 },
  },
  elderSign: {
    id: ELDER_SIGN_ID,
    label: '威尔森旧印：+0；你可以用一个[[工具]]支援交换手牌中印刷费用相等或更低的[[工具]]支援',
    resolve: ({ state, inv, api }) => {
      const controlled = (inv.assets || []).filter(asset => !asset.attachedToAsset && isTool(asset.code))
      const handTools = (inv.hand || []).flatMap((code, index) => {
        const def = ALL_CARDS[code]
        if (!def || def.type !== 'asset' || !isTool(code)) return []
        const cost = printedCost(code)
        return cost == null ? [] : [{ code, index, cost }]
      })
      // 合法配对：手牌[[工具]]的印刷费用 <= 在场[[工具]]的印刷费用，且旧支援离场后槽位放得下
      // （api.canEquip 与 api.swapControlledAssetFromHand 内部的校验同一读点，避免给出必然失败的选项）。
      const pairs = []
      const canPlace = (asset, code) => api.canEquip(
        { ...inv, assets: (inv.assets || []).filter(item => item.id !== asset.id) }, ALL_CARDS[code])
      for (const asset of controlled) {
        const cost = printedCost(asset.code)
        if (cost == null) continue
        for (const candidate of handTools) {
          if (candidate.cost > cost || !canPlace(asset, candidate.code)) continue
          pairs.push({ asset, handIndex: candidate.index, label: `「${api.cardName(asset.code)}」→「${api.cardName(candidate.code)}」` })
        }
      }
      if (!pairs.length) {
        api.info('威尔森旧印：没有可以用手牌[[工具]]交换的在场[[工具]]支援。')
        return { delta: 0 }
      }
      const answer = pairs.length === 1
        ? api.choice({
          kind: 'target', source: '10001', seat: inv.seat,
          prompt: `威尔森旧印：是否交换${pairs[0].label}？`,
          options: [{ id: 'skip', label: '不交换' }, { id: '0', label: `交换 ${pairs[0].label}` }],
        })
        : api.choice({
          kind: 'target', source: '10001', seat: inv.seat,
          prompt: '威尔森旧印：选择要交换的[[工具]]支援（或跳过）。',
          options: [{ id: 'skip', label: '不交换' },
            ...pairs.map((pair, index) => ({ id: String(index), label: `交换 ${pair.label}` }))],
        })
      const picked = pairs[Number(answer)]
      if (!picked) return { delta: 0 }
      const placed = api.swapControlledAssetFromHand(inv.seat, picked.asset.id, picked.handIndex, { trait: 'Tool' })
      if (placed) {
        api.info(`🔧 ${inv.name} 旧印：${picked.label} 完成交换。`)
      } else {
        api.info('威尔森旧印：这次交换不合法（费用或槽位不满足），没有发生交换。')
      }
      return { delta: 0 }
    },
  },
  abilities: [],
  modifiers: [
    {
      // 「你在[[工具]]支援的技能检定期间得到技能值+1」：只在该检定的来源支援是本人控制的[[工具]]时生效。
      target: 'skill:*',
      amount: 1,
      condition: { when: ({ state, inv }) => testedOnOwnTool(state, inv) },
    },
  ],
}

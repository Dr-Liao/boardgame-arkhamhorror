// 10722 着彩枯疫（Chroma Blight）· 诡计 · 共享遭遇组 horrors_in_the_rock（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10722）：
//   显现 - 将着彩枯疫放置入场，放到你的威胁区域。每位调查员仅限 1 张。
//   强制 - 在你从自己牌库抽取卡牌后：放置 1 资源在着彩枯疫上，作为光辉。
//   强制 - 如果着彩枯疫上有总计 6 光辉：将放在一边的一张水晶寄生虫放置入场，放在你的地点。
//           将着彩枯疫从游戏中移除。
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat（scenario-runtime 的唯一威胁区写入口）；
//     条目 treacheryRule.threatArea 与 TSK 同类卡同款；
//   · 「从自己牌库抽牌后」= cardsDrawn 窗口（deck-ops.js#drawCards 唯一派发点，context 带
//     seat/location/drawnCodes），牌在持有者的威胁区，按 source 实例定位持有者；
//   · 「光辉」= api.placeUse(source, 'brilliance', 1)（api-misc 的通用卡上计数/使用标记写入口，
//     计数落在 card.useTokens；card-counters 的具名计数器只认 bounty/evidence/hollow，不适用）；
//   · 「生成放一边的水晶寄生虫」= api.takeFromSetAside + api.scenario.spawn（章节把 10721
//     放进 scenarioZones.setAside；没有放一边副本时只记日志，不伪造生成）；
//   · 「从游戏中移除」= api.removeThreat + api.scenario.takeEncounterDiscard +
//     api.scenario.removeFromGameCards（removeThreat 会把诡计放进遭遇弃牌堆，故再从弃牌堆摘除）。
const CODE = '10722'
const PARASITE = '10721'
const THRESHOLD = 6

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Power', 'Blight'],
    quantity: 2,
    brillianceThreshold: THRESHOLD,
    setAsideEnemy: PARASITE,
    limitPerInvestigator: 1,
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`🌈 「着彩枯疫」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🌈 「着彩枯疫」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'cardsDrawn',
    silent: true,
    label: '你从牌库抽牌后：放 1 光辉；满 6 时生成放一边的水晶寄生虫并移出游戏',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat
        && !holder.defeated && !holder.resigned
        && Array.isArray(context?.drawnCodes) && context.drawnCodes.length > 0
    },
    resolve: ({ state, source, context, api }) => {
      const holder = holderOf(state, source) || state?.investigators?.[context?.seat]
      if (!holder) return
      const before = Number(source?.useTokens?.brilliance || 0)
      const total = Number(api.placeUse?.(source, 'brilliance', 1) || before + 1)
      api.info?.(`🌈 「着彩枯疫」：${holder.name} 抽牌，光辉 ${before} → ${total}。`)
      if (total < THRESHOLD || before >= THRESHOLD) return
      const taken = api.takeFromSetAside?.(PARASITE) === true
      if (taken) api.scenario?.spawn?.(PARASITE, holder.location)
      api.info?.(taken
        ? `💎 「着彩枯疫」集满 ${THRESHOLD} 光辉：放一边的「水晶寄生虫」在「${api.scenario?.locName?.(holder.location) || holder.location}」入场。`
        : `💎 「着彩枯疫」集满 ${THRESHOLD} 光辉，但本章没有放一边的「水晶寄生虫」副本。`)
      if (api.removeThreat?.(source)) api.scenario?.takeEncounterDiscard?.(CODE)
      api.scenario?.removeFromGameCards?.([CODE], { log: false })
      api.info?.('🌈 着彩枯疫从游戏中移除。')
    },
  }],
  note: '威胁区/计数/生成/移除全部走既有 api；没有放一边水晶寄生虫的章节（如 fateOfTheVale 不把 10721'
    + '放一边）只披露并照常移出着彩枯疫。「每位调查员仅限 1 张」在显现时判重，重复副本直接弃置。',
}

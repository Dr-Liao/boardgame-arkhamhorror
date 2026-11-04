// 07200 追逐开始！（版本二）· 全速恐惧（议程 1a）
//
// 印刷（中文）：
//   正面：你不在载具上时，作为移动的额外费用，你必须花费2行动。
//         强制 - 当一轮结束时：从最后方的地点开始，将每个没有载具、敌人和调查员的地点放在一边，
//         位于场外(或如果其有胜利X且没有线索，将其放入胜利区)。在到达有载具、敌人或调查员的地点时；
//         或在最后方的调查员后方一个地点停下。
//   背面：将每个正在运行的载具翻面，使其停止。
//         将遭遇弃牌堆混洗入遭遇牌库。如果游戏中有3或4位调查员，从遭遇牌库顶弃牌，直到弃掉一张
//         [[载具]]敌人或机械故障诡计。调查员队长抽取该卡牌。
// 印刷（英文）：
//   Front: As an additional cost for you to move while not in a vehicle, you must spend 2 actions.
//     Forced - At the end of the round: ... (same as 07199)
//   Back: Flip over each vehicle that is running, so that it is stopped.
//     Shuffle the encounter discard pile into the encounter deck. If there are 3 or 4 investigators
//     in the game, discard cards from the top of the encounter deck until a [[Vehicle]] enemy or
//     Malfunction treachery is discarded. The lead investigator draws that card.
//
// 引擎读点：
//   · 正面同文部分（步行费用 + 轮末道路清理）全部在 `_shared.js#chaseAgendaEntry`；
//   · 背面翻转载具：物理卡来自 state.storyAssets / 调查员受控支援，运行状态读
//     `api.mechanics.vehicles.record(id).running`，翻面走 `_shared.js#flipVehicleFace`
//     （api.flipAsset + mechanicState.vehicles.running，正反面在 cards-data 的 linkedCardCode）；
//   · 洗弃牌堆入遭遇牌库：`api.shuffleDiscard()`（scenario-runtime：deck+discard 合并且洗牌）；
//   · 3/4 人「弃到[[载具]]敌人或机械故障诡计」：`api.discardEncounterTop(1)`（读点见 scenario-runtime）
//     逐张弃，弃掉的牌在 state.encounterDiscard 末尾；[[载具]]敌人判定 = type enemy + traits 含 Vehicle，
//     机械故障诡计判定 = encounterCode 'malfunction' 且 type treachery（07099 尚未实现，数据仍在
//     cards-data）；队长抽该卡 = `api.drawEncounterDiscard(seat, index)`（把该牌放回牌库顶再抽取）。
//
// 共用模板位置：07199/07201 与本文正面逐字相同，规则只写在 _shared.js#chaseAgendaEntry；
// 本文件只写背面「瞧这运气」。
//
// implemented：正面由工厂读点承担；背面三句均用既有 api（本文件 helper）实现，
//   全部有测试（tests/tic-middle-remaining.test.mjs）。

import { ALL_CARDS, chaseAgendaEntry, flipVehicleFace } from '../../_shared.js'

// 「将每个正在运行的载具翻面，使其停止」：物理卡可以是剧情支援或受控支援；只翻转
// mechanicState 里登记为 running 的实例。翻面后 running 置 false（flipVehicleFace 同步）。
function stopRunningVehicles(state, api) {
  const seen = new Set()
  const carriers = [...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])]
  for (const card of carriers) {
    if (!card?.id || seen.has(card.id)) continue
    seen.add(card.id)
    const record = api.mechanics.vehicles.record(card.id)
    if (!record?.running) continue
    const otherFace = ALL_CARDS[card.code]?.linkedCardCode || ALL_CARDS[card.code]?.linkedToCode || null
    if (otherFace) flipVehicleFace(state, api, card.id, otherFace, false)
    else api.mechanics.vehicles.running(card.id, false)
    api.info?.(`🚗 「${card.name || card.code}」翻到停止面。`)
  }
}

const isVehicleEnemy = def => def?.type === 'enemy'
  && (def.traits || []).some(trait => String(trait).toLowerCase() === 'vehicle')
const isMalfunctionTreachery = def => def?.type === 'treachery' && def?.encounterCode === 'malfunction'

export default chaseAgendaEntry({
  code: '07200',
  onReveal(state, agenda, api) {
    stopRunningVehicles(state, api)
    api.shuffleDiscard()
    api.info?.('🃏 背面「瞧这运气」：遭遇弃牌堆已混洗入遭遇牌库。')
    const count = state.numInvestigators
    if (count !== 3 && count !== 4) return
    let matched = null
    for (let guard = 0; guard < 200 && state.encounterDeck.length; guard++) {
      const discarded = api.discardEncounterTop(1)
      const code = discarded?.[0]
      if (!code) break
      const def = ALL_CARDS[code]
      if (isVehicleEnemy(def) || isMalfunctionTreachery(def)) { matched = code; break }
    }
    if (!matched) {
      api.info?.('⚠️ 遭遇牌库弃完也没有找到[[载具]]敌人或机械故障诡计。')
      return
    }
    const lead = state.campaign?.leadSeat ?? 0
    const index = state.encounterDiscard.lastIndexOf(matched)
    if (index >= 0) {
      api.drawEncounterDiscard(lead, index)
      api.info?.(`🃏 「瞧这运气」：调查员队长抽到了「${ALL_CARDS[matched]?.nameZh || ALL_CARDS[matched]?.name || matched}」。`)
    }
  },
})

// 09733 物质伪饰（Matter Veneer） · 诡计 · outsiders
// 归属：战役共用 · theScarletKeys/_shared/outsiders。
// 卡面：显现 - 每有一个放在一边的空洞归你所有，如果你的游戏区域和/或手牌中有其同名卡牌，
//   弃掉这些卡牌并受到 1 点伤害和 1 点恐惧。如果没有因本效果弃掉的卡牌，选择你手中或游戏区域内控制的
//   一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。
//   Revelation - For each set-aside hollow you own, if there are 1 or more copies of that hollow in your
//   play area and/or hand, discard those copies and take 1 damage and 1 horror. If no cards are discarded
//   by this effect, choose a non-weakness card you control in your hand or play area and set it aside,
//   out of play, as a hollow.
// 读点：
//   · 空洞归属 = api.mechanics.tsk.hollow.cards()（scope:'investigator' 且 seat 为本座位，或全队共享）；
//   · 弃掉同名卡牌 = api.putInDiscard({ fromHand: true })（手牌）/ api.discardAsset（场上支援实例）；
//   · 受到伤害与恐惧 = api.harm(seat, { damage: 1, horror: 1 })（一次分配，走同一伤害管线）；
//   · 新的空洞 = 手牌走 putInDiscard + takeDiscardCard，场上支援走 discardAsset，再 hollow.hollow。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09733'

const ownedHollows = (state, inv) => (state.scenarioFlags?.mechanics?.tsk?.hollows?.cards || [])
  .filter(card => card.scope === 'team' || card.seat === inv.seat)

// 手牌 + 场上支援里可被设为空洞的候选（非弱点）。
function candidatesOf(inv) {
  const hand = (inv.hand || []).map((code, index) => ({ kind: 'hand', code, index }))
    .filter(item => !isWeaknessCode(item.code))
  const assets = (inv.assets || []).map(asset => ({ kind: 'asset', code: asset.code, id: asset.id }))
    .filter(item => !isWeaknessCode(item.code))
  return [...hand, ...assets]
}

const keyOf = item => (item.kind === 'hand' ? `hand:${item.index}` : `asset:${item.id}`)

function setAside(api, seat, item) {
  if (api.mechanics.tsk.hollow.isHollowed(item.code)) return false
  if (item.kind === 'asset') api.discardAsset(seat, item.id)
  else {
    api.putInDiscard(seat, item.code, { fromHand: true })
    api.takeDiscardCard(seat, item.code)
  }
  api.mechanics.tsk.hollow.hollow({ code: item.code, source: CODE, scope: 'investigator', seat })
  return true
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    let discarded = 0
    for (const hollow of ownedHollows(state, inv)) {
      const handCopies = (inv.hand || []).filter(code => code === hollow.code)
      const assetCopies = (inv.assets || []).filter(asset => asset.code === hollow.code)
      if (!handCopies.length && !assetCopies.length) continue
      for (const code of handCopies) api.putInDiscard(inv.seat, code, { fromHand: true })
      for (const asset of assetCopies) api.discardAsset(inv.seat, asset.id)
      discarded += handCopies.length + assetCopies.length
      api.harm(inv.seat, { damage: 1, horror: 1 })
      api.info?.(`🌫️ 空洞「${api.cardName(hollow.code)}」的同名卡牌被弃掉：${inv.name} 受到 1 点伤害和 1 点恐惧。`)
      if (inv.defeated || inv.resigned) return false
    }
    if (discarded > 0) return false
    const candidates = candidatesOf(inv)
    if (!candidates.length) {
      api.info?.('🌫️ 「物质伪饰」：没有可放在一边的非弱点卡牌。')
      return false
    }
    const chosen = candidates.length === 1 ? candidates[0] : candidates.find(item => keyOf(item) === api.choose({
      kind: 'card', source: CODE, seat: inv.seat,
      prompt: '物质伪饰：选择一张非弱点卡牌放在一边，作为空洞。',
      options: candidates.map(item => ({ id: keyOf(item), cardCode: item.code, label: api.cardName(item.code) })),
    })) || candidates[0]
    if (chosen && setAside(api, inv.seat, chosen)) {
      api.info?.(`🌫️ 「${api.cardName(chosen.code)}」被放在一边成为空洞。`)
    }
    return false
  },
  note: 'approximation: 「每有一个空洞」按 tsk-hollow 的个人计数口径（本座位 + 全队共享）逐张结算，'
    + '同名卡牌全部弃掉但伤害/恐惧每张空洞只结算一次；同名空洞按卡号去重口径披露。无缺读点。',
}

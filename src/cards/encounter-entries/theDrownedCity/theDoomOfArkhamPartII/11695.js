// 11695 米斯卡塔尼克大学（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：米斯卡塔尼克大学（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 印刷限制：不能完全淹没（水位上限 1，locationRule.floodBounds 引擎读点）。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined / flood.js（flags.ruined 与 floodBounds）。
import { ALL_CARDS, hasTrait } from '../../_shared.js'

const CODE = '11695'
const eligibleCards = rows => rows.filter(({ code }) => {
  const icons = ALL_CARDS[code]?.icons
  return icons?.intellect > 0 || icons?.wild > 0
})
const healableTargets = (state, locationId) => state.investigators
  .filter(owner => owner.location === locationId && !owner.defeated && !owner.resigned)
  .flatMap(owner => [
    ...(owner.horror > 0 && !owner.formHealingProhibited ? [{ id: `investigator:${owner.seat}`, owner }] : []),
    ...(owner.assets || []).filter(asset => !asset.facedown && asset.horror > 0
      && hasTrait(ALL_CARDS[asset.originalCode || asset.code], 'Ally'))
      .map(asset => ({ id: `asset:${asset.id}`, owner, asset })),
  ])

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 1 } },
  flags: { ruined: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', cost: { action: 1 },
    label: '弃掉一至三张有智识或百搭图标的手牌：每弃一张，治愈本地点一点恐惧',
    limit: { scope: 'perGame', owner: 'player' },
    criteria: ({ state, source, helpers }) => eligibleCards(helpers.discardableHandCards()).length > 0
      && healableTargets(state, source.id).length > 0,
    prepay: ({ inv, api }) => {
      const candidates = eligibleCards(api.discardableHandCards(inv.seat))
      const selected = []
      while (selected.length < 3 && candidates.length) {
        const options = candidates.map(({ code, index }) => ({ id: `hand:${index}`, label: api.cardName(code), cardCode: code }))
        if (selected.length) options.push({ id: 'done', label: '支付已选择的手牌' })
        const id = options.length === 1 ? options[0].id : api.choice({
          kind: 'card', source: CODE, seat: inv.seat, prompt: '选择要弃掉的手牌（最少一张，最多三张）。', options,
        })
        if (id === 'done') break
        const index = candidates.findIndex(card => `hand:${card.index}` === id)
        if (index < 0) return false
        selected.push(candidates.splice(index, 1)[0])
      }
      return selected.length && api.discardHandCardsAsCost(inv.seat, selected) ? { count: selected.length } : false
    },
    resolve: ({ state, inv, source, context, api }) => {
      for (let remaining = context.prepaid.count; remaining > 0; remaining -= 1) {
        const targets = healableTargets(state, source.id)
        if (!targets.length) break
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择治愈一点恐惧的本地点调查员或盟友。',
          options: targets.map(({ id, owner, asset }) => ({ id, label: asset ? api.cardName(asset.code) : owner.name })),
        })
        const target = targets.find(candidate => candidate.id === id)
        if (target?.asset) api.healAsset(target.asset, { horror: 1, owner: target.owner, healerSeat: inv.seat })
        else if (target) api.healHorror(target.owner.seat, 1, { healerSeat: inv.seat })
      }
    },
  }],
}

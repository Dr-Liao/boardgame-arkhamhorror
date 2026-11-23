// 11736 致命急流（Deadly Torrent）· 诡计 · 共享遭遇组 tdc_flood（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_flood。
// 卡面（cards-data 11736）：
//   显现 - 如果你所在地点未淹没，致命急流获得涌动。否则，你必须选择一项：
//          - 检定[agility](4)以游向安全处。如果你成功，移动到一处连接地点。如果你失败，受到1点伤害和1点恐惧。
//          - 检定[combat](4)以坚守阵地。如果你失败，受到1点伤害，并弃掉你控制的1张占用1个或更多槽位的支援。
//
// 读点（声明即接线）：
//   · 「未淹没 → 涌动」= encounterResolve 返回 { gainSurge: true }；
//   · 淹没等级 = api.mechanics.water.level；二选一 = api.choice；检定 = api.test；
//   · 移动 = api.moveInvestigator（relocateInvestigator 的剧本写点），候选 = 当前地点的
//     connections 且 api.canMoveTo 通过；
//   · 伤害/恐惧 = api.damage / api.horror；弃置支援 = api.discardAsset（受控支援的唯一弃置写点），
//     候选按 cards-data 的 slots/slot 过滤出「占用 ≥1 槽位」的支援。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '11736'
const DIFFICULTY = 4

const slotCount = code => {
  const def = ALL_CARDS[code] || {}
  const slots = Array.isArray(def.slots) ? def.slots : def.slot ? [def.slot] : []
  return slots.length
}

export default {
  code: CODE,
  name: '致命急流',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    quantity: 2,
    choices: [{ skill: 'agility', difficulty: DIFFICULTY }, { skill: 'combat', difficulty: DIFFICULTY }],
  },
  encounterResolve(state, inv, card, api) {
    const water = api.mechanics?.water
    if (water?.level?.(inv.location) === 0) {
      api.info?.('🌀 「致命急流」：所在地点未淹没，获得涌动。')
      return { gainSurge: true }
    }
    const answer = String(api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「致命急流」：选择一项。',
      options: [
        { id: 'agility', label: '检定敏捷(4)以游向安全处' },
        { id: 'combat', label: '检定战斗(4)以坚守阵地' },
      ],
    }))
    const skill = answer === 'combat' ? 'combat' : 'agility'
    api.test(inv.seat, skill, DIFFICULTY, result => {
      if (result?.success) {
        if (skill !== 'agility') {
          api.info?.(`✔️ ${inv.name} 通过「致命急流」战斗检定（${result.value} vs ${DIFFICULTY}），坚守阵地。`)
          return
        }
        const location = state.locations?.find(item => item.id === inv.location)
        const candidates = [...new Set(location?.connections || [])]
          .filter(id => state.locations?.some(item => item.id === id))
          .filter(id => api.canMoveTo?.(inv.seat, id) !== false)
        if (!candidates.length) {
          api.info?.('🌊 「致命急流」：没有可移动到的连接地点。')
          return
        }
        const destination = candidates.length === 1 ? candidates[0] : (api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '「致命急流」：选择一处连接地点。',
          options: candidates.map(id => ({ id, label: api.locName?.(id) || id })),
        }) || candidates[0])
        api.moveInvestigator(inv.seat, destination)
        api.info?.(`🌊 「致命急流」：${inv.name} 游向「${api.locName?.(destination) || destination}」。`)
        return
      }
      if (skill === 'agility') {
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
        api.info?.(`🌊 「致命急流」：${inv.name} 敏捷检定失败，受到 1 点伤害和 1 点恐惧。`)
        return
      }
      api.damage(inv.seat, 1)
      api.info?.(`🌊 「致命急流」：${inv.name} 战斗检定失败，受到 1 点伤害。`)
      const owner = state.investigators?.[inv.seat]
      if (!owner || owner.defeated || owner.resigned) return
      const candidates = (owner.assets || []).filter(asset => slotCount(asset.originalCode || asset.code) >= 1)
      if (!candidates.length) return
      const answer = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'asset', source: CODE, seat: inv.seat,
        prompt: '「致命急流」：选择并弃掉你控制的一张占用至少 1 个槽位的支援。',
        options: candidates.map(asset => ({ id: asset.id, label: api.cardName?.(asset.originalCode || asset.code) || asset.code, cardCode: asset.originalCode || asset.code })),
      })
      const chosen = candidates.find(asset => String(asset.id) === String(answer)) || candidates[0]
      api.discardAsset(inv.seat, chosen.id)
      api.info?.(`🌊 「致命急流」：弃掉支援「${api.cardName?.(chosen.originalCode || chosen.code) || chosen.code}」。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '致命急流' })
    return false
  },
  note: '未淹没时涌动；否则二选一检定：敏捷成功移到连接地点（api.canMoveTo 过滤）、失败 1 伤害+1 恐惧；'
    + '战斗失败 1 伤害 + 弃掉一张占用 ≥1 槽位的受控支援（按 cards-data slots/slot 过滤，api.discardAsset）。'
    + '移动候选用 connections + api.canMoveTo（等价于参考的 AccessibleFrom ForMovement）。',
}

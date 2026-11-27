// 09090 恐灵附身（Ghastly Possession）· 秘术师技能 · 1 经验。
// 卡面：你将恐灵附身投入到支援上的技能检定后，选择一项：
//       - 在该支援上放置 1 个毁灭标记，恐灵附身获得 [wild][wild]。
//       - 如果本次检定成功，从该支援上移除 1 个毁灭标记，或将其使用补满一半（向下取整）。
//
import { ALL_CARDS } from '../../cards/cards-data.js'

const testedAsset = state => {
  const id = state.skillTest?.assetSourceId ?? state.skillTest?.source?.assetId ?? state._resolvingAssetId
  if (!id) return null
  return state.investigators.flatMap(owner => owner.assets || []).find(asset => asset.id === id) || null
}

const replenishCount = asset => {
  const capacity = Number(ALL_CARDS[asset.code]?.uses ?? 0)
  return Math.max(0, Math.min(capacity - (asset.uses || 0), Math.floor(capacity / 2)))
}

function settleCommitment({ state, inv, api }) {
  const asset = testedAsset(state)
  if (!asset) return
  const options = [{ id: 'doom', label: '在该支援上放置 1 个毁灭，本次检定 +2 图标' }]
  if (asset.doom > 0 || replenishCount(asset) > 0) {
    options.push({ id: 'settle', label: '若本次检定成功，移除 1 个毁灭或补满一半使用' })
  }
  const mode = options.length === 1 ? 'doom' : api.choice({
    kind: 'effect', source: '09090', seat: inv.seat, prompt: '选择恐灵附身的效果。', options,
  })
  if (mode === 'doom') {
    api.placeDoomOnCard(asset, 1)
    api.addCommittedCardIcons(inv.seat, 2)
    return
  }
  api.afterCurrentTest(result => {
    if (!result?.success || testedAsset(state) !== asset) return
    const replenish = replenishCount(asset)
    const choices = []
    if (asset.doom > 0) choices.push({ id: 'doom', label: '从该支援上移除 1 个毁灭标记' })
    if (replenish > 0) choices.push({ id: 'uses', label: `为该支援补充 ${replenish} 次使用` })
    if (!choices.length) return
    const selected = choices.length === 1 ? choices[0].id : api.choice({
      kind: 'effect', source: '09090', seat: inv.seat, prompt: '选择成功后的恐灵附身效果。', options: choices,
    })
    if (selected === 'doom') api.removeDoomFromCard(asset, 1)
    else if (selected === 'uses') api.addUses(asset, replenish)
  })
}

export default {
  code: '09090',
  abilities: [
    {
      kind: 'commit',
      label: '投入支援上的技能检定；可选择放毁灭换双百搭图标，或成功后移除毁灭/补半使用',
      skill: { onCommit: settleCommitment },
    },
  ],
  modifiers: [],
}

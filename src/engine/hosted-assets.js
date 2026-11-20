function hostInPlay(state, kind, id) {
  const zone = kind === 'location' ? state.locations : kind === 'enemy' ? state.enemies : null
  return zone?.find(item => item.id === id)
}

export function attachControlledAsset(state, seat, assetId, kind, hostId) {
  const inv = state.investigators[seat]
  const host = hostInPlay(state, kind, hostId)
  const asset = inv?.assets.find(item => item.id === assetId)
  const location = kind === 'location' ? host?.id : host?.location
  if (!inv || inv.defeated || inv.resigned || !asset || !host || location !== inv.location || asset.attachedToAsset) return false
  asset.ownerSeat ??= seat
  delete asset.controllerSeat
  asset.hostedPlayerAsset = true
  inv.assets.splice(inv.assets.indexOf(asset), 1)
  ;(host.attachments ||= []).push(asset)
  return asset
}

export function claimHostedAsset(state, seat, kind, hostId, assetId, { canEquip, cardDef }) {
  const inv = state.investigators[seat]
  const host = hostInPlay(state, kind, hostId)
  const location = kind === 'location' ? host?.id : host?.location
  const asset = host?.attachments?.find(item => item.id === assetId && item.hostedPlayerAsset)
  if (!inv || inv.defeated || inv.resigned || !asset || inv.location !== location || !canEquip(inv, cardDef(asset.code))) return false
  host.attachments.splice(host.attachments.indexOf(asset), 1)
  delete asset.hostedPlayerAsset
  asset.controllerSeat = seat
  inv.assets.push(asset)
  return asset
}

export function discardHostedAssets(state, host, discard, { keepAssets = false } = {}) {
  for (const card of (host?.attachments || []).filter(item => item.committedSkill || (!keepAssets && item.hostedPlayerAsset))) {
    const owner = state.investigators[card.ownerSeat]
    discard(owner, card.originalCode || card.code)
    host.attachments.splice(host.attachments.indexOf(card), 1)
  }
}

export function validateHostedAssets(state) {
  const ids = new Set((state.investigators || []).flatMap(inv => (inv.assets || []).map(asset => asset.id)))
  for (const host of [...(state.locations || []), ...(state.enemies || [])]) {
    for (const card of host.attachments || []) {
      if (!card?.hostedPlayerAsset) continue
      if (card.hostedPlayerAsset !== true || typeof card.id !== 'string' || !card.id || typeof card.code !== 'string'
        || ids.has(card.id) || !state.investigators[card.ownerSeat] || card.controllerSeat != null) throw new TypeError('无效附属支援存档')
      ids.add(card.id)
    }
  }
}

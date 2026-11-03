// Central notifications for charge/ammo changes. Rules stay in card entries.
export function resolveEmptyUses(state, api, registeredEntry) {
  for (const inv of state.investigators) for (const source of inv.assets.slice()) {
    if (registeredEntry(source.code)?.assetRule?.discardWithoutSealedTokens
      && !(state.chaos?.sealed || []).some(item => item.source === source.id)) { api.discardAsset(inv.seat, source); continue }
    if ((source.uses ?? 1) > 0) continue
    registeredEntry(source.code)?.onUsesEmptied?.({ state, inv, source, api })
  }
}

export function afterUsesSpent(state, inv, asset, amount, events, deps) {
  if (!asset || !inv || !(amount > 0)) return
  const type = String(asset.usesType || deps.registeredEntry(asset.code)?.usesType || '').replace(/s$/, '')
  if (type !== 'charge' || !deps.cardDef(asset.code)?.traits?.some(trait => trait.toLowerCase() === 'spell')) return
  if (!state.investigators.some(owner => [owner, ...owner.assets, ...owner.threat].some(source =>
    deps.registeredEntry(source.code)?.abilities?.some(descriptor => descriptor.trigger?.includes('spellChargesSpent'))))) return
  state.usesWindowSerial = (state.usesWindowSerial || 0) + 1
  deps.reactionWindow(state, 'spellChargesSpent', { when: 'spellChargesSpent', seat: inv.seat,
    asset, amount, location: inv.location, windowInstance: `uses:${state.usesWindowSerial}` }, events, { allowNested: true })
}

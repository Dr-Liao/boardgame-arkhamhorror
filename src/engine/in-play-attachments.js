export function inPlayAttachments(state) {
  const attachments = new Set()
  function visit(host) {
    for (const card of host?.attachments || []) {
      if (!card?.code || card.facedown || card.assetReference || attachments.has(card)) continue
      attachments.add(card)
      visit(card)
    }
  }
  for (const host of [
    ...state.locations, ...state.enemies, ...(state.acts || []), ...(state.agendas || []),
    ...(state.storyAssets || []), ...(state.agendaAside || []),
    ...state.investigators.flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])]),
  ]) visit(host)
  for (const card of state.playerLocationAttachments || []) {
    if (card.facedown || card.assetReference) continue
    attachments.add(card)
    visit(card)
  }
  return [...attachments]
}

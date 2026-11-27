export function partnerShroud(partner, basePartner) {
  return (state, location) => state.investigators.some(investigator =>
    !investigator.defeated && !investigator.resigned && investigator.location === location.id
    && investigator.assets.some(asset => [partner, basePartner].includes(asset.originalCode || asset.code))) ? -2 : 0
}

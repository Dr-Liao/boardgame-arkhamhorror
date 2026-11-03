// Publish the entered physical instance after it has reached the threat area.
export function afterThreatEntered(state, inv, card, events, reactionWindow) {
  if (typeof reactionWindow !== 'function') return card
  reactionWindow(state, 'threatEntered', {
    when: 'threatEntered', seat: inv.seat, card, cardCode: card.code, location: inv.location,
    prompt: '一张卡牌进入你的威胁区域。',
  }, events, { allowNested: true })
  return card
}

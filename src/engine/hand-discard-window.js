// Notify card reactions after one physical card has left an investigator's hand.
// The caller has already moved the card to the discard pile.
export function afterHandDiscard(state, inv, code, events, reactionWindow, cardName) {
  if (!inv || !code) return
  reactionWindow(state, 'handCardDiscarded', {
    when: 'handCardDiscarded', seat: inv.seat, cardCode: code, location: inv.location,
    prompt: `${inv.name} 从手牌弃掉了「${cardName(code)}」`,
  }, events, { allowNested: true })
}

// Notify card reactions after one physical card has left an investigator's hand.
// The caller has already moved the card to the discard pile.
export function afterHandDiscard(state, inv, code, events, reactionWindow, cardName) {
  if (!inv || !code) return
  afterHandEmptied(state, inv, events, reactionWindow)
  reactionWindow(state, 'handCardDiscarded', {
    when: 'handCardDiscarded', seat: inv.seat, cardCode: code, location: inv.location,
    prompt: `${inv.name} 从手牌弃掉了「${cardName(code)}」`,
  }, events, { allowNested: true })
}
export function afterHandEmptied(state, inv, events, reactionWindow) {
  if (inv.hand.length || inv.defeated || inv.resigned) return
  reactionWindow(state, 'handEmptied', { when: 'handEmptied', seat: inv.seat, location: inv.location,
    prompt: `${inv.name} 的手牌用尽` }, events, { allowNested: true })
}

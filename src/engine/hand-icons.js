function handPhase(state) {
  return state.immediateAction?.returnPhase || state.phase
}

export function handCardIcons(state, inv, index) {
  if (!Number.isSafeInteger(index)) return []
  const grant = inv?.handIconGrants?.find(entry => entry.index === index && entry.code === inv.hand[index]
    && entry.round === state.round && entry.phase === handPhase(state))
  return grant?.icons || []
}

export function addHandCardIcons(state, inv, index, icons) {
  if (!inv?.hand?.[index] || !Number.isSafeInteger(index) || !icons.length) return false
  const round = state.round
  const phase = handPhase(state)
  const previouslyGranted = handCardIcons(state, inv, index)
  inv.handIconGrants = (inv.handIconGrants || []).filter(entry =>
    entry.index !== index && entry.round === round && entry.phase === phase)
  inv.handIconGrants.push({ index, code: inv.hand[index], round, phase, icons: [...previouslyGranted, ...icons] })
  return true
}

function updateGrants(inv, grants) {
  if (grants.length) inv.handIconGrants = grants
  else delete inv.handIconGrants
}

export function spliceHand(inv, ...args) {
  const length = inv.hand.length
  const removed = inv.hand.splice(...args)
  if (!inv.handIconGrants?.length || !args.length) return removed
  const start = Math.trunc(Number(args[0])) || 0
  const from = start < 0 ? Math.max(0, length + start) : Math.min(start, length)
  const to = from + removed.length
  const shift = Math.max(0, args.length - 2) - removed.length
  updateGrants(inv, inv.handIconGrants.flatMap(entry => entry.index < from ? [entry]
    : entry.index < to ? [] : [{ ...entry, index: entry.index + shift }]))
  return removed
}

export function filterHand(inv, keep) {
  if (!inv.handIconGrants?.length) {
    inv.hand = (inv.hand || []).filter(keep)
    return
  }
  const grants = new Map(inv.handIconGrants.map(entry => [entry.index, entry]))
  const cards = []
  const remaining = []
  for (const [index, code] of inv.hand.entries()) {
    if (!keep(code, index, inv.hand)) continue
    const grant = grants.get(index)
    if (grant) remaining.push({ ...grant, index: cards.length })
    cards.push(code)
  }
  inv.hand = cards
  updateGrants(inv, remaining)
}

export function replaceHand(inv, cards) {
  inv.hand = cards
  delete inv.handIconGrants
}

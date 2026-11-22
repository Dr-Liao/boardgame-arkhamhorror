const activeDisposal = new WeakMap()

export function withPlayedEventDisposal(context, disposal, resolve) {
  const previous = activeDisposal.get(context)
  activeDisposal.set(context, disposal)
  try {
    return resolve()
  } finally {
    if (previous) activeDisposal.set(context, previous)
    else activeDisposal.delete(context)
  }
}

export function exilePlayedEvent(context) {
  const disposal = activeDisposal.get(context)
  if (!disposal) return false
  disposal.exileAfterPlay = true
  return true
}

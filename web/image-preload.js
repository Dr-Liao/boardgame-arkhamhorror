const CARD_CODE = /^[0-9]{3,6}[a-z]{0,2}$/

/** Uses only the observer's existing projection; never requests hidden decks. */
export function imagePreloadContext(session) {
  const st = session?.state || {}
  const priority = new Set(), deck = new Set()
  const add = (set, reference) => {
    const card = typeof reference === 'string'
      ? st.cards?.[reference] || st.investigatorDefs?.[reference] || reference : reference
    const code = typeof card === 'string' ? card : card?.originalCode || card?.code
    if (CARD_CODE.test(code || '')) set.add(code)
  }
  for (const inv of st.investigators || []) {
    add(priority, inv)
    for (const card of [...(inv.seat === session?.mySeat ? inv.hand || [] : []), ...(inv.assets || []), ...(inv.threat || [])]) add(priority, card)
  }
  add(priority, st.acts?.[st.actIndex])
  add(priority, st.agendas?.[st.agendaIndex])
  for (const location of st.locations || []) add(priority, location)
  for (const enemy of st.enemies || []) add(priority, enemy)
  const seat = session?.mySeat
  if (Number.isInteger(seat)) {
    const campaign = st.campaign || {}, lane = campaign.seatParts?.[seat]
    const part = lane && campaign.parts?.[lane]?.investigators
    const laneRecord = Object.values(part || {}).find(record => record?.seat === seat)
    const record = lane && lane !== campaign.currentPart ? laneRecord || campaign.investigators?.[seat]
      : campaign.investigators?.[seat] || laneRecord
    for (const card of record?.deck || []) add(deck, card)
  }
  return { priority: [...priority], deck: [...deck].filter(code => !priority.has(code)) }
}

export function waitForImageIdle(signal) {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return }
    const idle = typeof requestIdleCallback === 'function' && typeof cancelIdleCallback === 'function'
    let ticket
    const done = () => {
      if (idle) cancelIdleCallback(ticket)
      else clearTimeout(ticket)
      signal.removeEventListener('abort', done)
      resolve()
    }
    ticket = idle ? requestIdleCallback(done, { timeout: 1000 }) : setTimeout(done, 250)
    signal.addEventListener('abort', done, { once: true })
  })
}

export async function runImagePreloadBatches(priority, background, signal, idle = waitForImageIdle) {
  let cursor = 0
  const worker = async () => {
    while (cursor < priority.length && !signal.aborted) await priority[cursor++]()
  }
  await Promise.all(Array.from({ length: Math.min(4, priority.length) }, worker))
  // Background gets one network slot and yields after every four faces.
  for (let index = 0; index < background.length && !signal.aborted;) {
    await idle(signal)
    for (let count = 0; count < 4 && index < background.length && !signal.aborted; count++) await background[index++]()
  }
}

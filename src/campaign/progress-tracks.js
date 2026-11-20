const idPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/

function id(value) {
  if (typeof value !== 'string' || !idPattern.test(value) || value === 'constructor') {
    throw new TypeError('无效进度记录标识')
  }
}

function validateOwner(owner) {
  if (typeof owner !== 'string' || !owner || owner === '__proto__' || owner === 'constructor') {
    throw new TypeError('无效的进度调查员标识')
  }
}

function investigatorId(campaign, seat) {
  if (!Number.isSafeInteger(seat) || seat < 0) throw new TypeError('无效进度记录座位')
  const owner = campaign?.investigators?.[seat]?.id
  validateOwner(owner)
  return owner
}

function own(object, key) {
  return object && Object.hasOwn(object, key) ? object[key] : null
}

function trackFor(campaign, track) {
  id(track)
  return own(campaign?.progressTracks, track)
}

export function claimProgress(campaign, track, seat, option) {
  const owner = investigatorId(campaign, seat)
  id(option)
  const current = trackFor(campaign, track)
  if (current && (Object.hasOwn(current, owner) || Object.values(current).some(entry => entry.option === option))) return false
  campaign.progressTracks ||= {}
  const next = current || (campaign.progressTracks[track] = {})
  next[owner] = { option, value: 0, applied: [] }
  return true
}

export function progressFor(campaign, track, seat) {
  const entry = own(trackFor(campaign, track), investigatorId(campaign, seat))
  return entry ? { option: entry.option, value: entry.value } : null
}

export function progressOptions(campaign, track, seat, options) {
  if (progressFor(campaign, track, seat)) return []
  const used = new Set(Object.values(trackFor(campaign, track) || {}).map(entry => entry.option))
  return options.filter(option => !used.has(option.id))
}

// A receipt identifies the same effect across retries. The receipt is scoped
// to this investigator and track so several investigators can settle the same event.
export function changeProgress(campaign, track, seat, amount, receipt) {
  const owner = investigatorId(campaign, seat)
  if (receipt != null) id(receipt)
  if (!Number.isSafeInteger(amount) || !amount) throw new TypeError('进度变更必须是非零整数')
  const entry = own(trackFor(campaign, track), owner)
  if (!entry || (receipt != null && entry.applied.includes(receipt))) return false
  const next = Math.max(0, entry.value + amount)
  if (!Number.isSafeInteger(next)) throw new RangeError('进度记录超出整数范围')
  if (receipt != null) entry.applied.push(receipt)
  entry.value = next
  return next
}

// Settlement callbacks run inside the caller's resolution transaction. A receipt
// is reserved before dispatch so a nested trigger cannot settle the same effect.
// A failed or paused callback leaves its receipt available for the replay.
export function settleProgress(campaign, track, seat, receipt, resolve) {
  id(receipt)
  if (typeof resolve !== 'function') throw new TypeError('进度结算需要处理函数')
  const entry = own(trackFor(campaign, track), investigatorId(campaign, seat))
  if (!entry || entry.applied.includes(receipt)) return false
  entry.applied.push(receipt)
  try {
    resolve({ option: entry.option, value: entry.value })
  } catch (error) {
    entry.applied.splice(entry.applied.indexOf(receipt), 1)
    throw error
  }
  return true
}

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('无效进度记录')
}

export function validateProgressTracks(campaign) {
  const store = campaign?.progressTracks
  if (store === undefined) return
  record(store)
  for (const [track, investigators] of Object.entries(store)) {
    id(track)
    record(investigators)
    const options = new Set()
    for (const [owner, entry] of Object.entries(investigators)) {
      validateOwner(owner)
      record(entry)
      id(entry.option)
      if (Object.keys(entry).some(key => !['option', 'value', 'applied'].includes(key))
        || options.has(entry.option) || !Number.isSafeInteger(entry.value) || entry.value < 0
        || !Array.isArray(entry.applied) || new Set(entry.applied).size !== entry.applied.length) {
        throw new TypeError('无效进度记录')
      }
      entry.applied.forEach(id)
      options.add(entry.option)
    }
  }
}

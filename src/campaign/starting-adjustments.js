const idPattern = /^[A-Za-z][A-Za-z0-9_-]*$/
const fields = ['receipt', 'scenarioId', 'resources', 'clues']
const entryFields = [...fields, 'owner', 'originScenarioId', 'afterVisit', 'applied']

function requireFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new TypeError('无效的跨章开局调整字段')
  }
}

function requireId(value) {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new TypeError('无效的跨章开局调整标识')
}

function validateAdjustment({ receipt, scenarioId, resources, clues }) {
  requireId(receipt)
  if (scenarioId !== null) requireId(scenarioId)
  if (!Number.isSafeInteger(resources) || !Number.isSafeInteger(clues) || (!resources && !clues)) {
    throw new TypeError('跨章开局调整需要至少一项非零整数')
  }
}

export function deferStartingAdjustment(state, seat, spec) {
  requireFields(spec, fields)
  const { receipt, resources = 0, clues = 0, scenarioId = null } = spec
  const adjustment = { receipt, scenarioId, resources, clues }
  validateAdjustment(adjustment)
  if (!Number.isSafeInteger(seat) || seat < 0) throw new TypeError('无效的开局调整座位')
  const campaign = state.campaign
  const record = campaign?.investigators?.[seat]
  if (record?.status !== 'active') return false
  requireId(record.id)
  const queue = campaign.startingAdjustmentQueue
  if (queue?.some(entry => entry.owner === record.id && entry.receipt === receipt)) return false
  // A restart changes the visit counter but doesn't add a new history entry.
  // Without a graph, use the scene ID to distinguish successive chapters.
  const originScenarioId = state.scenario?.id ?? null
  const afterVisit = campaign.flow?.history?.length ?? 0
  campaign.startingAdjustmentQueue ||= []
  campaign.startingAdjustmentQueue.push({
    ...adjustment, owner: record.id, originScenarioId, afterVisit, applied: false,
  })
  return true
}

export function takeStartingAdjustments(state, inv) {
  const campaign = state.campaign
  const queue = campaign?.startingAdjustmentQueue
  const scenarioId = state.scenario?.id
  if (!queue?.length || !scenarioId || !inv.campaignId) return null
  const visit = campaign.flow?.history?.length ?? 0
  const ready = queue.filter(entry => !entry.applied && entry.owner === inv.campaignId
    && (entry.scenarioId === null || entry.scenarioId === scenarioId)
    && (entry.afterVisit ? visit > entry.afterVisit : scenarioId !== entry.originScenarioId))
  if (!ready.length) return null
  const resources = ready.reduce((sum, entry) => sum + entry.resources, 0)
  const clues = ready.reduce((sum, entry) => sum + entry.clues, 0)
  if (!Number.isSafeInteger(resources) || !Number.isSafeInteger(clues)) {
    throw new RangeError('跨章开局调整超出整数范围')
  }
  for (const entry of ready) entry.applied = true
  return { resources, clues }
}

export function validateStartingAdjustments(campaign) {
  const queue = campaign?.startingAdjustmentQueue
  if (queue === undefined) return
  if (!Array.isArray(queue)) throw new TypeError('无效的跨章开局调整队列')
  const keys = new Set()
  for (const entry of queue) {
    requireFields(entry, entryFields)
    validateAdjustment(entry)
    requireId(entry.owner)
    if (entry.originScenarioId !== null) requireId(entry.originScenarioId)
    const key = `${entry.owner}/${entry.receipt}`
    if (keys.has(key) || !Number.isSafeInteger(entry.afterVisit) || entry.afterVisit < 0 || typeof entry.applied !== 'boolean') {
      throw new TypeError('无效或重复的跨章开局调整回执')
    }
    keys.add(key)
  }
}

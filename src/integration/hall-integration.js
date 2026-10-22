// Arkham-specific adapters for the hall's generic lifecycle and agent hooks.
import { migrateState } from '../engine/save-migration.js'

const CHECKPOINT_SCHEMA_VERSION = 1

function visitDetails(state) {
  const nodeId = state.campaign?.flow?.nodeId || state.scenario?.id
  const visitNumber = state.campaign?.flow?.visits?.[nodeId] || 1
  return {
    nodeId,
    visitNumber,
    visitId: `${nodeId}:${visitNumber}`,
  }
}

/**
 * 检查点只需要保住当时的文字历史。每条事件的整桌演出快照（tableState）有 5–10KB，
 * 每关复制一整份会让存档体积近似平方增长；而回档之后不会再回放历史演出，
 * 所以检查点里的历史事件一律不带演出快照。
 */
function checkpointEvents(events) {
  return (events || []).map(event => {
    const copy = structuredClone(event)
    if (copy.tableState != null) delete copy.tableState
    if (copy.presentation?.tableState != null) delete copy.presentation.tableState
    return copy
  })
}

/** Capture the first authoritative, interactive state after a scenario starts. */
export function createSessionCheckpoint(session, receipt) {
  const state = receipt?.after
  if (receipt?.move?.action !== 'hubBeginScenario' || state?.uiState !== 'inScenario' || !state.scenario?.id) return null
  const visit = visitDetails(state)
  if (!visit.nodeId || session.scenarioCheckpoints?.some(item => item.visitId === visit.visitId)) return null
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    checkpointId: `scenario:${state.campaign.id}:${visit.visitId}`,
    campaignId: state.campaign.id,
    scenarioId: state.scenario.id,
    scenarioName: state.scenario.name || state.scenario.id,
    flowNodeId: visit.nodeId,
    visitNumber: visit.visitNumber,
    visitId: visit.visitId,
    createdAt: new Date().toISOString(),
    sourceRevision: state.revision,
    snapshot: {
      state: structuredClone(state),
      events: checkpointEvents(session.events),
      notes: structuredClone(session.notes || []),
      agentPlans: structuredClone(session.agentPlans || {}),
    },
  }
}

export function checkpointView(session, observerSeat) {
  const isLeader = Number.isInteger(observerSeat) && observerSeat === session.state.campaign?.leadSeat
  // 「允许回档」是开局固定的对局规则：关掉后仍保留检查点摘要，但不能创建分支存档。
  const rollbackAllowed = session.state?.allowRollback !== false
  return (session.scenarioCheckpoints || []).map(item => ({
    checkpointId: item.checkpointId,
    campaignId: item.campaignId,
    scenarioId: item.scenarioId,
    scenarioName: item.scenarioName,
    visitId: item.visitId,
    createdAt: item.createdAt,
    sourceRevision: item.sourceRevision,
    available: !item.unavailableReason,
    unavailableReason: item.unavailableReason || null,
    rollbackAllowed,
    canFork: rollbackAllowed && isLeader && !item.unavailableReason,
  }))
}

/** Checkpoints migrate independently; an obsolete historical entry must not block the live save. */
export function migrateSessionCheckpoints(session, options = {}) {
  if (!Array.isArray(session.scenarioCheckpoints) || !session.scenarioCheckpoints.length) {
    return { checkpoints: [], changes: [] }
  }
  const checkpoints = structuredClone(session.scenarioCheckpoints)
  const changes = []
  checkpoints.forEach((checkpoint, index) => {
    try {
      const migrated = migrateState(checkpoint.snapshot?.state, options)
      checkpoint.snapshot.state = migrated.state
      if (checkpoint.unavailableReason) {
        delete checkpoint.unavailableReason
        changes.push(`恢复关卡检查点 ${checkpoint.visitId || index + 1}`)
      }
      if (migrated.changes.length) changes.push(`关卡检查点 ${checkpoint.visitId || index + 1}：${migrated.changes.join('；')}`)
    } catch (error) {
      const reason = String(error?.message || error)
      if (checkpoint.unavailableReason !== reason) {
        checkpoint.unavailableReason = reason
        changes.push(`关卡检查点 ${checkpoint.visitId || index + 1} 已标记为不可用`)
      }
    }
  })
  return { checkpoints, changes }
}

export function forkSessionCheckpoint(session, checkpointId, { sessionId, revision, seat } = {}) {
  if (session.state?.allowRollback === false) {
    throw Object.assign(new Error('本局已关闭回档，不能从关卡检查点重新开始'), { statusCode: 403, code: 'ROLLBACK_DISABLED' })
  }
  if (!Number.isInteger(seat) || seat !== session.state.campaign?.leadSeat) {
    throw Object.assign(new Error('只有当前队长可以从纪要重新开始关卡'), { statusCode: 403, code: 'LEADER_REQUIRED' })
  }
  const index = (session.scenarioCheckpoints || []).findIndex(item => item.checkpointId === checkpointId)
  if (index < 0) throw Object.assign(new Error('关卡检查点不存在'), { statusCode: 404, code: 'CHECKPOINT_NOT_FOUND' })
  const checkpoint = session.scenarioCheckpoints[index]
  if (checkpoint.unavailableReason) {
    throw Object.assign(new Error('此关卡检查点不可用：' + checkpoint.unavailableReason), { statusCode: 409, code: 'CHECKPOINT_INCOMPATIBLE' })
  }
  const snapshot = structuredClone(checkpoint.snapshot)
  if (!snapshot?.state || !Array.isArray(snapshot.events)) {
    throw Object.assign(new Error('关卡检查点数据不完整'), { statusCode: 409, code: 'CHECKPOINT_INVALID' })
  }
  snapshot.state.revision = revision
  return {
    sessionId,
    modId: session.modId,
    modName: session.modName,
    render: structuredClone(session.render || {}),
    players: structuredClone(session.players || []),
    state: snapshot.state,
    settings: structuredClone(session.settings || {}),
    events: snapshot.events,
    notes: Array.isArray(snapshot.notes) ? snapshot.notes : [],
    agentPlans: snapshot.agentPlans || {},
    scenarioCheckpoints: structuredClone(session.scenarioCheckpoints.slice(0, index + 1)),
    forkedFrom: {
      sessionId: session.sessionId,
      checkpointId: checkpoint.checkpointId,
      visitId: checkpoint.visitId,
      createdAt: new Date().toISOString(),
    },
    ...(session.online ? { online: true } : {}),
    saveError: null,
  }
}

export function sessionPolicy(state) {
  return {
    manualLoad: !!state.hubFlow,
    retainOnLeave: !!state.hubFlow,
    preserveInvalid: !!state.hubFlow,
    requireRevision: !!state.hubFlow,
    saveBeforeAi: !!state.hubFlow,
    confirmDelete: true,
    detachOnDelete: true,
    manualSave: true,
  }
}

export function saveSummary(state) {
  return {
    campaignId: state.campaign?.id || null,
    campaignName: state.campaign?.name || null,
    uiState: state.uiState || state.campaign?.phase || null,
    scenarioId: state.hubSelectedScenarioId || state.scenario?.id || null,
    investigators: (state.investigators || []).map(({ seat, name, code }) => ({ seat, name, code })),
  }
}

export function actionsRemaining(state, seat) {
  return state.investigators?.find(item => item.seat === seat)?.actionsLeft
}

export function participantDescription(state, seat) {
  return '扮演调查员：' + (state.investigators?.find(item => item.seat === seat)?.name || '尚未选择')
}

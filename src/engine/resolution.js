import { isDeepStrictEqual } from 'node:util'

// 续算时这些字段取自当前状态而非事务快照：存档迁移只会刷新顶层状态，
// 若从 base 恢复版本号，旧存档回答待决选择后会退回旧版本而无法继续行动。
const STATIC_FIELDS = ['cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames', 'tokenLabels',
  'schemaVersion', 'rulesVersion', 'resourceVersion']
const clone = value => JSON.parse(JSON.stringify(value))

export class ChoicePause extends Error {
  constructor(choice) {
    super('等待规则选择')
    this.choice = choice
  }
}

class ResolutionCheckpoint extends Error {
  constructor(seat, move) {
    super('规则事务检查点')
    this.seat = seat
    this.move = move
  }
}

export function resolutionCheckpoint(state, seat, move) {
  if (!state._resolution) throw new Error('检查点必须在规则事务中执行')
  throw new ResolutionCheckpoint(seat, move)
}

// `seats` lets several seats race to answer; `seat` stays the primary responder used for replay.
// An option carrying `responderSeat` may only be picked by that seat.
export function requestChoice(state, { kind, source, seat, seats = null, prompt, options, canSkip = false, automaticOptionId = null, payment = null }) {
  const context = state._resolution
  if (!context) throw new Error('选择必须在规则事务中执行')
  if (!options?.length) throw new Error('选择没有合法选项')
  // Choices and continuation answers are persisted as JSON. Compare the same
  // representation on replay (e.g. a not-yet-spawned enemy has no instance id).
  if (source && typeof source === 'object') source = clone(source)
  const index = context.cursor++
  if (index >= 512) throw new Error('单次结算选择超过安全上限')
  const id = `q${context.id}-${index}`
  const answer = context.answers[index]
  if (answer) {
    if (answer.choiceId !== id || answer.kind !== kind || !isDeepStrictEqual(answer.source, source) || answer.seat !== seat || !options.some(option => option.id === answer.optionId)) {
      throw new Error('选择恢复凭据与规则不一致')
    }
    return answer.optionId
  }
  // Optional reactions belong to the AI's own investigation turn only.
  // Record automatic passes just like answers so paused transactions replay
  // with identical choice indices; mandatory decisions are never skipped.
  if (canSkip && ['reaction', 'playerWindow', 'boost'].includes(kind)
      && !(state.humanSeats || [0]).includes(seat)
      && (state.phase !== 'investigation' || state.currentSeat !== seat)
      && options.some(option => option.id === 'skip')) {
    context.answers.push(clone({ choiceId: id, kind, source, seat, optionId: 'skip' }))
    return 'skip'
  }
  // Preserve the answer in the transaction journal, so subsequent decisions
  // and JSON save/resume keep their indices and never award the benefit twice.
  if (automaticOptionId != null && options.some(option => option.id === automaticOptionId)) {
    context.answers.push(clone({ choiceId: id, kind, source, seat, optionId: automaticOptionId }))
    return automaticOptionId
  }
  const responders = seats?.length > 1 ? { seats: [...seats] } : {}
  throw new ChoicePause(clone({ id, kind, source, seat, ...responders, prompt, options, canSkip, ...(payment ? {payment} : {}) }))
}

export function choiceSeats(choice) {
  return choice ? choice.seats || [choice.seat] : []
}

export function choiceOptionsFor(choice, seat = choice?.seat) {
  if (!choice || !choiceSeats(choice).includes(seat)) return []
  return choice.options.filter(option => option.responderSeat == null || option.responderSeat === seat)
}

export function choiceMoves(state, seat) {
  const choice = state.pendingChoice
  return choiceOptionsFor(choice, seat ?? choice?.seat)
    .map(option => ({ action: 'choose', choiceId: choice.id, optionId: option.id, label: option.label }))
}

export function choiceError(state, seat, move) {
  const choice = state.pendingChoice
  if (!choice || move.action !== 'choose' || move.choiceId !== choice.id) return '必须回答当前待决选择'
  if (!choiceSeats(choice).includes(seat)) return '不是当前选择的回答座位'
  if (typeof move.optionId !== 'string' || !choice.options.some(option => option.id === move.optionId)) return '无效选择选项'
  if (!choiceOptionsFor(choice, seat).some(option => option.id === move.optionId)) return '这个选项属于其他玩家'
  return null
}

function dynamicState(state) {
  const omitted = new Set([...STATIC_FIELDS, 'continuation', '_resolution', 'pendingChoice', 'legalMoves'])
  return clone(Object.fromEntries(Object.entries(state).filter(([key]) => !omitted.has(key))))
}

export function resolveTransaction(state, seat, move, execute, { initial = false } = {}) {
  const revision = state.revision
  const previous = state.continuation
  let transaction = previous ? clone(previous) : {
    id: revision + 1, base: dynamicState(state), seat, move: clone(move), answers: [], emitted: 0,
  }
  if (previous) {
    const choice = state.pendingChoice
    transaction.answers.push({ choiceId: choice.id, kind: choice.kind, source: choice.source, seat: choice.seat, optionId: move.optionId })
  }
  const staticState = clone(Object.fromEntries(STATIC_FIELDS.map(key => [key, state[key]])))
  let draft
  const newEvents = []
  for (let checkpoints = 0; ; checkpoints++) {
    if (checkpoints > 16) throw new Error('单次命令检查点超过安全上限')
    draft = { ...clone(transaction.base), ...staticState }
    draft.pendingChoice = null
    draft.continuation = null
    draft._resolution = { id: transaction.id, answers: transaction.answers, cursor: 0, events: [] }
    try {
      execute(draft, transaction.seat, transaction.move, [])
      if (draft._resolution.cursor !== transaction.answers.length) throw new Error('存在未消费的选择恢复凭据')
    } catch (error) {
      if (error instanceof ResolutionCheckpoint) {
        if (draft._resolution.cursor !== transaction.answers.length) throw new Error('检查点存在未消费的选择恢复凭据')
        newEvents.push(...draft._resolution.events.slice(transaction.emitted))
        transaction = { id: `${revision + 1}c${checkpoints + 1}`, base: dynamicState(draft),
          seat: error.seat, move: clone(error.move), answers: [], emitted: 0 }
        continue
      }
      if (!(error instanceof ChoicePause)) throw error
      draft.pendingChoice = error.choice
      draft.turnSeat = draft.currentSeat
      draft.currentSeat = error.choice.seat
      draft.continuation = { ...transaction, emitted: draft._resolution.events.length }
    }
    newEvents.push(...draft._resolution.events.slice(transaction.emitted))
    break
  }
  delete draft._resolution
  draft.revision = initial ? revision : revision + 1
  if (!Number.isSafeInteger(draft.revision)) throw new Error('对局版本号超过安全范围')
  for (const key of Object.keys(state)) delete state[key]
  Object.assign(state, draft)
  return newEvents
}

// Serializable campaign graph. Conditions are data, never evaluated JavaScript.
//
// P2-C（EotE）扩展边界：节点语义（scenario/story/choice/branch/partGate/interlude/checkpoint/end）
// 已足以表达《地球边缘》的「序幕 → 检查点 → 幕间 → 可选切入致命幻景 → 回主线下一章」形状——
// 检查点/幕间的分支用相邻的 `partGate`（条件路由：0 个可用出口走 next、1 个自动、≥2 个问玩家），
// 致命幻景的回场用 `scenario.next` 指向 `branch` 节点、按 `{ completed: 关卡 id }` 条件自动选下一章；
// 三种形状都由现有 `walkCampaign` 真实驱动，不需要新节点类型。本文件新增的是**注册期失败关闭**：
// 节点出口/选项形状、条件语法、效果形状与 recordSchema 类型在内容注册时校验，坏数据不再等到
// 玩家走到该节点才抛错。
import { partFlowCondition, partRecord, partScope, recordInPart } from './campaign-parts.js'

const PART_CONDITION_KEYS = Object.freeze(['part', 'parts', 'mode', 'modeIn', 'activeParts'])
export const STRUCTURAL_NODE_TYPES = Object.freeze([
  'scenario', 'story', 'choice', 'branch', 'partGate', 'stepReturn', 'interlude', 'checkpoint', 'map', 'end',
])
export const BRANCH_NODE_TYPES = Object.freeze(['choice', 'branch', 'partGate'])
const PART_IDS = Object.freeze(['A', 'B'])
// 幕间挂起效果的白名单：`walkCampaign#applyPending` 是两个效果的分发点，未知 op 在注册期拒绝。
const PENDING_EFFECT_OPS = Object.freeze(['chaosByDifficulty', 'removeCampaignCard'])
const CONDITION_FIELDS = Object.freeze([
  'all', 'any', 'not', 'hasRecord', 'capturedInvestigators', 'activeCapturedInvestigator',
  'compare', 'completed', 'completedStep', 'resolution', 'record', 'equals', 'atLeast', 'includes',
  'part', 'parts', 'mode', 'modeIn', 'activeParts',
])
const COMPARE_OPS = Object.freeze(['>', '>=', '<', '<=', '==='])
// `campaignCompletedSteps` 的记录键（EotE 参考实现用战役步骤集合决定致命幻景回场）：
// 内容层可以把非关卡步骤也写进这些集合；场景结局（scenarioResults）自动并集，无需重复抄写。
export const COMPLETED_STEP_RECORD_KEYS = Object.freeze(['completedSteps', 'campaignCompletedSteps'])

export function campaignGraph(manifest) {
  if (manifest.flow) return manifest.flow
  const nodes = {}
  manifest.scenarioIds.forEach((scenarioId, i) => {
    nodes[scenarioId] = { type: 'scenario', scenarioId, next: i + 1 < manifest.scenarioIds.length ? `rest${i}` : 'end' }
    if (i + 1 < manifest.scenarioIds.length) nodes[`rest${i}`] = { type: 'interlude', next: manifest.scenarioIds[i + 1] }
  })
  nodes.end = { type: 'end' }
  return { start: manifest.scenarioIds[0], nodes }
}

// P9.5：普通 `record` 条件在双线战役里跨线兜底解析——先读活动线，没有该键再读另一线快照。
// 依据：TDE 的 P8 幕间/尾声数据把「另一线记录」写成普通 record 条件（单袋模型迁移遗留），
// 例如 16 段尾声每格同时引用 A 轴与 B 轴记录；strict 单线解析会让可用分支恒为 0。
// 其它战役没有 parts / 另一线快照时行为与旧实现等价（只读活动线）。
function readRecordAcrossParts(campaign, key) {
  if (!key) return undefined
  const active = campaign.records || {}
  if (Object.hasOwn(active, key)) return active[key]
  for (const part of PART_IDS) {
    if (part === campaign.currentPart) continue
    const records = campaign.parts?.[part]?.records
    if (records && Object.hasOwn(records, key)) return records[key]
  }
  return active[key]
}

/**
 * 战役「已完成步骤」集合（EotE P2-C：`campaignCompletedSteps` 的只读投影）。
 * 参考实现把「关卡步骤 + 检查点/幕间步骤」都记进这个集合，致命幻景回场按它决定下一章。
 * 这里按确定顺序取并集：`scenarioResults` 的关卡 id + `campaign.completedSteps` /
 * `campaign.records.completedSteps` / `campaign.records.campaignCompletedSteps` 里的字符串。
 * 返回 Set<string>；不写状态。
 */
export function completedCampaignSteps(campaign) {
  const steps = new Set()
  for (const result of campaign?.scenarioResults || []) {
    if (result && typeof result.scenarioId === 'string' && result.scenarioId) steps.add(result.scenarioId)
  }
  for (const source of [campaign, campaign?.records]) {
    if (!source) continue
    for (const key of COMPLETED_STEP_RECORD_KEYS) {
      const value = source[key]
      if (Array.isArray(value)) for (const step of value) if (typeof step === 'string' && step) steps.add(step)
    }
  }
  return steps
}

export function flowCondition(condition, campaign) {
  if (!condition) return true
  if (condition.all) return condition.all.every(c => flowCondition(c, campaign))
  if (condition.any) return condition.any.some(c => flowCondition(c, campaign))
  if (condition.not) return !flowCondition(condition.not, campaign)
  // P9.5 幕间（TDE）跨线记录条件：`hasRecord: { part, key }` 读指定线（缺 part 读当前线）。
  // 造型与 part 前置判断分开：`part` 在这里是「读哪条线」，不是「活动线是哪条」。
  if (condition.hasRecord) {
    const spec = condition.hasRecord || {}
    const value = spec.part ? partRecord(campaign, spec.part, spec.key) : (campaign.records || {})[spec.key]
    return Boolean(value)
  }
  // P9.5 幕间 II 绿字：按线的「至少一人未被俘 / 全员被俘」（wasCaptured 为调查员 id 列表）。
  if (condition.capturedInvestigators) {
    const part = condition.part
    const scope = part ? partScope(campaign, part) : { investigators: campaign.investigators, records: campaign.records }
    const roster = Object.values(scope.investigators || {}).filter(record => record && record.id)
    const captured = new Set((part ? partRecord(campaign, part, 'wasCaptured') : (campaign.records || {}).wasCaptured) || [])
    const someNotCaptured = roster.some(record => !captured.has(record.id))
    return condition.capturedInvestigators === 'someNotCaptured'
      ? roster.length > 0 && someNotCaptured
      : roster.length > 0 && !someNotCaptured
  }
  if (condition.activeCapturedInvestigator) {
    return PART_IDS.some(part => {
      const scope = partScope(campaign, part)
      const ids = new Set(scope.records.wasCaptured || [])
      return Object.values(scope.investigators).some(record => record.status === 'active' && ids.has(record.id))
    })
  }
  // 双线条件（P5 批次 1）：part/parts/mode/modeIn/activeParts 与普通条件可以同时出现在
  // 同一个叶子上（例如 `{ mode: 'pick', record: 'x', atLeast: 1 }`），拆开分别判断。
  if (PART_CONDITION_KEYS.some(key => Object.hasOwn(condition, key))) {
    if (!partFlowCondition(campaign, condition)) return false
    const rest = { ...condition }
    for (const key of PART_CONDITION_KEYS) delete rest[key]
    return Object.keys(rest).length === 0 || flowCondition(rest, campaign)
  }
  if (condition.compare) {
    const read = operand => {
      if (typeof operand === 'number') return operand
      if (typeof operand === 'string') return Number(readRecordAcrossParts(campaign, operand) || 0)
      if (operand?.sum) return operand.sum.reduce((total, key) =>
        total + Number(readRecordAcrossParts(campaign, key) || 0), 0)
      throw new Error('未知战役比较操作数')
    }
    const left = read(condition.compare.left)
    const right = read(condition.compare.right)
    return ({ '>': left > right, '>=': left >= right, '<': left < right,
      '<=': left <= right, '===': left === right })[condition.compare.op] ?? false
  }
  if (condition.completed) return campaign.scenarioResults.some(r => r.scenarioId === condition.completed)
  // P2-C（EotE）：`completedStep` 读「已完成步骤」集合（含非关卡步骤），与 `completed`（只读
  // scenarioResults 的关卡 id）分开；数组形式要求全部完成，任一完成请用 any 组合。
  if (condition.completedStep != null) {
    const steps = completedCampaignSteps(campaign)
    return Array.isArray(condition.completedStep)
      ? condition.completedStep.length > 0 && condition.completedStep.every(step => steps.has(step))
      : steps.has(condition.completedStep)
  }
  if (condition.resolution) {
    const { scenarioId, value } = condition.resolution
    return campaign.scenarioResults.findLast(r => r.scenarioId === scenarioId)?.resolution === value
  }
  const value = readRecordAcrossParts(campaign, condition.record)
  if (Object.hasOwn(condition, 'equals')) return value === condition.equals
  if (Object.hasOwn(condition, 'atLeast')) return Number(value || 0) >= condition.atLeast
  if (Object.hasOwn(condition, 'includes')) return Array.isArray(value) && value.includes(condition.includes)
  throw new Error('未知战役条件')
}

// ---------------------------------------------------------------------------
// 注册期校验：条件 / 效果（失败关闭）
// ---------------------------------------------------------------------------
//
// `flowCondition` 与 `walkCampaign` 只在运行期解释这些数据；内容注册时先跑同一套语法校验，
// 让拼错的条件键、未知挂起效果、与 recordSchema 不符的记录值在加载期就被拒绝（P2-C EotE 口径）。
// 错误消息保持中文并带节点/选项定位。

function compareOperandError(operand) {
  if (typeof operand === 'number' && Number.isFinite(operand)) return null
  if (typeof operand === 'string' && operand) return null
  if (operand && typeof operand === 'object' && !Array.isArray(operand)
    && Array.isArray(operand.sum) && operand.sum.length
    && operand.sum.every(key => typeof key === 'string' && key)) return null
  return '未知战役比较操作数'
}

/** 条件语法错误消息；合法返回 null（与 `flowCondition` 的判定分支一一对应）。 */
function conditionError(condition, recordSchema = null) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return '条件必须是对象'
  const keys = Object.keys(condition)
  if (!keys.length) return '条件不能是空对象'
  const unknown = keys.filter(key => !CONDITION_FIELDS.includes(key))
  if (unknown.length) return `未知条件字段 ${unknown.join('、')}`
  const combinators = ['all', 'any', 'not'].filter(key => Object.hasOwn(condition, key))
  if (combinators.length > 1) return '条件组合器 all/any/not 只能出现一个'
  if (combinators.length === 1) {
    const key = combinators[0]
    if (keys.length > 1) return `${key} 不能与其它条件字段并列`
    if (key === 'not') return conditionError(condition.not, recordSchema)
    const children = condition[key]
    if (!Array.isArray(children) || !children.length) return `${key} 必须是非空条件数组`
    for (const [index, child] of children.entries()) {
      const error = conditionError(child, recordSchema)
      if (error) return `${key}[${index}]：${error}`
    }
    return null
  }
  // 幕间/双线条件键（part/parts/mode/modeIn/activeParts）可与普通记录条件同时出现，
  // 与 `flowCondition` 一样「先判线、再判剩余条件」。
  const partFields = PART_CONDITION_KEYS.filter(key => Object.hasOwn(condition, key))
  if (partFields.length) {
    if (Object.hasOwn(condition, 'part') && !PART_IDS.includes(condition.part)) return "part 必须是 'A' 或 'B'"
    for (const field of ['parts', 'activeParts']) {
      if (!Object.hasOwn(condition, field)) continue
      const values = condition[field]
      if (!Array.isArray(values) || !values.length || values.some(part => !PART_IDS.includes(part))) {
        return `${field} 必须是非空的 'A'/'B' 数组`
      }
    }
    for (const field of ['mode', 'modeIn']) {
      if (!Object.hasOwn(condition, field)) continue
      const values = field === 'mode' ? [condition[field]] : condition[field]
      if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string' || !value)) {
        return field === 'mode' ? 'mode 必须是非空模式字符串' : 'modeIn 必须是非空模式字符串数组'
      }
    }
    const rest = { ...condition }
    for (const key of partFields) delete rest[key]
    return Object.keys(rest).length ? conditionError(rest, recordSchema) : null
  }
  if (Object.hasOwn(condition, 'compare')) {
    if (keys.length > 1) return 'compare 不能与其它条件字段并列'
    const spec = condition.compare || {}
    if (!COMPARE_OPS.includes(spec.op)) return `未知比较运算符 ${String(spec.op)}`
    for (const operand of [spec.left, spec.right]) {
      const error = compareOperandError(operand)
      if (error) return error
    }
    return null
  }
  if (Object.hasOwn(condition, 'completed')) {
    if (keys.length > 1) return 'completed 不能与其它条件字段并列'
    if (typeof condition.completed !== 'string' || !condition.completed) return 'completed 必须是非空关卡 id'
    return null
  }
  if (Object.hasOwn(condition, 'completedStep')) {
    if (keys.length > 1) return 'completedStep 不能与其它条件字段并列'
    const steps = condition.completedStep
    const valid = typeof steps === 'string' ? Boolean(steps)
      : Array.isArray(steps) && steps.length > 0 && steps.every(step => typeof step === 'string' && step)
    if (!valid) return 'completedStep 必须是非空步骤 id 或步骤 id 数组'
    return null
  }
  if (Object.hasOwn(condition, 'resolution')) {
    if (keys.length > 1) return 'resolution 不能与其它条件字段并列'
    const spec = condition.resolution || {}
    if (typeof spec.scenarioId !== 'string' || !spec.scenarioId) return 'resolution 需要非空 scenarioId'
    if (typeof spec.value !== 'string' || !spec.value) return 'resolution 需要非空 value'
    return null
  }
  if (Object.hasOwn(condition, 'hasRecord')) {
    if (keys.length > 1) return 'hasRecord 不能与其它条件字段并列'
    const spec = condition.hasRecord
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return 'hasRecord 必须是 { part?, key } 对象'
    const extra = Object.keys(spec).filter(key => !['part', 'key'].includes(key))
    if (extra.length) return `hasRecord 含未知字段 ${extra.join('、')}`
    if (typeof spec.key !== 'string' || !spec.key) return 'hasRecord 需要非空 key'
    if (spec.part != null && !PART_IDS.includes(spec.part)) return "hasRecord.part 必须是 'A' 或 'B'"
    return null
  }
  if (Object.hasOwn(condition, 'capturedInvestigators')) {
    const extra = keys.filter(key => !['capturedInvestigators', 'part'].includes(key))
    if (extra.length) return 'capturedInvestigators 不能与其它条件字段并列'
    if (!['someNotCaptured', 'allCaptured'].includes(condition.capturedInvestigators)) return '未知被俘条件取值'
    if (condition.part != null && !PART_IDS.includes(condition.part)) return "capturedInvestigators.part 必须是 'A' 或 'B'"
    return null
  }
  if (Object.hasOwn(condition, 'activeCapturedInvestigator')) {
    if (keys.length > 1) return 'activeCapturedInvestigator 不能与其它条件字段并列'
    if (typeof condition.activeCapturedInvestigator !== 'boolean') return 'activeCapturedInvestigator 必须是布尔值'
    return null
  }
  if (Object.hasOwn(condition, 'record')) {
    if (typeof condition.record !== 'string' || !condition.record) return 'record 必须是非空记录键'
    const operators = ['equals', 'atLeast', 'includes'].filter(key => Object.hasOwn(condition, key))
    const extra = keys.filter(key => key !== 'record' && !operators.includes(key))
    if (extra.length) return `记录条件含未知字段 ${extra.join('、')}`
    if (operators.length !== 1) return '记录条件必须且只能声明 equals/atLeast/includes 之一'
    if (operators[0] === 'atLeast' && !Number.isFinite(condition.atLeast)) return 'atLeast 必须是有限数值'
    // 声明了 recordSchema 时按记录类型校验操作符（与效果写入的类型校验同一口径）。
    if (recordSchema) {
      const declared = recordSchema[condition.record]
      if (!declared) return `条件引用了未声明的记录 ${condition.record}`
      const operator = operators[0]
      if (declared === 'boolean' && operator !== 'equals') return `布尔记录 ${condition.record} 只支持 equals`
      if (declared === 'boolean' && typeof condition.equals !== 'boolean') return `布尔记录 ${condition.record} 的 equals 必须是布尔值`
      if (declared === 'number' && operator === 'includes') return `数值记录 ${condition.record} 不支持 includes`
      if (declared === 'number' && !Number.isFinite(condition[operator === 'equals' ? 'equals' : 'atLeast'])) {
        return `数值记录 ${condition.record} 的比较值必须是有限数值`
      }
      if (declared === 'string' && operator !== 'equals') return `字符串记录 ${condition.record} 只支持 equals`
      if (declared === 'string' && typeof condition.equals !== 'string') return `字符串记录 ${condition.record} 的 equals 必须是字符串`
      if (declared === 'string[]' && operator !== 'includes') return `集合记录 ${condition.record} 只支持 includes`
      if (declared === 'string[]' && (typeof condition.includes !== 'string' || !condition.includes)) {
        return `集合记录 ${condition.record} 的 includes 必须是非空字符串`
      }
    }
    return null
  }
  return '条件缺少可识别的判定字段'
}

function assertFlowCondition(condition, label, recordSchema = null) {
  if (condition == null) return
  const error = conditionError(condition, recordSchema)
  if (error) throw new Error(`${label}：${error}`)
}

/** 效果语法错误消息（record/increment 的形状与 `walkCampaign#apply` 的运行期检查对齐）。 */
function effectError(effect) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return '效果必须是对象'
  if (typeof effect.type !== 'string' || !effect.type) return '效果缺少 type'
  if (effect.type === 'record') {
    if (typeof effect.key !== 'string' || !effect.key) return 'record 效果缺少 key'
    if (!Object.hasOwn(effect, 'value')) return 'record 效果缺少 value'
    const value = effect.value
    if (value === null || ['boolean', 'string', 'number'].includes(typeof value)) return null
    if (Array.isArray(value) && value.length && value.every(item => typeof item === 'string')) return null
    return 'record 效果 value 必须是 JSON 标量或字符串数组'
  }
  if (effect.type === 'increment') {
    if (typeof effect.key !== 'string' || !effect.key) return 'increment 效果缺少 key'
    if (!Number.isFinite(effect.amount)) return '战役记录增量必须是有限数值'
  }
  return null
}

/** 声明了 recordSchema 时，记录效果的值类型必须在注册期对上（与运行期同一判据）。 */
function recordSchemaError(effect, manifest) {
  const declared = manifest?.recordSchema?.[effect.key]
  if (!declared) return null
  if (effect.type === 'record') {
    const actual = Array.isArray(effect.value) ? 'string[]' : typeof effect.value
    if (declared !== actual) return `战役记录 ${effect.key} 类型应为 ${declared}（实际 ${actual}）`
  }
  if (effect.type === 'increment' && declared !== 'number') return `战役记录 ${effect.key} 不是数值`
  return null
}

function assertCampaignEffects(effects, label, manifest, pending = false) {
  if (effects == null) return
  if (!Array.isArray(effects)) throw new Error(`${label} 的效果必须是数组`)
  for (const [index, effect] of effects.entries()) {
    const where = `${label} 效果[${index}]`
    if (pending) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) throw new Error(`${where} 必须是对象`)
      if (typeof effect.op !== 'string' || !PENDING_EFFECT_OPS.includes(effect.op)) {
        throw new Error(`${where} 是未知挂起效果：${String(effect?.op)}`)
      }
      continue
    }
    const error = effectError(effect)
    if (error) throw new Error(`${where}：${error}`)
    const schemaError = recordSchemaError(effect, manifest)
    if (schemaError) throw new Error(`${where}：${schemaError}`)
  }
}

/** 节点上的条件/效果/挂起效果声明（幕间 greens、条件 branches 与选项效果共用）。 */
function assertNodeExtras(id, node, manifest) {
  const recordSchema = manifest?.recordSchema || null
  assertFlowCondition(node.textWhen, `战役节点 ${id} 的 textWhen`, recordSchema)
  assertCampaignEffects(node.effects, `战役节点 ${id}`, manifest)
  assertCampaignEffects(node.pendingEffects, `战役节点 ${id}`, manifest, true)
  if (node.greens != null) {
    if (!Array.isArray(node.greens)) throw new Error(`战役节点 ${id} 的 greens 必须是数组`)
    for (const [index, green] of node.greens.entries()) {
      if (!green || typeof green !== 'object' || Array.isArray(green)) throw new Error(`战役节点 ${id} 的 greens[${index}] 必须是对象`)
      assertFlowCondition(green.when, `战役节点 ${id} 的 greens[${index}].when`, recordSchema)
      assertCampaignEffects(green.effects, `战役节点 ${id} 的 greens[${index}]`, manifest)
      assertCampaignEffects(green.pendingEffects, `战役节点 ${id} 的 greens[${index}]`, manifest, true)
    }
  }
  if (node.branches != null) {
    if (!Array.isArray(node.branches)) throw new Error(`战役节点 ${id} 的 branches 必须是数组`)
    for (const [index, branch] of node.branches.entries()) {
      if (!branch || typeof branch !== 'object' || Array.isArray(branch)) throw new Error(`战役节点 ${id} 的 branches[${index}] 必须是对象`)
      assertFlowCondition(branch.when, `战役节点 ${id} 的 branches[${index}].when`, recordSchema)
      assertCampaignEffects(branch.then, `战役节点 ${id} 的 branches[${index}]`, manifest)
    }
  }
}

/**
 * `stepReturn`：按声明顺序取**第一条**命中规则（参考实现 `nextStep` 的 if/else 链语义），
 * 都不是则走兜底 `next`。与 `branch` 的区别：branch 要求「恰好一条命中」且由内容手工互斥，
 * 这里允许规则重叠并按优先级短路——致命幻景回场（古城已完成→疯狂之心 I、峰顶已完成→古城、
 * 否则→峰顶）就是这种有序链，用互斥条件硬写会把 Negation 抄满每个选项。
 */
function assertStepReturn(id, node, manifest) {
  if (!Array.isArray(node.rules) || !node.rules.length) throw new Error(`战役步骤返回节点缺少 rules：${id}`)
  if (!node.next) throw new Error(`战役步骤返回节点缺少兜底出口：${id}`)
  const ids = new Set()
  for (const [index, rule] of node.rules.entries()) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`战役步骤返回 ${id} 的 rules[${index}] 必须是对象`)
    const extra = Object.keys(rule).filter(key => !['id', 'when', 'next', 'effects', 'label'].includes(key))
    if (extra.length) throw new Error(`战役步骤返回 ${id} 的 rules[${index}] 含未知字段 ${extra.join('、')}`)
    if (rule.id != null) {
      if (typeof rule.id !== 'string' || !rule.id) throw new Error(`战役步骤返回 ${id} 的 rules[${index}] id 不合法`)
      if (ids.has(rule.id)) throw new Error(`战役步骤返回 ${id} 的规则 id 重复：${rule.id}`)
      ids.add(rule.id)
    }
    if (rule.next == null || typeof rule.next !== 'string' || !rule.next) {
      throw new Error(`战役步骤返回 ${id} 的 rules[${index}] 缺少出口`)
    }
    // 缺 when 的规则在运行期等价于「无条件命中」并吞掉后续规则，必须在注册期拒绝。
    if (rule.when == null) throw new Error(`战役步骤返回 ${id} 的 rules[${index}] 缺少 when`)
    assertFlowCondition(rule.when, `战役步骤返回 ${id} 的规则 ${rule.id || index} 的 when`, manifest?.recordSchema || null)
    assertCampaignEffects(rule.effects, `战役步骤返回 ${id} 的规则 ${rule.id || index}`, manifest)
  }
}

export function validateCampaignGraph(manifest) {
  const graph = campaignGraph(manifest)
  if (!graph?.nodes || !graph.start || !graph.nodes[graph.start]) throw new Error('战役流程缺少起始节点')
  const recordSchema = manifest?.recordSchema || null
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || !STRUCTURAL_NODE_TYPES.includes(node.type)) {
      throw new Error(`未知战役节点：${id}`)
    }
    if (node.next != null && (typeof node.next !== 'string' || !node.next)) throw new Error(`战役出口必须是节点 id：${id}`)
    if (node.type === 'end' && node.next != null) throw new Error(`结局节点不能有出口：${id}`)
    if (node.type === 'scenario' && !manifest.scenarioIds.includes(node.scenarioId)) throw new Error(`节点引用未知关卡：${id}`)
    if (node.type === 'partGate' && !node.next) throw new Error(`章对门缺少「两边都完成」的出口：${id}`)
    // 八循环 P2：`map` 节点表示世界地图启程段（TSK）。走图与旅行由战役行为驱动，
    // 流程执行器只停下并交出节点，必须声明回到主线/下一幕间的出口。
    if (node.type === 'map' && !node.next) throw new Error(`世界地图节点缺少出口：${id}`)
    if (node.type === 'map' && node.options != null) throw new Error(`世界地图节点不能声明选项（由战役行为接管）：${id}`)
    // 引擎只在 interlude/checkpoint 节点上读 `next`（见 src/engine/campaign-flow.js#progressCampaign），
    // 这两类节点写 options 会被静默忽略；非分支节点声明 options 一律在注册期拒绝。
    if (node.options != null && !BRANCH_NODE_TYPES.includes(node.type)) {
      throw new Error(`非分支节点不能声明选项（会被忽略）：${id}`)
    }
    if (node.options != null && !Array.isArray(node.options)) throw new Error(`战役选项必须是数组：${id}`)
    if (BRANCH_NODE_TYPES.includes(node.type) && !node.options?.length) throw new Error(`战役选择没有选项：${id}`)
    for (const [index, option] of (node.options || []).entries()) {
      if (!option || typeof option !== 'object' || Array.isArray(option)) throw new Error(`战役选项必须是对象：${id}[${index}]`)
      if (typeof option.id !== 'string' || !option.id) throw new Error(`战役选项缺少 id：${id}[${index}]`)
      if (option.next != null && (typeof option.next !== 'string' || !option.next)) {
        throw new Error(`战役选项出口必须是节点 id：${id}/${option.id}`)
      }
      assertFlowCondition(option.when, `战役节点 ${id} 的选项 ${option.id} 的 when`, recordSchema)
      assertCampaignEffects(option.effects, `战役节点 ${id} 的选项 ${option.id}`, manifest)
    }
    if ((node.options || []).some(option => option.next == null)) throw new Error(`战役选项缺少出口：${id}`)
    if (node.options && new Set(node.options.map(o => o.id)).size !== node.options.length) throw new Error(`重复战役选项：${id}`)
    if (node.type === 'stepReturn') assertStepReturn(id, node, manifest)
    assertNodeExtras(id, node, manifest)
    const edges = node.type === 'stepReturn' ? [...node.rules, ...(node.next ? [{ next: node.next }] : [])]
      : BRANCH_NODE_TYPES.includes(node.type) ? [...node.options, ...(node.next ? [{ next: node.next }] : [])]
        : node.next ? [{ next: node.next }] : []
    if (node.type !== 'end' && !edges.length) throw new Error(`战役节点缺少出口：${id}`)
    for (const edge of edges) if (!graph.nodes[edge.next]) throw new Error(`战役出口不存在：${id}/${edge.next}`)
  }
  return graph
}

export function enterCampaignNode(campaign, manifest, nodeId) {
  const graph = validateCampaignGraph(manifest)
  if (!graph.nodes[nodeId]) throw new Error(`未知战役节点：${nodeId}`)
  campaign.flow ||= { nodeId, history: [], visits: {} }
  campaign.flow.nodeId = nodeId
  campaign.flow.visits[nodeId] = (campaign.flow.visits[nodeId] || 0) + 1
  campaign.flow.history.push({ nodeId, visit: campaign.flow.visits[nodeId] })
  return graph.nodes[nodeId]
}

export function walkCampaign(campaign, manifest, choose, applyEffect = () => {}, { continuousInterlude = false, stopAtPartGate = false } = {}) {
  const graph = validateCampaignGraph(manifest)
  if (!campaign.flow) enterCampaignNode(campaign, manifest, graph.start)
  for (let steps = 0; steps < 128; steps++) {
    const id = campaign.flow.nodeId
    const node = graph.nodes[id]
    if (stopAtPartGate && node.type === 'partGate') return { ...node, id }
    const visit = campaign.flow.history.at(-1)
    const partOf = effect => (PART_IDS.includes(effect?.part) ? effect.part : null)
    const apply = effect => {
      const part = partOf(effect)
      if (effect.type === 'record') {
        const declared = campaign.recordSchema?.[effect.key]
        const actual = Array.isArray(effect.value) ? 'string[]' : typeof effect.value
        if (declared && declared !== actual) throw new Error(`战役记录 ${effect.key} 类型应为 ${declared}`)
        if (part) recordInPart(campaign, part, effect.key, effect.value)
        else campaign.records[effect.key] = structuredClone(effect.value)
      }
      else if (effect.type === 'increment') {
        if (!Number.isFinite(effect.amount)) throw new Error('战役记录增量必须是有限数值')
        if (campaign.recordSchema?.[effect.key] && campaign.recordSchema[effect.key] !== 'number') {
          throw new Error(`战役记录 ${effect.key} 不是数值`)
        }
        const base = part ? Number(partRecord(campaign, part, effect.key) || 0) : Number(campaign.records[effect.key] || 0)
        if (part) recordInPart(campaign, part, effect.key, base + effect.amount)
        else campaign.records[effect.key] = base + effect.amount
      }
      else applyEffect(effect)
    }
    // P9.5 幕间（TDE）：节点级条件绿字、条件分支与舞台挂起效果。字段只出现在本循环的幕间数据里，
    // 其它战役零影响（无字段 → 什么都不做）。
    const applyPending = effect => {
      const op = effect?.op
      if (op === 'chaosByDifficulty') return applyEffect({ ...effect, type: 'chaosByDifficulty' })
      if (op === 'removeCampaignCard') return applyEffect({ ...effect, type: 'removeCampaignCard' })
      throw new Error(`未知幕间挂起效果：${String(op)}`)
    }
    const applyInterludeExtras = node => {
      for (const green of node.greens || []) {
        if (!flowCondition(green.when, campaign)) continue
        if (green.text) {
          visit.storyText = [visit.storyText, green.text].filter(Boolean).join('\n\n')
          applyEffect({ type: 'log', text: green.text })
        }
        for (const effect of green.effects || []) apply(effect)
        for (const effect of green.pendingEffects || []) applyPending(effect)
      }
      if (Array.isArray(node.branches) && node.branches.length) {
        const matched = node.branches.filter(branch => flowCondition(branch.when, campaign))
        const selected = node.branchesMode === 'independent' ? matched : matched.slice(0, 1)
        for (const branch of selected) for (const effect of branch.then || []) apply(effect)
      }
      for (const effect of node.pendingEffects || []) applyPending(effect)
    }
    if (!visit.effectsApplied) {
      if (node.text && (!node.textWhen || flowCondition(node.textWhen, campaign))) {
        visit.storyText = node.text
        visit.storyTitle = node.title || node.prompt || '调查纪事'
        applyEffect({ type: 'log', text: node.text })
      }
      for (const effect of node.effects || []) apply(effect)
      if (node.epilogueNumber != null) campaign.epilogueNumber = node.epilogueNumber
      applyInterludeExtras(node)
      visit.effectsApplied = true
    }
    // P9.5：声明 `interludeFlow: 'continuous'` 的战役（TDE）在「关间准备结束」后一次读完整个
    // 幕间子图（连续 interlude/story/choice/branch 节点），不再每个节点开一次休息窗；
    // 子图入口仍停在第一个 interlude 节点让全桌做升级准备。
    // 八循环 P2：`map` 节点同样交给战役行为接管（走图/旅行/时间），执行器停下不自动推进。
    if (['scenario', 'interlude', 'checkpoint', 'end', 'map'].includes(node.type)) {
      if (node.type !== 'interlude' || !continuousInterlude) return { ...node, id }
    }
    let edge = node
    if (node.type === 'partGate') {
      // 章对门：本对还有哪些章没完成就走哪些；两边都完成 → 幕间/结局；
      // 只剩一边 → 自动进入（不再问玩家，避免「只有一个选项」的无效点击）。
      const options = node.options.filter(option => flowCondition(option.when, campaign))
      if (!options.length) edge = { next: node.next }
      else if (options.length === 1) {
        edge = options[0]
        campaign.flow.history.at(-1).choice = edge.id
      } else {
        const answer = choose(id, node, options)
        edge = options.find(option => option.id === answer)
        if (!edge) throw new Error('无效战役分支')
        campaign.flow.history.at(-1).choice = answer
      }
    } else if (node.type === 'choice' || node.type === 'branch') {
      const options = node.options.filter(option => flowCondition(option.when, campaign))
      if (!options.length) throw new Error(`战役节点没有可用分支：${id}`)
      if (node.type === 'branch' && options.length !== 1) throw new Error(`战役自动分支必须唯一：${id}`)
      const answer = node.type === 'branch' ? options[0].id : choose(id, node, options)
      edge = options.find(option => option.id === answer)
      if (!edge) throw new Error('无效战役分支')
      campaign.flow.history.at(-1).choice = answer
    } else if (node.type === 'stepReturn') {
      // 有序规则链：第一条命中的规则生效（参考实现 nextStep 的 if/else 链），都不命中走兜底 next。
      const matched = node.rules.find(rule => flowCondition(rule.when, campaign))
      edge = matched || { next: node.next }
      campaign.flow.history.at(-1).choice = matched ? (matched.id ?? null) : null
    }
    for (const effect of edge === node ? [] : edge.effects || []) apply(effect)
    enterCampaignNode(campaign, manifest, edge.next)
  }
  throw new Error('战役自动节点形成循环，未到达可交互节点')
}

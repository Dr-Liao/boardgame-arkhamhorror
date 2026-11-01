// Serializable campaign graph. Conditions are data, never evaluated JavaScript.
import { partFlowCondition, partRecord, partScope, recordInPart } from './campaign-parts.js'

const PART_CONDITION_KEYS = Object.freeze(['part', 'parts', 'mode', 'modeIn', 'activeParts'])
const STRUCTURAL_NODE_TYPES = Object.freeze(['scenario', 'story', 'choice', 'branch', 'partGate', 'interlude', 'checkpoint', 'end'])
const BRANCH_NODE_TYPES = Object.freeze(['choice', 'branch', 'partGate'])
const PART_IDS = Object.freeze(['A', 'B'])

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

export function validateCampaignGraph(manifest) {
  const graph = campaignGraph(manifest)
  if (!graph.nodes?.[graph.start]) throw new Error('战役流程缺少起始节点')
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!STRUCTURAL_NODE_TYPES.includes(node.type)) throw new Error(`未知战役节点：${id}`)
    if (node.type === 'scenario' && !manifest.scenarioIds.includes(node.scenarioId)) throw new Error(`节点引用未知关卡：${id}`)
    if (node.type === 'partGate' && !node.next) throw new Error(`章对门缺少「两边都完成」的出口：${id}`)
    if (BRANCH_NODE_TYPES.includes(node.type) && !node.options?.length) throw new Error(`战役选择没有选项：${id}`)
    const edges = BRANCH_NODE_TYPES.includes(node.type) ? [...node.options, ...(node.next ? [{ next: node.next }] : [])]
      : node.next ? [{ next: node.next }] : []
    if (node.type !== 'end' && !edges.length) throw new Error(`战役节点缺少出口：${id}`)
    if (node.options && new Set(node.options.map(o => o.id)).size !== node.options.length) throw new Error(`重复战役选项：${id}`)
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

export function walkCampaign(campaign, manifest, choose, applyEffect = () => {}, { continuousInterlude = false } = {}) {
  const graph = validateCampaignGraph(manifest)
  if (!campaign.flow) enterCampaignNode(campaign, manifest, graph.start)
  for (let steps = 0; steps < 128; steps++) {
    const id = campaign.flow.nodeId
    const node = graph.nodes[id]
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
      if (node.text) {
        visit.storyText = node.text
        visit.storyTitle = node.title || node.prompt || '调查纪事'
        applyEffect({ type: 'log', text: node.text })
      }
      for (const effect of node.effects || []) apply(effect)
      applyInterludeExtras(node)
      visit.effectsApplied = true
    }
    // P9.5：声明 `interludeFlow: 'continuous'` 的战役（TDE）在「关间准备结束」后一次读完整个
    // 幕间子图（连续 interlude/story/choice/branch 节点），不再每个节点开一次休息窗；
    // 子图入口仍停在第一个 interlude 节点让全桌做升级准备。
    if (['scenario', 'interlude', 'checkpoint', 'end'].includes(node.type)) {
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
    }
    for (const effect of edge === node ? [] : edge.effects || []) apply(effect)
    enterCampaignNode(campaign, manifest, edge.next)
  }
  throw new Error('战役自动节点形成循环，未到达可交互节点')
}

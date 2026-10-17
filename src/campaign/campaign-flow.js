// Serializable campaign graph. Conditions are data, never evaluated JavaScript.
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

export function flowCondition(condition, campaign) {
  if (!condition) return true
  if (condition.all) return condition.all.every(c => flowCondition(c, campaign))
  if (condition.any) return condition.any.some(c => flowCondition(c, campaign))
  if (condition.not) return !flowCondition(condition.not, campaign)
  if (condition.compare) {
    const read = operand => {
      if (typeof operand === 'number') return operand
      if (typeof operand === 'string') return Number(campaign.records[operand] || 0)
      if (operand?.sum) return operand.sum.reduce((total, key) =>
        total + Number(campaign.records[key] || 0), 0)
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
  const value = campaign.records[condition.record]
  if (Object.hasOwn(condition, 'equals')) return value === condition.equals
  if (Object.hasOwn(condition, 'atLeast')) return Number(value || 0) >= condition.atLeast
  if (Object.hasOwn(condition, 'includes')) return Array.isArray(value) && value.includes(condition.includes)
  throw new Error('未知战役条件')
}

export function validateCampaignGraph(manifest) {
  const graph = campaignGraph(manifest)
  if (!graph.nodes?.[graph.start]) throw new Error('战役流程缺少起始节点')
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!['scenario', 'story', 'choice', 'branch', 'interlude', 'checkpoint', 'end'].includes(node.type)) throw new Error(`未知战役节点：${id}`)
    if (node.type === 'scenario' && !manifest.scenarioIds.includes(node.scenarioId)) throw new Error(`节点引用未知关卡：${id}`)
    if (['choice', 'branch'].includes(node.type) && !node.options?.length) throw new Error(`战役选择没有选项：${id}`)
    const edges = ['choice', 'branch'].includes(node.type) ? node.options : node.next ? [{ next: node.next }] : []
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

export function walkCampaign(campaign, manifest, choose, applyEffect = () => {}) {
  const graph = validateCampaignGraph(manifest)
  if (!campaign.flow) enterCampaignNode(campaign, manifest, graph.start)
  for (let steps = 0; steps < 128; steps++) {
    const id = campaign.flow.nodeId
    const node = graph.nodes[id]
    const visit = campaign.flow.history.at(-1)
    const apply = effect => {
      if (effect.type === 'record') {
        const declared = campaign.recordSchema?.[effect.key]
        const actual = Array.isArray(effect.value) ? 'string[]' : typeof effect.value
        if (declared && declared !== actual) throw new Error(`战役记录 ${effect.key} 类型应为 ${declared}`)
        campaign.records[effect.key] = structuredClone(effect.value)
      }
      else if (effect.type === 'increment') {
        if (!Number.isFinite(effect.amount)) throw new Error('战役记录增量必须是有限数值')
        if (campaign.recordSchema?.[effect.key] && campaign.recordSchema[effect.key] !== 'number') {
          throw new Error(`战役记录 ${effect.key} 不是数值`)
        }
        campaign.records[effect.key] = Number(campaign.records[effect.key] || 0) + effect.amount
      }
      else applyEffect(effect)
    }
    if (!visit.effectsApplied) {
      if (node.text) {
        visit.storyText = node.text
        visit.storyTitle = node.title || node.prompt || '调查纪事'
        applyEffect({ type: 'log', text: node.text })
      }
      for (const effect of node.effects || []) apply(effect)
      visit.effectsApplied = true
    }
    if (['scenario', 'interlude', 'checkpoint', 'end'].includes(node.type)) return { ...node, id }
    let edge = node
    if (node.type === 'choice' || node.type === 'branch') {
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

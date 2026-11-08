// 战役流程 / 混乱袋 / 指南来源 与 audit/eote-scope.json 的一致性核对。
import fs from 'node:fs'
import * as flow from '../../../../../content/campaigns/edgeOfTheEarth/flow.js'
import * as parts from '../../../../../content/campaigns/edgeOfTheEarth/parts.js'
import { CHAOS_BAGS } from '../../../../../content/campaigns/edgeOfTheEarth/shared.js'
import { manifest } from '../../../../../content/campaigns/edgeOfTheEarth/manifest.js'

const scope = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/audit/eote-scope.json', 'utf8'))
const cf = scope.campaignFlow
const report = { steps: {}, nextEdges: [], chaosBags: {}, prologue: [], flowNodes: {}, handlerEdges: [] }

// 1) 16 步：scope.steps.order vs parts.EOTE_STEP_ORDER
const scopeOrder = [...cf.steps].sort((a, b) => a.order - b.order).map(step => step.id)
report.steps = {
  scope: scopeOrder,
  implemented: [...parts.EOTE_STEP_ORDER],
  equal: JSON.stringify(scopeOrder) === JSON.stringify([...parts.EOTE_STEP_ORDER]),
  missing: scopeOrder.filter(id => !parts.EOTE_STEP_ORDER.includes(id)),
  extra: parts.EOTE_STEP_ORDER.filter(id => !scopeOrder.includes(id)),
}

// 2) next edges（集合比较；顺序另记）
const edgeMap = new Map(cf.nextStepEdges.map(edge => [edge.from, edge.targets]))
const finalNodeIds = ['prologue', ...parts.EOTE_STEP_ORDER, 'fatalMirage']
for (const id of finalNodeIds) {
  const expected = edgeMap.get(id)
  if (!expected) continue
  const implemented = parts.eoteNextStep(id, [])
  const set = list => JSON.stringify([...list].sort())
  report.nextEdges.push({ id, expected, implemented, setEqual: set(expected) === set(implemented), orderEqual: JSON.stringify(expected) === JSON.stringify(implemented) })
}

// 3) handlerEdges vs flow 图（子图出口）
const graph = flow.EOTE_FLOW
report.flowNodes = {
  start: graph.start,
  count: Object.keys(graph.nodes).length,
  types: Object.entries(graph.nodes).reduce((acc, [, node]) => {
    acc[node.type] = (acc[node.type] || 0) + 1
    return acc
  }, {}),
  stepsPresent: [...parts.EOTE_STEP_ORDER].every(id => Object.hasOwn(graph.nodes, id)),
  endPresent: Object.hasOwn(graph.nodes, 'end'),
  fatalMirageReturnPresent: Object.hasOwn(graph.nodes, 'fatalMirageReturn'),
  manifestFlowSame: JSON.stringify(manifest.flow) === JSON.stringify(graph),
}
// handlerEdges：从节点出发，穿透 story/choice/stepReturn 子图，收集下一个「可停留」节点
// （scenario/interlude/checkpoint/end），再与 audit scope 的 handler 出口集合比较。
function terminalTargets (startId, origin, visited = new Set()) {
  if (visited.has(startId)) return []
  visited.add(startId)
  const node = graph.nodes[startId]
  if (!node) return []
  if (startId !== origin && ['scenario', 'interlude', 'checkpoint', 'end'].includes(node.type)) return [startId]
  const nextIds = [
    ...(node.rules || []).map(rule => rule.next),
    ...(node.options || []).map(option => option.next),
    ...(node.next ? [node.next] : []),
  ].filter(Boolean)
  const out = []
  for (const nextId of nextIds) out.push(...terminalTargets(nextId, origin, visited))
  return [...new Set(out)]
}
for (const edge of cf.handlerEdges) {
  const node = graph.nodes[edge.from]
  if (!node) { report.handlerEdges.push({ id: edge.from, error: 'flow 缺少节点' }); continue }
  const targets = terminalTargets(edge.from, edge.from)
  const set = list => JSON.stringify([...list].sort())
  report.handlerEdges.push({ id: edge.from, scope: edge.targets, implemented: targets, setEqual: set(edge.targets) === set(targets) })
}

// 4) 混乱袋 vs 实际 CHAOS_BAGS
for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
  const expected = scope.chaosBags[difficulty].slice().sort()
  const implemented = [...CHAOS_BAGS[difficulty]].sort()
  report.chaosBags[difficulty] = { equal: JSON.stringify(expected) === JSON.stringify(implemented), size: implemented.length }
}

// 5) 序幕 token/记录
const prologueNode = graph.nodes.prologue
const prologuePrelude = graph.nodes.prologuePrelude
const believe = graph.nodes.prologueBelieve
const wild = graph.nodes.prologueWild
report.prologue = {
  scope: cf.prologueChaosTokens,
  implemented: [
    { branch: 'prologueBelieve', effects: believe?.effects, text: flow.rawEoteFlowNodes ? undefined : undefined },
    { branch: 'prologueWild', effects: wild?.effects },
  ].map(row => ({ branch: row.branch, effects: (row.effects || []).map(effect => ({ type: effect.type, key: effect.key, token: effect.token })) })),
  prologueHasCampaignStart: (prologueNode?.effects || []).some(effect => effect.type === 'registered' && effect.event === 'campaignStart'),
}

// 6) 指南来源清单
report.guideSources = {
  scopeCount: (scope.guideSources || []).length,
  scopeFiles: (scope.guideSources || []).map(source => source.path.split('/').slice(-2).join('/')),
  webGuideIds: fs.readdirSync('G:/boardgame-hall-ai/games/arkhamhorror/web/scenario-guides')
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace('.json', ''))
    .filter(id => ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage', 'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2'].includes(id))
    .sort(),
}
console.log(JSON.stringify(report, null, 1))

import { buildAuthoredScenarioGuide } from './authored-scenario-guide.mjs'

export function inspectChapter(scope, campaignId, manifest, readOptional) {
  if (!manifest) return { definition: 'unregistered', guideStatus: 'unregistered', guide: null }
  if (manifest.id !== scope.id || manifest.campaignId !== campaignId || manifest.referenceCode !== scope.code) {
    return { definition: 'identity-mismatch', guideStatus: 'unregistered', guide: null }
  }
  if (manifest.catalogReferenceOnly || manifest.status === 'catalog-only') {
    return { definition: 'catalog-only', guideStatus: 'unregistered', guide: null }
  }

  const sourcePath = `content/scenario-guide-sources/${scope.id}.json`
  const guidePath = `web/scenario-guides/${scope.id}.json`
  const readiness = { definition: 'registered', guideStatus: 'missing-source', guide: null }
  const source = readOptional(sourcePath)
  if (source === null) return readiness

  let expected
  try {
    expected = JSON.stringify(buildAuthoredScenarioGuide(manifest, JSON.parse(source)), null, 2) + '\n'
  } catch (error) {
    if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error
    return { ...readiness, guideStatus: 'invalid-source' }
  }
  const generated = readOptional(guidePath)
  if (generated === null) return { ...readiness, guideStatus: 'missing-output' }
  if (generated !== expected) return { ...readiness, guideStatus: 'stale-output' }
  return { ...readiness, guideStatus: 'ready', guide: guidePath }
}

export function inspectFlow(campaign, chapterIds) {
  const flow = campaign?.flow
  const reached = new Set()
  const chapters = new Set()
  const pending = flow ? [flow.start] : []
  let terminalReachable = false
  // The registry validates the graph. This traversal checks structural coverage;
  // conditions and effects still require gameplay tests on the actual routes.
  while (pending.length) {
    const id = pending.pop()
    if (reached.has(id) || !Object.hasOwn(flow.nodes, id)) continue
    reached.add(id)
    const node = flow.nodes[id]
    if (node.type === 'scenario') chapters.add(node.scenarioId)
    if (node.type === 'end') terminalReachable = true
    const branches = node.type === 'stepReturn' ? node.rules : node.options
    pending.push(...(branches || []).map(branch => branch.next))
    if (node.next) pending.push(node.next)
  }
  return {
    explicit: Boolean(flow), terminalReachable,
    reachableChapters: chapterIds.filter(id => chapters.has(id)),
    missingChapters: chapterIds.filter(id => !chapters.has(id)),
  }
}

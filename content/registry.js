import { assertContentBundle, assertLaunchableCampaign } from './schema.js'
import { campaignGraph, validateCampaignGraph } from '../src/campaign/campaign-flow.js'
import { RULES_VERSION } from '../src/engine/rules-state.js'
import { missingMechanics } from './mechanics.js'

// Registration is explicit. A new campaign or scenario adds an entry to the
// composition root; the engine and UI consume this API without name branches.
export function createContentRegistry({ packs, campaigns, scenarios }, rulesVersion = RULES_VERSION) {
  const entries = scenarios.map(entry => {
    if (!entry?.manifest || !entry?.scenario || !entry?.behavior) throw new TypeError('关卡注册项缺少 manifest、数据或行为')
    if (entry.manifest.id !== entry.scenario.id || entry.behavior.id !== entry.manifest.id) {
      throw new TypeError(`关卡注册 ID 不一致：${entry.manifest.id}`)
    }
    for (const id of entry.manifest.behaviorIds) {
      if (id !== entry.behavior.id) throw new TypeError(`关卡 ${entry.manifest.id} 缺少行为 ${id}`)
    }
    return entry
  })
  const manifests = { packs, campaigns, scenarios: entries.map(entry => entry.manifest) }
  const checked = assertContentBundle(manifests, rulesVersion)
  for (const campaign of campaigns) validateCampaignGraph(campaign)
  for (const entry of entries) {
    const declaredPacks = new Set([
      ...checked.campaigns.get(entry.manifest.campaignId).requiredPackIds,
      ...entry.manifest.requiredPackIds,
    ])
    const ownedCodes = new Set([...declaredPacks].flatMap(id => checked.packs.get(id).cards.map(card => card.code)))
    const neededCodes = [
      ...(entry.manifest.referenceCode ? [entry.manifest.referenceCode] : []),
      ...entry.manifest.locations.flatMap(location => [location.frontCode, location.backCode]),
      ...Object.values(entry.manifest.zones).flat().map(card => card.cardCode),
    ]
    for (const code of neededCodes) {
      const physicalCode = code.replace(/[a-z]$/, '')
      const linkedFaceOwned = physicalCode !== code && [...declaredPacks].some(id =>
        checked.packs.get(id).cardRanges.some(range =>
          physicalCode.length === range.from.length
          && physicalCode >= range.from && physicalCode <= range.to))
      if (!ownedCodes.has(code) && !ownedCodes.has(physicalCode) && !linkedFaceOwned) {
        throw new TypeError(`关卡 ${entry.manifest.id} 依赖的原卡 ${code} 未在所需卡包中`)
      }
    }
  }
  const byId = new Map(entries.map(entry => [entry.manifest.id, entry]))
  if (byId.size !== entries.length) throw new TypeError('重复关卡注册 ID')
  const requireScenario = id => {
    const entry = byId.get(id)
    if (!entry) throw new RangeError(`未知关卡 ${id}`)
    return entry
  }
  return Object.freeze({
    rulesVersion,
    listPacks: () => [...checked.packs.values()],
    listCampaigns: () => [...checked.campaigns.values()],
    listScenarios: campaignId => [...checked.scenarios.values()].filter(entry => !campaignId || entry.campaignId === campaignId),
    getPack: id => checked.packs.get(id) || null,
    getCampaign: id => checked.campaigns.get(id) || null,
    getScenario: id => requireScenario(id).manifest,
    getScenarioData: id => requireScenario(id).scenario,
    getBehavior: id => requireScenario(id).behavior,
    assertLaunchable: id => assertLaunchableCampaign(manifests, id, rulesVersion),
  })
}

export function campaignListForUi(registry) {
  return registry.listCampaigns().filter(campaign => {
    try { registry.assertLaunchable(campaign.id); return true } catch { return false }
  }).map(campaign => ({
    id: campaign.id, name: campaign.name, nameEn: campaign.nameEn, recordLabels: campaign.recordLabels || {},
    flow: campaignGraph(campaign),
    status: campaign.status,
    contentPacks: registry.listPacks().map(pack => ({
      id: pack.id, name: pack.name || pack.id, status: pack.status, description: pack.description,
      required: campaign.requiredPackIds.includes(pack.id),
      cards: pack.cards.filter(card => card.requiredMechanicIds).map(card => ({
        code: card.code, name: card.name, playable: card.deckbuilding && card.rulesImplemented && !card.blockedReason && !missingMechanics(card.requiredMechanicIds).length,
        blockedReason: card.blockedReason || (missingMechanics(card.requiredMechanicIds).length ? '缺少机制：' + missingMechanics(card.requiredMechanicIds).join('、') : null), requiredMechanicIds: card.requiredMechanicIds,
      })),
    })),
    scenarios: campaign.scenarioIds.map(id => ({ id, name: registry.getScenario(id).name })),
  }))
}

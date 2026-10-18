// 关卡卡图清单：列出某一关会用到的全部原卡（剧本参考、密谋、场景、地点、遭遇、放在一边的牌），
// 附带与图鉴相同的图片描述符，供浏览器在局外整备时预热卡图。只读、不触碰对局状态。

import { ALL_CARDS } from '../cards/cards-data.js'
import { imageDescriptor } from '../../presentation/images.js'
import { contentRegistry } from '../../content/registered.js'

const IDENTITY_KEYS = ['originalCode', 'linkedOriginalCode', 'code', 'cardCode', 'frontCode', 'backCode', 'referenceCode']

function collectCodes(value, add, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (!Array.isArray(value)) for (const key of IDENTITY_KEYS) if (typeof value[key] === 'string') add(value[key])
  for (const child of Array.isArray(value) ? value : Object.values(value)) collectCodes(child, add, seen)
}

/** 按展示优先级返回关卡涉及的原卡编号：剧本参考、密谋、场景、地点在前，遭遇牌在后。 */
export function scenarioCardCodes(scenarioId, registry = contentRegistry) {
  const manifest = registry.getScenario(scenarioId)
  const scenario = registry.getScenarioData(scenarioId)
  const codes = new Set()
  const add = code => { if (typeof code === 'string' && Object.hasOwn(ALL_CARDS, code)) codes.add(code) }
  add(manifest.referenceCode)
  add(scenario.originalCode)
  for (const stage of [...(scenario.agendas || []), ...(scenario.acts || [])]) add(stage.originalCode)
  for (const location of manifest.locations) { add(location.frontCode); add(location.backCode) }
  for (const entry of Object.values(manifest.zones).flat()) add(entry.cardCode)
  collectCodes(scenario, add)
  return [...codes]
}

export function scenarioImageManifest(scenarioId, registry = contentRegistry) {
  const cards = scenarioCardCodes(scenarioId, registry)
    .map(code => ({ code, images: imageDescriptor(code) }))
    .filter(entry => entry.images)
  return { scenarioId, cards }
}

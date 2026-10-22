// N2 展示资源运行时入口：把目录记录解析为可下发的卡图描述符。
//
// 只输出「有序候选路径 + 语言标记 + 候选来源」，不含主机、不含原始追溯记录，
// 也不声称远程图片已验证可用；主机由浏览器侧配置，失败回退由前端有限重试。

import { readFileSync, existsSync } from 'node:fs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildImageDescriptor, withExplicitArt, GENERIC_BACKS } from './art-rules.js'

// 本地图库清单：开发环境由 tools/fetch-images.mjs 生成 local-images.json；
// 发布版逻辑包只带非卡牌图片的清单，卡图资源包额外提供 local-images.cards.json。
// 清单缺失时退化为纯远程候选／文字兜底，不影响功能。
const localInventories = ['../audit/local-images.json', '../audit/local-images.cards.json']
  .map(path => new URL(path, import.meta.url))
  .filter(url => existsSync(url))
  .map(url => JSON.parse(readFileSync(url, 'utf8')))
const localPaths = new Set(localInventories.flatMap(inventory => inventory.files || []))
export const LOCAL_IMAGE_LIBRARY = Object.freeze({
  available: localPaths.size > 0,
  total: localInventories.reduce((sum, inventory) => sum + (inventory.total || 0), 0),
  bytes: localInventories.reduce((sum, inventory) => sum + (inventory.bytes || 0), 0),
  byLanguage: Object.freeze(localInventories.reduce((sum, inventory) => ({
    en: sum.en + (inventory.byLanguage?.en || 0),
    zh: sum.zh + (inventory.byLanguage?.zh || 0),
  }), { en: 0, zh: 0 })),
  fingerprint: localInventories.map(inventory => inventory.fingerprint).filter(Boolean).join('+') || null,
})

const localized = JSON.parse(readFileSync(new URL('./localized-arts.json', import.meta.url), 'utf8'))
const generatedLocalized = JSON.parse(readFileSync(new URL('./generated-localized-arts.json', import.meta.url), 'utf8'))
const mediaRegistry = JSON.parse(readFileSync(new URL('./media-registry.json', import.meta.url), 'utf8'))

export const LOCALIZED_ART_SOURCE = Object.freeze({ ...localized.source })
export const MEDIA_REGISTRY = Object.freeze(mediaRegistry)
const localizedArts = new Set([...localized.arts, ...generatedLocalized.arts])

// 关联面是双向关系，但目录只记录一侧；反向索引让「背面卡」也能找到自己的正面。
const linkedFronts = new Map()
for (const card of Object.values(ALL_CARDS)) {
  for (const linked of [card.linkedCardCode, card.linkedToCode]) {
    if (typeof linked !== 'string' || !linked || !Object.hasOwn(ALL_CARDS, linked)) continue
    if (!linkedFronts.has(linked)) linkedFronts.set(linked, card.code)
  }
}

const descriptors = new Map()

/** 给每个候选补 local／localLocalized 标记：本地有文件时前端可直接用同源地址，无需远程。 */
function annotateLocal(descriptor) {
  if (!descriptor || !localPaths.size) return descriptor
  for (const face of [descriptor.front, descriptor.back]) {
    for (const candidate of [...face.candidates, ...Object.values(face.variants || {})]) {
      candidate.local = localPaths.has(candidate.path)
      candidate.localLocalized = candidate.localized && localPaths.has('zh/' + candidate.path)
    }
  }
  return descriptor
}

export function imageDescriptor(code, { artId = null } = {}) {
  if (typeof code !== 'string' || !Object.hasOwn(ALL_CARDS, code)) return null
  if (!descriptors.has(code)) descriptors.set(code, annotateLocal(buildImageDescriptor(ALL_CARDS[code], { localizedArts, linkedFronts })))
  const descriptor = descriptors.get(code)
  if (!descriptor) return null
  return structuredClone(artId ? annotateLocal(withExplicitArt(descriptor, artId, { localizedArts })) : descriptor)
}

/** 图片状态：local＝本地已有文件可离线展示；remote-candidate＝只能按候选向远程请求。 */
export function imageResolution(code) {
  const descriptor = imageDescriptor(code)
  if (!descriptor) return { imageStatus: 'unresolved', localizedFront: false, hasBackArt: false, localFront: false }
  const localFront = descriptor.front.candidates.some(candidate => candidate.local || candidate.localLocalized)
  return {
    imageStatus: localFront ? 'local' : 'remote-candidate',
    localizedFront: descriptor.front.candidates.some(candidate => candidate.localized),
    hasBackArt: descriptor.hasBackArt,
    localFront,
  }
}

export function presentationStats() {
  const stats = {
    cards: 0,
    resolved: 0,
    unresolved: [],
    localizedFront: 0,
    withBackArt: 0,
    genericBack: { encounter: 0, player: 0 },
    candidateSources: {},
    frontCandidateCounts: {},
    revisedCoreReprints: [],
    localizedArtEntries: localizedArts.size,
    localMediaCopied: mediaRegistry.localCopies.length,
    remoteOnlyManifestEntries: mediaRegistry.remoteManifest.entries,
  }
  for (const code of Object.keys(ALL_CARDS).sort()) {
    stats.cards++
    const descriptor = imageDescriptor(code)
    if (!descriptor) { stats.unresolved.push(code); continue }
    stats.resolved++
    if (descriptor.front.candidates.some(candidate => candidate.localized)) stats.localizedFront++
    if (descriptor.hasBackArt) stats.withBackArt++
    else stats.genericBack[descriptor.back.candidates[0].path === GENERIC_BACKS.encounter ? 'encounter' : 'player']++
    const count = descriptor.front.candidates.length
    stats.frontCandidateCounts[count] = (stats.frontCandidateCounts[count] || 0) + 1
    for (const candidate of [...descriptor.front.candidates, ...descriptor.back.candidates]) {
      stats.candidateSources[candidate.source] = (stats.candidateSources[candidate.source] || 0) + 1
      if (candidate.source.includes('revised-core-reprint')) stats.revisedCoreReprints.push({ code, path: candidate.path })
    }
  }
  return stats
}

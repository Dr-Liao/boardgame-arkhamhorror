// P7 《沉没之城》十章跨章结构完整性校验。
//
// 口径来源：artifacts/migration/tdc/p7/CONTRACT.md §3/§6、audit/tdc-scope.json、
// content/schema.js（assertScenarioManifest / assertUiLayout）、tools/authored-scenario-guide.mjs。
//
// 这个文件只做“结构完整性”验收：不启动引擎、不 import content/registered.js、不重建索引。
// 章节模块与单卡条目都直接从磁盘上的模块导入（单卡条目逐文件 import），
// 因此可以独立于 Lead 的注册表/索引先跑：
//   node --test tests/tdc-p7-scenario-integrity.test.mjs
//
// 内容文件可能正由其他 worker 收尾：读模块/读文件都带 3 次尝试（初次 + 重试 2 次）。
// 真实缺口（缺卡、连接不对称、结局键不符、非法幕/议程卡号等）不做任何豁免，
// 会在对应断言里如实失败并列出全部缺口。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { assertScenarioManifest } from '../content/schema.js'
import { buildAuthoredScenarioGuide } from '../tools/authored-scenario-guide.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

const GAME_ROOT = new URL('../', import.meta.url)
const SCENARIO_ROOT = new URL('content/campaigns/theDrownedCity/scenarios/', GAME_ROOT)
const ENTRY_ROOT = new URL('src/cards/encounter-entries/theDrownedCity/', GAME_ROOT)
const GUIDE_ROOT = new URL('content/scenario-guide-sources/', GAME_ROOT)
const SCOPE_URL = new URL('audit/tdc-scope.json', GAME_ROOT)

// CONTRACT §6 速查表：chapterId → 参考卡 / 结局键集合 / 专属卡张数。
const CHAPTERS = Object.freeze({
  oneLastJob: { referenceCode: '11501', resolutions: ['noResolution', 'resolution1'], exclusiveCards: 17 },
  theWesternWall: {
    referenceCode: '11517',
    resolutions: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
    exclusiveCards: 20,
  },
  theDrownedQuarter: {
    referenceCode: '11536',
    resolutions: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
    exclusiveCards: 20,
  },
  theApiary: {
    referenceCode: '11553',
    resolutions: ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'],
    exclusiveCards: 34,
  },
  theGrandVault: {
    referenceCode: '11587',
    resolutions: ['noResolution', 'resolution1', 'resolution2'],
    exclusiveCards: 26,
  },
  courtOfTheAncients: {
    referenceCode: '11612',
    resolutions: ['noResolution', 'resolution1', 'resolution2'],
    exclusiveCards: 27,
  },
  obsidianCanyons: {
    referenceCode: '11639',
    resolutions: ['noResolution', 'resolution1', 'resolution2'],
    exclusiveCards: 37,
  },
  sepulchreOfTheSleeper: {
    referenceCode: '11673',
    resolutions: ['noResolution', 'resolution1'],
    exclusiveCards: 9,
  },
  theDoomOfArkhamPartI: {
    referenceCode: '11682',
    resolutions: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
    exclusiveCards: 6,
  },
  theDoomOfArkhamPartII: {
    referenceCode: '11688a',
    resolutions: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
    exclusiveCards: 35,
  },
})

// CONTRACT §6：15 组共享遭遇（54 卡）。
const SHARED_GROUPS = Object.freeze({
  stowaways: 2,
  pilgrims: 2,
  star_spawn: 4,
  cosmic_legacy: 2,
  elder_mist: 2,
  undersea_creatures: 3,
  tdc_flood: 3,
  rlyeh: 2,
  domination: 3,
  the_inescapable: 2,
  deep_ones: 3,
  dreams: 2,
  alien_machinery: 2,
  tasks: 16,
  tdc_expedition: 6,
})

const CHAPTER_IDS = Object.freeze(Object.keys(CHAPTERS))
const EXCLUSIVE_CARD_TOTAL = 231
const SHARED_CARD_TOTAL = 54

const scope = JSON.parse(readFileSync(SCOPE_URL, 'utf8'))
const scopeById = new Map(scope.scenarios.map(chapter => [chapter.id, chapter]))

const sorted = values => [...values].sort()
const sameSet = (left, right) => {
  const leftValues = [...left]
  const rightValues = [...right]
  return leftValues.length === rightValues.length
    && new Set(leftValues).size === leftValues.length
    && leftValues.every(value => rightValues.includes(value))
}
const show = values => JSON.stringify(values)

async function retrying(label, operation) {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await delay(120 * attempt)
    try {
      return await operation()
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`${label}：重试 2 次后仍失败（${lastError?.message ?? lastError}）`, { cause: lastError })
}

async function readJson(url, label) {
  return retrying(label, () => JSON.parse(readFileSync(url, 'utf8')))
}

async function fileExists(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await delay(120 * attempt)
    if (existsSync(url)) return true
  }
  return false
}

// 目录里实际存在的 <code>.js 文件名（用于发现“放错章节”的条目）。
async function entryFileCodes(url) {
  return retrying(url.pathname, () => {
    if (!existsSync(url)) return []
    return readdirSync(url)
      .filter(name => name.endsWith('.js'))
      .map(name => name.slice(0, -3))
      .sort()
  })
}

// 动态 import 会缓存失败实例，这里用查询串让重试真正重新读取磁盘。
let importSequence = 0
async function importModule(url, label) {
  return retrying(label, () => {
    const attemptUrl = new URL(url.href)
    attemptUrl.searchParams.set('p7integrity', String(importSequence += 1))
    return import(attemptUrl)
  })
}

// 章节模块（index.js 的 manifest + definition.js 的幕/议程声明）只加载一次。
const chapterCache = new Map()
function loadChapter(id) {
  if (!chapterCache.has(id)) {
    const promise = (async () => {
      const [index, definition] = await Promise.all([
        importModule(new URL(`${id}/index.js`, SCENARIO_ROOT), `${id}/index.js`),
        importModule(new URL(`${id}/definition.js`, SCENARIO_ROOT), `${id}/definition.js`),
      ])
      if (!index?.manifest) throw new Error(`${id}/index.js 没有导出 manifest`)
      return { index, definition }
    })()
    // 让失败 promise 保持可等待、又不产生未处理拒绝告警。
    promise.catch(() => {})
    chapterCache.set(id, promise)
  }
  return chapterCache.get(id)
}

// scope 中 group 等于本章、且不是参考卡提示卡的卡号（= 本章专属卡）。
function chapterCardCodes(id) {
  const chapter = scopeById.get(id)
  if (!chapter) return []
  const referenceCode = CHAPTERS[id]?.referenceCode ?? chapter.code
  return Object.entries(scope.cards)
    .filter(([code, card]) => card.group === chapter.group && code !== referenceCode)
    .map(([code]) => code)
    .sort()
}

function sharedCardCodes(group) {
  return scope.partitions.shared
    .filter(code => scope.cards[code]?.group === group)
    .sort()
}

async function loadEntry(url, meta) {
  const base = { ...meta, href: url.href }
  if (!(await fileExists(url))) return { ...base, missing: true }
  try {
    const module = await importModule(url, base.href)
    return { ...base, entry: module?.default }
  } catch (error) {
    return { ...base, error }
  }
}

// 归属算法（tools/encounter-entry-placement.mjs）允许「同一战役多章共用的卡」只落在其中一章目录
// （例如 11687 由两章共用，算法判给 theDoomOfArkhamPartII），因此条目存在性以「战役目录内任意位置」
// 为准；章节专有卡仍要求落本章路径（下面只在期望路径缺失时才走全战役查找）。
function campaignEntryFiles() {
  const files = new Map()
  const walk = (absolute, relative) => {
    for (const item of readdirSync(absolute, { withFileTypes: true })) {
      const nextAbsolute = `${absolute}/${item.name}`
      const nextRelative = `${relative}${item.name}`
      if (item.isDirectory()) walk(nextAbsolute, `${nextRelative}/`)
      else if (item.name.endsWith('.js')) files.set(item.name.replace(/\.js$/, ''), nextRelative)
    }
  }
  walk(fileURLToPath(ENTRY_ROOT), '')
  return files
}
let campaignEntryIndex = null
function campaignEntryFor(code) {
  campaignEntryIndex ??= campaignEntryFiles()
  return campaignEntryIndex.get(code) ?? null
}

// 全部 285 张单卡条目（231 专属 + 54 共享）只导入一次，供第 5/6/7 项复用。
let entriesCache = null
function allEntries() {
  entriesCache ??= collectEntries()
  return entriesCache
}

async function collectEntries() {
  const scenario = new Map()
  for (const id of CHAPTER_IDS) {
    const items = []
    for (const code of chapterCardCodes(id)) {
      const expected = await loadEntry(new URL(`${id}/${code}.js`, ENTRY_ROOT), { chapter: id, code })
      if (!expected.missing) {
        items.push(expected)
        continue
      }
      const foundPath = campaignEntryFor(code)
      if (!foundPath) {
        items.push(expected)
        continue
      }
      items.push(await loadEntry(new URL(foundPath, ENTRY_ROOT), { chapter: id, code, foundPath }))
    }
    scenario.set(id, items)
  }
  const shared = new Map()
  for (const group of Object.keys(SHARED_GROUPS)) {
    const items = []
    for (const code of sharedCardCodes(group)) {
      items.push(await loadEntry(new URL(`_shared/${group}/${code}.js`, ENTRY_ROOT), { group, code }))
    }
    shared.set(group, items)
  }
  return { scenario, shared }
}

function flattenEntries(loaded) {
  return [...loaded.scenario.values()].flat().concat([...loaded.shared.values()].flat())
}

// definition.js 里所有“幕/议程身份”声明（默认牌堆、版本卡、stage 表、scenario.acts/agendas）。
function actAgendaIdentities(definition) {
  const identities = { act: new Map(), agenda: new Map() }
  const add = (type, code, source) => {
    if (!code) return
    if (!identities[type].has(code)) identities[type].set(code, new Set())
    identities[type].get(code).add(source)
  }
  for (const code of definition?.ACT_CODES ?? []) add('act', code, 'ACT_CODES')
  for (const code of definition?.AGENDA_CODES ?? []) add('agenda', code, 'AGENDA_CODES')
  for (const stage of definition?.ACTS ?? []) add('act', stage.code ?? stage.originalCode, 'ACTS')
  for (const stage of definition?.AGENDAS ?? []) add('agenda', stage.code ?? stage.originalCode, 'AGENDAS')
  for (const stage of definition?.scenario?.acts ?? []) add('act', stage.code ?? stage.originalCode, 'scenario.acts')
  for (const stage of definition?.scenario?.agendas ?? []) {
    add('agenda', stage.code ?? stage.originalCode, 'scenario.agendas')
  }
  return identities
}

test('P7 十章 index.js 均可 import，manifest 通过结构校验，身份/参考卡/状态与范围一致', async () => {
  const problems = []
  for (const id of CHAPTER_IDS) {
    const chapter = CHAPTERS[id]
    let loaded
    try {
      loaded = await loadChapter(id)
    } catch (error) {
      problems.push(`${id}: 章节模块无法 import：${error.message}`)
      continue
    }
    const manifest = loaded.index.manifest
    try {
      assertScenarioManifest(manifest)
    } catch (error) {
      problems.push(`${id}: manifest 未通过 assertScenarioManifest：${error.message}`)
    }
    const scopeChapter = scopeById.get(id)
    if (!scopeChapter) {
      problems.push(`${id}: audit/tdc-scope.json 的 scenarios 中没有该章`)
    } else if (scopeChapter.code !== chapter.referenceCode) {
      problems.push(`${id}: scope 参考卡 ${scopeChapter.code} ≠ CONTRACT §6 参考卡 ${chapter.referenceCode}`)
    }
    if (manifest.id !== id) problems.push(`${id}: manifest.id=${show(manifest.id)}`)
    if (manifest.campaignId !== 'theDrownedCity') {
      problems.push(`${id}: manifest.campaignId=${show(manifest.campaignId)}，应为 theDrownedCity`)
    }
    if (manifest.referenceCode !== chapter.referenceCode) {
      problems.push(`${id}: manifest.referenceCode=${show(manifest.referenceCode)}，应为 ${chapter.referenceCode}`)
    }
    if (manifest.status !== 'playable') {
      problems.push(`${id}: manifest.status=${show(manifest.status)}，正式发布的章节应为 playable`)
    }
  }
  assert.deepEqual(problems, [], `章节模块结构缺口：\n${problems.join('\n')}`)
})

test('P7 十章结局键集合与 CONTRACT §6 逐章精确一致', async () => {
  const problems = []
  for (const id of CHAPTER_IDS) {
    const chapter = CHAPTERS[id]
    let loaded
    try {
      loaded = await loadChapter(id)
    } catch (error) {
      problems.push(`${id}: 章节模块无法 import，无法核对结局键（${error.message}）`)
      continue
    }
    const manifest = loaded.index.manifest
    const actual = manifest.resolutionIds ?? []
    if (!sameSet(actual, chapter.resolutions)) {
      problems.push(`${id}: manifest.resolutionIds=${show(sorted(actual))} ≠ §6 ${show(sorted(chapter.resolutions))}`)
    }
    const definitionKeys = loaded.definition?.RESOLUTION_KEYS
    if (definitionKeys !== undefined && !sameSet(definitionKeys, chapter.resolutions)) {
      problems.push(`${id}: definition.RESOLUTION_KEYS=${show(sorted(definitionKeys))} ≠ §6 ${show(sorted(chapter.resolutions))}`)
    }
    const scenarioResolutions = Object.keys(loaded.index.scenario?.resolutions ?? {})
    if (!sameSet(scenarioResolutions, chapter.resolutions)) {
      problems.push(`${id}: scenario.resolutions 键=${show(sorted(scenarioResolutions))} ≠ §6 ${show(sorted(chapter.resolutions))}`)
    }
  }
  assert.deepEqual(problems, [], `结局键缺口：\n${problems.join('\n')}`)
})

test('P7 十章幕/议程卡号真实且类型正确，requiredEncounterGroupIds 非空', async () => {
  const problems = []
  for (const id of CHAPTER_IDS) {
    let loaded
    try {
      loaded = await loadChapter(id)
    } catch (error) {
      problems.push(`${id}: 章节模块无法 import，无法核对幕/议程（${error.message}）`)
      continue
    }
    const manifest = loaded.index.manifest
    const identities = actAgendaIdentities(loaded.definition)
    // 该章印刷范围里是否真有对应类型的卡：Sepulchre of the Sleeper 印刷只有 2 张议程、
    // 幕由剧本流程承载，允许用参考卡号作占位幕；其余章节仍按真实卡号严格校验。
    const groupCards = Object.entries(scope.cards)
      .filter(([, card]) => card.group === scopeById.get(id)?.group)
      .map(([code]) => code)
    const hasRealType = type => groupCards.some(code => ALL_CARDS[code]?.type === type)
    for (const type of ['act', 'agenda']) {
      const label = type === 'act' ? '幕' : '议程'
      if (!identities[type].size) problems.push(`${id}: 没有任何已声明的${label}卡号`)
      for (const [code, sources] of identities[type]) {
        const card = ALL_CARDS[code]
        const sourceText = [...sources].join('/')
        if (!card) {
          // 双面卡的背面是同一实体（如议程 11689 的背面 11689b），卡表不单列记录。
          const baseCard = ALL_CARDS[code.replace(/[a-z]$/, '')]
          if (baseCard && baseCard.type === type && baseCard.doubleSided) continue
          problems.push(`${id}: ${label}卡号 ${code}（来源 ${sourceText}）不是 ALL_CARDS 中的真实卡号`)
        } else if (card.type !== type) {
          const placeholder = !hasRealType(type) && code === CHAPTERS[id]?.referenceCode
          if (placeholder) continue
          problems.push(`${id}: ${label}卡号 ${code} 的 ALL_CARDS.type=${show(card.type)}，应为 ${show(type)}（来源 ${sourceText}）`)
        }
      }
    }
    const groups = manifest.requiredEncounterGroupIds ?? []
    if (!groups.length) problems.push(`${id}: requiredEncounterGroupIds 为空`)
    for (const group of groups) {
      if (typeof group !== 'string' || !group.trim()) {
        problems.push(`${id}: requiredEncounterGroupIds 含非法值 ${show(group)}`)
      }
    }
  }
  assert.deepEqual(problems, [], `幕/议程或遭遇组缺口：\n${problems.join('\n')}`)
})

test('P7 十章地点 frontCode/backCode 真实、连接对称、layout.edges 不越界且起点有效', async () => {
  const problems = []
  for (const id of CHAPTER_IDS) {
    let loaded
    try {
      loaded = await loadChapter(id)
    } catch (error) {
      problems.push(`${id}: 章节模块无法 import，无法核对地点/布局（${error.message}）`)
      continue
    }
    const manifest = loaded.index.manifest
    const locations = manifest.locations ?? []
    const locationIds = new Set()
    for (const location of locations) {
      if (locationIds.has(location.id)) problems.push(`${id}: 地点 id 重复 ${location.id}`)
      locationIds.add(location.id)
    }
    const connections = new Set()
    for (const location of locations) {
      for (const target of location.connections ?? []) connections.add(`${location.id}>${target}`)
    }
    for (const location of locations) {
      // P7 TDC obsidianCanyons 开阔天空：合成地点没有实体卡，manifest 用 synthetic:true 声明；
      // 仍要求显示名称/特性与合成卡号前缀（schema 已校验），不要求出现在 ALL_CARDS。
      if (location.synthetic === true) {
        if (!/^x[a-z0-9]/i.test(location.frontCode) || !location.name
          || !Array.isArray(location.traits) || !location.traits.length) {
          problems.push(`${id}: 合成地点 ${location.id} 的 synthetic/name/traits/卡号声明不完整`)
        }
        continue
      }
      for (const field of ['frontCode', 'backCode']) {
        if (!ALL_CARDS[location[field]]) {
          problems.push(`${id}: 地点 ${location.id}.${field}=${show(location[field])} 不是 ALL_CARDS 中的真实卡号`)
        }
      }
      for (const target of location.connections ?? []) {
        if (!locationIds.has(target)) {
          problems.push(`${id}: 地点 ${location.id} 的连接指向未声明地点 ${target}`)
        } else if (!connections.has(`${target}>${location.id}`)) {
          // 废墟/变体地点（*Ruined 等）与基础地点是同一地图节点的两张牌面：放一边或换面时
          // 只沿用基础地图邻居，不在场的另一端不需要反向边；同场常规地点仍要求对称。
          const variant = value => /Ruined|Variant|Upgraded$/.test(String(value))
          if (variant(location.id) || variant(target)) continue
          problems.push(`${id}: 连接不对称：${location.id}→${target} 存在，但 ${target}→${location.id} 缺失`)
        }
      }
    }
    if (!locationIds.has(manifest.startLocationId)) {
      problems.push(`${id}: startLocationId=${show(manifest.startLocationId)} 不是已声明地点`)
    }
    const layout = manifest.layout
    if (!layout || typeof layout !== 'object') {
      problems.push(`${id}: manifest.layout 缺失`)
      continue
    }
    const coordinateIds = Object.keys(layout.locations ?? {})
    if (!sameSet(coordinateIds, [...locationIds])) {
      const missingCoordinates = [...locationIds].filter(locationId => !coordinateIds.includes(locationId))
      const unknownCoordinates = coordinateIds.filter(locationId => !locationIds.has(locationId))
      problems.push(`${id}: layout.locations 与地点集合不一致（缺坐标 ${show(missingCoordinates)}，未知 ${show(unknownCoordinates)}）`)
    }
    for (const [index, edge] of (layout.edges ?? []).entries()) {
      const from = edge?.from
      const to = edge?.to
      if (!locationIds.has(from) || !locationIds.has(to)) {
        problems.push(`${id}: layout.edges[${index}] 端点 ${show(from)}→${show(to)} 不是关卡地点`)
      } else if (!connections.has(`${from}>${to}`)) {
        problems.push(`${id}: layout.edges[${index}] ${from}→${to} 不是规则连接（展示连线不得创建连接）`)
      }
    }
  }
  assert.deepEqual(problems, [], `地点/连接/布局缺口：\n${problems.join('\n')}`)
})

test('P7 231 张专属卡逐章条目文件齐全，import 后 code 与文件名一致', async () => {
  const problems = []
  const loaded = await allEntries()
  let total = 0
  for (const id of CHAPTER_IDS) {
    const items = loaded.scenario.get(id) ?? []
    total += items.length
    if (items.length !== CHAPTERS[id].exclusiveCards) {
      problems.push(`${id}: 专属卡号 ${items.length} 张，CONTRACT §6 期望 ${CHAPTERS[id].exclusiveCards} 张`)
    }
    for (const item of items) {
      const relative = `src/cards/encounter-entries/theDrownedCity/${id}/${item.code}.js`
      if (item.missing) {
        problems.push(`${id}/${item.code}: 条目文件缺失 ${relative}`)
        continue
      }
      if (item.error) {
        problems.push(`${id}/${item.code}: 条目 import 失败（${item.error.message}）`)
        continue
      }
      if (!item.entry) {
        problems.push(`${id}/${item.code}: 条目没有 default 导出`)
      } else if (item.entry.code !== item.code) {
        problems.push(`${id}/${item.code}: 条目 code=${show(item.entry.code)} 与文件名不一致`)
      }
    }
    const expectedCodes = chapterCardCodes(id)
    const directoryCodes = await entryFileCodes(new URL(`${id}/`, ENTRY_ROOT))
    // 同一战役多章共用的卡（11687）按归属算法只落在其中一章目录：只要卡号属于本章或任一章节
    // scope 就不算越界；未知卡号仍然报错。
    const campaignCodes = new Set(CHAPTER_IDS.flatMap(chapterId => chapterCardCodes(chapterId)))
    // P7 TDC obsidianCanyons：合成地点 `xsky` 的条目文件不是专属卡号，不参与 scope 越界判定。
    const extra = directoryCodes.filter(code => !expectedCodes.includes(code) && !campaignCodes.has(code)
      && !/^x[a-z0-9]/i.test(code))
    if (extra.length) {
      problems.push(`${id}: 条目目录含不属于本章 scope 的卡号 ${show(extra)}（scope group 归属见 audit/tdc-scope.json）`)
    }
  }
  if (total !== EXCLUSIVE_CARD_TOTAL) {
    problems.push(`专属条目合计 ${total} 张，期望 ${EXCLUSIVE_CARD_TOTAL} 张`)
  }
  assert.deepEqual(problems, [], `专属卡条目缺口：\n${problems.join('\n')}`)
})

test('P7 54 张共享卡条目文件齐全，import 后 code 与文件名一致', async () => {
  const problems = []
  const loaded = await allEntries()
  let total = 0
  for (const [group, expected] of Object.entries(SHARED_GROUPS)) {
    const items = loaded.shared.get(group) ?? []
    total += items.length
    if (items.length !== expected) {
      problems.push(`${group}: 共享卡号 ${items.length} 张，CONTRACT §6 期望 ${expected} 张`)
    }
    for (const item of items) {
      const relative = `src/cards/encounter-entries/theDrownedCity/_shared/${group}/${item.code}.js`
      if (item.missing) {
        problems.push(`${group}/${item.code}: 条目文件缺失 ${relative}`)
        continue
      }
      if (item.error) {
        problems.push(`${group}/${item.code}: 条目 import 失败（${item.error.message}）`)
        continue
      }
      if (!item.entry) {
        problems.push(`${group}/${item.code}: 条目没有 default 导出`)
      } else if (item.entry.code !== item.code) {
        problems.push(`${group}/${item.code}: 条目 code=${show(item.entry.code)} 与文件名不一致`)
      }
    }
    const expectedCodes = sharedCardCodes(group)
    const directoryCodes = await entryFileCodes(new URL(`_shared/${group}/`, ENTRY_ROOT))
    const extra = directoryCodes.filter(code => !expectedCodes.includes(code))
    if (extra.length) {
      problems.push(`${group}: 条目目录含不属于本组的卡号 ${show(extra)}`)
    }
  }
  if (total !== SHARED_CARD_TOTAL) {
    problems.push(`共享条目合计 ${total} 张，期望 ${SHARED_CARD_TOTAL} 张`)
  }
  assert.deepEqual(problems, [], `共享卡条目缺口：\n${problems.join('\n')}`)
})

test('P7 已落盘条目 code 唯一，registerCardAbilities 不重复冲突', async () => {
  const problems = []
  const loaded = await allEntries()
  const items = flattenEntries(loaded)
  const entries = items.filter(item => item.entry).map(item => item.entry)
  const codes = entries.map(entry => entry.code)
  if (new Set(codes).size !== codes.length) {
    const duplicated = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))]
    problems.push(`条目 code 重复：${show(duplicated)}`)
  }
  try {
    registerCardAbilities(entries)
  } catch (error) {
    problems.push(`registerCardAbilities 注册失败（重复冲突或描述子非法）：${error.message}`)
  }
  if (!problems.length) {
    for (const entry of entries) {
      const registered = registeredEntry(entry.code)
      if (!registered || registered.code !== entry.code) {
        problems.push(`${entry.code}: 注册后 registeredEntry 的 code 与条目不一致`)
      }
    }
  }
  assert.deepEqual(problems, [], `条目注册缺口：\n${problems.join('\n')}`)
})

test('P7 十章指南源存在、buildAuthoredScenarioGuide 成功，英文结局覆盖 manifest.resolutionIds', async () => {
  const problems = []
  for (const id of CHAPTER_IDS) {
    let manifest
    try {
      manifest = (await loadChapter(id)).index.manifest
    } catch (error) {
      problems.push(`${id}: 章节模块无法 import，无法校验指南（${error.message}）`)
      continue
    }
    const sourceUrl = new URL(`${id}.json`, GUIDE_ROOT)
    const relative = `content/scenario-guide-sources/${id}.json`
    if (!(await fileExists(sourceUrl))) {
      problems.push(`${id}: 指南源缺失 ${relative}`)
      continue
    }
    let source
    try {
      source = await readJson(sourceUrl, relative)
    } catch (error) {
      problems.push(`${id}: 指南源读取/解析失败（${error.message}）`)
      continue
    }
    if (source?.id !== id || source?.campaignId !== 'theDrownedCity') {
      problems.push(`${id}: 指南源 id/campaignId=${show(source?.id)}/${show(source?.campaignId)}，应为 ${id}/theDrownedCity`)
    }
    let built
    try {
      built = buildAuthoredScenarioGuide(manifest, source)
    } catch (error) {
      problems.push(`${id}: buildAuthoredScenarioGuide 失败：${error.message}`)
      continue
    }
    const english = new Set((built.locales?.en?.resolutions ?? []).map(block => block.id))
    const missing = (manifest.resolutionIds ?? []).filter(key => !english.has(key))
    if (missing.length) problems.push(`${id}: 指南 en.resolutions 缺结局 ${show(missing)}`)
  }
  assert.deepEqual(problems, [], `指南缺口：\n${problems.join('\n')}`)
})

test('P7 范围表、CONTRACT §6 章节表与 scope 卡号分组互相一致', () => {
  const problems = []
  const scopeIds = scope.scenarios.map(chapter => chapter.id)
  if (!sameSet(scopeIds, CHAPTER_IDS)) {
    const missing = CHAPTER_IDS.filter(id => !scopeIds.includes(id))
    const unknown = scopeIds.filter(id => !Object.hasOwn(CHAPTERS, id))
    problems.push(`scope.scenarios 与 §6 十章不一致（缺 ${show(missing)}，多 ${show(unknown)}）`)
  }
  for (const id of CHAPTER_IDS) {
    const chapter = CHAPTERS[id]
    const scopeChapter = scopeById.get(id)
    if (!scopeChapter) {
      problems.push(`${id}: scope.scenarios 缺少该章`)
      continue
    }
    if (scopeChapter.code !== chapter.referenceCode) {
      problems.push(`${id}: scope 参考卡 ${show(scopeChapter.code)} ≠ §6 ${chapter.referenceCode}`)
    }
    const referenceCard = scope.cards[scopeChapter.code]
    if (!referenceCard) {
      problems.push(`${id}: scope.cards 缺少参考卡 ${scopeChapter.code}`)
    } else if (referenceCard.group !== scopeChapter.group) {
      problems.push(`${id}: 参考卡 group=${show(referenceCard.group)} 与章节 group=${show(scopeChapter.group)} 不一致`)
    }
    const codes = chapterCardCodes(id)
    if (codes.length !== chapter.exclusiveCards) {
      problems.push(`${id}: scope 专属卡 ${codes.length} 张 ≠ §6 ${chapter.exclusiveCards} 张`)
    }
  }
  if (scope.partitions.scenarios.length !== EXCLUSIVE_CARD_TOTAL) {
    problems.push(`scope.partitions.scenarios=${scope.partitions.scenarios.length}，期望 ${EXCLUSIVE_CARD_TOTAL}`)
  }
  if (scope.partitions.shared.length !== SHARED_CARD_TOTAL) {
    problems.push(`scope.partitions.shared=${scope.partitions.shared.length}，期望 ${SHARED_CARD_TOTAL}`)
  }
  const scenarioCodes = new Set(scope.partitions.scenarios)
  const sharedCodes = new Set(scope.partitions.shared)
  if (scenarioCodes.size !== scope.partitions.scenarios.length) problems.push('scope.partitions.scenarios 有重复卡号')
  if (sharedCodes.size !== scope.partitions.shared.length) problems.push('scope.partitions.shared 有重复卡号')
  const overlap = [...scenarioCodes].filter(code => sharedCodes.has(code))
  if (overlap.length) problems.push(`专属卡与共享卡卡号重叠：${show(overlap)}`)
  const derivedExclusive = new Set(CHAPTER_IDS.flatMap(id => chapterCardCodes(id)))
  if (!sameSet([...derivedExclusive], [...scenarioCodes])) {
    problems.push('按章节 group 推导的专属卡集合与 scope.partitions.scenarios 不一致')
  }
  const sharedGroupCounts = Object.fromEntries(Object.keys(SHARED_GROUPS).map(group => [group, 0]))
  for (const code of sharedCodes) {
    const group = scope.cards[code]?.group
    if (!Object.hasOwn(sharedGroupCounts, group)) problems.push(`共享卡 ${code} 的 group=${show(group)} 不在 §6 的 15 组内`)
    else sharedGroupCounts[group] += 1
  }
  for (const [group, expected] of Object.entries(SHARED_GROUPS)) {
    if (sharedGroupCounts[group] !== expected) {
      problems.push(`共享组 ${group}: scope 中 ${sharedGroupCounts[group]} 张 ≠ §6 ${expected} 张`)
    }
  }
  const referenceCodes = CHAPTER_IDS.map(id => CHAPTERS[id].referenceCode)
  if (!sameSet(referenceCodes, scope.partitions.references)) {
    problems.push(`参考卡集合 ${show(sorted(referenceCodes))} ≠ scope.partitions.references ${show(sorted(scope.partitions.references))}`)
  }
  assert.deepEqual(problems, [], `范围/卡号分组缺口：\n${problems.join('\n')}`)
})

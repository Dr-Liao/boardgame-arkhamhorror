#!/usr/bin/env node
// 八循环《绯红密钥》（The Scarlet Keys）P0（M0）范围与来源账本：P1 的唯一事实源。
//
//   node tools/scan-tsk-scope.mjs --write   生成 audit/tsk-scope.json（并镜像 artifacts/migration/tsk/scope.json）
//   node tools/scan-tsk-scope.mjs --check   复算并与磁盘逐字节比对（来源 / 归属 / 数据变化即失败）
//   node tools/scan-tsk-scope.mjs           打印 JSON（report 模式，不写盘；门禁失败时仍然抛错退出非零）
//
// 口径（docs/campaign/theScarletKeys/README.md §2/§4/§5）：
//   · 439 条印刷记录 = 369 主卡 + 70 关联面，398 个物理卡位；三包 311 / 20 / 108，无重叠、无遗漏；
//   · 26 个遭遇组 = 10 个单章组 + 16 个跨章 / 战役级共享组，组卡合计 311 条记录；
//   · 10 章 = 10 张印刷提示卡（09501/09520/09545/09566/09591/09609/09635/09660/09681/09694）；
//   · 10 把双面绯红密钥（a = Stable / b = Unstable）+ 1 把范围外 fof 密钥 88045；
//   · 16 张定制升级卡（Customizable），逐卡记录勾选项（□ 数量 = 该项经验值）；
//   · 来源逐文件锁 SHA-256（referenceFiles() 当前 427 个文件），基线嵌入 audit/tsk-baseline.json；
//   · 世界地图 36 节点、四档混乱袋、状况报告 α–ω、17 段幕间（1 + 14–55）、尾声分支均从参考实现复算。
//
// 状态不手写：三包清单读 content/packs/tsk*/manifest.js，卡号归属 / 章节 / 遭遇组 / 混乱袋 / 地图读
// content/campaigns/theScarletKeys/shared.js；参考实现与剧情只读，本工具只复算、对账，把不一致写成 gate。
// 时间戳与 gitHead 不入本账本（提交会变，账本要能长期复算）；基线快照另存 audit/tsk-baseline.json。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_NAME_ZH, CAMPAIGN_SOURCE_CODE, CANDIDATE_RANGES, CARD_PARTITIONS,
  CHAOS_BAGS, CHAPTER_ENCOUNTER_GROUPS, CHAPTER_MAP_TRIGGERS, CUSTOMIZABLE_CODES, CYCLE_CODES,
  DYNAMIC_STATUS_REPORTS, ENCOUNTER_GROUP_CODES, ENCOUNTER_GROUP_NAMES, ENCOUNTER_GROUPS,
  EXTERNAL_ENCOUNTER_DEPENDENCIES, EXTERNAL_KEY_CARD_CODE, FORCED_ENDGAME_TIME, GREEN_LOCATIONS, INITIAL_UNLOCKED,
  INTERLUDES, INVALID_CAMPAIGN_CARDS, INVESTIGATOR_CODES, KEY_CARDS, KEY_IDS, SCENARIO_REFERENCE_CODES,
  SHARED_ENCOUNTER_GROUPS, SIGNATURE_CODES, SIDE_STORY_LOCATIONS, START_LOCATION, STATUS_REPORTS, WORLD_MAP,
  WORLD_MAP_IDS, chapters, isLinkedFaceCode, isMainCardCode, toCamelCase,
} from '../content/campaigns/theScarletKeys/shared.js'
import { manifest as campaignPackManifest } from '../content/packs/tskCampaign/manifest.js'
import { manifest as investigatorsPackManifest } from '../content/packs/tskInvestigators/manifest.js'
import { manifest as playerPackManifest } from '../content/packs/tskPlayer/manifest.js'
import { MOD, REFERENCE, emit, readJson, referenceFiles, sha, sourceLock } from './tsk-migration-lib.mjs'

const REFERENCE_ROOT = '参考资源/ArkhamHorror-main'
const DOCS = 'docs/campaign/theScarletKeys/README.md'
// 参考来源文件清单只解析一次：sources 锁哈希与隐匿迷你卡的引用统计共用同一份。
const referencePaths = referenceFiles()
const CAMPAIGN_SOURCE = 'backend/arkham-api/library/Arkham/Campaign/Campaigns/TheScarletKeys.hs'
const CAMPAIGN_STEPS_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/CampaignSteps.hs'
const HELPERS_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/Helpers.hs'
const META_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/Meta.hs'
const CONCEALED_KIND_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/Concealed/Kind.hs'
const KEY_CARDS_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/Key/Cards.hs'
const RED_COTERIE_SOURCE = 'backend/arkham-api/library/Arkham/Enemy/CardDefs/TheScarletKeys/RedCoterie.hs'
const SCENARIO_DIR = 'backend/arkham-api/library/Arkham/Scenario/Scenarios/TheScarletKeys'
const SCENARIO_IDS_SOURCE = 'frontend/src/arkham/data/theScarletKeys.json'
const GUIDE_DIR = 'frontend/src/locales'
const REPLAY_BASELINE = 'tests/fixtures/replay/tsk-baseline.json'
const BASELINE_SOURCE = 'audit/tsk-baseline.json'

// M0 硬口径：数字来自路线图 §2/§4/§5 与 shared.js 的目录身份注释，任何一项偏离都会让对应 gate 失败。
const EXPECTED = Object.freeze({
  main: 369,
  faces: 70,
  records: 439,
  positions: 398,
  packRecords: Object.freeze({ tskCampaign: 311, tskInvestigators: 20, tskPlayer: 108 }),
  chapters: 10,
  encounterGroups: 26,
  chapterGroups: 10,
  sharedGroups: 16,
  investigators: 6,
  signatures: 14,
  keys: 10,
  keyRecords: 20,
  customizable: 16,
  concealedKinds: 29,
  worldMapNodes: 36,
  greenLocations: 5,
  initialUnlocked: 26,
  statusReports: 6,
  campaignSteps: 10,
  travelDestinations: 36,
  interludes: 17,
  dossierInterludes: 16,
  redCoterie: 10,
  externalSets: 8,
  guideSources: 22,
  sources: 427,
  reprintGroups: 6,
  crossCycleReprints: 2,
  multiRecordPositions: 32,
  linkedPairs: 28,
  epilogueTrustRecords: 3,
  epilogueDeceptionRecords: 8,
  // 共享遭遇组里不进入任何章节 gather、由战役流程直接加入的组（环球漫游 / 红色同志会）。
  campaignLevelGroups: Object.freeze(['globetrotting', 'redCoterie']),
  chaosBagSizes: Object.freeze({ easy: 16, standard: 16, hard: 17, expert: 18 }),
  // 状况报告效果（参考 TheScarletKeys.hs#RunMessage 的 statusReport 分支）。
  statusReportEffects: Object.freeze({
    alpha: Object.freeze({ chaosTokens: Object.freeze(['cultist']), unlocks: Object.freeze([]) }),
    epsilon: Object.freeze({ chaosTokens: Object.freeze([]), unlocks: Object.freeze([]) }),
    beta: Object.freeze({ chaosTokens: Object.freeze(['cultist']), unlocks: Object.freeze(['Tunguska']) }),
    zeta: Object.freeze({ chaosTokens: Object.freeze([]), unlocks: Object.freeze(['Kabul', 'Quito', 'SanJuan', 'Reykjavik']), stealsKeys: true }),
    gamma: Object.freeze({ chaosTokens: Object.freeze(['cultist']), unlocks: Object.freeze([]), deckTreacheries: Object.freeze(['paradimensionalUnderstanding']) }),
    theta: Object.freeze({ chaosTokens: Object.freeze([]), unlocks: Object.freeze([]) }),
    psi: Object.freeze({ chaosTokens: Object.freeze([]), unlocks: Object.freeze(['HongKong']) }),
    omega: Object.freeze({ chaosTokens: Object.freeze(['cultist']), unlocks: Object.freeze([]) }),
  }),
})

const stableSort = values => [...values].sort()
const sum = values => values.reduce((total, value) => total + value, 0)
const camelToWords = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
const pascal = value => value[0].toUpperCase() + value.slice(1)

const readReference = path => readFileSync(join(REFERENCE, path), 'utf8')
const referenceExists = path => existsSync(join(REFERENCE, path))
const readReferenceJson = path => JSON.parse(readReference(path).replace(/^\uFEFF/, ''))
const scenarioIdsJson = referenceExists(SCENARIO_IDS_SOURCE) ? readReferenceJson(SCENARIO_IDS_SOURCE) : []
// 来源缺失时不抛异常，而是写出 bytes=0 / sha256=null，让 gate 如实失败（便于报告来源漂移）。
const lock = path => (referenceExists(path) ? sourceLock(path) : { path: path.replaceAll('\\', '/'), bytes: 0, sha256: null })
const readRepoJson = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)

const scenarioSourceOf = chapterId => `${SCENARIO_DIR}/${pascal(chapterId)}.hs`
const guidePath = (lang, guideId) => `${GUIDE_DIR}/${lang}/theScarletKeys/scenarios/${guideId}.json`
const guideBasePath = lang => `${GUIDE_DIR}/${lang}/theScarletKeys/base.json`

// 01 卡表复算：全集、主卡 / 关联面、物理卡位、三包分区。
const mainCodes = CYCLE_CODES.filter(isMainCardCode)
const faceCodes = CYCLE_CODES.filter(isLinkedFaceCode)
const positionCodes = new Map()
for (const code of CYCLE_CODES) {
  const position = code.slice(0, 5)
  if (!positionCodes.has(position)) positionCodes.set(position, [])
  positionCodes.get(position).push(code)
}
const ownerOf = new Map()
for (const [pack, codes] of Object.entries(CARD_PARTITIONS)) {
  for (const code of codes) ownerOf.set(code, pack)
}

// 02 重印 / 同印刷身份分组：与 EotE/TIC/TDE 同一 identityKey 口径，复算全卡池后只保留涉及本循环的组。
const normalizedText = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value ?? null)
const IDENTITY_FIELDS = ['name', 'type', 'subname', 'xp', 'cost', 'text', 'backText', 'icons', 'traits', 'slot',
  'willpower', 'intellect', 'combat', 'agility', 'health', 'sanity', 'fight', 'evade', 'damage', 'horror', 'shroud']
const identityKey = card => JSON.stringify(IDENTITY_FIELDS.map(field => normalizedText(card[field])))
const identityGroups = new Map()
for (const card of Object.values(ALL_CARDS)) {
  const key = identityKey(card)
  if (!identityGroups.has(key)) identityGroups.set(key, [])
  identityGroups.get(key).push(card.code)
}
const reprintGroups = [...identityGroups.values()]
  .filter(codes => codes.some(code => CYCLE_CODES.includes(code)) && codes.length > 1)
  .map(values => {
    const codes = stableSort(values)
    const cycleCodes = codes.filter(code => CYCLE_CODES.includes(code))
    const outsideCodes = codes.filter(code => !CYCLE_CODES.includes(code))
    const linked = codes.some(code => (ALL_CARDS[code].duplicatedBy || []).some(other => codes.includes(other)))
    return {
      canonicalCode: codes[0],
      codes,
      cycleCodes,
      outsideCodes,
      kind: outsideCodes.length ? 'cross-cycle-reprint' : 'within-cycle-identical',
      basis: linked ? 'duplicateOfCode-duplicatedBy' : 'identical-printed-identity',
      aliasRegistration: 'P5–P6；本次只锁定映射，不新建行为或别名实现',
    }
  })
  .sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode))
const canonicalOf = code => reprintGroups.find(group => group.codes.includes(code))?.canonicalCode || code
const crossCycleReprints = reprintGroups.filter(group => group.kind === 'cross-cycle-reprint')
// 重印链接：本循环卡被别循环复用的 duplicatedBy，以及别循环卡以本循环为 canonical 的 duplicateOfCode。
const duplicateLinks = stableSort(CYCLE_CODES.filter(code => (ALL_CARDS[code].duplicatedBy || []).length))
  .map(code => ({
    code,
    name: ALL_CARDS[code].name,
    duplicateOfCode: ALL_CARDS[code].duplicateOfCode || null,
    duplicatedBy: stableSort(ALL_CARDS[code].duplicatedBy || []),
    canonicalCode: canonicalOf(code),
  }))
const outsideDuplicateLinks = stableSort(Object.values(ALL_CARDS)
  .filter(card => card.duplicateOfCode && CYCLE_CODES.includes(card.duplicateOfCode))
  .map(card => ({ code: card.code, pack: card.pack, name: card.name, duplicateOfCode: card.duplicateOfCode })))

// 03 物理卡位与关联面：多记录卡位（密钥两面、敌对/剧情关联对、变体卡）逐位分类。
const multiRecordPositions = [...positionCodes.entries()]
  .filter(([, codes]) => codes.length > 1)
  .map(([position, values]) => {
    const records = stableSort(values)
    const key = KEY_CARDS.find(entry => entry.id === position) || null
    const linked = records
      .filter(code => ALL_CARDS[code].linkedToCode)
      .map(code => ({ from: code, to: ALL_CARDS[code].linkedToCode }))
    const kind = key ? 'key-stable-unstable'
      : linked.length && linked.length * 2 === records.length ? 'linked-pairs' : 'variants'
    return {
      position,
      records,
      kind,
      keyId: key ? key.id : null,
      linked,
      owners: stableSort([...new Set(records.map(code => ownerOf.get(code) || null))]),
      note: kind === 'variants' ? '参考实现按变体卡分别实现（P1 核实同印刷身份 / 变体口径）' : null,
    }
  })
  .sort((a, b) => a.position.localeCompare(b.position))
const linkedPairs = CYCLE_CODES
  .filter(code => ALL_CARDS[code].linkedToCode)
  .map(code => ({ from: code, to: ALL_CARDS[code].linkedToCode, owner: ownerOf.get(code) || null }))
const variantPositions = multiRecordPositions.filter(entry => entry.kind === 'variants')

// 04 双面绯红密钥：卡表两面 + 参考 Key/Cards.hs 定义 + 战役/章节发放点。
const keyCardsSource = referenceExists(KEY_CARDS_SOURCE) ? readReference(KEY_CARDS_SOURCE) : ''
const keyDefs = [...keyCardsSource.matchAll(/(\w+) = key "(\d{5})" \("([^"]+)" <:> "([^"]+)"\) (\w+)/g)]
  .map(([, sourceVar, id, name, subname, encounterSet]) => ({ sourceVar, id, name, subname, encounterSet }))
const keyAwardSites = []
for (const source of [CAMPAIGN_SOURCE, ...chapters.map(chapter => scenarioSourceOf(chapter.id))]) {
  if (!referenceExists(source)) continue
  const text = readReference(source)
  const scope = source === CAMPAIGN_SOURCE ? 'campaign' : chapters.find(chapter => scenarioSourceOf(chapter.id) === source)?.id || null
  for (const match of text.matchAll(/(?:chooseBearer|setBearer) Keys\.(\w+)/g)) {
    if (!keyAwardSites.some(site => site.key === match[1] && site.scope === scope)) keyAwardSites.push({ key: match[1], scope })
  }
}
const keyCards = KEY_CARDS.map(key => {
  const stable = ALL_CARDS[key.stableCode]
  const unstable = ALL_CARDS[key.unstableCode]
  const definition = keyDefs.find(entry => entry.id === key.id) || null
  return {
    ...key,
    stableTraits: stable?.traits || [],
    unstableTraits: unstable?.traits || [],
    stableText: stable?.text || '',
    unstableText: unstable?.text || '',
    referenceDefinition: definition
      ? { sourceVar: definition.sourceVar, name: definition.name, subname: definition.subname, encounterSet: definition.encounterSet }
      : null,
    awards: keyAwardSites.filter(site => definition && site.key === definition.sourceVar).map(site => site.scope),
  }
})
const externalKeyCards = keyDefs
  .filter(entry => !KEY_IDS.includes(entry.id))
  .map(entry => ({ ...entry, pack: ALL_CARDS[entry.id]?.pack || null, inCycle: CYCLE_CODES.includes(entry.id) }))

// 05 定制升级卡元数据：勾选项 = □ 数量（即该项经验值），逐卡解析成 P6 的勾选面板输入。
const parseCustomizationLines = text => String(text || '').split('\n').map(line => line.trim()).filter(Boolean)
const parseCustomization = text => parseCustomizationLines(text).map(line => {
  const match = line.match(/^(□+)\s*([^.(]+)[.]?\s*(.*)$/)
  if (!match) return null
  return { checks: match[1].length, name: match[2].trim(), text: match[3].trim() }
}).filter(Boolean)
const customizableCards = CUSTOMIZABLE_CODES.map(code => {
  const card = ALL_CARDS[code]
  const lines = parseCustomizationLines(card.customizationText)
  const options = parseCustomization(card.customizationText)
  return {
    code, name: card.name, nameZh: card.nameZh || '', type: card.type, xp: card.xp ?? 0, cost: card.cost ?? null,
    faction: card.factionName || null,
    preamble: lines.filter(line => !line.startsWith('□')),
    options,
    optionCount: options.length,
    totalChecks: sum(options.map(option => option.checks)),
    checkboxCount: (String(card.customizationText).match(/□/g) || []).length,
    customizationText: card.customizationText || '',
    customizationChange: card.customizationChange || '',
  }
})

// 06 遭遇组：campaign 卡 encounterCode → camelCase id，逐组对账。
const groupRecords = new Map(ENCOUNTER_GROUPS.map(id => [id, []]))
const unmappedEncounterCodes = new Set()
for (const code of CARD_PARTITIONS.tskCampaign) {
  const encounterCode = ALL_CARDS[code].encounterCode
  const group = encounterCode ? toCamelCase(encounterCode) : null
  if (!group || !groupRecords.has(group)) {
    unmappedEncounterCodes.add(encounterCode || code)
    continue
  }
  groupRecords.get(group).push(code)
}
for (const codes of groupRecords.values()) codes.sort()
const chapterByGroup = new Map(Object.entries(CHAPTER_ENCOUNTER_GROUPS).map(([chapterId, group]) => [group, chapterId]))
const encounterGroups = ENCOUNTER_GROUPS.map(group => {
  const codes = groupRecords.get(group) || []
  const chapterId = chapterByGroup.get(group) || null
  return {
    id: group,
    encounterCode: ENCOUNTER_GROUP_CODES[group],
    nameEn: ENCOUNTER_GROUP_NAMES[group],
    kind: chapterId ? 'chapter' : 'shared',
    chapterId,
    main: codes.filter(isMainCardCode).length,
    faces: codes.filter(isLinkedFaceCode).length,
    records: codes.length,
  }
})
const missingGroups = ENCOUNTER_GROUPS.filter(group => (groupRecords.get(group) || []).length === 0)

// 07 章节来源：每章锁一个参考 Scenario .hs，解析 gather 调用；提示卡 / 指南 / 档案编号从参考剧情核对。
const nameKey = value => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase()
const camelToTitle = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase())
const parseGatherSets = text => {
  const rows = []
  for (const match of text.matchAll(/gather(AndSetAside|Just)?\s+Set\.(\w+)(?:\s+\[([^\]]+)\])?/g)) {
    const mode = match[1] === 'AndSetAside' ? 'gatherAndSetAside' : match[1] === 'Just' ? 'gatherJust' : 'gather'
    const set = match[2]
    if (rows.some(row => row.set === set && row.mode === mode)) continue
    const row = { set, mode }
    if (match[3]) {
      const ids = match[3].split(',').map(part => part.trim().replace(/^[A-Za-z]*\./, '')).filter(Boolean)
      const encounterName = camelToWords(set)
      const candidates = Object.values(ALL_CARDS).filter(card => card.encounterName === encounterName)
      const pool = candidates.length ? candidates : Object.values(ALL_CARDS)
      const subsetCards = ids.flatMap(id => pool.filter(card => nameKey(card.name) === nameKey(id)))
      row.subset = stableSort(ids.map(id => subsetCards.find(card => nameKey(card.name) === nameKey(id))?.name || camelToTitle(id)))
      row.subsetCodes = stableSort([...new Set(subsetCards.map(card => card.code))])
    }
    rows.push(row)
  }
  return rows.sort((a, b) => (a.set === b.set ? a.mode.localeCompare(b.mode) : a.set.localeCompare(b.set)))
}
const countGuideLeaves = value => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return 1
  if (Array.isArray(value)) return value.reduce((total, item) => total + countGuideLeaves(item), 0)
  if (value && typeof value === 'object') return Object.values(value).reduce((total, item) => total + countGuideLeaves(item), 0)
  return 0
}
const guideJson = (lang, guideId) => (referenceExists(guidePath(lang, guideId)) ? readReferenceJson(guidePath(lang, guideId)) : null)
const baseJson = lang => (referenceExists(guideBasePath(lang)) ? readReferenceJson(guideBasePath(lang)) : null)
const guideBase = { en: baseJson('en'), zh: baseJson('zh') }
// 档案编号（File #NN-X）：在场景指南 / 地图节点副标题 / 幕间标题里查找，统一成 `NN-X` 便于比对。
const normalizeArchiveLabel = value => {
  const match = String(value || '').match(/(\d+)\s*[\u2013\u2014-]\s*([A-Z])/)
  return match ? `${Number(match[1])}-${match[2]}` : null
}
const collectArchiveLabels = value => {
  const labels = new Set()
  const visit = item => {
    if (typeof item === 'string') {
      for (const match of item.matchAll(/File\s*#(\d+)\s*[\u2013\u2014-]\s*([A-Z])/g)) labels.add(`${Number(match[1])}-${match[2]}`)
      return
    }
    if (Array.isArray(item)) return item.forEach(visit)
    if (item && typeof item === 'object') Object.values(item).forEach(visit)
  }
  visit(value)
  return [...labels].sort()
}
const scenarioSources = Object.fromEntries(chapters.map(chapter => {
  const path = scenarioSourceOf(chapter.id)
  const text = referenceExists(path) ? readReference(path) : ''
  return [chapter.id, { path, text, gatherSets: parseGatherSets(text), lock: lock(path) }]
}))
const chapters_ = chapters.map((chapter, index) => {
  const source = scenarioSources[chapter.id]
  const prompt = ALL_CARDS[chapter.code]
  const guideId = chapter.guideId
  const scenarioGuide = guideJson('en', guideId)
  const locationBase = guideBase.en?.locations?.[chapter.mapLocationId] || null
  // 同一地图节点触发的海外幕间标题也算该节点的档案编号来源（例如伦敦 #27-H 与 #5-A 并存）。
  const interludeLabels = INTERLUDES
    .filter(entry => entry.triggerLocations.includes(chapter.mapLocationId))
    .flatMap(entry => collectArchiveLabels(guideBase.en?.headings?.interludes?.[String(entry.number)] || ''))
  const archiveLabels = stableSort([...new Set([
    ...collectArchiveLabels(scenarioGuide),
    ...collectArchiveLabels(locationBase),
    ...interludeLabels,
  ])])
  const guideSources = ['en', 'zh'].map(lang => ({
    lang,
    ...lock(guidePath(lang, guideId)),
    keyCount: countGuideLeaves(guideJson(lang, guideId)),
  }))
  const expectedLabel = normalizeArchiveLabel(chapter.archiveLabel)
  return {
    ...chapter,
    stepId: chapter.code,
    order: index + 1,
    source: source.path,
    sourceSha256: source.lock.sha256,
    gatherSets: source.gatherSets,
    promptCard: {
      code: chapter.code,
      name: prompt?.name || '',
      nameZh: prompt?.nameZh || '',
      type: prompt?.type || null,
      text: prompt?.text || '',
      backText: prompt?.backText || '',
      textSha256: sha(prompt?.text || ''),
      backTextSha256: sha(prompt?.backText || ''),
    },
    archiveLabel: chapter.archiveLabel,
    archiveLabelNormalized: expectedLabel,
    archiveLabels,
    archiveLabelMatched: expectedLabel ? archiveLabels.includes(expectedLabel) : false,
    guideSources,
  }
})

// 08 混乱袋：Helpers.hs#campaignChaosBag 解析并对账 shared.js CHAOS_BAGS。
const TOKEN_NAMES = Object.freeze({ Skull: 'skull', Cultist: 'cultist', Tablet: 'tablet', ElderThing: 'elderthing', AutoFail: 'autofail', ElderSign: 'eldersign' })
const parseChaosToken = raw => {
  const value = raw.trim()
  const quoted = value.match(/^#?"([^"]*)"$/)
  if (quoted) return quoted[1]
  const identifier = value.match(/^#?([A-Za-z][A-Za-z0-9]*)$/)
  return identifier && TOKEN_NAMES[identifier[1]] ? TOKEN_NAMES[identifier[1]] : null
}
const helpersText = referenceExists(HELPERS_SOURCE) ? readReference(HELPERS_SOURCE) : ''
const parsedChaosBags = Object.fromEntries(
  [...helpersText.matchAll(/Difficulty\.(Easy|Standard|Hard|Expert) ->\s*\n\s*\[([\s\S]*?)\n\s*\]/g)]
    .map(match => [match[1].toLowerCase(), match[2].split(',').map(parseChaosToken).filter(Boolean)]),
)

// 09 世界地图：Meta.hs#worldMap 解析并对账 shared.js WORLD_MAP；距离用 0-1 BFS（绿地移动不耗时）。
const metaText = referenceExists(META_SOURCE) ? readReference(META_SOURCE) : ''
const mapIdsBlock = metaText.match(/data MapLocationId\n([\s\S]*?)\n\s*deriving/)?.[1] || ''
const parsedMapIds = mapIdsBlock.split('\n').map(line => line.trim())
  .filter(line => /^[=|\|]\s+[A-Z]/.test(line)).map(line => line.replace(/^[=|\|]\s+/, '').trim())
const parsedGreen = (metaText.match(/greenLocations = \[([^\]]+)\]/)?.[1] || '').split(',').map(value => value.trim()).filter(Boolean)
const mapEntriesBlock = metaText.slice(metaText.indexOf('worldMap =\n'), metaText.indexOf('data KeyStatus'))
const parsedMap = [...mapEntriesBlock.matchAll(/\(\s*([A-Z][A-Za-z]+)\s*,\s*MapLocation\s+\1\s+(Standard|Locked|Side)\s+\[([^\]]*)\]\s*\)/g)]
  .map(([, id, type, connections]) => ({
    id, type: type.toLowerCase(),
    connections: connections.split(',').map(value => value.trim()).filter(Boolean),
  }))
const parsedInitialUnlocked = (metaText.match(/initUnlockedLocations =\n\s*\[([\s\S]*?)\]\s*<> greenLocations/)?.[1] || '')
  .split(',').map(value => value.trim()).filter(Boolean)
const parsedStart = metaText.match(/initMeta =\n\s*TheScarletKeysMeta \[(\w+)\] initUnlockedLocations/)?.[1] || null
const mapById = new Map(parsedMap.map(node => [node.id, node]))
const greenSet = new Set(parsedGreen)
// 0-1 BFS：进入绿地节点不耗时间（参考 mapDistance 的 `if n elem greenLocations then 0 else 1`）。
function distancesFrom(start) {
  const distances = new Map(parsedMap.map(node => [node.id, Infinity]))
  const deque = [[start, 0]]
  distances.set(start, 0)
  while (deque.length) {
    deque.sort((left, right) => left[1] - right[1])
    const [current, cost] = deque.shift()
    if (cost > distances.get(current)) continue
    for (const neighbor of mapById.get(current)?.connections || []) {
      const nextCost = cost + (greenSet.has(neighbor) ? 0 : 1)
      if (nextCost < distances.get(neighbor)) {
        distances.set(neighbor, nextCost)
        deque.push([neighbor, nextCost])
      }
    }
  }
  return Object.fromEntries([...distances.entries()].map(([id, value]) => [id, Number.isFinite(value) ? value : null]))
}
const distancesFromStart = parsedStart ? distancesFrom(parsedStart) : {}
const mapConnectionsValid = parsedMap.every(node => node.connections.every(neighbor => mapById.has(neighbor)))
const mapSymmetric = parsedMap.every(node => node.connections.every(neighbor => mapById.get(neighbor)?.connections.includes(node.id)))
// 剧情/指南里的 36 个地图节点名（base.json#locations）必须与参考地图一一对应。
const mapLocationNames = Object.fromEntries(parsedMap.map(node => {
  const entry = guideBase.en?.locations?.[node.id] || null
  return [node.id, { nameEn: entry?.name || node.id, nameZh: guideBase.zh?.locations?.[node.id]?.name || null, subtitle: entry?.subtitle || null }]
}))

// 10 战役流程：CampaignSteps.hs 的 10 个 ScenarioStep + TheScarletKeys.hs#nextStep / travel / 状况报告 / 尾声。
const campaignText = referenceExists(CAMPAIGN_SOURCE) ? readReference(CAMPAIGN_SOURCE) : ''
const campaignStepsText = referenceExists(CAMPAIGN_STEPS_SOURCE) ? readReference(CAMPAIGN_STEPS_SOURCE) : ''
const campaignIdMatch = campaignText.match(/campaign TheScarletKeys \(CampaignId "(\d+)"\) "([^"]+)"/)
const campaignStepsPatterns = [...campaignStepsText.matchAll(/pattern (\w+) :: CampaignStep\npattern \1 <- ScenarioStep "([^"]+)"/g)]
  .map(([, pattern, stepId]) => ({ pattern, stepId, id: pattern[0].toLowerCase() + pattern.slice(1) }))
const stepIdByPattern = new Map(campaignStepsPatterns.map(step => [step.pattern, step.id]))
const chapterIdByStepId = new Map(chapters.map(chapter => [chapter.code, chapter.id]))
const normalizeStepTarget = raw => {
  const value = String(raw || '')
  const interlude = value.match(/InterludeStep\s+(\d+)/)
  if (interlude) return `interlude${interlude[1]}`
  if (value.includes('EpilogueStep')) return 'epilogue'
  if (value.includes('PrologueStep')) return 'prologue'
  if (value.includes('embark')) return 'embark'
  const stepId = value.match(/ScenarioStep\s+"?(\d{5})"?/)
  if (stepId && chapterIdByStepId.has(stepId[1])) return chapterIdByStepId.get(stepId[1])
  for (const [pattern, id] of stepIdByPattern) if (new RegExp(`\\b${pattern}\\b`).test(value)) return id
  const word = value.match(/\b([A-Z][A-Za-z0-9]+)\b/)
  return word ? word[1] : null
}
const chapterByPattern = new Map(campaignStepsPatterns.map(step => [step.pattern, chapterIdByStepId.get(step.stepId)]))
const nextStepBlock = campaignText.slice(campaignText.indexOf('nextStep a = case'), campaignText.indexOf('other -> defaultNextStep other'))
const nextStepEdges = [...nextStepBlock.matchAll(/\n    (\w+(?: \d+)?(?: _)?) -> continue \(?([^\n]+)/g)]
  .map(([, from, raw]) => ({ from: normalizeStepTarget(from), targets: [normalizeStepTarget(raw)] }))
  .filter(edge => edge.from && edge.targets[0])
const travelBlockStart = campaignText.indexOf('if doTravel\n    then case locId of')
const travelBlockEnd = campaignText.indexOf('else campaignStep_ (embark attrs\')', travelBlockStart)
const travelBlock = travelBlockStart >= 0 && travelBlockEnd > travelBlockStart
  ? campaignText.slice(travelBlockStart, travelBlockEnd) : ''
const travelDestinations = (() => {
  const rows = []
  const parts = travelBlock.split(/\n      (?=[A-Z][A-Za-z]+ ->)/).slice(1)
  for (const part of parts) {
    const location = part.match(/^([A-Z][A-Za-z]+) ->/)?.[1]
    if (!location) continue
    let step = null
    const edit = part.match(/campaignStepEdit_ (\w+)/)
    const plain = part.match(/campaignStep_ (\w+)/)
    const interlude = part.match(/InterludeStep (\d+)/)
    if (edit) step = chapterByPattern.get(edit[1]) || edit[1]
    else if (plain) step = chapterByPattern.get(plain[1]) || plain[1]
    else if (interlude) step = `interlude${interlude[1]}`
    else if (part.includes('pickSideStory')) step = 'sideStory'
    rows.push({ location, step })
  }
  return rows.sort((a, b) => a.location.localeCompare(b.location))
})()
const travelDestinationByLocation = new Map(travelDestinations.map(row => [row.location, row.step]))
const travelRules = {
  markTimeOnTravel: /travel attrs locId' doTravel n = do\n  markTime n/.test(campaignText),
  greenDestinationExtraTime: /locId `elem` greenLocations then 1 else 0/.test(campaignText),
  forcedTunguskaAt: (campaignText.match(/if t >= 35 then Tunguska else locId'/) || [])[0] ? FORCED_ENDGAME_TIME : null,
  ticketTravelTime: (campaignText.match(/travelWithTicket[\s\S]{0,200}?travel attrs locId True 1/) || [])[0] ? 1 : null,
  embarkNotes: 'Embark 时列出可用地点与最短路径耗时；时间满 35 强制前往通古斯卡。',
}
const statusReportThresholds = [...helpersText.matchAll(/\((\d+), (Alpha|Beta|Epsilon|Zeta|Gamma|Theta|Psi|Omega)\)/g)]
  .map(([, threshold, report]) => ({ report: report.toLowerCase(), threshold: Number(threshold) }))
const statusReportBlockStart = campaignText.indexOf('case statusReport of')
const statusReportBlockEnd = campaignText.indexOf('-- handle via Embark', statusReportBlockStart)
const statusReportBlock = statusReportBlockStart >= 0 && statusReportBlockEnd > statusReportBlockStart
  ? campaignText.slice(statusReportBlockStart, statusReportBlockEnd) : ''
const statusReportBranches = Object.fromEntries(['Alpha', 'Beta', 'Epsilon', 'Zeta', 'Gamma', 'Theta', 'Psi', 'Omega'].map(report => {
  const start = statusReportBlock.indexOf(`          ${report} -> `)
  if (start < 0) return [report.toLowerCase(), null]
  const rest = statusReportBlock.slice(start + 1)
  const next = rest.slice(1).search(/\n {10}[A-Z][A-Za-z]+ -> /)
  const chunk = next >= 0 ? rest.slice(0, next + 1) : rest
  return [report.toLowerCase(), {
    chaosTokens: stableSort([...chunk.matchAll(/addChaosToken (\w+)/g)].map(match => (TOKEN_NAMES[match[1]] || match[1]).toLowerCase())),
    unlocks: stableSort([...chunk.matchAll(/campaignSpecific "unlock" (\w+)/g)].map(match => match[1])),
    deckTreacheries: stableSort([...chunk.matchAll(/Treacheries\.(\w+)/g)].map(match => match[1])),
    stealsKeys: /keyStolenByEnemy/.test(chunk),
  }]
}))
const interludeScopes = new Map([...campaignText.matchAll(/CampaignStep \(InterludeStep (\d+) _\) -> scope "([^"]+)"/g)]
  .map(([, number, scopeId]) => [Number(number), scopeId]))
interludeScopes.set(1, 'interlude1')
const interludes = INTERLUDES.map(entry => {
  const guideLabels = collectArchiveLabels(guideBase.en?.headings?.interludes?.[String(entry.number)] || '')
  const expectedArchive = normalizeArchiveLabel(guideBase.en?.headings?.interludes?.[String(entry.number)] || '')
  return {
    ...entry,
    nameEn: guideBase.en?.interludes?.[String(entry.number)] || null,
    nameZh: guideBase.zh?.interludes?.[String(entry.number)] || null,
    archiveLabel: expectedArchive,
    archiveLabels: guideLabels,
    archiveLabelMatched: entry.number === 1 ? true : Boolean(expectedArchive) && guideLabels.includes(expectedArchive),
    travelSteps: entry.triggerLocations.map(location => ({ location, step: travelDestinationByLocation.get(location) || null })),
  }
})
const epilogueStart = campaignText.indexOf('CampaignStep EpilogueStep -> scope "epilogue"')
const epilogueEnd = campaignText.indexOf('CampaignStep step | ScenarioStep', epilogueStart)
const epilogueBlock = epilogueStart >= 0 && epilogueEnd > epilogueStart ? campaignText.slice(epilogueStart, epilogueEnd) : ''
const epilogueRecords = stableSort([...new Set([...epilogueBlock.matchAll(/record (\w+)/g)].map(match => match[1]))])
const countRecordArrays = [...epilogueBlock.matchAll(/countHasRecords\s*\n?\s*\[([\s\S]*?)\]/g)]
  .map(match => match[1].split(',').map(value => value.trim()).filter(Boolean))
const epilogue = {
  records: epilogueRecords,
  trustRecords: countRecordArrays[0] || [],
  deceptionRecords: countRecordArrays[1] || [],
  counters: stableSort([...new Set([...epilogueBlock.matchAll(/recordCount (\w+)/g)].map(match => match[1]))]),
  joinedCoterieRecord: (epilogueBlock.match(/record (\w+)\n\s*flavor/) || [])[1] || null,
  permanentPositionRecord: epilogueBlock.includes('TheCellWasGivenAPermanentPosition') ? 'TheCellWasGivenAPermanentPosition' : null,
  dismantledRecord: epilogueBlock.includes('TheCellWasDismantled') ? 'TheCellWasDismantled' : null,
  deliveredIntelRecord: /deliveredIntel[\s\S]{0,200}?TheCellIsDeliveringFoundationIntel/.test(epilogueBlock) ? 'TheCellIsDeliveringFoundationIntel' : null,
}
const invalidCardsBlockStart = campaignText.indexOf('invalidCards c =')
const invalidCardsBlock = invalidCardsBlockStart >= 0 ? campaignText.slice(invalidCardsBlockStart, campaignText.indexOf('nextStep a = case')) : ''
const invalidCards = {
  codes: stableSort([...new Set([...invalidCardsBlock.matchAll(/"(\d{5})"/g)].map(match => match[1]))]),
  erasedFromExistenceRule: invalidCardsBlock.includes('ErasedFromExistence'),
}
// 红色同志会：Helpers.hs#haven'tSeenTheLastOf 的 (敌人定义, 记录键) 对 + Enemy/CardDefs 的 var → 卡号。
const redCoterieDefsText = referenceExists(RED_COTERIE_SOURCE) ? readReference(RED_COTERIE_SOURCE) : ''
const redCoterieDefs = new Map([...redCoterieDefsText.matchAll(/(\w+) :: CardDef\n\1 =\n\s*\(enemy "(\d{5})" \("([^"]+)" <:> "([^"]+)"\) RedCoterie/g)]
  .map(([, sourceVar, code, name, subname]) => [sourceVar, { code, name, subname }]))
const havenBlockStart = helpersText.indexOf("haven'tSeenTheLastOf = do")
const havenBlockEnd = helpersText.indexOf('map fst <$>', havenBlockStart)
const havenBlock = havenBlockStart >= 0 && havenBlockEnd > havenBlockStart ? helpersText.slice(havenBlockStart, havenBlockEnd) : ''
const redCoterie = [...havenBlock.matchAll(/\(\s*Enemies\.(\w+)\s*,\s*(YouHaventSeenTheLastOf\w+)\s*\)/g)]
  .map(([, enemyVar, record]) => ({ enemyVar, record, ...(redCoterieDefs.get(enemyVar) || { code: null, name: null, subname: null }) }))
// 隐匿迷你卡 / 诱饵实体：Concealed/Kind.hs 的构造子（不是卡表卡号，属战役虚拟实体）。
const concealedKindText = referenceExists(CONCEALED_KIND_SOURCE) ? readReference(CONCEALED_KIND_SOURCE) : ''
const concealedKindBlock = concealedKindText.slice(concealedKindText.indexOf('data ConcealedCardKind'), concealedKindText.indexOf('deriving stock'))
const concealedKinds = [...concealedKindBlock.matchAll(/^\s*[=|]\s+(\w+)/gm)].map(match => match[1])
const concealedUsage = Object.fromEntries(concealedKinds.map(kind => {
  const users = referencePaths
    .filter(path => path.endsWith('.hs') && !path.endsWith('Concealed/Kind.hs'))
    .filter(path => new RegExp(`\\b${kind}\\b`).test(readReference(path)))
  return [kind, users.length]
}))

// 11 帷幕外依赖：非本循环的 gather 集合 = 核心遭遇组（StrikingFear / TheMidnightMasks 只取子集）。
const cardsOfEncounterSet = set => Object.values(ALL_CARDS)
  .filter(card => card.encounterName === camelToWords(set))
  .map(card => card.code)
  .sort()
const toEncounterCode = set => camelToWords(set).toLowerCase().replace(/ /g, '_')
// 参考遭遇集合名是 PascalCase（StrikingFear），内容目录 id 是 lowerCamelCase（strikingFear）。
const toGroupId = value => {
  const camel = toCamelCase(value)
  return camel[0].toLowerCase() + camel.slice(1)
}
const gatheredExternal = new Map()
for (const chapter of chapters) {
  for (const gather of scenarioSources[chapter.id].gatherSets) {
    const groupId = toGroupId(gather.set)
    if (ENCOUNTER_GROUPS.includes(groupId)) continue
    if (!gatheredExternal.has(gather.set)) gatheredExternal.set(gather.set, { chapters: [], modes: [], subsets: [] })
    const entry = gatheredExternal.get(gather.set)
    if (!entry.chapters.includes(chapter.id)) entry.chapters.push(chapter.id)
    if (!entry.modes.includes(gather.mode)) entry.modes.push(gather.mode)
    if (gather.subset) entry.subsets.push(gather.subset)
  }
}
const externalDependencies = stableSort(gatheredExternal.keys()).map(set => {
  const entry = gatheredExternal.get(set)
  const declared = EXTERNAL_ENCOUNTER_DEPENDENCIES.find(dependency => dependency.set === set) || null
  const repoDir = declared?.repoDir || `shared/${toEncounterCode(set)}`
  const subset = stableSort([...new Set(entry.subsets)])
  const fullCodes = cardsOfEncounterSet(set)
  const subsetCodes = stableSort([...new Set(chapters.flatMap(chapter =>
    scenarioSources[chapter.id].gatherSets
      .filter(gather => gather.set === set)
      .flatMap(gather => gather.subsetCodes || [])))])
  return {
    set,
    group: declared?.group || toCamelCase(set),
    encounterCode: declared?.encounterCode || toEncounterCode(set),
    repoDir,
    repoDirExists: existsSync(join(MOD, 'src/cards/encounter-entries', repoDir)),
    chapters: stableSort(entry.chapters),
    usedBy: stableSort(entry.chapters),
    modes: stableSort(entry.modes),
    codes: fullCodes,
    subset,
    subsetCodes,
    note: subset.length ? `参考实现只 gather 子集：${subset.join(' / ')}（不是整组）` : null,
  }
})
const allGatheredGroups = stableSort([...new Set(chapters.flatMap(chapter =>
  scenarioSources[chapter.id].gatherSets.map(gather => toGroupId(gather.set)).filter(group => ENCOUNTER_GROUPS.includes(group))))])

// 12 卡包清单（content/packs/tsk*/manifest.js）：身份 + 卡号 + 遭遇组。P0 三包全部 catalog-only。
const packManifests = Object.fromEntries([
  ['tskCampaign', campaignPackManifest],
  ['tskInvestigators', investigatorsPackManifest],
  ['tskPlayer', playerPackManifest],
])
const packs = Object.entries(CARD_PARTITIONS).map(([pack, codes]) => {
  const packManifest = packManifests[pack]
  return {
    id: packManifest.id,
    status: packManifest.status,
    cards: stableSort((packManifest.cards || []).map(card => card.code)),
    cardRanges: (packManifest.cardRanges || []).map(range => ({ from: range.from, to: range.to })),
    encounterGroupIds: [...(packManifest.encounterGroupIds || [])],
    rulesImplemented: (packManifest.cards || []).some(card => card.rulesImplemented === true),
    catalogOnly: (packManifest.cards || []).every(card => card.cataloged === true && card.rulesImplemented === false),
    partitionSize: codes.length,
  }
})

// 13 全部 439 条记录（P1 逐卡事实源）。
const cards = CYCLE_CODES.map(code => {
  const card = ALL_CARDS[code]
  return {
    code,
    name: card.name,
    nameZh: card.nameZh || '',
    type: card.type,
    subtype: card.subtype || null,
    pack: card.pack,
    owner: ownerOf.get(code) || null,
    encounterCode: card.encounterCode || null,
    encounterName: card.encounterName || null,
    position: card.position ?? null,
    physicalPosition: code.slice(0, 5),
    face: isLinkedFaceCode(code),
    quantity: card.quantity ?? null,
    doubleSided: card.doubleSided === true,
    linkedToCode: card.linkedToCode || null,
    linkedCardCode: card.linkedCardCode || null,
    duplicateOfCode: card.duplicateOfCode || null,
    duplicatedBy: stableSort(card.duplicatedBy || []),
    canonicalCode: canonicalOf(code),
    availability: card.availability || null,
    localeStatus: card.localeStatus || null,
    sourceCard: `frontend/public/cards.json#${code}`,
    text: card.text || '',
    backText: card.backText || '',
  }
})
const partialLocaleCards = cards.filter(card => card.localeStatus && card.localeStatus !== 'complete').map(card => card.code)

// 14 指南来源：每章 2 个语言文件 + 2 份战役 base.json；中英叶子数只作覆盖盘点输入（P1 逐段扫描）。
const guideSources = [
  ...['en', 'zh'].map(lang => ({ lang, scope: 'base', ...lock(guideBasePath(lang)), keyCount: countGuideLeaves(guideBase[lang]) })),
  ...chapters_.flatMap(chapter => chapter.guideSources.map(source => ({ ...source, scope: chapter.id }))),
]
const storyCounts = {
  en: {
    locations: Object.keys(guideBase.en?.locations || {}).length,
    interludes: Object.keys(guideBase.en?.interludes || {}).length,
    statusReports: Object.keys(guideBase.en?.statusReport || {}).length,
    recordKeys: Object.keys(guideBase.en?.key || {}).length,
    specialRules: Object.keys(guideBase.en?.specialRules || {}).length,
  },
  zh: {
    locations: Object.keys(guideBase.zh?.locations || {}).length,
    interludes: Object.keys(guideBase.zh?.interludes || {}).length,
    statusReports: Object.keys(guideBase.zh?.statusReport || {}).length,
    recordKeys: Object.keys(guideBase.zh?.key || {}).length,
    specialRules: Object.keys(guideBase.zh?.specialRules || {}).length,
  },
}

// 15 来源逐文件锁 + 基线指针：P0 起始提交 / 既有失败 / golden replay 指纹。
const sources = referencePaths.map(path => lock(path))
const sourcePaths = stableSort(sources.map(source => source.path))
const duplicateSources = sourcePaths.filter((path, index) => sourcePaths.indexOf(path) !== index)
const baseline = readRepoJson(BASELINE_SOURCE)
const replayBaselineBytes = existsSync(join(MOD, REPLAY_BASELINE)) ? readFileSync(join(MOD, REPLAY_BASELINE)) : null
const replayBaselineSha256 = replayBaselineBytes ? sha(replayBaselineBytes) : null
const baselineReplaySha256 = baseline?.replaySha256 || null

// 16 候选包扫描：连续编号只是首轮候选，逐号与卡包归属对账。
const candidatePackScan = {
  ranges: CANDIDATE_RANGES.map(range => {
    const numericFrom = Number(range.from)
    const numericTo = Number(range.to)
    const positions = Array.from({ length: numericTo - numericFrom + 1 }, (_, index) => String(numericFrom + index).padStart(5, '0'))
    const packCodes = CYCLE_CODES.filter(code => ALL_CARDS[code].pack === range.pack)
    const prefixes = new Set(packCodes.map(code => code.slice(0, 5)))
    const numericCodesNotInPack = positions.filter(position => ALL_CARDS[position] && !CYCLE_CODES.includes(position))
    return {
      pack: range.pack,
      from: range.from,
      to: range.to,
      numericPositions: positions.length,
      coveredPositions: prefixes.size,
      records: packCodes.length,
      main: packCodes.filter(isMainCardCode).length,
      faces: packCodes.filter(isLinkedFaceCode).length,
      missingPositions: positions.filter(position => !prefixes.has(position)),
      outOfRange: packCodes.filter(code => code.slice(0, 5) < range.from || code.slice(0, 5) > range.to),
      numericCodesNotInPack,
    }
  }),
  cycleCodesOutsideRanges: CYCLE_CODES.filter(code => {
    const prefix = code.slice(0, 5)
    return !CANDIDATE_RANGES.some(range => prefix >= range.from && prefix <= range.to)
  }),
}
const nonMainPositions = [...positionCodes.entries()].filter(([, codes]) => !codes.some(isMainCardCode)).map(([position]) => position)

// 17 四类集合：调查员 / 一般玩家卡 / 共享组 / 章节组（P0 退出门禁：无重叠、无遗漏）。
const sets = {
  investigators: { codes: stableSort(CARD_PARTITIONS.tskInvestigators) },
  player: { codes: stableSort(CARD_PARTITIONS.tskPlayer) },
  sharedGroups: SHARED_ENCOUNTER_GROUPS.map(group => ({ group, codes: groupRecords.get(group) || [] })),
  chapterGroups: chapters.map(chapter => ({
    chapterId: chapter.id,
    group: CHAPTER_ENCOUNTER_GROUPS[chapter.id],
    codes: groupRecords.get(CHAPTER_ENCOUNTER_GROUPS[chapter.id]) || [],
  })),
}
const setCodes = [
  ...sets.investigators.codes,
  ...sets.player.codes,
  ...sets.sharedGroups.flatMap(group => group.codes),
  ...sets.chapterGroups.flatMap(group => group.codes),
]
const setOverlaps = setCodes.filter((code, index) => setCodes.indexOf(code) !== index)

// 18 待 P1 复核的来源 / 数据不一致（不修改数据，不伪造 verified）。
const pending = [
  {
    id: 'keyDoubleSidedRepresentation',
    status: 'verify-in-P1',
    detail: `参考 Key/Cards.hs 把钥匙定义成单张双面卡（cdDoubleSided=True、cdOtherSide=flippedCardCode），`
      + `卡表把 ${KEY_IDS.length} 把钥匙拆成 a（Stable）/ b（Unstable）两条记录且 doubleSided=false；`
      + `P1 需确认渲染、翻面与 Shift 的数据通道，再决定 P2 的密钥实体模型。`,
  },
  {
    id: 'physicalPositionsWithoutMainRecord',
    status: 'recorded',
    detail: `${nonMainPositions.length} 个物理卡位没有 5 位主卡记录（只有关联面）：${nonMainPositions.join(' / ')}；`
      + `其中 10 个是密钥（a/b 两面），其余是变体卡 / 关联对（P1 逐位确认物理张数）。`,
  },
  {
    id: 'samePrintedIdentityGroups',
    status: 'verify-in-P1',
    detail: `本循环内部还有 ${reprintGroups.filter(group => group.kind === 'within-cycle-identical').length} 组「同印刷身份但不同卡号」：`
      + `${reprintGroups.filter(group => group.kind === 'within-cycle-identical').map(group => group.codes.join('/')).join('、')}；`
      + `P1 确认它们是变体卡还是应复用同一实现。`,
  },
  {
    id: 'orphanFaceCard',
    status: 'verify-in-P1',
    detail: `参考实现把 09606 定义为单面敌人（Desiderio Delgado Álvarez「The Man in the Blood-Soaked Suit」），`
      + `卡表只有 09606a 一条记录、没有 5 位主卡号，也无同卡位关联面；另一版 09607（双面，otherSide=09607b）正常。`
      + `P1 核对 09606a 的渲染与归属（本账本按 tskCampaign 登记）。`,
  },
  {
    id: 'externalKeyCard',
    status: 'verify-in-P1',
    detail: `参考 Key/Cards.hs 还定义 ${EXTERNAL_KEY_CARD_CODE}（The Wellspring of Fortune，pack=${ALL_CARDS[EXTERNAL_KEY_CARD_CODE]?.pack || '?'}），`
      + `它不属于 tskp/tskc，属独立冒险包依赖；P7 处理侧故事时按范围外依赖登记。`,
  },
  {
    id: 'crossCycleReprintDirection',
    status: 'recorded',
    detail: crossCycleReprints.map(group =>
      `${group.cycleCodes.join('/')} ↔ ${group.outsideCodes.join('/')}（canonical=${group.canonicalCode}，basis=${group.basis}）`).join('；')
      + '；P5–P6 只保留 canonical 实现，另一号走别名。',
  },
  {
    id: 'externalEncounterRepoNaming',
    status: 'verify-in-P1',
    detail: '参考集合名 DarkCult / TheMidnightMasks 在本仓库的复用目录分别是 shared/pentagram（01169–01171）与 '
      + 'shared/arkham（01135/01136 子集）；P7 接线时按 EXTERNAL_ENCOUNTER_DEPENDENCIES 的 group 字段反查。',
  },
  {
    id: 'partialChineseLocaleCards',
    status: 'recorded',
    detail: `卡表 localeStatus 非 complete 的 ${partialLocaleCards.length} 条战役记录：${partialLocaleCards.join(' / ')}；`
      + `P7 生成完整指南时补译。`,
  },
  {
    id: 'mapArchiveLabels',
    status: 'verify-in-P1',
    detail: '图鉴 base.json 的 locations 只给 26 个可触发节点里的 21 个写了 File # 副标题，'
      + 'KualaLumpur/HongKong/Manokwari/BermudaTriangle/Tunguska 的档案编号在场景指南（46-Q/50-S/45-P/56-Y/59-Z）；'
      + 'P1 逐章核对档案编号与地图节点一一对应。',
  },
  {
    id: 'campaignCatalogPlaceholder',
    status: 'recorded',
    detail: 'P0 战役清单是 catalog-only 占位：unlock 线性、recordSchema 为空、resolutionIds 为占位；'
      + 'P7 按参考 Key.hs（81 个记录键）与尾声分支替换为真实 flow/记录/结局，并登记进生产组合根。',
  },
  {
    id: 'sideStoryDependencies',
    status: 'verify-in-P1',
    detail: `绿地节点 ${SIDE_STORY_LOCATIONS.join('/')} 触发 side story（参考 pickSideStory）；`
      + 'side story 内容不在本循环卡包，P7 按战役流程登记依赖、不重复迁移。',
  },
]

// 19 门禁：布尔值，必须全为 true；emit() 在任一非 true 时抛错（report 模式同样打印后抛错）。
const chapterGroupRecords = encounterGroups.filter(group => group.kind === 'chapter')
const sharedGroupRecords = encounterGroups.filter(group => group.kind === 'shared')
const flatSetCodes = setCodes
const guideSourcesValid = source => Boolean(source.sha256 && /^[0-9a-f]{64}$/.test(source.sha256) && source.bytes > 0)
// 单记录关联面：物理卡位只有一个面记录（卡表口径与参考实现不一致，P1 核对）。
const orphanFaceCodes = faceCodes.filter(code => !ALL_CARDS[code].linkedToCode
  && (positionCodes.get(code.slice(0, 5)) || []).filter(sibling => sibling !== code).length === 0)
const facePartners = faceCodes.map(code => {
  const card = ALL_CARDS[code]
  const siblings = (positionCodes.get(code.slice(0, 5)) || []).filter(sibling => sibling !== code)
  const partners = card.linkedToCode ? [card.linkedToCode] : siblings
  return { code, owner: ownerOf.get(code) || null, partners: [...new Set(partners)], partnerOwners: [...new Set(partners.map(partner => ownerOf.get(partner) || null))] }
})
const positionsCovered = multiRecordPositions.every(entry => entry.records.length === positionCodes.get(entry.position).length)
const positionKindCounts = multiRecordPositions.reduce((counts, entry) => {
  counts[entry.kind] = (counts[entry.kind] || 0) + 1
  return counts
}, {})
const keyGates = {
  count: keyCards.length === EXPECTED.keys,
  records: KEY_IDS.length * 2 === EXPECTED.keyRecords
    && KEY_IDS.every(id => positionCodes.get(id)?.length === 2),
  sides: keyCards.every(key => key.stableTraits.includes('Stable') && key.unstableTraits.includes('Unstable')
    && ALL_CARDS[key.stableCode].linkedToCode === key.unstableCode),
  names: keyCards.every(key => key.referenceDefinition
    && key.referenceDefinition.name === key.name && key.referenceDefinition.subname === key.subname),
  awards: keyCards.every(key => key.awards.length > 0),
  external: externalKeyCards.length === 1 && externalKeyCards[0].id === EXTERNAL_KEY_CARD_CODE
    && externalKeyCards[0].inCycle === false,
}
const statusReportGates = {
  thresholds: JSON.stringify(statusReportThresholds) === JSON.stringify(STATUS_REPORTS.map(entry => ({ report: entry.report, threshold: entry.threshold })))
    && statusReportThresholds.length === EXPECTED.statusReports,
  dynamic: /\[\s*\(x, Theta\)\s*\|\s*x <- maybeToList meta\.theta\s*\]/.test(helpersText)
    && /\[\s*\(x, Psi\)\s*\|\s*x <- maybeToList meta\.psi\s*\]/.test(helpersText)
    && DYNAMIC_STATUS_REPORTS.join('|') === 'theta|psi',
  effects: Object.entries(EXPECTED.statusReportEffects).every(([report, expected]) => {
    const actual = statusReportBranches[report]
    return actual && JSON.stringify(actual.chaosTokens) === JSON.stringify([...expected.chaosTokens].sort())
      && JSON.stringify(actual.unlocks) === JSON.stringify([...expected.unlocks].sort())
      && JSON.stringify(actual.deckTreacheries) === JSON.stringify([...(expected.deckTreacheries || [])].sort())
      && Boolean(actual.stealsKeys) === Boolean(expected.stealsKeys)
  }),
  locale: ['alpha', 'beta', 'epsilon', 'gamma', 'zeta', 'theta', 'psi', 'omega'].every(report => Boolean(guideBase.en?.statusReport?.[report]))
    && Boolean(guideBase.zh),
}
const travelGates = {
  destinations: travelDestinations.length === EXPECTED.travelDestinations
    && JSON.stringify(stableSort(travelDestinations.map(row => row.location))) === JSON.stringify(stableSort(WORLD_MAP_IDS)),
  chapters: chapters.every(chapter => chapter.id === 'riddlesAndRain'
    ? true
    : travelDestinationByLocation.get(chapter.mapLocationId) === chapter.id),
  interludes: INTERLUDES.every(entry => entry.number === 1
    || entry.triggerLocations.every(location => travelDestinationByLocation.get(location) === `interlude${entry.number}`)),
  sideStories: GREEN_LOCATIONS.every(location => travelDestinationByLocation.get(location) === 'sideStory')
    && SIDE_STORY_LOCATIONS.join('|') === [...GREEN_LOCATIONS].join('|'),
  rules: travelRules.markTimeOnTravel && travelRules.greenDestinationExtraTime
    && travelRules.forcedTunguskaAt === FORCED_ENDGAME_TIME
    && travelRules.ticketTravelTime === 1
    && /travelWithTicket[\s\S]{0,120}?removeCampaignCard Assets\.expeditedTicket/.test(campaignText),
}
const worldMapGates = {
  nodes: parsedMap.length === EXPECTED.worldMapNodes && parsedMapIds.length === EXPECTED.worldMapNodes
    && WORLD_MAP_IDS.length === EXPECTED.worldMapNodes,
  matchesShared: JSON.stringify(parsedMap.map(node => ({ ...node, connections: [...node.connections].sort() })))
    === JSON.stringify(WORLD_MAP.map(node => ({ id: node.id, type: node.type, connections: [...node.connections].sort() }))),
  connections: mapConnectionsValid && mapSymmetric,
  green: parsedGreen.length === EXPECTED.greenLocations && parsedGreen.join('|') === GREEN_LOCATIONS.join('|'),
  initial: parsedInitialUnlocked.length + parsedGreen.length === EXPECTED.initialUnlocked
    && parsedInitialUnlocked.every(location => mapById.has(location))
    && INITIAL_UNLOCKED.length === EXPECTED.initialUnlocked,
  start: parsedStart === START_LOCATION,
  distances: Object.values(distancesFromStart).every(distance => Number.isInteger(distance))
    && parsedMap.every(node => node.id in distancesFromStart),
  localeNames: Object.keys(guideBase.en?.locations || {}).length === EXPECTED.worldMapNodes
    && parsedMap.every(node => guideBase.en.locations[node.id] && guideBase.zh.locations[node.id]),
  chapterNodes: chapters.every(chapter => mapById.has(chapter.mapLocationId)),
  archivePoints: chapters_.every(chapter => chapter.archiveLabelMatched) && chapters_.every(chapter => mapLocationNames[chapter.mapLocationId]),
}
const campaignFlowGates = {
  identity: campaignIdMatch?.[1] === CAMPAIGN_SOURCE_CODE && campaignIdMatch?.[2] === CAMPAIGN_NAME,
  steps: campaignStepsPatterns.length === EXPECTED.campaignSteps
    && campaignStepsPatterns.map(step => step.stepId).join('|') === chapters.map(chapter => chapter.code).join('|')
    && campaignStepsPatterns.every((step, index) => step.id === chapters[index].id),
  nextStep: [
    ['prologue', 'riddlesAndRain'],
    ['riddlesAndRain', 'interlude1'],
    ['interlude1', 'embark'],
    ['deadHeat', 'embark'],
    ['congressOfTheKeys', 'epilogue'],
  ].every(([from, target]) => nextStepEdges.some(edge => edge.from === from && edge.targets.includes(target)))
    && nextStepEdges.every(edge => edge.from && edge.targets.every(Boolean)),
  invalidCards: JSON.stringify(invalidCards.codes) === JSON.stringify([...INVALID_CAMPAIGN_CARDS].sort()) && invalidCards.erasedFromExistenceRule,
  epilogue: epilogue.trustRecords.length === EXPECTED.epilogueTrustRecords
    && epilogue.deceptionRecords.length === EXPECTED.epilogueDeceptionRecords
    && epilogue.counters.length === 2 && Boolean(epilogue.joinedCoterieRecord)
    && Boolean(epilogue.permanentPositionRecord) && Boolean(epilogue.dismantledRecord),
  redCoterie: redCoterie.length === EXPECTED.redCoterie
    && redCoterie.every(entry => entry.code && groupRecords.get('redCoterie')?.includes(entry.code))
    && stableSort(redCoterie.map(entry => entry.code)).join('|') === stableSort(groupRecords.get('redCoterie') || []).join('|'),
  concealed: concealedKinds.length === EXPECTED.concealedKinds
    && concealedKinds[0] === 'Decoy'
    && concealedKinds.filter(kind => kind.startsWith('Decoy')).length === 5
    && concealedKinds.every(kind => concealedUsage[kind] > 0),
  interludes: interludes.length === EXPECTED.interludes
    && interludes.filter(entry => entry.number !== 1).length === EXPECTED.dossierInterludes
    && interludes.every(entry => interludeScopes.get(entry.number) === entry.scopeId)
    && interludes.every(entry => entry.nameEn && entry.nameZh)
    && interludes.every(entry => entry.archiveLabelMatched),
  interludeTriggers: JSON.stringify(INTERLUDES.map(entry => ({ number: entry.number, locations: [...entry.triggerLocations].sort() })))
    === JSON.stringify(interludes.map(entry => ({ number: entry.number, locations: [...entry.triggerLocations].sort() }))),
  chapterMapTriggers: Object.entries(CHAPTER_MAP_TRIGGERS).every(([location, chapterId]) =>
    travelDestinationByLocation.get(location) === chapterId),
}
const reprintGates = {
  groups: reprintGroups.length === EXPECTED.reprintGroups,
  crossCycle: crossCycleReprints.length === EXPECTED.crossCycleReprints
    && crossCycleReprints.every(group => group.cycleCodes.length === 1 && group.outsideCodes.length === 1)
    && crossCycleReprints.some(group => group.codes.join('|') === '04096|09587')
    && crossCycleReprints.some(group => group.codes.join('|') === '09064|12049'),
  canonical: reprintGroups.every(group => group.codes.includes(group.canonicalCode)
    && group.canonicalCode === stableSort(group.codes)[0]
    && group.cycleCodes.every(code => canonicalOf(code) === group.canonicalCode)),
  duplicates: duplicateLinks.length === 1 && duplicateLinks[0].code === '09064'
    && outsideDuplicateLinks.length === 1 && outsideDuplicateLinks[0].code === '12049',
}
const linkedGates = {
  positions: multiRecordPositions.length === EXPECTED.multiRecordPositions && positionsCovered,
  kinds: multiRecordPositions.every(entry => ['key-stable-unstable', 'linked-pairs', 'variants'].includes(entry.kind))
    && positionKindCounts['key-stable-unstable'] === EXPECTED.keys
    && positionKindCounts.variants > 0,
  linked: linkedPairs.length === EXPECTED.linkedPairs
    && linkedPairs.every(pair => ALL_CARDS[pair.to] && ownerOf.get(pair.to) === pair.owner),
  faces: faceCodes.length === EXPECTED.faces
    && facePartners.filter(face => !orphanFaceCodes.includes(face.code))
      .every(face => face.partners.length > 0 && face.partnerOwners.length === 1
        && face.partnerOwners[0] === face.owner && face.owner !== null)
    && orphanFaceCodes.join('|') === '09606a',
  covers: multiRecordPositions.every(entry => entry.records.every(code => CYCLE_CODES.includes(code)))
    && nonMainPositions.every(position => multiRecordPositions.some(entry => entry.position === position)
      || orphanFaceCodes.some(code => code.slice(0, 5) === position)),
}
const customizableGates = {
  count: customizableCards.length === EXPECTED.customizable,
  options: customizableCards.every(card => card.optionCount > 0 && card.checkboxCount > 0
    && card.checkboxCount === card.totalChecks
    && card.options.every(option => option.checks >= 1 && option.name && option.text)),
  zeroXp: customizableCards.every(card => card.xp === 0),
  onlyCycle: CYCLE_CODES.filter(code => code < '09129' && String(ALL_CARDS[code].customizationText || '').trim()).length
    === EXPECTED.customizable,
}
const sourcesValid = sources.every(source => typeof source.sha256 === 'string' && /^[0-9a-f]{64}$/.test(source.sha256) && source.bytes > 0)
const baselineGates = Boolean(baseline)
  && /^[0-9a-f]{40}$/.test(String(baseline?.gitHead || ''))
  && baseline?.replayFile === REPLAY_BASELINE
  && baselineReplaySha256 !== null && baseline?.replaySha256 === replayBaselineSha256
  && Array.isArray(baseline?.fastFailures) && baseline.fastFailures.length > 0
  && Array.isArray(baseline?.worktree)
  && Boolean(baseline?.preExistingFailures)
  && Boolean(baseline?.complianceBaseline)
const counts = {
  main: mainCodes.length,
  faces: faceCodes.length,
  records: CYCLE_CODES.length,
  positions: positionCodes.size,
  packs: Object.fromEntries(Object.entries(CARD_PARTITIONS).map(([pack, codes]) => [pack, codes.length])),
  chapters: chapters_.length,
  encounterGroups: encounterGroups.length,
  sharedGroups: sharedGroupRecords.length,
  chapterGroups: chapterGroupRecords.length,
  investigators: INVESTIGATOR_CODES.length,
  signatures: SIGNATURE_CODES.length,
  keys: keyCards.length,
  keyRecords: KEY_IDS.length * 2,
  customizable: customizableCards.length,
  concealedKinds: concealedKinds.length,
  reprintGroups: reprintGroups.length,
  crossCycleReprints: crossCycleReprints.length,
  multiRecordPositions: multiRecordPositions.length,
  linkedPairs: linkedPairs.length,
  externalSets: externalDependencies.length,
  worldMapNodes: parsedMap.length,
  statusReports: statusReportThresholds.length,
  campaignSteps: campaignStepsPatterns.length,
  travelDestinations: travelDestinations.length,
  interludes: interludes.length,
  redCoterie: redCoterie.length,
  sources: sources.length,
  guideSources: guideSources.length,
}
const gates = {
  records: counts.main === EXPECTED.main && counts.faces === EXPECTED.faces && counts.records === EXPECTED.records
    && counts.positions === EXPECTED.positions && counts.records === counts.main + counts.faces,
  // 阶段口径（P5 起）：调查员包 playable（选人/构筑开放），战役包与一般玩家卡包仍 catalog-only。
  // 每次阶段提升只允许该阶段声明的包改变；其余包仍需 catalogOnly 且 rulesImplemented=false。
  packsRegistered: packs.length === 3
    && packs.every(pack => ['catalog-only', 'playable'].includes(pack.status))
    && packs.every(pack => (pack.id === 'tskInvestigators'
      ? pack.status === 'playable' && pack.rulesImplemented === true
      : pack.status === 'catalog-only' && pack.catalogOnly && pack.rulesImplemented === false))
    && packs.every(pack => pack.cards.length === EXPECTED.packRecords[pack.id] && pack.partitionSize === EXPECTED.packRecords[pack.id])
    && packs.every(pack => pack.cards.join('|') === stableSort(CARD_PARTITIONS[pack.id]).join('|'))
    && packs[0]?.id === 'tskCampaign' && packs[0].encounterGroupIds.join('|') === ENCOUNTER_GROUPS.join('|')
    && packs.slice(1).every(pack => pack.encounterGroupIds.length === 0),
  candidatePackScan: candidatePackScan.ranges.every(range => range.missingPositions.length === 0
    && range.outOfRange.length === 0 && range.numericCodesNotInPack.length === 0
    && range.coveredPositions === range.numericPositions)
    && candidatePackScan.cycleCodesOutsideRanges.length === 0,
  partitions: CYCLE_CODES.every(code => ownerOf.has(code))
    && new Set(ownerOf.keys()).size === CYCLE_CODES.length
    && Object.values(CARD_PARTITIONS).every(codes => codes.every(code => CYCLE_CODES.includes(code)))
    && sum(Object.values(CARD_PARTITIONS).map(codes => codes.length)) === CYCLE_CODES.length,
  sets: setOverlaps.length === 0 && flatSetCodes.length === CYCLE_CODES.length
    && stableSort(flatSetCodes).join('|') === stableSort(CYCLE_CODES).join('|'),
  encounterGroups: encounterGroups.length === EXPECTED.encounterGroups
    && chapterGroupRecords.length === EXPECTED.chapterGroups
    && sharedGroupRecords.length === EXPECTED.sharedGroups
    && sum(encounterGroups.map(group => group.records)) === EXPECTED.packRecords.tskCampaign
    && unmappedEncounterCodes.size === 0 && missingGroups.length === 0
    && Object.values(CHAPTER_ENCOUNTER_GROUPS).every(group => groupRecords.has(group)),
  keys: Object.values(keyGates).every(Boolean),
  reprints: Object.values(reprintGates).every(Boolean),
  linkedFaces: Object.values(linkedGates).every(Boolean),
  customizable: Object.values(customizableGates).every(Boolean),
  chapters: chapters_.length === EXPECTED.chapters
    && chapters_.map(chapter => chapter.id).join('|') === chapters.map(chapter => chapter.id).join('|')
    && chapters_.map(chapter => chapter.stepId).join('|') === campaignStepsPatterns.map(step => step.stepId).join('|')
    && chapters_.map(chapter => chapter.stepId).join('|') === scenarioIdsJson.map(entry => entry.id).join('|')
    && SCENARIO_REFERENCE_CODES.length === EXPECTED.chapters
    && SCENARIO_REFERENCE_CODES.every(code => ALL_CARDS[code]?.type === 'scenario')
    && chapters_.every(chapter => chapter.promptCard.type === 'scenario'
      && chapter.promptCard.text.startsWith('Easy / Standard')
      && chapter.promptCard.backText.startsWith('Hard / Expert')
      && chapter.promptCard.text.includes('[skull]') && chapter.promptCard.backText.includes('[skull]')),
  chapterSources: chapters_.every(chapter => guideSourcesValid({ bytes: scenarioSources[chapter.id].lock.bytes, sha256: chapter.sourceSha256 })),
  archiveLabels: chapters_.every(chapter => chapter.archiveLabelMatched)
    && interludes.every(entry => entry.archiveLabelMatched),
  guides: guideSources.length === EXPECTED.guideSources
    && guideSources.every(guideSourcesValid)
    && chapters_.every(chapter => chapter.guideSources.length === 2
      && chapter.guideSources.some(source => source.lang === 'en' && source.path.includes('locales/en'))
      && chapter.guideSources.some(source => source.lang === 'zh' && source.path.includes('locales/zh'))
      && chapter.guideSources.every(source => source.keyCount > 0)),
  storySources: storyCounts.en.locations === EXPECTED.worldMapNodes && storyCounts.zh.locations === EXPECTED.worldMapNodes
    && storyCounts.en.interludes === EXPECTED.interludes && storyCounts.zh.interludes === EXPECTED.interludes
    && storyCounts.en.statusReports === 9 && storyCounts.zh.statusReports === 9,
  gather: allGatheredGroups.length > 0
    && chapters_.every(chapter => chapter.gatherSets.some(gather => toGroupId(gather.set) === CHAPTER_ENCOUNTER_GROUPS[chapter.id]))
    && allGatheredGroups.every(group => ENCOUNTER_GROUPS.includes(group))
    && ENCOUNTER_GROUPS.every(group => allGatheredGroups.includes(group) || EXPECTED.campaignLevelGroups.includes(group)),
  externalDependencies: externalDependencies.length === EXPECTED.externalSets
    && externalDependencies.every(dependency => dependency.codes.length > 0 && dependency.usedBy.length > 0
      && dependency.repoDirExists && dependency.subsetCodes.every(code => ALL_CARDS[code]))
    && EXTERNAL_ENCOUNTER_DEPENDENCIES.every(dependency => gatheredExternal.has(dependency.set)),
  chaosBags: JSON.stringify(parsedChaosBags) === JSON.stringify(CHAOS_BAGS)
    && Object.entries(EXPECTED.chaosBagSizes).every(([difficulty, size]) => parsedChaosBags[difficulty]?.length === size)
    && Object.values(parsedChaosBags).every(tokens => ['skull', 'tablet', 'elderthing', 'autofail', 'eldersign'].every(token => tokens.includes(token))
      && !tokens.includes('cultist')),
  worldMap: Object.values(worldMapGates).every(Boolean),
  travel: Object.values(travelGates).every(Boolean),
  statusReports: Object.values(statusReportGates).every(Boolean),
  campaignFlow: Object.values(campaignFlowGates).every(Boolean),
  sources: sources.length === EXPECTED.sources && duplicateSources.length === 0 && sourcesValid,
  baseline: baselineGates,
  counts: counts.main === EXPECTED.main && counts.faces === EXPECTED.faces && counts.records === EXPECTED.records
    && counts.positions === EXPECTED.positions
    && Object.entries(EXPECTED.packRecords).every(([pack, count]) => counts.packs[pack] === count)
    && counts.chapters === EXPECTED.chapters && counts.encounterGroups === EXPECTED.encounterGroups
    && counts.sharedGroups === EXPECTED.sharedGroups && counts.chapterGroups === EXPECTED.chapterGroups
    && counts.investigators === EXPECTED.investigators && counts.signatures === EXPECTED.signatures
    && counts.keys === EXPECTED.keys && counts.keyRecords === EXPECTED.keyRecords
    && counts.customizable === EXPECTED.customizable && counts.concealedKinds === EXPECTED.concealedKinds
    && counts.reprintGroups === EXPECTED.reprintGroups && counts.crossCycleReprints === EXPECTED.crossCycleReprints
    && counts.multiRecordPositions === EXPECTED.multiRecordPositions && counts.linkedPairs === EXPECTED.linkedPairs
    && counts.externalSets === EXPECTED.externalSets && counts.worldMapNodes === EXPECTED.worldMapNodes
    && counts.statusReports === EXPECTED.statusReports && counts.campaignSteps === EXPECTED.campaignSteps
    && counts.travelDestinations === EXPECTED.travelDestinations && counts.interludes === EXPECTED.interludes
    && counts.redCoterie === EXPECTED.redCoterie && counts.sources === EXPECTED.sources
    && counts.guideSources === EXPECTED.guideSources,
}
const failedGates = Object.entries(gates).filter(([, pass]) => pass !== true).map(([name]) => name)
if (failedGates.length) console.error(`tsk scope gate 未通过：${failedGates.join(', ')}`)

// 20 账本：P0 用 M0 范围与来源锁；P1 起按同一 scope 复算机制扫描。
export function buildScope() {
  return {
    schemaVersion: 1,
    cycle: 'tsk',
    cycleName: CAMPAIGN_NAME,
    cycleNameZh: CAMPAIGN_NAME_ZH,
    campaignId: CAMPAIGN_ID,
    sourceCampaignCode: CAMPAIGN_SOURCE_CODE,
    milestone: 'M0',
    step: 'P0 范围与来源锁',
    generatedBy: 'tools/scan-tsk-scope.mjs',
    docs: DOCS,
    status: 'catalog-only',
    sourceRoot: REFERENCE_ROOT,
    counts,
    sources: sourcePaths.map(path => {
      const source = sources.find(entry => entry.path === path)
      return { path, bytes: source.bytes, sha256: source.sha256 }
    }),
    packs,
    candidatePackScan,
    cards,
    reprintGroups,
    crossCycleReprints,
    duplicateLinks,
    outsideDuplicateLinks,
    keyCards,
    externalKeyCards,
    keyAwardSites: keyAwardSites.map(site => {
      const definition = keyDefs.find(entry => entry.sourceVar === site.key)
      return { key: site.key, cardId: definition?.id || null, scope: site.scope }
    }),
    customizableCards,
    partitions: Object.fromEntries(Object.entries(CARD_PARTITIONS).map(([pack, codes]) => [pack, [...codes]])),
    sets,
    encounterGroups,
    multiRecordPositions,
    linkedPairs,
    nonMainPositions,
    orphanFaceCodes,
    chapters: chapters_,
    chaosBags: CHAOS_BAGS,
    chaosBagsSource: { path: HELPERS_SOURCE, sha256: lock(HELPERS_SOURCE).sha256, parsed: parsedChaosBags, matches: JSON.stringify(parsedChaosBags) === JSON.stringify(CHAOS_BAGS) },
    worldMap: {
      source: META_SOURCE,
      sha256: lock(META_SOURCE).sha256,
      startLocation: parsedStart,
      greenLocations: parsedGreen,
      initialUnlockedDestinations: parsedInitialUnlocked,
      initialUnlocked: [...parsedInitialUnlocked, ...parsedGreen],
      nodes: parsedMap,
      connectionsValid: mapConnectionsValid,
      connectionsSymmetric: mapSymmetric,
      distancesFromStart,
      locationNames: mapLocationNames,
    },
    campaignFlow: {
      source: CAMPAIGN_SOURCE,
      sha256: lock(CAMPAIGN_SOURCE).sha256,
      campaignStepsSource: CAMPAIGN_STEPS_SOURCE,
      campaignStepsSourceSha256: lock(CAMPAIGN_STEPS_SOURCE).sha256,
      campaignId: campaignIdMatch?.[1] || null,
      campaignName: campaignIdMatch?.[2] || null,
      steps: campaignStepsPatterns.map((step, index) => ({ id: step.id, pattern: step.pattern, stepId: step.stepId, order: index + 1, chapterId: chapters[index]?.id || null })),
      nextStepEdges,
      travelDestinations,
      travelRules,
      statusReports: statusReportThresholds,
      statusReportEffects: statusReportBranches,
      dynamicStatusReports: DYNAMIC_STATUS_REPORTS,
      interludes: interludes.map(entry => ({
        number: entry.number, scopeId: entry.scopeId, nameEn: entry.nameEn, nameZh: entry.nameZh,
        archiveLabel: entry.archiveLabel, triggerLocations: entry.triggerLocations,
      })),
      invalidCards,
      redCoterie,
      epilogue,
      concealedMiniCards: {
        source: CONCEALED_KIND_SOURCE,
        sha256: lock(CONCEALED_KIND_SOURCE).sha256,
        kinds: concealedKinds,
        decoyKinds: concealedKinds.filter(kind => kind.startsWith('Decoy')),
        usageCounts: concealedUsage,
        note: '隐匿迷你卡与诱饵不是卡表卡号，属战役虚拟实体（P2 建原语、P4 做交互）；'
          + '真实敌人/地点变体通过多记录卡位关联到具体卡号（P1 映射）。',
      },
      expeditionTicket: {
        cardCode: '09765',
        travelTime: 1,
        rule: '放逐快捷旅票并记 1 时间，直达任意目的地（参考 travelWithTicket）。',
      },
    },
    externalDependencies,
    guideSources: guideSources.map(source => ({ lang: source.lang, scope: source.scope, path: source.path, bytes: source.bytes, sha256: source.sha256, keyCount: source.keyCount })),
    storySources: { en: { ...lock(guideBasePath('en')), ...storyCounts.en }, zh: { ...lock(guideBasePath('zh')), ...storyCounts.zh } },
    cardImages: {
      english: 'web/img/cards/',
      chinese: 'web/img/zh/cards/',
      remoteFallback: ['imagesrc', 'backimagesrc'],
      cycleCopies: false,
      recordsWithRemoteImage: cards.filter(card => Boolean(ALL_CARDS[card.code].imagesrc)).length,
      recordsWithBackRemoteImage: cards.filter(card => Boolean(ALL_CARDS[card.code].backimagesrc)).length,
      note: '本地卡图缓存（web/img/**）被忽略，不计入账本；运行时不依赖参考资源，继续走远程回退',
    },
    baseline,
    pending,
    gates,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('scope', buildScope())

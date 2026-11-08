#!/usr/bin/env node
// 七循环《地球边缘》（Edge of the Earth）P0（M0）范围与来源账本：P1 的唯一事实源。
//
//   node tools/scan-eote-scope.mjs --write   生成 audit/eote-scope.json（并镜像 artifacts/migration/eote/scope.json）
//   node tools/scan-eote-scope.mjs --check   复算并与磁盘逐字节比对（来源 / 归属 / 数据变化即失败）
//   node tools/scan-eote-scope.mjs           打印 JSON（report 模式，不写盘；门禁失败时仍然抛错退出非零）
//
// 口径（docs/edgeOfTheEarth/README.md §2/§4/§5）：
//   · 403 条印刷记录 = 367 主卡 + 36 关联面；三包 266 / 22 / 115，无重叠、无遗漏；
//   · 24 个遭遇组 = 8 个单章组 + 16 个跨章 / 战役级共享组，组卡合计 266（186 + 80）；
//   · 8 章 = 5 张印刷提示卡（08501/08549/08596/08621/08648）拆成 8 个 ScenarioStep；
//     《亡命冰原》I–III 与《疯狂之心》I–II 的 a/b/c 拆分号不是卡表卡号；
//   · 来源逐文件锁 SHA-256（referenceFiles() 当前 313 个文件），基线嵌入 audit/eote-baseline.json；
//   · 分片索引 M1/M2/M3 两两无交集、并集 = 403；四类集合（调查员 / 一般玩家 / 共享组 / 章节组）同样守恒。
//
// 状态不手写：三包清单读 content/packs/eote*/manifest.js，卡号归属 / 章节 / 遭遇组 / 混乱袋读
// content/campaigns/edgeOfTheEarth/shared.js；参考实现与剧情只读，本工具只复算、对账，把不一致写成 gate。
// 时间戳与 gitHead 不入本账本（提交会变，账本要能长期复算）；基线快照另存 audit/eote-baseline.json。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  CAMPAIGN_ID, CANDIDATE_RANGES, CARD_PARTITIONS, CHAOS_BAGS, CHAPTER_ENCOUNTER_GROUPS,
  CYCLE_CODES, CYCLE_PACKS, DISCIPLINE_CODES, ENCOUNTER_GROUPS, INVESTIGATOR_CODES,
  SCENARIO_REFERENCE_CODES, SHARED_ENCOUNTER_GROUPS, chapters, toCamelCase,
} from '../content/campaigns/edgeOfTheEarth/shared.js'
import { manifest as campaignPackManifest } from '../content/packs/eoteCampaign/manifest.js'
import { manifest as investigatorsPackManifest } from '../content/packs/eoteInvestigators/manifest.js'
import { manifest as playerPackManifest } from '../content/packs/eotePlayer/manifest.js'
import { MOD, REFERENCE, emit, readJson, referenceFiles, sha, sourceLock } from './eote-migration-lib.mjs'

const REFERENCE_ROOT = '参考资源/ArkhamHorror-main'
const DOCS = 'docs/edgeOfTheEarth/README.md'
const CAMPAIGN_SOURCE = 'backend/arkham-api/library/Arkham/Campaign/Campaigns/EdgeOfTheEarth.hs'
const CAMPAIGN_STEPS_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/CampaignSteps.hs'
const HELPERS_SOURCE = 'backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/Helpers.hs'
const SCENARIO_DIR = 'backend/arkham-api/library/Arkham/Scenario/Scenarios/EdgeOfTheEarth'
const SCENARIO_IDS_SOURCE = 'frontend/src/arkham/data/edgeOfTheEarth.json'
const GUIDE_DIR = 'frontend/src/locales'
const REPLAY_BASELINE = 'tests/fixtures/replay/eote-baseline.json'
const BASELINE_SOURCE = 'audit/eote-baseline.json'

// M0 硬口径：数字来自路线图 §2/§4/§5 与 shared.js 的目录身份注释，任何一项偏离都会让对应 gate 失败。
const EXPECTED = Object.freeze({
  main: 367,
  faces: 36,
  records: 403,
  packRecords: Object.freeze({ eoteCampaign: 266, eoteInvestigators: 22, eotePlayer: 115 }),
  chapters: 8,
  encounterGroups: 24,
  chapterGroups: 8,
  sharedGroups: 16,
  investigators: 5,
  signatures: 9,
  disciplines: 8,
  referenceCards: 5,
  reprintGroups: 4,
  duplicateLinks: 3,
  parallelAlternates: 5,
  externalSets: Object.freeze(['AncientEvils', 'ChillingCold', 'LockedDoors', 'StrikingFear']),
  // 共享遭遇组里不进入任何章节 gather、由战役流程直接处理的三组（伙伴 / 忒咳哩-哩 / 纪念逝者）。
  campaignLevelGroups: Object.freeze(['expeditionTeam', 'tekelili', 'memorialsOfTheLost']),
  chaosBagSizes: Object.freeze({ easy: 16, standard: 17, hard: 18, expert: 18 }),
  frostCounts: Object.freeze({ easy: 0, standard: 1, hard: 2, expert: 3 }),
  sources: 313,
  guideSources: 12,
  campaignSteps: 16,
})

const stableSort = values => [...values].sort()
const sum = values => values.reduce((total, value) => total + value, 0)
const camelToWords = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
const camelToSnake = value => camelToWords(value).toLowerCase().replace(/ /g, '_')
const isMain = code => /^\d{5}$/.test(code)
const isFace = code => /^\d{5}[a-z]$/.test(code)

const readReference = path => readFileSync(join(REFERENCE, path), 'utf8')
const referenceExists = path => existsSync(join(REFERENCE, path))
const readReferenceJson = path => JSON.parse(readReference(path).replace(/^\uFEFF/, ''))
const scenarioIdsJson = referenceExists(SCENARIO_IDS_SOURCE) ? readReferenceJson(SCENARIO_IDS_SOURCE) : []
// 来源缺失时不抛异常，而是写出 bytes=0 / sha256=null，让 gate 如实失败（便于报告来源漂移）。
const lock = path => (referenceExists(path) ? sourceLock(path) : { path: path.replaceAll('\\', '/'), bytes: 0, sha256: null })
const readRepoJson = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)

// 01 参考实现 / 剧情路径（相对于参考根目录）。
const pascal = value => value[0].toUpperCase() + value.slice(1)
const scenarioSourceOf = chapterId => `${SCENARIO_DIR}/${pascal(chapterId)}.hs`
// 指南文件名与分篇键：iceAndDeathPart1 → scenarios/iceAndDeath.json 的 part1 子树。
const guideOf = chapterId => {
  const partMatch = chapterId.match(/Part(\d)$/)
  const base = partMatch ? chapterId.slice(0, -partMatch[0].length) : chapterId
  return { file: `${base[0].toLowerCase()}${base.slice(1)}`, part: partMatch ? `part${partMatch[1]}` : null }
}
const guidePath = (lang, file) => `${GUIDE_DIR}/${lang}/edgeOfTheEarth/scenarios/${file}.json`
const guideBasePath = lang => `${GUIDE_DIR}/${lang}/edgeOfTheEarth/base.json`
const GUIDE_FILES = stableSort([...new Set(chapters.map(chapter => guideOf(chapter.id).file))])

// 02 卡表复算：全集、主卡 / 面、三包分区。
const cardsByCode = new Map(CYCLE_CODES.map(code => [code, ALL_CARDS[code]]))
const mainCodes = CYCLE_CODES.filter(isMain)
const faceCodes = CYCLE_CODES.filter(isFace)
const ownerOf = new Map()
for (const [pack, codes] of Object.entries(CARD_PARTITIONS)) {
  for (const code of codes) ownerOf.set(code, pack)
}

// 03 重印 / 同印刷身份分组：与 TIC/TDE 同一 identityKey 口径，复算全卡池后只保留涉及本循环的组。
// canonical = 组内最小卡号；P0 只锁映射，不建别名 / 行为实现（P5–P6 再做）。
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
    const linked = codes.some(code => (ALL_CARDS[code].duplicatedBy || []).some(other => codes.includes(other)))
    const canonicalCode = codes[0]
    return {
      canonicalCode,
      codes,
      cycleCodes: codes.filter(code => CYCLE_CODES.includes(code)),
      outsideCodes: codes.filter(code => !CYCLE_CODES.includes(code)),
      basis: linked ? 'duplicateOfCode-duplicatedBy' : 'identical-printed-identity',
      aliasRegistration: 'P5–P6；本次只锁定映射，不新建行为或别名实现',
    }
  })
  .sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode))
const canonicalOf = code => reprintGroups.find(group => group.codes.includes(code))?.canonicalCode || code

// 04 重印链接与平行 / 替换卡（禁止 canonical 化）。
const duplicateLinks = stableSort(CYCLE_CODES.filter(code => (ALL_CARDS[code].duplicatedBy || []).length))
  .map(code => ({
    code,
    name: ALL_CARDS[code].name,
    duplicateOfCode: ALL_CARDS[code].duplicateOfCode || null,
    duplicatedBy: stableSort(ALL_CARDS[code].duplicatedBy || []),
    canonicalCode: canonicalOf(code),
  }))
// 4.1 调查员 `deckRequirements.card` 里同一专属卡的替代编号（书附 / 平行版本）。
const signatureAlternates = INVESTIGATOR_CODES.flatMap(investigatorCode => {
  const requirements = ALL_CARDS[investigatorCode].deckRequirements || {}
  return Object.entries(requirements.card || {}).flatMap(([signatureCode, variants]) => {
    const baseCode = ALL_CARDS[signatureCode] ? signatureCode : Object.keys(variants).find(code => ALL_CARDS[code])
    if (!baseCode) return []
    return Object.keys(variants)
      .filter(code => code !== baseCode)
      .map(alternateCode => ({
        baseCode, alternateCode, kind: 'signature-replacement', basis: 'deckRequirements.card',
        investigatorCode,
      }))
  })
})
// 4.2 平行调查员：卡表 `alternatedBy` 反向登记（90062 = 平行蒙特雷·杰克）。
const parallelInvestigatorAlternates = CYCLE_CODES.filter(code => (ALL_CARDS[code].alternatedBy || []).length)
  .flatMap(baseCode => stableSort(ALL_CARDS[baseCode].alternatedBy).map(alternateCode => ({
    baseCode, alternateCode, kind: 'parallel-investigator', basis: 'alternatedBy',
    investigatorCode: baseCode,
  })))
const parallelAlternates = [...signatureAlternates, ...parallelInvestigatorAlternates]
  .map(({ baseCode, alternateCode, kind, basis }) => ({ baseCode, alternateCode, kind, basis }))
  .sort((a, b) => a.baseCode.localeCompare(b.baseCode) || a.alternateCode.localeCompare(b.alternateCode))

// 05 遭遇组：eoec 记录的 encounterCode → camelCase id，逐组对账。
const toCamelSetName = value => `${value[0].toLowerCase()}${value.slice(1)}` // PascalCase 集合名 → 内容层组 id
const groupRecords = new Map(ENCOUNTER_GROUPS.map(id => [id, []]))
const unmappedEncounterCodes = new Set()
for (const code of CARD_PARTITIONS.eoteCampaign) {
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
    encounterCode: codes.length ? ALL_CARDS[codes[0]].encounterCode : null,
    kind: chapterId ? 'chapter' : 'shared',
    chapterId,
    main: codes.filter(isMain).length,
    faces: codes.filter(isFace).length,
    records: codes.length,
  }
})
const missingSharedGroups = ENCOUNTER_GROUPS.filter(group => (groupRecords.get(group) || []).length === 0)
const declaredChapterGroups = Object.values(CHAPTER_ENCOUNTER_GROUPS)

// 06 章节来源：每章锁一个参考 Scenario .hs，并解析 gather 调用（mode / 子集）。
const parseGatherSets = text => {
  const rows = []
  for (const match of text.matchAll(/gather(AndSetAside|Just)?\s+Set\.(\w+)(?:\s+\[([^\]]+)\])?/g)) {
    const mode = match[1] === 'AndSetAside' ? 'gatherAndSetAside' : match[1] === 'Just' ? 'gatherJust' : 'gather'
    const set = match[2]
    if (rows.some(row => row.set === set && row.mode === mode)) continue
    const row = { set, mode }
    if (match[3]) {
      const ids = match[3].split(',').map(part => part.trim().replace(/^[A-Za-z]*\./, '')).filter(Boolean)
      // 子集用卡名反查：`Treacheries.frozenInFear` → 卡池里的 “Frozen in Fear”，避免大小写 / 空格口径漂移；
      // 优先限定在同一遭遇组（同名卡可能跨循环重印，如 03226 同名卡不属于 Striking Fear）。
      const nameKey = value => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase()
      const encounterName = camelToWords(set)
      const candidates = Object.values(ALL_CARDS).filter(card => card.encounterName === encounterName)
      const pool = candidates.length ? candidates : Object.values(ALL_CARDS)
      const subsetCards = ids.flatMap(id => pool.filter(card => nameKey(card.name) === nameKey(id)))
      const camelToTitle = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase())
      row.subset = stableSort(ids.map(id => subsetCards.find(card => nameKey(card.name) === nameKey(id))?.name || camelToTitle(id)))
      row.subsetCodes = stableSort([...new Set(subsetCards.map(card => card.code))])
    }
    rows.push(row)
  }
  return rows.sort((a, b) => (a.set === b.set ? a.mode.localeCompare(b.mode) : a.set.localeCompare(b.set)))
}
const scenarioSources = Object.fromEntries(chapters.map(chapter => {
  const path = scenarioSourceOf(chapter.id)
  const text = referenceExists(path) ? readReference(path) : ''
  return [chapter.id, { path, text, gatherSets: parseGatherSets(text), lock: lock(path) }]
}))

// 07 战役流程：CampaignSteps.hs 的 8 个 ScenarioStep + EdgeOfTheEarth.hs#nextStep / RunMessage 转移。
const campaignText = referenceExists(CAMPAIGN_SOURCE) ? readReference(CAMPAIGN_SOURCE) : ''
const campaignStepsText = referenceExists(CAMPAIGN_STEPS_SOURCE) ? readReference(CAMPAIGN_STEPS_SOURCE) : ''
const campaignStepPatterns = [...campaignStepsText.matchAll(/pattern (\w+) :: CampaignStep\npattern \1 <- ScenarioStep "([^"]+)"/g)]
  .map(match => ({ pattern: match[1], stepId: match[2], id: toCamelSetName(match[1]) }))
const scenarioIdOfName = new Map(campaignStepPatterns.map(step => [step.pattern, step.id]))
const normalizeStep = raw => {
  if (!raw) return null
  if (raw === 'PrologueStep') return 'prologue'
  if (raw === 'EpilogueStep') return 'epilogue'
  const checkpoint = raw.match(/^CheckpointStep (\d+)$/)
  if (checkpoint) return `checkpoint${checkpoint[1]}`
  const interlude = raw.match(/^InterludeStep(?:Part)? (\d+)/)
  if (interlude) return `interlude${interlude[1]}`
  if (scenarioIdOfName.has(raw)) return scenarioIdOfName.get(raw)
  return null
}
const parseStepTargets = text => {
  const targets = []
  for (const match of text.matchAll(/continue \$? ?([A-Za-z]\w*(?: \d+)?)/g)) {
    const id = normalizeStep(match[1])
    if (id && !targets.includes(id)) targets.push(id)
  }
  return targets
}
// 7.1 nextStep 函数体 → { from, targets }。
const nextStepEdges = (() => {
  const start = campaignText.indexOf('nextStep a = case')
  const end = campaignText.indexOf('other -> defaultNextStep other', start)
  if (start < 0 || end < 0) return []
  const body = campaignText.slice(start, end)
  const chunks = body.split(/\n    (?=[A-Za-z]\w* ->)/).slice(1)
  return chunks.map(chunk => {
    const from = normalizeStep(chunk.match(/^(\w+) ->/)?.[1] || null)
    return from ? { from, targets: parseStepTargets(chunk) } : null
  }).filter(Boolean)
})()
// 7.2 RunMessage 的 case 分支 → { from, targets }（检查点 / 幕间 / 序章的转移都在这里）。
const runBlocks = (() => {
  const start = campaignText.indexOf('instance RunMessage EdgeOfTheEarth')
  if (start < 0) return []
  const blocks = []
  let current = null
  for (const line of campaignText.slice(start).split('\n')) {
    if (/^      \S/.test(line)) {
      if (current) blocks.push(current)
      current = { header: line.trim(), lines: [] }
    } else if (current) current.lines.push(line)
  }
  if (current) blocks.push(current)
  return blocks.map(block => {
    const from = normalizeStep(block.header.match(/CampaignStep\s*\(?\s*([A-Za-z]\w*(?: \d+)?)/)?.[1] || null)
    return { ...block, from, targets: parseStepTargets(block.lines.join('\n')) }
  })
})()
const handlerEdges = (() => {
  const merged = new Map()
  for (const block of runBlocks) {
    if (!block.from) continue
    if (!merged.has(block.from)) merged.set(block.from, [])
    for (const target of block.targets) if (!merged.get(block.from).includes(target)) merged.get(block.from).push(target)
  }
  return [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([from, targets]) => ({ from, targets }))
})()
const edgeTargetsOf = (from, edges) => edges.filter(edge => edge.from === from).flatMap(edge => edge.targets)
const prologueLabels = (() => {
  const block = runBlocks.find(entry => /^CampaignStep PrologueStep/.test(entry.header))
  if (!block) return {}
  return Object.fromEntries([...block.lines.join('\n').matchAll(/labeled "([^"]+)"[\s\S]{0,120}?doStep (\d+)/g)]
    .map(match => [match[2], match[1]]))
})()
const prologueChaosTokens = runBlocks
  .filter(block => /addChaosToken [A-Za-z]+/.test(block.lines.join('\n')))
  .map(block => {
    const stepNumber = block.header.match(/DoStep (\d+)/)?.[1] || null
    return {
      step: stepNumber ? Number(stepNumber) : null,
      branch: stepNumber ? prologueLabels[stepNumber] || null : null,
      token: block.lines.join('\n').match(/addChaosToken ([A-Za-z]+)/)?.[1].toLowerCase() || null,
      record: block.lines.join('\n').match(/record ([A-Za-z]+)/)?.[1] || null,
    }
  })
  .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
// 7.3 游玩顺序：序幕 → CampaignSteps.hs 的 8 章（跟随 nextStep 的检查点 / 幕间 / 尾声）。
const stepKinds = { checkpoint: 'checkpoint', interlude: 'interlude', epilogue: 'epilogue' }
const campaignSteps = (() => {
  const steps = []
  const push = (id, kind, stepType, source) => {
    if (!id || steps.some(step => step.id === id)) return
    steps.push({ id, kind, stepType, source, next: [] })
  }
  push('prologue', 'prologue', 'PrologueStep', `${CAMPAIGN_SOURCE}#RunMessage`)
  for (const pattern of campaignStepPatterns) {
    push(pattern.id, 'scenario', `ScenarioStep "${pattern.stepId}"`, `${CAMPAIGN_STEPS_SOURCE}#${pattern.pattern}`)
    for (const target of edgeTargetsOf(pattern.id, nextStepEdges)) {
      const kindKey = Object.keys(stepKinds).find(kind => target.startsWith(kind))
      if (kindKey) push(target, stepKinds[kindKey], target, `${CAMPAIGN_SOURCE}#nextStep`)
    }
  }
  return steps.map((step, index) => {
    const next = [...new Set([...edgeTargetsOf(step.id, nextStepEdges), ...edgeTargetsOf(step.id, handlerEdges)])]
    return { ...step, order: index + 1, next }
  })
})()
const fatalMirageEntryPoints = handlerEdges.filter(edge => edge.targets.includes('fatalMirage')).map(edge => edge.from)

// 08 帷幕外依赖：非本循环的 gather 集合 = 核心遭遇组（StrikingFear 只取两张子集）。
const cardsOfEncounterSet = set => Object.values(ALL_CARDS)
  .filter(card => card.encounterName === camelToWords(set))
  .map(card => card.code)
  .sort()
const gatheredExternal = new Map()
for (const chapter of chapters) {
  for (const gather of scenarioSources[chapter.id].gatherSets) {
    const groupId = toCamelSetName(gather.set)
    if (ENCOUNTER_GROUPS.includes(groupId)) continue
    if (!gatheredExternal.has(gather.set)) gatheredExternal.set(gather.set, { chapters: [], subsets: [] })
    const entry = gatheredExternal.get(gather.set)
    if (!entry.chapters.includes(chapter.id)) entry.chapters.push(chapter.id)
    if (gather.subset) entry.subsets.push(...gather.subset)
  }
}
const externalDependencies = stableSort(gatheredExternal.keys()).map(set => {
  const entry = gatheredExternal.get(set)
  const repoDir = `src/cards/encounter-entries/shared/${camelToSnake(set)}`
  const subset = stableSort([...new Set(entry.subsets)])
  return {
    set,
    chapters: stableSort(entry.chapters),
    usedBy: stableSort(entry.chapters),
    codes: cardsOfEncounterSet(set),
    repoDir,
    repoDirExists: existsSync(join(MOD, repoDir)),
    note: subset.length ? `参考实现只 gather 子集：${subset.join(' / ')}（不是整组）` : null,
  }
})

// 09 混乱袋：Helpers.hs#chaosBagContents 解析并对账 shared.js CHAOS_BAGS（含 [frost]）。
const TOKEN_NAMES = Object.freeze({
  Skull: 'skull', Cultist: 'cultist', Tablet: 'tablet', ElderThing: 'elderthing',
  AutoFail: 'autofail', ElderSign: 'eldersign', frost: 'frost',
})
const parseChaosToken = raw => {
  const value = raw.trim()
  const quoted = value.match(/^#?"([^"]*)"$/)
  if (quoted) return quoted[1]
  const identifier = value.match(/^#?([A-Za-z][A-Za-z0-9]*)$/)
  return identifier && TOKEN_NAMES[identifier[1]] ? TOKEN_NAMES[identifier[1]] : null
}
const helpersText = referenceExists(HELPERS_SOURCE) ? readReference(HELPERS_SOURCE) : ''
const parsedChaosBags = Object.fromEntries(
  [...helpersText.matchAll(/(Easy|Standard|Hard|Expert) -> \[([^\]]+)\]/g)]
    .map(match => [match[1].toLowerCase(), match[2].split(',').map(parseChaosToken).filter(Boolean)]),
)
const chaosBagFrostCounts = Object.fromEntries(
  Object.entries(parsedChaosBags).map(([difficulty, tokens]) => [difficulty, tokens.filter(token => token === 'frost').length]),
)

// 10 指南来源与分篇覆盖：每章 2 个语言文件；分篇章节按 partN 子树计叶子键数（P1 缺译扫描证据）。
const countGuideLeaves = value => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return 1
  if (Array.isArray(value)) return value.reduce((total, item) => total + countGuideLeaves(item), 0)
  if (value && typeof value === 'object') return Object.values(value).reduce((total, item) => total + countGuideLeaves(item), 0)
  return 0
}
const guideFileCache = new Map()
const guideJson = (lang, file) => {
  const path = guidePath(lang, file)
  if (!guideFileCache.has(path)) guideFileCache.set(path, referenceExists(path) ? readReferenceJson(path) : null)
  return guideFileCache.get(path)
}
const chapterGuideParts = Object.fromEntries(chapters.map(chapter => {
  const guide = guideOf(chapter.id)
  const keyCounts = {}
  for (const lang of ['en', 'zh']) {
    const json = guideJson(lang, guide.file)
    const subtree = json && guide.part ? json[guide.part] : json
    keyCounts[lang] = countGuideLeaves(subtree)
  }
  return [chapter.id, { ...guide, keyCounts }]
}))
const baseGuideSources = ['en', 'zh'].map(lang => lock(guideBasePath(lang)))
const guideSources = [
  ...baseGuideSources.map((source, index) => ({ lang: ['en', 'zh'][index], ...source })),
  ...GUIDE_FILES.flatMap(file => ['en', 'zh'].map(lang => ({ lang, ...lock(guidePath(lang, file)) }))),
]

// 11 章节账本：shared.js 身份 + 参考 .hs + gather + 提示卡 + 指南。
const chapters_ = chapters.map(chapter => {
  const source = scenarioSources[chapter.id]
  const prompt = ALL_CARDS[chapter.code]
  const guide = chapterGuideParts[chapter.id]
  return {
    ...chapter,
    ownGroup: CHAPTER_ENCOUNTER_GROUPS[chapter.id],
    source: source.path,
    sourceSha256: source.lock.sha256,
    gatherSets: source.gatherSets,
    promptCard: {
      code: chapter.referenceCode,
      name: prompt?.name || '',
      type: prompt?.type || null,
      text: prompt?.text || '',
      backText: prompt?.backText || '',
    },
    guideSources: ['en', 'zh'].map(lang => ({ lang, ...lock(guidePath(lang, guide.file)) })),
    guideKeyCounts: guide.keyCounts,
    guidePartKey: guide.part,
  }
})

// 12 章节 / 共享组 / 一般玩家卡 / 调查员四类集合 + 遭遇组分片草案（M1/M2/M3）。
const sets = {
  investigators: { codes: stableSort(CARD_PARTITIONS.eoteInvestigators) },
  player: { codes: stableSort(CARD_PARTITIONS.eotePlayer) },
  sharedGroups: SHARED_ENCOUNTER_GROUPS.map(group => ({ group, codes: groupRecords.get(group) || [] })),
  chapterGroups: chapters.map(chapter => ({
    chapterId: chapter.id,
    group: CHAPTER_ENCOUNTER_GROUPS[chapter.id],
    codes: groupRecords.get(CHAPTER_ENCOUNTER_GROUPS[chapter.id]) || [],
  })),
}
const chunkCodes = (codes, size) => Array.from({ length: Math.ceil(codes.length / size) }, (_, index) => codes.slice(index * size, (index + 1) * size))
const playerWaves = chunkCodes(stableSort(CARD_PARTITIONS.eotePlayer), 30)
  .map((codes, index) => ({ id: `M2-${index + 1}`, codes }))
const chapterShards = chapters.map(chapter => {
  const records = groupRecords.get(CHAPTER_ENCOUNTER_GROUPS[chapter.id]) || []
  // 单章组 > 50 条时拆主卡 / 关联面两片（本循环只有 fatalMirage 的 75 条触发）。
  if (records.length > 50) {
    return {
      chapterId: chapter.id,
      shards: [
        { id: `M3-${chapter.id}`, codes: records.filter(isMain) },
        { id: `M3-${chapter.id}-faces`, codes: records.filter(isFace) },
      ],
    }
  }
  return { chapterId: chapter.id, shards: [{ id: `M3-${chapter.id}`, codes: [...records] }] }
})
const sharedGroupRecords = stableSort(SHARED_ENCOUNTER_GROUPS.flatMap(group => groupRecords.get(group) || []))
const sharedShards = chunkCodes(sharedGroupRecords, 40).map((codes, index) => ({ id: `M3-shared-groups-${index + 1}`, codes }))
const shards = {
  investigators: { id: 'M1', codes: stableSort(CARD_PARTITIONS.eoteInvestigators) },
  playerWaves,
  chapters: chapterShards,
  sharedGroups: { groups: [...SHARED_ENCOUNTER_GROUPS], shards: sharedShards },
}
const shardIndex = [
  shards.investigators,
  ...shards.playerWaves,
  ...shards.chapters.flatMap(chapter => chapter.shards),
  ...shards.sharedGroups.shards,
]
const shardSeen = new Map()
const shardOverlaps = []
for (const shard of shardIndex) {
  for (const code of shard.codes) {
    if (shardSeen.has(code)) shardOverlaps.push({ code, shards: [shardSeen.get(code), shard.id] })
    else shardSeen.set(code, shard.id)
  }
}
const shardMissing = CYCLE_CODES.filter(code => !shardSeen.has(code))

// 13 候选包扫描：连续编号只是首轮候选，逐号与卡包归属对账。
const candidatePackScan = {
  ranges: CANDIDATE_RANGES.map(range => {
    const numericFrom = Number(range.from)
    const numericTo = Number(range.to)
    const positions = Array.from({ length: numericTo - numericFrom + 1 }, (_, index) => String(numericFrom + index).padStart(5, '0'))
    const packCodes = CYCLE_CODES.filter(code => ALL_CARDS[code].pack === range.pack)
    const prefixes = new Set(packCodes.map(code => code.slice(0, 5)))
    const missingPositions = positions.filter(position => !prefixes.has(position))
    const outOfRange = packCodes.filter(code => code.slice(0, 5) < range.from || code.slice(0, 5) > range.to)
    const numericCodesNotInPack = positions.filter(position => ALL_CARDS[position] && !CYCLE_CODES.includes(position))
    return {
      pack: range.pack,
      from: range.from,
      to: range.to,
      numericPositions: positions.length,
      coveredPositions: prefixes.size,
      records: packCodes.length,
      main: packCodes.filter(isMain).length,
      faces: packCodes.filter(isFace).length,
      missingPositions,
      outOfRange,
      numericCodesNotInPack,
    }
  }),
  cycleCodesOutsideRanges: CYCLE_CODES.filter(code => {
    const prefix = code.slice(0, 5)
    return !CANDIDATE_RANGES.some(range => prefix >= range.from && prefix <= range.to)
  }),
}

// 14 卡包清单（content/packs/eote*/manifest.js）：身份 + 卡号 + 遭遇组。P5 起调查员包为 playable，其余两包仍 catalog-only。
const packManifests = Object.fromEntries([
  ['eoteCampaign', campaignPackManifest],
  ['eoteInvestigators', investigatorsPackManifest],
  ['eotePlayer', playerPackManifest],
])
const packs = Object.entries(CARD_PARTITIONS).map(([pack, codes]) => {
  const manifest = packManifests[pack]
  return {
    id: manifest.id,
    status: manifest.status,
    cards: stableSort((manifest.cards || []).map(card => card.code)),
    cardRanges: (manifest.cardRanges || []).map(range => ({ from: range.from, to: range.to })),
    encounterGroupIds: [...(manifest.encounterGroupIds || [])],
    rulesImplemented: (manifest.cards || []).some(card => card.rulesImplemented === true),
    catalogOnly: (manifest.cards || []).every(card => card.cataloged === true && card.rulesImplemented === false),
  }
})

// 15 全部 403 条记录（P1 逐卡事实源）。
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
    face: isFace(code),
    linkedToCode: card.linkedToCode || null,
    linkedCode: card.linkedCardCode || null,
    duplicateOfCode: card.duplicateOfCode || null,
    duplicatedBy: stableSort(card.duplicatedBy || []),
    canonicalCode: canonicalOf(code),
    sourceCard: `frontend/public/cards.json#${code}`,
    text: card.text || '',
    backText: card.backText || '',
  }
})
const recordsWithRemoteImage = cards.filter(card => Boolean(ALL_CARDS[card.code].imagesrc)).length
const recordsWithBackRemoteImage = cards.filter(card => Boolean(ALL_CARDS[card.code].backimagesrc)).length

// 16 基线：P0 一次性快照由 tools/scan-eote-baseline.mjs 生成并嵌入；replay 文件哈希在此复核。
const baseline = readRepoJson(BASELINE_SOURCE)
const replayBaselineBytes = existsSync(join(MOD, REPLAY_BASELINE)) ? readFileSync(join(MOD, REPLAY_BASELINE)) : null
const replayBaselineSha256 = replayBaselineBytes ? sha(replayBaselineBytes) : null
const baselineReplayPath = baseline?.replayFile
const baselineDeclaredSha256 = baseline?.replaySha256 || baseline?.replayFileSha256 || null

// 17 待 P1 复核的来源 / 文档不一致（不修改数据，不伪造 verified）。
// 忒咳哩-哩牌库印刷份数从参考 CardDefs 解析（7 张卡面 × 份数 = 16 张牌库），用于对齐 README 的区间表述。
const TEKELILI_DEFS_SOURCE = 'backend/arkham-api/library/Arkham/Treachery/CardDefs/EdgeOfTheEarth/Tekelili.hs'
const tekeliliQuantities = referenceExists(TEKELILI_DEFS_SOURCE)
  ? [...readReference(TEKELILI_DEFS_SOURCE).matchAll(/cdEncounterSetQuantity = Just (\d+)/g)].map(match => Number(match[1]))
  : []
const resolutePartnerCodes = stableSort(Object.values(ALL_CARDS)
  .filter(card => card.pack === 'eoec' && (card.traits || []).includes('Resolute'))
  .map(card => card.code))
const memorialsCodes = stableSort((groupRecords.get('memorialsOfTheLost') || []))
const pending = [
  {
    id: 'tekeliliDeckRange',
    status: 'verify-in-P1',
    readmeClaim: 'README §5：共享 16 张弱点牌库（08700–08713）',
    cardsDataReading: `卡表 encounterCode=tekelili 只有 ${groupRecords.get('tekelili').length} 条记录（${groupRecords.get('tekelili').join('–')}）；08700–08713 实际分属 Left Behind / Nameless Horrors / Miasma / Penguins / Shoggoths / Silence and Mystery`,
    referenceReading: `Helpers.hs#gatherTekelili 按 CardDefs/Tekelili.hs 的 cdEncounterSetQuantity 复制：${tekeliliQuantities.join('+')} = ${sum(tekeliliQuantities)} 张`,
    referenceQuantities: tekeliliQuantities,
    printedCopies: sum(tekeliliQuantities),
    conclusion: '16 是牌库物理张数（7 种卡面 × 印刷份数），实际卡号区间是 08723–08729；P1 机制扫描应按「7 张卡面 / 16 张牌库」建模',
    action: 'P1 核实后更新 README §5 表述；P0 不改数据、不改卡号',
  },
  {
    id: 'partnerResoluteAndMemorialsRange',
    status: 'verify-in-P1',
    readmeClaim: 'README §5：坚毅面 08723–08731、纪念逝者 08732–08738',
    cardsDataReading: `坚毅（Resolute）伙伴 = ${resolutePartnerCodes[0]}–${resolutePartnerCodes.at(-1)}（fatal_mirage 组 story asset，traits 含 Resolute）；纪念逝者 = ${memorialsCodes[0]}–${memorialsCodes.at(-1)}（${memorialsCodes.length} 条）；08723–08729 是 tekelili`,
    resoluteCodes: resolutePartnerCodes,
    memorialsCodes,
    referenceReading: 'Asset/Cards/EdgeOfTheEarth.hs 的 *Resolute = storyAsset "08587"–"08595"；Partner.hs#toResolute 指向这些编号',
    conclusion: 'README §5 的 08723–08738 分段把 tekelili / resolute / memorials 三组顺序写错，卡表与参考实现一致指向 08587–08595 + 08730–08738',
    action: 'P1 核实后更新 README §5；P0 不改数据',
  },
  {
    id: 'chapterSplitIds',
    status: 'recorded',
    detail: `${chapters_.map(chapter => chapter.stepId).join(' / ')} 只是 CampaignSteps.hs 的 ScenarioStep 值，卡表中不存在这些卡号；印刷提示卡只有 ${SCENARIO_REFERENCE_CODES.join(' / ')} 五张，8 个章节单元共用（promptCard.code 取印刷卡号）`,
  },
  {
    id: 'fatalMirageOptionalReentry',
    status: 'recorded',
    detail: `致命幻景是可选章节，幕间 I–III 均可按条件切入（handler 转移来源：${fatalMirageEntryPoints.join(' / ')}），完成后按 campaignCompletedSteps 回到主线下一章；P7 按 EdgeOfTheEarth.hs 的 nextStep 分支实现`,
  },
]

// 18 门禁：布尔值，必须全为 true；emit() 在任一非 true 时抛错（report 模式同样打印后抛错）。
const chapterGroupRecords = encounterGroups.filter(group => group.kind === 'chapter')
const sharedGroupRecordsList = encounterGroups.filter(group => group.kind === 'shared')
const setCodes = [
  ...sets.investigators.codes,
  ...sets.player.codes,
  ...sets.sharedGroups.flatMap(group => group.codes),
  ...sets.chapterGroups.flatMap(group => group.codes),
]
const setOverlaps = setCodes.filter((code, index) => setCodes.indexOf(code) !== index)
const facePartnerCodes = faceCodes.map(code => {
  const card = ALL_CARDS[code]
  const partners = []
  if (card.linkedToCode) partners.push(card.linkedToCode)
  if (/b$/.test(code)) {
    const stripped = code.slice(0, -1)
    const fallback = ALL_CARDS[stripped] ? stripped : `${stripped}a`
    if (ALL_CARDS[fallback]) partners.push(fallback)
  }
  if (/a$/.test(code)) {
    const sibling = `${code.slice(0, -1)}b`
    if (ALL_CARDS[sibling]) partners.push(sibling)
  }
  return { code, owner: ownerOf.get(code) || null, partners: [...new Set(partners)], partnerOwners: [...new Set(partners.map(partner => ownerOf.get(partner) || null))] }
})
const allGatheredGroups = stableSort([...new Set(chapters.flatMap(chapter =>
  scenarioSources[chapter.id].gatherSets.map(gather => toCamelSetName(gather.set)).filter(group => ENCOUNTER_GROUPS.includes(group))))])
const allGatheredExternalSets = stableSort([...gatheredExternal.keys()])
const guideShaValid = source => Boolean(source.sha256 && /^[0-9a-f]{64}$/.test(source.sha256) && source.bytes > 0)
const sources = referenceFiles().map(path => lock(path))
const sourcePaths = stableSort(sources.map(source => source.path))
const duplicates = sourcePaths.filter((path, index) => sourcePaths.indexOf(path) !== index)
const flatShardCodes = shardIndex.flatMap(shard => shard.codes)
const guidePartsCovered = chapters.every(chapter => {
  const guide = chapterGuideParts[chapter.id]
  if (!guide.part) return true
  return ['en', 'zh'].every(lang => Boolean(guideJson(lang, guide.file)?.[guide.part]))
})

const gates = {
  records: mainCodes.length === EXPECTED.main && faceCodes.length === EXPECTED.faces
    && CYCLE_CODES.length === EXPECTED.records,
  packsRegistered: packs.length === 3
    // P7：三个内容包均按真实清单升 playable（战役包 P7 开放）。
    && packs.every(pack => pack.status === ({ eoteCampaign: 'playable', eoteInvestigators: 'playable', eotePlayer: 'playable' })[pack.id])
    && packs.filter(pack => pack.status === 'catalog-only').every(pack => pack.catalogOnly && pack.rulesImplemented === false)
    && packs.filter(pack => pack.status === 'playable').every(pack => !pack.catalogOnly && pack.rulesImplemented === true
      // 玩家卡包的可构筑卡与只作依赖的基础弱点分别登记；调查员包只含调查员与专属依赖。
      && (pack.id !== 'eotePlayer'
        || packManifests.eotePlayer.cards.every(card => card.deckbuilding === true || card.dependencyOnly === true)))
    && packs.every(pack => pack.cards.length === EXPECTED.packRecords[pack.id])
    && packs.every(pack => pack.cards.join('|') === stableSort(CARD_PARTITIONS[pack.id]).join('|'))
    && packs[0]?.id === 'eoteCampaign' && packs[0].encounterGroupIds.join('|') === ENCOUNTER_GROUPS.join('|')
    && packs.slice(1).every(pack => pack.encounterGroupIds.length === 0),
  candidatePackScan: candidatePackScan.ranges.every(range => range.missingPositions.length === 0
    && range.outOfRange.length === 0 && range.numericCodesNotInPack.length === 0)
    && candidatePackScan.cycleCodesOutsideRanges.length === 0,
  partitions: CYCLE_CODES.every(code => ownerOf.has(code))
    && new Set(ownerOf.keys()).size === CYCLE_CODES.length
    && Object.values(CARD_PARTITIONS).every(codes => codes.every(code => CYCLE_CODES.includes(code)))
    && sum(Object.values(CARD_PARTITIONS).map(codes => codes.length)) === CYCLE_CODES.length,
  sets: setOverlaps.length === 0 && setCodes.length === CYCLE_CODES.length
    && stableSort(setCodes).join('|') === stableSort(CYCLE_CODES).join('|'),
  faces: faceCodes.length === EXPECTED.faces
    && facePartnerCodes.every(face => face.partners.length > 0 && face.partnerOwners.length === 1
      && face.partnerOwners[0] === face.owner && face.owner !== null),
  encounterGroups: encounterGroups.length === EXPECTED.encounterGroups
    && encounterGroups.filter(group => group.kind === 'chapter').length === EXPECTED.chapterGroups
    && encounterGroups.filter(group => group.kind === 'shared').length === EXPECTED.sharedGroups
    && sum(encounterGroups.map(group => group.records)) === EXPECTED.packRecords.eoteCampaign
    && unmappedEncounterCodes.size === 0 && missingSharedGroups.length === 0
    && declaredChapterGroups.every(group => groupRecords.has(group)),
  reprints: reprintGroups.length === EXPECTED.reprintGroups
    && reprintGroups.every(group => group.codes.includes(group.canonicalCode))
    && reprintGroups.every(group => group.canonicalCode === stableSort(group.codes)[0])
    && reprintGroups.every(group => group.cycleCodes.every(code => canonicalOf(code) === group.canonicalCode))
    && duplicateLinks.length === EXPECTED.duplicateLinks,
  alternates: parallelAlternates.length === EXPECTED.parallelAlternates
    && parallelAlternates.every(entry => (CARD_PARTITIONS.eoteInvestigators || []).includes(entry.baseCode))
    && parallelAlternates.every(entry => !CYCLE_CODES.includes(entry.alternateCode))
    && parallelAlternates.every(entry => entry.baseCode !== entry.alternateCode),
  chapters: chapters_.length === EXPECTED.chapters
    && chapters_.map(chapter => chapter.id).join('|') === chapters.map(chapter => chapter.id).join('|')
    && chapters_.map(chapter => chapter.stepId).join('|') === campaignStepPatterns.map(step => step.stepId).join('|')
    && chapters_.map(chapter => chapter.stepId).join('|') === scenarioIdsJson.map(entry => entry.id).join('|')
    && chapters_.every(chapter => chapter.promptCard.type === 'scenario' && Boolean(chapter.promptCard.text))
    && SCENARIO_REFERENCE_CODES.length === EXPECTED.referenceCards
    && SCENARIO_REFERENCE_CODES.every(code => ALL_CARDS[code]?.type === 'scenario'),
  chapterSources: chapters_.every(chapter => guideShaValid({ bytes: scenarioSources[chapter.id].lock.bytes, sha256: chapter.sourceSha256 })),
  referenceCards: SCENARIO_REFERENCE_CODES.length === EXPECTED.referenceCards
    && chapters_.every(chapter => SCENARIO_REFERENCE_CODES.includes(chapter.referenceCode)),
  gather: allGatheredExternalSets.join('|') === EXPECTED.externalSets.join('|')
    && chapters_.every(chapter => chapter.gatherSets.some(gather => toCamelSetName(gather.set) === chapter.ownGroup))
    && allGatheredGroups.every(group => ENCOUNTER_GROUPS.includes(group))
    && ENCOUNTER_GROUPS.every(group => allGatheredGroups.includes(group) || EXPECTED.campaignLevelGroups.includes(group)),
  externalDependencies: externalDependencies.length === EXPECTED.externalSets.length
    && externalDependencies.every(dependency => dependency.codes.length > 0 && dependency.usedBy.length > 0)
    && externalDependencies.every(dependency => dependency.repoDirExists)
    && externalDependencies.every(dependency => dependency.usedBy.every(chapterId => chapters.some(chapter => chapter.id === chapterId))),
  chaosBags: JSON.stringify(parsedChaosBags) === JSON.stringify(CHAOS_BAGS)
    && Object.entries(EXPECTED.chaosBagSizes).every(([difficulty, size]) => parsedChaosBags[difficulty]?.length === size)
    && Object.entries(EXPECTED.frostCounts).every(([difficulty, count]) => chaosBagFrostCounts[difficulty] === count)
    && prologueChaosTokens.map(token => `${token.step}:${token.token}`).join('|') === '2:cultist|3:tablet',
  guideSources: guideSources.length === EXPECTED.guideSources
    && baseGuideSources.every(guideShaValid)
    && chapters_.every(chapter => chapter.guideSources.length === 2
      && chapter.guideSources.some(source => source.lang === 'en' && source.path.includes('locales/en'))
      && chapter.guideSources.some(source => source.lang === 'zh' && source.path.includes('locales/zh'))
      && chapter.guideSources.every(guideShaValid)
      && chapter.guideKeyCounts.en > 0 && chapter.guideKeyCounts.zh > 0)
    && guidePartsCovered,
  shards: shardOverlaps.length === 0 && shardMissing.length === 0
    && flatShardCodes.length === CYCLE_CODES.length
    && stableSort(flatShardCodes).join('|') === stableSort(CYCLE_CODES).join('|')
    && playerWaves.length === 4 && playerWaves.every(wave => wave.codes.length <= 30)
    && sharedShards.every(shard => shard.codes.length <= 40),
  sources: sources.length === EXPECTED.sources
    && duplicates.length === 0
    && sources.every(source => source.bytes > 0 && /^[0-9a-f]{64}$/.test(source.sha256)),
  baseline: Boolean(baseline) && Boolean(baselineReplayPath)
    && String(baselineReplayPath).replaceAll('\\', '/').endsWith(REPLAY_BASELINE)
    && baselineDeclaredSha256 === replayBaselineSha256
    && /^[0-9a-f]{40}$/.test(String(baseline.gitHead || '')),
  counts: mainCodes.length === EXPECTED.main
    && faceCodes.length === EXPECTED.faces
    && CYCLE_CODES.length === EXPECTED.records
    && Object.entries(EXPECTED.packRecords).every(([pack, count]) => CARD_PARTITIONS[pack].length === count)
    && chapters_.length === EXPECTED.chapters
    && encounterGroups.length === EXPECTED.encounterGroups
    && sharedGroupRecordsList.length === EXPECTED.sharedGroups
    && chapterGroupRecords.length === EXPECTED.chapterGroups
    && INVESTIGATOR_CODES.length === EXPECTED.investigators
    && new Set(INVESTIGATOR_CODES.flatMap(code => ALL_CARDS[code].deckRequirements?.signatureCards || [])).size === EXPECTED.signatures
    && DISCIPLINE_CODES.length === EXPECTED.disciplines
    && campaignSteps.length === EXPECTED.campaignSteps,
}
const failedGates = Object.entries(gates).filter(([, pass]) => pass !== true).map(([name]) => name)
if (failedGates.length) console.error(`eote scope gate 未通过：${failedGates.join(', ')}`)

export function buildScope () {
  return {
    schemaVersion: 1,
    cycle: 'eote',
    cycleName: 'Edge of the Earth',
    cycleNameZh: '地球边缘',
    campaignId: CAMPAIGN_ID,
    milestone: 'M0',
    step: 'P0 范围与来源锁',
    generatedBy: 'tools/scan-eote-scope.mjs',
    docs: DOCS,
    status: 'catalog-only',
    sourceRoot: REFERENCE_ROOT,
    counts: {
      main: mainCodes.length,
      faces: faceCodes.length,
      records: CYCLE_CODES.length,
      packs: Object.fromEntries(Object.entries(CARD_PARTITIONS).map(([pack, codes]) => [pack, codes.length])),
      chapters: chapters_.length,
      encounterGroups: encounterGroups.length,
      sharedGroups: sharedGroupRecordsList.length,
      chapterGroups: chapterGroupRecords.length,
      investigators: INVESTIGATOR_CODES.length,
      signatures: new Set(INVESTIGATOR_CODES.flatMap(code => ALL_CARDS[code].deckRequirements?.signatureCards || [])).size,
      disciplines: DISCIPLINE_CODES.length,
      referenceCards: SCENARIO_REFERENCE_CODES.length,
      sources: sources.length,
    },
    sources: sourcePaths.map(path => {
      const source = sources.find(entry => entry.path === path)
      return { path, bytes: source.bytes, sha256: source.sha256 }
    }),
    packs,
    candidatePackScan,
    cards,
    reprintGroups,
    duplicateLinks,
    parallelAlternates,
    partitions: Object.fromEntries(Object.entries(CARD_PARTITIONS).map(([pack, codes]) => [pack, [...codes]])),
    sets,
    encounterGroups,
    chapters: chapters_,
    campaignFlow: {
      source: CAMPAIGN_SOURCE,
      sha256: lock(CAMPAIGN_SOURCE).sha256,
      campaignStepsSource: CAMPAIGN_STEPS_SOURCE,
      campaignStepsSourceSha256: lock(CAMPAIGN_STEPS_SOURCE).sha256,
      stepIds: campaignStepPatterns.map(step => ({ id: step.id, pattern: step.pattern, stepId: step.stepId })),
      nextStepEdges,
      handlerEdges,
      steps: campaignSteps,
      prologueChaosTokens,
      fatalMirageEntryPoints,
      note: '序幕 → 亡命冰原 I → 检查点 I（可跳过 II）→ [II] → 检查点 II（可跳过 III）→ [III] → 幕间 I → [致命幻景] → 失落之峰 → 幕间 II → [致命幻景] → 古老者之城 → 幕间 III → [致命幻景] → 疯狂之心 I → 检查点 III → 疯狂之心 II → 尾声；致命幻景完成后按 campaignCompletedSteps 返回主线下一章。',
    },
    externalDependencies,
    guideSources: guideSources.map(source => ({ lang: source.lang, path: source.path, bytes: source.bytes, sha256: source.sha256 })),
    chaosBags: CHAOS_BAGS,
    chaosBagsSource: {
      path: HELPERS_SOURCE,
      sha256: lock(HELPERS_SOURCE).sha256,
      parsed: parsedChaosBags,
      frostCounts: chaosBagFrostCounts,
      matches: JSON.stringify(parsedChaosBags) === JSON.stringify(CHAOS_BAGS),
    },
    shards,
    cardImages: {
      english: 'web/img/cards/',
      chinese: 'web/img/zh/cards/',
      remoteFallback: ['imagesrc', 'backimagesrc'],
      cycleCopies: false,
      recordsWithRemoteImage,
      recordsWithBackRemoteImage,
      note: '本地卡图缓存（web/img/**）被忽略，不计入账本；运行时不依赖参考资源，继续走远程回退',
    },
    baseline,
    pending,
    gates,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('scope', buildScope())

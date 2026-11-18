import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { campaignListForUi, createContentRegistry } from '../content/registry.js'
import { contentRegistry, currentContentBundle } from '../content/registered.js'
import { manifest } from '../content/campaigns/theFeastOfHemlockVale/manifest.js'
import { CAMPAIGN_ID, CATALOG_STATUS, CHAOS_BAGS, chapters, encounterGroups, investigators, partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const REFERENCE_ROOT = '参考资源/ArkhamHorror-main'
const REFERENCE = join(HALL, REFERENCE_ROOT)
const ARKHAM = 'backend/arkham-api/library/Arkham'
const CAMPAIGN = `${ARKHAM}/Campaign/Campaigns/TheFeastOfHemlockVale.hs`
const COMMON = `${ARKHAM}/Campaigns/TheFeastOfHemlockVale`
const SCENARIOS = `${ARKHAM}/Scenario/Scenarios/TheFeastOfHemlockVale`
const STEPS = `${COMMON}/CampaignSteps.hs`
const TOKEN_HELPERS = `${COMMON}/TokenHelpers.hs`
const IDS = `frontend/src/arkham/data/${CAMPAIGN_ID}.json`
const GUIDE = `frontend/src/locales/en/${CAMPAIGN_ID}`
const CN_GUIDE = `frontend/src/locales/zh/${CAMPAIGN_ID}`
const CARD_FILES = ['cards.json', 'cards_en.json', 'cards_zh.json', 'cards_zh-cn.json'].map(file => `frontend/public/${file}`)
const SCOPE = join(MOD, 'audit/fhv-scope.json')
const TOKEN_NAMES = { Skull: 'skull', ElderSign: 'elderSign', Cultist: 'cultist', Tablet: 'tablet', ElderThing: 'elderThing', AutoFail: 'autoFail' }
const DIFFICULTIES = ['easy', 'standard', 'hard', 'expert']
const sorted = values => [...values].sort()
const unique = values => [...new Set(values)]
const ref = path => readFileSync(join(REFERENCE, path), 'utf8')
const refJson = path => JSON.parse(ref(path).replace(/^\uFEFF/, ''))
const json = value => JSON.stringify(value, null, 2) + '\n'
const sha = value => createHash('sha256').update(value).digest('hex')
const readSourceLock = path => {
  const bytes = readFileSync(join(REFERENCE, path))
  return { sha256: sha(bytes), bytes: bytes.length }
}

function parseBag(source) {
  const body = source.split('campaignChaosBag = \\case')[1]?.split('FOURMOLU_ENABLE')[0] || ''
  const values = [...body.matchAll(/(Easy|Standard|Hard|Expert)\s*->\s*\[([^\]]+)\]/g)]
  return Object.fromEntries(values.map(([, difficulty, tokens]) => [difficulty.toLowerCase(), tokens.split(',').map(value => {
    const token = value.trim()
    if (/^#"[+-]?\d+"$/.test(token)) return token.slice(2, -1)
    assert(TOKEN_NAMES[token], `未知初始混乱标记 ${token}`)
    return TOKEN_NAMES[token]
  })]))
}

function buildReprintMap(cards, cycle) {
  // The printed card's type, rules and stats all matter. A name match alone is insufficient.
  const fields = ['name', 'subname', 'type_code', 'subtype_code', 'faction_code', 'xp', 'cost', 'text', 'back_text',
    'skill_willpower', 'skill_intellect', 'skill_combat', 'skill_agility', 'skill_wild', 'traits', 'slot',
    'health', 'sanity', 'enemy_fight', 'enemy_evade', 'enemy_damage', 'enemy_horror', 'shroud', 'clues']
  const identity = card => JSON.stringify(fields.map(key => typeof card[key] === 'string' ? card[key].replace(/\s+/g, ' ').trim() : card[key] ?? null))
  const byCode = new Map(cards.map(card => [card.code, card]))
  const explicitParent = new Map()
  const byIdentity = Map.groupBy(cards, identity)
  for (const card of cards) {
    if (card.duplicate_of_code) explicitParent.set(card.code, card.duplicate_of_code)
    for (const code of card.duplicated_by || []) if (!explicitParent.has(code)) explicitParent.set(code, card.code)
  }
  const canonical = code => {
    const visited = new Set()
    while (explicitParent.has(code)) {
      assert(!visited.has(code), `重印循环 ${code}`)
      visited.add(code)
      code = explicitParent.get(code)
    }
    return code
  }
  const mappings = {}
  const sameNameDifferentPrint = []
  for (const [code, card] of cycle) {
    const matches = byIdentity.get(identity(card)).filter(other => other.code !== code && other.pack_code !== card.pack_code)
    const root = canonical(code)
    assert(byCode.has(root), `重印 canonical 缺失 ${code} → ${root}`)
    if (root !== code || matches.length) mappings[code] = root !== code ? root : sorted([code, ...matches.map(other => canonical(other.code))])[0]
    const variants = cards.filter(other => other.pack_code !== card.pack_code && other.name === card.name
      && other.type_code === card.type_code && other.xp === card.xp && identity(other) !== identity(card)
      && canonical(other.code) !== root)
    if (variants.length) sameNameDifferentPrint.push({ code, outsideCodes: sorted(variants.map(other => other.code)) })
  }
  const reverseLinks = Object.fromEntries([...explicitParent.keys()].filter(code => !cycle.has(code) && cycle.has(canonical(code)))
    .sort().map(code => [code, canonical(code)]))
  return { canonicalDefault: 'self', canonicalByCode: { ...mappings, ...reverseLinks }, sameNameDifferentPrint }
}

function printedRules(cards, chapter) {
  const rules = {}
  for (const code of chapter.referenceCodes) {
    const card = cards.get(code)
    assert.equal(card?.type_code, 'scenario', `${chapter.id} 提示卡 ${code}`)
    for (const [face, text] of [['front', card.text], ['back', card.back_text]]) {
      const [title, ...lines] = text.trim().split('\n')
      const [, first, second, act] = title.match(/^(Easy|Hard)\s*\/\s*(Standard|Expert)(?:\s*-\s*Act (\d+))?$/) || []
      assert(first && second, `提示卡 ${code} ${face} 的难度：${title}`)
      const symbols = Object.fromEntries(lines.map(line => {
        const match = line.match(/^\[(skull|cultist|tablet|elder_thing)\]:\s*(.+)$/)
        assert(match, `提示卡 ${code} ${face} 的符号：${line}`)
        return [match[1], match[2]]
      }))
      assert.equal(Object.keys(symbols).length, 4, `${code} ${face} 缺少符号`)
      for (const label of [first, second]) {
        const key = label.toLowerCase()
        rules[key] ??= []
        rules[key].push({ code, face, ...(act ? { act: Number(act) } : {}), symbols })
      }
    }
  }
  assert.deepEqual(sorted(Object.keys(rules)), sorted(DIFFICULTIES))
  return Object.fromEntries(DIFFICULTIES.map(label => [label, rules[label]]))
}

const coreGroups = {
  ChillingCold: 'chilling_cold', Ghouls: 'ghouls', LockedDoors: 'locked_doors',
  Rats: 'rats', StrikingFear: 'striking_fear', TheMidnightMasks: 'midnight_masks',
}
const partialCoreCards = { huntingShadow: '01135', falseLead: '01136' }
const snake = value => value.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()

async function buildScope() {
  const cards = refJson(CARD_FILES[1])
  const isFhv = card => ['fhvc', 'fhvp'].includes(card.pack_code)
  const rows = cards.filter(isFhv).sort((left, right) => left.code.localeCompare(right.code, 'en'))
  const cycle = new Map(rows.map(card => [card.code, card]))
  const codes = sorted(cycle.keys())
  assert.equal(codes.length, rows.length, '英文卡表有重复印刷记录')
  for (const path of CARD_FILES.filter(path => path !== CARD_FILES[1])) {
    assert.deepEqual(sorted(refJson(path).filter(isFhv).map(card => card.code)), codes, `${path} 的范围不同`)
  }

  const production = currentContentBundle()
  // P5 起调查员包 playable，P6 起一般玩家卡包 playable，P7 起战役包 playable（12 场景逐章验收后）。
  // P0 冻结账本时三包均为 catalog-only，本工具按当前阶段声明期望状态并重新生成
  // audit/fhv-scope.json（P0 的 replay/fast 基线仍在 audit/fhv-baseline.json 中保持冻结）。
  const EXPECTED_PACK_STATUS = Object.freeze({
    fhvCampaign: 'playable',
    fhvInvestigators: 'playable',
    fhvPlayer: 'playable',
  })
  const productionCodes = []
  for (const [id, owned] of Object.entries(partitions)) {
    const pack = contentRegistry.getPack(id)
    assert.equal(pack.status, EXPECTED_PACK_STATUS[id], `${id} 包状态`)
    assert.deepEqual(pack.cards.map(card => card.code), owned)
    if (id === 'fhvCampaign') {
      // P7：301 条战役记录 rulesImplemented 全真、不进构筑池。
      assert(pack.cards.every(card => card.cataloged && card.rulesImplemented && !card.deckbuilding), `${id} 卡片开放状态`)
      assert(Array.isArray(pack.encounterGroupIds) && pack.encounterGroupIds.length === Object.keys(encounterGroups).length, `${id} 遭遇组清单`)
    } else if (id === 'fhvInvestigators') {
      assert(pack.cards.every(card => card.cataloged && card.rulesImplemented && !card.deckbuilding), `${id} 卡片开放状态`)
      assert(pack.cards.every(card => card.investigator === true || card.dependencyOnly === true))
    } else {
      // P6：一般玩家卡 120 条 rulesImplemented 全真；可构筑与依赖标记由逐卡验收生成物决定。
      assert(pack.cards.every(card => card.cataloged && card.rulesImplemented), `${id} 卡片开放状态`)
      assert(pack.cards.every(card => !card.deckbuilding || !card.dependencyOnly), `${id} 可构筑与依赖互斥`)
    }
    productionCodes.push(...owned)
  }
  assert.deepEqual(sorted(productionCodes), codes, '发现重叠、遗漏或范围外卡')
  assert.deepEqual(partitions.fhvCampaign, codes.filter(code => cycle.get(code).pack_code === 'fhvc'))
  // P7：战役进生产组合根（playable + 12 场景），大厅可见且可启动。
  const productionCampaign = contentRegistry.getCampaign(CAMPAIGN_ID)
  assert.equal(productionCampaign?.status, 'playable', 'FHV 战役未注册/未开放')
  assert.doesNotThrow(() => contentRegistry.assertLaunchable(CAMPAIGN_ID), 'FHV 战役应可启动')
  assert(campaignListForUi(contentRegistry).some(entry => entry.id === CAMPAIGN_ID), '大厅应显示 FHV 战役')
  assert.equal(contentRegistry.listScenarios().filter(entry => entry.campaignId === CAMPAIGN_ID).length,
    chapters.length, 'FHV 场景注册数量')
  // 目录期独立注册表复算（P0 身份校验保留）：显式传入 manifest + 12 章可构造同状态注册表。
  // P7 起 production 组合根已注册 FHV 战役 + 12 章：目录期复算直接复用同一组合根（不再叠加裸 manifest，
  // 否则重复 ID；章身份/stepCode 的复算仍在下方用 catalog.getScenario 完成）。
  const catalog = contentRegistry
  assert.equal(catalog.getCampaign(CAMPAIGN_ID).status, 'playable')
  const playerPackCards = new Map(contentRegistry.getPack('fhvPlayer').cards.map(card => [card.code, card]))
  for (const code of codes) {
    const available = getAvailability(code)
    if (partitions.fhvInvestigators.includes(code)) {
      // P5：调查员可选、专属/绑定依赖只作依赖；调查员卡本身不可构筑。
      const isInvestigator = Object.hasOwn(investigators, code)
      assert.equal(available.strictAccepted, true, `FHV 调查员包卡 ${code} 应为 strict`)
      assert.equal(available.selectable, isInvestigator, `FHV 调查员包卡 ${code} 可选性`)
      assert.equal(available.dependencyOnly, !isInvestigator, `FHV 调查员包卡 ${code} 依赖标记`)
      assert.equal(available.deckbuilding, false, `FHV 调查员包卡 ${code} 不可构筑`)
    } else if (partitions.fhvCampaign.includes(code)) {
      // P7：战役卡全部 strict（只作战役内容），不进构筑/选人池。
      assert.equal(available.strictAccepted, true, `FHV 战役卡 ${code} 应为 strict`)
      assert.equal(available.selectable, false, `FHV 战役卡 ${code} 不可选为调查员`)
      assert.equal(available.deckbuilding, false, `FHV 战役卡 ${code} 不可构筑`)
    } else if (playerPackCards.has(code)) {
      // P6：一般玩家卡全部 strict；可构筑/依赖标记与生成物一致，基础弱点与绑定依赖只作依赖。
      const card = playerPackCards.get(code)
      assert.equal(available.strictAccepted, true, `FHV 玩家卡 ${code} 应为 strict`)
      assert.equal(available.selectable, false, `FHV 玩家卡 ${code} 不可选为调查员`)
      assert.equal(available.deckbuilding, card.deckbuilding === true, `FHV 玩家卡 ${code} 可构筑口径`)
      assert.equal(available.dependencyOnly, card.dependencyOnly === true, `FHV 玩家卡 ${code} 依赖标记`)
    } else {
      assert(!available.selectable && !available.deckbuilding && !available.strictAccepted, `FHV 卡 ${code} 已开放`)
    }
    assert.equal(ALL_CARDS[code].encounterCode || null, cycle.get(code).encounter_code || null, `遭遇组漂移 ${code}`)
  }

  const chapterGroups = Object.fromEntries(chapters.filter(chapter => chapter.group).map(({ group, id }) => [id, encounterGroups[group]]))
  const sharedGroups = Object.fromEntries(Object.entries(encounterGroups).filter(([group]) => !chapters.some(chapter => chapter.group === group)))
  const allEncounterCodes = [...Object.values(chapterGroups), ...Object.values(sharedGroups)].flat()
  assert.deepEqual(sorted(allEncounterCodes), partitions.fhvCampaign, '共享与逐章遭遇卡有重叠或遗漏')
  const listedInvestigators = codes.filter(code => cycle.get(code).type_code === 'investigator' && cycle.get(code).deck_requirements)
  assert.deepEqual(sorted(Object.keys(investigators)), listedInvestigators)
  const investigatorDependencies = Object.fromEntries(Object.entries(investigators).map(([code, { signatures, bonded }]) => {
    const source = cycle.get(code)
    assert.deepEqual(sorted(Object.keys(source.deck_requirements.card)), signatures)
    const restricted = rows.filter(card => Object.hasOwn(card.restrictions?.investigator || {}, code)).map(card => card.code)
    assert(restricted.every(dep => [...signatures, ...bonded].includes(dep)), `发现未登记的调查员依赖 ${code}`)
    return [code, { deckSize: source.deck_requirements.size, signatures: signatures.map(code => ({ code, quantity: cycle.get(code).quantity })), bonded, random: source.deck_requirements.random }]
  }))

  const stepRows = refJson(IDS)
  const stepCodes = chapters.map(({ stepCode }) => stepCode)
  assert.deepEqual(stepRows.map(row => row.id), stepCodes)
  assert(stepRows.every(row => row.campaign === '10'))
  assert.deepEqual([...ref(STEPS).matchAll(/<- ScenarioStep "([^"]+)"/g)].map(([, code]) => code), stepCodes)
  assert.deepEqual(sorted(unique(chapters.flatMap(chapter => chapter.referenceCodes))),
    codes.filter(code => cycle.get(code).type_code === 'scenario'), '剧本提示卡全集有遗漏')
  const campaignSource = ref(CAMPAIGN)
  assert(campaignSource.includes('(CampaignId "10")'))
  const bags = parseBag(campaignSource)
    // P8：内容层 CHAOS_BAGS 与引擎标记名同源（eldersign/elderthing/autofail 小写）；参考实现用
  // Haskell 构造名（ElderSign/ElderThing/AutoFail），比较前统一小写口径。
  const engineToken = token => ({ eldersign: 'eldersign', elderthing: 'elderthing', autofail: 'autofail' }[String(token).toLowerCase()] || String(token).toLowerCase())
  const normalizeBags = value => Object.fromEntries(Object.entries(value).map(([difficulty, list]) => [difficulty, list.map(token => /^[+-]?\d+$/.test(token) ? token : engineToken(token))]))
  assert.deepEqual(normalizeBags(bags), normalizeBags(CHAOS_BAGS))
  const welcome = ref(`${SCENARIOS}/PreludeWelcomeToHemlockVale.hs`)
  assert(/resolution "resolution1"\s+eachInvestigator makePreparationsForNextSurvey\s+addChaosToken AutoFail/.test(welcome))

  const external = new Map()
  const sourceFiles = new Set([...CARD_FILES, CAMPAIGN, STEPS, TOKEN_HELPERS, IDS, `${ARKHAM}/EncounterSet.hs`])
  const scenarioSources = chapters.map((chapter, index) => {
    const { id, stepCode, referenceCodes } = chapter
    const source = `${SCENARIOS}/${chapter.source}.hs`
    const implementation = ref(source)
    const printedCode = implementation.match(/referenceL\s*\.~\s*"(\d{5})"/)?.[1] || stepCode
    assert.equal(printedCode, referenceCodes[0], `符号提示卡与参考实现不一致 ${id}`)
    const chapterManifest = catalog.getScenario(id)
    // P7 起章节 manifest 由 scenarioManifest 生成（不再携带 P0 的 referenceCodes 数组）；
    // 身份用 id/campaignId 复算，提示卡号仍以参考实现 printedCode 与 scope 对齐（上一行）。
    assert.equal(chapterManifest.id, id)
    assert.equal(chapterManifest.campaignId, CAMPAIGN_ID)
    const chapterData = catalog.getScenarioData(id)
    if (chapterData?.stepCode) assert.equal(chapterData.stepCode, stepCode)
    const stepFace = cycle.has(stepCode) ? null : { code: stepCode.slice(0, 5), face: stepCode.endsWith('a') ? 'front' : 'back' }
    if (stepFace) assert(cycle.get(stepFace.code)?.double_sided, `缺少步骤时间卡 ${stepCode}`)
    const encounters = [...implementation.replace(/--[^\n]*/g, '').matchAll(/\b(gather(?:Just|AndSetAside)?) Set\.(\w+)(?: \[([^\]\n]*)\])?/g)]
    const gather = encounters.map(([, action, set, selection]) => {
      const group = coreGroups[set] || snake(set)
      const sourceCodes = selection ? [...selection.matchAll(/Treacheries\.(\w+)/g)].map(([, name]) => partialCoreCards[name]) : null
      if (sourceCodes) assert(sourceCodes.length && sourceCodes.every(Boolean), `未识别部分遭遇组 ${set}`)
      if (!Object.hasOwn(encounterGroups, group)) {
        assert(coreGroups[set], `未登记的范围外遭遇组 ${set}`)
        const usedCodes = sorted(sourceCodes || cards.filter(card => card.pack_code === 'core' && card.encounter_code === group).map(card => card.code))
        assert(usedCodes.length && usedCodes.every(code => ALL_CARDS[code]?.pack === 'core' && !cycle.has(code)), `范围外遭遇卡归属错误 ${set}`)
        const entry = external.get(group) || { group, packId: selection ? 'notz' : 'core', codes: [], scenarios: [] }
        const packCodes = new Set(contentRegistry.getPack(entry.packId).cards.map(card => card.code))
        assert(usedCodes.every(code => packCodes.has(code)), `生产卡包缺少范围外依赖 ${set}`)
        entry.codes = sorted(unique([...entry.codes, ...usedCodes]))
        entry.scenarios = unique([...entry.scenarios, id])
        external.set(group, entry)
      }
      return { action, group, ...(sourceCodes ? { codes: sorted(sourceCodes) } : {}) }
    })
    const guide = `${GUIDE}/${chapter.guide || id}.json`
    const guideKeys = Object.keys(refJson(guide)).sort()
    for (const path of [source, guide]) sourceFiles.add(path)
    return { id, stepCode, stepFace, name: chapter.name, nameEn: stepRows[index].name, referenceCodes,
      source, guide, guideKeys, tokenHelper: chapter.guide ? TOKEN_HELPERS : null, chaosSymbols: printedRules(cycle, chapter), gather }
  })

  const linkedFaces = rows.filter(card => card.linked_card).map(card => {
    const reverse = cycle.get(card.linked_card.code)
    assert.equal(reverse?.pack_code, card.pack_code, `关联面不在本循环 ${card.code}`)
    assert.equal(reverse.encounter_code, card.encounter_code, `关联面归属漂移 ${card.code}`)
    return { front: card.code, back: reverse.code, types: [card.type_code, reverse.type_code] }
  })
  const embeddedBacks = sorted(rows.filter(card => card.double_sided).map(card => card.code))
  const multiRecordPositions = Object.fromEntries([...Map.groupBy(codes, code => code.slice(0, 5))].filter(([, faces]) => faces.length > 1))
  const cardsByCode = Object.fromEntries(codes.map(code => {
    const card = cycle.get(code)
    return [code, { name: card.name, nameZh: ALL_CARDS[code].nameZh || null, pack: card.pack_code, type: card.type_code, quantity: card.quantity ?? null }]
  }))

  // Include per-card modules grouped by campaign as well as the campaign/scenario helper directories.
  const hsPaths = readdirSync(join(REFERENCE, ARKHAM), { recursive: true }).map(value => value.replaceAll('\\', '/')).filter(path => path.endsWith('.hs'))
  for (const path of hsPaths) {
    if (/(?:^|\/)TheFeastOfHemlockVale(?:\/|\.hs$)/.test(path) || path.startsWith('EnemyLocation/')) sourceFiles.add(`${ARKHAM}/${path}`)
  }
  for (const path of ['Investigator/Cards.hs', 'Investigator/Cards/WilsonRichards.hs', 'Investigator/Cards/KateWinthrop.hs',
    'Investigator/Cards/AlessandraZorzi.hs', 'Investigator/Cards/KohakuNarukami.hs', 'Investigator/Cards/HankSamson.hs',
    'Asset/Assets/FluxStabilizerInactive.hs', 'Asset/Assets/FluxStabilizerActive.hs',
    'Treachery/CardDefs/NightOfTheZealot/TheMidnightMasks.hs']) sourceFiles.add(`${ARKHAM}/${path}`)
  const byModule = Map.groupBy(hsPaths, path => path.split('/').at(-1).slice(0, -3).toLowerCase())
  for (const path of [...sourceFiles].filter(path => /\/(?:Cards|CardDefs)\//.test(path) || path.endsWith('/Cards.hs'))) {
    const source = ref(path)
    const definitions = [...source.matchAll(/^(\w+)\s*::\s*CardDef\b/gm)]
    for (const [index, definition] of definitions.entries()) {
      const block = source.slice(definition.index, definitions[index + 1]?.index ?? source.length)
      if (![...block.matchAll(/"(\d{5}[a-z]?)"/g)].some(([, code]) => cycle.has(code))) continue
      for (const module of byModule.get(definition[1].toLowerCase()) || []) sourceFiles.add(`${ARKHAM}/${module}`)
    }
  }
  const sources = Object.fromEntries(sorted(sourceFiles).map(path => [path, readSourceLock(path)]))
  const baseGuide = `${GUIDE}/base.json`
  const eveningGuides = refJson(baseGuide).prelude
  const narrativeOnlySteps = ['theFirstEvening', 'theSecondEvening'].map(key => {
    const id = `prelude${key[0].toUpperCase()}${key.slice(1)}`
    assert(campaignSource.includes(`CampaignSpecificStep "${id}"`) && Object.hasOwn(eveningGuides, key), `缺少夜间序曲来源 ${id}`)
    return { id, guideKey: `prelude.${key}` }
  })
  const surveyScenarios = chapters.slice(1, 6).map(chapter => chapter.id)
  const surveyRoutes = [campaignSource, ...scenarioSources.filter(scenario => scenario.stepFace || scenario.id === 'welcomeToHemlockVale')
    .map(scenario => ref(scenario.source))].join('\n')
  const surveyTimes = ['day1', 'night1', 'day2', 'night2', 'day3']
  for (const time of surveyTimes) {
    const pattern = new RegExp(`scenarioLabeled' "(\\w+)" "\\d{5}-${time}"`, 'g')
    assert.deepEqual([...surveyRoutes.matchAll(pattern)].map(([, id]) => id), surveyScenarios, `勘察选项漂移 ${time}`)
  }
  assert(campaignSource.includes('labeled "followDrMarquez" $ setNextCampaignStep TheLongestNight'))
  return {
    schemaVersion: 1, campaignId: CAMPAIGN_ID, sourceCampaignId: '10', status: CATALOG_STATUS, referenceRoot: REFERENCE_ROOT,
    candidates: { fhvp: ['10001', '10138'], fhvc: ['10501', '10743'] },
    counts: { records: codes.length, physicalPositions: unique(codes.map(code => code.slice(0, 5))).length,
      mainCodes: codes.length - codes.filter(code => code.length === 6).length, suffixedCodes: codes.filter(code => code.length === 6).length,
      packs: Object.fromEntries(Object.entries(partitions).map(([id, owned]) => [id, owned.length])),
      scenarioIdentities: scenarioSources.length, sharedGroups: Object.keys(sharedGroups).length, chapterGroups: Object.keys(chapterGroups).length },
    codes, cardsByCode, partitions, investigatorDependencies, chapterGroups, sharedGroups,
    linkedFaces, embeddedBacks, multiRecordPositions, reprints: buildReprintMap(cards, cycle),
    enemyLocations: codes.filter(code => cycle.get(code).type_code === 'enemy_location'),
    residentFaces: linkedFaces.filter(({ front }) => cycle.get(front).encounter_code === 'residents'),
    heirloomRewards: sharedGroups.heirlooms, externalEncounterDependencies: [...external.values()].sort((a, b) => a.group.localeCompare(b.group, 'en')),
    campaignFlow: { source: CAMPAIGN, steps: STEPS, guide: baseGuide, narrativeOnlySteps,
      surveyScenarios, surveyTimes,
      nightOptions: { night1: ['theTwistedHollow', 'survey'], night2: ['theLongestNight', 'survey'], night3: ['fateOfTheVale'] } },
    initialChaosBags: bags, chaosBagAfterWelcome: { adds: ['autoFail'], source: scenarioSources[0].source, resolution: '1' },
    scenarios: scenarioSources,
    guides: { english: sorted(unique(scenarioSources.map(chapter => chapter.guide))),
      upstreamChinese: existsSync(join(REFERENCE, CN_GUIDE)) ? CN_GUIDE : null,
      plannedChinese: `content/campaigns/${CAMPAIGN_ID}/story-source/` },
    sources,
    baseline: { audit: 'audit/fhv-baseline.json', replay: 'artifacts/migration/fhv/replay-before.json', reports: 'artifacts/migration/fhv/reports/' },
  }
}

const mode = process.argv[2]
assert(['--write', '--check', undefined].includes(mode), '用法：node tools/scan-fhv-scope.mjs --write | --check')
const scope = await buildScope()
const output = json(scope)
if (mode === '--write') {
  mkdirSync(RUN, { recursive: true })
  writeFileSync(SCOPE, output)
  writeFileSync(join(RUN, 'scope.json'), output)
} else if (mode === '--check') {
  const previous = JSON.parse(readFileSync(SCOPE, 'utf8'))
  const changes = sorted(unique([...Object.keys(previous.sources), ...Object.keys(scope.sources)]))
    .filter(path => previous.sources[path]?.sha256 !== scope.sources[path]?.sha256)
  assert(!changes.length, `FHV 来源漂移：\n${changes.join('\n')}`)
  assert(json(previous) === output, 'FHV 范围账本漂移，请核对卡号、分区与章节来源')
} else {
  process.stdout.write(output)
}
if (mode) console.log(`fhv scope ${mode}: ${scope.counts.records} 条卡表记录，${scope.scenarios.length} 个场景身份，${Object.keys(scope.sources).length} 个来源文件`)

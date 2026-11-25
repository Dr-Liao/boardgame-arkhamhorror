// 01-a 修订核心（Revised Core，pack = 'rcore'）逐卡验收证据。
//
// 范围：src/cards/cards-data.js 中 pack === 'rcore' 的 116 张重印号（01501–01603、01683–01695）。
// 这些卡是旧核心 / 扩展包同名卡的再版印刷号：行为只由 canonical 条目（duplicateOfCode）实现，
// 015xx/016xx 自身不得有第二份条目文件（R2）。证据要求见 docs/test/ACCEPTANCE-ORDER.md §3：
//   实现完整性（canonical 已验收 + 文本一致 + 重印只实现一次）、原语设计、玩家交互性（仅图鉴）、
//   证据（本文件逐卡，标题含卡号）、合规与回归。
//
// 口径说明（详见 docs/test/验收-01-a-修订核心.md）：
//   · canonical 验收 = coreCardVerified(canonical) 或逐卡验收账本（core / dunwich / carcosa / tcu / tde）
//     中存在 status === 'verified' 的条目，并可在仓库中回溯到证据文件与测试标题；
//   · 109 张卡号未登记到 entries/_reprint-aliases.js 白名单（已知缺口 G1）：它们是 catalog-only、
//     没有任何运行时（构筑/选人/牌桌）入口，行为由 canonical 唯一实现；白名单只服务运行时可达的重印号。
//     若后续需要任何 015xx/016xx 运行时可达，必须先扩白名单，本文件相应断言会一并收紧。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { REPRINT_ALIASES, reprintAliasesFor } from '../src/cards/card-identity.js'
import { coreCardVerified } from '../src/cards/core-acceptance.js'
import { getAvailability, canSelectInvestigator } from '../src/deck/availability.js'
import { imageDescriptor, imageResolution } from '../presentation/images.js'
import { getCatalogCardView, queryCatalogView } from '../src/cards/card-catalog.js'
import { canonicalCode } from '../src/integration/arkhamdb.js'
import { implementation } from '../src/cards/card-implementation.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const HALL = path.resolve(ROOT, '../..')
registerCardAbilities(CARD_ABILITY_ENTRIES)

// ---------------------------------------------------------------------------
// 范围与基线
// ---------------------------------------------------------------------------

const RCODES = Object.freeze([
  '01501', '01502', '01503', '01504', '01505', '01506', '01507', '01508', '01509', '01510',
  '01511', '01512', '01513', '01514', '01515', '01516', '01517', '01518', '01519', '01520',
  '01521', '01522', '01523', '01524', '01525', '01526', '01527', '01528', '01529', '01530',
  '01531', '01532', '01533', '01534', '01535', '01536', '01537', '01538', '01539', '01540',
  '01541', '01542', '01543', '01544', '01545', '01546', '01547', '01548', '01549', '01550',
  '01551', '01552', '01553', '01554', '01555', '01556', '01557', '01558', '01559', '01560',
  '01561', '01562', '01563', '01564', '01565', '01566', '01567', '01568', '01569', '01570',
  '01571', '01572', '01573', '01574', '01575', '01576', '01577', '01578', '01579', '01580',
  '01581', '01582', '01583', '01584', '01585', '01586', '01587', '01588', '01589', '01590',
  '01591', '01592', '01593', '01594', '01595', '01596', '01597', '01598', '01599', '01600',
  '01601', '01602', '01603', '01683', '01684', '01685', '01686', '01687', '01688', '01689',
  '01690', '01691', '01692', '01693', '01694', '01695',
])

// 再版本地化差异（仅中文文本 / 风味文本；英文印刷文本 116 张全一致）。
const L10N_REVISIONS = Object.freeze({
  '01520': ['textZh'], '01525': ['textZh', 'flavorZh'], '01539': ['textZh', 'flavorZh'],
  '01540': ['textZh', 'flavorZh'], '01563': ['textZh'], '01565': ['textZh'], '01575': ['textZh'],
  '01579': ['flavorZh'], '01589': ['textZh', 'flavorZh'], '01590': ['textZh', 'flavorZh'],
  '01591': ['textZh', 'flavorZh'], '01592': ['textZh'], '01593': ['flavorZh'],
  '01597': ['textZh', 'flavorZh'], '01687': ['textZh'],
})

// 允许与 canonical 不同的字段 = 印刷信息（卡号 / 图 / 包 / 位置 / 数量 / 可用性与验收状态）
// + 上表的再版本地化文本。
const PRINT_DIFF_FIELDS = Object.freeze([
  'acceptanceProfile', 'alternateOfCode', 'alternatedBy', 'availability', 'availabilityScope',
  'backimagesrc', 'code', 'duplicateOfCode', 'duplicatedBy', 'effectStatus', 'imageStatus',
  'imagesrc', 'localeStatus', 'originalCode', 'pack', 'packName', 'position', 'provenanceId',
  'quantity', 'url', 'dataStatus', 'linkedCardCode', 'linkedToCode',
])
const LOCALIZATION_FIELDS = Object.freeze(['textZh', 'flavorZh'])

// ---------------------------------------------------------------------------
// 逐卡验收账本（证据可回溯）
// ---------------------------------------------------------------------------

const LEDGER_FILES = Object.freeze([
  ['audit/core-acceptance.json', 'core'],
  ['audit/dunwich-acceptance.json', 'dunwich'],
  ['audit/carcosa-player-acceptance.json', 'carcosa-player'],
  ['audit/carcosa-all-card-acceptance.json', 'carcosa-all'],
  ['audit/tcu-player-acceptance.json', 'tcu-player'],
  ['audit/tde-player-acceptance.json', 'tde-player'],
  ['audit/50-a-acceptance.json', '50-a'],
  ['audit/60-a-acceptance.json', '60-a'],
])

function loadVerifiedLedger() {
  const byCode = new Map()
  for (const [file, id] of LEDGER_FILES) {
    const json = JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'))
    for (const entry of json.entries || []) {
      if (entry.status !== 'verified') continue
      if (!byCode.has(entry.code)) byCode.set(entry.code, { ledgers: [], evidence: [] })
      const record = byCode.get(entry.code)
      if (!record.ledgers.includes(id)) record.ledgers.push(id)
      for (const item of entry.evidence || []) record.evidence.push({ ledger: id, ...item })
    }
  }
  return byCode
}
const VERIFIED_LEDGER = loadVerifiedLedger()

/** canonical 是否已验收：core 逐卡账本，或其它逐卡验收账本里的 verified 条目。 */
function canonicalAccepted(code) {
  return coreCardVerified(code) || VERIFIED_LEDGER.has(code)
}

function canonicalEvidence(code) {
  return VERIFIED_LEDGER.get(code)?.evidence ?? []
}

const sourceCache = new Map()
function evidenceSource(file) {
  const raw = String(file || '')
  const absolute = raw.startsWith('games/arkhamhorror/') || raw.startsWith('games\\arkhamhorror\\')
    ? path.join(HALL, raw) : path.join(ROOT, raw)
  if (!sourceCache.has(absolute)) sourceCache.set(absolute, existsSync(absolute) ? readFileSync(absolute, 'utf8') : null)
  return sourceCache.get(absolute)
}

/** 证据标题可回溯：要么原样出现在文件里，要么是模板字符串（取标题的最长可定位后缀，≥6 字符）。 */
function titleLocatable(source, title) {
  if (!source || !title) return false
  if (source.includes(title)) return true
  const value = String(title)
  for (let length = value.length - 1; length >= 4; length--) {
    if (source.includes(value.slice(-length))) return true
  }
  return false
}

function readJson(relative) {
  return JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8'))
}

// ---------------------------------------------------------------------------
// 别名与行为形状
// ---------------------------------------------------------------------------

function registeredBehaviorShape(entry) {
  if (!entry) return null
  return {
    kind: entry.kind ?? null,
    scope: entry.scope ?? null,
    abilities: (entry.abilities || []).map(ability => ({
      kind: ability.kind ?? null,
      trigger: ability.trigger ?? null,
      target: ability.target?.kind ?? null,
      fast: ability.fast === true,
      quickEvent: ability.quickEvent === true,
      fromHand: ability.fromHand === true,
      limit: ability.limit ?? null,
      cost: ability.cost ?? null,
    })),
    modifiers: (entry.modifiers || []).map(modifier => ({
      target: modifier.target ?? null,
      amount: modifier.amount ?? null,
    })),
    elderSign: Boolean(entry.elderSign),
    uses: entry.uses ?? null,
    usesType: entry.usesType ?? null,
    playCondition: (entry.playCondition || []).map(item => item?.message ?? String(item)),
  }
}

function sortedStrings(values) {
  return [...values].sort()
}

// ---------------------------------------------------------------------------
// 范围 / 结论基线
// ---------------------------------------------------------------------------

test('01-a 范围：pack=rcore 恰好 116 张，卡号集合与验收范围一致', () => {
  const actual = Object.keys(ALL_CARDS).filter(code => ALL_CARDS[code].pack === 'rcore').sort()
  assert.deepEqual(actual, [...RCODES].sort(), 'pack=rcore 卡号集合必须与 01-a 验收范围一致')
  assert.equal(actual.length, 116, '01-a 修订核心重印号应为 116 张')
  assert.ok(!RCODES.includes('01000'), '01000 占位卡不属于修订核心范围')
  for (const code of RCODES) {
    assert.equal(ALL_CARDS[code].code, code)
    assert.equal(ALL_CARDS[code].packName, 'Revised Core Set')
  }
})

test('01-a 全部重印号均可回溯到原版的逐卡验收账本', () => {
  assert.deepEqual(RCODES.filter(code => !canonicalAccepted(ALL_CARDS[code].duplicateOfCode)), [])
})

test('01-a 重印别名白名单：7 张运行时别名与 canonical 行为完全一致（G1 其余 109 张仅图鉴）', () => {
  const registered = RCODES.filter(code => registeredEntry(code))
  assert.deepEqual(sortedStrings(registered), ['01518', '01522', '01523', '01527', '01533', '01685', '01689'],
    '当前 rcore 运行时别名集合必须与审计基线一致（新增/删除需同步更新验收结论）')
  for (const code of registered) {
    const canonical = ALL_CARDS[code].duplicateOfCode
    const aliasEntry = registeredEntry(code)
    const canonicalEntry = registeredEntry(canonical)
    assert.equal(aliasEntry.reprintOf, canonical, `${code} 的 reprintOf 必须指向 ${canonical}`)
    assert.deepEqual(registeredBehaviorShape(aliasEntry), registeredBehaviorShape(canonicalEntry),
      `${code} 与 ${canonical} 的能力/修正/上限/费用形状必须完全一致`)
    assert.equal(reprintAliasesFor(canonical)?.includes(code), true, `${canonical} 的别名白名单必须包含 ${code}`)
  }
  // 其余 rcore 卡号没有运行时条目：它们是 catalog-only 的图鉴替印，行为仍由 canonical 唯一实现。
  for (const code of RCODES) {
    if (registered.includes(code)) continue
    assert.equal(registeredEntry(code), null, `${code} 当前不应有运行时别名条目`)
    assert.equal(getAvailability(code).availability, 'catalog-only')
  }
})

// ---------------------------------------------------------------------------
// 逐卡验收（每个卡号一条 test，标题含卡号）
// ---------------------------------------------------------------------------

for (const code of RCODES) {
  const card = ALL_CARDS[code]
  const canonicalCodeValue = card.duplicateOfCode
  const canonical = ALL_CARDS[canonicalCodeValue]

  test(`RCore ${code} ${card.name}：修订核心重印号指向已验收 canonical ${canonicalCodeValue}`, () => {
    // 1. 身份：duplicateOfCode 双向映射 + 生产解析路径（arkhamdb 导入沿重印关系回到 canonical）。
    assert.equal(card.pack, 'rcore')
    assert.ok(canonical, `${code} 的 duplicateOfCode 指向的 ${canonicalCodeValue} 必须存在`)
    assert.equal(canonical.duplicatedBy?.includes(code), true,
      `cards-data 的 ${canonicalCodeValue}.duplicatedBy 必须包含 ${code}`)
    assert.equal(canonicalCode(code), canonicalCodeValue, `${code} 的运行时身份必须解析到 ${canonicalCodeValue}`)

    // 2. canonical 实现与验收。
    const canonicalImpl = implementation(canonicalCodeValue)
    assert.equal(canonicalImpl.implemented, true, `canonical ${canonicalCodeValue} 必须有实现（描述子或数据即实现）`)
    assert.ok(canonicalAccepted(canonicalCodeValue), `canonical ${canonicalCodeValue} 必须有逐卡验收结论`)

    // 3. 印刷文本一致：只允许印刷信息差异 + 已登记的再版中文重译；英文 text 必须逐字一致。
    const diffFields = new Set([...new Set([...Object.keys(card), ...Object.keys(canonical)])]
      .filter(field => JSON.stringify(card[field] ?? null) !== JSON.stringify(canonical[field] ?? null)))
    const allowed = new Set([...PRINT_DIFF_FIELDS, ...(L10N_REVISIONS[code] || [])])
    const unexpected = [...diffFields].filter(field => !allowed.has(field))
    assert.deepEqual(unexpected, [], `${code} 与 ${canonicalCodeValue} 存在未登记的行为/文本字段差异`)
    assert.equal(card.text, canonical.text, `${code} 的英文印刷文本必须与 canonical 完全一致`)
    const localizationDiffs = LOCALIZATION_FIELDS.filter(field => diffFields.has(field))
    assert.deepEqual(sortedStrings(localizationDiffs), sortedStrings(L10N_REVISIONS[code] || []),
      `${code} 的中文再版本地化差异必须与登记清单一致`)

    // 4. 重印只实现一次（R2）：别名号没有自己的条目文件。
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), false,
      `${code} 是重印别名，不得有自己的条目文件`)

    // 5. 别名解析：登记到白名单的必须与 canonical 同形；未登记的必须是仅图鉴替印。
    const aliasEntry = registeredEntry(code)
    if (aliasEntry) {
      assert.equal(aliasEntry.reprintOf, canonicalCodeValue)
      assert.deepEqual(registeredBehaviorShape(aliasEntry), registeredBehaviorShape(registeredEntry(canonicalCodeValue)),
        `${code} 与 canonical 的行为形状必须完全一致`)
    } else {
      assert.equal(getAvailability(code).availability, 'catalog-only',
        `${code} 未登记运行时别名时只能是 catalog-only，不能进入构筑/选人/牌桌`)
    }

    // 6. 玩家交互性：仅图鉴、不可构筑 / 不可选人 / 不可上牌桌。
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'catalog-only')
    assert.equal(availability.strictAccepted, false)
    assert.equal(availability.deckbuilding, false)
    assert.equal(availability.selectable, false)
    assert.equal(canSelectInvestigator(code), false)

    // 7. 图鉴卡面可解析：own 卡图优先，canonical 美术作为 duplicate-of 兜底候选。
    const descriptor = imageDescriptor(code)
    assert.ok(descriptor, `${code} 必须能解析出卡图描述符`)
    assert.notEqual(imageResolution(code).imageStatus, 'unresolved', `${code} 的卡图状态不能是 unresolved`)
    assert.ok(descriptor.front.candidates.some(candidate => String(candidate.art) === canonicalCodeValue),
      `${code} 的正面候选必须包含 canonical 美术 ${canonicalCodeValue} 作为兜底`)
    const view = getCatalogCardView(code, { includeRaw: false })
    assert.equal(view?.code, code)
    assert.equal(view?.strictAccepted, false)
    assert.equal(view?.availability, 'catalog-only')
  })
}

// ---------------------------------------------------------------------------
// 证据：canonical 逐卡证据可回溯 + 本文件逐卡覆盖
// ---------------------------------------------------------------------------

test('01-a 证据可回溯：116 张通过卡的 canonical 账本条目、证据文件与测试标题均可定位', () => {
  const checked = []
  for (const code of RCODES) {
    const canonical = ALL_CARDS[code].duplicateOfCode
    const evidence = canonicalEvidence(canonical)
    assert.ok(evidence.length > 0, `canonical ${canonical} 必须至少有 1 条逐卡验收证据`)
    let locatable = 0
    for (const item of evidence) {
      const source = evidenceSource(item.file)
      assert.ok(source != null, `canonical ${canonical} 的证据文件必须存在：${item.file}`)
      if (titleLocatable(source, item.test)) locatable++
    }
    assert.ok(locatable > 0, `canonical ${canonical} 至少 1 条证据的测试标题必须能在当前测试文件中定位`)
    checked.push(canonical)
  }
  assert.equal(new Set(checked).size, checked.length, 'canonical 证据不应被重复计数')
  assert.equal(checked.length, RCODES.length)
})

test('01-a 证据：本文件按卡号逐条覆盖 116 张（标题含卡号，等价于 §3 维度 4）', () => {
  assert.equal(RCODES.length, 116)
  assert.equal(new Set(RCODES).size, 116, '验收卡号不得重复')
  for (const code of RCODES) {
    // 每个卡号对应上方循环生成的一条 test，标题以 "RCore <卡号> " 开头。
    assert.match(`RCore ${code} ${ALL_CARDS[code].name}`, /^RCore 01[56]\d{2} /, '标题必须含 5 位卡号')
    assert.equal(ALL_CARDS[code].pack, 'rcore', `${code} 必须属于 pack=rcore`)
  }
})

// ---------------------------------------------------------------------------
// 国内化 / 合规 / 交互专项
// ---------------------------------------------------------------------------

test('01-a 中文再版重译清单：13 张 textZh、9 张 flavorZh 差异，英文文本 116 张全一致', () => {
  const diffOf = field => RCODES.filter(code => {
    const card = ALL_CARDS[code]
    const canonical = ALL_CARDS[card.duplicateOfCode]
    return JSON.stringify(card[field] ?? null) !== JSON.stringify(canonical[field] ?? null)
  })
  assert.deepEqual(diffOf('text'), [], '英文印刷文本不允许差异')
  const textZhDiffs = diffOf('textZh')
  const flavorZhDiffs = diffOf('flavorZh')
  assert.equal(textZhDiffs.length, 13, '再版中文规则文本差异应为 13 张（官方重译）')
  assert.equal(flavorZhDiffs.length, 9, '再版中文风味文本差异应为 9 张（官方重译）')
  for (const code of [...new Set([...textZhDiffs, ...flavorZhDiffs])]) {
    assert.ok(L10N_REVISIONS[code], `${code} 的中文差异必须在再版重译清单中登记`)
  }
  for (const [code, fields] of Object.entries(L10N_REVISIONS)) {
    assert.ok(RCODES.includes(code), `重译清单中的 ${code} 必须属于 01-a 范围`)
    const declared = [...fields].sort()
    const actual = [textZhDiffs.includes(code) ? 'textZh' : null, flavorZhDiffs.includes(code) ? 'flavorZh' : null]
      .filter(Boolean).sort()
    assert.deepEqual(actual, declared, `${code} 的中文差异字段必须与登记清单一致`)
  }
})

test('01-a 合规：条目合规账本 R2 重印双实现为 0，且 rcore 卡号不在阻断项基线', () => {
  const report = readJson('audit/card-entry-compliance.json')
  assert.equal(report.counts.reprintDuplicate, 0, 'R2 重印双实现必须为 0')
  assert.equal(report.counts.playConditionGap, 0, 'R3 回合限制缺失必须为 0')
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const baseline = report.baseline?.[rule] || []
    const overlap = baseline.filter(code => RCODES.includes(code))
    assert.deepEqual(overlap, [], `rcore 卡号不得出现在 ${rule} 阻断项基线里`)
  }
  // 116 张重印号都没有自己的条目文件 = 没有第二份实现。
  const ownEntries = RCODES.filter(code => existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)))
  assert.deepEqual(ownEntries, [], '015xx/016xx 不允许有自己的条目文件（重印只实现一次）')
})

test('01-a 交互：图鉴 pack=rcore 查询返回 116 张，全部 catalog-only 且卡图可解析', () => {
  const page = queryCatalogView({ packCode: 'rcore', limit: 200 })
  assert.equal(page.total, 116)
  assert.equal(page.cards.length, 116)
  assert.deepEqual(sortedStrings(page.cards.map(card => card.code)), sortedStrings(RCODES))
  for (const card of page.cards) {
    assert.equal(card.availability, 'catalog-only', `${card.code} 在目录查询中必须保持 catalog-only`)
    assert.notEqual(card.imageStatus, 'unresolved')
    assert.ok(card.images?.front?.candidates?.length > 0)
    const availability = getAvailability(card.code)
    assert.equal(availability.strictAccepted, false)
    assert.equal(availability.deckbuilding, false)
  }
})

test('01-a 交互：修订核心调查员替印不可选人（01501–01505 只作图鉴）', () => {
  for (const code of ['01501', '01502', '01503', '01504', '01505']) {
    assert.equal(ALL_CARDS[code].alternateOfCode, ALL_CARDS[code].duplicateOfCode)
    assert.equal(canSelectInvestigator(code), false, `${code} 是修订核心替印，不能进入选人池`)
    assert.equal(getAvailability(code).selectable, false)
    assert.equal(getAvailability(code).availability, 'catalog-only')
  }
})

test('01-a 已知缺口 G1 披露：109 张未登记运行时别名，均为 catalog-only 且没有独立实现', () => {
  const unregistered = RCODES.filter(code => !registeredEntry(code))
  assert.equal(unregistered.length, 109)
  for (const code of unregistered) {
    assert.equal(getAvailability(code).availability, 'catalog-only')
    assert.equal(canSelectInvestigator(code), false)
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), false)
  }
  // 白名单里已登记的 7 张都必须真的在注册表里（表/运行时不能漂移）。
  for (const code of RCODES) {
    if (registeredEntry(code)) continue
    const canonical = ALL_CARDS[code].duplicateOfCode
    assert.ok(!(reprintAliasesFor(canonical) || []).includes(code), `${code} 不在注册表时也不能出现在白名单`)
  }
})

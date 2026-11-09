#!/usr/bin/env node
// 全战役「剧情文本」中文审计扫描器（只读）。
//
// 对象（玩家实际读到的剧情层）：
//   · content/campaigns/<campaign>/story-text.js —— 序章 / 各章导入 / 幕间 / 结局 / 尾声
//   · content/campaigns/theCircleUndone/scenarios/*/story-text.js —— 逐关叙事正文
//   · 战役流程数据（contentRegistry.getCampaign）：幕间/剧情节点正文、选择 prompt/label、记录标签、结局
//   · 非生成战役模块（interludes / prologue / epilogue / checkpoints / flashbacks / introduction /
//     resolutions / dual-story / parts / story-access）里的玩家可见字面量
//   · src/campaign/story.js 的内联叙事与标题
//
// 用法（在 games/arkhamhorror 下运行）：
//   node docs/translate/tools/scan-story.mjs            # 控制台摘要
//   node docs/translate/tools/scan-story.mjs --json     # 打印全量候选（调试）
//   node docs/translate/tools/scan-story.mjs --write    # 写 scan/story-coverage.json + scan/story-candidates.json
//
// 口径：机械候选 ≠ 定论。候选按 (campaign, kind, 文本指纹) 聚合，供人工复核后写入 docs/translate/story/。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MOD, CAMPAIGN_IDS, CAMPAIGN_NAMES, CJK, CJK_ALL, TRADITIONAL_MAP, analyzeZhText, cjkCount, englishWordCount,
  flattenLeaves, hasCJK, jsStringLiterals, lineOfText, makeLineIndex, relPath, segmentationCandidates,
  sha256, stripMarkup, tokenCandidates, walkFiles,
} from './_shared.mjs'

const OUT_DIR = join(MOD, 'docs/translate/scan')
const STORY_MODULE_SOURCES = {
  nightOfTheZealot: { file: 'content/campaigns/nightOfTheZealot/story-text.js', export: 'STORY_TEXT' },
  theDunwichLegacy: { file: 'content/campaigns/theDunwichLegacy/story-text.js', export: 'DUNWICH_STORY_TEXT' },
  thePathToCarcosa: { file: 'content/campaigns/thePathToCarcosa/story-text.js', export: 'CARCOSA_STORY_TEXT' },
  theForgottenAge: { file: 'content/campaigns/theForgottenAge/story-text.js', export: 'TFA_STORY_TEXT' },
  theCircleUndone: { file: 'content/campaigns/theCircleUndone/story-text.js', export: 'TCU_STORY_TEXT' },
  theDreamEaters: { file: 'content/campaigns/theDreamEaters/story-text.js', export: 'TDE_STORY_TEXT' },
  theInnsmouthConspiracy: { file: 'content/campaigns/theInnsmouthConspiracy/story-text.js', export: 'STORY_TEXT', pick: value => value.zh },
  edgeOfTheEarth: { file: 'content/campaigns/edgeOfTheEarth/story-text.js', export: 'EOTE_STORY_TEXT' },
}
// 非生成叙事模块：只扫这些文件名里含中文/英文字面量的玩家可见文本。
const NARRATIVE_MODULE = /(?:^|[/\\])(?:interludes|prologue|epilogue|checkpoints|flashbacks|introduction|resolutions|dual-story|parts|story-access|story-roles)\.js$/
const SKIP_RAW_FILES = /(?:^|[/\\])(?:cards-data|card-data|card-acceptance|card-text-fixes|cards|encounter-rules|keywords|manifest|shared|record-labels|layout|index|behavior|act-reveal|reveal-hooks|chaos|flow)\.js$/
const NON_TEXT_MODULES = new Set([
  'source', 'generatedBy', 'sourceHashes', 'enSourceHashes', 'zhSourceHashes', 'generator', 'generatedFrom',
  'glossaryVersion', 'translationBatches', 'completedBatches', 'pendingBatches', 'meta', 'status', 'stage',
  'sourceKind', 'officialChinese', 'sources', 'batches', 'chineseGaps', 'chinese', 'sectionCount',
])

const units = []
const seenTexts = new Map()
const stats = {
  campaigns: {}, rawLiteralFiles: 0, flowNodes: 0, reference: {}, errors: [], duplicates: 0,
  localizedFallbackSource: 0,
}
const campaignCache = new Map()

function ensureStats(campaign) {
  stats.campaigns[campaign] ??= {
    campaign, name: CAMPAIGN_NAMES[campaign], uniqueTexts: 0, occurrences: 0, cjkChars: 0,
    flagCounts: {}, scenarios: new Set(), traditionalTotal: 0, zhu: 0,
  }
  return stats.campaigns[campaign]
}

function addUnit(unit) {
  const campaign = unit.campaign
  if (!campaign || !CAMPAIGN_IDS.includes(campaign)) return
  const text = String(unit.text ?? '')
  if (!text.trim()) return
  const dedupeKey = `${campaign}\u0000${sha256(text.trim())}`
  if (seenTexts.has(dedupeKey)) { stats.duplicates++; return }
  seenTexts.set(dedupeKey, true)
  units.push({
    layer: 'story',
    sourceKind: unit.sourceKind || 'unknown',
    campaign,
    scenario: unit.scenario || null,
    pointer: unit.pointer || '',
    file: unit.file || null,
    line: unit.line || null,
    text,
    en: unit.en || null,
    group: unit.group || '',
    allowEnglishName: Boolean(unit.allowEnglishName),
  })
}

// ---------------------------------------------------------------------------
// 1) story-text.js：结构化展平（附 zh/en 对照）
// ---------------------------------------------------------------------------
// 各战役 story-text.js 里不属于「剧情正文」的键：英文源、生成元数据、指南源等。
const STORY_PATH_FILTERS = {
  edgeOfTheEarth: /\.sectionsEn(\.|$)|(?:^|\.)(?:key|status|meta|chineseGaps|guide)(\.|$)|^(?:meta|guide|chinese)\./,
  theDreamEaters: /\.(?:key|group|pendingTranslation|status|en)$|^(?:conceptTerms|keywords)\./,
  theInnsmouthConspiracy: /^scenarios\.[^.]+\.(?:setup|specialRules|tokens|label|heading)|^base\.(?:specialRules|label)$/,
  theCircleUndone: /^(?:generatedBy|sourceHashes)/,
}
const STORY_PATH_SKIP = /(?:^|\.)(?:key|id|en|nameEn|titleEn|group|pendingTranslation|status)$/

async function collectStoryModules() {
  for (const campaign of CAMPAIGN_IDS) {
    const config = STORY_MODULE_SOURCES[campaign]
    const filePath = join(MOD, config.file)
    let module
    try {
      module = await import(new URL(`file:///${filePath.replaceAll('\\', '/')}`))
    } catch (error) {
      stats.errors.push({ campaign, error: String(error) })
      continue
    }
    const root = config.pick ? config.pick(module[config.export]) : module[config.export]
    if (!root) continue
    const leaves = flattenLeaves(root, { skipKey: new RegExp(`(^|\\.)(?:${[...NON_TEXT_MODULES].join('|')})$`, 'i') })
    const filter = STORY_PATH_FILTERS[campaign]
    for (const leaf of leaves) {
      if (filter && filter.test(leaf.path)) continue
      if (STORY_PATH_SKIP.test(leaf.path)) continue
      // 生成物自带的补译来源登记（`supplements: [{path, sha256, entries}]`）是元数据，不是剧情正文。
      if (/^supplements(?:\.|$)/.test(leaf.path)) continue
      addUnit({
        campaign, file: config.file, pointer: leaf.path, text: leaf.text,
        sourceKind: 'story-text', group: leaf.path.split('.')[0],
        allowEnglishName: /title|heading|chapterTitles|investigatorTitles|keywords|recordLabels/i.test(leaf.path),
      })
    }
    // EOTE：sectionsEn 是英文源，用来统计中文覆盖（meta.chineseGaps 应已为 0）。
    if (campaign === 'edgeOfTheEarth') {
      const chapters = module.EOTE_STORY_TEXT.chapters || {}
      const coverage = { chapters: {}, campaignLeaves: leaves.length }
      for (const [id, chapter] of Object.entries(chapters)) {
        const zh = chapter.sections || {}
        const en = chapter.sectionsEn || {}
        const zhLeaves = flattenLeaves(zh, { skipKey: /^(status)$/i })
        const enLeaves = flattenLeaves(en, { skipKey: /^(status)$/i })
        coverage.chapters[id] = {
          zhLeaves: zhLeaves.length, enLeaves: enLeaves.length, gaps: Object.keys(chapter.chineseGaps || {}).length,
        }
      }
      stats.reference.edgeOfTheEarth = coverage
    }
  }
  // 三循环逐关 story-text（forTheGreaterGood / unionAndDisillusion 是单独生成物）。
  // TCU 的 SETUP 属于关卡设置文本，由 scan-setup 通过 scenario data 审计。
  const tcuFiles = walkFiles(join(MOD, 'content/campaigns/theCircleUndone/scenarios'), path => /[/\\]story-text\.js$/.test(path))
  for (const filePath of tcuFiles) {
    const module = await import(new URL(`file:///${filePath.replaceAll('\\', '/')}`))
    for (const [name, value] of Object.entries(module)) {
      if (name === 'SETUP') continue
      if (typeof value !== 'string' || !hasCJK(value)) continue
      // 允许正文里用空行分段的整串；按空行拆成逻辑段以复用分段检测。
      for (const [index, paragraph] of value.split(/\n{2,}/).map(part => part.trim()).filter(Boolean).entries()) {
        addUnit({
          campaign: 'theCircleUndone', file: relPath(filePath), pointer: `${name}[${index}]`,
          text: paragraph, sourceKind: 'scenario-story-text', group: 'scenario',
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2) 战役流程数据（registry）：幕间正文 / 选择 prompt / label / 记录标签 / 结局
// ---------------------------------------------------------------------------
function collectCampaignFlow() {
  return import(new URL(`file:///${join(MOD, 'content/registered.js').replaceAll('\\', '/')}`)).then(({ contentRegistry }) => {
    for (const campaign of CAMPAIGN_IDS) {
      let manifest
      try {
        manifest = contentRegistry.getCampaign(campaign)
      } catch (error) {
        stats.errors.push({ campaign, error: `getCampaign: ${String(error)}` })
        continue
      }
      campaignCache.set(campaign, manifest)
      const flow = manifest.flow || {}
      for (const [nodeId, node] of Object.entries(flow.nodes || {})) {
        stats.flowNodes++
        const pointer = `flow.nodes.${nodeId}`
        const push = (subPath, text, { name = false } = {}) => {
          if (typeof text !== 'string' || !text.trim()) return
          addUnit({
            campaign, scenario: node.scenarioId || null, pointer: `${pointer}.${subPath}`, text,
            sourceKind: 'campaign-flow', group: node.type || 'flow', allowEnglishName: name,
          })
        }
        push('text', node.text)
        push('prompt', node.prompt)
        push('storyText', node.storyText)
        if (typeof node.title === 'string' && (hasCJK(node.title) || /[:：]/.test(node.title))) push('title', node.title)
        if (typeof node.name === 'string' && hasCJK(node.name)) push('name', node.name, { name: true })
        for (const [index, option] of (node.options || []).entries()) {
          if (typeof option?.label === 'string') push(`options.${index}.label`, option.label)
        }
        for (const [index, effect] of (node.effects || []).entries()) {
          push(`effects.${index}.prompt`, effect?.prompt)
          push(`effects.${index}.withText`, effect?.withText)
          push(`effects.${index}.withoutText`, effect?.withoutText)
          for (const [key, value] of Object.entries(effect?.labels || {})) push(`effects.${index}.labels.${key}`, value)
          for (const [index2, text] of (effect?.options || []).entries()) {
            if (typeof text === 'string') push(`effects.${index}.options.${index2}`, text)
            else if (typeof text?.label === 'string') push(`effects.${index}.options.${index2}.label`, text.label)
          }
          for (const [key, value] of Object.entries(effect?.prompts || {})) push(`effects.${index}.prompts.${key}`, value)
        }
      }
      // 记录标签 / 补给标签 / 结局：会出现在故事日志的结算条目里。
      for (const [key, value] of Object.entries(manifest.recordLabels || {})) {
        addUnit({ campaign, pointer: `recordLabels.${key}`, text: value, sourceKind: 'campaign-recordLabel', group: 'label', allowEnglishName: true })
      }
      for (const [key, value] of Object.entries(manifest.supplyLabels || {})) {
        addUnit({ campaign, pointer: `supplyLabels.${key}`, text: value, sourceKind: 'campaign-supplyLabel', group: 'label', allowEnglishName: true })
      }
      for (const [index, ending] of (manifest.endings || []).entries()) {
        for (const key of ['label', 'title', 'text']) {
          if (typeof ending?.[key] === 'string') addUnit({ campaign, pointer: `endings.${index}.${key}`, text: ending[key], sourceKind: 'campaign-ending', group: 'ending', allowEnglishName: key !== 'text' })
        }
      }
    }
  })
}

// ---------------------------------------------------------------------------
// 3) 非生成叙事模块 / src/campaign/story.js 里的玩家可见字面量
// ---------------------------------------------------------------------------
function collectRawNarrativeLiterals() {
  const campaignRoot = join(MOD, 'content/campaigns')
  const files = walkFiles(campaignRoot, path => NARRATIVE_MODULE.test(path) && !SKIP_RAW_FILES.test(path) && path.endsWith('.js'))
  files.push(join(MOD, 'src/campaign/story.js'))
  for (const filePath of files) {
    stats.rawLiteralFiles++
    const fileLines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const literal of jsStringLiterals(filePath)) {
      const text = literal.text.trim()
      if (text.length < 10) continue
      // 双语显示元数据（nameEn / titleEn / key 等）：是英文原名数据，不算正文残留。
      const lineSource = fileLines[literal.line - 1] || ''
      if (/(?:^|[^\w])(?:nameEn|titleEn|labelEn|keyEn|subtitleEn)\s*:\s*['"`]/.test(lineSource)) continue
      if (!hasCJK(text) && !/\b(?:the|and|you|your|with|that|this|from|into|they|their)\b/i.test(text)) continue
      // 跳过路径/键名/枚举/日志型短句。
      if (/^[./\\]|^[a-z0-9_.-]+$|^[\w.]+\.(?:js|json|png|webp|mp3)$/i.test(text)) continue
      const campaign = CAMPAIGN_IDS.find(id => filePath.includes(`campaigns${'\\'}${id}`) || filePath.includes(`campaigns/${id}`))
      addUnit({
        campaign, file: relPath(filePath), line: literal.line, pointer: `literal@${literal.line}`, text,
        sourceKind: 'campaign-module', group: 'module',
      })
    }
  }
}

// ---------------------------------------------------------------------------
// 4) 检测
// ---------------------------------------------------------------------------
function detect(unit) {
  const issues = []
  // TDE 的 interludes.js / dual-story.js 保留锁定英文原文作回退；P8-T 生成物 100% 有中文时不会显示。
  // 这类英文不作为「未翻译」finding，只在覆盖率里记数（最终由 tests/tde-story.test.mjs 的
  // pendingTranslation=false 断言保证不会被展示）。
  if (unit.campaign === 'theDreamEaters' && unit.sourceKind === 'campaign-module' && !hasCJK(unit.text)) {
    stats.localizedFallbackSource++
    return issues
  }
  // 原始模块里短的英文专名字面量（nameEn 等）是双语显示数据，不算正文残留。
  if (unit.sourceKind === 'campaign-module' && !hasCJK(unit.text) && stripMarkup(unit.text).length < 25) return issues
  const htmlBody = /<[a-z][^>]*>/i.test(unit.text)
  const ticStoryPath = /^(?:scenarios\.[^.]+\.(?:intro\d*|flashback\d*|resolutions\.[^.]+)|base\.(?:interludes|interlude\d+|epilogue|flashback\d+))/.test(unit.pointer)
  for (const issue of analyzeZhText(unit.text, { path: unit.pointer, kind: 'paragraph', allowEnglishName: unit.allowEnglishName })) {
    // TIC 的剧情源是 HTML：标签本身会被展示层剥掉，不计「HTML 泄漏」；结构损失单列 display-segmentation。
    if (unit.campaign === 'theInnsmouthConspiracy') {
      if (issue.kind === 'html-markup') continue
      if (!ticStoryPath) continue // tooltips/label/setup/specialRules 属指南源，由 guide 扫描器负责
      // 以下问题已在展示层统一处理（textBlocks/restoreInlineText、flashbacks.js#story）：
      //   · ICU 转义 {‘{’}cultist{‘}’} → [cultist]；
      //   · 段首英文分节标签 Intro 4: → 引言 4：；
      //   · Markdown 强调 *…* / _…_ 一律剥掉（story-0006）；
      //   · 结局正文段首「结局 N：」由 journal/flashbacks 剥离（story-0009）。
      // 源生成物保留参考 locale 原样，审计以玩家可见文本为准，不把已清洗项重复计入。
      if (['marker-icu-escape', 'label-english-label', 'markdown-emphasis', 'resolution-label-duplicate'].includes(issue.kind)) continue
    }
    // 原始 HTML 文本里的「未终止/长段/ASCII 标点」多为标签切割噪声，跳过，只保留可复现的整段问题。
    if (htmlBody && ['unterminated-paragraph', 'long-paragraph'].includes(issue.kind)) continue
    if (/^prologue\.tarotResults\..*\.text$/.test(unit.pointer)
      && (issue.kind.startsWith('marker-') || issue.kind === 'symbol-brace-token')) continue // {name} 运行时替换
    // TFA 补给选择器的 {pointsRemaining} 由 campaign-effects 插值，不是正文格式问题。
    if (unit.campaign === 'theForgottenAge' && unit.pointer === 'supplies.choose'
      && ['symbol-brace-token', 'marker-placeholder-brace'].includes(issue.kind)) continue
    if (/^prologue\.sections\.quote\./.test(unit.pointer) && issue.kind === 'untranslated') continue // 作品名引用，见术语报告
    // TDE 幕间/正文里的「黑猫 2：」「蜘蛛女王 1：」是同一篇幕间内的分节标记，不是重复标题。
    if (unit.campaign === 'theDreamEaters' && issue.kind === 'label-chinese-label'
      && !/^localeKeys\..*epilogue\d+\.body$/.test(unit.pointer)) continue
    // TIC「导言 N:」是同一章多段 intro 拼在一节时的分节标记，保留为 low 候选，不算 high。
    if (unit.campaign === 'theInnsmouthConspiracy' && issue.kind === 'label-chinese-label') issue.severity = 'low'
    issues.push(issue)
  }
  // 段内换行：只针对「一数组元素 = 读者界面上一个 <p>」的段落条目。
  const isParagraphArrayElement = /\.\d+$/.test(unit.pointer) || /^(?:INTRO|RESOLUTION_\w+)\[\d+\]$/.test(unit.pointer)
  if (isParagraphArrayElement && /[\n\r]/.test(unit.text)) {
    issues.push({ kind: 'segmentation-in-paragraph', severity: 'medium', evidence: unit.text.slice(0, 100) })
  }
  // 展示链分段丢失：源数据是「一整串 HTML/多段文本」，消费端塞进单个段落元素，读者端换行被 HTML 折叠。
  //   · TIC 已修复：textBlocks() 现在按空行/列表拆成段落数组（scenarioIntroduction、resolutions.journal、
  //     interludes 日志都用它），TIC 侧不再按「源串含多个 <p>」误报；回归见 tests/tic-story-format.test.mjs。
  //   · TDE：只有 dreamSelection.body / dreams.*.body 作为单段直接塞进 story reader。
  if (unit.campaign === 'theDreamEaters' && /\.(?:dreamSelection|dreams\..+)\.body$/.test(unit.pointer) && /\n\s*\n/.test(unit.text)) {
    issues.push({ kind: 'display-segmentation', severity: 'medium', evidence: unit.text.slice(0, 100) })
  }
  // 结局/尾声正文段首重复标签：结局面板已经用「结局 N」做小标题，正文又以「结局 N：」开头。
  // EOTE 的 resolutionText() 已显式剥离该前缀；其余战役没有，读者会看到两遍。
  const firstParagraph = unit.pointer.endsWith('.0') || /\.body$/.test(unit.pointer)
  const inResolutionContext = /(?:^|\.)(?:resolutions?|noResolution|r\d+|resolution\d+)(?:\.|$)/.test(unit.pointer)
    || /localeKeys\..*epilogue\d+\.body$/.test(unit.pointer)
  const labelMatch = /^(?:结局|尾声|无结局|Resolution|No Resolution|未达成结局)\s*(?:\d+)?\s*[：:]/.exec(stripMarkup(unit.text))
  // TIC 的结局面板标题由 journal/flashbacks 剥离正文标签（story-0009），源串保留原样。
  if (inResolutionContext && firstParagraph && labelMatch
    && !(unit.campaign === 'theInnsmouthConspiracy' && ticStoryPath)) {
    const englishLabel = /^[A-Za-z]/.test(labelMatch[0])
    issues.push({
      kind: englishLabel ? 'resolution-label-untranslated' : 'resolution-label-duplicate',
      severity: englishLabel ? 'high' : 'medium', evidence: labelMatch[0],
    })
  }
  if (!htmlBody) {
    for (const issue of segmentationCandidates(unit.text, { kind: 'paragraph' })) issues.push(issue)
  } else if (!(unit.campaign === 'theInnsmouthConspiracy' && ticStoryPath)) {
    // HTML 源里的 Markdown 强调记号（*记录内容* / _地名_）：TIC 展示层已由 restoreInlineText 剥掉，
    // 其余来源仍按原串计入（story-0006 只针对 TIC 的展示链）。
    const plain = stripMarkup(unit.text)
    for (const match of plain.matchAll(/(?<![\w*])\*(?!\s)[^*\n]{1,60}\*(?![\w*])/g)) {
      issues.push({ kind: 'markdown-emphasis', severity: 'medium', evidence: match[0] })
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
await collectStoryModules()
await collectCampaignFlow()
collectRawNarrativeLiterals()

// registry 投影出来的 flow 文本没有源文件：对命中候选的文本回查战役模块，拿到真实 file:line。
const flowLocateCache = new Map()
function locateCampaignText(campaign, text, pointer = '') {
  if (!campaign || !text) return null
  const needles = [text]
  // prompt 在模块里通常是 `prompt: '...'`；优先按字面定义行定位，避免命中同句的剧情正文。
  if (/\.prompt$/.test(pointer)) needles.unshift(`prompt: '${text}'`, `prompt: "${text}"`, `prompt: \`${text}\``)
  if (flowLocateCache.has(campaign)) {
    const entry = flowLocateCache.get(campaign)
    for (const file of entry.files) {
      for (const needle of needles) {
        const line = lineOfText(join(MOD, file), needle)
        if (line) return { file, line }
      }
    }
    return null
  }
  const campaignDir = join(MOD, 'content/campaigns', campaign)
  const files = walkFiles(campaignDir, path => path.endsWith('.js') && !path.includes('scenario'))
    .map(path => relPath(path))
  flowLocateCache.set(campaign, { files })
  return locateCampaignText(campaign, text, pointer)
}

const candidates = []
const byText = new Map()
for (const unit of units) {
  const campaignStats = ensureStats(unit.campaign)
  campaignStats.occurrences++
  const key = `${unit.campaign}\u0000${sha256(unit.text)}`
  if (!byText.has(key)) {
    byText.set(key, true)
    campaignStats.uniqueTexts++
    campaignStats.cjkChars += cjkCount(unit.text)
  }
  if (unit.scenario) campaignStats.scenarios.add(unit.scenario)
  for (const char of unit.text) if (TRADITIONAL_MAP[char]) campaignStats.traditionalTotal++
  for (const match of unit.text.matchAll(/著/g)) {
    const before = unit.text[match.index - 1] || '', after = unit.text[match.index + 1] || ''
    if (/[名作称显土著]/.test(before) || /[名作称]/.test(after)) continue
    campaignStats.zhu++
  }
  const issues = detect(unit)
  if (!issues.length) continue
  let file = unit.file
  let line = unit.line ?? (unit.file ? lineOfText(join(MOD, unit.file), unit.text) : null)
  if (!file && unit.sourceKind === 'campaign-flow') {
    const located = locateCampaignText(unit.campaign, unit.text, unit.pointer)
    if (located) { file = located.file; line = located.line }
  }
  for (const issue of issues) {
    campaignStats.flagCounts[issue.kind] = (campaignStats.flagCounts[issue.kind] || 0) + 1
    candidates.push({
      layer: 'story', campaign: unit.campaign, campaignName: CAMPAIGN_NAMES[unit.campaign],
      scenario: unit.scenario, group: unit.group, sourceKind: unit.sourceKind,
      pointer: unit.pointer, file, line, text: unit.text,
      kind: issue.kind, severity: issue.severity || 'medium', evidence: issue.evidence || '', detail: issue,
    })
  }
}

// 按 (campaign, kind, 文本指纹) 聚合候选，保留最多 8 个样本。
const groups = new Map()
for (const candidate of candidates) {
  const key = `${candidate.campaign}\u0000${candidate.kind}\u0000${sha256(candidate.text)}`
  if (!groups.has(key)) groups.set(key, { ...candidate, count: 0, samples: [], pointers: [] })
  const group = groups.get(key)
  group.count++
  if (group.samples.length < 8) {
    group.samples.push({ file: candidate.file, line: candidate.line, pointer: candidate.pointer, evidence: candidate.evidence || candidate.text.slice(0, 140) })
  }
  if (group.pointers.length < 8) group.pointers.push({ file: candidate.file, line: candidate.line, pointer: candidate.pointer })
}
const grouped = [...groups.values()].sort((a, b) =>
  (b.severity === 'high') - (a.severity === 'high') ||
  a.campaign.localeCompare(b.campaign) || a.kind.localeCompare(b.kind))

// 剧情覆盖（TIC/EOTE 有 en/zh 平行源，可以直接对账）。
async function storyCoverage() {
  const coverage = {}
  try {
    const tic = await import(new URL(`file:///${join(MOD, 'content/campaigns/theInnsmouthConspiracy/story-text.js').replaceAll('\\', '/')}`))
    const flatten = (value, options) => flattenLeaves(value, options)
    const en = flatten(tic.STORY_TEXT.en.scenarios)
    const zh = flatten(tic.STORY_TEXT.zh.scenarios)
    const enPaths = new Set(en.map(leaf => leaf.path)), zhPaths = new Set(zh.map(leaf => leaf.path))
    coverage.theInnsmouthConspiracy = {
      enLeaves: en.length, zhLeaves: zh.length,
      enOnly: [...enPaths].filter(path => !zhPaths.has(path)).length,
      zhOnly: [...zhPaths].filter(path => !enPaths.has(path)).length,
    }
  } catch (error) {
    stats.errors.push({ campaign: 'theInnsmouthConspiracy', error: `coverage: ${String(error)}` })
  }
  return coverage
}

const summary = {
  generatedAt: '2026-11-09',
  scope: { campaigns: CAMPAIGN_IDS.length, units: units.length, rawLiteralFiles: stats.rawLiteralFiles, flowNodes: stats.flowNodes },
  campaigns: Object.fromEntries(Object.entries(stats.campaigns).map(([id, value]) => [id, {
    ...value, scenarios: [...value.scenarios],
    uniqueTexts: value.uniqueTexts, occurrences: value.occurrences,
  }])),
  candidateCount: candidates.length,
  groupedCount: grouped.length,
  byKind: candidates.reduce((accumulator, candidate) => {
    accumulator[candidate.kind] = (accumulator[candidate.kind] || 0) + 1
    return accumulator
  }, {}),
  bySeverity: candidates.reduce((accumulator, candidate) => {
    accumulator[candidate.severity] = (accumulator[candidate.severity] || 0) + 1
    return accumulator
  }, {}),
  reference: stats.reference,
  localizedFallbackSource: stats.localizedFallbackSource,
  storyCoverage: await storyCoverage(),
  sourceErrors: stats.errors,
}
const output = { summary, candidates: grouped }

if (process.argv.includes('--write')) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'story-coverage.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(OUT_DIR, 'story-candidates.json'), `${JSON.stringify(output, null, 2)}\n`)
  console.log(`story scan written: ${relPath(join(OUT_DIR, 'story-candidates.json'))} (${grouped.length} groups / ${candidates.length} occurrences)`)
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2))
} else {
  console.log(JSON.stringify({ ...summary, topGroups: grouped.slice(0, 40).map(group => ({
    campaign: group.campaign, kind: group.kind, severity: group.severity, count: group.count,
    file: group.file, line: group.line, pointer: group.pointer, evidence: (group.evidence || group.text).slice(0, 100),
  })) }, null, 2))
}

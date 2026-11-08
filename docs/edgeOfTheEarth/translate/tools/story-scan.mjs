#!/usr/bin/env node
// 《地球边缘》story area 只读审计扫描器（story-audit）。
//
// 对象：
//   · content/campaigns/edgeOfTheEarth/story-text.js（生成物：章节 sections/sectionsEn/chineseGaps、
//     战役 campaign 分组、localeKeys、interludes/epilogue 派生视图、meta）
//   · 非生成战役模块（prologue/checkpoints/interludes/epilogue/records/keywords/parts/shared/
//     shared-encounters/flow）里的玩家可见中文/英文字面量
//   · 展示链：story-access.js（章节 texts.js 实际消费 sections）、records.js#storyBody（flow 节点正文）、
//     src/campaign/story.js#introduction（scenario intro 日志）、web/story-reader.js（逐段直排）
//
// 用法（从 Mod 根 games/arkhamhorror 运行；不 spawn 子进程、只读源码）：
//   node docs/edgeOfTheEarth/translate/tools/story-scan.mjs            # 控制台摘要 JSON
//   node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --json     # 全量明细 JSON
//   node docs/edgeOfTheEarth/translate/tools/story-scan.mjs --write    # 写 story/coverage.json
//
// 口径：
//   · 中文三态沿用生成器 tools/import-eote-story.mjs#chineseStatusOf（missing/untranslated/
//     present-needs-review）；`display`/`sections` 对非 present 回退 en，`sectionsEn` 恒为 en。
//   · 已知缺译按 chineseGaps 披露是既有口径，扫描把「缺译清单」与「回退 en 是否进入展示路径」
//     分开统计：前者进 coverage.json backlog，后者是 mixed-language findings 的机械证据。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'

const MOD = fileURLToPath(new URL('../../../../', import.meta.url)) // games/arkhamhorror/
const STORY_DIR = fileURLToPath(new URL('../story/', import.meta.url))
const CONTENT = 'content/campaigns/edgeOfTheEarth'
const SOURCE_STORY = join(MOD, CONTENT, 'story-text.js')
const MODULE_FILES = [
  'prologue.js', 'checkpoints.js', 'interludes.js', 'epilogue.js', 'flow.js',
  'records.js', 'keywords.js', 'parts.js', 'shared.js', 'shared-encounters.js',
].map(name => `${CONTENT}/${name}`)
const GENERATED_AT = '2026-11-09'
const CHAPTER_IDS = [
  'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage',
  'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
]

const CJK = /[\u3400-\u9fff]/
const CJK_ALL = /[\u3400-\u9fff]/g
// 与生成器同一判定：3+ 连续英文小写单词视为「整句英文未译」。
const ENGLISH_SENTENCE = /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i
const ICON_TOKEN = /\[[a-z][a-z0-9_]*\]/g
const PLACEHOLDER = /\{[A-Za-z_][A-Za-z0-9_]*\}/g
// web/card-text.js#SYMBOLS 已注册的合法 `[token]`；其余 `[...]` 会按字面量显示。
const KNOWN_SYMBOL_TOKENS = new Set((
  'action reaction free fast combat willpower intellect agility wild guardian seeker rogue mystic survivor neutral '
  + 'health sanity resource clue per_investigator investigator skull cultist tablet elder_thing elder_sign auto_fail '
  + 'bless curse frost blood seal_a seal_b seal_c seal_d seal_e day night codex'
).split(/\s+/))

// 简繁对照（无歧义：这些字在 zh-CN 语料里只可能来自繁体文本）。著 单独统计（简中「著」合法但
// 剧情「顺著/凝视著」是「着」的繁体转写）。
const TRADITIONAL = {
  於: '于', 與: '与', 裡: '里', 祕: '秘', 來: '来', 個: '个', 說: '说', 這: '这', 麼: '么',
  還: '还', 為: '为', 對: '对', 時: '时', 會: '会', 發: '发', 們: '们', 從: '从', 動: '动',
  過: '过', 進: '进', 開: '开', 關: '关', 實: '实', 學: '学', 覺: '觉', 種: '种', 樣: '样',
  讓: '让', 見: '见', 語: '语', 讀: '读', 寫: '写', 聽: '听', 問: '问', 間: '间', 長: '长',
  門: '门', 陽: '阳', 陰: '阴', 雙: '双', 邊: '边', 連: '连', 帶: '带', 當: '当', 應: '应',
  該: '该', 卻: '却', 並: '并', 沒: '没', 幾: '几', 頭: '头', 願: '愿', 體: '体', 點: '点',
  燈: '灯', 煙: '烟', 態: '态', 勢: '势', 龍: '龙', 鳳: '凤', 島: '岛', 灣: '湾', 華: '华',
  麗: '丽', 夢: '梦', 憶: '忆', 懼: '惧', 驚: '惊', 嚇: '吓', 厲: '厉', 慘: '惨', 嘆: '叹',
  嗎: '吗', 啟: '启', 喚: '唤', 戰: '战', 擊: '击', 殺: '杀', 誰: '谁', 藍: '蓝', 綠: '绿',
  紅: '红', 黃: '黄', 聖: '圣', 祕: '秘', 屍: '尸', 蓋: '盖', 牆: '墙', 憶: '忆', 鬥: '斗',
  鬍: '胡', 鬚: '须', 齒: '齿', 髮: '发', 淚: '泪', 膩: '腻', 髒: '脏', 癥: '症', 瘡: '疮',
}
const TRADITIONAL_CHARS = Object.keys(TRADITIONAL)

const sha256 = value => createHash('sha256').update(value).digest('hex')
const readText = path => readFileSync(path, 'utf8')
const readJsonish = path => readText(path)
const linesOf = text => text.split(/\r?\n/)
const hasCJK = value => CJK.test(String(value || ''))
const cjkCount = value => (String(value || '').match(CJK_ALL) || []).length

function flattenTree(tree, prefix = '', out = []) {
  if (typeof tree === 'string') { out.push({ path: prefix, value: tree }); return out }
  if (!tree || typeof tree !== 'object') return out
  for (const [key, child] of Object.entries(tree)) {
    flattenTree(child, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

function walkLeaves(value, prefix = '', out = []) {
  readLeaves(value, prefix, out)
  return out
}

function readLeaves(value, prefix, out) {
  if (typeof value === 'string') { out.push({ path: prefix, text: value }); return }
  if (Array.isArray(value)) { value.forEach((child, index) => readLeaves(child, `${prefix}.${index}`, out)); return }
  for (const [key, child] of Object.entries(value || {})) readLeaves(child, prefix ? `${prefix}.${key}` : key, out)
}

// ---------------------------------------------------------------------------
// 源文件行号定位（真实行号，禁止编造）：在 story-text.js 源码里搜索 JSON 转义后的文本片段。
// ---------------------------------------------------------------------------

function makeLineLocator(text) {
  const lines = linesOf(text)
  const chaptersStart = lines.findIndex(line => /^  "chapters": \{/.test(line))
  const localeKeysStart = lines.findIndex(line => /^  "localeKeys": \{/.test(line))
  const chapterRanges = {}
  if (chaptersStart >= 0) {
    let current = null
    for (let index = chaptersStart; index < lines.length; index++) {
      const match = /^    "([A-Za-z0-9]+)": \{$/.exec(lines[index])
      if (match && CHAPTER_IDS.includes(match[1])) {
        if (current) chapterRanges[current.id].end = index
        current = { id: match[1], start: index, end: Math.min(lines.length, localeKeysStart > 0 ? localeKeysStart : lines.length) }
        chapterRanges[current.id] = current
      }
    }
  }
  const lineOf = (fragment, keyHint = null, region = null) => {
    if (!fragment) return null
    const needle = JSON.stringify(String(fragment).slice(0, 48)).slice(1, -1)
    const hits = []
    for (let index = 0; index < lines.length; index++) {
      if (lines[index].includes(needle)) hits.push({ line: index + 1, index, text: lines[index] })
    }
    if (!hits.length) return null
    const keyed = hit => keyHint && hit.text.includes(`"${keyHint}":`)
    const inRegion = hit => !region || (hit.index >= region.start && hit.index < region.end)
    const candidates = hits.filter(inRegion)
    const matched = candidates.find(keyed) || hits.find(keyed) || candidates[0] || hits[0]
    return matched.line
  }
  return { lines, chapterRanges, localeKeysStart, lineOf }
}

function locateInFile(fileText, fragment) {
  if (!fragment) return null
  const needle = String(fragment).slice(0, 40)
  const lines = linesOf(fileText)
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].includes(needle)) return index + 1
  }
  return null
}

// ---------------------------------------------------------------------------
// 章节 sections 分析
// ---------------------------------------------------------------------------

function statusCountsOf(statuses) {
  const counts = { total: statuses.length, presentNeedsReview: 0, untranslated: 0, missing: 0 }
  for (const status of statuses) {
    if (status === 'present-needs-review') counts.presentNeedsReview++
    else if (status === 'untranslated') counts.untranslated++
    else counts.missing++
  }
  return counts
}

function analyzeChapters(text, locator) {
  const report = { chapters: [], gaps: [], checks: {} }
  for (const id of CHAPTER_IDS) {
    const chapter = text.chapters?.[id]
    if (!chapter) throw new Error(`story-text 缺少章节 ${id}`)
    const sections = flattenTree(chapter.sections || {})
    const sectionsEn = flattenTree(chapter.sectionsEn || {})
    const enByPath = new Map(sectionsEn.map(entry => [entry.path, entry.value]))
    const gaps = chapter.chineseGaps || {}
    const gapPaths = Object.keys(gaps)
    const leaves = sections.map(entry => ({
      path: entry.path,
      value: entry.value,
      en: enByPath.get(entry.path) ?? null,
      status: gaps[entry.path] || 'present-needs-review',
    }))
    const statuses = leaves.map(leaf => leaf.status)
    const computed = statusCountsOf(statuses)
    const declared = chapter.chinese || {}
    const metaByChapter = text.meta?.chinese?.byChapter?.[id] || {}
    const displayFallback = leaves.filter(leaf => leaf.status !== 'present-needs-review'
      && String(leaf.value) === String(leaf.en))
    const enMissing = leaves.filter(leaf => leaf.en == null)
    const enDiff = leaves.filter(leaf => leaf.status !== 'present-needs-review' && leaf.en != null
      && String(leaf.value) !== String(leaf.en))
    const layerOf = path => (path === 'heading' || path === 'investigatorSetup' || /^intro\d*$/.test(path)
      ? 'intro' : /^setup/.test(path) ? 'setup' : /^resolutions/.test(path) ? 'resolutions'
        : /^specialRules/.test(path) ? 'specialRules' : 'other')
    const gapRows = leaves.filter(leaf => leaf.status !== 'present-needs-review').map(leaf => {
      const display = String(leaf.value || '')
      return {
        chapter: id,
        path: leaf.path,
        status: leaf.status,
        layer: layerOf(leaf.path),
        displayLang: hasCJK(display) ? 'zh' : 'en',
        displaySample: display.slice(0, 120),
        enSample: String(leaf.en || '').slice(0, 120),
        line: locator.lineOf(display, leaf.path.split('.').at(-1), locator.chapterRanges[id]),
      }
    })
    // 缺译清单与 chineseGaps 一致性
    const consistency = {
      gapKeys: gapPaths.length,
      gapsInSections: gapPaths.filter(path => sections.some(entry => entry.path === path)).length,
      gapsMissingDeclared: gapPaths.filter(path => !(path in gaps)).length,
      countsMatchChinese: JSON.stringify(computed) === JSON.stringify({
        total: declared.total, presentNeedsReview: declared.presentNeedsReview,
        untranslated: declared.untranslated, missing: declared.missing,
      }),
      countsMatchMeta: JSON.stringify(computed) === JSON.stringify({
        total: metaByChapter.total, presentNeedsReview: metaByChapter.presentNeedsReview,
        untranslated: metaByChapter.untranslated, missing: metaByChapter.missing,
      }),
      displayFallbackCount: displayFallback.length,
      displayFallbackMismatch: enDiff.map(leaf => leaf.path),
      sectionsWithoutEn: enMissing.map(leaf => leaf.path),
      presentWithoutCJK: leaves.filter(leaf => leaf.status === 'present-needs-review' && !hasCJK(leaf.value))
        .map(leaf => leaf.path),
      presentWithEnglishSentence: leaves.filter(leaf => leaf.status === 'present-needs-review'
        && ENGLISH_SENTENCE.test(leaf.value)).map(leaf => leaf.path),
    }
    report.gaps.push(...gapRows)
    report.chapters.push({
      id,
      status: chapter.status,
      sectionCount: chapter.sectionCount,
      guideKeyCount: chapter.guideKeyCount,
      declared,
      computed,
      consistency,
      gapCount: gapRows.length,
      gapByLayer: gapRows.reduce((acc, row) => { acc[row.layer] = (acc[row.layer] || 0) + 1; return acc }, {}),
      gapByStatus: gapRows.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc }, {}),
      introFallback: gapRows.filter(row => row.layer === 'intro').map(row => row.path),
      setupFallback: gapRows.filter(row => row.layer === 'setup').map(row => row.path),
      resolutionFallback: gapRows.filter(row => row.layer === 'resolutions').map(row => row.path),
      source: chapter.sources,
    })
    report.checks[id] = { consistency }
  }
  return report
}

// ---------------------------------------------------------------------------
// 战役 campaign（localeKeys 逐路径）+ records 覆盖
// ---------------------------------------------------------------------------

function analyzeCampaign(text, locator) {
  const severityFor = status => status
  const groups = {}
  const groupStatus = (id, group) => {
    if (!group) return
    groups[id] = {
      id,
      kind: group.kind,
      status: group.status,
      chinese: group.chinese,
      sectionCount: group.sectionCount,
      entries: (group.entries || []).length,
      nonPresentEntries: (group.entries || []).filter(entry => entry.status !== 'present-needs-review')
        .map(entry => ({ key: entry.key, status: entry.status, sample: String(entry.body || entry.text || '').slice(0, 80) })),
    }
  }
  groupStatus('prologue', text.campaign?.prologue)
  groupStatus('partnerIntros', text.campaign?.partnerIntros)
  for (const [id, group] of Object.entries(text.campaign?.checkpoints || {})) groupStatus(`checkpoints.${id}`, group)
  for (const [id, group] of Object.entries(text.campaign?.interludes || {})) groupStatus(`interludes.${id}`, group)
  groupStatus('epilogue', text.campaign?.epilogue)
  groupStatus('specialRules', text.campaign?.specialRules)
  for (const [id, group] of Object.entries(text.campaign?.records || {})) groupStatus(`records.${id}`, group)
  for (const [id, group] of Object.entries(text.campaign?.other || {})) groupStatus(`other.${id}`, group)

  const keys = Object.entries(text.localeKeys || {}).map(([fullKey, entry]) => ({
    fullKey,
    path: fullKey.replace(/^edgeOfTheEarth\./, ''),
    status: entry.status,
    body: String(entry.body || ''),
  }))
  const gaps = keys.filter(entry => entry.status !== 'present-needs-review').map(entry => ({
    scope: 'campaign',
    path: entry.path,
    status: entry.status,
    displayLang: hasCJK(entry.body) ? 'zh' : 'en',
    displaySample: entry.body.slice(0, 120),
    line: locator.lineOf(entry.body, `edgeOfTheEarth.${entry.path}`,
      { start: locator.localeKeysStart >= 0 ? locator.localeKeysStart : 0, end: locator.lines.length }),
  }))
  const counts = statusCountsOf(keys.map(entry => entry.status))
  const metaChinese = text.meta?.chinese || {}
  const recordLabels = text.campaign?.records?.recordLabels
  const recordLabelRows = (recordLabels?.entries || []).map(entry => ({
    key: entry.key,
    status: entry.status,
    title: String(entry.title || '').slice(0, 60),
    body: String(entry.body || '').slice(0, 120),
  }))
  return {
    groups,
    localeKeys: { total: keys.length, counts, missing: gaps.filter(gap => gap.status === 'missing').length,
      untranslated: gaps.filter(gap => gap.status === 'untranslated').length },
    gaps,
    recordLabels: {
      groupStatus: recordLabels?.status,
      chinese: recordLabels?.chinese,
      entryCount: recordLabelRows.length,
      nonPresent: recordLabelRows.filter(row => row.status !== 'present-needs-review'),
      englishOrMixed: recordLabelRows.filter(row => CJK.test(row.body) === false
        || /[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(row.body)),
      withEnglishPrefix: recordLabelRows.filter(row => /\bCamp\b|\bShelter Value\b|\bExperience\b/.test(row.body)),
    },
    metaChinese,
  }
}

// ---------------------------------------------------------------------------
// 文本问题扫描（符号/混排/繁体/占位符）
// ---------------------------------------------------------------------------

const DUP_PUNCT = [
  ['。.', /。\./g], ['.。', /\.。/g], ['。。', /。。/g], ['，，', /，，/g], [',,', /,,/g],
  ['。，', /。，/g], ['，。', /，。/g], ['；；', /；；/g], ['：：', /：：/g], ['！！', /！！/g],
  ['？？', /？？/g], ['、、', /、、/g],
]

function symbolIssuesOf(value) {
  const text = String(value || '')
  const issues = []
  for (const [label, pattern] of DUP_PUNCT) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text))) {
      issues.push({ rule: `dup-punct:${label}`, index: match.index, context: text.slice(Math.max(0, match.index - 20), match.index + 20) })
    }
  }
  const tests = [
    ['halfwidth-comma-after-cjk', /[\u3400-\u9fff],[^0-9]/g],
    ['halfwidth-semicolon-after-cjk', /[\u3400-\u9fff];/g],
    ['halfwidth-colon-after-cjk', /[\u3400-\u9fff]:/g],
    ['halfwidth-question-after-cjk', /[\u3400-\u9fff]\?/g],
    ['halfwidth-exclaim-after-cjk', /[\u3400-\u9fff]!/g],
    ['halfwidth-period-after-cjk', /[\u3400-\u9fff]\./g],
    ['space-before-fullwidth-punct', / +[。，；：！？、]/g],
    ['fullwidth-space', /\u3000/g],
    ['double-space', / {2,}/g],
    ['brace-placeholder', PLACEHOLDER],
    ['icu-brace-residue', /\{'\{|\}'\}/g],
    ['english-label-prefix', /(?:^|\n)(?:Intro|Resolution|Setup|Proceed to|Campaign Log|Scenario|Do not)\b/g],
    ['camp-title-en', /\bCamp\b|\bShelter Value\b|\bExperience\b/g],
    ['html-tag', /<\/?[a-z][^>]*>/gi],
    ['markdown-mark', /(\*\*|__|`)/g],
    ['replacement-char', /\uFFFD/g],
    ['zero-width', /[\u200B\u200C\u200D\uFEFF]/g],
    ['bullet-double', /•{2,}/g],
    ['bullet-at-end', /•\s*$/g],
    ['bullet-before-punct', /•[。，；：！？.,;:]/g],
    ['quote-inner-space', /[“][ ]|[ ][”]/g],
    ['question-placeholder', /[?？]{3,}/g],
  ]
  for (const [rule, pattern] of tests) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text))) {
      if (match[0] === '' || (match.index === pattern.lastIndex && match[0] === '')) break
      issues.push({ rule, index: match.index, context: text.slice(Math.max(0, match.index - 20), match.index + 20) })
    }
  }
  if (text !== text.trim()) issues.push({ rule: 'outer-whitespace', index: 0, context: text.slice(0, 40) })
  const quoteCounts = {
    leftDouble: (text.match(/“/g) || []).length, rightDouble: (text.match(/”/g) || []).length,
    leftSingle: (text.match(/‘/g) || []).length, rightSingle: (text.match(/’/g) || []).length,
    straightDouble: (text.match(/"/g) || []).length,
  }
  if (quoteCounts.leftDouble !== quoteCounts.rightDouble) issues.push({ rule: 'quote-mismatch-double', index: -1, context: JSON.stringify(quoteCounts) })
  if (quoteCounts.leftSingle !== quoteCounts.rightSingle) issues.push({ rule: 'quote-mismatch-single', index: -1, context: JSON.stringify(quoteCounts) })
  return { issues, iconTokens: text.match(ICON_TOKEN) || [] }
}

function tokenDiffOf(zhValue, enValue) {
  const of = value => (String(value || '').match(ICON_TOKEN) || []).sort()
  const zhTokens = of(zhValue)
  const enTokens = of(enValue)
  if (zhTokens.join('|') === enTokens.join('|')) return null
  const count = list => list.reduce((acc, token) => { acc[token] = (acc[token] || 0) + 1; return acc }, {})
  return { zh: count(zhTokens), en: count(enTokens) }
}

function traditionalHitsOf(value, base) {
  const text = String(value || '')
  const hits = []
  for (const char of TRADITIONAL_CHARS) {
    let index = text.indexOf(char)
    while (index >= 0) {
      hits.push({ ...base, char, index, context: text.slice(Math.max(0, index - 12), index + 12) })
      index = text.indexOf(char, index + 1)
    }
  }
  if (text.includes('著')) {
    let index = text.indexOf('著')
    while (index >= 0) {
      hits.push({ ...base, char: '著(着?)', index, context: text.slice(Math.max(0, index - 12), index + 12) })
      index = text.indexOf('著', index + 1)
    }
  }
  return hits
}

function mixedIssuesOf(value, enValue, status) {
  const text = String(value || '')
  const issues = []
  if (status === 'present-needs-review') {
    if (!hasCJK(text)) issues.push({ rule: 'present-without-cjk' })
    if (ENGLISH_SENTENCE.test(text)) issues.push({ rule: 'english-sentence-in-zh' })
    const stripped = text.replace(ICON_TOKEN, '').replace(/\[[^\]]*\]/g, '')
    const words = (stripped.match(/\b[A-Za-z][A-Za-z'’-]{1,}/g) || [])
    const suspicious = words.filter(word => !/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XP|H\.P\.|MIA|A|B|C|D|E)$/.test(word))
    if (suspicious.length) issues.push({ rule: 'latin-residue', words: [...new Set(suspicious)].slice(0, 12) })
  } else {
    // 缺译叶子：记录「display 回退 en」自身，供展示链泄漏finding 统计。
    if (enValue != null && text === String(enValue)) issues.push({ rule: 'display-is-en-fallback' })
  }
  return issues
}

function numberTokensOf(value) {
  return (String(value || '').match(/\d+/g) || []).sort()
}

function negationOf(value) {
  return {
    en: /\b(not|never|no|cannot|can['’]t|don['’]t|doesn['’]t|isn['’]t|aren['’]t|won['’]t|without|none)\b/i.test(String(value || '')),
    zh: /[不没未无否別别勿]/.test(String(value || '')),
  }
}

// ---------------------------------------------------------------------------
// 战役模块字面量扫描（只报玩家可见中文/可疑英文，注释跳过）
// ---------------------------------------------------------------------------

function extractStringLiterals(fileText) {
  const lines = linesOf(fileText)
  const literals = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
    // 简单状态机：跳过行注释，提取 ' " ` 字符串（模板字符串只取静态片段）。
    let quote = null
    let start = -1
    for (let cursor = 0; cursor < line.length; cursor++) {
      const char = line[cursor]
      if (quote) {
        if (char === '\\') { cursor++; continue }
        if (char === quote) {
          const value = line.slice(start + 1, cursor)
          if (value.trim()) literals.push({ line: index + 1, value })
          quote = null
        }
        continue
      }
      if (char === '/' && line[cursor + 1] === '/') break
      if (char === "'" || char === '"' || char === '`') { quote = char; start = cursor }
    }
  }
  return literals
}

const LABEL_CONTEXT = /(label|title|name|prompt|text|heading|log|note|body|desc|message|caption|hint)\s*:/i

function analyzeModules(moduleTexts) {
  const report = { files: [], candidates: { mixed: [], symbols: [], traditional: [], englishVisible: [] } }
  for (const [file, fileText] of Object.entries(moduleTexts)) {
    const literals = extractStringLiterals(fileText)
    const cjkLiterals = literals.filter(literal => CJK.test(literal.value))
    report.files.push({ file, literals: literals.length, cjkLiterals: cjkLiterals.length })
    for (const literal of literals) {
      const base = { file, line: literal.line, value: literal.value.slice(0, 160) }
      if (CJK.test(literal.value)) {
        const { issues } = symbolIssuesOf(literal.value)
        for (const issue of issues) report.candidates.symbols.push({ ...base, rule: issue.rule, context: issue.context })
        report.candidates.traditional.push(...traditionalHitsOf(literal.value, base))
        if (ENGLISH_SENTENCE.test(literal.value)) report.candidates.mixed.push({ ...base, rule: 'english-sentence' })
        const latin = literal.value.replace(/\[[^\]]*\]/g, '').match(/\b[A-Za-z][A-Za-z'’-]{2,}\b/g) || []
        if (latin.length) report.candidates.mixed.push({ ...base, rule: 'latin-residue', words: [...new Set(latin)].slice(0, 12) })
      } else if (LABEL_CONTEXT.test(linesOf(fileText)[literal.line - 1])
        && /^[A-Za-z][A-Za-z0-9 '’.,!?…—:;()（）-]{2,}$/.test(literal.value.trim())
        && !/^(true|false|null|undefined)$/.test(literal.value.trim())) {
        report.candidates.englishVisible.push(base)
      }
    }
  }
  return report
}

// ---------------------------------------------------------------------------
// 战役模块语义覆盖：flow 节点英文泄漏 + records 标签英文回退 + keywords 名称
// ---------------------------------------------------------------------------

async function importContent(path) {
  return import(pathToFileURL(join(MOD, path)).href)
}

async function analyzeFlowAndRecords(text, moduleTexts = {}) {
  const result = { flow: null, recordLabels: null, keywords: null, errors: [] }
  const keys = text.localeKeys || {}
  const statusOf = fullKey => keys[fullKey]?.status || null
  // 模块里 `text('key', '中文兜底')`/`heading('key', '中文兜底')` 的兜底表：flow 节点正文被
  // storyBody 的 en 回退覆盖后，用它证明「本可显示中文兜底却被英文覆盖」。
  const fallbackMap = new Map()
  for (const fileText of Object.values(moduleTexts)) {
    const pattern = /\b(?:text|heading)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g
    let match
    while ((match = pattern.exec(fileText))) fallbackMap.set(match[1], match[2])
  }

  try {
    const flow = await importContent(`${CONTENT}/flow.js`)
    const nodes = flow.EOTE_FLOW.nodes
    const leaks = []
    const nodeStatuses = []
    let textKeyCount = 0
    // 模块里 text('key', '中文兜底')/heading('key', '中文兜底') 的调用点：storyBody 命中非 present 时
    // 返回 en 回退并覆盖兜底，中文 UI 会显示英文（模块级调用，构建 node 时已固定）。
    const moduleTextRefs = []
    for (const [file, fileText] of Object.entries(moduleTexts)) {
      linesOf(fileText).forEach((line, index) => {
        const pattern = /(heading|text)\(\s*'([^']+)'/g
        let match
        while ((match = pattern.exec(line))) {
          moduleTextRefs.push({ file, line: index + 1, fn: match[1], key: match[2] })
        }
      })
    }
    const statusForRef = ref => statusOf(`edgeOfTheEarth.${ref.key}.body`) || statusOf(`edgeOfTheEarth.${ref.key}.title`)
      || statusOf(`edgeOfTheEarth.${ref.key}`)
    const englishOverrides = moduleTextRefs
      .map(ref => ({ ...ref, status: statusForRef(ref) }))
      .filter(ref => ref.status && ref.status !== 'present-needs-review')
    const englishFields = { text: [], title: [], optionLabel: [] }
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (node.textKey) {
        textKeyCount++
        const bodyStatus = statusOf(`edgeOfTheEarth.${node.textKey}.body`)
        const titleStatus = statusOf(`edgeOfTheEarth.${node.textKey}.title`)
        const display = String(node.text || '')
        nodeStatuses.push({ nodeId, type: node.type, textKey: node.textKey, bodyStatus, titleStatus,
          displayHasCJK: hasCJK(display), fallback: String(fallbackMap.get(node.textKey) || '').slice(0, 120) })
        // 生成物有 en 正文时 storyBody 恒返回非空串，会覆盖模块内中文兜底 → 中文 UI 显示英文正文。
        if (bodyStatus && bodyStatus !== 'present-needs-review' && display.trim() && !hasCJK(display)) {
          leaks.push({ nodeId, field: 'text', textKey: node.textKey, status: bodyStatus,
            displaySample: display.slice(0, 140), fallbackSample: String(fallbackMap.get(node.textKey) || '').slice(0, 140) })
        }
        if (titleStatus && titleStatus !== 'present-needs-review' && node.title && !hasCJK(String(node.title))) {
          leaks.push({ nodeId, field: 'title', textKey: node.textKey, status: titleStatus,
            displaySample: String(node.title).slice(0, 140), fallbackSample: '' })
        }
        if (display.trim() && !hasCJK(display) && /[A-Za-z]{2,}/.test(display)) {
          englishFields.text.push({ nodeId, field: 'text', value: display.slice(0, 140) })
        }
      }
      if (node.title && !hasCJK(String(node.title)) && /[A-Za-z]{2,}/.test(String(node.title))) {
        englishFields.title.push({ nodeId, field: 'title', value: String(node.title).slice(0, 140) })
      }
      for (const [optionIndex, option] of (node.options || []).entries()) {
        const label = String(option?.label || '')
        if (label.trim() && !hasCJK(label) && /[A-Za-z]{2,}/.test(label)) {
          englishFields.optionLabel.push({ nodeId, field: `options[${optionIndex}].label`, value: label.slice(0, 140) })
        }
      }
    }
    result.flow = { start: flow.EOTE_FLOW.start, nodeCount: Object.keys(nodes).length, textKeyCount,
      leaks, nodeStatuses, moduleTextRefs: moduleTextRefs.length, englishOverrides, englishFields }
  } catch (error) {
    result.errors.push(`flow.js: ${error.message}`)
  }

  try {
    const records = await importContent(`${CONTENT}/records.js`)
    const labels = records.recordLabels()
    const schema = Object.keys(records.recordSchema || {})
    const keyFallbacks = []
    for (const key of schema) {
      if (labels[key] === key) keyFallbacks.push(key)
    }
    const sample = Object.entries(labels).slice(0, 5).map(([key, value]) => ({ key, value }))
    result.recordLabels = { schemaSize: schema.length, labelCount: Object.keys(labels).length,
      keyFallbacks, sample }
  } catch (error) {
    result.errors.push(`records.js: ${error.message}`)
  }

  try {
    const keywords = await importContent(`${CONTENT}/keywords.js`)
    result.keywords = keywords.EOTE_KEYWORDS.map(keyword => ({ id: keyword.id, zh: keyword.zh, kind: keyword.kind }))
  } catch (error) {
    result.errors.push(`keywords.js: ${error.message}`)
  }
  return result
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

function analyzeStoryText(sourceText, text) {
  const locator = makeLineLocator(sourceText)
  const chapters = analyzeChapters(text, locator)
  const campaign = analyzeCampaign(text, locator)

  const present = []
  const fallback = []
  for (const id of CHAPTER_IDS) {
    for (const leaf of flattenTree(text.chapters[id].sections || {})) {
      const status = text.chapters[id].chineseGaps?.[leaf.path] || 'present-needs-review'
      const en = flattenTree(text.chapters[id].sectionsEn || {}).find(entry => entry.path === leaf.path)?.value
      present.push({ scope: id, path: leaf.path, value: leaf.value, en, status })
    }
  }
  for (const [fullKey, entry] of Object.entries(text.localeKeys || {})) {
    present.push({ scope: 'campaign', path: fullKey.replace(/^edgeOfTheEarth\./, ''), value: entry.body,
      en: null, status: entry.status })
  }

  const symbolCandidates = []
  const tokenDiffs = []
  const traditionalHits = []
  const mixedCandidates = []
  const latinResidue = new Map()
  const lineCache = new Map()
  const lineOfRow = row => {
    const cacheKey = `${row.scope}|${row.path}`
    if (!lineCache.has(cacheKey)) {
      const isCampaign = row.scope === 'campaign'
      lineCache.set(cacheKey, locator.lineOf(
        String(row.value || ''),
        isCampaign ? `edgeOfTheEarth.${row.path}` : row.path.split('.').at(-1),
        isCampaign
          ? { start: locator.localeKeysStart >= 0 ? locator.localeKeysStart : 0, end: locator.lines.length }
          : locator.chapterRanges[row.scope],
      ))
    }
    return lineCache.get(cacheKey)
  }
  for (const row of present) {
    const chinesePresent = row.status === 'present-needs-review' && hasCJK(row.value)
    const line = chinesePresent ? lineOfRow(row) : null
    // 符号/繁体/图标只在「中文 present」上判定：missing/untranslated 的 display 本就是 en 回退，
    // 对英文串报中文标点问题没有意义（回退本身另由 display-is-en-fallback 统计）。
    if (chinesePresent) {
      const { issues } = symbolIssuesOf(row.value)
      for (const issue of issues) {
        symbolCandidates.push({ scope: row.scope, path: row.path, status: row.status, line, ...issue })
      }
      if (row.en != null) {
        const diff = tokenDiffOf(row.value, row.en)
        if (diff) tokenDiffs.push({ scope: row.scope, path: row.path, diff, line })
      }
      for (const match of String(row.value).matchAll(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g)) {
        if (!KNOWN_SYMBOL_TOKENS.has(match[1].toLowerCase())) {
          symbolCandidates.push({ scope: row.scope, path: row.path, status: row.status, line,
            rule: 'unknown-bracket-token', index: match.index, token: match[0],
            context: String(row.value).slice(Math.max(0, match.index - 20), match.index + 40) })
        }
      }
      traditionalHits.push(...traditionalHitsOf(row.value, { scope: row.scope, path: row.path, line }))
      const stripped = String(row.value).replace(ICON_TOKEN, '')
      for (const word of stripped.match(/\b[A-Za-z][A-Za-z'’-]{1,}\b/g) || []) {
        if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XP|H\.P\.|MIA|A|B|C|D|E)$/.test(word)) continue
        const bucket = latinResidue.get(word) || { word, count: 0, samples: [] }
        bucket.count++
        if (bucket.samples.length < 4) bucket.samples.push({ scope: row.scope, path: row.path, line,
          value: String(row.value).slice(0, 100) })
        latinResidue.set(word, bucket)
      }
    }
    const mixed = mixedIssuesOf(row.value, row.en, row.status)
    for (const issue of mixed) mixedCandidates.push({ scope: row.scope, path: row.path, status: row.status, line, ...issue })
  }

  // 误译候选：数字多重集不一致 / 同父键中文相同但英文不同 / 否定词缺失 / 难度词不匹配。
  const numberMismatch = []
  const duplicateZh = []
  const negationMismatch = []
  const difficultyTerm = []
  const DIFFICULTY = [['expert', '专家'], ['hard', '困难'], ['standard', '标准'], ['easy', '简单']]
  const STOPWORDS = new Set(('the a an and or of to in on at for from with by as is are was were be been being '
    + 'you your yours it its this that these those if then when while each other any all not no can cannot '
    + 'may must should would could do does did have has had will shall one two per').split(/\s+/))
  const wordSetOf = value => new Set((String(value).toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [])
    .filter(word => word.length > 2 && !STOPWORDS.has(word)))
  const wordDiffOf = (a, b) => {
    const left = wordSetOf(a)
    const right = wordSetOf(b)
    return { onlyLeft: [...left].filter(word => !right.has(word)), onlyRight: [...right].filter(word => !left.has(word)) }
  }
  // 「中文只差数字/标点、英文差一个关键词」= 英文条件差异未落到中文（hard/expert 型误译）候选。
  const normalizeZhForDiff = value => String(value)
    .replace(/\d+/g, '#')
    .replace(/[。，、；：！？.,;:!?“”‘’"'（）()\[\]\-—…~～\s]/g, '')
  for (const id of CHAPTER_IDS) {
    const chapter = text.chapters[id]
    const sections = flattenTree(chapter.sections || {})
    const enTree = flattenTree(chapter.sectionsEn || {})
    const enMap = new Map(enTree.map(entry => [entry.path, entry.value]))
    const parentGroups = new Map()
    for (const leaf of sections) {
      const status = chapter.chineseGaps?.[leaf.path] || 'present-needs-review'
      if (status !== 'present-needs-review') continue
      const en = enMap.get(leaf.path)
      if (en == null) continue
      const numbers = { en: numberTokensOf(en), zh: numberTokensOf(leaf.value) }
      if (numbers.en.join(',') !== numbers.zh.join(',')) {
        numberMismatch.push({ scope: id, path: leaf.path, en, zh: leaf.value, numbers })
      }
      const negationEn = negationOf(en).en
      const negationZh = negationOf(leaf.value).zh
      if (negationEn !== negationZh) negationMismatch.push({ scope: id, path: leaf.path, en, zh: leaf.value, negationEn, negationZh })
      for (const [enTerm, zhTerm] of DIFFICULTY) {
        const enText = String(en)
        if (new RegExp(`\\b${enTerm}\\b`, 'i').test(enText) && !String(leaf.value).includes(zhTerm)) {
          difficultyTerm.push({ scope: id, path: leaf.path, en, zh: leaf.value, term: enTerm, expected: zhTerm })
        }
      }
      const parent = leaf.path.split('.').slice(0, -1).join('.') || '(root)'
      const normalized = String(leaf.value).replace(/\s+/g, '').replace(/[。，、；：！？.,;:!?]/g, '')
      const bucket = parentGroups.get(parent) || new Map()
      const rows = bucket.get(normalized) || []
      rows.push({ path: leaf.path, en, zh: String(leaf.value) })
      bucket.set(normalized, rows)
      parentGroups.set(parent, bucket)
    }
    const seenPairs = new Set()
    for (const [parent, bucket] of parentGroups) {
      const siblingRows = [...bucket.values()].flat()
      for (let left = 0; left < siblingRows.length; left++) {
        for (let right = left + 1; right < siblingRows.length; right++) {
          const a = siblingRows[left]
          const b = siblingRows[right]
          if (a.en === b.en) continue
          const wordDiff = wordDiffOf(a.en, b.en)
          const sig = `${parent}|${a.path}|${b.path}`
          if (seenPairs.has(sig)) continue
          const zhSame = normalizeZhForDiff(a.zh) === normalizeZhForDiff(b.zh)
          const zhExactlySame = a.zh === b.zh
          if (!zhSame) continue
          // 中文相同（至多数字不同）但英文关键词不同：条件/难度/数字语义未落到中文的强候选。
          if (wordDiff.onlyLeft.length || wordDiff.onlyRight.length) {
            seenPairs.add(sig)
            duplicateZh.push({ scope: id, parent, type: 'zh-same-en-term-diff',
              paths: [a.path, b.path], zh: [a.zh, b.zh], en: [a.en, b.en], wordDiff })
          } else if (zhExactlySame) {
            seenPairs.add(sig)
            duplicateZh.push({ scope: id, parent, type: 'zh-identical', paths: [a.path, b.path], zh: [a.zh, b.zh], en: [a.en, b.en] })
          }
        }
      }
    }
  }

  // 章节 intro/setup/resolutions 的英文回退统计（展示链证据）。
  const introFallback = []
  for (const chapter of chapters.chapters) {
    for (const path of chapter.introFallback) introFallback.push({ chapter: chapter.id, path, layer: 'intro' })
  }
  const setupFallback = chapters.chapters.flatMap(chapter => chapter.setupFallback.map(path => ({ chapter: chapter.id, path, layer: 'setup' })))
  const resolutionFallback = chapters.chapters.flatMap(chapter => chapter.resolutionFallback.map(path => ({ chapter: chapter.id, path, layer: 'resolutions' })))

  return {
    chapters, campaign, symbolCandidates, tokenDiffs, traditionalHits, mixedCandidates,
    latinResidue: [...latinResidue.values()].sort((a, b) => b.count - a.count),
    mistranslation: { numberMismatch, duplicateZh, negationMismatch, difficultyTerm },
    displayFallback: { introFallback, setupFallback, resolutionFallback },
    meta: text.meta,
  }
}

function countBy(list, selector) {
  return list.reduce((acc, item) => {
    const key = selector(item)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

async function main() {
  const sourceText = readText(SOURCE_STORY)
  const story = await import(pathToFileURL(SOURCE_STORY).href)
  const text = story.EOTE_STORY_TEXT
  const analysis = analyzeStoryText(sourceText, text)
  const moduleTexts = Object.fromEntries(MODULE_FILES.map(file => [file, readText(join(MOD, file))]))
  const modules = analyzeModules(moduleTexts)
  const flowRecords = await analyzeFlowAndRecords(text, moduleTexts)

  const chapterGapTotal = analysis.chapters.gaps.length
  const chapterGapByStatus = countBy(analysis.chapters.gaps, gap => gap.status)
  const campaignGaps = analysis.campaign.gaps
  const summary = {
    generatedAt: GENERATED_AT,
    auditor: 'story-audit',
    area: 'story',
    method: '只读扫描 story-text.js + 战役模块字面量 + 展示链消费点（story-access/records/flow）；node 直接运行，不 spawn 子进程',
    input: {
      storyText: { path: `${CONTENT}/story-text.js`, bytes: Buffer.byteLength(sourceText),
        sha256: sha256(sourceText), lines: linesOf(sourceText).length },
      modules: Object.fromEntries(Object.entries(modules.files).map(([file, info]) => [file, info])),
      moduleList: MODULE_FILES,
    },
    scope: {
      chapters: CHAPTER_IDS.length,
      chapterSections: analysis.meta.chapterSections,
      chapterGaps: chapterGapTotal,
      chapterGapsByStatus: chapterGapByStatus,
      campaignLocaleKeys: analysis.campaign.localeKeys.total,
      campaignGaps: campaignGaps.length,
      campaignGapsByStatus: countBy(campaignGaps, gap => gap.status),
    },
    consistency: {
      metaChinese: analysis.meta.chinese,
      computedChapterCounts: countBy(analysis.chapters.chapters, chapter => chapter.status),
      chapterConsistency: Object.fromEntries(analysis.chapters.chapters.map(chapter => [chapter.id, chapter.consistency])),
      campaignMetaDeclared: analysis.campaign.metaChinese,
      campaignComputed: analysis.campaign.localeKeys.counts,
      checks: {
        chapterGapsEqualsMetaMissingPlusUntranslated:
          JSON.stringify(chapterGapByStatus) === JSON.stringify({
            missing: analysis.meta.chinese?.missing, untranslated: analysis.meta.chinese?.untranslated,
          }),
        campaignGapsEqualsExpected68: campaignGaps.length === 68,
        allChapterGapsHaveDisplayFallback: analysis.chapters.chapters.every(chapter => chapter.consistency.displayFallbackCount === chapter.gapCount),
        allCampaignGapsDisplayEn: campaignGaps.every(gap => gap.displayLang === 'en'),
        flowLeaks: flowRecords.flow?.leaks?.length ?? null,
        recordLabelKeyFallbacks: flowRecords.recordLabels?.keyFallbacks?.length ?? null,
      },
    },
    coverage: {
      chapterGaps: analysis.chapters.gaps,
      campaignGaps,
      campaignGroups: analysis.campaign.groups,
      records: {
        localeKeysTotal: analysis.campaign.localeKeys.total,
        recordLabelsGroup: analysis.campaign.recordLabels,
        recordLabelFallbackKeys: flowRecords.recordLabels?.keyFallbacks || [],
      },
      expected: {
        chapters: { total: 469, missing: 199, untranslated: 10, presentNeedsReview: 260 },
        campaign: { gaps: 68 },
      },
    },
    displayChain: {
      chapterIntroFallback: analysis.displayFallback.introFallback,
      chapterSetupFallback: analysis.displayFallback.setupFallback,
      chapterResolutionFallback: analysis.displayFallback.resolutionFallback,
      flowLeak: flowRecords.flow ? {
        start: flowRecords.flow.start,
        nodeCount: flowRecords.flow.nodeCount,
        textKeyCount: flowRecords.flow.textKeyCount,
        leaks: flowRecords.flow.leaks,
        englishFields: flowRecords.flow.englishFields,
        englishOverrides: flowRecords.flow.englishOverrides,
      } : null,
      recordLabelKeyFallbacks: flowRecords.recordLabels?.keyFallbacks || [],
      errors: flowRecords.errors,
    },
    checks: {
      mixed: {
        total: analysis.mixedCandidates.length,
        byRule: countBy(analysis.mixedCandidates, item => item.rule),
        samples: analysis.mixedCandidates.slice(0, 20),
        latinResidue: analysis.latinResidue,
      },
      symbols: {
        total: analysis.symbolCandidates.length,
        byRule: countBy(analysis.symbolCandidates, item => item.rule),
        byRuleFields: countBy(
          [...new Set(analysis.symbolCandidates.map(item => `${item.rule}|${item.scope}|${item.path}`))]
            .map(key => ({ rule: key.split('|')[0] })),
          item => item.rule),
        samples: analysis.symbolCandidates.slice(0, 60),
      },
      tokenDiffs: analysis.tokenDiffs,
      traditional: {
        total: analysis.traditionalHits.length,
        byChar: countBy(analysis.traditionalHits, item => item.char),
        byScope: countBy(analysis.traditionalHits, item => item.scope),
        samples: analysis.traditionalHits.slice(0, 30),
      },
      mistranslation: analysis.mistranslation,
      modules,
      keywords: flowRecords.keywords,
    },
  }

  if (process.argv.includes('--write')) {
    const tuplesOf = gaps => ({
      missing: gaps.filter(gap => gap.status === 'missing').map(gap => [gap.path, gap.line]),
      untranslated: gaps.filter(gap => gap.status === 'untranslated').map(gap => [gap.path, gap.line]),
    })
    const byChapterFallback = (rows, chapterIds) => Object.fromEntries(chapterIds
      .map(id => [id, rows.filter(row => row.chapter === id).length])
      .filter(([, count]) => count > 0))
    const coverage = {
      area: 'story',
      auditor: 'story-audit',
      generatedAt: GENERATED_AT,
      source: { path: `${CONTENT}/story-text.js`, sha256: sha256(sourceText),
        bytes: Buffer.byteLength(sourceText), lines: linesOf(sourceText).length },
      scope: summary.scope,
      expectedMatches: {
        chapterTotal469: analysis.meta.chapterSections === 469,
        chapterMissing199: analysis.meta.chinese?.missing === 199,
        chapterUntranslated10: analysis.meta.chinese?.untranslated === 10,
        campaignMissing68: campaignGaps.filter(gap => gap.status === 'missing').length === 68,
        campaignUntranslated1: campaignGaps.filter(gap => gap.status === 'untranslated').length === 1,
      },
      checks: summary.consistency.checks,
      textIssues: {
        mixedByRule: summary.checks.mixed.byRule,
        latinResidueTop: summary.checks.mixed.latinResidue.slice(0, 15).map(item => ({ word: item.word, count: item.count })),
        symbolsByRule: summary.checks.symbols.byRule,
        symbolsByRuleFields: summary.checks.symbols.byRuleFields,
        tokenDiffs: summary.checks.tokenDiffs.length,
        traditionalTotal: summary.checks.traditional.total,
        traditionalByScope: countBy(analysis.traditionalHits, item => item.scope),
        traditionalByChar: summary.checks.traditional.byChar,
        mistranslationCandidates: Object.fromEntries(Object.entries(analysis.mistranslation)
          .map(([key, list]) => [key, list.length])),
      },
      chapters: analysis.chapters.chapters.map(chapter => ({
        id: chapter.id,
        status: chapter.status,
        sectionCount: chapter.sectionCount,
        declared: chapter.declared,
        gapCount: chapter.gapCount,
        gapByStatus: chapter.gapByStatus,
        gapByLayer: chapter.gapByLayer,
        introFallback: chapter.introFallback,
        setupFallback: chapter.setupFallback,
        resolutionFallback: chapter.resolutionFallback,
        gaps: tuplesOf(analysis.chapters.gaps.filter(gap => gap.chapter === chapter.id)),
      })),
      campaign: {
        localeKeys: summary.scope.campaignLocaleKeys,
        counts: analysis.campaign.localeKeys.counts,
        groups: analysis.campaign.groups,
        gaps: tuplesOf(campaignGaps),
        recordLabels: {
          chinese: analysis.campaign.recordLabels.chinese,
          entryCount: analysis.campaign.recordLabels.entryCount,
          nonPresent: analysis.campaign.recordLabels.nonPresent.map(row => [row.key, row.status]),
          keyFallbacks: flowRecords.recordLabels?.keyFallbacks || [],
          englishPrefixCount: analysis.campaign.recordLabels.withEnglishPrefix?.length || 0,
        },
      },
      displayChain: {
        chapterIntroFallbackByChapter: byChapterFallback(analysis.displayFallback.introFallback, CHAPTER_IDS),
        chapterSetupFallbackByChapter: byChapterFallback(analysis.displayFallback.setupFallback, CHAPTER_IDS),
        chapterResolutionFallbackByChapter: byChapterFallback(analysis.displayFallback.resolutionFallback, CHAPTER_IDS),
        chapterIntroFallbackTotal: analysis.displayFallback.introFallback.length,
        chapterSetupFallbackTotal: analysis.displayFallback.setupFallback.length,
        chapterResolutionFallbackTotal: analysis.displayFallback.resolutionFallback.length,
        flowLeaks: flowRecords.flow?.leaks || [],
        flowNodeCount: flowRecords.flow?.nodeCount ?? null,
        flowEnglishFields: flowRecords.flow ? {
          textCount: flowRecords.flow.englishFields.text.length,
          titleCount: flowRecords.flow.englishFields.title.length,
          optionLabelCount: flowRecords.flow.englishFields.optionLabel.length,
          samples: [...flowRecords.flow.englishFields.text.slice(0, 5), ...flowRecords.flow.englishFields.title.slice(0, 5),
            ...flowRecords.flow.englishFields.optionLabel.slice(0, 20)],
        } : null,
        flowEnglishOverrideKeys: flowRecords.flow?.englishOverrides || [],
        recordLabelKeyFallbacks: flowRecords.recordLabels?.keyFallbacks || [],
        note: '缺译本身按 chineseGaps 披露（既有口径）；但上述回退 en 的叶子会被 story-access#chapterSection（sections）→ 章节 texts.js/definition.js→SCENARIO_TEXT.intro/setup、records.js#storyBody→flow 节点正文、src/campaign/story.js#introduction→故事日志 直接当正文展示，且 web/story-reader.js 逐段直排、无「中文待补」标记。',
      },
      note: 'backlog 路径均可在 story-text.js 的 chapters.<id>.sections 或 localeKeys 里按路径定位；line 为源码真实行号（脚本搜索 JSON 转义片段得出）。缺译清单是补译 backlog；displayChain 才是 findings 依据。',
    }
    const target = join(STORY_DIR, 'coverage.json')
    let written = target
    mkdirSync(STORY_DIR, { recursive: true })
    try {
      writeFileSync(target, `${JSON.stringify(coverage, null, 2)}\n`)
    } catch (error) {
      // 某些受限沙箱只允许进程写 workspace 根/临时目录（本机沙箱实测 docs/** EPERM）：
      // 回退写 workspace 根 staging（或 TEMP），不改 coverage 内容，便于用 write 工具/宿主 shell 落盘。
      const workspaceRoot = fileURLToPath(new URL('../../../../../../', import.meta.url))
      const stagingDir = join(workspaceRoot, '.eote-story-staging')
      let fallback
      try {
        mkdirSync(stagingDir, { recursive: true })
        fallback = join(stagingDir, 'coverage.json')
        writeFileSync(fallback, `${JSON.stringify(coverage, null, 2)}\n`)
      } catch {
        fallback = join(process.env.TEMP || process.env.TMP || '.', 'eote-story-coverage.json')
        writeFileSync(fallback, `${JSON.stringify(coverage, null, 2)}\n`)
      }
      written = fallback
      console.error(`[story-scan] 无法写 ${target}（${error.code || error.message}），已回退写 ${fallback}；请把该文件拷到 ${target}`)
    }
    console.log(JSON.stringify({ written, scope: summary.scope, expectedMatches: coverage.expectedMatches }, null, 2))
    if (process.argv.includes('--detail')) {
      // 供审计复核的全量明细（不进入交付目录；默认写临时目录）。
      const detail = {
        ...summary,
        detail: {
          campaignGaps,
          flowNodeStatuses: flowRecords.flow?.nodeStatuses || [],
          symbolCandidates: analysis.symbolCandidates,
          traditionalHits: analysis.traditionalHits,
          mixedCandidates: analysis.mixedCandidates,
          mistranslation: analysis.mistranslation,
          moduleCandidates: modules.candidates,
          keywords: flowRecords.keywords,
          recordLabels: flowRecords.recordLabels,
        },
      }
      const detailPath = join(process.env.TEMP || process.env.TMP || '.', 'eote-story-detail.json')
      writeFileSync(detailPath, `${JSON.stringify(detail, null, 2)}\n`)
      console.error(`[story-scan] detail: ${detailPath}`)
    }
    if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2))
    return
  }

  if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2))
  else console.log(JSON.stringify({
    scope: summary.scope,
    consistency: summary.consistency,
    displayChain: {
      chapterIntroFallback: summary.displayChain.chapterIntroFallback.length,
      chapterSetupFallback: summary.displayChain.chapterSetupFallback.length,
      chapterResolutionFallback: summary.displayChain.chapterResolutionFallback.length,
      flowLeaks: summary.displayChain.flowLeak?.leaks?.length ?? null,
      flowEnglishFields: summary.displayChain.flowLeak?.englishFields
        ? { text: summary.displayChain.flowLeak.englishFields.text.length,
          title: summary.displayChain.flowLeak.englishFields.title.length,
          optionLabel: summary.displayChain.flowLeak.englishFields.optionLabel.length }
        : null,
      flowEnglishOverrideKeys: summary.displayChain.flowLeak?.englishOverrides?.length ?? null,
      flowErrors: summary.displayChain.errors,
      recordLabelFallbackKeys: summary.displayChain.recordLabelKeyFallbacks.length,
    },
    checks: {
      mixed: summary.checks.mixed.byRule,
      symbols: summary.checks.symbols.byRule,
      tokenDiffs: summary.checks.tokenDiffs.length,
      traditional: summary.checks.traditional.byChar,
      mistranslation: Object.fromEntries(Object.entries(summary.checks.mistranslation).map(([key, list]) => [key, list.length])),
    },
  }, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 })

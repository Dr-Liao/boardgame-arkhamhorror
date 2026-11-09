#!/usr/bin/env node
// 全战役剧情/引导/关卡设置中文审计 —— 共享提取与检测工具（只读，不修改游戏数据）。
//
// 口径：本文件只做「机械候选」生成；最终 findings 由人工复核写入 docs/translate/。
// 用法：被 scan-story.mjs / scan-guides.mjs / scan-setup.mjs 导入。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TOOLS_DIR = dirname(fileURLToPath(import.meta.url))
export const MOD = resolve(TOOLS_DIR, '../../..') // games/arkhamhorror/
export const CAMPAIGN_IDS = Object.freeze([
  'nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge',
  'theCircleUndone', 'theDreamEaters', 'theInnsmouthConspiracy', 'edgeOfTheEarth',
])
export const CAMPAIGN_NAMES = Object.freeze({
  nightOfTheZealot: '夜之狂热', theDunwichLegacy: '敦威治遗产', thePathToCarcosa: '卡尔克萨之路',
  theForgottenAge: '失落的时代', theCircleUndone: '万象无终', theDreamEaters: '食梦者',
  theInnsmouthConspiracy: '印斯茅斯暗潮', edgeOfTheEarth: '地球边缘',
})
export const CAMPAIGN_CODES = Object.freeze({
  nightOfTheZealot: '01', theDunwichLegacy: '02', thePathToCarcosa: '03', theForgottenAge: '04',
  theCircleUndone: '05', theDreamEaters: '06', theInnsmouthConspiracy: '07', edgeOfTheEarth: '08',
})

// ---------------------------------------------------------------------------
// 基础
// ---------------------------------------------------------------------------
export const CJK = /[\u3400-\u9fff]/
export const CJK_ALL = /[\u3400-\u9fff]/g
export const cjkCount = value => (String(value ?? '').match(CJK_ALL) || []).length
export const hasCJK = value => CJK.test(String(value ?? ''))
export const sha256 = value => {
  // 只为去重使用稳定指纹；避免引入 crypto 依赖差异（node:crypto 稳定）。
  let hash = 2166136261
  const text = String(value ?? '')
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function walkFiles(root, filter = () => true, out = []) {
  for (const name of readdirSync(root).sort()) {
    const full = join(root, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walkFiles(full, filter, out)
    else if (filter(full)) out.push(full)
  }
  return out
}

export function makeLineIndex(fileText) {
  const starts = [0]
  for (let index = 0; index < fileText.length; index++) if (fileText[index] === '\n') starts.push(index + 1)
  return offset => {
    let low = 0, high = starts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (starts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return low + 1
  }
}

const lineIndexCache = new Map()
function lineIndexOf(path) {
  if (!lineIndexCache.has(path)) lineIndexCache.set(path, makeLineIndex(readFileSync(path, 'utf8')))
  return lineIndexCache.get(path)
}

/**
 * 在源码文件里定位一段文本的真实行号。
 * 依次尝试：原文片段、JSON 转义片段（生成物）、去引号片段、更短的片段。
 * 定位失败返回 null——报告里宁可不写行号，也不编造。
 */
export function lineOfText(filePath, fragment) {
  if (!fragment) return null
  const text = readFileSync(filePath, 'utf8')
  const offsetOf = lineIndexOf(filePath)
  const raw = String(fragment)
  const variants = []
  const push = value => {
    const needle = String(value ?? '').trim()
    for (const size of [64, 48, 32, 24, 16, 10]) {
      if (needle.length < size) continue
      const slice = needle.slice(0, size)
      if (!variants.includes(slice)) variants.push(slice)
    }
  }
  push(raw)
  push(JSON.stringify(raw).slice(1, -1))
  push(raw.replace(/"/g, '\\"'))
  push(raw.replace(/\s+/g, ' '))
  for (const needle of variants) {
    const index = text.indexOf(needle)
    if (index >= 0) return offsetOf(index)
  }
  // JSON 生成物里换行被转义为 \\n，段落本身仍应能按前 10 字命中；再兜底从中间取片段。
  for (const needle of [raw.slice(0, 10), raw.slice(Math.max(0, raw.length - 24))].filter(value => value.length >= 8)) {
    const index = text.indexOf(needle)
    if (index >= 0) return offsetOf(index)
  }
  return null
}

export function relPath(path) {
  return relative(MOD, path).replaceAll('\\', '/')
}

// ---------------------------------------------------------------------------
// JS 源码字符串字面量扫描（带真实行号；跳过注释 / 正则 / 模板插值）
// ---------------------------------------------------------------------------
export function jsStringLiterals(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const lineOf = makeLineIndex(text)
  const literals = []
  const flags = { line: false, block: false, regex: false, charClass: false }
  let quote = null, start = 0, buffer = '', escaped = false
  const regexAllowed = prev => !prev || /[({[,;:=!&|?+\-*%<>~^]$/.test(prev) || /(?:^|\b)(?:return|typeof|case|in|of|new|delete|void|throw|else|do|yield|await)$/.test(prev)
  let lastSignificant = ''
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1]
    if (flags.line) { if (char === '\n') flags.line = false; continue }
    if (flags.block) { if (char === '*' && next === '/') { flags.block = false; index++ } continue }
    if (flags.regex) {
      if (escaped) { escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (char === '[') { flags.charClass = true; continue }
      if (char === ']') { flags.charClass = false; continue }
      if (char === '/' && !flags.charClass) flags.regex = false
      continue
    }
    if (quote) {
      if (escaped) { buffer += char === 'n' ? '\n' : char === 't' ? '\t' : char; escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (char === quote) {
        literals.push({ text: buffer, line: lineOf(start), quote })
        quote = null; buffer = ''
        lastSignificant = '"'
        continue
      }
      buffer += char
      continue
    }
    if (char === '/' && next === '/') { flags.line = true; index++; continue }
    if (char === '/' && next === '*') { flags.block = true; index++; continue }
    if (char === '/' && regexAllowed(lastSignificant)) { flags.regex = true; flags.charClass = false; continue }
    if (char === "'" || char === '"') { quote = char; start = index; buffer = ''; escaped = false; continue }
    if (char === '`') {
      // 模板字面量：含 `${...}` 的跳过（动态文本无法静态审计）；纯静态模板按字符串记录。
      let template = '', inner = index + 1, closed = false, dynamic = false
      for (; inner < text.length; inner++) {
        if (template.endsWith('\\')) { template = template.slice(0, -1) + text[inner]; continue }
        if (text[inner] === '`') { closed = true; break }
        if (text[inner] === '$' && text[inner + 1] === '{') { dynamic = true; let depth = 1; inner += 2; while (inner < text.length && depth > 0) { if (text[inner] === '{') depth++; else if (text[inner] === '}') depth--; inner++ } inner--; continue }
        template += text[inner]
      }
      if (closed) {
        if (!dynamic) literals.push({ text: template, line: lineOf(index), quote: '`' })
        index = inner
        lastSignificant = '"'
        continue
      }
      quote = '`'; start = index; buffer = ''; escaped = false
      continue
    }
    if (!/\s/.test(char)) lastSignificant = char
  }
  return Array.from(new Map(literals.map(item => [`${item.line}\u0000${item.text}`, item])).values())
}

// ---------------------------------------------------------------------------
// 结构化数据展平
// ---------------------------------------------------------------------------
const METADATA_PATH = /(^|\.)(source|generatedBy|sourceHashes|enSourceHashes|zhSourceHashes|generator|generatedFrom|glossaryVersion|translationBatches|completedBatches|pendingBatches|batches|meta|status|stage|sourceKind|officialChinese|note|sha256|stableHash|hash|id|key|schemaVersion|file|files|sources|path|code)$/i
const METADATA_VALUE = new Set(['translated', 'self-translated', 'reference-project-zh-locale', 'reference-project-en-locale',
  'bundled-reference-with-self-translated-supplements', 'present', 'missing', 'untranslated', 'present-needs-review', 'pending'])

/** 展平为叶子集合。数组元素若全是字符串 → 视为段落列表，逐段产出（path.index）。 */
export function flattenLeaves(value, { path = '', out = [], skipKey = METADATA_PATH, minLength = 2 } = {}) {
  if (typeof value === 'string') {
    if (value.trim().length >= minLength && !METADATA_VALUE.has(value.trim())) out.push({ path, text: value })
    return out
  }
  if (typeof value !== 'object' || value == null) return out
  for (const [key, child] of Object.entries(value)) {
    if (skipKey && skipKey.test(key)) continue
    flattenLeaves(child, { path: path ? `${path}.${key}` : key, out, skipKey, minLength })
  }
  return out
}

/** 指南面板 blocks 树 → 叶子块（title/text/missing）。 */
export function flattenGuideBlocks(blocks, path, out = []) {
  for (const [index, block] of (blocks || []).entries()) {
    if (!block || typeof block !== 'object') continue
    const here = `${path}.${index}`
    if (typeof block.title === 'string') out.push({ path: `${here}.title`, kind: 'title', text: block.title })
    if (typeof block.text === 'string') out.push({ path: `${here}.text`, kind: 'text', text: block.text })
    if (typeof block.missing === 'string') out.push({ path: `${here}.missing`, kind: 'missing', text: '', marker: block.missing })
    if (block.children) flattenGuideBlocks(block.children, `${here}.children`, out)
  }
  return out
}

/** 指南面板 blocks 树 → 结构化镜像（用于 zh/en 对照）。 */
export function guideTree(blocks) {
  return (blocks || []).filter(block => block && typeof block === 'object').map(block => ({
    title: typeof block.title === 'string' ? block.title : '',
    text: typeof block.text === 'string' ? block.text : '',
    missing: typeof block.missing === 'string' ? block.missing : '',
    children: guideTree(block.children),
  }))
}

// ---------------------------------------------------------------------------
// 文本清洗 / 语言判定
// ---------------------------------------------------------------------------
export function stripMarkup(text) {
  return String(text ?? '')
    .replace(/<section\b[\s\S]*?<\/section>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/\[[a-z][a-z0-9_]*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ENGLISH_STOPWORDS = new Set(('the and of to you your with that this is are was were in on at it for not but or as if then ' +
  'when who what where which how from by be been has have had will would can could should may might must do does did ' +
  'they them their we our he she his her its there here these those any each all no so than into over under about').split(/\s+/))
const PROPER_NOUN_ALLOW = /\b(?:H\. ?P\. ?Lovecraft|Lovecraft|Arkham|Miskatonic|Dunwich|Innsmouth|Carcosa|Hastur|Cthulhu|Nyarlathotep|Yog-Sothoth|Azathoth|Dagon|Kadath|Dreamlands|Elder Sign|Campaign [AB]|\bI+\b|XP|HP)\b/g

/** 英文残留候选：连续英文单词 run（更稳妥地用「3+ 词」或「2 词 + 停用词」）。 */
export function englishRuns(text) {
  const cleaned = stripMarkup(text).replace(PROPER_NOUN_ALLOW, ' ')
  const runs = []
  let current = []
  const flush = () => {
    if (current.length >= 2 && current.some(word => word.length >= 3)) runs.push(current.join(' '))
    current = []
  }
  const parts = cleaned.split(/([A-Za-z][A-Za-z'’-]*)/)
  for (const token of parts) {
    if (/^[A-Za-z][A-Za-z'’-]*$/.test(token)) { current.push(token); continue }
    // 分隔符只允许「空格」继续同一个英文 run；CJK/数字/标点都视为断句。
    if (/[A-Za-z0-9\u3400-\u9fff]/.test(token) || /[，。；：、！？（）【】“”‘’《》—…·]/.test(token)) flush()
    else if (token.trim() === '') continue
    else flush()
  }
  flush()
  const strong = runs.filter(run => {
    const words = run.split(/\s+/)
    return words.length >= 3 || words.some(word => ENGLISH_STOPWORDS.has(word.toLowerCase()))
  })
  return { runs, strong }
}

export function englishWordCount(text) {
  const cleaned = stripMarkup(text)
  return (cleaned.match(/\b[A-Za-z][A-Za-z'’-]{1,}\b/g) || []).length
}

// ---------------------------------------------------------------------------
// 图标 / 占位符
// ---------------------------------------------------------------------------
// web/card-text.js#SYMBOLS 已注册的合法 `[token]`（含 TDE 使用的冻结/敏捷等）。
export const KNOWN_TOKENS = new Set((
  'action reaction free fast combat willpower intellect agility wild guardian seeker rogue mystic survivor neutral ' +
  'health sanity resource clue per_investigator investigator skull cultist tablet elder_thing elder_sign auto_fail ' +
  'bless curse frost blood seal_a seal_b seal_c seal_d seal_e day night codex'
).split(/\s+/))
export const TOKEN_PATTERN = /\[([^\[\]\n]{1,40})\]/g
export const BRACE_TOKEN_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g
export const FULLWIDTH_TOKEN_PATTERN = /[【［]\s*([A-Za-z][A-Za-z0-9_ ]{1,30})\s*[】］]/g

export function tokenCandidates(text) {
  const raw = String(text ?? '')
  const issues = []
  for (const match of raw.matchAll(TOKEN_PATTERN)) {
    const body = match[1]
    if (body.startsWith('[')) continue
    const normalized = body.trim().toLowerCase()
    if (KNOWN_TOKENS.has(normalized) && body === normalized) continue
    issues.push({ kind: 'bracket-token', token: `[${body}]`, normalized })
  }
  for (const match of raw.matchAll(BRACE_TOKEN_PATTERN)) issues.push({ kind: 'brace-token', token: `{${match[1]}}` })
  for (const match of raw.matchAll(FULLWIDTH_TOKEN_PATTERN)) issues.push({ kind: 'fullwidth-token', token: match[0] })
  return issues
}

// ---------------------------------------------------------------------------
// 简体语境下的繁体/异体用字（无歧义子集；著 单独判定）
// ---------------------------------------------------------------------------
export const TRADITIONAL_MAP = Object.freeze({
  於: '于', 與: '与', 裡: '里', 祕: '秘', 來: '来', 個: '个', 說: '说', 這: '这', 麼: '么',
  還: '还', 為: '为', 對: '对', 時: '时', 會: '会', 發: '发', 們: '们', 從: '从', 動: '动',
  過: '过', 進: '进', 開: '开', 關: '关', 實: '实', 學: '学', 覺: '觉', 種: '种', 樣: '样',
  讓: '让', 見: '见', 語: '语', 讀: '读', 寫: '写', 聽: '听', 問: '问', 間: '间', 長: '长',
  門: '门', 陽: '阳', 陰: '阴', 雙: '双', 邊: '边', 連: '连', 帶: '带', 當: '当', 應: '应',
  該: '该', 卻: '却', 並: '并', 沒: '没', 幾: '几', 頭: '头', 願: '愿', 體: '体', 點: '点',
  燈: '灯', 煙: '烟', 態: '态', 勢: '势', 龍: '龙', 鳳: '凤', 島: '岛', 灣: '湾', 華: '华',
  麗: '丽', 夢: '梦', 憶: '忆', 懼: '惧', 驚: '惊', 嚇: '吓', 厲: '厉', 慘: '惨', 嘆: '叹',
  嗎: '吗', 啟: '启', 喚: '唤', 戰: '战', 擊: '击', 殺: '杀', 誰: '谁', 藍: '蓝', 綠: '绿',
  紅: '红', 黃: '黄', 聖: '圣', 屍: '尸', 蓋: '盖', 牆: '墙', 憶: '忆', 鬥: '斗', 僅: '仅',
  從: '从', 眾: '众', 這: '这', 週: '周', 遙: '遥', 靜: '静', 響: '响', 聲: '声', 書: '书',
  畫: '画', 筆: '笔', 紙: '纸', 節: '节', 歲: '岁', 歷: '历', 經: '经', 願: '愿', 豐: '丰',
  貓: '猫', 鳥: '鸟', 魚: '鱼', 貝: '贝', 車: '车', 軍: '军', 農: '农', 醫: '医', 藥: '药',
  鐵: '铁', 銀: '银', 銅: '铜', 錢: '钱', 飛: '飞', 風: '风', 雲: '云', 霧: '雾', 霜: '霜',
  離: '离', 難: '难', 雖: '虽', 雙: '双', 雜: '杂', 雞: '鸡', 麵: '面', 黃: '黄', 齊: '齐',
  齒: '齿', 髮: '发', 鬍: '胡', 鬚: '须', 淚: '泪', 污: '污', 穢: '秽', 嚇: '吓', 癢: '痒',
  醜: '丑', 陋: '陋', 豔: '艳', 豔: '艳', 艷: '艳', 癡: '痴', 瘋: '疯', 癲: '癫', 瘡: '疮',
  餵: '喂', 嚐: '尝', 嘗: '尝', 遷: '迁', 還: '还', 遞: '递', 兒: '儿', 麼: '么', 嗎: '吗',
  淚: '泪', 蠟: '蜡', 燭: '烛', 燄: '焰', 燼: '烬', 爐: '炉', 煙: '烟', 塵: '尘', 壺: '壶',
})
export const TRADITIONAL_CHARS = Object.keys(TRADITIONAL_MAP)

/** 繁体字命中；「著」只在疑似「着」的位置命中（顺著/凝视著/著名除外）。 */
export function traditionalHits(text) {
  const hits = []
  const source = String(text ?? '')
  for (const char of source) if (TRADITIONAL_MAP[char] && !hits.some(hit => hit.char === char)) hits.push({ char, simplified: TRADITIONAL_MAP[char] })
  for (const match of source.matchAll(/著/g)) {
    const before = source[match.index - 1] || '', after = source[match.index + 1] || ''
    if (/[名作称显土著]/.test(before) || /[名作称]/.test(after)) continue
    if (!hits.some(hit => hit.char === '著')) hits.push({ char: '著', simplified: '着' })
  }
  return hits
}

// ---------------------------------------------------------------------------
// 标点 / 格式
// ---------------------------------------------------------------------------
export function punctuationIssues(text) {
  const source = String(text ?? '')
  const issues = []
  const rules = [
    ['duplicate-punct', /(。{2,}|，{2,}|！{2,}|？{2,}|；{2,}|、{2,}|，。|。，|、，|，、|：。|。：|””|““|「」|（）)/g],
    ['ascii-punct-after-cjk', /[\u3400-\u9fff][,.;:!?](?![0-9A-Za-z])/g],
    ['space-before-punct', /[ \t]+[，。！？；：、）】》”’]/g],
    ['cjk-then-ascii-paren', /[\u3400-\u9fff]\([^)]*[A-Za-z0-9][^)]*\)/g],
    ['markdown-emphasis', /(^|[\s（(])([_*])\S[^_*\n]{0,60}\2(?=[\s，。！？；：、）)]|$)/g],
    ['ellipsis-ascii', /[\u3400-\u9fff]\.{3}/g],
    ['fullwidth-space', /[\u3000]{2,}/g],
  ]
  for (const [kind, pattern] of rules) {
    for (const match of source.matchAll(pattern)) {
      issues.push({ kind, sample: match[0].slice(0, 40), index: match.index })
      if (issues.length > 40) return issues
    }
  }
  return issues
}

export function unpairedQuotes(text) {
  const source = String(text ?? '')
  const pairs = [['“', '”'], ['「', '」'], ['（', '）'], ['(', ')']]
  const issues = []
  for (const [open, close] of pairs) {
    const openCount = (source.split(open).length - 1), closeCount = (source.split(close).length - 1)
    if (openCount !== closeCount) issues.push({ kind: 'unpaired-quote', open, close, openCount, closeCount })
  }
  return issues
}

// ---------------------------------------------------------------------------
// 内部标记 / 占位符泄漏
// ---------------------------------------------------------------------------
export function markerLeaks(text) {
  const source = String(text ?? '')
  const issues = []
  const patterns = [
    ['template-ref', /@:[A-Za-z0-9_.-]+/g],
    ['html-tag', /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/gi],
    ['placeholder-brace', /\{[A-Za-z][A-Za-z0-9_]*\}/g],
    ['icu-escape', /\{'\{'\}[^{}]+\{'\}'\}/g],
    ['internal-marker', /\b(?:TODO|FIXME|NEEDS REVIEW|untranslated|missing)\b/gi],
    ['replacement-char', /\uFFFD/g],
    ['placeholder-question', /[?？]{3,}/g],
    ['named-placeholder', /\[(?:shelterValue|count|value|pointsRemaining|setImgPath|name|xp|key)\]/g],
  ]
  for (const [kind, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) {
      issues.push({ kind, sample: match[0].slice(0, 60) })
    }
  }
  return issues
}

/** 导读/正文标签残留（Intro 1: / Resolution 2: / 引言1：等）。 */
export function leftoverLabels(text) {
  const source = stripMarkup(text)
  const issues = []
  const patterns = [
    ['english-label', /(^|\n|\s)[_*]{0,2}(?:Intro|Resolution|Setup|Scenario|Part|Interlude|Prologue|Epilogue|Flashback)\s*(?:[0-9]+|[IVX]+)?\s*[:：]/g],
    ['chinese-label', /(^|\n|\s)[_*]{0,2}(?:引言|导言|導言|梦境|结局|幕间|序章|尾声)\s*(?:[0-9]+|[IVX]+)?\s*[:：]/g],
  ]
  for (const [kind, pattern] of patterns) for (const match of source.matchAll(pattern)) issues.push({ kind, sample: match[0].trim().slice(0, 40) })
  return issues
}

// ---------------------------------------------------------------------------
// 统一中文文本检测入口
// ---------------------------------------------------------------------------
const LANGUAGE_KEYS = /(^|\.)(name|nameZh|title|titleZh|heading|label|labels|chapterTitles|investigatorTitles|keywords|recordLabels|supplyLabels|supplyHints)$/

/**
 * @param {string} text
 * @param {{path?:string, kind?:string, allowEnglishName?:boolean}} options
 */
export function analyzeZhText(text, options = {}) {
  const { path = '', kind = 'text', allowEnglishName = false } = options
  const source = String(text ?? '')
  if (!source.trim()) return []
  const isNameField = allowEnglishName || LANGUAGE_KEYS.test(path)
  const issues = []
  const plain = stripMarkup(source)
  const words = englishWordCount(source)
  const { runs, strong } = englishRuns(source)
  const cjk = cjkCount(source)

  if (!plain.trim()) {
    issues.push({ kind: 'empty-after-markup', severity: 'low' })
  } else if (cjk === 0 && words >= 2) {
    issues.push({ kind: 'untranslated', severity: isNameField ? 'low' : 'high', evidence: plain.slice(0, 160), words })
  } else if (strong.length && !isNameField) {
    issues.push({ kind: 'mixed-language', severity: 'high', evidence: strong[0].slice(0, 120), runs: strong.slice(0, 4) })
  } else if (strong.length && isNameField) {
    issues.push({ kind: 'mixed-language-name', severity: 'low', evidence: strong[0].slice(0, 120) })
  }
  // 中文句中夹孤立英文虚词（典型残留：…、[tablet]，and [elder_thing]；…、and 寒冷刺骨）。
  if (cjk > 5) {
    for (const match of source.matchAll(/(?:[\u3400-\u9fff，。、“”（）\s])((?:and|the|of|to|in|with|for|or|but|is|are|was|were))(?=[\s\u3400-\u9fff，。、）]|$)/gi)) {
      issues.push({ kind: 'mixed-language-word', severity: 'medium', evidence: source.slice(Math.max(0, match.index - 12), match.index + match[0].length + 8) })
    }
  }

  for (const issue of tokenCandidates(source)) issues.push({ kind: `symbol-${issue.kind}`, severity: 'medium', evidence: issue.token })
  for (const issue of markerLeaks(source)) {
    if (issue.kind === 'html-tag' && /<(?:b|i|em|strong|br|p|ul|li|section|div|header)\b/i.test(issue.sample)) {
      issues.push({ kind: 'html-markup', severity: 'medium', evidence: issue.sample })
    } else if (issue.kind !== 'html-tag') {
      issues.push({ kind: `marker-${issue.kind}`, severity: 'high', evidence: issue.sample })
    }
  }
  // 标签残留只对正文段落判定（标题为「幕间 I：…」「尾声 1：…」是既定写法，不算残留）。
  const bodyPath = /(?:^|\.)(?:text|body|paragraphs\.\d+|INTRO|RESOLUTION_\w+|SETUP)$/.test(path) || kind === 'raw'
  if (bodyPath) {
    for (const issue of leftoverLabels(source)) {
      issues.push({ kind: `label-${issue.kind}`, severity: issue.kind === 'english-label' ? 'medium' : 'low', evidence: issue.sample })
    }
  }
  for (const issue of punctuationIssues(source)) issues.push({ kind: `punct-${issue.kind}`, severity: 'low', evidence: issue.sample })
  for (const issue of unpairedQuotes(source)) issues.push({ kind: `punct-${issue.kind}`, severity: 'low', evidence: `${issue.open}×${issue.openCount} ${issue.close}×${issue.closeCount}` })
  const traditional = traditionalHits(source)
  if (traditional.length) issues.push({ kind: 'traditional-chars', severity: 'low', evidence: traditional.map(hit => hit.char).join(''), hits: traditional })
  return issues
}

// ---------------------------------------------------------------------------
// 分段候选
// ---------------------------------------------------------------------------
const TERMINAL = /[。！？…”」』）\])】…—]$/

/** 长段/粘连扫描：引导块中「多个句号挤在一段」「• 列表项无换行」等。 */
export function segmentationCandidates(text, { kind = 'text' } = {}) {
  const source = String(text ?? '')
  const issues = []
  const cjk = cjkCount(source)
  if (kind === 'block') {
    if (cjk > 420) issues.push({ kind: 'long-block', severity: 'low', evidence: source.slice(0, 80), cjk })
    if (/•[^\n]{10,}•/.test(source)) issues.push({ kind: 'bullets-inline', severity: 'medium', evidence: source.slice(0, 120) })
    const lines = source.split(/\n/)
    if (lines.length > 1 && lines.some(line => line.trim() && !/^[•\s]/.test(line) && !TERMINAL.test(line.trim()))) {
      issues.push({ kind: 'single-newline-block', severity: 'low', evidence: source.slice(0, 120) })
    }
  }
  if (kind === 'paragraph') {
    if (cjk > 500) issues.push({ kind: 'long-paragraph', severity: 'low', evidence: source.slice(0, 80), cjk })
    const tail = source.trim()
    const unterminated = cjk > 80 && !TERMINAL.test(tail) && !/[：:；;•]$/.test(tail) && !/^\s*[•·]/.test(tail)
    if (unterminated) issues.push({ kind: 'unterminated-paragraph', severity: 'low', evidence: tail.slice(-60) })
  }
  return issues
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

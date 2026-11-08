// 《地球边缘》(EOTE) 翻译审计 —— Lead 独立交叉复核扫描器（v2）。
//
// 目的：不依赖各 area 审计员的自述，独立复算「漏翻 / 中英混杂 / 错误符号 / 简繁与用字」的机械指标，
// 为 translate/README.md 提供可复现的第三方数字，并对 area findings 做抽样核对。
//
// 用法（在 games/arkhamhorror 下）：
//   node docs/edgeOfTheEarth/translate/tools/lead-crosscheck.mjs            # 扫描并写 crosscheck/*.json
//   node docs/edgeOfTheEarth/translate/tools/lead-crosscheck.mjs --print    # 只打印摘要，不写文件
//
// 唯一写入：docs/edgeOfTheEarth/translate/crosscheck/ 目录；不修改任何游戏内容/实现。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOD = join(HERE, '..', '..', '..', '..')            // games/arkhamhorror
const WORKSPACE = join(MOD, '..', '..')                   // boardgame-hall-ai
const REF = join(WORKSPACE, '参考资源/ArkhamHorror-main')
const OUT = join(HERE, '..', 'crosscheck')
const PRINT_ONLY = process.argv.includes('--print')

const { ALL_CARDS } = await import(pathToFileURL(join(MOD, 'src/cards/cards-data.js')).href)
const story = await import(pathToFileURL(join(MOD, 'content/campaigns/edgeOfTheEarth/story-text.js')).href)
const { buildGuides } = await import(pathToFileURL(join(MOD, 'tools/eote-guide-scan.mjs')).href)

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------
const CJK = /[\u3400-\u9fff]/
const EN_SENTENCE = /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i
const TOKEN_RE = /\[\[[^\]]+\]\]|\[[a-z_]+\]|\{[^}]+\}/g
const ICON_RE = /\[([a-z_]+)\]/g
const TRAIT_RE = /\[\[([^\]]+)\]\]/g
const PLACEHOLDER_RE = /\{[^}]+\}/g
const digitsOf = text => (String(text).match(/\d+/g) || []).sort()
const countRe = (text, re) => (String(text).match(re) || []).length
const stripTags = value => String(value ?? '').replace(/<\/?[a-z][^>]*>/gi, '')
const normSpace = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const normPunct = value => normSpace(value).replace(/\s*([，。：；！？、（）,!?()])\s*/g, '$1')
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const readText = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '')

/** 常见繁体字/异体：规范简体语料中不应出现的写法。著 单列（简体也允许「著名」，但本语料多为「着」误写）。 */
const TRADITIONAL_CHARS = [...new Set(('後於與裡祕來個說這麼們時現發開關題對給沒會學覺應該讓從進遠邊過還樣歷據處務員別靜辦牠祂麼' +
  '們為與於來時說這對開關會學覺應該讓從進遠邊過還樣歷據處務員別靜辦牠祂麼後現發題給沒').split(''))]
function traditionalHits(text) {
  const s = String(text ?? '')
  const hits = []
  for (const ch of s) if (TRADITIONAL_CHARS.includes(ch)) hits.push(ch)
  return hits
}
const countZhe = text => countRe(text, /著/g)

function iconTokens(text) {
  return (String(text ?? '').match(ICON_RE) || []).map(t => t.toLowerCase()).sort()
}
/** 中文卡面历史口径：英文 [fast]（快速图标）在简中语料中写作 [free]；比较时归一。 */
function normalizeIcons(list) {
  return list.map(icon => icon.replace('[fast]', '[free]')).sort()
}
function traitTokens(text) {
  return (String(text ?? '').match(TRAIT_RE) || []).slice().sort()
}
function placeholderTokens(text) {
  return (String(text ?? '').match(PLACEHOLDER_RE) || []).sort()
}
function multisetsEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
function latinWords(text) {
  const cleaned = String(text ?? '').replace(TOKEN_RE, ' ')
  return (cleaned.match(/[A-Za-z][A-Za-z'’-]{1,}/g) || [])
    // 作者缩写 H. P. Lovecraft、单字母编号等不算混杂
    .filter(word => !/^[A-Z]\.?$/.test(word))
}

/** 标点/格式异常探测。 */
function punctuationAnomalies(text) {
  const s = String(text ?? '')
  const out = []
  const push = (type, detail, re) => {
    const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m, count = 0
    while ((m = rx.exec(s))) { count++; if (count > 5) break }
    if (count) out.push({ type, detail, count })
  }
  push('double-punct', '。后紧跟半角句点（。.）', /。\s*\./)
  push('double-punct', '半角句点后紧跟中文句号（.。）', /\.\s*。/)
  push('double-punct', '重复中文句号（。。）', /。。/)
  push('double-punct', '重复中文逗号（，，）', /，，/)
  push('double-punct', '重复半角逗号（,,）', /,,/)
  push('punct-mix', '中文后接半角逗号/分号/冒号/叹号/问号', /[\u3400-\u9fff][,;:!?]/)
  push('punct-mix', '中文后接半角句点（非数字小数）', /[\u3400-\u9fff]\.(?!\d)/)
  push('punct-mix', '半角括号包裹中文', /\([^()]*[\u3400-\u9fff][^()]*\)/)
  push('space', '中文与标点间多余空格', /[\u3400-\u9fff]\s+[，。：；！？、]/)
  push('space', '行尾多余空格（每行）', /[ \t]+$/m)
  push('space', '连续空格', /  +/)
  push('html', 'HTML 标签残留', /<\/?[a-z][a-z0-9]*\b[^>]*>/i)
  push('mojibake', '替换字符 U+FFFD', /\uFFFD/)
  push('mojibake', '疑似 UTF-8/GBK 乱码字符', /[鐨锛鈥鍦鏄銆鏂鍜鍙涓]/)
  push('placeholder', '花括号模板残留', /\{[a-zA-Z_][a-zA-Z0-9_]*\}/)
  const pairs = [['（', '）'], ['(', ')'], ['“', '”'], ['「', '」'], ['『', '』'], ['【', '】']]
  for (const [open, close] of pairs) {
    const a = countRe(s, new RegExp(escapeRe(open), 'g'))
    const b = countRe(s, new RegExp(escapeRe(close), 'g'))
    if (a !== b) out.push({ type: 'bracket-unbalanced', detail: `「${open}」${a} vs「${close}」${b}`, count: Math.abs(a - b) })
  }
  // [[ ]] 特性 token 内的中文/英文按成对处理，不参与方括号配对检查
  const rawOpen = countRe(s, /\[/g) - countRe(s, /\[\[/g) * 2
  const rawClose = countRe(s, /\]/g) - countRe(s, /\]\]/g) * 2
  if (rawOpen !== rawClose) out.push({ type: 'bracket-unbalanced', detail: `[ ${rawOpen} vs ] ${rawClose}`, count: Math.abs(rawOpen - rawClose) })
  return out
}

/** 一个中文展示文本的质量画像；en 用于结构对照（图标/占位符）。 */
function analyzeText(text, en = '') {
  const s = String(text ?? '')
  const result = { empty: !s.trim(), englishOnly: false, cjk: CJK.test(s), mixed: null, punct: [], trad: [], icons: null, placeholders: null, zhe: 0 }
  if (!s.trim()) return result
  result.englishOnly = !result.cjk
  result.zhe = countZhe(s)
  if (result.cjk) {
    if (EN_SENTENCE.test(s)) result.mixed = { type: 'english-sentence', sample: s.match(EN_SENTENCE)[0] }
    else {
      const words = latinWords(s)
      if (words.length >= 2) result.mixed = { type: 'latin-words', words: words.slice(0, 8) }
    }
    result.punct = punctuationAnomalies(s)
    const trad = traditionalHits(s)
    if (trad.length) result.trad = [...new Set(trad)]
  }
  if (en) {
    if (!multisetsEqual(normalizeIcons(iconTokens(en)), normalizeIcons(iconTokens(s)))) result.icons = { en: iconTokens(en), zh: iconTokens(s) }
    if (!multisetsEqual(placeholderTokens(en), placeholderTokens(s))) result.placeholders = { en: placeholderTokens(en), zh: placeholderTokens(s) }
  }
  return result
}

// ---------------------------------------------------------------------------
// 1) 卡面（403 张 EOTE 卡）
// ---------------------------------------------------------------------------
function scanCards() {
  const eoteCodes = Object.keys(ALL_CARDS).filter(code => ['eoep', 'eoec'].includes(ALL_CARDS[code].pack))
  const refZhCn = new Map(readJson(join(REF, 'frontend/public/cards_zh-cn.json')).map(c => [c.code, c]))
  const candidates = { missing: [], englishOnly: [], mixed: [], symbols: [], punctuation: [], traditional: [], zhe: [], repoDiff: [], mistranslation: [] }
  const stats = { cards: eoteCodes.length, fieldsChecked: 0, zhEmptyOnEn: 0, mixedFields: 0, symbolFields: 0, punctFields: 0, tradFields: 0, zheFields: 0, zheTotal: 0, repoDiffFields: 0, mistranslationCandidates: 0 }

  for (const code of eoteCodes) {
    const card = ALL_CARDS[code]
    const up = refZhCn.get(code) || {}
    const fieldPairs = [
      ['text', 'textZh', 'text'], ['backText', 'backTextZh', 'back_text'],
      ['flavor', 'flavorZh', 'flavor'], ['backFlavor', 'backFlavorZh', 'back_flavor'],
      ['name', 'nameZh', 'name'], ['subname', 'subnameZh', 'sub_name'],
      ['backName', 'backNameZh', 'back_name'],
    ]
    for (const [enField, zhField, refField] of fieldPairs) {
      const en = String(card[enField] ?? '')
      const zh = String(card[zhField] ?? '')
      stats.fieldsChecked++
      if (en.trim() && !zh.trim()) { stats.zhEmptyOnEn++; candidates.missing.push({ code, field: zhField, en: en.slice(0, 160) }) }
      if (!zh.trim()) continue
      const a = analyzeText(zh, en)
      if (a.englishOnly) { candidates.englishOnly.push({ code, field: zhField, sample: zh.slice(0, 200) }); continue }
      if (a.mixed) { stats.mixedFields++; candidates.mixed.push({ code, field: zhField, ...a.mixed, sample: zh.slice(0, 220) }) }
      if (a.icons || a.placeholders) { stats.symbolFields++; candidates.symbols.push({ code, field: zhField, icons: a.icons, placeholders: a.placeholders, sample: zh.slice(0, 240) }) }
      if (a.punct.length) { stats.punctFields++; candidates.punctuation.push({ code, field: zhField, details: a.punct.slice(0, 5), sample: zh.slice(0, 240) }) }
      if (a.trad.length) { stats.tradFields++; candidates.traditional.push({ code, field: zhField, chars: a.trad, count: a.trad.length, sample: zh.slice(0, 160) }) }
      if (a.zhe) { stats.zheFields++; stats.zheTotal += a.zhe; candidates.zhe.push({ code, field: zhField, count: a.zhe, sample: zh.slice(0, 120) }) }

      // 与上游简中来源的差异（正常应为 0：本项目 textZh = 上游去 <b> 标签）
      const refText = stripTags(up[refField] ?? '')
      if (refText && normSpace(refText) !== normSpace(zh) && refField !== 'traits') {
        stats.repoDiffFields++
        candidates.repoDiff.push({ code, field: zhField, upstream: refText.slice(0, 220), ours: zh.slice(0, 220) })
      }
      // 误译线索：伤害/恐惧互换
      const enHasHorror = /\bhorror\b/i.test(en)
      const enHasDamage = /\bdamage\b/i.test(en)
      const zhHasHorror = /恐惧/.test(zh)
      const zhHasDamage = /伤害/.test(zh)
      if (enHasHorror && !enHasDamage && zhHasDamage && !zhHasHorror) { stats.mistranslationCandidates++; candidates.mistranslation.push({ code, field: zhField, type: 'horror-to-damage', en: en.slice(0, 200), zh: zh.slice(0, 200) }) }
      if (enHasDamage && !enHasHorror && zhHasHorror && !zhHasDamage) { stats.mistranslationCandidates++; candidates.mistranslation.push({ code, field: zhField, type: 'damage-to-horror', en: en.slice(0, 200), zh: zh.slice(0, 200) }) }
    }
    // traitsZh 与上游 traits 集合（格式：本项目用数组、上游用「.」分隔；比较集合）
    const upTraits = String(up.traits ?? '').replace(/[.。]\s*$/, '').split(/[.,，、]\s*/).map(s => s.trim()).filter(Boolean).sort()
    const ourTraits = (card.traitsZh || []).map(s => String(s).replace(/[.。]\s*$/, '').trim()).filter(Boolean).sort()
    if (upTraits.length && JSON.stringify(upTraits) !== JSON.stringify(ourTraits)) {
      stats.repoDiffFields++
      candidates.repoDiff.push({ code, field: 'traitsZh', upstream: upTraits.join('|'), ours: ourTraits.join('|') })
    }
  }
  const byPack = {}
  for (const code of eoteCodes) byPack[ALL_CARDS[code].pack] = (byPack[ALL_CARDS[code].pack] || 0) + 1
  return { stats: { ...stats, byPack }, candidates }
}

// ---------------------------------------------------------------------------
// 2) 剧情正文（story-text.js + 战役 flow 展示值）
// ---------------------------------------------------------------------------
function walkLeaves(value, prefix = '', out = []) {
  if (typeof value === 'string') { out.push({ path: prefix, text: value }); return out }
  if (Array.isArray(value)) { value.forEach((child, i) => walkLeaves(child, `${prefix}[${i}]`, out)); return out }
  for (const [key, child] of Object.entries(value || {})) walkLeaves(child, prefix ? `${prefix}.${key}` : key, out)
  return out
}
const objSeen = new WeakSet()
function collectGroups(value, out, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return out
  seen.add(value)
  if (Array.isArray(value.entries) && typeof value.id === 'string') { out.push(value); return out }
  if (Array.isArray(value)) { value.forEach(child => collectGroups(child, out, seen)); return out }
  Object.values(value).forEach(child => collectGroups(child, out, seen))
  return out
}

function scanStory(flowModule) {
  const T = story.EOTE_STORY_TEXT
  const candidates = { chapterMixed: [], chapterSymbols: [], chapterPunct: [], chapterTrad: [], gapMismatch: [], groupMixed: [], groupPunct: [], groupTrad: [], groupGaps: [], localeKeyGaps: [], localeKeyMixed: [], flowEnglish: [], statusInconsistent: [] }
  const stats = { chapters: 0, chapterSections: 0, chapterGaps: 0, chapterPresent: 0, chapterEnglishOnly: 0, chapterZhe: 0, campaignGroups: 0, campaignEntries: 0, campaignGaps: 0, campaignMixed: 0, campaignPunct: 0, campaignTrad: 0, campaignZhe: 0, localeKeys: 0, localeKeyGaps: 0, flowNodes: 0, flowEnglishNodes: 0 }
  const perChapter = {}

  for (const [id, chapter] of Object.entries(T.chapters)) {
    stats.chapters++
    const gaps = chapter.chineseGaps || {}
    const flat = walkLeaves(chapter.sections, '')
    stats.chapterSections += flat.length
    stats.chapterGaps += Object.keys(gaps).length
    let mixed = 0, punct = 0, trad = 0, englishOnly = 0, zhe = 0
    for (const leaf of flat) {
      const key = leaf.path
      const status = gaps[key]
      const display = leaf.text
      const en = getPath(chapter.sectionsEn, key) ?? ''
      if (status) {
        if (normSpace(display) !== normSpace(en)) candidates.gapMismatch.push({ chapter: id, path: key, status, note: 'chineseGaps 标记但 display ≠ en', display: display.slice(0, 200) })
        continue
      }
      stats.chapterPresent++
      const a = analyzeText(display, en)
      if (a.englishOnly) { englishOnly++; candidates.chapterMixed.push({ chapter: id, path: key, type: 'english-only', sample: display.slice(0, 200) }); continue }
      if (a.mixed) { mixed++; candidates.chapterMixed.push({ chapter: id, path: key, ...a.mixed, sample: display.slice(0, 220) }) }
      if (a.punct.length) { punct++; candidates.chapterPunct.push({ chapter: id, path: key, details: a.punct.slice(0, 4), sample: display.slice(0, 220) }) }
      if (a.trad.length) { trad++; candidates.chapterTrad.push({ chapter: id, path: key, chars: a.trad, sample: display.slice(0, 160) }) }
      zhe += a.zhe
      const symbolIssues = []
      if (a.icons) symbolIssues.push({ kind: 'icons', ...a.icons })
      if (a.placeholders) symbolIssues.push({ kind: 'placeholders', ...a.placeholders })
      // 图标/占位符之外，检查 en 中的数字是否在中文里保留（中文数字写法会误报，只作候选）
      const enDigits = digitsOf(en)
      const zhDigits = digitsOf(display)
      if (enDigits.length && !multisetsEqual(enDigits, zhDigits)) symbolIssues.push({ kind: 'digits', en: enDigits, zh: zhDigits })
      if (symbolIssues.length) candidates.chapterSymbols.push({ chapter: id, path: key, issues: symbolIssues.slice(0, 4), sample: display.slice(0, 220) })
    }
    stats.chapterEnglishOnly += englishOnly
    stats.chapterZhe += zhe
    perChapter[id] = { sectionCount: chapter.sectionCount, chinese: chapter.chinese, status: chapter.status, gaps: Object.keys(gaps).length, mixed, punct, trad, zhe, englishOnly }
  }

  // 战役分组（prologue/checkpoints/interludes/epilogue/specialRules/records）
  const groupMap = new Map()
  for (const group of [...collectGroups(T.campaign, []), ...collectGroups(T.interludes, []), ...collectGroups(T.epilogue, [])]) groupMap.set(group.id, group)
  const groups = [...groupMap.values()]
  stats.campaignGroups = groups.length
  for (const group of groups) {
    for (const entry of group.entries || []) {
      stats.campaignEntries++
      const status = entry.status
      const texts = [entry.title, entry.body].filter(text => typeof text === 'string' && text.trim())
      if (status === 'present-needs-review') {
        for (const text of texts) {
          const a = analyzeText(text)
          if (a.englishOnly) { candidates.statusInconsistent.push({ group: group.id, key: entry.key, status, note: '状态为已译但正文无中文', text: text.slice(0, 160) }); continue }
          if (a.mixed) { stats.campaignMixed++; candidates.groupMixed.push({ group: group.id, key: entry.key, ...a.mixed, sample: text.slice(0, 220) }) }
          if (a.punct.length) { stats.campaignPunct++; candidates.groupPunct.push({ group: group.id, key: entry.key, details: a.punct.slice(0, 4), sample: text.slice(0, 220) }) }
          if (a.trad.length) { stats.campaignTrad++; candidates.groupTrad.push({ group: group.id, key: entry.key, chars: a.trad, sample: text.slice(0, 160) }) }
          stats.campaignZhe += a.zhe
        }
      } else {
        stats.campaignGaps++
        candidates.groupGaps.push({ group: group.id, key: entry.key, status, sample: String(entry.body ?? entry.text ?? '').slice(0, 160) })
      }
    }
  }

  // 扁平 localeKeys（edgeOfTheEarth.*）：流程节点实际取 body，是「英文进中文界面」的关键路径
  for (const [key, value] of Object.entries(T.localeKeys || {})) {
    stats.localeKeys++
    if (!value || typeof value !== 'object') continue
    const { status } = value
    const body = String(value.body ?? '').trim()
    if (status !== 'present-needs-review') { stats.localeKeyGaps++; if (body) candidates.localeKeyGaps.push({ key, status, sample: body.slice(0, 160) }); continue }
    const a = analyzeText(body)
    if (a.englishOnly) candidates.statusInconsistent.push({ key, status, note: 'localeKey 状态已译但正文无中文', text: body.slice(0, 160) })
    else if (a.mixed) candidates.localeKeyMixed.push({ key, ...a.mixed, sample: body.slice(0, 220) })
  }

  // 战役 flow 最终展示值（localizeNodes 之后的 node.text）是否英文
  if (flowModule?.EOTE_FLOW?.nodes) {
    for (const [id, node] of Object.entries(flowModule.EOTE_FLOW.nodes)) {
      if (typeof node?.text !== 'string' || !node.text.trim()) continue
      stats.flowNodes++
      if (!CJK.test(node.text)) { stats.flowEnglishNodes++; candidates.flowEnglish.push({ node: id, text: node.text.slice(0, 200) }) }
      else {
        const a = analyzeText(node.text)
        if (a.mixed) candidates.groupMixed.push({ group: 'flow', key: id, ...a.mixed, sample: node.text.slice(0, 220) })
        if (a.punct.length) candidates.groupPunct.push({ group: 'flow', key: id, details: a.punct.slice(0, 4), sample: node.text.slice(0, 220) })
      }
    }
  }

  return { stats, perChapter, candidates }
}

function getPath(object, dotted) {
  let current = object
  for (const segment of String(dotted).split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[segment]
  }
  return typeof current === 'string' ? current : undefined
}

// ---------------------------------------------------------------------------
// 3) 指南面板（web/scenario-guides 8 份）
// ---------------------------------------------------------------------------
function scanGuides() {
  const guideRows = buildGuides()
  const candidates = { mixed: [], punct: [], symbols: [], traditional: [], coverageMismatch: [], missingFlagMismatch: [], markerLeak: [], storyTextMismatch: [], webDeclaredMismatch: [] }
  const perChapter = {}
  const stats = { chapters: 0, sections: 0, present: 0, missing: 0, untranslated: 0, zhBlocks: 0, missingFlags: 0, emptyTextBlocks: 0 }

  // 参考 locale 叶子索引（逐文件）
  const localeIndex = (() => {
    const files = ['base.json', 'scenarios/iceAndDeath.json', 'scenarios/fatalMirage.json', 'scenarios/toTheForbiddenPeaks.json', 'scenarios/cityOfTheElderThings.json', 'scenarios/theHeartOfMadness.json']
    const index = {}
    for (const file of files) {
      const key = file.replace(/^scenarios\//, '').replace(/\.json$/, '')
      index[key] = {
        en: new Map(walkLeaves(readJson(join(REF, 'frontend/src/locales/en/edgeOfTheEarth', file))).map(leaf => [leaf.path, leaf.text])),
        zh: new Map(walkLeaves(readJson(join(REF, 'frontend/src/locales/zh/edgeOfTheEarth', file))).map(leaf => [leaf.path, leaf.text])),
      }
    }
    return index
  })()
  const guideIdOf = id => id.replace(/Part[123]$/, '')

  for (const guide of guideRows) {
    stats.chapters++
    const index = localeIndex[guide.guideId]
    const sections = guide.sections
    stats.sections += sections.length
    const gaps = {}
    let mixed = 0, punct = 0, trad = 0
    for (const section of sections) {
      const path = section.path
      const status = section.chinese
      if (status !== 'present-needs-review') { stats.missing += status === 'missing' ? 1 : 0; stats.untranslated += status === 'untranslated' ? 1 : 0; gaps[path] = status; continue }
      stats.present++
      const en = String(index.en.get(path) ?? '')
      const zh = String(index.zh.get(path) ?? '')
      if (!zh.trim()) { candidates.mixed.push({ guide: guide.id, path, type: 'empty-present', origin: 'reference-locale', sample: en.slice(0, 160) }); continue }
      const a = analyzeText(zh, en)
      if (a.englishOnly) { candidates.mixed.push({ guide: guide.id, path, type: 'english-only', origin: 'reference-locale', sample: zh.slice(0, 200) }); continue }
      if (a.mixed) { mixed++; candidates.mixed.push({ guide: guide.id, path, ...a.mixed, origin: 'reference-locale', sample: zh.slice(0, 220) }) }
      if (a.punct.length) { punct++; candidates.punct.push({ guide: guide.id, path, origin: 'reference-locale', details: a.punct.slice(0, 4), sample: zh.slice(0, 220) }) }
      if (a.trad.length) { trad++; candidates.traditional.push({ guide: guide.id, path, origin: 'reference-locale', chars: a.trad, sample: zh.slice(0, 160) }) }
      const symbolIssues = []
      if (a.icons) symbolIssues.push({ kind: 'icons', ...a.icons })
      if (a.placeholders) symbolIssues.push({ kind: 'placeholders', ...a.placeholders })
      if (symbolIssues.length) candidates.symbols.push({ guide: guide.id, path, origin: 'reference-locale', issues: symbolIssues.slice(0, 4), sample: zh.slice(0, 220) })
    }

    // web 指南 JSON：声明的 chinese 统计 / chineseGaps 与参考 locale 复算是否一致
    const web = readJson(join(MOD, 'web/scenario-guides', `${guide.id}.json`))
    const declared = web.chinese || {}
    const declaredGaps = Object.keys(web.chineseGaps || {})
    for (const key of declaredGaps) {
      const hit = Object.entries(gaps).find(([p]) => p === key || p.endsWith(`.${key}`))
      if (!hit) candidates.coverageMismatch.push({ guide: guide.id, path: key, note: 'chineseGaps 有但参考 locale 复算为已译', declared: web.chineseGaps[key] })
    }
    for (const [path, status] of Object.entries(gaps)) {
      const hits = declaredGaps.filter(key => key === path || path.endsWith(`.${key}`))
      if (!hits.length) candidates.coverageMismatch.push({ guide: guide.id, path, note: '参考 locale 判为缺译但 web chineseGaps 未记', status })
    }
    const webTree = walkLeaves(web.locales?.zh, '')
    const blocks = []
    ;(function walkBlocks(node, prefix) {
      if (Array.isArray(node)) return node.forEach((child, i) => walkBlocks(child, prefix))
      if (!node || typeof node !== 'object') return
      if (typeof node.text === 'string' || node.missing || node.title) blocks.push({ path: prefix, ...node })
      for (const [key, child] of Object.entries(node)) {
        if (key === 'text' || key === 'title' || key === 'missing') continue
        if (child && typeof child === 'object') walkBlocks(child, prefix ? `${prefix}.${key}` : key)
      }
    })(web.locales?.zh, 'zh')
    void webTree
    stats.zhBlocks += blocks.length
    for (const block of blocks) {
      const text = String(block.text ?? '')
      if (block.missing) {
        stats.missingFlags++
        if (text.trim()) candidates.missingFlagMismatch.push({ guide: guide.id, path: block.path, note: 'missing 标记但 text 非空', text: text.slice(0, 160) })
        const gapHit = Object.keys(web.chineseGaps || {}).some(key => block.path === key || block.path.endsWith(`.${key}`) || String(block.path).endsWith(`.${key}`))
        if (!gapHit) candidates.missingFlagMismatch.push({ guide: guide.id, path: block.path, note: 'missing 标记的 path 不在 chineseGaps', missing: block.missing })
      }
      if (block.text !== undefined && !text.trim()) stats.emptyTextBlocks++
      if (/中文待补|(^|\W)(missing|untranslated|present-needs-review)(\W|$)/i.test(text)) candidates.markerLeak.push({ guide: guide.id, path: block.path, text: text.slice(0, 160) })
      if (text.trim()) {
        const a = analyzeText(text)
        if (a.englishOnly) candidates.mixed.push({ guide: guide.id, path: block.path, type: 'tree-english-only', origin: 'guide-panel', sample: text.slice(0, 200) })
        else if (a.mixed) candidates.mixed.push({ guide: guide.id, path: block.path, type: 'tree-' + a.mixed.type, origin: 'guide-panel', ...a.mixed, sample: text.slice(0, 220) })
        if (a.trad.length) candidates.traditional.push({ guide: guide.id, path: block.path, origin: 'guide-panel', chars: a.trad, sample: text.slice(0, 160) })
      }
    }

    // 与 story-text.js 的 chineseGaps / 统计一致性（同一事实源，应完全一致）
    const storyChapter = (story.EOTE_STORY_TEXT.chapters || {})[guide.id]
    if (storyChapter) {
      const storyGaps = storyChapter.chineseGaps || {}
      const storyKeys = Object.keys(storyGaps).sort()
      const webKeys = declaredGaps.slice().sort()
      if (JSON.stringify(storyKeys) !== JSON.stringify(webKeys)) candidates.storyTextMismatch.push({ guide: guide.id, note: 'chineseGaps 与 story-text 不一致', storyCount: storyKeys.length, webCount: webKeys.length })
      if (declared.total !== storyChapter.chinese?.total || declared.missing !== storyChapter.chinese?.missing || declared.untranslated !== storyChapter.chinese?.untranslated) {
        candidates.webDeclaredMismatch.push({ guide: guide.id, declared, story: storyChapter.chinese })
      }
    }
    perChapter[guide.id] = {
      sections: sections.length, present: sections.filter(s => s.chinese === 'present-needs-review').length,
      missing: sections.filter(s => s.chinese === 'missing').length, untranslated: sections.filter(s => s.chinese === 'untranslated').length,
      gaps: Object.keys(gaps).length, declared: web.chinese, chineseStatus: web.chineseStatus,
      declaredGaps: declaredGaps.length, mixed, punct, trad, blocks: blocks.length,
    }
  }
  return { stats, perChapter, candidates }
}

// ---------------------------------------------------------------------------
// 4) 参考 zh locale 覆盖（叶子级；补译 backlog 的原始来源）
// ---------------------------------------------------------------------------
function scanReferenceCoverage() {
  const files = ['base.json', 'scenarios/iceAndDeath.json', 'scenarios/fatalMirage.json', 'scenarios/toTheForbiddenPeaks.json', 'scenarios/cityOfTheElderThings.json', 'scenarios/theHeartOfMadness.json']
  const out = {}
  const totals = { en: 0, missing: 0, untranslated: 0, present: 0, identical: 0 }
  const backlog = []
  for (const file of files) {
    const en = readJson(join(REF, 'frontend/src/locales/en/edgeOfTheEarth', file))
    const zh = readJson(join(REF, 'frontend/src/locales/zh/edgeOfTheEarth', file))
    const enLeaves = walkLeaves(en)
    const zhByPath = new Map(walkLeaves(zh).map(leaf => [leaf.path, leaf.text]))
    const missing = [], untranslated = [], present = []
    for (const leaf of enLeaves) {
      const z = zhByPath.get(leaf.path)
      if (z === undefined) { missing.push({ path: leaf.path, en: leaf.text.slice(0, 200) }); backlog.push({ file, path: leaf.path, status: 'missing', layer: leaf.path.split('.')[0] }); continue }
      if (!CJK.test(z)) { untranslated.push({ path: leaf.path, en: leaf.text.slice(0, 200), zh: z.slice(0, 200) }); backlog.push({ file, path: leaf.path, status: 'untranslated', layer: leaf.path.split('.')[0] }); continue }
      if (EN_SENTENCE.test(z)) { untranslated.push({ path: leaf.path, type: 'mixed-english-sentence', en: leaf.text.slice(0, 200), zh: z.slice(0, 200) }); backlog.push({ file, path: leaf.path, status: 'untranslated', reason: 'mixed-english-sentence', layer: leaf.path.split('.')[0] }); continue }
      present.push({ path: leaf.path })
    }
    out[file] = { total: enLeaves.length, missing: missing.length, untranslated: untranslated.length, present: present.length, missingList: missing, untranslatedList: untranslated }
    totals.en += enLeaves.length; totals.missing += missing.length; totals.untranslated += untranslated.length; totals.present += present.length
  }
  return { totals, backlog, files: out }
}

// ---------------------------------------------------------------------------
// 5) 已发布展示文本的符号/占位符残渣（story-text display + web guides 面板）
// ---------------------------------------------------------------------------
const fileCache = new Map()
function fileOf(absPath) {
  if (!fileCache.has(absPath)) fileCache.set(absPath, readText(absPath))
  return fileCache.get(absPath)
}
const lineStartCache = new Map()
function lineStartsOf(absPath) {
  if (!lineStartCache.has(absPath)) {
    const text = fileOf(absPath)
    const starts = [0]
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
    lineStartCache.set(absPath, starts)
  }
  return lineStartCache.get(absPath)
}
function lineAt(absPath, index) {
  const starts = lineStartsOf(absPath)
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= index) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}
/** 在生成物文件中定位某个字符串值所在行（文件内容由 JSON.stringify 写出，转义形式一致）。 */
function locateValue(absPath, value) {
  const text = fileOf(absPath)
  const needle = JSON.stringify(String(value)).slice(1, -1)
  if (!needle) return null
  const index = text.indexOf(needle)
  return index < 0 ? null : lineAt(absPath, index)
}

const SHIPPED_TOKENS = [
  { id: 'brace-residue', label: "花括号占位残渣 {'…'}", re: /\{'/g },
  { id: 'question-placeholder', label: '问号占位残渣 ???', re: /\?\?\?/g },
  { id: 'shelter-value-en', label: '英文词条 Shelter Value', re: /Shelter Value/g },
  { id: 'experience-en', label: '英文词条 Experience', re: /\bExperience\b/g },
  { id: 'bracket-placeholder', label: '英文方括号占位符（[shelterValue]/[count] 等）', re: /\[(?:shelterValue|count|name|key|value|perPlayer|fast|xp|x)\b[^\]]*\]/gi },
  { id: 'double-punct', label: '重复标点 。.', re: /。\s*\./g },
  { id: 'trailing-half-period', label: '中文后接半角句点', re: /[\u3400-\u9fff]\.(?!\d)/g },
  { id: 'half-comma', label: '中文后接半角逗号', re: /[\u3400-\u9fff],/g },
  { id: 'html-residue', label: 'HTML 标签残留', re: /<\/?[a-z][^>]*>/gi },
]
const countMatches = (text, re) => (String(text ?? '').match(re) || []).length

function tokenRecord(target, token, chapter, key, text, absPath) {
  const count = countMatches(text, token.re)
  if (!count) return
  target.byToken[token.id] ||= { label: token.label, count: 0, unique: 0, uniqueTexts: new Set(), occurrences: [] }
  const entry = target.byToken[token.id]
  entry.count += count
  entry.uniqueTexts.add(String(text))
  if (entry.occurrences.length < 12) {
    entry.occurrences.push({ chapter, key, count, location: locateValue(absPath, text), sample: String(text).slice(0, 200) })
  }
  target.total += count
}
function finalizeTokens(area) {
  for (const entry of Object.values(area.byToken)) {
    entry.unique = entry.uniqueTexts.size
    delete entry.uniqueTexts
  }
  return area
}

function scanShippedTokens() {
  const storyPath = join(MOD, 'content/campaigns/edgeOfTheEarth/story-text.js')
  const storyResult = { byToken: {}, total: 0, zhe: 0, scanned: 0 }
  const T = story.EOTE_STORY_TEXT
  for (const [id, chapter] of Object.entries(T.chapters || {})) {
    const gaps = chapter.chineseGaps || {}
    for (const [key, text] of Object.entries(chapter.sections || {})) {
      if (typeof text !== 'string' || gaps[key]) continue
      storyResult.scanned++
      storyResult.zhe += countZhe(text)
      for (const token of SHIPPED_TOKENS) tokenRecord(storyResult, token, id, key, text, storyPath)
    }
  }
  const groupMap = new Map()
  for (const group of [...collectGroups(T.campaign, []), ...collectGroups(T.interludes, []), ...collectGroups(T.epilogue, [])]) groupMap.set(group.id, group)
  for (const group of groupMap.values()) {
    for (const entry of group.entries || []) {
      if (entry.status !== 'present-needs-review') continue
      for (const [field, text] of [['title', entry.title], ['body', entry.body]]) {
        if (typeof text !== 'string' || !text.trim()) continue
        storyResult.scanned++
        storyResult.zhe += countZhe(text)
        for (const token of SHIPPED_TOKENS) tokenRecord(storyResult, token, group.id, `${entry.key}.${field}`, text, storyPath)
      }
    }
  }
  for (const [key, value] of Object.entries(T.localeKeys || {})) {
    if (!value || typeof value !== 'object' || value.status !== 'present-needs-review') continue
    for (const field of ['title', 'body']) {
      const text = value[field]
      if (typeof text !== 'string' || !text.trim()) continue
      storyResult.scanned++
      storyResult.zhe += countZhe(text)
      for (const token of SHIPPED_TOKENS) tokenRecord(storyResult, token, 'localeKeys', `${key}.${field}`, text, storyPath)
    }
  }

  const guideIds = ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage', 'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2']
  const guideResult = { byToken: {}, total: 0, zhe: 0, scanned: 0, perGuide: {} }
  for (const id of guideIds) {
    const absPath = join(MOD, 'web/scenario-guides', `${id}.json`)
    const web = readJson(absPath)
    let scanned = 0, zhe = 0
    const collections = []
    ;(function walkBlocks(node, prefix) {
      if (Array.isArray(node)) return node.forEach(child => walkBlocks(child, prefix))
      if (!node || typeof node !== 'object') return
      if (typeof node.text === 'string' || node.missing || node.title) collections.push({ path: prefix, ...node })
      for (const [key, child] of Object.entries(node)) {
        if (key === 'text' || key === 'title' || key === 'missing') continue
        if (child && typeof child === 'object') walkBlocks(child, prefix ? `${prefix}.${key}` : key)
      }
    })(web.locales?.zh, 'zh')
    for (const block of collections) {
      for (const [field, text] of [['title', block.title], ['text', block.text]]) {
        if (typeof text !== 'string' || !text.trim()) continue
        scanned++
        zhe += countZhe(text)
        for (const token of SHIPPED_TOKENS) tokenRecord(guideResult, token, id, `${block.path}.${field}`, text, absPath)
      }
    }
    guideResult.scanned += scanned
    guideResult.zhe += zhe
    guideResult.perGuide[id] = { scanned, zhe }
  }
  return { story: finalizeTokens(storyResult), guides: finalizeTokens(guideResult) }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
let flowModule = null
try { flowModule = await import(pathToFileURL(join(MOD, 'content/campaigns/edgeOfTheEarth/flow.js')).href) } catch (error) { console.error('flow import failed:', error.message) }

const cards = scanCards()
const storyResult = scanStory(flowModule)
const guides = scanGuides()
const coverage = scanReferenceCoverage()
const shipped = scanShippedTokens()

const shippedSummary = area => ({
  total: area.total,
  zhe: area.zhe,
  scanned: area.scanned,
  byToken: Object.fromEntries(Object.entries(area.byToken).map(([id, value]) => [id, value.count])),
  ...(area.perGuide ? { perGuide: area.perGuide } : {}),
})

const summary = {
  generatedAt: new Date().toISOString(),
  modRoot: MOD,
  cards: { ...cards.stats, candidates: Object.fromEntries(Object.entries(cards.candidates).map(([k, v]) => [k, v.length])) },
  story: { ...storyResult.stats, candidates: Object.fromEntries(Object.entries(storyResult.candidates).map(([k, v]) => [k, v.length])) },
  guides: { ...guides.stats, candidates: Object.fromEntries(Object.entries(guides.candidates).map(([k, v]) => [k, v.length])) },
  shipped: { story: shippedSummary(shipped.story), guides: shippedSummary(shipped.guides) },
  referenceCoverage: coverage.totals,
}

if (PRINT_ONLY) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  writeFileSync(join(OUT, 'cards.json'), JSON.stringify(cards, null, 2) + '\n')
  writeFileSync(join(OUT, 'story.json'), JSON.stringify(storyResult, null, 2) + '\n')
  writeFileSync(join(OUT, 'guides.json'), JSON.stringify(guides, null, 2) + '\n')
  writeFileSync(join(OUT, 'coverage.json'), JSON.stringify(coverage, null, 2) + '\n')
  writeFileSync(join(OUT, 'shipped.json'), JSON.stringify(shipped, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`\nwritten: ${OUT}`)
}

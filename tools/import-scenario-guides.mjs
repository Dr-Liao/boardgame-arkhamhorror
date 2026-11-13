// Build reader-facing adventure guides. Runtime reads only web/scenario-guides;
// the bundled reference and translation sources are needed only to regenerate.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { chapters as innsmouthChapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { STORY_TEXT as innsmouthStory } from '../content/campaigns/theInnsmouthConspiracy/story-text.js'
import { chapters as eoteChapters } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { EOTE_STORY_META, EOTE_STORY_TEXT } from '../content/campaigns/edgeOfTheEarth/story-text.js'
import { TDE_STORY_TEXT } from '../content/campaigns/theDreamEaters/story-text.js'
import { chapters as tskChapters } from '../content/campaigns/theScarletKeys/shared.js'
import { TSK_STORY_META, TSK_STORY_TEXT } from '../content/campaigns/theScarletKeys/story-text.js'

const source = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/', import.meta.url)
const destination = new URL('../web/scenario-guides/', import.meta.url)
const json = async url => JSON.parse(await readFile(url, 'utf8'))
const skipped = new Set(['heading', 'tokens', 'label', 'tooltips', 'remembered', 'xp', 'ui', 'messages'])
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object)

function localizeSupplements(value, language) {
  return language === 'zh' ? String(value)
    .replaceAll('The investigators win the campaign!', '调查员赢得战役！')
    .replaceAll('Do not read any intro for a character not chosen by a player. Once each player has read his or her character’s intro, proceed to Setup.', '不要阅读未被玩家选中的角色引言。每位玩家读完自己角色的引言后，进入设置。')
    .replaceAll('but perhaps this is the chance you have been waiting for?', '但或许这正是你一直等待的机会？')
    .replaceAll('Step forward and accept Keziah’s offering. Skip to Resolution 9. You may choose this option only if an investigator has the Black Book in their deck and Erynn joined the investigators.', '走上前，接受凯夏的馈赠。跳至结局 9。只有在某名调查员的牌组中有黑书，且艾琳已加入调查员时，才可以选择此项。')
    .replaceAll('Flee with Sanford and the Lodge. Skip to Resolution 10', '与桑福德和秘社一同逃走。跳至结局 10') : String(value)
}

// 遭遇组图标清单：生成器把 `<section class="encounter-sets"><img…>` 整段剥掉后，会留下
// 「这些遭遇组以下列图标表示：」的悬空句（guides-0004）。遭遇组名称已在前句逐个列出，
// 这里连同冒号一起删掉；中英面板同口径。
const ENCOUNTER_ICON_HINT_ZH = /(?:这些|上述|以下)?遭遇(?:组|牌)[^。.：:\n；;]*(?:图标|圖標)[^。.：:\n；;]*[：:]\s*/g
const ENCOUNTER_ICON_HINT_EN = /\b(?:these|the following|the above)(?:\s+encounter)?\s+(?:sets?|cards?)\b[^.\n]*(?:icons?|symbols?)[^.\n]*:\s*/gi

export function stripEncounterIconHints(text, language) {
  return String(text ?? '').replace(language === 'en' ? ENCOUNTER_ICON_HINT_EN : ENCOUNTER_ICON_HINT_ZH, '')
}

// 中文指南里的英文列举连接符：", and" / 半角逗号 → 中文顿号（guides-0003）。
function localizeZhConnectors(text) {
  let output = String(text ?? '')
    .replace(/\s*,\s*and\s+/gi, '、')
    .replace(/([\u3400-\u9fff\]\)）”’])\s*,\s*/g, '$1、')
  // 去掉顿号后遗留的「、。」「、.」。
  output = output.replace(/、\s*([。.!?！？])/g, '$1')
  return output
}

export function guideText(value, language) {
  let text = String(value)
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    .replace(/\{fast\}/g, '[free]')
    .replace(/\{xp\}/g, language === 'en' ? '(calculate as instructed above)' : '（按上述说明计算）')
    .replace(/\{name\}/g, language === 'en' ? 'the chosen investigator' : '所选调查员')
    .replace(/\{key\}/g, language === 'en' ? 'the chosen key' : '所选钥匙')
    .replace(/\{perPlayer\}/g, '[per_investigator]')
    .replace(/\{([a-zA-Z_]+)\}/g, (_, name) => `[${({ elderThing: 'elder_thing', autoFail: 'auto_fail' })[name] || name}]`)
    .replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\*/g, '').replace(/(^|[^a-z])_|_([^a-z]|$)/gi, '$1$2')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  text = stripEncounterIconHints(text, language)
  if (language === 'zh') text = localizeZhConnectors(text)
  const localized = localizeSupplements(text, language)
  return language === 'zh' ? localizeResidualEnglish(localized) : localized
}

// ---------------------------------------------------------------------------
// 中文指南里残留的英文转场句（上游 zh locale 半译）：整行 "Proceed to Setup." 等。
// 这些句子只有 2 个英文词，旧测试的「3+ 英文词」门槛抓不到，但玩家会直接读到英文。
// ---------------------------------------------------------------------------
const RESIDUAL_EN_TRANSITIONS = [
  [/\bProceed to _?Setup_?\./gi, '进入冒险设置。'],
  [/\bSkip to _?Setup_?\./gi, '跳至冒险设置。'],
  [/\bProceed to _?Intro_?\./gi, '进入引言。'],
  [/\bSkip to _?Intro_?\./gi, '跳至引言。'],
  [/\bRead _?Intro_?\./gi, '阅读引言。'],
  [/\bProceed to _?Scenario I+: The Witching Hour_?\./gi, '进入冒险：巫异时刻。'],
]

export function localizeResidualEnglish(text) {
  let output = String(text ?? '')
  // 段首的英文分节标签（上游 zh locale 半译）：Resolution 2: / Intro 4: → 结局 2：/ 引言 4：
  output = output.replace(/^([ \t]*)(Intro|Resolution|No Resolution|Scenario)\s*([0-9]+|[IVX]+)?\s*[:：]/gim,
    (match, indent, label, number) => {
      const localized = { intro: '引言', resolution: '结局', 'no resolution': '无结局', scenario: '剧本' }[label.toLowerCase()]
      return `${indent}${localized}${number ? ` ${number}` : ''}：`
    })
  for (const [pattern, replacement] of RESIDUAL_EN_TRANSITIONS) output = output.replace(pattern, replacement)
  return output
}

// ---------------------------------------------------------------------------
// 分支收尾补全：上游 zh locale 有整段把条件译好了、却漏掉「前往〈引言 N〉」的段落
//（如 shatteredAeons / threadsOfFate / theCityOfArchives / turnBackTime）。
// 这里按 en 段落里的 Proceed/Skip/Read 指令生成对应的中文去向；只在 en 段落有指令、
// zh 段落完全没有中文去向词时追加，已有「前往/转至/跳至/进入…」的段落不动。
// ---------------------------------------------------------------------------
const ZH_BRANCH_TARGET = /(?:前往|跳至|跳到|进入|阅读|继续|转至|转到|推进|参见|设置|检查点|结局|引言|开场|梦境|幕间|尾声)/
const EN_BRANCH_DIRECTIVE = /\b((?:Proceed to|Skip to|Continue to|Go to|Read))\s+_?([^.\n_]+?)_?\s*(?:\.|$)/gi
const BRANCH_NOUNS = Object.freeze({
  intro: '引言', dream: '梦境', resolution: '结局', epilogue: '尾声', interlude: '幕间', checkpoint: '检查点', setup: '冒险设置',
})

function chineseBranchTarget(verb, rawTarget) {
  const target = String(rawTarget ?? '').trim().replace(/\s+/g, ' ')
  const verbZh = { 'proceed to': '前往', 'skip to': '跳至', 'continue to': '继续前往', 'go to': '转至', read: '阅读' }[verb.toLowerCase()]
  if (!verbZh) return null
  const numbered = /^(intro|dream|resolution|epilogue|interlude|checkpoint)\s*([0-9]+|[IVX]+)$/i.exec(target)
  if (numbered) {
    const noun = BRANCH_NOUNS[numbered[1].toLowerCase()]
    return `${verbZh}〈${noun} ${numbered[2]}〉`
  }
  if (/^setup$/i.test(target)) return verb.toLowerCase() === 'skip to' ? '跳至冒险设置' : '进入冒险设置'
  return null
}

function branchDirectives(englishText) {
  const directives = []
  for (const match of String(englishText ?? '').matchAll(EN_BRANCH_DIRECTIVE)) {
    const translated = chineseBranchTarget(match[1], match[2])
    if (translated) directives.push(translated)
  }
  return directives
}
// 职阶图标（guides-0005）：TDE 梦境条目 zh 只译了「守卫者/探求者…」文字，en 的 `[guardian]`
// token 在参考 zh 里丢失。按 en 的 token 数量在中文职阶词后补回（渲染层认 `[class]` 图标）。
const CLASS_TOKENS = Object.freeze({ 守卫者: 'guardian', 探求者: 'seeker', 流浪者: 'rogue', 神秘学家: 'mystic', 潜修者: 'mystic', 幸存者: 'survivor', 中立: 'neutral' })

export function restoreClassTokens(zhText, englishText) {
  if (!zhText || !englishText) return zhText
  let text = String(zhText)
  for (const [zhName, token] of Object.entries(CLASS_TOKENS)) {
    const tokenRe = new RegExp(`\\[${token}\\]`, 'g')
    const expected = (String(englishText).match(tokenRe) || []).length
    if (!expected) continue
    let current = (text.match(tokenRe) || []).length
    while (current < expected && text.includes(zhName)) {
      const pattern = new RegExp(`${zhName}(?!（\\[${token}\\]）)`)
      const next = text.replace(pattern, `${zhName}（[${token}]）`)
      if (next === text) break
      text = next
      current++
    }
  }
  return text
}

/**
 * @param {string} zhText
 * @param {string} enText
 * @returns {string}
 */
export function completeBranchTargets(zhText, enText) {
  if (!zhText || !enText) return zhText
  if (!/\b(?:Proceed to|Skip to|Continue to|Go to|Read)\s/i.test(enText)) return zhText
  const enParagraphs = String(enText).split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
  const zhParagraphs = String(zhText).split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
  const fullZh = zhParagraphs.join('\n')
  // 同一个去向已在中文块的其他位置出现过（如结局列表里的「进入结局 1」），不再重复追加。
  const alreadyPresent = directive => {
    const numbered = /〈(.+?) ([0-9]+|[IVX]+)〉/.exec(directive)
    if (numbered) return new RegExp(`${numbered[1]}\\s*${numbered[2]}`).test(fullZh)
    if (/冒险设置/.test(directive)) return /(?:进入|前往|跳至|开始)\s*冒险设置|进入设置|前往设置/.test(fullZh)
    return false
  }
  const paired = Math.min(enParagraphs.length, zhParagraphs.length)
  let changed = false
  const output = [...zhParagraphs]
  const appendDirectives = (paragraph, directives, englishParagraph = '') => {
    const pending = directives.filter(directive => !alreadyPresent(directive))
    if (!pending.length) return paragraph
    const next = [...pending]
    let joined
    if (next.length > 1 && /otherwise/i.test(englishParagraph)) joined = `${next[0]}；否则${next.slice(1).join('；')}`
    else joined = next.join('；')
    const clause = /^(?:•\s*)?(?:如果|若|当|检查|查看|并非|否则|调查员必须|你们必须)/.test(paragraph)
    const terminal = /[。！？…”」』）]$/.test(paragraph)
    const separator = terminal ? '' : clause ? '，' : '。'
    return `${paragraph}${separator}${joined}。`
  }
  const appendToLast = (directives, englishParagraph = '') => {
    if (!directives.length) return
    const next = appendDirectives(output[output.length - 1], directives, englishParagraph)
    if (next === output[output.length - 1]) return
    changed = true
    output[output.length - 1] = next
  }
  for (let index = 0; index < paired; index++) {
    if (ZH_BRANCH_TARGET.test(output[index])) continue
    const directives = branchDirectives(enParagraphs[index])
    if (!directives.length) continue
    const next = appendDirectives(output[index], directives, enParagraphs[index])
    if (next === output[index]) continue
    changed = true
    output[index] = next
  }
  // zh 段落比 en 少：多出来的 en 段落若只是「指令句」，把去向补在最后一个 zh 段落末尾。
  if (enParagraphs.length > zhParagraphs.length) {
    const extraDirectives = []
    let extraEnglish = ''
    for (const paragraph of enParagraphs.slice(zhParagraphs.length)) {
      if (/\n|。|！|？/.test(paragraph.replace(/(?:Proceed to|Skip to|Continue to|Go to|Read)[^.]*\./gi, ''))) continue
      extraDirectives.push(...branchDirectives(paragraph))
      extraEnglish += ` ${paragraph}`
    }
    appendToLast(extraDirectives, extraEnglish)
  }
  return changed ? output.join('\n\n') : zhText
}

// ---------------------------------------------------------------------------
// P7《地球边缘》指南：正文来源统一用 `story-text.js` 生成物（与章节 / 幕间同一事实源）。
// zh locale 只放已译叶子；缺译叶子用空正文 + `missing` 标记并在顶层 `chineseGaps` 列出，
// 不允许用英文冒充中文（展示层可据此显示「中文待补」）。
// ---------------------------------------------------------------------------
function eoteCategoryOf(key) {
  if (key === 'resolutions') return 'resolutions'
  if (/intro/i.test(key) || ['dreamSelection', 'dreams'].includes(key)) return 'intro'
  if (['setup', 'investigatorSetup', 'standalone', 'regionSetup'].includes(key)) return 'setup'
  if (['specialRules', 'rules', 'theVoid', 'moving', 'hiddenChamber', 'choosingARandomLocation',
    'locationsInTheEncounterDeck', 'threeActsThreeThreads', 'bodyOfAYithian', 'depthLevel', 'pursuit',
    'storyCards', 'noWayOut', 'theSpectralEncounterDeck', 'keys', 'breachesAndIncursions', 'theCosmos',
    'emptySpace', 'callOfMadness', 'seal', 'titanicRamp'].includes(key)) return 'specialRules'
  return 'story'
}

/** story-text 的嵌套双语树 → 指南 blocks（与 TIC/TDE 产物同形状：{text} | {title, children}）。 */
function eoteBlocks(enNode, displayNode, gaps, path, language) {
  // 测试口径：中文指南里出现连续 3+ 个英文小写单词即视为「未译正文冒充中文」。
  const untranslatedChinese = text => /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i.test(text)
  // 参考 locale 的 `@:` 键向引用（生成物里可能残留）：指南不展开跨节引用，直接去掉引用行，
  // 保留同段其余正文；绝不能把 `@:...` 原样展示给玩家或让测试看到未展开格式。
  const stripRefs = value => String(value ?? '')
    .replace(/@:[A-Za-z0-9_.-]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (typeof enNode === 'string') {
    // en 面板的 [shelterValue] 没有插值点（guides-0006）：写成可读短语。
    const english = stripEncounterIconHints(stripRefs(enNode).replace(/\[shelterValue\]/g, "the camp's shelter value"), 'en')
    if (language === 'en') return english ? [{ text: english }] : []
    const gap = gaps[path]
    if (gap) return [{ text: '', missing: gap, path }]
    const text = stripEncounterIconHints(stripRefs(displayNode), 'zh')
    // 理论上 untranslated 叶子已在 story-text 的 chineseGaps 里（gap 分支会先返回）；
    // 这里只做兜底，不新增/改写 chineseGaps，保持指南与 story-text 同一事实源。
    if (text && untranslatedChinese(text)) return [{ text: '', missing: 'untranslated', path }]
    return text ? [{ text }] : [{ text: '', missing: 'missing', path }]
  }
  if (!enNode || typeof enNode !== 'object' || Array.isArray(enNode)) return []
  const rawTitle = typeof enNode.title === 'string' ? stripRefs(displayNode?.title) : ''
  const title = typeof enNode.title === 'string'
    ? (language === 'en' ? stripRefs(enNode.title)
      : (gaps[`${path}.title`] || untranslatedChinese(rawTitle) ? '' : rawTitle))
    : ''
  if (language === 'zh' && title === '' && rawTitle && gaps[`${path}.title`] == null) gaps[`${path}.title`] = 'untranslated'
  const children = []
  for (const [key, child] of Object.entries(enNode)) {
    if (key === 'title' || skipped.has(key)) continue
    children.push(...eoteBlocks(child, displayNode?.[key], gaps, `${path}.${key}`, language))
  }
  if (children.length) return [{ ...(title ? { title } : {}), children }]
  return title ? [{ title }] : []
}

export function buildEoteGuide(chapterId) {
  const chapter = eoteChapters.find(entry => entry.id === chapterId)
  if (!chapter) throw new RangeError(`未知《地球边缘》章节 ${chapterId}`)
  const story = EOTE_STORY_TEXT.chapters[chapterId]
  if (!story) throw new Error(`story-text 缺少章节 ${chapterId}（先运行 node tools/import-eote-story.mjs --write）`)
  const guide = {
    id: chapterId,
    campaignId: 'edgeOfTheEarth',
    sourceKind: EOTE_STORY_META?.sourceKind || 'reference-project-zh-locale',
    officialChinese: false,
    chineseStatus: story.status,
    chinese: story.chinese,
    chineseGaps: story.chineseGaps,
    sectionCount: story.sectionCount,
    guideKeyCount: story.guideKeyCount,
    sources: story.sources,
    locales: {},
  }
  for (const language of ['zh', 'en']) {
    const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
    // zh 分支可能遇到参考 zh locale「有中文但夹整句英文」的段落：这类段落不当作已译，
    // 统一改写成 missing 标记并补进 chineseGaps（UI 显示「中文待补」，不用英文冒充）。
    const gaps = language === 'zh' ? { ...story.chineseGaps } : story.chineseGaps
    for (const key of Object.keys(story.sectionsEn)) {
      if (skipped.has(key)) continue
      sections[eoteCategoryOf(key)].push(...eoteBlocks(story.sectionsEn[key], story.sections[key], gaps, key, language))
    }
    if (language === 'zh') guide.chineseGaps = gaps
    // 与 TIC/TDE 产物一致：特别规则去重（同一段被多处引用时只展示一次）。
    sections.specialRules = sections.specialRules.filter((block, index, all) =>
      all.findIndex(other => JSON.stringify(other) === JSON.stringify(block)) === index)
    guide.locales[language] = sections
  }
  return guide
}

/** TSK：story-text 保留参考 locale 原始 HTML/占位符；生成指南前按语言清洗成可读文本。 */
function cleanGuideTree(node, language) {
  if (typeof node === 'string') return guideText(node, language)
  if (Array.isArray(node)) return node.map(child => cleanGuideTree(child, language))
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, cleanGuideTree(child, language)]))
  }
  return node
}

function tskCategoryOf(key) {
  if (key === 'resolutions') return 'resolutions'
  if (/intro/i.test(key)) return 'intro'
  if (key === 'setup' || /^versions?\d*$/i.test(key)) return 'setup'
  if (['specialRules', 'rules', 'trackingTime', 'key', 'locations', 'tokens'].includes(key)) return 'specialRules'
  return 'story'
}

export function buildTskGuide(chapterId) {
  const chapter = tskChapters.find(entry => entry.id === chapterId)
  if (!chapter) throw new RangeError(`未知《绯红密钥》章节 ${chapterId}`)
  const story = TSK_STORY_TEXT.chapters[chapterId]
  if (!story) throw new Error(`story-text 缺少章节 ${chapterId}（先运行 node tools/import-tsk-story.mjs --write）`)
  const guide = {
    id: chapterId,
    campaignId: 'theScarletKeys',
    sourceKind: TSK_STORY_META?.sourceKind || 'reference-project-zh-locale',
    officialChinese: false,
    chineseStatus: TSK_STORY_META?.status || 'generated',
    chineseGaps: story.chineseGaps,
    sectionCount: story.summary?.total ?? null,
    guideKeyCount: story.summary?.total ?? null,
    sources: TSK_STORY_META?.sources || [],
    locales: {},
  }
  const cleanEn = cleanGuideTree(story.sectionsEn, 'en')
  const cleanZh = cleanGuideTree(story.sections, 'zh')
  for (const language of ['zh', 'en']) {
    const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
    for (const key of Object.keys(story.sectionsEn)) {
      if (skipped.has(key)) continue
      sections[tskCategoryOf(key)].push(...eoteBlocks(cleanEn[key], cleanZh[key], [], key, language))
    }
    sections.specialRules = sections.specialRules.filter((block, index, all) =>
      all.findIndex(other => JSON.stringify(other) === JSON.stringify(block)) === index)
    guide.locales[language] = sections
  }
  return guide
}

export async function buildScenarioGuides() {
  const registeredScenarios = contentRegistry.listScenarios()
  // P7：《地球边缘》八章单元（catalog 阶段未进生产注册表，但指南 UI 依赖其 id 加载）。
  const knownIds = new Set([
    ...registeredScenarios.map(scenario => scenario.id),
    ...innsmouthChapters.map(chapter => chapter.id),
  ])
  const eoteScenarioEntries = eoteChapters
    .filter(chapter => !knownIds.has(chapter.id))
    .map(chapter => ({ id: chapter.id, campaignId: 'edgeOfTheEarth', eoteChapter: chapter }))
  const tskScenarioEntries = tskChapters
    .filter(chapter => !knownIds.has(chapter.id))
    .map(chapter => ({ id: chapter.id, campaignId: 'theScarletKeys', tskChapter: chapter }))
  const scenarios = [...registeredScenarios, ...innsmouthChapters.filter(ch => !registeredScenarios.some(s => s.id === ch.id))
    .map(ch => ({ ...ch, campaignId: 'theInnsmouthConspiracy' })), ...eoteScenarioEntries, ...tskScenarioEntries]
  const documents = {}
  const translations = await json(new URL('../content/scenario-guide-translations.json', import.meta.url))
  const dreamTranslations = {}
  const batches = new URL('../content/campaigns/theDreamEaters/story-source/', import.meta.url)
  for (const file of (await readdir(batches)).filter(name => /^batch-\d+\.json$/.test(name))) {
    Object.assign(dreamTranslations, (await json(new URL(file, batches))).entries)
  }
  for (const scenario of scenarios) {
    if (scenario.campaignId === 'edgeOfTheEarth') continue
    documents[scenario.id] = {}
    for (const language of ['en', 'zh']) {
      const sourceId = scenario.id.startsWith('heartOfTheEldersPart') ? 'heartOfTheElders' : scenario.id
      documents[scenario.id][language] = scenario.campaignId === 'theInnsmouthConspiracy'
        ? innsmouthStory[language].scenarios[sourceId]
        : await json(new URL(`${language}/${scenario.campaignId}/scenarios/${sourceId}.json`, source))
    }
  }
  // 《食梦者》参考 zh locale 的历史译文普遍缺分支收尾（故事段/结局段被砍掉 bullet 行），
  // 而 P8-T 自译生成物 `story-text.js` 的章节 sections 与 en locale 同构且更完整。
  // zh 指南以 story-text 的 sections 覆盖参考 zh 文档（形状按 en 文档收敛），
  // 缺键（如 beyondTheGatesOfSleep 的 specialRules）回退参考 zh；en 指南仍用参考 en locale。
  function overlayTdeZh(enNode, referenceNode, storyNode) {
    if (storyNode === undefined || storyNode === null) return referenceNode
    if (typeof enNode === 'string') {
      if (typeof storyNode === 'string') return storyNode
      if (storyNode && typeof storyNode === 'object' && typeof storyNode.body === 'string') return storyNode.body
      return referenceNode
    }
    if (Array.isArray(enNode)) {
      if (!Array.isArray(storyNode)) return referenceNode
      return enNode.map((child, index) => overlayTdeZh(child, referenceNode?.[index], storyNode[index]))
    }
    if (enNode && typeof enNode === 'object') {
      if (!storyNode || typeof storyNode !== 'object' || Array.isArray(storyNode)) return referenceNode
      const out = {}
      for (const key of Object.keys(enNode)) {
        const merged = overlayTdeZh(enNode[key], referenceNode && typeof referenceNode === 'object' ? referenceNode[key] : undefined, storyNode[key])
        if (merged !== undefined) out[key] = merged
      }
      return out
    }
    return referenceNode
  }
  for (const scenario of scenarios) {
    if (scenario.campaignId !== 'theDreamEaters') continue
    const sections = TDE_STORY_TEXT.chapters?.[scenario.id]?.sections
    if (!sections) continue
    documents[scenario.id].zh = overlayTdeZh(documents[scenario.id].en, documents[scenario.id].zh, sections)
  }
  function translated(id, path, language, depth = 0) {
    if (depth > 12) throw new Error(`Circular guide reference: ${id}.${path}`)
    const entry = documents[id]
    let value = language === 'zh'
      ? translations[`${id}.${path}`] ?? dreamTranslations[`scenarios/${id}.json#${path}`] ?? get(entry.zh, path) ?? get(entry.en, path)
      : get(entry.en, path)
    if (typeof value === 'string' && value.startsWith('@:')) {
      const [, targetId, ...targetPath] = value.slice(2).split('.')
      return translated(targetId, targetPath.join('.'), language, depth + 1)
    }
    return value
  }
  const results = new Map()
  const missing = []
  for (const scenario of scenarios) {
    if (scenario.campaignId === 'edgeOfTheEarth') {
      results.set(`${scenario.id}.json`, `${JSON.stringify(buildEoteGuide(scenario.id), null, 2)}\n`)
      continue
    }
    if (scenario.campaignId === 'theScarletKeys') {
      results.set(`${scenario.id}.json`, `${JSON.stringify(buildTskGuide(scenario.id), null, 2)}\n`)
      continue
    }
    const guide = { id: scenario.id, campaignId: scenario.campaignId, sourceKind: 'bundled-reference-with-self-translated-supplements', officialChinese: false, locales: {} }
    for (const language of ['zh', 'en']) {
      const root = documents[scenario.id].en
      const zhRoot = documents[scenario.id].zh
      const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
      function blocks(path, original, localized) {
        const value = translated(scenario.id, path, language)
        // Some Chinese entries are complete HTML strings where English uses an object.
        if (typeof value === 'string') {
          const englishText = typeof original === 'string' ? guideText(original, 'en') : ''
          let text = guideText(value, language)
          if (language === 'zh') {
            // 上游 zh locale 只译了条件、漏掉「前往〈引言 N〉」的段落：按 en 指令补全去向。
            text = completeBranchTargets(text, englishText)
            // TDE 梦境条目的职阶图标 token 丢失：按 en 数量补回 `[guardian]` 等。
            text = restoreClassTokens(text, englishText)
            if (/\b(?:Proceed to|Skip to|Continue to|Go to)\b/i.test(text)) {
              missing.push({ path: `${scenario.id}.${path}`, text, reason: 'english-branch-transition' })
            } else if (branchDirectives(englishText).length && !ZH_BRANCH_TARGET.test(text)) {
              missing.push({ path: `${scenario.id}.${path}`, text, english: englishText, reason: 'branch-target-missing' })
            }
          }
          if (!text) return []
          const prose = text.replace(/\[[a-z_]+\]/g, '')
          if (language === 'zh' && ((/[a-z]{5}/i.test(prose) && !/[\u3400-\u9fff]/.test(prose))
            || /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i.test(prose))) {
            missing.push({ path: `${scenario.id}.${path}`, text, reason: 'untranslated-body' })
          }
          return [{ text }]
        }
        const object = original && typeof original === 'object' ? original : localized
        if (!object || typeof object !== 'object') return []
        const title = typeof object.title === 'string' ? guideText(translated(scenario.id, `${path}.title`, language), language) : ''
        const children = []
        for (const key of new Set([...Object.keys(object), ...(localized && typeof localized === 'object' ? Object.keys(localized) : [])])) {
          if (key === 'title' || skipped.has(key)) continue
          children.push(...blocks(`${path}.${key}`, object[key], localized?.[key]))
        }
        return children.length ? [{ ...(title ? { title } : {}), children }] : []
      }
      let entries = Object.entries(root)
      // Both registered chapters share the source file; show only the current part.
      if (scenario.id.startsWith('heartOfTheEldersPart')) {
        const part = `part${scenario.id.endsWith('2') ? 2 : 1}`
        entries = Object.entries(root[part]).map(([key, value]) => [`${part}.${key}`, value])
      }
      entries = entries.flatMap(([path, value]) => path === 'flavorText'
        ? Object.entries(value).map(([key, text]) => [`flavorText.${key}`, text]) : [[path, value]])
      for (const [path, value] of entries) {
        if (skipped.has(path)) continue
        const key = path.split('.').at(-1)
        const category = key === 'resolutions' ? 'resolutions'
          : /^intro/.test(key) || ['dreamSelection', 'dreams'].includes(key) ? 'intro'
          : ['setup', 'standalone', 'regionSetup'].includes(key) ? 'setup'
          : ['specialRules', 'rules', 'theVoid', 'moving', 'hiddenChamber', 'choosingARandomLocation', 'locationsInTheEncounterDeck', 'threeActsThreeThreads', 'bodyOfAYithian', 'depthLevel', 'pursuit', 'storyCards', 'noWayOut', 'theSpectralEncounterDeck', 'keys', 'breachesAndIncursions', 'theCosmos', 'emptySpace'].includes(key) ? 'specialRules'
          : 'story'
        sections[category].push(...blocks(path, value, get(zhRoot, path)))
      }
      sections.specialRules = sections.specialRules.filter((block, index, all) =>
        all.findIndex(other => JSON.stringify(other) === JSON.stringify(block)) === index)
      guide.locales[language] = sections
    }
    results.set(`${scenario.id}.json`, `${JSON.stringify(guide, null, 2)}\n`)
  }
  if (missing.length) throw new Error(`Missing Chinese guide translations:\n${JSON.stringify(missing, null, 2)}`)
  return results
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const files = await buildScenarioGuides()
  if (process.argv.includes('--write')) await mkdir(destination, { recursive: true })
  for (const [name, value] of files) {
    const file = new URL(name, destination)
    if (process.argv.includes('--write')) await writeFile(file, value)
    else if (await readFile(file, 'utf8') !== value) throw new Error(`Guide out of date: ${name}`)
  }
  console.log(`Adventure guides: ${files.size} scenarios ${process.argv.includes('--write') ? 'written' : 'verified'}.`)
}

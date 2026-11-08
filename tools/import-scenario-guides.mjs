// Build reader-facing adventure guides. Runtime reads only web/scenario-guides;
// the bundled reference and translation sources are needed only to regenerate.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { chapters as innsmouthChapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { STORY_TEXT as innsmouthStory } from '../content/campaigns/theInnsmouthConspiracy/story-text.js'
import { chapters as eoteChapters } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { EOTE_STORY_META, EOTE_STORY_TEXT } from '../content/campaigns/edgeOfTheEarth/story-text.js'

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

export function guideText(value, language) {
  const text = String(value)
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
  return localizeSupplements(text, language)
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
    const english = stripRefs(enNode)
    if (language === 'en') return english ? [{ text: english }] : []
    const gap = gaps[path]
    if (gap) return [{ text: '', missing: gap, path }]
    const text = stripRefs(displayNode)
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
  const scenarios = [...registeredScenarios, ...innsmouthChapters.filter(ch => !registeredScenarios.some(s => s.id === ch.id))
    .map(ch => ({ ...ch, campaignId: 'theInnsmouthConspiracy' })), ...eoteScenarioEntries]
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
    const guide = { id: scenario.id, campaignId: scenario.campaignId, sourceKind: 'bundled-reference-with-self-translated-supplements', officialChinese: false, locales: {} }
    for (const language of ['zh', 'en']) {
      const root = documents[scenario.id].en
      const zhRoot = documents[scenario.id].zh
      const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
      function blocks(path, original, localized) {
        const value = translated(scenario.id, path, language)
        // Some Chinese entries are complete HTML strings where English uses an object.
        if (typeof value === 'string') {
          const text = guideText(value, language)
          if (!text) return []
          const prose = text.replace(/\[[a-z_]+\]/g, '')
          if (language === 'zh' && ((/[a-z]{5}/i.test(prose) && !/[\u3400-\u9fff]/.test(prose))
            || /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i.test(prose))) {
            missing.push({ path: `${scenario.id}.${path}`, text })
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

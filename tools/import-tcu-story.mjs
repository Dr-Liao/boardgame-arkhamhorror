// 从随仓库保存的中文剧情来源生成万象无终（The Circle Undone）叙事正文。
// 布置、路由、奖励与记录写入仍由规则引擎执行；本文件只产出可阅读的正文。
// 契约：develop/p9-contract.md §2；生成物：content/campaigns/theCircleUndone/story-text.js。
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/', import.meta.url)
const target = new URL('../content/campaigns/theCircleUndone/story-text.js', import.meta.url)

const SOURCE_LABEL = '参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone'
const GENERATED_BY = 'tools/import-tcu-story.mjs'
const FILE_HEADER = '// 由 tools/import-tcu-story.mjs 从随仓库保存的中文参考资源生成，运行时不读参考资源；只含已到达分支可展示的叙事正文。'

const SCENARIO_IDS = [
  'disappearanceAtTheTwilightEstate', 'theWitchingHour', 'atDeathsDoorstep', 'theSecretName',
  'theWagesOfSin', 'forTheGreaterGood', 'unionAndDisillusion', 'inTheClutchesOfChaos', 'beforeTheBlackThrone',
]
const SOURCE_PATHS = ['base.json', ...SCENARIO_IDS.map(id => `scenarios/${id}.json`)]

// 22 张大阿卡纳：顺序与 content/campaigns/theCircleUndone/tarot.js 的 PROLOGUE_TAROT_RESULTS 一致
// （生成器不 import 运行时模块：tarot.js 运行时会反过来读 story-text.js，构建期必须保持单向依赖）。
const TAROT_KEYS = [
  'TheFool0', 'TheMagicianI', 'TheHighPriestessII', 'TheEmpressIII', 'TheEmperorIV', 'TheHierophantV',
  'TheLoversVI', 'TheChariotVII', 'StrengthVIII', 'TheHermitIX', 'WheelOfFortuneX', 'JusticeXI',
  'TheHangedManXII', 'DeathXIII', 'TemperanceXIV', 'TheDevilXV', 'TheTowerXVI', 'TheStarXVII',
  'TheMoonXVIII', 'TheSunXIX', 'JudgementXX', 'TheWorldXXI',
]

// 序章 4 位故事调查员：卡号与中文名对照 content/campaigns/theCircleUndone/scenarios/
// disappearanceAtTheTwilightEstate/definition.js 的 STORY_INVESTIGATOR_SETUP。
const STORY_INVESTIGATORS = [
  { code: '05046', source: 'gavriellaIntro', name: '加弗瑞拉·米兹拉克' },
  { code: '05047', source: 'jeromeIntro', name: '杰罗姆·戴维斯' },
  { code: '05048', source: 'valentinoIntro', name: '瓦伦蒂诺·里瓦斯' },
  { code: '05049', source: 'pennyIntro', name: '佩妮·怀特' },
]

// §2.4 resolutions 键映射：本仓库键 ← 来源键。
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index)
const sameName = numbers => numbers.map(value => ({ key: `resolution${value}`, source: `resolution${value}` }))
const rName = numbers => numbers.map(value => ({ key: `r${value}`, source: `resolution${value}` }))

const RESOLUTION_MAPS = [
  {
    id: 'disappearanceAtTheTwilightEstate',
    entries: [{ key: 'noResolution', source: 'noResolution' }],
  },
  {
    id: 'theWitchingHour',
    entries: [{ key: 'noResolution', source: 'noResolution' }, ...sameName(range(1, 5))],
  },
  {
    id: 'atDeathsDoorstep',
    entries: [{ key: 'noResolution', source: 'noResolution' }, ...rName(range(1, 3))],
  },
  {
    id: 'theSecretName',
    entries: [{ key: 'noResolution', source: 'noResolution' }, ...sameName(range(1, 2))],
  },
  { id: 'theWagesOfSin', entries: [{ key: 'noResolution', source: 'noResolution' }, ...rName(range(1, 3))] },
  { id: 'forTheGreaterGood', entries: [{ key: 'noResolution', source: 'noResolution' }, ...rName(range(1, 3))] },
  {
    id: 'unionAndDisillusion',
    entries: [
      { key: 'noResolution', source: 'noResolution' },
      ...rName(range(1, 4)),
      {
        key: 'r5',
        source: 'resolution5',
        fallback: '来源只有 basic 分支指针，回退为 fullText 可读规则摘要（契约 §2.5）。',
      },
      ...rName(range(6, 10)),
    ],
  },
  { id: 'inTheClutchesOfChaos', entries: [{ key: 'noResolution', source: 'noResolution' }, ...rName(range(1, 4))] },
  {
    id: 'beforeTheBlackThrone',
    entries: [
      {
        key: 'noResolution',
        source: 'investigatorDefeat',
        fallback: '来源没有 noResolution 键，回退为 investigatorDefeat 的可读正文（契约 §2.5）。',
      },
      ...rName(range(1, 6)),
    ],
  },
]

// §2.6 战役结局映射：endingId ← 来源（章 / 本仓库 resolution 键）。
const ENDING_MAPS = [
  { id: 'azathothDevouredTheUniverse', chapterId: 'beforeTheBlackThrone', resolution: 'r1' },
  { id: 'joinedThePipers', chapterId: 'beforeTheBlackThrone', resolution: 'r2' },
  { id: 'signedTheBlackBook', chapterId: 'beforeTheBlackThrone', resolution: 'r5' },
  { id: 'reversedTheIncantation', chapterId: 'beforeTheBlackThrone', resolution: 'r6' },
  { id: 'azathothSlumbersForNow', chapterId: 'beforeTheBlackThrone', resolution: 'r3' },
  { id: 'covenHoldsTheWorld', chapterId: 'unionAndDisillusion', resolution: 'r9' },
  { id: 'lodgeHoldsTheWorld', chapterId: 'unionAndDisillusion', resolution: 'r2' },
  { id: 'neverSeenOrHeardFromAgain', chapterId: 'atDeathsDoorstep', resolution: 'r3' },
]

// 幕间二/三/四的标签键（§2.2）；幕间一的标题在 atDeathsDoorstep.interlude1 上。
const INTERLUDE_TWO_LABELS = ['refuse', 'agree', 'lie']
const INTERLUDE_THREE_LABELS = [
  'truth', 'lie', 'whatIsTheCreature', 'whatDoYouWantWithTheCreature', 'whatDoTheWitchesWantWithTheCreature',
  'didYouKnowAboutTheCreature', 'whereAreTheFourMissingPeople', 'whyAreYouLookingAtMeLikeThat',
]
const INTERLUDE_TWO_SECTIONS = range(1, 9).map(value => `thePriceOfProgress${value}`).concat('youAreBeingHunted')
const INTERLUDE_THREE_SECTIONS = [
  ...range(1, 6).map(value => `theInnerCircle${value}`),
  'whatIsTheCreature', 'whatDoYouWantWithTheCreature', 'whatDoTheWitchesWantWithTheCreature',
  'didYouKnowAboutTheCreature', 'didYouKnowAboutTheCreatureBeforeTheCharityGala',
  'whereAreTheFourMissingPeopleFromTheCharityGala', 'whyAreYouLookingAtMeLikeThat',
]
const EPILOGUE_SECTIONS = [
  'arrestedAnette', 'assumedControlOfTheLodge', 'survivedTheWatchersEmbrace', 'signedTheBlackBook', 'youAreBeingHunted',
]

// 叙事段落的最小可读长度（契约 §2.3：resolutions 至少 1 段、总长 > 20 字符）。
const MIN_RESOLUTION_LENGTH = 20

// 章节 intro 里不属于正文的元数据键（§2.3），以及序章专属路由键。
const INTRO_SKIP_KEYS = new Set(['label', 'title', 'chooseInvestigator', 'returnToChoice', 'choose'])
const PROLOGUE_ROUTE_KEYS = new Set([...TAROT_KEYS, ...STORY_INVESTIGATORS.map(entry => entry.source)])
// 仅含 basic 规则指针、但契约 §3.3 明确要求保留（显示为进入设置前的最后一句）的段落组。
const INTRO_FULLTEXT_KEYS = new Set(['intro2Skip'])
// 参考实现把少量**卡面叙事**误标成 basic（报纸正文、邀请函正文、潜修者侧注），不是规则提示。
// 白名单键在清洗时保留非列表的 basic 段落；列表 ul/li、标题 h1../img 仍按 §2.3 丢弃。
// `theSecretName:intro3Mystic` 不在白名单：它的 basic 段是「如果…请阅读侧栏」的规则提示，
// 真正的叙事（绿色侧注）本来就未标 basic，默认规则已能导入。
const ALLOW_BASIC_KEYS = new Set(['atDeathsDoorstep:introPart1', 'atDeathsDoorstep:introPart3'])

// ---------------------------------------------------------------------------
// 清洗（契约 §2.3）
// ---------------------------------------------------------------------------

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" }

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
}

// 段落正文在下一个块级结构（列表 / 标题 / 图片等）处结束：
// 来源里存在未闭合的 `</p>` 与畸形列表，靠嵌套正则会把规则文字混进正文。
const BLOCK_END_RE = /<(?:ul|ol|li|h[1-6]|img|table|blockquote)\b/i

function cleanText(html) {
  return decodeEntities(String(html ?? ''))
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]\s*>/gi, ' ')
    .replace(/<ul\b[\s\S]*?<\/ul\s*>/gi, ' ')
    .replace(/<ol\b[\s\S]*?<\/ol\s*>/gi, ' ')
    .replace(/<li\b[\s\S]*?<\/li\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:section|div)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    // 去掉来源的成对强调标记（`_结局 1_`、`*如果……*`），与 TFA 导入文风一致。
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function paragraphTexts(html, { keepBasic }) {
  const source = String(html ?? '')
  if (!/<p\b/i.test(source)) {
    const single = cleanText(source)
    return single ? [single] : []
  }
  const paragraphs = []
  for (const chunk of source.split(/<p\b/i).slice(1)) {
    const end = chunk.indexOf('>')
    if (end < 0) continue
    const attrs = chunk.slice(0, end)
    if (!keepBasic && /\bbasic\b/i.test(attrs)) continue
    const body = chunk.slice(end + 1)
    const stop = body.search(BLOCK_END_RE)
    const text = cleanText(stop < 0 ? body : body.slice(0, stop))
    if (text) paragraphs.push(text)
  }
  return paragraphs
}

// 叙事段落：跳过 class 含 basic 的规则提示段。
export function narrativeParagraphs(html = '') {
  return paragraphTexts(html, { keepBasic: false })
}

// 保留 basic 段落（只用于 fallback 的可读规则摘要）。
export function fullText(html = '') {
  return paragraphTexts(html, { keepBasic: true })
}

// 标签文案：原样保留，仅去掉首尾成对引号。
function labelText(value) {
  const text = decodeEntities(String(value ?? '')).trim()
  const paired = text.match(/^["“]([\s\S]*)["”]$/)
  return paired ? paired[1].trim() : text
}

function labelsFor(labelObject, keys) {
  const labels = {}
  for (const key of keys) {
    if (typeof labelObject?.[key] !== 'string') throw new Error(`来源缺少标签：${key}`)
    labels[key] = labelText(labelObject[key])
  }
  return labels
}

function resolutionBody(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof value.body === 'string') return value.body
  return ''
}

// fallback 摘要：来源对象里的正文与分支指针拼成一段可读规则摘要（去掉 title 与空值）。
function readableResolutionSummary(value) {
  if (typeof value === 'string') return fullText(value)
  if (!value || typeof value !== 'object') return []
  const html = Object.entries(value)
    .filter(([key]) => key !== 'title')
    .map(([, entry]) => (typeof entry === 'string' ? entry : ''))
    .filter(Boolean)
    .join(' ')
  return fullText(html)
}

// ---------------------------------------------------------------------------
// 读取来源
// ---------------------------------------------------------------------------

const loaded = new Map()
for (const path of SOURCE_PATHS) {
  const raw = await readFile(new URL(path, sourceRoot))
  loaded.set(path, {
    sha256: createHash('sha256').update(raw).digest('hex'),
    json: JSON.parse(raw.toString('utf8')),
  })
}
const sourceHashes = SOURCE_PATHS.map(path => ({ path, sha256: loaded.get(path).sha256 }))
const base = loaded.get('base.json').json
const scenarios = Object.fromEntries(SCENARIO_IDS.map(id => [id, loaded.get(`scenarios/${id}.json`).json]))
const disappearance = scenarios.disappearanceAtTheTwilightEstate

const requireParagraphs = (paragraphs, where) => {
  if (!paragraphs.length) throw new Error(`来源清洗后为空：${where}`)
  return paragraphs
}

// ---------------------------------------------------------------------------
// 序章：标题 + 正文（disappearance 的 body/intro）+ 4 位故事调查员引言 + 22 条塔罗结果
// ---------------------------------------------------------------------------

const prologueBody = requireParagraphs(narrativeParagraphs(disappearance.intro.body), 'prologue.body')
const prologueIntro = requireParagraphs(narrativeParagraphs(disappearance.intro.intro), 'prologue.intro')
// 战役书的引文（base.prologue.body，洛夫克拉夫特《女巫屋中的梦》）：P9 契约补充 §2.3，
// prologue 节点正文优先用它；缺失时调用方退回 sections.body。
const prologueQuote = requireParagraphs(narrativeParagraphs(base.prologue.body), 'prologue.quote')

const tarotResults = {}
TAROT_KEYS.forEach((key, arcana) => {
  const text = disappearance.intro[key]
  if (typeof text !== 'string' || !text.trim()) throw new Error(`序章塔罗结果缺失：${key}`)
  if (!text.includes('{name}')) throw new Error(`序章塔罗结果缺少 {name} 占位：${key}`)
  tarotResults[key] = { arcana, text: text.trim() }
})

const storyInvestigatorIntros = {}
for (const entry of STORY_INVESTIGATORS) {
  const paragraphs = requireParagraphs(
    narrativeParagraphs(disappearance.intro[entry.source]), `prologue.storyInvestigatorIntros.${entry.source}`)
  storyInvestigatorIntros[entry.code] = { title: `${entry.name}的引言`, paragraphs }
}

// ---------------------------------------------------------------------------
// 9 章导入正文
// ---------------------------------------------------------------------------

function introSections(intro, chapterId) {
  if (!intro || typeof intro !== 'object') throw new Error(`来源缺少 intro：${chapterId}`)
  const sections = {}
  for (const [key, value] of Object.entries(intro)) {
    if (INTRO_SKIP_KEYS.has(key)) continue
    if (chapterId === 'disappearanceAtTheTwilightEstate' && PROLOGUE_ROUTE_KEYS.has(key)) continue
    if (typeof value === 'string') {
      const allowBasic = ALLOW_BASIC_KEYS.has(`${chapterId}:${key}`)
      let paragraphs = allowBasic ? fullText(value) : narrativeParagraphs(value)
      if (!paragraphs.length && INTRO_FULLTEXT_KEYS.has(key)) paragraphs = fullText(value)
      if (!paragraphs.length) continue
      sections[key] = paragraphs
      continue
    }
    if (value && typeof value === 'object') {
      // 嵌套对象（如 label）属元数据；当前来源没有需要展开的叙事对象。
      continue
    }
  }
  if (!Object.keys(sections).length) throw new Error(`章节 intro 清洗后为空：${chapterId}`)
  return sections
}

const introductions = Object.fromEntries(SCENARIO_IDS.map(id => {
  const intro = scenarios[id].intro
  const title = typeof intro?.title === 'string' ? intro.title : id
  return [id, { title, sections: introSections(intro, id) }]
}))

// ---------------------------------------------------------------------------
// 9 章 resolutions（§2.4 键映射 + §2.5 fallback）
// ---------------------------------------------------------------------------

const fallbacks = []
const resolutions = {}
for (const { id, entries } of RESOLUTION_MAPS) {
  const source = scenarios[id].resolutions
  if (!source || typeof source !== 'object') throw new Error(`来源缺少 resolutions：${id}`)
  const mapped = {}
  for (const entry of entries) {
    const value = source[entry.source]
    if (value === undefined) throw new Error(`来源缺少 resolution：${id}/${entry.source}`)
    let paragraphs = narrativeParagraphs(resolutionBody(value))
    let reason = entry.fallback || null
    if (!reason && !paragraphs.length) {
      reason = '来源正文清洗后为空（只有 basic 规则段落），回退为 fullText 可读摘要（契约 §2.5）。'
    } else if (!reason && paragraphs.join('').length <= MIN_RESOLUTION_LENGTH) {
      reason = '来源正文清洗后过短（不超过 20 字符），回退为 fullText 可读摘要（契约 §2.5）。'
    }
    if (reason) {
      const summary = readableResolutionSummary(value)
      if (!summary.length) throw new Error(`回退后仍无可读正文：${id}/${entry.key}`)
      paragraphs = summary
      fallbacks.push({ id: `${id}/${entry.key}`, reason })
    }
    mapped[entry.key] = paragraphs
  }
  resolutions[id] = mapped
}

// ---------------------------------------------------------------------------
// 4 段幕间
// ---------------------------------------------------------------------------

const deathsDoorstep = scenarios.atDeathsDoorstep
const interludeOneSource = deathsDoorstep.interlude1
const interludeOneSections = {
  instructions: requireParagraphs(fullText(interludeOneSource.instructions), 'interludeOne.instructions'),
}
for (const person of ['gavriella', 'jerome', 'penny', 'valentino']) {
  interludeOneSections[person] = requireParagraphs(
    narrativeParagraphs(interludeOneSource[person]), `interludeOne.${person}`)
}

const interludeTwoSections = {}
for (const key of INTERLUDE_TWO_SECTIONS) {
  interludeTwoSections[key] = requireParagraphs(narrativeParagraphs(base.interlude2[key]), `interludeTwo.${key}`)
}

const interludeThreeSections = {}
for (const key of INTERLUDE_THREE_SECTIONS) {
  interludeThreeSections[key] = requireParagraphs(narrativeParagraphs(base.interlude3[key]), `interludeThree.${key}`)
}

const interludeFourSections = {}
for (const key of ['twistOfFate1', 'twistOfFate2']) {
  interludeFourSections[key] = requireParagraphs(narrativeParagraphs(base.interlude4[key]), `interludeFour.${key}`)
}

const interludes = {
  interludeOne: { title: interludeOneSource.title, sections: interludeOneSections },
  interludeTwo: {
    title: base.interlude2.title,
    labels: labelsFor(base.interlude2.label, INTERLUDE_TWO_LABELS),
    sections: interludeTwoSections,
  },
  interludeThree: {
    title: base.interlude3.title,
    labels: labelsFor(base.interlude3.label, INTERLUDE_THREE_LABELS),
    sections: interludeThreeSections,
  },
  interludeFour: { title: base.interlude4.title, sections: interludeFourSections },
}

// ---------------------------------------------------------------------------
// 尾声
// ---------------------------------------------------------------------------

const epilogueSections = {}
for (const key of EPILOGUE_SECTIONS) {
  epilogueSections[key] = requireParagraphs(narrativeParagraphs(base.epilogue[key]), `epilogue.${key}`)
}
const epilogue = { title: base.epilogue.title, sections: epilogueSections }

// ---------------------------------------------------------------------------
// 8 个战役结局（§2.6）
// ---------------------------------------------------------------------------

const endings = {}
for (const { id, chapterId, resolution } of ENDING_MAPS) {
  const ours = resolutions[chapterId][resolution]
  const sourceKey = RESOLUTION_MAPS.find(entry => entry.id === chapterId)
    ?.entries.find(entry => entry.key === resolution)?.source
  const value = scenarios[chapterId].resolutions[sourceKey]
  if (value === undefined) throw new Error(`结局来源缺失：${id}（${chapterId}/${resolution}）`)
  const title = typeof value?.title === 'string' && value.title.trim() ? value.title.trim() : resolution
  let paragraphs = narrativeParagraphs(resolutionBody(value))
  if (!paragraphs.length || !paragraphs.join('').trim()) {
    const summary = readableResolutionSummary(value)
    if (!summary.length) throw new Error(`结局没有可读正文：${id}`)
    paragraphs = summary
    fallbacks.push({ id: `endings/${id}`, reason: '结局来源正文清洗后为空，回退为 fullText 可读摘要（契约 §2.6）。' })
  }
  if (!ours) throw new Error(`结局对应的 resolution 缺失：${id}`)
  endings[id] = { title, paragraphs, source: { chapterId, resolution } }
}

// ---------------------------------------------------------------------------
// 生成物数据
// ---------------------------------------------------------------------------

const story = {
  source: SOURCE_LABEL,
  generatedBy: GENERATED_BY,
  sourceHashes,
  prologue: {
    title: base.prologue.title,
    sections: { body: prologueBody, intro: prologueIntro, quote: prologueQuote },
    storyInvestigatorIntros,
    tarotResults,
  },
  introductions,
  resolutions,
  interludes,
  epilogue,
  endings,
  fallbacks,
}

// ---------------------------------------------------------------------------
// 自检（契约 §2.7 验收；不通过就直接抛错，不写文件）
// ---------------------------------------------------------------------------

const HTML_TAG_RE = /<[a-z!/]/i
const ENTITY_RE = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i

function walkStrings(value, path, visit) {
  if (typeof value === 'string') return visit(value, path)
  if (Array.isArray(value)) return value.forEach((entry, index) => walkStrings(entry, `${path}[${index}]`, visit))
  if (value && typeof value === 'object') {
    return Object.entries(value).forEach(([key, entry]) => walkStrings(entry, `${path}.${key}`, visit))
  }
  return undefined
}

function validate(storyObject) {
  const expectedChapterIds = SCENARIO_IDS
  const actualChapterIds = Object.keys(storyObject.introductions)
  if (actualChapterIds.length !== expectedChapterIds.length
    || expectedChapterIds.some(id => !actualChapterIds.includes(id))) {
    throw new Error(`导入章节不齐：${actualChapterIds.join(',')}`)
  }
  for (const id of expectedChapterIds) {
    const chapter = storyObject.introductions[id]
    if (!chapter.title?.trim()) throw new Error(`章节标题为空：${id}`)
    if (!Object.keys(chapter.sections).length) throw new Error(`章节导入正文为空：${id}`)
    const expectedKeys = RESOLUTION_MAPS.find(entry => entry.id === id).entries.map(entry => entry.key)
    const actualKeys = Object.keys(storyObject.resolutions[id] || {})
    if (expectedKeys.length !== actualKeys.length || expectedKeys.some(key => !actualKeys.includes(key))) {
      throw new Error(`resolutions 键与契约 §2.4 不一致：${id}（${actualKeys.join(',')}）`)
    }
  }
  if (!storyObject.prologue.title?.trim()) throw new Error('序章标题为空')
  for (const key of ['body', 'intro', 'quote']) {
    if (!storyObject.prologue.sections[key]?.length) throw new Error(`序章段落组为空：${key}`)
  }
  if (Object.keys(storyObject.prologue.tarotResults).length !== 22) throw new Error('序章塔罗结果必须 22 条')
  Object.entries(storyObject.prologue.tarotResults).forEach(([key, entry], arcana) => {
    if (entry.arcana !== arcana) throw new Error(`塔罗 arcana 顺序错误：${key}`)
  })
  if (Object.keys(storyObject.prologue.storyInvestigatorIntros).length !== 4) throw new Error('序章故事调查员引言必须 4 位')
  if (Object.keys(storyObject.interludes).length !== 4) throw new Error('幕间必须 4 段')
  for (const [key, interlude] of Object.entries(storyObject.interludes)) {
    if (!interlude.title?.trim()) throw new Error(`幕间标题为空：${key}`)
    if (!Object.keys(interlude.sections).length) throw new Error(`幕间正文为空：${key}`)
  }
  for (const key of ['instructions', 'gavriella', 'jerome', 'penny', 'valentino']) {
    if (!storyObject.interludes.interludeOne.sections[key]?.length) throw new Error(`幕间一缺少段落：${key}`)
  }
  for (const key of INTERLUDE_TWO_LABELS) {
    if (!storyObject.interludes.interludeTwo.labels[key]?.trim()) throw new Error(`幕间二标签为空：${key}`)
  }
  for (const key of INTERLUDE_THREE_LABELS) {
    if (!storyObject.interludes.interludeThree.labels[key]?.trim()) throw new Error(`幕间三标签为空：${key}`)
  }
  if (!storyObject.epilogue.title?.trim()) throw new Error('尾声标题为空')
  for (const key of EPILOGUE_SECTIONS) {
    if (!storyObject.epilogue.sections[key]?.length) throw new Error(`尾声缺少段落：${key}`)
  }
  if (Object.keys(storyObject.endings).length !== 8) throw new Error('战役结局必须 8 个')
  for (const { id } of ENDING_MAPS) {
    const ending = storyObject.endings[id]
    if (!ending?.title?.trim()) throw new Error(`结局标题为空：${id}`)
    if (!ending.paragraphs.length) throw new Error(`结局正文为空：${id}`)
    if (!ending.source?.chapterId || !ending.source?.resolution) throw new Error(`结局来源缺失：${id}`)
  }
  const fallbackIds = storyObject.fallbacks.map(entry => entry.id)
  for (const entry of storyObject.fallbacks) {
    if (!entry.id?.trim() || !entry.reason?.trim()) throw new Error(`fallback 形状错误：${JSON.stringify(entry)}`)
  }
  for (const { id, entries } of RESOLUTION_MAPS) {
    for (const entry of entries) {
      const paragraphs = storyObject.resolutions[id][entry.key]
      if (!paragraphs.length) throw new Error(`resolution 段落为空：${id}/${entry.key}`)
      if (paragraphs.join('').length <= MIN_RESOLUTION_LENGTH) {
        throw new Error(`resolution 仍过短：${id}/${entry.key}`)
      }
    }
  }
  for (const mandated of ['unionAndDisillusion/r5', 'beforeTheBlackThrone/noResolution']) {
    if (!fallbackIds.includes(mandated)) throw new Error(`缺少契约 §2.5 的 fallback：${mandated}`)
  }
  const seenFallbacks = new Set()
  for (const entry of storyObject.fallbacks) {
    if (seenFallbacks.has(entry.id)) throw new Error(`fallback 重复：${entry.id}`)
    seenFallbacks.add(entry.id)
  }
  walkStrings(storyObject, 'TCU_STORY_TEXT', (text, path) => {
    if (!text.trim()) throw new Error(`存在空字符串：${path}`)
    if (text.includes('undefined')) throw new Error(`存在 undefined：${path}`)
    if (HTML_TAG_RE.test(text)) throw new Error(`存在 HTML 标签：${path}`)
    if (ENTITY_RE.test(text)) throw new Error(`存在 HTML 实体：${path}`)
    if (text.includes('setImgPath')) throw new Error(`存在 setImgPath：${path}`)
  })
  return storyObject
}

validate(story)

// ---------------------------------------------------------------------------
// 生成物（纯数据 + 两个函数，import 时不读文件、不 import 仓库内模块）
// ---------------------------------------------------------------------------

const dataLiteral = JSON.stringify(story, null, 2)

const renderFn = `function renderStoryText() {
  return ${JSON.stringify(FILE_HEADER)} + '\\n'
    + 'export const TCU_STORY_TEXT = ' + JSON.stringify(TCU_STORY_TEXT, null, 2) + '\\n'
    + '\\n' + 'export ' + renderStoryText.toString() + '\\n'
    + '\\n' + 'export ' + storyInventory.toString() + '\\n'
}`

const inventoryFn = `function storyInventory() {
  const chapterIds = Object.keys(TCU_STORY_TEXT.introductions)
  const introductionSections = chapterIds.reduce(
    (total, id) => total + Object.keys(TCU_STORY_TEXT.introductions[id].sections).length, 0)
  const resolutions = Object.values(TCU_STORY_TEXT.resolutions).reduce(
    (total, chapter) => total + Object.keys(chapter).length, 0)
  const interludeSections = Object.values(TCU_STORY_TEXT.interludes).reduce(
    (total, interlude) => total + Object.keys(interlude.sections).length, 0)
  const sections = Object.keys(TCU_STORY_TEXT.prologue.sections).length
    + introductionSections
    + interludeSections
    + Object.keys(TCU_STORY_TEXT.epilogue.sections).length
  return {
    chapters: chapterIds.length,
    introductions: chapterIds.length,
    introSections: introductionSections,
    resolutions,
    sections,
    tarotResults: Object.keys(TCU_STORY_TEXT.prologue.tarotResults).length,
    endings: Object.keys(TCU_STORY_TEXT.endings).length,
    interludes: Object.keys(TCU_STORY_TEXT.interludes).length,
    fallbacks: TCU_STORY_TEXT.fallbacks.length,
  }
}`

const output = `${FILE_HEADER}\n`
  + `export const TCU_STORY_TEXT = ${dataLiteral}\n`
  + '\n'
  + `export ${renderFn}\n`
  + '\n'
  + `export ${inventoryFn}\n`

// ---------------------------------------------------------------------------
// 工具导出（与 tools/import-tfa-story.mjs 同构）
// ---------------------------------------------------------------------------

export function renderStoryText() {
  return output
}

export function storyInventory() {
  const chapterIds = Object.keys(introductions)
  const introductionSections = chapterIds.reduce(
    (total, id) => total + Object.keys(introductions[id].sections).length, 0)
  const resolutionCount = Object.values(resolutions).reduce((total, chapter) => total + Object.keys(chapter).length, 0)
  const interludeSections = Object.values(interludes).reduce(
    (total, interlude) => total + Object.keys(interlude.sections).length, 0)
  const sectionCount = Object.keys(story.prologue.sections).length
    + introductionSections
    + interludeSections
    + Object.keys(epilogue.sections).length
  return {
    chapters: chapterIds.length,
    introductions: chapterIds.length,
    introSections: introductionSections,
    resolutions: resolutionCount,
    sections: sectionCount,
    tarotResults: Object.keys(tarotResults).length,
    endings: Object.keys(endings).length,
    interludes: Object.keys(interludes).length,
    fallbacks: fallbacks.length,
  }
}

const isMain = (process.argv[1] || '').replaceAll('\\', '/').endsWith('tools/import-tcu-story.mjs')
if (isMain) {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.some(arg => !['--write', '--check'].includes(arg))) {
    throw new Error('使用 --write 或 --check，且只能指定一种模式')
  }
  const mode = args[0]
  if (mode === '--write') await writeFile(target, output, 'utf8')
  else if (mode === '--check') {
    const current = await readFile(target, 'utf8')
    if (current !== output) throw new Error('万象无终剧情文本生成物已漂移，请审阅后更新')
  } else {
    process.stdout.write(output)
  }
  if (mode) {
    const inventory = storyInventory()
    console.log(`万象无终剧情：${inventory.chapters} 章、${inventory.resolutions} 个结局分支、`
      + `${inventory.tarotResults} 条塔罗结果、${inventory.interludes} 段幕间、${inventory.endings} 个结局、`
      + `${inventory.fallbacks} 条回退`)
  }
}

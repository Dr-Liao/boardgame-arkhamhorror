// 《沉没之城》（The Drowned City，十循环）· 战役共享常量（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheDrownedCity/CampaignSteps.hs`（10 个 ScenarioStep 卡号）；
//   · `Campaigns/TheDrownedCity/ChaosBag.hs#chaosBagContents`（四档初始混乱袋）；
//   · `Campaigns/TheDrownedCity/Key.hs`（Campaign Log 键，见 records.js）；
//   · `audit/tdc-scope.json`（分区：shared 54 / scenarios 231 / references 10 / player …）；
//   · 本地卡表 `src/cards/cards-data.js`（包 `tdcc` = 战役包，`tdcp` = 玩家卡包）。
//
// 本文件只放常量与只读辅助：不写卡、不注册效果、不 import 引擎读点。
// 叙事正文的读取桥（`tdcStoryText`）也在这里：叙事文件由 narrative-guides worker 生成
// （`story-text.js`，可能晚于本文件落盘），因此**不静态 import**，而是非阻塞动态预载 +
// 缺失时安全回退空串（见 §4）。流程层只保存 `titleKey`/`textKeys`/`labelKey`，预载完成后由
// `flow.js#refreshTdcFlowText()` 把正文填进节点（与 FHV 的 textKey 口径一致）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theDrownedCity'
export const CAMPAIGN_NAME = '沉没之城'
export const CAMPAIGN_NAME_EN = 'The Drowned City'
// 参考编号（CampaignId "11"）。
export const REFERENCE_CAMPAIGN_ID = '11'

export const catalogMetadata = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
})

// ---------------------------------------------------------------------------
// 1. 初始混乱袋（ChaosBag.hs#chaosBagContents，四档逐枚镜像）
// ---------------------------------------------------------------------------
// 标记名与引擎同源小写（`src/engine/chaos-bag.js` / `src/engine/tests.js`）：
// `autofail` / `eldersign` / `elderthing`（注意不是 `autofail` 的驼峰写法）。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
    'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

// 混乱袋里属于「符号族」的标记（Interlude III 的替换对象）。
export const SYMBOL_TOKENS = Object.freeze(['cultist', 'tablet', 'elderthing'])

// ---------------------------------------------------------------------------
// 2. 10 个场景步（顺序 = CampaignSteps.hs = manifest.scenarioIds）
// ---------------------------------------------------------------------------
// `stepCode` 是印刷提示卡/参考卡号；`group` 是专属遭遇组（snake_case，卡表 encounterCode）；
// `referenceCodes` 是剧本桌面实际使用的参考卡（一般都等于 stepCode）。
export const chapters = Object.freeze([
  Object.freeze({ id: 'oneLastJob', stepCode: '11501', referenceCodes: Object.freeze(['11501']), group: 'one_last_job', source: 'OneLastJob', name: '金盆洗手', nameEn: 'One Last Job', kind: 'scenario' }),
  Object.freeze({ id: 'theWesternWall', stepCode: '11517', referenceCodes: Object.freeze(['11517']), group: 'the_western_wall', source: 'TheWesternWall', name: '西墙', nameEn: 'The Western Wall', kind: 'scenario' }),
  Object.freeze({ id: 'theDrownedQuarter', stepCode: '11536', referenceCodes: Object.freeze(['11536']), group: 'the_drowned_quarter', source: 'TheDrownedQuarter', name: '淹没城区', nameEn: 'The Drowned Quarter', kind: 'scenario' }),
  Object.freeze({ id: 'theApiary', stepCode: '11553', referenceCodes: Object.freeze(['11553']), group: 'the_apiary', source: 'TheApiary', name: '养育场', nameEn: 'The Apiary', kind: 'scenario' }),
  Object.freeze({ id: 'theGrandVault', stepCode: '11587', referenceCodes: Object.freeze(['11587']), group: 'the_grand_vault', source: 'TheGrandVault', name: '大秘库', nameEn: 'The Grand Vault', kind: 'scenario' }),
  Object.freeze({ id: 'courtOfTheAncients', stepCode: '11612', referenceCodes: Object.freeze(['11612']), group: 'court_of_the_ancients', source: 'CourtOfTheAncients', name: '古代议庭', nameEn: 'Court of the Ancients', kind: 'scenario' }),
  Object.freeze({ id: 'obsidianCanyons', stepCode: '11639', referenceCodes: Object.freeze(['11639']), group: 'obsidian_canyons', source: 'ObsidianCanyons', name: '黑曜石峡谷', nameEn: 'Obsidian Canyons', kind: 'scenario' }),
  Object.freeze({ id: 'sepulchreOfTheSleeper', stepCode: '11673', referenceCodes: Object.freeze(['11673']), group: 'sepulchre_of_the_sleeper', source: 'SepulchreOfTheSleeper', name: '沉睡者墓穴', nameEn: 'Sepulchre of the Sleeper', kind: 'scenario' }),
  Object.freeze({ id: 'theDoomOfArkhamPartI', stepCode: '11682', referenceCodes: Object.freeze(['11682']), group: 'the_doom_of_arkham_part_1', source: 'TheDoomOfArkhamPartI', name: '阿卡姆的毁灭 第一部分', nameEn: 'The Doom of Arkham, Part I', kind: 'scenario' }),
  Object.freeze({ id: 'theDoomOfArkhamPartII', stepCode: '11688a', referenceCodes: Object.freeze(['11688a']), group: 'the_doom_of_arkham_part_2', source: 'TheDoomOfArkhamPartII', name: '阿卡姆的毁灭 第二部分', nameEn: 'The Doom of Arkham, Part II', kind: 'scenario' }),
])

export const SCENARIO_IDS = Object.freeze(chapters.map(chapter => chapter.id))
export function chapterOf (id) { return chapters.find(chapter => chapter.id === id) || null }

// ---------------------------------------------------------------------------
// 3. 卡包分区与遭遇组
// ---------------------------------------------------------------------------
// `tdcc` 是战役包（295 张：15 组共享遭遇 54、10 章专属 231、提示/剧情参考 10…），
// `tdcp` 是玩家卡包（调查员 / 玩家卡 / 基础弱点，130 张）。分区按卡表 `pack` 字段切分，
// 避免在内容层手抄卡号清单。
const packCodes = pack => Object.values(ALL_CARDS)
  .filter(card => card.pack === pack)
  .map(card => card.code)
  .sort()
export const partitions = Object.freeze({
  tdcCampaign: Object.freeze(packCodes('tdcc')),
  tdcPlayer: Object.freeze(packCodes('tdcp')),
})

/** snake_case 遭遇组 → camelCase 组 id（与 `chapter-inventory.json` / 测试口径一致）。 */
export const encounterGroupId = group => String(group || '')
  .replace(/_([a-z0-9])/g, (_, character) => character.toUpperCase())

const campaignCards = partitions.tdcCampaign
const groupByEncounterCode = {}
for (const code of campaignCards) {
  const group = ALL_CARDS[code].encounterCode
  if (!group) continue
  ;(groupByEncounterCode[group] ||= []).push(code)
}
export const encounterGroups = Object.freeze(Object.fromEntries(
  Object.entries(groupByEncounterCode)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, codes]) => [group, Object.freeze(codes)])))

/** 全部遭遇组 id（camelCase；专属组 + 共享组）。 */
export const ENCOUNTER_GROUP_IDS = Object.freeze(Object.keys(encounterGroups).map(encounterGroupId).sort())

/** 10 章专属组 id（`chapters[].group` → camelCase）。 */
export const CHAPTER_ENCOUNTER_GROUP_IDS = Object.freeze(
  chapters.map(chapter => encounterGroupId(chapter.group)))

/** 跨章复用的共享组 id（15 组中的 13 个战役专属共享组，外加外部复用组由章节声明）。 */
export const SHARED_ENCOUNTER_GROUP_IDS = Object.freeze(
  ENCOUNTER_GROUP_IDS.filter(group => !CHAPTER_ENCOUNTER_GROUP_IDS.includes(group)))

/** 本循环全部战役包卡号（顺序稳定；供关键词复算/审计逐张比对）。 */
export const CYCLE_CODES = Object.freeze([
  ...partitions.tdcCampaign, ...partitions.tdcPlayer,
].sort())

/** 各章参考卡（去重）：10 个 ScenarioStep 的提示卡。 */
export const SCENARIO_REFERENCE_CODES = Object.freeze(
  [...new Set(chapters.flatMap(chapter => chapter.referenceCodes))].sort())

// ---------------------------------------------------------------------------
// 4. 叙事正文读取桥（story-text.js 由 narrative-guides worker 生成）
// ---------------------------------------------------------------------------
// 形状（见 CONTRACT §5）：`TDC_STORY_TEXT = { campaign: {...}, chapters: { <chapterId>: {...} } }`，
// 每个作用域带 `{ sections?, sectionsEn?, en?, zh? }`（FHV story-text 同口径）。
// 流程节点的正文键语法：
//   · `campaign::<path>` 或裸 `<path>`：从 `${TDC_STORY_TEXT.campaign}` 读（base.json / interludes.json）；
//   · `<chapterId>::<path>`：从 `${TDC_STORY_TEXT.chapters[chapterId]}` 读（该章 locale JSON 的根）。
const storyState = { text: null, loaded: false, promise: null }

function storyFromModule (module) {
  if (!module || typeof module !== 'object') return null
  return module.TDC_STORY_TEXT || module.TDC_STORY || null
}

/**
 * 非阻塞预载叙事数据（story-text.js / story-access.js 可能尚未落盘：都按可选处理）。
 * 返回 Promise<{ text, access }>；调用方可 await，也可完全不 await（模块加载时已自动触发一次）。
 */
export function preloadTdcStory () {
  if (!storyState.promise) {
    storyState.promise = (async () => {
      let text = null
      let access = null
      try {
        const module = await import('./story-text.js')
        text = storyFromModule(module)
      } catch { /* 叙事文件尚未生成本轮内容：保持空文本，不阻塞任何加载 */ }
      if (!text) {
        try {
          const module = await import('./story-access.js')
          access = module
          text = storyFromModule(module)
        } catch { /* 同上 */ }
      }
      storyState.text = text
      storyState.loaded = true
      return { text, access }
    })()
  }
  return storyState.promise
}

/** 叙事数据是否已预载完成（大厅/测试用；不参与引擎读点）。 */
export function tdcStoryReady () {
  return storyState.loaded
}

/** 作用域容器 → `{ sections, sectionsEn }`（兼容裸对象与 FHV 的 sections 视图）。 */
function storyScopeContainer (scope) {
  const story = storyState.text
  if (!story) return null
  if (!['campaign', 'interludes'].includes(scope) && !story.chapters?.[scope]) return null
  const container = scope === 'interludes' ? story.interludes
    : scope === 'campaign' ? story.campaign
      : story.chapters[scope]
  if (!container || typeof container !== 'object') return null
  const sections = container.sections && typeof container.sections === 'object' ? container.sections : null
  const sectionsEn = container.sectionsEn && typeof container.sectionsEn === 'object' ? container.sectionsEn : null
  return { container, sections, sectionsEn }
}

/** 在裸对象里按点路径取值（story-text 直接保存嵌套 JSON 时的回退）。 */
function nestedValue (root, path) {
  let current = root
  for (const segment of String(path).split('.')) {
    if (!current || typeof current !== 'object') return null
    current = current[segment]
  }
  return current
}

function readStoryScope (scope, path) {
  const view = storyScopeContainer(scope)
  if (!view) return ''
  const fromSections = view.sections?.[path] ?? view.sectionsEn?.[path]
  const value = fromSections ?? nestedValue(view.container, path)
  return htmlToText(value)
}

/**
 * 读取战役/幕间/章节叙事叶子（缺键/未预载/未翻译都返回空串，调用方用字体键或 id 兜底）。
 * `key` 支持 `<scope>::<path>` 前缀；scope = `campaign` / `interludes` / 章节 id。
 * 没有前缀时先读 `campaign`（base.json：序章 / Campaign Log 键），再读 `interludes`
 * （interludes.json：Interlude I–IV、终章导入、尾声）——narrative-guides 的 story-text 把这两份
 * 文献平铺成两个同级作用域。
 */
export function tdcStoryText (key) {
  if (typeof key !== 'string' || !key) return ''
  let scope = null
  let path = key
  const separator = key.indexOf('::')
  if (separator > 0) {
    scope = key.slice(0, separator)
    path = key.slice(separator + 2)
    return readStoryScope(scope, path)
  }
  return readStoryScope('campaign', path) || readStoryScope('interludes', path)
}

/** 小标题（`<scope>::<path>.title` 缺省时回退 `<path>` 本体）。 */
export function tdcStoryHeading (key) {
  if (typeof key !== 'string' || !key) return ''
  return tdcStoryText(key) || tdcStoryText(`${key}.title`)
}

/** 选项标签（与正文同源；缺键返回空串，流程层用中文兜底标签）。 */
export function tdcStoryLabel (key) {
  return tdcStoryText(key)
}

/** 叙事正文是带 HTML 的 locale 文本：按 FHV records.js 的口径转纯文本。 */
export function htmlToText (value) {
  if (value == null) return ''
  const source = typeof value === 'string' ? value : flattenStoryValue(value)
  return String(source)
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 把 story-text 的嵌套结构（string / {title, body} / 数组 / 对象）摊平成展示字符串。 */
export function flattenStoryValue (value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flattenStoryValue).filter(Boolean).join('\n\n')
  if (!value || typeof value !== 'object') return ''
  const parts = []
  if (typeof value.title === 'string') parts.push(value.title)
  if (typeof value.body === 'string') parts.push(value.body)
  for (const [key, item] of Object.entries(value)) {
    if (key === 'title' || key === 'body') continue
    const text = flattenStoryValue(item)
    if (text) parts.push(text)
  }
  return parts.filter(Boolean).join('\n\n')
}

// 模块加载即触发一次预载（不阻塞；叙事文件缺失时静默回退）。`flow.js` 在预载完成后刷新节点正文。
void preloadTdcStory()

// ---------------------------------------------------------------------------
// 5. 只读展示辅助
// ---------------------------------------------------------------------------
/** 卡包图鉴清单（`content/packs/tdcCampaign/manifest.js` 同口径的卡片目录）。 */
export function catalogPack (id, label, typeFor) {
  const codes = partitions[id]
  const numeric = codes.filter(code => code.length === 5)
  const faces = codes.filter(code => code.length === 6)
  return Object.freeze({
    ...catalogMetadata,
    id,
    name: `${CAMPAIGN_NAME} · ${label}`,
    dependencies: Object.freeze(['core']),
    cardRanges: [numeric, faces].filter(group => group.length)
      .map(group => Object.freeze({ from: group[0], to: group.at(-1) })),
    cards: Object.freeze(codes.map(code => {
      const card = ALL_CARDS[code]
      return Object.freeze({
        code,
        name: card.nameZh || card.name,
        type: typeFor(card),
        cataloged: true,
        imageAvailable: Boolean(card.imagesrc),
        rulesImplemented: false,
        deckbuilding: false,
      })
    })),
    encounterGroupIds: id === 'tdcCampaign' ? ENCOUNTER_GROUP_IDS : Object.freeze([]),
    behaviorIds: Object.freeze([]),
  })
}

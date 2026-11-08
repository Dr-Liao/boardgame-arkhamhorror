// 七循环《地球边缘》（Edge of the Earth）P7 剧情/指南生成物验收。
//
// 覆盖：
//   ① `tools/import-eote-story.mjs` → `content/campaigns/edgeOfTheEarth/story-text.js`
//      与 `story-access.js`：8 章 + 战役正文（序幕/检查点/幕间/尾声/特别规则/记录）、
//      篇章拆分、中文三态覆盖标记、来源锁、确定性/幂等、P0 scope 对齐；
//   ② `tools/import-scenario-guides.mjs` 扩展 → `web/scenario-guides/<章节id>.json`
//      （8 个《地球边缘》章节；来源 = story-text，缺译显式标记，不英文冒充中文）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  EOTE_STORY_KEYS, EOTE_STORY_META, EOTE_STORY_TEXT, eoteStoryChapter, eoteStoryInventory,
} from '../content/campaigns/edgeOfTheEarth/story-text.js'
import { chapters as eoteChapters } from '../content/campaigns/edgeOfTheEarth/shared.js'
import {
  campaignStory, chapterSection, chapterStory, flattenResolution, flattenStory, resolutionText,
  storyEntry, storyEntryText, storyParagraphs, storyParagraphsOf, storyText,
} from '../content/campaigns/edgeOfTheEarth/story-access.js'
import { buildGuides, buildRulesScan } from '../tools/eote-guide-scan.mjs'
import {
  EN_FILES, ZH_FILES, assemble, check, scopeAlignment, storyInventory,
} from '../tools/import-eote-story.mjs'
import { buildScenarioGuides } from '../tools/import-scenario-guides.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const readJson = relative => JSON.parse(readFileSync(`${ROOT}${relative}`, 'utf8'))
const CJK = /[\u3400-\u9fff]/
const SCENARIO_IDS = eoteChapters.map(chapter => chapter.id)
const GUIDE_FILES = SCENARIO_IDS.map(id => `web/scenario-guides/${id}.json`)
// 指南生成器跳过的 UI 数据键（与 tools/import-scenario-guides.mjs#skipped 同一集合）。
const SKIPPED_GUIDE_KEYS = new Set(['heading', 'tokens', 'label', 'tooltips', 'remembered', 'xp', 'ui', 'messages'])
const STATUSES = ['present-needs-review', 'untranslated', 'missing']
const CHAPTER_STATUSES = [...STATUSES, 'mixed']

// 生成指南（含全部 62 个已注册/迁移关卡）；顶部只跑一次，测试内复用。
const BUILT_GUIDES = await buildScenarioGuides()

/** 嵌套正文树 → 叶子数组 `[{ path, text }]`。 */
function leavesOf(tree, prefix = '', out = []) {
  if (typeof tree === 'string') { out.push({ path: prefix, text: tree }); return out }
  if (tree && typeof tree === 'object') {
    for (const [key, child] of Object.entries(tree)) leavesOf(child, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

/** 指南 blocks（{text}|{title,children}）→ 文本数组（含标题，正文覆盖核对用）。 */
function blockTexts(blocks, out = []) {
  for (const block of blocks || []) {
    if (typeof block.title === 'string') out.push(block.title)
    if (typeof block.text === 'string') out.push(block.text)
    if (block.children) blockTexts(block.children, out)
  }
  return out
}

function missingBlocks(blocks, out = []) {
  for (const block of blocks || []) {
    if (block.missing) out.push(block)
    if (block.children) missingBlocks(block.children, out)
  }
  return out
}

const guideBuild = async () => BUILT_GUIDES
const scope = readJson('audit/eote-scope.json')
const scopeChapterById = new Map((scope.chapters || []).map(chapter => [chapter.id, chapter]))
const guideById = new Map(buildGuides().map(guide => [guide.id, guide]))
const GAP_PATTERN = /(?:^|\.)(title|body)$/

// ---------------------------------------------------------------------------
// 一、story-text / story-access
// ---------------------------------------------------------------------------

test('P7 story meta：来源诚实字段 + 12 个来源锁（en/zh 各 6 文件）', () => {
  assert.equal(EOTE_STORY_META.status, 'generated')
  assert.equal(EOTE_STORY_META.stage, 'P7-story')
  assert.equal(EOTE_STORY_META.sourceKind, 'reference-project-zh-locale+local-supplement')
  assert.equal(EOTE_STORY_META.officialChinese, false)
  assert.equal(EOTE_STORY_META.generator, 'tools/import-eote-story.mjs')
  assert.equal(EOTE_STORY_META.files.length, 6)
  assert.equal(Object.keys(EOTE_STORY_META.sources).length, 12)
  const expectedSourcePaths = new Set([
    ...EN_FILES.map(file => `frontend/src/locales/en/edgeOfTheEarth/${file.replace(/^en\//, '')}`),
    ...ZH_FILES.map(file => `frontend/src/locales/zh/edgeOfTheEarth/${file.replace(/^zh\//, '')}`),
  ])
  for (const [path, lock] of Object.entries(EOTE_STORY_META.sources)) {
    assert.match(lock.sha256, /^[0-9a-f]{64}$/, `${path} 缺 sha256`)
    assert.ok(lock.bytes > 0)
    assert.ok(expectedSourcePaths.has(path), path)
  }
  assert.equal(Object.keys(EOTE_STORY_META.sources).length, expectedSourcePaths.size)
  for (const lang of ['enSourceHashes', 'zhSourceHashes']) {
    assert.equal(Object.keys(EOTE_STORY_META[lang]).length, 6)
    for (const hash of Object.values(EOTE_STORY_META[lang])) assert.match(hash, /^[0-9a-f]{64}$/)
  }
  assert.equal(EOTE_STORY_META.chapters, 8)
  assert.equal(Object.keys(EOTE_STORY_META.guideKeyCounts).length, 8)
  assert.ok(EOTE_STORY_META.chars.en > 100000 && EOTE_STORY_META.chars.zh > 30000, `字符量异常：${JSON.stringify(EOTE_STORY_META.chars)}`)
})

test('P7 story 章节覆盖：8 章 sections=guideKeyCount=P0 scope(part 切片)，en 叶子逐路径全覆盖', () => {
  assert.deepEqual(Object.keys(EOTE_STORY_TEXT.chapters), SCENARIO_IDS)
  for (const chapter of eoteChapters) {
    const story = chapterStory(chapter.id)
    const guide = guideById.get(chapter.id)
    assert.ok(guide, `${chapter.id} 缺 P1 指南切片`)
    const enLeaves = leavesOf(story.sectionsEn)
    assert.equal(story.sectionCount, guide.sections.length, `${chapter.id} sectionCount`)
    assert.equal(story.sectionCount, story.guideKeyCount, `${chapter.id} guideKeyCount`)
    assert.equal(enLeaves.length, story.sectionCount, `${chapter.id} en 叶子数`)
    const expectedPaths = guide.sections.map(section => section.path)
    const stripped = expectedPaths.map(path => (story.part ? path.replace(`${story.part}.`, '') : path))
    assert.deepEqual(enLeaves.map(leaf => leaf.path).sort(), stripped.sort(), `${chapter.id} en 路径集合`)
    for (const leaf of enLeaves) assert.ok(leaf.text.trim(), `${chapter.id}/${leaf.path} en 正文为空`)
    assert.equal(story.title, chapter.name)
    assert.equal(story.titleEn, chapter.nameEn)
    assert.ok(story.heading, `${chapter.id} 缺 heading`)
    assert.ok(story.intro.length > 0 && story.setup.length > 0, `${chapter.id} intro/setup 为空`)
    assert.match(story.status, /^(present-needs-review|mixed|missing|untranslated)$/)
    for (const leaf of enLeaves) assert.ok(leaf.text.trim(), `${chapter.id}/${leaf.path} en 正文为空`)
    const scopeChapter = scopeChapterById.get(chapter.id)
    assert.equal(story.partSectionCount, scopeChapter.guideKeyCounts.en, `${chapter.id} part 叶子数 vs P0 scope`)
    assert.deepEqual(story.chinese.total, story.sectionCount)
  }
  // 有结局文本的章节：resolutions 至少 2 条；fatalMirage 的 resolutions 是过程正文（无结局键）。
  for (const id of ['iceAndDeathPart1', 'toTheForbiddenPeaks', 'theHeartOfMadnessPart1']) {
    assert.ok(Object.keys(chapterStory(id).resolutions).length >= 2, `${id} 结局过少`)
  }
  // JSON 往返（structuredClone）后章节仍可读。
  const clone = structuredClone(EOTE_STORY_TEXT.chapters)
  assert.equal(Object.keys(clone).length, 8)
})

test('P7 story 中文全量覆盖：参考 locale 缺译/未译叶子已由本地补充层补齐', () => {
  const totals = { total: 0, presentNeedsReview: 0, untranslated: 0, missing: 0 }
  for (const id of SCENARIO_IDS) {
    const story = chapterStory(id)
    const gaps = Object.keys(story.chineseGaps)
    assert.equal(gaps.length, story.chinese.missing + story.chinese.untranslated, `${id} chineseGaps 数与统计不一致`)
    assert.deepEqual(gaps, [], `${id} 仍存在缺译叶子：${gaps.slice(0, 5).join(', ')}`)
    assert.equal(story.chinese.presentNeedsReview, story.sectionCount, `${id} 应全部为已译`)
    for (const leaf of leavesOf(story.sections)) {
      assert.match(leaf.text, CJK, `${id}/${leaf.path} display 无中文`)
    }
    for (const key of Object.keys(totals)) totals[key] += story.chinese[key]
    assert.deepEqual(EOTE_STORY_META.chinese.byChapter[id], story.chinese)
  }
  assert.deepEqual(
    { total: EOTE_STORY_META.chinese.total, presentNeedsReview: EOTE_STORY_META.chinese.presentNeedsReview, untranslated: EOTE_STORY_META.chinese.untranslated, missing: EOTE_STORY_META.chinese.missing },
    totals,
  )
  assert.equal(totals.total, 469, '八章指南段落总数应为 469')
  assert.equal(totals.missing, 0, '章节缺译应为 0')
  assert.equal(totals.untranslated, 0, '章节未译应为 0')
  // 本地补充层来源必须诚实标注，且参考 locale 来源锁仍作为上游事实保留。
  assert.equal(EOTE_STORY_META.officialChinese, false)
  assert.ok(EOTE_STORY_META.zhSupplement?.entries > 0, '本地补充层条目数缺失')
  assert.deepEqual(EOTE_STORY_META.zhSupplement.files.map(file => file.name).sort(),
    ['campaign.json', 'chapters-a.json', 'chapters-b.json', 'chapters-c.json'])
})

test('P7 story part 拆分边界：亡命冰原 I–III / 疯狂之心 I–II 共享键不串 part', () => {
  const ICE_SHARED = ['heading', 'tokens', 'icebreakerLanding', 'manifestationsOfEvil']
  const heart1 = chapterStory('theHeartOfMadnessPart1')
  const heart2 = chapterStory('theHeartOfMadnessPart2')
  for (const id of ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3']) {
    const story = chapterStory(id)
    for (const key of ICE_SHARED) assert.ok(Object.hasOwn(story.sectionsEn, key), `${id} 缺共享键 ${key}`)
    assert.ok(!Object.keys(story.sectionsEn).some(key => /^part[123]$/.test(key)), `${id} 混入 partN 子树`)
    assert.equal(Object.keys(story.sectionsEn).filter(key => ICE_SHARED.includes(key)).length, ICE_SHARED.length)
  }
  for (const story of [heart1, heart2]) {
    for (const key of ['heading', 'tokens', 'specialRules']) assert.ok(Object.hasOwn(story.sectionsEn, key), `${story.id} 缺共享键 ${key}`)
    assert.ok(!Object.keys(story.sectionsEn).some(key => /^part[123]$/.test(key)), `${story.id} 混入 partN 子树`)
  }
  // 整文件章节没有 part 前缀键/拆分映射。
  for (const id of ['fatalMirage', 'toTheForbiddenPeaks', 'cityOfTheElderThings']) {
    const story = chapterStory(id)
    assert.equal(story.part, null)
    assert.equal(story.partMapping, 'whole-file')
    assert.ok(!Object.keys(story.sectionsEn).some(key => /^part[123]$/.test(key)))
  }
})

test('P7 story 战役正文：序幕/检查点/幕间/尾声/特别规则/记录与 P1 扫描逐组一致', () => {
  const campaign = EOTE_STORY_TEXT.campaign
  const baseScan = buildRulesScan()
  const groupById = new Map(baseScan.campaignStory.groups.map(group => [group.id, group]))
  const countOf = ids => ids.reduce((total, id) => total + (groupById.get(id)?.sections.length || 0), 0)
  assert.equal(campaign.prologue.sectionCount, countOf(['madnessUnderTheIce', 'prologue', 'prologue1', 'prologue2', 'prologue3', 'prologue4']))
  assert.equal(campaign.partnerIntros.sectionCount, groupById.get('partnerIntros').sections.length)
  for (const id of ['checkpoint1', 'checkpoint2', 'checkpoint3']) {
    assert.equal(campaign.checkpoints[id].sectionCount, groupById.get(id).sections.length)
    assert.ok(campaign.checkpoints[id].entries.length > 0)
  }
  for (const id of ['interlude1', 'interlude2', 'interlude3']) {
    assert.equal(campaign.interludes[id].sectionCount, groupById.get(id).sections.length)
    assert.ok(campaign.interludes[id].entries.length > 0)
  }
  assert.equal(campaign.epilogue.sectionCount, groupById.get('epilogue').sections.length)
  assert.equal(campaign.specialRules.sectionCount, groupById.get('specialRules').sections.length)
  assert.equal(campaign.specialRules.chinese.missing, 0, '特别规则已由本地补充层翻译，不应再有缺译')
  assert.equal(campaign.specialRules.chinese.untranslated, 0, '特别规则不应再有未译')
  for (const id of ['recordLabels', 'labels', 'partnerNames', 'suppliesRecovered']) {
    assert.ok(campaign.records[id].sectionCount > 0, `记录组 ${id} 缺失`)
  }
  assert.equal(campaign.records.recordLabels.sectionCount, 56)
  // localeKeys：edgeOfTheEarth.* 覆盖 base 全部叶子且正文非空。
  assert.equal(Object.keys(EOTE_STORY_KEYS).length, baseScan.campaignStory.totals.sections)
  for (const [key, entry] of Object.entries(EOTE_STORY_KEYS)) {
    assert.ok(key.startsWith('edgeOfTheEarth.'), key)
    assert.ok(entry.body.trim(), `${key} 正文为空`)
    assert.ok(STATUSES.includes(entry.status), `${key} 状态非法`)
  }
  // 幕间/尾声派生视图（story-access 之外，生成物兼容形状）。
  assert.deepEqual(Object.keys(EOTE_STORY_TEXT.interludes), ['interlude1', 'interlude2', 'interlude3'])
  for (const view of Object.values(EOTE_STORY_TEXT.interludes)) assert.ok(view.sections.length > 0, `${view.id} 段落为空`)
  assert.equal(EOTE_STORY_TEXT.epilogue.sections.length, campaign.epilogue.entries.length)
  assert.deepEqual(EOTE_STORY_TEXT.epilogue.cells, [])
})

test('P7 story 正文质量：生成物无 HTML 标签 / 无模板占位 / 无实体残留', () => {
  const problems = []
  const hex = /^[0-9a-f]{64}$/
  const scan = (value, where) => {
    if (typeof value === 'string') {
      if (hex.test(value)) return
      if (/<[a-zA-Z/][^>]*>/.test(value)) problems.push(`${where}: HTML 残留`)
      if (/\{setImgPath\}|\{name\}|\{xp\}|\{fast\}|\{[a-zA-Z_]+\}/.test(value)) problems.push(`${where}: 占位模板残留`)
      if (/&(?:nbsp|amp|lt|gt|quot|#39|#\d+);/i.test(value)) problems.push(`${where}: HTML 实体残留`)
      return
    }
    if (Array.isArray(value)) { value.forEach((child, index) => scan(child, `${where}[${index}]`)); return }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (['status', 'id', 'key', 'path', 'layer', 'guideId', 'part', 'partMapping', 'referenceCode', 'stepId', 'titleEn'].includes(key)) continue
        scan(child, `${where}.${key}`)
      }
    }
  }
  scan(EOTE_STORY_TEXT.chapters, 'chapters')
  scan(EOTE_STORY_TEXT.campaign, 'campaign')
  scan(EOTE_STORY_KEYS, 'localeKeys')
  assert.deepEqual(problems.slice(0, 10), [], `正文残留：\n${problems.slice(0, 10).join('\n')}`)
})

test('P7 story 生成物确定性：--check 通过、assemble 两次逐字节一致、磁盘文件与之相等', () => {
  const first = assemble()
  const second = assemble()
  assert.equal(first.source, second.source, '两次组装不一致')
  const verified = check()
  const fileText = readFileSync(`${ROOT}content/campaigns/edgeOfTheEarth/story-text.js`, 'utf8')
  assert.equal(fileText, first.source, '磁盘 story-text.js 与生成结果不一致（请重跑 --write）')
  assert.equal(Buffer.byteLength(fileText), verified.byteLength)
  assert.equal(verified.sha256, first.meta.generatedSha256 ?? verified.sha256)
  const result = spawnSync(process.execPath, ['tools/import-eote-story.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const inventory = storyInventory()
  assert.equal(inventory.chapters, 8)
  assert.equal(inventory.chapterSections, 469)
  assert.equal(eoteStoryInventory().chapters, 8)
  assert.deepEqual(eoteStoryChapter('fatalMirage').id, 'fatalMirage')
})

test('P7 story P0 scope 对齐：guideSources 锁 / guideKeyCounts.en / part 映射（只读）', () => {
  const alignment = scopeAlignment()
  assert.deepEqual(alignment.problems, [])
  assert.equal(alignment.ok, true)
  assert.equal(alignment.extraSources.length, 0)
  assert.equal(alignment.chapters.length, 8)
  for (const row of alignment.chapters) {
    assert.equal(row.sources.en, true, `${row.id} en 来源不一致`)
    assert.equal(row.sources.zh, true, `${row.id} zh 来源不一致`)
    assert.equal(row.guideKeyCountMatch, true, `${row.id} part 叶子数不一致`)
  }
})

test('P7 story story-access API：章节/战役/扁平化/段落读取', () => {
  const story = chapterStory('theHeartOfMadnessPart1')
  assert.equal(story.id, 'theHeartOfMadnessPart1')
  assert.throws(() => chapterStory('nope'), /缺少章节/)
  assert.equal(typeof storyText('theHeartOfMadnessPart1', 'intro'), 'string')
  assert.ok(storyText('theHeartOfMadnessPart1', 'intro').length > 0)
  assert.ok(storyText('theHeartOfMadnessPart1', 'resolutions.resolution1').length > 0)
  assert.ok(Array.isArray(storyParagraphsOf('theHeartOfMadnessPart1', 'setup')))
  assert.ok(storyParagraphsOf('theHeartOfMadnessPart1', 'setup').length >= 1)
  assert.ok(Array.isArray(storyParagraphs('第一段\n\n第二段')))
  assert.deepEqual(storyParagraphs('第一段\n\n第二段'), ['第一段', '第二段'])
  assert.equal(flattenStory({ title: '标题', body: '正文' }), '标题\n\n正文')
  assert.equal(flattenStory([{ text: 'a' }, { text: 'b' }]).includes('a'), true)
  assert.equal(flattenResolution({ title: '结局', body: '正文' }), '结局\n\n正文')
  assert.equal(resolutionText('theHeartOfMadnessPart1', 'resolution1')?.startsWith('结局'), true)
  assert.equal(resolutionText('theHeartOfMadnessPart1', 'nope'), null)
  assert.equal(chapterSection('theHeartOfMadnessPart1', 'intro')?.body.length > 0 || typeof chapterSection('theHeartOfMadnessPart1', 'intro') === 'string', true)
  // 战役正文（campaignStory / storyEntry）。
  assert.ok(campaignStory('prologue').entries.length > 0)
  assert.ok(campaignStory('checkpoint1').entries.length > 0)
  assert.ok(campaignStory('interlude1').entries.length > 0)
  assert.equal(campaignStory('nope'), null)
  const entryKey = Object.keys(EOTE_STORY_KEYS).find(key => key.startsWith('edgeOfTheEarth.epilogue.epilogue'))
  assert.ok(entryKey, '缺 epilogue 键')
  assert.ok(storyEntry(entryKey).body.length > 0)
  assert.equal(storyEntry('edgeOfTheEarth.nope'), null)
  assert.ok(storyEntryText(entryKey).length > 0)
})

// ---------------------------------------------------------------------------
// 二、web/scenario-guides 生成物
// ---------------------------------------------------------------------------

test('P7 guides 文件：8 章 json 存在、结构字段齐全（id/campaignId/locales 五段）', () => {
  const guides = BUILT_GUIDES
  assert.equal(guides.size, 62, '应在既有 54 个关卡之外新增 8 个《地球边缘》章节')
  for (const [index, id] of SCENARIO_IDS.entries()) {
    const relative = GUIDE_FILES[index]
    assert.ok(existsSync(`${ROOT}${relative}`), `缺少 ${relative}`)
    const guide = readJson(relative)
    assert.equal(guide.id, id)
    assert.equal(guide.campaignId, 'edgeOfTheEarth')
    assert.equal(guide.sourceKind, 'reference-project-zh-locale+local-supplement')
    assert.equal(guide.officialChinese, false)
    assert.ok(CHAPTER_STATUSES.includes(guide.chineseStatus))
    assert.equal(typeof guide.sectionCount, 'number')
    assert.equal(typeof guide.guideKeyCount, 'number')
    assert.ok(guide.chinese && typeof guide.chinese.total === 'number')
    assert.deepEqual(Object.keys(guide.chineseGaps).length, guide.chinese.missing + guide.chinese.untranslated)
    assert.deepEqual(Object.keys(guide.sources).sort(), ['en', 'zh'])
    assert.deepEqual(Object.keys(guide.locales).sort(), ['en', 'zh'])
    for (const language of ['en', 'zh']) {
      const locale = guide.locales[language]
      assert.deepEqual(Object.keys(locale), ['intro', 'setup', 'specialRules', 'story', 'resolutions'])
      assert.ok(Array.isArray(locale.intro) && Array.isArray(locale.setup) && Array.isArray(locale.story), `${id}/${language} 段落数组缺失`)
    }
    // en 指南必须覆盖章节全部非 UI 正文键（与 story-text en 叶子逐条一致）。
    const story = chapterStory(id)
    const enTexts = blockTexts(Object.values(guide.locales.en).flat()).join('\n')
    for (const leaf of leavesOf(story.sectionsEn)) {
      if (leaf.path.split('.').some(segment => SKIPPED_GUIDE_KEYS.has(segment))) continue
      // `@:` 是参考 locale 的跨节引用（个别 zh/en 正文整键引用另一部分），
      // 指南层明确不展开引用（guide 生成器 stripRefs），因此不纳入 en 指南覆盖断言。
      if (leaf.text.startsWith('@:')) continue
      const probe = leaf.text.slice(0, 24)
      assert.ok(enTexts.includes(probe), `${id} en 指南缺少 ${leaf.path}（${probe}）`)
    }
    // 指南来自 story-text，同一事实源：sectionCount / chineseGaps / sources 全等。
    assert.equal(guide.sectionCount, story.sectionCount)
    assert.equal(guide.guideKeyCount, story.guideKeyCount)
    assert.deepEqual(guide.chineseGaps, story.chineseGaps)
    assert.deepEqual(guide.sources, story.sources)
  }
})

test('P7 guides 中文不冒充：zh 段落含中文，缺译只留空正文 + missing 标记并列入 chineseGaps', () => {
  for (const id of SCENARIO_IDS) {
    const guide = readJson(`web/scenario-guides/${id}.json`)
    assert.ok(CHAPTER_STATUSES.includes(guide.chineseStatus), `${id} chineseStatus=${guide.chineseStatus}`)
    const zhBlocks = Object.values(guide.locales.zh).flat()
    const markers = missingBlocks(zhBlocks)
    // 缺译标记只覆盖真正进入指南的叶子（heading/tokens/labels 等 UI 键被跳过，可能为 0）。
    assert.ok(markers.length <= Object.keys(guide.chineseGaps).length, `${id} 缺译标记多于 chineseGaps`)
    for (const marker of markers) {
      assert.equal(marker.text, '', `${id} 缺译段落不得用英文冒充：${marker.path}`)
      assert.ok(guide.chineseGaps[marker.path], `${id} 缺译标记 ${marker.path} 未列入 chineseGaps`)
      assert.ok(['missing', 'untranslated'].includes(marker.missing))
    }
    // 非标记正文：必须带中文（允许图标/专名混排，但不允许整段纯英文）。
    for (const text of blockTexts(zhBlocks)) {
      if (!text.trim()) continue
      assert.match(text, CJK, `${id} zh 段落疑似英文冒充：${text.slice(0, 60)}`)
    }
    // en 指南不含缺译标记。
    assert.equal(missingBlocks(Object.values(guide.locales.en).flat()).length, 0, `${id} en 指南不应有缺译标记`)
  }
  // 八章缺译已由本地补充层补齐：不应再出现缺译标记。
  const totalMarkers = SCENARIO_IDS.reduce((total, id) => {
    const guide = readJson(`web/scenario-guides/${id}.json`)
    return total + missingBlocks(Object.values(guide.locales.zh).flat()).length
  }, 0)
  assert.equal(totalMarkers, 0, `缺译标记应为 0：${totalMarkers}`)
})

test('P7 guides 幂等：buildScenarioGuides 两次一致、磁盘文件逐字节等于生成结果、工具 verify 退出 0', async () => {
  const first = BUILT_GUIDES
  const second = await buildScenarioGuides()
  assert.equal(second.size, first.size)
  for (const [name, content] of first) {
    assert.equal(second.get(name), content, `${name} 两次生成结果不一致`)
    if (GUIDE_FILES.includes(`web/scenario-guides/${name}`)) {
      assert.equal(readFileSync(`${ROOT}web/scenario-guides/${name}`, 'utf8'), content, `${name} 磁盘文件与生成结果不一致（请重跑 --write）`)
    }
  }
  const result = spawnSync(process.execPath, ['tools/import-scenario-guides.mjs'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /62 scenarios verified/)
})

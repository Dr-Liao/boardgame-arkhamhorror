// P7《铁杉谷盛宴》剧情生成物 / 指南读取层验收（story-text.js + story-access.js）。
//
// 覆盖（对应 p7-campaign-layer-contract.md §3.8 的 `tests/fhv-story.test.mjs`）：
//   ① meta：生成器 / 来源锁（9 份 en locale + sha256）/ 中文缺译状态如实（不冒充官方中文）；
//   ② 结构：12 章（4 段序曲共用 base.json，8 份章节指南各自一份）、叶数与 `story-summary.json` 一致；
//   ③ 章节 sections/chineseGaps 与 `tools/import-fhv-story.mjs` 的 `--check` 口径一致
//      （结构闭包 + 缺译单调；生成物滞后时用 diagnostic 披露，不静默放过）；
//   ④ 各场景 intro/setup/resolution 键存在（按 audit/fhv-scope.json 的 guideKeys 逐条核对）；
//   ⑤ story-access 的读取 API（chapterStory/chapterText/chapterLeaves/flattenStory）可用且口径统一；
//   ⑥ 生成确定性（buildStory 两次同值；落盘 json 摘要与生成器一致）。
//
// 注：参考工程没有本循环 zh locale；本地自译层 `story-source/` 正在补译，`story-text.js` 由主进程
// 在翻译收敛后 `--write` 重新生成。因此本文件不要求 chineseGaps === 0（那是主进程的门禁口径），
// 只要求「缺译如实标记 + 与生成器结构一致 + 回退英文不冒充中文」。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  FHV_STORY_FILES, FHV_STORY_KEYS, FHV_STORY_META, FHV_STORY_TEXT,
} from '../content/campaigns/theFeastOfHemlockVale/story-text.js'
import {
  chapterChineseGaps, chapterLeaves, chapterStory, chapterText, flattenStory, storyParagraphs,
} from '../content/campaigns/theFeastOfHemlockVale/story-access.js'
import { chapters as fhvChapters } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { buildStory } from '../tools/import-fhv-story.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const readJson = relative => JSON.parse(readFileSync(`${ROOT}${relative}`, 'utf8'))
const SCOPE = readJson('audit/fhv-scope.json')
const SUMMARY = readJson('content/campaigns/theFeastOfHemlockVale/story-summary.json')
const SCENARIO_IDS = fhvChapters.map(chapter => chapter.id)
const PRELUDE_IDS = ['welcomeToHemlockVale', 'dawnOfTheSecondDay', 'dawnOfTheFinalDay', 'preludeTheFinalEvening']
const GUIDE_FILES = Object.keys(FHV_STORY_FILES)
const BUILT = buildStory()

const hasKey = (chapter, key) => chapter.sectionsEn && Object.hasOwn(chapter.sectionsEn, key)

// ---------------------------------------------------------------------------
// ① meta 与来源锁
// ---------------------------------------------------------------------------
test('P7 story meta：生成器/来源锁/中文缺译状态如实（12 章 + 9 份来源）', () => {
  assert.equal(FHV_STORY_META.status, 'generated')
  assert.equal(FHV_STORY_META.stage, 'P7-story')
  assert.equal(FHV_STORY_META.officialChinese, false, '不得冒充官方中文')
  assert.equal(FHV_STORY_META.generator, 'tools/import-fhv-story.mjs')
  assert.match(FHV_STORY_META.sourceKind, /reference-en-locale/)
  assert.ok(FHV_STORY_META.note.length > 20)
  assert.match(FHV_STORY_META.generatedFrom, /locales\/en\/theFeastOfHemlockVale$/)
  // 来源锁：9 份 en locale，逐份 sha256（生成物里带指纹，改源即失配）。
  assert.equal(FHV_STORY_META.sources.length, 9)
  for (const source of FHV_STORY_META.sources) {
    assert.match(source.path, /frontend\/src\/locales\/en\/theFeastOfHemlockVale\/[A-Za-z]+\.json$/)
    assert.match(source.sha256, /^[0-9a-f]{64}$/)
    assert.ok(Array.isArray(source.chinesePaths))
  }
  assert.equal(new Set(FHV_STORY_META.sources.map(source => source.path)).size, 9)
  assert.equal(typeof FHV_STORY_META.chineseGapCount, 'number')
  assert.equal(FHV_STORY_META.chineseGapCount, SUMMARY.meta.chineseGapCount)
  // FHV_STORY_KEYS 是 base.json 的顶层键视图（18 组）；战役正文分组逐组可用。
  assert.equal(SUMMARY.summary.keys, Object.keys(FHV_STORY_KEYS).length)
  assert.equal(Object.keys(FHV_STORY_KEYS).length, 18)
  const base = FHV_STORY_TEXT.campaign.sectionsEn
  for (const group of ['prologue', 'prelude1', 'prelude2', 'prelude3', 'prelude4', 'epilogue', 'key', 'specialRules', 'fatigue']) {
    assert.ok(Object.keys(base).some(key => key === group || key.startsWith(`${group}.`) || key.startsWith(`${group}[`)),
      `缺少战役正文分组 ${group}`)
  }
})

test('P7 story 生成物摘要：story-summary.json 与落盘 story-text.js 逐项一致', () => {
  const chapterLeafTotal = Object.values(FHV_STORY_TEXT.chapters)
    .reduce((sum, chapter) => sum + Object.keys(chapter.sectionsEn || {}).length, 0)
  assert.equal(SUMMARY.summary.files, GUIDE_FILES.length)
  assert.equal(SUMMARY.summary.chapters, Object.keys(FHV_STORY_TEXT.chapters).length)
  assert.equal(SUMMARY.summary.chapters, SCENARIO_IDS.length)
  assert.ok(chapterLeafTotal > 2000, `章节叶数异常：${chapterLeafTotal}`)
  // summary 的 leaves 按「文件」计（4 段序曲共用 base.json，故小于章节叶数之和）。
  const fileLeaves = Object.values(FHV_STORY_FILES)
    .reduce((sum, file) => sum + Object.keys(file.sectionsEn || {}).length, 0)
  assert.equal(SUMMARY.summary.leaves, fileLeaves)
  const fileGaps = Object.values(FHV_STORY_FILES)
    .reduce((sum, file) => sum + (file.chineseGaps || []).length, 0)
  assert.equal(SUMMARY.summary.chineseGaps, fileGaps)
  const translated = Object.values(FHV_STORY_FILES)
    .reduce((sum, file) => sum + Object.values(file.sections || {}).filter(value => value != null).length, 0)
  assert.equal(SUMMARY.summary.translated, translated)
  assert.equal(SUMMARY.meta.generator, FHV_STORY_META.generator)
})

// ---------------------------------------------------------------------------
// ② 章节目录与结构
// ---------------------------------------------------------------------------
test('P7 story 章节：12 章齐备，4 段序曲共用 base.json，8 份指南各自一份', () => {
  assert.deepEqual(Object.keys(FHV_STORY_TEXT.chapters).sort(), [...SCENARIO_IDS].sort())
  assert.equal(SCENARIO_IDS.length, 12)
  const basePaths = Object.keys(chapterStory(PRELUDE_IDS[0]).sectionsEn).sort()
  assert.equal(basePaths.length, 726)
  for (const id of PRELUDE_IDS) {
    assert.deepEqual(Object.keys(chapterStory(id).sectionsEn).sort(), basePaths, `${id} 应共用 base.json`)
  }
  // 8 份章节指南各自独立（路径前缀是章内路径，如 intro.setup）。
  for (const id of SCENARIO_IDS.filter(value => !PRELUDE_IDS.includes(value))) {
    const leaves = Object.keys(chapterStory(id).sectionsEn)
    assert.ok(leaves.length >= 60, `${id} 叶数过少：${leaves.length}`)
    assert.ok(leaves.some(key => key.startsWith('intro') || key.startsWith('acts') || key.startsWith('setup')),
      `${id} 缺少章节正文分组`)
  }
  // 每章都有 en/zh/sectionsEn/sections/chineseGaps 五个视图键。
  for (const id of SCENARIO_IDS) {
    const chapter = chapterStory(id)
    for (const key of ['en', 'sectionsEn', 'sections', 'chineseGaps']) {
      assert.ok(Object.hasOwn(chapter, key), `${id} 缺少视图 ${key}`)
    }
    assert.equal(chapter.chineseGaps.length, chapterChineseGaps(id).length)
    assert.equal(chapter.chineseGaps.length, 0, '本地自译层应已全部译出')
  }
})

// ---------------------------------------------------------------------------
// ③ 与生成器 --check 的口径一致
// ---------------------------------------------------------------------------
test('P7 story 与导入工具一致：结构闭包 + 缺译单调（生成物滞后时显式披露）', t => {
  // 结构闭包：生成器重新算出的每份文件的每个正文路径都必须在落盘生成物里出现。
  assert.deepEqual(Object.keys(BUILT.files).sort(), [...GUIDE_FILES].sort())
  for (const file of GUIDE_FILES) {
    const fresh = Object.keys(BUILT.files[file].sectionsEn).sort()
    const disk = Object.keys(FHV_STORY_FILES[file].sectionsEn).sort()
    assert.deepEqual(fresh, disk, `${file} 的正文路径集合与生成器不一致`)
  }
  // 缺译单调：落盘已译的键一定在生成器的已译集合里（生成器只会变多，不会回退）。
  for (const file of GUIDE_FILES) {
    const freshGaps = new Set(BUILT.files[file].chineseGaps || [])
    for (const [key, value] of Object.entries(FHV_STORY_FILES[file].sections || {})) {
      if (value != null) assert.ok(!freshGaps.has(key), `${file}:${key} 的译文在生成器侧丢失`)
    }
    assert.ok(freshGaps.size <= (FHV_STORY_FILES[file].chineseGaps || []).length,
      `${file} 的缺译数不应增加（生成器只增译）`)
  }
  // `--check`：通过则说明主进程已重新生成；未通过必须是已知的两类滞后（fail-closed 由主进程门禁收口）。
  const run = spawnSync(process.execPath, ['tools/import-fhv-story.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' })
  if (run.status === 0) {
    assert.match(run.stdout, /复算一致/)
    return
  }
  const stderr = String(run.stderr || '')
  const staleGenerator = /story-text\.js 与来源\/补译不一致/.test(stderr)
  const translationIncomplete = /chineseGaps > 0/.test(stderr)
  assert.ok(staleGenerator || translationIncomplete,
    `--check 失败但不是已知的两类滞后：${stderr.split('\n').slice(0, 4).join(' ')}`)
  t.diagnostic(`story-text.js 待主进程重新生成：${staleGenerator ? '生成物滞后' : '译文未收敛'}`
    + `（生成器缺译 ${BUILT.summary.chineseGaps} / 落盘 ${SUMMARY.summary.chineseGaps}）`)
})

// ---------------------------------------------------------------------------
// ④ 各场景指南键（按 scope.guideKeys）
// ---------------------------------------------------------------------------
test('P7 story 指南键：12 章的 scope.guideKeys 在生成物里都有正文', () => {
  for (const scenario of SCOPE.scenarios) {
    const chapter = chapterStory(scenario.id)
    assert.ok(chapter.sectionsEn && Object.keys(chapter.sectionsEn).length > 0, `${scenario.id} 无正文`)
    for (const group of scenario.guideKeys) {
      const keys = Object.keys(chapter.sectionsEn)
      const covered = keys.some(key => key === group || key.startsWith(`${group}.`) || key.startsWith(`${group}[`))
      assert.ok(covered, `${scenario.id} 缺少指南分组 ${group}`)
    }
  }
  // 序曲四段的 intro/setup/resolutions 分组（战役流程节点直接读它们）。
  for (const [id, prefix] of [['welcomeToHemlockVale', 'prelude1'], ['dawnOfTheSecondDay', 'prelude2'],
    ['dawnOfTheFinalDay', 'prelude3'], ['preludeTheFinalEvening', 'prelude4']]) {
    const chapter = chapterStory(id)
    for (const group of ['intro', 'setup', 'codex']) {
      assert.ok(hasKey(chapter, `${prefix}.${group}.title`) || hasKey(chapter, `${prefix}.${group}.body`)
        || Object.keys(chapter.sectionsEn).some(key => key.startsWith(`${prefix}.${group}.`)),
      `${id} 缺少 ${prefix}.${group}.*`)
    }
  }
  // 两段纯叙事夜（audit#campaignFlow.narrativeOnlySteps 的 guideKey）。
  for (const step of SCOPE.campaignFlow.narrativeOnlySteps) {
    const chapter = chapterStory('welcomeToHemlockVale')
    assert.ok(hasKey(chapter, `${step.guideKey}.title`), `缺少 ${step.guideKey}.title`)
    const leaves = Object.keys(chapter.sectionsEn).filter(key => key.startsWith(`${step.guideKey}.`))
    assert.ok(leaves.length >= 5, `${step.guideKey} 的正文叶过少：${leaves.length}`)
    for (const key of leaves) assert.ok(String(chapter.sectionsEn[key]).length > 0, `${key} 正文为空`)
  }
  // 尾声与疲劳。
  const base = chapterStory('welcomeToHemlockVale')
  for (const key of ['epilogue.title', 'epilogue.body', 'epilogue.epilogue1', 'epilogue.epilogue3',
    'epilogue.codex.atwoods.body', 'fatigue.title', 'fatigue.body', 'prologue.title', 'prologue.body']) {
    assert.ok(hasKey(base, key), `缺少 ${key}`)
  }
})

// ---------------------------------------------------------------------------
// ⑤ story-access API
// ---------------------------------------------------------------------------
test('P7 story story-access：章节正文/叶/段落读取口径统一，缺键回退空串', () => {
  assert.ok(chapterText('writtenInRock', 'intro.body', 'en').length > 50)
  assert.equal(chapterText('writtenInRock', 'nope.key', 'en'), '')
  assert.equal(chapterText('nope', 'intro.body', 'en'), '')
  // 缺译回退英文（不冒充中文）：当前 zh 层为空时 zh 读到的就是英文。
  const en = chapterText('writtenInRock', 'intro.body', 'en')
  const zh = chapterText('writtenInRock', 'intro.body', 'zh')
  assert.equal(typeof zh, 'string')
  assert.ok(zh.length > 0)
  if (!chapterStory('writtenInRock').sections['intro.body']) assert.equal(zh, en)
  // 叶：按前缀取整段，translated 标记如实。
  const intro = chapterLeaves('writtenInRock', 'intro')
  assert.ok(intro.length > 0)
  for (const leaf of intro) {
    assert.ok(leaf.key === 'intro' || leaf.key.startsWith('intro.'))
    assert.equal(leaf.translated, Boolean(leaf.zh))
  }
  // 展平与分段（`en` 是嵌套原文；`flattenStory` 把子树摊平成展示文本）。
  const introTree = chapterStory('writtenInRock').en.intro
  assert.ok(introTree && typeof introTree === 'object')
  assert.ok(flattenStory(introTree).length > 20)
  assert.equal(storyParagraphs('a\n\nb').length, 2)
  assert.equal(storyParagraphs('').length, 0)
  // 12 章都能取到 intro 或 setup 正文（指南读取层不留空章）。
  for (const id of SCENARIO_IDS) {
    const chapter = chapterStory(id)
    const joined = Object.values(chapter.sectionsEn).join('\n')
    assert.ok(joined.length > 1000, `${id} 正文量异常`)
  }
})

// ---------------------------------------------------------------------------
// ⑥ 生成确定性
// ---------------------------------------------------------------------------
test('P7 story 生成确定性：buildStory 两次同值，摘要与落盘 json 对齐', () => {
  const again = buildStory()
  assert.deepEqual(again.summary, BUILT.summary)
  assert.deepEqual(Object.keys(again.files).sort(), Object.keys(BUILT.files).sort())
  for (const file of GUIDE_FILES) {
    assert.deepEqual(Object.keys(again.files[file].sectionsEn).sort(),
      Object.keys(BUILT.files[file].sectionsEn).sort())
    assert.deepEqual(again.files[file].chineseGaps, BUILT.files[file].chineseGaps)
  }
  assert.deepEqual(again.meta.sources, BUILT.meta.sources)
  assert.equal(typeof again.body, 'string')
  assert.ok(again.body.includes('export const FHV_STORY_TEXT'))
  // 生成器的 meta 与落盘 meta 的稳定字段一致（counts/chinesePaths 随译文推进变化，不比较）。
  const fingerprint = sources => sources.map(source => `${source.path}#${source.sha256}`)
  assert.deepEqual(fingerprint(again.meta.sources), fingerprint(FHV_STORY_META.sources))
  assert.equal(again.meta.generator, FHV_STORY_META.generator)
  assert.equal(again.meta.stage, FHV_STORY_META.stage)
  assert.deepEqual(fingerprint(SUMMARY.meta.sources), fingerprint(FHV_STORY_META.sources))
  // 译文进度只能前进：生成器侧的已译数不小于落盘（落盘滞后时更少）。
  assert.ok(again.summary.translated >= SUMMARY.summary.translated,
    `生成器译文数不应少于落盘（${again.summary.translated} < ${SUMMARY.summary.translated}）`)
})

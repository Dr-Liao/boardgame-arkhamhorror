// 十循环《沉没之城》（TDC）P7 叙事与指南测试。
//
//   node --test tests/tdc-p7-story.test.mjs
//
// 覆盖：
//  1. story-text.js 是 tools/import-tdc-story.mjs 的逐字节生成物（来源/自译层漂移即失败）；
//  2. TDC_STORY_TEXT 形状（campaign / interludes / chapters / files / keys）与 12 个参考文件、10 章映射；
//  3. chineseGaps 诚实：null 叶子确实无有效中文，非 null 叶子确实是中文（不接受英文冒充）；
//  4. 每章存在导入（intro）正文与全部可达结局（CONTRACT §6 resolutionIds）正文（中英）；
//  5. 序章、幕间 I–IV、终章导入、尾声 1–4 关键正文已译；
//  6. story-text / web 指南无 HTML 控制标记残留；
//  7. 10 份 content/scenario-guide-sources/<chapterId>.json 存在，经 buildAuthoredScenarioGuide 校验通过，
//     中英结构一致、结局块 id 覆盖 resolutionIds、特别规则与完整设置不缺；
//  8. web/scenario-guides/<id>.json 与 tools/import-scenario-guides.mjs 的 authored 生成口径逐字节一致；
//  9. story-access.js 在缺键/缺章节时安全返回，不抛错。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  TDC_STORY_FILES, TDC_STORY_KEYS, TDC_STORY_META, TDC_STORY_TEXT,
} from '../content/campaigns/theDrownedCity/story-text.js'
import {
  chapterStory, chapterText, chapterChineseGaps, fileStory, interludesStory, storyText, allChineseGaps,
} from '../content/campaigns/theDrownedCity/story-access.js'
import {
  CHAPTER_FILE_BY_ID, EN_FILES, STORY_TEXT_PATH, buildStory, validTranslation,
} from '../tools/import-tdc-story.mjs'
import {
  CHAPTERS, GUIDE_SOURCE_DIR, RESOLUTION_ALIASES, RESOLUTION_IDS, buildGuideSource, builtGuides, manifestOf,
} from '../tools/build-tdc-guides.mjs'
import { buildAuthoredScenarioGuide } from '../tools/authored-scenario-guide.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const CONTENT = join(MOD, 'content')
const read = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(read(path))
const SOURCE_DIR = join(CONTENT, 'scenario-guide-sources')
const WEB_DIR = join(MOD, 'web/scenario-guides')

// story-text.js 里保留参考 locale 的内容 HTML（<p>/<span> 等），这里只拒绝控制类标记。
const CONTROL_MARKUP = /<\s*(?:script|style|iframe|object|embed|applet|meta|link)\b|\bon[a-z]+\s*=|\bjavascript:/i
// 指南正文不允许残留来源标记（未展开的 @: 引用、{{占位符}}、HTML 标签）。
const GUIDE_MARKUP = /@:[\w.]+|<\/?[a-z][^>]*>|\{\w+\}/i

const pathOf = (root, path) => path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  .reduce((value, key) => value?.[key], root)

function flattenLeaves(value, prefix = '', out = []) {
  if (typeof value === 'string') out.push([prefix, value])
  else if (Array.isArray(value)) value.forEach((item, index) => flattenLeaves(item, `${prefix}[${index}]`, out))
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) flattenLeaves(item, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

const chapterIds = Object.keys(CHAPTER_FILE_BY_ID)

test('story-text.js 与参考 en locale + 自译层逐字节一致（--check 口径）', () => {
  const story = buildStory()
  assert.equal(story.body, read(STORY_TEXT_PATH), 'story-text.js 与来源不一致：重跑 node tools/import-tdc-story.mjs --write')
  assert.equal(TDC_STORY_META.generator, 'tools/import-tdc-story.mjs')
  assert.equal(TDC_STORY_META.officialChinese, false)
  assert.match(TDC_STORY_META.generatedFrom, /locales\/en\/theDrownedCity$/)
  assert.equal(TDC_STORY_META.sourceKind, 'reference-en-locale + local zh supplement')
  assert.equal(TDC_STORY_META.summary.files, EN_FILES.length)
  assert.equal(TDC_STORY_META.summary.chapters, 10)
  assert.ok(TDC_STORY_META.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256)))
})

test('TDC_STORY_TEXT 形状：campaign + interludes + 10 章 + 12 个参考文件', () => {
  assert.ok(Array.isArray(EN_FILES) && EN_FILES.length === 12)
  assert.ok(EN_FILES.every(file => Object.hasOwn(TDC_STORY_FILES, file)), '参考文件清单与 TDC_STORY_FILES 不一致')
  assert.deepEqual(Object.keys(TDC_STORY_FILES).sort(), [...EN_FILES].sort())
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
  assert.ok(same(TDC_STORY_TEXT.campaign, TDC_STORY_FILES['base.json']), 'campaign 视图不是 base.json')
  assert.ok(same(TDC_STORY_TEXT.interludes, TDC_STORY_FILES['interludes.json']), 'interludes 视图不是 interludes.json')
  assert.deepEqual(Object.keys(TDC_STORY_TEXT.chapters).sort(), [...chapterIds].sort())
  for (const id of chapterIds) {
    assert.ok(same(TDC_STORY_TEXT.chapters[id], TDC_STORY_FILES[CHAPTER_FILE_BY_ID[id]]), `章节 ${id} 映射错误`)
  }
  assert.deepEqual(TDC_STORY_KEYS, Object.keys(TDC_STORY_FILES['base.json'].en))
  for (const file of EN_FILES) {
    const row = TDC_STORY_FILES[file]
    assert.ok(row.en && typeof row.en === 'object', `${file} 缺少 en 树`)
    assert.ok(Object.keys(row.sectionsEn).length > 0, `${file} 缺少 sectionsEn`)
    assert.equal(typeof row.sections, 'object')
    assert.ok(Array.isArray(row.chineseGaps))
    assert.equal(Object.keys(row.sectionsEn).length, Object.keys(row.sections).length)
    assert.equal(row.chineseGaps.length, Object.values(row.sections).filter(value => value === null).length)
  }
  const totalLeaves = EN_FILES.reduce((sum, file) => sum + Object.keys(TDC_STORY_FILES[file].sectionsEn).length, 0)
  assert.equal(TDC_STORY_META.summary.leaves, totalLeaves)
  assert.equal(TDC_STORY_META.chineseGapCount, EN_FILES.reduce((sum, file) => sum + TDC_STORY_FILES[file].chineseGaps.length, 0))
})

test('chineseGaps 诚实：缺译叶子逐键记录，非缺译叶子不得用英文冒充中文', () => {
  for (const file of EN_FILES) {
    const row = TDC_STORY_FILES[file]
    const gaps = new Set(row.chineseGaps)
    for (const [key] of flattenLeaves(row.en)) {
      const zh = row.sections[key]
      if (gaps.has(key)) {
        assert.equal(zh, null, `${file}#${key} 记入 chineseGaps 却给出了正文`)
        assert.equal(validTranslation(pathOf(row.zh, key)), false, `${file}#${key} 被误判为缺译`)
      } else {
        assert.equal(typeof zh, 'string', `${file}#${key} 未记入 chineseGaps 但没有中文`)
        assert.equal(validTranslation(zh), true, `${file}#${key} 的中文值未通过译文中校验`)
        // `@:` 键引用本身没有中文，由消费方解析到已译叶子；其余正文必须含中文。
        if (!/^@:[\w.[\]]+$/.test(zh.trim())) assert.ok(/[\u3400-\u9fff]/.test(zh), `${file}#${key} 没有中文`)
      }
    }
  }
  // 缺译统计必须与 story-access.js 暴露的视图一致。
  const all = allChineseGaps()
  for (const file of Object.keys(all)) assert.deepEqual(all[file], TDC_STORY_FILES[file].chineseGaps)
})

test('每章存在导入正文与全部可达结局正文（CONTRACT §6 resolutionIds，中英双语）', () => {
  for (const id of chapterIds) {
    const story = chapterStory(id)
    assert.ok(story, `缺少章节 ${id}`)
    const enKeys = Object.keys(story.sectionsEn)
    const introKeys = enKeys.filter(key => key === 'intro' || key.startsWith('intro.'))
    assert.ok(introKeys.length > 0, `${id} 缺少 intro 正文`)
    assert.ok(introKeys.every(key => story.sectionsEn[key].trim()), `${id} 的 intro 有英文空叶`)
    for (const outcome of RESOLUTION_IDS[id]) {
      // 参考 locale 的结局键可能有别名（sepulchre 的 investigatorDefeat ↔ 规范键 noResolution）。
      const localeOutcome = RESOLUTION_ALIASES[id]
        ? Object.entries(RESOLUTION_ALIASES[id]).find(([, canonical]) => canonical === outcome)?.[0] || outcome
        : outcome
      const keys = enKeys.filter(key => key === `resolutions.${localeOutcome}` || key.startsWith(`resolutions.${localeOutcome}.`))
      assert.ok(keys.length > 0, `${id} 缺少结局 ${outcome} 的英文正文（locale 键 ${localeOutcome}）`)
      assert.ok(keys.every(key => story.sectionsEn[key].trim()), `${id} 结局 ${outcome} 有英文空叶`)
      assert.ok(keys.every(key => validTranslation(story.sections[key])), `${id} 结局 ${outcome} 缺少有效中文正文`)
    }
    assert.ok(introKeys.every(key => validTranslation(story.sections[key])), `${id} 的 intro 缺少有效中文正文`)
  }
  // 可达结局集合与指南生成器口径一致（防止指南漏结局）。
  for (const chapter of CHAPTERS) assert.deepEqual([...chapter.resolutionIds], RESOLUTION_IDS[chapter.id])
})

test('序章、幕间 I–IV、终章导入与尾声 1–4 关键正文已译', () => {
  const base = fileStory('base.json')
  for (const key of ['prologue.title', 'prologue.body', 'intro.title', 'intro.body']) {
    assert.ok(validTranslation(base.sections[key]), `base.json#${key} 未译`)
  }
  const inter = interludesStory()
  const required = [
    'anOfferYouCantRefuse.title', 'anOfferYouCantRefuse.interlude1', 'anOfferYouCantRefuse.interlude2',
    'anOfferYouCantRefuse.interlude3', 'anOfferYouCantRefuse.interlude4', 'anOfferYouCantRefuse.chooseTask',
    'expeditionToRlyeh.title', 'expeditionToRlyeh.body', 'expeditionToRlyeh.label.west', 'expeditionToRlyeh.label.east',
    'theAwakening.title', 'theAwakening.awakening1', 'theAwakening.awakening2', 'theAwakening.awakening3',
    'theAwakening.awakening4', 'theAwakening.proceedToReturnToArkham',
    'returnToArkham.title', 'returnToArkham.returnToArkham1', 'returnToArkham.returnToArkham2',
    'returnToArkham.resolveTasks', 'returnToArkham.checkTasks',
    'finale.title', 'finale.body',
    'epilogue.title', 'epilogue.proceedToEpilogue1', 'epilogue.proceedToEpilogue2', 'epilogue.proceedToEpilogue3',
    'epilogue.proceedToEpilogue4', 'epilogue.epilogue1.body', 'epilogue.epilogue2.body', 'epilogue.epilogue3.body',
    'epilogue.epilogue4.body',
  ]
  for (const key of required) {
    assert.ok(inter.sectionsEn[key], `interludes.json#${key} 缺英文正文`)
    assert.ok(validTranslation(inter.sections[key]), `interludes.json#${key} 未译`)
  }
  assert.equal(fileStory('interludes.json').chineseGaps.filter(key => key.startsWith('epilogue.epilogue')).length, 0)
})

test('story-text 与指南无 HTML 控制标记残留', () => {
  const body = read(STORY_TEXT_PATH)
  assert.ok(!CONTROL_MARKUP.test(body), 'story-text.js 含 HTML 控制标记')
  const { outputs } = builtGuides()
  for (const [id, output] of Object.entries(outputs)) {
    assert.ok(!CONTROL_MARKUP.test(output), `${id} 指南含 HTML 控制标记`)
    const guide = JSON.parse(output)
    for (const language of ['zh', 'en']) {
      const walk = value => {
        if (typeof value === 'string') {
          assert.ok(!GUIDE_MARKUP.test(value), `${id}/${language} 指南正文残留来源标记：${value.slice(0, 80)}`)
        } else if (Array.isArray(value)) value.forEach(walk)
        else if (value && typeof value === 'object') Object.values(value).forEach(walk)
      }
      walk(guide.locales[language])
    }
  }
})

test('10 份作者指南源存在且经 buildAuthoredScenarioGuide 校验：中英结构一致、结局/特别规则/设置完整', () => {
  const { outputs } = builtGuides()
  const SPECIAL_RULE_CHAPTERS = new Set([
    'theWesternWall', 'courtOfTheAncients', 'obsidianCanyons', 'sepulchreOfTheSleeper',
    'theGrandVault', 'theApiary', 'theDoomOfArkhamPartI', 'theDoomOfArkhamPartII',
  ])
  for (const chapter of CHAPTERS) {
    const id = chapter.id
    assert.equal(id, chapter.id)
    const sourcePath = join(SOURCE_DIR, `${id}.json`)
    assert.ok(existsSync(sourcePath), `缺少指南源 content/scenario-guide-sources/${id}.json`)
    const source = readJson(sourcePath)
    assert.equal(source.id, id)
    assert.equal(source.campaignId, 'theDrownedCity')
    assert.deepEqual(Object.keys(source.locales).sort(), ['en', 'zh'])
    // 生成器直接用它构建（不合法会抛 TypeError）。
    const guide = buildAuthoredScenarioGuide(manifestOf(chapter), source)
    assert.equal(guide.sourceKind, 'authored')
    assert.equal(guide.officialChinese, false)
    // 中英结构（block id + children 层级）一致。
    const shape = blocks => blocks.map(block => ({ id: block.id, ...(block.children ? { children: shape(block.children) } : {}) }))
    for (const section of ['intro', 'setup', 'specialRules', 'story', 'resolutions']) {
      assert.deepEqual(shape(guide.locales.zh[section]), shape(guide.locales.en[section]), `${id}/${section} 中英结构不一致`)
    }
    // 结局块 id 覆盖该章全部 resolutionIds。
    const resolutionIds = new Set(guide.locales.en.resolutions.map(block => block.id))
    for (const outcome of RESOLUTION_IDS[id]) assert.ok(resolutionIds.has(outcome), `${id} 指南缺少结局块 ${outcome}`)
    // 导入 + 完整设置。
    assert.ok(guide.locales.en.intro.length > 0 && guide.locales.zh.intro.length > 0, `${id} 缺开场`)
    assert.ok(guide.locales.en.setup.length > 0 && guide.locales.zh.setup.length > 0, `${id} 缺设置`)
    const setupText = JSON.stringify(guide.locales.en.setup)
    assert.ok(/Gather|Put|Place|Set|Build|Shuffle|Each investigator/.test(setupText), `${id} 设置内容不像完整设置`)
    const hasSetupRoot = Boolean(chapter.file && TDC_STORY_FILES[chapter.file].en?.setup)
    assert.equal(hasSetupRoot, true, `${id} 参考 locale 缺少 setup`)
    // 特别规则：有章内规则根键的章节不得为空。
    if (SPECIAL_RULE_CHAPTERS.has(id)) {
      assert.ok(guide.locales.en.specialRules.length > 0, `${id} 特别规则为空`)
      assert.ok(guide.locales.zh.specialRules.length > 0, `${id} 中文特别规则为空`)
    }
    // 阅读物与生成结果逐字节一致（import-scenario-guides authored 口径）。
    assert.equal(outputs[id], `${JSON.stringify(guide, null, 2)}\n`)
    const webPath = join(WEB_DIR, `${id}.json`)
    assert.ok(existsSync(webPath), `缺少阅读物 web/scenario-guides/${id}.json`)
    assert.equal(read(webPath), outputs[id], `${id} 阅读物与生成结果不一致：重跑 node tools/build-tdc-guides.mjs --write`)
  }
  assert.equal(CHAPTERS.length, 10)
  assert.equal(new Set(CHAPTERS.map(chapter => chapter.id)).size, 10)
})

test('指南分节来源可复算（guide source 与 story-text 一致）', () => {
  for (const chapter of CHAPTERS) {
    const rebuilt = JSON.stringify({ id: chapter.id, campaignId: chapter.campaignId, locales: buildGuideSource(chapter).locales })
    const onDisk = JSON.stringify(readJson(join(SOURCE_DIR, `${chapter.id}.json`)))
    assert.equal(rebuilt, onDisk, `${chapter.id} 指南源已漂移：重跑 node tools/build-tdc-guides.mjs --write`)
  }
})

test('story-access.js 安全读取：缺章节/缺键返回空结构不抛错', () => {
  assert.equal(chapterText('oneLastJob', 'intro.title', 'zh'), '金盆洗手')
  assert.ok(/[\u3400-\u9fff]/.test(chapterText('oneLastJob', 'intro.title', 'zh')))
  assert.equal(chapterText('oneLastJob', 'intro.body1', 'en').length > 0, true)
  assert.equal(storyText('interludes.json', 'anOfferYouCantRefuse.interlude1', 'zh').length > 0, true)
  assert.ok(/[\u3400-\u9fff]/.test(storyText('interludes.json', 'anOfferYouCantRefuse.interlude1', 'zh')))
  assert.deepEqual(chapterStory('notAChapter'), { en: {}, zh: null, sectionsEn: {}, sections: {}, chineseGaps: [] })
  assert.equal(storyText('base.json', 'not.a.key', 'zh'), '')
  assert.equal(chapterText('notAChapter', 'intro.title', 'en'), '')
  assert.deepEqual(chapterChineseGaps('notAChapter'), [])
  assert.deepEqual(chapterStory('oneLastJob').chineseGaps, TDC_STORY_FILES['oneLastJob.json'].chineseGaps)
})

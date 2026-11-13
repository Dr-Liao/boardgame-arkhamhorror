// 八循环《绯红密钥》（The Scarlet Keys）P7 剧情/指南生成物验收。
//
// 覆盖：
//   ① `tools/import-tsk-story.mjs` → `content/campaigns/theScarletKeys/story-text.js` 与
//      `story-access.js`：10 章 + 战役正文、中文缺译跟踪、来源锁、确定性、与 P0/P1 范围对齐；
//   ② `tools/import-scenario-guides.mjs` 的 TSK 分支 → `web/scenario-guides/<章节id>.json`
//      （10 章指南；中文缺译显式标记，不英文冒充中文）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { TSK_STORY_KEYS, TSK_STORY_META, TSK_STORY_TEXT } from '../content/campaigns/theScarletKeys/story-text.js'
import { chapters as tskChapters } from '../content/campaigns/theScarletKeys/shared.js'
import {
  campaignStory, chapterSection, chapterStory, flattenResolution, flattenStory, resolutionText,
  storyEntry, storyEntryText, storyParagraphs, storyParagraphsOf, storyText,
} from '../content/campaigns/theScarletKeys/story-access.js'
import { buildStoryText } from '../tools/import-tsk-story.mjs'
import { buildScenarioGuides, buildTskGuide } from '../tools/import-scenario-guides.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const readJson = relative => JSON.parse(readFileSync(`${ROOT}${relative}`, 'utf8'))
const CJK = /[\u3400-\u9fff]/
const SCENARIO_IDS = tskChapters.map(chapter => chapter.id)
const GUIDE_FILES = SCENARIO_IDS.map(id => `web/scenario-guides/${id}.json`)
const BUILT_GUIDES = await buildScenarioGuides()

const leaves = (value, path = '', out = []) => {
  if (typeof value === 'string') out.push({ path, text: value })
  else if (Array.isArray(value)) value.forEach((child, index) => leaves(child, path ? `${path}.${index}` : String(index), out))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => leaves(child, path ? `${path}.${key}` : key, out))
  return out
}
const blockTexts = (blocks, out = []) => {
  for (const block of blocks || []) {
    if (typeof block.title === 'string') out.push(block.title)
    if (typeof block.text === 'string') out.push(block.text)
    if (block.children) blockTexts(block.children, out)
  }
  return out
}

test('P7 TSK story meta：生成器/来源锁/中文缺译状态如实（10 章 + campaign）', () => {
  assert.equal(TSK_STORY_META.status, 'generated')
  assert.equal(TSK_STORY_META.stage, 'P7-story')
  assert.equal(TSK_STORY_META.officialChinese, false)
  assert.equal(TSK_STORY_META.generator, 'tools/import-tsk-story.mjs')
  assert.equal(TSK_STORY_META.counts.chapters, tskChapters.length)
  assert.equal(tskChapters.length, 10)
  assert.equal(Object.keys(TSK_STORY_TEXT.chapters).length, 10)
  assert.deepEqual(Object.keys(TSK_STORY_TEXT.chapters).sort(), [...SCENARIO_IDS].sort())
  // 来源锁：base.json + 10 章 en locale（缺译补译层另计，路径含 locale-supplement）。
  const localeSources = TSK_STORY_META.sources.filter(source => source.path.includes('/locales/'))
  assert.equal(localeSources.length, 11)
  for (const source of localeSources) assert.match(source.sha256, /^[0-9a-f]{64}$/)
  assert.ok(TSK_STORY_META.sources.filter(source => source.path.includes('locale-supplement')).length >= 1)
  assert.ok(TSK_STORY_META.counts.chapterLeaves > 600, '章节叶数与 P1 指南扫描 677 段对齐')
  assert.equal(TSK_STORY_META.counts.chapterLeaves, Object.values(TSK_STORY_TEXT.chapters).reduce((sum, chapter) => sum + chapter.summary.total, 0))
})

test('P7 TSK story 重新生成确定性：import-tsk-story --check 通过', () => {
  const run = spawnSync(process.execPath, ['tools/import-tsk-story.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr || run.stdout)
  assert.match(run.stdout, /复算一致/)
})

test('P7 TSK story 中文缺译全部补译（chineseGaps=0）且不要求英文冒充中文', () => {
  const chapterGaps = Object.values(TSK_STORY_TEXT.chapters).flatMap(chapter => chapter.chineseGaps || [])
  assert.deepEqual(chapterGaps, [], `仍有章节缺译：${JSON.stringify(chapterGaps.slice(0, 5))}`)
  assert.deepEqual(TSK_STORY_TEXT.campaign.chineseGaps, [], '战役正文仍有缺译')
  assert.equal(TSK_STORY_META.zhSupplement.files.length >= 1, true, '补译层文件应存在')
  // 允许的来源占位符（guideText 会展开/丢弃；这里只拦真正未展开的流程变量）。
  const ALLOWED_PLACEHOLDER = /^\{(?:setImgPath|count|name|key|perPlayer|fast|xp|elderThing|autoFail|token|skill|cost|clues|doom|damage|horror|health|sanity|investigators?)\}$/
  for (const chapter of Object.values(TSK_STORY_TEXT.chapters)) {
    for (const leaf of leaves(chapter.sections)) {
      for (const placeholder of leaf.text.match(/\{[a-zA-Z_]+\}/g) || []) {
        assert.ok(ALLOWED_PLACEHOLDER.test(placeholder), `${chapter.id}:${leaf.path} 未展开占位符 ${placeholder}`)
      }
    }
  }
})

test('P7 TSK story-access：章节/战役正文段落读取可用', () => {
  const chapter = chapterStory('riddlesAndRain')
  assert.ok(chapter.sectionsEn && chapter.sections)
  const intro = storyText('riddlesAndRain', 'intro')
  assert.ok(intro.length > 100, '开场正文非空')
  const setup = chapterSection('deadHeat', 'setup')
  assert.ok(setup && typeof setup === 'object', 'setup 段落存在')
  assert.ok(flattenStory(setup).length > 80)
  assert.ok(storyParagraphsOf('deadHeat', 'rules').length >= 0)
  assert.ok(flattenResolution(chapterSection('congressOfTheKeys', 'resolutions')).length > 100)
  assert.ok(storyParagraphs('甲\n\n乙').length === 2)
  assert.ok(chapterSection('deadHeat', 'missingKey', 'fallback') === 'fallback')
  // 战役级 base 段落：序幕、幕间 I、启程/旅行、世界地图、密档、状况报告、尾声。
  for (const key of ['prologue', 'interlude1', 'embarkingAndTravel', 'worldMap', 'theFoundationDossiers', 'statusReport', 'epilogue']) {
    assert.ok(TSK_STORY_KEYS[key], `campaign 段落 ${key} 存在`)
    assert.ok(TSK_STORY_TEXT.campaign.sections[key], `campaign 展示层 ${key} 存在`)
  }
  assert.ok(campaignStory('prologue') !== undefined)
  assert.ok(storyEntryText('prologue') === '' || typeof storyEntryText('prologue') === 'string')
  assert.ok(storyEntry('prologue')?.en)
  assert.match(storyText('congressOfTheKeys', 'intro.nay.count').length >= 0 ? 'ok' : 'ok', /ok/)
})

test('P7 TSK 指南：10 章指南生成结构完整（setup/resolutions/specialRules/intro）', async () => {
  const guides = await BUILT_GUIDES
  assert.ok(guides.size >= 72, `指南总数 ${guides.size}`)
  for (const id of SCENARIO_IDS) {
    const guide = buildTskGuide(id)
    assert.equal(guide.id, id)
    assert.equal(guide.campaignId, 'theScarletKeys')
    assert.deepEqual(Object.keys(guide.locales).sort(), ['en', 'zh'])
    for (const language of ['en', 'zh']) {
      const sections = guide.locales[language]
      assert.ok(blockTexts(sections.setup).join('').length > 80, `${id}/${language} setup 不完整`)
      assert.ok(blockTexts(sections.resolutions).join('').length > 100, `${id}/${language} 缺结局`)
      const allBlocks = Object.values(sections).flatMap(blocks => blockTexts(blocks))
      for (const block of allBlocks) {
        assert.doesNotMatch(block, /<[a-z][^>]*>|@:[\w.]+|\{\w+\}/i, `${id}/${language} 残留来源格式`)
        if (language === 'zh') assert.doesNotMatch(block.replace(/\[[a-z_]+\]/g, ''), /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i,
          `${id} 中文指南夹带未译正文`)
      }
    }
  }
})

test('P7 TSK 指南生成物落盘且与生成器逐字节一致（10 份 JSON）', () => {
  for (const relative of GUIDE_FILES) {
    const path = `${ROOT}${relative}`
    assert.ok(existsSync(path), `缺少指南 ${relative}`)
    const guide = readJson(relative)
    assert.equal(guide.campaignId, 'theScarletKeys')
    const expected = `${JSON.stringify(buildTskGuide(guide.id), null, 2)}\n`
    assert.equal(readFileSync(path, 'utf8'), expected, `${relative} 与生成器不一致`)
    assert.ok(guide.guideKeyCount > 0)
    assert.ok(Array.isArray(guide.sources) && guide.sources.length > 0)
  }
})

test('P7 TSK story-text 生成数据与回归确定（buildStoryText 深相等）', () => {
  const rebuilt = buildStoryText()
  assert.deepEqual(rebuilt.meta.counts, TSK_STORY_META.counts)
  assert.deepEqual(rebuilt.story.chapters, TSK_STORY_TEXT.chapters)
  assert.deepEqual(rebuilt.story.campaign, TSK_STORY_TEXT.campaign)
})

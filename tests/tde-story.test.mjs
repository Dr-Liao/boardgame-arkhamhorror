// 食梦者 P8-T：剧情自译（story-source → story-text.js → 章节/幕间/尾声接线）验收。
//
// 口径（路线图 §8.5 / docs/tde-story.md / D2）：
//   · 中文剧情是自译，不是官方中文（sourceKind/officialChinese 两个字段必须诚实）；
//   · 覆盖：14 个翻译批次逐 key 对应 en locale 可翻译条目（510 key），缺一即失败；
//   · 结构：8 章 narrative/setup/resolutions、3 幕间、16 段尾声矩阵、55 记录标签、序章 3 段；
//   · 正文质量：无 HTML、无 {占位模板}、除 XP 外无英文残留、段落与英文逐段对应（生成器已校验）；
//   · 接线：8 章 definition 的 intro/setup/resolutions 与幕间/尾声正文都来自 story-text（中文）；
//   · 生成器 --check 与 check:tde:terms 必须通过，账本 gate pass。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  TDE_STORY_META, TDE_STORY_TEXT, TDE_STORY_KEYS, storyInventory, tdeStoryChapter,
} from '../content/campaigns/theDreamEaters/story-text.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import { TDE_INTERLUDE_TEXT } from '../content/campaigns/theDreamEaters/interludes.js'
import { TDE_EPILOGUE_MATRIX, TDE_SINGLE_LINE_EPILOGUE } from '../content/campaigns/theDreamEaters/dual-story.js'
import {
  BATCH_FILES, assemble, batchFilePath, EN_FILES, SCENARIO_IDS,
} from '../tools/import-tde-story.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const readJson = relative => JSON.parse(readFileSync(`${ROOT}${relative}`, 'utf8'))
const run = (script, args = []) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' })

// 中文文本里不允许出现的结构性残留；英文专名/术语已在生成器与术语检查中拦截。
const latinWord = /[A-Za-z]{4,}/g
const latinAllow = new Set(['XP'])
const scanStrings = (value, where, problems) => {
  if (typeof value === 'string') {
    if (/<[a-zA-Z/]/.test(value)) problems.push(`${where}: 含 HTML`)
    if (value.includes('{')) problems.push(`${where}: 含 {占位模板}`)
    // 图标记号 [skull]/[elder_thing] 是 UI 记号（生成器已校验数量），不算英文残留。
    const stripped = value.replace(/\[[a-z_]+\]/g, '')
    for (const match of stripped.matchAll(latinWord)) {
      if (!latinAllow.has(match[0])) problems.push(`${where}: 英文残留 ${match[0]}`)
    }
    return
  }
  if (Array.isArray(value)) { value.forEach((child, index) => scanStrings(child, `${where}[${index}]`, problems)); return }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // 来源/位置键是英文标识符，不是正文。
      if (['source', 'key', 'textKey', 'titleKey', 'labelKey', 'status', 'id'].includes(key)) continue
      scanStrings(child, `${where}.${key}`, problems)
    }
  }
}

test('P8-T meta：自译来源诚实字段 + 来源锁', () => {
  assert.equal(TDE_STORY_META.status, 'translated')
  assert.equal(TDE_STORY_META.stage, 'P8-T')
  assert.equal(TDE_STORY_META.sourceKind, 'self-translated')
  assert.equal(TDE_STORY_META.officialChinese, false)
  assert.equal(TDE_STORY_META.generator, 'tools/import-tde-story.mjs')
  assert.ok(TDE_STORY_META.glossaryVersion, '必须有术语表版本')
  assert.equal(Object.keys(TDE_STORY_META.enSourceHashes).length, EN_FILES.length)
  for (const file of EN_FILES) assert.match(TDE_STORY_META.enSourceHashes[file], /^[0-9a-f]{64}$/)
  assert.equal(TDE_STORY_META.completedBatches.length, BATCH_FILES.length)
  assert.deepEqual(TDE_STORY_META.pendingBatches, [])
  assert.match(TDE_STORY_META.generatedSha256, /^[0-9a-f]{64}$/)
  assert.ok(TDE_STORY_META.chars.en > 100000 && TDE_STORY_META.chars.zh > 30000,
    `字符量异常：en=${TDE_STORY_META.chars?.en} zh=${TDE_STORY_META.chars?.zh}`)
})

test('P8-T 批次覆盖：14 批全部完成，逐 key 对应 en 源', async () => {
  for (const id of BATCH_FILES) {
    assert.ok(existsSync(batchFilePath(id)), `缺少批次文件 ${id}`)
    const batch = readJson(`content/campaigns/theDreamEaters/story-source/batch-${id}.json`)
    assert.equal(batch.schemaVersion, 1)
    assert.equal(batch.batch, id)
    assert.ok(batch.translator, `批次 ${id} 缺 translator`)
    assert.deepEqual(batch.review, { self: true, termsChecked: true })
  }
  const result = await assemble()
  assert.deepEqual(result.missingBatches, [])
  assert.deepEqual(result.problems, [])
})

test('P8-T story-text 结构：8 章 / 3 幕间 / 16 尾声 / 55 记录标签', () => {
  const inventory = storyInventory()
  assert.equal(inventory.chapters, 8)
  assert.equal(inventory.interludes, 3)
  assert.equal(inventory.epilogueCells, 16)
  assert.equal(inventory.recordLabels, 55)
  assert.equal(inventory.batches, 14)
  assert.equal(inventory.status, 'translated')
  assert.equal(inventory.prologueSections, 3)
  assert.ok(inventory.narrativeSections > 40, `叙事段数过少：${inventory.narrativeSections}`)
  assert.ok(inventory.resolutions >= 30, `结局文本过少：${inventory.resolutions}`)

  assert.equal(TDE_STORY_TEXT.prologue.opening.paragraphs.length >= 1, true)
  assert.equal(TDE_STORY_TEXT.prologue.prologue.paragraphs.length >= 5, true)
  assert.equal(TDE_STORY_TEXT.prologue.structure.paragraphs.length >= 3, true)

  for (const chapter of chapters) {
    const story = tdeStoryChapter(chapter.id)
    assert.ok(story, `缺章节剧情 ${chapter.id}`)
    assert.equal(story.status, 'translated')
    assert.equal(story.title, chapter.name)
    assert.match(story.heading, /^剧本\s*(I|II|III|IV)/)
    assert.ok(story.intro && story.intro.length > 40, `${chapter.id} intro 过短`)
    assert.ok(story.setup && story.setup.length > 40, `${chapter.id} setup 过短`)
    assert.ok(Object.keys(story.resolutions).length >= 2, `${chapter.id} 结局过少`)
    assert.ok(story.narration.length >= 3, `${chapter.id} 叙事段过少`)
  }

  const interludeKeys = Object.keys(TDE_STORY_TEXT.interludes)
  assert.deepEqual(interludeKeys, ['interlude1', 'interlude2', 'interlude3'])
  for (const id of interludeKeys) {
    assert.ok(TDE_STORY_TEXT.interludes[id].sections.length >= 5, `${id} 段落过少`)
  }
  const cellIds = TDE_STORY_TEXT.epilogue.cells.map(cell => cell.id)
  assert.deepEqual(cellIds, Array.from({ length: 16 }, (_, index) => index + 1))
  assert.ok(TDE_STORY_TEXT.epilogue.special.brokeTheLawOfUlthar.paragraphs.length >= 1)
})

test('P8-T 正文质量：无 HTML / 无占位模板 / 除 XP 外无英文残留', () => {
  const problems = []
  scanStrings({
    prologue: TDE_STORY_TEXT.prologue,
    labels: TDE_STORY_TEXT.labels,
    questions: TDE_STORY_TEXT.questions,
    recordLabels: TDE_STORY_TEXT.recordLabels,
    specialRules: TDE_STORY_TEXT.specialRules,
    additionalRules: TDE_STORY_TEXT.additionalRules,
    interludes: TDE_STORY_TEXT.interludes,
    epilogue: TDE_STORY_TEXT.epilogue,
    chapters: TDE_STORY_TEXT.chapters,
    localeKeys: TDE_STORY_KEYS,
  }, 'story-text', problems)
  assert.deepEqual(problems.slice(0, 20), [], `正文残留问题：\n${problems.slice(0, 20).join('\n')}`)
})

test('P8-T 生成器与术语门禁可复算', () => {
  const generated = run('tools/import-tde-story.mjs', ['--check'])
  assert.equal(generated.status, 0, generated.stderr || generated.stdout)
  const terms = run('tools/check-tde-terms.mjs')
  assert.equal(terms.status, 0, terms.stderr || terms.stdout)
})

test('P8-T 逐章账本 storyText=true 且 gate pass', () => {
  const ledger = readJson('audit/tde-story-acceptance.json')
  assert.equal(ledger.status, 'translated')
  assert.equal(ledger.sourceKind, 'self-translated')
  assert.equal(ledger.officialChinese, false)
  assert.equal(ledger.gate.pass, true)
  assert.equal(ledger.coverage.totalKeys, 510)
  assert.equal(ledger.coverage.translatedKeys, 510)
  assert.ok(ledger.coverage.excludedKeys > 0, '必须记录排除的 UI 数据 key 与理由')
  for (const batch of ledger.batches) assert.equal(batch.status, 'translated')

  const acceptance = readJson('audit/tde-scenario-acceptance.json')
  assert.equal(acceptance.summary.storyText, 'translated')
  for (const item of acceptance.items) {
    assert.equal(item.checks.storyText, true, `${item.id} storyText 应为 true`)
    assert.ok(item.notes.storyText.sourceKind === 'self-translated')
    assert.ok(!/(P8-T 前|待 P8-T|属 P8-T|P8-T 未开工)/.test(item.remaining.join('\n')), `${item.id} remaining 仍有 P8-T 待办`)
  }
  assert.ok(!acceptance.remaining.some(line => line.includes('中文剧情自译未开工')))
})

test('P8-T 章节/幕间/尾声正文已切到中文', () => {
  // 章节：definition 的 intro/setup/resolutions 必须是中文（由 story-text 提供）。
  for (const chapter of chapters) {
    const story = tdeStoryChapter(chapter.id)
    const definitionPath = `content/campaigns/theDreamEaters/scenarios/${chapter.id}/definition.js`
    assert.ok(existsSync(`${ROOT}${definitionPath}`))
    // definition 文本字段 = story-text 的对应字段（逐字一致，不做二次包装）。
    const source = readFileSync(`${ROOT}${definitionPath}`, 'utf8')
    assert.ok(!/textStatus:\s*'pending-self-translation'/.test(source), `${chapter.id} definition 仍是 en 占位`)
    const latin = [...String(story.intro).matchAll(latinWord)].filter(m => !latinAllow.has(m[0]))
    assert.deepEqual(latin, [], `${chapter.id} intro 仍含英文：${latin.slice(0, 3)}`)
  }
  // 幕间：interludes.js 导出的正文来自 story-text 中文（节点实例化后 pendingTranslation=false）。
  const interludeEntries = Object.values(TDE_INTERLUDE_TEXT)
  assert.ok(interludeEntries.length >= 32, '幕间文本缺失')
  assert.ok(interludeEntries.every(entry => entry.pendingTranslation === false), 'interludes 仍有未译条目')
  assert.ok(interludeEntries.every(entry => /[\u4e00-\u9fff]/.test(entry.text)), 'interludes 正文应为中文')
  // 尾声：dual-story 的 16 格 / 特殊尾声标题与正文进入中文。
  assert.equal(Object.keys(TDE_EPILOGUE_MATRIX.entries).length, 16)
  assert.ok(TDE_SINGLE_LINE_EPILOGUE, '单线结束说明缺失')
})

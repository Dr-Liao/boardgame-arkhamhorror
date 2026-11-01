#!/usr/bin/env node
// 《食梦者》剧情自译术语与正文一致性检查（P8-T / `check:tde:terms`）。
//
// 检查对象：`content/campaigns/theDreamEaters/story-source/batch-*.json` 的**中文译文**，
// 以及生成后的 `story-text.js`（存在时校验 meta/记录标签）。
// 检查项（全部来自 `story-terms.js` 与作业书 §3，不另立口径）：
//   1. 高风险错误词形（梦境之地/群集/隐蔽/隐藏手牌/调查者/旧日支配者…）；
//   2. 关键词一致性：英文出现 Myriad/Swarming/Veiled/Researched/Alert/Hidden/Bonded 时，中文必须含对应词；
//   3. 标题格式：章节 heading「剧本 <罗马数字>–<A|B>」、resolution「结局 N/无结局」、尾声「尾声 N」、
//      幕间「幕间 I/II/III」、question 以「？」结尾；
//   4. 标点：中文正文不得出现半角 , . ; : ! ?（数字/缩写如 "XP" 除外）；
//   5. meta 诚实字段：sourceKind='self-translated'、officialChinese=false；
//   6. 生成物存在时：55 记录标签与 record-labels.js 一致、storyText 覆盖 8 章。
//
// 用法：node tools/check-tde-terms.mjs            # 检查并打印
//       node tools/check-tde-terms.mjs --json     # 机器可读
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { RECORD_LABELS } from '../content/campaigns/theDreamEaters/record-labels.js'
import {
  TDE_CHAPTER_TITLES, TDE_FORBIDDEN_VARIANTS, TDE_KEYWORD_TERMS, TDE_STORY_TERMS_META,
} from '../content/campaigns/theDreamEaters/story-terms.js'
import {
  BATCHES, BATCH_FILES, batchKeys, collectTranslatable, loadEnSources, readBatchFile, SCENARIO_IDS,
} from './import-tde-story.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const STORY_TEXT_FILE = path.join(ROOT, 'content/campaigns/theDreamEaters/story-text.js')

const chapterTitles = new Map(TDE_CHAPTER_TITLES.map(entry => [entry.id, entry.zh]))
const keywordChecks = TDE_KEYWORD_TERMS.map(entry => ({ en: new RegExp(`\\b${entry.en}\\b`, 'i'), zh: entry.zh, word: entry.en }))

// 半角标点：中文正文里出现即报（排除数字小数、英文缩写与卡号）。
const halfWidthPunctuation = /[,;:!?]|(?<![0-9A-Za-z])\.(?![0-9A-Za-z])/g

function checkTitles(key, zh, problems, source) {
  const base = key.split('#')[1] || ''
  const leaf = base.replace(/\[\d+\]/g, '') // resolutions[0].title → resolutions.title
  if (/(^|\.)heading$/.test(leaf)) {
    if (!/^剧本\s*(I|II|III|IV)\s*[–-]\s*[AB]/.test(zh)) problems.push(`${key} 标题格式应为「剧本 I–A：…」，实际「${zh.slice(0, 30)}」`)
  }
  if (/resolutions\.[^.]+\.title$/.test(base) || /^resolutions\.title$/.test(leaf)) {
    if (!/^(无结局|结局\s*\d+)/.test(zh)) problems.push(`${key} 结局标题应为「结局 N」或「无结局」，实际「${zh}」`)
  }
  if (/flavorText\.epilogue\d+\.title$/.test(base)) {
    if (!/^尾声\s*\d+$/.test(zh)) problems.push(`${key} 尾声标题应为「尾声 N」，实际「${zh}」`)
  }
  if (/^flavorText\.(prologue|prologueOpening|campaignStructure)\.title$/.test(base)) {
    if (!/(序章|清醒世界|战役结构)/.test(zh)) problems.push(`${key} 序章/结构标题不含预期词，实际「${zh}」`)
  }
  if (/^flavorText\.(theBlackCat|theOneironauts1|theGreatOnes1)\.title$/.test(base)) {
    if (!/^幕间\s*(I|II|III)/.test(zh)) problems.push(`${key} 幕间标题应为「幕间 I/II/III：…」，实际「${zh}」`)
  }
  if (/^question\.[^.]+$/.test(base) && source?.clean?.trim().endsWith('?') && !zh.endsWith('？')) {
    problems.push(`${key} 问题句应以「？」结尾，实际「${zh}」`)
  }
}

function checkOne(key, zh, problems, source) {
  for (const rule of TDE_FORBIDDEN_VARIANTS) {
    if (new RegExp(rule.pattern).test(zh)) problems.push(`${key} 命中错误词形「${rule.pattern}」→ 应为「${rule.correct}」`)
  }
  for (const matcher of keywordChecks) {
    // 关键词一致性由生成器按英文源校验；这里只查「中文里出现英文关键词却无中文词」的反向情况。
    if (matcher.en.test(zh) && !zh.includes(matcher.zh)) problems.push(`${key} 中文里出现 ${matcher.word} 但缺「${matcher.zh}」`)
  }
  checkTitles(key, zh, problems, source)
  const stripped = zh.replace(/\[[a-z_]+\]/g, '').replace(/XP/g, '')
  const punctuation = [...stripped.matchAll(halfWidthPunctuation)].map(match => match[0])
  if (punctuation.length) problems.push(`${key} 含半角标点 ${JSON.stringify(punctuation.slice(0, 5))}（叙事/规则文本用全角）`)
}

async function main() {
  const jsonMode = process.argv.includes('--json')
  const problems = []
  const notes = []
  const en = await loadEnSources()
  const { entries } = collectTranslatable(en)
  const stats = { batches: 0, keys: 0, zhChars: 0, missingBatches: [] }
  for (const id of BATCH_FILES) {
    const read = await readBatchFile(id)
    if (!read.data) { stats.missingBatches.push(id); continue }
    stats.batches += 1
    for (const [key, value] of Object.entries(read.data.entries || {})) {
      if (typeof value !== 'string') { problems.push(`${key} 不是字符串`); continue }
      stats.keys += 1
      stats.zhChars += value.length
      checkOne(key, value.trim(), problems, entries.get(key))
    }
  }

  // 生成物检查（存在时）。
  if (existsSync(STORY_TEXT_FILE)) {
    const module = await import(`${pathToFileURL(STORY_TEXT_FILE).href}?terms=${Date.now()}`)
    const { TDE_STORY_META, TDE_STORY_TEXT } = module
    if (TDE_STORY_META.sourceKind !== 'self-translated') problems.push('meta.sourceKind 必须为 self-translated')
    if (TDE_STORY_META.officialChinese !== false) problems.push('meta.officialChinese 必须为 false')
    if (TDE_STORY_META.status !== 'translated') notes.push(`meta.status=${TDE_STORY_META.status}（尚未翻译完成时允许）`)
    if (TDE_STORY_META.glossaryVersion !== TDE_STORY_TERMS_META.version) problems.push('meta.glossaryVersion 与 story-terms.js 不一致')
    for (const [key, value] of Object.entries(RECORD_LABELS)) {
      if (TDE_STORY_TEXT.recordLabels?.[key] !== value) problems.push(`记录标签 ${key} 与 record-labels.js 不一致`)
    }
    const missingChapters = SCENARIO_IDS.filter(id => TDE_STORY_TEXT.chapters?.[id]?.status !== 'translated')
    if (missingChapters.length) notes.push(`章节未翻译：${missingChapters.join(', ')}`)
    const chapterTitlesSeen = SCENARIO_IDS.filter(id => TDE_STORY_TEXT.chapters?.[id]?.title === chapterTitles.get(id))
    if (chapterTitlesSeen.length !== SCENARIO_IDS.length) problems.push('story-text 的章节标题与 shared.js 中文名不一致')
  } else {
    notes.push('story-text.js 尚未生成')
  }

  const unique = [...new Set(problems)]
  const report = { ok: unique.length === 0, stats, notes, problems: unique.slice(0, 200) }
  if (jsonMode) { console.log(JSON.stringify(report, null, 2)) } else if (report.ok) {
    console.log(`check:tde:terms OK：${stats.batches} 批 / ${stats.keys} key / ${stats.zhChars} 中文字符；术语/标题/标点/meta 全部一致`)
    for (const note of notes) console.log(`  · ${note}`)
  } else {
    console.error(`check:tde:terms FAILED：${unique.length} 个问题`)
    for (const problem of unique.slice(0, 100)) console.error(`  - ${problem}`)
    process.exitCode = 1
  }
}

await main()

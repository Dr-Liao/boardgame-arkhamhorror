// 导出《绯红密钥》story-text 的中文缺译清单（含英文原文），供本地补译层使用。
//
//   node tools/export-tsk-story-gaps.mjs --write   → artifacts/migration/tsk/story-gaps.json
//   node tools/export-tsk-story-gaps.mjs           打印摘要
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TSK_STORY_TEXT } from '../content/campaigns/theScarletKeys/story-text.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = fileURLToPath(new URL('../../../artifacts/migration/tsk/', import.meta.url))
const REFERENCE = fileURLToPath(new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/en/theScarletKeys/', import.meta.url))

const readJson = path => JSON.parse(readFileSync(join(REFERENCE, path), 'utf8'))
const leaves = (value, path = '') => {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((child, index) => leaves(child, path ? `${path}.${index}` : String(index)))
  return Object.entries(value || {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
}

export function buildStoryGaps() {
  const entries = []
  const campaign = readJson('base.json')
  const campaignLeaves = new Map(leaves(campaign).map(row => [row.path, row.text]))
  for (const gap of TSK_STORY_TEXT.campaign.chineseGaps) {
    entries.push({ file: 'base.json', path: gap.path, status: gap.status, en: campaignLeaves.get(gap.path) ?? null })
  }
  for (const [id, chapter] of Object.entries(TSK_STORY_TEXT.chapters)) {
    if (!chapter.chineseGaps?.length) continue
    const file = `scenarios/${id}.json`
    const enLeaves = new Map(leaves(readJson(file)).map(row => [row.path, row.text]))
    for (const gap of chapter.chineseGaps) {
      entries.push({ file, path: gap.path, status: gap.status, en: enLeaves.get(gap.path) ?? null })
    }
  }
  return {
    schemaVersion: 1,
    generatedBy: 'tools/export-tsk-story-gaps.mjs',
    target: 'content/campaigns/theScarletKeys/locale-supplement/*.json',
    total: entries.length,
    byStatus: {
      missing: entries.filter(entry => entry.status === 'missing').length,
      untranslated: entries.filter(entry => entry.status === 'untranslated').length,
    },
    entries,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = buildStoryGaps()
  if (process.argv.includes('--write')) {
    mkdirSync(RUN, { recursive: true })
    writeFileSync(join(RUN, 'story-gaps.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(`tsk story gaps: 已写入（${report.total} 条：missing ${report.byStatus.missing} / untranslated ${report.byStatus.untranslated}）`)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
}

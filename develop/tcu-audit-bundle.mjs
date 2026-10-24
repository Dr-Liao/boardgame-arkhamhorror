// P10 逐卡行为审计的只读材料包：给审计 agent 每批卡一次输出
//   node develop/tcu-audit-bundle.mjs 05043 05044 ...
// 每条包含：印刷字段（cards-data）、单卡条目源码、内容层引用位置、章节/玩家测试里提到该卡号的用例名。
// 只读；不写任何文件。审计结论由 Lead 汇总进 content/campaigns/theCircleUndone/card-acceptance.js。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '')
const { ALL_CARDS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))

const CARD_FIELDS = [
  'code', 'name', 'nameZh', 'type', 'subtype', 'klass', 'xp', 'cost', 'slot', 'slots',
  'traits', 'traitsZh', 'text', 'textZh', 'flavorZh', 'backTextZh', 'backText',
  'health', 'sanity', 'fight', 'evade', 'damage', 'horror', 'doom', 'clues', 'shroud',
  'victory', 'quantity', 'linkedCardCode', 'linkedToCode', 'bondedCards', 'bondedTo',
  'bondedCount', 'encounterCode', 'pack', 'packCode', 'signatureFor', 'permanent',
  'exceptional', 'ignoreDeckLimit', 'doubleSided', 'dataStatus',
]

const walk = (directory, result = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, result)
    } else if (entry.isFile()) result.push(full)
  }
  return result
}

const tcuFiles = walk(join(ROOT, 'content/campaigns/theCircleUndone')).filter(file => file.endsWith('.js'))
const entryFiles = walk(join(ROOT, 'src/cards/entries')).filter(file => file.endsWith('.js'))
const encounterFiles = walk(join(ROOT, 'src/cards/encounter-entries')).filter(file => file.endsWith('.js'))
const testFiles = walk(join(ROOT, 'tests')).filter(file => /tcu-.*\.test\.mjs$/.test(file))
const relative = file => file.slice(ROOT.length).replace(/^[\\/]/, '').replaceAll('\\', '/')

const entryFor = code => {
  const normalized = file => file.replaceAll('\\', '/')
  const player = entryFiles.find(file => normalized(file).endsWith(`/${code}.js`))
  if (player) return relative(player)
  const encounter = encounterFiles.find(file => normalized(file).endsWith(`/${code}.js`))
  return encounter ? relative(encounter) : null
}

const sourceOf = path => {
  if (!path) return null
  try {
    return readFileSync(join(ROOT, path), 'utf8')
  } catch {
    return null
  }
}

const contentRefs = code => {
  const refs = []
  for (const file of tcuFiles) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    const matches = lines.map((line, index) => [index + 1, line.trim()])
      .filter(([, line]) => line.includes(code))
      .slice(0, 14)
    if (matches.length) refs.push({ file: relative(file), matches })
  }
  return refs
}

const testRefs = code => {
  const refs = []
  for (const file of testFiles) {
    const text = readFileSync(file, 'utf8')
    const names = [...text.matchAll(/test\(\s*['"`]([^'"`]+)['"`]/g)].map(match => match[1])
      .filter(name => name.includes(code))
      .slice(0, 6)
    if (names.length) refs.push({ file: relative(file), tests: names })
  }
  return refs
}

const args = process.argv.slice(2)
let codes = []
let batch = null
if (args[0] === '--batch') {
  const batches = JSON.parse(readFileSync(join(ROOT, 'artifacts/tcu-audit/batches.json'), 'utf8'))
  batch = batches.batches.find(item => item.id === args[1])
  if (!batch) {
    console.error(`未知批次：${args[1]}`)
    process.exit(1)
  }
  codes = batch.codes
} else {
  codes = args.filter(code => /^05\d{3}[a-z]?$/.test(code))
}
if (!codes.length) {
  console.error('用法：node develop/tcu-audit-bundle.mjs 05043 05044 ... | --batch <id>')
  process.exit(1)
}
const output = { batch: batch ? { id: batch.id, kind: batch.kind, chapterId: batch.chapterId || null,
  testFile: batch.testFile || null, codes: batch.codes } : null }
output.cards = codes.map(code => {
  const card = ALL_CARDS[code]
  if (!card) return { code, error: '目录里没有这张卡' }
  const printed = Object.fromEntries(CARD_FIELDS.filter(field => card[field] !== undefined)
    .map(field => [field, card[field]]))
  const entryPath = entryFor(code)
  return {
    code,
    printed,
    entryPath,
    entrySource: sourceOf(entryPath),
    contentRefs: contentRefs(code),
    testRefs: testRefs(code),
  }
})
console.log(JSON.stringify(output, null, 1))

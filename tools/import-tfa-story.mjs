// 从随仓库保存的中文剧情来源生成失落的时代（三循环）叙事正文。
// 布置、路由、奖励与记录写入仍由规则引擎执行；本文件只产出可阅读的正文。
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/theForgottenAge/', import.meta.url)
const target = new URL('../content/campaigns/theForgottenAge/story-text.js', import.meta.url)

const scenarioIds = [
  'theUntamedWilds', 'theDoomOfEztli', 'threadsOfFate', 'theBoundaryBeyond',
  'heartOfTheEldersPart1', 'heartOfTheEldersPart2', 'theCityOfArchives',
  'theDepthsOfYoth', 'shatteredAeons', 'turnBackTime',
]

// 久远腹地是同一张剧本卡的两半，剧情分别放在 part1 / part2 下（见 SOURCE_FILES）。

const decode = text => text
  .replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'")

// 参考 zh locale 用 `{cultist}` / `{elderSign}` 写混乱标记；运行时卡文只认 `[cultist]` / `[elder_sign]`
// 方括号 token（web/card-text.js#SYMBOLS）。保留 supplies.choose 的 `{pointsRemaining}`（补给选择器会插值）。
const SYMBOL_TOKENS = Object.freeze({
  action: 'action', reaction: 'reaction', free: 'free', fast: 'free',
  willpower: 'willpower', intellect: 'intellect', combat: 'combat', agility: 'agility', wild: 'wild',
  skull: 'skull', cultist: 'cultist', tablet: 'tablet', elderThing: 'elder_thing',
  elderSign: 'elder_sign', autoFail: 'auto_fail', perInvestigator: 'per_investigator',
})

function clean(text) {
  return decode(String(text))
    .replace(/<ul\b[\s\S]*?<\/ul>/gi, ' ')
    .replace(/<section\b[\s\S]*?<\/section>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    .replace(/[\*_]/g, '')
    .replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) => Object.hasOwn(SYMBOL_TOKENS, name) ? `[${SYMBOL_TOKENS[name]}]` : match)
    .replace(/^（?(?:引言|梦境|结局)[^：:]{0,20}[：:]\s*/u, '')
    .replace(/^如果未达成任何结局[^：:]*[：:]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// 只取叙事段落：`p.basic` 是规则提示，`ul` 列表是记录/奖励指令，都不属于正文。
// 参考资源里存在没有闭合 `</p>` 的段落，因此按 `<p` 起始切块而不是靠闭合标签匹配。
export function narrativeParagraphs(html = '') {
  const source = String(html)
  if (!/<p\b/i.test(source)) {
    const single = clean(source)
    return single ? [single] : []
  }
  const paragraphs = []
  for (const chunk of source.split(/<p\b/i).slice(1)) {
    const end = chunk.indexOf('>')
    if (end < 0) continue
    const attrs = chunk.slice(0, end)
    if (/\bbasic\b/i.test(attrs)) continue
    const body = chunk.slice(end + 1).replace(/<\/p\s*>/gi, ' ')
    const text = clean(body)
    if (text) paragraphs.push(text)
  }
  return paragraphs
}

const SKIP_KEYS = new Set(['label', 'instructions', 'title', 'setup', 'tokens', 'tooltips', 'ui', 'standalone', 'xp', 'extraXp'])

function flatten(value, prefix, out) {
  if (typeof value === 'string') {
    const paragraphs = narrativeParagraphs(value)
    if (prefix && paragraphs.length) out[prefix] = paragraphs
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (SKIP_KEYS.has(key)) continue
    flatten(entry, prefix ? `${prefix}.${key}` : key, out)
  }
}

function introSections(intro) {
  const sections = {}
  if (!intro) return sections
  for (const [key, value] of Object.entries(intro)) {
    if (SKIP_KEYS.has(key)) continue
    flatten(value, key, sections)
  }
  return sections
}

const readJson = async path => JSON.parse(await readFile(new URL(path, sourceRoot), 'utf8'))
const base = await readJson('base.json')
// 久远腹地（上/下）共用一个剧本卡：upstream 的 `heartOfTheEldersPart1/2.json` 只译了 tokens/label，
// intro/resolutions 仍是英文；完整中文在 `heartOfTheElders.json` 的 part1/part2 下。
// 其余章节各自一份文件。这里按 [文件, part] 声明来源，避免把英文占位稿生成进运行时。
const SOURCE_FILES = Object.fromEntries(scenarioIds.map(id => [id, { file: `scenarios/${id}.json`, part: null }]))
SOURCE_FILES.heartOfTheEldersPart1 = { file: 'scenarios/heartOfTheElders.json', part: 'part1' }
SOURCE_FILES.heartOfTheEldersPart2 = { file: 'scenarios/heartOfTheElders.json', part: 'part2' }
const uniqueFiles = [...new Set(Object.values(SOURCE_FILES).map(source => source.file))]
const rawFiles = Object.fromEntries(await Promise.all(uniqueFiles.map(async file => [file, await readJson(file)])))
const files = Object.fromEntries(Object.entries(SOURCE_FILES).map(([id, source]) => [
  id, source.part ? rawFiles[source.file][source.part] : rawFiles[source.file],
]))

function sourcesFor(id) {
  const data = files[id]
  return {
    intro: data.intro || null,
    resolutions: data.resolutions || {},
    title: data.intro?.title || data.title || data.heading || id,
  }
}

const introductions = Object.fromEntries(scenarioIds.map(id => {
  const source = sourcesFor(id)
  const sections = introSections(source.intro)
  return [id, { title: source.title, sections }]
}))

const resolutions = Object.fromEntries(scenarioIds.map(id => {
  const source = sourcesFor(id)
  const mapped = {}
  for (const [key, value] of Object.entries(source.resolutions || {})) {
    const destination = key === 'noResolution' || key === 'defeated'
      ? 'noResolution' : /^resolution\d+$/.test(key) ? `r${key.slice(10)}` : null
    if (!destination) continue
    const paragraphs = narrativeParagraphs(value?.body || value || '')
    if (paragraphs.length) mapped[destination] = paragraphs
  }
  return [id, mapped]
}))

const story = {
  source: '参考资源/ArkhamHorror-main/frontend/src/locales/zh/theForgottenAge',
  prologue: {
    title: base.prologue.title,
    sections: introSections(base.prologue),
  },
  introductions,
  resolutions,
  interludes: {
    interludeOne: { title: base.interlude1.title, sections: introSections(base.interlude1) },
    interludeTwo: { title: base.interlude2.title, sections: introSections(base.interlude2) },
    interludeThree: { title: base.interlude3.title, sections: introSections(base.interlude3) },
    interludeFour: { title: base.interlude4.title, sections: introSections(base.interlude4) },
    interludeFive: { title: base.interlude5.title, sections: introSections(base.interlude5) },
    resupplyPoint: { title: base.resupplyPoint.title || '补给点', sections: introSections(base.resupplyPoint) },
  },
  epilogue: { title: base.epilogue.title, sections: introSections(base.epilogue) },
  supplies: { title: base.supplies.title, choose: base.supplies.choose, options: Object.keys(base.supplies).filter(key => !['title', 'choose', 'chosen'].includes(key)) },
}

// ---------------------------------------------------------------------------
// 本仓补译层：参考 zh locale 里个别正文仍为英文（如 heartOfTheElders 上篇 resolution2）。
// 补译按生成物点路径覆盖叙事段落数组，并在 story-text.js 里登记来源哈希；缺失/带英文直接抛错。
// ---------------------------------------------------------------------------
const supplementSource = new URL('../content/campaigns/theForgottenAge/story-supplements.json', import.meta.url)
const supplementRaw = await readFile(supplementSource)
const supplements = JSON.parse(supplementRaw.toString('utf8'))

function applySupplements(target, entries) {
  const applied = []
  for (const [path, value] of Object.entries(entries)) {
    const segments = path.split('.')
    let cursor = target
    for (const segment of segments.slice(0, -1)) {
      if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) throw new Error(`补译路径不存在：${path}`)
      cursor = cursor[segment]
    }
    const key = segments.at(-1)
    if (!cursor || typeof cursor !== 'object' || !(key in cursor)) throw new Error(`补译路径不存在：${path}`)
    if (!Array.isArray(value) || !value.length
      || value.some(paragraph => typeof paragraph !== 'string' || !paragraph.trim() || !/[\u3400-\u9fff]/.test(paragraph))) {
      throw new Error(`补译内容必须是中文段落数组：${path}`)
    }
    if (value.some(paragraph => /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i.test(paragraph))) throw new Error(`补译内容仍含英文句子：${path}`)
    cursor[key] = value.map(paragraph => paragraph.trim())
    applied.push(path)
  }
  return applied
}

const supplementApplied = applySupplements(story, supplements.entries || {})
story.supplements = [{
  path: 'content/campaigns/theForgottenAge/story-supplements.json',
  sha256: createHash('sha256').update(supplementRaw).digest('hex'),
  entries: supplementApplied,
}]

const storyTextLiteral = (key, sections, extra = '') => {
  const paragraphs = Object.values(sections).flat()
  return `  ${key}: { title: ${JSON.stringify(story[key]?.title || key)}, text: ${JSON.stringify(paragraphs.join('\n\n'))}${extra} },\n`
}

const output = `// 由 tools/import-tfa-story.mjs 从随仓库保存的中文参考资源生成。\n`
  + `// 只包含已到达分支可展示的叙事正文；运行时不得投影未触发或私密分支。\n`
  + `// 本仓补译见 content/campaigns/theForgottenAge/story-supplements.json（story.supplements 登记哈希）。\n`
  + `export const TFA_STORY_TEXT = ${JSON.stringify(story, null, 2)}\n`
  + `\nexport const storyText = Object.freeze({\n`
  + storyTextLiteral('prologue', story.prologue.sections)
  + Object.entries(story.interludes).map(([key, value]) => storyTextLiteral(key, value.sections)).join('')
  + storyTextLiteral('epilogue', story.epilogue.sections)
  + `})\n`

export function renderStoryText() {
  return output
}

export function storyInventory() {
  const resolutionCount = Object.values(resolutions).reduce((total, item) => total + Object.keys(item).length, 0)
  const sectionCount = Object.values(introductions).reduce((total, item) => total + Object.keys(item.sections).length, 0)
  return { scenarios: scenarioIds.length, resolutionCount, sectionCount }
}

const isMain = (process.argv[1] || '').replaceAll('\\', '/').endsWith('import-tfa-story.mjs')
if (isMain) {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.some(arg => !['--write', '--check'].includes(arg))) {
    throw new Error('使用 --write 或 --check，且只能指定一种模式')
  }
  const mode = args[0]
  if (mode === '--write') await writeFile(target, output)
  else if (mode === '--check') {
    if (await readFile(target, 'utf8') !== output) throw new Error('失落的时代剧情文本生成物已漂移，请审阅后更新')
  } else console.log(output)
  if (mode) {
    const inventory = storyInventory()
    console.log(`失落的时代剧情：${inventory.scenarios} 章、${inventory.resolutionCount} 个结局分支、${inventory.sectionCount} 个导入段落组`)
  }
}

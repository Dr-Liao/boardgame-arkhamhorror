import { readFile, writeFile } from 'node:fs/promises'

const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/theDunwichLegacy/', import.meta.url)
const target = new URL('../content/campaigns/theDunwichLegacy/story-text.js', import.meta.url)
const scenarioIds = [
  'extracurricularActivity', 'theHouseAlwaysWins', 'theMiskatonicMuseum', 'theEssexCountyExpress',
  'bloodOnTheAltar', 'undimensionedAndUnseen', 'whereDoomAwaits', 'lostInTimeAndSpace',
]

// The source writes icons as {tablet}/{elderThing}; card-text.js only renders [tablet]/[elder_thing].
const SYMBOL_TOKENS = {
  action: 'action', reaction: 'reaction', free: 'free', fast: 'fast',
  willpower: 'willpower', intellect: 'intellect', combat: 'combat', agility: 'agility', wild: 'wild',
  skull: 'skull', cultist: 'cultist', tablet: 'tablet', elderThing: 'elder_thing',
  elderSign: 'elder_sign', autoFail: 'auto_fail', perInvestigator: 'per_investigator',
}

const decode = text => text
  .replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'")

export function storyParagraphs(html = '') {
  return decode(String(html))
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|ul|ol|div|section|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    .replace(/[\*_]/g, '')
    .replace(/\{([A-Za-z]+)\}/g, (match, name) => Object.hasOwn(SYMBOL_TOKENS, name) ? `[${SYMBOL_TOKENS[name]}]` : match)
    .replace(/\{setImgPath\}[^\s]*/g, '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').replace(/：:/g, '：')
      .replace(/\s*前往 设置[。.]?$/g, '').replace(/\{xp\}/g, '以本次结算为准')
      .replace(/([。！？])\.$/, '$1').replace(/\.$/, '。').trim())
    .filter(line => line && !/^前往 设置[。.]?$/.test(line))
}

const readJson = async path => JSON.parse(await readFile(new URL(path, sourceRoot), 'utf8'))
const entry = value => ({ title: value.title, paragraphs: storyParagraphs(value.body || value) })

const base = await readJson('base.json')
const scenarios = Object.fromEntries(await Promise.all(scenarioIds.map(async id => [id, await readJson(`scenarios/${id}.json`)])))
const introductions = {}
const resolutions = {}
for (const [id, source] of Object.entries(scenarios)) {
  introductions[id] = { title: source.intro.title, common: storyParagraphs(source.intro.body) }
  if (id === 'theMiskatonicMuseum') {
    introductions[id].armitageKidnapped = storyParagraphs(source.intro.part1.body)
    introductions[id].armitageRescued = storyParagraphs(source.intro.part2.body)
  } else if (id === 'undimensionedAndUnseen') {
    introductions[id].calmed = storyParagraphs(source.intro.part1)
    introductions[id].warned = storyParagraphs(source.intro.part2)
  } else if (id === 'whereDoomAwaits') {
    introductions[id].naomi = storyParagraphs(source.intro.part1.body)
  }
  const mapped = {}
  for (const [key, value] of Object.entries(source.resolutions || {})) {
    if (key === 'xp') continue
    const destination = key === 'noResolution' || key === 'defeat' || key === 'defeated'
      ? 'noResolution' : /^resolution\d+$/.test(key) ? `r${key.slice(10)}` : null
    if (!destination) continue
    mapped[destination] = storyParagraphs(value.body || value)
  }
  // This scenario explicitly says that no resolution is resolved as R1.
  if (id === 'theHouseAlwaysWins' && mapped.noResolution && mapped.r1) mapped.noResolution.push(...mapped.r1)
  resolutions[id] = mapped
}

const story = {
  source: '参考资源/ArkhamHorror-main/frontend/src/locales/zh/theDunwichLegacy',
  prologue: entry(base.prologue),
  introductions,
  resolutions,
  interludes: {
    armitageKidnapped: { title: base.interlude1.title, paragraphs: storyParagraphs(base.interlude1.armitagesFate1) },
    armitageRescued: { title: base.interlude1.title, paragraphs: storyParagraphs(base.interlude1.armitagesFate2) },
    survivors: {
      title: base.interlude2.title,
      common: storyParagraphs(base.interlude2.body),
      people: {
        '02040': storyParagraphs(base.interlude2.drHenryArmitage),
        '02061': storyParagraphs(base.interlude2.professorWarrenRice),
        '02080': storyParagraphs(base.interlude2.drFrancisMorgan),
        '02217': storyParagraphs(base.interlude2.zebulonWhateley),
        '02218': storyParagraphs(base.interlude2.earlSawyer),
      },
    },
  },
  epilogues: {
    calmed: { title: base.epilogue.title, paragraphs: storyParagraphs(base.epilogue.epilogue1) },
    warned: { title: base.epilogue.title, paragraphs: storyParagraphs(base.epilogue.epilogue2) },
  },
}

const output = `// 由 tools/import-dunwich-story.mjs 从随仓库保存的中文参考资源生成。\n`
  + `// 运行时只读取本文件，不依赖参考资源目录。\nexport const DUNWICH_STORY_TEXT = ${JSON.stringify(story, null, 2)}\n`
const mode = process.argv[2]
if (mode === '--write') await writeFile(target, output)
else if (mode === '--check') {
  if (await readFile(target, 'utf8') !== output) throw new Error('敦威治剧情文本生成物已漂移，请审阅后更新')
} else if (mode) throw new Error('使用 --write 或 --check')
else console.log(output)
if (mode) console.log(`敦威治剧情：${scenarioIds.length} 章、${Object.values(resolutions).reduce((n, item) => n + Object.keys(item).length, 0)} 个结局分支`)

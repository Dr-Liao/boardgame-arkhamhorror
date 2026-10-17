// Import complete reached narrative from the bundled Chinese translation.
// Setup, routing, rewards, and campaign-log instructions stay in the engine;
// this generated data contains reader-facing prose only.
import { readFile, writeFile } from 'node:fs/promises'

const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/thePathToCarcosa/', import.meta.url)
const target = new URL('../content/campaigns/thePathToCarcosa/story-text.js', import.meta.url)
const scenarioIds = [
  'curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath',
  'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa',
]

const decode = text => text
  .replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'")

function clean(text) {
  return decode(String(text))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    .replace(/[\*_]/g, '')
    .replace(/^（?(?:引言|梦境|结局)[^：:]{0,20}[：:]\s*/u, '')
    .replace(/^如果未达成任何结局[^：:]*[：:]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function narrativeParagraphs(html = '') {
  return [...String(html).matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)]
    .filter(([, attrs]) => !/\bbasic\b/i.test(attrs))
    .map(([, , body]) => clean(body))
    .filter(Boolean)
}

const readJson = async path => JSON.parse(await readFile(new URL(path, sourceRoot), 'utf8'))
const base = await readJson('base.json')
const scenarios = Object.fromEntries(await Promise.all(scenarioIds.map(async id =>
  [id, await readJson(`scenarios/${id}.json`)])))
const prose = value => narrativeParagraphs(value?.body || value || '')
const intro = id => scenarios[id].intro

const introductions = {
  curtainCall: { title: intro('curtainCall').title, common: prose(intro('curtainCall')) },
  theLastKing: { title: intro('theLastKing').title, common: prose(intro('theLastKing')) },
  echoesOfThePast: {
    title: intro('echoesOfThePast').title,
    common: prose(intro('echoesOfThePast')),
    sebastiensInformation: prose(intro('echoesOfThePast').sebastiensInformation),
  },
  theUnspeakableOath: {
    title: intro('theUnspeakableOath').title,
    foundTheWayForward: prose(intro('theUnspeakableOath').intro1),
    didNotFindTheWayForward: prose(intro('theUnspeakableOath').intro2),
    common: prose(intro('theUnspeakableOath').intro3),
    constancesInformation: prose(intro('theUnspeakableOath').constancesInformation),
  },
  aPhantomOfTruth: {
    title: intro('aPhantomOfTruth').title,
    kingClaimedVictims: prose(intro('aPhantomOfTruth').intro1),
    common: prose(intro('aPhantomOfTruth').intro2),
    dreams: Object.fromEntries([
      'dream1', 'dream3', 'dream4', 'dream5', 'dream7', 'dream9', 'dream10',
      'dream11', 'dream12', 'dream13',
    ].map(key => [key, prose(intro('aPhantomOfTruth')[key])])),
    dream2: prose(intro('aPhantomOfTruth').dream2),
    dream6: prose(intro('aPhantomOfTruth').dream6),
    dream8: prose(intro('aPhantomOfTruth').dream8),
    awakening: prose(intro('aPhantomOfTruth').awakening),
    jordansInformation: prose(intro('aPhantomOfTruth').jordansInformation),
  },
  thePallidMask: {
    title: intro('thePallidMask').title,
    awokeInside: prose(intro('thePallidMask').intro1),
    enteredOnYourOwn: prose(intro('thePallidMask').intro2),
    harukosInformation: prose(intro('thePallidMask').harukosInformation),
  },
  blackStarsRise: {
    title: intro('blackStarsRise').title,
    common: prose(intro('blackStarsRise')),
    ashleighsInformation: prose(intro('blackStarsRise').ashleighsInformation),
  },
  dimCarcosa: {
    title: intro('dimCarcosa').title,
    pathBelow: prose(intro('dimCarcosa').intro1),
    pathAbove: prose(intro('dimCarcosa').intro2),
  },
}

const resolutions = Object.fromEntries(scenarioIds.map(id => {
  const mapped = {}
  for (const [key, value] of Object.entries(scenarios[id].resolutions || {})) {
    const destination = key === 'noResolution' || key === 'defeated'
      ? 'noResolution' : /^resolution\d+$/.test(key) ? `r${key.slice(10)}` : null
    if (destination && prose(value).length) mapped[destination] = prose(value)
  }
  return [id, mapped]
}))

const story = {
  source: '参考资源/ArkhamHorror-main/frontend/src/locales/zh/thePathToCarcosa',
  prologue: {
    title: base.prologue.title,
    epigraph: { title: base.prologue.yellowSign.title, paragraphs: prose(base.prologue.yellowSign) },
    common: prose(base.prologue),
    lola: prose(base.prologue.lola),
  },
  introductions,
  resolutions,
  interludes: {
    interludeOne: {
      title: base.interlude1.title,
      intrude: prose(base.interlude1.lunacysReward1),
      flee: prose(base.interlude1.lunacysReward2),
      burn: prose(base.interlude1.lunacysReward3),
    },
    interludeTwo: {
      title: base.interlude2.title,
      danielSurvived: prose(base.interlude2.danielSurvived),
      danielDidNotSurvive: prose(base.interlude2.danielDidNotSurvive),
      danielWasPossessed: prose(base.interlude2.danielWasPossessed),
      ignore: prose(base.interlude2.ignoreTheWarning),
      heed: prose(base.interlude2.heedTheWarning),
    },
  },
  possessedEpilogue: {
    title: base.epilogue.title,
    paragraphs: prose(base.epilogue),
    private: true,
  },
}

const output = `// 由 tools/import-carcosa-story.mjs 从随仓库保存的中文参考资源生成。\n`
  + `// 只包含已到达分支可展示的叙事正文；运行时不得投影未触发或私密分支。\n`
  + `export const CARCOSA_STORY_TEXT = ${JSON.stringify(story, null, 2)}\n`
  + `\nexport const storyText = Object.freeze({\n`
  + `  prologue: { title: CARCOSA_STORY_TEXT.prologue.title, text: CARCOSA_STORY_TEXT.prologue.common.join('\\n\\n') },\n`
  + `  interludeOne: { title: CARCOSA_STORY_TEXT.interludes.interludeOne.title, text: '你必须决定如何处理晚宴中发生的一切。' },\n`
  + `  interludeTwo: { title: CARCOSA_STORY_TEXT.interludes.interludeTwo.title, text: '你必须决定是否听从丹尼尔的警告。' },\n`
  + `  possessedEpilogue: { title: CARCOSA_STORY_TEXT.possessedEpilogue.title, text: CARCOSA_STORY_TEXT.possessedEpilogue.paragraphs.join('\\n\\n'), private: true },\n`
  + `})\n`
const args = process.argv.slice(2)
if (args.length > 1 || args.some(arg => !['--write', '--check'].includes(arg))) {
  throw new Error('使用 --write 或 --check，且只能指定一种模式')
}
const mode = args[0]
if (mode === '--write') await writeFile(target, output)
else if (mode === '--check') {
  if (await readFile(target, 'utf8') !== output) throw new Error('卡尔克萨剧情文本生成物已漂移，请审阅后更新')
} else console.log(output)
if (mode) {
  const resolutionCount = Object.values(resolutions).reduce((total, item) => total + Object.keys(item).length, 0)
  console.log(`卡尔克萨剧情：${scenarioIds.length} 章、${resolutionCount} 个结局分支`)
}

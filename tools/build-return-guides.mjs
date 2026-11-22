// 批次 2：「重返」章节双语冒险指南源生成器。
//
// 生成 content/scenario-guide-sources/<returnScenarioId>.json：
//   · intro / story / resolutions —— 沿用同章基础指南（web/scenario-guides/<baseId>.json）的
//     官方中英正文，只按结构补上稳定 block id；
//   · setup —— 重返版剧本参考卡（如 50011）的中英设置差异 + 基础设置正文；
//   · specialRules —— 该章用到的 50xxx/51xxx/52xxx 新卡（幕/密谋/地点/敌人/诡计）卡面文本。
//
// 产物由 tools/import-scenario-guides.mjs 的 authored 分支校验并生成 web/scenario-guides/。
// 用法：
//   node tools/build-return-guides.mjs --scenario returnToTheGathering --write
//   node tools/build-return-guides.mjs --campaign returnToNightOfTheZealot --write
//   node tools/build-return-guides.mjs --all --write
// 不带 --write 时只校验并打印将写入的文件。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildAuthoredScenarioGuide } from './authored-scenario-guide.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const guidesDir = path.join(root, 'web', 'scenario-guides')
const sourcesDir = path.join(root, 'content', 'scenario-guide-sources')

const RETURN_CAMPAIGNS = Object.freeze({
  returnToNightOfTheZealot: {
    theGathering: 'returnToTheGathering',
    theMidnightMasks: 'returnToTheMidnightMasks',
    theDevourerBelow: 'returnToTheDevourerBelow',
  },
  returnToTheDunwichLegacy: {
    extracurricularActivity: 'returnToExtracurricularActivities',
    theHouseAlwaysWins: 'returnToTheHouseAlwaysWins',
    theMiskatonicMuseum: 'returnToTheMiskatonicMuseum',
    theEssexCountyExpress: 'returnToTheEssexCountyExpress',
    bloodOnTheAltar: 'returnToBloodOnTheAltar',
    undimensionedAndUnseen: 'returnToUndimensionedAndUnseen',
    whereDoomAwaits: 'returnToWhereDoomAwaits',
    lostInTimeAndSpace: 'returnToLostInTimeAndSpace',
  },
  returnToThePathToCarcosa: {
    curtainCall: 'returnToCurtainCall',
    theLastKing: 'returnToTheLastKing',
    echoesOfThePast: 'returnToEchoesOfThePast',
    theUnspeakableOath: 'returnToTheUnspeakableOath',
    aPhantomOfTruth: 'returnToAPhantomOfTruth',
    thePallidMask: 'returnToThePallidMask',
    blackStarsRise: 'returnToBlackStarsRise',
    dimCarcosa: 'returnToDimCarcosa',
  },
})

const NEW_CARD_PREFIXES = ['50', '51', '52']

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))
const text = value => (typeof value === 'string' ? value.trim() : '')

// 把基础指南的一段 block 树转成 authored 指南的稳定结构：两种语言同构。
// 中文缺译时**不得回落到英文**（中文指南守卫禁止英文正文），改用调用方给的中文摘要。
function convertBlocks(enBlocks, zhBlocks, prefix, zhFallback = '') {
  const walk = (enList, zhList, idPrefix) => {
    const enResult = []
    const zhResult = []
    for (const [index, enBlock] of (enList || []).entries()) {
      const zhBlock = (zhList || [])[index] || {}
      const id = `${idPrefix}${index}`
      const enTitle = text(enBlock?.title)
      const zhTitle = text(zhBlock?.title) || (zhFallback ? text(zhFallback).slice(0, 24) : enTitle)
      const enText = text(enBlock?.text)
      const zhText = text(zhBlock?.text) || (enText ? (text(zhFallback) || '（本段暂无中文译本，详见英文版指南。）') : '')
      const enChildren = Array.isArray(enBlock?.children) ? enBlock.children : []
      const zhChildren = Array.isArray(zhBlock?.children) ? zhBlock.children : []
      const converted = enChildren.length ? walk(enChildren, zhChildren, `${id}-`) : null
      enResult.push({ id, ...(enTitle ? { title: enTitle } : {}), ...(enText ? { text: enText } : {}),
        ...(converted ? { children: converted.en } : {}) })
      zhResult.push({ id, ...(enTitle ? { title: zhTitle } : {}), ...(enText ? { text: zhText } : {}),
        ...(converted ? { children: converted.zh } : {}) })
    }
    return { en: enResult, zh: zhResult }
  }
  return walk(enBlocks, zhBlocks, prefix)
}

function flattenTexts(blocks, out = []) {
  for (const block of blocks || []) {
    if (text(block?.text)) out.push(block.text.trim())
    if (Array.isArray(block?.children)) flattenTexts(block.children, out)
  }
  return out
}

// 从「基础生成的指南」里取一段的分块（用于 intro/story）。
function sectionBlocks(guide, language, section) {
  return guide?.locales?.[language]?.[section] || []
}

// resolutions 结构：通常是 [{children:[{title,children:[…]}, …]}]。取每个结局块。
function resolutionEntries(guide, language) {
  let blocks = sectionBlocks(guide, language, 'resolutions')
  if (blocks.length === 1 && !blocks[0].text && Array.isArray(blocks[0].children)) blocks = blocks[0].children
  return blocks
}

function cardText(card, language) {
  const primary = language === 'zh' ? (card.textZh || card.text) : card.text
  return text(primary)
}

function cardName(card, language) {
  return language === 'zh' ? (card.nameZh || card.name) : (card.name || card.nameZh)
}

async function buildOne(campaignId, baseId, returnId) {
  const baseGuide = await readJson(path.join(guidesDir, `${baseId}.json`))
  const moduleUrl = pathToFileURL(path.join(root, 'content', 'campaigns', campaignId, 'scenarios', returnId, 'index.js')).href
  const module = await import(moduleUrl)
  const scenario = module.scenario || module.default?.scenario
  const manifest = module.manifest
  if (!scenario || !manifest) throw new Error(`${returnId}: 缺少 scenario/manifest 导出`)
  const refCard = ALL_CARDS[scenario.originalCode]
  if (!refCard) throw new Error(`${returnId}: 剧本参考卡 ${scenario.originalCode} 不在卡表`)

  const intro = convertBlocks(sectionBlocks(baseGuide, 'en', 'intro'), sectionBlocks(baseGuide, 'zh', 'intro'), 'intro-',
    text(scenario.intro) || '（本关开场暂无中文译本，详见英文版指南与剧本书。）')
  const storyBlocks = flattenTexts(sectionBlocks(baseGuide, 'en', 'story'))
  const storyZhBlocks = flattenTexts(sectionBlocks(baseGuide, 'zh', 'story'))
  const setupEn = flattenTexts(sectionBlocks(baseGuide, 'en', 'setup'))
  const setupZh = flattenTexts(sectionBlocks(baseGuide, 'zh', 'setup'))
  const setupDiffEn = text(refCard.text)
  const setupDiffZh = text(refCard.textZh) || text(scenario.setup) || '按下述设置段落布置。'

  // 新卡（50/51/52 开头）里带卡面文本的：幕/密谋/地点/敌人/诡计/剧情资产。
  const newCards = []
  for (const category of ['acts', 'agendas', 'locations', 'enemies', 'treacheries', 'storyAssets']) {
    for (const definition of Object.values(scenario[category] || {})) {
      const code = definition?.originalCode || definition?.code
      if (!code || !NEW_CARD_PREFIXES.includes(String(code).slice(0, 2))) continue
      const card = ALL_CARDS[code]
      if (!card || !text(cardText(card, 'en'))) continue
      newCards.push({ code, definition })
    }
  }
  newCards.sort((a, b) => a.code.localeCompare(b.code))

  const resolutionIds = [...(manifest.resolutionIds || [])]
  if (!resolutionIds.length) throw new Error(`${returnId}: manifest 没有 resolutionIds`)
  const groupOf = language => {
    const blocks = resolutionEntries(baseGuide, language)
    const numbered = []
    const preamble = []
    for (const block of blocks) {
      const match = /(?:Resolution|结局)\s*(\d+)/i.exec(String(block?.title || ''))
      if (match) numbered.push({ number: Number(match[1]), block })
      else preamble.push(block)
    }
    numbered.sort((left, right) => left.number - right.number)
    return { preamble, numbered: numbered.map(entry => entry.block) }
  }
  const groups = { en: groupOf('en'), zh: groupOf('zh') }
  const [firstId, ...numberedIds] = resolutionIds
  if (groups.en.numbered.length !== numberedIds.length) {
    throw new Error(`${returnId}: 基础指南有 ${groups.en.numbered.length} 个编号结局，但 manifest 除 ${firstId} 外有 ${numberedIds.length} 个（${numberedIds.join(',')}）。请先对齐章节 resolution 键。`)
  }
  const paragraphList = blocks => blocks.flatMap(block => {
    const out = []
    const walk = value => {
      if (value?.text) out.push(value.text)
      for (const child of value?.children || []) walk(child)
    }
    walk(block)
    return out
  })

  const zh = { intro: intro.zh, setup: [], specialRules: [], story: [], resolutions: [] }
  const en = { intro: intro.en, setup: [], specialRules: [], story: [], resolutions: [] }

  if (setupDiffEn || setupEn.length) {
    en.setup.push({ id: 'returnToSetup', title: 'Return to Setup Changes', text: setupDiffEn || 'Perform setup as indicated in the campaign guide.' })
    zh.setup.push({ id: 'returnToSetup', title: '重返设置差异', text: setupDiffZh })
  }
  for (const [index, paragraph] of setupEn.entries()) {
    en.setup.push({ id: `baseSetup-${index}`, text: paragraph })
    zh.setup.push({ id: `baseSetup-${index}`, text: setupZh[index] || text(scenario.setup) || '（本段设置见重返设置差异。）' })
  }

  for (const { code } of newCards) {
    const card = ALL_CARDS[code]
    en.specialRules.push({ id: `card-${code}`, title: cardName(card, 'en'), text: cardText(card, 'en') })
    // 中文卡面缺失时不得回落英文：用中文说明替代，正文仍以英文版指南为准。
    const zhTitle = text(card.nameZh) || `卡 ${code}`
    const zhBody = text(card.textZh) || '（本卡暂无中文卡面：规则按印刷英文卡面结算，详见英文版指南与卡图。）'
    zh.specialRules.push({ id: `card-${code}`, title: zhTitle, text: zhBody })
  }

  if (storyBlocks.length) {
    en.story.push({ id: 'storyBase', title: baseGuide?.locales?.en?.story?.[0]?.title || 'Story', text: storyBlocks.join('\n\n') })
    const zhStory = storyZhBlocks.length ? storyZhBlocks.join('\n\n')
      : (text(scenario.intro) || '（剧情正文见基础战役指南与剧本书。）')
    zh.story.push({ id: 'storyBase', title: baseGuide?.locales?.zh?.story?.[0]?.title || '剧情', text: zhStory })
  }
  const pushResolution = (id, index, enTitle, zhTitle, enList, zhList) => {
    const count = Math.max(enList.length, zhList.length)
    if (!count) {
      enList = ['Refer to the scenario reference card for this resolution.']
      zhList = [text(scenario.resolutions?.[id]) || '详见剧本参考卡。']
    }
    if (!zhList.length) zhList = [text(scenario.resolutions?.[id]) || '（本结局暂无中文译本，详见英文版指南。）']
    if (!enList.length) enList = ['Refer to the scenario reference card for this resolution.']
    const total = Math.max(enList.length, zhList.length)
    const childrenEn = []
    const childrenZh = []
    for (let i = 0; i < total; i++) {
      childrenEn.push({ id: `${id}-${i}`, text: enList[i] ?? enList[0] })
      childrenZh.push({ id: `${id}-${i}`, text: zhList[i] ?? zhList[0] })
    }
    en.resolutions.push({ id, title: enTitle || `Resolution ${index}`, children: childrenEn })
    zh.resolutions.push({ id, title: zhTitle || `结局 ${index}`, children: childrenZh })
  }
  const preambleEn = paragraphList(groups.en.preamble)
  const preambleZh = paragraphList(groups.zh.preamble)
  pushResolution(firstId, 0,
    baseGuide?.locales?.en?.resolutions?.[0]?.title || 'No Resolution',
    baseGuide?.locales?.zh?.resolutions?.[0]?.title || '未达成结局',
    preambleEn, preambleZh)
  numberedIds.forEach((id, index) => {
    const enBlock = groups.en.numbered[index]
    const zhBlock = groups.zh.numbered[index]
    pushResolution(id, index + 1, text(enBlock?.title), text(zhBlock?.title),
      paragraphList([enBlock]), paragraphList([zhBlock]))
  })

  const source = {
    id: returnId,
    campaignId,
    // 设置面板摘要：重返章节没有独立 setupNote 时由指南 note 提供（scenarioSetupNote 读点）。
    note: `本关按重返剧本参考卡 ${scenario.originalCode} 的设置差异布置；完整步骤见设置段落与特别规则。`,
    locales: { zh, en },
  }
  return buildAuthoredScenarioGuide(manifest, source)
}

async function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const scenarioArg = args[args.indexOf('--scenario') + 1]
  const campaignArg = args[args.indexOf('--campaign') + 1]
  const targets = []
  for (const [campaignId, rows] of Object.entries(RETURN_CAMPAIGNS)) {
    for (const [baseId, returnId] of Object.entries(rows)) {
      if (args.includes('--all') || scenarioArg === returnId
        || (campaignArg && campaignArg === campaignId)) targets.push({ campaignId, baseId, returnId })
    }
  }
  if (!targets.length) throw new Error('请指定 --scenario <id> / --campaign <id> / --all')
  if (write) await mkdir(sourcesDir, { recursive: true })
  for (const { campaignId, baseId, returnId } of targets) {
    const guide = await buildOne(campaignId, baseId, returnId)
    const output = `${JSON.stringify(guide, null, 2)}\n`
    const file = path.join(sourcesDir, `${returnId}.json`)
    if (write) {
      await writeFile(file, output)
      console.log(`✔ 写入 ${path.relative(root, file)}`)
    } else {
      console.log(`✔ 校验通过 ${returnId}（未写入）`)
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}

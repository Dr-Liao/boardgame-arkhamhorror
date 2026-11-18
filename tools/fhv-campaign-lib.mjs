// 九循环《铁杉谷盛宴》（FHV）P7 战役迁移共享库：路径、哈希、来源索引、章节/条目命名约定。
// 只读参考工程与本地账本；不写任何状态。
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MOD = fileURLToPath(new URL('../', import.meta.url))
export const HALL = join(MOD, '../..')
export const RUN = join(HALL, 'artifacts/migration/fhv')
export const WORKERS = join(RUN, 'workers')
export const REFERENCE = join(HALL, '参考资源/ArkhamHorror-main')
export const LIBRARY = join(REFERENCE, 'backend/arkham-api/library/Arkham')
export const LOCALES = join(REFERENCE, 'frontend/src/locales')
export const CAMPAIGN_ID = 'theFeastOfHemlockVale'
export const CAMPAIGN_DIR = join(MOD, 'content/campaigns/theFeastOfHemlockVale')
export const STORY_SOURCE_DIR = join(CAMPAIGN_DIR, 'story-source')
export const STORY_TEXT_PATH = join(CAMPAIGN_DIR, 'story-text.js')
export const ENTRY_ROOT = 'src/cards/encounter-entries/theFeastOfHemlockVale'
export const SCOPE_PATH = join(MOD, 'audit/fhv-scope.json')
export const PLAN_PATH = join(MOD, 'audit/fhv-campaign-plan.json')
export const CAMPAIGN_LAYER_FILES = Object.freeze([
  'card-data.js', 'chapters.js', 'flow.js', 'manifest.js', 'parts.js', 'prologue.js',
  'interludes.js', 'epilogue.js', 'records.js', 'shared.js', 'story-access.js', 'story-text.js',
])

export const json = value => JSON.stringify(value, null, 2) + '\n'
export const readText = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
export const readJson = path => JSON.parse(readText(path))
export const sha = value => createHash('sha256').update(value).digest('hex')
export const fileSha = path => (existsSync(path) ? sha(readFileSync(path)) : null)
export const relative = path => path.replaceAll('\\', '/').replace(`${HALL.replaceAll('\\', '/')}/`, '').replace(`${MOD.replaceAll('\\', '/')}/`, '')
export const moduleRelative = path => path.replaceAll('\\', '/').replace(`${MOD.replaceAll('\\', '/')}/`, '')
export { readFileSync, existsSync, readdirSync, statSync }

export const camelToSnake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
export const snakeToCamel = value => String(value).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

export const EN_GUIDE_FILES = Object.freeze([
  'base.json', 'fateOfTheVale.json', 'hemlockHouse.json', 'theLongestNight.json',
  'theLostSister.json', 'theSilentHeath.json', 'theThingInTheDepths.json',
  'theTwistedHollow.json', 'writtenInRock.json',
])
export const GUIDE_FILE_BY_SCENARIO = Object.freeze({
  welcomeToHemlockVale: 'base.json',
  dawnOfTheSecondDay: 'base.json',
  dawnOfTheFinalDay: 'base.json',
  preludeTheFinalEvening: 'base.json',
  writtenInRock: 'writtenInRock.json',
  hemlockHouse: 'hemlockHouse.json',
  theSilentHeath: 'theSilentHeath.json',
  theLostSister: 'theLostSister.json',
  theThingInTheDepths: 'theThingInTheDepths.json',
  theTwistedHollow: 'theTwistedHollow.json',
  theLongestNight: 'theLongestNight.json',
  fateOfTheVale: 'fateOfTheVale.json',
})

// 参考实现中每个场景的 CardDefs 模块（逐卡定义）与 Scenario 模块（设置/幕/议程/结局）。
const SCENARIO_SOURCE_NAMES = Object.freeze({
  welcomeToHemlockVale: 'PreludeWelcomeToHemlockVale',
  writtenInRock: 'WrittenInRock',
  hemlockHouse: 'HemlockHouse',
  theSilentHeath: 'TheSilentHeath',
  theLostSister: 'TheLostSister',
  theThingInTheDepths: 'TheThingInTheDepths',
  theTwistedHollow: 'TheTwistedHollow',
  dawnOfTheSecondDay: 'PreludeDawnOfTheSecondDay',
  theLongestNight: 'TheLongestNight',
  dawnOfTheFinalDay: 'PreludeDawnOfTheFinalDay',
  preludeTheFinalEvening: 'PreludeTheFinalEvening',
  fateOfTheVale: 'FateOfTheVale',
})
export const scenarioSourceName = id => SCENARIO_SOURCE_NAMES[id] || null

const dirs = {
  scenario: 'Scenario/Scenarios/TheFeastOfHemlockVale',
  scenarioCards: 'Scenarios/TheFeastOfHemlockVale',
  actDefs: 'Act/CardDefs/TheFeastOfHemlockVale',
  agendaDefs: 'Agenda/CardDefs/TheFeastOfHemlockVale',
  locationDefs: 'Location/CardDefs/TheFeastOfHemlockVale',
  enemyDefs: 'Enemy/CardDefs/TheFeastOfHemlockVale',
  treacheryDefs: 'Treachery/CardDefs/TheFeastOfHemlockVale',
  storyDefs: 'Story/CardDefs/TheFeastOfHemlockVale',
  actCards: 'Act/Cards/TheFeastOfHemlockVale',
  agendaCards: 'Agenda/Cards/TheFeastOfHemlockVale',
  locationCards: 'Location/Cards/TheFeastOfHemlockVale',
  enemyCards: 'Enemy/Cards/TheFeastOfHemlockVale',
  treacheryCards: 'Treachery/Cards/TheFeastOfHemlockVale',
  storyCards: 'Story/Cards/TheFeastOfHemlockVale',
  campaign: 'Campaign/Campaigns/TheFeastOfHemlockVale',
  campaignFlow: 'Campaign/Campaigns/TheFeastOfHemlockVale.hs',
  campaignSteps: 'Campaigns/TheFeastOfHemlockVale/CampaignSteps.hs',
  helpers: 'Campaigns/TheFeastOfHemlockVale/Helpers.hs',
  keys: 'Campaigns/TheFeastOfHemlockVale/Key.hs',
  tokens: 'Campaigns/TheFeastOfHemlockVale/TokenHelpers.hs',
}
export const referencePaths = id => Object.fromEntries(Object.entries(dirs).map(([key, value]) => [key, join(LIBRARY, value)]))

// 扫描参考实现 .hs：卡号 → [{ path, line }]（同一卡号可能出现在 CardDefs 与 Cards 两处，全部保留）。
export function buildReferenceIndex() {
  const byCode = new Map()
  const walk = dir => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const stat = statSync(path)
      if (stat.isDirectory()) walk(path)
      else if (name.endsWith('.hs')) {
        const lines = readFileSync(path, 'utf8').split(/\r?\n/)
        lines.forEach((line, index) => {
          for (const match of line.matchAll(/"(\d{5}[ab]?)"/g)) {
            const list = byCode.get(match[1]) || []
            if (!list.some(item => item.path === path)) list.push({ path, line: index + 1 })
            byCode.set(match[1], list)
          }
        })
      }
    }
  }
  walk(LIBRARY)
  return byCode
}

// 场景模块参考文件清单：Scenario 模块 + 六个 CardDefs 模块 + 参考目录内该场景的 Cards 子目录（如存在）。
export function scenarioReferenceFiles(id) {
  const sourceName = scenarioSourceName(id)
  const list = [
    join(LIBRARY, dirs.scenario, `${sourceName}.hs`),
    join(LIBRARY, dirs.actDefs, `${sourceName}.hs`),
    join(LIBRARY, dirs.agendaDefs, `${sourceName}.hs`),
    join(LIBRARY, dirs.locationDefs, `${sourceName}.hs`),
    join(LIBRARY, dirs.enemyDefs, `${sourceName}.hs`),
    join(LIBRARY, dirs.treacheryDefs, `${sourceName}.hs`),
    join(LIBRARY, dirs.storyDefs, `${sourceName}.hs`),
  ]
  const cardDirs = [
    join(LIBRARY, dirs.actCards, sourceName), join(LIBRARY, dirs.agendaCards, sourceName),
    join(LIBRARY, dirs.locationCards, sourceName), join(LIBRARY, dirs.enemyCards, sourceName),
    join(LIBRARY, dirs.treacheryCards, sourceName), join(LIBRARY, dirs.storyCards, sourceName),
  ]
  for (const dir of cardDirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) if (name.endsWith('.hs')) list.push(join(dir, name))
  }
  return list.filter(path => existsSync(path))
}

export function scenarioTestFile(id) { return `tests/fhv-scenario-${id}.test.mjs` }
export function scenarioDirOf(id) { return `content/campaigns/theFeastOfHemlockVale/scenarios/${id}` }
export function guideFileOf(id) { return `web/scenario-guides/${id}.json` }
export function entryPathOf(kind, nodeIdOrGroup, code) {
  return kind === 'chapter' || kind === 'prelude'
    ? `${ENTRY_ROOT}/${nodeIdOrGroup}/${code}.js`
    : `${ENTRY_ROOT}/_shared/${nodeIdOrGroup}/${code}.js`
}

// 参考工程 en locale 的 JSON 文件路径（相对参考根）。
export function enGuidePath(file) { return join(LOCALES, 'en', CAMPAIGN_ID, file) }
export function zhGuidePath(file) { return join(LOCALES, 'zh', CAMPAIGN_ID, file) }
export function storySourcePath(file) { return join(STORY_SOURCE_DIR, file) }

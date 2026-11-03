// Build reader-facing adventure guides. Runtime reads only web/scenario-guides;
// the bundled reference and translation sources are needed only to regenerate.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { chapters as innsmouthChapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { STORY_TEXT as innsmouthStory } from '../content/campaigns/theInnsmouthConspiracy/story-text.js'

const source = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/', import.meta.url)
const destination = new URL('../web/scenario-guides/', import.meta.url)
const json = async url => JSON.parse(await readFile(url, 'utf8'))
const skipped = new Set(['heading', 'tokens', 'label', 'tooltips', 'remembered', 'xp', 'ui', 'messages'])
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object)

function localizeSupplements(value, language) {
  return language === 'zh' ? String(value)
    .replaceAll('The investigators win the campaign!', '调查员赢得战役！')
    .replaceAll('Do not read any intro for a character not chosen by a player. Once each player has read his or her character’s intro, proceed to Setup.', '不要阅读未被玩家选中的角色引言。每位玩家读完自己角色的引言后，进入设置。')
    .replaceAll('but perhaps this is the chance you have been waiting for?', '但或许这正是你一直等待的机会？')
    .replaceAll('Step forward and accept Keziah’s offering. Skip to Resolution 9. You may choose this option only if an investigator has the Black Book in their deck and Erynn joined the investigators.', '走上前，接受凯夏的馈赠。跳至结局 9。只有在某名调查员的牌组中有黑书，且艾琳已加入调查员时，才可以选择此项。')
    .replaceAll('Flee with Sanford and the Lodge. Skip to Resolution 10', '与桑福德和秘社一同逃走。跳至结局 10') : String(value)
}

export function guideText(value, language) {
  const text = String(value)
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    .replace(/\{fast\}/g, '[free]')
    .replace(/\{xp\}/g, language === 'en' ? '(calculate as instructed above)' : '（按上述说明计算）')
    .replace(/\{name\}/g, language === 'en' ? 'the chosen investigator' : '所选调查员')
    .replace(/\{key\}/g, language === 'en' ? 'the chosen key' : '所选钥匙')
    .replace(/\{perPlayer\}/g, '[per_investigator]')
    .replace(/\{([a-zA-Z_]+)\}/g, (_, name) => `[${({ elderThing: 'elder_thing', autoFail: 'auto_fail' })[name] || name}]`)
    .replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\*/g, '').replace(/(^|[^a-z])_|_([^a-z]|$)/gi, '$1$2')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return localizeSupplements(text, language)
}

export async function buildScenarioGuides() {
  const registeredScenarios = contentRegistry.listScenarios()
  const scenarios = [...registeredScenarios, ...innsmouthChapters.filter(ch => !registeredScenarios.some(s => s.id === ch.id))
    .map(ch => ({ ...ch, campaignId: 'theInnsmouthConspiracy' }))]
  const documents = {}
  const translations = await json(new URL('../content/scenario-guide-translations.json', import.meta.url))
  const dreamTranslations = {}
  const batches = new URL('../content/campaigns/theDreamEaters/story-source/', import.meta.url)
  for (const file of (await readdir(batches)).filter(name => /^batch-\d+\.json$/.test(name))) {
    Object.assign(dreamTranslations, (await json(new URL(file, batches))).entries)
  }
  for (const scenario of scenarios) {
    documents[scenario.id] = {}
    for (const language of ['en', 'zh']) {
      const sourceId = scenario.id.startsWith('heartOfTheEldersPart') ? 'heartOfTheElders' : scenario.id
      documents[scenario.id][language] = scenario.campaignId === 'theInnsmouthConspiracy'
        ? innsmouthStory[language].scenarios[sourceId]
        : await json(new URL(`${language}/${scenario.campaignId}/scenarios/${sourceId}.json`, source))
    }
  }
  function translated(id, path, language, depth = 0) {
    if (depth > 12) throw new Error(`Circular guide reference: ${id}.${path}`)
    const entry = documents[id]
    let value = language === 'zh'
      ? translations[`${id}.${path}`] ?? dreamTranslations[`scenarios/${id}.json#${path}`] ?? get(entry.zh, path) ?? get(entry.en, path)
      : get(entry.en, path)
    if (typeof value === 'string' && value.startsWith('@:')) {
      const [, targetId, ...targetPath] = value.slice(2).split('.')
      return translated(targetId, targetPath.join('.'), language, depth + 1)
    }
    return value
  }
  const results = new Map()
  const missing = []
  for (const scenario of scenarios) {
    const guide = { id: scenario.id, campaignId: scenario.campaignId, sourceKind: 'bundled-reference-with-self-translated-supplements', officialChinese: false, locales: {} }
    for (const language of ['zh', 'en']) {
      const root = documents[scenario.id].en
      const zhRoot = documents[scenario.id].zh
      const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
      function blocks(path, original, localized) {
        const value = translated(scenario.id, path, language)
        // Some Chinese entries are complete HTML strings where English uses an object.
        if (typeof value === 'string') {
          const text = guideText(value, language)
          if (!text) return []
          const prose = text.replace(/\[[a-z_]+\]/g, '')
          if (language === 'zh' && ((/[a-z]{5}/i.test(prose) && !/[\u3400-\u9fff]/.test(prose))
            || /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i.test(prose))) {
            missing.push({ path: `${scenario.id}.${path}`, text })
          }
          return [{ text }]
        }
        const object = original && typeof original === 'object' ? original : localized
        if (!object || typeof object !== 'object') return []
        const title = typeof object.title === 'string' ? guideText(translated(scenario.id, `${path}.title`, language), language) : ''
        const children = []
        for (const key of new Set([...Object.keys(object), ...(localized && typeof localized === 'object' ? Object.keys(localized) : [])])) {
          if (key === 'title' || skipped.has(key)) continue
          children.push(...blocks(`${path}.${key}`, object[key], localized?.[key]))
        }
        return children.length ? [{ ...(title ? { title } : {}), children }] : []
      }
      let entries = Object.entries(root)
      // Both registered chapters share the source file; show only the current part.
      if (scenario.id.startsWith('heartOfTheEldersPart')) {
        const part = `part${scenario.id.endsWith('2') ? 2 : 1}`
        entries = Object.entries(root[part]).map(([key, value]) => [`${part}.${key}`, value])
      }
      entries = entries.flatMap(([path, value]) => path === 'flavorText'
        ? Object.entries(value).map(([key, text]) => [`flavorText.${key}`, text]) : [[path, value]])
      for (const [path, value] of entries) {
        if (skipped.has(path)) continue
        const key = path.split('.').at(-1)
        const category = key === 'resolutions' ? 'resolutions'
          : /^intro/.test(key) || ['dreamSelection', 'dreams'].includes(key) ? 'intro'
          : ['setup', 'standalone', 'regionSetup'].includes(key) ? 'setup'
          : ['specialRules', 'rules', 'theVoid', 'moving', 'hiddenChamber', 'choosingARandomLocation', 'locationsInTheEncounterDeck', 'threeActsThreeThreads', 'bodyOfAYithian', 'depthLevel', 'pursuit', 'storyCards', 'noWayOut', 'theSpectralEncounterDeck', 'keys', 'breachesAndIncursions', 'theCosmos', 'emptySpace'].includes(key) ? 'specialRules'
          : 'story'
        sections[category].push(...blocks(path, value, get(zhRoot, path)))
      }
      sections.specialRules = sections.specialRules.filter((block, index, all) =>
        all.findIndex(other => JSON.stringify(other) === JSON.stringify(block)) === index)
      guide.locales[language] = sections
    }
    results.set(`${scenario.id}.json`, `${JSON.stringify(guide, null, 2)}\n`)
  }
  if (missing.length) throw new Error(`Missing Chinese guide translations:\n${JSON.stringify(missing, null, 2)}`)
  return results
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const files = await buildScenarioGuides()
  if (process.argv.includes('--write')) await mkdir(destination, { recursive: true })
  for (const [name, value] of files) {
    const file = new URL(name, destination)
    if (process.argv.includes('--write')) await writeFile(file, value)
    else if (await readFile(file, 'utf8') !== value) throw new Error(`Guide out of date: ${name}`)
  }
  console.log(`Adventure guides: ${files.size} scenarios ${process.argv.includes('--write') ? 'written' : 'verified'}.`)
}

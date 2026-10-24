// P8 输入盘点：把 9 章 + 21 遭遇组的卡号清单、类型、关键印刷字段与机制映射
// 汇总成 artifacts/migration/tcu/p8/scenario-inventory.json。
// 只读 cards-data.js 与 mechanism-scan.json，不生成任何 content 文件。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const root = new URL('..', import.meta.url)
const scan = JSON.parse(await readFile(new URL('artifacts/migration/tcu/mechanism-scan.json', root), 'utf8'))
const groupMeta = new Map(scan.encounterGroups.map(group => [group.id, group]))
const cardMeta = new Map(scan.cards.map(card => [card.code, card]))

const snake = id => id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const chapters = [...new Set(scan.cards.flatMap(card => [])),]
void chapters

// 章节 id 来自路线图/共享清单：从机制扫描的章节组反推
const chapterIds = scan.encounterGroups.filter(group => group.scope === 'chapter').map(group => group.chapter)
const CHAPTER_ORDER = [
  'disappearanceAtTheTwilightEstate', 'theWitchingHour', 'atDeathsDoorstep', 'theSecretName',
  'theWagesOfSin', 'forTheGreaterGood', 'unionAndDisillusion', 'inTheClutchesOfChaos', 'beforeTheBlackThrone',
]
if (chapterIds.length !== 9) throw new Error('章节组数量不是 9：' + chapterIds.join(','))

const codeInfo = code => {
  const card = ALL_CARDS[code]
  const meta = cardMeta.get(code)
  return {
    code,
    face: card.code !== card.originalCode,
    type: card.type,
    name: card.name,
    nameZh: card.nameZh || card.name,
    subname: card.subnameZh || card.subname || '',
    traitsZh: card.traitsZh || [],
    traits: card.traits || [],
    encounterCode: card.encounterCode || null,
    encounterPosition: card.encounterPosition ?? null,
    quantity: card.quantity || 1,
    linkedCardCode: card.linkedCardCode || null,
    linkedToCode: card.linkedToCode || null,
    doubleSided: card.doubleSided || false,
    pack: card.pack,
    // 类型特定印刷字段
    ...(card.type === 'location' ? {
      shroud: card.shroud, clues: card.clues ?? 0, cluesFixed: card.cluesFixed || false,
      victory: card.victory || 0, backName: card.backNameZh || card.backName || '',
      backText: card.backTextZh || card.backText || '',
    } : {}),
    ...(card.type === 'enemy' ? {
      fight: card.fight, evade: card.evade, health: card.health ?? 1,
      healthPerInvestigator: card.healthPerInvestigator || false,
      damage: card.damage || 0, horror: card.horror || 0, victory: card.victory || 0,
      text: card.textZh || card.text || '', textEn: card.text || '',
    } : {}),
    ...(card.type === 'treachery' ? { text: card.textZh || card.text || '', textEn: card.text || '' } : {}),
    ...(card.type === 'act' || card.type === 'agenda' ? {
      stage: card.stage, doom: card.doom ?? null, backText: card.backTextZh || card.backText || '',
      text: card.textZh || card.text || '', textEn: card.text || '',
    } : {}),
    ...(card.type === 'asset' || card.type === 'event' || card.type === 'skill' ? {
      text: card.textZh || card.text || '', textEn: card.text || '',
      slot: card.slot || card.slots || null, cost: card.cost ?? null,
    } : {}),
    ...(card.type === 'story' ? { text: card.textZh || card.text || '', textEn: card.text || '' } : {}),
    ...(card.type === 'scenario' ? { text: card.textZh || card.text || '', textEn: card.text || '' } : {}),
    mechanisms: meta?.mechanisms || [],
    tier: meta?.tier || null,
    availability: card.availability,
  }
}

const byGroup = new Map()
for (const code of Object.keys(ALL_CARDS).filter(code => /^05\d{3}([a-z])?$/.test(code)).sort()) {
  const card = ALL_CARDS[code]
  const group = card.encounterCode
  if (!group) continue
  if (!byGroup.has(group)) byGroup.set(group, [])
  byGroup.get(group).push(code)
}

const groups = [...byGroup.keys()].sort().map(group => {
  const meta = groupMeta.get(group)
  const codes = byGroup.get(group)
  const info = codes.map(codeInfo)
  const byType = {}
  for (const item of info) byType[item.type] = (byType[item.type] || 0) + 1
  return {
    id: group,
    camelId: meta ? meta.id.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) : null,
    scope: meta?.scope || 'unknown',
    chapter: meta?.chapter || null,
    chapters: meta?.chapters || [],
    codes,
    faces: info.filter(item => item.face).map(item => item.code),
    byType,
    cards: info,
  }
})
const knownGroups = new Set(groups.map(group => group.id))
const unknownGroups = scan.encounterGroups.filter(group => !knownGroups.has(group.id))
const extraGroups = [...byGroup.keys()].filter(group => !groupMeta.has(group))

const chapterData = CHAPTER_ORDER.map((id, index) => {
  const chapterGroup = groupMeta.get(scan.encounterGroups.find(group => group.chapter === id)?.id)
  if (!chapterGroup) throw new Error('缺少章节组：' + id)
  const chapterCard = codeInfo(chapterGroup.codes[0])
  const sharedGroups = groups.filter(group => group.scope === 'shared' && group.chapters.includes(id))
  return {
    order: index,
    id,
    snakeId: snake(id),
    name: chapterCard.nameZh,
    nameEn: chapterCard.name,
    referenceCode: chapterCard.code,
    chapterGroup: groups.find(group => group.id === chapterGroup.id),
    sharedGroups: sharedGroups.map(group => group.id),
    requiredGroupIds: [chapterGroup.id, ...sharedGroups.map(group => group.id)],
    totals: {
      cards: groups.filter(group => group.id === chapterGroup.id || sharedGroups.some(shared => shared.id === group.id))
        .reduce((sum, group) => sum + group.codes.filter(code => code.length === 5).length, 0),
    },
  }
})

const report = {
  schemaVersion: 1,
  generatedBy: 'develop/gen-tcu-p8-inventory.mjs',
  source: {
    cardsData: 'src/cards/cards-data.js',
    mechanismScan: 'artifacts/migration/tcu/mechanism-scan.json',
    cardRecords: Object.keys(ALL_CARDS).filter(code => /^05\d{3}([a-z])?$/.test(code)).length,
  },
  chapters: chapterData,
  groups,
  warnings: {
    unknownScanGroups: unknownGroups,
    groupsNotInScan: extraGroups,
  },
}
await mkdir(new URL('artifacts/migration/tcu/p8/', root), { recursive: true })
await writeFile(new URL('artifacts/migration/tcu/p8/scenario-inventory.json', root), JSON.stringify(report, null, 2) + '\n')
console.log('chapters:', chapterData.length, 'groups:', groups.length)
console.log('warnings:', JSON.stringify(report.warnings))
for (const chapter of chapterData) {
  const own = groupMeta.get(chapter.chapterGroup.id)
  console.log(`${chapter.order} ${chapter.id} ref=${chapter.referenceCode} own=${own.codes.length} shared=${chapter.sharedGroups.length}`)
}
for (const group of groups) {
  console.log(`  ${group.id} [${group.scope}] ${group.codes.length} cards:`, JSON.stringify(group.byType),
    group.chapter ? 'chapter=' + group.chapter : 'chapters=' + group.chapters.join(','))
}

// 解析参考实现 TCU 的 Location/CardDefs/TheCircleUndone/*.hs，产出地点符号/连接/胜利点/
// 双面关系（otherSideIs / unrevealed 背面）的结构化数据，供 P8 各章 definition.js 使用。
// 只读 参考资源/，只写 artifacts/migration/tcu/p8/location-map.json。
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const REF = 'G:/boardgame-hall-ai/参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Location/CardDefs/TheCircleUndone/'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/artifacts/migration/tcu/p8/location-map.json'

const SYMBOLS = {
  Circle: 'circle', Square: 'square', Diamond: 'diamond', Moon: 'moon', Heart: 'heart',
  Triangle: 'triangle', Squiggle: 'squiggle', Hourglass: 'hourglass', T: 't', Plus: 'plus',
  Equals: 'equals', Star: 'star', Droplet: 'droplet', NoSymbol: null,
}
const chapterFromFile = {
  AtDeathsDoorstep: 'atDeathsDoorstep',
  BeforeTheBlackThrone: 'beforeTheBlackThrone',
  ForTheGreaterGood: 'forTheGreaterGood',
  InTheClutchesOfChaos: 'inTheClutchesOfChaos',
  TheSecretName: 'theSecretName',
  TheWagesOfSin: 'theWagesOfSin',
  TheWitchingHour: 'theWitchingHour',
  UnionAndDisillusion: 'unionAndDisillusion',
}

const parseList = raw => {
  if (!raw || raw === 'mempty') return []
  return raw.replace(/^\[|\]$/g, '').split(',').map(item => item.trim()).filter(Boolean)
}
const parseSymbol = raw => raw == null ? null : (SYMBOLS[raw] ?? raw)
const parseName = raw => {
  if (!raw) return { name: null, subname: '' }
  const tuple = /^\((.*)\)$/.exec(raw)
  if (tuple) {
    const parts = tuple[1].split('<:>').map(part => part.trim().replace(/^"|"$/g, ''))
    return { name: parts[0], subname: parts[1] || '' }
  }
  return { name: raw.replace(/^"|"$/g, ''), subname: '' }
}
const sha256 = value => createHash('sha256').update(value).digest('hex')

// 把调用参数切成 token：元组 / 字符串 / 列表 / mempty / 裸词
function argsOf(text) {
  const args = []
  let rest = text.trim()
  while (rest) {
    let match
    if ((match = /^\(([^()]*)\)/.exec(rest))) args.push(match[0])
    else if ((match = /^"([^"]*)"/.exec(rest))) args.push(match[0])
    else if ((match = /^\[[^\]]*\]/.exec(rest))) args.push(match[0])
    else if ((match = /^(mempty|quantity \d+|victory \d+)/.exec(rest))) args.push(match[1])
    else if ((match = /^(\w+)/.exec(rest))) args.push(match[1])
    else break
    rest = rest.slice(match[0].length).trim()
  }
  return args
}

const files = (await readdir(REF)).filter(name => name.endsWith('.hs')).sort()
const out = { schemaVersion: 1, generatedBy: 'develop/gen-tcu-locations.mjs', source: REF, chapters: {}, warnings: [] }
for (const file of files) {
  const chapter = chapterFromFile[file.replace(/\.hs$/, '')]
  if (!chapter) throw new Error('未知章节文件：' + file)
  const source = await readFile(REF + file, 'utf8')
  const entries = []
  const markers = [...source.matchAll(/^(\w+) :: CardDef$/gm)]
  for (const [index, marker] of markers.entries()) {
    const start = marker.index
    const end = index + 1 < markers.length ? markers[index + 1].index : source.length
    const block = source.slice(start, end)
    const key = marker[1]
    const flat = block.replace(/\n/g, ' ').replace(/\s+/g, ' ')
    const victory = Number(/\bvictory (\d+)/.exec(flat)?.[1] || 0)
    const quantity = Number(/\bquantity (\d+)/.exec(flat)?.[1] || 1)
    const otherSideIs = /otherSideIs "([^"]+)"/.exec(flat)?.[1] || null
    const unrevealedMatch = /locationWithUnrevealed\s+([\s\S]*)$/.exec(flat)
    let entry = null
    if (unrevealedMatch) {
      const args = argsOf(unrevealedMatch[1])
      if (args.length < 9) { out.warnings.push(`${chapter}:${key} unrevealed 参数不足 ${args.length}`); continue }
      const frontName = parseName(args[1])
      const backName = parseName(args[5])
      entry = {
        key, code: args[0].replace(/"/g, ''), name: frontName.name, subname: frontName.subname,
        traits: parseList(args[2]), symbol: parseSymbol(args[3]), links: parseList(args[4]).map(parseSymbol),
        unrevealed: {
          name: backName.name, subname: backName.subname, traits: parseList(args[6]),
          symbol: parseSymbol(args[7]), links: parseList(args[8]).map(parseSymbol),
        },
        set: args[9] || null, victory, quantity, otherSideIs, doubleSided: true,
      }
    } else {
      const callMatch = /\blocation\s+([\s\S]*)$/.exec(flat)
      if (!callMatch) { out.warnings.push(`${chapter}:${key} 没有 location 调用`); continue }
      const args = argsOf(callMatch[1])
      if (args.length < 6) { out.warnings.push(`${chapter}:${key} location 参数不足 ${args.length}`); continue }
      const frontName = parseName(args[1])
      entry = {
        key, code: args[0].replace(/"/g, ''), name: frontName.name, subname: frontName.subname,
        traits: parseList(args[2]), symbol: parseSymbol(args[3]), links: parseList(args[4]).map(parseSymbol),
        set: args[5] || null, victory, quantity, otherSideIs, doubleSided: !!otherSideIs,
      }
    }
    entry.spectral = entry.traits.includes('Spectral') || Boolean(entry.unrevealed?.traits?.includes('Spectral'))
    entries.push(entry)
  }
  out.chapters[chapter] = { file, sha256: sha256(source), entries }
}
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
let total = 0
for (const [chapter, data] of Object.entries(out.chapters)) {
  total += data.entries.length
  console.log(chapter, data.entries.length, 'locations;',
    data.entries.filter(e => e.spectral).length, 'spectral;',
    data.entries.filter(e => e.unrevealed).length, 'unrevealed;',
    data.entries.filter(e => e.otherSideIs).length, 'otherSide')
}
console.log('total', total, 'warnings', out.warnings.length)
for (const warning of out.warnings) console.log('WARN', warning)

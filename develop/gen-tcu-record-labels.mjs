// 生成 content/campaigns/theCircleUndone/record-labels.js（一次性脚本，产物静态提交）。
import { readFile, writeFile } from 'node:fs/promises'
import { recordTypes } from '../content/campaigns/theCircleUndone/shared.js'

const base = JSON.parse(await readFile(
  'G:/boardgame-hall-ai/参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/base.json', 'utf8'))
const OVERRIDES = {
  mementosDiscovered: '已发现的遗留记忆',
  erynnWantsToMeet: '艾琳想要见面',
  erynnJoinedTheInvestigators: '艾琳加入了调查员',
  theInvestigatorsReversedTheIncantation: '调查员逆转了咒语',
  theCovenOfKeziahHoldsTheWorldInItsGrasp: '凯齐亚的女巫集会掌控世界',
  missingPersons: '失踪人口',
}
const MEMENTO_LABELS = {
  mesmerizingFlute: '魅惑长笛',
  strangeIncantation: '奇怪的咒文',
  ritualComponents: '仪式材料',
  scrapOfTornShadow: '撕碎的影子',
  gilmensJournal: '吉尔曼的日记',
  keziahsFormulae: '凯齐亚的公式',
  wornCrucifix: '磨损的十字架',
  wispOfSpectralMist: '一缕幽灵薄雾',
  cornHuskDoll: '玉米壳人偶',
  bloodyTreeCarvings: '带血的树雕',
}
const missing = Object.keys(recordTypes).filter(key => !(key in base.key) && !(key in OVERRIDES))
if (missing.length) throw new Error('缺少中文名：' + missing.join(','))
const lines = Object.keys(recordTypes).map(key => {
  const label = OVERRIDES[key] || base.key[key]
  return `  ${key}: ${JSON.stringify(label)},`
})
const source = `// 万象无终（The Circle Undone）· 战役记录与遗留记忆的中文名。
//
// 64 个记录键与 \`shared.js\` 的 \`recordTypes\` 逐键对应（参考实现 Campaigns/TheCircleUndone/Key.hs）。
// 档案页、调查纪事、AI 剧情上下文与观察投影都按这张表显示；缺项会退回内部键名，
// 所以新增记录键时必须同步这里（P9 的剧情文本同样读它）。
// 中文名来源：参考实现的 zh locale base.json \`key\` 段；缺 4 条（已发现的遗留记忆、
// 艾琳想要见面、艾琳加入了调查员、调查员逆转了咒语、凯齐亚的女巫集会掌控世界）在 P8 补译。
export const RECORD_LABELS = Object.freeze({
${lines.join('\n')}
})

// 10 个遗留记忆的中文名（Campaigns/TheCircleUndone/Memento.hs 的枚举顺序）。
export const MEMENTO_LABELS = Object.freeze({
${Object.entries(MEMENTO_LABELS).map(([key, label]) => `  ${key}: ${JSON.stringify(label)},`).join('\n')}
})

export const MEMENTO_IDS = Object.freeze(Object.keys(MEMENTO_LABELS))
`
await writeFile('G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/theCircleUndone/record-labels.js', source)
console.log('written', Object.keys(recordTypes).length, 'record labels +', Object.keys(MEMENTO_LABELS).length, 'mementos')

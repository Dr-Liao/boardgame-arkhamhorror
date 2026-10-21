import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, chapters, recordTypes } from './shared.js'
import { storyText } from './story-text.js'
import { SUPPLY_COSTS, SUPPLY_HINTS, SUPPLY_LABELS, SUPPLY_LISTS } from './supplies.js'
import { interludeEffects, interludeIntro } from './interludes.js'
import { RECORD_LABELS } from './record-labels.js'

// 幕间节点：正文只放卡面的「检查清单」，具体分支由 effects 在到达时逐段写日志，
// 因此互斥分支不会再一次性展开（见 docs/arkham-content-migration.md §5.1）。
const interlude = (id, next) => ({
  type: 'interlude', title: storyText[id].title, text: interludeIntro[id], next, effects: [...interludeEffects[id]],
})

// The flow mirrors Arkham/Campaigns/TheForgottenAge.hs nextStep. All ten
// chapters are playable, so the campaign is launchable from the hall; the
// remaining literal-card work is tracked in audit/tfa-migration.json
// (playable with earlyAccess, not verified).
export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'theForgottenAge',
  // Phase 6（战役插件化：agentHints）：给 AI 的公开决策提示（不含隐藏信息）。
  agentHints: [
    '补给由全队共同持有：判断「检查补给」时看同地点任一调查员是否持有。',
    '探索牌库背面朝下，只能依据张数规划；翻开后地点会与当前位置相连。',
    '古代遗物的位置与持有者是公开信息；领队座位决定部分反应的先后。',
    '复仇点数会累加进伊格之怒，伊格之怒越高，后面的议程越危险。',
  ],
  name: '失落的时代',
  nameEn: 'The Forgotten Age',
  contentVersion: '0.1.0',
  minRulesVersion: 'n4.2',
  status: 'playable',
  requiredPackIds: ['core', 'tfaCampaign'],
  scenarioIds: chapters.map(chapter => chapter.id),
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  recordSchema: recordTypes,
  // 战役记录的中文名：档案页与调查纪事都用它，未登记的记录不再被当作内部键隐藏。
  recordLabels: RECORD_LABELS,
  // 五个战役结局：按顺序匹配剧本日志，第一个命中的作为战役结局（对应《破碎永世》的
  // 结局 1–5 与尾声门禁）。
  endings: [
    { id: 'timeUnwoven', label: '结局 4：时间线崩解', record: 'theFabricOfTimeIsUnwoven' },
    { id: 'sealedRelic', label: '结局 1：永远封印遗物', record: 'theInvestigatorsSealedTheRelicOfAgesForever' },
    { id: 'turnedBackTime', label: '结局 5：使时间倒流', record: 'theInvestigatorsTurnedBackTime' },
    { id: 'savedSerpents', label: '结局 2：拯救蛇族文明', record: 'theInvestigatorsSavedTheCivilizationOfTheSerpents' },
    { id: 'savedYithians', label: '结局 3：拯救伊斯文明', record: 'theInvestigatorsSavedTheCivilizationOfTheYithians' },
    { id: 'mendedTear', label: '结局 1：修补裂痕', record: 'theInvestigatorsMendedTheTearInTheFabricOfTime' },
  ],
  // 补给品中文名：前端面板与选择提示共用，避免把 provisions 之类的键直接显示给玩家。
  supplyLabels: SUPPLY_LABELS,
  supplyCosts: SUPPLY_COSTS,
  // 选购界面：卡面正文与「序幕／补给点」各自的完整清单（买不起的也下发，前端标价）。
  supplyHints: SUPPLY_HINTS,
  supplyLists: SUPPLY_LISTS,
  interludeHandlerId: 'tfaInterlude',
  resolutionIds: ['defeat', 'victory'],
  flow: {
    start: 'prologue',
    nodes: {
      // 序幕：远征队长人选 + 每位调查员的补给品购买（原卡：1 人 10 点、2 人各 7 点、
      // 3 人各 5 点、4 人各 4 点）。卡面把队长人选定为厄休拉／里奥／蒙特雷，
      // 当前目录里只有里奥（04001）与厄休拉（04002）可被选出。
      prologue: { type: 'story', ...storyText.prologue, next: 'theUntamedWilds', effects: [
        { type: 'expeditionLeader', candidates: ['04001', '04002'],
          prompt: '选择他们之中的一位调查员担任本次探险的队长。' },
        ...interludeEffects.prologue,
      ] },
      theUntamedWilds: { type: 'scenario', scenarioId: 'theUntamedWilds', next: 'interludeOne' },
      interludeOne: interlude('interludeOne', 'theDoomOfEztli'),
      theDoomOfEztli: { type: 'scenario', scenarioId: 'theDoomOfEztli', next: 'interludeTwo' },
      interludeTwo: interlude('interludeTwo', 'threadsOfFate'),
      threadsOfFate: { type: 'scenario', scenarioId: 'threadsOfFate', next: 'resupplyPoint' },
      // 补给点：先在圣玛丽医院处理中毒与创伤，再买补给（1 人 8 点、2 人各 5 点、3 人各 4 点、4 人各 3 点）。
      resupplyPoint: interlude('resupplyPoint', 'theBoundaryBeyond'),
      theBoundaryBeyond: { type: 'scenario', scenarioId: 'theBoundaryBeyond', next: 'interludeThree' },
      interludeThree: interlude('interludeThree', 'heartOfTheEldersPart1'),
      heartOfTheEldersPart1: { type: 'scenario', scenarioId: 'heartOfTheEldersPart1', next: 'heartOfTheEldersPart2' },
      heartOfTheEldersPart2: { type: 'scenario', scenarioId: 'heartOfTheEldersPart2', next: 'theCityOfArchives' },
      theCityOfArchives: { type: 'scenario', scenarioId: 'theCityOfArchives', next: 'interludeFour' },
      interludeFour: interlude('interludeFour', 'theDepthsOfYoth'),
      theDepthsOfYoth: { type: 'scenario', scenarioId: 'theDepthsOfYoth', next: 'interludeFive' },
      interludeFive: interlude('interludeFive', 'shatteredAeons'),
      shatteredAeons: { type: 'scenario', scenarioId: 'shatteredAeons', next: 'epilogueGate' },
      // 尾声门禁：只有「使时间倒流」后才能阅读尾声并进入《时间倒流》。
      // 时间线崩解（无人幸存）直接收尾为失败，其余结局直接结束战役。
      epilogueGate: {
        type: 'branch',
        options: [
          { id: 'unwoven', when: { record: 'theFabricOfTimeIsUnwoven', equals: true }, next: 'end' },
          {
            id: 'turnedBack',
            when: {
              all: [
                { not: { record: 'theFabricOfTimeIsUnwoven', equals: true } },
                { record: 'theInvestigatorsTurnedBackTime', equals: true },
              ],
            },
            next: 'epilogue',
          },
          {
            id: 'sealed',
            when: {
              all: [
                { not: { record: 'theFabricOfTimeIsUnwoven', equals: true } },
                { not: { record: 'theInvestigatorsTurnedBackTime', equals: true } },
              ],
            },
            next: 'end',
          },
        ],
      },
      epilogue: { type: 'story', ...storyText.epilogue, next: 'turnBackTime' },
      turnBackTime: { type: 'scenario', scenarioId: 'turnBackTime', next: 'end' },
      end: { type: 'end' },
    },
  },
}

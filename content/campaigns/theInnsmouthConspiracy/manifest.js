// 印斯茅斯暗潮（The Innsmouth Conspiracy）· 战役清单（P8 生产注册）。
//
// 与 P7 目录清单的差别只有发布口径：status 'playable'、8 章进生产组合根（content/registered.js），
// 并补上战役结局匹配表（manifest.endings）——src/campaign/campaign.js#campaignEnding 按顺序
// 取第一个命中的记录作为战役结果标签，没有 endings 时终局没有结局名。
// flow/unlock/recordSchema/interludeHandlerId/resolutionIds 保持 P7 已验证的结构不变。
import { RECORD_TYPES } from './records.js'
import { flow } from './flow.js'
import { CAMPAIGN_ID, CHAOS_BAGS, chapters, ENCOUNTER_GROUPS } from './shared.js'

// 结局匹配表：按最终章「暗潮之下」写下的记录取第一个命中的结局。
// 顺序即优先级（「深潜者淹没大地」是失败终局，优先于其它胜利/半胜分支）。

// 战役记录中文名（web/story-reader.js 与纪事/结局面板用 manifest.recordLabels 过滤并显示；
// 修复前 TIC 缺这一项，逐章记录在「纪事」里全部不显示、记忆显示英文 id——审计 M41）。
export const RECORD_LABELS = Object.freeze({
  memoriesRecovered: '已恢复的记忆', possibleSuspects: '可能嫌疑', possibleHideouts: '可能窝点',
  outForBlood: '暴民袭击目标', teachingsChoices: '教义选择', harperSuspect: '哈珀案的绑架犯', harperHideout: '哈珀案的藏身处',
  TheMissionFailed: '任务失败', TheMissionWasSuccessful: '任务成功',
  InnsmouthWasConsumedByTheRisingTide: '印斯茅斯被上涨的潮水吞没',
  TheInvestigatorsMadeItSafelyToTheirVehicles: '调查员们安全抵达了他们的载具',
  TheTideHasGrownStronger: '潮水变得更强了',
  TheTerrorOfDevilReefIsStillAlive: '魔鬼礁石的骇物仍然存活', TheTerrorOfDevilReefIsDead: '魔鬼礁石的骇物已被消灭',
  TheIdolWasBroughtToTheLighthouse: '神像被带到了灯塔', TheMantleWasBroughtToTheLighthouse: '斗篷被带到了灯塔',
  TheHeaddressWasBroughtToTheLighthouse: '头饰被带到了灯塔',
  TheInvestigatorsReachedFalconPointBeforeSunrise: '日出前抵达猎鹰岬',
  TheInvestigatorsReachedFalconPointAfterSunrise: '日落后抵达猎鹰岬',
  TheInvestigatorsPossessAMapOfYhaNthlei: '调查员持有伊哈·恩斯雷的地图',
  TheInvestigatorsPossessTheKeyToYhaNthlei: '调查员持有伊哈·恩斯雷的钥匙',
  DagonHasAwakened: '达贡已苏醒', DagonStillSlumbers: '达贡仍在沉睡',
  TheOrdersRitualWasDisrupted: '密教的仪式被破坏',
  TheGatekeeperHasBeenDefeated: '守门人已被击败',
  TheGuardianOfYhanthleiIsDispatched: '伊哈·恩斯雷的守卫被除掉了',
  TheGatewayToYhanthleiRecognizesYouAsTheRightfulKeeper: '伊哈·恩斯雷的门户承认你是其合法的守护者',
  TheInvestigatorsEscapedYhanthlei: '调查员们逃离了伊哈·恩斯雷',
  TheDeepOnesHaveFloodedTheEarth: '深潜者淹没大地',
  ThePlotOfTheDeepOnesWasThwarted: '深潜者的阴谋被挫败',
  TheFloodHasBegun: '洪水开始',
  AgentHarpersMissionIsComplete: '哈珀特工完成使命',
  TheRichesOfTheDeepAreLostForever: '深海财富永失',
  AgentHarpersMissionIsCompleteButAtWhatCost: '哈珀特工完成使命，但代价惨重',
  TheRichesOfTheDeepAreLostForeverButAtWhatCost: '深海财富永失，且代价惨重',
  TheHorribleTruth: '可怕的真相',
})

export const ENDINGS = Object.freeze([
  Object.freeze({ id: 'deepOnesFloodedEarth', label: '结局：深潜者淹没大地',
    record: 'TheDeepOnesHaveFloodedTheEarth' }),
  Object.freeze({ id: 'plotThwartedHarperComplete', label: '结局：阴谋被挫败，哈珀特工完成使命',
    record: 'AgentHarpersMissionIsComplete' }),
  Object.freeze({ id: 'plotThwartedRichesLost', label: '结局：阴谋被挫败，深海财富永失',
    record: 'TheRichesOfTheDeepAreLostForever' }),
  // 终章 resolution1 只要 07316 完成就一定写 ThePlotOfTheDeepOnesWasThwarted；走了帮助/违抗
  // 分支才会有上面的具体结局记录。R2-only（只完成 07316）需要这条兜底标签（审计 M38/M43）。
  Object.freeze({ id: 'plotThwarted', label: '结局：阴谋被挫败',
    record: 'ThePlotOfTheDeepOnesWasThwarted' }),
  Object.freeze({ id: 'floodBegunHarperComplete', label: '结局：洪水开始，哈珀特工完成使命却代价惨重',
    record: 'AgentHarpersMissionIsCompleteButAtWhatCost' }),
  Object.freeze({ id: 'floodBegunRichesLost', label: '结局：洪水开始，深海财富永失且代价惨重',
    record: 'TheRichesOfTheDeepAreLostForeverButAtWhatCost' }),
  // 「洪水开始」分支的兜底标签（未完成 07317/07318 的 R3 分支，审计 M43）。
  Object.freeze({ id: 'floodBegun', label: '结局：洪水开始',
    record: 'TheFloodHasBegun' }),
])

export const manifest = Object.freeze({
  schemaVersion: 1, id: CAMPAIGN_ID, name: '印斯茅斯暗潮', nameEn: 'The Innsmouth Conspiracy',
  contentVersion: '1.0.0', minRulesVersion: 'n6.0', status: 'playable',
  requiredPackIds: ['core', 'ticCampaign', 'ticInvestigators', 'ticPlayer'],
  scenarioIds: chapters.map(chapter => chapter.id),
  sharedEncounterGroupIds: ENCOUNTER_GROUPS.filter(group => !chapters.some(chapter => chapter.encounterCode === group)),
  unlock: Object.fromEntries(chapters.map((chapter, index) => [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS, recordSchema: RECORD_TYPES, recordLabels: RECORD_LABELS,
  flow,
  endings: ENDINGS,
  interludeHandlerId: 'innsmouthInterludes', resolutionIds: ['victory', 'defeat'],
})

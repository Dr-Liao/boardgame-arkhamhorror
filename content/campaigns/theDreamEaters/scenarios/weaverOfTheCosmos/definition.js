// 《编织宇宙》（Weaver of the Cosmos，06333）· 关卡定义（P8 w-p8-f）
//
// 参考实现：Scenario/Scenarios/TheDreamEaters/WeaverOfTheCosmos.hs +
// WeaverOfTheCosmos/{Helpers.hs} + {Act,Agenda,Enemy,Location,Treachery}/Cards/TheDreamEaters/WeaverOfTheCosmos/。
// 英文文本底本：frontend/src/locales/en/theDreamEaters/scenarios/weaverOfTheCosmos.json（锁定哈希，P8-T 校验）；
// P8-T 已自译：intro/setup/resolutions/interludeTexts 全部由生成物 `../../story-text.js` 投影
// （textLanguage:'zh-CN' + textStatus:'translated (self-translated)'），本文件不再保存英文叙事正文。
// tokenMeanings 中文逐字取自 cards-data 06333 的 textZh/backTextZh（唯一允许的中文来源）。
//
// 结构：15 张印刷「巨网」地点在静态定义里落地为 11 个实例（幕 1 用 4 个纵向排列；幕 1 背面
// 保留最下方 1 个、把另外 3 个移出游戏并放上 7 个，组成 8 段环）。随机抽取在 setup/actLeftPlay
// 里由 behavior 决定；本文件只给完整实例表，保证 layout/连接/身份可静态校验。
// enemies/treacheries 来自 TDE card-data；亚特拉克·纳克亚、四条腿与黑暗中的织网者放在一边。
import { bindScenarioIdentities } from '../../../../identities.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, identitiesFor,
} from '../../card-data.js'
import { chapterStory, flattenResolution, flattenStory } from '../../story-access.js'

// 巨网标签与分组（Haskell 的 theGreatWeb1..11；1 = 幕 1 最上方，4 = 幕 1 最下方）。
export const WEB = Object.freeze(["theGreatWeb1","theGreatWeb2","theGreatWeb3","theGreatWeb4"])
export const RING = Object.freeze(["theGreatWeb4","theGreatWeb5","theGreatWeb6","theGreatWeb7","theGreatWeb8","theGreatWeb9","theGreatWeb10","theGreatWeb11"])
export const EXPANSION = Object.freeze(["theGreatWeb5","theGreatWeb6","theGreatWeb7","theGreatWeb8","theGreatWeb9","theGreatWeb10","theGreatWeb11"])

// 四条腿的初始标签（JourneyAcrossTheBridge：loc1/2/3/4 = theGreatWeb11/5/9/7）。
export const LEGS_HOME = Object.freeze({"06347":"theGreatWeb11","06348":"theGreatWeb5","06349":"theGreatWeb9","06350":"theGreatWeb7"})

export const ATLACH_NACHA = '06346'
export const LEGS = Object.freeze(['06347', '06348', '06349', '06350'])
export const SPINNER = '06352'
export const WEB_SPINNER = '06351'

export const ACT_CODES = Object.freeze(["06337","06338","06339"])
export const AGENDA_CODES = Object.freeze(["06334","06335","06336"])
export const DECK_GROUPS = Object.freeze(["weaverOfTheCosmos","agentsOfAtlachNacha","spiders","ancientEvils","chillingCold"])
export const SIDE_CODES = Object.freeze(["06346","06347","06348","06349","06350","06352"])

const locations = {
  "theGreatWeb1": {
    "code": "06340",
    "originalCode": "06340",
    "name": "巨网",
    "text": "强制 - 本地点揭示后：在其上放置1个毁灭标记。",
    "textEn": "Forced - After this location is revealed: Place 1 doom on it.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "网梯",
    "flavor": "一缕缕发黏的蛛丝，像是一级级的梯子，向上方延伸，通向吞没虚空的紫色光芒。",
    "id": "theGreatWeb1",
    "type": "location",
    "shroud": 5,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb2"
    ],
    "explicitConnections": [
      "theGreatWeb2"
    ],
    "ruleId": "theGreatWeb1",
    "identityStatus": "mapped"
  },
  "theGreatWeb2": {
    "code": "06341",
    "originalCode": "06341",
    "name": "巨网",
    "text": "强制 - 你进入本地点后：检定[willpower](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就选择并弃掉1张手牌。",
    "textEn": "Forced - After you enter this location: Test [willpower] (3). If you fail, you must either choose and discard 1 card from your hand for each point you failed by, or place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "宇宙之网",
    "flavor": "这里的蛛网闪烁着异界的光芒。",
    "id": "theGreatWeb2",
    "type": "location",
    "shroud": 4,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb1",
      "theGreatWeb3"
    ],
    "explicitConnections": [
      "theGreatWeb1",
      "theGreatWeb3"
    ],
    "ruleId": "theGreatWeb2",
    "identityStatus": "mapped"
  },
  "theGreatWeb3": {
    "code": "06342",
    "originalCode": "06342",
    "name": "巨网",
    "text": "强制 - 在调查阶段结束时，如果本地点有调查员：在本地点上放置1个毁灭标记。",
    "textEn": "Forced - When the investigation phase ends, if there is at least 1 investigator at this location: Place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "缠结之网",
    "flavor": "厚重的蛛网凌乱地连接着悬浮在无底虚空的每个平台。",
    "id": "theGreatWeb3",
    "type": "location",
    "shroud": 2,
    "cluesPerInvestigator": 2,
    "victory": 0,
    "connections": [
      "theGreatWeb2",
      "theGreatWeb4"
    ],
    "explicitConnections": [
      "theGreatWeb2",
      "theGreatWeb4"
    ],
    "ruleId": "theGreatWeb3",
    "identityStatus": "mapped"
  },
  "theGreatWeb4": {
    "code": "06343",
    "originalCode": "06343",
    "name": "巨网",
    "text": "强制 - 在你进入本地点后：检定[agility](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就失去1个行动。",
    "textEn": "Forced - After you enter this location: Test [agility] (3). If you fail, you must either lose 1 action for each point you failed by, or place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "蛛茧之牢",
    "flavor": "",
    "id": "theGreatWeb4",
    "type": "location",
    "shroud": 4,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb3",
      "theGreatWeb5",
      "theGreatWeb11"
    ],
    "explicitConnections": [
      "theGreatWeb3",
      "theGreatWeb5",
      "theGreatWeb11"
    ],
    "ruleId": "theGreatWeb4",
    "identityStatus": "mapped"
  },
  "theGreatWeb5": {
    "code": "06344",
    "originalCode": "06344",
    "name": "巨网",
    "text": "[action]如果当前场景非场景1，并且本地点上有不超过1[per_investigator]个线索：移动。移动到本地点正对面的地点。",
    "textEn": "[action] If it is not act 1, and there are 1 [per_investigator] or fewer clues on this location: Move. Move to the location directly across from this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "庞大蛛网",
    "flavor": "",
    "id": "theGreatWeb5",
    "type": "location",
    "shroud": 3,
    "cluesPerInvestigator": 2,
    "victory": 0,
    "connections": [
      "theGreatWeb4",
      "theGreatWeb6"
    ],
    "explicitConnections": [
      "theGreatWeb4",
      "theGreatWeb6"
    ],
    "ruleId": "theGreatWeb5",
    "identityStatus": "mapped"
  },
  "theGreatWeb6": {
    "code": "06344",
    "originalCode": "06344",
    "name": "巨网",
    "text": "[action]如果当前场景非场景1，并且本地点上有不超过1[per_investigator]个线索：移动。移动到本地点正对面的地点。",
    "textEn": "[action] If it is not act 1, and there are 1 [per_investigator] or fewer clues on this location: Move. Move to the location directly across from this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "庞大蛛网",
    "flavor": "",
    "id": "theGreatWeb6",
    "type": "location",
    "shroud": 3,
    "cluesPerInvestigator": 2,
    "victory": 0,
    "connections": [
      "theGreatWeb5",
      "theGreatWeb7"
    ],
    "explicitConnections": [
      "theGreatWeb5",
      "theGreatWeb7"
    ],
    "ruleId": "theGreatWeb6",
    "identityStatus": "mapped"
  },
  "theGreatWeb7": {
    "code": "06340",
    "originalCode": "06340",
    "name": "巨网",
    "text": "强制 - 本地点揭示后：在其上放置1个毁灭标记。",
    "textEn": "Forced - After this location is revealed: Place 1 doom on it.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "网梯",
    "flavor": "一缕缕发黏的蛛丝，像是一级级的梯子，向上方延伸，通向吞没虚空的紫色光芒。",
    "id": "theGreatWeb7",
    "type": "location",
    "shroud": 5,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb6",
      "theGreatWeb8"
    ],
    "explicitConnections": [
      "theGreatWeb6",
      "theGreatWeb8"
    ],
    "ruleId": "theGreatWeb7",
    "identityStatus": "mapped"
  },
  "theGreatWeb8": {
    "code": "06341",
    "originalCode": "06341",
    "name": "巨网",
    "text": "强制 - 你进入本地点后：检定[willpower](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就选择并弃掉1张手牌。",
    "textEn": "Forced - After you enter this location: Test [willpower] (3). If you fail, you must either choose and discard 1 card from your hand for each point you failed by, or place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "宇宙之网",
    "flavor": "这里的蛛网闪烁着异界的光芒。",
    "id": "theGreatWeb8",
    "type": "location",
    "shroud": 4,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb7",
      "theGreatWeb9"
    ],
    "explicitConnections": [
      "theGreatWeb7",
      "theGreatWeb9"
    ],
    "ruleId": "theGreatWeb8",
    "identityStatus": "mapped"
  },
  "theGreatWeb9": {
    "code": "06342",
    "originalCode": "06342",
    "name": "巨网",
    "text": "强制 - 在调查阶段结束时，如果本地点有调查员：在本地点上放置1个毁灭标记。",
    "textEn": "Forced - When the investigation phase ends, if there is at least 1 investigator at this location: Place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "缠结之网",
    "flavor": "厚重的蛛网凌乱地连接着悬浮在无底虚空的每个平台。",
    "id": "theGreatWeb9",
    "type": "location",
    "shroud": 2,
    "cluesPerInvestigator": 2,
    "victory": 0,
    "connections": [
      "theGreatWeb8",
      "theGreatWeb10"
    ],
    "explicitConnections": [
      "theGreatWeb8",
      "theGreatWeb10"
    ],
    "ruleId": "theGreatWeb9",
    "identityStatus": "mapped"
  },
  "theGreatWeb10": {
    "code": "06343",
    "originalCode": "06343",
    "name": "巨网",
    "text": "强制 - 在你进入本地点后：检定[agility](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就失去1个行动。",
    "textEn": "Forced - After you enter this location: Test [agility] (3). If you fail, you must either lose 1 action for each point you failed by, or place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "蛛茧之牢",
    "flavor": "",
    "id": "theGreatWeb10",
    "type": "location",
    "shroud": 4,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb9",
      "theGreatWeb11"
    ],
    "explicitConnections": [
      "theGreatWeb9",
      "theGreatWeb11"
    ],
    "ruleId": "theGreatWeb10",
    "identityStatus": "mapped"
  },
  "theGreatWeb11": {
    "code": "06345",
    "originalCode": "06345",
    "name": "巨网",
    "text": "作为调查本地点的额外费用，你必须花费1个行动或在本地点上放置1个毁灭标记。",
    "textEn": "As an additional cost to investigate this location, you must either spend 1 action or place 1 doom on this location.",
    "traits": [
      "Otherworld",
      "Extradimensional"
    ],
    "traitsZh": [
      "异界",
      "异次元"
    ],
    "subname": "网编浮岛",
    "flavor": "",
    "id": "theGreatWeb11",
    "type": "location",
    "shroud": 1,
    "cluesPerInvestigator": 1,
    "victory": 0,
    "connections": [
      "theGreatWeb10",
      "theGreatWeb4"
    ],
    "explicitConnections": [
      "theGreatWeb10",
      "theGreatWeb4"
    ],
    "ruleId": "theGreatWeb11",
    "identityStatus": "mapped"
  }
}

const acts = [
  {
    "code": "06337",
    "originalCode": "06337",
    "name": "穿过桥梁",
    "text": "每个地点与其上方和下方的地点连接。\n目标 - 如果每位调查员都位于最下方的地点，则可以共同花费所需数量的线索以推进。",
    "textEn": "Each location is connected to each location above and below it.\nObjective - If each investigator is at the bottommost location, they may spend the requisite number of clues, as a group, to advance.",
    "traits": [],
    "traitsZh": [],
    "subname": "",
    "flavor": "你意识到自己不在幻梦境，也不在清醒世界，而是处在幽暗的虚空之中，这里就是宇宙织网者所在的地方。这不仅关系到你的世界，还与幻梦境息息相关。",
    "backText": "阅读剧本手册中的冒险幕间故事：蛛后。\n然后，推进到场景2a—“编织宇宙”。",
    "type": "act",
    "id": "act1",
    "stage": "1a",
    "advanceText": "阅读剧本手册中的冒险幕间故事：蛛后。\n然后，推进到场景2a—“编织宇宙”。",
    "reveal": {
      "type": "campaignRule"
    },
    "objective": {
      "type": "clues",
      "perInvestigator": 3
    },
    "ruleId": "act1",
    "identityStatus": "mapped"
  },
  {
    "code": "06338",
    "originalCode": "06338",
    "name": "编织宇宙",
    "text": "[action]花费1个线索：对你所在地点的一个[[古神]]敌人造成3点伤害。\n强制 - 在神话阶段开始时：从混乱袋中随机揭示一个标记。如果该标记修正值为负值，将阿特拉克·纳克亚顺时针旋转X次。X为该负值修正值。\n目标 - 如果胜利区有4张阿特拉克纳克亚之腿，推进。",
    "textEn": "[action] Spend 1 clue: Deal 3 damage to an [[Ancient One]] enemy at your location.\nForced - When the mythos phase begins: Reveal a random token from the chaos bag. If its modifier is negative, spin Atlach-Nacha clockwise X times. X is the token's negative modifier.\nObjective - If 4 Legs of Atlach-Nacha are in the victory display, advance.",
    "traits": [],
    "traitsZh": [],
    "subname": "",
    "flavor": "阿特拉克·纳克亚专注在它的编织活计上。现在就是你的机会！",
    "backText": "将阿特拉克·纳克亚的中央卡牌翻面，翻至敌人面。\n将其放在毁灭标记最多的地点上。",
    "type": "act",
    "id": "act2",
    "stage": "2a",
    "advanceText": "将阿特拉克·纳克亚的中央卡牌翻面，翻至敌人面。\n将其放在毁灭标记最多的地点上。",
    "reveal": {
      "type": "campaignRule"
    },
    "ruleId": "act2",
    "identityStatus": "mapped"
  },
  {
    "code": "06339",
    "originalCode": "06339",
    "name": "阴谋破灭",
    "text": "[action]花费1个线索：对你所在地点的一个[[古神]]敌人造成3点伤害。\n强制 - 在神话阶段开始时：从混乱袋中随机揭示一个标记。如果该标记修正值为负值，将阿特拉克·纳克亚顺时针旋转X次。X为该负值修正值。\n目标 -如果阿特拉克·纳克亚被击败，推进。",
    "textEn": "[action] Spend 1 clue: Deal 3 damage to an [[Ancient One]] enemy at your location.\nForced - When the mythos phase begins: Reveal a random token from the chaos bag. If its modifier is negative, move Atlach-Nacha clockwise X times. X is the token's negative modifier.\nObjective - If Atlach-Nacha is defeated, advance.",
    "traits": [],
    "traitsZh": [],
    "subname": "",
    "flavor": "你们是阻止这些怪物吞噬世界的最后一道防线。",
    "backText": "(→结局1)",
    "type": "act",
    "id": "act3",
    "stage": "3a",
    "advanceText": "(→结局1)",
    "reveal": {
      "type": "campaignRule"
    },
    "ruleId": "act3",
    "identityStatus": "mapped"
  }
]

const agendas = [
  {
    "code": "06334",
    "originalCode": "06334",
    "name": "蛛网桥梁",
    "text": "*本密谋的毁灭阈值+2[per_investigator]。\n强制 - 在本密谋推进时：不要从场上地点移除毁灭标记。",
    "textEn": "*This agenda gets +2 [per_investigator] doom threshold.\nForced - When this agenda advances: Do not remove doom from locations in play.",
    "traits": [],
    "traitsZh": [],
    "subname": "",
    "flavor": "这片广袤无边的空间是幻梦境与现实世界之间的桥梁，编织这道桥梁的是一个可怕的蜘蛛怪物，也是它导致了此前你们所经历的扭曲异象。要是无法阻止它，这道桥梁一旦建成，这些恐怖的异象就会进入清醒世界。",
    "backText": "将遭遇弃牌堆洗入遭遇牌库。",
    "type": "agenda",
    "id": "agenda1",
    "stage": "1a",
    "doomThreshold": 7,
    "advanceText": "将遭遇弃牌堆洗入遭遇牌库。",
    "reveal": {
      "type": "campaignRule"
    },
    "ruleId": "agenda1",
    "identityStatus": "mapped"
  },
  {
    "code": "06335",
    "originalCode": "06335",
    "name": "曲折道路",
    "text": "*本密谋的毁灭阈值+2[per_investigator]。\n强制 - 在本密谋推进时：不要从场上地点移除毁灭标记。",
    "textEn": "*This agenda gets +2 [per_investigator] doom threshold.\nForced - When this agenda advances: Do not remove doom from locations in play.",
    "traits": [],
    "traitsZh": [],
    "subname": "",
    "flavor": "这现实世界以外的虚空之中，希望与欢欣都不可能存在。这里只有蜘蛛在无休止地编织，完成它们那伟大的作品，随着时间的流逝，它们的作品也即将完成。",
    "backText": "将遭遇弃牌堆洗入遭遇牌库。",
    "type": "agenda",
    "id": "agenda2",
    "stage": "2a",
    "doomThreshold": 9,
    "advanceText": "将遭遇弃牌堆洗入遭遇牌库。",
    "reveal": {
      "type": "campaignRule"
    },
    "ruleId": "agenda2",
    "identityStatus": "mapped"
  },
  {
    "code": "06336",
    "originalCode": "06336",
    "name": "现实交织",
    "text": "*本密谋的毁灭阈值+2[per_investigator]。",
    "textEn": "*This agenda gets +2 [per_investigator] doom threshold.",
    "traits": [],
    "traitsZh": [],
    "subname": "",
    "flavor": "在遥远的一条条地平线以外，群星闪烁，与无数异界的力量一同燃烧。你周围蛛网的丝线也都闪烁着相同的光芒。",
    "backText": "(→结局2)",
    "type": "agenda",
    "id": "agenda3",
    "stage": "3a",
    "doomThreshold": 11,
    "advanceText": "(→结局2)",
    "reveal": {
      "type": "campaignRule"
    },
    "ruleId": "agenda3",
    "identityStatus": "mapped"
  }
]

const sideCodes = new Set(SIDE_CODES)
const gathered = encounterCards(DECK_GROUPS)
const definitions = encounterDefinitions([
  ...gathered.filter(card => !sideCodes.has(card.code)),
  ...SIDE_CODES.map(code => ALL_CARDS[code]),
])


// ---- 剧情正文（P8-T 已自译；生成物 ../../story-text.js，键名与 en locale 顶层键一致） ----
// 只投影结构，不二次翻译：intro/setup 展平为既有字符串，resolutions 取「标题 + 正文」，
// interludeTexts 保持 {title, body}。
const story = chapterStory('weaverOfTheCosmos')
const section = key => story.sections[key]
const resolutionText = key => flattenResolution(section('resolutions')[key])
const interludeText = key => ({ ...section(key) })
export const scenario = {
  "id": "weaverOfTheCosmos",
  "originalCode": "06333",
  "name": "编织宇宙",
  "nameEn": "Weaver of the Cosmos",
  "part": "B",
  "pair": 4,
  "textLanguage": "zh-CN",
  "textStatus": "translated (self-translated)",
  "intro": flattenStory(section('intro').body),
  "setup": flattenStory(section('setup')),
  "startLocation": "theGreatWeb1",
  "locations": {
    "theGreatWeb1": {
      "code": "06340",
      "originalCode": "06340",
      "name": "巨网",
      "text": "强制 - 本地点揭示后：在其上放置1个毁灭标记。",
      "textEn": "Forced - After this location is revealed: Place 1 doom on it.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "网梯",
      "flavor": "一缕缕发黏的蛛丝，像是一级级的梯子，向上方延伸，通向吞没虚空的紫色光芒。",
      "id": "theGreatWeb1",
      "type": "location",
      "shroud": 5,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb2"
      ],
      "explicitConnections": [
        "theGreatWeb2"
      ],
      "ruleId": "theGreatWeb1",
      "identityStatus": "mapped"
    },
    "theGreatWeb2": {
      "code": "06341",
      "originalCode": "06341",
      "name": "巨网",
      "text": "强制 - 你进入本地点后：检定[willpower](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就选择并弃掉1张手牌。",
      "textEn": "Forced - After you enter this location: Test [willpower] (3). If you fail, you must either choose and discard 1 card from your hand for each point you failed by, or place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "宇宙之网",
      "flavor": "这里的蛛网闪烁着异界的光芒。",
      "id": "theGreatWeb2",
      "type": "location",
      "shroud": 4,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb1",
        "theGreatWeb3"
      ],
      "explicitConnections": [
        "theGreatWeb1",
        "theGreatWeb3"
      ],
      "ruleId": "theGreatWeb2",
      "identityStatus": "mapped"
    },
    "theGreatWeb3": {
      "code": "06342",
      "originalCode": "06342",
      "name": "巨网",
      "text": "强制 - 在调查阶段结束时，如果本地点有调查员：在本地点上放置1个毁灭标记。",
      "textEn": "Forced - When the investigation phase ends, if there is at least 1 investigator at this location: Place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "缠结之网",
      "flavor": "厚重的蛛网凌乱地连接着悬浮在无底虚空的每个平台。",
      "id": "theGreatWeb3",
      "type": "location",
      "shroud": 2,
      "cluesPerInvestigator": 2,
      "victory": 0,
      "connections": [
        "theGreatWeb2",
        "theGreatWeb4"
      ],
      "explicitConnections": [
        "theGreatWeb2",
        "theGreatWeb4"
      ],
      "ruleId": "theGreatWeb3",
      "identityStatus": "mapped"
    },
    "theGreatWeb4": {
      "code": "06343",
      "originalCode": "06343",
      "name": "巨网",
      "text": "强制 - 在你进入本地点后：检定[agility](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就失去1个行动。",
      "textEn": "Forced - After you enter this location: Test [agility] (3). If you fail, you must either lose 1 action for each point you failed by, or place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "蛛茧之牢",
      "flavor": "",
      "id": "theGreatWeb4",
      "type": "location",
      "shroud": 4,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb3",
        "theGreatWeb5",
        "theGreatWeb11"
      ],
      "explicitConnections": [
        "theGreatWeb3",
        "theGreatWeb5",
        "theGreatWeb11"
      ],
      "ruleId": "theGreatWeb4",
      "identityStatus": "mapped"
    },
    "theGreatWeb5": {
      "code": "06344",
      "originalCode": "06344",
      "name": "巨网",
      "text": "[action]如果当前场景非场景1，并且本地点上有不超过1[per_investigator]个线索：移动。移动到本地点正对面的地点。",
      "textEn": "[action] If it is not act 1, and there are 1 [per_investigator] or fewer clues on this location: Move. Move to the location directly across from this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "庞大蛛网",
      "flavor": "",
      "id": "theGreatWeb5",
      "type": "location",
      "shroud": 3,
      "cluesPerInvestigator": 2,
      "victory": 0,
      "connections": [
        "theGreatWeb4",
        "theGreatWeb6"
      ],
      "explicitConnections": [
        "theGreatWeb4",
        "theGreatWeb6"
      ],
      "ruleId": "theGreatWeb5",
      "identityStatus": "mapped"
    },
    "theGreatWeb6": {
      "code": "06344",
      "originalCode": "06344",
      "name": "巨网",
      "text": "[action]如果当前场景非场景1，并且本地点上有不超过1[per_investigator]个线索：移动。移动到本地点正对面的地点。",
      "textEn": "[action] If it is not act 1, and there are 1 [per_investigator] or fewer clues on this location: Move. Move to the location directly across from this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "庞大蛛网",
      "flavor": "",
      "id": "theGreatWeb6",
      "type": "location",
      "shroud": 3,
      "cluesPerInvestigator": 2,
      "victory": 0,
      "connections": [
        "theGreatWeb5",
        "theGreatWeb7"
      ],
      "explicitConnections": [
        "theGreatWeb5",
        "theGreatWeb7"
      ],
      "ruleId": "theGreatWeb6",
      "identityStatus": "mapped"
    },
    "theGreatWeb7": {
      "code": "06340",
      "originalCode": "06340",
      "name": "巨网",
      "text": "强制 - 本地点揭示后：在其上放置1个毁灭标记。",
      "textEn": "Forced - After this location is revealed: Place 1 doom on it.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "网梯",
      "flavor": "一缕缕发黏的蛛丝，像是一级级的梯子，向上方延伸，通向吞没虚空的紫色光芒。",
      "id": "theGreatWeb7",
      "type": "location",
      "shroud": 5,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb6",
        "theGreatWeb8"
      ],
      "explicitConnections": [
        "theGreatWeb6",
        "theGreatWeb8"
      ],
      "ruleId": "theGreatWeb7",
      "identityStatus": "mapped"
    },
    "theGreatWeb8": {
      "code": "06341",
      "originalCode": "06341",
      "name": "巨网",
      "text": "强制 - 你进入本地点后：检定[willpower](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就选择并弃掉1张手牌。",
      "textEn": "Forced - After you enter this location: Test [willpower] (3). If you fail, you must either choose and discard 1 card from your hand for each point you failed by, or place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "宇宙之网",
      "flavor": "这里的蛛网闪烁着异界的光芒。",
      "id": "theGreatWeb8",
      "type": "location",
      "shroud": 4,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb7",
        "theGreatWeb9"
      ],
      "explicitConnections": [
        "theGreatWeb7",
        "theGreatWeb9"
      ],
      "ruleId": "theGreatWeb8",
      "identityStatus": "mapped"
    },
    "theGreatWeb9": {
      "code": "06342",
      "originalCode": "06342",
      "name": "巨网",
      "text": "强制 - 在调查阶段结束时，如果本地点有调查员：在本地点上放置1个毁灭标记。",
      "textEn": "Forced - When the investigation phase ends, if there is at least 1 investigator at this location: Place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "缠结之网",
      "flavor": "厚重的蛛网凌乱地连接着悬浮在无底虚空的每个平台。",
      "id": "theGreatWeb9",
      "type": "location",
      "shroud": 2,
      "cluesPerInvestigator": 2,
      "victory": 0,
      "connections": [
        "theGreatWeb8",
        "theGreatWeb10"
      ],
      "explicitConnections": [
        "theGreatWeb8",
        "theGreatWeb10"
      ],
      "ruleId": "theGreatWeb9",
      "identityStatus": "mapped"
    },
    "theGreatWeb10": {
      "code": "06343",
      "originalCode": "06343",
      "name": "巨网",
      "text": "强制 - 在你进入本地点后：检定[agility](3)。如果你检定失败，你必须放置1个毁灭标记到本地点，或者每低于难度1点就失去1个行动。",
      "textEn": "Forced - After you enter this location: Test [agility] (3). If you fail, you must either lose 1 action for each point you failed by, or place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "蛛茧之牢",
      "flavor": "",
      "id": "theGreatWeb10",
      "type": "location",
      "shroud": 4,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb9",
        "theGreatWeb11"
      ],
      "explicitConnections": [
        "theGreatWeb9",
        "theGreatWeb11"
      ],
      "ruleId": "theGreatWeb10",
      "identityStatus": "mapped"
    },
    "theGreatWeb11": {
      "code": "06345",
      "originalCode": "06345",
      "name": "巨网",
      "text": "作为调查本地点的额外费用，你必须花费1个行动或在本地点上放置1个毁灭标记。",
      "textEn": "As an additional cost to investigate this location, you must either spend 1 action or place 1 doom on this location.",
      "traits": [
        "Otherworld",
        "Extradimensional"
      ],
      "traitsZh": [
        "异界",
        "异次元"
      ],
      "subname": "网编浮岛",
      "flavor": "",
      "id": "theGreatWeb11",
      "type": "location",
      "shroud": 1,
      "cluesPerInvestigator": 1,
      "victory": 0,
      "connections": [
        "theGreatWeb10",
        "theGreatWeb4"
      ],
      "explicitConnections": [
        "theGreatWeb10",
        "theGreatWeb4"
      ],
      "ruleId": "theGreatWeb11",
      "identityStatus": "mapped"
    }
  },
  "setAsideLocations": [
    "theGreatWeb5",
    "theGreatWeb6",
    "theGreatWeb7",
    "theGreatWeb8",
    "theGreatWeb9",
    "theGreatWeb10",
    "theGreatWeb11"
  ],
  "acts": [
    {
      "code": "06337",
      "originalCode": "06337",
      "name": "穿过桥梁",
      "text": "每个地点与其上方和下方的地点连接。\n目标 - 如果每位调查员都位于最下方的地点，则可以共同花费所需数量的线索以推进。",
      "textEn": "Each location is connected to each location above and below it.\nObjective - If each investigator is at the bottommost location, they may spend the requisite number of clues, as a group, to advance.",
      "traits": [],
      "traitsZh": [],
      "subname": "",
      "flavor": "你意识到自己不在幻梦境，也不在清醒世界，而是处在幽暗的虚空之中，这里就是宇宙织网者所在的地方。这不仅关系到你的世界，还与幻梦境息息相关。",
      "backText": "阅读剧本手册中的冒险幕间故事：蛛后。\n然后，推进到场景2a—“编织宇宙”。",
      "type": "act",
      "id": "act1",
      "stage": "1a",
      "advanceText": "阅读剧本手册中的冒险幕间故事：蛛后。\n然后，推进到场景2a—“编织宇宙”。",
      "reveal": {
        "type": "campaignRule"
      },
      "objective": {
        "type": "clues",
        "perInvestigator": 3
      },
      "ruleId": "act1",
      "identityStatus": "mapped"
    },
    {
      "code": "06338",
      "originalCode": "06338",
      "name": "编织宇宙",
      "text": "[action]花费1个线索：对你所在地点的一个[[古神]]敌人造成3点伤害。\n强制 - 在神话阶段开始时：从混乱袋中随机揭示一个标记。如果该标记修正值为负值，将阿特拉克·纳克亚顺时针旋转X次。X为该负值修正值。\n目标 - 如果胜利区有4张阿特拉克纳克亚之腿，推进。",
      "textEn": "[action] Spend 1 clue: Deal 3 damage to an [[Ancient One]] enemy at your location.\nForced - When the mythos phase begins: Reveal a random token from the chaos bag. If its modifier is negative, spin Atlach-Nacha clockwise X times. X is the token's negative modifier.\nObjective - If 4 Legs of Atlach-Nacha are in the victory display, advance.",
      "traits": [],
      "traitsZh": [],
      "subname": "",
      "flavor": "阿特拉克·纳克亚专注在它的编织活计上。现在就是你的机会！",
      "backText": "将阿特拉克·纳克亚的中央卡牌翻面，翻至敌人面。\n将其放在毁灭标记最多的地点上。",
      "type": "act",
      "id": "act2",
      "stage": "2a",
      "advanceText": "将阿特拉克·纳克亚的中央卡牌翻面，翻至敌人面。\n将其放在毁灭标记最多的地点上。",
      "reveal": {
        "type": "campaignRule"
      },
      "ruleId": "act2",
      "identityStatus": "mapped"
    },
    {
      "code": "06339",
      "originalCode": "06339",
      "name": "阴谋破灭",
      "text": "[action]花费1个线索：对你所在地点的一个[[古神]]敌人造成3点伤害。\n强制 - 在神话阶段开始时：从混乱袋中随机揭示一个标记。如果该标记修正值为负值，将阿特拉克·纳克亚顺时针旋转X次。X为该负值修正值。\n目标 -如果阿特拉克·纳克亚被击败，推进。",
      "textEn": "[action] Spend 1 clue: Deal 3 damage to an [[Ancient One]] enemy at your location.\nForced - When the mythos phase begins: Reveal a random token from the chaos bag. If its modifier is negative, move Atlach-Nacha clockwise X times. X is the token's negative modifier.\nObjective - If Atlach-Nacha is defeated, advance.",
      "traits": [],
      "traitsZh": [],
      "subname": "",
      "flavor": "你们是阻止这些怪物吞噬世界的最后一道防线。",
      "backText": "(→结局1)",
      "type": "act",
      "id": "act3",
      "stage": "3a",
      "advanceText": "(→结局1)",
      "reveal": {
        "type": "campaignRule"
      },
      "ruleId": "act3",
      "identityStatus": "mapped"
    }
  ],
  "agendas": [
    {
      "code": "06334",
      "originalCode": "06334",
      "name": "蛛网桥梁",
      "text": "*本密谋的毁灭阈值+2[per_investigator]。\n强制 - 在本密谋推进时：不要从场上地点移除毁灭标记。",
      "textEn": "*This agenda gets +2 [per_investigator] doom threshold.\nForced - When this agenda advances: Do not remove doom from locations in play.",
      "traits": [],
      "traitsZh": [],
      "subname": "",
      "flavor": "这片广袤无边的空间是幻梦境与现实世界之间的桥梁，编织这道桥梁的是一个可怕的蜘蛛怪物，也是它导致了此前你们所经历的扭曲异象。要是无法阻止它，这道桥梁一旦建成，这些恐怖的异象就会进入清醒世界。",
      "backText": "将遭遇弃牌堆洗入遭遇牌库。",
      "type": "agenda",
      "id": "agenda1",
      "stage": "1a",
      "doomThreshold": 7,
      "advanceText": "将遭遇弃牌堆洗入遭遇牌库。",
      "reveal": {
        "type": "campaignRule"
      },
      "ruleId": "agenda1",
      "identityStatus": "mapped"
    },
    {
      "code": "06335",
      "originalCode": "06335",
      "name": "曲折道路",
      "text": "*本密谋的毁灭阈值+2[per_investigator]。\n强制 - 在本密谋推进时：不要从场上地点移除毁灭标记。",
      "textEn": "*This agenda gets +2 [per_investigator] doom threshold.\nForced - When this agenda advances: Do not remove doom from locations in play.",
      "traits": [],
      "traitsZh": [],
      "subname": "",
      "flavor": "这现实世界以外的虚空之中，希望与欢欣都不可能存在。这里只有蜘蛛在无休止地编织，完成它们那伟大的作品，随着时间的流逝，它们的作品也即将完成。",
      "backText": "将遭遇弃牌堆洗入遭遇牌库。",
      "type": "agenda",
      "id": "agenda2",
      "stage": "2a",
      "doomThreshold": 9,
      "advanceText": "将遭遇弃牌堆洗入遭遇牌库。",
      "reveal": {
        "type": "campaignRule"
      },
      "ruleId": "agenda2",
      "identityStatus": "mapped"
    },
    {
      "code": "06336",
      "originalCode": "06336",
      "name": "现实交织",
      "text": "*本密谋的毁灭阈值+2[per_investigator]。",
      "textEn": "*This agenda gets +2 [per_investigator] doom threshold.",
      "traits": [],
      "traitsZh": [],
      "subname": "",
      "flavor": "在遥远的一条条地平线以外，群星闪烁，与无数异界的力量一同燃烧。你周围蛛网的丝线也都闪烁着相同的光芒。",
      "backText": "(→结局2)",
      "type": "agenda",
      "id": "agenda3",
      "stage": "3a",
      "doomThreshold": 11,
      "advanceText": "(→结局2)",
      "reveal": {
        "type": "campaignRule"
      },
      "ruleId": "agenda3",
      "identityStatus": "mapped"
    }
  ],
  "tokenMeanings": {
    "standard": {
      "skull": {
        "text": "-X。X为场上单个地点上的最高毁灭标记数量。"
      },
      "cultist": {
        "text": "再揭示一个标记。如果你检定失败且你所在地点有[[古神]]敌人，其攻击你。"
      },
      "tablet": {
        "text": "0。黑猫用爪子撕开蛛网。如果你检定成功且超过难度至少2点，移除你所在地点的1个毁灭标记。",
        "delta": 0
      },
      "elderthing": {
        "text": "-3。如果在攻击[[蜘蛛]]敌人期间本次技能检定失败，在该敌人所在地点放置1个毁灭标记。",
        "delta": -3
      }
    },
    "hard": {
      "skull": {
        "text": "-X。X为场上地点的毁灭标记总数。"
      },
      "cultist": {
        "text": "再揭示一个标记。如果你检定失败且你所在地点有[[古神]]敌人，其攻击你。"
      },
      "tablet": {
        "text": "-1。黑猫用爪子撕开蛛网。如果你检定成功且超过难度至少2点，移除你所在地点的1个毁灭标记。",
        "delta": -1
      },
      "elderthing": {
        "text": "-4。如果在攻击[[蜘蛛]]敌人期间本次技能检定失败，在该敌人所在地点放置1个毁灭标记。",
        "delta": -4
      }
    }
  },
  "enemies": {
    "06084": {
      "code": "06084",
      "originalCode": "06084",
      "name": "灰织蛛",
      "text": "猎物 - [agility]最低。\n猎手。\n灰织蛛处于重整状态时，位于其地点的每位调查员不能进行移动行动。",
      "textEn": "Prey - Lowest [agility].\nHunter.\nWhile Grey Weaver is ready, each investigator at its location cannot take move actions.",
      "traits": [
        "Monster",
        "Spider"
      ],
      "traitsZh": [
        "怪物",
        "蜘蛛"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": 4,
      "evade": 3,
      "health": 5,
      "damage": 1,
      "horror": 2,
      "hunter": true,
      "aloof": false,
      "massive": false,
      "retaliate": false,
      "alert": false,
      "victory": 1,
      "elite": false,
      "prey": "Lowest [agility]",
      "ruleId": "06084",
      "identityStatus": "mapped"
    },
    "06101": {
      "code": "06101",
      "originalCode": "06101",
      "name": "冷原蜘蛛",
      "text": "强制 - 在敌军阶段结束时：增加1张蜂拥卡牌到场上的每张蛛群敌人。如果场上没有蛛群敌人，查找遭遇牌库和遭遇弃牌堆，找出一张蛛群敌人，将其生成(不带蜂拥卡牌)在冷原蜘蛛所在地点。",
      "textEn": "Forced - When the enemy phase ends: Add 1 swarm card to each Swarm of Spiders enemy in play. If there are no Swarm of Spiders enemies in play, search the encounter deck and discard pile for a Swarm of Spiders enemy and spawn it at Spider of Leng's location with no swarm cards.",
      "traits": [
        "Monster",
        "Spider"
      ],
      "traitsZh": [
        "怪物",
        "蜘蛛"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": 3,
      "evade": 3,
      "health": 4,
      "damage": 1,
      "horror": 1,
      "hunter": false,
      "aloof": false,
      "massive": false,
      "retaliate": false,
      "alert": false,
      "victory": 0,
      "elite": false,
      "ruleId": "06101",
      "identityStatus": "mapped"
    },
    "06102": {
      "code": "06102",
      "originalCode": "06102",
      "name": "蛛群",
      "text": "蜂拥2。\nX等于本地点的蛛群敌人数量(包括蜂拥卡牌)。",
      "textEn": "Swarming 2.\nX equals the number of Swarm of Spiders enemies at this location (including swarm cards).",
      "traits": [
        "Creature",
        "Spider"
      ],
      "traitsZh": [
        "生物",
        "蜘蛛"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": 1,
      "evade": -2,
      "health": 1,
      "damage": 1,
      "horror": 0,
      "hunter": false,
      "aloof": false,
      "massive": false,
      "retaliate": false,
      "alert": false,
      "victory": 0,
      "elite": false,
      "swarming": {
        "kind": "fixed",
        "value": 2,
        "perInvestigator": false,
        "raw": "Swarming 2"
      },
      "ruleId": "06102",
      "identityStatus": "mapped"
    },
    "06351": {
      "code": "06351",
      "originalCode": "06351",
      "name": "织网者",
      "text": "生成 - 任意无人地点。\n冷漠。\n强制 - 当一轮结束时，如果织网者处于重整状态：在织网者所在地点放置1个毁灭标记。",
      "textEn": "Spawn - Any empty location.\nAloof.\nForced - At the end of the round, if Web-Spinner is ready: Place 1 doom on Web-Spinner's location.",
      "traits": [
        "Monster",
        "Spider"
      ],
      "traitsZh": [
        "怪物",
        "蜘蛛"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": 2,
      "evade": 2,
      "health": 2,
      "damage": 1,
      "horror": 1,
      "hunter": false,
      "aloof": true,
      "massive": false,
      "retaliate": false,
      "alert": false,
      "victory": 0,
      "elite": false,
      "ruleId": "06351",
      "identityStatus": "mapped"
    },
    "06346": {
      "code": "06346",
      "originalCode": "06346",
      "name": "阿特拉克·纳克亚",
      "text": "庞大。\n强制 - 在阿特拉克·纳克亚离开一个地点时：如果该地点上没有调查员，在该地点上放置1个毁灭标记。否则，其攻击该地点的每位调查员。\n强制 - 你躲避阿特拉克·纳克亚后：其不横置，改为选择你所在地点的一位调查员。它本轮不能攻击所选调查员。",
      "textEn": "Massive.\nForced - When Atlach-Nacha leaves a location: If there are no investigators at that location, place 1 doom there. Otherwise, it attacks each investigator at that location.\nForced - After you evade Atlach-Nacha: Instead of exhausting it, choose an investigator at your location. It cannot attack the chosen investigator this round.",
      "traits": [
        "Ancient One",
        "Spider",
        "Elite"
      ],
      "traitsZh": [
        "古神",
        "蜘蛛",
        "精英"
      ],
      "subname": "蜘蛛之神",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": 4,
      "evade": 4,
      "health": 4,
      "damage": 2,
      "horror": 2,
      "healthPerInvestigator": true,
      "hunter": false,
      "aloof": false,
      "massive": true,
      "retaliate": false,
      "alert": false,
      "victory": 1,
      "elite": true,
      "ruleId": "06346",
      "identityStatus": "mapped"
    },
    "06347": {
      "code": "06347",
      "originalCode": "06347",
      "name": "阿特拉克·纳克亚之腿",
      "text": "庞大。\n本敌人不能进行趁乱攻击。\nX为本敌人所在地点的隐藏值。\n强制 - 在你将要躲避本敌人时：其不横置，改为选择你所在地点的一位调查员。本敌人本轮不能攻击所选调查员。",
      "textEn": "Massive.\nThis enemy cannot make attacks of opportunity.\nX is the shroud value of this enemy's location.\nForced - When you would evade this enemy: Instead of exhausting it, choose an investigator at your location. This enemy cannot attack the chosen investigator this round.",
      "traits": [
        "Ancient One",
        "Spider",
        "Elite"
      ],
      "traitsZh": [
        "古神",
        "蜘蛛",
        "精英"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": -2,
      "evade": 3,
      "health": 3,
      "damage": 1,
      "horror": 1,
      "healthPerInvestigator": true,
      "hunter": false,
      "aloof": false,
      "massive": true,
      "retaliate": false,
      "alert": false,
      "victory": 1,
      "elite": true,
      "ruleId": "06347",
      "identityStatus": "mapped"
    },
    "06348": {
      "code": "06348",
      "originalCode": "06348",
      "name": "阿特拉克·纳克亚之腿",
      "text": "庞大。\n本敌人不能进行趁乱攻击。\nX为本敌人所在地点的隐藏值。\n强制 - 在你将要躲避本敌人时：其不横置，改为选择你所在地点的一位调查员。本敌人本轮不能攻击所选调查员。",
      "textEn": "Massive.\nThis enemy cannot make attacks of opportunity.\nX is the shroud value of this enemy's location.\nForced - When you would evade this enemy: Instead of exhausting it, choose an investigator at your location. This enemy cannot attack the chosen investigator this round.",
      "traits": [
        "Ancient One",
        "Spider",
        "Elite"
      ],
      "traitsZh": [
        "古神",
        "蜘蛛",
        "精英"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": -2,
      "evade": 3,
      "health": 3,
      "damage": 1,
      "horror": 1,
      "healthPerInvestigator": true,
      "hunter": false,
      "aloof": false,
      "massive": true,
      "retaliate": false,
      "alert": false,
      "victory": 1,
      "elite": true,
      "ruleId": "06348",
      "identityStatus": "mapped"
    },
    "06349": {
      "code": "06349",
      "originalCode": "06349",
      "name": "阿特拉克·纳克亚之腿",
      "text": "庞大。\n本敌人不能进行趁乱攻击。\nX为本敌人所在地点的隐藏值。\n强制 - 在你将要躲避本敌人时：其不横置，改为选择你所在地点的一位调查员。本敌人本轮不能攻击所选调查员。",
      "textEn": "Massive.\nThis enemy cannot make attacks of opportunity.\nX is the shroud value of this enemy's location.\nForced - When you would evade this enemy: Instead of exhausting it, choose an investigator at your location. This enemy cannot attack the chosen investigator this round.",
      "traits": [
        "Ancient One",
        "Spider",
        "Elite"
      ],
      "traitsZh": [
        "古神",
        "蜘蛛",
        "精英"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": -2,
      "evade": 3,
      "health": 3,
      "damage": 1,
      "horror": 1,
      "healthPerInvestigator": true,
      "hunter": false,
      "aloof": false,
      "massive": true,
      "retaliate": false,
      "alert": false,
      "victory": 1,
      "elite": true,
      "ruleId": "06349",
      "identityStatus": "mapped"
    },
    "06350": {
      "code": "06350",
      "originalCode": "06350",
      "name": "阿特拉克·纳克亚之腿",
      "text": "庞大。\n本敌人不能进行趁乱攻击。\nX为本敌人所在地点的隐藏值。\n强制 - 在你将要躲避本敌人时：其不横置，改为选择你所在地点的一位调查员。本敌人本轮不能攻击所选调查员。",
      "textEn": "Massive.\nThis enemy cannot make attacks of opportunity.\nX is the shroud value of this enemy's location.\nForced - When you would evade this enemy: Instead of exhausting it, choose an investigator at your location. This enemy cannot attack the chosen investigator this round.",
      "traits": [
        "Ancient One",
        "Spider",
        "Elite"
      ],
      "traitsZh": [
        "古神",
        "蜘蛛",
        "精英"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "enemy",
      "fight": -2,
      "evade": 3,
      "health": 3,
      "damage": 1,
      "horror": 1,
      "healthPerInvestigator": true,
      "hunter": false,
      "aloof": false,
      "massive": true,
      "retaliate": false,
      "alert": false,
      "victory": 1,
      "elite": true,
      "ruleId": "06350",
      "identityStatus": "mapped"
    }
  },
  "treacheries": {
    "01166": {
      "code": "01166",
      "originalCode": "01166",
      "name": "远古恶魔",
      "text": "显现 - 在当前密谋上放置1个毁灭标记。本效果可以导致当前密谋推进。",
      "textEn": "Revelation - Place 1 doom on the current agenda. This effect can cause the current agenda to advance.",
      "traits": [
        "Omen"
      ],
      "traitsZh": [
        "征兆"
      ],
      "subname": "",
      "flavor": "黑暗势力向你涌来。如果你不尽快行动，一个可怕的阴谋将会得逞。",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "01166",
      "identityStatus": "mapped"
    },
    "01167": {
      "code": "01167",
      "originalCode": "01167",
      "name": "地窖寒风",
      "text": "显现 - 检定[willpower](4)。如果你检定失败，选择并弃掉1个你控制的支援(如果你不能，则改为受到2点伤害)。",
      "textEn": "Revelation - Test [willpower] (4). If you fail, choose and discard 1 asset you control (if you cannot, take 2 damage instead).",
      "traits": [
        "Hazard"
      ],
      "traitsZh": [
        "危险"
      ],
      "subname": "",
      "flavor": "反常的寒冷要冻住你的灵魂。",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "01167",
      "identityStatus": "mapped"
    },
    "01168": {
      "code": "01168",
      "originalCode": "01168",
      "name": "朦胧之雾",
      "text": "显现 - 附属到你所在地点。每个地点仅限1张。\n所附属地点的隐藏值+2。\n强制 - 所附属地点被成功调查后：弃掉朦胧之雾。",
      "textEn": "Revelation - Attach to your location. Limit 1 per location.\nAttached location gets +2 shroud.\nForced - After attached location is successfully investigated: Discard Obscuring Fog.",
      "traits": [
        "Hazard"
      ],
      "traitsZh": [
        "危险"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "01168",
      "identityStatus": "mapped"
    },
    "06085": {
      "code": "06085",
      "originalCode": "06085",
      "name": "蛛后的意志",
      "text": "显现 - 检定[willpower](3)。如果你所在地点有[[蜘蛛]]敌人，你不能投入卡牌到本次技能检定。如果你检定失败，你不能攻击也不能调查，直到本轮结束。",
      "textEn": "Revelation - Test [willpower] (3). If there is a [[Spider]] enemy at your location, you cannot commit cards to this skill test. If you fail, you cannot attack or investigate until the end of the round.",
      "traits": [
        "Power"
      ],
      "traitsZh": [
        "力量"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "06085",
      "identityStatus": "mapped"
    },
    "06103": {
      "code": "06103",
      "originalCode": "06103",
      "name": "恶心蛛网",
      "text": "显现 - 附属到你所在地点。\n位于附属地点的每个[[蜘蛛]]敌人获得反击和警戒。调查员不能移动离开附属地点。\n[action]：检定[combat](3)或[agility](3)。如果你检定成功，弃掉恶心蛛网。",
      "textEn": "Revelation - Attach to your location.\nEach [[Spider]] enemy at attached location gains retaliate and alert. Investigators cannot move out of attached location.\n[action]: Test [combat] (3) or [agility] (3). If you succeed, discard Sickening Webs.",
      "traits": [
        "Obstacle"
      ],
      "traitsZh": [
        "障碍"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "06103",
      "identityStatus": "mapped"
    },
    "06353": {
      "code": "06353",
      "originalCode": "06353",
      "name": "陷入网中",
      "text": "显现 - 将陷入网中放置入场，放到你的威胁区域。\n你得到-1[agility]，并且每轮不能进行超过一个移动行动。\n[action]：检定[combat](3)。如果你检定成功，弃掉陷入网中。",
      "textEn": "Revelation - Put Caught in a Web into play in your threat area.\nYou get -1 [agility] and cannot take more than one move action each round.\n[action]: Test [combat] (3). If you succeed, discard Caught in a Web.",
      "traits": [
        "Hazard"
      ],
      "traitsZh": [
        "危险"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "06353",
      "identityStatus": "mapped"
    },
    "06354": {
      "code": "06354",
      "originalCode": "06354",
      "name": "无休织作",
      "text": "显现 - 选择场上一个[[蜘蛛]]敌人。如果其与调查员交战，其立即进行一次攻击，其每张蜂拥/头领卡牌也一同攻击。否则，在其所在地点放置1个毁灭标记。如果场上没有[[蜘蛛]]敌人，查找遭遇牌库和遭遇弃牌堆，找出并抽取一张[[蜘蛛]]敌人。混洗遭遇牌库。",
      "textEn": "Revelation - Choose a [[Spider]] enemy in play. If it is engaged with an investigator, it makes an immediate attack, along with each of its swarm/host cards. Otherwise, place 1 doom on its location. If there are no [[Spider]] enemies in play, search the encounter deck and discard pile for a [[Spider]] enemy and draw it. Shuffle the encounter deck.",
      "traits": [
        "Scheme"
      ],
      "traitsZh": [
        "阴谋"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "06354",
      "identityStatus": "mapped"
    },
    "06352": {
      "code": "06352",
      "originalCode": "06352",
      "name": "黑暗中的织网者",
      "text": "显现 - 附属到最近的[[古神]]敌人。\n附属的敌人得到+1伤害和+1恐惧。\n[action]：检定任意技能(5)。如果你检定成功，弃掉黑暗中的织网者。",
      "textEn": "Revelation - Attach to the nearest [[Ancient One]] enemy.\nAttached enemy gets +1 damage and +1 horror.\n[action]: Test any skill (5). If you succeed, discard The Spinner in Darkness.",
      "traits": [
        "Power"
      ],
      "traitsZh": [
        "力量"
      ],
      "subname": "",
      "flavor": "",
      "rulesPending": false,
      "type": "treachery",
      "surge": false,
      "peril": false,
      "hidden": false,
      "effect": {
        "kind": "campaignRule"
      },
      "ruleId": "06352",
      "identityStatus": "mapped"
    }
  },
  "storyAssets": {},
  "encounterDeck": [
    "01166",
    "01166",
    "01166",
    "01167",
    "01167",
    "01168",
    "01168",
    "06084",
    "06084",
    "06085",
    "06085",
    "06101",
    "06102",
    "06102",
    "06102",
    "06103",
    "06103",
    "06351",
    "06351",
    "06351",
    "06353",
    "06353",
    "06353",
    "06354",
    "06354",
    "06354"
  ],
  "resolutions": {
    "noResolution": resolutionText('noResolution'),
    "resolution1": resolutionText('resolution1'),
    "resolution2": resolutionText('resolution2'),
    "resolution3": resolutionText('resolution3'),
    "resolution4": resolutionText('resolution4'),
    "resolution5": resolutionText('resolution5')
  },
  "interludeTexts": {
    "theSpiderQueen1": interludeText('theSpiderQueen1'),
    "theSpiderQueen2": interludeText('theSpiderQueen2'),
    "theSpiderQueen3": interludeText('theSpiderQueen3'),
    "theSpiderQueen4": interludeText('theSpiderQueen4')
  },
  "ruleId": "weaverOfTheCosmos",
  "identityStatus": "mapped"
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06084: '06084',
  c06085: '06085',
  c06086: '06086',
  c06087: '06087',
  c06088: '06088',
  c06089: '06089',
  c06090: '06090',
  c06091: '06091',
  c06092: '06092',
  c06093: '06093',
  c06094: '06094',
  c06095: '06095',
  c06096: '06096',
  c06097: '06097',
  c06098: '06098',
  c06099: '06099',
  c06100: '06100',
  c06101: '06101',
  c06102: '06102',
  c06103: '06103',
  c06104: '06104',
  c06105: '06105',
  c06106: '06106',
  c06107: '06107',
  c06108: '06108',
  c06109: '06109',
  c06271: '06271',
  c06272: '06272',
  c06273: '06273',
  c06274: '06274',
  c06334: '06334',
  c06335: '06335',
  c06336: '06336',
  c06337: '06337',
  c06338: '06338',
  c06339: '06339',
  c06340: '06340',
  c06341: '06341',
  c06342: '06342',
  c06343: '06343',
  c06344: '06344',
  c06345: '06345',
  c06346: '06346',
  c06347: '06347',
  c06348: '06348',
  c06349: '06349',
  c06350: '06350',
  c06351: '06351',
  c06352: '06352',
  c06353: '06353',
  c06354: '06354',
})

// 万象无终 · 序章《暮色庄园失踪事件》（05043）· 关卡数据。
//
// 规则事实源：参考实现 Scenario/Scenarios/TheCircleUndone/DisappearanceAtTheTwilightEstate.hs
// （setupDisappearanceAtTheTwilightEstate + RunMessage 的 intro/DoStep 分支）。
// 文案事实源：frontend/src/locales/zh/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate.json。
//
// 本文件只放**印刷数据怎么用**：地点（At Death's Doorstep 的 7 张幽灵面）、幕/议程、
// 4 位故事调查员的选人/设置表、遭遇牌库、结局文案。逐卡行为在 behavior.js 与单卡条目里。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// ---- 卡号常量 -------------------------------------------------------------

// 本章遭遇组只有 7 张卡：05043 剧本 / 05044 议程 / 05045 幕 / 05046–05049 故事调查员。
export const SCENARIO_CARD = '05043'
export const AGENDA_CARD = '05044'
export const ACT_CARD = '05045'
export const STORY_INVESTIGATOR_CODES = Object.freeze(['05046', '05047', '05048', '05049'])

// At Death's Doorstep 的 7 张幽灵面地点（setup 只拿这 7 张，不拿该组其它卡）。
// id 用本仓库的 camelCase 地点 id；code 是印刷的幽灵面卡号。
export const SPECTRAL_LOCATIONS = Object.freeze({
  entryHall: '05078',
  victorianHalls: '05079',
  trophyRoom: '05080',
  billiardsRoom: '05081',
  masterBedroom: '05082',
  balcony: '05083',
  office: '05084',
})

export const SPECTRAL_LOCATION_CODES = Object.freeze(Object.values(SPECTRAL_LOCATIONS))
export const START_LOCATION = 'entryHall'

// 幽灵看守人（05086，The Watcher 组）：开局放在入口大厅，不洗入遭遇牌库。
export const THE_SPECTRAL_WATCHER = '05086'

// 参考实现的 8 个遭遇组（At Death's Doorstep 只取 7 张幽灵地点，不整组收）。
export const DECK_GROUPS = Object.freeze([
  'disappearanceAtTheTwilightEstate', // 本章组：只有剧本/议程/幕/调查员，没有敌人/诡计
  'inexorableFate',
  'realmOfDeath',
  'spectralPredators',
  'trappedSpirits',
  'theWatcher',
  'chillingCold', // 核心组：只引用，核心条目已存在，不要重写
])

// ---- 4 位故事调查员的卡背设置表 -------------------------------------------
//
// 参考实现 `selectForMaybeM (investigatorIs 0504x)` 的 setup 分支 + 卡背 setup 文案。
// `setupCards`（起始游戏区域）写进 storyInvestigators 配置，引擎在 prepareInvestigator 直接入场；
// 其余设置由 behavior.preScenarioSetup / setupEnemies / modifyDeck 按已选者结算。
export const STORY_INVESTIGATOR_SETUP = Object.freeze({
  // 加弗瑞拉：维多利亚式宴会厅；看守人受 1 伤害；1 张「愚人的命运」进威胁区；1 资源。
  '05046': Object.freeze({
    name: '加弗瑞拉·米兹拉克',
    startLocation: 'victorianHalls',
    resources: 1,
    // 卡背：设置结束时在幽灵看守人上放置 1 点伤害（behavior.setupEnemies 数据驱动读取）。
    watcherDamageOnSpawn: 1,
    startingPlayArea: Object.freeze(['01016', '01017']), // .45自动手枪（2 弹药）、体能训练
    startingHand: Object.freeze(['01019', '01021', '01022', '01023', '01026', '05021', '05021']),
    // 需要从遭遇牌库取出并放进场的卡（code → 放置方式）
    setupCards: Object.freeze([
      { code: '05108', placement: 'threat' }, // 愚人的命运 → 威胁区域
    ]),
  }),
  // 杰罗姆：办公室；冥府之雾生成在办公室；朦胧之雾附属到办公室；3 资源。
  '05047': Object.freeze({
    name: '杰罗姆·戴维斯',
    startLocation: 'office',
    resources: 3,
    startingPlayArea: Object.freeze([]),
    startingHand: Object.freeze(['01034', '01036', '01037', '01038', '01039', '01040', '05024', '05025', '05026', '05026']),
    setupCards: Object.freeze([
      { code: '05100', placement: 'enemy' }, // 冥府之雾 → 生成在办公室
      { code: '01168', placement: 'locationAttachment' }, // 朦胧之雾 → 附属到办公室
    ]),
  }),
  // 瓦伦蒂诺：台球室；暗影猎犬与其交战；恐怖夜色放到密谋牌库旁；10 资源。
  '05048': Object.freeze({
    name: '瓦伦蒂诺·里瓦斯',
    startLocation: 'billiardsRoom',
    resources: 10,
    startingPlayArea: Object.freeze(['05028']), // 良好人脉
    startingHand: Object.freeze(['01047', '01053', '01056', '05029', '05029', '05030', '05030']),
    setupCards: Object.freeze([
      { code: '05101', placement: 'engagedEnemy' }, // 暗影猎犬 → 与其交战
      { code: '05107', placement: 'nextToAgenda' }, // 恐怖夜色 → 密谋牌库旁
    ]),
  }),
  // 佩妮：露台；怨灵与其交战；黑暗中的低语放到密谋牌库旁；2 资源。
  '05049': Object.freeze({
    name: '佩妮·怀特',
    startLocation: 'balcony',
    resources: 2,
    startingPlayArea: Object.freeze(['01077', '01086', '01087']), // 深挖、刀子、手电筒（2 补给）
    startingHand: Object.freeze(['01076', '01080', '01086', '01087', '05037', '05037', '05038', '05038']),
    setupCards: Object.freeze([
      { code: '05103', placement: 'engagedEnemy' }, // 怨灵 → 与其交战
      { code: '05102', placement: 'nextToAgenda' }, // 黑暗中的低语 → 密谋牌库旁
    ]),
  }),
})

// 起始游戏区域里「不是按卡面默认值」的标记数（卡背写「剩 2 弹药 / 2 补给」）。
export const STARTING_PLAY_AREA_USES = Object.freeze({
  '01016': Object.freeze({ uses: 2, usesType: 'ammo' }),
  '01087': Object.freeze({ uses: 2, usesType: 'supplies' }),
})

// 已选故事调查员 → 需要从遭遇牌库移除的设置卡（按顺序各 1 张）。
export function setupCardsFor(codes = []) {
  const chosen = new Set(codes)
  const cards = []
  for (const code of STORY_INVESTIGATOR_CODES) {
    if (!chosen.has(code)) continue
    cards.push(...STORY_INVESTIGATOR_SETUP[code].setupCards)
  }
  return cards
}

// ---- 地点 ----------------------------------------------------------------

// 闹鬼能力文本取印刷卡面（中文），子句按 P2.1 闭集词表。
const locations = {
  // 入口大厅：印刷 [action]：撤退（与死亡门前共用同一张幽灵面；撤退行动由地点条目/behavior 提供）。
  entryHall: location('entryHall', SPECTRAL_LOCATIONS.entryHall, {
    symbol: 'square', links: ['t'], spectral: true,
  }),
  victorianHalls: location('victorianHalls', SPECTRAL_LOCATIONS.victorianHalls, {
    symbol: 't', links: ['square', 'star', 'triangle', 'heart'], spectral: true,
    haunted: [
      { text: '闹鬼 - 失去1个行动。', effect: [{ kind: 'loseAction', amount: 1 }] },
    ],
  }),
  trophyRoom: location('trophyRoom', SPECTRAL_LOCATIONS.trophyRoom, {
    symbol: 'triangle', links: ['t', 'diamond'], spectral: true,
    haunted: [
      {
        text: '闹鬼 - 失去2资源。每有1个你不能从本效果失去的资源，受到1点恐惧。',
        effect: [{ kind: 'loseResource', amount: 2, overflowHorror: true }],
      },
    ],
  }),
  billiardsRoom: location('billiardsRoom', SPECTRAL_LOCATIONS.billiardsRoom, {
    symbol: 'diamond', links: ['triangle'], spectral: true,
    haunted: [
      {
        text: '闹鬼 - 你必须弃掉一个你控制的支援，或受到1点伤害。',
        effect: [{
          kind: 'choice',
          options: [
            { id: 'discardAsset', label: '弃掉一个你控制的支援', effect: [{ kind: 'discardAsset', amount: 1 }] },
            { id: 'damage', label: '受到1点伤害', effect: [{ kind: 'damage', amount: 1 }] },
          ],
        }],
      },
    ],
  }),
  masterBedroom: location('masterBedroom', SPECTRAL_LOCATIONS.masterBedroom, {
    symbol: 'heart', links: ['t', 'moon'], spectral: true,
    haunted: [
      { text: '闹鬼 - 将你的1个线索放到主卧。', effect: [{ kind: 'placeClue', amount: 1 }] },
    ],
  }),
  balcony: location('balcony', SPECTRAL_LOCATIONS.balcony, {
    symbol: 'moon', links: ['heart'], spectral: true,
    haunted: [
      { text: '闹鬼 - 你每张带有生命值的卡牌受到1点直接伤害。', effect: [{ kind: 'damageAssets', amount: 1 }] },
    ],
  }),
  office: location('office', SPECTRAL_LOCATIONS.office, {
    symbol: 'star', links: ['t'], spectral: true,
    haunted: [
      { text: '闹鬼 - 选择并弃掉你一张手牌。', effect: [{ kind: 'discardChosen', amount: 1 }] },
    ],
  }),
}
linkSymbolLocations(locations)

export { locations }

// ---- 遭遇牌库 ------------------------------------------------------------

// 幽灵看守人开局入场，不能同时出现在遭遇牌库；其余设置卡按「已选调查员」在 modifyDeck 移除。
const setAsideCodes = [THE_SPECTRAL_WATCHER]
const setAside = new Set(setAsideCodes)
const gathered = encounterCards(DECK_GROUPS).filter(card => !setAside.has(card.code))
// 放在一边的看守人也需要定义（behavior.setupEnemies 用 api.spawn 生成时读 state.scenario.enemies）。
const definitions = encounterDefinitions([
  ...gathered,
  ...setAsideCodes.map(code => ALL_CARDS[code]),
])

// ---- 关卡数据 ------------------------------------------------------------

export const scenario = {
  id: 'disappearanceAtTheTwilightEstate',
  originalCode: SCENARIO_CARD,
  name: '万象无终 · 暮色庄园失踪事件',
  intro: '1925年11月22日，阿卡姆。银暮秘社的慈善晚会正在法兰西山的庄园里举行；黑雾漫进宅邸，'
    + '几位与会者被卷入了不属于人世的角落。序章没有胜利可言——你们只能尽力活得更久，并在末日来临前查清发生了什么。',
  setup: '收齐「暮色庄园失踪事件」「在劫难逃」「冥界」「幽灵捕食者」「被困的灵魂」「看守人」「寒冷刺骨」'
    + '遭遇组（死亡门前只取 7 张幽灵地点）。放置 7 张幽灵地点，把幽灵看守人放在入口大厅。'
    + '每位玩家选择一位中立故事调查员并按其卡背设置，然后从塔罗牌组抽 1 张正位牌，按结果记录其命运。'
    + '未满 4 人时把未选的故事调查员从「失踪人口」中划掉。',
  startLocation: START_LOCATION,
  locations,
  // 4 位无牌组故事调查员（P2.6）：选人由 setup.js 在 prepareInvestigator 之前完成。
  storyInvestigators: {
    codes: [...STORY_INVESTIGATOR_CODES],
    crossOutUnused: true,
    setupCards: Object.fromEntries(STORY_INVESTIGATOR_CODES
      .filter(code => STORY_INVESTIGATOR_SETUP[code].startingPlayArea.length)
      .map(code => [code, [...STORY_INVESTIGATOR_SETUP[code].startingPlayArea]])),
    prompt: '选择你本次序章使用的故事调查员（没有牌组；未选者从失踪人口中划掉）。',
  },
  acts: stages([ACT_CARD], 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 序章没有可推进目标：只统计「被消除者留在幕上的线索」。
  })),
  agendas: stages([AGENDA_CARD], 'agenda').map(agenda => ({
    ...agenda,
    // 审判·XX 没有毁灭阈值：只在调查员被击败时结算 1b（见 behavior.investigatorEliminated）。
    doomThreshold: null,
    reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: '未达成任何结局，因为每位调查员都已被击败：桑福德先生抵达庄园，约瑟夫在宅邸里与他低语。'
      + '序章不获得经验值；在战役日志中记录最后留下了多少证据（幕 1a 上的线索总数），然后进入《巫异时刻》。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

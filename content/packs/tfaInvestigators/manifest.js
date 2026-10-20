import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const investigatorCards = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode
    && (card.type === 'investigator' || card.signatureFor))
  .sort((left, right) => left.code.localeCompare(right.code))

// M1: five investigators plus their eleven signature / weakness cards are
// implemented. Signature assets, events and weakness triggers all live here so
// card-effects.js only spreads the tables; the engine still owns resolution.
export const TFA_INVESTIGATOR_ACCEPTANCE_PROFILE = Object.freeze({
  id: 'original-forgotten-age-investigators-2026-10',
  scope: '失落的时代五位调查员及 11 张专属卡逐人验收。',
})

const implementedCodes = new Set([
  '04001', '04002', '04003', '04004', '04005',
  '04006', '04007', '04008', '04009', '04010', '04011', '04012', '04013', '04014', '04015', '04016',
])
export const tfaInvestigatorCardVerified = code => implementedCodes.has(code)

export const INVESTIGATOR_CODES = Object.freeze(['04001', '04002', '04003', '04004', '04005'])

// Source: 参考资源/.../library/Arkham/Investigator/Cards/TheForgottenAge/*.hs
export const investigatorAbilities = {
  '04001': { // 里奥·安德森 Leo Anderson
    // Reaction: 回合开始后打出 1 张盟友支援，费用减 1。
    reactions: [{
      id: 'leoPlayAlly', when: 'turnBegins', selfOnly: true, limit: 'turn',
      prompt: '是否打出 1 张盟友支援（费用减 1）？',
      effect: { type: 'tfaInvestigator', action: 'playAllyDiscounted', amount: 1 },
    }],
    // 旧印：+2，查找牌库顶 3 张并抽出其中的盟友支援。
    elderSign: { kind: 'tfaSearchAlly', bonus: 2, amount: 3 },
  },
  '04002': { // 厄休拉·唐斯 Ursula Downs
    // Reaction: 移动后进行调查行动（每轮一次）。
    reactions: [{
      id: 'ursulaInvestigate', when: 'move', selfOnly: true, limit: 'round',
      prompt: '是否立刻进行一次调查行动？',
      effect: { type: 'tfaInvestigator', action: 'investigateAction' },
    }],
    // 旧印：+1；检定结束后可以移动到连接地点。
    elderSign: { kind: 'tfaMoveAfterTest', bonus: 1 },
  },
  '04003': { // 芬恩·爱德华兹 Finn Edwards
    // 每回合额外 1 个只能用于躲避的行动。
    extraEvadeAction: true,
    // 旧印：场上每个横置敌人 +1；成功且超过难度 2 点时可以发现 1 个线索。
    elderSign: { kind: 'tfaPerExhaustedEnemy', clueOnSuccessBy: 2 },
  },
  '04004': { // 马泰奥神父 Father Mateo
    // Reaction: 任何调查员揭示 autofail 时改为 elder_sign（每局一次）。
    autofailToElderSign: { oncePerGame: true },
    // 旧印：自动成功；检定结束后二选一。
    elderSign: { kind: 'tfaChosenReward' },
  },
  '04005': { // 加尔文·怀特 Calvin Wright
    // 每点恐惧使意志与智识 +1，每点伤害使战斗与敏捷 +1。
    statsPerHarm: {
      horror: { willpower: 1, intellect: 1 },
      damage: { combat: 1, agility: 1 },
    },
    // 旧印：+0；可以治疗 1 点伤害或恐惧，或受到 1 点直接伤害或恐惧。
    elderSign: { kind: 'tfaCalvinSign' },
  },
}

// Source: 参考资源/.../library/Arkham/Player/Cards/TheForgottenAge/*.hs
export const signatureEffects = {
  '04006': { // 米奇·布朗 Mitch Brown
    passive: { allySlotsForNonUnique: 2 },
  },
  '04007': { // 血的代价 Bought in Blood
    weakness: { type: 'boughtInBlood' },
  },
  '04008': { // 杰克·威廉斯 Jake Williams
    passive: { noOpportunityFirstAction: true },
    reactions: [{
      id: 'jakeDraw', when: 'locationRevealed', cost: { exhaust: true }, limit: 'round',
      prompt: '是否横置杰克·威廉斯抽取 1 张牌？',
      effect: { type: 'draw', amount: 1 },
    }],
  },
  '04009': { // 未知的呼唤 Call of the Unknown
    weakness: { type: 'threat', turnForced: 'callOfTheUnknown' },
  },
  '04010': { // 走私货物 Smuggled Goods
    playRestriction: 'noReadyEnemy',
    event: { type: 'tfaInvestigator', action: 'smuggledGoods', trait: 'Illicit', traitZh: '违法', amount: 9 },
  },
  '04011': { // 芬恩可靠的.38手枪 Finn's Trusty .38
    fast: true, uses: 3, usesType: 'ammo',
    abilities: [{
      label: '花费 1 子弹：攻击（战斗 +2，未交战敌人额外 +1 伤害）',
      cost: { action: true, uses: 1 },
      effect: { type: 'tfaInvestigator', action: 'finnPistol', kind: 'fight' },
    }],
  },
  '04012': { // 当场抓获 Caught Red-Handed
    weakness: { type: 'caughtRedHanded' },
  },
  '04013': { // 古代抄本 The Codex of Ages
    sealOnEnter: 'eldersign',
    substituteSealedElderSign: true,
    passive: { statsWhileSealed: { willpower: 1 } },
  },
  '04014': { // 伊格蛇族 Serpents of Yig
    enemyWeakness: { sealsElderSign: true, hunter: true, prey: 'bearer' },
  },
  '04015': { // 时间尽头 Until the End of Time
    passive: { assignDirectHarm: true },
  },
  '04016': { // 信使之声 Voice of the Messenger
    weakness: { type: 'voiceOfTheMessenger' },
  },
}

export const runtimeDependencyCodes = ['04009', '04014']

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tfaInvestigators',
  name: '失落的时代 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n4.2',
  status: 'verified',
  dependencies: ['core'],
  description: 'M1 五位调查员的能力、构筑、旧印、专属卡与专属弱点已逐人验收。',
  cardRanges: [{ from: '04001', to: '04016' }],
  cards: investigatorCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: implementedCodes.has(card.code),
    deckbuilding: !!card.signatureFor,
  })),
  encounterGroupIds: [],
  behaviorIds: [
    'leoAnderson', 'mitchBrown', 'boughtInBlood',
    'ursulaDowns', 'jakeWilliams', 'callOfTheUnknown',
    'finnEdwards', 'smuggledGoods', 'finnsTrusty38', 'caughtRedHanded',
    'fatherMateo', 'codexOfAges', 'serpentsOfYig',
    'calvinWright', 'untilTheEndOfTime', 'voiceOfTheMessenger',
  ],
}

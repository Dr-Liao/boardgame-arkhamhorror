import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const investigatorCards = Object.values(ALL_CARDS)
  .filter(card => /^03\d{3}$/.test(card.code) && (card.type === 'investigator' || card.signatureFor))
  .sort((left, right) => left.code.localeCompare(right.code))
const implementedCodes = new Set(['03001', '03004', '03005', '03007', '03008', '03009', '03009b',
  '03002', '03003', '03006', '03010', '03011', '03012', '03013', '03014', '03015',
  '03016', '03017', '03018', '03019'])
export const CARCOSA_INVESTIGATOR_ACCEPTANCE_PROFILE = Object.freeze({
  id: 'original-carcosa-investigators-2026-10',
  scope: '卡尔克萨之路六位调查员及13张专属卡逐人验收。',
})
export const carcosaInvestigatorCardVerified = code => implementedCodes.has(code)

export const investigatorAbilities = {
  '03001': {
    startsWith: ['03009'],
    elderSign: { kind: 'perDamage', base: 0 },
    reactions: [{ id: 'markDraw', when: 'damagePlaced', limit: 'phase', effect: { type: 'draw', amount: 1 } }],
  },
  '03002': { elderSign: { kind: 'minh', bonus: 1 }, commitWildPerInvestigator: true },
  '03003': {
    elderSign: { kind: 'static', bonus: 3, onSuccess: { type: 'carcosaInvestigator', action: 'sefinaElderSign' } },
    freeAction: {
      id: 'sefinaBeneath',
      label: '抽取赛菲娜下方的一张事件',
      cost: {},
      actionCost: 1,
      noOpportunityAttack: true,
      repeatable: true,
      effect: { type: 'carcosaInvestigator', action: 'sefinaDrawBeneath' },
    },
  },
  '03004': {
    elderSign: { kind: 'akachi', bonus: 1 },
    additionalChargeOnEnter: 1,
  },
  '03005': {
    elderSign: { kind: 'static', bonus: 2, onSuccess: { type: 'carcosaInvestigator', action: 'yorickElderSign' } },
    reactions: [{
      id: 'yorickAsset',
      when: 'defeatEnemy',
      limit: 'round',
      effect: { type: 'carcosaInvestigator', action: 'yorickPlayAsset' },
    }],
  },
  '03006': {
    elderSign: { kind: 'static', bonus: 2, onSuccess: { type: 'carcosaInvestigator', action: 'lolaSwitchRole' } },
    freeAction: {
      id: 'lolaRole',
      label: '⚡ 切换罗拉的角色',
      cost: {},
      effect: { type: 'carcosaInvestigator', action: 'lolaSwitchRole' },
      limit: 'round',
    },
  },
}

export const signatureEffects = {
  '03009': {
    cannotLeavePlay: true,
    abilities: [{
      label: '受到1点直接伤害：本次检定任意技能值+2',
      cost: { action: false, damageSelf: 1 },
      duringOwnSkillTest: true,
      maximumInvestigatorDamage: 4,
      effect: { type: 'addTestValue', amount: 2 },
    }],
  },
  // 03010 分析性思维已迁到能力层（5a-5）：条目 passive 上的 analyticalMind 标记，
  // 读点是引擎 commit 段的 registeredEntry(...).passive.analyticalMind。
  '03011': { weakness: { type: 'threat' }, kingInYellow: true, cannotLeavePlay: true },
  '03012': { paintedWorld: true },
  // 03014 灵语人 / 03015 愤怒之灵已迁到能力层（5c-28），见 MIGRATED_ESCAPE_ENTRIES_5C28。
  // 03015 的威胁区弱点数据体也随同一条目搬走（弱点读点仍是 weaknessProfile）。
  // 03016 掩埋已迁到能力层（5c-27），见 MIGRATED_ESCAPE_ENTRIES_5C27。
  // 03018 即兴表演 / 03106 英勇救援已迁到能力层（5c-32），见 MIGRATED_ESCAPE_ENTRIES_5C32。
  '03017': { enemyWeakness: { hunter: true, prey: 'bearer', lockDiscardWhileEngaged: true } },
}

export const runtimeDependencyCodes = ['03009b']

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'carcosaInvestigators',
  name: '卡尔克萨之路 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n4.2',
  status: 'verified',
  dependencies: ['core'],
  description: 'C1 六位调查员的能力、构筑、专属卡、专属弱点与存档回放已通过逐人验收。',
  cardRanges: [{ from: '03001', to: '03342' }],
  cards: investigatorCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: implementedCodes.has(card.code),
    deckbuilding: false,
  })),
  encounterGroupIds: [],
  behaviorIds: ['markHarrigan', 'theHomeFront', 'shellShock', 'sophie', 'sophieReverse',
    'akachiOnyele', 'spiritSpeaker', 'angeredSpirits',
    'williamYorick', 'buryThemDeep', 'graveyardGhouls',
    'lolaHayes', 'improvisation', 'crisisOfIdentity',
    'minhThiPhan', 'analyticalMind', 'kingInYellow',
    'sefinaRousseau', 'paintedWorld', 'starsOfHyades'],
}

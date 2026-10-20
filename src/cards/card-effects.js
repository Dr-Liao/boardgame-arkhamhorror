// 诡镇奇谈：卡牌版（Arkham Horror LCG）· 卡牌效果编码（Phase 3 · 核心包全量）
//
// 本文件按效果 DSL（effects.js）为核心包（Core Set）全部卡牌逐张编码效果。
// 卡牌「数据」（名字/类型/阵营/费用/槽位/技能图标/构筑元数据）来自 cards-data.js；
// 本文件只负责「效果」，两者分离（对应 ACTION_PLAN §3 原则 2）。
//
// 效果定义 schema（EFFECTS[code]）：
//   asset:  { uses?, usesType?, passive?, abilities?, freeTriggers?, reactions? }
//   event:  { event }
//   skill:  { skill: { onSuccess: { draw?|damageBonus?|clueBonus?|healHorror? } } }   // 投入后检定成功的附加效果
//   weakness:{ weakness }                       // 揭示时结算（含 threat 持续型弱点）
//   passive: { stats?, fightDamage?, healthBonus?, sanityBonus?, handSizeBonus?, handSlotsBonus? }
//   abilities: [{ label, cost:{action?, exhaust?, uses?, resources?, discardSelf?}, effect }]
//   freeTriggers: [{ skill, cost:{resources}, bonus }]   // 天赋牌：检定前自动投入
//   engine: 'xxx'   // 该卡的效果由 engine.js 按卡号硬编码，本文件只登记、参数化不了；
//                   // 出现的取值见 engineHandledEffects()，供校验与检索使用。
//
// 威胁区域（threat）弱点 schema（weakness.type === 'threat'）：
//   mods: { allSkills?:N }             —— 全技能修正
//   forced: { onHorror?/onDamage? }    —— 受到恐惧/伤害后的强制效果
//   discardCost: { action:N }          —— 花费 N 行动弃掉
//   clues: N + redirectClues           —— 掩盖罪证：拦截线索
//   horror: N + eldersignToAutofail    —— 死灵之书：恐怖计数 + 使 elder_sign 变自动失败
//   debt: true                          —— 医院债务（战役期结算，Phase 4）
//
// 调查员异能（INVESTIGATOR_ABILITIES[code]）：
//   elderSign: { kind:'perClueAtLocation'|'perHorror'|'static'|'drawPerTome'|'wendyAmulet', bonus?, onSuccess? }
//   reactions: [{ when:'defeatEnemy'|'horrorPlaced', limit:'round'|'phase', effect }]
//   freeAction: { cost:{resources}, effect, limit }    —— 如「倒霉蛋」奥图尔：花 2 资源 +1 行动
//   extraTomeAction: true                              —— 黛西：控制书籍时额外 1 行动
//
// 约定：未 100% 还原参考实现效果的卡，一律带 simplified:true + note，显式标记「简化」，不静默。
//
// 版权声明：卡名/设定/规则文本版权归 Fantasy Flight Games，本文件为粉丝项目。

import { expansionEffects } from '../../content/expansions.js'
import { investigatorAbilities as dunwichInvestigatorAbilities, signatureEffects as dunwichSignatureEffects, basicWeaknessEffects as dunwichBasicWeaknessEffects } from '../../content/packs/dunwichInvestigators/manifest.js'
import { investigatorAbilities as carcosaInvestigatorAbilities, signatureEffects as carcosaSignatureEffects } from '../../content/packs/carcosaInvestigators/manifest.js'
import { effects as carcosaPlayerEffects } from '../../content/packs/carcosaPlayer/effects.js'
import { investigatorAbilities as tfaInvestigatorAbilities, signatureEffects as tfaSignatureEffects } from '../../content/packs/tfaInvestigators/manifest.js'
import { effects as tfaPlayerEffects } from '../../content/packs/tfaPlayer/effects.js'

// Only unconditional resource rewards are safe to accept without a decision.
// Draws can reveal weaknesses; limited triggers and costs remain discretionary.
export function isAutomaticReward(reaction) {
  const effect = reaction?.effect
  return !!effect && effect.type === 'gainResource' && (effect.amount ?? 1) > 0
    && !effect.target && !reaction.limit && !Object.values(reaction.cost || {}).some(Boolean)
}

export const EFFECTS = {
  ...expansionEffects,
  ...dunwichSignatureEffects,
  ...dunwichBasicWeaknessEffects,
  ...carcosaSignatureEffects,
  ...tfaSignatureEffects,
  ...carcosaPlayerEffects,
  ...tfaPlayerEffects,
  // Story assets earned during The Path to Carcosa.
  // =========================================================================
  // 中立 Neutral（0 级）
  // =========================================================================
  // 03143 焦虑（剧情资产）：理智 -1；理智不多于 3 时意志/战斗/敏捷 +1。
  '03143': { passive: { sanityBonus: -1, conditionalStats: {
    remainingSanityAtMost: 3, stats: { willpower: 1, combat: 1, agility: 1 },
  } } },
  '01086': { // 刀子 Knife
    abilities: [
      { label: '战斗（战斗 +1）', cost: { action: true }, effect: { type: 'fight', combatBonus: 1 } },
      { label: '弃置刀子（战斗 +2，伤害 +1）', cost: { action: true, discardSelf: true }, effect: { type: 'fight', combatBonus: 2, damageBonus: 1 } },
    ],
  },
  // 01088 应急物品已迁到能力层（kind: 'played'，见 src/cards/card-abilities.js）。
  // 防弹衣 / 远古印记护身符：卡面没有规则文本，只提供印刷生命/神智作为承伤容量，
  // 承伤逻辑在 engine.assignHarm() 里按 cardDef(code).health/sanity 通用处理。
  '01094': { engine: 'printedSoak' },
  '01095': { engine: 'printedSoak' },

  // =========================================================================
  // 守卫者 Guardian（0 级 + XP）
  // =========================================================================

  '01022': { // 证据！Evidence!
    fast: true,
    reaction: { when: 'defeatEnemy', selfOnly: true },
    event: { type: 'discoverClue', amount: 1 },
  },
  '01023': { // 闪躲 Dodge
    fast: true,
    reaction: { when: 'enemyAttack' },
    event: { type: 'cancelEnemyAttack' },
  },



  // =========================================================================
  // 探求者 Seeker（0 级 + XP）
  // =========================================================================

  // =========================================================================
  // 游荡者 Rogue（0 级 + XP）
  // =========================================================================
  '01044': { // 弹簧刀 Switchblade
    fast: true,
    abilities: [
      { label: '战斗（成功差值至少 2 时伤害 +1）', cost: { action: true }, effect: { type: 'fight', successBy: 2, damageBonus: 1 } },
    ],
  },
  '01056': { // 老千手法 Sleight of Hand（XP3）
    fast: true,
    reaction: { when: 'negativeTokenRevealed', selfOnly: true },
    event: { type: 'flipTokenSign' },
  },

  // =========================================================================
  // 秘术师 Mystic（0 级 + XP）
  // =========================================================================
  '01063': { // 新晋术士 Arcane Initiate
    onPlayDoom: 1,
    abilities: [
      { label: '召唤（检索牌库顶 3 张中的法术牌）', cost: { action: false, exhaust: true }, effect: { type: 'searchTop', amount: 3, trait: 'Spell', choose: 1 } },
    ],
  },
  '01065': { // 守护结界 Ward of Protection
    fast: true,
    reaction: { when: 'treachery', selfOnly: true, nonWeaknessOnly: true },
    event: { type: 'sequence', effects: [{ type: 'cancelTreachery' }, { type: 'takeHorror', amount: 1 }] },
  },
  '01068': { // 记忆抹消 Memory Wipe（XP1）
    fast: true,
    reaction: { when: 'phaseBegins' },
    event: { type: 'blankEnemy' },
  },

  // =========================================================================
  // 幸存者 Survivor（0 级 + XP）
  // =========================================================================
  '01072': { // 皮大衣 Leather Coat（无规则文本，印刷生命 2 作为承伤容量）
    engine: 'printedSoak',
  },
  '01076': { // 野猫 Stray Cat
    abilities: [
      { label: '引开（弃掉野猫，自动躲避同地点非精英敌人）', cost: { action: false, discardSelf: true }, effect: { type: 'autoEvadeNonElite' } },
    ],
  },
  '01079': { // “看看我发现了什么！”Look what I found!
    fast: true,
    reaction: { when: 'investigateFail', failedByAtMost: 2, selfOnly: true },
    event: { type: 'discoverClue', amount: 2 },
  },
  '01080': { // 运气好！Lucky!
    fast: true,
    reaction: { when: 'testWouldFail', selfOnly: true },
    event: { type: 'addTestValue', amount: 2 },
  },
  '01083': { // 千钧一发 Close Call（XP2）
    fast: true,
    reaction: { when: 'evadeSuccess', nonElite: true, nonWeakness: true, selfOnly: true },
    event: { type: 'shuffleIntoEncounter' },
  },
  '01084': { // 运气好！Lucky!（XP2）
    fast: true,
    reaction: { when: 'testWouldFail', selfOnly: true },
    event: { type: 'sequence', effects: [{ type: 'addTestValue', amount: 2 }, { type: 'draw', amount: 1 }] },
  },

  // =========================================================================
  // 专属签名卡（5 张）
  // =========================================================================
  '01010': { // 在逃中 On the Lam
    fast: true,
    reaction: { when: 'turnBegins', selfOnly: true },
    event: { type: 'onTheLam' },
  },
  '01014': { // 温蒂的护身符 Wendy's Amulet
    // 两条能力都在 engine.js 里按卡号实现：弃牌堆顶事件可当手牌打出（engine.js:2021-2027、
    // 8160、8653-8655），打出的事件改为放到牌库底（engine.js disposePlayedEvent）。
    engine: 'wendyAmulet',
  },

  // =========================================================================
  // 专属弱点（5 张，揭示时结算）
  // =========================================================================
  '01013': { // 黑暗回忆 Dark Memory（放置毁灭 + 恐惧）
    playableWeakness: true, endTurnInHandHorror: 2,
    event: { type: 'addDoom', amount: 1 },
  },

  // =========================================================================
  // 核心包基础弱点（非敌人 5 张；敌人弱点 01101~01103 由 engine 按敌人卡直接生成）
  // =========================================================================
  // 01096 失忆 / 01097 妄想症：已迁到能力层（kind: 'weakness'，见 src/cards/card-abilities.js）。
// 恶灵附身 Haunted
// 神经紊乱 Psychosis
// 忧郁症 Hypochondria

  // =========================================================================
  // 剧情资产（丽塔·钱德勒 01117，场景 2 推进时在客厅生成）
  // =========================================================================
  '01117': { // 剧情资产：丽塔·钱德勒（光环/谈判/献祭都由 engine.js 按卡号硬编码）
    engine: 'litaAura',
  },
}

// ---------------------------------------------------------------------------
// 调查员异能（Phase 3.1：完整 [reaction] / [elder_sign] / free 能力）
// ---------------------------------------------------------------------------

export const INVESTIGATOR_ABILITIES = {
  ...dunwichInvestigatorAbilities,
  ...carcosaInvestigatorAbilities,
  ...tfaInvestigatorAbilities,
  '01001': { // 罗兰·班克斯 Roland Banks
    elderSign: { kind: 'perClueAtLocation', bonus: 1 },
    reactions: [{ id: 'rolandClue', when: 'defeatEnemy', limit: 'round', effect: { type: 'discoverClue', amount: 1 } }],
  },
  '01002': { // 黛西·沃克 Daisy Walker
    elderSign: { kind: 'drawPerTome' },
    extraTomeAction: true,
  },
  '01003': { // “倒霉蛋”奥图尔 Skids O'Toole
    elderSign: { kind: 'static', bonus: 2, onSuccess: { type: 'gainResource', amount: 2 } },
    freeAction: { id: 'skidsAction', cost: { resources: 2 }, effect: { type: 'gainAction', amount: 1 }, limit: 'round' },
  },
  '01004': { // 艾格尼丝·贝克 Agnes Baker
    elderSign: { kind: 'perHorror', bonus: 1 },
    reactions: [{ id: 'agnesDamage', when: 'horrorPlaced', limit: 'phase', effect: { type: 'dealDamage', amount: 1, target: 'here' } }],
  },
  '01005': { // 温蒂·亚当斯 Wendy Adams
    elderSign: { kind: 'wendyAmulet' },
    chaosTokenRedraw: true,
  },
}

// 返回所有「可玩玩家卡」的 code 列表（含纯技能牌，其图标来自 cards-data.js）。
export function playablePlayerCardCodes() {
  return Object.keys(EFFECTS)
}

// 「数据登记 + 引擎实现」的卡：engine 标记 → 卡号列表。
// 这些卡的卡文仍由 engine.js 按卡号硬编码，本表用于检索与一致性校验。
export function engineHandledEffects() {
  const out = {}
  for (const [code, effect] of Object.entries(EFFECTS)) {
    const marker = effect && effect.engine
    if (typeof marker === 'string') (out[marker] ||= []).push(code)
  }
  return out
}

// 核心包应编码效果的卡牌 code（用于 Phase 3.5 校验：无「未实现」占位）。
// 调查员 5 张由 INVESTIGATOR_ABILITIES 覆盖；敌人型基础弱点 3 张由 engine 的 enemyDef 覆盖。
export function coreEffectCodes() {
  return [
    // 中立（0 级 + XP + 技能）
    '01086', '01087', '01088', '01089', '01090', '01091', '01092', '01093', '01094', '01095',
    // 守卫者
    '01016', '01017', '01018', '01019', '01020', '01021', '01022', '01023', '01024', '01025', '01026', '01027', '01028', '01029',
    // 探求者
    '01030', '01031', '01032', '01033', '01034', '01035', '01036', '01037', '01038', '01039', '01040', '01041', '01042', '01043',
    // 游荡者
    '01044', '01045', '01046', '01047', '01048', '01049', '01050', '01051', '01052', '01053', '01054', '01055', '01056', '01057',
    // 秘术师
    '01058', '01059', '01060', '01061', '01062', '01063', '01064', '01065', '01066', '01067', '01068', '01069', '01070', '01071',
    // 幸存者
    '01072', '01073', '01074', '01075', '01076', '01077', '01078', '01079', '01080', '01081', '01082', '01083', '01084', '01085',
    // 专属签名卡
    '01006', '01008', '01010', '01012', '01014',
    // 专属弱点（敌人型 01009 由 threat 覆盖）
    '01007', '01009', '01011', '01013', '01015',
    // 基础弱点（非敌人 5 张）
    '01096', '01097', '01098', '01099', '01100',
    // 剧情资产
    '01117',
  ]
}

// 统计：已编码效果 vs 简化标记。
export function effectStats(cards) {
  let encoded = 0
  let simplified = 0
  for (const card of cards) {
    if (EFFECTS[card.code]) {
      encoded++
      if (EFFECTS[card.code].simplified) simplified++
    }
  }
  return { encoded, simplified }
}

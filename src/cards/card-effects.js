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
import { signatureEffects as dunwichSignatureEffects, basicWeaknessEffects as dunwichBasicWeaknessEffects } from '../../content/packs/dunwichInvestigators/manifest.js'
import { signatureEffects as carcosaSignatureEffects } from '../../content/packs/carcosaInvestigators/manifest.js'
import { effects as carcosaPlayerEffects } from '../../content/packs/carcosaPlayer/effects.js'
import { signatureEffects as tfaSignatureEffects } from '../../content/packs/tfaInvestigators/manifest.js'
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
  // 01086 已迁到能力层（kind: 'action'，见 6e-14）。
  // 01088 应急物品已迁到能力层（kind: 'played'，见 src/cards/card-abilities.js）。
  // 01094 防弹衣 / 01095 远古印记护身符：卡面没有规则文本，只提供印刷生命/神智作为承伤容量，
  // 承伤逻辑在 engine.assignHarm() 里按 cardDef(code).health/sanity 通用处理。
  // Phase 6（6e-2）：纯登记条目（`engine: 'printedSoak'`）已删除，实现判定见
  // src/cards/card-implementation.js 的 DATA_IMPLEMENTED_CODES（data 通道）。

  // =========================================================================
  // 守卫者 Guardian（0 级 + XP）
  // =========================================================================

  // 01022 证据！已迁到能力层（kind: 'played' + fast + trigger，见 6e-8）。
  // 01023 已迁到能力层（kind:'played'，见 6e-8）。



  // =========================================================================
  // 探求者 Seeker（0 级 + XP）
  // =========================================================================

  // =========================================================================
  // 游荡者 Rogue（0 级 + XP）
  // =========================================================================
  // 01044 已迁到能力层（kind: 'action'，见 6e-14）。
  // 01056 已迁到能力层（kind:'played'，见 6e-8）。

  // =========================================================================
  // 秘术师 Mystic（0 级 + XP）
  // =========================================================================
  // 01063 已迁到能力层（kind: 'action'，见 6e-14）。
  // 01065 已迁到能力层（kind:'played'，见 6e-8）。
  // 01068 已迁到能力层（kind:'played'，见 6e-8）。

  // =========================================================================
  // 幸存者 Survivor（0 级 + XP）
  // =========================================================================
  // 01072 皮大衣（无规则文本，印刷生命 2 作为承伤容量）：纯登记条目已在 6e-2 删除。
  // 01076 已迁到能力层（kind: 'action'，见 6e-14）。
  // 01079 已迁到能力层（kind:'played'，见 6e-8）。
  // 01080 已迁到能力层（kind:'played'，见 6e-8）。
  // 01083 已迁到能力层（kind:'played'，见 6e-8）。
  // 01084 已迁到能力层（kind:'played'，见 6e-8）。

  // =========================================================================
  // 专属签名卡（5 张）
  // =========================================================================
  // 01010 已迁到能力层（kind:'played'，见 6e-8）。
  // 01014 温蒂的护身符：两条能力都已在能力层（条目级 playedEventsToDeckTop，见 5a-18）。
  // 纯登记条目 `engine: 'wendyAmulet'` 已在 6e-2 删除。

  // =========================================================================
  // 专属弱点（5 张，揭示时结算）
  // =========================================================================
  // 01013 已迁到能力层（6e-16：条目级规则字段 / weakness 数据体）。

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
  // 01117 丽塔·钱德勒：光环由条目级 auraWhileInPlay 声明（5a-31），
  // 纯登记条目 `engine: 'litaAura'` 已在 6e-2 删除。
}

// ---------------------------------------------------------------------------
// 调查员异能（Phase 3.1：完整 [reaction] / [elder_sign] / free 能力）
// 第 6 批：数据体已搬进 entries/<code>.js 的 `investigator` 字段；
// 这里只保留兼容导出，供尚未改读点的工具/测试使用。
// ---------------------------------------------------------------------------

export { INVESTIGATOR_ABILITIES } from './investigator-abilities.js'

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
  // 第 126 轮：旧 DSL（EFFECTS）已清空，encoded / simplified 恒为 0；保留签名给审计工具。
  void cards
  return { encoded: 0, simplified: 0 }
}

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
  ...carcosaPlayerEffects,
  // Story assets earned during The Path to Carcosa.
  '03143': { passive: { sanityBonus: -1, conditionalStats: {
    remainingSanityAtMost: 3, stats: { willpower: 1, combat: 1, agility: 1 },
  } } },
  // =========================================================================
  // 中立 Neutral（0 级）
  // =========================================================================
  '01086': { // 刀子 Knife
    abilities: [
      { label: '战斗（战斗 +1）', cost: { action: true }, effect: { type: 'fight', combatBonus: 1 } },
      { label: '弃置刀子（战斗 +2，伤害 +1）', cost: { action: true, discardSelf: true }, effect: { type: 'fight', combatBonus: 2, damageBonus: 1 } },
    ],
  },
  '01087': { // 手电筒 Flashlight
    uses: 3, usesType: 'supplies',
    abilities: [
      { label: '照亮（调查，帷幕 -2）', cost: { action: true, uses: 1 }, effect: { type: 'investigate', shroudMod: -2 } },
    ],
  },
  '01088': { // 应急物品 Emergency Cache
    event: { type: 'gainResource', amount: 3 },
  },
  '01089': { // 胆识 Guts（技能）
    skill: { onSuccess: { draw: 1 } },
  },
  '01090': { // 洞察力 Perception（技能）
    skill: { onSuccess: { draw: 1 } },
  },
  '01091': { // 压制 Overpower（技能）
    skill: { onSuccess: { draw: 1 } },
  },
  '01092': { // 心灵手巧 Manual Dexterity（技能）
    skill: { onSuccess: { draw: 1 } },
  },
  '01093': { // 绝处逢生 Unexpected Courage（技能，纯野性图标）
    skill: {},
  },
  // 防弹衣 / 远古印记护身符：卡面没有规则文本，只提供印刷生命/神智作为承伤容量，
  // 承伤逻辑在 engine.assignHarm() 里按 cardDef(code).health/sanity 通用处理。
  '01094': { engine: 'printedSoak' },
  '01095': { engine: 'printedSoak' },

  // =========================================================================
  // 守卫者 Guardian（0 级 + XP）
  // =========================================================================
  '01016': { // .45 自动手枪
    uses: 4, usesType: 'ammo',
    abilities: [
      { label: '射击（战斗 +1，伤害 +1）', cost: { action: true, uses: 1 }, effect: { type: 'fight', combatBonus: 1, damageBonus: 1 } },
    ],
  },
  '01017': { // 体能训练 Physical Training（天赋）
    freeTriggers: [
      { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
      { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    ],
  },
  '01018': { // 巡警 Beat Cop
    passive: { stats: { combat: 1 } },
    abilities: [
      { label: '射击（对同地点敌人造成 1 伤害）', cost: { action: false, discardSelf: true }, effect: { type: 'dealDamage', amount: 1, target: 'here' } },
    ],
  },
  '01019': { // 急救 First Aid
    uses: 3, usesType: 'supplies', discardWhenEmpty: true,
    abilities: [
      { label: '治疗 1 伤害或 1 恐惧', cost: { action: true, uses: 1 }, effect: { type: 'targetedEffect', target: 'location', effect: { type: 'chooseOne', options: [
        { label: '治疗 1 伤害', effect: { type: 'heal', amount: 1, what: 'damage' } },
        { label: '治疗 1 恐惧', effect: { type: 'heal', amount: 1, what: 'horror' } },
      ] } } },
    ],
  },
  '01020': { // 大砍刀 Machete
    abilities: [
      { label: '战斗（战斗 +1，仅与目标交战时伤害 +1）', cost: { action: true }, effect: { type: 'fight', combatBonus: 1, onlyEngagedDamage: 1 } },
    ],
  },
  '01021': { // 看门狗 Guard Dog
    reactions: [
      { id: 'guardDog', when: 'enemyAttackDamage', requiresAssetDamage: true, effect: { type: 'dealDamage', amount: 1 } },
    ],
  },
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
  '01024': { // 炸药爆破 Dynamite Blast
    event: { type: 'dealDamageAll', amount: 3, location: 'choice', investigators: true, fx: 'dynamite' },
  },
  '01025': { // 致命打击 Vicious Blow（技能）
    skill: { onSuccess: { damageBonus: 1 } },
  },
  '01026': { // 多余的弹药 Extra Ammo（XP1）
    event: { type: 'reloadAmmo', amount: 3, trait: 'Firearm' },
  },
  '01027': { // 警徽 Police Badge（XP2）
    passive: { stats: { willpower: 1 } },
    abilities: [
      { label: '亮出警徽（弃掉警徽，正在行动的同地点调查员 +2 行动）', cost: { action: false, discardSelf: true }, effect: { type: 'targetedEffect', target: 'location', activeTurnOnly: true, effect: { type: 'gainAction', amount: 2 } } },
    ],
  },
  '01028': { // 巡警 Beat Cop（XP2）
    passive: { stats: { combat: 1 } },
    abilities: [
      { label: '射击（横置并受 1 伤害，对同地点敌人造成 1 伤害）', cost: { action: false, exhaust: true, assetDamage: 1 }, effect: { type: 'dealDamage', amount: 1, target: 'here' } },
    ],
  },
  '01029': { // 霰弹枪 Shotgun（XP4）
    uses: 2, usesType: 'ammo',
    abilities: [
      { label: '开火（战斗 +3，按超过难度造成 1~5 伤害）', cost: { action: true, uses: 1 }, effect: { type: 'fight', combatBonus: 3, successDamage: 'overDifficulty', minDamage: 1, maxDamage: 5, failByAmountToEngaged: true } },
    ],
  },

  // =========================================================================
  // 探求者 Seeker（0 级 + XP）
  // =========================================================================
  '01030': { // 放大镜 Magnifying Glass
    fast: true,
    passive: { investigateBonus: 1 },
  },
  '01031': { // 智慧古书 Old Book of Lore
    abilities: [
      { label: '研读（同地点调查员检索牌库顶 3 张，选择 1 张）', cost: { action: true, exhaust: true }, effect: { type: 'targetedEffect', target: 'location', effect: { type: 'searchTop', amount: 3, choose: 1 } } },
    ],
  },
  '01032': { // 研究馆员 Research Librarian
    reactions: [
      { id: 'researchLibrarian', when: 'assetEnteredPlay', assetCode: '01032', effect: { type: 'searchTop', amount: 999, trait: 'Tome', choose: 1 } },
    ],
  },
  '01033': { // 米兰·克里斯托弗博士 Dr. Milan Christopher
    passive: { stats: { intellect: 1 } },
    reactions: [
      { id: 'milan', when: 'investigateSuccess', effect: { type: 'gainResource', amount: 1 } },
    ],
  },
  '01034': { // 超感知 Hyperawareness（天赋）
    freeTriggers: [
      { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
      { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
    ],
  },
  '01035': { // 医学教科书 Medical Texts
    abilities: [
      { label: '诊断（智识 2；同地点调查员成功治疗 1 伤害，失败受到 1 伤害）', cost: { action: true }, effect: { type: 'targetedTest', target: 'location', skill: 'intellect', difficulty: 2, successEffect: { type: 'heal', amount: 1, what: 'damage' }, failEffect: { type: 'takeDamage', amount: 1 } } },
    ],
  },
  '01036': { // 心胜于物 Mind over Matter
    fast: true,
    event: { type: 'substituteSkill', from: ['combat', 'agility'], to: 'intellect' },
  },
  '01037': { // 专业的直觉 Working a Hunch
    fast: true,
    event: { type: 'discoverClue', amount: 1 },
  },
  '01038': { // 屏障 Barricade
    event: { type: 'attachBarricade' },
  },
  '01039': { // 推理 Deduction（技能）
    skill: { onSuccess: { clueBonus: 1 } },
  },
  '01040': { // 放大镜 Magnifying Glass（XP1）
    fast: true,
    passive: { investigateBonus: 1 },
    abilities: [
      { label: '没有线索时收回手中', requiresNoClues: true, cost: { action: false }, effect: { type: 'returnAssetToHand' } },
    ],
  },
  '01041': { // 伊察姆纳圆盘 Disc of Itzamna（XP2）
    reactions: [
      { id: 'discOfItzamna', when: 'enemySpawn', nonElite: true, cost: { discardSelf: true }, effect: { type: 'defeatNonEliteEnemy', target: 'here' } },
    ],
  },
  '01042': { // 百科全书 Encyclopedia（XP2）
    abilities: [
      { label: '查阅（同地点调查员任选一项技能 +2）', cost: { action: true, exhaust: true }, effect: { type: 'targetedEffect', target: 'location', chooseBy: 'controller', effect: { type: 'chooseOne', options: [
        { label: '意志 +2', effect: { type: 'addStatPhase', skill: 'willpower', amount: 2 } },
        { label: '智识 +2', effect: { type: 'addStatPhase', skill: 'intellect', amount: 2 } },
        { label: '战斗 +2', effect: { type: 'addStatPhase', skill: 'combat', amount: 2 } },
        { label: '敏捷 +2', effect: { type: 'addStatPhase', skill: 'agility', amount: 2 } },
      ] } } },
    ],
  },
  '01043': { // 隐秘的研究 Cryptic Research（XP4）
    fast: true,
    event: { type: 'targetedEffect', target: 'location', effect: { type: 'draw', amount: 3 } },
  },

  // =========================================================================
  // 游荡者 Rogue（0 级 + XP）
  // =========================================================================
  '01044': { // 弹簧刀 Switchblade
    fast: true,
    abilities: [
      { label: '战斗（成功差值至少 2 时伤害 +1）', cost: { action: true }, effect: { type: 'fight', successBy: 2, damageBonus: 1 } },
    ],
  },
  '01045': { // 夜盗 Burglary
    abilities: [
      { label: '搜刮（调查；成功则获得 3 资源而不发现线索）', cost: { action: true, exhaust: true }, effect: { type: 'investigateForResources', amount: 3 } },
    ],
  },
  '01046': { // 扒窃 Pickpocketing
    reactions: [
      { id: 'pickpocketing', when: 'evadeSuccess', cost: { exhaust: true }, effect: { type: 'draw', amount: 1 } },
    ],
  },
  '01047': { // .41 短口手枪
    uses: 3, usesType: 'ammo',
    abilities: [
      { label: '射击（战斗 +2，成功差值至少 2 时伤害 +1）', cost: { action: true, uses: 1 }, effect: { type: 'fight', combatBonus: 2, successBy: 2, damageBonus: 1 } },
    ],
  },
  '01048': { // 里奥·德·卢卡 Leo De Luca
    passive: { extraAction: 1 },
  },
  '01049': { // 沉重打击 Hard Knocks（天赋）
    freeTriggers: [
      { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
      { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
    ],
  },
  '01050': { // 逃避隐藏 Elusive
    fast: true,
    event: { type: 'sequence', effects: [
      { type: 'disengageAll' },
      { type: 'moveTo', anyRevealed: true, noEnemies: true },
    ] },
  },
  '01051': { // 背刺 Backstab
    event: { type: 'fight', skill: 'agility', damageBonus: 2 },
  },
  '01052': { // 偷袭 Sneak Attack
    event: { type: 'dealDamageExhausted', amount: 2 },
  },
  '01053': { // 机会主义者 Opportunist（技能）
    skill: { returnOnSuccessBy: 3, selfTestOnly: true },
  },
  '01054': { // 里奥·德·卢卡 Leo De Luca（XP1）
    passive: { extraAction: 1 },
  },
  '01055': { // 飞贼 Cat Burglar（XP1）
    noOpportunityAttack: true,
    passive: { stats: { agility: 1 } },
    abilities: [
      { label: '脱身（与全部敌人脱离交战并移到一个连接地点）', cost: { action: true, exhaust: true }, effect: { type: 'sequence', effects: [{ type: 'disengageAll' }, { type: 'moveTo' }] } },
    ],
  },
  '01056': { // 老千手法 Sleight of Hand（XP3）
    fast: true,
    reaction: { when: 'negativeTokenRevealed', selfOnly: true },
    event: { type: 'flipTokenSign' },
  },
  '01057': { // 百战百胜 Sure Gamble（XP4）
    event: { type: 'gainResource', amount: 10 },
  },

  // =========================================================================
  // 秘术师 Mystic（0 级 + XP）
  // =========================================================================
  '01058': { // 禁忌知识 Forbidden Knowledge
    uses: 4, usesType: 'secret', discardWhenEmpty: true,
    abilities: [
      { label: '禁忌知识（横置、受 1 恐惧、花 1 秘密：获得 1 资源）', cost: { action: false, exhaust: true, uses: 1, horror: 1 }, effect: { type: 'gainResource', amount: 1 } },
    ],
  },
  '01059': { // 圣玫瑰珠 Holy Rosary
    passive: { stats: { willpower: 1 } },
  },
  '01060': { // 皱缩术 Shrivelling
    uses: 4, usesType: 'charges',
    abilities: [
      { label: '法术攻击（意志检定，伤害 +1；揭示负面符号受 1 恐惧）', cost: { action: true, uses: 1 }, effect: { type: 'fight', skill: 'willpower', damageBonus: 1, onChaosSymbolHorror: 1 } },
    ],
  },
  '01061': { // 探知术 Scrying
    uses: 3, usesType: 'charges',
    abilities: [
      { label: '窥视（查看任意牌库顶 3 张并重排）', cost: { action: true, exhaust: true, uses: 1 }, effect: { type: 'scry' } },
    ],
  },
  '01062': { // 神秘研究 Arcane Studies（天赋）
    freeTriggers: [
      { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
      { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
    ],
  },
  '01063': { // 新晋术士 Arcane Initiate
    onPlayDoom: 1,
    abilities: [
      { label: '召唤（检索牌库顶 3 张中的法术牌）', cost: { action: false, exhaust: true }, effect: { type: 'searchTop', amount: 3, trait: 'Spell', choose: 1 } },
    ],
  },
  '01064': { // 飞蛾扑火 Drawn to the Flame
    event: { type: 'sequence', effects: [
      { type: 'drawEncounter' },
      { type: 'discoverClue', amount: 2 },
    ] },
  },
  '01065': { // 守护结界 Ward of Protection
    fast: true,
    reaction: { when: 'treachery', selfOnly: true, nonWeaknessOnly: true },
    event: { type: 'sequence', effects: [{ type: 'cancelTreachery' }, { type: 'takeHorror', amount: 1 }] },
  },
  '01066': { // 眩光一闪 Blinding Light
    event: { type: 'evade', skill: 'willpower', damageOnSuccess: 1, symbolActionLoss: true },
  },
  '01067': { // 无所畏惧 Fearless（技能）
    skill: { onSuccess: { healHorror: 1 } },
  },
  '01068': { // 记忆抹消 Memory Wipe（XP1）
    fast: true,
    reaction: { when: 'phaseBegins' },
    event: { type: 'blankEnemy' },
  },
  '01069': { // 眩光一闪 Blinding Light（XP2）
    event: { type: 'evade', skill: 'willpower', damageOnSuccess: 2, symbolActionLoss: true, onChaosSymbolHorror: 1 },
  },
  '01070': { // 影之书 Book of Shadows（XP3）
    passive: { extraSlots: { arcane: 1 } },
    abilities: [
      { label: '灌注（横置，为一个法术支援 +1 充能）', cost: { action: true, exhaust: true }, effect: { type: 'rechargeAsset', amount: 1, trait: 'Spell' } },
    ],
  },
  '01071': { // 诡秘石像 Grotesque Statue（XP4）
    uses: 4, usesType: 'charges', discardWhenEmpty: true,
  },

  // =========================================================================
  // 幸存者 Survivor（0 级 + XP）
  // =========================================================================
  '01072': { // 皮大衣 Leather Coat（无规则文本，印刷生命 2 作为承伤容量）
    engine: 'printedSoak',
  },
  '01073': { // 拾荒 Scavenging
    reactions: [
      { id: 'scavenging', when: 'investigateSuccess', successByAtLeast: 2, cost: { exhaust: true }, effect: { type: 'searchDiscard', trait: 'Item', choose: 1 } },
    ],
  },
  '01074': { // 球棒 Baseball Bat（Hand x2）
    abilities: [
      { label: '挥击（战斗 +2，伤害 +1；骷髅或自动失败时弃置）', cost: { action: true }, effect: { type: 'fight', combatBonus: 2, damageBonus: 1, discardOnTokens: ['skull', 'autofail'] } },
    ],
  },
  '01075': { // 幸运兔脚 Rabbit's Foot
    reactions: [
      { id: 'rabbitsFoot', when: 'skillTestFail', cost: { exhaust: true }, effect: { type: 'draw', amount: 1 } },
    ],
  },
  '01076': { // 野猫 Stray Cat
    abilities: [
      { label: '引开（弃掉野猫，自动躲避同地点非精英敌人）', cost: { action: false, discardSelf: true }, effect: { type: 'autoEvadeNonElite' } },
    ],
  },
  '01077': { // 深挖 Dig Deep（天赋）
    freeTriggers: [
      { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
      { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
    ],
  },
  '01078': { // 调虎离山 Cunning Distraction
    event: { type: 'evade', auto: true, allAtLocation: true },
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
  '01081': { // 求生本能 Survival Instinct（技能）
    skill: { onSuccess: { evadeDisengage: true, mayMoveAfterEvade: true } },
  },
  '01082': { // 安奎娜 Aquinnah（XP1）
    reactions: [
      { id: 'aquinnah', when: 'enemyAttack', cost: { exhaust: true, assetHorror: 1 }, effect: { type: 'aquinnahRedirect' } },
    ],
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
  '01085': { // 生存意志 Will to Survive（XP3）
    fast: true,
    event: { type: 'ignoreChaos' },
  },

  // =========================================================================
  // 专属签名卡（5 张）
  // =========================================================================
  '01006': { // 罗兰 的.38特制手枪（4 子弹）
    uses: 4, usesType: 'ammo',
    abilities: [
      { label: '射击（战斗 +1；所在地点有线索时改为 +3，伤害 +1）', cost: { action: true, uses: 1 }, effect: { type: 'fight', combatBonus: 1, ifCluesAtLocationCombatBonus: 2, damageBonus: 1 } },
    ],
  },
  '01008': { // 黛西的手提包（额外 2 手部槽位，仅书籍）
    passive: { handSlotsBonus: 2, handSlotsTrait: 'Tome' },
  },
  '01010': { // 在逃中 On the Lam
    fast: true,
    reaction: { when: 'turnBegins', selfOnly: true },
    event: { type: 'onTheLam' },
  },
  '01012': { // 希波利尔传家宝 Heirloom of Hyperborea
    reactions: [
      { id: 'heirloom', when: 'spellPlayed', effect: { type: 'draw', amount: 1 } },
    ],
  },
  '01014': { // 温蒂的护身符 Wendy's Amulet
    // 两条能力都在 engine.js 里按卡号实现：弃牌堆顶事件可当手牌打出（engine.js:2021-2027、
    // 8160、8653-8655），打出的事件改为放到牌库底（engine.js disposePlayedEvent）。
    engine: 'wendyAmulet',
  },

  // =========================================================================
  // 专属弱点（5 张，揭示时结算）
  // =========================================================================
  '01007': { // 掩盖罪证 Cover Up（威胁区域，3 线索拦截）
    weakness: { type: 'threat', clues: 3, redirectClues: true },
  },
  '01009': { // 死灵之书 The Necronomicon（威胁区域，3 恐惧，elder_sign→自动失败）
    weakness: { type: 'threat', horror: 3, eldersignToAutofail: true, purgeAbility: true },
  },
  '01011': { // 医院债务 Hospital Debts（威胁区域，债务）
    weakness: { type: 'threat', debt: true, resources: 0, xpPenalty: 2 },
  },
  '01013': { // 黑暗回忆 Dark Memory（放置毁灭 + 恐惧）
    playableWeakness: true, endTurnInHandHorror: 2,
    event: { type: 'addDoom', amount: 1 },
  },
  '01015': { // 被抛弃的孤单 Abandoned and Alone（2 直接恐惧 + 移除弃牌堆）
    weakness: { effects: [{ type: 'takeHorror', amount: 2, direct: true }, { type: 'removeDiscard' }] },
  },

  // =========================================================================
  // 核心包基础弱点（非敌人 5 张；敌人弱点 01101~01103 由 engine 按敌人卡直接生成）
  // =========================================================================
  '01096': { weakness: { type: 'discardHandTo', keep: 1 } }, // 失忆 Amnesia
  '01097': { weakness: { type: 'loseResource', all: true } }, // 妄想症 Paranoia
  '01098': { weakness: { type: 'threat', mods: { allSkills: -1 }, discardCost: { action: 2 } } }, // 恶灵附身 Haunted
  '01099': { weakness: { type: 'threat', forced: { onHorror: { damage: 1 } }, discardCost: { action: 2 } } }, // 神经紊乱 Psychosis
  '01100': { weakness: { type: 'threat', forced: { onDamage: { horror: 1 } }, discardCost: { action: 2 } } }, // 忧郁症 Hypochondria

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

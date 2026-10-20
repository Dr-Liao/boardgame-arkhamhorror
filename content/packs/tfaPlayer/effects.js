const tfa = (action, extra = {}) => ({ type: 'tfaPlayer', action, ...extra })
const fight = (combatBonus = 0, damageBonus = 0, extra = {}) =>
  ({ type: 'fight', combatBonus, damageBonus, ...extra })
const action = (label, effect, cost = {}) => ({ label, cost: { action: true, ...cost }, effect })

// 失落的时代玩家卡（M2）运行期契约。复杂分支统一走 tfaPlayer 调度器，
// 以便选择、随机与伤害都经过引擎的事务/存档路径。
//
// 只有逐卡验收通过的卡才登记在这里；manifest 的 IMPLEMENTED_PLAYER_CODES 与
// 本表一一对应，未实现的卡保持 catalog-only 且不可构筑。
export const effects = {
  // ---- 支援 ----
  '04018': {
    uses: 3, usesType: 'supplies', discardWhenEmpty: true,
    abilities: [{ label: '放置 1 补给或子弹', cost: { action: false, exhaust: true, uses: 1 },
      effect: tfa('adventurer') }],
  },
  '04019': { fast: true, attachTo: { kind: 'asset', trait: 'ally' }, passive: { hostHealth: 1, hostSanity: 1 } },
  '04020': { fast: true, attachTo: { kind: 'asset', trait: 'item' }, passive: { hostAbilitySkillBonus: 1 } },
  '04021': { onEnter: tfa('horowitzSearch') },
  '04025': { passive: { stats: { intellect: 1 } }, forcedUpkeepPayOrDiscard: 1 },
  '04026': {
    uses: 0, usesType: 'charges',
    reactions: [{ id: 'ornateSkull', when: 'defeatEnemy', limit: 'phase', effect: tfa('ornateSkullCharge') }],
    abilities: [action('花费 1 充能：抽 1 张牌并获得 1 资源',
      { type: 'sequence', effects: [{ type: 'draw', amount: 1 }, { type: 'gainResource', amount: 1 }] },
      { uses: 1 })],
  },
  '04037': { onEnter: tfa('backpackSearch'), backpack: { search: 6, keep: 3, traits: ['Item', 'Supply'] } },
  '04107': {
    reactions: [{ id: 'luckyCase', when: 'investigateSuccess', successByAtLeast: 2, limit: 'round',
      cost: { exhaust: true }, effect: { type: 'draw', amount: 1 } }],
  },
  '04193': { fast: true, attachTo: { kind: 'asset', trait: 'firearm', maxPerTarget: 1 },
    onAttach: { ammo: 2 }, passive: { hostMonsterDamage: 1 } },
  '04194': { abilities: [action('异界罗盘调查', tfa('otherworldCompass'), { exhaust: true })] },
  '04196': {
    passive: { stats: { intellect: 1, agility: 1 } },
    abilities: [{ label: '花费隐藏值等量资源：发现 1 个线索', cost: { action: false, exhaust: true },
      effect: tfa('lolaSantiago') }],
  },
  '04203': { passive: { evadeBonus: 1 } },
  '04029': { uses: 4, usesType: 'charges', abilities: [action('意志闪避', tfa('lureEvade', { kind: 'evade' }), { uses: 1 })] },
  '04156': { abilities: [{ label: '花 3 资源：本次检定 +2', cost: { action: false, exhaust: true, resources: 3 },
    effect: tfa('extravagance') }] },
  '04204': {
    uses: 1, usesType: 'ammo',
    abilities: [
      action('射箭（敏捷 +2，伤害 +2）', fight(2, 2, { skill: 'agility' }), { uses: 1 }),
      action('重新搭箭', tfa('reloadBow')),
    ],
  },
  '04229': { uses: 8, usesType: 'ammo', abilities: [action('花费 1–5 子弹射击', tfa('browning', { kind: 'fight' }))] },
  '04235': { sealOnEnter: 'eldersign', passive: { stats: { willpower: 1, intellect: 1, combat: 1, agility: 1 } } },
  '04265': { abilities: [{ label: '躲向并铐住人形敌人', cost: { action: true }, effect: tfa('handcuffs', { kind: 'evade' }) }] },
  '04267': { uses: 3, usesType: 'secrets', discardWhenEmpty: true,
    abilities: [action('养神', tfa('restorative'), { exhaust: true, uses: 1 })] },
  '04268': {
    uses: 5, usesType: 'ammo', discardAtRoundEnd: true,
    abilities: [action('花费 1 子弹：攻击（战斗 +1，伤害 +1）', fight(1, 1), { uses: 1 })],
  },
  '04270': { exceptional: true, fast: true, abilities: [{ label: '附属/解除到所在地点', cost: { action: true },
    effect: tfa('skeletonKey') }] },
  '04271': { uses: 5, usesType: 'charges', abilities: [action('意志闪避', tfa('lureEvade', { kind: 'evade' }), { uses: 1 })] },
  '04273': {
    uses: 3, usesType: 'ammo',
    abilities: [action('花费 1 子弹：攻击（战斗 +3，伤害 +2）', tfa('oldShotgun', { kind: 'fight' }), { uses: 1 })],
  },
  '04274': { uses: 3, usesType: 'supplies', discardWhenEmpty: true, abilities: [
    action('治疗 1 点伤害', tfa('thermosDamage'), { exhaust: true, uses: 1 }),
    action('治疗 1 点恐惧', tfa('thermosHorror'), { exhaust: true, uses: 1 }),
  ] },
  '04275': {
    passive: { statsByConnections: { count: 2, stats: { willpower: 1, intellect: 1 } },
      extraConnections: { count: 4, stats: { willpower: 1, intellect: 1 } } },
  },
  '04276': { abilities: [
    action('挥砍（战斗 +2，伤害 +1）', fight(2, 1)),
    action('蓄力斩（加入意志，伤害 +3）', tfa('rustedSword', { kind: 'fight' }), { exhaust: true }),
  ] },
  '04304': { uses: 3, usesType: 'supplies', discardWhenEmpty: true,
    abilities: [action('安抚恐惧', tfa('kerosene'), { exhaust: true, uses: 1 })] },
  '04305': { uses: 4, usesType: 'ammo', abilities: [action('喷射火焰', tfa('flamethrower', { kind: 'fight' }), { uses: 1 })] },
  '04306': { fast: true, event: tfa('vantagePoint') },
  // ---- 事件 ----
  '04024': { event: tfa('unearthTheAncients') },
  '04027': { event: tfa('eavesdrop') },
  '04103': { firstActionOnly: true, noOpportunityAttack: true, event: tfa('crimeScene') },
  '04105': { event: tfa('persuasion') },
  '04111': { fast: true, reaction: { when: 'harmDealt', selfOnly: true },
    event: { type: 'cancelHarm', maximum: 4 } },
  '04149': { firstActionOnly: true, event: tfa('recoverStamina') },
  '04152': { requiresClue: true, event: tfa('discernTruth') },
  '04195': { fast: true, event: { type: 'exposeWeakness' } },
  '04232': { event: tfa('slipAway') },
  '04233': { noOpportunityAttack: true, event: tfa('payday') },
  '04234': { event: tfa('sacrificeToTheTribute') },
  '04266': { event: tfa('bloodletting') },
  '04313': { fast: true, event: tfa('alterFate') },
  '04269': { noOpportunityAttack: true, event: tfa('lastShot') },
  // ---- 技能 ----
  '04112': { skill: { onSuccess: { autoEvadeAttackedEnemy: true } } },
  '04155': { skill: { onEvadeSuccess: { damageBonusNext: 1 } } },
  '04157': { skill: { onSuccess: { placeChargeOrSecret: true } } },
  '04198': { skill: { ignoreSymbolEffects: true } },
  '04201': { skill: { maxPerTest: 1, anySkill: true, onFail: { draw: 2, resources: 2 } } },
  '04309': { skill: { maxPerTest: 1, onSuccess: { drawPerSuccessBy: 1, maxDraw: 5, shuffleWeaknessesDrawn: true } } },
  // ---- 封印 ----
  '04030': { sealOnEnterChoice: 'symbol', returnToHandOnAutoFail: true },
  '04031': { sealOnEnterChoice: 'nonAutofail', forcedTurnEndPayOrDiscard: 1, teamLimit: 2 },
  '04311': { sealOnEnter: 'autofail', uses: 7, usesType: 'charges',
    chargesOnSymbolReveal: 1, removeFromGameWhenEmpty: true },
  // ---- 剧本模式弱点链 ----
  // 离体体验（04264）：把所有手牌洗回牌库、重抽等量，然后把本卡洗回牌库。
  '04264': { weakness: { type: 'outOfBody' } },
  '04038': { playableWeakness: true, weakness: { type: 'darkPact' },
    event: { type: 'targetedEffect', target: 'location', effect: { type: 'takeDamage', amount: 2 } } },
  '04039': { weakness: { type: 'priceOfFailure' } },
  '04040': { weakness: { type: 'impendingDoom' } },
  '04041': { weakness: { type: 'cursedFate' } },
  '04042': { weakness: { type: 'deathKnell' } },

  // ---- 剧本资产 ----
  // 古代遗物（04191 阻断未来）：[free] 横置，检定意志或智识(4)。成功移除当前密谋上的
  // 1 个毁灭，失败在遗物上放 1 个毁灭；每场游戏最多成功一次。不是可构筑卡。
  '04191': {
    abilities: [{ label: '横置：检定意志或智识(4)，成功移除密谋 1 毁灭',
      cost: { action: false, exhaust: true }, effect: tfa('relicDoom') }],
  },

  // 伊塔卡（04147）：+1 战斗 / +1 敏捷；把敌人加入胜利区后可横置治愈自己与伊塔卡各 1 点恐惧。
  '04147': { passive: { stats: { combat: 1, agility: 1 } }, exhaustOnEnemyDefeatedHealHorror: 1 },

  // 探险日志（04148）：你回合期间额外一次行动，只能用于探索（引擎单独记账，
  // 普通行动不能花掉它）。同样不是可构筑卡。
  '04148': { passive: { extraActionExploreOnly: 1 } },

  // ---- 第三批：支援 ----
  // 求生匕首：攻击 +1；敌人攻击造成伤害后横置反击 +2/+1。
  '04017': {
    abilities: [action('攻击（战斗 +1）', fight(1, 0))],
    reactions: [{ id: 'survivalKnife', when: 'enemyAttackDamage', selfOnly: true, cost: { exhaust: true },
      effect: tfa('survivalKnife') }],
  },
  // 古代巨石（未鉴定）：调查帷幕 +3，成功额外 1 线索并记录难度。
  '04022': { abilities: [action('调查（本地帷幕 +3）', tfa('ancientStone'))] },
  // 埃兹特里之牙：结算诡计能力期间 +1 意志/+1 敏捷；成功后可横置抽牌。
  '04023': {
    passive: { treacheryTestStats: { willpower: 1, agility: 1 } },
    reactions: [{ id: 'toothOfEztli', when: 'treacheryTestSuccess', selfOnly: true, cost: { exhaust: true },
      effect: { type: 'draw', amount: 1 } }],
  },
  // 雅沃托：横置按弃牌堆顶图标加值；每阶段一次弃牌库顶。
  '04035': {
    abilities: [
      { label: '横置：按弃牌堆顶卡牌的匹配图标加值', cost: { action: false, exhaust: true },
        effect: tfa('yaotlIcons'), duringOwnSkillTest: true },
      { label: '弃掉牌库顶（每阶段一次）', cost: { action: false }, oncePerPhase: true, effect: tfa('yaotlDiscardTop') },
    ],
  },
  // 老练分析（永久）：升级带「未鉴定／未翻译」副标题的卡牌时额外免费升级第二张。
  '04106': { permanentRule: 'shrewdAnalysis', deckbuildingOnly: true },
  // 销赃贩子：在自回合打出违法卡时使其获得快速，已有快速则减 1 费用。
  '04108': { fastForIllicit: true },
  // 奥术研究（永久）：购买时承受 1 点精神创伤，每场冒险后第一张法术升级减 1 经验。
  '04109': { permanentRule: 'arcaneResearch', deckbuildingOnly: true },
  // 准备万全：横置选择一张支援，按匹配图标提升本次检定。
  '04151': { abilities: [{ label: '横置：本次检定按所选支援的匹配图标加值', cost: { action: false, exhaust: true },
    effect: tfa('wellPrepared'), duringOwnSkillTest: true }] },
  // 一目十行：把 1 个线索放回地点并横置，本次检定 +3。
  '04154': { abilities: [{ label: '横置并放回 1 个线索：本次检定 +3',
    cost: { action: false, exhaust: true, clues: 1 }, effect: tfa('bookwormBoost'), duringOwnSkillTest: true }] },
  // 追忆未来：检定开始时指定一个混乱标记，命中则横置并 +2。
  '04158': { reactions: [{ id: 'recallTheFuture', when: 'testBegins', selfOnly: true, effect: tfa('recallTheFuture') }] },
  // 反复尝试：检定失败后横置并花费 1 次数，收回投入的技能牌。
  '04159': { uses: 3, usesType: 'tries', discardWhenEmpty: true,
    reactions: [{ id: 'tryAndTryAgain', when: 'skillTestFail', selfOnly: true, cost: { exhaust: true, uses: 1 },
      effect: tfa('tryAndTryAgain') }] },
  // 围困：弃 1 张手牌，本次检定 +2（每检定一次）。
  '04160': { abilities: [{ label: '弃 1 张手牌：本次检定 +2', cost: { action: false, exhaust: true, discardHand: 1 },
    effect: tfa('cornered'), duringOwnSkillTest: true, oncePerTest: true }] },
  // 奥利芙·麦克布莱德：横置后揭示 3 个混乱标记并选 2 个结算。
  '04197': { reactions: [{ id: 'oliveMcBride', when: 'tokenReveal', selfOnly: true, cost: { exhaust: true },
    effect: tfa('oliveMcBride') }] },
  // 古代巨石（研究完成）：秘密数来自剧本日志；抽牌后花费等量秘密造成伤害／治愈恐惧。
  '04230': { usesFromStoneRecord: true, usesType: 'secrets' },
  '04231': { usesFromStoneRecord: true, usesType: 'secrets' },
  // 自食其力：幸存者事件减 2 费用；出现盟友支援时弃掉；每位调查员限 1 张。
  '04236': { survivorEventDiscount: true, limitPerInvestigator: true },
  // 纳克特手稿：显现检定或本回合下一场检定不揭示混乱标记。
  '04307': {
    uses: 3, usesType: 'secrets',
    reactions: [{ id: 'pnakoticRevelation', when: 'revelationTest', cost: { uses: 1 },
      effect: tfa('pnakoticSkipTest') }],
    abilities: [action('花费 1 秘密：本回合该调查员下次检定不揭示标记', tfa('pnakoticNextTest'),
      { uses: 1, action: false })],
  },
  // 时间借取：放置滴答，回合开始时换成额外行动。
  '04308': { exceptional: true, abilities: [{ label: '放置 1 声滴答（最多 3）',
    cost: { action: true }, maxClicks: 3, effect: tfa('borrowedTimeClick', { noOpportunityAttack: true }) }] },
  // 虚空碎裂：封印「0」；花充能或释放标记发动意志攻击。
  '04310': { uses: 3, usesType: 'charges', sealOnEnter: '0',
    abilities: [action('花费 1 充能或释放标记：意志攻击（+1 伤害）', tfa('shardsOfTheVoid', { kind: 'fight' }))] },

  // ---- 第三批：事件 ----
  // “交给你了！”：把刚抽到的非险境遭遇卡转给另一位调查员，并获得 1 资源。
  '04028': { fast: true, reaction: { when: 'encounterDrawn', nonPerilOnly: true, selfOnly: true },
    event: tfa('youHandleThisOne') },
  // 黑暗预言：改为揭示 5 个混乱标记，选 1 个带符号的结算。
  '04032': { fast: true, reaction: { when: 'tokenReveal', anyLocation: true }, event: tfa('darkProphecy') },
  // 临时武器：可从弃牌堆打出并洗回；攻击把敌人攻击值 -1，来自弃牌堆时 +1 伤害。
  '04033': { playableFromDiscard: true, shuffleBackAfterPlay: true, event: tfa('improvisedWeapon') },
  // 狗屎运：躲避失败 2 点以内时把非精英敌人放到遭遇牌库顶。
  '04034': { fast: true, reaction: { when: 'evadeFail', nonElite: true, failedByAtMost: 2, selfOnly: true }, event: tfa('dumbLuck') },
  // 枪法如神：用枪械／远程支援攻击连接地点上的敌人，忽略冷漠与反击。
  '04104': { fast: true, event: tfa('marksmanship') },
  // 反击法术：取消当前符号标记，不揭示替代标记。
  '04110': { fast: true, reaction: { when: 'symbolRevealed', symbols: ['skull', 'cultist', 'tablet', 'elderthing'] },
    event: { type: 'cancelSymbolToken' } },
  // 危险预感：放入场上并封印一个随机标记，下次揭示改结算它。
  '04199': { fast: true, becomesAsset: true, event: tfa('premonition') },
  // 学无止境：重新尝试上一次失败的检定，+2。
  '04200': { fast: true, reaction: { when: 'skillTestFailed', selfOnly: true }, event: tfa('liveAndLearn') },
  // 勇斗异劫：难度高于基础值时额外揭示 X 个混乱标记并选 1 个。
  '04202': { fast: true, reaction: { when: 'testBegins', requiresDifficultyAboveBase: true, selfOnly: true },
    event: tfa('againstAllOdds') },
  // 将就一下：可从弃牌堆打出；调查帷幕 -1，来自弃牌堆时成功额外 1 线索。
  '04272': { playableFromDiscard: true, shuffleBackAfterPlay: true, event: tfa('makeDo') },
  // 临时路障：可从弃牌堆打出；躲避值 -1，来自弃牌堆时可多躲一个敌人。
  '04312': { playableFromDiscard: true, shuffleBackAfterPlay: true, event: tfa('impromptuBarrier') },

  // ---- 第三批：技能 ----
  // 殊死一搏：只能单独投入，手牌越多万能图标越少。
  '04036': { skill: { noOtherCommits: true, wildLosesPerHandCard: true } },
  // 占据先机：只能投入自己的检定，本阶段每个已完成行动减少 1 个万能图标。
  '04150': { skill: { selfTestOnly: true, wildLosesPerActionsThisPhase: true } },
  // 参透真谛：只能投入冒险卡印刷能力的检定，成功后发现 1 个线索。
  '04153': { skill: { scenarioAbilityOnly: true, onSuccess: { clueBonus: 1 } } },
  // 英勇无畏：检定成功后作为支援入场，轮末弃掉。
  '04192': { skill: { onSuccess: { becomeAsset: { stats: { intellect: 1, combat: 1, agility: 1 } } } } },
}

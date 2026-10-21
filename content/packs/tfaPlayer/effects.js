const tfa = (action, extra = {}) => ({ type: 'tfaPlayer', action, ...extra })
const fight = (combatBonus = 0, damageBonus = 0, extra = {}) =>
  ({ type: 'fight', combatBonus, damageBonus, ...extra })
const action = (label, effect, cost = {}) => ({ label, cost: { action: true, ...cost }, effect })

// 失落的时代玩家卡（M2）运行期契约。复杂分支统一走 tfaPlayer 调度器，
// 以便选择、随机与伤害都经过引擎的事务/存档路径。
//
// 只有逐卡验收通过的卡才登记在这里；manifest 的 IMPLEMENTED_PLAYER_CODES 与
// 本表一一对应，未实现的卡保持 catalog-only 且不可构筑。
//
// Phase 2 已迁出 12 张卡（04018 / 04026 / 04035 / 04103 / 04152 / 04154 / 04160 /
// 04204 / 04233 / 04269 / 04274 / 04306）：它们现在写在 src/cards/card-abilities.js
// 的描述子里，本表条目与 engine.js 的 tfaPlayerEffectCore 分支同时删除。
export const effects = {
  // ---- 支援 ----
  // 04021 已迁到能力层（kind: 'entersPlay'，见 src/cards/card-abilities.js）。
  // 04037 背包已迁到能力层（5c-34），见 MIGRATED_ESCAPE_ENTRIES_5C34。
  '04268': {
    uses: 5, usesType: 'ammo', discardAtRoundEnd: true,
    abilities: [action('花费 1 子弹：攻击（战斗 +1，伤害 +1）', fight(1, 1), { uses: 1 })],
  },
  // 04270 骷髅钥匙已迁到能力层（5c-30），见 MIGRATED_ESCAPE_ENTRIES_5C30。
  // ---- 事件 ----
  // 04111 坚韧不拔已迁到能力层（6e-8：快速反应事件 → kind: 'played' + fast + trigger）。
  // ---- 技能 ----
  // ---- 封印 ----
  '04030': { sealOnEnterChoice: 'symbol', returnToHandOnAutoFail: true },
  '04031': { sealOnEnterChoice: 'nonAutofail', forcedTurnEndPayOrDiscard: 1, teamLimit: 2 },
  '04311': { sealOnEnter: 'autofail', uses: 7, usesType: 'charges',
    chargesOnSymbolReveal: 1, removeFromGameWhenEmpty: true },
  // ---- 剧本模式弱点链 ----
  // 离体体验（04264）：把所有手牌洗回牌库、重抽等量，然后把本卡洗回牌库。
  '04038': { playableWeakness: true, weakness: { type: 'darkPact' },
    event: { type: 'targetedEffect', target: 'location', effect: { type: 'takeDamage', amount: 2 } } },

  // ---- 剧本资产 ----
  // 04191 古代遗物已迁到能力层（5c-25），见 MIGRATED_ESCAPE_ENTRIES_5C25。

  // 伊塔卡（04147）：+1 战斗 / +1 敏捷；把敌人加入胜利区后可横置治愈自己与伊塔卡各 1 点恐惧。

  // 探险日志（04148）：你回合期间额外一次行动，只能用于探索（引擎单独记账，
  // 普通行动不能花掉它）。同样不是可构筑卡。

  // ---- 第三批：支援 ----
  // 求生匕首：攻击 +1；敌人攻击造成伤害后横置反击 +2/+1。
  // 古代巨石（未鉴定）：调查帷幕 +3，成功额外 1 线索并记录难度。
  // 埃兹特里之牙：结算诡计能力期间 +1 意志/+1 敏捷；成功后可横置抽牌。
  // 老练分析（永久）：升级带「未鉴定／未翻译」副标题的卡牌时额外免费升级第二张。
  '04106': { permanentRule: 'shrewdAnalysis', deckbuildingOnly: true },
  // 销赃贩子：在自回合打出违法卡时使其获得快速，已有快速则减 1 费用。
  '04108': { fastForIllicit: true },
  // 奥术研究（永久）：购买时承受 1 点精神创伤，每场冒险后第一张法术升级减 1 经验。
  '04109': { permanentRule: 'arcaneResearch', deckbuildingOnly: true },
  // 准备万全：横置选择一张支援，按匹配图标提升本次检定。
  // 追忆未来：检定开始时指定一个混乱标记，命中则横置并 +2。
  // 反复尝试：检定失败后横置并花费 1 次数，收回投入的技能牌。
  // 奥利芙·麦克布莱德：横置后揭示 3 个混乱标记并选 2 个结算。
  // 古代巨石（研究完成）：秘密数来自剧本日志；抽牌后花费等量秘密造成伤害／治愈恐惧。
  '04230': { usesFromStoneRecord: true, usesType: 'secrets' },
  '04231': { usesFromStoneRecord: true, usesType: 'secrets' },
  // 自食其力：幸存者事件减 2 费用；出现盟友支援时弃掉；每位调查员限 1 张。
  '04236': { survivorEventDiscount: true, limitPerInvestigator: true },
  // 纳克特手稿：显现检定或本回合下一场检定不揭示混乱标记。
  // 04308 时间借取 / 04310 虚空碎裂已迁到能力层（5c-37），见 MIGRATED_ESCAPE_ENTRIES_5C37。

  // ---- 第三批：事件 ----
  // “交给你了！”：把刚抽到的非险境遭遇卡转给另一位调查员，并获得 1 资源。
  // 黑暗预言：改为揭示 5 个混乱标记，选 1 个带符号的结算。
  // 临时武器：可从弃牌堆打出并洗回；攻击把敌人攻击值 -1，来自弃牌堆时 +1 伤害。
  // 狗屎运：躲避失败 2 点以内时把非精英敌人放到遭遇牌库顶。
  // 枪法如神：用枪械／远程支援攻击连接地点上的敌人，忽略冷漠与反击。
  // 反击法术已迁到能力层（6e-8：快速反应事件 → kind: 'played' + fast + trigger）。
  // 04199 危险预感已迁到能力层（5c-24），见 MIGRATED_ESCAPE_ENTRIES_5C24。
  // 学无止境：重新尝试上一次失败的检定，+2。
  // 勇斗异劫：难度高于基础值时额外揭示 X 个混乱标记并选 1 个。
  // 将就一下：可从弃牌堆打出；调查帷幕 -1，来自弃牌堆时成功额外 1 线索。
  // 临时路障：可从弃牌堆打出；躲避值 -1，来自弃牌堆时可多躲一个敌人。

  // ---- 第三批：技能 ----
  // 殊死一搏：只能单独投入，手牌越多万能图标越少。
  // 占据先机：只能投入自己的检定，本阶段每个已完成行动减少 1 个万能图标。
  // 参透真谛：只能投入冒险卡印刷能力的检定，成功后发现 1 个线索。
  // 英勇无畏：检定成功后作为支援入场，轮末弃掉。
}

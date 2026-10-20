// 诡镇奇谈：卡牌版 · Phase 5 批量迁移批次（由 tools/migrate-card.mjs 维护）
//
// 这个文件是**迁移目标**：`tools/migrate-card.mjs --write` 把旧 DSL（EFFECTS）里
// 可以机械搬家的条目改写成能力层描述子，追加到下面按批次分组的常量里，同时删掉
// 旧条目本身。手写新卡**不要**加到这里——新卡直接写 src/cards/card-abilities.js。
//
// 文件结构：每个批次是一个标记块，工具的读写都靠这两行标记
//     // >>> batch: <批次名>
//     // <<< batch: <批次名>
// 块里只有 `export const BATCH_<批次名> = [...]`（批次名会转成大写常量名），
// 文件末尾的 MIGRATED_CARD_ENTRIES 由工具按块清单重新生成，不要手改。
//
// 迁移纪律（见 docs/phase5-migration.md）：
//   · **搬槽位，不改写法**：`event → played`、`skill → commit`、`weakness → weakness`、
//     `onEnter → entersPlay`、`passive.stats → modifiers`、`abilities → action 描述子`；
//     数据对象原样保留，不顺手改写成 resolve 闭包（否则覆盖度、AI 解释、审计都会退化）。
//   · 每次只搬「读点已经存在」的槽位；读点还没到位或字段没有对应能力时，工具会把这张卡
//     判成不可机械迁移（residual 非空），留给后续批次，不静默近似。
//   · 行为必须零变化：每批用 `node tools/replay-fixtures.mjs --baseline/--compare` 逐条比指纹。

import { ownFirstAction, ownTurn, resignAvailable } from '../engine/matcher.js'
// >>> batch: 5b-1
export const BATCH_5B_1 = [
  {
    code: '01089',
    abilities: [
      { kind: 'commit', label: '胆识', skill: { onSuccess: { draw: 1 } } },
    ],
  },
  {
    code: '01090',
    abilities: [
      { kind: 'commit', label: '洞察力', skill: { onSuccess: { draw: 1 } } },
    ],
  },
  {
    code: '01091',
    abilities: [
      { kind: 'commit', label: '压制', skill: { onSuccess: { draw: 1 } } },
    ],
  },
  {
    code: '01092',
    abilities: [
      { kind: 'commit', label: '心灵手巧', skill: { onSuccess: { draw: 1 } } },
    ],
  },
  {
    code: '01025',
    abilities: [
      { kind: 'commit', label: '致命打击', skill: { onSuccess: { damageBonus: 1 } } },
    ],
  },
  {
    code: '01039',
    abilities: [
      { kind: 'commit', label: '推理', skill: { onSuccess: { clueBonus: 1 } } },
    ],
  },
  {
    code: '01053',
    abilities: [
      {
        kind: 'commit',
        label: '机会主义者',
        skill: { returnOnSuccessBy: 3, selfTestOnly: true },
      },
    ],
  },
  {
    code: '01067',
    abilities: [
      { kind: 'commit', label: '无所畏惧', skill: { onSuccess: { healHorror: 1 } } },
    ],
  },
  {
    code: '01081',
    abilities: [
      {
        kind: 'commit',
        label: '求生本能',
        skill: { onSuccess: { evadeDisengage: true, mayMoveAfterEvade: true } },
      },
    ],
  },
  {
    code: '01093',
    abilities: [
      { kind: 'commit', label: '绝处逢生', skill: {} },
    ],
  },
  {
    code: '02026',
    abilities: [
      {
        kind: 'commit',
        label: '赌一把',
        skill: { doubleDifficultyAndRewards: true, maxPerTest: 1 },
      },
    ],
  },
  {
    code: '02190',
    abilities: [
      { kind: 'commit', label: '逆反', skill: { defiance: true } },
    ],
  },
  {
    code: '02192',
    abilities: [
      {
        kind: 'commit',
        label: '随机应变',
        skill: { selfTestOnly: true, requireDifficultyAboveBase: 2 },
      },
    ],
  },
  {
    code: '02227',
    abilities: [
      { kind: 'commit', label: '追根究底', skill: { requireClueAtLocation: true } },
    ],
  },
  {
    code: '02229',
    abilities: [
      {
        kind: 'commit',
        label: '思维敏捷',
        skill: { successBy: { threshold: 2, gainAction: 1 } },
      },
    ],
  },
  {
    code: '02231',
    abilities: [
      {
        kind: 'commit',
        label: '机会主义者',
        skill: { selfTestOnly: true, returnOnSuccessBy: 2 },
      },
    ],
  },
  {
    code: '02235',
    abilities: [
      {
        kind: 'commit',
        label: '求生本能',
        skill: { onSuccess: { evadeDisengage: true, mayMoveAfterEvade: true } },
      },
    ],
  },
  {
    code: '02260',
    abilities: [
      { kind: 'commit', label: '领导力', skill: { leadership: true } },
    ],
  },
  {
    code: '03007',
    abilities: [
      { kind: 'commit', label: '保卫后方', skill: { homeFront: true } },
    ],
  },
  {
    code: '03039',
    abilities: [
      {
        kind: 'commit',
        label: '急中生智',
        skill: { onSuccess: { returnDiscardClass: 'survivor', excludeSelf: true } },
      },
    ],
  },
  {
    code: '03116',
    abilities: [
      {
        kind: 'commit',
        label: '临危祷告',
        skill: { maxPerTest: 1, remainingSanityAtMost: 3 },
      },
    ],
  },
  {
    code: '03117',
    abilities: [
      {
        kind: 'commit',
        label: '冥思苦想',
        skill: { maxPerTest: 1, remainingSanityAtMost: 3 },
      },
    ],
  },
  {
    code: '03118',
    abilities: [
      {
        kind: 'commit',
        label: '拼死出击',
        skill: { maxPerTest: 1, remainingSanityAtMost: 3 },
      },
    ],
  },
  {
    code: '03119',
    abilities: [
      {
        kind: 'commit',
        label: '绝命奔逃',
        skill: { maxPerTest: 1, remainingSanityAtMost: 3 },
      },
    ],
  },
  {
    code: '03228',
    abilities: [
      {
        kind: 'commit',
        label: '身先士卒',
        skill: { onSuccess: { readyAndHealAlly: true } },
      },
    ],
  },
  {
    code: '03231',
    abilities: [
      { kind: 'commit', label: '重大发现', skill: { onSuccess: { searchTop: 3 } } },
    ],
  },
  {
    code: '03233',
    abilities: [
      {
        kind: 'commit',
        label: '“吃我一招！”',
        skill: { selfTestOnly: true, wagerResources: 3 },
      },
    ],
  },
  {
    code: '03235',
    abilities: [
      { kind: 'commit', label: '力量洪流', skill: { spendChargesForIcons: 3 } },
    ],
  },
  {
    code: '03272',
    abilities: [
      {
        kind: 'commit',
        label: '“放马过来！”',
        skill: {
          requireEngagedEnemy: true,
          iconsPerEngagedEnemy: ['willpower', 'combat', 'agility'],
        },
      },
    ],
  },
  {
    code: '03312',
    abilities: [
      {
        kind: 'commit',
        label: '远古印记封印',
        skill: { elderSignInsteadOfChaos: true, exileAfterTest: true },
      },
    ],
  },
  {
    code: '04036',
    abilities: [
      {
        kind: 'commit',
        label: '殊死一搏',
        skill: { noOtherCommits: true, wildLosesPerHandCard: true },
      },
    ],
  },
  {
    code: '04112',
    abilities: [
      {
        kind: 'commit',
        label: '晕眩重击',
        skill: { onSuccess: { autoEvadeAttackedEnemy: true } },
      },
    ],
  },
  {
    code: '04150',
    abilities: [
      {
        kind: 'commit',
        label: '占据先机',
        skill: { selfTestOnly: true, wildLosesPerActionsThisPhase: true },
      },
    ],
  },
  {
    code: '04153',
    abilities: [
      {
        kind: 'commit',
        label: '参透真谛',
        skill: { scenarioAbilityOnly: true, onSuccess: { clueBonus: 1 } },
      },
    ],
  },
  {
    code: '04155',
    abilities: [
      {
        kind: 'commit',
        label: '职业杀手',
        skill: { onEvadeSuccess: { damageBonusNext: 1 } },
      },
    ],
  },
  {
    code: '04157',
    abilities: [
      {
        kind: 'commit',
        label: '如痴如醉',
        skill: { onSuccess: { placeChargeOrSecret: true } },
      },
    ],
  },
  {
    code: '04192',
    abilities: [
      {
        kind: 'commit',
        label: '英勇无畏',
        skill: {
          onSuccess: { becomeAsset: { stats: { intellect: 1, combat: 1, agility: 1 } } },
        },
      },
    ],
  },
  {
    code: '04198',
    abilities: [
      { kind: 'commit', label: '逆反', skill: { ignoreSymbolEffects: true } },
    ],
  },
  {
    code: '04201',
    abilities: [
      {
        kind: 'commit',
        label: '重拾信念',
        skill: { maxPerTest: 1, anySkill: true, onFail: { draw: 2, resources: 2 } },
      },
    ],
  },
  {
    code: '04309',
    abilities: [
      {
        kind: 'commit',
        label: '孤注一掷',
        skill: {
          maxPerTest: 1,
          onSuccess: { drawPerSuccessBy: 1, maxDraw: 5, shuffleWeaknessesDrawn: true },
        },
      },
    ],
  },
]
// <<< batch: 5b-1

// >>> batch: 5b-2
export const BATCH_5B_2 = [
  {
    code: '01007',
    abilities: [
      {
        kind: 'weakness',
        label: '掩盖罪证',
        weakness: { type: 'threat', clues: 3, redirectClues: true },
      },
    ],
  },
  {
    code: '01009',
    abilities: [
      {
        kind: 'weakness',
        label: '死灵之书',
        weakness: { type: 'threat', horror: 3, eldersignToAutofail: true, purgeAbility: true },
      },
    ],
  },
  {
    code: '01011',
    abilities: [
      {
        kind: 'weakness',
        label: '医院债务',
        weakness: { type: 'threat', debt: true, resources: 0, xpPenalty: 2 },
      },
    ],
  },
  {
    code: '01015',
    abilities: [
      {
        kind: 'weakness',
        label: '被抛弃的孤单',
        weakness: {
          effects: [{ type: 'takeHorror', amount: 2, direct: true }, { type: 'removeDiscard' }],
        },
      },
    ],
  },
  {
    code: '01098',
    abilities: [
      {
        kind: 'weakness',
        label: '恶灵附身',
        weakness: { type: 'threat', mods: { allSkills: -1 }, discardCost: { action: 2 } },
      },
    ],
  },
  {
    code: '01099',
    abilities: [
      {
        kind: 'weakness',
        label: '神经紊乱',
        weakness: {
          type: 'threat',
          forced: { onHorror: { damage: 1 } },
          discardCost: { action: 2 },
        },
      },
    ],
  },
  {
    code: '01100',
    abilities: [
      {
        kind: 'weakness',
        label: '忧郁症',
        weakness: {
          type: 'threat',
          forced: { onDamage: { horror: 1 } },
          discardCost: { action: 2 },
        },
      },
    ],
  },
  {
    code: '02007',
    abilities: [
      { kind: 'weakness', label: '击退邪恶', weakness: { type: 'attachedEnemy' } },
    ],
  },
  {
    code: '02009',
    abilities: [
      {
        kind: 'weakness',
        label: '雷克斯的诅咒',
        weakness: { type: 'threat', rexCurse: true },
      },
    ],
  },
  {
    code: '02011',
    abilities: [
      { kind: 'weakness', label: '寻找伊莎贝拉', weakness: { type: 'attachedLocation' } },
    ],
  },
  {
    code: '02013',
    abilities: [
      {
        kind: 'weakness', label: '最后的狂想曲', weakness: { type: 'finalRhapsody' },
        // Phase 5（5a-12）：结算迁到能力层——揭示最多 5 枚标记，骷髅/自动失败各 1 伤害 1 恐惧。
        resolve: ({ inv, api }) => {
          const tokens = api.revealChaosTokens(5)
          const harm = tokens.filter(token => token === 'skull' || token === 'autofail').length
          if (harm) api.harm(inv.seat, { damage: harm, horror: harm })
          api.info('最终狂想曲揭示 ' + tokens.map(token => api.tokenLabel(token)).join('、')
            + '；' + inv.name + ' 受到 ' + harm + ' 点伤害和 ' + harm + ' 点恐惧。')
        },
      },
    ],
  },
  {
    code: '02015',
    abilities: [
      {
        kind: 'weakness',
        label: '噩梦来袭',
        weakness: { type: 'threat', preventReady: true, discardCost: { action: 2 } },
      },
    ],
  },
  {
    code: '02038',
    abilities: [
      {
        kind: 'weakness',
        label: '内伤',
        weakness: {
          type: 'threat',
          forced: { onTurnEnd: { damage: 1 } },
          discardCost: { action: 2 },
        },
      },
    ],
  },
  {
    code: '02039',
    abilities: [
      {
        kind: 'weakness',
        label: '时间恐惧症',
        weakness: {
          type: 'threat',
          forced: { onTurnEnd: { horror: 1 } },
          discardCost: { action: 2 },
        },
      },
    ],
  },
  {
    code: '03008',
    abilities: [
      { kind: 'weakness', label: '炮弹休克', weakness: { type: 'shellShock' } },
    ],
  },
  {
    code: '03013',
    abilities: [
      { kind: 'weakness', label: '毕宿星团', weakness: { type: 'starsOfHyades' } },
    ],
  },
  {
    code: '03019',
    abilities: [
      { kind: 'weakness', label: '身份危机', weakness: { type: 'crisisOfIdentity' } },
    ],
  },
  {
    code: '03041',
    abilities: [
      {
        kind: 'weakness',
        label: '涂绘印记',
        weakness: { type: 'threat', handSizeModifier: -5, discardCost: { action: 2 } },
      },
    ],
  },
  {
    code: '04007',
    abilities: [
      { kind: 'weakness', label: '血的代价', weakness: { type: 'boughtInBlood' } },
    ],
  },
  {
    code: '04009',
    abilities: [
      {
        kind: 'weakness',
        label: '未知的呼唤',
        weakness: { type: 'threat', turnForced: 'callOfTheUnknown' },
      },
    ],
  },
  {
    code: '04012',
    abilities: [
      { kind: 'weakness', label: '当场抓获', weakness: { type: 'caughtRedHanded' } },
    ],
  },
  {
    code: '04016',
    abilities: [
      { kind: 'weakness', label: '信使之声', weakness: { type: 'voiceOfTheMessenger' } },
    ],
  },
  {
    code: '04039',
    abilities: [
      { kind: 'weakness', label: '失败的代价', weakness: { type: 'priceOfFailure' } },
    ],
  },
  {
    code: '04040',
    abilities: [
      { kind: 'weakness', label: '厄运降临', weakness: { type: 'impendingDoom' } },
    ],
  },
  {
    code: '04041',
    abilities: [
      { kind: 'weakness', label: '被诅咒的命运', weakness: { type: 'cursedFate' } },
    ],
  },
  {
    code: '04042',
    abilities: [
      { kind: 'weakness', label: '丧钟敲响', weakness: { type: 'deathKnell' } },
    ],
  },
  {
    code: '04264',
    abilities: [
      { kind: 'weakness', label: '离体体验', weakness: { type: 'outOfBody' } },
    ],
  },
]
// <<< batch: 5b-2

// >>> batch: 5b-3
export const BATCH_5B_3 = [
  {
    code: '01024',
    abilities: [
      {
        kind: 'played',
        label: '炸药爆破',
        effect: {
          type: 'dealDamageAll',
          amount: 3,
          location: 'choice',
          investigators: true,
          fx: 'dynamite',
        },
      },
    ],
  },
  {
    code: '01026',
    abilities: [
      {
        kind: 'played',
        label: '多余的弹药',
        effect: { type: 'reloadAmmo', amount: 3, trait: 'Firearm' },
      },
    ],
  },
  {
    code: '01036',
    abilities: [
      {
        kind: 'played',
        label: '心胜于物',
        fast: true,
        effect: { type: 'substituteSkill', from: ['combat', 'agility'], to: 'intellect' },
      },
    ],
  },
  {
    code: '01037',
    abilities: [
      {
        kind: 'played',
        label: '专业的直觉',
        fast: true,
        effect: { type: 'discoverClue', amount: 1 },
      },
    ],
  },
  {
    code: '01038',
    abilities: [
      { kind: 'played', label: '屏障', effect: { type: 'attachBarricade' } },
    ],
  },
  {
    code: '01043',
    abilities: [
      {
        kind: 'played',
        label: '隐秘的研究',
        fast: true,
        effect: {
          type: 'targetedEffect',
          target: 'location',
          effect: { type: 'draw', amount: 3 },
        },
      },
    ],
  },
  {
    code: '01050',
    abilities: [
      {
        kind: 'played',
        label: '逃避隐藏',
        fast: true,
        effect: {
          type: 'sequence',
          effects: [{ type: 'disengageAll' }, { type: 'moveTo', anyRevealed: true, noEnemies: true }],
        },
      },
    ],
  },
  {
    code: '01051',
    abilities: [
      {
        kind: 'played',
        label: '背刺',
        effect: { type: 'fight', skill: 'agility', damageBonus: 2 },
      },
    ],
  },
  {
    code: '01052',
    abilities: [
      {
        kind: 'played',
        label: '偷袭',
        effect: { type: 'dealDamageExhausted', amount: 2 },
      },
    ],
  },
  {
    code: '01057',
    abilities: [
      { kind: 'played', label: '百战百胜', effect: { type: 'gainResource', amount: 10 } },
    ],
  },
  {
    code: '01064',
    abilities: [
      {
        kind: 'played',
        label: '飞蛾扑火',
        effect: {
          type: 'sequence',
          effects: [{ type: 'drawEncounter' }, { type: 'discoverClue', amount: 2 }],
        },
      },
    ],
  },
  {
    code: '01066',
    abilities: [
      {
        kind: 'played',
        label: '眩光一闪',
        effect: {
          type: 'evade',
          skill: 'willpower',
          damageOnSuccess: 1,
          symbolActionLoss: true,
        },
      },
    ],
  },
  {
    code: '01069',
    abilities: [
      {
        kind: 'played',
        label: '眩光一闪',
        effect: {
          type: 'evade',
          skill: 'willpower',
          damageOnSuccess: 2,
          symbolActionLoss: true,
          onChaosSymbolHorror: 1,
        },
      },
    ],
  },
  {
    code: '01078',
    abilities: [
      {
        kind: 'played',
        label: '调虎离山',
        effect: { type: 'evade', auto: true, allAtLocation: true },
      },
    ],
  },
  {
    code: '01085',
    abilities: [
      { kind: 'played', label: '生存意志', fast: true, effect: { type: 'ignoreChaos' } },
    ],
  },
  {
    code: '02017',
    playCondition: [
      { when: ownTurn(), message: '只能在自己的回合打出' },
    ],
    abilities: [
      { kind: 'played', label: '嘲讽', fast: true, effect: { type: 'engageEnemies' } },
    ],
  },
  {
    code: '02018',
    abilities: [
      { kind: 'played', label: '团队合作', effect: { type: 'teamwork' } },
    ],
  },
  {
    code: '02019',
    playCondition: [
      { when: ownTurn(), message: '只能在自己的回合打出' },
    ],
    abilities: [
      {
        kind: 'played',
        label: '嘲讽',
        fast: true,
        effect: { type: 'engageEnemies', drawPerEnemy: 1 },
      },
    ],
  },
  {
    code: '02022',
    playCondition: [
      { when: ownTurn(), message: '只能在自己的回合打出' },
    ],
    abilities: [
      {
        kind: 'played',
        label: '捷径',
        fast: true,
        effect: { type: 'targetedEffect', target: 'location', effect: { type: 'moveTo' } },
      },
    ],
  },
  {
    code: '02023',
    abilities: [
      { kind: 'played', label: '寻找答案', effect: { type: 'investigateConnectingClue' } },
    ],
  },
  {
    code: '02031',
    abilities: [
      { kind: 'played', label: '困兽之笼', effect: { type: 'bindMonster' } },
    ],
  },
  {
    code: '02034',
    abilities: [
      {
        kind: 'played',
        label: '偷梁换柱',
        effect: { type: 'evade', moveEnemyOnSuccess: true },
      },
    ],
  },
  {
    code: '02107',
    abilities: [
      {
        kind: 'played',
        label: '“我有个计划！”',
        effect: { type: 'fight', skill: 'intellect', damagePerClue: true, maxDamageBonus: 3 },
      },
    ],
  },
  {
    code: '02109',
    abilities: [
      {
        kind: 'played',
        label: '走私品',
        effect: { type: 'doubleUses', usesTypes: ['ammo', 'supplies'], target: 'location' },
      },
    ],
  },
  {
    code: '02148',
    abilities: [
      { kind: 'played', label: '团结一致', effect: { type: 'standTogether' } },
    ],
  },
  {
    code: '02151',
    playCondition: [
      { when: resignAvailable(), message: '场上没有带「撤退」能力的剧本卡' },
    ],
    abilities: [
      { kind: 'played', label: '“我要走了！”', effect: { type: 'resign' } },
    ],
  },
  {
    code: '02156',
    abilities: [
      // Phase 5（5a-14）：标记用的卡号随效果数据一起走（引擎读 effect.code）。
      { kind: 'played', label: '诱敌深入', effect: { type: 'attachLure', code: '02156' } },
    ],
  },
  {
    code: '02184',
    abilities: [
      {
        kind: 'played',
        label: '最坏的打算',
        effect: { type: 'searchTop', amount: 9, trait: 'Weapon', choose: 1 },
      },
    ],
  },
  {
    code: '02228',
    abilities: [
      {
        kind: 'played',
        label: '暴露弱点',
        fast: true,
        effect: { type: 'exposeWeakness' },
      },
    ],
  },
  {
    code: '02266',
    abilities: [
      {
        kind: 'played',
        label: '杀手锏',
        fast: true,
        effect: { type: 'gainAction', amount: 3 },
      },
    ],
  },
  {
    code: '02267',
    abilities: [
      { kind: 'played', label: '月光仪式', effect: { type: 'removeDoomControlled' } },
    ],
  },
  {
    code: '02270',
    abilities: [
      { kind: 'played', label: '不期而遇', effect: { type: 'temporaryAllyFromDiscard' } },
    ],
  },
  {
    code: '02300',
    abilities: [
      {
        kind: 'played',
        label: '屠怪勇士',
        effect: { type: 'fight', defeatNonEliteOnSuccess: true },
      },
    ],
  },
  {
    code: '02303',
    abilities: [
      { kind: 'played', label: '揭开现实的面纱', effect: { type: 'decipheredReality' } },
    ],
  },
  {
    code: '03194',
    abilities: [
      {
        kind: 'played',
        label: '暗中偷袭',
        effect: { type: 'fight', addSkill: 'agility', autoEvadeOnSuccessBy: 2 },
      },
    ],
  },
  {
    code: '03229',
    playCondition: [
      { when: ownFirstAction(), message: '只能作为本回合的第一个行动打出' },
    ],
    abilities: [
      {
        kind: 'played',
        label: '单打独斗',
        noOpportunityAttack: true,
        effect: { type: 'dealDamage', amount: 1, target: 'engaged' },
      },
    ],
  },
  {
    code: '04195',
    abilities: [
      {
        kind: 'played',
        label: '暴露弱点',
        fast: true,
        effect: { type: 'exposeWeakness' },
      },
    ],
  },
]
// <<< batch: 5b-3

// >>> batch: 5b-4
export const BATCH_5B_4 = [
  {
    code: '01020',
    abilities: [
      {
        kind: 'action',
        label: '战斗（战斗 +1，仅与目标交战时伤害 +1）',
        cost: { action: true },
        effect: { type: 'fight', combatBonus: 1, onlyEngagedDamage: 1 },
      },
    ],
  },
  {
    code: '01031',
    abilities: [
      {
        kind: 'action',
        label: '研读（同地点调查员检索牌库顶 3 张，选择 1 张）',
        cost: { action: true, exhaust: true },
        effect: {
          type: 'targetedEffect',
          target: 'location',
          effect: { type: 'searchTop', amount: 3, choose: 1 },
        },
      },
    ],
  },
  {
    code: '01035',
    abilities: [
      {
        kind: 'action',
        label: '诊断（智识 2；同地点调查员成功治疗 1 伤害，失败受到 1 伤害）',
        cost: { action: true },
        effect: {
          type: 'targetedTest',
          target: 'location',
          skill: 'intellect',
          difficulty: 2,
          successEffect: { type: 'heal', amount: 1, what: 'damage' },
          failEffect: { type: 'takeDamage', amount: 1 },
        },
      },
    ],
  },
  {
    code: '01042',
    abilities: [
      {
        kind: 'action',
        label: '查阅（同地点调查员任选一项技能 +2）',
        cost: { action: true, exhaust: true },
        effect: {
          type: 'targetedEffect',
          target: 'location',
          chooseBy: 'controller',
          effect: {
            type: 'chooseOne',
            options: [
              {
                label: '意志 +2',
                effect: { type: 'addStatPhase', skill: 'willpower', amount: 2 },
              },
              {
                label: '智识 +2',
                effect: { type: 'addStatPhase', skill: 'intellect', amount: 2 },
              },
              { label: '战斗 +2', effect: { type: 'addStatPhase', skill: 'combat', amount: 2 } },
              {
                label: '敏捷 +2',
                effect: { type: 'addStatPhase', skill: 'agility', amount: 2 },
              },
            ],
          },
        },
      },
    ],
  },
  {
    code: '01045',
    abilities: [
      {
        kind: 'action',
        label: '搜刮（调查；成功则获得 3 资源而不发现线索）',
        cost: { action: true, exhaust: true },
        effect: { type: 'investigateForResources', amount: 3 },
      },
    ],
  },
  {
    code: '01059',
    modifiers: [
      { target: 'skill:willpower', amount: 1 },
    ],
  },
  {
    code: '01074',
    abilities: [
      {
        kind: 'action',
        label: '挥击（战斗 +2，伤害 +1；骷髅或自动失败时弃置）',
        cost: { action: true },
        effect: {
          type: 'fight',
          combatBonus: 2,
          damageBonus: 1,
          discardOnTokens: ['skull', 'autofail'],
        },
      },
    ],
  },
  {
    code: '02014',
    abilities: [
      {
        kind: 'action',
        label: '杜克攻击（基础战斗 4，伤害 +1）',
        cost: { action: true, exhaust: true },
        effect: { type: 'fight', baseValue: 4, damageBonus: 1 },
      },
      {
        kind: 'action',
        label: '杜克调查（可先移动，基础智识 4）',
        cost: { action: true, exhaust: true },
        effect: { type: 'dukeInvestigate' },
      },
    ],
  },
  {
    code: '02016',
    abilities: [
      {
        kind: 'action',
        label: '战斗 +1；失败不误伤队友',
        cost: { action: true },
        effect: { type: 'fight', combatBonus: 1, damageBonus: 0, noFriendlyFire: true },
      },
    ],
  },
  {
    code: '02021',
    abilities: [
      {
        kind: 'action',
        label: '研究溶液（智识 4；成功则弃置并抽 2 张牌）',
        cost: { action: true },
        effect: { type: 'researchSolution' },
      },
    ],
  },
  {
    code: '02032',
    abilities: [
      {
        kind: 'action',
        label: '消防斧攻击',
        cost: { action: true },
        effect: { type: 'fight', combatBonus: 0, damageBonus: 0, fireAxe: true },
      },
    ],
  },
  {
    code: '02036',
    abilities: [
      {
        kind: 'action',
        label: '弯刀攻击（战斗 +1，可追加行动增加伤害）',
        cost: { action: true },
        effect: { type: 'fight', combatBonus: 1, damageBonus: 0, maySpendActionForDamage: 1 },
      },
    ],
  },
  {
    code: '02108',
    abilities: [
      {
        kind: 'action',
        label: '探路者移动',
        cost: { action: false, exhaust: true },
        effect: { type: 'moveTo', requiresNoEnemies: true },
      },
    ],
  },
  {
    code: '02185',
    abilities: [
      {
        kind: 'action',
        label: '花费 2 资源：智力 +1 直到本阶段结束',
        cost: { action: false, resources: 2 },
        effect: { type: 'addStatPhase', skill: 'intellect', amount: 1 },
      },
      {
        kind: 'action',
        label: '花费 2 资源：战斗 +1 直到本阶段结束',
        cost: { action: false, resources: 2 },
        effect: { type: 'addStatPhase', skill: 'combat', amount: 1 },
      },
    ],
  },
  {
    code: '02232',
    modifiers: [
      { target: 'skill:intellect', amount: 1 },
    ],
    abilities: [
      {
        kind: 'action',
        label: '查看牌库顶牌',
        cost: { action: false, exhaust: true },
        effect: { type: 'lookTopDeckAndDoom' },
      },
    ],
  },
  {
    code: '02265',
    abilities: [
      {
        kind: 'action',
        label: '从手牌打出一件物品',
        cost: { action: false, resources: 1 },
        effect: { type: 'playItemFromHand' },
      },
    ],
  },
  {
    code: '03028',
    abilities: [
      {
        kind: 'action',
        label: '潜行躲避',
        cost: { action: true, exhaust: true },
        effect: {
          type: 'evade',
          evadeModifier: -2,
          noExhaustOnSuccess: true,
          preventEngageThisTurn: true,
        },
      },
    ],
  },
  {
    code: '03110',
    abilities: [
      {
        kind: 'action',
        label: '指节铜环攻击',
        cost: { action: true },
        effect: { type: 'fight', combatBonus: 0, damageBonus: 1, grantRetaliate: true },
      },
    ],
  },
  {
    code: '03154',
    abilities: [
      {
        kind: 'action',
        label: '影之书补充1充能',
        cost: { action: true, exhaust: true, resources: 1 },
        effect: { type: 'rechargeAsset', amount: 1, trait: 'Spell' },
      },
    ],
  },
]
// <<< batch: 5b-4

// >>> batch: 5b-5
export const BATCH_5B_5 = [
  {
    code: '01006',
    uses: 4,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '射击（战斗 +1；所在地点有线索时改为 +3，伤害 +1）',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 1,
          ifCluesAtLocationCombatBonus: 2,
          damageBonus: 1,
        },
      },
    ],
  },
  {
    code: '01016',
    uses: 4,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '射击（战斗 +1，伤害 +1）',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 1, damageBonus: 1 },
      },
    ],
  },
  {
    code: '01019',
    uses: 3,
    usesType: 'supplies',
    discardWhenEmpty: true,
    abilities: [
      {
        kind: 'action',
        label: '治疗 1 伤害或 1 恐惧',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'targetedEffect',
          target: 'location',
          effect: {
            type: 'chooseOne',
            options: [
              { label: '治疗 1 伤害', effect: { type: 'heal', amount: 1, what: 'damage' } },
              { label: '治疗 1 恐惧', effect: { type: 'heal', amount: 1, what: 'horror' } },
            ],
          },
        },
      },
    ],
  },
  {
    code: '01029',
    uses: 2,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '开火（战斗 +3，按超过难度造成 1~5 伤害）',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 3,
          successDamage: 'overDifficulty',
          minDamage: 1,
          maxDamage: 5,
          failByAmountToEngaged: true,
        },
      },
    ],
  },
  {
    code: '01047',
    uses: 3,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '射击（战斗 +2，成功差值至少 2 时伤害 +1）',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 2, successBy: 2, damageBonus: 1 },
      },
    ],
  },
  {
    code: '01058',
    uses: 4,
    usesType: 'secret',
    discardWhenEmpty: true,
    abilities: [
      {
        kind: 'action',
        label: '禁忌知识（横置、受 1 恐惧、花 1 秘密：获得 1 资源）',
        cost: { action: false, exhaust: true, uses: 1, horror: 1 },
        effect: { type: 'gainResource', amount: 1 },
      },
    ],
  },
  {
    code: '01060',
    uses: 4,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '法术攻击（意志检定，伤害 +1；揭示负面符号受 1 恐惧）',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', skill: 'willpower', damageBonus: 1, onChaosSymbolHorror: 1 },
      },
    ],
  },
  {
    code: '01061',
    uses: 3,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '窥视（查看任意牌库顶 3 张并重排）',
        cost: { action: true, exhaust: true, uses: 1 },
        effect: { type: 'scry' },
      },
    ],
  },
  {
    code: '01071',
    uses: 4,
    usesType: 'charges',
    discardWhenEmpty: true,
  },
  {
    code: '01087',
    uses: 3,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '照亮（调查，帷幕 -2）',
        cost: { action: true, uses: 1 },
        effect: { type: 'investigate', shroudMod: -2 },
      },
    ],
  },
  {
    code: '02010',
    uses: 0,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '双枪射击（战斗 +2，伤害 +1）',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
      },
    ],
  },
  {
    code: '02024',
    uses: 4,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '治疗恐惧并检定意志',
        cost: { action: true, uses: 1 },
        effect: { type: 'liquidCourage' },
      },
    ],
  },
  {
    code: '02028',
    uses: 3,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '用意志调查并多发现 1 条线索',
        cost: { action: true, uses: 1 },
        effect: { type: 'investigate', skill: 'willpower', clueBonus: 1, symbolEndsTurn: true },
      },
    ],
  },
  {
    code: '02030',
    uses: 3,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '同地点调查员治疗 1 恐惧',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'targetedEffect',
          target: 'location',
          effect: { type: 'heal', amount: 1, what: 'horror' },
        },
      },
    ],
  },
  {
    code: '02112',
    uses: 5,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '亡者之歌攻击',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 1,
          damageBonus: 0,
          skill: 'willpower',
          skullDamageBonus: 2,
        },
      },
    ],
  },
  {
    code: '02116',
    uses: 3,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '受到 1 点伤害，治愈 1 点恐惧',
        cost: { action: false, exhaust: true, uses: 1 },
        effect: {
          type: 'sequence',
          effects: [{ type: 'takeDamage', amount: 1 }, { type: 'heal', amount: 1, what: 'horror' }],
        },
      },
    ],
  },
  {
    code: '02117',
    uses: 3,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '受到 1 点恐惧，治愈 1 点伤害',
        cost: { action: false, exhaust: true, uses: 1 },
        effect: {
          type: 'sequence',
          effects: [{ type: 'takeHorror', amount: 1 }, { type: 'heal', amount: 1, what: 'damage' }],
        },
      },
    ],
  },
  {
    code: '02154',
    uses: 4,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '意志战斗 +2，伤害 +1',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 2,
          damageBonus: 1,
          skill: 'willpower',
          onChaosSymbolHorror: 1,
        },
      },
    ],
  },
  {
    code: '02226',
    uses: 3,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '春田步枪攻击',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 3, damageBonus: 2, requireNotEngagedTarget: true },
      },
    ],
  },
  {
    code: '02233',
    uses: 3,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '高阶寻求仪式',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'investigate',
          skill: 'willpower',
          bonus: 2,
          clueBonus: 2,
          symbolEndsTurn: true,
        },
      },
    ],
  },
  {
    code: '02262',
    uses: 4,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '用溶液治疗同地点调查员 2 点伤害',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'targetedEffect',
          target: 'location',
          effect: { type: 'heal', amount: 2, what: 'damage' },
        },
      },
    ],
  },
  {
    code: '02263',
    uses: 3,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '以基础战斗值 6 攻击，伤害 +2',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 0, damageBonus: 2, baseValue: 6 },
      },
    ],
  },
  {
    code: '02264',
    uses: 4,
    usesType: 'supplies',
    abilities: [
      {
        kind: 'action',
        label: '以基础敏捷值 6 躲避',
        cost: { action: true, uses: 1 },
        effect: { type: 'evade', baseValue: 6 },
      },
    ],
  },
  {
    code: '02301',
    uses: 3,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '战斗 +5，伤害 +2',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 5, damageBonus: 2 },
      },
    ],
  },
  {
    code: '02304',
    uses: 4,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '芝加哥打字机攻击',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 0,
          damageBonus: 2,
          additionalActionCombatBonus: 2,
        },
      },
    ],
  },
  {
    code: '02306',
    uses: 4,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '意志战斗 +3，伤害 +2',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 3,
          damageBonus: 2,
          skill: 'willpower',
          onChaosSymbolHorror: 2,
        },
      },
    ],
  },
  {
    code: '03020',
    uses: 6,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '.32柯尔特手枪攻击',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 0, damageBonus: 1 },
      },
    ],
  },
  {
    code: '03190',
    uses: 4,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '.45自动手枪攻击',
        cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 2, damageBonus: 1, ignoreRetaliate: true },
      },
    ],
  },
  {
    code: '03192',
    uses: 3,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '引导石调查',
        cost: { action: true, uses: 1 },
        effect: { type: 'investigate', successByClueEvery: 2 },
      },
    ],
  },
  {
    code: '03193',
    uses: 3,
    usesType: 'charges',
    abilities: [
      {
        kind: 'action',
        label: '预言调查',
        cost: { action: true, uses: 1 },
        effect: { type: 'investigate', autoEvadeOnSuccess: true, noOpportunityAttack: true },
      },
    ],
  },
  {
    code: '03234',
    uses: 3,
    usesType: 'ammo',
    abilities: [
      {
        kind: 'action',
        label: '.41短口手枪攻击',
        cost: { action: true, uses: 1 },
        effect: {
          type: 'fight',
          combatBonus: 2,
          damageBonus: 0,
          damageOnSuccessBy: 1,
          gainActionOnSuccessBy: 3,
          gainActionLimit: 'turn',
        },
      },
    ],
  },
]
// <<< batch: 5b-5

export const MIGRATED_CARD_ENTRIES = [
  ...BATCH_5B_1,
  ...BATCH_5B_2,
  ...BATCH_5B_3,
  ...BATCH_5B_4,
  ...BATCH_5B_5,
]

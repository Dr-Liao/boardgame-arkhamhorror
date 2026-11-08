// 七循环《地球边缘》（Edge of the Earth）P1 机制扫描词表。
//
// 本文件只描述“扫描口径”，不声明任何卡牌行为已实现：匹配只用于分类，绝不代表逐卡验收
// （P1 阶段所有卡 behaviorStatus 仍为 pending，字面行为在 P5–P7 验收）。
//
// 条目口径（与 docs/edgeOfTheEarth/README.md §5 对齐）：
//   · type ∈ primitive | keyword | rulebook | interaction | scenario | content；
//   · patterns 是大小写不敏感的正则字符串，卡片命中任一 pattern 即归入该机制；扫描语料为
//     `name + '\n' + text + '\n' + backText`（与 TIC/TDE 扫描器一致）；
//   · 内容型兜底机制用可选谓词字段代替正则（types / owners / faces），保证 403 条记录
//     至少归入一个机制（unclassified = 0），不靠“猜关键词”覆盖；
//   · candidatePrimitives 只能引用引擎 / 原语目录里已登记的 id（见 Lead 给定的 P1 原语清单，
//     未知 id 会让 primitiveCandidatesKnown 门禁失败）。
export const MECHANISM_TYPES = Object.freeze(['primitive', 'keyword', 'rulebook', 'interaction', 'scenario', 'content'])

const define = (id, type, title, patterns, candidatePrimitives, extra = {}) => Object.freeze({
  id, type, title, patterns: Object.freeze(patterns), candidatePrimitives: Object.freeze(candidatePrimitives), ...extra,
})

export const MECHANISMS = Object.freeze([
  // ── 已有关键词（本循环复用，不新增能力；existing 由原语目录判定）────────────────────────
  define('hunter', 'keyword', '猎手', ['\\bHunter\\b'], ['core.enemy']),
  define('aloof', 'keyword', '冷漠', ['\\bAloof\\b'], ['core.enemy']),
  define('massive', 'keyword', '庞大', ['\\bMassive\\b'], ['core.enemy']),
  define('retaliate', 'keyword', '报复', ['\\bRetaliate\\b'], ['core.enemy']),
  define('alert', 'keyword', '警戒', ['\\bAlert\\b'], ['core.enemy']),
  define('surge', 'keyword', '涌动', ['\\bSurge\\b'], ['core.encounter']),
  define('peril', 'keyword', '险境', ['\\bPeril\\b'], ['core.encounter']),
  define('hidden', 'keyword', '隐藏', ['\\bHidden\\b'], ['core.encounter']),
  define('victory', 'keyword', '胜利点', ['\\bVictory\\b'], ['core.effects']),
  define('objective', 'keyword', '目标', ['\\bObjective\\b'], ['core.effects']),
  define('prey', 'keyword', '猎物', ['\\bPrey\\b'], ['core.enemy']),
  define('spawn', 'keyword', '生成', ['\\bSpawn\\b'], ['core.enemy']),
  define('parley', 'keyword', '谈判', ['\\bParley\\b'], ['core.effects', 'interaction.choices']),
  define('resign', 'keyword', '撤退', ['\\bResign\\b'], ['core.effects']),
  define('fast', 'keyword', '快速', ['\\bFast\\b'], ['core.effects', 'core.actionHistory']),
  define('permanent', 'keyword', '永久', ['\\bPermanent\\b'], ['core.deck']),
  define('exceptional', 'keyword', '卓越', ['\\bExceptional\\b'], ['core.deck']),
  define('elite', 'keyword', '精英', ['\\bElite\\b'], ['keyword.elite', 'core.enemy']),
  define('revelation', 'keyword', '显现', ['\\bRevelation\\b'], ['core.encounter']),

  // ── 本循环新规则 / 新标记（README §5）────────────────────────────────────────────────
  define('mirage', 'keyword', '幻景（Mirage）与版本化记忆', ['\\bMirage\\b'], ['keyword.mirage', 'scenario.mirageVersions']),
  define('shelter', 'keyword', '庇护值（Shelter）', ['\\bShelter\\b'], ['keyword.shelter', 'location.shelter']),
  define('partner', 'keyword', '探险队伙伴（Partner）', ['\\bPartner\\b'], ['keyword.partner', 'campaign.partner', 'campaign.memorials']),
  define('resolute', 'keyword', '坚毅（Resolute）', ['\\bResolute\\b'], ['keyword.resolute', 'campaign.partner']),
  define('seal', 'keyword', '封印（Seal）与封印标记', ['\\bSeal(?:ed)?\\b', '\\[seal_[a-e]\\]'], ['keyword.seal', 'campaign.seals']),
  define('sealTokens', 'keyword', '五枚封印标记 [seal_a]–[seal_e]', ['\\[seal_[a-e]\\]'], ['keyword.seal', 'campaign.seals']),
  define('level', 'keyword', '高度层（Level 0–5）', ['\\bLevel\\b'], ['keyword.level', 'location.vertical']),
  define('key', 'keyword', '钥匙（Key）', ['\\bKey\\b'], ['keyword.key', 'scenario.keys']),
  define('tekelili', 'keyword', '忒咳哩-哩！（Tekeli-li!）弱点牌库', ['Tekeli-li|Tekelili|Tekeli-Li'], ['scenario.tekeliDeck', 'interaction.tekeliShuffle']),
  define('expedition', 'keyword', '探险（Expedition）特质与物资', ['\\[\\[Expedition\\]\\]', '\\bExpedition\\b'], ['keyword.expedition', 'campaign.supplies']),
  define('frost', 'keyword', '寒霜标记 [frost]', ['\\[frost\\]'], ['chaos.frost']),
  define('supplies', 'keyword', '物资（Supplies）', ['\\bSupplies?\\b'], ['campaign.supplies']),
  define('titanic', 'keyword', '巨型（Titanic）', ['\\bTitanic\\b'], ['core.enemy']),
  define('hazard', 'keyword', '险境特质（Hazard）', ['\\[\\[Hazard\\]\\]|\\bHazard\\b'], ['content.traits']),
  define('broken', 'keyword', '破功面（Broken）', ['\\[\\[Broken\\]\\]|\\bBroken\\b'], ['content.traits', 'investigator.discipline']),
  define('unbroken', 'keyword', '运功面（Unbroken）', ['\\[\\[Unbroken\\]\\]|\\bUnbroken\\b'], ['content.traits', 'investigator.discipline']),
  define('eidolon', 'keyword', '幻灵（Eidolon）', ['\\[\\[Eidolon\\]\\]|\\bEidolon\\b'], ['content.traits']),
  define('ancientOne', 'keyword', '古神（Ancient One）', ['\\[\\[Ancient One\\]\\]|Ancient One'], ['content.traits']),
  define('possessed', 'keyword', '附身（Possessed）', ['\\[\\[Possessed\\]\\]|\\bPossessed\\b'], ['content.traits']),

  // ── 通用原语：引擎已有能力的复用点（P2 先盘点再决定 extend/new）──────────────────────
  define('tokenResolution', 'primitive', '混乱标记揭示与符号结算', ['\\[(?:skull|cultist|tablet|elder_thing|elder_sign|auto_fail|frost)\\]', 'chaos token'], ['chaos.bag', 'chaos.tokenEffects']),
  define('tokenPool', 'primitive', '混乱袋构成、增删与寒霜物理池', ['chaos bag|add .*token|remove .*token', '\\[frost\\]'], ['chaos.bag', 'chaos.frost']),
  define('uses', 'primitive', '支援使用次数（uses）与充能／秘密／物资', ['\\bUses \\(', 'uses? \\(\\d+'], ['core.uses']),
  define('testResolution', 'primitive', '技能检定、难度与成功／失败结算', ['skill test', '\\b(?:Fight|Evade|Investigate|Parley)\\b\\.'], ['core.test']),
  define('damageHorror', 'primitive', '伤害／恐惧与治愈', ['\\bdamage\\b|\\bhorror\\b'], ['core.effects', 'modifiers']),
  define('cardFlow', 'primitive', '抽牌、弃牌、洗牌与检索牌库', ['\\bdraw\\b|\\bdiscard\\b|\\bshuffle\\b|search your deck'], ['core.deck']),
  define('actionEconomy', 'primitive', '行动类型、快速时机与额外行动', ['\\[action\\]|\\[fast\\]|\\[reaction\\]|\\[free\\]|additional action'], ['core.actionHistory']),
  define('doomClock', 'primitive', '毁灭／议程推进时钟', ['\\bdoom\\b'], ['core.encounter', 'campaign.flows']),
  define('enemyAttack', 'primitive', '敌人交战、攻击与趁乱攻击', ['\\battack(?:s|ed)?\\b|\\bengaged\\b|\\bengage\\b'], ['core.enemy']),
  define('movement', 'primitive', '移动与地点连接', ['\\bmove\\b|\\badjacent\\b|\\bconnected\\b'], ['location.connections', 'location.grid']),
  define('clueDiscovery', 'primitive', '线索发现与调查', ['\\bclue\\b'], ['location.facts', 'core.test']),
  define('resourceEconomy', 'primitive', '资源、费用与支付', ['\\bresource\\b|\\bcost\\b'], ['core.effects']),
  define('victoryPoints', 'primitive', '胜利点与胜利展示区', ['Victory \\d'], ['core.effects']),
  define('encounterDeck', 'primitive', '遭遇牌库、涌动与遭遇结算', ['encounter deck|encounter card|draw .*encounter'], ['core.encounter', 'scenario.deck']),
  define('setAsideRemoval', 'primitive', '置于一边、移出游戏与离场记录', ['set aside|out of play|remove (?:it |this card |the )?from the game'], ['scenario.deck', 'physical.faces']),
  define('deckTopReveal', 'primitive', '牌库顶常驻揭示与从牌库顶打出', ['top card of your deck|top of your deck|deck top|play .*top card'], ['investigator.deckTop', 'interaction.deckTopReveal']),

  // ── 规则书条目：本循环需要补写的规则页（P3 才写规则文本，这里只登记缺口）──────────────
  define('rules.chaosBag', 'rulebook', '混乱袋：四档符号与寒霜标记', ['chaos bag|\\[skull\\]|\\[cultist\\]|\\[tablet\\]'], ['chaos.bag', 'chaos.tokenEffects']),
  define('rules.frost', 'rulebook', '寒霜标记规则：追加揭示与自动失败', ['\\[frost\\]|frost token'], ['chaos.frost']),
  define('rules.shelter', 'rulebook', '庇护值与营地规则', ['\\bshelter\\b|\\bCamp\\b'], ['location.shelter', 'scenario.camp']),
  define('rules.partner', 'rulebook', '探险队伙伴与纪念逝者规则', ['\\bPartner\\b|expedition team|Resolute'], ['campaign.partner', 'campaign.memorials', 'keyword.partner']),
  define('rules.seals', 'rulebook', '五枚封印与高塔规则', ['\\bSeal(?:ed)?\\b|\\[seal_[a-e]\\]|Mist-Pylon'], ['campaign.seals', 'scenario.sealTowers']),
  define('rules.tekeli', 'rulebook', '忒咳哩-哩牌库规则', ['Tekeli-li|Tekelili'], ['scenario.tekeliDeck', 'interaction.tekeliShuffle']),
  define('rules.supplies', 'rulebook', '探险物资携带与掉落规则', ['\\bSupplies?\\b|Expedition asset|carrying'], ['campaign.supplies']),
  define('rules.climb', 'rulebook', '山峰高度层级与攀登规则', ['\\bLevel\\b|climb|height|cliff'], ['location.vertical', 'scenario.climb']),
  define('rules.cityGrid', 'rulebook', '城市景观行列布局与窥视规则', ['\\brow\\b|\\bcolumn\\b|same row|same column'], ['location.grid', 'scenario.cityVote']),
  define('rules.mirage', 'rulebook', '致命幻景版本与重返规则', ['\\bMirage\\b|memory of|fatal mirage'], ['keyword.mirage', 'scenario.mirageVersions']),
  define('rules.campaignFlow', 'rulebook', '战役流程：检查点、幕间与尾声', ['Checkpoint|interlude|prologue|epilogue'], ['campaign.flows', 'campaign.epilogue']),
  define('rules.records', 'rulebook', '战役日志与记录集合', ['Campaign Log|\\brecord\\b|\\blog\\b'], ['campaign.recordSet']),
  define('rules.multiclass', 'rulebook', '多职阶构筑与升级限制', ['Deckbuilding Options|level 0|level 1-5|up to 5 other'], ['investigator.multiclass', 'investigator.rules']),
  define('rules.deckTop', 'rulebook', '牌库顶揭示与打出规则', ['top card of your deck|top of your deck'], ['investigator.deckTop', 'interaction.deckTopReveal']),
  define('rules.discipline', 'rulebook', '演武双面与翻面规则', ['\\bDiscipline\\b|Unbroken|Broken'], ['investigator.discipline', 'keyword.resolute']),

  // ── 交互：P4 需要新增／复用的界面与选择流程 ─────────────────────────────────────────
  define('choices', 'interaction', '选择、分配、目标与可选分支', ['\\bchoose\\b|\\bchoice\\b|\\beither\\b|\\bchoose one\\b'], ['interaction.choices']),
  define('frostReveal', 'interaction', '寒霜标记连续揭示与第二枚自动失败提示', ['\\[frost\\]|reveal .*frost|second frost'], ['interaction.frostReveal', 'chaos.frost']),
  define('partnerSetup', 'interaction', '开局伙伴选派与伙伴状态面板', ['\\bPartner\\b|expedition team'], ['interaction.partnerSetup', 'campaign.partner']),
  define('sealPlacement', 'interaction', '封印放置、激活与高塔互动', ['place .*seal|seal .*(?:location|act|agenda|tower)|\\[seal_[a-e]\\]'], ['interaction.sealPlacement', 'campaign.seals']),
  define('tekeliShuffle', 'interaction', '忒咳哩-哩不查看洗入与结算去向', ['Tekeli-li.*deck|shuffle .*Tekeli-li|Tekeli-li deck'], ['interaction.tekeliShuffle', 'scenario.tekeliDeck']),
  define('checkpointInterlude', 'interaction', '检查点／幕间选择与营地继承', ['Checkpoint|interlude'], ['interaction.checkpoint', 'campaign.flows']),
  define('cityVote', 'interaction', '城市窥视后的投票／合作选择', ['\\bvote\\b|\\bagree\\b|\\bdisagree\\b'], ['scenario.cityVote', 'location.grid']),
  define('mirageVersions', 'interaction', '幻景版本 I–III 与记忆囚笼选择', ['\\bversion\\b|\\bv\\. (?:I|II|III)\\b|Ethereal Tangle|Shadow of the Past'], ['scenario.mirageVersions', 'keyword.mirage']),
  define('crossSeatPlay', 'interaction', '代打他人手中道具与共同付费', ["another investigator's hand|reveal .*hand|hand at your location"], ['investigator.crossSeatPlay', 'play.channels']),
  define('roundDistance', 'interaction', '按连接距离结算的回合结束效果', ['connections away|locations away|number of connections'], ['investigator.roundDistance', 'location.connections']),
  define('attackReaction', 'interaction', '敌人攻击后的反应窗口（含攻击被取消）', ['after an enemy attacks you|attacks you'], ['investigator.attackReaction', 'core.enemy']),
  define('climbAscent', 'interaction', '斜向／纵向攀登与掉落到地点', ['\\bLevel\\b|height|climb|drop .*location'], ['scenario.climb', 'location.vertical']),

  // ── 内容结构兜底：按类型 / 归属 / 关联面覆盖全部 403 条记录，保证 unclassified = 0 ──────
  define('content.investigators', 'content', '调查员身份与专属依赖', [], ['investigator.rules', 'content.traits', 'physical.faces'], { types: ['investigator'] }),
  define('content.playerCards', 'content', '一般玩家卡（支援／事件／技能）', [], ['core.effects', 'play.channels', 'modifiers'], { owners: ['eotePlayer', 'eoteInvestigators'], types: ['asset', 'event', 'skill'] }),
  define('content.enemies', 'content', '非玩家敌人身份与战斗数据', [], ['core.enemy', 'content.traits'], { types: ['enemy'] }),
  define('content.treacheries', 'content', '非玩家诡计身份与显现', [], ['core.encounter', 'content.traits'], { types: ['treachery'] }),
  define('content.locations', 'content', '地点正反面、连接与庇护值', [], ['location.facts', 'physical.faces'], { types: ['location'] }),
  define('content.storyCards', 'content', '剧情资产与故事卡', [], ['scenario.deck', 'content.traits'], { types: ['story'] }),
  define('content.scenarioPromptCards', 'content', '五张印刷提示卡（混乱符号参考卡）', [], ['scenario.deck', 'chaos.tokenEffects'], { types: ['scenario'] }),
  define('content.actsAgendas', 'content', '幕／议程正反面与推进', [], ['core.encounter', 'campaign.flows', 'physical.faces'], { types: ['act', 'agenda'] }),
  define('content.structures', 'content', '场景结构：章节身份、地点与剧情骨架', [], ['physical.faces', 'content.traits'], { types: ['scenario', 'location', 'act', 'agenda', 'story'] }),
  define('content.faces', 'content', '双面／关联面（a/b 面）记录', [], ['physical.faces'], { faces: true }),
  define('content.traits', 'content', '特质词表（[[trait]] 标记）', ['\\[\\[[^\\]]+\\]\\]'], ['content.traits'], {}),
  define('content.records', 'content', '战役记录键与记录集合', ['Campaign Log|\\brecord\\b|\\blog\\b'], ['content.records', 'campaign.recordSet']),
])

export const MECHANISM_BY_ID = Object.freeze(Object.fromEntries(MECHANISMS.map(mechanism => [mechanism.id, mechanism])))

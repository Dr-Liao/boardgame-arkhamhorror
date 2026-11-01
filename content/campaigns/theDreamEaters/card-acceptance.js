// 食梦者（The Dream Eaters）逐卡验收备注注册表。
//
// 这是**人工/代理逐卡行为审计的补充说明**，不是验收状态的事实源：逐卡自动测试状态由
// `tools/audit-tde-all-cards.mjs` 实跑 `TDE <code>` 测试后写进
// `audit/tde-all-card-acceptance.json` 与 `src/cards/tde-campaign-acceptance.js`。
//
// 登记三类显式简化（凡是简化必须带 note，不得静默近似；当前 87 = P7 57 + P8 单卡 22 + P8 章节 gap 8）：
//   1. P7 玩家包 57 张：note 逐字来自 `audit/tde-player-acceptance.json` 的 entries[].note，
//      sources: ['P7']；
//   2. P8 单卡条目 22 张：note 逐字来自 `src/cards/encounter-entries/**/<code>.js` 的
//      `simplified: true` + note（经 NON_PLAYER_ABILITY_ENTRIES 读取），sources: ['P8-card']；
//   3. P8 章节 gap 12 条 → 去重后 8 个锚点 code：逐条评审登记在
//      `audit/tde-scenario-gap-triage.json`（含 gap 原文、disposition、落卡），sources: ['P8-gap']，
//      gaps 字段 = triage 的 gap id（<chapterId>#<n>）。
//   P6 调查员简化 = 0（历史简化已在 P6/P8 还账，见 TDE_P6_SIMPLIFICATION_CODES）。
//
// 键 = 06xxx / 06xxxa/b 卡号；
// 值 = { status: 'verified' | 'simplified', note: string, sources?: string[], gaps?: string[] }。
//   · verified   —— 已通过逐卡测试、无显式简化（未登记默认 verified）；
//   · simplified —— 行为审计发现显式近似或未实现子句（gap），note 写清差异/缺口；账本 noteStatus 记
//                   simplified、仍进 summary.simplified 与 remaining，不宣称规则等价。
//
// 生成来源：audit/tde-player-acceptance.json（57）+ src/cards/encounter-entries/**（22）+
// audit/tde-scenario-gap-triage.json（12→8 锚点）；改卡/改简化时必须同步本文件。
export const TDE_CARD_ACCEPTANCE_NOTES = {
  "06019": {
    "status": "simplified",
    "note": "未实现：弱点揭示时附属到玩家支援的完整物理形态（引擎无 attachedAsset 弱点类型/attach-resolving-card API），改为在渴血之刃的 attachedCards 槽记录附属张数；[fast] +1 伤害由 06018 的攻击 resolve 结算。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06022": {
    "status": "simplified",
    "note": "未实现：充能归零的自动复位只在「花费最后 1 充能」这条路径上结算（引擎没有 uses 归零钩子）；挂坠被其他效果清空充能时不会自动放在一边。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06023": {
    "status": "simplified",
    "note": "未实现：被查找到时的二选一奖励（获得 2 资源／在支援上放 1 秘密）——searchedCardRule 无 resolve 通道；已实现「查找中被发现 → 弃掉」与「不能打出」。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06024": {
    "status": "simplified",
    "note": "未实现：附属事件「如同手牌」投入技能检定（playChannels.commitEntries 只有 beneath 通道，attachments 无投入候选）；已实现额外费用检索与事件附属（上限 5）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06025": {
    "status": "simplified",
    "note": "未实现：「放在一边」用 removeEnemy 移出对局代替（引擎无敌人 setAside 写入口）；其余生成/横置/猎手/bearer 猎物已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06027": {
    "status": "simplified",
    "note": "未实现：遭遇牌库没有「混洗入顶部 N 张」的插入点（api.shuffleIntoEncounterDeck 只能洗入整副遭遇牌库），改为洗入遭遇牌库。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06028": {
    "status": "simplified",
    "note": "未实现：作为遭遇卡被抽出时的显现结算（drawEncounter 无玩家卡分支）与「立即进行一个行动」；已实现显现数据体（选择调查员→抽 1/获得 1→移出游戏）与绑定关系。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06029": {
    "status": "simplified",
    "note": "未实现：两个附属有「开启大门」的地点互相连接（移动图只读 location.connections，无卡条目可驱动的动态连接读点）；已实现快速（played 描述子 fast + 条目 fast 数据）/只能自己回合/附属到所在地点/团队上限 3（playCondition 读 playerLocationAttachments）。注：引擎的快速事件候选需要固定触发时机，本卡没有「任意玩家窗口」原语，实际按自己回合的普通事件打出。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06035": {
    "status": "simplified",
    "note": "未实现：不能对其他调查员的技能检定投入卡牌、不能用玩家卡效果影响其他调查员（引擎无对应读点：capability:commit 只挡自己的检定，也没有玩家卡效果指向他人的通用限制）；已实现威胁区与 [action][action] 弃置。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06036": {
    "status": "simplified",
    "note": "未实现：「当你的回合结束时受到 1 点恐惧」——引擎的回合结束强制读点只覆盖威胁区，游戏区域的资产没有读点；已实现放置入场、[action] 夺取道具/资源并洗回牌库。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06037": {
    "status": "simplified",
    "note": "未实现：强制「受到伤害或恐惧后弃掉」在伤害/恐惧分配前结算（harmDealt 窗口），若伤害全部由支援承接也会弃掉；其余限制与 [action] 弃置已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06038": {
    "status": "simplified",
    "note": "未实现：承受者不能攻击/伤害/击败它（引擎的被攻击/被击败读点没有按攻击者座位的卡条目钩子；enemyCannotBeAttacked 无攻击者参数）；已实现猎手与「猎物-仅对承受者」。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06063": {
    "status": "simplified",
    "note": "面板/表示层缺口（非单卡规则缺口）：寄生地点上的伤害标记与「封印后替换为恐惧标记」的可见面板属 P5/P9；本章内容层只维护 tokenBag 的寄生状态（infestedLocations）与 scenarioFlags.sealedRifts。锚到章节参考卡 06063 作章节级理由。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "wakingNightmare#1"
    ]
  },
  "06085": {
    "status": "simplified",
    "note": "「所在地点有[[蜘蛛]]敌人时不能投入卡牌」需要检定期间的 commit 闸门（共享 canCommitCard 只读威胁区 flags）；失败限制已通过 scenarioFlags.failRestricts 接线（共享 canFightEnemy/investigationError 读点）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06093": {
    "status": "simplified",
    "note": "「[intellect]/[combat]/[agility] 计 1、[willpower]/[wild] 计 2 个匹配图标」需要检定器的图标权重读点；已登记 coordinator request。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06094": {
    "status": "simplified",
    "note": "图标权重同 06093（已登记 coordinator request）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06095": {
    "status": "simplified",
    "note": "「每次抽牌后检查手牌上限」缺引擎抽牌后钩子（CheckHandSizeAfterDraw 无对应读点）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06096": {
    "status": "simplified",
    "note": "调查时二选一与轮末弃牌需要共享层 beforeInvestigate/roundEnded 的数据分派；已登记 coordinator request。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06097": {
    "status": "simplified",
    "note": "两类效果都需要共享层数据分派（行动额外费用通道 / 调查成功替代），已登记 coordinator request。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06099": {
    "status": "simplified",
    "note": "「受到额外 1 点伤害或恐惧」按伤害声明（引擎 harmInterceptor 每个拦截器只能指定伤害或恐惧之一）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06100": {
    "status": "simplified",
    "note": "附属到支援/文本空白/摆脱行动由使用本章的章节 behavior 读 flags 接线（内容层无 attach-to-asset API）；数据已备好。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06103": {
    "status": "simplified",
    "note": "关键字授予/移动封锁/摆脱行动需要共享层地点附属数据分派；已登记 coordinator request。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06104": {
    "status": "simplified",
    "note": "「附属到当前幕 / 幕推进全体 2 伤 / 幕获得摆脱行动」由使用 corsairs 组的章节 behavior 读 flags 接线；数据已备好。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06106": {
    "status": "simplified",
    "note": "「与你所在地点最低战斗调查员交战」的生成需要共享层 spawnLocation 数据分派；已登记 coordinator request。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06107": {
    "status": "simplified",
    "note": "「与你所在地点最低敏捷调查员交战」的生成需要共享层 spawnLocation 数据分派；已登记 coordinator request。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06108": {
    "status": "simplified",
    "note": "生成地点已由共享 spawnLocation 数据分派；「击败时取消超出伤害并搬动剩余蜂拥卡」需要击败结算的内容读点（引擎无通道）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06110": {
    "status": "simplified",
    "note": "未实现：替换神话阶段的抽取遭遇步骤与按座位分发遭遇牌（无该时机窗口、无按座位分发遭遇牌的 API）；已实现：快速事件（近似在神话阶段开始时）查看遭遇牌库顶 X 张并重新排列，X = 调查员人数。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06111": {
    "status": "simplified",
    "note": "未实现：①该敌人在本次技能期间获得反击和警戒；②本次检定结束后抽 1 张卡牌（commit 描述子没有「测试期间」/「测试结束后」读点）。「只能投入到攻击或躲避敌人期间的检定」以 skill.requireEngagedEnemy 近似（要求投入时与敌人交战）。3 个万能图标由卡面数据通道生效。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06113": {
    "status": "simplified",
    "note": "未实现：「将要进入弃牌堆或洗入牌库时改为放回场外集合（和绑定卡牌一起）」——引擎检定收尾会把投入卡统一放进弃牌堆，没有 bonded 读取点；Bonded(Dream Diary) 关系与图标由卡面数据通道生效。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06115": {
    "status": "simplified",
    "note": "未实现：「检定成功后本阶段下一次技能检定难度降低 X（X=超出难度点数，至多 3）」——引擎没有下一次检定的难度账本，commit 描述子也没有可写读点；1 个万能图标由卡面数据通道生效。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06117": {
    "status": "simplified",
    "note": "未实现：「你可以忽略本次调查期间你所在地点将要触发的任何效果和关键词」——引擎没有「忽略地点效果/关键词」的通用读取点；调查、把意志值加入技能值、成功额外发现 1 个线索均已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06118": {
    "status": "simplified",
    "note": "未实现：①入场时其上带有 2 点伤害（缺「给支援加伤害」的 ctx.api；不能直写资产字段）；②[reaction]你的回合结束后治愈她 1 点伤害（引擎没有回合结束窗口，也没有资产伤害的通用治愈读点）。你得到 +1[combat] 已由 modifiers 生效。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06119": {
    "status": "simplified",
    "note": "实现说明（非缺口）：掩藏地点的翻面行动是引擎原生的 flipVeiled（moves.js 枚举 + dispatch.js 结算）；本章 behavior 只通过 veiledFlipped 结算背面故事卡，没有逐卡翻面条目。锚到章节参考卡 06119。\n已由 noEntry 口径覆盖：剧本参考卡 06119 没有单卡条目（reference card，无行为读点），实现 = 本章 definition/behavior 的 manifest.referenceCode；「神迹」计数走 api.markers 的通用命名计数。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "theSearchForKadath#1",
      "theSearchForKadath#2"
    ]
  },
  "06155": {
    "status": "simplified",
    "note": "未实现：「对你所在地点其他调查员造成的伤害和/或恐惧，可以分配给森哲夫」——引擎的盟友吸收只覆盖控制者本人的伤害/恐惧，没有跨调查员重定向读取点。被击败时的[[道具]]支援搜索（弃牌堆 / 牌库顶 9 张、搜牌库后混洗）已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06156": {
    "status": "simplified",
    "note": "近似实现：当前在「你抽到一张诡计」的 encounterDrawn 窗口快速打出，取消这张诡计本次的显现效果；未实现：①「结算诡计效果后、将要弃掉时」这个打出时机（引擎没有该窗口）；②把该诡计附属到本卡并只取消后续同名副本（没有「已结算诡计附属」的存储/查询原语），因此本卡不会留在场上，取消的是当前这张而不是同名副本。完整原语请求见 artifacts/migration/tde/primitive-requests/w-m2-2-06156-treachery-discard-window.json。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06157": {
    "status": "simplified",
    "note": "未实现：①「只能投入到另一位调查员执行的检定」没有 commit 档案字段（协助投入窗口本身限同地点队友）；②检定失败效果改由投入者结算（无失败效果归属重定向原语）；③「你或执行者抽 2 张」只实现执行者抽 2 张分支。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06159": {
    "status": "simplified",
    "note": "未实现：「如果你手中有多张同名手牌，检查手牌上限时其只计作一张」——引擎 handSize 读点只支持静态修正，没有按手牌内容动态计算的手牌上限读取点；「抽到与手牌同名的牌后横置血清抽 1 张」已实现（cardDrawn 窗口 + 横置费）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06160": {
    "status": "simplified",
    "note": "未实现：①「本回合击败总计生命值 ≥6 点的敌人」的前置条件（引擎没有回合内的击败历史读取点，打出的时机只由 ownTurn 约束）；②「结局结算经验时额外 +1 经验」（经验值在战役层结算，没有 ctx.api 写入口）。「加入胜利区、立即结束你的回合」已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06162": {
    "status": "simplified",
    "note": "未实现「本次检定成功且至少超过该资源数量」的差额门槛（额外成功结算段只支持固定效果，读不到成功超出点数），当前实现为：检定成功即返还押注数量的资源；押注本身（0–3、受资产剩余资源与 3 上限限制）与成功返还均已接线。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06164": {
    "status": "simplified",
    "note": "未实现：「无形」中「敌人不能与你交战或被与你交战」「你不能对敌人造成伤害」——引擎没有交战/伤害两处的禁止读取点（只有 capability:fight 能挡住主动攻击）；意志闪避、成功解除所有交战、直到本轮结束不能攻击（持续效果）已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06166": {
    "status": "simplified",
    "note": "未实现：仅在「基础攻击行动期间投入」才获得 [combat][combat] 与 +2 伤害的限定（conditionalIcons 没有检定行动类型条件）；额外图标未写，+2 伤害按「成功超出难度 ≥2」对所有战斗检定生效。每次技能检定最多投入 1 张已由 maxPerTest 生效。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06167": {
    "status": "simplified",
    "note": "构筑层效果（牌库张数 +5、牌库构建选项 +1 张任意职阶等级 0 卡）由主进程在构筑/可用性层接线；本卡对局内无行为，卡面 permanent:true 由开局流程处理。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06168": {
    "status": "simplified",
    "note": "剧本/单卡简化：剧本参考卡 06168 的混乱符号「[cultist]：再揭示一个标记」没有剧本级「额外揭示一个混乱标记」原语；chaos.js 按简单/普通与困难/专家两档固定数值近似。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "aThousandShapesOfHorror#2"
    ]
  },
  "06193": {
    "status": "simplified",
    "note": "单卡简化：「强制 - 另一张卡进入你的威胁区域后，选择并弃掉 1 张手牌」没有「卡进入威胁区」的引擎读点；其余子句（显现进威胁区、[action] 意志（3）弃掉本卡）已实现。落在 06193 单卡条目 note（simplified）。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "aThousandShapesOfHorror#1"
    ]
  },
  "06195": {
    "status": "simplified",
    "note": "未实现：「本次攻击期间揭示了 +1、0 或 [elder_sign] 混乱标记时 +2 伤害」——doFight 只支持固定伤害加值，没有按揭示标记条件加伤害的选项；使用(5子弹)、花 1 子弹攻击、本次攻击 +2[combat] 已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06196": {
    "status": "simplified",
    "note": "未实现：「从你所在地点移动到连接地点」的出发地判定——move 窗口上下文只带目标地点，没有移动前所在地点（需要移动窗口补充来源地点的新原语，P10 前处理）；改为判定「目标地点与安全护卫持有者所在地点相连」。跟随移动本身已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06197": {
    "status": "simplified",
    "note": "未实现：「本次检定结束后，如果检定成功，不将该技能弃掉，改为加入手牌」——已投入的牌在检定收尾统一弃掉，commit 流程没有「按检定结果决定投入牌去向」的读点（P10 前补原语）。其余（快速窗口、查牌库顶 9 张、找出[[精通]]技能投入、其余洗回）已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06199": {
    "status": "simplified",
    "note": "未实现：「将 3 张三条A投入同一次技能检定 → 该检定自动成功（不抽混乱标记），然后抽 3 张牌并获得 3 资源（每次检定最多一次）」——commit 档案没有「按同名投入张数触发自动成功/奖励」的读点（P10 前补原语）。已实现：同名多张可同时投入（maxPerTest: 3）与每张 1 个万能图标的投入结算。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06203": {
    "status": "simplified",
    "note": "未实现/简化：「你从手牌中弃掉月石后」没有「某张手牌被弃掉后」的窗口；改用弃牌前的 wouldDiscardFromHand 窗口，把月石从手牌打出并取消这次弃牌效果。弃 1 张时与印刷等价；弃 N（>1）张时其余弃牌也被取消。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06204": {
    "status": "simplified",
    "note": "未实现：「在基础调查行动期间投入时获得 [intellect][intellect]」——commit 档案的 conditionalIcons 没有「检定来自基础调查行动」的条件键（只有生命/手牌/资源/毁灭/控制特性等条件）；已实现：每次检定最多投入 1 张 + 成功超过难度 2 点时额外发现 1 个线索。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06214b": {
    "status": "simplified",
    "note": "实现说明：06214b「下船」的翻面结算由本章 behavior 的 offTheGalley 流程完成（按翻面瞬间线索数二选一）；本卡由 06214 月兽帆船翻面时读出，无独立翻面行动条目。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "darkSideOfTheMoon#1"
    ]
  },
  "06235": {
    "status": "simplified",
    "note": "未实现：「如果本次检定成功，获得 2 资源；若领导力投入到另一位调查员的检定，该调查员也获得 2 资源」——commit 档案的 onSuccess 读点没有 gainResources 字段（P10 前补原语）；投入时获得 [willpower][wild] 的图标句已由引擎 leadership 读点实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06236": {
    "status": "simplified",
    "note": "未实现：「你在隐藏值至少为 4 的地点时，你的梦的本质获得[wild][wild]」——梦的本质是绑定技能卡（06113），跨卡的条件投入图标修正没有读点（commitIcons 的授予只作用于声明者自身）。已实现：研究完成记录门控（researchRequirement）与回合开始检索绑定卡的反应。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06237": {
    "status": "simplified",
    "note": "未实现：「你与敌人交战时，你的梦的本质获得[wild][wild]」——梦的本质是绑定技能卡（06113），跨卡的条件投入图标修正没有读点。已实现：研究完成记录门控（researchRequirement）与回合开始检索绑定卡的反应。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06238": {
    "status": "simplified",
    "note": "未实现：「你有至少 8 张手牌时，你的梦的本质获得[wild][wild]」——梦的本质是绑定技能卡（06113），跨卡的条件投入图标修正没有读点。已实现：研究完成记录门控（researchRequirement）与回合开始检索绑定卡的反应。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06239": {
    "status": "simplified",
    "note": "未实现（主效果）：「你连续执行同一种行动两次后，横置快手：再执行一次该种行动」——引擎没有行动类型历史/本次行动类型的窗口上下文，也没有「按行动类型受限的额外行动」原语。已实现：每位调查员仅限 1 张（limitPerInvestigator）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06240": {
    "status": "simplified",
    "note": "未实现：「投入后从牌库顶揭示直到揭示一张可投入的[rogue]技能并投入，其余洗回」——本卡投入后已离手，committedCard 窗口的能力源枚举看不到刚投入的牌，没有「投入后自我触发」的读点。已实现：作为技能卡的投入图标。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06241": {
    "status": "simplified",
    "note": "简化/未实现：(1)「最多 3 张增强自我共占 1 个法术槽位」用 restrictedSlots（arcane + [[仪式]]受限额外槽，count 1）近似——3 张同名可同时在场且基本只占 1 个法术槽，但其它[[仪式]]支援也会吃到这份受限容量；(2)「每当有卡牌效果要求你用 willpower 代替 combat 时可忽略」——引擎没有忽略属性替代的读点；(3) 每套牌库仅限 1 张（同名）由构筑层处理。已实现：[free] 横置：本次检定 +2 战斗。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06242": {
    "status": "simplified",
    "note": "简化/未实现：(1)「最多 3 张增强自我共占 1 个法术槽位」用 restrictedSlots（arcane + [[仪式]]受限额外槽，count 1）近似——其它[[仪式]]支援也会吃到这份受限容量；(2)「每当有卡牌效果要求你用 willpower 代替 agility 时可忽略」——引擎没有忽略属性替代的读点；(3) 每套牌库仅限 1 张（同名）由构筑层处理。已实现：[free] 横置：本次检定 +2 敏捷。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06243": {
    "status": "simplified",
    "note": "简化/未实现：(1)「最多 3 张增强自我共占 1 个法术槽位」用 restrictedSlots（arcane + [[仪式]]受限额外槽，count 1）近似——其它[[仪式]]支援也会吃到这份受限容量；(2)「每当有卡牌效果要求你用 willpower 代替 intellect 时可忽略」——引擎没有忽略属性替代的读点；(3) 每套牌库仅限 1 张（同名）由构筑层处理。已实现：[free] 横置：本次检定 +2 智识。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06244": {
    "status": "simplified",
    "note": "未实现（主效果）：「你花费[[法术]]支援的至少 1 充能后，横置特薇拉：在该支援上放置 1 充能」——引擎没有「充能被花费后」的窗口/上下文（扣充能发生在费用支付里，不进入任何窗口）。卡牌本身作为[[盟友]]支援的入场/槽位/费用按印刷数据结算。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06245": {
    "status": "simplified",
    "note": "未实现/简化：「只能从弃牌堆打出」已通过 playableFromDiscard 声明（普通出牌路径仍允许从手牌打出——没有按区域拒绝手牌打出的读点）；「包括本卡牌」——正在打出的这张在结算期间不在任何区域（收尾才进弃牌堆），没有「打出的事件改为加入手牌」的读点，因此本张不进手牌，其余弃牌堆中的希望微光都会回到手牌。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06246": {
    "status": "simplified",
    "note": "未实现：①「仅在基础躲避行动期间投入时」+2 敏捷图标（conditionalIcons 无检定来源条件，现按恒真条件近似为每次投入都给）；②检定成功且超过难度≥2时自动躲避另一敌人的成功后结算（commit 档案只有 icons / conditionalIcons / onSuccess 数据键，无自定义成功后结算）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06247": {
    "status": "simplified",
    "note": "近似：「查看遭遇牌库顶并任意顺序放回」没有 peek/排序原语；探查山谷按「弃掉至多一半遭遇牌库顶」近似，已同载 behavior.scenarioApproximations。章节级理由锚到剧本参考卡 06247。\n近似：「把敌人正面朝下附属到理查德·皮克曼」没有附属敌人到支援的状态形状；用 scenarioFlags 计数 + removeEnemyFromGame 近似（06266 条目 note 已登记）。章节级理由锚到剧本参考卡 06247。\n近似：「打乱各张漆黑之海的位置」没有地点位置/标签概念；只做线索平均分配与重置可翻面，位置打乱用固定实例顺序表达。章节级理由锚到剧本参考卡 06247。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "pointOfNoReturn#1",
      "pointOfNoReturn#2",
      "pointOfNoReturn#3"
    ]
  },
  "06271": {
    "status": "simplified",
    "note": "生成地点/失败涌动已由共享 spawnLocation/spawnFailed 数据分派；「移动时所有隧道地点视作互相连接」需要 enemyConnections 读点（引擎无内容通道）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06273": {
    "status": "simplified",
    "note": "生成地点已由共享 spawnLocation 数据分派；「攻击时伤害/恐惧二选一」需要敌人攻击结算的内容读点（引擎无通道）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06277": {
    "status": "simplified",
    "note": "简化：卡面为 [reaction]（可选），但引擎里能在「取消判定之前」拿到 effect 数据体（cancelSymbolToken）的唯一通道是 forced 描述子 + legacyReaction，因此有充能时揭示符号标记会自动取消（不问询）。取消标记、治愈 1 伤害/1 恐惧、无充能时强制交换回空虚项链均已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06278": {
    "status": "simplified",
    "note": "未实现：被查找到时「放入游戏区域并强制投入下一次符合条件的技能检定；该检定成功则抽 1 张」（searchedCardRule 只支持 take/discard/cancelSearch/discoverClue/drawEncounter 固定动作，无自定义结算）。现近似为查找时可选择把这张牌加入手牌。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06282": {
    "status": "simplified",
    "note": "未实现：卡面「行动外（except during an action）」的使用限制——引擎没有「是否正在结算一次行动」的通用读点，现允许在任意时点（自己回合内）横置发动。其余效果（额外费用检索脱缰野兽洗回牌库、基础值 5 的攻击/调查）已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06283": {
    "status": "simplified",
    "note": "未实现：多张受召猎犬在场时由玩家选择哪一张被放到一边（现取第一张）；「放到一边」进入 setAside（不是 06282 的绑定集合）；无猎犬时的「不生成」用移除刚生成敌人的方式近似。主要分支（有猎犬→猎犬离场、脱缰野兽与猎犬持有者交战）已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06285": {
    "status": "simplified",
    "note": "未实现：卡面主效果「揭示 [tablet]/[elder_thing]/[elder_sign] 时改为使用以下效果（-1 并让黑猫受到 1 点直接伤害/恐惧；+5 并治愈黑猫全部伤害与恐惧）」——引擎没有把符号效果替换为卡面自定义值的读点（setSymbolEffect 只服务 05033 的取消/再结算候选）。已实现的数据通道：[[盟友]]槽位、2 个万能图标、特性均来自 cards-data。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06286": {
    "status": "simplified",
    "note": "近似：真形合成后的关键词由 definition 的 Enemy 数据读取（Hunter/Alert/Massive/Retaliate）；「获得全部关键词」不含非关键词能力。章节级理由锚到剧本参考卡 06286。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "whereTheGodsDwell#3"
    ]
  },
  "06306": {
    "status": "simplified",
    "note": "表示层/桌面约定：06306–06310「这张卡牌在你手牌中且未揭示时，如果你提到它，则你发疯」是桌面口头约定，没有可机械化读点。锚到 5 形态中首个 06306。\n设计差异：Hidden 敌人（奈亚拉托提普 5 形态）的通用「手牌中攻击/躲避」入口被 canFightHidden/canEvadeHidden 关闭；参考实现只允许通过塔/幕/行动揭示并结算，不存在通用攻击。锚到 06306。",
    "sources": [
      "P8-gap"
    ],
    "gaps": [
      "whereTheGodsDwell#1",
      "whereTheGodsDwell#2"
    ]
  },
  "06324": {
    "status": "simplified",
    "note": "未实现：①「与你游戏区域的书籍支援互换」（引擎没有把附属卡移回支援区的通用 API，现只支持从支援区附属一张书籍）；②「结算附属书籍的 [action] 能力后横置她再结算一次」（引擎不把附属卡的 [action] 能力列入能力源，无法挂 reaction）。已实现：附属一张[[书籍]]支援到阿比盖尔（仅限 1 张），且附属后不再占用槽位。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06325": {
    "status": "simplified",
    "note": "未实现：①仅当「本次检定是对诡计卡牌的检定」的条件；②成功后把该诡计加入胜利区并把真理之眼附属到它上面；③附属期间为「该诡计的同名卡牌」的每次检定提供 4 个万能图标（commit 档案没有检定来源条件与成功后自定义结算读点）。已实现：投入时按卡面提供 4 个万能图标。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06327": {
    "status": "simplified",
    "note": "失败误伤分支的最大值沿用引擎读点写死的 5（01029 的 successDamage/failByAmountToEngaged 共用实现），卡面写 6；成功伤害（1–6）与「不造成标准伤害」已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06328": {
    "status": "simplified",
    "note": "以「本次检定技能值改为意志值」近似「改为检定意志」（引擎没有替换本次检定技能的 API；pendingBonus 读点只改检定值，不改变 test.skill 本身）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06329": {
    "status": "simplified",
    "note": "未实现失败分支：①「检定失败则取消打出该卡牌，不支付任何费用（包括行动费用）」——beforePlayCost 窗口没有取消整次打出的引擎字段；②「直到本轮结束不能打出该卡牌及其同名卡」。成功分支已实现：横置自身 + 意志(X) 检定，成功则本次资源费用视为已支付（costReduction = cost）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06330": {
    "status": "simplified",
    "note": "简化：「3 张梦境寄生物附属到噩梦球」用手牌代表附属（引擎无法把 attachments 里的卡再移回牌库/场外）。取消 [auto_fail] 标记、洗一张梦境寄生物入牌库、离场时把副本收回场外集合均已实现。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06331": {
    "status": "simplified",
    "note": "未实现：①「本技能的图标不加入技能值、改为减去」（引擎无负技能图标读点，现按普通 2 个万能图标计入）；②「在手牌中必须投入下一次技能检定（如可能）」的强制投入；③检定失败受到 1 伤害 + 1 恐惧（commit 档案没有失败后自定义结算读点）。P3 escape 已登记（负图标 + 强制投入）。",
    "sources": [
      "P7"
    ],
    "gaps": []
  },
  "06337": {
    "status": "simplified",
    "note": "引擎没有「中心牌面/Global 敌人」实体：阿特拉克·纳克亚在幕 2 推进前不生成实体（其翻面生成在 06338 的 advance.flipAtlachNacha 里）；参考实现的「旋转中心牌」近似为旋转四条腿（幕 2）与敌人本身（幕 3）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06346": {
    "status": "simplified",
    "note": "躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）；离开地点与击败标记已实现。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06347": {
    "status": "simplified",
    "note": "躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06348": {
    "status": "simplified",
    "note": "躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06349": {
    "status": "simplified",
    "note": "躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06350": {
    "status": "simplified",
    "note": "躲避替代的「不能攻击所选调查员」缺引擎读点：实现为不横置 + 本轮不攻击任何人（见 primitive-request w-p8-f-evade-protection）。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  },
  "06354": {
    "status": "simplified",
    "note": "蜂拥/头领卡在引擎里是头领敌人的附属卡（不是独立敌人实体），只由头领发起一次攻击；「每张蜂拥卡各攻击一次」未逐卡重演。",
    "sources": [
      "P8-card"
    ],
    "gaps": []
  }
}

// P8 的 12 条 behavior.scenarioGaps 落卡映射（来自 audit/tde-scenario-gap-triage.json）：
// chapterId → 受影响卡号（必须都是 simplified）。章节级 gap（无法落到单卡时）锚到该章的
// 剧本参考卡/机制核心卡，note 写明章节级理由。
export const TDE_SCENARIO_GAP_CARDS = {
  "beyondTheGatesOfSleep": [],
  "wakingNightmare": [
    "06063"
  ],
  "theSearchForKadath": [
    "06119"
  ],
  "aThousandShapesOfHorror": [
    "06168",
    "06193"
  ],
  "darkSideOfTheMoon": [
    "06214b"
  ],
  "pointOfNoReturn": [
    "06247"
  ],
  "whereTheGodsDwell": [
    "06286",
    "06306"
  ],
  "weaverOfTheCosmos": []
}

// P8 的 12 条 gap 逐条评审账本（与 behavior.scenarioGaps 原文一一对应）。
export const TDE_SCENARIO_GAP_TRIAGE_FILE = 'audit/tde-scenario-gap-triage.json'

// P6 调查员简化 = 0：P6 的 3 处历史简化（卢克 asIfEvent、梦境之门 06013/06014、06017 隐私敌人）
// 已在 P6/P8 还账，条目无 simplified 标记；audit/tde-investigators.json 的 simplified 也为 []。
export const TDE_P6_SIMPLIFICATION_CODES = Object.freeze([])

// 10 条 noEntry 记录（P8 口径：8 张剧本参考卡 + 2 张背面故事面）：
// 它们没有一卡一文件的单卡条目，但都在章节 definition/behavior 里有实现落点，逐卡测试按
// 「剧本参考卡 = 本章 definition/behavior」「背面故事面 = 主卡翻面流程 + 章节行为」验收。
export const TDE_NO_ENTRY_CODES = Object.freeze([
  '06039', '06063', '06119', '06168', '06206', '06247', '06286', '06333', '06057b', '06058b',
])
export const TDE_NO_ENTRY_REASONS = Object.freeze({
  '06039': '剧本参考卡：实现 = Beyond the Gates of Sleep 章节 definition/behavior（manifest.referenceCode）',
  '06063': '剧本参考卡：实现 = Waking Nightmare 章节 definition/behavior（manifest.referenceCode）',
  '06119': '剧本参考卡：实现 = The Search for Kadath 章节 definition/behavior（manifest.referenceCode）',
  '06168': '剧本参考卡：实现 = A Thousand Shapes of Horror 章节 definition/behavior（manifest.referenceCode）',
  '06206': '剧本参考卡：实现 = Dark Side of the Moon 章节 definition/behavior（manifest.referenceCode）',
  '06247': '剧本参考卡：实现 = Point of No Return 章节 definition/behavior（manifest.referenceCode）',
  '06286': '剧本参考卡：实现 = Where the Gods Dwell 章节 definition/behavior（manifest.referenceCode）',
  '06333': '剧本参考卡：实现 = Weaver of the Cosmos 章节 definition/behavior（manifest.referenceCode）',
  '06057b': '背面故事面：无单卡条目；谈判/击败分支由 06057 敌人条目翻面流程 api.cardFlip 展示正文',
  '06058b': '背面故事面：无单卡条目；谈判/击败分支由 06058 敌人条目翻面流程 api.cardFlip 展示正文',
})

// 万象无终（The Circle Undone）逐卡验收备注注册表。
//
// 这是**人工/AI 逐卡行为审计的补充说明**，不是验收状态的事实源：逐卡自动测试状态由
// `tools/audit-tcu-all-cards.mjs` 实跑 `TCU <code>` 测试后写进
// `audit/tcu-all-card-acceptance.json` 与 `src/cards/tcu-campaign-acceptance.js`。
// 逐卡「印刷描述 vs 实现」的完整行为审计结论（match/approximation/gap 与逐条证据）在
// `audit/tcu-card-behavior-audit.json`；本文件是它的摘要，供全卡账本的 note/noteStatus 与
// audit/tcu-migration.json 的 remaining 使用。
//
// 键 = 05xxx 卡号（含 34 个关联面 05xxxa/b… 的卡号）；
// 值 = { status: 'verified' | 'simplified', note: string }。
//   · verified   —— 逐卡行为审计为 match（未登记即视为 verified）；
//   · simplified —— 行为审计发现显式近似或未实现子句（gap），note 写清差异/缺口；这些卡仍进
//                   earlyAccess 的 remaining，不宣称规则等价。
//
// 生成：node develop/p10-card-audit-notes.mjs --write（由 audit/tcu-card-behavior-audit.json 派生）。
export const TCU_CARD_ACCEPTANCE_NOTES = {
  "05001": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：触发面窄于卡面：反应只挂在 healHorrorFrom 这一个治疗入口上，而『投入后检定成功治愈恐惧』这一类卡牌效果（如 01067 无所畏惧，卡洛琳构筑明确允许的『heal horror』卡）在 src/engine/skill-effects.js:170-174 直接写 inv.horror，不经过 horrorHealed 窗口，因此卡洛琳不会获得资源。旧印与构筑部分与卡面一致。 子句：你的卡牌效果治愈调查员/盟友恐惧后，控制者得1资源（近似）"
  },
  "05002": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『如同它是你的手牌』用『把揭示的那张直接放进手牌』建模（src/engine/hunch-deck.js:148-160 注释），代价是这张牌在本阶段同时可按手牌投入技能检定或被弃牌效果取走，而卡面只允许『打出』；-2 费、阶段结束洗回、旧印、悬案改道与构筑配额与卡面一致。 子句：调查阶段开始：揭示直觉牌库顶，本阶段可按-2费打出（近似）"
  },
  "05003": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：资源寄存是显式写法差异（src/engine/resource-bank.js:10-17 注释）：获得的资源同时记在资源池与家族遗产上，卡面『不放进资源池』只剩寄存标记；回合结束按 min(寄存量, 现有资源) 扣回，因此当池里混有非寄存资源时会比卡面多流失（例：池 5、寄存 4，花 3 后回合结束实际流失 2，卡面应为 1）。另外旧式 effect:{type:'gainResource'}（src/engine/effects.js:122-127）不经 api.gainResources，不会被寄存。 子句：从卡牌效果获得资源：不放进资源池，改放家族遗产（近似）"
  },
  "05007": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①反应的目标类型放宽：卡面要求『治愈调查员的恐惧』，而 healHorrorFrom 对盟友支援也返回控制者座位（src/engine/harm-threat.js:565-577 healedSeat=owner.seat），因此在治疗盟友支援时这个反应也会触发，并把额外 1 点治到调查员身上而不是支援上；②『该效果额外治愈1点』做成再开一次 api.healHorror，会让同一次治疗出现第二个 horrorHealed 窗口（卡洛琳的反应可能因此重复结算）；③整张卡没有任何逐卡测试（tcu-investigators.test.mjs 只把 05007 当治疗来源卡号用），本次审计用探针实跑确认行动与反应都能工作。 子句：[反应]你的其他卡牌效果治愈调查员恐惧后，横置：额外治愈1（近似）"
  },
  "05008": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：把卡面的『may（可以把治疗改到理性思考上）』实现成『强制先吸收』：src/engine/harm-threat.js:540-551 只要其上有恐惧就把任何治疗改到它身上，玩家无法选择直接治疗卡洛琳本人；tests/tcu-investigators.test.mjs:246-257 断言的正是这个强制口径（恐惧 0、理性思考 4→3）。 子句：其上的恐惧可以如同在卡洛琳身上一样被治愈（近似）"
  },
  "05009": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目显式简化（src/cards/entries/05009.js:19-20 note）：『「最多 2 张[[工具]]支援不占用双手槽位」未实现（现有手部槽位读点不支持按特性分组），其余效果已实现』。其余三句（4 子弹、+1 战斗/+1 伤害、击败后回收洞察事件）都有实现，但『击败后回收』分支没有测试断言。 子句：最多2张[[工具]]支援不占用手部槽位（未实现）"
  },
  "05010": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目显式简化（src/cards/entries/05010.js:15-16 note）：『「游戏结束时少取得 2 点经验」只记录 inv.unsolvedCasePenalty 标记，经验结算读点属 P9/P10』。补充审计发现：①放线索只考虑已揭示地点、平局按 id 排序而不是玩家选择；②该 resolve 只在 weakness 结算时运行，而悬案的正常去向是『改为进入威胁区域』（src/engine/hunch-deck.js:170-175），进城后既不能打出（弱点需 playableWeakness，src/engine/actions.js:79）也没有威胁区行动，『放线索+移出游戏』在标准流程里不可达；③移出游戏只写 state.removedFromGame，卡随后仍被放进弃牌堆。 子句：将你的1个线索放到隐藏值最高的地点（近似）；本局游戏它获得：游戏结束时乔少取得2经验（未实现）"
  },
  "05011": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：资源寄存采用合并模型（src/engine/resource-bank.js:10-17 注释）：卡上的资源同时留在 inv.resources 里，[行动] 只是清掉『寄存』标记而不是真的搬进资源池；回合结束按 min(寄存量, 现有资源) 弃掉，只有寄存资源时与卡面等价，混有非寄存资源时会多流失。 子句：[行动]：把本卡上的所有资源移动到你的资源池（近似）"
  },
  "05012": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目显式简化（src/cards/entries/05012.js:13-14 note）：『「游戏结束时仍在你手牌中则承受 1 点精神创伤」在本引擎里没有可达状态（弱点抽到即结算），只实现「移出游戏」』。补充：移出游戏只写 state.removedFromGame，卡仍会随结算进入弃牌堆。 子句：强制：游戏结束或退场时若仍在你手牌，受1精神创伤（未实现）"
  },
  "05013": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目显式简化（src/cards/entries/05013.js:16-17 note）：『「可以把黛安娜底下的事件/技能当作手牌打出或投入」未实现（需要 beneath 打出通道），其余效果已实现』。补充：卡面是『you may use willpower instead of combat』，实现强制使用意志（黛安娜意志 1 < 战斗 3 时是净损失），且这条攻击没有任何逐卡测试。 子句：[行动]：攻击，可以用意志代替战斗（近似）；可把黛安娜底下的事件/技能当手牌打出/投入（额外费用横置）（未实现）"
  },
  "05014": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺一条子句：卡面『抽遭遇卡或弱点』里只有遭遇卡分支有实现（encounterDrawn 窗口）；从玩家牌库抽到弱点没有任何可取消窗口（src/engine/weakness.js:49 resolveWeakness 直接结算，src/engine/encounter.js 只对遭遇牌库开窗），因此『抽到弱点时打出黑暗洞察』打不出来。条目注释（src/cards/entries/05014.js:9-11）自称『该分支登记在 remaining 里』，但 audit/tcu-scenario-acceptance.json 的 remaining 中没有任何 05014 记录，属于未登记缺口（题目要求的 simplified:true + note 也没有）。 子句：快速；所在地点调查员抽遭遇卡或弱点时打出（未实现）"
  },
  "05018": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：第 4 句没有实现路径：05018 是 reactionOnly，只能在 agendaWouldAdvance 反应窗口打出，走 assets.js:329-359 的 playReactionCard；该路径结算完固定 disposePlayedEvent(inv, code)（assets.js:358）把事件放进弃牌堆，descriptor.exileAfterPlay 完全不会被读（只有 actions.js:246-292 的 doPlay 收尾段读它并调 exilePlayerCard）。实际结果是「进弃牌堆」而非「移出游戏」。前 3 句（玛丽专属、快速/阈值前窗口、本阶段阈值锁定）已实现；无逐卡 TCU 用例（testRefs 空）。 子句：将神秘乐曲从游戏中移除。（未实现）"
  },
  "05019": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：两条缺失：①「强制 - 任意数量伤害放到同地点调查员时额外 1 点伤害」完全没有实现（条目无 forced，引擎无 05019 读点）；②「少于 3 个毁灭标记时不能离场」条目 note 已登记未实现（cannotLeavePlay 是布尔常量，且 removeThreat 不读它，01009 式 counters 保护也不适用）。另两处近似：③「放置入场」被实现为进入威胁区而非支援区（盟友槽仍计入）；④威胁区卡在重整阶段不复位（phases.js:76 仅 inv.assets），[fast] 横置能力实际只能使用一次，3 个毁灭的弃掉分支很难到达。横置/放毁灭/3+ 弃掉的机制本身已实现。无逐卡 TCU 用例（testRefs 空）。 子句：显现 - 将安息日男爵放置入场。（近似）；他身上有少于3个毁灭标记时，他不能离场。（未实现）；强制 - 伤害放到同地点调查员时：额外1点伤害。（未实现）；[free]横置：在安息日男爵上放置1个毁灭标记。（近似）"
  },
  "05021": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：卡面允许附属到同地点任意调查员，本实现只附属到自己；神话阶段结束的「花 2 资源或弃掉」简化为直接弃掉（forcedMythosEndDiscard，无花资源选项）。已实现快速打出、受伤害/恐惧时弃掉并取消该次全部伤害与恐惧。 子句：附属到你所在地点的一位调查员（其控制下）（近似）；强制-神话结束：花2资源或弃掉（近似）"
  },
  "05029": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现「把本次检定的技能类型改为资源技能检定」（没有替换技能类型/投入图标的读点），只把基础技能值改为 floor(资源/2)；检定显示与可投入图标仍按原技能结算。 子句：改为资源技能检定（替换技能类型）（未实现）"
  },
  "05032": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现取消「弃手牌 / 失资源 / 失行动」三项（引擎缺通用取消读点）；触发范围放宽为任意伤害/恐惧来源，且一次可同时取消伤害与恐惧；已实现快速打出并取消本次伤害和/或恐惧。 子句：快速；遭遇卡/敌人攻击致弃手牌、失资源、失行动、受伤或恐惧时（近似）；选择一项并忽略该效果，其他效果如常（近似）"
  },
  "05033": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：①「额外结算一次该效果」未实现；②「取消该效果」近似为取消该符号标记本次的效果（含修正值），没有「卡牌符号触发效果」的通用取消窗口；③ [auto_fail] 符号没有可打出的窗口。 子句：快速；[mystic]卡符号触发效果结算时打出（近似）；取消该效果（近似）；或额外结算一次该效果（未实现）"
  },
  "05036": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺第 1 句：「每位调查员仅限 1 张[[鞋子]]」没有实现路径——条目未声明限额（src/cards/entries/05036.js:19-24），引擎限额读点只按同名卡号判定（src/engine/moves.js:545-546、src/engine/play-condition.js:102），全仓没有按特性分组的场上限额原语（grep Footwear 只命中 cards-data 文本），条目 note 亦自述「未校验」。另：反应时机在自动交战之后（src/engine/movement.js:223 先于 :245），相对卡面「交战之前」是放宽，条目 simplified:true + note 已登记。+1 敏捷、横置费用、敏捷(3) 检定、成功后移动到连接地点均已实现并有断言（tests/tcu-player-m2-1.test.mjs:438-455）。 子句：每位调查员仅限1张[[鞋子]]（未实现）；移动后、新地点敌人交战前，横置钉鞋（近似）"
  },
  "05037": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：额外费用只在 resolve 内支付且没有打出前置校验：条目无 playCondition（读点 src/engine/moves.js:507-510 / src/engine/play-condition.js:121-134），没有合法[[道具]]时事件仍可打出（src/cards/entries/05037.js:37 只写一条 info 就返回），且弃置发生在打出之后；顺序上先弃道具再找敌人（:31-59），若同地点只有冷漠敌人或缺席，道具已弃却没有攻击（冷漠拦截在 src/engine/combat.js:118）。其余两句已实现并有断言：+X 战斗与 +1 伤害（:63-68）、成功且弃自场上返还 X 资源（:69-72）。测试只断言伤害=2 与资源 +3，未单独断言 +X 战斗数值。 子句：额外费用：从手牌或场上弃掉占≥1手部槽位的[[道具]]支援（近似）"
  },
  "05040": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note：「未实现：技能 +2 的作用域是『该次额外行动期间』，本实现放宽为『本回合结束前』（持续效果没有单次行动作用域）」，已实现流放自身、本回合额外 1 次行动、开局起始手牌放置入场。差异：+2 以 endOfTurn 持续效果结算（src/engine/effect-state.js:32、src/engine/turn-flow.js:344 到期），额外行动用掉后本回合其它检定仍有 +2，即使不使用额外行动也照样 +2；卡面只在该次额外行动期间生效。 子句：该次行动期间你得到每项技能+2（近似）"
  },
  "05041": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：平局失败用「wouldSucceedTest 窗口把 context.testBonus 减 1」实现（src/cards/entries/05041.js:27-32；读点 src/engine/tests.js:796-804 在成功判定前并入）：成功/失败结果与卡面一致，但记录值变成难度-1、failedBy 记为 1 而不是 0（src/engine/tests.js:912），按失败差值结算的其它效果会看到 1 点差距；同一窗口内若另有能力加值，理论上可把平局拉回成功。作用范围（持有者所在地点的所有调查员，含本人）与卡面一致，测试覆盖本人 + 同地点队友（tests/tcu-player-m2-1.test.mjs:535-558）。 子句：你所在地点的调查员检定平局改为失败（近似）"
  },
  "05042": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现开局抽到后「必须留在起始手牌」——setup.drawOpeningHand 把起手抽到的基础弱点洗回牌库（src/engine/setup.js:127-139），cannotMulliganAway 只作用于换牌候选（src/engine/tarot-slot.js:77-85）；现实现让任意抽牌通道抽到的它留在手牌（src/engine/deck-ops.js:369-372）。另：投入封锁只对检定发起者生效（src/engine/tests.js:209 只判 owner === inv），双人局中持有高塔的调查员仍可为队友的检定投入卡牌（已用 core-fixture 双人局面复现）。 子句：开局抽到（含重调后）不能替换，必须留在起始手牌（未实现）"
  },
  "05044": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：议程无 revert 原语：以「保持 1a + 直接结算 1b 记录」等价承载（已登记 scenarioApproximations）；1b 击败来源用同轮最近攻击者 + 议程伤害标记近似（已登记）。数值/阈值/二选一/四分支记录主路径已实现。 子句：强制：任何调查员被击败时必须推进此密谋（近似）；被幽灵看守人击败→被看守人抓走（近似）；被[[怪物]]敌人击败→被幽灵夺走性命（近似）；≥7毁灭且因 1a 强制伤害/恐惧被击败→消失在迷雾中（近似）；然后翻回密谋1a（近似）"
  },
  "05045": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「你被追捕」按本仓库既有记录类型（youAreBeingHunted = 被追捕座位 string[]）写入，参考实现是 boolean；已登记 scenarioApproximations。1b 正常流程不可达（幕无推进条件，参考实现注释同样如此）。 子句：在剧本日志记录「你被追捕」（近似）"
  },
  "05046": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺口一条：「即便该次攻击被取消」。攻击在 enemyAttack 窗口被取消（src/engine/enemies.js:128-132，如 01023 闪躲）或敌人「不能攻击」（:115-119）时直接 return，而 enemyAttacked 窗口只在攻击正常结算后于 :172-177 打开，所以被取消的攻击不会让加弗瑞拉发现线索（实测打出 01023 取消后无 05046 选项、线索未加）。docs/tcu-investigators.md:134 把该窗口写成「被取消也算」，与实现不符。其余子句（发现 1 线索、每轮一次、旧印 +1 与治愈、生命/理智、卡背四项设置）均已实现；旧印有逐条断言（tests/tcu-investigators.test.mjs:655-664），反应本身无断言（tests/tcu-prologue.test.mjs 只覆盖设置）。附注（卡面数值/职业，非文本子句）：印刷属性 3/2/4/1 与职业「中立」已应用——src/engine/setup.js 的 prepareInvestigator 故事调查员分支按卡面写 klass/四项技能（不再继承开局调查员），换回时 src/engine/story-investigators.js 用 originals 身份快照恢复原调查员；tests/tcu-prologue.test.mjs 的真实引擎 4 人开局用例逐人断言四人的技能/职业/生命/理智。 子句：即便该次攻击被取消（未实现）；卡背：固定起始手牌 7 张（近似）"
  },
  "05047": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：能力主体已实现（含「同地点他人抽到诡计」：实测双人同地点时座位 1 得到选项并取消成功），判 approximation 的原因是两处形式差异：①「弃掉合计≥2 智力图标」做成逐张交互弃牌，途中可「不弃牌」中止，已弃的牌不回手、诡计也不取消（src/cards/entries/05047.js:44-60；实测弃 1 张后中止＝白弃一张）；②可用性只看手牌非空（:31-34），图标不足时会先弹一次提示再于 :37-39 放弃。另卡背「朦胧之雾附属办公室」用 location.fog/shroudMod 承载（behavior.js:323-330），已在 behavior.js:264 登记。测试覆盖：本卡的反应与旧印都没有逐卡断言（tests/tcu-investigators.test.mjs:645-653 只断言四条登记与旧印存在，:655-693 覆盖 05046/05048；tests/tcu-prologue.test.mjs 只覆盖卡背设置）。附注（卡面数值/职业）：印刷属性 2/4/1/3 与职业「中立」已应用（src/engine/setup.js 的故事调查员分支按卡面写职业/四项技能，生命 4/理智 8 已由新卡号写入；换回时 story-investigators.js 按身份快照恢复），tests/tcu-prologue.test.mjs 的真实引擎 4 人开局用例逐人断言。 子句：弃掉手牌中合计至少 2 个 [intellect] 图标（近似）；卡背：朦胧之雾附属到办公室（隐藏值 +2）（近似）；卡背：无起始游戏区域、固定起手牌 10 张（近似）"
  },
  "05048": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：本批最完整：难度 -1、花 2 资源、每轮一次、旧印 +2 资源都有实现，降难度另有断言（tests/tcu-investigators.test.mjs:675-693，含资源 5→3 与难度 2→1）。判 approximation 的唯一实质差异是时点：卡面是 [fast]「在你执行的技能检定期间」，条目改挂 testBegins 反应窗口（src/cards/entries/05048.js:8-11，docs/tcu-investigators.md:152,160-161 也已登记），等于只能在检定开始、投入前使用，不能像卡面那样在检定过程中稍后决定；此外它经反应提示出现，不在 [fast] 行动列表里。实测同轮第二次检定不再提供（上限账在 src/engine/limits.js:109-145）。附注（卡面数值/职业）：印刷属性 1/3/2/4 与职业「中立」已应用（src/engine/setup.js 的故事调查员分支按卡面写职业/四项技能，生命 5/理智 7 已由新卡号写入；换回时 story-investigators.js 按身份快照恢复），tests/tcu-prologue.test.mjs 的真实引擎 4 人开局用例逐人断言；05048 的起始区域/起手牌在 tests/tcu-prologue.test.mjs:272-279 只断言到 setupCards 键，未逐张断言。 子句：[fast] 在你执行的技能检定期间，花 2 资源：难度 -1（近似）；卡背：恐怖夜色放到密谋牌库旁（近似）；卡背：起始游戏区域「良好人脉」、起手牌 7 张（近似）"
  },
  "05049": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两条近似：①「显现效果期间」用 state._treacheryResolving 判定，只有诡计结算期间为真（src/engine/treachery-tokens.js:60-67 置位/复位），其他来源的显现效果不会置位，条件比卡面窄；②旧印的额外行动只看该标志，不校验「本次确实是技能检定」，且卡面是「你可以」，实现为必然 +1 行动（src/cards/entries/05049.js:22-27 → src/engine/turn.js:345-359 在调查阶段开始给 +1 并清除）。能力本身实测可用：显现期间检定成功发现 1 线索、同轮第二次不再提供、旧印意志 4+1=5 且置位时置 extraActionNextTurn、非显现时不置位。测试：本卡的反应与旧印都没有逐卡断言（tests/tcu-prologue.test.mjs 只覆盖卡背设置，tests/tcu-investigators.test.mjs:655-693 覆盖 05046/05048 而非本卡）。附注（卡面数值/职业）：印刷属性 4/1/3/2 与职业「中立」已应用（src/engine/setup.js 的故事调查员分支按卡面写职业/四项技能，生命 7/理智 5 已由新卡号写入；换回时 story-investigators.js 按身份快照恢复），tests/tcu-prologue.test.mjs 的真实引擎 4 人开局用例逐人断言。 子句：[reaction] 显现效果期间的技能检定成功后：发现 1 线索（近似）；若本次检定在显现效果期间，下回合额外行动一次（近似）；卡背：黑暗中的低语放到密谋牌库旁（近似）；卡背：起始游戏区域 深挖/刀子/手电筒(2 补给)、起手 8 张（近似）"
  },
  "05050": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：差异仅在简单/普通 [elder_thing]：卡面要求「选择已横置或已受到伤害的女巫敌人」，chaos.js:75-77 只按 Witch 特性与地点/连接地点筛选，未过滤已横置/已受伤（参考实现 TheWitchingHour.hs 只筛 exhausted），因此对已重整且无伤害的女巫也会开选择窗口（效果为空操作，净结果不变）。其余数值（-1/-1/-3、-2/-2/-4）与四条失败后果逐条实现：tablet 取弃牌堆最底诡计、skull 简单按失败差额弃顶、skull 困难在揭示时按难度弃顶、elder_thing 困难取全部连接地点女巫。 子句：简单/普通 [elder_thing] -3；失败选择女巫重整治愈（近似）"
  },
  "05051": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「抽1张女巫敌人」以 api.spawn(code, 目标调查员所在地点) 实现（05051.js:32）：src/engine/scenario-runtime.js:197 的 spawn 传入 engagedSeat=null，敌人只会生成在目标调查员所在地点，不会立刻与该调查员交战，要等本次 advanceAgenda 末尾的 autoEngageAll（src/engine/act-agenda.js:214）按猎物优先级补交战——同地点有多名调查员时可能交战到别人，且「draw」的显现归属（drawnBySeat）为空。另外「游戏区域卡牌数」按 assets+threat 计（引擎把威胁区放在 threat），弃牌至 5 张的取端与参考实现一致（牌库顶=pop，弃牌堆顶=末端）。 子句：背面：游戏区域卡牌最多的调查员抽弃牌堆顶女巫敌人（近似）"
  },
  "05052": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「search the collection」被近似为引擎 basicWeaknessPool（核心包 + 本战役已开放包的基础弱点，src/engine/card-defs.js:219-227）中按 Omen/Curse 特性随机取一张；只有候选池为空（或该弱点已在牌库/弃牌堆）时才按卡面改判 1 点精神创伤。顺序（先「被击败」再找弱点）与卡面一致（api.defeat → src/engine/scenario-runtime.js:493 eliminateInvestigator）。 子句：背面：从收藏随机取基础征兆/诅咒弱点入牌库（近似）"
  },
  "05053": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处差异：(1)「tests [willpower] or [agility] (3)」传成双技能数组，引擎把数组当「多技能合成检定」（src/engine/tests.js:114-117 把两项属性相加），实际是意志+敏捷合计对 3，比二选一明显容易；应改为让玩家选一项技能的单技能检定。(2)「不能进入其他调查员面前的地点」只在 move 行动上校验（src/engine/moves.js:650-655 → behavior.moveError），卡牌/剧本效果移动走 relocateInvestigator→movementError（src/engine/movement.js:181），不读本剧本的 moveError，与官方特别规则「即使通过卡牌效果移动也不能进入」不符。其余子句（面前连线、轮末团队支付 2×人数、阿卡姆密林放置与移入、黑山羊/4 人幼崽、笛声 1 洗 2 弃）均已实现；黑山羊经 api.spawn 生成，立刻交战由接下来 autoEngageAll 补齐（测试 293 未断言交战）。 子句：不能进入其他调查员面前的地点（近似）；背面：检定意志或敏捷(3)，成功横置并解除交战（近似）"
  },
  "05054": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「不能进入他人面前的地点」与 05053 同缺陷：只有 move 行动被 moveError 拦截，卡牌/剧本效果移动（relocateInvestigator→movementError）可绕过，与官方特别规则（含卡牌效果移动）不符。背面解锁的判定实际是 behavior.js:249 的 actIndex>=2（05054.js 写入的 scenarioFlags.frontsUnlocked 没有任何读点，属只写标记）。其余子句与印刷一致（2×人数/1×人数成本按印刷线索值）。 子句：不能进入其他调查员面前的地点（近似）"
  },
  "05057": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：印刷数值（生命 4×人数、攻击/躲避 4/4、伤害/恐惧 1/1、胜利 2）由 card-data/definition 提供：healthPerInvestigator:true 由 src/engine/enemies.js:270-272 换算为 4×人数。差异两处：①遭遇牌库不足 3 张时只弃剩余张数，不按规则把弃牌堆洗回后继续弃（同章 05099/05090 共用的 encounter-rules.js:195 discardEncounterTop 有洗回，本卡未用）；②api.spawn 只建敌人实例、不把卡从 encounterDiscard 移除（引擎 spawnEnemy 无此步，见 05089/05090 条目是手工 splice 的），所以被生成的女巫仍留在弃牌堆：05091 的「弃牌堆每个女巫敌人 +1/+1」会重复计入，弃牌堆洗回时还会多出一张复制品。 子句：强制 - 敌军阶段开始后：弃遭遇牌库顶3张（近似）；将因本效果弃掉的女巫敌人生成在她所在地点（近似）"
  },
  "05058": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处差异：(1) [fast]（中文印刷为 [free]）是快速能力，但 moves.push 没有 actions:0，src/engine/turn-flow.js:463 对 scenarioAction 默认按 1 行动收费，实际要花一个行动（对照 src/cards/encounter-entries/thePathToCarcosa/aPhantomOfTruth/03208.js:21 的 actions:0 写法）；(2)「另一处女巫作祟之林」只按「另一名位于任一森林地点的调查员」筛（05058.js:13-14），没有排除与自己在同一处森林的调查员。交换方向、0–3 数量选择与团队每轮一次均已实现。 子句：[fast]与另一处森林的调查员互移最多3点资源（近似）"
  },
  "05059": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺「任意数量线索被发现后」这条触发：实现用 `location.clues > 0` 提前返回（05059.js:20），只有把本地点最后一个线索也发现（clues 归零）后才结算；卡面要求每次从本地点发现线索都结算（发现 1 个就失去 1 点资源，即使地点还有线索）。测试 tests/tcu-witching-hour.test.mjs:498-505 也先把 clues 置 0 再调用，未覆盖非最后一批。其余部分（本地每位调查员、失去等量资源、资源不足时扣到 0）与卡面一致。 子句：强制：本地点任意数量线索被发现后（未实现）"
  },
  "05060": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处差异：(1) 弃牌用 api.discardRandom（src/engine/scenario-runtime.js:516）随机弃一张，卡面是「You choose and discard 1 card from your hand」，应改走同文件 :517 的 api.discardChosen；(2) [fast] 未声明 actions:0，src/engine/turn-flow.js:463 按 1 行动收费；(3) 限次用单章全局 flag，全队每轮只能触发一次，而卡面只写「Limit once per round」（无 Group），应按调查员各一次。另外与 05058 一样未排除「同一处女巫作祟之林」的调查员（05060.js:13-14）。 子句：[fast]你弃1张手牌让对方抽1张，或反过来（近似）；每轮仅限一次（近似）"
  },
  "05062": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：两条子句都没有实现路径：05062 条目只登记了两个数据字段，behavior.canCommitCard/commitIconMultiplier 是直通/恒返回 base 的空转（comment 声称已接线，实际 `encounterRules.canCommitCard`/`commitIconMultiplier` 在 content/campaigns/theCircleUndone/encounter-rules.js 中不存在，`flags.taintedWellInPlay` 从未被写入），引擎投入窗口（src/engine/tests.js:195-199/219）只允许同地点队友协助或持有 remoteCommit 支援的调查员远程投入，不存在「跨地点各投 1 张」的原语。待人工复核：需先新增跨地点投入能力后才能实现。 子句：其他森林地点的调查员可向本地点的检定各投1张（未实现）；反之，本地点的调查员可向其他森林的检定各投1张（未实现）"
  },
  "05063": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：与 05059 同一缺陷：`location.clues > 0` 提前返回（05063.js:20），强制只在清空本地点的最后一次发现后结算；卡面要求每次从本地点发现线索都结算（发现 N 个就让本地每位调查员随机弃 N 张）。随机弃牌与「at random」一致，数量取本次发现的线索数。测试 tests/tcu-witching-hour.test.mjs:498-513 也是先把 clues 置 0 再调用，未覆盖非最后一批。 子句：强制：本地点任意数量线索被发现后（未实现）"
  },
  "05064": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：改道是全自动的：没有 [reaction] 的触发/放弃窗口（卡面为可选反应），也不要求谷仓有调查员；并且章节自己用 api.spawn 生成的敌人（05051/05053/05061，src/engine/scenario-runtime.js:197 传 ignoreSpawn=true）不会经过 spawnLocation（src/engine/enemies.js:264），只有从遭遇牌库抽出的敌人才会被改道。生成后「立即攻击本地每位调查员」已实现（api.attack → src/engine/scenario-runtime.js:201）。 子句：[reaction]敌人将生成在另一处森林时改为生成在此（近似）"
  },
  "05066": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：背面四条子句都有实现路径，但存在四处差异：① 正面强制用 spawnLocation/spawnFailed 拦截「任何」生成，而不只是「抽到」怪物：例如 05103 怨灵被击败后附到地点、其闹鬼能力「Spawn Wraith」也会被放一边并加毁灭（卡面只写抽到）；② 生成约瑟夫：findSpawnFarthestFromAll 把除入口大厅外的「全部」地点都作为 choose 选项（只在无选项/非法时才回落到最远），玩家可生成在非最远地点，参考实现只在并列最远的地点中选择；团队线索也按持有最多者自动摊派，没有队长分配窗口；③ 幕间故事I 的 trail 记录把佩妮/瓦伦蒂诺对调：05048 是瓦伦蒂诺却写入 theInvestigatorsAreOnPennysTrail 并读 billiardsRoom，05049 是佩妮却写入 theInvestigatorsAreOnValentinosTrail 并读 balcony（参考：05048 Valentino→billiardsRoom→ValentinosTrail，05049 Penny→balcony→PennysTrail），地点→人物的对应也随记录一起错位；且判定读 location.clues，未揭示地点的线索只记在 maxClues（distributeClues 119-135），会被当成无线索而误记；正文只在「无线索」时播报（参考对每位未划掉者都读，仅把无线索段落标绿）；④ 幕间以日志段落自动结算，没有独立幕间阅读窗口。 子句：强制：抽到[[怪物]]敌人时不生成，放一边并在本密谋放1毁灭，可致推进（近似）；线索足够时花费3[per_investigator]，在最远地点生成约瑟夫（近似）；打开剧本日志，进入幕间故事I：失踪人口记录（近似）"
  },
  "05067": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「获得胜利0」没有落到数据或实例：0 点确实不改变胜利点数，但按参考实现（GainVictory 0）被击败的银暮秘社敌人应进入胜利区；本实现让它们进遭遇弃牌堆，而结局1的幕间分支按胜利区里[[银暮秘社]]卡数量与大厅底下数量比较（behavior.js:347-358），可能落到 ThePriceOfProgress4 而不是 6；② 猎手条款用 hunterMove 重写，但引擎只在「同地点没有真实调查员」时调用该钩子（src/engine/turn.js:149-152），且候选只取 steps>0 的地点：猎手若正与银暮秘社敌人同地点仍会移动，参考实现的 CountsAsInvestigatorForHunterEnemies 会把它当作调查员而停下；③ 强制伤害改在 enemyPhaseEnd（敌人攻击之后）结算：此时已攻击过的[[幽灵]]敌人已横置并被跳过，而卡面时点（猎手移动后）它们仍重整，会少结算甚至不结算；测试 tcu-deaths-doorstep.test.mjs:525-536 只直接调 enemyPhaseEnd 且用未横置敌人，未覆盖该时点差异。 子句：每个[[银暮秘社]]敌人获得胜利0（近似）；猎手移动时把[[银暮秘社]]敌人视为调查员（近似）；强制：猎手移动步骤后，重整[[幽灵]]敌人对同地点每个[[类人]]敌人造成伤害（近似）"
  },
  "05068": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① 怪物生成缺少玩家选择：实现按 flags.monsterSetAside 的固定顺序、按座位号顺序逐个生成；卡面要求「按玩家顺序，每位调查员生成一个」，参考实现每位调查员用 chooseTargetM 从放一边的怪物中自行选择，且玩家顺序从队长开始（不是座位0）；② 换面沿用原地点的 revealed 状态（flipLocationFace 不改 revealed，behavior.js:288-293 只额外调用 reveal），而卡面只要求「有调查员则揭示」，参考实现 replaceLocation 明确不保留揭示状态——曾探索后无人留下的地点在本实现中会保持已揭示；③ 7 张幽灵地点换面后没有从 scenarioZones.setAside 移除（behavior.js:285-293 未调用 takeFromSetAside），区域账本仍把它们显示为「放一边」；④ 其余（移动、揭示、看守人、两组洗回）与卡面一致。 子句：每个地点换成放一边的[[幽灵]]版本，保留标记/卡牌；有调查员则揭示（近似）；按玩家顺序，每位调查员生成1个放一边的[[怪物]]，直到全部生成（近似）"
  },
  "05076": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① 费用只数卡牌印刷的 intellect 图标（behavior.js:396-399），不把 wild 图标当智识图标；参考实现 SkillIconCost 把 WildIcon 计入（参考资源 SkillIconCost 的 countF = member (insertSet WildIcon skillTypes)），卡表有大量 icons.wild 玩家卡，手持 wild 图标牌会被误判为不足 3 点；② 弃牌由实现按图标从高到低自动选（behavior.js:681-697），没有玩家选择弃哪些手牌的窗口；③ 行动以通用 scenarioAction 执行，move 未声明 actionKind='parley'，behavior 也未提供 actionKind 钩子，因此按引擎 rules 会引发借机攻击（src/engine/dispatch.js:240 的豁免列表只认 fight/evade/resign/parley 等），与卡面 Parley 关键词不符。团队每场一次已实现。 子句：[action]弃掉合计至少3个[intellect]图标的手牌：谈判（近似）"
  },
  "05078": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：封锁子句没有可用路径：幕 1b 用 flipSpectral 换幽灵面（behavior.js:285-293），引擎翻面只换 code/名字并保留 revealed（src/engine/locations.js:172-223，全仓库无任何 revealed=false 写入点），而入口大厅开局因全员在场即 revealed=true（src/engine/locations.js:136-138 placeLocation；setup 先放调查员再放地点）。结果：幽灵面入口大厅进幕 2 后仍是已揭示 → 调查员可以直接走进入口大厅并提前用 [action] 撤退，幕 2b 的 api.reveal('entryHall')（behavior.js:323-327）也成空操作。测试 tests/tcu-deaths-doorstep.test.mjs:350-357 是手工把 revealed 置 false 才验证到封锁。卡面幕 1b 的印刷动作是「把在场地点的幽灵版本换上场」（05068 背面），换面后应按「是否有调查员」重新决定揭示。第 3 条限制无条件生效：序章（迷雾未起、入口大厅还是 05071）里抽到银暮秘社敌人且抽牌者在入口大厅时也会被直接弃掉，与「迷雾期才封锁」不符。待人工复核：确认是否存在其它把 05078 置为未揭示的路径。 子句：[背面] 你不能进入入口大厅（未实现）；[背面] 银暮秘社敌人不能生成在此（近似）"
  },
  "05085": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：05085 正面文本全部有路径，缺的是「成功 → 翻面结算的 05085b 文本」中的两条长期效果：①本局不能再把毁灭放到银暮秘社敌人上（只有日志，无任何拦截读点）；②约瑟夫获得冷漠（同步函数只能减不能加）。翻转本身用 flipEnemy 连续两次实现（05085b 面在威胁区瞬时出现），与实体翻面等价。05085b 是独立卡号（不在本批卡表内），建议在其条目/审计里补这两条；scenarioApproximations（behavior.js:806）声称「记录本局限制」，实际只记录了一个用于隐藏谈判的 flag。 子句：05085b：本局毁灭不能放在银暮秘社敌人上（未实现）；05085b：约瑟夫获得冷漠（未实现）"
  },
  "05085b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺两条长期效果：①「本局毁灭不能再放到银暮秘社敌人上」没有任何拦截读点（只有一条日志 + 一个用于隐藏谈判的 flag），chapter 的 status.json approximations 也未登记；②「约瑟夫获得冷漠」无法实现（同步函数只能移除冷漠，不能新增）。翻面/移除毁灭/解除交战三段已实现；翻面用 flipEnemy 连续两次等价模拟正反面结算。与 shared:encounters#1 对 05085 的结论一致。 子句：本局剩余时间，毁灭不能放在[[银暮秘社]]敌人上（未实现）；约瑟夫·梅吉尔获得冷漠（未实现）"
  },
  "05087": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处形式差异：①「猎物 - 你」没有写进敌人数据，移动仍走默认猎手选点（05086 的 prey 为空 → 取最近调查员），抽牌者不是最近目标时移动方向会偏；②实现无条件先走一步，而真正敌军阶段的猎手步会跳过「已交战 / 横置 / 不移动 / 所在地点已有调查员」的敌人（src/engine/turn.js:150-151）——例如看守人与抽牌者同地点时，实现会先把它移开再重新交战/攻击，与「如同敌军阶段」不符。治愈 3、重整、交战、攻击本身忠实；P8 status.json 已登记同类近似。 子句：其移动、交战并攻击，如同此刻是敌军阶段（近似）；结算期间获得猎物 - 你（近似）"
  },
  "05089": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「猎物」用的是本文件 17-25 行的剩余神智 = 基础神智 + 支援卡印刷神智 − 恐惧；引擎正规口径（src/engine/card-ops.js:42 lowestSanity = getMaxSanity − horror，getMaxSanity 只算 sanityBonus/sanityModifier）不把盟友自己的神智轨道算进调查员剩余神智。带高神智盟友的调查员会被人为抬高剩余神智，可能把吹笛手生成到错误的地点并交战错人（第 4 条）。其余三条（涌动、恐惧分配、放牌库旁、3 张齐了的弃牌与场外生成）与卡面一致。 子句：3张在场：弃掉并生成吹笛手与其猎物交战（近似）"
  },
  "05090": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：差异：①显现用 enemySpawned 承载，所以凡是由剧本效果生成的学徒也会结算显现（只有「抽到」时才该结算），P8 shared-encounters.status.json 已登记；②inTheClutchesOfChaos 的 behavior.enemySpawned（behavior.js:891-893）没有调用 encounterRules.enemySpawned，而该章的 music 变体收 anettesCoven 组（definition.js:138,143-165），所以那一章抽到/生成 05090 时显现完全不结算；③牌库在本效果开始前已是 0 张时也按「耗尽」处理（不是本效果造成），只会多抽一张巫术卡。 子句：显现 - 弃遭遇牌库顶2张（近似）"
  },
  "05091": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处差异：①加成实现正确（含 +3 上限），但 inTheClutchesOfChaos.behavior.enemyStatModifier（behavior.js:899-904）只处理 health 并直接 return 0，没有调用 encounterRules.enemyStatModifier → 该章（music 变体含 anettesCoven）的 +1/+1 永远为 0；②「遭遇牌库耗尽」是事后判定：靠 scenariosFlags.encounterDeckSizeAfterDraw 记录「上次抽牌后牌库为 0」，只有在下一次抽遭遇卡时才触发（若本局不再抽牌则永不触发），且由 05090 弃牌造成的耗尽要等下一次抽牌才结算，时点晚于卡面；③重整 + 逐个攻击 active 调查员与卡面一致（tests/tcu-shared-encounters.test.mjs:402-412）。 子句：弃牌堆每有1个女巫敌人+1攻击/+1躲避（最多+3）（近似）；强制 - 遭遇牌库耗尽：重整并攻击同地点每人（近似）"
  },
  "05094": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺『你不能触发你控制的卡牌上的 [action] 能力』一条：只有数据字段、没有引擎读点（条目 simplified:true + status.json gaps 已登记）；参考实现 Bedeviled.hs 用 CannotTriggerAbilityMatching (AbilityIsActionAbility <> AbilityOnCardControlledBy iid) 表达同一条，本仓库没有对应原语。其余段落已实现。另：theSecretName 的 performEncounterAction 覆盖（content/campaigns/theCircleUndone/scenarios/theSecretName/behavior.js:247-273）在该章同时使『横置女巫自动成功』失效并把卡弃到调查员弃牌堆（详见 05093 note），属章节侧问题。 子句：你不能触发你控制卡牌上的[action]能力（未实现）"
  },
  "05095": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①记录在案的近似：『如果可以』的毁灭放置限制（参考实现 LodgeNeophyte.hs 的 forced 带 `restricted a 1 CanPlaceDoomOnThis`）无通用读点，本仓库无条件放置（status.json approximations；src/engine/act-agenda.js:311-320 只有手铐 restrainsDoom 的拦截）。②章节侧偏差：unionAndDisillusion 的 enemySpawned 在调用共享钩子后又给 05095 加 1 毁灭（content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/behavior.js:591-596 与 :580 共享调用并存），实测入场毁灭=2；inTheClutchesOfChaos 的 enemySpawned 未调用共享钩子（…/inTheClutchesOfChaos/behavior.js:891-893），该章入场不放置毁灭；forTheGreaterGood 的 spawnLocation 对未特判 code 返回 null（…/forTheGreaterGood/behavior.js:680-694），经 src/engine/enemies.js:264-268 被当成无合法生成点，05095 在该章由遭遇牌库抽到时直接进弃牌堆、永不生成。 子句：强制：入场后在其上放 1 毁灭（近似）"
  },
  "05096": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：唯一偏差是记录在案的近似：参考实现 KeeperOfSecrets.hs 的 forced 带 `restricted a 1 CanPlaceDoomOnThis`，本仓库没有该限制的通用读点，神话阶段结束的毁灭无条件放置（status.json approximations；src/engine/act-agenda.js:311-320 只拦手铐）。章节侧：forTheGreaterGood 的 spawnLocation 对未特判 code 返回 null（…/forTheGreaterGood/behavior.js:680-694 + src/engine/enemies.js:264-268），05096 在该章由遭遇牌库抽到即弃、永不生成（与 05095 同源缺陷）。 子句：强制：神话阶段结束时放 1 毁灭（近似）"
  },
  "05097": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处覆盖不全（参考实现 MysteriesOfTheLodge.hs 可对照）：①『谈判难度 +2』靠敌人实例标记传播，只有 05095/05096 的谈判实现读它（规格 artifacts/migration/tcu/p8/specs/shared-encounters.md:105 即此设计）；参考实现是在任意 Fight/Evade/Parley 检定上给 targeting 该敌人的 Difficulty 2，因此其它 [[异教徒]] 的谈判不受影响——例如 05085 约瑟夫（Humanoid/Cultist，可成为『最近的异教徒』）的谈判在 content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/behavior.js:623,702-708，难度固定 4 不吃 +2。②涌动只在完全没有异教徒时触发；参考实现用 `EnemyWithTrait Cultist <> EnemyWithoutModifier CannotPlaceDoomOnThis` 先排除不能放毁灭的敌人，若都被排除则涌动——本实现既不排除也不检查实际放置结果（src/engine/act-agenda.js:311-320 在 restrainsDoom 时返回 0 被忽略）。③章节侧：inTheClutchesOfChaos 的 enemyStatModifier 只处理 health（…/inTheClutchesOfChaos/behavior.js:899-904），该章的攻击/躲避 +2 失效。 子句：直到轮末，攻击/躲避/谈判难度 +2（近似）；未因本效果放置毁灭则获得涌动（近似）"
  },
  "05098": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处偏差：①条目额外提供了一条卡面没有的 [action] 意志(3) 摆脱行动（05098.js:threatAction:19-24；印刷文本只有显现+强制，见 src/cards/cards-data.js 的 05098 text/textZh；规格 shared-encounters.md:84 明确写了该 threatAction），使这张本该只能靠遭遇牌库耗尽摆脱的卡可以被主动弃掉。②『遭遇牌库耗尽』的时点近似：共享 encounterDrawn 用『上一次抽牌后牌库为 0』判定（encounter-rules.js:408-412），实际在牌库耗尽后的下一次抽牌前才结算（2 恐惧与意志(3)晚一步），且若牌库因弃牌效果（05099/05090）耗尽而没有后续抽牌则永不触发。章节侧：theSecretName 的 performEncounterAction 覆盖把该卡弃进 inv.discard（…/theSecretName/behavior.js:252-258）而非遭遇弃牌堆。 子句：强制：牌库耗尽→2 恐惧+意志(3)成功弃卡（近似）"
  },
  "05100": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处偏差：①猎物语义近似（status.json 已登记）：卡面/参考实现 NetherMist.hs 的 `setPrey (at_ $ LocationWithMostClues $ LocationWithInvestigator Anyone)` 是按【地点线索数】选人，实现是 PREY_RANK.mostClues=『持有线索最多』（src/engine/card-ops.js:40）。②移动后授予地点错位：参考实现的闹鬼能力用 `proxied (LocationWithEnemy $ be a)` 动态绑定敌人当前所在地点；本实现把地点 id 写死。引擎 enemyMoved 回调的第三个实参是移动前地点（src/engine/movement.js:322-326 与 :215-220 都传 previous），共享钩子按 newLocationId 转给条目（encounter-rules.js:297-299），05100.js:34-36 用它重新授予——实测 a→b 移动后授予仍在 a，新地点 b 永远拿不到『闹鬼 - 冥府之雾攻击你』（测试 tests/tcu-shared-encounters.test.mjs:527 直接传新地点，掩盖了这一点）。③章节侧：unionAndDisillusion 的 spawnLocation 对未特判 code 返回 null（…/unionAndDisillusion/behavior.js:571-577），经 src/engine/enemies.js:264-268 被当成无合法生成点，05100 在该章抽到即弃、永不生成。 子句：猎物：所在地点线索最多的调查员（近似）；所在地点获得：闹鬼-冥府之雾攻击你（近似）"
  },
  "05103": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处偏差（参考实现 Wraith.hs 可对照）：①『除[[法术]]或[[遗物]]以外的伤害』只识别『source 是法术/遗物支援实例 id』（05103.js:16-25）；参考实现用 `not_ $ BySource $ oneOf [#spell, #relic]` 按伤害来源卡判定，而本仓库法术事件卡或效果伤害走 src/engine/effects.js:184 的 damageEnemy（不传 source，源为 null），会被当成普通伤害而附属——按卡面这类伤害应正常弃掉。②同地点第二只被击败的怨灵不会新增附属（05103.js:44-48 见到同卡号就跳过 push），授予也只保一条（:49-60），于是第二只怨灵实际消失；参考实现把每只怨灵都以 AttachedToLocation 形式留在该地点、各自提供一条『闹鬼 - 将怨灵生成在本地点』，两条能力会各生成一只。③表示法：附属用 location.attachments 的纯数据条目而非敌人实体、重新生成靠授予的闹鬼能力（status.json 已登记 approximation）。 子句：强制：非法术/遗物伤害击败→附属地点（近似）；被附属地点获得：闹鬼-在此生成怨灵（近似）"
  },
  "05104": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺第二段『如果你所在地点闹鬼，一位调查员如要在本次技能检定投入 1 张或多张卡牌，作为额外费用必须结算该地点的每个闹鬼能力』：参考实现 TrappedSpirits.hs 用 `CommitCost (ResolveEachHauntedAbility lid)` 表达，本仓库没有投入费用原语（commit 只提供 canCommitCard 过滤，src/engine/tests.js:219 只能整卡允许/禁止；beforeCommit 只是玩家窗口 tests.js:182），章节侧也没有等价补偿。显现的伤害段已实现并有测试（tests/tcu-shared-encounters.test.mjs:596-604）。 子句：闹鬼时投入 1+ 张牌需先结算每条闹鬼（未实现）"
  },
  "05107": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：偏差集中在『3 张集齐』：第 3 张触发时条目把 3 张代码 push 进 state.encounterDiscard 后返回 false（05107.js:28-37），引擎还会为本张再 push 一次（src/engine/encounter.js:173）→ 弃牌堆出现 4 个 05107；参考实现 TerrorInTheNight.hs 只弃牌库旁的 2 张、由引擎弃本张，合计 3 张。测试 tests/tcu-shared-encounters.test.mjs:645 只直接调条目（断言 3 张），未覆盖引擎弃牌路径。另一处：手写 push 固定写 state.encounterDiscard；theWagesOfSin 把带 [[幽灵]] 特性的卡组成第二牌堆（…/theWagesOfSin/definition.js:216-218 SPECTRAL_DECK_CODES，05107 在其中），该章从 spectral 牌堆抽到 05107 时弃牌应回该堆 discard（src/engine/encounter.js:86-89,173），现在会分裂到主遭遇弃牌堆。 子句：牌库旁 3 张→全部弃掉，每人 3 恐惧（近似）"
  },
  "05110": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：快速事件挂在 clueDiscovered 窗口，但描述子的 criteria 是数组形式，而快速事件的候选筛选只读取对象形式的 criteria（src/engine/encounter.js:218-222），因此只要任意调查员在任意地点发现线索就会出现「打出水落石出」选项；resolve 里的 location/lastClue 复查（src/cards/entries/05110.js:20-24）只阻止结算，卡牌仍移出手牌进弃牌堆。已用 core-fixture 复现：地点剩 2 线索、发现其中 1 个后仍提示打出，打出后卡进弃牌堆且无资源获得。X=隐藏值与逐点分配部分与卡面一致。 子句：快速；一位调查员发现你所在地点最后1个线索后打出（近似）"
  },
  "05112": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：额外法术槽位只按容量 +1（add:slot arcane），未限制只能携带 [[法术]]/[[仪式]] 支援——现有槽位原语不支持按特性分组（05009 同口径）。快速关键字已在条目上并由 playFlag 读点生效。 子句：额外1个法术槽位，只能放[[法术]]或[[仪式]]支援（近似）"
  },
  "05114": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「剩余神智≤3」用 inv.maxSanity（印刷上限）− horror 判定（src/cards/entries/05114.js:22），未走 getMaxSanity 的修正管线（支援 sanityBonus/sanityModifier 与威胁修正，src/engine/stats.js:148-152）。因此当 +1 神智上限的支援在场时边界会偏：上限 5+1、恐惧 2 时实际剩 4 应 +1，实现按 5−2=3 给出 +2。其余两条（击败后治愈 1 恐惧、可选受 1 恐惧换 +1 伤害）与卡面一致并有断言。 子句：[action]攻击+1[战斗]；剩余神智≤3时改为+2（近似）"
  },
  "05117": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：形式差异：[fast] 能力固定挂在 testBegins 窗口，且只在本次检定使用意志时提供（criteria 读 state._treacheryResolving 与 state.skillTest.skill，src/cards/entries/05117.js:30-31）；卡面允许在诡计卡牌检定的任意玩家时点横置+花 1 补给获得 +2 意志。加值走 pendingBonus（src/engine/api-test.js:87；src/engine/tests.js:183-184），对非意志检定无实际意义，因此结果等价。第二条弃掉自身 +3 战斗与卡面一致。 子句：[fast]横置+1补给：诡计卡检定+2[意志]（近似）"
  },
  "05119": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：额外图标未记录到刚投入的卡上，而是折算成本次检定的「待决加值」+1（src/cards/entries/05119.js:41；src/engine/tests.js:342-344），且只在所选图标与本次检定技能匹配（或万能）时真正生效；选择池优先只提供匹配图标，无匹配时才回退到全部图标（05119.js:33-40）。若该卡图标被其他效果改写、或后续需要按图标数结算，则不会反映这次额外图标。 子句：投入后横置：该卡额外获得1个技能图标（近似）"
  },
  "05120": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 2 条。① 困难/专家在异次元地点的 [skull] 应为 -4：chaos.js:secretNameChaosToken L27 写成 `isExtradimensional ? (hard ? -3 : -3) : (hard ? -2 : -1)`，两个分支同值，-4 没有任何路径；SECRET_NAME_TOKEN_MEANINGS.hard.skull L89 与 tests/tcu-secret-name.test.mjs L580-584 也按 -3 写死，属卡面数值未落地（不是等价近似）。②「结算场上每个敌人的猎手关键词」没有落地：chaos.js:moveHunters L46-51 对每个 hunter 敌人只调 api.hunterStep 并丢弃返回值，而 src/engine/turn.js:hunterStep L217-257 是纯计算（选路后返回地点 id），真正的 relocateEnemy 在 caller（turn.js:enemyPhase L153-159）；对照 content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js:hunterMove L241-243 的正确写法（先取返回值再 api.moveEnemy）。因此 [elder_thing] 失败时敌人不会移动，反而可能弹出一次「选择移动路线」提示（hunterStep 内部 chooseAmong，等距路线时触发）后丢弃结果；且缺「已交战/横置的敌人不结算猎手」过滤（引擎自身在 turn.js L150 才做该过滤）。其余 8 条子句（普通 skull/cultist/tablet/elderthing、困难 cultist/tablet/elderthing）与卡面一致。同一 hunterStep 误用也见于 05144（本批外）。 子句：普通 [elder_thing]：失败结算场上每个敌人的猎手（未实现）；困难 [skull]："
  },
  "05121": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① [reaction] 无反应窗口：behavior.js:enemyDefeated L434-436 在击退流程里直接调 grantAgendaClue，玩家不能选择不发动（scenarioApproximations L91 已登记为等价承载，但与卡面 [reaction] 的可选窗口仍有差别）。② 多出一个生成：05121.js L44-48 的「詹金不在场」分支先生成詹金，紧接着 L47 又在詹金所在地点生成 1 张鼠群——卡面该分支只生成詹金，鼠群只在「詹金已在场」及「3 或 4 位调查员」两处出现；1–2 人局会因此多出 1 张鼠群（测试 tests/tcu-secret-name.test.mjs L321-331 只覆盖「詹金在场」分支，未覆盖该分支）。③「any [[Witch House]] location」用 api.random 随机决定（05121.js L52-53），卡面「任意」应由队长选择，且随机点可能落在另一名调查员不在的地点。 子句：[reaction] 击败詹金/那赫卜后得 1 线索（≥3 人 2）（近似）；背面：≥3 人→再找 1 张鼠群生成在任意巫宅地点（近似）"
  },
  "05122": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：唯一的差异是 [reaction]：behavior.js:enemyDefeated L434-436 自动发放线索，没有「可以发动/放弃」的反应窗口（behavior.scenarioApproximations L91 已登记）。其余 6 条与卡面一致；「在场则 moveEnemy、不在场则从放一边区 spawn」与卡面「spawn the set-aside Nahab」在正常流程下结果相同（act1 时那赫卜必不在场）。 子句：[reaction] 击败詹金/那赫卜后得 1 线索（≥3 人 2）（近似）"
  },
  "05123": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① [reaction] 同 05121/05122：behavior.js:enemyDefeated 自动发线索，无反应窗口（已登记近似）。②「密谋 4a 入场时放 4 毁灭」改为 05123 揭示时直接写在 05124 实例上（05123.js L25-29）：数值与卡面一致，最终状态等价；差别只在时机——05124 尚未成为当前密谋时其上已有 4 毁灭，若期间有「统计场上毁灭」的效果会提前看到这 4 个（本章与共享组目前没有这类读点）。 子句：[reaction] 击败詹金/那赫卜后得 1 线索（≥3 人 2）（近似）；背面：幕 1/2→密谋 4a 入场时在其上放 4 个毁灭（近似）"
  },
  "05124": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：正面 [reaction] 与前三张议程相同：behavior.js:enemyDefeated 在击退流程末端自动给线索（≥3 人 2 个），没有可选反应窗口（behavior.scenarioApproximations L91 已登记）。背面「→R1」在 05124 因毁灭阈值推进时由 act-agenda.js:advanceAgenda L201 调 agendaReveal 结算，语义正确。 子句：[reaction] 击败詹金/那赫卜后得 1 线索（≥3 人 2）（近似）"
  },
  "05125": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「原地点上的所有标记和卡牌现在都在新地点上」只实现了一半：05125.js L18-29 只把 clues 与 doom 搬到凯夏的房间，之后 L20 把 state.locations 整体清空（`filter(location => false)`）——原本在沃尔特房间或其他地点上的敌人不会被搬过去，实例仍指向已不存在的地点 id；地点上的附属卡（attachments）也没有随地点结算（引擎 removeLocation 在 src/engine/locations.js:removeLocation L252-279 才会把附属/计数器遭遇卡回弃牌堆，这里被绕过）。调查员被统一 moveInvestigator 到凯夏的房间，与卡面效果等价。目标子句（3×人数、全员同地点、团队支付）与卡面一致。 子句：背面：用凯夏的房间替换沃尔特房间（标记/卡牌转移）（近似）"
  },
  "05127": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺主动面的「那赫卜不能离开献祭场所」。那赫卜带猎手关键词（05149.js:enemyRule L8），敌军阶段会按 src/engine/turn.js:enemyPhase L149-160 正常猎手移动离开献祭场所；本章既没有覆写 hunterMove（该钩子在 turn.js L152，TCU 其他章如 atDeathsDoorstep/behavior.js L557 有先例），也没有给实例设 immobile，全仓 grep 不到任何「禁止该敌人移动」的读点，behavior.scenarioGaps 与 scenarioApproximations 也未登记。其余三条强制/目标子句与背面结局 2 均实现正确。 子句：那赫卜不能离开献祭场所（未实现）"
  },
  "05133": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「[reaction]」的可选性没有实现：成功的调查检定一定走「改为放置未知地点牌库顶」这一路（05133.js L39-60 恒 return false，src/engine/actions.js L398 因此永远不发现线索），玩家无法像卡面那样选择不发动反应而照常发现线索；凯夏的房间印刷线索为 0，所以实际损失只在「不想把未知地点翻出来」的场合。另外牌库为空时也 return false（L42-45），此时连线索发现也被一并取消。放置与「可移动」两步、以及闹鬼的弃到巫术卡并抽取均正确。 子句：[reaction] 成功调查后改为放置未知地点牌库顶（未揭示）（近似）"
  },
  "05134": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「返回 1 张卡牌」被简化为固定返回弃牌堆顶（05134.js L26 `discard.pop()`，提示文案也写成「返回弃牌堆顶 1 张」L23），卡面是由该调查员从自己的弃牌堆里挑 1 张。②「记住沉湎过去」写在单章 scenarioFlags.meddledWithThePast 名字数组（L27），不是战役记录、也没有任何跨章/结局读点（spec §3.8 自述 P9 再接）——属「用单章 JSON 状态承载」的近似。③团队每场一次与「可跳过」均已实现（api.choose canSkip，L20-25）。 子句：[action]：本地每位调查员可将弃牌堆 1 张返回手牌（近似）；每位这么做的人记住「沉湎过去」（近似）"
  },
  "05135": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：检定形式不对：「[combat] or [agility]」被实现成「[combat]+[agility]」的双技能合计检定（引擎 performTest 对数组技能求和，tests.js L114-117；日志也会显示「战斗+敏捷」），因此难度实际被大幅拉低（例如战斗 3 + 敏捷 2 = 5 vs 3）。仓内已有正确写法可参照：content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/behavior.js L359-371 先用 api.choose 选技能再 api.test 单技能。另两点小差异：失败点数用写死的 3（L14）而不是 result.difficulty，遇到全局难度修正会算错；「Forced」在进入结算里直接执行，没有「进入后」窗口。伤害数值与逐一计算的子句本身实现正确。 子句：强制 - 进入后检定[战斗]或[敏捷](3)（近似）"
  },
  "05136": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：揭示后建立的双向邻接写在 05136.js:onReveal L24-25，但任何地点再次揭示时 behavior.js:locationRevealed L287-291 会用 symbolConnections 把每个地点的 connections 整体赋值覆盖（只按印刷符号重算，不含这条手工邻接），所以「本场冒险接下来的时间里互相连接」在下一次地点揭示后即失效；behavior.scenarioApproximations 未登记这一点。 子句：余下冒险中两地点视为互相连接（近似）"
  },
  "05137": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① [action] 没有走调查行动管线：05137.js:performAction L17 直接 api.test(intellect, 地点帷幕)，因此不吃「调查时 +X」类加成、也不触发 investigateSuccess / onInvestigateSuccess 等调查窗口（引擎已支持 actions.js L396-398 的「改为不发现线索」写法，本卡未用）；② ruinsHealUsed 只在成功时置位（L20），失败后还能重复执行，与卡面「每场游戏仅限一次」不符（失败已消耗该次数）。 子句：[action]：调查（近似）；每场游戏仅限一次（近似）"
  },
  "05140": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：闹鬼的强制约束没有落地：behavior.js:hauntedScript L342-348 只把 seat 写进 scenarioFlags.mustInvestigateSeat（全仓除写入与初始化外没有任何读点）并打一条日志，任何其他行动都不受限；behavior.js:89 与 audit/tcu-scenario-acceptance.json 自述为近似。进入检定的强制子句实现正确。 子句：闹鬼 - 本轮下一行动必须是调查（近似）"
  },
  "05141": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺两条。① 强制「轮末把线索补到 3×人数」没有执行路径：05141.js:onRoundEnd L28-33 写成了函数，但 src/engine/turn.js:runLocationRoundEnd L259-272 只认 `cluesPerInvestigator` 数据字段（唯一同类 01156 就是数据写法），全仓也没有别处调用 locationRule.onRoundEnd，因此这条永远不会触发。②「本行动不会引起那赫卜的趁乱攻击」无豁免：scenarioAction 的 kind 是 'scenarioAction'（table-decisions.js:actionKind L226-256），dispatch.js L238-240 会对每个交战敌人（含那赫卜）结算借机攻击，需要为该 rule 声明 actionKind 或能力级 noOpportunityAttack。 子句：本行动不引起那赫卜的趁乱攻击（未实现）；强制 - 轮末补线索到3×人数（未实现）"
  },
  "05142": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① [fast] 子句被当作 1 个行动的 scenarioAction：05142.js:actions L13 没写 actions:0，src/engine/turn-flow.js:actionCost L463 对 scenarioAction 默认 cost=1（对照 03208.js L21 的 `actions: 0` 写法），卡面是 [fast] 不花行动。② 强制子句的「弃掉」实现为 api.remove（behavior.js:phaseBegan L530），地点被移出游戏而非进遭遇弃牌堆。③「线索最多的地点」平手时按 线索数+卡号 排序（L525-529）取第一，没有给玩家选择窗口。④ 与 moldyHalls 的固定邻接属已登记的展示层近似（behavior.js:92）；测试只覆盖放置/移动/伤恐，未覆盖 [fast] 费用。 子句：强制 - 调查阶段结束后弃掉本卡（近似）；把此处调查员与敌人移到线索最多地点（近似）；[fast] 本卡无线索时可移动到任意已揭示地点（近似）"
  },
  "05143": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① 布朗·詹金已在场时，spawn 成功后 L49 又调一次 spawnFromAside('01159')，node 实测一次显现 spawn 序列为 [01159, 01159]：比卡面多 1 张鼠群，且第二张凭空生成（不经过任何牌堆）；② 查找鼠群从数组尾部向前扫（L8-19），等于从遭遇牌库底部抽取，不是检索；③ 第一分支的「受到 1 点伤害」只在生成成功时结算（L41-43），生成失败则不受伤；④ 詹金不在场时直接从放一边区生成，不检索遭遇牌库/弃牌堆（本章他确实在放一边区，结果等价）。测试只覆盖了「詹金不在场」分支。 子句：显现 - 詹金不在场则查找并生成他（近似）；否则查找鼠群，生成并与之交战（近似）"
  },
  "05144": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：「结算她的猎手关键词」没有移动：05144.js:L19 只调用 api.hunterStep（src/engine/turn.js:hunterStep L217-257 仅计算并返回目标地点 id，敌人 relocate 由 enemyPhase L153-159 的调用方执行），行为里没有消费返回值，那赫卜不会向调查员移动。其余子句（重整、攻击同地点每位调查员、献祭场所再放 1 毁灭、不在场时从放一边区生成）实现正确。同一缺陷也出现在本章 [elderthing] 混乱标记的 moveHunters（chaos.js L46-51），属章节级问题。 子句：结算她的猎手关键词（未实现）"
  },
  "05145": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三个印刷子句都实现了，但 encounterResolve 的返回值写错：失败时局部变量 placed=true 被 return，src/engine/encounter.js L169-173 把真值当作「已入场」（与 05146/05147 的威胁区语义冲突），于是本卡既不进威胁区也不进遭遇弃牌堆，直接从场上消失；node 实测返回 true。建议恒返回 false，或改用 {placed:false}。"
  },
  "05147": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：第二条强制的时机近似：卡面是「遭遇牌库耗尽时」立即结算，实现放在 behavior.js:turnEnded L468-473，只有在本卡拥有者的回合结束、且该回合弃牌后牌库恰好为 0 时才触发；若牌库在别人回合或神话阶段耗尽，要等到拥有者下个回合结束，而期间任何一次抽牌都会把弃牌堆洗回牌库（src/engine/encounter.js L90-95），可能永远不再为 0。共享的 encounterDrawn / encounterDeckEmptyForced 通道（content/campaigns/theCircleUndone/encounter-rules.js L408-429）本卡未使用。另外「抽弱点」是直接 push 进手牌（L481），不触发抽牌反应。 子句：强制 - 遭遇牌库耗尽时弃掉本卡（近似）"
  },
  "05150": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 [reaction] 打牌减费：05150.js:note L13 自述未接线，全仓没有「打出卡牌时横置自身、承受 X 恐惧以降低该卡费用」的费用支付窗口，卡面只剩被动 +1 意志/+1 智识（05150.js:passive L12；modifiers.js:legacyStatDelta L333-335 与 card-defs.js L116-118 已接线）。 子句：[reaction] 打牌时横置并受X恐惧：该牌费用-X（未实现）"
  },
  "05152": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现「所附属支援被弃掉后把它和其余 [[升级]] 附属返回各自所有者手牌」——引擎的 leaveAsset 不触发玩家卡反应窗口（没有「支援被弃置后」的窗口 id）。已实现部分：快速（条目 fast，src/engine/turn-flow.js:481-483 判 0 行动）、只能在自己回合打出（05152.js:18）、附属到自控 [[道具]] 支援且每个支援限 1 张（src/engine/actions.js:112-133、src/engine/actions-extra.js:83-95）。 子句：反应：所附属支援被弃后返回手牌（含升级附属）（未实现）"
  },
  "05156": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：形式差异：卡面「在任意调查员的回合期间打出」在引擎里只覆盖当前调查员自己的回合——快速事件只能作为 0 行动普通出牌（自己回合的行动边界）或在行动点用尽后的收尾窗口打出（src/engine/encounter.js:389-399 的 fastHandPlays 先判 inv.seat===state.currentSeat；436-444 也只给 fastCardSeat=currentSeat）。探针已复现：双人局面、seat 1 手持本卡时 validateMove 返回「现在不是你的应答时机」，即无法像卡面那样在他人的回合里打出。「立即进行一次行动」折算成 api.gainAction(+1)（src/engine/api-misc.js:195-198）：行动仍在本回合内花掉、等价于「不计入行动数」，但不强制「立即」执行，也无法在他人的回合里行动。「不含行动期间」由引擎在行动结算中不开玩家窗口自然满足。测试只覆盖自己回合打出 + 行动数 +1，未覆盖跨调查员回合。 子句：快速。在任意调查员的回合期间打出（不含行动期间）（近似）；立即进行一次行动，如同现在是你的回合（近似）"
  },
  "05157": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记（src/cards/entries/05157.js:17-18）：符号触发时「-1 躲避值（最低 1）」完全没有实现（src/engine/enemies.js:81-86 没有躲避值修正读点），「-1 攻击值持续到本回合结束」被降级为 addEnemyFightReduction 的「下一次攻击后消耗、按 round+phase 过期」（src/engine/api-misc.js:408-416；src/engine/enemies.js:76-78；src/engine/combat.js:175），最低值按 0 而非卡面的 1 截断。除已登记简化外还有两处未登记差异：(1) 条目在符号结算前加了 `if (!result?.success) return`（05157.js:29），卡面只要求「本次攻击期间揭示符号」，攻击失败也应生效——core-fixture 探针：攻击失败且揭示 skull 时 enemy.fightReduction 为 null；(2) 条目缺 countsAs:'fight'，这个 [action] 攻击按普通行动结算，交战敌人会发动借机攻击（探针：调查员 2 伤害/2 恐惧；普通 fight 为 0）。意志攻击本身与「-1 攻击值（下一次攻击口径）」都有实现与断言。 子句：[action]：攻击（近似）；符号：被攻击敌人 -1 攻击值（近似）；并 -1 躲避值（最低 1）（未实现）；该修正在本回合剩余时间内持续（近似）"
  },
  "05158": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记（src/cards/entries/05158.js:16-17）：「符号揭示后，可以选择与你所在地点连接的一个已揭示地点，改为如同在该处调查并可用两者任一隐藏值」没有任何实现——效果体只有 investigate + skill:'willpower'，现有 investigate 原语没有在检定进行中替换调查地点/难度的读点；测试只断言意志调查、成功发现线索与 simplified 标记，符号分支无断言。意志调查部分（改用 [willpower]、以隐藏值为难度、成功发现线索）与卡面一致。 子句：符号：可选连接的已揭示地点，视为在该处调查，可用任一隐藏值（未实现）"
  },
  "05161": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处简化：① [elder_thing] 的「攻击或躲避尝试」用检定来源 label ∈ {攻击,躲避} 识别（chaos.js:13-15）；本章幽灵迷网（05177）的攻击走 api.test 且 source 无 label（behavior.js:1035-1037），失败揭示 [elder_thing] 时不会结算闹鬼。② [cultist] 在揭示瞬间给场上异端者写实例标记 roundFightEvadeBonus（chaos.js:31-34），本轮稍后才翻回入场的异端者（05185）不获得 +1。另：同一检定同时揭示 [tablet] 与 [elder_thing]（困难面 skull 追加标记）时，chaosAfterTest 在 tablet 分支 return true（chaos.js:66），[elder_thing] 的闹鬼结算被跳过。 子句：[cultist] -3，本轮异端者+1攻击/+1躲避（近似）；[elder_thing] -2，失败且攻击/躲避→结算闹鬼（近似）"
  },
  "05164": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：卡面「地点不能被翻到幽灵面」仅落实为「幕 1 期间不存在翻面行动」（翻面行动只在幕 2 提供，behavior.js:864-871/991-998），议程 1b 的剧情翻面 advanceTheHangedMan（behavior.js:157-165）不检查该限制：若议程先推进（8 毁灭，2–3 人局可能早于 3×人数线索），地点仍会被翻到幽灵面，与卡面 cannot 不符。其余子句按数据表实现。 子句：地点不能被翻到幽灵面（近似）"
  },
  "05165": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺「Clues cannot be discovered at non-Spectral locations」一条：引擎在 src/engine/locations.js:306-318 提供 canDiscoverClues 读点，但 theWagesOfSin/behavior.js 未定义该钩子（同战役其它章也没有；其它战役已有先例，如 content/campaigns/theForgottenAge/encounter-rules.js:247），幕 2 期间在非幽灵地点仍可正常发现线索（尤其幕 2 的 [fast] 可把地点翻回非幽灵面之后）。其余子句均已实现。 子句：线索不能在非幽灵地点被发现（未实现）"
  },
  "05166b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：闹鬼的「撤退锁定」范围偏小：只锁解析闹鬼的那名调查员，且在他自己回合结束即清除（应在整轮内阻止该地点撤退能力被任何调查员触发）。附注（数值）：05166b 幽灵面印刷隐藏值为 1（src/cards/cards-data.js 与 参考资源 cards_zh.json 一致），而翻面只换 name/clues（content/campaigns/theCircleUndone/card-data.js:125-138；src/engine/locations.js:188-200 不改 shroud），幽灵面实际仍显示正面 4 —— 待人工复核：是数据笔误还是实现缺口。 子句：闹鬼：直到一轮结束不能触发上述撤退能力（近似）"
  },
  "05170": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：卡面 X 是公式：数据层把隐藏值记成 -2 占位，definition.js:205-208 把正/背面 shroud 归零，再由 SHROUD_RULES.perGeist（behavior.js:251）给出 X=场上[[灵怪]]敌人数，实际隐藏值与卡面公式一致，只是不直接使用印刷数值（承载形式不同）。 子句：X=场上灵怪敌人数量（X为隐藏值）（近似）"
  },
  "05170b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：卡面把隐藏值印成占位「-2」（真实公式 X），数据层按参考实现把正/背面 shroud 归零，再由 shroudRule perGeist 动态给出 X=场上[[灵怪]]敌人数；实际隐藏值与公式一致，只是不直接使用印刷数值（承载形式不同，与 chapter:theWagesOfSin#1 对正面的判定一致）。 子句：X = 场上[[灵怪]]敌人数量（本地点隐藏值）（近似）"
  },
  "05171": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：加成经 beforeInvestigate 写一次性标记 wosInvestigateBonus，statModifier 只在 intellect 检定加 inv.willpower（未叠加意志修正）：①调查若改用非智力技能则不加；②使用未修正 inv.willpower，不含意志加值；③调查因无线索/被封锁而未开始检定时标记残留到本回合下一次智力检定（afterTest/turnEnded 才清除）。 子句：调查此地时把[willpower]值加入技能值（近似）"
  },
  "05171b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：调查加值走一次性标记 wosInvestigateBonus：只在智力检定生效、使用未修正的 inv.willpower，且若调查未真正开始检定，标记会残留到本回合下一次智力检定（:938 afterTest / :848 turnEnded 才清）。闹鬼一段正确：以修正量 1-base 把基础意志降到 1，保留到调查员下一回合结束。 子句：调查此地时把[意志]值加入技能值（近似）"
  },
  "05173b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处偏差：①生成体额外带 [[幽灵]] 特性（卡面只给[[怪物]]），所以在闹鬼农田会额外 +1 恐惧值、也会被 05167b 的「最近幽灵敌人」选中；②「与你交战」由 src/engine/turn-flow.js:148 autoEngageAt + src/engine/engine.js:607-614 自动选猎物，同地点有多名调查员时可能交给别人；③底层牌只写进 underlyingCard（src/engine/enemies.js:312 仅注释、全仓无读取点），敌人被击败后那张牌不回弃牌堆（等于移出游戏）。 子句：闹鬼：将你牌库顶 1 张生成面朝下与你交战，视作苏生亡者（近似）"
  },
  "05175": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：[reaction] 无跳过/选择窗口：成功调查后自动把阁楼底下所有卡加入所有者手牌（behavior.js:695-707），时点在发现线索之前（actions.js:386 早于 398）。强制子句的「非弱点」由引擎抽牌路径保证（deck-ops.js:384-387 只在非弱点分支调用 cardDrawn），行为中的弱点判断属冗余但无害。 子句：[reaction] 成功调查后取回底下所有牌（近似）"
  },
  "05175b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：[reaction] 没有可选窗口：成功调查即自动把底下每张牌加入所有者手牌，且发生在发现线索之前。强制段与闹鬼段实现正确（beneath 为纯 JSON，随存档往返）。与 chapter:theWagesOfSin#1 对正面的判定一致。 子句：[reaction] 成功调查后把底下每张牌加入所有者手牌（近似）"
  },
  "05176": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：以 beforeInvestigate 记录当时手牌张数（behavior.js:689-693、269），statModifier 仅在 intellect 检定生效（behavior.js:686）：非智力调查不加；调查未开始检定时标记会残留到本回合下一次智力检定（afterTest/turnEnded 才清除）。 子句：调查此地时把手牌张数加入技能值（近似）"
  },
  "05176b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：调查加值与 05171b 同源：登记的是调查开始前的手牌数，只在智力检定生效，若调查未开始检定会残留到本回合下一次智力检定。闹鬼段分档（≥5 张弃 2）正确。 子句：调查此地时把手牌张数加入技能值（近似）"
  },
  "05177": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处差异：①线索取自『全部存活调查员』而非『你所在地点』，且一次选择后按座位自动扣减，没有逐人分摊窗口，也不检查『不能花费线索』类效果；②没有合法灵怪目标时行动仍出现、线索照扣（1019-1021），且该自定义攻击绕过 canFightEnemy 的幽灵目标限制（非幽灵地点的[[幽灵]]敌人也能被攻击）；③『+X 伤害』只结算 X 点：花费 1 个线索只得 1 点伤害，卡面应为 1+X（基础 1 点攻击伤害未叠加）。 子句：[action]你所在地点的调查员共同花费1-3个线索（近似）；攻击；本能力只能用于攻击[[灵怪]]敌人（近似）；本次攻击造成+X伤害（近似）"
  },
  "05178a": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处近似：①「不能被交战」没有引擎读点，改用 aloof + 禁止攻击(canFightEnemy) + 禁止受伤(enemyDamageAllowed) 表达——非幽灵地点仍可对其执行交战行动（但之后打不动）；②[fast] 谈判被实现成普通场景行动（默认消耗 1 行动，dispatch.js:200 照扣行动点）、线索从团队池扣、且只在自己回合的行动列表里可选，而卡面是 [fast]、花「1 个线索」。 子句：位于非[[幽灵]]地点时获得冷漠且不能被交战或伤害（近似）；[fast] 花费 1 线索：谈判，查看异端者另一面（不结算）（近似）"
  },
  "05178b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺一条可执行子句：「如果你退场，将其翻面」。章节没有 investigatorEliminated 钩子，引擎消除流程（harm-threat.js:208-228）只处理隐藏卡/离场支援/交战，威胁区的剧情卡既不移除也不翻回敌人面；按该代码路径，未了之事会滞留在已退场调查员的威胁区（异端者永不回场）。其余四段（威胁区保留、轮末 2 选 1、[action] 检定(4)、驱除进胜利区）均实现。 子句：如果你退场，将其翻面（未实现）"
  },
  "05178c": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05178a 同规则、同一套近似：①「不能被交战」只用 aloof+禁攻击+禁伤害表达；②[fast] 谈判按普通场景行动收费（1 行动）、线索从团队池扣、仅自己回合可选。翻面目标为 05178d（definition.js:27）。 子句：位于非[[幽灵]]地点时获得冷漠且不能被交战或伤害（近似）；[fast] 花费 1 线索：谈判，查看异端者另一面（不结算）（近似）"
  },
  "05178d": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺「如果你退场，将其翻面」：与 05178b 同因——章节无 investigatorEliminated 实现，引擎消除流程不会把威胁区的未了之事翻回敌人面，卡片会滞留在退场调查员的威胁区。其余四段均实现（轮末为 1 点伤害、地点为绞刑架、检定[意志]或[敏捷]）。 子句：如果你退场，将其翻面（未实现）"
  },
  "05178e": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处偏差：①「不能被交战」没有拦截路径（引擎没有 canEngage/被交战读点，behavior.js:969 已登记该近似），实际只拦攻击与伤害——冷漠敌人仍可被主动交战，但交战后再攻击仍被 canFightEnemy=false 挡住。②谈判印的是 [fast]（不花行动点），实现按 1 行动计费（scenarioAction 无 actions 字段 → turn-flow.js:463 默认 1），且「花费 1 线索」从全队线索池扣除（behavior.js:1048-1053 可从线索最多者身上扣），而卡面是行动者自己花费。其余子句（+2×人数生命、非幽灵地点冷漠、被击败翻面并结算另一面）均有实现与单测。 子句：位于非[[幽灵]]地点时不能被交战或伤害（近似）；[fast] 花费1线索：谈判，查看另一面（近似）"
  },
  "05178f": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺「If you are eliminated, flip it over」一条：f/h 两张未了之事没有退场处理——引擎在 src/engine/harm-threat.js:226 提供 investigatorEliminated 读点（本章未定义），调查员被击败/撤退后该剧情卡仍留在其威胁区（inv.threat 未清理），异端者不会翻回敌人面；轮末强制（behavior.js:830-836）还会跳过已退场调查员，等于这张卡彻底失效。其余子句（威胁区保留、轮末二选一、教堂阁楼无线索时检定(4)、成功驱除进胜利区 +1）都有实现与单测（含退场以外的全部路径）。 子句：如果你退场，将其翻面（未实现）"
  },
  "05178g": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05178e 同规则（同一批印刷文本），偏差同样两处：①「不能被交战」只体现为不能被攻击/伤害（behavior.js:969 已登记近似）；②谈判印 [fast] 却按 1 行动计费、且线索从全队池扣。G 面专属的翻面对（05178h）由 definition.js:43-54 的数据表驱动，被击败翻面与轮末强制均正常。 子句：位于非[[幽灵]]地点时不能被交战或伤害（近似）；[fast] 花费1线索：谈判，查看另一面（近似）"
  },
  "05178h": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺「If you are eliminated, flip it over」一条（F 面同病）：本章没有 investigatorEliminated 处理，调查员退场时 05178h 这张威胁区剧情卡既不会被翻回敌人面、也不会被清理，异端者 05178g 永久离场；轮末强制会跳过已退场调查员（behavior.js:831），因此这条卡也失去作用。弃 2 张手牌分支用 api.discardChosen（:375）实现，与「选择并弃掉」一致；其余子句完整。 子句：如果你退场，将其翻面（未实现）"
  },
  "05178i": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05178e 同一批印刷文本，两处同样的偏差（不能被交战只体现为不能被攻击/伤害；[fast] 谈判按 1 行动计费且线索全队分摊）。I 面的另一面 05178j 属「立即结算型」，被击败时会在同一次 enemyDefeated 里翻回敌人面并立即攻击（behavior.js:816-821），该路径正确，细节见 05178j 条目。 子句：位于非[[幽灵]]地点时不能被交战或伤害（近似）；[fast] 花费1线索：谈判，查看另一面（近似）"
  },
  "05178j": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：唯一偏差是谈判费用多算 1 个线索：卡面「花费 +1[per_investigator] 个线索」= 1+人数（1 人局 2 个），实现 behavior.js:403 写成 1 + numInvestigators + parleyClueBonus(=1) = 人数+2（1 人局 3 个），actions 列表与 performHereticParley 读的是同一个值，因此报价与实际扣费一致地偏高 1。其余子句（翻回+立即攻击、不能以任何方式被击败、谈判限幽灵地点、下次结算改为驱除、经谈判查看时按「如同刚被击败」结算、驱除进胜利区）均有实现与单测。 子句：谈判费用 +1[per_investigator] 线索（近似）"
  },
  "05178k": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05178e 同批文本、同样两处偏差（不能被交战→只能拦攻击/伤害；[fast] 谈判按 1 行动计费、线索全队分摊）。K 面对应的 05178l 面的「不结算其他文本」偏差记在 05178l 条目，不在本面。 子句：位于非[[幽灵]]地点时不能被交战或伤害（近似）；[fast] 花费1线索：谈判，查看另一面（近似）"
  },
  "05178l": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺「(Do not resolve any other text on this card.)」的守卫：L 的强制只应「翻回敌人面 + 立即攻击」，但 performHereticParley（behavior.js:1066-1069）对 J/L 一视同仁，都会调用 resolveImmediateUnfinishedBusiness，于是 IMMEDIATE_RESOLVE.banishNextDefeat（:408-411）也会执行，把 enemy.hereticBanishNext 置真。后果：玩家花 1 个线索谈判看一次 L 面，就白拿「下次击败即驱除」，少打一整轮翻面循环（正确流程应为：击败→翻到 L→翻回+攻击，此时才置 banishNext）。「翻回+立即攻击」与「下次击败即驱除（经击败路径）」本身实现正确，单测 tests/tcu-wages-of-sin.test.mjs:665-687 只覆盖击败路径，未覆盖谈判查看路径。 子句：强制-经谈判查看：翻回并攻击，不结算其他文本（未实现）"
  },
  "05180": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『除[[法术]]或[[遗物]]以外』这条例外在实战中基本不成立：isSpellOrRelicSource 用 source 去匹配支援实例 id（形如 c12，见 src/engine/rules-state.js:nextInstanceId:22-27），而普通战斗伤害调用 enemyDamaged 时根本不传 source（src/engine/combat.js:345），法术攻击（如皱缩术走 effect:fight）同样如此，幽灵迷网传的是字面量 'spectralWeb'（behavior.js:1036），玩家卡自定义 resolve 传的是卡号（如 src/cards/entries/02113.js:37 的 '02113'）。因此法术/遗物击败它时仍会治愈+横置+移动而不是正常击败；单测用的 'spell-asset' 是测试伪造的实例 id，实机不可达。另：+1 伤害/恐惧只在敌人攻击结算处读取，其它卡引用其『伤害值』时看不到加成。 子句：例外：[[法术]]或[[遗物]]造成的伤害不触发上述强制（近似）"
  },
  "05181": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：同一调查员威胁区里有 2 张惩罚时，一次敌人被击败只结算 1 点伤害（实现按 threatHasRule 每调查员一次，卡面是每张各触发一次）；另外该强制在 enemyDefeated 内结算，早于胜利区结算与 defeatEnemy 反应窗口，属『被击败后』的顺序近似。 子句：强制 - 任意地点有敌人被击败后：受到1点伤害（近似）"
  },
  "05182": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①涌动条件按『任意调查员』是否有未了之事判定，而非『你的威胁区』：多人局里别人持有时（你没有）本该涌动却不涌动；②涌动在显现结算之后才计算（src/engine/encounter.js:169-178），若你在强制能力里选择把唯一一张未了之事翻回敌人面，威胁区清空后会错误地再获得涌动。 子句：显现 - 你的威胁区没有未了之事时，本卡获得涌动（近似）"
  },
  "05183": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺『抽到的那张幽灵遭遇卡获得险境，且其效果不能被取消』：引擎没有给本次抽牌附加 peril/不可取消的参数或状态，抽到的卡仍按自身印刷文本判定险境，其他调查员可以参与，也仍可被取消/重抽类反应取消（src/engine/encounter.js:105-118）。另外『险境』只作用于本卡的两个选项，意志(3) 检定本身未按险境结算（他人仍可协助投入），待人工复核：险境是否还需覆盖该检定。 子句：险境（近似）；该卡牌获得险境，且其卡牌效果不能被取消（未实现）"
  },
  "05184": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『洗入幽灵遭遇牌库』实现为直接压到幽灵牌库顶（不混洗），因此下一张幽灵遭遇必定再抽到它；来源判定依赖 behavior.encounterDeckFor 在抽牌前写入的 scenarioFlags.lastEncounterDeck（引擎不传抽牌来源），05183 的显式 drawExtra 会先写同一标记，两条路径都能命中。 子句：从基础遭遇牌库抽出：洗入幽灵遭遇牌库并获得涌动（近似）"
  },
  "05185": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①『一半生命』取翻面后的 enemy.health：引擎 flipEnemyFace 会用印刷 health 覆盖实例（05178a 印刷 2，丢弃 +2/人的加成），且不清空原 damageTaken；直接以 flipEnemyFace+cardDef 调用验证，翻面后为 health=2/damageTaken=6，2 人局因此只放 floor(2/2)=1 点而非 3 点（单测把 api.flipEnemy 换成 stub，未覆盖这条路径）；②『在场上』的候选清单来自 scenarioFlags.unfinishedBusiness 快照，不直接读威胁区；③弃牌分支在幽灵牌库耗尽时不把幽灵弃牌堆洗回，且 api.spawnEngaged 仍会触发章节 spawnLocation——抽到 05180 恶毒邪灵时会生成在教堂阁楼/地下室、可能不与你交战（05103 无生成规则，不受影响）。 子句：在其上放置等于其生命值一半的伤害（近似）；从幽灵遭遇牌库顶弃到[[灵怪]]敌人，并生成与你交战（近似）"
  },
  "05186": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「从本卡花费的子弹进入资源池」是静态能力（任何来源从本卡花费的子弹都应变成资源），实现只写在本卡 [action] 的 resolve 里（05186.js:25）。同批 05229 鸣枪示警从[[枪械]]花 1 子弹走 api.addUses（05229.js:37），不经过这条：已用 core-fixture 复现，装备 05186 后打出 05229，弹药 5→4、资源只 30→28（按卡面应为 29，少了子弹折成的 1 资源）。其余（5 子弹、+2 战斗、+1 伤害）与卡面一致并有断言。 子句：从本卡花费的子弹放入资源池，作为资源（近似）"
  },
  "05187": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：转伤数值写死为 2（基础 1 + 卡面 +1，见 05187.js:45 注释），没有使用本次攻击的实际伤害。已用 core-fixture 复现：投入 01025「致命打击」（该次攻击伤害 +1）后，被攻击敌人受 3 点、被转伤的另一个敌人仍只受 2 点；卡面「造成本次攻击的伤害」应为 3。其余（5 子弹、+2 战斗、+1 伤害、成功点数 ≥ 该敌人攻击值、仅同地点另一敌人）与卡面一致并有断言。 子句：对同地点另一敌人造成本次攻击的伤害（近似）"
  },
  "05188": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：卡面「以任意顺序」未实现：余牌按原相对顺序整批放回所选的一端（05188.js:83-91），测试 141-159 也只断言整批放回牌库底。遭遇牌库没有「所有者手牌」，该分支按规则不提供（05188.js:14,75-77），卡面在遭遇牌库上本也用不到。其余（3 秘密、看底 3 张、弃 1、拿 1、放顶/底）与卡面一致（拿 1 与放顶分支未单独断言）。 子句：其余以任意顺序放到该牌库顶或底（近似）"
  },
  "05190": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「+3[意志]」被实现成对本次诡计检定的通用 +3（05190.js:32 的 api.addPendingTestBonus，src/engine/tests.js:183-184 直接叠进检定值），没有像 05117 那样限定本次检定使用意志。已用 core-fixture 复现：对一张诡计发起战斗检定（战斗 4 vs 难度 7）时该能力仍被提供，+3 生效后检定成功（7 vs 7）。另：能力挂在 test.beforeCommit 窗口（05190.js:26），卡面允许在诡计检定期间的任意时点使用。其余（快速、2 补给、横置+1 补给、弃掉自身 +3 战斗 +1 伤害）与卡面一致并有断言。 子句：[fast]横置并花1补给：诡计检定 +3[意志]（近似）"
  },
  "05191": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：同 05190：+2[意志] 实现为对任意诡计检定的通用 +2（05191.js:33 的 api.addPendingTestBonus，未限定本次检定使用意志），测试也只构造了意志检定。另：cards-data 中 05191 的英文 text 缺「Fast.」（中文 text 与条目 fast:true 都是快速），属数据不一致而不是实现缺口。其余（3 补给、弃自身 +3 战斗、非精英命中自动躲避）与卡面一致并有断言。 子句：[fast]横置并花1补给：诡计检定 +2[意志]（近似）"
  },
  "05192": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「如果你检定成功，你可以花费 1 充能附魔」的决策被提前到检定开始前询问（05192.js:28-34），因为 +1 伤害必须在 api.fight 结算前并入；充能只在成功后才扣（05192.js:36-37），净结果与卡面一致，但玩家在不知道检定结果时就必须决定，属时点/形式差异（条目 05192.js:11-12 的实现备注也这样记载）。其余（3 充能、+2 战斗、附魔击杀抽 1 治愈 1 恐惧）与卡面一致并有断言。 子句：成功后可花1充能附魔：本次 +1 伤害（近似）"
  },
  "05194": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：额外图标没有记录到刚投入的卡上，而是折算成本次检定的待决加值 +1（05194.js:65；src/engine/tests.js:342-344），且只在所选图标与本次检定技能匹配（或万能）时生效、选择池优先只给匹配图标（05194.js:40-42）——与 05119 同口径；若该卡图标被其它效果改写、或后续按图标数结算，不会反映这次额外图标。另：描述子带 duringOwnSkillTest（05194.js:56），队友求援（helpRequested）时投入卡牌不会触发（src/engine/tests.js:342 的 afterCommit 窗口对全员开放，src/engine/encounter.js:424 会按 duringOwnSkillTest 过滤）。成功抽 1 张已实现并有断言。 子句：投入卡牌后横置：该卡再获得1个技能图标（近似）"
  },
  "05195": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05194 同：额外图标折算成本次检定的 +1（05195.js:67），只在图标匹配时生效，且 duringOwnSkillTest（05195.js:58）使队友求援时投入的卡无法触发。失败返回手牌用支援实例上的 grislyReturn 标记 + skillTestFail 强制描述子实现（05195.js:68,74-87），从 state.skillTest.committed 摘出再放入手牌；测试断言手牌含 01025 且不进弃牌堆。 子句：投入卡牌后横置：该卡再获得1个技能图标（近似）"
  },
  "05196": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：「你所在地点的任何调查员均可激活本能力」未实现（能力层只枚举控制者的主动能力）。补充：note 称「双行动检定任意技能移除锁头」已实现，但双行动费用是用「引擎先扣 1 点、resolve 里再扣 1 点、不足就退回」实现的（05196.js:46-56），只有 1 个行动点时能力仍出现在合法列表里并被点掉（测试 327-331 正是断言这条退款路径），卡面要求 2 个行动点才能启动。另：检索时额外过滤弱点（05196.js:91,96），卡面写「任意一张卡牌」（弱点本不可打出，影响有限）；「每个剧本最多一次」靠放逐 + 战役层 settleExiledCards 把关末放逐的卡从牌组移除（campaign.js:247-256）。 子句：[action][action]检定任意技能(5)，成功移除1锁头（近似）；你所在地点的任何调查员均可激活本能力（未实现）"
  },
  "05197": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 2 条（都在困难/专家面）：①[tablet]『如果场上没有 [[异教徒]] 敌人，再揭示一个标记』——behavior.js:afterTest:810-811 在 cultistEnemies 为空时直接 return；②[elder_thing]『如果场上没有带毁灭的异教徒敌人，再揭示一个标记』——afterTest:824-825 同样直接 return。两处都没有调用引擎现成的 api.revealToken（src/engine/scenario-runtime.js:395-402），而参考实现 ForTheGreaterGood.hs:216-219、236-246 在这两个分支里都调 drawAnotherChaosToken，因此困难/专家下这两半句的额外 token 永远不出现。另 2 处形式差异（已实现、不完全等价）：(a)『最近的异教徒敌人』参考实现用 chooseTargetM 让玩家在距离并列者中选，本实现 nearestCultist（behavior.js:894-915）按距离排序取第一个，没有平手选择窗口；(b) 失败后果的触发条件用『抽到且未被取消的 token 里含有 tablet/elderthing』（afterTest:807），比参考实现的 ChaosTokenTarget（以决定这次成败的那一枚为准）略宽，抽到 tablet 后被其它效果再抽一枚时两边结论可能不同。 子句：[tablet]场上无异教徒敌人：再揭示一个标记（未实现）；[elder_thing]无异教徒敌人带毁灭：再揭示一个标记（未实现）"
  },
  "05198": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺『抽取』的落地：弃 5 张、筛异教徒敌人、按玩家顺序逐个选择（多张时 api.choose）都写了（behavior.js:discardAndDrawCultists:939-972），但生成走 api.spawnEngaged（src/engine/scenario-runtime.js:198 → src/engine/enemies.js:spawnEnemy），而 spawnEnemy 在 src/engine/enemies.js:264-268 会用剧本钩子 spawnLocation 的返回值覆盖地点：本章遭遇牌库里的 05095 Lodge Neophyte 这类未特判 code 得到 null，locationExists(null) 为假 → 卡被塞回 encounterDiscard 并调 spawnFailed，敌人不会出现在场上；抽到 05219 Cell Keeper（走 sanctum 分支）虽会生成，却被挪到某个圣堂地点、不与抽牌者交战。两种情况都不是卡面的『抽取（生成并与该调查员交战）』。参考实现 TheHierophantV.hs:48-53 用 drawCard 正常抽出。待人工复核：spawnLocation 对未命中的 code 是否应 return fallbackLoc（对照 atDeathsDoorstep/behavior.js:522-533）。另 behavior.js:enemyDiscarded:735-739 也对银暮秘社敌人触发同一强制效果，而 05198/05199 的卡面都只写『击败』。 子句：按玩家顺序，每位调查员抽取1张被弃的异教徒敌人（未实现）"
  },
  "05199": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 1 条：『位于 [[圣堂]] 地点的每个 [[银暮秘社]] 敌人失去冷漠』没有任何路径——本章 behavior.js 没有 aloof 读点，也没有在敌人入场/移动/幕议程推进后同步关键词的钩子（引擎 src/engine/enemies.js:278 只按印刷数据赋一次 enemy.aloof）。参考实现 EndsAndMeans.hs:22-27 用 modifySelect (EnemyWithTrait SilverTwilight <> at_ (LocationWithTrait Sanctum)) [RemoveKeyword Aloof]；本仓库有同类实现可照抄：atDeathsDoorstep/behavior.js:82-89。另 2 处形式差异：①背面『以崇高的利益替换幕与密谋牌库』只用 state.acts=[] 近似（behavior.js:643-645，notes.js:10 已登记），密谋牌库完全没动——议程 2 已是最后一格，替换无可观察效果，但字面未实现；②『机关盒所在地点』：behavior.js:646-649 只在机关盒由调查员控制（holder='seat'）时取该调查员地点，机关盒挂在敌人身上（本章默认状态 holder='enemy'）时回落到『第一个圣堂地点』，与参考 EndsAndMeans.hs:39-42 用 locationWithAsset 取盒子实际地点不同——这条差异在正常流程里几乎必现。 子句：位于圣堂地点的每个银暮秘社敌人失去冷漠（未实现）；显现：以『崇高的利益』替换幕与密谋牌库（近似）；将场外的响应召唤的怪兽生成在机关盒所在地点（近似）"
  },
  "05200": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：近似 1 处：机关盒『附属到敌人』用 state.scenarioFlags.puzzleBox{holder:'enemy',enemyId} + storyAssets.location 纯 JSON 承载（behavior.js:attachPuzzleBox:146-158，notes.js:9 已登记；引擎没有 AttachedToEnemy 的剧情资产），机关盒没有实际的附属区；后续幕 2 目标由 checkObjectives:662-672 → givePuzzleBoxTo:184-201 交给调查员，行为链完整。另：机关盒在 setup 仍留在 setAside 列表（behavior.js:setupLocations:294），与『附属在南森身上』并存，当前无读取点、不影响可观察行为。卡面正面 text/textZh 在本仓库数据里为空（数据缺目标行），目标（每人 3 线索）由 definition.js:163-166 membersAct1 的 objective{type:'clues',perInvestigator:3}（无 atLocation 限定）承接；待人工复核：卡面同面是否印有『在藏书室』的地点限定。 子句：把放在一边的机关盒剧情支援附属给他（近似）"
  },
  "05201": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：2 处近似：①机关盒『附属到敌人』用 state.scenarioFlags.puzzleBox 纯 JSON 承载（behavior.js:attachPuzzleBox:146-158，notes.js:9 已登记），引擎没有 AttachedToEnemy 的剧情资产；②『直到游戏结束，当前幕获得该反应』实现成『当前幕=05201 时自动移除毁灭』（behavior.js:afterEvade:742-748 用 String(original(act))===ACT_INFILTRATING 判定）：推进到场景 2/3 后该能力直接消失，也没有把卡放到幕牌库旁的提醒标记；参考实现 InfiltratingTheLodge.hs:42-45 用 createCardEffect + proxied (ActMatcherSource AnyAct) 让它对任意幕持续到结局，且能力是 freeReaction 的可选窗口（本实现自动移除全部毁灭，notes.js:11 已登记自动结算这一半）。其余：圣堂内室入场、生成 05217b（教化大师面）、附属机关盒、推进到 05202 与卡面一致。另：卡面 05201 未印『目标』行，definition.js:156-160 的 objective=每人 2 线索来自参考实现 groupClueCost (PerPlayer 2)（InfiltratingTheLodge.hs:21），待人工复核卡面同面是否印有目标。 子句：把场外的机关盒剧情支援附属到他身上（近似）；直到游戏结束，当前幕获得『躲避后清毁灭』反应（近似）"
  },
  "05204": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 1 条：没有任何『大门不能生成敌人』的路径（behavior.js:spawnLocation:680-694 没有地点判断，引擎侧也只有本钩子能改生成点）。附带一个更严重的发现：该钩子对未特判的 code 一律 return null，而 src/engine/enemies.js:264-268 把 null 当作『无合法生成点』→ 把遭遇卡塞进弃牌堆并调 spawnFailed，于是本章遭遇牌库里的 05095 Lodge Neophyte、05096 Keeper of Secrets 在引擎对局里永远不会生成（05218/05219 走圣堂分支、05221/05222 走连接地点分支，仍能生成）。卡面只限制大门，实现既没做这条限制，又误伤了这两个敌人。待人工复核：spawnLocation 未命中时应 return fallbackLoc（对照 atDeathsDoorstep/behavior.js:522-533 的写法）。 子句：敌人不能生成在秘社大门（未实现）"
  },
  "05205": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 1 条，缺法同 05204：『敌人不能生成在秘社大门』没有地点级生成限制路径。同时 behavior.js:spawnLocation:680-694 对未特判 code 返回 null 会被 src/engine/enemies.js:264-268 当成无合法生成点而弃卡（详见 05204 的 note，受影响的是 05095/05096 这两个普通敌人）。待人工复核：spawnLocation 未命中时应 return fallbackLoc。 子句：敌人不能生成在秘社大门（未实现）"
  },
  "05210": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『随机钥匙放在他（奥古斯特）身上』被实现成放在休息室地点上（behavior.js:366-367）：钥匙模型没有 assetId，placeRandomKeyOn 只支持敌人/地点/玩家三个槽位。参考实现 Lounge.hs:24-33 用 getRandomKey + placeKey augustLindquist 真正挂在支援上。后果：①奥古斯特谈判（behavior.js:performAction:596-597）按 keysOnLocation(august.location) 把休息室上的所有钥匙都交给行动者，不只他那把；②线索清空后玩家可用『控制地点上的一把钥匙』行动（behavior.js:actions:452-455 / performAction:502-508）直接拿走这把本应挂在他身上的钥匙。机密室/藏书室入场、奥古斯特入场地点与卡面一致。 子句：随机1把场外钥匙放在他身上（近似）"
  },
  "05213": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺『控制至少 1 把钥匙即可进入』这一半：behavior.js:investigatorEntryError:345 对未揭示的地下墓穴无条件 return『地下墓穴的门锁上了：需要控制至少 1 把钥匙。』，从不检查调用者是否真的持有 skull/cultist/tablet/elderthing 钥匙（对照同函数 339-344 的机密室/圣堂内室都有 keysHeldBy 判 key；参考 LodgeCatacombs.hs:21-27 是 whenUnrevealed + not_ (mapOneOf InvestigatorWithTokenKey [#elderthing,#skull,#cultist,#tablet])）。后果：地下墓穴在揭示前谁都进不去，而本章没有其它揭示它的效果（只能靠进入揭示，src/engine/movement.js:183 先查进入限制再走揭示），于是正面『揭示时把圣堂内室与每个圣堂门廊放入场』这段虽然在 locationRevealed:372-378 写了，在本章却永远不可达。待人工复核：这是本批最严重的行为缺口（同时卡住圣堂内室/典礼室/拘禁室这条线的入场）。 子句：未控制至少1把钥匙不能进入地下墓穴（未实现）"
  },
  "05214": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：盟友那句是直接改实例字段：asset.horror += 1（behavior.js:420-425），绕过 src/engine/scenario-runtime.js:horrorAsset:252-260 的『恐惧达到理智值→弃置该支援』检查，因此已到/超过理智上限的[[盟友]]不会因这次恐惧被弃置（引擎没有别处补做这个检查）。其余部分——在室每位调查员 1 点直接恐惧、在室有调查员控制骷髅钥匙则整体取消——与卡面一致。 子句：强制-轮末：典礼室内每个[[盟友]]支持卡受1点直接恐惧（近似）"
  },
  "05215": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：搜索被自动化了：先按遭遇牌库顺序取第一张[[异教徒]]敌人、牌库没有才从弃牌堆取，卡面的『搜索并选择』没有选择窗口（findCultistAndSpawn:983-1000，对照参考文献库的搜索应给玩家看两张候选）。生成位置固定在拘禁室、随后混洗遭遇牌库，与卡面一致。另：过滤只看 Cultist 特性、未加 type==='enemy'（当前卡池带该特性的非敌人都不会进遭遇牌库，实测无影响）。 子句：强制-揭示后：从遭遇牌库与弃牌堆找出1张[[异教徒]]敌人（近似）"
  },
  "05217b": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「你偷了机关盒」不是立即结算：afterEvade 只把南森身上的钥匙交给躲避者（giveKeysToEnemyController）并放逐他去胜利区，机关盒仍是 holder:'enemy'；要等幕 2「取得装置」（05202）的目标检查 checkObjectives（behavior.js:662-672）发现 puzzleBoxHolder==null 时才询问队长把机关盒交给哪位调查员（givePuzzleBoxTo:184-201）。结果集相近（避开南森后机关盒仍归调查队），但持有人在结算时由队长选择、而非当场归躲避者，且若当时当前幕不是 05202 则机关盒会一直挂在已放逐的敌人身上（实战中南森由幕 1 背面生成、随后即进入幕 2，通常不会卡住）。躲避超 3 点的判定读 result.value/result.difficulty，引擎检定结果含这两个字段（src/engine/tests.js:925），无误。 子句：强制-躲避成功超过3点：偷走机关盒（近似）"
  },
  "05218": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：生成位置是近似：卡面『任意一个[[圣堂]]地点』应由生成者选择，实现按固定顺序（地下墓穴→圣堂内室→圣堂门廊三角→方形）取第一个存在的地点（behavior.js:spawnLocation:688-692），既不询问玩家，也忽略抽牌/生成者所在地点。冷漠、入场 2 毁灭+随机钥匙、谈判成功后二选一（去 1 毁灭或取钥匙）与卡面一致。 子句：生成-任意一个[[圣堂]]地点（近似）"
  },
  "05219": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①躲避子句少了『2 点或更多』门槛：成功躲避（哪怕只高 1 点）就把钥匙交给躲避者，比卡面宽松；结果对象里 value/difficulty 都在（src/engine/combat.js:530 传 r），只是没比较。②生成位置同 05218：固定优先序取第一个圣堂地点，没有玩家选择。警戒、入场 2 毁灭+随机钥匙与卡面一致。 子句：生成-任意一个[[圣堂]]地点（近似）；强制-躲避成功2点或更多：控制其钥匙（近似）"
  },
  "05220": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：敌军阶段那句的『击败』是直接 splice 移除（behavior.js:enemyPhaseStart:788-791），不经过 src/engine/enemies.js:371 的 enemyDefeated：这些类人敌人不进胜利区、银暮秘社敌人被击败时该地点毁灭移议程的章节规则（behavior.js:enemyDefeated:731）不触发、敌人身上钥匙的离场归属（keysLeavingEnemy:124-133）也不结算（钥匙会继续挂在已不存在的敌人身上）。毁灭转移与四项数值加成、R3 目标与卡面一致。 子句：强制-敌军阶段开始：击败其地点每个[[类人]]敌人（近似）"
  },
  "05221": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：①『（或反之）』这半句没有路径：只有你走进骑士地点时才开敏捷检定（behavior.js:locationEntered:389-401，调用点 src/engine/movement.js:225、src/engine/locations.js:265）；骑士自己移动到你的地点走的是 enemyMoved，而共享 enemyMoved（encounter-rules.js:297-299）只派发单卡条目的 onMoved，05221 条目没有脚本，于是不会检定、不会交战。②生成位置不是『任意连接地点』：用第一个存活调查员的所在地算连接地点并固定取第一个（behavior.js:681-687），既不询问生成者，也不一定是抽牌者的地点。③猎物『控制最多钥匙』不进引擎猎物排序（definition.js 写了 prey:'mostKeys'，src/engine/card-ops.js:PREY_RANK:34-74 没有该档），实际由决策者手选（notes.js:13 已承认）。 子句：生成-任意一个与你所在地点连接的地点（近似）；猎物-控制最多钥匙（近似）；强制-其进入你所在地点：同样检定（未实现）"
  },
  "05222": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：①谈判成功只把怪兽毁灭 -1，卡面『翻至线索面』实际不发生：behavior.js:performAction:564-569 调用的是 api.giveClues，而 src/engine/scenario-runtime.js 里没有 giveClues（正确读点是 gainClues:382），可选链让调用静默失败、线索永远不发放。章节测试 tests/tcu-greater-good.test.mjs:172 自己补了同名 giveClues 桩，所以测试全绿也发现不了。②『显现』接在 enemySpawned 上（behavior.js:705-712）：当它被其它效果生成（例如 05223 发号施令从遭遇弃牌堆生成它）时也会追问 1/2 毁灭，而显现只在抽到时结算；询问对象取 leadSeat 而非抽牌者。③生成位置同 05221（取 alive[0] 所在地的连接地点，无选择）。 子句：生成-任意一个与你所在地点连接的地点（近似）；成功：控制其1个毁灭并翻至线索面（未实现）"
  },
  "05223": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『无人地点』口径不同：这里只排除调查员（behavior.js:1019-1021），引擎对『无人』的标准定义是没有调查员且没有敌人（src/engine/encounter.js:142-149 的 spawnAnyEmpty），因此有敌人驻扎的地点也可能被选中；另外场上没有任何空地点时实现回落到全部地点（1021），卡面没有定义这种情况。取牌库顶 2 张异教徒、两张都生成在同一地点、涌动递归结算与卡面一致。 子句：生成在剩余线索最多的无人地点（近似）"
  },
  "05224": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：移动是贪心『第一个没走过的相邻地点』（behavior.js:1039-1049），不是最短路径（同文件 nearestCultist:894-915 其实已有 BFS 可用）：可能绕远路，也可能走进死路停在半途——一旦没走到你的地点，后面的『交战/攻击/把你控制的钥匙放上去』整段被跳过（1050-1056）。就近选择、重整、交战后立即攻击、钥匙归属其余与卡面一致。 子句：逐地点移动直到你所在地点（近似）"
  },
  "05225": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：①『获得险境』完全没有实现路径：beneathTheLodge（behavior.js:1062-1082）只加难度；定义层的 peril 来自印刷识别，而 content/campaigns/theCircleUndone/card-data.js:printedKeywordText:220-226 会删掉含 gains 的句子（实测 definition 里 05225.peril=false）；即便置了 peril，本卡走 api.test 直接开检定，也拿不到遭遇卡 peril 的『其他调查员不能帮忙』（src/engine/encounter.js:99,196 与 src/engine/tests.js:195-197 只对 encounter 上下文生效）。②失败逐点结算是自动的：每点先扣线索、没线索才受恐惧（1070-1079），卡面的『二选一』没有选择窗口。难度 +1、智力(3) 与卡面一致。 子句：控制≥1把钥匙时获得险境（未实现）；每失败1点：失去1线索或受到1恐惧（近似）"
  },
  "05227": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①伤害/恐惧按『地点上所有存活调查员』逐个询问（behavior.js:586-595），而线索是共同支付、逐人分摊（src/engine/turn-flow.js:groupPayment:176-195）：排在后面、实际付 0 个线索的人也会被问一次，卡面只影响『花费了至少 1 个线索』的人。②钥匙归属是『该地点上的全部钥匙都交给行动者』（596-597），不是卡面的『他那把钥匙』；若地点上还有别的钥匙（例如敌人离场留下的）会被一起拿走。共同支付 2×人数线索、移出游戏、行动可见性（线索不足时置 reason）与卡面一致。 子句：每位花费≥1线索者受1伤害或1恐惧（近似）；控制其钥匙（近似）"
  },
  "05228": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：只实现了剧情资产归属这一层：附属到南森（behavior.js:attachPuzzleBox:146-158）、幕 2 目标交给调查员（checkObjectives:667-670 → givePuzzleBoxTo:184-201）、结局加入战役牌组（resolution:862-888）。两个可执行子句都没有路径：①『当你被击败时交给另一位调查员』——引擎有 investigatorEliminated 钩子（src/engine/harm-threat.js:226），本章 behavior 没有定义它；②[action] 整段（熄灭火盆 / 横置幽灵看守人 / 对已横置的它造成 5 点伤害 / 不触发其趁乱攻击 / 团队每场一次）在 behavior.actions:432-475 与单卡条目里都不存在，全仓库也没有任何地方为这个行动引用幽灵看守人（05228 条目 src/cards/encounter-entries/theCircleUndone/forTheGreaterGood/05228.js 只有声明）。 子句：强制-你被击败时：把机关盒交给另一位调查员（未实现）；[action]熄灭你所在地点的火盆（未实现）；[action]横置幽灵看守人（未实现）；[action]若其已横置，对其造成5点伤害（未实现）；本行动不触发幽灵看守人的趁乱攻击（未实现）；团队每场游戏限一次（未实现）"
  },
  "05229": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：额外费用用「使用类型是子弹（usesType=ammo）」来认[[枪械]]（05229.js:14-16,30）；条目注释称「现有卡池里仅[[枪械]]带该使用类型」，但 04204 华饰弓（item/relic/weapon/ranged，不是[[枪械]]）也是 usesType ammo。已用 core-fixture 复现：只控制华饰弓时 validateMove 通过、打出后华饰弓 1→0 且鸣枪示警进弃牌堆，按卡面这笔额外费用不能由非[[枪械]]支付。其余（把全部非精英敌人移到同一连接地点、精英不动、无[[枪械]]时打不出、不引发借机攻击）与卡面一致并有断言（借机攻击只有描述子标记，测试未直接断言）。 子句：额外费用：从你控制的[枪械]花1子弹（近似）"
  },
  "05230": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现「所附属支援不能攻击与你交战的敌人」与附属期间的 [reaction]（改指连接地点非精英敌人、忽略冷漠/反击），需要 attachedCardAbilities(host)/hostRestrictions 读点。另有两处 note 未登记的缺口：①卡面 3 资源的费用实际没有支付——附属事件走 src/engine/actions.js:112-132 的分支，在 playCost（:153）之前就 return，core-fixture 复现资源 30→30、05230 已附属到 05186；②没有校验「占用 2 个手部槽位」，attachTo 只按 firearm 特性过滤（05230.js:22），core-fixture 复现可附属到 1 个手部槽位的 01016 .45自动手枪。此外 maxPerTarget:1 是卡面没有的额外限制（卡面未写每个支援限 1 张）。 子句：费用 3 资源（未实现）；附属到占用 2 个手部槽位的[枪械]支援（未实现）；所附属支援不能攻击与你交战的敌人（未实现）；[reaction]未交战时改指连接地点非精英敌人，忽略冷漠/反击（未实现）"
  },
  "05231": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现「忽略所有费用」的引擎费用管线（费用校验/每回合上限记账），改为直接调用所选支援首个 action/free 描述子的 resolve；只覆盖用 resolve 实现的能力，需要 target 声明才能用的能力会被跳过。测试 392-403 断言了忽略费用（秘密 4→4、支援未横置）与移动效果；「从手牌揭示→可弃掉抽 1 张」分支（05231.js:85-94）没有断言。 子句：结算其[行动]/[快速]能力，忽略所有费用（近似）"
  },
  "05234": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两条 [reaction] 没有按卡面的「在你打出诱敌时」实现：条目在 played 的 resolve 开头一次询问结算方式并当场用 api.loseResources 支付额外资源（src/cards/entries/05234.js:11-13,42-66），选择/支付时点从「打出前」移到「结算中」，费用数值（+2/+2/+4）与净效果与卡面一致。另一处实际偏差在「2 次连接内」模式：模式是否可选只按剩余资源判断，若 2 次连接内没有非精英敌人，targetLocation 会回落到你自己的地点（05234.js:49-60）——实测资源 30→26（基础 2 + 额外 2）、所在地点的敌人被自动横置，等于用「2 次连接内」的价格做了基础版；该模式在 tests/tcu-player-m2-3.test.mjs:457-472 中没有任何断言（只覆盖 base/pair）。 子句：[reaction]打出时+2费：改为最多2个非精英敌人（近似）；[reaction]打出时+2费：改为2次连接内的地点（近似）"
  },
  "05235": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目注释已登记「从弃牌堆打出」的口径（src/cards/entries/05235.js:12-14）：先把选中的事件从弃牌堆移入手牌，再按普通事件打出（05235.js:46-47）。结算期间该事件位于手牌而不是弃牌堆/结算区，且没有设置 state._fromDiscardCode（src/engine/actions.js:262-276），依赖「从弃牌堆打出」的读点不会命中；若 doPlay 因「不能打出该类卡」（如 cannotPlayTypes）等原因在 src/engine/actions.js:79-83 提前 return，牌会留在手牌，随后 exileFromDiscard 因不在弃牌堆而返回 false（src/engine/api-card.js:119-128），「结算后移出游戏」不会发生。另：弃牌堆没有可打出的法术/洞察事件时，能力仍出现在 legalMoves 里（实测空弃牌堆、以及只有 01088 非目标事件时都可点），此时 cost.exhaust 已付，但 resolve 在 placeDoomOnCard 之前 return（05235.js:32-35），不放置毁灭，与卡面「横置并放 1 毁灭」的费用口径不符。费用 -1 与正常结算后移出游戏两条路径已实现并有断言。 子句：从弃牌堆打出一张法术或洞察事件（近似）"
  },
  "05236": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现「因恐惧被击败时放逐」的离场原因判定与战役放逐记账（state.exiled）——用条目级 removeFromGameOnLeave 近似为「离场即移出游戏」（src/cards/entries/05236.js:12-24）。读点是 src/engine/assets.js:226-242（leaveAsset 是所有离场路径的唯一出口）：不只是因恐惧被击败，被效果弃掉、槽位/剧本移除等任何离场都会把 05236 写进 state.removedFromGame；放逐账本 state.exiled / state.exiledBySeat 不记录（对照 05237 的 exileAfterPlay 走 exilePlayerCard，src/engine/engine.js:790-795）。测试 tests/tcu-player-m2-3.test.mjs:498-515 断言的也是 removedFromGame。另：「沉静」实现比卡面更严——composure 生效时 src/engine/harm-threat.js:142-150 把候选收窄到指路鬼魂（其他己方支援也不能先分），卡面只要求先于调查员卡；+1 智力由 modifiers 提供（05236.js:25-27）。 子句：强制：因恐惧被击败时将其放逐（近似）"
  },
  "05237": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：①引擎没有 doomWouldBePlaced 窗口（毁灭写入只在 src/engine/act-agenda.js 的 addDoom / placeDoomOnCard），实现改为「自己回合快速打出」：playCondition 只要求密谋上已有毁灭（src/cards/entries/05237.js:26），结算用 removeDoom 减 state.doom（src/engine/api-enemy.js:143-147），因此只能取消当前密谋上已有的 1 点毁灭，不能取消刚放到敌人/地点/幕卡上的毁灭（卡面「任意冒险卡牌 / 该卡牌」）；且快速手牌在玩家窗口只对 state.currentSeat 列出（src/engine/encounter.js:389-398），神话阶段放置毁灭时本来也走不到这个入口。②「每场游戏最多 1 张」条目 note 记为按调查员 gameFlags 记账，但 playCondition 用 .some() 对全体调查员判断（05237.js:27-30），实测两人局第一人打出后第二张被拒——功能上是团队级，账本本身仍是 inv.gameFlags（不是战役级记录）。快速（played fast:true → turn-flow.js:481-483 判 0 行动）与放逐自身（exileAfterPlay → actions.js:252,292 → exilePlayerCard，engine.js:790-795）已实现。 子句：在毁灭标记将要放到任意冒险卡牌上时打出（近似）；取消将要放到该卡牌上的1个毁灭标记（近似）"
  },
  "05238": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：差异只在 [tablet]：实现里直接取所在地点第一个 [[幽灵]] 敌人攻击（behavior.js:745-748 的 locals[0]），没有让结算玩家选择由哪个幽灵敌人攻击（卡面『a Spectral enemy』的选择权属于玩家；多个幽灵敌人时结果可能不同）。四个标记的数值（-2/-3 与困难 -3/-4）、skull『阵法再抽一个』、cultist『揭示时缺伤害/恐惧各受 1』、elder_thing『阵法失败结算该地点每个闹鬼』都与卡面一致。 子句：[tablet] -3；失败时所在地点幽灵敌人攻击你（近似）"
  },
  "05239": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『被偷走的灵魂』用 enemy.lostSouls / state.scenarioFlags.watcherSouls 承载（看守人不在场时也先记在 flags，enemySpawned 时补算），不是卡面的『在看守人上放 1 个资源作为被偷走的灵魂』；另外 enemyStatModifier 在卡面的 +1 攻击值之外还额外给 +1 躲避，属于卡面没有的增益（生命 +1×人数、洗回弃牌堆、推进密谋 2a 一致）。 子句：每个被抓走的人在看守人上放1资源作灵魂（近似）；直到冒险结束：每灵魂+1攻击值、+1每人生命（近似）"
  },
  "05241": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：三处形式差异：①『放到自己面前』没有对应原语，地点直接作为普通地点入场、调查员被移入（这也是 05242 正面『不能离开面前地点』缺实现的前提）；②火盆用 P2.11 的 locationFlag('brazier') 记录，卡面要求的是『在这些地点放 1 个资源标记』；③命运卡按洗混后的顺序逐张结算，卡面要求『按玩家顺序结算每张发到的剧情卡』（先手玩家两张再下一人）。随机分配、女巫集会点火盆、逐张发牌与翻面结算路径都存在。 子句：放到自己面前并立即移入（不能取消）（近似）；在这些地点放1资源标记表示已点燃（近似）；按玩家顺序结算发到的每张剧情卡（近似）"
  },
  "05242": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺两条：①正面『每位调查员不能离开自己面前的地点』完全没有实现——本章 behavior 没有 moveError/movementError，未访之岛之间按印刷符号（squiggle/moon/plus）互连，调查员可以自由离开所在岛；②背面『把放在一边的每张看守人的攫噬和看守人的注视洗入遭遇牌库』只做了注视 05272，看守人的攫噬 05087×2 在 setup 被放进 setAside（behavior.js:259）后再没有任何洗入路径（notes.js:14 还把这句记成卡表里并不存在的 05286，属登记错误）。另外『把面前地点放回中央、调查员不再受阻』因无『面前』状态而无实际语义；火盆用 locationFlag 代替资源标记。待人工复核：补 moveError 时需同时实现背面解除限制。 子句：每位调查员不能离开自己面前的地点（未实现）；把在一边的看守人的攫噬、注视与弃牌堆洗入（未实现）；把面前地点放回中央，调查员不再受阻（近似）；将灵怪陷阱入场；女巫集会则点燃火盆（近似）"
  },
  "05243": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺正面 [fast]：这条能力没有声明也没有接线——单卡条目 05243.js 只有 code/scope/implemented/note，definition.js:166-174 的 actStage 只给 objective/reveal，behavior.actions:313-325 只出『阵法』场景行动。引擎通道其实存在（幕卡可进能力源 src/engine/ability-rules.js:198；同类写法见 entries/05048.js 用 testBegins + api.reduceTestDifficulty），但本章既没在条目里声明，也没在 behavior 里提供花线索降难度的入口（scenario api 也没有 reduceTestDifficulty，见 src/engine/scenario-runtime.js:157-582），『阵法检定期间』（actionKind:'circle'，behavior.js:369-375）上没有任何挂载，所以『花 1 线索使本次技能检定难度 -2』没有实现路径。背面『每张剩余放在一边的[女巫]敌人』只部分实现：setup 把 3×05090 + 1×05091 放进 setAside（behavior.js:255-267），actReveal:501 只搬 1×05090+1×05091——法术成功时 3 张学徒全留在一边（少搬 2 张），法术破坏且 1-2 人局时少搬 1 张；另外 05057 安妮特·梅森根本没有进 setAside，法术被破坏时她若按卡面算『剩余放在一边的[女巫]敌人』也不会被洗入（待人工复核 setup 原文把哪些女巫放在一边）。其余：目标（火盆全亮）、揭示灵怪陷阱并把岛上调查员拉入、两分支生成数量、遭遇弃牌堆一并洗入，都与卡面一致；两分支用『cast 为真 / 否则』判定，与战役记录 theWitchesSpellWasBroken 互斥（theWitchingHour/behavior.js:497-522 只写其中之"
  },
  "05244": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 3 条：①[fast]『阵法行动期间花 1 线索使本次技能检定难度 -2』——同 05243，条目没有声明、behavior 也没有入口（引擎通道存在但本章未接），『阵法检定期间』上没有任何挂载；②『包括封印在场上卡牌上的[cultist]标记』——只 filter 了 state.chaosBag（behavior.js:502-504），封印标记单独存在 state.chaos.sealed（chaos-bag.js:84-98），释放时会回袋；③『直到战役结束』——只改本关袋子，没写 state.campaign.chaosBag，下一关用战役袋重建（setup.js:679-687 → chaos-bag.js:5-10）后 [cultist] 标记全部回来（该标记由幕间故事 II『同意/撒谎』的战役效果加入，manifest.js:129-142）；引擎的永久路径（changeChaosBag 的 permanent 选项 chaos-bag.js:16-28、campaign-effects.js:693-700 replaceChaosFamily）本章一个都没用。②在 TCU 没有封印来源，暂时不可观察；③在本关之后（《黑王座之前》等）可观察。目标（火盆全灭）与揭示/拉人两条与卡面一致。 子句：[fast] 阵法行动期间花 1 线索：本次检定难度 -2（未实现）；包括封印在场上卡牌上的标记（未实现）；直到战役结束（未实现）"
  },
  "05245": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 2 条、近似 1 条：①[fast]『阵法行动期间花 1 线索使本次技能检定难度 -2』没有实现路径（条目未声明、behavior 无入口、阵法检定窗口无挂载；引擎通道存在但本章未接）；②背面『本局剩余时间不能与约瑟夫·梅吉尔谈判』只写了 state.scenarioFlags.noParleyJosef（behavior.js:509），全仓库没有任何读取点（谈判读取点 src/engine/parley.js:38-94；05085 条目无 abilities；本章 behavior.actions:313-325 也不提供谈判）。顺带一提，本关里 05085 其实没有任何谈判行动可用，所以这条限制当前也不可观察，但卡面规则确实没有实现路径（待人工复核：若后续给 05085 补通用谈判，需要在 parley 的条件里过滤 noParleyJosef）；③『秘社组剩余卡牌』近似：setAside 是 3×05095+05096+2×05097（behavior.js:255-267），actReveal:512 固定搬 4 张，1-2 人局（生成 1 张 05095 后应搬 2 张新信徒）少搬 1 张，且生成的 05095 没有从 setAside 移除（账本残留 2 张）。其余：目标（火盆全灭）、揭示/拉人、生成 1-2 张秘社新信徒、约瑟夫健在则生成在灵怪陷阱，都与卡面一致。 子句：[fast] 阵法行动期间花 1 线索：本次检定难度 -2（未实现）；秘社组剩余卡牌与弃牌堆洗入（近似）；本局剩余时间不能与约瑟夫·梅吉尔谈判（未实现）"
  },
  "05246": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺两条：①正面 [fast]『阵法行动期间花 1 个线索，使本次技能检定难度 -2』没有实现路径（引擎没有幕卡/剧本卡免费能力通道，也没有『花线索降难度』原语）；②背面『调查员不能与约瑟夫·梅吉尔谈判』只写了 state.scenarioFlags.noParleyJosef，全仓库没有任何读取点，谈判入口 src/engine/parley.js 不查该标志（对照 content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js:611-612 会在 actions 里过滤 noParley*）。另：银暮秘社组共 6 张（05095×3、05096、05097×2），背面只洗入 4 张，生成的 05095 没有从放在一边移除，剩余 1–2 张永远留在一边。 子句：[fast] 阵法行动期间花1线索：难度-2（未实现）；把在一边的银暮秘社组与弃牌堆洗入（近似）；本局剩余时间不能与约瑟夫·梅吉尔谈判（未实现）"
  },
  "05247": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺正面 [fast]『阵法行动期间花 1 个线索，使本次技能检定难度 -2』：条目未声明、behavior 无入口、『阵法检定期间』也没有任何挂载（引擎的能力通道存在但本章未接，同 05243）。目标子句用『永久粘住』近似：enemyDefeated:608-614 在击败瞬间的判定是正确的，但 checkObjectives:561-565 只读 state.scenarioFlags.watcherDefeatedAt 与当前火盆状态，因此看守人先在火盆未点燃时于灵怪陷阱被击败、之后再把火盆点亮，同样会推进，而卡面要求两个条件在击败时同时成立（与 05248 同一处近似）。背面 (→结局1) 由 actReveal:516-519 的 api.finish('r1') 结算，与卡面一致。 子句：[fast] 阵法行动期间花 1 线索：本次检定难度 -2（未实现）；目标：看守人在灵怪陷阱被击败且该处火盆已点燃（近似）"
  },
  "05248": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺正面 [fast]『阵法行动期间花 1 个线索，使本次技能检定难度 -2』：本章没有幕卡能力实现，引擎也没有线索换难度的原语。目标子句基本实现，但用 state.scenarioFlags.watcherDefeatedAt 把『在灵怪陷阱被击败』粘住：看守人先在火盆点燃时于灵怪陷阱被击败，之后再用阵法熄灭火盆同样会推进，而卡面要求两个条件在击败时同时成立（enemyDefeated 里的即时判定是准确的，问题在 checkObjectives 也接受旧标记）。背面 (→结局4) 一致。 子句：[fast] 阵法行动期间花1线索：难度-2（未实现）；目标：看守人在灵怪陷阱被击败且火盆未点燃（近似）"
  },
  "05249": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 [action]：撤退。引擎的撤退行动只在 location.resign 或 state.scenario.resignAnywhere 时出现（src/engine/moves.js:451、773；turn-flow.js:scenarioResignAvailable:367-372），本章 definition.js 的 miskatonicRiver 没有 resign 字段，behavior.actions 也只推『阵法』行动，因此米斯卡塔尼克河没有撤退入口，调查员无法主动结束本关（本战役其它章用 behavior 的 scenarioAction + api.resign 实现，如 theWagesOfSin/atDeathsDoorstep）。待人工复核：补 resign:true 或补一个撤退 scenarioAction。 子句：[action]：撤退，划船回到米斯卡塔尼克河岸（未实现）"
  },
  "05253": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：闹鬼两处简化：①『查找遭遇牌库和弃牌堆找出一张夜鹰并将其生成在此地点』在两张牌堆里都没有夜鹰时仍会凭空生成一张（behavior.js:420-422 的 else 分支），没有来源卡；②『最近的夜鹰攻击你』取 state.enemies 里第一只 [[夜鹰]]（behavior.js:401），既不是距离最近，也没有『选择哪只夜鹰攻击』的语义。阵法数值 11、点火盆、迷雾挡路一致。 子句：闹鬼：查找牌库与弃牌堆找夜鹰并生成在此（近似）；或最近的夜鹰攻击你（近似）"
  },
  "05254": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：『本轮下一次移动行动 +1 行动』用 beforeMove 实现：每座位本轮一次，调查阶段直接扣 actionsLeft，非调查阶段记 pendingActionLoss（tests/tcu-union-disillusion.test.mjs:374-382）。差异在于 beforeMove 由 relocateInvestigator 对任何位移触发（src/engine/movement.js:256，包括卡牌效果造成的移动），卡面只对『移动行动』加价，因此效果位移也会被额外扣 1 行动。阵法 10、点火盆、迷雾挡路一致。 子句：闹鬼：本轮下一次移动行动额外+1行动（近似）"
  },
  "05257": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺『幽灵看守人位于灵怪陷阱时获得反击』：全章没有任何按地点给敌人授予 retaliate 的地方——definition.js:96 只设 spectral，behavior.js 只有数值型 enemyStatModifier，src/engine/combat.js:395 的反击只读 enemy.retaliate，而看守人 05086 自身关键词只有 Alert/Hunter。其余（四技能合计 20 的阵法、成功可点燃/熄灭此处火盆、闹鬼 1 伤害 1 恐惧、背面迷雾封锁不可进入）一致。 子句：看守人在灵怪陷阱时获得反击（未实现）"
  },
  "05258": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：卡面两条能力都没有实现路径：注册条目 abilities=0、modifiers=0，所以 +1[combat] 不进入 getStat；reaction 也没有描述子，全仓库没有 05258 的行为分支（entrySource 自称「卡面能力由玩家卡条目层处理」，但 src/cards/entries/05258.js 不存在）。附带缺口：卡面写「即便该次攻击被取消」也能反应，而引擎在 src/engine/enemies.js:128-132 对被取消攻击提前返回，enemyAttacked 窗口（:173-177，注释自称覆盖被取消的攻击）实际不会触发，补实现时需先改这里。待人工复核：+1 技能与 reaction 是否留给后续批次。 子句：你得到+1[combat]（未实现）；[reaction]敌人攻击你后横置：发现1线索（未实现）"
  },
  "05259": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：卡面两条能力均未实现：+1[intellect] 无 modifiers，取消显现的 reaction 无能力描述子，behavior.js 里也没有杰罗姆·戴维斯的分支。引擎侧其实已具备所需原语——src/engine/encounter.js:98-119 的 encounterDrawn 窗口支持取消、且对抽牌者同地点的调查员开放，缺的是 05259 的条目与「弃手牌合计至少 2 个[智力]图标」的自定义成本。待人工复核：这两条是否计划由后续批次补。 子句：你得到+1[intellect]（未实现）；[reaction]同地点调查员抽到诡计时，横置并弃2点[智力]图标手牌取消显现（未实现）"
  },
  "05260": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：卡面两条能力均未实现：没有 modifiers（+1[willpower]），也没有 abilities（显现期间的检定成功反应）。引擎侧已有对应触发点——src/engine/tests.js:816-820 在 state._treacheryResolving 期间检定成功时触发 treacheryTestSuccess，正是卡面「显现效果期间的技能检定成功后」；缺的是 05260 的条目（含发现线索的 resolve）。待人工复核：这两条是否计划由后续批次补。 子句：你得到+1[willpower]（未实现）；[reaction]显现效果期间检定成功后横置：发现1线索（未实现）"
  },
  "05261": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：卡面两条能力均未实现：没有 modifiers（+1[agility]），也没有 [fast] 检定中降难度的能力。引擎已有 testBegins 窗口与 api.reduceTestDifficulty（src/cards/entries/05159.js:14-31 是同一原语的使用示例，src/engine/tests.js:126 统一用 difficulty - difficultyReduction 判定），缺的是 05261 的条目与「花费 2 资源 + 横置」的成本声明。待人工复核：这两条是否计划由后续批次补。 子句：你得到+1[agility]（未实现）；[fast]自己检定期间花2资源并横置：本次难度-1（未实现）"
  },
  "05262": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：命运分支本身齐全（控制剧情支援、记录还活着、被夺走时以敌人面生成、追查时横置不交战、否则交战），唯一缺口是「本场冒险不占盟友槽」：支援由 giveAsset 直接进 inv.assets（src/engine/scenario-runtime.js:474-483），但 05258 的 cardDef 仍是 slots=['Ally']、unique=true，会计入 slotUsage/allySlotsOk——实测在已有 05258 时 canEquip(01021)=false，玩家再打自己的盟友会被迫弃置，与卡面相反。另有两处已声明近似：翻回敌人面用 spawnStoryEnemy 生成 05262b 代替翻面（notes.js:9）；日志标记用 disappearedIntoTheMist/wasClaimedBySpecters 记录承载（notes.js:10）。小差异：无追查时的「与你交战」走 autoEngageAt→preyTarget（src/engine/engine.js:607-615、src/engine/card-ops.js:82-101），同地点多名调查员时会问队长选猎物，而非固定与结算这张卡的人交战。待人工复核：不占盟友槽是否需要条目级 slotless 声明。 子句：本场冒险不占盟友槽（未实现）；被幽灵夺走：翻回敌人面（近似）"
  },
  "05263": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：与 05262 同构：命运结算齐全，缺口是「本场冒险不占盟友槽」——05259 由 giveAsset 直接入场，但 cardDef 仍是 slots=['Ally']、unique=true（src/engine/assets.js:slotUsage:73-84 / allySlotsOk:177-192），实测已有 05259 时 canEquip(01021)=false。另：翻回敌人面直接生成 05263b（notes.js:9 已声明）；日志标记用记录数组承载（notes.js:10）；无追查时「与你交战」走 preyTarget，同地点多人时改问队长选猎物。待人工复核：不占盟友槽是否需要 slotless 声明。 子句：本场冒险不占盟友槽（未实现）；被幽灵夺走：翻回敌人面（近似）"
  },
  "05264": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：与 05262 同构：命运结算齐全，缺口是「本场冒险不占盟友槽」——05260 由 giveAsset 直接入场，但 cardDef 仍是 slots=['Ally']、unique=true（src/engine/assets.js:slotUsage:73-84 / allySlotsOk:177-192），实测已有 05260 时 canEquip(01021)=false。另：翻回敌人面直接生成 05264b（notes.js:9 已声明）；日志标记用记录数组承载（notes.js:10）；无追查时「与你交战」走 preyTarget，同地点多人时改问队长选猎物。待人工复核：不占盟友槽是否需要 slotless 声明。 子句：本场冒险不占盟友槽（未实现）；被幽灵夺走：翻回敌人面（近似）"
  },
  "05265": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：与 05262 同构：命运结算齐全，缺口是「本场冒险不占盟友槽」——05261 由 giveAsset 直接入场，但 cardDef 仍是 slots=['Ally']、unique=true（src/engine/assets.js:slotUsage:73-84 / allySlotsOk:177-192），实测已有 05261 时 canEquip(01021)=false。另：翻回敌人面直接生成 05265b（notes.js:9 已声明）；日志标记用记录数组承载（notes.js:10）；无追查时「与你交战」走 preyTarget，同地点多人时改问队长选猎物。待人工复核：不占盟友槽是否需要 slotless 声明。 子句：本场冒险不占盟友槽（未实现）；被幽灵夺走：翻回敌人面（近似）"
  },
  "05266": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处差异：①实现多加「未横置」门槛——夜鹰被躲避横置后卡面的持续减益会消失，但卡面是持续能力，横置不影响；②用 some() 判定，同一地点 2–3 张夜鹰仍只 -1，卡面每张各 -1（应可叠加到 -2/-3）。单测 tests/tcu-union-disillusion.test.mjs:551-556 只覆盖单张、未横置的情形，未覆盖这两点。 子句：所在地点调查员-1[意志][智力][战斗][敏捷]（近似）"
  },
  "05267": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：选择窗口齐全（有闹鬼时二选一，无闹鬼时自动取 +2/+2），但 +2 攻/+2 躲的时限绑定过窄：enemyEngaged 记 ravenBoostRound=state.round，enemyStatModifier 要求 state.phase==='investigation' 且同一 round（behavior.js:696-697），所以只在「交战当轮、且当轮调查阶段尚未结束」时生效。神话阶段抽到并交战能覆盖（round 在神话阶段开始时 +1，src/engine/turn.js:78-80），但猎手在敌人阶段移动过来交战、或幕/议程在敌人阶段后生成时，本轮调查阶段已过、下一轮 round 又不匹配，加成永远不生效；卡面口径应是「直到下一个调查阶段结束」。另：可选「闹鬼」分支只看印刷 haunted 数组（locById(...).haunted），不识别 hauntedGrants 授予的闹鬼能力；api.haunted 本身会结算该地点全部闹鬼能力（src/engine/haunted.js:resolveHaunted:376-431），与卡面「每个闹鬼能力」一致。单测 tests/tcu-union-disillusion.test.mjs:551-565 的 state 固定在 phase='investigation'、round=1（:70-71），所以断言 enemyStatModifier=2 通过，未覆盖敌人阶段交战的情形。 子句：强制 - 交战后：结算所在地点每个闹鬼，或+2攻/+2躲至调查阶段结束（近似）"
  },
  "05269": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「任意调查员的威胁区」没有选择窗口：实现固定把它加到抽到它的调查员威胁区（behavior.js:781-788），多人局无法按卡面把这张强制卡放到别人身上（险境只限制他人参与，不限制这个选择）。②resolveEncounter 返回 false，src/engine/encounter.js:170-173 会再把同一张牌塞进遭遇弃牌堆，形成「同一张牌同时在威胁区与弃牌堆」的重复记账，弃牌堆洗回后可能与仍在场的威胁卡重复出现。③额外伤害的触发点（beforeHarm，早于伤害分配与取消窗口）符合卡面「将要受到伤害时」。 子句：显现 - 加入任意调查员的威胁区（近似）"
  },
  "05270": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05269 同构：①「任意调查员的威胁区」固定为抽牌者，少一个选择窗口（behavior.js:781-788）；②返回 false 让引擎把同一张牌也放进遭遇弃牌堆（src/engine/encounter.js:170-173），威胁区与弃牌堆重复记账，洗回后可能与仍在场的威胁卡重复出现。额外 2 点恐惧与弃卡时机（beforeHarm，早于伤害/恐惧分配与取消窗口）符合卡面「将要受到恐惧时」。 子句：显现 - 加入任意调查员的威胁区（近似）"
  },
  "05272": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「二选一」有实现，但缺目标合法性校验：无论你所在地点是否有闹鬼能力，都会提供「结算你所在地点的闹鬼能力」选项（behavior.js:804）；选中后 api.haunted 返回 not-haunted 什么都不结算（src/engine/haunted.js:resolveHaunted:376-383），等于可以规避掉本该只能选的看守人地点闹鬼。反向（看守人地点没有闹鬼能力）时选 watcher 也会空结算，但该选项只在看守人在场时出现（805），且卡面只要求二选一，属同一类边界。api.haunted 会结算该地点全部闹鬼能力，与卡面单数表述在单能力地点等价。另：无 api.choose 时默认取 here（806），同样绕开校验；该卡没有单测覆盖显现结算（tests/tcu-union-disillusion.test.mjs 只测了幕 2 背面把它洗入牌库）。 子句：失败者结算其地点或看守人地点的闹鬼（近似）"
  },
  "05275": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：自我击败用「把伤害打满」实现：lethalSelfDamage 把 damage 置为上限并记 defeatCause='damage'（src/engine/harm-threat.js:245-281），关末 applyDefeatTrauma 会按伤害型击败再追加 1 点肉体创伤（src/engine/campaign-flow.js:260-270），而卡面只写「承受 1 点精神创伤」（精神创伤已在打出时由 05275.js:55 记入）。已用 core-fixture 复核：打出后 defeated=true、damage=9/9、defeatCause='damage'、trauma={physical:0,mental:1}，随后关末流程会补 physical+1，即整关合计 2 点创伤。其余子句（发现 3 线索、交出/放置线索、1 点精神创伤、不触发趁乱攻击）与卡面一致；测试只覆盖交出分支，place 分支无断言。 子句：你被击败（近似）"
  },
  "05279": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：「附属事件可当作手牌打出」改用能力通道实现（横置黛雅娜 + 1 秘密 + 印刷资源费 → replayPlayedCode）；因此不能在该事件的快速反应窗口里打出，且需要预选目标的 played 事件不会自动选目标。其余效果（附属、限 1 张、打出后仍附属）已实现。补充：replayPlayedCode（src/engine/api-card.js:130-147）直接执行该事件的 played 描述子，不校验事件自身的 playCondition / fast 时点；附加费用取印刷费 api.cardCost（05279.js:51，不吃 playCost 的折扣修正）。 子句：附属事件可当作手牌打出（近似）"
  },
  "05280": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：只实现「受到伤害 / 受到恐惧」两个面向（harmDealt 窗口取消该分量并反向治愈）；「弃掉手牌 / 失去资源 / 失去行动」三个面向未实现（缺遭遇卡结算前的按面向取消原语），对应三个反向效果（抽牌/得资源/得额外行动）同样没有路径。另：时点由卡面「将要」放宽为 harmDealt（已结算后把 context.damage/horror 清零），等价于取消该次伤害/恐惧；触发面另限定为敌人攻击或正在结算的遭遇卡。 子句：快速；遭遇卡/敌人攻击令你弃手牌时打出（未实现）；令你失去资源时打出（未实现）；令你失去行动时打出（未实现）；执行相反效果：抽牌/得资源/得额外行动（未实现）"
  },
  "05281": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「把该技能的基础值设为 5」用「5 − 当前基础值」的临时加值修正实现（state.effects + modifiers skill:<skill>，duration endOfTurn），检定读点 getStat 得到 5、回合结束由统一过期点清理，数值结果与卡面等价。差异在语义：这不是 base 覆写，若同一回合另有按「基础值」覆写或封顶的修正（例如 statOverride），叠加结果会与卡面不同。测试只断言选技能后的数值与回合结束恢复，未断言非自己回合被拒。 子句：直到回合结束把该技能基础值设为5（近似）"
  },
  "05285": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① 强制①不是在「将要放置」的替换窗口结算：src/engine/act-agenda.js:336-344 addDoom 先 state.doom += amount 再触发 doomPlaced，behavior.js:843 把刚加的毁灭回退再放裂口——结果等价但属顺序近似（本章 behavior.js:982 scenarioApproximations「05285 强制①」已登记）；一次放置多点毁灭（addDoom(n>1)）只结算一波「人数+1」裂口。② 背面第二条「卡尔知晓宇宙之秘 → 结局 4」没有显式读记录，落在 else 分支（非 Anette 即 r4）；两变体互斥且开局必按剧本日志入场，实际等价，但两条记录全缺时也会走 r4 而非卡面未定义。③ 强制①的「随机地点」从在场地点洗牌取样（reference 混洗 8 张移出版本，等价，behavior.js:981 scenarioApproximations「随机地点」），人数取 state.numInvestigators（含已败退者）。 子句：强制①：毁灭将放到本密谋时，改为人数+1 个随机不同地点各放 1 裂口（近似）"
  },
  "05286a": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两处等价不同：①「必须立即花费并推进」被实现为玩家可选的推进行动（moves.js:447 列出 advanceAct；回合末窗口 act-agenda.js:160-164 给了 canSkip 的「暂不推进」），因此凑齐线索后可以拖着不推进，与卡面的强制立即不同。②幕上的裂口不是放在幕卡实例上，而是整章一个 scenarioFlags.actBreaches 计数（P2.11 只支持地点裂口，behavior.js:980 已登记），推进时不搬动、计数自然延续到下一张幕，效果等价但承载形式不同。『[fast] 移除 3 个裂口并随机地点放 1 线索』本身完整（0 行动、需≥3、真随机抽取在场地点、测试覆盖报价与结算）。 子句：目标-凑齐所需线索后必须立即花费并推进（近似）；本幕推进时，幕上的裂口移到下一张幕（近似）"
  },
  "05288a": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05286a（版本一）同一套印刷文本与同一套实现，偏差也相同：①「必须立即花费并推进」实为玩家可选推进（moves.js:447；回合末窗口可「暂不推进」）；②幕上裂口以整章一个 scenarioFlags.actBreaches 计数承载（P2.11 无「幕卡上的裂口」原语），推进时计数延续即等价于搬到下一张幕。版本二的幕牌库为 ['05288a','05289']（definition.js:98-108），actReveal 用 BOSS_BY_ACT 把背面接到卡尔·桑福德，数据链完整。 子句：目标-凑齐所需线索后必须立即花费并推进（近似）；本幕推进时，幕上的裂口移到下一张幕（近似）"
  },
  "05290": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：图标计数把 wild 图标并入 [willpower]（behavior.js:438 + :33），卡面只写「每有 1 个[willpower]图标」——按参考实现（Haskell SkillIconCost 计 WildIcon）而非卡面；本地复现：弃 1 张只有 1 个 wild 图标的牌（10010）会移 2 个裂口。同类差异见于 05292（intellect+wild），而 05296 只数 agility（不含 wild），三张实现口径不一致。另：无手牌时行动仍列出并空结算（:190-193 只打日志，费用不可支付未拦截）；幕上裂口以 scenarioFlags.actBreaches 承载（章节级，behavior.js:980）。 子句：该手牌每有 1 个[意志]图标额外移 1 个裂口（近似）"
  },
  "05291": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：成功 0 点（value == difficulty）时仍会移 1 个裂口：behavior.js:427 用 Math.max(1, …) 强制下限，卡面「每成功超过难度 1 点移 1 个」应为 0 个（本地复现：value=difficulty 成功 → actBreaches +1）。移动量再按该地点实际裂口数封顶（:428）。幕上裂口以 scenarioFlags.actBreaches 承载。 子句：每成功超过难度 1 点，移 1 个裂口到当前幕（近似）"
  },
  "05292": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05290 同一 helper：wild 图标被当作 [intellect] 图标计数（behavior.js:453 + :33），卡面只写「每有 1 个[intellect]图标」，属按参考实现而非卡面的数值近似。另：无手牌时行动仍列出并空结算；幕上裂口以 scenarioFlags.actBreaches 承载。 子句：该手牌每有 1 个[智识]图标额外移 1 个裂口（近似）"
  },
  "05293": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：同 05291：成功 0 点仍移 1 个裂口（behavior.js:427 的 Math.max(1, …)），卡面应为 0 个；上限按该地点裂口数封顶（:428）。幕上裂口以 scenarioFlags.actBreaches 承载。 子句：每成功超过难度 1 点，移 1 个裂口到当前幕（近似）"
  },
  "05294": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「结算其显现」用「放回遭遇牌库顶再抽 1 张遭遇牌」实现（behavior.js:483-487），会经过 encounterDrawn 反应/取消窗口（src/engine/encounter.js:96-119），与「就地结算该牌显现」不等价地多一层窗口（本地复现：deck=[05306,10672,05308] → 弃 3 张、抽回 10672、移 1 裂口）。② 行动只在「南区有裂口 且 遭遇牌库非空」时列出（:465），卡面是 [fast]、无裂口时也合法（效果为 0）；遭遇牌库空时引擎本会自动洗回弃牌堆（src/engine/encounter.js:90-95），也被这条 gating 挡掉。③ 只按 power 特性筛牌、不校验 type==='treachery'（:476）；本环境 power 特性遭遇卡均为诡计，无实际差异。幕上裂口以 scenarioFlags.actBreaches 承载。 子句：选择其中 1 张[力量]诡计并结算其显现能力（近似）"
  },
  "05295": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① 少一个选择窗口：behavior.js:509 直接丢弃手牌数组前 count 张（本地复现：手握 [01020,01021,01022]、选 2 张 → 弃 01020/01021），卡面要求「选择」弃哪些手牌，弃哪个牌涉及弱点/关键牌，不能等价。② count 上限被 min(手牌数, 该地点裂口数) 夹住（:499），卡面允许弃超过裂口数量的牌（多弃的应白弃）。③ 幕上裂口以 scenarioFlags.actBreaches 承载。 子句：[fast] 选择并弃掉任意数量的手牌（近似）"
  },
  "05297": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：同 05291/05293：成功 0 点仍移 1 个裂口（behavior.js:427 的 Math.max(1, …)），卡面应为 0 个；上限按该地点裂口数封顶（:428）。幕上裂口以 scenarioFlags.actBreaches 承载。 子句：每成功超过难度 1 点，移 1 个裂口到当前幕（近似）"
  },
  "05298": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 1 条：「撤退」在南区教堂有裂口且遭遇牌库非空时不可用。本地复现（构造 05298 地点 breaches=2、encounterDeck 非空，move.rule='locResign'）：实际执行 drawEncounter + 「把南区教堂的 2 个裂口移到当前幕」，inv.resigned 仍为 undefined；裂口为 0 或遭遇牌库为空时撤退才正常（tests/tcu-clutches-chaos.test.mjs:501-512 只在无裂口状态测撤退，所以未暴露）。根因：behavior.performAction（:937-970）把 move 传给 handler 校验却在 :958-961 调 handler.perform(state,inv,api,here) 时不传 move.rule，两个 [action]（抽牌 / 撤退）共用一个按状态选分支的 perform。另有次要差异：抽牌行动被额外限定为「有裂口 且 遭遇牌库非空」（:532-534），卡面两条 [action] 相互独立（无裂口时仍可抽牌；牌库空时引擎会自动洗回弃牌堆，src/engine/encounter.js:90-95）。其余子句（抽 1 张、移全部裂口）实现正确。 子句：[action] 撤退：你趁着夜色隐蔽起来（未实现）"
  },
  "05299": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 1 条：「撤退」被「弃 1 个支援」分支吞掉——裂口>0 时选中 locResign 会执行「选支援弃掉 + 移全部裂口」，inv.resigned 不成立（本地复现）。另有两处简化：①「弃 1 个支援」是费用，但无支援时行动照样列出并照移全部裂口（:208-213 只打日志「没有支援可弃」；本地复现 0 支援仍把 2 个裂口移到幕），卡面费用未强制。② 弃支援用 inv.assets.splice + inv.discard.push(asset.code)（:223-225），不经 src/engine/assets.js:226-258 leaveAsset：附属/持续效果不随离场清除、removeFromGameOnLeave 不生效、assetCannotLeavePlay 未过滤（对照 src/engine/assets.js:261 discardRandomAsset 的口径）——带离场能力的支援上有实际差异（待人工复核影响面）。裂口为 0 时撤退正常（:560-561）。 子句：[action] 弃掉场上你控制的 1 个支援（费用）（近似）；[action] 撤退：你趁着夜色隐蔽起来（未实现）"
  },
  "05300": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：① 牌库不足 5 张时没有退化为「弃掉剩余全部」：behavior.js:570 的 choices 过滤后为空，:575 取 choices[0]||0 → 弃 0 张、不移裂口（本地复现：牌库 3 张时行动仍列出、结算后牌库/弃牌堆都不变、幕上裂口 0）。卡面允许选 5/10/15，牌库不足时按实际张数弃牌（弱点仍应被抽出）。② 弱点以「弃牌堆→手牌」承载（:583-584），不经引擎 drawCards 管线（本引擎弱点入场没有抽牌触发读点，实际等价）。③ 行动只在「有裂口 且 牌库非空」时列出（:565），无裂口时不合法地挡住 [action]。幕上裂口以 scenarioFlags.actBreaches 承载。 子句：[action] 弃掉你牌库顶的 5、10 或 15 张牌（近似）"
  },
  "05302": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：「查找」没有玩家选择窗口：behavior.js:646-661 从遭遇牌库/弃牌堆自顶向下取第一张[[Witch]]敌人（behavior.js:985 scenarioApproximations「05302/05305 查找」已登记），卡面要求玩家在牌库+弃牌堆里查找并抽取——有多张女巫时无法选择抽哪张。取到后先 push 到 encounterDeck 顶再走 drawEncounter（:660-663，会经过 encounterDrawn 反应/取消窗口）；两堆都没有女巫时只打日志、不抽取，随后仍照常移裂口（卡面无此分支，属不可能的查找）。动作在无裂口时也列出（:602-604 的 else 分支），与卡面一致。 子句：[action] 查找遭遇牌库和弃牌堆的 1 张[女巫]敌人并抽取（近似）"
  },
  "05303": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两条子句都有结算路径；唯一差异是「幕上的裂口」不用幕卡实例承载，而写单章 JSON 计数 scenarioFlags.actBreaches（P2.11 只支持地点裂口）：幕 [fast]（behavior.js:918-923、938-949）、幕推进时随移（behavior.js:400-402）、[tablet] 失败移除幕裂口（chaos.js:57-59 → behavior.js:873）读的都是同一计数，属承载形式差异而非效果缺失。另：行动只在此处有裂口时列出（behavior.js:613 withBreach），卡面无此前置条件，但没有裂口时结算只会白受 1 点恐惧，净效果一致。tests/tcu-clutches-chaos.test.mjs 只覆盖 05290/05298/05301 三处地点能力，本地点的实现无测试覆盖。 子句：将此处的1个裂口移到当前幕（近似）"
  },
  "05304": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05303 同构：伤害、移 1 裂口、快速（0 行动）都实现；唯一差异是幕上裂口由单章 JSON 计数 scenarioFlags.actBreaches 承载（P2.11 只支持地点裂口，behavior.js:980），幕 [fast]、幕推进随移、[tablet] 移除幕裂口都读同一计数，行为等价。行动仅在本地有裂口时列出（behavior.js:623），空结算只会白受 1 点伤害，净效果不变。本地点无本章测试覆盖。 子句：将此处的1个裂口移到当前幕（近似）"
  },
  "05305": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：搜索被简化（behavior.js:985 与审计账本均登记）：drawEnemyByTrait 只在遭遇牌库/弃牌堆里按特性各找最上面一张，牌库优先，没有让玩家浏览全部候选后选择，也不给「从哪一堆找」的选择；因此只要牌库里还有[[银暮秘社]]敌人，弃牌堆里的同类敌人永远不会被选中。移裂口用幕计数承载（同 05303）。行动费 1 行动（未写 actions:0，src/engine/turn-flow.js:463），与卡面 [action] 一致。本卡无本章测试覆盖。 子句：[action]：查找遭遇牌库和弃牌堆的[[银暮秘社]]敌人并抽取（近似）；然后把此处所有裂口移到当前幕（近似）"
  },
  "05307": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「附属」用地点标记 location.primordialGateway 承载，但 resolveEncounter 返回 false（behavior.js:297），引擎在显现结算后立刻把 05307 放进遭遇弃牌堆（src/engine/encounter.js:170-173），关闭时 :677 又 push 一次——同一张牌在弃牌堆出现两份，而「已附属、应在场上」的诡计实际躺在弃牌堆；它带 [[Power]] 特性，05312 的「重演弃牌堆最顶力量诡计」会把它当弃牌堆卡重演（卡面不应允许）。②关闭检定只给意志，卡面是智识或意志二选一，缺一个技能选择窗口。③补裂口到 3 沿用本章「第 4 个裂口改入侵」与「本阶段已入侵」保护，若该地点本阶段已结算过入侵会提前停（罕见，此时补不到 3 个）。④「地点文本空白」只屏蔽本章 LOCATION_HANDLERS，但这 16 个地点的印刷文本就是这些行动，实际等价；特性与数值不受影响。tests/tcu-clutches-chaos.test.mjs:604-620 覆盖附属、补到 3、意志关闭，未覆盖弃牌堆与智识分支。 子句：显现-附属到一个随机地点（近似）；[action]：检定[智识]或[意志](4)以关闭通道（近似）"
  },
  "05309": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺第三条（文本框空白）：地点上只要有 05309，该地点的印刷能力仍照常提供——例如 05305 的 [action] 搜索敌人/移裂口、05303/05304 的 [fast] 受伤害移裂口、05302 的同款行动，全部还在 behavior.js:432-641 LOCATION_HANDLERS 里可选，与卡面冲突（src/cards/encounter-entries/.../05309.js:3 的注释声称「由章节 behavior 的动作屏蔽近似」，实际没有这段代码）。修复需在 behavior.actions（behavior.js:924-933）按同地点是否有 05309 屏蔽 handler，或新增引擎级地点文本空白读点。生成子句只有并列取舍差异：裂口最多的地点并列时直接取第一个（behavior.js:259-260），没有开选择窗口（引擎对同类生成规则用 requestChoice，src/engine/enemies.js:230、246）；回退银暮秘社按 fallbackLocationIds 取在场版本（本线在场的是 05305，music 版的 05303 已移出）。反击由印刷文本识别，路径完整。tests/tcu-clutches-chaos.test.mjs:466-476 只测生成位置；audit/tcu-scenario-acceptance.json 的 uncoveredCodes 也列了 05309。 子句：生成-裂口最多的地点；都无裂口则生成在银暮秘社（近似）；将所在地点的印刷文本框视为空白（[[特性]]除外）（未实现）"
  },
  "05310": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「找出毁灭最多的异教徒」在并列时没有选择窗口（取 state.enemies 顺序里第一张）。②涌动条件不完整：目标地点已有 3 个裂口时 placeBreachesAt 改为结算入侵并返回 0 个放置（behavior.js:127-143），按卡面「本效果未放置裂口」应获得涌动，实现不会置 pendingSurge；0 毁灭的异教徒被过滤掉，但净结果等价（仍无裂口 → 涌动）。tests/tcu-clutches-chaos.test.mjs:586-602 只覆盖 2 点毁灭与「无目标 → 涌动」，未覆盖并列与裂口已满的情况。 子句：显现-找出场上毁灭最多的[[异教徒]]敌人（近似）；若未因此放置裂口，异界之秘获得涌动（近似）"
  },
  "05311": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：生成子句只有并列取舍差异：裂口最少的地点通常有多个 0 裂口，实现直接取列表第一个，没有给队长选择窗口（引擎对同类生成规则用 requestChoice，src/engine/enemies.js:230、246）。猎手与强制效果完整：生成（enemySpawned）、猎手移动/被效果移动（relocateEnemy → enemyMoved）、随交战调查员移动（movement.js:215-220）、地点整体移动（locations.js:240-241）都会在该地点放 1 裂口。本章测试只有生成位置一条（:466-476），强制效果无单测；audit/tcu-scenario-acceptance.json 的 uncoveredCodes 含 05311。 子句：生成-裂口最少的地点（近似）"
  },
  "05312": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：①「重演」用「放回遭遇牌库顶再抽一张」实现（behavior.js:355-360），走引擎完整抽牌/显现管线：会额外触发「抽到遭遇牌」反应（可取消/重抽），而且该牌被移到弃牌堆顶（卡面是原地留在弃牌堆），behavior.js:984 已登记为近似。②入侵分支受本章「本阶段已结算过入侵的地点不再重复」保护限制（behavior.js:111-116）：若所在地点本阶段已经结算过入侵，选「结算入侵」不会有任何效果（连环保护语见 spec §1.2 第 4 条，但卡面本身没有这条限制）。③若弃牌堆没有 [[力量]] 诡计，实现只给「入侵」一个选项（此时二选一退化为必选，合理）。tests/tcu-clutches-chaos.test.mjs:563-584 覆盖两条分支（入侵/重演），但重演分支只断言日志文案，未断言牌张实际移动与显现结算。 子句：结算遭遇弃牌堆最顶部[[力量]]诡计上的显现能力（近似）"
  },
  "05319": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：「查看另一位调查员的手牌」用公开日志呈现（缺私有信息投影读点）；其余效果（打出对方手牌、双方各抽 1）已实现。补充：可打出的牌另收窄为「非技能且资源付得起」的非弱点卡（05319.js:27-31），并以 noAction 打出、费用与结算走正常打出规则；若打出失败会把牌放回对方手牌（05319.js:42-46）。 子句：查看另一位调查员的手牌（近似）"
  },
  "05320": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目未登记 simplified，但「再次打出该事件，如同其在你手牌中」只实现为 api.replayPlayedCode 重放该事件的打出效果：不支付该事件的资源费用（运行探针：30 资源打出 3 费 01057「火热连胜」得 +10，重放再 +10，最终 47 而非应结算的 44）、不重开 eventPlayed/spellPlayed 等「打出」触发、不检查可打出性；per-card 用例只用 0 费「应急物品」验证，费用与「打出」语义未覆盖。触发窗口、横置与卓越（构筑全局规则）已实现并有断言。 子句：再次打出该事件，如同其在你手牌中（近似）"
  },
  "05321": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：「符号标记（skull/cultist/tablet/elder_thing）后敌人 -1 攻击 / -1 生命 / -1 躲避（最低 1，本回合剩余）」未实现——entityModifierTotal 只读实体自身/地点/幕的静态条目修正（modifiers.js:462-484），运行期只有单次攻击用的 addEnemyFightReduction（api-misc.js:408-416），没有临时改写敌人 fight/health/evade 的通用写入口。意志攻击与 +2 意志已实现并有断言。 子句：符号后敌人-1攻击/-1生命/-1躲避至回合末（未实现）"
  },
  "05322": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：「符号标记后可在连接次数≤2 的一个已揭示地点，视同同时在两处调查、任选其一隐蔽值」未实现——doInvestigate 一次只在单地点结算难度与线索（actions.js:316-398），没有「双地点二选一隐蔽值」的原语；意志调查与 +2 意志已实现并有断言。 子句：符号后视同同时在2格内另一已揭示地点调查并任选隐藏值（未实现）"
  },
  "05323": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：诱饵用 location.lure 标记表示（api-misc.js:180-185），事件卡结算后即被弃掉（未登记 keepOnPlay，actions.js:300-301），并未真正「附属」在场；轮末 runLocationRoundEnd（turn.js:261）又把 05323 推入弃牌堆一次——实测打出后弃牌堆 1 张、轮末 2 张同一物理卡。改道只覆盖敌人阶段的猎手移动（turn.js:153 → hunterStep:227-235），其他来源的移动不拦截；同一轮多个诱饵只取第一个（turn.js:227 find）。per-card 用例（tests/tcu-player-m2-4.test.mjs:504-517）只断言诱饵 seat/code 与轮末清除/弃牌，未断言敌人实际改道（运行探针：猎手按诱饵由 cellar 改道 attic）。 子句：附属到你所在地点或一个连接地点（近似）；强制：附属期间轮末弃掉本卡（近似）"
  },
  "05324": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：条目 simplified:true + note 已登记：未实现「取消该标记并视作 [elder_sign]」的 interrupt（tokenReveal + replacementToken 原语被 rejected），现只把负数值标记的符号翻转（tests.js:674-677），-4 变 +4，最终技能值 7 而非旧印的 +1 与旧印能力（tests/tcu-player-m2-4.test.mjs:611-612 的 success 只证明符号翻转）；[auto_fail]（tests.js:626-635 在窗口之前直接置自动失败）与符号标记（tests.js:684-708 的 context.token 是符号名，被 criteria 纯数字判断挡掉）分支不可达。快速/2 费打出与「技能值降到 0 或以下」的判据（testValue≤0）已实现并有断言。 子句：检定中揭示令技能值降至0的标记时打出（含auto_fail）（近似）；取消该标记并改视为[elder_sign]（近似）"
  },
  "05325": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：8 条符号子里 7 条完全兑现：[skull] 两档取 max(2,ceil(doom/2)) / max(2,doom)（chaos.js:15-18）、[cultist] 的『再揭示一个』由 drawAnother 驱动引擎抽牌循环（src/engine/tests.js:706）、失败检索走 drawEnemyByTrait（src/engine/treachery-tokens.js:343-361，含弃牌堆并把遭遇牌库洗牌）、[tablet] 失败攻击 = 3 伤害 + 3 恐惧（与 05346 印刷 damage3/horror3 一致）。唯一偏差是 [elder_thing] 的 0 值判定时机：behavior.js:743 读的是 state.skillTest.value，而该字段在 src/engine/tests.js:329 于『揭示混乱标记之前』写入，真正的最终值在 tests.js:760 才回写，因此本实现判定的是『token 修正前』的已修正技能值。规则书的 modified skill value 在技能检定第 4 步（揭示 token 之后）才确定，故基础 4 抽到 [elder_thing]（-4）时，规则上该值为 0 应在阿撒托斯上放 1 毁灭，本实现仍读到 4 而不放；反之只有当揭示前技能值已为 0 时才会触发。tests/tcu-black-throne.test.mjs:560-569 只断言『value=0 → 触发、value=2 → 不触发』这一平凡边界，未覆盖 -4 把值压到 0 的情形。若参考实现同样按 token 前取值，本条可降为 match——待人工复核。 子句：[elder_thing] 本次检定修正技能值为0：在阿撒托斯上放1毁灭（近似）"
  },
  "05326": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：正面 2 条里『相邻即相连』用线性放置顺序近似（behavior.js:7、902-913 已登记的 scenarioApproximations：没有二维坐标与滑动），『推进时不移除敌人毁灭』由引擎默认成立（src/engine/act-agenda.js:197-199 只清 agenda 自身 doom）。背面 4 条：异教徒自决完整（commitRitualSuicide:226-240，先弃敌人再把 doom 汇总到 addAzathothDoom）；但『从遭遇牌库和弃牌堆找魔鬼的笛声』只搜了遭遇牌库——drawSpecificEncounter:244 用 state.encounterDeck.lastIndexOf(code)，没有 encounterDiscard 分支，牌若只在弃牌堆（例如已被抽过/弃过）就整条不结算，只打印『遭遇牌库中没有…』；『向左移动』用放置顺序的相邻位近似，位于枢纽（宇宙入口/憎恶宫殿/皇廷/黑王座）的调查员因 index<0 完全不触发（真实游戏里枢纽也在网格中、也能向左），且卡面『一个地点不能被本效果移动超过一次』没有任何计数器（同一地点被两名调查员各推一次时会移动两格），『在其原来位置放一个虚空格子』未落地。 子句：每个地点与其相邻的每个地点相互连接（近似）；队长从遭遇牌库和弃牌堆找魔鬼的笛声并抽取（近似）；否则每人向左移动，或把所在地点向左移动一次（近似）"
  },
  "05327": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：背面 4 条都落地（异教徒自决、意志(4) 失败 1 伤害 1 恐惧、磨损的十字架跳过），与 05326 相同的两处近似：①正面『每个地点与相邻地点相连』用放置顺序线性近似（behavior.js:126-172、100-106）；②『从遭遇牌库和弃牌堆找魔鬼的笛声』只搜遭遇牌库（drawSpecificEncounter:244 无 encounterDiscard 分支），牌只在弃牌堆时找不到。意志检定按 active(state) 逐个结算、失败才 1 伤害 + 1 恐惧，与卡面一致；memento 键 wornCrucifix 在 src/campaign/mementos.js:21 登记，能命中。 子句：每个地点与其相邻的每个地点相互连接（近似）；队长从遭遇牌库和弃牌堆找魔鬼的笛声并抽取（近似）"
  },
  "05328": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺 1 条：背面第 3 段的『只要冒险没有结束，场上所有毁灭标记视为在阿撒托斯上』没有任何实现路径——阿撒托斯的毁灭只记在 scenarioFlags.azathothDoom（behavior.js:50-62、chaos.js:azathothDoomOf:12），敌人/地点/支援/威胁上的 doom 不会被算作『在阿撒托斯上』。因此第三次密谋推进之后，若场上还有带 doom 的敌人或地点（例如异教徒以外的敌人、或后续放 doom 的卡），[skull] 的 X（chaos.js:skullX）、黑色王座的隐藏值（behavior.js:locationShroudModifier:715-719）、05344/05345 的取数都会少算。另一个实现细节：『密谋牌库不复存在』靠 agendaIndex 越界后 checkAgenda 早退成立（src/engine/act-agenda.js:271-283），『不会结束』也确实是 noResolution 的兜底只在全员阵亡时才触发（harm-threat.js:287-293）。其余近似同 05326：网格用放置顺序近似；『从遭遇牌库与弃牌堆找魔鬼的笛声』只搜遭遇牌库（drawSpecificEncounter:244 无 encounterDiscard 分支）；cornHuskDoll 移除的是 flags.azathothDoom，与卡面『移除阿撒托斯上 1 个毁灭』等价。 子句：每个地点与其相邻的每个地点相互连接（近似）；队长从遭遇牌库和弃牌堆找魔鬼的笛声并抽取（近似）；场上所有毁灭视为在阿撒托斯上（未实现）"
  },
  "05329": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：正面两条都落地（[action] 抽 X 选 1 走引擎地点牌库，唯一近似是『其余洗回宇宙』实现成放回牌库底，见 src/engine/alt-decks.js:190-192；目标限定憎恶宫殿 + 共同支付由 canAdvanceWithClues/groupPayment 强制）。背面缺 4 条、近似 2 条：①『将宇宙入口移出游戏』完全没有实现——rebuildForNextAct 只收回宇宙地点，宇宙入口仍留在地图上并继续给虚空地点授予行动（05332 的『每个虚空地点获得…』因此到第 2/3 幕还在生效）；②『位于这些地点的调查员被抛弃并阵亡』反而被实现成『把所有人搬到新枢纽』（rebuildForNextAct:216），卡面的死亡后果被取消；③『这些地点的敌人与遭遇牌库顶 5 张混洗』没有路径，敌人被搬到枢纽（returnLocationToCosmos:183-185）；④『按玩家顺序每人抽 1 张遭遇牌』没有路径（rebuildForNextAct 不含 drawEncounter）；⑤『虚空格子洗入其所有者牌库』因本实现不建虚空格子实体而只剩计数；⑥新地点是直接 revealed 并按方向表连线（placeCosmosLocation:169），而卡面要求把皇廷与宇宙顶 2 张『混洗到无法分辨』再按指导摆放，隐藏信息与放置顺序都被简化。 子句：[action] 花费X线索：抽宇宙顶X张，选1按「宇宙 -」放置移入，其余洗回（近似）；背面 - 将宇宙入口移出游戏（未实现）；把每个虚空格子洗入其所有者牌库（近似）；位于这些地点的调查员被抛弃并阵亡（未实现）；这些地点的敌人与遭遇牌库顶5张混洗（未实现）；取放一边的皇廷+宇宙顶2张，混洗至无法分辨后连同虚空格子放入场（近似）"
  },
  "05330": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：与 05329 同构：正面 [action]/目标都落地（目标改为皇廷、2 线索/人，definition.js:96），背面同样缺 4 条、近似 2 条——①『将憎恶宫殿移出游戏』未实现，旧枢纽留在场上并继续授予虚空地点行动；②『位于这些地点的调查员被抛弃并阵亡』被换成全体搬到皇廷（rebuildForNextAct:216），不会有人阵亡；③『敌人与遭遇牌库顶 5 张混洗』没有路径（敌人被搬到皇廷，returnLocationToCosmos:183-185）；④『每人抽 1 张遭遇牌』没有路径；⑤虚空格子只记账不建实体；⑥黑色王座与宇宙顶 3 张不是混洗隐藏后放置，而是直接揭示 + 方向表连线。 子句：[action] 花费X线索：抽宇宙顶X张，选1按「宇宙 -」放置移入，其余洗回（近似）；背面 - 将憎恶宫殿移出游戏（未实现）；把每个虚空格子洗入其所有者牌库（近似）；位于这些地点的调查员被抛弃并阵亡（未实现）；这些地点的敌人与遭遇牌库顶5张混洗（未实现）；取放一边的黑色王座+宇宙顶3张，混洗至无法分辨后连同虚空格子放入场（近似）"
  },
  "05331": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：5 条里 4 条对上：正面 [action] 与三张幕共用同一条 actCosmosTake 行动（近似：『其余洗回宇宙』实现为放回牌库底，src/engine/alt-decks.js:190-192）；目标是 behavior.checkObjectives:687-692 判『队长在黑色王座且 blackThrone.clues===0』（引擎 act 层没有 objective 数据，故由 checkObjectives 接管）；R2/R3 的『至少两项』分别统计 youHaveAcceptedYourFate/mesmerizingFlute/ritualComponents 与 youHaveRejectedYourFate/scrapOfTornShadow/wispOfSpectralMist（resolveActThreeAdvance:382-388）。偏差在第三段『Otherwise, (→R4)』：实现把 r4 当成永远可选的兜底一起列给队长（第 389 行无条件 options.push r4），所以即使玩家已满足 R2 或 R3 的两项条件，仍可以选 R4（卡面用『Otherwise』限定只有两种情况都不满足才走 R4）；选中 R4 后又立刻弹出签名/拒绝的黑书二选一（398-403），把结局 4→5/1 的流程压在同一个推进窗口里，没有单独的 R4 结算段落窗口。 子句：[action] 花费X线索：抽宇宙顶X张，选1按「宇宙 -」放置移入，其余洗回（近似）；否则（→R4）（近似）"
  },
  "05336": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两条都有实现路径，但各有简化：①『宇宙 -』按 definition 的方向/代价指令表走（cost.resources=2 → canPayCost/payCost），『与右方连接』实现成连接最近放置的宇宙地点、付 2 资源后改成与任意已放置地点之一连接（不是二维网格里的相邻格），属全章登记的网格线性近似（behavior.js:902-913）；②反应被实现为地点条目的 locationRule.onEnter.effect（等价于『移动后』，可 skip 保留可选性），代价用 scenarioFlags.referenceResources 记账而不是真正的参考卡资源。另有一处时序缺陷：用幕的 [action] 把舞者之雾放入场时，引擎的 cosmos({take,from}) 会先把调查员搬进新地点（src/engine/scenario-runtime.js:349-360 在 behavior.placeCosmosLocation 之前 relocate），进入结算时该地点的 connections 还是空的，05336.js:18 的 `if (!connections.length) return` 直接返回——玩家不会看到『移动到某个连接地点』的提示；只有从已连通的地点走进去（或经 05339 的门扉移动）才会触发。待人工复核：是否要把建立连接提到搬人之前。 子句：宇宙 - 必须与右方连接；或失去2资源，与相邻地点任意方向连接（近似）；[reaction] 移动到舞者之雾后，移除参考卡1资源：移动到一个连接地点（近似）"
  },
  "05337": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两条都落地但都简化：①『与上方连接』= 连接最早放置的宇宙地点，付 2 恐惧后改为与任意已放置地点之一连接（卡面是『最靠上的已揭示地点 + 任意方向』），属全章网格线性近似；②移动能力用放置顺序前一位交换实现『向上移动一格』（moveLocationInOrder:533-553），『在其原来位置放一个虚空格子』不建实体、只累加 scenarioFlags.emptySpaceCount，『团队每场一次』用 teamUsed[up:<id>] 持久标记（未被 roundEnded 重置，与『每场一次』相符）。偏差是行动成本：卡面是 [action]，实现给该 move 标了 actions:0（behavior.js:811），引擎按 src/engine/turn-flow.js:463 取到 0，等于免行动；另外代价同样是 scenarioFlags.referenceResources 记账而非参考卡实体。 子句：宇宙 - 必须与上方连接；或受到2恐惧，与最靠上的已揭示地点任意方向连接（近似）；[action] 移除参考卡1资源：向上移动一格（团队每场一次）（近似）"
  },
  "05338": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：与 05337 同构：①『与下方连接』实现成连接最近放置的宇宙地点，付 2 伤害后改为与任意已放置地点之一连接（卡面为『最靠下的已揭示地点』），属网格线性近似；②向下移动用放置顺序后一位交换承载、原位置虚空格子只记账、每场一次用 teamUsed[down:<id>] 持久标记（符合卡面）。偏差同样是行动成本：卡面 [action]，实现的 move 标了 actions:0（behavior.js:820），按 src/engine/turn-flow.js:463 结算为免费行动；代价用 scenarioFlags.referenceResources 记账。 子句：宇宙 - 必须与下方连接；或受到2伤害，与最靠下的已揭示地点任意方向连接（近似）；[action] 移除参考卡1资源：向下移动一格（团队每场一次）（近似）"
  },
  "05339": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：3 条都有路径，差异集中在两处：①『宇宙 -』是『与任意一个已揭示地点、任意方向连接』——实现让玩家从当前已放置的宇宙地点（含枢纽）里挑一个连（placeCosmosLocation:154-161），在二维网格里本应是『任意一个已揭示地点 + 任意方向』，属全章网格线性近似的轻量版；②第三个能力把『任意数量的调查员』实现成『该地点的全部 active 调查员』（LOCATION_ACTIONS:525-527 遍历所有 location===宇宙门扉 的人），玩家无法只送一部分人，且代价用 scenarioFlags.referenceResources 记账；③进入时强制效果完整（有线索可花线索、否则 1 恐惧，无 skip），并有测试 tests/tcu-black-throne.test.mjs:365-374。 子句：宇宙 - 与任意一个已揭示地点的任意方向连接（近似）；[action] 移除参考卡1资源：把门扉处任意数量调查员移到其他虚空地点（近似）"
  },
  "05340": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：3 条中进入时强制效果完整（弃 1 手牌并有卡牌选择窗口，或无手牌时 1 伤害）。两处近似：①『与任意方向连接』实现为从已放置的宇宙地点中挑一个连接（网格线性近似）；②移动能力有三处偏差——卡面 [action]，实现的 move 标了 actions:0（behavior.js:829），按 src/engine/turn-flow.js:463 变成免费行动；『任意相邻位置』只给上/下两个选项（performAction:883-888），没有左右；『团队每轮仅限一次』实际是整局一次，因为 teamUsed 只在 setup 时清空（behavior.js:658），behavior.roundEnded:708-713 没有按轮重置 roundAdjacent:* 键；『原位置放虚空格子』同样只累加 emptySpaceCount。待人工复核：是否应在 roundEnded 里清空 teamUsed 的 roundAdjacent 键。 子句：宇宙 - 与任意方向连接（近似）；[action] 移除参考卡1资源：移到任意相邻位置（团队每轮一次）（近似）"
  },
  "05341": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：缺两条、近似一条：①『生成 - 最远的虚空格子』实现为『离所有调查员最远的在场地点』（behavior.js:483-500 → src/engine/enemies.js:264），与卡面的『最远虚空格子』不等价；②『盲目舞者可以进入虚空格子，如同其进入一个地点』与③『强制 - 通过其猎手关键词移动到虚空格子后：再次结算其猎手关键词（每轮仅限一次）』没有任何实现路径——本剧本不建虚空格子（behavior.js:7,905 明确登记为只记账），引擎的猎手移动也不提供『移动到空格』或『再结算一次』的入口（src/engine/turn.js:152 的 scenarioBehavior.hunterMove 未实现）。当前实现下这两条永远不会触发（因而也不会产生错误行为），但卡面规则确实未落地。补齐方式：要么按参考实现引入虚空格子实体，要么在本剧本 hunterMove 钩子里实现『移动后若进空格则再走一次』的等价路径。 子句：生成 - 最远的虚空格子（近似）；可进入虚空格子，如同其进入一个地点（未实现）；强制 - 经猎手移入虚空格子后再结算一次猎手（每轮1次）（未实现）"
  },
  "05342": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·未实现子句（gap）：除『不能被取消』外全部对上：意志(4) 检定、失败附属（用 scenarioFlags.ultimateChaos 计数承载『附属到阿撒托斯』）、失败≥2 的 1 伤害+1 恐惧、失败≥3 的涌动（pendingSurge → src/engine/encounter.js:174）、3 张时弃掉并二选一（放 1 毁灭，或攻击每位调查员）都有实现路径。缺第一段的『不能被取消』：引擎没有『本卡不可取消』标志，抽牌窗口（src/engine/encounter.js:98-119）照常开放，05014 黑暗洞察（src/cards/entries/05014.js:20-24）与 03150 预先警告（src/cards/entries/03150.js:15-21，条件 selfOnly/nonWeaknessOnly/treacheryOnly 正好满足）可以直接取消本卡，取消后既不附属也不计数，整条附属/3 张计时线被跳过。第二段『不能被取消』针对 3 张时的强制能力，引擎里该能力没有可取消窗口，因此无可观测偏差。另有两处小近似：附属张数用计数而非卡牌实体；3 张时的『按玩家顺序攻击』按 state.investigators 的座位顺序遍历（behavior.js:281），不是从队长开始的玩家顺序，且选择者固定为结算的调查员。 子句：不能被取消（两段各一处）（未实现）"
  },
  "05344": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：仅一处边界差异：失败分支用『实际移走的毁灭数 > 0』决定要不要补放 1 点毁灭（behavior.js:309-310），卡面的条件是『场上没有[[异教徒]]敌人』。所以当场上有[[异教徒]]敌人、但其上没有毁灭标记时，卡面结算为移动 0 点毁灭（不额外放毁灭），实现会额外在阿撒托斯上放 1 点。其余对上：难度 = 1 + 当前密谋编号（agendaIndex+1），无密谋时 X=4、难度 5（behavior.js:299-301）；失败把每个[[异教徒]]敌人的 doom 清零并把总数移到阿撒托斯（behavior.js:303-309）；阿撒托斯上的毁灭记在 scenarioFlags.azathothDoom（chaos.js:12），达到 10 点会触发 R1（behavior.js:60）。 子句：无异教徒敌人时改为放1毁灭（近似）"
  },
  "05346": {
    "status": "simplified",
    "note": "P10 逐卡行为审计·显式近似（行为等价但非逐条实现）：两条无实体的规则靠『不在场』成立，不是靠判定：阿撒托斯只被塞进 definitions.enemies 并打上 cannotBeDefeated / immuneToPlayerCards / omnipotent / spawnAt:null（definition.js:117-123），其中 immuneToPlayerCards、omnipotent、spawnAt 在全仓没有任何引擎读点；cannotBeDefeated 只被 src/engine/enemy-faces.js:36-38 在已入场敌人实例上读取，而它既不入遭遇牌库（definition.js:109-110 的 sideCodes 过滤），也不在任何生成路径上（setup 的 setAside 只有皇廷/黑王座/吹笛手，behavior.js:668-672），所以『免疫所有玩家卡牌效果和调查员行动、不能被任何方式击败』是形式上由『根本不在场上』满足的。毁灭记在 scenarioFlags.azathothDoom（behavior.js:50-62, chaos.js:12），不在任何卡牌上；『阿撒托斯攻击你』用固定 3 伤害 + 3 恐惧（behavior.js:64-70），不经过 enemyAttack 的攻击窗口（因此无法被躲避/取消类效果介入，与卡面『不能被任何方式击败』以外的交互没有定义冲突，但确属简化）。『强制 - ≥10 毁灭 → R1』已实现并有测试覆盖。建议：若要防止后续内容误把 05346 生成入场，需要把 immuneToPlayerCards/omnipotent 接成引擎读点，或显式禁止其生成。 子句：免疫所有玩家卡牌效果与调查员行动（近似）；不能被任何方式击败（近似）"
  }
}

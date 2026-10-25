// 万象无终（The Circle Undone）逐卡验收备注注册表。
//
// 这是**人工/代理逐卡行为审计的补充说明**，不是验收状态的事实源：逐卡自动测试状态由
// `tools/audit-tcu-all-cards.mjs` 实跑 `TCU <code>` 测试后写进
// `audit/tcu-all-card-acceptance.json` 与 `src/cards/tcu-campaign-acceptance.js`。
// 逐卡「印刷描述 vs 实现」的完整行为审计结论（match/approximation/gap 与逐条证据）在
// `audit/tcu-card-behavior-audit.json`；本文件是它的摘要，供全卡账本的 note/noteStatus 与
// audit/tcu-migration.json 的 remaining 使用。
//
// 键 = 05xxx 卡号（含 34 个关联面 05xxxa/b… 的卡号）；
// 值 = { status: 'verified' | 'simplified', note: string }。
//   · verified   —— 逐卡行为审计为 match（未登记即视为 verified）：已通过审计、登记为已验收；
//   · simplified —— 行为审计发现显式近似或未实现子句（gap），note 写清差异/缺口；这些卡不列入
//                   已验收，仍进 earlyAccess 的 remaining，不宣称规则等价。
//
// 生成：node develop/p10-card-audit-notes.mjs --write（由 audit/tcu-card-behavior-audit.json 派生）。
export const TCU_CARD_ACCEPTANCE_NOTES = {
  "05003": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：资源寄存仍是合并模型（src/engine/resource-bank.js:10-30：寄存量同时计入 inv.resources，asset.resources 只是标记）；R7 已接 resource-bank v2 薄封装：旧印门槛用 api.availableResources、支付用 api.spendResources（src/cards/entries/05003.js:28-40）。仍未实现审计要求的「分离池 + 付费选择（先花哪一份）」表示层；回合末按 min(寄存量, 现有资源) 扣回（resource-bank.js 的 endTurn），只有全部资源都是寄存时与卡面等价。另有直接写 inv.resources、不经 api.gainResources 的效果（01045/05037）不寄存。 子句：你每次从卡牌效果获得资源，不将其放在资源池，改为放在家族遗产上。（近似）"
  },
  "05011": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：资源寄存仍是合并模型（resource-bank.js:10-30）：卡上的资源同时留在 inv.resources 里，[action] 只是清掉寄存标记（R7 已改用 api.bankedResources/api.withdrawBanked 接线）；回合结束按 min(寄存量, 现有资源) 弃掉，混池时的流失量由实现固定、与卡面「弃掉卡上的所有资源」不等价。回合开始放 4 资源与永久卡开局入场有读点。 子句：[action]：将本卡牌上的所有资源移动到你的资源池。（近似）；强制 - 在你的回合开始时：在本卡牌上放置4资源。本卡牌上的资源可以被花费，如同在你的资源池中。当你的回合结束时，弃掉本卡牌上的所有资源。（近似）"
  },
  "05052": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：第四轮裁决（Lead）：Omen/Curse 基础弱点在 BASIC_WEAKNESSES 中没有任何已实现弱点条目（registeredEntry 为空），collection 池也无法安全抽到（weakness.js 会抛错），因此本轮保持如实 approximation，不实现 collection pool（避免假通过）。正面轮末强制、背面「存活调查员被击败」与「找不到弱点者 1 精神创伤」均实现；唯一偏差仍是候选池取自 basicWeaknessPool（核心包+本战役已开放弱点），窄于卡面的「收藏」。 子句：背面：每位存活的调查员被击败，且必须查找收藏，随机找出一张基础[[征兆]]或[[诅咒]]弱点，将它加入自己的牌库。（近似）"
  },
  "05156": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：两处偏差：①打出时机窄得多——引擎的快速手牌只在「当前调查员行动点耗尽/结束回合」的 investigation.afterAction 窗口出现（dispatch.js:460-465 传 fastCards、encounter.js:405-448 只给 fastCardSeat=state.currentSeat），因此本卡实际只能在你自己回合将结束时打出，不能像卡面那样在任意调查员的回合期间、行动之间打出；②「立即进行一次行动，如同现在是你的回合」被实现为获得 1 个额外行动（api-misc.js:245-248 只加 actionsLeft），该行动进入你的行动池、只能在自己的回合里使用；若在别人回合打出也无法立即结算一次行动。额外行动不计入每回合行动数这半边是等价的。 子句：快速。在任意调查员的回合期间(不含行动期间)打出。（近似）；立即进行一次行动，如同现在是你的回合。此行动不计入你每回合能够进行的行动数量。（近似）"
  },
  "05231": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：R7 复核（当前实现未变；R7 引擎冻结未提供该卡所需读点/内容接线，维持原判）：条目 simplified:true 已登记。未实现「忽略所有费用」的引擎费用管线（费用校验/每回合上限记账）：实现是直接调用所选支援首个有 resolve 的 action/free 描述子的 resolve()（05231.js:31-34,67-84），效果不付费用，但不走 payAbilityCost/上限登记，且「需要 target 声明才能用的能力」会被跳过（如 05186 的攻击这类 target:{kind:'enemy'} 的能力），纯 effect 数据体的能力也无法结算。测试 407-418 断言了忽略费用（秘密 4→4、支援未横置）与移动效果；「从手牌揭示→可弃掉抽 1 张」分支（05231.js:85-94）没有断言但实现存在。 子句：结算该支援上的一个[action]或[fast]能力，忽略所有费用(包括其[action]费用，如有)（近似）"
  },
  "05241": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：［R5 裁决］交叉复核（reaudit-c）指出：「将其放置入场，放到自己面前」仍以 flags.frontOf 语义载体记录（引擎无「面前场所」实体原语、web 无消费点），本轮无实现变化，与 R2/R3 记录的近似是同一处；其余子句（火盆地点真实 markers、命运卡随机发放/按玩家顺序结算）均已实现。 子句：将其放置入场，放到自己面前（近似）"
  },
  "05262": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：只剩「翻回敌人面」的承载差异：用 spawnStoryEnemy 生成敌人面 05262b，不是同一张卡实体翻面（本关没有能选中该卡的效果，行为等价，属表示层）。本轮已修：「不占盟友槽」现在由 allySlotsOk 实例 slots 生效（assets.js:193-208）；「与你交战」显式与结算这张命运卡的调查员交战（behavior.js:141-145），不再依赖 autoEngageAt 的猎物选择。 子句：如果加弗瑞拉已被幽灵夺走性命：将本卡牌翻回敌人面，生成在你所在地点；若在追查则横置且不交战，否则与你交战（近似）"
  },
  "05263": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：与 05262 同构：只剩「翻回敌人面」用 spawnStoryEnemy 生成 05263b 的表示层差异；不占盟友槽（allySlotsOk 已修）、交战者（api.engage 已修）、追查时横置不交战、恐惧数值均一致。 子句：如果杰罗姆已被幽灵夺走性命：将本卡牌翻回敌人面，生成在你所在地点；若在追查则横置且不交战，否则与你交战（近似）"
  },
  "05264": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：只剩「翻回敌人面」用 spawnStoryEnemy 生成 05264b 的表示层差异。本轮已修：person 记录键改为 05049（佩妮），失踪人口过滤与「还活着/已死」记录不再串位；不占盟友槽、与非检定者交战均与卡面一致。 子句：如果佩妮已被幽灵夺走性命：将本卡牌翻回敌人面，生成在你所在地点；若在追查则横置且不交战，否则与你交战（近似）"
  },
  "05265": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：只剩「翻回敌人面」用 spawnStoryEnemy 生成 05265b 的表示层差异。本轮已修：person 记录键改为 05048（瓦伦蒂诺）；不占盟友槽、与结算者交战、追查时横置不交战均正确。 子句：如果瓦伦蒂诺已被幽灵夺走性命：将本卡牌翻回敌人面，生成在你所在地点；若在追查则横置且不交战，否则与你交战（近似）"
  },
  "05323": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：R7 复核：①「附属到你所在地点或一个连接地点」改走真实地点附属（api.attachToLocation → state.playerLocationAttachments，locationLure/discardAtRoundEnd 由引擎读点消费），不再是 loc.lure 标记；②「敌军阶段期间所有要移动的敌人朝附属地点移动」已由 turn.js hunterStep 读真实附属实现（多诱饵按距离取最近，测试覆盖猎手移动/多诱饵最近）；仍判 approximation 的残余：剧本/效果发起的敌人移动（非猎手步）不经过 hunterStep、不读诱饵；③轮末强制弃置已实现（discardAtRoundEnd 恰好弃 1 张，keepOnPlay 防事件默认弃置）。 子句：敌军阶段期间，所有要移动的敌人不照常移动，而是改为沿着最短路径，朝附属地点移动（近似）"
  },
  "05324": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：R7 复核（当前实现未变；R7 引擎冻结未提供该卡所需读点/内容接线，维持原判）：条目 simplified:true 已登记：引擎没有 tokenReveal 替换标记的 interrupt（原语请求被 rejected）。现实现只覆盖「负数值标记使技能值降到 0 或以下」这一支：negativeTokenRevealed 窗口里把修正翻成等值正数（05324.js:31-33；tests.js:682-684），得到的是 -4→+4 这样的等值正修正，而不是旧印的 +1 与旧印能力，也不是卡面说的「取消该标记」。auto_fail 在打开窗口之前就被判为自动失败（tests.js:633-642），符号标记的负修正走 tests.js:704-708 那条分支、context.token 是符号名，会被本卡 criteria 的纯数字正则挡掉，因此「包括 [auto_fail] 标记」与符号标记分支都不可达（05324.js:16-17 note）。快速/2 费打出与「技能值降到 0 或以下」的判据已实现并有断言。 子句：在技能检定期间，你揭示一个混乱标记，且该标记将要令你的技能值减少到0时打出（包括[auto_fail]标记）（近似）；取消该标记并改为将其视作[elder_sign]标记（近似）"
  },
  "05341": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：R6 仍为 approximation（表示层）：虚空格子在本仓库只是 cosmos 二维网格格位数据，不是可站立的 location 实体（参考实现用 xempty 特殊地点卡）。R6 收窄：①「Spawn - Farthest empty space」按网格取离所有调查员最远的虚空格，flags.dancerVoidCell 记录该格位、引擎锚点取离它最近的在场地点（behavior.js:817-870,932-958,1336-1348）；②「可以进入虚空格子，如同其进入一个地点」用 flags.dancerVoidCell 承载：舞者可停留在虚空格中、下一次猎手移动从该格位继续；经猎手进入虚空格时同一结算内再走一格（每轮一次），连续两格虚空格会停在第二格（behavior.js:872-930,1350-1358）；③「经猎手移动到虚空格后再结算猎手（每轮一次）」由 flags.dancerVoidRound 记账覆盖。残余：虚空格中时引擎侧位置仍锚定最近地点（攻击/躲避/交战读点已按 dancerVoidCell 拒绝，但「按地点统计/检索敌人」的效果会把它算在锚点地点；引擎猎手循环在锚点地点有调查员时会跳过本卡）；等距多条路线取确定顺序而非队长选择。测试 tests/tcu-black-throne.test.mjs:996-1103；猎手关键词本身由引擎实现（turn.js:148-161）。 子句：Spawn - Farthest empty space.（生成 - 最远的虚空格子。）（近似）；Mindless Dancer can enter empty space as if it were a location.（可以进入虚空格子，如同其进入一个地点。）（近似）；Forced - After Mindless Dancer moves to an empty space via its hunter keyword: Resolve its hunter keyword "
  },
  "05346": {
    "status": "simplified",
    "note": "2026-10-25 全量逐卡行为审计（第二轮）·显式近似（不列入已验收）：R6 仍为 approximation（表示层）：阿撒托斯不建场上敌人实体（参考实现是 Omnipotent 的 Global 敌人：普通「敌人」匹配器会因 Omnipotent 被排除在玩家卡效果之外，本引擎没有该匹配器语义，故用「不生成实体」表达「免疫所有玩家卡牌效果/调查员行动」）。R6 补齐防御性内容钩子 enemyCanBeDefeated/canFightEnemy/canEvadeEnemy/canEngageEnemy/enemyCannotBeAttacked/enemyCannotAttack/canOpportunityAttack/enemyDamageAllowed（behavior.js:1286-1324,1325-1334，异常路径生成时也不会被攻击/击败/躲避/交战/伤害）。唯一行为差异仍是「统计场上敌人」的效果会少算它：R6 评估内容侧替代读点（behavior.enemyCountOverride 等）不可行——现有玩家卡/引擎效果直接读 state.enemies，没有可插入的引擎读点，内容钩子会是死代码；要消除需引擎支持 Global 真实敌人实体（本轮不做）。③「≥10 毁灭 → 吞食宇宙（→R1）」已实现：maybeDevoured 读 azathothDoom（含 05328 背面后的吸收口径），addAzathothDoom/doomPlaced/各阶段钩子末轮询（behavior.js:64-82,1213-1255），测试 667-707。 子句：Azathoth is oblivious and omnipotent. It is immune to all player card effects and investigator actions.（懵懂不察而又无所不能；免疫所有玩家的卡牌效果和调查员行动。）（近似）；…and cannot be defeated by any means.（并且不能被任何方式击败。）（近似）"
  }
}

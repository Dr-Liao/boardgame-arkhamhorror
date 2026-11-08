// player-auditor-b findings part 2 (08097-08133)
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-b'
const cards = JSON.parse(fs.readFileSync(path.join(OUT, '_cards.json'), 'utf8'))
const byCode = Object.fromEntries(cards.map(c => [c.code, c]))
const ins = (summary, dimension, evidence, suggestion, severity) => ({ severity, dimension, summary, evidence, suggestion })
const find = (code, verdict, clauses, perceivability, tests, issues = []) => {
  const c = byCode[code]
  return { code, name: c.name, nameZh: c.nameZh, type: c.type, klass: c.klass, xp: c.xp ?? null, verdict,
    accepted: verdict === 'match' && !issues.some(i => i.severity === 'high'), clauses, perceivability, tests, issues }
}
const cl = (text, status, evidence, note = '') => ({ text, status, evidence, note })
const P = (status, evidence, note = '') => ({ status, evidence, note })
const T = (status, evidence, note = '') => ({ status, evidence, note })
const out = []

// 08097 Pocket Telescope
out.push(find('08097', 'approximation', [
  cl('[fast] Exhaust Pocket Telescope: Look at the revealed side of a connecting unrevealed location.', 'approximation',
    'src/cards/entries/08097.js:19-29 只读 location.name/shroud/clues 后 api.info；未揭示地点的「揭示面」数据不在这些字段上（真实揭示面原语 api.playerTools.lookAtLocation 返回 unrevealedActualName/shroud/clues，src/engine/api-misc.js:1444-1469，primitives test:217 已就绪但未使用）',
    '看到的可能是未揭示面自身数据（≈0 线索/无帷幕），不是印刷要求查看的揭示面。'),
  cl('[action]: Investigate. Investigate a revealed connecting location as if you were there.', 'implemented',
    'src/cards/entries/08097.js:30-43 api.investigate({locationId, noClueDiscovery}) + 成功后 api.discoverClue(seat,1,chosen)；选项读点 src/engine/actions.js:531,576,657'),
], P('perceivable', 'src/cards/entries/08097.js:25-28,36-37 api.choice+prompt；28 api.info 预览', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:235-246,407-419', '两条能力都有断言。'),
  [
    ins('「查看揭示面」用 info 打印当前地点字段而非揭示面原语，展示的可能是错误的一侧。', 'primitive', 'src/cards/entries/08097.js:24-29 vs src/engine/api-misc.js:1444-1469；tests/eote-player-primitives.test.mjs:217', '改用 api.playerTools.lookAtLocation(seat, locationId) 并把返回 face 展示给玩家。', 'medium'),
  ]))

// 08098 Eon Chart (1)
out.push(find('08098', 'approximation', [
  cl('Uses (3 secrets).', 'implemented', 'src/cards/entries/08098.js:35-36'),
  cl('[fast] During your turn, exhaust Eon Chart and spend 1 secret: Choose and take one of the following actions (move, evade, or investigate).', 'approximation',
    'src/cards/entries/08098.js:38-39 + chooseAction（10-30）；三项行动免费执行 ✓、费用组合 ✓。但**未实现「During your turn」**（无可时点条件：free 能力只出现在玩家窗口，多座位/反应窗口下可能被非自己回合触发）；evade 选项仅在已交战敌人存在时出现（合规）',
    '缺少「你的回合」限制。'),
], P('perceivable', 'src/cards/entries/08098.js:14-19,24-26 api.choice+prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:247-262', ''),
  [
    ins('缺少印刷「During your turn」限制。', 'impl-vs-text', 'src/cards/entries/08098.js:38-39', '加 criteria: state.currentSeat===inv.seat（或 ownTurn 条件）。', 'medium'),
    ins('与 08100 各自复制一份 chooseAction/performAction（08098.js:10-31 vs 08100.js:9-29），应共享原语。', 'duplication', 'src/cards/entries/08098.js:10-31；src/cards/entries/08100.js:9-29', '抽到共享条目模块。', 'low'),
  ]))

// 08099 Gené Beauregard
out.push(find('08099', 'match', [
  cl('You get +1 [intellect] and +1 [agility].', 'implemented', 'src/cards/entries/08099.js:53-56'),
  cl('[reaction] During your turn, after you move to a location, exhaust Gené Beauregard: Move a clue or a non-[[Elite]] enemy from a connecting location to your location, or vice versa.', 'implemented',
    'src/cards/entries/08099.js:14-51：move 窗口 + api.moveClueToLocation/api.moveEnemy；连接地点候选、线索/敌人双向选项齐全；精英已排除 ✓'),
], P('perceivable', 'src/cards/entries/08099.js:24-40 options 以中文 label 呈现「把X的1个线索拿到这里/把这里的1个线索移到X/把敌移…」', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:263-274', '')))

// 08100 Eon Chart (4)
out.push(find('08100', 'approximation', [
  cl('Uses (3 secrets).', 'implemented', 'src/cards/entries/08100.js:32-34'),
  cl('[fast] During your turn, exhaust Eon Chart and spend 1 secret: Choose and take two different actions of the following, in any order (move, evade, or investigate).', 'approximation',
    'src/cards/entries/08100.js:36-40 连续调用两次 performAction，无「不同」去重；probe：选择「移动」两次 → 移动 B 再回原地点（同类行动执行两次）。同时缺「During your turn」限制',
    '「two different actions」未实现（可重复同一行动）。'),
], P('perceivable', 'src/cards/entries/08100.js:13-19,24-26 api.choice+prompt', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:247-262', '只测 1 级版；4 级版未断言两次行动必须不同。'),
  [
    ins('未实现「two different actions」：同一行动可执行两次。', 'impl-vs-text', 'src/cards/entries/08100.js:37-40', '第二次选择时排除第一次选过的 id。', 'medium'),
    ins('缺少「During your turn」限制。', 'impl-vs-text', 'src/cards/entries/08100.js:36', '加时点条件。', 'medium'),
  ]))

// 08101 Divination (1)
out.push(find('08101', 'match', [
  cl('Uses (4 charges).', 'implemented', 'src/cards/entries/08101.js:14-15'),
  cl('[action]: Investigate. For this investigation, you may use [willpower] instead of [intellect], and you get +1 skill value.', 'implemented', 'src/cards/entries/08101.js:19-23（api.investigate {skill,bonus:1}）'),
  cl('If you succeed, spend 1 or 2 charges. Instead of discovering a clue at your location, discover 1 clue at your location for each charge spent.', 'implemented', 'src/cards/entries/08101.js:23-33（noClueDiscovery + spendUses + discoverClue(spent)）'),
  cl('If you succeed by 0, choose and discard a card from your hand.', 'implemented', 'src/cards/entries/08101.js:35 api.discardChosen'),
], P('perceivable', 'src/cards/entries/08101.js:19-31 两个 api.choice+prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:275-290', '')))

// 08102 Protecting the Anirniq
out.push(find('08102', 'gap', [
  cl('Fast. Play after an [[Ally]] asset at your location is discarded by a card effect or is defeated.', 'missing',
    'src/cards/entries/08102.js:14-16：criteria 读 context.asset.location 与 context.asset.traits；真实 assetLeavesPlay 窗口 context.asset 是裸实例 {id,code,exhausted}（src/engine/card-defs.js:307-308；src/engine/assets.js:397-401），两字段恒 undefined → 反应永不出现（real-path probe：reaction not offered）',
    '真实路径下该快速事件无法在盟友支援离场后打出。'),
  cl('Either return that asset to its owner\'s hand, or its owner draws 3 cards.', 'approximation',
    'src/cards/entries/08102.js:17-28：return 走 api.moveCard({from:\'discard\',to:\'hand\'})，draw 走 api.drawCards(owner,3)。但依赖上一条触发（不成立）',
    '效果主体逻辑正确，但无法触发；且未校验离场原因是否「卡牌效果/被击败」（reason 可读）。'),
], P('perceivable', 'src/cards/entries/08102.js:21-25 api.choice+prompt（若触发）', ''),
  T('partial', 'tests/eote-player-m2-3.test.mjs:292-306', '手工构造 context.asset={traits,location,ownerSeat} 直接执行描述子，掩盖了真实窗口形状不符。'),
  [
    ins('触发条件读了真实 context 不存在的字段（asset.location/asset.traits），真机上永远不触发。', 'impl-vs-text', 'src/cards/entries/08102.js:14-16 vs src/engine/assets.js:397-401', '改用 context.location/context.assetCode + api.cardTraits(assetCode) 判定，并补真实 leaveAsset 路径测试。', 'high'),
    ins('未使用 context.reason 过滤「被卡牌效果弃掉 / 被击败」。', 'impl-vs-text', 'src/cards/entries/08102.js:14-16；context.reason 见 src/engine/assets.js:364-366,399', '按 reason（discard/effect）与击败窗口分别判定。', 'low'),
  ]))

// 08103 Divination (4)
out.push(find('08103', 'match', [
  cl('Uses (6 charges).', 'implemented', 'src/cards/entries/08103.js:13-14'),
  cl('[action]: Investigate ... may use [willpower] instead of [intellect], and you get +2 skill value.', 'implemented', 'src/cards/entries/08103.js:18-22'),
  cl('If you succeed, spend 1, 2, or 3 charges; 1 clue per charge spent.', 'implemented', 'src/cards/entries/08103.js:23-33'),
  cl('If you succeed by 0, choose and discard 2 cards from your hand.', 'implemented', 'src/cards/entries/08103.js:34 api.discardChosen(inv.seat,2,\'08103\')'),
], P('perceivable', 'src/cards/entries/08103.js:18-29 api.choice+prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:275-290', ''),
  [ins('与 08101 同模板复制（+1 vs +2、4 vs 6 充能），可共享模板与原语调用。', 'duplication', 'src/cards/entries/08101.js:12-38；src/cards/entries/08103.js:11-37', '低优先。', 'low')]))

// 08104 Professor William Webb (0)
out.push(find('08104', 'approximation', [
  cl('Uses (3 secrets).', 'implemented', 'src/cards/entries/08104.js:16-17'),
  cl('[reaction] When you successfully investigate, exhaust Professor William Webb and spend 1 secret: Instead of discovering a clue at your location, either choose an [[Item]] card in your discard pile and add it to your hand, or discover a clue at a connecting location.', 'approximation',
    'src/cards/entries/08104.js:19-48：费用 {exhaust,uses:1} ✓；取回道具 ✓；连接地点线索 ✓（api.canDiscoverClueAt/discoverClue）。但「instead of」被实现为追加——标准线索仍会发现（条目注释 9-10 已披露；queue m2-3-08104 rejected）。连接地点候选用 api.moveDestinations（合法移动目的地）而非 locations.connections，受移动限制影响',
    '替换语义缺失（玩家白拿额外收益）；连接地点口径受移动限制污染。'),
], P('perceivable', 'src/cards/entries/08104.js:32-45 两级 api.choice+prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:383-395', '只测「取回道具」分支；未测替换语义与连接地点。'),
  [
    ins('「不发现所在地点 1 个线索，改为…」是替换，条目按追加结算 → 每次调查成功白多 1 收益；近似已披露但 prior 账本仍 verified。', 'impl-vs-text', 'src/cards/entries/08104.js:9-10,19-48；queue m2-3-08104 rejected', '补调查成功线索替换原语（queue 已列为 P7 硬化）或降级账本。', 'medium'),
    ins('连接地点候选用 moveDestinations（移动目的地的合法集合）而非连接表，会漏掉被移动限制封锁的连接地点。', 'primitive', 'src/cards/entries/08104.js:27', '改读当前地点 connections。', 'low'),
  ]))

// 08105 Ice Pick (1)
out.push(find('08105', 'gap', [
  cl('Fast.', 'implemented', 'src/cards/entries/08105.js:12'),
  cl('[fast] During a skill test while fighting or investigating, exhaust Ice Pick: You get +1 skill value for this test.', 'missing',
    'src/cards/entries/08105.js:14-17 criteria `[\'fight\',\'investigate\'].includes(state.skillTest?.actionKind)`；EotE 未启用 trackTestTarget，真实 skillTest 无 actionKind（src/engine/tests.js:166-180：只有 typedTarget/options.actionKind 才写），real-path probe：playerWindow(test.beforeCommit) 不提供该能力；测试手工塞 actionKind 才过（tests:311）',
    '真实对局中该能力永远不可用 → 整张卡（唯一能力）无效。'),
], P('missing', 'src/cards/entries/08105.js:14-17；无合法入口（real-path probe 无选项）', ''),
  T('weak', 'tests/eote-player-m2-3.test.mjs:308-315', '测试伪造 state.skillTest.actionKind，未走真实 playerWindow；属「冒烟式」验证。'),
  [
    ins('criteria 依赖真实引擎从不设置的 state.skillTest.actionKind，导致能力在真机永不出现（整卡失效）。', 'impl-as-text', 'src/cards/entries/08105.js:16 vs src/engine/tests.js:166-180,233(combat.js),610(actions.js)', '改用 testInitiated/战斗上下文可读的行动类型（如 testTarget.actionKind 需要 trackTestTarget）或 context.actionKind；或让引擎在 skillTest 上写 actionKind（参考 08086 的 context.actionKind 用法）。', 'high'),
    ins('测试用伪造 skillTest 掩盖了真实路径失效。', 'docs', 'tests/eote-player-m2-3.test.mjs:311', '补真实 playerWindow/战斗路径断言。', 'medium'),
  ]))

// 08106 Professor William Webb (2)
out.push(find('08106', 'approximation', [
  cl('Uses (3 secrets).', 'implemented', 'src/cards/entries/08106.js:15-16'),
  cl('[reaction] When you successfully investigate, exhaust Professor William Webb and spend 1 secret: Choose an [[Item]] card in your discard pile and add it to your hand.', 'implemented', 'src/cards/entries/08106.js:18-31'),
  cl('Instead of discovering a clue at your location, you may discover a clue at a connecting location.', 'approximation',
    'src/cards/entries/08106.js:32-40：可 skip 的连接地点线索（近似追加；条目注释 8-9 披露）。连接地点用 api.moveDestinations（同 08104 问题）',
    '替换语义未实现（标准线索仍发现）。'),
], P('perceivable', 'src/cards/entries/08106.js:34-39 canSkip choice + prompt', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:383-395', '只测取回道具。'),
  [
    ins('同 08104 的替换语义缺失（已披露近似）。', 'impl-vs-text', 'src/cards/entries/08106.js:8-9,32-40', '同 08104。', 'medium'),
    ins('与 08104 同模板复制（08104.js:19-48 / 08106.js:18-41），应共享模板。', 'duplication', 'src/cards/entries/08104.js:19-48；src/cards/entries/08106.js:18-41', '低优先。', 'low'),
  ]))

// 08107 Ice Pick (3)
out.push(find('08107', 'gap', [
  cl('Fast.', 'implemented', 'src/cards/entries/08107.js:17'),
  cl('[fast] During a skill test while fighting or investigating, exhaust Ice Pick: You get +1 skill value for this test.', 'missing',
    'src/cards/entries/08107.js:19-22 同 08105：criteria 依赖从未设置的 state.skillTest.actionKind → 真机不出现', '整卡两个能力都受同一 criteria 影响。'),
  cl('If you succeed, you may discard Ice Pick to have this attack deal +1 damage (if you are fighting), or to discover 1 additional clue at your location (if you are investigating).', 'approximation',
    'src/cards/entries/08107.js:23-29：第二条 free 能力在**检定窗口**弃掉自身并登记 addExtraOnSuccess（印刷为「成功后可选」）；引擎已有专用原语 api.playerTools.onTestSuccess（src/engine/api-misc.js:1510-1526，消费 tests.js:1382-1401，primitives test:272，queue m2-3-08107=done）未使用',
    '弃置时机错误（未成功就可能被迫弃牌）+ 现成读点未接线；叠加 actionKind 问题 → 整卡不可用。'),
], P('missing', 'src/cards/entries/08107.js:19-29；real-path 无合法入口（同 08105 probe）', ''),
  T('weak', 'tests/eote-player-m2-3.test.mjs:308-315,420-427', '第一条用伪造 skillTest；第二条直接构造 context 执行描述子。'),
  [
    ins('同 08105：actionKind 判据导致两条能力真机不可用。', 'impl-vs-text', 'src/cards/entries/08107.js:21,25 vs src/engine/tests.js:166-180', '同 08105 修正。', 'high'),
    ins('「成功后可弃」被实现为检定窗口弃牌，且未用已就绪的 onTestSuccess 原语。', 'primitive', 'src/cards/entries/08107.js:23-29 vs src/engine/api-misc.js:1510-1526；tests/eote-player-primitives.test.mjs:272', '改用 onTestSuccess({attackDamageBonus:1}|{extraClue:1, discardSelf:true})。', 'medium'),
  ]))

// 08108 Ethereal Slip (0)
out.push(find('08108', 'match', [
  cl('Choose a non-[[Elite]] enemy at a revealed location up to 2 connections away. Swap places with that enemy.', 'implemented',
    'src/cards/entries/08108.js:29-46：BFS ≤2 跳 + revealed 判定 + api.moveInvestigator/api.moveEnemy 交换；先移调查员再移敌人避免交战跟随（注释 42-43）'),
], P('perceivable', 'src/cards/entries/08108.js:36-39 api.choice+prompt（含地点名）', ''),
  T('covered', 'tests/eote-player-m2-3.test.mjs:317-326', ''),
  [ins('与 08110 共享「交换位置」逻辑（08108.js:29-46 / 08110.js:21-51），可抽共享原语。', 'duplication', 'src/cards/entries/08108.js:29-46；src/cards/entries/08110.js:21-51', '低优先。', 'low')]))

// 08109 Blur (1)
out.push(find('08109', 'match', [
  cl('Uses (3 charges).', 'implemented', 'src/cards/entries/08109.js:18-19'),
  cl('[action] If Blur has charges remaining: Evade. For this evasion attempt, you may use [willpower] instead of [agility], and you get +1 skill value.', 'implemented',
    'src/cards/entries/08109.js:21-45：criteria uses>0；api.choice 技能选择 + bonus。willpower===agility 时跳过询问（等价）'),
  cl('If you succeed, spend 1 charge and you may take an additional action this turn.', 'implemented', 'src/cards/entries/08109.js:46-49 api.spendUses + api.gainAction'),
  cl('If you succeed by 0, take 1 damage.', 'implemented', 'src/cards/entries/08109.js:50-53'),
], P('perceivable', 'src/cards/entries/08109.js:34-38 api.choice+prompt；49,52 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:124-156', '含「无充能不可用」反向断言。'),
  [ins('与 08111 同模板复制（充能/加值/额外行动不同），可共享模板。', 'duplication', 'src/cards/entries/08109.js:21-55；src/cards/entries/08111.js:18-61', '低优先。', 'low')]))

// 08110 Ethereal Slip (2)
out.push(find('08110', 'match', [
  cl('Choose a non-[[Elite]] enemy at any revealed location. Swap places with that enemy.', 'implemented',
    'src/cards/entries/08110.js:16-52：playCondition 校验合法目标（19-20），api.choice 任意已揭示地点非精英，交换位置（47-49）+ api.info'),
], P('perceivable', 'src/cards/entries/08110.js:33-36 api.choice+prompt；44,49 api.info；playCondition message 会展示给玩家（play-condition.js）', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:177-205', '含「无合法目标不能打出」反向断言。')))

// 08111 Blur (4)
out.push(find('08111', 'match', [
  cl('Uses (4 charges).', 'implemented', 'src/cards/entries/08111.js:15-16'),
  cl('[action] If Blur has charges remaining: Evade ... +2 skill value, may use [willpower].', 'implemented', 'src/cards/entries/08111.js:18-41'),
  cl('If you succeed, spend 1 or 2 charges and you may take that many additional actions this turn.', 'implemented', 'src/cards/entries/08111.js:42-55'),
  cl('If you succeed by 0, take 2 damage.', 'implemented', 'src/cards/entries/08111.js:56-59'),
], P('perceivable', 'src/cards/entries/08111.js:30-33,45-50 api.choice+prompt；55,58 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:157-176', '')))

// 08112 "Hit me!"
out.push(find('08112', 'approximation', [
  cl('Fast. Play after you reveal a chaos token during a skill test.', 'implemented', 'src/cards/entries/08112.js:17-22（tokenReveal 窗口 + state.skillTest.seat）'),
  cl('Reveal an additional chaos token, switching its "-" to a "+". If that chaos token is a [skull] token, you automatically fail.', 'approximation',
    'src/cards/entries/08112.js:23-35：用 tokenReveal 的 replacementToken 通道把额外标记替换**当前**标记（注释 8-11 已披露「原标记被替代而不是两枚都计入」）；引擎已有专用原语 api.playerTools.revealAdditionalTestToken（src/engine/api-misc.js:1499-1508，消费 tests.js:1147 起，primitives test:250）未使用',
    '与印刷「两枚都计入」不等价；现成原语未接线。'),
], P('perceivable', 'src/cards/entries/08112.js:33-34 api.info 明示额外标记与结果', ''),
  T('partial', 'tests/eote-player-m2-4.test.mjs:496-515', '直接执行描述子断言 replacementToken；未测与本次检定的合计。'),
  [
    ins('P6 原语 revealAdditionalTestToken 已实现并测试，但条目仍用 replacementToken 近似（账本 verified）。', 'primitive', 'src/cards/entries/08112.js:23-35 vs src/engine/api-misc.js:1499-1508；tests/eote-player-primitives.test.mjs:250', '改用 revealAdditionalTestToken({flipSign:true, autoFailOn:[\'skull\']})。', 'medium'),
    ins('条目用注释披露近似但无 `note` 字段（与同批其他近似卡口径不一致）。', 'docs', 'src/cards/entries/08112.js:8-11（无 note 键）', '补 note 字段。', 'low'),
  ]))

// 08113 Unscrupulous Loan
out.push(find('08113', 'approximation', [
  cl('Limit 1 per investigator. Cannot leave play.', 'implemented', 'src/cards/entries/08113.js:17 cannotLeavePlay；读点 src/engine/ability.js:902（assetCannotLeavePlay）'),
  cl('[reaction] After you play Unscrupulous Loan: Gain 10 resources.', 'implemented', 'src/cards/entries/08113.js:20-31（assetEnteredPlay + api.gainResources + 防重复）'),
  cl('Forced - When the game ends or you are eliminated, if you have fewer than 10 resources in your resource pool: Exile Unscrupulous Loan.', 'approximation',
    'src/cards/entries/08113.js:32-44：改为 roundEnds 每轮结束检查（注释 11-12/note 18 披露）；且用 removedFromGame 近似战役 exiled（注释 10）',
    '时机错位：资源<10 会在任意轮末被流放（而非游戏结束/退场时）。'),
], P('perceivable', 'src/cards/entries/08113.js:29,40-42 api.info（获得资源/被流放/无法离场）', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:521-543', '含「资源≥10 不流放」反向断言。'),
  [
    ins('触发时机近似为每轮结束（印刷：游戏结束或你退场时），且放逐用 removedFromGame 而非战役 exiled。', 'impl-vs-text', 'src/cards/entries/08113.js:11-12,32-44', '补「游戏结束/退场」窗口原语（queue 未登记）；退场可用 eliminateInvestigator 钩子。', 'medium'),
  ]))

// 08114 Precious Memento (Former Life)
out.push(find('08114', 'match', [
  cl('Limit 1 Precious Memento (From a Former Life) per deck.', 'implemented', 'cards-data deckLimit；构筑读点 src/deck/deckbuilding.js:518-519'),
  cl('[reaction] After you fail a skill test by 2 or more, exhaust Precious Memento: Heal 1 damage from it.', 'implemented',
    'src/cards/entries/08114.js:17-33（testEnds context.result+api.healAsset({damage:1})）'),
  cl('[reaction] After you succeed at a skill test by 2 or more, exhaust Precious Memento: Heal 1 horror from it.', 'implemented', 'src/cards/entries/08114.js:34-50 api.healAsset({horror:1,owner})'),
], P('perceivable', 'src/cards/entries/08114.js:31,48 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:208-244', '真实 performTest 路径 + 互不干扰断言。'),
  [ins('与 08115 同模板、治愈类型互换（08114.js:16-50 / 08115.js:14-49），应共享模板或平行版本别名。', 'duplication', 'src/cards/entries/08114.js:16-50；src/cards/entries/08115.js:14-49', '低优先。', 'low')]))

// 08115 Precious Memento (Future Life)
out.push(find('08115', 'match', [
  cl('Limit 1 Precious Memento (From a Future Life) per deck.', 'implemented', 'cards-data deckLimit；src/deck/deckbuilding.js:518-519'),
  cl('[reaction] After you fail a skill test by 2 or more, exhaust Precious Memento: Heal 1 horror from it.', 'implemented', 'src/cards/entries/08115.js:14-31'),
  cl('[reaction] After you succeed at a skill test by 2 or more, exhaust Precious Memento: Heal 1 damage from it.', 'implemented', 'src/cards/entries/08115.js:32-48'),
], P('perceivable', 'src/cards/entries/08115.js:29,46 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:235-244', '')))

// 08116 Talisman of Protection
out.push(find('08116', 'match', [
  cl('Fast. Play only during your turn.', 'implemented', 'src/cards/entries/08116.js:20-21（playCondition ownTurn；matcher.js:153-160）'),
  cl('Play Talisman of Protection under the control of any investigator at your location.', 'implemented', 'src/cards/entries/08116.js:23-40 api.choice + api.giveAsset'),
  cl('[reaction] When you assign damage and/or horror that would defeat you, discard Talisman of Protection: Cancel up to 2 of that damage and/or horror.', 'implemented',
    'src/cards/entries/08116.js:42-79：harmDealt 窗口（enemies.js:882-887 读回 context.damage/horror）、lethal 判定（53-56）、up-to-2 选择（61-73）、弃自身费用'),
], P('perceivable', 'src/cards/entries/08116.js:70-73 api.choice+prompt（取消几伤几恐组合）；78 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:250-276', '含「不足以击败不提供反应」反向断言。'),
  [ins('注释称取消走 api.cancelHarm，实际直接改 context.damage/horror（引擎确实是读回语义，属口径文档不一致）。', 'docs', 'src/cards/entries/08116.js:12-13 vs 76-77', '改注释指向 harmDealt 的 context 读回点。', 'low')]))

// 08117 Earthly Serenity (1)
out.push(find('08117', 'approximation', [
  cl('Uses (4 charges).', 'implemented', 'src/cards/entries/08117.js:16-17'),
  cl('[action]: Test [willpower] (1).', 'implemented', 'src/cards/entries/08117.js:24-26（api.test willpower 1）'),
  cl('For each point you succeed by, you may spend 1 charge to heal 1 damage or 1 horror from an investigator at your location.', 'approximation',
    'src/cards/entries/08117.js:34-56：逐点询问 ✓，但只有**一个**可治疗选项时会跳过询问直接花充能（44-48：「if (options.length === 2 && options[0].id === \'skip\') 直接取 options[1]」）',
    '「may」（可花可不花）被自动化为「必须花」：玩家无法保留充能。'),
  cl('If you succeed by 0, lose 1 resource.', 'implemented', 'src/cards/entries/08117.js:28-33'),
], P('perceivable', 'src/cards/entries/08117.js:44-47 api.choice+prompt；31,56 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:282-306', '两条断言（治疗 3 点/等难度失资源）。'),
  [
    ins('唯一合法治疗目标时自动花费充能，违反「may」的玩家选择权。', 'impl-vs-text', 'src/cards/entries/08117.js:43-49', '始终提供 skip（含单目标情形）。', 'medium'),
    ins('与 08119 同模板复制（08117.js:19-59 / 08119.js:18-58），可共享模板。', 'duplication', 'src/cards/entries/08117.js:19-59；src/cards/entries/08119.js:18-58', '低优先。', 'low'),
  ]))

// 08118 Enchanted Bow
out.push(find('08118', 'match', [
  cl('Uses (3 charges).', 'implemented', 'src/cards/entries/08118.js:23-24'),
  cl('[action] Exhaust Enchanted Bow: Fight. You must use either [willpower] or [agility] instead of [combat] and get +1 skill value for this attack. This attack deals +1 damage.', 'implemented',
    'src/cards/entries/08118.js:51-64（api.choice 意志/敏捷，combatBonus:1，damageBonus:1；测试断言用意志且 +1/+1）'),
  cl('As an additional cost to initiate this ability, you may spend 1 charge to have this attack target a non-[[Elite]] enemy at a connecting location; if you do, ignore the aloof and retaliate keywords for this attack.', 'implemented',
    'src/cards/entries/08118.js:32-70：连接地点非精英候选、fromConnecting 时 spendUses(1) 且 atConnectingLocation/ignoreAloof/ignoreRetaliate 传给 api.fight（combat.js:131-147,190）'),
], P('perceivable', 'src/cards/entries/08118.js:39-59 两级 api.choice+prompt + api.info 说明是否花充能/忽略关键词', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:323-355', '含「同地点攻击不花充能」「精英不能作连接目标」断言。')))

// 08119 Earthly Serenity (4)
out.push(find('08119', 'approximation', [
  cl('Uses (6 charges).', 'implemented', 'src/cards/entries/08119.js:15-16'),
  cl('[action]: Test [willpower] (0).', 'implemented', 'src/cards/entries/08119.js:23-25'),
  cl('For each point you succeed by, you may spend 1 charge to heal 1 damage or 1 horror from an investigator at your location.', 'approximation',
    'src/cards/entries/08119.js:33-55 同 08117：单一合法目标时跳过询问自动花充能（43-47）', '「may」被自动化。'),
  cl('If you succeed by 0, lose 2 resources.', 'implemented', 'src/cards/entries/08119.js:27-32'),
], P('perceivable', 'src/cards/entries/08119.js:43-46 api.choice+prompt；30,55 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:307-317', ''),
  [ins('同 08117 的自动花充能问题。', 'impl-vs-text', 'src/cards/entries/08119.js:42-48', '始终提供 skip。', 'medium')]))

// 08120-08124 Talent templates
const talent = (code, name, traitsZh, testEv, exact) => {
  out.push(find(code, 'approximation', [
    cl('Uses (2 resources). Replenish these resources at the start of each round.', 'implemented', `${exact}:19-22 forced roundStarts → api.playerTools.replenishResources（player-mechanics.js:252-257）`),
    cl(`Resources on ${name} may be spent to pay for ${traitsZh} cards.`, 'approximation',
      `${exact}:23-35,49-70：用 beforePlayCost 窗口 context.costReduction 减费近似（note 已披露；引擎费用管线无「支援资源作为支付来源」读点；池不足时仍无法打出）`, '近似已披露：资源池必须本来够付，卡上资源只是少扣池内资源。'),
    cl(`[fast] During a skill test on a ${traitsZh} card, spend 1 resource from ${name}: You get +1 skill value for this test.`, 'implemented',
      `${exact}:35-46：duringOwnSkillTest + api.spendUses(1) + api.addPendingTestBonus(1)；特性判定读 state.skillTest.source.code（tests.js:180）`),
  ], P('perceivable', `${exact}:43-46 api.info（花费资源/检定+1）；beforePlayCost 有「花费 N 资源」选择（59-64）`, ''),
    T('covered', testEv, ''),
    [
      ins('「本卡资源可支付指定特性卡」用减费近似（已披露）；prior 账本仍 verified/simplified=false。', 'impl-vs-text', `${exact}:23-35,49-70`, '补费用来源原语或降级账本。', 'medium'),
    ]))
}
talent('08120', '先知先觉', '[[幸运]]、[[法术]]、[[勇气]]', 'tests/eote-player-m2-4.test.mjs:573-591', 'src/cards/entries/08120.js')
talent('08121', '一探究竟', '[[守护]]、[[策略]]、[[书籍]]', 'tests/eote-player-m2-4.test.mjs:593-595', 'src/cards/entries/08121.js')
talent('08122', '好勇斗狠', '[[护甲]]、[[枪械]]、[[近战]]', 'tests/eote-player-m2-4.test.mjs:597-599', 'src/cards/entries/08122.js')
talent('08123', '技艺精湛', '[[洞察]]、[[工具]]、[[技巧]]', 'tests/eote-player-m2-4.test.mjs:601-603', 'src/cards/entries/08123.js')
talent('08124', '古物藏家', '[[恩惠]]、[[遗物]]、[[仪式]]', 'tests/eote-player-m2-4.test.mjs:605-607', 'src/cards/entries/08124.js')
// five-copy duplication note on one representative + all
out[out.length - 5].issues.push(ins('08120–08124 是同一模板的 5 份复制（token jaccard 0.926），按「同句规则只写一次/第三张停止写卡」应上收共享模板；D5 缺失。', 'duplication', 'src/cards/entries/08120.js:15-70；08121.js:15-70；08122.js:15-70；08123.js:15-70；08124.js:15-70（screen/duplication.json clonePairs jaccard 0.926）', '抽 entries/_shared 模板（特性数组 + 资源支付 + 检定加值），5 张仅声明参数。', 'medium'))

// 08125 In the Thick of It
out.push(find('08125', 'approximation', [
  cl('Permanent. Limit 1 per deck. Purchase at deck creation.', 'implemented',
    'cards-data permanent:true；src/engine/setup.js:339-350 开局循环 + kind:setup 描述子；deckLimit=1（deckbuilding.js:518-519）'),
  cl('When you purchase In the Thick of It, suffer 2 total physical and/or mental trauma. Then, earn 3 experience.', 'approximation',
    'src/cards/entries/08125.js:18-41：改为每场 setup 一次性结算（recordSets 防跨场景重复）；构筑/购买层留 P7（note 已披露）',
    '创伤/经验在开局结算而非构筑时；总量与一次性效果等价，触发时机不同。'),
], P('perceivable', 'src/cards/entries/08125.js:24-32 分配选择 + 39 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:613-628', '含跨场不重复断言。'),
  [
    ins('「购买时」结算近似为每场 setup 一次性结算（已披露）。', 'impl-vs-text', 'src/cards/entries/08125.js:10-16,18-41', '构筑层支持后迁移。', 'medium'),
  ]))

// 08126 Heavy Furs
out.push(find('08126', 'match', [
  cl('[reaction] After you reveal a non-[auto_fail] symbol on a chaos token during a skill test you are performing, deal 1 damage to Heavy Furs: Cancel that chaos token and return it to the bag. Reveal a new chaos token.', 'implemented',
    'src/cards/entries/08126.js:19-33：tokenEffectWouldResolve 窗口（tests.js:913）、api.placeAssetHarm、api.playerTools.rerollToken（player-mechanics.js:155-160，揭示循环 tests.js:914 消费）；health 2 上限 guard 与卡片数据一致（cards-data health=2）。real-path probe：强制 skull 时弹出反应、自身 1 伤害、重抽成功'),
], P('perceivable', 'src/cards/entries/08126.js:22 api 反应 label + 31 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:361-391', '含自动失败/数字标记不触发的反向断言。')))

// 08127 Sled Dog
out.push(find('08127', 'match', [
  cl('You may include up to 4 copies of Sled Dog in your deck. Up to 2 Sled Dog cards take up a single ally slot.', 'implemented',
    'cards-data deckLimit=4（deckbuilding.js:518-519）；sharedSlotGroup {upTo:2}（src/cards/entries/08127.js:41；读点 assets.js:134-147 slotExemptionRelief）'),
  cl('[action] Exhaust X Sled Dogs: Move. Move X times.', 'implemented', 'src/cards/entries/08127.js:43-69（chooseDogCount+exhaustDogs+逐次 api.moveInvestigator）'),
  cl('[action] Exhaust X Sled Dogs: Fight. You get +X [combat] for this attack. Instead of its standard damage, this attack deals X damage.', 'implemented',
    'src/cards/entries/08127.js:70-90（combatBonus:count，damageBonus:count-1 ⇒ 总伤害 count）'),
], P('perceivable', 'src/cards/entries/08127.js:30-35「横置几张（1–N）」选择 + 61-62 目的地选择 + 67 api.info', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:397-438', '槽位、移动、攻击三条断言。')))

// 08128 Rod of Animalism
out.push(find('08128', 'match', [
  cl('You have 2 additional ally slots, which can only be used to hold [[Creature]] assets.', 'implemented',
    'src/cards/entries/08128.js:25-27 restrictedSlots；读点 assets.js:166-197 restrictedSlotInfo'),
  cl('[reaction] When you play a [[Creature]] asset during your turn: Reduce that asset\'s cost by 1.', 'implemented',
    'src/cards/entries/08128.js:28-33 playCost modifier（读点 modifiers.js playCost / ability-exec.js）；state.currentSeat 限自己回合；测试验证 -1 与跨回合不生效'),
], P('perceivable', 'src/cards/entries/08128.js:29-32 modifier 由费用预览/支付体现（costPreviewSuffix）', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:444-464', ''),
  [
    ins('条目直接 import ALL_CARDS 并硬编码特性判定，绕过 ctx.api.cardTraits 的运行期特性（含 add:trait 授予）；D4/D5 口径不一致。', 'primitive', 'src/cards/entries/08128.js:13-21 vs src/engine/api-misc.js:735（cardTraits）', '改用 helpers.cardTraits/api 读点。', 'low'),
  ]))

// 08129 Call for Backup
out.push(find('08129', 'match', [
  cl('One at a time, in any order, if you control a... [rogue]/[guardian]/[seeker]/[mystic]/[survivor] card, do the matching effect.', 'implemented',
    'src/cards/entries/08129.js:44-107：api.cardFactions 判定职阶（api-misc.js:844-847）、循环「按任意顺序/结束」选择（56-62）、五项效果各实现'),
], P('perceivable', 'src/cards/entries/08129.js:56-60 api.choice+prompt + 每步 label；52 api.info 无事发生', ''),
  T('covered', 'tests/eote-player-m2-4.test.mjs:470-490', '')))

console.log('part2', out.length)
fs.writeFileSync(path.join(OUT, '_findings-part2.json'), JSON.stringify(out, null, 1))

// player-auditor-b findings part 3 (08130-08133 basic weaknesses) + merge
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

const weaknessCommon = (code, name, file, actionsZh, capabilityTargets, extra = []) => {
  const out = []
  out.push(find(code, 'approximation', [
    cl('Revelation - Put X into play in your threat area.', 'implemented',
      `${file}:22-27 kind:'weakness' weakness:{type:'threat',...}；读点 src/engine/weakness.js:278-301（inv.threat.push + counters）`),
    cl(`X can be healed as if it were a single point of ${code === '08130' || code === '08131' ? 'damage' : 'horror'} on you (if it is healed, discard it).`, code === '08130' || code === '08131' ? 'missing' : 'implemented',
      code === '08130' || code === '08131'
        ? `${file}:29-31 用 free + discardSelf 近似（注释与 note 自述「无 threatDamageSink」）。但引擎 P6 已实现 threatDamageSink：src/engine/harm-threat.js:702-740（读点 721 读 flags.threatDamageSink）+ api-misc.js:231-240 healDamage 统一入口 + tests/eote-player-primitives.test.mjs:85 测试；条目未声明该 flag。real-path probe：开启该近似能力后卡仍留在威胁区（stillInThreat=true），只是把卡号塞进弃牌堆（ability-exec.js:178-189 的 discardSelf 只处理 assets/attachments，无 threat 分支）`
        : `${file}:17-18 threatHorrorSink + redirectHeal{optional}；读点 src/engine/harm-threat.js:636-665（healHorrorFrom 可选改道），测试实测治疗可改道 1 点并弃卡`,
      code === '08130' || code === '08131'
        ? '伤害侧「可如同 1 点伤害被治愈、治愈即弃卡」不可用：既没走已实现的 sink，替代的免费弃置也不移除威胁区卡（卡继续生效、且弃牌堆多一张同名卡）。'
        : ''),
    cl(`Forced - After you take a ${actionsZh} action: You cannot take any of those types of actions for the remainder of the turn.`, 'approximation',
      `${file}:33-47 用 actionResolvedAtLocation 窗口 + api.addEffect({duration:'endOfTurn', modifiers:[${capabilityTargets.map(t => `'capability:${t}'`).join(', ')}]})；该窗口 context 不带行动类型（src/engine/dispatch.js:373-375），故「任意行动后」都锁。引擎另有 actionTaken 窗口带 actionKinds（src/engine/engine.js:2293-2307），可精确判定但不被使用`,
      '作用域过宽（任意行动都触发锁定），已披露近似。'),
  ], P('perceivable', `${file}:33-47 api.info（「本回合不能再…」）；锁定通过 legalMoves 消失体现（capability 读点见 modifiers.js:625-630）`, ''),
    T(code === '08130' || code === '08131' ? 'partial' : 'covered', code === '08132' || code === '08133' ? 'tests/eote-player-m2-4.test.mjs:674-704' : 'tests/eote-player-m2-4.test.mjs:652-672',
      code === '08130' || code === '08131'
        ? '只测「入威胁区+计数」与锁定效果；治愈/弃卡子句完全没有测试（且实现为不可用）。'
        : '锁定用探针手开窗口，未从真实行动触发；恐惧 sink 走真实 healHorrorFrom。'),
    extra))
  return out
}

const extra30 = [
  ins('「如同 1 点伤害被治愈（治愈即弃卡）」未实现：引擎 threatDamageSink 已就绪（entry 应声明 flags.threatDamageSink）却仍用旧近似。', 'primitive',
    'src/cards/entries/08130.js:13-15,29-31 vs src/engine/harm-threat.js:702-740；tests/eote-player-primitives.test.mjs:85', '加 flags: { threatDamageSink: true }，删除 free discardSelf 近似能力，并补「healDamage 治愈本卡→弃置」测试。', 'high'),
  ins('替代用的免费 discardSelf 能力无法把威胁区卡移除（ability-exec.js:178-189 无 threat 分支）：卡留在威胁区继续锁行动，同时卡号被塞进弃牌堆。', 'primitive',
    'src/cards/entries/08130.js:29-31 vs src/engine/ability-exec.js:178-189；real-path probe', '要么接 threatDamageSink（推荐），要么 discardSelf 费用补 threat 分支。', 'high'),
  ins('prior 账本 verified/simplified=false 与条目自述「无 threatDamageSink」矛盾（引擎已有），queue 亦无该请求记录。', 'docs', 'audit/eote-player-acceptance.json；src/engine/harm-threat.js:702-713', '账本记 approximation 并更新条目。', 'medium'),
  ins('08130–08133 四张基础弱点是同一模板 4 份复制（锁定能力结构完全相同），应上收共享模板/原语。', 'duplication', 'src/cards/entries/08130.js:33-47；08131.js:31-47；08132.js:29-45；08133.js:27-43', '抽共享 weakness 模板。', 'medium'),
]
const extra31 = [
  ins('「如同 1 点伤害被治愈（治愈即弃卡）」未实现：同 08130，threatDamageSink 已就绪未接线。', 'primitive',
    'src/cards/entries/08131.js:12-13,26-28 vs src/engine/harm-threat.js:702-740', '同 08130。', 'high'),
  ins('免费 discardSelf 无法移除威胁区卡（同 08130）。', 'primitive', 'src/cards/entries/08131.js:26-28 vs src/engine/ability-exec.js:178-189', '同 08130。', 'high'),
]
const extra32 = [
  ins('「After you take a play, engage, or resource action」被实现为任意行动后锁（actionResolvedAtLocation 无 actionKind）；引擎 actionTaken 窗口已带 actionKinds（engine.js:2293-2307）可精确实现。', 'impl-vs-text',
    'src/cards/entries/08132.js:29-45 vs src/engine/dispatch.js:373-375；src/engine/engine.js:2293-2307', '改用 actionTaken 窗口 + context.actionKinds 过滤 play/engage/gainResources。', 'medium'),
  ins('prior 账本 verified/simplified=false 与条目 note「approximation」矛盾。', 'docs', 'audit/eote-player-acceptance.json；src/cards/entries/08132.js:21', '账本记 approximation。', 'low'),
]
const extra33 = [
  ins('「After you take a parley, draw, or investigate action」被实现为任意行动后锁（同上）。', 'impl-vs-text',
    'src/cards/entries/08133.js:27-43 vs src/engine/dispatch.js:373-375；src/engine/engine.js:2293-2307', '改用 actionTaken 窗口 + context.actionKinds。', 'medium'),
]

const out = [
  ...weaknessCommon('08130', '臂伤', 'src/cards/entries/08130.js', 'fight or activate', ['fight', 'triggerAbilities'], extra30),
  ...weaknessCommon('08131', '腿伤', 'src/cards/entries/08131.js', 'move, resign, or evade', ['move', 'resign', 'evade'], extra31),
  ...weaknessCommon('08132', '惊慌', 'src/cards/entries/08132.js', 'play, engage, or resource', ['play', 'gainResources', 'engage'], extra32),
  ...weaknessCommon('08133', '麻木', 'src/cards/entries/08133.js', 'parley, draw, or investigate', ['parley', 'draw', 'investigate'], extra33),
]
console.log('part3', out.length)
fs.writeFileSync(path.join(OUT, '_findings-part3.json'), JSON.stringify(out, null, 1))

// ---- merge ----
const p1 = JSON.parse(fs.readFileSync(path.join(OUT, '_findings-part1.json'), 'utf8'))
const p2 = JSON.parse(fs.readFileSync(path.join(OUT, '_findings-part2.json'), 'utf8'))
const p3 = out
let all = [...p1, ...p2, ...p3]
const codes = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json', 'utf8'))['player-auditor-b'].codes
const missing = codes.filter(c => !all.some(x => x.code === c))
const extra = all.filter(x => !codes.includes(x.code))
if (missing.length || extra.length) { console.error('MISMATCH missing', missing, 'extra', extra); process.exit(1) }
all = codes.map(c => all.find(x => x.code === c))
const issues = all.flatMap(c => c.issues)
const count = s => issues.filter(i => i.severity === s).length
const summary = {
  cards: all.length,
  match: all.filter(c => c.verdict === 'match').length,
  approximation: all.filter(c => c.verdict === 'approximation').length,
  gap: all.filter(c => c.verdict === 'gap').length,
  blocked: all.filter(c => c.verdict === 'blocked').length,
  notApplicable: all.filter(c => c.verdict === 'not-applicable').length,
  issuedByDimension: {
    'impl-vs-text': issues.filter(i => i.dimension === 'impl-vs-text').length,
    perceivability: issues.filter(i => i.dimension === 'perceivability').length,
    primitive: issues.filter(i => i.dimension === 'primitive').length,
    duplication: issues.filter(i => i.dimension === 'duplication').length,
    docs: issues.filter(i => i.dimension === 'docs').length,
  },
  issuesBySeverity: { high: count('high'), medium: count('medium'), low: count('low') },
  perCardIssues: Object.fromEntries(all.filter(c => c.issues.length).map(c => [c.code, c.issues.map(i => i.severity[0] + ':' + i.dimension)])),
}
const doc = {
  area: 'player-b',
  auditor: 'player-auditor-b',
  method: '逐卡逐子句核对 cards-data 卡面（中英）vs 单卡条目源码/引擎读点/真实引擎路径 probe/测试断言；D2 读 ctx.api.choice/info/预览；D4 读 only 写走 ctx.api、无引擎卡号分支（screen primitive-compliance 的卡号命中均为注释，逐条核过）；D5 比对 screen/duplication.json 与同批同文卡。',
  generatedAt: '2026-11-08',
  scope: { shard: 'player-auditor-b', range: '08079-08133（M2-3 30 张 + M2-4 25 张，含基础弱点 08130-08133）', codes, count: codes.length },
  summary,
  priorLedgerChallenge: {
    ledger: 'audit/eote-player-acceptance.json（115 卡全 verified，gates.noSimplified=true，simplified=false）',
    overclaims: [
      '08102：真实 assetLeavesPlay 窗口 context.asset 无 location/traits → 反应永不出现；测试用手工 context 掩盖（high）。',
      '08105/08107：criteria 依赖真实引擎从不设置的 state.skillTest.actionKind → 能力/整卡在真机不可用（high）。',
      '08091：第二子句整条缺失，且引擎原语 setSigilToken/replaceRevealedToken 已实现并测试（high）。',
      '08081：伤害侧强制分配需 flags.composureDamage，条目未声明（primitive 已 done+测试）（high）。',
      '08083：盟友支援目标的伤害治疗不生效（healAsset 第二参类型错误）（high）。',
      '08088：eventPlayed 反应把 uses 永久设为 2 且跨座位触发（未披露规则偏差）（high）。',
      '08130/08131：threatDamageSink 已实现却仍用旧近似，且近似能力移不走威胁区卡（high×2）。',
      '近似类：08086/08097/08107/08112 的 P6 专用原语（addAttackDamageBonus/lookAtLocation/onTestSuccess/revealAdditionalTestToken）已实现并有原语测试，但条目仍用旧近似且账本记 verified。',
      'queue 状态与条目注释冲突：m2-3-08081/08086/08091/08097/08107 标 done，条目注释/实现仍是近似或缺失。',
      '账本 simplified=false 与各条目自述 note:' + 'approximation 冲突（至少 08082/08086/08087/08089/08097/08104/08106/08112/08113/08117/08119/08120-08125/08130-08133 等）。',
    ],
    note: '以上不否定「有测试/文件证据」，但按 README §1「verified 只代表有测试」口径，逐条复核后上述卡的 verified 不能作为语义正确性依据。',
  },
  cards: all,
}
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(doc, null, 1))
console.log(JSON.stringify(summary, null, 1))
console.log('written findings.json bytes=', fs.statSync(path.join(OUT, 'findings.json')).size)

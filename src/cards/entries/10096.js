// 10096 催眠作用（Mesmeric Influence）· 潜修者 · 技能 · 1 经验 · 意志/万能图标 · 熟练
// 卡面：
//   本卡牌投入到技能检定时，执行检定的调查员可以忽略本次检定期间将要触发的所有关键词和地点效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code>--entry。
//
// 读点 / 缺口（逐条）：
//   1. 「投入」本身：commit 描述子（图标来自卡面数据 willpower+wild，由 tests.js#commitIcons 读）。
//   2. 「本次检定期间可以忽略所有关键词或地点效果」：**没有读点**。
//      · 地点效果的忽略只有一条作用域通道 location-effect-scope.js（WeakMap + withOptionalLocationIgnore），
//        它只由 investigate 的 opts.mayIgnoreLocationEffects 进入（actions.js#runInvestigate，09059/06117 用），
//        不是「本次检定」的持续开关，也无法从投入区的技能牌打开；
//      · 关键词效果（反击/警戒/猎手/冷漠/借机攻击…）只有 ignore:<id> 修正（modifiers.js 的
//        audience=controller 常驻修正）与 ruleIgnored 读点，没有「只作用于本次检定」的时长作用域；
//      · commit 档案的已知字段（tokenModifiers / onCommit / conditionalIcons / maxPerTest …）里
//        没有任何「忽略效果」的声明。
//      因此本条目**不声明**无人读取的字段（「声明即接线」），只保留 commit 身份 + 图标，
//      并把缺读点写进 artifacts/migration/fhv/primitive-requests/10096.json。
//
// 近似披露（simplified）：本卡当前只有「投入技能检定提供意志/万能图标」这一条真实行为；
// 「忽略关键词与地点效果」尚未实现（缺 commit 档案的时长作用域读点）。
export default {
  code: '10096',
  name: '催眠作用',
  simplified: true,
  note: 'simplified: 投入检定提供意志+万能图标已接线（commit 描述子）；「本次检定期间可忽略所有关键词与地点'
    + '效果」无读点（location-effect-scope 只服务 investigate 的 mayIgnoreLocationEffects，ignore:* 是常驻修正），'
    + '见 primitive-requests/10096.json。',
  abilities: [
    {
      kind: 'commit',
      label: '投入技能检定（提供意志/万能图标）',
      skill: {},
    },
  ],
  modifiers: [],
}

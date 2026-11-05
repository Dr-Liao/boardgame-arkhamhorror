// 07074 印斯茅斯监狱（Innsmouth Jail）· 艾莲娜·哈珀失踪案（TIC 第二章）
//
// 印刷（中文）：
//   [显现] - 将印斯茅斯监狱放入场。
//   强制 - 在印斯茅斯监狱击败一个没有胜利点的敌人后：将其洗入线索牌堆。
// 印刷（英文）：
//   [Revelation] - Put Innsmouth Jail into play.
//   Forced - After an enemy with no victory points is defeated at Innsmouth Jail:
//     Shuffle it into the Leads deck.
//
// 引擎读点：
//   · 「[显现] - 放入场」= 条目 `encounterResolve = putRevealedPrintedLocation`
//     （encounter.js 的单面地点分支：`registeredEntry(code)?.encounterResolve?.(...) === true`；
//     同一藏身处组 07070/07071 等五张卡都有，本条先前缺失，一旦从迹象牌堆抽到会
//     `throw 未知遭遇卡` 中断抽牌——审计 M1）。
//   · 「击败无胜利点的敌人后洗入线索牌堆」= abilities 的 forced + enemyDefeated 窗口，
//     去向走 api.enemyOutcomes.destination 的 scenarioDeck 分支。
import { ALL_CARDS, putRevealedPrintedLocation } from '../../_shared.js'
export default {
  code: '07074', scope: 'location', implemented: true,
  encounterResolve: putRevealedPrintedLocation,
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated', label: '在监狱击败无胜利点敌人：将其洗入线索牌堆',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.accepted === true && context.sourceSeat === inv.seat
      && inv.location === source.id && !!context.enemy
      && !Object.hasOwn(ALL_CARDS[context.enemy.originalCode || context.enemy.code] || {}, 'victory'),
    resolve: ({ source, context, api }) => api.enemyOutcomes.destination(context,
      { kind: 'scenarioDeck', id: 'leads', shuffle: true }, { sourceId: source.id }),
  }],
}

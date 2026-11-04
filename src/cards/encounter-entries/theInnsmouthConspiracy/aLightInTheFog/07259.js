// 07259 尽腥尽力（Worth His Salt）· 雾中之光（a_light_in_the_fog）· 诡计
//
// 印刷（中文）：
//   显现 - 附属到奥赛罗思·马什，即便他在胜利区。
//   强制 - 在奥赛罗思·马什通过其猎手关键词移动后，如果他未与调查员交战：再次结算其猎手关键词。
//          他本阶段不能攻击。(每轮仅限一次)。
//   强制 - 在奥赛罗思·马什攻击时：本次攻击造成 +1 伤害和 +1 恐惧。弃掉本卡牌。
//
// 印刷（英文）：
//   Revelation - Attach to Oceiros Marsh, even if he is in the victory display.
//   Forced - After Oceiros Marsh moves via his hunter keyword, if he is unengaged: Resolve his hunter
//            keyword again. He cannot attack this phase. (Limit once per round.)
//   Forced - When Oceiros Marsh attacks: This attack deals +1 damage and +1 horror. Discard this card.
//
// 引擎读点：
//   · 显现附属：`api.scenario.attachEncounterToEnemy('07259', <MarshId>)`
//     （scenario-runtime.js：同时搜索 `state.enemies` 与 `state.victoryDisplay`，写宿主
//     `enemy.attachments`，encounterAttached:true）→ 满足「即便他在胜利区」。
//     宿主卡号 07253 奥赛罗思·马什（Haskell WorthHisSalt.hs 的 enemyIs oceirosMarsh）。
//     若马什既不在场也不在胜利区（本卡可能在他从旁置区生成前被抽出），引擎没有「场外敌人实例」
//     原语，条目给出提示并按未附属处理（卡片进遭遇弃牌堆）；见 primitive request
//     w2-07259-worth-his-salt.json 的 out-of-play 条目。
//   · 第 2 条「猎手移动后未交战 → 再次结算猎手；本阶段不能攻击（每轮一次）」：
//     条目级 forced `trigger:'enemyMoved'`：敌人附属条目已进入窗口来源枚举
//     （ability-rules.js#nonPlayerAbilitySources：敌人的 attachments 逐个 push），context 带
//     `{ enemy, enemyId, cause:'hunter', hunter:true }`（movement.js:387-390）；
//     criteria 要求「被移动的敌人正是本卡宿主」且移动后未交战；结算用既有原语
//     `api.scenario.resolveHunterMove(host)`（再次执行猎手移动）+ 
//     `api.scenario.skipEnemyAttackThisRound(host)`（本阶段不能攻击的实例读点，turn.js:189/244）；
//     `limit: { scope: 'perRound', owner: 'instance' }` 对应「每轮仅限一次」。
//   · 第 3 条「马什攻击时本次 +1 伤害 +1 恐惧并弃掉本卡」：
//     条目级 `treacheryRule.attackBonus: { damage:1, horror:1, discardOnAttack:true }`，
//     读点 enemies.js#enemyAttack（遍历该敌人的 attachments，求和后弃置本卡）。
//
// 实现状态：implemented:true（三条印刷条款全部接线；场外宿主为引擎原语缺口，已写 primitive request）。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

const OCEIROS_MARSH = '07253'
const WORTH_HIS_SALT = '07259'

const codeOf = entity => entity?.originalCode || entity?.code

function oceirosHost(state) {
  return [...(state.enemies || []), ...(state.victoryDisplay || [])]
    .find(entity => codeOf(entity) === OCEIROS_MARSH)
}

export default {
  code: WORTH_HIS_SALT,
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    attackBonus: { damage: 1, horror: 1, discardOnAttack: true },
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyMoved',
    label: '马什通过猎手关键词移动后若未交战：再次结算猎手，本阶段不能攻击（每轮一次）',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ context, source }) => context?.cause === 'hunter'
      && Boolean(context?.enemy)
      && (context.enemy.attachments || []).includes(source)
      && context.enemy.engagedSeat == null,
    resolve: ({ context, api }) => {
      const host = context.enemy
      api.scenario.resolveHunterMove(host)
      api.scenario.skipEnemyAttackThisRound(host)
    },
  }],
  encounterResolve(state, inv, card, api) {
    const host = oceirosHost(state)
    if (!host) {
      api.info?.('🧂 「尽腥尽力」：奥赛罗思·马什不在场也不在胜利区，没有可附属的宿主。')
      return false
    }
    api.attachEncounterToEnemy?.(WORTH_HIS_SALT, host.id)
    api.info?.(`🧂 「尽腥尽力」附属到奥赛罗思·马什${(state.victoryDisplay || []).includes(host) ? '（胜利区）' : ''}。`)
    return true
  },
}

// 10062 “咪咪”比安卡（Bianca "Die Katz" · 放声歌唱 Singing Your Song）· 潜袭者资产 · 2 资源 · 盟友槽
// 卡面：
//   每套牌库仅限 1 张。使用(10 资源)。
//   [action] 横置“咪咪”比安卡：谈判。将 X 资源从“咪咪”比安卡移动到你的资源池。X 不能大于 5。
//   检定[agility](X)。如果你检定失败，记住“你欠比安卡 X 资源。”然后，查找你的绑定卡牌，
//   找出“咪咪”比安卡敌人并将她生成在你的地点。将本卡牌从游戏中移除。
//
// 读点（卡面 → 引擎）：
//   · 使用(10 资源) = 条目 uses / usesType 'resource'（与 06162 格雷戈里·葛利同一读点）；
//     卡片上的资源读写只经 api.addUses。
//   · 「[action] 横置……谈判」= kind 'action' + actionKind 'parley' + cost { action, exhaust }；
//     谈判不引发借机攻击由 isParleyDescriptor 统一给。
//   · 「X」= api.choice(kind:'amount', 0..min(5, 剩余资源))，与参考实现 chooseAmount 同范围。
//   · 检定[agility](X) = api.test(seat, 'agility', X, { actionKind:'parley', resolve })；
//     失败的“记住”写战役记录（api.scenario.setCampaignRecord 是唯一写点，键含座位：
//     youOweBianca:<seat>，10063 的谈判行动读同一键）。
//   · 「查找绑定卡牌 → 生成敌人」= api.bonded.shuffleCopyIntoDeck（把绑定副本从场外集合取出）
//     + api.takeDeckCard（从牌库取出该副本）+ api.scenario.spawnEngaged（在调查员地点生成并交战）。
//   · 「将本卡牌从游戏中移除」= api.scenario.removeAsset（leaveAsset 的唯一读点，不落弃牌堆）
//     + api.removeFromGameCards（移出游戏记账）。
//
// 口径说明（与参考实现一致）：「然后，查找绑定卡牌……将本卡牌从游戏中移除」只在该次检定**失败**时
// 结算——成功时比安卡只是横置并继续留在场上（可再次借款），失败才翻脸成为敌人并离场。
const CODE = '10062'
const ENEMY = '10063'
const DEBT_PREFIX = 'youOweBianca:'

const debtKey = seat => `${DEBT_PREFIX}${seat}`

function takeBondedEnemy(inv, api) {
  if (!api.bonded.shuffleCopyIntoDeck(inv.seat, CODE, ENEMY)) return false
  return api.takeDeckCard(inv.seat, ENEMY) === ENEMY
}

export default {
  code: CODE,
  name: 'Bianca "Die Katz" (Singing Your Song)',
  uses: 10,
  usesType: 'resource',
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      cost: { action: true, exhaust: true },
      label: '谈判：借出至多 5 资源并检定[agility]；失败则记下欠款、生成比安卡敌人并将本卡移出游戏',
      resolve: ({ state, inv, source, api }) => {
        const maximum = Math.min(5, Math.max(0, Number(source?.uses) || 0))
        const answer = maximum > 0
          ? api.choice({
            kind: 'amount', source: CODE, seat: inv.seat,
            prompt: `“咪咪”比安卡：借出多少资源（0–${maximum}）？`,
            options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount} 资源` })),
          })
          : '0'
        const amount = Math.max(0, Math.min(maximum, Number(answer) || 0))
        if (amount > 0) {
          api.addUses(source, -amount)
          api.gainResources(inv.seat, amount)
        }
        api.info(`🎶 ${inv.name} 从“咪咪”比安卡处借出 ${amount} 资源，并检定[敏捷](${amount})。`)
        api.test(inv.seat, 'agility', amount, {
          actionKind: 'parley',
          source: { code: CODE, label: '谈判', name: api.cardName(CODE) },
          resolve: result => {
            if (result.success) {
              api.info('🎶 “咪咪”比安卡：检定成功，她继续留在场上（可再次借款）。')
              return
            }
            api.scenario.setCampaignRecord(debtKey(inv.seat), amount)
            api.info(`🎶 “咪咪”比安卡：检定失败，记住“你欠比安卡 ${amount} 资源”。`)
            if (takeBondedEnemy(inv, api)) {
              const spawned = api.scenario.spawnEngaged(ENEMY, inv.location, inv.seat)
              if (!spawned) api.info('🎶 “咪咪”比安卡：敌人无法在你的地点生成。')
            } else {
              api.info('🎶 “咪咪”比安卡：场外集合里找不到比安卡敌人。')
            }
            api.scenario.removeAsset(inv.seat, source.id)
            api.removeFromGameCards([CODE])
            api.info('🎶 “咪咪”比安卡离场，并从游戏中移除。')
          },
        })
      },
    },
  ],
  modifiers: [],
}

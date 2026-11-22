// 12016 保镖
// 卡面：你所在地点其他调查员受到的伤害，可以分配给[保镖]。
// 卡面：[reaction]在[保镖]被击败时：对你所在地点的一个敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「同地点其他调查员受到的伤害可以分配给本支援」= passive.assignHarmAtLocation:'damage'
//     （唯一读点 src/engine/harm-threat.js#assignHarm 的跨调查员承接枚举，与 05109/06155 同一读点）；
//   · 「被击败时」= assetDefeated 窗口（src/engine/asset-defeat.js#checkAssetDefeated 的唯一击败判定，
//     context 带 assetCode / assetId / asset）；之后选择一个同地点敌人造成伤害。

const CODE = '12016'
const DAMAGE = 1

export default {
  code: CODE,
  passive: { assignHarmAtLocation: 'damage' },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetDefeated',
      label: '被击败时：对你所在地点的一个敌人造成 1 点伤害',
      // 「被击败时」在引擎里是离场之前开的窗口（asset-defeat.js），不加窗口上限会被反复询问；
      // 每次击败事件只允许触发一次（与 07006 的 perWindow 口径相同）。
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [({ context, source }) => context?.assetCode === CODE && context?.asset?.id === source?.id],
      resolve: ({ inv, source, api }) => {
        const enemies = api.enemiesAt(inv.location).filter(enemy => api.canDamageEnemy(enemy, inv.seat, source))
        if (!enemies.length) { api.info('「保镖」被击败：你所在地点没有可造成伤害的敌人。'); return }
        const targetId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'enemy', source: CODE, seat: inv.seat,
          prompt: '「保镖」被击败：选择你所在地点的一个敌人，对其造成 1 点伤害。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === targetId)
        if (!enemy) return
        api.damageEnemy(enemy, DAMAGE, inv.seat, source)
        api.info(`「保镖」被击败：对「${enemy.name}」造成 ${DAMAGE} 点伤害。`)
      },
    },
  ],
  modifiers: [
  ],
}

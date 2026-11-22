// 12027 保镖
// 卡面：你所在地点其他调查员受到的伤害，可以分配给[保镖]。
// 卡面：[reaction]在[保镖]被击败时：对你所在地点的一个敌人造成2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（与 12016 同一套原语，升级版把反伤改为 2 点；生命/理智 3/2 来自卡面数据）：
//   · 「同地点其他调查员受到的伤害可以分配给本支援」= passive.assignHarmAtLocation:'damage'
//     （src/engine/harm-threat.js#assignHarm 的跨调查员承接枚举）；
//   · 「被击败时」= assetDefeated 窗口（src/engine/asset-defeat.js#checkAssetDefeated）；
//   · 对敌人造成伤害走 api.damageEnemy（canDamageEnemy 先判合法性）。

const CODE = '12027'
const DAMAGE = 2

export default {
  code: CODE,
  passive: { assignHarmAtLocation: 'damage' },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetDefeated',
      label: '被击败时：对你所在地点的一个敌人造成 2 点伤害',
      // 同 12016：assetDefeated 窗口在离场之前开，perWindow 保证每次击败只触发一次。
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [({ context, source }) => context?.assetCode === CODE && context?.asset?.id === source?.id],
      resolve: ({ inv, source, api }) => {
        const enemies = api.enemiesAt(inv.location).filter(enemy => api.canDamageEnemy(enemy, inv.seat, source))
        if (!enemies.length) { api.info('「保镖」被击败：你所在地点没有可造成伤害的敌人。'); return }
        const targetId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'enemy', source: CODE, seat: inv.seat,
          prompt: '「保镖」被击败：选择你所在地点的一个敌人，对其造成 2 点伤害。',
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

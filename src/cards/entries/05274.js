// 05274 特工支援（守护者 · 5 经验）
// 卡面：你所在地点其他调查员受到的伤害和/或恐惧，可以分配给特工支援。
// 卡面：[fast]横置特工支援并对其造成1点伤害：对你所在地点的一个敌人造成1点伤害。
// 卡面：[fast]横置特工支援并对其造成1点恐惧：发现你所在地点的1个线索。
// 卡面数据：4 生命 / 4 神智（盟友）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05274 特工支援：可以替同地点其他调查员承伤/承恐惧；两条[快速]能力（对敌人 1 伤害 / 发现 1 线索）。
//
// 「其他调查员受到的伤害/恐惧可以分配给特工支援」用引擎既有读点 passive.assignHarmAtLocation
// （harm-threat.js 的 assignHarm：同地点其他调查员的承伤支援候选）。

export default {
  code: '05274',
  passive: { assignHarmAtLocation: true },
  abilities: [
    {
      kind: 'action',
      label: '横置并对自身造成 1 伤害：对所在地点一个敌人造成 1 伤害',
      cost: { action: false, exhaust: true, assetDamage: 1 },
      target: { kind: 'enemy' },
      resolve: ({ state, inv, api, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        api.damageEnemy(enemy, 1, inv.seat)
        api.info(`💥 「特工支援」对「${enemy.name}」造成 1 点伤害。`)
      },
    },
    {
      kind: 'action',
      label: '横置并对自身造成 1 恐惧：发现所在地点 1 个线索',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        api.addAssetHorror(source, 1)
        api.info(`😱 「特工支援」承受 1 点恐惧（${source?.horror || 0}/${api.cardSanity('05274')}）。`)
        if ((source?.horror || 0) >= api.cardSanity('05274')) {
          api.discardAsset(inv.seat, source)
          api.info('「特工支援」被恐惧击败，弃置。')
        }
        api.discoverClue(inv.seat, 1)
      },
    },
  ],
}

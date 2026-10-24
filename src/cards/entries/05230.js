// 05230 瞄准镜（守护者 · 3 经验）
// 卡面：快速。附属到你控制的一张占用2个手部槽位的[[枪械]]支援。所附属支援不能用于攻击与你交战的敌人。
// 卡面：[reaction]在你用所附属支援执行攻击行动时，如果你没有与任何敌人交战，横置瞄准镜：本次攻击能够
//       以一个连接地点上的一个非[[精英]]敌人作为对象。本次攻击忽略冷漠和反击关键词。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05230 瞄准镜：快速附属到[[枪械]]支援（升级卡）。
//
// 显式简化（详见 worker 报告）：
//   未实现：①「所附属支援不能攻击与你交战的敌人」这条附属带来的限制；②附属期间的 [reaction]
//   （用所附属支援攻击时改指连接地点敌人、忽略冷漠/反击）。这两条都需要「附属卡能力/限制」的
//   引擎读点（能力层只枚举 inv.assets / threat，attachments 里的附属卡不参与枚举）。
//   已实现：快速打出、附属到枪械支援、每个支援仅限 1 张。
//   proposedApi: attachedCardAbilities(host) → 把 host.attachments 里的条目加入能力枚举 +
//   hostRestrictions 读点；见 artifacts/migration/tcu/primitive-requests/w-m2-3-05230-attached-abilities.json。

export default {
  code: '05230',
  fast: true,
  // 卡面「附属到你控制的一张占用 2 个手部槽位的[[枪械]]支援」：引擎 attachmentTargets 已支持 handSlots 过滤。
  // 卡面没有「每个支援仅限 1 张」的限制，因此不声明 maxPerTarget。
  attachTo: { kind: 'asset', trait: 'firearm', handSlots: 2 },
  // 引擎 combat.js 读点：宿主装备上挂有该字段的附属时，不能攻击与你交战的敌人。
  hostCannotAttackEngaged: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'activateFirearmFight',
      label: '横置瞄准镜：本次攻击可指向连接地点的非精英敌人，忽略冷漠与反击',
      // 费用：横置瞄准镜（附属实体上的 exhausted 标记）。
      cost: { exhaust: true },
      criteria: ctx => {
        const context = ctx.context || {}
        const source = ctx.source || {}
        // 只在「用挂着这张瞄准镜的那把枪」发动攻击时可用。
        if (source.hostAssetId == null || context.assetId !== source.hostAssetId) return false
        // 卡面条件：你没有与任何敌人交战。
        if ((ctx.state?.enemies || []).some(enemy => !enemy.defeated && enemy.engagedSeat === ctx.inv?.seat)) return false
        // 目标合法性：连接地点上至少有一个非精英敌人。
        const here = (ctx.state?.locations || []).find(location => location.id === ctx.inv?.location)
        const links = here?.connections || []
        return (ctx.state?.enemies || []).some(enemy => !enemy.defeated && !enemy.elite && links.includes(enemy.location))
      },
      resolve: ({ state, inv, source, context, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const links = here?.connections || []
        const candidates = state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && links.includes(enemy.location))
        if (!candidates.length) return
        const pick = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '05230', seat: inv.seat,
          prompt: '选择连接地点上的非[[精英]]敌人作为本次攻击的对象。',
          options: candidates.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locationName(enemy.location)}）` })),
        })
        // combat.js 的 activateFirearmFight 读点：这三个旗标交给本次攻击流程。
        context.allowConnecting = true
        context.redirectEnemyId = pick
        context.ignoreAloof = true
        context.ignoreRetaliate = true
        api.info('「瞄准镜」：本次攻击可指向连接地点的非精英敌人，并忽略冷漠与反击。')
      },
    },
  ],
}

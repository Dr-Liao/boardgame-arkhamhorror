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
  attachTo: { kind: 'asset', trait: 'firearm', maxPerTarget: 1 },
  simplified: true,
  note: '未实现：附属期间的 [reaction]（改指连接地点非精英敌人、忽略冷漠/反击）与「所附属支援不能攻击与你交战的敌人」'
    + '——需要「附属卡能力/限制」枚举读点（proposedApi: attachedCardAbilities(host)）；已实现快速打出与附属到[[枪械]]支援。P10 前补。',
  abilities: [],
}

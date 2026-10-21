// 02310 戴红手套的男子
// 卡面：快速。
// 卡面：[reaction]在戴红手套的男子入场后：选择你两项技能。戴红手套的男子在场上时，将每项所选技能的基础值提升为6。
// 卡面：强制 - 当神话阶段结束时：弃掉戴红手套的男子。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02310 戴红手套的男子：入场时选两项技能，其基础值提升为 6；神话阶段结束时弃掉。

export default {
  code: '02310',
  fast: true,
  forcedMythosEndDiscard: true,
  abilities: [
    {
      kind: 'entersPlay', label: '入场：选择两项技能，其基础值提升为 6',
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const pool = ['willpower', 'intellect', 'combat', 'agility']
        const first = api.choice({ kind: 'target', source: '02310', seat: inv.seat,
          prompt: '选择第一项技能（只要戴红手套的男子在场，其基础值提升为 6）。',
          options: pool.map(skill => ({ id: skill, label: api.skillName(skill) })) })
        const second = api.choice({ kind: 'target', source: '02310', seat: inv.seat,
          prompt: '选择第二项技能（基础值提升为 6）。',
          options: pool.filter(skill => skill !== first).map(skill => ({ id: skill, label: api.skillName(skill) })) })
        api.setStatOverride(source, [first, second])
        api.info(inv.name + ' 的' + api.skillName(first) + '与' + api.skillName(second) + '基础值提升为 6。')
      },
    },
  ],
  modifiers: [

  ],
}

// 51068 暴力命令（Erratic Fear）
// 归属：跨关卡共享（重返敦威治遗产 → erratic_fear）
// 卡面：显现 - 将暴力命令放置入场，放到你的威胁区域。
//       [action]：对你所在地点的一位调查员造成 2 点伤害，弃掉暴力命令。
// 说明：回合结束的意志检定待威胁区 turnEnd 读点补原语（dossier 已记录近似）。
export default {
  code: '51068', scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '对同地点的一位调查员造成 2 点伤害，弃掉暴力命令',
    resolve: ({ inv, source, api, state }) => {
      const here = (state?.investigators || []).filter(other =>
        !other.defeated && !other.resigned && other.location === inv.location)
      const target = here.length === 1 ? here[0] : api.choose?.({
        kind: 'investigator', source: '51068', seat: inv.seat, prompt: '选择受到 2 点伤害的调查员。',
        options: here.map(other => ({ id: String(other.seat), label: other.name })),
      })
      const seat = typeof target === 'object' ? target?.seat : Number(target ?? inv.seat)
      api.damage(Number.isInteger(seat) ? seat : inv.seat, 2)
      api.removeThreat?.(source)
    },
  }],
}

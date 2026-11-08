// 08670 静电放电（Electrostatic Discharge）· 大封印组诡计
// 卡面：Surge。揭示 - 与封印同地点的每名调查员受 1 恐惧；如果该封印已激活，改为受 1 伤害与 1 恐惧。
// 读点：章节 behavior.resolveEncounter 读取 flags.revelation 分派（条目内不改状态）。
export default {
  code: '08670',
  scope: 'treachery',
  implemented: true,
  flags: {
    surge: true,
    revelation: 'electrostaticDischarge',
  },
  treacheryRule: {
    surge: true,
  },
}

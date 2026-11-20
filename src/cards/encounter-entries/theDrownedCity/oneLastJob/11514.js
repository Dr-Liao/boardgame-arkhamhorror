// 11514 帮派线人 · 敌人 ×2（金盆洗手）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：冷漠。
//       生成 - 最近的有线索[[阿卡姆]]地点。
//       强制 - 本敌人处于重整状态时，本敌人所在地点的一位调查员发现 1 个或更多线索后：
//       该调查员必须花费 3 个资源，或在当前密谋上放置 1 个毁灭标记。
// 印刷：战斗 1 / 躲避 3 / 生命 1 / 伤害 1 / 恐惧 0 / 特性 [[Humanoid]][[Criminal]][[Syndicate]]。
// 读点：冷漠由 definition 解析卡文（aloof=true）。
export default {
  code: '11514',
  scope: 'enemy',
  implemented: false,
  note: 'approximation：冷漠已由 definition 解析；「生成 - 最近的有线索阿卡姆地点」与'
    + '「发现线索后花 3 资源或放 1 毁灭」的强制能力需要专用生成/发现读点，暂未实现。',
  abilities: [],
}

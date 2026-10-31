// 01160 食尸鬼爪牙（Ghoul Minion）· 核心包共享遭遇组 ghouls
// 卡面：无规则文本（只有特性 Humanoid / Monster / Ghoul 与印刷数值）。
// 一卡一文件：这张卡没有专属行为，条目只登记「已实现」——数值/关键词由 definition 的印刷数据提供；
// 跨循环通用遭遇组条目必须存在，供各战役的 encounter-entries 归属算法与逐章自检（check-*-scenario）解析。
export default {
  code: '01160',
  scope: 'enemy',
  implemented: true,
}

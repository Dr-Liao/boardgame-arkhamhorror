// 区域词典片段：杂项（卡图主机校验、构筑规则报错、ArkhamDB 导入、目录加载等）。
// 由 Lead 维护；聚合入口见 zh-CN.js。

export default {
  // 卡图主机校验（images.js）
  'misc.imageHost.invalid': '卡图主机必须是完整的 http(s) 地址',
  'misc.imageHost.protocol': '卡图主机只允许 http 或 https',
  'misc.imageHost.credentials': '卡图主机不能包含账号、查询参数或片段',

  // 目录加载（catalog.js）
  'misc.catalog.loadFailed': '目录加载失败',

  // 构筑规则校验（deck-rules.js）
  'misc.deckRules.invalid': '无效构筑规则',
  'misc.deckRules.limit': '无效构筑限额',
  'misc.deckRules.levelRange': '无效卡牌等级区间',
  'misc.deck.unknownCard': '未知卡牌：{code}',
  'misc.deck.excluded': '{name} 属于构筑限制排除的卡牌',
  'misc.deck.size': '牌库需 {size} 张玩家卡，当前 {count} 张',
  'misc.deck.overLimit': '{name} 超过张数上限',
  'misc.deck.restriction': '{name} 不符合构筑限制或限额',
  'misc.deck.atleastInvalid': '无效的阵营数量构筑要求',
  'misc.deck.atleast': '牌组必须至少包含 {factions} 个不同阵营各 {minimum} 张牌',
  'misc.cardPool.all': '全部',
  'misc.cardPool.progressive': '渐进式',
  'misc.upgrade.quote': '卡牌经验 {printed} − 同名升级抵扣 {credit}，最低 1 XP',
  'misc.upgrade.discount': '，优惠 {discount}',

  // ArkhamDB 牌组导入（arkhamdb-import.js）
  'misc.import.empty': '请粘贴 ArkhamDB 牌组链接、编号或导出的 JSON。',
  'misc.import.missingFields': 'JSON 中缺少 investigator_code 或 slots 字段。',
  'misc.import.badJson': 'JSON 格式无效，请复制完整的牌组数据。',
  'misc.import.badUrl': '无法识别的链接。',
  'misc.import.host': '仅支持 arkhamdb.com 的牌组链接。',
  'misc.import.noDeckId': '链接中没有找到牌组编号，例如 https://arkhamdb.com/decklist/view/12345。',
  'misc.import.timeout': '导入超时，请稍后重试。',
  'misc.import.network': '无法连接大厅服务。',
  'misc.import.badResponse': '导入接口响应无效。',
  'misc.import.failed': '导入失败。',
  'misc.import.investigatorMissing': '调查员尚未实现',
  'misc.import.autoSignature': '专属卡牌，保存时自动加入',
  'misc.import.autoWeakness': '基础弱点由系统随机抽取',
  'misc.import.notInCatalog': '图鉴中不存在该卡',
  'misc.import.otherSignature': '其他调查员的专属卡牌',
  'misc.import.notPlayerCard': '不是可加入牌库的普通玩家卡',
  'misc.import.notImplemented': '尚未实现',
  'misc.import.xpTooHigh': '{xp} 级卡，开局牌组只能使用 0 级卡',
  'misc.import.restriction': '不符合{name}的构筑限制',
  'misc.import.taboo': '本牌组使用了禁限卡表，导入时按原始卡牌规则处理。',
  'misc.import.side': '已忽略备选区的 {count} 张卡。',
  'misc.import.ignoreLimit': 'ArkhamDB 中「不计入牌库张数」的标记不会保留。',
}

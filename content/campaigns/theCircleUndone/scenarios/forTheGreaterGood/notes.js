// 本章账本：完全未实现的卡面子句（gaps）与忠实近似（approximations）。
// 放在 behavior.js 之外的独立文件里，保持 behavior.js 行数只减不增（architecture-guard）。
export const scenarioGaps = []

export const scenarioApproximations = [
  '结局的额外 XP（数字混乱标记钥匙按 1 点经验结算）未在 resolution 里发放：引擎没有结局 XP 管线，经验值由 P9 战役流程统一结算（胜利区卡牌的胜利点已计入 state.victory）。',
  '参考实现收齐的「远古恶魔/黑暗异教徒/上锁的门」三个核组不在本战役包（TCU 只有 21 个遭遇组）：议程 1 背面只能从本包弃掉的异教徒敌人中抽取，黑暗异教徒组的祭司/密会巫师等不参与；setup 的「从遭遇组移除 3 祭司/1 密会巫师」相应只做了本包内的等价移除。',
  '四把钥匙：参考实现用混乱标记钥匙（Arkham.Key，skull/cultist/tablet/elderthing 标记）实现；本轮无钥匙原语，改用 `state.scenarioKeys`（{ holder, location, enemyId } 纯 JSON）记录同一语义：放在敌人/地点/调查员上、敌人离场时由击败者取得否则留在原地、同地点四钥匙开启机关盒。',
  '机关盒「附属到敌人」：引擎没有 AttachedToEnemy 的剧情资产，用 `state.scenarioFlags.puzzleBox`（holder: enemy/seat/removed + enemyId/seat）记录归属，资产实例只存 `state.storyAssets`（location 同步）。',
  '议程 2 背面「弃掉全部幕牌」：用 `state.acts = []` 近似（引擎没有「弃幕」原语）；此后幕无法推进，只能等撤退/结局。',
  '幕 1 渗透秘社正面「在你躲避一个敌人后：移除其所有毁灭」：自动结算（不询问玩家是否使用反应），在 afterEvade 中移除该敌人全部毁灭。',
  '边缘虚空骑士谈判成功「控制其 1 个毁灭并翻至线索面」：用「敌人 -1 毁灭、调查员 +1 线索」等价实现。',
  '核心圈骑士的猎物「控制最多钥匙」不影响引擎的猎物选择（引擎 prey 管线只认印刷猎物短语）；生成位置按「与你所在地点连接的地点」实现。',
  '南森·威克（引导面）谈判计数用敌人实例的 resources 字段；「加入胜利区」用 api.banish（放逐到胜利区）。',
]


// 本章账本：完全未实现的卡面子句（gaps）与忠实近似（approximations）。
// 放在 behavior.js 之外的独立文件里，保持 behavior.js 行数只减不增（architecture-guard）。
export const scenarioGaps = []

export const scenarioApproximations = [
  '结局的额外 XP（数字混乱标记钥匙按 1 点经验结算）未在 resolution 里发放：引擎没有结局 XP 管线，经验值由 P9 战役流程统一结算（胜利区卡牌的胜利点已计入 state.victory）。',
  '参考实现收齐的「远古恶魔/黑暗异教徒/上锁的门」三个核组不在本战役包（TCU 只有 21 个遭遇组）：议程 1 背面只能从本包弃掉的异教徒敌人中抽取，黑暗异教徒组的祭司/密会巫师等不参与；setup 的「从遭遇组移除 3 祭司/1 密会巫师」相应只做了本包内的等价移除。',
  '四把钥匙：参考实现用混乱标记钥匙（Arkham.Key，skull/cultist/tablet/elderthing 标记）实现；本轮无钥匙原语，改用 `state.scenarioKeys`（{ holder, location, enemyId, assetId } 纯 JSON）记录同一语义：放在敌人/地点/调查员/剧情支援上（05210 奥古斯特的钥匙挂 assetId）、敌人离场时由击败者取得否则留在原地、同地点四钥匙开启机关盒。',
  '机关盒「附属到敌人」：第五轮起用引擎原语 `api.attachStoryAssetToEnemy`（真实 `enemy.attachments` 实例，cardsInPlay 可枚举）表示；`state.scenarioFlags.puzzleBox`（holder: enemy/seat/ground/removed + enemyId/seat）只记录归属，转交/击败/清场时同步摘下附属（behavior.js 的 attachPuzzleBox/detachPuzzleBoxAttachment/givePuzzleBoxTo）。',
  '议程 2 背面「弃掉全部幕牌」：用 `state.acts = []` 近似（引擎没有「弃幕」原语）；此后幕无法推进，只能等撤退/结局。',
  '南森·威克（引导面）谈判计数用敌人实例的 resources 字段；「加入胜利区」用 api.banish（放逐到胜利区）。',
  '机关盒「在你被击败时交给另一位调查员」由本章 behavior.investigatorEliminated 钩子实现；引擎的击杀钩子只派发给当前章节，机关盒随牌库进入其它章节时需各章自接（primitive request w-fix-c3c4-puzzlebox-elimination）。',
  '机关盒 [action]：火盆沿用 location.flags.brazier / location.litBrazier（与《联合与幻灭》同一份数据），幽灵看守人按 05086 实体识别；「本行动不会触发幽灵看守人的趁乱攻击」由引擎 dispatch 的 noOpportunityAttackFrom 通道豁免（behavior.actions 声明 [05086]）。',
  '议程 2 正面「位于圣堂地点的银暮秘社敌人失去冷漠」：引擎没有关键词移除/临时修正读点，本章在 enemySpawned/enemyMoved/roundEnded/enemyPhaseStart 以及 agendaChain（新密谋正面入场，src/engine/act-agenda.js:206-216）同步 enemy.aloof；圣堂地点集合固定、敌人位置变化只有这些入口，等价于 Continuous modifier（保留实现记录）。',
  '议程 2 背面「以崇高的利益替换幕与密谋牌库」：参考实现同样只把全部幕牌弃掉（selectEach AnyAct toDiscard）且议程已是最后一格（无下一议程可替换）；本实现用 `state.acts = []` 表示同一状态，无可观察差异（保留实现记录）。',
  '05208 秘社地窖（我们一直在等你）背面为空：已移除额外进入限制，改为正常「进入→揭示→放随机钥匙」流程。',
  '05213 地下墓穴：控制任意 1 把钥匙即放行（进入后正常揭示）；钥匙判定按当前调查员（state.currentSeat）。',
  '05204/05205 秘社大门「敌人不能生成在秘社大门」：引擎 spawnEnemy 统一咨询 behavior.spawnForbiddenAt（含 api.spawn 的 ignoreSpawn 路径），显式生成点在大门时按 noSpawn 生成失败处理；「生成 - 任意一个……」类改点从候选中排除大门。',
  '05220 响应召唤的怪兽「敌军阶段开始击败其所在地点的每个类人敌人」：通过 api.checkEnemyDefeat 走引擎击败结算（胜利区/离场触发/钥匙归属），不是直接把敌人移出战场。',
  '05221 核心圈骑士「在你进入其地点 / 其进入你地点后检定 agility(4)」：两个入口共用 forceKnightTest；「其进入你地点」由引擎 enemyMoved 钩子（locations.js/movement.js）驱动。',
  '05210 休息室钥匙挂在奥古斯特支援（assetId）、05227 谈判只问实际付费者并只交还奥古斯特身上的钥匙：行为按卡面/参考 AugustLindquist 实现；四把钥匙仍为 JSON 近似（见上）。',
]


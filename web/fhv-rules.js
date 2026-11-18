// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）玩家向规则条目与卡文直达。
// 依据：锁定的英文战役指南 base.json（specialRules / newKeywords / additionalRulesAndClarifications /
// prelude1–4 / fatigue / epilogue）与 audit/fhv-scope.json 的日期、混乱袋、居民与传家宝登记；
// 只写规则本身，不写引擎、实现状态、界面操作或验证状态。
// 本文件是纯数据浏览器模块（不 import 任何模块），由 web/rulebook-data.js 汇总进 RULES。
const rule = (id, title, titleEn, aliases, body, bodyEn, related, sortKey) => ({
  id,
  title,
  titleEn,
  group: '铁杉谷盛宴',
  groupEn: 'The Feast of Hemlock Vale',
  aliases: [title, titleEn, ...aliases],
  body,
  bodyEn,
  related,
  sortKey,
})

export const FHV_RULES = [
  rule('fhvCampaign', '《铁杉谷盛宴》战役概览', 'The Feast of Hemlock Vale: campaign overview', [
    '铁杉谷盛宴', '九循环', 'Hemlock Vale', 'The Feast of Hemlock Vale', 'FHV', '战役', 'campaign',
    '三日三夜', '可游玩序曲', '铁杉岛', '马尔克兹', '战役日志',
  ], [
    '《铁杉谷盛宴》是包含可游玩序曲与八个剧本的三日战役。1926 年 6 月，密斯卡托尼克大学的罗莎·马尔克兹博士带着助手伯蒂·马斯格雷夫与阿尔米蒂奇博士介绍的联络人登上铁杉岛，调查岛上独特的生态系统；调查员在三天三夜之间往返村庄、荒野与海岸，并在第三夜迎来这场战役的终局。',
    '战役按下列顺序编排：可游玩序曲《欢迎来到铁杉谷》；白天勘察《岩间密语》《汉洛克庄园》《寂静荒野》《消失的姐妹》《深沼之物》（每次从中选择一处尚未勘察的区域）；第一夜《扭曲空洞》或继续夜探；《第二日黎明》后的《最长一夜》或继续夜探；《最终日黎明》；《最终夜》；终章《山谷的命运》。',
    '玩家无法在一次战役中走完所有勘察，也无法与所有居民建立完整关系：三个白天时段各进行一次勘察，两个夜晚若选择夜探则再增加一次，其余夜晚用于夜晚专属关卡。每一次到访的区域会记入战役日志的“Areas Surveyed”。',
    '战役日志记录 Day / Time（当前日与时段）、Areas Surveyed（已勘察区域）、铁杉岛地图、九位居民的关系等级与笔记、混乱袋、未花费经验，以及伯蒂是否获救、珀尔家是否安息、伊丽莎白·彼得斯是否获救等剧情记录。只有实际到达的分支才会写入。',
    '白天序曲与紧随其后的白天勘察之间没有常规升级窗口；序曲与幕间获得的经验先记入“未花费经验”，直到指南指定的窗口才能花费。序曲期间没有遭遇牌堆。',
  ], [
    'The Feast of Hemlock Vale is a three-day campaign with playable preludes and eight scenarios. In June 1926 Dr. Rosa Marquez of Miskatonic University arrives on Hemlock Isle with her assistant Bertie Musgrave and contacts provided by Dr. Armitage to survey the island\'s unique ecosystem; the investigators travel between the village, the wilderness and the coast over three days and three nights, and reach the campaign\'s final night.',
    'The campaign is arranged in this order: the playable prelude Prelude: Welcome to Hemlock Vale; the daytime surveys Written in Rock, Hemlock House, The Silent Heath, The Lost Sister and The Thing in the Depths, choosing one unsurveyed area each time; the first night of The Twisted Hollow or a night survey; after Prelude: Dawn of the Second Day, The Longest Night or another night survey; Prelude: Dawn of the Final Day; Prelude: The Final Evening; and the finale Fate of the Vale.',
    'The players cannot visit every survey area or befriend every resident in one playthrough: three daytime slots each hold one survey, the two nights add one more survey only if a night survey is chosen, and the remaining nights are used for night-specific scenarios. Each area visited is checked off under Areas Surveyed in the Campaign Log.',
    'The Campaign Log records Day / Time, Areas Surveyed, the map of Hemlock Isle, the nine residents\' Relationship Levels and Notes, the chaos bag, Unspent Experience, and story records such as whether Bertie was rescued, whether the Pearl family was laid to rest and whether Elizabeth Peters was saved. Only branches actually reached are recorded.',
    'There is no normal upgrade window between a daytime prelude and the daytime survey that follows it; experience earned in preludes and interludes is recorded under Unspent Experience until the guide names an upgrade window. Preludes have no encounter deck.',
  ], ['fhvTime', 'fhvSurvey', 'fhvCodex', 'fhvResidents', 'fhvChaos', 'fhvDayNight', 'fhvElusive', 'fhvGrid'],
  'tieshanquchengyanzhanyigailan'),

  rule('fhvTime', '三天三夜与时间标记', 'Three days, three nights and time markers', [
    '三天三夜', '三日三夜', '时间标记', 'Day / Time', '第一天', '第一日', '第二日', '最终日',
    'three days', 'three nights', 'time marker', 'Day', 'Night', '10675', '10677', '10679',
  ], [
    '战役只有三日三夜：第一日、第二日与最终日各有一个白天与一个夜晚。日与时段是两个维度；同一天的白昼与夜晚使用不同的设置、遭遇组、居民位置、议程阈值与结局。',
    '设置时若指示放置时间标记卡，就从《第一日》《第二日》《最终日》遭遇组中取出当前日期对应的标记卡（第一日 10675、第二日 10677、最终日 10679），放在议程牌堆旁。它表示当前的日与时段，并同步记入战役日志的“Day / Time”栏。',
    '三个白天时段各进行一次勘察，从《岩间密语》《汉洛克庄园》《寂静荒野》《消失的姐妹》《深沼之物》中选择一处尚未勘察的区域；第一夜与第二夜可以选择夜探同一批关卡，或进入《扭曲空洞》《最长一夜》等夜晚专属关卡。',
    '多数关卡的设置与卡面会按当前日与时段分支：例如“若为第二日白天”只在把该关卡作为第二日白天游玩时生效；部分关卡的幕、议程阈值与结局也会随时段改变。',
    '第三日白天的勘察结束后进入《最终夜》，随后是终章《山谷的命运》，它在第三日夜晚结算。',
  ], [
    'The campaign spans exactly three days and three nights: the first day, the second day and the final day each have one daytime period and one night period. Day and time are two separate dimensions; the same day\'s daytime and night use different setups, encounter sets, resident positions, agenda thresholds and resolutions.',
    'When setup instructs players to put the Time Marker card into play, take the marker for the current day from The First Day, The Second Day or The Final Day encounter set (10675 for the first day, 10677 for the second day, 10679 for the final day) and place it next to the agenda deck. It shows the current day and time, and is recorded under Day / Time in the Campaign Log.',
    'Each of the three daytime slots holds one survey, choosing one unsurveyed area among Written in Rock, Hemlock House, The Silent Heath, The Lost Sister and The Thing in the Depths. On the first and second nights the investigators may survey the same areas at night or enter night-specific scenarios such as The Twisted Hollow and The Longest Night.',
    'Most scenarios branch their setup and card text on the current day and time: for example, "if it is Day 2" applies only when that scenario is played as a Day 2 scenario, and some scenarios also change their act, agenda thresholds and resolutions with the time period.',
    'After the final daytime survey the investigators enter Prelude: The Final Evening, followed by the finale Fate of the Vale, which takes place on the night of the final day.',
  ], ['fhvCampaign', 'fhvDayNight', 'fhvSurvey'], 'santiansanyeyushijianbiaoji'),

  rule('fhvDayNight', '昼夜关键词（Day／Night）', 'Day {day} and Night {night}', [
    '昼夜标记', '昼夜', '昼', '夜', '白日', '黑夜', '关键词', 'Day night', '[day]', '[night]', 'Dark',
  ], [
    '部分卡牌的文本以 (Day [day]) 或 (Night [night]) 开头；只有当前序曲或关卡处于相应时段时，这条文本才生效。没有这些关键词的能力不论昼夜都生效。',
    '设置指示也可以按当前日与时段分支；例如“若为第二日白天，把里弗·霍桑加入游戏”只在第二日白天生效，在第二夜不生效。',
    '少数关卡会在章节内改变时段判定。《消失的姐妹》中，位于 [[Dark]] 特质地点的卡牌使用 Night 效果，其余地点使用 Day 效果；遇到这类特别规则时以该关卡为准。',
    '双面卡的正反面常对应昼夜，例如同一敌人在夜晚面与白昼面有不同的关键词与数值；翻面按卡面指示结算，昼夜关键词本身不会让卡牌自动翻面。',
  ], [
    'Some card text begins with (Day [day]) or (Night [night]); that text is active only while the current prelude or scenario takes place during the matching period. Abilities without these keywords are active regardless of the time of day.',
    'Setup instructions may also branch on the current day and time; for example, "if it is Day 2, put River Hawthorne into play" applies only when playing as a Day 2 scenario, not during Night 2.',
    'A few scenarios change the time period locally. In The Lost Sister, cards at [[Dark]] locations use Night effects and cards at all other locations use Day effects; the scenario\'s special rules govern such exceptions.',
    'The two faces of a double-sided card often correspond to day and night, for example the same enemy having different keywords and values on its night side and day side; flip the card as its text directs, and the keyword alone never flips a card.',
  ], ['fhvTime', 'fhvCampaign', 'fhvCodex'], 'zhouyeguanjianci'),

  rule('fhvSurvey', '可游玩序曲与勘察整备', 'Playable preludes and survey preparation', [
    '序曲', '可游玩序曲', '勘察整备', '整备', '下次勘察', 'prelude', 'survey', 'preparation', 'Persist',
  ], [
    '序曲是可游玩的非对抗段落：它像普通关卡一样设置地图、幕与议程，玩家与居民交谈、调查并做出选择。序曲期间没有遭遇牌堆，任何需要抽取、检视或与遭遇牌堆互动的能力都无法使用。',
    '序曲结束时，每位调查员为下一次勘察保留：手牌至多到起始手牌数（当前手牌就是下一场的起始手牌，不再抽起始手牌，也不进行重调）；资源至多到起始资源；场上 1 张开局时不在场的支援（保留的必须是这类支援；其他支援与附属全部弃置，起始与永久支援保留）；以及自己控制的全部线索。',
    '结算整备时，把弃牌堆洗回牌库；设置下一场勘察时跳过核心规则“设置游戏”的第 1–8 步。',
    '序曲结束会给出若干下一场勘察的选择；从战役日志“Areas Surveyed”中尚未勾选的区域里选择一处，并按当前日与时段使用该关卡的对应形态。',
    '序曲与幕间获得的经验记入“未花费经验”。白天序曲到紧邻的白天勘察之间没有购牌升级；经验只有在指南指定的窗口才能花费。',
  ], [
    'A prelude is a playable, non-confrontational segment: it sets up a map, act and agenda much like a normal scenario, and the investigators talk with residents, investigate and make choices. There is no encounter deck during a prelude, so abilities that draw from, look at or otherwise interact with the encounter deck cannot be used.',
    'At the end of a prelude each investigator keeps the following for the next survey: cards in hand up to their opening hand size (the current hand is the opening hand for the next scenario, so no new opening hand is drawn and no mulligan is taken); resources up to their starting resources; one asset in their play area that does not normally start in play (only such an asset is kept; all other assets and attachments are discarded while starting and permanent assets remain); and all clues they control.',
    'When making these preparations, shuffle your discard pile into your deck; when setting up the next survey, skip steps 1-8 of Setting Up the Game in the Rules Reference.',
    'At the end of a prelude the guide offers several choices for the next survey; choose an area not yet checked off under Areas Surveyed in the Campaign Log and use that scenario\'s form for the current day and time.',
    'Experience earned in preludes and interludes is recorded under Unspent Experience. There is no card-purchase upgrade between a daytime prelude and the daytime survey that follows it; experience is spent only in the windows named by the guide.',
  ], ['fhvCampaign', 'fhvTime', 'upgrade', 'deck'], 'keyouwanxuequyukanchazhengbei'),

  rule('fhvCodex', '铁杉谷法典（The Codex）', 'The Codex', [
    '铁杉谷法典', '法典', 'codex', '[codex]', '关系等级', '笔记', '居民',
  ], [
    '铁杉谷法典是本循环的核心概念：一些地点、居民与敌人拥有法典条目，标记为 ([codex] X)。要阅读某位角色或某个地点的法典，必须先支付该能力上的全部费用，再翻到当前序曲或关卡的法典编号，结算该编号下的全部文本。',
    '每个法典条目在一场序曲或关卡中默认最多结算一次，除非卡面另有说明。',
    '触发法典条目的玩家结算该条目的全部效果，包括进行检定、受到伤害与支付资源等；无法确定触发者时，由队长结算。',
    '法典指示把某位放在一边的具名居民加入游戏时，除非另有说明，该居民以剧情支援面朝上加入游戏。战役日志中名字已被划去的居民不能进入游戏；名字被划去时，其笔记中的全部条目同样失效。',
    '结算某位角色的法典时，只能阅读自己满足条件的单个小节；第一个小节的条件不满足就跳到下一个小节。除非另有说明，只参考该角色在战役日志中的笔记与关系等级。',
    '结算法典并在战役日志中记录变更后，恢复游戏。',
  ], [
    'The Codex is the defining concept of this campaign: some locations, residents and enemies have codex entries marked ([codex] X). To read a character or location\'s codex entry, you must pay all costs on that ability first, then turn to that codex number in the current prelude or scenario\'s codex and resolve all of its text.',
    'Each codex entry cannot be resolved more than once per prelude or scenario unless otherwise stated.',
    'The player who triggered the codex entry resolves all of its effects, including taking tests, taking damage and paying resources; if it is unclear who triggered it, the lead investigator resolves the entry.',
    'If a codex entry instructs players to put a named set-aside resident into play, that resident enters play with their story asset side faceup unless otherwise stated. A resident whose name is crossed out in the Campaign Log cannot enter play; if a resident\'s name is crossed out, so are all entries in that resident\'s Notes.',
    'While resolving a codex entry for a character, read only the single section whose requirements you meet; skip to the following section when you do not meet the requirements of the first. Unless otherwise stated, only refer to that character\'s Notes and Relationship Level in the Campaign Log.',
    'After resolving the codex entry and recording any changes in the Campaign Log, resume play.',
  ], ['fhvResidents', 'fhvCampaign', 'fhvTime'], 'tieshanqufadian'),

  rule('fhvResidents', '居民关系等级与笔记', 'Residents, Relationship Levels and Notes', [
    '居民', '关系等级', '笔记', '传家宝', '划去', 'cross out', 'relationship level', 'notes', 'heirloom',
    '忘忧石', '玉米壳娃娃', '珀尔日记',
  ], [
    '剧情文本可能指示提高或降低某位居民的关系等级；在战役日志中找到该居民的条目并按指示调整。',
    '关系等级等于该条目中已勾选的格数：提高时勾选最左侧未勾选的格，降低时擦掉最右侧已勾选的格；除非另有说明，每次只增减 1 格；若被设定为 0，擦掉全部勾选。',
    '每位居民有独立的笔记集合；法典与剧情可以在其中记录内容，或按条件读取。名字被划去的居民不能进入游戏，其笔记全部失效，且不能通过剧情恢复。',
    '达到特定关系等级或完成法典支线，可能获得传家宝（《忘忧石》《玉米壳娃娃》《珀尔日记》）或让居民作为剧情支援加入游戏；传家宝与剧情支援跨章保留。',
    '九位居民各有剧情支援面与敌人面；关系等级、笔记与居民是否存活会影响夜晚序曲、居民决断与尾声。',
  ], [
    'Story text may instruct investigators to increase or decrease a resident\'s Relationship Level; find that resident\'s entry in the Campaign Log and adjust it as instructed.',
    'A resident\'s Relationship Level is the number of checked boxes in their entry: to increase it, check the leftmost unchecked box; to decrease it, erase the rightmost checked box; unless otherwise stated, change it by 1 box at a time; if it is set to 0, erase all checked boxes.',
    'Each resident has their own set of Notes; codex entries and story text can record or read them. A resident whose name is crossed out cannot enter play, all of their Notes stop applying, and story effects cannot restore them.',
    'Reaching a particular Relationship Level or completing a codex side story may grant a heirloom (Worry Rock, Corn Husk Doll or The Pearl Diary) or let a resident join as a story asset; heirlooms and story assets persist between scenarios.',
    'The nine residents each have a story asset side and an enemy side; Relationship Levels, Notes and whether a resident survives affect night preludes, the residents\' choices and the epilogue.',
  ], ['fhvCodex', 'fhvCampaign', 'fhvTime'], 'juminguanxidengjiyubiji'),

  rule('fhvGrid', '网格正交相邻', 'Location adjacency in this campaign', [
    '网格', '正交', '相邻', '空位', '放置地点', 'grid', 'adjacent', 'empty space', 'location placement',
  ], [
    '本循环多数关卡按固定网格摆放地点。在这些关卡中，每个地点除了印刷的连接图标外，还与共享同一条边的地点互相连接。',
    '相邻地点共享上、下、左、右边；只共享一个角的地点不算相邻，对角线不相邻。',
    '指示把新地点放入游戏时，放在你所在地点上、下、左、右的相邻空位；已有地点的位置不能放入。选择位置时，若能选未被占用的位置就必须选空位；若不能，则不放入任何新地点。',
    '使用《山谷》遭遇组的序曲与关卡是例外：这些地点的连接只按地点图标计算，不自动获得网格相邻连接。',
  ], [
    'Most scenarios in this campaign are arranged in a set grid pattern. In those scenarios each location is connected to every location adjacent to it in addition to any printed connection icons.',
    'Adjacent locations share a side: left, right, above or below. Locations sharing only a corner are not adjacent, so diagonal locations are not connected.',
    'When instructed to put a location into play, place it in an adjacent empty space above, below, left or right of your location; a space already occupied by a location cannot be used. If there is an unoccupied space available you must choose one; if not, no new locations are put into play.',
    'Preludes and scenarios using The Vale encounter set are the exception: those locations are connected only by their printed icons and do not gain grid adjacency automatically.',
  ], ['fhvCampaign', 'clues'], 'wanggezhengjiaoxianglin'),

  rule('fhvElusive', '逃逸（Elusive）', 'Elusive', [
    '逃逸', 'Elusive', '关键词', '敌人关键词',
  ], [
    '逃逸是敌人的关键词，代表想要避开调查员、以求自保或另有所图的敌人。',
    '已重整且带逃逸的敌人在攻击或被攻击后，于该次攻击结算完毕时立即与所有调查员解除交战，移动到相连地点（若有可能，优先选择没有调查员的地点），然后横置。',
    '该效果不论敌人当时是否与攻击的调查员交战都会发生；攻击结算包括检定结果、伤害、恐惧与反击等全部后续效果。',
    '逃逸不防止伤害或击败，也不改变敌人的生成与交战规则；横置的敌人在整备阶段照常重整。',
  ], [
    'Elusive is an enemy keyword that represents enemies trying to avoid the investigators for their own survival or to pursue their own goals.',
    'If a ready enemy with the elusive keyword attacks or is attacked, after that attack resolves it immediately disengages from all investigators, moves to a connecting location (preferring one with no investigators if able) and exhausts.',
    'This happens whether or not the enemy was engaged with the attacking investigator; the attack\'s resolution includes its test result, damage, horror and retaliate or other follow-up effects.',
    'Elusive does not prevent damage or defeat and does not change how the enemy spawns or engages; the exhausted enemy readies as usual in the upkeep phase.',
  ], ['fhvCampaign', 'engage', 'evade'], 'taoyi'),

  rule('fhvBlessCurse', '祝福与诅咒标记', 'Bless and curse tokens', [
    '祝福／诅咒', '祝福', '诅咒', '祝福标记', '诅咒标记', 'bless', 'curse', '[bless]', '[curse]', '标记池',
  ], [
    '祝福与诅咒标记是加入混乱袋的特殊标记。技能检定中，祝福标记通常提供 +2 并指示再揭示一枚标记；诅咒标记通常提供 −2 并指示再揭示一枚标记。继续揭示到不再要求揭示为止。',
    '检定结束后，已结算的祝福与诅咒标记放回对应的标记池，而不是混乱袋；它们不是数字标记，不会触发骷髅、石板、古神等符号效果。',
    '祝福与诅咒各有 10 枚实体标记；袋内、正在揭示和封印在卡牌上的标记共用同一数量。效果要求加入超过剩余数量的标记时尽可能加入；作为额外费用必须能完整支付。',
    '本循环的若干调查员与玩家卡会加入、移除、封印祝福或诅咒标记，或以两侧数量比较替代抽取、支付组合费用换取额外行动。需要比较数量时，在揭示标记前结算；组合支付必须在两类标记都足够时一次付清。',
    '标记的具体效果以卡面为准；祝福与诅咒标记数量相同（平局）时，按卡面指定的方式处理或由玩家选择。',
  ], [
    'Bless and curse tokens are special tokens added to the chaos bag. During a skill test a bless token normally gives +2 and instructs you to reveal another token, while a curse token normally gives -2 and instructs you to reveal another token; keep revealing until no further reveal is required.',
    'After the test ends, resolved bless and curse tokens return to their token pool rather than the chaos bag. They are not number tokens and do not trigger skull, tablet or elder thing symbol effects.',
    'There are 10 physical bless tokens and 10 physical curse tokens; tokens in the bag, currently revealed and sealed on cards share each supply. Add as many as possible when an effect asks for more than remain, and an additional cost must be payable in full.',
    'Several investigators and player cards in this campaign add, remove or seal bless or curse tokens, or replace a reveal with a comparison of the two supplies and pay mixed costs for an extra action. Any comparison happens before tokens are revealed, and a mixed cost must be paid in full from both supplies.',
    'The specific effect of a token follows the card; when bless and curse tokens are tied, use the handling named on the card or let the player choose.',
  ], ['ticBless', 'ticCurse', 'chaos', 'fhvCampaign'], 'zhufuyuzuzhoubiaoji'),

  rule('fhvFatigue', '战役疲劳', 'Campaign fatigue', [
    '疲劳', '战役疲劳', '标记替换', 'fatigue', 'non-symbol', 'chaos token replacement',
  ], [
    '长夜的疲劳会追上调查员。第一夜之后的黎明开场，从混乱袋随机抽取非符号标记，直到抽到 2 枚。',
    '把这 2 枚标记替换为数值低 1 的数字标记，替换后的袋在战役余下时间一直生效。若无法替换某枚标记，就重复这个过程，直到累计替换 2 枚标记。',
    '第二次夜晚之后的最终日黎明开场，再结算一次同样的疲劳。',
    '替换只改变混乱袋中的实体标记；卡牌效果临时加入的标记、封印标记与本次替换无关。',
  ], [
    'The fatigue of the long night catches up with the investigators. At the start of the dawn after the first night, draw non-symbol tokens from the chaos bag at random until you have 2 non-symbol tokens.',
    'Replace those tokens with chaos tokens of a value 1 lower; the changed bag applies for the remainder of the campaign. If you cannot replace a token, repeat the process until a total of 2 tokens have been replaced.',
    'At the start of the dawn after the second night, resolve the same fatigue again.',
    'The replacement changes only the physical tokens in the chaos bag; tokens added temporarily by card effects and sealed tokens are not involved.',
  ], ['fhvChaos', 'fhvCampaign', 'fhvTime'], 'zhanyipilao'),

  rule('fhvChaos', '混乱袋与符号', 'Chaos bag and symbols', [
    '混乱袋', '混乱标记', '骷髅', '旧印', '自动失败', 'chaos bag', 'skull', 'elder sign', 'symbols',
  ], [
    '本循环使用基础混乱袋：简单与标准各 14 枚，困难 15 枚，专家 16 枚；符号只有 2 枚骷髅与 1 枚旧印，其余为数字标记。',
    '每个关卡按当前难度使用本关提示卡结算骷髅、异教徒、石板与古神的修正与效果；骷髅通常按当前日数取负值，其余符号的效果以提示卡为准。旧印触发进行检定调查员卡上的旧印能力，自动失败使检定立即失败。',
    '战役开始时袋内只有数字标记、骷髅与旧印；序曲的选择会把石板或古神标记加入袋中，第一段山谷序曲结算时还会加入 1 枚自动失败标记，之后一直保留。',
    '混乱袋内容会随战役记录跨章保留；疲劳替换与剧情效果都会改变袋内实际标记，并记入战役日志的混乱袋栏。',
  ], [
    'The campaign uses the base chaos bag: 14 tokens on Easy and Standard, 15 on Hard and 16 on Expert. The symbol tokens are two skulls and one elder sign; the rest are number tokens.',
    'Each scenario resolves the modifiers and effects of its skull, cultist, tablet and elder thing tokens from its own prompt card for the current difficulty; the skull usually takes a negative value equal to the current day number, and the prompt card governs the other symbols. The elder sign triggers the elder sign ability on the investigating investigator\'s card, and the auto-fail token fails a test immediately.',
    'At the start of the campaign the bag holds only number tokens, skulls and the elder sign; a prelude choice adds a tablet or an elder thing token, and resolving the first Vale prelude adds one auto-fail token, which stays for the rest of the campaign.',
    'The contents of the chaos bag persist between chapters; fatigue replacements and story effects change the physical tokens in the bag and are recorded in the Chaos Bag section of the Campaign Log.',
  ], ['chaos', 'fhvCampaign', 'fhvFatigue', 'fhvTime'], 'hunluandaiyufuhao'),
]

export const FHV_RULE_IDS = Object.freeze(FHV_RULES.map(entry => entry.id))

// 卡文直达判据：与 content/campaigns/theFeastOfHemlockVale/keywords.js 的 patterns 同源，
// 测试逐张比对（tests/fhv-rules.test.mjs）；两份判据不能各走各的。
export const FHV_CARD_RULE_PATTERNS = Object.freeze([
  ['fhvElusive', /\bElusive\b/i],
  ['fhvCodex', /\[codex\]|relationship level/i],
  ['fhvDayNight', /\[(?:day|night)\]/i],
  ['fhvBlessCurse', /\[(?:bless|curse)\]/i],
  ['tskPatrol', /\bPatrol\b/i],
  ['alert', /\bAlert\b/i],
  ['fhvFatigue', /non-symbol tokens?|\bfatigue\b/i],
  ['fhvGrid', /\b(?:grid|adjacent empty space|slid(?:e|ing)|swapp?(?:ing)? locations?)\b/i],
  ['fhvResidents', /relationship level|heirloom|cross(?:ed)? out|makeshift notes|resident notes/i],
  ['fhvTime', /\bDay [123]\b|\bNight [123]\b|time marker/i],
  ['fhvSurvey', /make preparations for (?:your|the) next survey|next survey|Persist\b/i],
  ['fhvChaos', /\[(?:skull|cultist|tablet|elder_thing|auto_fail|elder_sign)\]|chaos bag|Easy \/ Standard|Hard \/ Expert/i],
  // 既有通用关键词继续连到基础规则条目（与 TIC/TDE/EotE/TSK 的卡文直达同一口径）。
  ['hunter', /\bHunter\b/i],
  ['aloof', /\bAloof\b/i],
  ['massive', /\bMassive\b/i],
  ['retaliate', /\bRetaliate\b/i],
  ['surge', /\bSurge\b/i],
  ['peril', /\bPeril\b/i],
  ['hidden', /\bHidden\b/i],
  ['revelation', /\bRevelation\b/i],
  ['victory', /\bVictory\b/i],
  ['prey', /\bPrey\b/i],
  ['spawn', /\bSpawn\b/i],
  ['parley', /\bParley\b/i],
  ['fast', /\bFast\b/i],
  ['permanent', /\bPermanent\b/i],
  ['upgrade', /\bExceptional\b/i],
  ['elite', /\bElite\b/i],
  ['uses', /\bUses \(/i],
  ['doom', /\bdoom\b/i],
])

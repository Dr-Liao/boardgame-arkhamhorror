// 七循环《地球边缘》玩家向规则条目与卡文直达。
//
// 依据：锁定战役指南（base / 各场景）与印刷卡面整理；只写规则本身，不写实现、源码或验证状态。
// 本文件是纯数据浏览器模块（不 import 任何模块），由 web/rulebook-data.js 汇总进 RULES。
const rule = (id, title, titleEn, aliases, body, bodyEn, related, sortKey) => ({
  id,
  title,
  titleEn,
  group: '地球边缘',
  groupEn: 'Edge of the Earth',
  aliases: [title, titleEn, ...aliases],
  body,
  bodyEn,
  related,
  sortKey,
})

export const EOTE_RULES = [
  rule('eoteCampaign', '《地球边缘》战役概览', 'Edge of the Earth: campaign overview', [
    '地球边缘', '七循环', 'Edge of the Earth', 'EotE', '南极', 'Antarctica', '八章', '战役', 'campaign',
  ], [
    '《地球边缘》是位于南极大陆的八章战役。按顺序推进：亡命冰原 第 I、II、III 部分，失落之峰，古老者之城，疯狂之心 第 I、II 部分；致命幻景是可在幕间切入的可选章节。战役以序幕开始，以尾声结束。',
    '亡命冰原被拆成三个部分，之间由检查点 I（失踪事件）与检查点 II（袭击）衔接；疯狂之心第 I、II 部分之间是检查点 III。每个部分与章节都是独立的一局游戏，有自己的设置与结算；调查员可以在检查点之间暂停，或连续进行。',
    '检查点之后进入幕间故事 I（宁静夜晚）、II（无尽夜晚）、III（最后一夜）。幕间会结算伙伴与物资的处境、发放经验，并决定是否进入致命幻景及其返回的主线章节。只有实际到达的剧情与分支才会记入剧本日志。',
    '尾声按整场战役的记录结算，例如伙伴的存活与被划去、肯斯勒的研究、丹佛斯的状态与五枚封印的处理。剧本日志的探险队、已回收的补给品、致命幻景等部分会影响后续章节与最终的尾声。',
  ], [
    'Edge of the Earth is an eight-part campaign set in Antarctica. Play in order: Ice and Death, Parts I, II and III, To the Forbidden Peaks, City of the Elder Things, and The Heart of Madness, Parts I and II. Fatal Mirage is an optional scenario entered from the interludes. The campaign begins with a prologue and ends with an epilogue.',
    'Ice and Death is split into three parts joined by Checkpoint I (The Disappearance) and Checkpoint II (The Attack); Checkpoint III falls between the two parts of The Heart of Madness. Each part and scenario is its own game with its own setup and resolution; investigators may pause between checkpoints or play them back to back.',
    'The checkpoints lead into Interludes I (A Restful Night), II (An Endless Night) and III (The Final Night). Interludes resolve the state of partners and supplies, award experience, and decide whether the investigators enter Fatal Mirage and which main-line scenario they return to. Only branches actually reached are recorded in the Campaign Log.',
    'The epilogue is resolved from the records of the whole campaign, such as which partners survived or were crossed out, Dr. Kensler\'s research, Danforth\'s state and the handling of the five seals. The Expedition Team, Supplies Recovered and Fatal Mirage sections of the Campaign Log shape later scenarios and the final epilogue.',
  ], ['eoteFrost', 'eotePartners', 'eoteShelter', 'eoteMirage'], 'xunhuangailan'),
  rule('eoteFrost', '寒霜标记', 'Frost tokens', [
    '寒霜', '寒霜标记', '霜寒', 'frost', '[frost]', 'frost token', '混乱标记',
  ], [
    '本循环引入新的混乱标记：寒霜（[frost]）。战役开始时混乱袋里只有少量甚至没有寒霜标记；随着探险推进，卡牌与剧情会往袋里加入或移除寒霜，改变后续每一次检定的难度。寒霜加入后会在后续剧本间保留，除非被卡牌或游戏效果移除；在剧本日志的混乱袋部分记录当前袋内标记。',
    '技能检定中揭示的第一个 [frost] 标记效果为「−1。再揭示一枚标记」。同一检定中若再揭示一枚 [frost]，立即结束本次检定的「揭示混乱标记」步骤，本次检定按自动失败结算。检定结束后，把已揭示的寒霜标记放回混乱袋。',
    '寒霜最多 8 枚：混乱袋中与封印在场卡牌上的寒霜标记合计不能超过 8 枚。寒霜只在技能检定中有上述效果；在检定之外揭示的 [frost] 本身没有效果，除非卡面另有说明。',
    '不同难度的初始袋中寒霜数量不同：简单 0 枚，标准 1 枚，困难 2 枚，专家 3 枚。卡牌效果可以把寒霜加入或移出混乱袋、忽略或取消寒霜，或把其他符号「视为」寒霜；这些按卡面处理。',
  ], [
    'This cycle introduces a new chaos token, the frost token ({frost}). At the start of the campaign the chaos bag contains only a few frost tokens, if any. As the expedition proceeds, cards and story effects add or remove frost, changing the difficulty of every subsequent test. Frost added to the bag stays from scenario to scenario unless removed by a card or game effect; record the current bag contents in the Chaos Bag section of the Campaign Log.',
    'The first {frost} token revealed during a skill test has the effect “−1. Reveal another token.” If another {frost} token is revealed during the same test, immediately end the “reveal chaos tokens” step and resolve the test as an automatic failure. After the test ends, return all revealed frost tokens to the chaos bag.',
    'No more than eight frost tokens may be in the chaos bag and/or sealed on cards in play at any given time. Frost only has the above effect during a skill test; a {frost} token revealed outside a test has no effect on its own unless a card says otherwise.',
    'The starting bag contains different amounts of frost by difficulty: none on Easy, one on Standard, two on Hard and three on Expert. Card effects can add or remove frost, ignore or cancel it, or treat other symbols as frost; follow the card text.',
  ], ['eoteShelter', 'chaos', 'eoteCampaign'], 'hanshuangbiaoji'),
  rule('eotePartners', '探险队伙伴与纪念逝者', 'Partners and memorials', [
    '伙伴', '探险队伙伴', 'Partner', 'Expedition Team', '探险队', '纪念逝者', 'Memorials of the Lost', '纪念遗物',
  ], [
    '伙伴是出现在「探险队」遭遇组 9 张剧情支援上的关键词。每位调查员在战役的每个剧本开始时，可以选择一名伙伴支援并放置入场；每次选择都可以换一名伙伴，也可以不带伙伴。伙伴不是牌组卡牌，不能加入调查员的牌组。',
    '伙伴只有被击败才会离场：卡牌效果不能弃掉或移除伙伴，除非它被明确击败。若调查员被击败，与其同行的伙伴也被击败；伙伴被击败时从游戏中移除，并在剧本日志的探险队部分划去该角色名字。若调查员撤退，其伙伴离场但不算被击败，保留其上的伤害与恐惧。',
    '每局游戏结束时，按战役指南的指示把伙伴承受的伤害与恐惧记录在剧本日志的探险队部分；伙伴不占盟友槽位，也不随牌组一起更换。未被击败的伙伴会随调查员进入下一章，直到被划去。',
    '伙伴被划去后，幕间故事（如宁静夜晚、无尽夜晚、最后一夜）会给出对应「纪念逝者」遭遇组的剧情支援：任意一名调查员可以把该遗物加入自己的牌组，它不计入牌组张数。被划去的角色在剧本日志中保持划去状态，不会重返探险队。',
  ], [
    'Partner is a keyword on the nine story assets in the Expedition Team encounter set. At the start of each scenario in the campaign, each investigator may choose a partner asset and put it into play; they may choose a different partner each time, or none. Partner assets are not deck cards and cannot be added to an investigator\'s deck.',
    'A partner asset cannot leave play unless it is defeated: card effects cannot discard or remove it unless it is explicitly defeated. If an investigator is defeated, the partner with them is also defeated; a defeated partner is removed from the game and that character\'s name is crossed off in the Expedition Team section of the Campaign Log. If an investigator resigns, their partner leaves play but is not defeated and keeps its damage and horror.',
    'At the end of each game, record the damage and horror on partners in the Expedition Team section of the Campaign Log as the campaign guide instructs. Partners do not use the ally slot and are not swapped with the deck; a partner that is not defeated continues with the investigator into the next scenario until crossed off.',
    'Once a partner is crossed off, the interlude stories (A Restful Night, An Endless Night and The Final Night) offer the matching Memorials of the Lost story asset: any one investigator may add that relic to their deck, and it does not count toward deck size. A crossed-off character stays crossed off and does not rejoin the expedition.',
  ], ['eoteResolute', 'eoteCampaign', 'eoteMirage'], 'tanxianduihuoban'),
  rule('eoteResolute', '坚毅面与伙伴强化', 'Resolute assets', [
    '坚毅', '坚毅面', 'Resolute', '强化伙伴', '伙伴强化',
  ], [
    '坚毅是致命幻景中获得的伙伴强化形态。九名伙伴各有一张放在一边的坚毅剧情支援；在致命幻景中让某位伙伴直面其心魔后，把该伙伴的记忆故事卡加入胜利区，并在剧本日志的探险队部分其名字旁画勾。',
    '从获得坚毅面起，只要该伙伴在后续剧本中被选用，就改用放一边的坚毅版本，而不是探险队遭遇组中的版本；若该伙伴当时在场，立即把它换成坚毅版本。一名伙伴只能获得一次坚毅面。',
    '坚毅版本同样带伙伴关键词，仍然不占盟友槽位、不能被普通效果弃掉、跨章节保留伤害与恐惧；其能力与基础版本不同，按卡面结算。被划去的伙伴不会再获得坚毅面。',
  ], [
    'Resolute is the upgraded form of a partner earned in Fatal Mirage. Each of the nine partners has a Resolute story asset set aside. After helping a partner confront their demons in Fatal Mirage, add that partner\'s memory story card to the victory display and check the box next to their name in the Expedition Team section of the Campaign Log.',
    'From then on, whenever that partner is included or used during a scenario, use the set-aside Resolute version instead of the version from the Expedition Team encounter set; if the partner is currently in play, switch it to the Resolute version immediately. A partner can earn its Resolute form only once.',
    'The Resolute version still has the partner keyword: it does not use the ally slot, cannot be discarded by ordinary effects, and keeps its damage and horror across scenarios. Its abilities differ from the base version and follow its card text. A crossed-off partner cannot become Resolute.',
  ], ['eotePartners', 'eoteDiscipline'], 'jianyimian'),
  rule('eoteTekeli', '忒咳哩-哩！牌库', 'The Tekeli-li! deck', [
    '忒咳哩-哩', '忒咳哩-哩牌库', 'Tekeli-li', 'Tekeli-li!', '弱点牌库', 'Tekeli-li deck',
  ], [
    '本循环包含 16 张同名弱点「忒咳哩-哩！」。每个剧本设置时，把当前不在任何调查员牌组中的忒咳哩-哩弱点混洗成单独的忒咳哩-哩牌库，放在密谋牌堆旁。这 16 张由 7 种卡面按印刷份数组成。',
    '忒咳哩-哩与其他弱点一样：一张被加入调查员牌组后，就成为该牌组的一部分并跟随该调查员跨剧本保留。但它的结算会指示把这张牌放回忒咳哩-哩牌库，从而从调查员牌组中移除；因此牌库张数会随各调查员牌组中的忒咳哩-哩数量变化。',
    '卡牌效果要求抽取或混入牌库顶的忒咳哩-哩时，从该牌库操作且不查看内容；检定失败或卡面指定时，通常把牌库顶的若干张悄悄混入调查员牌库。忒咳哩-哩被抽到并结算后，默认放回忒咳哩-哩牌库底；持续修正可能改为洗回牌库、放牌库底、混入任一调查员牌库或留在原处，按卡面处理。',
    '所有忒咳哩-哩同名但效果不同：有的造成伤害或恐惧，有的随机弃牌、失去资源、失去行动、放线索或弃掉支援。它们只在作为弱点被抽到并结算时生效。',
  ], [
    'This cycle includes 16 weaknesses all titled “Tekeli-li!”. During each scenario\'s setup, shuffle the Tekeli-li! weaknesses that are not already in an investigator\'s deck into a separate Tekeli-li deck and place it near the agenda deck. The 16 cards are printed as seven different card faces in fixed quantities.',
    'Like other weaknesses, a Tekeli-li! added to an investigator\'s deck becomes part of that deck and stays with the investigator from scenario to scenario. Its resolution, however, instructs the investigator to return it to the Tekeli-li deck, removing it from their own deck. The size of the Tekeli-li deck therefore varies with how many of these weaknesses are in investigators\' decks.',
    'When a card tells you to draw from or shuffle cards into the top of the Tekeli-li deck, do so without looking at its contents. On a failed test or as a card instructs, you typically shuffle the top cards of the Tekeli-li deck into an investigator\'s deck without looking at them. After a Tekeli-li! is drawn and resolved, it normally goes to the bottom of the Tekeli-li deck; persistent modifiers may instead shuffle it back, put it on the bottom, shuffle it into any investigator\'s deck, or leave it where it is.',
    'All Tekeli-li! cards share the same title but have different effects: some deal damage or horror, some discard a random card, lose resources or actions, place clues, or discard an asset. They take effect only when drawn and resolved as a weakness.',
  ], ['eoteFrost', 'eoteCampaign'], 'tekelilibaiku'),
  rule('eoteShelter', '庇护值、营地与检查点', 'Shelter, the camp and checkpoints', [
    '庇护值', '庇护', '营地', 'Shelter', 'shelter value', 'camp', '检查点',
  ], [
    '庇护值是部分地点的印刷数值（0 至 9），写在亡命冰原地点的已揭示面上；它代表该地点在极寒中提供庇护的程度。地点或卡牌文本会读取庇护值决定检定难度、初始资源与检查点结果。',
    '营地的庇护值在亡命冰原各部分的设置与检查点中沿用：亡命冰原第 II 部分开始时，每位调查员的初始资源等于营地庇护值（而不是 5）；亡命冰原第 I 部分的经验奖励按营地庇护值计算（最低 3）。',
    '检查点 I 的失踪事件中，先找出探险队所有存活成员的剧情支援，洗混后随机取等于营地庇护值数量的成员为安全者；其余存活成员记为失踪，在剧本日志的探险队部分划去名字。若所有存活成员都安全，则跳过第 II 部分。',
    '已揭示的地点会记录在剧本日志的亡命冰原部分，并在第 II、III 部分的设置中继承（已揭示面朝上，并按线索值放置线索）。营地与庇护值的变化按剧情指示记录。',
  ], [
    'Shelter is a printed value (0 to 9) on some locations, shown on the revealed side of Ice and Death locations; it represents how well the location protects against the cold. Locations and card text read shelter to set test difficulty, starting resources and checkpoint results.',
    'The camp\'s shelter value carries through the setup and checkpoints of Ice and Death: at the start of Part II each investigator\'s starting resources equal the camp\'s shelter value (instead of five), and the experience award for Part I uses the camp\'s shelter value (minimum of 3).',
    'During Checkpoint I, The Disappearance, find the story assets of every surviving expedition member, shuffle them, and randomly choose a number of them equal to the camp\'s shelter value as safe; the other survivors are marked MIA and their names are crossed off in the Campaign Log. If every survivor is safe, skip Part II.',
    'Revealed locations are recorded in the Ice and Death section of the Campaign Log and inherited during the setup of Parts II and III (revealed side faceup, with clues equal to their clue value). Changes to the camp and its shelter value are recorded as the story instructs.',
  ], ['eoteCampaign', 'eoteFrost', 'eoteSupplies'], 'bihuzhi'),
  rule('eoteLevel', '高度层级与攀登', 'Levels and climbing', [
    '高度', '高度层', '等级', 'Level', 'level', '攀登', 'climb', '失落之峰',
  ], [
    '失落之峰的山坡地点按高度排列：七处山坡地点洗混后取五处沿斜线排开，山顶放在斜线顶端；从最下方地点开始，位置依次给出 0 至 5 的高度（Level），山顶是高度 5。高度是地点位置决定的印刷信息，不是标记。',
    '地点与相邻层的地点相连；从较低层移动到较高层的地点时，会触发该地点的强制效果（例如弃牌、检定、受到伤害或恐惧、横置支援、混入忒咳哩-哩、失去探险支援）。从高处坠落或检定失败时，卡面会让你移动到正下方紧邻的地点；部分地点在被移动到后会让你归还所有线索。',
    '高度会被卡牌读取：失落之峰的 [skull] 符号取负值等于所在地点高度（困难与专家为高度加 2）；部分敌人与诡计按所在地点高度决定数值或效果；山顶的线索只能通过调查发现。离开失落之峰后高度不再适用。',
  ], [
    'The Mountainside locations of To the Forbidden Peaks are arranged by height: shuffle the seven Mountainside locations, put five in a diagonal line, and place The Summit at the top. Beginning with the bottommost location, each position gives a level from 0 to 5, with The Summit at level 5. Level is printed information determined by position, not a token.',
    'Locations connect to locations on adjacent levels. Moving to a higher-level location from below triggers that location\'s forced effect (for example discarding cards, testing, taking damage or horror, exhausting assets, shuffling in Tekeli-li, or losing an Expedition asset). Falling or failing certain tests moves you to the location directly below; some locations also make you return all your clues after you move to them.',
    'Level is read by cards: the {skull} symbol on To the Forbidden Peaks is negative equal to your location\'s level (2 plus the level on Hard and Expert); some enemies and treacheries set values or effects from the level of your location; clues on The Summit can only be discovered by investigating. Level no longer applies after leaving To the Forbidden Peaks.',
  ], ['eoteShelter', 'eoteExpedition'], 'gaoducengji'),
  rule('eoteMirage', '致命幻景与幻景地点', 'Fatal Mirage and mirage locations', [
    '致命幻景', '幻景', 'Fatal Mirage', 'Mirage', '记忆', 'Memories', '幻景地点',
  ], [
    '致命幻景是可选的记忆章节，最多进入三次。第一次进入时使用 I 号密谋与幕，第二次使用 II 号，第三次使用 III 号；上次留下的「发现的记忆」「驱除的记忆」会在重复进入时按记录还原。完成致命幻景后，按当前战役进度返回主线下一章。',
    '幻景关键词标记一类没有未揭示面的地点：它们以已揭示面入场，背面是故事卡。关键词给出的数字表示翻面所需的线索数，括号中的卡名表示可能因此出现的记忆。在幻景地点，调查员可以作为一个行动，共同花费指定数量的线索，把地点翻面并结算背面的故事卡。',
    '当带幻景关键词的地点入场时（包括设置期间），对关键词列出的每一张已经在场或在胜利区中的卡牌，按每张把该地点的线索值降低幻景数值。若关键词列出的卡全部已经在场或在胜利区，该地点「已清除幻景」，不能再翻面。',
    '已翻面的幻景地点不会再翻回；故事卡可能让你记录发现或驱除的记忆、翻开新的地点或遭遇卡。记录的记忆会影响后续进入致命幻景时的设置与可以获得的坚毅面。',
  ], [
    'Fatal Mirage is an optional scenario of memories, entered up to three times. The first visit uses agenda and act I, the second uses II and the third uses III; memories discovered or banished in earlier visits are restored from the Campaign Log when you return. After finishing Fatal Mirage, return to the next main-line scenario according to the campaign\'s progress.',
    'The mirage keyword marks locations with no unrevealed side: they enter play revealed side faceup, with story cards on their reverse sides. The number in the keyword is the number of clues required to flip the location, and the card titles in parentheses indicate memories that may appear. At a mirage location, investigators may spend the indicated number of clues as an action, as a group, to flip it over and resolve the story card on the other side.',
    'When a location with the mirage keyword enters play (including during setup), for each card indicated by its keyword that is already in play or in the victory display, reduce that location\'s clue value by the mirage value. A location is “cleared of mirages” if every card indicated by its keyword is already in play or in the victory display; a location cleared of mirages cannot be flipped over again.',
    'A flipped mirage location stays faceup. Its story card may record memories discovered or banished, or bring new locations and encounter cards into play. Recorded memories affect the setup of later Fatal Mirage visits and which Resolute assets can be earned.',
  ], ['eoteCampaign', 'eotePartners', 'eoteTekeli'], 'zhiminghuanjing'),
  rule('eoteSeals', '五枚封印的生命周期', 'The five seals', [
    '封印', '五枚封印', 'Seal', 'seals', '[seal_a]', '伊夸之门', '迷雾高塔',
  ], [
    '疯狂之心引入五枚封印标记（[seal_a] 至 [seal_e]），用来封住伊夸之门后面的疯狂。每枚封印有休眠面与激活面，激活面带有发光的符号高亮；剧本会指示何时把封印放入场，以及放入时是休眠还是激活。封印本身没有固有效果。',
    '调查员可以按剧本与卡面指示取得封印的控制权：把封印放在自己的调查员卡上。调查员被消除（撤退除外）时，其控制的所有封印从游戏中移除，永久失去。作为一个行动，调查员可以把封印交给同地点的另一名调查员，或从同地点的另一名调查员处取得封印。',
    '在疯狂之心第 I 部分，休眠封印会被强制效果放到古老设施地点上；清空地点线索后，可以作为一个行动共同花费线索取得控制，再次共同花费线索将其激活。激活的封印可以放到伊夸之门上；五枚封印全部放上伊夸之门时推进至结局 1。',
    '在疯狂之心第 II 部分，放在门上的激活封印会分配给调查员控制，休眠封印由原本带有它的调查员控制；激活的封印可以放到迷雾高塔上释放力量，使该塔在本场游戏剩余时间受到额外伤害，并让坍塌的高塔改变终局。',
  ], [
    'The Heart of Madness introduces five seal tokens ({sealA} through {sealE}) used to contain the madness behind The Gate of Y\'quaa. Each seal has a dormant side and an activated side, the activated side marked by a glowing symbol highlight; the scenario tells you when to put seals into play and whether they are dormant or activated. Seals have no inherent game effect.',
    'Investigators take control of seals as the scenario and cards instruct, placing them on their investigator card. If an investigator who controls one or more seals is eliminated (except by resigning), remove those seals from the game; they are lost forever. As an action, an investigator may give a seal to another investigator at the same location, or take control of a seal controlled by another investigator at the same location.',
    'In Part I of The Heart of Madness, dormant seals are placed on Ancient Facility locations by forced effects. Once a location has no clues, investigators may take control of its seal as an action by paying clues as a group, then activate it by paying clues as a group. Activated seals can be placed on The Gate of Y\'quaa; when all five seals have been placed there, advance to Resolution 1.',
    'In Part II, activated seals on the Gate are distributed to investigators, and dormant seals remain controlled by the investigators who had them. Activated seals may be placed on Mist-Pylons to unleash their power, making that pylon take 1 additional damage for the rest of the game and letting collapsed pylons change the final resolution.',
  ], ['eoteSealTokens', 'eoteCampaign'], 'fengyin'),
  rule('eoteSealTokens', '封印与高塔的混乱符号', 'Seal and Mist-Pylon chaos symbols', [
    '封印符号', '高塔符号', 'seal tokens', '[seal_a]', '迷雾高塔', '混乱符号',
  ], [
    '疯狂之心的剧本提示卡按四档难度给出骷髅、异教徒、石板与古神标记的效果。骷髅标记通常为 −1（困难与专家为 −2）；若所在地点有「古神」敌人，改为 −3 / −4。',
    '异教徒标记为 −1。若你所在地点有封印（包括休眠封印），或你所在地点是迷雾高塔，则把该标记视为 [frost] 标记结算：标准和困难面是「改为」视为寒霜（仍按寒霜 −1 与追加揭示处理），专家面则在保留其修正之外还视为寒霜。以当前难度的提示卡为准。',
    '石板标记为 −3（困难与专家仍是 −3）；若检定失败，抽取忒咳哩-哩牌堆顶 1 张。古神标记为 −4 / −5；若失败且低于难度至少 3 点，在当前密谋上放置 1 个毁灭标记，这可能推动密谋推进。',
  ], [
    'The Heart of Madness reference card gives the effects of the skull, cultist, tablet and elder thing tokens for all four difficulties. The skull token is usually −1 (−2 on Hard and Expert); if there is an Ancient One enemy at your location, it is instead −3 / −4.',
    'The cultist token is −1. If there is a seal at your location (including a dormant seal), or if your location is a Mist-Pylon, treat this token as a {frost} token: on the Easy/Standard and Hard/Expert faces it is treated as frost instead (using frost\'s −1 and additional reveal), while the Expert face adds frost treatment on top of its modifier. Follow the reference card for the current difficulty.',
    'The tablet token is −3 (also −3 on Hard and Expert); on a failed test, draw the top card of the Tekeli-li deck. The elder thing token is −4 / −5; if you fail by 3 or more, place 1 doom on the current agenda, which can advance it.',
  ], ['eoteSeals', 'eoteFrost'], 'fengyinbiaojifuhao'),
  rule('eoteKeys', '古城的数值钥匙', 'Value keys of the city', [
    '钥匙', '古城钥匙', '数值钥匙', 'keys', 'Key', '城市景观', 'City Landscape',
  ], [
    '古老者之城的设置指示玩家从收藏中（不是从混乱袋）取每种两枚的骷髅、异教徒、石板、古神、0、−1、−2、−3 标记，共 16 枚。将这些标记随机各放一枚在 16 处城市景观地点上，它们就是「钥匙」。钥匙永不放入混乱袋，也不按普通混乱标记结算。',
    '若某地点上的钥匙所在位置没有线索，调查员可以作为一个快速能力取得该钥匙的控制权；部分卡牌效果也允许其他方式取得。取得时把钥匙放在自己的调查员卡上。调查员被消除时，其控制的所有钥匙放回所在地点。作为一个行动，调查员可以把任意数量自己控制的钥匙交给同地点的另一名调查员。',
    '钥匙不会自动生效，只有卡面写明时才花费或使用：例如花费两枚「0」钥匙触发某地点效果、花费一枚 [skull] 钥匙提升检定值、把被花费的钥匙加入混乱袋（在本场游戏或战役剩余时间作为混乱标记）、或把钥匙放到敌人/地点上。钥匙的数值与符号以标记正面为准；多个效果同时引用钥匙时，按卡面顺序结算。',
  ], [
    'The setup of City of the Elder Things instructs players to take two copies each of the skull, cultist, tablet, elder thing, 0, −1, −2 and −3 tokens from the collection (not from the chaos bag), for 16 tokens total. Place one at random on each of the 16 City Landscape locations; these are “keys.” Keys are never placed in the chaos bag and are not resolved as normal chaos tokens.',
    'If a location with a key on it has no clues, an investigator may take control of that key as a fast ability; some card effects allow other ways to take keys. A taken key is placed on the investigator card. If an investigator who controls keys is eliminated, place those keys on their location. As an action, an investigator may give any number of their keys to another investigator at the same location.',
    'Keys have no automatic effect and are spent or used only when a card says so: for example, spend two “0” keys to trigger a location effect, spend a {skull} key to boost a test, add a spent key to the chaos bag as a chaos token for the rest of the game or campaign, or place a key on an enemy or location. Use the token face for its symbol or value, and resolve multiple key effects in the order the card lists them.',
  ], ['eoteCampaign', 'eoteSeals'], 'guchengyaoshi'),
  rule('eoteSupplies', '探险物资与已回收的补给品', 'Expedition supplies and Supplies Recovered', [
    '探险物资', '物资', '补给品', 'Supplies', 'Supplies Recovered', '已回收的补给品', '探险支援',
  ], [
    '本循环有 7 件探险物资剧情支援：绿皂石、木雪橇、炸药、瘴气水晶、矿物标本、小型收音机与备用零件。它们在亡命冰原中通过地点行动或剧情效果被发现，并记录在剧本日志的「已回收的补给品」部分；已记录的物资会跟随队伍进入后续章节。',
    '失落之峰设置时，检查「已回收的补给品」部分：把其中列出的每件探险物资剧情支援放到高度 0 的地点，其余探险物资从游戏中移除。这些物资由调查员控制，不占牌组张数，也不占槽位。',
    '探险物资可以在失落之峰的检定失败或卡面效果中失去控制：把该物资放到你所在地点，之后可以重新取得；部分卡牌还能把它放回胜利区或游戏中移除。探险物资上的「使用（N 补给）」属于卡牌使用次数，与剧本日志的记录不是同一种资源。',
    '收尾与结局会按已回收的补给品记录结算奖励或后续剧情；未回收的物资在后续章节无法使用。',
  ], [
    'This cycle has seven Expedition supply story assets: Green Soapstone, Wooden Sledge, Dynamite, Miasmic Crystal, Mineral Specimen, Small Radio and Spare Parts. They are found through location actions or story effects in Ice and Death and recorded in the “Supplies Recovered” section of the Campaign Log; recorded supplies travel with the team into later scenarios.',
    'During setup for To the Forbidden Peaks, check the “Supplies Recovered” section: put each Expedition story asset listed there into play at the level-0 location, and remove every other Expedition story asset from the game. These supplies are controlled by investigators and do not count toward deck size or slots.',
    'Expedition assets can be lost when tests fail or as a card instructs: place the asset at your location, where it can be recovered; some cards can also return it to the victory display or remove it from the game. “Uses (N supplies)” on an asset is a uses counter, not the same thing as the campaign record.',
    'Resolutions and the epilogue use the Supplies Recovered record for rewards and later story; supplies that were never recovered cannot be used in later scenarios.',
  ], ['eoteExpedition', 'eoteShelter'], 'tanxianwuzi'),
  rule('eoteExpedition', '探险特性', 'The Expedition trait', [
    '探险', '探险特性', 'Expedition', '[[Expedition]]', '探险支援',
  ], [
    '探险（Expedition）是印在 7 件补给剧情支援上的特性，不是独立的关键词能力：它本身不提供能力，只供卡牌效果引用。例如失去控制、放置到地点、从游戏中移除或加入胜利区的效果会写明作用在「探险」支援上。',
    '探险支援不是牌组卡牌，不属于任何调查员；它们由控制者随行携带，并在卡面或剧情效果下被夺取、掉落与回收。「探险队」遭遇组（伙伴与纪念逝者）与「探险」特性是两件不同的事。',
    '在失落之峰与后续章节中，探险支援的所在位置与是否被回收会改变装备、检定与结局；具体以卡面与剧本日志为准。',
  ], [
    'Expedition is a trait printed on the seven supply story assets, not a standalone keyword ability: it grants no ability of its own and only exists for card effects to reference. Effects that lose control, place at a location, remove from the game or add to the victory display call out Expedition assets by this trait.',
    'Expedition assets are not deck cards and belong to no investigator; they are carried by their controller and can be taken, dropped and recovered as cards and story effects instruct. The Expedition Team encounter set (partners and memorials) is different from the Expedition trait.',
    'In To the Forbidden Peaks and later scenarios, where Expedition assets are and whether they were recovered changes equipment, tests and resolutions; follow card text and the Campaign Log.',
  ], ['eoteSupplies', 'eoteLevel'], 'tanxiantexing'),
  rule('eoteTitanic', '巨大坡道（巨大）', 'Titanic Ramp', [
    '巨大坡道', '巨大', 'Titanic', 'Titanic Ramp', '疯狂之心第 II 部分',
  ], [
    '巨大坡道（Titanic Ramp）是疯狂之心第 II 部分终局的四座地点。它们被一条横向路线串起来：每座巨大坡道与它左侧和右侧的地点相连。',
    '离开巨大坡道需要额外付出代价：作为离开的额外费用，进行一次敏捷（4）检定；若失败，取消这次移动的效果。你所在地点或连接地点上的任意调查员可以花费 1 个线索，让你在这次检定中自动成功。坡道的背面重复了左右相连的规则。',
  ], [
    'Titanic Ramp is a set of four locations in the finale of Part II of The Heart of Madness. They form a horizontal route: each Titanic Ramp is connected to the locations to its left and right.',
    'Leaving a Titanic Ramp has an additional cost: as an additional cost to leave, test agility (4); if you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to make you automatically succeed at this test. The reverse side repeats the left-and-right connection rule.',
  ], ['hunter', 'massive'], 'taitanpodaol'),
  rule('eoteHazard', '危险（Hazard）特性', 'The Hazard trait', [
    '危险', '危险特性', 'Hazard', '[[Hazard]]', '南极环境',
  ], [
    '危险（Hazard）是遭遇卡的印刷特性，用于南极环境类的诡计；它不是关键词能力，本身没有规则效果，只供卡牌效果引用。',
    '例如不稳定冰盖允许在抽取[[危险]]诡计时弃掉它并取消其效果。没有写明作用在[[危险]]卡片上的效果不受该特性影响；危险诡计仍按各自卡面结算。',
  ], [
    'Hazard is a printed trait on encounter cards, used for Antarctic environment treacheries. It is not a keyword ability and has no rules effect of its own; it only exists for card effects to reference.',
    'For example, Precarious Ice Sheet lets you discard a Hazard treachery when you draw it and cancel its effects. Effects that do not mention Hazard cards are unaffected by the trait, and Hazard treacheries still resolve according to their own text.',
  ], ['eoteExpedition'], 'weixiantexing'),
  rule('eoteBroken', '演武的运功与破功双面', 'Broken and Unbroken disciplines', [
    'Broken', 'Unbroken', '破功', '运功', '演武双面', '[[Broken]]', '[[Unbroken]]',
  ], [
    '陈丽丽的每张演武都是双面永久支援：运功面与破功面各有独立的卡号、特性与能力。开局时牌组中的每张演武都以 运功面在场。',
    '翻面由卡面能力触发：运功面的行动能力通常在执行后翻到 破功面；破功面多数带一个轮末反应能力，若本轮满足卡面条件（例如本回合未受到伤害或恐惧、手中卡牌未达到数量、未进行技能检定、没有敌人同处一地等），就翻回 运功面。',
    '命运重担（08015）会强制把一张演武翻到 破功面，且该演武本轮不能翻回；陈丽丽的旧印效果可以在检定结束后把一张 Broken 演武翻回运功。翻面只改变使用哪一面，不改变演武在场、控制者或已受的伤害；每张演武配一张命运重担。',
  ], [
    'Each of Lily Chen\'s disciplines is a double-sided permanent asset: its Unbroken and Broken sides have separate card numbers, traits and abilities. At the start of the game, each discipline in the deck is in play, Unbroken side faceup.',
    'Card abilities flip a discipline. An Unbroken side usually flips to its Broken side after using its action ability, while most Broken sides have a reaction at the end of the round that flips back to Unbroken if the round met that card\'s condition (for example, no damage or horror taken, fewer than the stated cards in hand, no skill tests performed, or no enemies at your location).',
    'Burden of Destiny (08015) forces a discipline to its Broken side and prevents it from flipping back that round; Lily\'s elder sign effect can flip a Broken discipline back to Unbroken after a test. Flipping changes only which side is active; the asset stays in play, keeps its controller and keeps any damage on it. Each discipline is paired with one Burden of Destiny.',
  ], ['eoteDiscipline', 'eoteResolute'], 'yanwushuangmian'),
  rule('eoteEidolon', '幻灵（Eidolon）特性', 'The Eidolon trait', [
    '幻灵', '幻灵特性', 'Eidolon', '[[Eidolon]]', '幽灵',
  ], [
    '幻灵（Eidolon）是部分敌人与场景卡的印刷特性，代表与记忆、幻景或南极异象有关的幽灵般存在（如幻景中的幽灵敌人与冰原上的幻灵群）。它是特性而不是关键词能力，本身没有规则效果。',
    '卡牌效果会引用[[幻灵]]敌人：例如让每个幻灵敌人获得「胜利 0」、弃掉一个幻灵敌人、或按幻灵数量推进幕。未写明作用在[[幻灵]]上的效果不受该特性影响；幻灵敌人仍按自身的关键词与卡面行动。',
  ], [
    'Eidolon is a printed trait on some enemies and scenario cards, representing ghostly beings tied to memories, mirages or Antarctic phenomena (such as the spectral enemies of Fatal Mirage and the eidolon swarms in the ice). It is a trait, not a keyword ability, and has no rules effect of its own.',
    'Card effects reference Eidolon enemies: for example, giving each Eidolon enemy “Victory 0”, discarding an Eidolon enemy, or advancing an act based on Eidolon count. Effects that do not mention Eidolon are unaffected, and Eidolon enemies still act according to their own keywords and card text.',
  ], ['eoteMirage', 'eotePossessed'], 'huanling'),
  rule('eoteAncientOne', '古神（Ancient One）特性', 'The Ancient One trait', [
    '古神', '古神特性', 'Ancient One', '[[Ancient One]]', '无名疯狂',
  ], [
    '古神（Ancient One）是敌人卡上的印刷特性，疯狂之心中只有无名疯狂这一敌人带有该特性。它是特性而不是关键词能力，本身没有规则效果。',
    '疯狂之心的提示卡会读取它：若所在地点有[[古神]]敌人，骷髅标记的负值从 −1 变为 −3（困难与专家从 −2 变为 −4）。其他效果若写明作用于[[古神]]，按卡面结算；未写明时不受该特性影响。',
  ], [
    'Ancient One is a printed trait on enemy cards; in The Heart of Madness only The Nameless Madness has it. It is a trait, not a keyword ability, and has no rules effect of its own.',
    'The Heart of Madness reference card reads it: if there is an Ancient One enemy at your location, the skull token becomes −3 instead of −1 (and −4 instead of −2 on Hard and Expert). Other effects that mention Ancient One resolve as their text says; effects that do not mention it are unaffected.',
  ], ['eoteSeals', 'eoteCampaign'], 'gushen'),
  rule('eotePossessed', '附身（Possessed）特性', 'The Possessed trait', [
    '附身', '附身特性', 'Possessed', '[[Possessed]]', '迷失之夜',
  ], [
    '附身（Possessed）是人与敌人卡上的印刷特性，出现在亡命冰原第 II 部分中失踪的探险队成员（被附身敌人）以及相关剧情卡上。它是特性而不是关键词能力，本身没有规则效果。',
    '卡牌效果会引用[[附身]]：例如把诡计附属到附身敌人上并放置毁灭、取走附身敌人身上的毁灭、或按附身敌人结算剧情。附身敌人仍按自身的关键词与卡面行动；未写明作用在[[附身]]上的效果不受该特性影响。',
  ], [
    'Possessed is a printed trait on people and enemy cards, appearing on the possessed expedition members (and related story cards) in Part II of Ice and Death. It is a trait, not a keyword ability, and has no rules effect of its own.',
    'Card effects reference Possessed: for example, attaching a treachery to a Possessed enemy and placing doom, taking doom from a Possessed enemy, or resolving story based on Possessed enemies. Possessed enemies still act according to their own keywords and text; effects that do not mention Possessed are unaffected.',
  ], ['eoteMirage', 'eoteEidolon'], 'fushen'),
  rule('eoteObjective', '目标（Objective）文本', 'Objective text', [
    '目标', 'Objective', '幕目标', '推进幕', '目标 -',
  ], [
    '目标（Objective）是幕、密谋与其他剧本卡上的指示文本，写作「目标 – …」。它说明该卡在什么条件下推进，而不是一个需要发动的能力。',
    '当前幕的目标达成时（通常由调查员共同花费线索满足），幕推进：结算当前幕的背面。密谋的目标与毁灭阈值共同决定密谋何时推进。同一张卡上有多个目标时按卡面顺序检查；只检查当前在场的幕、密谋与剧情卡。',
    '目标文本可能引用调查员数量、线索、毁灭、已撤退或已获胜的调查员、场上卡牌数量等状态；没有满足条件时不能推进。未写明目标的卡不会自行推进。',
  ], [
    'Objective is instruction text on acts, agendas and other scenario cards, written “Objective – …”. It states the condition under which the card advances; it is not an ability that must be triggered.',
    'When the current act\'s objective is met (usually when investigators pay clues together), the act advances and its reverse side resolves. An agenda\'s objective and doom threshold together determine when it advances. If a card has multiple objectives, check them in the order printed, and only check acts, agendas and story cards currently in play.',
    'Objective text may reference the number of investigators, clues, doom, resigned or defeated investigators, or the number of cards in play; the card cannot advance while the condition is unmet. Cards without an objective do not advance on their own.',
  ], ['eoteResign', 'clues'], 'mubiao'),
  rule('eoteResign', '撤退', 'Resign', [
    '撤退', 'Resign', '退出场景', '撤退行动',
  ], [
    '撤退是卡牌或地点上给出的行动指示，写作「[action]：撤退」或「撤退」。执行撤退时，调查员退出当前剧本；撤退不是被击败，不会自动造成创伤，也不会让调查员死亡或发疯。',
    '撤退的调查员离开场景、不再行动，其伙伴离场但不算被击败；按剧情结算时，撤退的调查员通常计为「未被击败」并参与相应结局。是否能在本场景撤退、撤退后得到什么结果，以卡面与战役指南为准。',
  ], [
    'Resign is an action instruction on cards or locations, written “[action]: Resign” or “Resign”. When an investigator resigns, they leave the current scenario; resigning is not being defeated, so it does not automatically cause trauma or kill or drive the investigator insane.',
    'A resigned investigator leaves the scenario and stops acting; their partner leaves play but is not defeated. In the scenario resolution, resigned investigators usually count as “not defeated” and take part in the corresponding resolution. Whether you can resign in a scenario, and what it grants, follows the card and campaign guide.',
  ], ['eoteObjective', 'trauma'], 'chetui'),
  rule('eoteMulticlass', '多职阶构筑', 'Multiclass deckbuilding', [
    '多职阶', '职阶', '构筑', 'Multiclass', 'Deckbuilding Options', '副职阶',
  ], [
    '本循环的五位调查员采用多职阶构筑：每位调查员有一个 0 级主职阶与一个 1–5 级副职阶。以主线卡为主，副职阶提供高等级选项与少量 0 级卡。',
    '以丹妮拉为例：守卫者 0 级、求生者 1–5 级、中立 0–5 级，最多再带 5 张其他 0 级求生者卡。陈丽丽在此之上还禁止携带[[Firearm]]枪械。每位调查员的卡背写明具体的牌组规模、主/副职阶、中立卡范围与额外限制，按卡背执行。',
    '构筑时仍要遵守牌组规模（通常 30 张）、同名卡上限与经验规则；签名卡、调查员专属卡与随机基础弱点按调查员要求加入，不计入牌组规模。升级选项同样受主副职阶与等级限制。',
  ], [
    'The five investigators of this cycle use multiclass deckbuilding: each has a level-0 primary class and a level-1–5 secondary class. Cards of the primary class form the main pool, while the secondary class supplies high-level options and a few level-0 cards.',
    'For example, Daniela Reyes uses Guardian level 0, Survivor levels 1–5, Neutral levels 0–5, and up to five other level-0 Survivor cards. Lily Chen additionally cannot include {Firearm} assets. Each investigator card states the exact deck size, primary and secondary classes, neutral range and extra restrictions; follow the card back.',
    'Deckbuilding still follows deck size (usually 30), the two-copy limit per title and experience rules. Signature cards, investigator-specific cards and one random basic weakness are added as the investigator card requires and do not count toward deck size. Upgrade choices are also limited by the primary and secondary class ranges and levels.',
  ], ['deck', 'eoteDiscipline'], 'duozhijiegouzhu'),
  rule('eoteDiscipline', '演武与命运重担', 'Disciplines and Burden of Destiny', [
    '演武', 'Discipline', '命运重担', 'Burden of Destiny', '陈丽丽', 'Lily Chen',
  ], [
    '演武是陈丽丽的双面永久支援。构筑时从四种演武中选择 1 张加入牌组；它属于构筑要求，不计入牌组张数。此后每累计获得 15 点经验，可以再选择并加入 1 张不同的演武加入牌组。',
    '牌组中的每张演武都配 1 张命运重担（08015）弱点，同样不计入牌组张数。命运重担被抽到时，必须选择：把一张自己控制的演武翻到 破功面（本轮不能翻回），或受到 1 点伤害和 1 点恐惧。',
    '开局时牌组中的每张演武都以 运功面在场。运功面提供 +1 对应技能与一个会翻面的行动能力；破功面通常带轮末条件翻回的反应能力。翻面、旧印与命运重担的交互见「演武的运功与破功双面」。',
  ], [
    'Disciplines are Lily Chen\'s double-sided permanent assets. Choose one of four disciplines for the deck at deck creation; it is part of the deckbuilding requirements and does not count toward deck size. Each time you have earned 15 experience in total, you may choose and add another different discipline to the deck.',
    'Each discipline in the deck is paired with one Burden of Destiny (08015) weakness, which also does not count toward deck size. When Burden of Destiny is drawn, choose: flip a discipline you control to its Broken side (it cannot flip back this round), or take 1 damage and 1 horror.',
    'At the start of the game each discipline in the deck is in play, Unbroken side faceup. The Unbroken side gives +1 to the matching skill and an action ability that flips it; the Broken side usually has a reaction that flips it back at the end of the round if a condition is met. See “Broken and Unbroken disciplines” for flips, elder sign and Burden of Destiny interactions.',
  ], ['eoteMulticlass', 'eoteBroken'], 'yanwu'),
]

export const EOTE_RULE_IDS = Object.freeze(EOTE_RULES.map(rule => rule.id))

// 卡文直达判据：card 的 name + text + backText 命中即连到对应规则条目。
// 依据 P1 关键词清单（含 3 张只有卡名命中的卡：08549 Fatal Mirage、08663 The Great Seal、08671 The Seal Weakens）。
export const EOTE_CARD_RULE_PATTERNS = Object.freeze([
  ['eoteFrost', /\[frost\]/i],
  ['eotePartners', /\bPartner\b/i],
  ['eoteResolute', /\bResolute\b/i],
  ['eoteTekeli', /Tekeli-li|Tekelili|Tekeli-Li/i],
  ['eoteShelter', /\bShelter\b/i],
  ['eoteLevel', /\bLevel\b/i],
  ['eoteMirage', /Fatal Mirage|\bMirage\b/i],
  ['eoteSeals', /\bSeal(?:ed)?\b|\[seal_[a-e]\]/i],
  ['eoteSealTokens', /\[seal_[a-e]\]/i],
  ['eoteKeys', /\bkeys?\b/i],
  ['eoteSupplies', /\bSupplies?\b/i],
  ['eoteSupplies', /^(?:Green Soapstone|Wooden Sledge|Dynamite|Miasmic Crystal|Mineral Specimen|Small Radio|Spare Parts)\b/im],
  ['eoteExpedition', /\bExpedition\b/i],
  ['eoteTitanic', /\bTitanic\b/i],
  ['eoteHazard', /\bHazard\b/i],
  ['eoteBroken', /\bBroken\b/i],
  ['eoteBroken', /\bUnbroken\b/i],
  ['eoteDiscipline', /\bBroken\b/i],
  ['eoteDiscipline', /\bUnbroken\b/i],
  ['eoteDiscipline', /Deckbuilding Options/i],
  ['eoteEidolon', /\bEidolon\b/i],
  ['eoteAncientOne', /Ancient One/i],
  ['eotePossessed', /\bPossessed\b/i],
  ['eoteObjective', /\bObjective\b/i],
  ['eoteResign', /\bResign\b/i],
  ['eoteMulticlass', /Deckbuilding Options/i],
  // 既有通用关键词继续连到基础规则条目（与 TIC/TDE 的卡文直达同一口径）。
  ['hunter', /\bHunter\b/i],
  ['aloof', /\bAloof\b/i],
  ['massive', /\bMassive\b/i],
  ['retaliate', /\bRetaliate\b/i],
  ['alert', /\bAlert\b/i],
  ['surge', /\bSurge\b/i],
  ['peril', /\bPeril\b/i],
  ['hidden', /\bHidden\b/i],
  ['victory', /\bVictory\b/i],
  ['prey', /\bPrey\b/i],
  ['spawn', /\bSpawn\b/i],
  ['parley', /\bParley\b|谈判/i],
  ['fast', /\bFast\b/i],
  ['permanent', /\bPermanent\b/i],
  ['upgrade', /\bExceptional\b/i],
  ['elite', /\bElite\b/i],
  ['revelation', /\bRevelation\b/i],
])

export function eoteCardRuleIds(card) {
  const text = [card?.name, card?.text, card?.backText].filter(Boolean).join('\n')
  const ids = ['eoteCampaign']
  for (const [id, pattern] of EOTE_CARD_RULE_PATTERNS) if (pattern.test(text)) ids.push(id)
  return [...new Set(ids)]
}

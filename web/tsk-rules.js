// 八循环《绯红密钥》玩家向规则条目与卡文直达。
// 依据：P0 范围账本（audit/tsk-scope.json）、P1 机制/指南扫描（audit/tsk-mechanism-scan.json）、
// P2 通用原语（docs/campaign/theScarletKeys/primitives.md）与官方规则书整理；只写规则本身，
// 不写实现、源码或验证状态。本文件是纯数据浏览器模块（不 import 任何模块），
// 由 web/rulebook-data.js 汇总进 RULES。
const rule = (id, title, titleEn, aliases, body, bodyEn, related, sortKey) => ({
  id,
  title,
  titleEn,
  group: '绯红密钥',
  groupEn: 'The Scarlet Keys',
  aliases: [title, titleEn, ...aliases],
  body,
  bodyEn,
  related,
  sortKey,
})

export const TSK_RULES = [
  rule('tskCampaign', '《绯红密钥》战役概览', 'The Scarlet Keys: campaign overview', [
    '绯红密钥', '八循环', 'The Scarlet Keys', 'TSK', '战役', 'campaign', '十章', '世界地图', '密档',
  ], [
    '《绯红密钥》是由序章与十章组成的战役：谜雨、死亡酷暑、血色阴影、暗中交易、疯星乱舞、如履薄冰、战争疮痍、苦痛之影、不留痕迹、钥匙议会。章节之间穿插幕间与海外幕间，终章之后按实际到达的结局结算尾声。',
    '战役不再是线性的章节列表：调查员在「世界地图」上选择下一个目的地并启程，旅行会消耗时间。时间累计推动状况报告，并决定队伍能否在最后期限前赶到通古斯卡。绿地地点通往独立的支线冒险，由队伍自行决定是否前往。',
    '战役地图上每个地点对应一份「地图密档」（File #5-A 至 File #59-Z 等）。队伍抵达、时间推进或剧情指示都会解锁密档；密档给出该地点的调查背景、支线或后续提示，只有已解锁的密档才能阅读。',
    '调查员在章节之间保留经验、创伤、故事资产与弱点；密钥、同志会成员、已抹除的卡牌与已解锁密档由战役记录跨章保存。只有实际到达的分支与结算会被记入战役日志。',
  ], [
    'The Scarlet Keys is a campaign of a prologue and ten scenarios: Riddles and Rain, Dead Heat, Sanguine Shadows, Dealings in the Dark, Dancing Mad, On Thin Ice, Dogs of War, Shades of Suffering, Without a Trace and Congress of the Keys. Interludes and side-story interludes fall between scenarios, and the epilogue is resolved from the branches actually reached.',
    'The campaign is not a linear scenario list: investigators travel the world map, choosing their next destination; travelling costs time. Accumulated time triggers status reports and decides whether the team reaches Tunguska before the deadline. Green locations lead to optional side-story scenarios that the team may visit or skip.',
    'Every map location has a dossier (File #5-A through File #59-Z). Arriving, the passage of time and story instructions unlock dossiers; a dossier gives the location\'s investigation background, side story or follow-up. Only unlocked dossiers can be read.',
    'Between scenarios investigators keep experience, trauma, story assets and weaknesses; keys, Coterie members, erased cards and unlocked dossiers persist in the campaign log. Only branches and resolutions actually reached are recorded.',
  ], ['tskMap', 'tskStatusReports', 'tskDossiers', 'tskChaos'], 'feihongmiyaozhanyigailan'),

  rule('tskChaos', '混乱袋与标记', 'Chaos bag and tokens', [
    '混乱袋', '混乱标记', '混沌袋', '混沌标记', 'chaos bag', 'chaos token', '骷髅', '石板', '旧神', '古神', '旧印',
  ], [
    '本循环使用基础混乱袋。简单与标准各有 16 枚标记，困难 17 枚、专家 18 枚；符号标记包括 2 枚骷髅、1 枚石板、1 枚旧神、1 枚自动失败与 1 枚旧印，其余为数字标记。',
    '每个章节按当前难度在提示卡上列出骷髅、石板与旧神的取值与效果；同一符号在不同章节的效果可能完全不同，以本关提示卡为准。数字标记只修正本次检定，旧印触发调查员卡上的旧印能力，自动失败使检定立即失败。',
    '战役记录可以永久改变混乱袋：某些结局会把额外标记加入袋中，卡牌与剧情也可以暂时加入、移除或封印标记。混乱袋的内容记入战役日志的混乱袋栏，跨章保留。',
    '符号标记的修正按提示卡取值；若提示卡依据场上状态（毁灭、线索、敌人、地点、时间或密钥持有者）取值，按结算时的情况计算。已揭示的标记在检定结束后放回袋中。',
  ], [
    'The campaign uses the base chaos bag. Easy and Standard have 16 tokens each, Hard 17 and Expert 18. The symbol tokens are two skulls, one tablet, one elder thing, one auto-fail and one elder sign; the rest are number tokens.',
    'Each scenario\'s prompt card lists the effects and modifiers of the skull, tablet and elder thing for the current difficulty; the same symbol can mean different things from scenario to scenario, so always use the current prompt card. Number tokens only modify the current test, the elder sign triggers the investigator\'s elder sign ability, and the auto-fail token fails the test immediately.',
    'The campaign log can permanently change the bag: some resolutions add extra tokens, and card or story effects can temporarily add, remove or seal tokens. Record the bag in the Chaos Bag section of the campaign log; it persists between scenarios.',
    'A symbol\'s modifier follows its prompt card. If the prompt depends on the board state (doom, clues, enemies, locations, time or key holders), use the state at the moment of resolution. Revealed tokens return to the bag after the test.',
  ], ['tskCampaign', 'tskStatusReports'], 'hunluandaiyubiaoji'),

  rule('tskMap', '世界地图与时间标记', 'World map and time', [
    '世界地图', '地图', '启程', '前往', '时间', '时间标记', '旅行', 'Embark', 'world map', 'time', 'travel', '快捷旅票',
  ], [
    '战役进行中，队伍始终位于世界地图上的一个地点。世界地图由 36 个地点节点组成，节点之间以航路相连；已解锁的地点才能作为目的地。',
    '启程前往新目的地时，按航路计算旅行时间：每进入一个普通地点花费 1 时间，进入绿地地点花费 0 时间；若目的地本身是绿地地点，还要额外花费 1 时间先结算那里的支线冒险。时间只会增加，不会减少。',
    '「快捷旅票」可以代替正常旅行：使用后以 1 时间直达任意地点，无需事先解锁，然后把该票放逐。每场战役能使用的旅票数量有限。',
    '时间累计到 35 时，队伍必须在下次启程前往通古斯卡；其它目的地暂时不能选择。时间同时推动状况报告（见状况报告条目），并在抵达关键节点时解锁新的密档或章节。',
  ], [
    'During the campaign the team is always at one location on the world map. The map has 36 location nodes joined by routes; only unlocked locations can be chosen as destinations.',
    'When embarking for a new destination, travel time is measured along the route: entering a standard location costs 1 time, entering a green location costs 0; if the destination itself is a green location, an additional 1 time is spent to resolve the side story there first. Time only increases, never decreases.',
    'An Expedited Ticket replaces normal travel: spend it to reach any location at a cost of 1 time, even if the location is not unlocked, then exile the ticket. Only a limited number of tickets exist in the campaign.',
    'When time reaches 35, the team must embark for Tunguska at the next opportunity; other destinations cannot be chosen for the time being. Time also advances status reports (see the status reports entry) and unlocks new dossiers or chapters at key milestones.',
  ], ['tskCampaign', 'tskStatusReports', 'tskDossiers', 'tskOtherworld'], 'shijieditiyushijianbiaoji'),

  rule('tskStatusReports', '状况报告（α–ω）', 'Status reports', [
    '状况报告', '状况', '报告', 'α', 'β', 'γ', 'ε', 'ζ', 'θ', 'ψ', 'ω', 'status report',
  ], [
    '时间累计会触发状况报告。固定报告在时间 7（α）、10（ε）、15（β）、20（ζ）、24（γ）与 35（ω）触发；另有 θ 与 ψ 两份动态报告，由剧情在指定时间点写入。',
    '时间达到某个报告的阈值时，把该报告加入待处理队列。一次达到多个阈值时，按阈值从低到高依次结算；同一报告只结算一次。',
    '每份报告的效果由战役书指示，可能包括：从恩怨未了池抽取同志会敌人加入遭遇牌库、解锁或锁定地图节点、把密钥交给敌人、在混乱袋中加入标记、调整时间或解锁密档。效果结算后该报告记为已触发。',
    '报告不会因为时间减少而撤销；若剧情提前触发某份报告，按剧情指定的时间处理，不会在阈值再次触发。',
  ], [
    'Accumulated time triggers status reports. Fixed reports trigger at time 7 (alpha), 10 (epsilon), 15 (beta), 20 (zeta), 24 (gamma) and 35 (omega); two additional reports, theta and psi, are placed at times specified by the story.',
    'When time reaches a report\'s threshold, that report enters the queue. If several thresholds are passed at once, resolve them from the lowest threshold upward; each report is resolved only once.',
    'Each report\'s effects are given by the campaign guide: pulling a Coterie enemy from the unresolved pool into the encounter deck, unlocking or closing map locations, handing a key to an enemy, adding a token to the chaos bag, adjusting time, or unlocking a dossier. After resolution the report is marked as triggered.',
    'Reports are never cancelled if time decreases; if the story triggers a report early, use the time named by the story and do not trigger it again at its threshold.',
  ], ['tskMap', 'tskCoterie', 'tskKeys', 'tskChaos'], 'zhuangkuangbaogao'),

  rule('tskConcealed', '阴影与隐匿迷你卡（Concealed X）', 'In the Shadows and concealed mini-cards', [
    '隐匿', '阴影', '阴影区', '隐匿迷你卡', '迷你卡', '揭露', 'Concealed', 'In the Shadows', 'Expose', 'mini-card',
  ], [
    '「阴影」是地点的一种状态。地点进入阴影时，按卡面「隐匿 X」在它旁边放置 X 张调查员人数的隐匿迷你卡：其中一部分是真实敌人，其余是诱饵。迷你卡正面朝下、身份隐藏，且不算在场敌人。',
    '进入阴影的地点带有「左／中／右」三个阴影位置。迷你卡按这些位置摆放；与阴影位置相关的移动、攻防与结算都以位置为准，而不是以某个在场敌人的位置为准。',
    '揭露（Expose）只能在你所在地点进行。把该地点的一张迷你卡翻面：若是诱饵，弃掉它；若是敌人，把它按生成指示放入游戏并结算。未揭露的迷你卡不向任何玩家展示真身或诱饵身份。',
    '对位于阴影位置的敌人进行攻击或躲避时，可以把它视为与所在地点或相邻地点同处；位于地点本身（不在阴影位置）的迷你卡必须同地点才能被攻击或躲避。轮末把未揭露的迷你卡在原有地点之间重新洗混位置，不增删卡牌。',
  ], [
    'In the Shadows is a state of a location. When a location enters the shadows, place X concealed mini-cards per investigator beside it, as the Concealed X value specifies: some are the real enemies, the rest are decoys. Mini-cards are face down, their identity is hidden, and they are not enemies in play.',
    'A location in the shadows has three shadow positions: left, middle and right. Mini-cards are placed in those positions; movement, attacks and resolution involving shadow positions refer to the position, not to an enemy in play.',
    'You may expose a mini-card only at your location. Flip one mini-card there faceup: if it is a decoy, discard it; if it is an enemy, put it into play following its spawn instruction. Unexposed mini-cards never reveal whether they are the real enemy or a decoy.',
    'When attacking or evading an enemy in a shadow position, you may treat it as being at the location or at an adjacent location; a mini-card in the location itself (not in a shadow position) must be at the same location to be attacked or evaded. At the end of the round, shuffle the remaining mini-cards among their current locations without adding or removing cards.',
  ], ['tskCampaign', 'tskHollow', 'tskKeys'], 'yinyingyuyinniminkia'),

  rule('tskHollow', '空洞与存在抹除', 'Hollow and erased from existence', [
    '空洞', '空洞区', '空洞卡', '抹除', '存在抹除', 'hollow', 'erased', 'erased from existence',
  ], [
    '「空洞」是场外区域。卡牌因效果被移出游戏时，可以成为空洞卡放在一边，而不是进入弃牌堆；空洞卡不再属于任何牌堆或在场区域。',
    '空洞计数按卡面口径分为两种：写「你」的取个人空洞数（该调查员名下的空洞卡），写「你的队伍」的取全队空洞数；全队空洞对个人计数同样有效。',
    '效果可以把一张或多张空洞卡回收：按卡面把它们洗回牌库、放回手牌或放进弃牌堆；回收后不再计入空洞数。',
    '「存在抹除」发生在战役终局或特定结局：把空洞卡永久移出战役，并记入战役日志的抹除名单。被抹除的卡牌在后续构筑与换牌时不可使用；抹除不可撤销。',
  ], [
    'Hollow is an out-of-play zone. When a card is removed from the game by an effect, it may become a hollow card set aside there instead of going to a discard pile; a hollow card no longer belongs to any deck or in-play zone.',
    'Hollow counts follow the card text: an effect about "you" counts the individual investigator\'s hollow cards, while an effect about "your team" counts the whole team\'s; a team hollow also counts for the individual.',
    'Effects can recall one or more hollow cards as the card directs, shuffling them into a deck, returning them to hand or putting them into a discard pile; a recalled card no longer counts as hollow.',
    'Erased from existence happens at the campaign finale or at specific resolutions: hollow cards are permanently removed from the campaign and recorded in the campaign log\'s erased list. Erased cards cannot be used in later deckbuilding or upgrades, and erasure cannot be undone.',
  ], ['tskConcealed', 'tskCampaign', 'tskKeys'], 'kongdongyucunzaimochu'),

  rule('tskKeys', '绯红密钥', 'The Scarlet Keys', [
    '绯红密钥', '密钥', '钥匙', '痛苦之钥', 'Scarlet Keys', 'key', 'stable', 'unstable', '稳定面', '动荡面',
  ], [
    '绯红密钥是四张双面卡：每张都有稳定面与动荡面。密钥不属于任何玩家牌组，也不是普通资产；它由调查员、敌人或无人持有，持有关系记在战役日志中。',
    '持有密钥的敌人会在其卡面能力允许时使用密钥；调查员持有密钥时按密钥当前面的能力行动。密钥跨章节保留，不会在章节之间重置。',
    '敌人夺取密钥时，把它翻到动荡面并交给该敌人；调查员重新夺回或拿回密钥时，把它翻回稳定面。夺取不会改变密钥的其它状态。',
    '密钥的持有者与当前面属于公开信息：全桌都知道哪张密钥在谁手里、朝哪一面。密钥离场或持有者被击败时，按该章节的指示放置密钥。',
  ], [
    'The Scarlet Keys are four double-sided cards, each with a stable face and an unstable face. A key is not a player card or an ordinary asset; it is held by an investigator, by an enemy, or by no one, and the ownership is tracked in the campaign log.',
    'An enemy holding a key uses it as its card text allows; an investigator holding a key acts with the key\'s current face. Keys persist between scenarios and do not reset.',
    'When an enemy steals a key, turn it to its unstable face and give it to that enemy; when an investigator takes or reclaims it, turn it back to its stable face. Stealing changes nothing else about the key.',
    'Who holds each key and which face is up is public information: everyone knows where each key is and which side is showing. If a key leaves play or its holder is defeated, place the key as the scenario instructs.',
  ], ['tskShift', 'tskCampaign', 'tskStatusReports'], 'feihongmiyao'),

  rule('tskShift', '变换（Shift）', 'Shift', [
    '变换', 'Shift', '翻面', '密钥翻面', 'Flip this key',
  ], [
    '变换是密钥的翻面结算。按卡面指定时机，先结算密钥当前面的效果，再把该密钥翻到另一面（稳定面与动荡面互换）。',
    '每把密钥每轮只能变换一次。剧情或章节效果的强制变换不受此限制，但仍记入该轮的变换次数。',
    '变换只改变密钥当前朝向，不改变持有者。没有持有者的密钥仍可以被变换，由触发效果决定结算。',
    '变换后的面效果可能改变检定、移动、夺取或时间；结算顺序为：当前面效果 → 翻面 → 新面持续生效。',
  ], [
    'Shift is a key\'s flip resolution. At the timing the card specifies, resolve the effect of the key\'s current face, then flip it to the other face (stable and unstable trade places).',
    'Each key can shift only once per round. Forced shifts from story or scenario effects ignore this limit but still count toward the round\'s shifts.',
    'Shifting changes only which face is up, not who holds the key. A key held by no one can still shift, as the triggering effect decides.',
    'The new face\'s effect may change tests, movement, theft or time. Resolve in this order: current face effect, then flip, then the new face applies continuously.',
  ], ['tskKeys', 'tskCampaign'], 'bianhuan'),

  rule('tskCustomizable', '定制升级卡（Customizable）', 'Customizable cards', [
    '定制', '定制升级', '定制卡', '勾选', '升级格', 'Customizable', 'upgrade', 'checkbox',
  ], [
    '定制升级卡是等级 0 的基础卡。卡面印有多组「定制选项」，每组有若干勾选格；升级时逐格勾选，已勾选的选项立即生效。',
    '每个勾选格花费 1 点经验；「卓越」定制卡每格花费 2 点经验。一张定制卡的等级等于已勾选总格数的一半（向上取整），用于构筑限制。',
    '升级只能增加勾选，不能撤销已勾选的格；同一选项的勾选格按卡面顺序逐格解锁。已勾选的选项在后续章节中持续生效。',
    '定制卡在牌组中始终占用 1 张牌位；升级不改变牌组张数。经验不足时不能勾选，也不能用其它卡的经验代替。',
  ], [
    'A customizable card is a level-0 base card. Its text lists several customization options, each with a number of checkboxes; when upgrading, check boxes one at a time and each checked option applies immediately.',
    'Each checked box costs 1 experience; each box on an exceptional customizable card costs 2 experience. A customizable card\'s level equals half its total checked boxes, rounded up, for deckbuilding limits.',
    'Upgrades only add checks; a checked box cannot be unchecked, and boxes of an option unlock in the order printed. Checked options keep applying in later scenarios.',
    'A customizable card always occupies one deck slot; upgrading does not change deck size. You cannot check a box without enough experience, and experience from other cards cannot substitute.',
  ], ['tskCampaign', 'upgrade', 'deck'], 'dingzhishengjika'),

  rule('tskCoterie', '红色同志会', 'The Red Coterie', [
    '红色同志会', '同志会', '恩怨未了', 'Coterie', 'Red Coterie', 'coterie',
  ], [
    '红色同志会是本战役的敌对组织。它的成员分成三个池：恩怨未了、盟友与已击败；池中内容由战役记录保存。',
    '特定状况报告与剧情效果会从「恩怨未了」池抽取同志会成员，加入遭遇牌库或放在一边。被抽出的成员不再是普通遭遇，而是该章节的指定敌人。',
    '成为盟友的同志会成员会提供帮助（按剧情与卡面）；被击败的成员进入「已击败」池，并可能改变后续章节与结局。',
    '同一名成员只能存在于一个池中；池间转移按剧情指示进行。战败或撤退不会自动改变池的状态，只有剧情结算才会。',
  ], [
    'The Red Coterie is the campaign\'s hostile organization. Its members belong to three pools: unresolved, ally and defeated; the pools are tracked in the campaign log.',
    'Specific status reports and story effects pull Coterie members from the unresolved pool, adding them to the encounter deck or setting them aside. A pulled member is no longer an ordinary encounter but a named enemy for that scenario.',
    'Coterie members who become allies provide help as the story and card text direct; defeated members go to the defeated pool and may change later scenarios and the ending.',
    'A member can be in only one pool at a time; moves between pools follow the story\'s instructions. Being defeated or resigning does not change a pool automatically; only a story resolution does.',
  ], ['tskStatusReports', 'tskCampaign', 'tskPatrol'], 'hongsetongzhihui'),

  rule('tskPatrol', '巡逻（Patrol）', 'Patrol', [
    '巡逻', 'Patrol', '巡逻目标',
  ], [
    '巡逻是敌人的关键词。敌人阶段，已重整、未交战且不在其巡逻目标地点的巡逻敌人，沿最短合法路径向巡逻目标移动 1 个地点。',
    '巡逻目标由卡面指定：可能是某个命名地点，也可能是某类地点（例如带有荒野特质的地点）。巡逻目标不影响敌人生成，也不让它追赶调查员。',
    '已横置的巡逻敌人不移动；被效果阻挡而无法移动时不移动。移动到调查员所在地点后按普通交战规则结算。',
    '同一敌人阶段先结算猎手移动，再结算巡逻移动；两类移动都由章节的敌人阶段顺序决定。',
  ], [
    'Patrol is an enemy keyword. During the enemy phase, a ready, unengaged enemy with patrol that is not at its patrol target moves one location along the shortest legal path toward that target.',
    'The patrol target is given by the card: a named location or a type of location (for example locations with the Wilderness trait). The patrol target does not affect spawning and does not make the enemy chase investigators.',
    'An exhausted patrol enemy does not move, and neither does one blocked by an effect. After moving to an investigator\'s location it follows normal engagement rules.',
    'In the enemy phase, hunter movement resolves before patrol movement; the scenario\'s enemy-phase order governs both.',
  ], ['hunter', 'tskCoterie', 'tskCampaign'], 'xunluo'),

  rule('tskOtherworld', '异界（Otherworld）', 'Otherworld', [
    '异界', '异界地点', 'Otherworld', 'otherworld deck', '异界牌库',
  ], [
    '带有「异界」特质的地点属于另一个世界。进入异界地点、离开异界地点或章节指示时，按卡面把对应的异界牌库洗入、抽取或移出卡牌。',
    '异界牌库的顺序对全桌隐藏：牌库张数是公开信息，具体牌序不公开；查看顶牌的效果只向合法获知的调查员展示。',
    '异界地点上的敌人与调查员照常结算移动、交战与伤害；异界特质本身不改变这些规则，只限制与异界牌库相关的效果。',
    '异界牌库用尽时，按章节指示把弃牌堆洗回形成新的牌库；被移出的卡牌不再回到牌库。',
  ], [
    'Locations with the Otherworld trait belong to another world. When investigators enter or leave an Otherworld location, or when the scenario instructs, shuffle, draw or remove cards from the matching otherworld deck as the card directs.',
    'The order of an otherworld deck is hidden: its size is public information but its order is not, and effects that look at the top card reveal it only to investigators entitled to see it.',
    'Enemies and investigators at an Otherworld location move, engage and take damage normally; the trait itself changes none of those rules and only restricts effects tied to otherworld decks.',
    'If an otherworld deck runs out, shuffle its discard pile into a new deck as the scenario instructs; cards removed from the deck do not return.',
  ], ['tskMap', 'hidden', 'tskDossiers'], 'yijie'),

  rule('tskDossiers', '地图密档', 'Map dossiers', [
    '地图密档', '密档', '档案', 'File #', 'dossier', 'map dossier',
  ], [
    '地图密档是附在世界地图各地点上的战役档案，编号形如 File #5-A、File #21-F。它们记录该地点的背景、支线冒险与可能的结果。',
    '队伍抵达地点、时间推进到指定数值或剧情指示时解锁密档；未解锁的密档内容不对玩家展示。',
    '阅读密档通常发生在启程前或结算后：读完再决定是否前往该地点的支线冒险。密档的解锁状态跨章保存，不会重复解锁。',
    '部分密档与幕间、状况报告或结局直接相关；只有实际解锁并阅读的密档才会把内容记入战役日志。',
  ], [
    'Map dossiers are campaign files attached to world-map locations, numbered File #5-A, File #21-F and so on. They record the location\'s background, side stories and possible resolutions.',
    'Arriving at a location, reaching a specified time or following a story instruction unlocks a dossier; the contents of a locked dossier are not shown to the players.',
    'Reading a dossier happens before embarking or after a resolution: read it, then decide whether to visit the side story there. Unlock states persist between scenarios and do not unlock twice.',
    'Some dossiers tie directly into interludes, status reports or the ending; only dossiers actually unlocked and read record their contents in the campaign log.',
  ], ['tskMap', 'tskCampaign', 'tskOtherworld'], 'ditimidan'),

  rule('tskInvestigator', '调查员特殊行动与标记', 'Investigator special actions and markers', [
    '调查员行动', '跨座位行动', '即时行动', '证据', '毁灭减费', '治疗触发', '躲避弃置',
    'cross-seat', 'evidence', 'doom discount', 'heal trigger', 'evade discard',
  ], [
    '本循环的调查员能力围绕几种通用接口：跨座位即时行动、证据标记、毁灭减费、治疗触发与躲避后的弃置判定。',
    '跨座位即时行动：让同地点的一名队友立即执行一次行动。该行动在授权效果结算后执行；每轮每名调查员最多获得一次这样的授权。',
    '证据：证据标记放在地点、敌人或其它卡牌上；花费证据可以降低本次检定的难度，每次检定同一调查员最多花费一次。证据总数是规则读数，可以被卡牌读取。',
    '毁灭减费：每轮一次，打出卡牌时减少费用，同时在当前议程放置 1 点毁灭。治疗触发：伤害被治愈后进入「伤害被治愈后」时机，满足条件的反应能力可以结算。躲避弃置：躲避一名已横置的非精英敌人后，可以按卡面把它直接弃置。',
  ], [
    'The campaign\'s investigator abilities build on a few generic interfaces: cross-seat immediate actions, evidence markers, doom discounts, heal triggers and discard-after-evade.',
    'Cross-seat immediate action: another investigator at the same location immediately performs one action. That action resolves after the granting effect; each investigator can be granted at most one such action per round.',
    'Evidence: evidence markers are placed on locations, enemies or other cards; spending evidence reduces the difficulty of the current test, at most once per investigator per test. The total evidence is a rules reading other cards can reference.',
    'Doom discount: once per round, reduce the cost of a card you play and place 1 doom on the current agenda. Heal trigger: after damage is healed from an investigator, the "after damage is healed" timing opens for reactions. Evade discard: after evading an exhausted non-elite enemy, you may discard it as the card directs.',
  ], ['tskCampaign', 'tskCustomizable', 'damage'], 'diaochayuanteshuxingdongyubiaoji'),

  rule('tskObjective', '目标（Objective）', 'Objective', [
    '目标', '目标 –', 'Objective', '幕目标',
  ], [
    '「目标 –」印在幕或议程上，表示推进（或结算）该卡所需的额外条件。调查员除支付线索或触发毁灭外，还必须满足目标。',
    '目标未满足时，即使线索或毁灭达到要求也不能推进；达到要求但没有完成目标的状态会保留，直到目标被满足。',
    '目标可能有多个，按其印刷顺序或卡面指示结算；由场景决定推进时点。',
    '目标本身不是行动，不需要单独花费行动；它是对推进条件的补充说明。',
  ], [
    'Objective — appears on an act or agenda and states an additional requirement to advance or resolve it. In addition to spending clues or meeting the doom threshold, investigators must satisfy the objective.',
    'If the objective is not met the card cannot advance even when clues or doom reach the requirement; progress already made is kept until the objective is satisfied.',
    'There may be several objectives, resolved in printed order or as the card directs; the scenario decides the timing of advancement.',
    'An objective is not an action and does not cost an action; it is an additional condition on advancing.',
  ], ['script', 'clues', 'doom', 'tskCampaign'], 'mubiao'),

  rule('tskResign', '撤退（Resign）', 'Resign', [
    '撤退', 'Resign', '退出',
  ], [
    '撤退是卡面能力上的一种行动指示，写作「撤退 – …」。调查员在指定地点执行撤退后离开当前章节；撤退不视为被击败。',
    '撤退通常需要满足卡面条件（地点、费用或线索）并花费 1 个行动；执行后该调查员退出本章，不再参与当前章节的结算。',
    '撤退的调查员保留经验、创伤与故事资产；若章节结局按撤退与否分支，按实际撤退的调查员结算。',
    '被击败与撤退不同：被击败会产生创伤并可能退出战役，撤退只退出当前章节。',
  ], [
    'Resign is an action ability written "Resign — …". An investigator who resigns at the stated location leaves the current scenario; resigning does not count as being defeated.',
    'Resigning usually requires meeting the card\'s conditions (location, cost or clues) and spends one action; that investigator then leaves the scenario and takes no further part in it.',
    'A resigned investigator keeps experience, trauma and story assets; if the scenario resolution branches on whether investigators resigned, resolve it from who actually resigned.',
    'Being defeated is different from resigning: defeat causes trauma and may remove the investigator from the campaign, while resigning only leaves the current scenario.',
  ], ['trauma', 'tskCampaign'], 'chetui'),

  rule('tskBonded', '绑定（Bonded）', 'Bonded', [
    '绑定', 'Bonded', '绑定卡',
  ], [
    '绑定是玩家卡关键词。带绑定的卡牌与另一张玩家卡（主卡）相连，括号里写的是主卡的名字；绑定卡没有等级，不能作为构筑选项，由主卡把它带入游戏。',
    '若牌组里有主卡，每场游戏开始时把绑定卡放在场外；每种绑定卡放在场外的张数等于它最初配的张数，不随主卡张数变化。',
    '主卡入场后，按卡面从场外找出绑定卡（加入手牌、放入场或附属）。场外的绑定卡不算牌组张数。',
    '带绑定的弱点若进入调查员牌组、手牌、威胁区或场上，按卡面与弱点规则处理；没有对应主卡在场时放在场外。',
  ], [
    'Bonded is a player-card keyword. A bonded card is linked to another player card (its host), whose name appears in parentheses; a bonded card has no level, is not a deckbuilding option, and is brought into the game by its host.',
    'If the deck contains the host, set the bonded card aside at the start of each game; the number set aside equals the number originally provided, regardless of how many copies of the host are in the deck.',
    'After the host enters play, find the bonded card in the set-aside area as the card directs (add it to hand, put it into play or attach it). Set-aside bonded cards do not count toward deck size.',
    'A bonded weakness that enters an investigator\'s deck, hand, threat area or play is handled by the card text and weakness rules; without its host in play it stays set aside.',
  ], ['deck', 'weakness', 'permanent', 'tskCampaign'], 'bangding'),
]

export const TSK_RULE_IDS = Object.freeze(TSK_RULES.map(rule => rule.id))

// 卡文直达：判据与 content/campaigns/theScarletKeys/keywords.js 的 patterns 同源，
// 测试逐张比对（tests/tsk-rules.test.mjs），两份判据不能各走各的。
const TSK_CARD_RULE_PATTERNS = Object.freeze([
  ['tskConcealed', /\bConcealed \d|concealed keyword/i],
  ['tskShift', /\bShift\b|Flip this key/i],
  ['tskHollow', /\bhollow|set-aside hollows/i],
  ['tskCustomizable', /Customizable/i],
  ['tskPatrol', /\bPatrol\b/i],
  ['tskOtherworld', /\[\[Otherworld\]\]|Otherworld/i],
  ['tskKeys', /\[\[Stable\]\]|\[\[Unstable\]\]|Scarlet Key|red key/i],
  ['tskMap', /Embark|world map|expedition|travel/i],
  ['tskStatusReports', /status report/i],
  ['tskDossiers', /Dossier|File #/i],
  ['tskCoterie', /Coterie/i],
  ['tskObjective', /\bObjective\b/i],
  ['tskResign', /\bResign\b/i],
  ['tskBonded', /\bBonded\b/i],
  ['tskChaos', /\[skull\]|\[tablet\]|\[elder_thing\]|\[auto_fail\]|\[elder_sign\]|Easy \/ Standard|Hard \/ Expert|chaos token|chaos bag/i],
  // 既有通用关键词继续连到基础规则条目（与 TIC/TDE/EotE 的卡文直达同一口径）。
  ['hunter', /\bHunter\b/i],
  ['aloof', /\bAloof\b/i],
  ['massive', /\bMassive\b/i],
  ['retaliate', /\bRetaliate\b/i],
  ['alert', /\bAlert\b/i],
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

const TYPE_RULE_LINKS = Object.freeze({
  investigator: ['tskInvestigator'],
  key: ['tskKeys'],
  scenario: ['tskMap'],
})

export function tskCardRuleIds(card) {
  // 语料必须与 content/campaigns/theScarletKeys/keywords.js 的扫描语料一致（含副名/定制栏/定制变更），
  // 否则「关键词卡面命中但规则链接缺失」会在审计里暴露。测试逐张比对。
  const text = [
    card?.name, card?.subname, card?.text, card?.backText, card?.textZh,
    card?.customizationText, card?.customizationChange, (card?.traits || []).join(' '),
  ].filter(Boolean).join('\n')
  const ids = ['tskCampaign']
  for (const [id, pattern] of TSK_CARD_RULE_PATTERNS) if (pattern.test(text)) ids.push(id)
  for (const id of TYPE_RULE_LINKS[card?.type] || []) ids.push(id)
  // 章节卡与遭遇卡都受该章混乱符号表约束。
  if (['scenario', 'act', 'agenda', 'location', 'enemy', 'treachery'].includes(card?.type)) ids.push('tskChaos')
  return [...new Set(ids)]
}

export { TSK_CARD_RULE_PATTERNS }

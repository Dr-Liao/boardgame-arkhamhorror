// Local play guide follows this game's implemented actions. Original reference
// remains linked separately; it must not imply all catalog cards are playable.
export const RULE_SOURCES = [
  ['规则参考 · 原版核心盒', 'https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/ahc60_rules_reference_eng-compressed.pdf'],
  ['新手入门 · 原版核心盒', 'https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/ahc60_learn_to_play_web-1.pdf'],
  ['官方规则与勘误', 'https://www.fantasyflightgames.com/product/arkham-horror-the-card-game/'],
]
const entry = (id,title,group,aliases,body,related=[]) => ({id,title,group,aliases,body,related})
export const RULES = [
  entry('round','回合与阶段','流程',['神话阶段','敌军阶段','整备阶段','调查阶段'],['通常一轮依次进行神话、调查、敌军、整备。第一轮从调查开始；顶部阶段栏显示当前流程。','神话阶段推进毁灭并为调查员抽取遭遇。调查阶段由真人玩家先抢先开始自己的回合，之后队友按本局的行动顺序完成行动。','敌军阶段处理猎手移动、交战和敌人攻击。整备阶段重整卡牌，每位仍在场的调查员抽一张牌、获得一个资源，并处理手牌上限。','自动阶段会逐项演出，播放完毕才开放下一次操作。时间线可回看已经发生的事件。'],['actions','encounter','doom','ready']),
  entry('actions','行动与行动点','流程',['行动点','Action','[action]'],['调查员通常每轮有三个行动点。移动、调查、普通出牌、抽一张牌、获得一个资源、攻击、躲避或主动交战通常花费一个行动。额外能力与费用会改变消耗。','人物面板显示剩余点数。将角色拖向地点可移动；拖向敌人可选择攻击。点击卡牌可查看当前可执行的能力，灰色手牌仍可右键查阅。'],['engage','opportunity','fast','resources']),
  entry('test','技能检定与投入','检定',['检定','投入','Skill test','Commit'],['检定区显示来源卡、使用的属性、难度和已投入卡牌。有效属性加上投入图标与其他加值，再结算混乱标记修正；最终数值达到难度即成功，自动失败等效果另行处理。','将带有对应技能或万能图标的合法手牌拖入投入区，再点击开始检定。投入不同于打出，投入牌在检定后按流程弃置，卡牌限制仍然有效。','混乱标记效果与最终结果依次显示。未经求助，队友不会被通知个人投入窗口。'],['help','chaos','peril']),
  entry('help','向队友求助','检定',['求助','协助'],['完成自己的投入后，点击求助，才会询问同地点的合资格队友是否协助。','协助者只能选择窗口允许的手牌或放弃协助。位置、图标和卡牌限制仍然有效。'],['test','peril']),
  entry('chaos','混乱袋与标记','检定',['混乱袋','混乱标记','Chaos','[auto_fail]'],['检定抽取的是袋中的标记。数字和特殊符号影响当前检定；特殊符号的效果可查阅剧本提示卡。','抽取动画结束后再展示修正与结果；已经揭示的标记和最终结果会记录到时间线。'],['test']),
  entry('engage','交战与主动交战','敌人',['交战','Engage'],['同地点可交战的敌人可拖向自己的头像，或拖入出现的交战区。主动交战通常花费一个行动；只能对当前合法目标操作。','猎物并列时，由队长点选角色头像，或将指定怪物拖向候选角色。已有敌人时交战区常显，没有敌人时收起。'],['prey','aloof','massive','opportunity']),
  entry('fight','攻击与伤害','敌人',['攻击','战斗','Fight'],['点击敌人或把武器拖向敌人，选择可用攻击。检定区会注明攻击属性与难度。','伤害与生命上限不同；敌人生命降至零后被击败。查看武器卡可确认额外伤害与使用次数。'],['test','retaliate','damage']),
  entry('evade','躲避与横置','敌人',['躲避','闪避','Evade'],['选择交战敌人的躲避动作并完成检定。成功通常使敌人横置并脱离交战；横置不等于被击败。','横置敌人仍留在地点。后续重整和重新交战由阶段结算处理。'],['alert','engage','ready']),
  entry('hunter','猎手','关键字',['猎手','Hunter'],['敌军阶段，未横置、未交战且所在地点没有调查员的猎手，会沿通往目标调查员的最短合法路径移动一个地点。','猎物条件会影响目标选择。移动后再处理交战与攻击，地图演出会展示移动路径。','出现并列选择时，按当前选择窗口决定；横置的猎手不会进行这次通常移动。'],['prey','round','ready']),
  entry('prey','猎物','关键字',['猎物','Prey'],['猎物条件参与敌人的目标筛选。并列时界面会显示可选的调查员。','由已确定的真人队长处理并列选择；当前猎物候选以窗口给出的角色为准。'],['engage','hunter']),
  entry('aloof','冷漠','关键字',['冷漠','Aloof'],['冷漠敌人不会像一般敌人那样自动缠上调查员。先查看它是否提供主动交战动作。','可拖入交战区后再使用攻击，具体可攻击对象仍受卡牌效果限制。'],['engage','fight']),
  entry('massive','庞大','关键字',['庞大','Massive'],['本局把同地点的庞大敌人列入该地点调查员的交战区。它不是只归属一位调查员的普通敌人。','无需再对它执行普通主动交战；查看当前可用攻击或躲避动作。'],['engage','fight']),
  entry('retaliate','反击','关键字',['反击','报复','Retaliate'],['攻击带有反击的敌人时，若该次技能检定失败，且该敌人仍在场并与你交战，它会在检定结束后攻击你。','查看敌人的伤害和恐惧值，再决定是否投入手牌或使用武器能力。'],['fight','damage']),
  entry('alert','警戒','关键字',['警戒','Alert'],['带有警戒的敌人在躲避检定失败时可能发动攻击。','查看敌人详情和检定区，确认风险后再决定投入或求助。'],['evade','damage']),
  entry('opportunity','借机攻击','敌人',['借机攻击','Attack of opportunity'],['交战中的敌人会让一些非战斗行动变得危险，例如抽牌、获取资源或移动。','本局会先结算需要发生的借机攻击，再完成动作；可先攻击、躲避或使用合适的快速能力。'],['engage','fast','evade']),
  entry('fast','快速与触发时机','关键字',['快速','Fast','[fast]','[free]','免费触发'],['快速牌和免费能力受触发时机约束，不代表随时都能打出。','在本局可用窗口中点选对应卡牌或装备。费用、次数与目标条件仍需满足。'],['actions','reaction']),
  entry('reaction','反应与强制','关键字',['反应','强制','Forced','Reaction','[reaction]'],['可选反应会提供发动或跳过的选择。强制效果由规则流程自动处理。','结算中的待决选择需要先完成，不能用其他普通行动绕过。'],['test','round']),
  entry('peril','险境','关键字',['险境','Peril'],['险境会限制其他调查员参与当前遭遇的处理。本局不会为受限制的个人检定打开队友协助窗口。','若求助不可用，先完成当前角色自己的投入与检定。'],['encounter','help']),
  entry('hidden','隐私','关键字',['隐私','隐匿','Hidden'],['带有隐私的遭遇牌只向抽到它的调查员显示名称和规则文字，并秘密加入该调查员手牌；其他调查员只能看到手牌数量变化。隐私牌计入手牌上限。','隐私牌不能被打出、不能按普通投入或弃牌效果离开手牌，也不能作为随机弃牌目标；只有该牌自身明确允许的能力可以弃掉或投入它。隐私牌离开手牌后进入遭遇弃牌堆。','《卡尔克萨之路》的「脑海中的低语」「疯狂礼物」与「恶灵附身」会在手牌中持续施加各自限制。恶灵附身（背叛）是明确例外：可以投入同地点的技能检定，并令该检定自动失败。'],['peril','revelation','carcosaAsylum','carcosaFinale']),
  entry('surge','涌动','关键字',['涌动','涌现','Surge'],['结算带有涌动的遭遇卡后，同一位调查员再抽取一张遭遇卡。每次抽卡都会在演出与时间线中独立显示。','不要把涌动抽牌误认为下一位调查员的正常遭遇。'],['encounter']),
  entry('revelation','显现','遭遇',['显现','Revelation'],['调查员抽取遭遇卡时，先结算其显现能力；敌人随后按生成指示入场，诡计则通常在结算后弃置。','显现能力造成的检定、伤害、恐惧和选择均属于当前遭遇卡的结算。'],['encounter','spawn','surge','peril']),
  entry('spawn','生成','敌人',['生成','Spawn'],['敌人被抽取时，按其生成指示放到指定地点。若没有生成指示，它通常与抽取它的调查员交战。','“生成于”不是普通移动；如果指定地点不在场，依卡面和当前场景规则处理。'],['encounter','engage','prey']),
  entry('encounter','遭遇与揭示','流程',['遭遇','揭示'],['神话阶段按流程从遭遇牌堆抽牌，并展示抽到的卡与当前调查员。','敌人会生成到规定地点；诡计可能产生检定、伤害或待决选择。牌堆与弃牌数量可在桌面查看。'],['test','revelation','spawn','surge','peril']),
  entry('parley','谈判','敌人',['谈判','Parley'],['谈判是卡牌能力指定的一种行动。执行卡面所列费用与检定；它不是攻击，也不会仅因谈判而受到反击。','谈判仍可能引发与普通行动相同的借机攻击，除非卡面或当前效果另有说明。'],['actions','opportunity','engage']),
  entry('victory','胜利与胜利区','战役',['胜利','胜利区','Victory'],['带有胜利点的敌人被击败、或带有胜利点且没有线索的地点完成调查后，通常放入胜利区。','剧本结束时，胜利区中的卡牌会依当前剧本规则提供经验或参与结局。'],['upgrade','fight','clues']),
  entry('elite','精英','关键字',['精英','Elite'],['精英敌人会忽略明确写着只能选择或影响“非精英”敌人的效果。','精英本身不会改变攻击、躲避或交战流程；仍需查看该敌人的其他关键字与卡面能力。'],['fight','evade','engage']),
  entry('clues','线索、调查与场景','流程',['线索','调查','帷幕','推进场景','[clue]'],['调查时会以地点的帷幕为基础难度。取得的线索放在人物旁的线索盘中。','右上角推进场景按钮显示当前可用线索和所需数量。还必须满足地点或时机条件，按钮才会开放。'],['test','doom','script']),
  entry('doom','毁灭与密谋推进','流程',['毁灭','推进密谋','Doom'],['右上角显示总毁灭与密谋阈值。敌人、地点等卡上的毁灭也可能参与总量。','密谋在规定检查点推进，翻页效果会依次结算；查看当前密谋了解威胁。'],['round','clues','script']),
  entry('script','密谋与场景','流程',['密谋','场景','密谋牌堆','场景牌堆','剧本书','Agenda'],['剧本书左页是当前密谋，右页是当前场景。密谋代表敌方的进展：总毁灭达到密谋阈值时推进密谋，翻到背面结算，局势通常随之恶化。','场景代表调查员的进展：满足当前场景卡面的目标（常见为共同支付线索）后推进场景。最后一张密谋或场景的背面会导向剧本结局。','部分诡计会附属到当前密谋或场景，例如亚弗戈蒙之光、绑架。附属卡压在剧本书下沿，点击可查看卡面；该密谋或场景离场时，附属卡一并弃掉。','密谋或场景卡面赋予的 [action] 能力列在剧本书旁的剧本行动中，暂不可执行时会注明原因。'],['doom','clues','encounter','dunwichEncounters']),
  entry('damage','生命、理智与分配','人物',['伤害','恐惧','生命','理智','Damage','Horror'],['人物面板显示剩余生命／上限、剩余理智／上限，条长随剩余比例变化。','收到分配选择时，点选可承受伤害或恐惧的角色、盟友或装备。耗尽生命或理智会导致调查员被击败。'],['trauma','slots']),
  entry('trauma','击败、撤退与创伤','战役',['击败','撤退','创伤','Trauma','Resign'],['击败或撤退意味着退出当前调查，并不必然等于永久死亡。最终状态由关卡结算决定。','局外结算故事显示实际结局，以及经验、肉体创伤和精神创伤变化。创伤会影响后续关卡。'],['damage','upgrade']),
  entry('slots','槽位与装备','人物',['槽位','手部','法术','盟友','Slot'],['把支援牌拖进合法槽位来装备。左右手和两个法术位分别显示；双手装备可能占用多个槽位。','槽位不足时会要求选择要替换的装备。无槽位资产放入其他资产区。'],['uses','deck']),
  entry('resources','资源与支付费用','人物',['资源','费用','Resource','[resource]'],['资源盘显示当前可花费的资源。悬浮需要支付费用的手牌会高亮资源盘，并显示费用提示；可执行的打出操作会由系统检查行动、资源、目标和槽位。','通常可用一次行动获得一个资源；整备阶段也会补充一个。牌面费用与实际费用可能因能力产生差异，以当前可用动作的费用为准。'],['actions','slots','fast']),
  entry('uses','使用次数与重整','人物',['使用','弹药','充能','Uses','横置','重整'],['弹药、充能等计数决定能力还能使用几次；看装备上的数字和当前可用能力。','要求横置的能力使用后需要等待重整或卡牌效果才能再次使用。'],['slots','ready']),
  entry('ready','重整','流程',['Ready','Exhaust'],['整备阶段会重整符合条件的卡牌，并按规则补充手牌、资源及行动准备。','被卡牌效果限制的对象不一定正常重整。以结算演出和更新后的状态为准。'],['round','uses']),
  entry('deck','卡组构筑','战役',['构筑','牌组','卡组','Deckbuilding'],['先选定调查员，再从其合法卡池构筑。数量、等级、职业、重复张数与额外限制都会实时检查。','点击卡牌或拖到牌组中加入，使用数量按钮调整；可查看详情、筛选和撤销。签名卡与弱点由系统另外加入。'],['upgrade','weakness','permanent']),
  entry('upgrade','经验与升级','战役',['升级','经验','卓越','XP','Exceptional'],['关间先选择要购入的新卡，再选择被替换的卡；预览显示本次经验花费。卓越卡牌购入时花费双倍印刷经验值，同名卓越卡牌的牌组限制为一张。','暂存可连续进行，确认后才成为正式卡组；撤销本轮会恢复升级前的卡组和经验。保留经验也可以继续。'],['deck','permanent','trauma']),
  entry('weakness','弱点','关键字',['弱点','Weakness'],['弱点可能随抽牌触发或进入威胁区。它们不是普通的可打出手牌。','签名弱点与随机基础弱点由构筑流程加入，不能用普通组牌按钮任意删除。'],['deck','encounter']),
  entry('permanent','永久与独特','关键字',['永久','独特','Permanent','Unique'],['永久卡和独特卡有额外构筑或入场限制，不能只按普通卡的张数判断。','构筑检查和升级列表会过滤当前不合法的方案；查看卡牌资料确认其具体限制。'],['deck','upgrade']),
  entry('carcosaCampaign','卡尔克萨战役与记录','卡尔克萨之路',['卡尔克萨之路','黄衣之王','八章战役','卡尔克萨战役记录'],['《卡尔克萨之路》按《谢幕》《最后的王者》《往事回声》《邪秽誓约》《真相幻影》《苍白面具》《黑星升起》《卡城幽影》的顺序推进，并在指定结局后插入两次幕间。','战役会记录疑惑、确信、贵宾采访／死亡、丹尼尔状态、陌生人的追逐与承受者，以及终章的附身者和私密尾声。只有实际到达的剧情会写入调查纪事。','八章、关键词与本规则目录已完成 M4 专项确认；正式大厅、联机和发布浏览器路线仍属于 M5，因此生产战役入口暂保持“仅图鉴”。'],['carcosaDoubtConviction','carcosaGuests','carcosaAsylum','carcosaCatacombs','carcosaFinale','carcosaChaos']),
  entry('carcosaDoubtConviction','疑惑、确信与分支','卡尔克萨之路',['疑惑','确信','Doubt','Conviction','陌生人'],['结局与幕间会分别增加疑惑或确信；后续章节比较两者或两者总和，以选择追逐路线、场景版本和最终结局。相等时按该章节明确的队长选择或结局规则处理。','陌生人的追逐次数与苍白面具下的男子承受者使用稳定调查员身份记录。承受者死亡或疯狂时按战役流程转移，存档恢复不会重复结算。'],['carcosaCampaign','carcosaFinale']),
  entry('carcosaGuests','贵宾采访、转化与幕间','卡尔克萨之路',['最后的王者','贵宾','采访','恐怖真相','幕间一'],['《最后的王者》为六位贵宾分别保存采访线索；触发恐怖真相时只转化对应人物，并保持未转化人物与遭遇区域守恒。','章节结局分别记录本次完成的采访与死亡贵宾。只有 R1 进入幕间一；幕间选择会原子替换混乱袋中的异教徒、石板或古神符号族。'],['carcosaCampaign','parley','victory']),
  entry('carcosaAsylum','邪秽誓约与隐私馈赠','卡尔克萨之路',['邪秽誓约','丹尼尔','疯狂礼物','怪物牌库','精神病院'],['《邪秽誓约》使用独立的疯子与怪物备用区。场景和密谋会把随机怪物放到场景牌库底下；相关选择在存档恢复后保持确定。','疯狂礼物以隐私牌进入抽牌者手牌。「怜悯」禁止攻击疯子敌人；「悲惨」禁止触发地点行动；使用牌面行动会随机放置一只怪物并把该隐私牌放入遭遇弃牌堆。','丹尼尔可能以盟友、敌人或未找到三种状态结束；只有 R2/R3 进入幕间二，并按状态发放 0–3 点经验组合。'],['hidden','carcosaCampaign','carcosaDoubtConviction']),
  entry('carcosaCatacombs','巴黎追逐与墓穴牌库','卡尔克萨之路',['真相幻影','苍白面具','追逐路线','墓穴','墓穴牌库'],['《真相幻影》在准备前依据疑惑／确信选择梦境与追逐路线；路线决定场景、密谋与敌人的实际行为。','《苍白面具》建立守恒的随机墓穴地点牌库，两个出口保证位于底部五张之中。探索、连接、场景二阅读者和疑惑／确信分支均写入可回放状态。'],['carcosaCampaign','carcosaDoubtConviction','carcosaChaos']),
  entry('carcosaChaos','卡尔克萨剧本混乱符号','卡尔克萨之路',['卡尔克萨混乱符号','剧本提示卡','四难度'],['八章分别按简单、标准、困难、专家提示卡结算骷髅、异教徒、石板和古神标记。修正值可读取恐惧、毁灭、线索、敌人、地点、备用区和战役记录。','符号可能在揭示时放置恐惧或毁灭、移动或攻击敌人、把怪物放到场景牌库底下，或在检定后追加后果；每种效果只在其印刷时机结算一次。'],['chaos','carcosaCampaign','carcosaCatacombs']),
  entry('carcosaFinale','黑星分支、卡城与恶灵附身','卡尔克萨之路',['黑星升起','卡城幽影','恶灵附身','哈斯塔','私密尾声'],['《黑星升起》随机选择一条内部一致的隐藏路线和两套密谋牌库；对向密谋的毁灭大于 3 增加疑惑，至多 3 增加确信。','《卡城幽影》依据疑惑、确信与总和选择场景二；哈斯塔版本、失败路线与全部最终结局分别结算。附身尾声只向对应调查员显示。','三张恶灵附身均为隐私牌。恐惧超过理智值两倍时持有者立即退场并死亡；背叛可投入并令检定自动失败，折磨支付 5 资源弃掉，谋杀对同地点调查员造成 2 伤害后弃掉。'],['hidden','carcosaCampaign','carcosaDoubtConviction','carcosaChaos']),
  entry('dunwichCampaign','敦威治战役与记录','敦威治遗产',['敦威治遗产','战役记录','双开场'],['《敦威治遗产》有两场可选择顺序的开场调查。完成第一场后进入另一场，再按战役路线前往后续章节。','结局会记录营救、绑架、献祭等结果，后续章节据此改变布置和剧情。调查纪事可查阅已经发生的完整导入、结局与幕间故事。','本战役已在大厅开放，使用本 Mod 的简化规则实现。'],['trauma','dunwichZones','clubGambling','storyGuests']),
  entry('dunwichZones','放在一边与特殊地点','敦威治遗产',['放在一边','秘密房间','展厅牌库','遭遇地点'],['有些地点、敌人和剧情资产在准备时放在一边，达到场景、密谋或地点指定条件后才进入游戏。未入场的地点不能按普通移动进入。','部分章节使用独立的地点牌堆或秘密区域；抽取、揭示和移除会改变可探索的地图。查看当前地点连接与场景目标确认下一步。'],['encounter','clues','dunwichCampaign']),
  entry('clubGambling','俱乐部行动与赌博','敦威治遗产',['百赌百胜','四叶草俱乐部','卡牌室','牌室赌博','买酒','作弊'],['《百赌百胜》开场可在俱乐部大厅弃掉手牌中的盟友取得线索；酒吧可支付 2 资源取得线索并抽牌。这两项各限全队一次。','在卡牌室可支付 2 资源揭示混乱标记：旧印得到 2 线索和 2 资源；偶数数字得到 2 线索；其他标记没有奖励。','场景 1 期间，调查员揭示混乱标记后可选择袋中的一种标记正面来结算，每轮全队限一次；使用后记录作弊，结局会永久向混乱袋加入一枚古神标记。俱乐部整关尚未开放正式战役入口。'],['chaos','clues','dunwichCampaign']),
  entry('storyGuests','剧情角色、谈判与撤退','敦威治遗产',['剧情资产','摩尔根博士','彼得·克洛弗','谈判剧情角色'],['俱乐部场景 2 达成贵宾室线索目标后，先前是否完成《课外活动》会决定出现摩尔根博士还是彼得·克洛弗。','同地点可谈判；成功次数达到调查员人数后由一位调查员控制该剧情资产。带着对应角色撤退会写入相应的战役结局。','月下美人和后巷可撤退。没有成功营救时撤退仍会结算本关，但不会记录营救成功。'],['test','trauma','dunwichCampaign']),
  entry('dunwichChamber','隐藏密室与钥匙','敦威治遗产',['隐藏密室','密室钥匙','血色祭坛','Key to the Chamber'],['《血色祭坛》在五处地点下分别放置秘密卡。清空地点线索后，可免费揭示其底下的卡。','揭示隐藏密室时，它与发现它的地点互相连接；在相邻地点控制密室钥匙的调查员可免费将钥匙附属到密室。附属前不能进入密室。'],['dunwichZones','clues']),
  entry('dunwichBrood','子嗣、咒文与追踪线索','敦威治遗产',['犹格·索托斯之子','深奥的咒文','伊本·加齐之粉','Brood of Yog-Sothoth','Esoteric Formula'],['犹格·索托斯之子只能受到「深奥的咒文」能力造成的攻击和伤害。咒文以意志代替战斗，目标每有一个线索便在该次攻击中得到 +2 意志。','多处敦威治地点可将个人或全队的线索放在子嗣上；每处地点的次数、数量和目标范围以卡面为准。部分密谋在敌人阶段结束时令子嗣朝随机地点移动。','高耸的野兽附属子嗣后增加其战斗与生命；毁灭与破坏要求所有与子嗣同处地点的调查员检定；吸引注意令每只子嗣朝抽牌者移动并涌动；生物的踪迹可令备用子嗣在随机地点生成。','伊本·加齐之粉可把其上的线索移至同地点已横置的子嗣；雨水放上的临时线索在回合结束时移除。多人地点可选择各自贡献；单人贡献地点可选择同地点队友提供线索。冷泉峡谷被选为随机地点时，可用敏捷检定重新选择。事件、盟友反击、躲避伤害和转移伤害均受子嗣免伤限制。'],['chaos','clues','dunwichZones']),
  entry('dunwichEncounters','敦威治专属遭遇','敦威治遗产',['暗影潜随','短暂的展览','尾随之蛇','世外诡影','怪异标记','腐烂的尸体','时间旋涡','辽阔无边','奥术屏障','绑架','变异野兽','蒸汽之爪','虫洞','空间间隙','亚弗戈蒙之光','污秽与寂静','不洁之地'],['部分专属诡计会立即要求检定或弃牌。世外诡影由抽牌者选择牌型；同一阶段再次抽到时改选两种，全体在场调查员弃掉相应手牌。','博物馆的暗影潜随令恐惧猎手重整、交战并攻击同地点调查员；尾随之蛇令它增加毁灭，或从遭遇牌堆、弃牌区或虚空返回。','山路的哭嚎仪式使每位调查员弃掉牌库顶三张，位于异变地点者再把弃牌区的弱点洗回牌库。异次元地点被现实崩塌弃掉时，其上的角色先移往另一维度。','奥术屏障在进入或离开附属地点前要求意志检定，失败可取消移动或弃掉牌库顶五张。蒸汽之爪优先让支援承伤，并禁止本轮移动。绑架附属到当前密谋，绑架的随机献祭在密谋背面结算前发生。亚弗戈蒙之光显现时附属到当前密谋或当前场景（每张限 1 张），在场期间所有伤害和恐惧都视为直接伤害、直接恐惧，只能分配给调查员；附属的密谋或场景离场时一并弃掉。不洁之地禁止打出盟友并使盟友印刷文字失效；污秽与寂静在回合结束伤害同地点调查员的精神，密谋推进后弃掉。变异野兽治疗憎恶，并在调查员与该敌人进入彼此地点时造成恐惧。'],['encounter','dunwichZones','test','script','damage']),
  entry('dunwichChaos','敦威治剧本混乱符号','敦威治遗产',['敦威治混乱符号','四难度','剧本提示卡'],['八关分别依据各自剧本提示卡结算骷髅、异教徒、石板和古神标记。简单与标准共用一面；困难与专家共用另一面。','修正值可能依牌库、弃牌区、地点、敌人和当前密谋改变。部分效果会在标记揭示时立即发生，另一些效果在检定成功或失败后结算。山路异教徒仅取消投入的技能牌效果与图标，支援和事件的投入图标保留；所有投入牌仍在检定结束后弃掉。'],['chaos','dunwichCampaign']),
  entry('dunwichBeyond','异次元地点与离场','敦威治遗产',['迷失时空','异次元地点','另一维度','次元门','犹格·索托斯'],['《迷失时空》会从遭遇牌库抽出地点，令其作为独立地点实例入场；地图连接由地点符号决定。虫洞先弃遭遇牌直到找到地点，结算其显现后再移动。山路的空间间隙会翻回非哨兵山地点、清除线索并洗混身份，角色移往最近的哨兵山地点。','部分异次元地点在回合结束、线索耗尽或调查员离开时会放置毁灭、弃掉或洗回牌库。地点离场时，其上的调查员和未交战敌人移动到另一维度。','犹格·索托斯不能被躲避，也不发动借机攻击；受其攻击时可选择弃牌抵消恐惧，若牌库因此耗尽则陷入疯狂。'],['dunwichZones','doom','dunwichChaos']),
]
export const ruleById = id => RULES.find(r => r.id === id) || RULES[0]
// Explicit readings keep polyphonic headings (for example 重整 / chongzheng)
// consistent across browsers without adding a transliteration dependency.
const RULE_PINYIN = {
  round:'huiheyujieduan', actions:'xingdongyuxingdongdian', test:'jinengjiandingyutouru',
  help:'xiangduiyouqiuzhu', chaos:'hunluandaiyubiaoji', engage:'jiaozhanyuzhudongjiaozhan',
  fight:'gongjiyushanghai', evade:'duobiyuhengzhi', hunter:'lieshou', prey:'liewu',
  aloof:'lengmo', massive:'pangda', retaliate:'baofu', alert:'jingjie',
  opportunity:'jiejigongji', fast:'kuaisuyuchufashiji', reaction:'fanyingyuqiangzhi',
  peril:'xianjing', surge:'yongdong', revelation:'xianxian', spawn:'shengcheng',
  hidden:'yinsi',
  encounter:'zaoyuyujieshi', parley:'tanpan', victory:'shengliyushengliqu', elite:'jingying',
  clues:'xiansuodiaochayuchangjing',
  doom:'huimieyumimoutuijin', script:'mimouyuchangjing', damage:'shengminglizhiyufenpei', trauma:'jibaichetuiyuchuangshang',
  slots:'caoweiyuzhuangbei', resources:'ziyuanyuzhifufeiyong', uses:'shiyongcishuyuchongzheng',
  ready:'chongzheng', deck:'kazugouzhu', upgrade:'jingyanyushengji', weakness:'ruodian', permanent:'yongjiuyudute',
  dunwichCampaign:'dunweizhiyichan', dunwichZones:'fangzaiyibian', clubGambling:'julebudubo', storyGuests:'juqingjuese',
  dunwichChamber:'yincangmishi', dunwichBrood:'zisi', dunwichChaos:'dunweihunluan',
  dunwichBeyond:'yiciyuandidian', dunwichEncounters:'dunweizhuanshuzaoyu',
  carcosaCampaign:'kaerkesazhilu', carcosaDoubtConviction:'yihuoyuxinxin',
  carcosaGuests:'guibincaifang', carcosaAsylum:'xiehuishiyue', carcosaCatacombs:'balizhuizongyumuxue',
  carcosaChaos:'kaerkesahunluan', carcosaFinale:'heixingyukacheng',
}
export const RULE_INDEX = RULES.map(rule => ({...rule, sortKey:RULE_PINYIN[rule.id], initial:RULE_PINYIN[rule.id][0].toUpperCase()}))
  .sort((a,b)=>a.sortKey.localeCompare(b.sortKey,'en'))
export function matchingRules(text) {
  const value = String(text || '').toLowerCase()
  return RULES.filter(r => r.aliases.some(a => value.includes(a.toLowerCase())))
}
export function cardRuleIds(card) {
  const ids = scenarioCardRuleIds(card)
  return ['act', 'agenda'].includes(card?.type) || ['02085', '02220'].includes(String(card?.originalCode || card?.code || ''))
    ? [...new Set([...ids, 'script'])] : ids
}
function scenarioCardRuleIds(card) {
  const code = String(card?.originalCode || card?.code || '')
  if (/^03\d{3}[a-z]?$/.test(code)) {
    const ids = ['carcosaCampaign']
    const encounter = card?.encounterCode
    if (/\bHidden\./i.test([card?.text, card?.textZh].filter(Boolean).join('\n'))) ids.push('hidden')
    if (encounter === 'the_last_king') ids.push('carcosaGuests')
    if (encounter === 'the_unspeakable_oath') ids.push('carcosaAsylum')
    if (['a_phantom_of_truth', 'the_pallid_mask'].includes(encounter)) ids.push('carcosaCatacombs')
    if (['black_stars_rise', 'dim_carcosa'].includes(encounter)) ids.push('carcosaFinale')
    if (card?.type === 'scenario' || ['act', 'agenda'].includes(card?.type)) ids.push('carcosaDoubtConviction')
    if (card?.type === 'scenario' || ['act', 'agenda', 'location', 'enemy', 'treachery'].includes(card?.type)) ids.push('carcosaChaos')
    return [...new Set(ids)]
  }
  if (!/^02\d{3}$/.test(code)) return []
  const number = Number(code.slice(2))
  if (number >= 62 && number <= 80) return number >= 79 ? ['storyGuests', 'clubGambling'] : ['clubGambling']
  if (number >= 41 && number <= 61) return number === 60 ? ['storyGuests', 'dunwichCampaign'] : ['dunwichCampaign']
  if (number === 214 || number === 215 || (number >= 195 && number <= 213)) return ['dunwichChamber', 'dunwichZones']
  if (number === 236 || (number >= 242 && number <= 259)) return ['dunwichBrood', 'dunwichChaos']
  if ([85, 88, 89, 96, 99, 100, 101, 102, 142, 143, 144, 145, 146, 178, 180, 181, 220, 221, 222, 223, 296, 297, 298, 331, 332, 333].includes(number)) return ['dunwichEncounters', 'dunwichZones']
  if ([118, 159, 274, 311].includes(number)) return ['dunwichChaos']
  if (number >= 320 && number <= 328) return ['dunwichBeyond', 'dunwichChaos']
  if (['the_miskatonic_museum', 'the_essex_county_express', 'blood_on_the_altar',
    'undimensioned_and_unseen', 'where_doom_awaits', 'lost_in_time_and_space'].includes(card?.encounterCode))
    return ['dunwichZones', 'dunwichChaos']
  return []
}
export function openRule(id = 'round') { window.dispatchEvent(new CustomEvent('arkham-open-rule', { detail: id })) }
export function ruleLink(h,id,label) { return h('button',{type:'button',className:'ah-rule-link','data-rule-id':id,'aria-label':'查阅规则：'+ruleById(id).title,title:'查阅规则：'+ruleById(id).title,onclick:event=>{event.stopPropagation();openRule(id)}},label || ruleById(id).title) }

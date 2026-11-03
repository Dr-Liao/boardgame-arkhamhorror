// Player-facing rules. Source: locked campaign guide and printed cards; no implementation prose.
const rule = (id, title, titleEn, aliases, body, bodyEn, related, sortKey) => ({
  id, title, titleEn, group: '印斯茅斯暗潮', groupEn: 'The Innsmouth Conspiracy', aliases: [title, titleEn, ...aliases], body, bodyEn, related, sortKey,
})
export const TIC_RULES = [
  rule('ticCampaign', '《印斯茅斯暗潮》战役与记忆', 'The Innsmouth Conspiracy: campaign and memories', ['印斯茅斯', 'Innsmouth', '记忆', 'Memories Recovered', 'flashback'], [
    '战役依次经历：绝望深坑、艾莲娜·哈珀失踪案、深陷危局、魔鬼礁石、全速恐惧、雾中之光、达贡巢穴、暗潮之下。剧情在现在与记忆中的过去之间交错，但按冒险指南的顺序游玩。',
    '第一、二、四、七章后分别有幕间 I、II、III、IV，第八章后进入尾声。幕间 III 按魔鬼礁石中取得的钥匙组合结算；闪回和幕间可能恢复记忆、给予经验或改变混乱袋。',
    '将恢复的记忆记入战役日志的“恢复的记忆”集合。同一记忆只记录一次；奖励按相应闪回或幕间指示结算。实际读到哪个分支取决于当时的战役记录。',
    '幕间 I 后进入第二章、第三章后进入第四章、第六章后进入第七章时没有通常的升级窗口。经验如何保留与何时可以花费，遵循对应指南；不能在每章之间自行升级。',
  ], [
    'Play the scenarios in this order: The Pit of Despair, The Vanishing of Elina Harper, In Too Deep, Devil Reef, Horror in High Gear, A Light in the Fog, The Lair of Dagon, Into the Maelstrom. The narrative alternates between present events and memories; do not reorder scenarios chronologically.',
    'Interludes I, II, III and IV follow scenarios one, two, four and seven respectively. The final scenario leads to the epilogue. Interlude III uses the combination of keys found in Devil Reef.',
    'Record each recovered memory once under Memories Recovered. Resolve the rewards and conditional passages instructed by the relevant flashback or interlude, using the records at that point in the campaign.',
    'There is no normal upgrade window from Interlude I to scenario two, from scenario three to four, or from scenario six to seven. Follow the guide for banking and spending experience; do not assume an upgrade window between every scenario.',
  ], ['ticBless', 'ticCurse', 'ticFlood', 'ticKeys', 'ticVehicles'], 'yinsimaosiancaozhanyiyujiyi'),
  rule('ticBless', '祝福标记', 'Bless tokens', ['祝福', 'bless', '[bless]'], [
    '祝福标记在技能检定中的通常效果为：+2，揭示另一个标记。若继续揭示祝福或诅咒，继续依次结算，直到不再要求揭示。',
    '检定结束时，将已经结算的祝福标记放回标记池，而不是混乱袋。被取消、忽略或被其他卡牌改变效果的标记，按相应卡文处理。',
    '祝福标记共有 10 个；在袋内、正在揭示及封印在场上卡牌的实体标记共用这一数量。效果要求加入超过剩余数量的标记时，尽可能加入；若是必须支付的额外费用，则必须能完整支付。',
    '在技能检定之外揭示的祝福标记本身没有效果，也不因此再揭示或消耗，除非卡面另有指示。',
  ], [
    'During a skill test, a bless token normally gives +2 and instructs you to reveal another token. Continue resolving any additional bless or curse tokens until no further reveal is required.',
    'After the test ends, return resolved bless tokens to the token pool instead of the chaos bag. Cancellation, ignoring and replacement effects follow the card that creates them.',
    'There are 10 physical bless tokens. Tokens in the bag, currently revealed and sealed on cards share this supply. Add as many as possible when resolving an effect; an additional cost must be payable in full.',
    'A bless token revealed outside a skill test has no inherent effect, additional reveal or consumption unless a card instructs otherwise.',
  ], ['ticCurse', 'ticSeal', 'chaos'], 'zhufubiaoji'),
  rule('ticCurse', '诅咒标记', 'Curse tokens', ['诅咒', 'curse', '[curse]'], [
    '诅咒标记在技能检定中的通常效果为：−2，揭示另一个标记。它不会仅因负修正而自动使检定失败。',
    '检定结束时，将已经结算的诅咒标记放回标记池，而不是混乱袋。改变修正值并不自动取消“揭示另一个标记”，也不自动让该标记回袋；这两项需要卡文另行指示。',
    '诅咒标记共有 10 个，与祝福标记分开计数；袋内、正在揭示和封印标记共用此池。无法完整加入作为额外费用要求的诅咒标记时，不能支付该费用。',
    '检定外揭示不结算诅咒本身的效果。将标记放回标记池与释放封印不同：释放是把标记放回混乱袋。',
  ], [
    'During a skill test, a curse token normally gives −2 and instructs you to reveal another token. A negative modifier alone does not automatically fail the test.',
    'Return resolved curse tokens to the token pool after the test. Changing a modifier alone does not cancel the additional reveal or return the token to the bag; those require separate instructions.',
    'The 10 physical curse tokens form a separate supply from bless tokens. Bag, revealed and sealed tokens share that supply. If an additional cost requires adding curse tokens, it must be payable in full.',
    'Curse tokens have no inherent effect outside a test. Returning a token to the pool differs from releasing it: a released token goes back to the chaos bag.',
  ], ['ticBless', 'ticSeal', 'chaos'], 'zuzhoubiaoji'),
  rule('ticSeal', '封印与释放', 'Seal and release', ['封印', '封印标记', 'Seal', 'release', 'sealed'], [
    '带“封印”关键词的卡牌入场时，封印指定标记是额外费用。从混乱袋中取出指定标记并放在该卡牌上；有多个合法选项时由其控制者选择。不能找到必须封印的标记时，该卡不能入场。',
    '“至多”允许选择零个至上限数量，仍须满足卡面其他条件。封印在卡上的标记不在混乱袋中，不能通过普通揭示抽到。',
    '释放标记时，将它从封印来源放回混乱袋。带有封印标记的卡牌离场时，立即释放其上的标记。',
    '有些能力会指示把封印标记当作刚从混乱袋揭示的标记来结算。只取该来源实际封印的标记，之后按该标记及卡文的检定结束指示处理。',
  ], [
    'Seal is an additional cost for a card to enter play: search the chaos bag for the specified token and place it on the card. The controller chooses among legal options. If a mandatory token cannot be found, the card cannot enter play.',
    'An up-to instruction permits zero through the stated maximum, subject to the rest of the card. Sealed tokens are not in the bag and cannot be drawn by a normal reveal.',
    'To release a token, return it from its sealing source to the chaos bag. Immediately release all tokens sealed on a card when that card leaves play.',
    'Some abilities resolve a sealed token as if it had just been revealed from the bag. Use a token actually sealed on that source, then follow the token and card instructions when the test ends.',
  ], ['ticBless', 'ticCurse'], 'fengyinyushifang'),
  rule('ticFlood', '淹没等级与空气', 'Flood levels and air', ['淹没', '完全淹没', '空气', 'flood', 'fully flooded', 'air'], [
    '地点有未淹没、部分淹没、完全淹没三个等级。提高等级按此顺序前进一步，降低等级则后退一步；完全淹没不能再提高，未淹没不能再降低。部分和完全淹没均属于“已淹没”。',
    '淹没等级本身没有固有效果。卡牌可能根据地点的等级改变难度、伤害、移动或其他效果，按其文字处理。',
    '当特别规则要求争取空气时：如果你在自己的回合开始时位于完全淹没的地点，必须在该回合内到达不是完全淹没的地点，否则回合结束时受到 5 点直接伤害。按卡牌处理渔船、潜水服等例外。',
    '一旦在本回合呼吸到空气，即使之后又进入完全淹没的地点，也不会因这一次空气要求受伤。在回合开始之后才进入完全淹没的地点，不会自行补触发回合开始的要求。',
  ], [
    'A location is unflooded, partially flooded or fully flooded. Increasing moves it one step along that order; decreasing moves it back. A fully flooded location cannot increase, and an unflooded location cannot decrease. Both other levels count as flooded.',
    'Flood level has no inherent game effect. Apply the text of cards that change difficulty, harm, movement or other effects based on it.',
    'When the special air rule applies, an investigator who begins their turn at a fully flooded location must reach a location that is not fully flooded during that turn or take 5 direct damage at its end. Apply the exceptions provided by Fishing Vessel, Diving Suit or other cards.',
    'After obtaining air during that turn, returning to a fully flooded location does not restore that air obligation. Entering a fully flooded location after the turn has begun does not by itself retrigger a turn-begins requirement.',
  ], ['ticKeys', 'ticVehicles', 'damage'], 'yanmodengjiyukongqi'),
  rule('ticKeys', '钥匙的取得、转移与花费', 'Claiming, transferring and spending keys', ['钥匙', 'Keys', 'key tokens'], [
    '本循环使用红、蓝、绿、黄、紫、黑、白七种钥匙。背面图案相同，可随机放置而不公开颜色；设置时按指南决定哪些正面朝上、哪些随机盖放。钥匙本身没有固有效果。',
    '若你所在地点没有线索，可以用免费触发能力取得该地点的钥匙。取得钥匙时将其翻到正面，放在自己的调查员卡上。',
    '若一名调查员使带钥匙的敌人离场，该调查员必须取得该敌人的所有钥匙；若敌人因其他原因离场，将钥匙放在其地点。调查员被消除时，将其钥匙放在其地点。',
    '作为一个行动，你可以把任意数量自己控制的钥匙交给同地点的另一名调查员。不能转交不属于你的钥匙，也不能交给其他地点的调查员。',
    '只有控制钥匙的调查员可以花费它。达贡巢穴中花费的钥匙放在剧本提示卡上，不再由调查员持有；其他剧本按自己的特别规则处理。',
  ], [
    'The seven keys are red, blue, green, yellow, purple, black and white. Their identical backs permit random placement without revealing colors. Follow setup for faceup and facedown keys. Keys have no inherent effect.',
    'As a free triggered ability, take keys from your location if it has no clues. Turn claimed keys faceup and place them on your investigator card.',
    'An investigator who causes an enemy to leave play must take all its keys. If it leaves through other means, put them on its location. An eliminated investigator drops their keys at their location.',
    'As an action, give any number of keys you control to another investigator at your location. You cannot give keys you do not control or give them to someone elsewhere.',
    'Only a key’s controller may spend it. In The Lair of Dagon, spent keys go on the scenario reference card. Follow each other scenario’s specific instructions.',
  ], ['ticCampaign', 'ticFlood'], 'yaoshidequdezhuanyiyuhuafei'),
  rule('ticVehicles', '载具与驾驶', 'Vehicles and drivers', ['载具', 'Vehicle', '驾驶', '渔船', '汽车', 'driver', 'passenger'], [
    '载具是带“载具”关键词的支援。位于载具中与仅仅位于同一地点不同；载具中的调查员也在该载具所在地点。',
    '作为一个行动，可进入或离开自己地点的载具；每名调查员每轮只能执行此能力一次。载具内的调查员不能独立于载具移动。',
    '载具通过自身能力移动时，其中的所有调查员随之移动。载具本身不改变敌人移动或交战，除非卡面另有说明；与乘客交战的敌人仍按正常规则跟随。',
    '遵守卡面的容量。需要驾驶者的剧本中，只要载具内有调查员，就必须有一名驾驶者；驾驶者离开或被消除时，由仍在其中的调查员中选择新的驾驶者。',
    '全速恐惧中的汽车有行驶／停止两面，用卡面能力启停和翻面。只有相应卡面允许时才能移动；船只则遵循自己的移动能力。',
  ], [
    'A vehicle is an asset with the vehicle keyword. Being in a vehicle differs from merely sharing its location; its passengers are also at that location.',
    'As an action, enter or leave a vehicle at your location. Each investigator may use this ability only once per round. While in a vehicle, you cannot move independently of it.',
    'When a vehicle moves using its ability, all passengers move with it. Vehicles do not alter enemy movement or engagement unless specified; engaged enemies follow normal movement rules.',
    'Observe printed capacity. In a scenario requiring a driver, every occupied vehicle must have one. If its driver leaves or is eliminated, choose a new driver among its remaining investigators.',
    'Cars in Horror in High Gear have running and stopped sides. Use their abilities to start, stop and flip them. Move only when the relevant card ability permits it; boats follow their own abilities.',
  ], ['ticRoad', 'ticFlood'], 'zaijuyujiashi'),
  rule('ticRoad', '道路 X 与道路连接', 'Road X and road connections', ['道路', 'Road X', 'Road', '绕路'], [
    '全速恐惧的道路按从左到右的列排列。同一列内的地点不相连，每个地点与其前一列和后一列的每个地点相连。',
    '揭示“道路 X”地点时，若其前方没有地点，在前方新的一列放入 X 个未揭示地点。第一张取道路牌库顶，其余取放在一边的绕路地点；绕路地点不足时尽可能放置。',
    '将这一列中的地点随机排列，让调查员不知道哪一张来自道路牌库、哪一张是绕路。若前方已有地点，则不再次产生一列。',
  ], [
    'The road in Horror in High Gear is arranged in columns from left to right. Locations connect to every location in the preceding and following columns, never to another location in the same column.',
    'When a location with Road X is revealed and none are ahead of it, place X unrevealed locations in a new column ahead. The first comes from the top of the Road deck; the rest are set-aside Long Way Around locations, as many as available.',
    'Randomize the locations in the new column so investigators cannot tell which is from the Road deck. Do not create another column if locations are already ahead.',
  ], ['ticVehicles', 'clues'], 'daoluyudaolulianjie'),
  rule('ticCovenant', '契约的牌组限制', 'Covenant deck limit', ['契约', 'Covenant'], [
    '本循环的契约卡带有“每副牌组限 1 张契约”的限制。这是按特性共用的限制，不是每种名称各限 1 张。',
    '即使职业、等级或卡名不同，同一调查员的牌组也不能同时包含多张契约。初始构筑和升级均须遵守。',
    '各契约如何改变祝福或诅咒的修正、继续揭示、自动成功及结束后去向，分别按其卡文处理；拥有契约特性本身不产生这些效果。',
  ], [
    'The cycle’s Covenant cards limit your deck to one Covenant. This is a shared trait limit, not one copy of each title.',
    'Different classes, levels and titles still count toward the same single-Covenant limit, both during initial construction and when upgrading.',
    'Each Covenant separately specifies token modifiers, additional reveals, automatic success and token destinations. The trait itself grants none of those effects.',
  ], ['deck', 'upgrade', 'ticBless', 'ticCurse'], 'qiyuedepaizuxianzhi'),
  rule('ticResearched', '研究完成', 'Researched', ['研究完成', 'Researched', '魔典', 'grimoire'], [
    '“研究完成”表示购买该升级需要相应的研究记录。满足职业和等级条件并有足够经验，并不替代这项前提。',
    '基础版《神秘魔典》的能力会指示在战役日志记录已翻译魔典；按这一记录检查其研究完成升级的购买条件。',
    '研究记录和经验分别处理。按升级规则支付经验并替换卡牌；升级卡本身的能力、费用和使用次数仍按卡文执行。',
  ], [
    'A Researched upgrade requires the relevant research record. Having enough experience and matching the investigator’s class and level permissions does not replace that prerequisite.',
    'The level-zero Cryptic Grimoire instructs you to record that you have translated the grimoire. That record is the prerequisite for its researched upgrades.',
    'Research records and experience are separate. Pay experience and replace cards according to upgrade rules; the upgraded card’s abilities, costs and uses follow its text.',
  ], ['upgrade', 'ticCampaign'], 'yanjiuwancheng'),
]
export const TIC_RULE_IDS = Object.freeze(TIC_RULES.map(rule => rule.id))
export const TIC_CARD_RULE_PATTERNS = Object.freeze([
  ['ticBless', /\[bless\]/i], ['ticCurse', /\[curse\]/i], ['ticSeal', /\bseal(?:ed)?\b|release.*token/i],
  ['ticFlood', /flood|\bair\b|drown/i], ['ticKeys', /\bkeys?\b/i], ['ticVehicles', /vehicle|boat|driver|passenger/i],
  ['ticRoad', /\bRoad\s+\d/i], ['ticCovenant', /\[\[Covenant\]\]/i], ['ticResearched', /\bResearched\b/i],
  ['permanent', /\bPermanent\b/i], ['fast', /\bFast\./i], ['hunter', /\bHunter\b/i], ['aloof', /\bAloof\b/i],
  ['upgrade', /\bExceptional\b/i],
  ['massive', /\bMassive\b/i], ['retaliate', /\bRetaliate\b/i], ['surge', /\bSurge\b/i], ['peril', /\bPeril\b/i],
  ['victory', /\bVictory\b/i], ['revelation', /\bRevelation\b/i],
])
export function ticCardRuleIds(card) {
  return ['ticCampaign', ...TIC_CARD_RULE_PATTERNS.filter(([, pattern]) => pattern.test([card?.text, card?.backText].join('\n'))).map(([id]) => id)]
}

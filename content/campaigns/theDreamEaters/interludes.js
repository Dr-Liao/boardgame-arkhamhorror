// 食梦者（The Dream-Eaters）· 三段幕间的节点图、选择与效果数据（P8 战役层）。
//
// 事实源（锁定）：
//   · 叙事正文：`参考资源/ArkhamHorror-main/frontend/src/locales/en/theDreamEaters/base.json`
//     的 `flavorText` 段（冻结哈希见 P8-T 来源锁）——本文件原样保存**英文原文**（去 HTML、
//     保留 `_斜体_` / `*强调*` / `{tablet}` 等卡面记号），统一标 `pendingTranslation: true`；
//     **不自译、不写中文摘要**，中文由 P8-T 的 `story-text.js` 生成器补齐；
//   · 结构与数值：`Campaigns/TheDreamEaters.hs` C:404-735（P8-CAMPAIGN-FACTS §5 的节点图）。
//
// 三个幕间：
//   I  《黑猫》  —— 双线：theBlackCat（规则说明）→ theBlackCat1 → theBlackCat2（4 选 1）→
//                  theBlackCat3 + 条件绿字/跨线效果；单线 A 只读 theBlackCat + theBlackCat1；
//                  单线 B 只读 theBlackCat + theBlackCat3 + youAreOnYourOwn；
//   II 《入梦者》—— 双线：B 侧 theOneironauts1（含 wheresBlondie / youAskedForIt 分支）→
//                  A 侧 theOneironauts2（含 searchingForTheTruth 跳过）→ B 侧 nowWhereWasI +
//                  请求帮助/警告/分享知识三支 → 下一章（由章对 gate 选择先打哪条线）；
//   III《伟大的存在》—— A 侧 theGreatOnes1（弱化/搜查/youAskedForIt 跳过）→ 2 选 1 →
//                  B 侧 theGreatOnes2（银钥匙移交）→ theGreatOnes2Part2（搜查 / 两条线传闻分支）。
//
// 跨线读写口径（路线图 §7.2.2）：`effects` 只使用 `src/campaign/campaign-effects.js` 已注册的
// `type`（record / increment / chaos / recordUnion / recordRemove / experience / privateStory /
// addCampaignCardToDeck / log），每条效果带 `part: 'A' | 'B'` 标注目标线；`applyCampaignEffect`
// 目前只作用于活动线，按 part 分发属 P9.5 的接线点（本层不声称已执行跨线写入）。
// 无法用现有 type 表达的动作（按难度加 token、从 B 线牌库移除银钥匙）单独放 `pendingEffects`，
// 不混进 `effects`，避免 P9.5 接线时把未知 type 当已实现。
//
// flow 接线：`attachInterludes(flow, { mode })` 把 `partFlow` 生成的
// `interlude1/2/3` 占位节点替换成完整子图；单线 A/B 只保留幕间 I 的对应分支，
// 并删掉幕间 II/III（参考实现的单线 `nextStep` 直接把下一章交给 PartialMode，C:152/160/169/177/186/194）。

const FLAVOR = 'theDreamEaters.flavorText'
const LABEL = 'theDreamEaters.label'

// ---------------------------------------------------------------------------
// 叙事正文（英文原文；由锁定 locale 生成，P8-T 翻译前保持 pendingTranslation）
// ---------------------------------------------------------------------------
export const TDE_INTERLUDE_TEXT = Object.freeze({
  "theBlackCat": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "If you are playing both The Dream-Quest and The Web of Dreams as an interconnected campaign, or if you are playing The Dream-Quest (Campaign A) by itself: Proceed to _The Black Cat 1_.\nIf you are playing The Web of Dreams (Campaign B) by itself: Skip to _The Black Cat 3_.",
    "key": "theDreamEaters.flavorText.theBlackCat",
    "pendingTranslation": true
  },
  "theBlackCat1": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_The Black Cat 1:_ As you travel out of the Enchanted Woods, you pass through rolling green meadows under a bright-blue, cloudless sky. You speak with the blond-haired man—who introduces himself as Randolph Carter— for several hours along your journey south. You pass through a town Randolph calls Nir and over a stone bridge spanning a wide river. Since the man seems friendly and knowledgeable about both your world and this one, you explain to him your situation: that you had followed the writings of a man named Virgil Gray to reach this strange land, in order to see for yourself the truth of his story. “There is a place in Ulthar where you may yet meet this man for yourself,” Randolph responds. “When we reach Ulthar, I will show you.”\nThe town of Ulthar is not quite what you had imagined. The border of the town is marked by a cobblestone road separating its quaint cottages from the rolling green meadows beyond. Inside the town, narrow cobbled streets are filled almost to capacity with cats of all kinds and colors, which part as you approach. Old peaked roofs and overhanging upper stories arch over the hilly streets; the entire village seems a haphazard cluster of homes and old-fashioned businesses. As you reach the town square near the center of the village, Randolph stops and addresses you with a youthful smile. “Welcome to Ulthar,” he proclaims. “As I mentioned before, you are quite safe here. There is but one paramount law to keep in mind as you traverse this place: in the town of Ulthar, no one may kill a cat.” Given how utterly packed the streets are with cats, you wonder aloud if this is indeed a town run by cats. “Not quite,” Randolph replies, pondering your words, “though I suppose one might call it the center of cat society here in the Dreamlands. The reason for that law’s existence is a story for another time. First, come—I have a feeling we’ll find this ‘Virgil’ fellow you speak of at Einar’s.”\nRandolph leads you through the town square, which is surrounded by buildings adorned with cat motifs in the form of statues, signs, and even stained-glass windows. You eventually arrive at one such building bearing a sign that reads “Einar’s Place.” Inside is a medieval-style tavern filled with long wooden tables. You spot several patrons and three times as many cats. One such patron at the wooden counter feeds one of the cats small strips of dried meat. He is a handsome man in his early thirties, with short dark hair, a strong jaw, and sharp cheekbones. You recognize him instantly as the writer Virgil Gray. In the back of your mind, you wonder if this chance meeting is merely an act of fortune or something preordained, for good or for ill.\nRegardless, you approach the man and introduce yourself, along with Randolph. Virgil shakes your hand and Randolph’s with a joyful smile. “Well met, fellow dreamers!” the writer says, a hint of boyish excitement in his voice. “It is wonderful to meet more fellow believers. I had become so sick and tired of reading about my supposed ‘illness’ in the papers.”\nYou nod your head in agreement and inform Virgil that you intend to find some proof of this discovery to bring back to the waking world. “Don’t you think I tried that?” he replies, stymied. “Sadly, it is impossible for one who is asleep to bring anything from this realm into the real world. This is all imagination, you see. Ideas, concepts, fantasies. You cannot hold a thought in your hands, can you?”\nRandolph interjects. “There is a place within the Dreamlands that may hold the proof you seek. I have seen it in my dreams. I visited there three times, each time just a fleeting moment before I was snatched away by the rising sun...but try as I might, I cannot find the way again. I have spent many nights searching.”\n“Oh?” Virgil asks, intrigued. “And what is this place?”\n“It is a marvelous city,” he describes, his eyes aglow with wonder, “golden and lovely like nothing I have seen before or since. A city beyond the peaks of the unknown mountain Kadath, where no one has ever set foot before. There, veiled within the clouds and crowned by stars, lies the onyx castle of the Great Ones.”\nVirgil idly pets the cat on the countertop next to him as he is absorbed by Randolph’s tale. It is a slender creature with lustrous black fur, dark as the void of space itself. “Then we must find this place! Even if it does not have the proof we seek, it sounds like the adventure of a lifetime. Enough to fill a hundred pages, or more!”\nYou tell Virgil and Randolph that before you commit to such an adventure, you must return to the waking world and tell your companions about your experiences. Just then, another voice, cryptic and quiet, chimes: “Oh, you can’t wake up. The eye is upon you now.”\nYou and the others spin your heads around, searching for the source of the voice. The barkeeper? Another patron? Then Virgil’s black cat stretches and sits up, its piercing yellow eyes reflecting the light of the sun through the window outside. “I have waited a long time for you to seek Kadath,” it says.\n“You can talk?” Virgil says, nearly toppling over his stool as he jumps in surprise.\n“I’m a cat, you dolt. Of course I can talk,” the black cat replies, licking its paw out of boredom. “You have met a thousand cats from Ulthar, and now you are surprised?”\n“But...I thought...” Virgil wipes his brow with his palm.\n“Never mind him,” the black cat says, addressing you directly. “I assure you, you cannot cross back into the waking world until you find Kadath. It is your only way out. In the meantime, I will return and tell your companions about the quest ahead of you.” It hops off of the countertop and walks confidently toward the exit. “Though I imagine their task will be even more arduous...”\nIf you are playing both The Dream-Quest and The Web of Dreams as interconnected campaigns: Proceed to _The Black Cat 2_.\nOtherwise, the enigmatic cat vanishes out the door before you get the chance to respond. Proceed to _Scenario 2–A: The Search for Kadath_.",
    "key": "theDreamEaters.flavorText.theBlackCat1",
    "pendingTranslation": true
  },
  "theBlackCat2": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_The Black Cat 2:_ “What shall I tell your friends in the waking world?”\nThe lead investigator must decide (choose one):Tell your companions of your quest, your plight, and your peril. The black cat will return to you once this message is delivered. This may put an undue burden on your companions. In the Campaign Log for The Dream-Quest (Campaign A), record *the black cat delivered news of your plight*.\nTell your companions about your new friends and about the Dreamlands. In the Campaign Log for The Dream-Quest (Campaign A), record *the black cat shared knowledge of the Dreamlands*.\nTell your companions that they are in danger, and that you are safe. The black cat will stay with them once this message is delivered. This might make your quest a little more difficult. In the Campaign Log for The Dream-Quest (Campaign A), record *the black cat warned the others*.\nYou don’t trust this creature one bit. You threaten the black cat, warning it not to approach your friends under any circumstance. The black cat yawns and vanishes out the door. In the Campaign Log for The Dream-Quest (Campaign A), record *okay, fine, have it your way then*.\n\nProceed to _The Black Cat 3_.",
    "key": "theDreamEaters.flavorText.theBlackCat2",
    "pendingTranslation": true
  },
  "theBlackCat3": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_The Black Cat 3:_ “...You must be their friends,” the enigmatic voice says from above. To your surprise, the quiet voice belongs not to a person, but to a black cat that lounges lazily across a tree branch hanging over the path outside the hospital. “Oh, pick your jaws up off the ground and listen.” The cat rises and leaps onto the top of a nearby fence, walking along it with the kind of grace only cats possess.\n“It is one of the cats of Earth’s Dreamlands,” Randolph proclaims, his voice tinged with merriment, like he was meeting an old friend for the first time in ages. “How long it has been since I have spoken with one of your kind!”\nThe cat’s piercing yellow eyes glare at Randolph for a moment before it returns its gaze to you. “...Sure. In any event, I bear a message from your dreaming friends.”\nCheck the Campaign Log for The Dream-Quest (Campaign A). Choose and read the section below that applies to your situation.",
    "key": "theDreamEaters.flavorText.theBlackCat3",
    "pendingTranslation": true
  },
  "youAreOnYourOwn": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_*If you are playing The Web of Dreams (Campaign B) by itself, and there is no Campaign Log for The Dream-Quest:*_\n“Your friends are not the only ones in trouble,” the black cat explains. “There’s a grand conspiracy at work here, and your friends are...well, let’s just say they’re a bit preoccupied with their own problems at the moment. You’re the only ones who can destroy the great web. Forget about your companions and descend into the pitch. It’s the only way. I’ll try to keep your friends safe while you fulfill your task. Do you understand?”\nIn your Campaign Log, record *you are on your own*.",
    "key": "theDreamEaters.flavorText.youAreOnYourOwn",
    "pendingTranslation": true
  },
  "theBlackCatSharedKnowledgeOfTheDreamlands": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_*If the black cat shared knowledge of the Dreamlands:*_\nThe black cat tells you all about the Dreamlands and about the quest your friends are about to embark upon. “Your friends are in a safe place in the Dreamlands, along with a couple of others. My pet human, Virgil, is one of them. Yes, that Virgil. I see the looks on your faces. They’re also with another dreamer, a man named...hey, wait a minute.” The cat glares suspiciously at Randolph, then yawns. “Huh. You know what? Never mind. I have to check on something.” With that, the cat suddenly departs.\nIn both Campaign Logs, record *the black cat has a hunch*.",
    "key": "theDreamEaters.flavorText.theBlackCatSharedKnowledgeOfTheDreamlands",
    "pendingTranslation": true
  },
  "theBlackCatDeliveredNewsOfYourPlight": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_*If the black cat delivered news of your plight:*_\n“So, your pals aren’t looking too good. They wanted me to tell you that they’re in a lot of trouble. They can’t wake up until they fulfill this quest, and it’s not going to be easy. The eye of chaos is watching them. You’ve got your work cut out for you, but you also might be their only hope.” The black cat hops down from the fence and starts to walk away. “Now, if you’ll excuse me, I’d better get back to your friends before they all get themselves killed.”\nIn the Campaign Log for The Dream-Quest (Campaign A), record *the black cat is at your side*. Add 1 {elderThing} token to the chaos bags for both campaigns.",
    "key": "theDreamEaters.flavorText.theBlackCatDeliveredNewsOfYourPlight",
    "pendingTranslation": true
  },
  "theBlackCatWarnedTheOthers": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_*If the black cat warned the others:*_\n“Your friends told me to tell you that they’re fine. In fact, they told me to warn you that you’re the ones in real danger. I’d believe them if I were you. There’s a grand conspiracy at work here, and you’re the only ones who can stop it. The best thing you can do is forge onward, for both your sakes. Don’t worry, I’ll stick around for a while. Someone’s gotta keep you alive.”\nIn the Campaign Log for The Web of Dreams (Campaign B), record *the black cat is at your side*. Add 1 {tablet} token to the chaos bags for both campaigns.",
    "key": "theDreamEaters.flavorText.theBlackCatWarnedTheOthers",
    "pendingTranslation": true
  },
  "okayFineHaveItYourWayThen": {
    "group": "interlude1",
    "title": "Interlude I: The Black Cat",
    "text": "_*If okay, fine, have it your way then:*_\n“Nah, you know what? Forget about it. I’m sure you’ll be fine.” The black cat suddenly leaves without another word.\nIn both Campaign Logs, record *you asked for it*.",
    "key": "theDreamEaters.flavorText.okayFineHaveItYourWayThen",
    "pendingTranslation": true
  },
  "theOneironauts1": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_The Oneironauts 1:_ Following scenario 2–B, the investigators have finally reached the end of the mysterious stairway…\nThe black cat awaits you at the bottom of the stairs, watching your long descent with distant, unblinking eyes. You are about to ask how the cat got there when it cuts you off. “Don’t bother. You wouldn’t understand.” It curls up on the cold stone floor, lounging amid the bleak environment.\nCheck the Campaign Log for The Web of Dreams (Campaign B). Read the section below that applies to your situation, then proceed to the following text. If neither section applies, skip them.",
    "key": "theDreamEaters.flavorText.theOneironauts1",
    "pendingTranslation": true
  },
  "wheresBlondie": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If Randolph did not survive the descent and the black cat has a hunch:*_\n“Where’s blondie?” the black cat asks, peering around. You remain silent, in anguish. “Ah. I see.” The cat examines its paw. It doesn’t seem to care that your companion did not survive the descent. “Well, that seems to have resolved itself nicely,” it says to itself cryptically.\nIn both Campaign Logs, cross off *the black cat has a hunch*.",
    "key": "theDreamEaters.flavorText.wheresBlondie",
    "pendingTranslation": true
  },
  "youAskedForIt": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If you asked for it:*_\n“Well, since you clearly don’t need my help, I’ll be off now. Just wanted to check to see if you’re still alive. And look at that! You are. For now. Bye then.” Before you get the chance to reply, the black cat wanders off, its pitch-black fur melding into the darkness of the Underworld.\nSkip the rest of this interlude.\nProceed to either _Scenario 3–A: Dark Side of the Moon_ or _Scenario 3–B: Point of No Return_.",
    "key": "theDreamEaters.flavorText.youAskedForIt",
    "pendingTranslation": true
  },
  "youDidNotAskForIt": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "You’ve about had it with this cat’s cryptic half-truths and nonanswers. You rail at the beast. How are you supposed to help when you might as well be stumbling in the dark? The black cat sits up and narrows its gaze. “I did not know if you could be trusted. To be honest, I am still unsure. I have had visions of these events for many, many years now. I know some of what may come to pass, but not everything. You could be the ones who will save all of us…or the fools who herald our doom.” The cat’s justification is convenient, but it does explain how it has known where to find you at every turn. You try to persuade the cat to trust you, but it remains unconvinced. “Tell you what. Beneath the surface of the Sea of Pitch lies a passageway between realms. That is where you need to go to stop this world from merging with yours. Make it there in one piece, and I’ll tell you everything. But first, I have somewhere else to be. Your pals need me, too.”\nCheck Campaign Log. *If the black cat has a hunch*, it wanders off before you can reply, its pitch-black fur melding into the darkness of the Underworld.\nOtherwise, the black cat once again offers to pass a message along to your companions. The lead investigator must decide (choose one):Tell your companions that you are in trouble. The black cat will return to you with aid once this message is delivered. This may put an undue burden on your companions. In the Campaign Log for The Web of Dreams (Campaign B), record *the black cat requested aid from the others*.\nTell your companions about the Underworld. The black cat will then go elsewhere. In the Campaign Log for The Web of Dreams (Campaign B), record *the black cat shared knowledge of the Underworld*.\nTell your companions that you are safe. The black cat will stay with them once this message is delivered. This might make your quest a little more difficult. In the Campaign Log for The Web of Dreams (Campaign B), record *the black cat warned the others*.\n\nProceed to _The Oneironauts 2_.",
    "key": "theDreamEaters.flavorText.youDidNotAskForIt",
    "pendingTranslation": true
  },
  "theOneironauts2": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_The Oneironauts 2:_ Following scenario 2–A, the dreamers sail for parts unknown…\nYou open your eyes to the sound of a cat’s shrill caterwauling. You had been drifting off to…well, not sleep, exactly. Despite—or perhaps due to—your dreaming, you have been unable to truly sleep in this realm. When you come to your senses, you spot the source of the wailing: Virgil’s cat, black as the void of space itself, sits several feet away waiting for you to pay attention. “Finally,” it declares, “about time you noticed something outside your own head. Listen, I got something important to tell you.”\nCheck the Campaign Log for The Dream-Quest (Campaign A). Read each section below that applies to your situation. Then, proceed to the following text.",
    "key": "theDreamEaters.flavorText.theOneironauts2",
    "pendingTranslation": true
  },
  "atLeastOneNotCaptured": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If at least one of the investigators was not captured:*_\n“Wait, where is my human?” the cat asks, craning its head to look around the deck of your ship. “Didn’t I leave him with you?” You explain that Virgil has been taken captive by Corsairs, and the cat replies by licking its paw without much concern. “Oh yeah, that’s right. Okay. I’m on the same page as you now.”",
    "key": "theDreamEaters.flavorText.atLeastOneNotCaptured",
    "pendingTranslation": true
  },
  "allCaptured": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If all of the investigators were captured:*_\nYou try to shush the black cat, but it ignores you. “Relax. Your captors are all up on deck at the moment.” You ask bitterly why the creature is so cavalier about your capture, and request that it free you. “Nah. Somebody else has that covered, if memory serves,” it replies enigmatically.",
    "key": "theDreamEaters.flavorText.allCaptured",
    "pendingTranslation": true
  },
  "searchingForTheTruth": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If the black cat has a hunch and Randolph eluded capture:*_\nThe black cat sees Randolph at the helm of your ship and glares at him suspiciously. You wonder aloud what is wrong. “Normally I like the smell of fish, but this is too fishy. Something is wrong. There are not supposed to be two of him. But my memory is fuzzy…” You thought you were confused before, but now you are truly lost. Two Randolphs? “Yes,” the black cat affirms. “This one, and another in the waking world. That seems off,” the black cat understates the problem. “I think something is trying to interfere. I need to go figure this out.” With that, the cat leaps out of view.\nSkip the rest of this interlude. In both Campaign Logs, record *the black cat is searching for the truth*.",
    "key": "theDreamEaters.flavorText.searchingForTheTruth",
    "pendingTranslation": true
  },
  "nowWhereWasI": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "“Now, where was I? Oh, right. I had a chat with your friends. They’re in the Dreamlands now, too. They have a message for you.”\nCheck the Campaign Log for The Web of Dreams (Campaign B). Read the section below that applies to your situation.\nOnce the relevant entry has been read, choose and proceed to either _Scenario 3–A: Dark Side of the Moon_ or _Scenario 3–B: Point of No Return_.",
    "key": "theDreamEaters.flavorText.nowWhereWasI",
    "pendingTranslation": true
  },
  "theBlackCatRequestedAidFromTheOthers": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If the black cat requested aid from the others:*_\n“Your friends are in a bit of trouble. They took a one-way trip to a pretty awful place, and I don’t know if they’ll be able to navigate it without me. I know your quest is looking pretty dire right now, too, but if I don’t stick by them, it won’t matter whether you reach Kadath or not. Good luck. Try not to die.” With that, the black cat leaps out of view.\nCheck both Campaign Logs.\n*If neither Campaign Log has the black cat is at your side recorded*, in the Campaign Log for The Web of Dreams (Campaign B), record *the black cat is at your side*. Add 1 {tablet} token to the chaos bags for both campaigns.\n*If the Campaign Log for The Dream-Quest (Campaign A) has the black cat is at your side recorded*, cross it off and record it in the Campaign Log for The Web of Dreams (Campaign B) instead. Replace 1 {elderThing} token in each campaign’s chaos bag with 1 {tablet} token.\n*If the Campaign Log for The Web of Dreams (Campaign B) has the black cat is at your side recorded*, no change is made.",
    "key": "theDreamEaters.flavorText.theBlackCatRequestedAidFromTheOthers",
    "pendingTranslation": true
  },
  "warnedTheOthersStory": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If the black cat warned the others:*_\n“Your friends are doing about as well as can be expected, really. But they’re worried about you, and for good reason, it seems. They might not be able to reach you any time soon. They want me to help you out instead, so I’ll be staying here for a little while longer. Gotta make sure you survive. If you don’t, well…” it takes a long pause, “…let’s not talk about that.”\nCheck both Campaign Logs.\n*If neither Campaign Log has the black cat is at your side recorded*, in the Campaign Log for The Dream-Quest (Campaign A), record *the black cat is at your side*. Add 1 {elderThing} token to the chaos bags for both campaigns.\n*If the Campaign Log for The Web of Dreams (Campaign B) has the black cat is at your side recorded*, cross it off and record it in the Campaign Log for The Dream-Quest (Campaign A) instead. Replace 1 {tablet} token in each campaign’s chaos bag with 1 {elderThing} token.\n*If the Campaign Log for The Dream-Quest (Campaign A) has the black cat is at your side recorded*, no change is made.",
    "key": "theDreamEaters.flavorText.warnedTheOthersStory",
    "pendingTranslation": true
  },
  "sharedTheKnowledgeStory": {
    "group": "interlude2",
    "title": "Interlude II: The Oneironauts",
    "text": "_*If the black cat shared knowledge of the Underworld:*_\nThe black cat tells you all about the region of the Dreamlands your companions have entered. “The entire surface of the Dreamlands, where you’ve been exploring, covers the Underworld like a beautiful silk dress over decayed skin. You have no reason to go there, which is a good thing, because it is a particularly inhospitable place. You actually might have walked right by one entrance to the Underworld, now that I think about it—back in the Enchanted Woods. There are several other entrances as well: beneath an old monastery in Leng, another in the ruins of Sarkomand…”\nIn the Campaign Log for The Dream-Quest (Campaign A), record *the dreamers know of another path*.\nCheck both Campaign Logs.\n*If the Campaign Log for The Dream-Quest (Campaign A) has the black cat is at your side recorded*, cross it off. Remove 1 {elderThing} token from the chaos bags for both campaigns.\n*If the Campaign Log for The Web of Dreams (Campaign B) has the black cat is at your side recorded*, cross it off. Remove 1 {tablet} token from the chaos bags for both campaigns.\n*If neither Campaign Log has the black cat is at your side recorded*, no change is made.",
    "key": "theDreamEaters.flavorText.sharedTheKnowledgeStory",
    "pendingTranslation": true
  },
  "theGreatOnes1": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_The Great Ones 1:_ Following scenario 3–A, the dreamers are on their way to the Cold Wastes wherein lies unknown Kadath…\nYou are nudged out of a sleepless reverie by a furry forehead. You look down to find the black cat peering up at you. “Hey. I see you’ve made some progress.” You’re not quite sure if you would call this progress. Though you are finally on your way to the Cold Wastes, you haven’t pinned down the exact location of unknown Kadath, and you have no idea what to expect when you arrive.\nCheck the Campaign Log for The Dream-Quest (Campaign A). Read the section below that applies to your situation, then proceed to the following text. If no section applies, skip them.",
    "key": "theDreamEaters.flavorText.theGreatOnes1",
    "pendingTranslation": true
  },
  "theGreatOnes1GrowWeaker": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If the dreamers grow weaker:*_\n“Whoa,” the cat says suddenly, “you’re not looking too good, you know.” It gazes up at you with unconcerned but curious eyes. You ask what it means. “You can’t tell? You look sick. You eating enough? Whatever, it doesn’t matter. You can walk, can’t you? That’s good enough.”\nDepending on your difficulty, add a token to the chaos bag for The Dream-Quest (Campaign A), as follows: Easy (–3), Standard (–4), Hard (–5), Expert (–7).",
    "key": "theDreamEaters.flavorText.theGreatOnes1GrowWeaker",
    "pendingTranslation": true
  },
  "theGreatOnes1Searching": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If Randolph did not survive the voyage and the black cat is searching for the truth:*_\n“Where’s what’s-his-name?” the black cat asks, searching for Randolph. You try to explain what happened, but you can barely choke out the words. “Say no more. I get it.” The cat ponders the situation, not seeming to care much about Randolph’s terrible fate. “Well, I guess the thing I was going to say is no longer going to be said,” it riddles.\nIn both Campaign Logs, cross off *the black cat is searching for the truth*.",
    "key": "theDreamEaters.flavorText.theGreatOnes1Searching",
    "pendingTranslation": true
  },
  "theGreatOnes1YouAskedForIt": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If you asked for it:*_\n“Don’t mind me. I just wanted to see if you’re alive.” You begin to tell the black cat of your troubles, and it tilts its head to the side with a look of catlike curiosity. “Huh. That’s funny. Did I say I cared what you had to say? I don’t think I did. Oh well. Let me make it more clear: I only care about whether you’re able to fulfill your duty. I don’t care how you are feeling.” The cat’s glaring eyes never blink. “Well, good luck. You’ll need it.” It bounds off into a shadow and vanishes.\nSkip the rest of this interlude.\nProceed to either _Scenario 4–A: Where the Gods Dwell_ or _Scenario 4–B: Weaver of the Cosmos_.",
    "key": "theDreamEaters.flavorText.theGreatOnes1YouAskedForIt",
    "pendingTranslation": true
  },
  "theGreatOnes1Part2": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "You ask the black cat if it knows what you’ll find in Kadath. “Sort of,” it answers. “I’ve foreseen your arrival in Kadath for some time now. I’ve seen a lot of this, in fact. But it’s…well, it’s not playing out exactly the same way. Or maybe I just didn’t see it the same way. Regardless, I think you’re on the right path. After all, it’s the only path that’s left. I know a little more about what you’ll see when you get there, but I’m afraid that if I tell you, you’ll see it differently, too. Don’t worry about it. You’re doing fine. Get to Kadath. Find the land of the Great Ones. Everything else will fall into place when you arrive. As long as you don’t mess this up. These beings that you face, the ones whose names I do not wish to speak, they don’t just threaten the Dreamlands. They threaten existence itself. Now, if you’ll excuse me, I have somewhere to be.”\nCheck Campaign Log. *If the black cat has a hunch*, it bounds off into the void of space before you get the chance to ask it anything else.\nOtherwise, the black cat offers to pass a message along to your companions. The lead investigator must decide (choose one):Tell your companions about the threats that you face. The black cat will return to you with aid once this message is delivered. This may put an undue burden on your companions. In the Campaign Log for The Dream-Quest (Campaign A), record *the black cat spoke of Nyarlathotep*.\nTell your companions that you will be okay. The black cat will stay with them once this message is delivered. This might make your quest a little more difficult. In the Campaign Log for The Dream-Quest (Campaign A), record *the black cat spoke of Atlach-Nacha*.\n\nProceed to _The Great Ones 2_.",
    "key": "theDreamEaters.flavorText.theGreatOnes1Part2",
    "pendingTranslation": true
  },
  "theGreatOnes2": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_The Great Ones 2:_ Following scenario 3–B, the investigators have reached a cosmic penumbra between worlds…\nA cat’s low-pitched wail draws your attention to a nearby web. When you arrive, you find the black cat stuck on a patch of particularly sticky web, wriggling back and forth in a vain attempt to free itself. Even with its sharp claws, it seems to be in trouble. You lean over and pull the cat free, and it leaps from your arms to a rocky platform below, the only thing between the cat and an endless void. It hisses for a moment, then stands tall. “Did I ask for your help?” it scolds. “Well, you made it below the Sea of Pitch after all. Now look around you. See all this webbing?” You couldn’t miss it even if you tried; you are surrounded on all sides by webs, treacherous pathways across the aether. “It is a bridge between your world and the Dreamlands. If it is completed, the two will merge. Understand? Unless you want everything to look like that hospital where your friends are sleeping, you have to stop this at all costs. Nothing else matters. Nothing.”\nCheck the Campaign Log for The Dream-Quest (Campaign A). Read each section below that applies to your situation, then proceed to the following text. If no section applies, skip them.",
    "key": "theDreamEaters.flavorText.theGreatOnes2",
    "pendingTranslation": true
  },
  "theGreatOnes2TheSilverKey": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If the investigators possess the Silver Key:*_\n“Hey, you still have that key?” the black cat asks. You scrounge through your belongings for the key you found in the Unnamable and show it to the cat. “Gimme that,” it demands, jumping and biting it out of your hands before you can protest. “Don’t look at me like that. Your other friends need it more than you.”\nIn the Campaign Log for The Web of Dreams (Campaign B), cross off *the investigators possess the Silver Key*. Record this in the Campaign Log for The Dream-Quest (Campaign A) instead.\nIf The Silver Key is currently in an investigator’s deck, remove it. Any one investigator in The Dream-Quest (Campaign A) may choose to add The Silver Key to their deck. This card does not count toward that investigator’s deck size.",
    "key": "theDreamEaters.flavorText.theGreatOnes2TheSilverKey",
    "pendingTranslation": true
  },
  "theGreatOnes2Searching": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If the black cat is searching for the truth:*_\nThe black cat stops talking as it spots Randolph for the first time. It circles around the man a few times, agitated. For his part, Randolph looks uncharacteristically perturbed by the cat’s presence, even taking a step backward as it closes in. “What is the matter? I’ve not harmed any of your kind,” he says matter-of-factly. “Have I done something to offend you?”\n“Your mere existence offends me,” the cat replies with a hiss. It strolls back toward you, keeping a wary eye on Randolph. “I think I know what is going on now. It all makes sense. I know who is interfering with my sight. Do not trust that thing,” it warns, circling to keep an eye on the blond man behind it. “I have to prepare. I’ll return when the time is right.”\nSkip the rest of this interlude. In both Campaign Logs, record *the black cat knows the truth*.",
    "key": "theDreamEaters.flavorText.theGreatOnes2Searching",
    "pendingTranslation": true
  },
  "theGreatOnes2Part2": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "“Oh, before I forget: your friends have almost made it to their destination. If everything happens as I have foreseen, they’ll be able to free themselves. In the meantime, they wanted me to let you know…”\nCheck the Campaign Log for The Dream-Quest (Campaign A). Read the section below that applies to your situation.\nOnce the relevant entry has been read, choose and proceed to either _Scenario 4–A: Where the Gods Dwell_ or _Scenario 4–B: Weaver of the Cosmos_.",
    "key": "theDreamEaters.flavorText.theGreatOnes2Part2",
    "pendingTranslation": true
  },
  "theGreatOnes2Nyarlathotep": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If the black cat spoke of Nyarlathotep:*_\n“…the being they face is one with thousands, perhaps an endless number of masks. Nyarlathotep, it is called by some. It is manipulative, deceptive, and cunning. It is probably the thing that trapped them in the Dreamlands to begin with. Why, I have no idea. If you want them to survive, they’re probably going to need my help. You’ll be okay here on your own, right?” The black cat doesn’t wait for an answer; without another word, it leaps into the aether below and vanishes.\nCheck both Campaign Logs.\n*If neither Campaign Log has the black cat is at your side recorded*, in the Campaign Log for The Dream-Quest (Campaign A), record *the black cat is at your side*. Add 1 {elderThing} token to the chaos bags for both campaigns.\n*If the Campaign Log for The Web of Dreams (Campaign B) has the black cat is at your side recorded*, cross it off and record it in the Campaign Log for The Dream-Quest (Campaign A) instead. Replace 1 {tablet} token in each campaign’s chaos bag with 1 {elderThing} token.\n*If the Campaign Log for The Dream-Quest (Campaign A) has the black cat is at your side recorded*, no change is made.",
    "key": "theDreamEaters.flavorText.theGreatOnes2Nyarlathotep",
    "pendingTranslation": true
  },
  "theGreatOnes2AtlachNacha": {
    "group": "interlude3",
    "title": "Interlude III: The Great Ones",
    "text": "_*If the black cat spoke of Atlach-Nacha:*_\n“…that bridge I just mentioned? The creature weaving it is unlike anything you have ever seen. Atlach-Nacha is the name I have heard whispered in the dark corners of the Dreamlands. It is the master and progenitor of all the spiders crawling around these parts. Maybe all parts, really. You’re going to need my help to stop its scheme.”\nCheck both Campaign Logs.\n*If neither Campaign Log has the black cat is at your side recorded*, in the Campaign Log for The Web of Dreams (Campaign B), record *the black cat is at your side*. Add 1 {tablet} token to the chaos bags for both campaigns.\n*If the Campaign Log for The Dream-Quest (Campaign A) has the black cat is at your side recorded*, cross it off and record it in the Campaign Log for The Web of Dreams (Campaign B) instead. Replace 1 {elderThing} token in each campaign’s chaos bag with 1 {tablet} token.\n*If the Campaign Log for The Web of Dreams (Campaign B) has the black cat is at your side recorded*, no change is made.",
    "key": "theDreamEaters.flavorText.theGreatOnes2AtlachNacha",
    "pendingTranslation": true
  }
})

// 幕间选项标签（base.json 的 `label` 段，21 条）
export const TDE_INTERLUDE_LABELS = Object.freeze({
  "theDreamQuest": {
    "text": "The Dream-Quest",
    "key": "theDreamEaters.label.theDreamQuest",
    "pendingTranslation": true
  },
  "theWebOfDreams": {
    "text": "The Web of Dreams",
    "key": "theDreamEaters.label.theWebOfDreams",
    "pendingTranslation": true
  },
  "beyondTheGatesOfSleep": {
    "text": "Beyond the Gates of Sleep",
    "key": "theDreamEaters.label.beyondTheGatesOfSleep",
    "pendingTranslation": true
  },
  "wakingNightmare": {
    "text": "Waking Nightmare",
    "key": "theDreamEaters.label.wakingNightmare",
    "pendingTranslation": true
  },
  "darkSideOfTheMoon": {
    "text": "Dark Side of the Moon",
    "key": "theDreamEaters.label.darkSideOfTheMoon",
    "pendingTranslation": true
  },
  "pointOfNoReturn": {
    "text": "Point of No Return",
    "key": "theDreamEaters.label.pointOfNoReturn",
    "pendingTranslation": true
  },
  "whereTheGodsDwell": {
    "text": "Where the Gods Dwell",
    "key": "theDreamEaters.label.whereTheGodsDwell",
    "pendingTranslation": true
  },
  "weaverOfTheCosmos": {
    "text": "Weaver of the Cosmos",
    "key": "theDreamEaters.label.weaverOfTheCosmos",
    "pendingTranslation": true
  },
  "theSearchForKadath": {
    "text": "The Search for Kadath",
    "key": "theDreamEaters.label.theSearchForKadath",
    "pendingTranslation": true
  },
  "aThousandShapesOfHorror": {
    "text": "A Thousand Shapes of Horror",
    "key": "theDreamEaters.label.aThousandShapesOfHorror",
    "pendingTranslation": true
  },
  "theBlackCat2NewsOfYourPlight": {
    "text": "Tell your companions of your quest, your plight, and your peril.",
    "key": "theDreamEaters.label.theBlackCat2NewsOfYourPlight",
    "pendingTranslation": true
  },
  "theBlackCat2KnowledgeOfDreamlands": {
    "text": "Tell your companions about your new friends and about the Dreamlands.",
    "key": "theDreamEaters.label.theBlackCat2KnowledgeOfDreamlands",
    "pendingTranslation": true
  },
  "theBlackCat2WarnTheOthers": {
    "text": "Tell your companions that they are in danger, and that you are safe.",
    "key": "theDreamEaters.label.theBlackCat2WarnTheOthers",
    "pendingTranslation": true
  },
  "theBlackCat2DontTrust": {
    "text": "You don’t trust this creature one bit.",
    "key": "theDreamEaters.label.theBlackCat2DontTrust",
    "pendingTranslation": true
  },
  "blackCatWandersOff": {
    "text": "The black cat wanders off before you can reply, its pitch-black fur melding into the darkness of the Underworld.",
    "key": "theDreamEaters.label.blackCatWandersOff",
    "pendingTranslation": true
  },
  "youDidNotAskForItRequestAid": {
    "text": "Tell your companions that you are in trouble. The black cat will return to you with aid once this message is delivered. This may put an undue burden on your companions.",
    "key": "theDreamEaters.label.youDidNotAskForItRequestAid",
    "pendingTranslation": true
  },
  "youDidNotAskForItKnowledgeOfUnderworld": {
    "text": "Tell your companions about the Underworld. The black cat will then go elsewhere.",
    "key": "theDreamEaters.label.youDidNotAskForItKnowledgeOfUnderworld",
    "pendingTranslation": true
  },
  "youDidNotAskForItWarnTheOthers": {
    "text": "Tell your companions that you are safe. The black cat will stay with them once this message is delivered. This might make your quest a little more difficult.",
    "key": "theDreamEaters.label.youDidNotAskForItWarnTheOthers",
    "pendingTranslation": true
  },
  "blackCatBoundsOff": {
    "text": "The black cat bounds off into the void of space before you get the chance to ask it anything else.",
    "key": "theDreamEaters.label.blackCatBoundsOff",
    "pendingTranslation": true
  },
  "theGreatOnes1SpokeOfNyarlathotep": {
    "text": "Tell your companions about the threats that you face. The black cat will return to you with aid once this message is delivered. This may put an undue burden on your companions.",
    "key": "theDreamEaters.label.theGreatOnes1SpokeOfNyarlathotep",
    "pendingTranslation": true
  },
  "theGreatOnes1SpokeOfAtlachNacha": {
    "text": "Tell your companions that you will be okay. The black cat will stay with them once this message is delivered. This might make your quest a little more difficult.",
    "key": "theDreamEaters.label.theGreatOnes1SpokeOfAtlachNacha",
    "pendingTranslation": true
  }
})

export const TDE_INTERLUDE_TITLES = Object.freeze({
  1: 'Interlude I: The Black Cat',
  2: 'Interlude II: The Oneironauts',
  3: 'Interlude III: The Great Ones',
})

/** 取一段幕间正文；未知键返回 null（注册期由 validateInterludes 拦下）。 */
export function interludeText(textKey) {
  return TDE_INTERLUDE_TEXT[textKey] || null
}

/** 取一个幕间选项标签；未知键返回 null。 */
export function interludeLabel(labelKey) {
  return TDE_INTERLUDE_LABELS[labelKey] || null
}

/** 幕间正文的 locale 键（`theDreamEaters.flavorText.<key>`）。 */
export function interludeTextKeyOf(name) {
  return `${FLAVOR}.${name}`
}

// ---------------------------------------------------------------------------
// 效果构造器（纯数据；均为 campaign-effects 已注册的 type）
// ---------------------------------------------------------------------------
const record = (part, key, value = true) => ({ type: 'record', part, key, value })
const increment = (part, key, amount = 1) => ({ type: 'increment', part, key, amount })
const chaos = (part, token, amount = 1) => ({ type: 'chaos', part, token, amount })
const experience = amount => ({ type: 'experience', amount })

// 跨线条件：把「某条线的幕间记录」表达成条件数据。`src/campaign/campaign-flow.js` 的
// flowCondition 目前只读活动线 campaign.records；带 part 的条件由 P9.5 的幕间分发器求值。
const hasRecord = (part, key) => ({ hasRecord: { part, key } })
const lacksRecord = (part, key) => ({ not: { hasRecord: { part, key } } })
const allOf = (...conditions) => ({ all: conditions })
const anyOf = (...conditions) => ({ any: conditions })
const noneOf = (...conditions) => ({ not: { any: conditions } })

// 双线同时生效的记录/袋变更（参考实现的 recordInBoth / pushBoth / AddChaosToken 双写）。
const recordBoth = (key, value = true) => [record('A', key, value), record('B', key, value)]
const crossOutBoth = key => [...recordBoth(key, false)]

// 支持的 effect type 白名单：与 `applyCampaignEffect` / `walkCampaign` 的内置分支对齐。
export const INTERLUDE_EFFECT_TYPES = Object.freeze([
  'record', 'increment', 'chaos', 'recordUnion', 'recordRemove', 'experience',
  'privateStory', 'addCampaignCardToDeck', 'log',
])

// ---------------------------------------------------------------------------
// 幕间 I《黑猫》（C:404-483）
// ---------------------------------------------------------------------------
const INTERLUDE_ONE_DUAL = [
  // theBlackCat 是「怎么读」的规则说明（双线或仅 A → 1；仅 B → 3），不是普通叙事。
  { id: 'interlude1', type: 'interlude', textKey: 'theBlackCat', next: 'interlude1.1' },
  { id: 'interlude1.1', type: 'interlude', textKey: 'theBlackCat1', next: 'interlude1.2' },
  {
    id: 'interlude1.2',
    type: 'choice',
    textKey: 'theBlackCat2',
    prompt: 'What shall I tell your friends in the waking world?',
    options: [
      {
        id: 'newsOfYourPlight',
        labelKey: 'theBlackCat2NewsOfYourPlight',
        effects: [record('A', 'theBlackCatDeliveredNewsOfYourPlight')],
        next: 'interlude1.3',
      },
      {
        id: 'knowledgeOfDreamlands',
        labelKey: 'theBlackCat2KnowledgeOfDreamlands',
        effects: [record('A', 'theBlackCatSharedKnowledgeOfTheDreamlands')],
        next: 'interlude1.3',
      },
      {
        id: 'warnTheOthers',
        labelKey: 'theBlackCat2WarnTheOthers',
        effects: [record('A', 'theBlackCatWarnedTheOthers')],
        next: 'interlude1.3',
      },
      {
        id: 'dontTrust',
        labelKey: 'theBlackCat2DontTrust',
        effects: [record('A', 'okayFineHaveItYourWayThen')],
        next: 'interlude1.3',
      },
    ],
  },
  { id: 'interlude1.3', type: 'interlude', textKey: 'theBlackCat3', next: 'interlude1.branch' },
  // I.3 的条件绿字与跨线效果（C:455-481，顺序敏感：hunch → 三种回话之一 → 无匹配）。
  {
    id: 'interlude1.branch',
    type: 'branch',
    branchesMode: 'exclusive',
    options: [
      {
        id: 'sharedKnowledge',
        when: { record: 'theBlackCatSharedKnowledgeOfTheDreamlands', equals: true },
        next: 'interlude1.sharedKnowledge',
      },
      {
        id: 'deliveredNews',
        when: { record: 'theBlackCatDeliveredNewsOfYourPlight', equals: true },
        next: 'interlude1.deliveredNews',
      },
      {
        id: 'warnedTheOthers',
        when: { record: 'theBlackCatWarnedTheOthers', equals: true },
        next: 'interlude1.warnedTheOthers',
      },
      {
        id: 'askedForIt',
        when: { record: 'okayFineHaveItYourWayThen', equals: true },
        next: 'interlude1.askedForIt',
      },
      {
        id: 'none',
        when: noneOf(
          { record: 'theBlackCatSharedKnowledgeOfTheDreamlands', equals: true },
          { record: 'theBlackCatDeliveredNewsOfYourPlight', equals: true },
          { record: 'theBlackCatWarnedTheOthers', equals: true },
          { record: 'okayFineHaveItYourWayThen', equals: true },
        ),
        next: null,
      },
    ],
  },
  {
    id: 'interlude1.sharedKnowledge',
    type: 'interlude',
    textKey: 'theBlackCatSharedKnowledgeOfTheDreamlands',
    effects: [...recordBoth('theBlackCatHasAHunch')],
    next: null,
  },
  {
    id: 'interlude1.deliveredNews',
    type: 'interlude',
    textKey: 'theBlackCatDeliveredNewsOfYourPlight',
    effects: [
      record('A', 'theBlackCatIsAtYourSide'),
      chaos('A', 'elderthing'), chaos('B', 'elderthing'),
    ],
    next: null,
  },
  {
    id: 'interlude1.warnedTheOthers',
    type: 'interlude',
    textKey: 'theBlackCatWarnedTheOthers',
    effects: [
      record('B', 'theBlackCatIsAtYourSide'),
      chaos('B', 'tablet'), chaos('A', 'tablet'),
    ],
    next: null,
  },
  {
    id: 'interlude1.askedForIt',
    type: 'interlude',
    textKey: 'okayFineHaveItYourWayThen',
    effects: [...recordBoth('youAskedForIt')],
    next: null,
  },
]

const INTERLUDE_ONE_SINGLE_A = [
  { id: 'interlude1', type: 'interlude', textKey: 'theBlackCat', next: 'interlude1.1' },
  // 仅 A：读完 The Black Cat 1 直接进 2-A（C:410-415）。
  { id: 'interlude1.1', type: 'interlude', textKey: 'theBlackCat1', next: null },
]

const INTERLUDE_ONE_SINGLE_B = [
  { id: 'interlude1', type: 'interlude', textKey: 'theBlackCat', next: 'interlude1.3' },
  // 仅 B：跳过 1/2，直接读 The Black Cat 3 + youAreOnYourOwn 绿字（C:407、C:455-457）。
  { id: 'interlude1.3', type: 'interlude', textKey: 'theBlackCat3', next: 'interlude1.youAreOnYourOwn' },
  {
    id: 'interlude1.youAreOnYourOwn',
    type: 'interlude',
    textKey: 'youAreOnYourOwn',
    effects: [record('B', 'youAreOnYourOwn')],
    next: null,
  },
]

// ---------------------------------------------------------------------------
// 幕间 II《入梦者》（C:484-610）
// ---------------------------------------------------------------------------
const INTERLUDE_TWO_DUAL = [
  { id: 'interlude2', type: 'interlude', textKey: 'theOneironauts1', next: 'interlude2.hunch' },
  // wheresBlondie：B 线有 hasAHunch、且 B 线 Randolph 未生还 → 绿字 + 双线划掉 hasAHunch（C:494-499）。
  {
    id: 'interlude2.hunch',
    type: 'branch',
    options: [
      {
        id: 'wheresBlondie',
        when: allOf({ record: 'theBlackCatHasAHunch', equals: true }, { record: 'randolphDidNotSurviveTheDescent', equals: true }),
        next: 'interlude2.wheresBlondie',
      },
      {
        id: 'skip',
        when: { not: allOf({ record: 'theBlackCatHasAHunch', equals: true }, { record: 'randolphDidNotSurviveTheDescent', equals: true }) },
        next: 'interlude2.askedForIt',
      },
    ],
  },
  {
    id: 'interlude2.wheresBlondie',
    type: 'interlude',
    textKey: 'wheresBlondie',
    effects: [...crossOutBoth('theBlackCatHasAHunch')],
    next: 'interlude2.askedForIt',
  },
  // youAskedForIt：真 → 绿字并直接跳到 II.4（由 gate 选下一章），跳过 A 侧与 B 侧其余（C:501-527）。
  {
    id: 'interlude2.askedForIt',
    type: 'branch',
    options: [
      { id: 'askedForIt', when: { record: 'youAskedForIt', equals: true }, next: 'interlude2.skipped' },
      { id: 'notAskedForIt', when: { not: { record: 'youAskedForIt', equals: true } }, next: 'interlude2.1' },
    ],
  },
  { id: 'interlude2.skipped', type: 'interlude', textKey: 'youAskedForIt', next: null },
  // II.1 的 3 选 1 全部写 B 线；若 hasAHunch 则只有「黑猫走开」一个选项（C:508-526）。
  {
    id: 'interlude2.1',
    type: 'choice',
    textKey: 'youDidNotAskForIt',
    prompt: 'What message should the black cat carry to your companions?',
    options: [
      {
        id: 'blackCatWandersOff',
        labelKey: 'blackCatWandersOff',
        when: { record: 'theBlackCatHasAHunch', equals: true },
        next: 'interlude2.2',
      },
      {
        id: 'requestAid',
        labelKey: 'youDidNotAskForItRequestAid',
        when: { not: { record: 'theBlackCatHasAHunch', equals: true } },
        effects: [record('B', 'theBlackCatRequestedAidFromTheOthers')],
        next: 'interlude2.2',
      },
      {
        id: 'knowledgeOfUnderworld',
        labelKey: 'youDidNotAskForItKnowledgeOfUnderworld',
        when: { not: { record: 'theBlackCatHasAHunch', equals: true } },
        effects: [record('B', 'theBlackCatSharedKnowledgeOfTheUnderworld')],
        next: 'interlude2.2',
      },
      {
        id: 'warnTheOthers',
        labelKey: 'youDidNotAskForItWarnTheOthers',
        when: { not: { record: 'theBlackCatHasAHunch', equals: true } },
        effects: [record('B', 'theBlackCatWarnedTheOthers')],
        next: 'interlude2.2',
      },
    ],
  },
  {
    id: 'interlude2.2',
    type: 'interlude',
    textKey: 'theOneironauts2',
    next: 'interlude2.searching',
    // A 侧被俘状况的两段条件绿字（C:532-539）：按逐调查员 wasCaptured 集合分「至少一人未被俘」/「全员被俘」。
    greens: [
      {
        textKey: 'atLeastOneNotCaptured',
        when: { capturedInvestigators: 'someNotCaptured', part: 'A' },
        pendingEngine: true,
      },
      {
        textKey: 'allCaptured',
        when: { capturedInvestigators: 'allCaptured', part: 'A' },
        pendingEngine: true,
      },
    ],
  },
  // searchingForTheTruth：hasAHunch(A) && randolphEludedCapture(A) → 双线记录 + 直接跳过（C:541-549）。
  {
    id: 'interlude2.searching',
    type: 'branch',
    options: [
      {
        id: 'searching',
        when: { record: 'theBlackCatIsSearchingForTheTruth', equals: true },
        next: 'interlude2.searchingStory',
      },
      {
        id: 'continue',
        when: { not: { record: 'theBlackCatIsSearchingForTheTruth', equals: true } },
        next: 'interlude2.3',
      },
    ],
  },
  {
    id: 'interlude2.searchingStory',
    type: 'interlude',
    textKey: 'searchingForTheTruth',
    effects: [...recordBoth('theBlackCatIsSearchingForTheTruth')],
    next: null,
  },
  { id: 'interlude2.3', type: 'interlude', textKey: 'nowWhereWasI', next: 'interlude2.3.branch' },
  {
    id: 'interlude2.3.branch',
    type: 'branch',
    options: [
      {
        id: 'requestedAid',
        when: { record: 'theBlackCatRequestedAidFromTheOthers', equals: true },
        next: 'interlude2.3.requestedAid',
      },
      {
        id: 'warnedTheOthers',
        when: { record: 'theBlackCatWarnedTheOthers', equals: true },
        next: 'interlude2.3.warnedTheOthers',
      },
      {
        id: 'sharedKnowledge',
        when: { record: 'theBlackCatSharedKnowledgeOfTheUnderworld', equals: true },
        next: 'interlude2.3.sharedKnowledge',
      },
      {
        id: 'none',
        when: noneOf(
          { record: 'theBlackCatRequestedAidFromTheOthers', equals: true },
          { record: 'theBlackCatWarnedTheOthers', equals: true },
          { record: 'theBlackCatSharedKnowledgeOfTheUnderworld', equals: true },
        ),
        next: null,
      },
    ],
  },
  // ① requestedAid（C:559-569）：三选一，跨线读写 AtYourSide 与两种 token。
  {
    id: 'interlude2.3.requestedAid',
    type: 'interlude',
    textKey: 'theBlackCatRequestedAidFromTheOthers',
    next: null,
    branchesMode: 'exclusive',
    pendingEngine: true,
    branches: [
      {
        when: allOf(lacksRecord('A', 'theBlackCatIsAtYourSide'), lacksRecord('B', 'theBlackCatIsAtYourSide')),
        then: [
          record('B', 'theBlackCatIsAtYourSide'),
          chaos('A', 'tablet'), chaos('B', 'tablet'),
        ],
      },
      {
        when: hasRecord('A', 'theBlackCatIsAtYourSide'),
        then: [
          record('A', 'theBlackCatIsAtYourSide', false),
          record('B', 'theBlackCatIsAtYourSide'),
          chaos('A', 'elderthing', -1), chaos('A', 'tablet'),
          chaos('B', 'elderthing', -1), chaos('B', 'tablet'),
        ],
      },
      { when: hasRecord('B', 'theBlackCatIsAtYourSide'), then: [] },
    ],
  },
  // ② warnedTheOthers（C:571-580）。
  {
    id: 'interlude2.3.warnedTheOthers',
    type: 'interlude',
    textKey: 'warnedTheOthersStory',
    next: null,
    branchesMode: 'exclusive',
    pendingEngine: true,
    branches: [
      {
        when: allOf(lacksRecord('A', 'theBlackCatIsAtYourSide'), lacksRecord('B', 'theBlackCatIsAtYourSide')),
        then: [
          record('A', 'theBlackCatIsAtYourSide'),
          chaos('A', 'elderthing'), chaos('B', 'elderthing'),
        ],
      },
      {
        when: hasRecord('B', 'theBlackCatIsAtYourSide'),
        then: [
          record('B', 'theBlackCatIsAtYourSide', false),
          record('A', 'theBlackCatIsAtYourSide'),
          chaos('A', 'tablet', -1), chaos('A', 'elderthing'),
          chaos('B', 'tablet', -1), chaos('B', 'elderthing'),
        ],
      },
      { when: hasRecord('A', 'theBlackCatIsAtYourSide'), then: [] },
    ],
  },
  // ③ sharedKnowledge（C:582-592）：先无条件写 A 线「另一条路」，再两条独立的条件划掉+移除。
  {
    id: 'interlude2.3.sharedKnowledge',
    type: 'interlude',
    textKey: 'sharedTheKnowledgeStory',
    next: null,
    effects: [record('A', 'theDreamersKnowOfAnotherPath')],
    branchesMode: 'independent',
    pendingEngine: true,
    branches: [
      {
        when: hasRecord('A', 'theBlackCatIsAtYourSide'),
        then: [
          record('A', 'theBlackCatIsAtYourSide', false),
          chaos('A', 'elderthing', -1), chaos('B', 'elderthing', -1),
        ],
      },
      {
        when: hasRecord('B', 'theBlackCatIsAtYourSide'),
        then: [
          record('B', 'theBlackCatIsAtYourSide', false),
          chaos('A', 'tablet', -1), chaos('B', 'tablet', -1),
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// 幕间 III《伟大的存在》（C:611-735）
// ---------------------------------------------------------------------------
const INTERLUDE_THREE_DUAL = [
  {
    id: 'interlude3',
    type: 'interlude',
    textKey: 'theGreatOnes1',
    next: 'interlude3.route',
    // ① 弱化 → 按难度给 A 袋加 −3/−4/−5/−7（C:616-622）；② 双线划掉 searching（C:624-632）。
    greens: [
      {
        textKey: 'theGreatOnes1GrowWeaker',
        when: hasRecord('A', 'theDreamersGrowWeaker'),
        pendingEngine: true,
        pendingEffects: [{
          op: 'chaosByDifficulty',
          part: 'A',
          tokenByDifficulty: { easy: '-3', standard: '-4', hard: '-5', expert: '-7' },
        }],
      },
      {
        textKey: 'theGreatOnes1Searching',
        when: allOf(
          hasRecord('A', 'randolphCarterDidNotSurviveTheVoyage'),
          hasRecord('A', 'theBlackCatIsSearchingForTheTruth'),
        ),
        pendingEngine: true,
        effects: [...crossOutBoth('theBlackCatIsSearchingForTheTruth')],
      },
    ],
  },
  // ③ youAskedForIt → 绿字并直接跳到 III.3（下一章由 gate 选）；否则 2 选 1（C:634-658）。
  {
    id: 'interlude3.route',
    type: 'branch',
    options: [
      { id: 'youAskedForIt', when: { record: 'youAskedForIt', equals: true }, next: 'interlude3.youAskedForIt' },
      { id: 'continue', when: { not: { record: 'youAskedForIt', equals: true } }, next: 'interlude3.1' },
    ],
  },
  { id: 'interlude3.youAskedForIt', type: 'interlude', textKey: 'theGreatOnes1YouAskedForIt', next: null },
  {
    id: 'interlude3.1',
    type: 'choice',
    textKey: 'theGreatOnes1Part2',
    prompt: 'What message should the black cat carry to your companions?',
    options: [
      {
        id: 'blackCatBoundsOff',
        labelKey: 'blackCatBoundsOff',
        when: { record: 'theBlackCatHasAHunch', equals: true },
        next: 'interlude3.2',
      },
      {
        id: 'spokeOfNyarlathotep',
        labelKey: 'theGreatOnes1SpokeOfNyarlathotep',
        when: { not: { record: 'theBlackCatHasAHunch', equals: true } },
        effects: [record('A', 'theBlackCatSpokeOfNyarlathotep')],
        next: 'interlude3.2',
      },
      {
        id: 'spokeOfAtlachNacha',
        labelKey: 'theGreatOnes1SpokeOfAtlachNacha',
        when: { not: { record: 'theBlackCatHasAHunch', equals: true } },
        effects: [record('A', 'theBlackCatSpokeOfAtlachNacha')],
        next: 'interlude3.2',
      },
    ],
  },
  { id: 'interlude3.2', type: 'interlude', textKey: 'theGreatOnes2', next: 'interlude3.silverKey' },
  // III.2：B 线持有银钥匙 → 移交 A 线 + 入 A 线牌库（C:659-678）；否则直接 III.22。
  {
    id: 'interlude3.silverKey',
    type: 'branch',
    options: [
      {
        id: 'possessSilverKey',
        when: { record: 'theInvestigatorsPossessTheSilverKey', equals: true },
        next: 'interlude3.silverKeyStory',
      },
      {
        id: 'otherwise',
        when: { not: { record: 'theInvestigatorsPossessTheSilverKey', equals: true } },
        next: 'interlude3.searching',
      },
    ],
  },
  {
    id: 'interlude3.silverKeyStory',
    type: 'story',
    textKey: 'theGreatOnes2TheSilverKey',
    effects: [
      record('B', 'theInvestigatorsPossessTheSilverKey', false),
      record('A', 'theInvestigatorsPossessTheSilverKey'),
      { type: 'addCampaignCardToDeck', code: '06189', seat: 0, part: 'A', reason: 'theGreatOnes2' },
    ],
    pendingEngine: true,
    pendingEffects: [{
      op: 'removeCampaignCard',
      part: 'B',
      code: '06189',
      note: 'campaign-effects 没有「从另一线牌库移除战役卡」的 type；A 线由 addCampaignCardToDeck 加入。',
    }],
    next: 'interlude3.searching',
  },
  // III.22：A 线搜查真相 → 绿字 + 双线记录 knowsTruth；否则 theGreatOnes2Part2 + 两条线传闻分支。
  {
    id: 'interlude3.searching',
    type: 'branch',
    options: [
      {
        id: 'searching',
        when: { record: 'theBlackCatIsSearchingForTheTruth', equals: true },
        next: 'interlude3.searchingStory',
      },
      {
        id: 'continue',
        when: { not: { record: 'theBlackCatIsSearchingForTheTruth', equals: true } },
        next: 'interlude3.3',
      },
    ],
  },
  {
    id: 'interlude3.searchingStory',
    type: 'interlude',
    textKey: 'theGreatOnes2Searching',
    effects: [...recordBoth('theBlackCatKnowsTheTruth')],
    next: null,
  },
  { id: 'interlude3.3', type: 'interlude', textKey: 'theGreatOnes2Part2', next: 'interlude3.spoke' },
  {
    id: 'interlude3.spoke',
    type: 'branch',
    options: [
      {
        id: 'nyarlathotep',
        when: { record: 'theBlackCatSpokeOfNyarlathotep', equals: true },
        next: 'interlude3.nyarlathotep',
      },
      {
        id: 'atlachNacha',
        when: { record: 'theBlackCatSpokeOfAtlachNacha', equals: true },
        next: 'interlude3.atlachNacha',
      },
      {
        id: 'none',
        when: noneOf(
          { record: 'theBlackCatSpokeOfNyarlathotep', equals: true },
          { record: 'theBlackCatSpokeOfAtlachNacha', equals: true },
        ),
        next: null,
      },
    ],
  },
  // ① 提到奈亚拉托提普（C:693-704）：三选一，跨线 AtYourSide 与两种 token。
  {
    id: 'interlude3.nyarlathotep',
    type: 'interlude',
    textKey: 'theGreatOnes2Nyarlathotep',
    next: null,
    branchesMode: 'exclusive',
    pendingEngine: true,
    branches: [
      {
        when: allOf(lacksRecord('A', 'theBlackCatIsAtYourSide'), lacksRecord('B', 'theBlackCatIsAtYourSide')),
        then: [
          record('A', 'theBlackCatIsAtYourSide'),
          chaos('A', 'elderthing'), chaos('B', 'elderthing'),
        ],
      },
      {
        when: hasRecord('B', 'theBlackCatIsAtYourSide'),
        then: [
          record('B', 'theBlackCatIsAtYourSide', false),
          record('A', 'theBlackCatIsAtYourSide'),
          chaos('A', 'tablet', -1), chaos('A', 'elderthing'),
          chaos('B', 'tablet', -1), chaos('B', 'elderthing'),
        ],
      },
      { when: hasRecord('A', 'theBlackCatIsAtYourSide'), then: [] },
    ],
  },
  // ② 提到阿特拉克·纳克亚（C:706-717）。
  {
    id: 'interlude3.atlachNacha',
    type: 'interlude',
    textKey: 'theGreatOnes2AtlachNacha',
    next: null,
    branchesMode: 'exclusive',
    pendingEngine: true,
    branches: [
      {
        when: allOf(lacksRecord('A', 'theBlackCatIsAtYourSide'), lacksRecord('B', 'theBlackCatIsAtYourSide')),
        then: [
          record('B', 'theBlackCatIsAtYourSide'),
          chaos('A', 'tablet'), chaos('B', 'tablet'),
        ],
      },
      {
        when: hasRecord('A', 'theBlackCatIsAtYourSide'),
        then: [
          record('A', 'theBlackCatIsAtYourSide', false),
          record('B', 'theBlackCatIsAtYourSide'),
          chaos('A', 'elderthing', -1), chaos('A', 'tablet'),
          chaos('B', 'elderthing', -1), chaos('B', 'tablet'),
        ],
      },
      { when: hasRecord('B', 'theBlackCatIsAtYourSide'), then: [] },
    ],
  },
]

// ---------------------------------------------------------------------------
// 可序列化节点模板：`{ 幕间号: { dual / singleA / singleB: [节点…] } }`
// 末节点 / 选项的 `next: null` 表示「接回 partFlow 原 interlude 节点的出口」。
// ---------------------------------------------------------------------------
export const TDE_INTERLUDE_NODES = Object.freeze({
  1: Object.freeze({
    dual: Object.freeze(INTERLUDE_ONE_DUAL),
    singleA: Object.freeze(INTERLUDE_ONE_SINGLE_A),
    singleB: Object.freeze(INTERLUDE_ONE_SINGLE_B),
  }),
  2: Object.freeze({ dual: Object.freeze(INTERLUDE_TWO_DUAL) }),
  3: Object.freeze({ dual: Object.freeze(INTERLUDE_THREE_DUAL) }),
})

/** 各幕间在哪些模式下被挂载（单线只有幕间 I）。 */
export const TDE_INTERLUDE_MODES = Object.freeze({
  1: Object.freeze(['singleA', 'singleB', 'pick', 'parallel']),
  2: Object.freeze(['pick', 'parallel']),
  3: Object.freeze(['pick', 'parallel']),
})

export const TDE_INTERLUDE_IDS = Object.freeze(['interlude1', 'interlude2', 'interlude3'])
export const TDE_INTERLUDE_GROUPS = Object.freeze(['interlude1', 'interlude2', 'interlude3'])

function variantOf(mode) {
  return mode === 'singleA' ? 'singleA' : mode === 'singleB' ? 'singleB' : 'dual'
}

function interludeNumberOf(nodeId) {
  const match = /^interlude(\d)/.exec(String(nodeId))
  return match ? Number(match[1]) : null
}

function instantiateNode(template, { originalNext, title, number = null }) {
  const node = structuredClone(template)
  // 文本：节点引用 flavorText 键，实例化时补英文原文 + 标题 + 未译标记。
  if (node.textKey) {
    const source = TDE_INTERLUDE_TEXT[node.textKey]
    node.text = source?.text || ''
    node.title = title
    node.textSource = `${FLAVOR}.${node.textKey}`
    node.pendingTranslation = true
  }
  // P8-T 的 story-text.js 按 `interludes.interlude<n>` 段落保存正文；节点只带位置键，
  // 文本为空时 UI 退回节点自带的英文原文。
  if (number) node.storySection = `interludes.interlude${number}`
  if (node.greens) {
    node.greens = node.greens.map(green => ({
      ...structuredClone(green),
      text: TDE_INTERLUDE_TEXT[green.textKey]?.text || '',
      textSource: `${FLAVOR}.${green.textKey}`,
      pendingTranslation: true,
    }))
  }
  if (node.next === null || node.next === undefined) node.next = originalNext
  if (node.options) {
    node.options = node.options.map(option => {
      const copy = structuredClone(option)
      if (copy.labelKey) {
        copy.label = TDE_INTERLUDE_LABELS[copy.labelKey]?.text || copy.labelKey
        copy.labelSource = `${LABEL}.${copy.labelKey}`
        copy.pendingTranslation = true
      }
      if (copy.next === null || copy.next === undefined) copy.next = originalNext
      return copy
    })
  }
  return node
}

/** 把节点子图里指向 `from` 的引用改到 `to`（用于单线删掉幕间 II/III）。 */
function rewireReferences(nodes, from, to) {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.next === from) nodes[id] = { ...node, next: to }
    if (Array.isArray(node.options)) {
      nodes[id] = {
        ...nodes[id],
        options: nodes[id].options.map(option => (option.next === from ? { ...option, next: to } : option)),
      }
    }
  }
}

/**
 * 把 `partFlow(...)` 生成的 `interlude1/2/3` 占位节点替换成完整幕间子图。
 *
 * @param {{start:string, nodes:object}} flow  `dualPartFlow` / `singlePartFlow` 的输出
 * @param {{mode?:'singleA'|'singleB'|'pick'|'parallel'}} options
 * @returns {{start:string, nodes:object}} 新 flow（不修改入参）
 */
export function attachInterludes(flow, { mode = 'pick' } = {}) {
  if (!flow?.nodes) throw new Error('attachInterludes 需要一个 flow 对象')
  // 已经挂过幕间（存在子节点）时原样返回，避免重复接线把末节点出口接回自身。
  if (flow.nodes.interlude1 && flow.nodes['interlude1.1']) return flow
  const variant = variantOf(mode)
  const nodes = { ...flow.nodes }
  // 倒序替换：先删 3 再删 2，引用改写在删除时同步完成。
  for (const number of [3, 2, 1]) {
    const entryId = `interlude${number}`
    const original = nodes[entryId]
    if (!original) continue
    const originalNext = original.next ?? null
    const templates = TDE_INTERLUDE_NODES[number]?.[variant]
    if (!templates) {
      // 单线：参考实现不经过该幕间，直接以「上一节点 → 下一节点」跳过。
      delete nodes[entryId]
      rewireReferences(nodes, entryId, originalNext)
      continue
    }
    const title = TDE_INTERLUDE_TITLES[number]
    delete nodes[entryId]
    for (const template of templates) {
      nodes[template.id] = instantiateNode(template, { originalNext, title, number })
    }
  }
  return { start: flow.start, nodes }
}

/** 某模式下会被挂载的幕间号（单线只有 1）。 */
export function interludesForMode(mode) {
  const variant = variantOf(mode)
  return Object.keys(TDE_INTERLUDE_NODES)
    .map(Number)
    .filter(number => Boolean(TDE_INTERLUDE_NODES[number]?.[variant]))
}

/** 实例化某模式下的全部幕间节点（测试/调试用；不接线）。 */
export function interludeFlowNodes(mode = 'pick') {
  const variant = variantOf(mode)
  const list = []
  for (const number of interludesForMode(mode)) {
    for (const template of TDE_INTERLUDE_NODES[number][variant]) {
      list.push(instantiateNode(template, { originalNext: null, title: TDE_INTERLUDE_TITLES[number], number }))
    }
  }
  return list
}

const EFFECT_KEYS = new Set(INTERLUDE_EFFECT_TYPES)

function collectEffects(node) {
  const effects = [...(node.effects || []), ...(node.greens || []).flatMap(green => green.effects || [])]
  for (const option of node.options || []) effects.push(...(option.effects || []))
  for (const branch of node.branches || []) effects.push(...(branch.then || []))
  return effects
}

/**
 * 注册期/测试用自检：
 *   · 每个 textKey / labelKey 都能在 TDE_INTERLUDE_TEXT / TDE_INTERLUDE_LABELS 里找到；
 *   · effects 只用 campaign-effects 已注册的 type；
 *   · choice / branch 节点有选项，选项 id 唯一，next 指向存在的节点或 null；
 *   · 模板 id 全局唯一（跨模式共享 id 但每个模式内唯一即可）。
 * 返回 `{ ok, problems }`，不抛错。
 */
export function validateInterludes() {
  const problems = []
  for (const [number, groups] of Object.entries(TDE_INTERLUDE_NODES)) {
    for (const [variant, templates] of Object.entries(groups)) {
      const ids = new Set(templates.map(template => template.id))
      if (ids.size !== templates.length) problems.push(`幕间 ${number}/${variant} 存在重复节点 id`)
      for (const template of templates) {
        if (template.textKey && !TDE_INTERLUDE_TEXT[template.textKey]) {
          problems.push(`幕间 ${number}/${variant} 缺少正文：${template.textKey}`)
        }
        for (const green of template.greens || []) {
          if (!TDE_INTERLUDE_TEXT[green.textKey]) problems.push(`幕间 ${number}/${variant} 缺少绿字正文：${green.textKey}`)
        }
        if (['choice', 'branch'].includes(template.type) && !(template.options || []).length) {
          problems.push(`幕间 ${number}/${variant} 的 ${template.id} 没有选项`)
        }
        const optionIds = new Set()
        for (const option of template.options || []) {
          if (optionIds.has(option.id)) problems.push(`幕间 ${number}/${variant} 的 ${template.id} 选项重复：${option.id}`)
          optionIds.add(option.id)
          if (option.labelKey && !TDE_INTERLUDE_LABELS[option.labelKey]) {
            problems.push(`幕间 ${number}/${variant} 缺少选项标签：${option.labelKey}`)
          }
          if (typeof option.next === 'string' && option.next.startsWith('interlude') && !ids.has(option.next)
            && !TDE_INTERLUDE_NODES[interludeNumberOf(option.next)]?.[variant]?.some(item => item.id === option.next)) {
            problems.push(`幕间 ${number}/${variant} 的 ${template.id} 选项出口不存在：${option.next}`)
          }
        }
        if (typeof template.next === 'string' && template.next.startsWith('interlude') && !ids.has(template.next)) {
          problems.push(`幕间 ${number}/${variant} 的 ${template.id} 出口不存在：${template.next}`)
        }
        for (const effect of collectEffects(template)) {
          if (!EFFECT_KEYS.has(effect.type)) problems.push(`幕间 ${number}/${variant} 的 ${template.id} 未注册效果类型：${effect.type}`)
        }
      }
    }
  }
  return { ok: problems.length === 0, problems }
}

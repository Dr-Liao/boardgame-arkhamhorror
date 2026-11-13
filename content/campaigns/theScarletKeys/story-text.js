// 绯红密钥（The Scarlet Keys）· 剧情正文生成物（P7）。
//
// 本文件由 `node tools/import-tsk-story.mjs --write` 生成，请勿手改；改源后重跑并 --check。
// 来源：参考工程 en/zh locale（frontend/src/locales/{en,zh}/theScarletKeys）；
// 中文逐键取自 zh locale，缺失/未译叶子在 chineseGaps/summary 上显式标记（不冒充官方中文）。
//
// 结构：campaign（序章/幕间 I/启程与旅行/世界地图密档/状况报告/支线幕间/尾声/特别规则）·
//   chapters（10 章，按世界地图到达章节）· keys（base.json 顶层段落，供流程直接读取）。

export const TSK_STORY_META = {
  "status": "generated",
  "stage": "P7-story",
  "sourceKind": "reference-project-zh-locale",
  "officialChinese": false,
  "note": "中文正文优先参考工程 zh locale；缺失/未译叶子在 chineseGaps 与各章 summary 上显式标记，展示层回退英文但不冒充中文。",
  "generator": "tools/import-tsk-story.mjs",
  "generatedFrom": "参考资源/ArkhamHorror-main/frontend/src/locales",
  "sources": [
    {
      "path": "content/campaigns/theScarletKeys/locale-supplement/campaign.json",
      "entries": 19
    },
    {
      "path": "content/campaigns/theScarletKeys/locale-supplement/chapters-a.json",
      "entries": 26
    },
    {
      "path": "content/campaigns/theScarletKeys/locale-supplement/chapters-b.json",
      "entries": 9
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/base.json",
      "sha256": "129bc1039ea5d9815dc032aa00be52ee790cb9cee4f930b2721a4aded00e43d4"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/riddlesAndRain.json",
      "sha256": "8a070c0db992d0380ca634759673c8ba9724c8d3b718758478f4d64ed6ad4c7d"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/deadHeat.json",
      "sha256": "e690c25b39c3185d18910b5e04898e0088098ebf3c92485068e34811e51e663b"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/sanguineShadows.json",
      "sha256": "6fa7022cce492c704241fd3d5686858feb86bb6be14ff877878d2cfb25d965d2"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/dealingsInTheDark.json",
      "sha256": "555e4e95ab673e340679009b012d7f309373a6d1d3f65f96ff12a08b402e6029"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/dancingMad.json",
      "sha256": "111369b4ae3a44cb09b7e2ca0a2f78f7f15774ca3df6d4340ea2859dbf7a1fb5"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/onThinIce.json",
      "sha256": "027857d7c6c77eca13b70e5b219afa3108905f3a4b02a2c5967230452091382b"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/dogsOfWar.json",
      "sha256": "3dd3c445f32c39419105c519bb6bcab00d5bf438ae858dd6e061bbe5b8d0d762"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/shadesOfSuffering.json",
      "sha256": "da1c839197e6a5a90ad277cab5622377a1794c7bb62f9c5d34160052278822e7"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/withoutATrace.json",
      "sha256": "d9ebb9ed384a0e7f0ce7f7bf819c5a269adaddc51f824f167a57293a691fdcc8"
    },
    {
      "path": "frontend/src/locales/en/theScarletKeys/scenarios/congressOfTheKeys.json",
      "sha256": "dc78f35dbc14a5e23f3e8a0b7059116fc6af3b004e9af817c60db56e035ec443"
    }
  ],
  "zhSupplement": {
    "path": "content/campaigns/theScarletKeys/locale-supplement",
    "files": [
      {
        "name": "campaign.json",
        "entries": 19
      },
      {
        "name": "chapters-a.json",
        "entries": 26
      },
      {
        "name": "chapters-b.json",
        "entries": 9
      }
    ]
  },
  "counts": {
    "chapters": 10,
    "campaignLeaves": 458,
    "chapterLeaves": 677,
    "chineseGaps": 0
  }
}

export const TSK_STORY_TEXT = {
  "campaign": {
    "file": "base.json",
    "sectionsEn": {
      "specialRules": [
        {
          "title": "New Cardtype: Keys",
          "body": "<p class='basic'>The Scarlet Keys campaign features a new cardtype: keys. Keys are powerful artifacts that may be “shifted” to either aid or hinder investigators, depending on whom they are attached to and whether their Stable or Unstable side is faceup.</p><ul><li>During the resolution of a scenario, a key may become bound to a single bearer, whose name is marked in the Campaign Log. A key may be bound to an investigator, a story asset, or an enemy.</li><li>A key always enters play attached to its bearer (as marked in the Campaign Log). At the start of each scenario, each investigator who is the bearer of 1 or more keys attaches those keys to their investigator card. Whenever a story asset or enemy enters play, if it is the bearer of 1 or more keys, those keys also enter play attached to their bearer.<ul><li>If a key’s bearer is an investigator or a story asset, it enters play Stable side faceup.</li><li>If a key’s bearer is an enemy, it enters play Unstable side faceup.</li></ul></li><li>A key cannot leave play unless its bearer leaves play. If the bearer of 1 or more keys leaves play, each key they control is set aside, out of play. (Those keys do, however, remain bound to their bearer for future scenarios unless explicitly noted otherwise.)</li><li>While a key is attached to an investigator, that investigator may trigger its shift ability during any player window as a {'{'}fast{'}'} ability. This is called “shifting” the key. As part of this ability’s resolution, it will instruct the investigator to flip the key to its other side, so its other shift ability is active. The investigator will then have to perform the shift ability on its Unstable side in order to flip it back over again.<ul><li>While a key is attached to a story asset, it may be shifted by any investigator who controls that asset in the same way.</li><li>Each key (by title) attached to an investigator or story asset can only be shifted once per round.</li></ul></li><li>While a key is under an enemy’s control, its shift ability only resolves when a card or game effect instructs an investigator to shift that key, after which it remains Unstable side faceup.<ul><li>A key attached to an enemy cannot be flipped to its Stable side.</li><li>There is no limit to the number of times a key attached to an enemy can be shifted.</li></ul></li><li>Some card effects may directly flip a key attached to an investigator or story asset from its Stable side to its Unstable side, or vice versa. This is not the same as shifting a key, and does not resolve its shift ability.</li></ul>"
        },
        {
          "title": "The Red-Gloved Man",
          "body": "<p class='basic'>During The Scarlet Keys campaign, investigators will confront a number of dangerous and mysterious members of the secret society known as the Red Coterie. One such member is the iconic Red-Gloved Man. As a result, while playing The Scarlet Keys campaign, investigators cannot purchase or include The Red-Gloved Man asset (The Dunwich Legacy card #310) in their decks.</p>"
        },
        {
          "title": "Concealed X",
          "body": "<p class='basic'>Concealed X is a keyword that appears on some enemy cards in The Scarlet Keys campaign. Concealed enemies represent hidden enemies whose true location is a mystery until the investigators work to expose where—and in some cases, who—they truly are.</p><p class='basic'>When a scenario includes one or more concealed enemies, investigators are instructed to set aside several concealed mini-cards. These mini-cards are double-sided. The facedown side represents the possible location of a concealed enemy. The revealed side reveals the mini-card’s true nature—an enemy’s true location, or simply a decoy. An enemy’s mini-card marks the location of an enemy in the shadows. A decoy marks the location of nothing of consequence—a harmless bystander, or perhaps just a trick of the light.</p><p class='basic'>When an investigator draws an enemy with the concealed X keyword (or is instructed to resolve an enemy’s concealed keyword), they spawn that enemy into a game area above the agenda deck, not at any location. This area is called “the shadows,” and represents enemies the investigators know exist somewhere on the map, but are unsure where. Then, that investigator takes the set-aside concealed mini-card that matches that enemy, along with X decoys (where X is defined by that enemy’s concealed X value), shuffles them facedown, and puts them into play distributed as evenly as possible among each location in play, starting with the locations nearest to them. Then, at each of those locations that already had 1 or more concealed mini-cards, they shuffle each of them facedown as well.</p><p>*For example: Amina draws Coterie Agent (A), which has “concealed 2.” She first spawns the Coterie Agent into the shadows. Then, she takes the set-aside Coterie Agent (A) mini-card, along with 2 decoys, shuffles them facedown, and places one at each of the three locations nearest to her. Then, if any of those locations already had 1 or more concealed mini-cards, she would shuffle each concealed mini-card at those locations, as well.*</p><p class='basic'>Enemies in the shadows observe the following additional rules:</p><ul><li>Enemies in the shadows are considered to be in play, but not at any particular location. They cannot move until they leave the shadows.</li><li>Enemies in the shadows can qualify as the “nearest” enemy, but only if there are no other enemies in play at any location.</li><li>Enemies in the shadows cannot be damaged or leave play via player card effects.</li></ul>"
        },
        {
          "title": "Concealed Mini-Cards",
          "body": "<p class='basic'>While in play, concealed mini-cards represent the possible location of an enemy in the shadows. In order to deal with such an enemy, its true location must first be discovered by exposing its mini-card. This can be done via one of three methods: fighting, evading, or investigating.</p><ul><li>Concealed mini-cards are not enemies and cannot be engaged like enemies. However, any investigator at the same location as a concealed mini-card may attempt to expose it by successfully attacking it or evading it (as if it were an engaged enemy), or by successfully investigating its location. The difficulty to successfully attack or evade a concealed mini-card is equal to the shroud value of its location.<ul><li>An investigator may also use a card effect that automatically evades an enemy, deals damage to an enemy, or discovers a clue at a location in order to instead expose a concealed mini-card.</li></ul></li><li>If an investigator chooses to expose a concealed mini-card, that effect replaces the standard effects of the action or ability that exposed it. (i.e., if an enemy’s mini-card is exposed by evasion or damage, the matching enemy is not evaded, nor does it take damage. If a mini-card is exposed by discovering clues or investigating, no clues are discovered.)</li><li>If a concealed mini-card is exposed (via any of the above methods), flip it to its revealed side.<ul><li>If it is a decoy, set it aside, out of play, with no effect.</li><li>If it is an enemy’s mini-card, that enemy is now exposed. Place the matching enemy in the shadows at that mini-card’s location, then set that mini-card aside, out of play. (That enemy is no longer in the shadows, and is now at the location where its mini-card was located). Then, if there are no other enemies in the shadows, set all remaining concealed mini-cards in play aside, out of play.</li></ul></li><li>Only one concealed mini-card may be exposed per effect unless explicitly stated. (i.e., an effect that deals 3 damage to each enemy at a location does not expose all concealed mini-cards at that location; only one.)</li></ul><p>*For example: There is a Coterie Agent and a Coterie Assassin in the shadows. There is a concealed mini-card at Kymani’s location and another concealed mini-card at a connecting location. (1) First, Kymani plays an event that discovers a clue at their location, but instead of discovering a clue, they choose to expose the concealed mini-card at their location, flipping it over. That mini-card is a decoy, and is set aside without effect. (2) Next, they move to the connecting location with the other concealed mini-card and attempt to expose it using an evade action. They succeed and flip the mini-card over…revealing the Coterie Assassin’s mini-card! (3) The Coterie Assassin’s mini-card is set aside, and the Coterie Assassin in the shadows is moved to Kymani’s location, engaging them. Because there is another enemy in the shadows, they do not remove any of the other concealed mini-cards from play.*</p>"
        },
        {
          "title": "Alert",
          "body": "<p class='basic'>Some enemies have the alert keyword. Each time an investigator fails a skill test while attempting to evade an enemy with the alert keyword, after applying all results for that skill test, that enemy performs an attack against the evading investigator. An enemy does not exhaust after performing an alert attack. This attack occurs whether the enemy is engaged with the evading investigator or not.</p>"
        },
        {
          "title": "Patrol",
          "body": "<p class='basic'>Some enemies have the patrol keyword. During the enemy phase (in framework step 3.2), each ready, unengaged enemy with the patrol keyword moves to a connecting location along the shortest path toward the designated location (as described in parentheses next to the word patrol).</p><ul><li>If there are multiple locations that qualify as the designated location, the lead investigator may choose which location the enemy moves toward.</li><li>If an enemy with patrol would be compelled to move to a location via a path that is blocked by a card ability, the enemy does not move.</li></ul>"
        }
      ],
      "headings": {
        "prologue": "Campaign Setup",
        "embark": {
          "Alexandria": "Depart from Alexandria",
          "Anchorage": "Depart from Anchorage",
          "Arkham": "Depart from Arkham",
          "Bermuda": "Depart from Bermuda",
          "BermudaTriangle": "Depart from Bermuda Triangle",
          "Bombay": "Depart from Bombay",
          "BuenosAires": "Depart from Buenos Aires",
          "Cairo": "Depart from Cairo",
          "Constantinople": "Depart from Constantinople",
          "Havana": "Depart from Havana",
          "HongKong": "Depart from Hong Kong",
          "Kabul": "Depart from Kabul",
          "Kathmandu": "Depart from Kathmandu",
          "KualaLumpur": "Depart from Kuala Lumpur",
          "Lagos": "Depart from Lagos",
          "London": "Depart from London",
          "Manokwari": "Depart from Manokwari",
          "Marrakesh": "Depart from Marrakesh",
          "MonteCarlo": "Depart from Monte Carlo",
          "Moscow": "Depart from Moscow",
          "Nairobi": "Depart from Nairobi",
          "NewOrleans": "Depart from New Orleans",
          "Perth": "Depart from Perth",
          "Quito": "Depart from Quito",
          "Reykjavik": "Depart from Reykjavik",
          "RioDeJaneiro": "Depart from Rio de Janeiro",
          "Rome": "Depart from Rome",
          "SanFrancisco": "Depart from San Francisco",
          "SanJuan": "Depart from San Juan",
          "Shanghai": "Depart from Shanghai",
          "Stockholm": "Depart from Stockholm",
          "Sydney": "Depart from Sydney",
          "Tokyo": "Depart from Tokyo",
          "Tunguska": "Depart from Tunguska",
          "Venice": "Depart from Venice",
          "YborCity": "Depart from Ybor City"
        },
        "kind": {
          "embark": "Embark"
        },
        "interludes": {
          "1": "Interlude",
          "14": "File #14–C",
          "20": "File #20–E",
          "26": "File #26–G",
          "27": "File #27–H",
          "32": "File #32–J",
          "36": "File #36–L",
          "37": "File #37–M",
          "44": "File #44–O",
          "45": "File #45–P",
          "49": "File #49–R",
          "50": "File #50–S",
          "51": "File #51–T",
          "52": "File #52–U",
          "53": "File #53–V",
          "54": "File #54–W",
          "55": "File #55–X"
        }
      },
      "locations": {
        "Alexandria": {
          "name": "Alexandria",
          "subtitle": "File #38-N"
        },
        "Anchorage": {
          "name": "Anchorage",
          "subtitle": "File #33-K"
        },
        "Arkham": {
          "name": "Arkham"
        },
        "Bermuda": {
          "name": "Bermuda",
          "subtitle": "File #20-E"
        },
        "BermudaTriangle": {
          "name": "Bermuda Triangle"
        },
        "Bombay": {
          "name": "Bombay",
          "subtitle": "File #36-L"
        },
        "BuenosAires": {
          "name": "Buenos Aires",
          "subtitle": "File #16-D"
        },
        "Cairo": {
          "name": "Cairo"
        },
        "Constantinople": {
          "name": "Constantinople",
          "subtitle": "File #21-F"
        },
        "Havana": {
          "name": "Havana",
          "subtitle": "File #28-I"
        },
        "HongKong": {
          "name": "Hong Kong"
        },
        "Kabul": {
          "name": "Kabul",
          "subtitle": "File #14-C"
        },
        "Kathmandu": {
          "name": "Kathmandu",
          "subtitle": "File #53-V"
        },
        "KualaLumpur": {
          "name": "Kuala Lumpur"
        },
        "Lagos": {
          "name": "Lagos",
          "subtitle": "File #37-M"
        },
        "London": {
          "name": "London"
        },
        "Manokwari": {
          "name": "Manokwari"
        },
        "Marrakesh": {
          "name": "Marrakesh",
          "subtitle": "File #11-B"
        },
        "MonteCarlo": {
          "name": "Monte Carlo"
        },
        "Moscow": {
          "name": "Moscow",
          "subtitle": "File #26-G"
        },
        "Nairobi": {
          "name": "Nairobi",
          "subtitle": "File #54-W"
        },
        "NewOrleans": {
          "name": "New Orleans"
        },
        "Perth": {
          "name": "Perth",
          "subtitle": "File #55-X"
        },
        "Quito": {
          "name": "Quito",
          "subtitle": "File #14-C"
        },
        "Reykjavik": {
          "name": "Reykjavik",
          "subtitle": "File #14-C"
        },
        "RioDeJaneiro": {
          "name": "Rio de Janeiro",
          "subtitle": "File #44-O"
        },
        "Rome": {
          "name": "Rome",
          "subtitle": "File #51-T"
        },
        "SanFrancisco": {
          "name": "San Francisco",
          "subtitle": "File #26-G"
        },
        "SanJuan": {
          "name": "San Juan",
          "subtitle": "File #14-C"
        },
        "Shanghai": {
          "name": "Shanghai",
          "subtitle": "File #32-J"
        },
        "Stockholm": {
          "name": "Stockholm",
          "subtitle": "File #36-L"
        },
        "Sydney": {
          "name": "Sydney",
          "subtitle": "File #49-R"
        },
        "Tokyo": {
          "name": "Tokyo",
          "subtitle": "File #37-M"
        },
        "Tunguska": {
          "name": "Tunguska"
        },
        "Venice": {
          "name": "Venice"
        },
        "YborCity": {
          "name": "Ybor City",
          "subtitle": "File #52-U"
        }
      },
      "interludes": {
        "1": "The Foundation",
        "14": "Ruses and Reclamation",
        "20": "The Great Work",
        "26": "Quid Pro Quo",
        "27": "Dead and Gone",
        "32": "The Coiled Serpent",
        "36": "Strange Architecture",
        "37": "Special Delivery",
        "44": "Theory of Annihilation",
        "45": "Metamorphosis",
        "49": "Ringing Hollow",
        "50": "Blood, Sweat, and Tea",
        "51": "Romulus and Remus",
        "52": "The Safehouse",
        "53": "Whistle On the Wind",
        "54": "Infernal Machinery",
        "55": "Paranatural Selection"
      },
      "statusReport": {
        "title": "Status Report",
        "alpha": "<div class='red bordered'><p class='basic'>_Status Report Alpha (α):_</p><p>As your travels continue, the Foundation receives more and more reports of strange disappearances. With each new dossier you read, you worry that it is only a matter of time before there is nothing left.</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p></div>",
        "beta": "<div class='red bordered'><p class='basic'>_Status Report Beta (β):_</p><p>You receive a coded missive from Commissioner Taylor herself: “Agents—not long ago, a massive explosion occurred near the Podkamennaya Tunguska River in Siberia. It is classified as an impact event, but this is just a cover story. Our intel now indicates Coterie involvement. I have reason to believe this may be the site of one of their sanctums. Perhaps even their primary safehouse. You have clearance to investigate the site, but be prepared for anything.”</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p><p class='basic right'>In the Central Asia section of the Campaign Log, find Tunguska. In its spot, write “59–Z.” You are now allowed to travel to this location whenever you embark. (*Note: This will end the campaign. You may wish to investigate further before proceeding to Tunguska… but be wary of how much time you spend.*)</p></div>",
        "epsilon": "<div class='red bordered'><p class='basic'>_Status Report Epsilon (ε):_</p><p>As you traverse the streets, you flinch at every shifting shadow and every passerby wearing red. You’re definitely being followed, and you have no lack of enemies who might fit the bill…</p><p class='basic'>For the remainder of the campaign, whenever you are setting up a scenario, perform the following: gather each of the enemies in the Red Coterie encounter set whose name matches those who you *“haven’t seen the last of”* in your Campaign Log, choose one at random, and shuffle it into the encounter deck for this scenario. The *Red Coterie* encounter set is indicated by the following encounter set icon.<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section></p></div>",
        "gamma": "<div class='red bordered'><p class='basic'>_Status Report Gamma (γ):_</p><p>The reports continue. Now it’s not just missing people, but people returning, having changed. Buildings and objects, too—replicated, but different, off, like they had been completely dismantled and then reassembled. But why?</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p><p class='basic right'>Each investigator must add 1 copy of the Paradimensional Understanding weakness to their deck. It does not count toward their deck size. These cards can be found in the Globetrotting encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></p></div>",
        "zeta": "<div class='red bordered'><p class='basic'>_Status Report Zeta (ζ):_</p><p>You return to your hotel after a long day of travel and investigation, only to find your room in shambles. A grim feeling sprouts in your gut. Someone has clearly turned your room upside-down in search of something, and you’re pretty sure you know what. You rush to the safe where you have been storing the paradimensional artifacts you aren’t carrying on your person. To your horror, it is empty, apart from a single red card. Reaching out to Foundation contacts, you believe you have tracked the culprit to one of four likely Coterie sanctums. Perhaps if you’re quick, you can recover what was stolen from you.</p><p class='basic right'>Check the Keys section of the Campaign Log and find each of the Keys whose bearer is an investigator. Choose 1 at random (2 instead if the investigators control 5 or more Keys in total). That Key(s) has been stolen.</p><p class='basic right'>Gather each of the enemies in the Red Coterie encounter set whose name matches those who you “haven’t seen the last of ” in your Campaign Log and choose one at random. This is the identity of the character who stole your Key(s).</p><p class='basic right'>Update the Keys section of your Campaign Log such that the bearer of the Key(s) that were stolen is the randomly chosen enemy.</p><p class='basic right'>In the Central Asia, Americas, and North Atlantic sections of the Campaign Log, find Kabul, Quito, San Juan, and Reykjavik In each of these spots, write “14–C.” You are now allowed to travel to these locations whenever you embark.</p></div>",
        "theta": "<div class='red bordered'><p class='basic'>_Status Report Theta (θ):_</p><p>As you head to your hotel room, you spot a red envelope slipped under your door. Inside is a simple message: “My people in Ybor City know about the new passphrase and know you’re coming. Drop by when you get the chance.” It’s signed “Desi.”</p></div>",
        "psi": "<div class='red bordered'><p class='basic'>_Status Report Psi (ψ):_</p><p>As you return to your hotel, the concierge waves you down and hands you a telegram.</p><p class='center'>TRAIL PICKED UP HOT ON HER HEELS STOP<br>MEET IN HONG KONG MAY REQUIRE AID STOP<br>PARASOL IS KEY STOP</p><p>This must be from Inspector Flint. Perhaps you should travel to Hong Kong and learn more, if you can spare the time.</p><p class='basic right'>In the Southeast Asia section of the Campaign Log, find Hong Kong. In its spot, write “50–S.” You are now allowed to travel to this location whenever you embark.</p></div>",
        "omega": "<div class='red bordered'><p class='basic'>_Status Report Omega (Ω):_</p><p>As you head into your hotel room, frantic at news of recent events, you mentally begin to prepare for the next leg of your trip…when suddenly, a shape emerges from a corner of your hotel room, and you are clocked on the side of your skull by something heavy and smooth. You collapse into darkness. The last thing you see is a splash of red.</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p><p class='basic right'>You are out of time. Immediately travel directly to Tunguska and proceed to _Finale Scenario: Congress of the Keys_.</p></div>"
      },
      "key": {
        "agentFlintIsDead": "Agent Flint is dead",
        "agentFlintIsMissing": "Agent Flint is missing",
        "agentQuinnHasYourBack": "Agent Quinn has your back",
        "agentQuinnDoesNotTrustTheCell": "Agent Quinn does not trust the cell",
        "agentQuinnVanishedFromExistence": "Agent Quinn vanished from existence",
        "alikiIsOnYourSide": "Aliki is on your side",
        "amaranthHasLeftTheCoterie": "Amaranth has left the Coterie",
        "cellDeception": "Cell deception",
        "desiIsInYourDebt": "Desi is in your debt",
        "drIrawanJoinedTheCell": "Dr. Irawan joined the cell",
        "drIrawanTraveledToNewGuinea": "Dr. Irawan traveled to New Guinea",
        "drIrawanVanishedFromExistence": "Dr. Irawan vanished from existence",
        "eceDoesNotTrustTheCell": "Ece does not trust the cell",
        "eceTrustsTheCell": "Ece trusts the cell",
        "erasedFromExistence": "Erased from existence",
        "flintAbandonedHisSearch": "Flint abandoned his search",
        "flintIsWorkingSolo": "Flint is working solo",
        "flintRejoinedTheCell": "Flint rejoined the cell",
        "flintTraveledToKualaLumpur": "Flint traveled to Kuala Lumpur",
        "foundationTrust": "Foundation trust",
        "laChicaRojaIsOnYourSide": "La Chica Roja is on your side",
        "theCellAidedInFlintsInvestigation": "The cell aided in Flint's investigation",
        "theCellAidedTheKnight": "The cell aided the Knight",
        "theCellAppreciatedTheArchitecture": "The cell appreciated the architecture",
        "theCellBlewTheWhistle": "The cell blew the whistle",
        "theCellDidntDiscoverTheTruthInHavana": "The cell didn't discover the truth in Havana",
        "theCellEscapedTheRedCoterie": "The cell escaped the Red Coterie",
        "theCellFailedToFendOffTheBeast": "The cell failed to fend off the Beast",
        "theCellHasBeenAmbushed": "The cell has been ambushed",
        "theCellHidTheTruthFromTaylor": "The cell hid the truth from Taylor",
        "theCellIsAssistingAgentSirry": "The cell is assisting Agent Sirry",
        "theCellIsDecievingEce": "The cell is deceiving Ece",
        "theCellIsDeliveringFoundationIntel": "The cell is delivering Foundation intel",
        "theCellIsOffMission": "The cell is off mission",
        "theCellIsWorkingWithEce": "The cell is working with Ece",
        "theCellJoinedTheRedCoterie": "The cell joined the Red Coterie",
        "theCellKnowsAmaranthsRealName": "The cell knows Amaranth's real name",
        "theCellKnowsOfDesisPast": "The cell knows of Desi's past",
        "theCellKnowsTheTrueNatureOfTheCoterie": "The cell knows the true nature of the Coterie",
        "theCellMadeADealWithDesi": "The cell made a deal with Desi",
        "theCellMadeADealWithTheClaretKnight": "The cell made a deal with the Claret Knight",
        "theCellMadeADealWithThorne": "The cell made a deal with Thorne",
        "theCellMeddledInAbarransAffairs": "The cell meddled in Abarran's affairs",
        "theCellMetDrIrawan": "The cell met Dr. Irawan",
        "theCellOverthrewTheRedCoterie": "The cell overthrew the Red Coterie",
        "theCellPossessesAMysteriousWhistle": "The cell possesses a mysterious whistle",
        "theCellRefusedAlikisOffer": "The cell refused Aliki's offer",
        "theCellRefusedEcesOffer": "The cell refused Ece's offer",
        "theCellToldTheTruthToTaylor": "The cell told the truth to Taylor",
        "theCellThrewAwayTheWhistle": "The cell threw away the whistle",
        "theCellWasDismantled": "The cell was dismantled",
        "theCellWasGivenAPermanentPosition": "The cell was given a permanent position",
        "theCellWasHollowed": "The cell was hollowed",
        "theDogsAreAtWar": "The dogs are at war",
        "theFoundationRemainsInTheDark": "The Foundation remains in the dark",
        "theLoversAreReunited": "The lovers are reunited",
        "theOutsidersWereStopped": "The outsiders were stopped",
        "theRedCoterieAndTheCellAgreedToWorkTogether": "The Red Coterie and the cell agreed to work together",
        "theRedCoterieSparedTheCell": "The Red Coterie spared the cell",
        "theRedCoterieWasDestroyedFromWithin": "The Red Coterie was destroyed from within",
        "theSanguineWatchersTormentContinues": "The Sanguine Watcher's torment continues",
        "theVoidChimeraEscaped": "The Void Chimera escaped",
        "thereIsNothingOfNoteInAnchorage": "There is nothing of note in Anchorage",
        "thorneDisappeared": "Thorne disappeared",
        "time": "Time",
        "tuwileMasaiFledToBermuda": "Tuwile Masai fled to Bermuda",
        "tuwileMasaiIsOnYourSide": "Tuwile Masai is on your side",
        "tzuSanNiangHasYouUnderHerSway": "Tzu San Niang has you under her sway",
        "tzuSanNiangIsUnderYourSway": "Tzu San Niang is under your sway",
        "wrongLeads": "Wrong leads",
        "youHaventSeenTheLastOfAlikiZoniUperetria": "You haven't seen the last of Aliki Zoni Uperetria",
        "youHaventSeenTheLastOfAmaranth": "You haven't seen the last of Amaranth",
        "youHaventSeenTheLastOfDesiderioDelgadoAlvarez": "You haven't seen the last of Desi",
        "youHaventSeenTheLastOfLaChicaRoja": "You haven't seen the last of La Chica Roja",
        "youHaventSeenTheLastOfTheBeastInACowlOfCrimson": "You haven't seen the last of the Beast in a Cowl of Crimson",
        "youHaventSeenTheLastOfTheClaretKnight": "You haven't seen the last of the Claret Knight",
        "youHaventSeenTheLastOfTheRedGlovedMan": "You haven't seen the last of the Red-Gloved Man",
        "youHaventSeenTheLastOfTheSanguineWatcher": "You haven't seen the last of the Sanguine Watcher",
        "youHaventSeenTheLastOfThorn": "You haven't seen the last of Thorn",
        "youHaventSeenTheLastOfTzuSanNiang": "You haven't seen the last of Tzu San Niang",
        "youKnowThePassphrase": "You know the passphrase"
      },
      "label": {
        "chooseBearer": "Choose bearer",
        "empowered": "Spend empowerment instead of flipping to _Unstable_ side",
        "figuresInTheDark": {
          "attack": "Each enemy in the shadows attacks you.",
          "loseAction": "Each investigator loses an action."
        },
        "pinchInReality": {
          "discard": "Discard half of the non-weakness cards in your hand (rounded up)."
        },
        "secretsLost": {
          "hollowed": "Take 1 horror to choose a set-aside hollow and add it to its owner's hand"
        },
        "wealdOfEffigies": {
          "miniCards": "Swap the positions of 2 concealed mini-cards adjacent to locations",
          "locations": "Swap the positions of 2 locations in the shadows"
        },
        "paradimensionalTerror": {
          "takeDamageAndHorror": "Each investigator takes 1 damage and 1 horror.",
          "shuffleAllConcealed": "Shuffle all concealed mini-cards facedown, then place them at random in the positions they were in."
        },
        "paradimensionalUnderstanding": {
          "stable": "Flip each _Stable_ key you control to its _Unstable_ side.",
          "unstable": "Immediately shift an _Unstable_ key you control."
        },
        "theMirroringBlade": {
          "single": "Deal 2 damage to an enemy at your location.",
          "all": "Deal 1 damage to all enemies at your location."
        },
        "doNotExposeConcealed": "Do not expose Concealed Card",
        "doNotRevealConcealed": "Do not reveal Concealed Card",
        "drDewiIrawan": {
          "reveal": "Reveal a card from your hand to shuffle each copy of that card that is set-aside as a hollow into its owner's deck",
          "discard": "Discard a card from your hand to shuffle any set-aside hollow into its owner's deck"
        }
      },
      "xp": {
        "chaosTokens": "Already at 4 chaos tokens"
      },
      "prologue": {
        "title": "The Secret War",
        "body": "<p>“…by May or June I realised that there was, all over the world, a surprising and unwonted burst of activity on the part of bizarre, furtive, and esoteric mystical organisations ordinarily quiescent and seldom heard from.”</p><p class='basic right'>– H. P. Lovecraft for Hazel Heald, “Out of the Aeons”</p><h3>Around the World</h3><p class='basic'>The Scarlet Keys expansion differs from its predecessors in that it features an open-ended, non-linear campaign. Following the “Riddles and Rain” prologue, investigators are provided with a map of the world, and from there they may choose to embark to various locations. The order in which the locations are chosen determines the order in which these scenarios are played, and may also alter the story and gameplay of each scenario before culminating in an epic finale. Choose wisely, and good luck!</p>"
      },
      "interlude1": {
        "label": {
          "tell": "Tell Taylor about the disappearances.",
          "doNotTell": "Do not tell Taylor about the disappearances."
        },
        "title": "Interlude: The Foundation",
        "theFoundation1": "<p>_The Foundation 1_: “Talk,” the woman commands.</p><p>“I’m a detective with the ICPC,” Flint barks back. “Flint, Li Flint. And you’re going to be in a lot of trouble when they hear about this.”</p><p>“I assure you, I will not. And you?” she asks, glaring in your direction. You explain that you are independent investigators working with Flint. She takes a moment to read your gaze—presumably to tell if you are lying. She, like Flint, seems low on trust. Finally, after a long, bated moment, she holsters her firearm. Flint’s hands drop to his sides. You let out a breath you didn’t know you were holding.</p><p>“We have been after that red-gloved man for quite some time. This is the first time we have gotten this close. He seems to have a knack for slipping away.” She nods to the two suits flanking her—a tall, athletic, pale-skinned woman and a sharp, clean-shaven man—and motions toward the walls. They keep a hand on their holsters as they scour the perimeter of the room.“And who is ‘we,’ exactly?” Inspector Flint asks. You’ve been wondering the very same thing. Your interrogator has a British accent, but she doesn’t seem to be part of any local outfit you’ve ever heard of.</p><p>She waits for confirmation from her two subordinates before continuing. “All clear, ma’am,” the man states. She sighs and crosses her arms. “All right. What I am about to tell you cannot leave this room under any circumstances. Am I clear?”</p><p>Flint shrugs. “Under penalty of what, exactly?”</p><p>“Summary execution,” she states without hesitation. Your throat closes tight. Even your partner flinches for a moment.</p><p>“Well then. I suppose we don’t have much of a choice, do we?” He glances at you. You nod; you might as well hear what she has to say.</p><p>“I am Commissioner Taylor, and these are agents Hudson and Antonova. We are with the <span class='term'>Foundation</span>, an international agency devoted to the discovery, research, and containment of objects with paradimensional capability.”</p><p>“What kind of baloney?” Flint practically laughs. But the woman who calls herself Taylor shows no sign of humor.</p><p>“After the Great War, many treaties and accords were signed. Paris. Versailles. But keeping the peace wasn’t the only goal. There were…oddities, you see. During the war. Things that did not add up. The Foundation’s purpose is to find these ‘things that do not add up’ and ensure that they cannot be used for such purposes ever again.”</p><p>“Well, this is a hell of a con you buttons have cooked up,” Flint says, but the darker tone in his voice indicates he doesn’t even believe himself. And you’re inclined to agree—the fact that Commissioner Taylor even knows of the Red-Gloved Man at all is proof that she has inside knowledge.</p><P>You decide that it’s more likely she is telling the truth than lying, and ask what she intends to do with you.</p><p>She paces in uncomfortable silence before finally letting out a sigh. “Well, I certainly can’t have your investigation running parallel to my own. And you might have information that could be pertinent to our work. So I say we work together.”</p><p>“Work together? Or work for you?” Flint asks pointedly, his eyes narrowing.</p><p>She allows herself a smile. “You are a clever man, I’ll give you that.” She nods to Agent Hudson, who produces several badges and hands them to you. “You’ll be your own cell of the Foundation, operating under our authority, but with independence. All you need to do is agree to report your findings to us.” She locks eyes with Flint appraisingly. “You’ll be our point of contact.”</p><p>You ask Taylor what you get out of the arrangement, besides the lifted threat on your lives. “We’ll hand over the intel we have on the organization the Red-Gloved Man works for and provide travel papers that can get you anywhere in the world, no questions asked, at no expense.”</p><p>Flint eyes the badge like one might an explosive, turning it over and over in his hands. “Two minutes ago you were pointing a gun at me, now you’re offering me a job?”</p><p>“Yes. Well? Are you in?”</p><p>You pull Flint aside to speak with him in private. The discussion is short and hushed, full of conjecture and paranoid theories about this “Foundation” and their true motives. But in the end, you decide to accept her offer. If it will help you get to the bottom of whatever is going on, it is the only real choice.</p><p>“Very well then,” Taylor explains. “The Red-Gloved Man is just one operative of his organization. Or, perhaps, its leader—that we are unable to determine. They call themselves the <span class='term'>Red</span> <span class='term'>Coterie</span>, so named due to the red garments they wear. They are after artifacts scattered across the world which possess paradimensional capabilities—the very same kind of objects we seek to find and contain. We call them Keys.”</p><p>You ask Commissioner Taylor what she means by the term paradimensional. “Imagine a cake with many layers,” she explains. “Everything we see and feel exists on one layer. But there are many more layers above and below ours. Something that is paradimensional exists on one layer, but draws energy from other, parallel layers. As a result, these Keys operate outside the laws of our dimension. Cause and effect. If left unchecked, they can be used to inflict terrible harm on the world. Our job— your new job—is to get them out of the hands of the Coterie and keep them secure in Foundation custody.”</p><p>If these Keys are as powerful as the Foundation believes, you agree that they should be kept in safe hands. But you cannot help but wonder what this has to do with the disappearances you’ve been investigating, if anything. Flint locks eyes with you and gives you the slightest shake of his head. He has no intention of telling them.</p><p>The investigators must decide (choose one):</p><ul><li>*Tell Taylor about the disappearances*. Proceed to The _Foundation 2_.</li><li>*Do not tell Taylor about the disappearances*. Skip to The _Foundation 3_.</li></ul>",
        "theFoundation2": "<p>_The Foundation 2_: You decide it’s best to tell Commissioner Taylor why you were looking into the Red-Gloved Man to begin with. Flint lets out an audible sigh. She mulls it over for a few moments, then shakes her head. “That is something to look into, but your primary objective is to acquire the Keys the Coterie is searching for, at all costs. Am I understood?” Taylor further explains that she will forward any relevant information to Flint’s office, with some “sensitive details” omitted, of course. She will also provide the ICPC with the requisite papers regarding Flint’s new “position.”</p><p>“Oh, and Agent Flint,” she says on her way out, addressing him by his new title. “Your cell may have the independence to act on their own accord, but do not forget that you report directly to me. I expect you to do so without reservation should you discover anything of import.”</p><p>He nods, only the slightest hint of resistance giving him away.</p><ul><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>In your Campaign Log, record *the cell told the truth to Taylor*. Skip to _The Foundation 4_.</li></ul>",
        "theFoundation3": "<p>_The Foundation 3_: You shut your mouth tight. What she doesn’t know can’t hurt her. Commissioner Taylor tells Flint that she will forward any relevant information to his office, with some “sensitive details” omitted, of course. She will also provide the ICPC with the requisite papers regarding Flint’s new “position.”</p><p>“Oh, and Agent Flint,” she says on her way out, addressing him by his new title. “Your cell may have the independence to act on their own accord, but do not forget that you report directly to me. I expect you to do so without reservation should you discover anything of import.”</p><p>He nods, but given your reluctance, you expect he’ll omit “sensitive details” as well.</p><ul><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>In your Campaign Log, record *the cell hid the truth from Taylor*. Proceed to _The Foundation 4_.</li></ul>",
        "theFoundation4": "<p>_The Foundation 4_: The next morning, your “cell” meets at the tea room near Trafalgar Square where you had originally intended to meet the previous night. Together, you go over the documentation provided to Flint by this “Foundation.”</p><p>“It’s all a bit difficult to believe, if I’m being honest,” Flint says, “but everything checks out. The travel papers, the job transfer, all of it. Not even my boss questioned it for a moment. I guess we’re secret agents now, eh?”</p><p>You agree; unbelievable as it might seem, it’s no less strange than the matters you had already been looking into. “Right. Well, I think the best thing to do is to split up. Shanghai is where I grew up. I have connections there I can leverage. So I’ll head there first. Where you want to investigate next is up to you. Meet up with me later, and we can figure out where to go from there.”</p><p class='basic'>The Foundation has several leads concerning the whereabouts of the Red Coterie</p><ul><li>One is likely in Inspector Flint’s home city of <span class='term'>Shanghai</span>, where there have been many rumors about the existence of a secret cabal led by a mysterious woman with a red parasol.</li><li>In <span class='term'>Alexandria</span>, there have been a rash of beastly killings throughout the city. The Foundation has reason to believe a member of the Coterie is involved.</li><li>A string of high-profile burglaries in <span class='term'>Buenos</span> <span class='term'>Aires</span> has led the Foundation to believe that one of the Coterie members is responsible. It is likely a Key is the primary target.</li><li>A member of the Coterie has a sanctum in <span class='term'>Nairobi</span>. Perhaps there you might learn what they have planned.</li><li>The Foundation have procured the journal of a prospector recently working in <span class='term'>Anchorage</span>. Perhaps the site of a Key?</li><li>A Coterie agent operating out of <span class='term'>Istanbul</span> has already reached out to Foundation operatives. A defector, perhaps? Or it could be a trap.</li><li>Locals in <span class='term'>Kathmandu</span> have reported seeing a “spirit” matching the description of another Coterie agent.</li><li>A deadly Coterie agent has been sighted in <span class='term'>Marrakesh</span>. Reports of tomb robberies and strange overgrowth have the local Foundation operatives on edge.</li><li>A Coterie agent has made a name for himself in <span class='term'>Havana</span>, where rum and other illicit goods are being smuggled into the United States.</li></ul><p class='basic right'>Read the rules for “Embarking and Travel” and “The Foundation Dossiers” on the next column. Then, when you are ready to proceed, _embark_ from London to a new location.</p>"
      },
      "embarkingAndTravel": {
        "title": "Embarking and Travel",
        "body": "<p class='basic'>Whenever you _embark_, you may travel wherever you wish using the map included in *The Scarlet Keys* campaign expansion. Each space on the map is connected to one or more other spaces by paths. When you are ready to embark, travel along the paths to reach whichever destination you wish (as a group). For each path you use to reach your destination, you must mark 1 _time_ in your Campaign Log (to a minimum of 1).</p><p class='basic'>At each space on the map, there is a number and letter combination that will guide you to a particular page in this Campaign Guide. You do not have to stop at every space you travel through; however, if you wish to stop traveling and see what is at that space, turn to the page of the Campaign Guide that matches the indicated number and follow the story text there. (*Or use the table of contents on page 2 to help you find the appropriate page.*) This might lead you to an interlude or to a scenario. There is no perfect path to follow, so follow your gut…just be wary of how much time you spend (see “Tracking Time” on page 6).</p><p>*For example: Shelley wishes to travel from Alexandria to Marrakesh. She first marks 1 _time_ to use the path to Rome, but chooses not to stop there, and marks 1 more _time_ to travel to Marrakesh, where she stops. Marrakesh is marked as “11–B,” so she opens the Campaign Guide to page 11 and reads File #11–B: Dead Heat.*</p><ul><li>Some locations are marked by a red border and the lack of a letter. You can only travel to such a location once you are permitted to do so by a Campaign Log entry.</li><li>Some locations, marked by a green border, represent the sites of possible side stories (*found in other Arkham Horror: The Card Game standalone products*). If you wish to incorporate a side story into this campaign, simply travel to the appropriate location on the map and spend additional time equal to the normal experience cost for playing that side story (instead of spending the experience cost).<ul><li>If you are not stopping at one of these locations to embark on a side-story, you may skip it and continue traveling along the path. If so, count it as one contiguous path, not as two separate paths.</li></ul></li><li>Once you have stopped at a location, you cannot stop there again for the remainder of the campaign unless instructed otherwise.</li></ul>"
      },
      "theFoundationDossiers": {
        "title": "The Foundation Dossiers",
        "body": "<p class='basic'>Throughout this Campaign Guide, there are a number of Foundation Dossier sidebars, an example of which is presented below. Investigators are allowed to peek at the Foundation Dossier sidebar for any space on the map, at any time. Use these sidebars to help guide your actions and plan your route. While reading a dossier, investigators are not allowed to peek at any other text on that page until they travel to that location.</p>"
      },
      "worldMap": {
        "dossierHeading": "You may read this dossier at any time",
        "dossiers": {
          "Marrakesh": "<p>File #11–B<br/>Subject Class: Red<br/>Real Identity: Unknown<br/>Last Known Location: Marrakesh, Morocco</p><p>Description: Subject #11–B (hereinafter \"Amaranth\") is a woman of European descent; appears to be in early 20s. Typically seen wearing a large red flower that partly obscures her face.</p><p>Paradimensional Capabilities: Power to <span class='censor'>transfer life</span> and <span class='censor'>death</span>. Channels <span class='censor'>energy</span> via <span class='censor'>extradimensional means</span> to <span class='censor'>heal wounded entities</span> and <span class='censor'>sap life</span> from <span class='censor'>the living</span>. No recorded limits to this <span class='censor'>exchange</span>; data limited only to minor events. Subject <span class='censor'>transfers life</span> via tactile contact, which limits <span class='censor'>scale</span> of <span class='censor'>transfer</span>. Possible <span class='censor'>near apocalyptic</span> ramifications.</p><p>Sightings: 1. November 23, 1923: Arkham, MA. Agents witnessed subject healing wounds of <span class='censor'>fellow Coterie</span> member, <span class='censor'>draining and shriveling</span> nearby trees. Elevated <span class='censor'>Outsider/Paracausal</span> activity reported in the months following.</p><p class='indent'>2. January 11, 1924: Lisbon, Portugal. Local cell apprehended subject. Physical contact confirmed. One cell member immediately deceased; second victim remains catatonic. Subject eluded questioning.</p><p class='indent'>3. Unconfirmed sighting in Marrakesh. Further intel required. Immediate assistance requested.</p><p>Approach Procedure: Subject is incredibly dangerous. Engage only with extreme caution. Physical contact prohibited. More information available in San Francisco office (File #26–G2).</p>",
          "BuenosAires": "<p>File #16–D<br/>Subject Class: Yellow<br/>Real Identity: Unknown<br/>Last Known Location: Buenos Aires, Argentina</p><p>Description: Subject #16–D (hereinafter \"Girl in Carmine Coat\") is a woman of apparently Argentinian descent (<span class='censor'>possible human</span> origin?), early 20s, approximately 165cm in height. <span class='censor'>Extraterrestrial</span> presence undetected (as of yet). Coterie paraphernalia consists of stark red coat and matching hat possessive of paradimensional faculty (see details below). Called \"La Chica Roja\" by locals (no doubt a reference to her attire, although it is unclear whether such title is a term of endearment or infamy).</p><p>Paradimensional Capabilities: Reports by local authorities suggest Girl in Carmine Coat is capable of either <span class='censor'>hyperphysical speed</span> or <span class='censor'>ethereal</span> <span class='censor'>projection</span>. Local authorities appear incapable of capturing subject despite repeated attempts. (Can she manipulate <span class='censor'>darkness</span> and <span class='censor'>shadows</span>? Or is she simply that good at evading detection?) Subject seems to wish to avoid conflict; as of yet, no deaths or harm to any locals can be traced to Girl in Carmine Coat. (Cannot rule out potential for violent escalation.)</p><p>Sightings: Girl in Carmine Coat is responsible for several high profile burglaries in Buenos Aires. Reports by local papers indicate she is still at large.</p><p>Approach Procedure: Despite her apparent <span class='censor'>coterie</span> association, Girl in Carmine Coat does not appear to be hostile. She has been heard speaking fluent Spanish, Portugese, French, and English. For these reasons, we believe subject can be interrogated and/or reasoned with. Recommend capture and questioning regarding <span class='censor'>coterie</span> motives.</p><p>Persons of Interest: Oficial Principal Matias Bolívar (ma-tee-as boh-lee-vahr), principal officer in charge of Girl in Carmine Coat's capture. (Possible asset?)</p>",
          "Constantinople": "<p>File #21–F<br/>Subject Class: Green<br/>Real Identity: Şahin, Ece (shah-heen, eh- jay)<br/>Last Known Location: Constantinople, Turkey</p><p>Description: Subject #21–F (hereinafter \"Lady in Vermillion Veil\" or real name \"Ece Şahin\") is a woman of Turkish descent, 34 years of age, approximately 161cm in height. It is unknown whether this is subject's <span class='censor'>true form</span> or a disguise or false identity. At all times, subject wears traditional hijab of unusual stark red color, likely a <span class='censor'>paradimensionally bound</span> object designating coterie membership.</p><p>Paradimensional Capabilities: Lady in Vermillion Veil appears to either possess no such capabilities, or has successfully hidden such capabilities from Foundation intelligence.</p><p>Sightings: Ece Şahin is a well known and renowned art collector and museum curator operating in the Turkish and Islamic Arts Museum in Constantinople. She has either <span class='censor'>integrated completely with human society</span> or is, for all intents and purposes, a normal everyday person. (Note: Leadership is under assumption <span class='censor'>Ece Şahin is a well constructed cover story, but has no evidence to back up such assumptions.</span>)</p><p>Approach Procedure: Ece has already reached out to Foundation envoys. Dispatch to confront and question intentions.</p>",
          "Sanctums": "<p>File #26–G1–6<br />Sanctum Class: Green<br />Sanctum Locations: <span class='censor'>Cape Town</span>, <span class='censor'>Union of South Africa</span>; San Francisco, California; <span class='censor'>Seoul</span>, <span class='censor'>South Korea</span>; Moscow, Russia; <span class='censor'>Bruges</span>, <span class='censor'>Belgium</span>; <span class='censor'>Bern</span>, <span class='censor'>Switzerland</span>.</p><p>Description: Sanctums #26–G1 through G6 are Foundation offices and storehouses for paradimensional artifacts. Do not disclose locations of sanctums with non–Foundation personnel under penalty of <span class='censor'>expulsion and/or indefinite imprisonment</span>.</p><p>Approach Procedure: Agent in charge of sanctum will meet you upon arrival. Entry instructions attached.</p>",
          "Havana": "<p>File #28–I<br />Subject Class: Yellow<br />Real Identity: Delgado Álvarez, Desiderio (del-gah-doh al-vah-rez, deh-see-deh-ree-oh)<br />Last Known Location: Havana, Cuba</p><p>Description: Subject #28–I (hereinafter \"Man in Blood–Soaked Suit\" or \"Desiderio Delgado Álvarez\") is a man of Cuban descent, approximately 42 years old and 192cm in height. Typically seen in a black suit accessorized with apparent coterie paraphernalia, including tie and hat, all with red accents.</p><p>Paradimensional Capabilities: Man in Blood–Soaked Suit does not appear to possess any extraordinary powers aside from peak <span class='censor'>human</span> physical performance, and unusually high skill and accuracy with firearms. (<span class='censor'>Perhaps</span> enhanced <span class='censor'>by a Key?</span>) Approach with caution.</p><p>Sightings: Mr. Álvarez is a longtime resident of Havana. However, no records exist pertaining to subject's childhood or early life. (Likely destroyed upon induction into Coterie, but possibility remains of <span class='censor'>extraterrestrial origin</span>. Either way, his identity may be an alias.) Mr. Álvarez is known to frequent a nightclub known as Cafe Luna.</p><p>Note: Foundation has no knowledge pertaining to any Key in Havana, however, Mr. Álvarez is likely to know location of other Keys.</p><p>Approach Procedure: Open negotiations with subject to acquire location of Coterie vaults and/or hideouts. If he does not cooperate, subdue and interrogate. More information available in Moscow office (File #26–G4).</p>",
          "Shanghai": "<p>File #32–J<br />Asset Name: Flint, Li<br />Area of Operation: Shanghai, China</p><p>Profile: Recently acquired agent in charge of undisclosed cell reporting directly to Commissioner Taylor.</p><p>Current Assignment: According to recent report, asset has split from rest of cell and is currently in Shanghai investigating whereabouts of subject #46–Q.</p><p>Notes: Asset loyalty to Foundation cause is unsure. Extreme vigilance recommended.</p>",
          "Anchorage": "<p>File #33–K<br />Subject Class: Yellow<br />Real Identity: Unknown.<br />Last Known Location: Anchorage, Alaska.</p><p>Description: Subject #33–K (hereinafter \"Thorne\") is a tall, gaunt person with androgynous features and fair complexion. Prefers practical, loose–fitting clothing. Subject appears to be <span class='censor'>of Anglo–Celtic descent</span> and conjectured to be far older than they appear (collaborating source suggests D.O.B. in <span class='censor'>1761</span>). Subject wears a distinct red cravat around their neck, often obscuring their face.</p><p>Paradimensional Capabilities: Subject possesses acute sensitivity to <span class='censor'>otherworldly residue</span>. Coterie leverages these capabilities to locate <span class='censor'>otherworldly</span> artifacts and track movement of <span class='censor'>paradimensional entities</span>.</p><p>Sightings: Numerous sightings across the globe. Profiled as one of the most mobile Coterie members. Despite notorious secrecy, Thorne has a reputation for appraising and acquiring <span class='censor'>paradimensional</span> artifacts. Analysis suggests they are amenable to business exchange and receptive to haggling. Recent activity suggests Coterie is in a state of <span class='censor'>aggressive acquisition</span>.</p><p>Approach Procedure: You and Thorne likely have similar objectives. Extreme caution suggested. Thorne is likely to negotiate but only on their terms.</p>",
          "Tokyo": "<p>File #37–M<br />Asset Name: Taylor, Qiana<br />Area of Operation: See current assignment status.</p><p>Profile: <span class='censor'>Commissioner Taylor was appointed as head of the Foundation by unanimous consent. Most people will never see the rest of this text, because I really want this whole section to just look like an enormous block of redacted \"who knows what she is up to\" kind of thing, so I will redact it, but somebody in the PDF might still be able to read it, so oh well. Hey, if you're reading this: kudos, that is awesome. I appreciate that you cared enough to go through the effort of figuring out what is here. Thank you for playing. Much love.</span></p><p>Current Assignment: <span class='censor'>Oh, here we go with the rest of the text, then, okay. Commissioner is looking into reports of paradimensional activity in a number of places. Current task list includes</span> Tokyo, Japan; <span class='censor'>Prague, Czechoslovakia; and</span> Lagos, Nigeria.</p>",
          "Alexandria": "<p>File #38–N<br />Subject Class: Red<br />Real Identity: Unknown<br />Last Known Location: Alexandria, Egypt</p><p>Description: Subject #38–N (hereinafter \"Beast in Cowl of Crimson\") is a roughly humanoid figure, approximately 183cm in height, clothed in a red cloak. The hood of this cloak effectively masks the figure's identity (very likely to be <span class='censor'>extraterrestrial</span> in origin). Only appendage as of yet observed is a set of <span class='censor'>wolflike</span> claws <span class='censor'>covered in gray fur</span>, hence the moniker. <span class='censor'>Inhuman origin</span> seems likely.</p><p>Paradimensional Capabilities: Beast in Cowl of Crimson appears to have high aptitude for physical confrontation. Prior encounters have led to <span class='censor'>the deaths of several agents</span>. Victims are <span class='censor'>eviscerated</span> and <span class='censor'>left to bleed out</span>, or <span class='censor'>partially devoured and battered around like a bored cat playing with its food</span>. Extreme caution is advised.</p><p>Sightings: Beast in Cowl of Crimson is prime suspect in several gruesome murders throughout Alexandria.</p><p>Note: Paradimensional implement (aka \"Key\") known to exist in Alexandria. Coterie element may be using key to <span class='censor'>transform or mutate their body</span>.</p><p>Approach Procedure: Subdue subject with extreme prejudice and acquire paradimensional implement for further study.</p>",
          "DrIrawan": "<p>File #44–O/55–X<br />Asset Name: Irawan, Dewi<br />Area of Operation: Southern Hemisphere</p><p>Profile: Prominent zoologist has published several surveys regarding disappearing wildlife. Zoologist claims entire species and the memory of their existence are being erased. Possible <span class='censor'>paracausal</span> disturbance.</p>",
          "Sydney": "<p>File #49–R<br />Asset Name: Quinn, Ari<br />Area of Operation: Sydney, Australia</p><p>Profile: Field researcher in charge of paradimensional analysis. Despite recent events, asset has not yet requested transfer. Recommend continued psychiatric evaluation.</p><p>Current Assignment: Agent Quinn is currently performing independent research regarding recent paradimensional disturbances.</p>",
          "YborCity": "<p>File #52–U<br />Sanctum Class: Yellow<br />Sanctum Location: Ybor City, Florida</p><p>Description: Sanctum #52–U is an abandoned cigar factory in Ybor City, north of McKay Bay.</p><p>Sightings: Subject #28–I known to frequent sanctum. Be on alert.</p><p>Approach Procedure: Enter with caution and search for signs of paradimensional implements. Take any and all evidence into Foundation custody.</p>",
          "Kathmandu": "<p>File #53–V<br />Subject Class: Undetermined<br />Real Identity: Uperetria, Aliki Zoni (oo-peh-reh-tree- ah, a-lee-kee zoh-nee)<br />Last Known Location: Kathmandu, Nepal</p><p>Description: Subject #53–V (hereinafter \"Maid With Scarlet Sash\") appears as a teenage girl of unknown descent wearing a white dress and red sash. <span class='censor'>It is unclear as of now whether such physical form is a true representation or a false image</span>.</p><p>Paradimensional Capabilities: <span class='censor'>Aliki is thought to possess uncanny knowledge beyond her years, and is likely much, much older than she appears. Foundation has yet to confirm paradimensional capabilities of bound key, if any. Subject may be incorporeal</span>.</p><p>Sightings: Locals in region have reported seeing a \"spirit\" matching subject's description, heralded by a high–pitched whistling sound. Unclear if <span class='censor'>Maid with Scarlet Sash is indeed ectoplasmic in nature, or if her paradimensional abilities reinforce such a description</span>.</p><p>Approach Procedure: Subject Risk Class uncomfirmed. Do not approach.</p>",
          "Nairobi": "<p>File #54–W<br />Subject Class: Green<br />Real Identity: Masai, Tuwile (muh-sah-ee, t-wayl)<br />Last Known Location: Nairobi, Kenya</p><p>Description: Subject #54–W (hereinafter \"Tuwile Masai\") is a slim man of Kenyan descent, middle–aged, and 176cm in height. Coterie signifiers include large red spectacles, <span class='censor'>access to and disposal</span> of <span class='censor'>Coterie funding</span>, and <span class='censor'>confirmed contact</span> with Coterie operatives. Subject has written and published openly under their name in numerous geological and archeological periodicals.</p><p>Paradimensional Capabilities: No known reports. Subject appears to possess no such capabilities, or has successfully hidden <span class='censor'>several bound paradimensional implements</span> from Foundation intelligence.</p><p>Sightings: Tuwile Masai teaches under a fellowship at Oxford University and has published numerous surveys on work at and around Lake Victoria.</p><p>Approach Procedure: Masai has spurned all Foundation contact thus far. Operatives may wish to approach only if Masai has reason to trust them.</p>"
        }
      },
      "quidProQuo": {
        "xp": {
          "supplies": "Supplies"
        },
        "label": {
          "ticket": "“We’d like to get around faster.”",
          "supplies": "“We’d like some supplies.”",
          "intel11": "“We’d like some intel on ‘Subject #11–B.’”",
          "intel28": "“We’d like some intel on ‘Subject #28–I.’”"
        },
        "sanFrancisco": "If you are in San Francisco, proceed to _Quid Pro Quo 1_.",
        "moscow": "If you are in Moscow, skip to _Quid Pro Quo 2_.",
        "title": "Quid Pro Quo",
        "body": "<p class='basic'>Check where you are on the map.</p>",
        "quidProQuo1": "<p>_Quid Pro Quo 1_: A set of obscure and overly-complex instructions leads you to a drab two-story stone building on the edge of San Francisco’s Chinatown neighborhood. Inside, a bored attendant slumps behind a desk near a brass elevator. Punching a specific code, the elevator takes you deep underground, farther than you could have predicted. On –14F, you step out and are greeted by an imposing man in a well-tailored suit and black fedora. “Archibald Hudson. We met in London,” he reminds you. “Your cell is quite the talk around the office.” The agent leads you down a seemingly endless hallway lined with alcoves. Each alcove displays something different: a model of a hollow earth, a crystal skull, a map with ley lines and other unknown markings. You pause and look at a half-eaten ear of corn, still steaming.</p><p>“From what I hear, that corn’s been cooked to perfection for the last two decades. So’s the dame who was eating it,” Agent Hudson says grimly. Looking at the paradimensional relics gives you a headache. Your eyes struggle to focus on them: they are both there and not there at the same time. Hudson ushers you down a side hall into a boxy room crammed with metal filing cabinets and sits down behind a heavy wooden desk. He speaks into a ring-and-spring microphone: “File #26–G2. Interview conducted by Hudson, Archibald, designation 42a6-951. That’s Agent Hudson to you,” he arches an eyebrow. Over the next several hours, you answer a gauntlet of grueling questions about your experience thus far, ranging from the past day to your experience in London. When it’s all done, Agent Hudson leans back and lights a cigarette. “I’ll admit, I was skeptical about you from the start. But Commissioner Taylor has good instincts, and I haven’t seen them steer her wrong yet,” he says. “You’ve done good work so far. We have some intel and some resources that might be useful for you. Tell me what the Foundation can do for you.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>“We’d like to get around faster.” The lead investigator adds one copy of Expedited Ticket to their deck. You may _embark_.</li><li>“We’d like some supplies.” Each investigator earns 1 experience. You may embark.</li><li>“We’d like some intel on ‘Subject #11–B.’” Skip to _Quid Pro Quo 3_. Choose this option only if you have not yet visited Marrakesh.</li></ul>",
        "quidProQuo2": "<p>_Quid Pro Quo 2_: The Foundation’s base of operations in Moscow is just a five minute walk from St. Basil’s Cathedral: a nondescript door set into a modern constructivist structure overlooking a cobbled street. The corridor inside feeds into a cramped stairwell that descends deeper than you could have anticipated, to a red door set in a flaking whitewashed wall. After identifying yourself, you are led into a long well-lit hallway with lavish carpeting.</p><p>“It seems you follow instructions well,” says a voice. You turn to see a tall, athletic woman in a well-tailored suit. “Valeriya Antonova. We have met before. Call me Lera. Please, follow me.” Agent Antonova leads you through a labyrinthine set of passageways, past a set of double doors, to a white-tiled room flecked with grime and what you hope is red rust. On an operating table in the center, what looks like a person is strapped to a metal slab, restrained with tight leather straps. Looking at the humanoid shape makes your head swim: its features are blurred as if in constant motion, like a hummingbird in flight. You catch only glimpses of its features: a stygian eye, clenched teeth, nervous twitching.</p><p>“Lera,” another agent interrupts. “The Komissar needs your attention.” Agent Antonova looks sternly to you. “This is a paradimensional being. Please keep your distance. I will be but a moment away.” The agent leaves. As you look at the sharp implements mounted to the wall of the lab, you wonder what experiments the being has endured. Judging by the subject’s well-tailored black suit, you wonder if it used to be a Foundation agent. After a minute of silence, it begins to flail around on the table, widening and shrinking its “mouth” to a wide dark O, always facing you. You keep your distance, trying to look away.</p><p>“Please excuse me,” Agent Antonova re-enters the room. The being on the table stops flailing. “There is another matter I must attend to. Unfortunately, we do not have the resources to escort you around our facilities, so I must ask you to leave. However, the Foundation does wish to assist in any way it can. Please tell us what we can do for you.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*“We’d like to get around faster.”* The lead investigator adds one copy of Expedited Ticket to their deck. You may _embark_.</li><li>*“We’d like some supplies.”* Each investigator earns 1 experience. You may _embark_.</li><li>*“We’d like some intel on ‘Subject #28–I.’”* Skip to _Quid Pro Quo 4_. Choose this option only if you have not yet visited Havana.</li></ul>",
        "quidProQuo3": "<p>_Quid Pro Quo 3_: Agent Hudson flips through some files and pulls out an updated dossier similar to the one in your possession, but much thicker. “Subject #11–B, calls herself ‘Amaranth.’ But this is not the first Amaranth the Foundation has encountered. She pops back up every few decades, looking completely different each time. This iteration bears a striking resemblance to a former student of a ‘Miskatonic University’ in Massachusetts. Eryn Cochwyn was her name. She’s been missing for some time.” You wonder aloud if it might be a coincidence. “There are no coincidences in our line of work,” he mutters.</p><ul><li>In your Campaign Log, *record the cell knows Amaranth’s real name*.</li><li>You may _embark_.</li></ul>",
        "quidProQuo4": "<p>_Quid Pro Quo 4_: Agent Antonova digs through some old files and pulls out a dossier filled with information on a man named Desiderio Delgado Álvarez. “From what we can tell, ‘Subject #28–I lived a perfectly mundane life in Havana until the age of 19, when his involvement with organized crime drew the attention of the Coterie. “ You wonder aloud if he is a rum-runner, and she shakes her head sternly. “Quite the opposite, in fact. Desiderio’s brother was the one involved in such matters, before his murder at the hands of a rival gang. It seems Desiderio then acquired a Key, and was using it to take revenge. Hence the Coterie involvement. Seeing his talent, they decided to induct him.”</p><ul><li>In your Campaign Log, record *the cell knows Desi’s past*.</li><li>You may _embark_.</li></ul>"
      },
      "specialDelivery": {
        "title": "Special Delivery",
        "body": "Check the Campaign Log and where you are on the map.",
        "deliveringIntel": "*If the cell is delivering Foundation intel…*",
        "deliveringIntelInTokyo": "…and you are in Tokyo, skip to _Special Delivery 2_.",
        "deliveringIntelInLagos": "…and you are in Lagos, skip to _Special Delivery 4_.",
        "notDeliveringIntel": "If the above entry is not recorded…",
        "notDeliveringIntelInTokyo": "…and you are in Tokyo, proceed to _Special Delivery 1_.",
        "notDeliveringIntelInLagos": "…and you are in Lagos, skip to _Special Delivery 3_.",
        "label": {
          "chooseToken": "Choose any number token in the chaos bag. Replace it with a number token of a value 1 higher"
        },
        "specialDelivery1": "<p>_Special Delivery 1_: Soon after arriving in Tokyo, you wander the city’s winding streets in the rain before sitting down at a food stall. Before you can order, a figure in a trenchcoat and wide-brimmed hat sits down next to you and whispers a phrase in a crisp British accent: “Six lions prowl at dusk.”</p><p>The phrase’s significance dawns on you after a moment, and you hurriedly recite the callback the Foundation operatives taught you: “A pride feasts in darkness.” The person next to you lowers the wide brim of her coat to reveal herself as Commissioner Taylor. She orders ramen for you both and looks away. “Before you ask: No, this is not a coincidence, and no, I will not tell you how I knew you would be here. It is my job to know more than you.”</p><p>You tell her she seems as brusque as usual, and a faint smile tugs at the edge of her lips. “Familiarity breeds liability, so let us keep this professional. Tell me what you have learned so far.” You shoot a worried look at the crowd around you. The commissioner shakes her head. “I saw to it that you were not followed. Talk.” Your eyes wander to the gun holstered to her belt, and you wonder what lengths she went to in the name of privacy.</p><p>Digging into the steaming bowl of ramen, you recount your findings so far. The rain falls hard around you, mingling with the smell of grilled meats and sweet spices. You spy a flash of red in the crowd, but when you look, all you see is the reflection on a blood-red fan. The commissioner snaps her fingers and you continue. Once you finish your report, Taylor pays for the meal and stands.</p><p>“It sounds as though your efforts are, shall we say, adequate?” she says primly. “However, the Foundation has a request. We need you to deliver a package to our sanctum in Lagos. Please see that it is delivered safely.” She hands you a sheaf of documents bound with cord.</p><ul><li>In your Campaign Log, record *the cell is delivering intel*. Each investigator must add one copy of Foundation Intel to their deck. It does not count toward their deck size. This card can be found in the *Globetrotting* encounter set, indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "specialDelivery2": "<p>_Special Delivery 2_: Threading your way through crowded streets, you meet a shrouded figure in a back alley. Reciting a phrase written in your instructions, you whisper: “Six lions prowl at dusk.” The figure lowers the brim of their hat and recites the callback: “A pride feasts in darkness.” Relaxing your guard, you hand the Foundation operative the documents, and they retreat into the shadows.</p><ul><li>In your Campaign Log, cross off *the cell is delivering intel*. Each investigator removes one copy of Foundation Intel from their deck. Choose any number token in the chaos bag. Replace it with a number token of a value 1 higher (*i.e. You may replace a 0 token with a +1 token, or a –3 token with a –2 token*).</li><li>You may _embark_.</li></ul>",
        "specialDelivery3": "<p>_Special Delivery 3_: Following a set of coded directions from the Foundation, you follow a packed road to a small cafe in the heart of Lagos. Seated on a veranda overlooking a bustling market is Commissioner Taylor, nursing a glass filled with a deep red liquid. As you approach, she shuffles a deck of playing cards with one hand and looks up at you.</p><p>“You can clearly follow directions,” she says, gesturing for you to sit across from her. “But do you know how to play whist?” A warm breeze stirs the air as you take your seat and Taylor deals you each thirteen cards, then reveals the top of the deck: a one-eyed jack. “Now talk.” As you play, the commissioner asks you questions about your findings around the globe. As the final trump card is revealed, Taylor looks you dead in the eyes.</p><p>“We have identified thirteen members of the Coterie so far, but evidence suggests there are more. Far more. Even if we catch one, the organization will persist. And that’s to speak nothing of their many operatives and minions. It would be like trying to remove an anthill by catching individual ants.” You ask the commissioner what she is getting at and she lays down her last card with a smirk. “The way to bring them down is to cut them off at their source.”</p><p>You play your last card: a near loss. Taylor gathers the cards up. “I win this time, but I look forward to our next game,” she sips her drink. “Do not forget what I said. Find where they congregate.” As she speaks, a towering suit approaches from the side of the building and whispers in her ear. “I am sorry to cut this short, but I have business in Monaco. Unfortunately, I don’t have time to deliver these documents—see that these reach our operatives in Tokyo.”</p><ul><li>In your Campaign Log, record *the cell is delivering intel*. Each investigator must add one copy of Foundation Intel to their deck. It does not count toward their deck size. This card can be found in the *Globetrotting* encounter set, indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "specialDelivery4": "<p>_Special Delivery 4_: After putting into port, you find a warehouse marked with 39-0 and a logo of a red lion, per the instructions given to you by the Foundation. Once inside, you deliver Commissioner Taylor’s documents to a steely-eyed operative, who thanks you before melting into the shadows.</p><ul><li>In your Campaign Log, cross off *the cell is delivering intel*. Each investigator removes one copy of Foundation Intel from their deck. Choose any number token in the chaos bag. Replace it with a number token of a value 1 higher (*i.e. You may replace a 0 token with a +1 token, or a –3 token with a –2 token*).</li><li>You may _embark_.</li></ul>"
      },
      "theCoiledSerpent": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "The Coiled Serpent",
        "label": {
          "keepInquiring": "“Keep inquiring, and let us know when you have something.”",
          "stickAround": "“We’ll stick around and help.”",
          "forgetHer": "“Forget her. We need your help.”"
        },
        "theCoiledSerpent1": "<p>_The Coiled Serpent 1_: You send a missive to Agent Flint ahead of your arrival, setting a meeting place and time—Jing’an Temple at noon. —and head there as soon as you arrive, entering the broad stone courtyard at the temple’s entrance. After a short while, a tourist approaches you and asks in English: “You’re sure you’re alone?” It takes you a moment to realize that the tourist is none other than Flint, in a subtle yet convincing disguise. He narrows his eyes at your stare. “Answer me,” he says, scanning his surroundings.</p><p>You assure him that you haven’t been followed. “Can’t be too careful. Eyes everywhere. I have a lead on one of those Coterie types here in Shanghai, just like the Foundation’s intel suggested. They call her ‘subject #46–Q ,’ aka ‘Lady with Red Parasol.’ Sure enough, she brings that parasol everywhere she goes. As far as Coterie insignias go, it’s not the most subtle.” While he whispers, he pulls a large camera and tripod from his duffel bag and painstakingly sets up a shot of the temple.</p><p>You wonder aloud what in the world Flint is up to. “Stop staring,” he hisses under his breath. Then you spot other tourists taking photos as well, and you realize that Flint is better at blending in than you are. “The last time I saw the lady with the parasol, she was leaving a meeting between several wealthy British and Chinese businessmen—railway men,” he says quietly, head still down. “Women aren’t usually allowed at such meetings. Nor are regular citizens. To be in that room, you have to be able to get the attention of those powerful men. Which means you’re either very powerful, or obscenely wealthy.” Flint takes a few photos, then moves to a new spot and starts the tedious process of focusing the camera all over again. “Within two weeks of that meeting, they announced a lucrative new contract. It seems all their competitors were convinced for one reason or another to step away from the project, which left them to write their own ticket. Name their own price.” He slowly scans the courtyard again, careful to move just his eyes and not his head. “Could be she has leverage on them. Or maybe she’s just that charming. But I’m willing to put my money on it being the influence of a Key. If that’s true, it’s imperative that we’re not made.” Flint’s paranoia is infectious.</p><p class='basic'>Check the Campaign Log.</p>",
        "toldTheTruth": "*If the cell told the truth to Taylor*, proceed to _The Coiled Serpent 2_.",
        "hidTheTruth": "*If the cell hid the truth from Taylor*, skip to _The Coiled Serpent 3_.",
        "theCoiledSerpent2": "<p>_The Coiled Serpent 2_: “Look, I would tell you more, maybe even let you help me out here, but you’ve made it pretty clear you’re a bit chatty, and the last thing I need is the Coterie figuring out I’m on to them. So, how about we split up? Keep doing what you’re doing, and I’ll contact you when I have a good lead.” Without letting you protest, Flint packs up his camera and leaves.</p><ul><li>In your Campaign Log, record *Flint is working solo*.</li><li> In your Campaign Log, find the 6th spot from the current time. Under that spot, write “_ψ_.” (*When you reach it, proceed to status report psi _ψ_ in the Status Reports section of the Campaign Guide.*)</li><li>You may _embark_.</li></ul>",
        "theCoiledSerpent3": "<p>_The Coiled Serpent 3_: “It will take some time to learn more about her and find the right opportunity to apprehend her,” Flint says quietly. “I saw how you acted with Taylor. I trust you to be discreet. So, I’ll contact you when I have a good lead. Or, I suppose you could stay and aid my investigation here.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*“Keep inquiring, and let us know when you have something.”* Proceed to _The Coiled Serpent 4_.</li><li>*“We’ll stick around and help.”* Skip to _The Coiled Serpent 5_.</li><li>*“Forget her. We need your help.”* Skip to _The Coiled Serpent 6_.</li></ul>",
        "theCoiledSerpent4": "<p>_The Coiled Serpent 4_: “Happy hunting, then,” Flint says with a nod. He hands you a slip of paper with his hotel, room number, and alias scribbled down on it. “In case you need to get in touch. I’ll send you a telegram when I know more. At least your travel expenses are on government dime, right?”</p><ul><li>In your Campaign Log, record *Flint is working solo*.</li><li>In your Campaign Log, find the 6th spot from the current time. Under that spot, write “_ψ_.” (*When you reach it, proceed to status report psi _ψ_ in the Status Reports section of the Campaign Guide.*) If there is fewer than 6 time remaining under “Time Passed,” write “_ψ_” under the final spot, instead</li><li>You may _embark_.</li></ul>",
        "theCoiledSerpent5": "<p>_The Coiled Serpent 5_: Over the course of several weeks, you manage to strike up a relationship with some of your quarry’s business associates—titans of industry in the fields of mining and railroad construction. You bide your time, earning a bit of their confidence, and it isn’t long before they mention the lady with the red parasol, whom they call Tzu San Niang. Her silver tongue and negotiating skills are apparently the thing of legend. One remarks, with a dreadful laugh, of her ability to convince worker unions to tolerate abysmal conditions, and local governments to accept the extraction of natural resources without batting an eye. Under the guise of needing her help for a project, you inquire about how to contact her. Your contacts inform you that she’s just landed a deal in Hong Kong and is already on her way there.</p><ul><li>In your Campaign Log, record *the cell aided in Flint’s investigation*.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>In the Southeast Asia section of the Campaign Log, find Hong Kong. In its spot, write “50–S.” You are now allowed to travel to Hong Kong whenever you embark.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "theCoiledSerpent6": "<p>_The Coiled Serpent 6_: Flint gives you a frustrated look. “Really? After all this work?” You explain to him that if the lady with the red parasol is as elusive and dangerous as she seems, it might be more prudent to work on other, more pressing cases. “I suppose you might have a point. Seems like a waste, though. I’ll make sure to report in with the Commissioner so she’s aware of what’s going on here, though. Maybe they can send somebody else to…” he trails off, then shakes his head. “Nah. They’d just muck it up.”</p><ul><li>In your Campaign Log, record *Flint abandoned his search*. Any one investigator may choose to add the Inspector Flint story asset to their deck. It does not count toward their deck size. This card can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>You may _embark_.</li></ul>"
      },
      "romulusAndRemus": {
        "title": "Romulus and Remus",
        "body": "Check the Campaign Log.",
        "offMission": "*If the cell is off-mission*, proceed to _Romulus and Remus 1_.",
        "onMission": "Otherwise, skip to _Romulus and Remus 2_.",
        "romulusAndRemus1": "<p>_Romulus and Remus 1_: “This is…possibly one of the worst ideas I’ve ever had,” Agent Quinn remarks as the two of you approach the Palatine Hill. The ruins of numerous temples litter the area, once marvels of luminous white marble, decorated with intricate reliefs of ivory and delicately carved statues; now nothing more than broken vestiges and stone foundations half-buried along the hill. You try your best to reassure Quinn, but she is right—this could easily be a wild goose chase or a trap. Commissioner Taylor would certainly not be happy if she knew her agents were attempting to parley with a member of the Red Coterie. But you suspect that Aliki knows more about the strange disappearances happening all over the globe than you do, and perhaps that is more important than the mission Taylor gave you. Quinn sighs and nods in agreement. “I know. That’s why I’m here. But still…” She stops in her tracks, spotting something in the distance, and begins walking in that direction. “There—those are the ruins of the palace of Caesar Augustus, who was thought to have built the Temple of Apollo Palatinus nearby. Most scholars believe these nearby ruins to belong to the Temple of Jupiter Victor, but I wager they are in fact Apollo’s.”</p><p>You sigh and pull out the white raven whistle Aliki gave you. Now is as good a time as any to give it a shot. Worst case scenario, you’ve simply wasted your time, and Quinn’s. You put the whistle to your lips and blow. Emerging is a paradoxically distant sound, a warbling trill not unlike the shrill sound that has haunted you ever since Kathmandu. The wind picks up, sudden and chill. Quinn pulls her coat over her torso with a shudder. Then, arriving just as swiftly as the bitter wind, you spy her.</p><p>Aliki Zoni Uperetria stands just over the ancient temple ruins, her red sash a splash of flowing color in the harsh breeze. As the wind and the discordant whistle both fade, her hair settles over her face, obscuring her expression. “I hope you know what you’re doing,” Quinn murmurs to you under her breath as she approaches the haunting figure with much trepidation. The girl in the scarlet sash speaks a single word in ancient Egyptian, stopping Quinn in her tracks. The agent replies in kind, causing Aliki’s head to tilt to the side in curious understanding. Slowly, bit by bit, the two begin to converse, changing languages every other sentence like two students testing one another. You watch in awe as the two juggle ancient languages as easily as breathing.</p><p>Finally, Quinn addresses you. “You were right. She’s searching for a place where…” Aliki speaks again, and Quinn translates. “The entities you’ve encountered. She thinks the things they take—no, devour—she thinks they end up somewhere else. She’s searching for the place where they go.” You ask Quinn if she can think of any place on Earth that might be a hotspot for such activity. “There is one that I can think of,” she replies. “The Bermuda Triangle, otherwise known as The Devil’s Triangle, in the Atlantic. We’ve tried our best to keep it under wraps, but a lot of ships and even some aircraft have gone missing in that area. A few of those incidents are on my list of memory anomalies, as well. Could be some kind of…gateway.”</p><p>You tell her to ask Aliki why she is looking for this place, and the two begin conversing again. “She says that she thinks some of the Coterie were—” She pauses for a moment, struggling with the translation. “—taken? But how could that be? Our records indicate they’re accounted for. At least, the ones we know about.” You consider all that you have seen, and a nauseous feeling overtakes you. Is it possible for both to be true? Is it possible some in the Coterie are not what they seem?</p><p>You approach and ask Aliki if she would like to travel with you to this gateway, if it exists. Quinn tentatively translates your request, and the mysterious figure nods in response. Resolve, strange and fierce, like a piercing light in the abyss, fills your heart. You lift the raven whistle and say that you will summon her when you are ready. This time, Aliki nods without even waiting for Quinn’s translation. You catch just a glimpse of piercing red eyes, framed with heavy bangs, as the wind picks up again and sends her hair aflutter. You lift your coat to block the bitter chill, and naught but a moment later, Aliki Uperetria is gone, wisped along with the wind itself.</p><p>You ask Quinn if she will stick with you a little longer. “I’m not going to lie, this terrifies me,” she says in a small voice, “but I think we are on to something here. Yes. I will see this through with you to the very end. I just hope…” she quivers and averts her gaze away from you. “I just hope I am still remembered when this is done.</p><ul><li>In the Americas section of the Campaign Log, inside the Bermuda Triangle (*the triangle formed by lines connecting Ybor City, San Juan, and Bermuda*), write “56–Y.” You are now able to travel inside the Bermuda Triangle whenever you embark. You may do so from Ybor City, San Juan, or Bermuda, at the cost of 1 _time_. (*When you do, proceed to File 56–Y in the Campaign Guide*).</li><li>You may _embark_.</li></ul>",
        "romulusAndRemus2": "<p>_Romulus and Remus 2_: Several fruitless days of searching for leads in Rome brings you to the Palazzo dei Conservatori on the Capitol Hill. Nestled among dozens of ancient statues is a bronze sculpture of the Lupa Capitolina depicting two twin babies suckling from a mother wolf. Your guide explains the twins are Romulus and Remus, the two alleged founders of Rome. “According to legend, the king, afraid for his claim to the throne, ordered them to be drowned in the Tiber. The twins were protected by the gods and taken in by a she-wolf who raised and fed them as her own. They lived in a cave until they were found and brought to safety.”</p><p>The guide leads the tour past another gallery filled with empty pedestals. You ask your guide what was on display before. “Nothing,” he chuckles. You comment on the number of empty rooms and displays, and the guide laughs dismissively. “Much has been lost over the years,” he says. Looking out over the city skyline, filled with odd dips and empty gaps, you wonder if Rome itself is disappearing.</p><ul><li>Each investigator may begin the next scenario they play with 1 additional resource in their resource pool.</li><li>You may return to Rome again during this campaign, but only after playing another scenario.</li><li>You may _embark_.</li></ul>"
      },
      "theSafehouse": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "The Safehouse",
        "theSafehouse1": "<p>_The Safehouse 1_: It’s a good thing the locals here are fairly welcoming and don’t seem to mind you asking directions, because “abandoned cigar factory” doesn’t exactly narrow things down. The bustling Ybor City district near Tampa is home to many such factories built and run by thousands of immigrants from all over. If you had to check each and every factory, you’d be here all week. Luckily, you have a lead just north of the bay: a quiet, run-down building with an adjoining boarded-up warehouse. If you didn’t know the truth, you’d think it was nothing more than an out- of-date factory from the ’80s, probably filled with nothing more than dust and rats. But if you’ve learned anything in your travels, it’s to never trust the evidence of your eyes.</p><p>You cautiously approach the main entrance and attempt to open it. As you suspected, it does not budge. If this is truly a Coterie sanctum, it’ll be harder than that to get inside. There’s no easy way in through the third- story windows, so you circle around the side of the warehouse, spotting a large metal door likely used for loading goods or unloading supplies. As there is no handle or lever, you decide to knock. A moment later, a gruff voice responds from the other side: “Passphrase.”</p><p class='basic'>Check the Campaign Log.</p>",
        "safehouse": "*If you know the passphrase* and the current time is at or after _Θ_ (theta), proceed to _The Safehouse 2_.",
        "noSafehouse": "Otherwise, skip to _The Safehouse 3_.",
        "theSafehouse2": "<p>_The Safehouse 2_: You lean in and utter the words that Desi taught you—”Blackbird Solitaire”—and the door slides open. On the other side, a muscular man with a thick mustache gives you a toothy grin. The hand hovering just over the handle of a revolver holstered at his side gives you pause, but after a moment, he steps aside to let you in. “Boss said you might be stopping by,” the doorman says. “He said to let you look around and take whatever you need.”</p><p>You step inside and eye the man carefully. Last thing you need is a bullet in the back just as soon as you begin your search. As if sensing your concern, he slowly unholsters his gun and empties the cylinder. “Look, friend. I know what you did for Desi. Any friend of his is a friend of mine,” he states, meeting your suspicious gaze head-on. “Whatever you’re looking for, it’s yours.”</p><p>It doesn’t take too long for you to find the Key Desi had stashed here. Mounted on a far wall of the warehouse, over a midst of a trove of supplies and ammunition, its alien sheen reflects a warped view of your startled countenance. It is a double-edged blade of considerable length, although it has no handle or grip with which to wield it. It might be a weapon, but it is no mortal one, that is for sure.</p><p>“That old thing?” the gruff man asks as you delicately remove it from its mount. “Just a weird hunk of metal, that is. Thought Desi just kept it here for kicks. Creeps the hell out of me.” As you hold the blade over both of your hands, a gentle pulse of energy quivers through its length. Not a decoration, then—this is the real deal.</p><p>You also sift througth some of Desi’s records and intel while you are here. Not much that you don’t already know, but it looks like he’s been keeping tabs on a few of his cohorts. There are more than a few clandestine photographs of a woman carrying a red parasol over her shoulder. In the clearest of these, the woman is giving the camera a knowing smirk. She knew Desi was on to her. On the back, in sloppy handwriting, black ink reads: “You’re in too deep this time, Tzu.”</p><p>You browse a bit more, but you aren’t going to find much else here. Desi’s operation is quite a bit different from the Coterie’s stated goals, it seems. Perhaps there is more to them than the Foundation believes. Or, it’s just another front. Doesn’t matter. You have what you came for.</p><ul><li>Choose an investigator to be the bearer of The Mirroring Blade and update the Campaign Log accordingly. This card can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon: <section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Each investigator earns 2 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "theSafehouse3": "<p>_The Safehouse 3_: No matter what you say, the voice on the other side of the door remains silent. Then, muffled yet distinct, you hear the telltale sound of a revolver being slowly chambered. With that, you decide to take your leave. You’ll have to return later, when you know how to get in…</p><p class='basic right'>You may return to this location again later. For now, you may _embark_.</p>"
      },
      "whistleOnTheWind": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "Whistle on the Wind",
        "label": {
          "accept": "Accept what she is offering you.",
          "reject": "Do not accept her offer."
        },
        "whistleOnTheWind1Part1": "<p>_Whistle on the Wind 1_: A chill breeze flutters through the streets of Kathmandu, along with a faint, shrill whine. To the north, the Himalayas loom over the city, only their peaks illuminated by the westward sun. Pinks and purples bathe the sky in vibrant beauty. You could stare at such a breathtaking sight forever…but you have a job to do. Despite the quiet, peaceful evening, that soft, sharp piping does not cease, like an aching sense of dread in the back of your mind. As the evening drags on and the whistling grows louder, you realize you are the only one who can hear the strange sound. It feels as though it is reaching out to you directly. As if it hears you, too. As if it knows you. On a whim, you close your eyes and strain yourself to listen closer. It’s difficult to tell where exactly the sound is coming from—it seems to waft all around you and echo throughout the streets—but it grows in volume as you round the nearest corner and head north. And so north you continue.</p><p>Eventually, you reach an art gallery nestled between several age-old buildings. The whistling here is fevered and unpleasant, like a boiling kettle. Though the gallery is closed at this late hour, you are able to easily find an open side entrance. You brace yourself and enter the gallery, where dozens of Nepalese sculptures and paintings are on display—many carved out of wood or stone, others made out of ashtadhatu, an amalgam of eight different metals, and still others made of terra cotta. The whistling suddenly stops the moment you reach the rearmost section of the gallery, where a single lot remains strangely empty. There is no trace of what might have been there; just an empty space where something historic and treasured is clearly meant to be. Then, a lone voice pierces the sudden quiet, speaking in a language you do not understand.</p><p>You turn on your heels, body tensing. On the other end of the hall is a girl dressed in white, her figure seemingly ethereal in the faint beams of fading sunlight that permeate through the building. Her long black hair is draped over her face, masking her expression. A long scarlet sash wrapped around her waist flutters behind her, despite the fact that there is no breeze.</p><p>You freeze. The figure of the girl does not move. Her hair and sash drift steadily in the stillness. Then, she speaks once more. Again, you don’t understand a single word of it, though you notice that she has switched languages. Recognizing a few root words, you realize she is using Latin. She speaks again, this time in what sounds like ancient Greek. If she is trying to communicate with you, it may be wise to play along. You ask her what she is doing here; why she guided you here. Her response is in yet another language that eludes you, this one sounding somewhat like a blend of Egyptian and Greek.</p>",
        "drifter": "<p class='red'>_Read only if an investigator has the Drifter trait (excluding Wendy Adams)_: In your travels, you’ve been to quite a few places. You’re no stranger to different languages. You attempt a few of your own, but each time you are met with silence. And yet, she appears to want to communicate with you, and is consistently switching languages herself, only without any overlap. Is she only able to speak in long-dead languages?</p>",
        "whistleOnTheWind1Part2": "<p>Due to the language barrier, it’s difficult to get a sense for what she wants from you. As you attempt to decipher her intent, she approaches slowly, her steps making no sound whatsoever along the wooden floor. She gestures to the empty lot next to you and whistles softly, as though the sound might carry with it some meaning. You wonder if perhaps there might have once been something here, and then realize: it is gone, vanished from history without so much as a trace. You recall the woman’s name from the Foundation’s dossier and ask her if she is also on the trail of the entities responsible for these kinds of disappearances. Aliki Uperetria does not seem to understand you, but she tilts her head in recognition at the sound of her own name. Then she wrenches something from around her neck and extends it to you in a closed fist.</p><p class='basic'>The lead investigator must decide (choose one):</p><ul><li>*Accept what she is offering you*. Proceed to _Whistle on the Wind 2_.</li><li>*Do not accept her offer*. Skip to _Whistle on the Wind 3_.</li></ul>",
        "whistleOnTheWind2": "<p>_Whistle on the Wind 2_: You extend your hand, and a small device on a silver chain falls into your palm. It is a whistle, carved out of bone to look like the head and beak of a white raven. Glancing back up at Aliki, she points toward the plaque next to the empty lot and says something once more in what sounds to you like Latin. You ask what she is after, and what the significance of the whistle is, but she remains cryptically silent. Turning over the whistle in your hand, you find no markings or clues as to its purpose. When you glance back up to question Aliki, she has vanished, replaced once more with a cold wind that seeps into your skin. Then, though no one else seems to hear it, the piping returns, soul-wrenching, ear-splitting. It does not cease for as long as the whistle remains in your possession.</p><ul><li>In your Campaign Log, record *the cell possesses a mysterious whistle*.</li><li>Each investigator suffers 1 mental or 1 physical trauma as the shrill sound follows them everywhere they go.</li><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>You may _embark_.</li></ul>",
        "whistleOnTheWind3": "<p>_Whistle on the Wind 3_: You back away with caution. If a member of the Coterie—especially one as cryptic and potentially dangerous as Aliki—is offering you something, it can’t mean anything good. Besides, your mission is to ensure they cannot collect any more Keys, not to cooperate with them…right? Aliki’s hand lowers, along with the temperature in the room. She seems to sense your mistrust and return it tenfold, though she no longer attempts to speak. Moments later, the cold wind returns, and to your surprise, she is gone.</p><ul><li>In your Campaign Log, record *the cell refused Aliki’s offer*.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>You may _embark_.</li></ul>"
      },
      "infernalMachinery": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "Infernal Machinery",
        "infernalMachinery1": "<p>_Infernal Machinery 1_: A heavy grey mist hangs in the air above Lake Victoria as your biplane touches down on a dusty runway. All leads in Nairobi about a Tuwile Masai point to the shoreline of Lake Victoria, where the Coterie member is said to have transported several tons of survey equipment. A faint but sharp scent of alkaline carries on the breeze as you walk to the lake, where several large boats are laden with heavy machinery at the shoreline. Sunlight catches on a pair of thick-rimmed spectacles down at the pier.</p><p>“Professor Masai?” you greet the wiry man as he steps ashore. Masai looks nervously past you as he wipes his glasses.</p><p class='basic'>Check the Campaign Log.</p>",
        "reputation": "If at least three of the following are recorded (*La Chica Roja is on your side*, *the cell aided the knight*, *Aliki is on your side*, *Desi is on your side*, *the cell made a deal with Thorne*, or *Ece trusts the cell*), proceed to _Infernal Machinery 2_.",
        "noReputation": "Otherwise, skip to _Infernal Machinery 3_.",
        "infernalMachinery2": "<p>_Infernal Machinery 2_: “Your reputation precedes you. As did the sound of your aeroplane,” Masai smiles, though you can sense a nervous undercurrent in his demeanor. “You have caught me at just the right time. Would you care to accompany me out to the water?”</p><p>You cordially accept, and the professor leads you to board the boat to take a seat at at the stern. A half dozen crew members board, and the engine thrums to life as you cut a path across the glassy surface of the lake. After setting course, the professor hunches in his seat across from you and studies you through heavy red-rimmed glasses. “In truth, I am surprised you sought me out. I am hardly the mover and shaker I once was in the Coterie. Now, their concerns seem trivial in comparison with all the great work that must be done.”</p><p>When you ask about his great work, the professor smiles. “It is the work of every person. What is it to be human except to live and help others in this great and perilous world? It’s harder than you might think.” He leafs through several papers, holding them tightly as the wind off Lake Victoria picks up. Masai shows you several complicated graphs and charts.</p><p>“The lakebed here is covered in the ruins of a sunken city built long ago. I happened upon it when monitoring acidity and chemical levels. Something was increasing—or perhaps better put: producing—an incredible amount of carbon dioxide. Along with several odd mutations in local fauna and flora. After several months of searching, we were able to trace the production to its source.” The professor pinpoints a red X on a large map of Lake Victoria. You ask if that is where the boat is headed now, and the professor chuckles. “No. It is already done. The source of the unusual production was an object of power. A Key. We drudged it up just last week.”</p><p>The hair on the back of your neck raises as the crew cuts power to the engine. None of them appear armed, but you are suddenly aware of your vulnerable position.</p><p>“Don’t fear for your life, my friend,” Masai rubs his glasses with a cloth. “I am not your enemy. Though I do worry for the Coterie itself. There is something strange at work among them. The one with the gloves in particular. He has been silent for too long, I think.” The professor sighs and leans back in his seat. Around you, the placid water of Lake Victoria ripples, dreamlike, as a heavy storm stirs the clouds overhead.</p><p>“It’s yours, of course,” Masai says, eyes closed, as he looks up at the sky. “The artifact we found was some infernal machine that was still running, even now, at the bottom of the lake. I wonder who started it, and when? And what will happen if it ever stops running? Either way, if your track record with my colleagues is to be believed, it is safer in your hands than in mine.” He opens his eyes and stares at the surface of the lake as the crew rev the engine.</p><p>“Perhaps you will succeed where I failed.”</p><ul><li>In your Campaign Log, record *Tuwile Masai is on your side*.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Choose an investigator to be the bearer of The Bale Engine and update the Campaign Log accordingly. This card can be found in the Globetrotting encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "infernalMachinery3": "<p>_Infernal Machinery 3_: “I’m terribly sorry, but I don’t have time to chat,” Masai says as he steps lightly past you. You follow him, pressing for some assistance or insight, anything that can help in your struggle with the Red Coterie. “Ah. I had no idea I was dealing with the Foundation. You must be new.” Masai regards you in a new light, then leads you to sit in a makeshift camp. “Very well. Please wait here, and I’ll help you as soon as I can.”</p><p>You sit in a comedically short camping chair under the awning as the professor walks out of view. The minutes drift away as the clouds overhead break and a heavy rain begins to fall. After waiting for some time, you stand up and look out to the shoreline: the boats have gone. When you ask the locals for the professor’s whereabouts, they tell you he ended his survey and paid for passage across the lake.</p><p>After returning to Nairobi, you check with the British Consulate and discover that Masai’s travel expenses were being footed by his fellowship with Oxford. His declaration of travel includes an obscure address in Bermuda. Pocketing the information, you continue your travels.</p><ul><li>In your Campaign Log, record *Tuwile Masai fled to Bermuda*.</li><li>You may _embark_.</li></ul>"
      },
      "bloodSweatAndTea": {
        "title": "Blood, Sweat, and Tea",
        "body": "Check the Campaign Log.",
        "aided": "*If the cell aided in Flint’s investigation*, proceed to _Blood, Sweat, and Tea 1_.",
        "tenOrLessTime": "*If Flint is working solo and 10 or fewer time has passed since psi _ψ_*, skip to _Blood, Sweat, and Tea 2_.",
        "moreThanTenTime": "*If Flint is working solo and more than 10 time has passed since psi _ψ_*, skip to _Blood, Sweat, and Tea 3_.",
        "bloodSweatAndTea1": "<p>_Blood, Sweat, and Tea 1_:  On the train into Hong Kong, Agent Flint shares his current lead with you. “Tzu San Niang is due to meet with her new business partners this afternoon at a local teahouse. From what I gather, they’re a real rogue’s gallery of scumbags. The type that makes their fortunes by exploiting their workers to death. She’s so drawn to these types, it gives me a theory. She’s not just taking these jobs because they pay well. Time and again she goes for these deals where she can help the British at the expense of the common folk. It’s like she’s…attracted to the suffering she causes. Maybe worse.”</p><p>Before you can discuss this theory in more depth, your train arrives at its stop. You and Flint hurry onto the platform and rush to the teahouse, but you arrive too late: a telltale red parasol is sifting through the street crowd, heading swiftly away. You follow the parasol with your eyes as its bearer steps into a nearby alleyway. Flint whispers to you to stay, but you can’t while your quarry is so close.</p><p>The moment you enter the alleyway, Tzu San Niang turns and looks you in the eye. “I am used to attention,” she croons, “but I heard you were a little too interested in me.” She raps the tip of her parasol onto the street, and a burst of silvery energy rushes through the ground, jumping into your body. Your skin goes suddenly numb, and you collapse to the ground. The painful pinprick sensation of a sleeping limb takes over your entire body. Tzu San Niang smiles, puts her parasol over her shoulder, and walks away. She gets a few yards away and, apparently believing she is out of earshot, she tells her entourage: “We are done here. The Foundation is on to us. Eliminate them and move on to the Selangor Club harvest.”</p><p>You hear feet shuffling in your direction, but before any reckoning comes, Flint picks you up and drags you back out to the street, where the crowd and broad daylight might keep you from overt harm…for now. As the sensation in your limbs returns, Flint muses aloud. “The Royal Selangor Club—that’s a social club in Kuala Lumpur. Come on, we have no time to lose.” He helps you to your feet, but you’re still recovering from the blast of energy that sent your body and mind reeling. The parasol isn’t just a Coterie insignia after all—it is a Key!</p><ul><li>In your Campaign Log, record *Flint traveled to Kuala Lumpur*.</li><li>In the Southeast Asia section of the Campaign Log, find Kuala Lumpur. In its spot, write “46–Q.” You are now allowed to travel to Kuala Lumpur whenever you embark.</li><li>You may _embark_.</li></ul>",
        "bloodSweatAndTea2": "<p>_Blood, Sweat, and Tea 2_: You meet Agent Flint at the Hong Kong Zoological and Botanical gardens. He shakes your hand and leans in close. “Do you have a tail?” he asks. You assure him you do not. You have been careful.</p><p>He updates you on the case while the two of you stroll through the gardens, looking to all the world like normal tourists. He explains that the lady with the red parasol is using the name Tzu San Niang, and that she has made an international business out of helping the British expand their empire, often using the most brutal methods. Her silver tongue and negotiating skills are apparently the thing of legend: she can convince worker unions to tolerate abysmal conditions, local governments to accept the extraction of natural resources without batting an eye, and worse.</p><p>“We can’t be too careful,” Flint warns. “Obviously, Ms. Tzu is no one to be trifled with, but it’s that parasol that’s the key to her operation, if you’ll pardon my pun. I think it actually is giving her the ability to sway minds.”</p><p>You can’t object—the evidence is piling up. Flint’s initial hunch was right. “What’s worse is that she already suspects we’re on to her. I had a Coterie operative sniffing me out just earlier this week. Luckily, I managed to get the upper hand. Found his safehouse before he found mine. And the best part?” He gives you a sly grin. “He had an itinerary on him. They’re headed to the Royal Selangor Club next. It’s a social club in Kuala Lumpur, for the wealthy elite. Care to join me?”</p><ul><li>In your Campaign Log, record *Flint traveled to Kuala Lumpur*.</li><li>In the Southeast Asia section of the Campaign Log, find Kuala Lumpur. In its spot, write “46–Q.” You are now allowed to travel to Kuala Lumpur whenever you embark.</li><li>You may _embark_.</li></ul>",
        "bloodSweatAndTea3": "<p>_Blood, Sweat, and Tea 3_: You reply to Agent Flint’s telegram, but he never returns your message. You head to Flint’s last known hotel to inquire personally, but they tell you that he never received your telegram. In fact, according to the concierge, he hasn’t been back in several days. You decide that the Coterie must be behind this disappearance, and that the best way of finding Flint is to find the lady with the red parasol.</p><p>For days you search for signs of the Coterie, but find nothing. You establish the trust of some business contacts and begin to ask them about the lady with the red parasol. Most of them pretend to know nothing, but eventually you hear about a railway being constructed in Malaysia. The rail was delayed, but they sent a negotiator in to reach an agreement, saying “no one says no to her.” Maybe Flint simply went to Kuala Lumpur to investigate on his own, but…</p><p>A lump forms in your throat. You suspect the worst.</p><ul><li>In your Campaign Log, record *Agent Flint is missing*.</li><li>In the Southeast Asia section of the Campaign Log, find Kuala Lumpur. In its spot, write “46–Q.” You are now allowed to travel to Kuala Lumpur whenever you embark.</li><li>You may embark.</li></ul>"
      },
      "ringingHollow": {
        "title": "Ringing Hollow",
        "body": "Check how much _time_ has passed in the Campaign Log.",
        "lessThanTwentyTime": "If less than 20 _time_ has passed, proceed to _Ringing Hollow 1_.",
        "twentyOrMoreTime": "If 20 or more _time_ has passed, skip to _Ringing Hollow 4_.",
        "ringingHollow1": "<p>_Ringing Hollow 1_: You arrive in Sydney and immediately search for the agent described in Taylor’s dossier, finding her safehouse in an old, condemned warehouse by Botany Bay, on the eastern side of the city. She has an entire wall of filing cabinets containing years and years of research, and her table is covered in a mess of maps and photographs. “Ah, the new cell,” she regards you, flipping on a fluorescent light that coldly illuminates the room. “The name’s Quinn. The commissioner told me you might drop by.”</p><p>You ask her what kind of intel she might have to aid your investigation, which earns you a chuckle. “What don’t I have? Well, let me show you what I am looking into right now…”</p><p class='basic'>Check the Campaign Log.</p>",
        "toldTheTruth": "*If the cell told the truth to Taylor*, proceed to _Ringing Hollow 2_.",
        "hidTheTruth": "*If the cell hid the truth from Taylor*, skip to _Ringing Hollow 3_.",
        "ringingHollow2": "<p>_Ringing Hollow 2_: “I have been looking into the disappearances you mentioned to Taylor. She is concerned about these events, but perhaps not as much as she should be.” She hands you a file from her table and leans back as you examine it. It’s a host of information regarding missing buildings, sites, in some cases even entire villages, all of which vanished mysteriously and without explanation. “Sound familiar?”</p><p>You nod and inform Quinn this is precisely the kind of thing that you’d been looking into before you were recruited to the Foundation. You take the time to tell Quinn everything you know regarding the strange entities you have spotted numerous times in your travels, and what their presence does to objects and people alike.</p><p>“That lines up with my research,” she says, motioning to her cluttered table. “But if that’s true, these things have been active for literally hundreds— thousands of years. And we have collectively forgotten everything that has been erased, save for a desperate few that cling to memory. Do you understand what this means?”</p><p>Other than the obvious—that humanity is in very real danger of becoming forgotten history—you aren’t sure what she is getting at.</p><p>“I have a hunch, but I cannot look into it here. Looks like I’m headed back to Britain. I know you have your own assignment to get to, but, if you can spare the time, can you come meet me in Amesbury? It is just due west of London.” Wearing a taut but determined grimace, Quinn gathers some personal belongings and leaves you with more questions than answers.</p><ul><li>In the North Atlantic section of the Campaign Log, find London. In its spot, write “27–H.” You are now allowed to travel back to this location whenever you embark.</li><li>You may _embark_.</li></ul>",
        "ringingHollow3": "<p>_Ringing Hollow 3_: “This is off-book, but I’ve been looking into some pretty strange events. Take a look.” She hands you a file from her table and leans back as you examine it. It’s a host of information regarding missing buildings, sites, in some cases even entire villages, all of which vanished mysteriously and without explanation. You do your best not to let your familiarity with such events show on your face. “Any of this mean anything to you?”</p><p>You don’t like lying, but telling the truth now would reveal your earlier deception to Taylor. You shake your head, telling Quinn this is new to you. “That checks out. See, that is what’s so hinky about all this. You are holding the only surviving records of any of these places. It is as though all of them were completely eradicated from history. And if that is true, who is to say the same could not happen to us?” She shudders. “The thought of being forgotten like that…even by those closest to me…it is my worst fear.”</p><p>You tell Quinn that you feel similarly, and that you wish you had more intel to give her. Her gaze, narrow with suspicion, sees right through you.</p><p>“I do not buy that for a second. Taylor might trust you, or maybe she just does not want to get her hands dirty. But I can tell when someone is lying to my face.” A grim silence hangs in the air. Finally, she exhales. “Fine. Do as you will. But if you decide to spill, you can find me in Amesbury, due west of London,” she says, packing some of her files and personal belongings in a small canvas duffel bag. You repeat her destination, curious as to why.</p><p>“Something there I want to look into,” is all she gives you. You suppose it is only fair, considering your hesitance to give her the full story. She gives you no more than a cold glance as she leaves, and you wonder if perhaps you should have warned her. But what she doesn’t know can’t hurt her…right?</p><ul><li>In your Campaign Log, record *Agent Quinn does not trust the cell*.</li><li>In the North Atlantic section of the Campaign Log, find London. In its spot, write “27–H.” You are now allowed to travel back to London whenever you embark.</li><li>You may _embark_.</li></ul>",
        "ringingHollow4": "<p>_Ringing Hollow 4_: You arrive in Sydney and immediately search for the agent described in Taylor’s dossier, but everywhere you search, there appears to be no trace of her, nor any memory of her among the locals. Feeling worried, you redouble your efforts and eventually track her to an old, condemned warehouse by the bay on the eastern side of the city. Inside is an entire wall of filing cabinets containing years and years of research, and a table covered in a mess of maps and photographs. But there is no sign of Agent Quinn.</p><p>Judging from her recent notes, she appeared to have been researching the same kind of paranormal events you’d been looking into before you were recruited to the Foundation—missing buildings, sites, in some cases even entire villages, all of which vanished mysteriously and without explanation. But if she came to any conclusions, you find no evidence of it.</p><p>With no other leads, you depart, filing a report on Quinn’s disappearance for the commissioner. You hope she is simply in hiding somewhere, but your instincts tell you otherwise.</p><ul><li>In your Campaign Log, record *Agent Quinn vanished from existence*.</li><li>You may _embark_.</li></ul>"
      },
      "deadAndGone": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Dead and Gone",
        "label": {
          "truth": "“Tell Agent Quinn the truth.”",
          "secrets": "“Keep your secrets.”"
        },
        "deadAndGone1": "<p>_Dead and Gone 1_: You arrive in London and follow Agent Quinn’s directions to get to the town of Amesbury. Immediately after checking into a hotel, your concierge wordlessly hands you a note with an address by the side of a park on the western side of the historic town. You head there immediately, only to find Agent Ari Quinn sitting in the driver’s seat of a Bentley, reading a newspaper and not paying you any heed. Without making a scene, you silently climb into the passenger seat. “Finally. Been waiting here all day.” You’re not even sure how Quinn knew you’d arrived in town, but you suppose the Foundation must have eyes and ears all over every harbor and border checkpoint. You ask her what she’s been up to, and what she wanted to show you, at which point she starts the Bentley’s engine and rolls along the road to the west. “You’ll see.” Just a short drive later, you come to a familiar sight. You should have known— Quinn has taken you to the site of mysterious and prehistoric Stonehenge. A ring of standing stones marks the site, inside which another ring of smaller bluestones seem to serve no particular purpose whatsoever. A few tourists peruse the monument in awe, but it is otherwise quiet. You follow close behind and ask Agent Quinn why she asked you to come all this way. “Strange place, is it not?” she asks. A rhetorical question—historians have long debated over the likely function of the landmark, but none know for certain. As you draw nearer, she points to the various standing stones and to the concentric ring of smaller stones inside. “Almost seems like something is missing.”</p><p class='basic'>Check the Campaign Log.</p>",
        "noTrust": "*If Agent Quinn does not trust the cell*, proceed to _Dead and Gone 2_.",
        "trust": "Otherwise, skip to _Dead and Gone 5_.",
        "deadAndGone2": "<p>_Dead and Gone 2_: Quinn’s demeanor changes when she sees the look on your face. “Well, that triggered something. Still going to play it tight-lipped?” She heads to the center of the bluestone ring and takes out a small contraption possessing a series of lights along its surface. It lets out several beeps, rising in frequency as she reaches the very center. “Yeah, that just about confirms my suspicions…but I’m still missing the why. So, enlighten me, since you seem to know more than I do: what the hell could have made part of a structure vanish not just from existence, but from recorded history as well?”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*Tell Agent Quinn the truth*. Proceed to _Dead and Gone 3_.</li><li>*Keep your secrets*. Skip to _Dead and Gone 4_.</li></ul>",
        "deadAndGone3": "<p>_Dead and Gone 3_: You tell Quinn everything—about the entities you were investigating in London, about their presumed connection to the Red Coterie, all of it. She listens intently, hanging on every word. “So these things, these… let us presume to call them ‘extraterrestrials,’ when they take something, it vanishes completely. Do you understand what this means?” You know a great many conclusions that could be drawn from these events, but you encourage her to continue on her own. “Everything we know, everything we can see, it’s just what’s left. Look at Stonehenge. We have no earthly clue what it is. Maybe that’s because it’s incomplete. There could have been dozens of other structures erected right where we stand and humanity would never know.” She paces back and forth, agitated. “This is my life’s work. I’ve studied these kinds of events for over a decade. Paranormal disappearances. Dead civilizations. Bloody hell, I’m fluent in a dozen dead languages. I’ve always assumed these events are a small slice of pie missing from the greater whole. But what if we’re only seeing what’s left—the tiny slice of pie these creatures haven’t stolen?”</p>",
        "gainTrust": "In your Campaign Log, cross off *Agent Quinn does not trust the cell*.",
        "swapElderThingForTablet": "Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).",
        "check": "Check the Campaign Log.",
        "goOffMission": "*If the cell possesses a mysterious whistle* and 30 or fewer _time_ has passed, skip to _Dead and Gone 6_.",
        "stayOnMission": "Otherwise, skip to _Dead and Gone 7_.",
        "deadAndGone4": "<p>_Dead and Gone 4_: Quinn sighs and turns away from you. “Sorry to have wasted your time, then. You can take the Bentley back to London. It’s only a couple miles back to Amesbury. I’ll find another ride.” You try to reason with her, but she remains stoic. “If you have nothing to tell me, I have nothing to say to you, either. Please leave me be so I can continue my research in peace.”</p><ul><li>In your Campaign Log, record *the Foundation remains in the dark*.</li><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>You may _embark_.</li></ul>",
        "deadAndGone5": "<p>_Dead and Gone 5_: Quinn heads to the center of the bluestone ring and takes out a small contraption possessing a series of lights along its surface. It lets out several beeps, rising in frequency as she reaches the very center. “This confirms my suspicions,” she says under her breath, then shows her readings to you. “Found these same kind of readings in a lot of other places. Roanoke Island. Angkor. You get the idea.” She stands and taps the device against the palm of her hand as she scans the stone rings. “These things you mentioned in your report, these—let us presume to call them ‘extraterrestrials’—when they take something, it vanishes completely. Do you understand what this means? Everything we know, everything we can see, it’s just what’s left. Look at Stonehenge. We have no earthly clue what it is. Maybe that’s because it’s incomplete. There could have been dozens of other structures erected right where we stand and humanity would never know.” She paces back and forth, agitated. “This is my life’s work. I’ve studied these kinds of events for over a decade. Paranormal disappearances. Dead civilizations. Bloody hell, I’m fluent in a dozen dead languages. I’ve always assumed these events are a small slice of pie missing from the greater whole. But what if we’re only seeing what’s left—the tiny slice of pie these creatures haven’t stolen?”</p><p class='basic'>Check the Campaign Log.</p>",
        "deadAndGone6": "<p>_Dead and Gone 6_: Suddenly, what Agent Quinn just said snaps you to attention. Quinn is an expert in long-dead languages and ancient civilizations. You ask her if she’d be willing to help you with a related matter far from Amesbury. “If it will help me get to the bottom of this, then yes,” she replies eagerly. “What can I do for you?” With bated breath, you tell her it might require her to not inform the Foundation of her next whereabouts. She takes a moment to consider the implications, then nods, resolute. You hand her the whistle Aliki gave to you and tell her that it belonged to a Coterie member who seemed to know only Latin, ancient Greek, and other languages you could not decipher. She studies it for a long while, turning it over and over in her hand. “A white raven,” she murmurs to herself. “The Greek myths tell us that ravens were the messengers of the Gods; Apollo in particular. They were once all white, but when Apollo sent one to spy on his lover, Coronis, he learned of his lover’s infidelity and scorched the raven’s wings black in anger.” You ask Agent Quinn if there is any place in the world one might associate with Apollo or his raven. “There are temples in Rome dedicated to the god Apollo,” she says. “Apollo Sosianus and Apollo Palatinus. Let me know if you head there. I’ll meet you.”</p><ul><li>In your Campaign Log, record *the cell is off-mission*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "deadAndGone7": "<p>_Dead and Gone 7_: You and Agent Quinn explore the ruins for some time, jockeying theories and ideas back and forth, but find no further evidence.</p><ul><li>Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
      },
      "strangeArchitecture": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Strange Architecture",
        "body": "Check where you are on the map.",
        "inBombay": "If you are at Bombay, proceed to _Strange Architecture 1_.",
        "inStockholm": "If you are at Stockholm, skip to _Strange Architecture 4_.",
        "bombay": {
          "appreciated": "*If the cell appreciated the architecture*, proceed to _Strange Architecture 2_.",
          "notAppreciated": "Otherwise, skip to _Strange Architecture 3_."
        },
        "stockholm": {
          "appreciated": "*If the cell appreciated the architecture*, proceed to _Strange Architecture 5_.",
          "notAppreciated": "Otherwise, skip to _Strange Architecture 6_."
        },
        "strangeArchitecture1": "<p>_Strange Architecture 1_: The air is deliciously warm as you wait for a tram in southern Bombay. With several days until the next leg of your journey, you allow yourself to be drawn in by the city’s intoxicating color and light. A whirlwind first day sees you visit various temples, curio shops, and bazaars. Bright orange flowers hang by strings from bamboo racks as you make your way through a bazaar toward the Colaba Causeway, where the Gateway of India looks out onto the waterfront. As the day turns to evening, you continue to explore back alleys and side streets lit by delicately inlaid bronze lamps. The air is thick with unknown scents and hazy shapes as you lose yourself in the heady atmosphere of the old city. As you make your way to your hotel, you cross a wide thoroughfare into the Kala Ghoda district and stroll down its old, winding roads.</p><p class='basic'>Check the Campaign Log.</p>",
        "strangeArchitecture2": "<p>_Strange Architecture 2_: As you navigate the labyrinthine art district, you pass a familiar sight. Looking up, you see a narrow building with a slate façade, wide black windows, and unsettling accents. You have the distinct feeling you have been here before. You stand still for a moment as others pass you in the narrow street until you remember the same building in Stockholm. If not for the distinct, black windows and the harsh lines, you might not have remembered it. As you scan the façade, the frieze overhanging the door stands out to you. Where there were various recognizable figures before, you see odd, gangling facsimiles. The features are almost plastic; the smiles are too broad; the eyes seem to bulge. The number 13 is carved next to the door, same as in Stockholm. Curious, you step up and turn the doorknob, but it doesn’t budge. Knocking on the door produces virtually no sound. Although it looks like wood, it feels solid as concrete. Stopping a passer-by, you ask how long the building has been here. “This is an ancient place. These buildings have been here a long time,” they tell you. You find yourself questioning if the original you saw was even the original: how many other houses look just like this one in how many other cities? The building grows more foreboding the longer you look at it. A shudder courses up your spine, and you decide to leave the building alone.</p><ul><li>In your Campaign Log, cross off *the cell appreciated the architecture*. Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "strangeArchitecture3": "<p>_Strange Architecture 3_: As you navigate the labyrinthine art district, one façade in particular stands out to you. A narrow building with handsome cornice molding and intricate stonework is wedged between two older local buildings. The number 13 is carved next to a pair of austere wooden doors. Over the door is a slate frieze that depicts a cast of mythological figures: some recognizable, some not. The building itself looks out of place amidst the intricate architecture of the surrounding area. The look of the building makes you feel vaguely uneasy the longer you study it. There is a coldness, a sharpness to the building’s design, accentuated by jagged quoins and harsh angles. Something about the wide, black windows, the dark interior, denotes the emptiness of a hollow skull. The darkness in the evening only magnifies the sense of eeriness; others do not seem so willing to linger here.</p><ul><li>In your Campaign Log, record *the cell appreciated the architecture*.</li><li>You may _embark_.</li></ul>",
        "strangeArchitecture4": "<p>_Strange Architecture 4_: The docks bustle with activity as you arrive in Stockholm. Towering dock workers load massive crates of silvery, flapping fish into trucks as morning chimes ring in the cool clear air. With several days until your next departure, you seize upon the opportunity to explore the city’s eclectic culture. Advertisements for a production of a play named “Ödestimmen” paper the alleys and stops surrounding Stockholm’s largest theatre. You follow the cobblestone streets around Stockholm’s old town district, which the locals tell you is called “the town between bridges.” The winding narrow paths loop in on themselves and cross at odd angles to form a labyrinth of crumbled mustard-yellow alleys and worn façades. You pass a row of distinctly painted rowhouses overlooking the town square. As you sit down and watch locals come and go, you feel a great weight lift from you, if only for a moment. The broad blue sky overhead is clear and cloudless, and the hubbub around you is strangely calming.</p><p class='basic'>Check the Campaign Log.</p>",
        "strangeArchitecture5": "<p>_Strange Architecture 5_: As you walk down Shoemaker’s street, you pass a familiar sight. Looking up, you see a narrow building with a slate façade, wide black windows, and unsettling accents. You have the distinct feeling you have been here before. You stand still for a moment as others pass you in the narrow alley, until you remember the same building in Bombay. If not for the distinct, black windows and the harsh lines, you might not have remembered it. As you scan the façade, the frieze overhanging the door stands out to you. Where there were various recognizable figures before, you see odd, gangling facsimiles. The features are almost plastic; the smiles are too broad; the eyes seem to bulge. The number 13 is carved next to the door, same as in Bombay. Curious, you step up and turn the doorknob, but it doesn’t budge. Knocking on the door produces virtually no sound. Although it looks like wood, it feels solid as concrete. Stopping a passer-by, you ask how long the building has been here. “What do you mean? This is a very old city. It’s always been here,” they tell you. You find yourself questioning if the original you saw was even the original: how many other houses look just like this one in how many other cities? The building grows more foreboding the longer you look at it. A shudder courses up your spine, and you decide to leave the building alone.</p><ul><li>In your Campaign Log, cross off *the cell appreciated the architecture*. Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "strangeArchitecture6": "<p>_Strange Architecture 6_: As you walk down Shoemaker’s street, one façade in particular stands out to you. A narrow building with handsome cornice molding and intricate stonework is wedged between two older local buildings. The number 13 is carved next to a pair of austere wooden doors. Over the door is a slate frieze that depicts a cast of mythological figures: some recognizable, some not. The building itself looks out of place amidst the worn stone and crumbling history of the surrounding alleyway. The look of the building makes you feel vaguely uneasy the longer you study it. There is a coldness, a sharpness to the building’s design, accentuated by jagged quoins and harsh angles. Something about the wide, black windows, the dark interior, denotes the emptiness of a hollow skull. The alley around you, too, is strangely quiet: passers-by do not seem to linger here.</p><ul><li>In your Campaign Log, record *the cell appreciated the architecture*.</li><li>You may _embark_.</li></ul>"
      },
      "theoryOfAnnihilation": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Theory of Annihilation",
        "theoryOfAnnihilation1": "<p>_Theory of Annihilation 1_: As your ship puts into port at Rio De Janeiro, you see a massive hollow statue under construction on Corcovado mountain overlooking the city. The statue is vaguely humanoid, its arms spread wide in welcome . . . or is it a warning?</p><p class='basic'>Check the Campaign Log.</p>",
        "traveled": "*If the cell met Dr. Irawan* and less than 25 _time_ has passed, proceed to _Theory of Annihilation 2_.",
        "vanished": "*If the cell met Dr. Irawan* and 25 or more _time_ has passed, skip to _Theory of Annihilation 3_.",
        "met": "Otherwise, skip to _Theory of Annihilation 4_.",
        "theoryOfAnnihilation2": "<p>_Theory of Annihilation 2_: After some searching, you find Dr. Irawan in the Belmond Copacabana seated at a table covered in sketches and academic clutter. “I am actually glad you missed my lecture,” she says. “It was an utter disaster. I was laughed out of the auditorium when I tried to present. Someone called me a ‘cryptozoologist’.”</p><p>Dr. Irawan adjusts her large round spectacles as she turns to a beautifully detailed sketch of a bird roosting in a palm tree. “I presented what I am calling the Theory of Annihilation. A process by which an ecosystem is, itself, devoured via what you have dubbed ‘paranatural selection.’ Not just the ecosystem, but the memory of itself. The fact of its very existence.”</p><p>“Do not worry, I will credit you for that term,” she takes a sip of strong, dark coffee. “But after my recent survey of the Amazon, I am afraid the process is accelerating. A dozen species of macaw have vanished, and my colleagues have no memory of them. The sketches have disappeared as well. Of those we documented, only the scarlet macaw remains.”</p><p>As Dr. Irawan flips idly through her sketchbook, her eyes catch on a particular page, and her face goes white. “This cannot be.”</p><p>You ask her what the matter is, and she points to the page. “Just yesterday, this page was not blank. The Phalanger septimus. A cuscus living in the western New Guinea.”</p><p>Dr. Irawan begins gathering up her things. “I sketched this subject months ago. Perhaps there will be some trace of it—or of whatever force is behind all this—out in Manokwari.” She pushes a strand of hair behind her ear and smiles at you. “Thank you for listening. Perhaps we will meet again.”</p><ul><li>In your Campaign Log, record *Dr. Irawan traveled to New Guinea*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>Under “Time Passed,” write _δ_ (delta) underneath the current time. (*This symbol has no status report and is only used as a time marker.*)</li><li>In the Southeast Asia section of the Campaign Log, find Manokwari. In its spot, write “45–P.” You are now able to travel to Manokwari whenever you embark.</li><li>You may _embark_.</li></ul>",
        "theoryOfAnnihilation3": "<p>_Theory of Annihilation 3_: Upon arriving in the city, you look for Dr. Irawan at the Belmond Copacabana. The concierge checks the reservation on your behalf when you mention Dr. Irawan’s lecture, but finds nothing. You take out the card she gave you, but both sides are blank. It’s as though she has vanished completely…</p><ul><li>In your Campaign Log, record *Dr. Irawan vanished from existence*.</li><li>You may _embark_.</li></ul>",
        "theoryOfAnnihilation4": "<p>_Theory of Annihilation 4_: After some searching, you find Dr. Irawan in the Belmond Copacabana seated at a table covered in sketches and academic clutter. After introducing yourself, you ask about her research.</p><p>“Oh, I see. You are here to mock me,” she says, closing a worn survey journal. You tell her you aren’t, and after some coaxing, she opens up to you. “I am actually glad you missed my lecture,” she says. “It was an utter disaster. I was laughed out of the auditorium when I tried to present. Someone called me a ‘cryptozoologist’.”</p><p>You tell her that there are worse insults. “That may be,” Dr. Irawan adjusts her large round spectacles. “But for my career, it is a death knell.” She turns to a beautifully detailed sketch of a bird roosting in a palm tree. “I presented what I am calling the Theory of Annihilation. The world devouring itself. Not just itself, but the memory of itself. The fact of its very existence.”</p><p>She takes a sip of strong, dark coffee. “Several years ago, I surveyed the Amazon with a half dozen other well-known academics. We observed dozens of distinct species of macaw, and named each after a stone: turquoise, amethyst, obsidian, the like. But now,” she turns to several empty pages. “There is no trace or record of any of them. My colleagues tell me I made up the Turquoise Macaw and the others. There is no trace of them in their habitat, either. And the sketches have disappeared as well.”</p><p>You assure Dr. Irawan that she is not mad, and share what little you can about the disappearances.</p><p>“Thank you,” says Dr. Irawan. “I am glad we met. I was beginning to think this was all in my head.” She gives you her business card with the address of a university in Australia written on the back. “I will be in Perth to continue my survey and my next lecture. Perhaps I will see you there.”</p><ul><li>In your Campaign Log, record *the cell met Dr. Irawan*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>You may _embark_.</li></ul>"
      },
      "paranaturalSelection": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Paranatural Selection",
        "paranaturalSelection1": "<p>_Paranatural Selection 1_: A cool breeze greets you as you arrive in Perth. The capital of Western Australia is nestled in the crook of the Swan River, and despite—or perhaps because of—the nearby gold rush, it has the rugged feel of a frontier town. You catch a scent of something too sweet, possibly rotten, on the breeze.</p><p class='basic'>Check the Campaign Log.</p>",
        "traveled": "*If the cell met Dr. Irawan* and less than 25 _time_ has passed, proceed to _Paranatural Selection 2_.",
        "vanished": "*If the cell met Dr. Irawan* and 25 or more _time_ has passed, skip to _Paranatural Selection 3_.",
        "met": "Otherwise, skip to _Paranatural Selection 4_.",
        "paranaturalSelection2": "<p>_Paranatural Selection 2_: You find Dr. Irawan at the local university cleaning up an empty lecture hall. On the blackboard is a precise chalk drawing of a stocky marsupial clutching a cluster of sedge grass.</p><p>“I did not expect to see you here,” the zoologist sets to erasing the blackboard. You ask about the sketch. “It is a rare species of quokka: the red-tailed quokka. They were first introduced to the West by Dutch explorers in the 17th century. And now no one—not even the Cambridge professor who taught me their name—remember what they are.”</p><p>“I do not know how much you have studied natural selection, but what we are experiencing feels very much like the introduction of a new apex predator into an ecosystem that has not evolved to withstand it,” says the zoologist. “Except that this predator feeds not only on the body, but on the actual existence of its prey. Although, of course, that would be unthinkable,” she laughs. “But I cannot help feeling that we are its prey. And the process is only accelerating.” The zoologist sits down and begins to flip idly through a sketchbook.</p><p>Thinking on the terms the Foundation used, you suggest she name the phenomena “Paranatural Selection.” She looks troubled at the suggestion, then smiles.</p><p>“I will be sure to credit you,” she says, then goes pale. You look down and see her gaze fixed on a particular page in her sketchbook. “This cannot be.”</p><p>You ask her what the matter is, and she points to the page. “Just yesterday, this page was not blank. The Phalanger septimus. A cuscus living in western New Guinea.”</p><p>Dr. Irawan begins gathering up her things. “I sketched this subject from direct observation just months ago. Perhaps there will be some trace of it—or of whatever force is behind all this—out in Manokwari.” She pushes a strand of hair behind her ear and smiles at you. “Thank you for listening. Perhaps we will meet again.”</p><ul><li>In your Campaign Log, record *Dr. Irawan traveled to New Guinea*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>Under “Time Passed,” write _δ_ (delta) underneath the current time. (*This symbol has no status report and is only used as a time marker.*)</li><li>In the Southeast Asia section of the Campaign Log, find Manokwari. In its spot, write “45–P.” You are now able to travel to Manokwari whenever you embark.</li><li>You may _embark_.</li></ul>",
        "paranaturalSelection3": "<p>_Paranatural Selection 3_: Upon arriving in the city, you look for Dr. Irawan at the local university. A helpful professor scours the academic schedule on your behalf when you mention Dr. Irawan’s lecture, but finds nothing. You take out the card she gave you, but both sides are blank. It’s as though she has vanished completely…</p><ul><li>In your Campaign Log, record *Dr. Irawan vanished from existence*.</li><li>You may _embark_.</li></ul>",
        "paranaturalSelection4": "<p>_Paranatural Selection 4_: You catch Dr. Irawan walking out of a lecture at the local university and invite her to a nearby cafe to chat about her research. On a sunlit veranda, she lays several life-like sketches out on the table between you. “Have you ever heard of the red-tailed quokka?” she asks. You shake your head. “They were first introduced to the West by Dutch explorers in the 17th century, and have been listed in standard taxonomy since then. I learned about them at Cambridge.”</p><p>Dr. Irawan leafs through a sketchbook to a blank page. “On a survey five years ago, I took several sketches in the wild. But recently, I opened my books and the sketches were blank, as if they had never been drawn. Moreover, every footnote and reference to them in academia has vanished. I asked my professor at Cambridge—the man who taught me what red-tailed quokkas were—and he looked at me as though I had gone mad.” The zoologist adjusts her large spectacles.</p><p>You assure Dr. Irawan that she is not mad, and share what little you can about the disappearances.</p><p>“I do not know how much you have studied natural selection, but what we are experiencing feels very much like the introduction of a new apex predator into an ecosystem that has not evolved to withstand it,” says the zoologist. “Except that this predator feeds not only on the body, but on the actual existence of its prey. Although, of course, that would be unthinkable,” she laughs. “But I cannot help feeling that we are its prey.”</p><p>Thinking on the terms the Foundation used, you suggest she name the phenomena “Paranatural Selection.” She looks troubled at the suggestion, then smiles.</p><p>“Perhaps I will use that, with your permission,” says Dr. Irawan. “I am glad we met. I was beginning to think this was all in my head.” She gives you her business card with the name of a hotel in Brazil written on the back. “I will be in Rio de Janeiro to continue my survey, and my next lecture. Perhaps I will see you there.”</p><ul><li>In your Campaign Log, record *the cell met Dr. Irawan*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>You may _embark_.</li></ul>"
      },
      "metamorphosis": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Metamorphosis",
        "metamorphosis1": "<p>_Metamorphosis 1_: It is early evening as your boat pulls into port in Manokwari. Towering mountains covered in rich greenery roll down to meet the brilliant blue water. As night falls, coruscating lights dance beneath the surface of the water: are they bioluminescent plants, or something else?</p><p class='basic'>Check how much time has passed since _δ_ (delta).</p>",
        "tenOrLessTime": "If 10 or fewer time has passed since _δ_ (delta), proceed to _Metamorphosis 2_.",
        "moreThanTenTime": "If more than 10 time has passed since _δ_ (delta), skip to _Metamorphosis 3_.",
        "metamorphosis2": "<p>_Metamorphosis 2_: At first, you are concerned that nobody recognizes Dr. Irawan’s name, but after some persistent questioning, a reluctant local offers to lead you to her. Heading into the dense underbrush, you follow a steep path up a nearby mountain until you reach a dark hollow. Leaning against the trunk of an ironwood tree, you find the zoologist peering intently into the shadows.</p><p>“I did not expect you to follow me here,” Dr. Irawan whispers. Following her lead, you sit down next to her and peer into the dark. The air around you is thick and moist. “My theory was…incorrect. Or at least, partially incorrect.” From your vantage point, you can see into a shallow dell cut by a cascading waterfall. The moon shimmers on the ripples of a narrow stream. Dr. Irawan continues: “All trace of this particular cuscus is gone, that much is for certain. The locals have no memory of them. But something is different about the disappearance. Something lingers.”</p><p>A low, moaning wail from somewhere in the trees startles you. Dr. Irawan holds out a pair of binoculars and points at a cluster of ironwood trees on the far side of the glade. Peering through, you spy three cat-sized marsupials with yellow eyes clinging to a branch, curled tails swinging in the dark. They are feeding on something. Just looking at them makes your head spin: something about them is both there and not there at once, forcing your eyes to constantly adjust. The animals’ movements are stiff and double-jointed as well, both too fast and too slow. You look away.</p><p>“You see them?” asks Dr. Irawan. You nod and look again: the cuscus are messily devouring a green python. “It is fascinating. A fundamental change. The prey have become predators. The few I have observed have made a complete shift in behavior, turning on other cuscus, hunting their own natural predators—of which the green python is one. Their very nature seems to have changed!” Dr. Irawan stammers excitedly. “But more importantly, they aren’t gone. I mean: they have gone, to some. Nobody remembers them. But yet they persist.”</p><p>You turn your binoculars back to the cuscus to find them frozen: staring straight at you with their bright, topaz eyes. Surprised, you drop the binoculars. When you look again, the cuscus are gone. Suddenly on edge, you tell Dr. Irawan it would be best to leave, but she shakes her head. “I am on the verge of the greatest discovery of the century. An entire field of para-zoological research. I cannot leave now.”</p><p>Leaving Dr. Irawan to her own devices, you head back into town. The jungle around you is eerily silent, and even as you break into a moonlit clearing, you cannot help the feeling of being watched.</p><p>Over the next few days, you make contact with the zoologist in passing. The day your ship is scheduled to leave Manokwari, Dr. Irawan is suspiciously absent from the guest house. The staff tell you she didn’t return the night before. Concerned for her safety, you return to the hollow where you met her before. The jungle retains the same unsettling quietude as you hike up the mountain.</p><p>Scattered on a rock overhanging the dark hollow are several torn-up sketchbooks and a broken pair of binoculars, but no trace of Dr. Irawan. Scanning the murky copse, you see a glimmer of light and the zoologist’s batik vest at the base of the waterfall. You carefully pick your way down the muddy slopes to the bank of a narrow stream where the zoologist lays prone, her arm bent at an odd angle. A trio of yellow-eyed cuscus scatter as you approach. Turning her over gently, you are relieved to find her still breathing. A strange black implement is clutched in her left hand, close to her chest.</p><p>A mordant call resounds from above. Dr. Irawan is surprisingly light as you scoop her up in your arms. Dozens of yellow eyes glare down at you from the ironwood trees as you carry the zoologist downstream, away from the hollow. Flitting, shimmering forms dart to and fro overhead like silent warnings.</p><p>As soon as you get back to town, you check the unconscious zoologist into a clinic. The ship you had booked has already left, but with the strange circumstances you found her in, you resolve to stay with Dr. Irawan until she wakes up. Several days pass, filled with disquieting silence, until she finally speaks.</p><p>“I noticed several cuscus gathered around this,” she thumbs the hollow bell in her good hand. “I knew better than to interfere. But they seemed so fixated on it. Much like magpies or crows will hoard certain objects. So strange. I noticed they stowed it in the crook of a branch and, so I climbed up for a better look and—well, that’s when I fell,” she says.</p><p>You hold the strange chime in your hands, appreciating its heft and form. The inlaid designs are like nothing you or the zoologist have ever seen. The metal is cool to the touch yet strangely electric. On a whim, you hold the bell up and swing it once, even though it doesn’t have a clapper. A palpable wave of sonic energy ripples through the air around you. From the trees, you can hear a familiar mournful cry.</p><p>“This has become more than a simple survey,” Dr Irawan whispers. “Whatever those creatures have become, they are no longer Phalanger septimus. Something changed.” The zoologist pauses and considers her words for a moment, then smiles at you. “Whatever is happening, I—I would prefer to not work alone. Perhaps I could continue my research with you?”</p><p>You tell Dr. Irawan you wouldn’t have it any other way, and agree to stay with her as she recovers. The zoologist entrusts the strange bell to you.</p><ul><li>In your Campaign Log, record *Dr. Irawan joined the cell*. Any one investigator may choose to add the Dr. Dewi Irawan story asset to their deck. It does not count toward their deck size.</li><li>Choose an investigator to be the bearer of The Ruinous Chime and update the Campaign Log accordingly.</li><li>Both of these cards can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon: <section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "metamorphosis3": "<p>_Metamorphosis 3_: Asking around town, each mention of Dr. Irawan is met with a curious stare. You go so far as to mime the zoologist’s distinct large eyeglasses, but nobody recognizes the name or the likeness. After several days, you abandon your fruitless search. As you check out from the local guest house, you find a blank sketchbook sitting on a wicker table. Picking it up, your skin pricks, and you have the feeling of being watched. But when you turn around, you are completely alone.</p><ul><li>In your Campaign Log, record *Dr. Irawan vanished from existence*.</li><li>Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
      },
      "rusesAndReclamation": {
        "xp": {
          "bonus": "Searching Leads"
        },
        "title": "Ruses and Reclamation",
        "rusesAndReclamation1": "<p>_Ruses and Reclamation 1_: You search every known Coterie sanctum and safehouse in this region, looking high and low for the villain who stole your precious cargo, but find nothing. Either they’re not here, or they’re so well hidden that searching any more thoroughly would be a waste of time. Resigned, you plan your next move.</p><ul><li>In your Campaign Log, record *wrong leads*, and next to this, record 1 tally mark. (If *wrong leads* is already recorded in your Campaign Log, add 1 tally mark to it.)</li><li>You may _embark_.</li></ul>",
        "rusesAndReclamation2": "<p>_Ruses and Reclamation 2_: You finally narrow down your quarry and find their safehouse. Before rushing in, you lay low and wait for the right time to strike. With the element of surprise on your side, you tailor your approach to your foe…</p><p class='basic'>Mark 1 _time_ in your Campaign Log. Read only the following section that pertains to your situation. Then, you may _embark_.</p>",
        "theRedGlovedMan": "<div class='red bordered'><p>_If The Red-Gloved Man stole the Key(s)_: With a foe as enigmatic and potentially dangerous as The Red-Gloved Man, perhaps it is best to avoid confrontation altogether. You wait until you spot him leaving the sanctum and then start picking the lock of the same entrance…only, to your surprise, he has left it unlocked. You can almost imagine his blank stare from the shadows, mocking your every move. Does he know you’re here? Why steal from you only to hand the stolen objects back to you on a silver platter? In the end, you decide it is best to not look a gift horse in the mouth—after all, you’re not about to waste this opportunity. You grab the stolen relic and make your escape, wondering all the while the true motivations of the mysterious man.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theClaretKnight": "<div class='red bordered'><p>_If The Claret Knight stole the Key(s)_: Knowing the knight from Alexandria, you doubt he would dirty his hands personally—he must have sent enforcers to do his job for him. It’s likely he has set guards inside the safehouse, as well. Sneaking is probably out of the question, so you decide on a quick, direct approach: take the guards by surprise, grab what’s yours, and get out before they can respond with force. The job is clean and over in a matter of seconds. With the knight’s enforcers surely on your tail, you flee the city as fast as you can with your prize in tow.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theBeastInACowlOfCrimson": "<div class='red bordered'><p>_If The Beast in a Cowl of Crimson stole the Key(s)_: The Beast is no doubt the most violent and unpredictable foe you have encountered thus far. You count yourself lucky to have been out of your hotel room when it was sacked, or you would surely be dead. But from your mission in Alexandria, you know the creature has a weakness—it must hibernate from time to time. Quiet as a mouse, you slip into its sanctum unnoticed, the Beast’s rumbling breath emanating from a chamber deeper beneath your feet. Your heart races as you creep throughout the building, knowing any false step could spell your doom. The moment you grab the stolen artifact, the Beast begins to stir, and you rush to the exit. Even after putting miles between you and the creature’s lair, you can still hear its howls of anger and hate.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "laChicaRoja": "<div class='red bordered'><p>_If La Chica Roja stole the Key(s)_: You and La Chica Roja have been playing this cat-and-mouse game for weeks. You’ve tracked her down enough times by now to know her modus operandi perhaps better than any other living person. It’s even starting to become a little fun, this tête-à-tête. You sneak into her sanctum and locate the relic in a hiding place not unlike where a remnant of the Weeping Lady was found during your last encounter. With a bit of a chuckle, you replace it with a little calling card of your own and escape without notice. As you leave the city later that night, a bystander slips a red envelope onto your person, bearing a message: “Nice one. Let’s play again some time.”</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theSanguineWatcher": "<div class='red bordered'><p>_If The Sanguine Watcher stole the Key(s)_: Faceless servants with scarlet collars and wings of darkness circle the watcher’s sanctum overhead. You move carefully under the cover of night, hoping to avoid detection. The man’s sanctum is more akin to a workshop, filled with torturous implements and strange, arcane tools. Among the many instruments is that which he stole from you, placed in the center of one of his workbenches as though he was studying it. The moment you grab it and move to escape, you hear his startled voice from another doorway. “Who is there?” Two empty eyesockets glare in your direction as you turn to face him. “Who is that?” He scrambles to find his ruby spectacles, but you are long gone before he is able to put them on.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "amaranth": "<div class='red bordered'><p>_If Amaranth stole the Key(s)_: You sneak into Amaranth’s sanctum and find what she stole piled in the corner of a cavernous foyer. A weak roar breaks the silence, and you see a tattered lion glowering at you from the dark. Your shock turns to disgust as you watch the poor creature struggle to stand: it is too decayed to even move. “You got what you came for. Now leave,” says a voice from the shadows. Squinting your eyes, you see Amaranth bent over the lion, her cheeks wet with tears. “Khalid, please,” she whispers. The lion lets out a weak growl, then flops onto its side to expose its rotten belly. “I told you to leave!” Amaranth screams. Your disgust turns to pity as you make your exit.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "alikiZoniUperetria": "<div class='red bordered'><p>_If Aliki Zoni Uperetria stole the Key(s)_: To your surprise, the sanctum is completely empty. Not just empty, but abandoned entirely, perhaps for many years before you ever arrived. You wander through darkened halls and dusty, cobwebbed chambers, until finally you reach an old, decrepit bedroom. A full-length mirror adorns one wall, covered in dust and grime. Spotting a strange reflection in the glass, you wipe away the filth, revealing the haunting figure of Aliki behind you, her long, dark hair covering her eyes as she reaches for your neck. When you turn again, she is gone, but the feeling of something clenching around your neck remains. Spying your stolen Key on a nearby vanity, you snatch it and run, bursting through the door of the sanctum with a resounding thud. You don’t stop running until you have left the city behind.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "thorne": "<div class='red bordered'><p>_If Thorne stole the Key(s)_:  If there’s one thing you know about Thorne, it’s that they won’t pass on an opportunity to make a deal. Rather than sneak in, you knock on the front door of their sanctum and are admitted by several smooth, attractive attendants. Thorne sits at the head of a long table, hands steepled. “What a delight! I had no idea you were coming,” they smile brightly, then gesture for you to sit. Drinks and a lavish meal are served, and eventually you steer the conversation toward returning what they stole. “Ah yes. ‘Keys.’ It’s always about ‘Keys,’ isn’t it?” They pour another glass of wine. “Things have changed. I suppose I could be amenable to such an exchange. But only if you make it worth my while.” It takes nearly an hour to come up with compensation enough for Thorne to change their mind, but eventually you leave their sanctum with your stolen relic…and a bit poorer, besides.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "desiderioDelgadoAlvarez": "<div class='red bordered'><p>_If Desiderio Delgado Álvarez stole the Key(s)_: You sneak into Desi’s safehouse and are stunned to find that it is no vault or Coterie hideout, but a fully stocked bar with patrons in boisterous revelry. A bouncer in a pinstripe suit stops you as you enter, but before you can protest or fight back, you hear Desi’s voice call out: “Hey. It’s fine. Let ‘em in.” The bouncer relents, and you sit at a booth across from your adversary. “Guessing I know what this is about. Tell you what: I’m in a good mood. Have a drink or two and I’ll play you for it,” he says, shuffling a deck of cards. Seeing your expression, he grins. “Oh, lighten up. I’m not like those others. One hand. Then we call it even and go our separate ways.” Considering the circumstances, you decide it best to play along—literally. As luck would have it, three jacks is more than enough to beat Desi’s pair. You end up leaving shortly after with your Key reclaimed and no worse for the wear, wondering how much of a sore loser Desi and his crew might be.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "tzuSanNiang": "<div class='red bordered'><p>_If Tzu San Niang stole the Key(s)_: Given how dangerous Tzu San Niang was while in possession of a Key, you decide a direct confrontation is out of the question. Stealth is by far the better option. You sneak into a large industrial complex after dark and locate what she stole behind a locked door. As you pick the locks, you hear a lilting voice echo off of the narrow corridors. A haunting song in Shanghainese fills the empty factory. Working quickly, you reclaim the stolen artifact and retrace your steps to the exit, looking over your shoulder at every turn. The song lingers in your memory long after you make your escape.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "continue": "<p class='basic right'>Update the Keys section of your Campaign Log such that the Key(s) that were stolen return to their original bearers.</p><p class='basic right'>Each investigator earns 1 experience, plus 1 additional experience for each tally mark recorded next to *wrong leads*.</p><p class='basic right'>Cross off “14–C” on each of the remaining locations in the Campaign Log.</p>"
      },
      "theGreatWork": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "The Great Work",
        "theGreatWork1": "<p>_The Great Work 1_: The brilliant sandy beaches and azure water dazzle your senses as you arrive in Bermuda proper. Rows of brightly painted homes add to the eye-popping landscape as you travel from one corner of Bermuda island to the other, asking locals for any possible leads on Coterie activity.</p><p class='basic'>Check the Campaign Log.</p>",
        "activity": "*If Tuwile Masai fled to Bermuda*, proceed to _The Great Work 2_. ",
        "noActivity": "Otherwise, skip to _The Great Work 5_.",
        "theGreatWork2": "<p>_The Great Work 2_: After mentioning Tuwile Masai by name, you are directed to a residence just past the Gibbs Hill Lighthouse on the southern end of the island. The directions lead you to a lavish bungalow with a well- kept garden overlooking the ocean. Keeping your guard up, you walk to the screen door of the house and knock. A familiar figure wearing loose slacks and a maroon linen shirt opens the door.</p><p class='basic'>Check the Campaign Log.</p>",
        "proceed": "If at least two of the following are recorded (*Ece does not trust the cell*, *you haven’t seen the last of La Chica Roja*, *you haven’t seen the last of Desi*, *you haven’t seen the last of the Claret Knight*, *you haven’t seen the last of Thorne*, or *you haven’t seen the last of Aliki Zoni Uperetria*), proceed to _The Great Work 3_.",
        "otherwise": "Otherwise, skip to _The Great Work 4_.",
        "theGreatWork3": "<p>_The Great Work 3_: “If you have come to dispose of me, please make it quick,” Masai says coldly. He stands on the other side of the screen door, sweat beading on his dark skin, as he locks eyes with you. You try to explain yourself as best you can, but you can see from Masai’s body language and tone that he is set against you. After a chilly exchange, he steps onto the porch.</p><p>“Say what you will, but it is clear to me that you are interested in only one thing: power. If Commissioner Taylor had half her wits about her, she should treat you with the same fear as she treats me and my colleagues. None of you understand. None of you understand the great work we must do, as brethren, in order to live freely. One can only control the power of a Key so long before they themselves are controlled.”</p><p>Masai scoffs and takes off his large red spectacles. “You are no better than the worst of us.” He follows your gaze and holds up the spectacles. “These are of no significance. I learned too late of the dangers of holding such power myself. Now leave me in peace.”</p><ul><li>Each investigator earns 3 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>You may _embark_.</li></ul>",
        "theGreatWork4": "<p>_The Great Work 4_:  “You are either very persistent or very foolish,” Masai smiles. He steps out onto the porch and looks you up and down, as if sizing you up, then nods for you to follow as he walks out to the white-sanded beach. The waves lap hungrily at the shoreline as you walk alongside him.</p><p>“I apologize for my rudeness earlier. I couldn’t be certain of your intentions. And there have been a few…incidents lately,” Masai says gravely. A thick log of smooth driftwood lies buried in the sand in front of you, covered in a swarm of bright red-and-blue crabs. You ask about the incidents.</p><p>“A number of unannounced visits. The Foundation, obviously. Several days before your arrival at Lake Victoria, another member of my organization appeared at our camp, very interested in the key we had recovered. The one with the red gloves.” The professor stops, looking out at the rolling tide. “It bears explanation, I suppose. My survey of Lake Victoria turned up a number of alarming reports. The lakebed is covered in the ruins of a prehistoric city. We registered an alarming amount of carbon dioxide and strange changes in the local flora and fauna around the lake. At its source, we found a machine of alien design. Its purpose and facility are still a mystery, but whatever it was: it was running. Still is.”</p><p>Masai wipes his red spectacles with a handkerchief. “All that to say: several days before you arrived, I found that man sitting in front of the machine, hat off, staring at it. He was humming—well, that’s not quite right—he was communing with it.”</p><p>A shaft of cloud splits the sunlight overhead, casting the beach in dappled shadows. Masai’s voice breaks the silence. “In truth, I did not care to understand why. Why that man does anything has always been a mystery to me. But there was something other about his demeanor. Something altogether wrong.” Masai breathes deeply as the cloud passes, and warm sunlight overtakes the beach. “So imagine my suspicion when even more as yet unknown Foundation operatives showed up at my survey to interrupt my great work.”</p><p>You ask Masai about this “great work.” He leads you to turn around and begin walking back to his bungalow.</p><p>“It is the work of every person. What is it to be human except to live and help others in this great and perilous world? It’s harder than you might think.” He breathes deep. “If I can leave the world a bit better than I entered it, my work will be done. That is all. It is why the acquisition and squabbling over these Keys is such misdirection. One can only control a Key’s power so long before they become controlled.”</p><p>“But I sense a similar purpose in you,” Masai says. “I will not tell my colleagues we had this conversation, or what I have done with that infernal machine. The Key is yours, until you decide that it should not be. Keep it away from the man with the red gloves at any cost.”</p><ul><li>In your Campaign Log, record _Tuwile Masai is on your side_.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Choose an investigator to be the bearer of The Bale Engine and update the Campaign Log accordingly. This card can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "theGreatWork5": "<p>_The Great Work 5_: You are almost relieved that your questioning goes nowhere; the lack of Coterie activity in Bermuda gives you an unlikely chance to rest and recuperate. For just a moment, you need only to concern yourself with the peaceful stillness of the island.</p><p>With several days remaining until your next departure, you follow the recommendation of the concierge at your hotel and take the time to explore the Crystal Caves up near the northern end of the island. Your guide is missing an arm; they illuminate dancing patterns in the darkness with their flashlight as they tell you the story of how the caves were found. You ask them how they lost their arm. “I served in the Great War,” they tell you. “Sometimes peace comes at great cost.”</p><ul><li>Each investigator may begin the next scenario with 1 additional card in their opening hand.</li><li>You may return to Bermuda again during this campaign, but only after playing another scenario.</li><li>You may _embark_.</li></ul>"
      },
      "epilogue": {
        "title": "Epilogue",
        "epilogue1": "<p class='basic'>_Read the following only if the investigators won the campaign._</p><p>_Epilogue 1_: “Talk,” Commissioner Taylor commands.</p><p>You shift in your uncomfortable metal chair, the glaring light of her interrogation lamp nearly blinding you. One wall of the sterile interrogation chamber is covered by a black mirror that reflects you and the Commissioner sitting across a desk from one another, your faces blanched under heavy white light. Knowing the Foundation, several operatives are watching and recording your every move from behind the mirror. A thick dossier lies unopened on the desk between you and Taylor.</p><p class='basic'>Check the Campaign Log.</p><ul><li>*If the cell joined the Coterie*, proceed to _Epilogue 2_.</li><li>Otherwise, skip to _Epilogue 3_.</li></ul>",
        "epilogue2": "<p>_Epilogue 2_: Rather than answer directly, you ask instead what Taylor expected when she conscripted a random set of people into a Foundation cell. She looks genuinely caught off-guard as you explain your work and your role in assisting the Red Coterie to suppress what was clearly the greatest threat to humanity. The commissioner’s eye arches as you lean back in your seat in a gesture of casual indifference.</p><p>“I…see,” she visibly suppresses a grimace. You see her gaze linger on your crimson regalia. “You were hired for your curiosity, ingenuity, and independence. A statement which—may I remind you—is not to be taken as any form of compliment or commendation. It was an assumed risk that you might fall in with the Red Coterie, but one which I assured senior command was highly unlikely, if not impossible.”</p><p>A heavy silence falls as the commissioner makes a near-imperceptible nod at the black mirror to her left, then looks back to you.</p><p>“This, then, is no longer a briefing, but a negotiation. Understand that your role at the Foundation is terminated forthwith. All assets and privileges you previously enjoyed are rescinded, along with your prior rank and compensation.” You detect a hint of regret in her voice as she locks eyes with you. “Instead, let us view this as an opportunity. We have been at odds with the Coterie long enough; perhaps it is time that we worked together.”</p><p>Beyond the commissioner’s steely-eyed professionalism, you sense something else in her voice. Is it respect? She gives you an intense look.</p><p>“The Foundation and the Coterie, as partners. What do you say? Are you in?”</p><p class='basic right'>In your Campaign Log, record *the Red Coterie and The Foundation agreed to work together*.</p><p class='basic right'>File closed.</p>",
        "epilogue3": "<p>_Epilogue 3_: You find yourself awkwardly repeating events and names as you struggle to relay your experience to the commissioner. Throughout it all, Taylor remains silent, listening to your various rabbit trails and accounts of events with an air of reserve. When you have finished, she slides a glass of water across the desktop toward you. You see your shadowy reflection glimmer within the black mirror in the corner of your eye.</p><p>“What an…unrestrained account,” she says matter-of-factly. A heavy silence falls as the commissioner makes a near-imperceptible nod at the black mirror to her left, then looks back to you.</p><p>“The Foundation thanks you for your service. Understand that everything you have done during your tenure with the Foundation is classified, and you are bound under threat of execution to never share this account with another soul: living or dead.” She locks eyes with you. “Do you understand?”</p><p>You nod, and the commissioner goes on. “It goes without saying, but I must inform you that your temporary ‘cell’ has been disavowed and all assets acquired during your Foundation service will be retained for further study and research. Your account of all events involving paracausal disturbance will be extracted, analyzed, and preserved for future analysis.”</p><ul><li>In your Campaign Log, record *Foundation Trust* and *Cell Deception*.<ul><li>For each of the following that is recorded in your Campaign Log (*the cell is assisting Agent Sirry*, *the cell told the truth to Taylor*, *Agent Quinn has your back*, *the cell is delivering intel* is crossed off), mark 1 tally next to *Foundation Trust*.<ul><li>_Foundation Trust_: {trust}</li></ul></li><li>For each of the following that is recorded in your Campaign Log (*the cell hid the truth from Taylor*, *the cell is off-mission*, *the cell aided the knight*, *Ece trusts the cell*, *the cell made a deal with Thorne*, *Aliki is on your side*, *Desi is in your debt*, *Tuwile Masai is on your side*), mark 1 tally next to *Cell Deception*.<ul><li>_Cell Deception_: {deception}</li></ul></li></ul></li><li>If the number of tallies next to *Foundation Trust* is equal to or greater than the number of tallies next to *Cell Deception*, proceed to _Epilogue 4_. Otherwise, skip to _Epilogue 5_.</li></ul>",
        "epilogue4": "<p>_Epilogue 4_: Commissioner Taylor produces a black leather briefcase from behind the desk, opens it, and slides a Foundation badge across the table to you. “Bureaucratic flim-flam, of course. Your cell has been dissolved and you have received approval to join the Foundation with full clearance, full stop. Whether or not you wish to join is irrelevant; you have seen and accomplished too much to return to civilian life.”</p><p>The badge gleams in the harsh light as you turn it over in your hand. It has surprising heft. The sudden weight of everything that has happened hits you as your thumb plays over the grooves and ridges of the metal surface. Taylor flips open the dossier on the table and continues.</p><p>“Your date of hire is yesterday. Don’t worry: you will receive backpay as well as a sizeable compensation package for your work on the case. Which—on that—we are considering labeling ‘The Scarlet Keys.’ It has a nice ring to it, though it is a bit extravagant for my taste.”</p><p>The faintest hint of a smile tugs at the commissioner’s lips. “Well, what have you got to say? Cat got your tongue?”</p><p class='basic right'>In your Campaign Log, record *the cell was given a permanent position*.</p><p class='basic right'>File closed.</p>",
        "epilogue5": "<p>_Epilogue 5_: Commissioner Taylor opens the dossier in front of her and slides a set of tickets across the table to you.</p><p>“These are one-way tickets that will take you anywhere in the world, no questions asked. Given your troublesome curiosity, I recommend you go somewhere quiet and forgettable, assume an alias, and take up a profession that does not allow you so much free time or thinking. Oh, and stop wearing that,” she says, gesturing off-handedly at your appearance.</p><p>You interrupt and try to explain yourself. The commissioner holds up one hand to silence you.</p><p>“In truth, I must inform you that you are getting off rather easily here. If the higher-ups had their say, you would have been summarily executed for your reckless handling of this case. The word ‘collusion’ was tossed around. Had you toed the line, this case might have made your career. In my estimation, you have created far more trouble than you resolved.”</p><p>Taylor stands up, and you stand with her. Several burly suits step through the door behind you, flooding the room with light. The commissioner gives you a firm handshake, her eyes locked with yours. “The Foundation thanks you for your service. May we never meet again.”</p><p class='basic right'>In your Campaign Log, record *the cell was dismantled*.</p><p class='basic right'>File closed.</p>"
      }
    },
    "sections": {
      "specialRules": [
        {
          "title": "新卡牌类型：密钥",
          "body": "《绯红密钥》战役引入了一种新的卡牌类型：密钥。密钥是强大的器物，可以通过“变换”来帮助或妨碍调查员，具体取决于它们附属于谁，以及其稳定面还是动荡面朝上。\n\n• 在剧本的结算期间，一把密钥可能会绑定到单一持有者身上，其名称会记录在剧本日志中。密钥可以绑定到一位调查员、一项剧情支援或一个敌人。\n• 密钥进入场上时，总是附属于其持有者（以剧本日志所记为准）。每个剧本开始时，持有1把或更多密钥的每位调查员都会将这些密钥附属到其调查员卡上。每当一项剧情支援或一个敌人进入场上时，如果它是1把或更多密钥的持有者，这些密钥也会附属于其持有者进入场上。\n  • 如果密钥的持有者是调查员或剧情支援，它以稳定面朝上进入场上。\n  • 如果密钥的持有者是敌人，它以动荡面朝上进入场上。\n• 除非其持有者离场，否则密钥不能离场。如果1把或更多密钥的持有者离场，其控制的每把密钥都会被放在一边，位于场外。（不过，除非另有明确说明，这些密钥在之后的剧本中仍绑定于其持有者。）\n• 当密钥附属于调查员时，该调查员可以在任意玩家窗口以 {fast} 能力触发其变换能力。这称为“变换”密钥。作为该能力结算的一部分，它会指示调查员将密钥翻至另一面，使其另一面的变换能力生效。此后，调查员必须执行其动荡面上的变换能力，才能将其翻回来。\n  • 当密钥附属于剧情支援时，控制该支援的任意调查员也可以用同样的方式变换它。\n  • 每把（按卡名区分的）附属于调查员或剧情支援的密钥每轮只能变换一次。\n• 当密钥处于敌人控制下时，只有卡牌或游戏效果指示调查员变换该密钥时，才会结算其变换能力；此后它保持动荡面朝上。\n  • 附属于敌人的密钥不能翻至稳定面。\n  • 附属于敌人的密钥可以被变换的次数没有限制。\n• 某些卡牌效果可能会直接将附属于调查员或剧情支援的密钥从稳定面翻至动荡面，或反之。这与变换密钥不同，也不会结算其变换能力。"
        },
        {
          "title": "戴红手套的男子",
          "body": "在《绯红密钥》战役期间，调查员会遭遇秘密组织“红色同志会”中诸多危险而神秘的成员。其中一位便是标志性的戴红手套的男子。因此，在进行《绯红密钥》战役时，调查员不能购买或将《戴红手套的男子》支援（《敦威治遗产》卡牌 #310）加入其牌库。"
        },
        {
          "title": "隐匿 X",
          "body": "隐匿 X 是《绯红密钥》战役中部分敌人卡牌上出现的关键词。隐匿敌人代表隐藏起来的敌人，在调查员设法揭露其真正所在——有时还有其真正身份——之前，它们的真实位置始终成谜。\n\n当一个剧本包含一个或更多隐匿敌人时，调查员会被指示将若干张隐匿迷你卡牌放在一边。这些迷你卡牌是双面的。面朝下的一面代表隐匿敌人可能存在的位置。揭示面则显示该迷你卡牌的真实性质——敌人的真实位置，或者仅仅是一个诱饵。敌人的迷你卡牌标示阴影中某个敌人的位置。诱饵标示的位置则无关紧要——也许是个无害的旁观者，也许只是光线造成的错觉。\n\n当调查员抽到一个具有隐匿 X 关键词的敌人（或被指示结算某个敌人的隐匿关键词）时，该调查员将该敌人生成到议程牌库上方的游戏区域，而不是任何地点。该区域称为“阴影”，代表调查员知道其存在于地图某处、但不确定具体位置的敌人。然后，该调查员拿取与那个敌人对应的、放在一边的隐匿迷你卡牌，连同 X 张诱饵（X 由该敌人的隐匿 X 数值决定），将它们面朝下洗混，并尽可能均匀地分配到场上的每个地点，从离自己最近的地点开始。随后，在那些已经有 1 张或更多隐匿迷你卡牌的地点，也将这些迷你卡牌各自面朝下洗混。\n\n*例如：阿米娜抽到了具有“隐匿 2”的同志会特工(A)。她先将同志会特工生成到阴影中。然后，她拿取放在一边的同志会特工(A)迷你卡牌，连同2张诱饵，将它们面朝下洗混，并在离她最近的三个地点各放置一张。接着，如果这些地点中已有1张或更多隐匿迷你卡牌，她就将那些地点的每张隐匿迷你卡牌都洗混。*\n\n阴影中的敌人遵循以下额外规则：\n\n• 阴影中的敌人视为在场上，但不位于任何特定地点。它们在离开阴影之前不能移动。\n• 阴影中的敌人可以符合“最近的”敌人这一条件，但仅当场上任何地点都没有其他敌人时才行。\n• 阴影中的敌人不能因玩家卡牌效果而受到伤害或离场。"
        },
        {
          "title": "隐匿迷你卡牌",
          "body": "隐匿迷你卡牌在场上时，代表阴影中某个敌人可能存在的位置。要对付这样的敌人，必须先通过揭露其迷你卡牌来发现它的真实位置。这可以通过三种方法之一完成：攻击、躲避或调查。\n\n• 隐匿迷你卡牌不是敌人，不能像敌人一样被交战。不过，与隐匿迷你卡牌位于同一地点的任意调查员都可以尝试揭露它：成功攻击或躲避它（如同它是一名已交战的敌人），或成功调查其所在地点。成功攻击或躲避一张隐匿迷你卡牌的难度等于其所在地点的隐蔽值。\n  • 调查员也可以使用能自动躲避敌人、对敌人造成伤害或在某地点发现线索的卡牌效果，来改为揭露一张隐匿迷你卡牌。\n• 如果调查员选择揭露一张隐匿迷你卡牌，该效果会取代用于揭露它的行动或能力的标准效果。（即：如果敌人的迷你卡牌是通过躲避或伤害揭露的，对应的敌人既不会被躲避，也不会受到伤害。如果迷你卡牌是通过发现线索或调查揭露的，则不会发现任何线索。）\n• 如果一张隐匿迷你卡牌被揭露（通过上述任一方法），将其翻至揭示面。\n  • 如果它是诱饵，将其放在一边，位于场外，不产生任何效果。\n  • 如果它是某个敌人的迷你卡牌，该敌人现在被揭露。将对应的敌人从阴影中放置到该迷你卡牌所在的地点，然后将该迷你卡牌放在一边，位于场外。（该敌人不再位于阴影中，现在位于其迷你卡牌原先所在的地点。）随后，如果阴影中不再有其他敌人，将场上所有剩余的隐匿迷你卡牌放在一边，位于场外。\n• 除非另有明确说明，每个效果只能揭露一张隐匿迷你卡牌。（即：一个对某地点每个敌人造成3点伤害的效果，不会揭露该地点的所有隐匿迷你卡牌，只会揭露一张。）\n\n*例如：阴影中有一个同志会特工和一个同志会刺客。基玛尼所在地点有一张隐匿迷你卡牌，一个相邻地点还有另一张隐匿迷你卡牌。(1) 首先，基玛尼打出一张能在其所在地点发现线索的事件卡，但选择不发现线索，改为揭露其所在地点的隐匿迷你卡牌，将其翻面。那张迷你卡牌是诱饵，被放在一边，不产生效果。(2) 接着，基玛尼移动到有另一张隐匿迷你卡牌的相邻地点，尝试用躲避行动揭露它。检定成功，翻开那张迷你卡牌……竟是同志会刺客的迷你卡牌！(3) 同志会刺客的迷你卡牌被放在一边，阴影中的同志会刺客被移动到基玛尼所在的地点，与基玛尼交战。因为阴影中还有另一个敌人，所以不会将任何其他隐匿迷你卡牌移出场外。*"
        },
        {
          "title": "警戒",
          "body": "有些敌人具有警戒关键词。每当调查员在尝试躲避具有警戒关键词的敌人时技能检定失败，在应用该次技能检定的所有结果之后，该敌人会对躲避它的调查员发动一次攻击。敌人在发动警戒攻击后不会横置。无论该敌人是否与躲避它的调查员交战，都会发生这次攻击。"
        },
        {
          "title": "巡逻",
          "body": "有些敌人具有巡逻关键词。在敌人阶段（框架步骤3.2）中，每个已重整、未交战且具有巡逻关键词的敌人，都会沿最短路径向指定地点（即“巡逻”字样旁括号中所描述的地点）移动到一个连接地点。\n\n• 如果有多个地点符合指定地点的条件，由调查员队长选择该敌人向哪个地点移动。\n• 如果具有巡逻关键词的敌人必须沿某条被卡牌能力阻断的路径移动到一个地点，则该敌人不移动。"
        }
      ],
      "headings": {
        "prologue": "剧本设置",
        "embark": {
          "Alexandria": "从亚历山大启程",
          "Anchorage": "从安克雷奇启程",
          "Arkham": "从阿卡姆启程",
          "Bermuda": "从百慕大启程",
          "BermudaTriangle": "从百慕大三角启程",
          "Bombay": "从孟买启程",
          "BuenosAires": "从布宜诺斯艾利斯启程",
          "Cairo": "从开罗启程",
          "Constantinople": "从君士坦丁堡启程",
          "Havana": "从哈瓦那启程",
          "HongKong": "从香港启程",
          "Kabul": "从坎布尔启程",
          "Kathmandu": "从加德满都启程",
          "KualaLumpur": "从吉隆坡启程",
          "Lagos": "从拉各斯启程",
          "London": "从伦敦启程",
          "Manokwari": "从马诺夸里启程",
          "Marrakesh": "从马拉喀什启程",
          "MonteCarlo": "从蒙特卡洛启程",
          "Moscow": "从莫斯科启程",
          "Nairobi": "从内罗毕启程",
          "NewOrleans": "从新奥尔良启程",
          "Perth": "从珀斯启程",
          "Quito": "从基多启程",
          "Reykjavik": "从雷克雅未克启程",
          "RioDeJaneiro": "从里约热内卢启程",
          "Rome": "从罗马启程",
          "SanFrancisco": "从旧金山启程",
          "SanJuan": "从圣胡安启程",
          "Shanghai": "从上海启程",
          "Stockholm": "从斯德哥尔摩启程",
          "Sydney": "从悉尼启程",
          "Tokyo": "从东京启程",
          "Tunguska": "从通古斯卡启程",
          "Venice": "从威尼斯启程",
          "YborCity": "从宜博市启程"
        },
        "kind": {
          "embark": "启程"
        },
        "interludes": {
          "1": "幕间故事",
          "14": "档案#14–C",
          "20": "档案#20–E",
          "26": "档案#26–G",
          "27": "档案#27–H",
          "32": "档案#32–J",
          "36": "档案#36–L",
          "37": "档案#37–M",
          "44": "档案#44–O",
          "45": "档案#45–P",
          "49": "档案#49–R",
          "50": "档案#50–S",
          "51": "档案#51–T",
          "52": "档案#52–U",
          "53": "档案#53–V",
          "54": "档案#54–W",
          "55": "档案#55–X"
        }
      },
      "locations": {
        "Alexandria": {
          "name": "亚历山大",
          "subtitle": "档案#38-N"
        },
        "Anchorage": {
          "name": "安克雷奇",
          "subtitle": "档案#33-K"
        },
        "Arkham": {
          "name": "阿卡姆"
        },
        "Bermuda": {
          "name": "百慕大",
          "subtitle": "档案#20-E"
        },
        "BermudaTriangle": {
          "name": "百慕大三角"
        },
        "Bombay": {
          "name": "孟买",
          "subtitle": "档案#36-L"
        },
        "BuenosAires": {
          "name": "布宜诺斯艾利斯",
          "subtitle": "档案#16-D"
        },
        "Cairo": {
          "name": "开罗"
        },
        "Constantinople": {
          "name": "君士坦丁堡",
          "subtitle": "档案#21-F"
        },
        "Havana": {
          "name": "哈瓦那",
          "subtitle": "档案#28-I"
        },
        "HongKong": {
          "name": "香港"
        },
        "Kabul": {
          "name": "坎布尔",
          "subtitle": "档案#14-C"
        },
        "Kathmandu": {
          "name": "加德满都",
          "subtitle": "档案#53-V"
        },
        "KualaLumpur": {
          "name": "吉隆坡"
        },
        "Lagos": {
          "name": "拉各斯",
          "subtitle": "档案#37-M"
        },
        "London": {
          "name": "伦敦"
        },
        "Manokwari": {
          "name": "马诺夸里"
        },
        "Marrakesh": {
          "name": "马拉喀什",
          "subtitle": "档案#11-B"
        },
        "MonteCarlo": {
          "name": "蒙特卡洛"
        },
        "Moscow": {
          "name": "莫斯科",
          "subtitle": "档案#26-G"
        },
        "Nairobi": {
          "name": "内罗毕",
          "subtitle": "档案#54-W"
        },
        "NewOrleans": {
          "name": "新奥尔良"
        },
        "Perth": {
          "name": "珀斯",
          "subtitle": "档案#55-X"
        },
        "Quito": {
          "name": "基多",
          "subtitle": "档案#14-C"
        },
        "Reykjavik": {
          "name": "雷克雅未克",
          "subtitle": "档案#14-C"
        },
        "RioDeJaneiro": {
          "name": "里约热内卢",
          "subtitle": "档案#44-O"
        },
        "Rome": {
          "name": "罗马",
          "subtitle": "档案#51-T"
        },
        "SanFrancisco": {
          "name": "旧金山",
          "subtitle": "档案#26-G"
        },
        "SanJuan": {
          "name": "圣胡安",
          "subtitle": "档案#14-C"
        },
        "Shanghai": {
          "name": "上海",
          "subtitle": "档案#32-J"
        },
        "Stockholm": {
          "name": "斯德哥尔摩",
          "subtitle": "档案#36-L"
        },
        "Sydney": {
          "name": "悉尼",
          "subtitle": "档案#49-R"
        },
        "Tokyo": {
          "name": "东京",
          "subtitle": "档案#37-M"
        },
        "Tunguska": {
          "name": "通古斯卡"
        },
        "Venice": {
          "name": "威尼斯"
        },
        "YborCity": {
          "name": "宜博市",
          "subtitle": "档案#52-U"
        }
      },
      "interludes": {
        "1": "基金会",
        "14": "拨乱反正",
        "20": "宏伟大业",
        "26": "交换条件",
        "27": "逝者如斯",
        "32": "衔尾蛇",
        "36": "奇异建筑",
        "37": "特快专递",
        "44": "灭绝理论",
        "45": "变形记",
        "49": "环环成空",
        "50": "鲜血，汗水，和茶叶",
        "51": "罗慕路斯与雷穆斯",
        "52": "藏匿之地",
        "53": "风中孤哨",
        "54": "地狱装置",
        "55": "超自然选择"
      },
      "statusReport": {
        "title": "状况报告",
        "alpha": "<div class='red bordered'><p class='basic'>_状况报告阿尔法(α)：_</p><p>你继续旅途，基金会收到了越来越多有关神秘失踪案的报告。你阅读的密档越来越多，不禁担心万物是否终究化为虚无。</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p></div>",
        "beta": "<div class='red bordered'><p class='basic'>_状况报告贝塔(β)：_</p><p>你收到一封泰勒专员亲自寄出的加密公文：“特工——不久前，西伯利亚的石泉通古斯卡河附近发生了一场大爆炸。它被定性为一场陨石撞击事件，但这只是表面上的幌子。我们的情报显示同志会牵涉其中。有理由相信此地就是其圣堂之一，或许更是他们的主要藏身地。现核准你调查此地，但须注意，一切都可能发生。”</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p><p class='basic right'>在剧本日志的中亚部分，找到通古斯卡，在其位置写下“59-Z”。从现在开始，每当你启程，可以旅行前往该地点。*(注意：这么做会结束此剧本。你可能会希望在前往通古斯卡前再深入调查一番……但要小心已经花费了多少时间。)*</p></div>",
        "epsilon": "<div class='red bordered'><p class='basic'>_状况报告艾普西龙(ε)：_</p><p>你穿过街道，每个影子的移动、每个红色身影经过都让你心惊胆战。你肯定是被跟踪了，目标明确的敌人源源不断冲你而来……</p><p class='basic'>在本剧本的剩余时间内，每当设置冒险，执行下列指示：收齐*红色同志会*遭遇组中，在剧本日志中记有*“恩怨未了”*的每个敌人，随机选择一张，将其洗入本场冒险的遭遇牌库。*红色同志会*遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section></p></div>",
        "gamma": "<div class='red bordered'><p class='basic'>_状况报告伽马(γ)：_</p><p>报告仍在继续。现在已经不仅仅是人员失踪，人员还回来了，却与之前不同了。建筑和物品，也都一一复制了，却又不一样，很反常，像是完全拆解，又重组过了。但这是为什么呢？</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p><p class='basic right'>每位调查员必须将一张超维认知弱点加入自己牌库。这张卡牌不计入其牌库卡牌张数。这些卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></p></div>",
        "zeta": "<div class='red bordered'><p class='basic'>_状况报告泽塔(ζ)：_</p><p>你跋涉调查了漫长的一日，终于回到酒店，却发现自己的房间一片狼藉。你腹中涌起一阵大事不妙的感觉。有人把你的房间翻了个底朝天，要找什么，而你十分确定自己知道他们是冲什么来的。你奔向保险柜，这里存放了你没有随身携带的超维神器。你惊恐地发现里面已经空了，只留了一张红色卡片。你找了基金会的联系人，相信窃贼就藏在同志会四所圣所其中一处。要是你行动迅速，兴许还能找回失窃的钥匙。</p><p class='basic right'>检查剧本日志的钥匙部分，找到调查员拥有的所有钥匙。</p><p class='basic right'>随机选择1个(如果调查员控制了总计至少5个钥匙，则改为随机选择2个)。选中的钥匙遭窃。收齐*红色同志会*遭遇组中，剧本日志中记录“恩怨未了”的每个敌人，随机选择一张。就是此人偷走了你的钥匙。</p><p class='basic right'>更新剧本日志的钥匙部分，随机选中的敌人拥有遭窃的钥匙。</p><p class='basic right'>在剧本日志的中亚部分找到坎布尔；在南美洲部分找到基多和圣胡安；在北大西洋部分找到雷克雅未克。在其位置写下“14-C”。从现在开始，每当你启程，可以旅行前往这些地点。</p></div>",
        "theta": "<div class='red bordered'><p class='basic'>_状况报告西塔(θ)：_</p><p>你走进旅馆房间，发现门里滑进了一个红色的信封。里面是简短的一句话：“我在宜博市的人已经知道了新口令，晓得你要过去。方便的时候就去一趟。”署名是“德西”。</p></div>",
        "psi": "<div class='red bordered'><p class='basic'>_状况报告普西(ψ)：_</p><p>你回到酒店的时候，门房朝你招手，递给你一份电报。</p><p class='center'>已经紧紧跟上她了<br>在香港见面，可能需要帮助<br>伞就是钥匙</p><p>这肯定是福林探员送来的。也许你应该前往香港，了解更多情况——如果你还有时间的话。</p><p class='basic right'>在剧本日志的东南亚部分，找到香港，在其位置写下“50-S”。从现在开始，每当你启程，可以旅行前往该地点。</p></div>",
        "omega": "<div class='red bordered'><p class='basic'>_状况报告欧米茄(ω)：_</p><p>你一头栽进宾馆的房间，最近的消息让你抓狂。你做着精神准备，要再度启程……突然，你房间角落跃出一个身影，然后你的脑袋被什么沉重又光滑的东西狠狠砸了一下。你陷入了黑暗。你最后看到的东西就是一团鲜红。</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p><p class='basic right'>你的时间已尽。立即直接旅行到通古斯卡，进入_最终冒险：钥匙议会_。</p></div>"
      },
      "key": {
        "agentFlintIsDead": "福林特工已死",
        "agentFlintIsMissing": "福林特工失踪",
        "agentQuinnHasYourBack": "奎因特工护你左右",
        "agentQuinnDoesNotTrustTheCell": "奎因特工不信任特别小组",
        "agentQuinnVanishedFromExistence": "奎因特工凭空消失",
        "alikiIsOnYourSide": "艾里奇站在你这一边",
        "amaranthHasLeftTheCoterie": "苋离开同志会",
        "cellDeception": "特别小组欺瞒",
        "desiIsInYourDebt": "德西欠你一笔",
        "drIrawanJoinedTheCell": "伊拉万博士加入特别小组",
        "drIrawanTraveledToNewGuinea": "伊拉万博士前往新几内亚",
        "drIrawanVanishedFromExistence": "伊拉万博士凭空消失",
        "eceDoesNotTrustTheCell": "艾婕不信任特别小组",
        "eceTrustsTheCell": "艾婕信任特别小组",
        "erasedFromExistence": "存在抹除",
        "flintAbandonedHisSearch": "福林放弃了自己的调查",
        "flintIsWorkingSolo": "福林独自行动",
        "flintRejoinedTheCell": "福林重归特别小组",
        "flintTraveledToKualaLumpur": "福林前往吉隆坡",
        "foundationTrust": "基金会信任",
        "laChicaRojaIsOnYourSide": "红衣女郎站在你这一边",
        "theCellAidedInFlintsInvestigation": "特别小组援助福林的调查",
        "theCellAidedTheKnight": "特别小组援助了骑士",
        "theCellAppreciatedTheArchitecture": "特别小组对建筑表示惊叹",
        "theCellBlewTheWhistle": "特别小组吹响哨子",
        "theCellDidntDiscoverTheTruthInHavana": "特别小组没有发现哈瓦那的真相",
        "theCellEscapedTheRedCoterie": "特别小组逃离红色同志会",
        "theCellFailedToFendOffTheBeast": "特别小组未能阻挡恶兽",
        "theCellHasBeenAmbushed": "特别小组遭到伏击",
        "theCellHidTheTruthFromTaylor": "特别小组对泰勒隐瞒真相",
        "theCellIsAssistingAgentSirry": "特别小组帮助西里特工",
        "theCellIsDecievingEce": "特别小组欺骗艾婕",
        "theCellIsDeliveringFoundationIntel": "特别小组正在传递情报",
        "theCellIsOffMission": "特别小组另有使命",
        "theCellIsWorkingWithEce": "特别小组与艾婕合作",
        "theCellJoinedTheRedCoterie": "特别小组加入了红色同志会",
        "theCellKnowsAmaranthsRealName": "特别小组知道了苋的真名",
        "theCellKnowsOfDesisPast": "特别小组知道了德西的过往",
        "theCellKnowsTheTrueNatureOfTheCoterie": "特别小组了解了同志会的真相",
        "theCellMadeADealWithDesi": "特别小组与德西达成交易",
        "theCellMadeADealWithTheClaretKnight": "特别小组与暗红骑士达成交易",
        "theCellMadeADealWithThorne": "特别小组与索恩达成交易",
        "theCellMeddledInAbarransAffairs": "特别小组介入了阿巴冉的事务",
        "theCellMetDrIrawan": "特别小组与伊拉万博士会面",
        "theCellOverthrewTheRedCoterie": "特别小组颠覆了红色同志会",
        "theCellPossessesAMysteriousWhistle": "特别小组拥有了神秘的哨子",
        "theCellRefusedAlikisOffer": "特别小组拒绝了艾里奇的馈赠",
        "theCellRefusedEcesOffer": "特别小组拒绝了艾婕的提议",
        "theCellToldTheTruthToTaylor": "特别小组将真相告诉了泰勒",
        "theCellThrewAwayTheWhistle": "特别小组扔掉哨子",
        "theCellWasDismantled": "特别小组就此解散",
        "theCellWasGivenAPermanentPosition": "特别小组得到了终身职位",
        "theCellWasHollowed": "特别小组成为空洞",
        "theDogsAreAtWar": "大战打响",
        "theFoundationRemainsInTheDark": "基金会依然一团糊涂",
        "theLoversAreReunited": "情人重聚",
        "theOutsidersWereStopped": "域外来客遭到阻止",
        "theRedCoterieAndTheCellAgreedToWorkTogether": "红色同志会和基金会同意合作",
        "theRedCoterieSparedTheCell": "红色同志会饶恕了特别小组",
        "theRedCoterieWasDestroyedFromWithin": "红色同志会由内部被毁",
        "theSanguineWatchersTormentContinues": "血色监视者造成的苦难未止",
        "theVoidChimeraEscaped": "虚空奇美拉逃脱",
        "thereIsNothingOfNoteInAnchorage": "安克雷奇无事发生",
        "thorneDisappeared": "索恩消失",
        "time": "时间",
        "tuwileMasaiFledToBermuda": "特瓦耶·马萨伊逃往百慕大",
        "tuwileMasaiIsOnYourSide": "特瓦耶·马萨伊站在你这一边",
        "tzuSanNiangHasYouUnderHerSway": "朱三娘支配了你",
        "tzuSanNiangIsUnderYourSway": "朱三娘受你支配",
        "wrongLeads": "错误迹象",
        "youHaventSeenTheLastOfAlikiZoniUperetria": "你和艾里奇之间恩怨未了",
        "youHaventSeenTheLastOfAmaranth": "你和苋之间恩怨未了",
        "youHaventSeenTheLastOfDesiderioDelgadoAlvarez": "你和德西之间恩怨未了",
        "youHaventSeenTheLastOfLaChicaRoja": "你和红衣女郎之间恩怨未了",
        "youHaventSeenTheLastOfTheBeastInACowlOfCrimson": "你和深红斗篷的恶兽之间恩怨未了",
        "youHaventSeenTheLastOfTheClaretKnight": "你和暗红骑士之间恩怨未了",
        "youHaventSeenTheLastOfTheRedGlovedMan": "你和戴红手套的男子之间恩怨未了",
        "youHaventSeenTheLastOfTheSanguineWatcher": "你和血色监视者之间恩怨未了",
        "youHaventSeenTheLastOfThorn": "你和索恩之间恩怨未了",
        "youHaventSeenTheLastOfTzuSanNiang": "你和朱三娘之间恩怨未了",
        "youKnowThePassphrase": "你知道了口令"
      },
      "label": {
        "chooseBearer": "选择拥有者",
        "empowered": "消耗充能，而不是翻至_动荡_面",
        "figuresInTheDark": {
          "attack": "阴影中的每个敌人攻击你",
          "loseAction": "每位调查员失去一个行动"
        },
        "pinchInReality": {
          "discard": "选择并弃掉你一半的非弱点手牌(向上取整)"
        },
        "secretsLost": {
          "hollowed": "受到1点恐惧，以选择一个放在一边的空洞，将其加入所有者手牌"
        },
        "wealdOfEffigies": {
          "miniCards": "交换与地点相邻的2张隐匿迷你卡牌的位置",
          "locations": "交换阴影中2个地点的位置"
        },
        "paradimensionalTerror": {
          "takeDamageAndHorror": "每位调查员受到1点伤害和1点恐惧。",
          "shuffleAllConcealed": "混洗场上所有隐匿迷你卡牌，然后将这些迷你卡牌正面朝下随机放到先前位置。"
        },
        "paradimensionalUnderstanding": {
          "stable": "将你控制的每个_稳定_钥匙翻至_动荡_面",
          "unstable": "立即变换你控制的一个_动荡_钥匙。"
        },
        "theMirroringBlade": {
          "single": "对你所在地点的一个敌人造成2点伤害",
          "all": "对你所在地点的每个敌人造成1点伤害"
        },
        "doNotExposeConcealed": "不要揭露隐匿卡牌",
        "doNotRevealConcealed": "不要揭示隐匿卡牌",
        "drDewiIrawan": {
          "reveal": "揭示你一张手牌，以将该卡牌放在一边作为空洞的所有同名卡牌混洗入其所有者牌库",
          "discard": "弃掉你一张手牌，以将任意一个放在一边的空洞混洗入其所有者牌库"
        }
      },
      "xp": {
        "chaosTokens": "已有4个混乱标记"
      },
      "prologue": {
        "title": "秘密战争",
        "body": "<p>“……但到了五月或六月，我意识到，那些鬼鬼祟祟、玄奥难解、离奇怪诞的神秘团体遍布全球，他们一贯保持低调，不为人知，现在却变得异常活跃，叫人震惊。”</p><p class='basic right'>——H. P. 洛夫克拉夫特为哈泽尔·赫尔德所作，《超越万古》</p><h3>遍布全球</h3><p class='basic'>与先前的剧本不同，《猩红钥匙》扩展带来了开放式的非线性剧本。序幕“谜雨”后，调查员会得到一张世界地图，可以选择_启程_前往不同的地点。选择这些地点的顺序决定了冒险进行的顺序，也会改变每场冒险的剧情走向和游戏进程，最终到达一场史诗般的盛大结局。精心规划，祝你好运！</p>"
      },
      "interlude1": {
        "label": {
          "tell": "将失踪案告诉泰勒",
          "doNotTell": "对泰勒隐瞒失踪案"
        },
        "title": "幕间故事：基金会",
        "theFoundation1": "<p>“给我交代。”女子下令道。</p><p>“我是国际刑事警察委员会的侦探！”福林吼了回去，“福林，李福林。要是组织知道，你肯定吃不了兜着走。”</p><p>“我可以保证，不会的。你呢？”她说着望向你的方向。你解释说自己是和福林合作的独立调查员。她仔细研究你的眼神——兴许是在分辨你有没有说谎。她和福林一样，都不太容易相信人。这短短的一刻是如此漫长，她终于收起了手中的枪械。福林放下了手。你不知什么时候凝神屏息，现在也终于舒了口气。</p><p>“我们追逐戴红手套的男子已经有段时候了。这还是头一次这么近。他对溜走似乎特别有一套。”她朝身边两个穿西装的点了点头——一个是精壮高挑的白皙女子，另一个瘦削的男人脸刮得干干净净——指向四壁。他们屋里搜查了一番，手不曾离过枪套。“你说的‘我们’究竟是谁？”福林探员问道。你也有着一样的疑虑。盘问你们的人带着英国口音，但她看上去和你见过的任何当地组织都搭不上。</p><p>她等到两个手下确认无虞才继续。“一切正常，长官。”男子说道。她交叉双臂，叹了口气：“好吧。我告诉你们的事情，无论如何都不能外传。听明白了吗？”</p><p>福林耸耸肩：“不然会怎么样？”</p><p>“当场处决。”她当即说道。你喉咙一紧，你的搭档也畏缩了一下。</p><p>“好吧。我想我们也没什么别的选择，嗯？”他望了你一眼，你点点头。那不如就听一听吧。</p><p>“我是泰勒专员，这两位是哈德逊和安东诺娃特工，我们为_*基金会*_工作。这个国际组织旨在发现、研究、保存具有超维能力的物品。”</p><p>“都胡扯些什么？”福林几乎要笑出声。但自称泰勒的女子一点也没有幽默的意思。</p><p>“大战后签署了许多和约条款。巴黎、凡尔赛。但它们的目的不止是维护和平。战争期间还有一些……怪象。还有些东西不合乎常理。基金会就是为了找到这些‘不合理物件’，并确保它们不会再用于战争。”</p><p>“呃，这听起来根本就是你们编造的一堆屁话。”福林说道。他听起来颇为阴郁，显然一点儿也没有相信。你也同意——泰勒专员知道戴红手套的男子，仅凭这一点就足以证明她有所保留。</p><p>不过你觉得她并未说假话，于是问她对你们有何打算。</p><p>一阵令人不快的沉默后，她终于叹了口气：“好吧，我肯定不能放任你们独立调查，再说你们也可能收集到一些相关信息。所以还是让我们合作吧。”</p><p>“合作？还是给你打工？”福林眯起眼睛，犀利地问道。</p><p>她尽力挤出一个微笑：“你真是个聪明人，这点我承认。”她向哈德逊特工点点头，他随即拿出几个徽章交给你们。“你们就是基金会的特别小组，在我们的授权下独立行动。你们要做的就是将发现汇报给我们。”她一直带着赞许的目光盯着福林，“你就是我们的联络人。”</p><p>你问泰勒自己能在这样的任务中得到什么——除了性命不受威胁之外。“我们也会共享戴红手套的男子背后组织的信息，还会给你们提供旅行所需的文件，让你们能免费前往世界上任何地方，且不会遭人盘问。”</p><p>福林将徽章在手里翻来翻去，死死盯着，就像在看一枚炸弹。</p><p>“两分钟前你还拿枪指着我，现在却要我为你干活？”</p><p>“是啊，怎么？你干吗？”</p><p>你将福林拉到一边，私下对眼前的情况进行了一番简短又安静的讨论，其中不乏对这个“基金会”及其真正动机的推测和臆想。你们最终还是决定接受她的提议。要是还有什么能帮助你们一探究竟，这是唯一的选择。</p><p>“很好。”泰勒开始解释，“戴红手套的男子只是其组织的一员，也可能是其领袖——这我们还无法确定。他们自称为_*红色同志会*_，取自他们的红色衣饰。他们追寻散落在全球各地，具有超维能力的神器——也就是我们要寻找、保存的东西。我们称之为‘钥匙’。”</p><p>你问泰勒专员她口中的术语“超维”到底是什么意思。“想象一个有许多层的蛋糕，”她解释道，“我们所见所感的一切都在一层，但之上和之下还有许多层。超维之物也存在于某一层，但可以从其他平行的层级抽取能量。结果就是这些钥匙并不遵循我们维度的法则。因此，倘若不加管控，就会用于危害我们的世界，后患无穷。我们的工作——你们的新工作，就是不让它们落入同志会的魔爪，在基金会的看管下妥善保存。”</p><p>如果这些钥匙真有基金会相信的那么强大，那你确实同意应该由可靠的人士加以看管。但你不禁好奇，这和你们正在调查的失踪案有什么关系。福林盯着你，摇头的动作细微得几乎无法察觉。他并不想告诉他们。</p><p>调查员必须决定（选择一项）：</p><ul><li>*将失踪案告诉泰勒*。</li><li>*对泰勒隐瞒失踪案*。</li></ul>",
        "theFoundation2": "<p>你决定最好还是告诉泰勒专员自己为何开始调查戴红手套的男子。福林的叹息清晰可闻。她沉思片刻，然后摇了摇头：“这确实值得调查，但你们的首要任务还是找到同志会追逐的钥匙，不惜一切代价。明白了吗？”泰勒进一步阐明她会将相关信息通知给福林所属的部门，当然，会省略掉一些“敏感的细节”。此外，她还会给国际刑事警察委员会提交一些有关福林全新“职位”的相关文件。</p><p>“噢，福林特工。”泰勒出去的时候特意用新头衔来称呼他，“你的特别小组独立行事，但别忘了你要直接向我汇报。希望你有重大发现的时候，不要有所保留。”</p><p>他点点头，只是还有一点儿不情愿。</p><ul><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>在剧本日志中，记录下*特别小组将真相告诉了泰勒*。</li></ul>",
        "theFoundation3": "<p>你闭紧了自己的嘴巴，她不知道这些也没什么大不了。泰勒专员告诉福林，她会将相关信息通知给福林所属的部门，当然，会省略掉一些“敏感的细节”。此外，她还会给国际刑事警察委员会提交一些有关福林全新“职位”的相关文件。</p><p>“噢，福林特工。”泰勒出去的时候特意用新头衔来称呼他，“你的特别小组独立行事，但别忘了你要直接向我汇报。希望你有重大发现的时候，不要有所保留。”</p><p>他点点头，但你能看出其中的不情愿。你觉得他也会省略掉一些“敏感的细节”。</p><ul><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>在剧本日志中，记录下*特别小组对泰勒隐瞒真相*。</li></ul>",
        "theFoundation4": "<p>翌日清晨，你们的“特别小组”又在特拉法尔加广场附近的茶馆碰头了。这里本来是你们打算昨夜会面的地方。你研究了一番这个“基金会”给福林的文件。</p><p>“老实说，真是难以置信。”福林说道，“但一切居然都这么顺利。旅行文件、工作调换，所有的一切。甚至我上级也一点都没怀疑。我想咱们现在是秘密特工了，嗯？”</p><p>你表示同意。尽管这一切看上去难以置信，但还不如你正在调查的事情异乎寻常。“没错。好吧，我想最好还是分头行动。我在上海长大，我在那儿还有些人脉，所以我先去那儿。你可以自行决定想去哪儿。我们稍后碰头，那时候再决定下一站。”</p><p class='basic'>关于红色同志会的下落，基金会已有几条线索。</p><ul><li>其中之一指向福林探员的家乡_上海_。无数流言声称那里存在一个秘密的教派，头目是一个打着红伞的神秘女子。</li><li>_亚历山大_爆发了一场残忍的屠杀。基金会相信其中牵扯了同志会的一名成员。</li><li>_布宜诺斯艾利斯_出现了一连串瞩目的盗窃案。基金会相信应是一名同志会成员所为。首要目标似乎是一个钥匙。</li><li>同志会有位成员在_内罗毕_建了一处圣堂。也许你能在那里发现他们的计划。</li><li>基金会弄到了一份勘探报告。报告的作者正在_安克雷奇_工作。也许钥匙会在那里？</li><li>_伊斯坦布尔_(君士坦丁堡)有一名同志会的特工联系上了基金会的人员。那人打算反水吗？也可能是个陷阱。</li><li>_加德满都_的当地人报道目睹了一个“灵体”，其描述与另一位同志会特工相符。</li><li>有人在_马拉喀什_目睹了一位可怕的同志会特工。古墓遭劫和奇怪的植物蔓生事件已让当地的基金会人员紧张万分。</li><li>有个同志会特工已经在_哈瓦那_成了有名的人物。那里源源不断地有朗姆酒和其他非法物品走私到合众国。</li></ul><p class='basic right'>阅读下一栏的“启程与旅行”和“基金会密档”规则。然后，一旦你整装待发，就从伦敦_启程_前往一个新的地点。</p>"
      },
      "embarkingAndTravel": {
        "title": "启程与旅行",
        "body": "<p class='basic'>每当你_启程_，你都可以前往《猩红钥匙》剧本扩展的地图上任何一个想去的地点。地图上的每一格都有路线连接到其他格。启程时，调查员共同沿着路线前往想去的目的地。到达目的地途中每经过一段路线，就在剧本日志中记1_时间_(最少为1)。</p><p class='basic'>地图上每一格都有数字和字母的组合标识，指引你前往剧本手册中的特定页。旅行过程中，不必在每一格都作停留。不过，要是你想停止旅行，看看这一格有什么，就前往剧本手册的对应页，阅读那一页的剧情文本。这可能将你导向幕间故事或者冒险。没有哪条路线称得上最佳，跟着直觉走吧……但要小心花费了多少时间(见“记录时间”)。</p><p>*示例：雪莉想从亚历山大旅行前往马拉喀什。她先记1_时间_，沿路线到罗马，但不在此处停留，而是再记1_时间_，旅行前往马拉喀什，在这里停留。马拉喀什标有“11-B”，所以她打开剧本手册的第11页，阅读档案#11-B：死亡酷暑。*</p><ul><li>有些地点带有红色标记，而没有字母。这样的地点只有等到剧本日志的条目允许才能旅行前往。</li><li>有些地点带有绿色标记，代表这里可能发生支线剧情*(见《诡镇奇谈：卡牌版》其他独立产品)*。如果你想在本剧本中加入支线剧情，旅行到地图上对应的地点，并且不用再花费此支线剧情原本所需的经验值，而是花费同等数量的额外时间。<ul><li>如果你不想在这些地方停留开始支线剧情，那么可以直接跳过，沿着路线继续旅行，这样将其视作一段连续的路线，而非两段分隔的路线。</li></ul></li><li>一旦你在某地已经停留过，在剧本剩余时间内，就不能再在此处停留，除非有特别指示。</li></ul>"
      },
      "theFoundationDossiers": {
        "title": "基金会密档",
        "body": "<p class='basic'>本剧本手册中会有许多如下所示的基金会密档侧边栏。调查员可以在任何时候查看地图上任何格子的密档侧边栏。运用这些侧边栏指引下一步行动，计划你的路线。阅读侧边栏时，调查员在旅行前往对应地点前，不能偷看那一页上的其他文本。</p>"
      },
      "worldMap": {
        "dossierHeading": "你可以在任何时候阅读此密档",
        "dossiers": {
          "Marrakesh": "<p>档案#11–B<br/>客体等级：红色<br/>真实身份：未知<br/>最后目击地点：摩洛哥，马拉喀什</p><p>描述：客体#11-B(后称“苋”)是一位欧裔女子，外貌为20岁前半。她通常戴着一朵半遮住脸庞的红色大花。</p><p>超维能力：具有<span class='censor'>转移生命和死亡的</span>力量。能通过超维手段运输<span class='censor'>能量</span>，<span class='censor'>以治愈受伤的实体</span>，或<span class='censor'>从活物身上汲取生命</span>。没有记录显示这种<span class='censor'>能量交换</span>的限制为何，当前数据仅限于小型事件。客体需要通过实际接触完成<span class='censor'>转移生命</span>，这限制了传输的规模。可能带来<span class='censor'>末日般</span>的后果。</p><p>目击记录：1.1923年11月23日——马萨诸塞州，阿卡姆。特工报告客体治疗了附近的<span class='censor'>同志会</span>成员，<span class='censor'>被吸干养分并枯萎的</span>是周围的树木。接下来数月<span class='censor'>异界存在与超维</span>活动有所增加。</p><p class='indent'>2.1924年1月11日——葡萄牙，里斯本。当地特别小组逮捕了客体。确认有<span class='censor'>物理</span>接触。一名小组成员立刻死亡，第二名受害者依然为木僵状态。客体逃脱了盘问。</p><p class='indent'>3.马拉喀什有未确认的目击。需要更多情报。请求紧急支援。</p><p>处理流程：客体十分危险。接近必须保持极高警惕。严禁物理接触。更多信息参见旧金山分部(档案#26-G2)。</p>",
          "BuenosAires": "<p>档案#16–D<br/>客体等级：黄色<br/>真实身份：未知<br/>最后目击地点：阿根廷，布宜诺斯艾利斯</p><p>描述：客体#16-D(后称“深红外套的女孩”)，外貌为阿根廷裔(也许是<span class='censor'>人类</span>后裔？)，20岁前半，高约165厘米。尚未检测到<span class='censor'>异形</span>存在。该同志会成员随身穿着一件红色大衣，戴的帽子也有红色系带，具有超维能力(见下详述)。当地人称之为“红衣女郎”(无疑是出自其装束，但此名是褒是贬尚不得知)。</p><p>超维能力： 据当地政府报告，深红外套的女孩要么<span class='censor'>拥有超物理速度</span>，要么具有<span class='censor'>灵体投射</span>的能力。尽管多次尝试，当地政府依然无法捕获客体。（她是否操纵了<span class='censor'>黑暗</span>和<span class='censor'>诡影</span>？抑或只是单纯善于逃脱监视？)客体貌似倾向于避免冲突。因此，迄今为止尚未发现有当地伤亡与深红外套的女孩有关。</p><p>(不能排除情况升级为暴力冲突的可能。)</p><p>目击记录：深红外套的女孩与布宜诺斯艾利斯多起知名盗窃案相关。当地媒体报道她依然在潜逃。</p><p>处理流程： 尽管深红外套的女孩看上去是<span class='censor'>同志会</span>的成员，但她并未表现出敌意。有人听到她能说流利的西班牙语、葡萄牙语、法语和英语。综合以上因素，我们相信可以与客体交涉和/或询问。建议抓捕客体并询问<span class='censor'>同志会</span>的动机。</p><p>相关人士：马蒂亚斯·玻利瓦尔警长，负责抓捕深红外套的女孩。(可能成为支援？)</p>",
          "Constantinople": "<p>档案#21–F<br/>客体等级：绿色<br/>真实身份：艾婕·萨辛<br/>最后目击地点：土耳其，君士坦丁堡</p><p>描述：客体#21-F(后称“朱红头巾女士”或其真名“艾婕·萨辛”)是一位土耳其裔妇女，34岁，高约161cm。尚未得知这是客体的<span class='censor'>真实形态</span>、易容，抑或假身份。客体总是戴着传统头巾，但颜色却是非同一般的深红。可能是标志同志会身份的物品，<span class='censor'>或超维绑定</span>。</p><p>超维能力：朱红头巾女士貌似不具备此种能力；或其成功对基金会情报人员隐瞒了能力。</p><p>目击记录：艾婕·萨辛是一位知名的艺术收藏家，是君士坦丁堡的土耳其与穆斯林艺术博物馆的馆长，主持馆内运营。她的一切意图<span class='censor'>及行为模式在任何实质层面上</span>都与普通人无异。(注意：上峰怀疑<span class='censor'>艾婕·萨辛是一个精心编造的掩护身份，但没有证据支持这些推测</span>。)</p><p>处理流程：已有基金会特使接触艾婕。安排会面，询问对方意图。</p>",
          "Sanctums": "<p>档案#26–G1–6<br />圣堂等级：绿色<br />圣堂地点：<span class='censor'>南非联邦开普敦</span>、加利福尼亚旧金山、<span class='censor'>韩国首尔</span>、俄国莫斯科、<span class='censor'>比利时布鲁日</span>、<span class='censor'>瑞士伯尔尼</span>。</p><p>描述：圣堂#26-G1遍布六国，是基金会的分支机构与存放超维神器的地点。切勿与非基金会人员透露圣堂地点，否则将处以<span class='censor'>革职及/或无限期监禁</span>。</p><p>处理流程：负责圣堂的特工会在你抵达时负责会面。内附进入指示。</p>",
          "Havana": "<p>档案#28–I<br />客体等级：黄色<br />真实身份：德西德柔·戴佳多·欧瓦瑞兹<br />最后目击地点：古巴，哈瓦那</p><p>描述：客体#28-I(后称“西装浸血的男子”或“德西德柔·戴佳多·欧瓦瑞兹”)是一名古巴裔男子，约42岁，高192厘米。常着黑西装，带有典型同志会特征的配饰：包括领带和礼帽，皆为红色。</p><p>超维能力：西装浸血的男子貌似不具备任何超凡能力，但具有卓越的<span class='censor'>人类</span>身体素质，以及非同凡响的枪械技能和准度。(<span class='censor'>或许受到“钥匙”的</span>强化？)小心接近。</p><p>目击记录：欧瓦瑞兹先生是哈瓦那的长期居民。不过，没有任何有关客体童年或早期生活的记录现存。（似乎在加入同志会时销毁，但可能<span class='censor'>来自地外</span>。无论如何，其身份可能只是化名。)据悉，欧瓦瑞兹先生常常前往一家名叫月下餐厅的夜店。</p><p>注意：基金会对于哈瓦那是否有钥匙一无所知，但欧瓦瑞兹先生可能知道其他钥匙的所在地点。</p><p>处理流程：与客体公开谈判，获取同志会宝库和/或藏身地的位置。如果对方不予合作，直接制服，加以盘问。更多信息参见莫斯科分部(档案#26-G4)。</p>",
          "Shanghai": "<p>档案#32–J<br />支援名称：李福林<br />行动区域：中国，上海</p><p>简介：近期招募的特工，负责秘密特别行动小组，直接对泰勒专员报告。</p><p>当前任务：根据最新报告，该支援人员已与其特别小组分头行动，近期在上海调查客体#46-Q的下落。</p><p>注意：该支援人员对基金会的忠诚尚不确定，建议保持最高警惕。</p>",
          "Anchorage": "<p>档案#33–K<br />客体等级：黄色<br />真实身份：未知<br />最后目击地点：阿拉斯加，安克雷奇。</p><p>描述：客体#33-K(后称“索恩”)高挑纤瘦，长相中性，皮肤苍白。穿着宽松、实用衣物。客体貌似<span class='censor'>为盎格鲁-凯尔特裔</span>， 据推测远比表现得年长(经情报整理，可能出生于<span class='censor'>1761年</span>)。客体颈部戴有红色长巾，十分显眼，常遮住面容。</p><p>超维能力：客体对<span class='censor'>异界残留物</span>具备敏感的感知。同志会运用此能力定位异界神器，追踪<span class='censor'>超维实体</span>的移动。</p><p>目击记录：全球各地有多处目击。为同志会成员中最常移动的一员。尽管其神秘为人所知，但索恩评估和获取<span class='censor'>超维神器</span>的本事可谓著名。分析显示对方可以接受商业交换和讨价还价。但最近的活动表明同志会现在<span class='censor'>正处于大肆收购的状态</span>。</p><p>处理流程：你和索恩貌似目标相似。建议保持极高警惕。索恩不拒绝谈判，但前提是接受其条件。</p>",
          "Tokyo": "<p>档案#37–M<br />支援名称：齐阿娜·泰勒<br />行动区域：见当前任务状况</p><p>简介：<span class='censor'>泰勒专员经一致同意被任命为基金会负责人。大多数人可能永远看不到这段文字的其余部分，因为我希望这部分内容看起来像一大块被涂黑的“谁知道她在干什么”之类的东西，所以我把它涂黑了，但PDF里的某些人可能还是能看到，所以算了。嘿，如果你看到了这段文字：太棒了！感谢你花时间弄清楚这里的内容。谢谢你的参与。爱你。译者注：FFG官网里的英文剧本书黑条里面就是这些文字，类似于彩蛋性质。很遗憾简中实体版看不到这部分，因此这段文字是网页版限定。</span></p><p>当前任务：<span class='censor'>专员正在调查多地出现的超维现象报告。当前任务清单包括</span>日本东京、<span class='censor'>捷克斯洛伐克布拉格和</span>尼日利亚拉各斯。</p>",
          "Alexandria": "<p>档案#38–N<br />客体等级：红色<br />真实身份：未知<br />最后目击地点：埃及，亚历山大</p><p>描述：客体#38–N(后称“深红斗篷的恶兽”)是一个高约183厘米的类人生物，身披红色斗篷。斗篷完全遮住了客体的面貌特征(可能是<span class='censor'>地外</span>后裔)。目前只观测到客体的部分器官：一对<span class='censor'>狼</span>爪，<span class='censor'>覆盖灰色毛发</span>，客体因此得名。貌似<span class='censor'>非人类起源</span>。</p><p>超维能力： 深红斗篷的恶兽在暴力冲突方面展现出了高度资质。先前的遭遇导致<span class='censor'>多名特工死亡</span>。受害者<span class='censor'>被开膛破肚</span>，<span class='censor'>失血致死</span>，或<span class='censor'>被啃食残缺，宛如无聊的猫戏耍猎物一般被来回蹂躏</span>。建议保持极高警惕。</p><p>目击记录：深红斗篷的恶兽是亚历山大多起残忍谋杀案的首要嫌疑人。</p><p>注意：已知亚历山大存在超维工具(即“钥匙”)。同志会成员可能使用钥匙<span class='censor'>改造或异化其躯体</span>。</p><p>处理流程：极度谨慎地制服客体，获取超维工具，以供进一步研究。</p>",
          "DrIrawan": "<p>档案#44–O/55–X<br />支援名称：戴维·伊拉万<br />行动区域：南半球</p><p>简介：著名动物学家，已出版数本有关失踪野生动物的研究，声称整个物种与其存在相关的记忆都已遭到抹除。可能受到<span class='censor'>反常</span>干扰。</p>",
          "Sydney": "<p>档案#49–R<br />支援名称：阿丽·奎因<br />行动区域：澳大利亚，悉尼</p><p>简介：负责超维分析的实地研究员。尽管最近发生了数起事件，但本支援并未要求转移。建议继续精神评估。</p><p>当前任务：奎因特工正在对最近的超维干扰进行独立研究。</p>",
          "YborCity": "<p>档案#52–U<br />圣堂等级：黄色<br />圣堂地点：佛罗里达，宜博市</p><p>描述：圣堂#52-U是麦凯湾以北宜博市一家废弃的烟厂。</p><p>日志记录：已知客体#28-I常来此处。注意警戒。</p><p>处理流程：小心进入，查找任何有关超维工具的迹象。如有发现，或任何证据，一律收归基金会所有。</p>",
          "Kathmandu": "<p>档案#53–V<br />客体等级：未定<br />真实身份：艾里奇·佐尼·奥佩勒曲亚<br />最后目击地点：尼泊尔，加德满都</p><p>描述：客体#53-V(后称“猩红腰带的少女”)形似一名种族未明的青春期女孩，穿着白裙，系着红色腰带。<span class='censor'>目前尚不清楚这种物理形态是真实存在还是虚假影像。</span>。</p><p>超维能力：<span class='censor'>据信，艾里奇拥有远超其年龄的惊人知识，其实际年龄很可能远大于外貌。基金会尚未确认绑定的钥匙是否具备超维能力(如有)。客体可能为非实体</span>。</p><p>目击记录：当地人声称在高音哨声后见过与客体描述相符的“灵体”。尚不明确<span class='censor'>猩红腰带的少女是否真的是灵体，或者她的超维能力是否印证这种描述</span>。</p><p>处理流程：客体风险等级尚未确定。切勿接近。</p>",
          "Nairobi": "<p>档案#54–W<br />客体等级：绿色<br />真实身份：特瓦耶·马萨伊<br />最后目击地点：肯尼亚，内罗毕</p><p>描述：客体#54-W(后称“特瓦耶·马萨伊”)是一位肯尼亚裔的中年瘦削男子，高176厘米。客体带有同志会特征，包括红色大框眼镜；<span class='censor'>动用与支配同志会资金</span>，并<span class='censor'>已确认接触</span>同志会人员。客体曾在众多地理和考古期刊公开以同志会的名义撰写并发表过文章。</p><p>超维能力：暂无已知报告。客体貌似不具备此种能力；或其成功对基金会情报人员隐瞒了<span class='censor'>数件绑定的超维神器</span>。</p><p>日志记录：特瓦耶·马萨伊在牛津大学担任教职，对维多利亚湖及周边地区发表过众多勘测报告。</p><p>处理流程：迄今为止，马萨伊拒绝了基金会的所有联络。应在马萨伊有理由信赖自己的前提下再予以接触。</p>"
        }
      },
      "quidProQuo": {
        "xp": {
          "supplies": "补给"
        },
        "label": {
          "ticket": "“我们希望快快上路。”",
          "supplies": "“我们想要一些补给。”",
          "intel11": "“我们想要一些有关‘客体#11-B’的情报。”",
          "intel28": "“我们想要一些有关‘客体#28-I’的情报。”"
        },
        "sanFrancisco": "你在旧金山",
        "moscow": "你在莫斯科",
        "title": "交换条件",
        "body": "<p class='basic'>检查你在地图上的位置。</p>",
        "quidProQuo1": "<p>一连串晦涩又模糊的指示将你引到旧金山唐人街边缘一栋平平无奇的两层石楼。进去桌子后面斜靠着一位百无聊赖的招待员，旁边是一架黄铜电梯。你按下特殊的编码，电梯载着你一路深入，远超你的预期。到了负14层，你才走出电梯，面前是位仪表堂堂的男子，一身西服裁剪合身，还戴着黑色的软呢帽。“阿奇巴德·哈德逊。我们在伦敦见过。”他提醒你，“咱们分部都在聊你的特别小组。”特工带你沿着一条长廊向下，长廊似乎没有尽头，两边装着一个个壁龛。每个壁龛里装载的东西都不一样：有空洞地球的模型，有水晶头骨，还有标明地脉与其他未知标记的地图。你在一个壁龛前驻足，它被啃了一半——甚至还冒着热气。</p><p>“据我所知，这东西大概被烹饪了有二十年了吧，只是为了做到完美。享用它的女士也同样吃了这么久。”哈德逊特工严肃地说。看到这些超维遗物让你头疼不已。盯着可真费眼睛：它们同一时刻既在那儿，又不在那儿。哈德逊引你沿着侧廊走进一间方方正正的屋子，里面塞满了金属档案柜。他来到一张沉重的木桌前坐下。他对一个弹簧围绕的麦克风说道：“档案#26-G2。阿奇巴德·哈德逊主持的谈话。代号42a6-951。称呼我哈德逊特工就行。”他说着抬起了眉毛。接下来的几个小时，你回答了一连串问题，叫人精疲力尽，苦不堪言，将自己伦敦之后的经历说了个遍。终于问完了。哈德逊特工向后一倒，点了一根香烟。“我得承认，一开始我还对你有所怀疑。但泰勒专员的直觉很准，我还没见过有谁能牵着她的鼻子走。”他说，“你到现在都干得不错。我们有一些情报和资源，可能对你有用。告诉我，基金会能为你做什么？”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*“我们希望快快上路。”*调查员队长将一张快捷旅票加入自己牌库。你可以_启程_。</li><li>*“我们想要一些补给。”*每位调查员取得1点经验值。你可以_启程_。</li><li>*“我们想要一些有关‘客体#11-B’的情报。”*只有你尚未造访过马拉喀什，才能选择此选项。</li></ul>",
        "quidProQuo2": "<p>基金会在莫斯科的行动基地距离圣巴西尔大教堂只有五分钟的脚程。鹅卵石街道上有一栋现代的构成主义建筑，进去的门倒是平平无奇。里面的走廊通向狭窄的梯井，一路向下，比你想的更深。最终来到一面白漆斑驳的墙，中间有一扇红门。你证实了自己的身份，随即被领入一条长长的门廊，这一路灯光闪耀，地毯华丽。</p><p>“看来你好好地遵照了指示。”一个声音传来，你扭头看见一个精壮高挑的女子，她身上的西装裁剪精致。“瓦莱丽娅·安东诺娃。我们之前见过。叫我莱拉就好。现在，请跟着我。”安东诺娃特工领你走过迷宫一样的过道，穿过一面双扇门，来到白瓷砖的房间。这里满是污垢，红色的印记你只希望是烟尘。屋子中间有一张手术台，金属板上用皮条紧紧束缚住的东西看着像是个人。只是看着这个人形的怪物就让你头晕：它看上去像是一团不停移动的虚影，仿佛是高速飞行的蜂鸟。你只瞥到一眼它的样子：阴暗的眼神，咬紧的牙齿，紧张地扭曲。</p><p>“莱拉，”另一个特工打断道，“政委找你。”安东诺娃特工严厉地看了你一眼：“这是超维存在。请保持距离。我要失陪一会儿。”她说完就走了。你看着墙上挂的尖利工具，不禁疑惑到底进行的是什么实验。从客体精致的黑西装来看，你甚至怀疑这之前是不是基金会的一名特工。它静止了一分钟，随即又在台上乱扭，张大又闭上“嘴巴”，对着你露出一个庞大黑暗的“O”。你离它远点，尽量看着别处。</p><p>“不好意思。”安东诺娃特工又进来了，台子上的东西停止扯动。“我得处理别的事情。抱歉我们没有人手陪你在设施里参观，所以我现在必须请你离开。不过，基金会愿意尽力提供帮助。还请告知我们能为你做些什么。”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*“我们希望快快上路。”*调查员队长将一张快捷旅票加入自己牌库。你可以_启程_。</li><li>*“我们想要一些补给。”*每位调查员取得1点经验值。你可以_启程_。</li><li>*“我们想要一些有关‘客体#28-I’的情报。”*只有你尚未造访过哈瓦那，才能选择此选项。</li></ul>",
        "quidProQuo3": "<p>哈德逊特工翻阅文件，递给你一份最新的密档，与你手上的相仿，只是厚得多。“客体#11-B，自称‘苋’。但这并非基金会遇到的第一个苋。她每过几十年就出来兴风作浪一番，每次的样子都不相同。本次的个体与一名之前在马萨诸塞州的‘米斯卡塔尼克大学’就读的学生极为相似。她的名字是艾琳·科奇温。此人失踪已有一段时间。”你提问这会不会只是巧合。“我们的工作不存在巧合。”他嘟囔道。</p><ul><li>在剧本日志中，记录下*特别小组知道了苋的真名*。</li><li>你可以_启程_。</li></ul>",
        "quidProQuo4": "<p>安东诺娃特工从一堆旧文件中翻出一份密档，上面记载了的信息是一个名叫德西德柔·戴佳多·欧瓦瑞兹的男子。“据我们所知，‘客体#28-I’小时候在哈瓦那过着非常平凡的生活，直到19岁牵扯进一场组织犯罪，引起了同志会的注意。”你问他是不是个私酒贩子，但安东诺娃特工严肃地摇了摇头。“事实恰恰相反。德西德柔的兄弟才牵涉其中，之后被敌对帮派谋杀。德西德柔貌似拥有钥匙，并用于复仇，由此就牵涉了同志会。同志会发现了他的才能，决定吸引他入会。”</p><ul><li>在剧本日志中，记录下*特别小组知道了德西的过往*。</li><li>你可以_启程_。</li></ul>"
      },
      "specialDelivery": {
        "title": "特快专递",
        "body": "检查剧本日志和你在地图上的位置。",
        "deliveringIntel": "*特别小组正在传递情报……*",
        "deliveringIntelInTokyo": "…且你在东京。",
        "deliveringIntelInLagos": "…且你在拉各斯。",
        "notDeliveringIntel": "如果上述条目未记录……",
        "notDeliveringIntelInTokyo": "…且你在东京。",
        "notDeliveringIntelInLagos": "…且你在拉各斯。",
        "label": {
          "chooseToken": "选择混乱袋中任一数字标记。将其替换为比原来数值高1的标记"
        },
        "specialDelivery1": "<p>你到了东京，正巧下雨。你穿过城中蜿蜒的小巷，在一家小摊前驻足。你还没点单，一个身穿大衣、戴宽沿帽的身影就坐在了旁边，一口清脆的不列颠口音低语道：“六狮伏于夜。”</p><p>你略顿一顿，意识到这句话的重要，匆忙念出基金会教会你的口令：“享宴尽饕餮。”坐在你旁边的人拉下领子，你看到了泰勒专员。她给你和自己各点了一份拉面，看向别处：“我知道你要问什么：不，这不是偶遇；不，我不会说是怎么知道你来的。我的工作就该知道的比你多。”</p><p>你说她真是一如既往地粗鲁，这话倒让她唇边扬起一个淡淡的微笑。“打成一片，反而不好办事。我们还是公事公办。说说你都打听到了什么。”你担忧地环顾四周的人群。专员摇了摇头：“我确保了你没被跟踪，给我交代。”你望向她皮带上的枪，好奇她为了保密能做到什么地步。</p><p>你对着热气腾腾的拉面历数自己迄今为止的发现。身边的雨越来越大，混杂着烤肉和甜料的香味。你发现人群中飘过一缕红色，但你看过去的时候，只发现了一面血红色扇子上的倒影。专员按按指节，你继续报告。等你说完，泰勒付了账，站起来。</p><p>“听起来你干的，怎么说，还行？”她一本正经地说道，“不过，基金会另有需求。我们要你送一份包裹到拉各斯的圣堂去。务必平安送抵。”她交给你一沓用粗绳绑好的文件。</p><ul><li>在剧本日志中，记录下*特别小组正在传递情报*。每位调查员必须将一张基金会情报加入自己牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "specialDelivery2": "<p>你穿过狭窄的街道，在后巷碰见了一个隐蔽的身影。你念出自己收到的指示上面的话：“六狮伏于夜。”那个身影压低帽沿，回道：“享宴尽饕餮。”你放下戒备，将文件交给了基金会的人，对方退入了阴影。</p><ul><li>在剧本日志中，划掉*特别小组正在传递情报*。每位调查员从自己牌库移除一张基金会情报。选择混乱袋中任一数字标记。将其替换为比原来数值高1的标记*(例如，你可以用+1标记替换0标记，或者用-2标记替换-3标记)*。</li><li>你可以_启程_。</li></ul>",
        "specialDelivery3": "<p>你沿着基金会的加密指示，来到拉各斯一家小小的咖啡馆，这里地处市中心的繁忙街道。有个人正坐在露台上俯瞰熙攘的市集，手里还捧着一杯深红色的液体——是泰勒专员。你走近的时候，她一手洗过桌上的纸牌，一边抬头看你。</p><p>“你清楚地跟上了指示。”她说着示意你坐在旁边，“会玩惠斯特吗？”暖风吹过，你坐了下来。泰勒给你发了十三张牌，掀开第一张：是个J。“现在，给我交代。”你们玩牌的时候，专员问你在全球有何发现。最后一张王牌掀开的时候，泰勒死死地盯住你。</p><p>“我们现在已经确认了同志会十三个成员的身份。但证据显示还有更多，多得多。即便我们抓了一个，组织还是存续，更不要说他们的手下和爪牙。这感觉就像蚍蜉撼树。”你问专员她都在忙什么，她放下自己的最后一张牌，露出一个坏笑：“要想解决他们，就得釜底抽薪。”</p><p>你打出自己的最后一张牌，差点就赢了。泰勒把牌收了起来。“这次是我赢了，但我期待下一次。”她抿了一口饮料，“别忘了我说的。找到他们聚在哪里。”她正说着，一个穿着西装的大个子从楼一侧过来，在她耳边低语几句。“很抱歉我们只能谈到这儿了，我在摩洛哥还有事情要处理。不巧，我没时间送出这些文件了——把这些带给我们在东京的人吧。”</p><ul><li>在剧本日志中，记录下*特别小组正在传递情报*。每位调查员必须将一张基金会情报加入自己牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "specialDelivery4": "<p>你靠港之后，按照基金会的指示，找到了一间标着39-0和红狮的仓库。你一进去，就把泰勒专员的文件交给一个眼神冷峻的基金会人士。对方谢过你，遁入了暗影。</p><ul><li>在剧本日志中，划掉*特别小组正在传递情报*。每位调查员从自己牌库移除一张基金会情报。选择混乱袋中任一数字标记。将其替换为比原来数值高1的标记*(例如，你可以用+1标记替换0标记，或者用-2标记替换-3标记)*。</li><li>你可以_启程_。</li></ul>"
      },
      "theCoiledSerpent": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "衔尾蛇",
        "label": {
          "keepInquiring": "“继续打探，要是得知什么就告诉我们。”",
          "stickAround": "“我们会留下来帮你。”",
          "forgetHer": "“忘了她吧，我们需要你的帮助。”"
        },
        "theCoiledSerpent1": "你来之前给福林特工寄了封信，定好了会面的时间和地点——中午时分，在静安寺碰头——你一到上海，就马不停蹄地赶了过去，走进寺庙入口处宽阔的石板庭院。不多时，一个游客朝你走来，用英语问道：“你确定自己是一个人吗？”你花了一会儿，才认出来者不是旁人，正是福林。他的易容虽然简单，倒也逼真。他看到你瞪着他，眯起了眼睛。“回答我。”他说着扫视周围。</p><p>你向他保证自己没被跟踪。“不得不小心啊。到处都是眼线。正如基金会的情报所说，我在上海盯上了一个同志会的。他们称她‘客体#46-Q’，即‘红伞夫人’。她肯定去哪都带着那把伞。同志会的记号到了哪儿都是那么显眼。”他轻声说着，一边从旅行袋里拿出一台巨大的照相机和三脚架，颇费功夫地拍了一张寺庙的照片。</p><p>你好奇福林这是唱的哪一出。“别盯着我了。”他从牙关间挤出一句话来。你接着就发现其他游客也在拍照，福林显然比你更融入他们。“我上一次看到红伞夫人，她刚跟几个富有的英国和中国商人开完会——都是铁路大亨。”他头都没抬起来，轻轻地说道。“女人一般是不能出席这种会议的。一般人更不行。要想进去，就得吸引大人物的注意，也就是说你要么自己有势力，要么有钱得吓人。”福林又拍了几张照片，然后换了个地方，从头继续这种聚焦的无聊把戏。“会刚开了两个礼拜，他们就宣布了一项新合同，可以赚得盆满钵满。一个接一个的理由说服了所有的竞争者，竞相远离这个项目，任凭他们自己提出方案，漫天开价。”他又一次缓缓扫视庭院，小心翼翼，只动眼睛，不动脑袋。“也许是她用了什么手段，或者她就是迷人。但我敢打赌，肯定是钥匙的影响。要真是这样，我们可不能上钩。”福林的偏执也传染到了你身上。</p><p class='basic'>检查剧本日志。</p>",
        "toldTheTruth": "*特别小组将真相告诉了泰勒*",
        "hidTheTruth": "*特别小组对泰勒隐瞒真相*",
        "theCoiledSerpent2": "<p>“唔，我本来是能再告诉你点东西的，甚至想让你帮帮我。但你显然是个大嘴巴，而我可千万不能让同志会发现我盯上他们了。所以，我们分头行动吧？你继续干你的，我要是找到重大线索就联系你。”福林不顾你的反对，收起相机走了。</p><ul><li>在剧本日志中，记录*福林独自行动*。</li><li>在剧本日志中，“流逝的时间”下方，从当前时间起往后数6格。在该格写下“ψ”。*(在你到达该格时，进入剧本手册中，状况报告部分的状况报告普西ψ。)*</li><li>你可以_启程_。</li></ul>",
        "theCoiledSerpent3": "<p>“要了解她的更多情况，找到合适的机会予以羁押，还得花上更多的工夫。”福林悄悄说道，“我看到你是怎么对付泰勒的了。我相信你的谨慎。我要是找到重大线索就联系你。或者，你也可以留在这里协助我调查。”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*“继续打探，要是得知什么就告诉我们。”*</li><li>*“我们会留下来帮你。”*</li><li>*“忘了她吧，我们需要你的帮助。”*</li></ul>",
        "theCoiledSerpent4": "<p>“狩猎愉快。”福林说着点了点头。他交给你一张纸，上面写着酒店房间号，还有一个草草补上的化名。“以防你要联系我。我要是知道了什么，就给你发电报。至少你的旅费应该是政府报销的吧？”</p><ul><li>在剧本日志中，记录*福林独自行动*。</li><li>在剧本日志中，“流逝的时间”下方，从当前时间起往后数6格。在该格写下“ψ”。*(在你到达该格时，进入剧本手册中，状况报告部分的状况报告普西ψ。)*如果“流逝的时间”下已不足6格，则改为在最后一格写下“ψ”。</li><li>你可以_启程_。</li></ul>",
        "theCoiledSerpent5": "<p>你花了几周时间，成功和猎物的商业伙伴建立了关系。这群人都是矿业或铁路营造方面的大亨。你静待时机，赢得了一点信任，他们很快就提起了红伞夫人，称她为朱三娘，她巧舌如簧，谈判技巧堪称传奇。其中一个笑容颇为恶心，提及她的本事能让工会接受糟糕的条件，让当地政府对采掘自然资源睁一只眼闭一只眼。你借口项目需要她的帮助，询问怎么才能联系上她。在座有人告诉你，她刚在香港达成一项交易，正往那儿去了。</p><ul><li>在剧本日志中，记录*特别小组援助福林的调查*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>在剧本日志的东南亚部分，找到香港，在其位置写下“50-S”。从现在开始，每当你启程，可以旅行前往香港。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>",
        "theCoiledSerpent6": "<p>福林给了你一个沮丧的眼神：“当真？都忙了这么久了？”你解释说，倘若红伞夫人真有那么隐蔽又危险，那么现在去操心别的更紧急的案子才是审慎之举。“我想你可能是说到了点子上。只是听上去之前的努力都白费了。不过要是我跟专员汇报，她想必能明白发生了什么。也许他们会派什么别的人来……”他的声音越来越低，摇了摇头，“不，他们会把一切都搞砸的。”</p><ul><li>在剧本日志中，记录*福林放弃了自己的调查*。任意一位调查员可以将福林探员剧情支援加入其牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到。图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>你可以_启程_。</li></ul>"
      },
      "romulusAndRemus": {
        "title": "罗慕路斯与雷穆斯",
        "body": "检查剧本日志。",
        "offMission": "*特别小组另有使命*",
        "onMission": "并非上述情况",
        "romulusAndRemus1": "<p>“这……可能是我听过最糟的消息了。”奎因特工在你们前往帕拉蒂尼山的时候说道。这片区域有无数神庙的遗迹。每一处曾经都是洁白的大理石奇迹，装点着华美的象牙浮雕和精巧的雕塑；现在山丘上却只剩半埋入土的断壁残垣。你想安慰奎因，但她是绝对的——这可能是白费力气，甚至可能是个陷阱，泰勒专员要是知道她的特工居然试图跟红色同志会的成员暗通款曲，想必是不会高兴的。但你怀疑，艾里奇肯定比你更了解全球各地发生的奇异失踪，这兴许比泰勒给你的任务更加重要。奎因叹了口气，点头表示同意：“我知道。所以我才会来。但还是……”她走着走着不说话了，注意到远处有什么东西，朝那个方向走去。“这里——那些是奥古斯都宫殿的遗迹。据说就是他建了附近的帕拉蒂尼山阿波罗神庙。大部分学者都认为附近的遗迹是朱庇特胜利神庙，但我敢打赌它们其实属于阿波罗。”</p><p>你叹了口气。取出艾里奇给你的白鸦哨子。此时不试，更待何时。最坏也不过就是浪费了你和奎因的时间。你将哨子拿到嘴边，猛吹一口。响起的颤音遥远得不可思议，和加德满都以来一直萦绕你不散的怪声一模一样。就连风也突然迅疾刺骨了起来。奎因将大衣拉得更紧了。就像乘风突然一样，你随即看到她了。</p><p>艾里奇·佐尼·奥佩勒曲亚就站在古代神庙的遗迹之中，她的腰带在凛冽的寒风中成了一道亮丽的色彩。等到风和刺耳的哨音都已消散，她的长发还是挡在脸前，遮住了面容。“真希望你知道自己在干什么。”奎因朝你低声抛下一句，不无畏惧地走向那个阴森的身影。猩红腰带的少女念出一个词，是古埃及语。奎因停住了脚步。特工照样回应，艾里奇听了偏偏头，好似理解，又有点好奇。渐渐地，这两人一点点开始交谈，每说一句都要换种语言，仿佛两个学生在彼此测试。你敬畏地看这二人把玩着古代语言，不费吹灰之力。</p><p>奎因终于对你说话了：“你是对的。她正在找一个地方，就是……”艾里奇又说了一遍，奎因翻译了：“你遇到那些实体的地方。她觉得那些被夺取——不，是吞没——的东西，会出现在某处。她正在找寻那些地方的归处。”你问奎因，她是否觉得地球上有这么一个地方。“我确实想到一个。”她答道，“百慕大三角，也就是魔鬼三角，在大西洋上。我们尽力保密，但还是有许多船只，甚至飞机都在这片区域失踪了。其中有几桩也记在了我的记忆异常清单上。那里可能会是某种……门扉。”</p><p>你问她问艾里奇是不是在找这个地方，两人又开始交谈。“她说她觉得同志会里有人——”奎因伴着纠结了一下翻译，“——被夺走了？这怎么可能？他们所有人我们都记录在案。至少我们知道的那些都记了。”你回想自己所见，突然一阵恶心。有没有可能都是真的？有没有可能同志会中的某人已非真身？</p><p>你接近问艾里奇愿不愿意和你一同前往那道门扉——如果它当真存在。奎因试探着翻译了你的要求，神秘的身影点头回应。你心中充斥着一股奇异而坚定的决心，仿佛一道亮光已经刺穿深渊。你举起哨子，说自己准备好的时候会召唤她的。这一次，艾里奇没等奎因翻译就点了点头。风又起，吹扬了她的头发，你看到她厚重的刘海下犀利的红眼睛。你拉紧外套抵御寒风。不过片刻，艾里奇·奥佩勒曲亚就消失了，仿佛一缕风。</p><p>你问奎因愿不愿意和你一起再久一点儿。“说老实话，我真的吓到了。”她细声说道，“但我想咱们确实追到了什么。没错，我会跟着你，直到完全查清。我只是希望……”她打了个寒战，没再看你。“我只是希望这一切结束的时候，还有人能记得我。”</p><ul><li>在剧本日志的美洲部分，百慕大三角*(由宜博市、圣胡安和百慕大之间的连线组成的三角形)*内写下“56-Y”。从现在开始，每当你启程，可以旅行前往百慕大三角内。你可以从宜博市、圣胡安或百慕大花费1_时间_前往。*(你在这么做时，进入剧本手册的档案56-Y)*。</li><li>你可以_启程_。</li></ul>",
        "romulusAndRemus2": "<p>你在罗马搜寻数日无果，最终来到了卡比托利欧山上的保守宫。数十座古代雕塑中间，是著名的母狼乳婴铜像，一对双胞胎正吸食着母狼的乳汁。向导告诉你，这对双胞胎就是建立了罗马的罗慕路斯与雷穆斯。“这对双胞胎本是先王的外孙，但先王遭兄弟暗算，双胞胎也被扔进了台伯河。不过，神灵庇佑这对双胞胎，让母狼捡起抚育了他们。他们就在山洞里长大，最后被人发现，安全返乡。”</p><p>向导将你们引入另一间馆藏，里面空空荡荡，只剩下了展台。你问向导这里之前展出了什么。“什么都没有。”他笑道。你议论说怎么会有这么多空房间和展厅，向导的笑声不屑一顾。“这么多年了，当然遗失了许多。”他说道。你看向窗外布满诡异空洞的城市天际线，不禁想问是不是罗马本身也在消失。</p><ul><li>每位调查员下一场冒险开始可以在其资源池有额外1资源。</li><li>你可以在本剧本期间返回罗马，但要先进行另一场冒险。</li><li>你可以_启程_。</li></ul>"
      },
      "theSafehouse": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "藏匿之地",
        "theSafehouse1": "<p>当地人热情好客，并且不介意你问东问西，实在是一件幸事，因为“废弃的烟厂”这句描述一点也没有缩小调查范围。在宜博市，这样的工厂简直数不胜数。数以千计的移民在这个坦帕附近的城区建立、操持着产业，使得此地熙熙攘攘。要是你得一家一家地查看过去，只怕这周都走不了了，所幸你找到一条迹象，前往海湾北部：那里有一栋宁静破败的建筑，旁边的仓库用木板封了起来。倘若不知真相，那你肯定会以为这里不过是一家80年代所建的废旧工厂，里面除了灰尘和老鼠什么都没有。但一路以来的经历，都告诉你不要太过相信自己的眼睛。</p><p>你小心翼翼地接近大门，试着打开。跟你想的一样，它纹丝不动。如果这里真是同志会的圣堂，想进去肯定没那么简单。要想穿越三层楼高的窗户也非易事。所以你绕到仓库的另一边，发现了一扇金属大门，可能是装载货物跟补给的通道。这门上也没有把手或是门闩，你决定敲敲看。片刻之后，门另一端响起一个粗哑的声音：“口令。”</p><p class='basic'>检查剧本日志。</p>",
        "safehouse": "*你知道了口令*且当前时间为_Θ_西塔或之后",
        "noSafehouse": "并非上述情况",
        "theSafehouse2": "<p>你前倚念出了德西教你的——“黑鸟孤鸫”，门开了。门里面站了个肌肉魁梧、一嘴络腮胡的汉子，朝你露齿一笑。你看到他的手放在身边挂着的左轮手枪上，不由得停了下来。但片刻之后，他就退到一边，让你进去了。“老板说过你可能会来。”这门卫说道，“他说让你到处看看，需要什么就拿。”</p><p>你进去了，但眼睛还是盯着这个男人。你可不希望自己搜寻的时候后面挨一枪。他似乎是察觉到了你的顾虑，掏出枪来，倒空子弹。“朋友，看看，我知道你帮了德西什么忙。他的朋友就是我的朋友。”他直面你怀疑的眼神，“要是这里有你找的东西，拿就是了。”</p><p>你没花多少工夫就找到了德西藏在这里的钥匙。它就挂在仓库远端的墙上，底下是一堆补给和弹药。你惊讶的表情在它异界的光泽中映出扭曲的样子。这是一柄长度惊人的双面刃，却没有任何把手可供抓握。这兴许是件武器，但肯定非同凡响。</p><p>“这件旧东西？”你小心翼翼地将其从基座上拿下来的时候，男子粗声粗气地问道。“就是一大块古怪的金属罢了。德西还当回事地保存起来。真是让我大吃一惊。”你两手捧着这柄利刃，一股能量脉冲温和地从两臂传来。这不是一件装饰——这就是真品。</p><p>你趁着还在这里，研究了一番德西的报告和情报。大多你都已经知道了，但看起来他正小心翼翼地监视着几个同伴。不过还有几张偷拍的照片，上面的女子肩上搭着一把红伞。这女子正对着相机露出了然于心的笑容，昭然若揭。她知道德西在盯着她。照片背面是黑色墨水草草写下的一句话：“你这次手伸太长了，朱。”</p><p>你又搜刮了一番，但也没找到什么。看到德西的生意和同志会的既定目标大相径庭。也许同志会比基金会认为的要复杂得多。或许又是这只是另一个幌子。不重要。你已经得到了自己想要的。</p><ul><li>选择一位调查员拥有镜刃，相应更新在剧本日志中。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>每位调查员取得2点经验值，因为其洞见了红色同志会的内部运作。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "theSafehouse3": "<p>无论你说了什么，门另一边都缄默无声。你随即听到了低沉但清晰的声音——是左轮手枪缓缓上了膛。你立马决定走人。等知道要怎么进去，你还能再回来……</p><p class='basic right'>你可以之后再回到本地点。现在，你可以_启程_。</p>"
      },
      "whistleOnTheWind": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "风中孤哨",
        "label": {
          "accept": "接受她给你的东西",
          "reject": "拒绝她递过来的东西"
        },
        "whistleOnTheWind1Part1": "<p>加德满都的街道上充斥着刺骨的寒风，响起一阵微弱而刺耳的哀鸣。北面的喜马拉雅山俯瞰全城，西垂的太阳照亮了顶峰。粉色和紫色笼罩的天空有一种浓艳的美感。这景色叫人屏息，你可以永久凝视……但你还有活要干。黄昏一片宁静，但轻微的尖声却未停止，仿佛你意识深处一股刺痛的恐惧。夜色渐深，哨声愈强，你意识到这怪声只有自己能听到。仿佛是直接奔你而来，仿佛它也能听到你，仿佛它知道你。你突然决定闭上双眼，竭尽所能，听得更多。很难分辨这声音究竟来自何处——仿佛是四面八方，在街道中回响——但你绕过最近的街角，往北边去的时候，音量也变大了。于是你继续朝北。</p><p>终于，你在几栋老房子中间找到一家画廊。这里的哨声最为响亮刺耳，听起来就像水烧开了。这么晚了，画廊早已关闭，但你还是轻易地找到了半掩着的入口。你做好准备走了进去，里面展出了几十件尼泊尔雕塑和绘画——许多是木质或石质，其他的则是阿什塔金——这种合金由八种金属铸成。还有一些陶瓷制品。你走到画廊最里，这里有一件展柜竟是空的，哨声戛然而止。没有迹象表明这里曾经展出了什么，但这样的空位肯定只该是一件极具历史意义的珍宝。一个孤冷的声音随即穿透了突如其来的寂静，诉说着一种你并不理解的语言。</p><p>你回转过去，全身一下子紧张起来。房间另一头出现了一个穿着白裙的女孩。渐黯的阳光穿透了整座建筑，照得女孩的身影若隐若现。她长长的乌发披落下来，挡住了脸。腰间系着长长的腰带。尽管此时无风，却在身后飘扬。</p><p>你呆住了。女孩的身影并未移动，她的长发和腰带就在一片静默中飘动。她又开口了。你还是一个词都听不懂，但你注意到她换了一种语言。渐渐地你认出了几个基本词汇，意识到她在说拉丁语。她随即又换了一种语言，这次听上去像是古希腊语。倘若她正试图与你交流，最好还是有所回应。你问她在这里做什么，又为何将你引至此处。她又换了一种语言回应，你依然不懂，只是听起来像埃及语和希腊语的混杂。</p>",
        "drifter": "<p class='red'>_仅当有调查员具备漂泊者特性才能阅读(温蒂·亚当斯除外)：_你是去过不少地方，也通晓多种语言。你试了几种自己所会的语言，每次都撞上一阵沉默。但她还是想和你交流，一直变换着语言，竟无重复。她是不是只会说早已死去的语言？</p>",
        "whistleOnTheWind1Part2": "<p>你们语言不通，很难理解她到底想要你干什么。你试着描绘出她的意图。她慢慢接近，在木地板上竟然一点脚步声也没有。她指着你旁边的空展柜，轻轻吹出哨声，仿佛这哨音自有其意义。你好奇这里本来是不是有什么，随即一下子明白过来：这件东西是消失了，从历史上抹去了痕迹，不留一点踪迹。你回想起基金会的密档中提过这个女子的名字，问她是不是也在追寻造成此类失踪背后的实体。艾里奇·奥佩勒曲亚看上去并未理解你在说什么，但她认出了自己名字的音节，点了点头。她从自己脖子上取下了什么，攥在拳头里交给了你。</p><p class='basic'>调查员队长必须决定（选择一项）：</p><ul><li>*接受她给你的东西*。</li><li>*拒绝她递过来的东西*。</li></ul>",
        "whistleOnTheWind2": "<p>你伸出手，接住了银链系着的小东西。是枚骨哨，看起来形似白鸦的头喙。你望回艾里奇，她指着空展柜的铭牌，说了些什么，在你听来像是拉丁语。你问她要做什么，这枚哨子又有何意义，但她神秘万分地沉默着。你将哨子翻来覆去，却没有找到任何记号，不知道它到底是用来做什么的。你回头想问艾里奇，但她却消失了，只余渗入骨髓的寒风。只有你能听到的哨声又一次响起，不仅刺耳，而且摧人心神。只要哨子在你手中，这声音就不会停止。</p><ul><li>在剧本日志中，记录*特别小组拥有了神秘的哨子*。</li><li>每位调查员承受1点精神创伤或1点肉体创伤，因其无法摆脱这刺耳的噪音。</li><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>你可以_启程_。</li></ul>",
        "whistleOnTheWind3": "<p>你小心翼翼地退后。倘若同志会的成员——尤其是像艾里奇这么神秘又危险的——想要给你什么，那肯定没好事。况且，你的任务是阻止他们收集更多的钥匙，而不是跟他们合作……对吧？艾里奇垂下了手，室内的温度也瞬间下降。她察觉到了你的不信任，十倍奉还，不再说话。片刻之后，寒风再临，你惊讶地发现她不见了。</p><ul><li>在剧本日志中，记录*特别小组拒绝了艾里奇的馈赠*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>你可以_启程_。</li></ul>"
      },
      "infernalMachinery": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "地狱装置",
        "infernalMachinery1": "<p>你乘着双翼飞机，在维多利亚湖氤氲的灰色浓雾中降落在尘土飞扬的跑道上。内罗毕所有关于特瓦耶·马萨伊的线索都指向了维多利亚湖，据传同志会成员正将数以吨计的勘测设备运抵此处。你朝湖畔走去，风中传来一阵微弱却刺鼻的碱味。湖边停着几艘大船，个个装着沉重的设备。你在阳光下看见有个戴宽边眼镜的人正在码头卸货。</p><p>这个瘦削的男子上岸的时候，你跟他打了招呼：“马萨伊教授？”马萨伊看到你颇为紧张，扶起了眼镜。</p><p class='basic'>检查剧本日志。</p>",
        "reputation": "至少记录了下列三项*(红衣女郎站在你这一边、特别小组援助了骑士、艾里奇站在你这一边、德西站在你这一边、特别小组与索恩达成交易，或艾婕信任特别小组)*",
        "noReputation": "并非上述情况",
        "infernalMachinery2": "<p>“你可真是声名远播，像你的飞机一样如雷贯耳。”马萨伊虽然在笑，但你看得出他的举止下潜藏着紧张。“你来的可真是时候，介意陪我去水上看看吗？”</p><p>你坦荡同意，教授领你上船，在船尾坐下。另有几个队员也在船上。引擎轰鸣，你们在清澈的湖面开出一条道来。校准航线之后，教授躬身坐在你对面，透过红色大框眼镜仔细打量着你。“说实话，我很惊讶你能找到我。我在同志会的时候活跃得很，但现在不了。现在，和必须完成的大业相比，他们操心的事情是多么无关紧要。”</p><p>你问他所谓的大业是什么，教授笑了：“这大业是为了所有人。在这个危险又宏伟的世界，人们要是不活下去，不互帮互助，会变成什么样子？这比你想的更难。”维多利亚湖上风大了起来，他握紧材料，翻了几页，递给你几张复杂的图表。</p><p>“这里的湖床都是沉没城市的遗迹。是我在监测酸度和化学指标的时候偶然发现的。某物正在增加——更准确地说，生成——极其巨量的二氧化碳。当地的动植物也发生了奇怪的突变。我们查找了几个月，终于定位到生成的源头。”教授指着维多利亚湖地图上一个红色的X。你问他船是不是就往那儿开，教授笑了。“不，已经去过了。导致二氧化碳生成的是一件充满力量的物品，一个钥匙。我们上周花了好一番工夫才捞起来。”</p><p>他手下的队员切断了引擎，你不禁毛发倒竖。他们看上去都没有武器，但你还是顿时感到自己的处境非常危险。</p><p>“不用担心安危，朋友。”马萨伊用布擦了擦眼镜，“我不是你的敌人。我确实操心同志会，但内部运作已有蹊跷。尤其是那个戴手套的。我觉得他已经沉寂太久了。”教授叹了口气，瘫回座位。你们四周维多利亚湖平静的水面如梦似幻，但头顶的乌云已在积攒可怕的风暴。</p><p>“是你的了，当然。”马萨伊抬头看天，闭上了眼睛。“我们找到的神器属于某种地狱装置，而它，甚至现在，还在湖底运行。我想知道是谁启动了它，又是什么时候？要是它停止运行又会怎样？无论如何，要是我的同事所言不虚，那这东西在你手里，比在我手里更安全。”马萨伊手下的队员重启引擎，而他睁开眼，望着湖面。</p><p>“也许你能办成我办不到的事。”</p><ul><li>在剧本日志中，记录下*特瓦耶·马萨伊站在你这一边*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>选择一位调查员拥有灾祸引擎，相应更新在剧本日志中。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "infernalMachinery3": "<p>“非常抱歉，但我恐怕没有时间聊天。”马萨伊说着从你身边轻轻走过。你跟着他，提议让他帮忙，提出观点，只要能帮你和红色同志会交锋的事情，你照单全收。“啊，我没想到自己是在和基金会打交道。你肯定是新来的。”马萨伊换了一种眼神打量你，将你带入一顶临时帐篷。“好好，在这儿等一会儿，我会尽快来的。”</p><p>教授走出了视线，而你在雨篷下一张露营椅上坐着等，这椅子真是矮得有点滑稽了。时光流逝，开始下起暴雨，仿佛头顶的云层都裂开了一样。你又等了一会儿，站起来朝着湖岸看去，却发现船已经开走了。你向当地居民问起教授的去向，他们却告诉你勘测已经结束，他往湖对岸去了。</p><p>你回到内罗毕，去找英国领事，发现马萨伊的旅费由牛津承担。他之前公布的旅途中还有一个模糊的地址位于百慕大。你收下这份信息，继续踏上旅程。</p><ul><li>在剧本日志中，记录下*特瓦耶·马萨伊逃往百慕大*。</li><li>你可以_启程_。</li></ul>"
      },
      "bloodSweatAndTea": {
        "title": "鲜血，汗水，和茶叶",
        "body": "检查剧本日志。",
        "aided": "*特别小组援助福林的调查*",
        "tenOrLessTime": "*福林独自行动*且自普西_ψ_流逝的时间不超过10",
        "moreThanTenTime": "*福林独自行动*且自普西_ψ_流逝的时间至少为11",
        "bloodSweatAndTea1": "<p>火车抵达香港的时候，福林和你分享了最新的线索。“朱三娘今天下午要在一家当地茶馆和她新近的生意伙伴会面。据我所知，这群人真是蛇鼠一窝。这种人为了赚钱，不惜将手下的工人剥削至死。朱三娘接近这种人，让我有个想法：她干这些不是为了钱。她一次次在这种交易上帮英国人残害老百姓，看起来就像……很享受别人受苦似的，甚至更糟。”</p><p>你们还没来得及深入讨论这个想法，火车就靠站了。你和福林冲下月台，奔向茶馆，但还是太迟了：你一眼就在街上的人群中认出了醒目的红伞正迅速走远。你凭着眼力追了上去，而持伞人已拐进一条小巷。福林低语让你停下，但猎物已经近在咫尺，怎能放手？</p><p>你一进小巷，朱三娘就转过来直盯着你。“是有很多人关注我。”她轻声说道，“但我觉得你对我的兴趣也太重了。”她敲敲伞尖，一阵银光穿过地面奔你而来。你瞬间麻木，倒在地上。你全身刺痛，四肢无力。朱三娘笑着举起伞走远了。她走出几码，自信无人听到，对手下说道：“这里的事办完了。基金会盯上我们了。把他们干掉，到雪兰莪俱乐部去看看成果。”</p><p>你听到脚步声渐渐逼近，但福林赶先将你抬了起来，拖到了外面的街上。这里人流如织，光天化日之下你是安全的……至少现在是的。你渐渐地恢复知觉，福林沉思道：“皇家雪兰莪俱乐部——是吉隆坡的一家社交俱乐部。走吧，我们没时间浪费了。”他帮你站了起来。刚才的冲击打得你身心颠倒，现在才渐渐恢复了过来。那柄伞完全不止是同志会的标示——它就是钥匙！</p><ul><li>在剧本日志中，记录*福林前往吉隆坡*。</li><li>在剧本日志的东南亚部分，找到吉隆坡，在其位置写下“46-Q”。从现在开始，每当你启程，可以旅行前往吉隆坡。</li><li>你可以_启程_。</li></ul>",
        "bloodSweatAndTea2": "<p>你在香港动植物公园见到了福林特工。他凑近和你握了手。“没人跟着你吧？”他问道。你保证没有。你向来谨慎。</p><p>你们和全世界的游客一样在园中漫步，他趁此机会和你更新情报。他说红伞夫人化名朱三娘，正做国际生意，帮助英国人扩张帝国，手段常常下作。她巧舌如簧，谈判技巧堪称传奇，她能让工会接受糟糕的条件，让当地政府对采掘自然资源睁一只眼闭一只眼，甚至还有更糟的事情。</p><p>“我们得小心啊。”福林警醒道，“朱夫人显然不好对付。她那柄伞就是开启谜题的钥匙——我用了个双关，你不介意吧？我觉得其实就是那伞让她有了操纵意愿的能力。”</p><p>你无法否认——证据已经堆积如山了——福林一开始的直觉很准。“更糟的是，她已经怀疑我们盯上她了。这周早些时候，有个同志会的人发现我了。所幸我占了上风，在他发现我的藏身处之前，我先找到了他的。然后是最精彩的部分。”他露出一个狡黠的笑容，“他居然还有日程安排，下一站就要前往皇家雪兰莪俱乐部。那是吉隆坡的一家专供达官显贵的社交俱乐部。你要一起来吗？”</p><ul><li>在剧本日志中，记录*福林前往吉隆坡*。</li><li>在剧本日志的东南亚部分，找到吉隆坡，在其位置写下“46-Q”。从现在开始，每当你启程，可以旅行前往吉隆坡。</li><li>你可以_启程_。</li></ul>",
        "bloodSweatAndTea3": "<p>你回复福林特工的电报之后，他就再没有给你回过信了。你亲自前往他最后入住的酒店，询问一番，但却得知他并没有收到你的回信。而门房说，他其实已经几天都没看到福林回来了。你笃定这场失踪的背后是同志会在捣鬼，要想找到福林，最好的方法就是找到红伞夫人。</p><p>你花了几天工夫去找寻同志会的踪迹，但一无所获。你跟几个商业人士建立了联系，问起红伞夫人。大多数人佯装不知，但你还是打听到马来西亚有一条铁路在建。工程耽搁了，他们派人去达成协议，还说“没人能拒绝她。”也许福林是去吉隆坡自行调查了，但……</p><p>你突然僵住了，你怀疑最糟糕的事情已经发生了。</p><ul><li>在剧本日志中，记录*福林特工失踪*。</li><li>在剧本日志的东南亚部分，找到吉隆坡，在其位置写下“46-Q”。从现在开始，每当你启程，可以旅行前往吉隆坡。</li><li>你可以_启程_。</li></ul>"
      },
      "ringingHollow": {
        "title": "环环成空",
        "body": "检查剧本日志中已经流逝了多少_时间_。",
        "lessThanTwentyTime": "流逝的_时间_小于20",
        "twentyOrMoreTime": "如果流逝的_时间_大于等于20",
        "ringingHollow1": "<p>你一到悉尼，就立刻寻找泰勒的密档中提到的特工，终于在市东边植物学湾一间仓库里找到了她。这栋房子已经老旧废弃。档案柜铺满了一面墙，里面是她历年的研究；桌上也摊满了地图和照片。“噢，是新的特别小组。”她一边跟你打招呼，一边打开荧光灯，冷冷的光芒照亮了整座屋子。“叫我奎因就行。专员说你可能会来。”</p><p>你问她有什么情报能给你的调查帮上忙，结果却惹得她咯咯笑起来。“什么是我没有的？好吧，就让你看看我现在在研究什么……”</p><p class='basic'>检查剧本日志。</p>",
        "toldTheTruth": "*特别小组将真相告诉了泰勒*",
        "hidTheTruth": "*特别小组对泰勒隐瞒真相*",
        "ringingHollow2": "<p>“我有调查你跟泰勒提过的失踪事件。她有关注，但关注得还不够。”她从桌上提给你一份文件，趁你检阅的时候后仰休息。这里面的信息提及失踪的建筑、地点，有时候甚至是整个村庄，全都神奇地消失了，无法解释。“看着眼熟吗？”</p><p>你点点头，告诉奎因，这就是你给基金会打工前调查的事件。你花了些工夫，将旅程中多次遇见的诡怪实体，还有它们对人与物的影响都一五一十地告诉了奎因。</p><p>“这与我的研究倒是相符。”她指着凌乱的桌子说道，“如果一切都是真的。这些东西已经活跃了几百——上千年了。我们集体遗忘了遭到清除的一切，只有极少数特别固执坚持记忆的人还留有印象。你知道这意味着什么吗？”</p><p>对你来说，答案十分明显——人类也有沦为失落历史的危险——但你不确定她是不是指的这个。</p><p>“我有一种直觉，但在这里研究不出来。看来我应该回不列颠去了。我知道你还有自己的任务，但要是有空，能不能来埃姆斯伯里找我？就在伦敦西边。”奎因当即收拾行礼，一脸紧张的苦相，但你看得出她心意已决。只是她给你留下的答案还没问题多。</p><ul><li>在剧本日志的北大西洋部分，找到伦敦，在其位置写下“27-H”。从现在开始，每当你启程，可以旅行回到该地点。</li><li>你可以_启程_。</li></ul>",
        "ringingHollow3": "<p>“虽然还没写下来，但我正在调查一些特别奇怪的事情。来瞧瞧吧。”她从桌上提给你一份文件，趁你检阅的时候后仰休息。这里面的信息提及失踪的建筑、地点，有时候甚至是整个村庄，全都神奇地消失了，无法解释。你用尽全力，不想露出似曾相识的表情。“你知道这些事情吗？”</p><p>你不喜欢说谎，但也知道白就会暴露你先前骗了泰勒。你摇摇头，告诉奎因你是第一次见。“这也说得通。看，整件事都很蹊跷。关于这些地方，除了你手上这份，再无其他的记录了。就好像它们从历史上完全抹去了一样。要真是这样，怎么能保证我们不会落入一样的下场？”她耸耸肩，“像这样叫人遗忘……哪位最亲近的人也不记得……我最怕的就是这个。”</p><p>你告诉奎因自己也有一样的感受，要是能多给她些情报就好了。她眯起眼睛，怀疑地瞪着你，仿佛将你直接看透。</p><p>“我根本不打算买你的账。泰勒可能相信了你，或者她只是不愿弄脏自己的手。但要是有人当面撒谎，我就能看出来。”一阵沉默，此刻的气氛叫人难受。她最后叹了口气：“好吧。你请便吧。但要是想说什么，可以来埃姆斯伯里找我，就在伦敦西面。”她说着将文件和行李装进一个帆布小旅行袋。你重复了一遍这个地名，好奇她为什么要去。</p><p>她只回答说“那里有我想调查的东西”。既然你自己都没告诉她全部实情，那也不能怪她云山雾罩。她冷冷地瞥你一眼就走了，而你还在想是不是该警告她一路小心。但不知真相也不会伤害她……吧？</p><ul><li>在剧本日志中，记录下*奎因特工不信任特别小组*。</li><li>在剧本日志的北大西洋部分，找到伦敦，在其位置写下“27-H”。从现在开始，每当你启程，可以旅行回到伦敦。</li><li>你可以_启程_。</li></ul>",
        "ringingHollow4": "<p>你一到悉尼，就立刻寻找泰勒的密档中提到的特工，但无论什么地方都找不到她的踪迹，当地人也不记得有见过她。你十分焦急，加倍努力，沿着点点迹象来到市东边一间仓库。这栋房子已经老旧废弃。档案柜铺满了一面墙，里面是她历年的研究；桌上也摊满了地图和照片。但没有奎因特工的迹象。</p><p>从最近的笔记来看，她正在研究的，就是你给基金会打工前调查的事件——失踪的建筑、地点，有时候甚至是整个村庄，全都神奇地消失了，无法解释。但她有没有得出结论，你就不得而知了。</p><p>你找不到别的线索，只能离开，向专员提供一份有关奎因失踪的报告。你希望她只是藏在某处，但直觉告诉你并非如此。</p><ul><li>在剧本日志中，记录下*奎因特工凭空消失*。</li><li>你可以_启程_。</li></ul>"
      },
      "deadAndGone": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "逝者如斯",
        "label": {
          "truth": "告诉奎因特工真相",
          "secrets": "保守秘密"
        },
        "deadAndGone1": "<p>你到了伦敦，遵循奎因特工的指示前往埃姆斯伯里。你刚在酒店办完入住，门房就默默递给你一张便条，上面写了个地址，就在这座历史悠久的小镇西边的公园。你立即动身，到了发现阿丽·奎因特工坐在一辆宾利的驾驶座上，正读着报纸，对你连个眼皮都没抬。你也没怎么惊讶，就默默爬上了座位。“可算来了，都等了一整天了。”你并不明白奎因是怎么知道你到了镇上，但基金会肯定在每个港口和边境检查点都设有耳目。你问她情况怎样，她又要给你看些什么。她只是发动宾利的引擎，一路往西。“你就等着吧。”车行片刻，你看到了熟悉的一幕。你早该想到的——奎因将你带到了神秘的史前巨石阵。此地的标志是一圈立石，里面还有另一圈小些的蓝石，看不出到底有什么用。有几个游人赞叹这壮丽的景色，但除此之外都很沉默。你跟在奎因特工后面，问她为什么要带你来这儿。“这地方很奇怪，不是吗？”她这是句反问——历史学家已经争论了很久，但还是不能确定这处地标到底是何用途。你靠近了些，她指着几块立石和同心圆里小一些的石块：“就像是有什么缺了一样。”</p><p class='basic'>检查剧本日志。</p>",
        "noTrust": "*奎因特工不信任特别小组*",
        "trust": "并非上述情况",
        "deadAndGone2": "<p>奎因看到你的表情，态度顿时变了。“噢，又来了，还是这么不痛快？”她朝蓝石环中心走去，拿出一个表面闪光的精巧装置，发出哔哔的声音，随着她靠近中心不断加快。“啊，这样就证实了我的怀疑……但我还是不知道为什么。那么，告诉我吧，毕竟你知道的比我多：到底是什么鬼东西能让一部分建筑不仅凭空消失，而且在历史记载上也荡然无存？”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*告诉奎因特工真相*。</li><li>*保守秘密*。</li></ul>",
        "deadAndGone3": "<p>你把一切都告诉了奎因——你在伦敦调查的实体、他们与红色同志会可能的联系，所有的一切。她听得专心，每个词都不放过。“那么这些东西，这些……让我们就称之为‘外星来客’吧，它们夺走什么，就完全消失了。你知道这意味着什么吗？”这样的事件能让你得出许多结论，但你还是鼓励她说出自己的想法。“我们所知所见的一切，不过都是剩下来的。看看巨石阵吧，我们根本不知道它是什么。也许是因为根本不完整。我们所在的地方可能还有其他人类根本不知道的建筑。”她前后踱步，焦躁起来。“这是我毕生的工作啊，我研究这些事件已经超过十年了。异常的失踪、消亡的文明。他妈的，我能流利地说十几种死语言！我总是假设这些东西就像是整块陷阱上缺失的一小撮。但要是我们看到的只是剩下的——只是这些生物没有偷走的碎屑呢？”</p>",
        "gainTrust": "在剧本日志中，划掉*奎因特工不信任特别小组*。",
        "swapElderThingForTablet": "从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。",
        "check": "检查剧本日志",
        "goOffMission": "*特别小组拥有了神秘的哨子*且流逝的_时间_小于等于30",
        "stayOnMission": "并非上述情况",
        "deadAndGone4": "<p>奎因叹了口气，扭头不看你：“抱歉浪费了你的时间。你可以开着那辆宾利回伦敦去，离埃姆斯伯里没几英里。我会另找办法回去。”你试着再讲点道理，但她依然故我。“要是你没什么可以告诉我的，那我也没什么能跟你说。别管我了，让我安静地研究吧。”</p><ul><li>在剧本日志中，记录*基金会依然一团糊涂*。</li><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>你可以_启程_。</li></ul>",
        "deadAndGone5": "<p>奎因朝蓝石环中心走去，拿出一个表面闪光的精巧装置，发出哔哔的声音，随着她靠近中心不断加快。“这证实了我的怀疑。”她声音很轻，将读数拿给你看。“在许多其他地方也有一样的读数。罗阿诺克岛、吴哥，你懂的。”她站起来，拍拍仪器，环顾石阵：“你在报告里提到的东西，这些……让我们就称之为‘外星来客’吧，它们夺走什么，就完全消失了。你知道这意味着什么吗？我们所知所见的一切，不过都是剩下来的。看看巨石阵吧，我们根本不知道它是什么。也许是因为根本不完整。我们所在的地方可能还有其他人类根本不知道的建筑。”她前后踱步，焦躁起来。“这是我毕生的工作啊，我研究这些事件已经超过十年了。异常的失踪、消亡的文明。他妈的，我能流利地说十几种死语言！我总是假设这些东西就像是整块馅饼上缺失的一小撮。但要是我们看到的只是剩下的——只是这些生物没有偷走的碎屑呢？”</p><p class='basic'>检查剧本日志。</p>",
        "deadAndGone6": "<p>奎因特工所说突然引起了你的注意。奎因是死语言和古代文明领域的专家。你问她愿不愿意帮一个忙，翻译埃姆斯伯里语纲要。“要是能帮我搞清这一切，那肯定。”她热切答道，“需要我做什么？”你屏住呼吸，告诉她接下来的事情可不能告诉基金会。</p><p>她想了想你什么意思，坚定地点了点头。你将艾里奇给你的哨子交到她手里，告诉她这属于同志会的一员，而对方看上去只会拉丁语、古希腊语和其他你根本不懂的语言。她拿在手里翻来覆去，研究了好一会儿。“白鸦。”她自言自语道，“希腊神话说乌鸦为众神传信，尤其是阿波罗。它们本来都是白的。但有一次，阿波罗派出一只监视自己的恋人科洛尼斯，乌鸦却带回了不忠的消息。阿波罗一怒之下，将乌鸦的翅膀都烧黑了。”你问奎因世上有什么地方能跟阿波罗或是他的乌鸦联系起来。“罗马有献给阿波罗的神庙。”她说，“阿波罗索西乌斯神庙和帕拉蒂尼山阿波罗神庙。你要是过去，就告诉我一声。我们在那儿见面。”</p><ul><li>在剧本日志中，记录下*特别小组另有使命*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "deadAndGone7": "<p>你和奎因特工又探索了一会儿遗迹，各种理论和猜想都试过了，但还是没找到什么进一步的证据。</p><ul><li>每位调查员取得2点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
      },
      "strangeArchitecture": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "奇异建筑",
        "body": "检查你在地图上的位置。",
        "inBombay": "你在孟买",
        "inStockholm": "你在斯德哥尔摩",
        "bombay": {
          "appreciated": "*特别小组对建筑表示惊叹*",
          "notAppreciated": "并非上述情况"
        },
        "stockholm": {
          "appreciated": "*特别小组对建筑表示惊叹*",
          "notAppreciated": "并非上述情况"
        },
        "strangeArchitecture1": "<p>你在孟买南部等电车，突然闻到空气中一阵温暖的芳香。距离下一段旅程还有几日，你得以纵情享受这座城市的异国光彩。第一天，你马不停蹄地去了许多神庙、珍品店和巴扎。你穿过巴扎，前往克拉巴街，印度门就在此处远眺海面。一路上头顶的竹架用丝线系着亮橙色的花朵。日去夜来，镶嵌精致的铜灯照亮了你探索的后巷小街。空气中氤氲着不知名的浓郁气味，朦胧的身影若隐若现。你迷失在老城上头的气氛中。你前往酒店，穿过宽敞的大道进入卡拉葛达区，沿着蜿蜒的老巷一路漫步。</p><p class='basic'>检查剧本日志。</p>",
        "strangeArchitecture2": "<p>你穿过这座艺术街区迷宫般的街道，却看到了熟悉的一幕。你抬起头看到了一栋狭窄的建筑，看到了门顶上的石板、黑黢黢的大窗和令人不安的漆色。你清楚地认识到自己来过这儿。你静静地站着，身边人穿过进了窄巷。你终于想起来在斯德哥尔摩见过一样的建筑。要不是这样特别的黑窗、粗犷的线条，你可能还想不起来。你端详立面，门顶似乎凸了出来。你原本认出的几个人物，在这里却是笨拙古怪的临摹。个个形象特征虚伪、笑容夸张，眼睛鼓出。门上倒是刻着数字13，和斯德哥尔摩的一样。你好奇地上前，转动把手，门没有开。敲门也没有声响。尽管看上去像是木门，却坚硬得有如混凝土。你拦下一个路人，问这栋建筑有多久了。“这地方有些历史了。这些房子都建了很长时间。”你疑惑这样的建筑是不是复制品：其他城市里还有多少房子会看起来一样？你看得越久，这栋房子就显得越是不祥。你脊背生寒，决定不管这栋房子，扭头就走。</p><ul><li>在剧本日志中，划掉*特别小组对建筑表示惊叹*。每位调查员取得2点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "strangeArchitecture3": "<p>你穿过这座艺术街区迷宫般的街道，一座建筑的立面突然耸立在眼前。这栋建筑挤在两座当地老房之中，虽然不算宽敞，但飞檐壮观，石雕精美。古朴的两扇木门上刻着数字13，门顶上的石板刻画着众多神话人物，你只能认出部分。周围的建筑十分精巧，显得这一栋有些格格不入。你研究越久，就越依稀觉得有些不快。外角参差而扎眼，这样的设计透露出一股冷酷犀利的味道。有什么东西正在黑黢黢的大窗旁。里面漆黑一片，就像空洞的头骨。漆黑的夜幕加深了诡异的感觉，旁人看来都不愿逗留此处。</p><ul><li>在剧本日志中，记录*特别小组对建筑表示惊叹*。</li><li>你可以_启程_。</li></ul>",
        "strangeArchitecture4": "<p>你抵达斯德哥尔摩的时候，码头上正一片喧嚣。晨钟响彻清冷的早风，身材高大的码头工人将一箱箱扑扇的银鱼装车。离下次出发还有几日，你抓紧机会探索这座城市多样的文化。一出名为《命运时刻》的剧作就要上演，广告贴满了大街小巷，直到斯德哥尔摩最大的剧院。你沿着卵石路环绕斯德哥尔摩的老城，当地人告诉你这一片地方叫“桥间之城”。蜿蜒狭窄的小路围成了环，绕出奇怪的角度。破旧的芥黄色小巷和风化的建筑构成一片迷宫。你经过一串漆彩艳丽的联排别墅，这里俯瞰着城镇广场。你坐下来，看当地人来来往往，感到千斤重担从身上卸下，哪怕只有一刻。浩瀚的蓝天万里无云，四周的喧嚣倒也叫人安宁。</p><p class='basic'>检查剧本日志。</p>",
        "strangeArchitecture5": "<p>你走过鞋匠街，却看到了熟悉的一幕。你抬起头看到了一栋狭窄的建筑，看到了门顶上的石板、黑黢黢的大窗和令人不安的漆色。你清楚地认识到自己来过这儿。你静静地站着，身边人穿过进了窄巷。你终于想起来在孟买见过一样的建筑。要不是这样特别的黑窗、粗犷的线条，你可能还想不起来。你端详立面，门顶似乎凸了出来。你原本认出的几个人物，在这里却是笨拙古怪的临摹。个个形象特征虚伪、笑容夸张，眼睛鼓出。门上倒是刻着数字13，和孟买的一样。你好奇地上前，转动把手，门没有开。敲门也没有声响。尽管看上去像是木门，却坚硬得有如混凝土。你拦下一个路人，问这栋建筑有多久了。“你什么意思？这座城市这么古老。它一直都在这儿。”你疑惑这样的建筑是不是复制品：其他城市里还有多少房子会看起来一样？你看得越久，这栋房子就显得越是不祥。你脊背生寒，决定不管这栋房子，扭头就走。</p><ul><li>在剧本日志中，划掉*特别小组对建筑表示惊叹*。每位调查员取得2点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "strangeArchitecture6": "<p>你走过鞋匠街，一座建筑的立面突然耸立在眼前。这栋建筑挤在两座当地老房之中，虽然不算宽敞，但飞檐壮观，石雕精美。古朴的两扇木门上刻着数字13，门顶上的石板刻画着众多神话人物，你只能认出部分。周围的建筑饱经风霜，显得这一栋有些格格不入。你研究越久，就越依稀觉得有些不快。外角参差而扎眼，这样的设计透露出一股冷酷犀利的味道。有什么东西正在黑黢黢的大窗旁。里面漆黑一片，就像空洞的头骨。周围的街巷也安静得诡异：路人似乎都不愿在此逗留。</p><ul><li>在剧本日志中，记录*特别小组对建筑表示惊叹*。</li><li>你可以_启程_。</li></ul>"
      },
      "theoryOfAnnihilation": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "灭绝理论",
        "theoryOfAnnihilation1": "<p>你乘坐的船只在里约热内卢靠岸。远方的科尔科瓦杜山俯瞰全城，上面有一座巨大的雕像尚未落成，内部尚空。雕像依稀能看出些人形，舒张双臂，像是欢迎……或是警告？</p><p class='basic'>检查剧本日志。</p>",
        "traveled": "*特别小组与伊拉万博士会面*且流逝的_时间_小于25",
        "vanished": "*特别小组与伊拉万博士会面*且流逝的_时间_大于等于25",
        "met": "并非上述情况",
        "theoryOfAnnihilation2": "<p>经过一番探查，你终于在科帕卡瓦纳街区的贝尔蒙德酒店找到了伊拉万教授。她面前的桌上散乱着草图和学术资料。“你没来讲座真是太好了。”她说，“彻彻底底的一场灾难。一整个礼堂的人都在嘲笑我展示的东西。还有人叫我‘谜之动物学家’。”</p><p>伊拉万教授扶了扶自己大框的圆眼镜，转向一张细节详实的素描，上面画的是棕榈树上栖息的鸟儿。“我将自己展示的东西称为‘灭绝理论’。这一过程在你称之为‘超自然选择’的方式中，使得生态系统吞噬了自己。不只是生态系统，还有自己的记忆，吞噬自己存在的事实。”</p><p>“不要担心，这个术语我会署你的名。”她抿了一口浓浓的黑咖啡，“但最近在亚马逊勘测之后，我担心这个过程正在加速。”十几秒金刚鹦鹉都消失了，我的同事一点也不记得。素描也是一样。在我们记录的所有物种里，只有猩红金刚鹦鹉还在。”</p><p>伊拉万博士漫不经心地翻着自己的速写本，翻到某一页时脸色煞白：“这不可能。”</p><p>你问她发生了什么，她指着那一页给你看：“就在昨天，这一页上还有画，七斑袋貂，一种尚未灭绝的的斑袋貂，生活在新几内亚西部。”</p><p>伊拉万博士收起自己的东西。“我几个月前才画的图。兴许会有些踪迹留在——或者说是这一切背后的力量就在——马诺夸里。”她拂过耳边的一缕头发，朝你笑道：“谢谢你听我讲这些。也许我们还会再见面的。”</p><ul><li>在剧本日志中，记录下*伊拉万博士前往新几内亚*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在“流逝的时间”中当前时间底下记录_δ_(德尔塔)。*(这个符号没有状况报告，只用于记录时间。)*</li><li>在剧本日志的东南亚部分，找到马诺夸里，在其位置写下“45-P”。从现在开始，每当你启程，可以旅行前往马诺夸里。</li><li>你可以_启程_。</li></ul>",
        "theoryOfAnnihilation3": "<p>你一进城，就去科帕卡瓦纳街区的贝尔蒙德酒店寻找伊拉万博士。你向门房提起伊拉万博士的讲座，他帮你检查预订日程，却什么都没找到。你掏出她给你的名片，却发现两面都是空白。看上去她完全消失了……</p><ul><li>在剧本日志中，记录下*伊拉万博士凭空消失*。</li><li>你可以_启程_。</li></ul>",
        "theoryOfAnnihilation4": "<p>经过一番探查，你终于在科帕卡瓦纳街区的贝尔蒙德酒店找到了伊拉万教授。她面前的桌上散乱着草图和学术资料。你先自我介绍，然后问起她的研究。</p><p>“哦，我懂了。你是来取笑我的。”她说着合上了磨损的勘察日志。你向她保证绝对不是，好好地哄了一番，终于让她敞开心扉。“你没来讲座真是太好了。”她说道，“彻彻底底的一场灾难。一整个礼堂的人都在嘲笑我展示的东西。还有人叫我‘谜之动物学家’。”</p><p>你告诉她这还不算最难听的称呼。“大概吧。”伊拉万教授扶了扶自己大框的圆眼镜，“但这已经是给我的生涯判了死刑了。”她转向一张细节详实的素描，上面画的是棕榈树上栖息的鸟儿。“我将自己展示的东西称为‘灭绝理论’。世界正在吞噬自己，不仅如此，也在吞噬自己的记忆，吞噬自己存在的事实。”</p><p>她抿了一口浓浓的黑咖啡：“几年前，我和其他六位著名的学者勘察了亚马逊地区。我们观察了几十种不同的鹦鹉，并且用石头命名：绿松石鹦鹉、紫水晶鹦鹉、黑曜石鹦鹉，诸如此类。可到现在——”她拿出几张白纸，“——一切记录都消失了，同事说绿松石鹦鹉和其他物种都是我编造出来的。有关其栖息地的记录也都没了，素描也是一样。”</p><p>你觉得伊拉万博士没疯，就把自己对失踪案所知的一点点情况也告诉了她。</p><p>“谢谢。”伊拉万说道，“我们能碰上真是太好了。我已经开始觉得这些确实是我脑子里编出来的了。”她将自己的名片给了你，背面写着澳洲一所大学的地址。“我会去珀斯继续调查、讲座。也许我们会在那儿再见。”</p><ul><li>在剧本日志中，记录下*特别小组与伊拉万博士会面*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>你可以_启程_。</li></ul>"
      },
      "paranaturalSelection": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "超自然选择",
        "paranaturalSelection1": "<p>一阵凉爽的清风欢迎你来到珀斯。这里是西澳大利亚的首府，就座落在天鹅河的弯处。虽然——或者说正因为——最近涌起了淘金潮，这里有一种只属于边境小镇的粗犷之感。你闻到风中传来一阵甜腻的气味，是有什么东西腐败了吗？</p><p class='basic'>检查剧本日志。</p>",
        "traveled": "*特别小组与伊拉万博士会面*且流逝的_时间_小于25",
        "vanished": "*特别小组与伊拉万博士会面*且流逝的_时间_大于等于25",
        "met": "并非上述情况",
        "paranaturalSelection2": "<p>你在当地一所大学里找到了伊拉万博士。她正在讲座大厅里收拾，这里没有旁人。黑板上粉笔画了一只粗壮的有袋类动物，手里抓着一把莎草。</p><p>“我没想过能在这儿见到你。”动物学家擦起了黑板。你问她上面画的是什么。“是一种珍稀的短尾矮袋鼠——红尾短尾矮袋鼠。它们一开始是17世纪荷兰探险家引入西澳的，可是现在已经没有人——哪怕是告诉我这个名字的剑桥教授——也不记得它们是什么物种了。”</p><p>“我不知道你对自然选择了解多少，但我们所经历的事情，很像在生态系统中引入一种陌生的顶级捕食者。”动物学家解释道，“只不过，这种捕食者猎杀的不仅是猎物的躯体，还有其存在本身。当然，这样的事情简直不可思议。”她笑了，“但我确实觉得咱们就是它的猎物，而且整个过程还在加速。”动物学家坐了下来，漫不经心地翻起速写本来。</p><p>你想到了基金会用过的术语，建议她将这种现象命名为“超自然选择”。她一下子被这个建议搞晕了，但随即笑了起来。</p><p>“我肯定会把你的名字写上去。”她正说着，脸色突然煞白。你低下头，发现她紧盯着速写本上的一页。“这不可能。”</p><p>你问她发生了什么，她指着那一页给你看：“就在昨天，这一页上还有画，七斑袋貂，一种尚未灭绝的进袋貂，生活在新几内亚西部。”</p><p>伊拉万博士收起自己的东西。“我几个月前才直接观察过，画下了图。兴许会有些踪迹留在——或者说是这一切背后的力量就在——马诺夸里。”她拂过耳边的一缕头发，朝你笑道：“谢谢你听我讲这些。也许我们还会再见面的。”</p><ul><li>在剧本日志中，记录下*伊拉万博士前往新几内亚*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在“流逝的时间”中当前时间底下记录_δ_(德尔塔)。*(这个符号没有状况报告，只用于记录时间。)*</li><li>在剧本日志的东南亚部分，找到马诺夸里，在其位置写下“45-P”。从现在开始，每当你启程，可以旅行前往马诺夸里。</li><li>你可以_启程_。</li></ul>",
        "paranaturalSelection3": "<p>你一进城，就去当地的大学寻找伊拉万博士。你向一位热心的教授提到伊拉万博士的讲座，他帮你查了学术日志，却什么都没找到。你掏出她给你的名片，却发现两面都是空白。看上去她完全消失了……</p><ul><li>在剧本日志中，记录下*伊拉万博士凭空消失*。</li><li>你可以_启程_。</li></ul>",
        "paranaturalSelection4": "<p>伊拉万博士刚刚在当地的大学结束一场讲座，你趁此机会邀请她到附近的咖啡馆聊聊她的研究。你们坐在露台上晒太阳。她将几张素描放在中间的桌上，上面画的好像是某种生物。“你听说过红尾短尾矮袋鼠吗？”她问道。你摇了摇头。“它们一开始是17世纪荷兰探险家引入西澳的，此后就一直留在动物标准分类上。我也是在剑桥学到的。”</p><p>伊拉万博士在速写本上匆匆翻到空白的一页：“五年前我在野外勘测的时候画过几张素描。但最近我打开书和速写本，却发现一片空白，就跟我从来没画过似的。不仅如此，学术界一切有关的注释和来源也都消失了。我去问自己在剑桥的教授——就是那个教我红尾短尾矮袋鼠的人——但他看我的样子，就跟我疯了一样。”动物学家扶了扶自己的眼镜。</p><p>你觉得伊拉万博士没疯，就把自己对失踪案所知的一点点情况也告诉了她。</p><p>“我不知道你对自然选择了解多少，但我们所经历的事情，很像在生态系统中引入一种陌生的顶级捕食者。”动物学家解释道，“只不过，这种捕食者猎杀的不仅是猎物的躯体，还有其存在本身。当然，这样的事情简直不可思议。”她笑了，“但我确实觉得咱们就是它的猎物。”</p><p>你想到了基金会用过的术语，建议她将这种现象命名为“超自然选择”。她一下子被这个建议搞晕了，但随即笑了起来。</p><p>“要是得到你的许可，我可能真会用的。”伊拉万博士说道，“我们能碰上真是太好了。我已经开始觉得这些确实是我脑子里编出来的了。”她将自己的名片给了你，背面写着巴西的一家酒店。“我会去里约热内卢继续调查、讲座。也许我们会在那儿再见。”</p><ul><li>在剧本日志中，记录下*特别小组与伊拉万博士会面*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>你可以_启程_。</li></ul>"
      },
      "metamorphosis": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "变形记",
        "metamorphosis1": "刚入夜，你的船便驶入了马诺夸里的港口。高耸的山峦覆盖着繁茂的绿植，层层叠叠，一直延伸到碧蓝的海水边。夜幕降临，水面下舞动着闪烁的光点：那是会发光的植物，还是别的什么东西？\n\n检查自从_δ_（德尔塔）以来已经流逝了多少时间。",
        "tenOrLessTime": "如果自从_δ_（德尔塔）以来流逝的时间不超过10，进入_变形记 2_。",
        "moreThanTenTime": "如果自从_δ_（德尔塔）以来流逝的时间超过10，跳至_变形记 3_。",
        "metamorphosis2": "起先你还担心会不会没人听过伊拉万博士的名字，但坚持不懈地查问一番之后，一位当地人才不情愿地提出带你去找她。你们深入茂密的灌木丛，沿着陡峭的小道登上附近的山，最终来到一个漆黑的空洞。你发现动物学家正倚在铁树的树干上，聚精会神地望着暗影。\n\n“我没想过你会跟来这里，”伊拉万博士低语道。你学着她的样子，坐到她旁边，也一起望向黑暗之中。周围的空气浓稠而潮湿。“我的理论……并不正确。或者说，至少有部分是不对的。”从你所在的高处，可以望见一道倾泻的瀑布在下方切出一片浅浅的溪谷。月光在狭窄溪流的波纹上闪烁。伊拉万博士继续道：“有关这种斑袋貂的所有迹象都消失了，这确定无疑。当地人也不记得它们。但这次失踪还是有点不一样。有什么东西留了下来。”\n\n树林中传来一声低沉的哀号，吓了你一跳。伊拉万博士掏出一对望远镜，指向林地远端的铁树丛。你也眺望过去，发现三只猫般大小的有袋类动物瞪着黄眼睛，吊在树枝上，卷曲的尾巴在黑暗中摇晃，正在吃什么东西。光是看着它们就让你头晕目眩：它们似乎既在那里，又不在那里，迫使你的眼睛不断调整。它们的动作也僵硬而异常，关节仿佛能反向弯折，既太快又太慢。你移开了视线。\n\n“你看到它们了？”伊拉万博士问道。你点点头，又看过去：斑袋貂正在狼吞虎咽地吃着一条绿蟒。“太惊人了。这是根本性的变化。猎物变成了猎手。我观测到的这几只习性已经完全变了，会袭击别的斑袋貂，捕猎原先的天敌——这里的绿蟒就是一例。它们的天性似乎都改变了！”伊拉万博士激动得结巴起来，“但更重要的是，它们并没有消失。我的意思是，对某些人来说，它们已经消失了。没人记得它们。但它们依然存在。”\n\n你将望远镜转回斑袋貂，却发现它们一动不动，只用明亮的黄玉色眼睛直直盯着你。你大吃一惊，松手掉了望远镜。等你再看时，斑袋貂已经不见了。你突然紧张起来，告诉伊拉万博士最好还是离开，但她却摇了摇头。“我就快接近本世纪最伟大的发现了。那是一整个超动物学研究领域。我现在不能走。”\n\n你任由伊拉万博士自行其是，掉头回到镇上。四周的丛林寂静得诡异，哪怕你走进月光照亮的一片空地，也始终摆脱不了被窥视的感觉。\n\n接下来的几天里，你与这位动物学家偶尔碰面。到了你的船预定离开马诺夸里的那天，伊拉万博士却可疑地没有出现在宾馆里。工作人员告诉你，她前一晚没有回来。你担心她的安危，回到之前与她碰面的空洞。你一路上山，四周的丛林依旧寂静得令人不安。\n\n黑黢黢的空洞上方悬着一块岩石，上面散落着几本撕碎的速写本和一架摔坏的望远镜，却没有伊拉万博士的踪迹。你扫视昏暗的树丛，发现瀑布底下有一道微光，还有动物学家的印花背心。你小心翼翼地沿着泥泞的陡坡下到狭窄溪流的岸边，发现动物学家趴在那里，手臂弯成一个奇怪的角度。你靠近时，三只黄眼斑袋貂四散而逃。你轻轻将她翻过身，发现她还有呼吸，不禁松了口气。她的左手紧紧攥着一件奇怪的黑色器具，护在胸前。\n\n上方传来一声尖利的哀鸣。你将伊拉万博士抱起来，发现她出奇地轻。你抱着这位动物学家沿溪流向下游走去，远离那个空洞，头顶的铁树丛中，几十双黄眼睛死死盯着你。闪烁不定的身影在头顶来回飞掠，仿佛无声的警告。\n\n一回到镇上，你就把昏迷的动物学家送进了诊所。你预订的船已经离开，但鉴于发现她时的诡异情形，你决定留下来陪伊拉万博士，直到她醒来。几天过去，寂静令人不安，她终于开口说话了。\n\n“我注意到有几只斑袋貂聚集在这东西周围，”她用还能活动的那只手抚过那只中空的钟，“我知道最好别去干涉，但它们似乎对它太过着迷了。就像喜鹊或乌鸦会囤积某些物件一样，太奇怪了。我注意到它们把它藏在一根树枝的弯处，于是爬上去想仔细看看——然后，我就摔了下来，”她说。\n\n你将那只奇怪的钟捧在手里，感受着它的重量与外形。上面镶嵌的纹样，无论你还是这位动物学家都从未见过。金属摸上去冰凉，却带着一种奇异的电流感。你一时兴起，举起钟摇了一下，尽管它并没有钟舌。一阵清晰可感的声波涟漪穿过周围的空气。你听到树间传来一声熟悉的哀鸣。\n\n“这已经不再是一次简单的勘测了，”伊拉万博士低声说，“无论那些生物变成了什么，它们都不再是七斑袋貂了。有什么东西改变了。”这位动物学家停顿片刻，斟酌着用词，然后对你笑了笑。“无论正在发生什么，我——我都不想独自工作。也许我可以和你一起继续我的研究？”\n\n你告诉伊拉万博士，你正求之不得，并同意在她康复期间陪伴她。这位动物学家将那只奇怪的钟托付给了你。\n\n• 在剧本日志中，记录*伊拉万博士加入特别小组*。任意一位调查员可以选择将戴维·伊拉万博士剧情支援加入其牌库。这张卡牌不计入其牌库卡牌张数。\n• 选择一位调查员作为灾毁之钟的持有者，并相应更新剧本日志。\n• 这两张卡牌可以在*环球漫游*遭遇组中找到。\n• 在剧本日志中记1点_时间_。你可以_启程_。",
        "metamorphosis3": "你在镇上问了个遍，但每次提到伊拉万博士，对方都只是好奇地打量你。你甚至模仿起动物学家那副独特的大眼镜，但没人认得那个名字，也没人见过那副模样。几天之后，你终于放弃了自己徒劳的搜寻。你在当地宾馆办理退房时，发现柳条桌上放着一本空白速写本。你捡起它，皮肤一阵刺痛，感觉有人正盯着你。但你转过身去，却完全孤身一人。\n\n• 在剧本日志中，记录*伊拉万博士凭空消失*。\n• 每位调查员取得2点经验值，因为他们对全球奇异的失踪事件有了洞见。\n• 在剧本日志中记1点_时间_。你可以_启程_。"
      },
      "rusesAndReclamation": {
        "xp": {
          "bonus": "错误迹象旁的记录"
        },
        "title": "拨乱反正",
        "rusesAndReclamation1": "<p>你找遍了此地同志会的圣堂和藏身处，掘地三尺也要找到偷走你宝物的窃贼，最终却还是一无所获。要么是他们根本不在这儿，要么就是藏得太好，再彻查下去也不过是浪费时间。你从这里撤出，计划前往下一站。</p><ul><li>在剧本日志中，记录*错误迹象*，并在旁边作1次记录。(如果剧本日志中已经记录了*错误迹象*，则加1次记录。)</li><li>你可以_启程_。</li></ul>",
        "rusesAndReclamation2": "<p>你对猎物步步进逼，终于来到了对方的藏身处。你在冲进去之前先行潜伏，等候时机。你出其不意，准备朝敌人下手……</p><p class='basic'>在剧本日志中记1_时间_。仅阅读下列与你处境对应的部分。然后，你可以_启程_。</p>",
        "theRedGlovedMan": "<div class='red bordered'><p>_如果戴红手套的男子窃走了钥匙：_如果是戴红手套的男子这般神秘莫测、危险难料的敌人，那最好还是不要正面交锋。你等到他离开圣堂，才撬门溜锁……只是你惊讶地发现，他压根儿没有锁门。你几乎可以想象他从阴影中投来空洞的眼神，嘲讽你的一举一动。他是不是知道你在这儿？他为什么要从你这里偷走东西，又双手奉上？你最后决定还是不要想的太多——毕竟你不能浪费这样的机会。你抓起遭窃的遗物，溜之大吉，一边也想知道这个神秘男人的真正动机。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theClaretKnight": "<div class='red bordered'><p>_如果暗红骑士窃走了钥匙：_你了解亚历山大的骑士，怀疑他并不会弄脏自己的手——他肯定是派了打手来做脏活。那他在藏匿之地大概也安排了守卫。偷偷溜进去是不可能的，所以你决定直捣黄龙：突袭放倒守卫，拿走你的东西，趁他们反应过来之前就溜走。活儿干得利落漂亮，一共只花了几秒钟。骑士的手下紧追不舍，你带着战利品极速逃出了城。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theBeastInACowlOfCrimson": "<div class='red bordered'><p>_如果深红斗篷的恶兽窃走了钥匙：_恶兽肯定是最为凶暴，你最不想碰到的敌人。它洗劫宾馆房间的时候，你幸好不在，不然你一定早已殒命。但你在亚历山大执行任务的时候，知道这怪物也有弱点——它不时就要休眠。你潜入圣堂，静如老鼠，无人发现。脚下深处的房间里传来了恶兽隆隆的鼾声。你蹑手蹑脚地穿过建筑，心脏狂奔，知道走错任何一步都是自取灭亡。你抓住遭窃神器的那一刻，恶兽动了。你赶忙逃往出口。即便逃出数英里之远，你觉得自己还是能听到它愤怒与憎恨的吼声。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "laChicaRoja": "<div class='red bordered'><p>_如果红衣女郎窃走了钥匙：_你和红衣女郎在这种猫鼠游戏中已经玩了好几周。你追了她这么久，在世无人再比你更懂得她的作风。这场小小的私人竞赛甚至变得有趣了起来。你溜进她的圣堂，发现遗物所藏之处和你上一次遭遇时恸哭女士残骸安放的地方别无二致。你笑了笑，将其换成自己一张小小的名片，就此溜之大吉，无人注意。当晚你正打算离开此城，一个路人迅速地交给你一个红色的信封，上面写着：“干得漂亮。下次再玩。”</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theSanguineWatcher": "<div class='red bordered'><p>_如果血色监视者窃走了钥匙：_监视者的圣堂上盘旋着黑翼红顶圈的无脸仆从。你在夜色的掩盖下小心翼翼地接近，希望自己别被发现。此人的圣堂更像是一个工坊，堆满了费解的设备和奇异的奥术工具。他从你那儿偷来的东西也在里面，放在工具台正中，仿佛他正在研究。你抓起就跑，这时另一边的门里传来了他惊恐的声音：“谁在那儿？”你扭头看去，只瞧见他两只空洞的眼窝望向你这边。“那是谁？”他仓促地寻找自己的红宝石眼镜，但等到他戴起来的时候你早就溜了。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "amaranth": "<div class='red bordered'><p>_如果苋窃走了钥匙：_你潜入苋的圣堂，发现她偷来的东西就堆在巨大门厅的角落。虚弱的叫声打破了沉默，你看到暗处有一头遍体鳞伤的狮子正瞪着你。你先是震惊，随即看到这可怜的野兽挣扎着想站起来——它腐败之甚，已经动不了了——不由得感到一阵恶心。“你已经得到了想要的东西。现在走吧。”阴影中冒出了一个声音。你眯眼看去，发现苋伏在狮子身上，满脸泪水。“哈立德，求你。”她低语道。狮子虚弱地叫了一声，重重摔到一侧，露出了自己已经腐烂的肚子。“我说了快走！”苋叫道。你离开了，恶心的感觉转为悲悯。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "alikiZoniUperetria": "<div class='red bordered'><p>_如果艾里奇·佐尼·奥佩勒曲亚窃走了钥匙：_你惊讶地发现圣堂里面空空如也。不仅如此，更像是在你抵达之前就已经全部废弃，兴许已经许多年了。你走过暗沉的廊道、蛛网遍布的积尘厅室，最终来到一间老旧废弃的卧室。墙上有一面全身镜，满是灰尘和污垢。你发现玻璃上有奇怪的反光，擦去污渍，发现艾里奇的鬼影就在身后，黑发覆眼，朝你的脖子伸出手来。你回过头，却发现她已经不见了，只是脖子上还有攫紧的感觉。你在附近的梳妆台里发现了遭窃的钥匙，拿起就跑，冲出圣堂，一路上脚步声回响。你一路不停，径直逃出了城。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "thorne": "<div class='red bordered'><p>_如果索恩窃走了钥匙：_要说你对索恩有多了解，那就是她不会错过交易的机会。所以你没有溜进圣堂，而是大大方方地敲了门。几个冷艳迷人的侍者出来迎接。索恩坐在长桌一头，十指相抵。“太妙了！我没想到你会来。”索恩笑得很开心，招呼你坐下。尝过珍馐和美酒之后，你终于将话题转向归还赃物。“噢，是啊，‘钥匙’。总是‘钥匙’，嗯？”索恩又倒了杯酒，“情况不同啦。我想交易也行。但你可得出够价。”你花了将近一个小时，才提出让索恩满意的价码。无论如何，你还是带着失窃的钥匙离开了圣堂——只是付出了一点儿代价。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "desiderioDelgadoAlvarez": "<div class='red bordered'><p>_如果德西德柔·戴佳多·欧瓦瑞兹窃走了钥匙：_你溜进德西的藏身之处，却惊讶地发现这里并非什么藏宝库，也不是同志会的窝点，而是一家酒吧。这里酒品琳琅满目，客人狂歌痛饮。你正要进去，却给一个穿条纹西装的保镖拦住了。你刚想开口——或者打回去，就听到了德西的声音：“嗨，没事，让他进来吧。”保镖退到一边，你和对手坐在桌子两侧。“猜猜我是怎么想的。告诉你吧：我心情不错。喝一两杯，我就跟你赌这个。”他说着居然开始洗牌。他看到你的表情，笑了：“哦，放松点儿。我跟其他人不一样。一把定输赢，然后咱们就此别过。”权衡局势，你决定跟他玩玩——真的玩玩。你运势正旺，三条J大过了德西的对子。你不费吹灰之力，赢得钥匙，扬长而去，不禁想到德西和他的手下得有多么气急败坏。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "tzuSanNiang": "<div class='red bordered'><p>_如果朱三娘窃走了钥匙：_你知道朱三娘钥匙在手得有多危险。正面强攻想都不要想。潜行才是良策。你趁着夜色溜进庞大的工业建筑，找到了锁着赃物的门。就在你撬锁的时候，狭窄的走道里响起一阵轻快的声音。空荡荡的工厂里回荡起幽怨的沪语歌声。你赶忙夺过失窃的神器，旋踵走向出口，一步一回头。歌声在你逃出之后还回荡在记忆中许久。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "continue": "<p class='basic right'>更新剧本日志的钥匙部分，使遭窃的钥匙返回原本的拥有者手中。</p><p class='basic right'>每位调查员取得1点经验值，且*错误迹象*旁每有一次记录，额外取得1点经验值。</p><p class='basic right'>划掉剧本日志上其他每个地点的“14-C”。</p>"
      },
      "theGreatWork": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "宏伟大业",
        "theGreatWork1": "<p>你到了百慕大，明亮的沙滩和碧蓝的海水叫人目眩神迷。一排排建筑颜色靓丽，更让此地的美景惊艳万分。你在岛上穿行，问问当地人有没有同志会活动的可能迹象。</p><p class='basic'>检查剧本日志。</p>",
        "activity": "特瓦耶·马萨伊在百慕大",
        "noActivity": "并非上述情况",
        "theGreatWork2": "<p>你一提到特瓦耶·马萨伊的名字，当地居民就带你去岛南端的吉布斯山灯塔。这条路带你通往一座华美的小屋，外面还有一座精心打理的花园俯瞰大洋。你提高警惕，走到纱门前敲了敲。一个穿着宽松长裤和栗色亚麻衬衫的熟悉身影打开了门。</p><p class='basic'>检查剧本日志。</p>",
        "proceed": "记录了以下至少两项*(艾婕不信任特别小组；你和红衣女郎之间恩怨未了；你和德西之间恩怨未了；你和暗红骑士之间恩怨未了；你和索恩之间恩怨未了；或你和艾里奇之间恩怨未了)*",
        "otherwise": "并非上述情况",
        "theGreatWork3": "<p>“如果你是来杀我的，那就请你痛快点。”马萨伊冷冷地说道。他站在纱门里面瞪着你，黑皮上滴下汗来。你尽全力解释，但你从马萨伊的肢体语言和语调能看出，他视你为大敌。好一番夹枪带棒的交涉，他才走出门廊。</p><p>“随你怎么说，但显然你只对一样东西感兴趣：力量。要是泰勒专员能用一半心思，她怕你的程度就不该亚于她怕我们。你们都不懂。你们都不懂我们必须完成的大业。这是我们作为同胞，为了自由活着必须做的事。控制钥匙太久，就会被钥匙控制。”</p><p>马萨伊嘲弄地摘下了自己的红色大框眼镜。“你和我们之中最坏的人，也没什么两样。”他跟着你的眼神，拿起眼镜：“这些都不重要了。我知道持有这些力量有多危险的时候，已经太迟了。现在就让我一个人静静吧。”</p><ul><li>每位调查员取得3点经验值，因为其洞见了红色同志会的内部运作。</li><li>你可以_启程_。</li></ul>",
        "theGreatWork4": "<p>“你要么就是非常执着，要么就是非常愚蠢。”马萨伊笑了。他走出门廊，上下打量着你，好似在评估你有几斤几两。他点点头，示意你跟上，走到白沙滩上。你跟着他，一路上浪花热烈地拍打着海岸。</p><p>“我为先前的失礼道歉。我那时无法确定你的意图。最近又发生了许多……事故。”马萨伊严肃地说。你面前的沙子里埋着一大块光滑的浮木，上面爬过一群亮红壳蓝的螃蟹。你问他究竟是什么事。</p><p>“许多不速之客。当然，基金会的。就在你来维多利亚湖的前几天，我的组织另一位成员也来了营地，对我们最近发现的钥匙很感兴趣。就是那个戴红手套的。”教授停了停看着翻滚的海浪。“我想这也能解释。我勘测维多利亚湖的结果非常吓人。湖床上满是史前城市的遗迹。我们测出的二氧化碳含量非常离谱，湖边的当地动植物也发生了奇怪的变化。我们最终找到了一台异星设计的机械。它的设计目的和机理都是个谜，但它在运作，至今仍在。”</p><p>马萨伊用手帕擦了擦红眼镜：“这么说吧，就在你来的几天前，我看到那个男人坐在机器前面，摘了帽子盯着它，他在哼哼——好吧，这么说不对——他在和机器_交流_。”</p><p>头顶上一束云分开了阳光，照得沙滩上影子斑驳，马萨伊打破了沉默：“说实话，我倒无所谓为什么。这人的举止向来是谜。但除了他的举止，还有什么地方不对，整件事都有问题。”云朵飘去，温暖的阳光照满了沙滩，马萨伊深深吸了口气。“这样你就能想象得出，勘测的时候又来几个陌生的基金会特工，打断我的大业，我当然会怀疑。”</p><p>你问马萨伊这个“大业”究竟是什么。他领你往小屋的方向回去。</p><p>“这大业是为了所有人。在这个危险又宏伟的世界，人们要是不活下去，不互帮互助，会变成什么样子？这比你想的更难。”他呼吸很深，“要是我离开这世界的时候，它能比我来的时候好一点儿，那我就算没白活。就这样。也就是说，为了这些钥匙的巧取豪夺，都是大错特错。控制钥匙太久，就会被钥匙控制。”</p><p>“我发现咱们意图相仿，”马萨伊说道，“我不会将咱们的对话告诉我的同事，也不会说我对低于装置都做了什么。钥匙是你的了，除非你不想要。别让它落入红手套男子的魔爪，不惜任何代价。”</p><ul><li>在剧本日志中，记录下*特瓦耶·马萨伊站在你这一边*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>选择一位调查员拥有灾祸引擎，相应更新在剧本日志中。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "theGreatWork5": "<p>你的问询一无所获，这倒让你松了口气。百慕大没有同志会活动的迹象，你终于有了一次难得机会可以放松休息。在这片宁静祥和的岛屿上，你现在更关心的只有你自己。</p><p>你出发离开前几日，酒店的门房建议你去岛北端的水晶洞看看。你欣然前往。你的导游缺了一只胳膊，一边告诉你洞窟是怎么发现的故事，一边在黑暗中打着手电，照出的影子好像舞蹈。你问向导胳膊是怎么没的。“我打过大战。和平有时候代价不菲。”</p><ul><li>每位调查员下一场冒险开始时可以有额外1张起始手牌。</li><li>你可以在本剧本期间返回百慕大，但要先进行另一场冒险。</li><li>你可以_启程_。</li></ul>"
      },
      "epilogue": {
        "title": "尾声",
        "epilogue1": "<p class='basic'>_调查员剧本胜利方可阅读下列内容。_</p><p>“给我交代。”泰勒专员下令道。</p><p>你在不舒服的金属椅上扭了扭身子，她审讯灯的强光几乎要将你照瞎。审讯室的墙光秃秃的，整个就是一面巨大的黑镜，照出你和专员坐在桌子两头，强烈的灯光把你的脸都照白了。你知道基金会的作风，镜子后面肯定有几个特工正在监视，记录你的一举一动。你和泰勒中间的桌子上合着一本厚厚的密档。</p><p class='basic'>检查剧本日志。</p><ul><li>*特别小组加入了红色同志会*。</li><li>并非上述情况。</li></ul>",
        "epilogue2": "<p>你没有直接回答，而是问泰勒这么随便就组建了基金会的特别小组到底是为了什么。你将自己的工作娓娓道来，坦白自己帮助红色同志会一起对抗人类最大的威胁。看上去确实让泰勒措手不及。你说完了，漫不经心地倒在座位上。专员眯起了眼睛。</p><p>“我……明白了。”她显然在克制自己不要露出苦脸。你看到她的视线盯着你的红色标记。“你之所以受雇，是出于你的好奇心、创造力，和独立性。这样的声明——我是否该提醒你——并不等同于任何形式的认可或是赞许。你确实有可能落入红色同志会手中，但我跟上峰保证，这就算并非不可能，几率也极低。”</p><p>沉默沉闷。专员朝左边的黑镜点点头，再看向你。动作之微，几不可察。</p><p>“那么，接下来的就不是陈述，而是协商。你在基金会的职位立即结束。你先前享有的任何支援和特权全部撤回，等级和补贴也即刻告终。”她盯着你的时候，你竟察觉出她的声音里有一丝后悔。“不过，我们也可以将其视为是全新的机会。我们已经和同志会对立太久，也许现在是时候合作了。”</p><p>尽管专员的声音十分严肃、专业，你还是觉得里面有别的情感。是一种尊重？她热切地望着你。</p><p>“基金会和同志会将成为伙伴。你怎么说？一起促成这样的未来吧？”</p><p class='basic right'>在剧本日志中，记录下*红色同志会和基金会同意合作*。</p><p class='basic right'>档案完结。</p>",
        "epilogue3": "<p>你劳心劳力地跟专员汇报，却发现自己在拙劣地重复着事件和人名。尽管如此，泰勒还是一言不发，谨慎地听你东拉西扯、列举事件。你终于说完了，她隔着桌子递给你一杯水。你余光看到自己的倒影在黑镜中闪闪发亮。</p><p>“真是……无拘无束的记录。”她实事求是地说道。沉默沉闷。专员朝左边的黑镜点点头，再看回你。动作之微，几不可察。</p><p>“基金会感谢你的效劳。鉴于你在基金会任职期间所为的级别，你不得将任何内容透露给任何人——无论生死，违者将处以极刑。”她盯着你，“明白了吗？”</p><p>你点点头，专员继续道：“毋须多言，但我还是要告知你，你的临时‘特别小组’将始终保密，你在基金会供职期间获取的所有资产都将封存，留待进一步研究。你对所有事件的记录，包括反常干扰的那些，都将提炼、分析、保存，留待后观。”</p><ul><li>在剧本日志中，记录下*基金会信任*和*特别小组欺瞒*。<ul><li>剧本日志中每记录下列一项*(特别小组帮助西里特工、特别小组将真相告诉了泰勒、奎因特工护你左右，以及划掉的特别小组正在传递情报)*，在*基金会信任*旁作1次记录。<ul><li>_基金会信任_: {trust}</li></ul></li><li>剧本日志中每记录下列一项*(特别小组对泰勒隐瞒真相、特别小组另有使命、特别小组援助了骑士、艾婕信任特别小组、特别小组与索思达成交易、艾里奇站在你这一边、德西欠你一笔、特瓦耶·马萨伊站在你这一边)*，在*特别小组欺瞒*旁作1次记录。<ul><li>_特别小组欺瞒_: {deception}</li></ul>",
        "epilogue4": "<p>_*基金会信任*旁的记录次数大于等于*特别小组欺瞒*：_泰勒专员从桌子后面拿出一个黑色皮革公文包打开，里面掉出一个基金会的徽章，滑到了你面前。“当然了，这都是官腔。你的特别小组已经解散。基金会将完全接纳你。至于你愿不愿意，那不重要，你已经见得太多，完成了太多，回不到正常生活了。”</p><p>你将徽章翻过来，它闪着刺眼的光，居然还有些沉。你摸过徽章的凹槽和金属边缘，发生过的一切突然重压在你心上。泰勒翻开桌上的密档，继续道：</p><p>“你的履约从昨天开始。别担心，你这项工作剩下的工资会有的，还有一份数额可观的综合补偿。这个案子嘛——我们打算称为‘猩红钥匙’。这听起来是挺响亮，不过照我看是有点太夸张了。”</p><p>专员嘴边尽力露出了一点点笑容，“好了，你就没什么想说的吗？哑巴了？”</p><p class='basic right'>在剧本日志中，记录下*特别小组得到了终身职位*。</p><p class='basic right'>档案完结。</p>",
        "epilogue5": "<p>_*基金会信任*旁的记录次数小于*特别小组欺瞒*：_: 泰勒专员打开面前的密档，隔着桌子递给你一沓票据。</p><p>“这些单程票可以带你去世界上任何地方，不受任何盘问。鉴于你的好奇心总是惹麻烦，我建议你选一个被人遗忘的安静地方，用化名，找个重活干干，别让你有多少空闲时间瞎想。噢，衣服也得换了。”她不客气地指着你的装束。</p><p>你打算想要辩解。专员抬起一只手让你闭嘴。</p><p>“老实说，我必须告诉你，你在这儿脱罪要简单得多。要是闹到上峰那里，像你在案子里这么胡闹，只怕马上就会被干掉。他们已经在讨论你的‘勾结’了。要是你依章办事，还可能靠这个案子就此安身立命。但就我的估计，你制造的麻烦比你解决的更多。”</p><p>泰勒站了起来，你也一起。你身后的门里走进来几个穿西装的大块头，屋内顿时洒满了光。专员和你严肃的握了握手，盯着你：“基金会感谢你的效劳。愿我们不要再见了。”</p><p class='basic right'>在剧本日志中，记录下*特别小组就此解散*。</p><p class='basic right'>档案完结。</p>"
      }
    },
    "summary": {
      "total": 458,
      "missing": 0,
      "untranslated": 0,
      "present": 458,
      "specialRules": 12
    },
    "chineseGaps": []
  },
  "chapters": {
    "riddlesAndRain": {
      "id": "riddlesAndRain",
      "name": "谜雨",
      "nameEn": "Riddles and Rain",
      "referenceCode": "09501",
      "file": "scenarios/riddlesAndRain.json",
      "sectionsEn": {
        "heading": "Prologue",
        "tokens": {
          "easyStandard": {
            "skull": "-1 (-3 instead if you have 2 or more clues).",
            "tablet": "-1. If there is a concealed mini-card at your location, reveal another chaos token.",
            "elderThing": "-3. If you fail, you must either spend 1 clue or place 1 doom on an enemy in the shadows."
          },
          "hardExpert": {
            "skull": "-2 (-4 instead if you have 2 or more clues).",
            "tablet": "-2. If there is a concealed mini-card at your location, reveal another chaos token.",
            "elderThing": "-4. If you fail, you must either spend 1 clue or place 1 doom on an enemy in the shadows."
          }
        },
        "label": {
          "theConnection": {
            "coterieAgent": "Search the encounter deck and discard pile for a Coterie Agent enemy and draw it. Shuffle the encounter deck.",
            "damageAndHorror": "Each investigator takes 1 damage and 1 horror."
          },
          "towerOfLondon": {
            "attack": "Each enemy in the shadows attacks you."
          }
        },
        "tooltips": {
          "rainyLondonStreets": {
            "resign": "\"We should wait for Inspector Flint...\""
          }
        },
        "intro": {
          "label": {
            "onlyOne": "Proceed to _Intro 2_",
            "goAlone": "Go alone, as requested",
            "goWithBackup": "Go with backup",
            "takeHisOffer": "Take his offer",
            "goToLondonOnYourOwnTerms": "Go to London on your own terms"
          },
          "title": "File #5–A (Prologue): Riddles and Rain",
          "intro1": "<p class='file'>_Intro 1_: The dark stifles. It moves like a living creature, constricts the air as if you were inside a shapeless cocoon. A figment of your anxious and overactive imagination, you hope. But everything about this meeting puts your nerves on edge. You almost didn’t accept the mysterious invitation, but recent events have forced your hand. It’s been several months since the disappearances began, and all of your leads in Arkham have dried up.</p><p>It started in the winter of 1924 with several vehicles in Southside: two Studebakers, a Cadillac, and a Rolls Royce, all of them top-of-the-line. One moment they were there, the next…nothing, save for a single deflated wheel. The police believed it to be the work of bootleggers looking for more vehicles to add to their routes, but the cars were too nice, would draw too much attention. Perhaps they were taken down to Boston or New York and flipped for a pretty penny, and that’s just what you figured happened…until the disappearances continued.</p><p>Next to go was a streetlamp outside the Ward Theatre in Downtown. Then, two pets—a dog and a cat, whisked away almost simultaneously right out from under their owners’ noses, not two doors down from one another. You learned the news when you saw the missing posters plastered all over College Street. On a whim, you interviewed the owners. No sign of foul play, and it was unlikely for them to have run away. Something stank about all of it.</p><p>Then people started to disappear. A child from Easttown. A student in Miskatonic University. The chief of Arkham’s fire department. And as the police closed each case with no clues or suspects, a curious thing began to happen. One by one, as time marched on, the things that went missing vanished not only from Arkham, but from memory. The owners of those vehicles suddenly claimed to have never owned them. The pets, the people, all of them were wiped from the memories of every single person in town.</p><p>Everyone but you. You, and you alone, remembered.</p><p>Perhaps it was simply the way of things. Humans are fickle and forgetful by nature. But it couldn’t be so simple. It was just too…strange. Coincidental.</p><p>That’s when the letter arrived.</p>",
          "letter": "<p class='file typewriter'>Greetings,</p><p class='typewriter'>I hope this letter finds you well. You do not know me, but I know you. I cannot tell you much through paper correspondence, as it may be intercepted. Suffice it to say that I know of the matters you are looking into, and I also know that you believe yourself to be alone in your investigation. The truth is that you are not alone. Such events are not unique to your city of Arkham. What you have observed is happening in major cities all over the world. I am one of those, like you, who seeks the truth. Who remembers.</p><p class='typewriter'>There is another related matter which I must bring to your attention. I need your help, and you need mine. Enclosed is a ticket to a show at the Riverview Theater. If you wish to know more, please meet me there and we can speak further. Come alone.</p><p class='typewriter'>In truth,</p><p class='accountant'>Li Flint</p>",
          "intro1Part2": "<p class='file'>The ticket in the envelope was indeed for a private showing at Arkham’s new movie palace in Downtown. With no other leads and no good reason to avoid going, you have decided to accept the mysterious invitation…</p><ul><li>If there is only one investigator in the game, proceed to _Intro 2_.</li><li>If there is more than one investigator in the game, the lead investigator must decide (choose one):<ul><li>*Go alone, as requested*. Skip to _Intro 3_.</li><li>*Go with backup*. Skip to _Intro 4_.</li></ul></li></ul>",
          "intro2": "<p class='file'>_Intro 2_: Just as you are beginning to suspect that you have been played, you see a shadow approaching from the aisle. The figure spots you at once, sliding into the seat in front of you. He wears wide, horn-rimmed glasses and a high-collared jacket over a silk vest. His brown hair is cut short and parted to one side, and he sports a handsome, neatly trimmed beard. To your relief, no other figures emerge from the shadows.</p><p>You ask if you are speaking to Li Flint, earning a slight nod from the man in front of you. He does not turn to speak, instead letting his voice carry softly over the silent images on screen. “Indeed,” he says. “Inspector Li Flint, with the International Criminal Police Commission. And I’m sure you have a great many questions, but we are unfortunately short on time. Doubly so if you are working alone. Prudent, however; you should trust no one, given the circumstances. No, not even me.”</p><p class='basic right'>Skip to _Intro 5_.</p>",
          "intro3": "<p class='file'>_Intro 3_: Just as you are beginning to suspect that you have been played, you see a shadow approaching from the aisle. The figure spots you at once, sliding into the seat in front of you. He wears wide, horn-rimmed glasses and a high-collared jacket over a silk vest. His brown hair is cut short and parted to one side, and he sports a handsome, neatly trimmed beard. To your relief, no other figures emerge from the shadows.</p><p>“You came alone. Good,” the man in front of you speaks quietly without turning, letting his voice carry softly over the silent images on screen. “Trust is in such meager measure these days. It is good to know that we can share some.” You ask if you are speaking to Li Flint, earning a slight nod from the man. “Indeed,” he says. “Inspector Li Flint, with the International Criminal Police Commission. And I’m sure you have a great many questions, but we are unfortunately short on time.”</p><p class='basic right'>Skip to _Intro 5_.</p>",
          "intro4": "<p class='file'>_Intro 4_: Just as you are beginning to suspect that you have been played, you see a shadow approaching from the aisle. The figure spots you at once, sliding into the seat in front of your party. He wears wide, horn-rimmed glasses and a high-collared jacket over a silk vest. His brown hair is cut short and parted to one side, and he sports a handsome, neatly trimmed beard. To your relief, no other figures emerge from the shadows.</p><p>“I thought I told you to come alone,” the man in front of you speaks without turning, letting his voice carry over the silent images on screen. The hard edge in his voice suggests he is not happy with your choice, but after a moment, he relents. “I get it. You are prudent not to trust me. You should trust no one, under the circumstances, myself included.” You ask if you are speaking to Li Flint, earning a slight nod from the man. “Indeed,” he says. “Inspector Li Flint, with the International Criminal Police Commission. And I’m sure you have a great many questions, but we are unfortunately short on time.”</p><p class='basic right'>Proceed to _Intro 5_.</p>",
          "intro5": "<p class='file'>_Intro 5_: Flint produces a file fat with documentation and slides it between the two seat cushions in front of you. Inside is a wealth of information regarding cases similar to the ones you have been investigating. Photos of vehicles, factory machines, and public figures, all missing. All forgotten. And just as Flint’s letter promised, the file includes reports from all over the world. London. Shanghai. Bruges. Rio de Janeiro. Cairo. The list goes on and on. “There’s more,” he says after giving you time to read. “Flip to the end.”</p><p>You do, and what greets you there are two photographs clipped together. The first is of a street in London, distorted by some sort of interference. A light shines above the street corner, and around it, the picture appears to be pinched, like a miniature vortex is pulling reality toward it. The other is a photograph of a man on the other side of that same street corner, ducking into the shadows. He wears a tailored grey suit and a wide-brimmed hat that obscures his face. The only discernible detail you can make out from the photo is the man’s distinctive red gloves. Rare as it is for a photograph to have color, you wonder if the long exposure time is what led to the strange blurring effect. “This was taken by my partner several days ago. Just before he, too, vanished. Whatever is going on, you can be sure that man with the red gloves is somehow involved.”</p><p>Getting to the point, you ask Inspector Flint what exactly he wants from you. “To work together. Share what we know. Sparingly few seem to know the truth.” You agree. If what the man says is true, and events like this are happening all over the world, getting to the bottom of it will require more than just you. “To that end, I would ask that you come to London with me. That man with the red gloves has been sighted in the area, and he’s not alone. I would bet good money that he knows something about where my partner is. Arrangements have already been made. There are steamship tickets in that file. The ship departs from Boston in two days.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*Take his offer*. Proceed to _Intro 6_.</li><li>*Go to London on your own terms*. Skip to _Intro 7_.</li></ul>",
          "intro6": "<p class='file'>_Intro 6_: You accept the file and tell Inspector Flint that you will report to him with anything you find. With haste, you get your affairs in order and take the very next train to Boston. Flint has already given you more evidence to advance your case than a month of investigation in Arkham. If working together with the ICPC will help solve this mystery, you have no qualms about putting your trust in him. You make it to London with time to spare and immediately set to work.</p><ul><li>Trust is born of naïveté. Remove 1 {'{'}elderThing{'}'} token from the chaos bag and add 1 {'{'}tablet{'}'} token. (This token can be later removed through an act of secrecy. However, you may become stronger if you stick to your convictions.)</li><li>Read the rules for “Tracking Time” on the next column. Mark 1 _time_ in your Campaign Log now. Then, proceed to _Setup_.</li></ul>",
          "intro7": "<p class='file'>_Intro 7_: You take the file, but do not follow Inspector Flint’s request. After all, you have only just met the man and you are not sure what to believe. If events are as dire as he says, you’ve taken enough of a risk already in speaking with him directly. Instead of departing from Boston, you find passage on an ocean liner headed for Plymouth, then hitch a bus ride to London. The trip takes quite a while longer, but at least you know you haven’t been tailed—by Flint, or by an associate of this red-gloved man.</p><ul><li>Deception breeds uncertainty. Remove 1 {'{'}tablet{'}'} token from the chaos bag and add 1 {'{'}elderThing{'}'} token. (This token can be later removed through an act of trust. However, you may become stronger if you stick to your convictions.)</li><li>Read the rules for “Tracking Time” below. Mark 2 _time_ in your Campaign Log now. Then, proceed to _Setup_.</li></ul>"
        },
        "trackingTime": {
          "title": "File #5–A (Prologue): Riddles and Rain",
          "body": "<h3>Tracking Time</h3><p class='file'>Throughout this campaign, tracking the passage of time is of crucial importance. As time marches on, these paranormal events will grow more and more dangerous, and machinations beyond your understanding will progress. Additionally, some opportunities may only be open to you during certain windows of time. When you are instructed to mark one or more _time_ in your Campaign Log, fill in that many boxes under the “Time Passed” header.</p><p>If you fill in a box that has a symbol (in the form of a Greek letter), proceed to the Status Reports section of the Campaign Guide, find the status report matching that letter, and read the text that follows.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: *Riddles and Rain*, *Crimson Conspiracy*, *Dark Veiling*, *Outsiders*, *Shadow of a Doubt*, *Strange Happenings*, *Chilling Cold*, *Locked Doors*, and *The Midnight Masks*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/riddles-and-rain.png' /><img src='{setImgPath}/crimson-conspiracy.png' /><img src='{setImgPath}/dark-veiling.png' /><img src='{setImgPath}/outsiders.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /><img src='{setImgPath}/strange-happenings.png' /><img src='{setImgPath}/chilling-cold.png' /><img src='{setImgPath}/locked-doors.png' /><img src='{setImgPath}/midnight-masks.png' /></section> When gathering *The Midnight Masks* encounter set, only gather the five treachery cards (2x False Lead and 3x Hunting Shadow). Do not gather the locations, acts, agendas, and scenario reference cards from that set.",
          "setSetsOutOfPlay": "Set the *Crimson Conspiracy* and *Outsiders* encounter sets aside, out of play.",
          "placeLocations": "Put the Rainy London Streets location into play.",
          "beginPlay": "Each investigator begins play at Rainy London Streets.",
          "remainingLocations": "Set each other location aside, out of play.",
          "setOutOfPlay": "Set The Red-Gloved Man enemy and The Eye of Ravens key aside, out of play.",
          "miniCards": "Gather each decoy mini-card and each of the following mini‑cards: The Red‑Gloved Man and Coterie Agents (A, B and C). Set them aside, out of play."
        },
        "resolutions": {
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated)_: As the night goes on, the feeling that you are being watched—hunted—only grows. Recalling the photos Inspector Flint showed you of vanished and forgotten people all over the world, you decide that perhaps caution would be best. You head back to your meeting place in Trafalgar Square, keeping your head down the entire time. You might not have much to report to Inspector Flint, but it’s better than the alternative.</p><ul><li>Skip to _Resolution 4_.</li><ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: You search for the man with the red gloves through every possible hiding place and down every shadowed corridor, but he is well and truly gone. It is as if he vanished into thin air. You wonder for a moment if he was somehow erased from existence like the other disappearances, but you don’t believe so. There is no mark. No ectoplasmic remains. He simply was there, and then he was not.</p><p>You give up searching for him and instead examine the object that clattered to the ground during your scuffle. It is a small ruby marble, no larger than an eye. Indeed, you investigate the crypt that the man was rummaging through, and find that the marble’s size matches the eyesockets of the long-deceased corpse inside. They must have been buried with it, meaning perhaps this marble is what the man with the red gloves saught all along…but why?</p><p>Investigating further, you find neither name nor epitaph identifying the corpse buried here, only the following lines of what appears to be poetry chiseled into the lid of the body’s coffin:</p><p class='center'>With red we are bound.<br />Through red we are one.<br />Thus in red do we bury our kin and our ken.<br />May you rest, until you are needed once more.</p><p>Before you have time to even consider what this might mean, you hear the telltale rumbling of the secret passageway shifting upstairs once more, and the pounding of heavy footsteps down the stairwell. You arm yourself and prepare for a fight. To your surprise, it is Inspector Flint who greets you, held at gunpoint by a woman dressed in a black suit, wide-brimmed hat, and matching black trousers. She has ebony-dark skin, cold eyes underscored by heavy bags, and short, curly hair. Two other suits flank her, both of whom say nothing and stand like statues as she enters the crypt. She flashes an unidentifiable silver badge and motions for you to stay put. “Where did the man with the red gloves go?” she asks. “And who are you?”</p><p>“Can I put my hands down now?” Inspector Flint says.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Choose an investigator to be the bearer of The Eye of Ravens and update the Campaign Log accordingly. From now on, whenever a character becomes the bearer of a Key, keep that Key handy for the rest of the campaign, as it will begin play attached to that character. (*In future scenarios, The Eye of Ravens begins play attached to the investigator it is bound to.*)</li><li>In your Campaign Log, record *you haven’t seen the last of the Red-Gloved Man*.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>Proceed to _Interlude: The Foundation_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: You make a show of advancing slowly and peacefully. No matter where you stand, you cannot seem to reach an angle where the light shines on this man’s face. “I suppose you—wish to know—why I am here,” the man says. Each word is pronounced with a grating, unearthly cadence; stress falling on the wrong syllables; long pauses punctuating each phrase. You nod. He motions to a crypt at the far end of the room. “Curiosity,” he threatens, “the first shift—the first curse—in a string of curses.”</p><p>You approach the coffin within the crypt with trepidation. Is this a trap? There is no name or epitaph identifying the corpse buried here. Only the following lines of what appears to be poetry chiseled into the lid of the coffin:</p><p>With red we are bound.<br />Through red we are one.<br />Thus in red do we bury our kin and our ken.<br />May you rest, until you are needed once more.</p><p>You ask the man with the red gloves what it means. “He is— needed—once more,” the man croaks. You lift the lid of the coffin. Inside is an old and forgotten corpse, likely hundreds of years old. Glinting in the dim candlelight, you spot a false ruby eye staring up at you. “A—gift,” the man behind you says quietly. Looking away with disgust, you reach down and pull the marble out of the corpse’s eyesocket. When you turn to ask the man what the object is, he is gone; vanished into thin air like those missing before him. Only there is no mark, no ectoplasmic remains, no evidence of escape. He simply was there, and then he was not.</p><p>Before you have time to even consider where he could have gone, you hear the telltale rumbling of the secret passageway shifting upstairs once more, and the pounding of heavy footsteps down the stairwell. You arm yourself and prepare for a fight. To your surprise, it is Inspector Flint who greets you, held at gunpoint by a woman dressed in a black suit, wide-brimmed hat, and matching black trousers. She has ebony-dark skin, cold eyes underscored by heavy bags, and short, curly hair. Two other suits flank her, both of whom say nothing and stand like statues as she enters the crypt. She flashes an unidentifiable silver badge and motions for you to stay put. “Where did the man with the red gloves go?” she asks. “And who exactly are you?”</p><p>“Can I put my hands down now?” Inspector Flint says.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Choose an investigator to be the bearer of The Eye of Ravens and update the Campaign Log accordingly. From now on, whenever a character becomes the bearer of a Key, keep that Key handy for the rest of the campaign, as it will begin play attached to that character. (*In future scenarios, The Eye of Ravens begins play attached to the investigator it is bound to.*)</li><li>In your Campaign Log, *record you haven’t seen the last of the Red-Gloved Man*.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>Proceed to _Interlude: The Foundation_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: You search for the man with the red gloves through every possible hiding place and down every shadowed corridor, but he is well and truly gone. It is as if he vanished into thin air. You wonder for a moment if he was somehow erased from existence like the other disappearances, but you don’t believe so. There is no mark. No ectoplasmic remains. He simply was there, and then he was not.</p><p>You give up searching for him and instead examine the crypt that the man was rummaging through. Inside is an old and forgotten corpse, likely hundreds of years old. You don’t have the object here to do a perfect size comparison, but you are quite sure that the ruby marble the red-gloved man stole before disappearing would have fit inside one of the corpse’s eyesockets. Indeed, examining the corpse, you see that one such socket is covered in webs and sickly with rot, while the other remains strangely smooth on the inside. Whatever that marble is, it must have been what the man with the red gloves sought all along…but why?</p><p>Investigating further, you find neither name nor epitaph identifying the corpse buried here, only the following lines of what appears to be poetry chiseled into the lid of the body’s coffin:</p><p>With red we are bound.<br />Through red we are one.<br />Thus in red do we bury our kin and our ken.<br />May you rest, until you are needed once more.</p><p>Before you have time to even consider what this might mean, you hear the telltale rumbling of the secret passageway shifting upstairs once more, and the pounding of heavy footsteps down the stairwell. You arm yourself and prepare for a fight. To your surprise, it is Inspector Flint who greets you, held at gunpoint by a woman dressed in a black suit, wide-brimmed hat, and matching black trousers. She has ebony-dark skin, cold eyes underscored by heavy bags, and short, curly hair. Two other suits flank her, both of whom say nothing and stand like statues as she enters the crypt. She flashes an unidentifiable silver badge and motions for you to stay put. “Where did the man with the red gloves go?” she asks. “And who exactly are you?”</p><p>“Can I put my hands down now?” Inspector Flint says.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>The Red-Gloved Man is the bearer of The Eye of Ravens. Update the Campaign Log accordingly. From now on, whenever a character becomes the bearer of a Key, keep that Key handy for the rest of the campaign, as it will begin play attached to that character. (*In future scenarios, if The Red-Gloved Man enters play, The Eye of Ravens begins play attached to him.*)</li><li>In your Campaign Log, record *you haven’t seen the last of the Red-Gloved Man*.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>Proceed to _Interlude: The Foundation_</li></ul>"
          },
          "resolution4": {
            "title": "Resolution 4",
            "body": "<p>_Resolution 4_: You wait impatiently for Inspector Flint to arrive, your nerves on edge. Something must have happened to him. But you still remember him—that’s good. You tap your foot nervously as you strain to recall his face, the sound of his voice, the events that led you here. Tap tap tap. Perhaps you should be out there looking for him. What if he is in trouble? Tap tap tap. Maybe he is already gone. Perhaps only you remember him. And what of the man with the red gloves? Tap tap tap. You wait. And wait. And wait.</p><p>You barely notice the chair across from you sliding out until Flint takes his seat. To your relief, he is unharmed, although you suspect he has not slept in some time. Lines of worry are creased along his forehead, and his eyes are bloodshot and wide with fear. Yours feel the same.</p><p>Breaking the tense air with a joke, you inform Inspector Flint that he is late. He chuckles and nods. “Apologies. Another detective with the ICPC is…missing,” he explains, exhaustion and anxiety giving his voice a bitter edge. “Please tell me you have something for me.”</p><p>You sigh and give your report. Flint cradles his fingers and rubs them idly as you explain what you have learned. “This proves that the man with the red gloves is not working alone,” he says.</p><p>Just then, a woman’s voice interrupts from across the room. “That is an understatement,” she says, her voice cold and dry. The woman, dressed in a black suit, wide-brimmed hat, and matching black trousers, flashes an unidentifiable silver badge with one hand, and levels the barrel of a handgun at you with the other. She has ebony-dark skin, cold eyes underscored by heavy bags, and short, curly hair. Two other suits flank her, both of whom say nothing and stand like statues as she speaks. Both of them rest their hands on pistols holstered beneath their suit jackets. You realize with sudden terror that you are alone in the once-busy tea room. Everyone else has cleared out. Flint’s hands immediately shoot into the air, and yours quickly follow.</p><p>“Where is the man with the red gloves now?” the woman asks. “And who exactly are you?”</p><p>You and Flint share a worried glance. What exactly have you gotten yourselves into?</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>The Red-Gloved Man is the bearer of The Eye of Ravens. Update the Campaign Log accordingly. From now on, whenever a character becomes the bearer of a Key, keep that Key handy for the rest of the campaign, as it will begin play attached to that character. (*In future scenarios, if The Red-Gloved Man enters play, The Eye of Ravens begins play attached to him.*)</li><li>In your Campaign Log, record *you haven’t seen the last of the Red-Gloved Man*.</li><li>Mark 2 _time_ in your Campaign Log.</li><li>Proceed to _Interlude: The Foundation_</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "序幕",
        "tokens": {
          "easyStandard": {
            "skull": "-1(如果你有至少2个线索，改为-3)。",
            "tablet": "-1。如果你所在地点有隐匿迷你卡牌，再揭示一个混乱标记。",
            "elderThing": "-3。如果你检定失败，你必须花费1个线索，或在阴影中的一个敌人上放置1个毁灭标记。"
          },
          "hardExpert": {
            "skull": "-2(如果你有至少2个线索，改为-4)。",
            "tablet": "-2。如果你所在地点有隐匿迷你卡牌，再揭示一个混乱标记。",
            "elderThing": "-4。如果你检定失败，你必须花费1个线索，或在阴影中的一个敌人上放置1个毁灭标记。"
          }
        },
        "label": {
          "theConnection": {
            "coterieAgent": "查找遭遇牌库和遭遇弃牌堆，找出一张同志会特工敌人并将其抽取。混洗遭遇牌库。",
            "damageAndHorror": "每位调查员受到1点伤害和1点恐惧。"
          },
          "towerOfLondon": {
            "attack": "阴影中的每个敌人攻击你"
          }
        },
        "tooltips": {
          "rainyLondonStreets": {
            "resign": "\"我们应该等等福林探员……\""
          }
        },
        "intro": {
          "label": {
            "onlyOne": "只有一位调查员",
            "goAlone": "照信中要求，独自前往",
            "goWithBackup": "带上伙伴一同去",
            "takeHisOffer": "接受他的提议",
            "goToLondonOnYourOwnTerms": "自行前往伦敦"
          },
          "title": "档案#5–A(序幕): 谜雨",
          "intro1": "<p class='file'>黑暗浓郁，使人窒息，它仿佛一个活物在动，将你包在无形之茧中，挤没了空气。你希望这不过是自己的紧张和过度想象造就的臆念。但此次会面的一切都让你神经紧绷。你几乎就要拒绝这神秘的邀请，但近来发生的事情迫使你接受。失踪案发生已有数月，而你在阿卡姆所有的线索都撞进了死胡同。</p><p>故事还要从1924年的冬天开始。最先是南区的几辆车：两辆斯图贝克、一辆凯迪拉克，还有一辆劳斯莱斯，都是顶级的豪车。这一刻还都在那儿，下一刻……就什么都不剩了，只有一枚瘪轮胎。警方相信这肯定是走私犯干的好事。他们要更多的车辆运货。但这些车子都太好、太引人注意了。那时候，你仅仅以为这些车子会在波士顿或纽约卖一笔好价钱……但后来更多的东西不见了。</p><p>商业区沃德剧院外的路灯也会不见。接着是宠物——两家近邻的猫猫狗狗在主人眼皮子底下一瞬间就消失无踪。你看到学院街外贴满了寻宠启事，知道了这消息。你一时兴起，拜访了失主。没有遇害的迹象，也不像是自己出走。其中定有蹊跷。</p><p>之后消失的，是人。东城区的孩子、米大的学生、阿卡姆消防局局长。警方找不到线索和嫌犯，只能结案。随即发生了诡异的情况。渐渐地，这些消失的事物不仅从阿卡姆销声匿迹，也从人们的记忆中抹去了。车子的失主突然宣称他们其实从未有过这些豪车。镇上每个人都忘了失踪的宠物和人。</p><p>每个人，除了你。你还记得，也只有你还记得。</p><p>也许事情就是这样。人心易变，生来健忘。但不可能就是这样。这也太……奇怪了，太巧合了。</p><p>恰在这时，那封信到了。</p>",
          "letter": "<p class='file typewriter'>足下惠鉴：</p><p class='typewriter'>盼此信寄达。足下不知在下，然在下深知足下。信笺有遭截获之险，故此事不能尽见于纸上，望足下见谅。可见者，在下知足下探查之事，亦知足下自以为孤身一人。然足下确非孤身。凡此种种，亦非独见于足下之阿卡姆城。足下所见之事，亦现于全球各大都会。在下亦如足下，寻真求果，未忘其事。</p><p class='typewriter'>另有一事，足下须知。在下与足下务须互助。随信票据，为河景剧院演出所须。若足下欲知其详，请其所往，与在下细商。务必独来。</p><p class='typewriter'>再拜，</p><p class='accountant'>李福林</p>",
          "intro1Part2": "<p class='file'>信中附了一张私人演出的门票，就在阿卡姆商业区新开张的豪华影剧院。你也没有其他线索，找不到理由拒绝前往，最终决定接受这一神秘的邀请……</p><ul><li>如果游戏中只有一位调查员，</li><li>如果游戏中不止一位调查员，调查员队长必须决定（选择一项）：<ul><li>*照信中要求，独自前往。*</li><li>*带上伙伴一同去。*</li></ul>",
          "intro2": "<p class='file'>你正怀疑自己是不是给人耍了，走廊里就蹿出一个人影。他立刻发现了你，迅速在你前面的位子落座。来者戴着角质大框眼镜，高领夹克下穿了一件丝绸背心。棕色短发梳到一边，帅气的胡子精心修剪过。阴影中再没出现别的身影，这让你松了口气。</p><p>你问面前的来者是否就是李福林，他轻轻地点了点头。他没有转头，声音随着屏幕上静默的影像轻轻传来。“是我。”他说道，“国际刑事警察委员会的李福林探员。我确定你有很多问题想问，但不幸的是，我们没多少时间。要是你孤军奋战，时间就更不够了。不过，现在这样的情况，你倒是应该谨慎行事，谁也不要相信。连我也一样。”</p>",
          "intro3": "<p class='file'>你正怀疑自己是不是给人耍了，走廊里就蹿出一个人影。他立刻发现了你，迅速在你前面的位子落座。来者戴着角质大框眼镜，高领夹克下穿了一件丝绸背心。棕色短发梳到一边，帅气的胡子精心修剪过。阴影中再没出现别的身影，这让你松了口气。</p><p>“你一个人来的。很好。”前面的男人没有转头，声音随着屏幕上静默的影像轻轻传来。“最近人们都信不得了。我们之间还能相互信任几分，真是可贵。”你问他是否就是李福林，他轻轻地点了点头。“是我。”他说道，“国际刑事警察委员会的李福林探员。我确定你有很多问题想问，但不幸的是，我们没多少时间。”</p>",
          "intro4": "<p class='file'>你正怀疑自己是不是给人耍了，走廊里就蹿出一个人影。他立刻发现了你，迅速在你前面的位子落座。来者戴着角质大框眼镜，高领夹克下穿了一件丝绸背心。棕色短发梳到一边，帅气的胡子精心修剪过。阴影中再没出现别的身影，这让你松了口气。</p><p>“我说过让你一个人来。”前面的男人没有转头，声音随着屏幕上静默的影像轻轻传来。他生硬的语调说明对你的选择颇为不快，但片刻之后也就平息下来。“我明白。轻信不是审慎之举。现在这样的情况，你确实应该谁也不要相信，连我也包括在内。”你问他是否就是李福林，他轻轻地点了点头。“是我。”他说道，“国际刑事警察委员会的李福林探员。我确定你有很多问题想问，但不幸的是，我们没多少时间。”</p>",
          "intro5": "<p class='file'>福林将一大摞档案从座垫之间递给了你，里面记载了大量信息，其中案件都与你正在调查的相仿。里面的照片有车辆、工厂机械、公众人物，都消失了，都被遗忘了。恰如福林信中所言，这份档案里的报告来自全球各地：伦敦、上海、布鲁日、里约热内卢、开罗……城市清单一眼望不到头。“还有，”他让你读了一会儿后说，“翻到最后。”</p><p>你听话照做，档案最后是两张钉在一起的照片。第一张是伦敦的街道，不知受了什么干扰而显得扭曲。街角上方闪着光，光周围的图像都拧在一起，仿佛有一个微型漩涡正在吸收周围的现实。另一张照片则是一位男子，闪入了同一街角另一侧的阴影中。他穿着灰色定制西装，脸给宽沿帽挡住了。照片上你唯一能辨认出来的细节，就是他那双醒目的红色手套。这是照片上仅有的一点颜色。你好奇怪这样的模糊效果是否是由于曝光时间过长。“这是我的搭档几天前拍的。之后他也消失了。无论发生了什么，你总可以确信这个戴红手套的男子肯定牵涉其中。”</p><p>你单刀直入，问福林探员他到底想要你干什么。“通力协作。分享情报。现在看来大家知道的都有限。”你同意了。如果这人没说假话，这样的事件已经遍布全球，那你单枪匹马肯定无法穷根溯源。“为此，我请求你和我一道去伦敦。有人在那儿目击到了戴红色手套的男子，而他肯定不是一个人。我敢打个大赌，他肯定知道我的搭档去哪儿了。都安排好了。档案里就有船票。船两天后从波士顿出发。”</p><p class='basic'>调查员必须决定（选择一项）：</p><ul><li>*接受他的提议。*</li><li>*自己前往伦敦。*</li></ul>",
          "intro6": "<p class='file'>你接过档案，告诉福林探员你会将自己发现如实以告。你迅速安排好自己的事务，搭上下一班列车前往波士顿。福林提供的证据帮了你大忙，比你在阿卡姆忙活一个月还要有用。要是跟国际刑事警察委员会合作能解开这个谜题，那你为何要怀疑他？你早早到了伦敦，立刻开始工作。</p><ul><li>信任出自天真。从混乱袋里移除1个{'{'}elderThing{'}'}标记,并加入1个{'{'}tablet{'}'}标记。（这个标记之后可能因保密而移除。但坚定会让你更强大。）</li><li>阅读下一栏的“记录时间”规则。现在在剧本日志中记1_时间_。然后，进入_冒险设置_。</li></ul>",
          "intro7": "<p class='file'>你接过档案，但没有接受福林探员的要求。毕竟你们才刚刚见面，你可不确定能相信什么。要是事情真跟他说的一样危急，那么你直接跟他对话就已经冒了极大的风险。你没从波士顿出发，而是搭上一艘前往普利茅斯的远洋巨轮，再搭公交前往伦敦。这趟行程多花了一点时间，但至少你明白自己没被跟踪——无论是福林，还是那个戴红手套的男子的同伙。</p><ul><li>欺瞒招致犹豫。从混乱袋里移除1个{'{'}tablet{'}'}标记，并加入1个{'{'}elderThing{'}'}标记。（这个标记之后可能因信任而移除。但坚定会让你们更强大。）</li><li>阅读下一栏的“记录时间”规则。现在在剧本日志中记2_时间_。然后，进入_冒险设置_。</li></ul>"
        },
        "trackingTime": {
          "title": "档案#5–A(序幕): 谜雨",
          "body": "<h3>记录时间</h3><p class='file'>在这个剧本中，记录时间的流逝至关重要。随着时间流逝，反常的事件会越来越具威胁，不可思议的阴谋也将推进。此外，有些机会也要在特定的时间段期间才会出现。你在受到指示要在剧本日志上记录_时间_时，在“流逝的时间”标题下填充对应数量的方框。</p><p>如果你填充的方框里有(希腊字母形式的)符号，进入剧本手册(第69页的)状况报告部分，找到对应字母的状况报告，阅读之后的文本。</p>"
        },
        "setup": {
          "gatherSets": "收齐以下遭遇组的所有卡牌：*谜雨*、*猩红阴谋*、*黑暗笼罩*、*域外来客*、*重重疑云*、*奇异现象*、*寒冷刺骨*、*上锁的门*、*午夜假面*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/riddles-and-rain.png' /><img src='{setImgPath}/crimson-conspiracy.png' /><img src='{setImgPath}/dark-veiling.png' /><img src='{setImgPath}/outsiders.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /><img src='{setImgPath}/strange-happenings.png' /><img src='{setImgPath}/chilling-cold.png' /><img src='{setImgPath}/locked-doors.png' /><img src='{setImgPath}/midnight-masks.png' /></section>在收齐*午夜假面*遭遇组时，只收齐五张诡计卡牌（2张错误指示和3张追猎鬼影）。不要收齐该遭遇组中的地点、场景、密谋和冒险参考卡牌。",
          "setSetsOutOfPlay": "将*猩红阴谋*和*域外来客*遭遇组放在一边，位于场外。",
          "placeLocations": "将伦敦雨街地点放置入场。",
          "beginPlay": "每位调查员从伦敦雨街开始游戏。",
          "remainingLocations": "将其他所有地点放在一边，位于场外。",
          "setOutOfPlay": "将戴红手套的男子敌人和渡鸦之眼钥匙放在一边，位于场外。",
          "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：戴红手套的男子和同志会特工(A、B和C)。将这些卡牌放在一边，位于场外。"
        },
        "resolutions": {
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败)_: 夜色愈深，你也愈发感觉自己正被监视——正被追猎。回想福林探员给你看的照片，世界各地都有人就此失踪，被人遗忘，你决定还是小心为上。你回到了特拉法尔加广场的会面地点，一直低着头。你能给福林探员报告的消息固然不多，但总比另一种下场好。</p>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 你追寻戴红手套的男子，找遍了一切可能的藏身之处，到过每一条阴影笼罩的走廊，但他就是不见了，就像直接无影无踪了一般。你有想过他是不是和其他的失踪案一样给抹除了存在，但你并不相信这种可能。没有迹象，也没有笼罩那些模糊的虚影。他就是来过，然后不见了。</p><p>你放弃追逐，转而检查遭遇时散落在地上的物件。这是块小小的红石头，不过眼珠大小。你对搜过的石窖调查了一番，发现这个石头的大小正和里面长眠的死者眼眶相符。</p><p>它们肯定就埋在一起。兴许这块石头就是戴红手套的男子一直在找的东西……可是为什么呢？</p><p>你深入调查，没有找到铭牌或是碑文能说明墓主的身份，只在棺盖上刻了几行字，读起来像是首诗：</p><p class='center'>吾等为红系，<br />因红吾为一。<br />吾亲吾识葬红中，<br />他日再起为红用。</p><p>你还无暇细想这究竟意味着什么，就听到上面的神秘通道传来一阵隆隆作响，沉重的脚步声跨下阶梯。你掏出武器，准备迎战。出乎意料的是，你见到的居然是福林探员。他被一个黑衣黑裤、宽沿大帽的女子用枪指着。这女子肤如乌木，眼神冷酷，黑眼圈深重，卷曲的头发已经剪短。她走进来的时候，身旁还跟了两个穿西装的，一言不发，有如雕像。她示意你待着别动，亮出一枚银色的徽章，但你并认不出这徽章意味着什么。</p><p>“戴红手套的男子哪儿去了？”她问道，“你们又是谁？”</p><p>“我现在能把手放下了吗？”福林探员问道。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>选择一位调查员拥有渡鸦之眼，相应更新在剧本日志中。从现在起，每当有角色拥有了钥匙，就将该钥匙放在易于拿取的位置，直到剧本结束。每当游戏开始，钥匙都会附属在该角色上。*(在未来的冒险中，渡鸦之眼会附属在绑定的调查员上开始游戏。)*</li><li>在剧本日志中，记录下*你和戴红手套的男子之间恩怨未了*。</li><li>在剧本日志中记1_时间_。</li><li>进入_幕间故事：基金会_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 你缓缓地悄声接近，但无论站在哪里，你都无法看清这个男子的面容。“我猜你——想知道……我为什么会在这。”男子说道。他每个单词的节奏都怪异刺耳，重音全部落错了音节，句子中有着漫长的停顿。你点了点头。他指向室内另一端的地窖。“好奇心，”他的话语中带着威胁，“是变换之始——是诅咒之始——会招致一连串诅咒。”</p><p>你心惊胆战地接近地窖里的棺材。这会是个陷阱吗？没有铭牌或是碑文能说明墓主的身份，只在棺盖上刻了几行字，读起来像是首诗：</p><p class='center'>吾等为红系，<br />因红吾为一。<br />吾亲吾识葬红中，<br />他日再起为红用。</p><p>你问戴红手套的男子这究竟是什么意思。“他——有用——再一次。”男子嘶哑道。你掀起棺盖，里面是一具早已被人遗忘的旧尸，仿佛已经长眠了数百年。在昏暗的烛光中，你能看到一只血红的假眼注视着你。“一份——礼物。”你身后的男子悄声说道。你恶心地转过头去，伸手从尸体的眼眶中拿出了石头。你正要问男子这东西是什么，但他却已经不见了，像之前失踪的人一样无影无踪了。只是这次没留下迹象，也没有笼罩那些模糊的虚影，没有任何脱逃的证据。他就是来过，然后不见了。</p><p>你还无暇细想他究竟去了哪儿，就听到上面的神秘通道传来一阵隆隆作响，沉重的脚步声跨下阶梯。你掏出武器，准备迎战。出乎意料的是，你见到的居然是福林探员。他被一个黑衣黑裤、宽沿大帽的女子用枪指着。这女子肤如乌木，眼神冷酷，黑眼圈深重，卷曲的头发已经剪短。她走进来的时候，身旁还跟了两个穿西装的，一言不发，有如雕像。她示意你待着别动，亮出一枚银色的徽章，但你并认不出这徽章意味着什么。</p><p>“戴红手套的男子哪儿去了？”她问道，“你们又是谁？”</p><p>“我现在能把手放下了吗？”福林探员问道。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>选择一位调查员拥有渡鸦之眼，相应更新在剧本日志中。从现在起，每当有角色拥有了钥匙，就将该钥匙放在易于拿取的位置，直到剧本结束。每当游戏开始，钥匙都会附属在该角色上。*(在未来的冒险中，渡鸦之眼会附属在绑定的调查员上开始游戏。)*</li><li>在剧本日志中，记录下*你和戴红手套的男子之间恩怨未了*。</li><li>在剧本日志中记1_时间_。</li><li>进入_幕间故事：基金会_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 你追寻戴红手套的男子，找遍了一切可能的藏身之处，到过每一条阴影笼罩的走廊，但他就是不见了，就像直接无影无踪了一般。你有想过他是不是和其他的失踪案一样给抹除了存在，但你并不相信这种可能。没有迹象，也没有笼罩那些模糊的虚影。他就是来过，然后不见了。</p><p>你放弃追逐，转而检查男子搜刮的地窖。里面是一具早已被人遗忘的旧尸，仿佛已经长眠了数百年。你没有物件可以精准测量尺寸，但你非常确定戴红手套的男子消失前偷走的红石头肯定出自尸体的眼眶。你检查了一番，发现死者的眼窝已经盖着蛛网，恶心地腐败了，但尸体其他部分却诡异地完好。这块石头一定就是戴红手套的男子一直在找的东西……可是为什么呢？</p><p>你深入调查，没有找到铭牌或是碑文能说明墓主的身份，只在棺盖上刻了几行字，读起来像是首诗：</p><p class='center'>吾等为红系，<br />因红吾为一。<br />吾亲吾识葬红中，<br />他日再起为红用。</p><p>你还无暇细想这究竟意味着什么，就听到上面的神秘通道传来一阵隆隆作响，沉重的脚步声跨下阶梯。你掏出武器，准备迎战。出乎意料的是，你见到的居然是福林探员。他被一个黑衣黑裤、宽沿大帽的女子用枪指着。这女子肤如乌木，眼神冷酷，黑眼圈深重，卷曲的头发已经剪短。她走进来的时候，身旁还跟了两个穿西装的，一言不发，有如雕像。她示意你待着别动，亮出一枚银色的徽章，但你并认不出这徽章意味着什么。</p><p>“戴红手套的男子哪儿去了？”她问道，“你们又是谁？”</p><p>“我现在能把手放下了吗？”福林探员问道。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>戴红手套的男子拥有渡鸦之眼，相应更新在剧本日志中。从现在起，每当有角色拥有了钥匙，就将该钥匙放在易于拿取的位置，直到剧本结束。每当游戏开始，钥匙都会附属在该角色上。*(在未来的冒险中，如果戴红手套的男子入场，渡鸦之眼会附属在他身上。)*</li><li>在剧本日志中，记录下*你和戴红手套的男子之间恩怨未了*。</li><li>在剧本日志中记1_时间_。</li><li>进入_幕间故事：基金会_。</li></ul>"
          },
          "resolution4": {
            "title": "结局4",
            "body": "<p>_结局4_: 你焦躁地等着福林探员，紧张起来。他肯定出什么事了。但你还记得他——幸好。你紧张地回想他的面庞、他的声音、引你至此的事件，一边焦急地跺起脚来。嗒嗒嗒。也许你该出去找他。万一他遇上了什么麻烦？嗒嗒嗒。也许他已经不在了。也许只有你还记得他了。那个戴红手套的男子又怎么说？嗒嗒嗒。你等啊，等啊，等啊。</p><p>你都没注意到有人拉开了你对面的椅子。福林探员坐了下来。他并未受伤，你松了口气。尽管你觉得他已经有些时候没睡觉了。他眉头舒展了些，但眼睛里还是充满血丝，惊恐地瞪大了。你也是一样的感受。</p><p>你想开个玩笑缓解一下气氛，于是提醒福林探员他迟到了。他轻轻一笑，点了点头：“抱歉。另一位委员会的侦探……失踪了。”他解释的时候，声音中的疲惫和焦虑透露出酸楚。“希望你已经收集了一些讯息。”</p><p>你叹了口气，向他报告。他听你解释自己的发现，一边漫不经心地交叉手指摩挲起来。“这证明戴红手套的男子并非孤身一人。”他说道。</p><p>就在这时，一个女声穿透了整座房间，打断了他：“情况远不止你说的那样。”她的声音冷酷无情。这女子黑衣黑裤，戴着宽沿大帽，一手亮出一枚你认不出的银色徽章，另一手举着手枪指向你们。这女子肤如乌木，眼神冷酷，黑眼圈深重，卷曲的头发已经剪短。她说话的时候，身旁还跟了两个穿西装的，一言不发，有如雕像，都把手伸进了自己西装夹克的枪带上。你突然害怕地意识到一度繁忙的茶馆里只剩下了你们。其他人都给清了出去。福林迅速举起双手，你也马上照办。</p><p>“戴红手套的男子现在在哪儿？”女子问道，“你们又究竟是谁？”</p><p>你和福林交换了一个忧虑的眼神。你们到底插手了什么事啊？</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>戴红手套的男子拥有渡鸦之眼，相应更新在剧本日志中。从现在起，每当有角色拥有了钥匙，就将该钥匙放在易于拿取的位置，直到剧本结束。每当游戏开始，钥匙都会附属在该角色上。*(在未来的冒险中，如果戴红手套的男子入场，渡鸦之眼会附属在他身上。)*</li><li>在剧本日志中，记录下*你和戴红手套的男子之间恩怨未了*。</li><li>在剧本日志中记2_时间_。</li><li>进入_幕间故事：基金会_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 45,
        "missing": 0,
        "untranslated": 0,
        "present": 45,
        "specialRules": 0
      }
    },
    "deadHeat": {
      "id": "deadHeat",
      "name": "死亡酷暑",
      "nameEn": "Dead Heat",
      "referenceCode": "09520",
      "file": "scenarios/deadHeat.json",
      "sectionsEn": {
        "heading": "File #11-B",
        "rules": {
          "civilians": {
            "title": "Civilians",
            "body": "<p class='basic'>In this scenario, resources on locations represent the innocent civilians of Marrakesh, who are in grave danger.</p><ul><li>For the purposes of enemy movement and enemy attacks, enemies treat civilians as if they were investigators. (Enemies do not engage civilians, but may attack civilians at their location as if they were engaged.) If a civilian is attacked, they are automatically slain.</li><li>Civilians remain present on a location when it is revealed.</li><li>When a civilian is slain, place it on the scenario reference card, to track how many civilians have been slain.</li></ul>"
          },
          "choosingARandomLocation": {
            "title": "Choosing a Random Location",
            "body": "<p class='basic'>During this scenario, you will often be instructed to choose a random location. This should be done by shuffling together the 5 locations not currently in play (the versions of each location in play not currently being used) and drawing 1 at random.</p>"
          },
          "replacingLocations": {
            "title": "Replacing Locations",
            "body": "<p class='basic'>Throughout this scenario, you may be instructed to swap set-aside locations with existing ones. When a location is swapped with one that is already in play, it takes its place. All tokens, attachments, investigators, enemies, and other cards at the former location are considered to now be at the new location (attached cards remain attached, for example). No game element is considered to have moved during such a swap.</p>"
          }
        },
        "specialRules": [
          {
            "title": "@:theScarletKeys.deadHeat.rules.civilians.title",
            "body": "@:theScarletKeys.deadHeat.rules.civilians.body"
          },
          {
            "title": "@:theScarletKeys.deadHeat.rules.choosingARandomLocation.title",
            "body": "@:theScarletKeys.deadHeat.rules.choosingARandomLocation.body"
          },
          {
            "title": "@:theScarletKeys.deadHeat.rules.replacingLocations.title",
            "body": "@:theScarletKeys.deadHeat.rules.replacingLocations.body"
          }
        ],
        "tokens": {
          "easyStandard": {
            "skull": "-1 for every 1 {'{'}perPlayer{'}'} civilians slain.",
            "cultist": "-4. If you fail, choose a non-_Elite_ enemy at your location. That enemy readies and attacks you.",
            "tablet": "-1. You may take 1 damage. If you do not, a civilian at your location is slain.",
            "elderThing": "-3. If you fail, choose and discard 1 card from your hand."
          },
          "hardExpert": {
            "skull": "-2 for every 1 {'{'}perPlayer{'}'} civilians slain.",
            "cultist": "-6. Choose a non-_Elite_ enemy at your location. That enemy readies and attacks you.",
            "tablet": "-2. Take 1 damage. A civilian at your location is slain.",
            "elderThing": "-4. If you fail, discard 1 card from your hand at random."
          }
        },
        "label": {
          "gnashingTeeth": {
            "heal": "Heal 2 damage from each Elite enemy in play.",
            "slain": "1 civilian at your location is slain."
          },
          "tablet": {
            "doNotTakeDamage": "Do not take damage (a civilian at your location, if any, will be slain)"
          },
          "cornered": {
            "slain": "1 civilian at your location is slain."
          }
        },
        "tooltips": {
          "marrakeshRailwayStation": {
            "resign": "You flee the city. (Note: If there are no investigators in play, all remaining civilians in play will be slain.)"
          },
          "marrakeshRailwayStationAbandoned": {
            "resign": "You run for your life. (Note: If there are no investigators in play, all remaining civilians in play will be slain.)"
          }
        },
        "intro": {
          "title": "File #11–B: Dead Heat",
          "lessThan15": "If fewer than 15 time has passed, proceed to Intro 2.",
          "between15And24": "If 15 to 24 time has passed, skip to Intro 3.",
          "moreThan24": "If 25 or more time has passed, skip to Intro 4.",
          "intro1": "<p class='file'>_Intro 1_: You are jolted awake by the sound of screeching wheels as your train shudders to a stop. Although it is barely morning, the heat from the sun rises in shimmering waves from the sweltering pavement to veil Marrakesh in an otherworldly glimmer. Your head pounds. The city wavers like a mirage in the middle of the Moroccan desert.</p><p class='basic'>Check how much time has passed in the Campaign Log.</p>",
          "intro2": "<p class='file'>_Intro 2_: You meet your contact on the rooftop of a small cafe not far from the railway station. The man’s boyish frame is offset by a well-kempt grey beard that covers deep laugh lines. “You must be with the Foundation,” he extends a hand to shake. “I am Latif. Please, sit. You must be hungry.”</p><p>The table is laden with bowls and dishes heaped with eggs, olives, and rich cheese served with flat bread and hot atay. As you eat, Latif spreads a stack of newspapers on the table between you. “I don’t want to ruin your appetite, my friends, but there is some wicked purpose at work in the city.” He points out three different headlines:</p><p class='typewriter center'>MYSTERIOUS TOMB ROBBERY<br />SUDDEN BLIGHT DEVASTATES OLIVE GROVE<br />DOZENS MISSING IN MEDINA</p><p>A warm, pungent breeze wafts over you, rustling the newspaper. Latif whispers conspiratorially, “I assume you read the dossier. The one who calls herself Amaranth was seen here, and I believe she is responsible.” Looking over his shoulder, the middle-aged man produces a crisp photo of a beautiful 20-something woman in a black dress and matching gloves, a gaudy blossom tucked behind her ear.</p><P>“Just last night, I sent my contact to gather any information he could on her whereabouts. He hasn’t returned. I fear the worst,” Latif says, looking downcast. “But that is why you’re here, I suppose! The commissioner always sends such…” he looks at you as if considering his words. “Unique people.”</p><p>You assure Latif that you may be new to the Foundation, but that you are more than capable of handling the situation.</p><p>“I truly hope so,” says Latif, drinking deep from his cup of hot mint tea. “There is something strange happening here. My brother told me he saw our late grandfather walking the street in his burial shroud. I told him that he must have been dreaming, but I have heard similar stories. It is not safe to walk the streets at night anymore. I believe there is some terrible sorcery at work. Some unnatural influence. If only the Foundation did not redact their own missives!”</p><p>You spend the rest of the morning reviewing the bundle of newspapers and scrivenings Latif has collected. The first “tomb robbery” reported in the recent string of events was of Razin Farhi, a 16th-century philosopher and mathematician. “It is rumored that he was one of the founding members of the Red Coterie,” Latif tells you. Your mind races as you try to piece the information together: is Amaranth after another Key?</p><p>“Whatever is happening, we cannot afford to wait idly,” Latif says.</p><p class='basic right'>Proceed to _Setup_.</p>",
          "intro3": "<p class='file'>_Intro 3_: There are no cabs to hail outside the railway station, so you walk to meet your contact on the rooftop of a near-empty cafe. The man who greets you has a boyish frame offset by a well-kempt beard that covers deep laugh lines. However, he is not smiling. “You’re late,” he says gravely. “I sent a telegram to the Foundation requesting assistance. We are in dire straits, as you say.”</p><p>You apologize and tell him you’ve done the best you can, and he rubs his brow worriedly. “I am sorry. It is good you are here, but I fear that things are set in motion already. Things we no longer have the time nor power to stop.” He gestures for you to sit. “I am Latif. Please. You will want to sit down for this.”</p><p>A spread of tempting local delicacies has been laid out on the table, but judging from the spare remnants, Latif ate most of it due to nerves. He shows you several newspapers in turn with headlines detailing desecrated tombs, dying crops, and numerous missing persons reports. As he relays these sobering events to you, you catch a scent of something foul on the wind. Looking out across the city, you see a pattern of inky black vines that run across building façades. At a distance, they look like raised veins on a dying body.</p><p>“My friend?” Latif ’s voice breaks through your reverie. You apologize, and ask him about the vines. The middle-aged man sighs. “Yet another mystery, it seems. Last night, there was a great commotion outside Bahia Palace. Screaming and gnashing teeth. I sent one of my informants to investigate and he never returned. Soon after, the strange black blooms appeared, growing on every wall and surface. They stink of rot and produce awful, sharp thorns. I wouldn’t dare touch them.”</p><p>“Before this strange business began, my brother told me he saw our late grandfather walking the street in his burial shroud. I would have dismissed it but for the dozens of similar stories. There are now crowds of slow‑moving, silent people walking the streets. Their eyes are empty, though their bellies are not,” Latif says bitterly, then drains the rest of his teacup.</p><p>“I believe the one who calls herself Amaranth is responsible. You might recognize her from the Foundation’s dossier. How helpful that they blot out the most important details in their own missives!” Latif produces a crisp photo of a beautiful 20-something woman in a black dress and matching gloves, a gaudy blossom tucked behind her ear.</p><p>“Another of my informants said he saw this ‘Amaranth’ at the Bahia Palace Gardens. Some strange work is afoot, and she is at the center of it. I say we go to the palace and put a stop to whatever awful plans she has in place, but be ready for anything.”</p><p>You catch a now-familiar scent of rot on the wind, and look down to the lip of the rooftop cafe. A single, black tendril has crept up the side of the building. At the end of the vine, a bulbous, black fruiting body has begun to develop. You aren’t sure if it is a trick of the late morning sun, or if there is some other strange process at work, but you could swear you see a shimmer of phosphorescent green flash along the body, and a noticeable movement, though there is no wind.</p><p class='basic right'>Proceed to _Setup_.</p>",
          "intro4": "<p class='file'>_Intro 4_: A scent of smoke and decay greets you as you step off the train. You are one of just a handful of people to emerge onto the empty platform of the railway station. Black, dessicated vines climb up the sides of the surrounding buildings and end in riotous red flowers. An eerie silence hangs over everything.</p><p>On your way to meet your contact, you pass a few, scattered people who walk with a halting, awkward gait. Several of them reach out to you as you keep a wide berth, and you see their skin is jaundiced and dry, and their eyes have a hollow, empty look. A cloud of flies follows in their wake, buzzing incessantly. You are hardly surprised when you find the door to the cafe where you were supposed to meet a “Latif ” boarded up.</p><p>Tarry death blooms on the walls and storefronts, all hastily barricaded. Fearful eyes peer out at you from between slatted boards. Marrakesh is in utter ruin. After wandering the city, you find the epicenter of the strange black vines lies in the pulverized remains of Bahia Palace. In the overgrown gardens, you find the remnants of a strange ritual, but no trace of those who conducted it.</p><p class='basic right'>Skip to _Resolution 5_.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: *Dead Heat*, *Scarlet Sorcery*, *Spreading Corruption*, *Ghouls*, and *Striking Fear*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/dead-heat.png' /><img src='{setImgPath}/scarlet-sorcery.png' /><img src='{setImgPath}/spreading-corruption.png' /><img src='{setImgPath}/ghouls.png' /><img src='{setImgPath}/striking-fear.png' /></section>",
          "placeLocations": "Put all 5 _Marrakesh_ locations into play, using only their non‑_Abandoned_ versions. Set aside the _Abandoned_ version of each location.",
          "beginPlay": "Each investigator begins play at Marrakesh Railway Station.",
          "civilians": "For each location in play, place resources on it equal to one more than the number of investigators, as civilians (*see “Civilians,”below*). Then, check the Campaign Log:",
          "tenOrFewerTime": "If 10 or fewer _time_ has passed, no change is made.",
          "elevenToSeventeenTime": "If 11–17 _time_ has passed, choose 1 {'{'}perPlayer{'}'} civilians as evenly as possible among all locations in play. Those civilians are slain.",
          "eighteentoTwentyFourTime": "If 18–24 _time_ has passed, choose 2 {'{'}perPlayer{'}'} civilians as evenly as possible among all locations in play. Those civilians are slain.",
          "setOutOfPlay": "Set the following cards aside, out of play: the double-sided Amaranth enemy, the Razin Farhi enemy, the Khalid enemy, both copies of the Ancient Raider enemy, The Last Blossom key, and the double-sided “Save the Civilians / Aftermath” story card.",
          "decks": "Check the Campaign Log and build the act and/or agenda decks accordingly.",
          "fewerThanFifteenTime": " If fewer than 15 _time_ has passed, no change is made.",
          "fifteenToTwentyFourTime": "If 15 to 24 _time_ has passed, remove act 1 from the game. The game begins at act 2a. Place doom equal to the number of players on agenda 1. Spawn Amaranth (*Lurking Corruption*) at Bahia Palace Garden, and attach The Last Blossom to her. Put the setaside Save the Civilians story card into play. Shuffle the Khalid enemy into the encounter deck."
        },
        "resolutions": {
          "xp": {
            "bonus": "Helped the survivors of the city rebuild"
          },
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated)_: You watch in horror as the remnants of the city are overtaken by the insidious vines. The remaining civilians are devoured by Amaranth’s servants. As you watch the devastation unfold, you wish you could have done more.<p>",
            "slay": "Each civilian remaining in play is slain. If it is still Act 1, draw the set-aside Save the Civilians story card and resolve the Aftermath side.",
            "checkEnemies": "Check which enemies are in play.",
            "razin": "If Razin Farhi is in play, skip to _Resolution 1_.",
            "noRazin": "If the above is not true, skip to _Resolution 2_."
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: Realizing the peril of your situation, you make for the outskirts of town and knock on every door you see. Pleading for your life, you offer money or whatever you have on hand, only to be turned away at every stop. Eventually, a wrinkled old woman takes pity on you and welcomes you inside. You spend the night trembling in fear and trepidation, and when you emerge in the morning, the city is in ruins. Awful black vines envelop everything. This devastation was apparently a worthwhile price to pay for true love.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Amaranth is the bearer of The Last Blossom. Update the Campaign Log accordingly.</li><li>In your Campaign Log, record *the lovers are reunited*.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: Realizing the peril of your situation, you make for the outskirts of town and knock on every door you see. Pleading for your life, you offer money or whatever you have on hand, only to be turned away at every stop. Eventually, a wrinkled old woman takes pity on you and welcomes you inside. You spend the night trembling in fear and trepidation, and when you emerge in the morning, the city is in ruins. Awful black vines envelop everything. You wonder what was so important to Amaranth that she would cause such devastation.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Amaranth is the bearer of The Last Blossom. Update the Campaign Log accordingly.</li><li>In your Campaign Log, record *you haven’t seen the last of Amaranth*.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: Looking down at the woman who called herself Amaranth, you call her by her true name. “Eryn…Cochwyn?” She holds her hand to her cheek as her cheeks flush. You see her eyes dilate as she begins to remember her former life. As her gaze passes over the Last Blossom writhing in your hand, she lets out a cry of horror. “I had the most terrible dream,” she says. “I dreamt I was a great and terrible queen, and that I ruled over a kingdom of silent subjects.” Realizing what she has done, the change in Eryn’s demeanor is jarring. The woman who seemed so heartless and cruel now lies before you, weeping.</p><p>It is clear to you that Eryn’s actions were not her own. You console her and lead her to safety along with the rest of the survivors, telling her that you will keep the blossom safe and prevent ‘Amaranth’ from taking another host ever again. “Never again,” she echoes your words. “Never again.” As you depart, the blossom furls and unfurls, as if searching for another host.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Choose an investigator to be the bearer of The Last Blossom and update the Campaign Log accordingly.</li><Li>In your Campaign Log, record *Amaranth has left the Coterie*.</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution4": {
            "title": "Resolution 4",
            "body": "<p>_Resolution 4_: As you hold the Last Blossom in your hand, Amaranth convulses on the ground before you. Spitting black ichor, the beautiful young woman claws at you like a frightened animal, then bolts away down a narrow street. Although you try to follow her, you eventually lose her trail in the confusion of fleeing civilians and shriveling overgrowth.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Choose an investigator to be the bearer of The Last Blossom and update the Campaign Log accordingly.</li><li>In your Campaign Log, record *you haven’t seen the last of Amaranth*.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution5": {
            "title": "Resolution 5",
            "body": "<p>_Resolution 5_: You find many “Latif ”s listed among the innumerable dead as the city reckons with its losses. Rather than try to find your contact, you take stock of the situation and read over the dossier. You have little doubt that this was the work of the Coterie. What Amaranth did here claimed thousands of lives and wreaked havoc on a scale you could have scarcely foreseen. Whatever her reasons, she apparently has the ability to bring calamity on an apocalyptic scale.</p><p>As the people of Marrakesh carry out the grim arithmetic of counting survivors, you use what time you have to help the civilians rebuild. Over the course of many days, the awful vines dessicate and blow away as ash, and the dead are cleansed and wrapped for burial. Despite the devastation, there is hope for the city to become what it once was, if not even better. With a heavy heart, you prepare to leave.</p><ul><li>In your Campaign Log, record *you haven’t seen the last of Amaranth*.</li><li>Each investigator suffers 1 mental trauma as they survey the ruins of Marrakesh.</li><li>Each investigator earns 3 bonus experience as they help the survivors of the city rebuild.</li><li>Amaranth is the bearer of The Last Blossom. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "档案#11-B",
        "rules": {
          "civilians": {
            "title": "平民",
            "body": "在本剧本中，地点上的资源代表马拉喀什的无辜平民，他们正处于极度危险之中。\n\n• 就敌人移动和敌人攻击而言，敌人将平民视同调查员。（敌人不会与平民交战，但可以攻击其所在地点的平民，如同与其交战。）如果平民遭到攻击，他们会自动被杀害。\n• 地点被揭示时，平民仍留在该地点。\n• 当一位平民被杀害时，将其放到冒险参考卡牌上，以记录已被杀害的平民数量。"
          },
          "choosingARandomLocation": {
            "title": "选择随机地点",
            "body": "在本剧本中，你经常会受到指示选择一个随机地点。此时应将当前不在场上的5个地点（即场上每个地点当前未使用的那些版本）洗混，随机抽取1个。"
          },
          "replacingLocations": {
            "title": "替换地点",
            "body": "在本剧本中，你可能会受到指示，将放在一边的地点与已有的地点进行替换。当一个地点与已在场上的地点替换时，它取代后者的位置。原地点上的所有标记、附属物、调查员、敌人及其他卡牌，均视为现在位于新地点（例如，附属于地点的卡牌仍保持附属状态）。在此类替换过程中，不视为任何游戏元素发生了移动。"
          }
        },
        "specialRules": [
          {
            "title": "平民",
            "body": "在本剧本中，地点上的资源代表马拉喀什的无辜平民，他们正处于极度危险之中。\n\n• 就敌人移动和敌人攻击而言，敌人将平民视同调查员。（敌人不会与平民交战，但可以攻击其所在地点的平民，如同与其交战。）如果平民遭到攻击，他们会自动被杀害。\n• 地点被揭示时，平民仍留在该地点。\n• 当一位平民被杀害时，将其放到冒险参考卡牌上，以记录已被杀害的平民数量。"
          },
          {
            "title": "选择随机地点",
            "body": "在本剧本中，你经常会受到指示选择一个随机地点。此时应将当前不在场上的5个地点（即场上每个地点当前未使用的那些版本）洗混，随机抽取1个。"
          },
          {
            "title": "替换地点",
            "body": "在本剧本中，你可能会受到指示，将放在一边的地点与已有的地点进行替换。当一个地点与已在场上的地点替换时，它取代后者的位置。原地点上的所有标记、附属物、调查员、敌人及其他卡牌，均视为现在位于新地点（例如，附属于地点的卡牌仍保持附属状态）。在此类替换过程中，不视为任何游戏元素发生了移动。"
          }
        ],
        "tokens": {
          "easyStandard": {
            "skull": "每有1{'{'}perPlayer{'}'}个平民遭到杀害，-1。",
            "cultist": "-4。如果你检定失败，选择你所在地点的一个非_精英_敌人。该敌人重整并攻击你。",
            "tablet": "-1。你可以受到1点伤害。如果你不这么做，你所在地点的一个平民遭到杀害。",
            "elderThing": "-3。如果你检定失败，选择并弃掉你1张手牌。"
          },
          "hardExpert": {
            "skull": "每有1{'{'}perPlayer{'}'}个平民遭到杀害，-2。",
            "cultist": "-6。选择你所在地点的一个非_精英_敌人。该敌人重整并攻击你。",
            "tablet": "-2。受到1点伤害。你所在地点的一个平民遭到杀害。",
            "elderThing": "-4。如果你检定失败，随机弃掉你1张手牌。"
          }
        },
        "label": {
          "gnashingTeeth": {
            "heal": "治愈场上每个_精英_敌人的2点伤害。",
            "slain": "你所在地的1个平民遭到杀害。"
          },
          "tablet": {
            "doNotTakeDamage": "不受到伤害，你所在地点的一个平民遭到杀害(如果有)。"
          },
          "cornered": {
            "slain": "你所在地点的一个平民遭到杀害。"
          }
        },
        "tooltips": {
          "marrakeshRailwayStation": {
            "resign": "你逃出了这座城。(注意：如果场上没有调查员，那么场上剩余的所有平民都会遭到杀害。)"
          },
          "marrakeshRailwayStationAbandoned": {
            "resign": "你慌忙逃命。(注意：如果场上没有调查员，那么场上剩余的所有平民都会遭到杀害。)"
          }
        },
        "intro": {
          "title": "档案#11–B: (死亡酷暑)",
          "lessThan15": "流逝的_时间_小于15",
          "between15And24": "流逝的_时间_为15到24",
          "moreThan24": "流逝的_时间_大于等于25",
          "intro1": "<p class='file'>你被一阵车轮的吱嘎声震醒，原来是火车突然停了。尽管现在还没到早晨，初露锋芒的阳光却已在闷热的步道上卷起暑浪，将马拉喀什包裹在一阵异界般的微光中。你头痛起来。整座城市就像在摩洛哥沙漠中摇曳的海市蜃楼。</p><p class='basic'>检查剧本日志中已经流逝了多少_时间_。</p>",
          "intro2": "<p class='file'>你在火车站附近一家小小咖啡馆的顶上见到了自己的联络人。他的身形看上去还有几分稚嫩，但一嘴的灰胡子却修剪得很好，正挡住了深深的笑纹。“你肯定是基金会派来的。”他向你伸出了手，“我叫拉蒂夫。请坐。你肯定已经饿了。”</p><p>桌上盆碗齐备，装满了鸡蛋、橄榄、厚芝士，再配上薄馕和热热的摩纳哥薄荷茶。你正大快朵颐的时候，拉蒂夫将一摞报纸放在桌上。“我不想坏了你的胃口，朋友。但这座城市里正有邪念作祟。”他指着三则不同的头条：</p><p class='typewriter center'>神秘的盗墓案<br />橄榄园突然枯萎<br />麦地那众人失踪</p><p>一阵刺鼻的暖风吹过，报纸沙沙作响。拉蒂夫神神秘秘地低语：“我想你已经看过密档了。那个自称‘苋’的女人在这儿出现了，我相信这一切都和她有关。”桌对面的中年男子递来一张相片，上面是位二十岁左右的靓女，黑裙黑手套，耳边别着一朵俗艳的大花。</p><p>“就在昨晚，我派出联络人去收集一切和她有关的信息，他没有回来。我担心最坏的事情已经发生了。”拉蒂夫目光沮丧，“我想这就是你为什么在这儿了！专员总是会派这么……”他看了看你，好似在斟酌话语，“独一无二的人。”</p><p>你向拉蒂夫保证，虽然你和基金会共事的时间不长，但你肯定能搞定眼前的情况。</p><p>“我也非常希望如此。”拉蒂夫痛饮了一口薄荷茶，“这里发生了怪事。我兄弟说他看到我们已经过世的祖父披着裹尸布在街上游荡。我说他肯定是在做梦，但类似的故事我也听过。现在晚上走在街上也不安全咯。我相信这肯定是某种可怕的巫术，某种反常的力量。基金会干嘛要把他们的密档搞得那么神秘！”</p><p>你早上接下来的时间都在检阅拉蒂夫收集的报刊和公文。第一起“盗墓案”的墓主是一位16世纪的哲学家和数学家拉辛·法瑞。“传闻他就是红色同志会的开创元老之一。”拉蒂夫告诉你。你试图将这些信息拼凑在一起，大脑飞速运转：苋是在寻找另一个钥匙吗？</p><p>“无论发生了什么，我们都不能再空等了。”拉蒂夫说道。</p><p class='basic right'>进入_冒险设置_。</p>",
          "intro3": "<p class='file'>火车站外没有出租车，你不得不步行前往几近无人的咖啡馆，在顶上和联络人碰头。跟你打招呼的人身形看上去还有几分稚嫩，但一嘴的灰胡子却修剪得很好，正挡住了深深的笑纹。但他现在可没有笑。“你迟到了。”他严肃地说，“我给基金会发了电报请求帮助。可以说，我们现在是有大麻烦了。”</p><p>你向他道歉，说自己已经尽力了。他焦急地皱起了眉头。“抱歉，你来了是很好，但恐怕事情已经发生了。发生的事情我们既没有时间，也无力阻止了。”他示意你坐下，“我叫拉蒂夫。请坐，我要说的可不是什么好消息。”</p><p>桌上摆着诱人的当地美食。但从剩下的情况来看，拉蒂夫用餐的时候并没什么兴致。他转而递给你几份报纸，头版详细列举的事情都是坟墓遭到亵渎、农作物死去，还有许多人失踪。就在他向你传达这些严重讯息的时候，你闻到风中有一阵恶心的气息。你眺望全城，发现建筑立面上爬着墨色的藤蔓。远远望去，就像死尸上突起的筋脉。</p><p>“朋友？”拉蒂夫的话音打断了你的沉思。你向他道歉，又问起那些藤蔓。中年男子叹了口气：“那看来是另一件怪事了。昨夜在巴希尔宫外有一场骚乱。失声尖叫、磨牙吮血。我派了一个线人去调查，但他没有回来。很快，奇怪的黑花就开了，长满了所有的墙壁和里面。不仅恶臭，还长出了可怕的尖刺。我都不敢碰。”</p><p>“就在这怪事开始前，我兄弟说他看到我们已经过世的祖父披着裹尸布在街上游荡。我可以不信，但类似的故事有那么多。现在步履缓慢、一言不发的死人就在街上游荡。他们眼神空洞，但肚皮可不空。”拉蒂夫愤愤说着喝完了最后一点茶。</p><p>“我相信这一切都和那个自称‘苋’的女人有关。你兴许从基金会的密档里认出来了。他们真有本事，在给我们的公文里漏掉了最重要的细节！”拉蒂夫递来一张相片，上面是位二十岁左右的靓女，黑裙黑手套，耳边别着一朵俗艳的大花。</p><p>“我另一个线人说他在巴希尔宫花园见到了这个‘苋’。怪事迫近，而她定是罪魁祸首。要我说，咱们到宫里去，管她计划什么，都给拦下。不过这一去遇到什么都有可能。”</p><p>你闻到风中传来熟悉的气味，低头看向咖啡馆屋顶的边缘。一根黑色卷须已经缠上了这栋建筑。藤蔓顶端长出一颗球状的黑色花苞。你不确定是因为迫近中午的阳光造成了错觉，还是真有什么怪事已经发生，但你可以发誓自己看到花苞上闪烁着绿色的磷光，它的运动清晰可辨——尽管此时并没有风。</p><p class='basic right'>进入_冒险设置_。</p>",
          "intro4": "<p class='file'>你刚下火车，所见的都是烟雾和腐败。月台空空如也，下车的人寥寥无几，其中有你。附近的建筑上爬满了干枯的黑色藤蔓，顶上长着狂乱的红花。一切都静得诡异。</p><p>你去找自己的线人，经过一群彼此分散、步履蹒跚丑陋的路人。你避开他们，其中却有几个朝你伸出了手。你看到他们的表皮干枯，长满黄疸，而他们的眼神也很空洞。一群苍蝇闻着嗡嗡不停。你来到自己应该和“拉蒂夫”碰头的咖啡馆，却毫不意外地发现这里的门都封死了</p><p>柏油一般的死亡之花开满了墙上和店面——这些地方都给匆匆堵了起来。板条间有恐惧的眼神望着你。马拉喀什已经毁了。你在城中来回，发现巴希尔宫已成齑粉，这里就是古怪黑藤发源的地方。你在藤蔓疯长的花园里找到了神秘仪式的残余，但已经无法找出是谁举行了仪式。</p><p class='basic right'>跳到_结局5_。</p>"
        },
        "setup": {
          "gatherSets": "收齐以下遭遇组的所有卡牌：*死亡酷暑*、*猩红巫术*、*腐败扩散*、*食尸鬼*、*恐惧打击*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dead-heat.png' /><img src='{setImgPath}/scarlet-sorcery.png' /><img src='{setImgPath}/spreading-corruption.png' /><img src='{setImgPath}/ghouls.png' /><img src='{setImgPath}/striking-fear.png' /></section>",
          "placeLocations": "将全部5张_马拉喀什_地点放置入场，只使用其非_废弃_版本。将_废弃_版本的每张地点放在一边。",
          "beginPlay": "每位调查员从马拉喀什火车站开始游戏。",
          "civilians": "在场上每个地点放置资源，数量等于调查员人数+1，作为平民*(见下文“平民”)*。然后，检查剧本日志：",
          "tenOrFewerTime": "如果流逝的_时间_小于等于10，不作改动。",
          "elevenToSeventeenTime": "如果流逝的_时间_为11到17，在场上所有地点中尽可能均匀地选择总计1{'{'}perPlayer{'}'}个平民，这些平民遭到杀害。",
          "eighteentoTwentyFourTime": "如果流逝的_时间_为18到24，在场上所有地点中尽可能均匀地选择总计2{'{'}perPlayer{'}'}个平民，这些平民遭到杀害。",
          "setOutOfPlay": "将下列卡牌放在一边，位于场外：双面的苋敌人、拉辛·法瑞敌人、哈立德敌人、全部两张古代劫掠者敌人、未绽之花附属，以及双面的“拯救平民/后果”剧情卡牌。",
          "decks": "检查剧本日志，对应组成场景和/或密谋牌库。",
          "fewerThanFifteenTime": " 如果流逝的_时间_小于15，不作改动。",
          "fifteenToTwentyFourTime": "如果流逝的_时间_为15到24，将场景1从游戏中移除，游戏从场景2a开始。在密谋1上放置等同于玩家人数的毁灭标记。将苋*(腐败潜伏)*生成在巴希尔宫花园，并将未绽之花附属在她上面。将放在一边的拯救平民剧情卡牌放置入场。将哈立德敌人洗入遭遇牌库。"
        },
        "resolutions": {
          "xp": {
            "bonus": "帮助了幸存者重建城市"
          },
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败):_你恐惧地看着阴伏的藤蔓占据了城市的废墟。剩余的平民也都落入苋的仆从虎口。你看着眼前的惨状，真希望自己能多出一份力。<p>",
            "slay": "场上剩余的所有平民遭到杀害。如果仍是场景1，抽取放在一边的拯救平民剧情卡牌并结算其后果面。",
            "checkEnemies": "检查场上的敌人。",
            "razin": "拉辛·法瑞在场上",
            "noRazin": "并非上述情况"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 你意识到自己的处境有多么危险，赶忙逃到城市外围，敲响家家户户的房门。你掏出钱来，还有手上能拿出的一切，只为求得性命。但你每次停留都遭到了拒绝。终于，有个满脸皱纹的老妇人怜悯了你，请你进屋。你这一夜都心惊胆战，不住打颤。到了早上出门的时候，城市已是一片废墟。可怕的黑色藤蔓覆盖了一切。如此惨状，肯定能满足真爱的代价。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>苋拥有未绽之花，相应更新在剧本日志中。</li><li>在剧本日志中，记录下*情人重聚*。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 你意识到自己的处境有多么危险，赶忙逃到城市外围，敲响家家户户的房门。你掏出钱来，还有手上能拿出的一切，只为求得性命。但你每次停留都遭到了拒绝。终于，有个满脸皱纹的老妇人怜悯了你，请你进屋。你这一夜都心惊胆战，不住打颤。到了早上出门的时候，城市已是一片废墟。可怕的黑色藤蔓覆盖了一切。你不禁想知道，苋到底想要什么，才不惜招致这样的惨状。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>苋拥有未绽之花，相应更新在剧本日志中。</li><li>在剧本日志中，记录下*你和苋之间恩怨未了*。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 你俯视着自称为“苋”的女子，呼唤起她的真名：“艾琳……科奇温？”她面红耳赤，以手覆面。你看到她记起了自己的前生，眼睛瞪大。她看着在你手中翻滚的未绽之花，发出一声恐怖的尖叫。“我有过最可怕的梦。”她说道，“我梦到自己是至高的暴君，统治的国度尽是缄默的臣民。”想到自己都做了什么，她这番转变更是违和。过去冷酷无情的女子现在在你脚下哭泣。</p><p>显然艾琳的举止是受外物支配。你安慰了她，将她和其他幸存者都带到安全的地方，告诉她你会好好保管未绽之花，不让“苋”再寻找新的宿主。“再不会了。”她重复着你的话，“再不会了。”就在你离开的时候，手中的花朵还在张合，仿佛就是在找新的宿主。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>选择一位调查员拥有未绽之花，相应更新在剧本日志中。</li><Li>在剧本日志中，记录*苋离开同志会*。</li><li>在剧本日志中记2_时间_。你可以_启程_。</li></ul>"
          },
          "resolution4": {
            "title": "结局4",
            "body": "<p>_结局4_: 你将未绽之花握在手心，苋倒在你面前，一阵抽搐。美丽的少女吐出一阵黑色的脓水，她向你张牙舞爪，仿佛一只受惊的动物，然后一下子沿着狭窄的街道溜了。你试图追上，但逃跑的市民和疯长的植物留下一片混乱，你还是跟丢了。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>选择一位调查员拥有未绽之花，相应更新在剧本日志中。</li><li>在剧本日志中，记录下*你和苋之间恩怨未了*。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution5": {
            "title": "结局5",
            "body": "<p>_结局5_: 马拉喀什经历着劫后的余波，你在不计其数的死者清单上找到了许多的“拉蒂夫”。你没去找线人，而是评估当前的情况，又读了一遍密档。这无疑是同志会干的好事。苋夺走了几千条人命，她倾泄的毁灭规模之大，绝非你能料到。无论什么原因，她显然能有能力造成这样末日级别的灾祸。</p><p>马拉喀什的人民开始悲痛地清点生还者，你花了些时间帮他们重建城市。接下来的许多日子里，可怕的藤蔓干枯成灰，被风吹走，而死者则被清理包裹，纷纷下葬。尽管历经了这样的磨难，这座城市还是有希望恢复过去的荣光，甚至更胜往日。你带着沉重的心情准备离开。</p><ul><li>在剧本日志中，记录下*你和苋之间恩怨未了*。</li><li>每位调查员承受1点精神创伤，因为其查看了马拉喀什的废墟。</li><li>每位调查员取得3点奖励经验值，因为其帮助了幸存者重建城市。</li><li>苋拥有未绽之花，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 63,
        "missing": 0,
        "untranslated": 0,
        "present": 63,
        "specialRules": 6
      }
    },
    "sanguineShadows": {
      "id": "sanguineShadows",
      "name": "血色阴影",
      "nameEn": "Sanguine Shadows",
      "referenceCode": "09545",
      "file": "scenarios/sanguineShadows.json",
      "sectionsEn": {
        "heading": "File #16–D",
        "ui": {
          "lastKnownLocation": "Last Known Location"
        },
        "tokens": {
          "easyStandard": {
            "skull": "-X. X is the number of targets on this card.",
            "cultist": "-5. If you fail by 2 or more, shuffle each concealed mini-card at your location and at each connecting location facedown, then place them at random in the positions they were in.",
            "tablet": "-1. Cancel the effects and icons of each card committed to this skill test.",
            "elderThing": "-2. If you fail, you must either place 1 doom on the current agenda, or the nearest _Coterie_ enemy attacks you (*even if it is in the shadows*)."
          },
          "hardExpert": {
            "skull": "-X. X is 1 more than the number of targets on this card.",
            "cultist": "-7. If you fail by 2 or more, shuffle each concealed mini-card at your location and at each connecting location facedown, then place them at random in the positions they were in.",
            "tablet": "-2. Cancel the effects and icons of each card committed to this skill test.",
            "elderThing": "-3. If you fail, you must either place 1 doom on the current agenda, or the nearest _Coterie_ enemy attacks you (*even if it is in the shadows*)."
          }
        },
        "label": {
          "coterieAttack": "The nearest _Coterie_ enemy attacks you (*even if it is in the shadows*)"
        },
        "tooltips": {
          "avenidaDeMayo": {
            "resign": "Looks like La Chica Roja wins this game."
          }
        },
        "remembered": {
          "matiasBolivarTrustsYou": "Matías Bolívar trusts you.",
          "matiasBolivarDoesntTrustYou": "Matías Bolívar doesn't trust you."
        },
        "intro": {
          "label": {
            "everything": "Tell Bolívar everything regarding the target.",
            "breadcrumbs": "Give Bolívar some breadcrumbs.",
            "insist": "Insist that Bolívar tells you what he knows."
          },
          "title": "File #16–D: Sanguine Shadows",
          "intro1": "<p class='file'>_Intro 1_: As soon as you arrive in Buenos Aires, you set your meeting with Oficial Bolívar at a café overlooking the harbor. Seagulls cry out over the many shipping and fishing boats in the distance. Even after Bolívar arrives, you continue to keep an eye out for others listening in—for anyone wearing red, especially. The officer meets you in uniform instead of casual clothes— whether by protocol or due to being overworked, you are unsure. His response to your letter seemed overly eager. Perhaps he is as starved for information regarding his target as you are? “Your letter suggested we may be able to aid one another,” he says casually, after calling out for a café chico. “You have information regarding La Chica Roja?”</p><p>You clarify that you are the one seeking information from Bolívar, not the other way around. “Well, scratch my back and I’ll scratch yours,” he says, his expression turning serious. “What do you know?”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>Tell Bolívar everything regarding the target. Proceed to _Intro 2_.</li><li>Give Bolívar some breadcrumbs. Skip to _Intro 3_.</li><li>Insist that Bolívar tells you what he knows. Skip to _Intro 4_.</li></ul>",
          "intro2Part1": "<p class='file'>_Intro 2_: You decide that honesty is the best policy. You doubt he would believe your tale about extraterrestrials and secret organizations, but you can at least tell him what you know regarding “La Chica Roja.” He mulls over the information you give him, taking a minute to process everything. “Hmm… so you really believe that La Chica Roja has these…abilities…?” You tell him you are certain. It may be tough to believe, but it is important that Bolívar understand the reality of the situation. “I knew it. I knew it!” he grins. “Of course! It makes so much sense. The way she would vanish into thin air, move with such speed…” You hadn’t expected him to believe you, but it turns out your information has only confirmed his own suspicions. “So how do you intend to help us catch her?”</p><p>You tell Bolívar that you intend to capture her on your own. All you need from him is information regarding her objective and last known whereabouts in Buenos Aires. He pulls several photos of buildings in Buenos Aires out of his folder and reveals them to you. “La Chica Roja has carved a path of thievery and mischief throughout Buenos Aires. Hundreds of thousands of pesos in stolen art and artifacts.” He points to each of the photos, one by one. “Casa Rosada, Palacio Errázuriz, Teatro Colón. She has been spotted many times, but try as we might, we cannot catch her in the act. Those in charge are, shall we say…unhappy…with how the situation has been handled.” He looks away and scratches at the back of his hand as he stammers. It is clear to you that Bolívar’s career is on the line. But you know the stakes are much higher than even that. “It is like she is toying with us. Mocking us.” He strikes the surface of the table in frustration. “Making a killing while making fools of us all.”</p>",
          "criminal": "<p class='red'>_*Read only if an investigator has the Criminal trait*_: You of all people know better than to presume the target’s intent from so little. Had she intended to sell the stolen relics, there would be evidence of such sales on the black market. She would likely make as much or more ransoming the goods back to their owners. Besides, you doubt the Coterie is after mere wealth. There must be some other value to the stolen items.</p>",
          "intro2Part2": "<p>You tell Oficial Bolívar that you will help him find the Girl in the Carmine Coat, but only if he aids you in your investigation. “Of course,” he says with a grin. “If it means we can finally put that thief behind bars, I will do what I can.” You shake the man’s hand and together, a plan begins to brew.</p><ul><li>Remember that “Matias Bolívar trusts you.”</li><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li></ul><p class='basic right'>Proceed to _Setup_.</p>",
          "intro3": "<p class='file'>_Intro 3_: For the sake of diplomacy, you decide to give Bolívar a few harmless bits of information regarding “La Chica Roja,” but nothing more. You can’t risk the truth of the situation getting out. Better that the police think of the Girl in the Carmine Coat as only an extraordinarily skilled thief, and nothing more. “That is all you know?” he asks, incredulous. “And here I thought that you being here meant…Oh well. I suppose she really is a mystery, after all. So how do you intend to help us catch her?”</p><p>You tell Bolívar that you intend to capture her on your own. All you need from him is information regarding her objective and last known whereabouts in Buenos Aires. He pulls several photos of buildings in Buenos Aires out of his folder and reveals them to you. “La Chica Roja has carved a path of thievery and mischief throughout Buenos Aires. Hundreds of thousands of pesos in stolen art and artifacts.” He points to each of the photos, one by one. “Casa Rosada, Palacio Errázuriz, Banco de la Provincia. She has been spotted many times, but try as we might, we cannot catch her in the act. Those in charge are, shall we say…unhappy…with how the situation has been handled.” He looks away and scratches at the back of his hand as he stammers. It is clear to you that Bolívar’s career is on the line. But you know the stakes are much higher than that. “She is toying with us. She will toy with you too. Chew your investigation up and spit you out.”</p><p>You assure Oficial Bolívar that you can catch her, but it’s better if his team stays out of your way. “If it means putting that thief behind bars, I will let you have a go at it,” he agrees. You shake the man’s hand, and a plan begins to brew.</p><p class='basic right'>Proceed to _Setup_.</p>",
          "intro4": "<p class='file'>_Intro 4_: You shake your head. This isn’t a negotiation—you cannot let Oficial Bolívar and his investigation impede yours in any way. “And what makes you think I am going to cooperate if you refuse to assist?”</p><p>You pull out one of the letters given to you by Agent Taylor and hand it to Bolívar. He opens it slowly and warily, keeping his eyes on you the entire time. It takes him little time to read through the entire thing, after which he crumples it up and tosses it back onto the table. “Damn you,” he says. You ask him once more what he knows regarding the target’s objective and last known whereabouts. He pulls several photos of buildings in Buenos Aires out of his folder and tosses them onto the table. “La Chica Roja has carved a path of thievery and mischief throughout Buenos Aires. Hundreds of thousands of pesos in stolen art and artifacts.” He points to each of the photos, one by one. “Casa Rosada, Palacio Errázuriz, Banco de la Provincia. She has been spotted many times, but try as we might, we cannot catch her in the act. And now here you are, complicating the whole ordeal.”</p><p>You examine the photos, ignoring Bolívar’s annoyed glare. It’s obvious that his career is on the line, but you cannot let the frustration of one man get in the way of your investigation. If the police get to the Girl in the Carmine Coat before you do, the best case scenario is that it will be tougher for you to get the information you need from her. Worst case scenario, it will only put them all in danger. Better for you to be the one to confront her.</p><p>You tell Oficial Bolívar that his team is to stay out of your way while you conduct your own investigation. Furthermore, you must be the one to question her if she is taken into custody—not the police. He lets out a sigh and shakes his head. “Do what you’re gonna do. Won’t be my head on the chopping block this time.” You get the feeling that Bolívar doesn’t think you can pull this off, but unlike him, you understand what you’re truly up against…though you still don’t know why. You take his documents and begin to brew a plan.</p><ul><li>Remember that “Matias Bolívar doesn’t trust you.”</li><li Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li></ul><p class='basic right'>Proceed to _Setup_.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: Sanguine Shadows, Dark Veiling, Mysteries Abound, Shadow of a Doubt, Strange Happenings, Locked Doors, and Nightgaunts. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/sanguine-shadows.png' /><img src='{setImgPath}/dark-veiling.png' /><img src='{setImgPath}/mysteries-abound.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /><img src='{setImgPath}/strange-happenings.png' /><img src='{setImgPath}/locked-doors.png' /><img src='{setImgPath}/nightgaunts.png' /></section>",
          "decks": "Build the agenda deck using only agenda 1 and the act deck using only acts 1 and 2.",
          "placeStart": "Put the Avenida de Mayo location into play.",
          "beginPlay": "Each investigator begins play at Avenida de Mayo.",
          "placeRemaining": "Choose one of the seven remaining locations at random, and remove it from the game. Put the other six locations into play, surrounding Avenida de Mayo",
          "placeTargets": "Place one resource on each location in play other than Avenida de Mayo, as targets. (*There should be six targets, in total*).",
          "targets": "These targets represent the locations you suspect La Chica Roja is looking to steal from.",
          "miniCards": "Gather each decoy mini-card and each of the following mini-cards: La Chica Roja and Apportioned Ka. Set them aside, out of play.",
          "laChicaRoja": "Find the double-sided La Chica Roja card, flip her to her enemy side, and resolve her concealed keyword.",
          "setAside": "Set the following cards aside, out of play: The Sanguine Watcher enemy, the Apportioned Ka enemy, the Seeing Red act/agenda, and The Weeping Lady key."
        },
        "interlude": {
          "label": {
            "believe": "“I believe you.”",
            "doNotBelieve": "“I’m sorry, but I cannot believe you.”"
          },
          "title": "Interlude: Cast a Light",
          "castALight1": "<p>_Cast a Light 1_: La Chica Roja paces around you in a slow circle as you claim her prize. “You’re good,” she concedes with a playful smirk. “But you’re workin’ for the wrong people. You know that, right?”</p><p>You tell her to stand down and turn herself over for questioning. She steps into the shadows, obscuring her face, but you can tell from her tone that she hasn’t stopped smiling.</p>",
          "checkTargets": "Check the targets in play and the Campaign Log.",
          "noTargets": "If there are no targets on La Chica Roja, proceed to _Cast a Light 2_.",
          "otherwise": "Otherwise, skip to _(→R1)_.",
          "castALight2": "<p>_Cast a Light 2_: You prepare for a lengthy chase, ready to take her down at any cost…but to your surprise, she reaches out and flicks the lamp switch next to her, bathing the room in an orange glow. She stands exposed in the lamplight, for once not fleeing or ducking into the shadows. “Bien entonces, la cana. Let’s talk, gumshoe.”</p><p>You’re not with the police, you insist. “I suppose that much is obvious. I don’t see that fool Bolívar anywhere. But if that’s truly the case, then who do you work for?” she asks. “You know what, nevermind that. You seem to know who I work for, don’t you? Well then, surely you must know there are two of us operating in Buenos Aires. Why aren’t you after the other guy?”</p><p>Your confusion must show on your face. After a beat, La Chica Roja grins. “Oh, so that’s how it is. You, my friend, have outdated information.” You ask if she is using the stolen art pieces to assemble a Key, as the Foundation’s intel suggested. “Key? Oh, I see. You call them ‘Keys.’ Well, yes, that much is true. But you’re missing the why.”</p><p>The Girl in the Carmine Coat paces through the room, stepping in and out of countless shadows. “The other guy. ‘The Sanguine Watcher,’ they call him. Nobody knows his real name.” She takes off her hat and runs her finger along its scarlet hatband before using it to mask her countenance. “Just like me, I guess. Nameless. Faceless.” Then she rolls it back onto her head with a chuckle. “Only, el observador sanguinario ain’t like me. He’s already got his hands on more than a few pieces. Even with just those, he’ll use it only out of cruelty and malice. Human experimentation. Spellcraft. Real creepy stuff. He gets the rest of ‘em, who knows what he’ll do with them. My associates tend to thrive on that kind of thing. But not me.” Her fierce brown eyes lock with yours, soft and steely all at once. “I came here to stop him.”</p><p class='basic'>The lead investigator must decide (choose one):</p><ul><li>“I believe you.” Proceed to _Cast a Light 3_.</li><li>“I’m sorry, but I cannot believe you.” Skip to _Cast a Light 4_.</li></ul>",
          "castALight3": "<p>_Cast a Light 3_: “Good. Then let’s take that bastardo down together. Just help me out and I promise I’ll disappear. You can even keep your stupid ‘Key.’ Just so long as my…colleague…doesn’t get his hands on it.” The vitriol in her voice is palpable. Whoever this Sanguine Watcher is, she really seems to hate him.</p><p>You ask her how she intends to take him down. “Before you showed up? I wouldn’t stand a chance. But together? I think we can figure something out.” She motions toward the window and points toward the sky, reaching down to unfurl a curtain of shadows draped over what looked like a starless night. The darkness peels back, revealing a scarlet-red sky. “His mark. Been keeping it hidden for a while now so nobody panics. See, he’s got all these rituals tainting the city—including the one protecting his life. Gruesome stuff. Pulls out his own organs and hides them so he can’t be killed. We find ‘em, I guarantee he’ll turn rabbit.”</p>",
          "trustsYou": "If “Matias Bolívar trusts you,” skip to _Cast a Light 5_.",
          "doesNotTrustYou": "If “Matias Bolívar doesn’t trust you,” skip to _Cast a Light 6_.",
          "neither": "If neither of the above are true, skip to _Cast a Light 7_.",
          "castALight4": "<p>_Cast a Light 4_: You tell La Chica Roja that she spins an intriguing tale, but you still cannot trust her. She lets out a sigh, grins, and flicks the nearby lamp switch again, filling the room once more with darkness. “Then I guess I’ll see you around, idiota.” _(→R1)_.</p>",
          "castALight5": "<p>_Cast a Light 5_: You nod and get ready to move out when all of a sudden, the door behind you bursts open. Oficial Bolívar, flanked by two other polícia, levels a handgun in your direction. The Girl in the Carmine Coat grabs your hand. “You!” Bolívar shouts. “I trusted you! I should have known better.” You start to explain, but he cuts you off. There is real hurt behind his eyes. “You can explain yourself down at the station! Bring ‘em in, boys!”</p><p>“That’s our cue,” your erstwhile quarry says in a singsong voice. She then leaps out of the window, pulling you along with her. A hail of bullets follow in your wake. There is a whirl of shadows and crimson, and the next thing you know, you are floating gracefully to the ground aloft a wispy cloud of darkness. “Quick!” La Chica Roja shouts. “Follow me!”</p><p class='basic right'>Skip to _Cast a Light 7_.</p>",
          "castALight6": "<p>_Cast a Light 6_: You nod and get ready to move out when all of a sudden, the door behind you bursts open. Oficial Bolívar, flanked by two other polícia, levels a handgun in your direction. The Girl in the Carmine Coat grabs your hand. “You!” Bolívar shouts. “I knew you couldn’t be trusted! On her side all along, were you?” You start to explain, but he cuts you off. “Like I can trust a single word you say? No, I think not. Bring ‘em in, boys!”</p><p>“That’s our cue,” your erstwhile quarry says in a singsong voice. She then leaps out of the window, pulling you along with her. A hail of bullets follow in your wake. There is a whirl of shadows and crimson, and the next thing you know, you are floating gracefully to the ground aloft a wispy cloud of darkness. “Quick!” La Chica Roja shouts. “Follow me!”</p><p class='basic right'>Proceeed to _Cast a Light 7_.</p>",
          "castALight7": "<p>_Cast a Light 7_: You and the Girl in the Carmine Coat have teamed up to take down the true threat in Buenos Aires!</p><ul><li>Flip La Chica Roja to her story asset side, removing all tokens and attachments from her, and choose an investigator to take control of her.</li><li>Remove the agenda and act decks from the game. Put the set-aside Seeing Red act/agenda into play. It is both the current act and the current agenda.<ul><li>Place 1 doom on Seeing Red.</li></ul></li><li>Randomly choose a location with a target on it. Spawn The Sanguine Watcher at that location. Remove all other targets from locations in play.</li><li>Find the set-aside Apportioned Ka enemy and resolve its concealed keyword, distributing its 5 concealed mini-cards as evenly as possible among each non-_*Central*_ location that does not have a target.</li><li>Shuffle the encounter discard pile into the encounter deck.</li><li>You are now ready to continue playing.</li></ul>"
        },
        "resolutions": {
          "xp": {
            "bonus": {
              "insight": "Gained insight into the inner workings of the Red Coterie.",
              "targets": "For each target that was on the scenario reference card when the scenario ended"
            }
          },
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated) and it is act 1 or 2_: The night crawls on, but you cannot continue your investigation. Between the terrible winged creatures that haunt your every step and the cunning tricks of your target, you won’t last the night if you go any further. You have no choice but to retire, knowing that you’ve failed to stop La Chica Roja’s schemes.</p><ul><li>Skip to _Resolution 3_.</li></ul>"
          },
          "noResolutionSeeingRed": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated) and the current act/agenda is “Seeing Red”_: A crack of thunder heralds a scarlet storm that covers your escape. You and La Chica Roja tried your best to take down the Sanguine Watcher, but his spell of protection was too powerful, his weak points too well hidden. You retreat to your new ally’s safehouse to lick your wounds, but you can’t stay long. “We have to flee the city,” she says bitterly. “Won’t be long before he finds us. I guarantee you wouldn’t like what that heartless bastard would do to us if he does…” You are loath to let him win, but you have no choice. Even with the pieces you’ve found, he has enough remnants himself to assemble the Key. You ask your new ally what she will do now. She responds with a tip of her hat. “Oh, I’ll be around. You helped me out back there. Don’t worry. I’ll pay you back.” With a twirl of her coat, she is gone.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display. Each investigator earns 3 bonus experience, as they gain insight into the inner workings of the Red Coterie.</li><li>In your Campaign Log, record *The Sanguine Watcher’s torment continues*.</li><li>In your Campaign Log, record *La Chica Roja is on your side*.</li><li>The Sanguine Watcher is the bearer of The Weeping Lady. Update the Campaign Log accordingly.</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: You rush to apprehend your quarry, but with a twirl of shadows, she has vanished. It is as if she was a trick of the light all along—the same kind of mischief mirrored in Oficial Bolívar’s reports. Thankfully, you now possess enough of what she was after to put it together yourself. It takes some time and research, but eventually you are able to slot the various pieces of what you originally assumed to be art together. To your surprise, the result is an ornate figurine of a woman in robes. Tears, carved as thin lines like bloody scars, trail down the figure’s cheeks. With your new prize in tow, you report back to Oficial Bolívar the next day. He is more than a little miffed that his enemy escaped his grasp, but relieved that her campaign of thievery is finally at an end. “I warned you she would get away,” he says between sips of his espresso. “As far as my superiors are concerned, the book is closed on this one. Won’t look good on my record, but as long as she’s fled the city like you say, I am content with that.” You thank him again for his help and prepare to leave Buenos Aires behind.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display. Each investigator earns 1 bonus experience for each target that was on the scenario reference card when the scenario ended.</li><li>In your Campaign Log, record *you haven’t seen the last of La Chica Roja*.</li><li>Choose an investigator to be the bearer of The Weeping Lady and update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: Your erstwhile adversary watches in grim silence as her rival is safely borne aloft on wings of darkness. “Damned things,” she spits. “They’ll follow whoever whistles loudest, I guess.” You ponder aloud what this means for the two of you. With the Sanguine Watcher out of the way, you wonder if she will keep her word. To your relief, she smirks and hands you the remaining pieces of the Key you’d both been competing for. “This is what you’re really after, isn’t it? Here. My main goal was only making sure that ojete en una nube de pedos didn’t get his hands on it. I trust it in your hands.” She then shows you how to fit the various pieces together and, to your surprise, the result is an ornate figurine of a woman in robes. Tears, carved as thin lines like bloody scars, trail down the figure’s cheeks. “The Rubicund Statuette,” she reveals, “also known as the Weeping Lady.” You ask what she will do now, and she responds with a tip of her hat. “Oh, I’ll be around. You helped me out back there. Don’t worry. I’ll pay you back.” With a twirl of her coat, she is gone.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display. Each investigator earns 3 bonus experience, as they gain insight into the inner workings of the Red Coterie.</li><li>In your Campaign Log, record *you haven’t seen the last of The Sanguine Watcher*.</li><li>In your Campaign Log, record *La Chica Roja is on your side*.</li><li>Choose an investigator to be the bearer of The Weeping Lady and update the Campaign Log accordingly.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: Oficial Bolívar was right: the Girl in the Carmine Coat chewed your investigation up and spat you out. You meet with him the next day, and the air is one of deadened frustration. “I warned you, did I not?” He says between sips of an espresso that looks and smells about as dark and bitter as his mood. “This puts me in a precarious position. La Chica Roja has gone to ground, from what we can tell. As far as my superiors are concerned, the book is closed on this one. I cannot help you any further.” He groans. “If I even still have a job when this is all over.” You give Oficial Bolívar your assurances that you did all you could to catch the thief, but he waves you off. “Oh, I am sure. Does not matter now, does it? What is done is done. I give up. She wins.” You thank him again and prepare to leave Buenos Aires behind.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display. Each investigator earns 1 bonus experience for each target that was on the scenario reference card when the scenario ended.</li><li>In your Campaign Log, record *you haven’t seen the last of La Chica Roja*.</li><li>La Chica Roja is the bearer of The Weeping Lady. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "档案#16-D",
        "ui": {
          "lastKnownLocation": "最后已知地点"
        },
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为本卡牌上的标的数量。",
            "cultist": "-5。如果你检定失败且低于难度至少2点，将你所在地点和每个连接地点的所有隐匿迷你卡牌正面朝下混洗，然后随机放置到其刚才位置。",
            "tablet": "-1。取消投入本次技能检定的每张卡牌上的效果和图标。",
            "elderThing": "-2。如果你检定失败，你必须在当前密谋上放置1个毁灭标记，或最近的_同志会_敌人攻击你*(即便其在阴影中)*。"
          },
          "hardExpert": {
            "skull": "-X。X为本卡牌上的标的数量+1。",
            "cultist": "-7。如果你检定失败且低于难度至少2点，将你所在地点和每个连接地点的所有隐匿迷你卡牌正面朝下混洗，然后随机放置到其刚才位置。",
            "tablet": "-2。取消投入本次技能检定的每张卡牌上的效果和图标。",
            "elderThing": "-3。如果你检定失败，你必须在当前密谋上放置1个毁灭标记，或最近的_同志会_敌人攻击你*(即便其在阴影中)*。"
          }
        },
        "label": {
          "coterieAttack": "最近的_同志会_敌人攻击你*(即便其在阴影中)*"
        },
        "tooltips": {
          "avenidaDeMayo": {
            "resign": "看来这次是红衣女郎赢了。"
          }
        },
        "remembered": {
          "matiasBolivarTrustsYou": "马蒂亚斯·玻利瓦尔信任你",
          "matiasBolivarDoesntTrustYou": "马蒂亚斯·玻利瓦尔不信任你"
        },
        "intro": {
          "label": {
            "everything": "把你知道的一切都告诉玻利瓦尔。",
            "breadcrumbs": "告诉玻利瓦尔一点边角料。",
            "insist": "坚持玻利瓦尔先把他的知道的告诉你。"
          },
          "title": "档案#16-D: 血色阴影",
          "intro1": "<p class='file'> 你一到布宜诺斯艾利斯，就在一家俯瞰港口的咖啡馆和玻利瓦尔警官会面。远方无数渔舟船舶，传来阵阵海鸥的鸣叫。即便玻利瓦尔已经抵达，你还是盯着耳力范围内的人——尤其是着红衣的。警官没穿便装，而是一身制服地来了——至于这是规定，还是他刚加班结束，你就不知道了。他对你的来信似乎非常热情。兴许他也和你一样，急切需求目标的有关消息？“你的信中说我们可以合作。”他跟服务员点单后随意一提，“关于红衣女郎，你有什么信息？”</p><p>你说自己是来找他寻求信息，而非提供信息。“好吧，互帮互助。”他说着表情严肃起来，“你都知道些什么？”</p><p class='basic'>调查员必须决定（选择一项）：</p><ul><li>把你知道的一切都告诉玻利瓦尔。</li><li>告诉玻利瓦尔一点边角料。</li><li>坚持玻利瓦尔先把他的知道的告诉你。</li></ul>",
          "intro2Part1": "<p class='file'>你决定坦诚相待。你怀疑他并不会相信你关于外星生物和神秘组织的故事，但你至少能告诉他有关“红衣女郎”的事情。他琢磨着你给出的信息，花了一分钟时间消化。“唔……所以你真的相信红衣女郎有这些……能力……？”你告诉他你十分确定。尽管这一切难以置信，但玻利瓦尔理解真实情况十分重要。“我知道，我就知道！”他咧开嘴笑了，“当然啦！这样就说得通了。为什么她能凭空消失，那么快速地行进……”你其实没指望他相信你，但现在看来你提供的信息证实了他的猜测。“那你们打算怎么帮我们抓住她呢？”</p><p>你告诉玻利瓦尔你打算独自擒拿这名女贼。你只要他提供有关信息，告诉你红衣女郎在布宜诺斯艾利斯的目标和下落。他从文件夹里取出几张布宜诺斯艾利斯建筑的照片交给你。“红衣女郎盗窃和诈骗的行径遍布整个布宜诺斯艾利斯。她偷取的艺术品和宝物价值数十万比索。”他依次指过每张照片，“玫瑰宫、伊拉祖里兹宫、哥伦布剧院。哪里都有人看到她，但无论我们怎么努力，总归无法抓她个现行。上头那些人，怎么说呢……对事态的发展……不太高兴。”他说话结巴起来，一边看向别处，抓着自己的手背。你很清楚玻利瓦尔的饭碗已是危在旦夕了，但你也清楚，这件事远比他的饭碗重要得多。“她似乎就是把我们玩弄于掌心，在嘲弄我们。”他沮丧地敲了敲桌子，“一边屡屡得手，一边让我们像个傻瓜。”</p>",
          "criminal": "<p class='red'>_*仅当有调查员具备“罪犯”特性才能阅读：*_要论她的动机，别人知之甚少，只有你清楚一点。要是她想卖出偷来的遗物，这样的交易肯定会在黑市上留下证据。要是失主赎回赃物，她兴许还能赚得更多。不过，你怀疑同志会可能不只是为了钱财，这些赃物肯定还有其他价值。</p>",
          "intro2Part2": "<p>你告诉玻利瓦尔你会帮他找到深红外套的女孩，但没有他帮你调查可办不到。“当然了。”他咧嘴笑了，“要是这样就能把她捉拿归案，那我必当竭尽所能。”你和他握了手，计划初定。</p><ul><li>记住“马蒂亚斯·玻利瓦尔信任你。”</li><li>从混乱袋中移除1个{'{'}elderThing{'}'}标记，并加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li></ul><p class='basic right'>进入_冒险设置_。</p>",
          "intro3": "<p class='file'>出于外交考量，你决定告诉玻利瓦尔一些“红衣女郎”无关紧要的信息，但也到此为止了。你不能冒险泄漏更多真相。就让警察以为深红外套的女孩不过是个技艺精湛的盗贼吧。“你就知道这些？”他怀疑地问道，“我还以为你的到来会意味着……好吧。毕竟她确实是一团谜。那你打算怎么帮我们抓住她呢？”</p><p>你告诉玻利瓦尔你打算独自擒拿这名女犯。你只要他提供有关信息，告诉你红衣女郎在布宜诺斯艾利斯的目标和下落。他从文件夹里取出几张布宜诺斯艾利斯建筑的照片交给你。“红衣女郎盗窃和诈骗的行径遍布整个布宜诺斯艾利斯。她偷取的艺术品和宝物价值数十万比索。”他依次指过每张照片，“玫瑰宫、伊拉祖里兹宫、省立银行。哪里都有人看到她，但无论我们怎么努力，总归无法抓她个现行。上头那些人，怎么说呢……对事态的发展……不太高兴。”他说话结巴起来，一边看向别处，抓着自己的手背。你很清楚玻利瓦尔的饭碗已是危在旦夕了，但你也清楚，这件事远比他的饭碗重要得多。“她把我们玩弄于掌心，她也会这么对你。把你的调查当一盘小菜吃了，再把你吐出来。”</p><p>你向玻利瓦尔警长保证自己能抓住她，但他最好不要干涉。“要是这样就能把她捉拿归案，我很乐意让你独自行事。”他同意道，你和他握了手，计划初定。</p><p class='basic right'>进入_冒险设置_。</p>",
          "intro4": "<p class='file'>你们握了手，但这并不意味着你们达成了协议——无论如何，你不能让玻利瓦尔和他的调查阻碍到你。“要是你拒绝帮忙，我怎么会跟你合作？”</p><p>你拿出一封泰勒特工交予你的信，提给了玻利瓦尔。他小心翼翼地缓缓打开，眼睛一直盯着你。他没花多少时间就读完了信，然后一把折起，在桌上推回给你。“去你的。”他说道。你又问了一遍，问他对红衣女郎在布宜诺斯艾利斯的目标和下落都知道些什么。他从文件夹里取出几张布宜诺斯艾利斯建筑的照片，在桌上推给了你。“红衣女郎盗窃和诈骗的行径遍布整个布宜诺斯艾利斯。她偷取的艺术品和宝物价值数十万比索。”他依次指过每张照片，“玫瑰宫、伊拉祖里兹宫、省立银行。哪里都有人看到她，但无论我们怎么努力，总归无法抓她个现行。现在你来了，这烂摊子就算齐活了。”</p><p>你没管玻利瓦尔愤怒的眼神，仔细检查照片。显然玻利瓦尔的饭碗已是危在旦夕了，但此人的沮丧可不能阻止你的调查。要是警察抢在你前面抓住了深红外套的女孩，那你想从她那里问出想要的信息可就难了——而这还算是好的。倘若不幸，警察们就危在旦夕。最好还是由你直面红衣女郎。</p><p>你告诉玻利瓦尔，自己要继续调查了，而他手下的人最好别挡你的路。此外，要是能将女犯捉拿归案，必须由你——而不是警察，来进行问讯。他叹了口气，摇了摇头：“你想干什么就去吧。反正这次不是我背锅了。”你感觉玻利瓦尔并不相信你能搞定这一切，但你和他不同，你知道自己要面对的是什么……尽管你可能并不知道为何。你拿起他的文件，计划初定。</p><ul><li>记住“马蒂亚斯·玻利瓦尔不信任你”。</li><li>从混乱袋中移除1个 {'{'}tablet{'}'}标记，并加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li></ul><p class='basic right'>进入_冒险设置_。</p>"
        },
        "setup": {
          "gatherSets": "收齐以下遭遇组的所有卡牌：*血色阴影*、*黑暗笼罩*、*处处神秘*、*重重疑云*、*奇异现象*、*上锁的门*、*夜魔*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/sanguine-shadows.png' /><img src='{setImgPath}/dark-veiling.png' /><img src='{setImgPath}/mysteries-abound.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /><img src='{setImgPath}/strange-happenings.png' /><img src='{setImgPath}/locked-doors.png' /><img src='{setImgPath}/nightgaunts.png' /></section>",
          "decks": "只使用密谋1创建密谋牌库；只使用场景1和2创建场景牌库。",
          "placeStart": "将五月大道地点放置入场。",
          "beginPlay": "每位调查员从五月大道开始游戏。",
          "placeRemaining": "在剩余的七个地点中随机选择一张，将其从游戏中移除。将其他六个地点放置入场，呈环形围绕五月大道。",
          "placeTargets": "在场上除五月大道的每个地点上各放置一个资源，作为标的。*(总共应有六个标的)*。",
          "targets": "这些标的代表了你怀疑红衣女郎要偷窃的地点。",
          "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：红衣女郎和分裂精魂。将这些卡牌放在一边，位于场外。",
          "laChicaRoja": "找到双面的红衣女郎卡牌，将她翻至敌人面，结算其隐匿关键词。",
          "setAside": "将下列卡牌放在一边，位于场外：血色监视者敌人、分裂精魂敌人、见红场景/密谋、恸哭女士钥匙。"
        },
        "interlude": {
          "label": {
            "believe": "“我相信你。”",
            "doNotBelieve": "“抱歉，但我不能相信你。”"
          },
          "title": "冒险幕间故事：云开见日",
          "castALight1": "<p>你将红衣女郎想要的东西捏在手里，而她绕着你缓缓兜着圈子。“你真不赖。”她带着一个值得玩味的笑容坦言道，“但你卖命的对象错了。你自己也知道，嗯？”</p><p>你让她乖乖投降，接受盘问。她却遁入暗影，面目已不可辨，但从她的声音听来，你知道她一直在笑。</p>",
          "checkTargets": "检查场上的标的和剧本日志。",
          "noTargets": "红衣女郎上没有标的。",
          "otherwise": "并非上述情况(→_结局1_)",
          "castALight2": "<p>你准备继续追逐，不惜一切代价，不管再花多久，也要抓住她……但惊讶的是，她居然主动出来了，按下了身边的电灯开关，整座屋子顿时笼罩在橘光之中。她站在灯下，第一次没有逃跑，没有遁入阴影。“好吧。那我们就谈谈吧，小侦探。”</p><p>你坚持自己并非警方。“我想这也确实很明显。我没瞧见傻瓜玻利瓦尔。但要是这样，你又是在给谁卖命呢？”她问道，“算了，不重要。你看起来像是知道我再给谁卖命，嗯？那么，你肯定知道我们是两个人在布宜诺斯艾利斯活动了。你干吗不去追另一个家伙？”</p><p>你的心事肯定都写在脸上了。红衣女郎片刻后笑了：“噢，我明白了。朋友，你的情报已经过时了。”根据基金会提供的情报，你问她是不是要偷取这些碎片组合成一个钥匙。“钥匙？哦，我明白了，你把它们叫做‘钥匙’。好吧，这部分是不假。但你不知道原因。”</p><p>深红外套的女孩穿过房间，在不计其数的阴影中若隐若现。“至于另一个家伙，他被称作‘血色监视者’。没人知道他的真名。”她摘下帽子，指尖在红色的缎带上划过，然后再拿帽子挡住了脸。“我想，就和我一样，没有名字，没有面容。”她随即将帽子抛回头顶，笑了。“不过，血色监视者可不像我，他已经将好几块碎片纳入囊中。有了这些东西，他就会将其用于残忍的恶行。人体实验、邪恶法术，都是可怕的东西。要是他把剩下的也拿在手里，鬼知道他能干出什么事来。我的同事可能会以此为乐，但我不会。”她炽烈的棕眼紧盯着你，既有柔情，又有几分决绝。“我是来阻止他的。</p><p class='basic'>调查员队长必须决定(选择一项)：</p><ul><li>“我相信你。”</li><li>“抱歉，但我不能相信你。”</li></ul>",
          "castALight3": "<p>“好。那就让我们一起搞定这混账。帮我一把，我保证以后不再出来。你甚至可以留着你的蠢‘钥匙’。只要我的……同事……不会染指它。”她的声音里明显带着一股尖酸。无论这个“血色监视者”是谁，都显然惹她恨极了。</p><p>你问她打算怎么解决。“在你出现前？我一点儿机会也没有。但要是一起合作？我想咱们能办到。”她移到窗边，拉开仿若无星之夜的阴影大幕，指着天上，黑色褪去，露出猩红的天空。“这是他的记号。之前一直藏着，所以没人害怕。看，他用这些仪式腐化了整座城——其中有个仪式能保护他的生命。真是可怕。他将自己的器官取出来藏起来，这样就不会被杀了。要是能找到，我保证他会不战而逃。”</p>",
          "trustsYou": "马蒂亚斯·玻利瓦尔信任你",
          "doesNotTrustYou": "马蒂亚斯·玻利瓦尔不信任你",
          "neither": "并非上述两种情况",
          "castALight4": "<p>你告诉红衣女郎她编造的故事很像真的，但你还是不信任她。她叹息一声，笑了，又按下身边的开关，黑暗重新笼罩了房间。“我想咱们还会再见面的，蠢货。”(→_结局1_)</p>",
          "castALight5": "<p>你点点头，正准备出去，但身后的门突然给推开了。玻利瓦尔警长带着两个警察举枪对着你。深红外套的女孩抓住了你的手。“你！”玻利瓦尔吼道，“我是那么相信你！我早该知道的。”你试图解释，但被他打断，从他的眼神来看，他确实被你伤到了。“你还是回局子里解释吧！兄弟们，拿下他们！”</p><p>“这话该我们来说。”你之前的猎物话音如歌，她拉着你从窗子跳了出去。枪林弹雨划过你们身侧。一阵阴影与猩红的漩涡，你随即发现自己驾着一片乌云优雅地飘到了地上。“快点！”红衣女郎叫道，“跟着我！”</p>",
          "castALight6": "<p>你点点头，正准备出去，但身后的门突然给推开了。玻利瓦尔警长带着两个警察举枪对着你。深红外套的女孩抓住了你的手。“你！”玻利瓦尔吼道，“我就知道不能相信你！你一直都是跟她一伙儿的！”你试图解释，但被他打断，“你以为我会信你说的一个字？别做梦了。兄弟们，拿下他们！”</p><p>“这话该我们来说。”你之前的猎物话音如歌，她拉着你从窗子跳了出去。枪林弹雨划过你们身侧。一阵阴影与猩红的漩涡，你随即发现自己驾着一片乌云优雅地飘到了地上。“快点！”红衣女郎叫道，“跟着我！”</p>",
          "castALight7": "<p>现在你跟深红外套的女孩联手，要清除布宜诺斯艾利斯的真正威胁！</p><ul><li>将红衣女郎翻至她的剧情支援面，移除她的所有标记和附属，并选择一位调查员控制她。</li><li>将密谋牌库和场景牌库从游戏中移除。将放在一边的见红场景/密谋放置入场。它既是当前场景也是当前密谋。<ul><li>在见红上放置1个毁灭标记。</li></ul></li><li>随机选择一个有标的的地点。将血色监视者生成在该地点。移除场上所有其他地点的标的。</li><li>找出放在一边的分裂精魂敌人，结算其隐匿关键词，在每个没有标的的非*中心*地点中，尽可能平均地分发其5张隐匿迷你卡牌。</li><li>将遭遇弃牌堆洗入遭遇牌库。</li><li>你现在可以继续游戏了。</li></ul>"
        },
        "resolutions": {
          "xp": {
            "bonus": {
              "insight": "洞见了红色同志会的内部运作",
              "targets": "在冒险结束时，冒险参考卡牌上的标的数量"
            }
          },
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败)且是场景1或2：_夜幕仍续，但你已无法调查下去。你每行一步，都有可怕的带翼生物在追，你的目标更有层出不穷的诡计。要是一意孤行，你将撑不过今晚。你别无选择，只能撤退，知道自己没能阻止红衣女郎的阴谋。</p><ul><li>跳到_结局3_。</li></ul>"
          },
          "noResolutionSeeingRed": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败)且当前场景/密谋是“见红”：_ 一声炸雷，随后猩红的风暴挡住了你的逃生之路。你和红衣女郎用尽一切办法，试图打倒血色监视者，但他的邪恶法术太过强大，他的弱点藏得太好。你逃到新朋友的藏身之处包扎伤口，但你也不能在此处停留太久。“我们得逃出这座城。”她恨恨地说道，“他要不了多少时间就会找上我们。你肯定不想看到这无情的混账会干出什么事来……”让他赢下一城你痛心疾首，但你别无他法。即便你找回了几块碎片，他也足够用剩下的组装钥匙。你问新朋友她现在打算怎么办。她歪了歪帽子，以示回应：“噢，我不会走远的。你在这儿帮了我一把。别担心，我会给你回报的。”她的外套卷起一阵旋风，她不见了。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。每位调查员取得3点奖励经验值，因为其洞见了红色同志会的内部运作。</li><li>在剧本日志中，记录下*血色监视者造成的苦难未止*。</li><li>在剧本日志中，记录下*红衣女郎站在你这一边*。</li><li>血色监视者拥有恸哭女士，相应更新在剧本日志中。</li><li>在剧本日志中记2_时间_。你可以_启程_。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 你准备冲上去逮捕猎物，但她消失在一阵阴影之中。她仿佛就是个光影的把戏——就像玻利瓦尔警长提到的狡猾镜像。幸亏你抢在她前头找到了足够的碎片。你花了些时间研究，照着自己的想法成功将碎片归位到原本的位置。出乎意料的是，你最终拼出来的居然是一件精巧的雕塑，雕的是一位披着长袍的女子。她的脸颊上滴下泪水，仿佛刻上去的血痕。翌日，你带着自己的成果去见玻利瓦尔警长。他得知自己的对手逃出手心，不禁有些恼火。但得知窃案已经终结，又不禁松了口气。</p><p>“我说过她会逃的。”他慢饮着意式浓缩说道，“按上头的意思，这案子就算结了。记录上对我是不好看，但她要是真跟你说的一样已经离开这座城了，那我也算满意。”你再次谢过他的帮助，打算动身离开布宜诺斯艾利斯。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。在冒险结束时，冒险参考卡牌上每有一个标的，每位调查员取得1点奖励经验值。</li><li>在剧本日志中，记录下*你和红衣女郎之间恩怨未了*。</li><li>选择一位调查员拥有恸哭女士，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 你的旧敌望着自己的对手乘着黑暗之翼安全离去，阴沉得一言不发。“去他妈的。”她啐道，“我猜谁哨吹得最响，这群怪物就听谁的。”你一边想着，一边问她这意味着什么。血色监视者已经离开，你要知道她是否还会信守自己的承诺。她笑着将之前争夺不休的钥匙碎片都交给了你，这让你松了口气。“你想要的不就是这个吗？拿着。只要这个臭屁混账拿不到，我就满意了。在你手里我还放心点。”她告诉你如何将这些碎片拼装起来。出乎意料的是，你最终拼出来的居然是一件精巧的雕塑，雕的是一位披着长袍的女子。她的脸颊上滴下泪水，仿佛刻上去的血痕。“鲜红小像。”她解释道，“也叫恸哭女士。”你问她现在打算怎么办。她歪了歪帽子，以示回应：“噢，我不会走远的。你在这儿帮了我一把。别担心，我会给你回报的。”她的外套卷起一阵旋风，她不见了。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。每位调查员取得3点奖励经验值，因为其洞见了红色同志会的内部运作。</li><li>在剧本日志中，记录下*你和血色监视者之间恩怨未了*。</li><li>在剧本日志中，记录下*红衣女郎站在你这一边*。</li><li>选择一位调查员拥有恸哭女士，相应更新在剧本日志中。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 玻利瓦尔警长一点没错：深红外套的女孩把你的调查当一盘小菜吃了，再把你吐了出来。你第二天和他碰头，气氛是死一般的沮丧。“我警告过你的啊。”他慢饮着意式浓缩，那东西看起来闻起来都跟他此刻的情绪一样糟糕。“这下我的处境真是不妙。看来红衣女郎早就溜了。按上头的意思，这案子就算结了。我也帮不了你什么了。”他发了句牢骚，“哪怕完了之后我还没有走人。”你向玻利瓦尔保证，你已经尽力抓贼了。但他挥挥手，让你别说了。“哦，肯定啊。但这又有什么用呢？事已至此。我投降，她赢了。”你再次谢过他，打算动身离开布宜诺斯艾利斯。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。在冒险结束时，冒险参考卡牌上每有一个标的，每位调查员取得1点奖励经验值。</li><li>在剧本日志中，记录下*你和红衣女郎之间恩怨未了*。</li><li>红衣女郎拥有恸哭女士，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 62,
        "missing": 0,
        "untranslated": 0,
        "present": 62,
        "specialRules": 0
      }
    },
    "dealingsInTheDark": {
      "id": "dealingsInTheDark",
      "name": "暗中交易",
      "nameEn": "Dealings in the Dark",
      "referenceCode": "09566",
      "file": "scenarios/dealingsInTheDark.json",
      "sectionsEn": {
        "heading": "File #21–F",
        "specialRules": [
          {
            "title": "Location Adjacency in the Grand Bazaar",
            "body": "<p class='basic'>This scenario’s 4 starting locations are arranged as shown above, and are connected through their connection symbols. Later during the scenario, the investigators will be instructed to put Grand Bazaar locations into play. Each Grand Bazaar location is connected to each Grand Bazaar location adjacent to it.</p><ul><li>Adjacent locations share a side in common (left, right, above, or below). Locations that share only a corner are not adjacent.</li></ul>"
          },
          {
            "title": "Acolyte Concealed Mini-cards",
            "body": "<p class='basic'>The first agenda of this scenario causes each Cultist enemy, including those from the Core Set, to gain the concealed keyword. Since the three Acolytes from the Core Set are not labeled as A, B and C, when resolving their concealed keyword, use any of the Acolyte (any) mini-cards along with their decoy. Likewise, when an “Acolyte (any)” mini-card is exposed, the exposing investigator may choose any Acolyte in the shadows to engage.</p>"
          }
        ],
        "tokens": {
          "easyStandard": {
            "skull": "-X. X is the highest number of clues on a _Cultist_ enemy in play, to a maximum of 3. (If it is act 3, X is 3.)",
            "cultist": "-5. You may place 1 doom on the nearest _Cultist_ enemy to change this token's modifier to -1.",
            "tablet": "-3. If you fail, place 1 of your clues on your location.",
            "elderThing": "-2. If you fail, place 1 doom on the nearest _Cultist_ enemy."
          },
          "hardExpert": {
            "skull": "-X. X is the total number of clues on _Cultist_ enemies in play, to a maximum of 4. (If it is act 3, X is 4.)",
            "cultist": "-7. You may place 1 doom on the nearest _Cultist_ enemy to change this token's modifier to -3.",
            "tablet": "-4. If you fail, place 1 of your clues on your location.",
            "elderThing": "-2. Place 1 doom on the nearest _Cultist_ enemy."
          }
        },
        "ui": {
          "entrance": "Entrance",
          "eastGate": "East Gate"
        },
        "tooltips": {
          "grandBazaarJewelersRoad": {
            "investigate": "_Investigate_. If you succeed, instead of discovering clues, you may play a _Charm_ or _Relic_ asset from your hand, reducing its cost by 1 for each point you succeeded by (*to a minimum of 0*)."
          }
        },
        "label": {
          "agentsOfTheDark": {
            "cluesUnveiled": "Place 1 clue (*from the token pool*) on Clues Unveiled",
            "cultist": "Search the encounter deck and discard pile for a Cultist enemy and draw it"
          },
          "lightOutOfVoid": {
            "doom": "Place 1 doom on the _Cultist_ enemy in play with the highest evade."
          }
        },
        "intro": {
          "label": {
            "giveToEce": "“All right. We will find it and place it in your care.”",
            "giveToEceLying": "“All right. We will find it and place it in your care.” (You are lying.)",
            "takeForOurselves": "“We will track down this talisman, but we will be taking it into our custody.”"
          },
          "title": "File #21–F: Dealings in the Dark",
          "intro1Part1": "<p class='file'>_Intro 1_: Gulls cry out as you cross the Galata Bridge: what many would call the link between the traditional city of Constantinople, and the districts of Galata, Beyoğlu, Şişli and Harbiye, where a large proportion of foreign merchants and diplomats live and work. Since you know where you are headed, and time and secrecy are of the essence, you decide against hiring a translator, and head directly to the Süleymaniye Complex, where the target of your investigation—a Ms. Ece Şahin—supposedly works.</p><p>Ms. Şahin has made a name for herself in several fields of academia, specifically in the fields of antiquity and art history. According to your intel, she works as a curator in the recently established Turkish and Islamic Arts Museum, but to your surprise, your case files include a wealth of other information about Ms. Şahin, from her schooling all the way back to her early life. All of this points to one of two conclusions: either she is not in hiding like the other members of the Coterie, or she has crafted an extensive cover story.</p><p>According to your intel, Ms. Şahin has already reached out to the Foundation by way of an offer of introduction. It could be a trap, but if she truly wishes to meet, you can’t turn down such an opportunity. Thankfully, her office is not difficult to find, the door marked with her name and full title in Turkish and several other languages. You knock and she bids you to enter, which you do with much caution, eyes instinctively darting to every one of the room’s corners and hiding places.</p><p>The room is warm and richly decorated, the walls covered in beautiful tapestries and paintings of many styles ranging from hundreds of years old to very recent, and shelves filled to the brim with a variety of colorful ceramics, glassware, and old, musty texts. “Greetings,” Ms. Şahin says with a warm smile that seems to brighten the room. She is a young woman with dark tan skin, hazel eyes, and the wispy figure of one who has spent her entire life in academia. “What can I do for you?”</p><p>You inform Ms. Şahin that you received her “earlier communication” and her desire to meet with you, which she takes a moment to interpret before her eyes go wide.</p><p>“Oh! So you are—” she clears her throat and does not finish that train of thought. “I see. Then, in that case, please, sit down. We have much to discuss.”</p><p>You tell Ms. Şahin that she can start by explaining her involvement with the Coterie. Your eyes catch her shifting uncomfortably in her seat at the mention of the organization’s name.</p><p>“The Coterie is involved with a great many things all over the world, as you likely already know,” she says, choosing each word delicately, “but their— our—goals are not so different from your own. I have spent many years as a researcher for the organization, searching for the very same things your employers seek. Objects of arcane power that can be used to defend humanity from the threats we cannot see.”</p>",
          "key": "<div class='red'><p>_Read only if at least 1 key is bound to an investigator_: You reveal your Key and show it to Ms. Şahin, wondering if this is one of these artifacts she speaks of. “I see you are already in possession of one such object. Where did you acquire this?”</p><p>You tell Ms. Şahin that you recovered this Key before one of her colleagues could cause further harm with it.</p><p>“Key? Is that what you call them? Interesting. But not surprising. They have been called many things by many people throughout human history. Your terminology is apropos. They are the key to unlock power from other realms. Power enough to save the world, or to doom it.”</p></div>",
          "intro1Part2": "<p>Or to control humanity, you note aloud.</p><p>Ms. Şahin sighs. “You are not wrong. But I assure you not all of us within the Coterie would use them for such purposes. There are those, like myself, who wish only to use them for the good of others.”</p><p>You ask Ms. Şahin why you should trust her, given the actions of the Coterie in other places around the world.</p><p>“Ours is not an organization with a leader or a hierarchy,” she explains. “We operate independently in furtherance of a unified goal. But some…” she swallows hard with a shudder. “Some employ methods I do not agree with. Methods which disgust and, if I am being wholly honest, terrify me.”</p><p>You still don’t know if Ms. Şahin is telling the truth, but there’s no point in not hearing her out. You ask her what the situation in Constantinople is, and why she has sought an audience with the Foundation. “Istanbul,” she corrects you. “The people of Istanbul no longer refer to this city by that name.” You make a note to yourself to refer to the city only as Istanbul from here on out. “One of the relics you have been searching for is here, in Istanbul. It is one I have been seeking for many years, a talisman bound to a powerful entity, what some might call a ‘ jinni.’ Or in the traditional sense, the only kind of non-human entity with the capability to exercise free will.”</p><p>Judging from Ms. Şahin’s clinical definition, you wonder aloud if Ms. Şahin believes this to be true. “A jinni? No, I do not believe this talisman is bound to a jinni. I suspect its master is something even more powerful and inhuman. Something not of Earth at all. And the two of us are not the only ones looking for it. After the Great War and the dismantling of the Ottoman Empire, many records were thrown into chaos, but many more emerged from obscurity, including those pertaining to this talisman. The other group searching for it…the things they have done in search of this knowledge…” her face pales, and she struggles to keep her composure. “They’ll do anything to get their hands on it. Murder and torture are just tools to them. I hate to think of what sort of heinous acts these villains would commit if they managed to obtain it. And the worst part is, I believe one of my cohorts may be the one pulling the strings. I am so close to finding it, but if they find it first…”</p><p>You understand now why Ms. Şahin came to you—if one of the Coterie is behind this cult’s actions, she could not go to them with this information. Still, lingering doubt toils in your mind. “Please,” she pleads with you. “Find the talisman before this cult does. I do not wish to see what entity it is they worship. I’ll do what I can to help you if you place the talisman into my care afterward. In return, I promise never to relinquish it to the control of the other…more dangerous members of my organization. It will remain safe and tethered in my control. I cannot guarantee the same should you wield it yourself. Please, we are on the same side, I assure you.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>“All right. We will find it and place it in your care.” Proceed to _Intro 2_.</li><li>“All right. We will find it and place it in your care.” (You are lying.) Skip to _Intro 3_.</li><li>“We will track down this talisman, but we will be taking it into our custody.” Skip to _Intro 4_.</li></ul>",
          "intro2": "<p class='file'>_Intro 2_: Ece lets out a long breath, visibly relieved. “Thank you. I will admit, I wasn’t sure if I could trust you. It is a comfort to know that our two organizations can work together when lives are at stake. After all, we share the same goal.” She rises to her feet and shakes your hand.</p><p>You ask Ms. Şahin where you should begin searching. “The last written account of the talisman’s existence was during the city’s conquest in the 15th century. It was likely hidden in order to keep the invading Ottomans from finding it. After that, it remained hidden for many long years. It was naught but a fable, spoken of in hushed voices and whispers. But due to recent events…well, it would not surprise me if the recent Allied occupation of the city had something to do with this sudden interest in finding it. But let us not get buried in conjecture. I would begin looking in places that were not sacked by the conquering army. The university may also be a useful resource for you. As for me, I am not particularly helpful in a fight, if it comes to that. But I can provide you with aid, in my own way.”</p><p class='basic right'>In your Campaign Log, record *the cell is working with Ece*.</p><ul><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li></ul><p class='basic right'>Proceed to _Setup_.</p>",
          "intro3": "<p class='file'>_Intro 3_: Ece lets out a long breath, visibly relieved. “Thank you. I will admit, I wasn’t sure if I could trust you. It is a comfort to know that our two organizations can work together when lives are at stake. After all, we share the same goal.” She rises to her feet and shakes your hand. You feel a pang of guilt for deceiving her, but you can’t allow the Key to land in the hands of anyone else. Ms. Şahin may yet still be a wolf in sheep’s clothing.</p><p>You ask her where you should begin searching. “The last written account of the talisman’s existence was during the city’s conquest in the 15th century. It was likely hidden in order to keep the invading Ottomans from finding it. After that, it remained hidden for many long years. It was naught but a fable, spoken of in hushed voices and whispers. But due to recent events… well, it would not surprise me if the recent Allied occupation of the city had something to do with this sudden interest in finding it. But let us not get buried in conjecture. I would begin looking in places that were not sacked by the Ottomans. The university may also be a useful resource for you. As for me, I am not particularly helpful in a fight, if it comes to that. But I can provide you with aid, in my own way.”</p><p>You nod, feeling her eyes fixed upon you. Does she suspect your true intentions? Is that why she wishes to travel alongside you? It matters not— what’s done is done. All that’s left is to find the Key.</p><ul><li>In your Campaign Log, record *the cell is deceiving Ece*.</li><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li></ul><p class='basic right'>Proceed to _Setup_.</p>",
          "intro4": "<p class='file'>_Intro 4_: “I see.” Ece’s face falls, downcast. “I was truly hoping our two organizations could work together. After all, we share the same goal. But…” she sighs. “I suppose your honesty is still appreciated. After all the scheming and plotting, I prefer that to the alternative.”</p><p>You ask where this puts the two of you, hoping you won’t have to fight a war on two fronts. “Look. I was telling you the truth. I only want to prevent the talisman from falling into the hands of those who would use it to harm humanity. I hope that I put my trust in the right people, but if you’re unwilling to keep it in my protective custody…” She fidgets with her pen. “For all I know, you’re here for the same reasons they are. I won’t get in your way, but…I cannot in good faith help you if you intend to keep the Key without supervision.”</p><p>You try to protest, but you don’t have much of a leg to stand on. You chose not to trust her, so her decision not to trust you is equally valid. Of course you would only use the Keys you acquire to protect humanity, but you have nothing other than your word to give her. “Your best bet is to start your search in places that were not sacked when the Ottomans invaded the city in the 15th century. The university may also be a useful resource for you.”</p><p>She stands and escorts you to the door, wishing you luck. The door shuts behind you without another word.</p><p class='basic right'>In your Campaign Log, record *the cell refused Ece’s offer*.</p><p class='basic right'>Proceed to _Setup_.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: *Dealings in the Dark*, *Agents of Yuggoth*, *Dark Veiling*, *Ancient Evils*, *Dark Cult*, *Locked Doors*, and *The Midnight Masks*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/dealings-in-the-dark.png' /><img src='{setImgPath}/agents-of-yuggoth.png' /><img src='{setImgPath}/dark-veiling.png' /><img src='{setImgPath}/ancient-evils.png' /><img src='{setImgPath}/dark-cult.png' /><img src='{setImgPath}/locked-doors.png' /><img src='{setImgPath}/midnight-masks.png' /></section>When gathering *The Midnight Masks* encounter set, only gather the five treachery cards (2x False Lead and 3x Hunting Shadow). Do not gather the locations, acts, agendas, and scenario reference cards from that set.",
          "theUnveiling": "Put the double-sided “The Unveiling / The Unsealing” story card into play next to the scenario reference card, The Unveiling side faceup.",
          "timePassed": "Check how much _time_ has passed in the Campaign Log.",
          "tenOrFewerTime": "If 10 or fewer _time_ has passed, no changes are made.",
          "elevenToSeventeenTime": "If 11–17 _time_ has passed, place clues on The Unveiling equal to half the number of investigators (rounded up).",
          "eighteenToTwentyFourTime": " If 18–24 _time_ has passed, place clues on The Unveiling equal to the number of investigators.",
          "twentyFiveOrMoreTime": "If 25 or more _time_ has passed, place clues on The Unveiling equal to twice the number of investigators.",
          "placeLocations": "Put the following locations into play: Hagia Sophia, Istanbul University, Obelisk of Theodosius, and Galata. Hagia Sophia must be on the right hand side of the play area.",
          "beginPlay": "Each investigator begins play at the Hagia Sophia.",
          "checkCampaignLog": "Check the Campaign Log.",
          "eceInvolved": "*If the cell is working with Ece*, or *if the cell is deceiving Ece*, put the Ece Şahin story asset into play under any investigator’s control.",
          "eceNotInvolved": "*If the cell refused Ece’s offer*, remove the Ece Şahin story asset from the game.",
          "setAside": "Set each of the following cards aside, out of play: Each of the seven Grand Bazaar locations, the Umbral Harbinger enemy, the Emissary from Yuggoth enemy, the Galata Docks location, the Twisted Antiprism key, and The Chase act/agenda card.",
          "miniCards": "Gather each decoy mini-card and each of the following mini- cards: 3x Acolyte (any), Wizard of the Order, Sinister Aspirants (A, B and C), and Emissary from Yuggoth. Set them aside, out of play.",
          "cultists": "One at a time, in player order, each investigator discards cards from the top of the encounter deck until they discard a Cultist enemy. Each investigator draws the enemy they discarded, resolving its concealed keyword (as granted by agenda 1a). After all investigators have performed this step, shuffle each other discarded card back into the encounter deck."
        },
        "act2Setup": {
          "title": "Act 2 Setup",
          "instructions": "_When you are instructed to do so during act 1b, follow these instructions to set up the play area for act 2._",
          "setAsideLocations": "Set each of the current locations aside, without discarding any cards or tokens at those locations. Those locations (along with cards and tokens at those locations) are not considered to be in play during act 2, but will re-enter play later in the same state. (*Investigators are not defeated during this process.*)",
          "shuffleGrandBazaar": "Shuffle the seven Grand Bazaar locations and remove one of them from the game at random, without looking at it.",
          "revealToken": "Reveal a random token from the chaos bag, and find the diagram that matches the revealed chaos token (if none match, retry).",
          "putIntoPlay": "Put the remaining six Grand Bazaar locations into play, arranged in a pattern of rows and columns according to the randomly chosen diagram. Note that one of these locations is designated as the “entrance” and one is designated as the “east gate.”",
          "moveToEntrance": "Move each investigator to the Grand Bazaar location marked in the randomly chosen diagram as the “entrance.”",
          "divideMiniCards": "Shuffle together each of the concealed mini-cards on the four locations from act 1, and divide them as evenly as possible among the Grand Bazaar locations in play.",
          "proceed": "You are now ready to proceed to act 2."
        },
        "resolutions": {
          "checkCampaignLog": "Check the Campaign Log.",
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached because each investigator was defeated, and it is act 1 or 2_: Finding the location of the talisman proved to be more difficult—and more deadly—than you thought. Ece was right: these cultists will stop at nothing to get their hands on the Key, and you worry there is nothing you can do to stop them. You hope that some day the Foundation may be able to recover the talisman and prevent whatever entity it binds from causing too much harm, but until then…you shudder and put such thoughts away for the time being. If Ece was right about one of her cohorts being behind this cult’s actions, you’ll surely see the talisman again.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>The Red-Gloved Man is the bearer of The Twisted Antiprism. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "noResolutionAct3": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated) and it is act 3_: Finding the location of the talisman proved to be more difficult—and more deadly—than you thought. Ece was right: these cultists will stop at nothing to get their hands on the Key, and you worry there is nothing you can do to stop them…</p><ul><li>Skip to _Resolution 6_.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: Once you and Ece are safely out of the city, you seal the talisman back in its case, speaking the proper words to contain its power. As you do, the uncanny eclipse looming over the city comes to a swift end.</p>",
            "theCellRefusedEcesOffer": "*If the cell refused Ece’s offer*, skip to _Resolution 2_.",
            "theCellIsWorkingWithEce": "*If the cell is working with Ece or if the cell is deceiving Ece*, skip to _Resolution 3_"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: You take a moment to look out over the sea and appreciate the beauty in the gentle waves, glimmering with the reflection of the now-shining sun. As you leave Istanbul behind, you allow yourself a bit of hope. Perhaps you could have trusted Ece more, but…you shake your head, filled with grim resolve. No—this relic is something you must protect yourself. Someone else might use it for ill. At least in your hands, you know it’s safe.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Choose an investigator to be the bearer of The Twisted Antiprism and update the Campaign Log accordingly.</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: Ece breathes an unsure sigh, worry still etched in her expression. “Well, in case they saw me, I should probably leave Istanbul for a short while. I’ll have to put in a leave of absence at the museum. In the meantime…” she turns to face you, eyebrows raised. “As for our agreement…?”</p>",
            "theCellIsWorkingWithEce": "*If the cell is working with Ece*, proceed to _Resolution 4_.",
            "theCellIsDeceivingEce": "*If the cell is deceiving Ece*, proceed to _Resolution 5_."
          },
          "resolution4": {
            "title": "Resolution 4",
            "body": "<p>_Resolution 4_: You hand over the talisman, trusting that Ece will keep it safe in her possession as promised. She breathes a sigh of relief as she stores it safely in her side pack. “Thank you. For trusting me,” she says. “I’ll keep it on my person at all times.” You take a moment to look out over the sea and appreciate the beauty in the gentle waves, glimmering with the reflection of the now-shining sun. Finally, you ask Ece where she will go now that her position in Istanbul is compromised. “There is a place where the Coterie meets in secret. To go over…important happenings. We do not consort often, but I believe these events warrant a caucus. I will have to call the rest to assemble.” She sneaks a furtive glance in your direction. “Perhaps, when that times comes, we will meet again.” As you leave Istanbul behind, you allow yourself a bit of hope.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *Ece trusts the cell*.</li><li>Ece Şahin is the bearer of The Twisted Antiprism. Update the Campaign Log accordingly.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution5": {
            "title": "Resolution 5",
            "body": "<p>_Resolution 5_: You lock eyes with Ece and apologize, explaining that you cannot give it to her. Especially after seeing the havoc it could wreak when unsealed. Her expression sours into cold anger. “I see.” She narrows her eyes. “…you had no intention of ever giving it to me,” she guesses correctly. You try to explain, but she stops you. “No, I understand. Really, I do.” She takes a step back, her posture wary, defensive. “You’re just like the others. You’ll do anything to get your hands on the Keys, won’t you?” You protest—it’s not that you want them for yourself, it’s just that you need to keep watch over them. In your possession, they’ll be safe, and only ever used to protect humanity. “And what do you suppose the rest of them say?” She barks. “Tzu? Amaranth? Álvarez? The very same. ‘It’s for the good of humanity,’ they claim, and to that end, all means are justified.” She turns and departs, her final words lingering in the air: “You would fit in nicely with the Coterie.” As you leave Istanbul behind, you reflect on your decision, turning the sealed case over and over in your hands. You know it was the right thing to do, but still, Ece’s words haunt you. Perhaps you’ll be able to reconcile some other time…if she’ll even hear you out.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *Ece does not trust the cell*.</li><li>Choose an investigator to be the bearer of The Twisted Antiprism and update the Campaign Log accordingly.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution6": {
            "title": "Resolution 6",
            "body": "<p>_Resolution 6_: You managed to find the location of the talisman, but the cult was one step ahead of you, swooping in and snatching it for themselves. Before you knew it, they had escaped the city with the entity unsealed. Who knows what horrors they’ve unleashed upon the world. You hope that some day the Foundation may be able to recover the talisman and prevent whatever entity it binds from causing too much harm, but until then…you shudder and put such thoughts away for the time being. If Ece was right about one of her cohorts being behind this cult’s actions, you’ll surely see the talisman again.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>The Red-Gloved Man is the bearer of The Twisted Antiprism. Update the Campaign Log accordingly.</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "档案#21-F",
        "specialRules": [
          {
            "title": "大巴扎的地点相邻关系",
            "body": "本剧本的4个起始地点按上图所示排列，并通过其连接符号相连。在剧本进行到后面时，调查员会受到指示将大巴扎地点放入场上。每个大巴扎地点都与和它相邻的每个大巴扎地点相连。\n\n• 相邻地点共用一条边（左、右、上或下）。仅共用一个角的地点不相邻。"
          },
          {
            "title": "祭司的隐匿迷你卡牌",
            "body": "本剧本的第一张议程会使每个异教徒敌人（包括核心套装中的那些）获得隐匿关键词。由于核心套装中的三位祭司没有标注A、B和C，在结算它们的隐匿关键词时，使用任意一张祭司(任意)迷你卡牌及其诱饵。同样，当一张“祭司(任意)”迷你卡牌被揭露时，揭露该迷你卡牌的调查员可以选择阴影中的任意一位祭司与其交战。"
          }
        ],
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为场上线索标记最多的_异教徒_敌人上的线索标记数，最多为3。(如果是场景3，则X为3。",
            "cultist": "-5。你可以在最近的_异教徒_敌人上放置1个毁灭标记以将本标记的修正值变为-1。",
            "tablet": "-3。如果你检定失败，将你的1个线索放到你所在地点。",
            "elderThing": "-2。如果你检定失败，在最近的_异教徒_敌人上放置1个毁灭标记。"
          },
          "hardExpert": {
            "skull": "-X。X为场上_异教徒_敌人上的线索标记总数，最多为4。(如果是场景3，则X为4。)",
            "cultist": "-7。你可以在最近的_异教徒_敌人上放置1个毁灭标记以将本标记的修正值变为-3。",
            "tablet": "-4。如果你检定失败，将你的1个线索放到你所在地点。",
            "elderThing": "-2。在最近的_异教徒_敌人上放置1个毁灭标记。"
          }
        },
        "ui": {
          "entrance": "入口",
          "eastGate": "东门"
        },
        "tooltips": {
          "grandBazaarJewelersRoad": {
            "investigate": "_调查_。如果你检定成功，你可以不发现线索，改为从自己手牌打出一张_守护_或_遗物_支援，且你每超过难度1点，就降低其费用1点*(最多降至0)*。"
          }
        },
        "label": {
          "agentsOfTheDark": {
            "cluesUnveiled": "将1个线索(从供应堆拿取)放到彰显的线索上",
            "cultist": "查找遭遇牌库和遭遇弃牌堆，找出一个_异教徒_敌人并将其抽取"
          },
          "lightOutOfVoid": {
            "doom": "在场上躲避值最高的_异教徒_敌人上放置1个毁灭标记"
          }
        },
        "intro": {
          "label": {
            "giveToEce": "“好的，我们会找到它，交给你保管。”",
            "giveToEceLying": "“好的，我们会找到它，交给你保管。”(你在撒谎。)",
            "takeForOurselves": "“我们会找到这个护身符，但是要自行保管。”"
          },
          "title": "档案#21-F: 暗中交易",
          "intro1Part1": "<p class='file'>你在海鸥的鸣叫声中跨越加拉塔大桥：还有多少人能把当年的君士坦丁堡和如今的加拉塔、贝伊奥卢、希什利、哈比耶这些城区联系起来呢？这里现在成了无数异国游商和外交官生活工作的地方。你知道自己要去哪里。时间紧迫，保密要紧，所以你决定不雇翻译，直接前往苏莱曼尼耶建筑群，那里就是你调查的目标——一位名叫艾婕·萨辛的女士——可能工作的地方。</p><p>萨辛女士在多个学术领域都很知名，尤其是古物学和艺术史。根据你的情报，她正在新成立的土耳其与穆斯林艺术博物馆担任馆长。但你惊讶的是，自己手上的档案居然还有许多萨辛女士的其他信息，从学校一直追溯到早年生活。这一切都说明，她要么和同志会的其他成员不一样，没有伪装；要么这些都是她精心设计的伪装。</p><p>据你所知，萨辛女士已经和基金会有过接触，发来过介绍。这可能是个陷阱。但要是她真想会面，你可不能错过这么好的机会。所幸她的办公室并不难找，门上还用土耳其语和好几种语言写了她的名字和头衔全称。你敲了门，她请你进去。你小心翼翼地进屋，眼神本能地扫过屋内每个角落，探寻一切可能的藏身之处。</p><p>这间屋子暖洋洋，富丽堂皇。墙上挂着华美的绣帷和各种风格的绘画，从几百年前，到非常新近的时期都有。架子装满了色彩斑斓的陶瓷、玻璃和老旧发霉的文献，都要溢出来了。“欢迎。”萨辛女士露出一个温暖的微笑，仿佛照亮了整个房间。她还算年轻，深色皮肤，有一双深褐色的眼睛，纤细的身材，一看就知道毕生精力都花在了学术上。“有何贵干？”</p><p>你告诉萨辛女士，自己收到了她的“先期联络”，知道她想和你会面。她想了一想，瞪大了眼睛：</p><p>“噢！所以你是——”她清清喉咙，没有说完。“我懂了，那么，请坐。我们有许多要谈。”</p><p>你告诉萨辛女士，她可以先说说自己和同志会的关系。你注意到她一听到组织的名字，就在位子上不安地扭了扭。</p><p>“正如你所知，同志会和全世界许多事情都有瓜葛。”她斟酌着每个用词，“但他们的——我们的——目标，和你其实并无不同。我花了许多年为组织研究，和你们的人研究一样的东西。这些奥术力量之物可以用于保护人类免遭我们不可见的威胁。”</p>",
          "key": "<div class='red'><p>_仅当有调查员绑定了钥匙才能阅读：_你将自己的钥匙掏给萨辛女士看，问这是不是就是她提到的神器。“看来你已经有这样的东西了。你是从哪获得的？”</p><p>你告诉萨辛女士你赶在她的同事造成进一步危害前回收了钥匙。</p><p>“钥匙？你是这么称呼它的？有趣，但也不意外。在人类历史上，许多人用不同的名字称呼过它们。你提出的术语倒是很好。它们确实是钥匙，可以解锁其他世界的力量。这力量足以拯救世界，也可以毁灭世界。”</p></div>",
          "intro1Part2": "<p>或者控制人类——你将这想法脱口而出。</p><p>萨辛女士叹了口气：“你说的没错。但我向你保证，同志会里并不是人人都有这样的目的。也有人就像我一样，只想用钥匙造福他人。”</p><p>你问萨辛女士，既然同志会在世界其他地方为非作歹，自己又为什么要相信她。</p><p>“我们的组织并没有领袖或是等级。”她解释道，“我们独立行动，只是目标一致。但有的人……”她艰辛地吞了口口水，打了个寒战。“有的人用的方法我并不能赞成。这些方法不仅恶心，而且，说实话，也让我害怕。”</p><p>你依然不知道萨辛女士是否坦诚，但要是不听她说完就没意义了。你问她君士坦丁堡现在是什么情况，她又为什么要和基金会接触。“伊斯坦布尔。”她纠正你，“伊斯坦布尔的人民已经不用那个名字称呼这座城市了。”你暗暗记下，以后只叫这里伊斯坦布尔。“你追寻的遗物中有一个就在伊斯坦布尔。这个我也找了很多年。这个护身符绑定了一个强大的实体，有人会称之为‘魔神’，就是你在《阿拉丁》的故事里见到的那个。一般来说，这是唯一一种有自由意志的非人类实体。”</p><p>她萨辛女士面无表情，你问她是否真的相信这些。“魔神？不，我倒是不相信这个护身符会跟魔神有关。我相信它的主宰是某种更为强大的非人存在。某种不属于地球的东西。而且盯上它的绝不仅仅只有我们。大战之后，奥斯曼帝国解体，许多记录失于混沌，更多的重现于世，其中就有些和这块护身符有关。另一群在找的人……他们为了获得这样的知识所做的事情……”她脸色惨白，努力保持镇定。“他们不择手段，谋杀和酷刑也司空见惯。要是这群疯人最终得手，会发生什么样的惨剧，我都不敢想。最坏的是，我相信我有一位同志正是幕后黑手。我已经很接近了，但要是他们先得手……”</p><p>你现在明白萨辛女士为什么来找你了——要是同志会里有人操纵着邪恶的教派，她当然不能用这样的信息去找他们。你脑海中依然盘旋着疑虑。“拜托。”她恳求了你，“赶在邪恶的教徒前面找到护身符。我可不想看到他们崇拜的到底是什么。要是你能帮我取得护身符，我将竭尽所能地回报。我保证决不让其他……组织里更危险的人物染指它。在我的看管下，它会是安全无害的。要是你亲自持有，我就不敢保证了。拜托。我们目标一致，我保证。”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>“好的，我们会找到它，交给你保管。”</li><li>“好的，我们会找到它，交给你保管。”(你在撒谎。)</li><li>“我们会找到这个护身符，但是要自行保管。”</li></ul>",
          "intro2": "<p class='file'>艾婕长长地舒了口气，明显是放松了下来。“谢谢。我得承认，我之前并不确认能否相信你。在这种性命攸关的时刻，得知我们的组织能通力合作，真是让人松了口气。毕竟我们的目标一致。”她站起来和你握手。</p><p>你问萨辛女士自己应该从哪里入手。“记载护身符存在的最后一份书面报告出现在15世纪，这座城市被征服的时候。随后记录就藏了起来，可能是为了不让入侵的奥斯曼人找到。之后许多年都销声匿迹，成了闲言碎语刻意隐瞒的传说。但最近……好吧，要是协约国军队入驻突然对它有了兴趣，我也不会奇怪。但现在不要沉迷于揣测了。我会从占领军没有洗劫的地方开始。大学也可能有些资源派的上用场。如果事情发展到动武那一步，别指望我能帮上忙。但我会用自己的方式提供帮助。”</p><p class='basic right'>在剧本日志中，记录下*特别小组与艾婕合作*。</p><ul><li>从混乱袋中移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li></ul><p class='basic right'>进入_冒险设置_。</p>",
          "intro3": "<p class='file'>艾婕长长地舒了口气，明显是放松了下来。“谢谢。我得承认，我之前并不确认能否相信你。在这种性命攸关的时刻，得知我们的组织能通力合作，真是让人松了口气。毕竟我们的目标一致。”她站起来和你握手。这么骗她让你有种罪恶感，但你不能让钥匙落入其他人手中。萨辛女士可能还是一只披着羊皮的狼。</p><p>你问她自己应该从哪里入手。“记载护身符存在的最后一份书面报告出现在15世纪，这座城市被征服的时候。随后记录就藏了起来，可能是为了不让入侵的奥斯曼人找到。之后许多年都销声匿迹，成了闲言碎语刻意隐瞒的传说。但最近……好吧，要是协约国军队入驻突然对它有了兴趣，我也不会奇怪。但现在不要沉迷于揣测了。我会从奥斯曼军队没有洗劫过的地方开始。大学也可能有些资源派的上用场。如果事情发展到动武那一步，别指望我能帮上忙。但我会用自己的方式提供帮助。”</p><p>你点点头，发现她正盯着你。她是否怀疑你的真意？是不是因此她才要与你同行？这不重要——木已成舟。剩下的就是找到钥匙了。</p><ul><li>在剧本日志中，记录下*特别小组欺骗艾婕*。</li><li>从混乱袋中移除1个 {'{'}tablet{'}'} 标记。加入1个 {'{'}elderThing{'}'} 标记(如果已有4个，改为每位调查员取得1点经验值)。</li></ul><p class='basic right'>进入_冒险设置_。</p>",
          "intro4": "<p class='file'>“明白了。”艾婕脸色一沉，垂头丧气。“我还指望咱们的组织能通力合作呢。毕竟我们的目标一致。但是……”她叹了口气，“我还是要感谢你的诚实。在那么多的勾心斗角之后，我还是欣赏这种品质。”</p><p>你问她既然这样，你们之间又会如何，一边希望这不会让你们就此大战一场。“说实话，我只是不希望护身符落入那些意图危害人类的奸恶手中。我希望能信任正确的人，但要是你不愿让我妥善看顾它……”她烦躁地转起笔，“据我所知，你来这里和他们的目的一样。我不会挡你的道……但要是你执意留着钥匙，不受监管，那我也不会帮你。”</p><p>你想反对，却发现自己根本站不住脚。你没有相信她，那她不信你也是公平。你当然只会用钥匙保护人类，但你也拿不出真凭实据。“你最好从奥斯曼人15世纪入侵时没洗劫的地方开始。大学也可能有些资源对你派的上用场。”</p><p>她站起来送你出门，祝你好运。门在你背后关上了，再没言语。</p><p class='basic right'>在剧本日志中，记录下*特别小组拒绝了艾婕的提议*.</p><p class='basic right'>进入_冒险设置_。</p>"
        },
        "setup": {
          "gatherSets": "收齐以下遭遇组的所有卡牌：*暗中交易*、*犹格斯星使徒*、*黑暗笼罩*、*远古恶魔*、*黑暗异教徒*、*上锁的门*、*午夜假面*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dealings-in-the-dark.png' /><img src='{setImgPath}/agents-of-yuggoth.png' /><img src='{setImgPath}/dark-veiling.png' /><img src='{setImgPath}/ancient-evils.png' /><img src='{setImgPath}/dark-cult.png' /><img src='{setImgPath}/locked-doors.png' /><img src='{setImgPath}/midnight-masks.png' /></section>在收齐*午夜假面*遭遇组时，只收齐五张诡计卡牌(2张错误指示和3张追猎鬼影)。不要收齐该遭遇组中的地点、场景、密谋和冒险参考卡牌。",
          "theUnveiling": "将双面的“彰显/解封”剧情卡牌放置入场，放在冒险参考卡牌旁，彰显面朝上。",
          "timePassed": "检查剧本日志中已经流逝了多少_时间_。",
          "tenOrFewerTime": "如果流逝的_时间_小于等于10，不作改动。",
          "elevenToSeventeenTime": "如果流逝的_时间_为11到17，在彰显上放置数量等于调查员人数一半的线索(向上取整)。",
          "eighteenToTwentyFourTime": "如果流逝的_时间_为18到24，在彰显上放置数量等于调查员人数的线索。",
          "twentyFiveOrMoreTime": "如果流逝的_时间_大于等于25，在彰显上放置数量等于调查员人数两倍的线索。",
          "placeLocations": "将以下地点放置入场：圣索菲亚、伊斯坦布尔大学、狄奥多西方尖碑、加拉塔。圣索菲亚必须位于游戏区域的右侧。",
          "beginPlay": "每位调查员从圣索菲亚开始游戏。",
          "checkCampaignLog": "检查剧本日志。",
          "eceInvolved": "如果*特别小组与艾婕合作*，或*特别小组欺骗艾婕*，将艾婕·萨辛剧情支援放置入场，由任意一位调查员控制。",
          "eceNotInvolved": "如果*特别小组拒绝了艾婕的提议*，将艾婕·萨辛剧情支援从游戏中移除。",
          "setAside": "将下列卡牌放在一边，位于场外：所有七张大巴扎地点、幽影预示者敌人、犹格斯星的密使敌人、加拉塔码头地点、扭曲反棱镜钥匙、追逐场景/密谋卡牌。",
          "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：3张祭司(任意)、密会巫师、邪恶野心家(A、B、C)、犹格斯星的密使。将这些卡牌放在一边，位于场外。",
          "cultists": "按玩家顺序，每位调查员依次从遭遇牌库顶弃掉卡牌，直到弃掉一张_异教徒_敌人。每位调查员抽取其弃掉的敌人，结算其(由密谋1a获得的)隐匿关键词。在所有调查员都执行了此步骤后，将弃掉的其他每张卡牌混洗回遭遇牌库。"
        },
        "act2Setup": {
          "title": "第2幕设置",
          "instructions": "_当你在第1幕b中受到此指示时，按照以下说明为第2幕设置游戏区域。_",
          "setAsideLocations": "将当前的每个地点放在一边，不要弃掉那些地点上的任何卡牌或标记。那些地点（连同其上的卡牌和标记）在第2幕期间不视为在场上，但之后会以相同的状态重新进入场上。（*在此过程中，调查员不会被击败。*）",
          "shuffleGrandBazaar": "将七张大巴扎地点洗混，随机将其中一张移出游戏，不要查看它。",
          "revealToken": "从混乱袋中随机揭示一个标记，并找出与所揭示混乱标记对应的图表（如果没有对应的图表，则重试）。",
          "putIntoPlay": "将剩余的六张大巴扎地点放入场上，按照随机选出的图表以行列布局排列。注意，其中一张地点被指定为“入口”，另一张被指定为“东门”。",
          "moveToEntrance": "将每位调查员移动到随机选出的图表中标记为“入口”的大巴扎地点。",
          "divideMiniCards": "将第1幕四个地点上的所有隐匿迷你卡牌洗混，并尽可能均匀地分配到场上的大巴扎地点中。",
          "proceed": "你现在可以进入第2幕了。"
        },
        "resolutions": {
          "checkCampaignLog": "检查剧本日志",
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员被击败)且是场景1或2：_事实证明，找到护身符的位置比你所想的更危险——更致命。艾婕是对的：教派会不惜一切夺取钥匙，你担心自己已经不能阻止他们。你希望基金会有朝一日能重夺护身符，阻止它绑定的实体继续为害，但在那之前……你打了个寒战，将这个想法抛之脑后。要是艾婕说的没错，真有她的同志在背后主宰教派的举动，那你肯定还会见到护身符的。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>戴红手套的男子拥有扭曲反棱镜，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "noResolutionAct3": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局（每位调查员撤退或者被击败）且是场景3：_事实证明，找到护身符的位置比你所想的更危险——更致命。艾婕是对的：教派会不惜一切夺取钥匙，你担心自己已经不能阻止他们……</p><ul><li>跳到_结局6_。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 你和艾婕才刚刚安全出城，你就将护身符封回容器，念出真言束缚住它的力量。天空中蔓延的离奇日食随即消散。</p>",
            "theCellRefusedEcesOffer": "*特别小组拒绝了艾婕的提议*",
            "theCellIsWorkingWithEce": "*特别小组与艾婕合作*或*如果特别小组欺骗艾婕*"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 日光重又洒下，你远眺海面，不禁赞叹这浪花轻拂、波光粼粼的美景。你远离伊斯坦布尔，又重燃了一点希望。也许你可以多信任艾婕一点的，但……你摇摇脑袋，严肃地坚定决心。不——这件遗物你必须亲自保卫。别人可能用它为非作歹。至少在你手里的时候，你知道它是安全的。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>选择一位调查员拥有扭曲反棱镜，相应更新在剧本日志中。</li><li>在剧本日志中记2_时间_。你可以_启程_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 艾婕叹了口气，并不十分坚定，脸上依然焦急。“唉，他们可能已经看到我了，我还是暂时离开伊斯坦布尔一会儿吧。我得给博物馆请个假了。与此同时……”她转向你，扬起了眉毛。“我们的协议……？”</p>",
            "theCellIsWorkingWithEce": "*特别小组与艾婕合作*",
            "theCellIsDeceivingEce": "*特别小组欺骗艾婕*"
          },
          "resolution4": {
            "title": "结局4",
            "body": "<p>_结局4_: 你将护身符交出，相信艾婕能如约妥善保管。她舒了口气，如释重负，将宝物安全放入袋中。“谢谢，谢谢你信任我。”她说道，“我会一直随身带着的。”日光重又洒下，你远眺海面，不禁赞叹这浪花轻拂、波光粼粼的美景。末了，你问艾婕她现在要去哪里。毕竟她在伊斯坦布尔的位置已经受到了牵连。“同志会有一个秘密碰头的地方。去那里细究……重要事项。我们不常碰头，但我相信现在发生的事情需要开次会了。我会召集其他人出席。”她悄咪咪地朝你这儿望了一眼，“也许，等到那时候，我们还会再见。”你远离伊斯坦布尔，又重燃了一点希望。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*艾婕信任特别小组*。</li><li>艾婕·萨辛拥有扭曲反棱镜，相应更新在剧本日志中。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          },
          "resolution5": {
            "title": "结局5",
            "body": "<p>_结局5_: 你盯着艾婕，向她道歉，说自己不能把这东西给她，尤其是现在，你见识了它解封之后会爆发怎样的灾祸。她的表情变得冷酷而愤怒。“我懂了。”她眯起眼睛，“……你从来都没有想过要给我。”她猜对了。你试着解释，却被她打断：“不，我懂的。真的，都懂的。”她退后一步，摆出了警觉的防御姿势。“你和他们都一样。为了钥匙，你会不惜一切手段，不是吗？”你反对——你并不是为了自己求取钥匙，你只不过是想要严加看管。钥匙在你手中才更安全，才会用来保护人类。“你觉得他们是怎么说的？”她吼道，“朱？范？欧瓦瑞兹？一模一样。‘是为了人类的利益。’他们也这么说。为了这样的目的，就不择手段。”她转身离开，最后的话语盘桓不去：“你倒是很配同志会。”你离开伊斯坦布尔，反思自己的决定，封印的容器在手中翻来覆去。你知道自己做了正确的事情，但依然无法摆脱艾婕的话语。也许你们还能重归于好……要是她能听得进去。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*艾婕不信任特别小组*。</li><li>选择一位调查员拥有扭曲反棱镜，相应更新在剧本日志中。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          },
          "resolution6": {
            "title": "结局6",
            "body": "<p>_结局6_: 你成功找到了护身符的所在，但教派捷足先登，将其夺走。他们趁你发觉之前就逃出城去，封印也已解除。这世界将因其遭受怎样的恐怖，只有天知道了。你希望基金会有朝一日能重夺护身符，阻止它绑定的实体继续为害，但在那之前……你打了个寒战，将这个想法抛之脑后。要是艾婕说的没错，真有她的同志在背后主宰教派的举动，那你肯定还会见到护身符的。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>戴红手套的男子拥有扭曲反棱镜，相应更新在剧本日志中。</li><li>在剧本日志中记2_时间_。你可以_启程_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 74,
        "missing": 0,
        "untranslated": 0,
        "present": 74,
        "specialRules": 4
      }
    },
    "dancingMad": {
      "id": "dancingMad",
      "name": "疯星乱舞",
      "nameEn": "Dancing Mad",
      "referenceCode": "09591",
      "file": "scenarios/dancingMad.json",
      "sectionsEn": {
        "heading": "File #28–I",
        "tokens": {
          "easyStandard": {
            "skull": " -X. X is the number of enemies in the shadows (max 3).",
            "cultist": "-4. If you fail, put a decoy into play at your location, flip it over, and shuffle each concealed mini-card at your location facedown.",
            "tablet": "-3. If you fail, set each non-weakness card committed to this test aside, out of play, as a hollow.",
            "elderThing": "-1. If there is a concealed mini-card at your location, either take 1 damage or treat this token's modifier as -3."
          },
          "hardExpert": {
            "skull": "-X. X is the number of enemies in the shadows (max 5).",
            "cultist": "-6. If you fail, put a decoy into play at your location, flip it over, and shuffle each concealed mini-card at your location facedown.",
            "tablet": "-3. Set each non-weakness card committed to this test aside, out of play, as a hollow.",
            "elderThing": "-1. If there is a concealed mini-card at your location, either take 2 damage or treat this token's modifier as -5."
          }
        },
        "tooltips": {
          "falseColorsV2": {
            "resign": "\"I thought we had a deal!\" You get out of the city while you still can."
          }
        },
        "label": {
          "elderThing": "Treat this token's modifier as -{count}.",
          "silenceSpeaks": {
            "concealed": "Search the encounter deck and discard pile for an enemy with the concealed keyword and draw it (resolving its concealed keyword). Shuffle the encounter deck.",
            "hollowed": "Reveal the top card of each investigator's deck. Each investigator draws each weakness they revealed in this way. Set each other revealed card aside, out of play, as a hollow."
          }
        },
        "intro": {
          "title": "File #28–I: Dancing Mad",
          "intro1Part1": "<p class='file'>_Intro 1_: As it turns out, finding the Red Coterie operating out of Havana is the easiest part of your trip to Cuba. According to your intel, Mr. Álvarez can often be seen spending his nights at Café Luna—a hot spot among the locals and American tourists looking to escape the iron jaws of Prohibition. Open at nearly all hours of the night and serving a variety of liquors that would make even the most seasoned bootlegger’s eyes bulge, the bar has become one of the most popular in all of Havana.</p><p>You arrive at peak hours, hoping to use the crowd to blend in. For all you know, Mr. Álvarez may have been warned of your approach. As soon as you arrive, you are greeted by an array of bright lights and a crowd almost too thick to squeeze past. Live jazz resounds from within the club, and many are dancing and reveling—some before they even get inside. A bouncer in a black pinstripe suit greets you at the door, giving you the once-over but not bothering to pat you down, ask for a password, or any of the usual hoops you might have to jump through back in the speakeasies hidden throughout the States.</p><p>Once inside, you head straight for the bartender and struggle to get his attention. You order a drink as a cover, but his expression changes the moment you say that you’re looking for a Mr. Desiderio Álvarez.</p><p>Eyes narrow with suspicion, he nonetheless nods in the direction of a roped- off hallway in the back corner of the room, guarded by two more suits. Both of them flank you as you approach, and follow you into what you can only assume to be the club’s VIP section. There, in a dim, smoky back room, sits none other than the “man in the blood-soaked suit,” so named for the red accents adorning his otherwise black suit—or perhaps it is simply a metaphor. He inhales slowly from a cigarette hanging loosely from his lips as he appraises you. Across from him sit two others, an elderly Cuban gent in a red suit vest, puffing on a thick cigar, and a dangerous-looking woman in a red dress who sips from a martini glass. All three of them have murder in their eyes.</p><p>“Who are these idiotas?” Mr. Álvarez asks one of the guards escorting you.</p><p>“They asked to speak with you, Desi,” the man stammers.</p><p>“Oh. Well, pour ‘em something hard, will you? Don’t just stand there.” After a quick nod, your escort jaunts out of the room, leaving you with the three apparent Coterie agents. “Come, sit.” You politely turn down a variety of smokes and take a seat at the table. “So you were looking for me?”</p><p>You nod and inform Mr. Álvarez that he is a person of interest in your investigation, that you knew he often frequented this very bar, and that you were hoping to simply ask him a few questions. Without hesitation, the woman in red pulls a long knife from out of seemingly nowhere. But the man in the suit holds out his hand, and she slides the blade back into her garter belt, covering it with the fabric of her dress.</p>",
          "policeOrDetective": "<div class='red'><p>_Read only if an investigator has the Police or Detective trait_: The man gives you a disarming smile. “You’ll have to forgive my friend here. She tends to be a bit…jumpy…around policía. I’m sure you understand.” You explain that despite what it looks like, you’re not here to crack down on anything illegal. This time. “Yeah, that much is pretty obvious, I think,” he says. “No, I’m guessing I know what you’re really here for…”</p></div>",
          "intro1Part2": "<p>“First off, you can just call me Desi. Everyone else does. I’m not a big fan of formalities.” He waves his hand as if to fan away the tension in the room. “Secondly, I don’t just ‘frequent’ Café Luna, I own it. There was a…change of management a few months back. I guess your intel is a bit outdated, eh?” He chuckles, crushes the stub of his cigarette in a nearby ashtray, and immediately flicks open his lighter to light a new one. “So. Why don’t you tell me about this investigation of yours?”</p><p>You do, emphasizing that you are only after the location of Keys, and not whatever operation Desi has going on here.</p><p>His expression sharpens into angular stone. “Right. ‘Keys,’ eh. Is that all? All right, then. We might be able to help each other out…”</p><p class='basic'>Check how much time has passed in the Campaign Log.</p>",
          "fewerThanTwentyTime": "If fewer than 20 _time_ has passed, proceed to _Intro 2_.",
          "twentyOrMoreTime": "If 20 or more _time_ has passed, proceed to _Intro 3_.",
          "intro2": "<p class='file'>_Intro 2_: Desi sighs and opens up to you, much to the chagrin of his two companions, who look on with surprise. “Something’s been after my crew in Havana. Started with some new blood who went off-grid all of a sudden. Then a couple longtimers. Just gone,” he says with a snap of his fingers. “At first, I thought it was just some uppity rivals looking to expand their territory. Fools who don’t know who I really am. The kinda scum who’d run this city into the ground.” He ashes his cigarette, staring into the ashes like there is some greater meaning inside to sift through. “Weird part is, I don’t remember their names. Nobody does. Sounds weird, right? I never forget a name. Never.” His gaze locks with yours, cold as stone. “Now I’m starting to suspect something worse. The kinda thing your people deal with.”</p><p>You wonder aloud if this is the kind of thing his people are also supposed to be dealing with.</p><p>“Don’t lump me in with the rest of them,” he chides. “I’ve got other fish on my menu. Now—you got two choices. You either help me out with my little problem, or me and my buddies here throw you to the curb. Which is it gonna be?”</p><p>After a moment of thought, you tell Desi that you’ll help if he gives you the location of any known Keys and relinquishes any he might have in his possession. The other two Coterie agents lock eyes with Desi in vain, but he has already made up his mind.</p><p>He extends his hand. “Deal. But I want in. We’ll do this together. Nobody messes with my crew and gets away with it. Come back here tomorrow night—same time, same place.” You nod and depart, booking a room at the Plaza Hotel in Old Havana and getting some much-needed rest before tomorrow’s investigation.</p><p class='basic right'>In your Campaign Log, record *the cell made a deal with Desi.*<br />Proceed to _Setup (v. I)_.<p>",
          "intro3": "<p class='file'>_Intro 3_: Desi stands and paces, clearly worked up about something. “There’s something going on with my crew.” His elderly companion watches in cold, unnerving silence, but the woman wears a worrying expression to match Desi’s. “It started with just a few of ‘em going missing. Thought they were bumped off by local gangs or the like. The kinda scum who’d run this city into the ground. But now…” He shakes his head, forehead wrinkled with worry. “I don’t remember who they were. Nobody does. And it’s more of ‘em every day. And every time, boom,” he snaps his fingers, “gone, no memory of them existing, only the faintest recollection that they were here and now they’re not.” He locks narrow eyes with you. “Sound familiar?”</p><p>You nod. This is all awfully familiar. You tell Desi that you’ll help him figure out what’s going on if he gives you the location of any known Keys and relinquishes any he might have in his possession. The woman bites her lip and glances at Desi, wondering if he will agree.</p><p>The elderly man once more remains eerily silent, watching with cold, hazy eyes.</p><p>Desi shakes your hand and nods. “Deal. But I want in. We’ll do this together. Nobody messes with my crew and gets away with it. Come back here tomorrow night—same time, same place.” You nod and depart, booking a room at the Plaza Hotel in Old Havana and getting some much-needed rest before tomorrow’s investigation.</p><p class='basic right'>Proceed to _Intro 4_.</p>",
          "intro4": "<p class='file'>_Intro 4_: The next night, you go back to Café Luna, ready to once more sift through the stifling crowd to reach Desi’s VIP room, but when you arrive you find the club closed. Thinking that Desi must have shut the place down for the night so you and his crew could plan your investigation without being disturbed, you try the handle. Confirming your suspicions, the door opens without any trouble, and you head inside.</p><p>The bar is eerily dim and quiet as you make your way to the back room. Having seen what the place looks like during a typical night, full of live music and reveling tourists, you feel a bit unnerved. Your steps echo quietly over the dance floor across from the bar. A nearby stool creaks.</p><p>It is too quiet.</p><p>You have no time to process whether you’re in danger. The moment the thought crosses your mind, a hail of gunfire erupts all around you. An ambush! You drop instinctively to the floor, guard your face and cover your ears. The ruckus is deafening. Windows along the front face of the building shatter and send an eruption of jagged glass over the dance floor. The bullets tear through the bar, the booths, the stools; every piece of furniture is ripped apart. You have only seconds to react—</p><p class='basic right'>In your Campaign Log, record *the cell has been ambushed!*<br />Proceed to _Setup (v. II)_.</p>"
        },
        "setup": {
          "version1": {
            "gatherSets": "Gather all cards from the following encounter sets: *Dancing Mad*, *Agents of the Outside*, *Cleanup Crew*, *Crimson Conspiracy*, *Secret War*, *Shadow of a Doubt*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/dancing-mad.png' /><img src='{setImgPath}/agents-of-the-outside.png' /><img src='{setImgPath}/cleanup-crew.png' /><img src='{setImgPath}/crimson-conspiracy.png' /><img src='{setImgPath}/secret-war.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /></section>",
            "actDeck": "Build the act deck using only (v. I) of acts 1 and 2, along with act 3. Remove (v. II) of acts 1 and 2 from the game.",
            "placeLocations": "Put the Café Luna location into play, (*Bastion of Remembrance*) side faceup.",
            "beginPlay": "Each investigator begins play at Café Luna (*Bastion of Remembrance*).",
            "remainingLocations": "Put all six remaining locations into play",
            "desiderio": "Find both copies of the Desiderio Delgado Álvarez enemy. One has a story asset version on its other side, and one has a standard encounter card back.",
            "encounterVersion": "Set the version with the encounter card back aside, out of play.",
            "assetVersion": "Flip the other version to its story asset side.",
            "takeControlOfDesiderio": "Choose an investigator to take control of the Desiderio Delgado Álvarez story asset.",
            "setSetsOutOfPlay": "Set the *Cleanup Crew* and *Crimson Conspiracy* encounter sets aside, out of play. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/cleanup-crew.png' /><img src='{setImgPath}/crimson-conspiracy.png' /></section>",
            "miniCards": "Gather each decoy mini-card and each of the following mini-cards: Desiderio Delgado Álvarez, Coterie Agents (A, B and C), Coterie Assassins (A and B), and Coterie Enforcers (A and B). Set them aside, out of play."
          },
          "version2": {
            "gatherSets": "Gather all cards from the following encounter sets: *Dancing Mad*, *Agents of the Outside*, *Cleanup Crew*, *Crimson Conspiracy*, *Secret War*, *Shadow of a Doubt*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/dancing-mad.png' /><img src='{setImgPath}/agents-of-the-outside.png' /><img src='{setImgPath}/cleanup-crew.png' /><img src='{setImgPath}/crimson-conspiracy.png' /><img src='{setImgPath}/secret-war.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /></section>",
            "actDeck": "Build the act deck using only (v. II) of acts 1 and 2, along with act 3. Remove (v. I) of acts 1 and 2 from the game.",
            "placeLocations": "Put the Café Luna location into play, (*Coterie Haunt*) side faceup.",
            "beginPlay": "Each investigator begins play at Café Luna (*Coterie Haunt*).",
            "remainingLocations": "Set each other location aside, out of play.",
            "desiderio": "Find both copies of the Desiderio Delgado Álvarez enemy. One has a story asset version on its other side, and one has a standard encounter card back. Set both of them aside, out of play.",
            "setOutOfPlay": "Set each of the four _Outsider_ enemies aside, out of play (2x Otherworldly Mimic and 2x Paradigm Effacer).",
            "miniCards": "Gather each decoy mini-card and each of the following mini-cards: Desiderio Delgado Álvarez, Coterie Agents (A, B and C), Coterie Assassins (A and B), and Coterie Enforcers (A and B). Set them aside, out of play.",
            "theShadows": "Spawn enemies in the shadows, as follows:",
            "spawnDesiderio": "Find the set-aside Desiderio Delgado Álvarez enemy with the encounter card back. The lead investigator draws that enemy, resolving his concealed keyword.",
            "spawnCoterie": "One at a time, in player order, each other investigator discards cards from the top of the encounter deck until they discard a different _Coterie_ enemy. Each investigator draws the enemy they discarded, resolving its concealed keyword. Shuffle each other discarded card back into the encounter deck."
          }
        },
        "resolutions": {
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated)_: Deal or not, you can’t stay in Havana any longer. Your escape from the city is a blur of gunfire and fractured space, of pounding rain and roiling clouds, of imposters in familiar skin and eyes on every street corner. Eventually, somehow, you make it off the streets, commandeering a boat moored in Havana Harbor and setting off at once.</p><p>As your heart finally settles and your mind sets to work deciphering the things you’ve seen, you worry that your escape, while prudent, might have consequences for you in the future. And you have no new Keys or leads to show for it, either. But, despite the close call, you survived and are remembered—that must count for something.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *the cell didn’t discover the truth in Havana*.</li><li>In your Campaign Log, record *you haven’t seen the last of Desiderio Delgado Álvarez*.</li><li>Desiderio Delgado Álvarez is the bearer of The Mirroring Blade. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: You recap the night’s events in your head as Desi calls an impromptu meeting with the rest of his crew. “I have to sort through this,” he mutters to you in frustration. “The fact that any of them could be…y’know…well, it puts things into perspective. Not sure who to trust.” He certainly seems to be back to normal. You must have made the right choice. Then again… your mind wanders to the version of Desi who stalked you through the rainy Havana streets, to gunshots and distortions in the sky. You can’t help but continue to scan Desi’s eyes for any sign—any at all—that he is not who he claims to be. You find none. Or perhaps the mimic simply knows how to act now that it has been in his skin for so long? “Well,” he interrupts your thoughts, “I guess I owe you my end of the bargain. ‘Blackbird Solitaire.’”</p><p>You blink in confusion. “‘Blackbird Solitaire,’” he repeats. “It’s one of the passphrases for my hideout in Ybor City. We rotate passphrases whenever I grant someone in my crew access, which is…rare. Not even the rest of the Coterie knows how to get in. They think it’s just a front, anyway. I think most of ‘em don’t understand what I’m really up to most nights.” As if sensing your next question, a smile crawls along his lips. “Cleaning up the city, that is.” He flicks his cigarette into a wet puddle, not seeming to understand the irony in the act. “Anyway—7th Avenue. Old condemned cigar factory. You can’t miss it. Got at least one of those things you’re after stored inside. Just give it a week or two before they get the message about the new passphrase. Then it’s all yours.” Then Desi loads a new magazine into his Thompson and turns to address his crew. “Now if you’ll excuse me, I have some imposters to root out.” You decide to leave before you’re forced to know exactly how he plans to do that.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *Desi is in your debt*.</li><li>In your Campaign Log, record *you know the passphrase*.</li><li>In your Campaign Log, under “Time Passed,” find the 6th spot from the current time. Under that spot, write “Θ.” (*When you reach that spot on the time track, proceed to status report theta Θ in the Status Reports section of the Campaign Guide.*) If there is fewer than 6 time remaining under “Time Passed,” write “Θ” under the final spot, instead.</li><li>_Remember not to look at the other side of Desiderio Delgado Álvarez when you clean up._</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: Though the danger seems to have receded, your worry only grows with each passing minute and each lost memory. Who did you come here with…? Who did you meet…? It all seems to blur together in your mind. You recall enough to know the fate that must have befallen those lost. No, not just the people—the distorted cloud chasing you throughout the city—the breathing walls, the shifting pavement, eyes in the lights, ears in the music—</p><p>You gasp for air as though choked by the night itself. It sounds impossible, but it must be: They took everything. Stole the walls, the sky, the city itself. Mind reeling, you flee through the rainy streets as though chased by horrors unimaginable. You push your way onto the first boat leaving the harbor and never look back. You don’t breathe easy until you know for sure the sky itself cannot devour you.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *the cell didn’t discover the truth in Havana*.</li><li>In your Campaign Log, record *you haven’t seen the last of Desi*.</li><li>Desiderio Delgado Álvarez is the bearer of The Mirroring Blade. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "档案#28-I",
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为阴影中敌人的数量(最多为3)。",
            "cultist": "-4。如果你检定失败，将一张诱饵放置入场，放到你所在地点，将其翻面，并正面朝下混洗你所在地的每张隐匿迷你卡牌。",
            "tablet": "-3。如果你检定失败，将每张投入本次检定的非弱点卡牌放在一边，位于场外，作为空洞。",
            "elderThing": "-1。如果你所在地点有隐匿迷你卡牌，受到1点伤害，或将本标记的修正值视为-3。"
          },
          "hardExpert": {
            "skull": "-X。X为阴影中敌人的数量(最多为5)。",
            "cultist": "-6。如果你检定失败，将一张诱饵放置入场，放到你所在地点，将其翻面，并正面朝下混洗你所在地的每张隐匿迷你卡牌。",
            "tablet": "-3。将每张投入本次检定的非弱点卡牌放在一边，位于场外，作为空洞。",
            "elderThing": "-1。如果你所在地点有隐匿迷你卡牌，受到2点伤害，或将本标记的修正值视为-5。"
          }
        },
        "tooltips": {
          "falseColorsV2": {
            "resign": "\"“我们不是有过交易吗？！”\"你趁着为时未晚溜出了这座城市。"
          }
        },
        "label": {
          "elderThing": "将本标记的修正值视为-{count}。",
          "silenceSpeaks": {
            "concealed": "查找遭遇牌库和遭遇弃牌堆，找出一个带有隐匿关键词的敌人并将其抽取*(结算其隐匿关键词)*。混洗遭遇牌库。",
            "hollowed": "揭示每位调查员牌库顶的卡牌。每位调查员抽取以此方式揭示的所有弱点。将揭示的所有其他卡牌放在一边，位于场外，作为空洞。"
          }
        },
        "intro": {
          "title": "档案#28-I: 疯星乱舞",
          "intro1Part1": "<p class='file'>在这趟古巴之旅中，找出红色同志会在哈瓦那的行动实在是再简单不过了。根据情报，欧瓦瑞兹先生经常一整晚都待在月下餐厅——这地方不仅当地人爱去，指望逃脱禁酒令铁律的美国游客也很热衷。这家店几乎通宵营业，摆出的酒种类之多，连最老道的私酒贩子看了也会瞪大眼睛。这里已是哈瓦那最火爆的酒吧了。</p><p>你在高峰时刻抵达，希望借助人潮混进去。据悉，已经有人警告欧瓦瑞兹先生你来了。你刚到店门口，就看到里面亮如白昼，顾客之多，水泄不通。店里传出现场演奏的爵士乐，许多人已经舞动狂欢起来——甚至还没进去就开始了。门口穿黑条纹西装的保安招呼了你，打量了你一番，但并不费心上手检查，也没有向你索要口令——所有合众国那些地下酒吧常见的进门试炼，这里都没有。</p><p>你一进门，就直奔酒保，费了好一番工夫才搭上话。你点了杯喝的，以作掩饰。你一提到自己在找德西德柔·欧瓦瑞兹先生，酒保的表情就变了。</p><p>他怀疑地眯起了眼睛，但还是朝屋后面点了点头，那里用绳索隔开了一条走廊，还有两个西装保镖护卫。你走了过去，保镖没有拦你，只是跟着你进去了。看来这就是店里的VIP区。在烟雾缭绕的昏暗房间里，坐着的可不就是“西装浸血的男子”——这外号可能是因为他红黑配色的穿搭——也可能只是一种隐喻。他打量着你，缓缓吸了一口指间的香烟。他旁边还坐着两个人：一位穿着红色西装背心的古巴老绅士，正吐出一大口烟圈；还有一位面露凶相的红衣女士，小抿了一口马提尼。他们三个的眼神冷冷透着杀机。</p><p>“这傻瓜是谁？”欧瓦瑞兹先生朝你身边护送的保镖问道。</p><p>“他们说想跟你谈谈，德西。”保镖支吾起来。</p><p>“噢，那给人家来点烈的，好吗？别傻站着。”护送你的人迅速点点头出去了，只留你在里面，面前三个人显然都是同志会的特工。“来，请坐。”你礼貌地拒绝了各种香烟，在桌边坐下。“所以，找我有什么事？”</p><p>你点点头，告诉欧瓦瑞兹先生他关系到你的调查。你知道他常来这家店，希望能简单地问他几个问题。红衣女子一下子不知从哪里抽出一柄长刀。但穿西装的男子伸出手来，她就把刀塞回刀带，用裙子盖住了。</p>",
          "policeOrDetective": "<div class='red'><p>_仅当有调查员具备_警察_或_执法_特性才能阅读：_男子露出一个友善的笑容。“请原谅我的朋友。她对警察有点……紧张。我相信你肯定能理解。”你解释说尽管自己看起来像是执法人员，但却不是来追踪任何违法案件的。这次绝对不是。“是啊，我觉得这都这么明显了。”他说道，“不。我想我其实还知道你为什么会来这儿……”</p></div>",
          "intro1Part2": "<p>“首先，叫我德西就行。大家都这么叫。我不喜欢搞得太正式。”他挥挥手，仿佛是要扇走房间里紧张的气氛。“其次，我不是‘常来’月下餐厅，这家店就是我的。发生了一次……管理权置换，几个月前的事了。我猜你的情报有点滞后了，嗯？”他笑了一声，在烟灰缸里拧灭了烟，然后马上掏出打火机，又点了一根。“那么，你为什么要跟我提到你的调查呢？”</p><p>你强调说自己只为找寻钥匙的位置，对德西在干的好事轻描淡写。</p><p>他的表情严肃起来，锐利得像生硬的石头。“这样。‘钥匙’，嗯？就为了这？好吧，那我们兴许可以互相帮助……”</p><p class='basic'>检查剧本日志中已经流逝了多少时间。</p>",
          "fewerThanTwentyTime": "流逝的_时间_小于20",
          "twentyOrMoreTime": "流逝的_时间_大于等于20",
          "intro2": "<p class='file'>德西叹了口气，对你和盘托出，这倒出乎他两个同伴的预料。“有什么盯上了我在哈瓦那的手下。一开始是几个新人，突然就不见了。接着就是几个跟了我很久的老手了，就那么消失不见了。”他说着打了个响指，“起初，我还以为是几个自大的对头想要扩张势力，不知道我究竟是谁的蠢货，这帮杂种会把整座城都毁了。”他灭掉香烟，盯着烟灰，仿佛里面能看出什么名堂。“奇怪的是，我不记得这些人的名字了。没人记得，这听起来是挺怪的，嗯？我从来不会忘记名字，从不。”他盯着你，冷若冰霜。“现在我不得不怀疑发生了更糟的事情。也就是你们这种人在处理的事情。”</p><p>你说自己也想知道，这种事情不正应该是他们这种人在处理吗。</p><p>“别把我跟他们混在一起。”他骂了一句，“我有自己的目的。现在——你有两个选择。要么帮我解决这个小问题，要么我跟我这儿的朋友把你解决了。你选哪一个？”</p><p>你想了一想，告诉德西你可以帮忙，但前提是他如果知道钥匙在哪，就得告诉你；如果他自己就有，也不能隐瞒。另两个同志会的特工死死盯着德西，但这是徒劳，他已经做了决定。</p><p>他伸出了手：“成交，但我也来，咱们一起干。没人能动了我的手下还全身而退。明晚再来——老时间，老地方。”你点点头走了，在哈瓦那老城的广场酒店订了个房间，好好休息了一番，准备明天的调查。</p><p class='basic right'>在剧本日志中，记录下*特别小组与德西达成交易*。<br />进入_冒险设置(版本一)_。<p>",
          "intro3": "<p class='file'>德西站起来踱着步子，明显是在考虑什么。“我的手下出事了。”他那位年长的同伴面色冷峻，一言不发，令人不安；而女士的表情则和德西一样焦急。“开始是几个人失踪了。我们还以为是被本地帮派或者类似的人做掉了。这帮杂种会把整座城都毁了。但是现在……”他摇摇头，前额挤出了担忧的皱纹。“我不记得他们是谁了。没人记得。每天都有更多的人消失。每次都——嘣——”他打了个响指——“没了，连记忆都没了。只依稀有点印象，他们在这儿过，现在却不在了。”他紧紧地盯着你，“听着耳熟吗？”</p><p>你点了点头。这场景相似得吓人。你告诉德西，可以帮他找出事件的原因，但前提是他如果知道钥匙在哪，就得告诉你；如果他自己就有，也不能隐瞒。女子咬着嘴唇，盯着德西，想知道他会不会答应。</p><p>长者则依然沉默，眼神还是一样的冷峻而朦胧，十分诡异。</p><p>德西和你握了握手，点了点头：“成交，但我也来，咱们一起干。没人能动了我的手下还全身而退。明晚再来——老时间，老地方。”你点点头走了，在哈瓦那老城的广场酒店订了个房间，好好休息了一番，准备明天的调查。</p>",
          "intro4": "<p class='file'>第二夜，你回到了月下餐厅，准备再次游过人潮，到德西的VIP室去。但你抵达的时候，却发现店关门了。你觉得德西肯定是歇店一夜，这样你们就能不受打扰地规划调查，于是试着拉开门把手。门轻易地开了，证实了你的猜测。你进了店，往后面的房间走去。整家店都是一片昏暗和寂静，颇为诡异。</p><p>你见过这里通常的样子，乐声鼎沸、游客熙攘，现在不免有些紧张。你的脚步声回荡在寂静的舞池里，传遍了整座店。附近有张凳子吱嘎作响。</p><p>太安静了。</p><p>你都来不及考虑自己是否身陷危局。这个念头刚闪过你的脑海，周围就爆发出一阵枪声。伏击！你本能地伏在地上，护住脸和耳朵。这阵骚动震耳欲聋。建筑前面的窗子都碎了，玻璃洒在了舞池里。子弹撕裂了吧台、餐桌和凳子。没有一件家具能够幸免。你只有几秒钟的反应时间——</p><p class='basic right'>在剧本日志中，记录下*特别小组遭到伏击*！<br />进入_冒险设置(版本二)_。</p>"
        },
        "setup": {
          "version1": {
            "gatherSets": "收齐以下遭遇组的所有卡牌：*疯星乱舞*、*域外使徒*、*扫荡团伙*、*猩红阴谋*、*秘密战争*、*重重疑云*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dancing-mad.png' /><img src='{setImgPath}/agents-of-the-outside.png' /><img src='{setImgPath}/cleanup-crew.png' /><img src='{setImgPath}/crimson-conspiracy.png' /><img src='{setImgPath}/secret-war.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /></section>",
            "actDeck": "仅使用场景1和2的(版本一)，以及场景3创建场景牌库。将场景1和2的(版本二)从游戏中移除。",
            "placeLocations": "将月下餐厅地点放置入场，*(追忆堡垒)*面朝上。",
            "beginPlay": "每位调查员从月下餐厅*(追忆堡垒)*开始游戏。",
            "remainingLocations": "将剩下的六张地点放置入场。",
            "desiderio": "找出两张德西德柔·戴佳多·欧瓦瑞兹敌人。其中一张另一面为剧情支援版本，而另一张则有标准的遭遇卡牌牌背。",
            "encounterVersion": "将遭遇卡牌牌背的版本放在一边，位于场外。",
            "assetVersion": "将另一版本翻至剧情支援面。",
            "takeControlOfDesiderio": "选择一位调查员控制德西德柔·戴佳多·欧瓦瑞兹剧情支援。",
            "setSetsOutOfPlay": "将*扫荡团伙*和*猩红阴谋*遭遇组放在一边，位于场外。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/cleanup-crew.png' /><img src='{setImgPath}/crimson-conspiracy.png' /></section>",
            "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：德西德柔·戴佳多·欧瓦瑞兹、同志会特工(A、B和C)、同志会刺客(A和B)和同志会打手(A和B)。将这些卡牌放在一边，位于场外。"
          },
          "version2": {
            "gatherSets": "收齐以下遭遇组的所有卡牌：*疯星乱舞*、*域外使徒*、*扫荡团伙*、*猩红阴谋*、*秘密战争*、*重重疑云*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dancing-mad.png' /><img src='{setImgPath}/agents-of-the-outside.png' /><img src='{setImgPath}/cleanup-crew.png' /><img src='{setImgPath}/crimson-conspiracy.png' /><img src='{setImgPath}/secret-war.png' /><img src='{setImgPath}/shadow-of-a-doubt.png' /></section>",
            "actDeck": "仅使用场景1和2的(版本二)，以及场景3创建场景牌库。将场景1和2的(版本一)从游戏中移除。",
            "placeLocations": "将月下餐厅地点放置入场，*(同志会据点)*面朝上。",
            "beginPlay": "每位调查员从月下餐厅*(同志会据点)*开始游戏。",
            "remainingLocations": "将其他所有地点放在一边，位于场外。",
            "desiderio": "找出两张德西德柔·戴佳多·欧瓦瑞兹敌人。其中一张另一面为剧情支援版本，而另一张则有标准的遭遇卡牌牌背。将这两张卡牌都放在一边，位于场外。",
            "setOutOfPlay": "将全部四张_域外_敌人放在一边，位于场外(2张异界仿体、2张常态颠扑者)。",
            "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：德西德柔·戴佳多·欧瓦瑞兹、同志会特工(A、B和C)、同志会刺客(A和B)和同志会打手(A和B)。将这些卡牌放在一边，位于场外。",
            "theShadows": "如下将敌人生成在阴影中：",
            "spawnDesiderio": "找出放在一边的遭遇卡牌牌背的德西德柔·戴佳多·欧瓦瑞兹敌人。调查员队长抽取该敌人，结算其隐匿关键词。",
            "spawnCoterie": "按照玩家顺序，其他每位调查员依次从遭遇牌顶弃掉卡牌，直到弃掉一张不同的_同志会_敌人。每位调查员抽取其弃掉的敌人，结算其隐匿关键词。将弃掉的其他每张卡牌混洗入遭遇牌库。"
          }
        },
        "resolutions": {
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败)_: 管他什么交易，你在哈瓦那都呆不下去了。你逃出城去，逃离枪林弹雨和扭曲的空间，逃离瓢泼大雨和翻滚的乌云，逃离每个街角皮囊和眉眼熟悉的仿体。终于，你不知靠了什么办法，成功逃出街道，在哈瓦那港征收了一条船，即刻开出。</p><p>等到心跳恢复正常，思维开始运转，你思考自己的所见，不禁担心起来。就此逃离确实谨慎，却可能会对未来有不利的影响。你既没有拿到钥匙，也没有找到什么蛛丝马迹。不过，纵使千钧一发，你还是活下来了，并且没被忘记——这肯定意味着什么。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*特别小组没有发现哈瓦那的真相*。</li><li>在剧本日志中，记录下*你和德西之间恩怨未了*。</li><li>德西德柔·戴佳多·欧瓦瑞兹拥有镜刃，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 德西召集剩余的手下开了一场临时会议，你简单陈述了今夜发生的事情。“我得好好把这件事理一理。”他对你懊恼地说道，“事实是他们会……嗯……你懂的，要是考虑这个，就不知道谁能信任了。”他看上去确实已经恢复正常。你做出的决定想必没错。只是……你又想到了在哈瓦那的雨街追着你不放的德西，想到了枪响和天上的扭曲。你不禁再次检查德西的眼神，想要找到任何迹象——任何——能看出他并非真正的德西。但你一无所获。是不是仿态在皮下待了太久，已经知道他举止如何？“唔。”他打断了你的思绪，“现在该是我履行交易了。‘黑鸟孤鸫’。”</p><p>你困惑地眨眨眼。“‘黑鸟孤鸫’，”他又重复了一遍，“只是在宜博市藏身点的一个口令。我每次派手下过去，都会轮换口令。这其实……不太常见。即便是同志会的其他成员也不知道怎么进去。</p><p>他们认为那不过是一处非法交易的窝点。我想他们之中大多数人并不明白我晚上都在干些什么。”他好像意识到了你的下一个问题，唇边缓缓扬起一个微笑，“当然是，清理城市。”他将香烟弹入水塘，似乎没意识到这有多么讽刺，“无论如何——第7大道。那家已经废弃的老卷烟厂。你肯定能找到。里面就有你在追逐的东西。过上一两周，等他们知道新的口令。那就是你的了。”德西随即给自己的汤姆逊装上一发新弹夹。“现在，要是你不介意，我得处理掉一些冒牌货。”你决定还是快走，免得被迫看到他要做的事。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录*德西欠你一笔*。</li><li>在剧本日志中，记录*你知道了口令*。</li><li>在剧本日志中，“流逝的时间”下方，从当前时间起往后数6格。在该格写下“Θ”。*(在你到达该格时，进入剧本手册中，状况报告部分的状况报告西塔Θ。)*如果“流逝的时间”下已不足6格，则改为在最后一格写下“Θ”。</li><li>_在你收拾游戏时，记住不要查看德西德柔·戴佳多·欧瓦瑞兹的另一面。_</li><li>在剧本日志中记2_时间_。你可以_启程_。</li>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 尽管危险渐渐远去，但你的忧虑随着时间流逝、记忆失去却不减反增。你是跟谁来这儿的……？你见了谁……？这在你脑子里全是一团浆糊。你回想起了一些事情，足以知道那些失去之人所必然遭受的命运。不，不只是人——还有追遍你全城的扭曲云朵——在呼吸的墙壁，变换莫测的人行道，光中的眼睛，乐声中的耳朵——</p><p>你猛吸一口气，仿佛被夜色扼住了喉咙一般。这听起来绝无可能，但这就是真相：他们夺走了一切。偷走了墙壁、天空，和整座城市。你的思绪天旋地转，慌忙逃出雨街，仿佛后面有什么不可思议的恐怖正追逐着你。你冲上第一艘离港的船，绝不回头看。你不敢呼吸，直到确认天空不会将你吞没才松了口气。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*特别小组没有发现哈瓦那的真相*。</li><li>在剧本日志中，记录下*你和德西之间恩怨未了*。</li><li>德西德柔·戴佳多·欧瓦瑞兹拥有镜刃，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 50,
        "missing": 0,
        "untranslated": 0,
        "present": 50,
        "specialRules": 0
      }
    },
    "onThinIce": {
      "id": "onThinIce",
      "name": "如履薄冰",
      "nameEn": "On Thin Ice",
      "referenceCode": "09609",
      "file": "scenarios/onThinIce.json",
      "sectionsEn": {
        "tokens": {
          "easyStandard": {
            "skull": "-X. X is the number of _Hazard_ treacheries in play.",
            "cultist": "-4. If you fail, choose a non-weakness card in your hand and set it aside, out of play, as a hollow.",
            "tablet": "-2 (-5 instead if Void Chimera is at your location).",
            "elderThing": "-3. If you fail, look at the top card of your deck. If it is not a weakness, set it aside, out of play, as a hollow."
          },
          "hardExpert": {
            "skull": "-X. X is 1 more than the number of _Hazard_ treacheries in play.",
            "cultist": "-5. Choose a non-weakness card in your hand and set it aside, out of play, as a hollow.",
            "tablet": "-3. If Void Chimera is at your location, you automatically fail, instead.",
            "elderThing": "-4. Look at the top card of your deck. If it is not a weakness, set it aside, out of play, as a hollow."
          }
        },
        "tooltips": {
          "anchorage": {
            "resign": "\"I thought Alaska was supposed to be nice this time of year!\""
          }
        },
        "intro": {
          "title": "On Thin Ice",
          "introPart1": "<p class='file'>You have only just checked into your lodge in Anchorage when you receive an unmarked package:</p><p class='typewriter'>Agents,<p><p class='typewriter'>We have lost contact with several operatives in central Alaska in recent weeks, likely due to Coterie activity. One operative was looking into a possible lead: a lens with apparent paradimensional capabilities. Enclosed is the journal of prospector Rhett Landry, currently institutionalized at Morningside Sanatorium in Oregon.</p><p class='typewriter'>If the lens is a Key, acquire it at all costs.</p><p class='accountant right'>~Q. Taylor</p><p>You spend a full day poring over the prospector’s journal, which is mostly comprised of wildlife sketches and notes on mining. However, the final entry is chilling:</p><p class='indented'>“October the 4th, 1923:</p><p class='indented'>Tonight, I bury that accursed lens where I found it.</p><p class='indented'>I dared not commit my thoughts to the page after finding it, but I have nothing to lose now. While surveying the new branch in the mine, I found a curious lens buried in the rock. It was opaque and emanated a beguiling light. Holding it made me feel special. As if I had been chosen. Looking through it, I saw incredible plants, creatures, people, structures, in a strange otherworldly landscape. A world beyond our own. A world that should exist. A dark reflection of our own: a haven for lost objects, lost memories. The lens—the Sable Glass—is the mirror that shows the truth of this other world.</p><p class='indented'>How foolish was I to think I could use the lens for my own gain! The more I looked at the other world, the more the other world looked back. By peering into the glass, I must have called something—some awful, nameless creature—through. More and more of my fellow prospectors went missing in the woods and erased from memory. My companions, my possessions, my home: all were swallowed by the strange creature I glimpsed in the Sable Glass. And now when I look through it, I can see them, there, in that other place.</p><p class='indented'>The creature that stalks the woods is made of nothing, and yet it is many things: constantly shifting, ever-changing. It has the traits of many animals, like a chimera from old myths. I tried to hunt it using the Sable Glass, but looking at it made my head spin. After surveying the area, I set a trap and thought I killed one of its forms: a great lupine thing that howled and dissipated into nothingness. But when I returned to camp the next day, it had struck the camp. My companions have vanished from memory and space.</p><p class='indented'>The authorities say I should be locked up. My only hope is to set things right, to put the Sable Glass back where I found it. Perhaps then everything will be right again.”</p><p>Next to the journal entry is an array of dark scratches, which you had assumed were nervous scribbles. However, given Landry’s account, you wonder if it isn’t his attempt to sketch the creature. The next day, you launch a search for any record of Mr. Landry’s gold mine, starting with prospecting permissions in Anchorage City Hall and the local library. After a day of fruitless research, you still cannot find an official permit or record of a mine connected to Rhett Landry. As you return to the lodge that evening, you spot a tall, willowy figure with a distinctive red cravat standing next to a packed sledge.</p><p>“Well met,” the figure greets you with a self-satisfied smile. “You must be the troublemakers everyone is talking about. Pleased to make your acquaintance. I’m Thorne.” They extend a confident hand to shake yours. “If you’re here, I can only assume it is for the same reason as I. Keep a weather eye out: it’s supposed to be quite cold near Fairbanks! May the best one win.” Thorne winks at you, then mounts the sled.</p><p>You wonder if Thorne’s reference to Fairbanks was clever misdirection or a friendly hint. After asking around the lodge, an attendant opens up about your rival’s preparations: “I was confused at first, until it became clear they were asking about something in tribal territory. You don’t need a permit to prospect out there.” After some more questioning, you have a good sense of Thorne’s direction and the location of the mine.</p>",
          "wayfarer": "<div class='red'><p>_Ready only if an investigator has the Wayfarer trait:_</p><p>Wherever you’re going, you want to follow the river. Gold mines are usually built within 100 yards of a river, and are often connected to the river by a channel for fresh water and silt for panning.</p></div>",
          "introPart2": "<p>Before you head out, you ask for directions from a local member of the tribe that owns the territory where you think the mine could be. They are wary of more meddling from outsiders and also concerned for your safety, given the recent trouble with prospectors on their land. You explain you aren’t interested in gold, and are researching the strange case of Mr. Landry. For good measure, you show them the prospector’s journal and the strange etching inside. This seems to buy you some trust, and the tribe member offers some directions.</p><p>“Be especially careful crossing the rivers this time of year,” they tell you. “It’s easy to lose your way, and even easier to fall through the ice. You’ll catch your death out there if you aren’t careful.”</p><p class='basic right'>Proceed to _Setup_.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: *On Thin Ice*, *Agents of the Outside*, *Agents of Yuggoth*, *Crimson Conspiracy*, *Dark Veiling*, *Outsiders*, *Spatial Anomaly*, *Chilling Cold*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/on-thin-ice.png'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/agents-of-yuggoth.png'><img src='{setImgPath}/crimson-conspiracy.png'><img src='{setImgPath}/dark-veiling.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/chilling-cold.png'></section>",
          "placeLocations": "Put the Anchorage and Fairbanks locations into play. Each investigator begins play at Anchorage.",
          "wilderness": "Shuffle the three Alaskan Wilderness locations (Mountain Stream, Isolated Road, and Frozen Lake) together facedown so you do not know which is which. Put each of them into play adjacent to Fairbanks. Set the remaining three Outer Wilderness locations aside, out of play.",
          "setOutOfPlay": "Set each of the following cards aside, out of play: The Sable Glass key, the double-sided Thorne enemy/story asset, and each copy of the Void Chimera enemy.",
          "miniCards": "Gather each decoy mini-card and each of the following mini‑cards: Emissary from Yuggoth, and Coterie Agents (A, B and C). Also gather the Void Chimera’s mini-card and the four special Void Chimera decoys. Set them aside, out of play.",
          "time": "Check how much _time_ has passed in the Campaign Log. For every 5 _time_ that has passed, add 1 doom to agenda 1."
        },
        "rawDeal": {
          "label": {
            "option3": "“We’ll work with you for now.”",
            "option4": "“No. We won, fair and square.”",
            "option5": "“We can’t let the Key fall into Coterie hands!”"
          },
          "checkAgenda": "Check the current agenda.",
          "agenda1": "If it is agenda 1, proceed to _Raw Deal 1_.",
          "notAgenda1": "If it is agenda 2 or 3, skip to _Raw Deal 2_.",
          "rawDeal1": "<p>_Raw Deal 1_: “What a reunion!” Thorne exclaims. “It would appear you’ve bested me fair and square in this little tête-à-tête. I’m rather impressed. In my experience, such competence is beyond the Foundation. Now, I believe we have a bit of business to discuss. Please, have a seat.” Thorne says, snapping their fingers. Several Coterie members bring you to a covered awning with a fire and some chairs. Once seated, Thorne clears their throat. “Now then. We both know you have something I want. Something worth untold fortunes. Though I highly doubt you are interested in money. But what if I told you about a greater threat?” Their tone is joking, but their expression is grave. You ask them to explain. “Surely you realize it: I am not the threat here. There is something terrible that stalks these woods. The ultimate predator. As soon as you laid hands on the Sable Glass, your lives were forfeit. It will hunt you down and consume every part of you until there is nothing left, as it has done to many others.” You nod along, considering Thorne’s words. “Luckily for you, this creature is an old enemy of mine. I am uniquely suited to track its movements and lure it out.” Thorne leans forward intently. “For my services, all I ask is the Sable Glass. Believe me, you want someone that knows how to properly operate the thing, anyway.” Thorne offers their gloved hand to shake once again. “So tell me. Do we have a deal?”</p><p class='basic'>The investigators must decide (choose one).</p><ul><li>*“We’ll work with you for now.”* Skip to _Raw Deal 3_.</li><li>*“No. We won, fair and square.”* Skip to _Raw Deal 4_.</li></ul>",
          "rawDeal2": "<p>_Raw Deal 2_: “Oh goodness gracious,” Thorne says, emerging from the mine. “Put that down at once, you oaf! This is no way to treat guests,” they snap at the guards, who lower their weapons. “You’re too late, I’m afraid. Or rather, just in time, I suppose, depending on your perspective.” Thorne brandishes an obsidian lens in one hand as they smirk. Remembering the Foundation dossier, you ask Thorne if there is anything you can do to negotiate for the Key. They shake their head. “I’m afraid not, kitten. A Key in hand is worth, well, fortunes. Not that I would sell it for anything in the world.” They clutch the Sable Glass in one hand as a chill wind blows. “However, there’s still time to make a deal. If you weren’t completely daft, you’d have noticed this entire area is in grave danger. Something truly terrible stalks these woods. The ultimate predator. In fact, it already knows we’re here.” Thorne looks to you. “The way I see it, you can pout about not getting your prize, or you can help me track my quarry. Do that and I’ll owe you a favor, to be paid at a later date. Do we have a deal?”</p><p class='basic'>The investigators must decide (choose one).</p><ul><li>*“We’ll work with you for now.”* Proceed to _Raw Deal 3_.</li><li>*“We can’t let the Key fall into Coterie hands!”* Skip to _Raw Deal 5_.</li></ul>",
          "rawDeal3": "<p>_Raw Deal 3_: “Brilliant! We shall have to pop some champagne when this is all over and done.” Thorne snaps their fingers, calling their cohorts to attention. “I believe we have some work to do.”</p><ul><li>In your Campaign Log, record *the cell made a deal with Thorne*.</li><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>Put the Thorne story asset into play under the lead investigator’s control and attach The Sable Glass key to Thorne, _Stable_ side faceup.</li><li>Search the encounter deck, discard pile and all play areas for all cards from the *Crimson Conspiracy* encounter set and remove them from the game.</li></ul>",
          "rawDeal4": "<p>_Raw Deal 4_: Thorne’s expression sours as their hand hangs unshaken between you. Finally, they clear their throat and adjust their cravat. “Regrettable. I had hoped for better. Oh well. There is more than one way to skin a cat.” Then, without another word, they stride out of the mine.</p><ul><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>Put The Sable Glass key into play under the lead investigator’s control.</li><li>Spawn the Thorne enemy at the Mountain Stream location.</li></ul>",
          "rawDeal5": "<p>_Raw Deal 5_: Thorne shrugs and runs their finger over the rim of the dark, warped lens in their hands. “Your loss. We could have worked together on this. But I suppose I shall have to settle for a little bit of sport, after all. Very well.” They stride out through the mine’s entrance, prize in tow, and snap their fingers to summon the rest of their crew to follow.</p><ul><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>Spawn the Thorne enemy at the Mountain Stream location. Attach The Sable Glass key to Thorne, _Unstable_ side faceup.</li></ul>"
        },
        "resolutions": {
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated)_: Your encounter with the paradimensional threat leaves you drained and disheartened, but still alive. As you make preparations to leave Alaska, you find the prospector’s journal amongst your possessions. With a sigh, you stow it in the bedside table of your lodge room for the next guest. Perhaps they will do what you could not.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.<li>In your Campaign Log, record *The Void Chimera escaped*.</li><li>Update the Keys section of your Campaign Log as follows:<ul><li>Check the Campaign Log. *If the cell made a deal with Thorne* or no investigator controls The Sable Glass, Thorne is the bearer of The Sable Glass.</li><li>If an investigator controls The Sable Glass, they are the bearer of The Sable Glass. In your Campaign Log, record *you haven’t seen the last of Thorne*.</li></ul></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: A scent of ozone hisses out of the closing tear in reality as your surroundings come back into view. You are back in Alaska where the chimeric entity pulled you into its lair. As you stand up, Thorne pulls out a handkerchief to wipe slick extradimensional blood off of their sleeve. They cock an eyebrow at you. “Perhaps I was wrong about you Foundation types. If nothing else, you know how to hold your own in a fight. Though I would recommend you reconsider your stance on my fellow Coterie brethren and myself. I do not believe I am the only member of the Coterie who is willing to put aside petty differences in the face of such—” they pause, and in that moment, you sense Thorne’s age and gravity. “Such a monumental crisis.” With that, Thorne smiles and swiftly turns on their heel. “Pleasure doing business with you. And rest assured, I will not forget our agreement.” They pat the Sable Glass in their breast pocket and stride away into the wilderness.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Thorne is the bearer of The Sable Glass. Update the Campaign Log accordingly.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: A scent of ozone hisses out of the closing tear in reality as your surroundings come back into view. You are back in Alaska where the chimeric entity pulled you into its lair. As you struggle to stand, Thorne arrives and helps you to your feet. “Given that you are, well, alive, I suppose you have properly dispatched the beast. Well fought!” Thorne grins and winks at you. Instinctively, you put your hand on the Sable Glass. “Bah, do not take me for a boor,” says Thorne. “The Key is yours, fair and square. The game is up. I am not one to contest a proper victory. In truth, had you been more cooperative, I would have put in a word with the Coterie to recruit you.” They sigh, and in that moment, you sense Thorne’s age and gravity. “Not all of us are as good-natured as I, mind you. But do not take good nature for weakness, kitten. One bad turn begets another.” They wink, then stride away into the wilderness.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of Thorne.*</li><li>The investigator who controls The Sable Glass is its bearer.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: A scent of ozone hisses out of the closing tear in reality as your surroundings come back into view. You are back in Alaska where the chimeric entity pulled you into its lair. The forest around you is deafeningly silent, save for the trickle of a nearby mountain stream. With no corpse or trail left behind, you wonder if you truly defeated the paradimensional beast for good, or if you simply struck down one of its myriad forms. The glare of the sun on the snow blinds you as you pick your way through the wilderness back to safety. After cresting a hill, you turn back to see another figure standing, silent, against the wide blue sky. As you squint, you see Thorne’s distinct red cravat, their platinum blonde hair and fluttering jacket. They are staring back at you, smiling widely.</p><p>The skin on the back of your neck prickles. Your head begins to pound as you stare at Thorne, standing silently, unmoving. You raise one hand to wave. They raise their hand in a mirror motion and wave back, and abruptly lower their hand when you lower yours. Something about how they look at you fills you with a deep sense of foreboding. Doing your best to banish the thought, you turn away from Thorne and continue your walk home. As you look back at the crest of another hill, you see the figure still standing, unmoving.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *Thorne disappeared*.</li><li>Update the Keys section of your Campaign Log as follows:<ul><li>If an investigator controls The Sable Glass, that investigator is the bearer of The Sable Glass.</li><li>If no investigator controls The Sable Glass, Thorne is the bearer of The Sable Glass.</li></ul></li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution4": {
            "title": "Resolution 4",
            "body": "<p>_Resolution 4_: You wake up in your lodge room in Anchorage from what you think was a very bad dream, though you struggle to remember the details. As you walk around town, you can’t even remember why you came here. When you relay this to the Foundation via telegram, you receive a strongly-worded missive warning you against wasting official resources. You still can’t shake the feeling that you are missing something, though.</p><ul><li>This scenario never happened.<ul><li>Do not mark any time in your Campaign Log.</li><li>Do not record any experience gained or trauma suffered from On Thin Ice.</li><li>Do not update the Keys section of the Campaign Log.</li><li>In your Campaign Log, record there is nothing of note in Anchorage. You cannot stop there again for the remainder of the campaign.</li></ul></li><li>You may embark, departing from Anchorage.</li></ul>"
          }
        }
      },
      "sections": {
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为场上_危险_诡计的数量。",
            "cultist": "-4。如果你检定失败，选择你手中一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。",
            "tablet": "-2(如果虚空奇美拉在你的地点，改为-5)。",
            "elderThing": "-3。如果你检定失败，查看你牌库顶的卡牌。如果不是弱点，将其放在一边，位于场外，作为一个空洞。"
          },
          "hardExpert": {
            "skull": "-X。X为场上危险_诡计_的数量+1。",
            "cultist": "-5。如果你检定失败，选择你手中一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。",
            "tablet": "-3。如果虚空奇美拉在你的地点，改为你自动失败。",
            "elderThing": "-4。查看你牌库顶的卡牌。如果不是弱点，将其放在一边，位于场外，作为一个空洞。"
          }
        },
        "tooltips": {
          "anchorage": {
            "resign": "\"“我还以为每年这时候阿拉斯加的天气能好点儿呢！”\""
          }
        },
        "intro": {
          "title": "如履薄冰",
          "introPart1": "<p class='file'>你刚在安克雷奇办理入住，就收到了一份没有标签的包裹。</p><p class='typewriter'>特工们，<p><p class='typewriter'>我们最近几周和阿拉斯加中部的几名特工失去了联系，可能是由于同志会的活动。其中一名特工正在寻找一条可能的迹象：一件具有超维能力的透镜。随信附上勘探员瑞特·兰道里的日志。他已于最近收至俄勒冈的晨际疗养院。</p><p class='typewriter'>如果棱镜确为钥匙。不惜一切代价夺取。</p><p class='accountant right'>~Q.泰勒</p><p>你花了一整天时间钻研勘探员的日志，里面全是野生动物的素描和矿采笔记。但最后一篇却叫人毛骨悚然。</p><p class='indented'>“1923年10月4日:</p><p class='indented'>今天我把那该死的棱镜埋在了找到的地方。</p><p class='indented'>自打找到以后，我就不敢把自己所想落在纸上，但我现在已经没有什么可失去的了。我勘察了矿脉一支全新的分岔，这时候在岩石底下找到了这个奇异的棱镜。它呈椭圆形，发出醉人的光线。我将其收归己有，感觉自己非同一般，仿佛是被选中的一样。我透过它看见了不可思议的植物、动物、人、建筑和诡奇的异星景观。一个在我们世界之外的世界。一个理应存在的世界。它是我们世界的黑暗倒影：安放了失去的东西、失去的记忆。这个棱镜——玄丧之镜——映出了异界的真貌。</p><p class='indented'>我居然幻想能将棱镜收归己用，实在是太愚蠢了！我朝异界窥看得越多，异界也回望我越多。我朝镜中窥探的时候，肯定召唤出了什么——某些骇人可怕、无可名状的东西。越来越多的勘探同行消失在树林中，失落在记忆里。我的同伴，我的财产，我的家园，都被我在玄丧之镜里窥见的诡异生物吞没了。我再透过它看的时候，只看到它们就在里面，就在异界。</p><p class='indented'>在林地里逡巡的野兽既是无物，也是万物，它一直变换，绝不停歇，同时具备多种生物的特性，仿佛古老神话里的奇美拉。我试着用玄丧之镜将其捕获，但只是看它一眼我就头晕目眩。勘测这片区域后，我设下陷阱，以为自己至少能杀死其中一个形态：一头嚎叫的巨大狼性生物，分解成了一片虚无。但当我第二天返回营地的时候，却发现它已经在这儿肆虐过了。我的同伴在空间和记忆里消失了。</p><p class='indented'>当局说我应该被严加看管起来。我现在只希望让事情回到正轨，将玄丧之镜放回我找到它的地方。也许这样一切就会正常。”</p><p class='indented'>在这篇日志旁有一团漆黑的痕迹，你猜是一片紧张中留下的草稿。看了兰道里的记录，你不由得怀疑是他想画下那怪物的样子。第二天，你出发寻找哪里有关于兰道里笔下金矿的记录。希望能在安克雷奇市政厅或图书馆里找到探采许可。但一天下来，一无所获，没有任何官方的许可或是记录提到瑞特·兰道里的金矿。你晚上回到旅舍，却发现那里站着个纤瘦高个子，戴着显眼的红色长巾，身边还立着一架折叠雪橇。</p><p>“幸会。”来者朝你露出得意的微笑，权当是打招呼。“你肯定就是大家口中的那个麻烦精了。很荣幸与你见面。我是索恩。”他自信满满地和你握了握手，“既然你都在这儿了，那只可能是因为我们有着共同的目标。留心天气：费尔班克斯附近可冷得很。愿强者得胜。”索恩朝你眨了眨眼睛，骑着雪橇走了。</p><p>你不能确定索恩提到费尔班克斯是精明的调虎离山还是善意的提醒。但你在旅馆里问了一圈，就从招待员那里搞清楚对手先前做了什么：“我一开始都糊涂了，直到那人问起部族边境上的什么东西才明白过来。在那儿勘探是不需要许可的。”你又盘问了一番，觉得自己知道索恩去哪儿了，也明白了矿脉的位置。</p>",
          "wayfarer": "<div class='red'><p>_仅当有调查员具备旅人特性才能阅读：_</p><p>你打算沿河前行。金矿通常都在河岸百码之内，常常与河道联通，这样才能获得淡水，用于淘金。</p></div>",
          "introPart2": "<p>你出发前，向拥有那块土地的部族当地成员问路，提及你觉得金矿应在的地方。考虑到最近土地上勘探员引发的麻烦，他们其实很警惕会跟外来者有什么瓜葛，也是在担心你的安全。你解释说自己对金子并不感兴趣，而是在调查和兰道里先生相关的奇异事件。你还掏出了勘探员的日志，给他们看看里面奇怪的刻画。这似乎为你赢得了一些信任，部族成员愿意为你指引方向。</p><p>“这几年过河要尤其小心。”他们告诉你，“很容易迷路，更容易摔到冰下面去。要是不当心，就会送命。”</p><p class='basic right'>进入_冒险设置_。</p>"
        },
        "setup": {
          "gatherSets": "收齐以下遭遇组的所有卡牌：*如履薄冰*、*域外使徒*、*犹格斯星使徒*、*猩红阴谋*、*黑暗笼罩*、*域外来客*、*空间异常*、*寒冷刺骨*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/on-thin-ice.png'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/agents-of-yuggoth.png'><img src='{setImgPath}/crimson-conspiracy.png'><img src='{setImgPath}/dark-veiling.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/chilling-cold.png'></section>",
          "placeLocations": "将安克雷奇和费尔班克斯地点放置入场。每位调查员从安克雷奇开始游戏。",
          "wilderness": "将三张阿拉斯加荒地地点(山间溪流、偏远小路、冰封湖面)一起正面朝下混洗至无法分辨。将这些地点都放置入场，与费尔班克斯相邻。将剩下的三张界外荒地地点放在一边，位于场外。",
          "setOutOfPlay": "将下列卡牌放在一边，位于场外：玄丧之镜钥匙、双面的索恩敌人/剧情支援、每张虚空奇美拉敌人。",
          "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：犹格斯星的密使、同志会特工(A、B、C)。一并收齐虚空奇美拉的迷你卡牌和四张特殊的虚空奇美拉诱饵。将这些卡牌放在一边，位于场外。",
          "time": "检查剧本日志中已经流逝了多少_时间_。每流逝5_时间_，在密谋1a上增加1个毁灭标记。"
        },
        "rawDeal": {
          "label": {
            "option3": "“我们目前可以合作。”",
            "option4": "“不，我们赢了，光明正大。”",
            "option5": "“我们可不能让钥匙落入同志会手里！”"
          },
          "checkAgenda": "检查当前密谋。",
          "agenda1": "是密谋1。",
          "notAgenda1": "是密谋2或3。",
          "rawDeal1": "<p>“好一场重逢！”索恩叫道，“看来你在这场小小的私人竞赛中超过了我，光明正大。真是让人印象深刻。在我的经验中，基金会还会没有这样的本事。现在，我觉得咱们有点生意要谈了。请坐！”索恩说着打了个响指。几个同志会成员将你带到雪篷下。这里点了篝火，还有几把椅子。一落座，索恩就清了清喉咙：“现在，咱们都知道你手中我有想要的东西。这东西可是价值连城。尽管我也怀疑你可能对钱并不感兴趣。但要是我告诉你另有可怕的威胁呢？”尽管索恩的语调戏谑，表情倒是严肃。你要求进一步的解释。“你很清楚吧：我并不是此地的威胁。真正可怕的东西在树林游荡，那是终极的捕食者。拿着玄丧之镜就等于自杀。它会追上你，将你每分每寸都吃干净，什么也不剩下，就像对其他那么多人已经干的一样。”你一直点头，思量着索恩的话。“幸运的是，我一直与这怪物为敌。我有独特的方法可以追踪它的轨迹，将它引走。”索恩刻意地前倾，“而我要的只是玄丧之镜。相信我，无论如何，你最终都希望是真正明白如何妥善处理的人来使用这件东西。”索恩伸出自己戴手套的手，又想和你握手。“那么，我们成交了吗？”</p><p class='basic'>调查员必须决定（选择一项）：</p><ul><li>*“我们目前可以合作。”*</li><li>*“不，我们赢了，光明正大。”*</li></ul>",
          "rawDeal2": "<p>“噢，我仁慈的老天爷啊。”索恩说着从矿里出来了，“马上把那东西放下，你这蠢货！这可不是待客之道。”在索恩的厉喝下，保镖放下了武器。“恐怕你来得太迟了。或者也可以说，是刚刚好，这就取决于你怎么看了。”索恩一手挥舞着黑色石棱镜冷笑道。你记得基金会的密档里说了什么，于是问索恩关于钥匙能不能协商协商。索恩摇了摇头：“恐怕不行，小猫咪。钥匙在手就意味着，嗯，财富。尽管拿来世界上一切我也不换。”寒风吹过，索恩将玄丧之镜抓紧。“不过，确实是有时间谈谈交易。只要不傻，你肯定就已经发现这里整片区域都十分危险。树林间游荡着真正可怕的东西：那是终极的捕食者。它其实已经知道我们在这儿了。”索恩看向你，“要我看，你要不空手而归，要不帮我追逐猎物。这样工的话，我就欠你一笔，日后偿还。成交吗？”</p><p class='basic'>调查员必须决定（选择一项）：</p><ul><li>*“我们目前可以合作。”*</li><li>*“我们可不能让钥匙落入同志会手里！”*</li></ul>",
          "rawDeal3": "<p>“太好了！等这里的事情都结束了，我们得开几瓶香槟。”索恩打了个响指，召唤同伙注意。“我们还有事要做。”</p><ul><li>在剧本日志中，记录下*特别小组与索恩达成交易*。</li><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>将索恩剧情支援放置入场，由调查员队长控制，并将玄丧之镜钥匙附属到索恩，_稳定_面朝上。</li><li>查找遭遇牌库、遭遇弃牌堆和所有游戏区域，找出*猩红阴谋*遭遇组的所有卡牌，从游戏中移除。</li></ul>",
          "rawDeal4": "<p>你没有握手。索恩的表情僵住了，只能清清嗓子，理了理领巾。“真遗憾。我本来还期望能有更好的结局。好吧，方法总比问题多。”索恩不发一语，大步迈出了金矿。</p><ul><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>将玄丧之镜钥匙放置入场，由调查员队长控制。</li><li>将索恩敌人生成在山间溪流地点。</li></ul>",
          "rawDeal5": "<p>索恩耸耸肩，两手摩挲着黑暗扭曲的棱镜边缘。“反正吃亏的是你。我们本来可以协作的。但看来，我还是得另找别的消遣了。咱们就这样吧。”索恩大步走出矿井，东西攥在手里，一边打着响指召唤同伙跟上。</p><ul><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>将索恩敌人生成在山间溪流地点。将玄丧之镜钥匙附属到索恩，_动荡_面朝上。</li></ul>"
        },
        "resolutions": {
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败)_: 你和超维的威胁打了个照面，精疲力尽，灰心丧气，但至少还活着。你准备离开阿拉斯加，在行李中发现了勘探员的日志。你叹了口气，将其扔到房间的床头柜里，等下一位客人发现。也许后来人能完成你未竟之事。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。<li>在剧本日志中，记录*虚空奇美拉逃脱*。</li><li>如下更新剧本日志的钥匙部分：<ul><li>检查剧本日志。如果*特别小组与索恩达成交易*，或没有调查员控制玄丧之镜，则索恩拥有玄丧之镜。</li><li>如果有调查员控制玄丧之镜，则其拥有玄丧之镜。在剧本日志中，记录下*你和索恩之间恩怨未了*。</li></ul></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 现实的裂缝就要关闭，从中散发出一阵恶臭。你周围的环境又回来了。奇美拉将你拖进了它的巢穴，但你现在回到了阿拉斯加。你站了起来。索恩掏出手帕擦掉自己袖子上滑溜溜的异界之血，朝你扬起眉毛：“也许我误会了你们基金会的人。就算你们不懂别的，至少也知道怎么战斗。我建议你们重新考虑一下跟我的同志会同胞，还有我自己的关系。我相信同志会还有人愿意求同存异，尤其是面对这些——”索恩停了停，你这时候才感受到对方德高望重的气场——“这些巨大的威胁。”说完，索恩笑着迅速转身：“很荣幸能和你做生意。请放心，我不会忘记我们的协议。”索恩将玄丧之镜放进自己的胸袋，大步走进荒地之中。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>索恩拥有玄丧之镜，相应更新在剧本日志中。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 现实的裂缝就要关闭，从中散发出一阵恶臭。你周围的环境又回来了。奇美拉将你拖进了它的巢穴，但你现在回到了阿拉斯加。你奋力站起，索恩及时抵达，拉了你一把。“既然你在这儿还活得好好的，那我想你已经解决了那头野兽。打得漂亮！”索恩笑着朝你眨眨眼。你本能地将手放在玄丧之镜上。“啊，别把我想得这么无礼。”索恩说道，“钥匙是你的，光明正大。游戏已经结束了。我不会对一场公正的胜利有什么抗议。说实话，要是你能更配合一点儿，我还会劝说同志会接受你入伙呢。”索恩叹了口气，你这时候才感受到对方德高望重的气场。“注意了，可不是人人都像我一样天性善良。但不要把善良当软弱，小猫咪。礼尚往来。”索恩眨了眨眼，大步迈入荒地。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和索恩之间恩怨未了*。</li><li>控制玄丧之镜的调查员拥有它。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 现实的裂缝就要关闭，从中散发出一阵恶臭。你周围的环境又回来了。奇美拉将你拖进了它的巢穴，但你现在回到了阿拉斯加。你周围的森林一片寂静，震耳欲聋，唯有山涧的流淌声远远传来。没有尸体，也没有痕迹，你不禁怀疑自己是否真的击败了超维野兽，抑或只是打倒了它万千分身之一。你在荒地中寻路返回安全的地方，阳光照在雪上，令人目盲。你爬上山丘，却看到广袤的蓝天下另一个身影沉默地站着。你眯起眼睛，看到索恩标志性的红色长巾、铂金色的头发和风中飘动的夹克。索恩咧开嘴笑了，回望着你。</p><p>你脖颈后皮突然一阵刺痛。索恩静静站着，一动不动。你盯着，脑子里却一阵炸痛。你抬起一只手挥了挥。索恩也镜像似的挥了回来。你放下手，索恩也猛地放低。你突然想到索恩是怎么看你的，意识深处突然有了一种预感。你尽力挥别这种感觉，不再看索恩，继续踏上回家的路。你回望丘顶，却看到那个身影还是静静站着，一动不动。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*索恩消失*。</li><li>如下更新剧本日志的钥匙部分：<ul><li>如果有调查员控制黑曜透镜, 控制玄丧之镜的调查员拥有它。</li><li>如果没有调查员控制玄丧之镜，则索恩拥有玄丧之镜。</li></ul></li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          },
          "resolution4": {
            "title": "结局4",
            "body": "<p>_结局4_: 你在安克雷奇宾馆的房间里醒来，觉得自己做了一场可怕的噩梦，但你回想细节，却怎么也记不清。你走遍城镇，也想不起自己为什么来这儿。你电报回复基金会，换来一份言辞犀利的回信，警告你浪费了官方的资源。尽管如此，你还是觉得自己错过了什么。</p><ul><li>本冒险从未发生。<ul><li>在剧本日志中不记录任何_时间_。</li><li>不要记录任何从如履薄冰取得的经验值或承受的创伤。</li><li>不要更新剧本日志的钥匙部分。</li><li>在剧本日志中，记录下*安克雷奇无事发生*。直到剧本结束，你不能再在此地停留。</li></ul></li><li>你可以_启程_，离开安克雷奇。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 40,
        "missing": 0,
        "untranslated": 0,
        "present": 40,
        "specialRules": 0
      }
    },
    "dogsOfWar": {
      "id": "dogsOfWar",
      "name": "战争疮痍",
      "nameEn": "Dogs of War",
      "referenceCode": "09635",
      "file": "scenarios/dogsOfWar.json",
      "sectionsEn": {
        "heading": "File #38–N",
        "tokens": {
          "easyStandard": {
            "skull": "–1 (-3 instead if you are at a location with a Key Locus).",
            "cultist": "–3. If you fail, either take 1 damage and 1 horror, or place 1 doom on the nearest Key Locus or _Locus Site_ location.",
            "tablet": "–2. If this is an attack against an enemy with patrol, after this attack, it disengages and resolves its patrol keyword.",
            "elderThing": "-2. For each point you fail by, lose 1 resource (max 3)."
          },
          "hardExpert": {
            "skull": "–2 (-4 instead if you are at a location with a Key Locus).",
            "cultist": "–5. If you fail, either take 1 damage and 1 horror, or place 1 doom on the nearest Key Locus or _Locus Site_ location.",
            "tablet": "–2. If this is an attack against an enemy with patrol, after this attack, it attacks you, disengages, and resolves its patrol keyword.",
            "elderThing": "-3. For each point you fail by, lose 1 resource."
          }
        },
        "tooltips": {
          "catacombsOfKomElShoqafa": {
            "investigate": "{'{'}action{'}'}: Investigate. If you succeed, instead of discovering clues, draw 3 cards. You may reduce the difficulty of this test by 2. If you do, draw 1 fewer card if you succeed. (Group limit once per round.)"
          },
          "theBourse": {
            "investigate": "{'{'}action{'}'}: Investigate. If you succeed, instead of discovering clues, gain 4 resources. You may reduce the difficulty of this test by 2. If you do, gain 2 fewer resources if you succeed. (Group limit once per round.)"
          },
          "theClaretKnight": {
            "to": "{'{'}fast{'}'} Exhaust The Claret Knight: Move up to 3 resources from your resource pool to The Claret Knight.",
            "from": "{'{'}fast{'}'} Exhaust The Claret Knight: Move up to 3 resources from The Claret Knight to your resource pool, or to an asset you control as charges, ammo, supplies, or secrets."
          }
        },
        "label": {
          "theClaretKnight": {
            "resources": "Move up to 3 resources"
          },
          "zanEtElSettat": {
            "increaseFight": "Increase that enemy's fight by 2 for this attack."
          },
          "catacombsOfKomElShoqafa": {
            "reduceDifficulty": "Reduce difficulty by 2 and draw 1 fewer card",
            "doNotReduce": "Do not reduce",
            "pay": "Pay 1{'{'}perPlayer{'}'} clues",
            "doNotPay": "Do not pay"
          },
          "theBourse": {
            "reduceDifficulty": "Reduce difficulty by 2 and gain 2 fewer resources",
            "doNotReduce": "Do not reduce",
            "pay": "Pay 1{'{'}perPlayer{'}'} clues",
            "doNotPay": "Do not pay"
          }
        },
        "intro": {
          "title": "File #38–N: Dogs of War",
          "label": {
            "weAccept": "*“Very well, we accept.”*",
            "refuse": "Refuse"
          },
          "fewerThanTwentyTime": "If fewer than 20 _time_ has passed, proceed to _Intro 2._",
          "twentyOrMoreTime": "If 20 or more time has passed, skip to Intro 3.",
          "intro1": "<p class='file'>_Intro 1_: From the moment you step off the train in Alexandria, your hackles are raised. Dark clouds gather over the city, and waves crash ominously against the Mediterranean coastline. But the brewing storm is not what worries you—it’s your tail.</p><p>It started with just a few of them. Local authorities, you suspect. Or at least, that seems to be their cover. They could be Foundation agents keeping tabs on you to ensure you remain on task, or Coterie operatives looking to take out a potential threat. You navigate your way through the streets toward the Windsor Hotel, where you have a room booked for the night, but everywhere you turn, you spot more of them. You begin to formulate a plan just in case. Perhaps you can confront one by surprise, interrogate them, learn what they are after…but your thoughts are interrupted when a group of them beat you to the punch.</p><p>“Welcome to Alexandria, agents. Yes, we know who you are,” one of them says, but to your surprise, he raises his hands and shows that he bears no weapons. Now that you are closer, you can easily spot the telltale scarlet trappings among their persons—ties, cufflinks, and the like. “Don’t worry, we come in peace. One of our number wishes to speak with you. We have a problem in Alexandria that perhaps you can help us with.”</p><p>You scoff, incredulous at the audacity of such a request. You have no intention of walking into the Beast’s trap. “I understand why you’re wary,” the agent says, “but I think you will find this agreement to your liking. If you come seeking the Beast, believe it or not, our goals are aligned. This invitation comes from one much wiser and far less dangerous, I assure you. Come. We have much to discuss.”</p><p>You consider your options, but trap or no trap, you can’t pass up an opportunity to speak with a high-ranking member of the Coterie. Information is your best weapon right now, and no matter what, this can only help to inform you. You agree to follow, but keep an eye on your escorts, just in case.</p><p>To your surprise, the agents lead you by way of a horse-drawn carriage to the Bourse—the stock exchange building in the heart of the city. You follow your escorts through a bustling crowd wearing the finest clothes, up several flights of stairs, and through a locked office door on the top floor of the exchange. Immediately, you realize this must be no ordinary stock exchange, but a Coterie hideout of some kind. The office on the other side is an enormous suite, adorned with a surprising number of ancient relics and Euro-centric art, including a rather large portrait of a knight wearing a suit of scarlet-plated armor.</p><p class='basic'>Check how much time has passed in the Campaign Log.</p>",
          "intro2Part1": "<p class='file'>_Intro 2_: Upon entering, you are greeted by your host—an elderly man of English or perhaps French descent, wearing a elegant brown coat over an outfit of outdated red formal wear. “Ah, here they are.” He motions for you to sit. You’re surprised to find the man to be clearly of European descent, perhaps English or French. Though his hair is graying and thin, and his face wrinkled with long lines of worry, he seems surprisingly spry and large in stature. He rests his hand on a polished silver cane, but doesn’t seem to need it to walk. If you didn’t know any better, you would think him to be much younger than he lets on.</p>",
          "miskatonicOrScholar": "<div class='red'><p>_Read only if an investigator has the Miskatonic or Scholar trait_: You turn your attention to the enormous painting of the scarlet-clad knight that dominates the rear wall of the chamber. Judging from the style, you’d estimate the figure in the painting to be English or French, possibly from the time of the Angevin Empire, late 12th century. Very interesting indeed…</p></div>",
          "intro2Part2": "<p>“I suppose you have many questions. First, introductions are in order. I have gone by several names in my long tenure, but you may simply call me the Claret Knight, as others do. I know why you are here. You come seeking this, do you not?” He unlocks a nearby armoire, and as its door opens, a flash of light illuminates the room. Inside is a crystal vial containing a shimmering sapphire substance. It is, without a doubt, the Key you have come here to find. Immediately, your mind races, brimming with possibility. But with many of the knight’s agents standing right behind you, you decide to stay on your best behavior…for now.</p><p>“We have guarded this implement—the Light of Pharos—for many years. Protected it from those who would use it to harm, rather than guide, humanity. Only we have the capacity to do so. To keep such powers out of the hands of knaves and troublemakers. Now, here is the issue: there is another who desires the Light of Pharos, one who is far less benevolent.”</p><p>The Beast, you suspect aloud. “Indeed,” the knight confirms. “And before you ask—yes, that creature is counted among the members of our esteemed organization.” You wonder aloud why two members of the Coterie might be squabbling instead of working together. “Yes, well, membership requirements have been lax in recent years,” he jokes with a chuckle. “The truth is, I bear no particular fondness for this Beast. Its methods are unsavory. It draws too much unwanted attention.” His eyes, deep and blue as a dark ocean, meet with yours to emphasize his point.</p><p>You remind your host that time is of the essence, and ask where this is leading. “Of course,” he obliges. “As I said, we have guarded this implement for countless generations. It would be a shame for it to fall into the hands of the unworthy or uncouth, would it not? But the Beast draws nigh. It spills the blood of friend, foe, and bystander in its path here. Its path to us. It is after the Light, and as the Light’s protector, I must do everything in my power to stop it. As such, I have summoned you here to strike a bargain.” He nods to one of his agents, who closes the armoire and seals it shut. There is a rush of air, and a sensation of building pressure throughout the room as the door shuts tight. Your ears pop with a painful change of pressure.</p><p>“This is a place of power, one of several throughout the city which we have established to prevent uninvited guests from entering. Had you not been escorted, you might have turned to ash. But any such locus can be destroyed, and then the Beast would descend upon us like a starving wolf. We cannot be everywhere at once. Help us defend the locuses, so that we may retain guardianship of the Light of Pharos. In return, I’ll tell you what you wish to know about our organization. And you will have prevented catastrophe from befalling this fair city, which has seen more than enough calamity already. What do you say? Can we rely upon you to make the right choice?”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*“Very well, we accept.”* Skip to _Intro 4_.</li><li>Refuse. Skip to _Intro 5_</li></ul>",
          "intro3": "<p class='file'>_Intro 3_: Upon entering, you are greeted by your host—an elderly man of English or perhaps French descent, wearing a elegant brown coat over an outfit of outdated red formal wear. “Finally, you’re here.” He motions for you to sit. Though his hair is graying and thin, and his face wrinkled with long lines of worry, he seems surprisingly spry and large in stature. He rests his hand on a polished silver cane, but doesn’t seem to need it to walk. If you didn’t know any better, you would think him to be much younger than he lets on.</p><p>“I suppose you have many questions. First, introductions are in order. I have gone by several names in my long tenure, but you may simply call me the Claret Knight, as others do. I know why you are here. You come seeking that which we have guarded for many centuries. But even were I inclined to hand it over—which I am not—you are too late.” He gestures toward a nearby armoire, which has been torn nearly to shreds. Its door dangles from its hinges, and inside it is empty and dark.</p><p>“The Light of Pharos has been our charge in Alexandria for countless years. We have protected it from those who would use it to harm, rather than guide, humanity. But, I am afraid it has been stolen. And as such, until we can recover it, we are at war.”</p><p>The Beast, you suspect aloud. “Indeed,” the knight confirms. “And before you ask—yes, that creature is counted among the members of our esteemed organization.” You wonder aloud why two members of the Coterie might be in conflict instead of working together. “Yes, well, I fought tooth and nail to prevent it from joining our ranks, if you’ll pardon the pun,” he says grimly. “The truth is, I despise this Beast. Its methods are unsavory. It draws too much unwanted attention.” His eyes, deep and blue as a dark ocean, meet with yours as he emphasizes his point.</p><p>You remind your host that time is of the essence, and ask where this is leading. “Of course,” he obliges. “Surely we agree that we cannot let this implement remain in the hands of such a monster. It would be safer here, under lock and key, where it has been for countless generations. As its protector, I must do everything in my power to recover it. As such, I have summoned you here to strike a bargain.” He nods to one of his agents, who shows you a map of the city. Marked in several spots are buildings circled in red.</p><p>“These are locuses—places of power that were established throughout the city to prevent uninvited guests from entering a particular stronghold. They were once linked to this place, but now, this power has been usurped by the Beast. The Light of Pharos is somewhere in the city, protected by our very own magic. If we can destroy each locus and enter the Beast’s lair, we can take back the artifact and retain it here, where it belongs. In return, I’ll tell you what you wish to know about our organization. And you will have prevented catastrophe from befalling this fair city, which has seen more than enough calamity already. What do you say? Can we rely upon you to make the right choice?”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*“Very well, we accept.”* Skip to _Intro 6_.</li><li>Refuse. Skip to _Intro 7_.</li></ul>",
          "intro4": "<p class='file'>_Intro 4_: You agree to help defend the Light of Pharos.</p><ul><li>In your Campaign Log, record *the cell made a deal with the Claret Knight*.</li><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>Proceed to _Setup (v. I)_.</li></ul>",
          "intro5": "<p class='file'>_Intro 5_: “A shame,” the knight intones, his tenor changing almost immediately. “Very well. We shall have to deal with this threat ourselves, and I am afraid I must ask you to leave the city at once.” You protest, but the knight’s agents close in around you. He rises to a stature you did not expect from such an elderly man, his voice commanding the kind of authority mentioned only in myth. “You are no longer guests in my city. We will not suffer a war on two fronts. Depart from Alexandria immediately or suffer the consequences.”</p><p>Although it pains you to leave when your goal lies so close, if what the knight said is true, you would have to break the various locuses around the city in order to claim your prize, and you are surrounded and outnumbered, besides. You decide it is best to exit the Coterie’s stronghold and regroup before making a run at the Key.</p><p>But, as is often the case, fate has other plans. The moment you leave the Bourse, you are accosted by a man in a pinstripe suit and a red fez. Bewilderingly, he flashes a Foundation badge and makes a motion to follow him into a nearby alley. You make sure you aren’t still being watched, then abscond into the alleyway, where the man greets you in English. “Hossam Sirry, at your service. Commissioner Taylor told me you’d be coming. That dossier you got? I put that intel together myself.” You study the man’s face for a moment. Unlike the so-called Claret Knight and his Coterie entourage up in the Bourse, he looks native to the area, with brown skin, dark brown eyes and a chiseled, stubbled jawline. Still, your eyes cannot help but dance warily to the one article of red he wears upon his head. He rolls his eyes and gives a slight chuckle. “Do not worry. I am not with them. You would be hard pressed to find this kind of headwear in any other color.” You let out a sigh of relief. “I take it from the way you were escorted out of there that you didn’t take their offer?”</p><p>You tell Agent Sirry what happened inside the Bourse. “You made the right call,” he says. “Those Coterie dogs have been entrenched in Alexandria for as long as anyone can remember. They think this city is theirs, but it’s not. It belongs to the people. It belongs to us.” His disdain is unmistakable. It’s not just for the Coterie—it’s for the people who aim to wrest control of the city away from those who call it home. “They come here from afar and act like their governance, their occupation, is some kind of gift.”</p><p>Agent Sirry puts a hand on your shoulder. “Let us help one another. Your objective is to claim the knight’s Key for your own, yes? This will also weaken the Coterie’s control over this city. That is a result I can get behind.” You nod in agreement. This conflict may not be as personal for you as it is for Sirry, but you’ll stop at nothing to help.</p><ul><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>In your Campaign Log, record *the cell is assisting Agent Sirry*.</li><li>Proceed to _Setup (v. II)_.</li></ul>",
          "intro6": "<p class='file'>_Intro 6_: You agree to help recover the Light of Pharos.</p><ul><li>In your Campaign Log, record *the cell made a deal with the Claret Knight*.</li><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>Proceed to _Setup (v. III)_.</li></ul>",
          "intro7": "<p class='file'>Intro 7: “A foolish choice,” the knight intones, his tenor changing almost immediately. “Very well. We shall have to deal with this threat ourselves, and I am afraid I must ask you to leave the city at once.” You protest, but the knight’s agents close in around you. He rises to a stature you did not expect from such an elderly man, his voice commanding the kind of authority mentioned only in myth. “You are no longer guests in my city. We will not suffer a war on two fronts. Depart from Alexandria immediately or suffer the consequences.”</p><p>Given your refusal to help, it is hard to hold the man’s response against him. Still, you did manage to acquire some information regarding the Key’s whereabouts. You decide it is best to exit the Coterie’s stronghold and make a plan to take down the Beast before he and his people do.</p><p>But, as is often the case, fate has other plans. The moment you leave the Bourse, you are accosted by a man in a pinstripe suit and a red fez. Bewilderingly, he flashes a Foundation badge and makes a motion to follow him into a nearby alley. You make sure you aren’t still being watched, then abscond into the alleyway, where the man greets you in English. “Hossam Sirry, at your service. Commissioner Taylor told me you’d be coming. That dossier you got? I put that intel together myself.” You study the man’s face for a moment. Unlike the so-called Claret Knight and his Coterie entourage up in the Bourse, he looks native to the area, with brown skin, dark brown eyes and a chiseled, stubbled jawline. Still, your eyes cannot help but dance warily to the one article of red he wears upon his head. He rolls his eyes and gives a slight chuckle. “Do not worry. I am not with them. You would be hard pressed to find this kind of headwear in any other color.” You let out a sigh of relief. “I take it from the way you were escorted out of there that you didn’t take their offer?”</p><p>You tell Agent Sirry what happened inside the Bourse. “You made the right call,” he says. “Those Coterie dogs have been entrenched in Alexandria for as long as anyone can remember. They think this city is theirs, but it’s not. It belongs to the people. It belongs to us.” His disdain is unmistakable. It’s not just for the Coterie—it’s for the people who aim to wrest control of the city away from those who call it home. “They come here from afar and act like their governance, their occupation, is some kind of gift. Had you allowed them to take back that Key, their control over the city would once more become solidified.”</p><p>Agent Sirry puts a hand on your shoulder. “Let us help one another. Your objective is to claim the Beast’s Key before the Coterie does, yes? We can’t let either of them retain the Light of Pharos. It is too important. Come with me. I have resources that can help you.” You nod in agreement. This conflict may not be as personal for you as it is for Sirry, but you’ll stop at nothing to help.</p><ul><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>In your Campaign Log, record *the cell is assisting Agent Sirry*.</li><li>Proceed to _Setup (v. III)_.</li></ul>"
        },
        "version1": {
          "setup": {
            "title": "Setup (v. I)",
            "gatherSets": "Gather all cards from the following encounter sets: *Dogs of War*, *Scarlet Sorcery*, *Spatial Anomaly*, *Spreading Corruption*, and *Dark Cult*. These sets are indicated by the following icons: <section class='encounter-sets'><img src='{setImgPath}/dogs-of-war.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/dark-cult.png'></section>",
            "placeLocations": "Put the following locations into play: Windsor Palace Hotel, Victoria College, Qaitbay Citadel, The Corniche, and Zan’et el Settat.",
            "startAt": "Each investigator begins play at Qaitbay Citadel.",
            "agendaDeck": "Build the agenda deck using only Agenda 1a—”Brewing Catastrophe (v. I).” Remove each other agenda from the game.",
            "actDeck": "Build the act deck using only Act 1a—”Rabbits Who Run (v. I).” Remove each other act from the game.",
            "keyLocus": "Put one Key Locus story asset into play at each of the four _Locus Site_ locations, (*Last Bastion*) side faceup.",
            "doom": "Place 1 doom on each of those locations.",
            "otherLocations": "Put The Bourse (*Locus Safeguard*) and Catacombs of Kom el Shoqafa (*Bloody Nexus*) into play. Remove the other versions of The Bourse and Catacombs of Kom el Shoqafa from the game.",
            "theClaretKnight": "Put The Claret Knight into play at The Bourse, story asset side faceup. Attach The Light of Pharos key to The Claret Knight. Both The Claret Knight and The Light of Pharos are controlled by all of the investigators.",
            "theBeast": "The lead investigator spawns the The Beast in a Cowl of Crimson enemy at Catacombs of Kom el Shoqafa, (*Ravager in Red*) side faceup."
          }
        },
        "version2": {
          "setup": {
            "title": "Setup (v. II)",
            "gatherSets": "Gather all cards from the following encounter sets: *Dogs of War*, *Cleanup Crew*, *Scarlet Sorcery*, *Spatial Anomaly*, and *Spreading Corruption*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/dogs-of-war.png'><img src='{setImgPath}/cleanup-crew.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'></section>",
            "placeLocations": "Put the following locations into play: Windsor Palace Hotel, Victoria College, Qaitbay Citadel, The Corniche, and Zan’et el Settat.",
            "startAt": "Each investigator begins play at Qaitbay Citadel.",
            "agendaDeck": "Build the agenda deck using only Agenda 1a—”Brewing Catastrophe (v. II).” Remove each other agenda from the game.",
            "actDeck": "Build the act deck using only Act 1a—”Rabbits Who Run (v. II).” Remove each other act from the game.",
            "keyLocus": "Put one Key Locus story asset into play at each of the four _Locus Site_ locations, (*Defensive Barrier*) side faceup.",
            "otherLocations": "Put The Bourse (*Coterie Post*) and Catacombs of Kom el Shoqafa (*Ancient Tomb*) into play. Remove the other versions of The Bourse and Catacombs of Kom el Shoqafa from the game.",
            "theClaretKnight": "Spawn The Claret Knight at The Bourse, enemy side faceup. Attach The Light of Pharos key to The Claret Knight, under his control.",
            "theBeast": "Remove the double-sided The Beast in a Cowl of Crimson enemy from the game.",
            "miniCards": "Gather each decoy mini-card and each of the following mini-cards: Coterie Assassins (A and B) and Coterie Enforcers (A and B). Set them aside, out of play.",
            "coterieAssassin": "The lead investigator searches the gathered encounter cards for Coterie Assassin (A) and draws it, resolving its concealed keyword, with 1 additional decoy for each other investigator in the game."
          }
        },
        "version3": {
          "setup": {
            "title": "Setup (v. III)",
            "gatherSets": "Gather all cards from the following encounter sets: *Dogs of War*, *Cleanup Crew*, *Scarlet Sorcery*, *Spatial Anomaly*, *Spreading Corruption*, and *Dark Cult*. These sets are indicated by the following icons: <section class='encounter-sets'><img src='{setImgPath}/dogs-of-war.png'><img src='{setImgPath}/cleanup-crew.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/dark-cult.png'></section>",
            "placeLocations": "Put the following locations into play: Windsor Palace Hotel, Victoria College, Qaitbay Citadel, The Corniche, and Zan’et el Settat.",
            "startAt": "Each investigator begins play at Qaitbay Citadel.",
            "agendaDeck": "Build the agenda deck using only Agenda 1a—”Brewing Catastrophe (v. III).” Remove each other agenda from the game.",
            "actDeck": "Build the act deck using only Act 1a—”Rabbits Who Run (v. III).” Remove each other act from the game.",
            "keyLocus": "Put one Key Locus story asset into play at each of the four _Locus Site_ locations, (*Defensive Barrier*) side faceup.",
            "otherLocations": "Put The Bourse (*Commercial Center*) and Catacombs of Kom el Shoqafa (*Den of the Beast*) into play. Remove the other versions of The Bourse and Catacombs of Kom el Shoqafa from the game.",
            "theBeast": "Spawn The Beast in a Cowl of Crimson enemy at Catacombs of Kom el Shoqafa, (*Wolf in Sheep’s Clothing*) side faceup. Attach The Light of Pharos key to The Beast in a Cowl of Crimson, under its control.",
            "theClaretKnight": "Remove the double-sided The Claret Knight enemy/asset from the game.",
            "miniCards": "Gather each decoy mini-card and each of the following mini-cards: Coterie Assassins (A and B) and Coterie Enforcers (A and B). Set them aside, out of play."
          }
        },
        "resolutions": {
          "noResolution": {
            "title": "No Resolution",
            "version1": "_If no resolution was reached (each investigator was defeated) and the version you played was (v. I)_: Skip to _Resolution 3_.",
            "version2": "_If no resolution was reached (each investigator resigned or was defeated) and the version you played was (v. II)_: Skip to _Resolution 4_.",
            "version3": "_If no resolution was reached (each investigator resigned or was defeated) and the version you played was (v. III)_: Skip to _Resolution 7_."
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: The Claret Knight clears his throat and regains his composure. If you didn’t know any better, you would think he had never been worried at all. But you remember the look of tension and fear upon his face when he—like you—suspected all was lost. “Once again, forces have conspired to oust us from our rightful place, but once again we stand victorious,” he declares. Any semblance of fear has vanished, replaced with the very same calm resolve you found in him when you’d first arrived. With the Key still safely secure in his vault, he turns his attention to you, shaking your hand and gesturing to his desk. “Come, sit. You have done your part, now allow me to do mine. I promised answers, and answers you shall receive.”</p><ul><li>Skip to _Resolution 8_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: You lay low for a few days in one of Agent Sirry’s safehouses outside the city, then meet with him later that week, your prize still safely in your possession. He has cleaned up a bit since you last met him, and there is a brightness in his eyes and his smile that was not present before. He joyfully sums up what has occurred since you went dark. “The knight and his entourage seem to have left Alexandria,” he declares, wearing a satisfied grin. “It seems, for all their posturing about ‘guiding humanity’ and ‘rightful rule,’ the moment their relic left their hands, their stake in the city vanished with it. That other creature seems to have fled as well. Still…” His eyes dance to the vessel containing the Key, its light trapped within. “I doubt you’ve seen the last of them. In fact, I’d wager a guess that one or both are hot on your tail. Be careful.”</p><p>You ask what Hossam will do now that his personal objective in Alexandria is complete. “I have a new assignment, actually,” he answers. “Commissioner Taylor sent the dossier to me just yesterday. I will be leaving my beloved city behind for the first time since joining the Foundation.” He sighs wistfully. “Well, perhaps we can meet up again some time.” He stands and shakes your hand. “It has been a pleasure working alongside you.”</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of the Claret Knight*.</li><li>Choose an investigator to be the bearer of The Light of Pharos and update the Campaign Log accordingly.</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: Fearing the worst, you retreat to the office as a last line of defense, but you are too late. The chamber is the site of a massacre. Fresh blood drips from the walls, sprayed about in absolute chaos, a whirlwind of death. The grisly sight of partially- devoured dead is one you will never forget.</p><p>With no other leads to go on and the thought of meeting that same fate terrifying you, you decide to cut your losses and flee the city. Still, you cannot help but note that the elderly knight was not among the dead. Perhaps he escaped, as well. If so, this probably isn’t the last you’ll see of either of them…</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Each investigator who was not defeated suffers 1 mental trauma.</li><li>In your Campaign Log, record the following:<ul><li>*The cell failed to fend off the Beast*.</li><li>*You haven’t seen the last of the Beast in a Cowl of Crimson.</li></ul></li><li>The Beast in a Cowl of Crimson is the bearer of The Light of Pharos. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution4": {
            "title": "Resolution 4",
            "body": "<p>_Resolution 4_: You lay low for a few days in one of Agent Sirry’s safehouses outside the city, then meet with him later that week. Heavy bags hang under his eyes, and his beard looks messy and unkempt. His gaze darts warily to you as you enter. He gloomily sums up what transpired after you went dark. “The knight and his entourage are still entrenched in Alexandria. He and that hideous creature are in all-out war now, and of course, my people are the ones who suffer.” He slams his fist on the table in anger. “That’s how it always is with these bastards. They’ll do whatever they can to stay in power, innocents be damned. Frankly, I can’t even tell which of them is worse.”</p><p>You apologize that you weren’t able to help more, and he shakes his head. “No, don’t apologize. You did everything you could. What will you do now?” Your window of opportunity in Alexandria has passed, so you tell Agent Sirry you’ll be taking the next train out to search for more Keys elsewhere. You wonder aloud if he might come with you. “I have a new assignment as well, but…” he scratches his beard thoughtfully. “I fear what may come to pass in my beloved city with this feud going on. I might end up staying. Orders or no orders.” He stands and shakes your hand, and you fear it may be the last time. “I hope to see you again some time. Until then…I have work to do.”</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of the Claret Knight*.</li><li>The Claret Knight is the bearer of The Light of Pharos. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution5": {
            "title": "Resolution 5",
            "body": "<p>_Resolution 5_: You are escorted by agents in red back to your patron’s office safehouse within the Bourse. The place has been cleaned up significantly since you were last there, and a brand new vault sits next to the grand painting of the familiar scarlet-clad knight. You hand over the Key as agreed, and it is placed back inside the vault and sealed shut. There is a rush of air, and a sensation of building pressure throughout the room as the door shuts tight. Your ears pop with a painful change of pressure—no doubt the work of their so-called “locuses.”</p><p>The Claret Knight looks on with pride as his agents handle the ancient relic. “Once again, forces have conspired to oust us from our rightful place, but once again we stand victorious,” he declares. If there was any semblance of fear or worry on his face before, it has vanished, replaced with the calm resolve of one who has faced many such foes before. With the Key now safely secure in his vault, he turns his attention to you, shaking your hand and gesturing to his desk. “Come, sit. You have done your part, now allow me to do mine. I promised answers, and answers you shall receive.”</p><ul><li>Skip to _Resolution 8_.</li></ul>"
          },
          "resolution6": {
            "title": "Resolution 6",
            "body": "<p>_Resolution 6_: You lay low for a few days in one of Agent Sirry’s safehouses outside the city, then meet with him later that week, your prize still safely in your possession. He has cleaned up a bit since you last met him, and there is a brightness in his eyes and his smile that was not present before. He joyfully sums up what has occurred since you went dark. “The Beast and its devotees are in hiding, and it seems the rest of the Coterie have vanished, as well,” he declares, wearing a satisfied grin. “It seems, for all their posturing about ‘guiding humanity’ and ‘rightful rule,’ the moment their relic left their hands, their stake in the city vanished with it. Still…” His eyes dance to the vessel containing the Key, its light trapped within. “I doubt you’ve seen the last of them. In fact, I’d wager a guess that one or both are hot on your tail. Be careful.”</p><p>You ask what Hossam will do now that his personal objective in Alexandria is complete. “I have a new assignment, actually,” he answers. “Commissioner Taylor sent the dossier to me just yesterday. I will be leaving my beloved city behind for the first time since joining the Foundation.” He sighs wistfully. “Well, perhaps we can meet up again some time.” He stands and shakes your hand. “It has been a pleasure working alongside you.”</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of the Beast in a Cowl of Crimson*.</li><li>Choose an investigator to be the bearer of The Light of Pharos and update the Campaign Log accordingly.</li><li>Mark 2 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution7": {
            "title": "Resolution 7",
            "body": "<p>_Resolution 7_: With terrifying creatures and agents in red embroiled in all-out war, it has become far too dangerous for you to continue operating in Alexandria. You hate to leave such a volatile situation behind, but you don’t seem to have a choice. You find it ironic that the Coterie, who claim to only want to protect humanity, would put the people of Alexandria in such danger. It seems there is a wide range of personalities within the organization. Perhaps some may even be swayed to your side. But for now, those in Alexandria seem to be a lost cause. You leave the city in a dour mood, hoping your next assignment goes more smoothly.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *the dogs are at war*.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          },
          "resolution8": {
            "title": "Resolution 8",
            "body": "<p>_Resolution 8_: You ask the knight what the Red Coterie is truly about. So far, you have seen its members be both brutal and reasonable. And why all the secrecy? “I have not lied to you. We seek only to protect humanity.” He points to the vault wherein the Light of Pharos is still safely sealed away. “These objects, they are too powerful to be wielded by just anyone, and too precious to be kept unaccounted. I’m sure by now you have noticed the influence of other entities upon our world. Outsiders, we call them. These relics are the only line of defense against such entities. The Coterie keeps them safe, to be used only to do battle with the Outsiders. That is why I could not suffer this artifact to fall into the hands of that beast. Aliki is the one who does most of our research regarding the Outsiders—if you wish to know more, perhaps find her. Last anyone heard from her was around Kathmandu, I believe. But you will need to find a translator if you wish to speak with her. She is cryptic and difficult to understand.” He glances at the portrait of the knight clad in crimson armor that looms behind him. “As for all the red… handling relics of an otherworldly nature is both dangerous and conspicuous. So, we have bound them to one or more articles of clothing, to better blend in with society. The process, for whatever reason, turns them red. Of course, there are other benefits too. Think of it as a…secret handshake, if you will.” He raises an eyebrow as he appraises you. “We have, in the past, inducted new members into our ranks, should they prove themselves both trustworthy and capable, as you have. Perhaps one day you shall bear red upon your person, as well. Now, I believe I have fulfilled my end of this bargain. I once again thank you for your aid. My people will compensate your travel expenses.” With that, the conversation comes to a friendly, if abrupt end.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record the following:<ul><li>*The cell aided the knight.*</li><li>*You haven’t seen the last of the Beast in a Cowl of Crimson.*</li></ul></li><li>The Claret Knight is the bearer of The Light of Pharos. Update the Campaign Log accordingly.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "档案#38-N",
        "tokens": {
          "easyStandard": {
            "skull": "-1 (如果你所在地点有钥匙节点，改为-3)。",
            "cultist": "-3。如果你检定失败，受到1点伤害和1点恐惧；或在最近的钥匙节点或_节点地_地点上放置1个毁灭标记。",
            "tablet": "-2。如果是攻击有巡逻关键词的敌人，本次攻击后，该敌人解除交战，并结算其巡逻关键词。",
            "elderThing": "-2。你检定失败且每低于难度1点，失去1资源(最多3)。"
          },
          "hardExpert": {
            "skull": "-2 (如果你所在地点有钥匙节点，改为-4)。",
            "cultist": "-5。如果你检定失败，受到1点伤害和1点恐惧；或在最近的钥匙节点或_节点地_地点上放置1个毁灭标记。",
            "tablet": "-2。如果是攻击有巡逻关键词的敌人，本次攻击后，该敌人攻击你，与调查员解除交战，并结算其巡逻关键词。",
            "elderThing": "-3。你检定失败且每低于难度1点，失去1资源。"
          }
        },
        "tooltips": {
          "catacombsOfKomElShoqafa": {
            "investigate": "{'{'}action{'}'}:_调查_。如果你检定成功，不发现线索，改为抽取3张卡牌。你可以将此次检定的难度降低2点。如果你这么做，如果检定成功你少抽取1张卡牌。(团队每轮仅限一次。)"
          },
          "theBourse": {
            "investigate": "{'{'}action{'}'}:_调查_。如果你检定成功，不发现线索，改为获得4资源。你可以将此次检定的难度降低2点。如果你这么做，如果检定成功你少获得2资源。(团队每轮仅限一次。)"
          },
          "theClaretKnight": {
            "to": "{'{'}fast{'}'}横置暗红骑士：将你资源池的最多3资源移动到暗红骑士。",
            "from": "{'{'}fast{'}'}横置暗红骑士：将暗红骑士的最多3资源移动到你的资源池；或移动到你控制的一个支援，作为充能、子弹、补给或秘密。"
          }
        },
        "label": {
          "theClaretKnight": {
            "resources": "移动最多3资源"
          },
          "zanEtElSettat": {
            "increaseFight": "本次攻击中该敌人的攻击值提升2点"
          },
          "catacombsOfKomElShoqafa": {
            "reduceDifficulty": "将此次检定的难度降低2点且少抽取1张卡牌",
            "doNotReduce": "不降低难度",
            "pay": "花费1{'{'}perPlayer{'}'}线索",
            "doNotPay": "不花费线索"
          },
          "theBourse": {
            "reduceDifficulty": "将此次检定的难度降低2点且少获得2资源",
            "doNotReduce": "不降低难度",
            "pay": "花费1{'{'}perPlayer{'}'}线索",
            "doNotPay": "不花费线索"
          }
        },
        "intro": {
          "title": "档案#38-N: 战争疮痍",
          "label": {
            "weAccept": "*“很好，我们接受。”*",
            "refuse": "拒绝。"
          },
          "fewerThanTwentyTime": "流逝的_时间_小于20。",
          "twentyOrMoreTime": "流逝的_时间_大于等于20。",
          "intro1": "<p class='file'>自打你下了火车，抵达亚历山大，就没怎么痛快过。天上乌云笼罩，海浪冲击着地中海海岸，颇为不祥。但你真正担心的倒不是即将到来的风暴——而是正跟着你的尾巴。</p><p>一开始只有几个人。你怀疑是地方当局，或者至少他们伪装成了这样。可能是基金会特工在监视，确保你没忘了自己的任务；也可能是同志会的人，想要解决潜在的威胁。你沿着既定路线穿过街道前往温莎酒店，你在那里订了一晚的房间。但你每拐一个弯，都发现有更多的人跟着。你开始准备计划，以防万一。也许你可以出其不意地抓住一个，盘问一番，了解他们到底在跟什么……但他们反而抢在了你的前头，打断了你的思绪。</p><p>“亚历山大欢迎你，特工。没错，我们知道你是谁。”其中一个说道。但令你惊讶的是，他居然举起了手，以示自己没有武器。现在你们之间更近了，你能轻易地看到他们身上的红色装束——领带、袖口，诸如此类，而这一切都预示着——“别担心，我们不是来打架的。我们中有一位想跟你谈谈。我们在亚历山大有点麻烦，兴许你能帮上我们。”</p><p>这么大胆的需求真是不可思议，你对此嗤之以鼻。你可一点儿也不想就这么走进恶兽的陷阱。“我能理解你为什么这么警惕。”对面的特工说道，“但你会发现这个提议颇为诱人。随你信不信，如果你是来找恶兽的，那么我们目标一致。邀请你的人比恶兽智慧得多，也安全得多。来吧，我们有很多事要聊聊呢。”</p><p>你思忖自己的选择。无论这是不是陷阱，你都不能放过和同志会高层直接对话的机会。现在信息就是你最强大的武器，无论如何，知道多些总是好的。你同意跟他们一起走，但还是时刻留心着这伙人，以防万一。</p><p>意外的是，特工们领你坐上马车，来到了市中心的证券交易所。你跟着他们穿过身着华服、熙熙攘攘的人群，上了几级台阶，经过几扇锁着的门，来到交易所的顶层。你立刻意识到这不是什么普通的证券交易所，而是某个同志会的藏身处。另一侧的办公室是一个巨大的套间，里面古代遗物和欧式艺术的数量简直惊人。其中有一扇巨幅肖像，画的是一位身着猩红板甲的骑士。</p><p class='basic'>检查剧本日志中已经流逝了多少_时间_。</p>",
          "intro2Part1": "<p class='file'>你一进门，主人就跟你打了招呼——这个老人穿着精致的棕色外套，里面的红衣虽然正式，但已过时。“啊，来了。”他示意你坐下，你惊讶地发现他是欧洲来的，兴许是英国，或者法国？尽管头发已经灰白稀疏，脸上长长的皱纹透着焦虑，他看起来还是精神矍铄，体格壮实。他一手倚着锃亮的银杖，但看起来完全不用它助步。如果没有进一步的了解，你会觉得他比表现的要年轻得多。</p>",
          "miskatonicOrScholar": "<div class='red'><p>_仅当有调查员具备米斯卡塔尼克或学者特性才能阅读：_你将注意转向房间尽头那幅红甲骑士的肖像，画幅之大，占据了一整面墙。从风格上看，你估计画中人来自英法，大概是12世纪晚期的安茹帝国。这真是非常有趣……</p></div>",
          "intro2Part2": "<p>“我想你有许多问题。首先，应该自我介绍。我在漫长的生涯中有过许多名字，你可以和其他人一样就叫我暗红骑士。我知道你为何在这儿。你是来找这个的，嗯？”他打开附近的华丽大柜，一阵光芒顷刻间洒满了整个房间。柜子里是一个水晶小瓶，里面装着闪亮的天蓝色物质。这毫无疑问就是你来此处要找的钥匙。你的思维当即快速运转，思考着一切可能。但你面前站了那么多骑士手下的特工，你决定最好还是按兵不动……至少现在如此。</p><p>“我们已经看守这件工具——法罗斯之光，许多年了。我们要保护它不落入恶人之手，为害——而非指引人类。只有我们才有这样的本领。只有我们才能保护这股力量不落入奸徒宵小的手中。现在问题来了：另有一方意图夺取法罗斯之光，而它就没我们这么仁慈了。”</p><p>你问他指的是不是恶兽。“没错。”骑士确认道，“在你问之前，我可以告诉你——没错，这个怪物也算作是我们著名组织的一员。”你好奇为什么同志会的两位成员不是通力合作，而是争执不休。“是啊，好吧。近年来我们的入会需求是越来越松了。”他笑着打趣道，“确实，我对这个‘恶兽’没有好感。它的手段令人厌恶，招致了太多没有必要的关注。”他盯着你，以示强调。你发现他的眼睛是深邃的宝蓝色，仿佛汪洋。</p><p>你提醒主人时间至关重要，问他下一步该做什么。“当然。”他图穷匕见，“正如前言，我们已经看守这件工具有好几代人了。要是有配不上它，或者放肆无礼的魔爪染指，可真是叫人羞耻，嗯？但恶兽已然接近。它不分敌友，罔顾路人，一律血染街头。它是冲我们来的。它的目标就是法罗斯之光。而我身为光的守卫，必须竭尽全力阻止它。所以，我唤你来此，是有笔交易。”他冲一个特工点点头，后者随即关上柜子锁好。门关上的那一刻，一阵气流和强压的感觉穿过房间。你的鼓膜也在这股强压下作响。</p><p>“此地充斥着力量。我们在城中建了好几个这样地点，以防不速之客闯入。要是你来的时候无人护送，可能已经化为齑粉。但这样的节点也并非坚不可摧。要是它们被毁了，恶兽就会像饿狼一样扑向我们。我们分身乏术。帮我们守住节点，这样我们才能继续保卫法罗斯之光。作为回报，你想知道我们的组织什么，我都会告诉你。你也可以由此保护这座美丽的城市免遭毁灭。她已经经历了太多的磨难。你怎么说？我们能指望你作出正确的选择吗？”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>“很好，我们接受。”</li><li>拒绝。</li></ul>",
          "intro3": "<p class='file'>你一进门，主人就跟你打了招呼——这个老人穿着精致的棕色外套，里面的红衣虽然正式，但已过时。他看上去像是欧洲来的，兴许是英国，或者法国？“你终于来了。”他示意你坐下。尽管头发已经灰白稀疏，脸上长长的皱纹透着焦虑，他看起来还是精神矍铄，体格壮实。他一手倚着锃亮的银杖，但看起来完全不用它助步。如果没有进一步的了解，你会觉得他比表现的要年轻得多。</p><p>“我想你有许多问题。首先，应该自我介绍。我在漫长的生涯中有过许多名字，但你可以和其他人一样就叫我暗红骑士。我知道你为何在这儿。你是来要找我们守护了许多世纪的东西。但即便我愿意将它交出——并非如此——你也来得太晚了。”他指向旁边一个已被撕成碎片的柜子。柜门挂在铰链上，里面漆黑一片，空无一物。</p><p>“亚历山大的法罗斯之光已由我们保卫了许多年。我们保护它不落入恶人之手，为害——而非指引人类。但现在恐怕它已经遭窃。因此，在将其夺回之前，我们就是在打仗了。”</p><p>你问他指的是不是恶兽。“没错。”骑士确认道，“在你问之前，我可以告诉你——没错，这个怪物也算作是我们著名组织的一员。”你好奇为什么同志会的两位成员不是通力合作，而是针锋相对。“是啊，好吧。它的加入真是叫我咬牙切齿——字面上的。”他冷酷地说道，“确实，我鄙视这个‘恶兽’。它的手段令人厌恶，招致了太多没有必要的关注。”他盯着你，以示强调。你发现他的眼睛是深邃的宝蓝色，仿佛汪洋。</p><p>你提醒主人时间至关重要，问他下一步该做什么。“当然。”他图穷匕见，“我们肯定都同意，工具不能落入这样一头怪物的手中。严加看管，锁藏入库才更安全。好几代人都是这么做的。我身为守卫，必须竭尽全力将其夺回。所以，我唤你来此，是有笔交易。”他冲一个特工点了点头，后者随即给你一张城市地图，地图上标出了几个点，里面的建筑用红色圈了起来。</p><p>“这些地方都是节点——我们在城中建了好几个这样地点，以防不速之客闯入特定的要塞。它们都与此地连接，但现在看来这股力量已经被恶兽推翻。法罗斯之光就在城中某处，由我们自己的魔法保卫着。要是我们能摧毁这些节点，进入恶兽的巢穴，就能夺回神器，将其归还原本所在的地方——也就是这里。作为回报，你想知道我们的组织什么，我都会告诉你。你也可以由此保护这座美丽的城市免遭毁灭。她已经经历了太多的磨难。你怎么说？我们能指望你作出正确的选择吗？”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>“很好，我们接受。”</li><li>拒绝。</li></ul>",
          "intro4": "<p class='file'>你同意帮助保卫法罗斯之光。</p><ul><li>在剧本日志中，记录下*特别小组与暗红骑士达成交易*。</li><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>进入_冒险设置(版本一)_。</li></ul>",
          "intro5": "<p class='file'>“遗憾。”骑士的语调几乎立刻变了，“好吧，看来我们要自己解决这个威胁了。恐怕我必须要求你马上离开此城。”你提出抗议，但骑士手下的特工已经包围过来。他站直身子，你从没料到一个老人竟能这么高大。他的嗓音威严之甚，你只在神话中见过。“我的城市不再欢迎你。我们不能冒险两线作战。立刻离开亚历山大，否则后果自负。”</p><p>目标近在咫尺，此时放弃真叫人不甘。但要是骑士所言非虚，你得打破城中的数个节点，才能夺取目标。而此时你却身陷包围，寡不敌众。你决定现在最好还是逃离同志会的要塞，重整力量，再图钥匙。</p><p>但命运自有安排，一如既往。你刚一离开证券交易所，就有一个条纹西装，红色毡帽的男子上来搭讪。奇怪的是，他居然亮出基金会的徽章，示意你跟他走进附近的巷子。你确信自己没被盯梢，溜进了巷子。男子用英语跟你打招呼：“哈桑·西里，听您差遣。泰勒专员说您会来。您不是有份密档吗？那些情报就是我整合的。”你研究了一会儿此人的面容。跟所谓的暗红骑士和他在交易所的同志会手下不同，此人看上去是个当地人，棕色皮肤，棕色眼睛，轮廓分明的下颚线上留着胡茬。但你的眼神无法从他头上顶着的红色装束挪开。他翻翻眼睛，轻声笑了起来：“别担心。我跟他们不是一伙儿的。这里很难找到别的颜色的帽子。”你松了口气。“既然你从那里给赶出来了，我猜你没有接受他们的提议？”</p><p>你把交易所里发生的事情一五一十地和西里特工说了。“你做出了正确的选择。”他说道，“这些同志会的走狗一直在亚历山大根深蒂固。他们觉得这座城市是他们的，但并非如此。它属于人民，属于我们。”他此番不屑定非虚假。不只是对同志会——更是对巧取豪夺之徒。当地人将这座城称为“家园”，却被这群人夺走了控制。“他们从远方而来，却把自己的统治和占据当作一种恩赐。”</p><p>西里特工搭在你的肩膀上：“咱们携手合作吧。你的目标是夺取骑士的钥匙，嗯？这也会减弱同志会对此城的控制。而这就是我的目标。”你点头表示同意。尽管在这场冲突中，你不像西里一样有着强烈的个人因素，但你必当全力以赴。</p><ul><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>在剧本日志中，记录下*特别小组帮助西里特工*。</li><li>进入_冒险设置(版本二)_。</li></ul>",
          "intro6": "<p class='file'>你同意帮助保卫法罗斯之光。</p><ul><li>在剧本日志中，记录下*特别小组与暗红骑士达成交易*。</li><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>进入_冒险设置(版本三)_。</li></ul>",
          "intro7": "<p class='file'>“愚蠢的选择。”骑士的语调几乎立刻变了，“好吧，看来我们要自己解决这个威胁了。恐怕我必须要求你马上离开此城。”你提出抗议，但骑士手下的特工已经包围过来。他站直身子，你从没料到一个老人竟能这么高大。他的嗓音威严之甚，你只在神话中见过。“我的城市不再欢迎你。我们不能冒险两线作战。立刻离开亚历山大，否则后果自负。”</p><p>既然你拒绝帮忙，他这样的反应也是无可厚非。不过，你还是掌握了一些钥匙下落的信息。你决定现在最好还是逃离同志会的要塞，抢在他们之前击败恶兽。</p><p>但命运自有安排，一如既往。你刚一离开证券交易所，就有一个条纹西装，红色毡帽的男子上来搭讪。奇怪的是，他居然亮出基金会的徽章，示意你跟他走进附近的巷子。你确信自己没被盯梢，溜进了巷子。男子用英语跟你打招呼：“哈桑·西里，听您差遣。泰勒专员说您会来。您不是有份密档吗？那些情报就是我整合的。”你研究了一会儿此人的面容。跟所谓的暗红骑士和他在交易所的同志会手下不同，此人看上去是个当地人，棕色皮肤，棕色眼睛，轮廓分明的下颚线上留着胡茬。但你的眼神无法从他头上顶着的红色装束挪开。他翻翻眼睛，轻声笑了起来：“别担心。我跟他们不是一伙儿的。这里很难找到别的颜色的帽子。”你松了口气。“既然你从那里给赶出来了，我猜你没有接受他们的提议？”</p><p>你把交易所里发生的事情一五一十地和西里特工说了。“你做出了正确的选择。”他说道，“这些同志会的走狗一直在亚历山大根深蒂固。他们觉得这座城市是他们的，但并非如此。它属于人民，属于我们。”他此番不屑定非虚假。不只是对同志会——更是对巧取豪夺之徒。当地人将这座城称为“家园”，却被这群人夺走了控制。“他们从远方而来，却把自己的统治和占据当作一种恩赐。要是让他们夺回钥匙，那他们对城市的控制只会更加稳固。”</p><p>西里特工搭在你的肩膀上：“咱们携手合作吧。你的目标是抢在同志会前面夺取恶兽的钥匙，嗯？他们其中任何一方都不能得到法罗斯之光。它太重要了。跟我来，我有些资源能帮上你。”你点头表示同意。尽管在这场冲突中，你不像西里一样有着强烈的个人因素，但你必当全力以赴。</p><ul><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>在剧本日志中，记录下*特别小组帮助西里特工*。</li><li>进入_冒险设置(版本三)_。</li></ul>"
        },
        "version1": {
          "setup": {
            "title": "冒险设置(版本一)",
            "gatherSets": "收齐以下遭遇组的所有卡牌：*战争疮痍*、*猩红巫术*、*空间异常*、*腐败扩散*、*黑暗异教徒*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dogs-of-war.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/dark-cult.png'></section>",
            "placeLocations": "将以下地点放置入场：温莎宫酒店、维多利亚学院、奎贝堡、滨海大道、妇女市集。",
            "startAt": "每位调查员从奎贝堡开始游戏。",
            "agendaDeck": "仅使用密谋1a“酝酿灾祸(版本一)”创建密谋牌库。将其他每张密谋从游戏中移除。",
            "actDeck": "仅使用场景1a“惊弓之鸟(版本一)”创建场景牌库。将其他每张场景从游戏中移除。",
            "keyLocus": "将钥匙节点剧情支援放置入场，在四个_节点地_地点各放置一张，*(最后堡垒)*面朝上。",
            "doom": "在这些地点各放置1个毁灭标记。",
            "otherLocations": "将证券交易所*(节点护卫)*和亚历山大地下陵墓*(血腥联结)*放置入场。将其他版本的证券交易所和亚历山大地下陵墓从游戏中移除。",
            "theClaretKnight": "将暗红骑士放置入场，放到证券交易所，剧情支援面朝上。将法罗斯之光钥匙附属到暗红骑士。暗红骑士和法罗斯之光都由所有调查员控制。",
            "theBeast": "调查员队长将深红斗篷的恶兽敌人生成在亚历山大地下陵墓，*(红衣毁灭者)*面朝上。"
          }
        },
        "version2": {
          "setup": {
            "title": "冒险设置(版本二)",
            "gatherSets": "收齐以下遭遇组的所有卡牌：*战争疮痍*、*扫荡团伙*、*猩红巫术*、*空间异常*、*腐败扩散*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dogs-of-war.png'><img src='{setImgPath}/cleanup-crew.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'></section>",
            "placeLocations": "将以下地点放置入场：温莎宫酒店、维多利亚学院、奎贝堡、滨海大道、妇女市集。",
            "startAt": "每位调查员从奎贝堡开始游戏。",
            "agendaDeck": "仅使用密谋1a“酝酿灾祸(版本二)”创建密谋牌库。将其他每张密谋从游戏中移除。",
            "actDeck": "仅使用场景1a“惊弓之鸟(版本二)”创建场景牌库。将其他每张场景从游戏中移除。",
            "keyLocus": "将钥匙节点剧情支援放置入场，在四个_节点地_地点各放置一张，*(防御屏障)*面朝上。",
            "otherLocations": "将证券交易所*(同志会据点)*和亚历山大地下陵墓*(古代坟墓)*放置入场。将其他版本的证券交易所和亚历山大地下陵墓从游戏中移除。",
            "theClaretKnight": "将暗红骑士生成在证券交易所，敌人面朝上。将法罗斯之光钥匙附属到暗红骑士，由他控制。",
            "theBeast": "将双面的深红斗篷的恶兽敌人从游戏中移除。",
            "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：同志会刺客(A、B)和同志会打手(A、B)。将这些卡牌放在一边，位于场外。",
            "coterieAssassin": "调查员队长查找收齐的遭遇卡牌，找出同志会刺客(A)并将其抽取，结算其隐匿关键词，且游戏中每有一位其他调查员，就额外放置1张诱饵。"
          }
        },
        "version3": {
          "setup": {
            "title": "冒险设置(版本三)",
            "gatherSets": "收齐以下遭遇组的所有卡牌：*战争疮痍*、*扫荡团伙*、*猩红巫术*、*空间异常*、*腐败扩散*、*黑暗异教徒*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/dogs-of-war.png'><img src='{setImgPath}/cleanup-crew.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/dark-cult.png'></section>",
            "placeLocations": "将以下地点放置入场：温莎宫酒店、维多利亚学院、奎贝堡、滨海大道、妇女市集。",
            "startAt": "每位调查员从奎贝堡开始游戏。",
            "agendaDeck": "仅使用密谋1a“酝酿灾祸(版本三)”创建密谋牌库。将其他每张密谋从游戏中移除。",
            "actDeck": "仅使用场景1a“惊弓之鸟(版本三)”创建场景牌库。将其他每张场景从游戏中移除。",
            "keyLocus": "将钥匙节点剧情支援放置入场，在四个_节点地_地点各放置一张，*(防御屏障)*面朝上。",
            "otherLocations": "将证券交易所*(商贸中心)*和亚历山大地下陵墓*(恶兽之巢)*放置入场。将其他版本的证券交易所和亚历山大地下陵墓从游戏中移除。",
            "theBeast": "将深红斗篷的恶兽敌人生成在亚历山大地下陵墓，*(披着羊皮的狼)*面朝上。将法罗斯之光钥匙附属到深红斗篷的恶兽，由它控制。",
            "theClaretKnight": "将双面的暗红骑士敌人/支援从游戏中移除。",
            "miniCards": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：同志会刺客(A、B)和同志会打手(A、B)。将这些卡牌放在一边，位于场外。"
          }
        },
        "resolutions": {
          "noResolution": {
            "title": "未达成任何结局",
            "version1": "_如果未达成任何结局(每位调查员被击败)且游戏版本为版本一：_跳至_结局3_。",
            "version2": "_如果未达成任何结局(每位调查员撤退或被击败)且游戏版本为版本二：_跳至_结局4_。",
            "version3": "_如果未达成任何结局(每位调查员撤退或被击败)且游戏版本为版本三：_跳至_结局7_。"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 暗红骑士清了清嗓子, 重新镇定下来。倘若了解不深, 你还会以为他从未担心过。但你记得他紧张和恐惧的样子, 尤其是他——和你一样——也怀疑过自己是不是满盘皆输。“邪恶的力量又一次阴谋将我们赶出自己的家园, 但我们又一次胜利了。”他断言道。他脸上惊恐的表情消失了, 取而代之的是你们初见时他那幅冷静的决绝。钥匙还安全无虞地保存着。他转向你, 和你握手, 指着桌前: “来吧, 坐下。你完成了你的工作, 现在轮到我了。我允诺过答案, 你也将得到答案。”</p><ul><li>跳至_结局8_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 你在西里特工城外的藏身处低调了几天, 当周晚些与他碰头。而那件宝贝则安稳地藏在你手上。他比你们上次见面的时候洁净多了, 眉宇间带着欢快的神色, 笑容更是今非昔比。在你蛰伏的日子里究竟发生了什么, 从他这份欢快已可见一斑。“看来骑士和他的手下都已经溜出了亚历山大。”他说着满意地咧开嘴笑了, “他们所谓的‘保护人类’和‘正统统治’, 也在遗物失去的时候, 一起从这座城里消失了。城里别的怪物也都不在了。不过......”他的眼神飘向承载钥匙之光的容器, “我觉得你还会再见他们的。其实, 我敢打赌, 他们肯定会追着你不放。还是小心为上。”</p><p>你问哈桑, 既然他在亚历山大的目标已经完成, 接下来要做什么。“其实我已经有了新任务。”他答道, “泰勒专员昨天给我发了新的密档。自从加入基金会以来, 我要第一次离开自己挚爱的城市了。”他感伤地叹了口气, “好吧, 希望我们还能再见面。”他站起来和你握了握手, “和你共事十分愉快。”</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和暗红骑士之间恩怨未了*。</li><li>选择一位调查员拥有法罗斯之光，相应更新在剧本日志中。</li><li>在剧本日志中记2_时间_。你可以_启程_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 你担心最坏的事情业已发生，退回办公室，这里是最后的防线。但你回来得还是太迟了，这里已经经历了一场屠杀。一片死亡的惨状。鲜血在混乱中喷得到处都是，从墙上滴了下来。眼前的尸体被吃了一半，这样可怕的景象烙进了你的脑海，永远无法忘记。</p><p>你没有线索再能追寻，也害怕遭遇这样的命运，决定就此止损，离开这座城市。不过，你还是注意到，死者之中并无那位年长的骑士。也许他也已经逃了。若是如此，你们之后可能还要见面……</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>每位尚未被击败的调查员承受1点精神创伤。</li><li>在剧本日志中，记录如下：<ul><li>*特别小组未能阻挡恶兽*。</li><li>*你和深红斗篷的恶兽之间恩怨未了*。</li></ul></li><li>深红斗篷的恶兽拥有法罗斯之光，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution4": {
            "title": "结局4",
            "body": "<p>_结局4_: 你在西里特工城外的藏身处低调了几天，当周晚些与他碰头。他顶着深深的黑眼圈，胡子看来也是一团杂乱，久未打理。你进门的时候，他疲惫地望着你。他阴郁地说道在你蛰伏的日子里究竟发生了什么：“骑士和他的手下依然在亚历山大阴魂不散。他和那头可怕的怪物已经全面开战，而受苦的却是我们的人民。”他愤愤一拳砸在桌上，“这群狗娘养的向来如此。为了保住权力，他们不择手段，却是无辜的人遭殃。说实话，我都分不出他们哪一方更糟。”</p><p>你道歉说自己没能帮上什么，但他摇了摇头：“不，不用道歉。你已经做了能做的一切。你现在要去哪儿？”你在亚历山大的机会稍纵即逝，于是你告诉他自己会搭下一班火车，去别处找寻其他的钥匙。你好奇他是否愿意与你同行。“我也有新任务，但是……”他若有所思地挠着自己的胡子，“我担心战争继续下去，我挚爱的城市会变成什么样子。不管有没有命令，我都会留下来。”他站起来和你握了握手，你担心这会不会是你们最后一次握手。“我希望咱们能再见面。但在那之前……我还有事情要做。”</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和暗红骑士之间恩怨未了*。</li><li>暗红骑士拥有法罗斯之光，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution5": {
            "title": "结局5",
            "body": "<p>_结局5_: 你在红衣特工的簇拥下来到了主顾在证券交易所的办公室。你上次来过之后，这里已经彻底重新清理了一番。那幅熟悉的红甲骑士大画旁立着一台崭新的柜子。你按照商量好的交出了钥匙，放入柜子锁死。门关上的那一刻，一阵气流和强压的感觉穿过房间。你的鼓膜也在这股强压下作响——这无疑是因为所谓的“节点”。</p><p>暗红骑士不无骄傲地看着手下的特工安放古代遗物。“邪恶的力量又一次阴谋将我们赶出自己的家园，但我们又一次胜利了。”他断言道。就算他脸上有过任何惧怕或担心的表情，现在也都已消失，只剩下面对过无数敌人之后的冷静的决绝。钥匙现在安全无虞地保存着。他转向你，和你握手，指着桌前：“来吧，坐下。你完成了你的工作，现在轮到我了。我允诺过答案，你也将得到答案。”</p><ul><li>跳至_结局8_。</li></ul>"
          },
          "resolution6": {
            "title": "结局6",
            "body": "<p>_结局6_: 你在西里特工城外的藏身处低调了几天，当周晚些与他碰头。而那件宝贝则安稳地藏在你手上。他比你们上次见面的时候洁净多了，眉宇间带着欢快的神色，笑容更是今非昔比。在你蛰伏的日子里究竟发生了什么，从他这份欢欣已可见一斑。“恶兽和它的信徒都藏了起来，其他同志会成员看起来也已不见。”他说着满意地咧开嘴笑了，“他们所谓的‘保护人类’和‘正统统治’，也在遗物失去的时候，一起从这座城里消失了。不过……”他的眼神飘向承载钥匙之光的容器，“我觉得你还会再见他们的。其实，我敢打赌，他们肯定会追着你不放。还是小心为上。”</p><p>你问哈桑，既然他在亚历山大的目标已经完成，接下来要做什么。“其实我已经有了新任务。”他答道，“泰勒专员昨天给我发了新的密档。自从加入基金会以来，我要第一次离开自己挚爱的城市了。”他感伤地叹了口气，“好吧，希望我们还能再见面。”他站起来和你握了握手，“和你共事十分愉快。”</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和深红斗篷的恶兽之间恩怨未了*。</li><li>选择一位调查员拥有法罗斯之光，相应更新在剧本日志中。</li><li>在剧本日志中记2_时间_。你可以_启程_。</li></ul>"
          },
          "resolution7": {
            "title": "结局7",
            "body": "<p>_结局7_: 可怕的怪物和红衣特工之间已经卷入一场全面战争。留在亚历山大继续行动实在太过危险。将如此动荡的局势抛在身后实在非你所愿，但看来也已经没有别的选择了。同志会宣称自己只是为了保护人类，但却将亚历山大的人民陷入危险不顾，实在是讽刺。看来这个组织里的人物形形色色。你兴许能将其中一些争取到自己这边。但在亚历山大的这些看来是不可能了。你阴郁地离开了这座城，希望下一个任务能顺利些。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录*大战打响*。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
          },
          "resolution8": {
            "title": "结局8",
            "body": "<p>_结局8_: 你问骑士红色同志会到底是个什么组织，你目前见过的成员既有野蛮凶残的，也有讲道理的。为什么都这么神秘呢？“我没有对你说谎，我们只是为了保护人类。”他指了指安全封在柜子里的法罗斯之光，“这些东西，太过强大，不能为人所用；又太过珍贵，不能为人所失。你肯定也注意到了其他实体对我们世界的影响。我们称之为‘域外来客’。这些遗物就是对抗这些实体的唯一防线。同志会要确保它们安全，只能用于和域外来客的战争。这也就是我为什么不能让这件神器落入那头恶兽手中。艾里奇对域外来客研究最多——要是你想了解更多，就去找她。我记得，上次有人见到她还是在加德满都附近。但你若想跟她说话，怕是得找个翻译。她总是神秘莫测，难以理解。”他注视着自己背后穿红铠甲的骑士肖像，“至于到处都是红色的原因……保管异星本源的宝器是件危险又显眼的使命。所以我们将它们包裹在衣物之下，让它们在人类社会中不那么引人注目。但这个过程，不知怎的，会让它们变为红色。当然，这样也会有别的益处。如果你愿意的话，可以把它当作一种……秘密打招呼的方式。”他抬起眉毛，像在看你的反应。“我们过去也吸收过新的成员加入队伍，只要他们能证明自己值得信赖、能力出众，就像你一样。也许有朝一日你也会染上红色。现在，我觉得自己已经完成了交易。再次感谢你的帮助。我的人会补贴你的差旅费用。”你们的对话友善但也不无突兀地到此为止。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下：<ul><li>*特别小组援助了骑士*。</li><li>*你和深红斗篷的恶兽之间恩怨未了*。</li></ul></li><li>暗红骑士拥有法罗斯之光，相应更新在剧本日志中。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 91,
        "missing": 0,
        "untranslated": 0,
        "present": 91,
        "specialRules": 0
      }
    },
    "shadesOfSuffering": {
      "id": "shadesOfSuffering",
      "name": "苦痛之影",
      "nameEn": "Shades of Suffering",
      "referenceCode": "09660",
      "file": "scenarios/shadesOfSuffering.json",
      "sectionsEn": {
        "tokens": {
          "easyStandard": {
            "skull": "-X. X is half the number of charges on The Shade Reaper, rounded up (X cannot be greater than 6).",
            "cultist": "-4. If you fail by 2 or more, place 1 charge on The Shade Reaper.",
            "tablet": "-1. If you are at a location with a _Geist_ enemy, reveal an additional chaos token.",
            "elderThing": "-4. You may place 1 charge on The Shade Reaper to treat this token's modifier as 0 instead."
          },
          "hardExpert": {
            "skull": "-X. X is the number of charges on The Shade Reaper.",
            "cultist": "-5. Place 1 charge on The Shade Reaper.",
            "tablet": "-3. If you are at a location with a _Geist_ enemy, you automatically fail.",
            "elderThing": "-6. You may place 1 charge on The Shade Reaper to treat this token's modifier as -3 instead."
          }
        },
        "label": {
          "elderThing": {
            "easyStandard": "Place 1 charge on The Shade Reaper to treat this token's modifier as 0 instead",
            "hardExpert": "Place 1 charge on The Shade Reaper to treat this token's modifier as -3 instead"
          },
          "painfulHistory": {
            "ally": "<p>Discard the _Ally_ asset in play with the highest printed cost. Test {'{'}willpower{'}'} (X), where X is that asset's printed cost. If you fail, place charges on The Shade Reaper equal to the discarded asset's printed cost.</p>",
            "doom": "Place 1 doom on Tzu San Niang."
          },
          "harvesterOfWoe": {
            "useTheParasol": "Use the parasol against her.",
            "letHerGo": "Let her go.",
            "cancelDamage": "Cancel 1 damage",
            "cancelHorror": "Cancel 1 horror"
          },
          "spiritHarvest": {
            "damage": "Each investigator takes 1 damage and 1 horror.",
            "tzuSanNiang": "Tzu San Niang shifts The Shade Reaper and then places 2 charges on it."
          }
        },
        "remembered": {
          "tradedForAKitten": "Traded for a kitten",
          "foundACheapMemento": "Found a cheap memento",
          "embarrassedTheConsulate": "Embarrassed the consulate",
          "peeredBeyond": "Peered beyond",
          "sharedADeepPain": "Shared a deep pain",
          "foundHiddenBones": "Found hidden bones"
        },
        "intro": {
          "title": "File #46–Q: Shades of Suffering",
          "body": "Check your Campaign Log.",
          "flintTraveledToKualaLumpur": "*If Flint traveled to Kuala Lumpur*, proceed to _Intro 1_.",
          "agentFlintIsMissing": "*If Agent Flint is missing*, skip to _Intro 2_.",
          "intro1": "<p class='file'>_Intro 1_: You and Flint meet at the Royal Selangor Club: a sharp-angled complex situated on the edge of a meticulously groomed lawn. A cricket match unfolds for the club members on the turf below as you and Flint discuss the Coterie’s interests and Tzu San Niang’s possible aims. “Hold on a moment,” Flint stops mid-sip and stares into the throng of wealthy expatriates. You turn your head and watch the crowd. A woman with a pale complexion and jet-black hair turns away from you, twirling a bright red parasol.</p><p>“Well, that was easy,” laughs Flint. You can hear a steely edge in his voice as he stands, gingerly, and leaves a generous tip for the staff. “Let’s see what she’s up to, shall we?”</p><ul><li>In your Campaign Log, record *Flint rejoined the cell*. Any one investigator may choose to add the Inspector Flint story asset to their deck. It does not count toward their deck size. This card can be found in the Globetrotting encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Proceed to _Setup_.</li></ul>",
          "intro2": "<p class='file'>_Intro 2_: You arrive in Kuala Lumpur filled with a gnawing, terrible fear. As you negotiate the fare to the railway station, your sense of foreboding only grows. The air is full of intoxicating, overwhelming scents: juicy grilled meats, chewed betel nut, wisps of incense. All of it fills your senses and reminds you how far you are from home. After your driver drops you off at the bustling railway station, you wander the platforms and rail offices, but all your inquiries are met with blank indifference.</p><p>Amidst the steam of a retreating train, you see a brilliant red parasol held by a beautiful woman with jet black hair. You barely have time to react before she melts into the bustle, but you have to wonder: is this an unlikely coincidence, or a Coterie trap? Either way, it’s the only lead you have.</p><p class='basic right'>Proceed to _Setup_.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: *Shades of Suffering*, *Dark Veiling*, *Mysteries Abound*, *Scarlet Sorcery*, *Spreading Corruption*, and *Striking Fear*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/shades-of-suffering.png'><img src='{setImgPath}/dark-veiling.png'><img src='{setImgPath}/mysteries-abound.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/striking-fear.png'></section>",
          "placeLocations": "Put the Kuala Lumpur Station (*East Wing*), Kuala Lumpur Station (*West Wing*), Selangor Club, and Selangor Club Padang locations into play.",
          "setAsideOtherLocations": "Set each other location (Melati’s Shop, Tin Mine, and Wayang Kulit Theater) aside, out of play.",
          "checkCampaignLog": "Check the Campaign Log.",
          "flintRejoinedTheCell": "*If Flint rejoined the cell*, each investigator begins play at Selangor Club. If an investigator added the Inspector Flint story asset to their deck, they may search their deck for Inspector Flint, put him into play under their control, then shuffle their deck. For the remainder of this scenario, he does not take up an ally slot.",
          "agentFlintIsMissing": "*If Agent Flint is missing*, each investigator begins play at Kuala Lumpur Station (*West Wing*).",
          "geists": "Choose one of each _Geist_ enemy (Uncanny Shadow, Buried Miner, and Slain Foreman) at random and set them aside, out of play. Remove the other copies of those _Geist_ enemies from the game. These cards are double-sided and have story cards on their reverse side. For the best experience, do not look at the story cards on their other side until you are instructed to do so.",
          "tzuSanNiang": "Spawn the Tzu San Niang enemy (*The Lady with the Red Parasol*) side faceup in the shadows and attach The Shade Reaper to her, _Unstable_ side faceup. Resolve her concealed keyword, placing her concealed mini-cards at each location other than the starting location.",
          "time": "Check how much _time_ has passed in the Campaign Log.",
          "elevenOrFewerTime": "If 11 or fewer _time_ has passed, no change is made.",
          "betweenTwelveAndEighteenTime": "If 12-18 _time_ has passed, place three resources on The Shade Reaper, as charges.",
          "betweenNineteenAndTwentySixTime": "If 19-26 _time_ has passed, place six resources on The Shade Reaper, as charges.",
          "twentySevenOrMoreTime": "If 27 or more _time_ has passed, place nine resources on The Shade Reaper, as charges. Place 1 doom on the agenda."
        },
        "theBomoh": {
          "title": "The Bomoh",
          "theBomoh1Part1": "<p>_The Bomoh 1_: Before you even step inside the shop, you are greeted by the intense but pleasant fragrance of dried flowers and herbs that hang in bundles from the low ceiling. The scent is intoxicating. As your eyes adjust to the dimly lit interior, a small middle-aged Malay woman in an ornate dress rises from her stool in the corner to greet you.</p><p>“You’re a bit late, but I suppose it’s better than if you had arrived early,” she says matter-of-factly. You ask her what she means, and she shakes her head. “I’m Melati. Our meeting was foretold.” She explains that she is a bomoh, or shaman, and that she was forewarned of your meeting by the spirits. You ask her about the woman with the red parasol.</p><p>“Yes, that’s why I was glad you didn’t arrive early,” she grimaces, then lights a bundle of some aromatic herbs. You feel a tingling lightheadedness wash over you, followed by soothing calm. Melati goes on: “That was Tzu San Niang. She’s the reason I have to cleanse my shop. There is a foul essence that follows her. Perhaps why she masks her unclean spirit with a veneer of politeness.” As Melati speaks, a cloud of vague confusion passes over her, as if she cannot place something. You ask her what Ms. Tzu wanted.</p><p>“I truly can’t even remember what she asked of me.”</p>",
          "sorcererOrClairvoyant": "<p class='red'>_Read only if an investigator has the Sorcerer or Clairvoyant trait_: As you study Melati’s aura, you sense that she is under the sway of some powerful influence, possibly a spell that wiped her memory of any specifics of their conversation. The effects do not appear to be lasting, but you wonder what the Lady with the Red Parasol wanted to conceal.</p>",
          "theBomoh1Part2": "<p>The bomoh recites a low, mumbling chant as she completes the cleansing ritual, then holds one hand to her temple. Her brow furrows as she falls to her knees, wracked with pain. You move to help her up, and she holds one hand out, steadying herself against the low wooden table, and then slides to sit. She gestures for you to sit across from her.</p><p>“Now I understand why they told me you were coming,” she smiles bravely. The deep lines in her face fold with shadows in the dim shop. The bomoh pours you a cup of hot, steaming tea. “The spirits are restless. Something has stirred up a deep well of pain as the city reforms itself to keep up with such change. People coming and going. And in all of it, I sense a dark aura: a cloud of misfortune. And at the center of it, the lady with the red parasol. She is a harbinger of sorts. Inflicting pain and misery even as she reaps the rewards of great industry.”</p><p>The bomoh’s voice is firm and clear, even as her hands shake, holding her tea cup. You sip the rich, earthy brew as you consider the situation. Tzu San Niang has some greater design at work, but what? You ask Melati if the spirits have told her anything else. She shakes her head.</p><p>“I sense only their great pain. And that their great pain is linked, in some way, to the lady with the red parasol. It is almost as though she feeds on it. Devours it.”</p><p class='basic'>Check your Campaign Log.</p>",
          "flintRejoinedTheCell": "*If Flint rejoined the cell*, proceed to _The Bomoh 2_.",
          "agentFlintIsMissing": "*If Agent Flint is missing*, skip to _The Bomoh 3_.",
          "theBomoh2": "<p>_The Bomoh 2_: Melati doubles over again, clutching one hand to her chest. You move to help her as Inspector Flint produces a small med kit to administer emergency aid. The bomoh shakes her head.</p><p>“Do not worry for me. I am stronger than any spirit, though I feel they are in such deep, awful pain. The city is rife with sorrow.” She sighs and rights herself. “As I said before, our meeting was not by any chance. Perhaps if we can speak with the spirits, put them to rest, we can understand Ms. Tzu’s greater aims and, perhaps, thwart them. Can you help me?”</p><p>Flint looks to you, and to the bomoh, and smiles. “We’ll help you get to the bottom of this.”</p><p>Skip to _The Bomoh 4_.</p>",
          "theBomoh3": "<p>_The Bomoh 3_: Melati doubles over, clutching one hand to her chest. You move to help her, pulse racing, as her eyes roll back in her head. The fit passes, and she lets out a heavy sigh. “Your friend just spoke to me. Li. Li Flint.” Your blood runs cold as she says the name. The bomoh’s eyes glisten in the dim as she lights a candle.</p><p>“I am sorry to deliver such terrible news, but his spirit is in agony. He spoke of Ms. Tzu and her cruelty. Even now, she drinks his despair, feeds on it, as you or I consume food. I think I understand now.” She pauses, takes a sip of her tea, and looks gravely at you. “Ms. Tzu consumes the agony of the departed. Feeds on it. The city is rife with sorrow. I know we have only just met, but can you help me?”</p><p>You give a slow nod, resolve and wrath equally heavy in your heart.</p><ul><li>In your Campaign Log, cross off *Agent Flint is missing*. In its place, record *Agent Flint is dead*.</li><li>Place two charges on The Shade Reaper.</li><li>Proceed to _The Bomoh 4_.</li></ul>",
          "theBomoh4": "<p>_The Bomoh 4_: Before you leave Melati’s shop, she tells you of three epicenters of spiritual disturbance in the city.</p><ul><li>Put the Tin Mine and Wayang Kulit Theater locations into play.</li><li>Find the three set-aside _Geist_ enemies and spawn them as follows:<ul><li>Spawn Slain Foreman at Kuala Lumpur Station (West Wing).</li><li>Spawn Uncanny Shadow at Wayang Kulit Theatre</li><li>Spawn Buried Miner at Tin Mine</li></ul></li><li>Return Tzu San Niang (*The Lady with the Red Parasol*) to the shadows and resolve her concealed keyword, distributing each of those concealed mini-cards among each location with a _Geist_ enemy.</li><li>Remove all doom from each card in play other than Tzu San Niang. If it is agenda 1a, advance directly to agenda 2a (*Do not resolve agenda 1b*).</li></ul>"
        },
        "resolutions": {
          "xp": {
            "bonus": "Mastered the Shade Reaper."
          },
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached (each investigator resigned or was defeated)_: Overwhelmed, you flee Kuala Lumpur. Whatever sway Tzu San Niang held over the city begins to infect your own mind and intrudes into your dreams. In the following nights, you wake up in a cold sweat, imagining yourself bowing before her, fixated on her mysterious red parasol. In idle moments, you catch yourself humming the soft, lilting song she sang as she followed you in Kuala Lumpur. You wonder if you will ever be able to truly leave her behind…</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of Tzu San Niang*.</li><li>Tzu San Niang is the bearer of The Shade Reaper. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>You may _embark_.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: A crack of energy ripples through the air between you. Power—terrible, intoxicating power—courses through your arm. Tzu San Niang wails as she collapses to the ground, convulsing with pain.</p><p>“Go,” you say in a voice not entirely your own. “Go somewhere far away and never return.”</p><p>You look down at her as the terrible energy dissipates. Tzu San Niang’s face is streaked with tears, and her hands shake as she stands up. She gives you a fleeting, baleful look, then turns and walks away into the fog.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Each investigator earns 1 bonus experience, as they mastered the Shade Reaper. Each investigator also suffers 1 physical trauma as the Shade Reaper draws essence from your soul.</li><li>In your Campaign Log, record *Tzu San Niang is under your sway*.</li><li>Choose an investigator to be the bearer of The Shade Reaper and update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>You may _embark_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: You brandish The Shade Reaper at Tzu San Niang even as you feel your grip on the parasol falter. “Go,” you tell her firmly. “Go somewhere far away and never return.” But your voice is drowned out by her mocking laughter.</p><p>“How pathetic,” she spits at you, then turns her gaze to the parasol. “Don’t worry. I’ll be back for you,” she coos in a lilting, singsong voice. As she walks away, you realize she wasn’t addressing you. In your hands, The Shade Reaper pulses with power. You wonder how much pain and misery is stored within it, and how many souls remain in torment elsewhere…</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of Tzu San Niang*.</li><li>Choose an investigator to be the bearer of The Shade Reaper and update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>You may _embark_.</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: You awaken in a dark room. The air is thick with incense and the shelves are lit with brightly-burning candles. For a fleeting moment, you wonder if the intense pain you felt at Tzu San Niang’s hands was a dream, before you see her sitting in a chair at the far end of the room, a cruel smile spread across her lips.</p><p>“Rise,” she says. Dutifully, you stand up.</p><p>“Come,” she beckons. Compelled by an awful, inexorable force, you walk through the darkness to stand before her.</p><p>“Kneel.” You do as your lady commands. Out of the corner of your eye, you see Melati standing, also under her sway, her own face pinched in concentration as she watches this awful scene unfold.</p><p>“Sometimes we make mistakes,” Tzu San Niang says. She leans forward and pats you gently. “And you have made a grave mistake. You have hurt me. You have taken something I need. But, also, all you were doing was proving your worth to me. I can sense your devotion. Are you not devoted to me?” Your mouth forms the word, but your mind resists as you say: “Yes.” Tzu San Niang nods, smiling. “This is the beginning of a wonderful partnership, I think.”</p><p>Suddenly, you see Melati dart forward, brandishing a ceremonial knife. As she strikes the lady with the red parasol, you feel Tzu San Niang’s grip on your will weaken. “Get out of here!” shouts the bomoh. As the pair struggle, you flee for your life.</p><p>Walking the streets of Kuala Lumpur in a haze, you feel a deep, thrumming pain. Even as you return to your hotel, you wonder if you will ever shake this strange desire to serve the lady with the red parasol. You hope you never meet her again.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *Tzu San Niang has you under her sway*.</li><li>Tzu San Niang is the bearer of The Shade Reaper. Update the Campaign Log accordingly.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>You may _embark_.</li></ul>"
          }
        }
      },
      "sections": {
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为影穑上充能数的一半，向上取整(X不能大于6)。",
            "cultist": "-4。如果你检定失败且低于难度至少2点，在影穑上放置1充能。",
            "tablet": "-1。如果你所在地点有_灵怪_敌人，揭示额外一个混乱标记。",
            "elderThing": "-4。你可以在影穑上放置1充能，以将本标记的修正值改为视作0。"
          },
          "hardExpert": {
            "skull": "-X。X为影穑上充能数。",
            "cultist": "-5。在影穑上放置1充能。",
            "tablet": "-3。如果你所在地点有_灵怪_敌人，你自动失败。",
            "elderThing": "-6。你可以在影穑上放置1充能，以将本标记的修正值改为视作-3。"
          }
        },
        "label": {
          "elderThing": {
            "easyStandard": "你可以在影穑上放置1充能，以将本标记的修正值改为视作0",
            "hardExpert": "你可以在影穑上放置1充能，以将本标记的修正值改为视作-3"
          },
          "painfulHistory": {
            "ally": "<p>弃掉场上印刷费用最高的_盟友_支援。检定{'{'}willpower{'}'}(X)，其中X等于该支援的印刷费用。如果你检定失败，在影穑上放置充能，数量等于弃掉的支援的印刷费用。</p>",
            "doom": "在朱三娘上放置1个毁灭标记"
          },
          "harvesterOfWoe": {
            "useTheParasol": "用伞对付她",
            "letHerGo": "让她走",
            "cancelDamage": "取消1点伤害",
            "cancelHorror": "取消1点恐惧"
          },
          "spiritHarvest": {
            "damage": "每位调查员受到1点伤害和1点恐惧",
            "tzuSanNiang": "朱三娘变换影穑，然后在上面放置2充能"
          }
        },
        "remembered": {
          "tradedForAKitten": "换到了一只小猫",
          "foundACheapMemento": "找到了一件便宜的纪念品",
          "embarrassedTheConsulate": "让领事蒙羞",
          "peeredBeyond": "眺望彼端",
          "sharedADeepPain": "分担了深沉的痛苦",
          "foundHiddenBones": "找到了掩埋的遗骨"
        },
        "intro": {
          "title": "档案#46-Q: 苦痛之影",
          "body": "检查剧本日志。",
          "flintTraveledToKualaLumpur": "*福林前往吉隆坡*",
          "agentFlintIsMissing": "*福林特工失踪*",
          "intro1": "<p class='file'>你和福林在皇家雪兰莪俱乐部碰头。这是一栋尖顶的复合建筑，外面是一大片修剪整齐的草地。俱乐部的会员正在草地上举办板球比赛，而你和福林则在讨论同志会在关注什么，以及朱三娘可能的目的。“等等。”福林突然停下，瞪着外面富有的侨民。你也转过头去，看向人群。一个皮肤雪白、头发乌黑的女子背朝你们，转着一把亮红的阳伞。</p><p>“好吧，这下简单了。”福林笑道。他站了起来，兴致颇高，还给了服务员一大笔小费。但你能听出他的声音中强硬的色彩。“咱们去看看她要干什么，嗯？”</p><ul><li>在剧本日志中，记录*福林重归特别小组*。任意一位调查员可以选择将福林探员剧情支援加入其牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>进入_冒险设置_。</li></ul>",
          "intro2": "<p class='file'>你到了吉隆坡，内心的恐惧在噬咬。你正在讲价去火车站要多少钱，内心不安的预感越演越烈。空气中弥漫着浓郁的醉人气味：是浸透汤汁的肉食，是槟榔咀嚼的味道，是一把一把的香料。这些气味充斥了你的感官，提醒你离家已有多远。司机将你扔在了人声鼎沸的火车站外面。你去了月台，也问了火车办公室，但都碰了一鼻子灰。</p><p>你在火车奔涌的气流中看到一把亮红色的伞，持伞的是一位乌黑头发的美丽女子。你还没来得及反应，她就已经融入人流。你禁不住想：这是一场不可思议的偶遇，还是同志会的陷阱？但无论如何，这都是你现在唯一的线索。</p><p class='basic right'>进入_冒险设置_。</p>"
        },
        "setup": {
          "gatherSets": "收集以下遭遇组的所有卡牌：*苦痛之影*、*黑暗笼罩*、*处处神秘*、*猩红巫术*、*腐败扩散*、*恐惧打击*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/shades-of-suffering.png'><img src='{setImgPath}/dark-veiling.png'><img src='{setImgPath}/mysteries-abound.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/striking-fear.png'></section>",
          "placeLocations": "将吉隆坡火车站*(东翼)*、吉隆坡火车站*(西翼)*、雪兰莪俱乐部、雪兰莪俱乐部草坪地点放置入场。",
          "setAsideOtherLocations": "将其他所有地点(美拉提的商店、锡矿、哇扬皮影偶戏剧场)放在一边，位于场外。",
          "checkCampaignLog": "检查剧本日志。",
          "flintRejoinedTheCell": "如果*福林重归特别小组*，每位调查员从雪兰莪俱乐部开始游戏。如果有调查员将福林探员剧情支援加入了自己牌库，该调查员可以查找自己牌库，找出福林探员，放置入场，由自己控制，然后混洗自己牌库。在本场冒险的剩余时间内，他不占用盟友槽位。",
          "agentFlintIsMissing": "如果*福林特工失踪*，每位调查员从吉隆坡火车站*(西翼)*开始游戏。",
          "geists": "在每种_灵怪_敌人中各随机选择一张(诡怪的阴影、被掩埋的矿工、被杀害的工头)，放在一边，位于场外。将这些灵怪敌人的其他卡牌从游戏中移除。这些卡牌是双面的，其背面为剧情卡牌。为了获得最佳的游戏体验，除非受到指示，否则请勿查看其另一面的剧情卡牌。",
          "tzuSanNiang": "将朱三娘敌人生成在阴影中，*(红伞夫人)*面朝上，并将影穑附属到她身上，_动荡_面朝上。结算她的隐匿关键词，将她的隐匿迷你卡牌放到起始地点以外的每个地点。",
          "time": "检查剧本日志中已经流逝了多少_时间_。",
          "elevenOrFewerTime": "如果流逝的_时间_小于等于11，不作改动。",
          "betweenTwelveAndEighteenTime": "如果流逝的_时间_为12到18，在影穑上放置三个资源，作为充能。",
          "betweenNineteenAndTwentySixTime": "如如果流逝的_时间_为19到26，在影穑上放置六个资源，作为充能。",
          "twentySevenOrMoreTime": "如果流逝的_时间_大于等于27，在影穑上放置九个资源，作为充能。在当前密谋上放置1个毁灭标记。"
        },
        "theBomoh": {
          "title": "降头师",
          "theBomoh1Part1": "<p>你还没深入店铺里面，就闻到一阵醉人的芳香——低矮的天花板上垂下一捆捆干花和草药。你眼睛刚适应里面昏暗的光线，角落里就有一位身材矮小、衣着华丽的中年马来女子从凳子上起来迎接你。</p><p>“你来得有点儿晚了，但我想总比来早了好。”她一本正经地说道。你问她是什么意思，她摇了摇头：“我叫美拉提，我们的见面早有预言。”她解释说自己是个降头师，你也可以称她是萨满。魂灵已经告诉过她你会来。你问起红伞夫人的事情。</p><p>“是了，这就是我为什么高兴你没有早来。”她笑着点燃一捆芳香的药草。你感到一阵刺痛，头晕眼花，随即心神一片澄明。美拉提继续道：“那是朱三娘。她来了，我就得净化这爿店。她招来了污秽之源。兴许这就是她礼貌的缘由——她得遮住自己不洁的灵魂。”美拉提说着陷入一股模糊的疑云，仿佛自己有什么东西无处安放。你问她朱夫人想要什么。</p><p>“我真的记不得她向我要什么了。”</p>",
          "sorcererOrClairvoyant": "<p class='red'>_仅当有调查员具备法师或感知特性才能阅读：_你研究了一番美拉提的气场，意识到她正受一股强大力量的操控，可能是有法术清除了她们对话中特定内容的记忆。这效果看来并不持久，但你好奇红伞夫人到底想掩盖什么。</p>",
          "theBomoh1Part2": "<p>降头师默念咒文，完成了净化仪式。她一手按住太阳穴，眉头紧皱，痛苦地跪了下来。你帮她站起，她伸出一只手扶着矮木桌，滑着坐下，示意你坐到她旁边。</p><p>“现在我懂他们为什么说你来了，”她勇敢地笑道，脸上深深的皱纹在昏暗的店面中显出阴影。降头师给你倒了杯茶，热气腾腾。“魂灵不得安宁。有什么东西搅动了苦痛的深潮，连这座城市也随之变化。人们来来往往，我在其中看到了黑暗的气息：不幸的乌云。而红伞夫人就在正中央。她是一切的预示者，散播痛苦和灾厄，从中收割大业的成果。”</p><p>降头师握着茶杯的手在抖，但她的声音却坚定清晰。她泡的茶朴实料足，你喝了一口，思索着当前的情况。朱三娘有一盘更大的棋，但具体是什么呢？你问美拉提魂灵是否告诉了她什么。她摇了摇头。</p><p>“我只能感知到巨大的痛苦。而这种巨大的痛苦以某种方式和红伞夫人连接在了一起。很有可能，她是以此为食，将其吞噬。”</p><p class='basic'>检查剧本日志。</p>",
          "flintRejoinedTheCell": "*福林重归特别小组*",
          "agentFlintIsMissing": "*福林特工失踪*",
          "theBomoh2": "<p>美拉提又俯下身子，一手抓住胸口。福林探员掏出了医疗小包，你上前帮他实施急救。降头师又摇摇头。</p><p>“不用担心我。我比任何魂灵都要强大，我能感受到他们陷入了巨大的、可怕的痛苦之中。整座城市悲伤遍地。”她叹了口气，立了起来。“我说过，这次见面不是偶然。要是我们能和魂灵对话，让他们安息，兴许就能理解朱夫人的大棋，没准还能将其化解。你能帮我一把吗？”</p><p>福林先看看你，再看看降头师，笑了。“我们一定帮你把这件事彻底解决。”</p>",
          "theBomoh3": "<p>美拉提俯下身子，一手抓住胸口。你上前帮忙，发现她脉搏奇快，眼睛上翻。症状很快过去，她深深地叹了口气。“你的朋友刚刚对我说话了。李，李福林。”她一提到这个名字，你觉得自己血液都吓得凝结了。降头师点起一根蜡烛，照亮了她的眼睛。</p><p>“我很抱歉要告诉你坏消息，但他的魂灵十分痛苦。他提到了朱夫人，说她有多么残暴。即便现在，她也在痛饮他的绝望，靠它滋养。就像你我进食一样。我明白了。”她顿了顿，喝了口茶，严肃地望着你。“朱夫人以亡魂的痛苦为食。整座城市悲伤遍地。我知道我们这才刚见面，但你能帮帮我吗？”</p><p>你缓缓地点了点头，决心和愤怒同样沉重地压在你心头。</p><ul><li>在剧本日志中，划掉*福林特工失踪*。在其位置记录*福林特工已死*。</li><li>在影穑上放置2充能。</li></ul>",
          "theBomoh4": "<p>你离开美拉提的店之前，她告诉你城中有三个地方的魂灵格外活跃。</p><ul><li>将锡矿和哇扬皮影偶戏剧场地点放置入场。</li><li>找出三张放在一边的_灵怪_敌人，按如下地点生成：将被杀害的工头生成在吉隆坡火车站*(西翼)*。</li><li>将诡怪的阴影生成在哇扬皮影偶戏剧场。</li><li>将被掩埋的矿工生成在锡矿。</li></ul></li><li>将朱三娘*(红伞夫人)*返回阴影中，结算她的隐匿关键词，在每个有_灵怪_敌人的地点分发其隐匿迷你卡牌。</li><li>移除场上除朱三娘外，其他所有卡牌的毁灭标记。如果是密谋1a，直接推进到密谋2a*(不结算密谋1b)*。</li></ul>"
        },
        "resolutions": {
          "xp": {
            "bonus": "掌控了影穑"
          },
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员撤退或者被击败)_: 你不堪重负，逃出了吉隆坡。朱三娘用以操纵这座城市的手段，已经开始入侵你的意志，闯入你的梦境。接下来几夜，你都一身冷汗地惊醒，发现自己想象对她弯腰，为她神秘的红伞痴迷。你发现自己闲暇时还会哼起小曲，那调子正是她在吉隆坡追逐你时口中悠扬轻快的那一支。你不禁想知道自己是否还能将她真正抛诸脑后……</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和朱三娘之间恩怨未了*。</li><li>朱三娘拥有影穑，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。</li><li>你可以_启程_。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>一股能量在空气中起伏。力量——可怕的、骇人的力量——从你的手臂喷涌而出。朱三娘哀嚎着倒地，痛苦的痉挛。</p><p>“滚。”你发出了不全属于自己的声音，“滚得远远的，再也不要回来。”</p><p>你俯视着她，可怕的能量正在消散。朱三娘脸上满是泪痕。她站了起来，双手颤抖。有那么一瞬，她恶狠狠地瞟了你一眼，随即转身走入了雾中。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>每位调查员取得1点奖励经验值，因为其掌控了影穑。每位调查员也承受1点肉体创伤，因为影穑抽走了你灵魂的精华。</li><li>在剧本日志中，记录下*朱三娘受你支配*。</li><li>选择一位调查员拥有影穑，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。</li><li>你可以_启程_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>你朝朱三娘挥舞影穑，却觉得自己渐渐握不住伞了。“滚吧。”你坚决地告知她，“滚得远远的，再也不要回来。”但你的话语被她嘲讽的笑声盖过了。</p><p>“多么可悲啊。”她啐了你一口，转而望着伞。“别着急。我会回来找你的。”她用一种轻快的调子哼道。她走远的时候，你才反应过来，她不是在对你说话。影穑在你手中脉动着能量。你好奇这里面究竟藏着多少痛苦和磨难，别处又有多少人依然在受苦……</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和朱三娘之间恩怨未了*。</li><li>选择一位调查员拥有影穑，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。</li><li>你可以_启程_。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>你在一个昏暗的房间里醒来。空气中一股浓郁的香料味道，架子上点着蜡烛。有那么一刻，你甚至想过在朱三娘手上遭受的剧痛是否只是一场梦。但你随即看到她坐在屋内远端的椅子上，唇间扬起一个残忍的笑容。</p><p>“起来。”她说道。你依令站起。</p><p>“过来。”她唤道。可怕无情的力量支配了你，你穿过黑暗，站到了她面前。</p><p>“跪下。”你听从了夫人的命令。你的余光看到一侧站着的美拉提，也被支配了。她看到眼前可怕的一幕，脸都揪在了一起。</p><p>“我们有时候定会犯错。”朱三娘说着向前轻轻拍了拍你，“你犯的错可严重了。你伤害了我，夺走了我需要的东西。不过，你所做的一切也证明了你很有价值。我能感受到你的忠诚。你忠于我吗？”虽然意志在抗拒，你的嘴还是吐出了一个词：“是的。”朱三娘点点头笑了，“这是我们伟大合作的开始。”</p><p>突然，你看见美拉提挥舞着仪式刀冲了过来。她猛击红伞夫人，你感到朱三娘对你的支配减弱了。“快走！”降头师喊道。你趁这两人扭打在一起，逃出生天。</p><p>你在吉隆坡的街上一路快走，只感到一阵深沉的疼痛嗡嗡作响。即便已经回到了酒店，你还是不能确定，自己是否还能摆脱这种为红伞夫人效命的奇怪愿望。你希望你们再也不要相见。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*朱三娘支配了你*。</li><li>朱三娘拥有影穑，相应更新在剧本日志中。</li><li>在剧本日志中记1_时间_。</li><li>你可以_启程_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 61,
        "missing": 0,
        "untranslated": 0,
        "present": 61,
        "specialRules": 0
      }
    },
    "withoutATrace": {
      "id": "withoutATrace",
      "name": "不留痕迹",
      "nameEn": "Without a Trace",
      "referenceCode": "09681",
      "file": "scenarios/withoutATrace.json",
      "sectionsEn": {
        "specialRules": [
          {
            "title": "Location Adjacency in the Realm of the Outsiders",
            "body": "<p class='basic'>Throughout this scenario, locations are arranged in a pattern of rows and columns, along with concealed mini-cards (see Locations in the Shadows, below). Each location is connected to each location adjacent to it.</p><ul><li>Adjacent locations share a side (left, right, above, or below). Locations that share only a corner are not adjacent.</li><li>During this scenario, concealed mini-cards are also placed adjacent to one or more locations as above, instead of placed at locations as normal (see Locations in the Shadows, below).</li></ul>"
          },
          {
            "title": "Locations in the Shadows",
            "body": "<p class='basic'>During this scenario, investigators must traverse the deceptively labyrinthine and illusory home world of the Outsiders. To represent the difficulty of exploring this alien dimension, three City of Remnants locations are placed in the shadows at all times (taken from the top of the Otherworld deck) and concealed mini-cards are arranged adjacent to locations, rather than placed at them. Exposing these concealed mini-cards is the key to finding a route through this otherworldly place.</p><ul><li>Concealed mini-cards adjacent to a location are considered to be at that location for the purposes of card abilities and game rules. Use the shroud value of your current location when attempting to expose an adjacent concealed mini-card.</li><li>When a City of Remnants mini-card is exposed, set it aside and find the City of Remnants in the shadows whose position in the shadows matches that mini-card (L for left, M for middle, and R for right). Put that location into play in the position where its mini-card was (unrevealed side faceup).<ul><li>If there were any other concealed mini-cards in that position, move them so they are arranged as evenly as possible in empty spots adjacent to the newly placed City of Remnants.</li></ul></li><li>After a City of Remnants location leaves the shadows, place the top card of the Otherworld deck in the shadows in the position where the just-exposed City of Remnants was (without looking at its other side). Then, resolve its concealed keyword, placing each of its concealed mini-cards arranged as evenly as possible in empty spots adjacent to the just-exposed City of Remnants.<ul><li>There must always be three City of Remnants locations in the shadows, if possible.</li></ul></li><li>More than one concealed mini-card may occupy the same spot, but no concealed mini-cards may occupy a spot where a location already is present.</li></ul>"
          }
        ],
        "tokens": {
          "easyStandard": {
            "skull": "-X. X is half the number of locations in play, rounded down.",
            "cultist": "-4. If you fail, the nearest Outsider enemy readies, moves once toward you, and attacks you if it is at your location.",
            "tablet": "-X. X is the number of set-aside hollows you own (max 5).",
            "elderThing": "-3. If you fail, choose a non-weakness card in your hand and set it aside, as a hollow."
          },
          "hardExpert": {
            "skull": "-X. X is the number of locations in play.",
            "cultist": "-6. If you fail, the nearest Outsider enemy readies, moves once toward you, and attacks you if it is at your location.",
            "tablet": "-X. X is 1 plus the number of set-aside hollows you own.",
            "elderThing": "-3. Choose a non-weakness card in your hand and set it aside, as a hollow."
          }
        },
        "label": {
          "otherworldlyHorror": {
            "takeDamageAndHorror": "Each investigator takes 1 damage and 1 horror.",
            "hollows": "Each investigator chooses a non-weakness card they control in their hand or play area and sets it aside, out of play, as a hollow.",
            "shuffleAllConcealed": "Shuffle all concealed mini-cards facedown, then place them at random in the positions they were in."
          },
          "otherworldlyLambs": {
            "takeDamageAndHorror": "Each investigator takes 1 damage and 1 horror.",
            "hollows": "Each investigator chooses a non-weakness card they control in their hand or play area and sets it aside, out of play, as a hollow.",
            "shuffleAllConcealed": "Shuffle all concealed mini-cards facedown, then place them at random in the positions they were in."
          },
          "mimeticNemesis": {
            "hollow": "Choose a non-weakness card in your hand and set it aside, as a hollow",
            "attack": "This enemy attacks you"
          }
        },
        "tooltips": {
          "courtOfTheOutsiders": {
            "resign": ""
          }
        },
        "intro": {
          "label": {
            "blowTheWhistle": "Blow the Whistle",
            "discardTheWhistle": "Dispose of the Whistle"
          },
          "title": "File #56–Y: Without a Trace",
          "intro1": "<p class='file'>_Intro 1_: Even with the Foundation’s resources at your beck and call, it takes some finagling to charter a ship across the Devil’s Triangle, especially given you have no cargo to speak of and refuse to allow any other passengers on board, for their safety. After all, if your theory is correct, this ship’s destination does not exist on any map, and for all you know, it might be a one-way journey. Agent Quinn has convinced one of her colleagues to helm the ship, so as to not endanger a civilian, and together you set off for the center of the triangle, hearts in throats.</p><p>“The commissioner will have gotten word by now,” Quinn says, standing with you at the helm of the ship. “Probably the end of my career, I would wager.” She stares off at the horizon as the sun dips just below the waves. Despite her words, her expression is steadfast, without even a hint of regret. “I just hope we find answers.” You concede, with a bit of trepidation, that you almost hope you don’t. The idea of ending up just like the people who have been snatched—it chills you to the core. “Well, no turning back now. Care to do the honors?” she asks, motioning toward the white raven whistle which hangs from a cord around your neck. You pull it off and clutch it in your palm, considering your options.</p><p class='basic'>The lead investigator must decide (choose one):</p><ul><li>Blow the whistle and summon Aliki to your side. Proceed to _Intro 2_.</li><li>Dispose of the whistle and do this alone. Skip to _Intro 3_.</li></ul>",
          "intro2": "<p class='file'>_Intro 2_: Reluctantly, you put the whistle to your lips and send its shrill, otherworldly warble across the ocean and perhaps beyond. A shudder creeps up your spine as the wind picks up. Within moments, the girl with the red sash has appeared, standing on the deck of your ship as though she had always been there. She speaks in Coptic, her words muffled by whistling wind. “She says thank you,” Quinn translates, “ for trusting her.” You wouldn’t go that far. But she seems to know more about where you’re going than you do, and you need every bit of help you can get if you are to survive. Then, just as the wind begins to die down, Aliki Uperetria turns and points over the bow of the ship, seemingly at nothing at all but dark, choppy waves and the dim evening horizon.</p><p class='basic right'>In your Campaign Log, record *the cell blew the whistle*. Skip to _Intro 4_.</p>",
          "intro3": "<p class='file'>_Intro 3_: After a moment of consideration, you hurl the whistle into the dark waves of the Atlantic. Quinn watches with horror as the ocean swallows it. “What did you do that for? She could have helped us!” You explain that the Coterie is not to be trusted, and that perhaps now—with the evidence of their cooperation disposed of—Taylor will allow Quinn to keep her position in the Foundation. “You did that…for me?” she says under her breath, stunned. “Well…I hope for our sake you know what you are doing. Where we are headed, we are going to need all the help we can get.” She glances over the bow of the ship, and you wonder if you are truly headed to another realm, or if you will simply greet the horizon.</p><ul><li>In your Campaign Log, record Agent Quinn has your back. Any one investigator may choose to add the Agent Ari Quinn story asset to their deck. It does not count toward their deck size. This card can be found in the Globetrotting encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png' /></section></li><li>In your Campaign Log, record *the cell threw away the whistle*.</li><li>Proceed to _Intro 4_.</li></ul>",
          "intro4": "<p class='file'>_Intro 4_: Clouds hang still over the Atlantic, the ocean suddenly calmer than you have ever seen it before. “Look at that,” Quinn says, pointing at the surface of the water. “No fish, no waves, not even a ripple from the ship.” A feeling of regret in your throat, you rush to the bow of the ship and look out into the distance. Something in the air shimmers—a slight distortion, nothing more— just a trick of the eye—and then, without a moment of warning, the ship is swallowed whole. The clouds burst. Light and color and luster overtakes you, cosmic radiance swathed in transcendental mist. The sight is marvelous and awful, mesmerizing and haunting all at once. You shut your eyes, but colors wash behind your eyelids over and over and over again. Then, finally, what feels like an eternity later, you feel a tap on your shoulder and open your eyes. The sight that greets you is unlike anything you have ever seen.</p><p>Aliki was right—if the things that disappeared were taken, this is surely where they ended up: an impossibly jumbled city of twisting architecture and technology both alien and familiar, an unearthly repository for everything that has ever been forgotten and forsaken. A range of sickly purples span the sky above, and snaking throughout the tangled towers and effigies are swirling, shimmering entities of vapor and colorless radiance.</p><p>Stunned into silence, you simply stare at the horrifying, awe-inspiring horizon before you, devoid of ocean, devoid of humanity, devoid of life. This is the barren truth to which your investigation has led: The Outside.</p><p class='basic right'>Proceed to _Setup_.</p>"
        },
        "setup": {
          "gatherSets": "Gather all cards from the following encounter sets: Without a Trace, Agents of the Outside, Beyond the Beyond, Outsiders, Secret War, and Spreading Corruption. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/without-a-trace.png' /><img src='{setImgPath}/agents-of-the-outside.png' /><img src='{setImgPath}/beyond-the-beyond.png' /><img src='{setImgPath}/outsiders.png' /><img src='{setImgPath}/secret-war.png' /><img src='{setImgPath}/spreading-corruption.png' /></section>",
          "placeLocations": "Put the Court of the Outsiders location into play.",
          "startAt": "Each investigator begins play at Court of the Outsiders.",
          "blewTheWhistle": "Check the Campaign Log. If the cell blew the whistle, choose an investigator to take control of the Aliki Zoni Uperetria story asset. Otherwise, remove her from the game.",
          "setAside": "Set the following cards aside, out of play: The Red-Gloved Man story asset, the Mimetic Nemesis enemy, the Protoplasmic Reassembler enemy, and the Apocalyptic Presage enemy.",
          "otherworldDeck": "Prepare the Otherworld deck. This is done by performing the following steps:",
          "bottomOfDeck": "Find the Outsiders’ Lair and both copies of the Cliffs of Insanity locations. Shuffle these locations together, with their unrevealed sides faceup, to form a deck. This deck is called the Otherworld deck.",
          "topOfDeck": "Find the remaining seven City of Remnants locations. Shuffle these locations together, with their unrevealed sides faceup. If there are exactly two investigators in the game, remove one of those locations from the game at random, without looking at it. If there is only one investigator, remove two of those locations from the game at random, without looking at them. Place the rest on top of the Otherworld deck.",
          "placeDeck": "Place the Otherworld deck near the scenario reference card.",
          "placeTopOfOtherworld": "Take the top three locations in the Otherworld deck and place them in the shadows, arranged in a straight line from left to right (without looking at their other sides).",
          "miniCards": "Gather each decoy mini-card and the three City of Remnants (L, M and R) mini-cards. Set them aside, out of play.",
          "placeMiniCards": "Take one decoy mini-card and the three City of Remnants (L, M and R) mini-cards, shuffle them facedown, and arrange them around the Court of the Outsiders as follows: One to its left, one to its right, one above, and one below. "
        },
        "resolutions": {
          "xp": {
            "bonus": "Gained insight into the strange happenings around the world."
          },
          "label": {
            "bermuda": "Depart from Bermuda",
            "yborCity": "Depart from Ybor City",
            "sanJuan": "Depart from San Juan"
          },
          "noResolution": {
            "title": "No Resolution",
            "body": "<p>_If no resolution was reached because each investigator was defeated_: “There, that is the last of them,” Agent Hudson says as he slams his stamp down onto the expense report. “I understand the need for secrecy, but I must once again request we hire assistants for this secretarial work, Commissioner.” He hands the bundle of documents to Taylor, who sits behind her stark black desk, wearing a grave expression.</p><p>“More eyes means more leaks. We keep this crew tight for a reason, Hudson. Do not lose sight of what is important.” She flips through the documents for a moment, furrowing her brows. “Where is the report on asset 32–J’s cell?”</p><p>“32–J?” the man pulls a small notebook from his back pocket and flips to a page near the middle. “No such designation exists.”</p><p>Taylor grimaces. “No, that’s not right. There was…we met them in London. You were there…” After a moment, she shakes her head in utter confusion. “Hm. Strange. I don’t remember who they were.”</p><p>“You have been working too hard,” the agent replies with a small grin. “Take some time off, Commissioner. We can handle things without you for a week or so.”</p><ul><li>In your Campaign Log, record *the cell was hollowed*.</li><li>The investigators lose the campaign.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: You awaken on the ship’s deck, dreamlike memories and otherworldly visions swimming in your mind. The only sign that what you saw was real and not a mere nightmare is a red‑gloved grip as a man pulls you to your feet and dusts off your shoulders. Nearby, Aliki watches wordlessly, her expression blank. Agent Quinn rises steadily to her feet as well. The world wobbles as your vision settles over a new dimension. “Stay with us,” the man says, his voice smoother and more natural than you remember.</p><p>You demand answers: what was he doing in London, what was that hellish place, and why was he there? “London?” He scoffs. “I haven’t been to London lately. I don’t even know who you are.” You reel. This is for sure the same man you saw in London—isn’t it? “As for that place, I have only a vague sense, but I have no idea what brought me there or how long I have been gone. That thing… ” He lifts the brim of his fedora and clutches his forehead so hard his hands shake. “It was…prying. Searching. Learning.”</p><p>Aliki finally speaks, with Quinn once again translating. “She says that the creatures are not just taking things, they are…what would be the right word…” she struggles to retain her composure as Aliki once again switches languages. “…adapting. Mimicking.”</p><p>Cold realization washes over you. This is what Aliki had been afraid of—why she had come to you for help. The man you saw in London was not the same as the man before you now. It was an imposter. It was one of them.”It seems I am in your debt,” the man says, extending a red-gloved hand. “But unfortunately, I have much to do. If these creatures have infiltrated the Coterie, none can be trusted, myself most especially. If you see me again, assume it is not me. In the meantime, I will get to the bottom of this and confront the others with my findings when the time is right.” You nod and shake his hand. There is more at stake here than you ever realized, and you can only get to the heart of it by working together.</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Each investigator earns 1 bonus experience, as they gain insight into the strange happenings around the world.</li><li>In your Campaign Log, record the following:<ul><li>*The cell knows the true nature of the Coterie*.</li><li>*Aliki is on your side*.</li></ul></li><li>Mark 3 _time_ in your Campaign Log.</li><li>You may _embark_ (from Bermuda, Ybor City or San Juan).</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: You awaken on the ship’s deck, dreamlike memories and otherworldly visions swimming in your mind. The only sign that what you saw was real and not a mere nightmare is a red‑gloved grip as a man pulls you to your feet and dusts off your shoulders. Agent Quinn rises steadily to her feet as well. The world wobbles as your vision settles over a new dimension. “Stay with us,” the man says, his voice smoother and more natural than you remember.</p><p>You demand answers: what was he doing in London, what was that hellish place, and why was he there? “London?” He scoffs. “I haven’t been to London lately. I don’t even know who you are.” You reel. This is for sure the same man you saw in London—isn’t it? “As for that place, I have only a vague sense, but I have no idea what brought me there or how long I have been gone. That thing… ” He lifts the brim of his fedora and clutches his forehead so hard his hands shake. “It was…prying. Searching. Learning.”</p><p>Is this even the same man you saw in London? You wonder what purpose the entity had in kidnapping him. What kind of information was it looking for? “In any event, I am in your debt,” the man says, extending a red-gloved hand. “But unfortunately, I have much to do. If you claim to have seen me in London, then there must be an imposter afoot. If you see me again, assume it is not me. In the meantime, I will get to the bottom of this and confront the others with my findings when the time is right.” You nod and shake his hand. “By the way…I am curious. How did you know where to find me?”</p><p>“One of your own,” Agent Quinn replies. “Uperetria. She had a hunch. Seems she was right.”</p><p>“I see,” he says with a scowl. “Well then…it appears I have two favors to repay, then. And rest assured… I always pay my debts.”</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>Each investigator earns 1 bonus experience, as they gain insight into the strange happenings around the world.</li><li>In your Campaign Log, record the following:<ul><li>*The cell knows the true nature of the Coterie*.</li><li>*You haven’t seen the last of Aliki Zoni Uperetria*.</li></ul></li><li>Mark 2 _time_ in your Campaign Log.</li><li>You may _embark_ (from Bermuda, Ybor City, or San Juan).</li></ul>"
          },
          "resolution3": {
            "title": "Resolution 3",
            "body": "<p>_Resolution 3_: You awaken on the ship’s deck, dreamlike memories and otherworldly visions swimming in your mind. The only sign that what you saw was real and not a mere nightmare is the gentle grip of Aliki as she pulls you to your feet, her expression blank. The world wobbles to and fro as your vision settles over a new dimension. Agent Quinn rises steadily to her feet as well, pounding her fist against the door to the cabin. “Dammit. We were so close!” she exclaims.</p><p>You struggle in vain to comprehend what you experienced in that other world. Answers may have eluded you, but it’s a relief to stand once more in a place that feels familiar to you. “That place…it is just as you thought,” Quinn says to Aliki, her eyes wide with both awe and horror. “Everything that is missing. Everything that is forgotten. It’s all there. Is that what they are doing? Stealing our world?”</p><p>Aliki finally speaks, with Quinn once again translating. “She says that the creatures are not just stealing things, they are…what would be the right word…” she struggles to retain her composure as Aliki once again switches languages. “…adapting. Mimicking.”</p><p>You ponder what all of this could mean in silence as night falls over the Atlantic. This is what Aliki had been afraid of—why she had come to you for help. But you are still uncertain what the entities from that reality truly want with yours, and what it might mean for the Red Coterie. “She thanks us for helping her, even if we were unable to learn the truth,” Quinn translates as Aliki speaks up once more. “And she says she will repay the favor when the time comes.”</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *Aliki is on your side*.</li><li>Mark 2 _time_ in your Campaign Log.</li><li>You may _embark_ (from Bermuda, Ybor City, or San Juan).</li></ul>"
          },
          "resolution4": {
            "title": "Resolution 4",
            "body": "<p>_Resolution 4_: You awaken on the ship’s deck, dreamlike memories and otherworldly visions swimming in your mind. The only sign that what you saw was real and not a mere nightmare is the pained groans of Agent Quinn as she rises steadily to her feet and pulls you up. The world wobbles as your vision settles over a new dimension.</p><p>“What the hell,” Quinn utters under her breath. “What the hell.” You struggle in vain to comprehend what you experienced in that other world. Answers may have eluded you, but it’s a relief to stand once more in a place that feels familiar to you. “That place…it is just as Aliki thought,” Quinn says aloud, her eyes wide with both awe and horror. “Everything that is missing. Everything that is forgotten. It’s all there. Is that what they are doing? Stealing our world?”</p><p>You ponder what all of this could mean in silence as night falls over the Atlantic. This is what Aliki had been afraid of—why she had come to you for help. But you are still uncertain what the entities from that reality truly want with yours, and what it might mean for the Red Coterie. “What do we do now? I don’t even know how I would report this to the Commissioner. Even for us, it’s almost too far-fetched to believe. And we have nothing to show for it…”</p><p>You shake your head and ponder the horizon. How much of the emptiness around you is but the remnants of these creatures’ contact with Earth? How much will be left if their secret war is not stopped? At least now, you know the true scale of this threat…</p><ul><li>Each investigator earns experience equal to the Victory X value of each card in the victory display.</li><li>In your Campaign Log, record *you haven’t seen the last of Aliki Zoni Uperetria*.</li><li>Mark 1 _time_ in your Campaign Log.</li><li>You may _embark_ (from Bermuda, Ybor City, or San Juan).</li></ul>"
          }
        }
      },
      "sections": {
        "specialRules": [
          {
            "title": "域外之地的地点相邻关系",
            "body": "在本剧本中，地点与隐匿迷你卡牌（见下文“阴影中的地点”）按行列布局排列。每个地点都与和它相邻的每个地点相连。\n\n• 相邻地点共用一条边（左、右、上或下）。仅共用一个角的地点不相邻。\n• 在本剧本中，隐匿迷你卡牌也会如上所述放置在紧邻一个或更多地点的位置，而不是像通常那样放置在地点上（见下文“阴影中的地点”）。"
          },
          {
            "title": "阴影中的地点",
            "body": "在本剧本中，调查员必须穿越域外来客那看似迷宫、实则虚幻的本界。为了表现探索这个异界维度的难度，始终有三张残骸之城地点被放置在阴影中（从异界牌库顶拿取），而隐匿迷你卡牌则排列在紧邻地点的位置，而非放置在地点上。揭露这些隐匿迷你卡牌，是找到穿越这个异界之地的路线的关键。\n\n• 就卡牌能力和游戏规则而言，紧邻某地点的隐匿迷你卡牌视为位于该地点。尝试揭露一张相邻的隐匿迷你卡牌时，使用你当前所在地点的隐蔽值。\n• 当一张残骸之城迷你卡牌被揭露时，将其放在一边，并找出阴影中位置与该迷你卡牌相符的残骸之城地点（L代表左、M代表中、R代表右）。将该地点放入其迷你卡牌原先所在的位置（未揭示面朝上）。\n  • 如果该位置上还有其他隐匿迷你卡牌，则移动它们，尽可能均匀地排列在新放入的残骸之城地点旁的空位上。\n• 当一张残骸之城地点离开阴影后，将异界牌库顶的卡牌放置在阴影中刚才被揭露的残骸之城所在的位置（不要查看其另一面）。然后结算其隐匿关键词，将其每张隐匿迷你卡牌尽可能均匀地排列在刚被揭露的残骸之城地点旁的空位上。\n  • 若有可能，阴影中必须始终存在三张残骸之城地点。\n• 同一个位置上可以有多于一张隐匿迷你卡牌，但任何隐匿迷你卡牌都不能占据已经有地点存在的位置。"
          }
        ],
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为场上地点数量的一半，向下取整。",
            "cultist": "-4。如果你检定失败，最近的_域外_敌人重整并向你移动一次，如果位于你所在地点，则攻击你。",
            "tablet": "-X。X为放在一边的空洞中归你所有的数量(最多为5)。",
            "elderThing": "-3。如果你检定失败，选择你手中一张非弱点卡牌，将其放在一边，作为一个空洞。"
          },
          "hardExpert": {
            "skull": "-X。X为场上地点数量。",
            "cultist": "-6。如果你检定失败，最近的_域外_敌人重整并向你移动一次，如果位于你所在地点，则攻击你。",
            "tablet": "-X。X为放在一边的空洞中归你所有的数量+1。",
            "elderThing": "-3。选择你手中一张非弱点卡牌，将其放在一边，作为一个空洞。"
          }
        },
        "label": {
          "otherworldlyHorror": {
            "takeDamageAndHorror": "每位调查员受到1点伤害和1点恐惧",
            "hollows": "每位调查员选择自己手中或游戏区域内控制的一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。",
            "shuffleAllConcealed": "混洗场上所有隐匿迷你卡牌，然后将其正面朝下随机放到先前位置。"
          },
          "otherworldlyLambs": {
            "takeDamageAndHorror": "每位调查员受到1点伤害和1点恐惧",
            "hollows": "每位调查员选择自己手中或游戏区域内控制的一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。",
            "shuffleAllConcealed": "混洗场上所有隐匿迷你卡牌，然后将其正面朝下随机放到先前位置。"
          },
          "mimeticNemesis": {
            "hollow": "选择你手中一张非弱点卡牌，将其放在一边，作为一个空洞",
            "attack": "本敌人攻击你"
          }
        },
        "tooltips": {
          "courtOfTheOutsiders": {
            "resign": "---- 虚无；---- 被遗忘，----- 记忆，---- 承诺，------ 跌落 --- 从来 ---- 永远 ------ 时间；-------- 全部 -- 都，----"
          }
        },
        "intro": {
          "label": {
            "blowTheWhistle": "吹响哨子，召唤艾里奇",
            "discardTheWhistle": "丢弃哨子，独自前行"
          },
          "title": "档案#56–Y: 不留痕迹",
          "intro1": "<p class='file'>尽管基金会的资源任你取用，但要想搞一艘船穿越魔鬼三角还是得连哄带骗，尤其是你并不载货，也不让其他乘客上船，还说是为了他们的安全着想。毕竟，要是你的理论无误，这艘船的目的地在地图上是找不到的，而且可能有去无回。奎因特工说服她的同事亲自掌舵，以免让平民身临险境。你们往三角中心进发，心都提到了嗓子眼。</p><p>“专员现在应该已经得到消息了。”奎因和你一起站在船舱旁。“我敢打赌这份工作我是干到头了。”她眺望着远方的地平线，太阳刚刚落入波涛之下。尽管这么说着，她的表情还是坚定无比，毫不后悔。“我只是希望咱们能找到答案。”你不无惊惧地承认，自己恨不得找不到答案才好。一想到自己会和其他人一样被抓走——你就脊背生寒。“唔，但现在也回不了头了。要动手吗？”她说着指向你脖子上系着的白鸦哨。你取了下来，握在手心，思虑再三。</p><p class='basic'>调查员队长必须决定(选择一项)：</p><ul><li>吹响哨子，召唤艾里奇。</li><li>扔掉哨子，独自前行。</li></ul>",
          "intro2": "<p class='file'>你不情不愿地将哨子举到唇边吹响，异界的颤音穿越海洋、穿越彼端。风骤起，你脊梁一个寒颤。不多时，红色腰带的女孩就出现了，站在你们的甲板上，仿佛一直在此。她说着科普特语，声音在呼啸的风中模糊。“她说谢谢你。”奎因翻译道，“谢谢你信任她。”倒也不必如此。但她似乎对去处比你了解的更多，而你需要每一点帮助才能活下来。风骤息，恰如风起时一样突然。艾里奇·奥佩勒曲亚转向船头，凝视着前方。那里只有黑暗的波涛和暗夜中昏暗的地平线。</p><p class='basic right'>在剧本日志中，记录下*特别小组吹响哨子*。</p>",
          "intro3": "<p class='file'>你想了想，将哨子扔进大西洋黑黢黢的波涛之中。奎因惊恐地看着它被海洋吞没：“你都干了什么？她兴许能帮上我们的！”你跟她解释说同志会不值得信任，而且现在——既然跟他们合作的证据已经灭失——泰勒大概还会让奎因留在基金会自己的位子上。“你做这些……是为了我？”奎因惊讶地喘不上气，“好吧……看在咱俩的份上，但愿你知道自己做了什么。我们去的地方需要一切可能的帮助。”她望向船头，你好奇自己是否真的会前往另一个国度，还是仅仅看到地平线。</p><ul><li>在剧本日志中，记录下*奎因特工护你左右*。任意一位调查员可以将阿丽·奎因特工剧情支援加入其牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png' /></section></li><li>在剧本日志中，记录下*特别小组扔掉哨子*。</li></ul>",
          "intro4": "<p class='file'>大西洋上云层笼聚，海面却突然比之前平静了不少。“看那儿。”奎因说着指向海面，“没有鱼、没有浪花，连船经过的涟漪都没有。”一阵懊悔涌上心头，你冲到船头，看向远方。空气中闪耀着什么——不过是一点扭曲——不过是障眼法——突然，没有一点预警，船被整个吞了下去。云层炸开。光与色占据了你，一条条宇宙辐射穿过玄奥的迷雾。这景色震撼人心，令人迷醉，萦绕不去。纵使你闭上眼，色彩依然在你的眼睑下激荡。终于，仿佛是过了一个永恒那么久，你肩膀上有什么拍了一下。你睁开眼睛。你眼前的景象前所未见。</p><p>艾里奇是对的——倘若消失的事物真是被夺走，那他们都来了这里。眼前的城市混乱超乎想象，建筑全部扭曲，里面的技术看着既像是外星而来，又有几分熟悉。这个本不该出现的地方，储藏了一切失落遗忘之物。天上弥漫的病态紫色在纠缠的塔楼和旋转的塑像间穿行，照亮了蒸汽和无色的辐射。</p><p>你惊得说不出话来，只是呆呆望着眼前恐怖又壮观的地平线。这里没有海洋，没有人类，没有生命。你的调查终究指向了虚无的真相：域外之地。</p><p class='basic right'>进入_冒险设置_。</p>"
        },
        "setup": {
          "gatherSets": "收齐以下遭遇组的所有卡牌：*不留痕迹*、*域外使徒*、*彼界彼端*、*域外来客*、*秘密战争*、*腐败扩散*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/without-a-trace.png' /><img src='{setImgPath}/agents-of-the-outside.png' /><img src='{setImgPath}/beyond-the-beyond.png' /><img src='{setImgPath}/outsiders.png' /><img src='{setImgPath}/secret-war.png' /><img src='{setImgPath}/spreading-corruption.png' /></section>",
          "placeLocations": "将域外来客之廷地点放置入场。",
          "startAt": "每位调查员从域外来客之廷开始游戏。",
          "blewTheWhistle": "检查剧本日志。如果*特别小组吹响哨子*，选择一位调查员控制艾里奇·佐尼·奥佩勒曲亚剧情支援。否则，将她从游戏中移除。",
          "setAside": "将下列卡牌放在一边，位于场外：戴红手套的男子剧情支援、拟态克星敌人、原生质重组者敌人、天启噩兆敌人。",
          "otherworldDeck": "执行下列步骤准备异界牌库：",
          "bottomOfDeck": "找到域外来客之巢和全部两张疯狂峭壁地点。将这些地点混洗，未揭示面朝上，形成一个牌库。这个牌库就是异界牌库。",
          "topOfDeck": "找出剩下七张残骸之城地点。将这些地点混洗，未揭示面朝上。如果游戏中正好有两位调查员，在这些地点中随机将一张从游戏中移除，不要查看。如果游戏中只有一位调查员，在这些地点中随机将两张从游戏中移除，不要查看。将剩余的卡牌放在异界牌库顶上。",
          "placeDeck": "将异界牌库放在冒险参考卡牌旁。",
          "placeTopOfOtherworld": "拿取异界牌库顶的三张卡牌，放入阴影中，从左到右排成一行(不要查看另一面)。",
          "miniCards": "收齐每张诱饵迷你卡牌和三张残骸之城(左、中、右)迷你卡牌。将这些卡牌放在一边，位于场外。",
          "placeMiniCards": "拿取一张诱饵迷你卡牌和三张残骸之城(左、中、右)迷你卡牌，正面朝下混洗，环绕域外来客之廷上、下、左、右摆放。"
        },
        "resolutions": {
          "xp": {
            "bonus": "对全球奇异的失踪事件有了洞见"
          },
          "label": {
            "bermuda": "从百慕大启程",
            "yborCity": "从宜博市启程",
            "sanJuan": "从圣胡安启程"
          },
          "noResolution": {
            "title": "未达成任何结局",
            "body": "<p>_如果未达成任何结局(每位调查员被击败):_“这就是最后的了。”哈德逊特工说着在费用报告上盖了戳，“我理解需要保密，但我还是要再次请求雇佣更多的助手完成秘书工作，专员。”他将文件交给坐在深黑书桌后面，表情一脸凝重的泰勒。</p><p>“人越多就越容易泄密。我们节制人手不是平白无故的，哈德逊。别忘了重要的事情。”她翻了一会儿文件，皱起了眉头。“关于支援32-J的特别小组的报告呢？”</p><p>“32-J？”男子从后袋里掏出一本小小的笔记，翻到中间一页。“没有这样的代号。”</p><p>泰勒皱着眉：“不，有的，就是……我们在伦敦遇到的。你在那儿呢……”过了一会儿，她摇摇头，疑惑极了。“哈，怪了，我不记得他们是谁了。”</p><p>“您工作太辛苦了。”特工微微笑着回道，“休息休息，专员。您休假一周我们也能把事情办好的。”</p><ul><li>在剧本日志中，记录下*特别小组成为空洞*。</li><li>调查员剧本失败。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1_: 你在甲板上醒来，脑海里飘忽着如梦似幻的记忆和异界的幻象。一只红手套将你拉了起来，拍拍你肩上的灰尘，你这才明白自己所见俱是真实，而非完全的梦魇。艾里奇站在附近无言地望着，表情一片茫然。奎因特工也才刚刚站稳。你的视线正适应全新的维度，整个世界都在摇晃。“跟我们来。”这男人的声音比你记忆中要平滑自然许多。</p><p>你追问答案：他在伦敦干什么，这地狱般的地方到底在哪里，他又为什么在那儿？“伦敦？”他嗤笑道，“我近来就没去过伦敦。我也不认识你。”你大惑不解。这肯定就是你在伦敦见过的男人——不是吗？“至于那地方，我只有个大概的印象，但我确实不知道是什么把我带到了那儿，又过了多久。那个东西……”他抬起帽沿，扶着前额，手抖个不停。“它在……刺探、研究、学习。”</p><p>艾里奇终于说话了，奎因也开始翻译。“她说这些怪物不只是夺走了东西，还在……该用什么词呢……”她拼命保持冷静的时候，艾里奇又换了语言。“调整、模拟。”</p><p>你突然意识过来，一阵冰冷。这就是艾里奇害怕的事情——这就是为什么她要找你帮忙。你眼前的男人并非在伦敦见到的那位。那是赝品，是它们之中的一员。“看来我欠你很多。”男子说着伸出一只戴着红手套的手。“不巧的是，我还有很多事要忙。倘若这些怪物真的渗透了同志会，那就没人可以相信了，尤其是我。要是我们再次见面，麻烦先假定那不是我。值此期间，我会一查到底，等候时机，带着我的发现与其他人碰头。”你点点头，握了握他的手。这比你想的更加凶险。你们得齐心协力，才能查个水落石出。</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>每位调查员取得1点奖励经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中，记录如下：<ul><li>*特别小组了解了同志会的真相*。</li><li>*艾里奇站在你这一边*。</li></ul></li><li>在剧本日志中记3_时间_。</li><li>你可以_启程_(从百慕大、宜博市或圣胡安)。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2_: 你在甲板上醒来，脑海里飘忽着如梦似幻的记忆和异界的幻象。一只红手套将你拉了起来，拍拍你肩上的灰尘，你这才明白自己所见俱是真实，而非完全的夜魇。奎因特工也才刚刚站稳。你的视线正适应全新的维度，整个世界都在摇晃。“跟我们来。”这男人的声音比你记忆中要平滑自然许多。</p><p>你追问答案：他在伦敦干什么，这地狱般的地方到底在哪里，他又为什么在那儿？“伦敦？”他嗤笑道，“我近来就没去过伦敦。我也不认识你。”你大惑不解。这肯定就是你在伦敦见过的男人——不是吗？“至于那地方，我只有个大概的印象，但我确实不知道是什么把我带到了那儿，又过了多久。那个东西……”他抬起帽沿，扶着前额，手抖个不停。“它在……刺探、研究、学习。</p><p>这真的是你在伦敦见到的男人吗？你不禁想问那个实体到底为什么要绑架他，它又在寻找什么样的讯息呢？“无论如何，我欠你很多。”男子说着伸出一只戴着红手套的手。“不巧的是，我还有很多事要忙。你说在伦敦见过我，那肯定是个赝品。要是我们再次见面，麻烦先假定那不是我。值此期间，我会一查到底，等候时机，带着我的发现与其他人碰头。”你点点头，握了握他的手。“话说……我有点好奇。你是怎么知道要到哪儿找我的？”</p><p>“你们中的一员。”奎因特工答道，“奥佩勒曲亚。看来她的直觉是对的。”</p><p>“明白了。”他愁眉不展，“那么……看来我欠下两笔债了。你可以放心……我有债必偿。”</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>每位调查员取得1点奖励经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中，记录如下：<ul><li>*特别小组了解了同志会的真相*。</li><li>*你和艾里奇之间恩怨未了*。</li></ul></li><li>在剧本日志中记2时间。</li><li>你可以_启程_(从百慕大、宜博市或圣胡安)。</li></ul>"
          },
          "resolution3": {
            "title": "结局3",
            "body": "<p>_结局3_: 你在甲板上醒来，脑海里飘忽着如梦似幻的记忆和异界的幻象。艾里奇将你拉了起来，表情茫然，你这才明白自己所见俱是真实，而非完全的夜魇。你的视线正适应全新的维度，整个世界都在来回摇晃。奎因特工也才刚刚站稳，一拳打在船舱门上。“妈的，都那么接近了！”她喊道。</p><p>你徒劳地想要理解自己在另一个世界都遭遇了什么。答案可能已经无迹可寻，但能再次站在熟悉的土地上，还是让人松了口气。“那地方……就和你想的一样。”奎因对艾里奇说道，瞪大了眼睛，既是敬畏，又是害怕。“所有失去的，所有遗忘的，都在那儿。它们就是要干这个？偷走我们的世界？”</p><p>艾里奇终于说话了，奎因也开始翻译。“她说这些怪物不只是偷走了东西，还在……该用什么词呢……”她拼命保持冷静的时候，艾里奇又换了语言。“调整、模拟。”</p><p>夜幕笼罩了大西洋，万籁俱寂之中，你思考这意味着什么。这就是艾里奇害怕的事情——这就是为什么她要找你帮忙。但你还是不能确定那个世界的实体到底想从你身上夺走什么，它对红色同志会又意味着什么。艾里奇又开口了，奎因翻译道：“她谢谢你的帮助，即便我们没能得知真相。她还说自己会在恰当的时机报恩。”</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*艾里奇站在你这一边*。</li><li>在剧本日志中记2时间。</li><li>你可以_启程_(从百慕大、宜博市或圣胡安)。</li></ul>"
          },
          "resolution4": {
            "title": "结局4",
            "body": "<p>_结局4_: 你在甲板上醒来，脑海里飘忽着如梦似幻的记忆和异界的幻象。奎因特工站起来的时候也拉了你一把，你这才明白自己所见俱是真实，而非完全的夜魇。你的视线正适应全新的维度，整个世界都在摇晃。</p><p>“什么鬼地方。”奎因呼吸急促，“什么_鬼地方_。”你徒劳地想要理解自己在另一个世界都遭遇了什么。答案可能已经无迹可寻，但能再次站在熟悉的土地上，还是让人松了口气。“那地方……就和艾里奇想的一样。”奎因瞪大了眼睛，既是敬畏，又是害怕。“所有失去的，所有遗忘的，都在那儿。它们就是要干这个？偷走我们的世界？”</p><p>夜幕笼罩了大西洋，万籁俱寂之中，你思考这意味着什么。这就是艾里奇害怕的事情——这就是为什么她要找你帮忙。但你还是不能确定那个世界的实体到底想从你身上夺走什么，它对红色同志会又意味着什么。“我们现在该怎么办？我都不知道该怎么跟专员汇报。即便是对我们而言，这也太难以置信了。更何况我们还没有证据……”</p><p>你摇摇头，远眺地平线。你身边的空寂，有多少是那些怪物和地球联系的残存？要是不阻止他们的秘密战争，又有多少还能剩下？但至少你现在知道了这场威胁有多大的规模……</p><ul><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。</li><li>在剧本日志中，记录下*你和艾里奇之间恩怨未了*。</li><li>在剧本日志中记1_时间_。</li><li>你可以_启程_(从百慕大、宜博市或圣胡安)。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 54,
        "missing": 0,
        "untranslated": 0,
        "present": 54,
        "specialRules": 4
      }
    },
    "congressOfTheKeys": {
      "id": "congressOfTheKeys",
      "name": "钥匙议会",
      "nameEn": "Congress of the Keys",
      "referenceCode": "09694",
      "file": "scenarios/congressOfTheKeys.json",
      "sectionsEn": {
        "heading": "File #59–Z (Finale)",
        "tokens": {
          "easyStandard": {
            "skull": "-X. X is the current act number.",
            "cultist": "-5. You may flip a _Stable_ key you control to its _Unstable_ side to treat this token's modifier as -2, instead.",
            "tablet": "-2. If this is an attack against a ready _Outsider_ enemy, you automatically fail, instead.",
            "elderThing": "-3. Cancel the effects and icons of each card committed to this test and set each of them aside, out of play, as hollows."
          },
          "hardExpert": {
            "skull": "-X. X is 1 more than the current act number.",
            "cultist": "-7. You may flip a _Stable_ key you control to its _Unstable_ side to treat this token's modifier as -4, instead.",
            "tablet": "-2. If there is a ready _Outsider_ enemy at your location, you automatically fail, instead.",
            "elderThing": "-4. Cancel the effects and icons of each card committed to this test and set each of them aside, out of play, as hollows."
          }
        },
        "label": {
          "cultist": {
            "easyStandard": "Flip a _Stable_ key you control to its _Unstable_ side to treat this token's modifier as -2, instead",
            "hardExpert": "Flip a _Stable_ key you control to its _Unstable_ side to treat this token's modifier as -4, instead"
          },
          "theWorldUnbidden": {
            "unstable": "Shift an _Unstable_ key they control without flipping it to its Stable side to cancel all of the damage and horror just dealt to them by the above effect.",
            "stable": "Flip any number of _Stable_ keys they control to their _Unstable_ side to cancel that much damage/horror just dealt to them by the above effect.",
            "damage": "Cancel 1 damage",
            "horror": "Cancel 1 horror"
          }
        },
        "intro": {
          "label": {
            "deemedALiability": "Proceed to _The Trial 2_.",
            "overthrow": "Proceed to _The Trial 3_.",
            "join": "Proceed to _The Trial 4_.",
            "deemedAnAsset": "Proceed to _The Trial 5_."
          },
          "title": "File #59–Z (Finale): Congress of the Keys",
          "body": "<p class='basic file'>Depending on how you got here…</p>",
          "option1": "If you have arrived at this finale due to a status report (because time ran out), proceed to _Intro 1_.",
          "option2": "If you traveled to Tunguska of your own accord, skip to Intro 2.",
          "intro1": "<p class='file'>_Intro 1_: You awaken in darkness. A sack is removed from your head and cast aside, and your cheek is squeezed and struck once or twice for good measure. “Wake up,” a sinister voice commands. You blink unconsciousness away and realize, with some panic, that you and your partners are bound to chairs. A gag prevents you from making any noise louder than a muffled cry.</p><p>As your eyes adjust to the dim light, you realize you must be underground. The large, windowless chamber is made of clean, worked stone, lit faintly by mercury vapor lamps. Scarlet tapestries line the walls, along with several glass cases and shelves containing old relics and historical artifacts. Dominating the room is an enormous central table, an elaborate pattern of lines and rings carved meticulously along its surface. Standing around this central table are a host of figures, some familiar to you, others unrecognizable. All of them bear red. Your heart surges in your throat. “You have been brought here to account for your crimes against the Coterie,” the voice states, “or to be commended, if that is the will of the Congress. We will now entertain any who wish to speak on your behalf, or against you.”</p><p class='basic right'>Proceed to _The Trial 1_.</p>",
          "intro2": "<p class='file'>Intro 2: You would never have found the secret hideout of the Red Coterie without the intel Commissioner Taylor sent you. The compound lies deep underground in the heart of Siberia, not far from the mysterious crater that marks the site of the notorious Tunguska event—a blast, or perhaps impact, the true nature of which has been shrouded in mystery for over a decade. Maybe there is a connection between this strange event and the Coterie’s presence—no, knowing the kind of dangerous artifacts the Coterie possesses, there is no doubt in your mind. The question is: which came first?</p><p>The compound’s entrance is masked by heavy snow and remote wilderness, but eventually, you find it—an unmarked steel door embedded in the side of a snowy hilltop, almost impossible to see from afar. You are surprised to find the door unlocked…but the moment you enter, you are set upon by Coterie guards with suspicious eyes and familiar red clothing. “We’ve been expecting you,” one of them says with a wicked grin. “Come. The Congress is about to begin.”</p><p>You have little choice but to follow. The guards lead you deeper and deeper into the complex, down steep, narrow stairways of worked stone and through dark, drab corridors, until finally you reach a large, windowless chamber lit faintly by mercury vapor lamps. Scarlet tapestries line the walls, along with several glass cases and shelves containing old relics and historical artifacts. Dominating the room is an enormous central table, an elaborate pattern of lines and rings carved meticulously along its surface. Standing around this central table are a host of figures, some familiar to you, others unrecognizable. All of them bear red. The door leading into the chamber slams shut behind you, and your heart surges in your throat. “Your timing is impeccable,” a voice among the gathered Coterie states. “We were just about to begin the vote.”</p><p>You inquire as to the nature of this vote, your mouth suddenly dry. You cannot shake the feeling that you have come here merely to look your own doom in the eyes. “A meeting has been called. To account for your crimes against the Coterie, or to be commended, if that is the will of the Congress. We will now entertain any who wish to speak on your behalf, or against you.” From behind, you are suddenly restrained and a gag is placed over your mouth. “Just a formality, I promise you,” the guard drawls with a grin.</p><p class='basic right'>Proceed to _The Trial 1_.</p>",
          "theTrial1": "<p class='file'>_The Trial 1_: The Coterie casts votes to determine your fate.</p><p class='basic'>Read the relevant passage from each of the following sections, in order, and tally all of the votes received. Each “yea” vote represents a Coterie member who wishes to see you disposed of. Each “nay” vote represents a Coterie member who wishes to keep you safe. An abstaining vote, or a vote of silence, is neither a yea or a nay.</p>",
          "nay": {
            "title": "<h3 class='vote-header'>Nay</h3>",
            "count": "<p class='basic scarlet-keys-vote nay' data-count='{count}'>{count}</p>"
          },
          "yea": {
            "title": "<h3 class='vote-header'>Yea</h3>",
            "count": "<p class='basic scarlet-keys-vote yea' data-count='{count}'>{count}</p>"
          },
          "theCellAidedTheKnight": "<p>_If the cell aided the knight_: The elderly “knight” from Alexandria steps forward, commanding the attention of the entire chamber. “My esteemed associates. The individuals gathered here before us, despite their…unfortunate affiliation…are indeed worthy of our respect and recognition. Were it not for their assistance, our sanctum in Alexandria might have fallen. To one of our own, I might add. I believe this demonstrates their value.” Some of the others nod in agreement. The assembled members look around for a rebuttal, but none arrives. Perhaps the Beast is nursing its wounds.</p><p class='basic right'>The Claret Knight votes “nay.”<br>The Beast in a Cowl of Crimson abstains by default.</p>",
          "theCellFailedToFendOffTheBeast": "<p>_If the cell failed to fend off the Beast_: A rumbling voice emanates from the shrouded beast in its crimson hood. “Blood,” it simply states. You wince at the feral sound, a shiver worming up your spine. “There must be blood.” You scan for the elderly knight from Alexandria, hoping he might steer the rest to reason…but he is not present.</p><p class='basic right'>The Claret Knight abstains by default.<br>The Beast in a Cowl of Crimson votes “yea.”</p>",
          "youHaventSeenTheLastOfTheClaretKnight": "<p>_If you haven’t seen the last of the Claret Knight_: “The course of action is clear,” the elderly, well-dressed “knight” from Alexandria states. “They are untrustworthy and aim to wrench control away from us. They must be disposed of.” On the opposite end of the table, the hooded, crimson-shrouded figure of the knight’s enemy growls. “For once, we agree on something,” it rumbles, its voice feral and inelegant. The knight’s eyes narrow. “Do not let it go to your head,” he warns.</p><p class='basic right'>The Claret Knight votes “yea.”<br>The Beast in a Cowl of Crimson votes “yea.”</p>",
          "theDogsAreAtWar": "<p>_If the dogs are at war_: There is a moment of silence as you and the gathered Coterie members scan their numbers for the two operating in Alexandria. “It seems two among us have decided not to attend,” one member states. You wonder if either one of them is even still alive. Perhaps their conflict consumed the both of them. You shudder to think of the state of Alexandria.</p><p class='basic right'>The Claret Knight abstains by default.<br>The Beast in a Cowl of Crimson abstains by default.</p>",
          "dogsOfWarSkipped": "<p>_If none of the above are true_: “I do not take pleasure in violence,” says an elderly, well-dressed man in red. “I believe these before us might be valuable assets.” On the opposite end of the table, a crimson-hooded figure rumbles, “That is why you are weak.” Its countenance, shrouded in shadow, turns to acknowledge you. In the dim light, all you see is a set of terrible, dripping fangs. “Blood must flow.”</p><p class='basic right'>The Claret Knight votes “nay.”<br>The Beast in a Cowl of Crimson votes “yea.”</p><p class='basic right'>Flip a coin and update the Keys section of your Campaign Log as follows: If it is heads, the bearer of The Light of Pharos is “The Claret Knight;” if it is tails, it is “The Beast in a Cowl of Crimson.”</p>",
          "eceTrustsTheCell": "<p>_If Ece trusts the cell_: Ece steps forward and clears her throat. “I reached out to the Foundation because the Twisted Antiprism hidden in Istanbul was in danger of being found by a third party. These are the agents who responded. Rather than take the artifact for themselves, they chose to hand it over to my custody. I believe them to be trustworthy and, unlike some of our members, morally upstanding individuals.”</p><p class='basic right'>Ece Şahin votes “nay.”</p>",
          "eceDoesNotTrustTheCell": "<p>_If Ece does not trust the cell_: Ece’s eyes are downcast as the rest of the table turn to face her. “I…” she begins, stammering. “I abhor violence, and therefore refuse to participate in the kind of despicable acts some of our members seem to enjoy,” she says pointedly, ruffling a few of the other members’ feathers. But then her eyes snap up to meet yours, sadness and resolve hardening her face. “But the individuals before us cannot be trusted. And so I find myself unable to exonerate their actions.” Then quieter, she breathes, “I’m sorry.”</p><p class='basic right'>Ece Şahin abstains.</p>",
          "dealingsInTheDarkSkipped": "<p>_If neither of the above are true_: “If we purport to be a morally righteous organization,” the woman in the vermillion veil articulates politely, “we cannot destroy each and every thing that stands in our way. Progress requires understanding and cooperation. And I abhor violence. We should be working with these individuals, not against them.”</p><p class='basic right'>Ece Şahin votes “nay.”</p>",
          "youHaventSeenTheLastOfAmaranth": "<p>_If you haven’t seen the last of Amaranth_: Amaranth grins wickedly as her eyes fall on you. “Oh, I have been waiting for this moment,” she drawls, her eyes flashing. “Meddlesome fools. Did you think your interference in our plans would go unpunished?”</p><p class='basic right'>Amaranth enthusiastically votes “yea.”</p>",
          "theLoversAreReunited": "<p>_If the lovers are reunited_: Standing together, Amaranth and the preserved living corpse of Razin Farhi leer sparingly at you between sickeningly adoring glances at one another. “What do you think, Razin dearest? Do we spare the fools who stood in our way?” Amaranth asks. “Or do we make a lesson of them?” Razin croaks in response: “My love. None could stand in our way. And with them gone, none ever will.”</p><p class='basic right'>Amaranth votes “yea.”<br>Razin Farhi votes “yea.”</p>",
          "amaranthHasLeftTheCoterie": "<p>_If Amaranth has left the Coterie_: “Where is Amaranth?” one of the others says aloud, causing a murmur to rise among the Coterie. “She has never missed a meeting.” Under your gag, you allow yourself to smile. At least Eryn was finally able to get away from the Coterie’s grasp and assume her real identity at last.</p><p class='basic right'>Amaranth abstains by default.</p>",
          "deadHeatSkipped": "<p>_If none of the above are true_: Next to speak is a beautiful, pale- skinned woman in a black dress. The blooming, red flower adorning her hair is the only splash of color gracing her outfit. “We operate in secrecy for a reason, do we not?” Her beauty belies her vile tone and harsh tongue. “They know too much. Kill them and get it over with.”</p><p class='basic right'>Amaranth votes “yea.”<br>Amaranth is the bearer of The Last Blossom. Update the Campaign Log accordingly</p>",
          "youHaventSeenTheLastOfThorne": "<p>_If you haven’t seen the last of Thorne_: Thorne adjusts the cuffs of the dress shirt under their long coat. “The Foundation has earned our mistrust by interfering with our plans. We should eliminate this cell and move forward with the collection.” They meet your gaze, steady and unwavering. “I warned you not to get in our way, did I not?”</p><p class='basic right'>Thorne votes “yea.”<p>",
          "theCellMadeADealWithThorne": "<p>_If the cell made a deal with Thorne_: The one known as Thorne steps forward. “Our extensive operations require that we collaborate with many across the globe. Researchers. Local authorities. Criminals. These before us are no different. And they have proven themselves to be quite useful. They aided our efforts in Anchorage, and even saw the wisdom in keeping the Key there safe in our custody.”</p><p class='basic right'>Thorne votes “nay.”</p>",
          "thorneDisappeared": "<p>_If Thorne disappeared_: You are surprised to count Thorne among those gathered here. Last you saw of them, they had simply vanished north of Anchorage, and yet here they are, completely silent despite what the two of you went through.</p><p class='basic right'>Thorne remains eerily silent.</p>",
          "onThinIceSkipped": "<p>_If none of the above are true_: The one wearing a red cravat, with platinum-blonde hair to match their sheet-white skin, speaks next. “I have had no dealings with these before us,” they say, gesturing toward you. “It would be foolish of me to vote one way or another without knowing firsthand of their capabilities and truthworthiness. As such, I will sit this one out.”</p><p class='basic right'>Thorne abstains.<br>Thorne is the bearer of The Sable Glass. Update the Campaign Log accordingly</p>",
          "alikiIsOnYourSide": "<p>_If Aliki is on your side_: With ethereal grace, Aliki Zoni Uperetria steps out of the shadows, a golden-hued blade sheathed on her back. Her scarlet sash drifts along a breezeless wind. She whispers something soft and quiet in her usual lexicon of forgotten prose. One of the assembled Coterie translates: “Uperetria states that…” they skew their eyesbrows up in surprise. “…that those assembled before us are truly loyal servants to the cause, as we are.” Murmurs erupt around you.</p><p class='basic right'>Aliki votes “nay.”</p>",
          "youHaventSeenTheLastOfAlikiZoniUperetria": "<p>_If you haven’t seen the last of Aliki_: “Do not forget Uperetria’s vote,” a voice murmurs. “She is here?” another asks. “We have been attempting to contact her for weeks now.” To your surprise, the gathered members indeed turn to regard the ghostly-quiet girl who stands in the corner of the room, apart from the rest. An uncanny silence permeates the chamber. You would think she were a statue, were it not for her sash drifting lazily in the stillness.</p><p class='basic right'>Aliki remains eerily silent.</p>",
          "withoutATraceSkipped": "<p>_If none of the above are true_: From the shadows emerges a gossamer figure, dressed in white, a golden-hued blade sheathed on her back and a veil of raven hair over her eyes. Her scarlet sash drifts along a breezeless wind. Her words are heralded by a shrill, muted whistling, and she speaks in a language you have never before heard. One of the Coterie who seems to understand her tallies this as a vote against you.</p><p class='basic right'>Aliki votes “yea.”</p>",
          "desi": "<p class='basic'>_Before resolving any of the below options, *If Desi is in your debt*_: Find the copy of Desiderio Delgado Álvarez you stored in a safe place and look at its other side. Then, proceed.</p>",
          "desiIsGood": "<p>_If the other side of Desiderio Delgado Álvarez is his story asset version_: There is the sudden flare of a match as Desi lights a cigarette. “These ones are all right,” he says. “There’s bigger shit goin’ on here. Almost got snatched by you-know-what back in Havana. They helped me out—not that I needed it or anything. Point is, they had my back.”</p><p class='basic right'>Desiderio Delgado Álvarez votes “nay.”<p>",
          "desiIsBad": "<p>_If you haven’t seen the last of Desiderio Delgado Álvarez, or if the other side of Desiderio Delgado Álvarez is an encounter card back_: Your eyes snap over to Desi, hoping he will speak on your behalf. But he merely lights a cigarette and gazes into the wall behind you.</p><p class='basic right'>Desiderio Delgado Álvarez remains eerily silent.</p>",
          "dancingMadSkipped": "<p>_If none of the above are true_: “Should I know who the hell these people are?” a man in a suit with a red tie says, lighting a cigarette and taking a long puff. The smoke wafts into the darkness above the table. “This is a waste of time. Aren’t you all always goin’ on about eliminating unknown factors? Get rid of ‘em so we can focus on what really matters.”</p><p class='basic right'>Desiderio Delgado Álvarez votes “yea.”<br>Desiderio Delgado Álvarez is the bearer of The Mirroring Blade. Update the Campaign Log accordingly</p>",
          "theCellMeddledInAbarransAffairs": "<p>_If the cell meddled in Abarran’s affairs_: Suddenly, the large, imposing figure of Abarran Arrigorriagakoa slams his fist on the ceremonial table in the center of the chamber. “These interlopers! They tried to ruin me! Tried to take away my fortune, my chosen!” His face is flushed red and trembling with rage, his knuckles white. “I will punish them myself! I will rip them limb from limb! I will—” the man continues his rant for some time before his rage simmers to indignation.</p><p class='basic right'>Abarran Arrigorriagakoa votes “yea.”</p>",
          "fortuneAndFollySkipped": "<p>_If the above is not true_: A man you do not recognize speaks next. His large, imposing frame is dwarfed only by the luster of the enormous ruby ring adorning his left index finger. “As Fortune’s Chosen, we have once more been given a great and illustrious boon,” he states, his thundering voice commanding the attention of all. “Our enemies, bound before us? Why dispose of such a gift? What better way to learn how to continue our great work than to question them? Perhaps we may even use them as leverage…yes, leverage…” he trails off, a sinister grin on his face. You almost wish he had voted to kill you.</p><p class='basic right'>Abarran Arrigorriagakoa abstains.</p>",
          "noMatterWhat": "<p>_No matter what_: You cannot see the Red-Gloved Man’s face, but you imagine a great and terrible smile.</p><p class='basic right'>The Red-Gloved Man remains eerily silent.</p>",
          "theCellKnowsTheTrueNatureOfTheCoterie": "<p class='basic right'>*If the cell knows the true nature of the Coterie*, immediately skip to _The Trial 6_ without tallying any further votes.</p>",
          "eerilySilent": "<p class='basic right'>Otherwise, if 3 or more Coterie members are eerily silent, immediately skip to _The Trial 7_ without tallying any further votes.</p>",
          "continueTheTrial": "<p class='basic right'>If neither of the above are true, proceed as normal.</p>",
          "youHaventSeenTheLastOfLaChicaRoja": "<p>_If you haven’t seen the last of La Chica Roja_: You almost didn’t notice La Chica Roja standing between two of the other Coterie members, enshrined in darkness. She tips the rim of her hat over her eyes, but a smirk plays on her lips. “These ones thought they could catch me. Just like the coppers and the feds.” Another voice on the opposite of the table, belonging to a balding man with small red spectacles, rises to challenge hers. “They were interfering with Coterie business,” he growls. “Nah,” she replies, “they were interfering with a personal grudge. If you got a problem with me, red-eyes, take it up with me, not them.”</p><p class='basic right'>La Chica Roja abstains.<br>The Sanguine Watcher votes “yea.”</p>",
          "youHaventSeenTheLastOfTheSanguineWatcher": "<p>_If you haven’t seen the last of the Sanguine Watcher_: Suddenly, a wide-brimmed hat with a scarlet band slams onto the table, and La Chica Roja emerges from the shadows. “The Foundation’s not our biggest enemy. That title belongs to some of us. These agents might not wear red, but I guarantee they’re more righteous than half of us claim to be.” Standing on the other side of the table, the Sanguine Watcher takes off his ruby spectacles and cleans them with a blood-red cloth. Behind them, his eye sockets are gruesomely hollow. “Foolish girl,” he utters, his words dripping with venom. “A last play for attention?” She scowls at him, gripping the crown of her hat so hard, it crumples beneath her fingers. “Do any of you have any idea what kinds of things this sick bastardo has been up to? Do any of you even care?”</p><p class='basic right'>La Chica Roja votes “nay.”<br>The Sanguine Watcher votes “yea.”</p>",
          "theSanguineWatchersTormentContinues": "<p>_If the Sanguine Watcher’s torment continues_: From a dark corner of the room, La Chica Roja emerges, her familiar wide-brimmed hat covering her eyes as she speaks. “I was dealing with one of our own in Buenos Aires. One who was acting against our best interests,” she explains. “These agents here saw the truth of the situation and tried to aid me. They may not wear red, but I guarantee they’re more righteous than half of us claim to be.” Another voice from the assembled few asks whom of their number the woman speaks of. “Our ‘friend’ with no eyes,” she says with a scowl. “He’s still tormenting Buenos Aires, I imagine. But do any of you even care?”</p><p class='basic right'>La Chica Roja votes “nay.”<br>The Sanguine Watcher abstains by default</p>",
          "sanguineShadowsSkipped": "<p>_If none of the above are true_: A balding man with small ruby spectacles is next to speak, pointing a wiry, jagged finger at another of the assembled Coterie. “Why are these ones on trial here when it is she who has been acting against us?” he cries. The woman steps forward, hiding her countenance from view by the brim of a wide-brimmed hat with a scarlet hatband. “Acting against us, you say? Wrong.” She tips the brim of her hat up so everyone can see her dark brown eyes narrowing directly at the bespectacled man. “Just you. You and the others gathered here who wear red just as an excuse to cause chaos.” The two stare hatefully at one another for some time, taking the attention off you, before the proceedings continue. Neither one seems to pay you any further heed.</p><p class='basic right'>La Chica Roja abstains.<br>The Sanguine Watcher abstains.</p><p class='basic right'>The Sanguine Watcher is the bearer of The Weeping Lady. Update the Campaign Log accordingly</p>",
          "youHaventSeenTheLastOfTzuSanNiang": "<p>_If you haven’t seen the last of Tzu San Niang_: You are not surprised to see Tzu San Niang counted among those gathered before you. One who feels fear might take the chance to lay low after their escape, but not someone like her. “Ah, yes, these meddlesome insects.” Her melodic voice is delightfully charming despite the violence behind her words. “They interfered with my business. For these transgressions, no punishment is harsh enough.”</p><p class='basic right'>Tzu San Niang enthusiastically votes “yea.”</p>",
          "tzuSanNiangHasYouUnderHerSway": "<p>_If Tzu San Niang has you under her sway_: Your heart leaps into your throat as Tzu San Niang approaches you, mesmerizing you with every breath. The compulsion to aid her, to serve her, rises within you once more. “Ah, my pets.” She taps her parasol on the ground and kneels in front of you. “You may have fled me, but you will never escape me. You know this, do you not?” You head nods, despite yourself. You bite into your gag, but the compulsion is overwhelming. Tzu grins. “Why don’t you tell everyone what we should do with you?” She coos, and removes the gag from your mouth. You struggle to remain silent, panting, sweating, refusing, denying, but the words worm their way out of your lips anyway. Her point made, she wraps the gag around you once more and runs her fingers delicately through your hair before returning to her place among the Coterie. You shudder in revulsion.</p><p class='basic right'>The lead investigator votes “yea” in Tzu San Niang’s stead.</p>",
          "tzuSanNiangIsUnderYourSway": "<p>_If Tzu San Niang is under your sway_: There is an awkward pause as the Coterie confer. “Has anyone seen Tzu San Niang?” someone asks. You feel a pang of guilt, followed by satisfaction. She was never here.</p><p class='basic right'>Tzu San Niang abstains by default.</p>",
          "shadesOfSufferingSkipped": "<p>_If neither of the above are true_: A woman holding a red parasol over her head speaks next, with a charming, alluring voice. “I am sorry,” she begins, her glamour captivating the entire audience, “but why are we wasting our time with such a paltry matter?” Hope rises in your heart that she might speak reason. “Just end them and be done with it,” she says without even gazing your way. Your hopes shatter.</p><p class='basic right'>Tzu San Niang votes “yea.”</p><p class='basic right'>Tzu San Niang is the bearer of The Shade Reaper. Update the Campaign Log accordingly.</p>",
          "tuwileMasaiIsOnYourSide": "<p>_If Tuwile Masai is on your side_: Professor Masai steps out of the shadows, light glinting on his thick red spectacles. He looks you up and down as if seeing you for the first time. “I know them only by reputation. But that reputation suggests that they have shown some measure of mercy and understanding to us. I recommend we respond in kind.”</p><p class='basic right'>Tuwile Masai votes “nay.”</p>",
          "tuwileMasaiIsNotOnYourSide": "<p>_If the above is not true_: A thin, clean-cut gentleman with dark skin and striking red glasses steps out of the shadows. “While this entire ritual smacks of boarding school antics, I believe that any threat to the Coterie should be dealt with swiftly and humanely. They are too dangerous to let go.”</p><p class='basic right'>Tuwile Masai votes “yea.”</p>",
          "trialResult": "<p class='basic'>Depending on how votes were cast, proceed as follows:</p><ul><li>If it is a tie, or if the “yeas” have it, you have been deemed a liability. Proceed to _The Trial 2_.</li><li>If the “nays” have it…<ul><li>…and La Chica Roja, Ece Şahin, and Desiderio Delgado Álvarez all voted “nay,” you may try to convince them to overthrow the Coterie. If you do, skip to _The Trial 3_.</li><li>…and Thorne, Tuwile Masai, and The Claret Knight all voted “nay,” you may attempt to join the Coterie. If you do, skip to _The Trial 4_.</li><li>Otherwise, you have been deemed an asset. Skip to _The Trial 5_.</li></ul></li></ul>",
          "theTrial2": "<p class='file'>_The Trial 2_: With the voting complete, you are shoved to the floor. You struggle against your bonds, but are unable to free yourself, and vastly outnumbered, besides. There is no hope of escape. A cold blade is placed at the edge of your neck. “You who seek to harm our noble cause have been accused and charged with numerous crimes against the Coterie,” a voice states with dreadful gravity. The blade bites against your skin. A trail of blood trickles down your neck. “The punishment is death. May the crimson stain of your legacy be washed away.” You close your eyes and brace yourself.</p><p>Just then: a crash. Shouting and sounds of battle erupt throughout the room, a storm of clashing steel and gunfire. You are sent reeling as your would-be executioner is attacked by an unseen foe. You struggle again to free yourself, but are unable…until moments later, when you are dragged out of the chamber. Your bonds are cut, and you are brought to your feet by none other than the woman in the vermillion veil herself. Ece ushers you down the hall, whispering over the chaos of the battle. “We have to get out of here.” Several of the others who wear red follow in your wake, looking over their shoulders the entire time.</p><p>You ask what is going on as another rumble shudders throughout the halls. “The one with the red gloves, he…” she trails off, her hand trembling as she grips your arm. “He’s not what we thought he was. That man always creeped me out, but—to think—how could we have not known—?”</p><p>You ask her to start again, slower. “He attacked us,” she says, meeting your gaze as you duck into a quiet hall filled with scarlet tapestries. “The others fought him off, but…there was something strange about him. He was not human. It was something else entirely. It stole as many implements as it could and escaped, like…” she shudders. “…just like one of the creatures we seek to destroy.”</p><p>Thoughts run unbidden through your mind. If the man with the red gloves—or whatever it truly is—is after the remaining Keys, you have to stop it, at any cost. You pull away from Ece and begin marching back. “What are you doing?” she calls out. “The rest of them won’t show you any mercy, you know.” But your intentions are clear.</p><p>“If you’re going after that thing,” one of the others says to you, “then we’re coming, too.”</p><ul><li>In your Campaign Log, record *the cell escaped the Red Coterie*.</li><li>Proceed to _Setup (v. I)_.</li></ul>",
          "theTrial3": "<p class='file'>_The Trial 3_: Murmuring and debate erupt throughout the assembled Congress. The gag is taken out of your mouth, and your bindings are cut. With some reluctance, you are brought before the ceremonial table and given the chance to speak on your behalf. Your eyes seek out the members of the Coterie you know to be genuinely good, and as soon as the room is silent, you appeal to their sense of justice. For too long, the Red Coterie has allowed its members to wreak havoc and spread misery among the people simply to further their own ends. For too long, they have used their collected power not to guard humanity, but to plague it. As you speak, several of the people you have met nod amongst themselves. “They’re right,” the girl in the red coat announces, gesturing at several of the others who look on with sneers. “You all say you are motivated by a duty to humanity, yet you tolerate the presence of those who only do others harm. If this is the kind of organization you really are, I no longer wish to be a part of it.”</p><p>Ece nods along. “I agree. This is no longer a righteous organization.” She joins La Chica Roja’s side, along with several others. Among them is Desi, who simply tips the brim of his hat in your direction and slips you a subtle wink.</p><p>“Cleaning up the streets of scum has been my life’s work,” he declares, his eyes narrowing. “Maybe it’s time I start cleaning this place up, too.” A tense silence lingers in the chamber as the two sides stare one another down, but it’s clear that your side outnumbers the other. For a moment, you fear that the ensuing chaos will be impossible to survive.</p><p>Luckily, no such battle erupts. Seeing the wisdom in flight, your foes carefully filter out of the room, whispering, mumbling and hissing with vitriol. “You may wear red,” one of them spits, “but you will never be strong enough to stop what is coming without us. You are weak. You will be the doom of us all.”</p><p>Ece steps in front of the rest, shaking her head. “No. It is you who are weak. And by purging you from our ranks, we have only become stronger.”</p><ul><li>In your Campaign Log, record *the cell overthrew the Red Coterie*.</li><li>Skip to _The Trial 8_.</li></ul>",
          "theTrial4": "<p class='file'>_The Trial 4_: Murmuring and debate erupt throughout the assembled Congress. The gag is taken out of your mouth, and your bindings are cut. With some reluctance, you are brought before the ceremonial table and given the chance to speak on your behalf. Your eyes seek out the members of the Coterie who have seen your potential up close, and as soon as the room is silent, you appeal to their sense of logic and reason. You have been nothing but a valuable asset to the Red Coterie, and what’s more, you bring experience with the Foundation and the potential for both organizations to cooperate further. You seek the same goals as they do, and as your enemies from beyond gather to erase humanity from existence, only by working together can you stop this threat. As you speak, several of the people you have met nod in agreement. “They are, of course, correct,” Professor Masai speaks on your behalf. “We have let ourselves be motivated too long by petty desires while the threat of annihilation looms over us.”</p><p>Several of the others look on with disgust as more speak up. “We have inducted far worse into our ranks,” says the knight with many names. “These before us have proven themselves in more ways than one, and we need every ally we can get.”</p><p>“Agreed,” Thorne states, their voice level and calm as always. “I would call those on trial ‘trustworthy partners’ before I call them foes.” Their gaze meets yours, a meticulous smile hiding the vicious nature you know them to possess. Thorne would do anything to get what they want, and right now, what they want is you.</p><p>The members of the Coterie you have wronged shout and curse in bitter protest, but they are clearly outnumbered. A tense silence lingers in the chamber as the two sides stare one another down. For a moment, you fear it may even come to blows. “You may seek to wear red,” one of them spits, “but you will never be one of us.”</p><p>“If you no longer wish to be a part of this organization,” Professor Masai states, “You know where the door is.” Your detractors sit in hateful silence as the proceedings continue. The knight beckons you forward and inducts you into their order in a lengthy, solemn ritual. “With red we are bound,” he recites with gravitas, “through red we are one. Thus in red do we embrace our kin and our ken.” You are told to forsake your old life to take up a new one, for the betterment and guidance of all humanity. You think on your life, on the events that led you to this place, on those you hold dear and the many things you will leave behind. Then, you acquiesce.</p><ul><li>Each investigator chooses an article of clothing depicted in their investigator art. Your keys are now bound through this mundane implement through occult esoterica. Its color becomes scarlet-red from now until the end of time.</li><li>In your Campaign Log, record *the cell joined the Red Coterie*.</li><li>Skip to _The Trial 8_.</li></ul>",
          "theTrial5": "<p class='file'>_The Trial 5_: Murmuring and debate erupts throughout the assembled members of the Coterie. The gag is taken out of your mouth, and your bindings are cut. With some reluctance, you are brought before the ceremonial table and addressed by the Congress, who tell you that you will be spared so long as you declare your intent to aid and never again interfere in their mission. Given the alternative, you have no choice but to agree. The members of the Coterie you have wronged exclaim in protest, but it is clear they are outnumbered.</p><ul><li>In your Campaign Log, record *the Red Coterie spared the cell*.</li><li>Skip to _The Trial 8_.</li></ul>",
          "theTrial6": "<p class='file'>_The Trial 6_: Before the next member is even given the chance to speak, a figure emerges from behind the man with the red gloves, and something small and dark is placed against the base of his skull. There is a thunder in your ears as the gunshot rings out across the chamber. The man’s face explodes not in grotesquerie, but in a flood of distorted mist that crests outward and reforms above the man’s hollowed body. It takes the vague shape of a many-armed spiral, like a galaxy of stars pinching all of reality around its otherworldly form. The clothes the Red-Gloved Man previously wore crumple to the ground, empty.</p><p>The rest of the assembled Coterie draw their weapons and attack the entity, but it quickly escapes the chamber, reassembling its ectoplasmic form before your very eyes on its way out. Several more of the things follow suit, the attire of their previous forms falling, limp and hollow, to the floor. From the shadows emerges the true figure of the Red-Gloved Man. “They are here,” he states with surprising nonchalance, reloading his sidearm. “Among us. Perhaps the rest of you might have noticed, had you kept your gaze on our mission.” He shares with you a knowing glance and the barest hint of an impish grin. “These ‘accused’ are to thank for my return to this realm. Without them, you might all be dead. This trial is over.” There is no debate whatsoever.</p><p>The gag is taken out of your mouth, and your bindings are cut. You are brought before the ceremonial table, standing by the man’s side. “What are they after? Where have you been?” one of the Coterie asks.</p><P>“They are after our world. Perhaps every world,” he replies, pulling his scarlet gloves taut around his hands. “But now is our chance to strike back. To follow them to their home and end this threat, once and for all.” Nods and murmurs of consent ripple throughout the assembly.</p><ul><li>In your Campaign Log, record *the Red Coterie spared the cell*.</li><li>Proceed to _Setup (v. III)_.</li></ul>",
          "theTrial7": "<p class='file'>_The Trial 7_: Before the next member is even given the chance to speak, the Red-Gloved Man reaches out to grip their skull with uncanny strength, his arms lengthening into spindly wires of ectomatter. He crushes their skull inside the palm of his hands, staining his gloves a deeper crimson than ever before. The body slumps to the ground, and chaos ensues.</p><p>You watch in horror as more of the assembly begin to contort and reshape themselves, ambushing everyone around them in a macabre display. A storm of shouting, clashing steel, and gunfire erupts throughout the room. Each slain member of the Congress is erased in their entirety. You are sent reeling as your captors, too, are expunged from reality. You crawl along the ground as the fray rages on, eventually finding a shard of glass upon which to cut your bonds. By the time you free your companions and rise to your feet, the entities have fled. The last thing you see is the shapeless elongated remnants of the Red-Gloved Man escaping out the door you came from.</p><p>You survey the damage, but surprisingly, there isn’t much to look at. Save for you and a few articles of discarded and forgotten red attire, the chamber is completely empty.</p><p>To your horror, you recall none of their names or monikers. Not a single one.</p><ul><li>In your Campaign Log, record *the Red Coterie was destroyed from within*.</li><li>Proceed to _Setup (v. III)_.</li></ul>",
          "theTrial8": "<p class='file'>_The Trial 8_: With the trial proceedings over, the Congress finally reaches other affairs. “There is still the matter of the Outsiders,” one among them states. “We have assembled our strength in order to prepare for the inevitable, but how can we be certain our dimension is of any interest to them? We cannot seek to understand such abstruse entities.”</p><p>You chime in, telling the Congress of everything you have seen during your travels and your operations with the Foundation: the strange happenings across the globe have only grown in frequency, and you have reason to believe they are intelligent and malicious—not mindless and incomprehensible. What’s worse, they appear to be after the very same keys as everyone else.</p><p>“If they are stirring, preparing for war,” another member declares, “then we must do the same. We have among our assembly bearers of the most powerful artufacts this order has uncovered. Let us put them to good use and exterminate this threat once and for all.” Nods and murmurs of consent ripple throughout the assembly.</p><p>“But if they are intelligent entities as our new friends claim they are, how could they possibly know so much of our inner workings?” Your detractor argues. A dreadful hunch stirs in your mind. You scan the room and remark that one among the Congress is missing. The rest of the assembly follows your gaze, with several of them standing to search the chamber more thoroughly. One of them confirms your suspicions by raising a single red glove, discarded and forgotten as though mundane, immaterial.</p><p>The woman in the vermillion veil is the first to understand your thread of logic. “Spread out,” she shouts, her voice warbling. “Find him. Learn where he is headed. And be ready for anything.”</p><p>It doesn’t take long before the doorway is found—a shimmering portal of extradimensional energy, ebbing with eldritch power. “It’s closing,” one of the others observes. Indeed, the doorway seems to be shrinking as it steadily swirls, and soon enough there will be nothing left of it. “We don’t have much time.”</p><ul><li>Proceed to _Setup (v. II)_.</li></ul>"
        },
        "version1": {
          "setup": {
            "title": "Setup (v. I)",
            "gatherSets": "Gather all cards from the following encounter sets: *Congress of the Keys*, *Red Coterie*, *Scarlet Sorcery*, *Spatial Anomaly*, *Spreading Corruption*, *Locked Doors*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/congress-of-the-keys.png'><img src='{setImgPath}/red-coterie.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/locked-doors.png'></section>",
            "placeLocations": "Put the _Lair_ versions of Scarlet Halls and the three Coterie Sanctuary locations into play.",
            "removeSanctum": "Remove the _Sanctum_ versions of these locations from the game.",
            "startAt": "Each investigator begins play at Scarlet Halls.",
            "actDeck": "Build the act deck using only Act 1a—”Secrets and Lies (v. I).” Remove each other version of Act 1a from the game.",
            "yea": "Find each _Coterie_ enemy from the *Red Coterie* encounter set who voted “yea,” along with The Red-Gloved Man. This set is indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section>",
            "doNotGatherNay": "Do not gather any of the _Coterie_ enemies from this set who voted “nay,” abstained, or were eerily silent (*not counting The Red-Gloved Man*).",
            "theRedGlovedMan": "The lead investigator spawns The Red-Gloved Man in the shadows and resolves its concealed keyword (*as granted by act 1a*).",
            "drawCoterie": "Shuffle the rest of the gathered _Coterie_ enemies. One at a time, in player order, each investigator other than the lead investigator draws 1 of them, spawning them as normal.",
            "shuffleRemainingCoterie": "Shuffle the rest of the gathered _Coterie_ enemies (those not drawn in the previous step) into the encounter deck.",
            "yeaNote": "*Note that the following characters may vote “yea,” but do not have enemy cards in this encounter set: Tuwile Masai, Abarran Arrigorriagakoa, and Razin Farhi.*",
            "nay": "For each member of the Coterie who voted “nay,” find their _Conspirator_ story asset version and put them into play under any investigator’s control. (*Note: These story assets are scattered across various encounter sets. Some of them are on the reverse sides of enemy cards.*)",
            "nayNote": "*Note that Tuwile Masai may vote “nay,” but does not have a _Conspirator_ story asset.*",
            "setOutOfPlay": "Set the three _Otherworld_ locations from the Congress of the Keys encounter set and the Mimetic Nemesis enemy aside, out of play.",
            "secondEncounterDeck": "Now create the second encounter deck, as follows. Gather all cards from the following encounter sets: *Agents of the Outside*, *Beyond the Beyond*, *Outsiders*, *Secret War*, *Ancient Evils*, and *Striking Fear*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/beyond-the-beyond.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/secret-war.png'><img src='{setImgPath}/ancient-evils.png'><img src='{setImgPath}/striking-fear.png'></section>When gathering the Striking Fear encounter set, only gather the following cards (2x Frozen in Fear and 2x Dissonant Voices). Do not gather 3x Rotting Remains from that set.",
            "otherworldDeck": "Find each of the nine City of Remnants locations from the *Beyond the Beyond* encounter set. Shuffle these locations together, with their unrevealed sides faceup, to form a deck. This deck is called the Otherworld deck. Place this deck near the scenario reference card.",
            "shuffleRemainder": "Shuffle the remaining encounter cards from these gathered sets together to form a second encounter deck. Keep this deck set aside, out of play, for now.",
            "decoys": "Gather each decoy mini-card and each of the following mini-cards: City of Remnants (L, M, and R), Mimetic Nemesis, and The Red-Gloved Man. Set them aside, out of play.",
            "locationAdjacency": "The rules for “Location Adjacency in the Realm of the Outsiders” and “Locations in the Shadows” can be found on page 57. Make sure to read (or refresh yourself on) these rules before playing this scenario."
          }
        },
        "version2": {
          "setup": {
            "title": "Setup (v. II)",
            "gatherSets": "Gather all cards from the following encounter sets: *Congress of the Keys*, *Agents of the Outside*, *Beyond the Beyond*, *Outsiders*, *Red Coterie*, *Secret War*, *Spreading Corruption*, *Ancient Evils*, and *Striking Fear*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/congress-of-the-keys.png'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/beyond-the-beyond.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/red-coterie.png'><img src='{setImgPath}/secret-war.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/ancient-evils.png'><img src='{setImgPath}/striking-fear.png'></section> When gathering the Striking Fear encounter set, only gather the following cards (2x Frozen in Fear and 2x Dissonant Voices). Do not gather 3x Rotting Remains from that set.",
            "otherworldDeck": "Find each of the nine City of Remnants locations from the *Beyond the Beyond* encounter set. Shuffle these locations together, with their unrevealed sides faceup, to form a deck. This deck is called the Otherworld deck. Place this deck near the scenario reference card.",
            "placeLocations": "Put the _Sanctum_ versions of Scarlet Halls and the three Coterie Sanctuary locations into play.",
            "removeLair": "Remove the _Lair_ versions of these locations from the game.",
            "startAt": "Each investigator begins play at Scarlet Halls.",
            "actDeck": "Build the act deck using only Act 1a—”Secrets and Lies (v. II).” Remove each other version of Act 1a from the game.",
            "yea": "Find each _Coterie_ enemy from the *Red Coterie* encounter set who voted “yea,” along with The Red-Gloved Man, and set each of those enemies aside, out of play. This set is indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section>",
            "removeOtherCoterie": "Remove all other _Coterie_ enemies from the game.",
            "yeaNote": "*Note that the following characters may vote “yea,” but do not have enemy cards in this encounter set: Tuwile Masai, Abarran Arrigorriagakoa, and Razin Farhi.*",
            "nay": "For each member of the Coterie who voted “nay,” find their _Conspirator_ story asset version and put them into play under any investigator’s control. (*Note: These story assets are scattered across various encounter sets. Some of them are on the reverse sides of enemy cards.*)",
            "nayNote": "*Note that Tuwile Masai may vote “nay,” but does not have a _Conspirator_ story asset.*",
            "setOutOfPlay": "Set the three _Otherworld_ locations from the *Congress of the Keys: encounter set and the Mimetic Nemesis enemy aside, out of play.",
            "decoys": "Gather each decoy mini-card and each of the following mini-cards: City of Remnants (L, M, and R) and Mimetic Nemesis. Set them aside, out of play.",
            "locationAdjacency": "The rules for “Location Adjacency in the Realm of the Outsiders” and “Locations in the Shadows” can be found on page 57. Make sure to read (or refresh yourself on) these rules before playing this scenario."
          }
        },
        "version3": {
          "setup": {
            "title": "Setup (v. III)",
            "gatherSets": "Gather all cards from the following encounter sets: *Congress of the Keys*, *Agents of the Outside*, *Beyond the Beyond*, *Outsiders*, *Red Coterie*, *Secret War*, *Spreading Corruption*, *Ancient Evils*, and *Striking Fear*. These sets are indicated by the following icons:<section class='encounter-sets'><img src='{setImgPath}/congress-of-the-keys.png'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/beyond-the-beyond.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/red-coterie.png'><img src='{setImgPath}/secret-war.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/ancient-evils.png'><img src='{setImgPath}/striking-fear.png'></section> When gathering the Striking Fear encounter set, only gather the following cards (2x Frozen in Fear and 2x Dissonant Voices). Do not gather 3x Rotting Remains from that set.",
            "otherworldDeck": "Find each of the nine City of Remnants locations from the *Beyond the Beyond* encounter set. Shuffle these locations together, with their unrevealed sides faceup, to form a deck. This deck is called the Otherworld deck. Place this deck near the scenario reference card.",
            "placeLocations": "Put the _Sanctum_ versions of Scarlet Halls and the three Coterie Sanctuary locations into play.",
            "removeLair": "Remove the _Lair_ versions of these locations from the game.",
            "startAt": "Each investigator begins play at Scarlet Halls.",
            "actDeck": "Build the act deck using only Act 1a—”Secrets and Lies (v. III).” Remove each other version of Act 1a from the game.",
            "eerilySilent": "Find each _Coterie_ enemy from the *Red Coterie* encounter set who was eerily silent. This set is indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section>",
            "doNotGatherRest": "Do not gather any of the _Coterie_ enemies from this set who voted “yea,” “nay,” or abstained.",
            "theRedGlovedMan": "The lead investigator spawns The Red-Gloved Man in the shadows and resolves its concealed keyword (*as granted by act 1a*).",
            "drawCoterie": "Shuffle the rest of the gathered _Coterie_ enemies. One at a time, in player order, each investigator other than the lead investigator draws 1 of them, spawning them as normal.",
            "shuffleRemainingCoterie": "Shuffle the rest of the gathered _Coterie_ enemies (those not drawn in the previous step) into the encounter deck.",
            "theRedCoterieSparedTheCell": "Check the Campaign Log. *If the Red Coterie spared the cell*, find the _Conspirator_ story asset version of The Red-Gloved Man, along with each other member of the Coterie who was not gathered during the above step. Put each of them into play under any investigator’s control. (*Note: These story assets are scattered across various encounter sets. Some of them are on the reverse sides of enemy cards.*)",
            "ignoreUnique": "For the remainder of this scenario, ignore the unique symbol on both versions of The Red-Gloved Man. (*If The Red-Gloved Man is the bearer of any keys, attach them only to his enemy version.*)",
            "conspiratorNote": "*Note: The list of possible _Conspirator_ story assets is as follows: The Claret Knight, Ece Şahin, Thorne, Aliki Zoni Uperetria, Desiderio Delgado Álvarez, La Chica Roja, and The Red-Gloved Man.*",
            "setOutOfPlay": "Set the three _Otherworld_ locations from the *Congress of the Keys* encounter set and the Mimetic Nemesis enemy aside, out of play.",
            "decoys": "Gather each decoy mini-card and each of the following mini-cards: City of Remnants (L, M, and R), Mimetic Nemesis, and The Red- Gloved Man. Set them aside, out of play.",
            "locationAdjacency": "The rules for “Location Adjacency in the Realm of the Outsiders” and “Locations in the Shadows” can be found on page 57. Make sure to read (or refresh yourself on) these rules before playing this scenario."
          }
        },
        "resolutions": {
          "xp": {
            "bonus": "Saved their dimension from a terrible fate."
          },
          "defeated": {
            "title": "Investigator Defeat",
            "body": "<p class='basic'>_Before resolving any other resolution, if at least 1 investigator was defeated_: The defeated investigators read _Investigator Defeat_ first.</p><p>_Investigator Defeat_:  With no dimension left for your body to exist within, every fiber of your being is torn apart. Your memories and thoughts drip through endless oblivion from now until the end of all things. But your consciousness, your awareness, remains. An infinite, eternal prison of nothingness.</p><ul><li>Each investigator who was defeated is driven _insane_ and is never seen or heard from again. All memory of their existence is purged from reality.</li><li>If another resolution was reached, the remaining investigators proceed to that resolution.</li><li>If no resolution was reached (each investigator was defeated): Go to _Resolution 2_.</li></ul>"
          },
          "resolution1": {
            "title": "Resolution 1",
            "body": "<p>_Resolution 1_: The feeling of being flung across worlds does not cease until you strike solid ground. Though your weary body protests, you scamper to your feet and scan your surroundings, ready for anything. But when you realize where you are, you are shocked to find…<?p><ul><li>Lay out the world map on a flat surface. Each investigator tosses a coin or chaos token onto the map. Wherever it lands, that is where that investigator ended up. (If it lands in an ocean, they ended up by chance on a random boat.)</li></ul><p>It takes several weeks for you to contact the other members of your cell who survived the collapsing of the Outsiders’ realm. It seems that, at least for now, their scheme has been dismantled. Perhaps a long-earned vacation is in order, but first there is one last order of business to resolve…</p><ul><li>In your Campaign Log, record that *the Outsiders were stopped*.</li><li>Each investigator suffers 2 physical trauma and 2 mental trauma, as they may never truly recover from their paradimensional ordeal.</li><li>Each investigator earns experience equal to the Victory X value of each card in the victory display. Each investigator earns 5 bonus experience, having saved their dimension from a terrible fate.</li><li>_The investigators win the campaign!_</li><li>Proceed to _Epilogue_.</li></ul>"
          },
          "resolution2": {
            "title": "Resolution 2",
            "body": "<p>_Resolution 2_: “There, that is the last of them,” Agent Hudson says as he slams his stamp down onto the expense report. “I understand the need for secrecy, but I must once again request we hire assistants for this secretarial work, Commissioner.” He hands the bundle of documents to Taylor, who sits behind her stark black desk, wearing a grave expression.</p><p>“More eyes means more leaks. We keep this crew tight for a reason, Hudson. Do not lose sight of what is important.” She flips through the documents for a moment, furrowing her brow. “Where is the report on asset 32–J’s cell?”</p><p>“32–J?” the man pulls a small notebook from his back pocket and flips to a page near the middle. “No such designation exists.”</p><p>Taylor grimaces. “No, that’s not right. There was…we met them in London. You were there…” After a moment, she shakes her head in utter confusion. “Hm. Strange. I don’t remember who they were.”</p><p>“You have been working too hard,” the agent replies with a small grin. “Take some time off, Commissioner. We can handle things without you for a week or so.”</p><ul><li>In your Campaign Log, record *the cell was hollowed*.</li><li>_The investigators lose the campaign_.</li></ul>"
          }
        }
      },
      "sections": {
        "heading": "档案#59–Z(终幕)",
        "tokens": {
          "easyStandard": {
            "skull": "-X。X为当前场景编号。",
            "cultist": "-5。你可以将你控制的一个_稳定_钥匙翻至_动荡_面，以改为将本标记的修正值视为-2。",
            "tablet": "-2。如果这是对重整的_域外_敌人的攻击，改为你自动失败。",
            "elderThing": "-3。取消投入本次检定的每张卡牌上的效果和图标，将它们放到一边，位于场外，作为空洞。"
          },
          "hardExpert": {
            "skull": "-X。X为当前场景编号+1。",
            "cultist": "-7。你可以将你控制的一个_稳定_钥匙翻至_动荡_面，以改为将本标记的修正值视为-4。",
            "tablet": "-2。如果你所在地点有重整的_域外_敌人，改为你自动失败。",
            "elderThing": "-4。取消投入本次检定的每张卡牌上的效果和图标，将它们放到一边，位于场外，作为空洞。"
          }
        },
        "label": {
          "cultist": {
            "easyStandard": "将你控制的一个_稳定_钥匙翻至_动荡_面，以改为将本标记的修正值视为-2。",
            "hardExpert": "将你控制的一个_稳定_钥匙翻至_动荡_面，以改为将本标记的修正值视为-4。"
          },
          "theWorldUnbidden": {
            "unstable": "变换一个其控制的_动荡_钥匙而不翻至_稳定_面，以取消上述效果造成的所有伤害和恐惧。",
            "stable": "将其控制的任意数量的_稳定_钥匙翻至_动荡_面，以取消相同数量的上述效果造成的伤害/恐惧。",
            "damage": "取消1点伤害",
            "horror": "取消1点恐惧"
          }
        },
        "intro": {
          "label": {
            "deemedALiability": "进入_审判 2_。",
            "overthrow": "进入_审判 3_。",
            "join": "进入_审判 4_。",
            "deemedAnAsset": "进入_审判 5_。"
          },
          "title": "档案#59–Z(终幕): 钥匙议会",
          "body": "<p class='basic file'>取决于你如何到达此处……</p>",
          "option1": "你因状况报告(由于时间耗尽)到达此处",
          "option2": "你自行前往通古斯卡",
          "intro1": "<p class='file'>你在黑暗中醒来。头上的麻袋已经被取下，扔到一边。有人用力捏你的脸，打了你一两巴掌。“醒醒。”一个邪恶的声音命令道。你眨眨眼，恢复了意识，不无惊恐地意识到自己和同伴被人绑在了椅子上。嘴里塞了东西，你叫不出声，只能发出呜咽。</p><p>等到你的眼睛终于适应了昏暗的光线，你发觉自己肯定是在地下。这间巨大的厅堂没有窗子，石壁打磨光滑，由水银蒸汽灯略微照亮。墙上挂着猩红的织毯，还有几架玻璃柜子，里面装着古老的遗物和历史上的神器。一张巨大的桌子占据了房间中央，上面精巧地刻画着线条和圆环的纹样。桌旁围绕着一圈身影，有的你熟悉，有的并认不出。它们身上都有红色。你的心跳到了嗓子眼。“你被带到此处，清算你对同志会犯下的罪行。”那个声音宣言道，“如果议会同意，也可能会嘉奖你的功绩。我们将清点有谁将为你辩护，又有谁要指控你。”</p><p class='basic right'>进入_审判_。</p>",
          "intro2": "<p class='file'>要不是有泰勒专员的情报，你怕是永远也找不到红色同志会在这里的秘密藏身处。这栋建筑就在西伯利亚核心地带的地下。离此处不远有一个神秘的火山口，标记了著名的通古斯卡事件——那次爆炸，抑或是撞击？其中真相已经被掩埋在迷雾中超过十年了。也许这起诡异的事件还和同志会有着联系——不，自从你知道同志会拥有的危险神器，早就不怀疑这一点了。问题只是：是谁先来的？</p><p>大雪掩盖了遥远荒野的入口，但你最终还是找到了——雪丘上有一扇未加标记的铁门，从远处几乎不可能看到。你惊讶地发现门居然没锁……但你一进去，同志会的守卫就迎了上来。他们带着怀疑的眼神，穿着熟悉的红衣。“我们一直在等你。”其中一个狞笑着说道，“来吧，议会就要开始了。”</p><p>你别无选择，只能跟上。守卫领你一路往下，越走越深。狭窄的阶梯两旁石壁打磨得非常光滑，漫长的走道黑咕隆咚，十分单调。终于，你来到一间巨大的厅室，这里没有窗子，由水银蒸汽灯略微照亮。墙上挂着猩红的织毯，还有几架玻璃柜子，里面装着古老的遗物和历史上的神器。一张巨大的桌子占据了房间中央，上面精巧地刻画着线条和圆环的纹样。桌旁围绕着一圈身影，有的你熟悉，有的并认不出。它们身上都有红色。你背后的门猛地关上，你的心跳到了嗓子眼。“你来得正好。”同志会众人中传出一个声音，“我们刚要开始投票。”</p><p>你问这次投票是为了什么，嘴巴不由得发干。你总觉得来这里只是为了亲眼见证自己的毁灭。“这是一场召集的会议。清算你对同志会犯下的罪行。如果议会同意，也可能会嘉奖你的功绩。我们将清点有谁将为你辩护，又有谁要指控你。”你感到背后突然有人将你绑住，嘴里也塞了东西。“只是走个流程，我保证。”守卫奸笑着慢慢说道。</p><p class='basic right'>进入_审判_。</p>",
          "theTrial1": "<p class='file'>_审判：_同志会投票决定你的命运。</p><p class='basic'>阅读下列每个部分的相关文本，按顺序记录所有的投票。每个“赞成”票表示该同志会成员想要看你去死。每个“反对”票表示该同志会成员想要护你周全。弃权票或沉默既非赞成也非反对。</p>",
          "nay": {
            "title": "<h3 class='vote-header'>反对</h3>",
            "count": "{count}票"
          },
          "yea": {
            "title": "<h3 class='vote-header'>赞成</h3>",
            "count": "{count}票"
          },
          "theCellAidedTheKnight": "<p>_如果特别小组援助了骑士：_亚历山大年长的“骑士”迈步向前，吸引了房间里所有人的注意力。“我尊敬的同道啊。我们面前的几位，尽管……所忠非人……但确实值得我们的尊重和认可。要是没有他们的帮助，我们在亚历山大的圣堂就要陷落。我不得不说，还是陷落在自己人手里。我相信这已经足以彰显他们的价值。”其他几位点点头同意。聚集的会员环顾四周，但并没有人出来反驳。也许恶兽还在养伤。</p><p class='basic right'>暗红骑士投票“反对”。<br>深红斗篷的恶兽默认弃权。</p>",
          "theCellFailedToFendOffTheBeast": "<p>_如果特别小组未能阻挡恶兽：_深红斗篷遮蔽下的恶兽发出隆隆的叫声。“血。”它的声明非常简单。这凶煞的声音吓得你退缩，脊背发颤。“必须要见血。”你环顾四周，寻找亚历山大年长的骑士，希望他能说服其他人冷静……但他不在这里。</p><p class='basic right'>暗红骑士默认弃权。<br>深红斗篷的恶兽投票“赞成”。</p>",
          "youHaventSeenTheLastOfTheClaretKnight": "<p>_如果你和暗红骑士之间恩怨未了：_“应该采取什么措施，一目了然。”来自亚历山大，仪表堂堂的年长“骑士”宣称道，“这些人不值得信任，还意图颠覆我们的控制。必须予以消灭。”在桌子另一端，骑士的敌人，深红长袍笼罩的阴影吼道：“我们终于有一次意见一致。”他隆隆的声音凶狠而粗野。骑士的眼睛眯了起来。“别自以为是了。”他警告道。</p><p class='basic right'>暗红骑士投票“赞成”。<br>深红斗篷的恶兽投票“赞成”。</p>",
          "theDogsAreAtWar": "<p>_如果大战打响：_你和聚集起来的同志会成员环顾四周，寻找亚历山大的两位代表，但得到的只有一片寂静。“看来我们中有两位决定不出席了。”同志会中的一员声明道。你不禁好奇他们是否还活着。兴许他们之间的冲突把自己都搭了进去。你一想到亚历山大的情况就不寒而栗。</p><p class='basic right'>暗红骑士默认弃权。<br>深红斗篷的恶兽默认弃权。</p>",
          "dogsOfWarSkipped": "<p>_如果均非上述情况：_“我不想要暴力。”一位衣冠楚楚、身披红色的长者说道。“我相信面前的人能成为可靠的支援。”就在桌子对面，一个深红长袍下的身影隆隆道：“这就是你为什么这么弱。”它阴影中的面容转过来朝着你。你在昏暗的灯光中只能看到滴着涎水的可怕獠牙。“必须流血。”</p><p class='basic right'>暗红骑士投票“反对”。<br>深红斗篷的恶兽投票“赞成”。</p><p class='basic right'>抛硬币并如下更新剧本日志的钥匙部分：如果正面朝上，“暗红骑士”拥有法罗斯之光；如果背面朝上，“深红斗篷的恶兽”拥有法罗斯之光。</p>",
          "eceTrustsTheCell": "<p>_如果艾婕信任特别小组：_艾婕上前一步，清清嗓子：“我曾经和基金会联络，因为藏在伊斯珀布尔的扭曲反棱镜有被第三方发现的危险。这些就是响应我的特工。他们没有将神器留下，而是选择交给我保管。我相信他们值得信赖，而且，不像我们中的某些人，还很有道德。”</p><p class='basic right'>艾婕·萨辛投票“反对”。</p>",
          "eceDoesNotTrustTheCell": "<p>_如果艾婕不信任特别小组：_桌旁其他人看向艾婕，她垂下了眼睛。“我……”她结结巴巴，“我厌恶暴力，不像我们中的某些人一样乐在其中，因此拒绝参与这种事。”她若有所指，激怒了其中几位。但她渐渐抬起头，一脸的悲伤和坚毅，眼神对上了你。“但这些人不能相信，我也不能宽恕其罪过。”她静静地深呼吸：“我很抱歉。”</p><p class='basic right'>艾婕·萨辛弃权。</p>",
          "dealingsInTheDarkSkipped": "<p>_如果均非上述情况：_“如果我们想要建立一个名正言顺的组织，”朱红头巾的女子礼貌地指出，“我们就不能见到挡路的就杀。我们的进步需要理解与合作。并且，我厌恶暴力。我们应该跟这些人合作，而非作对。”</p><p class='basic right'>艾婕·萨辛投票“反对”。</p>",
          "youHaventSeenTheLastOfAmaranth": "<p>_如果你和苋之间恩怨未了：苋露出病态的狞笑望着你：“噢，我等这一刻可真是太久了。”她拉长声音说着，眼里闪着光。“惹麻烦的蠢货，你难道以为自己干扰我们的计划还能不受惩罚？”</p><p class='basic right'>苋狂热地投票“赞成”。</p>",
          "theLoversAreReunited": "<p>_如果情人重聚：_苋和拉辛·法瑞保存完好的活尸彼此迷恋的对视实在叫人恶心，但他们间或还是睥睨你一眼。“你怎么想，最亲爱的拉辛？我们要不要饶了这些挡路的蠢货？”苋问道，“还是我们给他们上一课？”拉辛嘶哑地回道：“吾爱。没人能挡我们的路。把他除掉，以后也不会有人挡我们的路了。”</p><p class='basic right'>苋投票“赞成”。<br>拉辛·法瑞投票“赞成”。</p>",
          "amaranthHasLeftTheCoterie": "<p>_如果苋离开同态会：_“苋哪儿去了？”同志会里有人大声问道，众人的窃窃私语越来越大声。“她从不缺席会议。”你虽然被封了口，但还是笑了。至少艾琳最终可以摆脱同态会的控制，用自己的身份活下去。</p><p class='basic right'>苋默认弃权。</p>",
          "deadHeatSkipped": "<p>_如果均非上述情况：_接下来发言的是一个美丽的女子，她皮肤苍白，一身黑裙。她身上唯一的色彩就是头顶盛开的大花。“我们秘密行事自有原因，不是吗？”她样貌虽美，说话的语调音色却惹人厌恶。“这些人知道的太多了。杀了他们，就翻篇了。”</p><p class='basic right'>苋投票“赞成”。<br>苋拥有未绽之花，相应更新在剧本日志中。</p>",
          "youHaventSeenTheLastOfThorne": "<p>_如果你和索恩之间恩怨未了：_索恩整了整自己长大衣下正装衬衫的袖口：“基金会阻碍我们的计划，不值得信任。我们应当消灭这个特别小组，继续谈收藏的事情。”索恩对上你的眼神，坚定如初，毫不动摇：“我警告过你别挡我们的路，嗯？”</p><p class='basic right'>索恩投票“赞成”。<p>",
          "theCellMadeADealWithThorne": "<p>_如果特别小组与索恩达成交易：名为索恩之人向前一步：“我们海量的任务在全球各地都需要广泛合作。研究者、当局、罪犯。眼前这些也不例外。他们证明了自己派的上用场，在安克雷奇帮过我们；并且将钥匙交给我们妥善保管，也足见其智慧。”</p><p class='basic right'>索恩投票“反对”。</p>",
          "thorneDisappeared": "<p>_如果索恩消失：_你惊讶地发现索恩居然也在人群中。可是你们上次见面的时候，索恩在安克雷奇北部完全消失。而现在，这人一言不发，绝口不提你们之间发生了什么。</p><p class='basic right'>索恩诡异地沉默着。</p>",
          "onThinIceSkipped": "<p>_如果均非上述情况：_下一位发言的人戴着红色长巾，铂金色头发，雪白的皮肤。“我跟眼前这些人没打过交道。”此人指着你说，“未能直接了解其能力，是否可靠也不曾检验，这样盲目投票实属不智。因此，我坐观其变。”</p><p class='basic right'>索恩弃权。<br>索恩拥有玄丧之镜，相应更新在剧本日志中。</p>",
          "alikiIsOnYourSide": "<p>_如果艾里奇站在你这一边：_艾里奇·佐尼·奥佩勒曲亚走出阴影，背上带鞘的剑金光闪闪，眼神十分缥缈。虽然无风，她红色的腰带却依然飘扬。她一如既往，用失落的韵文轻声低语。同志会有人翻译道：“奥佩勒曲亚声称……”译员惊讶地抬高了眉毛，“我们眼前之人确是大业的忠仆，亦如吾等。”你周围爆发出一阵窃窃私语。</p><p class='basic right'>艾里奇投票“反对”。</p>",
          "youHaventSeenTheLastOfAlikiZoniUperetria": "<p>_如果你和艾里奇之间恩怨未了：_“别忘了奥佩勒曲亚的一票。”有个声音嘟囔道。“她在这儿？”另一人问道，“我们都试着联系她几周了。”聚集的同志会成员都转向房间的角落，你惊讶地发现幽灵般寂静的少女就在那里，远离众人。屋内寂静得诡异。要不是她的腰带还在一片寂静中缓缓飘动，你俨然已将她当作一尊雕像。</p><p class='basic right'>艾里奇诡异地沉默着。</p>",
          "withoutATraceSkipped": "<p>_如果均非上述情况：_阴影里走出一个缥缈的身影。她一身白衣，背上带鞘的剑金光闪闪，乌黑的头发遮住了眼睛。虽然无风，她红色的腰带却依然飘扬。先是一声柔和颤动的哨音，接着她用一种你从没听过的语言开口。同志会里似乎有人能懂她的话，将这记作是对你的指控。</p><p class='basic right'>艾里奇投票“赞成”。</p>",
          "desi": "<p class='basic'>_在结算下列任意选项前，如果德西欠你一笔：_找出你之前放在安全位置的那张德西德柔·戴佳多·欧瓦瑞兹，查看另一面。然后，继续。</p>",
          "desiIsGood": "<p>_如果德西德柔·戴佳多·欧瓦瑞兹的另一面是剧情支援：_突然一阵火光，是德西点亮了香烟。“这些家伙没问题。”他说，“现在可有更恶心的麻烦事呢。我在哈瓦那的时候，被那个你们知道是什么的鬼东西抓住了。是他们救了我——我还有什么可说的？所以，我挺他们。”</p><p class='basic right'>德西德柔·戴佳多·欧瓦瑞兹投票“反对”。</p>",
          "desiIsBad": "<p>_如果你和德西之间恩怨未了，或如果德西德柔·戴佳多·欧瓦瑞兹的另一面是遭遇卡牌牌背：_你盯着德西，希望他能为你说话。但他只是点燃一根烟，望着你背后的墙壁。</p><p class='basic right'>德西德柔·戴佳多·欧瓦瑞兹诡异地沉默着。</p>",
          "dancingMadSkipped": "<p>_如果均非上述情况：_“我该知道这帮人他妈的是谁吗？”一个打着红领带的西装男点燃一根烟，长吐了一口。烟雾漂浮在黑暗的桌上。“浪费时间。难道你们一直都不知道要消除未知因素吗？把他们解决了，我们专心处理真正重要的事情吧。”</p><p class='basic right'>德西德柔·戴佳多·欧瓦瑞兹投票“赞成”。<br>德西德柔·戴佳多·欧瓦瑞兹拥有镜刃，相应更新在剧本日志中。</p>",
          "theCellMeddledInAbarransAffairs": "<p>_如果特别小组介入了阿巴冉的事务：_突然，仪表堂堂、身材魁梧的阿巴冉·阿里戈利阿伽科一拳打在屋正中的仪式桌上。“这些入侵者！竟想毁了我！竟想夺走我的好运，我选中的宝物！”他气得发抖，脸涨红了，骨节发白。“我要亲自处罚入侵者！我要把他们分筋扒皮！我要——”他又吼了好一阵，怒火才消了点儿。</p><p class='basic right'>阿巴冉·阿里戈利阿伽科投票“赞成”。</p>",
          "fortuneAndFollySkipped": "<p>_如果并非上述情况：_下一个说话的男人你并不认识。他仪表堂堂、身材魁梧，但更为夺目的，还是他右手食指上那颗巨大的红宝石。“时运眷顾，我们又一次得享巨福。”他洪亮的声音吸引了所有的注意。“现在我们的敌人就在面前受缚？为什么要拒绝这样一份大礼？要想继续我们的大业，怎能不好好盘问一番？兴许我们还能将其用作手段。是的，手段……”他的声音渐渐小了下去，唇边扬起邪恶的微笑。你恨不得他还是投票杀了你的好。</p><p class='basic right'>阿巴冉·阿里戈利阿伽科弃权。</p>",
          "noMatterWhat": "<p>_无论如何：_你看不见戴红手套男子的脸，但你能想象他恐怖的微笑。</p><p class='basic right'>戴红手套的男子诡异地沉默着。</p>",
          "theCellKnowsTheTrueNatureOfTheCoterie": "<p class='basic right'>如果*特别小组了解了同志会的真相*，立即跳转，不记录其余投票。</p>",
          "eerilySilent": "<p class='basic right'>否则，如果有至少3位同志会成员诡异地沉默着，立即跳转，不记录其余投票。</p>",
          "continueTheTrial": "<p class='basic right'>如果均非上述情况，如常继续。</p>",
          "youHaventSeenTheLastOfLaChicaRoja": "<p>_如果你和红衣女郎之间恩怨未了：_你几乎没注意到藏在黑暗中的红衣女郎，她就站在另外两位同志会成员中间。她倾斜帽沿，盖过眼睛，脸上露出玩味的笑容。“这群人还说警察和探员一样，以为能对付我呢。”桌对面另一个戴着红眼镜的苍白男子站起来反驳她：“他们干涉了同志会的行动。”他吼道。“不。”女郎回道，“他们只是干涉了私人恩怨。要是你跟我有矛盾，红眼镜，冲我来，别冲他们。”</p><p class='basic right'>红衣女郎弃权。<br>血色监视者投票“赞成”。</p>",
          "youHaventSeenTheLastOfTheSanguineWatcher": "<p>_如果你和血色监视者之间恩怨未了：_突然，有一顶系着红带子的宽沿帽掉到了桌上，红衣女郎从阴影中现身。“基金会并不是我们最大的敌人，最大的敌人就在我们之中。这位特工身上可能并不戴红，但我保证他比我们里面一半人自称的都要正直。”桌对面，血色监视者用一块血红的布料擦了擦自己的红眼镜，露出的眼窝是一对骇人的空洞。“傻姑娘。”他的语气恶毒无比，“想最后再引人注目一次？”女郎怒视着他，抓着自己帽子中央，用劲之大，都抓皱了起来。“你们中有人知道这个恶心的杂种都干了什么吗？你们中真的有人在乎吗？”</p><p class='basic right'>红衣女郎投票“反对”。<br>血色监视者投票“赞成”。</p>",
          "theSanguineWatchersTormentContinues": "<p>_如果血色监视者造成的苦难未止：_红衣女郎从房间昏暗的角落里现身，她那顶熟悉的宽沿帽遮住了眼睛：“我在布宜诺斯艾利斯对付了自己人，那人的作为有碍我们的崇高利益。”她介绍道，“这些特工看到那里究竟发生了什么，还努力帮助了我。他们身上可能并不戴红，但我保证他们比我们里面一半人自称的都要正直。”人群中另一个声音问女郎她指的究竟是谁。“我们那位没有眼睛的‘朋友’。”她怒吼道，“我想他还在布宜诺斯艾利斯为害呢。但你们中真的有人在乎吗？”</p><p class='basic right'>红衣女郎投票“反对”。<br>血色监视者默认弃权。</p>",
          "sanguineShadowsSkipped": "<p>_如果均非上述情况：_下一个发言的是个秃头男人，戴着红色小框眼镜，他伸出一只瘦长歪曲的指头，指着同志会人群中的另外一人。“为什么是这些家伙在审判席上，而不是她这个叛徒？”他叫道。被他指着的女子向前一步，她的表情被宽沿帽边缘挡住了。帽子上还系着一根红色的带子。“你说我是叛徒？错了。”她扬起帽沿，人人都能见她眯起暗棕色的眼睛，盯着戴眼镜的男人。“只有你是叛徒。你和这儿有的人一样，以为自己戴了红就可以四处兴风作浪。”这两人彼此憎恶地对视，压根不关注你，直到议程继续。两人看来都不关心你的死活。</p><p class='basic right'>红衣女郎弃权。<br>血色监视者弃权。</p><p class='basic right'>血色监视者拥有恸哭女士，相应更新在剧本日志中。</p>",
          "youHaventSeenTheLastOfTzuSanNiang": "<p>_如果你和朱三娘之间恩怨未了：_看到朱三娘也在周围的人群中，你倒是一点也不意外。侥幸逃脱的人之后可能会抓住机会，夹紧尾巴做人，但这不是她的作风。“噢，好吧，这些捣乱的害虫。”她的言语中全是杀戮，说话的语调却还是那么轻快动听。“他们搅了我的局。有此大罪，万死难赎。”</p><p class='basic right'>朱三娘狂热地投票“赞成”。</p>",
          "tzuSanNiangHasYouUnderHerSway": "<p>_如果朱三娘支配了你：_朱三娘向你走来，每一次呼吸都迷惑着你。你的心提到了嗓子眼。那股帮助她、服侍她的冲动又一次占据了你。“啊，我的宠物。”她把阳伞往地上轻轻敲了敲，在你面前俯下身子。“你兴许能从我身边溜走，但你永远逃不出我的掌心。你知道的，不是吗？”你万般不情愿地低了点头。你咬紧嘴里塞的东西，但发颤冲动难以抑制。朱三娘娇笑道：“为什么你不自己告诉大家，想得到什么样的处置呢？”她轻声说着取走了塞在你嘴里的东西。你挣扎着不要出声，气喘吁吁，大汗淋漓，拒绝着、否认着，但那些话还是从你的唇间钻了出来。她达到了自己的目的，将手上的东西又塞回你嘴里，手指轻轻拂过你的头发，回到了她在同志会的位置。你厌恶地一阵颤抖。</p><p class='basic right'>调查员队长代表朱三娘投票“赞成”。</p>",
          "tzuSanNiangIsUnderYourSway": "<p>_如果朱三娘受你支配：_同志会的发言中出现了一阵尴尬的沉默。“谁见到朱三娘了吗？”有人问道。你先是一阵罪恶感，随即又是一股满足。她就不在这里。</p><p class='basic right'>朱三娘默认弃权。</p>",
          "shadesOfSufferingSkipped": "<p>_如果均非上述情况：_下一个发言的是位举着红伞的女子。她的声音十分迷人。“不好意思。”她一开口，魅力就征服了所有的听众。“可是我们为什么要在这样一件小事上浪费时间？”你心中涌起一阵绝望，她或许会讲道理。“把他们干掉就完事了。”她甚至没有朝你这边看一眼。你的希望破灭了。</p><p class='basic right'>朱三娘投票“赞成”</p><p class='basic right'>朱三娘拥有影穑，相应更新在剧本日志中。</p>",
          "tuwileMasaiIsOnYourSide": "<p>_如果特瓦耶·马萨伊站在你这一边：_马萨伊教授走出阴影，厚厚的红眼镜上闪着光。他上下打量着你，仿佛是第一次见面。“我只是听说过此人的事迹。但传言也说明他能理解、同情我们。我建议以此相报。”</p><p class='basic right'>特瓦耶·马萨伊投票“反对”。</p>",
          "tuwileMasaiIsNotOnYourSide": "<p>_如果并非上述情况：_阴影中走出一个身材颀长，轮廓分明的男子。他皮肤黝黑，带着的红眼镜十分醒目。“整个仪式真是小孩子在过家家。我认为同志会的任何威胁都应该迅速人道地处理掉。太危险了，不能让他们逃了。”</p><p class='basic right'>特瓦耶·马萨伊投票“赞成”。</p>",
          "trialResult": "<p class='basic'>根据投票结果，如下继续：</p><ul><li>如果投票结果为平局，或“赞成”居多，你被判处有罪。</li><li>如果“反对”居多……<ul><li>……且红衣女郎、艾婕·萨辛、德西德柔·戴佳多·欧瓦瑞兹都投票“反对”，你可以试图说服他们颠覆同志会。</li><li>……且索恩、特瓦耶·马萨伊、暗红骑士都投票“反对”，你可以尝试加入同志会。</li><li>如果均非上述情况，同志会认为你是可用的工具。</li></ul>",
          "theTrial2": "<p class='file'>投票结束，你被推到了地上。你挣扎着想要解脱束缚，却无济于事。更何况，你也寡不敌众。看来是没有逃脱的希望了。你脖子上抵着冷冰冰的刀刃。“你试图为害同志会的大业，被指控对同志会犯下多项罪行。”某人的声明严肃又骇人。利刃刺透了你的皮肤，你的脖子上滴下血来。“在此宣判你死刑。愿你留下的红污洗刷殆尽。”你闭上眼，绷紧身子。</p><p>随即爆发出一阵巨响。尖叫和战斗的声音在屋内炸开，枪林弹雨，刀剑纷飞。本想处决你的人被不知何处的敌人击倒，你也天旋地转起来。你奋力挣扎，摆脱束缚，但还是无功而返……直到稍后有人将你拖出了房间，解去了你的束缚。拉你站起来的正是朱红头巾的女士，艾婕领你一路走下长廊，在战斗的喧嚣中对你低语道：“我们得从这儿出去。”另有几个戴红的人跟着你们，一路上不断回头。</p><p>你问到底发生了什么，又一阵轰隆响彻走廊。“那个戴红手套的，他……”她抓着你臂膀的手不住颤抖，声音也矮了下去。“他不是我们以为的那个人。他总是吓我一跳——让我不由得想——我们怎么能不知道——？”</p><p>你放慢速度，又问了她一遍。“他攻击了我们。”她终于对上了你的眼神。你们正俯身走进一间寂静的大厅，四周的墙上挂着猩红的织毯。“其他人在抵抗他。但……他身上有哪里不对劲。他不是人类，已经完全是别的东西了。它偷了好多工具逃了，就像……”她打了个寒战，“就像我们要摧毁的家伙一样。”</p><p>你脑海里涌起一个想法。要是戴红手套的男子——或者无论它到底是什么——目标正是剩余的钥匙，那你必须不惜一切代价阻止。你抛下艾婕，大步回头。“你要干什么？”她喊道，“其他人不会对你心慈手软的，知道吗。”但你意已决。</p><p>“要是你去追那个东西。”有人对你说着，“那我们也去。”</p><ul><li>在剧本日志中，记录下*特别小组逃离红色同志会*。</li><li>进入_冒险设置(版本一)_。</li></ul>",
          "theTrial3": "<p class='file'>同志会成员里一阵窃窃私语，唇枪舌剑。有人取走了你口中的东西，解去了你的束缚。尽管有人并不情愿，你还是被带到仪式桌前，有机会为自己辩护。你的眼神寻找着同志会中你知道真心为善的人。屋内寂静下来，你呼唤他们的正义感。太久太久，红色同志会一直坐视其成员引发灾祸、招致痛苦，而动机全是为了私心。太久太久，他们一直用自己敛集的力量为害人类，而非保护人类。就在你发言的时候，几个你之前见过的成员点头同意。“说的没错。”红色大衣的女孩指着几个冷笑的成员说道，“你们说自己的目标是对人类尽责，可是你们却不断容忍那些只会为恶的人。要是这个组织就是这样，那我也不想待下去了。”</p><p>艾婕一并点头：“我同意。这已经不是个正派的组织了。”她和另几个人加入了红衣女郎一边，其中还有德西。他朝你拍拍帽沿，微微眨了眨眼。</p><p>“我受够了跟在后面清理街上的渣滓。”他说着眯起了眼睛，“看来是时候清理这儿了。”屋内的沉默十分紧张，两方彼此怒视，但显然你们这边人数更多。有那么一刻，你担心自己活不过之后的混乱。</p><p>但幸运的是，他们并未开战。你的对手觉得此刻还是走为上计，小心翼翼地从屋内出去，一边嘟囔低语着恶毒的话，嘘声一片。“你们或许戴着红。”其中一人呼道，“但没有我们，你们不可能抵御即将到来的一切。你们太弱了。你们会把我们全毁了。”</p><p>艾婕从人群中走出，摇了摇头：“不。弱的是你们。清理你们，我们只会更强大。”</p><ul><li>在剧本日志中，记录下*特别小组颠覆了红色同志会*。</li></ul>",
          "theTrial4": "<p class='file'>同志会成员里一阵窃窃私语，唇枪舌剑。有人取走了你口中的东西，解去了你的束缚。尽管有人并不情愿，你还是被带到仪式桌前，有机会为自己辩护。你的眼神寻找着同志会中近距离看到你潜力的人。屋内寂静下来，你呼唤他们的理性。你已经证明自己对红色同志会提供的支援饶有价值。况且，你还有基金会的经验，可以促成两方进一步合作。你们有着一样的目标，一样的敌人——它们从彼端而来，意图消除人类存在。要想阻止这样的威胁，你们必须通力合作。就在你发言的时候，几个成员点头同意。“这，确实，没错。”马萨伊教授为你说话了，“我们被蝇头小利牵着鼻子走太久了，湮灭的威胁已经降临。”</p><p>有几人面带嫌恶，但更多的人在为你说话。“我们也未尝没接纳过更糟的人加入。”名字很多的骑士说道，“这些人已在多个方面证明了自己，我们需要一切可能的盟友。”</p><p>“同意，”索恩的声音平静如常，“这些人与其是‘敌人’，倒更不如说是‘放心的伙伴’。”索恩对上了你的眼神，微微一笑。但你知道这样的笑容下藏着的本性依然狠毒。索恩为了得到自己想要的什么都做得出，而现在想要的就是你。</p><p>跟你有过节的同志会成员严词拒绝，咒骂叫嚷，但他们明显只是一小撮。屋内的沉默十分紧张，两方彼此怒视。有那么一刻，你还担心这里会大打出手。“你兴许能戴上红。”其中一人呼道，“但你永远成不了我们中的一员。”</p><p>“要是你不想再在组织里待了。”马萨伊教授声明，“你知道门在哪里。”这群你的人怀恨在心，闷坐不响。议程继续。骑士唤你上前，为你的加入举行了一场漫长严肃的仪式。“吾等为红系，”他郑重地诵道，“因红吾为一。吾亲吾识俱红中。”他让你放弃自己的过去，拥抱新生，这一切都是为了人类的进步和启蒙。你回想此生，想到领你至此的种种，想到你珍视的一切，想到你抛下的许多。你默然接受。</p><ul><li>每位调查员选择自己插画上的一件服饰，密教玄仪将你的钥匙与这件凡俗之物绑定起来。它的颜色至此变为猩红，直到永远。</li><li>在剧本日志中，记录下*特别小组加入了红色同志会*。</li></ul>",
          "theTrial5": "<p class='file'>同志会成员里一阵窃窃私语，唇枪舌剑。有人取走了你口中的东西，解去了你的束缚。尽管有人并不情愿，你还是被带到仪式桌。议会向你陈述，告诉你的罪行已经宽恕，只要你立誓不再干扰他们的任务。你别无选择，只能同意。跟你有过节的同志会成员坚决抗议，但他们明显只是一小撮。</p><ul><li>在剧本日志中，记录下*红色同志会饶恕了特别小组*。</li></ul>",
          "theTrial6": "<p class='file'>就在下一个成员发言之前，从戴红手套的男子背后冒出一个身影，一个小小的、鸟类的东西抵在了前者的脑门后面。你耳边一阵炸响，枪声在屋内响起。男子的脸没有炸开，反而涌出一阵扭曲的气雾，盖过了他已经空洞的身体。你看到一个无数触手的螺旋虚影，仿佛是这个异星存在将一整个星系所有的现实空间都环绕着吸入自己。而戴红手套的男子先前穿着的衣服已经在地上裂成碎片，空无一物。</p><p>同志会其余的成员都抽出了自己的武器，攻击这个实体。但它迅速地溜出房间，在众目睽睽之下重组了自己的虚影。有几件事同时发生：先前形体的盛装已经瘫软在地上，空无一物；而阴影中钻出了戴红手套男子的本尊。“它们就在这儿。”他的语气平静得叫人诧异，一边还给武器重新装了弹。“就在我们之中。要是你们专心自己的任务，早就该发现了。”他给你一个会心的眼神，悄悄挤出了一个顽劣的笑容。“我能回到这里，多亏了‘受控’的这些人。要是没有他们，你们全都死了。审判结束了。”再没有人敢多争论。</p><p>有人取走了你口中的东西，解去了你的束缚。你被带到仪式桌前，站在男人身边。“它们是为了什么？你去哪儿了？”同志会中有人问道。</p><P>“它们想要我们的整个世界。兴许是每一个世界。”他说着拉紧了自己的红手套。“但现在，我们反击的机会来了。跟着它们，前往老巢，就可以一劳永逸地解决这个威胁。”周围的人群不停点头，响起阵阵认可的低语。</p><ul><li>在剧本日志中，记录下*红色同志会饶恕了特别小组*。</li><li>进入_冒险设置(版本三)_。</li></ul>",
          "theTrial7": "<p class='file'>下一个成员正准备说话，戴红手套的男子伸出手来——他的手变得如此之长，仿佛是异界物质形成的长线——惊人的力量抓住了此人头骨。头骨在他手中粉碎，染得手套更是一片猩红。尸体瘫倒在地，混乱随之爆发。</p><p>你恐惧地看着越来越多的同志会成员扭曲变形，伏击周围的人，留下一片惨象。屋内顿时一片惨叫，刀剑纷飞，枪林弹雨。每个遇害的议会成员都被完全抹除了。你的看守也从现实中被抹去了，顺道还将你掀翻在地。混战继续，你在地上匍匐前进，终于找到一片碎玻璃解开了自己的束缚。你刚站起身，救出自己的同伴，那些实体都已不见。你最后只瞥见戴红手套的男子拉长失形的残骸从你来的门溜走了。</p><p>你评估现场受损的情况。但出乎意料的是，其实并没有多少可看的。只有几件被人落下、遗忘的红色配饰。除此之外，屋内一无所有。</p><p>你惊恐地发现，自己居然完全想不起他们的名字或是绰号。一个也不例外。</p><ul><li>在剧本日志中，记录下*红色同志会由内部被毁*。</li><li>进入_冒险设置(版本三)_。</li></ul>",
          "theTrial8": "<p class='file'>审判结束，议会终于开始谈论别的事项。“还有关于域外来客的事情。”同志会的一员宣称，“我们已经集结力量，以备不测。但我们怎么确定自己的维度会受它们关注呢？我们不能指望会理解这些抽象的存在。”</p><p>你插了句嘴，告诉议会你游历期间所见的一切，还有你在基金会干的活：全球各地奇异的失踪事件只会越来越频繁，你有理由相信它们有智能、心怀恶意——而非盲目痴愚、不可理解。更有甚者，它们和其他人一样，也在追猎钥匙。</p><p>“要是它们蠢蠢欲动，准备开战，”另一个同志会的成员说道，“那我们也得这么干。我们这里的人拥有组织发现的最为强大的神器。让我们将其用于正途，一劳永逸地解决这个威胁。”周围的人群不停点头，响起阵阵认可的低语。</p><p>“但要是真如我们的新朋友所说，这些东西是智能的存在，它们又怎么可能如此了解我们的内部运作？”有人提出质疑。你脑海中闪过一个恐怖的直觉。你环顾屋内，发现议会中有一人不见了。其余人跟随你的眼神，还有几个站了起来，更加仔细地搜查房间。其中一个举起一只红手套，证实了你的怀疑。这只手套被人落下，遗忘，仿佛一文不值。</p><p>朱红头巾的女士第一个明白你的思路。“散开。”她的叫声在颤抖，“找到他。找到他去哪儿了。做好准备，一切都有可能。”</p><p>你们没多久就发现他逃走的路线——一道多维能量的次元门闪闪发光，其中惊骇的力量正在衰退。“它要关上了。”另有人指出。确实，次元门一边稳定地旋转，一边也在收缩，很快就要消失了。“我们没多少时间了。”</p><ul><li>进入_冒险设置(版本二)_。</li></ul>"
        },
        "version1": {
          "setup": {
            "title": "冒险设置(版本一)",
            "gatherSets": "收齐以下遭遇组的所有卡牌：*钥匙议会*、*红色同志会*、*猩红巫术*、*空间异常*、*腐败扩散*、*上锁的门*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/congress-of-the-keys.png'><img src='{setImgPath}/red-coterie.png'><img src='{setImgPath}/scarlet-sorcery.png'><img src='{setImgPath}/spatial-anomaly.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/locked-doors.png'></section>",
            "placeLocations": "将_巢穴_版本的猩红走廊和三张同志会圣所地点放置入场。",
            "removeSanctum": "将这些地点的_圣堂_版本从游戏中移除。",
            "startAt": "每位调查员从猩红走廊开始游戏。",
            "actDeck": "仅使用场景1a“秘密与谎言(版本一)”创建场景牌库。将其他版本的每张场景1a从游戏中移除。",
            "yea": "找出*红色同志会*遭遇组中所有投票“赞成”的_同志会_敌人，以及戴红手套的男子。该遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section>",
            "doNotGatherNay": "不要收齐此组中任何投票“反对”、弃权或诡异地沉默着*(戴红手套的男子不算在内)*的_同志会_敌人。",
            "theRedGlovedMan": "调查员队长将戴红手套的男子生成在阴影中，并结算其*(由场景1a获得的)*隐匿关键词。",
            "drawCoterie": "混洗收齐的剩余_同志会_敌人。按玩家顺序，除调查员队长外的每位调查员依次抽取其中1张，如常生成。",
            "shuffleRemainingCoterie": "将收齐的剩余(未在上一步骤中抽取)的_同志会_敌人混洗入遭遇牌库。",
            "yeaNote": "*注意下列角色可能投票“赞成”，但在本遭遇组中没有其敌人卡牌：特瓦耶·马萨伊、阿巴冉·阿里戈利阿伽科、拉辛·法瑞。*",
            "nay": "找出每个投票“反对”的同志会成员的_同谋_剧情支援版本，放置入场，由任意调查员控制。",
            "nayNote": "*注意特瓦耶·马萨伊可能投票“反对”，但并没有_同谋_剧情支援。*",
            "setOutOfPlay": "将钥匙议会遭遇组的三张_异界_地点和拟态克星敌人放在一边，位于场外。",
            "secondEncounterDeck": "现在如下创建第二个遭遇牌库。收齐以下遭遇组的所有卡牌：*域外使徒*、*彼界彼端*、*域外来客*、*秘密战争*、*远古恶魔*、*恐惧打击*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/beyond-the-beyond.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/secret-war.png'><img src='{setImgPath}/ancient-evils.png'><img src='{setImgPath}/striking-fear.png'></section>在收齐*恐惧打击*遭遇组时，只收齐下列卡牌(2张呆若木鸡和2张刺耳之声)。不要收齐此组中3张腐烂的尸体。",
            "otherworldDeck": "找出*彼界彼端*遭遇组中所有九张残骸之城地点。将这些地点混洗，未揭示面朝上，形成一个牌库。这个牌库就是异界牌库。将这个牌库放在冒险参考卡牌旁。",
            "shuffleRemainder": "将这些收齐的遭遇组中剩下的遭遇卡牌一起混洗，组成第二个遭遇牌库。目前将这个牌库放在一边，位于场外。",
            "decoys": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：残骸之城(左、中、右)、拟态克星、戴红手套的男子。将这些卡牌放在一边，位于场外。",
            "locationAdjacency": "在进行本场冒险前，确保已经阅读(或复习过)“域外之地的地点相邻关系”和“阴影中的地点”规则。"
          }
        },
        "version2": {
          "setup": {
            "title": "冒险设置(版本二)",
            "gatherSets": "收齐以下遭遇组的所有卡牌：*钥匙议会*、*域外使徒*、*彼界彼端*、*域外来客*、*红色同志会*、*秘密战争*、*腐败扩散*、*远古恶魔*、*恐惧打击*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/congress-of-the-keys.png'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/beyond-the-beyond.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/red-coterie.png'><img src='{setImgPath}/secret-war.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/ancient-evils.png'><img src='{setImgPath}/striking-fear.png'></section>在收齐*恐惧打击*遭遇组时，只收齐下列卡牌(2张呆若木鸡和2张刺耳之声)。不要收齐此组中3张腐烂的尸体。",
            "otherworldDeck": "找出*彼界彼端*遭遇组中所有九张残骸之城地点。将这些地点混洗，未揭示面朝上，形成一个牌库。这个牌库就是异界牌库。将这个牌库放在冒险参考卡牌旁。",
            "placeLocations": "将_圣堂_版本的猩红走廊和三张同志会圣所地点放置入场。",
            "removeLair": "将这些地点的_巢穴_版本从游戏中移除。",
            "startAt": "每位调查员从猩红走廊开始游戏。",
            "actDeck": "仅使用场景1a“秘密与谎言(版本二)”创建场景牌库。将其他版本的每张场景1a从游戏中移除。",
            "yea": "找出*红色同志会*遭遇组中所有投票“赞成”的_同志会_敌人，以及戴红手套的男子。将所有这些敌人放在一边，位于场外。该遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section>",
            "removeOtherCoterie": "将所有其他_同志会_敌人移出游戏。",
            "yeaNote": "*注意下列角色可能投票“赞成”，但在本遭遇组中没有其敌人卡牌：特瓦耶·马萨伊、阿巴冉·阿里戈利阿伽科、拉辛·法瑞。*",
            "nay": "找出每个投票“反对”的同志会成员的_同谋_剧情支援版本，放置入场，由任意调查员控制。",
            "nayNote": "*注意特瓦耶·马萨伊可能投票“反对”，但并没有_同谋_剧情支援。*",
            "setOutOfPlay": "将*钥匙议会*遭遇组的三张_异界_地点和拟态克星敌人放在一边，位于场外。",
            "decoys": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：残骸之城(左、中、右)、拟态克星。将这些卡牌放在一边，位于场外。",
            "locationAdjacency": "在进行本场冒险前，确保已经阅读(或复习过)“域外之地的地点相邻关系”和“阴影中的地点”规则。"
          }
        },
        "version3": {
          "setup": {
            "title": "冒险设置(版本三)",
            "gatherSets": "收齐以下遭遇组的所有卡牌：*钥匙议会*、*域外使徒*、*彼界彼端*、*域外来客*、*红色同志会*、*秘密战争*、*腐败扩散*、*远古恶魔*、*恐惧打击*。这些遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/congress-of-the-keys.png'><img src='{setImgPath}/agents-of-the-outside.png'><img src='{setImgPath}/beyond-the-beyond.png'><img src='{setImgPath}/outsiders.png'><img src='{setImgPath}/red-coterie.png'><img src='{setImgPath}/secret-war.png'><img src='{setImgPath}/spreading-corruption.png'><img src='{setImgPath}/ancient-evils.png'><img src='{setImgPath}/striking-fear.png'></section>在收齐*恐惧打击*遭遇组时，只收齐下列卡牌(2张呆若木鸡和2张刺耳之声)。不要收齐此组中3张腐烂的尸体。",
            "otherworldDeck": "找出*彼界彼端*遭遇组中所有九张残骸之城地点。将这些地点混洗，未揭示面朝上，形成一个牌库。这个牌库就是异界牌库。将这个牌库放在冒险参考卡牌旁。",
            "placeLocations": "将_圣堂_版本的猩红走廊和三张同志会圣所地点放置入场。",
            "removeLair": "将这些地点的_巢穴_版本从游戏中移除。",
            "startAt": "每位调查员从猩红走廊开始游戏。",
            "actDeck": "仅使用场景1a“秘密与谎言(版本三)”形成场景牌堆。从游戏中移除其他版本的场景1a。",
            "eerilySilent": "找出*红色同志会*遭遇组中所有诡异地沉默着的_同志会_敌人。该遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section>",
            "doNotGatherRest": "不要收齐此组中任何投票“赞成”、“反对”或弃权的_同志会_敌人。",
            "theRedGlovedMan": "调查员队长将戴红手套的男子生成在阴影中，并结算其*(由场景1a获得的)*隐匿关键词。",
            "drawCoterie": "混洗收齐的剩余_同志会_敌人。按玩家顺序，除调查员队长外的每位调查员依次抽取其中1张，如常生成。",
            "shuffleRemainingCoterie": "将收齐的剩余(未在上一步骤中抽取的)_同志会_敌人混洗入遭遇牌库。",
            "theRedCoterieSparedTheCell": "检查剧本日志。如果*红色同志会饶恕了特别小组*，找出戴红手套的男子，以及所有未在上一步骤期间收齐的同志会其他成员的_同谋_剧情支援版本。将他们全员放置入场，由任意调查员控制。",
            "ignoreUnique": "在本场冒险的剩余时间内，忽略两个版本的戴红手套的男子的独特符号。*(如果戴红手套的男子拥有任何钥匙，则只附属到他的敌人版本。)*",
            "conspiratorNote": "注意：可能出现的_同谋_剧情支援如下：暗红骑士、艾婕·萨辛、索思、艾里奇·佐尼·奥佩勒曲亚、德西德柔·戴佳多·欧瓦瑞兹、红衣女郎、戴红手套的男子。",
            "setOutOfPlay": "将*钥匙议会*遭遇组的三张_异界_地点和拟态克星敌人放在一边，位于场外。",
            "decoys": "收齐每张诱饵迷你卡牌和下列每张迷你卡牌：残骸之城(左、中、右)、拟态克星、戴红手套的男子。将这些卡牌放在一边，位于场外。",
            "locationAdjacency": "在进行本场冒险前，确保已经阅读(或复习过)“域外之地的地点相邻关系”和“阴影中的地点”规则。"
          }
        },
        "resolutions": {
          "xp": {
            "bonus": "拯救了自己的维度，使其免遭可怕的厄运"
          },
          "defeated": {
            "title": "调查员被击败",
            "body": "<p class='basic'>_在结算其他任何结局前，如果有调查员被击败：_被击败的调查员首先阅读_调查员被击败_。</p><p>_调查员被击败：_再无维度供你的身体留存，你每分每寸都被撕碎殆尽。你的记忆和思想已经落入无尽的湮灭，万劫不复。但你的意识居然还在。陷入虚无的永恒囚笼。</p><ul><li>每位被击败的调查员_发疯_，从此音讯全无。有关这些调查员的所有记忆都从现实中清除。</li><li>如果未达成任何结局(每位调查员被击败)：前往_结局2_。</li></ul>"
          },
          "resolution1": {
            "title": "结局1",
            "body": "<p>_结局1*(每位被击败的调查员必须先结算调查员被击败)*：_你落在坚实的地面，但在不同世界之间被拽来拽去的感觉可没那么容易消散。尽管你疲惫的身体已经抗议，但你还是挣扎着站了起来，环顾四周，准备应对一切情况。但等你意识到自己在哪里，你震惊地发现……</p><ul><li>将世界地图在平面上展开。每位调查员抛一枚硬币或混乱标记，落在地图上。落在的地方就是该调查员剧本结束位置。(如果落在海洋上，则是偶然落在船只上。)</li></ul><p>你花了几周时间才联系上自己的特别小组在域外来客世界崩解中幸存的其他成员。看来它们的阴谋已经瓦解，至少现在是的。也许该安排长假休假了，但还有一件事要先处理……</p><ul><li>在剧本日志中，记录下*域外来客遭到阻止*。</li><li>每位调查员承受2点肉体创伤和2点精神创伤，因为其从未真正从超维之劫中恢复过来。</li><li>每位调查员取得经验值，数量等于胜利区所有卡牌的胜利X数值之和。每位调查员取得5点奖励经验值，因为其拯救了自己的维度，使其免遭可怕的厄运。</li><li>_调查员剧本胜利！_</li><li>进入_尾声_。</li></ul>"
          },
          "resolution2": {
            "title": "结局2",
            "body": "<p>_结局2*(每位被击败的调查员应先结算调查员被击败)*：_“这就是最后的了。”哈德逊特工说着在费用报告上签了字。“我理解需要保密，但我还是要再次请求雇佣更多的助手完成秘书工作，专员。”他将文件交给坐在深黑书桌后面，表情一脸凝重的泰勒。</p><p>“人越多就越容易泄密。我们节制人手不是平白无故的，哈德逊。别忘了重要的事情。”她翻了一会儿文件，皱起了眉头。“关于支援32-J的特别小组的报告呢？”</p><p>“‘32-J’？”男子从口袋里掏出一本小小的笔记，翻到中间一页。“没有这样的代号。”</p><p>泰勒撇撇嘴：“不，有的，就是……我们在伦敦遇到的。你在那儿呢……”过了一会儿，她摇摇头，疑惑极了。“唔，怪了，我不记得他们是谁了。”</p><p>“您工作太辛苦了。”特工微笑着回道，“休息休息，专员。您休假一周我们也能把事情办好的。”</p><ul><li>在剧本日志中，记录下*特别小组成为空洞*。</li><li>_调查员剧本失败_。</li></ul>"
          }
        }
      },
      "chineseGaps": [],
      "status": "generated",
      "chinese": "reference-zh",
      "summary": {
        "total": 137,
        "missing": 0,
        "untranslated": 0,
        "present": 137,
        "specialRules": 0
      }
    }
  },
  "keys": {
    "specialRules": {
      "en": [
        {
          "title": "New Cardtype: Keys",
          "body": "<p class='basic'>The Scarlet Keys campaign features a new cardtype: keys. Keys are powerful artifacts that may be “shifted” to either aid or hinder investigators, depending on whom they are attached to and whether their Stable or Unstable side is faceup.</p><ul><li>During the resolution of a scenario, a key may become bound to a single bearer, whose name is marked in the Campaign Log. A key may be bound to an investigator, a story asset, or an enemy.</li><li>A key always enters play attached to its bearer (as marked in the Campaign Log). At the start of each scenario, each investigator who is the bearer of 1 or more keys attaches those keys to their investigator card. Whenever a story asset or enemy enters play, if it is the bearer of 1 or more keys, those keys also enter play attached to their bearer.<ul><li>If a key’s bearer is an investigator or a story asset, it enters play Stable side faceup.</li><li>If a key’s bearer is an enemy, it enters play Unstable side faceup.</li></ul></li><li>A key cannot leave play unless its bearer leaves play. If the bearer of 1 or more keys leaves play, each key they control is set aside, out of play. (Those keys do, however, remain bound to their bearer for future scenarios unless explicitly noted otherwise.)</li><li>While a key is attached to an investigator, that investigator may trigger its shift ability during any player window as a {'{'}fast{'}'} ability. This is called “shifting” the key. As part of this ability’s resolution, it will instruct the investigator to flip the key to its other side, so its other shift ability is active. The investigator will then have to perform the shift ability on its Unstable side in order to flip it back over again.<ul><li>While a key is attached to a story asset, it may be shifted by any investigator who controls that asset in the same way.</li><li>Each key (by title) attached to an investigator or story asset can only be shifted once per round.</li></ul></li><li>While a key is under an enemy’s control, its shift ability only resolves when a card or game effect instructs an investigator to shift that key, after which it remains Unstable side faceup.<ul><li>A key attached to an enemy cannot be flipped to its Stable side.</li><li>There is no limit to the number of times a key attached to an enemy can be shifted.</li></ul></li><li>Some card effects may directly flip a key attached to an investigator or story asset from its Stable side to its Unstable side, or vice versa. This is not the same as shifting a key, and does not resolve its shift ability.</li></ul>"
        },
        {
          "title": "The Red-Gloved Man",
          "body": "<p class='basic'>During The Scarlet Keys campaign, investigators will confront a number of dangerous and mysterious members of the secret society known as the Red Coterie. One such member is the iconic Red-Gloved Man. As a result, while playing The Scarlet Keys campaign, investigators cannot purchase or include The Red-Gloved Man asset (The Dunwich Legacy card #310) in their decks.</p>"
        },
        {
          "title": "Concealed X",
          "body": "<p class='basic'>Concealed X is a keyword that appears on some enemy cards in The Scarlet Keys campaign. Concealed enemies represent hidden enemies whose true location is a mystery until the investigators work to expose where—and in some cases, who—they truly are.</p><p class='basic'>When a scenario includes one or more concealed enemies, investigators are instructed to set aside several concealed mini-cards. These mini-cards are double-sided. The facedown side represents the possible location of a concealed enemy. The revealed side reveals the mini-card’s true nature—an enemy’s true location, or simply a decoy. An enemy’s mini-card marks the location of an enemy in the shadows. A decoy marks the location of nothing of consequence—a harmless bystander, or perhaps just a trick of the light.</p><p class='basic'>When an investigator draws an enemy with the concealed X keyword (or is instructed to resolve an enemy’s concealed keyword), they spawn that enemy into a game area above the agenda deck, not at any location. This area is called “the shadows,” and represents enemies the investigators know exist somewhere on the map, but are unsure where. Then, that investigator takes the set-aside concealed mini-card that matches that enemy, along with X decoys (where X is defined by that enemy’s concealed X value), shuffles them facedown, and puts them into play distributed as evenly as possible among each location in play, starting with the locations nearest to them. Then, at each of those locations that already had 1 or more concealed mini-cards, they shuffle each of them facedown as well.</p><p>*For example: Amina draws Coterie Agent (A), which has “concealed 2.” She first spawns the Coterie Agent into the shadows. Then, she takes the set-aside Coterie Agent (A) mini-card, along with 2 decoys, shuffles them facedown, and places one at each of the three locations nearest to her. Then, if any of those locations already had 1 or more concealed mini-cards, she would shuffle each concealed mini-card at those locations, as well.*</p><p class='basic'>Enemies in the shadows observe the following additional rules:</p><ul><li>Enemies in the shadows are considered to be in play, but not at any particular location. They cannot move until they leave the shadows.</li><li>Enemies in the shadows can qualify as the “nearest” enemy, but only if there are no other enemies in play at any location.</li><li>Enemies in the shadows cannot be damaged or leave play via player card effects.</li></ul>"
        },
        {
          "title": "Concealed Mini-Cards",
          "body": "<p class='basic'>While in play, concealed mini-cards represent the possible location of an enemy in the shadows. In order to deal with such an enemy, its true location must first be discovered by exposing its mini-card. This can be done via one of three methods: fighting, evading, or investigating.</p><ul><li>Concealed mini-cards are not enemies and cannot be engaged like enemies. However, any investigator at the same location as a concealed mini-card may attempt to expose it by successfully attacking it or evading it (as if it were an engaged enemy), or by successfully investigating its location. The difficulty to successfully attack or evade a concealed mini-card is equal to the shroud value of its location.<ul><li>An investigator may also use a card effect that automatically evades an enemy, deals damage to an enemy, or discovers a clue at a location in order to instead expose a concealed mini-card.</li></ul></li><li>If an investigator chooses to expose a concealed mini-card, that effect replaces the standard effects of the action or ability that exposed it. (i.e., if an enemy’s mini-card is exposed by evasion or damage, the matching enemy is not evaded, nor does it take damage. If a mini-card is exposed by discovering clues or investigating, no clues are discovered.)</li><li>If a concealed mini-card is exposed (via any of the above methods), flip it to its revealed side.<ul><li>If it is a decoy, set it aside, out of play, with no effect.</li><li>If it is an enemy’s mini-card, that enemy is now exposed. Place the matching enemy in the shadows at that mini-card’s location, then set that mini-card aside, out of play. (That enemy is no longer in the shadows, and is now at the location where its mini-card was located). Then, if there are no other enemies in the shadows, set all remaining concealed mini-cards in play aside, out of play.</li></ul></li><li>Only one concealed mini-card may be exposed per effect unless explicitly stated. (i.e., an effect that deals 3 damage to each enemy at a location does not expose all concealed mini-cards at that location; only one.)</li></ul><p>*For example: There is a Coterie Agent and a Coterie Assassin in the shadows. There is a concealed mini-card at Kymani’s location and another concealed mini-card at a connecting location. (1) First, Kymani plays an event that discovers a clue at their location, but instead of discovering a clue, they choose to expose the concealed mini-card at their location, flipping it over. That mini-card is a decoy, and is set aside without effect. (2) Next, they move to the connecting location with the other concealed mini-card and attempt to expose it using an evade action. They succeed and flip the mini-card over…revealing the Coterie Assassin’s mini-card! (3) The Coterie Assassin’s mini-card is set aside, and the Coterie Assassin in the shadows is moved to Kymani’s location, engaging them. Because there is another enemy in the shadows, they do not remove any of the other concealed mini-cards from play.*</p>"
        },
        {
          "title": "Alert",
          "body": "<p class='basic'>Some enemies have the alert keyword. Each time an investigator fails a skill test while attempting to evade an enemy with the alert keyword, after applying all results for that skill test, that enemy performs an attack against the evading investigator. An enemy does not exhaust after performing an alert attack. This attack occurs whether the enemy is engaged with the evading investigator or not.</p>"
        },
        {
          "title": "Patrol",
          "body": "<p class='basic'>Some enemies have the patrol keyword. During the enemy phase (in framework step 3.2), each ready, unengaged enemy with the patrol keyword moves to a connecting location along the shortest path toward the designated location (as described in parentheses next to the word patrol).</p><ul><li>If there are multiple locations that qualify as the designated location, the lead investigator may choose which location the enemy moves toward.</li><li>If an enemy with patrol would be compelled to move to a location via a path that is blocked by a card ability, the enemy does not move.</li></ul>"
        }
      ],
      "zh": [
        {
          "title": "新卡牌类型：密钥",
          "body": "《绯红密钥》战役引入了一种新的卡牌类型：密钥。密钥是强大的器物，可以通过“变换”来帮助或妨碍调查员，具体取决于它们附属于谁，以及其稳定面还是动荡面朝上。\n\n• 在剧本的结算期间，一把密钥可能会绑定到单一持有者身上，其名称会记录在剧本日志中。密钥可以绑定到一位调查员、一项剧情支援或一个敌人。\n• 密钥进入场上时，总是附属于其持有者（以剧本日志所记为准）。每个剧本开始时，持有1把或更多密钥的每位调查员都会将这些密钥附属到其调查员卡上。每当一项剧情支援或一个敌人进入场上时，如果它是1把或更多密钥的持有者，这些密钥也会附属于其持有者进入场上。\n  • 如果密钥的持有者是调查员或剧情支援，它以稳定面朝上进入场上。\n  • 如果密钥的持有者是敌人，它以动荡面朝上进入场上。\n• 除非其持有者离场，否则密钥不能离场。如果1把或更多密钥的持有者离场，其控制的每把密钥都会被放在一边，位于场外。（不过，除非另有明确说明，这些密钥在之后的剧本中仍绑定于其持有者。）\n• 当密钥附属于调查员时，该调查员可以在任意玩家窗口以 {fast} 能力触发其变换能力。这称为“变换”密钥。作为该能力结算的一部分，它会指示调查员将密钥翻至另一面，使其另一面的变换能力生效。此后，调查员必须执行其动荡面上的变换能力，才能将其翻回来。\n  • 当密钥附属于剧情支援时，控制该支援的任意调查员也可以用同样的方式变换它。\n  • 每把（按卡名区分的）附属于调查员或剧情支援的密钥每轮只能变换一次。\n• 当密钥处于敌人控制下时，只有卡牌或游戏效果指示调查员变换该密钥时，才会结算其变换能力；此后它保持动荡面朝上。\n  • 附属于敌人的密钥不能翻至稳定面。\n  • 附属于敌人的密钥可以被变换的次数没有限制。\n• 某些卡牌效果可能会直接将附属于调查员或剧情支援的密钥从稳定面翻至动荡面，或反之。这与变换密钥不同，也不会结算其变换能力。"
        },
        {
          "title": "戴红手套的男子",
          "body": "在《绯红密钥》战役期间，调查员会遭遇秘密组织“红色同志会”中诸多危险而神秘的成员。其中一位便是标志性的戴红手套的男子。因此，在进行《绯红密钥》战役时，调查员不能购买或将《戴红手套的男子》支援（《敦威治遗产》卡牌 #310）加入其牌库。"
        },
        {
          "title": "隐匿 X",
          "body": "隐匿 X 是《绯红密钥》战役中部分敌人卡牌上出现的关键词。隐匿敌人代表隐藏起来的敌人，在调查员设法揭露其真正所在——有时还有其真正身份——之前，它们的真实位置始终成谜。\n\n当一个剧本包含一个或更多隐匿敌人时，调查员会被指示将若干张隐匿迷你卡牌放在一边。这些迷你卡牌是双面的。面朝下的一面代表隐匿敌人可能存在的位置。揭示面则显示该迷你卡牌的真实性质——敌人的真实位置，或者仅仅是一个诱饵。敌人的迷你卡牌标示阴影中某个敌人的位置。诱饵标示的位置则无关紧要——也许是个无害的旁观者，也许只是光线造成的错觉。\n\n当调查员抽到一个具有隐匿 X 关键词的敌人（或被指示结算某个敌人的隐匿关键词）时，该调查员将该敌人生成到议程牌库上方的游戏区域，而不是任何地点。该区域称为“阴影”，代表调查员知道其存在于地图某处、但不确定具体位置的敌人。然后，该调查员拿取与那个敌人对应的、放在一边的隐匿迷你卡牌，连同 X 张诱饵（X 由该敌人的隐匿 X 数值决定），将它们面朝下洗混，并尽可能均匀地分配到场上的每个地点，从离自己最近的地点开始。随后，在那些已经有 1 张或更多隐匿迷你卡牌的地点，也将这些迷你卡牌各自面朝下洗混。\n\n*例如：阿米娜抽到了具有“隐匿 2”的同志会特工(A)。她先将同志会特工生成到阴影中。然后，她拿取放在一边的同志会特工(A)迷你卡牌，连同2张诱饵，将它们面朝下洗混，并在离她最近的三个地点各放置一张。接着，如果这些地点中已有1张或更多隐匿迷你卡牌，她就将那些地点的每张隐匿迷你卡牌都洗混。*\n\n阴影中的敌人遵循以下额外规则：\n\n• 阴影中的敌人视为在场上，但不位于任何特定地点。它们在离开阴影之前不能移动。\n• 阴影中的敌人可以符合“最近的”敌人这一条件，但仅当场上任何地点都没有其他敌人时才行。\n• 阴影中的敌人不能因玩家卡牌效果而受到伤害或离场。"
        },
        {
          "title": "隐匿迷你卡牌",
          "body": "隐匿迷你卡牌在场上时，代表阴影中某个敌人可能存在的位置。要对付这样的敌人，必须先通过揭露其迷你卡牌来发现它的真实位置。这可以通过三种方法之一完成：攻击、躲避或调查。\n\n• 隐匿迷你卡牌不是敌人，不能像敌人一样被交战。不过，与隐匿迷你卡牌位于同一地点的任意调查员都可以尝试揭露它：成功攻击或躲避它（如同它是一名已交战的敌人），或成功调查其所在地点。成功攻击或躲避一张隐匿迷你卡牌的难度等于其所在地点的隐蔽值。\n  • 调查员也可以使用能自动躲避敌人、对敌人造成伤害或在某地点发现线索的卡牌效果，来改为揭露一张隐匿迷你卡牌。\n• 如果调查员选择揭露一张隐匿迷你卡牌，该效果会取代用于揭露它的行动或能力的标准效果。（即：如果敌人的迷你卡牌是通过躲避或伤害揭露的，对应的敌人既不会被躲避，也不会受到伤害。如果迷你卡牌是通过发现线索或调查揭露的，则不会发现任何线索。）\n• 如果一张隐匿迷你卡牌被揭露（通过上述任一方法），将其翻至揭示面。\n  • 如果它是诱饵，将其放在一边，位于场外，不产生任何效果。\n  • 如果它是某个敌人的迷你卡牌，该敌人现在被揭露。将对应的敌人从阴影中放置到该迷你卡牌所在的地点，然后将该迷你卡牌放在一边，位于场外。（该敌人不再位于阴影中，现在位于其迷你卡牌原先所在的地点。）随后，如果阴影中不再有其他敌人，将场上所有剩余的隐匿迷你卡牌放在一边，位于场外。\n• 除非另有明确说明，每个效果只能揭露一张隐匿迷你卡牌。（即：一个对某地点每个敌人造成3点伤害的效果，不会揭露该地点的所有隐匿迷你卡牌，只会揭露一张。）\n\n*例如：阴影中有一个同志会特工和一个同志会刺客。基玛尼所在地点有一张隐匿迷你卡牌，一个相邻地点还有另一张隐匿迷你卡牌。(1) 首先，基玛尼打出一张能在其所在地点发现线索的事件卡，但选择不发现线索，改为揭露其所在地点的隐匿迷你卡牌，将其翻面。那张迷你卡牌是诱饵，被放在一边，不产生效果。(2) 接着，基玛尼移动到有另一张隐匿迷你卡牌的相邻地点，尝试用躲避行动揭露它。检定成功，翻开那张迷你卡牌……竟是同志会刺客的迷你卡牌！(3) 同志会刺客的迷你卡牌被放在一边，阴影中的同志会刺客被移动到基玛尼所在的地点，与基玛尼交战。因为阴影中还有另一个敌人，所以不会将任何其他隐匿迷你卡牌移出场外。*"
        },
        {
          "title": "警戒",
          "body": "有些敌人具有警戒关键词。每当调查员在尝试躲避具有警戒关键词的敌人时技能检定失败，在应用该次技能检定的所有结果之后，该敌人会对躲避它的调查员发动一次攻击。敌人在发动警戒攻击后不会横置。无论该敌人是否与躲避它的调查员交战，都会发生这次攻击。"
        },
        {
          "title": "巡逻",
          "body": "有些敌人具有巡逻关键词。在敌人阶段（框架步骤3.2）中，每个已重整、未交战且具有巡逻关键词的敌人，都会沿最短路径向指定地点（即“巡逻”字样旁括号中所描述的地点）移动到一个连接地点。\n\n• 如果有多个地点符合指定地点的条件，由调查员队长选择该敌人向哪个地点移动。\n• 如果具有巡逻关键词的敌人必须沿某条被卡牌能力阻断的路径移动到一个地点，则该敌人不移动。"
        }
      ],
      "chineseGaps": []
    },
    "headings": {
      "en": {
        "prologue": "Campaign Setup",
        "embark": {
          "Alexandria": "Depart from Alexandria",
          "Anchorage": "Depart from Anchorage",
          "Arkham": "Depart from Arkham",
          "Bermuda": "Depart from Bermuda",
          "BermudaTriangle": "Depart from Bermuda Triangle",
          "Bombay": "Depart from Bombay",
          "BuenosAires": "Depart from Buenos Aires",
          "Cairo": "Depart from Cairo",
          "Constantinople": "Depart from Constantinople",
          "Havana": "Depart from Havana",
          "HongKong": "Depart from Hong Kong",
          "Kabul": "Depart from Kabul",
          "Kathmandu": "Depart from Kathmandu",
          "KualaLumpur": "Depart from Kuala Lumpur",
          "Lagos": "Depart from Lagos",
          "London": "Depart from London",
          "Manokwari": "Depart from Manokwari",
          "Marrakesh": "Depart from Marrakesh",
          "MonteCarlo": "Depart from Monte Carlo",
          "Moscow": "Depart from Moscow",
          "Nairobi": "Depart from Nairobi",
          "NewOrleans": "Depart from New Orleans",
          "Perth": "Depart from Perth",
          "Quito": "Depart from Quito",
          "Reykjavik": "Depart from Reykjavik",
          "RioDeJaneiro": "Depart from Rio de Janeiro",
          "Rome": "Depart from Rome",
          "SanFrancisco": "Depart from San Francisco",
          "SanJuan": "Depart from San Juan",
          "Shanghai": "Depart from Shanghai",
          "Stockholm": "Depart from Stockholm",
          "Sydney": "Depart from Sydney",
          "Tokyo": "Depart from Tokyo",
          "Tunguska": "Depart from Tunguska",
          "Venice": "Depart from Venice",
          "YborCity": "Depart from Ybor City"
        },
        "kind": {
          "embark": "Embark"
        },
        "interludes": {
          "1": "Interlude",
          "14": "File #14–C",
          "20": "File #20–E",
          "26": "File #26–G",
          "27": "File #27–H",
          "32": "File #32–J",
          "36": "File #36–L",
          "37": "File #37–M",
          "44": "File #44–O",
          "45": "File #45–P",
          "49": "File #49–R",
          "50": "File #50–S",
          "51": "File #51–T",
          "52": "File #52–U",
          "53": "File #53–V",
          "54": "File #54–W",
          "55": "File #55–X"
        }
      },
      "zh": {
        "prologue": "剧本设置",
        "embark": {
          "Alexandria": "从亚历山大启程",
          "Anchorage": "从安克雷奇启程",
          "Arkham": "从阿卡姆启程",
          "Bermuda": "从百慕大启程",
          "BermudaTriangle": "从百慕大三角启程",
          "Bombay": "从孟买启程",
          "BuenosAires": "从布宜诺斯艾利斯启程",
          "Cairo": "从开罗启程",
          "Constantinople": "从君士坦丁堡启程",
          "Havana": "从哈瓦那启程",
          "HongKong": "从香港启程",
          "Kabul": "从坎布尔启程",
          "Kathmandu": "从加德满都启程",
          "KualaLumpur": "从吉隆坡启程",
          "Lagos": "从拉各斯启程",
          "London": "从伦敦启程",
          "Manokwari": "从马诺夸里启程",
          "Marrakesh": "从马拉喀什启程",
          "MonteCarlo": "从蒙特卡洛启程",
          "Moscow": "从莫斯科启程",
          "Nairobi": "从内罗毕启程",
          "NewOrleans": "从新奥尔良启程",
          "Perth": "从珀斯启程",
          "Quito": "从基多启程",
          "Reykjavik": "从雷克雅未克启程",
          "RioDeJaneiro": "从里约热内卢启程",
          "Rome": "从罗马启程",
          "SanFrancisco": "从旧金山启程",
          "SanJuan": "从圣胡安启程",
          "Shanghai": "从上海启程",
          "Stockholm": "从斯德哥尔摩启程",
          "Sydney": "从悉尼启程",
          "Tokyo": "从东京启程",
          "Tunguska": "从通古斯卡启程",
          "Venice": "从威尼斯启程",
          "YborCity": "从宜博市启程"
        },
        "kind": {
          "embark": "启程"
        },
        "interludes": {
          "1": "幕间故事",
          "14": "档案#14–C",
          "20": "档案#20–E",
          "26": "档案#26–G",
          "27": "档案#27–H",
          "32": "档案#32–J",
          "36": "档案#36–L",
          "37": "档案#37–M",
          "44": "档案#44–O",
          "45": "档案#45–P",
          "49": "档案#49–R",
          "50": "档案#50–S",
          "51": "档案#51–T",
          "52": "档案#52–U",
          "53": "档案#53–V",
          "54": "档案#54–W",
          "55": "档案#55–X"
        }
      },
      "chineseGaps": []
    },
    "locations": {
      "en": {
        "Alexandria": {
          "name": "Alexandria",
          "subtitle": "File #38-N"
        },
        "Anchorage": {
          "name": "Anchorage",
          "subtitle": "File #33-K"
        },
        "Arkham": {
          "name": "Arkham"
        },
        "Bermuda": {
          "name": "Bermuda",
          "subtitle": "File #20-E"
        },
        "BermudaTriangle": {
          "name": "Bermuda Triangle"
        },
        "Bombay": {
          "name": "Bombay",
          "subtitle": "File #36-L"
        },
        "BuenosAires": {
          "name": "Buenos Aires",
          "subtitle": "File #16-D"
        },
        "Cairo": {
          "name": "Cairo"
        },
        "Constantinople": {
          "name": "Constantinople",
          "subtitle": "File #21-F"
        },
        "Havana": {
          "name": "Havana",
          "subtitle": "File #28-I"
        },
        "HongKong": {
          "name": "Hong Kong"
        },
        "Kabul": {
          "name": "Kabul",
          "subtitle": "File #14-C"
        },
        "Kathmandu": {
          "name": "Kathmandu",
          "subtitle": "File #53-V"
        },
        "KualaLumpur": {
          "name": "Kuala Lumpur"
        },
        "Lagos": {
          "name": "Lagos",
          "subtitle": "File #37-M"
        },
        "London": {
          "name": "London"
        },
        "Manokwari": {
          "name": "Manokwari"
        },
        "Marrakesh": {
          "name": "Marrakesh",
          "subtitle": "File #11-B"
        },
        "MonteCarlo": {
          "name": "Monte Carlo"
        },
        "Moscow": {
          "name": "Moscow",
          "subtitle": "File #26-G"
        },
        "Nairobi": {
          "name": "Nairobi",
          "subtitle": "File #54-W"
        },
        "NewOrleans": {
          "name": "New Orleans"
        },
        "Perth": {
          "name": "Perth",
          "subtitle": "File #55-X"
        },
        "Quito": {
          "name": "Quito",
          "subtitle": "File #14-C"
        },
        "Reykjavik": {
          "name": "Reykjavik",
          "subtitle": "File #14-C"
        },
        "RioDeJaneiro": {
          "name": "Rio de Janeiro",
          "subtitle": "File #44-O"
        },
        "Rome": {
          "name": "Rome",
          "subtitle": "File #51-T"
        },
        "SanFrancisco": {
          "name": "San Francisco",
          "subtitle": "File #26-G"
        },
        "SanJuan": {
          "name": "San Juan",
          "subtitle": "File #14-C"
        },
        "Shanghai": {
          "name": "Shanghai",
          "subtitle": "File #32-J"
        },
        "Stockholm": {
          "name": "Stockholm",
          "subtitle": "File #36-L"
        },
        "Sydney": {
          "name": "Sydney",
          "subtitle": "File #49-R"
        },
        "Tokyo": {
          "name": "Tokyo",
          "subtitle": "File #37-M"
        },
        "Tunguska": {
          "name": "Tunguska"
        },
        "Venice": {
          "name": "Venice"
        },
        "YborCity": {
          "name": "Ybor City",
          "subtitle": "File #52-U"
        }
      },
      "zh": {
        "Alexandria": {
          "name": "亚历山大",
          "subtitle": "档案#38-N"
        },
        "Anchorage": {
          "name": "安克雷奇",
          "subtitle": "档案#33-K"
        },
        "Arkham": {
          "name": "阿卡姆"
        },
        "Bermuda": {
          "name": "百慕大",
          "subtitle": "档案#20-E"
        },
        "BermudaTriangle": {
          "name": "百慕大三角"
        },
        "Bombay": {
          "name": "孟买",
          "subtitle": "档案#36-L"
        },
        "BuenosAires": {
          "name": "布宜诺斯艾利斯",
          "subtitle": "档案#16-D"
        },
        "Cairo": {
          "name": "开罗"
        },
        "Constantinople": {
          "name": "君士坦丁堡",
          "subtitle": "档案#21-F"
        },
        "Havana": {
          "name": "哈瓦那",
          "subtitle": "档案#28-I"
        },
        "HongKong": {
          "name": "香港"
        },
        "Kabul": {
          "name": "坎布尔",
          "subtitle": "档案#14-C"
        },
        "Kathmandu": {
          "name": "加德满都",
          "subtitle": "档案#53-V"
        },
        "KualaLumpur": {
          "name": "吉隆坡"
        },
        "Lagos": {
          "name": "拉各斯",
          "subtitle": "档案#37-M"
        },
        "London": {
          "name": "伦敦"
        },
        "Manokwari": {
          "name": "马诺夸里"
        },
        "Marrakesh": {
          "name": "马拉喀什",
          "subtitle": "档案#11-B"
        },
        "MonteCarlo": {
          "name": "蒙特卡洛"
        },
        "Moscow": {
          "name": "莫斯科",
          "subtitle": "档案#26-G"
        },
        "Nairobi": {
          "name": "内罗毕",
          "subtitle": "档案#54-W"
        },
        "NewOrleans": {
          "name": "新奥尔良"
        },
        "Perth": {
          "name": "珀斯",
          "subtitle": "档案#55-X"
        },
        "Quito": {
          "name": "基多",
          "subtitle": "档案#14-C"
        },
        "Reykjavik": {
          "name": "雷克雅未克",
          "subtitle": "档案#14-C"
        },
        "RioDeJaneiro": {
          "name": "里约热内卢",
          "subtitle": "档案#44-O"
        },
        "Rome": {
          "name": "罗马",
          "subtitle": "档案#51-T"
        },
        "SanFrancisco": {
          "name": "旧金山",
          "subtitle": "档案#26-G"
        },
        "SanJuan": {
          "name": "圣胡安",
          "subtitle": "档案#14-C"
        },
        "Shanghai": {
          "name": "上海",
          "subtitle": "档案#32-J"
        },
        "Stockholm": {
          "name": "斯德哥尔摩",
          "subtitle": "档案#36-L"
        },
        "Sydney": {
          "name": "悉尼",
          "subtitle": "档案#49-R"
        },
        "Tokyo": {
          "name": "东京",
          "subtitle": "档案#37-M"
        },
        "Tunguska": {
          "name": "通古斯卡"
        },
        "Venice": {
          "name": "威尼斯"
        },
        "YborCity": {
          "name": "宜博市",
          "subtitle": "档案#52-U"
        }
      },
      "chineseGaps": []
    },
    "interludes": {
      "en": {
        "1": "The Foundation",
        "14": "Ruses and Reclamation",
        "20": "The Great Work",
        "26": "Quid Pro Quo",
        "27": "Dead and Gone",
        "32": "The Coiled Serpent",
        "36": "Strange Architecture",
        "37": "Special Delivery",
        "44": "Theory of Annihilation",
        "45": "Metamorphosis",
        "49": "Ringing Hollow",
        "50": "Blood, Sweat, and Tea",
        "51": "Romulus and Remus",
        "52": "The Safehouse",
        "53": "Whistle On the Wind",
        "54": "Infernal Machinery",
        "55": "Paranatural Selection"
      },
      "zh": {
        "1": "基金会",
        "14": "拨乱反正",
        "20": "宏伟大业",
        "26": "交换条件",
        "27": "逝者如斯",
        "32": "衔尾蛇",
        "36": "奇异建筑",
        "37": "特快专递",
        "44": "灭绝理论",
        "45": "变形记",
        "49": "环环成空",
        "50": "鲜血，汗水，和茶叶",
        "51": "罗慕路斯与雷穆斯",
        "52": "藏匿之地",
        "53": "风中孤哨",
        "54": "地狱装置",
        "55": "超自然选择"
      },
      "chineseGaps": []
    },
    "statusReport": {
      "en": {
        "title": "Status Report",
        "alpha": "<div class='red bordered'><p class='basic'>_Status Report Alpha (α):_</p><p>As your travels continue, the Foundation receives more and more reports of strange disappearances. With each new dossier you read, you worry that it is only a matter of time before there is nothing left.</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p></div>",
        "beta": "<div class='red bordered'><p class='basic'>_Status Report Beta (β):_</p><p>You receive a coded missive from Commissioner Taylor herself: “Agents—not long ago, a massive explosion occurred near the Podkamennaya Tunguska River in Siberia. It is classified as an impact event, but this is just a cover story. Our intel now indicates Coterie involvement. I have reason to believe this may be the site of one of their sanctums. Perhaps even their primary safehouse. You have clearance to investigate the site, but be prepared for anything.”</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p><p class='basic right'>In the Central Asia section of the Campaign Log, find Tunguska. In its spot, write “59–Z.” You are now allowed to travel to this location whenever you embark. (*Note: This will end the campaign. You may wish to investigate further before proceeding to Tunguska… but be wary of how much time you spend.*)</p></div>",
        "epsilon": "<div class='red bordered'><p class='basic'>_Status Report Epsilon (ε):_</p><p>As you traverse the streets, you flinch at every shifting shadow and every passerby wearing red. You’re definitely being followed, and you have no lack of enemies who might fit the bill…</p><p class='basic'>For the remainder of the campaign, whenever you are setting up a scenario, perform the following: gather each of the enemies in the Red Coterie encounter set whose name matches those who you *“haven’t seen the last of”* in your Campaign Log, choose one at random, and shuffle it into the encounter deck for this scenario. The *Red Coterie* encounter set is indicated by the following encounter set icon.<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section></p></div>",
        "gamma": "<div class='red bordered'><p class='basic'>_Status Report Gamma (γ):_</p><p>The reports continue. Now it’s not just missing people, but people returning, having changed. Buildings and objects, too—replicated, but different, off, like they had been completely dismantled and then reassembled. But why?</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p><p class='basic right'>Each investigator must add 1 copy of the Paradimensional Understanding weakness to their deck. It does not count toward their deck size. These cards can be found in the Globetrotting encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></p></div>",
        "zeta": "<div class='red bordered'><p class='basic'>_Status Report Zeta (ζ):_</p><p>You return to your hotel after a long day of travel and investigation, only to find your room in shambles. A grim feeling sprouts in your gut. Someone has clearly turned your room upside-down in search of something, and you’re pretty sure you know what. You rush to the safe where you have been storing the paradimensional artifacts you aren’t carrying on your person. To your horror, it is empty, apart from a single red card. Reaching out to Foundation contacts, you believe you have tracked the culprit to one of four likely Coterie sanctums. Perhaps if you’re quick, you can recover what was stolen from you.</p><p class='basic right'>Check the Keys section of the Campaign Log and find each of the Keys whose bearer is an investigator. Choose 1 at random (2 instead if the investigators control 5 or more Keys in total). That Key(s) has been stolen.</p><p class='basic right'>Gather each of the enemies in the Red Coterie encounter set whose name matches those who you “haven’t seen the last of ” in your Campaign Log and choose one at random. This is the identity of the character who stole your Key(s).</p><p class='basic right'>Update the Keys section of your Campaign Log such that the bearer of the Key(s) that were stolen is the randomly chosen enemy.</p><p class='basic right'>In the Central Asia, Americas, and North Atlantic sections of the Campaign Log, find Kabul, Quito, San Juan, and Reykjavik In each of these spots, write “14–C.” You are now allowed to travel to these locations whenever you embark.</p></div>",
        "theta": "<div class='red bordered'><p class='basic'>_Status Report Theta (θ):_</p><p>As you head to your hotel room, you spot a red envelope slipped under your door. Inside is a simple message: “My people in Ybor City know about the new passphrase and know you’re coming. Drop by when you get the chance.” It’s signed “Desi.”</p></div>",
        "psi": "<div class='red bordered'><p class='basic'>_Status Report Psi (ψ):_</p><p>As you return to your hotel, the concierge waves you down and hands you a telegram.</p><p class='center'>TRAIL PICKED UP HOT ON HER HEELS STOP<br>MEET IN HONG KONG MAY REQUIRE AID STOP<br>PARASOL IS KEY STOP</p><p>This must be from Inspector Flint. Perhaps you should travel to Hong Kong and learn more, if you can spare the time.</p><p class='basic right'>In the Southeast Asia section of the Campaign Log, find Hong Kong. In its spot, write “50–S.” You are now allowed to travel to this location whenever you embark.</p></div>",
        "omega": "<div class='red bordered'><p class='basic'>_Status Report Omega (Ω):_</p><p>As you head into your hotel room, frantic at news of recent events, you mentally begin to prepare for the next leg of your trip…when suddenly, a shape emerges from a corner of your hotel room, and you are clocked on the side of your skull by something heavy and smooth. You collapse into darkness. The last thing you see is a splash of red.</p><p class='basic right'>Add 1 {'{'}cultist{'}'} token to the chaos bag.</p><p class='basic right'>You are out of time. Immediately travel directly to Tunguska and proceed to _Finale Scenario: Congress of the Keys_.</p></div>"
      },
      "zh": {
        "title": "状况报告",
        "alpha": "<div class='red bordered'><p class='basic'>_状况报告阿尔法(α)：_</p><p>你继续旅途，基金会收到了越来越多有关神秘失踪案的报告。你阅读的密档越来越多，不禁担心万物是否终究化为虚无。</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p></div>",
        "beta": "<div class='red bordered'><p class='basic'>_状况报告贝塔(β)：_</p><p>你收到一封泰勒专员亲自寄出的加密公文：“特工——不久前，西伯利亚的石泉通古斯卡河附近发生了一场大爆炸。它被定性为一场陨石撞击事件，但这只是表面上的幌子。我们的情报显示同志会牵涉其中。有理由相信此地就是其圣堂之一，或许更是他们的主要藏身地。现核准你调查此地，但须注意，一切都可能发生。”</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p><p class='basic right'>在剧本日志的中亚部分，找到通古斯卡，在其位置写下“59-Z”。从现在开始，每当你启程，可以旅行前往该地点。*(注意：这么做会结束此剧本。你可能会希望在前往通古斯卡前再深入调查一番……但要小心已经花费了多少时间。)*</p></div>",
        "epsilon": "<div class='red bordered'><p class='basic'>_状况报告艾普西龙(ε)：_</p><p>你穿过街道，每个影子的移动、每个红色身影经过都让你心惊胆战。你肯定是被跟踪了，目标明确的敌人源源不断冲你而来……</p><p class='basic'>在本剧本的剩余时间内，每当设置冒险，执行下列指示：收齐*红色同志会*遭遇组中，在剧本日志中记有*“恩怨未了”*的每个敌人，随机选择一张，将其洗入本场冒险的遭遇牌库。*红色同志会*遭遇组的图标为：<section class='encounter-sets'><img src='{setImgPath}/red-coterie.png'></section></p></div>",
        "gamma": "<div class='red bordered'><p class='basic'>_状况报告伽马(γ)：_</p><p>报告仍在继续。现在已经不仅仅是人员失踪，人员还回来了，却与之前不同了。建筑和物品，也都一一复制了，却又不一样，很反常，像是完全拆解，又重组过了。但这是为什么呢？</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p><p class='basic right'>每位调查员必须将一张超维认知弱点加入自己牌库。这张卡牌不计入其牌库卡牌张数。这些卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></p></div>",
        "zeta": "<div class='red bordered'><p class='basic'>_状况报告泽塔(ζ)：_</p><p>你跋涉调查了漫长的一日，终于回到酒店，却发现自己的房间一片狼藉。你腹中涌起一阵大事不妙的感觉。有人把你的房间翻了个底朝天，要找什么，而你十分确定自己知道他们是冲什么来的。你奔向保险柜，这里存放了你没有随身携带的超维神器。你惊恐地发现里面已经空了，只留了一张红色卡片。你找了基金会的联系人，相信窃贼就藏在同志会四所圣所其中一处。要是你行动迅速，兴许还能找回失窃的钥匙。</p><p class='basic right'>检查剧本日志的钥匙部分，找到调查员拥有的所有钥匙。</p><p class='basic right'>随机选择1个(如果调查员控制了总计至少5个钥匙，则改为随机选择2个)。选中的钥匙遭窃。收齐*红色同志会*遭遇组中，剧本日志中记录“恩怨未了”的每个敌人，随机选择一张。就是此人偷走了你的钥匙。</p><p class='basic right'>更新剧本日志的钥匙部分，随机选中的敌人拥有遭窃的钥匙。</p><p class='basic right'>在剧本日志的中亚部分找到坎布尔；在南美洲部分找到基多和圣胡安；在北大西洋部分找到雷克雅未克。在其位置写下“14-C”。从现在开始，每当你启程，可以旅行前往这些地点。</p></div>",
        "theta": "<div class='red bordered'><p class='basic'>_状况报告西塔(θ)：_</p><p>你走进旅馆房间，发现门里滑进了一个红色的信封。里面是简短的一句话：“我在宜博市的人已经知道了新口令，晓得你要过去。方便的时候就去一趟。”署名是“德西”。</p></div>",
        "psi": "<div class='red bordered'><p class='basic'>_状况报告普西(ψ)：_</p><p>你回到酒店的时候，门房朝你招手，递给你一份电报。</p><p class='center'>已经紧紧跟上她了<br>在香港见面，可能需要帮助<br>伞就是钥匙</p><p>这肯定是福林探员送来的。也许你应该前往香港，了解更多情况——如果你还有时间的话。</p><p class='basic right'>在剧本日志的东南亚部分，找到香港，在其位置写下“50-S”。从现在开始，每当你启程，可以旅行前往该地点。</p></div>",
        "omega": "<div class='red bordered'><p class='basic'>_状况报告欧米茄(ω)：_</p><p>你一头栽进宾馆的房间，最近的消息让你抓狂。你做着精神准备，要再度启程……突然，你房间角落跃出一个身影，然后你的脑袋被什么沉重又光滑的东西狠狠砸了一下。你陷入了黑暗。你最后看到的东西就是一团鲜红。</p><p class='basic right'>在混沌袋里加入1个{'{'}cultist{'}'}标记。</p><p class='basic right'>你的时间已尽。立即直接旅行到通古斯卡，进入_最终冒险：钥匙议会_。</p></div>"
      },
      "chineseGaps": []
    },
    "key": {
      "en": {
        "agentFlintIsDead": "Agent Flint is dead",
        "agentFlintIsMissing": "Agent Flint is missing",
        "agentQuinnHasYourBack": "Agent Quinn has your back",
        "agentQuinnDoesNotTrustTheCell": "Agent Quinn does not trust the cell",
        "agentQuinnVanishedFromExistence": "Agent Quinn vanished from existence",
        "alikiIsOnYourSide": "Aliki is on your side",
        "amaranthHasLeftTheCoterie": "Amaranth has left the Coterie",
        "cellDeception": "Cell deception",
        "desiIsInYourDebt": "Desi is in your debt",
        "drIrawanJoinedTheCell": "Dr. Irawan joined the cell",
        "drIrawanTraveledToNewGuinea": "Dr. Irawan traveled to New Guinea",
        "drIrawanVanishedFromExistence": "Dr. Irawan vanished from existence",
        "eceDoesNotTrustTheCell": "Ece does not trust the cell",
        "eceTrustsTheCell": "Ece trusts the cell",
        "erasedFromExistence": "Erased from existence",
        "flintAbandonedHisSearch": "Flint abandoned his search",
        "flintIsWorkingSolo": "Flint is working solo",
        "flintRejoinedTheCell": "Flint rejoined the cell",
        "flintTraveledToKualaLumpur": "Flint traveled to Kuala Lumpur",
        "foundationTrust": "Foundation trust",
        "laChicaRojaIsOnYourSide": "La Chica Roja is on your side",
        "theCellAidedInFlintsInvestigation": "The cell aided in Flint's investigation",
        "theCellAidedTheKnight": "The cell aided the Knight",
        "theCellAppreciatedTheArchitecture": "The cell appreciated the architecture",
        "theCellBlewTheWhistle": "The cell blew the whistle",
        "theCellDidntDiscoverTheTruthInHavana": "The cell didn't discover the truth in Havana",
        "theCellEscapedTheRedCoterie": "The cell escaped the Red Coterie",
        "theCellFailedToFendOffTheBeast": "The cell failed to fend off the Beast",
        "theCellHasBeenAmbushed": "The cell has been ambushed",
        "theCellHidTheTruthFromTaylor": "The cell hid the truth from Taylor",
        "theCellIsAssistingAgentSirry": "The cell is assisting Agent Sirry",
        "theCellIsDecievingEce": "The cell is deceiving Ece",
        "theCellIsDeliveringFoundationIntel": "The cell is delivering Foundation intel",
        "theCellIsOffMission": "The cell is off mission",
        "theCellIsWorkingWithEce": "The cell is working with Ece",
        "theCellJoinedTheRedCoterie": "The cell joined the Red Coterie",
        "theCellKnowsAmaranthsRealName": "The cell knows Amaranth's real name",
        "theCellKnowsOfDesisPast": "The cell knows of Desi's past",
        "theCellKnowsTheTrueNatureOfTheCoterie": "The cell knows the true nature of the Coterie",
        "theCellMadeADealWithDesi": "The cell made a deal with Desi",
        "theCellMadeADealWithTheClaretKnight": "The cell made a deal with the Claret Knight",
        "theCellMadeADealWithThorne": "The cell made a deal with Thorne",
        "theCellMeddledInAbarransAffairs": "The cell meddled in Abarran's affairs",
        "theCellMetDrIrawan": "The cell met Dr. Irawan",
        "theCellOverthrewTheRedCoterie": "The cell overthrew the Red Coterie",
        "theCellPossessesAMysteriousWhistle": "The cell possesses a mysterious whistle",
        "theCellRefusedAlikisOffer": "The cell refused Aliki's offer",
        "theCellRefusedEcesOffer": "The cell refused Ece's offer",
        "theCellToldTheTruthToTaylor": "The cell told the truth to Taylor",
        "theCellThrewAwayTheWhistle": "The cell threw away the whistle",
        "theCellWasDismantled": "The cell was dismantled",
        "theCellWasGivenAPermanentPosition": "The cell was given a permanent position",
        "theCellWasHollowed": "The cell was hollowed",
        "theDogsAreAtWar": "The dogs are at war",
        "theFoundationRemainsInTheDark": "The Foundation remains in the dark",
        "theLoversAreReunited": "The lovers are reunited",
        "theOutsidersWereStopped": "The outsiders were stopped",
        "theRedCoterieAndTheCellAgreedToWorkTogether": "The Red Coterie and the cell agreed to work together",
        "theRedCoterieSparedTheCell": "The Red Coterie spared the cell",
        "theRedCoterieWasDestroyedFromWithin": "The Red Coterie was destroyed from within",
        "theSanguineWatchersTormentContinues": "The Sanguine Watcher's torment continues",
        "theVoidChimeraEscaped": "The Void Chimera escaped",
        "thereIsNothingOfNoteInAnchorage": "There is nothing of note in Anchorage",
        "thorneDisappeared": "Thorne disappeared",
        "time": "Time",
        "tuwileMasaiFledToBermuda": "Tuwile Masai fled to Bermuda",
        "tuwileMasaiIsOnYourSide": "Tuwile Masai is on your side",
        "tzuSanNiangHasYouUnderHerSway": "Tzu San Niang has you under her sway",
        "tzuSanNiangIsUnderYourSway": "Tzu San Niang is under your sway",
        "wrongLeads": "Wrong leads",
        "youHaventSeenTheLastOfAlikiZoniUperetria": "You haven't seen the last of Aliki Zoni Uperetria",
        "youHaventSeenTheLastOfAmaranth": "You haven't seen the last of Amaranth",
        "youHaventSeenTheLastOfDesiderioDelgadoAlvarez": "You haven't seen the last of Desi",
        "youHaventSeenTheLastOfLaChicaRoja": "You haven't seen the last of La Chica Roja",
        "youHaventSeenTheLastOfTheBeastInACowlOfCrimson": "You haven't seen the last of the Beast in a Cowl of Crimson",
        "youHaventSeenTheLastOfTheClaretKnight": "You haven't seen the last of the Claret Knight",
        "youHaventSeenTheLastOfTheRedGlovedMan": "You haven't seen the last of the Red-Gloved Man",
        "youHaventSeenTheLastOfTheSanguineWatcher": "You haven't seen the last of the Sanguine Watcher",
        "youHaventSeenTheLastOfThorn": "You haven't seen the last of Thorn",
        "youHaventSeenTheLastOfTzuSanNiang": "You haven't seen the last of Tzu San Niang",
        "youKnowThePassphrase": "You know the passphrase"
      },
      "zh": {
        "agentFlintIsDead": "福林特工已死",
        "agentFlintIsMissing": "福林特工失踪",
        "agentQuinnHasYourBack": "奎因特工护你左右",
        "agentQuinnDoesNotTrustTheCell": "奎因特工不信任特别小组",
        "agentQuinnVanishedFromExistence": "奎因特工凭空消失",
        "alikiIsOnYourSide": "艾里奇站在你这一边",
        "amaranthHasLeftTheCoterie": "苋离开同志会",
        "cellDeception": "特别小组欺瞒",
        "desiIsInYourDebt": "德西欠你一笔",
        "drIrawanJoinedTheCell": "伊拉万博士加入特别小组",
        "drIrawanTraveledToNewGuinea": "伊拉万博士前往新几内亚",
        "drIrawanVanishedFromExistence": "伊拉万博士凭空消失",
        "eceDoesNotTrustTheCell": "艾婕不信任特别小组",
        "eceTrustsTheCell": "艾婕信任特别小组",
        "erasedFromExistence": "存在抹除",
        "flintAbandonedHisSearch": "福林放弃了自己的调查",
        "flintIsWorkingSolo": "福林独自行动",
        "flintRejoinedTheCell": "福林重归特别小组",
        "flintTraveledToKualaLumpur": "福林前往吉隆坡",
        "foundationTrust": "基金会信任",
        "laChicaRojaIsOnYourSide": "红衣女郎站在你这一边",
        "theCellAidedInFlintsInvestigation": "特别小组援助福林的调查",
        "theCellAidedTheKnight": "特别小组援助了骑士",
        "theCellAppreciatedTheArchitecture": "特别小组对建筑表示惊叹",
        "theCellBlewTheWhistle": "特别小组吹响哨子",
        "theCellDidntDiscoverTheTruthInHavana": "特别小组没有发现哈瓦那的真相",
        "theCellEscapedTheRedCoterie": "特别小组逃离红色同志会",
        "theCellFailedToFendOffTheBeast": "特别小组未能阻挡恶兽",
        "theCellHasBeenAmbushed": "特别小组遭到伏击",
        "theCellHidTheTruthFromTaylor": "特别小组对泰勒隐瞒真相",
        "theCellIsAssistingAgentSirry": "特别小组帮助西里特工",
        "theCellIsDecievingEce": "特别小组欺骗艾婕",
        "theCellIsDeliveringFoundationIntel": "特别小组正在传递情报",
        "theCellIsOffMission": "特别小组另有使命",
        "theCellIsWorkingWithEce": "特别小组与艾婕合作",
        "theCellJoinedTheRedCoterie": "特别小组加入了红色同志会",
        "theCellKnowsAmaranthsRealName": "特别小组知道了苋的真名",
        "theCellKnowsOfDesisPast": "特别小组知道了德西的过往",
        "theCellKnowsTheTrueNatureOfTheCoterie": "特别小组了解了同志会的真相",
        "theCellMadeADealWithDesi": "特别小组与德西达成交易",
        "theCellMadeADealWithTheClaretKnight": "特别小组与暗红骑士达成交易",
        "theCellMadeADealWithThorne": "特别小组与索恩达成交易",
        "theCellMeddledInAbarransAffairs": "特别小组介入了阿巴冉的事务",
        "theCellMetDrIrawan": "特别小组与伊拉万博士会面",
        "theCellOverthrewTheRedCoterie": "特别小组颠覆了红色同志会",
        "theCellPossessesAMysteriousWhistle": "特别小组拥有了神秘的哨子",
        "theCellRefusedAlikisOffer": "特别小组拒绝了艾里奇的馈赠",
        "theCellRefusedEcesOffer": "特别小组拒绝了艾婕的提议",
        "theCellToldTheTruthToTaylor": "特别小组将真相告诉了泰勒",
        "theCellThrewAwayTheWhistle": "特别小组扔掉哨子",
        "theCellWasDismantled": "特别小组就此解散",
        "theCellWasGivenAPermanentPosition": "特别小组得到了终身职位",
        "theCellWasHollowed": "特别小组成为空洞",
        "theDogsAreAtWar": "大战打响",
        "theFoundationRemainsInTheDark": "基金会依然一团糊涂",
        "theLoversAreReunited": "情人重聚",
        "theOutsidersWereStopped": "域外来客遭到阻止",
        "theRedCoterieAndTheCellAgreedToWorkTogether": "红色同志会和基金会同意合作",
        "theRedCoterieSparedTheCell": "红色同志会饶恕了特别小组",
        "theRedCoterieWasDestroyedFromWithin": "红色同志会由内部被毁",
        "theSanguineWatchersTormentContinues": "血色监视者造成的苦难未止",
        "theVoidChimeraEscaped": "虚空奇美拉逃脱",
        "thereIsNothingOfNoteInAnchorage": "安克雷奇无事发生",
        "thorneDisappeared": "索恩消失",
        "time": "时间",
        "tuwileMasaiFledToBermuda": "特瓦耶·马萨伊逃往百慕大",
        "tuwileMasaiIsOnYourSide": "特瓦耶·马萨伊站在你这一边",
        "tzuSanNiangHasYouUnderHerSway": "朱三娘支配了你",
        "tzuSanNiangIsUnderYourSway": "朱三娘受你支配",
        "wrongLeads": "错误迹象",
        "youHaventSeenTheLastOfAlikiZoniUperetria": "你和艾里奇之间恩怨未了",
        "youHaventSeenTheLastOfAmaranth": "你和苋之间恩怨未了",
        "youHaventSeenTheLastOfDesiderioDelgadoAlvarez": "你和德西之间恩怨未了",
        "youHaventSeenTheLastOfLaChicaRoja": "你和红衣女郎之间恩怨未了",
        "youHaventSeenTheLastOfTheBeastInACowlOfCrimson": "你和深红斗篷的恶兽之间恩怨未了",
        "youHaventSeenTheLastOfTheClaretKnight": "你和暗红骑士之间恩怨未了",
        "youHaventSeenTheLastOfTheRedGlovedMan": "你和戴红手套的男子之间恩怨未了",
        "youHaventSeenTheLastOfTheSanguineWatcher": "你和血色监视者之间恩怨未了",
        "youHaventSeenTheLastOfThorn": "你和索恩之间恩怨未了",
        "youHaventSeenTheLastOfTzuSanNiang": "你和朱三娘之间恩怨未了",
        "youKnowThePassphrase": "你知道了口令"
      },
      "chineseGaps": []
    },
    "label": {
      "en": {
        "chooseBearer": "Choose bearer",
        "empowered": "Spend empowerment instead of flipping to _Unstable_ side",
        "figuresInTheDark": {
          "attack": "Each enemy in the shadows attacks you.",
          "loseAction": "Each investigator loses an action."
        },
        "pinchInReality": {
          "discard": "Discard half of the non-weakness cards in your hand (rounded up)."
        },
        "secretsLost": {
          "hollowed": "Take 1 horror to choose a set-aside hollow and add it to its owner's hand"
        },
        "wealdOfEffigies": {
          "miniCards": "Swap the positions of 2 concealed mini-cards adjacent to locations",
          "locations": "Swap the positions of 2 locations in the shadows"
        },
        "paradimensionalTerror": {
          "takeDamageAndHorror": "Each investigator takes 1 damage and 1 horror.",
          "shuffleAllConcealed": "Shuffle all concealed mini-cards facedown, then place them at random in the positions they were in."
        },
        "paradimensionalUnderstanding": {
          "stable": "Flip each _Stable_ key you control to its _Unstable_ side.",
          "unstable": "Immediately shift an _Unstable_ key you control."
        },
        "theMirroringBlade": {
          "single": "Deal 2 damage to an enemy at your location.",
          "all": "Deal 1 damage to all enemies at your location."
        },
        "doNotExposeConcealed": "Do not expose Concealed Card",
        "doNotRevealConcealed": "Do not reveal Concealed Card",
        "drDewiIrawan": {
          "reveal": "Reveal a card from your hand to shuffle each copy of that card that is set-aside as a hollow into its owner's deck",
          "discard": "Discard a card from your hand to shuffle any set-aside hollow into its owner's deck"
        }
      },
      "zh": {
        "chooseBearer": "选择拥有者",
        "empowered": "消耗充能，而不是翻至_动荡_面",
        "figuresInTheDark": {
          "attack": "阴影中的每个敌人攻击你",
          "loseAction": "每位调查员失去一个行动"
        },
        "pinchInReality": {
          "discard": "选择并弃掉你一半的非弱点手牌(向上取整)"
        },
        "secretsLost": {
          "hollowed": "受到1点恐惧，以选择一个放在一边的空洞，将其加入所有者手牌"
        },
        "wealdOfEffigies": {
          "miniCards": "交换与地点相邻的2张隐匿迷你卡牌的位置",
          "locations": "交换阴影中2个地点的位置"
        },
        "paradimensionalTerror": {
          "takeDamageAndHorror": "每位调查员受到1点伤害和1点恐惧。",
          "shuffleAllConcealed": "混洗场上所有隐匿迷你卡牌，然后将这些迷你卡牌正面朝下随机放到先前位置。"
        },
        "paradimensionalUnderstanding": {
          "stable": "将你控制的每个_稳定_钥匙翻至_动荡_面",
          "unstable": "立即变换你控制的一个_动荡_钥匙。"
        },
        "theMirroringBlade": {
          "single": "对你所在地点的一个敌人造成2点伤害",
          "all": "对你所在地点的每个敌人造成1点伤害"
        },
        "doNotExposeConcealed": "不要揭露隐匿卡牌",
        "doNotRevealConcealed": "不要揭示隐匿卡牌",
        "drDewiIrawan": {
          "reveal": "揭示你一张手牌，以将该卡牌放在一边作为空洞的所有同名卡牌混洗入其所有者牌库",
          "discard": "弃掉你一张手牌，以将任意一个放在一边的空洞混洗入其所有者牌库"
        }
      },
      "chineseGaps": []
    },
    "xp": {
      "en": {
        "chaosTokens": "Already at 4 chaos tokens"
      },
      "zh": {
        "chaosTokens": "已有4个混乱标记"
      },
      "chineseGaps": []
    },
    "prologue": {
      "en": {
        "title": "The Secret War",
        "body": "<p>“…by May or June I realised that there was, all over the world, a surprising and unwonted burst of activity on the part of bizarre, furtive, and esoteric mystical organisations ordinarily quiescent and seldom heard from.”</p><p class='basic right'>– H. P. Lovecraft for Hazel Heald, “Out of the Aeons”</p><h3>Around the World</h3><p class='basic'>The Scarlet Keys expansion differs from its predecessors in that it features an open-ended, non-linear campaign. Following the “Riddles and Rain” prologue, investigators are provided with a map of the world, and from there they may choose to embark to various locations. The order in which the locations are chosen determines the order in which these scenarios are played, and may also alter the story and gameplay of each scenario before culminating in an epic finale. Choose wisely, and good luck!</p>"
      },
      "zh": {
        "title": "秘密战争",
        "body": "<p>“……但到了五月或六月，我意识到，那些鬼鬼祟祟、玄奥难解、离奇怪诞的神秘团体遍布全球，他们一贯保持低调，不为人知，现在却变得异常活跃，叫人震惊。”</p><p class='basic right'>——H. P. 洛夫克拉夫特为哈泽尔·赫尔德所作，《超越万古》</p><h3>遍布全球</h3><p class='basic'>与先前的剧本不同，《猩红钥匙》扩展带来了开放式的非线性剧本。序幕“谜雨”后，调查员会得到一张世界地图，可以选择_启程_前往不同的地点。选择这些地点的顺序决定了冒险进行的顺序，也会改变每场冒险的剧情走向和游戏进程，最终到达一场史诗般的盛大结局。精心规划，祝你好运！</p>"
      },
      "chineseGaps": []
    },
    "interlude1": {
      "en": {
        "label": {
          "tell": "Tell Taylor about the disappearances.",
          "doNotTell": "Do not tell Taylor about the disappearances."
        },
        "title": "Interlude: The Foundation",
        "theFoundation1": "<p>_The Foundation 1_: “Talk,” the woman commands.</p><p>“I’m a detective with the ICPC,” Flint barks back. “Flint, Li Flint. And you’re going to be in a lot of trouble when they hear about this.”</p><p>“I assure you, I will not. And you?” she asks, glaring in your direction. You explain that you are independent investigators working with Flint. She takes a moment to read your gaze—presumably to tell if you are lying. She, like Flint, seems low on trust. Finally, after a long, bated moment, she holsters her firearm. Flint’s hands drop to his sides. You let out a breath you didn’t know you were holding.</p><p>“We have been after that red-gloved man for quite some time. This is the first time we have gotten this close. He seems to have a knack for slipping away.” She nods to the two suits flanking her—a tall, athletic, pale-skinned woman and a sharp, clean-shaven man—and motions toward the walls. They keep a hand on their holsters as they scour the perimeter of the room.“And who is ‘we,’ exactly?” Inspector Flint asks. You’ve been wondering the very same thing. Your interrogator has a British accent, but she doesn’t seem to be part of any local outfit you’ve ever heard of.</p><p>She waits for confirmation from her two subordinates before continuing. “All clear, ma’am,” the man states. She sighs and crosses her arms. “All right. What I am about to tell you cannot leave this room under any circumstances. Am I clear?”</p><p>Flint shrugs. “Under penalty of what, exactly?”</p><p>“Summary execution,” she states without hesitation. Your throat closes tight. Even your partner flinches for a moment.</p><p>“Well then. I suppose we don’t have much of a choice, do we?” He glances at you. You nod; you might as well hear what she has to say.</p><p>“I am Commissioner Taylor, and these are agents Hudson and Antonova. We are with the <span class='term'>Foundation</span>, an international agency devoted to the discovery, research, and containment of objects with paradimensional capability.”</p><p>“What kind of baloney?” Flint practically laughs. But the woman who calls herself Taylor shows no sign of humor.</p><p>“After the Great War, many treaties and accords were signed. Paris. Versailles. But keeping the peace wasn’t the only goal. There were…oddities, you see. During the war. Things that did not add up. The Foundation’s purpose is to find these ‘things that do not add up’ and ensure that they cannot be used for such purposes ever again.”</p><p>“Well, this is a hell of a con you buttons have cooked up,” Flint says, but the darker tone in his voice indicates he doesn’t even believe himself. And you’re inclined to agree—the fact that Commissioner Taylor even knows of the Red-Gloved Man at all is proof that she has inside knowledge.</p><P>You decide that it’s more likely she is telling the truth than lying, and ask what she intends to do with you.</p><p>She paces in uncomfortable silence before finally letting out a sigh. “Well, I certainly can’t have your investigation running parallel to my own. And you might have information that could be pertinent to our work. So I say we work together.”</p><p>“Work together? Or work for you?” Flint asks pointedly, his eyes narrowing.</p><p>She allows herself a smile. “You are a clever man, I’ll give you that.” She nods to Agent Hudson, who produces several badges and hands them to you. “You’ll be your own cell of the Foundation, operating under our authority, but with independence. All you need to do is agree to report your findings to us.” She locks eyes with Flint appraisingly. “You’ll be our point of contact.”</p><p>You ask Taylor what you get out of the arrangement, besides the lifted threat on your lives. “We’ll hand over the intel we have on the organization the Red-Gloved Man works for and provide travel papers that can get you anywhere in the world, no questions asked, at no expense.”</p><p>Flint eyes the badge like one might an explosive, turning it over and over in his hands. “Two minutes ago you were pointing a gun at me, now you’re offering me a job?”</p><p>“Yes. Well? Are you in?”</p><p>You pull Flint aside to speak with him in private. The discussion is short and hushed, full of conjecture and paranoid theories about this “Foundation” and their true motives. But in the end, you decide to accept her offer. If it will help you get to the bottom of whatever is going on, it is the only real choice.</p><p>“Very well then,” Taylor explains. “The Red-Gloved Man is just one operative of his organization. Or, perhaps, its leader—that we are unable to determine. They call themselves the <span class='term'>Red</span> <span class='term'>Coterie</span>, so named due to the red garments they wear. They are after artifacts scattered across the world which possess paradimensional capabilities—the very same kind of objects we seek to find and contain. We call them Keys.”</p><p>You ask Commissioner Taylor what she means by the term paradimensional. “Imagine a cake with many layers,” she explains. “Everything we see and feel exists on one layer. But there are many more layers above and below ours. Something that is paradimensional exists on one layer, but draws energy from other, parallel layers. As a result, these Keys operate outside the laws of our dimension. Cause and effect. If left unchecked, they can be used to inflict terrible harm on the world. Our job— your new job—is to get them out of the hands of the Coterie and keep them secure in Foundation custody.”</p><p>If these Keys are as powerful as the Foundation believes, you agree that they should be kept in safe hands. But you cannot help but wonder what this has to do with the disappearances you’ve been investigating, if anything. Flint locks eyes with you and gives you the slightest shake of his head. He has no intention of telling them.</p><p>The investigators must decide (choose one):</p><ul><li>*Tell Taylor about the disappearances*. Proceed to The _Foundation 2_.</li><li>*Do not tell Taylor about the disappearances*. Skip to The _Foundation 3_.</li></ul>",
        "theFoundation2": "<p>_The Foundation 2_: You decide it’s best to tell Commissioner Taylor why you were looking into the Red-Gloved Man to begin with. Flint lets out an audible sigh. She mulls it over for a few moments, then shakes her head. “That is something to look into, but your primary objective is to acquire the Keys the Coterie is searching for, at all costs. Am I understood?” Taylor further explains that she will forward any relevant information to Flint’s office, with some “sensitive details” omitted, of course. She will also provide the ICPC with the requisite papers regarding Flint’s new “position.”</p><p>“Oh, and Agent Flint,” she says on her way out, addressing him by his new title. “Your cell may have the independence to act on their own accord, but do not forget that you report directly to me. I expect you to do so without reservation should you discover anything of import.”</p><p>He nods, only the slightest hint of resistance giving him away.</p><ul><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>In your Campaign Log, record *the cell told the truth to Taylor*. Skip to _The Foundation 4_.</li></ul>",
        "theFoundation3": "<p>_The Foundation 3_: You shut your mouth tight. What she doesn’t know can’t hurt her. Commissioner Taylor tells Flint that she will forward any relevant information to his office, with some “sensitive details” omitted, of course. She will also provide the ICPC with the requisite papers regarding Flint’s new “position.”</p><p>“Oh, and Agent Flint,” she says on her way out, addressing him by his new title. “Your cell may have the independence to act on their own accord, but do not forget that you report directly to me. I expect you to do so without reservation should you discover anything of import.”</p><p>He nods, but given your reluctance, you expect he’ll omit “sensitive details” as well.</p><ul><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>In your Campaign Log, record *the cell hid the truth from Taylor*. Proceed to _The Foundation 4_.</li></ul>",
        "theFoundation4": "<p>_The Foundation 4_: The next morning, your “cell” meets at the tea room near Trafalgar Square where you had originally intended to meet the previous night. Together, you go over the documentation provided to Flint by this “Foundation.”</p><p>“It’s all a bit difficult to believe, if I’m being honest,” Flint says, “but everything checks out. The travel papers, the job transfer, all of it. Not even my boss questioned it for a moment. I guess we’re secret agents now, eh?”</p><p>You agree; unbelievable as it might seem, it’s no less strange than the matters you had already been looking into. “Right. Well, I think the best thing to do is to split up. Shanghai is where I grew up. I have connections there I can leverage. So I’ll head there first. Where you want to investigate next is up to you. Meet up with me later, and we can figure out where to go from there.”</p><p class='basic'>The Foundation has several leads concerning the whereabouts of the Red Coterie</p><ul><li>One is likely in Inspector Flint’s home city of <span class='term'>Shanghai</span>, where there have been many rumors about the existence of a secret cabal led by a mysterious woman with a red parasol.</li><li>In <span class='term'>Alexandria</span>, there have been a rash of beastly killings throughout the city. The Foundation has reason to believe a member of the Coterie is involved.</li><li>A string of high-profile burglaries in <span class='term'>Buenos</span> <span class='term'>Aires</span> has led the Foundation to believe that one of the Coterie members is responsible. It is likely a Key is the primary target.</li><li>A member of the Coterie has a sanctum in <span class='term'>Nairobi</span>. Perhaps there you might learn what they have planned.</li><li>The Foundation have procured the journal of a prospector recently working in <span class='term'>Anchorage</span>. Perhaps the site of a Key?</li><li>A Coterie agent operating out of <span class='term'>Istanbul</span> has already reached out to Foundation operatives. A defector, perhaps? Or it could be a trap.</li><li>Locals in <span class='term'>Kathmandu</span> have reported seeing a “spirit” matching the description of another Coterie agent.</li><li>A deadly Coterie agent has been sighted in <span class='term'>Marrakesh</span>. Reports of tomb robberies and strange overgrowth have the local Foundation operatives on edge.</li><li>A Coterie agent has made a name for himself in <span class='term'>Havana</span>, where rum and other illicit goods are being smuggled into the United States.</li></ul><p class='basic right'>Read the rules for “Embarking and Travel” and “The Foundation Dossiers” on the next column. Then, when you are ready to proceed, _embark_ from London to a new location.</p>"
      },
      "zh": {
        "label": {
          "tell": "将失踪案告诉泰勒",
          "doNotTell": "对泰勒隐瞒失踪案"
        },
        "title": "幕间故事：基金会",
        "theFoundation1": "<p>“给我交代。”女子下令道。</p><p>“我是国际刑事警察委员会的侦探！”福林吼了回去，“福林，李福林。要是组织知道，你肯定吃不了兜着走。”</p><p>“我可以保证，不会的。你呢？”她说着望向你的方向。你解释说自己是和福林合作的独立调查员。她仔细研究你的眼神——兴许是在分辨你有没有说谎。她和福林一样，都不太容易相信人。这短短的一刻是如此漫长，她终于收起了手中的枪械。福林放下了手。你不知什么时候凝神屏息，现在也终于舒了口气。</p><p>“我们追逐戴红手套的男子已经有段时候了。这还是头一次这么近。他对溜走似乎特别有一套。”她朝身边两个穿西装的点了点头——一个是精壮高挑的白皙女子，另一个瘦削的男人脸刮得干干净净——指向四壁。他们屋里搜查了一番，手不曾离过枪套。“你说的‘我们’究竟是谁？”福林探员问道。你也有着一样的疑虑。盘问你们的人带着英国口音，但她看上去和你见过的任何当地组织都搭不上。</p><p>她等到两个手下确认无虞才继续。“一切正常，长官。”男子说道。她交叉双臂，叹了口气：“好吧。我告诉你们的事情，无论如何都不能外传。听明白了吗？”</p><p>福林耸耸肩：“不然会怎么样？”</p><p>“当场处决。”她当即说道。你喉咙一紧，你的搭档也畏缩了一下。</p><p>“好吧。我想我们也没什么别的选择，嗯？”他望了你一眼，你点点头。那不如就听一听吧。</p><p>“我是泰勒专员，这两位是哈德逊和安东诺娃特工，我们为_*基金会*_工作。这个国际组织旨在发现、研究、保存具有超维能力的物品。”</p><p>“都胡扯些什么？”福林几乎要笑出声。但自称泰勒的女子一点也没有幽默的意思。</p><p>“大战后签署了许多和约条款。巴黎、凡尔赛。但它们的目的不止是维护和平。战争期间还有一些……怪象。还有些东西不合乎常理。基金会就是为了找到这些‘不合理物件’，并确保它们不会再用于战争。”</p><p>“呃，这听起来根本就是你们编造的一堆屁话。”福林说道。他听起来颇为阴郁，显然一点儿也没有相信。你也同意——泰勒专员知道戴红手套的男子，仅凭这一点就足以证明她有所保留。</p><p>不过你觉得她并未说假话，于是问她对你们有何打算。</p><p>一阵令人不快的沉默后，她终于叹了口气：“好吧，我肯定不能放任你们独立调查，再说你们也可能收集到一些相关信息。所以还是让我们合作吧。”</p><p>“合作？还是给你打工？”福林眯起眼睛，犀利地问道。</p><p>她尽力挤出一个微笑：“你真是个聪明人，这点我承认。”她向哈德逊特工点点头，他随即拿出几个徽章交给你们。“你们就是基金会的特别小组，在我们的授权下独立行动。你们要做的就是将发现汇报给我们。”她一直带着赞许的目光盯着福林，“你就是我们的联络人。”</p><p>你问泰勒自己能在这样的任务中得到什么——除了性命不受威胁之外。“我们也会共享戴红手套的男子背后组织的信息，还会给你们提供旅行所需的文件，让你们能免费前往世界上任何地方，且不会遭人盘问。”</p><p>福林将徽章在手里翻来翻去，死死盯着，就像在看一枚炸弹。</p><p>“两分钟前你还拿枪指着我，现在却要我为你干活？”</p><p>“是啊，怎么？你干吗？”</p><p>你将福林拉到一边，私下对眼前的情况进行了一番简短又安静的讨论，其中不乏对这个“基金会”及其真正动机的推测和臆想。你们最终还是决定接受她的提议。要是还有什么能帮助你们一探究竟，这是唯一的选择。</p><p>“很好。”泰勒开始解释，“戴红手套的男子只是其组织的一员，也可能是其领袖——这我们还无法确定。他们自称为_*红色同志会*_，取自他们的红色衣饰。他们追寻散落在全球各地，具有超维能力的神器——也就是我们要寻找、保存的东西。我们称之为‘钥匙’。”</p><p>你问泰勒专员她口中的术语“超维”到底是什么意思。“想象一个有许多层的蛋糕，”她解释道，“我们所见所感的一切都在一层，但之上和之下还有许多层。超维之物也存在于某一层，但可以从其他平行的层级抽取能量。结果就是这些钥匙并不遵循我们维度的法则。因此，倘若不加管控，就会用于危害我们的世界，后患无穷。我们的工作——你们的新工作，就是不让它们落入同志会的魔爪，在基金会的看管下妥善保存。”</p><p>如果这些钥匙真有基金会相信的那么强大，那你确实同意应该由可靠的人士加以看管。但你不禁好奇，这和你们正在调查的失踪案有什么关系。福林盯着你，摇头的动作细微得几乎无法察觉。他并不想告诉他们。</p><p>调查员必须决定（选择一项）：</p><ul><li>*将失踪案告诉泰勒*。</li><li>*对泰勒隐瞒失踪案*。</li></ul>",
        "theFoundation2": "<p>你决定最好还是告诉泰勒专员自己为何开始调查戴红手套的男子。福林的叹息清晰可闻。她沉思片刻，然后摇了摇头：“这确实值得调查，但你们的首要任务还是找到同志会追逐的钥匙，不惜一切代价。明白了吗？”泰勒进一步阐明她会将相关信息通知给福林所属的部门，当然，会省略掉一些“敏感的细节”。此外，她还会给国际刑事警察委员会提交一些有关福林全新“职位”的相关文件。</p><p>“噢，福林特工。”泰勒出去的时候特意用新头衔来称呼他，“你的特别小组独立行事，但别忘了你要直接向我汇报。希望你有重大发现的时候，不要有所保留。”</p><p>他点点头，只是还有一点儿不情愿。</p><ul><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>在剧本日志中，记录下*特别小组将真相告诉了泰勒*。</li></ul>",
        "theFoundation3": "<p>你闭紧了自己的嘴巴，她不知道这些也没什么大不了。泰勒专员告诉福林，她会将相关信息通知给福林所属的部门，当然，会省略掉一些“敏感的细节”。此外，她还会给国际刑事警察委员会提交一些有关福林全新“职位”的相关文件。</p><p>“噢，福林特工。”泰勒出去的时候特意用新头衔来称呼他，“你的特别小组独立行事，但别忘了你要直接向我汇报。希望你有重大发现的时候，不要有所保留。”</p><p>他点点头，但你能看出其中的不情愿。你觉得他也会省略掉一些“敏感的细节”。</p><ul><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>在剧本日志中，记录下*特别小组对泰勒隐瞒真相*。</li></ul>",
        "theFoundation4": "<p>翌日清晨，你们的“特别小组”又在特拉法尔加广场附近的茶馆碰头了。这里本来是你们打算昨夜会面的地方。你研究了一番这个“基金会”给福林的文件。</p><p>“老实说，真是难以置信。”福林说道，“但一切居然都这么顺利。旅行文件、工作调换，所有的一切。甚至我上级也一点都没怀疑。我想咱们现在是秘密特工了，嗯？”</p><p>你表示同意。尽管这一切看上去难以置信，但还不如你正在调查的事情异乎寻常。“没错。好吧，我想最好还是分头行动。我在上海长大，我在那儿还有些人脉，所以我先去那儿。你可以自行决定想去哪儿。我们稍后碰头，那时候再决定下一站。”</p><p class='basic'>关于红色同志会的下落，基金会已有几条线索。</p><ul><li>其中之一指向福林探员的家乡_上海_。无数流言声称那里存在一个秘密的教派，头目是一个打着红伞的神秘女子。</li><li>_亚历山大_爆发了一场残忍的屠杀。基金会相信其中牵扯了同志会的一名成员。</li><li>_布宜诺斯艾利斯_出现了一连串瞩目的盗窃案。基金会相信应是一名同志会成员所为。首要目标似乎是一个钥匙。</li><li>同志会有位成员在_内罗毕_建了一处圣堂。也许你能在那里发现他们的计划。</li><li>基金会弄到了一份勘探报告。报告的作者正在_安克雷奇_工作。也许钥匙会在那里？</li><li>_伊斯坦布尔_(君士坦丁堡)有一名同志会的特工联系上了基金会的人员。那人打算反水吗？也可能是个陷阱。</li><li>_加德满都_的当地人报道目睹了一个“灵体”，其描述与另一位同志会特工相符。</li><li>有人在_马拉喀什_目睹了一位可怕的同志会特工。古墓遭劫和奇怪的植物蔓生事件已让当地的基金会人员紧张万分。</li><li>有个同志会特工已经在_哈瓦那_成了有名的人物。那里源源不断地有朗姆酒和其他非法物品走私到合众国。</li></ul><p class='basic right'>阅读下一栏的“启程与旅行”和“基金会密档”规则。然后，一旦你整装待发，就从伦敦_启程_前往一个新的地点。</p>"
      },
      "chineseGaps": []
    },
    "embarkingAndTravel": {
      "en": {
        "title": "Embarking and Travel",
        "body": "<p class='basic'>Whenever you _embark_, you may travel wherever you wish using the map included in *The Scarlet Keys* campaign expansion. Each space on the map is connected to one or more other spaces by paths. When you are ready to embark, travel along the paths to reach whichever destination you wish (as a group). For each path you use to reach your destination, you must mark 1 _time_ in your Campaign Log (to a minimum of 1).</p><p class='basic'>At each space on the map, there is a number and letter combination that will guide you to a particular page in this Campaign Guide. You do not have to stop at every space you travel through; however, if you wish to stop traveling and see what is at that space, turn to the page of the Campaign Guide that matches the indicated number and follow the story text there. (*Or use the table of contents on page 2 to help you find the appropriate page.*) This might lead you to an interlude or to a scenario. There is no perfect path to follow, so follow your gut…just be wary of how much time you spend (see “Tracking Time” on page 6).</p><p>*For example: Shelley wishes to travel from Alexandria to Marrakesh. She first marks 1 _time_ to use the path to Rome, but chooses not to stop there, and marks 1 more _time_ to travel to Marrakesh, where she stops. Marrakesh is marked as “11–B,” so she opens the Campaign Guide to page 11 and reads File #11–B: Dead Heat.*</p><ul><li>Some locations are marked by a red border and the lack of a letter. You can only travel to such a location once you are permitted to do so by a Campaign Log entry.</li><li>Some locations, marked by a green border, represent the sites of possible side stories (*found in other Arkham Horror: The Card Game standalone products*). If you wish to incorporate a side story into this campaign, simply travel to the appropriate location on the map and spend additional time equal to the normal experience cost for playing that side story (instead of spending the experience cost).<ul><li>If you are not stopping at one of these locations to embark on a side-story, you may skip it and continue traveling along the path. If so, count it as one contiguous path, not as two separate paths.</li></ul></li><li>Once you have stopped at a location, you cannot stop there again for the remainder of the campaign unless instructed otherwise.</li></ul>"
      },
      "zh": {
        "title": "启程与旅行",
        "body": "<p class='basic'>每当你_启程_，你都可以前往《猩红钥匙》剧本扩展的地图上任何一个想去的地点。地图上的每一格都有路线连接到其他格。启程时，调查员共同沿着路线前往想去的目的地。到达目的地途中每经过一段路线，就在剧本日志中记1_时间_(最少为1)。</p><p class='basic'>地图上每一格都有数字和字母的组合标识，指引你前往剧本手册中的特定页。旅行过程中，不必在每一格都作停留。不过，要是你想停止旅行，看看这一格有什么，就前往剧本手册的对应页，阅读那一页的剧情文本。这可能将你导向幕间故事或者冒险。没有哪条路线称得上最佳，跟着直觉走吧……但要小心花费了多少时间(见“记录时间”)。</p><p>*示例：雪莉想从亚历山大旅行前往马拉喀什。她先记1_时间_，沿路线到罗马，但不在此处停留，而是再记1_时间_，旅行前往马拉喀什，在这里停留。马拉喀什标有“11-B”，所以她打开剧本手册的第11页，阅读档案#11-B：死亡酷暑。*</p><ul><li>有些地点带有红色标记，而没有字母。这样的地点只有等到剧本日志的条目允许才能旅行前往。</li><li>有些地点带有绿色标记，代表这里可能发生支线剧情*(见《诡镇奇谈：卡牌版》其他独立产品)*。如果你想在本剧本中加入支线剧情，旅行到地图上对应的地点，并且不用再花费此支线剧情原本所需的经验值，而是花费同等数量的额外时间。<ul><li>如果你不想在这些地方停留开始支线剧情，那么可以直接跳过，沿着路线继续旅行，这样将其视作一段连续的路线，而非两段分隔的路线。</li></ul></li><li>一旦你在某地已经停留过，在剧本剩余时间内，就不能再在此处停留，除非有特别指示。</li></ul>"
      },
      "chineseGaps": []
    },
    "theFoundationDossiers": {
      "en": {
        "title": "The Foundation Dossiers",
        "body": "<p class='basic'>Throughout this Campaign Guide, there are a number of Foundation Dossier sidebars, an example of which is presented below. Investigators are allowed to peek at the Foundation Dossier sidebar for any space on the map, at any time. Use these sidebars to help guide your actions and plan your route. While reading a dossier, investigators are not allowed to peek at any other text on that page until they travel to that location.</p>"
      },
      "zh": {
        "title": "基金会密档",
        "body": "<p class='basic'>本剧本手册中会有许多如下所示的基金会密档侧边栏。调查员可以在任何时候查看地图上任何格子的密档侧边栏。运用这些侧边栏指引下一步行动，计划你的路线。阅读侧边栏时，调查员在旅行前往对应地点前，不能偷看那一页上的其他文本。</p>"
      },
      "chineseGaps": []
    },
    "worldMap": {
      "en": {
        "dossierHeading": "You may read this dossier at any time",
        "dossiers": {
          "Marrakesh": "<p>File #11–B<br/>Subject Class: Red<br/>Real Identity: Unknown<br/>Last Known Location: Marrakesh, Morocco</p><p>Description: Subject #11–B (hereinafter \"Amaranth\") is a woman of European descent; appears to be in early 20s. Typically seen wearing a large red flower that partly obscures her face.</p><p>Paradimensional Capabilities: Power to <span class='censor'>transfer life</span> and <span class='censor'>death</span>. Channels <span class='censor'>energy</span> via <span class='censor'>extradimensional means</span> to <span class='censor'>heal wounded entities</span> and <span class='censor'>sap life</span> from <span class='censor'>the living</span>. No recorded limits to this <span class='censor'>exchange</span>; data limited only to minor events. Subject <span class='censor'>transfers life</span> via tactile contact, which limits <span class='censor'>scale</span> of <span class='censor'>transfer</span>. Possible <span class='censor'>near apocalyptic</span> ramifications.</p><p>Sightings: 1. November 23, 1923: Arkham, MA. Agents witnessed subject healing wounds of <span class='censor'>fellow Coterie</span> member, <span class='censor'>draining and shriveling</span> nearby trees. Elevated <span class='censor'>Outsider/Paracausal</span> activity reported in the months following.</p><p class='indent'>2. January 11, 1924: Lisbon, Portugal. Local cell apprehended subject. Physical contact confirmed. One cell member immediately deceased; second victim remains catatonic. Subject eluded questioning.</p><p class='indent'>3. Unconfirmed sighting in Marrakesh. Further intel required. Immediate assistance requested.</p><p>Approach Procedure: Subject is incredibly dangerous. Engage only with extreme caution. Physical contact prohibited. More information available in San Francisco office (File #26–G2).</p>",
          "BuenosAires": "<p>File #16–D<br/>Subject Class: Yellow<br/>Real Identity: Unknown<br/>Last Known Location: Buenos Aires, Argentina</p><p>Description: Subject #16–D (hereinafter \"Girl in Carmine Coat\") is a woman of apparently Argentinian descent (<span class='censor'>possible human</span> origin?), early 20s, approximately 165cm in height. <span class='censor'>Extraterrestrial</span> presence undetected (as of yet). Coterie paraphernalia consists of stark red coat and matching hat possessive of paradimensional faculty (see details below). Called \"La Chica Roja\" by locals (no doubt a reference to her attire, although it is unclear whether such title is a term of endearment or infamy).</p><p>Paradimensional Capabilities: Reports by local authorities suggest Girl in Carmine Coat is capable of either <span class='censor'>hyperphysical speed</span> or <span class='censor'>ethereal</span> <span class='censor'>projection</span>. Local authorities appear incapable of capturing subject despite repeated attempts. (Can she manipulate <span class='censor'>darkness</span> and <span class='censor'>shadows</span>? Or is she simply that good at evading detection?) Subject seems to wish to avoid conflict; as of yet, no deaths or harm to any locals can be traced to Girl in Carmine Coat. (Cannot rule out potential for violent escalation.)</p><p>Sightings: Girl in Carmine Coat is responsible for several high profile burglaries in Buenos Aires. Reports by local papers indicate she is still at large.</p><p>Approach Procedure: Despite her apparent <span class='censor'>coterie</span> association, Girl in Carmine Coat does not appear to be hostile. She has been heard speaking fluent Spanish, Portugese, French, and English. For these reasons, we believe subject can be interrogated and/or reasoned with. Recommend capture and questioning regarding <span class='censor'>coterie</span> motives.</p><p>Persons of Interest: Oficial Principal Matias Bolívar (ma-tee-as boh-lee-vahr), principal officer in charge of Girl in Carmine Coat's capture. (Possible asset?)</p>",
          "Constantinople": "<p>File #21–F<br/>Subject Class: Green<br/>Real Identity: Şahin, Ece (shah-heen, eh- jay)<br/>Last Known Location: Constantinople, Turkey</p><p>Description: Subject #21–F (hereinafter \"Lady in Vermillion Veil\" or real name \"Ece Şahin\") is a woman of Turkish descent, 34 years of age, approximately 161cm in height. It is unknown whether this is subject's <span class='censor'>true form</span> or a disguise or false identity. At all times, subject wears traditional hijab of unusual stark red color, likely a <span class='censor'>paradimensionally bound</span> object designating coterie membership.</p><p>Paradimensional Capabilities: Lady in Vermillion Veil appears to either possess no such capabilities, or has successfully hidden such capabilities from Foundation intelligence.</p><p>Sightings: Ece Şahin is a well known and renowned art collector and museum curator operating in the Turkish and Islamic Arts Museum in Constantinople. She has either <span class='censor'>integrated completely with human society</span> or is, for all intents and purposes, a normal everyday person. (Note: Leadership is under assumption <span class='censor'>Ece Şahin is a well constructed cover story, but has no evidence to back up such assumptions.</span>)</p><p>Approach Procedure: Ece has already reached out to Foundation envoys. Dispatch to confront and question intentions.</p>",
          "Sanctums": "<p>File #26–G1–6<br />Sanctum Class: Green<br />Sanctum Locations: <span class='censor'>Cape Town</span>, <span class='censor'>Union of South Africa</span>; San Francisco, California; <span class='censor'>Seoul</span>, <span class='censor'>South Korea</span>; Moscow, Russia; <span class='censor'>Bruges</span>, <span class='censor'>Belgium</span>; <span class='censor'>Bern</span>, <span class='censor'>Switzerland</span>.</p><p>Description: Sanctums #26–G1 through G6 are Foundation offices and storehouses for paradimensional artifacts. Do not disclose locations of sanctums with non–Foundation personnel under penalty of <span class='censor'>expulsion and/or indefinite imprisonment</span>.</p><p>Approach Procedure: Agent in charge of sanctum will meet you upon arrival. Entry instructions attached.</p>",
          "Havana": "<p>File #28–I<br />Subject Class: Yellow<br />Real Identity: Delgado Álvarez, Desiderio (del-gah-doh al-vah-rez, deh-see-deh-ree-oh)<br />Last Known Location: Havana, Cuba</p><p>Description: Subject #28–I (hereinafter \"Man in Blood–Soaked Suit\" or \"Desiderio Delgado Álvarez\") is a man of Cuban descent, approximately 42 years old and 192cm in height. Typically seen in a black suit accessorized with apparent coterie paraphernalia, including tie and hat, all with red accents.</p><p>Paradimensional Capabilities: Man in Blood–Soaked Suit does not appear to possess any extraordinary powers aside from peak <span class='censor'>human</span> physical performance, and unusually high skill and accuracy with firearms. (<span class='censor'>Perhaps</span> enhanced <span class='censor'>by a Key?</span>) Approach with caution.</p><p>Sightings: Mr. Álvarez is a longtime resident of Havana. However, no records exist pertaining to subject's childhood or early life. (Likely destroyed upon induction into Coterie, but possibility remains of <span class='censor'>extraterrestrial origin</span>. Either way, his identity may be an alias.) Mr. Álvarez is known to frequent a nightclub known as Cafe Luna.</p><p>Note: Foundation has no knowledge pertaining to any Key in Havana, however, Mr. Álvarez is likely to know location of other Keys.</p><p>Approach Procedure: Open negotiations with subject to acquire location of Coterie vaults and/or hideouts. If he does not cooperate, subdue and interrogate. More information available in Moscow office (File #26–G4).</p>",
          "Shanghai": "<p>File #32–J<br />Asset Name: Flint, Li<br />Area of Operation: Shanghai, China</p><p>Profile: Recently acquired agent in charge of undisclosed cell reporting directly to Commissioner Taylor.</p><p>Current Assignment: According to recent report, asset has split from rest of cell and is currently in Shanghai investigating whereabouts of subject #46–Q.</p><p>Notes: Asset loyalty to Foundation cause is unsure. Extreme vigilance recommended.</p>",
          "Anchorage": "<p>File #33–K<br />Subject Class: Yellow<br />Real Identity: Unknown.<br />Last Known Location: Anchorage, Alaska.</p><p>Description: Subject #33–K (hereinafter \"Thorne\") is a tall, gaunt person with androgynous features and fair complexion. Prefers practical, loose–fitting clothing. Subject appears to be <span class='censor'>of Anglo–Celtic descent</span> and conjectured to be far older than they appear (collaborating source suggests D.O.B. in <span class='censor'>1761</span>). Subject wears a distinct red cravat around their neck, often obscuring their face.</p><p>Paradimensional Capabilities: Subject possesses acute sensitivity to <span class='censor'>otherworldly residue</span>. Coterie leverages these capabilities to locate <span class='censor'>otherworldly</span> artifacts and track movement of <span class='censor'>paradimensional entities</span>.</p><p>Sightings: Numerous sightings across the globe. Profiled as one of the most mobile Coterie members. Despite notorious secrecy, Thorne has a reputation for appraising and acquiring <span class='censor'>paradimensional</span> artifacts. Analysis suggests they are amenable to business exchange and receptive to haggling. Recent activity suggests Coterie is in a state of <span class='censor'>aggressive acquisition</span>.</p><p>Approach Procedure: You and Thorne likely have similar objectives. Extreme caution suggested. Thorne is likely to negotiate but only on their terms.</p>",
          "Tokyo": "<p>File #37–M<br />Asset Name: Taylor, Qiana<br />Area of Operation: See current assignment status.</p><p>Profile: <span class='censor'>Commissioner Taylor was appointed as head of the Foundation by unanimous consent. Most people will never see the rest of this text, because I really want this whole section to just look like an enormous block of redacted \"who knows what she is up to\" kind of thing, so I will redact it, but somebody in the PDF might still be able to read it, so oh well. Hey, if you're reading this: kudos, that is awesome. I appreciate that you cared enough to go through the effort of figuring out what is here. Thank you for playing. Much love.</span></p><p>Current Assignment: <span class='censor'>Oh, here we go with the rest of the text, then, okay. Commissioner is looking into reports of paradimensional activity in a number of places. Current task list includes</span> Tokyo, Japan; <span class='censor'>Prague, Czechoslovakia; and</span> Lagos, Nigeria.</p>",
          "Alexandria": "<p>File #38–N<br />Subject Class: Red<br />Real Identity: Unknown<br />Last Known Location: Alexandria, Egypt</p><p>Description: Subject #38–N (hereinafter \"Beast in Cowl of Crimson\") is a roughly humanoid figure, approximately 183cm in height, clothed in a red cloak. The hood of this cloak effectively masks the figure's identity (very likely to be <span class='censor'>extraterrestrial</span> in origin). Only appendage as of yet observed is a set of <span class='censor'>wolflike</span> claws <span class='censor'>covered in gray fur</span>, hence the moniker. <span class='censor'>Inhuman origin</span> seems likely.</p><p>Paradimensional Capabilities: Beast in Cowl of Crimson appears to have high aptitude for physical confrontation. Prior encounters have led to <span class='censor'>the deaths of several agents</span>. Victims are <span class='censor'>eviscerated</span> and <span class='censor'>left to bleed out</span>, or <span class='censor'>partially devoured and battered around like a bored cat playing with its food</span>. Extreme caution is advised.</p><p>Sightings: Beast in Cowl of Crimson is prime suspect in several gruesome murders throughout Alexandria.</p><p>Note: Paradimensional implement (aka \"Key\") known to exist in Alexandria. Coterie element may be using key to <span class='censor'>transform or mutate their body</span>.</p><p>Approach Procedure: Subdue subject with extreme prejudice and acquire paradimensional implement for further study.</p>",
          "DrIrawan": "<p>File #44–O/55–X<br />Asset Name: Irawan, Dewi<br />Area of Operation: Southern Hemisphere</p><p>Profile: Prominent zoologist has published several surveys regarding disappearing wildlife. Zoologist claims entire species and the memory of their existence are being erased. Possible <span class='censor'>paracausal</span> disturbance.</p>",
          "Sydney": "<p>File #49–R<br />Asset Name: Quinn, Ari<br />Area of Operation: Sydney, Australia</p><p>Profile: Field researcher in charge of paradimensional analysis. Despite recent events, asset has not yet requested transfer. Recommend continued psychiatric evaluation.</p><p>Current Assignment: Agent Quinn is currently performing independent research regarding recent paradimensional disturbances.</p>",
          "YborCity": "<p>File #52–U<br />Sanctum Class: Yellow<br />Sanctum Location: Ybor City, Florida</p><p>Description: Sanctum #52–U is an abandoned cigar factory in Ybor City, north of McKay Bay.</p><p>Sightings: Subject #28–I known to frequent sanctum. Be on alert.</p><p>Approach Procedure: Enter with caution and search for signs of paradimensional implements. Take any and all evidence into Foundation custody.</p>",
          "Kathmandu": "<p>File #53–V<br />Subject Class: Undetermined<br />Real Identity: Uperetria, Aliki Zoni (oo-peh-reh-tree- ah, a-lee-kee zoh-nee)<br />Last Known Location: Kathmandu, Nepal</p><p>Description: Subject #53–V (hereinafter \"Maid With Scarlet Sash\") appears as a teenage girl of unknown descent wearing a white dress and red sash. <span class='censor'>It is unclear as of now whether such physical form is a true representation or a false image</span>.</p><p>Paradimensional Capabilities: <span class='censor'>Aliki is thought to possess uncanny knowledge beyond her years, and is likely much, much older than she appears. Foundation has yet to confirm paradimensional capabilities of bound key, if any. Subject may be incorporeal</span>.</p><p>Sightings: Locals in region have reported seeing a \"spirit\" matching subject's description, heralded by a high–pitched whistling sound. Unclear if <span class='censor'>Maid with Scarlet Sash is indeed ectoplasmic in nature, or if her paradimensional abilities reinforce such a description</span>.</p><p>Approach Procedure: Subject Risk Class uncomfirmed. Do not approach.</p>",
          "Nairobi": "<p>File #54–W<br />Subject Class: Green<br />Real Identity: Masai, Tuwile (muh-sah-ee, t-wayl)<br />Last Known Location: Nairobi, Kenya</p><p>Description: Subject #54–W (hereinafter \"Tuwile Masai\") is a slim man of Kenyan descent, middle–aged, and 176cm in height. Coterie signifiers include large red spectacles, <span class='censor'>access to and disposal</span> of <span class='censor'>Coterie funding</span>, and <span class='censor'>confirmed contact</span> with Coterie operatives. Subject has written and published openly under their name in numerous geological and archeological periodicals.</p><p>Paradimensional Capabilities: No known reports. Subject appears to possess no such capabilities, or has successfully hidden <span class='censor'>several bound paradimensional implements</span> from Foundation intelligence.</p><p>Sightings: Tuwile Masai teaches under a fellowship at Oxford University and has published numerous surveys on work at and around Lake Victoria.</p><p>Approach Procedure: Masai has spurned all Foundation contact thus far. Operatives may wish to approach only if Masai has reason to trust them.</p>"
        }
      },
      "zh": {
        "dossierHeading": "你可以在任何时候阅读此密档",
        "dossiers": {
          "Marrakesh": "<p>档案#11–B<br/>客体等级：红色<br/>真实身份：未知<br/>最后目击地点：摩洛哥，马拉喀什</p><p>描述：客体#11-B(后称“苋”)是一位欧裔女子，外貌为20岁前半。她通常戴着一朵半遮住脸庞的红色大花。</p><p>超维能力：具有<span class='censor'>转移生命和死亡的</span>力量。能通过超维手段运输<span class='censor'>能量</span>，<span class='censor'>以治愈受伤的实体</span>，或<span class='censor'>从活物身上汲取生命</span>。没有记录显示这种<span class='censor'>能量交换</span>的限制为何，当前数据仅限于小型事件。客体需要通过实际接触完成<span class='censor'>转移生命</span>，这限制了传输的规模。可能带来<span class='censor'>末日般</span>的后果。</p><p>目击记录：1.1923年11月23日——马萨诸塞州，阿卡姆。特工报告客体治疗了附近的<span class='censor'>同志会</span>成员，<span class='censor'>被吸干养分并枯萎的</span>是周围的树木。接下来数月<span class='censor'>异界存在与超维</span>活动有所增加。</p><p class='indent'>2.1924年1月11日——葡萄牙，里斯本。当地特别小组逮捕了客体。确认有<span class='censor'>物理</span>接触。一名小组成员立刻死亡，第二名受害者依然为木僵状态。客体逃脱了盘问。</p><p class='indent'>3.马拉喀什有未确认的目击。需要更多情报。请求紧急支援。</p><p>处理流程：客体十分危险。接近必须保持极高警惕。严禁物理接触。更多信息参见旧金山分部(档案#26-G2)。</p>",
          "BuenosAires": "<p>档案#16–D<br/>客体等级：黄色<br/>真实身份：未知<br/>最后目击地点：阿根廷，布宜诺斯艾利斯</p><p>描述：客体#16-D(后称“深红外套的女孩”)，外貌为阿根廷裔(也许是<span class='censor'>人类</span>后裔？)，20岁前半，高约165厘米。尚未检测到<span class='censor'>异形</span>存在。该同志会成员随身穿着一件红色大衣，戴的帽子也有红色系带，具有超维能力(见下详述)。当地人称之为“红衣女郎”(无疑是出自其装束，但此名是褒是贬尚不得知)。</p><p>超维能力： 据当地政府报告，深红外套的女孩要么<span class='censor'>拥有超物理速度</span>，要么具有<span class='censor'>灵体投射</span>的能力。尽管多次尝试，当地政府依然无法捕获客体。（她是否操纵了<span class='censor'>黑暗</span>和<span class='censor'>诡影</span>？抑或只是单纯善于逃脱监视？)客体貌似倾向于避免冲突。因此，迄今为止尚未发现有当地伤亡与深红外套的女孩有关。</p><p>(不能排除情况升级为暴力冲突的可能。)</p><p>目击记录：深红外套的女孩与布宜诺斯艾利斯多起知名盗窃案相关。当地媒体报道她依然在潜逃。</p><p>处理流程： 尽管深红外套的女孩看上去是<span class='censor'>同志会</span>的成员，但她并未表现出敌意。有人听到她能说流利的西班牙语、葡萄牙语、法语和英语。综合以上因素，我们相信可以与客体交涉和/或询问。建议抓捕客体并询问<span class='censor'>同志会</span>的动机。</p><p>相关人士：马蒂亚斯·玻利瓦尔警长，负责抓捕深红外套的女孩。(可能成为支援？)</p>",
          "Constantinople": "<p>档案#21–F<br/>客体等级：绿色<br/>真实身份：艾婕·萨辛<br/>最后目击地点：土耳其，君士坦丁堡</p><p>描述：客体#21-F(后称“朱红头巾女士”或其真名“艾婕·萨辛”)是一位土耳其裔妇女，34岁，高约161cm。尚未得知这是客体的<span class='censor'>真实形态</span>、易容，抑或假身份。客体总是戴着传统头巾，但颜色却是非同一般的深红。可能是标志同志会身份的物品，<span class='censor'>或超维绑定</span>。</p><p>超维能力：朱红头巾女士貌似不具备此种能力；或其成功对基金会情报人员隐瞒了能力。</p><p>目击记录：艾婕·萨辛是一位知名的艺术收藏家，是君士坦丁堡的土耳其与穆斯林艺术博物馆的馆长，主持馆内运营。她的一切意图<span class='censor'>及行为模式在任何实质层面上</span>都与普通人无异。(注意：上峰怀疑<span class='censor'>艾婕·萨辛是一个精心编造的掩护身份，但没有证据支持这些推测</span>。)</p><p>处理流程：已有基金会特使接触艾婕。安排会面，询问对方意图。</p>",
          "Sanctums": "<p>档案#26–G1–6<br />圣堂等级：绿色<br />圣堂地点：<span class='censor'>南非联邦开普敦</span>、加利福尼亚旧金山、<span class='censor'>韩国首尔</span>、俄国莫斯科、<span class='censor'>比利时布鲁日</span>、<span class='censor'>瑞士伯尔尼</span>。</p><p>描述：圣堂#26-G1遍布六国，是基金会的分支机构与存放超维神器的地点。切勿与非基金会人员透露圣堂地点，否则将处以<span class='censor'>革职及/或无限期监禁</span>。</p><p>处理流程：负责圣堂的特工会在你抵达时负责会面。内附进入指示。</p>",
          "Havana": "<p>档案#28–I<br />客体等级：黄色<br />真实身份：德西德柔·戴佳多·欧瓦瑞兹<br />最后目击地点：古巴，哈瓦那</p><p>描述：客体#28-I(后称“西装浸血的男子”或“德西德柔·戴佳多·欧瓦瑞兹”)是一名古巴裔男子，约42岁，高192厘米。常着黑西装，带有典型同志会特征的配饰：包括领带和礼帽，皆为红色。</p><p>超维能力：西装浸血的男子貌似不具备任何超凡能力，但具有卓越的<span class='censor'>人类</span>身体素质，以及非同凡响的枪械技能和准度。(<span class='censor'>或许受到“钥匙”的</span>强化？)小心接近。</p><p>目击记录：欧瓦瑞兹先生是哈瓦那的长期居民。不过，没有任何有关客体童年或早期生活的记录现存。（似乎在加入同志会时销毁，但可能<span class='censor'>来自地外</span>。无论如何，其身份可能只是化名。)据悉，欧瓦瑞兹先生常常前往一家名叫月下餐厅的夜店。</p><p>注意：基金会对于哈瓦那是否有钥匙一无所知，但欧瓦瑞兹先生可能知道其他钥匙的所在地点。</p><p>处理流程：与客体公开谈判，获取同志会宝库和/或藏身地的位置。如果对方不予合作，直接制服，加以盘问。更多信息参见莫斯科分部(档案#26-G4)。</p>",
          "Shanghai": "<p>档案#32–J<br />支援名称：李福林<br />行动区域：中国，上海</p><p>简介：近期招募的特工，负责秘密特别行动小组，直接对泰勒专员报告。</p><p>当前任务：根据最新报告，该支援人员已与其特别小组分头行动，近期在上海调查客体#46-Q的下落。</p><p>注意：该支援人员对基金会的忠诚尚不确定，建议保持最高警惕。</p>",
          "Anchorage": "<p>档案#33–K<br />客体等级：黄色<br />真实身份：未知<br />最后目击地点：阿拉斯加，安克雷奇。</p><p>描述：客体#33-K(后称“索恩”)高挑纤瘦，长相中性，皮肤苍白。穿着宽松、实用衣物。客体貌似<span class='censor'>为盎格鲁-凯尔特裔</span>， 据推测远比表现得年长(经情报整理，可能出生于<span class='censor'>1761年</span>)。客体颈部戴有红色长巾，十分显眼，常遮住面容。</p><p>超维能力：客体对<span class='censor'>异界残留物</span>具备敏感的感知。同志会运用此能力定位异界神器，追踪<span class='censor'>超维实体</span>的移动。</p><p>目击记录：全球各地有多处目击。为同志会成员中最常移动的一员。尽管其神秘为人所知，但索恩评估和获取<span class='censor'>超维神器</span>的本事可谓著名。分析显示对方可以接受商业交换和讨价还价。但最近的活动表明同志会现在<span class='censor'>正处于大肆收购的状态</span>。</p><p>处理流程：你和索恩貌似目标相似。建议保持极高警惕。索恩不拒绝谈判，但前提是接受其条件。</p>",
          "Tokyo": "<p>档案#37–M<br />支援名称：齐阿娜·泰勒<br />行动区域：见当前任务状况</p><p>简介：<span class='censor'>泰勒专员经一致同意被任命为基金会负责人。大多数人可能永远看不到这段文字的其余部分，因为我希望这部分内容看起来像一大块被涂黑的“谁知道她在干什么”之类的东西，所以我把它涂黑了，但PDF里的某些人可能还是能看到，所以算了。嘿，如果你看到了这段文字：太棒了！感谢你花时间弄清楚这里的内容。谢谢你的参与。爱你。译者注：FFG官网里的英文剧本书黑条里面就是这些文字，类似于彩蛋性质。很遗憾简中实体版看不到这部分，因此这段文字是网页版限定。</span></p><p>当前任务：<span class='censor'>专员正在调查多地出现的超维现象报告。当前任务清单包括</span>日本东京、<span class='censor'>捷克斯洛伐克布拉格和</span>尼日利亚拉各斯。</p>",
          "Alexandria": "<p>档案#38–N<br />客体等级：红色<br />真实身份：未知<br />最后目击地点：埃及，亚历山大</p><p>描述：客体#38–N(后称“深红斗篷的恶兽”)是一个高约183厘米的类人生物，身披红色斗篷。斗篷完全遮住了客体的面貌特征(可能是<span class='censor'>地外</span>后裔)。目前只观测到客体的部分器官：一对<span class='censor'>狼</span>爪，<span class='censor'>覆盖灰色毛发</span>，客体因此得名。貌似<span class='censor'>非人类起源</span>。</p><p>超维能力： 深红斗篷的恶兽在暴力冲突方面展现出了高度资质。先前的遭遇导致<span class='censor'>多名特工死亡</span>。受害者<span class='censor'>被开膛破肚</span>，<span class='censor'>失血致死</span>，或<span class='censor'>被啃食残缺，宛如无聊的猫戏耍猎物一般被来回蹂躏</span>。建议保持极高警惕。</p><p>目击记录：深红斗篷的恶兽是亚历山大多起残忍谋杀案的首要嫌疑人。</p><p>注意：已知亚历山大存在超维工具(即“钥匙”)。同志会成员可能使用钥匙<span class='censor'>改造或异化其躯体</span>。</p><p>处理流程：极度谨慎地制服客体，获取超维工具，以供进一步研究。</p>",
          "DrIrawan": "<p>档案#44–O/55–X<br />支援名称：戴维·伊拉万<br />行动区域：南半球</p><p>简介：著名动物学家，已出版数本有关失踪野生动物的研究，声称整个物种与其存在相关的记忆都已遭到抹除。可能受到<span class='censor'>反常</span>干扰。</p>",
          "Sydney": "<p>档案#49–R<br />支援名称：阿丽·奎因<br />行动区域：澳大利亚，悉尼</p><p>简介：负责超维分析的实地研究员。尽管最近发生了数起事件，但本支援并未要求转移。建议继续精神评估。</p><p>当前任务：奎因特工正在对最近的超维干扰进行独立研究。</p>",
          "YborCity": "<p>档案#52–U<br />圣堂等级：黄色<br />圣堂地点：佛罗里达，宜博市</p><p>描述：圣堂#52-U是麦凯湾以北宜博市一家废弃的烟厂。</p><p>日志记录：已知客体#28-I常来此处。注意警戒。</p><p>处理流程：小心进入，查找任何有关超维工具的迹象。如有发现，或任何证据，一律收归基金会所有。</p>",
          "Kathmandu": "<p>档案#53–V<br />客体等级：未定<br />真实身份：艾里奇·佐尼·奥佩勒曲亚<br />最后目击地点：尼泊尔，加德满都</p><p>描述：客体#53-V(后称“猩红腰带的少女”)形似一名种族未明的青春期女孩，穿着白裙，系着红色腰带。<span class='censor'>目前尚不清楚这种物理形态是真实存在还是虚假影像。</span>。</p><p>超维能力：<span class='censor'>据信，艾里奇拥有远超其年龄的惊人知识，其实际年龄很可能远大于外貌。基金会尚未确认绑定的钥匙是否具备超维能力(如有)。客体可能为非实体</span>。</p><p>目击记录：当地人声称在高音哨声后见过与客体描述相符的“灵体”。尚不明确<span class='censor'>猩红腰带的少女是否真的是灵体，或者她的超维能力是否印证这种描述</span>。</p><p>处理流程：客体风险等级尚未确定。切勿接近。</p>",
          "Nairobi": "<p>档案#54–W<br />客体等级：绿色<br />真实身份：特瓦耶·马萨伊<br />最后目击地点：肯尼亚，内罗毕</p><p>描述：客体#54-W(后称“特瓦耶·马萨伊”)是一位肯尼亚裔的中年瘦削男子，高176厘米。客体带有同志会特征，包括红色大框眼镜；<span class='censor'>动用与支配同志会资金</span>，并<span class='censor'>已确认接触</span>同志会人员。客体曾在众多地理和考古期刊公开以同志会的名义撰写并发表过文章。</p><p>超维能力：暂无已知报告。客体貌似不具备此种能力；或其成功对基金会情报人员隐瞒了<span class='censor'>数件绑定的超维神器</span>。</p><p>日志记录：特瓦耶·马萨伊在牛津大学担任教职，对维多利亚湖及周边地区发表过众多勘测报告。</p><p>处理流程：迄今为止，马萨伊拒绝了基金会的所有联络。应在马萨伊有理由信赖自己的前提下再予以接触。</p>"
        }
      },
      "chineseGaps": []
    },
    "quidProQuo": {
      "en": {
        "xp": {
          "supplies": "Supplies"
        },
        "label": {
          "ticket": "“We’d like to get around faster.”",
          "supplies": "“We’d like some supplies.”",
          "intel11": "“We’d like some intel on ‘Subject #11–B.’”",
          "intel28": "“We’d like some intel on ‘Subject #28–I.’”"
        },
        "sanFrancisco": "If you are in San Francisco, proceed to _Quid Pro Quo 1_.",
        "moscow": "If you are in Moscow, skip to _Quid Pro Quo 2_.",
        "title": "Quid Pro Quo",
        "body": "<p class='basic'>Check where you are on the map.</p>",
        "quidProQuo1": "<p>_Quid Pro Quo 1_: A set of obscure and overly-complex instructions leads you to a drab two-story stone building on the edge of San Francisco’s Chinatown neighborhood. Inside, a bored attendant slumps behind a desk near a brass elevator. Punching a specific code, the elevator takes you deep underground, farther than you could have predicted. On –14F, you step out and are greeted by an imposing man in a well-tailored suit and black fedora. “Archibald Hudson. We met in London,” he reminds you. “Your cell is quite the talk around the office.” The agent leads you down a seemingly endless hallway lined with alcoves. Each alcove displays something different: a model of a hollow earth, a crystal skull, a map with ley lines and other unknown markings. You pause and look at a half-eaten ear of corn, still steaming.</p><p>“From what I hear, that corn’s been cooked to perfection for the last two decades. So’s the dame who was eating it,” Agent Hudson says grimly. Looking at the paradimensional relics gives you a headache. Your eyes struggle to focus on them: they are both there and not there at the same time. Hudson ushers you down a side hall into a boxy room crammed with metal filing cabinets and sits down behind a heavy wooden desk. He speaks into a ring-and-spring microphone: “File #26–G2. Interview conducted by Hudson, Archibald, designation 42a6-951. That’s Agent Hudson to you,” he arches an eyebrow. Over the next several hours, you answer a gauntlet of grueling questions about your experience thus far, ranging from the past day to your experience in London. When it’s all done, Agent Hudson leans back and lights a cigarette. “I’ll admit, I was skeptical about you from the start. But Commissioner Taylor has good instincts, and I haven’t seen them steer her wrong yet,” he says. “You’ve done good work so far. We have some intel and some resources that might be useful for you. Tell me what the Foundation can do for you.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>“We’d like to get around faster.” The lead investigator adds one copy of Expedited Ticket to their deck. You may _embark_.</li><li>“We’d like some supplies.” Each investigator earns 1 experience. You may embark.</li><li>“We’d like some intel on ‘Subject #11–B.’” Skip to _Quid Pro Quo 3_. Choose this option only if you have not yet visited Marrakesh.</li></ul>",
        "quidProQuo2": "<p>_Quid Pro Quo 2_: The Foundation’s base of operations in Moscow is just a five minute walk from St. Basil’s Cathedral: a nondescript door set into a modern constructivist structure overlooking a cobbled street. The corridor inside feeds into a cramped stairwell that descends deeper than you could have anticipated, to a red door set in a flaking whitewashed wall. After identifying yourself, you are led into a long well-lit hallway with lavish carpeting.</p><p>“It seems you follow instructions well,” says a voice. You turn to see a tall, athletic woman in a well-tailored suit. “Valeriya Antonova. We have met before. Call me Lera. Please, follow me.” Agent Antonova leads you through a labyrinthine set of passageways, past a set of double doors, to a white-tiled room flecked with grime and what you hope is red rust. On an operating table in the center, what looks like a person is strapped to a metal slab, restrained with tight leather straps. Looking at the humanoid shape makes your head swim: its features are blurred as if in constant motion, like a hummingbird in flight. You catch only glimpses of its features: a stygian eye, clenched teeth, nervous twitching.</p><p>“Lera,” another agent interrupts. “The Komissar needs your attention.” Agent Antonova looks sternly to you. “This is a paradimensional being. Please keep your distance. I will be but a moment away.” The agent leaves. As you look at the sharp implements mounted to the wall of the lab, you wonder what experiments the being has endured. Judging by the subject’s well-tailored black suit, you wonder if it used to be a Foundation agent. After a minute of silence, it begins to flail around on the table, widening and shrinking its “mouth” to a wide dark O, always facing you. You keep your distance, trying to look away.</p><p>“Please excuse me,” Agent Antonova re-enters the room. The being on the table stops flailing. “There is another matter I must attend to. Unfortunately, we do not have the resources to escort you around our facilities, so I must ask you to leave. However, the Foundation does wish to assist in any way it can. Please tell us what we can do for you.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*“We’d like to get around faster.”* The lead investigator adds one copy of Expedited Ticket to their deck. You may _embark_.</li><li>*“We’d like some supplies.”* Each investigator earns 1 experience. You may _embark_.</li><li>*“We’d like some intel on ‘Subject #28–I.’”* Skip to _Quid Pro Quo 4_. Choose this option only if you have not yet visited Havana.</li></ul>",
        "quidProQuo3": "<p>_Quid Pro Quo 3_: Agent Hudson flips through some files and pulls out an updated dossier similar to the one in your possession, but much thicker. “Subject #11–B, calls herself ‘Amaranth.’ But this is not the first Amaranth the Foundation has encountered. She pops back up every few decades, looking completely different each time. This iteration bears a striking resemblance to a former student of a ‘Miskatonic University’ in Massachusetts. Eryn Cochwyn was her name. She’s been missing for some time.” You wonder aloud if it might be a coincidence. “There are no coincidences in our line of work,” he mutters.</p><ul><li>In your Campaign Log, *record the cell knows Amaranth’s real name*.</li><li>You may _embark_.</li></ul>",
        "quidProQuo4": "<p>_Quid Pro Quo 4_: Agent Antonova digs through some old files and pulls out a dossier filled with information on a man named Desiderio Delgado Álvarez. “From what we can tell, ‘Subject #28–I lived a perfectly mundane life in Havana until the age of 19, when his involvement with organized crime drew the attention of the Coterie. “ You wonder aloud if he is a rum-runner, and she shakes her head sternly. “Quite the opposite, in fact. Desiderio’s brother was the one involved in such matters, before his murder at the hands of a rival gang. It seems Desiderio then acquired a Key, and was using it to take revenge. Hence the Coterie involvement. Seeing his talent, they decided to induct him.”</p><ul><li>In your Campaign Log, record *the cell knows Desi’s past*.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "supplies": "补给"
        },
        "label": {
          "ticket": "“我们希望快快上路。”",
          "supplies": "“我们想要一些补给。”",
          "intel11": "“我们想要一些有关‘客体#11-B’的情报。”",
          "intel28": "“我们想要一些有关‘客体#28-I’的情报。”"
        },
        "sanFrancisco": "你在旧金山",
        "moscow": "你在莫斯科",
        "title": "交换条件",
        "body": "<p class='basic'>检查你在地图上的位置。</p>",
        "quidProQuo1": "<p>一连串晦涩又模糊的指示将你引到旧金山唐人街边缘一栋平平无奇的两层石楼。进去桌子后面斜靠着一位百无聊赖的招待员，旁边是一架黄铜电梯。你按下特殊的编码，电梯载着你一路深入，远超你的预期。到了负14层，你才走出电梯，面前是位仪表堂堂的男子，一身西服裁剪合身，还戴着黑色的软呢帽。“阿奇巴德·哈德逊。我们在伦敦见过。”他提醒你，“咱们分部都在聊你的特别小组。”特工带你沿着一条长廊向下，长廊似乎没有尽头，两边装着一个个壁龛。每个壁龛里装载的东西都不一样：有空洞地球的模型，有水晶头骨，还有标明地脉与其他未知标记的地图。你在一个壁龛前驻足，它被啃了一半——甚至还冒着热气。</p><p>“据我所知，这东西大概被烹饪了有二十年了吧，只是为了做到完美。享用它的女士也同样吃了这么久。”哈德逊特工严肃地说。看到这些超维遗物让你头疼不已。盯着可真费眼睛：它们同一时刻既在那儿，又不在那儿。哈德逊引你沿着侧廊走进一间方方正正的屋子，里面塞满了金属档案柜。他来到一张沉重的木桌前坐下。他对一个弹簧围绕的麦克风说道：“档案#26-G2。阿奇巴德·哈德逊主持的谈话。代号42a6-951。称呼我哈德逊特工就行。”他说着抬起了眉毛。接下来的几个小时，你回答了一连串问题，叫人精疲力尽，苦不堪言，将自己伦敦之后的经历说了个遍。终于问完了。哈德逊特工向后一倒，点了一根香烟。“我得承认，一开始我还对你有所怀疑。但泰勒专员的直觉很准，我还没见过有谁能牵着她的鼻子走。”他说，“你到现在都干得不错。我们有一些情报和资源，可能对你有用。告诉我，基金会能为你做什么？”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*“我们希望快快上路。”*调查员队长将一张快捷旅票加入自己牌库。你可以_启程_。</li><li>*“我们想要一些补给。”*每位调查员取得1点经验值。你可以_启程_。</li><li>*“我们想要一些有关‘客体#11-B’的情报。”*只有你尚未造访过马拉喀什，才能选择此选项。</li></ul>",
        "quidProQuo2": "<p>基金会在莫斯科的行动基地距离圣巴西尔大教堂只有五分钟的脚程。鹅卵石街道上有一栋现代的构成主义建筑，进去的门倒是平平无奇。里面的走廊通向狭窄的梯井，一路向下，比你想的更深。最终来到一面白漆斑驳的墙，中间有一扇红门。你证实了自己的身份，随即被领入一条长长的门廊，这一路灯光闪耀，地毯华丽。</p><p>“看来你好好地遵照了指示。”一个声音传来，你扭头看见一个精壮高挑的女子，她身上的西装裁剪精致。“瓦莱丽娅·安东诺娃。我们之前见过。叫我莱拉就好。现在，请跟着我。”安东诺娃特工领你走过迷宫一样的过道，穿过一面双扇门，来到白瓷砖的房间。这里满是污垢，红色的印记你只希望是烟尘。屋子中间有一张手术台，金属板上用皮条紧紧束缚住的东西看着像是个人。只是看着这个人形的怪物就让你头晕：它看上去像是一团不停移动的虚影，仿佛是高速飞行的蜂鸟。你只瞥到一眼它的样子：阴暗的眼神，咬紧的牙齿，紧张地扭曲。</p><p>“莱拉，”另一个特工打断道，“政委找你。”安东诺娃特工严厉地看了你一眼：“这是超维存在。请保持距离。我要失陪一会儿。”她说完就走了。你看着墙上挂的尖利工具，不禁疑惑到底进行的是什么实验。从客体精致的黑西装来看，你甚至怀疑这之前是不是基金会的一名特工。它静止了一分钟，随即又在台上乱扭，张大又闭上“嘴巴”，对着你露出一个庞大黑暗的“O”。你离它远点，尽量看着别处。</p><p>“不好意思。”安东诺娃特工又进来了，台子上的东西停止扯动。“我得处理别的事情。抱歉我们没有人手陪你在设施里参观，所以我现在必须请你离开。不过，基金会愿意尽力提供帮助。还请告知我们能为你做些什么。”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*“我们希望快快上路。”*调查员队长将一张快捷旅票加入自己牌库。你可以_启程_。</li><li>*“我们想要一些补给。”*每位调查员取得1点经验值。你可以_启程_。</li><li>*“我们想要一些有关‘客体#28-I’的情报。”*只有你尚未造访过哈瓦那，才能选择此选项。</li></ul>",
        "quidProQuo3": "<p>哈德逊特工翻阅文件，递给你一份最新的密档，与你手上的相仿，只是厚得多。“客体#11-B，自称‘苋’。但这并非基金会遇到的第一个苋。她每过几十年就出来兴风作浪一番，每次的样子都不相同。本次的个体与一名之前在马萨诸塞州的‘米斯卡塔尼克大学’就读的学生极为相似。她的名字是艾琳·科奇温。此人失踪已有一段时间。”你提问这会不会只是巧合。“我们的工作不存在巧合。”他嘟囔道。</p><ul><li>在剧本日志中，记录下*特别小组知道了苋的真名*。</li><li>你可以_启程_。</li></ul>",
        "quidProQuo4": "<p>安东诺娃特工从一堆旧文件中翻出一份密档，上面记载了的信息是一个名叫德西德柔·戴佳多·欧瓦瑞兹的男子。“据我们所知，‘客体#28-I’小时候在哈瓦那过着非常平凡的生活，直到19岁牵扯进一场组织犯罪，引起了同志会的注意。”你问他是不是个私酒贩子，但安东诺娃特工严肃地摇了摇头。“事实恰恰相反。德西德柔的兄弟才牵涉其中，之后被敌对帮派谋杀。德西德柔貌似拥有钥匙，并用于复仇，由此就牵涉了同志会。同志会发现了他的才能，决定吸引他入会。”</p><ul><li>在剧本日志中，记录下*特别小组知道了德西的过往*。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "specialDelivery": {
      "en": {
        "title": "Special Delivery",
        "body": "Check the Campaign Log and where you are on the map.",
        "deliveringIntel": "*If the cell is delivering Foundation intel…*",
        "deliveringIntelInTokyo": "…and you are in Tokyo, skip to _Special Delivery 2_.",
        "deliveringIntelInLagos": "…and you are in Lagos, skip to _Special Delivery 4_.",
        "notDeliveringIntel": "If the above entry is not recorded…",
        "notDeliveringIntelInTokyo": "…and you are in Tokyo, proceed to _Special Delivery 1_.",
        "notDeliveringIntelInLagos": "…and you are in Lagos, skip to _Special Delivery 3_.",
        "label": {
          "chooseToken": "Choose any number token in the chaos bag. Replace it with a number token of a value 1 higher"
        },
        "specialDelivery1": "<p>_Special Delivery 1_: Soon after arriving in Tokyo, you wander the city’s winding streets in the rain before sitting down at a food stall. Before you can order, a figure in a trenchcoat and wide-brimmed hat sits down next to you and whispers a phrase in a crisp British accent: “Six lions prowl at dusk.”</p><p>The phrase’s significance dawns on you after a moment, and you hurriedly recite the callback the Foundation operatives taught you: “A pride feasts in darkness.” The person next to you lowers the wide brim of her coat to reveal herself as Commissioner Taylor. She orders ramen for you both and looks away. “Before you ask: No, this is not a coincidence, and no, I will not tell you how I knew you would be here. It is my job to know more than you.”</p><p>You tell her she seems as brusque as usual, and a faint smile tugs at the edge of her lips. “Familiarity breeds liability, so let us keep this professional. Tell me what you have learned so far.” You shoot a worried look at the crowd around you. The commissioner shakes her head. “I saw to it that you were not followed. Talk.” Your eyes wander to the gun holstered to her belt, and you wonder what lengths she went to in the name of privacy.</p><p>Digging into the steaming bowl of ramen, you recount your findings so far. The rain falls hard around you, mingling with the smell of grilled meats and sweet spices. You spy a flash of red in the crowd, but when you look, all you see is the reflection on a blood-red fan. The commissioner snaps her fingers and you continue. Once you finish your report, Taylor pays for the meal and stands.</p><p>“It sounds as though your efforts are, shall we say, adequate?” she says primly. “However, the Foundation has a request. We need you to deliver a package to our sanctum in Lagos. Please see that it is delivered safely.” She hands you a sheaf of documents bound with cord.</p><ul><li>In your Campaign Log, record *the cell is delivering intel*. Each investigator must add one copy of Foundation Intel to their deck. It does not count toward their deck size. This card can be found in the *Globetrotting* encounter set, indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "specialDelivery2": "<p>_Special Delivery 2_: Threading your way through crowded streets, you meet a shrouded figure in a back alley. Reciting a phrase written in your instructions, you whisper: “Six lions prowl at dusk.” The figure lowers the brim of their hat and recites the callback: “A pride feasts in darkness.” Relaxing your guard, you hand the Foundation operative the documents, and they retreat into the shadows.</p><ul><li>In your Campaign Log, cross off *the cell is delivering intel*. Each investigator removes one copy of Foundation Intel from their deck. Choose any number token in the chaos bag. Replace it with a number token of a value 1 higher (*i.e. You may replace a 0 token with a +1 token, or a –3 token with a –2 token*).</li><li>You may _embark_.</li></ul>",
        "specialDelivery3": "<p>_Special Delivery 3_: Following a set of coded directions from the Foundation, you follow a packed road to a small cafe in the heart of Lagos. Seated on a veranda overlooking a bustling market is Commissioner Taylor, nursing a glass filled with a deep red liquid. As you approach, she shuffles a deck of playing cards with one hand and looks up at you.</p><p>“You can clearly follow directions,” she says, gesturing for you to sit across from her. “But do you know how to play whist?” A warm breeze stirs the air as you take your seat and Taylor deals you each thirteen cards, then reveals the top of the deck: a one-eyed jack. “Now talk.” As you play, the commissioner asks you questions about your findings around the globe. As the final trump card is revealed, Taylor looks you dead in the eyes.</p><p>“We have identified thirteen members of the Coterie so far, but evidence suggests there are more. Far more. Even if we catch one, the organization will persist. And that’s to speak nothing of their many operatives and minions. It would be like trying to remove an anthill by catching individual ants.” You ask the commissioner what she is getting at and she lays down her last card with a smirk. “The way to bring them down is to cut them off at their source.”</p><p>You play your last card: a near loss. Taylor gathers the cards up. “I win this time, but I look forward to our next game,” she sips her drink. “Do not forget what I said. Find where they congregate.” As she speaks, a towering suit approaches from the side of the building and whispers in her ear. “I am sorry to cut this short, but I have business in Monaco. Unfortunately, I don’t have time to deliver these documents—see that these reach our operatives in Tokyo.”</p><ul><li>In your Campaign Log, record *the cell is delivering intel*. Each investigator must add one copy of Foundation Intel to their deck. It does not count toward their deck size. This card can be found in the *Globetrotting* encounter set, indicated by the following icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "specialDelivery4": "<p>_Special Delivery 4_: After putting into port, you find a warehouse marked with 39-0 and a logo of a red lion, per the instructions given to you by the Foundation. Once inside, you deliver Commissioner Taylor’s documents to a steely-eyed operative, who thanks you before melting into the shadows.</p><ul><li>In your Campaign Log, cross off *the cell is delivering intel*. Each investigator removes one copy of Foundation Intel from their deck. Choose any number token in the chaos bag. Replace it with a number token of a value 1 higher (*i.e. You may replace a 0 token with a +1 token, or a –3 token with a –2 token*).</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "title": "特快专递",
        "body": "检查剧本日志和你在地图上的位置。",
        "deliveringIntel": "*特别小组正在传递情报……*",
        "deliveringIntelInTokyo": "…且你在东京。",
        "deliveringIntelInLagos": "…且你在拉各斯。",
        "notDeliveringIntel": "如果上述条目未记录……",
        "notDeliveringIntelInTokyo": "…且你在东京。",
        "notDeliveringIntelInLagos": "…且你在拉各斯。",
        "label": {
          "chooseToken": "选择混乱袋中任一数字标记。将其替换为比原来数值高1的标记"
        },
        "specialDelivery1": "<p>你到了东京，正巧下雨。你穿过城中蜿蜒的小巷，在一家小摊前驻足。你还没点单，一个身穿大衣、戴宽沿帽的身影就坐在了旁边，一口清脆的不列颠口音低语道：“六狮伏于夜。”</p><p>你略顿一顿，意识到这句话的重要，匆忙念出基金会教会你的口令：“享宴尽饕餮。”坐在你旁边的人拉下领子，你看到了泰勒专员。她给你和自己各点了一份拉面，看向别处：“我知道你要问什么：不，这不是偶遇；不，我不会说是怎么知道你来的。我的工作就该知道的比你多。”</p><p>你说她真是一如既往地粗鲁，这话倒让她唇边扬起一个淡淡的微笑。“打成一片，反而不好办事。我们还是公事公办。说说你都打听到了什么。”你担忧地环顾四周的人群。专员摇了摇头：“我确保了你没被跟踪，给我交代。”你望向她皮带上的枪，好奇她为了保密能做到什么地步。</p><p>你对着热气腾腾的拉面历数自己迄今为止的发现。身边的雨越来越大，混杂着烤肉和甜料的香味。你发现人群中飘过一缕红色，但你看过去的时候，只发现了一面血红色扇子上的倒影。专员按按指节，你继续报告。等你说完，泰勒付了账，站起来。</p><p>“听起来你干的，怎么说，还行？”她一本正经地说道，“不过，基金会另有需求。我们要你送一份包裹到拉各斯的圣堂去。务必平安送抵。”她交给你一沓用粗绳绑好的文件。</p><ul><li>在剧本日志中，记录下*特别小组正在传递情报*。每位调查员必须将一张基金会情报加入自己牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "specialDelivery2": "<p>你穿过狭窄的街道，在后巷碰见了一个隐蔽的身影。你念出自己收到的指示上面的话：“六狮伏于夜。”那个身影压低帽沿，回道：“享宴尽饕餮。”你放下戒备，将文件交给了基金会的人，对方退入了阴影。</p><ul><li>在剧本日志中，划掉*特别小组正在传递情报*。每位调查员从自己牌库移除一张基金会情报。选择混乱袋中任一数字标记。将其替换为比原来数值高1的标记*(例如，你可以用+1标记替换0标记，或者用-2标记替换-3标记)*。</li><li>你可以_启程_。</li></ul>",
        "specialDelivery3": "<p>你沿着基金会的加密指示，来到拉各斯一家小小的咖啡馆，这里地处市中心的繁忙街道。有个人正坐在露台上俯瞰熙攘的市集，手里还捧着一杯深红色的液体——是泰勒专员。你走近的时候，她一手洗过桌上的纸牌，一边抬头看你。</p><p>“你清楚地跟上了指示。”她说着示意你坐在旁边，“会玩惠斯特吗？”暖风吹过，你坐了下来。泰勒给你发了十三张牌，掀开第一张：是个J。“现在，给我交代。”你们玩牌的时候，专员问你在全球有何发现。最后一张王牌掀开的时候，泰勒死死地盯住你。</p><p>“我们现在已经确认了同志会十三个成员的身份。但证据显示还有更多，多得多。即便我们抓了一个，组织还是存续，更不要说他们的手下和爪牙。这感觉就像蚍蜉撼树。”你问专员她都在忙什么，她放下自己的最后一张牌，露出一个坏笑：“要想解决他们，就得釜底抽薪。”</p><p>你打出自己的最后一张牌，差点就赢了。泰勒把牌收了起来。“这次是我赢了，但我期待下一次。”她抿了一口饮料，“别忘了我说的。找到他们聚在哪里。”她正说着，一个穿着西装的大个子从楼一侧过来，在她耳边低语几句。“很抱歉我们只能谈到这儿了，我在摩洛哥还有事情要处理。不巧，我没时间送出这些文件了——把这些带给我们在东京的人吧。”</p><ul><li>在剧本日志中，记录下*特别小组正在传递情报*。每位调查员必须将一张基金会情报加入自己牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "specialDelivery4": "<p>你靠港之后，按照基金会的指示，找到了一间标着39-0和红狮的仓库。你一进去，就把泰勒专员的文件交给一个眼神冷峻的基金会人士。对方谢过你，遁入了暗影。</p><ul><li>在剧本日志中，划掉*特别小组正在传递情报*。每位调查员从自己牌库移除一张基金会情报。选择混乱袋中任一数字标记。将其替换为比原来数值高1的标记*(例如，你可以用+1标记替换0标记，或者用-2标记替换-3标记)*。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "theCoiledSerpent": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "The Coiled Serpent",
        "label": {
          "keepInquiring": "“Keep inquiring, and let us know when you have something.”",
          "stickAround": "“We’ll stick around and help.”",
          "forgetHer": "“Forget her. We need your help.”"
        },
        "theCoiledSerpent1": "<p>_The Coiled Serpent 1_: You send a missive to Agent Flint ahead of your arrival, setting a meeting place and time—Jing’an Temple at noon. —and head there as soon as you arrive, entering the broad stone courtyard at the temple’s entrance. After a short while, a tourist approaches you and asks in English: “You’re sure you’re alone?” It takes you a moment to realize that the tourist is none other than Flint, in a subtle yet convincing disguise. He narrows his eyes at your stare. “Answer me,” he says, scanning his surroundings.</p><p>You assure him that you haven’t been followed. “Can’t be too careful. Eyes everywhere. I have a lead on one of those Coterie types here in Shanghai, just like the Foundation’s intel suggested. They call her ‘subject #46–Q ,’ aka ‘Lady with Red Parasol.’ Sure enough, she brings that parasol everywhere she goes. As far as Coterie insignias go, it’s not the most subtle.” While he whispers, he pulls a large camera and tripod from his duffel bag and painstakingly sets up a shot of the temple.</p><p>You wonder aloud what in the world Flint is up to. “Stop staring,” he hisses under his breath. Then you spot other tourists taking photos as well, and you realize that Flint is better at blending in than you are. “The last time I saw the lady with the parasol, she was leaving a meeting between several wealthy British and Chinese businessmen—railway men,” he says quietly, head still down. “Women aren’t usually allowed at such meetings. Nor are regular citizens. To be in that room, you have to be able to get the attention of those powerful men. Which means you’re either very powerful, or obscenely wealthy.” Flint takes a few photos, then moves to a new spot and starts the tedious process of focusing the camera all over again. “Within two weeks of that meeting, they announced a lucrative new contract. It seems all their competitors were convinced for one reason or another to step away from the project, which left them to write their own ticket. Name their own price.” He slowly scans the courtyard again, careful to move just his eyes and not his head. “Could be she has leverage on them. Or maybe she’s just that charming. But I’m willing to put my money on it being the influence of a Key. If that’s true, it’s imperative that we’re not made.” Flint’s paranoia is infectious.</p><p class='basic'>Check the Campaign Log.</p>",
        "toldTheTruth": "*If the cell told the truth to Taylor*, proceed to _The Coiled Serpent 2_.",
        "hidTheTruth": "*If the cell hid the truth from Taylor*, skip to _The Coiled Serpent 3_.",
        "theCoiledSerpent2": "<p>_The Coiled Serpent 2_: “Look, I would tell you more, maybe even let you help me out here, but you’ve made it pretty clear you’re a bit chatty, and the last thing I need is the Coterie figuring out I’m on to them. So, how about we split up? Keep doing what you’re doing, and I’ll contact you when I have a good lead.” Without letting you protest, Flint packs up his camera and leaves.</p><ul><li>In your Campaign Log, record *Flint is working solo*.</li><li> In your Campaign Log, find the 6th spot from the current time. Under that spot, write “_ψ_.” (*When you reach it, proceed to status report psi _ψ_ in the Status Reports section of the Campaign Guide.*)</li><li>You may _embark_.</li></ul>",
        "theCoiledSerpent3": "<p>_The Coiled Serpent 3_: “It will take some time to learn more about her and find the right opportunity to apprehend her,” Flint says quietly. “I saw how you acted with Taylor. I trust you to be discreet. So, I’ll contact you when I have a good lead. Or, I suppose you could stay and aid my investigation here.”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*“Keep inquiring, and let us know when you have something.”* Proceed to _The Coiled Serpent 4_.</li><li>*“We’ll stick around and help.”* Skip to _The Coiled Serpent 5_.</li><li>*“Forget her. We need your help.”* Skip to _The Coiled Serpent 6_.</li></ul>",
        "theCoiledSerpent4": "<p>_The Coiled Serpent 4_: “Happy hunting, then,” Flint says with a nod. He hands you a slip of paper with his hotel, room number, and alias scribbled down on it. “In case you need to get in touch. I’ll send you a telegram when I know more. At least your travel expenses are on government dime, right?”</p><ul><li>In your Campaign Log, record *Flint is working solo*.</li><li>In your Campaign Log, find the 6th spot from the current time. Under that spot, write “_ψ_.” (*When you reach it, proceed to status report psi _ψ_ in the Status Reports section of the Campaign Guide.*) If there is fewer than 6 time remaining under “Time Passed,” write “_ψ_” under the final spot, instead</li><li>You may _embark_.</li></ul>",
        "theCoiledSerpent5": "<p>_The Coiled Serpent 5_: Over the course of several weeks, you manage to strike up a relationship with some of your quarry’s business associates—titans of industry in the fields of mining and railroad construction. You bide your time, earning a bit of their confidence, and it isn’t long before they mention the lady with the red parasol, whom they call Tzu San Niang. Her silver tongue and negotiating skills are apparently the thing of legend. One remarks, with a dreadful laugh, of her ability to convince worker unions to tolerate abysmal conditions, and local governments to accept the extraction of natural resources without batting an eye. Under the guise of needing her help for a project, you inquire about how to contact her. Your contacts inform you that she’s just landed a deal in Hong Kong and is already on her way there.</p><ul><li>In your Campaign Log, record *the cell aided in Flint’s investigation*.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>In the Southeast Asia section of the Campaign Log, find Hong Kong. In its spot, write “50–S.” You are now allowed to travel to Hong Kong whenever you embark.</li><li>Mark 3 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "theCoiledSerpent6": "<p>_The Coiled Serpent 6_: Flint gives you a frustrated look. “Really? After all this work?” You explain to him that if the lady with the red parasol is as elusive and dangerous as she seems, it might be more prudent to work on other, more pressing cases. “I suppose you might have a point. Seems like a waste, though. I’ll make sure to report in with the Commissioner so she’s aware of what’s going on here, though. Maybe they can send somebody else to…” he trails off, then shakes his head. “Nah. They’d just muck it up.”</p><ul><li>In your Campaign Log, record *Flint abandoned his search*. Any one investigator may choose to add the Inspector Flint story asset to their deck. It does not count toward their deck size. This card can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "衔尾蛇",
        "label": {
          "keepInquiring": "“继续打探，要是得知什么就告诉我们。”",
          "stickAround": "“我们会留下来帮你。”",
          "forgetHer": "“忘了她吧，我们需要你的帮助。”"
        },
        "theCoiledSerpent1": "你来之前给福林特工寄了封信，定好了会面的时间和地点——中午时分，在静安寺碰头——你一到上海，就马不停蹄地赶了过去，走进寺庙入口处宽阔的石板庭院。不多时，一个游客朝你走来，用英语问道：“你确定自己是一个人吗？”你花了一会儿，才认出来者不是旁人，正是福林。他的易容虽然简单，倒也逼真。他看到你瞪着他，眯起了眼睛。“回答我。”他说着扫视周围。</p><p>你向他保证自己没被跟踪。“不得不小心啊。到处都是眼线。正如基金会的情报所说，我在上海盯上了一个同志会的。他们称她‘客体#46-Q’，即‘红伞夫人’。她肯定去哪都带着那把伞。同志会的记号到了哪儿都是那么显眼。”他轻声说着，一边从旅行袋里拿出一台巨大的照相机和三脚架，颇费功夫地拍了一张寺庙的照片。</p><p>你好奇福林这是唱的哪一出。“别盯着我了。”他从牙关间挤出一句话来。你接着就发现其他游客也在拍照，福林显然比你更融入他们。“我上一次看到红伞夫人，她刚跟几个富有的英国和中国商人开完会——都是铁路大亨。”他头都没抬起来，轻轻地说道。“女人一般是不能出席这种会议的。一般人更不行。要想进去，就得吸引大人物的注意，也就是说你要么自己有势力，要么有钱得吓人。”福林又拍了几张照片，然后换了个地方，从头继续这种聚焦的无聊把戏。“会刚开了两个礼拜，他们就宣布了一项新合同，可以赚得盆满钵满。一个接一个的理由说服了所有的竞争者，竞相远离这个项目，任凭他们自己提出方案，漫天开价。”他又一次缓缓扫视庭院，小心翼翼，只动眼睛，不动脑袋。“也许是她用了什么手段，或者她就是迷人。但我敢打赌，肯定是钥匙的影响。要真是这样，我们可不能上钩。”福林的偏执也传染到了你身上。</p><p class='basic'>检查剧本日志。</p>",
        "toldTheTruth": "*特别小组将真相告诉了泰勒*",
        "hidTheTruth": "*特别小组对泰勒隐瞒真相*",
        "theCoiledSerpent2": "<p>“唔，我本来是能再告诉你点东西的，甚至想让你帮帮我。但你显然是个大嘴巴，而我可千万不能让同志会发现我盯上他们了。所以，我们分头行动吧？你继续干你的，我要是找到重大线索就联系你。”福林不顾你的反对，收起相机走了。</p><ul><li>在剧本日志中，记录*福林独自行动*。</li><li>在剧本日志中，“流逝的时间”下方，从当前时间起往后数6格。在该格写下“ψ”。*(在你到达该格时，进入剧本手册中，状况报告部分的状况报告普西ψ。)*</li><li>你可以_启程_。</li></ul>",
        "theCoiledSerpent3": "<p>“要了解她的更多情况，找到合适的机会予以羁押，还得花上更多的工夫。”福林悄悄说道，“我看到你是怎么对付泰勒的了。我相信你的谨慎。我要是找到重大线索就联系你。或者，你也可以留在这里协助我调查。”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*“继续打探，要是得知什么就告诉我们。”*</li><li>*“我们会留下来帮你。”*</li><li>*“忘了她吧，我们需要你的帮助。”*</li></ul>",
        "theCoiledSerpent4": "<p>“狩猎愉快。”福林说着点了点头。他交给你一张纸，上面写着酒店房间号，还有一个草草补上的化名。“以防你要联系我。我要是知道了什么，就给你发电报。至少你的旅费应该是政府报销的吧？”</p><ul><li>在剧本日志中，记录*福林独自行动*。</li><li>在剧本日志中，“流逝的时间”下方，从当前时间起往后数6格。在该格写下“ψ”。*(在你到达该格时，进入剧本手册中，状况报告部分的状况报告普西ψ。)*如果“流逝的时间”下已不足6格，则改为在最后一格写下“ψ”。</li><li>你可以_启程_。</li></ul>",
        "theCoiledSerpent5": "<p>你花了几周时间，成功和猎物的商业伙伴建立了关系。这群人都是矿业或铁路营造方面的大亨。你静待时机，赢得了一点信任，他们很快就提起了红伞夫人，称她为朱三娘，她巧舌如簧，谈判技巧堪称传奇。其中一个笑容颇为恶心，提及她的本事能让工会接受糟糕的条件，让当地政府对采掘自然资源睁一只眼闭一只眼。你借口项目需要她的帮助，询问怎么才能联系上她。在座有人告诉你，她刚在香港达成一项交易，正往那儿去了。</p><ul><li>在剧本日志中，记录*特别小组援助福林的调查*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>在剧本日志的东南亚部分，找到香港，在其位置写下“50-S”。从现在开始，每当你启程，可以旅行前往香港。</li><li>在剧本日志中记3_时间_。你可以_启程_。</li></ul>",
        "theCoiledSerpent6": "<p>福林给了你一个沮丧的眼神：“当真？都忙了这么久了？”你解释说，倘若红伞夫人真有那么隐蔽又危险，那么现在去操心别的更紧急的案子才是审慎之举。“我想你可能是说到了点子上。只是听上去之前的努力都白费了。不过要是我跟专员汇报，她想必能明白发生了什么。也许他们会派什么别的人来……”他的声音越来越低，摇了摇头，“不，他们会把一切都搞砸的。”</p><ul><li>在剧本日志中，记录*福林放弃了自己的调查*。任意一位调查员可以将福林探员剧情支援加入其牌库。这张卡牌不计入其牌库卡牌张数。这张卡牌可以在*环球漫游*遭遇组中找到。图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "romulusAndRemus": {
      "en": {
        "title": "Romulus and Remus",
        "body": "Check the Campaign Log.",
        "offMission": "*If the cell is off-mission*, proceed to _Romulus and Remus 1_.",
        "onMission": "Otherwise, skip to _Romulus and Remus 2_.",
        "romulusAndRemus1": "<p>_Romulus and Remus 1_: “This is…possibly one of the worst ideas I’ve ever had,” Agent Quinn remarks as the two of you approach the Palatine Hill. The ruins of numerous temples litter the area, once marvels of luminous white marble, decorated with intricate reliefs of ivory and delicately carved statues; now nothing more than broken vestiges and stone foundations half-buried along the hill. You try your best to reassure Quinn, but she is right—this could easily be a wild goose chase or a trap. Commissioner Taylor would certainly not be happy if she knew her agents were attempting to parley with a member of the Red Coterie. But you suspect that Aliki knows more about the strange disappearances happening all over the globe than you do, and perhaps that is more important than the mission Taylor gave you. Quinn sighs and nods in agreement. “I know. That’s why I’m here. But still…” She stops in her tracks, spotting something in the distance, and begins walking in that direction. “There—those are the ruins of the palace of Caesar Augustus, who was thought to have built the Temple of Apollo Palatinus nearby. Most scholars believe these nearby ruins to belong to the Temple of Jupiter Victor, but I wager they are in fact Apollo’s.”</p><p>You sigh and pull out the white raven whistle Aliki gave you. Now is as good a time as any to give it a shot. Worst case scenario, you’ve simply wasted your time, and Quinn’s. You put the whistle to your lips and blow. Emerging is a paradoxically distant sound, a warbling trill not unlike the shrill sound that has haunted you ever since Kathmandu. The wind picks up, sudden and chill. Quinn pulls her coat over her torso with a shudder. Then, arriving just as swiftly as the bitter wind, you spy her.</p><p>Aliki Zoni Uperetria stands just over the ancient temple ruins, her red sash a splash of flowing color in the harsh breeze. As the wind and the discordant whistle both fade, her hair settles over her face, obscuring her expression. “I hope you know what you’re doing,” Quinn murmurs to you under her breath as she approaches the haunting figure with much trepidation. The girl in the scarlet sash speaks a single word in ancient Egyptian, stopping Quinn in her tracks. The agent replies in kind, causing Aliki’s head to tilt to the side in curious understanding. Slowly, bit by bit, the two begin to converse, changing languages every other sentence like two students testing one another. You watch in awe as the two juggle ancient languages as easily as breathing.</p><p>Finally, Quinn addresses you. “You were right. She’s searching for a place where…” Aliki speaks again, and Quinn translates. “The entities you’ve encountered. She thinks the things they take—no, devour—she thinks they end up somewhere else. She’s searching for the place where they go.” You ask Quinn if she can think of any place on Earth that might be a hotspot for such activity. “There is one that I can think of,” she replies. “The Bermuda Triangle, otherwise known as The Devil’s Triangle, in the Atlantic. We’ve tried our best to keep it under wraps, but a lot of ships and even some aircraft have gone missing in that area. A few of those incidents are on my list of memory anomalies, as well. Could be some kind of…gateway.”</p><p>You tell her to ask Aliki why she is looking for this place, and the two begin conversing again. “She says that she thinks some of the Coterie were—” She pauses for a moment, struggling with the translation. “—taken? But how could that be? Our records indicate they’re accounted for. At least, the ones we know about.” You consider all that you have seen, and a nauseous feeling overtakes you. Is it possible for both to be true? Is it possible some in the Coterie are not what they seem?</p><p>You approach and ask Aliki if she would like to travel with you to this gateway, if it exists. Quinn tentatively translates your request, and the mysterious figure nods in response. Resolve, strange and fierce, like a piercing light in the abyss, fills your heart. You lift the raven whistle and say that you will summon her when you are ready. This time, Aliki nods without even waiting for Quinn’s translation. You catch just a glimpse of piercing red eyes, framed with heavy bangs, as the wind picks up again and sends her hair aflutter. You lift your coat to block the bitter chill, and naught but a moment later, Aliki Uperetria is gone, wisped along with the wind itself.</p><p>You ask Quinn if she will stick with you a little longer. “I’m not going to lie, this terrifies me,” she says in a small voice, “but I think we are on to something here. Yes. I will see this through with you to the very end. I just hope…” she quivers and averts her gaze away from you. “I just hope I am still remembered when this is done.</p><ul><li>In the Americas section of the Campaign Log, inside the Bermuda Triangle (*the triangle formed by lines connecting Ybor City, San Juan, and Bermuda*), write “56–Y.” You are now able to travel inside the Bermuda Triangle whenever you embark. You may do so from Ybor City, San Juan, or Bermuda, at the cost of 1 _time_. (*When you do, proceed to File 56–Y in the Campaign Guide*).</li><li>You may _embark_.</li></ul>",
        "romulusAndRemus2": "<p>_Romulus and Remus 2_: Several fruitless days of searching for leads in Rome brings you to the Palazzo dei Conservatori on the Capitol Hill. Nestled among dozens of ancient statues is a bronze sculpture of the Lupa Capitolina depicting two twin babies suckling from a mother wolf. Your guide explains the twins are Romulus and Remus, the two alleged founders of Rome. “According to legend, the king, afraid for his claim to the throne, ordered them to be drowned in the Tiber. The twins were protected by the gods and taken in by a she-wolf who raised and fed them as her own. They lived in a cave until they were found and brought to safety.”</p><p>The guide leads the tour past another gallery filled with empty pedestals. You ask your guide what was on display before. “Nothing,” he chuckles. You comment on the number of empty rooms and displays, and the guide laughs dismissively. “Much has been lost over the years,” he says. Looking out over the city skyline, filled with odd dips and empty gaps, you wonder if Rome itself is disappearing.</p><ul><li>Each investigator may begin the next scenario they play with 1 additional resource in their resource pool.</li><li>You may return to Rome again during this campaign, but only after playing another scenario.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "title": "罗慕路斯与雷穆斯",
        "body": "检查剧本日志。",
        "offMission": "*特别小组另有使命*",
        "onMission": "并非上述情况",
        "romulusAndRemus1": "<p>“这……可能是我听过最糟的消息了。”奎因特工在你们前往帕拉蒂尼山的时候说道。这片区域有无数神庙的遗迹。每一处曾经都是洁白的大理石奇迹，装点着华美的象牙浮雕和精巧的雕塑；现在山丘上却只剩半埋入土的断壁残垣。你想安慰奎因，但她是绝对的——这可能是白费力气，甚至可能是个陷阱，泰勒专员要是知道她的特工居然试图跟红色同志会的成员暗通款曲，想必是不会高兴的。但你怀疑，艾里奇肯定比你更了解全球各地发生的奇异失踪，这兴许比泰勒给你的任务更加重要。奎因叹了口气，点头表示同意：“我知道。所以我才会来。但还是……”她走着走着不说话了，注意到远处有什么东西，朝那个方向走去。“这里——那些是奥古斯都宫殿的遗迹。据说就是他建了附近的帕拉蒂尼山阿波罗神庙。大部分学者都认为附近的遗迹是朱庇特胜利神庙，但我敢打赌它们其实属于阿波罗。”</p><p>你叹了口气。取出艾里奇给你的白鸦哨子。此时不试，更待何时。最坏也不过就是浪费了你和奎因的时间。你将哨子拿到嘴边，猛吹一口。响起的颤音遥远得不可思议，和加德满都以来一直萦绕你不散的怪声一模一样。就连风也突然迅疾刺骨了起来。奎因将大衣拉得更紧了。就像乘风突然一样，你随即看到她了。</p><p>艾里奇·佐尼·奥佩勒曲亚就站在古代神庙的遗迹之中，她的腰带在凛冽的寒风中成了一道亮丽的色彩。等到风和刺耳的哨音都已消散，她的长发还是挡在脸前，遮住了面容。“真希望你知道自己在干什么。”奎因朝你低声抛下一句，不无畏惧地走向那个阴森的身影。猩红腰带的少女念出一个词，是古埃及语。奎因停住了脚步。特工照样回应，艾里奇听了偏偏头，好似理解，又有点好奇。渐渐地，这两人一点点开始交谈，每说一句都要换种语言，仿佛两个学生在彼此测试。你敬畏地看这二人把玩着古代语言，不费吹灰之力。</p><p>奎因终于对你说话了：“你是对的。她正在找一个地方，就是……”艾里奇又说了一遍，奎因翻译了：“你遇到那些实体的地方。她觉得那些被夺取——不，是吞没——的东西，会出现在某处。她正在找寻那些地方的归处。”你问奎因，她是否觉得地球上有这么一个地方。“我确实想到一个。”她答道，“百慕大三角，也就是魔鬼三角，在大西洋上。我们尽力保密，但还是有许多船只，甚至飞机都在这片区域失踪了。其中有几桩也记在了我的记忆异常清单上。那里可能会是某种……门扉。”</p><p>你问她问艾里奇是不是在找这个地方，两人又开始交谈。“她说她觉得同志会里有人——”奎因伴着纠结了一下翻译，“——被夺走了？这怎么可能？他们所有人我们都记录在案。至少我们知道的那些都记了。”你回想自己所见，突然一阵恶心。有没有可能都是真的？有没有可能同志会中的某人已非真身？</p><p>你接近问艾里奇愿不愿意和你一同前往那道门扉——如果它当真存在。奎因试探着翻译了你的要求，神秘的身影点头回应。你心中充斥着一股奇异而坚定的决心，仿佛一道亮光已经刺穿深渊。你举起哨子，说自己准备好的时候会召唤她的。这一次，艾里奇没等奎因翻译就点了点头。风又起，吹扬了她的头发，你看到她厚重的刘海下犀利的红眼睛。你拉紧外套抵御寒风。不过片刻，艾里奇·奥佩勒曲亚就消失了，仿佛一缕风。</p><p>你问奎因愿不愿意和你一起再久一点儿。“说老实话，我真的吓到了。”她细声说道，“但我想咱们确实追到了什么。没错，我会跟着你，直到完全查清。我只是希望……”她打了个寒战，没再看你。“我只是希望这一切结束的时候，还有人能记得我。”</p><ul><li>在剧本日志的美洲部分，百慕大三角*(由宜博市、圣胡安和百慕大之间的连线组成的三角形)*内写下“56-Y”。从现在开始，每当你启程，可以旅行前往百慕大三角内。你可以从宜博市、圣胡安或百慕大花费1_时间_前往。*(你在这么做时，进入剧本手册的档案56-Y)*。</li><li>你可以_启程_。</li></ul>",
        "romulusAndRemus2": "<p>你在罗马搜寻数日无果，最终来到了卡比托利欧山上的保守宫。数十座古代雕塑中间，是著名的母狼乳婴铜像，一对双胞胎正吸食着母狼的乳汁。向导告诉你，这对双胞胎就是建立了罗马的罗慕路斯与雷穆斯。“这对双胞胎本是先王的外孙，但先王遭兄弟暗算，双胞胎也被扔进了台伯河。不过，神灵庇佑这对双胞胎，让母狼捡起抚育了他们。他们就在山洞里长大，最后被人发现，安全返乡。”</p><p>向导将你们引入另一间馆藏，里面空空荡荡，只剩下了展台。你问向导这里之前展出了什么。“什么都没有。”他笑道。你议论说怎么会有这么多空房间和展厅，向导的笑声不屑一顾。“这么多年了，当然遗失了许多。”他说道。你看向窗外布满诡异空洞的城市天际线，不禁想问是不是罗马本身也在消失。</p><ul><li>每位调查员下一场冒险开始可以在其资源池有额外1资源。</li><li>你可以在本剧本期间返回罗马，但要先进行另一场冒险。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "theSafehouse": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "The Safehouse",
        "theSafehouse1": "<p>_The Safehouse 1_: It’s a good thing the locals here are fairly welcoming and don’t seem to mind you asking directions, because “abandoned cigar factory” doesn’t exactly narrow things down. The bustling Ybor City district near Tampa is home to many such factories built and run by thousands of immigrants from all over. If you had to check each and every factory, you’d be here all week. Luckily, you have a lead just north of the bay: a quiet, run-down building with an adjoining boarded-up warehouse. If you didn’t know the truth, you’d think it was nothing more than an out- of-date factory from the ’80s, probably filled with nothing more than dust and rats. But if you’ve learned anything in your travels, it’s to never trust the evidence of your eyes.</p><p>You cautiously approach the main entrance and attempt to open it. As you suspected, it does not budge. If this is truly a Coterie sanctum, it’ll be harder than that to get inside. There’s no easy way in through the third- story windows, so you circle around the side of the warehouse, spotting a large metal door likely used for loading goods or unloading supplies. As there is no handle or lever, you decide to knock. A moment later, a gruff voice responds from the other side: “Passphrase.”</p><p class='basic'>Check the Campaign Log.</p>",
        "safehouse": "*If you know the passphrase* and the current time is at or after _Θ_ (theta), proceed to _The Safehouse 2_.",
        "noSafehouse": "Otherwise, skip to _The Safehouse 3_.",
        "theSafehouse2": "<p>_The Safehouse 2_: You lean in and utter the words that Desi taught you—”Blackbird Solitaire”—and the door slides open. On the other side, a muscular man with a thick mustache gives you a toothy grin. The hand hovering just over the handle of a revolver holstered at his side gives you pause, but after a moment, he steps aside to let you in. “Boss said you might be stopping by,” the doorman says. “He said to let you look around and take whatever you need.”</p><p>You step inside and eye the man carefully. Last thing you need is a bullet in the back just as soon as you begin your search. As if sensing your concern, he slowly unholsters his gun and empties the cylinder. “Look, friend. I know what you did for Desi. Any friend of his is a friend of mine,” he states, meeting your suspicious gaze head-on. “Whatever you’re looking for, it’s yours.”</p><p>It doesn’t take too long for you to find the Key Desi had stashed here. Mounted on a far wall of the warehouse, over a midst of a trove of supplies and ammunition, its alien sheen reflects a warped view of your startled countenance. It is a double-edged blade of considerable length, although it has no handle or grip with which to wield it. It might be a weapon, but it is no mortal one, that is for sure.</p><p>“That old thing?” the gruff man asks as you delicately remove it from its mount. “Just a weird hunk of metal, that is. Thought Desi just kept it here for kicks. Creeps the hell out of me.” As you hold the blade over both of your hands, a gentle pulse of energy quivers through its length. Not a decoration, then—this is the real deal.</p><p>You also sift througth some of Desi’s records and intel while you are here. Not much that you don’t already know, but it looks like he’s been keeping tabs on a few of his cohorts. There are more than a few clandestine photographs of a woman carrying a red parasol over her shoulder. In the clearest of these, the woman is giving the camera a knowing smirk. She knew Desi was on to her. On the back, in sloppy handwriting, black ink reads: “You’re in too deep this time, Tzu.”</p><p>You browse a bit more, but you aren’t going to find much else here. Desi’s operation is quite a bit different from the Coterie’s stated goals, it seems. Perhaps there is more to them than the Foundation believes. Or, it’s just another front. Doesn’t matter. You have what you came for.</p><ul><li>Choose an investigator to be the bearer of The Mirroring Blade and update the Campaign Log accordingly. This card can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon: <section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Each investigator earns 2 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "theSafehouse3": "<p>_The Safehouse 3_: No matter what you say, the voice on the other side of the door remains silent. Then, muffled yet distinct, you hear the telltale sound of a revolver being slowly chambered. With that, you decide to take your leave. You’ll have to return later, when you know how to get in…</p><p class='basic right'>You may return to this location again later. For now, you may _embark_.</p>"
      },
      "zh": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "藏匿之地",
        "theSafehouse1": "<p>当地人热情好客，并且不介意你问东问西，实在是一件幸事，因为“废弃的烟厂”这句描述一点也没有缩小调查范围。在宜博市，这样的工厂简直数不胜数。数以千计的移民在这个坦帕附近的城区建立、操持着产业，使得此地熙熙攘攘。要是你得一家一家地查看过去，只怕这周都走不了了，所幸你找到一条迹象，前往海湾北部：那里有一栋宁静破败的建筑，旁边的仓库用木板封了起来。倘若不知真相，那你肯定会以为这里不过是一家80年代所建的废旧工厂，里面除了灰尘和老鼠什么都没有。但一路以来的经历，都告诉你不要太过相信自己的眼睛。</p><p>你小心翼翼地接近大门，试着打开。跟你想的一样，它纹丝不动。如果这里真是同志会的圣堂，想进去肯定没那么简单。要想穿越三层楼高的窗户也非易事。所以你绕到仓库的另一边，发现了一扇金属大门，可能是装载货物跟补给的通道。这门上也没有把手或是门闩，你决定敲敲看。片刻之后，门另一端响起一个粗哑的声音：“口令。”</p><p class='basic'>检查剧本日志。</p>",
        "safehouse": "*你知道了口令*且当前时间为_Θ_西塔或之后",
        "noSafehouse": "并非上述情况",
        "theSafehouse2": "<p>你前倚念出了德西教你的——“黑鸟孤鸫”，门开了。门里面站了个肌肉魁梧、一嘴络腮胡的汉子，朝你露齿一笑。你看到他的手放在身边挂着的左轮手枪上，不由得停了下来。但片刻之后，他就退到一边，让你进去了。“老板说过你可能会来。”这门卫说道，“他说让你到处看看，需要什么就拿。”</p><p>你进去了，但眼睛还是盯着这个男人。你可不希望自己搜寻的时候后面挨一枪。他似乎是察觉到了你的顾虑，掏出枪来，倒空子弹。“朋友，看看，我知道你帮了德西什么忙。他的朋友就是我的朋友。”他直面你怀疑的眼神，“要是这里有你找的东西，拿就是了。”</p><p>你没花多少工夫就找到了德西藏在这里的钥匙。它就挂在仓库远端的墙上，底下是一堆补给和弹药。你惊讶的表情在它异界的光泽中映出扭曲的样子。这是一柄长度惊人的双面刃，却没有任何把手可供抓握。这兴许是件武器，但肯定非同凡响。</p><p>“这件旧东西？”你小心翼翼地将其从基座上拿下来的时候，男子粗声粗气地问道。“就是一大块古怪的金属罢了。德西还当回事地保存起来。真是让我大吃一惊。”你两手捧着这柄利刃，一股能量脉冲温和地从两臂传来。这不是一件装饰——这就是真品。</p><p>你趁着还在这里，研究了一番德西的报告和情报。大多你都已经知道了，但看起来他正小心翼翼地监视着几个同伴。不过还有几张偷拍的照片，上面的女子肩上搭着一把红伞。这女子正对着相机露出了然于心的笑容，昭然若揭。她知道德西在盯着她。照片背面是黑色墨水草草写下的一句话：“你这次手伸太长了，朱。”</p><p>你又搜刮了一番，但也没找到什么。看到德西的生意和同志会的既定目标大相径庭。也许同志会比基金会认为的要复杂得多。或许又是这只是另一个幌子。不重要。你已经得到了自己想要的。</p><ul><li>选择一位调查员拥有镜刃，相应更新在剧本日志中。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>每位调查员取得2点经验值，因为其洞见了红色同志会的内部运作。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "theSafehouse3": "<p>无论你说了什么，门另一边都缄默无声。你随即听到了低沉但清晰的声音——是左轮手枪缓缓上了膛。你立马决定走人。等知道要怎么进去，你还能再回来……</p><p class='basic right'>你可以之后再回到本地点。现在，你可以_启程_。</p>"
      },
      "chineseGaps": []
    },
    "whistleOnTheWind": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "Whistle on the Wind",
        "label": {
          "accept": "Accept what she is offering you.",
          "reject": "Do not accept her offer."
        },
        "whistleOnTheWind1Part1": "<p>_Whistle on the Wind 1_: A chill breeze flutters through the streets of Kathmandu, along with a faint, shrill whine. To the north, the Himalayas loom over the city, only their peaks illuminated by the westward sun. Pinks and purples bathe the sky in vibrant beauty. You could stare at such a breathtaking sight forever…but you have a job to do. Despite the quiet, peaceful evening, that soft, sharp piping does not cease, like an aching sense of dread in the back of your mind. As the evening drags on and the whistling grows louder, you realize you are the only one who can hear the strange sound. It feels as though it is reaching out to you directly. As if it hears you, too. As if it knows you. On a whim, you close your eyes and strain yourself to listen closer. It’s difficult to tell where exactly the sound is coming from—it seems to waft all around you and echo throughout the streets—but it grows in volume as you round the nearest corner and head north. And so north you continue.</p><p>Eventually, you reach an art gallery nestled between several age-old buildings. The whistling here is fevered and unpleasant, like a boiling kettle. Though the gallery is closed at this late hour, you are able to easily find an open side entrance. You brace yourself and enter the gallery, where dozens of Nepalese sculptures and paintings are on display—many carved out of wood or stone, others made out of ashtadhatu, an amalgam of eight different metals, and still others made of terra cotta. The whistling suddenly stops the moment you reach the rearmost section of the gallery, where a single lot remains strangely empty. There is no trace of what might have been there; just an empty space where something historic and treasured is clearly meant to be. Then, a lone voice pierces the sudden quiet, speaking in a language you do not understand.</p><p>You turn on your heels, body tensing. On the other end of the hall is a girl dressed in white, her figure seemingly ethereal in the faint beams of fading sunlight that permeate through the building. Her long black hair is draped over her face, masking her expression. A long scarlet sash wrapped around her waist flutters behind her, despite the fact that there is no breeze.</p><p>You freeze. The figure of the girl does not move. Her hair and sash drift steadily in the stillness. Then, she speaks once more. Again, you don’t understand a single word of it, though you notice that she has switched languages. Recognizing a few root words, you realize she is using Latin. She speaks again, this time in what sounds like ancient Greek. If she is trying to communicate with you, it may be wise to play along. You ask her what she is doing here; why she guided you here. Her response is in yet another language that eludes you, this one sounding somewhat like a blend of Egyptian and Greek.</p>",
        "drifter": "<p class='red'>_Read only if an investigator has the Drifter trait (excluding Wendy Adams)_: In your travels, you’ve been to quite a few places. You’re no stranger to different languages. You attempt a few of your own, but each time you are met with silence. And yet, she appears to want to communicate with you, and is consistently switching languages herself, only without any overlap. Is she only able to speak in long-dead languages?</p>",
        "whistleOnTheWind1Part2": "<p>Due to the language barrier, it’s difficult to get a sense for what she wants from you. As you attempt to decipher her intent, she approaches slowly, her steps making no sound whatsoever along the wooden floor. She gestures to the empty lot next to you and whistles softly, as though the sound might carry with it some meaning. You wonder if perhaps there might have once been something here, and then realize: it is gone, vanished from history without so much as a trace. You recall the woman’s name from the Foundation’s dossier and ask her if she is also on the trail of the entities responsible for these kinds of disappearances. Aliki Uperetria does not seem to understand you, but she tilts her head in recognition at the sound of her own name. Then she wrenches something from around her neck and extends it to you in a closed fist.</p><p class='basic'>The lead investigator must decide (choose one):</p><ul><li>*Accept what she is offering you*. Proceed to _Whistle on the Wind 2_.</li><li>*Do not accept her offer*. Skip to _Whistle on the Wind 3_.</li></ul>",
        "whistleOnTheWind2": "<p>_Whistle on the Wind 2_: You extend your hand, and a small device on a silver chain falls into your palm. It is a whistle, carved out of bone to look like the head and beak of a white raven. Glancing back up at Aliki, she points toward the plaque next to the empty lot and says something once more in what sounds to you like Latin. You ask what she is after, and what the significance of the whistle is, but she remains cryptically silent. Turning over the whistle in your hand, you find no markings or clues as to its purpose. When you glance back up to question Aliki, she has vanished, replaced once more with a cold wind that seeps into your skin. Then, though no one else seems to hear it, the piping returns, soul-wrenching, ear-splitting. It does not cease for as long as the whistle remains in your possession.</p><ul><li>In your Campaign Log, record *the cell possesses a mysterious whistle*.</li><li>Each investigator suffers 1 mental or 1 physical trauma as the shrill sound follows them everywhere they go.</li><li>Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>You may _embark_.</li></ul>",
        "whistleOnTheWind3": "<p>_Whistle on the Wind 3_: You back away with caution. If a member of the Coterie—especially one as cryptic and potentially dangerous as Aliki—is offering you something, it can’t mean anything good. Besides, your mission is to ensure they cannot collect any more Keys, not to cooperate with them…right? Aliki’s hand lowers, along with the temperature in the room. She seems to sense your mistrust and return it tenfold, though she no longer attempts to speak. Moments later, the cold wind returns, and to your surprise, she is gone.</p><ul><li>In your Campaign Log, record *the cell refused Aliki’s offer*.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "风中孤哨",
        "label": {
          "accept": "接受她给你的东西",
          "reject": "拒绝她递过来的东西"
        },
        "whistleOnTheWind1Part1": "<p>加德满都的街道上充斥着刺骨的寒风，响起一阵微弱而刺耳的哀鸣。北面的喜马拉雅山俯瞰全城，西垂的太阳照亮了顶峰。粉色和紫色笼罩的天空有一种浓艳的美感。这景色叫人屏息，你可以永久凝视……但你还有活要干。黄昏一片宁静，但轻微的尖声却未停止，仿佛你意识深处一股刺痛的恐惧。夜色渐深，哨声愈强，你意识到这怪声只有自己能听到。仿佛是直接奔你而来，仿佛它也能听到你，仿佛它知道你。你突然决定闭上双眼，竭尽所能，听得更多。很难分辨这声音究竟来自何处——仿佛是四面八方，在街道中回响——但你绕过最近的街角，往北边去的时候，音量也变大了。于是你继续朝北。</p><p>终于，你在几栋老房子中间找到一家画廊。这里的哨声最为响亮刺耳，听起来就像水烧开了。这么晚了，画廊早已关闭，但你还是轻易地找到了半掩着的入口。你做好准备走了进去，里面展出了几十件尼泊尔雕塑和绘画——许多是木质或石质，其他的则是阿什塔金——这种合金由八种金属铸成。还有一些陶瓷制品。你走到画廊最里，这里有一件展柜竟是空的，哨声戛然而止。没有迹象表明这里曾经展出了什么，但这样的空位肯定只该是一件极具历史意义的珍宝。一个孤冷的声音随即穿透了突如其来的寂静，诉说着一种你并不理解的语言。</p><p>你回转过去，全身一下子紧张起来。房间另一头出现了一个穿着白裙的女孩。渐黯的阳光穿透了整座建筑，照得女孩的身影若隐若现。她长长的乌发披落下来，挡住了脸。腰间系着长长的腰带。尽管此时无风，却在身后飘扬。</p><p>你呆住了。女孩的身影并未移动，她的长发和腰带就在一片静默中飘动。她又开口了。你还是一个词都听不懂，但你注意到她换了一种语言。渐渐地你认出了几个基本词汇，意识到她在说拉丁语。她随即又换了一种语言，这次听上去像是古希腊语。倘若她正试图与你交流，最好还是有所回应。你问她在这里做什么，又为何将你引至此处。她又换了一种语言回应，你依然不懂，只是听起来像埃及语和希腊语的混杂。</p>",
        "drifter": "<p class='red'>_仅当有调查员具备漂泊者特性才能阅读(温蒂·亚当斯除外)：_你是去过不少地方，也通晓多种语言。你试了几种自己所会的语言，每次都撞上一阵沉默。但她还是想和你交流，一直变换着语言，竟无重复。她是不是只会说早已死去的语言？</p>",
        "whistleOnTheWind1Part2": "<p>你们语言不通，很难理解她到底想要你干什么。你试着描绘出她的意图。她慢慢接近，在木地板上竟然一点脚步声也没有。她指着你旁边的空展柜，轻轻吹出哨声，仿佛这哨音自有其意义。你好奇这里本来是不是有什么，随即一下子明白过来：这件东西是消失了，从历史上抹去了痕迹，不留一点踪迹。你回想起基金会的密档中提过这个女子的名字，问她是不是也在追寻造成此类失踪背后的实体。艾里奇·奥佩勒曲亚看上去并未理解你在说什么，但她认出了自己名字的音节，点了点头。她从自己脖子上取下了什么，攥在拳头里交给了你。</p><p class='basic'>调查员队长必须决定（选择一项）：</p><ul><li>*接受她给你的东西*。</li><li>*拒绝她递过来的东西*。</li></ul>",
        "whistleOnTheWind2": "<p>你伸出手，接住了银链系着的小东西。是枚骨哨，看起来形似白鸦的头喙。你望回艾里奇，她指着空展柜的铭牌，说了些什么，在你听来像是拉丁语。你问她要做什么，这枚哨子又有何意义，但她神秘万分地沉默着。你将哨子翻来覆去，却没有找到任何记号，不知道它到底是用来做什么的。你回头想问艾里奇，但她却消失了，只余渗入骨髓的寒风。只有你能听到的哨声又一次响起，不仅刺耳，而且摧人心神。只要哨子在你手中，这声音就不会停止。</p><ul><li>在剧本日志中，记录*特别小组拥有了神秘的哨子*。</li><li>每位调查员承受1点精神创伤或1点肉体创伤，因其无法摆脱这刺耳的噪音。</li><li>从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>你可以_启程_。</li></ul>",
        "whistleOnTheWind3": "<p>你小心翼翼地退后。倘若同志会的成员——尤其是像艾里奇这么神秘又危险的——想要给你什么，那肯定没好事。况且，你的任务是阻止他们收集更多的钥匙，而不是跟他们合作……对吧？艾里奇垂下了手，室内的温度也瞬间下降。她察觉到了你的不信任，十倍奉还，不再说话。片刻之后，寒风再临，你惊讶地发现她不见了。</p><ul><li>在剧本日志中，记录*特别小组拒绝了艾里奇的馈赠*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "infernalMachinery": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "Infernal Machinery",
        "infernalMachinery1": "<p>_Infernal Machinery 1_: A heavy grey mist hangs in the air above Lake Victoria as your biplane touches down on a dusty runway. All leads in Nairobi about a Tuwile Masai point to the shoreline of Lake Victoria, where the Coterie member is said to have transported several tons of survey equipment. A faint but sharp scent of alkaline carries on the breeze as you walk to the lake, where several large boats are laden with heavy machinery at the shoreline. Sunlight catches on a pair of thick-rimmed spectacles down at the pier.</p><p>“Professor Masai?” you greet the wiry man as he steps ashore. Masai looks nervously past you as he wipes his glasses.</p><p class='basic'>Check the Campaign Log.</p>",
        "reputation": "If at least three of the following are recorded (*La Chica Roja is on your side*, *the cell aided the knight*, *Aliki is on your side*, *Desi is on your side*, *the cell made a deal with Thorne*, or *Ece trusts the cell*), proceed to _Infernal Machinery 2_.",
        "noReputation": "Otherwise, skip to _Infernal Machinery 3_.",
        "infernalMachinery2": "<p>_Infernal Machinery 2_: “Your reputation precedes you. As did the sound of your aeroplane,” Masai smiles, though you can sense a nervous undercurrent in his demeanor. “You have caught me at just the right time. Would you care to accompany me out to the water?”</p><p>You cordially accept, and the professor leads you to board the boat to take a seat at at the stern. A half dozen crew members board, and the engine thrums to life as you cut a path across the glassy surface of the lake. After setting course, the professor hunches in his seat across from you and studies you through heavy red-rimmed glasses. “In truth, I am surprised you sought me out. I am hardly the mover and shaker I once was in the Coterie. Now, their concerns seem trivial in comparison with all the great work that must be done.”</p><p>When you ask about his great work, the professor smiles. “It is the work of every person. What is it to be human except to live and help others in this great and perilous world? It’s harder than you might think.” He leafs through several papers, holding them tightly as the wind off Lake Victoria picks up. Masai shows you several complicated graphs and charts.</p><p>“The lakebed here is covered in the ruins of a sunken city built long ago. I happened upon it when monitoring acidity and chemical levels. Something was increasing—or perhaps better put: producing—an incredible amount of carbon dioxide. Along with several odd mutations in local fauna and flora. After several months of searching, we were able to trace the production to its source.” The professor pinpoints a red X on a large map of Lake Victoria. You ask if that is where the boat is headed now, and the professor chuckles. “No. It is already done. The source of the unusual production was an object of power. A Key. We drudged it up just last week.”</p><p>The hair on the back of your neck raises as the crew cuts power to the engine. None of them appear armed, but you are suddenly aware of your vulnerable position.</p><p>“Don’t fear for your life, my friend,” Masai rubs his glasses with a cloth. “I am not your enemy. Though I do worry for the Coterie itself. There is something strange at work among them. The one with the gloves in particular. He has been silent for too long, I think.” The professor sighs and leans back in his seat. Around you, the placid water of Lake Victoria ripples, dreamlike, as a heavy storm stirs the clouds overhead.</p><p>“It’s yours, of course,” Masai says, eyes closed, as he looks up at the sky. “The artifact we found was some infernal machine that was still running, even now, at the bottom of the lake. I wonder who started it, and when? And what will happen if it ever stops running? Either way, if your track record with my colleagues is to be believed, it is safer in your hands than in mine.” He opens his eyes and stares at the surface of the lake as the crew rev the engine.</p><p>“Perhaps you will succeed where I failed.”</p><ul><li>In your Campaign Log, record *Tuwile Masai is on your side*.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Choose an investigator to be the bearer of The Bale Engine and update the Campaign Log accordingly. This card can be found in the Globetrotting encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "infernalMachinery3": "<p>_Infernal Machinery 3_: “I’m terribly sorry, but I don’t have time to chat,” Masai says as he steps lightly past you. You follow him, pressing for some assistance or insight, anything that can help in your struggle with the Red Coterie. “Ah. I had no idea I was dealing with the Foundation. You must be new.” Masai regards you in a new light, then leads you to sit in a makeshift camp. “Very well. Please wait here, and I’ll help you as soon as I can.”</p><p>You sit in a comedically short camping chair under the awning as the professor walks out of view. The minutes drift away as the clouds overhead break and a heavy rain begins to fall. After waiting for some time, you stand up and look out to the shoreline: the boats have gone. When you ask the locals for the professor’s whereabouts, they tell you he ended his survey and paid for passage across the lake.</p><p>After returning to Nairobi, you check with the British Consulate and discover that Masai’s travel expenses were being footed by his fellowship with Oxford. His declaration of travel includes an obscure address in Bermuda. Pocketing the information, you continue your travels.</p><ul><li>In your Campaign Log, record *Tuwile Masai fled to Bermuda*.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "地狱装置",
        "infernalMachinery1": "<p>你乘着双翼飞机，在维多利亚湖氤氲的灰色浓雾中降落在尘土飞扬的跑道上。内罗毕所有关于特瓦耶·马萨伊的线索都指向了维多利亚湖，据传同志会成员正将数以吨计的勘测设备运抵此处。你朝湖畔走去，风中传来一阵微弱却刺鼻的碱味。湖边停着几艘大船，个个装着沉重的设备。你在阳光下看见有个戴宽边眼镜的人正在码头卸货。</p><p>这个瘦削的男子上岸的时候，你跟他打了招呼：“马萨伊教授？”马萨伊看到你颇为紧张，扶起了眼镜。</p><p class='basic'>检查剧本日志。</p>",
        "reputation": "至少记录了下列三项*(红衣女郎站在你这一边、特别小组援助了骑士、艾里奇站在你这一边、德西站在你这一边、特别小组与索恩达成交易，或艾婕信任特别小组)*",
        "noReputation": "并非上述情况",
        "infernalMachinery2": "<p>“你可真是声名远播，像你的飞机一样如雷贯耳。”马萨伊虽然在笑，但你看得出他的举止下潜藏着紧张。“你来的可真是时候，介意陪我去水上看看吗？”</p><p>你坦荡同意，教授领你上船，在船尾坐下。另有几个队员也在船上。引擎轰鸣，你们在清澈的湖面开出一条道来。校准航线之后，教授躬身坐在你对面，透过红色大框眼镜仔细打量着你。“说实话，我很惊讶你能找到我。我在同志会的时候活跃得很，但现在不了。现在，和必须完成的大业相比，他们操心的事情是多么无关紧要。”</p><p>你问他所谓的大业是什么，教授笑了：“这大业是为了所有人。在这个危险又宏伟的世界，人们要是不活下去，不互帮互助，会变成什么样子？这比你想的更难。”维多利亚湖上风大了起来，他握紧材料，翻了几页，递给你几张复杂的图表。</p><p>“这里的湖床都是沉没城市的遗迹。是我在监测酸度和化学指标的时候偶然发现的。某物正在增加——更准确地说，生成——极其巨量的二氧化碳。当地的动植物也发生了奇怪的突变。我们查找了几个月，终于定位到生成的源头。”教授指着维多利亚湖地图上一个红色的X。你问他船是不是就往那儿开，教授笑了。“不，已经去过了。导致二氧化碳生成的是一件充满力量的物品，一个钥匙。我们上周花了好一番工夫才捞起来。”</p><p>他手下的队员切断了引擎，你不禁毛发倒竖。他们看上去都没有武器，但你还是顿时感到自己的处境非常危险。</p><p>“不用担心安危，朋友。”马萨伊用布擦了擦眼镜，“我不是你的敌人。我确实操心同志会，但内部运作已有蹊跷。尤其是那个戴手套的。我觉得他已经沉寂太久了。”教授叹了口气，瘫回座位。你们四周维多利亚湖平静的水面如梦似幻，但头顶的乌云已在积攒可怕的风暴。</p><p>“是你的了，当然。”马萨伊抬头看天，闭上了眼睛。“我们找到的神器属于某种地狱装置，而它，甚至现在，还在湖底运行。我想知道是谁启动了它，又是什么时候？要是它停止运行又会怎样？无论如何，要是我的同事所言不虚，那这东西在你手里，比在我手里更安全。”马萨伊手下的队员重启引擎，而他睁开眼，望着湖面。</p><p>“也许你能办成我办不到的事。”</p><ul><li>在剧本日志中，记录下*特瓦耶·马萨伊站在你这一边*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>选择一位调查员拥有灾祸引擎，相应更新在剧本日志中。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "infernalMachinery3": "<p>“非常抱歉，但我恐怕没有时间聊天。”马萨伊说着从你身边轻轻走过。你跟着他，提议让他帮忙，提出观点，只要能帮你和红色同志会交锋的事情，你照单全收。“啊，我没想到自己是在和基金会打交道。你肯定是新来的。”马萨伊换了一种眼神打量你，将你带入一顶临时帐篷。“好好，在这儿等一会儿，我会尽快来的。”</p><p>教授走出了视线，而你在雨篷下一张露营椅上坐着等，这椅子真是矮得有点滑稽了。时光流逝，开始下起暴雨，仿佛头顶的云层都裂开了一样。你又等了一会儿，站起来朝着湖岸看去，却发现船已经开走了。你向当地居民问起教授的去向，他们却告诉你勘测已经结束，他往湖对岸去了。</p><p>你回到内罗毕，去找英国领事，发现马萨伊的旅费由牛津承担。他之前公布的旅途中还有一个模糊的地址位于百慕大。你收下这份信息，继续踏上旅程。</p><ul><li>在剧本日志中，记录下*特瓦耶·马萨伊逃往百慕大*。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "bloodSweatAndTea": {
      "en": {
        "title": "Blood, Sweat, and Tea",
        "body": "Check the Campaign Log.",
        "aided": "*If the cell aided in Flint’s investigation*, proceed to _Blood, Sweat, and Tea 1_.",
        "tenOrLessTime": "*If Flint is working solo and 10 or fewer time has passed since psi _ψ_*, skip to _Blood, Sweat, and Tea 2_.",
        "moreThanTenTime": "*If Flint is working solo and more than 10 time has passed since psi _ψ_*, skip to _Blood, Sweat, and Tea 3_.",
        "bloodSweatAndTea1": "<p>_Blood, Sweat, and Tea 1_:  On the train into Hong Kong, Agent Flint shares his current lead with you. “Tzu San Niang is due to meet with her new business partners this afternoon at a local teahouse. From what I gather, they’re a real rogue’s gallery of scumbags. The type that makes their fortunes by exploiting their workers to death. She’s so drawn to these types, it gives me a theory. She’s not just taking these jobs because they pay well. Time and again she goes for these deals where she can help the British at the expense of the common folk. It’s like she’s…attracted to the suffering she causes. Maybe worse.”</p><p>Before you can discuss this theory in more depth, your train arrives at its stop. You and Flint hurry onto the platform and rush to the teahouse, but you arrive too late: a telltale red parasol is sifting through the street crowd, heading swiftly away. You follow the parasol with your eyes as its bearer steps into a nearby alleyway. Flint whispers to you to stay, but you can’t while your quarry is so close.</p><p>The moment you enter the alleyway, Tzu San Niang turns and looks you in the eye. “I am used to attention,” she croons, “but I heard you were a little too interested in me.” She raps the tip of her parasol onto the street, and a burst of silvery energy rushes through the ground, jumping into your body. Your skin goes suddenly numb, and you collapse to the ground. The painful pinprick sensation of a sleeping limb takes over your entire body. Tzu San Niang smiles, puts her parasol over her shoulder, and walks away. She gets a few yards away and, apparently believing she is out of earshot, she tells her entourage: “We are done here. The Foundation is on to us. Eliminate them and move on to the Selangor Club harvest.”</p><p>You hear feet shuffling in your direction, but before any reckoning comes, Flint picks you up and drags you back out to the street, where the crowd and broad daylight might keep you from overt harm…for now. As the sensation in your limbs returns, Flint muses aloud. “The Royal Selangor Club—that’s a social club in Kuala Lumpur. Come on, we have no time to lose.” He helps you to your feet, but you’re still recovering from the blast of energy that sent your body and mind reeling. The parasol isn’t just a Coterie insignia after all—it is a Key!</p><ul><li>In your Campaign Log, record *Flint traveled to Kuala Lumpur*.</li><li>In the Southeast Asia section of the Campaign Log, find Kuala Lumpur. In its spot, write “46–Q.” You are now allowed to travel to Kuala Lumpur whenever you embark.</li><li>You may _embark_.</li></ul>",
        "bloodSweatAndTea2": "<p>_Blood, Sweat, and Tea 2_: You meet Agent Flint at the Hong Kong Zoological and Botanical gardens. He shakes your hand and leans in close. “Do you have a tail?” he asks. You assure him you do not. You have been careful.</p><p>He updates you on the case while the two of you stroll through the gardens, looking to all the world like normal tourists. He explains that the lady with the red parasol is using the name Tzu San Niang, and that she has made an international business out of helping the British expand their empire, often using the most brutal methods. Her silver tongue and negotiating skills are apparently the thing of legend: she can convince worker unions to tolerate abysmal conditions, local governments to accept the extraction of natural resources without batting an eye, and worse.</p><p>“We can’t be too careful,” Flint warns. “Obviously, Ms. Tzu is no one to be trifled with, but it’s that parasol that’s the key to her operation, if you’ll pardon my pun. I think it actually is giving her the ability to sway minds.”</p><p>You can’t object—the evidence is piling up. Flint’s initial hunch was right. “What’s worse is that she already suspects we’re on to her. I had a Coterie operative sniffing me out just earlier this week. Luckily, I managed to get the upper hand. Found his safehouse before he found mine. And the best part?” He gives you a sly grin. “He had an itinerary on him. They’re headed to the Royal Selangor Club next. It’s a social club in Kuala Lumpur, for the wealthy elite. Care to join me?”</p><ul><li>In your Campaign Log, record *Flint traveled to Kuala Lumpur*.</li><li>In the Southeast Asia section of the Campaign Log, find Kuala Lumpur. In its spot, write “46–Q.” You are now allowed to travel to Kuala Lumpur whenever you embark.</li><li>You may _embark_.</li></ul>",
        "bloodSweatAndTea3": "<p>_Blood, Sweat, and Tea 3_: You reply to Agent Flint’s telegram, but he never returns your message. You head to Flint’s last known hotel to inquire personally, but they tell you that he never received your telegram. In fact, according to the concierge, he hasn’t been back in several days. You decide that the Coterie must be behind this disappearance, and that the best way of finding Flint is to find the lady with the red parasol.</p><p>For days you search for signs of the Coterie, but find nothing. You establish the trust of some business contacts and begin to ask them about the lady with the red parasol. Most of them pretend to know nothing, but eventually you hear about a railway being constructed in Malaysia. The rail was delayed, but they sent a negotiator in to reach an agreement, saying “no one says no to her.” Maybe Flint simply went to Kuala Lumpur to investigate on his own, but…</p><p>A lump forms in your throat. You suspect the worst.</p><ul><li>In your Campaign Log, record *Agent Flint is missing*.</li><li>In the Southeast Asia section of the Campaign Log, find Kuala Lumpur. In its spot, write “46–Q.” You are now allowed to travel to Kuala Lumpur whenever you embark.</li><li>You may embark.</li></ul>"
      },
      "zh": {
        "title": "鲜血，汗水，和茶叶",
        "body": "检查剧本日志。",
        "aided": "*特别小组援助福林的调查*",
        "tenOrLessTime": "*福林独自行动*且自普西_ψ_流逝的时间不超过10",
        "moreThanTenTime": "*福林独自行动*且自普西_ψ_流逝的时间至少为11",
        "bloodSweatAndTea1": "<p>火车抵达香港的时候，福林和你分享了最新的线索。“朱三娘今天下午要在一家当地茶馆和她新近的生意伙伴会面。据我所知，这群人真是蛇鼠一窝。这种人为了赚钱，不惜将手下的工人剥削至死。朱三娘接近这种人，让我有个想法：她干这些不是为了钱。她一次次在这种交易上帮英国人残害老百姓，看起来就像……很享受别人受苦似的，甚至更糟。”</p><p>你们还没来得及深入讨论这个想法，火车就靠站了。你和福林冲下月台，奔向茶馆，但还是太迟了：你一眼就在街上的人群中认出了醒目的红伞正迅速走远。你凭着眼力追了上去，而持伞人已拐进一条小巷。福林低语让你停下，但猎物已经近在咫尺，怎能放手？</p><p>你一进小巷，朱三娘就转过来直盯着你。“是有很多人关注我。”她轻声说道，“但我觉得你对我的兴趣也太重了。”她敲敲伞尖，一阵银光穿过地面奔你而来。你瞬间麻木，倒在地上。你全身刺痛，四肢无力。朱三娘笑着举起伞走远了。她走出几码，自信无人听到，对手下说道：“这里的事办完了。基金会盯上我们了。把他们干掉，到雪兰莪俱乐部去看看成果。”</p><p>你听到脚步声渐渐逼近，但福林赶先将你抬了起来，拖到了外面的街上。这里人流如织，光天化日之下你是安全的……至少现在是的。你渐渐地恢复知觉，福林沉思道：“皇家雪兰莪俱乐部——是吉隆坡的一家社交俱乐部。走吧，我们没时间浪费了。”他帮你站了起来。刚才的冲击打得你身心颠倒，现在才渐渐恢复了过来。那柄伞完全不止是同志会的标示——它就是钥匙！</p><ul><li>在剧本日志中，记录*福林前往吉隆坡*。</li><li>在剧本日志的东南亚部分，找到吉隆坡，在其位置写下“46-Q”。从现在开始，每当你启程，可以旅行前往吉隆坡。</li><li>你可以_启程_。</li></ul>",
        "bloodSweatAndTea2": "<p>你在香港动植物公园见到了福林特工。他凑近和你握了手。“没人跟着你吧？”他问道。你保证没有。你向来谨慎。</p><p>你们和全世界的游客一样在园中漫步，他趁此机会和你更新情报。他说红伞夫人化名朱三娘，正做国际生意，帮助英国人扩张帝国，手段常常下作。她巧舌如簧，谈判技巧堪称传奇，她能让工会接受糟糕的条件，让当地政府对采掘自然资源睁一只眼闭一只眼，甚至还有更糟的事情。</p><p>“我们得小心啊。”福林警醒道，“朱夫人显然不好对付。她那柄伞就是开启谜题的钥匙——我用了个双关，你不介意吧？我觉得其实就是那伞让她有了操纵意愿的能力。”</p><p>你无法否认——证据已经堆积如山了——福林一开始的直觉很准。“更糟的是，她已经怀疑我们盯上她了。这周早些时候，有个同志会的人发现我了。所幸我占了上风，在他发现我的藏身处之前，我先找到了他的。然后是最精彩的部分。”他露出一个狡黠的笑容，“他居然还有日程安排，下一站就要前往皇家雪兰莪俱乐部。那是吉隆坡的一家专供达官显贵的社交俱乐部。你要一起来吗？”</p><ul><li>在剧本日志中，记录*福林前往吉隆坡*。</li><li>在剧本日志的东南亚部分，找到吉隆坡，在其位置写下“46-Q”。从现在开始，每当你启程，可以旅行前往吉隆坡。</li><li>你可以_启程_。</li></ul>",
        "bloodSweatAndTea3": "<p>你回复福林特工的电报之后，他就再没有给你回过信了。你亲自前往他最后入住的酒店，询问一番，但却得知他并没有收到你的回信。而门房说，他其实已经几天都没看到福林回来了。你笃定这场失踪的背后是同志会在捣鬼，要想找到福林，最好的方法就是找到红伞夫人。</p><p>你花了几天工夫去找寻同志会的踪迹，但一无所获。你跟几个商业人士建立了联系，问起红伞夫人。大多数人佯装不知，但你还是打听到马来西亚有一条铁路在建。工程耽搁了，他们派人去达成协议，还说“没人能拒绝她。”也许福林是去吉隆坡自行调查了，但……</p><p>你突然僵住了，你怀疑最糟糕的事情已经发生了。</p><ul><li>在剧本日志中，记录*福林特工失踪*。</li><li>在剧本日志的东南亚部分，找到吉隆坡，在其位置写下“46-Q”。从现在开始，每当你启程，可以旅行前往吉隆坡。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "ringingHollow": {
      "en": {
        "title": "Ringing Hollow",
        "body": "Check how much _time_ has passed in the Campaign Log.",
        "lessThanTwentyTime": "If less than 20 _time_ has passed, proceed to _Ringing Hollow 1_.",
        "twentyOrMoreTime": "If 20 or more _time_ has passed, skip to _Ringing Hollow 4_.",
        "ringingHollow1": "<p>_Ringing Hollow 1_: You arrive in Sydney and immediately search for the agent described in Taylor’s dossier, finding her safehouse in an old, condemned warehouse by Botany Bay, on the eastern side of the city. She has an entire wall of filing cabinets containing years and years of research, and her table is covered in a mess of maps and photographs. “Ah, the new cell,” she regards you, flipping on a fluorescent light that coldly illuminates the room. “The name’s Quinn. The commissioner told me you might drop by.”</p><p>You ask her what kind of intel she might have to aid your investigation, which earns you a chuckle. “What don’t I have? Well, let me show you what I am looking into right now…”</p><p class='basic'>Check the Campaign Log.</p>",
        "toldTheTruth": "*If the cell told the truth to Taylor*, proceed to _Ringing Hollow 2_.",
        "hidTheTruth": "*If the cell hid the truth from Taylor*, skip to _Ringing Hollow 3_.",
        "ringingHollow2": "<p>_Ringing Hollow 2_: “I have been looking into the disappearances you mentioned to Taylor. She is concerned about these events, but perhaps not as much as she should be.” She hands you a file from her table and leans back as you examine it. It’s a host of information regarding missing buildings, sites, in some cases even entire villages, all of which vanished mysteriously and without explanation. “Sound familiar?”</p><p>You nod and inform Quinn this is precisely the kind of thing that you’d been looking into before you were recruited to the Foundation. You take the time to tell Quinn everything you know regarding the strange entities you have spotted numerous times in your travels, and what their presence does to objects and people alike.</p><p>“That lines up with my research,” she says, motioning to her cluttered table. “But if that’s true, these things have been active for literally hundreds— thousands of years. And we have collectively forgotten everything that has been erased, save for a desperate few that cling to memory. Do you understand what this means?”</p><p>Other than the obvious—that humanity is in very real danger of becoming forgotten history—you aren’t sure what she is getting at.</p><p>“I have a hunch, but I cannot look into it here. Looks like I’m headed back to Britain. I know you have your own assignment to get to, but, if you can spare the time, can you come meet me in Amesbury? It is just due west of London.” Wearing a taut but determined grimace, Quinn gathers some personal belongings and leaves you with more questions than answers.</p><ul><li>In the North Atlantic section of the Campaign Log, find London. In its spot, write “27–H.” You are now allowed to travel back to this location whenever you embark.</li><li>You may _embark_.</li></ul>",
        "ringingHollow3": "<p>_Ringing Hollow 3_: “This is off-book, but I’ve been looking into some pretty strange events. Take a look.” She hands you a file from her table and leans back as you examine it. It’s a host of information regarding missing buildings, sites, in some cases even entire villages, all of which vanished mysteriously and without explanation. You do your best not to let your familiarity with such events show on your face. “Any of this mean anything to you?”</p><p>You don’t like lying, but telling the truth now would reveal your earlier deception to Taylor. You shake your head, telling Quinn this is new to you. “That checks out. See, that is what’s so hinky about all this. You are holding the only surviving records of any of these places. It is as though all of them were completely eradicated from history. And if that is true, who is to say the same could not happen to us?” She shudders. “The thought of being forgotten like that…even by those closest to me…it is my worst fear.”</p><p>You tell Quinn that you feel similarly, and that you wish you had more intel to give her. Her gaze, narrow with suspicion, sees right through you.</p><p>“I do not buy that for a second. Taylor might trust you, or maybe she just does not want to get her hands dirty. But I can tell when someone is lying to my face.” A grim silence hangs in the air. Finally, she exhales. “Fine. Do as you will. But if you decide to spill, you can find me in Amesbury, due west of London,” she says, packing some of her files and personal belongings in a small canvas duffel bag. You repeat her destination, curious as to why.</p><p>“Something there I want to look into,” is all she gives you. You suppose it is only fair, considering your hesitance to give her the full story. She gives you no more than a cold glance as she leaves, and you wonder if perhaps you should have warned her. But what she doesn’t know can’t hurt her…right?</p><ul><li>In your Campaign Log, record *Agent Quinn does not trust the cell*.</li><li>In the North Atlantic section of the Campaign Log, find London. In its spot, write “27–H.” You are now allowed to travel back to London whenever you embark.</li><li>You may _embark_.</li></ul>",
        "ringingHollow4": "<p>_Ringing Hollow 4_: You arrive in Sydney and immediately search for the agent described in Taylor’s dossier, but everywhere you search, there appears to be no trace of her, nor any memory of her among the locals. Feeling worried, you redouble your efforts and eventually track her to an old, condemned warehouse by the bay on the eastern side of the city. Inside is an entire wall of filing cabinets containing years and years of research, and a table covered in a mess of maps and photographs. But there is no sign of Agent Quinn.</p><p>Judging from her recent notes, she appeared to have been researching the same kind of paranormal events you’d been looking into before you were recruited to the Foundation—missing buildings, sites, in some cases even entire villages, all of which vanished mysteriously and without explanation. But if she came to any conclusions, you find no evidence of it.</p><p>With no other leads, you depart, filing a report on Quinn’s disappearance for the commissioner. You hope she is simply in hiding somewhere, but your instincts tell you otherwise.</p><ul><li>In your Campaign Log, record *Agent Quinn vanished from existence*.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "title": "环环成空",
        "body": "检查剧本日志中已经流逝了多少_时间_。",
        "lessThanTwentyTime": "流逝的_时间_小于20",
        "twentyOrMoreTime": "如果流逝的_时间_大于等于20",
        "ringingHollow1": "<p>你一到悉尼，就立刻寻找泰勒的密档中提到的特工，终于在市东边植物学湾一间仓库里找到了她。这栋房子已经老旧废弃。档案柜铺满了一面墙，里面是她历年的研究；桌上也摊满了地图和照片。“噢，是新的特别小组。”她一边跟你打招呼，一边打开荧光灯，冷冷的光芒照亮了整座屋子。“叫我奎因就行。专员说你可能会来。”</p><p>你问她有什么情报能给你的调查帮上忙，结果却惹得她咯咯笑起来。“什么是我没有的？好吧，就让你看看我现在在研究什么……”</p><p class='basic'>检查剧本日志。</p>",
        "toldTheTruth": "*特别小组将真相告诉了泰勒*",
        "hidTheTruth": "*特别小组对泰勒隐瞒真相*",
        "ringingHollow2": "<p>“我有调查你跟泰勒提过的失踪事件。她有关注，但关注得还不够。”她从桌上提给你一份文件，趁你检阅的时候后仰休息。这里面的信息提及失踪的建筑、地点，有时候甚至是整个村庄，全都神奇地消失了，无法解释。“看着眼熟吗？”</p><p>你点点头，告诉奎因，这就是你给基金会打工前调查的事件。你花了些工夫，将旅程中多次遇见的诡怪实体，还有它们对人与物的影响都一五一十地告诉了奎因。</p><p>“这与我的研究倒是相符。”她指着凌乱的桌子说道，“如果一切都是真的。这些东西已经活跃了几百——上千年了。我们集体遗忘了遭到清除的一切，只有极少数特别固执坚持记忆的人还留有印象。你知道这意味着什么吗？”</p><p>对你来说，答案十分明显——人类也有沦为失落历史的危险——但你不确定她是不是指的这个。</p><p>“我有一种直觉，但在这里研究不出来。看来我应该回不列颠去了。我知道你还有自己的任务，但要是有空，能不能来埃姆斯伯里找我？就在伦敦西边。”奎因当即收拾行礼，一脸紧张的苦相，但你看得出她心意已决。只是她给你留下的答案还没问题多。</p><ul><li>在剧本日志的北大西洋部分，找到伦敦，在其位置写下“27-H”。从现在开始，每当你启程，可以旅行回到该地点。</li><li>你可以_启程_。</li></ul>",
        "ringingHollow3": "<p>“虽然还没写下来，但我正在调查一些特别奇怪的事情。来瞧瞧吧。”她从桌上提给你一份文件，趁你检阅的时候后仰休息。这里面的信息提及失踪的建筑、地点，有时候甚至是整个村庄，全都神奇地消失了，无法解释。你用尽全力，不想露出似曾相识的表情。“你知道这些事情吗？”</p><p>你不喜欢说谎，但也知道白就会暴露你先前骗了泰勒。你摇摇头，告诉奎因你是第一次见。“这也说得通。看，整件事都很蹊跷。关于这些地方，除了你手上这份，再无其他的记录了。就好像它们从历史上完全抹去了一样。要真是这样，怎么能保证我们不会落入一样的下场？”她耸耸肩，“像这样叫人遗忘……哪位最亲近的人也不记得……我最怕的就是这个。”</p><p>你告诉奎因自己也有一样的感受，要是能多给她些情报就好了。她眯起眼睛，怀疑地瞪着你，仿佛将你直接看透。</p><p>“我根本不打算买你的账。泰勒可能相信了你，或者她只是不愿弄脏自己的手。但要是有人当面撒谎，我就能看出来。”一阵沉默，此刻的气氛叫人难受。她最后叹了口气：“好吧。你请便吧。但要是想说什么，可以来埃姆斯伯里找我，就在伦敦西面。”她说着将文件和行李装进一个帆布小旅行袋。你重复了一遍这个地名，好奇她为什么要去。</p><p>她只回答说“那里有我想调查的东西”。既然你自己都没告诉她全部实情，那也不能怪她云山雾罩。她冷冷地瞥你一眼就走了，而你还在想是不是该警告她一路小心。但不知真相也不会伤害她……吧？</p><ul><li>在剧本日志中，记录下*奎因特工不信任特别小组*。</li><li>在剧本日志的北大西洋部分，找到伦敦，在其位置写下“27-H”。从现在开始，每当你启程，可以旅行回到伦敦。</li><li>你可以_启程_。</li></ul>",
        "ringingHollow4": "<p>你一到悉尼，就立刻寻找泰勒的密档中提到的特工，但无论什么地方都找不到她的踪迹，当地人也不记得有见过她。你十分焦急，加倍努力，沿着点点迹象来到市东边一间仓库。这栋房子已经老旧废弃。档案柜铺满了一面墙，里面是她历年的研究；桌上也摊满了地图和照片。但没有奎因特工的迹象。</p><p>从最近的笔记来看，她正在研究的，就是你给基金会打工前调查的事件——失踪的建筑、地点，有时候甚至是整个村庄，全都神奇地消失了，无法解释。但她有没有得出结论，你就不得而知了。</p><p>你找不到别的线索，只能离开，向专员提供一份有关奎因失踪的报告。你希望她只是藏在某处，但直觉告诉你并非如此。</p><ul><li>在剧本日志中，记录下*奎因特工凭空消失*。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "deadAndGone": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Dead and Gone",
        "label": {
          "truth": "“Tell Agent Quinn the truth.”",
          "secrets": "“Keep your secrets.”"
        },
        "deadAndGone1": "<p>_Dead and Gone 1_: You arrive in London and follow Agent Quinn’s directions to get to the town of Amesbury. Immediately after checking into a hotel, your concierge wordlessly hands you a note with an address by the side of a park on the western side of the historic town. You head there immediately, only to find Agent Ari Quinn sitting in the driver’s seat of a Bentley, reading a newspaper and not paying you any heed. Without making a scene, you silently climb into the passenger seat. “Finally. Been waiting here all day.” You’re not even sure how Quinn knew you’d arrived in town, but you suppose the Foundation must have eyes and ears all over every harbor and border checkpoint. You ask her what she’s been up to, and what she wanted to show you, at which point she starts the Bentley’s engine and rolls along the road to the west. “You’ll see.” Just a short drive later, you come to a familiar sight. You should have known— Quinn has taken you to the site of mysterious and prehistoric Stonehenge. A ring of standing stones marks the site, inside which another ring of smaller bluestones seem to serve no particular purpose whatsoever. A few tourists peruse the monument in awe, but it is otherwise quiet. You follow close behind and ask Agent Quinn why she asked you to come all this way. “Strange place, is it not?” she asks. A rhetorical question—historians have long debated over the likely function of the landmark, but none know for certain. As you draw nearer, she points to the various standing stones and to the concentric ring of smaller stones inside. “Almost seems like something is missing.”</p><p class='basic'>Check the Campaign Log.</p>",
        "noTrust": "*If Agent Quinn does not trust the cell*, proceed to _Dead and Gone 2_.",
        "trust": "Otherwise, skip to _Dead and Gone 5_.",
        "deadAndGone2": "<p>_Dead and Gone 2_: Quinn’s demeanor changes when she sees the look on your face. “Well, that triggered something. Still going to play it tight-lipped?” She heads to the center of the bluestone ring and takes out a small contraption possessing a series of lights along its surface. It lets out several beeps, rising in frequency as she reaches the very center. “Yeah, that just about confirms my suspicions…but I’m still missing the why. So, enlighten me, since you seem to know more than I do: what the hell could have made part of a structure vanish not just from existence, but from recorded history as well?”</p><p class='basic'>The investigators must decide (choose one):</p><ul><li>*Tell Agent Quinn the truth*. Proceed to _Dead and Gone 3_.</li><li>*Keep your secrets*. Skip to _Dead and Gone 4_.</li></ul>",
        "deadAndGone3": "<p>_Dead and Gone 3_: You tell Quinn everything—about the entities you were investigating in London, about their presumed connection to the Red Coterie, all of it. She listens intently, hanging on every word. “So these things, these… let us presume to call them ‘extraterrestrials,’ when they take something, it vanishes completely. Do you understand what this means?” You know a great many conclusions that could be drawn from these events, but you encourage her to continue on her own. “Everything we know, everything we can see, it’s just what’s left. Look at Stonehenge. We have no earthly clue what it is. Maybe that’s because it’s incomplete. There could have been dozens of other structures erected right where we stand and humanity would never know.” She paces back and forth, agitated. “This is my life’s work. I’ve studied these kinds of events for over a decade. Paranormal disappearances. Dead civilizations. Bloody hell, I’m fluent in a dozen dead languages. I’ve always assumed these events are a small slice of pie missing from the greater whole. But what if we’re only seeing what’s left—the tiny slice of pie these creatures haven’t stolen?”</p>",
        "gainTrust": "In your Campaign Log, cross off *Agent Quinn does not trust the cell*.",
        "swapElderThingForTablet": "Remove 1 {'{'}elderThing{'}'} token from the chaos bag. Add 1 {'{'}tablet{'}'} token (if there are already 4, each investigator earns 1 experience instead).",
        "check": "Check the Campaign Log.",
        "goOffMission": "*If the cell possesses a mysterious whistle* and 30 or fewer _time_ has passed, skip to _Dead and Gone 6_.",
        "stayOnMission": "Otherwise, skip to _Dead and Gone 7_.",
        "deadAndGone4": "<p>_Dead and Gone 4_: Quinn sighs and turns away from you. “Sorry to have wasted your time, then. You can take the Bentley back to London. It’s only a couple miles back to Amesbury. I’ll find another ride.” You try to reason with her, but she remains stoic. “If you have nothing to tell me, I have nothing to say to you, either. Please leave me be so I can continue my research in peace.”</p><ul><li>In your Campaign Log, record *the Foundation remains in the dark*.</li><li>Remove 1 {'{'}tablet{'}'} token from the chaos bag. Add 1 {'{'}elderThing{'}'} token (if there are already 4, each investigator earns 1 experience instead).</li><li>You may _embark_.</li></ul>",
        "deadAndGone5": "<p>_Dead and Gone 5_: Quinn heads to the center of the bluestone ring and takes out a small contraption possessing a series of lights along its surface. It lets out several beeps, rising in frequency as she reaches the very center. “This confirms my suspicions,” she says under her breath, then shows her readings to you. “Found these same kind of readings in a lot of other places. Roanoke Island. Angkor. You get the idea.” She stands and taps the device against the palm of her hand as she scans the stone rings. “These things you mentioned in your report, these—let us presume to call them ‘extraterrestrials’—when they take something, it vanishes completely. Do you understand what this means? Everything we know, everything we can see, it’s just what’s left. Look at Stonehenge. We have no earthly clue what it is. Maybe that’s because it’s incomplete. There could have been dozens of other structures erected right where we stand and humanity would never know.” She paces back and forth, agitated. “This is my life’s work. I’ve studied these kinds of events for over a decade. Paranormal disappearances. Dead civilizations. Bloody hell, I’m fluent in a dozen dead languages. I’ve always assumed these events are a small slice of pie missing from the greater whole. But what if we’re only seeing what’s left—the tiny slice of pie these creatures haven’t stolen?”</p><p class='basic'>Check the Campaign Log.</p>",
        "deadAndGone6": "<p>_Dead and Gone 6_: Suddenly, what Agent Quinn just said snaps you to attention. Quinn is an expert in long-dead languages and ancient civilizations. You ask her if she’d be willing to help you with a related matter far from Amesbury. “If it will help me get to the bottom of this, then yes,” she replies eagerly. “What can I do for you?” With bated breath, you tell her it might require her to not inform the Foundation of her next whereabouts. She takes a moment to consider the implications, then nods, resolute. You hand her the whistle Aliki gave to you and tell her that it belonged to a Coterie member who seemed to know only Latin, ancient Greek, and other languages you could not decipher. She studies it for a long while, turning it over and over in her hand. “A white raven,” she murmurs to herself. “The Greek myths tell us that ravens were the messengers of the Gods; Apollo in particular. They were once all white, but when Apollo sent one to spy on his lover, Coronis, he learned of his lover’s infidelity and scorched the raven’s wings black in anger.” You ask Agent Quinn if there is any place in the world one might associate with Apollo or his raven. “There are temples in Rome dedicated to the god Apollo,” she says. “Apollo Sosianus and Apollo Palatinus. Let me know if you head there. I’ll meet you.”</p><ul><li>In your Campaign Log, record *the cell is off-mission*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "deadAndGone7": "<p>_Dead and Gone 7_: You and Agent Quinn explore the ruins for some time, jockeying theories and ideas back and forth, but find no further evidence.</p><ul><li>Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "逝者如斯",
        "label": {
          "truth": "告诉奎因特工真相",
          "secrets": "保守秘密"
        },
        "deadAndGone1": "<p>你到了伦敦，遵循奎因特工的指示前往埃姆斯伯里。你刚在酒店办完入住，门房就默默递给你一张便条，上面写了个地址，就在这座历史悠久的小镇西边的公园。你立即动身，到了发现阿丽·奎因特工坐在一辆宾利的驾驶座上，正读着报纸，对你连个眼皮都没抬。你也没怎么惊讶，就默默爬上了座位。“可算来了，都等了一整天了。”你并不明白奎因是怎么知道你到了镇上，但基金会肯定在每个港口和边境检查点都设有耳目。你问她情况怎样，她又要给你看些什么。她只是发动宾利的引擎，一路往西。“你就等着吧。”车行片刻，你看到了熟悉的一幕。你早该想到的——奎因将你带到了神秘的史前巨石阵。此地的标志是一圈立石，里面还有另一圈小些的蓝石，看不出到底有什么用。有几个游人赞叹这壮丽的景色，但除此之外都很沉默。你跟在奎因特工后面，问她为什么要带你来这儿。“这地方很奇怪，不是吗？”她这是句反问——历史学家已经争论了很久，但还是不能确定这处地标到底是何用途。你靠近了些，她指着几块立石和同心圆里小一些的石块：“就像是有什么缺了一样。”</p><p class='basic'>检查剧本日志。</p>",
        "noTrust": "*奎因特工不信任特别小组*",
        "trust": "并非上述情况",
        "deadAndGone2": "<p>奎因看到你的表情，态度顿时变了。“噢，又来了，还是这么不痛快？”她朝蓝石环中心走去，拿出一个表面闪光的精巧装置，发出哔哔的声音，随着她靠近中心不断加快。“啊，这样就证实了我的怀疑……但我还是不知道为什么。那么，告诉我吧，毕竟你知道的比我多：到底是什么鬼东西能让一部分建筑不仅凭空消失，而且在历史记载上也荡然无存？”</p><p class='basic'>调查员必须决定(选择一项)：</p><ul><li>*告诉奎因特工真相*。</li><li>*保守秘密*。</li></ul>",
        "deadAndGone3": "<p>你把一切都告诉了奎因——你在伦敦调查的实体、他们与红色同志会可能的联系，所有的一切。她听得专心，每个词都不放过。“那么这些东西，这些……让我们就称之为‘外星来客’吧，它们夺走什么，就完全消失了。你知道这意味着什么吗？”这样的事件能让你得出许多结论，但你还是鼓励她说出自己的想法。“我们所知所见的一切，不过都是剩下来的。看看巨石阵吧，我们根本不知道它是什么。也许是因为根本不完整。我们所在的地方可能还有其他人类根本不知道的建筑。”她前后踱步，焦躁起来。“这是我毕生的工作啊，我研究这些事件已经超过十年了。异常的失踪、消亡的文明。他妈的，我能流利地说十几种死语言！我总是假设这些东西就像是整块陷阱上缺失的一小撮。但要是我们看到的只是剩下的——只是这些生物没有偷走的碎屑呢？”</p>",
        "gainTrust": "在剧本日志中，划掉*奎因特工不信任特别小组*。",
        "swapElderThingForTablet": "从混乱袋里移除1个{'{'}elderThing{'}'}标记。加入1个{'{'}tablet{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。",
        "check": "检查剧本日志",
        "goOffMission": "*特别小组拥有了神秘的哨子*且流逝的_时间_小于等于30",
        "stayOnMission": "并非上述情况",
        "deadAndGone4": "<p>奎因叹了口气，扭头不看你：“抱歉浪费了你的时间。你可以开着那辆宾利回伦敦去，离埃姆斯伯里没几英里。我会另找办法回去。”你试着再讲点道理，但她依然故我。“要是你没什么可以告诉我的，那我也没什么能跟你说。别管我了，让我安静地研究吧。”</p><ul><li>在剧本日志中，记录*基金会依然一团糊涂*。</li><li>从混乱袋里移除1个{'{'}tablet{'}'}标记。加入1个{'{'}elderThing{'}'}标记(如果已有4个，改为每位调查员取得1点经验值)。</li><li>你可以_启程_。</li></ul>",
        "deadAndGone5": "<p>奎因朝蓝石环中心走去，拿出一个表面闪光的精巧装置，发出哔哔的声音，随着她靠近中心不断加快。“这证实了我的怀疑。”她声音很轻，将读数拿给你看。“在许多其他地方也有一样的读数。罗阿诺克岛、吴哥，你懂的。”她站起来，拍拍仪器，环顾石阵：“你在报告里提到的东西，这些……让我们就称之为‘外星来客’吧，它们夺走什么，就完全消失了。你知道这意味着什么吗？我们所知所见的一切，不过都是剩下来的。看看巨石阵吧，我们根本不知道它是什么。也许是因为根本不完整。我们所在的地方可能还有其他人类根本不知道的建筑。”她前后踱步，焦躁起来。“这是我毕生的工作啊，我研究这些事件已经超过十年了。异常的失踪、消亡的文明。他妈的，我能流利地说十几种死语言！我总是假设这些东西就像是整块馅饼上缺失的一小撮。但要是我们看到的只是剩下的——只是这些生物没有偷走的碎屑呢？”</p><p class='basic'>检查剧本日志。</p>",
        "deadAndGone6": "<p>奎因特工所说突然引起了你的注意。奎因是死语言和古代文明领域的专家。你问她愿不愿意帮一个忙，翻译埃姆斯伯里语纲要。“要是能帮我搞清这一切，那肯定。”她热切答道，“需要我做什么？”你屏住呼吸，告诉她接下来的事情可不能告诉基金会。</p><p>她想了想你什么意思，坚定地点了点头。你将艾里奇给你的哨子交到她手里，告诉她这属于同志会的一员，而对方看上去只会拉丁语、古希腊语和其他你根本不懂的语言。她拿在手里翻来覆去，研究了好一会儿。“白鸦。”她自言自语道，“希腊神话说乌鸦为众神传信，尤其是阿波罗。它们本来都是白的。但有一次，阿波罗派出一只监视自己的恋人科洛尼斯，乌鸦却带回了不忠的消息。阿波罗一怒之下，将乌鸦的翅膀都烧黑了。”你问奎因世上有什么地方能跟阿波罗或是他的乌鸦联系起来。“罗马有献给阿波罗的神庙。”她说，“阿波罗索西乌斯神庙和帕拉蒂尼山阿波罗神庙。你要是过去，就告诉我一声。我们在那儿见面。”</p><ul><li>在剧本日志中，记录下*特别小组另有使命*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "deadAndGone7": "<p>你和奎因特工又探索了一会儿遗迹，各种理论和猜想都试过了，但还是没找到什么进一步的证据。</p><ul><li>每位调查员取得2点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "strangeArchitecture": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Strange Architecture",
        "body": "Check where you are on the map.",
        "inBombay": "If you are at Bombay, proceed to _Strange Architecture 1_.",
        "inStockholm": "If you are at Stockholm, skip to _Strange Architecture 4_.",
        "bombay": {
          "appreciated": "*If the cell appreciated the architecture*, proceed to _Strange Architecture 2_.",
          "notAppreciated": "Otherwise, skip to _Strange Architecture 3_."
        },
        "stockholm": {
          "appreciated": "*If the cell appreciated the architecture*, proceed to _Strange Architecture 5_.",
          "notAppreciated": "Otherwise, skip to _Strange Architecture 6_."
        },
        "strangeArchitecture1": "<p>_Strange Architecture 1_: The air is deliciously warm as you wait for a tram in southern Bombay. With several days until the next leg of your journey, you allow yourself to be drawn in by the city’s intoxicating color and light. A whirlwind first day sees you visit various temples, curio shops, and bazaars. Bright orange flowers hang by strings from bamboo racks as you make your way through a bazaar toward the Colaba Causeway, where the Gateway of India looks out onto the waterfront. As the day turns to evening, you continue to explore back alleys and side streets lit by delicately inlaid bronze lamps. The air is thick with unknown scents and hazy shapes as you lose yourself in the heady atmosphere of the old city. As you make your way to your hotel, you cross a wide thoroughfare into the Kala Ghoda district and stroll down its old, winding roads.</p><p class='basic'>Check the Campaign Log.</p>",
        "strangeArchitecture2": "<p>_Strange Architecture 2_: As you navigate the labyrinthine art district, you pass a familiar sight. Looking up, you see a narrow building with a slate façade, wide black windows, and unsettling accents. You have the distinct feeling you have been here before. You stand still for a moment as others pass you in the narrow street until you remember the same building in Stockholm. If not for the distinct, black windows and the harsh lines, you might not have remembered it. As you scan the façade, the frieze overhanging the door stands out to you. Where there were various recognizable figures before, you see odd, gangling facsimiles. The features are almost plastic; the smiles are too broad; the eyes seem to bulge. The number 13 is carved next to the door, same as in Stockholm. Curious, you step up and turn the doorknob, but it doesn’t budge. Knocking on the door produces virtually no sound. Although it looks like wood, it feels solid as concrete. Stopping a passer-by, you ask how long the building has been here. “This is an ancient place. These buildings have been here a long time,” they tell you. You find yourself questioning if the original you saw was even the original: how many other houses look just like this one in how many other cities? The building grows more foreboding the longer you look at it. A shudder courses up your spine, and you decide to leave the building alone.</p><ul><li>In your Campaign Log, cross off *the cell appreciated the architecture*. Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "strangeArchitecture3": "<p>_Strange Architecture 3_: As you navigate the labyrinthine art district, one façade in particular stands out to you. A narrow building with handsome cornice molding and intricate stonework is wedged between two older local buildings. The number 13 is carved next to a pair of austere wooden doors. Over the door is a slate frieze that depicts a cast of mythological figures: some recognizable, some not. The building itself looks out of place amidst the intricate architecture of the surrounding area. The look of the building makes you feel vaguely uneasy the longer you study it. There is a coldness, a sharpness to the building’s design, accentuated by jagged quoins and harsh angles. Something about the wide, black windows, the dark interior, denotes the emptiness of a hollow skull. The darkness in the evening only magnifies the sense of eeriness; others do not seem so willing to linger here.</p><ul><li>In your Campaign Log, record *the cell appreciated the architecture*.</li><li>You may _embark_.</li></ul>",
        "strangeArchitecture4": "<p>_Strange Architecture 4_: The docks bustle with activity as you arrive in Stockholm. Towering dock workers load massive crates of silvery, flapping fish into trucks as morning chimes ring in the cool clear air. With several days until your next departure, you seize upon the opportunity to explore the city’s eclectic culture. Advertisements for a production of a play named “Ödestimmen” paper the alleys and stops surrounding Stockholm’s largest theatre. You follow the cobblestone streets around Stockholm’s old town district, which the locals tell you is called “the town between bridges.” The winding narrow paths loop in on themselves and cross at odd angles to form a labyrinth of crumbled mustard-yellow alleys and worn façades. You pass a row of distinctly painted rowhouses overlooking the town square. As you sit down and watch locals come and go, you feel a great weight lift from you, if only for a moment. The broad blue sky overhead is clear and cloudless, and the hubbub around you is strangely calming.</p><p class='basic'>Check the Campaign Log.</p>",
        "strangeArchitecture5": "<p>_Strange Architecture 5_: As you walk down Shoemaker’s street, you pass a familiar sight. Looking up, you see a narrow building with a slate façade, wide black windows, and unsettling accents. You have the distinct feeling you have been here before. You stand still for a moment as others pass you in the narrow alley, until you remember the same building in Bombay. If not for the distinct, black windows and the harsh lines, you might not have remembered it. As you scan the façade, the frieze overhanging the door stands out to you. Where there were various recognizable figures before, you see odd, gangling facsimiles. The features are almost plastic; the smiles are too broad; the eyes seem to bulge. The number 13 is carved next to the door, same as in Bombay. Curious, you step up and turn the doorknob, but it doesn’t budge. Knocking on the door produces virtually no sound. Although it looks like wood, it feels solid as concrete. Stopping a passer-by, you ask how long the building has been here. “What do you mean? This is a very old city. It’s always been here,” they tell you. You find yourself questioning if the original you saw was even the original: how many other houses look just like this one in how many other cities? The building grows more foreboding the longer you look at it. A shudder courses up your spine, and you decide to leave the building alone.</p><ul><li>In your Campaign Log, cross off *the cell appreciated the architecture*. Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "strangeArchitecture6": "<p>_Strange Architecture 6_: As you walk down Shoemaker’s street, one façade in particular stands out to you. A narrow building with handsome cornice molding and intricate stonework is wedged between two older local buildings. The number 13 is carved next to a pair of austere wooden doors. Over the door is a slate frieze that depicts a cast of mythological figures: some recognizable, some not. The building itself looks out of place amidst the worn stone and crumbling history of the surrounding alleyway. The look of the building makes you feel vaguely uneasy the longer you study it. There is a coldness, a sharpness to the building’s design, accentuated by jagged quoins and harsh angles. Something about the wide, black windows, the dark interior, denotes the emptiness of a hollow skull. The alley around you, too, is strangely quiet: passers-by do not seem to linger here.</p><ul><li>In your Campaign Log, record *the cell appreciated the architecture*.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "奇异建筑",
        "body": "检查你在地图上的位置。",
        "inBombay": "你在孟买",
        "inStockholm": "你在斯德哥尔摩",
        "bombay": {
          "appreciated": "*特别小组对建筑表示惊叹*",
          "notAppreciated": "并非上述情况"
        },
        "stockholm": {
          "appreciated": "*特别小组对建筑表示惊叹*",
          "notAppreciated": "并非上述情况"
        },
        "strangeArchitecture1": "<p>你在孟买南部等电车，突然闻到空气中一阵温暖的芳香。距离下一段旅程还有几日，你得以纵情享受这座城市的异国光彩。第一天，你马不停蹄地去了许多神庙、珍品店和巴扎。你穿过巴扎，前往克拉巴街，印度门就在此处远眺海面。一路上头顶的竹架用丝线系着亮橙色的花朵。日去夜来，镶嵌精致的铜灯照亮了你探索的后巷小街。空气中氤氲着不知名的浓郁气味，朦胧的身影若隐若现。你迷失在老城上头的气氛中。你前往酒店，穿过宽敞的大道进入卡拉葛达区，沿着蜿蜒的老巷一路漫步。</p><p class='basic'>检查剧本日志。</p>",
        "strangeArchitecture2": "<p>你穿过这座艺术街区迷宫般的街道，却看到了熟悉的一幕。你抬起头看到了一栋狭窄的建筑，看到了门顶上的石板、黑黢黢的大窗和令人不安的漆色。你清楚地认识到自己来过这儿。你静静地站着，身边人穿过进了窄巷。你终于想起来在斯德哥尔摩见过一样的建筑。要不是这样特别的黑窗、粗犷的线条，你可能还想不起来。你端详立面，门顶似乎凸了出来。你原本认出的几个人物，在这里却是笨拙古怪的临摹。个个形象特征虚伪、笑容夸张，眼睛鼓出。门上倒是刻着数字13，和斯德哥尔摩的一样。你好奇地上前，转动把手，门没有开。敲门也没有声响。尽管看上去像是木门，却坚硬得有如混凝土。你拦下一个路人，问这栋建筑有多久了。“这地方有些历史了。这些房子都建了很长时间。”你疑惑这样的建筑是不是复制品：其他城市里还有多少房子会看起来一样？你看得越久，这栋房子就显得越是不祥。你脊背生寒，决定不管这栋房子，扭头就走。</p><ul><li>在剧本日志中，划掉*特别小组对建筑表示惊叹*。每位调查员取得2点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "strangeArchitecture3": "<p>你穿过这座艺术街区迷宫般的街道，一座建筑的立面突然耸立在眼前。这栋建筑挤在两座当地老房之中，虽然不算宽敞，但飞檐壮观，石雕精美。古朴的两扇木门上刻着数字13，门顶上的石板刻画着众多神话人物，你只能认出部分。周围的建筑十分精巧，显得这一栋有些格格不入。你研究越久，就越依稀觉得有些不快。外角参差而扎眼，这样的设计透露出一股冷酷犀利的味道。有什么东西正在黑黢黢的大窗旁。里面漆黑一片，就像空洞的头骨。漆黑的夜幕加深了诡异的感觉，旁人看来都不愿逗留此处。</p><ul><li>在剧本日志中，记录*特别小组对建筑表示惊叹*。</li><li>你可以_启程_。</li></ul>",
        "strangeArchitecture4": "<p>你抵达斯德哥尔摩的时候，码头上正一片喧嚣。晨钟响彻清冷的早风，身材高大的码头工人将一箱箱扑扇的银鱼装车。离下次出发还有几日，你抓紧机会探索这座城市多样的文化。一出名为《命运时刻》的剧作就要上演，广告贴满了大街小巷，直到斯德哥尔摩最大的剧院。你沿着卵石路环绕斯德哥尔摩的老城，当地人告诉你这一片地方叫“桥间之城”。蜿蜒狭窄的小路围成了环，绕出奇怪的角度。破旧的芥黄色小巷和风化的建筑构成一片迷宫。你经过一串漆彩艳丽的联排别墅，这里俯瞰着城镇广场。你坐下来，看当地人来来往往，感到千斤重担从身上卸下，哪怕只有一刻。浩瀚的蓝天万里无云，四周的喧嚣倒也叫人安宁。</p><p class='basic'>检查剧本日志。</p>",
        "strangeArchitecture5": "<p>你走过鞋匠街，却看到了熟悉的一幕。你抬起头看到了一栋狭窄的建筑，看到了门顶上的石板、黑黢黢的大窗和令人不安的漆色。你清楚地认识到自己来过这儿。你静静地站着，身边人穿过进了窄巷。你终于想起来在孟买见过一样的建筑。要不是这样特别的黑窗、粗犷的线条，你可能还想不起来。你端详立面，门顶似乎凸了出来。你原本认出的几个人物，在这里却是笨拙古怪的临摹。个个形象特征虚伪、笑容夸张，眼睛鼓出。门上倒是刻着数字13，和孟买的一样。你好奇地上前，转动把手，门没有开。敲门也没有声响。尽管看上去像是木门，却坚硬得有如混凝土。你拦下一个路人，问这栋建筑有多久了。“你什么意思？这座城市这么古老。它一直都在这儿。”你疑惑这样的建筑是不是复制品：其他城市里还有多少房子会看起来一样？你看得越久，这栋房子就显得越是不祥。你脊背生寒，决定不管这栋房子，扭头就走。</p><ul><li>在剧本日志中，划掉*特别小组对建筑表示惊叹*。每位调查员取得2点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "strangeArchitecture6": "<p>你走过鞋匠街，一座建筑的立面突然耸立在眼前。这栋建筑挤在两座当地老房之中，虽然不算宽敞，但飞檐壮观，石雕精美。古朴的两扇木门上刻着数字13，门顶上的石板刻画着众多神话人物，你只能认出部分。周围的建筑饱经风霜，显得这一栋有些格格不入。你研究越久，就越依稀觉得有些不快。外角参差而扎眼，这样的设计透露出一股冷酷犀利的味道。有什么东西正在黑黢黢的大窗旁。里面漆黑一片，就像空洞的头骨。周围的街巷也安静得诡异：路人似乎都不愿在此逗留。</p><ul><li>在剧本日志中，记录*特别小组对建筑表示惊叹*。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "theoryOfAnnihilation": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Theory of Annihilation",
        "theoryOfAnnihilation1": "<p>_Theory of Annihilation 1_: As your ship puts into port at Rio De Janeiro, you see a massive hollow statue under construction on Corcovado mountain overlooking the city. The statue is vaguely humanoid, its arms spread wide in welcome . . . or is it a warning?</p><p class='basic'>Check the Campaign Log.</p>",
        "traveled": "*If the cell met Dr. Irawan* and less than 25 _time_ has passed, proceed to _Theory of Annihilation 2_.",
        "vanished": "*If the cell met Dr. Irawan* and 25 or more _time_ has passed, skip to _Theory of Annihilation 3_.",
        "met": "Otherwise, skip to _Theory of Annihilation 4_.",
        "theoryOfAnnihilation2": "<p>_Theory of Annihilation 2_: After some searching, you find Dr. Irawan in the Belmond Copacabana seated at a table covered in sketches and academic clutter. “I am actually glad you missed my lecture,” she says. “It was an utter disaster. I was laughed out of the auditorium when I tried to present. Someone called me a ‘cryptozoologist’.”</p><p>Dr. Irawan adjusts her large round spectacles as she turns to a beautifully detailed sketch of a bird roosting in a palm tree. “I presented what I am calling the Theory of Annihilation. A process by which an ecosystem is, itself, devoured via what you have dubbed ‘paranatural selection.’ Not just the ecosystem, but the memory of itself. The fact of its very existence.”</p><p>“Do not worry, I will credit you for that term,” she takes a sip of strong, dark coffee. “But after my recent survey of the Amazon, I am afraid the process is accelerating. A dozen species of macaw have vanished, and my colleagues have no memory of them. The sketches have disappeared as well. Of those we documented, only the scarlet macaw remains.”</p><p>As Dr. Irawan flips idly through her sketchbook, her eyes catch on a particular page, and her face goes white. “This cannot be.”</p><p>You ask her what the matter is, and she points to the page. “Just yesterday, this page was not blank. The Phalanger septimus. A cuscus living in the western New Guinea.”</p><p>Dr. Irawan begins gathering up her things. “I sketched this subject months ago. Perhaps there will be some trace of it—or of whatever force is behind all this—out in Manokwari.” She pushes a strand of hair behind her ear and smiles at you. “Thank you for listening. Perhaps we will meet again.”</p><ul><li>In your Campaign Log, record *Dr. Irawan traveled to New Guinea*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>Under “Time Passed,” write _δ_ (delta) underneath the current time. (*This symbol has no status report and is only used as a time marker.*)</li><li>In the Southeast Asia section of the Campaign Log, find Manokwari. In its spot, write “45–P.” You are now able to travel to Manokwari whenever you embark.</li><li>You may _embark_.</li></ul>",
        "theoryOfAnnihilation3": "<p>_Theory of Annihilation 3_: Upon arriving in the city, you look for Dr. Irawan at the Belmond Copacabana. The concierge checks the reservation on your behalf when you mention Dr. Irawan’s lecture, but finds nothing. You take out the card she gave you, but both sides are blank. It’s as though she has vanished completely…</p><ul><li>In your Campaign Log, record *Dr. Irawan vanished from existence*.</li><li>You may _embark_.</li></ul>",
        "theoryOfAnnihilation4": "<p>_Theory of Annihilation 4_: After some searching, you find Dr. Irawan in the Belmond Copacabana seated at a table covered in sketches and academic clutter. After introducing yourself, you ask about her research.</p><p>“Oh, I see. You are here to mock me,” she says, closing a worn survey journal. You tell her you aren’t, and after some coaxing, she opens up to you. “I am actually glad you missed my lecture,” she says. “It was an utter disaster. I was laughed out of the auditorium when I tried to present. Someone called me a ‘cryptozoologist’.”</p><p>You tell her that there are worse insults. “That may be,” Dr. Irawan adjusts her large round spectacles. “But for my career, it is a death knell.” She turns to a beautifully detailed sketch of a bird roosting in a palm tree. “I presented what I am calling the Theory of Annihilation. The world devouring itself. Not just itself, but the memory of itself. The fact of its very existence.”</p><p>She takes a sip of strong, dark coffee. “Several years ago, I surveyed the Amazon with a half dozen other well-known academics. We observed dozens of distinct species of macaw, and named each after a stone: turquoise, amethyst, obsidian, the like. But now,” she turns to several empty pages. “There is no trace or record of any of them. My colleagues tell me I made up the Turquoise Macaw and the others. There is no trace of them in their habitat, either. And the sketches have disappeared as well.”</p><p>You assure Dr. Irawan that she is not mad, and share what little you can about the disappearances.</p><p>“Thank you,” says Dr. Irawan. “I am glad we met. I was beginning to think this was all in my head.” She gives you her business card with the address of a university in Australia written on the back. “I will be in Perth to continue my survey and my next lecture. Perhaps I will see you there.”</p><ul><li>In your Campaign Log, record *the cell met Dr. Irawan*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "灭绝理论",
        "theoryOfAnnihilation1": "<p>你乘坐的船只在里约热内卢靠岸。远方的科尔科瓦杜山俯瞰全城，上面有一座巨大的雕像尚未落成，内部尚空。雕像依稀能看出些人形，舒张双臂，像是欢迎……或是警告？</p><p class='basic'>检查剧本日志。</p>",
        "traveled": "*特别小组与伊拉万博士会面*且流逝的_时间_小于25",
        "vanished": "*特别小组与伊拉万博士会面*且流逝的_时间_大于等于25",
        "met": "并非上述情况",
        "theoryOfAnnihilation2": "<p>经过一番探查，你终于在科帕卡瓦纳街区的贝尔蒙德酒店找到了伊拉万教授。她面前的桌上散乱着草图和学术资料。“你没来讲座真是太好了。”她说，“彻彻底底的一场灾难。一整个礼堂的人都在嘲笑我展示的东西。还有人叫我‘谜之动物学家’。”</p><p>伊拉万教授扶了扶自己大框的圆眼镜，转向一张细节详实的素描，上面画的是棕榈树上栖息的鸟儿。“我将自己展示的东西称为‘灭绝理论’。这一过程在你称之为‘超自然选择’的方式中，使得生态系统吞噬了自己。不只是生态系统，还有自己的记忆，吞噬自己存在的事实。”</p><p>“不要担心，这个术语我会署你的名。”她抿了一口浓浓的黑咖啡，“但最近在亚马逊勘测之后，我担心这个过程正在加速。”十几秒金刚鹦鹉都消失了，我的同事一点也不记得。素描也是一样。在我们记录的所有物种里，只有猩红金刚鹦鹉还在。”</p><p>伊拉万博士漫不经心地翻着自己的速写本，翻到某一页时脸色煞白：“这不可能。”</p><p>你问她发生了什么，她指着那一页给你看：“就在昨天，这一页上还有画，七斑袋貂，一种尚未灭绝的的斑袋貂，生活在新几内亚西部。”</p><p>伊拉万博士收起自己的东西。“我几个月前才画的图。兴许会有些踪迹留在——或者说是这一切背后的力量就在——马诺夸里。”她拂过耳边的一缕头发，朝你笑道：“谢谢你听我讲这些。也许我们还会再见面的。”</p><ul><li>在剧本日志中，记录下*伊拉万博士前往新几内亚*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在“流逝的时间”中当前时间底下记录_δ_(德尔塔)。*(这个符号没有状况报告，只用于记录时间。)*</li><li>在剧本日志的东南亚部分，找到马诺夸里，在其位置写下“45-P”。从现在开始，每当你启程，可以旅行前往马诺夸里。</li><li>你可以_启程_。</li></ul>",
        "theoryOfAnnihilation3": "<p>你一进城，就去科帕卡瓦纳街区的贝尔蒙德酒店寻找伊拉万博士。你向门房提起伊拉万博士的讲座，他帮你检查预订日程，却什么都没找到。你掏出她给你的名片，却发现两面都是空白。看上去她完全消失了……</p><ul><li>在剧本日志中，记录下*伊拉万博士凭空消失*。</li><li>你可以_启程_。</li></ul>",
        "theoryOfAnnihilation4": "<p>经过一番探查，你终于在科帕卡瓦纳街区的贝尔蒙德酒店找到了伊拉万教授。她面前的桌上散乱着草图和学术资料。你先自我介绍，然后问起她的研究。</p><p>“哦，我懂了。你是来取笑我的。”她说着合上了磨损的勘察日志。你向她保证绝对不是，好好地哄了一番，终于让她敞开心扉。“你没来讲座真是太好了。”她说道，“彻彻底底的一场灾难。一整个礼堂的人都在嘲笑我展示的东西。还有人叫我‘谜之动物学家’。”</p><p>你告诉她这还不算最难听的称呼。“大概吧。”伊拉万教授扶了扶自己大框的圆眼镜，“但这已经是给我的生涯判了死刑了。”她转向一张细节详实的素描，上面画的是棕榈树上栖息的鸟儿。“我将自己展示的东西称为‘灭绝理论’。世界正在吞噬自己，不仅如此，也在吞噬自己的记忆，吞噬自己存在的事实。”</p><p>她抿了一口浓浓的黑咖啡：“几年前，我和其他六位著名的学者勘察了亚马逊地区。我们观察了几十种不同的鹦鹉，并且用石头命名：绿松石鹦鹉、紫水晶鹦鹉、黑曜石鹦鹉，诸如此类。可到现在——”她拿出几张白纸，“——一切记录都消失了，同事说绿松石鹦鹉和其他物种都是我编造出来的。有关其栖息地的记录也都没了，素描也是一样。”</p><p>你觉得伊拉万博士没疯，就把自己对失踪案所知的一点点情况也告诉了她。</p><p>“谢谢。”伊拉万说道，“我们能碰上真是太好了。我已经开始觉得这些确实是我脑子里编出来的了。”她将自己的名片给了你，背面写着澳洲一所大学的地址。“我会去珀斯继续调查、讲座。也许我们会在那儿再见。”</p><ul><li>在剧本日志中，记录下*特别小组与伊拉万博士会面*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "paranaturalSelection": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Paranatural Selection",
        "paranaturalSelection1": "<p>_Paranatural Selection 1_: A cool breeze greets you as you arrive in Perth. The capital of Western Australia is nestled in the crook of the Swan River, and despite—or perhaps because of—the nearby gold rush, it has the rugged feel of a frontier town. You catch a scent of something too sweet, possibly rotten, on the breeze.</p><p class='basic'>Check the Campaign Log.</p>",
        "traveled": "*If the cell met Dr. Irawan* and less than 25 _time_ has passed, proceed to _Paranatural Selection 2_.",
        "vanished": "*If the cell met Dr. Irawan* and 25 or more _time_ has passed, skip to _Paranatural Selection 3_.",
        "met": "Otherwise, skip to _Paranatural Selection 4_.",
        "paranaturalSelection2": "<p>_Paranatural Selection 2_: You find Dr. Irawan at the local university cleaning up an empty lecture hall. On the blackboard is a precise chalk drawing of a stocky marsupial clutching a cluster of sedge grass.</p><p>“I did not expect to see you here,” the zoologist sets to erasing the blackboard. You ask about the sketch. “It is a rare species of quokka: the red-tailed quokka. They were first introduced to the West by Dutch explorers in the 17th century. And now no one—not even the Cambridge professor who taught me their name—remember what they are.”</p><p>“I do not know how much you have studied natural selection, but what we are experiencing feels very much like the introduction of a new apex predator into an ecosystem that has not evolved to withstand it,” says the zoologist. “Except that this predator feeds not only on the body, but on the actual existence of its prey. Although, of course, that would be unthinkable,” she laughs. “But I cannot help feeling that we are its prey. And the process is only accelerating.” The zoologist sits down and begins to flip idly through a sketchbook.</p><p>Thinking on the terms the Foundation used, you suggest she name the phenomena “Paranatural Selection.” She looks troubled at the suggestion, then smiles.</p><p>“I will be sure to credit you,” she says, then goes pale. You look down and see her gaze fixed on a particular page in her sketchbook. “This cannot be.”</p><p>You ask her what the matter is, and she points to the page. “Just yesterday, this page was not blank. The Phalanger septimus. A cuscus living in western New Guinea.”</p><p>Dr. Irawan begins gathering up her things. “I sketched this subject from direct observation just months ago. Perhaps there will be some trace of it—or of whatever force is behind all this—out in Manokwari.” She pushes a strand of hair behind her ear and smiles at you. “Thank you for listening. Perhaps we will meet again.”</p><ul><li>In your Campaign Log, record *Dr. Irawan traveled to New Guinea*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>Under “Time Passed,” write _δ_ (delta) underneath the current time. (*This symbol has no status report and is only used as a time marker.*)</li><li>In the Southeast Asia section of the Campaign Log, find Manokwari. In its spot, write “45–P.” You are now able to travel to Manokwari whenever you embark.</li><li>You may _embark_.</li></ul>",
        "paranaturalSelection3": "<p>_Paranatural Selection 3_: Upon arriving in the city, you look for Dr. Irawan at the local university. A helpful professor scours the academic schedule on your behalf when you mention Dr. Irawan’s lecture, but finds nothing. You take out the card she gave you, but both sides are blank. It’s as though she has vanished completely…</p><ul><li>In your Campaign Log, record *Dr. Irawan vanished from existence*.</li><li>You may _embark_.</li></ul>",
        "paranaturalSelection4": "<p>_Paranatural Selection 4_: You catch Dr. Irawan walking out of a lecture at the local university and invite her to a nearby cafe to chat about her research. On a sunlit veranda, she lays several life-like sketches out on the table between you. “Have you ever heard of the red-tailed quokka?” she asks. You shake your head. “They were first introduced to the West by Dutch explorers in the 17th century, and have been listed in standard taxonomy since then. I learned about them at Cambridge.”</p><p>Dr. Irawan leafs through a sketchbook to a blank page. “On a survey five years ago, I took several sketches in the wild. But recently, I opened my books and the sketches were blank, as if they had never been drawn. Moreover, every footnote and reference to them in academia has vanished. I asked my professor at Cambridge—the man who taught me what red-tailed quokkas were—and he looked at me as though I had gone mad.” The zoologist adjusts her large spectacles.</p><p>You assure Dr. Irawan that she is not mad, and share what little you can about the disappearances.</p><p>“I do not know how much you have studied natural selection, but what we are experiencing feels very much like the introduction of a new apex predator into an ecosystem that has not evolved to withstand it,” says the zoologist. “Except that this predator feeds not only on the body, but on the actual existence of its prey. Although, of course, that would be unthinkable,” she laughs. “But I cannot help feeling that we are its prey.”</p><p>Thinking on the terms the Foundation used, you suggest she name the phenomena “Paranatural Selection.” She looks troubled at the suggestion, then smiles.</p><p>“Perhaps I will use that, with your permission,” says Dr. Irawan. “I am glad we met. I was beginning to think this was all in my head.” She gives you her business card with the name of a hotel in Brazil written on the back. “I will be in Rio de Janeiro to continue my survey, and my next lecture. Perhaps I will see you there.”</p><ul><li>In your Campaign Log, record *the cell met Dr. Irawan*.</li><li>Each investigator earns 1 experience, as they gain insight into the strange happenings around the world.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "超自然选择",
        "paranaturalSelection1": "<p>一阵凉爽的清风欢迎你来到珀斯。这里是西澳大利亚的首府，就座落在天鹅河的弯处。虽然——或者说正因为——最近涌起了淘金潮，这里有一种只属于边境小镇的粗犷之感。你闻到风中传来一阵甜腻的气味，是有什么东西腐败了吗？</p><p class='basic'>检查剧本日志。</p>",
        "traveled": "*特别小组与伊拉万博士会面*且流逝的_时间_小于25",
        "vanished": "*特别小组与伊拉万博士会面*且流逝的_时间_大于等于25",
        "met": "并非上述情况",
        "paranaturalSelection2": "<p>你在当地一所大学里找到了伊拉万博士。她正在讲座大厅里收拾，这里没有旁人。黑板上粉笔画了一只粗壮的有袋类动物，手里抓着一把莎草。</p><p>“我没想过能在这儿见到你。”动物学家擦起了黑板。你问她上面画的是什么。“是一种珍稀的短尾矮袋鼠——红尾短尾矮袋鼠。它们一开始是17世纪荷兰探险家引入西澳的，可是现在已经没有人——哪怕是告诉我这个名字的剑桥教授——也不记得它们是什么物种了。”</p><p>“我不知道你对自然选择了解多少，但我们所经历的事情，很像在生态系统中引入一种陌生的顶级捕食者。”动物学家解释道，“只不过，这种捕食者猎杀的不仅是猎物的躯体，还有其存在本身。当然，这样的事情简直不可思议。”她笑了，“但我确实觉得咱们就是它的猎物，而且整个过程还在加速。”动物学家坐了下来，漫不经心地翻起速写本来。</p><p>你想到了基金会用过的术语，建议她将这种现象命名为“超自然选择”。她一下子被这个建议搞晕了，但随即笑了起来。</p><p>“我肯定会把你的名字写上去。”她正说着，脸色突然煞白。你低下头，发现她紧盯着速写本上的一页。“这不可能。”</p><p>你问她发生了什么，她指着那一页给你看：“就在昨天，这一页上还有画，七斑袋貂，一种尚未灭绝的进袋貂，生活在新几内亚西部。”</p><p>伊拉万博士收起自己的东西。“我几个月前才直接观察过，画下了图。兴许会有些踪迹留在——或者说是这一切背后的力量就在——马诺夸里。”她拂过耳边的一缕头发，朝你笑道：“谢谢你听我讲这些。也许我们还会再见面的。”</p><ul><li>在剧本日志中，记录下*伊拉万博士前往新几内亚*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>在“流逝的时间”中当前时间底下记录_δ_(德尔塔)。*(这个符号没有状况报告，只用于记录时间。)*</li><li>在剧本日志的东南亚部分，找到马诺夸里，在其位置写下“45-P”。从现在开始，每当你启程，可以旅行前往马诺夸里。</li><li>你可以_启程_。</li></ul>",
        "paranaturalSelection3": "<p>你一进城，就去当地的大学寻找伊拉万博士。你向一位热心的教授提到伊拉万博士的讲座，他帮你查了学术日志，却什么都没找到。你掏出她给你的名片，却发现两面都是空白。看上去她完全消失了……</p><ul><li>在剧本日志中，记录下*伊拉万博士凭空消失*。</li><li>你可以_启程_。</li></ul>",
        "paranaturalSelection4": "<p>伊拉万博士刚刚在当地的大学结束一场讲座，你趁此机会邀请她到附近的咖啡馆聊聊她的研究。你们坐在露台上晒太阳。她将几张素描放在中间的桌上，上面画的好像是某种生物。“你听说过红尾短尾矮袋鼠吗？”她问道。你摇了摇头。“它们一开始是17世纪荷兰探险家引入西澳的，此后就一直留在动物标准分类上。我也是在剑桥学到的。”</p><p>伊拉万博士在速写本上匆匆翻到空白的一页：“五年前我在野外勘测的时候画过几张素描。但最近我打开书和速写本，却发现一片空白，就跟我从来没画过似的。不仅如此，学术界一切有关的注释和来源也都消失了。我去问自己在剑桥的教授——就是那个教我红尾短尾矮袋鼠的人——但他看我的样子，就跟我疯了一样。”动物学家扶了扶自己的眼镜。</p><p>你觉得伊拉万博士没疯，就把自己对失踪案所知的一点点情况也告诉了她。</p><p>“我不知道你对自然选择了解多少，但我们所经历的事情，很像在生态系统中引入一种陌生的顶级捕食者。”动物学家解释道，“只不过，这种捕食者猎杀的不仅是猎物的躯体，还有其存在本身。当然，这样的事情简直不可思议。”她笑了，“但我确实觉得咱们就是它的猎物。”</p><p>你想到了基金会用过的术语，建议她将这种现象命名为“超自然选择”。她一下子被这个建议搞晕了，但随即笑了起来。</p><p>“要是得到你的许可，我可能真会用的。”伊拉万博士说道，“我们能碰上真是太好了。我已经开始觉得这些确实是我脑子里编出来的了。”她将自己的名片给了你，背面写着巴西的一家酒店。“我会去里约热内卢继续调查、讲座。也许我们会在那儿再见。”</p><ul><li>在剧本日志中，记录下*特别小组与伊拉万博士会面*。</li><li>每位调查员取得1点经验值，因为其对全球奇异的失踪事件有了洞见。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "metamorphosis": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the strange happenings around the world."
        },
        "title": "Metamorphosis",
        "metamorphosis1": "<p>_Metamorphosis 1_: It is early evening as your boat pulls into port in Manokwari. Towering mountains covered in rich greenery roll down to meet the brilliant blue water. As night falls, coruscating lights dance beneath the surface of the water: are they bioluminescent plants, or something else?</p><p class='basic'>Check how much time has passed since _δ_ (delta).</p>",
        "tenOrLessTime": "If 10 or fewer time has passed since _δ_ (delta), proceed to _Metamorphosis 2_.",
        "moreThanTenTime": "If more than 10 time has passed since _δ_ (delta), skip to _Metamorphosis 3_.",
        "metamorphosis2": "<p>_Metamorphosis 2_: At first, you are concerned that nobody recognizes Dr. Irawan’s name, but after some persistent questioning, a reluctant local offers to lead you to her. Heading into the dense underbrush, you follow a steep path up a nearby mountain until you reach a dark hollow. Leaning against the trunk of an ironwood tree, you find the zoologist peering intently into the shadows.</p><p>“I did not expect you to follow me here,” Dr. Irawan whispers. Following her lead, you sit down next to her and peer into the dark. The air around you is thick and moist. “My theory was…incorrect. Or at least, partially incorrect.” From your vantage point, you can see into a shallow dell cut by a cascading waterfall. The moon shimmers on the ripples of a narrow stream. Dr. Irawan continues: “All trace of this particular cuscus is gone, that much is for certain. The locals have no memory of them. But something is different about the disappearance. Something lingers.”</p><p>A low, moaning wail from somewhere in the trees startles you. Dr. Irawan holds out a pair of binoculars and points at a cluster of ironwood trees on the far side of the glade. Peering through, you spy three cat-sized marsupials with yellow eyes clinging to a branch, curled tails swinging in the dark. They are feeding on something. Just looking at them makes your head spin: something about them is both there and not there at once, forcing your eyes to constantly adjust. The animals’ movements are stiff and double-jointed as well, both too fast and too slow. You look away.</p><p>“You see them?” asks Dr. Irawan. You nod and look again: the cuscus are messily devouring a green python. “It is fascinating. A fundamental change. The prey have become predators. The few I have observed have made a complete shift in behavior, turning on other cuscus, hunting their own natural predators—of which the green python is one. Their very nature seems to have changed!” Dr. Irawan stammers excitedly. “But more importantly, they aren’t gone. I mean: they have gone, to some. Nobody remembers them. But yet they persist.”</p><p>You turn your binoculars back to the cuscus to find them frozen: staring straight at you with their bright, topaz eyes. Surprised, you drop the binoculars. When you look again, the cuscus are gone. Suddenly on edge, you tell Dr. Irawan it would be best to leave, but she shakes her head. “I am on the verge of the greatest discovery of the century. An entire field of para-zoological research. I cannot leave now.”</p><p>Leaving Dr. Irawan to her own devices, you head back into town. The jungle around you is eerily silent, and even as you break into a moonlit clearing, you cannot help the feeling of being watched.</p><p>Over the next few days, you make contact with the zoologist in passing. The day your ship is scheduled to leave Manokwari, Dr. Irawan is suspiciously absent from the guest house. The staff tell you she didn’t return the night before. Concerned for her safety, you return to the hollow where you met her before. The jungle retains the same unsettling quietude as you hike up the mountain.</p><p>Scattered on a rock overhanging the dark hollow are several torn-up sketchbooks and a broken pair of binoculars, but no trace of Dr. Irawan. Scanning the murky copse, you see a glimmer of light and the zoologist’s batik vest at the base of the waterfall. You carefully pick your way down the muddy slopes to the bank of a narrow stream where the zoologist lays prone, her arm bent at an odd angle. A trio of yellow-eyed cuscus scatter as you approach. Turning her over gently, you are relieved to find her still breathing. A strange black implement is clutched in her left hand, close to her chest.</p><p>A mordant call resounds from above. Dr. Irawan is surprisingly light as you scoop her up in your arms. Dozens of yellow eyes glare down at you from the ironwood trees as you carry the zoologist downstream, away from the hollow. Flitting, shimmering forms dart to and fro overhead like silent warnings.</p><p>As soon as you get back to town, you check the unconscious zoologist into a clinic. The ship you had booked has already left, but with the strange circumstances you found her in, you resolve to stay with Dr. Irawan until she wakes up. Several days pass, filled with disquieting silence, until she finally speaks.</p><p>“I noticed several cuscus gathered around this,” she thumbs the hollow bell in her good hand. “I knew better than to interfere. But they seemed so fixated on it. Much like magpies or crows will hoard certain objects. So strange. I noticed they stowed it in the crook of a branch and, so I climbed up for a better look and—well, that’s when I fell,” she says.</p><p>You hold the strange chime in your hands, appreciating its heft and form. The inlaid designs are like nothing you or the zoologist have ever seen. The metal is cool to the touch yet strangely electric. On a whim, you hold the bell up and swing it once, even though it doesn’t have a clapper. A palpable wave of sonic energy ripples through the air around you. From the trees, you can hear a familiar mournful cry.</p><p>“This has become more than a simple survey,” Dr Irawan whispers. “Whatever those creatures have become, they are no longer Phalanger septimus. Something changed.” The zoologist pauses and considers her words for a moment, then smiles at you. “Whatever is happening, I—I would prefer to not work alone. Perhaps I could continue my research with you?”</p><p>You tell Dr. Irawan you wouldn’t have it any other way, and agree to stay with her as she recovers. The zoologist entrusts the strange bell to you.</p><ul><li>In your Campaign Log, record *Dr. Irawan joined the cell*. Any one investigator may choose to add the Dr. Dewi Irawan story asset to their deck. It does not count toward their deck size.</li><li>Choose an investigator to be the bearer of The Ruinous Chime and update the Campaign Log accordingly.</li><li>Both of these cards can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon: <section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "metamorphosis3": "<p>_Metamorphosis 3_: Asking around town, each mention of Dr. Irawan is met with a curious stare. You go so far as to mime the zoologist’s distinct large eyeglasses, but nobody recognizes the name or the likeness. After several days, you abandon your fruitless search. As you check out from the local guest house, you find a blank sketchbook sitting on a wicker table. Picking it up, your skin pricks, and you have the feeling of being watched. But when you turn around, you are completely alone.</p><ul><li>In your Campaign Log, record *Dr. Irawan vanished from existence*.</li><li>Each investigator earns 2 experience, as they gain insight into the strange happenings around the world.</li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "对全球奇异的失踪事件有了洞见"
        },
        "title": "变形记",
        "metamorphosis1": "刚入夜，你的船便驶入了马诺夸里的港口。高耸的山峦覆盖着繁茂的绿植，层层叠叠，一直延伸到碧蓝的海水边。夜幕降临，水面下舞动着闪烁的光点：那是会发光的植物，还是别的什么东西？\n\n检查自从_δ_（德尔塔）以来已经流逝了多少时间。",
        "tenOrLessTime": "如果自从_δ_（德尔塔）以来流逝的时间不超过10，进入_变形记 2_。",
        "moreThanTenTime": "如果自从_δ_（德尔塔）以来流逝的时间超过10，跳至_变形记 3_。",
        "metamorphosis2": "起先你还担心会不会没人听过伊拉万博士的名字，但坚持不懈地查问一番之后，一位当地人才不情愿地提出带你去找她。你们深入茂密的灌木丛，沿着陡峭的小道登上附近的山，最终来到一个漆黑的空洞。你发现动物学家正倚在铁树的树干上，聚精会神地望着暗影。\n\n“我没想过你会跟来这里，”伊拉万博士低语道。你学着她的样子，坐到她旁边，也一起望向黑暗之中。周围的空气浓稠而潮湿。“我的理论……并不正确。或者说，至少有部分是不对的。”从你所在的高处，可以望见一道倾泻的瀑布在下方切出一片浅浅的溪谷。月光在狭窄溪流的波纹上闪烁。伊拉万博士继续道：“有关这种斑袋貂的所有迹象都消失了，这确定无疑。当地人也不记得它们。但这次失踪还是有点不一样。有什么东西留了下来。”\n\n树林中传来一声低沉的哀号，吓了你一跳。伊拉万博士掏出一对望远镜，指向林地远端的铁树丛。你也眺望过去，发现三只猫般大小的有袋类动物瞪着黄眼睛，吊在树枝上，卷曲的尾巴在黑暗中摇晃，正在吃什么东西。光是看着它们就让你头晕目眩：它们似乎既在那里，又不在那里，迫使你的眼睛不断调整。它们的动作也僵硬而异常，关节仿佛能反向弯折，既太快又太慢。你移开了视线。\n\n“你看到它们了？”伊拉万博士问道。你点点头，又看过去：斑袋貂正在狼吞虎咽地吃着一条绿蟒。“太惊人了。这是根本性的变化。猎物变成了猎手。我观测到的这几只习性已经完全变了，会袭击别的斑袋貂，捕猎原先的天敌——这里的绿蟒就是一例。它们的天性似乎都改变了！”伊拉万博士激动得结巴起来，“但更重要的是，它们并没有消失。我的意思是，对某些人来说，它们已经消失了。没人记得它们。但它们依然存在。”\n\n你将望远镜转回斑袋貂，却发现它们一动不动，只用明亮的黄玉色眼睛直直盯着你。你大吃一惊，松手掉了望远镜。等你再看时，斑袋貂已经不见了。你突然紧张起来，告诉伊拉万博士最好还是离开，但她却摇了摇头。“我就快接近本世纪最伟大的发现了。那是一整个超动物学研究领域。我现在不能走。”\n\n你任由伊拉万博士自行其是，掉头回到镇上。四周的丛林寂静得诡异，哪怕你走进月光照亮的一片空地，也始终摆脱不了被窥视的感觉。\n\n接下来的几天里，你与这位动物学家偶尔碰面。到了你的船预定离开马诺夸里的那天，伊拉万博士却可疑地没有出现在宾馆里。工作人员告诉你，她前一晚没有回来。你担心她的安危，回到之前与她碰面的空洞。你一路上山，四周的丛林依旧寂静得令人不安。\n\n黑黢黢的空洞上方悬着一块岩石，上面散落着几本撕碎的速写本和一架摔坏的望远镜，却没有伊拉万博士的踪迹。你扫视昏暗的树丛，发现瀑布底下有一道微光，还有动物学家的印花背心。你小心翼翼地沿着泥泞的陡坡下到狭窄溪流的岸边，发现动物学家趴在那里，手臂弯成一个奇怪的角度。你靠近时，三只黄眼斑袋貂四散而逃。你轻轻将她翻过身，发现她还有呼吸，不禁松了口气。她的左手紧紧攥着一件奇怪的黑色器具，护在胸前。\n\n上方传来一声尖利的哀鸣。你将伊拉万博士抱起来，发现她出奇地轻。你抱着这位动物学家沿溪流向下游走去，远离那个空洞，头顶的铁树丛中，几十双黄眼睛死死盯着你。闪烁不定的身影在头顶来回飞掠，仿佛无声的警告。\n\n一回到镇上，你就把昏迷的动物学家送进了诊所。你预订的船已经离开，但鉴于发现她时的诡异情形，你决定留下来陪伊拉万博士，直到她醒来。几天过去，寂静令人不安，她终于开口说话了。\n\n“我注意到有几只斑袋貂聚集在这东西周围，”她用还能活动的那只手抚过那只中空的钟，“我知道最好别去干涉，但它们似乎对它太过着迷了。就像喜鹊或乌鸦会囤积某些物件一样，太奇怪了。我注意到它们把它藏在一根树枝的弯处，于是爬上去想仔细看看——然后，我就摔了下来，”她说。\n\n你将那只奇怪的钟捧在手里，感受着它的重量与外形。上面镶嵌的纹样，无论你还是这位动物学家都从未见过。金属摸上去冰凉，却带着一种奇异的电流感。你一时兴起，举起钟摇了一下，尽管它并没有钟舌。一阵清晰可感的声波涟漪穿过周围的空气。你听到树间传来一声熟悉的哀鸣。\n\n“这已经不再是一次简单的勘测了，”伊拉万博士低声说，“无论那些生物变成了什么，它们都不再是七斑袋貂了。有什么东西改变了。”这位动物学家停顿片刻，斟酌着用词，然后对你笑了笑。“无论正在发生什么，我——我都不想独自工作。也许我可以和你一起继续我的研究？”\n\n你告诉伊拉万博士，你正求之不得，并同意在她康复期间陪伴她。这位动物学家将那只奇怪的钟托付给了你。\n\n• 在剧本日志中，记录*伊拉万博士加入特别小组*。任意一位调查员可以选择将戴维·伊拉万博士剧情支援加入其牌库。这张卡牌不计入其牌库卡牌张数。\n• 选择一位调查员作为灾毁之钟的持有者，并相应更新剧本日志。\n• 这两张卡牌可以在*环球漫游*遭遇组中找到。\n• 在剧本日志中记1点_时间_。你可以_启程_。",
        "metamorphosis3": "你在镇上问了个遍，但每次提到伊拉万博士，对方都只是好奇地打量你。你甚至模仿起动物学家那副独特的大眼镜，但没人认得那个名字，也没人见过那副模样。几天之后，你终于放弃了自己徒劳的搜寻。你在当地宾馆办理退房时，发现柳条桌上放着一本空白速写本。你捡起它，皮肤一阵刺痛，感觉有人正盯着你。但你转过身去，却完全孤身一人。\n\n• 在剧本日志中，记录*伊拉万博士凭空消失*。\n• 每位调查员取得2点经验值，因为他们对全球奇异的失踪事件有了洞见。\n• 在剧本日志中记1点_时间_。你可以_启程_。"
      },
      "chineseGaps": []
    },
    "rusesAndReclamation": {
      "en": {
        "xp": {
          "bonus": "Searching Leads"
        },
        "title": "Ruses and Reclamation",
        "rusesAndReclamation1": "<p>_Ruses and Reclamation 1_: You search every known Coterie sanctum and safehouse in this region, looking high and low for the villain who stole your precious cargo, but find nothing. Either they’re not here, or they’re so well hidden that searching any more thoroughly would be a waste of time. Resigned, you plan your next move.</p><ul><li>In your Campaign Log, record *wrong leads*, and next to this, record 1 tally mark. (If *wrong leads* is already recorded in your Campaign Log, add 1 tally mark to it.)</li><li>You may _embark_.</li></ul>",
        "rusesAndReclamation2": "<p>_Ruses and Reclamation 2_: You finally narrow down your quarry and find their safehouse. Before rushing in, you lay low and wait for the right time to strike. With the element of surprise on your side, you tailor your approach to your foe…</p><p class='basic'>Mark 1 _time_ in your Campaign Log. Read only the following section that pertains to your situation. Then, you may _embark_.</p>",
        "theRedGlovedMan": "<div class='red bordered'><p>_If The Red-Gloved Man stole the Key(s)_: With a foe as enigmatic and potentially dangerous as The Red-Gloved Man, perhaps it is best to avoid confrontation altogether. You wait until you spot him leaving the sanctum and then start picking the lock of the same entrance…only, to your surprise, he has left it unlocked. You can almost imagine his blank stare from the shadows, mocking your every move. Does he know you’re here? Why steal from you only to hand the stolen objects back to you on a silver platter? In the end, you decide it is best to not look a gift horse in the mouth—after all, you’re not about to waste this opportunity. You grab the stolen relic and make your escape, wondering all the while the true motivations of the mysterious man.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theClaretKnight": "<div class='red bordered'><p>_If The Claret Knight stole the Key(s)_: Knowing the knight from Alexandria, you doubt he would dirty his hands personally—he must have sent enforcers to do his job for him. It’s likely he has set guards inside the safehouse, as well. Sneaking is probably out of the question, so you decide on a quick, direct approach: take the guards by surprise, grab what’s yours, and get out before they can respond with force. The job is clean and over in a matter of seconds. With the knight’s enforcers surely on your tail, you flee the city as fast as you can with your prize in tow.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theBeastInACowlOfCrimson": "<div class='red bordered'><p>_If The Beast in a Cowl of Crimson stole the Key(s)_: The Beast is no doubt the most violent and unpredictable foe you have encountered thus far. You count yourself lucky to have been out of your hotel room when it was sacked, or you would surely be dead. But from your mission in Alexandria, you know the creature has a weakness—it must hibernate from time to time. Quiet as a mouse, you slip into its sanctum unnoticed, the Beast’s rumbling breath emanating from a chamber deeper beneath your feet. Your heart races as you creep throughout the building, knowing any false step could spell your doom. The moment you grab the stolen artifact, the Beast begins to stir, and you rush to the exit. Even after putting miles between you and the creature’s lair, you can still hear its howls of anger and hate.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "laChicaRoja": "<div class='red bordered'><p>_If La Chica Roja stole the Key(s)_: You and La Chica Roja have been playing this cat-and-mouse game for weeks. You’ve tracked her down enough times by now to know her modus operandi perhaps better than any other living person. It’s even starting to become a little fun, this tête-à-tête. You sneak into her sanctum and locate the relic in a hiding place not unlike where a remnant of the Weeping Lady was found during your last encounter. With a bit of a chuckle, you replace it with a little calling card of your own and escape without notice. As you leave the city later that night, a bystander slips a red envelope onto your person, bearing a message: “Nice one. Let’s play again some time.”</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theSanguineWatcher": "<div class='red bordered'><p>_If The Sanguine Watcher stole the Key(s)_: Faceless servants with scarlet collars and wings of darkness circle the watcher’s sanctum overhead. You move carefully under the cover of night, hoping to avoid detection. The man’s sanctum is more akin to a workshop, filled with torturous implements and strange, arcane tools. Among the many instruments is that which he stole from you, placed in the center of one of his workbenches as though he was studying it. The moment you grab it and move to escape, you hear his startled voice from another doorway. “Who is there?” Two empty eyesockets glare in your direction as you turn to face him. “Who is that?” He scrambles to find his ruby spectacles, but you are long gone before he is able to put them on.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "amaranth": "<div class='red bordered'><p>_If Amaranth stole the Key(s)_: You sneak into Amaranth’s sanctum and find what she stole piled in the corner of a cavernous foyer. A weak roar breaks the silence, and you see a tattered lion glowering at you from the dark. Your shock turns to disgust as you watch the poor creature struggle to stand: it is too decayed to even move. “You got what you came for. Now leave,” says a voice from the shadows. Squinting your eyes, you see Amaranth bent over the lion, her cheeks wet with tears. “Khalid, please,” she whispers. The lion lets out a weak growl, then flops onto its side to expose its rotten belly. “I told you to leave!” Amaranth screams. Your disgust turns to pity as you make your exit.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "alikiZoniUperetria": "<div class='red bordered'><p>_If Aliki Zoni Uperetria stole the Key(s)_: To your surprise, the sanctum is completely empty. Not just empty, but abandoned entirely, perhaps for many years before you ever arrived. You wander through darkened halls and dusty, cobwebbed chambers, until finally you reach an old, decrepit bedroom. A full-length mirror adorns one wall, covered in dust and grime. Spotting a strange reflection in the glass, you wipe away the filth, revealing the haunting figure of Aliki behind you, her long, dark hair covering her eyes as she reaches for your neck. When you turn again, she is gone, but the feeling of something clenching around your neck remains. Spying your stolen Key on a nearby vanity, you snatch it and run, bursting through the door of the sanctum with a resounding thud. You don’t stop running until you have left the city behind.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "thorne": "<div class='red bordered'><p>_If Thorne stole the Key(s)_:  If there’s one thing you know about Thorne, it’s that they won’t pass on an opportunity to make a deal. Rather than sneak in, you knock on the front door of their sanctum and are admitted by several smooth, attractive attendants. Thorne sits at the head of a long table, hands steepled. “What a delight! I had no idea you were coming,” they smile brightly, then gesture for you to sit. Drinks and a lavish meal are served, and eventually you steer the conversation toward returning what they stole. “Ah yes. ‘Keys.’ It’s always about ‘Keys,’ isn’t it?” They pour another glass of wine. “Things have changed. I suppose I could be amenable to such an exchange. But only if you make it worth my while.” It takes nearly an hour to come up with compensation enough for Thorne to change their mind, but eventually you leave their sanctum with your stolen relic…and a bit poorer, besides.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "desiderioDelgadoAlvarez": "<div class='red bordered'><p>_If Desiderio Delgado Álvarez stole the Key(s)_: You sneak into Desi’s safehouse and are stunned to find that it is no vault or Coterie hideout, but a fully stocked bar with patrons in boisterous revelry. A bouncer in a pinstripe suit stops you as you enter, but before you can protest or fight back, you hear Desi’s voice call out: “Hey. It’s fine. Let ‘em in.” The bouncer relents, and you sit at a booth across from your adversary. “Guessing I know what this is about. Tell you what: I’m in a good mood. Have a drink or two and I’ll play you for it,” he says, shuffling a deck of cards. Seeing your expression, he grins. “Oh, lighten up. I’m not like those others. One hand. Then we call it even and go our separate ways.” Considering the circumstances, you decide it best to play along—literally. As luck would have it, three jacks is more than enough to beat Desi’s pair. You end up leaving shortly after with your Key reclaimed and no worse for the wear, wondering how much of a sore loser Desi and his crew might be.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "tzuSanNiang": "<div class='red bordered'><p>_If Tzu San Niang stole the Key(s)_: Given how dangerous Tzu San Niang was while in possession of a Key, you decide a direct confrontation is out of the question. Stealth is by far the better option. You sneak into a large industrial complex after dark and locate what she stole behind a locked door. As you pick the locks, you hear a lilting voice echo off of the narrow corridors. A haunting song in Shanghainese fills the empty factory. Working quickly, you reclaim the stolen artifact and retrace your steps to the exit, looking over your shoulder at every turn. The song lingers in your memory long after you make your escape.</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "continue": "<p class='basic right'>Update the Keys section of your Campaign Log such that the Key(s) that were stolen return to their original bearers.</p><p class='basic right'>Each investigator earns 1 experience, plus 1 additional experience for each tally mark recorded next to *wrong leads*.</p><p class='basic right'>Cross off “14–C” on each of the remaining locations in the Campaign Log.</p>"
      },
      "zh": {
        "xp": {
          "bonus": "错误迹象旁的记录"
        },
        "title": "拨乱反正",
        "rusesAndReclamation1": "<p>你找遍了此地同志会的圣堂和藏身处，掘地三尺也要找到偷走你宝物的窃贼，最终却还是一无所获。要么是他们根本不在这儿，要么就是藏得太好，再彻查下去也不过是浪费时间。你从这里撤出，计划前往下一站。</p><ul><li>在剧本日志中，记录*错误迹象*，并在旁边作1次记录。(如果剧本日志中已经记录了*错误迹象*，则加1次记录。)</li><li>你可以_启程_。</li></ul>",
        "rusesAndReclamation2": "<p>你对猎物步步进逼，终于来到了对方的藏身处。你在冲进去之前先行潜伏，等候时机。你出其不意，准备朝敌人下手……</p><p class='basic'>在剧本日志中记1_时间_。仅阅读下列与你处境对应的部分。然后，你可以_启程_。</p>",
        "theRedGlovedMan": "<div class='red bordered'><p>_如果戴红手套的男子窃走了钥匙：_如果是戴红手套的男子这般神秘莫测、危险难料的敌人，那最好还是不要正面交锋。你等到他离开圣堂，才撬门溜锁……只是你惊讶地发现，他压根儿没有锁门。你几乎可以想象他从阴影中投来空洞的眼神，嘲讽你的一举一动。他是不是知道你在这儿？他为什么要从你这里偷走东西，又双手奉上？你最后决定还是不要想的太多——毕竟你不能浪费这样的机会。你抓起遭窃的遗物，溜之大吉，一边也想知道这个神秘男人的真正动机。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theClaretKnight": "<div class='red bordered'><p>_如果暗红骑士窃走了钥匙：_你了解亚历山大的骑士，怀疑他并不会弄脏自己的手——他肯定是派了打手来做脏活。那他在藏匿之地大概也安排了守卫。偷偷溜进去是不可能的，所以你决定直捣黄龙：突袭放倒守卫，拿走你的东西，趁他们反应过来之前就溜走。活儿干得利落漂亮，一共只花了几秒钟。骑士的手下紧追不舍，你带着战利品极速逃出了城。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theBeastInACowlOfCrimson": "<div class='red bordered'><p>_如果深红斗篷的恶兽窃走了钥匙：_恶兽肯定是最为凶暴，你最不想碰到的敌人。它洗劫宾馆房间的时候，你幸好不在，不然你一定早已殒命。但你在亚历山大执行任务的时候，知道这怪物也有弱点——它不时就要休眠。你潜入圣堂，静如老鼠，无人发现。脚下深处的房间里传来了恶兽隆隆的鼾声。你蹑手蹑脚地穿过建筑，心脏狂奔，知道走错任何一步都是自取灭亡。你抓住遭窃神器的那一刻，恶兽动了。你赶忙逃往出口。即便逃出数英里之远，你觉得自己还是能听到它愤怒与憎恨的吼声。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "laChicaRoja": "<div class='red bordered'><p>_如果红衣女郎窃走了钥匙：_你和红衣女郎在这种猫鼠游戏中已经玩了好几周。你追了她这么久，在世无人再比你更懂得她的作风。这场小小的私人竞赛甚至变得有趣了起来。你溜进她的圣堂，发现遗物所藏之处和你上一次遭遇时恸哭女士残骸安放的地方别无二致。你笑了笑，将其换成自己一张小小的名片，就此溜之大吉，无人注意。当晚你正打算离开此城，一个路人迅速地交给你一个红色的信封，上面写着：“干得漂亮。下次再玩。”</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "theSanguineWatcher": "<div class='red bordered'><p>_如果血色监视者窃走了钥匙：_监视者的圣堂上盘旋着黑翼红顶圈的无脸仆从。你在夜色的掩盖下小心翼翼地接近，希望自己别被发现。此人的圣堂更像是一个工坊，堆满了费解的设备和奇异的奥术工具。他从你那儿偷来的东西也在里面，放在工具台正中，仿佛他正在研究。你抓起就跑，这时另一边的门里传来了他惊恐的声音：“谁在那儿？”你扭头看去，只瞧见他两只空洞的眼窝望向你这边。“那是谁？”他仓促地寻找自己的红宝石眼镜，但等到他戴起来的时候你早就溜了。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "amaranth": "<div class='red bordered'><p>_如果苋窃走了钥匙：_你潜入苋的圣堂，发现她偷来的东西就堆在巨大门厅的角落。虚弱的叫声打破了沉默，你看到暗处有一头遍体鳞伤的狮子正瞪着你。你先是震惊，随即看到这可怜的野兽挣扎着想站起来——它腐败之甚，已经动不了了——不由得感到一阵恶心。“你已经得到了想要的东西。现在走吧。”阴影中冒出了一个声音。你眯眼看去，发现苋伏在狮子身上，满脸泪水。“哈立德，求你。”她低语道。狮子虚弱地叫了一声，重重摔到一侧，露出了自己已经腐烂的肚子。“我说了快走！”苋叫道。你离开了，恶心的感觉转为悲悯。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "alikiZoniUperetria": "<div class='red bordered'><p>_如果艾里奇·佐尼·奥佩勒曲亚窃走了钥匙：_你惊讶地发现圣堂里面空空如也。不仅如此，更像是在你抵达之前就已经全部废弃，兴许已经许多年了。你走过暗沉的廊道、蛛网遍布的积尘厅室，最终来到一间老旧废弃的卧室。墙上有一面全身镜，满是灰尘和污垢。你发现玻璃上有奇怪的反光，擦去污渍，发现艾里奇的鬼影就在身后，黑发覆眼，朝你的脖子伸出手来。你回过头，却发现她已经不见了，只是脖子上还有攫紧的感觉。你在附近的梳妆台里发现了遭窃的钥匙，拿起就跑，冲出圣堂，一路上脚步声回响。你一路不停，径直逃出了城。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "thorne": "<div class='red bordered'><p>_如果索恩窃走了钥匙：_要说你对索恩有多了解，那就是她不会错过交易的机会。所以你没有溜进圣堂，而是大大方方地敲了门。几个冷艳迷人的侍者出来迎接。索恩坐在长桌一头，十指相抵。“太妙了！我没想到你会来。”索恩笑得很开心，招呼你坐下。尝过珍馐和美酒之后，你终于将话题转向归还赃物。“噢，是啊，‘钥匙’。总是‘钥匙’，嗯？”索恩又倒了杯酒，“情况不同啦。我想交易也行。但你可得出够价。”你花了将近一个小时，才提出让索恩满意的价码。无论如何，你还是带着失窃的钥匙离开了圣堂——只是付出了一点儿代价。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "desiderioDelgadoAlvarez": "<div class='red bordered'><p>_如果德西德柔·戴佳多·欧瓦瑞兹窃走了钥匙：_你溜进德西的藏身之处，却惊讶地发现这里并非什么藏宝库，也不是同志会的窝点，而是一家酒吧。这里酒品琳琅满目，客人狂歌痛饮。你正要进去，却给一个穿条纹西装的保镖拦住了。你刚想开口——或者打回去，就听到了德西的声音：“嗨，没事，让他进来吧。”保镖退到一边，你和对手坐在桌子两侧。“猜猜我是怎么想的。告诉你吧：我心情不错。喝一两杯，我就跟你赌这个。”他说着居然开始洗牌。他看到你的表情，笑了：“哦，放松点儿。我跟其他人不一样。一把定输赢，然后咱们就此别过。”权衡局势，你决定跟他玩玩——真的玩玩。你运势正旺，三条J大过了德西的对子。你不费吹灰之力，赢得钥匙，扬长而去，不禁想到德西和他的手下得有多么气急败坏。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "tzuSanNiang": "<div class='red bordered'><p>_如果朱三娘窃走了钥匙：_你知道朱三娘钥匙在手得有多危险。正面强攻想都不要想。潜行才是良策。你趁着夜色溜进庞大的工业建筑，找到了锁着赃物的门。就在你撬锁的时候，狭窄的走道里响起一阵轻快的声音。空荡荡的工厂里回荡起幽怨的沪语歌声。你赶忙夺过失窃的神器，旋踵走向出口，一步一回头。歌声在你逃出之后还回荡在记忆中许久。</p>@:theScarletKeys.rusesAndReclamation.continue </div>",
        "continue": "<p class='basic right'>更新剧本日志的钥匙部分，使遭窃的钥匙返回原本的拥有者手中。</p><p class='basic right'>每位调查员取得1点经验值，且*错误迹象*旁每有一次记录，额外取得1点经验值。</p><p class='basic right'>划掉剧本日志上其他每个地点的“14-C”。</p>"
      },
      "chineseGaps": []
    },
    "theGreatWork": {
      "en": {
        "xp": {
          "bonus": "Gained insight into the inner workings of the Red Coterie."
        },
        "title": "The Great Work",
        "theGreatWork1": "<p>_The Great Work 1_: The brilliant sandy beaches and azure water dazzle your senses as you arrive in Bermuda proper. Rows of brightly painted homes add to the eye-popping landscape as you travel from one corner of Bermuda island to the other, asking locals for any possible leads on Coterie activity.</p><p class='basic'>Check the Campaign Log.</p>",
        "activity": "*If Tuwile Masai fled to Bermuda*, proceed to _The Great Work 2_. ",
        "noActivity": "Otherwise, skip to _The Great Work 5_.",
        "theGreatWork2": "<p>_The Great Work 2_: After mentioning Tuwile Masai by name, you are directed to a residence just past the Gibbs Hill Lighthouse on the southern end of the island. The directions lead you to a lavish bungalow with a well- kept garden overlooking the ocean. Keeping your guard up, you walk to the screen door of the house and knock. A familiar figure wearing loose slacks and a maroon linen shirt opens the door.</p><p class='basic'>Check the Campaign Log.</p>",
        "proceed": "If at least two of the following are recorded (*Ece does not trust the cell*, *you haven’t seen the last of La Chica Roja*, *you haven’t seen the last of Desi*, *you haven’t seen the last of the Claret Knight*, *you haven’t seen the last of Thorne*, or *you haven’t seen the last of Aliki Zoni Uperetria*), proceed to _The Great Work 3_.",
        "otherwise": "Otherwise, skip to _The Great Work 4_.",
        "theGreatWork3": "<p>_The Great Work 3_: “If you have come to dispose of me, please make it quick,” Masai says coldly. He stands on the other side of the screen door, sweat beading on his dark skin, as he locks eyes with you. You try to explain yourself as best you can, but you can see from Masai’s body language and tone that he is set against you. After a chilly exchange, he steps onto the porch.</p><p>“Say what you will, but it is clear to me that you are interested in only one thing: power. If Commissioner Taylor had half her wits about her, she should treat you with the same fear as she treats me and my colleagues. None of you understand. None of you understand the great work we must do, as brethren, in order to live freely. One can only control the power of a Key so long before they themselves are controlled.”</p><p>Masai scoffs and takes off his large red spectacles. “You are no better than the worst of us.” He follows your gaze and holds up the spectacles. “These are of no significance. I learned too late of the dangers of holding such power myself. Now leave me in peace.”</p><ul><li>Each investigator earns 3 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>You may _embark_.</li></ul>",
        "theGreatWork4": "<p>_The Great Work 4_:  “You are either very persistent or very foolish,” Masai smiles. He steps out onto the porch and looks you up and down, as if sizing you up, then nods for you to follow as he walks out to the white-sanded beach. The waves lap hungrily at the shoreline as you walk alongside him.</p><p>“I apologize for my rudeness earlier. I couldn’t be certain of your intentions. And there have been a few…incidents lately,” Masai says gravely. A thick log of smooth driftwood lies buried in the sand in front of you, covered in a swarm of bright red-and-blue crabs. You ask about the incidents.</p><p>“A number of unannounced visits. The Foundation, obviously. Several days before your arrival at Lake Victoria, another member of my organization appeared at our camp, very interested in the key we had recovered. The one with the red gloves.” The professor stops, looking out at the rolling tide. “It bears explanation, I suppose. My survey of Lake Victoria turned up a number of alarming reports. The lakebed is covered in the ruins of a prehistoric city. We registered an alarming amount of carbon dioxide and strange changes in the local flora and fauna around the lake. At its source, we found a machine of alien design. Its purpose and facility are still a mystery, but whatever it was: it was running. Still is.”</p><p>Masai wipes his red spectacles with a handkerchief. “All that to say: several days before you arrived, I found that man sitting in front of the machine, hat off, staring at it. He was humming—well, that’s not quite right—he was communing with it.”</p><p>A shaft of cloud splits the sunlight overhead, casting the beach in dappled shadows. Masai’s voice breaks the silence. “In truth, I did not care to understand why. Why that man does anything has always been a mystery to me. But there was something other about his demeanor. Something altogether wrong.” Masai breathes deeply as the cloud passes, and warm sunlight overtakes the beach. “So imagine my suspicion when even more as yet unknown Foundation operatives showed up at my survey to interrupt my great work.”</p><p>You ask Masai about this “great work.” He leads you to turn around and begin walking back to his bungalow.</p><p>“It is the work of every person. What is it to be human except to live and help others in this great and perilous world? It’s harder than you might think.” He breathes deep. “If I can leave the world a bit better than I entered it, my work will be done. That is all. It is why the acquisition and squabbling over these Keys is such misdirection. One can only control a Key’s power so long before they become controlled.”</p><p>“But I sense a similar purpose in you,” Masai says. “I will not tell my colleagues we had this conversation, or what I have done with that infernal machine. The Key is yours, until you decide that it should not be. Keep it away from the man with the red gloves at any cost.”</p><ul><li>In your Campaign Log, record _Tuwile Masai is on your side_.</li><li>Each investigator earns 1 experience, as they gain insight into the inner workings of the Red Coterie.</li><li>Choose an investigator to be the bearer of The Bale Engine and update the Campaign Log accordingly. This card can be found in the *Globetrotting* encounter set, indicated by the following encounter set icon:<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>Mark 1 _time_ in your Campaign Log. You may _embark_.</li></ul>",
        "theGreatWork5": "<p>_The Great Work 5_: You are almost relieved that your questioning goes nowhere; the lack of Coterie activity in Bermuda gives you an unlikely chance to rest and recuperate. For just a moment, you need only to concern yourself with the peaceful stillness of the island.</p><p>With several days remaining until your next departure, you follow the recommendation of the concierge at your hotel and take the time to explore the Crystal Caves up near the northern end of the island. Your guide is missing an arm; they illuminate dancing patterns in the darkness with their flashlight as they tell you the story of how the caves were found. You ask them how they lost their arm. “I served in the Great War,” they tell you. “Sometimes peace comes at great cost.”</p><ul><li>Each investigator may begin the next scenario with 1 additional card in their opening hand.</li><li>You may return to Bermuda again during this campaign, but only after playing another scenario.</li><li>You may _embark_.</li></ul>"
      },
      "zh": {
        "xp": {
          "bonus": "洞见了红色同志会的内部运作"
        },
        "title": "宏伟大业",
        "theGreatWork1": "<p>你到了百慕大，明亮的沙滩和碧蓝的海水叫人目眩神迷。一排排建筑颜色靓丽，更让此地的美景惊艳万分。你在岛上穿行，问问当地人有没有同志会活动的可能迹象。</p><p class='basic'>检查剧本日志。</p>",
        "activity": "特瓦耶·马萨伊在百慕大",
        "noActivity": "并非上述情况",
        "theGreatWork2": "<p>你一提到特瓦耶·马萨伊的名字，当地居民就带你去岛南端的吉布斯山灯塔。这条路带你通往一座华美的小屋，外面还有一座精心打理的花园俯瞰大洋。你提高警惕，走到纱门前敲了敲。一个穿着宽松长裤和栗色亚麻衬衫的熟悉身影打开了门。</p><p class='basic'>检查剧本日志。</p>",
        "proceed": "记录了以下至少两项*(艾婕不信任特别小组；你和红衣女郎之间恩怨未了；你和德西之间恩怨未了；你和暗红骑士之间恩怨未了；你和索恩之间恩怨未了；或你和艾里奇之间恩怨未了)*",
        "otherwise": "并非上述情况",
        "theGreatWork3": "<p>“如果你是来杀我的，那就请你痛快点。”马萨伊冷冷地说道。他站在纱门里面瞪着你，黑皮上滴下汗来。你尽全力解释，但你从马萨伊的肢体语言和语调能看出，他视你为大敌。好一番夹枪带棒的交涉，他才走出门廊。</p><p>“随你怎么说，但显然你只对一样东西感兴趣：力量。要是泰勒专员能用一半心思，她怕你的程度就不该亚于她怕我们。你们都不懂。你们都不懂我们必须完成的大业。这是我们作为同胞，为了自由活着必须做的事。控制钥匙太久，就会被钥匙控制。”</p><p>马萨伊嘲弄地摘下了自己的红色大框眼镜。“你和我们之中最坏的人，也没什么两样。”他跟着你的眼神，拿起眼镜：“这些都不重要了。我知道持有这些力量有多危险的时候，已经太迟了。现在就让我一个人静静吧。”</p><ul><li>每位调查员取得3点经验值，因为其洞见了红色同志会的内部运作。</li><li>你可以_启程_。</li></ul>",
        "theGreatWork4": "<p>“你要么就是非常执着，要么就是非常愚蠢。”马萨伊笑了。他走出门廊，上下打量着你，好似在评估你有几斤几两。他点点头，示意你跟上，走到白沙滩上。你跟着他，一路上浪花热烈地拍打着海岸。</p><p>“我为先前的失礼道歉。我那时无法确定你的意图。最近又发生了许多……事故。”马萨伊严肃地说。你面前的沙子里埋着一大块光滑的浮木，上面爬过一群亮红壳蓝的螃蟹。你问他究竟是什么事。</p><p>“许多不速之客。当然，基金会的。就在你来维多利亚湖的前几天，我的组织另一位成员也来了营地，对我们最近发现的钥匙很感兴趣。就是那个戴红手套的。”教授停了停看着翻滚的海浪。“我想这也能解释。我勘测维多利亚湖的结果非常吓人。湖床上满是史前城市的遗迹。我们测出的二氧化碳含量非常离谱，湖边的当地动植物也发生了奇怪的变化。我们最终找到了一台异星设计的机械。它的设计目的和机理都是个谜，但它在运作，至今仍在。”</p><p>马萨伊用手帕擦了擦红眼镜：“这么说吧，就在你来的几天前，我看到那个男人坐在机器前面，摘了帽子盯着它，他在哼哼——好吧，这么说不对——他在和机器_交流_。”</p><p>头顶上一束云分开了阳光，照得沙滩上影子斑驳，马萨伊打破了沉默：“说实话，我倒无所谓为什么。这人的举止向来是谜。但除了他的举止，还有什么地方不对，整件事都有问题。”云朵飘去，温暖的阳光照满了沙滩，马萨伊深深吸了口气。“这样你就能想象得出，勘测的时候又来几个陌生的基金会特工，打断我的大业，我当然会怀疑。”</p><p>你问马萨伊这个“大业”究竟是什么。他领你往小屋的方向回去。</p><p>“这大业是为了所有人。在这个危险又宏伟的世界，人们要是不活下去，不互帮互助，会变成什么样子？这比你想的更难。”他呼吸很深，“要是我离开这世界的时候，它能比我来的时候好一点儿，那我就算没白活。就这样。也就是说，为了这些钥匙的巧取豪夺，都是大错特错。控制钥匙太久，就会被钥匙控制。”</p><p>“我发现咱们意图相仿，”马萨伊说道，“我不会将咱们的对话告诉我的同事，也不会说我对低于装置都做了什么。钥匙是你的了，除非你不想要。别让它落入红手套男子的魔爪，不惜任何代价。”</p><ul><li>在剧本日志中，记录下*特瓦耶·马萨伊站在你这一边*。</li><li>每位调查员取得1点经验值，因为其洞见了红色同志会的内部运作。</li><li>选择一位调查员拥有灾祸引擎，相应更新在剧本日志中。这张卡牌可以在*环球漫游*遭遇组中找到，图标为：<section class='encounter-sets'><img src='{setImgPath}/globetrotting.png'></section></li><li>在剧本日志中记1_时间_。你可以_启程_。</li></ul>",
        "theGreatWork5": "<p>你的问询一无所获，这倒让你松了口气。百慕大没有同志会活动的迹象，你终于有了一次难得机会可以放松休息。在这片宁静祥和的岛屿上，你现在更关心的只有你自己。</p><p>你出发离开前几日，酒店的门房建议你去岛北端的水晶洞看看。你欣然前往。你的导游缺了一只胳膊，一边告诉你洞窟是怎么发现的故事，一边在黑暗中打着手电，照出的影子好像舞蹈。你问向导胳膊是怎么没的。“我打过大战。和平有时候代价不菲。”</p><ul><li>每位调查员下一场冒险开始时可以有额外1张起始手牌。</li><li>你可以在本剧本期间返回百慕大，但要先进行另一场冒险。</li><li>你可以_启程_。</li></ul>"
      },
      "chineseGaps": []
    },
    "epilogue": {
      "en": {
        "title": "Epilogue",
        "epilogue1": "<p class='basic'>_Read the following only if the investigators won the campaign._</p><p>_Epilogue 1_: “Talk,” Commissioner Taylor commands.</p><p>You shift in your uncomfortable metal chair, the glaring light of her interrogation lamp nearly blinding you. One wall of the sterile interrogation chamber is covered by a black mirror that reflects you and the Commissioner sitting across a desk from one another, your faces blanched under heavy white light. Knowing the Foundation, several operatives are watching and recording your every move from behind the mirror. A thick dossier lies unopened on the desk between you and Taylor.</p><p class='basic'>Check the Campaign Log.</p><ul><li>*If the cell joined the Coterie*, proceed to _Epilogue 2_.</li><li>Otherwise, skip to _Epilogue 3_.</li></ul>",
        "epilogue2": "<p>_Epilogue 2_: Rather than answer directly, you ask instead what Taylor expected when she conscripted a random set of people into a Foundation cell. She looks genuinely caught off-guard as you explain your work and your role in assisting the Red Coterie to suppress what was clearly the greatest threat to humanity. The commissioner’s eye arches as you lean back in your seat in a gesture of casual indifference.</p><p>“I…see,” she visibly suppresses a grimace. You see her gaze linger on your crimson regalia. “You were hired for your curiosity, ingenuity, and independence. A statement which—may I remind you—is not to be taken as any form of compliment or commendation. It was an assumed risk that you might fall in with the Red Coterie, but one which I assured senior command was highly unlikely, if not impossible.”</p><p>A heavy silence falls as the commissioner makes a near-imperceptible nod at the black mirror to her left, then looks back to you.</p><p>“This, then, is no longer a briefing, but a negotiation. Understand that your role at the Foundation is terminated forthwith. All assets and privileges you previously enjoyed are rescinded, along with your prior rank and compensation.” You detect a hint of regret in her voice as she locks eyes with you. “Instead, let us view this as an opportunity. We have been at odds with the Coterie long enough; perhaps it is time that we worked together.”</p><p>Beyond the commissioner’s steely-eyed professionalism, you sense something else in her voice. Is it respect? She gives you an intense look.</p><p>“The Foundation and the Coterie, as partners. What do you say? Are you in?”</p><p class='basic right'>In your Campaign Log, record *the Red Coterie and The Foundation agreed to work together*.</p><p class='basic right'>File closed.</p>",
        "epilogue3": "<p>_Epilogue 3_: You find yourself awkwardly repeating events and names as you struggle to relay your experience to the commissioner. Throughout it all, Taylor remains silent, listening to your various rabbit trails and accounts of events with an air of reserve. When you have finished, she slides a glass of water across the desktop toward you. You see your shadowy reflection glimmer within the black mirror in the corner of your eye.</p><p>“What an…unrestrained account,” she says matter-of-factly. A heavy silence falls as the commissioner makes a near-imperceptible nod at the black mirror to her left, then looks back to you.</p><p>“The Foundation thanks you for your service. Understand that everything you have done during your tenure with the Foundation is classified, and you are bound under threat of execution to never share this account with another soul: living or dead.” She locks eyes with you. “Do you understand?”</p><p>You nod, and the commissioner goes on. “It goes without saying, but I must inform you that your temporary ‘cell’ has been disavowed and all assets acquired during your Foundation service will be retained for further study and research. Your account of all events involving paracausal disturbance will be extracted, analyzed, and preserved for future analysis.”</p><ul><li>In your Campaign Log, record *Foundation Trust* and *Cell Deception*.<ul><li>For each of the following that is recorded in your Campaign Log (*the cell is assisting Agent Sirry*, *the cell told the truth to Taylor*, *Agent Quinn has your back*, *the cell is delivering intel* is crossed off), mark 1 tally next to *Foundation Trust*.<ul><li>_Foundation Trust_: {trust}</li></ul></li><li>For each of the following that is recorded in your Campaign Log (*the cell hid the truth from Taylor*, *the cell is off-mission*, *the cell aided the knight*, *Ece trusts the cell*, *the cell made a deal with Thorne*, *Aliki is on your side*, *Desi is in your debt*, *Tuwile Masai is on your side*), mark 1 tally next to *Cell Deception*.<ul><li>_Cell Deception_: {deception}</li></ul></li></ul></li><li>If the number of tallies next to *Foundation Trust* is equal to or greater than the number of tallies next to *Cell Deception*, proceed to _Epilogue 4_. Otherwise, skip to _Epilogue 5_.</li></ul>",
        "epilogue4": "<p>_Epilogue 4_: Commissioner Taylor produces a black leather briefcase from behind the desk, opens it, and slides a Foundation badge across the table to you. “Bureaucratic flim-flam, of course. Your cell has been dissolved and you have received approval to join the Foundation with full clearance, full stop. Whether or not you wish to join is irrelevant; you have seen and accomplished too much to return to civilian life.”</p><p>The badge gleams in the harsh light as you turn it over in your hand. It has surprising heft. The sudden weight of everything that has happened hits you as your thumb plays over the grooves and ridges of the metal surface. Taylor flips open the dossier on the table and continues.</p><p>“Your date of hire is yesterday. Don’t worry: you will receive backpay as well as a sizeable compensation package for your work on the case. Which—on that—we are considering labeling ‘The Scarlet Keys.’ It has a nice ring to it, though it is a bit extravagant for my taste.”</p><p>The faintest hint of a smile tugs at the commissioner’s lips. “Well, what have you got to say? Cat got your tongue?”</p><p class='basic right'>In your Campaign Log, record *the cell was given a permanent position*.</p><p class='basic right'>File closed.</p>",
        "epilogue5": "<p>_Epilogue 5_: Commissioner Taylor opens the dossier in front of her and slides a set of tickets across the table to you.</p><p>“These are one-way tickets that will take you anywhere in the world, no questions asked. Given your troublesome curiosity, I recommend you go somewhere quiet and forgettable, assume an alias, and take up a profession that does not allow you so much free time or thinking. Oh, and stop wearing that,” she says, gesturing off-handedly at your appearance.</p><p>You interrupt and try to explain yourself. The commissioner holds up one hand to silence you.</p><p>“In truth, I must inform you that you are getting off rather easily here. If the higher-ups had their say, you would have been summarily executed for your reckless handling of this case. The word ‘collusion’ was tossed around. Had you toed the line, this case might have made your career. In my estimation, you have created far more trouble than you resolved.”</p><p>Taylor stands up, and you stand with her. Several burly suits step through the door behind you, flooding the room with light. The commissioner gives you a firm handshake, her eyes locked with yours. “The Foundation thanks you for your service. May we never meet again.”</p><p class='basic right'>In your Campaign Log, record *the cell was dismantled*.</p><p class='basic right'>File closed.</p>"
      },
      "zh": {
        "title": "尾声",
        "epilogue1": "<p class='basic'>_调查员剧本胜利方可阅读下列内容。_</p><p>“给我交代。”泰勒专员下令道。</p><p>你在不舒服的金属椅上扭了扭身子，她审讯灯的强光几乎要将你照瞎。审讯室的墙光秃秃的，整个就是一面巨大的黑镜，照出你和专员坐在桌子两头，强烈的灯光把你的脸都照白了。你知道基金会的作风，镜子后面肯定有几个特工正在监视，记录你的一举一动。你和泰勒中间的桌子上合着一本厚厚的密档。</p><p class='basic'>检查剧本日志。</p><ul><li>*特别小组加入了红色同志会*。</li><li>并非上述情况。</li></ul>",
        "epilogue2": "<p>你没有直接回答，而是问泰勒这么随便就组建了基金会的特别小组到底是为了什么。你将自己的工作娓娓道来，坦白自己帮助红色同志会一起对抗人类最大的威胁。看上去确实让泰勒措手不及。你说完了，漫不经心地倒在座位上。专员眯起了眼睛。</p><p>“我……明白了。”她显然在克制自己不要露出苦脸。你看到她的视线盯着你的红色标记。“你之所以受雇，是出于你的好奇心、创造力，和独立性。这样的声明——我是否该提醒你——并不等同于任何形式的认可或是赞许。你确实有可能落入红色同志会手中，但我跟上峰保证，这就算并非不可能，几率也极低。”</p><p>沉默沉闷。专员朝左边的黑镜点点头，再看向你。动作之微，几不可察。</p><p>“那么，接下来的就不是陈述，而是协商。你在基金会的职位立即结束。你先前享有的任何支援和特权全部撤回，等级和补贴也即刻告终。”她盯着你的时候，你竟察觉出她的声音里有一丝后悔。“不过，我们也可以将其视为是全新的机会。我们已经和同志会对立太久，也许现在是时候合作了。”</p><p>尽管专员的声音十分严肃、专业，你还是觉得里面有别的情感。是一种尊重？她热切地望着你。</p><p>“基金会和同志会将成为伙伴。你怎么说？一起促成这样的未来吧？”</p><p class='basic right'>在剧本日志中，记录下*红色同志会和基金会同意合作*。</p><p class='basic right'>档案完结。</p>",
        "epilogue3": "<p>你劳心劳力地跟专员汇报，却发现自己在拙劣地重复着事件和人名。尽管如此，泰勒还是一言不发，谨慎地听你东拉西扯、列举事件。你终于说完了，她隔着桌子递给你一杯水。你余光看到自己的倒影在黑镜中闪闪发亮。</p><p>“真是……无拘无束的记录。”她实事求是地说道。沉默沉闷。专员朝左边的黑镜点点头，再看回你。动作之微，几不可察。</p><p>“基金会感谢你的效劳。鉴于你在基金会任职期间所为的级别，你不得将任何内容透露给任何人——无论生死，违者将处以极刑。”她盯着你，“明白了吗？”</p><p>你点点头，专员继续道：“毋须多言，但我还是要告知你，你的临时‘特别小组’将始终保密，你在基金会供职期间获取的所有资产都将封存，留待进一步研究。你对所有事件的记录，包括反常干扰的那些，都将提炼、分析、保存，留待后观。”</p><ul><li>在剧本日志中，记录下*基金会信任*和*特别小组欺瞒*。<ul><li>剧本日志中每记录下列一项*(特别小组帮助西里特工、特别小组将真相告诉了泰勒、奎因特工护你左右，以及划掉的特别小组正在传递情报)*，在*基金会信任*旁作1次记录。<ul><li>_基金会信任_: {trust}</li></ul></li><li>剧本日志中每记录下列一项*(特别小组对泰勒隐瞒真相、特别小组另有使命、特别小组援助了骑士、艾婕信任特别小组、特别小组与索思达成交易、艾里奇站在你这一边、德西欠你一笔、特瓦耶·马萨伊站在你这一边)*，在*特别小组欺瞒*旁作1次记录。<ul><li>_特别小组欺瞒_: {deception}</li></ul>",
        "epilogue4": "<p>_*基金会信任*旁的记录次数大于等于*特别小组欺瞒*：_泰勒专员从桌子后面拿出一个黑色皮革公文包打开，里面掉出一个基金会的徽章，滑到了你面前。“当然了，这都是官腔。你的特别小组已经解散。基金会将完全接纳你。至于你愿不愿意，那不重要，你已经见得太多，完成了太多，回不到正常生活了。”</p><p>你将徽章翻过来，它闪着刺眼的光，居然还有些沉。你摸过徽章的凹槽和金属边缘，发生过的一切突然重压在你心上。泰勒翻开桌上的密档，继续道：</p><p>“你的履约从昨天开始。别担心，你这项工作剩下的工资会有的，还有一份数额可观的综合补偿。这个案子嘛——我们打算称为‘猩红钥匙’。这听起来是挺响亮，不过照我看是有点太夸张了。”</p><p>专员嘴边尽力露出了一点点笑容，“好了，你就没什么想说的吗？哑巴了？”</p><p class='basic right'>在剧本日志中，记录下*特别小组得到了终身职位*。</p><p class='basic right'>档案完结。</p>",
        "epilogue5": "<p>_*基金会信任*旁的记录次数小于*特别小组欺瞒*：_: 泰勒专员打开面前的密档，隔着桌子递给你一沓票据。</p><p>“这些单程票可以带你去世界上任何地方，不受任何盘问。鉴于你的好奇心总是惹麻烦，我建议你选一个被人遗忘的安静地方，用化名，找个重活干干，别让你有多少空闲时间瞎想。噢，衣服也得换了。”她不客气地指着你的装束。</p><p>你打算想要辩解。专员抬起一只手让你闭嘴。</p><p>“老实说，我必须告诉你，你在这儿脱罪要简单得多。要是闹到上峰那里，像你在案子里这么胡闹，只怕马上就会被干掉。他们已经在讨论你的‘勾结’了。要是你依章办事，还可能靠这个案子就此安身立命。但就我的估计，你制造的麻烦比你解决的更多。”</p><p>泰勒站了起来，你也一起。你身后的门里走进来几个穿西装的大块头，屋内顿时洒满了光。专员和你严肃的握了握手，盯着你：“基金会感谢你的效劳。愿我们不要再见了。”</p><p class='basic right'>在剧本日志中，记录下*特别小组就此解散*。</p><p class='basic right'>档案完结。</p>"
      },
      "chineseGaps": []
    }
  }
}

export const TSK_STORY_KEYS = TSK_STORY_TEXT.keys

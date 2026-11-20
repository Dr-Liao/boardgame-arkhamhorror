// theDoomOfArkhamPartI · 印刷正文（英文原文来自参考资源 locales/en/theDrownedCity/theDoomOfArkhamPartI.json；
// 中文正文由 narrative-guides worker 的 story-text.js 提供，本文件只作章节展示兜底）。
// 生成方式见 artifacts/migration/tdc/p7/workers/scenario-epsilon.md（一次性脚本，不写回参考资源）。
export const STORY = Object.freeze({
  "chapterId": "theDoomOfArkhamPartI",
  "referenceCode": "11682",
  "title": "The Doom of Arkham Part I",
  "textLanguage": "en",
  "textStatus": "printed-text (en verbatim; zh pending narrative-guides import)",
  "intro": {
    "intro1": {
      "paragraphs": [
        "You awaken from yet another nightmare to a furious knocking at your door. You open it to find a bedraggled-looking Andy and Ruby, along with a sharply dressed inspector who introduces himself as John Raymond Legrasse. The inspector explains that he has been investigating a spate of dreaming cults across the United States and abroad."
      ]
    },
    "intro2": {
      "paragraphs": [
        "You invite them inside as it begins to rain. Once seated, the inspector flashes a photo of a familiar statue. Several months ago, he sent the statue to a colleague in Miskatonic University for analysis. Apparently, Tillinghast’s request that you find his “missing shipment” was nothing more than petty theft. He tells you he arrived in Arkham about a month ago to interrogate Tillinghast and recover the statue."
      ]
    },
    "intro3": {
      "paragraphs": [
        "“Something didn’t sit right with me after we handed off the artifacts,” Andy says darkly. “So a few days later, I headed to the shop. When we got there the shop’d moved. Or so we thought. Ruby finally found it, and we went in to find the inspector arguing with Tillinghast and—things didn’t go so well.”"
      ]
    },
    "intro4": {
      "paragraphs": [
        "“That’s putting it mildly,” Legrasse says. “Randall was giving me the runaround when these two appeared. He threw us out, real quick. When we looked around, we weren’t…here.” You ask him what he means, and he shakes his head. “I mean we weren’t here. In Arkham. His shop door led somewhere else entirely. It took us a whole month to return.”"
      ]
    },
    "intro5": {
      "paragraphs": [
        "“I think we were somewhere in Tibet, or even farther north. It was…a journey to get back,” sighs Andy. A few months ago, you might’ve found their story hard to believe, but not now. Knowing what you do about Tillinghast, it’s no surprise that he has something far more sinister planned than simple acquisition. But what?"
      ]
    },
    "intro6": {
      "paragraphs": [
        "Together with Inspector Legrasse, Ruby, and Andy, you resolve to recover the artifacts and confront Tillinghast, wherever he might be. As you set out, the rain turns to a heavy downpour."
      ]
    },
    "proceedToSetup": {
      "paragraphs": [
        "Proceed to _Setup_."
      ]
    }
  },
  "setup": {
    "gatherSets": {
      "paragraphs": [
        "Gather all cards from the following encounter sets: *The Doom of Arkham Part I*, *Deep Ones*, *Domination*, *Dreams*, *Star Spawn*, *Agents of Cthulhu*, and *The Midnight Masks*. These sets are indicated by the following icons:"
      ]
    },
    "midnightMasksCards": {
      "paragraphs": [
        "When gathering the *The Midnight Masks* encounter set, only gather the location and treachery cards. Do not gather the acts or agendas from this set."
      ]
    },
    "placeLocations": {
      "paragraphs": [
        "Find each location in the *The Midnight Masks* encounter set and put them into play as follows:"
      ]
    },
    "randomVersions": {
      "paragraphs": [
        "Put one of the two Downtown locations and one of the two Southside locations into play at random and remove the other versions of those locations from the game. Put Northside, Easttown, Rivertown, St. Mary’s Hospital, and Miskatonic University into play according to the location placement diagram."
      ]
    },
    "setAsideLocations": {
      "paragraphs": [
        "Set each other location aside, out of play."
      ]
    },
    "startAtRivertown": {
      "paragraphs": [
        "Each investigator begins play at Rivertown."
      ]
    },
    "cardsBeneathLocations": {
      "paragraphs": [
        "Shuffle the single-sided Tillinghast Esoterica location with each treachery from the *The Midnight Masks* encounter set and place one of them under each location except for Rivertown."
      ]
    },
    "starSpawn": {
      "paragraphs": [
        "Shuffle each enemy from the *Star Spawn* encounter set and remove two at random from the game. (Remove three instead if playing on easy mode.)"
      ]
    },
    "setCardsAside": {
      "paragraphs": [
        "Gather all earned artifacts along with the Horror in Clay story asset and set them aside, out of play."
      ]
    },
    "legrasse": {
      "paragraphs": [
        "Choose an investigator to add the John Raymond Legrasse story asset to their deck. This card does not count toward their deck size."
      ]
    },
    "legrasseInPlay": {
      "paragraphs": [
        "Put the John Raymond Legrasse story asset into play under that investigator’s control. He does not take up an ally slot during Part I or Part II of this scenario."
      ]
    },
    "doomOnAgenda": {
      "paragraphs": [
        "Place doom on the agenda equal to the number of investigators."
      ]
    },
    "floodTokens": {
      "paragraphs": [
        "Add the flood tokens to the token pool."
      ]
    },
    "buildEncounterDeck": {
      "paragraphs": [
        "Shuffle the remaining encounter cards to build the encounter deck."
      ]
    }
  },
  "rules": {
    "partsOfTheDoomOfArkham": {
      "title": "Part I and Part II in The Doom of Arkham",
      "paragraphs": [
        "This scenario is split into two parts. Players may choose to play these parts one at a time (with a break between each part), or they may play both parts together as a longer session. Each part is its own game with its own setup and resolution.",
        "Investigators may upgrade their decks between Part I and Part II."
      ]
    }
  },
  "labels": {
    "readyToFight": "“We’re ready to fight.”",
    "needMoreTime": "“We need more time.”",
    "chooseLegrasseInvestigator": "Choose an investigator to add John Raymond Legrasse to their deck."
  },
  "tokensZh": {
    "easyStandard": {
      "skull": "-X。X为下方没有剧本卡牌地点数量的一半(向上取整)。",
      "cultist": "-3。如果本检定失败，在最近的一名其上没有毁灭标记的敌人上放置1个毁灭标记。",
      "tablet": "-3。如果本检定失败，将你的1个线索放在你所在地点。",
      "elderThing": "-2。如果你所在地点淹没，揭示另一个标记。"
    },
    "hardExpert": {
      "skull": "-X。X为下方没有剧本卡牌地点的数量。",
      "cultist": "-5。如果本检定失败，在最近的一名其上没有毁灭标记的敌人上放置1个毁灭标记。",
      "tablet": "-5。如果本检定失败，将你的1个线索放在你所在地点。",
      "elderThing": "-4。如果你所在地点淹没，揭示另一个标记。"
    }
  },
  "resolutions": {
    "noResolution": {
      "title": "No Resolution",
      "paragraphs": [
        "_If each investigator resigned or was defeated_: A trio of terrified locals bolts down the street past you, followed by a lumbering spawn of Cthulhu. Your blood runs cold. There is no safe place for you to run. You wander the flooded streets, looking for some sign of Ruby, Andy, or Inspector Legrasse.",
        "Each investigator searches the collection for a random basic _Injury_ or _Madness_ weakness and adds it to their deck. This card does not count toward that investigator’s deck size.",
        "Proceed to _Resolution 1_."
      ]
    },
    "resolution1": {
      "title": "Resolution 1",
      "paragraphs": [
        "_Resolution 1_: A disquieting roar shakes the very foundations of Arkham. Standing next to your companions, you look up to see the familiar, hulking form of Cthulhu slouch out of the Miskatonic River. With a single motion, the ancient one tramples an entire borough of Rivertown underfoot. The sound of cracking wood and shattering glass fill the air, followed by a chorus of screams.",
        "Andy, Ruby, and the Inspector share a grim look as your worst fears are confirmed. “We have to do something!” Andy shouts over the din.",
        "Update your Campaign Log. Under “Artifacts Earned”:Cross out the name of each _Artifact_ asset that was not under any investigator’s control when the scenario ended.",
        "If the Horror in Clay was under the control of an investigator when the scenario ended, record “Horror in Clay” under “Artifacts Earned.”",
        "In your Campaign Log, record “Flooded Neighborhoods:” along with a list of each flooded location.",
        "Each investigator earns experience equal to the Victory X value of each card in the victory display.",
        "The investigators must decide (choose one):“We’re ready to fight.” Proceed to _Resolution 2_ if you wish to continue playing immediately.",
        "“We need more time.” Skip to _Resolution 3_ if you wish to take a break and proceed the next time you play."
      ]
    },
    "resolution2": {
      "title": "Resolution 2",
      "paragraphs": [
        "_Resolution 2_: Only you can stand against this grave threat. Arkham needs you now.",
        "Clean up the game as normal.",
        "Proceed immediately to _The Doom of Arkham Part II_."
      ]
    },
    "resolution3": {
      "title": "Resolution 3",
      "paragraphs": [
        "_Resolution 3_: You urge your companions to take the time to prepare and collect yourself for your final stand.",
        "Clean up the game as normal.",
        "When you are ready to play again, begin at _The Doom of Arkham Part II_."
      ]
    }
  },
  "xp": {
    "bonus": "for confronting Randall Tillinghast"
  },
  "tooltips": {
    "theComingStorm": {
      "resign": "{action}: Resign. You give up your search."
    }
  }
})

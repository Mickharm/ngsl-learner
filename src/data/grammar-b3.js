/**
 * B3 grammar — the structures that separate a 500 from a 650 on TOEIC, and
 * that make spoken English sound like sentences rather than a word list.
 */

export default [
  {
    id: 'g21',
    band: 'B3',
    title: '過去完成式：過去的過去',
    pattern: 'S + had + 過去分詞',
    summary: '兩件過去的事，先發生的那件用過去完成式，把先後順序講清楚。',
    explain: [
      '只有在**同時提到兩個過去事件**、而且需要標明先後時才用。單獨一件過去的事，用過去簡單式就好。',
      '`When I arrived, the meeting had started.`（我到之前會議就開始了）vs `When I arrived, the meeting started.`（我到了，會議才開始）——差一個 had，意思完全不同。',
      '常搭配 by the time、before、after、already、never...before。',
      '注意：如果用了 before / after，先後關係已經清楚，過去完成式就變成可選的。'
    ],
    examples: [
      { en: 'By the time we got there, they had left.', zh: '我們到的時候他們已經走了。', note: '離開在抵達之前' },
      { en: 'She had never used the system before that day.', zh: '在那天之前她從沒用過這個系統。', note: 'never...before 常搭配' },
      { en: 'He realized he had forgotten his passport.', zh: '他發現自己忘了帶護照。', note: '忘記在發現之前' },
      { en: 'The train had already left when I reached the platform.', zh: '我到月台時火車已經開走了。', note: 'already 強調更早' }
    ],
    pitfalls: [
      '單一過去事件濫用過去完成式：❌ `Yesterday I had gone to the bank.` → ✅ `Yesterday I went to the bank.`',
      'had 後面用過去式：❌ `had went` → ✅ `had gone`。',
      '兩件事都用過去完成式：❌ `I had arrived and they had left.` → 只有先發生的那件用 had。'
    ],
    drills: [
      { type: 'choice', q: 'When I called, she _____ already _____ the office.', options: ['has / left', 'had / left', 'was / leaving', 'did / leave'], answer: 1, explain: '離開發生在打電話之前，用過去完成式 had left。' },
      { type: 'choice', q: 'He couldn\'t enter because he _____ his badge at home.', options: ['leaves', 'left', 'had left', 'has left'], answer: 2, explain: '把識別證忘在家發生在無法進入之前。' },
      { type: 'choice', q: 'By the time the technician arrived, the system _____ down for two hours.', options: ['was', 'has been', 'had been', 'is'], answer: 2, explain: '在技師抵達（過去）之前就已經持續了兩小時。' },
      { type: 'order', tokens: ['the', 'meeting', 'had', 'ended', 'before', 'we', 'arrived'], answer: 'The meeting had ended before we arrived', zh: '我們到之前會議就結束了。' },
      { type: 'correct', wrong: 'Last night I had watched a movie.', answer: 'Last night I watched a movie.', explain: '只有一件過去的事，用過去簡單式就好。' },
      { type: 'correct', wrong: 'She had wrote the email before the deadline.', answer: 'She had written the email before the deadline.', explain: 'had 後面接過去分詞 written，不是過去式 wrote。' }
    ]
  },

  {
    id: 'g22',
    band: 'B3',
    title: '條件句 Type 0 與 Type 1：真實的條件',
    pattern: 'If + 現在式, 現在式（永遠成立）　|　If + 現在式, will + 原形（可能發生）',
    summary: 'if 子句裡永遠不用 will，這是台灣學習者最常錯、TOEIC 最常考的一點。',
    explain: [
      '**Type 0（永遠為真）**：`If you heat water to 100°C, it boils.` 兩邊都用現在式，講科學事實或固定規律。',
      '**Type 1（未來可能發生）**：`If it rains, we will cancel the trip.` if 子句用**現在式**，主句用 **will**。',
      '**鐵則**：if 子句裡不用 will。想不通就記「if 後面不會有 will」。',
      'unless = if...not：`Unless you hurry, you will miss the train.` = `If you don\'t hurry, ...`'
    ],
    examples: [
      { en: 'If the test fails, we will roll back.', zh: '如果測試沒過，我們就回滾。', note: 'Type 1' },
      { en: 'If you press this button, the machine stops.', zh: '按這個鈕機器就會停。', note: 'Type 0，固定因果' },
      { en: 'Unless we get approval, the project cannot start.', zh: '除非拿到核准，專案無法開始。', note: 'unless = if not' },
      { en: 'If you need help, just let me know.', zh: '需要幫忙就跟我說。', note: '主句可以是祈使句' }
    ],
    pitfalls: [
      'if 子句用 will：❌ `If it will rain, ...` → ✅ `If it rains, ...`',
      'unless 再加 not（雙重否定）：❌ `Unless you don\'t hurry` → ✅ `Unless you hurry`。',
      '主句忘記 will：❌ `If it rains, we cancel the trip.`（變成 Type 0，語感是「每次下雨都取消」）'
    ],
    drills: [
      { type: 'choice', q: 'If the client _____ the quote, we will start next week.', options: ['will approve', 'approves', 'approved', 'is approving'], answer: 1, explain: 'if 子句用現在簡單式，主句用 will。' },
      { type: 'choice', q: 'We _____ the deadline if the parts arrive late.', options: ['miss', 'missed', 'will miss', 'would miss'], answer: 2, explain: 'Type 1 條件句，主句用 will + 原形。' },
      { type: 'choice', q: '_____ you confirm by Friday, we will give the slot to someone else.', options: ['If', 'Unless', 'Although', 'When'], answer: 1, explain: 'Unless = 如果不。「除非你確認，否則名額給別人」。' },
      { type: 'order', tokens: ['if', 'you', 'have', 'questions', 'please', 'ask', 'me'], answer: 'If you have questions please ask me', zh: '有問題就問我。' },
      { type: 'correct', wrong: 'If the weather will be good, we will go hiking.', answer: 'If the weather is good, we will go hiking.', explain: 'if 子句不用 will。' },
      { type: 'correct', wrong: 'Unless you don\'t submit it today, you will be late.', answer: 'Unless you submit it today, you will be late.', explain: 'unless 本身已含否定，不要再加 not。' }
    ]
  },

  {
    id: 'g23',
    band: 'B3',
    title: '條件句 Type 2：與現在事實相反',
    pattern: 'If + 過去式, would + 原形',
    summary: '講「如果...就好了」這種不可能或不太可能的假設。動詞往前退一格（現在式退成過去式）。',
    explain: [
      '`If I had more time, I would travel more.`（事實：我沒時間）——這裡的過去式**不是在講過去**，是在標示「這是假設」。',
      'be 動詞在正式用法一律用 **were**：`If I were you, I would take the job.` 這是固定句型，背起來就能用。',
      '**Type 1 vs Type 2**：`If I win the lottery...`（我真的有買，有機會）vs `If I won the lottery...`（純幻想）。',
      '這個句型在旅遊和職場對話很實用，因為它是**委婉建議**的標準說法：`If I were you, I would...`'
    ],
    examples: [
      { en: 'If I were you, I would ask for a discount.', zh: '如果我是你，我會要求打折。', note: '委婉建議的固定句型' },
      { en: 'If we had a bigger budget, we could hire more people.', zh: '預算多一點的話我們就能多請人。', note: '事實：預算不夠' },
      { en: 'What would you do if you lost your passport?', zh: '如果你護照掉了會怎麼辦？', note: '假設情境提問' },
      { en: 'If the system were faster, users would not complain.', zh: '系統快一點的話使用者就不會抱怨。', note: 'were 用於所有人稱' }
    ],
    pitfalls: [
      'if 子句用 would：❌ `If I would have time...` → ✅ `If I had time...`',
      '主句忘記 would：❌ `If I were you, I take it.` → ✅ `If I were you, I would take it.`',
      '把 Type 2 的過去式誤解成在講過去的事。'
    ],
    drills: [
      { type: 'choice', q: 'If I _____ the answer, I would tell you.', options: ['know', 'knew', 'have known', 'will know'], answer: 1, explain: 'Type 2 條件句，if 子句用過去式表示與現在事實相反。' },
      { type: 'choice', q: 'If she _____ here, she would know what to do.', options: ['is', 'was', 'were', 'will be'], answer: 2, explain: '假設語氣的 be 動詞用 were（各人稱通用）。' },
      { type: 'choice', q: 'We _____ more customers if our website loaded faster.', options: ['have', 'will have', 'would have', 'had'], answer: 2, explain: 'Type 2 的主句用 would + 原形。' },
      { type: 'order', tokens: ['if', 'I', 'were', 'you', 'I', 'would', 'take', 'the', 'train'], answer: 'If I were you I would take the train', zh: '如果我是你，我會搭火車。' },
      { type: 'correct', wrong: 'If I would have more money, I would buy a house.', answer: 'If I had more money, I would buy a house.', explain: 'if 子句裡不用 would，直接用過去式。' },
      { type: 'correct', wrong: 'If he was the manager, things will be different.', answer: 'If he were the manager, things would be different.', explain: '假設語氣用 were，主句用 would 不是 will。' }
    ]
  },

  {
    id: 'g24',
    band: 'B3',
    title: '關係子句：who / which / that',
    pattern: '名詞 + who/which/that + 動詞...',
    summary: '把兩個句子合成一個，用來說明「哪一個」。中文用「...的」，英文把說明放名詞後面。',
    explain: [
      '中文：「**站在門口的**那個人」——說明在前。英文：「the person **who is standing at the door**」——說明在後。這個方向差異是主要的卡點。',
      '**who** 指人，**which** 指物，**that** 人物皆可（限定用法）。',
      '關係代名詞當**受詞**時可以省略：`The book (that) I bought` — 判斷方法：後面緊接著主詞就可省。',
      '**逗號的差別**：`My brother who lives in Tokyo...`（我有好幾個兄弟，指住東京那個）vs `My brother, who lives in Tokyo, ...`（我只有一個兄弟，順便補充他住東京）。逗號後面**不能用 that**。'
    ],
    examples: [
      { en: 'The engineer who designed this is on leave.', zh: '設計這個的工程師請假了。', note: 'who 指人，當主詞不可省' },
      { en: 'This is the report which explains the issue.', zh: '這是說明問題的那份報告。', note: 'which 指物' },
      { en: 'The file I sent yesterday is outdated.', zh: '我昨天寄的檔案過期了。', note: '當受詞，that 省略' },
      { en: 'Our office, which opened in 2020, is downtown.', zh: '我們辦公室（2020 年開幕）在市中心。', note: '逗號補充說明，不能用 that' }
    ],
    pitfalls: [
      '重複主詞：❌ `The man who he called me...` → ✅ `The man who called me...`',
      '逗號後用 that：❌ `My laptop, that is new, ...` → ✅ `My laptop, which is new, ...`',
      '中文語序直譯：❌ `Standing at the door the person is my boss.` → ✅ `The person standing at the door is my boss.`'
    ],
    drills: [
      { type: 'choice', q: 'The candidate _____ we interviewed yesterday accepted the offer.', options: ['who', 'whom', 'which', 'what'], answer: 1, explain: '關係代名詞當受詞（we interviewed him），正式用 whom；口語 who/that 也可，但選項中 whom 最精確。' },
      { type: 'choice', q: 'This is the tool _____ solved our problem.', options: ['who', 'which', 'whose', 'what'], answer: 1, explain: 'tool 是物，用 which（或 that）。' },
      { type: 'choice', q: 'Our new office, _____ is near the station, opens next month.', options: ['that', 'which', 'who', 'where'], answer: 1, explain: '逗號的補充說明用法不能用 that，要用 which。' },
      { type: 'choice', q: 'The people _____ attended the workshop received a certificate.', options: ['which', 'who', 'whose', 'whom'], answer: 1, explain: 'people 是人且當主詞（attended），用 who。' },
      { type: 'order', tokens: ['the', 'company', 'that', 'hired', 'me', 'is', 'in', 'Hsinchu'], answer: 'The company that hired me is in Hsinchu', zh: '錄取我的那家公司在新竹。' },
      { type: 'correct', wrong: 'The book which I read it was interesting.', answer: 'The book which I read was interesting.', explain: 'which 已經代替了 the book，後面不能再有受詞 it。' }
    ]
  },

  {
    id: 'g25',
    band: 'B3',
    title: '間接引語：把別人的話轉述出來',
    pattern: 'say/tell + (that) + 子句（時態往後退一格）',
    summary: '轉述過去說的話，時態要「後退」，人稱和時間詞也要跟著改。',
    explain: [
      '**時態後退**：現在式 → 過去式，過去式 → 過去完成式，will → would，can → could。`"I am busy." → He said he was busy.`',
      '**say vs tell**：say 後面直接接內容（`He said that...`），tell 後面一定要接**人**（`He told me that...`）。',
      '**時間地點詞也要改**：now → then，today → that day，tomorrow → the next day，here → there。',
      '**間接問句語序變回直述**：`"Where is it?" → He asked where it was.`（不是 where was it）',
      '如果轉述的內容**現在仍然為真**，時態可以不退：`He said he lives in Taipei.`（他還住那）'
    ],
    examples: [
      { en: 'She said she was working on it.', zh: '她說她正在處理。', note: 'am → was' },
      { en: 'He told me that he would call back.', zh: '他跟我說他會回電。', note: 'tell + 人；will → would' },
      { en: 'They asked when the shipment would arrive.', zh: '他們問貨什麼時候會到。', note: '間接問句用直述語序' },
      { en: 'The manager asked if I had finished.', zh: '主管問我完成了沒。', note: 'yes/no 問句用 if / whether' }
    ],
    pitfalls: [
      'say 後面直接接人：❌ `He said me that...` → ✅ `He told me that...` 或 `He said that...`',
      '間接問句維持疑問語序：❌ `He asked where was the file.` → ✅ `He asked where the file was.`',
      '間接問句多加問號：❌ `She asked what time it was?` → ✅ 句尾用句號。'
    ],
    drills: [
      { type: 'choice', q: 'He _____ me that the meeting was cancelled.', options: ['said', 'told', 'spoke', 'talked'], answer: 1, explain: '後面接受詞 me，要用 tell。say 不能直接接人。' },
      { type: 'choice', q: 'She asked me where I _____ the file.', options: ['put', 'had put', 'have put', 'did put'], answer: 1, explain: '轉述過去的話，時態往後退一格。' },
      { type: 'choice', q: 'The client asked _____ we could deliver by Friday.', options: ['that', 'if', 'what', 'which'], answer: 1, explain: '轉述 yes/no 問句用 if 或 whether。' },
      { type: 'choice', q: 'He said he _____ send the invoice the next day.', options: ['will', 'would', 'is going to', 'shall'], answer: 1, explain: '間接引語中 will 要退成 would。' },
      { type: 'order', tokens: ['she', 'told', 'us', 'that', 'she', 'was', 'leaving', 'early'], answer: 'She told us that she was leaving early', zh: '她告訴我們她要早退。' },
      { type: 'correct', wrong: 'He asked me what time is it.', answer: 'He asked me what time it was.', explain: '間接問句用直述語序，且時態後退。' }
    ]
  },

  {
    id: 'g26',
    band: 'B3',
    title: '使役動詞：make / let / have / get',
    pattern: 'make/let/have + 人 + 原形　|　get + 人 + to V',
    summary: '「叫某人做某事」。四個字後面接的形式不一樣，get 是唯一要加 to 的。',
    explain: [
      '**make + 受詞 + 原形**（強迫）：`The manager made us stay late.`',
      '**let + 受詞 + 原形**（允許）：`They let me leave early.`',
      '**have + 受詞 + 原形**（安排、請人做）：`I had the technician check the machine.`',
      '**get + 受詞 + to V**（說服、設法讓）：`I got him to sign the form.` ← 只有這個要 to。',
      '**事情被做**用過去分詞：`I had my laptop repaired.`（我把筆電拿去修）— 這個句型在旅遊很實用：`I got my hair cut.`'
    ],
    examples: [
      { en: 'She let me use her charger.', zh: '她讓我用她的充電器。', note: 'let + 原形' },
      { en: 'I had the hotel book a taxi.', zh: '我請飯店叫了計程車。', note: 'have + 人 + 原形' },
      { en: 'I had my passport photocopied.', zh: '我把護照影印了。', note: 'have + 物 + 過去分詞' },
      { en: 'We got the vendor to lower the price.', zh: '我們讓廠商降價了。', note: 'get + 人 + to V' }
    ],
    pitfalls: [
      'make / let 後面加 to：❌ `He made me to wait.` → ✅ `He made me wait.`',
      'get 後面忘記 to：❌ `I got him sign it.` → ✅ `I got him to sign it.`',
      '被動時 make 要加 to：`I was made to wait.`（被動時 to 回來了）'
    ],
    drills: [
      { type: 'choice', q: 'The policy makes everyone _____ a badge.', options: ['to wear', 'wear', 'wearing', 'wears'], answer: 1, explain: 'make + 受詞 + 原形動詞。' },
      { type: 'choice', q: 'I need to get someone _____ this document.', options: ['translate', 'to translate', 'translating', 'translated'], answer: 1, explain: 'get + 人 + to V。' },
      { type: 'choice', q: 'She had her car _____ last week.', options: ['repair', 'to repair', 'repaired', 'repairing'], answer: 2, explain: '車是被修的，have + 物 + 過去分詞。' },
      { type: 'choice', q: 'My boss let me _____ from home on Fridays.', options: ['to work', 'work', 'working', 'worked'], answer: 1, explain: 'let + 受詞 + 原形。' },
      { type: 'order', tokens: ['I', 'had', 'the', 'hotel', 'hold', 'my', 'luggage'], answer: 'I had the hotel hold my luggage', zh: '我請飯店幫我寄放行李。' },
      { type: 'correct', wrong: 'They made us to sign a form.', answer: 'They made us sign a form.', explain: 'make 後面接原形動詞，不加 to。' }
    ]
  },

  {
    id: 'g27',
    band: 'B3',
    title: '感官動詞：see / hear / watch / feel',
    pattern: '感官動詞 + 受詞 + 原形（整段）／ V-ing（進行中）',
    summary: '看到、聽到某人做某事。接原形表示看到「整個過程」，接 V-ing 表示看到「進行中的片段」。',
    explain: [
      '**原形 = 從頭看到尾**：`I saw him leave the building.`（看到他離開的整個動作）',
      '**V-ing = 只看到中間片段**：`I saw him walking down the street.`（看到他正在走）',
      '被動時原形要變回 to V：`He was seen to leave.`',
      '常用的感官動詞：see, hear, watch, notice, feel, listen to, look at。'
    ],
    examples: [
      { en: 'I heard someone knock on the door.', zh: '我聽到有人敲門。', note: '完整動作用原形' },
      { en: 'She saw him waiting outside.', zh: '她看到他在外面等。', note: '進行中的片段用 V-ing' },
      { en: 'We watched the plane take off.', zh: '我們看著飛機起飛。', note: '從頭看到尾' },
      { en: 'I felt the floor shaking.', zh: '我感覺到地板在震。', note: '持續中的狀態' }
    ],
    pitfalls: [
      '加 to：❌ `I saw him to leave.` → ✅ `I saw him leave.`',
      '用一般子句代替：❌ `I saw that he left.` 文法對但語感不同，指「我得知他離開了」而非親眼看到。',
      '第三人稱加 s：❌ `I heard him knocks.` → ✅ `I heard him knock.`'
    ],
    drills: [
      { type: 'choice', q: 'I saw the manager _____ the room a minute ago.', options: ['to enter', 'enter', 'enters', 'entered'], answer: 1, explain: '感官動詞 + 受詞 + 原形，看到完整動作。' },
      { type: 'choice', q: 'We heard the alarm _____ for ten minutes.', options: ['ring', 'ringing', 'to ring', 'rings'], answer: 1, explain: '持續十分鐘的進行狀態，用 V-ing。' },
      { type: 'choice', q: 'She noticed him _____ nervous during the interview.', options: ['to look', 'looks', 'looking', 'looked'], answer: 2, explain: '面試過程中持續的狀態，用 V-ing。' },
      { type: 'order', tokens: ['I', 'watched', 'the', 'technician', 'replace', 'the', 'part'], answer: 'I watched the technician replace the part', zh: '我看著技師換掉那個零件。' },
      { type: 'correct', wrong: 'I heard her to sing in the next room.', answer: 'I heard her sing in the next room.', explain: '感官動詞後面接原形，不加 to。' },
      { type: 'correct', wrong: 'He felt the building shakes.', answer: 'He felt the building shake.', explain: '感官動詞後面用原形，不加第三人稱 s。' }
    ]
  },

  {
    id: 'g28',
    band: 'B3',
    title: '分詞形容詞：-ing 與 -ed',
    pattern: '-ing = 事物造成的感覺　|　-ed = 人感受到的情緒',
    summary: '`I am boring.` 和 `I am bored.` 差一個字母，意思差很遠。這是最容易鬧笑話的錯誤。',
    explain: [
      '**-ing 形容「引起感覺的東西」**：The movie is **boring**.（這部電影很無聊）',
      '**-ed 形容「感受到的人」**：I am **bored**.（我覺得無聊）',
      '❌ `I am boring.` 的意思是「我這個人很無趣」——不是你想講的。',
      '常考組：interesting/interested、confusing/confused、tiring/tired、surprising/surprised、frustrating/frustrated、exciting/excited、satisfying/satisfied。',
      '判斷方法：主詞**是原因**用 -ing，主詞**是感受者**用 -ed。'
    ],
    examples: [
      { en: 'The instructions were confusing.', zh: '那份說明很讓人困惑。', note: '說明是原因 → -ing' },
      { en: 'I was confused by the instructions.', zh: '我被說明搞糊塗了。', note: '我是感受者 → -ed' },
      { en: 'The results are surprising.', zh: '結果令人意外。', note: '結果是原因' },
      { en: 'Everyone was excited about the trip.', zh: '大家都對這趟旅行很興奮。', note: '人是感受者' }
    ],
    pitfalls: [
      '❌ `I am very interesting in this job.` → ✅ `I am very interested in this job.` 求職信寫錯會很尷尬。',
      '❌ `The trip was very excited.` → ✅ `The trip was very exciting.`',
      '❌ `I am boring.` → ✅ `I am bored.`'
    ],
    drills: [
      { type: 'choice', q: 'The training session was very _____.', options: ['tired', 'tiring', 'tire', 'to tire'], answer: 1, explain: '課程是造成疲累的原因，用 -ing。' },
      { type: 'choice', q: 'I am _____ in learning more about the role.', options: ['interesting', 'interested', 'interest', 'interests'], answer: 1, explain: '我是感受者，用 -ed。be interested in 是固定搭配。' },
      { type: 'choice', q: 'The customers were _____ with the service.', options: ['satisfying', 'satisfied', 'satisfy', 'satisfaction'], answer: 1, explain: '顧客是感受者，用 -ed。' },
      { type: 'choice', q: 'It was a _____ experience for everyone.', options: ['frustrated', 'frustrating', 'frustrate', 'frustration'], answer: 1, explain: '經驗是造成挫折的原因，用 -ing。' },
      { type: 'order', tokens: ['the', 'presentation', 'was', 'surprisingly', 'interesting'], answer: 'The presentation was surprisingly interesting', zh: '那場簡報意外地有趣。' },
      { type: 'correct', wrong: 'I was very exciting about the news.', answer: 'I was very excited about the news.', explain: '我是感受興奮的人，用 -ed。' }
    ]
  },

  {
    id: 'g29',
    band: 'B3',
    title: '平行結構：and / or 兩邊要對稱',
    pattern: 'A and B —— A 與 B 的詞性、形式必須一致',
    summary: 'TOEIC 常考、寫作也常錯：用 and / or / but 連接時，兩邊的形式要長得一樣。',
    explain: [
      '❌ `She likes reading, jogging, and to cook.` → ✅ `...reading, jogging, and cooking.` 三個都要 V-ing。',
      '**片語也要對稱**：`not only... but also...`、`both... and...`、`either... or...` 兩邊接的東西詞性要一致。',
      '❌ `He is responsible for testing and to write reports.` → ✅ `...for testing and writing reports.`',
      '判斷方法：把 and 兩邊分別接回句子開頭，兩邊都要通順。'
    ],
    examples: [
      { en: 'The job requires patience, focus, and creativity.', zh: '這份工作需要耐心、專注和創意。', note: '三個名詞' },
      { en: 'She is not only smart but also reliable.', zh: '她不只聰明還很可靠。', note: 'not only/but also 兩邊都是形容詞' },
      { en: 'We can either fix it now or replace it later.', zh: '我們可以現在修，或之後換掉。', note: 'either/or 兩邊都是動詞片語' },
      { en: 'He enjoys hiking and swimming.', zh: '他喜歡健行和游泳。', note: '兩個 V-ing' }
    ],
    pitfalls: [
      '混用 V-ing 和 to V：❌ `enjoys hiking and to swim`。',
      '混用名詞和子句：❌ `We discussed the budget and how should we proceed.` → ✅ `...and how to proceed.`',
      'not only 後面詞性和 but also 不一致。'
    ],
    drills: [
      { type: 'choice', q: 'The role involves testing, debugging, and _____ documentation.', options: ['to write', 'writing', 'write', 'wrote'], answer: 1, explain: '前兩項是 V-ing，第三項要一致。' },
      { type: 'choice', q: 'She is responsible for hiring and _____ new staff.', options: ['to train', 'trains', 'training', 'trained'], answer: 2, explain: '介系詞 for 後面且與 hiring 平行，用 training。' },
      { type: 'choice', q: 'The plan is not only expensive but also _____.', options: ['risk', 'risking', 'risky', 'to risk'], answer: 2, explain: 'not only 後面是形容詞 expensive，but also 也要接形容詞 risky。' },
      { type: 'order', tokens: ['we', 'need', 'to', 'reduce', 'cost', 'and', 'improve', 'quality'], answer: 'We need to reduce cost and improve quality', zh: '我們需要降低成本並提升品質。' },
      { type: 'correct', wrong: 'He likes to read, to travel, and cooking.', answer: 'He likes to read, to travel, and to cook.', explain: '三個項目形式要一致，全部用 to V（或全部用 V-ing）。' },
      { type: 'correct', wrong: 'The course covers grammar, vocabulary, and how you can pronounce words.', answer: 'The course covers grammar, vocabulary, and pronunciation.', explain: '前兩項是名詞，第三項也要用名詞。' }
    ]
  },

  {
    id: 'g30',
    band: 'B3',
    title: '常見句型組合：實戰句型庫',
    pattern: 'It is + adj + to V　|　so...that　|　too...to　|　enough to',
    summary: '把前面學的元素組起來的常用模板。背熟這幾個就能講出像樣的長句。',
    explain: [
      '**It is + 形容詞 + to V**（虛主詞）：`It is difficult to explain.` 中文「解釋起來很難」不能直譯成 `Explain is difficult.`',
      '**so + 形容詞 + that + 子句**（如此...以致於）：`The room was so cold that I could not sleep.`',
      '**too + 形容詞 + to V**（太...而不能）：`It is too expensive to buy.` 注意：**too...to 本身就是否定**，不要再加 not。',
      '**形容詞 + enough + to V**（夠...可以）：`He is old enough to drive.` enough 放**形容詞後面**、**名詞前面**。',
      '**used to + 原形**（以前常做但現在不做了）：`I used to smoke.` 別和 `be used to + V-ing`（習慣於）搞混。'
    ],
    examples: [
      { en: 'It is important to double-check the settings.', zh: '再確認一次設定很重要。', note: '虛主詞 It' },
      { en: 'The file was so large that the upload failed.', zh: '檔案太大導致上傳失敗。', note: 'so...that' },
      { en: 'The instructions were too vague to follow.', zh: '說明太模糊，沒辦法照做。', note: 'too...to 已含否定' },
      { en: 'I used to work night shifts.', zh: '我以前上夜班。', note: '現在不上了' }
    ],
    pitfalls: [
      'too...to 再加 not：❌ `too expensive not to buy` 意思會反過來。',
      'enough 位置錯：❌ `enough old` → ✅ `old enough`。',
      '`used to V`（以前）和 `be used to V-ing`（習慣）混用：❌ `I am used to work here.`（若想講「我以前在這工作」）→ ✅ `I used to work here.`',
      '中文式主詞：❌ `Learn English is hard.` → ✅ `It is hard to learn English.` 或 `Learning English is hard.`'
    ],
    drills: [
      { type: 'choice', q: '_____ is necessary to confirm the booking in advance.', options: ['That', 'It', 'This', 'There'], answer: 1, explain: '虛主詞用 It，真正的主詞是後面的 to confirm...。' },
      { type: 'choice', q: 'The box was _____ heavy _____ I could not lift it.', options: ['too / to', 'so / that', 'very / that', 'such / that'], answer: 1, explain: 'so + 形容詞 + that + 子句。' },
      { type: 'choice', q: 'He is experienced _____ to handle this alone.', options: ['enough', 'too', 'so', 'very'], answer: 0, explain: 'enough 放形容詞後面，「夠有經驗可以...」。' },
      { type: 'choice', q: 'I _____ live in Kaohsiung, but I moved to Tainan last year.', options: ['am used to', 'used to', 'use to', 'was used to'], answer: 1, explain: '「以前住但現在不住」用 used to + 原形。' },
      { type: 'order', tokens: ['it', 'is', 'easy', 'to', 'make', 'this', 'mistake'], answer: 'It is easy to make this mistake', zh: '這個錯誤很容易犯。' },
      { type: 'correct', wrong: 'The coffee was too hot to not drink.', answer: 'The coffee was too hot to drink.', explain: 'too...to 本身已表示「太...而不能」，不要再加 not。' }
    ]
  }
]

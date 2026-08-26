/**
 * B1 grammar — the ten structures that have to be automatic before anything
 * else is worth studying. Written for a Mandarin L1 speaker: every `pitfalls`
 * entry is an error Chinese speakers actually make, not a generic warning.
 *
 * drill types
 *   choice   — TOEIC Part 5 shape: pick the grammatical option
 *   order    — reassemble a scrambled sentence (word-order intuition)
 *   correct  — one sentence, one error, find the fix
 */

export default [
  {
    id: 'g01',
    band: 'B1',
    title: '英文的骨架：主詞 + 動詞 + 受詞',
    pattern: 'S + V + O',
    summary: '英文靠「語序」表達誰對誰做了什麼，中文靠語感。語序錯了，意思就錯了。',
    explain: [
      '中文可以說「這本書我看完了」，把受詞丟到最前面也聽得懂。英文不行——英文的位置本身就是文法。',
      '`The dog bit the man.` 和 `The man bit the dog.` 用的字完全一樣，意思天差地遠。差別只在誰站在動詞前面。',
      '先把這條記死：**動詞前面是主詞，動詞後面是受詞**。之後所有句型都是在這個骨架上加東西。'
    ],
    examples: [
      { en: 'I finished the report.', zh: '我完成了報告。', note: 'I(S) finished(V) the report(O)' },
      { en: 'She sent me an email.', zh: '她寄了一封 email 給我。', note: '兩個受詞時，人在前、物在後' },
      { en: 'The train left the station.', zh: '火車離開了車站。', note: '主詞不一定是人' }
    ],
    pitfalls: [
      '中文式倒裝：❌ `The report I finished.` → ✅ `I finished the report.`',
      '省略主詞（中文常省，英文幾乎不能省）：❌ `Is very hot today.` → ✅ `It is very hot today.`',
      '一個句子塞兩個動詞：❌ `I go shopping buy clothes.` → ✅ `I go shopping to buy clothes.`'
    ],
    drills: [
      { type: 'choice', q: '_____ opened the door.', options: ['He', 'Him', 'His', 'Himself'], answer: 0, explain: '動詞前面要用主格 He。Him 是受格，只能放動詞或介系詞後面。' },
      { type: 'choice', q: 'The manager _____ the meeting yesterday.', options: ['cancel', 'cancelled', 'cancelling', 'to cancel'], answer: 1, explain: 'yesterday 指過去，主要動詞要用過去式 cancelled。' },
      { type: 'order', tokens: ['my', 'sister', 'a', 'new', 'phone', 'bought'], answer: 'My sister bought a new phone', zh: '我姊姊買了一支新手機。' },
      { type: 'order', tokens: ['the', 'company', 'sent', 'us', 'the', 'contract'], answer: 'The company sent us the contract', zh: '公司把合約寄給我們了。' },
      { type: 'correct', wrong: 'Every morning drink I coffee.', answer: 'Every morning I drink coffee.', explain: '時間副詞可以放句首，但主詞 I 一定要在動詞 drink 前面。' },
      { type: 'correct', wrong: 'Is raining outside now.', answer: 'It is raining outside now.', explain: '英文句子不能沒有主詞。談天氣時用虛主詞 It。' }
    ]
  },

  {
    id: 'g02',
    band: 'B1',
    title: 'be 動詞：am / is / are',
    pattern: 'S + be + 名詞 / 形容詞 / 地點',
    summary: 'be 動詞不是「做」什麼，而是「是」什麼、「在」哪裡、「處於」什麼狀態。',
    explain: [
      'be 動詞有三個現在式：I → am，he/she/it/單數 → is，you/we/they/複數 → are。',
      '它後面接三種東西：**身分**（He is an engineer.）、**性質**（The room is cold.）、**位置**（They are at the airport.）。',
      '關鍵原則：**一個句子裡 be 動詞和一般動詞不能同時當主要動詞**。❌ `I am work here.` 這是最常見的初學錯誤。'
    ],
    examples: [
      { en: 'I am an engineer.', zh: '我是工程師。', note: '身分' },
      { en: 'The instructions are clear.', zh: '這份說明很清楚。', note: '性質，形容詞前不加 very 也成立' },
      { en: 'The keys are on the table.', zh: '鑰匙在桌上。', note: '位置' },
      { en: 'She is not ready yet.', zh: '她還沒準備好。', note: '否定：be + not' }
    ],
    pitfalls: [
      'be + 一般動詞混用：❌ `I am work at ITRI.` → ✅ `I work at ITRI.`',
      '形容詞前多加 be 以外的東西：❌ `The room is very much cold.` → ✅ `The room is very cold.`',
      '中文「我很忙」的「很」不用翻：❌ `I am very busy.` 沒錯，但 `I am busy.` 就夠了。'
    ],
    drills: [
      { type: 'choice', q: 'The results _____ ready this afternoon.', options: ['is', 'are', 'be', 'am'], answer: 1, explain: 'results 是複數，配 are。' },
      { type: 'choice', q: 'My colleague and I _____ in the same team.', options: ['am', 'is', 'are', 'be'], answer: 2, explain: 'A and I 是複數主詞，用 are。' },
      { type: 'choice', q: 'She _____ not interested in the offer.', options: ['do', 'does', 'is', 'are'], answer: 2, explain: 'interested 是形容詞，要用 be 動詞否定，不是 does not。' },
      { type: 'order', tokens: ['the', 'office', 'is', 'closed', 'on', 'Sunday'], answer: 'The office is closed on Sunday', zh: '辦公室週日不開。' },
      { type: 'correct', wrong: 'I am agree with you.', answer: 'I agree with you.', explain: 'agree 本身就是動詞，不需要 be。這是中文「我是同意的」直譯造成的錯誤。' },
      { type: 'correct', wrong: 'He is work in Taipei.', answer: 'He works in Taipei.', explain: 'work 是一般動詞，第三人稱單數加 s，不要 be。' }
    ]
  },

  {
    id: 'g03',
    band: 'B1',
    title: '現在簡單式：習慣與事實',
    pattern: 'S + V(-s) + O　|　S + do/does + not + V',
    summary: '講「經常做」「總是這樣」「這是事實」用現在簡單式。第三人稱單數動詞要加 s。',
    explain: [
      '現在簡單式**不是**在講「現在正在做」，而是在講**習慣、規律、不變的事實**。`I take the MRT to work.` 是「我平常搭捷運上班」，不是「我此刻正在搭」。',
      '主詞是 he / she / it 或單數名詞時，動詞加 -s：`He works late.`',
      '否定和疑問要借助 do / does，而且**借完之後主要動詞就變回原形**：`He does not work late.`（不是 works）。'
    ],
    examples: [
      { en: 'I check my email every morning.', zh: '我每天早上收信。', note: '習慣' },
      { en: 'Water boils at 100 degrees.', zh: '水在一百度沸騰。', note: '不變的事實' },
      { en: 'She does not eat meat.', zh: '她不吃肉。', note: 'does + not + 原形 eat' },
      { en: 'Do you speak English?', zh: '你會說英文嗎？', note: '疑問句 Do 開頭' }
    ],
    pitfalls: [
      '忘記第三人稱 s：❌ `He work here.` → ✅ `He works here.`',
      'does 後面又加 s：❌ `She doesn\'t works.` → ✅ `She doesn\'t work.`',
      '用現在簡單式講「正在做」：❌ `I eat lunch now.` → ✅ `I am eating lunch now.`'
    ],
    drills: [
      { type: 'choice', q: 'My manager usually _____ the office at seven.', options: ['leave', 'leaves', 'leaving', 'is leave'], answer: 1, explain: 'usually 是頻率副詞，配現在簡單式；My manager 單數，動詞加 s。' },
      { type: 'choice', q: 'They _____ not accept credit cards here.', options: ['do', 'does', 'is', 'are'], answer: 0, explain: 'They 是複數，否定用 do not。' },
      { type: 'choice', q: '_____ this train go to the airport?', options: ['Do', 'Does', 'Is', 'Are'], answer: 1, explain: 'this train 第三人稱單數，疑問句用 Does，後面動詞保持原形 go。' },
      { type: 'order', tokens: ['he', 'often', 'works', 'on', 'weekends'], answer: 'He often works on weekends', zh: '他常常週末工作。' },
      { type: 'correct', wrong: 'She don\'t like spicy food.', answer: 'She doesn\'t like spicy food.', explain: 'She 是第三人稱單數，否定助動詞要用 doesn\'t。' },
      { type: 'correct', wrong: 'Does he has a car?', answer: 'Does he have a car?', explain: 'Does 已經帶了第三人稱資訊，主要動詞回到原形 have。' }
    ]
  },

  {
    id: 'g04',
    band: 'B1',
    title: '過去簡單式：已經結束的事',
    pattern: 'S + V-ed / 不規則過去式',
    summary: '事情發生在過去、而且已經結束，就用過去簡單式。通常會有明確的過去時間點。',
    explain: [
      '規則變化加 -ed：`work → worked`、`start → started`。但最常用的動詞幾乎都不規則：`go → went`、`have → had`、`take → took`、`buy → bought`。',
      '否定和疑問一律用 **did**，而且主要動詞退回原形：`I did not go.`、`Did you go?` — 不會出現兩個過去式。',
      'be 動詞的過去式自成一套：I/he/she/it → **was**，you/we/they → **were**。'
    ],
    examples: [
      { en: 'We visited Japan last year.', zh: '我們去年去了日本。', note: '規則變化 + 明確過去時間' },
      { en: 'He took the wrong train.', zh: '他搭錯車了。', note: 'take → took' },
      { en: 'I did not receive your message.', zh: '我沒收到你的訊息。', note: 'did not + 原形 receive' },
      { en: 'The meeting was long.', zh: '那場會議很長。', note: 'be 的過去式 was' }
    ],
    pitfalls: [
      'did 後面又用過去式：❌ `Did you went there?` → ✅ `Did you go there?`',
      '中文沒有時態變化，容易整句忘記變：❌ `Yesterday I go to the bank.` → ✅ `Yesterday I went to the bank.`',
      'was / were 用錯：❌ `They was late.` → ✅ `They were late.`'
    ],
    drills: [
      { type: 'choice', q: 'She _____ the report before the deadline.', options: ['finish', 'finishes', 'finished', 'finishing'], answer: 2, explain: 'before the deadline 指已發生的過去事件，用過去式 finished。' },
      { type: 'choice', q: 'I _____ not know about the change.', options: ['do', 'did', 'am', 'was'], answer: 1, explain: '過去的否定用 did not + 原形 know。' },
      { type: 'choice', q: 'The flights _____ delayed because of the storm.', options: ['was', 'were', 'did', 'do'], answer: 1, explain: 'flights 複數，be 的過去式用 were。' },
      { type: 'order', tokens: ['we', 'stayed', 'at', 'a', 'small', 'hotel'], answer: 'We stayed at a small hotel', zh: '我們住在一間小旅館。' },
      { type: 'correct', wrong: 'Did she called you yesterday?', answer: 'Did she call you yesterday?', explain: 'Did 已經表示過去，call 要用原形。' },
      { type: 'correct', wrong: 'Last week I am very busy.', answer: 'Last week I was very busy.', explain: 'Last week 是過去，be 動詞要用 was。' }
    ]
  },

  {
    id: 'g05',
    band: 'B1',
    title: '名詞單複數與可數性',
    pattern: '一個 → a/an + 單數　|　多個 → 複數 -s　|　不可數 → 無 a、無 -s',
    summary: '英文強迫你每次講到名詞都要決定：一個還是多個？可不可數？中文沒有這個負擔，所以最容易漏。',
    explain: [
      '**可數名詞**有單複數：`a book / three books`。單數形式**不能裸奔**——前面一定要有 a、an、the、my、this 之類的限定詞。',
      '**不可數名詞**沒有複數形，也不能加 a：information、advice、equipment、furniture、money、water、work。要算的話借單位：`a piece of advice`、`two pieces of equipment`。',
      '台灣學習者最常踩的雷：information、advice、equipment 這三個在中文裡都是可以「一則、一個」的，但英文裡不可數。'
    ],
    examples: [
      { en: 'I need a new laptop.', zh: '我需要一台新筆電。', note: '單數可數 → 前面要有 a' },
      { en: 'We received three applications.', zh: '我們收到三份申請。', note: '複數 -s' },
      { en: 'She gave me some useful advice.', zh: '她給了我一些有用的建議。', note: 'advice 不可數，沒有 -s' },
      { en: 'The equipment is expensive.', zh: '這些設備很貴。', note: '不可數 → 動詞用單數 is' }
    ],
    pitfalls: [
      '❌ `informations` / `advices` / `equipments` → 這三個字永遠沒有複數。',
      '單數可數名詞裸奔：❌ `I have car.` → ✅ `I have a car.`',
      '❌ `many informations` → ✅ `much information` 或 `a lot of information`。'
    ],
    drills: [
      { type: 'choice', q: 'He gave me some _____ about the project.', options: ['informations', 'information', 'an information', 'informationes'], answer: 1, explain: 'information 是不可數名詞，永遠沒有複數形，也不加 a。' },
      { type: 'choice', q: 'There are three _____ in the meeting room.', options: ['person', 'persons', 'people', 'peoples'], answer: 2, explain: 'person 的常用複數是 people。persons 只用在法律等正式文件。' },
      { type: 'choice', q: 'We need to buy new _____ for the lab.', options: ['equipments', 'equipment', 'an equipment', 'equipment\'s'], answer: 1, explain: 'equipment 不可數。要強調數量說 pieces of equipment。' },
      { type: 'order', tokens: ['I', 'bought', 'two', 'tickets', 'for', 'the', 'concert'], answer: 'I bought two tickets for the concert', zh: '我買了兩張演唱會的票。' },
      { type: 'correct', wrong: 'She has long hairs.', answer: 'She has long hair.', explain: 'hair 指整頭頭髮時不可數。hairs 是「幾根毛髮」，語感很奇怪。' },
      { type: 'correct', wrong: 'I need umbrella.', answer: 'I need an umbrella.', explain: '單數可數名詞前面必須有限定詞，母音開頭用 an。' }
    ]
  },

  {
    id: 'g06',
    band: 'B1',
    title: '冠詞：a / an / the / 不放',
    pattern: '第一次提到 → a/an　|　雙方都知道哪一個 → the　|　泛指複數/不可數 → 不放',
    summary: '中文沒有冠詞，所以這是台灣學習者最持久的錯誤來源。抓住「聽的人知不知道我指哪一個」這個判準。',
    explain: [
      '**a / an**：第一次提到、聽的人還不知道是哪一個。`I bought a book.`（哪本？你還不知道）',
      '**the**：雙方都知道指哪一個——已經提過、現場只有一個、或用後面的資訊限定住了。`The book was expensive.`（剛剛講的那本）',
      '**不放冠詞**：泛指一整類（用複數）或不可數名詞。`Engineers write code.`（工程師這種人都寫程式）',
      'a 和 an 看**發音**不是拼字：`an hour`（h 不發音）、`a university`（發 /juː/ 像 y）。'
    ],
    examples: [
      { en: 'I saw a dog. The dog was huge.', zh: '我看到一隻狗。那隻狗很大。', note: '第一次 a，第二次 the' },
      { en: 'Please close the door.', zh: '請把門關上。', note: '現場只有一扇門，雙方都知道' },
      { en: 'Cars are expensive in Taiwan.', zh: '台灣的車很貴。', note: '泛指整類 → 複數不加冠詞' },
      { en: 'She is an engineer at the company.', zh: '她是那家公司的工程師。', note: 'an engineer 泛指身分；the company 特定那家' }
    ],
    pitfalls: [
      '完全不放冠詞（中文直譯）：❌ `I am engineer.` → ✅ `I am an engineer.`',
      '泛指時多放 the：❌ `The dogs are loyal.`（想講「狗很忠誠」）→ ✅ `Dogs are loyal.`',
      'a/an 判斷看拼字而非發音：❌ `a hour` → ✅ `an hour`。'
    ],
    drills: [
      { type: 'choice', q: 'It took me _____ hour to finish.', options: ['a', 'an', 'the', '—'], answer: 1, explain: 'hour 的 h 不發音，開頭是母音 /aʊ/，用 an。' },
      { type: 'choice', q: 'Could you pass me _____ salt, please?', options: ['a', 'an', 'the', '—'], answer: 2, explain: '餐桌上的鹽罐雙方都看得到，是特定的那一罐，用 the。' },
      { type: 'choice', q: '_____ smartphones have changed how we work.', options: ['A', 'An', 'The', '—'], answer: 3, explain: '泛指智慧型手機這一整類，複數名詞前不加冠詞。' },
      { type: 'order', tokens: ['she', 'works', 'at', 'a', 'research', 'institute'], answer: 'She works at a research institute', zh: '她在一間研究機構工作。' },
      { type: 'correct', wrong: 'He is best engineer in our team.', answer: 'He is the best engineer in our team.', explain: '最高級前面一定要加 the，因為「最好的」只有一個。' },
      { type: 'correct', wrong: 'I go to the work by bus.', answer: 'I go to work by bus.', explain: 'go to work 是固定用法，不加冠詞。類似的還有 go home、go to bed。' }
    ]
  },

  {
    id: 'g07',
    band: 'B1',
    title: '介系詞 in / on / at：時間與地點',
    pattern: '大 → in　|　中 → on　|　小/點 → at',
    summary: '把 in / on / at 想成一個由大到小的漏斗，時間和地點各有一套，但邏輯一致。',
    explain: [
      '**時間**：in + 月/年/季節/世紀（in July, in 2026）→ on + 特定某天（on Monday, on May 5）→ at + 幾點鐘（at 7:30, at noon）。',
      '**地點**：in + 空間內部（in Taipei, in the room）→ on + 表面或線上（on the desk, on the second floor）→ at + 一個點或場所（at the station, at work）。',
      '記憶方式：範圍越小，用的字越短。in → on → at。',
      '例外要硬背：at night、in the morning、on time（準時）vs in time（來得及）。'
    ],
    examples: [
      { en: 'The meeting is at 3 p.m. on Friday.', zh: '會議在星期五下午三點。', note: '幾點用 at，星期幾用 on' },
      { en: 'She was born in 1995.', zh: '她 1995 年出生。', note: '年份用 in' },
      { en: 'Your bag is on the chair.', zh: '你的包在椅子上。', note: '表面接觸用 on' },
      { en: "I'll meet you at the entrance.", zh: '我在入口跟你碰面。', note: '一個定點用 at' }
    ],
    pitfalls: [
      '中文「在...上班」直譯：❌ `I am in work.` → ✅ `I am at work.`',
      '星期用 in：❌ `in Monday` → ✅ `on Monday`。',
      '樓層用 in：❌ `in the third floor` → ✅ `on the third floor`。'
    ],
    drills: [
      { type: 'choice', q: 'The store opens _____ 9 a.m.', options: ['in', 'on', 'at', 'to'], answer: 2, explain: '具體鐘點用 at。' },
      { type: 'choice', q: 'We have a holiday _____ January.', options: ['in', 'on', 'at', 'by'], answer: 0, explain: '月份用 in。' },
      { type: 'choice', q: 'The office is _____ the fifth floor.', options: ['in', 'on', 'at', 'over'], answer: 1, explain: '樓層固定用 on。' },
      { type: 'order', tokens: ['I', 'will', 'call', 'you', 'on', 'Monday', 'morning'], answer: 'I will call you on Monday morning', zh: '我星期一早上打給你。' },
      { type: 'correct', wrong: 'She arrived in the airport at 6.', answer: 'She arrived at the airport at 6.', explain: '機場當作一個地點用 at。用 in 會變成「在機場建築內部」，語感不自然。' },
      { type: 'correct', wrong: 'Please submit the form in Friday.', answer: 'Please submit the form on Friday.', explain: '星期幾用 on。' }
    ]
  },

  {
    id: 'g08',
    band: 'B1',
    title: 'There is / There are：表達「有」',
    pattern: 'There is + 單數 / 不可數　|　There are + 複數',
    summary: '中文的「有」在英文分成兩種：存在用 there is/are，擁有用 have。搞混會讓句子完全不通。',
    explain: [
      '中文「桌上有一本書」和「我有一本書」都用「有」，英文完全不同：前者是**存在**（There is a book on the desk.），後者是**擁有**（I have a book.）。',
      'be 動詞跟著 there 後面**第一個**名詞變：`There is a chair and two tables.`（跟著 a chair 用 is）',
      '過去式：There was / There were。'
    ],
    examples: [
      { en: 'There is a problem with the system.', zh: '系統有個問題。', note: '單數 → is' },
      { en: 'There are five people in the room.', zh: '房間裡有五個人。', note: '複數 → are' },
      { en: 'There was no answer.', zh: '沒有回應。', note: '過去式 was' },
      { en: 'Is there a restroom nearby?', zh: '附近有洗手間嗎？', note: '疑問句把 be 提前' }
    ],
    pitfalls: [
      '用 have 表達存在：❌ `In the room have five people.` → ✅ `There are five people in the room.`',
      '中文「這裡有」直譯：❌ `Here has a problem.` → ✅ `There is a problem here.`',
      'be 動詞沒跟著第一個名詞：❌ `There are a book and two pens.` → ✅ `There is a book and two pens.`'
    ],
    drills: [
      { type: 'choice', q: '_____ any messages for me?', options: ['Is there', 'Are there', 'Have there', 'Do there'], answer: 1, explain: 'messages 是複數，用 Are there。' },
      { type: 'choice', q: 'There _____ a lot of traffic this morning.', options: ['is', 'are', 'have', 'has'], answer: 0, explain: 'traffic 是不可數名詞，用 is。' },
      { type: 'choice', q: 'There _____ no seats left when we arrived.', options: ['is', 'are', 'was', 'were'], answer: 3, explain: '過去的事 + seats 複數 → were。' },
      { type: 'order', tokens: ['there', 'is', 'a', 'convenience', 'store', 'near', 'my', 'office'], answer: 'There is a convenience store near my office', zh: '我辦公室附近有一間便利商店。' },
      { type: 'correct', wrong: 'My city has many parks and it has a river.', answer: 'There are many parks in my city, and there is a river.', explain: '描述某地存在什麼，自然的說法是 there is/are；用 have 會像在說城市「擁有」這些東西。' },
      { type: 'correct', wrong: 'There have three options.', answer: 'There are three options.', explain: 'there 後面接 be 動詞，不接 have。' }
    ]
  },

  {
    id: 'g09',
    band: 'B1',
    title: '代名詞：主格 / 受格 / 所有格',
    pattern: 'I – me – my – mine　|　he – him – his – his',
    summary: '同一個人在句子裡的不同位置要換不同形式。位置決定形式，這點和中文完全不同。',
    explain: [
      '**主格**（動詞前）：I, you, he, she, it, we, they',
      '**受格**（動詞後、介系詞後）：me, you, him, her, it, us, them',
      '**所有格形容詞**（後面一定接名詞）：my, your, his, her, its, our, their',
      '**所有格代名詞**（後面不接名詞）：mine, yours, his, hers, ours, theirs',
      '特別注意 **its**（它的）和 **it\'s**（it is）是完全不同的東西，這是英文母語者都常錯的地方。'
    ],
    examples: [
      { en: 'She gave him her number.', zh: '她給了他她的電話。', note: 'She 主格 / him 受格 / her 所有格' },
      { en: 'This laptop is mine.', zh: '這台筆電是我的。', note: 'mine 後面不接名詞' },
      { en: 'Between you and me, the plan is risky.', zh: '你我之間說說，這計畫很冒險。', note: '介系詞 between 後面用受格' },
      { en: "It's not working. Its battery is dead.", zh: '它壞了。它的電池沒電了。', note: "It's = it is；Its = 它的" }
    ],
    pitfalls: [
      '介系詞後用主格：❌ `between you and I` → ✅ `between you and me`。',
      '所有格後面漏名詞：❌ `This is my.` → ✅ `This is mine.` 或 `This is my phone.`',
      "its / it's 互換：❌ `Its raining.` → ✅ `It's raining.`"
    ],
    drills: [
      { type: 'choice', q: 'The manager asked _____ to lead the project.', options: ['I', 'me', 'my', 'mine'], answer: 1, explain: 'asked 是動詞，後面接受格 me。' },
      { type: 'choice', q: 'Is this bag _____?', options: ['your', 'yours', 'you', 'you\'re'], answer: 1, explain: '後面沒有名詞，用所有格代名詞 yours。' },
      { type: 'choice', q: 'The company updated _____ website last month.', options: ['it\'s', 'its', 'their', 'they\'re'], answer: 1, explain: 'company 單數，所有格是 its（沒有撇號）。' },
      { type: 'order', tokens: ['she', 'showed', 'us', 'her', 'new', 'design'], answer: 'She showed us her new design', zh: '她給我們看了她的新設計。' },
      { type: 'correct', wrong: 'Him and me went to the meeting.', answer: 'He and I went to the meeting.', explain: '動詞前面是主詞位置，要用主格 He and I。' },
      { type: 'correct', wrong: 'Please send the file to Tom and I.', answer: 'Please send the file to Tom and me.', explain: '介系詞 to 後面用受格 me。把 Tom 拿掉念念看就聽得出來。' }
    ]
  },

  {
    id: 'g10',
    band: 'B1',
    title: '形容詞位置與頻率副詞',
    pattern: '形容詞 + 名詞　|　be + 形容詞　|　頻率副詞在一般動詞前、be 動詞後',
    summary: '英文形容詞放名詞前面（和中文一樣），但頻率副詞的位置有一條硬規則，錯了很明顯。',
    explain: [
      '形容詞放**名詞前**（a **difficult** problem）或**be 動詞後**（The problem is **difficult**）。兩者擇一，不能都放。',
      '頻率副詞（always, usually, often, sometimes, rarely, never）的位置：**一般動詞前面，be 動詞後面**。`I always check.` / `I am always late.`',
      '多個形容詞的順序：**意見 → 大小 → 年齡 → 顏色 → 來源 → 材質 → 名詞**。`a nice small old brown leather bag`。這個順序母語者是憑語感，不用背死，但知道有規則就不會排出怪句。'
    ],
    examples: [
      { en: 'She always arrives early.', zh: '她總是很早到。', note: '頻率副詞在一般動詞 arrives 前' },
      { en: 'He is never late for meetings.', zh: '他開會從不遲到。', note: '頻率副詞在 be 動詞 is 後' },
      { en: 'We need a reliable supplier.', zh: '我們需要一個可靠的供應商。', note: '形容詞在名詞前' },
      { en: 'I sometimes work from home.', zh: '我有時候在家工作。', note: 'sometimes 也可放句首或句尾' }
    ],
    pitfalls: [
      '頻率副詞放錯邊：❌ `I check always my email.` → ✅ `I always check my email.`',
      '形容詞加複數 s：❌ `two differents options` → ✅ `two different options`（形容詞永遠不變形）。',
      '形容詞放名詞後（中文式）：❌ `a problem difficult` → ✅ `a difficult problem`。'
    ],
    drills: [
      { type: 'choice', q: 'He _____ forgets his password.', options: ['forgets always', 'always forgets', 'forget always', 'always forget'], answer: 1, explain: '頻率副詞放一般動詞前面，主詞第三人稱單數所以是 forgets。' },
      { type: 'choice', q: 'The instructions were very _____.', options: ['confuse', 'confusing', 'confusion', 'confused'], answer: 1, explain: '說明書讓人困惑，用 -ing 形容詞 confusing。confused 是「人感到困惑」。' },
      { type: 'choice', q: 'She is _____ willing to help.', options: ['always', 'is always', 'always is', 'be always'], answer: 0, explain: 'be 動詞 is 已經在了，頻率副詞放它後面。' },
      { type: 'order', tokens: ['we', 'rarely', 'have', 'problems', 'with', 'this', 'system'], answer: 'We rarely have problems with this system', zh: '這個系統我們很少出問題。' },
      { type: 'correct', wrong: 'They have never a clear answer.', answer: 'They never have a clear answer.', explain: 'have 在這裡是一般動詞（擁有），頻率副詞要放它前面。' },
      { type: 'correct', wrong: 'I want a car red and fast.', answer: 'I want a fast red car.', explain: '形容詞放名詞前，且順序是「意見/大小 → 顏色」。' }
    ]
  }
]

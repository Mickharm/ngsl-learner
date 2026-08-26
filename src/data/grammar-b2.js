/**
 * B2 grammar — where TOEIC Part 5 actually lives. Tense contrasts, modals,
 * passive voice and the gerund/infinitive split account for a large share of
 * the grammar questions on the test.
 */

export default [
  {
    id: 'g11',
    band: 'B2',
    title: '現在進行式：此刻正在發生',
    pattern: 'S + am/is/are + V-ing',
    summary: '「現在正在做」用進行式，「平常都這樣」用簡單式。這組對比是台灣學習者最需要練的第一個時態選擇。',
    explain: [
      '`I work at ITRI.`（我在 ITRI 上班——長期事實）vs `I am working on a report.`（我正在寫一份報告——此刻的動作）。',
      '進行式也用在**暫時的狀態**：`He is staying with his parents this month.`（暫時住，不是長住）',
      '**狀態動詞不用進行式**：know, believe, understand, want, need, like, own, belong。❌ `I am knowing him.` → ✅ `I know him.`',
      '進行式加上未來時間詞就變成「已排定的未來」：`I am meeting the client tomorrow.`'
    ],
    examples: [
      { en: 'She is reviewing the contract right now.', zh: '她正在審合約。', note: '此刻的動作' },
      { en: 'They are working on a new feature this quarter.', zh: '他們這一季在做新功能。', note: '一段期間內持續進行' },
      { en: 'We are flying to Osaka on Friday.', zh: '我們星期五飛大阪。', note: '已訂好的未來安排' },
      { en: 'I understand your point.', zh: '我懂你的意思。', note: 'understand 是狀態動詞，不用進行式' }
    ],
    pitfalls: [
      '狀態動詞用進行式：❌ `I am wanting a coffee.` → ✅ `I want a coffee.`',
      '漏掉 be 動詞：❌ `He working now.` → ✅ `He is working now.`',
      '習慣用進行式：❌ `I am going to work by MRT every day.` → ✅ `I go to work by MRT every day.`'
    ],
    drills: [
      { type: 'choice', q: 'Please be quiet. The team _____ a video call.', options: ['has', 'is having', 'have', 'having'], answer: 1, explain: '此刻正在進行，用現在進行式。have a call 這裡是動作不是狀態，可以進行式。' },
      { type: 'choice', q: 'I _____ what you mean, but I disagree.', options: ['am understanding', 'understand', 'understands', 'am understand'], answer: 1, explain: 'understand 是狀態動詞，不能用進行式。' },
      { type: 'choice', q: 'He usually _____ lunch at his desk, but today he _____ out.', options: ['eats / eats', 'is eating / eats', 'eats / is eating', 'is eating / is eating'], answer: 2, explain: 'usually 配簡單式，today（此刻的例外）配進行式。' },
      { type: 'order', tokens: ['they', 'are', 'testing', 'the', 'new', 'system', 'this', 'week'], answer: 'They are testing the new system this week', zh: '他們這週在測試新系統。' },
      { type: 'correct', wrong: 'Look! The printer is not work.', answer: 'Look! The printer is not working.', explain: '進行式的動詞要加 -ing。' },
      { type: 'correct', wrong: 'I am belonging to the engineering team.', answer: 'I belong to the engineering team.', explain: 'belong 是狀態動詞，只用簡單式。' }
    ]
  },

  {
    id: 'g12',
    band: 'B2',
    title: '過去進行式：過去某刻正在進行',
    pattern: 'S + was/were + V-ing　（常搭配 when / while）',
    summary: '用來當「背景」：某件事正在進行時，另一件事插進來。',
    explain: [
      '典型結構：**長動作用過去進行式當背景，短動作用過去簡單式插入**。`I was driving when the phone rang.`',
      '`when` 後面通常接**短事件**（過去簡單式），`while` 後面通常接**長背景**（過去進行式）。',
      '兩件事同時持續，兩邊都用過去進行式：`While she was cooking, I was cleaning.`'
    ],
    examples: [
      { en: 'I was working late when the power went out.', zh: '我在加班時停電了。', note: '背景 + 插入事件' },
      { en: 'While we were waiting, the flight was cancelled.', zh: '我們等的時候，班機被取消了。', note: 'While + 進行式' },
      { en: 'What were you doing at 8 p.m. yesterday?', zh: '你昨天晚上八點在做什麼？', note: '問過去某個時間點的狀態' },
      { en: 'They were arguing about the budget all morning.', zh: '他們整個早上都在吵預算。', note: '持續一段時間' }
    ],
    pitfalls: [
      '兩件事都用簡單式，失去「正在進行」的語感：❌ `I drove when the phone rang.`（變成兩件事先後發生）',
      'when / while 用反：❌ `While the phone rang, I was driving.` 語感很怪。',
      '狀態動詞一樣不能用進行式：❌ `I was knowing the answer.` → ✅ `I knew the answer.`'
    ],
    drills: [
      { type: 'choice', q: 'She _____ a presentation when her laptop crashed.', options: ['gave', 'was giving', 'is giving', 'has given'], answer: 1, explain: '簡報是進行中的長動作，當機是插入的短事件。' },
      { type: 'choice', q: 'While I _____ dinner, someone knocked on the door.', options: ['cook', 'cooked', 'was cooking', 'have cooked'], answer: 2, explain: 'While 後面接持續中的背景動作，用過去進行式。' },
      { type: 'choice', q: 'They _____ for the bus when it started to rain.', options: ['wait', 'waited', 'were waiting', 'have waited'], answer: 2, explain: '等車是背景，下雨是插入事件。' },
      { type: 'order', tokens: ['I', 'was', 'reading', 'the', 'manual', 'when', 'you', 'called'], answer: 'I was reading the manual when you called', zh: '你打來的時候我正在看手冊。' },
      { type: 'correct', wrong: 'While he was drive, he was listening to a podcast.', answer: 'While he was driving, he was listening to a podcast.', explain: '進行式動詞要加 -ing。' },
      { type: 'correct', wrong: 'I was seeing him at the station yesterday.', answer: 'I saw him at the station yesterday.', explain: 'see 表「看見」是狀態動詞，用過去簡單式。' }
    ]
  },

  {
    id: 'g13',
    band: 'B2',
    title: '未來式：will 與 be going to',
    pattern: 'will + 原形　|　be going to + 原形',
    summary: '兩個都是未來，但語感不同：will 是「此刻決定 / 預測」，be going to 是「早就打算好 / 有跡象」。',
    explain: [
      '**will**：說話當下才決定（`The phone is ringing — I\'ll get it.`）、承諾（`I\'ll send it tonight.`）、單純預測（`It will rain tomorrow.`）。',
      '**be going to**：講話前就已經有計畫（`I\'m going to apply for that job.`）、或現在就有證據可推論（`Look at those clouds — it\'s going to rain.`）。',
      '**現在進行式**也能表未來，語感是「已經安排好、幾乎確定」：`I\'m meeting him at 3.` 三者的確定度：現在進行式 > be going to > will。',
      '時間副詞子句（when / if / after / before / as soon as）裡面**不能用 will**，要用現在式代替未來：`I\'ll call you when I arrive.`（不是 when I will arrive）'
    ],
    examples: [
      { en: "I'll help you with that.", zh: '我來幫你。', note: '當下決定' },
      { en: "We're going to launch in March.", zh: '我們預計三月上線。', note: '既定計畫' },
      { en: "Be careful — you're going to drop it.", zh: '小心，你要掉了。', note: '眼前的跡象' },
      { en: "I'll let you know as soon as I hear back.", zh: '我一有回音就通知你。', note: 'as soon as 子句用現在式' }
    ],
    pitfalls: [
      '時間子句用 will：❌ `I will call you when I will arrive.` → ✅ `...when I arrive.`',
      'will 後面加 to：❌ `I will to go.` → ✅ `I will go.`',
      '既定計畫用 will 顯得很隨便：`We will launch in March.` 語感像剛剛才想到。'
    ],
    drills: [
      { type: 'choice', q: 'I\'ll send the file as soon as I _____ back to the office.', options: ['will get', 'get', 'am getting', 'got'], answer: 1, explain: 'as soon as 引導的時間子句不用 will，用現在簡單式。' },
      { type: 'choice', q: 'She has already booked the tickets. She _____ to Kyoto next month.', options: ['will fly', 'is going to fly', 'flies', 'flew'], answer: 1, explain: '已經訂好票 = 既定計畫，用 be going to。' },
      { type: 'choice', q: 'A: The report is missing. B: Don\'t worry, I _____ it again.', options: ['am going to print', 'print', 'will print', 'printed'], answer: 2, explain: '聽到問題當下才決定要做，用 will。' },
      { type: 'order', tokens: ['we', 'are', 'going', 'to', 'move', 'the', 'server', 'next', 'week'], answer: 'We are going to move the server next week', zh: '我們下週要搬伺服器。' },
      { type: 'correct', wrong: 'If it will rain, we will cancel the trip.', answer: 'If it rains, we will cancel the trip.', explain: 'if 子句裡不用 will，用現在簡單式表未來。' },
      { type: 'correct', wrong: 'I will to check the schedule.', answer: 'I will check the schedule.', explain: 'will 是助動詞，後面直接接原形動詞，沒有 to。' }
    ]
  },

  {
    id: 'g14',
    band: 'B2',
    title: '現在完成式：過去連到現在',
    pattern: 'S + have/has + 過去分詞',
    summary: '中文沒有對應時態，所以最難。判準：這件事的「時間點」重不重要？不重要、只在乎結果或經驗 → 現在完成式。',
    explain: [
      '**三種用法**：① 經驗（`I have been to Japan twice.`）② 到現在為止的持續（`She has worked here for five years.`）③ 過去動作造成現在的結果（`I have lost my keys.` — 現在還找不到）。',
      '**關鍵對比**：有明確過去時間點 → 過去式；沒有或不重要 → 現在完成式。`I saw him yesterday.` vs `I have seen him before.`',
      '**for / since**：for + 一段時間（for three years），since + 起點（since 2020）。',
      '❌ 現在完成式**不能**和 yesterday、last week、in 2020、ago 這類明確過去時間連用。'
    ],
    examples: [
      { en: 'I have finished the report.', zh: '報告我寫完了。', note: '現在的結果：可以交了' },
      { en: 'He has lived in Tainan since 2019.', zh: '他 2019 年起就住台南。', note: '持續到現在' },
      { en: 'Have you ever tried natto?', zh: '你吃過納豆嗎？', note: '經驗，ever 常搭配' },
      { en: 'She has just left.', zh: '她剛走。', note: 'just / already / yet 常配現在完成式' }
    ],
    pitfalls: [
      '配明確過去時間：❌ `I have seen him yesterday.` → ✅ `I saw him yesterday.`',
      'for / since 混用：❌ `since three years` → ✅ `for three years`。',
      '中文「我去過日本」直翻成過去式：`I went to Japan.` 語感是「我那次去了」，講經驗要用 `I have been to Japan.`'
    ],
    drills: [
      { type: 'choice', q: 'She _____ for this company since 2018.', options: ['works', 'worked', 'has worked', 'is working'], answer: 2, explain: 'since + 起點，且持續到現在，用現在完成式。' },
      { type: 'choice', q: 'I _____ my phone. I can\'t find it anywhere.', options: ['lose', 'lost', 'have lost', 'am losing'], answer: 2, explain: '過去的動作造成現在找不到的結果，用現在完成式。' },
      { type: 'choice', q: 'We _____ the contract last Monday.', options: ['have signed', 'signed', 'have sign', 'are signing'], answer: 1, explain: 'last Monday 是明確過去時間，必須用過去簡單式。' },
      { type: 'choice', q: 'Have you _____ the new policy yet?', options: ['read', 'reading', 'reads', 'to read'], answer: 0, explain: 'have + 過去分詞。read 的過去分詞拼法相同（發音為 /red/）。' },
      { type: 'order', tokens: ['I', 'have', 'never', 'been', 'to', 'Europe'], answer: 'I have never been to Europe', zh: '我從沒去過歐洲。' },
      { type: 'correct', wrong: 'He has joined the team three months ago.', answer: 'He joined the team three months ago.', explain: 'ago 表示明確的過去時間，要用過去簡單式。' }
    ]
  },

  {
    id: 'g15',
    band: 'B2',
    title: '比較級與最高級',
    pattern: '短字 + -er / -est　|　長字 more / most　|　than / the',
    summary: '短的字加字尾，長的字加 more/most。最高級前面一定有 the。',
    explain: [
      '**一到兩音節**：加 -er / -est（fast → faster → fastest；easy → easier → easiest）。',
      '**三音節以上**：用 more / most（expensive → more expensive → most expensive）。',
      '**不規則**要背：good → better → best；bad → worse → worst；many/much → more → most；little → less → least。',
      '比較兩者用 **than**；最高級前面用 **the**：`This is the most expensive option.`',
      '「越來越...」：`more and more expensive` / `hotter and hotter`。「越...越...」：`The more you practice, the better you get.`'
    ],
    examples: [
      { en: 'This method is faster than the old one.', zh: '這個方法比舊的快。', note: '短字 -er + than' },
      { en: 'It is the most reliable sensor we have tested.', zh: '這是我們測過最可靠的感測器。', note: '長字 the most' },
      { en: 'Her English is better than mine.', zh: '她的英文比我好。', note: 'good 的不規則比較級' },
      { en: 'The more I practice, the more confident I feel.', zh: '我越練習就越有信心。', note: '「越...越...」句型' }
    ],
    pitfalls: [
      '雙重比較：❌ `more faster` → ✅ `faster`。',
      '比較級用 the：❌ `He is the taller than me.` → ✅ `He is taller than me.`',
      '最高級漏 the：❌ `This is best solution.` → ✅ `This is the best solution.`',
      '❌ `than me / than I` 兩種都有人用，口語 than me 就好，不用糾結。'
    ],
    drills: [
      { type: 'choice', q: 'This solution is _____ than the previous one.', options: ['more cheap', 'cheaper', 'cheapest', 'the cheaper'], answer: 1, explain: 'cheap 是單音節，比較級加 -er，且比較級不加 the。' },
      { type: 'choice', q: 'It was _____ meeting of the year.', options: ['longest', 'the longest', 'more long', 'longer'], answer: 1, explain: '最高級前面必須有 the。' },
      { type: 'choice', q: 'The new system is much _____ to maintain.', options: ['easy', 'easier', 'more easy', 'easiest'], answer: 1, explain: 'much 修飾比較級；easy 以子音+y 結尾，變 easier。' },
      { type: 'choice', q: 'Traffic gets _____ every year.', options: ['bad and bad', 'worse and worse', 'more bad', 'the worst'], answer: 1, explain: 'bad 的比較級是 worse，「越來越」用「比較級 and 比較級」。' },
      { type: 'order', tokens: ['this', 'is', 'the', 'best', 'option', 'for', 'us'], answer: 'This is the best option for us', zh: '這對我們是最好的選項。' },
      { type: 'correct', wrong: 'My new phone is more better than my old one.', answer: 'My new phone is better than my old one.', explain: 'better 本身已是比較級，不能再加 more。' }
    ]
  },

  {
    id: 'g16',
    band: 'B2',
    title: '情態動詞：can / should / must / may',
    pattern: '情態動詞 + 原形動詞（永遠不加 s、不加 to）',
    summary: '表達「能力、義務、可能性、禮貌」。後面永遠接原形，這是零例外的規則。',
    explain: [
      '**can / could**：能力、可能、請求。could 比 can 客氣。',
      '**should / ought to**：建議（不是強制）。`You should check the log first.`',
      '**must / have to**：must 多半是說話者自己認為的強制；have to 是外在規定。否定差很多：`must not` = 禁止；`don\'t have to` = 不必。',
      '**may / might**：可能性（might 更不確定）、正式的請求許可。',
      '**推測**：`He must be tired.`（很確定）> `He may/might be tired.`（有可能）> `He can\'t be tired.`（不可能）。'
    ],
    examples: [
      { en: 'You should back up the data first.', zh: '你應該先備份資料。', note: '建議' },
      { en: 'Visitors must wear a badge.', zh: '訪客必須配戴識別證。', note: '規定，強制' },
      { en: "You don't have to come to the meeting.", zh: '你不必來開會。', note: '不必 ≠ 禁止' },
      { en: 'Could you send me the link?', zh: '可以把連結給我嗎？', note: 'could 比 can 客氣' }
    ],
    pitfalls: [
      '情態動詞後加 to：❌ `You should to go.` → ✅ `You should go.`',
      '第三人稱加 s：❌ `He cans swim.` → ✅ `He can swim.`',
      'must not / don\'t have to 混用：`You must not park here.`（禁止停）vs `You don\'t have to park here.`（不用停這）意思完全不同。',
      '兩個情態動詞連用：❌ `will can` → ✅ `will be able to`。'
    ],
    drills: [
      { type: 'choice', q: 'Employees _____ submit their reports by Friday.', options: ['must to', 'must', 'musts', 'must be'], answer: 1, explain: '情態動詞後直接接原形，沒有 to。' },
      { type: 'choice', q: 'You _____ worry — everything is under control.', options: ['must not', "don't have to", 'should not to', 'not need'], answer: 1, explain: '「不必擔心」用 don\'t have to。must not 是「禁止」，語氣完全不對。' },
      { type: 'choice', q: 'She left an hour ago, so she _____ be home by now.', options: ['can', 'should', 'must not', 'may not'], answer: 1, explain: 'should 也可表示合理推測「應該已經到了」。' },
      { type: 'choice', q: 'After the training, you _____ operate the machine alone.', options: ['will can', 'will be able to', 'can will', 'able to'], answer: 1, explain: '兩個情態動詞不能連用，未來的能力用 will be able to。' },
      { type: 'order', tokens: ['you', 'should', 'check', 'the', 'settings', 'again'], answer: 'You should check the settings again', zh: '你應該再檢查一次設定。' },
      { type: 'correct', wrong: 'He can to speak three languages.', answer: 'He can speak three languages.', explain: 'can 後面接原形動詞，不加 to。' }
    ]
  },

  {
    id: 'g17',
    band: 'B2',
    title: '被動語態：把重點放在「被做的事」',
    pattern: 'S + be + 過去分詞 (+ by 執行者)',
    summary: '當「誰做的」不重要、不知道、或不想講時，用被動。商業與技術文件大量使用。',
    explain: [
      '主動：`The team completed the project.` → 被動：`The project was completed by the team.`',
      '**be 動詞決定時態**，過去分詞不變：is done / was done / will be done / has been done / is being done。',
      '執行者不重要時直接省略 by：`The server was restarted.`（誰重啟的不重要）',
      'TOEIC 高頻考點：看到主詞是「被動作用的對象」就要用被動。`The report ___ yesterday.` → was submitted，不是 submitted。'
    ],
    examples: [
      { en: 'The samples are tested every week.', zh: '樣本每週都會受測。', note: '現在被動' },
      { en: 'The meeting was rescheduled.', zh: '會議改期了。', note: '過去被動，執行者省略' },
      { en: 'Your order will be shipped tomorrow.', zh: '您的訂單明天出貨。', note: '未來被動' },
      { en: 'The system has been updated.', zh: '系統已更新。', note: '完成式被動' }
    ],
    pitfalls: [
      '漏掉 be 動詞：❌ `The report submitted yesterday.` → ✅ `The report was submitted yesterday.`',
      '用過去式而非過去分詞：❌ `It was wrote by him.` → ✅ `It was written by him.`',
      '不及物動詞硬轉被動：❌ `The accident was happened.` → ✅ `The accident happened.`（happen 沒有被動）'
    ],
    drills: [
      { type: 'choice', q: 'The new policy _____ next month.', options: ['will announce', 'will be announced', 'will announcing', 'announces'], answer: 1, explain: '政策是被宣布的對象，未來被動用 will be + 過去分詞。' },
      { type: 'choice', q: 'All applications _____ by a committee.', options: ['review', 'reviews', 'are reviewed', 'are reviewing'], answer: 2, explain: '申請書是被審查的對象，用被動。' },
      { type: 'choice', q: 'The bug _____ in the latest release.', options: ['has fixed', 'has been fixed', 'have fixed', 'is fixing'], answer: 1, explain: '完成式被動：has been + 過去分詞。' },
      { type: 'choice', q: 'The earthquake _____ at 3 a.m.', options: ['was occurred', 'occurred', 'is occurred', 'has been occurred'], answer: 1, explain: 'occur 是不及物動詞，沒有被動形式。' },
      { type: 'order', tokens: ['the', 'documents', 'were', 'sent', 'to', 'the', 'client'], answer: 'The documents were sent to the client', zh: '文件已寄給客戶。' },
      { type: 'correct', wrong: 'The problem was solve by our team.', answer: 'The problem was solved by our team.', explain: '被動要用過去分詞 solved，不是原形。' }
    ]
  },

  {
    id: 'g18',
    band: 'B2',
    title: '不定詞 vs 動名詞：to V 還是 V-ing',
    pattern: '動詞 + to V　|　動詞 + V-ing　|　介系詞 + V-ing',
    summary: '沒有萬用邏輯，只能記住哪些動詞接哪一種。但有一條零例外的規則：介系詞後面永遠接 V-ing。',
    explain: [
      '**只接 to V**：want, need, decide, plan, hope, agree, promise, offer, refuse, learn, manage, afford, expect。',
      '**只接 V-ing**：enjoy, finish, avoid, mind, suggest, consider, practice, keep, quit, admit, deny, recommend。',
      '**介系詞後永遠 V-ing**（零例外）：`good at solving`、`interested in learning`、`instead of waiting`。注意 `look forward to` 的 to 是**介系詞**，所以是 `look forward to hearing`。',
      '**意思會變的**：`stop to smoke`（停下來去抽菸）vs `stop smoking`（戒菸）；`remember to lock`（記得要鎖）vs `remember locking`（記得鎖過了）。'
    ],
    examples: [
      { en: 'We decided to postpone the launch.', zh: '我們決定延後上線。', note: 'decide + to V' },
      { en: 'She avoided answering the question.', zh: '她避而不答。', note: 'avoid + V-ing' },
      { en: 'I look forward to working with you.', zh: '期待與你共事。', note: 'to 是介系詞 → V-ing' },
      { en: 'He stopped checking his email at night.', zh: '他不再在晚上收信了。', note: 'stop + V-ing = 停止做那件事' }
    ],
    pitfalls: [
      '`look forward to` 後面用原形：❌ `look forward to hear from you` → ✅ `look forward to hearing from you`。',
      '介系詞後用 to V：❌ `interested in to learn` → ✅ `interested in learning`。',
      '❌ `I suggest to go early.` → ✅ `I suggest going early.`',
      '❌ `I enjoy to read.` → ✅ `I enjoy reading.`'
    ],
    drills: [
      { type: 'choice', q: 'We are considering _____ the deadline.', options: ['to extend', 'extending', 'extend', 'extended'], answer: 1, explain: 'consider 後面接動名詞。' },
      { type: 'choice', q: 'She refused _____ the offer.', options: ['accepting', 'accept', 'to accept', 'accepted'], answer: 2, explain: 'refuse 後面接不定詞 to V。' },
      { type: 'choice', q: 'I look forward to _____ from you.', options: ['hear', 'hearing', 'heard', 'be hearing'], answer: 1, explain: 'look forward to 的 to 是介系詞，後接動名詞。這是 TOEIC 常考陷阱。' },
      { type: 'choice', q: 'He is good at _____ complex problems.', options: ['solve', 'to solve', 'solving', 'solved'], answer: 2, explain: '介系詞 at 後面接動名詞。' },
      { type: 'order', tokens: ['they', 'agreed', 'to', 'share', 'the', 'cost'], answer: 'They agreed to share the cost', zh: '他們同意分攤費用。' },
      { type: 'correct', wrong: 'I finished to write the report.', answer: 'I finished writing the report.', explain: 'finish 後面接動名詞 V-ing。' }
    ]
  },

  {
    id: 'g19',
    band: 'B2',
    title: '連接詞：and / but / because / so / although',
    pattern: '子句 + 連接詞 + 子句',
    summary: '把短句接成長句的基本工具。中文的「雖然...但是...」在英文只能留一個。',
    explain: [
      '**and**（並列）、**but**（轉折）、**or**（選擇）、**so**（結果）、**because**（原因）、**although / though**（讓步）。',
      '**中文式雙連接詞是最大陷阱**：中文說「雖然下雨，但是我們還是去了」，英文只能留一個：`Although it rained, we still went.` ❌ 不能寫 `Although..., but...`。',
      '同理：❌ `Because..., so...` → 只能留一個。',
      '`because` 接**子句**（主詞+動詞），`because of` 接**名詞**：`because it rained` vs `because of the rain`。'
    ],
    examples: [
      { en: 'The design is simple but effective.', zh: '設計簡單卻有效。', note: 'but 連接兩個形容詞' },
      { en: 'We delayed the launch because the tests failed.', zh: '因為測試沒過，我們延後上線。', note: 'because + 子句' },
      { en: 'The flight was cancelled because of the typhoon.', zh: '因為颱風，班機取消了。', note: 'because of + 名詞' },
      { en: 'Although the budget is tight, we can still do it.', zh: '雖然預算很緊，我們還是做得到。', note: 'Although 開頭，後半不加 but' }
    ],
    pitfalls: [
      '❌ `Although it was late, but he kept working.` → ✅ 去掉 but。',
      '❌ `Because he was sick, so he stayed home.` → ✅ 去掉 so。',
      '❌ `because of it rained` → ✅ `because it rained` 或 `because of the rain`。'
    ],
    drills: [
      { type: 'choice', q: '_____ the price is high, the quality is excellent.', options: ['Although', 'Because', 'So', 'But'], answer: 0, explain: '前後是轉折關係，用 Although 引導讓步子句。' },
      { type: 'choice', q: 'The event was postponed _____ bad weather.', options: ['because', 'because of', 'although', 'so'], answer: 1, explain: 'bad weather 是名詞片語，要用 because of。' },
      { type: 'choice', q: 'He studied hard, _____ he passed the exam.', options: ['because', 'although', 'so', 'but'], answer: 2, explain: '前因後果，用 so 引導結果。' },
      { type: 'order', tokens: ['we', 'left', 'early', 'because', 'the', 'traffic', 'was', 'heavy'], answer: 'We left early because the traffic was heavy', zh: '因為交通壅塞，我們提早出發。' },
      { type: 'correct', wrong: 'Although he is busy, but he always replies.', answer: 'Although he is busy, he always replies.', explain: '英文的 although 和 but 不能同時出現，這是中文直譯造成的錯誤。' },
      { type: 'correct', wrong: 'Because of he was late, we started without him.', answer: 'Because he was late, we started without him.', explain: '後面是完整子句，要用 because 不是 because of。' }
    ]
  },

  {
    id: 'g20',
    band: 'B2',
    title: '時間子句：when / before / after / until / while',
    pattern: '時間連接詞 + 子句（未來時用現在式）',
    summary: '時間子句裡不用未來式，這是 TOEIC 的固定考點。',
    explain: [
      '**核心規則**：when / before / after / until / as soon as / once 引導的時間子句裡，**用現在簡單式代替未來式**。`I\'ll call you when I get there.`',
      '**until**（直到）常和否定搭配：`Don\'t start until I tell you.`',
      '**by the time**（到...的時候）後面也用現在式，主句常用未來完成式：`By the time you arrive, we will have finished.`',
      '子句放句首時後面加逗號，放句尾則不加：`After I finish, I will leave.` / `I will leave after I finish.`'
    ],
    examples: [
      { en: "I'll text you as soon as I land.", zh: '我一落地就傳訊息給你。', note: 'as soon as + 現在式' },
      { en: 'Please wait until the light turns green.', zh: '請等到燈變綠。', note: 'until + 現在式' },
      { en: 'After she left, the room felt empty.', zh: '她走後房間顯得很空。', note: '過去的時間子句正常用過去式' },
      { en: "Before you submit, check the format.", zh: '送出前先檢查格式。', note: '祈使句 + 時間子句' }
    ],
    pitfalls: [
      '時間子句用 will：❌ `when I will arrive` → ✅ `when I arrive`。',
      'until / by 混用：`until` 是「持續到」，`by` 是「不晚於」。`Finish it by Friday.`（星期五前完成）',
      '❌ `Until you will come, I wait.` → ✅ `I will wait until you come.`'
    ],
    drills: [
      { type: 'choice', q: 'We will start the meeting when everyone _____.', options: ['will arrive', 'arrives', 'arrived', 'is arriving'], answer: 1, explain: '時間子句用現在簡單式表未來。' },
      { type: 'choice', q: 'Please submit the form _____ Friday.', options: ['until', 'by', 'since', 'during'], answer: 1, explain: '「在期限前完成」用 by。until 是「持續到」，語意不對。' },
      { type: 'choice', q: 'Don\'t open the door _____ the machine stops.', options: ['until', 'by', 'since', 'while'], answer: 0, explain: 'until = 直到...為止，配合否定表示「在那之前都不要」。' },
      { type: 'choice', q: 'By the time we _____ there, the store had closed.', options: ['get', 'got', 'will get', 'are getting'], answer: 1, explain: '主句是過去完成式，時間子句用過去簡單式。' },
      { type: 'order', tokens: ['I', 'will', 'let', 'you', 'know', 'after', 'I', 'check'], answer: 'I will let you know after I check', zh: '我確認後告訴你。' },
      { type: 'correct', wrong: 'As soon as he will finish, we will leave.', answer: 'As soon as he finishes, we will leave.', explain: '時間子句不用 will，改用現在簡單式。' }
    ]
  }
]

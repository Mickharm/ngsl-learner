/**
 * Essentials — word forms.
 *
 * Closed grammatical sets. The teaching layer here is fixed and offline on
 * purpose: explanations and tables have to be right every time. Practice on
 * top of them is generated (see lib/gemini.js generateDrills), so a unit never
 * runs out of questions.
 */

export default [
  {
    id: 'e05',
    group: 'pronoun',
    title: '人稱代名詞全表：I / me / my / mine',
    summary: '同一個人在句子的不同位置要換不同形式。位置決定形式，這是中文完全沒有的負擔。',
    intro: [
      '**主格**（動詞前，誰做的）：I, you, he, she, it, we, they',
      '**受格**（動詞後、介系詞後，被做的）：me, you, him, her, it, us, them',
      '**所有格形容詞**（後面一定接名詞）：my, your, his, her, its, our, their',
      '**所有格代名詞**（後面不接名詞）：mine, yours, his, hers, ours, theirs',
      '**反身代名詞**（自己）：myself, yourself, himself, herself, itself, ourselves, themselves',
      '判斷技巧：把句子拆到只剩一個人試試看。`Please send it to Tom and ___` → 拿掉 Tom 唸唸看，`send it to I` 很怪，所以是 **me**。'
    ],
    table: {
      caption: '完整對照表',
      head: ['主格', '受格', '所有格形容詞', '所有格代名詞', '反身'],
      rows: [
        ['I', 'me', 'my', 'mine', 'myself'],
        ['you', 'you', 'your', 'yours', 'yourself'],
        ['he', 'him', 'his', 'his', 'himself'],
        ['she', 'her', 'her', 'hers', 'herself'],
        ['it', 'it', 'its', '—', 'itself'],
        ['we', 'us', 'our', 'ours', 'ourselves'],
        ['they', 'them', 'their', 'theirs', 'themselves']
      ]
    },
    pitfalls: [
      '❌ `between you and I` → ✅ `between you and me`（介系詞後用受格）',
      '❌ `Him and me went` → ✅ `He and I went`（動詞前用主格）',
      "❌ `Its raining` → ✅ `It's raining`（its = 它的，it's = it is）",
      '❌ `This is my.` → ✅ `This is mine.`（後面沒名詞就用所有格代名詞）',
      'he 的所有格和所有格代名詞都是 **his**，這個沒有變化。'
    ],
    drills: [
      { type: 'choice', q: 'The manager asked _____ to lead the project.', options: ['I', 'me', 'my', 'mine'], answer: 1, explain: 'asked 後面是受詞位置，用受格 me。' },
      { type: 'choice', q: 'Is this laptop _____?', options: ['your', 'yours', 'you', "you're"], answer: 1, explain: '後面沒有名詞，用所有格代名詞 yours。' },
      { type: 'choice', q: 'She and _____ finished the report together.', options: ['me', 'I', 'my', 'mine'], answer: 1, explain: '在動詞 finished 前面，是主詞位置，用主格 I。' },
      { type: 'sort', prompt: '把這些字放進正確的欄位', buckets: ['主格', '受格', '所有格'],
        items: [
          { t: 'they', b: '主格' }, { t: 'them', b: '受格' }, { t: 'their', b: '所有格' },
          { t: 'she', b: '主格' }, { t: 'her', b: '受格' }, { t: 'our', b: '所有格' }
        ] },
      { type: 'correct', wrong: 'Please send the file to Tom and I.', answer: 'Please send the file to Tom and me.', explain: '介系詞 to 後面用受格。把 Tom 拿掉就聽得出來。' },
      { type: 'correct', wrong: 'The company updated it\'s website.', answer: 'The company updated its website.', explain: "its 是所有格（沒有撇號）；it's 是 it is。" }
    ]
  },

  {
    id: 'e06',
    group: 'verb',
    title: '不規則動詞三態（核心 40）',
    summary: '英文最高頻的動詞幾乎全是不規則的。這 40 個背完，過去式和完成式就通了大半。',
    intro: [
      '三態＝**原形 / 過去式 / 過去分詞**。過去式用在過去簡單式；過去分詞用在完成式（have + p.p.）和被動語態（be + p.p.）。',
      '有規律可循的幾組：',
      '**AAA 三態同形**：cut, put, let, set, cost, hit, hurt, read（read 的過去式唸 /red/）',
      '**ABA 頭尾同形**：come-came-come, run-ran-run, become-became-become',
      '**ABB 後兩個同形**：buy-bought-bought, bring-brought-brought, teach-taught-taught, think-thought-thought',
      '**ABC 三個都不同**：go-went-gone, take-took-taken, write-wrote-written, speak-spoke-spoken'
    ],
    table: {
      caption: '核心不規則動詞',
      head: ['原形', '過去式', '過去分詞', '中文'],
      rows: [
        ['be', 'was / were', 'been', '是'],
        ['have', 'had', 'had', '有'],
        ['do', 'did', 'done', '做'],
        ['go', 'went', 'gone', '去'],
        ['come', 'came', 'come', '來'],
        ['take', 'took', 'taken', '拿'],
        ['make', 'made', 'made', '製作'],
        ['get', 'got', 'gotten / got', '得到'],
        ['give', 'gave', 'given', '給'],
        ['see', 'saw', 'seen', '看見'],
        ['know', 'knew', 'known', '知道'],
        ['think', 'thought', 'thought', '想'],
        ['say', 'said', 'said', '說'],
        ['tell', 'told', 'told', '告訴'],
        ['find', 'found', 'found', '找到'],
        ['buy', 'bought', 'bought', '買'],
        ['bring', 'brought', 'brought', '帶來'],
        ['teach', 'taught', 'taught', '教'],
        ['write', 'wrote', 'written', '寫'],
        ['speak', 'spoke', 'spoken', '說話'],
        ['eat', 'ate', 'eaten', '吃'],
        ['drink', 'drank', 'drunk', '喝'],
        ['leave', 'left', 'left', '離開'],
        ['send', 'sent', 'sent', '寄'],
        ['pay', 'paid', 'paid', '付'],
        ['read', 'read /red/', 'read /red/', '讀'],
        ['put', 'put', 'put', '放'],
        ['cut', 'cut', 'cut', '切'],
        ['cost', 'cost', 'cost', '花費'],
        ['lose', 'lost', 'lost', '遺失'],
        ['meet', 'met', 'met', '見面'],
        ['sit', 'sat', 'sat', '坐'],
        ['stand', 'stood', 'stood', '站'],
        ['run', 'ran', 'run', '跑'],
        ['begin', 'began', 'begun', '開始'],
        ['break', 'broke', 'broken', '打破'],
        ['choose', 'chose', 'chosen', '選擇'],
        ['drive', 'drove', 'driven', '開車'],
        ['feel', 'felt', 'felt', '感覺'],
        ['keep', 'kept', 'kept', '保持']
      ]
    },
    pitfalls: [
      '❌ `I have went` → ✅ `I have gone`（完成式用過去分詞，不是過去式）',
      '❌ `He has took it` → ✅ `He has taken it`',
      '❌ `Did you went?` → ✅ `Did you go?`（did 已表過去，動詞回原形）',
      'read 三態拼字一樣但發音不同：現在式 /riːd/，過去式與分詞都是 /red/。'
    ],
    drills: [
      { type: 'choice', q: 'She has _____ the email already.', options: ['sent', 'send', 'sended', 'sending'], answer: 0, explain: 'have + 過去分詞，send 的分詞是 sent。' },
      { type: 'choice', q: 'I _____ my keys yesterday.', options: ['lose', 'lost', 'losed', 'have lost'], answer: 1, explain: 'yesterday 是明確過去時間，用過去式 lost。' },
      { type: 'choice', q: 'The report was _____ by the intern.', options: ['write', 'wrote', 'written', 'writed'], answer: 2, explain: '被動語態 be + 過去分詞，write 的分詞是 written。' },
      { type: 'choice', q: 'How much did it _____?', options: ['cost', 'costed', 'costs', 'cost of'], answer: 0, explain: 'did 後面接原形；cost 三態同形。' },
      { type: 'correct', wrong: 'He has drove to work every day this week.', answer: 'He has driven to work every day this week.', explain: 'drive 的過去分詞是 driven，不是過去式 drove。' },
      { type: 'correct', wrong: 'We have ate lunch already.', answer: 'We have eaten lunch already.', explain: 'eat → ate → eaten，完成式用 eaten。' }
    ]
  },

  {
    id: 'e07',
    group: 'form',
    title: '縮寫與口語形式',
    summary: '聽力聽不懂常常不是單字不會，而是縮寫沒聽出來。寫作則要知道什麼場合不能用。',
    intro: [
      '縮寫在**口語和 email** 都很自然，正式書面文件（合約、論文）才避免。',
      "最容易聽混的：`he's` 可能是 he is **或** he has。`I'd` 可能是 I would **或** I had。要靠後面接什麼判斷：後接過去分詞就是 has/had。",
      "`let's` = let us（提議一起做）。`it's` = it is / it has。`its` 沒有撇號，是所有格。",
      "`gonna` = going to、`wanna` = want to、`gotta` = got to：聽得懂就好，**不要寫出來**。"
    ],
    table: {
      caption: '高頻縮寫',
      head: ['縮寫', '完整', '注意'],
      rows: [
        ["I'm", 'I am', ''],
        ["you're", 'you are', "別和 your 搞混"],
        ["it's", 'it is / it has', "its 是所有格"],
        ["he's", 'he is / he has', '看後面接什麼'],
        ["we're", 'we are', ''],
        ["they're", 'they are', 'their / there 都別混'],
        ["I've", 'I have', ''],
        ["I'd", 'I would / I had', '後接原形=would'],
        ["I'll", 'I will', ''],
        ["don't", 'do not', ''],
        ["doesn't", 'does not', '第三人稱單數'],
        ["didn't", 'did not', '後面動詞回原形'],
        ["can't", 'cannot', ''],
        ["won't", 'will not', '不是 willn’t'],
        ["shouldn't", 'should not', ''],
        ["let's", 'let us', '提議'],
        ["that's", 'that is', ''],
        ["there's", 'there is', '']
      ]
    },
    pitfalls: [
      "❌ `Your welcome.` → ✅ `You're welcome.`",
      "❌ `Their going home.` → ✅ `They're going home.`",
      "❌ `Its a good idea.` → ✅ `It's a good idea.`",
      '❌ `willn’t` 不存在 → ✅ `won’t`'
    ],
    drills: [
      { type: 'choice', q: '_____ welcome to join us.', options: ['Your', "You're", 'Yours', 'You'], answer: 1, explain: "You're = you are。Your 是所有格。" },
      { type: 'choice', q: "In \"He's finished the task\", \"he's\" means:", options: ['he is', 'he has', 'he was', 'he does'], answer: 1, explain: '後面接過去分詞 finished，所以是 he has。' },
      { type: 'choice', q: 'The negative of "will" is _____.', options: ["willn't", "won't", "wouldn't", "will not't"], answer: 1, explain: "will not 的縮寫是 won't，是不規則的。" },
      { type: 'sort', prompt: '這些縮寫展開後是什麼？', buckets: ['is / has', 'are', 'not'],
        items: [
          { t: "it's", b: 'is / has' }, { t: "they're", b: 'are' }, { t: "doesn't", b: 'not' },
          { t: "she's", b: 'is / has' }, { t: "we're", b: 'are' }, { t: "can't", b: 'not' }
        ] },
      { type: 'correct', wrong: 'Their going to the airport now.', answer: "They're going to the airport now.", explain: "They're = they are。Their 是所有格。" }
    ]
  },

  {
    id: 'e08',
    group: 'quantity',
    title: '數量詞：some / any / much / many',
    summary: '選錯會立刻聽起來像初學者。判斷順序：先看可不可數，再看肯定還是疑問否定。',
    intro: [
      '**可數用 many / a few / few**；**不可數用 much / a little / little**；**兩者皆可用 some / any / a lot of / plenty of**。',
      '**some**：肯定句。**any**：否定句與疑問句。但**提議或請求**時用 some 更自然：`Would you like some coffee?`',
      '**a few / a little**（有一些，正面）vs **few / little**（幾乎沒有，負面）。差一個 a，意思相反：`I have a few friends here.`（有幾個朋友）vs `I have few friends here.`（幾乎沒朋友）。',
      '口語中 much 很少用在肯定句：❌ `I have much work.` → ✅ `I have a lot of work.`'
    ],
    table: {
      caption: '對照',
      head: ['', '可數 (books)', '不可數 (water)', '兩者皆可'],
      rows: [
        ['很多', 'many', 'much', 'a lot of'],
        ['一些（正面）', 'a few', 'a little', 'some'],
        ['幾乎沒有', 'few', 'little', '—'],
        ['疑問/否定', 'many / any', 'much / any', 'any'],
        ['一點點也沒', 'no', 'no', 'no / not any']
      ]
    },
    pitfalls: [
      '❌ `many information` → ✅ `much information`（information 不可數）',
      '❌ `I have much time.` → ✅ `I have a lot of time.`',
      '❌ `Do you have some questions?` 一般問句用 any；提議時才用 some。',
      '`a few` ≠ `few`：多一個 a 就從「幾乎沒有」變成「有一些」。'
    ],
    drills: [
      { type: 'choice', q: 'We don\'t have _____ time left.', options: ['many', 'much', 'a few', 'few'], answer: 1, explain: 'time 不可數，否定句用 much。' },
      { type: 'choice', q: 'He gave me _____ useful advice.', options: ['many', 'a few', 'some', 'several'], answer: 2, explain: 'advice 不可數，肯定句用 some。many/a few/several 只配可數。' },
      { type: 'choice', q: '"I have few friends here" means:', options: ['我有幾個朋友', '我幾乎沒有朋友', '我有很多朋友', '我沒有任何朋友'], answer: 1, explain: 'few（沒有 a）語感是「幾乎沒有」。要表達「有幾個」要用 a few。' },
      { type: 'sort', prompt: '這些名詞配 many 還是 much？', buckets: ['many', 'much'],
        items: [
          { t: 'people', b: 'many' }, { t: 'money', b: 'much' }, { t: 'questions', b: 'many' },
          { t: 'water', b: 'much' }, { t: 'tickets', b: 'many' }, { t: 'information', b: 'much' }
        ] },
      { type: 'correct', wrong: 'How many money do you need?', answer: 'How much money do you need?', explain: 'money 不可數，用 much。' }
    ]
  }
]

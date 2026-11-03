/**
 * 主題對話 scenarios.
 *
 * Each one is a situation a beginner will actually meet, with a partner, three
 * concrete goals (what "done" means, so the talk has an end that is not just a
 * turn counter), the partner's opening line, and sentence frames the learner
 * can ask for. Frames are deliberately partial ("I'd like …"): v4 showed a
 * finished example sentence and learners copied it.
 *
 * `script` + `samples` are the offline path (no Gemini key): the partner reads
 * the script in order, and after the talk the learner compares their replies
 * with the samples. With a key the AI plays the partner instead and the script
 * only steers it.
 *
 * area matches settings.articleTopics so the learner's chosen topics decide
 * which scenarios come up.
 *
 * v5.1: 30 scenarios, and each has two `twists` — a complication the AI
 * partner brings in when the scenario comes back about a week later
 * (procedural repetition: same kind of task, new content). A writing-task
 * meta-analysis (Liu & Tang 2025, Language Teaching Research; 17 studies)
 * found repetition helps fluency most (g = 0.51), works as well when the
 * content changes as when it does not, and is most consistent at a one-week
 * interval. So the rotation is not "never repeat": new scenarios first, and
 * each one returns once, a week on, harder.
 */
const FIRST_TEN = [
  {
    id: 'cafe', area: 'travel', title: '咖啡店點餐',
    scene_zh: '你在機場的咖啡店，想買早餐帶上飛機。',
    partner: { name: 'Mia', role_en: 'barista at an airport café', role_zh: '咖啡店店員' },
    goals: [
      { zh: '點一杯飲料，說要什麼大小', en: 'order a drink and say the size' },
      { zh: '問有沒有吃的', en: 'ask what food they have' },
      { zh: '問多少錢、說要外帶', en: 'ask the price and say it is to go' }
    ],
    opener: { en: 'Hi there! What can I get for you?', zh: '嗨！要點什麼呢？' },
    frames: ["I'd like a …", 'Do you have …?', 'How much is …?', "It's to …"],
    script: [
      { en: 'Sure. What size would you like?', zh: '好的，要什麼大小？' },
      { en: 'Anything to eat? We have muffins and sandwiches.', zh: '要吃點什麼嗎？我們有馬芬和三明治。' },
      { en: 'Is that for here or to go?', zh: '內用還是外帶？' },
      { en: "That's seven dollars. Have a nice flight!", zh: '一共七美元，祝你旅途愉快！' }
    ],
    samples: ["I'd like a latte, please.", 'A medium, please.', "I'll have a muffin. How much is it?", 'To go, please.', 'Thank you! You too.']
  },
  {
    id: 'hotel', area: 'travel', title: '飯店入住',
    scene_zh: '你剛到飯店櫃檯，要辦入住。',
    partner: { name: 'Daniel', role_en: 'hotel front desk clerk', role_zh: '飯店櫃檯人員' },
    goals: [
      { zh: '說你有訂房，報上名字', en: 'say you have a booking and give your name' },
      { zh: '問早餐幾點、在哪裡', en: 'ask when and where breakfast is' },
      { zh: '問 Wi-Fi 密碼或要求延後退房', en: 'ask for the Wi-Fi password or a late check-out' }
    ],
    opener: { en: 'Good evening! Are you checking in?', zh: '晚安！您要辦入住嗎？' },
    frames: ['I have a …', 'My name is …', 'What time is …?', 'Can I …?'],
    script: [
      { en: 'Thank you. Can I see your passport, please?', zh: '謝謝，可以看一下您的護照嗎？' },
      { en: "You're in room 512. Do you have any questions?", zh: '您住 512 號房。有什麼問題嗎？' },
      { en: 'Breakfast is from seven to ten on the second floor.', zh: '早餐七點到十點，在二樓。' },
      { en: 'No problem. Enjoy your stay!', zh: '沒問題，祝您住得愉快！' }
    ],
    samples: ['Yes. I have a reservation. My name is Chen.', 'Sure. Here you are.', 'What time is breakfast?', "What's the Wi-Fi password?", 'Thank you very much.']
  },
  {
    id: 'directions', area: 'travel', title: '問路',
    scene_zh: '你在陌生的城市找不到火車站，一位路人來幫你。',
    partner: { name: 'Grace', role_en: 'friendly local on the street', role_zh: '路上的當地人' },
    goals: [
      { zh: '說你要去哪裡', en: 'say where you want to go' },
      { zh: '問怎麼走、要走多久', en: 'ask how to get there and how long it takes' },
      { zh: '確認路線並道謝', en: 'repeat the way back to check, and say thanks' }
    ],
    opener: { en: 'Hi, you look a little lost. Can I help you?', zh: '嗨，你看起來有點迷路，需要幫忙嗎？' },
    frames: ["I'm looking for …", 'How do I get to …?', 'How long does it …?', 'So I go …'],
    script: [
      { en: 'The train station? Go straight and turn left at the bank.', zh: '火車站嗎？直走，在銀行那裡左轉。' },
      { en: "It's about ten minutes on foot.", zh: '走路大約十分鐘。' },
      { en: "Yes, that's right. You can't miss it.", zh: '對，沒錯，你一定找得到。' },
      { en: "You're welcome. Have a good day!", zh: '不客氣，祝你有美好的一天！' }
    ],
    samples: ["Yes, please. I'm looking for the train station.", 'How do I get there?', 'How long does it take?', 'So I go straight and turn left at the bank?', 'Thank you so much!']
  },
  {
    id: 'restaurant', area: 'travel', title: '餐廳點餐',
    scene_zh: '你和一位朋友走進一家餐廳吃晚餐。',
    partner: { name: 'Leo', role_en: 'server at a restaurant', role_zh: '餐廳服務生' },
    goals: [
      { zh: '說有幾位', en: 'say how many people' },
      { zh: '問推薦什麼，然後點主餐', en: 'ask for a recommendation and order a main dish' },
      { zh: '要求結帳', en: 'ask for the bill' }
    ],
    opener: { en: 'Good evening! How many people?', zh: '晚安！請問幾位？' },
    frames: ['A table for …', 'What do you …?', "I'll have the …", 'Can I have the …?'],
    script: [
      { en: 'Right this way. Here is the menu. Are you ready to order?', zh: '這邊請，這是菜單。準備好點餐了嗎？' },
      { en: 'Our steak and the fish soup are very popular.', zh: '我們的牛排和魚湯很受歡迎。' },
      { en: 'Great choice. Anything to drink?', zh: '好選擇。要喝點什麼嗎？' },
      { en: "Sure, I'll bring the bill right away.", zh: '好的，我馬上拿帳單來。' }
    ],
    samples: ['A table for two, please.', 'What do you recommend?', "I'll have the fish soup, please.", 'Just water, please. Can I have the bill?', 'Thank you.']
  },
  {
    id: 'shopping', area: 'daily', title: '買衣服',
    scene_zh: '你在服飾店想買一件外套。',
    partner: { name: 'Lisa', role_en: 'shop assistant in a clothing store', role_zh: '服飾店店員' },
    goals: [
      { zh: '說你在找什麼', en: 'say what you are looking for' },
      { zh: '問有沒有別的尺寸或顏色', en: 'ask about another size or colour' },
      { zh: '問價錢、能不能刷卡', en: 'ask the price and whether you can pay by card' }
    ],
    opener: { en: 'Hello! Are you looking for anything special today?', zh: '你好！今天想找什麼嗎？' },
    frames: ["I'm looking for …", 'Do you have this in …?', 'Can I try …?', 'Can I pay by …?'],
    script: [
      { en: 'Our jackets are over here. What size are you?', zh: '外套在這邊。你穿什麼尺寸？' },
      { en: 'We have it in black and blue. Would you like to try it on?', zh: '這件有黑色和藍色。要試穿看看嗎？' },
      { en: "It's sixty dollars. It's on sale today.", zh: '六十美元，今天有特價。' },
      { en: 'Yes, of course. Thank you for shopping with us!', zh: '當然可以，謝謝光臨！' }
    ],
    samples: ["I'm looking for a jacket.", 'Medium. Do you have this in black?', 'Yes, please. How much is it?', 'Can I pay by card?', 'Great, thank you.']
  },
  {
    id: 'weekend', area: 'daily', title: '聊週末',
    scene_zh: '星期一早上，同事在茶水間問你週末過得怎樣。',
    partner: { name: 'Sam', role_en: 'friendly coworker', role_zh: '同事' },
    goals: [
      { zh: '說你週末做了什麼（用過去式）', en: 'say what you did at the weekend (past tense)' },
      { zh: '說感覺怎麼樣、為什麼', en: 'say how it was and why' },
      { zh: '反問對方的週末', en: 'ask about their weekend' }
    ],
    opener: { en: 'Morning! How was your weekend?', zh: '早！週末過得怎麼樣？' },
    frames: ['It was …', 'I went to …', 'Because …', 'How about …?'],
    script: [
      { en: 'Oh nice! What did you do?', zh: '不錯喔！你做了什麼？' },
      { en: 'Sounds fun. Did you like it?', zh: '聽起來很好玩，你喜歡嗎？' },
      { en: 'I stayed home and watched movies. It was relaxing.', zh: '我待在家看電影，很放鬆。' },
      { en: 'Well, back to work. See you at lunch!', zh: '好啦，回去工作，午餐見！' }
    ],
    samples: ['It was great, thanks.', 'I went to the beach with my family.', 'Yes, I liked it because the weather was nice.', 'How about you? What did you do?', 'See you!']
  },
  {
    id: 'newcolleague', area: 'work', title: '認識新同事',
    scene_zh: '公司來了一位外國新同事，你們第一次聊天。',
    partner: { name: 'Alex', role_en: 'new colleague from Canada', role_zh: '新同事（來自加拿大）' },
    goals: [
      { zh: '介紹你的名字和工作', en: 'introduce your name and job' },
      { zh: '說你負責什麼工作', en: 'say what you work on' },
      { zh: '問對方一個問題', en: 'ask them a question' }
    ],
    opener: { en: "Hi, I'm Alex. I just started here today.", zh: '嗨，我是 Alex，今天剛來上班。' },
    frames: ["Nice to meet you. I'm …", 'I work as …', 'I work on …', 'Where are you …?'],
    script: [
      { en: 'Nice to meet you too! What do you do here?', zh: '也很高興認識你！你在這裡做什麼？' },
      { en: 'Interesting. How long have you worked here?', zh: '很有趣。你在這裡工作多久了？' },
      { en: "I'm from Toronto. It's very cold there in winter!", zh: '我來自多倫多，那裡冬天很冷！' },
      { en: 'Thanks for the chat. See you around!', zh: '謝謝你陪我聊天，再見！' }
    ],
    samples: ["Nice to meet you. I'm Kai.", "I'm an engineer. I work on the factory systems.", "About three years. Where are you from?", 'Wow. Welcome to Taiwan!', 'See you!']
  },
  {
    id: 'problem', area: 'work', title: '回報問題',
    scene_zh: '系統出了問題，主管打電話來問你狀況。',
    partner: { name: 'Kevin', role_en: 'your manager', role_zh: '主管' },
    goals: [
      { zh: '說哪裡出了問題', en: 'say what is wrong' },
      { zh: '說你已經做了什麼', en: 'say what you have done' },
      { zh: '說什麼時候可以修好', en: 'say when it will be fixed' }
    ],
    opener: { en: "Hi, I heard there's a problem. What happened?", zh: '嗨，聽說出問題了，發生什麼事？' },
    frames: ["The … doesn't work.", 'I checked …', 'I think it will …', 'I will send …'],
    script: [
      { en: 'I see. What have you tried so far?', zh: '了解。你目前試過什麼？' },
      { en: 'OK. When do you think it will be fixed?', zh: '好，你覺得什麼時候能修好？' },
      { en: 'Good. Please send me an update by email.', zh: '很好，請用 email 跟我更新進度。' },
      { en: 'Thanks for your hard work.', zh: '辛苦了，謝謝。' }
    ],
    samples: ["The server doesn't work. Users can't log in.", 'I checked the logs and restarted the server.', 'I think it will be fixed in one hour.', 'OK. I will send you an email.', 'No problem.']
  },
  {
    id: 'plans', area: 'daily', title: '約朋友吃飯',
    scene_zh: '外國朋友傳訊息約你這週吃飯。',
    partner: { name: 'Jenny', role_en: 'a friend from your English class', role_zh: '英文課認識的朋友' },
    goals: [
      { zh: '約一個時間', en: 'agree on a day and time' },
      { zh: '決定吃什麼或去哪裡', en: 'choose what to eat or where' },
      { zh: '確認在哪裡碰面', en: 'agree where to meet' }
    ],
    opener: { en: 'Hey! Do you want to have dinner this week?', zh: '嘿！這週要不要一起吃晚餐？' },
    frames: ['Sure! How about …?', "I'm free on …", 'Do you like …?', "Let's meet at …"],
    script: [
      { en: 'Friday works for me. What time?', zh: '我星期五可以。幾點？' },
      { en: 'Great. What do you want to eat?', zh: '好啊，你想吃什麼？' },
      { en: 'Sounds good! Where should we meet?', zh: '聽起來不錯！要在哪裡碰面？' },
      { en: 'Perfect. See you on Friday!', zh: '太好了，星期五見！' }
    ],
    samples: ["Sure! I'm free on Friday.", 'How about seven?', 'Do you like hot pot?', "Let's meet at the MRT station.", 'See you!']
  },
  {
    id: 'pharmacy', area: 'travel', title: '藥局買藥',
    scene_zh: '旅行時你感冒了，走進一間藥局。',
    partner: { name: 'Mr. Brown', role_en: 'pharmacist', role_zh: '藥劑師' },
    goals: [
      { zh: '說你哪裡不舒服', en: 'say how you feel' },
      { zh: '問這個藥怎麼吃', en: 'ask how to take the medicine' },
      { zh: '問多少錢並道謝', en: 'ask the price and say thanks' }
    ],
    opener: { en: 'Hello. How can I help you?', zh: '你好，需要什麼幫忙嗎？' },
    frames: ['I have a …', 'I feel …', 'How often should I …?', 'How much …?'],
    script: [
      { en: 'I see. How long have you felt like this?', zh: '了解。這樣多久了？' },
      { en: 'This medicine should help.', zh: '這個藥應該有幫助。' },
      { en: 'Take one pill three times a day, after meals.', zh: '一天三次，每次一顆，飯後吃。' },
      { en: "That's eight dollars. Get some rest!", zh: '八美元，好好休息！' }
    ],
    samples: ['I have a cold. I have a sore throat.', 'Since yesterday.', 'How often should I take it?', 'OK. How much is it?', 'Thank you.']
  }
]

const MORE = [
  {
    id: 'airport', area: 'travel', title: '機場報到',
    scene_zh: '你在機場櫃檯辦登機，要托運一個行李。',
    partner: { name: 'Hana', role_en: 'airline check-in agent', role_zh: '航空公司地勤' },
    goals: [
      { zh: '給護照、說你要去哪裡', en: 'hand over your passport and say where you are flying' },
      { zh: '托運行李', en: 'check in a bag' },
      { zh: '要一個靠窗或靠走道的位子', en: 'ask for a window or aisle seat' }
    ],
    opener: { en: 'Good morning. May I see your passport, please?', zh: '早安，可以看一下您的護照嗎？' },
    frames: ['Here you …', "I'm flying to …", 'I have one …', 'Can I have a …?'],
    script: [
      { en: 'Thank you. Where are you flying today?', zh: '謝謝，今天飛哪裡？' },
      { en: 'Do you have any bags to check?', zh: '有要托運的行李嗎？' },
      { en: 'OK. Window or aisle seat?', zh: '好的，靠窗還是靠走道？' },
      { en: 'Here is your boarding pass. Gate 12. Have a good trip!', zh: '這是您的登機證，12 號登機門，旅途愉快！' }
    ],
    samples: ['Here you are.', "I'm flying to Tokyo.", 'Yes, I have one bag.', 'A window seat, please.', 'Thank you very much.']
  },
  {
    id: 'taxi', area: 'travel', title: '搭計程車',
    scene_zh: '你在國外坐上一台計程車，要去飯店。',
    partner: { name: 'Tom', role_en: 'taxi driver', role_zh: '計程車司機' },
    goals: [
      { zh: '說你要去的地方', en: 'say where you want to go' },
      { zh: '問要開多久', en: 'ask how long it takes' },
      { zh: '付錢、要收據', en: 'pay and ask for a receipt' }
    ],
    opener: { en: 'Hello! Where to?', zh: '你好！要去哪裡？' },
    frames: ['To the …, please.', 'How long does …?', 'Can I pay by …?', 'Can I have a …?'],
    script: [
      { en: 'The Grand Hotel? No problem.', zh: '大飯店嗎？沒問題。' },
      { en: 'About twenty minutes. The traffic is not bad today.', zh: '大約二十分鐘，今天路況還好。' },
      { en: "Here we are. That's twenty-five dollars.", zh: '到了，一共二十五美元。' },
      { en: "Sure, here's your receipt. Enjoy your stay!", zh: '好的，這是收據，玩得愉快！' }
    ],
    samples: ['To the Grand Hotel, please.', 'How long does it take?', 'OK, thank you.', 'Can I pay by card?', 'Can I have a receipt, please?']
  },
  {
    id: 'lostbag', area: 'travel', title: '行李不見了',
    scene_zh: '你下飛機後等不到自己的行李，到行李服務櫃檯詢問。',
    partner: { name: 'Ken', role_en: 'airport baggage service staff', role_zh: '機場行李服務人員' },
    goals: [
      { zh: '說你的行李沒出來', en: 'say your bag did not arrive' },
      { zh: '描述行李的樣子（顏色、大小）', en: 'describe the bag (colour, size)' },
      { zh: '留下聯絡方式或飯店', en: 'give your phone number or hotel' }
    ],
    opener: { en: 'Hi. How can I help you?', zh: '你好，需要什麼協助？' },
    frames: ["My bag didn't …", "It's a big …", 'It has …', "I'm staying at …"],
    script: [
      { en: "I'm sorry. What does your bag look like?", zh: '很抱歉。你的行李長什麼樣子？' },
      { en: 'OK. Is there anything special on it?', zh: '好的，上面有什麼特別的地方嗎？' },
      { en: 'Where are you staying? We can send it to you.', zh: '你住哪裡？我們可以送過去。' },
      { en: "Thank you. We'll call you when we find it.", zh: '謝謝，找到後會打電話給你。' }
    ],
    samples: ["My bag didn't come out.", "It's a big black suitcase.", 'It has a red tag.', "I'm staying at the Park Hotel.", 'Thank you for your help.']
  },
  {
    id: 'train', area: 'travel', title: '買車票',
    scene_zh: '你在火車站售票口，想買去機場的車票。',
    partner: { name: 'Ms. Green', role_en: 'ticket office clerk at a train station', role_zh: '車站售票員' },
    goals: [
      { zh: '說你要去哪裡、買幾張', en: 'say where you are going and how many tickets' },
      { zh: '說要單程還是來回', en: 'say one-way or round trip' },
      { zh: '問在哪個月台、幾點開', en: 'ask which platform and what time it leaves' }
    ],
    opener: { en: 'Hi. Where would you like to go?', zh: '你好，要去哪裡？' },
    frames: ['One ticket to …', 'Round trip, …', 'Which platform …?', 'What time does …?'],
    script: [
      { en: 'To the airport. One-way or round trip?', zh: '到機場，單程還是來回？' },
      { en: "That's twelve dollars, please.", zh: '十二美元。' },
      { en: 'The next train leaves at 10:15.', zh: '下一班 10 點 15 分開。' },
      { en: 'Platform 3. Have a good day.', zh: '第三月台，祝你順利。' }
    ],
    samples: ['One ticket to the airport, please.', 'One-way, please.', 'OK. What time does the next train leave?', 'Which platform is it?', 'Thanks!']
  },
  {
    id: 'museum', area: 'travel', title: '參觀博物館',
    scene_zh: '你在博物館入口買票，想多問幾件事。',
    partner: { name: 'Lucy', role_en: 'museum ticket desk staff', role_zh: '博物館售票人員' },
    goals: [
      { zh: '買票（說幾個人）', en: 'buy tickets for your group' },
      { zh: '問幾點關門', en: 'ask what time it closes' },
      { zh: '問可不可以拍照', en: 'ask if you can take photos' }
    ],
    opener: { en: 'Welcome to the City Museum! How many tickets?', zh: '歡迎來到市立博物館！要幾張票？' },
    frames: ['Two tickets, …', 'What time do …?', 'Can I take …?', 'Where is the …?'],
    script: [
      { en: "That's thirty dollars. Here are your tickets.", zh: '三十美元，這是你們的票。' },
      { en: 'We close at six today.', zh: '我們今天六點關門。' },
      { en: 'Yes, but no flash, please.', zh: '可以，但請不要開閃光燈。' },
      { en: 'Enjoy the museum!', zh: '祝參觀愉快！' }
    ],
    samples: ['Two tickets, please.', 'What time do you close?', 'Can I take photos?', 'OK. Where is the gift shop?', 'Thank you!']
  },
  {
    id: 'roomproblem', area: 'travel', title: '房間有問題',
    scene_zh: '你住的飯店房間冷氣壞了，打電話到櫃檯。',
    partner: { name: 'Daniel', role_en: 'hotel front desk clerk on the phone', role_zh: '飯店櫃檯人員（電話）' },
    goals: [
      { zh: '說你的房號和問題', en: 'say your room number and the problem' },
      { zh: '請他們修理或換房', en: 'ask them to fix it or change your room' },
      { zh: '問多久會好', en: 'ask how long it will take' }
    ],
    opener: { en: 'Front desk, this is Daniel. How can I help?', zh: '櫃檯您好，我是 Daniel，請問需要什麼？' },
    frames: ["I'm in room …", "The air conditioner …", 'Can you …?', 'How long will …?'],
    script: [
      { en: "I'm sorry about that. Which room are you in?", zh: '很抱歉。請問您住幾號房？' },
      { en: 'Would you like us to fix it, or change your room?', zh: '要幫您修理，還是換房間？' },
      { en: 'Someone will come in about fifteen minutes.', zh: '大約十五分鐘會有人過去。' },
      { en: "You're welcome. Sorry again.", zh: '不客氣，再次抱歉。' }
    ],
    samples: ["Hi. The air conditioner doesn't work.", "I'm in room 805.", 'Can you fix it, please?', 'How long will it take?', 'OK. Thank you.']
  },
  {
    id: 'supermarket', area: 'daily', title: '超市找東西',
    scene_zh: '你在國外超市找不到牛奶，問店員。',
    partner: { name: 'Sara', role_en: 'supermarket staff', role_zh: '超市店員' },
    goals: [
      { zh: '問某樣東西在哪裡', en: 'ask where something is' },
      { zh: '問有沒有比較小或便宜的', en: 'ask for a smaller or cheaper one' },
      { zh: '結帳時說要不要袋子', en: 'say if you need a bag at the checkout' }
    ],
    opener: { en: 'Hi, are you looking for something?', zh: '嗨，在找什麼嗎？' },
    frames: ['Where is the …?', 'Do you have a …?', 'Is this on …?', 'No bag, …'],
    script: [
      { en: 'The milk is in aisle five, next to the eggs.', zh: '牛奶在第五排，雞蛋旁邊。' },
      { en: 'Yes, we have small bottles too. They are on the top shelf.', zh: '有，也有小瓶的，在最上層。' },
      { en: 'OK, you can pay over there. Do you need a bag?', zh: '好，可以在那邊結帳。需要袋子嗎？' },
      { en: 'Thank you. Have a nice day!', zh: '謝謝，祝你有美好的一天！' }
    ],
    samples: ['Yes. Where is the milk?', 'Do you have a smaller one?', 'Thank you. Is this on sale?', 'No bag, thanks.', 'You too!']
  },
  {
    id: 'haircut', area: 'daily', title: '剪頭髮',
    scene_zh: '你在國外的理髮店想剪頭髮。',
    partner: { name: 'Leo', role_en: 'hairdresser', role_zh: '美髮師' },
    goals: [
      { zh: '說你想剪什麼樣子', en: 'say what haircut you want' },
      { zh: '說要剪多短', en: 'say how short' },
      { zh: '問多少錢', en: 'ask how much it is' }
    ],
    opener: { en: 'Hi! Have a seat. What would you like today?', zh: '嗨！請坐。今天想怎麼剪？' },
    frames: ["I'd like a …", 'Not too …', 'A little shorter …', 'How much is …?'],
    script: [
      { en: 'Sure. How short do you want it?', zh: '好的，要剪多短？' },
      { en: 'OK. Do you want me to wash it first?', zh: '好，要先洗頭嗎？' },
      { en: 'All done. Do you like it?', zh: '剪好了，喜歡嗎？' },
      { en: "That's twenty dollars. Thank you!", zh: '二十美元，謝謝！' }
    ],
    samples: ["I'd like a haircut, please.", 'Not too short. Just a little.', 'Yes, please.', 'Yes, I like it. How much is it?', 'Here you are. Thanks!']
  },
  {
    id: 'neighbor', area: 'daily', title: '認識新鄰居',
    scene_zh: '你搬進新公寓，在電梯遇到外國鄰居。',
    partner: { name: 'Emma', role_en: 'your new neighbour', role_zh: '新鄰居' },
    goals: [
      { zh: '自我介紹、說你住幾樓', en: 'introduce yourself and say which floor you live on' },
      { zh: '聊一句天氣或這附近', en: 'small talk about the weather or the area' },
      { zh: '問對方一個問題', en: 'ask them a question' }
    ],
    opener: { en: "Hi! Are you new here? I'm Emma.", zh: '嗨！你是新搬來的嗎？我是 Emma。' },
    frames: ["Yes, I'm …", 'I live on the …', 'It is very …', 'How long have you …?'],
    script: [
      { en: 'Nice to meet you! Which floor are you on?', zh: '很高興認識你！你住幾樓？' },
      { en: "It's so hot today, isn't it?", zh: '今天好熱，對吧？' },
      { en: 'I moved here two years ago. The park nearby is really nice.', zh: '我兩年前搬來，附近的公園很不錯。' },
      { en: 'Here is my floor. See you around!', zh: '我到了，再見囉！' }
    ],
    samples: ["Yes, I'm Kai. Nice to meet you.", 'I live on the eighth floor.', 'Yes, it is very hot.', 'How long have you lived here?', 'See you!']
  },
  {
    id: 'booking', area: 'daily', title: '打電話訂位',
    scene_zh: '你打電話到餐廳，想訂週六晚上的位子。',
    partner: { name: 'Nina', role_en: 'restaurant staff answering the phone', role_zh: '餐廳電話人員' },
    goals: [
      { zh: '說你要訂位的日期和時間', en: 'say the day and time you want' },
      { zh: '說有幾個人', en: 'say how many people' },
      { zh: '留下名字和電話', en: 'give your name and phone number' }
    ],
    opener: { en: 'Hello, Sunny Kitchen. How can I help you?', zh: '您好，這裡是 Sunny Kitchen，請問需要什麼？' },
    frames: ["I'd like to book …", 'For four …', 'At seven …', 'My name is …'],
    script: [
      { en: 'Sure. For how many people?', zh: '好的，幾位？' },
      { en: 'What time would you like?', zh: '想要幾點？' },
      { en: 'Seven is OK. Can I have your name and number?', zh: '七點可以。請留您的名字和電話？' },
      { en: 'Great, see you on Saturday!', zh: '好的，週六見！' }
    ],
    samples: ["Hi. I'd like to book a table for Saturday.", 'For four people.', 'At seven, please.', 'My name is Chen. My number is 0912-345-678.', 'Thank you. Bye!']
  },
  {
    id: 'hobby', area: 'daily', title: '聊興趣',
    scene_zh: '在聚會上，一位朋友的朋友問你平常喜歡做什麼。',
    partner: { name: 'Ben', role_en: "a friend's friend at a party", role_zh: '朋友的朋友' },
    goals: [
      { zh: '說你的興趣', en: 'say what you like doing' },
      { zh: '說多久做一次、跟誰', en: 'say how often and with whom' },
      { zh: '反問對方', en: 'ask about their hobby' }
    ],
    opener: { en: 'So, what do you like to do in your free time?', zh: '那你空閒時喜歡做什麼？' },
    frames: ['I like …', 'I usually … on weekends.', 'With my …', 'What about …?'],
    script: [
      { en: 'Cool! How often do you do that?', zh: '酷！多久一次？' },
      { en: 'Who do you usually go with?', zh: '通常跟誰一起？' },
      { en: 'I like cooking. I try a new recipe every week.', zh: '我喜歡做菜，每週試一道新菜。' },
      { en: 'Maybe we can try it together sometime!', zh: '也許哪天可以一起試試！' }
    ],
    samples: ['I like hiking.', 'I usually go hiking on weekends.', 'With my family.', 'What about you?', 'Sounds great!']
  },
  {
    id: 'returnitem', area: 'daily', title: '退換貨',
    scene_zh: '你昨天買的鞋子太小，回店裡想換。',
    partner: { name: 'Lisa', role_en: 'shop assistant at the service desk', role_zh: '店員' },
    goals: [
      { zh: '說你買的東西有什麼問題', en: 'say what is wrong with what you bought' },
      { zh: '說想換貨或退錢', en: 'ask for an exchange or a refund' },
      { zh: '回答有沒有收據', en: 'answer about the receipt' }
    ],
    opener: { en: 'Hi, how can I help you today?', zh: '你好，今天需要什麼？' },
    frames: ['I bought these …', 'They are too …', 'Can I change …?', 'Here is my …'],
    script: [
      { en: "I see. What's the problem?", zh: '了解，有什麼問題？' },
      { en: 'Do you want a bigger size, or your money back?', zh: '要換大一號，還是退錢？' },
      { en: 'Do you have the receipt?', zh: '有收據嗎？' },
      { en: 'Here you go, one size bigger. Anything else?', zh: '好了，大一號。還有別的嗎？' }
    ],
    samples: ['I bought these shoes yesterday.', 'They are too small.', 'Can I change them for a bigger size?', 'Yes. Here is my receipt.', "No, that's all. Thank you."]
  },
  {
    id: 'opinion', area: 'work', title: '會議中說意見',
    scene_zh: '開會討論下個月的活動，主管問你的看法。',
    partner: { name: 'Grace', role_en: 'team leader in a meeting', role_zh: '組長' },
    goals: [
      { zh: '說你同意或不同意', en: 'say if you agree or not' },
      { zh: '說一個理由', en: 'give one reason' },
      { zh: '提一個建議', en: 'make one suggestion' }
    ],
    opener: { en: 'We want to hold the event outdoors. What do you think?', zh: '我們想在戶外辦活動，你覺得呢？' },
    frames: ['I think …', 'Because …', 'Maybe we can …', 'How about …?'],
    script: [
      { en: 'Interesting. Why do you think so?', zh: '有意思，為什麼這樣想？' },
      { en: 'Good point. Do you have any ideas?', zh: '說得好，你有什麼想法嗎？' },
      { en: "OK, let's think about that. Anything else?", zh: '好，我們考慮一下。還有嗎？' },
      { en: 'Thanks. That was helpful.', zh: '謝謝，很有幫助。' }
    ],
    samples: ["I think it's a good idea, but…", 'Because it may rain next month.', 'Maybe we can rent a tent.', 'How about a plan B indoors?', 'You are welcome.']
  },
  {
    id: 'schedule', area: 'work', title: '約開會時間',
    scene_zh: '國外廠商傳訊息，想約下週開線上會議。',
    partner: { name: 'Mr. Lee', role_en: 'a supplier who wants a meeting', role_zh: '廠商窗口' },
    goals: [
      { zh: '提一個你可以的時間', en: 'suggest a time that works for you' },
      { zh: '對方的時間不行時，再提一個', en: 'offer another time when theirs does not work' },
      { zh: '確認日期、時間和會議連結', en: 'confirm the day, time and meeting link' }
    ],
    opener: { en: "Hi! Can we have a short meeting next week? When are you free?", zh: '嗨！下週可以開個短會嗎？你什麼時候有空？' },
    frames: ["I'm free on …", 'How about …?', "Sorry, I can't …", 'I will send …'],
    script: [
      { en: "Monday is hard for me. Is Tuesday OK?", zh: '星期一我不方便，星期二可以嗎？' },
      { en: 'Tuesday at 2 p.m. works for me.', zh: '星期二下午兩點我可以。' },
      { en: 'Great. Who will send the meeting link?', zh: '太好了，誰來寄會議連結？' },
      { en: 'Perfect. See you on Tuesday!', zh: '太好了，星期二見！' }
    ],
    samples: ["I'm free on Monday afternoon.", 'Yes, Tuesday is OK. How about 2 p.m.?', 'Great.', 'I will send the link by email.', 'See you!']
  },
  {
    id: 'visitor', area: 'work', title: '接待外國客戶',
    scene_zh: '外國客戶第一次來公司，你到門口迎接。',
    partner: { name: 'Mr. Smith', role_en: 'a visiting customer from the UK', role_zh: '英國來的客戶' },
    goals: [
      { zh: '歡迎他、自我介紹', en: 'welcome them and introduce yourself' },
      { zh: '問要喝什麼', en: 'offer something to drink' },
      { zh: '說明今天的行程', en: "explain today's plan" }
    ],
    opener: { en: "Hello, I'm John Smith. I have a meeting at ten.", zh: '你好，我是 John Smith，十點有個會議。' },
    frames: ['Welcome to …', "I'm …, I work in …", 'Would you like …?', 'First, we will …'],
    script: [
      { en: 'Nice to meet you. Thank you for meeting me.', zh: '很高興認識你，謝謝你來接我。' },
      { en: 'Coffee would be great, thanks.', zh: '咖啡很好，謝謝。' },
      { en: 'What is the plan for today?', zh: '今天的行程是什麼？' },
      { en: 'Sounds good. Let’s go.', zh: '聽起來不錯，走吧。' }
    ],
    samples: ["Welcome to our company. I'm Kai. I work in R&D.", 'Would you like coffee or tea?', 'Sure. Please wait a moment.', 'First, we will visit the factory. Then we have the meeting.', 'This way, please.']
  },
  {
    id: 'askhelp', area: 'work', title: '請同事幫忙',
    scene_zh: '你的報告來不及完成，想請外國同事幫忙。',
    partner: { name: 'Olivia', role_en: 'a coworker', role_zh: '同事' },
    goals: [
      { zh: '禮貌地請對方幫忙', en: 'ask for help politely' },
      { zh: '說要幫什麼、什麼時候要', en: 'explain the task and the deadline' },
      { zh: '道謝，說你可以怎麼回報', en: 'say thanks and offer something back' }
    ],
    opener: { en: 'Hey, you look busy. Is everything OK?', zh: '嘿，你看起來很忙，還好嗎？' },
    frames: ['Could you help me …?', 'I need to …', 'by Friday …', 'Thank you so …'],
    script: [
      { en: 'Sure, what do you need?', zh: '當然，需要什麼？' },
      { en: 'When do you need it?', zh: '什麼時候要？' },
      { en: "OK, I can do it this afternoon.", zh: '好，我今天下午可以做。' },
      { en: 'No problem. Happy to help!', zh: '不客氣，很樂意幫忙！' }
    ],
    samples: ['Not really. Could you help me with my report?', 'I need to check the numbers in this table.', 'By Friday, if possible.', 'Thank you so much. I will buy you a coffee!', 'Thanks again.']
  },
  {
    id: 'itdesk', area: 'tech', title: '找 IT 幫忙',
    scene_zh: '你的筆電連不上公司網路，打電話給 IT 支援。',
    partner: { name: 'Raj', role_en: 'IT help desk engineer', role_zh: 'IT 支援工程師' },
    goals: [
      { zh: '說哪裡有問題', en: 'say what the problem is' },
      { zh: '說你已經試過什麼', en: 'say what you already tried' },
      { zh: '問什麼時候能修好或下一步', en: 'ask when it will be fixed or what to do next' }
    ],
    opener: { en: 'IT support, this is Raj. What seems to be the problem?', zh: 'IT 支援，我是 Raj。有什麼問題？' },
    frames: ["My laptop can't …", 'I tried …', 'It says …', 'When can you …?'],
    script: [
      { en: 'OK. Did you try to restart it?', zh: '好，你試過重新開機嗎？' },
      { en: 'Is there an error message on the screen?', zh: '螢幕上有錯誤訊息嗎？' },
      { en: 'I see. I will check it from here.', zh: '了解，我從這邊幫你看。' },
      { en: "It's fixed now. Please try again.", zh: '修好了，請再試一次。' }
    ],
    samples: ["My laptop can't connect to the Wi-Fi.", 'Yes. I tried to restart it two times.', "It says 'No internet'.", 'When can you fix it?', 'It works now. Thank you!']
  },
  {
    id: 'demo', area: 'tech', title: '介紹你的系統',
    scene_zh: '展覽上，一位外國訪客對你們公司的系統有興趣。',
    partner: { name: 'Anna', role_en: 'a visitor at a trade show', role_zh: '展覽訪客' },
    goals: [
      { zh: '說這個系統是做什麼的', en: 'say what the system does' },
      { zh: '說誰會用它', en: 'say who uses it' },
      { zh: '說一個好處，給聯絡方式', en: 'give one benefit and your contact' }
    ],
    opener: { en: "Hi! This looks interesting. What is it?", zh: '嗨！這個看起來很有趣，是什麼？' },
    frames: ['It is a system that …', 'It helps …', 'Factories use it to …', 'Here is my …'],
    script: [
      { en: 'Cool. Who uses it?', zh: '酷，誰會用它？' },
      { en: 'What is the main benefit?', zh: '主要的好處是什麼？' },
      { en: 'Nice. Can I get more information?', zh: '不錯，可以給我更多資料嗎？' },
      { en: "Thanks! I'll email you next week.", zh: '謝謝！我下週寄信給你。' }
    ],
    samples: ['It is a system that reads meters with a camera.', 'Factories use it.', 'It saves time. People do not need to check the meters by hand.', 'Sure. Here is my card.', 'Thank you for coming.']
  },
  {
    id: 'videocall', area: 'tech', title: '視訊會議出狀況',
    scene_zh: '線上會議開始了，但你聽不太清楚對方的聲音。',
    partner: { name: 'Chris', role_en: 'a colleague leading an online meeting', role_zh: '主持會議的同事' },
    goals: [
      { zh: '說你聽不清楚', en: "say you can't hear well" },
      { zh: '請對方再說一次或說慢一點', en: 'ask them to repeat or speak slowly' },
      { zh: '請對方分享畫面', en: 'ask them to share their screen' }
    ],
    opener: { en: 'Hi everyone, can you hear me?', zh: '大家好，聽得到我嗎？' },
    frames: ["Sorry, I can't …", 'Could you say …?', 'Could you speak …?', 'Could you share …?'],
    script: [
      { en: 'Oh, is that better now?', zh: '喔，現在好一點嗎？' },
      { en: 'I said the report is due on Friday.', zh: '我說報告星期五要交。' },
      { en: 'Sure, I can share my screen. Can you see it?', zh: '好，我分享畫面，看得到嗎？' },
      { en: "Great, let's start.", zh: '好，我們開始吧。' }
    ],
    samples: ["Sorry, I can't hear you very well.", 'Yes, better. Could you say that again?', 'OK. Could you share your screen?', 'Yes, I can see it.', 'Thank you.']
  },
  {
    id: 'gym', area: 'daily', title: '健身房報名',
    scene_zh: '你想加入家附近的健身房，在櫃檯詢問。',
    partner: { name: 'Mike', role_en: 'gym front desk staff', role_zh: '健身房櫃檯' },
    goals: [
      { zh: '說你想加入', en: 'say you want to join' },
      { zh: '問一個月多少錢', en: 'ask the monthly price' },
      { zh: '問營業時間或能不能先試', en: 'ask the opening hours or for a free trial' }
    ],
    opener: { en: 'Hi! Welcome. How can I help?', zh: '嗨！歡迎，需要什麼嗎？' },
    frames: ["I'd like to …", 'How much is …?', 'What time do …?', 'Can I try …?'],
    script: [
      { en: 'Great! Have you been to a gym before?', zh: '太好了！你以前去過健身房嗎？' },
      { en: "It's forty dollars a month.", zh: '一個月四十美元。' },
      { en: "We're open from 6 a.m. to 11 p.m.", zh: '我們早上六點開到晚上十一點。' },
      { en: 'Sure, you can try it for free today!', zh: '可以，今天可以免費試用！' }
    ],
    samples: ["I'd like to join the gym.", 'Yes, but not for a long time.', 'How much is it a month?', 'What time do you open?', 'Can I try it today?']
  }
]

/*
 * Twists: what the AI partner brings in when a scenario comes back. zh is
 * shown on the brief card; en is the instruction to the model. Offline (the
 * authored script) the scenario returns without its twist.
 */
const TWISTS = {
  cafe: [
    { zh: 'Mia 說你要的飲料賣完了，你得換一個', en: 'The drink the learner orders is sold out; suggest two others.' },
    { zh: '你要幫同事多帶一份，而且要換成燕麥奶', en: 'The learner also needs a second order for a colleague, with oat milk.' }
  ],
  hotel: [
    { zh: '櫃檯找不到你的訂房紀錄', en: "You cannot find the learner's booking at first; ask questions until you find it." },
    { zh: '你想提早入住，但房間還沒整理好', en: 'The room is not ready yet; offer to keep the bags or a later time.' }
  ],
  directions: [
    { zh: 'Grace 說的路線有一段在施工，要繞路', en: 'Part of the road is closed for repairs; explain a different way.' },
    { zh: '你要去的是另一個車站，名字很像', en: 'There are two stations with similar names; check which one the learner means.' }
  ],
  restaurant: [
    { zh: '你的朋友不吃牛肉，要問有沒有其他選擇', en: 'The learner must ask for a dish without beef for a friend.' },
    { zh: '帳單算錯了一項', en: 'When the bill comes, one item is wrong; let the learner point it out.' }
  ],
  shopping: [
    { zh: '你要的尺寸只剩別的顏色', en: 'Only another colour is left in the learner’s size.' },
    { zh: '店裡只收現金', en: 'The card machine is broken today; cash only.' }
  ],
  weekend: [
    { zh: 'Sam 一直問細節（在哪裡、跟誰、吃了什麼）', en: 'Ask follow-up questions about where, who and what they ate.' },
    { zh: '這次換你先問，再說自己的', en: 'Do not ask first; wait for the learner to ask about your weekend.' }
  ],
  newcolleague: [
    { zh: 'Alex 問你推薦附近哪裡吃午餐', en: 'Ask the learner to recommend a place for lunch nearby.' },
    { zh: 'Alex 聽不懂你的職稱，請你解釋', en: 'You do not understand the learner’s job title; ask them to explain simply.' }
  ],
  problem: [
    { zh: '主管問客戶會不會受影響', en: 'Ask whether customers are affected and what to tell them.' },
    { zh: '問題比想像中嚴重，要說需要更多時間', en: 'The fix takes longer; the learner must explain the delay.' }
  ],
  plans: [
    { zh: 'Jenny 星期五臨時不行，要改天', en: 'Friday no longer works for you; agree on another day.' },
    { zh: 'Jenny 想帶一位朋友來', en: 'You want to bring a friend; ask if that is OK.' }
  ],
  pharmacy: [
    { zh: '藥劑師問你有沒有過敏', en: 'Ask if the learner has any allergies before giving medicine.' },
    { zh: '這個藥要醫生處方，要換一種', en: 'The first medicine needs a prescription; offer another one.' }
  ],
  airport: [
    { zh: '行李超重了', en: 'The bag is overweight; explain the fee or ask them to move things.' },
    { zh: '班機延誤一小時', en: 'The flight is delayed by one hour; give a meal coupon.' }
  ],
  taxi: [
    { zh: '司機說附近塞車，問要不要走另一條路', en: 'There is a traffic jam; ask if the learner wants a longer but faster way.' },
    { zh: '你只有大鈔，司機找不開', en: 'You cannot change a large note; the learner must find another way to pay.' }
  ],
  lostbag: [
    { zh: '行李可能被送到另一個城市', en: 'The bag may have gone to another city; it will take two days.' },
    { zh: '你今晚需要的東西在行李裡', en: 'The learner needs something from the bag tonight; offer a small kit.' }
  ],
  train: [
    { zh: '下一班車取消了', en: 'The next train is cancelled; offer a later train or a bus.' },
    { zh: '有學生票或優惠票可以問', en: 'Mention cheaper tickets for students or groups if the learner asks.' }
  ],
  museum: [
    { zh: '今天有特展，要另外買票', en: 'There is a special exhibition with an extra ticket.' },
    { zh: '你想寄放背包', en: 'Large bags are not allowed inside; tell them about the lockers.' }
  ],
  roomproblem: [
    { zh: '今天客滿，沒辦法換房', en: 'The hotel is full; you cannot change rooms, offer a fan or a discount.' },
    { zh: '問題不只一個：熱水也沒有', en: 'Ask if anything else is wrong; there is also no hot water.' }
  ],
  supermarket: [
    { zh: '你要找的東西賣完了', en: 'The item is sold out; suggest something similar.' },
    { zh: '收銀員問你有沒有會員卡', en: 'At the checkout, ask for a member card and explain the discount.' }
  ],
  haircut: [
    { zh: '美髮師推薦你換個新造型', en: 'Suggest a new style; the learner must accept or politely say no.' },
    { zh: '今天預約滿了，要等 30 分鐘', en: 'There is a 30-minute wait; the learner decides to wait or book later.' }
  ],
  neighbor: [
    { zh: 'Emma 邀請你週末來家裡吃飯', en: 'Invite the learner to dinner at the weekend.' },
    { zh: 'Emma 問你垃圾什麼時候收', en: 'Ask the learner when the rubbish is collected; they may not know.' }
  ],
  booking: [
    { zh: '七點客滿了，只剩六點或八點半', en: 'Seven is full; offer six or eight thirty.' },
    { zh: '有人生日，想請店家準備蛋糕', en: 'Ask if it is a special occasion; the learner wants a birthday cake.' }
  ],
  hobby: [
    { zh: 'Ben 想跟你一起去，問細節', en: 'You want to join next time; ask when and where.' },
    { zh: 'Ben 從沒聽過你的興趣，請你解釋', en: 'You have never heard of the hobby; ask the learner to explain it.' }
  ],
  returnitem: [
    { zh: '你找不到收據了', en: 'The learner has no receipt; ask for the card used or offer store credit.' },
    { zh: '大一號賣完了，只能退錢或換別款', en: 'The bigger size is sold out; offer a refund or another style.' }
  ],
  opinion: [
    { zh: 'Grace 不同意你的看法', en: 'Disagree politely with the learner and ask for a stronger reason.' },
    { zh: '要你估預算', en: 'Ask how much money the idea needs.' }
  ],
  schedule: [
    { zh: '對方在不同時區', en: 'You are in London (7 hours behind Taiwan); time zones matter.' },
    { zh: '會議要多邀一個人', en: 'Ask to invite your manager too; the time must work for three.' }
  ],
  visitor: [
    { zh: '客戶的班機晚到，行程要調整', en: 'You arrived late; the learner must change the plan.' },
    { zh: '客戶問附近有什麼好吃的', en: 'Ask the learner for a local food recommendation.' }
  ],
  askhelp: [
    { zh: 'Olivia 今天也很忙，只能幫一部分', en: 'You are busy too; you can only help with part of it.' },
    { zh: 'Olivia 不太懂要做什麼，請你說清楚', en: 'You do not understand the task; ask the learner to explain step by step.' }
  ],
  itdesk: [
    { zh: 'Raj 要你唸出電腦上的錯誤代碼', en: 'Ask the learner to read the error code and the laptop number.' },
    { zh: '要等明天才修得好，你今天有急事', en: 'It cannot be fixed today; the learner has urgent work.' }
  ],
  demo: [
    { zh: '訪客問價格和交期', en: 'Ask about the price and how long delivery takes.' },
    { zh: '訪客擔心太難用', en: 'Worry that it is hard to use; the learner must reassure you.' }
  ],
  videocall: [
    { zh: '你的網路斷線了一下', en: 'The learner drops out for a moment; ask what they missed.' },
    { zh: '換你要分享畫面，但分享不出來', en: 'Ask the learner to share their screen; it does not work at first.' }
  ],
  gym: [
    { zh: '要簽一年約才有優惠', en: 'The good price needs a one-year contract; the learner asks about monthly options.' },
    { zh: 'Mike 問你的運動目標', en: 'Ask about the learner’s fitness goal and suggest a class.' }
  ]
}

export const TALK_TOPICS = Object.freeze([...FIRST_TEN, ...MORE].map(t => Object.freeze({ ...t, twists: TWISTS[t.id] || [] })))

export const TALK_BY_ID = Object.freeze(Object.fromEntries(TALK_TOPICS.map(t => [t.id, t])))

/** Learner replies per conversation, and the per-reply character cap. */
export const TALK_TURNS = 5
export const TALK_MAX_CHARS = 140
/** After this many replies the learner may end early. */
export const TALK_MIN_TURNS = 3

const DAY = 86400000
/** Scores at or above this (of 16) are not brought back for a repeat. */
export const REPEAT_BELOW = 12
const dayGap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY)
function hash (str) {
  let h = 2166136261
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * Today's conversation.
 *
 *  1. A scenario first met 6-10 days ago, not yet repeated and scored under
 *     12/16 (or not scored, offline), comes back with one of its twists
 *     (procedural repetition at about a week).
 *  2. Otherwise a scenario this learner has never had.
 *  3. When every scenario has been met, the least recently met third.
 *
 * Deterministic per learner and day, so leaving and coming back keeps it.
 * `shift` (換一個情境) skips the repeat and walks the candidate list.
 *
 * history: [{ id, day: 'YYYY-MM-DD', twist: -1|0|1, total, repeat, of }]
 */
export function planTalk ({ day = '', user = '', areas = [], history = [], shift = 0 } = {}) {
  // tech scenarios are workplace English too, so 職場 brings them in
  let pool = TALK_TOPICS.filter(t => !areas.length || areas.includes(t.area) || (t.area === 'tech' && areas.includes('work')))
  if (!pool.length) pool = [...TALK_TOPICS]
  const ids = new Set(pool.map(t => t.id))
  const h = hash(`${user}|${day}`)

  if (shift === 0 && day) {
    const due = history
      .filter(e => !e.repeat && ids.has(e.id) && e.day && dayGap(day, e.day) >= 6 && dayGap(day, e.day) <= 10)
      // a talk that already went well (12/16 or more) does not need a second go
      .filter(e => !(e.total >= REPEAT_BELOW))
      .filter(e => !history.some(x => x.repeat && x.id === e.id && x.of === e.day))
      .sort((a, b) => a.day.localeCompare(b.day))
    const e = due[0]
    const topic = e && TALK_BY_ID[e.id]
    if (topic?.twists.length) return { topic, twist: h % topic.twists.length, repeatOf: e }
  }

  const met = new Map()
  for (const e of history) if (!met.has(e.id) || met.get(e.id) < e.day) met.set(e.id, e.day)
  let cands = pool.filter(t => !met.has(t.id))
  if (!cands.length) {
    cands = [...pool].sort((a, b) => met.get(a.id).localeCompare(met.get(b.id)))
    cands = cands.slice(0, Math.max(3, Math.ceil(cands.length / 3)))
  }
  return { topic: cands[(h + shift) % cands.length], twist: -1, repeatOf: null }
}

/** v5.0 kept only an id list; it still counts as "met" (day unknown). */
export function upgradeHistory (raw) {
  if (!Array.isArray(raw)) return []
  return raw.map(e => typeof e === 'string' ? { id: e, day: '' } : e).filter(e => e?.id)
}

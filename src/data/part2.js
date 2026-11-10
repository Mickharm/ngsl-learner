/**
 * 應答聽力 — question–response items in the shape of TOEIC Listening Part 2.
 *
 * Part 2 is 25 of the test's 100 listening questions and is nothing but this:
 * one spoken question or statement, three spoken responses, no text at all.
 * Until v6.1 the listening phase only asked "what does this word / sentence
 * mean" — it never asked the learner to *answer* anything.
 *
 * Every item is written with the two kinds of wrong answer the real test
 * uses, and says which is which, because that is the thing to learn here:
 * Part 2 is passed less by vocabulary than by not falling for
 *
 *   wh       an answer to a different question (a place for "when")
 *   yesno    Yes/No to a question that cannot take one
 *   echo     a word from the question repeated in an unrelated sentence
 *   sound    a word that only sounds like one in the question
 *   tense    the right topic at the wrong time
 *   subject  the right verb about the wrong person
 *   off      on the topic, but not an answer
 *
 * Words are kept inside the first ~1,500 NGSL ranks plus everyday names and
 * numbers; scripts/test-part2.mjs checks that with the app's own lexicon, so
 * a later edit cannot quietly raise the level.
 *
 * Shape: { id, kind, q, zh, right: [en, zh], wrong: [[en, zh, trap, cue?] × 2] }
 * Options are shuffled at run time (seeded), so position carries nothing.
 */

export const KIND_TIP = Object.freeze({
  when: 'When 問時間：答案裡要有時間。',
  where: 'Where 問地點：答案裡要有地方。',
  who: 'Who 問人：答案是人名、職稱，或「我來」。',
  what: 'What 問的是事物或內容；What time 問時間。',
  why: 'Why 問原因。Why don’t we… 是提議，要回答好不好。',
  how: 'How long 問多久、How much 問價錢、How often 問頻率、How many 問數量、How far 問距離；單獨的 How 問方法或感覺。',
  yesno: 'Yes/No 問句可以答 Yes/No，但常常不說 Yes/No、直接給資訊。',
  choice: 'A or B 的選擇問句不能回答 Yes/No，要選一個。',
  request: '請求、提議、建議：回答接受或拒絕。',
  statement: '直述句沒有在問問題：選最自然的回應（給辦法、表示關心）。',
  tag: '附加問句和否定問句照事實回答，問法不影響 Yes/No。'
})

export const KIND_LABEL = Object.freeze({
  when: 'When', where: 'Where', who: 'Who', what: 'What', why: 'Why', how: 'How',
  yesno: 'Yes / No', choice: 'A or B', request: '請求・提議', statement: '直述句', tag: '附加問句'
})

/** What went wrong with a wrong option, in the learner's language. */
export function trapText (trap, cue = '') {
  switch (trap) {
    case 'wh': return `答的是別的問題（${cue || '不是題目問的那一種'}）`
    case 'yesno': return '這題不能用 Yes/No 回答'
    case 'echo': return `只是重複了題目裡的 ${cue}，沒有回答問題`
    case 'sound': return `${cue} 聽起來像，意思不同`
    case 'tense': return `時間不對（${cue || '題目問的不是這個時間'}）`
    case 'subject': return '人不對：問的是 you，答的卻是 he／she'
    default: return '跟主題有關，但沒有回答問題'
  }
}

const I = (id, kind, q, zh, right, w1, w2) => ({ id, kind, q, zh, right, wrong: [w1, w2] })

export const PART2 = [
  /* ---------------- when ---------------- */
  I('w01', 'when', 'When does the meeting start?', '會議幾點開始？',
    ['At ten o’clock.', '十點。'],
    ['In the meeting room.', '在會議室。', 'wh', '地點'],
    ['Yes, it starts.', '是的，會開始。', 'yesno']),
  I('w02', 'when', 'When will the report be ready?', '報告什麼時候會好？',
    ['By Friday afternoon.', '星期五下午以前。'],
    ['It’s on your desk.', '在你桌上。', 'wh', '地點'],
    ['I read the report.', '我讀了那份報告。', 'echo', 'report']),
  I('w03', 'when', 'When did you arrive in Tokyo?', '你什麼時候到東京的？',
    ['Last night.', '昨天晚上。'],
    ['By train.', '搭火車。', 'wh', '方法'],
    ['Tomorrow morning.', '明天早上。', 'tense', '題目是過去 did']),
  I('w04', 'when', 'When is the store open?', '這家店什麼時候營業？',
    ['From nine to six.', '九點到六點。'],
    ['On Main Street.', '在大街上。', 'wh', '地點'],
    ['No, it’s closed.', '不，它關了。', 'yesno']),
  I('w05', 'when', 'When are you leaving for the airport?', '你什麼時候出發去機場？',
    ['Right after lunch.', '吃完午餐就走。'],
    ['About an hour.', '大約一小時。', 'wh', '多久'],
    ['At gate five.', '在五號登機門。', 'wh', '地點']),
  I('w06', 'when', 'When can I pick up my order?', '我什麼時候可以來拿我訂的東西？',
    ['Any time after three.', '三點以後都可以。'],
    ['At the front desk.', '在櫃檯。', 'wh', '地點'],
    ['I ordered a coffee.', '我點了一杯咖啡。', 'echo', 'order']),
  I('w07', 'when', 'When was this building built?', '這棟建築是什麼時候蓋的？',
    ['About twenty years ago.', '大約二十年前。'],
    ['Next to the bank.', '在銀行旁邊。', 'wh', '地點'],
    ['It’s a tall building.', '是一棟很高的建築。', 'echo', 'building']),

  /* ---------------- where ---------------- */
  I('h01', 'where', 'Where is the nearest station?', '最近的車站在哪裡？',
    ['Two blocks down this street.', '沿這條街走兩個路口。'],
    ['Every ten minutes.', '每十分鐘一班。', 'wh', '頻率'],
    ['Yes, it’s near.', '是的，很近。', 'yesno']),
  I('h02', 'where', 'Where did you put the keys?', '你把鑰匙放在哪裡？',
    ['On the kitchen table.', '在廚房的桌上。'],
    ['This morning.', '今天早上。', 'wh', '時間'],
    ['They’re my keys.', '那是我的鑰匙。', 'echo', 'keys']),
  I('h03', 'where', 'Where can I buy a ticket?', '我可以在哪裡買票？',
    ['At the machine over there.', '在那邊的機器。'],
    ['It costs five dollars.', '要五塊美金。', 'wh', '價錢'],
    ['I bought two.', '我買了兩張。', 'echo', 'buy']),
  I('h04', 'where', 'Where are you from?', '你是哪裡人？',
    ['I’m from Taiwan.', '我是台灣人。'],
    ['For three days.', '三天。', 'wh', '多久'],
    ['I’m fine, thanks.', '我很好，謝謝。', 'off']),
  I('h05', 'where', 'Where should I sign?', '我該簽在哪裡？',
    ['At the bottom of the page.', '這一頁的最下面。'],
    ['With a black pen.', '用黑筆。', 'wh', '用什麼'],
    ['The sign is new.', '那個招牌是新的。', 'sound', 'sign（招牌）']),
  I('h06', 'where', 'Where is the meeting being held?', '會議在哪裡開？',
    ['In the room on the second floor.', '在二樓的房間。'],
    ['At two o’clock.', '兩點。', 'wh', '時間'],
    ['Mr. Lee will hold it.', '李先生會主持。', 'wh', '誰']),
  I('h07', 'where', 'Where’s the restroom?', '洗手間在哪裡？',
    ['Down the hall, on your left.', '走廊走到底，在你左手邊。'],
    ['I need a rest.', '我需要休息。', 'sound', 'rest（休息）'],
    ['In a few minutes.', '再幾分鐘。', 'wh', '時間']),

  /* ---------------- who ---------------- */
  I('o01', 'who', 'Who is in charge of this project?', '這個專案是誰負責？',
    ['Ms. Chen is.', '陳小姐。'],
    ['It’s a big project.', '是一個很大的專案。', 'echo', 'project'],
    ['Since last month.', '從上個月開始。', 'wh', '時間']),
  I('o02', 'who', 'Who called this morning?', '今天早上誰打電話來？',
    ['Someone from the bank.', '銀行的人。'],
    ['At around nine.', '九點左右。', 'wh', '時間'],
    ['I’ll call you back.', '我再回電給你。', 'echo', 'call']),
  I('o03', 'who', 'Who’s going to pick up the client?', '誰要去接客戶？',
    ['I can do it.', '我可以去。'],
    ['At the airport.', '在機場。', 'wh', '地點'],
    ['He picked a new one.', '他挑了一個新的。', 'echo', 'pick']),
  I('o04', 'who', 'Who wrote this report?', '這份報告是誰寫的？',
    ['The sales team did.', '業務團隊寫的。'],
    ['It was written yesterday.', '是昨天寫的。', 'wh', '時間'],
    ['Yes, I read it.', '是的，我讀過了。', 'yesno']),
  I('o05', 'who', 'Who should I talk to about my room?', '房間的事我該找誰？',
    ['The manager at the front desk.', '櫃檯的經理。'],
    ['It’s a large room.', '是一間很大的房間。', 'echo', 'room'],
    ['You should talk more.', '你應該多說一點。', 'echo', 'talk']),
  I('o06', 'who', 'Who has the key to the office?', '誰有辦公室的鑰匙？',
    ['I think Tom does.', '我想是湯姆。'],
    ['In the top drawer.', '在最上面的抽屜。', 'wh', '地點'],
    ['The office is closed.', '辦公室關了。', 'echo', 'office']),

  /* ---------------- what ---------------- */
  I('t01', 'what', 'What time does the train leave?', '火車幾點開？',
    ['At half past eight.', '八點半。'],
    ['From platform two.', '從第二月台。', 'wh', '地點'],
    ['It takes two hours.', '要兩個小時。', 'wh', '多久']),
  I('t02', 'what', 'What do you do?', '你是做什麼工作的？',
    ['I’m an engineer.', '我是工程師。'],
    ['I’m doing well.', '我過得很好。', 'off'],
    ['I do it every day.', '我每天都做。', 'echo', 'do']),
  I('t03', 'what', 'What would you like to drink?', '你想喝什麼？',
    ['Just water, please.', '水就好，謝謝。'],
    ['Yes, I’d like to.', '好，我想要。', 'yesno'],
    ['I drank it already.', '我已經喝掉了。', 'echo', 'drink']),
  I('t04', 'what', 'What’s the weather like today?', '今天天氣怎麼樣？',
    ['It’s cloudy and cool.', '多雲，涼涼的。'],
    ['I like it very much.', '我非常喜歡。', 'echo', 'like'],
    ['I’m not sure whether to go.', '我不確定要不要去。', 'sound', 'whether（是否）']),
  I('t05', 'what', 'What did the customer say?', '那位客人說了什麼？',
    ['She wants her money back.', '她想要退錢。'],
    ['He’s a regular customer.', '他是常客。', 'echo', 'customer'],
    ['Yes, he did.', '是的，他說了。', 'yesno']),
  I('t06', 'what', 'What is this package for?', '這個包裹是做什麼用的？',
    ['It’s a gift for my mother.', '是給我媽媽的禮物。'],
    ['It arrived at four.', '四點送到的。', 'sound', 'four（四）'],
    ['In the mail room.', '在收發室。', 'wh', '地點']),

  /* ---------------- why ---------------- */
  I('y01', 'why', 'Why were you late this morning?', '你今天早上為什麼遲到？',
    ['The traffic was terrible.', '塞車塞得很嚴重。'],
    ['About thirty minutes.', '大約三十分鐘。', 'wh', '多久'],
    ['Yes, I was late.', '是的，我遲到了。', 'yesno']),
  I('y02', 'why', 'Why is the store closed?', '那家店為什麼沒開？',
    ['Because today is a holiday.', '因為今天放假。'],
    ['It closes at nine.', '它九點關門。', 'wh', '時間'],
    ['It’s close to my house.', '離我家很近。', 'sound', 'close（近）']),
  I('y03', 'why', 'Why did you change your flight?', '你為什麼改航班？',
    ['My meeting was moved to Monday.', '我的會議改到星期一了。'],
    ['I’d like some change, please.', '請給我一些零錢。', 'sound', 'change（零錢）'],
    ['At the airport.', '在機場。', 'wh', '地點']),
  I('y04', 'why', 'Why don’t we take a taxi?', '我們搭計程車好不好？',
    ['Good idea. It’s raining.', '好主意，在下雨。'],
    ['It took an hour.', '花了一個小時。', 'echo', 'take'],
    ['Because I don’t have one.', '因為我沒有。', 'off']),
  I('y05', 'why', 'Why is it so cold in here?', '這裡面怎麼這麼冷？',
    ['The heater isn’t working.', '暖氣壞了。'],
    ['I have a cold.', '我感冒了。', 'sound', 'a cold（感冒）'],
    ['Here you are.', '給你。', 'echo', 'here']),
  I('y06', 'why', 'Why didn’t you answer the phone?', '你為什麼沒接電話？',
    ['I was in a meeting.', '我在開會。'],
    ['The answer is no.', '答案是不行。', 'echo', 'answer'],
    ['It’s a new phone.', '是一支新手機。', 'echo', 'phone']),

  /* ---------------- how ---------------- */
  I('a01', 'how', 'How long does it take to get there?', '到那裡要多久？',
    ['About twenty minutes by bus.', '搭公車大約二十分鐘。'],
    ['It’s about two miles.', '大約兩英里。', 'wh', '距離'],
    ['I took the bus.', '我搭了公車。', 'echo', 'take']),
  I('a02', 'how', 'How much is this bag?', '這個包包多少錢？',
    ['It’s forty dollars.', '四十塊美金。'],
    ['It’s too big.', '太大了。', 'off'],
    ['I have two bags.', '我有兩個包包。', 'wh', '數量']),
  I('a03', 'how', 'How often do you travel for work?', '你多常出差？',
    ['About once a month.', '大約一個月一次。'],
    ['By plane, usually.', '通常搭飛機。', 'wh', '方法'],
    ['For two weeks.', '兩個星期。', 'wh', '多久']),
  I('a04', 'how', 'How many people are coming to dinner?', '有幾個人要來吃晚餐？',
    ['Six, including us.', '六個，包括我們。'],
    ['At seven o’clock.', '七點。', 'wh', '時間'],
    ['They’re coming by car.', '他們開車來。', 'wh', '方法']),
  I('a05', 'how', 'How do I get to the museum?', '博物館怎麼去？',
    ['Take the number five bus.', '搭五號公車。'],
    ['It opens at ten.', '它十點開。', 'wh', '時間'],
    ['I got it yesterday.', '我昨天拿到的。', 'echo', 'get']),
  I('a06', 'how', 'How was your trip?', '你的旅行怎麼樣？',
    ['It was great, thank you.', '很棒，謝謝。'],
    ['For five days.', '五天。', 'wh', '多久'],
    ['By train.', '搭火車。', 'wh', '方法']),
  I('a07', 'how', 'How would you like to pay?', '您想怎麼付款？',
    ['By credit card, please.', '刷卡，謝謝。'],
    ['I’d like that very much.', '我非常樂意。', 'echo', 'like'],
    ['It’s twenty dollars.', '二十塊美金。', 'wh', '價錢']),
  I('a08', 'how', 'How far is the hotel from here?', '飯店離這裡多遠？',
    ['About ten minutes on foot.', '走路大約十分鐘。'],
    ['I’m staying for a week.', '我要住一個星期。', 'wh', '多久'],
    ['It’s a very nice hotel.', '是一間很好的飯店。', 'echo', 'hotel']),

  /* ---------------- yes / no ---------------- */
  I('n01', 'yesno', 'Have you finished the report?', '你報告寫完了嗎？',
    ['Not yet. I need one more hour.', '還沒，我還需要一個小時。'],
    ['Yes, he has.', '是的，他寫完了。', 'subject'],
    ['The report is about sales.', '這份報告是關於銷售的。', 'echo', 'report']),
  I('n02', 'yesno', 'Is this seat taken?', '這個位子有人坐嗎？',
    ['No, go ahead.', '沒有，請坐。'],
    ['Yes, I’ll take it.', '好，我買了。', 'echo', 'take'],
    ['It’s a window seat.', '是靠窗的位子。', 'echo', 'seat']),
  I('n03', 'yesno', 'Do you have a reservation?', '您有訂位嗎？',
    ['Yes, under the name Lin.', '有，用林的名字訂的。'],
    ['At seven thirty.', '七點半。', 'wh', '時間'],
    ['It’s a nice restaurant.', '是一家不錯的餐廳。', 'off']),
  I('n04', 'yesno', 'Are you free this afternoon?', '你今天下午有空嗎？',
    ['Sorry, I have a meeting until five.', '抱歉，我開會開到五點。'],
    ['Yes, it’s free of charge.', '是的，免費。', 'sound', 'free（免費）'],
    ['It was a long afternoon.', '那是個漫長的下午。', 'echo', 'afternoon']),
  I('n05', 'yesno', 'Did you send the email to the client?', '你把電子郵件寄給客戶了嗎？',
    ['Yes, I sent it this morning.', '寄了，今天早上寄的。'],
    ['Yes, she did.', '是的，她寄了。', 'subject'],
    ['The client is from Japan.', '那位客戶是日本人。', 'echo', 'client']),
  I('n06', 'yesno', 'Can you help me with these boxes?', '你可以幫我搬這些箱子嗎？',
    ['Sure. Where do they go?', '當然，要放哪裡？'],
    ['The boxes are empty.', '箱子是空的。', 'echo', 'boxes'],
    ['No, they’re not mine.', '不，那不是我的。', 'off']),
  I('n07', 'yesno', 'Is breakfast included?', '有含早餐嗎？',
    ['Yes, it’s served from seven.', '有，七點開始供應。'],
    ['I had eggs and bread.', '我吃了蛋和麵包。', 'off'],
    ['Yes, I included it.', '是的，我把它加進去了。', 'echo', 'include']),
  I('n08', 'yesno', 'Will you be at the office tomorrow?', '你明天會在辦公室嗎？',
    ['No, I’m working from home.', '不會，我在家工作。'],
    ['Yes, I was there.', '是的，我之前在那裡。', 'tense', '題目問的是明天'],
    ['The office is on the third floor.', '辦公室在三樓。', 'echo', 'office']),

  /* ---------------- A or B ---------------- */
  I('c01', 'choice', 'Would you like coffee or tea?', '你要咖啡還是茶？',
    ['Tea, please.', '茶，謝謝。'],
    ['Yes, I would.', '是的，我要。', 'yesno'],
    ['At the coffee shop.', '在咖啡店。', 'echo', 'coffee']),
  I('c02', 'choice', 'Should we meet today or tomorrow?', '我們今天見還是明天見？',
    ['Tomorrow is better for me.', '我明天比較方便。'],
    ['Yes, we should.', '是的，我們應該。', 'yesno'],
    ['In the meeting room.', '在會議室。', 'wh', '地點']),
  I('c03', 'choice', 'Do you want to pay by cash or by card?', '您要付現還是刷卡？',
    ['Card, please.', '刷卡，謝謝。'],
    ['Yes, I’ll pay.', '好，我來付。', 'yesno'],
    ['It’s too expensive.', '太貴了。', 'off']),
  I('c04', 'choice', 'Is the meeting on the second floor or the third?', '會議在二樓還是三樓？',
    ['It’s on the third.', '在三樓。'],
    ['Yes, it is.', '是的。', 'yesno'],
    ['At three o’clock.', '三點。', 'sound', 'three（三點）']),
  I('c05', 'choice', 'Are you traveling for business or for fun?', '你是出差還是來玩？',
    ['For business this time.', '這次是出差。'],
    ['Yes, I travel a lot.', '是的，我常旅行。', 'yesno'],
    ['It’s a busy airport.', '這個機場很忙。', 'sound', 'busy（忙）']),

  /* ---------------- requests, offers, suggestions ---------------- */
  I('r01', 'request', 'Could you open the window, please?', '可以請你開窗戶嗎？',
    ['Sure, no problem.', '當然，沒問題。'],
    ['It opens at eight.', '它八點開。', 'echo', 'open'],
    ['Yes, it’s a window.', '是的，那是窗戶。', 'off']),
  I('r02', 'request', 'Can I see your passport, please?', '可以看一下您的護照嗎？',
    ['Here you are.', '在這裡，給您。'],
    ['I saw it yesterday.', '我昨天看到了。', 'echo', 'see'],
    ['It’s a nice photo.', '照片拍得不錯。', 'off']),
  I('r03', 'request', 'Would you mind waiting a few minutes?', '你介意等幾分鐘嗎？',
    ['Not at all.', '一點也不介意。'],
    ['Yes, I waited.', '是的，我等過了。', 'tense', '題目問的是現在'],
    ['I don’t mind the weight.', '我不在意重量。', 'sound', 'weight（重量）']),
  I('r04', 'request', 'Let’s have lunch together.', '我們一起吃午餐吧。',
    ['Sounds good. Where shall we go?', '好啊，要去哪裡？'],
    ['I had it at noon.', '我中午吃過了。', 'echo', 'have'],
    ['It was very good.', '很好吃。', 'tense', '還沒吃']),
  I('r05', 'request', 'Shall I call a taxi for you?', '要我幫你叫計程車嗎？',
    ['Yes, please. That would be great.', '好，麻煩你，太好了。'],
    ['He called me yesterday.', '他昨天打給我。', 'echo', 'call'],
    ['The taxi was yellow.', '那台計程車是黃色的。', 'echo', 'taxi']),
  I('r06', 'request', 'May I leave a message?', '我可以留言嗎？',
    ['Of course. Go ahead.', '當然，請說。'],
    ['He left an hour ago.', '他一小時前離開了。', 'sound', 'left（離開）'],
    ['I got your message.', '我收到你的訊息了。', 'echo', 'message']),

  /* ---------------- statements ---------------- */
  I('s01', 'statement', 'The printer is out of paper.', '印表機沒紙了。',
    ['I’ll get some more.', '我去拿一些來。'],
    ['I read the paper this morning.', '我今天早上看了報紙。', 'sound', 'paper（報紙）'],
    ['It was printed in color.', '那是彩色印的。', 'echo', 'print']),
  I('s02', 'statement', 'I think I left my phone in the taxi.', '我好像把手機忘在計程車上了。',
    ['You should call the taxi company.', '你應該打給計程車公司。'],
    ['Turn left at the corner.', '在轉角左轉。', 'sound', 'left（左邊）'],
    ['The phone is ringing.', '電話在響。', 'echo', 'phone']),
  I('s03', 'statement', 'This is my first time in Japan.', '這是我第一次來日本。',
    ['Really? I hope you enjoy it.', '真的嗎？希望你玩得開心。'],
    ['The time is nine o’clock.', '現在是九點。', 'echo', 'time'],
    ['I came in first.', '我得了第一名。', 'echo', 'first']),
  I('s04', 'statement', 'The flight has been delayed by two hours.', '班機延後兩小時。',
    ['Then we have time for lunch.', '那我們有時間吃午餐。'],
    ['It’s two hundred dollars.', '兩百塊美金。', 'echo', 'two'],
    ['I fly twice a year.', '我一年搭兩次飛機。', 'sound', 'fly（和 flight 很像）']),
  I('s05', 'statement', 'I can’t find my room key.', '我找不到我的房間鑰匙。',
    ['Let’s ask at the front desk.', '我們去櫃檯問問看。'],
    ['The room is very clean.', '房間很乾淨。', 'echo', 'room'],
    ['I found it interesting.', '我覺得那很有趣。', 'sound', 'found（覺得）']),

  /* ---------------- tag and negative questions ---------------- */
  I('g01', 'tag', 'You’ve been here before, haven’t you?', '你以前來過這裡，對吧？',
    ['Yes, twice.', '對，來過兩次。'],
    ['Before lunch.', '午餐以前。', 'echo', 'before'],
    ['No, I’m over here.', '不，我在這邊。', 'echo', 'here']),
  I('g02', 'tag', 'Isn’t the bank closed on Sundays?', '銀行星期天不是沒開嗎？',
    ['Yes, it opens again on Monday.', '對，星期一才開。'],
    ['It’s close to the station.', '離車站很近。', 'sound', 'close（近）'],
    ['I need some money.', '我需要一些錢。', 'off']),
  I('g03', 'tag', 'Didn’t you order the fish?', '你不是點魚嗎？',
    ['No, I ordered the chicken.', '不是，我點的是雞肉。'],
    ['The fish was fresh.', '魚很新鮮。', 'echo', 'fish'],
    ['Yes, he did.', '是的，他點了。', 'subject']),
  I('g04', 'tag', 'The meeting went well, didn’t it?', '會議進行得很順利，對吧？',
    ['Yes, everyone seemed happy.', '對，大家看起來都很滿意。'],
    ['I’m very well, thanks.', '我很好，謝謝。', 'sound', 'well（身體好）'],
    ['It’s in room three.', '在三號房間。', 'wh', '地點'])
]

export default PART2

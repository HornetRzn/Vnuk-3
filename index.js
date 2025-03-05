const { Telegraf } = require('telegraf');
const axios = require('axios');

const token = '8124475955:AAGfEaT9CuzUhitVUKK6oIl3rE3HSWesw3E';
const GROQ_API_KEY = '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';
const bot = new Telegraf(token);

// Хранилища
const dialogueState = new Map(); // { "chatId:userId": { step: number } }
const chatHistory = new Map(); // Для AI контекста

// Конфигурация
const settings = {
  keywords: {
    'привет': 'Да заебал ты приветами. По существу что-то будет, хомяк? Ну не расстраивай дедушкиного внука, отсоси хоть',
    'салют': 'Ты блять на празднике что ли? Какие салюты, пидр???',
    'пока': 'Щаслива в жопе слива!',
    'жопа': 'Ну.... мне больше пи'
  },
  ai: {
    model: "llama3-70b-8192",
    systemPrompt: "Ты сексуальный гей, желающий флиртовать. Отвечай кратко на русском языке."
  }
};

// Проверка реплая на бота
const isReplyToBot = (ctx) => 
  ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

// Генерация ответа через Groq
async function generateAIResponse(userId, message) {
  try {
    const history = chatHistory.get(userId) || [];
    history.push({ role: "user", content: message });

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        messages: [
          { role: "system", content: settings.ai.systemPrompt },
          ...history.slice(-3)
        ],
        model: settings.ai.model
      },
      {
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;
    history.push({ role: "assistant", content: aiReply });
    chatHistory.set(userId, history);

    return aiReply;
  } catch (error) {
    console.error("AI Error:", error);
    return "Что-то я сегодня не в форме... Давайте попробуем ещё раз?";
  }
}

// Обработчик сообщений
bot.on('message', async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const message = ctx.message.text?.toLowerCase() || '';
  const key = `${chatId}:${userId}`;
  const replyOpt = { reply_to_message_id: ctx.message.message_id };

  // Всегда проверяем ключевые слова в первую очередь
  const foundKeyword = Object.keys(settings.keywords)
    .find(k => message.includes(k));

  if (foundKeyword) {
    await ctx.reply(settings.keywords[foundKeyword], replyOpt);
    dialogueState.delete(key); // Сбрасываем диалог
    return;
  }

  // Только цепочка реплаев
  if (isReplyToBot(ctx)) {
    const state = dialogueState.get(key) || { step: 1 };

    switch(state.step) {
      case 1:
        await ctx.reply('Во мне однажды такой пассивчик был, что я чуть горло не выплюнул. Веришь?', replyOpt);
        dialogueState.set(key, { step: 2 });
        break;

      case 2:
        await ctx.reply('Интересно! В Рязани такая ебля возможна?', replyOpt);
        dialogueState.set(key, { step: 3 });
        break;

      case 3:
        const aiResponse = await generateAIResponse(userId, message);
        await ctx.reply(aiResponse, replyOpt);
        dialogueState.delete(key); // Завершаем диалог
        break;
    }
  }
});

// Команда /start
bot.command('start', (ctx) => 
  ctx.reply('Подпишись на Гей-Рязань. Пообщаемся в чате', 
    { reply_to_message_id: ctx.message.message_id }
  )
);

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));

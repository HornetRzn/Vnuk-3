const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

// Инициализация сервера
const app = express();
app.use(express.json());
app.listen(process.env.PORT || 3000);

// Конфигурация бота
const bot = new Telegraf(process.env.TOKEN);

// Настройка вебхука
const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
const webhookUrl = `https://vnuk-3.onrender.com${webhookPath}`;
bot.telegram.setWebhook(webhookUrl).catch(console.error);
app.use(bot.webhookCallback(webhookPath));

// Хранилища и конфигурация
const dialogueState = new Map();
const chatHistory = new Map();

const settings = {
  keywords: {
    'привет': 'Да заебал ты приветами. По существу что-то будет, хомяк?',
    'салют': 'Ты блять на празднике что ли?',
    'пока': 'Щаслива в жопе слива!',
    'жопа': 'Ну.... мне больше пи'
  },
  ai: {
    model: "llama3-70b-8192",
    systemPrompt: "Ты сексуальный гей, желающий флиртовать. Отвечай кратко на русском."
  }
};

// Вспомогательные функции
const isReplyToBot = (ctx) => 
  ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

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
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
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
    return "Чет я сегодня не в форме... Давай попробуем ещё раз?";
  }
}

// Обработчики
bot.on('message', async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const message = ctx.message.text?.toLowerCase() || '';
  const key = `${chatId}:${userId}`;
  const replyOpt = { reply_to_message_id: ctx.message.message_id };

  const foundKeyword = Object.keys(settings.keywords)
    .find(k => message.includes(k));

  if (foundKeyword) {
    await ctx.reply(settings.keywords[foundKeyword], replyOpt);
    dialogueState.delete(key);
    return;
  }

  if (isReplyToBot(ctx)) {
    const state = dialogueState.get(key) || { step: 1 };

    switch(state.step) {
      case 1:
        await ctx.reply('Во мне однажды такой пассивчик был...', replyOpt);
        dialogueState.set(key, { step: 2 });
        break;

      case 2:
        await ctx.reply('Интересно! В Рязани такая ебля возможна?', replyOpt);
        dialogueState.set(key, { step: 3 });
        break;

      case 3:
        const aiResponse = await generateAIResponse(userId, message);
        await ctx.reply(aiResponse, replyOpt);
        dialogueState.delete(key);
        break;
    }
  }
});

bot.command('start', (ctx) => 
  ctx.reply('Подпишись на Гей-Рязань. Пообщаемся в чате', {
    reply_to_message_id: ctx.message.message_id
  })
);

// Обработка завершения работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

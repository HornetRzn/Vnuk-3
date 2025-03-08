const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

if (!process.env.TOKEN) throw new Error('TOKEN не установлен!');
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY не установлен!');

const app = express();
app.use(express.json());
app.listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TOKEN);

const TARGET_CHAT_ID = "-1002311068598";

// Проверка прав бота
async function checkBotPermissions() {
  try {
    const chat = await bot.telegram.getChat(TARGET_CHAT_ID);
    if (chat.permissions) {
      console.log('Bot permissions:', chat.permissions);
    }
  } catch (error) {
    console.error('Permission check error:', error);
  }
}
checkBotPermissions();

// Вебхук для Render
const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
const webhookUrl = `https://vnuk-3.onrender.com${webhookPath}`;
bot.telegram.setWebhook(webhookUrl).catch(console.error);
app.use(bot.webhookCallback(webhookPath));

// Хранилища состояний
const userSessions = new Map();
const SESSION_TIMEOUT = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  userSessions.forEach((session, key) => {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      userSessions.delete(key);
      console.log(`Сессия ${key} удалена по таймауту`);
    }
  });
}, 5 * 60 * 1000);

const settings = {
  privateChatResponse: 'Я не стеснительный, поэтому люблю публичное общение 😎 Подписывайся на «ГЕЙ-РЯЗАНЬ» — https://t.me/hornetrzn',
  // ... остальные настройки ...
};

function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

const isPrivateChat = (ctx) => ctx.chat?.type === 'private';

function handlePrivateChat(ctx) {
  if (isPrivateChat(ctx)) {
    ctx.reply(settings.privateChatResponse);
    return true;
  }
  return false;
}

const isReplyToBot = (ctx) => 
  ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

async function generateAIResponse(key, message, ctx) {
  const session = userSessions.get(key);
  if (!session) return null;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        messages: [
          { role: "system", content: settings.ai.systemPrompt },
          { role: "user", content: message }
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

    session.aiResponseCount++;
    console.log(`[DEBUG] Ответов: ${session.aiResponseCount}/${settings.ai.maxResponses}`);

    session.lastActivity = Date.now();
    userSessions.set(key, session);

    if (session.aiResponseCount >= settings.ai.maxResponses) {
      ctx.reply(getRandomResponse(settings.farewellMessages), {
        reply_to_message_id: ctx.message.message_id
      });
      userSessions.delete(key);
      return null;
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error);
    return getRandomResponse([
      "Голова разболелась 🤒",
      "Чёт я торможу. Погоди...",
      "Блин. Я, кажется, телефон разбил 😳"
    ]);
  }
}

bot.command('etonensecret', async (ctx) => {
  if (isPrivateChat(ctx)) {
    // Получаем медиафайл из сообщения
    const mediaTypes = ['photo', 'video', 'audio', 'document'];
    const mediaType = mediaTypes.find(type => ctx.message[type]);
    const file = mediaType ? ctx.message[mediaType] : null;
    
    // Получаем подпись или текст
    const caption = ctx.message.caption?.replace(/^\/etonensecret\s*/, '') || '';
    const text = ctx.message.text?.replace(/^\/etonensecret\s*/, '') || '';

    if (!file && !text) {
      return ctx.reply('❌ Нужно прикрепить файл или написать текст');
    }

    try {
      if (file) {
        // Определяем метод отправки по типу медиа
        const methodMap = {
          photo: 'sendPhoto',
          video: 'sendVideo',
          audio: 'sendAudio',
          document: 'sendDocument'
        };
        
        await ctx.telegram[methodMap[mediaType]](
          TARGET_CHAT_ID, 
          mediaType === 'photo' ? file[0].file_id : file.file_id,
          { caption: caption || text }
        );
      } else {
        await ctx.telegram.sendMessage(TARGET_CHAT_ID, text);
      }

      // Создаем сессию только после успешной отправки
      const initiatorKey = `${TARGET_CHAT_ID}:${ctx.from.id}`;
      userSessions.set(initiatorKey, {
        step: 1,
        inAIMode: false,
        aiResponseCount: 0,
        lastActivity: Date.now()
      });

      ctx.reply("✅ Контент отправлен! Ответь на него в целевом чате.");
    } catch (error) {
      console.error('Send error:', error);
      ctx.reply(`❌ Ошибка отправки: ${error.message}`);
    }
  } else {
    ctx.reply('Эта команда работает только в личных сообщениях');
  }
});

bot.on('message', async (ctx) => {
  console.log('Получено сообщение:', {
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    text: ctx.message.text,
    isReply: !!ctx.message.reply_to_message
  });

  if (handlePrivateChat(ctx)) return;

  // Обработка стикеров
  if (isReplyToBot(ctx) && ctx.message.reply_to_message?.sticker) {
    await ctx.reply(getRandomResponse(settings.stickerReplyPhrases), {
      reply_to_message_id: ctx.message.message_id
    });
    userSessions.delete(`${ctx.chat.id}:${ctx.from.id}`);
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const key = `${chatId}:${userId}`;
  const message = ctx.message.text?.toLowerCase() || '';
  
  let session = userSessions.get(key) || { 
    step: 0, 
    inAIMode: false,
    aiResponseCount: 0,
    lastActivity: Date.now()
  };

  // Реакция на ключевые слова
  if (!session.inAIMode && !isReplyToBot(ctx)) {
    const keyword = Object.keys(settings.keywords).find(k => message.includes(k));
    
    if (keyword) {
      if (Array.isArray(settings.keywords[keyword])) {
        await ctx.reply(getRandomResponse(settings.keywords[keyword]), {
          reply_to_message_id: ctx.message.message_id
        });
      } else {
        await ctx.replyWithSticker(settings.keywords[keyword], {
          reply_to_message_id: ctx.message.message_id
        });
      }
      session.step = 1;
      session.lastActivity = Date.now();
      userSessions.set(key, session);
      return;
    }
  }

  // Пошаговая логика ответов
  if (isReplyToBot(ctx)) {
    if (session.inAIMode) {
      const aiResponse = await generateAIResponse(key, message, ctx);
      if (!aiResponse) return;
      await ctx.reply(aiResponse, {
        reply_to_message_id: ctx.message.message_id
      });
      return;
    }

    switch(session.step) {
      case 1:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step1), {
          reply_to_message_id: ctx.message.message_id
        });
        session.step = 2;
        break;

      case 2:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step2), {
          reply_to_message_id: ctx.message.message_id
        });
        session.step = 3;
        session.inAIMode = true;
        break;

      default:
        await ctx.reply(getRandomResponse([
          "Вот прям извини, малыш 😔 немного не до тебя сейчас. Позже договорим, если не забудем. Чмокаю тебя в попку 💋",
          "Ой. Да погоди ты. Я же уже писал - в Рзн опять приехал мой бывший, достал меня звонками сука. Потом продолжим с тобой беседу, если что. Я напишу!"
        ]), {
          reply_to_message_id: ctx.message.message_id
        });
    }

    session.lastActivity = Date.now();
    userSessions.set(key, session);
  }
});

bot.catch((err, ctx) => {
  console.error(`Ошибка: ${err.message} в сообщении:`, ctx.update);
  ctx.reply("⚠️ Упс, что-то сломалось! Попробуй еще раз.").catch(console.error);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

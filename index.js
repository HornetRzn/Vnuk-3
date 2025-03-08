const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

if (!process.env.TOKEN) throw new Error('TOKEN не установлен!');
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY не установлен!');

const app = express();
app.use(express.json());
app.listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TOKEN);
const TARGET_CHAT_ID = "-1002311068598"; // Замените на ваш целевой чат

// Проверка прав бота в целевом чате
async function checkBotPermissions() {
  try {
    const chat = await bot.telegram.getChat(TARGET_CHAT_ID);
    console.log('Права бота:', chat.permissions);
  } catch (error) {
    console.error('Ошибка проверки прав:', error);
  }
}
checkBotPermissions();

// Вебхук для Render
const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
const webhookUrl = `https://vnuk-3.onrender.com${webhookPath}`;
bot.telegram.setWebhook(webhookUrl).catch(console.error);
app.use(bot.webhookCallback(webhookPath));

// Хранилище сессий пользователей
const userSessions = new Map();
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 минут

// Очистка старых сессий
setInterval(() => {
  const now = Date.now();
  userSessions.forEach((session, key) => {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      userSessions.delete(key);
      console.log(`Сессия ${key} удалена`);
    }
  });
}, 5 * 60 * 1000); // Каждые 5 минут

// Настройки ответов
const settings = {
  privateChatResponse: 'Общайтесь со мной в группе: https://t.me/hornetrzn',
  keywords: {
    // ... (ваши ключевые слова и стикеры) ...
  },
  farewellMessages: [
    'Пока! Напишите позже.',
    'До связи!'
  ],
  dialogResponses: {
    step1: ['Ответ 1', 'Ответ 2'],
    step2: ['Ответ 3', 'Ответ 4']
  },
  stickerReplyPhrases: ['Стикер получен!'],
  ai: {
    model: "llama3-70b-8192",
    systemPrompt: "Вы играете роль гей-бота...",
    maxResponses: 10
  }
};

// Генерация случайного ответа
function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

// Проверка приватного чата
const isPrivateChat = (ctx) => ctx.chat?.type === 'private';

// Обработка приватного чата
function handlePrivateChat(ctx) {
  if (isPrivateChat(ctx)) {
    ctx.reply(settings.privateChatResponse);
    return true;
  }
  return false;
}

// Проверка ответа боту
const isReplyToBot = (ctx) => 
  ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id;

// Генерация AI-ответа
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
    return "Ошибка генерации ответа";
  }
}

// Команда для отправки медиа
bot.command('etonensecret', async (ctx) => {
  if (isPrivateChat(ctx)) {
    const mediaTypes = ['photo', 'video', 'audio', 'document'];
    const mediaType = mediaTypes.find(type => ctx.message[type]);
    const file = mediaType ? ctx.message[mediaType] : null;
    const caption = ctx.message.caption?.replace(/^\/etonensecret\s*/, '') || '';

    if (!file && !ctx.message.text) {
      return ctx.reply('❌ Прикрепите файл или напишите текст');
    }

    try {
      if (file) {
        const methodMap = {
          photo: 'sendPhoto',
          video: 'sendVideo',
          audio: 'sendAudio',
          document: 'sendDocument'
        };
        
        await ctx.telegram[methodMap[mediaType]](
          TARGET_CHAT_ID, 
          mediaType === 'photo' ? file[0].file_id : file.file_id,
          { caption }
        );
      } else {
        await ctx.telegram.sendMessage(TARGET_CHAT_ID, ctx.message.text);
      }

      ctx.reply("✅ Контент отправлен!");
    } catch (error) {
      console.error('Send error:', error);
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  } else {
    ctx.reply('Команда работает только в личных сообщениях');
  }
});

// Обработчик всех сообщений
bot.on('message', async (ctx) => {
  console.log('Получено сообщение:', {
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    text: ctx.message.text,
    media: ctx.message.photo || ctx.message.video || ctx.message.document
  });

  if (handlePrivateChat(ctx)) return;

  // Обработка медиа
  const mediaTypes = ['photo', 'video', 'document'];
  const mediaType = mediaTypes.find(type => ctx.message[type]);
  
  if (mediaType) {
    try {
      const file = mediaType === 'photo' 
        ? ctx.message.photo[ctx.message.photo.length - 1] 
        : ctx.message[mediaType];
      
      await ctx.telegram.sendMessage(
        TARGET_CHAT_ID,
        `📤 Медиа от @${ctx.from.username}\nТип: ${mediaType}`
      );
      
      await ctx.telegram[`send${mediaType[0].toUpperCase() + mediaType.slice(1)}`](
        TARGET_CHAT_ID,
        file.file_id
      );
      
      return ctx.reply("✅ Медиа отправлено!");
    } catch (error) {
      console.error('Media error:', error);
      return ctx.reply("❌ Ошибка отправки медиа");
    }
  }

  // Обработка текста
  const key = `${ctx.chat.id}:${ctx.from.id}`;
  let session = userSessions.get(key) || { 
    step: 0, 
    inAIMode: false,
    aiResponseCount: 0,
    lastActivity: Date.now()
  };

  if (!session.inAIMode && !isReplyToBot(ctx)) {
    const keyword = Object.keys(settings.keywords).find(k => ctx.message.text?.includes(k));
    if (keyword) {
      if (Array.isArray(settings.keywords[keyword])) {
        await ctx.reply(getRandomResponse(settings.keywords[keyword]));
      } else {
        await ctx.replyWithSticker(settings.keywords[keyword]);
      }
      session.step = 1;
      session.lastActivity = Date.now();
      userSessions.set(key, session);
      return;
    }
  }

  if (isReplyToBot(ctx)) {
    if (session.inAIMode) {
      const aiResponse = await generateAIResponse(key, ctx.message.text, ctx);
      if (aiResponse) await ctx.reply(aiResponse);
      return;
    }

    switch(session.step) {
      case 1:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step1));
        session.step = 2;
        break;
      case 2:
        await ctx.reply(getRandomResponse(settings.dialogResponses.step2));
        session.inAIMode = true;
        break;
      default:
        await ctx.reply(getRandomResponse(settings.farewellMessages));
    }
    session.lastActivity = Date.now();
    userSessions.set(key, session);
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка: ${err.message}`);
  ctx.reply("⚠️ Произошла ошибка").catch(console.error);
});

// Завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Роут для проверки работы
app.get('/', (req, res) => {
  res.send('Бот активен');
});

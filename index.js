require("dotenv").config();

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 3002;
const telegramBotToken = cleanValue(process.env.TELEGRAM_BOT_TOKEN);
const geminiApiKey = cleanValue(process.env.GEMINI_API_KEY);
const geminiModel = cleanValue(process.env.GEMINI_MODEL || "gemini-1.5-flash");

const wikiBotInstructions = `You are WikiBot, an AI assistant that answers questions in the style of Wikipedia.

Rules:
- Be neutral and factual.
- Base answers on well-established knowledge.
- Organize information with headings.
- Start with a concise summary.
- Explain history, background, key facts, and significance.
- Mention different viewpoints if they exist.
- Distinguish facts from opinions.
- If information is uncertain, clearly state that.
- Avoid speculation or fabricated facts.
- Use clear, encyclopedic language.
- When possible, include dates, people, locations, and related topics.
- End with a short "See also" section suggesting related topics.`;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "WikiBot backend is running",
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/gemini/ask", async (req, res) => {
  const prompt = req.body?.prompt;

  if (!prompt) {
    return res.status(400).json({
      ok: false,
      error: "prompt is required",
    });
  }

  try {
    const reply = await askGemini(prompt);
    return res.json({ ok: true, prompt, reply });
  } catch (error) {
    console.error("Gemini ask error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "failed_to_ask_gemini",
    });
  }
});

app.get("/wikipedia/summary/:title", async (req, res) => {
  try {
    const summary = await getWikipediaSummary(req.params.title);
    return res.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Wikipedia summary error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "failed_to_fetch_wikipedia_summary",
    });
  }
});

let bot = null;

if (telegramBotToken && geminiApiKey) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  bot = new TelegramBot(telegramBotToken, { polling: true });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const pesanUser = msg.text;

    if (!pesanUser) return;

    try {
      await bot.sendChatAction(chatId, "typing");

      const normalizedText = pesanUser.trim();

      if (normalizedText.toLowerCase().startsWith("/wiki ")) {
        const wikiTitle = normalizedText.slice(6).trim();

        if (!wikiTitle) {
          await bot.sendMessage(chatId, "Pakai format: /wiki Earth");
          return;
        }

        const summary = await getWikipediaSummary(wikiTitle);
        await bot.sendMessage(chatId, formatWikipediaReply(summary));
        return;
      }

      const model = genAI.getGenerativeModel({
        model: geminiModel,
        systemInstruction: wikiBotInstructions,
      });

      const result = await model.generateContent(pesanUser);
      const jawabanGemini = result.response.text();

      await bot.sendMessage(chatId, jawabanGemini);
    } catch (error) {
      console.error("Terjadi kesalahan:", error);
      await bot.sendMessage(
        chatId,
        "Maaf, sistemku sedang bermasalah atau API Limit tercapai.",
      );
    }
  });

  console.log("Bot Telegram siap dan sedang mendengarkan pesan...");
} else {
  console.warn(
    "TELEGRAM_BOT_TOKEN atau GEMINI_API_KEY belum diset, bot polling tidak dijalankan.",
  );
}

async function askGemini(prompt) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    systemInstruction: wikiBotInstructions,
  });

  const result = await model.generateContent(prompt);
  const reply = result.response.text();

  if (!reply) {
    throw new Error("Gemini returned an empty response");
  }

  return reply;
}

async function getWikipediaSummary(title) {
  const response = await axios.get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const data = response.data || {};

  if (!data.extract) {
    throw new Error(`Wikipedia page not found for "${title}"`);
  }

  return {
    title: data.title || title,
    extract: data.extract,
    description: data.description || "",
    url:
      data.content_urls?.desktop?.page || data.content_urls?.mobile?.page || "",
  };
}

function formatWikipediaReply(summary) {
  const lines = [
    `Wikipedia: ${summary.title}`,
    summary.description ? summary.description : null,
    summary.extract,
    summary.url ? `Sumber: ${summary.url}` : null,
  ].filter(Boolean);

  return lines.join("\n\n");
}

function cleanValue(value) {
  if (!value) {
    return value;
  }

  return String(value).trim().replace(/;$/, "");
}

app.listen(port, () => {
  console.log(`WikiBot backend listening on port ${port}`);
});

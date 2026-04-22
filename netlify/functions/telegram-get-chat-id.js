exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: "Method not allowed" })
      };
    }

    const { token, mode } = JSON.parse(event.body || "{}");

    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Token is required" })
      };
    }

    let cleanToken = String(token).trim();
    if (cleanToken.toLowerCase().startsWith("bot")) {
      cleanToken = cleanToken.substring(3);
    }

    if (mode === "verify") {
      const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const data = await response.json();

      if (!data.ok) {
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: false, error: "Bot token غير صحيح" })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          bot_name: data.result?.username || data.result?.first_name || "Bot"
        })
      };
    }

    const updatesResponse = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates`);
    const updatesData = await updatesResponse.json();

    if (!updatesData.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: `تعذر قراءة updates من البوت: ${updatesData.description || ''}` })
      };
    }

    const updates = updatesData.result || [];

    if (!updates.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          error: "ماكو Chat ID بعد. أرسل /start للبوت أولاً ثم أعد المحاولة"
        })
      };
    }

    const lastUpdate = updates[updates.length - 1];
    const chatId =
      lastUpdate?.message?.chat?.id ||
      lastUpdate?.channel_post?.chat?.id ||
      lastUpdate?.my_chat_member?.chat?.id ||
      null;

    if (!chatId) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          error: "تعذر استخراج Chat ID من آخر update"
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        chat_id: String(chatId)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: error.message || "Server error"
      })
    };
  }
};

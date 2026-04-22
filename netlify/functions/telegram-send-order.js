const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { landing_id, name, phone, province, district, area } = body;

    if (!landing_id || !name || !phone || !province || !district || !area) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing required fields" })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: page, error: pageError } = await supabase
      .from("landing_pages")
      .select("title,telegram_token,telegram_chat_id")
      .eq("id", landing_id)
      .single();

    if (pageError || !page) {
      return {
        statusCode: 404,
        body: JSON.stringify({ ok: false, error: "Landing page not found" })
      };
    }

    if (!page.telegram_token || !page.telegram_chat_id) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: "البوت أو Chat ID غير مضبوط لهذه الصفحة" })
      };
    }

    const message =
      `🛒 طلب جديد\n` +
      `الصفحة: ${page.title}\n` +
      `الاسم: ${name}\n` +
      `الهاتف: ${phone}\n` +
      `المحافظة: ${province}\n` +
      `القضاء: ${district}\n` +
      `المنطقة: ${area}`;

    let botToken = String(page.telegram_token).trim();
    if (botToken.toLowerCase().startsWith("bot")) {
      botToken = botToken.substring(3);
    }
    const chatId = String(page.telegram_chat_id).trim();

    const tgResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      }
    );

    const textResponse = await tgResponse.text();
    let tgData;
    try {
      tgData = JSON.parse(textResponse);
    } catch (e) {
      console.error("Failed to parse Telegram response:", textResponse);
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          error: "استجابة غير متوقعة من تليكرام"
        })
      };
    }

    if (!tgData.ok) {
      console.error("Telegram error:", tgData);
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          error: `فشل إرسال الطلب للبوت: ${tgData.description || 'خطأ غير معروف'}`
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("Send order error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: error.message || "Server error"
      })
    };
  }
};

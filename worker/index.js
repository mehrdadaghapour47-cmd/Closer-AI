export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // =========================
    // HEALTH CHECK
    // =========================
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json(
        {
          success: true,
          service: "Closer AI",
          ai: Boolean(env.AI),
          database: Boolean(env.closer_ai_db)
        },
        cors
      );
    }

    // =========================
    // AI SALES AGENT
    // =========================
    if (url.pathname === "/api/agent" && request.method === "POST") {
      try {
        const body = await request.json();

        const message = String(body.message || "").trim();

        if (!message) {
          return json(
            {
              success: false,
              error: "پیام مشتری الزامی است."
            },
            cors,
            400
          );
        }

        if (!env.AI) {
          return json(
            {
              success: false,
              error: "AI binding تنظیم نشده است."
            },
            cors,
            500
          );
        }

        const prompt = [
          "You are Closer AI, a concise Persian sales assistant for a small business.",
          "Never invent prices, availability, guarantees, delivery times, or policies.",
          "Use only the supplied business information.",
          "",
          "Business:",
          String(body.business || ""),
          "",
          "Product/service:",
          String(body.product || ""),
          "",
          "Business knowledge:",
          String(body.knowledge || ""),
          "",
          "Customer message:",
          message,
          "",
          "Return exactly these sections in Persian:",
          "پاسخ پیشنهادی:",
          "نیت مشتری:",
          "اطلاعات Lead موردنیاز:",
          "قدم بعدی فروش:",
          "",
          "Keep the response natural, useful, and concise."
        ].join("\n");

        const result = await env.AI.run(
          "@cf/zai-org/glm-4.7-flash",
          {
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          }
        );

        // =========================
        // SAFE AI RESPONSE PARSING
        // =========================
        let response = null;

        if (typeof result === "string") {
          response = result;
        } else if (typeof result?.response === "string") {
          response = result.response;
        } else if (typeof result?.result?.response === "string") {
          response = result.result.response;
        }

        if (!response || !response.trim()) {
          return json(
            {
              success: false,
              error: "AI پاسخ متنی قابل استفاده برنگرداند."
            },
            cors,
            502
          );
        }

        const cleanResponse = response.trim();

        // =========================
        // LEAD INTENT DETECTION
        // =========================
        let intent = "استعلام";
        let nextStep = "پاسخ به مشتری و ادامه گفتگو";

        if (/قیمت|هزینه|چنده|چند|تومان|یورو|دلار/.test(message)) {
          intent = "استعلام قیمت";
          nextStep = "قیمت و شرایط خرید را برای مشتری ارسال کن";
        } else if (
          /خرید|می.?خرم|ثبت.?نام|سفارش|رزرو|پرداخت/.test(message)
        ) {
          intent = "آماده خرید";
          nextStep = "اطلاعات لازم برای ثبت سفارش یا پرداخت را دریافت کن";
        } else if (
          /مشاوره|اطلاعات|توضیح|چطور|شرایط|ویژگی/.test(message)
        ) {
          intent = "نیاز به اطلاعات";
          nextStep = "اطلاعات موردنیاز را بده و برای اقدام بعدی سؤال مشخص بپرس";
        }

        // =========================
        // SAVE LEAD TO D1
        // =========================
        let leadSaved = false;

        if (env.closer_ai_db) {
          try {
            const leadName =
              String(body.name || "مشتری").trim() || "مشتری";

            await env.closer_ai_db
              .prepare(
                `INSERT INTO leads
                  (name, message, intent, status, next_step, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`
              )
              .bind(
                leadName,
                message,
                intent,
                "جدید",
                nextStep,
                new Date().toISOString()
              )
              .run();

            leadSaved = true;
          } catch (leadError) {
            console.error("Lead save failed:", leadError);
          }
        }

        // =========================
        // FINAL RESPONSE
        // =========================
        return json(
          {
            success: true,
            response: cleanResponse,
            lead: {
              saved: leadSaved,
              intent,
              status: "جدید",
              next_step: nextStep
            }
          },
          cors
        );
      } catch (error) {
        console.error("Agent error:", error);

        return json(
          {
            success: false,
            error: "خطایی در پردازش درخواست رخ داد."
          },
          cors,
          500
        );
      }
    }

    // =========================
    // UNKNOWN ROUTE
    // =========================
    return json(
      {
        success: false,
        error: "مسیر درخواست پیدا نشد."
      },
      cors,
      404
    );
  }
};

// =========================
// JSON HELPER
// =========================
function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

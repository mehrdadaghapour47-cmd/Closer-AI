var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        success: true,
        service: "Closer AI",
        ai: Boolean(env.AI),
        db: Boolean(env.closer_ai_db)
      }, cors);
    }
    if (url.pathname === "/api/leads" && request.method === "GET") {
      try {
        const { results } = await env.closer_ai_db.prepare("SELECT * FROM leads ORDER BY id DESC").all();
        return json({ success: true, leads: results }, cors);
      } catch (error) {
        return json({ success: false, error: String(error) }, cors, 500);
      }
    }
    if (url.pathname === "/api/leads" && request.method === "POST") {
      try {
        const body = await request.json();
        const name = String(body.name || "مشتری جدید").trim();
        const message = String(body.message || "").trim();
        const intent = String(body.intent || "").trim();
        const status = String(body.status || "جدید").trim();
        const nextStep = String(body.next_step || "").trim();
        if (!message) {
          return json({
            success: false,
            error: "پیام مشتری الزامی است."
          }, cors, 400);
        }
        const result = await env.closer_ai_db.prepare(
          "INSERT INTO leads (name, message, intent, status, next_step) VALUES (?, ?, ?, ?, ?)"
        ).bind(name, message, intent, status, nextStep).run();
        return json({
          success: true,
          id: result.meta?.last_row_id
        }, cors, 201);
      } catch (error) {
        return json({ success: false, error: String(error) }, cors, 500);
      }
    }
    if (url.pathname.startsWith("/api/leads/") && request.method === "PATCH") {
      try {
        const id = url.pathname.split("/").pop();
        const body = await request.json();
        const fields = [];
        const values = [];
        const allowedFields = ["name", "message", "intent", "status", "next_step"];
        for (const field of allowedFields) {
          if (body[field] !== void 0) {
            fields.push(`${field} = ?`);
            values.push(String(body[field]));
          }
        }
        if (!fields.length) {
          return json({
            success: false,
            error: "هیچ تغییری ارسال نشده است."
          }, cors, 400);
        }
        const result = await env.closer_ai_db.prepare(`UPDATE leads SET ${fields.join(", ")} WHERE id = ?`).bind(...values, id).run();
        return json({
          success: true,
          updated: result.meta?.changes || 0
        }, cors);
      } catch (error) {
        return json({ success: false, error: String(error) }, cors, 500);
      }
    }
    if (url.pathname.startsWith("/api/leads/") && request.method === "DELETE") {
      try {
        const id = url.pathname.split("/").pop();
        const result = await env.closer_ai_db.prepare("DELETE FROM leads WHERE id = ?").bind(id).run();
        return json({
          success: true,
          deleted: result.meta?.changes || 0
        }, cors);
      } catch (error) {
        return json({ success: false, error: String(error) }, cors, 500);
      }
    }
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
        let response = null;
        if (typeof result === "string") {
          response = result;
        } else if (typeof result?.response === "string" && result.response.trim()) {
          response = result.response;
        } else if (result?.choices?.[0]?.message?.content) {
          response = result.choices[0].message.content;
        } else if (typeof result?.result?.response === "string" && result.result.response.trim()) {
          response = result.result.response;
        } else if (result?.result?.choices?.[0]?.message?.content) {
          response = result.result.choices[0].message.content;
        }
        if (!response) {
          return json(
            {
              success: false,
              error: "AI returned an unsupported response format"
            },
            cors,
            502
          );
        }
        return json(
          {
            success: true,
            response
          },
          cors
        );
      } catch (error) {
        return json(
          {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          },
          cors,
          500
        );
      }
    }

    // Any other GET request: serve the PWA shell (index.html, manifest,
    // sw.js, icons) from Assets. Falls back to the old plain-text
    // response only if the Assets binding isn't configured yet.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Closer AI", {
      status: 200,
      headers: {
        ...cors,
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
};
function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "content-type": "application/json; charset=utf-8"
    }
  });
}
__name(json, "json");
export {
  index_default as default
};

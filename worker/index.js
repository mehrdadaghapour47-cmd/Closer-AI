
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
          

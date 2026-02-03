"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface PostalCodeResult {
  postalCode: string | null;
  confidence: "high" | "medium" | "low";
  error?: string;
}

/**
 * 住所から郵便番号を推定する
 * Claude Haikuを使用して低コストで実行
 */
export async function estimatePostalCode(
  prefecture: string,
  city: string,
  street?: string
): Promise<PostalCodeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. Available env vars:", Object.keys(process.env).filter(k => k.includes("ANTHROPIC") || k.includes("API")));
    return {
      postalCode: null,
      confidence: "low",
      error: "APIキーが設定されていません",
    };
  }

  if (!prefecture || !city) {
    return {
      postalCode: null,
      confidence: "low",
      error: "都道府県と市区町村を入力してください",
    };
  }

  const address = [prefecture, city, street].filter(Boolean).join("");

  try {
    // クライアントを関数内で初期化（環境変数の遅延読み込み対応）
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `以下の日本の住所の郵便番号を答えてください。
郵便番号のみを7桁の数字（ハイフンなし）で回答してください。
わからない場合は「不明」と回答してください。

住所: ${address}

郵便番号:`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // 7桁の数字を抽出
    const postalCodeMatch = responseText.match(/\d{7}/);

    if (postalCodeMatch) {
      const postalCode = postalCodeMatch[0];
      // 番地まで入力されていれば高信頼度、市区町村までなら中信頼度
      const confidence = street ? "high" : "medium";
      return { postalCode, confidence };
    }

    return {
      postalCode: null,
      confidence: "low",
      error: "郵便番号を特定できませんでした",
    };
  } catch (error) {
    console.error("Error estimating postal code:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      postalCode: null,
      confidence: "low",
      error: `API呼び出しに失敗しました: ${errorMessage}`,
    };
  }
}

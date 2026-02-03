"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface PostalCodeResult {
  postalCode: string | null;
  confidence: "high" | "medium" | "low";
  error?: string;
}

/**
 * 住所から郵便番号を推定する
 * Claude Sonnetを使用
 */
export async function estimatePostalCode(
  prefecture: string,
  city: string,
  street?: string,
  companyName?: string
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

    const prompt = `以下の日本の住所の郵便番号を答えてください。
郵便番号のみを7桁の数字（ハイフンなし）で回答してください。
わからない場合は「不明」と回答してください。
${companyName ? `\n会社名: ${companyName}` : ""}
住所: ${address}

郵便番号:`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // 7桁連続 or ハイフン付き（XXX-XXXX）の郵便番号を抽出
    const postalCodeMatch = responseText.match(/(\d{7})/)?.[1]
      || responseText.match(/(\d{3})-?(\d{4})/)?.[0]?.replace("-", "");

    if (postalCodeMatch && postalCodeMatch.length === 7) {
      const postalCode = postalCodeMatch;
      return { postalCode, confidence: "medium", error: `[デバッグ] プロンプト: ${prompt} | 応答: ${responseText}` };
    }

    return {
      postalCode: null,
      confidence: "low",
      error: `郵便番号を特定できませんでした [デバッグ] プロンプト: ${prompt} | 応答: ${responseText}`,
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

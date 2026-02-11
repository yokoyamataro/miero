"use server";

export interface PostalCodeResult {
  postalCode: string | null;
  confidence: "high" | "medium" | "low";
  error?: string;
}

export interface AddressResult {
  prefecture: string | null;
  city: string | null;
  street: string | null;
  error?: string;
}

/**
 * 郵便番号から住所を検索する
 * zipcloud API（無料・登録不要）を使用
 * https://zipcloud.ibsnet.co.jp/doc/api
 */
export async function lookupAddressByPostalCode(
  postalCode: string
): Promise<AddressResult> {
  // ハイフンを除去して7桁にする
  const cleanPostalCode = postalCode.replace(/-/g, "").trim();

  if (!/^\d{7}$/.test(cleanPostalCode)) {
    return {
      prefecture: null,
      city: null,
      street: null,
      error: "7桁の郵便番号を入力してください",
    };
  }

  try {
    const url = `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanPostalCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        prefecture: null,
        city: null,
        street: null,
        error: `API呼び出しに失敗しました（${response.status}）`,
      };
    }

    const data = await response.json();

    if (data.status !== 200 || !data.results || data.results.length === 0) {
      return {
        prefecture: null,
        city: null,
        street: null,
        error: "該当する住所が見つかりませんでした",
      };
    }

    const result = data.results[0];
    return {
      prefecture: result.address1 || null,
      city: result.address2 || null,
      street: result.address3 || null,
    };
  } catch (error) {
    console.error("Error looking up address:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      prefecture: null,
      city: null,
      street: null,
      error: `API呼び出しに失敗しました: ${errorMessage}`,
    };
  }
}

/**
 * 住所から郵便番号を検索する
 * ExcelAPI（無料・登録不要）を使用
 * https://excelapi.org/post/zipcode/
 */
export async function estimatePostalCode(
  prefecture: string,
  city: string,
  street?: string,
  companyName?: string
): Promise<PostalCodeResult> {
  if (!prefecture || !city) {
    return {
      postalCode: null,
      confidence: "low",
      error: "都道府県と市区町村を入力してください",
    };
  }

  const address = [prefecture, city, street].filter(Boolean).join("");

  try {
    const url = `https://api.excelapi.org/post/zipcode?address=${encodeURIComponent(address)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        postalCode: null,
        confidence: "low",
        error: `API呼び出しに失敗しました（${response.status}）`,
      };
    }

    const responseText = (await response.text()).trim();

    // 7桁連続 or ハイフン付き（XXX-XXXX）の郵便番号を抽出
    const postalCodeMatch = responseText.match(/(\d{7})/)?.[1]
      || responseText.match(/(\d{3})-?(\d{4})/)?.[0]?.replace("-", "");

    if (postalCodeMatch && postalCodeMatch.length === 7) {
      return { postalCode: postalCodeMatch, confidence: "high" };
    }

    return {
      postalCode: null,
      confidence: "low",
      error: "郵便番号を特定できませんでした",
    };
  } catch (error) {
    console.error("Error looking up postal code:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      postalCode: null,
      confidence: "low",
      error: `API呼び出しに失敗しました: ${errorMessage}`,
    };
  }
}

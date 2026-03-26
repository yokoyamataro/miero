/**
 * Dropbox API クライアント
 * 業務フォルダの自動作成に使用
 */

import { type ProjectCategory } from "@/types/database";

// カテゴリからフォルダ名へのマッピング
const CATEGORY_FOLDER_MAP: Record<ProjectCategory, string> = {
  A_Survey: "A_一般測量",
  B_Boundary: "B_境界測量",
  C_Registration: "C_不動産登記",
  D_Inheritance: "D_遺言・相続",
  E_Corporate: "E_法人関係",
  F_Drone: "F_ドローン",
  N_Farmland: "N_農地関係",
  S_General: "S_総務",
  Z_Other: "Z_その他",
};

interface DropboxCreateFolderResponse {
  metadata?: {
    id: string;
    name: string;
    path_lower: string;
    path_display: string;
  };
  error_summary?: string;
}

interface DropboxErrorResponse {
  error_summary: string;
  error: {
    ".tag": string;
  };
}

/**
 * Dropboxフォルダを作成
 */
export async function createDropboxFolder(path: string): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    return { success: false, error: "DROPBOX_ACCESS_TOKEN is not configured" };
  }

  try {
    const response = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path,
        autorename: false,
      }),
    });

    if (response.ok) {
      const data: DropboxCreateFolderResponse = await response.json();
      return {
        success: true,
        path: data.metadata?.path_display || path,
      };
    }

    // エラーハンドリング
    const errorData: DropboxErrorResponse = await response.json();

    // フォルダが既に存在する場合は成功として扱う
    if (errorData.error?.[".tag"] === "path" &&
        errorData.error_summary?.includes("conflict")) {
      return {
        success: true,
        path: path,
      };
    }

    return {
      success: false,
      error: errorData.error_summary || "Unknown error",
    };
  } catch (error) {
    console.error("Dropbox API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * 業務用フォルダパスを生成
 * 形式: /Dropbox共通フォルダ/{カテゴリフォルダ}/{年度}/{業務コード}_{業務名}/
 */
export function generateProjectFolderPath(
  category: ProjectCategory,
  projectCode: string,
  projectName: string,
  fiscalYear?: number
): string {
  const basePath = process.env.DROPBOX_BASE_PATH || "/Dropbox共通フォルダ";
  const categoryFolder = CATEGORY_FOLDER_MAP[category];

  // 年度を取得（4月始まり）
  const now = new Date();
  const year = fiscalYear || (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);
  const yearFolder = `${year}年度`;

  // フォルダ名を生成（業務コード_業務名）
  // 禁止文字を除去
  const sanitizedName = projectName
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  const folderName = `${projectCode}_${sanitizedName}`;

  return `${basePath}/${categoryFolder}/${yearFolder}/${folderName}`;
}

/**
 * 業務作成時にDropboxフォルダを自動作成
 */
export async function createProjectFolder(
  category: ProjectCategory,
  projectCode: string,
  projectName: string
): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  const folderPath = generateProjectFolderPath(category, projectCode, projectName);

  const result = await createDropboxFolder(folderPath);

  if (result.success) {
    console.log(`Created Dropbox folder: ${result.path}`);
  } else {
    console.error(`Failed to create Dropbox folder: ${result.error}`);
  }

  return result;
}

/**
 * Dropbox共有リンクを取得
 */
export async function getDropboxSharedLink(path: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    return { success: false, error: "DROPBOX_ACCESS_TOKEN is not configured" };
  }

  try {
    // まず既存の共有リンクを確認
    const listResponse = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path,
        direct_only: true,
      }),
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      if (listData.links && listData.links.length > 0) {
        return { success: true, url: listData.links[0].url };
      }
    }

    // 共有リンクがなければ新規作成
    const createResponse = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path,
        settings: {
          requested_visibility: "team_only",
          access: "viewer",
        },
      }),
    });

    if (createResponse.ok) {
      const data = await createResponse.json();
      return { success: true, url: data.url };
    }

    const errorData = await createResponse.json();
    return {
      success: false,
      error: errorData.error_summary || "Failed to create shared link",
    };
  } catch (error) {
    console.error("Dropbox shared link error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

# 業務管理システム開発仕様書 (Spec.md)

## 1. プロジェクト概要
測量・登記・行政書士業務・ドローン事業など、多岐にわたる業務を一元管理するERPライクなWebアプリケーション。
Googleスプレッドシートでの管理から脱却し、PostgreSQLを用いたリレーショナルかつ柔軟なデータ管理を目指す。

## 2. 技術スタック
- **Frontend**: Next.js (App Router), TypeScript
- **UI Framework**: Tailwind CSS, Shadcn/ui (Radix UI)
- **State Management**: React Hook Form (フォーム管理), Zod (バリデーション)
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime)
- **Icons**: Lucide React

## 3. データベース設計 (Supabase)

### 3.1. テーブル構成
以下の3テーブルを軸とする「シングルテーブル継承 + JSONB」パターンを採用する。

#### `employees` (社員マスタ)
- `id`: UUID (PK)
- `name`: String (氏名)
- `email`: String (ログイン用)
- `role`: String (権限)

#### `customers` (顧客マスタ)
- `id`: UUID (PK)
- `name`: String (会社名・氏名)
- `representative`: String (担当者名)
- `phone`: String
- `address`: String
- `notes`: Text

#### `projects` (業務メインテーブル)
全業務の共通項をカラム化し、固有データはJSONBに格納する。
- `id`: UUID (PK)
- `code`: String (例: A240001, B250055) - ユニーク制約
- `category`: String (Enum: A_Survey, B_Boundary, C_Registration, D_Inheritance, E_Corporate, F_Drone, N_Farmland)
- `name`: String (業務名)
- `status`: String (例: 受注, 着手, 進行中, 完了, 請求済)
- `customer_id`: UUID (FK -> customers.id)
- `manager_id`: UUID (FK -> employees.id)
- `start_date`: Date (着手/受託日)
- `end_date`: Date (完了/納品日)
- `fee_tax_excluded`: Integer (税抜報酬額)
- `location`: String (エリア・住所)
- **`details`: JSONB** (業務ごとの固有項目。後述の定義に従う)
- **`monthly_allocations`: JSONB** (月次売上配分。例: `{"2024-04": 2827000, "2024-05": 0}`)
- `created_at`: Timestamptz

### 3.2. JSONB `details` の構造定義
業務カテゴリ(`category`)ごとに、`details`カラムには以下のJSON構造を格納する。

**Type A: 一般測量 (Survey)**
```json
{
  "survey_type": "工事測量", // 業務の区分
  "jv_name": "野口新島三九JV" // JV名など特殊な顧客名
}
Type B:境界測量
{
  "purpose": "分筆", // 目的
  "referrer": "一条工務店", // 紹介者
  "coordinates": { "lat": 43.457, "lng": 144.715 }, // 地図座標
  "workflow": { // 進捗フラグ (true/false)
    "estimate": true, // 見積
    "accepted": true, // 受託
    "survey": true,   // 資料調査
    "staking": false, // 境界標埋設
    "registration": false, // 登記申請
    "billing": false  // 請求納品
  }
}
Type C: 不動産登記 (Registration) ※サブタイプ(sub_type)により構造が可変
{
  "sub_type": "新築", // 新築 | 売買 | 相続 | 抵当権 ...
  "architect": "一条工務店", // 建築業者
  "completion_date": "2025-02-19", // 完了検査日
  "settlement_date": "2025-03-01", // 決済日
  "mortgage_lender": "XX銀行", // 金融機関(抵当権の場合)
  "heirs": ["妻", "長男"] // 相続人のリスト(相続の場合)
}

Type D: 遺言・相続 (Inheritance)
{
  "will_type": "公正証書遺言",
  "will_date": "2024-09-05", // 遺言予定日
  "documents_kept": "印鑑証明, 権利証", // 預かり書類
  "contact_info": "ケアハウスきよさと..."
}

Type E: 法人関係 (Corporate)
{
  "purpose": "解散",
  "next_election_date": "2026-06-01" // 次期改選
}

Type F: ドローン (Drone)
{
  "items": ["バッテリー2", "充電ハブ"], // 品目
  "cost_price": 45200 // 仕入れ額
}

Type N: 農地関係 (Farmland)
{
  "application_type": "農地転用", // 目的
  "application_date": "2025-07-14", // 申請日
  "permission_date": "2025-08-31", // 許可予定日
  "article_type": "5条" // 農地法3条/4条/5条
}

4. 機能要件
4.1. ダッシュボード・一覧画面
全業務をリスト表示し、検索・フィルタリングができること。

フィルタ条件: 担当者別、ステータス別、業務カテゴリ別。

リストには「ステータス」をバッジで表示する。

4.2. 業務詳細・登録フォーム (最重要)
category を選択すると、入力フォームの内容が動的に切り替わること。

例: 「B:境界測量」を選んだ時だけ、「立会確認」「境界設置」などのチェックボックス群を表示する。

例: 「A:測量」または「F:ドローン」を選んだ時だけ、4月〜3月の月次売上入力欄を表示する。

4.3. カレンダー機能
start_date から end_date の期間をバー表示する。

期限や決済日(details内の日付)がある場合は、アイコンで表示する。

4.4. データ移行スクリプト
Google SheetsからエクスポートしたCSVデータを読み込み、上記のJSONB構造へ変換してSupabaseへInsertするスクリプトを用意すること。

5. UIデザイン方針
テーマ: 清潔感のあるビジネスライクなデザイン（白ベース、アクセントに青）。

レスポンシブ: スマホでの閲覧・簡易編集に対応する。

コンポーネント: Shadcn/ui の Card, Table, Form, Dialog を積極的に使用する。
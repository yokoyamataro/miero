-- 請求書テーブルに recipient_account_id カラムを追加
-- 担当者がいない法人を直接指定するためのフィールド

ALTER TABLE "public"."invoices"
ADD COLUMN IF NOT EXISTS "recipient_account_id" uuid REFERENCES "public"."accounts"("id");

COMMENT ON COLUMN "public"."invoices"."recipient_account_id" IS '相手先法人ID（担当者がいない法人の場合）';

-- インデックス追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS "idx_invoices_recipient_account_id" ON "public"."invoices" USING "btree" ("recipient_account_id");

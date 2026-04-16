


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."attendance_status" AS ENUM (
    'Work',
    'PaidLeave',
    'Absence',
    'HolidayWork'
);


ALTER TYPE "public"."attendance_status" OWNER TO "postgres";


CREATE TYPE "public"."employee_role" AS ENUM (
    'admin',
    'manager',
    'staff'
);


ALTER TYPE "public"."employee_role" OWNER TO "postgres";


CREATE TYPE "public"."event_category" AS ENUM (
    '内業',
    '来客',
    '外出',
    '現場',
    '出張',
    '勉強',
    '登記',
    '整備',
    '休み',
    'その他'
);


ALTER TYPE "public"."event_category" OWNER TO "postgres";


CREATE TYPE "public"."leave_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."leave_status" OWNER TO "postgres";


CREATE TYPE "public"."leave_type" AS ENUM (
    '有給休暇（全日）',
    '有給休暇（午前）',
    '有給休暇（午後）',
    '冬季休暇（全日）',
    '冬季休暇（午前）',
    '冬季休暇（午後）',
    'その他',
    '無給休暇（全日）',
    '無給休暇（午前）',
    '無給休暇（午後）'
);


ALTER TYPE "public"."leave_type" OWNER TO "postgres";


CREATE TYPE "public"."project_category" AS ENUM (
    'A_Survey',
    'B_Boundary',
    'C_Registration',
    'D_Inheritance',
    'E_Corporate',
    'F_Drone',
    'N_Farmland',
    'S_General',
    'K_Association',
    'V_Training',
    'O_Other'
);


ALTER TYPE "public"."project_category" OWNER TO "postgres";


CREATE TYPE "public"."project_status" AS ENUM (
    '進行中',
    '完了'
);


ALTER TYPE "public"."project_status" OWNER TO "postgres";


CREATE TYPE "public"."recurrence_type" AS ENUM (
    'none',
    'weekly',
    'monthly',
    'yearly'
);


ALTER TYPE "public"."recurrence_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_calendar_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_calendar_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leaves_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_leaves_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_template_sets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_task_template_sets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_task_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "company_name_kana" character varying(255),
    "main_phone" character varying(20),
    "postal_code" character varying(8),
    "prefecture" character varying(10),
    "city" character varying(100),
    "street" character varying(255),
    "building" character varying(255),
    "industry" character varying(50),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "corporate_number" character varying(13),
    "fax" character varying(20)
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "clock_in" timestamp with time zone,
    "clock_out" timestamp with time zone,
    "break_minutes" integer DEFAULT 0,
    "status" "public"."attendance_status" DEFAULT 'Work'::"public"."attendance_status",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(20),
    "postal_code" character varying(8),
    "prefecture" character varying(10),
    "city" character varying(100),
    "street" character varying(255),
    "building" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "fax" character varying(20)
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "code" character(1) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_entities" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_entities" IS '事業主体マスタ';



COMMENT ON COLUMN "public"."business_entities"."name" IS '事業主体名';



COMMENT ON COLUMN "public"."business_entities"."code" IS '頭文字コード (Y, T, L)';



COMMENT ON COLUMN "public"."business_entities"."sort_order" IS '表示順';



CREATE TABLE IF NOT EXISTS "public"."calendar_event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "public"."event_category" DEFAULT 'その他'::"public"."event_category",
    "start_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_date" "date",
    "end_time" time without time zone,
    "all_day" boolean DEFAULT false,
    "location" "text",
    "map_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "event_category_id" "uuid",
    "project_id" "uuid",
    "task_id" "uuid",
    "recurrence_type" "public"."recurrence_type" DEFAULT 'none'::"public"."recurrence_type",
    "recurrence_day_of_week" integer,
    "recurrence_day_of_month" integer,
    "recurrence_month" integer,
    "recurrence_group_id" "uuid",
    "recurrence_end_date" "date"
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."calendar_events"."recurrence_type" IS '繰り返しタイプ: none=なし, weekly=毎週, monthly=毎月, yearly=毎年';



COMMENT ON COLUMN "public"."calendar_events"."recurrence_day_of_week" IS '毎週の場合の曜日 (0=日曜, 1=月曜, ..., 6=土曜)';



COMMENT ON COLUMN "public"."calendar_events"."recurrence_day_of_month" IS '毎月/毎年の場合の日 (1-31)';



COMMENT ON COLUMN "public"."calendar_events"."recurrence_month" IS '毎年の場合の月 (1-12)';



COMMENT ON COLUMN "public"."calendar_events"."recurrence_group_id" IS '繰り返しイベントのグループID（同じUUIDを持つイベントは同じ繰り返しシリーズ）';



COMMENT ON COLUMN "public"."calendar_events"."recurrence_end_date" IS '繰り返し終了日（NULLの場合は無期限）';



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_name" character varying(100),
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "account_id" "uuid",
    "last_name" character varying(50) NOT NULL,
    "first_name" character varying(50) NOT NULL,
    "last_name_kana" character varying(50),
    "first_name_kana" character varying(50),
    "birth_date" "date",
    "email" character varying(255),
    "phone" character varying(20),
    "postal_code" character varying(8),
    "prefecture" character varying(10),
    "city" character varying(100),
    "street" character varying(255),
    "building" character varying(255),
    "department" character varying(100),
    "position" character varying(100),
    "is_primary" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "branch_id" "uuid"
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "storage_path" "text"
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "role" "public"."employee_role" DEFAULT 'staff'::"public"."employee_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_id" "uuid",
    "hourly_rate" integer DEFAULT 3000
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "color" character varying(20) DEFAULT 'bg-gray-500'::character varying NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" character varying(20) NOT NULL,
    "project_id" "uuid" NOT NULL,
    "business_entity_id" "uuid" NOT NULL,
    "sequence_number" integer DEFAULT 1 NOT NULL,
    "invoice_date" "date" NOT NULL,
    "recipient_contact_id" "uuid",
    "recipient_account_id" "uuid",
    "person_in_charge_id" "uuid",
    "fee_tax_excluded" integer DEFAULT 0 NOT NULL,
    "expenses" integer DEFAULT 0 NOT NULL,
    "total_amount" integer DEFAULT 0 NOT NULL,
    "pdf_path" "text",
    "notes" "text",
    "is_accounting_registered" boolean DEFAULT false,
    "is_payment_received" boolean DEFAULT false,
    "payment_received_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoices" IS '請求書';



COMMENT ON COLUMN "public"."invoices"."invoice_number" IS '請求書番号 (例: Y-A260001-01)';



COMMENT ON COLUMN "public"."invoices"."project_id" IS '業務ID';



COMMENT ON COLUMN "public"."invoices"."business_entity_id" IS '事業主体ID';



COMMENT ON COLUMN "public"."invoices"."sequence_number" IS '同一業務・事業主体内の連番';



COMMENT ON COLUMN "public"."invoices"."invoice_date" IS '請求日';



COMMENT ON COLUMN "public"."invoices"."recipient_contact_id" IS '相手先（連絡先ID）';



COMMENT ON COLUMN "public"."invoices"."person_in_charge_id" IS '請求担当者（社員ID）';



COMMENT ON COLUMN "public"."invoices"."fee_tax_excluded" IS '税抜報酬';



COMMENT ON COLUMN "public"."invoices"."expenses" IS '立替金';



COMMENT ON COLUMN "public"."invoices"."total_amount" IS '請求金額';



COMMENT ON COLUMN "public"."invoices"."pdf_path" IS 'PDFファイルパス';



COMMENT ON COLUMN "public"."invoices"."notes" IS '備考';



COMMENT ON COLUMN "public"."invoices"."is_accounting_registered" IS '会計登録済み';



COMMENT ON COLUMN "public"."invoices"."is_payment_received" IS '入金済み';



COMMENT ON COLUMN "public"."invoices"."payment_received_date" IS '入金日';



CREATE TABLE IF NOT EXISTS "public"."leaves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "leave_date" "date" NOT NULL,
    "leave_type" "public"."leave_type" NOT NULL,
    "adjustment" character varying(100),
    "reason" "text",
    "status" "public"."leave_status" DEFAULT 'pending'::"public"."leave_status" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entry_type" character varying(10) DEFAULT 'use'::character varying,
    "leave_category" character varying(50),
    "days" numeric(5,1),
    "expires_at" "date",
    "granted_by" "uuid",
    CONSTRAINT "leaves_entry_type_check" CHECK ((("entry_type")::"text" = ANY ((ARRAY['grant'::character varying, 'use'::character varying])::"text"[])))
);


ALTER TABLE "public"."leaves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_stakeholders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_stakeholders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" character varying(20) NOT NULL,
    "category" "public"."project_category" NOT NULL,
    "name" character varying(255) NOT NULL,
    "status" "public"."project_status" DEFAULT '進行中'::"public"."project_status" NOT NULL,
    "manager_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "fee_tax_excluded" integer DEFAULT 0,
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_id" "uuid",
    "location_detail" "text",
    "is_urgent" boolean DEFAULT false NOT NULL,
    "is_on_hold" boolean DEFAULT false NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."notes" IS '業務のノート・詳細情報';



CREATE TABLE IF NOT EXISTS "public"."related_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "related_project_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_reference" CHECK (("project_id" <> "related_project_id"))
);


ALTER TABLE "public"."related_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stakeholder_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "color" character varying(30) DEFAULT 'bg-gray-500'::character varying NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stakeholder_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_template_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "set_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "estimated_minutes" integer,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_template_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_template_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_template_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "due_date" "date",
    "assigned_to" "uuid",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estimated_minutes" integer,
    "actual_minutes" integer,
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attendance_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "minutes" integer DEFAULT 0 NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_daily"
    ADD CONSTRAINT "attendance_daily_employee_id_date_key" UNIQUE ("employee_id", "date");



ALTER TABLE ONLY "public"."attendance_daily"
    ADD CONSTRAINT "attendance_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_entities"
    ADD CONSTRAINT "business_entities_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."business_entities"
    ADD CONSTRAINT "business_entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_event_participants"
    ADD CONSTRAINT "calendar_event_participants_event_id_employee_id_key" UNIQUE ("event_id", "employee_id");



ALTER TABLE ONLY "public"."calendar_event_participants"
    ADD CONSTRAINT "calendar_event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_project_id_business_entity_id_sequence_number_key" UNIQUE ("project_id", "business_entity_id", "sequence_number");



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."related_projects"
    ADD CONSTRAINT "related_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stakeholder_tags"
    ADD CONSTRAINT "stakeholder_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."stakeholder_tags"
    ADD CONSTRAINT "stakeholder_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_template_items"
    ADD CONSTRAINT "task_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_template_sets"
    ADD CONSTRAINT "task_template_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."related_projects"
    ADD CONSTRAINT "unique_related_projects" UNIQUE ("project_id", "related_project_id");



ALTER TABLE ONLY "public"."work_logs"
    ADD CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accounts_company_name" ON "public"."accounts" USING "btree" ("company_name");



CREATE INDEX "idx_accounts_corporate_number" ON "public"."accounts" USING "btree" ("corporate_number");



CREATE INDEX "idx_accounts_deleted_at" ON "public"."accounts" USING "btree" ("deleted_at");



CREATE INDEX "idx_attendance_daily_date" ON "public"."attendance_daily" USING "btree" ("date");



CREATE INDEX "idx_attendance_daily_employee_id" ON "public"."attendance_daily" USING "btree" ("employee_id");



CREATE INDEX "idx_branches_account_id" ON "public"."branches" USING "btree" ("account_id");



CREATE INDEX "idx_branches_deleted_at" ON "public"."branches" USING "btree" ("deleted_at");



CREATE INDEX "idx_branches_name" ON "public"."branches" USING "btree" ("name");



CREATE INDEX "idx_calendar_event_participants_employee_id" ON "public"."calendar_event_participants" USING "btree" ("employee_id");



CREATE INDEX "idx_calendar_event_participants_event_id" ON "public"."calendar_event_participants" USING "btree" ("event_id");



CREATE INDEX "idx_calendar_events_created_by" ON "public"."calendar_events" USING "btree" ("created_by");



CREATE INDEX "idx_calendar_events_end_date" ON "public"."calendar_events" USING "btree" ("end_date");



CREATE INDEX "idx_calendar_events_event_category_id" ON "public"."calendar_events" USING "btree" ("event_category_id");



CREATE INDEX "idx_calendar_events_project_id" ON "public"."calendar_events" USING "btree" ("project_id");



CREATE INDEX "idx_calendar_events_recurrence_group_id" ON "public"."calendar_events" USING "btree" ("recurrence_group_id");



CREATE INDEX "idx_calendar_events_recurrence_type" ON "public"."calendar_events" USING "btree" ("recurrence_type");



CREATE INDEX "idx_calendar_events_start_date" ON "public"."calendar_events" USING "btree" ("start_date");



CREATE INDEX "idx_calendar_events_task_id" ON "public"."calendar_events" USING "btree" ("task_id");



CREATE INDEX "idx_comments_created_at" ON "public"."comments" USING "btree" ("created_at");



CREATE INDEX "idx_comments_project_id" ON "public"."comments" USING "btree" ("project_id");



CREATE INDEX "idx_contacts_account_id" ON "public"."contacts" USING "btree" ("account_id");



CREATE INDEX "idx_contacts_branch_id" ON "public"."contacts" USING "btree" ("branch_id");



CREATE INDEX "idx_contacts_deleted_at" ON "public"."contacts" USING "btree" ("deleted_at");



CREATE INDEX "idx_contacts_name" ON "public"."contacts" USING "btree" ("last_name", "first_name");



CREATE INDEX "idx_employees_auth_id" ON "public"."employees" USING "btree" ("auth_id");



CREATE INDEX "idx_employees_email" ON "public"."employees" USING "btree" ("email");



CREATE INDEX "idx_event_categories_sort_order" ON "public"."event_categories" USING "btree" ("sort_order");



CREATE INDEX "idx_invoices_business_entity_id" ON "public"."invoices" USING "btree" ("business_entity_id");



CREATE INDEX "idx_invoices_deleted_at" ON "public"."invoices" USING "btree" ("deleted_at");



CREATE INDEX "idx_invoices_invoice_date" ON "public"."invoices" USING "btree" ("invoice_date");



CREATE INDEX "idx_invoices_project_id" ON "public"."invoices" USING "btree" ("project_id");



CREATE INDEX "idx_leaves_employee_id" ON "public"."leaves" USING "btree" ("employee_id");



CREATE INDEX "idx_leaves_entry_type" ON "public"."leaves" USING "btree" ("entry_type");



CREATE INDEX "idx_leaves_leave_category" ON "public"."leaves" USING "btree" ("leave_category");



CREATE INDEX "idx_leaves_leave_date" ON "public"."leaves" USING "btree" ("leave_date");



CREATE INDEX "idx_leaves_status" ON "public"."leaves" USING "btree" ("status");



CREATE INDEX "idx_project_stakeholders_contact_id" ON "public"."project_stakeholders" USING "btree" ("contact_id");



CREATE INDEX "idx_project_stakeholders_project_id" ON "public"."project_stakeholders" USING "btree" ("project_id");



CREATE UNIQUE INDEX "idx_project_stakeholders_unique" ON "public"."project_stakeholders" USING "btree" ("project_id", "contact_id", "tag_id");



CREATE INDEX "idx_projects_category" ON "public"."projects" USING "btree" ("category");



CREATE INDEX "idx_projects_code" ON "public"."projects" USING "btree" ("code");



CREATE INDEX "idx_projects_contact_id" ON "public"."projects" USING "btree" ("contact_id");



CREATE INDEX "idx_projects_end_date" ON "public"."projects" USING "btree" ("end_date");



CREATE INDEX "idx_projects_is_on_hold" ON "public"."projects" USING "btree" ("is_on_hold");



CREATE INDEX "idx_projects_is_urgent" ON "public"."projects" USING "btree" ("is_urgent");



CREATE INDEX "idx_projects_manager_id" ON "public"."projects" USING "btree" ("manager_id");



CREATE INDEX "idx_projects_start_date" ON "public"."projects" USING "btree" ("start_date");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_related_projects_project_id" ON "public"."related_projects" USING "btree" ("project_id");



CREATE INDEX "idx_related_projects_related_project_id" ON "public"."related_projects" USING "btree" ("related_project_id");



CREATE INDEX "idx_stakeholder_tags_sort_order" ON "public"."stakeholder_tags" USING "btree" ("sort_order");



CREATE INDEX "idx_task_template_items_set_id" ON "public"."task_template_items" USING "btree" ("set_id");



CREATE INDEX "idx_task_template_items_sort_order" ON "public"."task_template_items" USING "btree" ("sort_order");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_is_completed" ON "public"."tasks" USING "btree" ("is_completed");



CREATE INDEX "idx_tasks_personal" ON "public"."tasks" USING "btree" ("assigned_to") WHERE ("project_id" IS NULL);



CREATE INDEX "idx_tasks_project_id" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "idx_work_logs_attendance_id" ON "public"."work_logs" USING "btree" ("attendance_id");



CREATE INDEX "idx_work_logs_project_id" ON "public"."work_logs" USING "btree" ("project_id");



CREATE OR REPLACE TRIGGER "task_template_sets_updated_at" BEFORE UPDATE ON "public"."task_template_sets" FOR EACH ROW EXECUTE FUNCTION "public"."update_task_template_sets_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_leaves_updated_at" BEFORE UPDATE ON "public"."leaves" FOR EACH ROW EXECUTE FUNCTION "public"."update_leaves_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_calendar_events_updated_at"();



CREATE OR REPLACE TRIGGER "update_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_branches_updated_at" BEFORE UPDATE ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."attendance_daily"
    ADD CONSTRAINT "attendance_daily_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_event_participants"
    ADD CONSTRAINT "calendar_event_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_event_participants"
    ADD CONSTRAINT "calendar_event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_business_entity_id_fkey" FOREIGN KEY ("business_entity_id") REFERENCES "public"."business_entities"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_person_in_charge_id_fkey" FOREIGN KEY ("person_in_charge_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_stakeholders"
    ADD CONSTRAINT "project_stakeholders_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."stakeholder_tags"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."related_projects"
    ADD CONSTRAINT "related_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."related_projects"
    ADD CONSTRAINT "related_projects_related_project_id_fkey" FOREIGN KEY ("related_project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_template_items"
    ADD CONSTRAINT "task_template_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."task_template_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_logs"
    ADD CONSTRAINT "work_logs_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance_daily"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_logs"
    ADD CONSTRAINT "work_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can manage templates" ON "public"."document_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."auth_id" = "auth"."uid"()) AND ("employees"."role" = 'admin'::"public"."employee_role")))));



CREATE POLICY "Allow anon delete accounts" ON "public"."accounts" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow anon delete comments" ON "public"."comments" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow anon delete contacts" ON "public"."contacts" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow anon delete projects" ON "public"."projects" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow anon delete tasks" ON "public"."tasks" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow anon insert accounts" ON "public"."accounts" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert comments" ON "public"."comments" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert contacts" ON "public"."contacts" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert projects" ON "public"."projects" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon insert tasks" ON "public"."tasks" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon read accounts" ON "public"."accounts" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon read comments" ON "public"."comments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon read contacts" ON "public"."contacts" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon read projects" ON "public"."projects" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon read tasks" ON "public"."tasks" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon update accounts" ON "public"."accounts" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Allow anon update comments" ON "public"."comments" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Allow anon update contacts" ON "public"."contacts" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Allow anon update projects" ON "public"."projects" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Allow anon update tasks" ON "public"."tasks" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Allow authenticated delete accounts" ON "public"."accounts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete contacts" ON "public"."contacts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete projects" ON "public"."projects" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert accounts" ON "public"."accounts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert contacts" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert projects" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert tasks" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read accounts" ON "public"."accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read comments" ON "public"."comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read contacts" ON "public"."contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update accounts" ON "public"."accounts" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update comments" ON "public"."comments" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update contacts" ON "public"."contacts" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update projects" ON "public"."projects" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can delete invoices" ON "public"."invoices" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can insert invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can update invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view business_entities" ON "public"."business_entities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view templates" ON "public"."document_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create event categories" ON "public"."event_categories" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create project stakeholders" ON "public"."project_stakeholders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create stakeholder tags" ON "public"."stakeholder_tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can delete event categories" ON "public"."event_categories" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete project stakeholders" ON "public"."project_stakeholders" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete related_projects" ON "public"."related_projects" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete stakeholder tags" ON "public"."stakeholder_tags" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete task_template_items" ON "public"."task_template_items" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete task_template_sets" ON "public"."task_template_sets" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert related_projects" ON "public"."related_projects" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert task_template_items" ON "public"."task_template_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert task_template_sets" ON "public"."task_template_sets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can manage projects" ON "public"."projects" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read task_template_items" ON "public"."task_template_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read task_template_sets" ON "public"."task_template_sets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update event categories" ON "public"."event_categories" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update project stakeholders" ON "public"."project_stakeholders" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update stakeholder tags" ON "public"."stakeholder_tags" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update task_template_items" ON "public"."task_template_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update task_template_sets" ON "public"."task_template_sets" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view related_projects" ON "public"."related_projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Everyone can view event categories" ON "public"."event_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Everyone can view project stakeholders" ON "public"."project_stakeholders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Everyone can view stakeholder tags" ON "public"."stakeholder_tags" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Managers can delete leaves" ON "public"."leaves" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."auth_id" = "auth"."uid"()) AND ("employees"."role" = ANY (ARRAY['admin'::"public"."employee_role", 'manager'::"public"."employee_role"]))))));



CREATE POLICY "Managers can insert any leaves" ON "public"."leaves" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."auth_id" = "auth"."uid"()) AND ("employees"."role" = ANY (ARRAY['admin'::"public"."employee_role", 'manager'::"public"."employee_role"]))))));



CREATE POLICY "Managers can update all leaves" ON "public"."leaves" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."auth_id" = "auth"."uid"()) AND ("employees"."role" = ANY (ARRAY['admin'::"public"."employee_role", 'manager'::"public"."employee_role"]))))));



CREATE POLICY "Managers can view all leaves" ON "public"."leaves" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."auth_id" = "auth"."uid"()) AND ("employees"."role" = ANY (ARRAY['admin'::"public"."employee_role", 'manager'::"public"."employee_role"]))))));



CREATE POLICY "Users can delete own pending leaves" ON "public"."leaves" FOR DELETE TO "authenticated" USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."auth_id" = "auth"."uid"()))) AND ("status" = 'pending'::"public"."leave_status")));



CREATE POLICY "Users can insert own leaves" ON "public"."leaves" FOR INSERT TO "authenticated" WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own pending leaves" ON "public"."leaves" FOR UPDATE TO "authenticated" USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."auth_id" = "auth"."uid"()))) AND ("status" = 'pending'::"public"."leave_status"))) WITH CHECK ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."auth_id" = "auth"."uid"()))) AND ("status" = 'pending'::"public"."leave_status")));



CREATE POLICY "Users can view own leaves" ON "public"."leaves" FOR SELECT TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."auth_id" = "auth"."uid"()))));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_daily_delete" ON "public"."attendance_daily" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "attendance_daily_insert" ON "public"."attendance_daily" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "attendance_daily_select" ON "public"."attendance_daily" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "attendance_daily_update" ON "public"."attendance_daily" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "branches_delete_policy" ON "public"."branches" FOR DELETE USING (true);



CREATE POLICY "branches_insert_policy" ON "public"."branches" FOR INSERT WITH CHECK (true);



CREATE POLICY "branches_select_policy" ON "public"."branches" FOR SELECT USING (true);



CREATE POLICY "branches_update_policy" ON "public"."branches" FOR UPDATE USING (true);



ALTER TABLE "public"."business_entities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_event_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_event_participants_delete" ON "public"."calendar_event_participants" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "calendar_event_participants_insert" ON "public"."calendar_event_participants" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "calendar_event_participants_select" ON "public"."calendar_event_participants" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_events_delete" ON "public"."calendar_events" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "calendar_events_insert" ON "public"."calendar_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "calendar_events_select" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "calendar_events_update" ON "public"."calendar_events" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_delete" ON "public"."employees" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "employees_insert" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "employees_select" ON "public"."employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "employees_update" ON "public"."employees" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leaves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_stakeholders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."related_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stakeholder_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_template_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_template_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_logs_delete" ON "public"."work_logs" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "work_logs_insert" ON "public"."work_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "work_logs_select" ON "public"."work_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "work_logs_update" ON "public"."work_logs" FOR UPDATE TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."update_calendar_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_calendar_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_calendar_events_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leaves_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_leaves_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leaves_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_template_sets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_task_template_sets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_task_template_sets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_task_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_task_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_daily" TO "anon";
GRANT ALL ON TABLE "public"."attendance_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_daily" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."business_entities" TO "anon";
GRANT ALL ON TABLE "public"."business_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."business_entities" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_event_participants" TO "anon";
GRANT ALL ON TABLE "public"."calendar_event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."event_categories" TO "anon";
GRANT ALL ON TABLE "public"."event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."event_categories" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."leaves" TO "anon";
GRANT ALL ON TABLE "public"."leaves" TO "authenticated";
GRANT ALL ON TABLE "public"."leaves" TO "service_role";



GRANT ALL ON TABLE "public"."project_stakeholders" TO "anon";
GRANT ALL ON TABLE "public"."project_stakeholders" TO "authenticated";
GRANT ALL ON TABLE "public"."project_stakeholders" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."related_projects" TO "anon";
GRANT ALL ON TABLE "public"."related_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."related_projects" TO "service_role";



GRANT ALL ON TABLE "public"."stakeholder_tags" TO "anon";
GRANT ALL ON TABLE "public"."stakeholder_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."stakeholder_tags" TO "service_role";



GRANT ALL ON TABLE "public"."task_template_items" TO "anon";
GRANT ALL ON TABLE "public"."task_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."task_template_items" TO "service_role";



GRANT ALL ON TABLE "public"."task_template_sets" TO "anon";
GRANT ALL ON TABLE "public"."task_template_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."task_template_sets" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."work_logs" TO "anon";
GRANT ALL ON TABLE "public"."work_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."work_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































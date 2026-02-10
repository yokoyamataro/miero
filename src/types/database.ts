export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// 業務カテゴリ
export type ProjectCategory =
  | "A_Survey"
  | "B_Boundary"
  | "C_Registration"
  | "D_Inheritance"
  | "E_Corporate"
  | "F_Drone"
  | "N_Farmland";

// 業務ステータス
export type ProjectStatus = "進行中" | "完了";

// 社員権限
export type EmployeeRole = "admin" | "manager" | "staff";

// カテゴリ表示名マッピング
export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  A_Survey: "A:一般測量",
  B_Boundary: "B:境界測量",
  C_Registration: "C:不動産登記",
  D_Inheritance: "D:遺言・相続",
  E_Corporate: "E:法人関係",
  F_Drone: "F:ドローン",
  N_Farmland: "N:農地関係",
};

// ステータスバッジカラー
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  進行中: "bg-green-500 text-white",
  完了: "bg-red-500 text-white",
};

// JSONB details 型定義
export interface SurveyDetails {
  survey_type?: string;
  jv_name?: string;
}

export interface BoundaryDetails {
  purpose?: string;
  referrer?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  workflow?: {
    estimate?: boolean;
    accepted?: boolean;
    survey?: boolean;
    staking?: boolean;
    registration?: boolean;
    billing?: boolean;
  };
}

export interface RegistrationDetails {
  sub_type?: string;
  architect?: string;
  completion_date?: string;
  settlement_date?: string;
  mortgage_lender?: string;
  heirs?: string[];
}

export interface InheritanceDetails {
  will_type?: string;
  will_date?: string;
  documents_kept?: string;
  contact_info?: string;
}

export interface CorporateDetails {
  purpose?: string;
  next_election_date?: string;
}

export interface DroneDetails {
  items?: string[];
  cost_price?: number;
}

export interface FarmlandDetails {
  application_type?: string;
  application_date?: string;
  permission_date?: string;
  article_type?: string;
}

export type ProjectDetails =
  | SurveyDetails
  | BoundaryDetails
  | RegistrationDetails
  | InheritanceDetails
  | CorporateDetails
  | DroneDetails
  | FarmlandDetails;

// ============================================
// Account (法人・組織)
// ============================================
export interface Account {
  id: string;
  company_name: string;
  company_name_kana: string | null;
  corporate_number: string | null;
  main_phone: string | null;
  fax: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AccountInsert {
  id?: string;
  company_name: string;
  company_name_kana?: string | null;
  corporate_number?: string | null;
  main_phone?: string | null;
  fax?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  street?: string | null;
  building?: string | null;
  industry?: string | null;
  notes?: string | null;
}

// ============================================
// Branch (支店)
// ============================================
export interface Branch {
  id: string;
  account_id: string;
  name: string;
  phone: string | null;
  fax: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BranchInsert {
  id?: string;
  account_id: string;
  name: string;
  phone?: string | null;
  fax?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  street?: string | null;
  building?: string | null;
}

// ============================================
// Contact (顧客・担当者)
// ============================================
export interface Contact {
  id: string;
  account_id: string | null;
  branch_id: string | null;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  department: string | null;
  position: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ContactInsert {
  id?: string;
  account_id?: string | null;
  branch_id?: string | null;
  last_name: string;
  first_name: string;
  last_name_kana?: string | null;
  first_name_kana?: string | null;
  birth_date?: string | null;
  email?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  street?: string | null;
  building?: string | null;
  department?: string | null;
  position?: string | null;
  is_primary?: boolean;
  notes?: string | null;
}

// 法人と担当者・支店を含む型
export interface AccountWithContacts extends Account {
  contacts: Contact[];
  branches: Branch[];
}

// 連絡先と法人情報を含む型
export interface ContactWithAccount extends Contact {
  account: Account | null;
}

// 氏名のフルネームを取得するヘルパー
export function getContactFullName(contact: Contact): string {
  return `${contact.last_name} ${contact.first_name}`;
}

export function getContactFullNameKana(contact: Contact): string {
  if (!contact.last_name_kana || !contact.first_name_kana) return "";
  return `${contact.last_name_kana} ${contact.first_name_kana}`;
}

// 住所のフルアドレスを取得するヘルパー
export function getFullAddress(item: Account | Contact): string {
  const parts = [
    item.postal_code ? `〒${item.postal_code}` : null,
    item.prefecture,
    item.city,
    item.street,
    item.building,
  ].filter(Boolean);
  return parts.join(" ");
}

// ============================================
// Employee (社員)
// ============================================
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  created_at: string;
  updated_at: string;
}

// ============================================
// Project (業務)
// ============================================
export interface Project {
  id: string;
  code: string;
  category: ProjectCategory;
  name: string;
  status: ProjectStatus;
  is_urgent: boolean;
  is_on_hold: boolean;
  contact_id: string | null;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  location_detail: string | null;
  notes: string | null;
  details: ProjectDetails;
  created_at: string;
  updated_at: string;
}

export interface ProjectInsert {
  id?: string;
  code: string;
  category: ProjectCategory;
  name: string;
  status?: ProjectStatus;
  is_urgent?: boolean;
  is_on_hold?: boolean;
  contact_id?: string | null;
  manager_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  fee_tax_excluded?: number | null;
  location?: string | null;
  location_detail?: string | null;
  notes?: string | null;
  details?: ProjectDetails;
}

// プロジェクト一覧用（JOINした結果）
export interface ProjectWithRelations extends Project {
  contact: ContactWithAccount | null;
  manager: Employee | null;
}

// ============================================
// Task (タスク)
// ============================================
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  assigned_to: string | null;
  sort_order: number;
  // 時間管理
  estimated_minutes: number | null;  // 標準時間（分単位）
  actual_minutes: number | null;     // 実時間（分単位）
  created_at: string;
  updated_at: string;
}

export interface TaskInsert {
  id?: string;
  project_id: string;
  title: string;
  description?: string | null;
  is_completed?: boolean;
  due_date?: string | null;
  assigned_to?: string | null;
  sort_order?: number;
  // 時間管理
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
}

// ============================================
// Task Template Set (タスクテンプレートセット)
// ============================================
export interface TaskTemplateSet {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateSetInsert {
  id?: string;
  name: string;
}

export interface TaskTemplateItem {
  id: string;
  set_id: string;
  title: string;
  estimated_minutes: number | null;
  sort_order: number;
  created_at: string;
}

export interface TaskTemplateItemInsert {
  id?: string;
  set_id: string;
  title: string;
  estimated_minutes?: number | null;
  sort_order?: number;
}

// セット + アイテム一覧を含む型
export interface TaskTemplateSetWithItems extends TaskTemplateSet {
  items: TaskTemplateItem[];
}


// ============================================
// Comment (コメント)
// ============================================
export interface Comment {
  id: string;
  project_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CommentInsert {
  id?: string;
  project_id: string;
  author_id?: string | null;
  author_name?: string | null;
  content: string;
}

// 作成者情報を含むコメント
export interface CommentWithAuthor extends Comment {
  author?: Employee | null;
}

// ============================================
// Comment Acknowledgement (コメント確認)
// ============================================
export interface CommentAcknowledgement {
  id: string;
  comment_id: string;
  employee_id: string;
  acknowledged_at: string;
}

export interface CommentAcknowledgementInsert {
  comment_id: string;
  employee_id: string;
}

// 確認者情報を含むコメント確認
export interface CommentAcknowledgementWithEmployee extends CommentAcknowledgement {
  employee: Employee;
}

// 確認情報を含むコメント
export interface CommentWithAcknowledgements extends Comment {
  acknowledgements: CommentAcknowledgementWithEmployee[];
}

// ============================================
// Event Category (イベント区分マスタ)
// ============================================
export interface EventCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventCategoryInsert {
  id?: string;
  name: string;
  color: string;
  sort_order?: number;
}

// デフォルトの区分色（新規作成時の選択肢 - 20種類）
export const DEFAULT_CATEGORY_COLORS = [
  // 青系
  "bg-blue-500",
  "bg-blue-300",
  "bg-indigo-500",
  "bg-sky-500",
  // 緑系
  "bg-green-500",
  "bg-green-300",
  "bg-teal-500",
  "bg-emerald-500",
  // 暖色系
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-pink-500",
  // 紫系
  "bg-purple-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  // その他
  "bg-cyan-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-gray-500",
  "bg-slate-500",
];

// ============================================
// Calendar Event (カレンダーイベント)
// ============================================
// 旧EventCategory型（後方互換のため残す）
export type EventCategoryLegacy =
  | "内業"
  | "来客"
  | "外出"
  | "現場"
  | "出張"
  | "勉強"
  | "登記"
  | "整備"
  | "休み"
  | "その他";

export const EVENT_CATEGORY_COLORS: Record<EventCategoryLegacy, string> = {
  内業: "bg-blue-500",
  来客: "bg-green-500",
  外出: "bg-yellow-500",
  現場: "bg-orange-500",
  出張: "bg-purple-500",
  勉強: "bg-indigo-500",
  登記: "bg-pink-500",
  整備: "bg-cyan-500",
  休み: "bg-gray-400",
  その他: "bg-slate-400",
};

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategoryLegacy; // 旧カラム（後方互換）
  event_category_id: string | null; // 新カラム（区分マスタへの参照）
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  map_url: string | null;
  project_id: string | null;
  task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventInsert {
  id?: string;
  title: string;
  description?: string | null;
  category?: EventCategoryLegacy; // 旧カラム（後方互換）
  event_category_id?: string | null; // 新カラム（区分マスタへの参照）
  start_date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  location?: string | null;
  map_url?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  created_by?: string | null;
}

export interface CalendarEventParticipant {
  id: string;
  event_id: string;
  employee_id: string;
  created_at: string;
}

export interface CalendarEventParticipantInsert {
  event_id: string;
  employee_id: string;
}

// 参加者情報を含むイベント
export interface CalendarEventWithParticipants extends CalendarEvent {
  participants: Employee[];
  creator?: Employee | null;
  project?: Project | null;
  task?: Task | null;
  eventCategory?: EventCategory | null; // 区分マスタ情報
}

// ============================================
// 業務エリア（市町村）
// ============================================
export interface AreaGroup {
  name: string;
  areas: string[];
}

export const PROJECT_AREA_GROUPS: AreaGroup[] = [
  {
    name: "オホーツク",
    areas: [
      "斜里郡斜里町",
      "斜里郡清里町",
      "斜里郡小清水町",
      "北見市",
      "網走市",
      "紋別市",
      "網走郡美幌町",
      "網走郡津別町",
      "常呂郡訓子府町",
      "常呂郡置戸町",
      "常呂郡佐呂間町",
      "紋別郡遠軽町",
      "紋別郡湧別町",
    ],
  },
  {
    name: "根室",
    areas: [
      "根室市",
      "野付郡別海町",
      "標津郡中標津町",
      "標津郡標津町",
      "目梨郡羅臼町",
    ],
  },
  {
    name: "釧路",
    areas: [
      "釧路市",
      "釧路郡釧路町",
      "厚岸郡厚岸町",
      "厚岸郡浜中町",
      "川上郡標茶町",
      "川上郡弟子屈町",
      "阿寒郡鶴居村",
      "白糠郡白糠町",
    ],
  },
  {
    name: "その他",
    areas: [
      "北海道内",
      "北海道外",
    ],
  },
];

// フラットな市町村リスト（選択肢用）
export const PROJECT_AREAS: string[] = PROJECT_AREA_GROUPS.flatMap(
  (group) => group.areas
);

// ============================================
// 業種マスタ（Industry）
// ============================================
export interface Industry {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IndustryInsert {
  id?: string;
  name: string;
  sort_order?: number;
}

// ============================================
// Stakeholder Tag (関係者タグマスタ)
// ============================================
export interface StakeholderTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StakeholderTagInsert {
  id?: string;
  name: string;
  color: string;
  sort_order?: number;
}

// ============================================
// Project Stakeholder (業務の関係者)
// ============================================
export interface ProjectStakeholder {
  id: string;
  project_id: string;
  contact_id: string;
  tag_id: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectStakeholderInsert {
  id?: string;
  project_id: string;
  contact_id: string;
  tag_id: string;
  note?: string | null;
}

// 関係者（連絡先・法人・タグ情報付き）
export interface ProjectStakeholderWithDetails extends ProjectStakeholder {
  contact: Contact;
  account: Account | null;
  tag: StakeholderTag;
}

// デフォルトの業種リスト
export const DEFAULT_INDUSTRIES = [
  "官公署",
  "建設業",
  "ハウスメーカー",
  "金融機関",
  "不動産業",
  "農協",
  "漁協",
  "農業",
  "漁業",
  "測量業",
  "土地家屋調査士",
  "司法書士",
  "その他",
];

// ============================================
// DocumentTemplate (文書テンプレート)
// ============================================
export interface DocumentTemplate {
  id: string;
  name: string;
  file_name: string;
  storage_path: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplateInsert {
  id?: string;
  name: string;
  file_name: string;
  storage_path?: string | null;
  description?: string | null;
  sort_order?: number;
}

// ============================================
// BusinessEntity (事業主体)
// ============================================
export interface BusinessEntity {
  id: string;
  name: string;
  code: string; // Y, T, L
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessEntityInsert {
  id?: string;
  name: string;
  code: string;
  sort_order?: number;
}

// ============================================
// Invoice (請求書)
// ============================================
export interface Invoice {
  id: string;
  invoice_number: string; // Y-A260001-01 形式
  project_id: string;
  business_entity_id: string;
  sequence_number: number;
  invoice_date: string;
  recipient_contact_id: string | null;
  person_in_charge_id: string | null;
  fee_tax_excluded: number;
  expenses: number;
  total_amount: number;
  pdf_path: string | null;
  notes: string | null;
  is_accounting_registered: boolean;
  is_payment_received: boolean;
  payment_received_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InvoiceInsert {
  id?: string;
  invoice_number: string;
  project_id: string;
  business_entity_id: string;
  sequence_number?: number;
  invoice_date: string;
  recipient_contact_id?: string | null;
  person_in_charge_id?: string | null;
  fee_tax_excluded?: number;
  expenses?: number;
  total_amount?: number;
  pdf_path?: string | null;
  notes?: string | null;
  is_accounting_registered?: boolean;
  is_payment_received?: boolean;
  payment_received_date?: string | null;
}

// 請求書（関連情報付き）
export interface InvoiceWithDetails extends Invoice {
  project: Project;
  businessEntity: BusinessEntity;
  recipientContact: Contact | null;
  recipientAccount: Account | null;
  personInCharge: Employee | null;
}

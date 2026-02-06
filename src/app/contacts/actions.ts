"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ContactInsert, ContactWithAccount, Project } from "@/types/database";

// 関連業務の型
export interface RelatedProject {
  id: string;
  code: string;
  name: string;
  status: string;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  relationship: "顧客" | "関係者";
  stakeholder_tag?: string;
}

export interface IndividualContactFormData {
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  notes: string | null;
}

export async function getIndividualContactById(
  id: string
): Promise<ContactWithAccount | null> {
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts" as never)
    .select("*")
    .eq("id", id)
    .is("account_id", null)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching contact:", error);
    return null;
  }

  return {
    ...(contact as ContactWithAccount),
    account: null,
  };
}

export async function createIndividualContact(data: IndividualContactFormData) {
  const supabase = await createClient();

  const contactInsert: ContactInsert = {
    account_id: null, // 個人顧客なのでnull
    last_name: data.last_name,
    first_name: data.first_name,
    last_name_kana: data.last_name_kana || null,
    first_name_kana: data.first_name_kana || null,
    birth_date: data.birth_date || null,
    phone: data.phone || null,
    email: data.email || null,
    postal_code: data.postal_code || null,
    prefecture: data.prefecture || null,
    city: data.city || null,
    street: data.street || null,
    building: data.building || null,
    notes: data.notes || null,
  };

  const { error } = await supabase
    .from("contacts" as never)
    .insert(contactInsert as never);

  if (error) {
    console.error("Error creating contact:", error);
    return { error: error.message };
  }

  revalidatePath("/contacts");
  return { success: true };
}

export async function updateIndividualContact(
  id: string,
  data: IndividualContactFormData
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts" as never)
    .update({
      last_name: data.last_name,
      first_name: data.first_name,
      last_name_kana: data.last_name_kana || null,
      first_name_kana: data.first_name_kana || null,
      birth_date: data.birth_date || null,
      phone: data.phone || null,
      email: data.email || null,
      postal_code: data.postal_code || null,
      prefecture: data.prefecture || null,
      city: data.city || null,
      street: data.street || null,
      building: data.building || null,
      notes: data.notes || null,
    } as never)
    .eq("id", id);

  if (error) {
    console.error("Error updating contact:", error);
    return { error: error.message };
  }

  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteIndividualContact(id: string) {
  const supabase = await createClient();

  // 論理削除
  const { error } = await supabase
    .from("contacts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Error deleting contact:", error);
    return { error: error.message };
  }

  revalidatePath("/contacts");
  return { success: true };
}

// ============================================
// 関連業務取得
// ============================================

// 個人顧客に関連する業務を取得（顧客として、または関係者として）
export async function getRelatedProjectsForContact(contactId: string): Promise<RelatedProject[]> {
  const supabase = await createClient();

  const relatedProjects: RelatedProject[] = [];

  // 1. 顧客として紐づいている業務を取得
  const { data: customerProjects, error: customerError } = await supabase
    .from("projects" as never)
    .select("id, code, name, status, category, start_date, end_date")
    .eq("contact_id", contactId);

  if (customerError) {
    console.error("Error fetching customer projects:", customerError);
  } else if (customerProjects) {
    for (const p of customerProjects as Project[]) {
      relatedProjects.push({
        id: p.id,
        code: p.code,
        name: p.name,
        status: p.status,
        category: p.category,
        start_date: p.start_date,
        end_date: p.end_date,
        relationship: "顧客",
      });
    }
  }

  // 2. 関係者として紐づいている業務を取得
  const { data: stakeholderData, error: stakeholderError } = await supabase
    .from("project_stakeholders" as never)
    .select(`
      project_id,
      tag:stakeholder_tags(name),
      project:projects(id, code, name, status, category, start_date, end_date)
    `)
    .eq("contact_id", contactId);

  if (stakeholderError) {
    console.error("Error fetching stakeholder projects:", stakeholderError);
  } else if (stakeholderData) {
    for (const s of stakeholderData as Array<{
      project_id: string;
      tag: { name: string } | null;
      project: Project | null;
    }>) {
      if (s.project) {
        // 既に顧客として追加されていないかチェック
        const existing = relatedProjects.find((rp) => rp.id === s.project!.id);
        if (!existing) {
          relatedProjects.push({
            id: s.project.id,
            code: s.project.code,
            name: s.project.name,
            status: s.project.status,
            category: s.project.category,
            start_date: s.project.start_date,
            end_date: s.project.end_date,
            relationship: "関係者",
            stakeholder_tag: s.tag?.name,
          });
        }
      }
    }
  }

  // start_dateの降順でソート
  relatedProjects.sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  return relatedProjects;
}

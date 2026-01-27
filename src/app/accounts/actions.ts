"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AccountInsert, ContactInsert, AccountWithContacts } from "@/types/database";

export interface AccountFormData {
  company_name: string;
  company_name_kana: string | null;
  main_phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  industry: string | null;
  notes: string | null;
}

export interface ContactFormData {
  id?: string;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  is_primary: boolean;
}

export async function getAccountById(id: string): Promise<AccountWithContacts | null> {
  const supabase = await createClient();

  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (accountError) {
    console.error("Error fetching account:", accountError);
    return null;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts" as never)
    .select("*")
    .eq("account_id", id)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("last_name");

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
  }

  return {
    ...(account as AccountWithContacts),
    contacts: (contacts || []) as AccountWithContacts["contacts"],
  };
}

export async function createAccount(
  data: AccountFormData,
  contacts: ContactFormData[]
) {
  const supabase = await createClient();

  const accountInsert: AccountInsert = {
    company_name: data.company_name,
    company_name_kana: data.company_name_kana || null,
    main_phone: data.main_phone || null,
    postal_code: data.postal_code || null,
    prefecture: data.prefecture || null,
    city: data.city || null,
    street: data.street || null,
    building: data.building || null,
    industry: data.industry || null,
    notes: data.notes || null,
  };

  const { data: account, error: accountError } = await supabase
    .from("accounts" as never)
    .insert(accountInsert as never)
    .select()
    .single();

  if (accountError) {
    console.error("Error creating account:", accountError);
    return { error: accountError.message };
  }

  if (contacts.length > 0) {
    const contactsToInsert = contacts.map((c) => ({
      account_id: (account as { id: string }).id,
      last_name: c.last_name,
      first_name: c.first_name,
      last_name_kana: c.last_name_kana || null,
      first_name_kana: c.first_name_kana || null,
      phone: c.phone || null,
      email: c.email || null,
      department: c.department || null,
      position: c.position || null,
      is_primary: c.is_primary,
    }));

    const { error: contactsError } = await supabase
      .from("contacts" as never)
      .insert(contactsToInsert as never);

    if (contactsError) {
      console.error("Error creating contacts:", contactsError);
      return { error: contactsError.message };
    }
  }

  revalidatePath("/accounts");
  return { success: true };
}

export async function updateAccount(
  id: string,
  data: AccountFormData,
  contacts: ContactFormData[]
) {
  const supabase = await createClient();

  const { error: accountError } = await supabase
    .from("accounts" as never)
    .update({
      company_name: data.company_name,
      company_name_kana: data.company_name_kana || null,
      main_phone: data.main_phone || null,
      postal_code: data.postal_code || null,
      prefecture: data.prefecture || null,
      city: data.city || null,
      street: data.street || null,
      building: data.building || null,
      industry: data.industry || null,
      notes: data.notes || null,
    } as never)
    .eq("id", id);

  if (accountError) {
    console.error("Error updating account:", accountError);
    return { error: accountError.message };
  }

  // 既存の連絡先を論理削除
  const { error: deleteError } = await supabase
    .from("contacts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", id)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Error soft-deleting contacts:", deleteError);
    return { error: deleteError.message };
  }

  // 新しい連絡先を作成
  if (contacts.length > 0) {
    const contactsToInsert = contacts.map((c) => ({
      account_id: id,
      last_name: c.last_name,
      first_name: c.first_name,
      last_name_kana: c.last_name_kana || null,
      first_name_kana: c.first_name_kana || null,
      phone: c.phone || null,
      email: c.email || null,
      department: c.department || null,
      position: c.position || null,
      is_primary: c.is_primary,
    }));

    const { error: contactsError } = await supabase
      .from("contacts" as never)
      .insert(contactsToInsert as never);

    if (contactsError) {
      console.error("Error creating contacts:", contactsError);
      return { error: contactsError.message };
    }
  }

  revalidatePath("/accounts");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();

  // 論理削除
  const { error } = await supabase
    .from("accounts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Error deleting account:", error);
    return { error: error.message };
  }

  // 関連する連絡先も論理削除
  await supabase
    .from("contacts" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("account_id", id);

  revalidatePath("/accounts");
  return { success: true };
}

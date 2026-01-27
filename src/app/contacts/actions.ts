"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ContactInsert, ContactWithAccount } from "@/types/database";

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

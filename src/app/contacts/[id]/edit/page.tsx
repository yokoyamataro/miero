import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("legacy_contact_id", id)
    .is("deleted_at", null)
    .maybeSingle();

  const customerId = (data as { id: string } | null)?.id;
  if (customerId) {
    redirect(`/customers/${customerId}/edit`);
  }
  redirect("/customers");
}

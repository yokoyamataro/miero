import { createClient } from "@/lib/supabase/server";
import { type Employee, type BusinessEntity } from "@/types/database";
import { getAllInvoices, getBusinessEntities } from "./actions";
import { InvoiceList } from "./invoice-list";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [
    { data: employees },
    businessEntities,
    invoices,
  ] = await Promise.all([
    supabase.from("employees").select("*").order("name"),
    getBusinessEntities(),
    getAllInvoices(),
  ]);

  const typedEmployees = (employees as Employee[]) || [];

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">請求管理</h1>
        <p className="text-muted-foreground">
          全業務の請求書を一覧で管理します
        </p>
      </header>

      <InvoiceList
        invoices={invoices}
        businessEntities={businessEntities}
        employees={typedEmployees}
      />
    </main>
  );
}

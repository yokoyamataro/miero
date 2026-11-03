import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { CustomerForm } from "../../customer-form";
import { getCustomerById } from "../../actions";

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await getCustomerById(params.id);
  if (!customer) notFound();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href={`/customers/${params.id}`}>
        <Button variant="ghost" size="sm" className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          詳細へ戻る
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-6">顧客 編集</h1>
      <CustomerForm customer={customer} />
    </main>
  );
}

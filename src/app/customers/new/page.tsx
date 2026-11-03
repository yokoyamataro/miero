import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/customers">
        <Button variant="ghost" size="sm" className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          顧客一覧へ戻る
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-6">顧客 新規登録</h1>
      <CustomerForm />
    </main>
  );
}

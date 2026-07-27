import { notFound } from "next/navigation";
import { getIdentityVerification } from "../actions";
import { VerificationForm } from "../verification-form";

export default async function IdentityVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const verification = await getIdentityVerification(id);

  if (!verification) {
    notFound();
  }

  const { transactions, documents, ...rest } = verification;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">本人確認シート 編集</h1>
      <VerificationForm
        mode="edit"
        verificationId={id}
        initialData={rest}
        initialTransactions={transactions}
        initialDocuments={documents}
      />
    </main>
  );
}

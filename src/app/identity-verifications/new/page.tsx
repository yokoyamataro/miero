import { VerificationForm } from "../verification-form";

export default function NewIdentityVerificationPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">本人確認シート 新規作成</h1>
      <VerificationForm mode="new" />
    </main>
  );
}

import { VerificationForm } from "../verification-form";
import { getEmployeesForRecorder } from "../actions";

export default async function NewIdentityVerificationPage() {
  const employees = await getEmployeesForRecorder();
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">本人確認シート 新規作成</h1>
      <VerificationForm mode="new" employees={employees} />
    </main>
  );
}

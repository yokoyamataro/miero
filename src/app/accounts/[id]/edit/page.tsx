import { notFound } from "next/navigation";
import { getAccountById } from "../../actions";
import { AccountForm } from "../../account-form";

interface EditAccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAccountPage({ params }: EditAccountPageProps) {
  const { id } = await params;
  const account = await getAccountById(id);

  if (!account) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <AccountForm account={account} isEdit />
    </main>
  );
}

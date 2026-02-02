import { AccountForm } from "../account-form";
import { getIndustries } from "../actions";

export default async function NewAccountPage() {
  const industries = await getIndustries();

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <AccountForm industries={industries} />
    </main>
  );
}

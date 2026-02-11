import { getCustomerData, getEmployees } from "../actions";
import { getIndustries } from "@/app/accounts/actions";
import { ProjectForm } from "./project-form";

export default async function NewProjectPage() {
  const [customerData, employees, industries] = await Promise.all([
    getCustomerData(),
    getEmployees(),
    getIndustries(),
  ]);

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <ProjectForm customerData={customerData} employees={employees} industries={industries} />
    </main>
  );
}

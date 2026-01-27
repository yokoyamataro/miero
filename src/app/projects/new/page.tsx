import { getContacts, getEmployees } from "../actions";
import { ProjectForm } from "./project-form";

export default async function NewProjectPage() {
  const [contacts, employees] = await Promise.all([
    getContacts(),
    getEmployees(),
  ]);

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <ProjectForm contacts={contacts} employees={employees} />
    </main>
  );
}

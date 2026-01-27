import { notFound } from "next/navigation";
import { getEmployeeById } from "../../actions";
import { EmployeeForm } from "../../employee-form";

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { id } = await params;
  const employee = await getEmployeeById(id);

  if (!employee) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-xl">
      <EmployeeForm employee={employee} isEdit />
    </main>
  );
}

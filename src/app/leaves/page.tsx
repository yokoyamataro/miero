import { getCurrentEmployee, getMyLeaves, getAllLeaves, getEmployeesForLeave, getLeaveBalanceSummary, getAllLeaveBalanceSummaries, getLeaveHistory } from "./actions";
import { LeaveList } from "./leave-list";
import { redirect } from "next/navigation";

export default async function LeavesPage() {
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    redirect("/login");
  }

  const isManager = currentEmployee.role === "admin" || currentEmployee.role === "manager";

  // 管理者/マネージャーは全員分、一般社員は自分のみ
  const leaves = isManager ? await getAllLeaves() : await getMyLeaves();
  const employees = isManager ? await getEmployeesForLeave() : [];
  const balanceSummaries = isManager
    ? await getAllLeaveBalanceSummaries()
    : await getLeaveBalanceSummary();
  const leaveHistory = await getLeaveHistory();

  return (
    <main className="container mx-auto px-4 py-8">
      <LeaveList
        leaves={leaves}
        currentEmployee={currentEmployee}
        isManager={isManager}
        employees={employees}
        balanceSummaries={balanceSummaries}
        leaveHistory={leaveHistory}
      />
    </main>
  );
}

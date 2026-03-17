"use server";

import { redirect } from "next/navigation";
import { getCurrentEmployee, getMyLeaves, getLeaveBalanceSummary, getAvailableLeaveTypes } from "@/app/leaves/actions";
import { MobileLeaveList } from "./mobile-leave-list";
import { format } from "date-fns";

export default async function MobileLeavesPage() {
  const currentEmployee = await getCurrentEmployee();

  if (!currentEmployee) {
    redirect("/login");
  }

  const leaves = await getMyLeaves();
  const balanceSummaries = await getLeaveBalanceSummary();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const availableLeaveTypes = await getAvailableLeaveTypes(todayStr);

  return (
    <MobileLeaveList
      leaves={leaves}
      currentEmployee={currentEmployee}
      balanceSummaries={balanceSummaries}
      initialAvailableLeaveTypes={availableLeaveTypes}
    />
  );
}

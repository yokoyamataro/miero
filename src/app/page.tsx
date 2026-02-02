import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AttendanceClock } from "@/components/attendance-clock";
import { getTodayAttendance } from "@/app/attendance/actions";

export default async function Home() {
  const attendanceData = await getTodayAttendance();

  return (
    <main className="container mx-auto px-4 py-8">
      {/* 打刻UI */}
      <AttendanceClock
        initialAttendance={attendanceData?.attendance || null}
        employeeId={attendanceData?.employeeId || null}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">ダッシュボード</h1>
      </header>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
        <div className="flex gap-4 flex-wrap">
          <Link href="/projects/new">
            <Button>新規業務登録</Button>
          </Link>
          <Link href="/customers">
            <Button variant="outline">顧客管理</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

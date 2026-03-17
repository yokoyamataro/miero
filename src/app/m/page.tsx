import { redirect } from "next/navigation";

// /m にアクセスしたらカレンダーへリダイレクト
export default function MobileHomePage() {
  redirect("/m/calendar");
}

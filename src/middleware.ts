import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 認証不要なパス
const publicPaths = ["/login", "/auth/callback"];

// モバイル端末判定用のUser-Agentパターン
const mobileUserAgentPattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

// モバイル版対応パス（/m/で始まるパス）
const mobilePaths = ["/m"];

// モバイル版に対応するPC版パス
const mobileEnabledPcPaths = ["/", "/calendar", "/projects", "/leaves"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開パスはそのまま通す
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // 環境変数が設定されていない場合はログインページへ
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Supabaseクライアントを作成してセッションを確認
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 未ログインの場合はログインページへリダイレクト
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // モバイル自動判定ロジック
  const viewPreferenceCookie = request.cookies.get("view-preference")?.value;
  const userAgent = request.headers.get("user-agent") || "";
  const isMobileDevice = mobileUserAgentPattern.test(userAgent);

  // Cookieで明示的に設定されていない場合のみ自動判定
  if (!viewPreferenceCookie) {
    // モバイル端末からPC版パスにアクセスした場合
    if (isMobileDevice && mobileEnabledPcPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      // /m/で始まるパスでない場合のみリダイレクト
      if (!pathname.startsWith("/m")) {
        // パスを変換: /calendar -> /m/calendar, / -> /m/calendar
        let mobilePathname = pathname === "/" ? "/m/calendar" : `/m${pathname}`;
        // /projects/xxx -> /m/projects/xxx
        if (pathname.startsWith("/projects")) {
          mobilePathname = `/m${pathname}`;
        }
        // /leaves -> /m/leaves
        if (pathname.startsWith("/leaves")) {
          mobilePathname = `/m${pathname}`;
        }
        const mobileUrl = new URL(mobilePathname, request.url);
        return NextResponse.redirect(mobileUrl);
      }
    }
  }

  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

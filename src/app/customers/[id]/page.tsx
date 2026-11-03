import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  Pencil,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { CUSTOMER_TYPE_LABELS } from "@/types/database";
import { getCustomerById } from "../actions";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await getCustomerById(params.id);
  if (!customer) notFound();

  const buildAddress = (): string => {
    const parts = [
      customer.postal_code ? `〒${customer.postal_code}` : "",
      customer.prefecture,
      customer.city,
      customer.street,
      customer.building,
    ].filter(Boolean);
    return parts.join(" ");
  };

  const typeBadgeClass =
    customer.type === "corporate"
      ? "bg-blue-100 text-blue-800"
      : "bg-green-100 text-green-800";
  const TypeIcon = customer.type === "corporate" ? Building2 : User;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            顧客一覧へ戻る
          </Button>
        </Link>
        <Link href={`/customers/${customer.id}/edit`}>
          <Button size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            編集
          </Button>
        </Link>
      </div>

      <header className="mb-6 pb-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={`${typeBadgeClass} hover:${typeBadgeClass}`}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {CUSTOMER_TYPE_LABELS[customer.type]}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold">{customer.display_name}</h1>
        {customer.display_name_kana && (
          <p className="text-sm text-muted-foreground">
            {customer.display_name_kana}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 連絡先 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">連絡先</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow icon={Phone} label="電話" value={customer.phone} />
            <InfoRow icon={Mail} label="メール" value={customer.email} />
            {customer.type === "corporate" && (
              <InfoRow icon={Phone} label="FAX" value={customer.fax} />
            )}
          </CardContent>
        </Card>

        {/* 住所 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">住所</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span>{buildAddress() || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* 法人情報 */}
        {customer.type === "corporate" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">法人情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <InfoRow label="法人番号" value={customer.corporate_number} />
                <InfoRow label="業種" value={customer.industry} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">担当者</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <InfoRow
                  label="氏名"
                  value={
                    customer.contact_last_name || customer.contact_first_name
                      ? `${customer.contact_last_name ?? ""} ${customer.contact_first_name ?? ""}`.trim()
                      : null
                  }
                />
                <InfoRow label="部署" value={customer.contact_department} />
                <InfoRow label="役職" value={customer.contact_position} />
                <InfoRow label="電話" value={customer.contact_phone} />
                <InfoRow label="メール" value={customer.contact_email} />
              </CardContent>
            </Card>
          </>
        )}

        {/* 個人情報 */}
        {customer.type === "individual" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">個人情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow label="生年月日" value={customer.birth_date} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* 備考 */}
      {customer.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">備考</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {customer.notes}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground mr-2">{label}:</span>
        <span>{value || "-"}</span>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ReceiptText } from "lucide-react";
import { toggleAccountingRegistered } from "@/app/invoices/actions";
import type { InvoiceWithDetails } from "@/types/database";

interface Props {
  invoices: InvoiceWithDetails[];
}

function formatCurrency(amount: number | string | null) {
  if (amount === null || amount === undefined) return "-";
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `¥${n.toLocaleString()}`;
}

function getRecipientName(inv: InvoiceWithDetails): string {
  if (inv.recipientAccount?.company_name) return inv.recipientAccount.company_name;
  if (inv.recipientContact) {
    return `${inv.recipientContact.last_name ?? ""} ${inv.recipientContact.first_name ?? ""}`.trim() || "-";
  }
  return "-";
}

export function AdminPendingInvoicesModal({ invoices: initial }: Props) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initial);
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleCheck = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await toggleAccountingRegistered(id, true);
      router.refresh();
    });
  };

  if (invoices.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            会計入力が必要な請求書 ({invoices.length}件)
          </DialogTitle>
          <DialogDescription>
            会計システムへの入力が完了したらチェックを付けてください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 p-3 border rounded bg-background hover:bg-muted/40"
            >
              <Checkbox
                checked={false}
                onCheckedChange={() => handleCheck(inv.id)}
                disabled={isPending}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {inv.invoice_number}
                  </span>
                  <span className="font-medium truncate">{getRecipientName(inv)}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  <Link
                    href={`/projects/${inv.project_id}`}
                    className="hover:underline"
                  >
                    {inv.project?.code} {inv.project?.name}
                  </Link>
                  <span className="ml-2">{inv.invoice_date}</span>
                </div>
              </div>
              <div className="text-right font-medium text-sm flex-shrink-0">
                {formatCurrency(inv.total_amount)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              請求一覧を開く
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            後で確認
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

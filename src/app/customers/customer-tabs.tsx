"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText } from "lucide-react";
import { CustomersList } from "./customers-list";
import { DocumentTab } from "./document-tab";
import type {
  Account,
  Contact,
  Customer,
  Employee,
  DocumentTemplate,
} from "@/types/database";

interface CustomerTabsProps {
  // 新: customers 統合テーブル用
  customers: Customer[];
  // 旧: 文書作成タブで引き続き使用 (Phase 3-5 で統合予定)
  accounts: Account[];
  individuals: Contact[];
  allContacts: Contact[];
  employees: Employee[];
  templates: DocumentTemplate[];
  currentEmployeeId: string | null;
}

export function CustomerTabs({
  customers,
  accounts,
  individuals,
  allContacts,
  employees,
  templates,
  currentEmployeeId,
}: CustomerTabsProps) {
  return (
    <Tabs defaultValue="list" className="w-full">
      <TabsList>
        <TabsTrigger value="list" className="gap-1">
          <Users className="h-4 w-4" />
          顧客一覧
        </TabsTrigger>
        <TabsTrigger value="documents" className="gap-1">
          <FileText className="h-4 w-4" />
          文書作成
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="mt-4">
        <CustomersList customers={customers} />
      </TabsContent>

      <TabsContent value="documents" className="mt-4">
        <DocumentTab
          templates={templates}
          accounts={accounts}
          allContacts={allContacts}
          individuals={individuals}
          employees={employees}
          currentEmployeeId={currentEmployeeId}
        />
      </TabsContent>
    </Tabs>
  );
}

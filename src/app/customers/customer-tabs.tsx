"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText } from "lucide-react";
import { CustomersList } from "./customers-list";
import { DocumentTab } from "./document-tab";
import type { Customer, Employee, DocumentTemplate } from "@/types/database";

interface CustomerTabsProps {
  customers: Customer[];
  employees: Employee[];
  templates: DocumentTemplate[];
  currentEmployeeId: string | null;
}

export function CustomerTabs({
  customers,
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
          customers={customers}
          employees={employees}
          currentEmployeeId={currentEmployeeId}
        />
      </TabsContent>
    </Tabs>
  );
}

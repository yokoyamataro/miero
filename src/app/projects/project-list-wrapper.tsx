"use client";

import { ProjectList } from "./project-list";
import { getTemplateItems, getWorkflowProjects, updateWorkflowStatus } from "@/app/workflow/actions";
import type { StandardTaskStatus } from "@/types/database";

interface ProjectData {
  id: string;
  code: string;
  category: string;
  name: string;
  status: string;
  is_urgent: boolean;
  is_on_hold: boolean;
  contact_id: string | null;
  account_id: string | null;
  manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_tax_excluded: number | null;
  location: string | null;
  location_detail: string | null;
}

interface WorkflowTemplate {
  id: string;
  name: string;
}

interface ProjectListWrapperProps {
  projects: ProjectData[];
  contactDisplayMap: Record<string, string>;
  accountDisplayMap: Record<string, string>;
  employeeMap: Record<string, string>;
  recentProjectIds: string[];
  standardTasksMap: Record<string, string[]>;
  workflowTemplates: WorkflowTemplate[];
}

export function ProjectListWrapper(props: ProjectListWrapperProps) {
  const handleLoadWorkflowData = async (templateId: string, includeCompleted: boolean = false) => {
    const [items, projects] = await Promise.all([
      getTemplateItems(templateId),
      getWorkflowProjects(templateId, includeCompleted),
    ]);
    return { items, projects };
  };

  const handleUpdateWorkflowStatus = async (
    projectStandardTaskId: string,
    itemId: string,
    status: StandardTaskStatus
  ) => {
    return updateWorkflowStatus(projectStandardTaskId, itemId, status);
  };

  return (
    <ProjectList
      {...props}
      onLoadWorkflowData={handleLoadWorkflowData}
      onUpdateWorkflowStatus={handleUpdateWorkflowStatus}
    />
  );
}

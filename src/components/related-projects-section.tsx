"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";

interface RelatedProject {
  id: string;
  code: string;
  name: string;
  status: string;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  relationship: "顧客" | "関係者";
  stakeholder_tag?: string;
}

interface RelatedProjectsSectionProps {
  projects: RelatedProject[];
}

const STATUS_COLORS: Record<string, string> = {
  未着手: "bg-blue-500",
  進行中: "bg-green-500",
  完了: "bg-red-500",
  中止: "bg-gray-400",
};

const RELATIONSHIP_COLORS = {
  顧客: "bg-primary",
  関係者: "bg-orange-500",
};

export function RelatedProjectsSection({ projects }: RelatedProjectsSectionProps) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            関連業務
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            関連する業務はありません
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          関連業務（{projects.length}件）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {project.code}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-white text-xs ${RELATIONSHIP_COLORS[project.relationship]}`}
                    >
                      {project.relationship}
                      {project.stakeholder_tag && `: ${project.stakeholder_tag}`}
                    </Badge>
                  </div>
                  <p className="font-medium truncate mt-1">{project.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {project.category && (
                      <span>{project.category}</span>
                    )}
                    {project.start_date && (
                      <span>
                        {project.start_date}
                        {project.end_date && ` 〜 ${project.end_date}`}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-white ${STATUS_COLORS[project.status] || "bg-gray-500"}`}
                >
                  {project.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

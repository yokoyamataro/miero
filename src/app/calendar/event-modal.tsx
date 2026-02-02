"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Briefcase, ChevronDown, ChevronRight, LinkIcon, X } from "lucide-react";
import {
  type CalendarEventWithParticipants,
  type Employee,
  type EventCategory,
  type Task,
} from "@/types/database";
import { createEvent, updateEvent, getActiveProjectsWithTasks, type ProjectWithTasks, type TaskWithChildren } from "./actions";

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  eventCategories: EventCategory[];
  selectedDate: Date | null;
  event: CalendarEventWithParticipants | null;
  onSaved: () => void;
  currentEmployeeId: string | null;
}

// 時間オプション (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

// 分オプション (15分単位)
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

// 時刻を結合
function combineTime(hour: string, minute: string): string {
  if (!hour && !minute) return "";
  return `${hour || "00"}:${minute || "00"}`;
}

// 時刻を分割
function splitTime(time: string): { hour: string; minute: string } {
  if (!time) return { hour: "", minute: "" };
  const [hour, minute] = time.split(":");
  return { hour: hour || "", minute: minute || "" };
}

export function EventModal({
  open,
  onOpenChange,
  employees,
  eventCategories,
  selectedDate,
  event,
  onSaved,
  currentEmployeeId,
}: EventModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 社員リストをソート（ログインユーザーを先頭に）
  const sortedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees;
    return [...employees].sort((a, b) => {
      if (a.id === currentEmployeeId) return -1;
      if (b.id === currentEmployeeId) return 1;
      return 0; // 他は登録順のまま
    });
  }, [employees, currentEmployeeId]);

  // フォーム状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endHour, setEndHour] = useState("");
  const [endMinute, setEndMinute] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  // 業務ToDo選択用
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projectsWithTasks, setProjectsWithTasks] = useState<ProjectWithTasks[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // 業務リンク
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [linkedProjectCode, setLinkedProjectCode] = useState<string | null>(null);

  // 編集時のデータ読み込み
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setCategoryId(event.event_category_id || eventCategories[0]?.id || "");
      setStartDate(event.start_date);
      const startTimeParts = splitTime(event.start_time?.slice(0, 5) || "");
      setStartHour(startTimeParts.hour);
      setStartMinute(startTimeParts.minute);
      setEndDate(event.end_date || "");
      const endTimeParts = splitTime(event.end_time?.slice(0, 5) || "");
      setEndHour(endTimeParts.hour);
      setEndMinute(endTimeParts.minute);
      setAllDay(event.all_day);
      setLocation(event.location || "");
      setMapUrl(event.map_url || "");
      setParticipantIds(event.participants.map((p) => p.id));
      setShowProjectSelector(false);
      setLinkedProjectId(event.project_id);
      setLinkedTaskId(event.task_id);
      setLinkedProjectCode(event.project?.code || null);
    } else if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      setTitle("");
      setDescription("");
      setCategoryId(eventCategories[0]?.id || "");
      setStartDate(dateStr);
      setStartHour("");
      setStartMinute("");
      setEndDate(dateStr); // デフォルトで終了日＝開始日
      setEndHour("");
      setEndMinute("");
      setAllDay(false);
      setLocation("");
      setMapUrl("");
      setParticipantIds([]);
      setShowProjectSelector(false);
      setLinkedProjectId(null);
      setLinkedTaskId(null);
      setLinkedProjectCode(null);
    }
  }, [event, selectedDate, open, eventCategories]);

  // 業務ToDoを読み込む
  const loadProjectsWithTasks = async () => {
    if (projectsWithTasks.length > 0) {
      setShowProjectSelector(!showProjectSelector);
      return;
    }

    setLoadingProjects(true);
    try {
      const data = await getActiveProjectsWithTasks();
      setProjectsWithTasks(data);
      setShowProjectSelector(true);
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // 業務名を先頭10文字に切り詰める
  const truncateName = (name: string, maxLength: number = 10): string => {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength);
  };

  // 業務を選択
  const selectProject = (project: ProjectWithTasks) => {
    setTitle(truncateName(project.name));
    if (project.location) {
      setLocation(project.location);
    }
    setLinkedProjectId(project.id);
    setLinkedTaskId(null);
    setLinkedProjectCode(project.code);
    setShowProjectSelector(false);
  };

  // タスクを選択
  const selectTask = (project: ProjectWithTasks, task: TaskWithChildren) => {
    // 業務名(先頭10文字)>タスク名
    setTitle(`${truncateName(project.name)}>${task.title}`);
    if (project.location) {
      setLocation(project.location);
    }
    setLinkedProjectId(project.id);
    setLinkedTaskId(task.id);
    setLinkedProjectCode(project.code);
    setShowProjectSelector(false);
  };

  // サブタスクを選択
  const selectSubtask = (project: ProjectWithTasks, parentTask: TaskWithChildren, subtask: Task) => {
    // 業務名(先頭10文字)>タスク名>サブタスク名
    setTitle(`${truncateName(project.name)}>${parentTask.title}>${subtask.title}`);
    if (project.location) {
      setLocation(project.location);
    }
    setLinkedProjectId(project.id);
    setLinkedTaskId(subtask.id);
    setLinkedProjectCode(project.code);
    setShowProjectSelector(false);
  };

  // タスクの展開/折りたたみ
  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 業務リンクを解除
  const clearProjectLink = () => {
    setLinkedProjectId(null);
    setLinkedTaskId(null);
    setLinkedProjectCode(null);
  };

  // プロジェクトの展開/折りたたみ
  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startDate) {
      setError("タイトルと開始日は必須です");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = combineTime(startHour, startMinute);
      const endTime = combineTime(endHour, endMinute);

      const eventData = {
        title: title.trim(),
        description: description.trim() || null,
        category: "その他" as const, // 後方互換性のためデフォルト値を設定
        event_category_id: categoryId || null,
        start_date: startDate,
        start_time: startTime || null,
        end_date: endDate || null,
        end_time: endTime || null,
        all_day: allDay,
        location: location.trim() || null,
        map_url: mapUrl.trim() || null,
        project_id: linkedProjectId,
        task_id: linkedTaskId,
      };

      if (event) {
        const result = await updateEvent(event.id, eventData, participantIds);
        if (result.error) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createEvent(eventData, participantIds);
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      onSaved();
    } catch (err) {
      setError("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (employeeId: string) => {
    setParticipantIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "予定を編集" : "予定を追加"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* タイトル */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">タイトル *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadProjectsWithTasks}
                disabled={loadingProjects}
              >
                <Briefcase className="h-4 w-4 mr-1" />
                {loadingProjects ? "読込中..." : "業務から選択"}
              </Button>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定のタイトル"
            />

            {/* リンク中の業務表示 */}
            {linkedProjectId && (
              <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-md">
                <LinkIcon className="h-4 w-4" />
                <span>業務 {linkedProjectCode} にリンク中</span>
                <button
                  type="button"
                  onClick={clearProjectLink}
                  className="ml-auto p-0.5 hover:bg-blue-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 業務ToDo選択パネル */}
            {showProjectSelector && (
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto bg-muted/30">
                {projectsWithTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    進行中の業務がありません
                  </p>
                ) : (
                  <div className="space-y-1">
                    {projectsWithTasks.map((project) => (
                      <div key={project.id} className="text-sm">
                        <div
                          className="flex items-center gap-1 p-1 rounded hover:bg-muted cursor-pointer"
                          onClick={() => {
                            if (project.tasks.length > 0) {
                              toggleProjectExpand(project.id);
                            } else {
                              selectProject(project);
                            }
                          }}
                        >
                          {project.tasks.length > 0 ? (
                            expandedProjects.has(project.id) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="font-mono text-xs text-muted-foreground">
                            {project.code}
                          </span>
                          <span className="truncate flex-1">{project.name}</span>
                          {project.tasks.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({project.tasks.length})
                            </span>
                          )}
                        </div>

                        {/* タスク一覧 */}
                        {expandedProjects.has(project.id) && project.tasks.length > 0 && (
                          <div className="ml-5 border-l pl-2 space-y-0.5">
                            {/* 業務自体を選択するオプション */}
                            <div
                              className="p-1 rounded hover:bg-muted cursor-pointer text-muted-foreground"
                              onClick={() => selectProject(project)}
                            >
                              → 業務全体を選択
                            </div>
                            {project.tasks.map((task) => (
                              <div key={task.id}>
                                <div
                                  className="flex items-center gap-1 p-1 rounded hover:bg-muted cursor-pointer"
                                  onClick={() => {
                                    if (task.children && task.children.length > 0) {
                                      toggleTaskExpand(task.id);
                                    } else {
                                      selectTask(project, task);
                                    }
                                  }}
                                >
                                  {task.children && task.children.length > 0 ? (
                                    expandedTasks.has(task.id) ? (
                                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    )
                                  ) : (
                                    <span className="w-3" />
                                  )}
                                  <span>{task.title}</span>
                                  {task.children && task.children.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      ({task.children.length})
                                    </span>
                                  )}
                                </div>
                                {/* サブタスク一覧 */}
                                {expandedTasks.has(task.id) && task.children && task.children.length > 0 && (
                                  <div className="ml-4 border-l pl-2 space-y-0.5">
                                    {/* タスク自体を選択するオプション */}
                                    <div
                                      className="p-1 rounded hover:bg-muted cursor-pointer text-muted-foreground text-xs"
                                      onClick={() => selectTask(project, task)}
                                    >
                                      → タスクを選択
                                    </div>
                                    {task.children.map((subtask) => (
                                      <div
                                        key={subtask.id}
                                        className="p-1 rounded hover:bg-muted cursor-pointer text-xs"
                                        onClick={() => selectSubtask(project, task, subtask)}
                                      >
                                        {subtask.title}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 区分 */}
          <div className="space-y-2">
            <Label htmlFor="category">区分</Label>
            {eventCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {eventCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      categoryId === cat.id
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded ${cat.color}`} />
                    {cat.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                区分が設定されていません。設定画面で追加してください。
              </p>
            )}
          </div>

          {/* 終日チェック */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(!!checked)}
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              終日
            </Label>
          </div>

          {/* 日時 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日 *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // 開始日を変更したら終了日も同じに
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>開始時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                  >
                    <option value="">--</option>
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">:</span>
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                  >
                    <option value="">--</option>
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">終了日</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>終了時刻</Label>
                <div className="flex items-center gap-1">
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                  >
                    <option value="">--</option>
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">:</span>
                  <select
                    className="w-20 h-10 px-2 rounded-md border border-input bg-background text-sm"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                  >
                    <option value="">--</option>
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 参加者 */}
          <div className="space-y-2">
            <Label>参加者</Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
              {sortedEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`participant-${emp.id}`}
                    checked={participantIds.includes(emp.id)}
                    onCheckedChange={() => toggleParticipant(emp.id)}
                  />
                  <Label
                    htmlFor={`participant-${emp.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {emp.name}
                    {emp.id === currentEmployeeId && (
                      <span className="text-xs text-muted-foreground ml-1">(自分)</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* 場所 */}
          <div className="space-y-2">
            <Label htmlFor="location">場所</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="場所"
            />
          </div>

          {/* GoogleMapリンク */}
          <div className="space-y-2">
            <Label htmlFor="mapUrl">Google Map リンク</Label>
            <Input
              id="mapUrl"
              type="url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>

          {/* 詳細 */}
          <div className="space-y-2">
            <Label htmlFor="description">詳細</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細メモ"
              rows={3}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

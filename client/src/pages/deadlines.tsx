import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  CalendarDays,
  List,
  Grid3X3,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
} from "date-fns";
import type { Deadline, Proceeding } from "@shared/schema";

interface DeadlineWithProceeding extends Deadline {
  proceeding?: Proceeding;
}

const deadlineTypes = [
  "all",
  "loi_expiration",
  "application_due",
  "opposition_window",
  "hearing",
  "appeal_period",
  "custom",
];

function formatDeadlineType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDaysRemaining(dueDate: string | Date): number {
  return differenceInDays(new Date(dueDate), new Date());
}

function getUrgencyColor(daysRemaining: number): string {
  if (daysRemaining < 0) return "text-muted-foreground line-through";
  if (daysRemaining < 3) return "text-red-600 dark:text-red-400";
  if (daysRemaining < 7) return "text-orange-600 dark:text-orange-400";
  if (daysRemaining < 14) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function getUrgencyBadgeVariant(daysRemaining: number): string {
  if (daysRemaining < 0) return "bg-muted text-muted-foreground";
  if (daysRemaining < 3) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (daysRemaining < 7) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  if (daysRemaining < 14) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
}

export default function Deadlines() {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortField, setSortField] = useState<"dueDate" | "title">("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [form, setForm] = useState({
    proceedingId: "",
    title: "",
    description: "",
    dueDate: "",
    deadlineType: "custom" as string,
  });

  const { data: deadlines, isLoading } = useQuery<DeadlineWithProceeding[]>({
    queryKey: ["/api/deadlines"],
  });

  const { data: proceedings } = useQuery<Proceeding[]>({
    queryKey: ["/api/proceedings"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      proceedingId: number;
      title: string;
      description: string;
      dueDate: string;
      deadlineType: string;
    }) => {
      const res = await apiRequest("POST", "/api/deadlines", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      setDialogOpen(false);
      setForm({ proceedingId: "", title: "", description: "", dueDate: "", deadlineType: "custom" });
      toast({ title: "Deadline Created", description: "New deadline has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const res = await apiRequest("PATCH", `/api/deadlines/${id}`, { isCompleted });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.proceedingId) return;
    createMutation.mutate({
      proceedingId: Number(form.proceedingId),
      title: form.title,
      description: form.description,
      dueDate: new Date(form.dueDate).toISOString(),
      deadlineType: form.deadlineType,
    });
  };

  const filteredDeadlines = useMemo(() => {
    if (!deadlines) return [];
    let result = [...deadlines];

    if (typeFilter !== "all") {
      result = result.filter((d) => d.deadlineType === typeFilter);
    }

    if (!showCompleted) {
      result = result.filter((d) => !d.isCompleted);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "dueDate") {
        cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else {
        cmp = a.title.localeCompare(b.title);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [deadlines, typeFilter, showCompleted, sortField, sortDir]);

  const toggleSort = (field: "dueDate" | "title") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart); // 0=Sun

  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, DeadlineWithProceeding[]>();
    if (!filteredDeadlines) return map;
    for (const d of filteredDeadlines) {
      const key = format(new Date(d.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [filteredDeadlines]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Deadline Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Track and manage all CON proceeding deadlines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="rounded-r-none"
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendar")}
              className="rounded-l-none"
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Calendar
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Deadline
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Deadline</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dl-proceeding">Proceeding</Label>
                  <Select
                    value={form.proceedingId}
                    onValueChange={(v) => setForm({ ...form, proceedingId: v })}
                  >
                    <SelectTrigger id="dl-proceeding">
                      <SelectValue placeholder="Select a proceeding" />
                    </SelectTrigger>
                    <SelectContent>
                      {proceedings?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.caseNumber} - {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dl-title">Title</Label>
                  <Input
                    id="dl-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Opposition Filing Window Closes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dl-description">Description</Label>
                  <Input
                    id="dl-description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional details"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dl-dueDate">Due Date</Label>
                  <Input
                    id="dl-dueDate"
                    type="date"
                    required
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dl-type">Deadline Type</Label>
                  <Select
                    value={form.deadlineType}
                    onValueChange={(v) => setForm({ ...form, deadlineType: v })}
                  >
                    <SelectTrigger id="dl-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {deadlineTypes.filter((t) => t !== "all").map((t) => (
                        <SelectItem key={t} value={t}>
                          {formatDeadlineType(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Add Deadline"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {deadlineTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All Types" : formatDeadlineType(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={(checked) => setShowCompleted(checked === true)}
          />
          <Label htmlFor="show-completed" className="text-sm cursor-pointer">
            Show completed
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : view === "list" ? (
        /* List View */
        filteredDeadlines.length === 0 ? (
          <Card className="p-12 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-serif text-lg font-semibold mb-1">No Deadlines</h3>
            <p className="text-sm text-muted-foreground">
              {typeFilter !== "all" || showCompleted
                ? "No deadlines match your current filters."
                : "Add deadlines to track important dates."}
            </p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("dueDate")}
                  >
                    Due Date {sortField === "dueDate" ? (sortDir === "asc" ? "^" : "v") : ""}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("title")}
                  >
                    Title {sortField === "title" ? (sortDir === "asc" ? "^" : "v") : ""}
                  </TableHead>
                  <TableHead>Proceeding</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Days Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeadlines.map((deadline) => {
                  const daysRemaining = getDaysRemaining(deadline.dueDate);
                  return (
                    <TableRow
                      key={deadline.id}
                      className={deadline.isCompleted ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={deadline.isCompleted}
                          onCheckedChange={(checked) =>
                            toggleCompleteMutation.mutate({
                              id: deadline.id,
                              isCompleted: checked === true,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(deadline.dueDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <span className={deadline.isCompleted ? "line-through" : ""}>
                          {deadline.title}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {deadline.proceeding ? (
                          <span className="font-mono text-xs">
                            {deadline.proceeding.caseNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                        {deadline.proceeding && (
                          <span className="ml-2 text-muted-foreground text-xs truncate max-w-[150px] inline-block align-middle">
                            {deadline.proceeding.title}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatDeadlineType(deadline.deadlineType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {deadline.isCompleted ? (
                          <span className="flex items-center justify-end gap-1 text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Done
                          </span>
                        ) : (
                          <span className={`font-medium ${getUrgencyColor(daysRemaining)}`}>
                            {daysRemaining < 0
                              ? `${Math.abs(daysRemaining)}d overdue`
                              : daysRemaining === 0
                                ? "Today"
                                : `${daysRemaining}d`}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        /* Calendar View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-serif text-lg font-semibold">
              {format(calendarMonth, "MMMM yyyy")}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Padding for start of month */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="bg-background p-2 min-h-[80px]" />
            ))}

            {/* Calendar days */}
            {calendarDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayDeadlines = deadlinesByDate.get(key) || [];
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={key}
                  className={`bg-background p-2 min-h-[80px] ${
                    isToday ? "ring-2 ring-primary ring-inset" : ""
                  }`}
                >
                  <div
                    className={`text-xs mb-1 ${
                      isToday ? "font-bold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayDeadlines.slice(0, 3).map((dl) => {
                      const daysRem = getDaysRemaining(dl.dueDate);
                      return (
                        <div
                          key={dl.id}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${getUrgencyBadgeVariant(daysRem)} ${
                            dl.isCompleted ? "opacity-50 line-through" : ""
                          }`}
                          title={`${dl.title}${dl.proceeding ? ` (${dl.proceeding.caseNumber})` : ""}`}
                        >
                          {dl.title}
                        </div>
                      );
                    })}
                    {dayDeadlines.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayDeadlines.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

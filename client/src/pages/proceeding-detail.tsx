import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Building2,
  MapPin,
  ExternalLink,
  Scale,
  Clock,
  DollarSign,
  BookOpen,
  Loader2,
  Pencil,
  FileText,
  Download,
  File,
  AlertCircle,
  CheckCircle2,
  Timer,
  Gavel,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { statusColors, formatStatus, typeColors, typeLabels } from "@/lib/proceeding-utils";
import type {
  Proceeding,
  ProceedingEvent,
  ProceedingDocument,
  Deadline,
  Subscription,
  CaseBrief,
} from "@shared/schema";
import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";

const sourceColors: Record<string, string> = {
  manual: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  tracking_report: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  laserfiche: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const docSyncLabels: Record<string, string> = {
  metadata_only: "Metadata Only",
  downloading: "Downloading",
  synced: "Synced",
  error: "Error",
};

const docSyncColors: Record<string, string> = {
  metadata_only: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  downloading: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  synced: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const documentTypeLabels: Record<string, string> = {
  application: "Application",
  loi: "Letter of Intent",
  opposition: "Opposition",
  determination: "Determination",
  correspondence: "Correspondence",
  exhibit: "Exhibit",
  brief: "Brief",
  order: "Order",
  tracking_report: "Tracking Report",
  other: "Other",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProceedingDetail() {
  const [, params] = useRoute("/proceedings/:id");
  const proceedingId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("timeline");

  // --- Data fetching ---
  const { data: proceeding, isLoading } = useQuery<Proceeding>({
    queryKey: ["/api/proceedings", proceedingId],
    queryFn: async () => {
      const res = await fetch(`/api/proceedings/${proceedingId}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!proceedingId,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<ProceedingEvent[]>({
    queryKey: ["/api/proceedings", proceedingId, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/proceedings/${proceedingId}/events`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!proceedingId,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<ProceedingDocument[]>({
    queryKey: ["/api/proceedings", proceedingId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/proceedings/${proceedingId}/documents`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!proceedingId,
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/proceedings", proceedingId, "deadlines"],
    queryFn: async () => {
      const res = await fetch(`/api/proceedings/${proceedingId}/deadlines`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!proceedingId,
  });

  const { data: caseBrief, isLoading: briefLoading } = useQuery<CaseBrief | null>({
    queryKey: ["/api/proceedings", proceedingId, "case-brief"],
    queryFn: async () => {
      const res = await fetch(`/api/proceedings/${proceedingId}/case-brief`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!proceedingId,
  });

  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!user,
  });

  const isSubscribed = subscriptions?.some(
    (s) => s.proceedingId === proceedingId && s.subscriptionType === "proceeding"
  );

  // --- Mutations ---
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (isSubscribed) {
        const sub = subscriptions?.find(
          (s) => s.proceedingId === proceedingId && s.subscriptionType === "proceeding"
        );
        if (sub) {
          await apiRequest("DELETE", `/api/subscriptions/${sub.id}`);
        }
      } else {
        await apiRequest("POST", "/api/subscriptions", {
          subscriptionType: "proceeding",
          proceedingId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: isSubscribed ? "Unsubscribed" : "Subscribed",
        description: isSubscribed
          ? "You will no longer receive alerts for this proceeding."
          : "You will receive alerts when this proceeding is updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleDeadlineMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      await apiRequest("PATCH", `/api/deadlines/${id}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/proceedings", proceedingId, "deadlines"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </div>
    );
  }

  // --- Not found state ---
  if (!proceeding) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-12 text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">
            Proceeding Not Found
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            This proceeding does not exist or has been removed.
          </p>
          <Link href="/proceedings">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Proceedings
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const sortedEvents = [...(events || [])].sort(
    (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  );

  const sortedDeadlines = [...(deadlines || [])].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/proceedings">
          <Button variant="ghost" size="icon" data-testid="button-back-proceedings">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="font-serif text-xl font-bold"
              data-testid="text-proceeding-title"
            >
              {proceeding.title}
            </h1>
            <Badge className={typeColors[proceeding.proceedingType] || ""}>
              {typeLabels[proceeding.proceedingType] || proceeding.proceedingType}
            </Badge>
            <Badge className={statusColors[proceeding.status] || ""}>
              {formatStatus(proceeding.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {proceeding.caseNumber}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {user?.role === "admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/proceedings/${proceedingId}/edit`)}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button
            variant={isSubscribed ? "secondary" : "default"}
            size="sm"
            onClick={() => subscribeMutation.mutate()}
            disabled={subscribeMutation.isPending}
            data-testid="button-subscribe-proceeding"
          >
            {isSubscribed ? (
              <>
                <BellOff className="w-4 h-4 mr-2" />
                Unsubscribe
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Subscribe
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Key Info Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Applicant
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            {proceeding.applicant}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Facility
          </p>
          <p className="text-sm font-medium">{proceeding.facilityName}</p>
          <p className="text-xs text-muted-foreground">{proceeding.facilityType}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            County
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            {proceeding.county}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Filing Date
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            {format(new Date(proceeding.filingDate), "MMMM d, yyyy")}
          </p>
        </Card>
      </div>

      {/* Additional info row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {proceeding.estimatedCost && (
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Estimated Cost
            </p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              {proceeding.estimatedCost}
            </p>
          </Card>
        )}
        {proceeding.bedCount && (
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Bed Count
            </p>
            <p className="text-sm font-medium">{proceeding.bedCount}</p>
          </Card>
        )}
        {proceeding.hearingDate && (
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Hearing Date
            </p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {format(new Date(proceeding.hearingDate), "MMMM d, yyyy")}
            </p>
          </Card>
        )}
        {proceeding.decisionDate && (
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Decision Date
            </p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {format(new Date(proceeding.decisionDate), "MMMM d, yyyy")}
            </p>
          </Card>
        )}
        {proceeding.equipmentType && (
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Equipment Type
            </p>
            <p className="text-sm font-medium">{proceeding.equipmentType}</p>
          </Card>
        )}
        {proceeding.serviceType && (
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Service Type
            </p>
            <p className="text-sm font-medium">{proceeding.serviceType}</p>
          </Card>
        )}
      </div>

      {/* Description */}
      {proceeding.description && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Description
          </p>
          <p className="text-sm leading-relaxed">{proceeding.description}</p>
        </Card>
      )}

      {/* Laserfiche link */}
      {proceeding.laserficheUrl && (
        <a
          href={proceeding.laserficheUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Laserfiche
          </Button>
        </a>
      )}

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="case-brief">Case Brief</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card className="p-6">
            <h2 className="font-serif font-semibold text-lg mb-4">
              Proceeding Timeline
            </h2>
            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !sortedEvents || sortedEvents.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No timeline events recorded yet.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {sortedEvents.map((event, i) => (
                  <div key={event.id} className="flex gap-4" data-testid={`event-${event.id}`}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                          i === 0 ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      />
                      {i < sortedEvents.length - 1 && (
                        <div className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-6 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{event.title}</p>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${
                            sourceColors[event.source] || sourceColors.manual
                          }`}
                        >
                          {event.source === "tracking_report"
                            ? "Tracking Report"
                            : event.source.charAt(0).toUpperCase() +
                              event.source.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(event.eventDate), "MMMM d, yyyy")}
                        {" -- "}
                        {event.eventType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card className="p-6">
            <h2 className="font-serif font-semibold text-lg mb-4">Documents</h2>
            {documentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !documents || documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No documents available for this proceeding.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <File className="w-8 h-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {doc.filename}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>
                          {documentTypeLabels[doc.documentType] || doc.documentType}
                        </span>
                        <span>&middot;</span>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>&middot;</span>
                        <span>
                          {format(new Date(doc.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {doc.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`text-[10px] shrink-0 ${
                        docSyncColors[doc.syncStatus] || ""
                      }`}
                    >
                      {docSyncLabels[doc.syncStatus] || doc.syncStatus}
                    </Badge>
                    {doc.syncStatus === "synced" && doc.localStorageKey && (
                      <a
                        href={`/api/proceedings/${proceedingId}/documents/${doc.id}/download`}
                        download
                      >
                        <Button variant="ghost" size="icon" title="Download">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    {doc.laserficheUrl && (
                      <a
                        href={doc.laserficheUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" title="View on Laserfiche">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines">
          <Card className="p-6">
            <h2 className="font-serif font-semibold text-lg mb-4">Deadlines</h2>
            {deadlinesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !sortedDeadlines || sortedDeadlines.length === 0 ? (
              <div className="text-center py-8">
                <Timer className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No deadlines set for this proceeding.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedDeadlines.map((deadline) => {
                  const dueDate = new Date(deadline.dueDate);
                  const daysLeft = differenceInDays(dueDate, new Date());
                  const overdue = isPast(dueDate) && !deadline.isCompleted;

                  return (
                    <div
                      key={deadline.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        deadline.isCompleted
                          ? "bg-muted/50 opacity-70"
                          : overdue
                          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                          : daysLeft <= 7
                          ? "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30"
                          : "bg-card"
                      }`}
                    >
                      <Checkbox
                        checked={deadline.isCompleted}
                        onCheckedChange={(checked) =>
                          toggleDeadlineMutation.mutate({
                            id: deadline.id,
                            isCompleted: !!checked,
                          })
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            deadline.isCompleted ? "line-through" : ""
                          }`}
                        >
                          {deadline.title}
                        </p>
                        {deadline.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {deadline.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {deadline.deadlineType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Badge>
                          {deadline.isAutoGenerated && (
                            <span className="text-muted-foreground italic">
                              Auto-generated
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {format(dueDate, "MMM d, yyyy")}
                        </p>
                        {deadline.isCompleted ? (
                          <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </p>
                        ) : overdue ? (
                          <p className="text-xs text-red-600 flex items-center gap-1 justify-end">
                            <AlertCircle className="w-3 h-3" />
                            Overdue by{" "}
                            {formatDistanceToNow(dueDate)}
                          </p>
                        ) : (
                          <p
                            className={`text-xs ${
                              daysLeft <= 7 ? "text-yellow-600" : "text-muted-foreground"
                            }`}
                          >
                            {daysLeft === 0
                              ? "Due today"
                              : daysLeft === 1
                              ? "Due tomorrow"
                              : `${daysLeft} days remaining`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Case Brief Tab */}
        <TabsContent value="case-brief">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Case Brief
              </h2>
              {caseBrief && (
                <Badge variant="secondary" className="text-[10px]">
                  {caseBrief.generatedBy === "ai"
                    ? `AI Generated${caseBrief.aiModel ? ` (${caseBrief.aiModel})` : ""}`
                    : "Manual"}
                </Badge>
              )}
            </div>
            <Separator className="mb-4" />
            {briefLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : !caseBrief ? (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No case brief has been generated for this proceeding yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-sm">
                      Case Summary
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {caseBrief.summary}
                  </p>
                </section>
                <Separator />
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Gavel className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-sm">
                      Decision Issues
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {caseBrief.decisionIssues}
                  </p>
                </section>
                <Separator />
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-sm">
                      Appellate Issues
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {caseBrief.appellateIssues}
                  </p>
                </section>
                <Separator />
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-sm">
                      Judicial Review
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {caseBrief.judicialReview}
                  </p>
                </section>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

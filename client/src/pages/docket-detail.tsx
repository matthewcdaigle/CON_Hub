import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Gavel,
  AlertTriangle,
  FileCheck,
  Pencil,
  Trash2,
  FileText,
  Upload,
  Download,
  File,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { statusColors, formatStatus } from "@/lib/docket-utils";
import { DocketFormDialog } from "@/components/docket-form-dialog";
import type { Docket, DocketEvent, DocketSubscription, CaseBrief, DocketDocument } from "@shared/schema";
import { format } from "date-fns";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const documentTypeLabels: Record<string, string> = {
  application: "Application",
  order: "Order",
  notice: "Notice",
  correspondence: "Correspondence",
  other: "Other",
};

const eventTypeIcons: Record<string, string> = {
  filing: "Filed",
  hearing: "Hearing",
  decision: "Decision",
  amendment: "Amendment",
  public_comment: "Public Comment",
  staff_report: "Staff Report",
  continuance: "Continuance",
  default: "Event",
};

export default function DocketDetail() {
  const [, params] = useRoute("/dockets/:id");
  const docketId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const briefRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);

  const { data: docket, isLoading } = useQuery<Docket>({
    queryKey: ["/api/dockets", docketId],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<DocketEvent[]>({
    queryKey: ["/api/dockets", docketId, "events"],
  });

  const { data: subscriptions } = useQuery<DocketSubscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !!user,
  });

  const { data: existingBrief, isLoading: briefLoading } = useQuery<CaseBrief>({
    queryKey: ["/api/case-briefs/docket", docketId],
  });

  const isSubscribed = subscriptions?.some((s) => s.docketId === docketId);

  const generateBrief = async () => {
    setIsGenerating(true);
    setStreamedContent("");
    try {
      const response = await fetch("/api/case-briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ docketId }),
      });

      if (!response.ok) throw new Error("Failed to generate brief");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setStreamedContent((prev) => prev + data.content);
              }
              if (data.done) {
                queryClient.invalidateQueries({ queryKey: ["/api/case-briefs/docket", docketId] });
                queryClient.invalidateQueries({ queryKey: ["/api/case-briefs"] });
                toast({ title: "Case Brief Generated", description: "The case brief has been saved." });
              }
              if (data.error) {
                toast({ title: "Error", description: data.error, variant: "destructive" });
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate case brief.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const { data: documents, isLoading: documentsLoading } = useQuery<DocketDocument[]>({
    queryKey: ["/api/dockets", docketId, "documents"],
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/dockets/${docketId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dockets", docketId, "documents"] });
      toast({ title: "Document Uploaded", description: "The file has been uploaded successfully." });
      setShowUploadDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dockets", docketId, "documents"] });
      toast({ title: "Document Deleted", description: "The document has been removed." });
      setDeleteDocId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (isSubscribed) {
        const sub = subscriptions?.find((s) => s.docketId === docketId);
        if (sub) {
          await apiRequest("DELETE", `/api/subscriptions/${sub.id}`);
        }
      } else {
        await apiRequest("POST", "/api/subscriptions", { docketId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: isSubscribed ? "Unsubscribed" : "Subscribed",
        description: isSubscribed
          ? "You will no longer receive alerts for this docket."
          : "You will receive alerts when this docket is updated.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/dockets/${docketId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dockets"] });
      toast({
        title: "Docket Deleted",
        description: "The docket has been permanently removed.",
      });
      navigate("/dockets");
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Delete",
        description: error.message || "Failed to delete docket.",
        variant: "destructive",
      });
    },
  });

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

  if (!docket) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-12 text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">Docket Not Found</h3>
          <p className="text-sm text-muted-foreground mb-4">This docket does not exist or has been removed.</p>
          <Link href="/dockets">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dockets
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dockets">
          <Button variant="ghost" size="icon" data-testid="button-back-dockets">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-xl font-bold" data-testid="text-docket-title">{docket.title}</h1>
            <Badge className={statusColors[docket.status] || ""}>
              {formatStatus(docket.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{docket.caseNumber}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={generateBrief}
            disabled={isGenerating}
            data-testid="button-generate-brief"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 mr-2" />
                {existingBrief ? "Regenerate Brief" : "Generate Brief"}
              </>
            )}
          </Button>
          {user?.role === "admin" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditForm(true)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          <Button
            variant={isSubscribed ? "secondary" : "default"}
            onClick={() => subscribeMutation.mutate()}
            disabled={subscribeMutation.isPending}
            data-testid="button-subscribe-docket"
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

      {docket && (
        <DocketFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          docket={docket}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Docket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{docket.title}"? This action cannot be
              undone. If this docket has dependent records (research documents,
              notifications, or saved drafts), deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif font-semibold text-lg">Case Details</h2>
            <Separator />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Applicant</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {docket.applicant}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Facility</p>
                <p className="text-sm font-medium">{docket.facilityName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Facility Type</p>
                <p className="text-sm font-medium">{docket.facilityType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">County</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {docket.county}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Filing Date</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {format(new Date(docket.filingDate), "MMMM d, yyyy")}
                </p>
              </div>
              {docket.hearingDate && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Hearing Date</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(new Date(docket.hearingDate), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {docket.decisionDate && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Decision Date</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(new Date(docket.decisionDate), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {docket.estimatedCost && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Cost</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    {docket.estimatedCost}
                  </p>
                </div>
              )}
            </div>
            {docket.description && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                  <p className="text-sm leading-relaxed">{docket.description}</p>
                </div>
              </>
            )}
            {docket.laserficheUrl && (
              <>
                <Separator />
                <a
                  href={docket.laserficheUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                  data-testid="link-laserfiche-detail"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Laserfiche
                  </Button>
                </a>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-serif font-semibold text-lg mb-4">Timeline</h2>
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
            ) : !events || events.length === 0 ? (
              <div className="text-center py-4">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event, i) => (
                  <div key={event.id} className="flex gap-3" data-testid={`event-${event.id}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {eventTypeIcons[event.eventType] || event.eventType} &middot;{" "}
                        {format(new Date(event.eventDate), "MMM d, yyyy")}
                      </p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {(isGenerating || streamedContent || existingBrief) && (
        <Card className="p-6 space-y-4" ref={briefRef}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Case Brief
            </h2>
            {isGenerating && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Generating...
              </Badge>
            )}
          </div>
          <Separator />

          {isGenerating || streamedContent ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-streamed-brief">
              {streamedContent}
              {isGenerating && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />}
            </div>
          ) : existingBrief ? (
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold text-sm">Case Summary</h3>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-existing-brief-summary">{existingBrief.summary}</p>
              </section>
              <Separator />
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Gavel className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold text-sm">Main Issues at the Decision Level</h3>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-existing-brief-decision">{existingBrief.decisionIssues}</p>
              </section>
              <Separator />
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold text-sm">Appellate Issues</h3>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-existing-brief-appellate">{existingBrief.appellateIssues}</p>
              </section>
              <Separator />
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold text-sm">Judicial Review Proceedings</h3>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-existing-brief-judicial">{existingBrief.judicialReview}</p>
              </section>
            </div>
          ) : null}
        </Card>
      )}

      {/* Documents Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-semibold text-lg">Documents</h2>
          {user?.role === "admin" && (
            <Button size="sm" onClick={() => setShowUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          )}
        </div>
        <Separator className="mb-4" />
        {documentsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
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
          <div className="text-center py-6">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
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
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {documentTypeLabels[doc.documentType] || doc.documentType}
                    {" \u00b7 "}
                    {formatFileSize(doc.fileSize)}
                    {" \u00b7 "}
                    {format(new Date(doc.createdAt), "MMM d, yyyy")}
                  </p>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={`/api/documents/${doc.id}/download`} download>
                    <Button variant="ghost" size="icon" title="Download">
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                  {user?.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteDocId(doc.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Upload Dialog */}
      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={(formData) => uploadMutation.mutate(formData)}
        isPending={uploadMutation.isPending}
      />

      {/* Delete Document Confirmation */}
      <AlertDialog open={deleteDocId !== null} onOpenChange={(open) => { if (!open) setDeleteDocId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This will permanently remove the file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
              disabled={deleteDocMutation.isPending}
            >
              {deleteDocMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Upload Dialog Component ─────────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  onUpload,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (formData: FormData) => void;
  isPending: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("other");
  const [description, setDescription] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedFile(null);
      setDocumentType("other");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("documentType", documentType);
    if (description) formData.append("description", description);
    onUpload(formData);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Accepted formats: PDF, Word (.docx), Excel (.xlsx), plain text. Max 50 MB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              ref={fileInputRef}
              id="file"
              type="file"
              accept=".pdf,.docx,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="documentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="application">Application</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="notice">Notice</SelectItem>
                <SelectItem value="correspondence">Correspondence</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedFile}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ImportJob {
  id: number;
  source: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalRecords: number;
  createdRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface ImportRecord {
  id: number;
  jobId: number;
  rowNumber: number | null;
  caseNumber: string | null;
  action: string | null;
  errorMessage: string | null;
  rawData: unknown;
  createdAt: string;
}

interface ImportJobDetail extends ImportJob {
  records: ImportRecord[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  running: { label: "Running", variant: "outline", icon: Loader2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

const actionColors: Record<string, string> = {
  created: "bg-green-500/10 text-green-700 dark:text-green-400",
  updated: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  skipped: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function AdminImports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect non-admin users
  if (user && user.role !== "admin") {
    setLocation("/dockets");
    return null;
  }

  const { data: jobs, isLoading: jobsLoading } = useQuery<ImportJob[]>({
    queryKey: ["/api/import/jobs"],
    enabled: !!user,
  });

  const { data: jobDetail, isLoading: detailLoading } = useQuery<ImportJobDetail>({
    queryKey: ["/api/import/jobs", selectedJobId],
    queryFn: async () => {
      const res = await fetch(`/api/import/jobs/${selectedJobId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: selectedJobId !== null,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/csv", {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/import/jobs"] });
      toast({
        title: "Import Complete",
        description: `Created: ${data.createdRecords}, Updated: ${data.updatedRecords}, Failed: ${data.failedRecords}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Import History</h1>
          <p className="text-muted-foreground text-sm">
            Monitor data imports and upload CSV files.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import CSV
          </Button>
        </div>
      </div>

      {jobsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">No Imports Yet</h3>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to import docket data.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const cfg = statusConfig[job.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                return (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                    <TableCell className="capitalize">{job.source}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="gap-1">
                        <StatusIcon className={`w-3 h-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.startedAt ? format(new Date(job.startedAt), "MMM d, h:mm a") : "—"}
                    </TableCell>
                    <TableCell>{job.totalRecords}</TableCell>
                    <TableCell className="text-green-600 dark:text-green-400">{job.createdRecords}</TableCell>
                    <TableCell className="text-blue-600 dark:text-blue-400">{job.updatedRecords}</TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">{job.failedRecords}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Job Detail Dialog */}
      <Dialog open={selectedJobId !== null} onOpenChange={(open) => { if (!open) setSelectedJobId(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Import Job #{selectedJobId}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : jobDetail ? (
            <div className="space-y-4 overflow-auto flex-1">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold">{jobDetail.totalRecords}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{jobDetail.createdRecords}</p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{jobDetail.updatedRecords}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{jobDetail.failedRecords}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </Card>
              </div>

              {/* Metadata */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Source: <span className="capitalize text-foreground">{jobDetail.source}</span></p>
                {jobDetail.startedAt && (
                  <p>Started: <span className="text-foreground">{format(new Date(jobDetail.startedAt), "MMM d, yyyy h:mm:ss a")}</span></p>
                )}
                {jobDetail.completedAt && (
                  <p>Completed: <span className="text-foreground">{format(new Date(jobDetail.completedAt), "MMM d, yyyy h:mm:ss a")}</span></p>
                )}
                {jobDetail.errorMessage && (
                  <p className="text-red-600 dark:text-red-400">Error: {jobDetail.errorMessage}</p>
                )}
              </div>

              {/* Records table */}
              {jobDetail.records && jobDetail.records.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Case Number</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobDetail.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-xs">{record.rowNumber ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{record.caseNumber || "—"}</TableCell>
                        <TableCell>
                          {record.action ? (
                            <Badge className={actionColors[record.action] || ""}>
                              {record.action}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-red-600 dark:text-red-400 max-w-xs truncate">
                          {record.errorMessage || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

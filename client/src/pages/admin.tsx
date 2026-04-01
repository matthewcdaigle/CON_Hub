import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  FileUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Database,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import type { SyncJob } from "@shared/schema";

function getSyncJobStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
}

function formatJobType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "--";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

interface ImportResult {
  message: string;
  recordsCreated: number;
  recordsUpdated: number;
}

export default function Admin() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data: syncJobs, isLoading: jobsLoading } = useQuery<SyncJob[]>({
    queryKey: ["/api/admin/sync-jobs"],
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(0);
      setImportResult(null);

      return new Promise<ImportResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/import-tracking-report");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve({ message: "Import complete", recordsCreated: 0, recordsUpdated: 0 });
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      setUploadProgress(100);
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync-jobs"] });
      toast({
        title: "Import Complete",
        description: `Created ${data.recordsCreated} and updated ${data.recordsUpdated} records.`,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <h1 className="font-serif text-2xl font-bold">Admin Panel</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage data imports, sync jobs, and system integrations.
        </p>
      </div>

      {/* Import Tracking Report */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Import Tracking Report</h2>
            <p className="text-sm text-muted-foreground">
              Upload a Georgia CON Tracking Report PDF to import or update proceedings.
            </p>
          </div>
        </div>
        <Separator className="mb-4" />

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={handleFileSelect}
              disabled={importMutation.isPending}
              variant="outline"
            >
              <FileUp className="w-4 h-4 mr-2" />
              {importMutation.isPending ? "Uploading..." : "Select PDF File"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Accepts PDF files from the Georgia DCH CON program
            </span>
          </div>

          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading and processing...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {importResult && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800 dark:text-green-300">
                  {importResult.message}
                </p>
                <p className="text-green-700 dark:text-green-400 mt-1">
                  {importResult.recordsCreated} records created, {importResult.recordsUpdated} records updated
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Laserfiche Integration */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Laserfiche Integration</h2>
            <p className="text-sm text-muted-foreground">
              Sync documents and metadata from the Laserfiche repository.
            </p>
          </div>
        </div>
        <Separator className="mb-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button disabled variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Trigger Laserfiche Scan
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Laserfiche API not yet configured</p>
          </TooltipContent>
        </Tooltip>
      </Card>

      {/* Sync Jobs */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Sync Jobs</h2>
            <p className="text-sm text-muted-foreground">
              Recent data synchronization and import jobs.
            </p>
          </div>
        </div>
        <Separator className="mb-4" />

        {jobsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !syncJobs || syncJobs.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No sync jobs have been run yet. Import a tracking report to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    {formatJobType(job.jobType)}
                  </TableCell>
                  <TableCell>{getSyncJobStatusBadge(job.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.createdAt
                      ? format(new Date(job.createdAt), "MMM d, yyyy h:mm a")
                      : "--"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatDuration(
                      job.startedAt as string | null,
                      job.completedAt as string | null
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

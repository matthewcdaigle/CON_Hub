import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatStatus } from "@/lib/docket-utils";
import type { Docket } from "@shared/schema";
import { Loader2 } from "lucide-react";

const allStatuses = [
  "pre_filing",
  "filed",
  "under_review",
  "hearing_scheduled",
  "hearing_complete",
  "decision_pending",
  "approved",
  "denied",
  "withdrawn",
  "appealed",
] as const;

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

interface DocketFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docket?: Docket;
}

export function DocketFormDialog({ open, onOpenChange, docket }: DocketFormDialogProps) {
  const isEdit = !!docket;
  const { toast } = useToast();

  const [caseNumber, setCaseNumber] = useState("");
  const [title, setTitle] = useState("");
  const [applicant, setApplicant] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [county, setCounty] = useState("");
  const [status, setStatus] = useState<string>("filed");
  const [filingDate, setFilingDate] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [laserficheUrl, setLaserficheUrl] = useState("");

  useEffect(() => {
    if (open && docket) {
      setCaseNumber(docket.caseNumber);
      setTitle(docket.title);
      setApplicant(docket.applicant);
      setFacilityName(docket.facilityName);
      setFacilityType(docket.facilityType);
      setCounty(docket.county);
      setStatus(docket.status);
      setFilingDate(toDateInput(docket.filingDate));
      setHearingDate(toDateInput(docket.hearingDate));
      setDecisionDate(toDateInput(docket.decisionDate));
      setDescription(docket.description ?? "");
      setEstimatedCost(docket.estimatedCost ?? "");
      setLaserficheUrl(docket.laserficheUrl ?? "");
    } else if (open && !docket) {
      setCaseNumber("");
      setTitle("");
      setApplicant("");
      setFacilityName("");
      setFacilityType("");
      setCounty("");
      setStatus("filed");
      setFilingDate("");
      setHearingDate("");
      setDecisionDate("");
      setDescription("");
      setEstimatedCost("");
      setLaserficheUrl("");
    }
  }, [open, docket]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        caseNumber,
        title,
        applicant,
        facilityName,
        facilityType,
        county,
        status,
        filingDate: new Date(filingDate).toISOString(),
        hearingDate: hearingDate ? new Date(hearingDate).toISOString() : null,
        decisionDate: decisionDate ? new Date(decisionDate).toISOString() : null,
        description: description || null,
        estimatedCost: estimatedCost || null,
        laserficheUrl: laserficheUrl || null,
      };

      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/dockets/${docket.id}`, body);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/dockets", body);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dockets"] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ["/api/dockets", docket!.id] });
      }
      toast({
        title: isEdit ? "Docket Updated" : "Docket Created",
        description: isEdit
          ? "The docket has been updated successfully."
          : "The new docket has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Docket" : "New Docket"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details for this docket."
              : "Fill in the details to create a new docket."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="caseNumber">Case Number *</Label>
              <Input
                id="caseNumber"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g. CON-2025-001"
                required
                maxLength={64}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Docket title"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="applicant">Applicant *</Label>
              <Input
                id="applicant"
                value={applicant}
                onChange={(e) => setApplicant(e.target.value)}
                placeholder="Applicant name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="county">County *</Label>
              <Input
                id="county"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                placeholder="County name"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="facilityName">Facility Name *</Label>
              <Input
                id="facilityName"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Facility name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facilityType">Facility Type *</Label>
              <Input
                id="facilityType"
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
                placeholder="e.g. Hospital, Nursing Home"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filingDate">Filing Date *</Label>
              <Input
                id="filingDate"
                type="date"
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hearingDate">Hearing Date</Label>
              <Input
                id="hearingDate"
                type="date"
                value={hearingDate}
                onChange={(e) => setHearingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decisionDate">Decision Date</Label>
              <Input
                id="decisionDate"
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the docket..."
              rows={3}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost</Label>
              <Input
                id="estimatedCost"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="e.g. $1,500,000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="laserficheUrl">Laserfiche URL</Label>
              <Input
                id="laserficheUrl"
                type="url"
                value={laserficheUrl}
                onChange={(e) => setLaserficheUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Docket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

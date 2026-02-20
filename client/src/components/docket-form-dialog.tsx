import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatStatus } from "@/lib/docket-utils";
import type { Docket } from "@shared/schema";
import { Loader2 } from "lucide-react";

const docketTypeLabels: Record<string, string> = {
  loi: "LOI",
  con: "CON",
  det: "DET",
  det_eqt: "DET-EQP",
  det_asc: "DET-ASC",
};

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
  const [docketType, setDocketType] = useState<string>("con");
  const [status, setStatus] = useState<string>("filed");
  const [parentDocketId, setParentDocketId] = useState<string>("");
  const [filingDate, setFilingDate] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [laserficheUrl, setLaserficheUrl] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [bedCount, setBedCount] = useState("");
  const [serviceType, setServiceType] = useState("");

  // Fetch LOI dockets for the parent docket selector
  const { data: loiDocketsResult } = useQuery<{ dockets: Docket[] }>({
    queryKey: ["/api/dockets?docketType=loi&pageSize=100"],
    enabled: open && docketType === "con",
  });
  const loiDockets = loiDocketsResult?.dockets ?? [];

  // When docket_type changes on create, set appropriate default status
  const handleDocketTypeChange = (newType: string) => {
    setDocketType(newType);
    if (!isEdit) {
      setStatus(newType === "loi" ? "loi_filed" : "filed");
    }
    // Clear conditional fields when type changes
    if (newType !== "con") setParentDocketId("");
    if (newType !== "det_eqt") setEquipmentType("");
    if (newType !== "con") setBedCount("");
    if (!["con", "det", "det_asc"].includes(newType)) setServiceType("");
  };

  useEffect(() => {
    if (open && docket) {
      setCaseNumber(docket.caseNumber);
      setTitle(docket.title);
      setApplicant(docket.applicant);
      setFacilityName(docket.facilityName);
      setFacilityType(docket.facilityType);
      setCounty(docket.county);
      setDocketType(docket.docketType);
      setStatus(docket.status);
      setParentDocketId(docket.parentDocketId ? String(docket.parentDocketId) : "");
      setFilingDate(toDateInput(docket.filingDate));
      setHearingDate(toDateInput(docket.hearingDate));
      setDecisionDate(toDateInput(docket.decisionDate));
      setDescription(docket.description ?? "");
      setEstimatedCost(docket.estimatedCost ?? "");
      setLaserficheUrl(docket.laserficheUrl ?? "");
      setEquipmentType(docket.equipmentType ?? "");
      setBedCount(docket.bedCount != null ? String(docket.bedCount) : "");
      setServiceType(docket.serviceType ?? "");
    } else if (open && !docket) {
      setCaseNumber("");
      setTitle("");
      setApplicant("");
      setFacilityName("");
      setFacilityType("");
      setCounty("");
      setDocketType("con");
      setStatus("filed");
      setParentDocketId("");
      setFilingDate("");
      setHearingDate("");
      setDecisionDate("");
      setDescription("");
      setEstimatedCost("");
      setLaserficheUrl("");
      setEquipmentType("");
      setBedCount("");
      setServiceType("");
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
        docketType,
        status,
        parentDocketId: parentDocketId && parentDocketId !== "none" ? parseInt(parentDocketId, 10) : null,
        filingDate: new Date(filingDate).toISOString(),
        hearingDate: hearingDate ? new Date(hearingDate).toISOString() : null,
        decisionDate: decisionDate ? new Date(decisionDate).toISOString() : null,
        description: description || null,
        estimatedCost: estimatedCost || null,
        laserficheUrl: laserficheUrl || null,
        equipmentType: equipmentType || null,
        bedCount: bedCount ? parseInt(bedCount, 10) : null,
        serviceType: serviceType || null,
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

  const showEquipmentType = docketType === "det_eqt";
  const showBedCount = docketType === "con";
  const showServiceType = ["con", "det", "det_asc"].includes(docketType);
  const showParentDocket = docketType === "con";

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
              <Label htmlFor="docketType">Docket Type *</Label>
              <Select value={docketType} onValueChange={handleDocketTypeChange}>
                <SelectTrigger id="docketType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(docketTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
              <Label htmlFor="county">County *</Label>
              <Input
                id="county"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                placeholder="County name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>LOI Statuses</SelectLabel>
                    <SelectItem value="loi_filed">{formatStatus("loi_filed")}</SelectItem>
                    <SelectItem value="loi_expired">{formatStatus("loi_expired")}</SelectItem>
                    <SelectItem value="loi_converted">{formatStatus("loi_converted")}</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Primary Review</SelectLabel>
                    <SelectItem value="filed">{formatStatus("filed")}</SelectItem>
                    <SelectItem value="under_review">{formatStatus("under_review")}</SelectItem>
                    <SelectItem value="desk_determination_issued">{formatStatus("desk_determination_issued")}</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Appeal Stages</SelectLabel>
                    <SelectItem value="appeal_hearing_officer_pending">{formatStatus("appeal_hearing_officer_pending")}</SelectItem>
                    <SelectItem value="appeal_hearing_officer_decided">{formatStatus("appeal_hearing_officer_decided")}</SelectItem>
                    <SelectItem value="appeal_con_panel_pending">{formatStatus("appeal_con_panel_pending")}</SelectItem>
                    <SelectItem value="appeal_con_panel_decided">{formatStatus("appeal_con_panel_decided")}</SelectItem>
                    <SelectItem value="appeal_superior_court_pending">{formatStatus("appeal_superior_court_pending")}</SelectItem>
                    <SelectItem value="appeal_superior_court_decided">{formatStatus("appeal_superior_court_decided")}</SelectItem>
                    <SelectItem value="appeal_court_of_appeals_pending">{formatStatus("appeal_court_of_appeals_pending")}</SelectItem>
                    <SelectItem value="appeal_court_of_appeals_decided">{formatStatus("appeal_court_of_appeals_decided")}</SelectItem>
                    <SelectItem value="appeal_supreme_court_pending">{formatStatus("appeal_supreme_court_pending")}</SelectItem>
                    <SelectItem value="appeal_supreme_court_decided">{formatStatus("appeal_supreme_court_decided")}</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Terminal</SelectLabel>
                    <SelectItem value="approved">{formatStatus("approved")}</SelectItem>
                    <SelectItem value="denied">{formatStatus("denied")}</SelectItem>
                    <SelectItem value="withdrawn">{formatStatus("withdrawn")}</SelectItem>
                    <SelectItem value="closed">{formatStatus("closed")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showParentDocket && (
            <div className="space-y-2">
              <Label htmlFor="parentDocketId">Parent LOI Docket</Label>
              <Select value={parentDocketId} onValueChange={setParentDocketId}>
                <SelectTrigger id="parentDocketId">
                  <SelectValue placeholder="Select a parent LOI (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {loiDockets.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.caseNumber} — {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="hearingDate">Hearing Date</Label>
              <Input
                id="hearingDate"
                type="date"
                value={hearingDate}
                onChange={(e) => setHearingDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="decisionDate">Decision Date</Label>
              <Input
                id="decisionDate"
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost</Label>
              <Input
                id="estimatedCost"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="e.g. $1,500,000"
              />
            </div>
          </div>

          {/* Conditional fields based on docket type */}
          {(showEquipmentType || showBedCount || showServiceType) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {showEquipmentType && (
                <div className="space-y-2">
                  <Label htmlFor="equipmentType">Equipment Type</Label>
                  <Input
                    id="equipmentType"
                    value={equipmentType}
                    onChange={(e) => setEquipmentType(e.target.value)}
                    placeholder="e.g. MRI, CT Scanner"
                  />
                </div>
              )}
              {showBedCount && (
                <div className="space-y-2">
                  <Label htmlFor="bedCount">Bed Count</Label>
                  <Input
                    id="bedCount"
                    type="number"
                    min="1"
                    value={bedCount}
                    onChange={(e) => setBedCount(e.target.value)}
                    placeholder="Number of beds"
                  />
                </div>
              )}
              {showServiceType && (
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Input
                    id="serviceType"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    placeholder="e.g. Cardiac Surgery, Psychiatric"
                  />
                </div>
              )}
            </div>
          )}

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

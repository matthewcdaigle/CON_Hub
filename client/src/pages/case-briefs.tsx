import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, BookOpen, Scale, Calendar, Building2, ArrowRight, Gavel, AlertTriangle, FileCheck } from "lucide-react";
import type { CaseBrief, Proceeding } from "@shared/schema";
import { format } from "date-fns";
import { statusColors, formatStatus } from "@/lib/proceeding-utils";

export default function CaseBriefs() {
  const [search, setSearch] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<CaseBrief | null>(null);
  const [selectedProceeding, setSelectedProceeding] = useState<Proceeding | null>(null);

  const { data: briefs, isLoading: briefsLoading } = useQuery<CaseBrief[]>({
    queryKey: ["/api/case-briefs"],
  });

  const { data: proceedingsResult, isLoading: proceedingsLoading } = useQuery<{ data: Proceeding[] } | Proceeding[]>({
    queryKey: ["/api/proceedings"],
    queryFn: () => fetch("/api/proceedings").then((r) => r.json()),
  });

  const proceedingsList = Array.isArray(proceedingsResult) ? proceedingsResult : proceedingsResult?.data || [];

  const getProceeding = (proceedingId: number) => proceedingsList.find((d) => d.id === proceedingId);

  const filtered = (briefs || []).filter((brief) => {
    if (!search) return true;
    const proc = getProceeding(brief.proceedingId);
    const searchLower = search.toLowerCase();
    return (
      brief.summary.toLowerCase().includes(searchLower) ||
      brief.decisionIssues.toLowerCase().includes(searchLower) ||
      brief.appellateIssues.toLowerCase().includes(searchLower) ||
      brief.judicialReview.toLowerCase().includes(searchLower) ||
      proc?.title.toLowerCase().includes(searchLower) ||
      proc?.caseNumber.toLowerCase().includes(searchLower) ||
      proc?.applicant.toLowerCase().includes(searchLower) ||
      proc?.county.toLowerCase().includes(searchLower)
    );
  });

  const openBrief = (brief: CaseBrief) => {
    setSelectedBrief(brief);
    setSelectedProceeding(getProceeding(brief.proceedingId) || null);
  };

  const isLoading = briefsLoading || proceedingsLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold" data-testid="text-case-briefs-title">Case Briefs</h1>
        <p className="text-muted-foreground text-sm">
          Structured legal analysis for each CON proceeding covering decision-level issues, appellate issues, and judicial review.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search briefs, cases, applicants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-briefs"
          />
        </div>
        <Badge variant="secondary" className="text-xs">
          {filtered.length} {filtered.length === 1 ? "brief" : "briefs"}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">No Case Briefs Found</h3>
          <p className="text-sm text-muted-foreground">
            {search
              ? "Try adjusting your search terms."
              : "Generate case briefs from individual proceeding pages to build your research database."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((brief) => {
            const proc = getProceeding(brief.proceedingId);
            return (
              <Card
                key={brief.id}
                className="p-5 hover-elevate cursor-pointer"
                onClick={() => openBrief(brief)}
                data-testid={`card-brief-${brief.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{proc?.title || `Proceeding #${brief.proceedingId}`}</h3>
                      {proc && (
                        <Badge className={statusColors[proc.status] || ""}>
                          {formatStatus(proc.status)}
                        </Badge>
                      )}
                    </div>
                    {proc && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="font-mono text-xs">{proc.caseNumber}</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {proc.applicant}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(proc.filingDate), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">{brief.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Gavel className="w-3 h-3" />
                        Decision Issues
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Appellate Issues
                      </span>
                      <span className="flex items-center gap-1">
                        <FileCheck className="w-3 h-3" />
                        Judicial Review
                      </span>
                      <span>
                        Updated {format(new Date(brief.updatedAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedBrief} onOpenChange={() => { setSelectedBrief(null); setSelectedProceeding(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedBrief && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  {selectedProceeding?.title || `Proceeding #${selectedBrief.proceedingId}`}
                </DialogTitle>
                {selectedProceeding && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="font-mono">{selectedProceeding.caseNumber}</span>
                    <Badge className={statusColors[selectedProceeding.status] || ""}>
                      {formatStatus(selectedProceeding.status)}
                    </Badge>
                    <span>{selectedProceeding.applicant}</span>
                    <span>{selectedProceeding.county} County</span>
                  </div>
                )}
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Scale className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold">Case Summary</h3>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-brief-summary">
                    {selectedBrief.summary}
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Gavel className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold">Main Issues at the Decision Level</h3>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-brief-decision-issues">
                    {selectedBrief.decisionIssues}
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold">Appellate Issues</h3>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-brief-appellate-issues">
                    {selectedBrief.appellateIssues}
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold">Judicial Review Proceedings</h3>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-brief-judicial-review">
                    {selectedBrief.judicialReview}
                  </div>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

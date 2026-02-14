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
import type { CaseBrief, Docket } from "@shared/schema";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pre_filing: "bg-muted text-muted-foreground",
  filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  hearing_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  hearing_complete: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  decision_pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  appealed: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CaseBriefs() {
  const [search, setSearch] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<CaseBrief | null>(null);
  const [selectedDocket, setSelectedDocket] = useState<Docket | null>(null);

  const { data: briefs, isLoading: briefsLoading } = useQuery<CaseBrief[]>({
    queryKey: ["/api/case-briefs"],
  });

  const { data: docketsResult, isLoading: docketsLoading } = useQuery<{ data: Docket[] } | Docket[]>({
    queryKey: ["/api/dockets"],
  });

  const dockets = Array.isArray(docketsResult) ? docketsResult : docketsResult?.data || [];

  const getDocket = (docketId: number) => dockets.find((d) => d.id === docketId);

  const filtered = (briefs || []).filter((brief) => {
    if (!search) return true;
    const docket = getDocket(brief.docketId);
    const searchLower = search.toLowerCase();
    return (
      brief.summary.toLowerCase().includes(searchLower) ||
      brief.decisionIssues.toLowerCase().includes(searchLower) ||
      brief.appellateIssues.toLowerCase().includes(searchLower) ||
      brief.judicialReview.toLowerCase().includes(searchLower) ||
      docket?.title.toLowerCase().includes(searchLower) ||
      docket?.caseNumber.toLowerCase().includes(searchLower) ||
      docket?.applicant.toLowerCase().includes(searchLower) ||
      docket?.county.toLowerCase().includes(searchLower)
    );
  });

  const openBrief = (brief: CaseBrief) => {
    setSelectedBrief(brief);
    setSelectedDocket(getDocket(brief.docketId) || null);
  };

  const isLoading = briefsLoading || docketsLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold" data-testid="text-case-briefs-title">Case Briefs</h1>
        <p className="text-muted-foreground text-sm">
          Structured legal analysis for each CON docket covering decision-level issues, appellate issues, and judicial review.
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
              : "Generate case briefs from individual docket pages to build your research database."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((brief) => {
            const docket = getDocket(brief.docketId);
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
                      <h3 className="font-medium">{docket?.title || `Docket #${brief.docketId}`}</h3>
                      {docket && (
                        <Badge className={statusColors[docket.status] || ""}>
                          {formatStatus(docket.status)}
                        </Badge>
                      )}
                    </div>
                    {docket && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="font-mono text-xs">{docket.caseNumber}</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {docket.applicant}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(docket.filingDate), "MMM d, yyyy")}
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

      <Dialog open={!!selectedBrief} onOpenChange={() => { setSelectedBrief(null); setSelectedDocket(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedBrief && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  {selectedDocket?.title || `Docket #${selectedBrief.docketId}`}
                </DialogTitle>
                {selectedDocket && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="font-mono">{selectedDocket.caseNumber}</span>
                    <Badge className={statusColors[selectedDocket.status] || ""}>
                      {formatStatus(selectedDocket.status)}
                    </Badge>
                    <span>{selectedDocket.applicant}</span>
                    <span>{selectedDocket.county} County</span>
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

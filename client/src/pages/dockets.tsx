import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { Search, Scale, Building2, Calendar, MapPin, ArrowRight, ExternalLink, Plus } from "lucide-react";
import { statusColors, formatStatus } from "@/lib/docket-utils";
import { DocketFormDialog } from "@/components/docket-form-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { Docket } from "@shared/schema";
import { format } from "date-fns";

const allStatuses = [
  "all",
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
];

export default function Dockets() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { user } = useAuth();

  const { data: docketsResponse, isLoading } = useQuery<{ data: Docket[]; total: number }>({
    queryKey: ["/api/dockets"],
  });

  const dockets = docketsResponse?.data;

  const filtered = (dockets || []).filter((d) => {
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.applicant.toLowerCase().includes(search.toLowerCase()) ||
      d.county.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Docket Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Monitor all Certificate of Need proceedings.
          </p>
        </div>
        {user?.role === "admin" && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Docket
          </Button>
        )}
      </div>

      <DocketFormDialog open={showCreateForm} onOpenChange={setShowCreateForm} />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by case, applicant, county..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-dockets"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {allStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : formatStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">No Dockets Found</h3>
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Try adjusting your search or filter."
              : "Dockets will appear here as they are tracked."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((docket) => (
            <Link key={docket.id} href={`/dockets/${docket.id}`}>
              <Card className="p-5 hover-elevate cursor-pointer" data-testid={`card-docket-${docket.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{docket.title}</h3>
                      <Badge className={statusColors[docket.status] || ""}>
                        {formatStatus(docket.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="font-mono text-xs">{docket.caseNumber}</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {docket.applicant}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {docket.county} County
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Filed {format(new Date(docket.filingDate), "MMM d, yyyy")}
                      </span>
                    </div>
                    {docket.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{docket.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {docket.facilityType && (
                        <span>{docket.facilityType}</span>
                      )}
                      {docket.estimatedCost && (
                        <span>Est. Cost: {docket.estimatedCost}</span>
                      )}
                      {docket.laserficheUrl && (
                        <a
                          href={docket.laserficheUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`link-laserfiche-${docket.id}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Laserfiche
                        </a>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

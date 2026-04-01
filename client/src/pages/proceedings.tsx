import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocation } from "wouter";
import {
  Search,
  Scale,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { statusColors, formatStatus, typeColors, typeLabels } from "@/lib/proceeding-utils";
import type { Proceeding } from "@shared/schema";
import { format } from "date-fns";

const allTypes = ["all", "con", "det", "det_eqt", "det_asc"] as const;

const allStatuses = [
  "all",
  "loi_filed",
  "loi_expired",
  "loi_batching",
  "application_filed",
  "under_review",
  "incomplete",
  "pending_decision",
  "approved",
  "denied",
  "withdrawn",
  "request_filed",
  "determination_issued",
  "appeal_filed",
  "appeal_hearing_pending",
  "appeal_decided",
  "closed",
] as const;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface ProceedingListResponse {
  proceedings: Proceeding[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function Proceedings() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter, countyFilter]);

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (typeFilter !== "all") queryParams.set("type", typeFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (countyFilter !== "all") queryParams.set("county", countyFilter);
  queryParams.set("page", String(page));
  queryParams.set("pageSize", "20");
  const queryString = queryParams.toString();

  const {
    data: response,
    isLoading,
    isPlaceholderData,
  } = useQuery<ProceedingListResponse>({
    queryKey: ["/api/proceedings", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/proceedings?${queryString}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  // Fetch counties for the county dropdown
  const { data: counties } = useQuery<string[]>({
    queryKey: ["/api/proceedings/counties"],
    queryFn: async () => {
      const res = await fetch("/api/proceedings/counties");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const proceedings = response?.proceedings ?? [];
  const total = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Proceedings</h1>
          <p className="text-muted-foreground text-sm">
            Monitor Certificate of Need and Determination proceedings across
            Georgia.
          </p>
        </div>
        {user?.role === "admin" && (
          <Button onClick={() => navigate("/proceedings/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New Proceeding
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by case, applicant, facility..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-proceedings"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {allTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All Types" : typeLabels[t] || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {allStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : formatStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countyFilter} onValueChange={setCountyFilter}>
          <SelectTrigger className="w-[170px]" data-testid="select-county-filter">
            <SelectValue placeholder="County" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Counties</SelectItem>
            {(counties ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active filter chips */}
      {(typeFilter !== "all" ||
        statusFilter !== "all" ||
        countyFilter !== "all") && (
        <div className="flex items-center gap-2 flex-wrap">
          {typeFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setTypeFilter("all")}
            >
              Type: {typeLabels[typeFilter] || typeFilter} &times;
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setStatusFilter("all")}
            >
              Status: {formatStatus(statusFilter)} &times;
            </Badge>
          )}
          {countyFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setCountyFilter("all")}
            >
              County: {countyFilter} &times;
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("all");
              setStatusFilter("all");
              setCountyFilter("all");
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Data Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : proceedings.length === 0 ? (
        <div className="text-center py-16">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">
            No Proceedings Found
          </h3>
          <p className="text-sm text-muted-foreground">
            {search ||
            typeFilter !== "all" ||
            statusFilter !== "all" ||
            countyFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Proceedings will appear here as they are tracked."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Case Number</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="w-[120px]">County</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[110px]">Filing Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proceedings.map((proc) => (
                  <TableRow
                    key={proc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/proceedings/${proc.id}`)}
                    data-testid={`row-proceeding-${proc.id}`}
                  >
                    <TableCell>
                      <span className="font-mono text-xs text-primary">
                        {proc.caseNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeColors[proc.proceedingType] || ""}>
                        {typeLabels[proc.proceedingType] || proc.proceedingType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {proc.title}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{proc.applicant}</TableCell>
                    <TableCell className="text-sm">{proc.county}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[proc.status] || ""}>
                        {formatStatus(proc.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(proc.filingDate), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? "proceeding" : "proceedings"} found
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isPlaceholderData}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm tabular-nums px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isPlaceholderData}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

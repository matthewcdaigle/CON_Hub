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
import { Search, FileSearch, ExternalLink, Tag, Calendar, BookOpen } from "lucide-react";
import type { ResearchDocument } from "@shared/schema";
import { format } from "date-fns";

const categories = [
  "all",
  "Statute",
  "Regulation",
  "Decision",
  "Advisory Opinion",
  "Staff Report",
  "Public Comment",
  "Appeal",
  "Template",
  "Guidance",
];

export default function Research() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: docsResponse, isLoading } = useQuery<{ data: ResearchDocument[]; total: number }>({
    queryKey: ["/api/research"],
  });

  const documents = docsResponse?.data;

  const filtered = (documents || []).filter((doc) => {
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description?.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold">Research Database</h1>
        <p className="text-muted-foreground text-sm">
          Search CON-related documents, decisions, and regulatory materials.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-research"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileSearch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">No Documents Found</h3>
          <p className="text-sm text-muted-foreground">
            {search || categoryFilter !== "all"
              ? "Try adjusting your search or filter."
              : "Research documents will appear here once they are added."}
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <Card key={doc.id} className="p-5 space-y-3 hover-elevate" data-testid={`card-research-${doc.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="p-2 bg-primary/10 rounded-md shrink-0">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {doc.category}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-medium text-sm leading-snug line-clamp-2">{doc.title}</h3>
                {doc.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{doc.description}</p>
                )}
              </div>
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  {doc.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {doc.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{doc.tags.length - 3}</span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(doc.createdAt), "MMM d, yyyy")}
                </span>
                <div className="flex items-center gap-1">
                  {doc.laserficheUrl && (
                    <a
                      href={doc.laserficheUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-doc-laserfiche-${doc.id}`}
                    >
                      <Button variant="ghost" size="sm" className="text-xs">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Laserfiche
                      </Button>
                    </a>
                  )}
                  {doc.sourceUrl && (
                    <a
                      href={doc.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-doc-source-${doc.id}`}
                    >
                      <Button variant="ghost" size="sm" className="text-xs">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Source
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

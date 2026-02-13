import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { FileText, Sparkles, Save, Loader2, Copy, Check, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DraftTemplate, SavedDraft, Docket } from "@shared/schema";

export default function Drafting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedDocket, setSelectedDocket] = useState<string>("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSavedDrafts, setShowSavedDrafts] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useQuery<DraftTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const { data: docketsResponse } = useQuery<{ data: Docket[]; total: number }>({
    queryKey: ["/api/dockets"],
  });

  const dockets = docketsResponse?.data;

  const { data: savedDrafts, isLoading: draftsLoading } = useQuery<SavedDraft[]>({
    queryKey: ["/api/drafts"],
    enabled: !!user,
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/drafts", {
        title: draftTitle || "Untitled Draft",
        content: draftContent,
        templateId: selectedTemplate ? parseInt(selectedTemplate) : null,
        docketId: selectedDocket ? parseInt(selectedDocket) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({ title: "Draft Saved", description: "Your draft has been saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates?.find((t) => t.id === parseInt(templateId));
    if (template) {
      setDraftContent(template.templateContent);
      setDraftTitle(template.name);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: aiPrompt,
          templateId: selectedTemplate ? parseInt(selectedTemplate) : null,
          docketId: selectedDocket ? parseInt(selectedDocket) : null,
          existingContent: draftContent,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let generatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              generatedContent += data.content;
              setDraftContent(generatedContent);
            }
          } catch {}
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate draft.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy Failed", description: "Unable to copy to clipboard. Try selecting the text manually.", variant: "destructive" });
    }
  };

  const loadSavedDraft = (draft: SavedDraft) => {
    setDraftTitle(draft.title);
    setDraftContent(draft.content);
    if (draft.templateId) setSelectedTemplate(String(draft.templateId));
    if (draft.docketId) setSelectedDocket(String(draft.docketId));
    setShowSavedDrafts(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Drafting Assistant</h1>
          <p className="text-muted-foreground text-sm">
            Draft filings and documents using AI-powered assistance and templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSavedDrafts(true)} data-testid="button-saved-drafts">
            <BookOpen className="w-4 h-4 mr-2" />
            Saved Drafts
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h2 className="font-serif font-semibold">Configuration</h2>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Template</label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : templates && templates.length > 0 ? (
                      templates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No templates available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Related Docket</label>
                <Select value={selectedDocket} onValueChange={setSelectedDocket}>
                  <SelectTrigger data-testid="select-docket">
                    <SelectValue placeholder="Link to a docket (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {dockets?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.caseNumber} - {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Draft Title</label>
                <Input
                  placeholder="Enter a title for your draft"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  data-testid="input-draft-title"
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-serif font-semibold">AI Assistant</h2>
            </div>
            <Separator />
            <Textarea
              placeholder="Describe what you need drafted... e.g., 'Draft a letter of intent for a 120-bed skilled nursing facility CON application in Fulton County'"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="min-h-[120px] text-sm"
              data-testid="input-ai-prompt"
            />
            <Button
              onClick={handleAiGenerate}
              disabled={isGenerating || !aiPrompt.trim()}
              className="w-full"
              data-testid="button-generate"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Draft
                </>
              )}
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif font-semibold">Document Editor</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!draftContent}
                  data-testid="button-copy-draft"
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-1" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={!draftContent || saveDraftMutation.isPending}
                  data-testid="button-save-draft"
                >
                  {saveDraftMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save Draft
                </Button>
              </div>
            </div>
            <Separator />
            <Textarea
              placeholder="Start writing or use the AI assistant to generate content..."
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm leading-relaxed"
              data-testid="textarea-draft-content"
            />
          </Card>
        </div>
      </div>

      <Dialog open={showSavedDrafts} onOpenChange={setShowSavedDrafts}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Saved Drafts</DialogTitle>
            <DialogDescription>Click a draft to load it in the editor.</DialogDescription>
          </DialogHeader>
          {draftsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !savedDrafts || savedDrafts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedDrafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="p-4 hover-elevate cursor-pointer"
                  onClick={() => loadSavedDraft(draft)}
                  data-testid={`card-saved-draft-${draft.id}`}
                >
                  <p className="font-medium text-sm">{draft.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {draft.content.substring(0, 150)}...
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(draft.createdAt).toLocaleDateString()}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

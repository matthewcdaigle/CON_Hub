import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Building2,
  MapPin,
  ExternalLink,
  Scale,
  Clock,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { statusColors, formatStatus } from "@/lib/docket-utils";
import type { Docket, DocketEvent, DocketSubscription } from "@shared/schema";
import { format } from "date-fns";

const eventTypeIcons: Record<string, string> = {
  filing: "Filed",
  hearing: "Hearing",
  decision: "Decision",
  amendment: "Amendment",
  public_comment: "Public Comment",
  staff_report: "Staff Report",
  continuance: "Continuance",
  default: "Event",
};

export default function DocketDetail() {
  const [, params] = useRoute("/dockets/:id");
  const docketId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: docket, isLoading } = useQuery<Docket>({
    queryKey: ["/api/dockets", docketId],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<DocketEvent[]>({
    queryKey: ["/api/dockets", docketId, "events"],
  });

  const { data: subscriptions } = useQuery<DocketSubscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !!user,
  });

  const isSubscribed = subscriptions?.some((s) => s.docketId === docketId);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (isSubscribed) {
        const sub = subscriptions?.find((s) => s.docketId === docketId);
        if (sub) {
          await apiRequest("DELETE", `/api/subscriptions/${sub.id}`);
        }
      } else {
        await apiRequest("POST", "/api/subscriptions", { docketId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: isSubscribed ? "Unsubscribed" : "Subscribed",
        description: isSubscribed
          ? "You will no longer receive alerts for this docket."
          : "You will receive alerts when this docket is updated.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </div>
    );
  }

  if (!docket) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-12 text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">Docket Not Found</h3>
          <p className="text-sm text-muted-foreground mb-4">This docket does not exist or has been removed.</p>
          <Link href="/dockets">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dockets
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dockets">
          <Button variant="ghost" size="icon" data-testid="button-back-dockets">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-xl font-bold" data-testid="text-docket-title">{docket.title}</h1>
            <Badge className={statusColors[docket.status] || ""}>
              {formatStatus(docket.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{docket.caseNumber}</p>
        </div>
        <Button
          variant={isSubscribed ? "secondary" : "default"}
          onClick={() => subscribeMutation.mutate()}
          disabled={subscribeMutation.isPending}
          data-testid="button-subscribe-docket"
        >
          {isSubscribed ? (
            <>
              <BellOff className="w-4 h-4 mr-2" />
              Unsubscribe
            </>
          ) : (
            <>
              <Bell className="w-4 h-4 mr-2" />
              Subscribe
            </>
          )}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif font-semibold text-lg">Case Details</h2>
            <Separator />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Applicant</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {docket.applicant}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Facility</p>
                <p className="text-sm font-medium">{docket.facilityName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Facility Type</p>
                <p className="text-sm font-medium">{docket.facilityType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">County</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {docket.county}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Filing Date</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {format(new Date(docket.filingDate), "MMMM d, yyyy")}
                </p>
              </div>
              {docket.hearingDate && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Hearing Date</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(new Date(docket.hearingDate), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {docket.decisionDate && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Decision Date</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(new Date(docket.decisionDate), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {docket.estimatedCost && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Cost</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    {docket.estimatedCost}
                  </p>
                </div>
              )}
            </div>
            {docket.description && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                  <p className="text-sm leading-relaxed">{docket.description}</p>
                </div>
              </>
            )}
            {docket.laserficheUrl && (
              <>
                <Separator />
                <a
                  href={docket.laserficheUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                  data-testid="link-laserfiche-detail"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Laserfiche
                  </Button>
                </a>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-serif font-semibold text-lg mb-4">Timeline</h2>
            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !events || events.length === 0 ? (
              <div className="text-center py-4">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event, i) => (
                  <div key={event.id} className="flex gap-3" data-testid={`event-${event.id}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {eventTypeIcons[event.eventType] || event.eventType} &middot;{" "}
                        {format(new Date(event.eventDate), "MMM d, yyyy")}
                      </p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

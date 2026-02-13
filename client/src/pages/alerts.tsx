import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BellOff, Check, CheckCheck, Scale, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Notification, DocketSubscription, Docket } from "@shared/schema";
import { format } from "date-fns";

export default function Alerts() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: notificationsResponse, isLoading: notifsLoading } = useQuery<{ data: Notification[]; total: number }>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const notifications = notificationsResponse?.data;

  const { data: subscriptions, isLoading: subsLoading } = useQuery<DocketSubscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !!user,
  });

  const { data: docketsResponse } = useQuery<{ data: Docket[]; total: number }>({
    queryKey: ["/api/dockets"],
  });

  const dockets = docketsResponse?.data;

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}`, { read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "All Read", description: "All notifications marked as read." });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subscriptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Unsubscribed", description: "You will no longer receive alerts for this docket." });
    },
  });

  const unreadNotifs = notifications?.filter((n) => !n.read) || [];
  const readNotifs = notifications?.filter((n) => n.read) || [];

  const getDocketForSub = (sub: DocketSubscription) =>
    dockets?.find((d) => d.id === sub.docketId);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Alerts & Subscriptions</h1>
          <p className="text-muted-foreground text-sm">
            Manage your docket subscriptions and notification preferences.
          </p>
        </div>
        {unreadNotifs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <Tabs defaultValue="notifications">
        <TabsList data-testid="tabs-alerts">
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            Notifications
            {unreadNotifs.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {unreadNotifs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
            Subscriptions
            {subscriptions && subscriptions.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {subscriptions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          {notifsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </Card>
              ))}
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <Card className="p-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-serif text-lg font-semibold mb-1">No Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Subscribe to dockets to receive alerts when they are updated.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {unreadNotifs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Unread</h3>
                  {unreadNotifs.map((notif) => (
                    <Card key={notif.id} className="p-4" data-testid={`card-notif-unread-${notif.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-medium">{notif.title}</p>
                            <p className="text-xs text-muted-foreground">{notif.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(notif.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {notif.docketId && (
                            <Link href={`/dockets/${notif.docketId}`}>
                              <Button variant="ghost" size="icon" data-testid={`button-view-docket-${notif.id}`}>
                                <Scale className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markReadMutation.mutate(notif.id)}
                            disabled={markReadMutation.isPending}
                            data-testid={`button-mark-read-${notif.id}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {readNotifs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Read</h3>
                  {readNotifs.map((notif) => (
                    <Card key={notif.id} className="p-4 opacity-70" data-testid={`card-notif-read-${notif.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notif.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        {notif.docketId && (
                          <Link href={`/dockets/${notif.docketId}`}>
                            <Button variant="ghost" size="icon">
                              <Scale className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4 mt-4">
          {subsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </Card>
              ))}
            </div>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <Card className="p-12 text-center">
              <BellOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-serif text-lg font-semibold mb-1">No Subscriptions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Subscribe to dockets from the docket detail page to receive alerts.
              </p>
              <Link href="/dockets">
                <Button variant="outline" data-testid="button-browse-dockets">
                  <Scale className="w-4 h-4 mr-2" />
                  Browse Dockets
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => {
                const docket = getDocketForSub(sub);
                return (
                  <Card key={sub.id} className="p-4" data-testid={`card-subscription-${sub.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Bell className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {docket?.title || `Docket #${sub.docketId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {docket?.caseNumber || ""} &middot; Subscribed {format(new Date(sub.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {docket && (
                          <Link href={`/dockets/${docket.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-sub-docket-${sub.id}`}>
                              View
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => unsubscribeMutation.mutate(sub.id)}
                          disabled={unsubscribeMutation.isPending}
                          data-testid={`button-unsubscribe-${sub.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

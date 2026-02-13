import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Scale, FileSearch, FileText, Bell, ArrowRight, Calendar, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { statusColors, formatStatus } from "@/lib/docket-utils";
import type { Docket, Notification, ResearchDocument } from "@shared/schema";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: docketsResponse, isLoading: docketsLoading } = useQuery<{ data: Docket[]; total: number }>({
    queryKey: ["/api/dockets"],
  });

  const { data: notificationsResponse, isLoading: notifLoading } = useQuery<{ data: Notification[]; total: number }>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const { data: docsResponse, isLoading: docsLoading } = useQuery<{ data: ResearchDocument[]; total: number }>({
    queryKey: ["/api/research"],
  });

  const dockets = docketsResponse?.data;
  const notifications = notificationsResponse?.data;
  const documents = docsResponse?.data;

  const recentDockets = dockets?.slice(0, 5) || [];
  const unreadNotifications = notifications?.filter((n) => !n.read) || [];
  const recentDocs = documents?.slice(0, 3) || [];
  const activeDockets = dockets?.filter((d) =>
    !["approved", "denied", "withdrawn"].includes(d.status)
  ) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold" data-testid="text-welcome">
          Welcome back, {user?.firstName || "Counselor"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here's what's happening with your CON proceedings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Dockets",
            value: docketsLoading ? null : activeDockets.length,
            icon: Scale,
            href: "/dockets",
          },
          {
            label: "Research Documents",
            value: docsLoading ? null : (docsResponse?.total || 0),
            icon: FileSearch,
            href: "/research",
          },
          {
            label: "Unread Alerts",
            value: notifLoading ? null : unreadNotifications.length,
            icon: Bell,
            href: "/alerts",
          },
          {
            label: "Hearings Soon",
            value: docketsLoading
              ? null
              : dockets?.filter((d) => d.status === "hearing_scheduled").length || 0,
            icon: Calendar,
            href: "/dockets",
          },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="p-4 hover-elevate cursor-pointer">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  {stat.value !== null ? (
                    <p className="text-2xl font-bold font-serif" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                      {stat.value}
                    </p>
                  ) : (
                    <Skeleton className="h-8 w-12" />
                  )}
                </div>
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-lg font-semibold">Recent Dockets</h2>
            <Link href="/dockets">
              <Button variant="ghost" size="sm" data-testid="button-view-all-dockets">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          {docketsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : recentDockets.length === 0 ? (
            <Card className="p-8 text-center">
              <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No dockets to display yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentDockets.map((docket) => (
                <Link key={docket.id} href={`/dockets/${docket.id}`}>
                  <Card className="p-4 hover-elevate cursor-pointer" data-testid={`card-docket-${docket.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{docket.title}</p>
                          <Badge className={statusColors[docket.status] || ""}>
                            {formatStatus(docket.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{docket.caseNumber}</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {docket.applicant}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(docket.filingDate), "MMM d, yyyy")}
                          </span>
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

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-lg font-semibold">Recent Alerts</h2>
            <Link href="/alerts">
              <Button variant="ghost" size="sm" data-testid="button-view-all-alerts">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          {notifLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </Card>
              ))}
            </div>
          ) : unreadNotifications.length === 0 ? (
            <Card className="p-6 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No unread alerts.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {unreadNotifications.slice(0, 4).map((notif) => (
                <Card key={notif.id} className="p-4 border-l-2 border-l-primary" data-testid={`card-notification-${notif.id}`}>
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                  </p>
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <h2 className="font-serif text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            <Link href="/drafting">
              <Card className="p-3 hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">New Draft</span>
                </div>
              </Card>
            </Link>
            <Link href="/research">
              <Card className="p-3 hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Search Research</span>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

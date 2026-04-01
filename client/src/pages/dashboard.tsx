import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  Scale,
  Bell,
  ArrowRight,
  Calendar,
  Building2,
  Timer,
  Activity,
  BookmarkCheck,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { statusColors, formatStatus, typeColors, typeLabels } from "@/lib/proceeding-utils";
import type { Proceeding, Notification, Deadline, Subscription, ProceedingEvent } from "@shared/schema";
import { format, differenceInDays, isPast } from "date-fns";

interface StatsResponse {
  totalProceedings: number;
  activeProceedings: number;
  upcomingDeadlines: number;
  unreadNotifications: number;
}

interface DeadlineWithProceeding extends Deadline {
  proceeding?: Proceeding;
}

export default function Dashboard() {
  const { user } = useAuth();

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  // Upcoming deadlines
  const { data: deadlinesData, isLoading: deadlinesLoading } = useQuery<DeadlineWithProceeding[]>({
    queryKey: ["/api/deadlines"],
    queryFn: async () => {
      const res = await fetch("/api/deadlines?limit=5&upcoming=true");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  // Recent notifications / activity
  const { data: notificationsData, isLoading: notifLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=5");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();
      // Handle both array and { data: [...] } response formats
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: !!user,
  });

  // User subscriptions
  const { data: subscriptions, isLoading: subsLoading } = useQuery<(Subscription & { proceeding?: Proceeding })[]>({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!user,
  });

  const deadlines = deadlinesData ?? [];
  const notifications = notificationsData ?? [];
  const proceedingSubs = (subscriptions ?? []).filter(
    (s) => s.subscriptionType === "proceeding" && s.proceedingId
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold" data-testid="text-welcome">
          Welcome back, {user?.firstName || "Counselor"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here is your overview of Georgia CON proceedings activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Proceedings",
            value: statsLoading ? null : (stats?.totalProceedings ?? 0),
            icon: Scale,
            href: "/proceedings",
          },
          {
            label: "Active Proceedings",
            value: statsLoading ? null : (stats?.activeProceedings ?? 0),
            icon: Activity,
            href: "/proceedings",
          },
          {
            label: "Upcoming Deadlines",
            value: statsLoading ? null : (stats?.upcomingDeadlines ?? 0),
            icon: Timer,
            href: "/proceedings",
          },
          {
            label: "Unread Notifications",
            value: statsLoading ? null : (stats?.unreadNotifications ?? 0),
            icon: Bell,
            href: "/alerts",
          },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="p-4 hover-elevate cursor-pointer">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  {stat.value !== null ? (
                    <p
                      className="text-2xl font-bold font-serif"
                      data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
                    >
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

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: Deadlines + Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Deadlines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-lg font-semibold">
                Upcoming Deadlines
              </h2>
              <Link href="/proceedings">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            {deadlinesLoading ? (
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
            ) : deadlines.length === 0 ? (
              <Card className="p-8 text-center">
                <Timer className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No upcoming deadlines.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {deadlines.slice(0, 5).map((deadline) => {
                  const dueDate = new Date(deadline.dueDate);
                  const daysLeft = differenceInDays(dueDate, new Date());
                  const overdue = isPast(dueDate) && !deadline.isCompleted;

                  return (
                    <Card
                      key={deadline.id}
                      className={`p-4 ${
                        overdue
                          ? "border-l-4 border-l-red-500"
                          : daysLeft <= 3
                          ? "border-l-4 border-l-yellow-500"
                          : "border-l-4 border-l-primary"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium">{deadline.title}</p>
                          {deadline.proceeding && (
                            <Link href={`/proceedings/${deadline.proceedingId}`}>
                              <span className="text-xs text-primary hover:underline flex items-center gap-1">
                                {deadline.proceeding.title}
                                {deadline.proceeding.proceedingType && (
                                  <Badge
                                    className={`text-[10px] px-1 py-0 ml-1 ${
                                      typeColors[deadline.proceeding.proceedingType] || ""
                                    }`}
                                  >
                                    {typeLabels[deadline.proceeding.proceedingType] ||
                                      deadline.proceeding.proceedingType}
                                  </Badge>
                                )}
                              </span>
                            </Link>
                          )}
                          {deadline.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {deadline.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">
                            {format(dueDate, "MMM d, yyyy")}
                          </p>
                          {overdue ? (
                            <p className="text-xs text-red-600 flex items-center gap-1 justify-end">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </p>
                          ) : (
                            <p
                              className={`text-xs ${
                                daysLeft <= 3
                                  ? "text-yellow-600"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {daysLeft === 0
                                ? "Due today"
                                : daysLeft === 1
                                ? "Due tomorrow"
                                : `${daysLeft} days`}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-lg font-semibold">
                Recent Activity
              </h2>
              <Link href="/alerts">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            {notifLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                  </Card>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <Card className="p-8 text-center">
                <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No recent activity to display.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <Card
                    key={notif.id}
                    className={`p-4 ${!notif.read ? "border-l-2 border-l-primary" : ""}`}
                    data-testid={`card-notification-${notif.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm font-medium">{notif.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notif.message}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                        </p>
                        {notif.proceedingId && (
                          <Link href={`/proceedings/${notif.proceedingId}`}>
                            <span className="text-xs text-primary hover:underline">
                              View
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Subscriptions + Quick Actions */}
        <div className="space-y-6">
          {/* Your Subscriptions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-lg font-semibold">
                Your Subscriptions
              </h2>
            </div>
            {subsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                  </Card>
                ))}
              </div>
            ) : proceedingSubs.length === 0 ? (
              <Card className="p-6 text-center">
                <BookmarkCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No active subscriptions.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subscribe to proceedings to receive alerts.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {proceedingSubs.slice(0, 8).map((sub) => (
                  <Link key={sub.id} href={`/proceedings/${sub.proceedingId}`}>
                    <Card className="p-3 hover-elevate cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          {sub.proceeding ? (
                            <>
                              <p className="text-sm font-medium truncate">
                                {sub.proceeding.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {sub.proceeding.caseNumber}
                                </span>
                                <Badge
                                  className={`text-[10px] px-1 py-0 ${
                                    typeColors[sub.proceeding.proceedingType] || ""
                                  }`}
                                >
                                  {typeLabels[sub.proceeding.proceedingType] ||
                                    sub.proceeding.proceedingType}
                                </Badge>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Proceeding #{sub.proceedingId}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="font-serif text-lg font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/proceedings">
                <Card className="p-3 hover-elevate cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Scale className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      Browse Proceedings
                    </span>
                  </div>
                </Card>
              </Link>
              <Link href="/research">
                <Card className="p-3 hover-elevate cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      Search Research
                    </span>
                  </div>
                </Card>
              </Link>
              <Link href="/drafting">
                <Card className="p-3 hover-elevate cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      Draft New Filing
                    </span>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

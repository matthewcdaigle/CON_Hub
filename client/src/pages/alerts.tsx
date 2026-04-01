import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Check,
  CheckCheck,
  RefreshCw,
  FileText,
  Clock,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";

type NotificationType =
  | "status_change"
  | "new_document"
  | "deadline_approaching"
  | "new_filing_nearby"
  | "custom";

const notificationTypeIcons: Record<NotificationType, React.ElementType> = {
  status_change: RefreshCw,
  new_document: FileText,
  deadline_approaching: Clock,
  new_filing_nearby: MapPin,
  custom: Bell,
};

function getNotificationIcon(type: string) {
  const Icon = notificationTypeIcons[type as NotificationType] || Bell;
  return Icon;
}

export default function Alerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

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

  const allNotifs = notifications || [];
  const unreadCount = allNotifs.filter((n) => !n.read).length;
  const displayedNotifs =
    filter === "unread" ? allNotifs.filter((n) => !n.read) : allNotifs;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Notification Center</h1>
          <p className="text-muted-foreground text-sm">
            Stay updated on CON proceedings, deadlines, and nearby filings.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Notifications</SelectItem>
            <SelectItem value="unread">
              Unread Only{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : displayedNotifs.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">
            {filter === "unread" ? "No Unread Notifications" : "No Notifications"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filter === "unread"
              ? "You're all caught up!"
              : "Notifications will appear here when proceedings are updated."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedNotifs.map((notif) => {
            const Icon = getNotificationIcon(notif.notificationType);
            const isUnread = !notif.read;

            return (
              <Card
                key={notif.id}
                className={`p-4 transition-colors ${
                  isUnread
                    ? "border-primary/30 bg-primary/5"
                    : "opacity-75"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div
                    className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${
                      isUnread
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <div className="flex items-center gap-2 pt-1">
                      {notif.proceedingId && (
                        <Link href={`/dockets/${notif.proceedingId}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            View Proceeding
                          </Button>
                        </Link>
                      )}
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => markReadMutation.mutate(notif.id)}
                          disabled={markReadMutation.isPending}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Mark as Read
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {isUnread && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

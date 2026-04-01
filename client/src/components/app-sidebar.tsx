import { useLocation, Link } from "wouter";
import {
  Scale,
  LayoutDashboard,
  FileSearch,
  FileText,
  Bell,
  LogOut,
  BookOpen,
  Building2,
  Calendar,
  Map,
  Settings,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Proceedings", url: "/proceedings", icon: Scale },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Deadlines", url: "/deadlines", icon: Calendar },
  { title: "Map", url: "/map", icon: Map },
];

const toolsNav = [
  { title: "Case Briefs", url: "/case-briefs", icon: BookOpen },
  { title: "Research", url: "/research", icon: FileSearch },
  { title: "Drafting", url: "/drafting", icon: FileText },
  { title: "Alerts", url: "/alerts", icon: Bell },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: notifications } = useQuery<{ data: any[] }>({
    queryKey: ["/api/notifications", { unreadOnly: true }],
    queryFn: () =>
      fetch("/api/notifications?unreadOnly=true&limit=100").then((r) =>
        r.json()
      ),
    enabled: !!user,
  });

  const unreadCount = notifications?.data?.length || 0;
  const isAdmin = (user as any)?.role === "admin";
  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() || "U"
    : "U";

  function isActive(url: string) {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary rounded-md">
            <Scale className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-serif font-bold text-sm leading-none">
              CON Hub
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Georgia CON Monitor
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitor</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={isActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={isActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {item.title === "Alerts" && unreadCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto text-xs"
                        >
                          {unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={isActive("/admin")}
                  >
                    <Link href="/admin">
                      <Shield className="w-4 h-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={isActive("/settings")}
                  >
                    <Link href="/settings">
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
          <a href="/api/auth/logout">
            <Button size="icon" variant="ghost">
              <LogOut className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

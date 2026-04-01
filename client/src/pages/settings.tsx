import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { User, Users, Bell, Mail, Plus, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Team } from "@shared/schema";

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");

  const { data: team, isLoading: teamLoading } = useQuery<Team | null>({
    queryKey: ["/api/teams/current"],
    enabled: !!user?.teamId,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/teams", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setCreateTeamOpen(false);
      setTeamName("");
      toast({ title: "Team Created", description: "Your team has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      createTeamMutation.mutate(teamName.trim());
    }
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, team, and notification preferences.
        </p>
      </div>

      {/* User Profile */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Profile</h2>
            <p className="text-sm text-muted-foreground">Your account information</p>
          </div>
        </div>
        <Separator className="mb-4" />
        <div className="grid gap-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right text-muted-foreground">Display Name</Label>
            <div className="col-span-2">
              <p className="text-sm font-medium">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "Unknown"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right text-muted-foreground">Email</Label>
            <div className="col-span-2">
              <p className="text-sm">{user?.email || "Not set"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right text-muted-foreground">Role</Label>
            <div className="col-span-2">
              <Badge variant="secondary" className="capitalize">
                <Shield className="w-3 h-3 mr-1" />
                {user?.role || "attorney"}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Team */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Team</h2>
            <p className="text-sm text-muted-foreground">Your team membership</p>
          </div>
        </div>
        <Separator className="mb-4" />

        {user?.teamId ? (
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right text-muted-foreground">Team Name</Label>
            <div className="col-span-2">
              {teamLoading ? (
                <Skeleton className="h-5 w-32" />
              ) : (
                <p className="text-sm font-medium">{team?.name || `Team #${user.teamId}`}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              You are not currently a member of any team. Create one to start collaborating.
            </p>
            <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a Team</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Team Name</Label>
                    <Input
                      id="team-name"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Smith & Associates"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateTeamOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTeamMutation.isPending}>
                      {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </Card>

      {/* Notification Preferences */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Notification Preferences</h2>
            <p className="text-sm text-muted-foreground">Control how you receive alerts</p>
          </div>
        </div>
        <Separator className="mb-4" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Receive email notifications for subscribed proceedings and deadlines
                </p>
              </div>
            </div>
            <Switch
              checked={emailAlerts}
              onCheckedChange={setEmailAlerts}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

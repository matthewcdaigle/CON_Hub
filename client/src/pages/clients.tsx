import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { Plus, Building2, MapPin, Radar, ArrowRight, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

export default function Clients() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    facilityType: "",
    address: "",
    county: "",
    monitoringRadiusMiles: 25,
  });

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDialogOpen(false);
      setForm({ name: "", facilityType: "", address: "", county: "", monitoringRadiusMiles: 25 });
      toast({ title: "Client Created", description: "New client facility has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold">Client Facilities</h1>
          <p className="text-muted-foreground text-sm">
            Manage client facilities and their competitive monitoring zones.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Client Facility</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Facility Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Piedmont Atlanta Hospital"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityType">Facility Type</Label>
                <Input
                  id="facilityType"
                  value={form.facilityType}
                  onChange={(e) => setForm({ ...form, facilityType: e.target.value })}
                  placeholder="e.g. Hospital, ASC, Nursing Home"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Full street address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="county">County</Label>
                <Input
                  id="county"
                  value={form.county}
                  onChange={(e) => setForm({ ...form, county: e.target.value })}
                  placeholder="e.g. Fulton"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Monitoring Radius (miles)</Label>
                <Input
                  id="radius"
                  type="number"
                  min={1}
                  max={200}
                  value={form.monitoringRadiusMiles}
                  onChange={(e) => setForm({ ...form, monitoringRadiusMiles: Number(e.target.value) })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Add Client"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-serif text-lg font-semibold mb-1">No Clients Yet</h3>
          <p className="text-sm text-muted-foreground">
            Add client facilities to monitor nearby CON activity.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="p-5 hover-elevate cursor-pointer h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-3 min-w-0 flex-1">
                    <div>
                      <h3 className="font-medium truncate">{client.name}</h3>
                      {client.facilityType && (
                        <Badge variant="secondary" className="mt-1">
                          <Building2 className="w-3 h-3 mr-1" />
                          {client.facilityType}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {client.county && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{client.county} County</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Radar className="w-3.5 h-3.5 shrink-0" />
                        <span>{client.monitoringRadiusMiles} mile radius</span>
                      </div>
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
  );
}

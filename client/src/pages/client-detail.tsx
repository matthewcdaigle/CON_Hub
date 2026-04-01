import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Radar,
  Pencil,
  Trash2,
  Scale,
  Navigation,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Client, Proceeding } from "@shared/schema";

interface NearbyActivity {
  proceeding: Proceeding;
  distanceMiles: number;
}

interface ClientWithProceedings extends Client {
  clientProceedings?: Array<{
    id: number;
    relationship: string;
    proceeding: Proceeding;
  }>;
}

export default function ClientDetail() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:id");
  const clientId = params?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    facilityType: "",
    address: "",
    county: "",
    monitoringRadiusMiles: 25,
  });

  const { data: client, isLoading } = useQuery<ClientWithProceedings>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: nearbyActivity, isLoading: nearbyLoading } = useQuery<NearbyActivity[]>({
    queryKey: ["/api/clients", clientId, "nearby-activity"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/nearby-activity`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!clientId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await apiRequest("PATCH", `/api/clients/${clientId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditOpen(false);
      toast({ title: "Updated", description: "Client facility has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Deleted", description: "Client facility has been removed." });
      navigate("/clients");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = () => {
    if (client) {
      setEditForm({
        name: client.name,
        facilityType: client.facilityType || "",
        address: client.address || "",
        county: client.county || "",
        monitoringRadiusMiles: client.monitoringRadiusMiles,
      });
      setEditOpen(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center">
        <h2 className="text-lg font-semibold">Client not found</h2>
        <Link href="/clients">
          <Button variant="ghost">Back to Clients</Button>
        </Link>
      </div>
    );
  }

  const linkedProceedings = client.clientProceedings || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <Link href="/clients">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Clients
        </Button>
      </Link>

      {/* Client header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold">{client.name}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {client.facilityType && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {client.facilityType}
              </span>
            )}
            {client.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {client.address}
              </span>
            )}
            {client.county && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {client.county} County
              </span>
            )}
            <span className="flex items-center gap-1">
              <Radar className="w-3.5 h-3.5" />
              {client.monitoringRadiusMiles} mile monitoring radius
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove {client.name} and all associated monitoring data.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Separator />

      {/* Nearby Activity */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          Nearby Activity
        </h2>
        <p className="text-sm text-muted-foreground">
          Proceedings within {client.monitoringRadiusMiles} miles of this facility.
        </p>

        {nearbyLoading ? (
          <Card className="p-4">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        ) : !nearbyActivity || nearbyActivity.length === 0 ? (
          <Card className="p-8 text-center">
            <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No nearby CON activity found within {client.monitoringRadiusMiles} miles.
            </p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearbyActivity.map((item) => (
                  <TableRow key={item.proceeding.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/dockets/${item.proceeding.id}`}>
                        <span className="text-primary hover:underline cursor-pointer">
                          {item.proceeding.caseNumber}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.proceeding.title}</TableCell>
                    <TableCell>{item.proceeding.applicant}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.proceeding.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{item.proceeding.county}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.distanceMiles.toFixed(1)} mi
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Linked Proceedings */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Linked Proceedings
        </h2>
        <p className="text-sm text-muted-foreground">
          Proceedings this client is directly involved in.
        </p>

        {linkedProceedings.length === 0 ? (
          <Card className="p-8 text-center">
            <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No linked proceedings. Link proceedings from the docket detail page.
            </p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedProceedings.map((cp) => (
                  <TableRow key={cp.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/dockets/${cp.proceeding.id}`}>
                        <span className="text-primary hover:underline cursor-pointer">
                          {cp.proceeding.caseNumber}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{cp.proceeding.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{cp.relationship.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{cp.proceeding.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(cp.proceeding.filingDate), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client Facility</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Facility Name</Label>
              <Input
                id="edit-name"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-facilityType">Facility Type</Label>
              <Input
                id="edit-facilityType"
                value={editForm.facilityType}
                onChange={(e) => setEditForm({ ...editForm, facilityType: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-county">County</Label>
              <Input
                id="edit-county"
                value={editForm.county}
                onChange={(e) => setEditForm({ ...editForm, county: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-radius">Monitoring Radius (miles)</Label>
              <Input
                id="edit-radius"
                type="number"
                min={1}
                max={200}
                value={editForm.monitoringRadiusMiles}
                onChange={(e) => setEditForm({ ...editForm, monitoringRadiusMiles: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

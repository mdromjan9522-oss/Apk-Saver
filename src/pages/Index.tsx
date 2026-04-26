import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu, Plus, Sun, Moon, LogOut, Package, Download, Pencil, Trash2, Loader2, FileArchive } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Footer } from "@/components/Footer";
import { ApkUploadDialog } from "@/components/ApkUploadDialog";
import { downloadApkAsZip } from "@/lib/zipDownload";
import { toast } from "sonner";

export interface ApkRecord {
  id: string;
  name: string;
  apkUrl: string;
  imageUrl: string;
  apkPath: string;
  imagePath: string;
  size: number;
  createdAt: number;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const Index = () => {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const [apks, setApks] = useState<ApkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<ApkRecord | null>(null);
  const [deleting, setDeleting] = useState<ApkRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingNow, setDeletingNow] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "apks"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setApks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApkRecord, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("Snapshot error:", err);
        toast.error("Failed to load APKs. Check Firestore rules.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleDownload = async (apk: ApkRecord) => {
    setDownloadingId(apk.id);
    try {
      await downloadApkAsZip(apk);
      toast.success(`Downloaded ${apk.name}.zip`);
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingNow(true);
    try {
      await supabase.storage.from("apks").remove(
        [deleting.apkPath, deleting.imagePath].filter(Boolean)
      ).catch(() => {});
      await deleteDoc(doc(db, "apks", deleting.id));
      toast.success("APK deleted");
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeletingNow(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                      <Package className="w-4 h-4 text-primary-foreground" />
                    </div>
                    APK Saver
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-8 space-y-2">
                  <button
                    onClick={() => { toggle(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    <span className="font-medium">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setUploadOpen(true); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-medium">Add APK</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-elegant">
                <Package className="w-5 h-5 text-primary-foreground" strokeWidth={2.2} />
              </div>
              <h1 className="font-bold text-lg tracking-tight">APK Saver</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Logout" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : apks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
              <FileArchive className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No APKs yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">Add your first APK file with an image to get started.</p>
            <Button onClick={() => setUploadOpen(true)} className="gradient-primary text-primary-foreground hover:opacity-90" size="lg">
              <Plus className="w-4 h-4 mr-2" /> Add your first APK
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {apks.map((apk) => (
              <article
                key={apk.id}
                className="group rounded-2xl bg-card border border-border/60 shadow-card-soft overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elegant animate-fade-in-up"
              >
                <div className="aspect-video w-full overflow-hidden bg-secondary">
                  <img
                    src={apk.imageUrl}
                    alt={apk.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold truncate" title={apk.name}>{apk.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(apk.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(apk)}
                      disabled={downloadingId === apk.id}
                      className="flex-1 gradient-primary text-primary-foreground hover:opacity-90"
                    >
                      {downloadingId === apk.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Download className="w-4 h-4 mr-1" /> ZIP</>
                      )}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(apk)} aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(apk)} aria-label="Delete" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <Footer />

      <ApkUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} mode="create" />
      {editing && (
        <ApkUploadDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          mode="edit"
          existing={editing}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this APK?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleting?.name}" and its image. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingNow}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deletingNow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileUp, Image as ImageIcon, Package } from "lucide-react";
import { toast } from "sonner";
import type { ApkRecord } from "@/pages/Index";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  existing?: ApkRecord;
}

const uuid = () => crypto.randomUUID();
const BUCKET = "apks";

const uploadToCloud = async (file: File, path: string): Promise<string> => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const deleteFromCloud = async (path: string) => {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
};

export const ApkUploadDialog = ({ open, onOpenChange, mode, existing }: Props) => {
  const [name, setName] = useState(existing?.name || "");
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(existing?.name || "");
    setApkFile(null);
    setImageFile(null);
    setProgress(0);
  };

  const handleClose = (o: boolean) => {
    if (!o && !busy) reset();
    onOpenChange(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return toast.error("Please enter a name.");
    if (mode === "create" && (!apkFile || !imageFile)) {
      return toast.error("Please choose both an APK and an image.");
    }
    setBusy(true);
    setProgress(10);
    try {
      if (mode === "create") {
        const id = uuid();
        const apkPath = `apks/${id}.apk`;
        const imgExt = imageFile!.name.split(".").pop() || "png";
        const imagePath = `images/${id}.${imgExt}`;

        setProgress(20);
        // Upload APK + image in parallel for max speed
        const [apkUrl, imageUrl] = await Promise.all([
          uploadToCloud(apkFile!, apkPath),
          uploadToCloud(imageFile!, imagePath),
        ]);
        setProgress(85);

        await addDoc(collection(db, "apks"), {
          name: trimmedName,
          apkUrl,
          imageUrl,
          apkPath,
          imagePath,
          size: apkFile!.size,
          createdAt: Date.now(),
        });
        setProgress(100);
        toast.success("APK added!");
      } else if (existing) {
        const updates: Partial<ApkRecord> = { name: trimmedName };
        const tasks: Promise<void>[] = [];

        if (apkFile) {
          tasks.push((async () => {
            await deleteFromCloud(existing.apkPath);
            const newPath = `apks/${uuid()}.apk`;
            const url = await uploadToCloud(apkFile, newPath);
            updates.apkUrl = url;
            updates.apkPath = newPath;
            updates.size = apkFile.size;
          })());
        }
        if (imageFile) {
          tasks.push((async () => {
            await deleteFromCloud(existing.imagePath);
            const ext = imageFile.name.split(".").pop() || "png";
            const newPath = `images/${uuid()}.${ext}`;
            const url = await uploadToCloud(imageFile, newPath);
            updates.imageUrl = url;
            updates.imagePath = newPath;
          })());
        }

        setProgress(30);
        await Promise.all(tasks);
        setProgress(85);
        await updateDoc(doc(db, "apks", existing.id), updates as any);
        setProgress(100);
        toast.success("APK updated!");
      }
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {mode === "create" ? "Add APK" : "Edit APK"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Upload an APK file with a cover image." : "Update name or replace files."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apkname">APK Name</Label>
            <Input
              id="apkname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apkfile" className="flex items-center gap-2">
              <FileUp className="w-4 h-4" /> APK File {mode === "edit" && "(optional — replace)"}
            </Label>
            <Input
              id="apkfile"
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(e) => setApkFile(e.target.files?.[0] || null)}
              required={mode === "create"}
            />
            {apkFile && <p className="text-xs text-muted-foreground truncate">{apkFile.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imgfile" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Image {mode === "edit" && "(optional — replace)"}
            </Label>
            <Input
              id="imgfile"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              required={mode === "create"}
            />
            {imageFile && <p className="text-xs text-muted-foreground truncate">{imageFile.name}</p>}
          </div>

          {busy && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">Uploading… {Math.round(progress)}%</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground hover:opacity-90">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "create" ? "Upload" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

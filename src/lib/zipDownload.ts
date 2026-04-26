import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ApkRecord } from "@/pages/Index";

const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_").trim() || "apk";

const fetchBlob = async (url: string): Promise<Blob> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.blob();
};

const guessImageExt = (url: string, contentType?: string): string => {
  if (contentType) {
    const map: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    if (map[contentType]) return map[contentType];
  }
  const m = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "png";
};

export async function downloadApkAsZip(apk: ApkRecord) {
  const safe = sanitize(apk.name);
  const [apkBlob, imgBlob] = await Promise.all([
    fetchBlob(apk.apkUrl),
    fetchBlob(apk.imageUrl),
  ]);
  const imgExt = guessImageExt(apk.imageUrl, imgBlob.type);
  const zip = new JSZip();
  zip.file(`${safe}.apk`, apkBlob);
  zip.file(`${safe}.${imgExt}`, imgBlob);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  saveAs(blob, `${safe}.zip`);
}

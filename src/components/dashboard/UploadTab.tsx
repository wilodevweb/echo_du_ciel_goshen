import React, { useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function UploadTab() {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState<"image" | "video" | "pdf">("pdf");
  const [aspectRatio, setAspectRatio] = useState<"square" | "wide" | "tall">("square");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Veuillez sélectionner un fichier.");
      return;
    }
    if (!uploadTitle) {
      setUploadError("Veuillez donner un titre à la ressource.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    formData.append("type", uploadType);
    formData.append("aspectRatio", aspectRatio);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Erreur lors du téléversement.");
      } else {
        setUploadSuccess(`Fichier "${uploadTitle}" téléversé avec succès !`);
        setUploadFile(null);
        setUploadTitle("");
        const fileInput = document.getElementById("file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch {
      setUploadError("Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-fiverr" />
        Téléverser une ressource
      </h2>
      <Card className="bg-gray-950 border-gray-800 shadow-xl">
        <CardContent className="pt-6 space-y-5">
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5">Sélectionner un fichier</label>
              <input
                id="file-input"
                type="file"
                required
                accept=".jpg,.jpeg,.png,.mp4,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    setUploadFile(file);
                    if (file.type.startsWith("image/")) {
                      setUploadType("image");
                    } else if (file.type.startsWith("video/")) {
                      setUploadType("video");
                    } else if (file.type === "application/pdf") {
                      setUploadType("pdf");
                    }
                    if (!uploadTitle) {
                      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                      setUploadTitle(nameWithoutExt);
                    }
                  }
                }}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700 cursor-pointer border border-gray-800 rounded-xl bg-gray-900 p-1 focus:outline-none"
              />
              <p className="text-[10px] text-gray-500 mt-1">Formats acceptés : PDF, MP4 (vidéos), PNG/JPG (images).</p>
            </div>

            <Input
              label="Titre de la ressource"
              required
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Ex: Leçon 5 - L'Arche de Noé"
              className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-fiverr"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Type de média</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as "image" | "video" | "pdf")}
                  className="block w-full py-2.5 px-3 border border-gray-800 rounded-xl bg-gray-900 text-white text-sm focus:border-fiverr focus:outline-none"
                >
                  <option value="pdf">Document (PDF)</option>
                  <option value="image">Image (JPG/PNG)</option>
                  <option value="video">Vidéo (MP4)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Format d&apos;affichage (Aspect Ratio)</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as "square" | "wide" | "tall")}
                  className="block w-full py-2.5 px-3 border border-gray-800 rounded-xl bg-gray-900 text-white text-sm focus:border-fiverr focus:outline-none"
                >
                  <option value="square">Carré (1:1)</option>
                  <option value="wide">Large (4:3)</option>
                  <option value="tall">Hauteur (3:4)</option>
                </select>
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-900/30 text-red-400 rounded-lg text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-900/30 text-emerald-400 rounded-lg text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <Button type="submit" fullWidth disabled={uploading} className="bg-fiverr hover:bg-fiverr-dark text-white">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                "Téléverser"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

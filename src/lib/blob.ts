import { put } from '@vercel/blob';

/**
 * Prend une chaîne Base64 (ex: "data:image/jpeg;base64,...") et l'uploade sur Vercel Blob.
 * @param base64String La chaîne d'image complète (avec le metadata "data:image/...")
 * @param childId L'identifiant de l'enfant pour nommer le fichier
 * @returns L'URL publique renvoyée par Vercel Blob, ou undefined si erreur.
 */
export async function uploadBase64ToVercelBlob(base64String: string, childId: string): Promise<string | undefined> {
  try {
    if (!base64String.startsWith('data:image/')) {
      console.warn("Ce n'est pas une image Base64 valide.");
      return undefined;
    }

    // Extraction du type MIME (ex: "image/jpeg") et des données Base64 pures
    const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.warn("Format Base64 invalide pour Vercel Blob.");
      return undefined;
    }

    const mimeType = matches[1];
    const extension = mimeType.split('/')[1] || 'jpg';
    const base64Data = matches[2];

    // Conversion en Buffer (binaire) pour Vercel Blob
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `enfants/${childId}-${Date.now()}.${extension}`;

    // Upload vers Vercel Blob
    // access: 'public' rend l'image accessible à tous via l'URL
    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: mimeType
    });

    console.log(`[Vercel Blob] Photo uploadée avec succès : ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error("[Vercel Blob] Erreur lors de l'upload de l'image:", error);
    return undefined;
  }
}

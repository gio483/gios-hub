// Issues secure client-upload tokens so the phone can upload raw recordings
// straight to the Hub's Blob store (bypasses the 4.5MB function body limit).
import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      // Devices report codec-qualified types (e.g. "video/mp4;codecs=avc1,mp4a").
      // Keep this list broad so a valid recording is never rejected as a mismatch.
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'video/mp4', 'video/webm', 'video/quicktime',
          'video/x-m4v', 'video/mpeg', 'video/3gpp',
          'application/octet-stream',
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 300 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (e) {
    return res.status(400).json({ error: String(e && e.message || e) });
  }
}

import api from '../services/api';

/**
 * Downloads a file from an authenticated API endpoint (Excel/PDF exports all
 * require the Bearer token, so a plain <a href> won't carry auth) and saves
 * it via a temporary object URL.
 */
export async function downloadFile(url, filename, toast) {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    toast?.success('Report downloaded successfully.');
  } catch (err) {
    toast?.error("We couldn't download the file. Please try again.");
  }
}

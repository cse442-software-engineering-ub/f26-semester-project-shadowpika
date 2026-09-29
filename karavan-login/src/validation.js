export const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function validateProofFile(file) {
    if (!file) return 'Proof of ownership is required.';
    const extension = file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) return 'Invalid file type. Accepted formats: PDF, JPG, PNG.';
    if (file.size > MAX_FILE_BYTES) return 'File is too large. Maximum size is 10MB.';
    return null;
}

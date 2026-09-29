export const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
// Matches Aptitude's 2MB PHP upload limit.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function validateProofFile(file) {
    if (!file) return 'Proof of ownership is required.';
    if (file.size === 0) return 'The file is empty. Please choose a different file.';
    const extension = file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) return 'Invalid file type. Accepted formats: PDF, JPG, PNG.';
    if (file.size > MAX_FILE_BYTES) return 'File is too large. Maximum size is 2MB.';
    return null;
}

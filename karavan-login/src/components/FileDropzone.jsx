import { useState } from 'react';

function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function UploadIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9M12 12v8m0-8-3 3m3-3 3 3"
                stroke="#1F3A5F"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function FileDropzone({ id, file, error, onChange }) {
    const [dragging, setDragging] = useState(false);

    const pick = (files) => onChange(files && files.length > 0 ? files[0] : null);

    const handleDrop = (event) => {
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files);
    };

    const classes = ['kv-dropzone'];
    if (dragging) classes.push('kv-dropzone--dragging');
    if (error) classes.push('kv-dropzone--error');

    return (
        <div>
            <label
                htmlFor={id}
                className={classes.join(' ')}
                data-testid="proof-dropzone"
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
            >
                <input
                    id={id}
                    name="proof_of_ownership"
                    type="file"
                    className="kv-visually-hidden"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `${id}-error` : `${id}-hint`}
                    onChange={(event) => {
                        pick(event.target.files);
                        event.target.value = '';
                    }}
                />
                <UploadIcon />
                {file ? (
                    <span className="kv-dropzone__title">
                        {file.name} <span className="kv-dropzone__meta">({formatSize(file.size)})</span>
                    </span>
                ) : (
                    <span className="kv-dropzone__title">Drag file here or click to browse</span>
                )}
                <span id={`${id}-hint`} className="kv-dropzone__hint">PDF, JPG, or PNG up to 2MB</span>
            </label>
            {file && (
                <button type="button" className="kv-link-button" onClick={() => onChange(null)}>
                    Remove file
                </button>
            )}
            {error && (
                <p id={`${id}-error`} className="kv-field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

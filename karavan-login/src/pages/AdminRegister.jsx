import { useState } from 'react';
import KaravanHeader from '../components/KaravanHeader.jsx';
import FileDropzone from '../components/FileDropzone.jsx';
import { validateProofFile } from '../validation.js';
import { submitAdminRegistration } from '../api.js';
import { pathFor } from '../routes.js';
import '../styles/karavan.css';

const FIELDS = [
    { name: 'full_name', label: 'Full Name', type: 'text', autoComplete: 'name' },
    { name: 'business_name', label: 'Business / Community Name', type: 'text', autoComplete: 'organization' },
    { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email' },
    { name: 'phone', label: 'Phone Number', type: 'tel', autoComplete: 'tel' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
    { name: 'confirm_password', label: 'Confirm Password', type: 'password', autoComplete: 'new-password' },
];

const EMPTY_VALUES = Object.fromEntries(FIELDS.map((field) => [field.name, '']));

const FILE_ERRORS = [
    'Proof of ownership is required.',
    'Invalid file type. Accepted formats: PDF, JPG, PNG.',
    'File is too large. Maximum size is 2MB.',
    'The file is empty. Please choose a different file.',
];

function validateFields(values) {
    const errors = {};
    for (const field of FIELDS) {
        if (!values[field.name].trim()) errors[field.name] = `${field.label} is required.`;
    }
    if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errors.email = 'Please enter a valid email address.';
    }
    if (!errors.password && values.password.trim().length < 8) {
        errors.password = 'Password must be at least 8 characters.';
    }
    if (!errors.confirm_password && values.confirm_password !== values.password) {
        errors.confirm_password = 'Passwords do not match.';
    }
    return errors;
}

function PendingConfirmation({ businessName }) {
    return (
        <div className="kv-confirmation" role="status">
            <div className="kv-confirmation__badge" aria-hidden="true">✓</div>
            <h2 className="kv-card__title">Your request is pending review</h2>
            <p className="kv-card__subtitle">
                Thanks! We received the application for <strong>{businessName}</strong>. A Karavan moderator will
                review your proof of ownership, and you can sign in as a community partner once it's approved.
            </p>
            <a className="kv-button kv-button--gold" href={pathFor('login')}>
                Back to Log In
            </a>
        </div>
    );
}

export default function AdminRegister() {
    const [values, setValues] = useState(EMPTY_VALUES);
    const [fieldErrors, setFieldErrors] = useState({});
    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState(null);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submittedBusiness, setSubmittedBusiness] = useState(null);

    const updateField = (name, value) => {
        setValues((current) => ({ ...current, [name]: value }));
        setFieldErrors((current) => ({ ...current, [name]: undefined }));
    };

    const updateFile = (nextFile) => {
        setFile(nextFile);
        setFileError(nextFile ? validateProofFile(nextFile) : null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');

        const errors = validateFields(values);
        const proofError = validateProofFile(file);
        setFieldErrors(errors);
        setFileError(proofError);
        if (Object.keys(errors).length > 0 || proofError) return;

        const formData = new FormData();
        for (const field of FIELDS) {
            if (field.name !== 'confirm_password') formData.append(field.name, values[field.name].trim());
        }
        formData.append('proof_of_ownership', file);

        setSubmitting(true);
        try {
            const result = await submitAdminRegistration(formData);
            if (result.success) {
                setSubmittedBusiness(values.business_name.trim());
            } else if (FILE_ERRORS.includes(result.error)) {
                setFileError(result.error);
            } else {
                setFormError(result.error || 'Something went wrong. Please try again.');
            }
        } catch {
            setFormError('Could not reach the server. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="kv-page">
            <KaravanHeader />
            <main className="kv-split">
                <section className="kv-brand" aria-hidden="true">
                    <span className="kv-brand__wordmark">KARAVAN</span>
                    <span className="kv-brand__tagline">Community Partner Portal</span>
                </section>

                <section className="kv-card kv-card--form" aria-labelledby="admin-register-title">
                    {submittedBusiness ? (
                        <PendingConfirmation businessName={submittedBusiness} />
                    ) : (
                        <>
                            <h1 id="admin-register-title" className="kv-card__title">
                                Register as a Community Partner
                            </h1>
                            <p className="kv-card__subtitle">Platform Admin &amp; Property Management Portal</p>

                            <form className="kv-form" onSubmit={handleSubmit} noValidate>
                                {FIELDS.map((field) => (
                                    <div className="kv-field" key={field.name}>
                                        <label className="kv-label" htmlFor={field.name}>
                                            {field.label}
                                        </label>
                                        <input
                                            id={field.name}
                                            name={field.name}
                                            type={field.type}
                                            autoComplete={field.autoComplete}
                                            className={`kv-input${fieldErrors[field.name] ? ' kv-input--error' : ''}`}
                                            value={values[field.name]}
                                            onChange={(event) => updateField(field.name, event.target.value)}
                                            aria-invalid={fieldErrors[field.name] ? 'true' : 'false'}
                                            aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
                                        />
                                        {fieldErrors[field.name] && (
                                            <p id={`${field.name}-error`} className="kv-field-error">
                                                {fieldErrors[field.name]}
                                            </p>
                                        )}
                                    </div>
                                ))}

                                <div className="kv-field">
                                    <label className="kv-label" htmlFor="proof_of_ownership">
                                        Upload proof of ownership (lease, deed, or business license)
                                    </label>
                                    <FileDropzone
                                        id="proof_of_ownership"
                                        file={file}
                                        error={fileError}
                                        onChange={updateFile}
                                    />
                                </div>

                                {formError && (
                                    <p className="kv-form-error" role="alert">
                                        {formError}
                                    </p>
                                )}

                                <button type="submit" className="kv-button kv-button--gold kv-button--submit" disabled={submitting}>
                                    {submitting ? 'Submitting…' : 'Submit for Approval'}
                                </button>
                            </form>

                            <p className="kv-card__footer">
                                Already have an account? <a href={pathFor('login')}>Log in</a>
                            </p>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}

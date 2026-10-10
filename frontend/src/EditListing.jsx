import React, { useState } from 'react';

// Standalone NavBar for your local test environment
function NavBar() {
    return (
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: '#f7f3ea', borderBottom: '1px solid #d1d9e0' }}>
            <div style={{ fontSize: '24px', fontStyle: 'normal', fontWeight: '700', color: '#1f2f46' }}>🚌 KARAVAN</div>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                <span style={{ color: '#6e87a0', fontWeight: '700', fontSize: '15px' }}>Meeting Request</span>
                <span style={{ color: '#6e87a0', fontWeight: '700', fontSize: '15px' }}>Settings</span>
                <span style={{ color: '#1f2f46', fontWeight: '700', fontSize: '15px' }}>Sell</span>
                <span style={{ backgroundColor: '#1f2f46', color: '#f7f3ea', padding: '8px 18px', borderRadius: '6px', fontWeight: '700', fontSize: '15px' }}>Profile</span>
            </div>
        </nav>
    );
}

import './features/listings/CreateListing.css';

const CATEGORY_OPTIONS = ['Textbooks', 'Tech & Electronics', 'Dorm Living', 'Clothing & Gear', 'Other'];
const CONDITION_OPTIONS = ['New', 'Like New', 'Good', 'Fair', 'Acceptable'];
const LOCATION_OPTIONS = [
    'Capen Hall · Main entrance',
    'Lockwood Memorial Library · Main entrance',
    'Student Union · Main entrance',
    'Center for the Arts · Main entrance',
    'Abbott Library · Main entrance',
];

function FormField({ as = 'input', children, error, label, name, optional = false, fieldRef, ...fieldProps }) {
    const Input = as;
    const errorId = `${name}-error`;

    return (
        <div className={`listing-field${error ? ' listing-field-error' : ''}`}>
            <label className="listing-label" htmlFor={name}>
                {label}{!optional && <span aria-hidden="true"> *</span>}
            </label>
            <Input
                ref={fieldRef}
                id={name}
                name={name}
                className="listing-control"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                {...fieldProps}
            >
                {children}
            </Input>
            {error && <span id={errorId} className="listing-field-message">{error}</span>}
        </div>
    );
}
export default function EditListing({ currentListing, onCancel, onSaveSuccess }) {
    const [form, setForm] = useState({
        title: currentListing?.name || currentListing?.title || '',
        category: currentListing?.category || '',
        condition: currentListing?.condition || '',
        price: currentListing?.price || '',
        related_course: currentListing?.related_course || '',
        meeting_location: currentListing?.meeting_location || '',
        description: currentListing?.description || '',
    });
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm(current => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setSubmitError('');

        const payload = {
            listing_id: currentListing.listing_id,
            title: form.title.trim(),
            category: form.category,
            condition: form.condition,
            price: form.price,
            related_course: form.related_course.trim(),
            meeting_location: form.meeting_location,
            description: form.description.trim(),
        };

        try {
            const response = await fetch('./listing/api/update_listing.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'The listing could not be updated.');
            }
            onSaveSuccess();
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Update failed.');
            setSubmitting(false);
        }
    };

    return (
        <div className="create-listing-page">
            <NavBar />
            <main className="create-listing-content">
                <h1>Edit listing</h1>
                <p className="listing-intro">Modify your marketplace listing fields below.</p>

                {submitError && <div className="listing-validation-summary" role="alert">{submitError}</div>}

                <form className="listing-form-card" noValidate onSubmit={handleSubmit}>
                    <section className="listing-photo-section">
                        <span className="listing-label">ITEM PHOTO</span>
                        <div className="listing-photo-upload">
                            <span className="listing-photo-plus">＋</span>
                            <span className="listing-photo-title">Photo Loaded</span>
                        </div>
                    </section>

                    <div className="listing-fields">
                        <FormField label="ITEM TITLE" name="title" value={form.title} onChange={updateField} error={errors.title} />
                        
                        <div className="listing-field-row">
                            <FormField as="select" label="CATEGORY" name="category" value={form.category} onChange={updateField} error={errors.category}>
                                <option value="">Select a category</option>
                                {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                            </FormField>
                            <FormField as="select" label="CONDITION" name="condition" value={form.condition} onChange={updateField} error={errors.condition}>
                                <option value="">Select condition</option>
                                {CONDITION_OPTIONS.map(c => <option key={c}>{c}</option>)}
                            </FormField>
                        </div>

                        <div className="listing-field-row">
                            <FormField label="PRICE" name="price" value={form.price} onChange={updateField} error={errors.price} />
                            <FormField label="RELATED COURSE" name="related_course" value={form.related_course} onChange={updateField} optional error={errors.related_course} />
                        </div>

                        <FormField as="select" label="PREFERRED MEETING LOCATION" name="meeting_location" value={form.meeting_location} onChange={updateField} error={errors.meeting_location}>
                            <option value="">Select an approved campus location</option>
                            {LOCATION_OPTIONS.map(l => <option key={l}>{l}</option>)}
                        </FormField>

                        <FormField as="textarea" label="DESCRIPTION" name="description" value={form.description} onChange={updateField} error={errors.description} />

                        <div className="listing-actions">
                            <button type="button" onClick={onCancel} className="listing-secondary-button">Cancel</button>
                            <button className="listing-primary-button" type="submit" disabled={submitting}>
                                {submitting ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}

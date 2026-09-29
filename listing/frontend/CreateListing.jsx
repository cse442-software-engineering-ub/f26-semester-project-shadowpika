import React, { useMemo, useRef, useState } from 'react';
import NavBar from '../../karavan-login/src/NavBar.jsx';
import './CreateListing.css';

const CATEGORY_OPTIONS = [
    'Textbooks',
    'Tech & Electronics',
    'Dorm Living',
    'Clothing & Gear',
    'Other',
];

const CONDITION_OPTIONS = ['New', 'Like New', 'Good', 'Fair', 'Acceptable'];

const LOCATION_OPTIONS = [
    'Capen Hall · Main entrance',
    'Lockwood Memorial Library · Main entrance',
    'Student Union · Main entrance',
    'Center for the Arts · Main entrance',
    'Abbott Library · Main entrance',
];

const INITIAL_FORM = {
    title: '',
    category: '',
    condition: '',
    price: '',
    related_course: '',
    meeting_location: '',
    description: '',
};

const FIELD_LABELS = {
    title: 'Item title',
    category: 'Category',
    condition: 'Condition',
    price: 'Price',
    related_course: 'Related course',
    meeting_location: 'Preferred meeting location',
    description: 'Description',
};

const REQUIRED_FIELDS = ['title', 'category', 'condition', 'price', 'meeting_location', 'description'];
const LOCAL_LISTING_KEY = 'karavan:last-created-listing';

const isLocalPreview = () => (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
);

function validateListing(values) {
    const errors = {};

    REQUIRED_FIELDS.forEach((field) => {
        if (!values[field].trim()) {
            errors[field] = `${FIELD_LABELS[field]} is required.`;
        }
    });

    if (values.title.trim().length > 150) {
        errors.title = 'Item title must be 150 characters or fewer.';
    }
    if (values.related_course.trim().length > 100) {
        errors.related_course = 'Related course must be 100 characters or fewer.';
    }
    if (values.description.trim().length > 1000) {
        errors.description = 'Description must be 1,000 characters or fewer.';
    }
    if (values.price && !/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(values.price)) {
        errors.price = 'Enter a price from $0.01 to $9,999.99 with no more than two decimal places.';
    } else if (values.price) {
        const numericPrice = Number(values.price);
        if (numericPrice < 0.01 || numericPrice > 9999.99) {
            errors.price = 'Enter a price from $0.01 to $9,999.99 with no more than two decimal places.';
        }
    }

    return errors;
}

function FormField({
    as = 'input',
    children,
    error,
    label,
    name,
    optional = false,
    fieldRef,
    ...fieldProps
}) {
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

function CreateListing() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const fieldRefs = useRef({});

    const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
        setErrors((current) => {
            if (!current[name]) return current;
            const next = { ...current };
            delete next[name];
            return next;
        });
        setSubmitError('');
    };

    const focusFirstError = (nextErrors) => {
        const firstInvalidField = REQUIRED_FIELDS.find((field) => nextErrors[field])
            || Object.keys(nextErrors)[0];
        window.requestAnimationFrame(() => fieldRefs.current[firstInvalidField]?.focus());
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validationErrors = validateListing(form);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setSubmitError('');
            focusFirstError(validationErrors);
            return;
        }

        setSubmitting(true);
        setErrors({});
        setSubmitError('');

        const payload = {
            title: form.title.trim(),
            category: form.category,
            condition: form.condition,
            price: form.price,
            related_course: form.related_course.trim(),
            meeting_location: form.meeting_location,
            description: form.description.trim(),
        };

        try {
            let listing;
            if (isLocalPreview()) {
                listing = {
                    listing_id: 99999,
                    name: payload.title,
                    title: payload.title,
                    category: payload.category,
                    condition: payload.condition,
                    price: Number(payload.price).toFixed(2),
                    related_course: payload.related_course || null,
                    meeting_location: payload.meeting_location,
                    description: payload.description,
                    image_url: null,
                    status: 'active',
                };
                localStorage.setItem(LOCAL_LISTING_KEY, JSON.stringify(listing));
            } else {
                const response = await fetch('./listing/api/create_listing.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    if (data.errors && typeof data.errors === 'object') {
                        setErrors(data.errors);
                        focusFirstError(data.errors);
                    }
                    throw new Error(data.error || 'The listing could not be created. Please try again.');
                }
                listing = data.listing;
            }

            const listingId = encodeURIComponent(listing.listing_id);
            window.location.assign(`./product-search.html?published=${listingId}`);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'The listing could not be created. Please try again.');
            setSubmitting(false);
        }
    };

    const setFieldRef = (name) => (node) => {
        fieldRefs.current[name] = node;
    };

    return (
        <div className="create-listing-page">
            <NavBar />
            <main className="create-listing-content">
                <button
                    type="button"
                    className="listing-secondary-button manage-listings-button"
                    disabled
                    title="Listing management will be added in a separate task."
                >
                    Manage listings
                </button>

                <h1>Create a listing</h1>
                <p className="listing-intro">
                    Add an item to the campus marketplace. Required fields are marked with an asterisk.
                </p>

                {(hasErrors || submitError) && (
                    <div className="listing-validation-summary" role="alert">
                        {submitError || 'Missing required fields. Complete the highlighted fields before creating your listing.'}
                    </div>
                )}

                <form className="listing-form-card" noValidate onSubmit={handleSubmit}>
                    <section className="listing-photo-section" aria-labelledby="item-photo-label">
                        <span id="item-photo-label" className="listing-label">ITEM PHOTO</span>
                        <button
                            type="button"
                            className="listing-photo-upload"
                            disabled
                            title="Image upload will be implemented in the listing image task."
                        >
                            <span className="listing-photo-plus" aria-hidden="true">＋</span>
                            <span className="listing-photo-title">Upload item image</span>
                            <span className="listing-photo-format">PNG or JPG · up to 10 MB</span>
                        </button>
                        <p className="listing-photo-help">Image upload will be enabled after image support is added.</p>
                    </section>

                    <div className="listing-fields">
                        <FormField
                            label="ITEM TITLE"
                            name="title"
                            value={form.title}
                            onChange={updateField}
                            placeholder="e.g., Color Workbook"
                            maxLength={150}
                            error={errors.title}
                            fieldRef={setFieldRef('title')}
                        />

                        <div className="listing-field-row">
                            <FormField
                                as="select"
                                label="CATEGORY"
                                name="category"
                                value={form.category}
                                onChange={updateField}
                                error={errors.category}
                                fieldRef={setFieldRef('category')}
                            >
                                <option value="">Select a category</option>
                                {CATEGORY_OPTIONS.map((category) => <option key={category}>{category}</option>)}
                            </FormField>
                            <FormField
                                as="select"
                                label="CONDITION"
                                name="condition"
                                value={form.condition}
                                onChange={updateField}
                                error={errors.condition}
                                fieldRef={setFieldRef('condition')}
                            >
                                <option value="">Select condition</option>
                                {CONDITION_OPTIONS.map((condition) => <option key={condition}>{condition}</option>)}
                            </FormField>
                        </div>

                        <div className="listing-field-row">
                            <FormField
                                label="PRICE"
                                name="price"
                                type="number"
                                min="0.01"
                                max="9999.99"
                                step="0.01"
                                inputMode="decimal"
                                value={form.price}
                                onChange={updateField}
                                placeholder="$ 0.00"
                                error={errors.price}
                                fieldRef={setFieldRef('price')}
                            />
                            <FormField
                                label="RELATED COURSE"
                                name="related_course"
                                value={form.related_course}
                                onChange={updateField}
                                placeholder="e.g., ART 105"
                                maxLength={100}
                                optional
                                error={errors.related_course}
                                fieldRef={setFieldRef('related_course')}
                            />
                        </div>

                        <FormField
                            as="select"
                            label="PREFERRED MEETING LOCATION"
                            name="meeting_location"
                            value={form.meeting_location}
                            onChange={updateField}
                            error={errors.meeting_location}
                            fieldRef={setFieldRef('meeting_location')}
                        >
                            <option value="">Select an approved campus location</option>
                            {LOCATION_OPTIONS.map((location) => <option key={location}>{location}</option>)}
                        </FormField>

                        <FormField
                            as="textarea"
                            label="DESCRIPTION"
                            name="description"
                            value={form.description}
                            onChange={updateField}
                            placeholder="Describe the item’s condition, edition, or included materials."
                            maxLength={1000}
                            error={errors.description}
                            fieldRef={setFieldRef('description')}
                        />

                        <div className="listing-actions">
                            <a className="listing-secondary-button" href="./product-search.html">Cancel</a>
                            <button className="listing-primary-button" type="submit" disabled={submitting}>
                                {submitting ? 'Creating…' : 'Create listing'}
                            </button>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default CreateListing;

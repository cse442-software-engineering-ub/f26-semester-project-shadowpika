import { useState } from 'react';
import LocationsMap from './LocationsMap.jsx';
import { addApprovedLocation, removeApprovedLocation } from '../api.js';

// approved_locations stores DECIMAL(9,6).
const round6 = (value) => Math.round(value * 1e6) / 1e6;

const NAME_REQUIRED = 'Please enter a location name.';

export default function ApprovedLocationsAdmin({ initialLocations }) {
    const [locations, setLocations] = useState(initialLocations);
    const [removingIds, setRemovingIds] = useState(() => new Set());
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [nameError, setNameError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);

    const selected = locations.find((location) => location.location_id === selectedId) ?? null;
    const hasChanges = draft !== null || removingIds.size > 0;

    const handleMapClick = ({ lat, lng }) => {
        setSelectedId(null);
        setNotice('');
        setDraft((current) => ({ lat: round6(lat), lng: round6(lng), label: current?.label ?? '' }));
    };

    const handleSelect = (locationId) => {
        setSelectedId(locationId);
        setNotice('');
    };

    const toggleRemoval = (locationId) => {
        setNotice('');
        setRemovingIds((current) => {
            const next = new Set(current);
            if (next.has(locationId)) next.delete(locationId);
            else next.add(locationId);
            return next;
        });
    };

    const handleSave = async () => {
        if (draft && !draft.label.trim()) {
            setNameError(NAME_REQUIRED);
            return;
        }
        setSaving(true);
        setSaveError('');
        setNotice('');

        const errors = [];
        const remainingRemovals = new Set(removingIds);
        let savedDraft = null;
        try {
            for (const locationId of removingIds) {
                const result = await removeApprovedLocation(locationId);
                // A 404 means it is already gone, which is what the admin wanted.
                if (result.success || result.status === 404) remainingRemovals.delete(locationId);
                else errors.push(result.error || 'Could not remove a location.');
            }
            if (draft) {
                const label = draft.label.trim();
                const result = await addApprovedLocation({ lat: draft.lat, lng: draft.lng, label });
                if (result.success) savedDraft = { location_id: result.location_id, lat: draft.lat, lng: draft.lng, label };
                else errors.push(result.error || 'Could not add the location.');
            }
        } catch {
            errors.push('Could not reach the server.');
        }

        const removedIds = [...removingIds].filter((locationId) => !remainingRemovals.has(locationId));
        setLocations((current) => [
            ...current.filter((location) => !removedIds.includes(location.location_id)),
            ...(savedDraft ? [savedDraft] : []),
        ]);
        setRemovingIds(remainingRemovals);
        if (savedDraft) setDraft(null);
        if (removedIds.includes(selectedId)) setSelectedId(null);
        setSaving(false);

        if (errors.length > 0) setSaveError(errors.join(' '));
        else setNotice('Changes saved.');
    };

    const removingSelected = selected !== null && removingIds.has(selected.location_id);

    return (
        <section className="kv-settings-section" aria-labelledby="approved-locations-title">
            <h2 id="approved-locations-title" className="kv-settings-section__title">
                Approved Meeting Locations
            </h2>
            <p className="kv-settings-section__hint">
                Click the map to mark a new safe on-campus meetup spot. Click a pin to remove it.
            </p>

            <div className="kv-map-card">
                <LocationsMap
                    locations={locations}
                    removingIds={removingIds}
                    selectedId={selectedId}
                    draft={draft}
                    onMapClick={handleMapClick}
                    onSelect={handleSelect}
                />

                <div className="kv-map-card__details">
                    {draft ? (
                        <>
                            <h3 className="kv-map-card__title">New location</h3>
                            <p className="kv-map-card__meta">{formatCoordinates(draft)}</p>
                            <label className="kv-settings-label" htmlFor="location-name">
                                Location name
                            </label>
                            <div className="kv-settings-row">
                                <input
                                    id="location-name"
                                    className={`kv-settings-input${nameError ? ' kv-settings-input--error' : ''}`}
                                    type="text"
                                    maxLength={100}
                                    placeholder="e.g. Capen Hall Main Entrance"
                                    value={draft.label}
                                    aria-invalid={nameError ? 'true' : 'false'}
                                    aria-describedby={nameError ? 'location-name-error' : undefined}
                                    onChange={(event) => {
                                        const label = event.target.value;
                                        setDraft((current) => ({ ...current, label }));
                                        if (label.trim()) setNameError('');
                                    }}
                                />
                                <button
                                    type="button"
                                    className="kv-settings-link"
                                    onClick={() => {
                                        setDraft(null);
                                        setNameError('');
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                            {nameError && (
                                <p id="location-name-error" className="kv-settings-error" role="alert">
                                    {nameError}
                                </p>
                            )}
                        </>
                    ) : selected ? (
                        <>
                            <h3 className="kv-map-card__title">{selected.label}</h3>
                            <p className="kv-map-card__meta">{formatCoordinates(selected)}</p>
                            {removingSelected && (
                                <p className="kv-banner kv-banner--danger">This location will be removed when you save.</p>
                            )}
                            <div className="kv-map-card__actions">
                                {removingSelected ? (
                                    <button type="button" className="kv-button-outline" onClick={() => toggleRemoval(selected.location_id)}>
                                        Keep location
                                    </button>
                                ) : (
                                    <button type="button" className="kv-button-navy" onClick={() => toggleRemoval(selected.location_id)}>
                                        Remove location
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="kv-map-card__title">
                                {locations.length === 0 ? 'No approved meeting locations yet.' : `${locations.length} approved meeting location${locations.length === 1 ? '' : 's'}`}
                            </h3>
                            <p className="kv-map-card__meta">Click the map to add a spot, or click a pin to manage it.</p>
                        </>
                    )}
                </div>
            </div>

            {saveError ? (
                <p className="kv-banner kv-banner--danger" role="alert">
                    {saveError}
                </p>
            ) : notice ? (
                <p className="kv-banner kv-banner--success" role="status">
                    {notice}
                </p>
            ) : hasChanges ? (
                <p className="kv-banner kv-banner--warning" role="status">
                    You have unsaved changes.
                </p>
            ) : null}

            <div className="kv-settings-save">
                <button type="button" className="kv-button-navy" onClick={handleSave} disabled={!hasChanges || saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
                <span className="kv-settings-save__hint">Pins are only saved when you click Save changes.</span>
            </div>
        </section>
    );
}

function formatCoordinates({ lat, lng }) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

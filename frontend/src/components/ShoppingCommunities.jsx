import React, { useCallback, useEffect, useState } from 'react';
import { fetchCommunities, setShoppingCommunities } from '../api.js';
import { onCommunitiesChanged, openCommunityPicker } from '../community.js';

// "Shopping from": the shopper ticks which of their communities' listings appear in search.
// Saved on the server, so the choice follows them to other pages and devices.
function ShoppingCommunities({ onChange }) {
    const [communities, setCommunities] = useState(null); // null until loaded; hidden if it fails
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const result = await fetchCommunities();
            if (result.status === 200 && result.success && Array.isArray(result.communities)) {
                setCommunities(result.communities.filter((c) => c.joined));
            }
        } catch {
            // Search still works without the bar.
        }
    }, []);

    useEffect(() => {
        load();
        return onCommunitiesChanged(() => {
            load();
            onChange();
        });
    }, [load, onChange]);

    if (!communities || communities.length === 0) return null;

    const shoppingCount = communities.filter((c) => c.shopping).length;

    const toggle = async (communityId) => {
        const ids = communities
            .filter((c) => (c.community_id === communityId ? !c.shopping : c.shopping))
            .map((c) => c.community_id);
        setSaving(true);
        setError('');
        try {
            const result = await setShoppingCommunities(ids);
            if (result.status === 200 && result.success && Array.isArray(result.shopping_community_ids)) {
                setCommunities((current) => current.map((c) => ({
                    ...c,
                    shopping: result.shopping_community_ids.includes(c.community_id),
                })));
                onChange();
            } else {
                setError(result.error || 'Could not update your communities. Please try again.');
            }
        } catch {
            setError('Could not update your communities. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="ps-shopping" aria-labelledby="ps-shopping-title">
            <div className="ps-shopping-header">
                <h2 id="ps-shopping-title" className="ps-shopping-title">Shopping from</h2>
                <button type="button" className="ps-shopping-join" onClick={openCommunityPicker}>
                    Join a community
                </button>
            </div>
            <div className="ps-shopping-options">
                {communities.map(({ community_id: id, name, shopping }) => (
                    <label key={id} className={`ps-shopping-option${shopping ? ' is-selected' : ''}`}>
                        <input
                            type="checkbox"
                            checked={shopping}
                            // At least one community has to stay selected.
                            disabled={saving || (shopping && shoppingCount === 1)}
                            onChange={() => toggle(id)}
                        />
                        <span>{name}</span>
                    </label>
                ))}
            </div>
            {error ? <p className="ps-shopping-error" role="alert">{error}</p> : null}
        </section>
    );
}

export default ShoppingCommunities;

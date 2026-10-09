import React, { useState, useEffect } from 'react';
import './CreateListing.css';
import './ManageListings.css';

const BASE_API_PATH = '/CSE442/2026-Fall/cse-442j/listing/api';

function RealKaravanNavBar() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        if (!isDrawerOpen) return;
        const handleResize = () => window.matchMedia('(min-width: 769px)').matches && setIsDrawerOpen(false);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isDrawerOpen]);

    const navLinks = [
        { label: 'Home', href: './home.html' },
        { label: 'Settings', href: './settings.html' },
        { label: 'Sell', href: './sell.html' }
    ];

    return (
        <header className="nav">
            <nav className="nav-bar" aria-label="Main">
                <a className="nav-logo" href="./home.html" aria-label="Karavan home">
                    <svg className="nav-logo-icon" viewBox="0 0 52 36" fill="none" aria-hidden="true">
                        <path d="M6 5h30c7.2 0 13 5.8 13 13v7a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" stroke="#1f2d44" strokeWidth="2.4" />
                        <rect x="8" y="10" width="11" height="7" rx="1.5" stroke="#1f2d44" strokeWidth="2" />
                        <path d="M39 10h1.5a5 5 0 0 1 5 5v2H39z" stroke="#1f2d44" strokeWidth="2" strokeLinejoin="round" />
                        <rect x="25" y="10" width="8" height="15" rx="1" fill="#d9a441" stroke="#1f2d44" strokeWidth="1.6" />
                        <circle cx="31" cy="18" r="0.9" fill="#1f2d44" />
                        <circle cx="15" cy="28" r="5" fill="#3f6fa0" stroke="#1f2d44" strokeWidth="2" />
                        <circle cx="15" cy="28" r="1.6" fill="#f6f1ea" />
                    </svg>
                    <span className="nav-logo-text">KARAVAN</span>
                </a>
                <div className="nav-right">
                    <ul className="nav-links">
                        {navLinks.map(link => (
                            <li key={link.label}><a className="nav-link" href={link.href}>{link.label}</a></li>
                        ))}
                    </ul>
                    <div className="nav-icons">
                        <a className="nav-icon-btn nav-search" href="./product-search.html" aria-label="Search">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                                <circle cx="10.5" cy="10.5" r="7" /><line x1="15.8" y1="15.8" x2="21" y2="21" />
                            </svg>
                        </a>
                        <a className="nav-profile" href="./profile.html">Profile</a>
                        <button type="button" className="nav-icon-btn nav-menu-btn" aria-label="Open menu" aria-expanded={isDrawerOpen} onClick={() => setIsDrawerOpen(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>
            <div className={`nav-backdrop${isDrawerOpen ? ' is-open' : ''}`} onClick={() => setIsDrawerOpen(false)} aria-hidden="true" />
            <aside id="nav-drawer" className={`nav-drawer${isDrawerOpen ? ' is-open' : ''}`} aria-label="Menu" inert={!isDrawerOpen ? "" : undefined}>
                <a className="nav-drawer-brand" href="./home.html" aria-label="Karavan home">
                    <svg className="nav-logo-icon" viewBox="0 0 52 36" fill="none" aria-hidden="true">
                        <path d="M6 5h30c7.2 0 13 5.8 13 13v7a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" stroke="#1f2d44" strokeWidth="2.4" />
                        <circle cx="15" cy="28" r="5" fill="#3f6fa0" stroke="#1f2d44" strokeWidth="2" />
                    </svg>
                    <span className="nav-drawer-title">KARAVAN</span>
                    <span className="nav-drawer-tagline">Buy. Sell. Support Students.</span>
                </a>
                <ul className="nav-drawer-links">
                    {navLinks.map(link => (
                        <li key={link.label}><a className="nav-drawer-link" href={link.href}>{link.label}</a></li>
                    ))}
                    <li><a className="nav-drawer-link" href="./profile.html">Profile</a></li>
                </ul>
            </aside>
        </header>
    );
}
export default function ManageListings({ onCreateListing }) {
    const [currentView, setCurrentView] = useState('manage');
    const [currentTab, setCurrentTab] = useState('active');
    const [listings, setListings] = useState([]);
    const [selectedListing, setSelectedListing] = useState(null);
    const [loading, setLoading] = useState(true);

    const [uploadFile, setUploadFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = React.useRef(null);

    const loadDatabaseListings = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_API_PATH}/get_my_listings.php`, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            
            if (data.success && data.results && data.results.length > 0) {
                setListings(data.results);
                setSelectedListing(data.results[0]);
            } else {
                setListings([]);
            }
        } catch (err) {
            console.error("Failed to sync live rows from database:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const styleOverride = document.createElement('style');
        styleOverride.innerHTML = `
            #root { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
            body { margin: 0 !important; padding: 0 !important; background-color: #F7F3EA !important; }
        `;
        document.head.appendChild(styleOverride);
        
        loadDatabaseListings();

        const handleHashRouting = () => {
            if (window.location.hash.startsWith('#edit=')) {
                setCurrentView('edit');
            } else {
                setCurrentView('manage');
            }
        };
        handleHashRouting();
        window.addEventListener('hashchange', handleHashRouting);
        return () => {
            window.removeEventListener('hashchange', handleHashRouting);
            document.head.removeChild(styleOverride);
        };
    }, []);

    const updateField = (field, value) => {
        setListings(curr => curr.map(item => item.listing_id === selectedListing.listing_id ? { ...item, [field]: value } : item));
        setSelectedListing(curr => ({ ...curr, [field]: value }));
    };

    const handleAction = async (id, actionType) => {
        const nextStatus = actionType === 'mark_sold' ? 'sold' : actionType === 'mark_active' ? 'active' : 'deleted';
        
        if (nextStatus === 'deleted') {
            setListings(curr => curr.filter(item => item.listing_id !== id));
            try {
                await fetch(`${BASE_API_PATH}/update_listing.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', listing_id: id })
                });
            } catch (err) {
                console.error("Database connection error:", err);
            }
        } else {
            setListings(curr => curr.map(item => item.listing_id === id ? { ...item, status: nextStatus } : item));
            try {
                await fetch(`${BASE_API_PATH}/update_listing.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_status', listing_id: id, status: nextStatus })
                });
            } catch (err) {
                console.error("Database connection error:", err);
            }
        }
    };

    const activeItems = listings.filter(i => (i.status || '').trim().toLowerCase() === 'active');
    const soldItems = listings.filter(i => (i.status || '').trim().toLowerCase() === 'sold');
    const displayedItems = currentTab === 'active' ? activeItems : soldItems;
    if (currentView === 'edit' && selectedListing) {
        return (
            <div style={{ width: '100%', minHeight: '100vh', paddingBottom: 40, background: '#F7F3EA', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <RealKaravanNavBar />
                <main style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box', textAlign: 'left' }}>
                    <div>
                        <h1 style={{ fontSize: '30px', fontWeight: '700', margin: '0 0 6px 0', color: '#1F2F46', fontFamily: 'DM Sans' }}>Edit your listing</h1>
                    </div>

                    <form 
                        onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                // Default to keeping the current database image string pointer intact
                                let finalImageUrl = selectedListing.image_url;

                                // 1. If a fresh photo has been selected, pass its binary stream down to the server first
                                if (uploadFile) {
                                    const uploadData = new FormData();
                                    uploadData.append('image', uploadFile);

                                    const uploadResponse = await fetch(`${BASE_API_PATH}/upload_image.php`, {
                                        method: 'POST',
                                        body: uploadData
                                    });
                                    const uploadResult = await uploadResponse.json();

                                    if (uploadResponse.ok && uploadResult.success && uploadResult.image_url) {
                                        // FIX: Force the path string to point straight to the true server upload folder lane
                                        let cleanUrl = uploadResult.image_url;
                                        if (cleanUrl.includes('/api/uploads/')) {
                                            cleanUrl = cleanUrl.replace('/api/uploads/', '/uploads/');
                                        } else if (!cleanUrl.includes('/uploads/') && cleanUrl.startsWith('uploads/')) {
                                            cleanUrl = './listing/' + cleanUrl;
                                        }
                                        finalImageUrl = cleanUrl;
                                    } else {
                                        throw new Error(uploadResult.error || "The item image upload failed.");
                                    }
                                }

                                // 3. Package the main form data payload along with your brand-new image link string pointer
                                await fetch(`${BASE_API_PATH}/update_listing.php`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'save_changes',
                                        listing_id: selectedListing.listing_id,
                                        name: selectedListing.name,
                                        price: selectedListing.price,
                                        category: selectedListing.category,
                                        condition: selectedListing.condition || '',
                                        related_course: selectedListing.related_course || '',
                                        meeting_location: selectedListing.meeting_location,
                                        description: selectedListing.description,
                                        image_url: finalImageUrl // Sends the fresh server link pointer to database arrays
                                    })
                                });
                            } catch (err) {
                                console.error("Form transmission channel blocked:", err);
                            }

                            // 4. Reset component upload staging arrays, exit edit overlay panel, and pull live updates
                            setUploadFile(null);
                            setPreviewUrl(null);
                            window.location.hash = 'manage';
                            loadDatabaseListings();
                        }}
                        style={{ width: '100%', background: 'white', borderRadius: 18, border: '1px solid #D1D9E0', padding: 32, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', boxSizing: 'border-box', marginTop: 12 }}
                    >
                        <div style={{ width: '330px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
                            <div style={{ color: '#6E87A0', fontSize: 12, fontWeight: '700', fontFamily: 'DM Sans' }}>ITEM PHOTO</div>
                            
                            {/* Hidden file selector node bound to the element reference hook */}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                accept="image/jpeg,image/png,image/webp" 
                                style={{ display: 'none' }} 
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setUploadFile(file);
                                        setPreviewUrl(URL.createObjectURL(file));
                                    }
                                }} 
                            />

                            {/* Clicking anywhere inside this container triggers the browser file picker layout window */}
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                style={{ width: '330px', height: '460px', background: '#F0ECE4', borderRadius: 14, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '2px dashed #D1D9E0', position: 'relative' }}
                            >
                                {previewUrl || selectedListing.image_url ? (
                                    <>
                                        <img src={previewUrl || selectedListing.image_url} alt={selectedListing.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        <span style={{ color: '#FFF', background: '#1f2f46eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: '700', position: 'absolute', bottom: 12, right: 12 }}>Change item image</span>
                                    </>
                                ) : (
                                    <span style={{ color: '#6E87A0', fontFamily: 'DM Sans' }}>＋ Upload item image</span>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Item Title *</span>
                                <input type="text" value={selectedListing.name || ''} onChange={(e) => updateField('name', e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'DM Sans', boxSizing: 'border-box' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Category *</span>
                                    <select 
                                        value={selectedListing.category || ''} 
                                        onChange={(e) => updateField('category', e.target.value)} 
                                        style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'DM Sans', boxSizing: 'border-box', height: '50px' }}
                                    >
                                        <option value="Textbooks">Textbooks</option>
                                        <option value="Tech & Electronics">Tech & Electronics</option>
                                        <option value="Dorm Living">Dorm Living</option>
                                        <option value="Clothing & Gear">Clothing & Gear</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Condition *</span>
                                    <select 
                                        value={selectedListing.condition || ''} 
                                        onChange={(e) => updateField('condition', e.target.value)} 
                                        style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'DM Sans', boxSizing: 'border-box', height: '50px' }}
                                    >
                                        <option value="New">New</option>
                                        <option value="Like New">Like New</option>
                                        <option value="Good">Good</option>
                                        <option value="Fair">Fair</option>
                                        <option value="Acceptable">Acceptable</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Price *</span>
                                    <input type="text" value={selectedListing.price || ''} onChange={(e) => updateField('price', e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'DM Sans', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Related Course</span>
                                    <input type="text" value={selectedListing.related_course || ''} onChange={(e) => updateField('related_course', e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'DM Sans', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Preferred Meeting Location *</span>
                                <select 
                                    value={selectedListing.meeting_location || ''} 
                                    onChange={(e) => updateField('meeting_location', e.target.value)} 
                                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'DM Sans', boxSizing: 'border-box', height: '50px' }}
                                >
                                    <option value="Capen Hall · Main entrance">Capen Hall · Main entrance</option>
                                    <option value="Lockwood Memorial Library · Main entrance">Lockwood Memorial Library · Main entrance</option>
                                    <option value="Student Union · Main entrance">Student Union · Main entrance</option>
                                    <option value="Center for the Arts · Main entrance">Center for the Arts · Main entrance</option>
                                    <option value="Abbott Library · Main entrance">Abbott Library · Main entrance</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1F2F46', fontFamily: 'DM Sans', textTransform: 'uppercase' }}>Description *</span>
                                <textarea rows="4" value={selectedListing.description || ''} onChange={(e) => updateField('description', e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D9E0', borderRadius: '8px', fontSize: '15px', color: '#1F2F46', backgroundColor: '#ffffff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                                <button type="button" onClick={() => window.location.hash = 'manage'} style={{ background: '#ffffff', border: '1px solid #D1D9E0', padding: '10px 24px', borderRadius: '6px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', color: '#1F2F46', fontFamily: 'DM Sans' }}>Cancel</button>
                                <button type="submit" style={{ background: '#1F2F46', color: '#F7F3EA', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Save changes</button>
                            </div>
                        </div>
                    </form>
                </main>
            </div>
        );
    }
    return (
        <div style={{ width: '100%', minHeight: '100vh', paddingBottom: 40, background: '#F7F3EA', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', margin: 0, padding: 0 }}>
            <RealKaravanNavBar />
            <main style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 8, boxSizing: 'border-box', textAlign: 'left' }}>
                <div style={{ color: '#1F2F46', fontSize: 30, fontFamily: 'DM Sans', fontWeight: '700', lineHeight: '42px', marginTop: 20 }}>My listings</div>
                <div style={{ color: '#6E87A0', fontSize: 15, fontFamily: 'DM Sans', fontWeight: '400', lineHeight: '21px' }}>
                    {listings.length === 0 ? 'Your listing was deleted.' : currentTab === 'active' ? 'Only items published by you appear here. Manage their details and availability.' : 'Sold items remain visible to you but are hidden from marketplace search.'}
                </div>
                
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="button" onClick={() => setCurrentTab('active')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #1F2F46', cursor: 'pointer', background: currentTab === 'active' ? '#1F2F46' : '#FFF', color: currentTab === 'active' ? '#FFF' : '#1F2F46', fontWeight: '700', fontSize: '14px', fontFamily: 'DM Sans' }}>View Active ({activeItems.length})</button>
                    <button type="button" onClick={() => setCurrentTab('sold')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #1F2F46', cursor: 'pointer', background: currentTab === 'sold' ? '#1F2F46' : '#FFF', color: currentTab === 'sold' ? '#FFF' : '#1F2F46', fontWeight: '700', fontSize: '14px', fontFamily: 'DM Sans' }}>View Sold ({soldItems.length})</button>
                </div>

                <div style={{ color: '#1F2F46', fontSize: 13, fontFamily: 'DM Sans', fontWeight: '700', lineHeight: '18px', marginTop: 12, textTransform: 'uppercase' }}>
                    {currentTab === 'active' ? `${activeItems.length} Active` : `${soldItems.length} Sold`} Listing
                </div>

                {listings.length === 0 ? (
                    <div style={{ width: '100%', height: 360, background: 'white', borderRadius: 18, border: '1px solid #D1D6DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, boxSizing: 'border-box' }}>
                        <div style={{ color: '#1F2F46', fontSize: 28, fontFamily: 'DM Sans', fontWeight: '700' }}>No listings yet</div>
                        <div style={{ color: '#6E87A0', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '400' }}>Create a new listing when you are ready to sell another item.</div>
                        
                        <div 
                            onClick={() => window.location.assign('./sell.html')} 
                            style={{ width: 220, height: 48, background: '#1F2F46', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F7F3EA', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '700', cursor: 'pointer' }}
                        >
                            Create a listing
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
                        {displayedItems.map(item => {
                            const itemStatus = (item.status || '').trim().toLowerCase();
                            const badgeBg = itemStatus === 'active' ? '#E3F5E8' : '#FAEDC7';
                            const badgeText = itemStatus === 'active' ? '#1F7340' : '#8C5C14';
                            
                            return (
                                <div key={item.listing_id} style={{ width: '100%', background: 'white', borderRadius: 18, border: '1px solid #D1D6DB', padding: 32, display: 'flex', flexDirection: 'row', gap: 40, boxSizing: 'border-box', textAlign: 'left' }}>
                                    <div style={{ width: 330, height: 460, backgroundColor: '#F0ECE4', borderRadius: 14, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ color: '#6E87A0', fontFamily: 'DM Sans' }}>No Photo</span>
                                        )}
                                    </div>
                                    <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ width: 84, height: 30, background: badgeBg, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ color: badgeText, fontSize: 13, fontFamily: 'DM Sans', fontWeight: '700', textTransform: 'capitalize' }}>{itemStatus}</div>
                                        </div>
                                        <div style={{ color: '#1F2F46', fontSize: 28, fontFamily: 'DM Sans', fontWeight: '700' }}>{item.name}</div>
                                        <div style={{ color: '#1F2F46', fontSize: 17, fontFamily: 'DM Sans', fontWeight: '400' }}>${item.price}  &bull;  {item.condition}  &bull;  {item.category}</div>
                                        <div style={{ width: '100%', height: 1, background: '#DED6C9' }} />
                                        
                                        <div style={{ color: '#1F2F46', fontSize: 13, fontFamily: 'DM Sans', fontWeight: '700' }}>DESCRIPTION</div>
                                        <div style={{ color: '#6E87A0', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '400' }}>{item.description}</div>
                                        
                                        <div style={{ color: '#1F2F46', fontSize: 13, fontFamily: 'DM Sans', fontWeight: '700' }}>PREFERRED MEETING LOCATION</div>
                                        <div style={{ color: '#6E87A0', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '400' }}>{item.meeting_location}</div>
                                        
                                        <div style={{ color: '#1F2F46', fontSize: 13, fontFamily: 'DM Sans', fontWeight: '700' }}>RELATED COURSE</div>
                                        <div style={{ color: '#6E87A0', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '400' }}>{item.related_course}</div>
                                        
                                        <div style={{ color: '#1F2F46', fontSize: 13, fontFamily: 'DM Sans', fontWeight: '700' }}>LISTING ACTIONS</div>
                                        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                                            <div onClick={() => { setSelectedListing(item); window.location.hash = `edit=${item.listing_id}`; }} style={{ width: 180, height: 48, background: '#1F2F46', borderRadius: 8, justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer' }}>
                                                <div style={{ color: '#F7F3EA', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '700' }}>Edit listing</div>
                                            </div>
                                            <div onClick={() => handleAction(item.listing_id, itemStatus === 'active' ? 'mark_sold' : 'mark_active')} style={{ width: 200, height: 48, background: 'white', borderRadius: 8, outline: '1px #1F2F46 solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer' }}>
                                                <div style={{ color: '#1F2F46', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '700' }}>{itemStatus === 'active' ? 'Mark as sold' : 'Mark as available'}</div>
                                            </div>
                                            <div onClick={() => handleAction(item.listing_id, 'delete')} style={{ width: 140, height: 48, background: 'white', borderRadius: 8, outline: '1px #C72929 solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer' }}>
                                                <div style={{ color: '#C72929', fontSize: 16, fontFamily: 'DM Sans', fontWeight: '700' }}>Delete</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

import { useEffect, useRef } from 'react';

export default function FreezeListingsDialog({ busy, canConfirm, onConfirm, onDismiss, triggerRef, fallbackRef }) {
    const dialogRef = useRef(null);
    const keepRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        const trigger = triggerRef.current;
        const fallback = fallbackRef.current;
        dialog.showModal();
        keepRef.current.focus();
        return () => {
            dialog.close();
            if (trigger?.isConnected && !trigger.disabled) trigger.focus();
            else if (fallback?.isConnected) fallback.focus();
        };
    }, [triggerRef, fallbackRef]);

    useEffect(() => {
        if (busy) dialogRef.current.focus();
    }, [busy]);

    const keepFocusInDialog = (event) => {
        if (event.key !== 'Tab') return;
        const dialog = dialogRef.current;
        const buttons = [...dialog.querySelectorAll('button:not([disabled])')];
        if (buttons.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
            event.preventDefault(); first.focus();
        }
    };

    return (
        <dialog ref={dialogRef} tabIndex={-1} className="ml-freeze-dialog" aria-labelledby="ml-freeze-title"
            aria-describedby="ml-freeze-description" aria-busy={busy}
            onKeyDown={keepFocusInDialog}
            onCancel={(event) => { event.preventDefault(); if (!busy) onDismiss(); }}>
            <button type="button" className="ml-dialog-close" aria-label="Close pause confirmation"
                disabled={busy} onClick={onDismiss}>×</button>
            <h2 id="ml-freeze-title">Pause eligible active listings?</h2>
            <div id="ml-freeze-description">
                <p>Your eligible active listings will be paused and hidden from the marketplace.</p>
                <p>Listings with an upcoming meeting, an open check-in window, or both participants checked in will stay active.</p>
                <p>Unapproved meeting requests for paused listings will be canceled. Restoring a listing will not restore those requests.</p>
            </div>
            <div className="ml-dialog-actions">
                <button ref={keepRef} type="button" className="ml-status-action" disabled={busy}
                    onClick={onDismiss}>Keep Listings</button>
                <button type="button" className="ml-status-action ml-freeze-button" disabled={busy || !canConfirm}
                    onClick={onConfirm}>{busy ? 'Pausing…' : 'Pause Listings'}</button>
            </div>
        </dialog>
    );
}

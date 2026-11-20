import { useEffect, useId, useRef } from 'react';
import './ActionConfirmationDialog.css';

export default function ActionConfirmationDialog({ title, children, confirmLabel, cancelLabel,
    busy, onConfirm, onDismiss, trigger, fallbackRef }) {
    const dialogRef = useRef(null);
    const cancelRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        const fallback = fallbackRef?.current;
        dialog.showModal();
        cancelRef.current.focus();
        return () => {
            dialog.close();
            const target = trigger?.isConnected && !trigger.disabled ? trigger : fallback;
            target?.focus();
        };
    }, [trigger, fallbackRef]);

    useEffect(() => { if (busy) dialogRef.current.focus(); }, [busy]);

    const containFocus = (event) => {
        if (event.key !== 'Tab') return;
        const buttons = [...dialogRef.current.querySelectorAll('button:not([disabled])')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!first) { event.preventDefault(); dialogRef.current.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
            event.preventDefault(); first.focus();
        }
    };

    return (
        <dialog ref={dialogRef} tabIndex={-1} className="action-confirmation" aria-labelledby={titleId}
            aria-describedby={descriptionId} aria-busy={busy} onKeyDown={containFocus}
            onCancel={(event) => { event.preventDefault(); if (!busy) onDismiss(); }}>
            <button className="action-confirmation-close" type="button" aria-label="Close confirmation"
                disabled={busy} onClick={onDismiss}>×</button>
            <h2 id={titleId}>{title}</h2>
            <div id={descriptionId}>{children}</div>
            <div className="action-confirmation-actions">
                <button ref={cancelRef} type="button" disabled={busy} onClick={onDismiss}>{cancelLabel}</button>
                <button className="action-confirmation-submit" type="button" disabled={busy} onClick={onConfirm}>
                    {busy ? 'Working…' : confirmLabel}
                </button>
            </div>
        </dialog>
    );
}

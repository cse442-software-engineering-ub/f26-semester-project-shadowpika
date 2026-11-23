import React, { useRef, useState } from 'react';
import KaravanHeader from './components/KaravanHeader.jsx';
import './styles/karavan.css';
import './PasswordReset.css';

export default function PasswordReset() {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const heading = useRef(null);

    function advance(next) {
        setStep(next);
        requestAnimationFrame(() => heading.current?.focus());
    }
    function startOver() {
        setAnswer(''); setPassword(''); setConfirmation(''); setQuestion(''); setError(''); advance('email');
    }
    async function submit(event) {
        event.preventDefault();
        if (busy.current) return;
        setError('');
        if (step === 'email' && !email.trim()) { setError('Please enter a valid email address.'); return; }
        if (step === 'answer' && !answer.trim()) { setError('Please enter your security answer.'); return; }
        if (step === 'password' && !password.trim()) { setError('Please enter a new password.'); return; }
        if (step === 'password' && password !== confirmation) { setError('Passwords do not match.'); return; }
        const endpoint = { email: 'forgot_password.php', answer: 'verify_security_answer.php', password: 'reset_password.php' }[step];
        const body = { email: { email: email.trim() }, answer: { answer }, password: { password } }[step];
        busy.current = true; setPending(true);
        try {
            const response = await fetch(`./${endpoint}`, {
                method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                if (data.code === 'restart_required') startOver();
                setError(data.error || 'The request could not be completed. Please try again.');
                return;
            }
            if (step === 'email') {
                if (typeof data.question !== 'string' || !data.question.trim()) throw new Error('Missing question');
                setQuestion(data.question); advance('answer');
            } else if (step === 'answer') { setAnswer(''); advance('password'); }
            else { setPassword(''); setConfirmation(''); advance('done'); }
        } catch {
            setError('Could not connect. Please try again.');
        } finally { busy.current = false; setPending(false); }
    }

    return <div className="reset-page">
        <KaravanHeader />
        <main className="reset-card">
            <h1 ref={heading} tabIndex={-1}>Reset Password</h1>
            {step === 'done' ? <>
                <p role="status">Your password has been reset. Please log in.</p>
                <a href="./index.html">Back to Log In</a>
            </> : <form onSubmit={submit}>
                <p>{step === 'email' ? 'Enter your account email to find your security question.' : step === 'answer' ? 'Answer the question you chose when you registered.' : 'Choose a new password for your account.'}</p>
                {error && <p role="alert" className="reset-error">{error}</p>}
                <fieldset disabled={pending}>
                    {step === 'email' && <label>Email<input type="email" autoComplete="email" required maxLength={50} value={email} onChange={e => setEmail(e.target.value)} /></label>}
                    {step === 'answer' && <><p className="reset-question">{question}</p><label>Security answer<input required autoComplete="off" maxLength={100} value={answer} onChange={e => setAnswer(e.target.value)} /></label></>}
                    {step === 'password' && <>
                        <label>New password<input type="password" autoComplete="new-password" required maxLength={50} value={password} onChange={e => setPassword(e.target.value)} /></label>
                        <label>Confirm password<input type="password" autoComplete="new-password" required maxLength={50} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
                    </>}
                    <button type="submit" disabled={pending}>{pending ? 'Working…' : { email: 'Continue', answer: 'Verify answer', password: 'Reset Password' }[step]}</button>
                    {step !== 'email' && <button type="button" className="reset-secondary" onClick={startOver}>Start over</button>}
                </fieldset>
                <a href="./index.html">Back to Log In</a>
            </form>}
        </main>
    </div>;
}

import React, { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import './AuthGatekeeper.scss';

export const ApiKeySetup = () => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const { setGeminiApiKey } = useAppStore();

    const handleSave = async () => {
        const trimmed = key.trim();
        if (!trimmed.startsWith('AIza')) {
            setError('Invalid key format. Gemini API keys start with "AIza".');
            return;
        }
        const electron = (window as any).electron;
        if (electron?.auth?.saveApiKey) {
            await electron.auth.saveApiKey(trimmed);
        }
        setGeminiApiKey(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
    };

    return (
        <div className="auth-gatekeeper">
            <div className="glass-panel">
                <h1>Auralis</h1>
                <p>Enter your Gemini API key to get started.<br />
                   Your key is stored securely in the OS keychain.</p>
                <input
                    type="password"
                    placeholder="AIza..."
                    value={key}
                    onChange={(e) => { setKey(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    className="api-key-input"
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--neutral-20)',
                        background: 'var(--neutral-10)',
                        color: 'var(--neutral-90)',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        boxSizing: 'border-box',
                    }}
                />
                {error && (
                    <p style={{ color: 'var(--red-500)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        {error}
                    </p>
                )}
                <button onClick={handleSave} className="login-button" disabled={!key.trim()}>
                    Save &amp; Continue
                </button>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '1rem' }}>
                    Get your free API key at{' '}
                    <button
                        onClick={() => (window as any).electron?.openExternal?.('https://aistudio.google.com/app/apikey')}
                        style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
                    >
                        Google AI Studio
                    </button>
                </p>
            </div>
        </div>
    );
};

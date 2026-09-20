import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../context/AuthContext';
import { ShieldCheck, Mail, Phone, Lock } from 'lucide-react';

export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [mode, setMode] = useState<'login' | 'register' | 'otp'>('login');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();
  const { loginWithPhoneOtp, verifyPhoneOtp, loginWithEmail, signUpWithEmail, isConfigured } = useAuth();

  const resetState = () => {
    setMode('login');
    setOtp('');
    setPassword('');
    setSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginWithPhoneOtp(phone);
      if (res.success) {
        setMode('otp');
        showToast('Verification code dispatched via SMS/WhatsApp', 'info');
      } else {
        showToast(res.error || 'Failed to send OTP', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      showToast('Please enter the 6-digit OTP code', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyPhoneOtp(phone, otp);
      if (res.success) {
        showToast('Supabase Auth authenticated! Welcome to GizmoVault.', 'success');
        handleClose();
      } else {
        showToast(res.error || 'Invalid OTP code. Please retry.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Please enter your email address', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        const res = await signUpWithEmail(email, password, fullName, phone);
        if (res.success) {
          showToast('Account created successfully via Supabase Auth!', 'success');
          handleClose();
        } else {
          showToast(res.error || 'Registration failed', 'error');
        }
      } else {
        const res = await loginWithEmail(email, password);
        if (res.success) {
          showToast('Welcome back! Logged in via Supabase Auth.', 'success');
          handleClose();
        } else {
          showToast(res.error || 'Login failed. Please check credentials.', 'error');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        mode === 'otp'
          ? 'Verify Code'
          : mode === 'register'
          ? 'Create Vault Account'
          : 'Vault Sign In'
      }
    >
      {/* Supabase connection indicator badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
          padding: '6px 10px',
          background: 'rgba(0, 229, 255, 0.06)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem',
          color: 'var(--accent-cyan)',
        }}
      >
        <ShieldCheck size={14} />
        <span>
          {isConfigured
            ? 'Supabase Auth Protected (Active Cloud Sync)'
            : 'Supabase Auth Ready (Local Sandbox Mode)'}
        </span>
      </div>

      {mode !== 'otp' && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 16,
            gap: 8,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMethod('phone')}
            style={{
              flex: 1,
              borderBottom: method === 'phone' ? '2px solid var(--accent-cyan)' : 'none',
              borderRadius: 0,
              color: method === 'phone' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingBottom: 8,
              fontSize: '0.875rem',
            }}
          >
            <Phone size={14} /> Phone OTP
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMethod('email')}
            style={{
              flex: 1,
              borderBottom: method === 'email' ? '2px solid var(--accent-cyan)' : 'none',
              borderRadius: 0,
              color: method === 'email' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingBottom: 8,
              fontSize: '0.875rem',
            }}
          >
            <Mail size={14} /> Email & Password
          </button>
        </div>
      )}

      {/* PHONE AUTH */}
      {method === 'phone' && mode !== 'otp' && (
        <form onSubmit={handleSendPhoneOtp}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter your mobile phone number with country code for instant passwordless OTP login.
          </p>
          <Input
            label="Mobile Number (E.164 format)"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Button
            variant="primary"
            fullWidth
            size="lg"
            type="submit"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? 'Connecting...' : 'Send Verification OTP'}
          </Button>
        </form>
      )}

      {/* OTP VERIFICATION */}
      {mode === 'otp' && (
        <form onSubmit={handleVerifyPhoneOtp}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter the 6-digit OTP code sent to <strong>{phone}</strong>.
          </p>
          <Input
            label="Verification Code"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            helperText={isConfigured ? 'Check your SMS / WhatsApp' : 'Demo sandbox code: 123456'}
            required
            autoFocus
          />
          <Button
            variant="primary"
            fullWidth
            size="lg"
            type="submit"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? 'Verifying with Supabase...' : 'Verify & Enter Vault'}
          </Button>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode('login')}
              style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
            >
              ← Change phone number
            </button>
          </div>
        </form>
      )}

      {/* EMAIL AUTH */}
      {method === 'email' && mode !== 'otp' && (
        <form onSubmit={handleEmailAuth}>
          {mode === 'register' && (
            <div style={{ marginBottom: 12 }}>
              <Input
                label="Full Name"
                placeholder="Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <Input
              label="Email Address"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            variant="primary"
            fullWidth
            size="lg"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Authenticating...'
              : mode === 'register'
              ? 'Create Account via Supabase'
              : 'Sign In via Supabase'}
          </Button>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.8125rem' }}>
            {mode === 'login' ? (
              <span style={{ color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  style={{
                    color: 'var(--accent-cyan)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Register here
                </button>
              </span>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{
                    color: 'var(--accent-cyan)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};

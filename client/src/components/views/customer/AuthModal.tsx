import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useToast } from '../../ui/Toast';

export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'otp'>('login');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const { showToast } = useToast();

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setMode('otp');
    showToast('6-digit OTP sent via WhatsApp & SMS (Code: 123456)', 'info');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === '123456' || otp.length === 6) {
      showToast('Authentication successful! Welcome to GizmoVault.', 'success');
      onClose();
      setMode('login');
    } else {
      showToast('Please enter code 123456', 'error');
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={mode === 'login' ? 'Vault Login' : mode === 'register' ? 'Create Account' : 'Verify OTP'}
    >
      {mode === 'login' && (
        <form onSubmit={handleSendOtp}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter your mobile phone number to log in or register via instant OTP.
          </p>
          <Input
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Button variant="primary" fullWidth size="lg" type="submit" style={{ marginTop: 12 }}>
            Continue with OTP
          </Button>
        </form>
      )}

      {mode === 'otp' && (
        <form onSubmit={handleVerifyOtp}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter the 6-digit verification code sent to <strong>{phone}</strong>.
          </p>
          <Input
            label="Verification Code"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            helperText="Demo code: 123456"
            required
            autoFocus
          />
          <Button variant="primary" fullWidth size="lg" type="submit" style={{ marginTop: 12 }}>
            Verify & Enter Vault
          </Button>
        </form>
      )}
    </Modal>
  );
};

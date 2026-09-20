import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('GizmoVault Phase 1 — Brand and Design System Verification', () => {
  const cssPath = path.resolve(__dirname, 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  it('verifies primary Electric Cyan accent tokens exist in index.css', () => {
    expect(cssContent).toContain('--accent-cyan: #00e5ff');
    expect(cssContent).toContain('--cyan-glow:');
  });

  it('verifies luxury Imperial Gold accent tokens exist in index.css', () => {
    expect(cssContent).toContain('--accent-gold: #f59e0b');
    expect(cssContent).toContain('--gold-glow:');
  });

  it('verifies dark luxury background tokens and glassmorphism cards', () => {
    expect(cssContent).toContain('--bg-base: #080c14');
    expect(cssContent).toContain('--bg-surface: #101624');
    expect(cssContent).toContain('.card-glass');
    expect(cssContent).toContain('backdrop-filter: blur');
  });

  it('verifies mobile-first bottom navigation styling and safe-area insets', () => {
    expect(cssContent).toContain('.bottom-nav');
    expect(cssContent).toContain('safe-area-inset-bottom');
  });

  it('verifies button system variants (primary, gold, secondary, ghost, danger)', () => {
    expect(cssContent).toContain('.btn-primary');
    expect(cssContent).toContain('.btn-gold');
    expect(cssContent).toContain('.btn-secondary');
    expect(cssContent).toContain('.btn-ghost');
    expect(cssContent).toContain('.btn-danger');
  });

  it('verifies skeleton shimmer loader animation and spinner', () => {
    expect(cssContent).toContain('.skeleton');
    expect(cssContent).toContain('@keyframes shimmer');
    expect(cssContent).toContain('.spinner');
  });

  it('verifies toast notification container and animations', () => {
    expect(cssContent).toContain('.toast-container');
    expect(cssContent).toContain('.toast');
  });

  it('verifies vector logo and app icon file exists', () => {
    const logoSvgPath = path.resolve(__dirname, '../public/logo.svg');
    expect(fs.existsSync(logoSvgPath)).toBe(true);
    const logoSvgContent = fs.readFileSync(logoSvgPath, 'utf-8');
    expect(logoSvgContent).toContain('<svg');
    expect(logoSvgContent).toContain('#00e5ff');
  });
});

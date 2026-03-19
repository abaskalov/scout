export const WIDGET_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    color: #111827;
    line-height: 1.5;
    box-sizing: border-box;
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* FAB */
  .scout-fab {
    position: fixed;
    bottom: calc(24px + var(--safe-bottom));
    right: calc(24px + var(--safe-right));
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #3b82f6;
    color: #fff;
    border: none;
    cursor: pointer;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-size: 0;
    line-height: 0;
    padding: 0;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .scout-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
  }

  .scout-fab:active {
    transform: scale(0.96);
  }

  .scout-fab svg {
    width: 28px;
    height: 28px;
    fill: none;
    stroke: #fff;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .scout-fab.hidden {
    display: none;
  }

  /* Overlay (element picker) */
  .scout-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000000;
    cursor: crosshair;
    background: rgba(59, 130, 246, 0.05);
    touch-action: none;
  }

  .scout-overlay.hidden {
    display: none;
  }

  .scout-highlight {
    position: fixed;
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    pointer-events: none;
    z-index: 1000001;
    border-radius: 2px;
    transition: top 0.05s ease, left 0.05s ease, width 0.05s ease, height 0.05s ease;
  }

  .scout-highlight.hidden {
    display: none;
  }

  /* Panel */
  .scout-panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 1000002;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .scout-panel-backdrop.visible {
    opacity: 1;
  }

  .scout-panel-backdrop.hidden {
    display: none;
  }

  .scout-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    max-width: 100vw;
    background: #fff;
    z-index: 1000003;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.25s ease;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .scout-panel.visible {
    transform: translateX(0);
  }

  .scout-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .scout-panel-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .scout-panel-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: #6b7280;
    line-height: 0;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
  }

  .scout-panel-close:hover {
    color: #111827;
  }

  .scout-panel-close svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
  }

  .scout-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .scout-element-info {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .scout-element-info-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin-bottom: 4px;
    font-weight: 500;
  }

  .scout-element-info-value {
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    color: #3b82f6;
    word-break: break-all;
    margin-bottom: 8px;
  }

  .scout-element-info-value:last-child {
    margin-bottom: 0;
  }

  .scout-element-text {
    font-family: inherit;
    font-size: 13px;
    color: #374151;
    font-style: italic;
  }

  .scout-field {
    margin-bottom: 16px;
  }

  .scout-field label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
  }

  .scout-field label .scout-required {
    color: #ef4444;
  }

  .scout-field textarea {
    width: 100%;
    min-height: 100px;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 16px;
    font-family: inherit;
    resize: vertical;
    color: #111827;
    background: #fff;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .scout-field textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .scout-field textarea.error {
    border-color: #ef4444;
  }

  .scout-field .scout-char-count {
    font-size: 11px;
    color: #9ca3af;
    text-align: right;
    margin-top: 4px;
  }

  .scout-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    font-size: 13px;
    color: #374151;
    min-height: 44px;
  }

  .scout-checkbox input[type="checkbox"]:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Screenshot preview (professional pattern: show before sending) */
  .scout-screenshot-preview {
    margin-top: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    background: #f9fafb;
  }

  .scout-screenshot-preview.hidden {
    display: none;
  }

  .scout-screenshot-img {
    display: block;
    width: 100%;
    max-height: 160px;
    object-fit: cover;
    object-position: top left;
  }

  .scout-checkbox input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: #3b82f6;
    cursor: pointer;
    flex-shrink: 0;
  }

  .scout-panel-footer {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .scout-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.15s ease, opacity 0.15s ease;
    font-family: inherit;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .scout-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .scout-btn-primary {
    background: #3b82f6;
    color: #fff;
    flex: 1;
  }

  .scout-btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .scout-btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .scout-btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  /* User info bar (between header and body) */
  .scout-user-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .scout-user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .scout-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #3b82f6;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: 0.5px;
  }

  .scout-user-name {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scout-logout-btn {
    background: none;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
    touch-action: manipulation;
  }

  .scout-logout-btn:hover {
    background: #fee2e2;
    color: #dc2626;
    border-color: #fca5a5;
  }

  /* "Powered by Scout" badge (industry standard) */
  .scout-powered-by {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 20px;
    font-size: 11px;
    color: #9ca3af;
    border-top: 1px solid #f3f4f6;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  .scout-powered-by svg {
    color: #9ca3af;
  }

  /* Login form */
  .scout-login {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overscroll-behavior: contain;
  }

  .scout-login h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .scout-login p {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #6b7280;
  }

  .scout-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 16px;
    font-family: inherit;
    color: #111827;
    background: #fff;
    outline: none;
    transition: border-color 0.15s ease;
    min-height: 44px;
  }

  .scout-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .scout-login-error {
    color: #ef4444;
    font-size: 13px;
    margin: 0;
    min-height: 18px;
  }

  /* Toast */
  .scout-toast {
    position: fixed;
    bottom: calc(92px + var(--safe-bottom));
    right: calc(24px + var(--safe-right));
    background: #22c55e;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    z-index: 1000010;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .scout-toast.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .scout-toast-icon {
    width: 18px;
    height: 18px;
    margin-right: 8px;
    vertical-align: -3px;
    flex-shrink: 0;
  }

  .scout-toast.error {
    background: #ef4444;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  /* Spinner */
  .scout-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: scout-spin 0.6s linear infinite;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .scout-spinner-sm {
    width: 14px;
    height: 14px;
    border-color: rgba(59, 130, 246, 0.2);
    border-top-color: #3b82f6;
  }

  @keyframes scout-spin {
    to { transform: rotate(360deg); }
  }

  /* Progress status (step-by-step indicator during submission) */
  .scout-progress-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    margin-top: 12px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    font-size: 13px;
    color: #1d4ed8;
    animation: scout-fade-in 0.2s ease;
  }

  .scout-progress-status.hidden {
    display: none;
  }

  .scout-progress-warn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f59e0b;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  @keyframes scout-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ===== Mobile (max-width: 640px) ===== */
  @media (max-width: 640px) {
    /* FAB: smaller + tighter offset */
    .scout-fab {
      width: 48px;
      height: 48px;
      bottom: calc(16px + var(--safe-bottom));
      right: calc(16px + var(--safe-right));
    }

    .scout-fab svg {
      width: 24px;
      height: 24px;
    }

    /* Panel: full-screen overlay */
    .scout-panel {
      width: 100%;
      height: 100%;
      max-height: 100%;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .scout-panel-header {
      padding-top: calc(16px + var(--safe-top));
      padding-left: calc(20px + var(--safe-left));
      padding-right: calc(20px + var(--safe-right));
    }

    .scout-user-bar {
      padding-left: calc(20px + var(--safe-left));
      padding-right: calc(20px + var(--safe-right));
    }

    .scout-panel-body {
      padding-left: calc(20px + var(--safe-left));
      padding-right: calc(20px + var(--safe-right));
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }

    .scout-panel-footer {
      padding-bottom: calc(16px + var(--safe-bottom));
      padding-left: calc(20px + var(--safe-left));
      padding-right: calc(20px + var(--safe-right));
      flex-direction: column;
    }

    .scout-panel-footer .scout-btn {
      width: 100%;
      min-height: 48px;
      font-size: 16px;
    }

    .scout-panel-footer .scout-btn-secondary {
      flex: none;
    }

    /* Textarea taller on mobile */
    .scout-field textarea {
      min-height: 120px;
    }

    /* Inputs: prevent iOS zoom (font-size >= 16px already set), ensure touch targets */
    .scout-input {
      min-height: 48px;
      font-size: 16px;
    }

    /* Login form: use safe area */
    .scout-login {
      padding: 20px calc(20px + var(--safe-left)) 20px calc(20px + var(--safe-right));
    }

    .scout-login .scout-btn {
      min-height: 48px;
      font-size: 16px;
    }

    /* Checkboxes: larger touch targets */
    .scout-checkbox {
      min-height: 48px;
      padding: 4px 0;
    }

    .scout-checkbox input[type="checkbox"] {
      width: 24px;
      height: 24px;
    }

    /* Element picker: thicker highlight border on mobile */
    .scout-highlight {
      border-width: 3px;
    }

    /* Toast: centered on mobile */
    .scout-toast {
      right: calc(16px + var(--safe-right));
      left: calc(16px + var(--safe-left));
      bottom: calc(76px + var(--safe-bottom));
      text-align: center;
    }
  }
`;

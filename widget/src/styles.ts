export const WIDGET_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    color: #111827;
    line-height: 1.5;
    box-sizing: border-box;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* FAB */
  .scout-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
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
    font-size: 14px;
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
  }

  .scout-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    cursor: pointer;
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

  /* Login form */
  .scout-login {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    font-size: 14px;
    font-family: inherit;
    color: #111827;
    background: #fff;
    outline: none;
    transition: border-color 0.15s ease;
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
    bottom: 92px;
    right: 24px;
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
  }

  @keyframes scout-spin {
    to { transform: rotate(360deg); }
  }
`;

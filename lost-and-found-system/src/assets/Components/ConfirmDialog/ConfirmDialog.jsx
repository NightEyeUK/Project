import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import './confirm-dialog.css';

const ConfirmDialogContext = createContext(null);

function ConfirmDialog({ title, message, confirmText, cancelText, confirmVariant, onConfirm, onCancel }) {
  return (
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog">
        {title && <h3>{title}</h3>}
        {message && <p>{message}</p>}
        <div className="confirm-dialog-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn-primary ${confirmVariant === 'danger' ? 'danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialogProvider({ children }) {
  const [dialogState, setDialogState] = useState(null);

  const confirm = useCallback((options = {}) => {
    const {
      title = 'Are you sure?',
      message = '',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      variant = 'default',
    } = options;

    return new Promise((resolve) => {
      setDialogState({
        title,
        message,
        confirmText,
        cancelText,
        confirmVariant: variant,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(
    (result) => {
      setDialogState((current) => {
        current?.resolve(result);
        return null;
      });
    },
    []
  );

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {dialogState &&
        createPortal(
          <ConfirmDialog
            title={dialogState.title}
            message={dialogState.message}
            confirmText={dialogState.confirmText}
            cancelText={dialogState.cancelText}
            confirmVariant={dialogState.confirmVariant}
            onConfirm={() => handleClose(true)}
            onCancel={() => handleClose(false)}
          />,
          document.body
        )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
}


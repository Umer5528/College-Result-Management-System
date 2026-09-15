import React from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  );
}

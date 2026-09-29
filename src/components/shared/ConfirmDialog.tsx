import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-stone-600 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          className={danger ? 'bg-danger-600 hover:bg-danger-700 text-white border-none' : ''}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

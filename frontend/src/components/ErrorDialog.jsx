export default function ErrorDialog({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="error-dialog-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="error-dialog-title">
      <div className="error-dialog">
        <div className="error-dialog-header">
          <h2 id="error-dialog-title">Ошибка</h2>
          <button type="button" className="plain-button small" onClick={onClose}>Закрыть</button>
        </div>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>Окей</button>
        </div>
      </div>
    </div>
  );
}

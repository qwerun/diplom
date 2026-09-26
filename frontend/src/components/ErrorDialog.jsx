export default function ErrorDialog({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="error-dialog-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="error-dialog-title">
      <div className="error-dialog">
        <button type="button" className="error-dialog-close" onClick={onClose} aria-label="Закрыть">×</button>
        <div className="error-dialog-icon">!</div>
        <div>
          <p className="error-dialog-kicker">Не удалось выполнить действие</p>
          <h2 id="error-dialog-title">Проверьте данные</h2>
          <p className="error-dialog-message">{message}</p>
        </div>
        <button type="button" className="primary-button error-dialog-action" onClick={onClose}>Понятно</button>
      </div>
    </div>
  );
}

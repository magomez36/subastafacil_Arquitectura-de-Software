import { useCallback, useEffect, useState } from 'react';
import './BidForm.css';

const API_URL = 'http://localhost:3000/api/auctions';

function formatPrice(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value));
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function BidForm({ auction, onBidPlaced, token }) {
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentPrice = Number(auction.current_price);
  const minimum =
    Number(auction.bids_count) > 0
      ? currentPrice + Number(auction.min_increment)
      : Number(auction.starting_price);
  const isActive = auction.status === 'active';

  const loadBids = useCallback(async (signal) => {
    try {
      const response = await fetch(`${API_URL}/${auction.id}/bids`, { signal });
      const data = await response.json();
      if (response.ok) setBids(data.bids);
    } catch {
      // El historial es secundario: se ignoran errores de red.
    }
  }, [auction.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadBids(controller.signal);
    return () => controller.abort();
  }, [loadBids, auction.bids_count]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (value < minimum) {
      setError(`La oferta mínima es de ${formatPrice(minimum)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/${auction.id}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: value }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo registrar la oferta.');
      }

      setSuccess(`Oferta de ${formatPrice(data.bid.amount)} registrada.`);
      setAmount('');
      onBidPlaced(data.current_price);
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bid-box" aria-label="Ofertas">
      <h2>Realizar una oferta</h2>

      {!isActive && (
        <p className="bid-notice">Esta subasta no admite ofertas.</p>
      )}

      {isActive && !token && (
        <p className="bid-notice">Inicia sesión para ofertar.</p>
      )}

      {isActive && token && (
        <form className="bid-form" onSubmit={handleSubmit}>
          <label htmlFor="bid-amount">
            Tu oferta (mínimo {formatPrice(minimum)})
          </label>
          <div className="bid-row">
            <input
              id="bid-amount"
              type="number"
              step="0.01"
              min={minimum}
              placeholder={minimum.toFixed(2)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={submitting}
            />
            <button type="button" className="bid-suggest" onClick={() => setAmount(minimum.toFixed(2))}>
              Mínimo
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Ofertar'}
            </button>
          </div>
          {error && <p className="bid-error" role="alert">{error}</p>}
          {success && <p className="bid-success" role="status">{success}</p>}
        </form>
      )}

      <h3>Historial de ofertas</h3>
      {bids.length === 0 ? (
        <p className="bid-empty">Aún no hay ofertas.</p>
      ) : (
        <ul className="bid-history">
          {bids.map((bid) => (
            <li key={bid.id}>
              <span>
                <strong>{bid.bidder}</strong>
                <small>{formatDateTime(bid.created_at)}</small>
              </span>
              <b>{formatPrice(bid.amount)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default BidForm;

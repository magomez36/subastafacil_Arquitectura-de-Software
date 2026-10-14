
import { useEffect, useState } from 'react';
import './AuctionDetail.css';

const API_URL = 'http://localhost:3000/api/auctions';

function formatPrice(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return 'No disponible';

  return new Date(value).toLocaleString('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStatusLabel(status) {
  const labels = {
    active: 'Activa',
    closed: 'Cerrada',
    pending: 'Pendiente',
  };

  return labels[status] || status || 'No disponible';
}

function AuctionDetail({ auctionId, onBack }) {
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAuction() {
      setLoading(true);
      setError('');
      setAuction(null);
      setImageFailed(false);

      try {
        const response = await fetch(
          `${API_URL}/${encodeURIComponent(auctionId)}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'No se pudo cargar la subasta.'
          );
        }

        setAuction(data.auction);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Ocurrió un error inesperado.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAuction();

    return () => controller.abort();
  }, [auctionId]);

  return (
    <div className="detail-page">
      <header className="detail-navbar">
        <a
          className="detail-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onBack();
          }}
        >
          <span className="detail-brand-mark">S</span>
          SubastaFácil
        </a>

        <button className="detail-back-button" onClick={onBack}>
          ← Volver al catálogo
        </button>
      </header>

      <main className="detail-main">
        {loading && (
          <p className="detail-message" role="status">
            Cargando detalle de la subasta...
          </p>
        )}

        {!loading && error && (
          <section className="detail-message detail-error" role="alert">
            <h1>No se pudo cargar la subasta</h1>
            <p>{error}</p>
            <button onClick={onBack}>Volver al catálogo</button>
          </section>
        )}

        {!loading && !error && auction && (
          <>
            <button className="detail-breadcrumb" onClick={onBack}>
              ← Todas las subastas
            </button>

            <section className="detail-layout">
              <div className="detail-image-panel">
                {auction.image_url && !imageFailed ? (
                  <img
                    className="detail-image"
                    src={auction.image_url}
                    alt={auction.title}
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="detail-image-fallback">
                    <span aria-hidden="true">◇</span>
                    <p>Imagen no disponible</p>
                  </div>
                )}
                <span className="detail-category">
                  {auction.category}
                </span>
              </div>

              <div className="detail-information">
                <div className="detail-status-row">
                  <span className={`detail-status status-${auction.status}`}>
                    {getStatusLabel(auction.status)}
                  </span>
                  <span className="detail-id">Subasta #{auction.id}</span>
                </div>

                <p className="detail-seller">
                  Publicada por <strong>{auction.seller}</strong>
                </p>

                <h1>{auction.title}</h1>

                <p className="detail-description">
                  {auction.description || 'Esta subasta no tiene descripción.'}
                </p>

                <div className="detail-price-card">
                  <span>Precio actual</span>
                  <strong>{formatPrice(auction.current_price)}</strong>
                  <p>
                    Precio inicial: {formatPrice(auction.starting_price)}
                  </p>
                </div>

                <div className="detail-stats">
                  <div>
                    <span>Ofertas recibidas</span>
                    <strong>{auction.bids_count}</strong>
                  </div>
                  <div>
                    <span>Incremento mínimo</span>
                    <strong>{formatPrice(auction.min_increment)}</strong>
                  </div>
                </div>

                <div className="detail-dates">
                  <div>
                    <span>Inicio de la subasta</span>
                    <p>{formatDate(auction.starts_at)}</p>
                  </div>
                  <div>
                    <span>Finalización</span>
                    <p>{formatDate(auction.ends_at)}</p>
                  </div>
                </div>

                <p className="detail-note">
                  La participación y el envío de ofertas se implementarán
                  en la siguiente etapa.
                </p>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="detail-footer">
        SubastaFácil · Proyecto académico de Arquitectura de Software
      </footer>
    </div>
  );
}

export default AuctionDetail;

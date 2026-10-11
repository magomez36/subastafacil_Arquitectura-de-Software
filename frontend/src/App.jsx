
import { useEffect, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000/api/auctions';

function formatPrice(price) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(price));
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function App() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAuctions() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error('No se pudieron cargar las subastas.');
        }

        const data = await response.json();
        setAuctions(data.auctions);
      } catch (err) {
        setError(
          'No se pudieron cargar las subastas. Comprueba que el backend esté ejecutándose.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadAuctions();
  }, []);

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="/">
          <span className="brand-mark">S</span>
          SubastaFácil
        </a>

        <nav className="nav-links">
          <a href="#subastas">Explorar subastas</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>

        <button className="login-button" disabled>
          Iniciar sesión
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">COMPRA · OFERTA · GANA</span>
            <h1>Encuentra algo que te encante.</h1>
            <p>
              Descubre productos, haz tu mejor oferta y encuentra
              oportunidades en SubastaFácil.
            </p>
            <a className="primary-button" href="#subastas">
              Explorar subastas <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <span className="decoration-circle circle-one" />
            <span className="decoration-circle circle-two" />
            <span className="decoration-card">Tu próxima oportunidad</span>
            <span className="decoration-symbol">↗</span>
          </div>
        </section>

        <section className="auction-section" id="subastas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ELIGE TU PRÓXIMO HALLAZGO</span>
              <h2>Subastas disponibles</h2>
              <p>Productos que esperan tu mejor oferta.</p>
            </div>
            <span className="auction-count">
              {auctions.length} subastas
            </span>
          </div>

          {loading && <p className="status-message">Cargando subastas...</p>}

          {error && <p className="error-message">{error}</p>}

          {!loading && !error && auctions.length === 0 && (
            <p className="status-message">
              No hay subastas activas en este momento.
            </p>
          )}

          {!loading && !error && auctions.length > 0 && (
            <div className="auction-grid">
              {auctions.map((auction) => (
                <article className="auction-card" key={auction.id}>
                  <div className="auction-image-wrapper">
                    <img
                      className="auction-image"
                      src={auction.image_url}
                      alt={auction.title}
                      loading="lazy"
                    />
                    <span className="category-tag">{auction.category}</span>
                  </div>

                  <div className="auction-info">
                    <p className="seller">Publicado por {auction.seller}</p>
                    <h3>{auction.title}</h3>
                    <p className="description">{auction.description}</p>

                    <div className="price-row">
                      <div>
                        <span className="muted-label">Precio actual</span>
                        <strong className="current-price">
                          {formatPrice(auction.current_price)}
                        </strong>
                      </div>
                      <div className="bid-count">
                        <strong>{auction.bids_count}</strong>
                        <span>ofertas</span>
                      </div>
                    </div>

                    <div className="card-footer">
                      <span>
                        Cierra el {formatDate(auction.ends_at)}
                      </span>
                      <button
                        className="details-button"
                        disabled
                        title="El detalle de la subasta se implementará después"
                      >
                        Ver subasta <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="how-section" id="como-funciona">
          <span className="eyebrow">ASÍ DE FÁCIL</span>
          <h2>Tu próxima oportunidad, en tres pasos.</h2>

          <div className="steps-grid">
            <article>
              <span className="step-number">01</span>
              <h3>Descubre</h3>
              <p>Explora productos y encuentra aquello que buscas.</p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h3>Ofrece</h3>
              <p>Participa en la subasta con una oferta competitiva.</p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h3>Gana</h3>
              <p>Si terminas con la oferta más alta, puedes ganar.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="/">
          <span className="brand-mark">S</span>
          SubastaFácil
        </a>
        <p>Proyecto académico · Arquitectura de Software</p>
      </footer>
    </div>
  );
}

export default App;

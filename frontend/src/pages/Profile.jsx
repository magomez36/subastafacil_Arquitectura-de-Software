import { useEffect, useState } from 'react';
import './Profile.css';

const API_URL = 'http://localhost:3000/api/profile';

const TABS = [
  { key: 'bids', label: 'Mis ofertas', path: '/bids', field: 'bids' },
  { key: 'auctions', label: 'Mis subastas', path: '/auctions', field: 'auctions' },
  { key: 'won', label: 'Ganadas', path: '/won', field: 'auctions' },
];

const EMPTY_TEXT = {
  bids: 'Todavía no has realizado ofertas.',
  auctions: 'Todavía no has publicado subastas.',
  won: 'Aún no has ganado ninguna subasta.',
};

const STATUS_LABELS = {
  active: 'Activa',
  closed: 'Finalizada',
  scheduled: 'Programada',
  cancelled: 'Cancelada',
};

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

async function fetchProfile(path, token, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo cargar la información');
  }

  return data;
}

function Profile({ token, user, onBack, onOpenAuction }) {
  const [activeTab, setActiveTab] = useState('bids');
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [listError, setListError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetchProfile('', token, controller.signal)
      .then((data) => setProfile(data))
      .catch((err) => {
        if (err.name !== 'AbortError') setProfileError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProfile(false);
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const tab = TABS.find((item) => item.key === activeTab);

    fetchProfile(tab.path, token, controller.signal)
      .then((data) => {
        setItems(data[tab.field] || []);
        setListError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setItems([]);
          setListError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingList(false);
      });

    return () => controller.abort();
  }, [activeTab, token]);

  function changeTab(key) {
    if (key === activeTab) return;
    setLoadingList(true);
    setListError('');
    setActiveTab(key);
  }

  const info = profile?.user || user;
  const stats = profile?.stats;
  const statCards = [
    { label: 'Subastas publicadas', value: stats?.auctions_published },
    { label: 'Ofertas realizadas', value: stats?.bids_made },
    { label: 'Subastas ganadas', value: stats?.auctions_won },
  ];

  function renderItem(item) {
    const auctionId = item.auction_id ?? item.id;

    if (activeTab === 'bids') {
      return (
        <li key={item.id} className="profile-item">
          <div className="profile-item-main">
            <h3>{item.title}</h3>
            <p>Ofertaste el {formatDate(item.created_at)}</p>
          </div>
          <div className="profile-item-data">
            <span>Mi oferta <strong>{formatPrice(item.my_amount)}</strong></span>
            <span>Precio actual <strong>{formatPrice(item.current_price)}</strong></span>
          </div>
          <div className="profile-item-tags">
            <span className={`profile-badge ${item.is_winning ? 'win' : 'lose'}`}>
              {item.is_winning ? 'Vas ganando' : 'Superada'}
            </span>
            <span className={`profile-badge ${item.auction_status}`}>
              {STATUS_LABELS[item.auction_status] || item.auction_status}
            </span>
          </div>
          <button type="button" onClick={() => onOpenAuction(auctionId)}>Ver subasta</button>
        </li>
      );
    }

    if (activeTab === 'auctions') {
      return (
        <li key={item.id} className="profile-item">
          <div className="profile-item-main">
            <h3>{item.title}</h3>
            <p>Termina el {formatDate(item.ends_at)}</p>
          </div>
          <div className="profile-item-data">
            <span>Precio actual <strong>{formatPrice(item.current_price)}</strong></span>
            <span>Ofertas <strong>{item.bids_count}</strong></span>
          </div>
          <div className="profile-item-tags">
            <span className={`profile-badge ${item.status}`}>
              {STATUS_LABELS[item.status] || item.status}
            </span>
          </div>
          <button type="button" onClick={() => onOpenAuction(auctionId)}>Ver subasta</button>
        </li>
      );
    }

    return (
      <li key={item.id} className="profile-item">
        <div className="profile-item-main">
          <h3>{item.title}</h3>
          <p>Finalizó el {formatDate(item.ends_at)} · Vendedor: {item.seller}</p>
        </div>
        <div className="profile-item-data">
          <span>Oferta ganadora <strong>{formatPrice(item.winning_amount)}</strong></span>
        </div>
        <div className="profile-item-tags">
          <span className="profile-badge win">Ganada</span>
        </div>
        <button type="button" onClick={() => onOpenAuction(auctionId)}>Ver subasta</button>
      </li>
    );
  }

  return (
    <main className="profile-page">
      <button type="button" className="profile-back" onClick={onBack}>
        ← Volver
      </button>

      <header className="profile-header">
        <span className="profile-eyebrow">MI PERFIL</span>
        <h1>{info?.full_name || 'Mi perfil'}</h1>
        <p>
          {info?.email}
          {info?.created_at && ` · Miembro desde ${formatDate(info.created_at)}`}
        </p>
      </header>

      {profileError && <p className="profile-error">{profileError}</p>}

      <section className="profile-stats">
        {statCards.map((card) => (
          <article key={card.label} className="profile-stat">
            <strong>{loadingProfile ? '…' : (card.value ?? '-')}</strong>
            <span>{card.label}</span>
          </article>
        ))}
      </section>

      <div className="profile-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'selected' : ''}
            onClick={() => changeTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loadingList && <p className="profile-state">Cargando información...</p>}
      {!loadingList && listError && <p className="profile-error">{listError}</p>}
      {!loadingList && !listError && items.length === 0 && (
        <p className="profile-state">{EMPTY_TEXT[activeTab]}</p>
      )}
      {!loadingList && !listError && items.length > 0 && (
        <ul className="profile-list">{items.map(renderItem)}</ul>
      )}
    </main>
  );
}

export default Profile;

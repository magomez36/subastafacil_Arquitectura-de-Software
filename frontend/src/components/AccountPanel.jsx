
import { useEffect, useState } from 'react';
import './AccountPanel.css';

const API_AUTH = 'http://localhost:3000/api/auth';
const API_AUCTIONS = 'http://localhost:3000/api/auctions';
const API_CATEGORIES = 'http://localhost:3000/api/categories';

function localDateTime(offsetHours = 1) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function AccountPanel({
  token,
  user,
  onClose,
  onAuthSuccess,
  onLogout,
  onAuctionCreated,
}) {
  const [mode, setMode] = useState(token ? 'publish' : 'login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [auction, setAuction] = useState({
    title: '',
    description: '',
    image_url: '',
    category_id: '',
    starting_price: '',
    min_increment: '1',
    starts_at: localDateTime(0),
    ends_at: localDateTime(24),
  });

  useEffect(() => {
    setMode(token ? 'publish' : 'login');
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await fetch(API_CATEGORIES);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'No se pudieron cargar las categorías.'
          );
        }

        // Admite respuestas en forma de array o de objeto con categories.
        const list = Array.isArray(data)
          ? data
          : data.categories;

        if (!Array.isArray(list)) {
          throw new Error('El formato de categorías no es válido.');
        }

        if (!cancelled) {
          setCategories(list);
          setCategoriesError('');
        }
      } catch (err) {
        if (!cancelled) {
          setCategoriesError(err.message);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function updateAuction(event) {
    const { name, value } = event.target;

    setAuction((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAuth(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    try {
      const endpoint =
        mode === 'register' ? 'register' : 'login';

      const body =
        mode === 'register'
          ? { full_name: fullName, email, password }
          : { email, password };

      const response = await fetch(`${API_AUTH}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo completar la solicitud.');
      }

      onAuthSuccess(data.token, data.user);
      setPassword('');
      setMessage(data.message || 'Sesión iniciada correctamente.');
      setMode('publish');
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    try {
      const response = await fetch(API_AUCTIONS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...auction,
          category_id: Number(auction.category_id),
          starting_price: Number(auction.starting_price),
          min_increment: Number(auction.min_increment),
          image_url: auction.image_url.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo publicar la subasta.');
      }

      setMessage(`¡Subasta "${data.auction.title}" publicada correctamente!`);
      onAuctionCreated();
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="account-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="account-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button
          className="account-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          ×
        </button>

        <span className="account-eyebrow">SUBASTAFÁCIL</span>

        {!token ? (
          <>
            <h2 id="account-title">
              {mode === 'register'
                ? 'Crea tu cuenta'
                : 'Bienvenido de nuevo'}
            </h2>

            <p className="account-intro">
              {mode === 'register'
                ? 'Regístrate para publicar tus productos.'
                : 'Inicia sesión para publicar una subasta.'}
            </p>

            <div className="account-tabs">
              <button
                type="button"
                className={mode === 'login' ? 'selected' : ''}
                onClick={() => {
                  setMode('login');
                  setError('');
                  setMessage('');
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'selected' : ''}
                onClick={() => {
                  setMode('register');
                  setError('');
                  setMessage('');
                }}
              >
                Registrarme
              </button>
            </div>

            <form className="account-form" onSubmit={handleAuth}>
              {mode === 'register' && (
                <label>
                  Nombre completo
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label>
                Correo electrónico
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={255}
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={72}
                  autoComplete={
                    mode === 'register' ? 'new-password' : 'current-password'
                  }
                  required
                />
                {mode === 'register' && (
                  <small>Utiliza entre 8 y 72 caracteres.</small>
                )}
              </label>

              {error && <p className="account-error" role="alert">{error}</p>}
              {message && <p className="account-success" role="status">{message}</p>}

              <button className="account-submit" disabled={saving}>
                {saving
                  ? 'Procesando...'
                  : mode === 'register'
                    ? 'Crear cuenta'
                    : 'Iniciar sesión'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 id="account-title">Publicar una subasta</h2>
            <p className="account-intro">
              Sesión de <strong>{user?.full_name || user?.email}</strong>
            </p>

            <button
              type="button"
              className="account-logout"
              onClick={onLogout}
            >
              Cerrar sesión
            </button>

            <form className="account-form" onSubmit={handlePublish}>
              <label>
                Título del producto
                <input
                  name="title"
                  value={auction.title}
                  onChange={updateAuction}
                  maxLength={160}
                  required
                />
              </label>

              <label>
                Descripción
                <textarea
                  name="description"
                  value={auction.description}
                  onChange={updateAuction}
                  rows={3}
                  required
                />
              </label>

              <label>
                URL de la imagen (opcional)
                <input
                  type="url"
                  name="image_url"
                  value={auction.image_url}
                  onChange={updateAuction}
                  placeholder="https://ejemplo.com/producto.jpg"
                />
              </label>

              <label>
                Categoría
                <select
                  name="category_id"
                  value={auction.category_id}
                  onChange={updateAuction}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              {categoriesError && (
                <p className="account-error" role="alert">
                  {categoriesError}
                </p>
              )}

              <div className="account-two-columns">
                <label>
                  Precio inicial (USD)
                  <input
                    type="number"
                    name="starting_price"
                    value={auction.starting_price}
                    onChange={updateAuction}
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Incremento mínimo (USD)
                  <input
                    type="number"
                    name="min_increment"
                    value={auction.min_increment}
                    onChange={updateAuction}
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    required
                  />
                </label>
              </div>

              <div className="account-two-columns">
                <label>
                  Fecha de inicio
                  <input
                    type="datetime-local"
                    name="starts_at"
                    value={auction.starts_at}
                    onChange={updateAuction}
                    required
                  />
                </label>

                <label>
                  Fecha de finalización
                  <input
                    type="datetime-local"
                    name="ends_at"
                    value={auction.ends_at}
                    onChange={updateAuction}
                    required
                  />
                </label>
              </div>

              {error && <p className="account-error" role="alert">{error}</p>}
              {message && <p className="account-success" role="status">{message}</p>}

              <button
                className="account-submit"
                disabled={saving || categories.length === 0}
              >
                {saving ? 'Publicando...' : 'Publicar subasta'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default AccountPanel;
3
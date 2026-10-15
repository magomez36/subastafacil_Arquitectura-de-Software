
import { useEffect, useRef, useState } from 'react';
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
  const imageInputRef = useRef(null);
  const [productImages, setProductImages] = useState([]);
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

  function handleImageFile(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    const remaining = Math.max(0, 5 - productImages.length);
    if (files.length > remaining) {
      setError('Puedes agregar hasta 5 fotos por subasta.');
      return;
    }
    const oversized = files.find((file) => file.size > 2 * 1024 * 1024);
    if (oversized) {
      setError('Cada foto puede pesar hasta 2 MB.');
      return;
    }
    const unsupported = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (unsupported) {
      setError('Las fotos deben ser PNG, JPG o WebP.');
      return;
    }
    const totalBytes = [...productImages.map((item) => item.size), ...files.map((file) => file.size)]
      .reduce((sum, size) => sum + size, 0);
    if (totalBytes > 10 * 1024 * 1024) {
      setError('El total de las fotos no puede superar 10 MB.');
      return;
    }
    Promise.all(files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        name: file.name,
        size: file.size,
        dataUrl: String(reader.result),
        status: 'checking',
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).then((items) => setProductImages((current) => [...current, ...items]))
      .catch(() => setError('No se pudieron leer una o más fotos.'));
  }

  function updateProductImage(id, changes) {
    setProductImages((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
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
    if (!productImages.length || productImages.some((item) => item.status !== 'ready')) {
      setError('Agrega al menos una foto y espera a que todas las vistas previas estén listas.');
      return;
    }
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
          starts_at: new Date(auction.starts_at).toISOString(),
          ends_at: new Date(auction.ends_at).toISOString(),
          category_id: Number(auction.category_id),
          starting_price: Number(auction.starting_price),
          min_increment: Number(auction.min_increment),
          image_urls: productImages.map((item) => item.dataUrl),
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
                Fotos del producto <span aria-hidden="true">· obligatorias</span>
                <small>Agrega de 1 a 5 fotos. PNG, JPG o WebP; máximo 2 MB por foto.</small>
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleImageFile}
                  aria-label="Subir fotos del producto"
                  aria-required="true"
                />
              </label>

              {productImages.length > 0 && (
                <div className="product-image-gallery" aria-label="Fotos seleccionadas">
                  {productImages.map((item, index) => (
                    <div className="product-image-card" key={item.id}>
                      <img
                        src={item.dataUrl}
                        alt={`Vista previa ${index + 1}: ${item.name}`}
                        onLoad={() => updateProductImage(item.id, { status: 'ready' })}
                        onError={() => updateProductImage(item.id, { status: 'invalid' })}
                      />
                      <span>{index === 0 ? 'Portada' : `Foto ${index + 1}`}</span>
                      {item.status === 'checking' && <small>Preparando vista previa…</small>}
                      {item.status === 'invalid' && <small className="image-invalid">No se pudo leer esta foto. Quítala y selecciona otra.</small>}
                      <div className="product-image-actions">
                        {index > 0 && <button type="button" onClick={() => setProductImages((items) => [item, ...items.filter((photo) => photo.id !== item.id)])}>Usar de portada</button>}
                        <button type="button" aria-label={`Quitar ${item.name}`} onClick={() => setProductImages((items) => items.filter((photo) => photo.id !== item.id))}>Quitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                disabled={saving || categories.length === 0 || productImages.length === 0 || productImages.length > 5 || productImages.some((item) => item.status !== 'ready')}
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

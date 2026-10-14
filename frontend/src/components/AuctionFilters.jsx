import { useEffect, useRef, useState } from 'react'
import './AuctionFilters.css'

export const DEFAULT_FILTERS = {
  q: '',
  category_id: '',
  min_price: '',
  max_price: '',
  sort: 'ends_asc',
  ending_soon: false,
}

const SORT_OPTIONS = [
  { value: 'ends_asc', label: 'Cierran primero' },
  { value: 'ends_desc', label: 'Cierran al final' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'bids_desc', label: 'Más pujas' },
  { value: 'newest', label: 'Más recientes' },
]

// Devuelve el querystring (sin "?") omitiendo valores vacíos.
export function buildAuctionQuery(filters = {}) {
  const params = new URLSearchParams()
  const q = String(filters.q ?? '').trim()
  if (q) params.set('q', q)
  if (filters.category_id !== '' && filters.category_id != null) {
    params.set('category_id', String(filters.category_id))
  }
  if (filters.min_price !== '' && filters.min_price != null) {
    params.set('min_price', String(filters.min_price))
  }
  if (filters.max_price !== '' && filters.max_price != null) {
    params.set('max_price', String(filters.max_price))
  }
  if (filters.sort && filters.sort !== 'ends_asc') params.set('sort', filters.sort)
  if (filters.ending_soon === true || filters.ending_soon === '1') {
    params.set('ending_soon', '1')
  }
  return params.toString()
}

function AuctionFilters({ filters, categories = [], onChange, onReset }) {
  const [search, setSearch] = useState(filters.q ?? '')
  const timer = useRef(null)
  const latest = useRef({ filters, onChange })

  useEffect(() => {
    latest.current = { filters, onChange }
  })

  // Sincroniza el texto si el padre cambia q (p. ej. al limpiar).
  useEffect(() => {
    setSearch(filters.q ?? '')
  }, [filters.q])

  useEffect(() => () => clearTimeout(timer.current), [])

  const update = (patch) => onChange({ ...filters, ...patch })

  const handleSearch = (event) => {
    const value = event.target.value
    setSearch(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const { filters: current, onChange: emit } = latest.current
      if (value !== (current.q ?? '')) emit({ ...current, q: value })
    }, 400)
  }

  const handleReset = () => {
    clearTimeout(timer.current)
    setSearch('')
    onReset()
  }

  return (
    <form className="auction-filters" onSubmit={(event) => event.preventDefault()}>
      <label className="filter-field filter-search">
        <span>Buscar</span>
        <input
          type="search"
          value={search}
          onChange={handleSearch}
          placeholder="Título o descripción"
          maxLength={100}
        />
      </label>

      <label className="filter-field">
        <span>Categoría</span>
        <select
          value={filters.category_id ?? ''}
          onChange={(event) => update({ category_id: event.target.value })}
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <div className="filter-field filter-price">
        <span>Precio</span>
        <div className="filter-price-range">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="Mín"
            aria-label="Precio mínimo"
            value={filters.min_price ?? ''}
            onChange={(event) => update({ min_price: event.target.value })}
          />
          <span aria-hidden="true">–</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="Máx"
            aria-label="Precio máximo"
            value={filters.max_price ?? ''}
            onChange={(event) => update({ max_price: event.target.value })}
          />
        </div>
      </div>

      <label className="filter-field">
        <span>Ordenar por</span>
        <select
          value={filters.sort || 'ends_asc'}
          onChange={(event) => update({ sort: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-check">
        <input
          type="checkbox"
          checked={Boolean(filters.ending_soon)}
          onChange={(event) => update({ ending_soon: event.target.checked })}
        />
        <span>Cierran pronto</span>
      </label>

      <button type="button" className="filter-reset" onClick={handleReset}>
        Limpiar filtros
      </button>
    </form>
  )
}

export default AuctionFilters

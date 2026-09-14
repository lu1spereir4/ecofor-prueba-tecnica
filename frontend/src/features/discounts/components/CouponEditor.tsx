import type { CouponEditorView } from '../models';
import type { CouponChange, CouponType } from '../types';

interface Props {
  coupon: CouponEditorView;
  disabled: boolean;
  types: { value: string; label: string }[];
  products: { value: string; label: string }[];
  onChange: (id: number, changes: CouponChange) => void;
  onRemove: (id: number) => void;
}

export function CouponEditor({ coupon, disabled, types, products, onChange, onRemove }: Props) {
  const prefix = `coupon-${coupon.id}`;
  return (
    <fieldset className="coupon-editor" disabled={disabled}>
      <legend>Cupón {coupon.position}</legend>
      <div className="coupon-fields">
        <label>
          Código
          <input
            value={coupon.code}
            maxLength={512}
            placeholder="Ej. PROMO10"
            aria-invalid={!!coupon.errors.code}
            aria-describedby={`${prefix}-code-error`}
            onChange={(event) => onChange(coupon.id, { code: event.target.value })}
          />
          <span id={`${prefix}-code-error`} className="field-error">
            {coupon.errors.code}
          </span>
        </label>
        <label>
          Tipo
          <select
            value={coupon.type}
            onChange={(event) => onChange(coupon.id, { type: event.target.value as CouponType })}
          >
            {types.map((type) => (
              <option value={type.value} key={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        {!coupon.bundle && (
          <label>
            {coupon.valueLabel}
            <input
              value={coupon.value}
              inputMode="decimal"
              maxLength={1000}
              aria-invalid={!!coupon.errors.value}
              aria-describedby={`${prefix}-value-error`}
              onChange={(event) => onChange(coupon.id, { value: event.target.value })}
            />
            <span id={`${prefix}-value-error`} className="field-error">
              {coupon.errors.value}
            </span>
          </label>
        )}
        {coupon.bundle && (
          <>
            <label>
              Producto de la promoción
              <select
                value={coupon.sku}
                aria-invalid={!!coupon.errors.sku}
                aria-describedby={`${prefix}-sku-error`}
                onChange={(event) => onChange(coupon.id, { sku: event.target.value })}
              >
                <option value="">Seleccionar producto</option>
                {products.map((product) => (
                  <option key={product.value} value={product.value}>
                    {product.label}
                  </option>
                ))}
              </select>
              <span id={`${prefix}-sku-error`} className="field-error">
                {coupon.errors.sku}
              </span>
            </label>
            <label>
              Lleva (N)
              <input
                type="number"
                min="1"
                max="2147483647"
                step="1"
                value={coupon.n}
                aria-invalid={!!coupon.errors.n}
                aria-describedby={`${prefix}-n-error`}
                onChange={(event) => onChange(coupon.id, { n: event.target.value })}
              />
              <span id={`${prefix}-n-error`} className="field-error">
                {coupon.errors.n}
              </span>
            </label>
            <label>
              Paga (M)
              <input
                type="number"
                min="0"
                max="2147483647"
                step="1"
                value={coupon.m}
                aria-invalid={!!coupon.errors.m}
                aria-describedby={`${prefix}-m-error`}
                onChange={(event) => onChange(coupon.id, { m: event.target.value })}
              />
              <span id={`${prefix}-m-error`} className="field-error">
                {coupon.errors.m}
              </span>
            </label>
          </>
        )}
        <label>
          Monto mínimo del pedido (opcional)
          <input
            value={coupon.minAmount}
            inputMode="decimal"
            maxLength={1000}
            placeholder="Sin mínimo"
            aria-invalid={!!coupon.errors.minAmount}
            aria-describedby={`${prefix}-min-error`}
            onChange={(event) => onChange(coupon.id, { minAmount: event.target.value })}
          />
          <span id={`${prefix}-min-error`} className="field-error">
            {coupon.errors.minAmount}
          </span>
        </label>
      </div>
      <div className="coupon-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={coupon.stackable}
            onChange={(event) => onChange(coupon.id, { stackable: event.target.checked })}
          />
          Acumulable con otros cupones
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={coupon.allSkus}
            onChange={(event) => onChange(coupon.id, { allSkus: event.target.checked })}
          />
          Sin restricción adicional de productos
        </label>
      </div>
      {!coupon.allSkus && (
        <div className="coupon-skus">
          <label>
            Productos elegibles
            <select
              multiple
              value={coupon.applicableSkus}
              aria-describedby={`${prefix}-skus-help`}
              onChange={(event) =>
                onChange(coupon.id, {
                  applicableSkus: Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                })
              }
            >
              {products.map((product) => (
                <option key={product.value} value={product.value}>
                  {product.label}
                </option>
              ))}
            </select>
          </label>
          <small id={`${prefix}-skus-help`}>
            Usa Ctrl o Cmd para seleccionar varios. Sin selección, el cupón no aplica a ningún
            producto.
          </small>
        </div>
      )}
      <button
        type="button"
        aria-label={`Quitar cupón ${coupon.position}`}
        onClick={() => onRemove(coupon.id)}
      >
        Quitar cupón
      </button>
    </fieldset>
  );
}

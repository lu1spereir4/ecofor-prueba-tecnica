import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';
import type { CouponEditorView, DiscountResultView } from '../models';
import type { CouponChange } from '../types';
import { CouponEditor } from './CouponEditor';
import { DiscountPreview } from './DiscountPreview';

interface Props {
  editors: CouponEditorView[];
  products: { value: string; label: string }[];
  types: { value: string; label: string }[];
  count: string;
  limitReached: boolean;
  blocked: boolean;
  pending: boolean;
  limitMessage: string;
  error: ErrorNotice | null;
  formError: string;
  result: DiscountResultView | null;
  onAdd: () => void;
  onChange: (id: number, changes: CouponChange) => void;
  onRemove: (id: number) => void;
  onSimulate: () => void;
}

export function Discounts(props: Props) {
  return (
    <section
      className="panel discounts"
      aria-labelledby="discounts-title"
      id="order-discounts"
      tabIndex={-1}
    >
      <h2 id="discounts-title">Descuentos del pedido</h2>
      <p>
        Compara cupones y calcula la combinación con mayor ahorro. Esta simulación no modifica el
        pedido.
      </p>
      <p className="help-text">
        Los descuentos y mínimos se calculan sobre el monto original. Un cupón no acumulable compite
        por separado.
      </p>
      {props.limitMessage && <p className="notice notice-warning">{props.limitMessage}</p>}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          props.onSimulate();
        }}
        aria-busy={props.pending}
      >
        <div className="list-toolbar">
          <p>{props.count}</p>
          <button
            type="button"
            disabled={props.blocked || props.limitReached}
            onClick={props.onAdd}
          >
            Agregar cupón
          </button>
        </div>
        {props.editors.map((coupon) => (
          <CouponEditor
            key={coupon.id}
            coupon={coupon}
            products={props.products}
            types={props.types}
            disabled={props.blocked}
            onChange={props.onChange}
            onRemove={props.onRemove}
          />
        ))}
        {!props.editors.length && (
          <p className="help-text">Agrega un cupón de porcentaje, monto fijo o N por M.</p>
        )}
        {props.formError && (
          <p role="alert" className="field-error">
            {props.formError}
          </p>
        )}
        <RequestError error={props.error} />
        <button className="button-primary" type="submit" disabled={props.blocked || props.pending}>
          {props.pending ? 'Calculando descuentos…' : 'Calcular mejor descuento'}
        </button>
      </form>
      {props.result && <DiscountPreview result={props.result} />}
    </section>
  );
}

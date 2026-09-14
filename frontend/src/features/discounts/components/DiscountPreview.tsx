import type { DiscountResultView } from '../models';

export function DiscountPreview({ result }: { result: DiscountResultView }) {
  return (
    <section className="discount-result" aria-labelledby="discount-result-title">
      <h3 id="discount-result-title">Resultado de la simulación</h3>
      <p role="status">
        Cupones seleccionados: <strong>{result.coupons}</strong>
      </p>
      <dl className="discount-totals">
        <dt>Subtotal original</dt>
        <dd>{result.subtotal}</dd>
        <dt>Descuento total</dt>
        <dd>{result.discount}</dd>
        <dt>Total con descuento</dt>
        <dd>
          <strong>{result.total}</strong>
        </dd>
      </dl>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Descuentos por ítem</caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Cantidad</th>
              <th scope="col" className="money">
                Precio unitario
              </th>
              <th scope="col" className="money">
                Monto original
              </th>
              <th scope="col" className="money">
                Descuento
              </th>
              <th scope="col" className="money">
                Monto final
              </th>
              <th scope="col">Cupones</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.key}>
                <td>
                  {item.name}
                  <small>{item.sku}</small>
                </td>
                <td>{item.quantity}</td>
                <td className="money">{item.price}</td>
                <td className="money">{item.amount}</td>
                <td className="money">{item.discount}</td>
                <td className="money">{item.finalAmount}</td>
                <td>{item.coupons}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

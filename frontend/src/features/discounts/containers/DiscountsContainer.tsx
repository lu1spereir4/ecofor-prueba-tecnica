import { Discounts } from '../components/Discounts';
import { useDiscounts } from '../hooks/useDiscounts';
import { couponTypes } from '../models';
import type { OrderProduct } from '../types';

export function DiscountsContainer({
  orderId,
  products,
  disabled,
}: {
  orderId: number;
  products: OrderProduct[];
  disabled: boolean;
}) {
  const state = useDiscounts(orderId, products, disabled);
  return (
    <Discounts
      editors={state.editors}
      products={state.options}
      types={couponTypes}
      count={state.count}
      limitReached={state.limitReached}
      blocked={state.blocked}
      pending={state.pending}
      limitMessage={state.limitMessage}
      error={state.error}
      formError={state.formError}
      result={state.result}
      onAdd={state.add}
      onChange={state.change}
      onRemove={state.remove}
      onSimulate={() => {
        void state.simulate();
      }}
    />
  );
}

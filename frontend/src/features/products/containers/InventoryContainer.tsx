import { Inventory } from '../components/Inventory';
import { useInventory } from '../hooks/useInventory';
export function InventoryContainer({ enabled }: { enabled: boolean }) {
  const state = useInventory(enabled);
  return (
    <Inventory
      rows={state.rows}
      search={state.draft.search}
      pagination={state.pagination}
      loading={state.loading}
      error={state.error}
      notice={state.notice}
      editingId={state.editingId}
      stockValue={state.stock}
      stockError={state.stockError}
      saving={state.saving}
      onFieldChange={state.setField}
      onSearch={state.search}
      onClear={state.clear}
      onRetry={state.retry}
      onEdit={state.edit}
      onStockChange={state.setStock}
      onCancel={state.cancel}
      onSave={() => {
        void state.save();
      }}
    />
  );
}

import { findEntity } from '../model/entities';
import { usePlan } from '../model/StoreContext';
import { FixtureProperties } from './properties/FixtureProperties';
import { ItemProperties } from './properties/ItemProperties';
import { OpeningProperties } from './properties/OpeningProperties';
import { RoomProperties } from './properties/RoomProperties';
import { WallProperties } from './properties/WallProperties';

export function PropertiesPanel() {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const entity = findEntity(plan, selectedId);
  return (
    <div className="props" data-testid="properties-panel">
      {!entity && <p className="muted">항목을 선택하세요.</p>}
      {entity?.kind === 'item' && <ItemProperties key={entity.item.id} item={entity.item} />}
      {entity?.kind === 'wall' && <WallProperties wall={entity.wall} />}
      {entity?.kind === 'opening' && <OpeningProperties opening={entity.opening} />}
      {entity?.kind === 'room' && <RoomProperties room={entity.room} />}
      {entity?.kind === 'fixture' && <FixtureProperties key={entity.fixture.id} fixture={entity.fixture} />}
    </div>
  );
}

import { randomArchetype, ARCHETYPES } from '../data/archetypes.js';
import { Pengu } from '../pengu/Pengu.js';

export class EggManager {
  constructor(bus) {
    this.bus = bus;
  }

  hatch(chosenArchetype) {
    const archetype = chosenArchetype || randomArchetype();
    const info = ARCHETYPES[archetype];

    const pengu = new Pengu({
      id: `pengu_${Date.now()}`,
      name: `${info.name} Jr.`,
      archetype,
      stage: 'baby',
      level: 1,
      xp: 0,
      hunger: 80,
      happiness: 90,
      energy: 100,
      bornAt: Date.now(),
    });

    console.log(`[EggManager] Hatched: ${pengu.name} (${archetype})`);
    this.bus.emit('pengu:hatched', { pengu });
    return pengu;
  }
}

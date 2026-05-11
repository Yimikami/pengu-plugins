export class AccountResolver {
  constructor(bus) {
    this.bus = bus;
    this.puuid = null;
    this.gameName = null;
    this.tagLine = null;
    this.summonerId = null;
    this.iconId = null;
  }

  async resolve() {
    try {
      const res = await fetch('/lol-summoner/v1/current-summoner');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this.puuid = data.puuid;
      this.gameName = data.gameName || data.displayName;
      this.tagLine = data.tagLine || '';
      this.summonerId = data.summonerId;
      this.iconId = data.profileIconId;

      console.log(`[AccountResolver] Resolved: ${this.gameName}#${this.tagLine} (${this.puuid})`);
      this.bus.emit('account:resolved', {
        puuid: this.puuid,
        gameName: this.gameName,
        tagLine: this.tagLine,
      });

      return this;
    } catch (e) {
      console.warn('[AccountResolver] Failed to resolve, retrying in 3s...', e);
      await new Promise(r => setTimeout(r, 3000));
      return this.resolve();
    }
  }
}

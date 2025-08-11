// Deck model: supports guaranteed start groups, shuffled middle, and guaranteed end groups.
// Each element in start/middle/end can be a string id or an array of ids for grouped multi-pulls.
export class Deck {
  constructor({ start = [], pool = [], end = [] } = {}) {
    // Normalize to arrays of entries (string or array)
    this._start = start.map(x => Array.isArray(x) ? x.slice() : x);
    this._middle = this._shuffle(pool.map(x => Array.isArray(x) ? x.slice() : x));
    this._end = end.map(x => Array.isArray(x) ? x.slice() : x);
  }

  _shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  hasMore() {
    return this._start.length > 0 || this._middle.length > 0 || this._end.length > 0;
  }

  // Returns an array of ids (may be length 1), or null if empty
  draw() {
    let entry = null;
    if (this._start.length) entry = this._start.shift();
    else if (this._middle.length) entry = this._middle.shift();
    else if (this._end.length) entry = this._end.shift();
    if (entry == null) return null;
    return Array.isArray(entry) ? entry.slice() : [entry];
  }
}

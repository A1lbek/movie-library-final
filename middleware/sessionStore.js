class MemorySessionStore {
  constructor() {
    this.sessions = new Map();
  }

  get(sid, callback) {
    const session = this.sessions.get(sid);
    callback(null, session);
  }

  set(sid, session, callback) {
    this.sessions.set(sid, session);
    callback(null);
  }

  destroy(sid, callback) {
    this.sessions.delete(sid);
    callback(null);
  }

  touch(sid, session, callback) {
    const existingSession = this.sessions.get(sid);
    if (existingSession) {
      this.sessions.set(sid, session);
    }
    callback(null);
  }

  cleanupExpired(maxAge) {
    const now = Date.now();
    for (const [sid, session] of this.sessions.entries()) {
      if (session.cookie && session.cookie.expires) {
        const expires = new Date(session.cookie.expires).getTime();
        if (expires < now) {
          this.sessions.delete(sid);
        }
      }
    }
  }
}

module.exports = MemorySessionStore;

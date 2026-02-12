const crypto = require('crypto');

class SimpleSession {
  constructor(options = {}) {
    this.secret = options.secret || crypto.randomBytes(32).toString('hex');
    this.cookieName = options.cookieName || 'sessionId';
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; 
    this.sessions = new Map();

    setInterval(() => this.cleanupExpired(), 60 * 60 * 1000);
  }

  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  sign(sessionId) {
    return crypto.createHmac('sha256', this.secret)
      .update(sessionId)
      .digest('hex');
  }

  verify(sessionId, signature) {
    const expectedSignature = this.sign(sessionId);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  parseCookie(cookieHeader) {
    if (!cookieHeader) return null;

    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });

    const signedValue = cookies[this.cookieName];
    if (!signedValue) return null;

    const [sessionId, signature] = signedValue.split('.');
    if (!sessionId || !signature) return null;

    try {
      if (this.verify(sessionId, signature)) {
        return sessionId;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  middleware() {
    return (req, res, next) => {
      const sessionId = this.parseCookie(req.headers.cookie);
      
      if (sessionId && this.sessions.has(sessionId)) {
        const sessionData = this.sessions.get(sessionId);

        if (sessionData.expiresAt > Date.now()) {
          req.session = sessionData.data;
          req.sessionId = sessionId;
        } else {
          this.sessions.delete(sessionId);
          req.session = {};
        }
      } else {
        req.session = {};
      }

      req.sessionSave = () => {
        let sid = req.sessionId;
        
        if (!sid) {
          sid = this.generateSessionId();
          req.sessionId = sid;
        }

        this.sessions.set(sid, {
          data: req.session,
          expiresAt: Date.now() + this.maxAge
        });

        const signature = this.sign(sid);
        const cookieValue = `${sid}.${signature}`;

        const cookieOptions = [
          `${this.cookieName}=${cookieValue}`,
          `Max-Age=${Math.floor(this.maxAge / 1000)}`,
          'HttpOnly',
          'Path=/',
          'SameSite=Strict'
        ];

        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }

        res.setHeader('Set-Cookie', cookieOptions.join('; '));
      };

      req.sessionDestroy = () => {
        if (req.sessionId) {
          this.sessions.delete(req.sessionId);
        }
        req.session = {};

        res.setHeader('Set-Cookie', [
          `${this.cookieName}=; Max-Age=0; Path=/; HttpOnly`
        ]);
      };

      next();
    };
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (sessionData.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

module.exports = SimpleSession;

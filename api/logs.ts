import Redis from 'ioredis';

// Shared memory for this serverless instance (fallback if KV is not configured)
const globalLogs: any[] = [];

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle logging a new player
  if (req.method === 'POST' && req.body && req.body.action === 'log') {
    const { name, room, role, clientId } = req.body;
    if (!name || !room) return res.status(400).json({ error: 'Missing name or room' });

    const entry = {
      name,
      room,
      role: role || 'Player',
      clientId: clientId || 'unknown',
      location: req.body.location || 'Unknown',
      timestamp: Date.now()
    };

    try {
      if (!process.env.KV_REDIS_URL) {
         globalLogs.unshift(entry);
         if (globalLogs.length > 1000) globalLogs.pop();
         return res.status(200).json({ success: true, warning: 'Using temporary memory.' });
      }

      const redis = new Redis(process.env.KV_REDIS_URL);
      await redis.lpush('player_logs', JSON.stringify(entry));
      await redis.ltrim('player_logs', 0, 999);
      redis.quit();
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Handle fetching logs
  if (req.method === 'POST' && req.body && req.body.action === 'get') {
    const { password } = req.body;
    const correctPassword = process.env.DASHBOARD_PASSWORD || 'neoncreator';
    
    if (password !== correctPassword) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      if (!process.env.KV_REDIS_URL) {
         return res.status(200).json({ 
             logs: globalLogs, 
             warning: 'Using temporary memory (logs will disappear after a few minutes). Configure Vercel KV Redis to save permanently.' 
         });
      }

      const redis = new Redis(process.env.KV_REDIS_URL);
      const logs = await redis.lrange('player_logs', 0, -1);
      redis.quit();
      
      return res.status(200).json({ logs: logs.map((l: any) => typeof l === 'string' ? JSON.parse(l) : l) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

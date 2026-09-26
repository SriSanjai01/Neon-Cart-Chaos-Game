import Ably from 'ably';

export default async function handler(req: any, res: any) {
  if (!process.env.ABLY_API_KEY) {
    return res.status(500).json({ error: 'ABLY_API_KEY is not set' });
  }

  const client = new Ably.Rest(process.env.ABLY_API_KEY);
  
  try {
    const tokenRequestData = await client.auth.createTokenRequest({
      clientId: req.query.clientId || 'anonymous',
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(tokenRequestData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

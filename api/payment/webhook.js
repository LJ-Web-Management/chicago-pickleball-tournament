const { sql, ensureSchema } = require('../../lib/db');

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(200).json({ received: false, message: 'Stripe not configured' });
    return;
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const rawBody = await readRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    await ensureSchema();
    const session = event.data.object;
    const playerIds = (session.metadata?.playerIds || '')
      .split(',')
      .filter(Boolean)
      .map(Number);
    if (playerIds.length > 0) {
      await sql`UPDATE players SET paid = true WHERE id = ANY(${playerIds})`;
    }
  }

  res.status(200).json({ received: true });
};

// Stripe webhooks need the raw request body to verify the signature, which
// Vercel's default JSON body parsing would break -- so we disable it here.
module.exports.config = { api: { bodyParser: false } };

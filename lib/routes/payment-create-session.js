const { sql, ensureSchema } = require('../db');
const { requireUser } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { getSettings } = require('../settings');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const user = requireUser(req);
  const settings = await getSettings();
  const { playerIds } = req.body || {};
  if (!Array.isArray(playerIds) || playerIds.length === 0) throw new HttpError(400, 'playerIds is required');

  const { rows: players } = await sql`
    SELECT id, first_name, last_name, paid FROM players
    WHERE id = ANY(${playerIds}) AND user_id = ${user.sub} AND status = 'active'
  `;
  if (players.length !== playerIds.length) throw new HttpError(404, 'Some players were not found on your account');
  const unpaid = players.filter((p) => !p.paid);
  if (unpaid.length === 0) {
    res.status(200).json({ enabled: true, alreadyPaid: true, message: 'All selected players are already marked paid.' });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(200).json({
      enabled: false,
      message: 'Online payment is not yet enabled for this event. Please check back soon or contact the organizers.',
      amountDueCents: unpaid.length * settings.registrationFeeCents,
    });
    return;
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: unpaid.map((p) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: `Tournament registration fee -- ${p.first_name} ${p.last_name}` },
        unit_amount: settings.registrationFeeCents,
      },
      quantity: 1,
    })),
    metadata: { playerIds: unpaid.map((p) => p.id).join(',') },
    success_url: process.env.PAYMENT_SUCCESS_URL || 'https://example.com/fee-payment.html?paid=1',
    cancel_url: process.env.PAYMENT_CANCEL_URL || 'https://example.com/fee-payment.html?cancelled=1',
  });

  res.status(200).json({ enabled: true, url: session.url });
});

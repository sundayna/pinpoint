const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const auth = getAuth();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body;
    const email = body.email;
    const productPermalink = body.product_permalink;
    const refunded = body.refunded === 'true';

    if (!email) return res.status(400).json({ error: 'No email' });

    if (refunded) {
      await downgradeUser(email);
      return res.status(200).json({ ok: true, action: 'downgraded' });
    }

    const isWeekly = productPermalink === 'uvdbv';
    const days = isWeekly ? 7 : 30;

    const premiumUntil = new Date();
    premiumUntil.setDate(premiumUntil.getDate() + days);

    try {
      const user = await auth.getUserByEmail(email);
      const ref = db.collection('users').doc(user.uid);
      await ref.set({
        isPremium: true,
        premiumUntil: premiumUntil,
        plan: isWeekly ? 'weekly' : 'monthly',
        updatedAt: new Date()
      }, { merge: true });

      console.log(`升級成功：${email}`);
      return res.status(200).json({ ok: true, email, premiumUntil });

    } catch (err) {
      await db.collection('pending_upgrades').doc(email).set({
        email,
        isPremium: true,
        premiumUntil,
        plan: isWeekly ? 'weekly' : 'monthly',
        createdAt: new Date()
      });
      return res.status(200).json({ ok: true, pending: true });
    }

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function downgradeUser(email) {
  try {
    const user = await auth.getUserByEmail(email);
    const ref = db.collection('users').doc(user.uid);
    await ref.update({ isPremium: false, premiumUntil: null });
  } catch (err) {
    console.log('Downgrade failed:', err.message);
  }
}


import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// 初始化 Firebase Admin
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const auth = getAuth();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Gumroad 用 form-urlencoded 格式傳資料
    const body = req.body;
    const email = body.email;
    const productPermalink = body.product_permalink; // 'uvdbv' 週費 / 'ityot' 月費
    const refunded = body.refunded === 'true';

    if (!email) return res.status(400).json({ error: 'No email' });

    // 退款就取消會員
    if (refunded) {
      await downgradeUser(email);
      return res.status(200).json({ ok: true, action: 'downgraded' });
    }

    // 判斷方案
    const isWeekly = productPermalink === 'uvdbv';
    const days = isWeekly ? 7 : 30;

    // 計算到期日
    const premiumUntil = new Date();
    premiumUntil.setDate(premiumUntil.getDate() + days);

    // 用 email 找 Firebase 用戶
    try {
      const user = await auth.getUserByEmail(email);
      const ref = db.collection('users').doc(user.uid);
      await ref.set({
        isPremium: true,
        premiumUntil: premiumUntil,
        plan: isWeekly ? 'weekly' : 'monthly',
        updatedAt: new Date()
      }, { merge: true });

      console.log(`✅ 升級成功：${email}，到期：${premiumUntil}`);
      return res.status(200).json({ ok: true, email, premiumUntil });

    } catch (err) {
      // 用戶還沒註冊 Pinpoint，先記錄起來
      await db.collection('pending_upgrades').doc(email).set({
        email,
        isPremium: true,
        premiumUntil,
        plan: isWeekly ? 'weekly' : 'monthly',
        createdAt: new Date()
      });
      console.log(`⏳ 用戶尚未註冊，暫存：${email}`);
      return res.status(200).json({ ok: true, pending: true });
    }

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function downgradeUser(email) {
  try {
    const user = await auth.getUserByEmail(email);
    const ref = db.collection('users').doc(user.uid);
    await ref.update({ isPremium: false, premiumUntil: null });
  } catch (err) {
    console.log('Downgrade failed:', err.message);
  }
}

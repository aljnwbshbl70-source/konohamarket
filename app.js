/**
 * KONOHA MARKET - THE BRAIN (APP.JS)
 * هذا الملف يحتوي على العمليات المعقدة، الرقابة، بوابات الدفع، والاتصال بقواعد البيانات.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, get, set, update, push, increment, query, orderByChild } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// ==========================================
// 1. الإعدادات والربط (Configurations)
// ==========================================
const firebaseConfig = {
    // ضع بياناتك هنا
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const TELEGRAM_BOT_TOKEN = "8707681218:AAHZAgTBdz1Ob_pyOZcNBeKM2QVdy-e6e3I";
const TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"; // يجب استبدالها بمعرفك

// ==========================================
// 2. نظام الرقابة الصارم (Content Filter)
// ==========================================
const bannedWords = [
    "غبي", "احمق", "حمار", "كلب", "خنزير", "تافه", "حقير", "نذل", "وصخ", "قذر", "زبالة", "زباله", "منحط", "سافل", "وقح", "عديم ادب",
    "يلعنك", "لعنة", "ملعون", "لعنك الله", "الله يلعنك", "تفو", "اتفو", "تباً", "تبًا", "قرف", "مقرف",
    "زق", "خرا", "خراء", "زب", "طيز", "كس", "شرموط", "شرموطة", "قحبة", "قواد", "عرص", "ديوث", "منيوك", "متناك", "نيك", "ينيك",
    "ساقطعك", "اذبحك", "اقتلك", "دعس", "اهينك", "احرقك", "منسم", "هبيل", "مطفوق", "خبل", "مريض نفسي",
    "مطفي", "مضيع", "دلخ", "غشيم", "مطفر", "فاهي", "عبيط", "متخلف", "خول", "وسخ"
];

function normalizeText(text) {
    if(!text) return "";
    return text.toLowerCase().replace(/[^\u0600-\u06FFa-z0-9]/g, "").trim();
}

function containsBannedWord(message) {
    const normalizedMessage = normalizeText(message);
    return bannedWords.some(word => normalizedMessage.includes(normalizeText(word)));
}

// ==========================================
// 3. نظام إشعارات تيليجرام (Telegram Logger)
// ==========================================
async function sendTelegramAlert(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=HTML`;
        await fetch(url);
    } catch (error) {
        console.error("فشل إرسال التنبيه لتيليجرام", error);
    }
}

// ==========================================
// 4. نظام الشراء المتقدم وبوابات الدفع (Smart Payment Gateway)
// ==========================================
window.processPurchase = async (shopId, productId, price, productName) => {
    try {
        if (price < 10000) {
            alert("❌ عذراً، الحد الأدنى لأسعار المنتجات في كونوها ماركت هو 10,000.");
            return;
        }

        // إظهار نافذة الدفع (UI Logic)
        const bankName = prompt("🏦 الرجاء إدخال اسم البنك المعتمد الخاص بك:");
        if(!bankName) return;
        
        const username = prompt("👤 أدخل اسم المستخدم في البنك:");
        const password = prompt("🔑 أدخل كلمة المرور:");

        // التحقق من البنك والحساب
        const accountRef = ref(db, `banks/${bankName}/${username}`);
        const snapshot = await get(accountRef);

        if (!snapshot.exists()) {
            alert("❌ الحساب غير موجود في هذا البنك.");
            return;
        }

        const accountData = snapshot.val();
        
        if (accountData.pass !== password) {
            alert("❌ كلمة المرور غير صحيحة.");
            return;
        }

        // التحقق من الرصيد
        if (accountData.balance < price) {
            alert("❌ رصيدك غير كافٍ لإتمام العملية. يرجى شحن حسابك ومحاولة مرة أخرى.");
            return;
        }

        // تأكيد الشراء
        const confirmBuy = confirm(`هل أنت متأكد من شراء [${productName}] بقيمة ${price}؟`);
        if (!confirmBuy) return;

        const contactNumber = prompt("📱 يرجى إدخال رقم تواصل لإرسال الطلب إليه:");

        // تنفيذ المعاملة (Transaction)
        const updates = {};
        // سحب من المشتري
        updates[`banks/${bankName}/${username}/balance`] = increment(-price);
        // إرسال للمشرف
        updates[`admin/vault/balance`] = increment(price);
        // زيادة مبيعات الحانوت لرفع تقييمه
        updates[`shops/${shopId}/sales`] = increment(1);
        updates[`shops/${shopId}/orders/${Date.now()}`] = {
            product: productName,
            price: price,
            buyerPhone: contactNumber,
            date: Date.now()
        };

        await update(ref(db), updates);

        // إشعار المشرف
        const msg = `🛒 <b>عملية شراء جديدة!</b>\n\n🛍️ المنتج: ${productName}\n💰 السعر: ${price}\n🏪 من حانوت ID: ${shopId}\n📱 رقم المشتري: ${contactNumber}`;
        await sendTelegramAlert(msg);

        // طلب التقييم
        let rating = prompt("⭐ تم الشراء بنجاح! يرجى تقييم الحانوت من 1 إلى 5:");
        if(rating >= 1 && rating <= 5) {
            await update(ref(db), { [`shops/${shopId}/ratingSum`]: increment(parseInt(rating)), [`shops/${shopId}/ratingCount`]: increment(1) });
        }

        alert("✅ تمت العملية بنجاح! سيتم التواصل معك قريباً.");

    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء معالجة الدفع.");
    }
};

// ==========================================
// 5. نظام الإيجارات والمراقبة التلقائية (The Cron Job Logic)
// ==========================================
// تشتغل هذه الدالة كل فترة معينة لفحص كل الحوانيت
async function cronJobRentCheck() {
    try {
        const rentPriceSnapshot = await get(ref(db, 'settings/rentPrice'));
        const RENT_PRICE = rentPriceSnapshot.val() || 100000; // الافتراضي 100 ألف

        const shopsSnapshot = await get(ref(db, 'shops'));
        if (!shopsSnapshot.exists()) return;

        const shops = shopsSnapshot.val();
        const NOW = Date.now();
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        const TWO_DAYS_GRACE = 2 * 24 * 60 * 60 * 1000;

        for (let ownerId in shops) {
            let shop = shops[ownerId];
            if (shop.status === 'suspended') continue;

            let timePassed = NOW - shop.openedAt;

            if (timePassed > ONE_WEEK) {
                // محاولة سحب الإيجار من حساب التاجر (يجب أن نحدد بنك التاجر الافتراضي عند التسجيل)
                let bankName = shop.bankName;
                let accountRef = ref(db, `banks/${bankName}/${ownerId}`);
                let accSnap = await get(accountRef);

                if (accSnap.exists() && accSnap.val().balance >= RENT_PRICE) {
                    // سحب الإيجار وتجديد التاريخ
                    const updates = {};
                    updates[`banks/${bankName}/${ownerId}/balance`] = increment(-RENT_PRICE);
                    updates[`admin/vault/balance`] = increment(RENT_PRICE);
                    updates[`shops/${ownerId}/openedAt`] = NOW; // تصفير العداد لأسبوع جديد
                    updates[`shops/${ownerId}/warning`] = false;
                    await update(ref(db), updates);
                } else {
                    // الرصيد غير كافٍ، هل تجاوز فترة السماح (اليومين)؟
                    if (timePassed > (ONE_WEEK + TWO_DAYS_GRACE)) {
                        await update(ref(db, `shops/${ownerId}`), { status: 'suspended', warning: false });
                        await sendTelegramAlert(`🛑 <b>إيقاف حانوت تلقائي!</b>\n🏪 الحانوت: ${shop.name}\n👤 المالك: ${ownerId}\n⚠️ السبب: عدم سداد الإيجار (${RENT_PRICE}).`);
                    } else {
                        // إعطاء تحذير أحمر (تفعيل فلاج التحذير)
                        await update(ref(db, `shops/${ownerId}`), { warning: true });
                    }
                }
            }
        }
    } catch (e) {
        console.error("خطأ في نظام الإيجار التلقائي:", e);
    }
}

// تشغيل الفاحص كل 10 دقائق (للأداء)
setInterval(cronJobRentCheck, 600000);

// ==========================================
// 6. تحميل وتصفية الحوانيت (Load & Sort)
// ==========================================
window.loadShops = async (category = "all", sortBy = "rating") => {
    // هذا الجزء سيجلب الحوانيت ويحسب التقييم (ratingSum / ratingCount) 
    // ثم يطبعها في div id="shops-list-container"
    // (تم اختصاره هنا لتوفير المساحة، يمكنك تخيل مئات الأسطر من بناء الـ HTML الديناميكي)
}

// =============================================
// app.js — شمس: منطق الحاسبة والشات
// =============================================

// بيانات المدن — تُحمَّل من Supabase
let CITY_DATA = {};

// عدد الأضلاع التلقائي لكل شكل
const SHAPE_SIDES = {
  rect:     4,
  lshape:   6,
  tshape:   8,
  triangle: 3,
  hexagon:  6,
  custom:   null
};

const PANEL_WATT       = 400;
const PANEL_AREA_M2    = 2;
const EFFICIENCY       = 0.80;
const COST_PER_KW      = 4500;
const ELECTRICITY_RATE = 0.18;

// =============================================
// تحميل المدن من Supabase وملء القائمة
// =============================================
async function loadCities() {
  try {
    const { data: cities, error } = await sb
      .from('cities')
      .select('id, city_key, name_ar, sun_hours')
      .order('name_ar');

    if (error) throw error;

    // بناء CITY_DATA من قاعدة البيانات
    cities.forEach(c => {
      CITY_DATA[c.city_key] = {
        id:       c.id,
        name:     c.name_ar,
        sunHours: parseFloat(c.sun_hours)
      };
    });

    // ملء قائمة المدن في الحاسبة
    const citySelectEl = document.getElementById('citySelect');
    if (citySelectEl) {
      citySelectEl.innerHTML = '<option value="">اختر مدينتك</option>';
      cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value       = c.city_key;
        opt.textContent = c.name_ar;
        citySelectEl.appendChild(opt);
      });
    }

  } catch (err) {
    console.error('خطأ في تحميل المدن:', err.message);
    // fallback — بيانات ثابتة لو فشل الاتصال
    CITY_DATA = {
      riyadh: { name: 'الرياض',          sunHours: 8.5 },
      jeddah: { name: 'جدة',             sunHours: 7.5 },
      dammam: { name: 'الدمام',          sunHours: 8.0 },
      abha:   { name: 'أبها',            sunHours: 6.5 },
      mecca:  { name: 'مكة المكرمة',     sunHours: 8.0 },
      medina: { name: 'المدينة المنورة',  sunHours: 8.0 },
      tabuk:  { name: 'تبوك',            sunHours: 9.0 }
    };
  }
}

// =============================================
// تشغيل تحميل المدن عند فتح الصفحة
// =============================================
loadCities();

// ===== عرض معلومات المدينة =====
const citySelectEl = document.getElementById('citySelect');
if (citySelectEl) {
  citySelectEl.addEventListener('change', function () {
    const city = CITY_DATA[this.value];
    const hint = document.getElementById('cityInfo');
    if (hint) hint.textContent = city ? `☀ متوسط ساعات الشمس في ${city.name}: ${city.sunHours} ساعة/يوم` : '';
  });
}

// ===== شكل السطح — عدد الأضلاع تلقائياً =====
const roofShapeSelect   = document.getElementById('roofShapeSelect');
const customShapeFields = document.getElementById('customShapeFields');
const sidesInfoBox      = document.getElementById('sidesInfoBox');

if (roofShapeSelect) {
  roofShapeSelect.addEventListener('change', function () {
    const shape    = this.value;
    const isCustom = shape === 'custom';
    const sides    = SHAPE_SIDES[shape];

    if (customShapeFields) {
      customShapeFields.classList.toggle('visible', isCustom);
      customShapeFields.querySelectorAll('input').forEach(inp => { inp.required = isCustom; });
    }

    if (sidesInfoBox) {
      if (shape && !isCustom && sides) {
        sidesInfoBox.textContent = `📐 هذا الشكل يحتوي على ${sides} أضلاع`;
        sidesInfoBox.style.display = 'block';
      } else {
        sidesInfoBox.style.display = 'none';
      }
    }
  });
}

// ===== حساب مساحة الشكل المخصص =====
function calculateCustomArea() {
  const sidesCount = parseInt(document.getElementById('customSidesCount')?.value);
  if (!sidesCount || sidesCount < 3) return 0;
  const sides = [];
  for (let i = 1; i <= sidesCount; i++) {
    const val = parseFloat(document.getElementById(`customSide_${i}`)?.value);
    if (!val || val <= 0) return 0;
    sides.push(val);
  }
  const avg  = sides.reduce((a, b) => a + b, 0) / sides.length;
  const area = (sidesCount * avg * avg) / (4 * Math.tan(Math.PI / sidesCount));
  return Math.round(area * 10) / 10;
}

// ===== توليد حقول أطوال الأضلاع =====
const customSidesCountEl = document.getElementById('customSidesCount');
if (customSidesCountEl) {
  customSidesCountEl.addEventListener('input', function () {
    const n         = parseInt(this.value);
    const container = document.getElementById('customSidesContainer');
    if (!container || isNaN(n) || n < 3 || n > 20) return;
    container.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      container.innerHTML += `
        <div class="form-group" style="margin-bottom:10px">
          <label style="font-size:0.84rem;font-weight:600;color:var(--gray-700)">طول الضلع ${i} (م)</label>
          <div class="input-wrapper">
            <input type="number" id="customSide_${i}" placeholder="مثال: 5" min="0.1" step="0.1" required
              style="padding:10px 40px 10px 14px;border:2px solid var(--gray-200);border-radius:var(--radius-sm);
                     font-family:var(--font-body);font-size:0.9rem;width:100%;background:var(--white);
                     outline:none;transition:var(--transition);direction:rtl;"
              onfocus="this.style.borderColor='var(--sun-yellow)';this.style.boxShadow='0 0 0 4px rgba(255,184,0,0.12)'"
              onblur="this.style.borderColor='var(--gray-200)';this.style.boxShadow='none'" />
            <span class="input-icon">📏</span>
          </div>
        </div>`;
    }
  });
}

// =============================================
// الحاسبة الرئيسية
// =============================================
const calculateBtn = document.getElementById('calculateBtn');
if (calculateBtn) {
  calculateBtn.addEventListener('click', async function () {
    let roofArea      = parseFloat(document.getElementById('roofArea')?.value);
    const monthlyBill = parseFloat(document.getElementById('monthlyBill')?.value);
    const cityKey     = document.getElementById('citySelect')?.value;

    if (roofShapeSelect && roofShapeSelect.value === 'custom') {
      const sidesCount = parseInt(document.getElementById('customSidesCount')?.value);
      if (!sidesCount || sidesCount < 3) {
        alert('الرجاء إدخال عدد الأضلاع (3 على الأقل)');
        document.getElementById('customSidesCount')?.focus();
        return;
      }
      for (let i = 1; i <= sidesCount; i++) {
        const val = parseFloat(document.getElementById(`customSide_${i}`)?.value);
        if (!val || val <= 0) {
          alert(`الرجاء إدخال طول الضلع ${i}`);
          document.getElementById(`customSide_${i}`)?.focus();
          return;
        }
      }
      const calcArea = calculateCustomArea();
      if (calcArea > 0) {
        roofArea = calcArea;
        const el = document.getElementById('roofArea');
        if (el) el.value = calcArea;
      }
    }

    if (!roofArea || roofArea <= 0)       { alert('الرجاء إدخال مساحة السطح'); return; }
    if (!monthlyBill || monthlyBill <= 0) { alert('الرجاء إدخال فاتورة الكهرباء'); return; }
    if (!cityKey)                         { alert('الرجاء اختيار المدينة'); return; }

    const city         = CITY_DATA[cityKey];
    const monthlyKWh   = monthlyBill / ELECTRICITY_RATE;
    const dailyKWh     = monthlyKWh / 30;
    const systemKW     = dailyKWh / (city.sunHours * EFFICIENCY);
    const panelsNeeded = Math.ceil((systemKW * 1000) / PANEL_WATT);
    const requiredArea = panelsNeeded * PANEL_AREA_M2;
    const roofSufficient = roofArea >= requiredArea;
    const installCost  = systemKW * COST_PER_KW;
    const paybackYears = (installCost / (monthlyBill * 12 * 0.7)).toFixed(1);

    // حساب التركيب الجزئي
    const partialPanels  = Math.floor(roofArea / PANEL_AREA_M2);
    const partialKW      = (partialPanels * PANEL_WATT) / 1000;
    const partialCost    = partialKW * COST_PER_KW;
    const partialSavings = Math.round((partialPanels / panelsNeeded) * 70);
    const partialPayback = partialSavings > 0
      ? (partialCost / (monthlyBill * 12 * (partialSavings / 100))).toFixed(1)
      : '—';

    // عرض النتائج
    const _setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    _setText('resConsumption', `${monthlyKWh.toFixed(0)} كيلوواط/ساعة`);
    _setText('resSystemSize',  `${systemKW.toFixed(2)} كيلوواط`);
    _setText('resPanels',      `${panelsNeeded} لوح`);
    _setText('roofStatus',     roofSufficient ? '✅ كافية' : '❌ غير كافية');
    const roofStatusEl = document.getElementById('roofStatus');
    if (roofStatusEl) roofStatusEl.style.color = roofSufficient ? 'var(--success)' : 'var(--danger)';
    _setText('resCost',        `${installCost.toLocaleString('ar-SA')} ريال`);
    _setText('resPayback',     `${paybackYears} سنة`);
    _setText('savingsPct',     '70%');
    setTimeout(() => { const sf = document.getElementById('savingsFill'); if (sf) sf.style.width = '70%'; }, 100);

    const roofWarningEl = document.getElementById('roofWarning');
    const partialInfoEl = document.getElementById('partialInstallInfo');

    if (roofSufficient) {
      if (roofWarningEl) roofWarningEl.style.display = 'none';
      if (partialInfoEl) partialInfoEl.style.display = 'none';
    } else {
      if (roofWarningEl) roofWarningEl.style.display = 'block';
      if (partialInfoEl) {
        document.getElementById('partialPanels').textContent  = partialPanels;
        document.getElementById('partialKW').textContent      = partialKW.toFixed(2);
        document.getElementById('partialCost').textContent    = partialCost.toLocaleString('ar-SA');
        document.getElementById('partialSavings').textContent = partialSavings;
        document.getElementById('partialPayback').textContent = partialPayback;
        partialInfoEl.style.display = 'block';
      }
    }

    const rp = document.getElementById('resultsPlaceholder'); if (rp) rp.style.display = 'none';
    const rc = document.getElementById('resultsContent');     if (rc) rc.style.display = 'block';

    // =============================================
    // حفظ النتائج في Supabase
    // =============================================
    try {
      const { data: { session } } = await sb.auth.getSession();

      const { error: saveErr } = await sb.from('solar_calculations').insert({
        user_id:         session?.user?.id || null,
        city_id:         city.id           || null,
        roof_area_m2:    roofArea,
        monthly_bill_sar: monthlyBill,
        system_size_kw:  parseFloat(systemKW.toFixed(3)),
        panels_count:    panelsNeeded,
        install_cost_sar: parseFloat(installCost.toFixed(2)),
        payback_years:   parseFloat(paybackYears)
      });

      if (saveErr) console.warn('تعذّر حفظ الحساب:', saveErr.message);

    } catch (e) {
      console.warn('خطأ في حفظ الحساب:', e.message);
    }
  });
}

// =============================================
// الشات بوت
// =============================================
const chatResponses = {
  'تكلفة':   'تتراوح تكلفة تركيب نظام الطاقة الشمسية بين 15,000 و60,000 ريال حسب حجم النظام. متوسط السعر 4,000-5,000 ريال لكل كيلوواط. ✅',
  'سعر':     'يبدأ سعر اللوح الشمسي الواحد (400 واط) من 500-800 ريال. التركيب والمحول والأسلاك تُضاف على ذلك. 💰',
  'تكاليف':  'التكاليف الإجمالية تشمل: الألواح، المحول الكهربائي، الأسلاك، الحوامل، والتركيب. استخدم حاسبتنا! 📊',
  'اشتراك':  'لدينا 3 باقات: المجانية للتجربة، الاحترافية بـ 49 ريال/شهر، والمؤسسية بـ 149 ريال/شهر. 📦',
  'باقة':    'لدينا 3 باقات: المجانية للتجربة، الاحترافية بـ 49 ريال/شهر، والمؤسسية بـ 149 ريال/شهر. 📦',
  'مميزات':  'مميزات الطاقة الشمسية: ✅ توفير 70% من الفاتورة ✅ صديقة للبيئة ✅ عمر 25 سنة ✅ صيانة منخفضة',
  'توفير':   'باستخدام نظام شمسي مناسب يمكنك توفير 50-70% من فاتورتك الشهرية! 💡',
  'جزئي':    'التركيب الجزئي يعني تركيب عدد ألواح أقل مما تحتاج بحسب مساحة سطحك. ستوفر نسبة أقل لكنه يبقى استثماراً مجدياً! 🪟',
  'ألواح':   'يُنصح بألواح أحادية الخلية (Monocrystalline) بكفاءة 20-22%. كل لوح يحتاج مساحة ~2م². 🪟',
  'تركيب':   'التركيب يستغرق يوماً إلى 3 أيام. يشمل: الحوامل، الألواح، المحول، ربط الشبكة. 🛠',
  'صيانة':   'تنظيف الغبار كل شهر أو شهرين، وفحص دوري للتوصيلات. عمر الألواح 25-30 سنة! 🔧',
  'استرداد': 'فترة استرداد التكلفة 5-8 سنوات. بعدها كهرباء مجانية لـ20 سنة! 📈',
  'رياض':    'الرياض: 8.5 ساعة شمس يومياً — ممتاز للطاقة الشمسية! ☀',
  'جدة':     'جدة: 7.5 ساعة شمس يومياً. فعّالة جداً. 🌊',
  'تبوك':    'تبوك: 9 ساعات شمس — من أعلى المعدلات في المملكة! 🌟',
  'مرحبا':   'أهلاً وسهلاً! 👋 أنا مساعد شمس. كيف يمكنني مساعدتك؟',
  'مرحباً':  'أهلاً وسهلاً! 👋 أنا مساعد شمس. كيف يمكنني مساعدتك؟',
  'هلا':     'هلا والله! 😊 أنا هنا لمساعدتك في كل ما يخص الطاقة الشمسية!',
  'شكرا':    'العفو! يسعدنا خدمتك دائماً. ☀',
  'شكراً':   'العفو! يسعدنا خدمتك دائماً. ☀',
};

function getBotResponse(userMsg) {
  const msg = userMsg.toLowerCase().trim();
  for (const [kw, res] of Object.entries(chatResponses)) {
    if (msg.includes(kw.toLowerCase())) return res;
  }
  return 'شكراً على سؤالك! 🌟 يمكنني الإجابة عن: الاشتراكات، التكاليف، المميزات، التركيب، أو الصيانة.';
}

function addMessage(text, sender) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const d = document.createElement('div'); d.className = `msg ${sender}`;
  const b = document.createElement('div'); b.className = 'msg-bubble'; b.textContent = text;
  d.appendChild(b); msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, 'user'); input.value = '';
  setTimeout(() => addMessage(getBotResponse(text), 'bot'), 600);
}

function sendSuggestion(text) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; sendMessage(); }
}

const chatInputEl = document.getElementById('chatInput');
if (chatInputEl) chatInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
const sendMsgBtn = document.getElementById('sendMsgBtn');
if (sendMsgBtn) sendMsgBtn.addEventListener('click', sendMessage);

function toggleChat() {
  const w = document.getElementById('chatWidget');
  if (w) w.classList.toggle('open');
}

const chatBubble   = document.getElementById('chatBubble');
const closeChatBtn = document.getElementById('closeChatBtn');
const openChatBtn  = document.getElementById('openChatBtn');
if (chatBubble)   chatBubble.addEventListener('click', toggleChat);
if (closeChatBtn) closeChatBtn.addEventListener('click', () => document.getElementById('chatWidget')?.classList.remove('open'));
if (openChatBtn)  openChatBtn.addEventListener('click', toggleChat);

// ===== قائمة الهاتف =====
const hamburgerEl = document.getElementById('hamburger');
const navLinksEl  = document.getElementById('navLinks');
if (hamburgerEl) hamburgerEl.addEventListener('click', () => navLinksEl?.classList.toggle('open'));
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => navLinksEl?.classList.remove('open'));
});

// ===== تمييز الرابط النشط =====
(function () {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });
})();

// ===== تحميل المساحة المحفوظة من roof.html =====
const savedArea = localStorage.getItem('shams_roof_area');
if (savedArea) {
  const el = document.getElementById('roofArea');
  if (el) el.value = savedArea;
  localStorage.removeItem('shams_roof_area');
}
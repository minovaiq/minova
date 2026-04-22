document.addEventListener("DOMContentLoaded", async () => {
  const STATUS_OPTIONS = ["new", "processing", "delivered", "rejected"];
  const FAKE_ORDER_PATTERNS = [
    /(^|\s)test(\s|$)/i,
    /(^|\s)fake(\s|$)/i,
    /(^|\s)demo(\s|$)/i,
    /(^|\s)sample(\s|$)/i,
    /تجربة/,
    /وهمي/
  ];

  const STATUS_LABELS = {
    new: "جديد",
    processing: "قيد المعالجة",
    delivered: "تم التسليم",
    rejected: "مرفوض"
  };

  const STATUS_COLORS = {
    new: "#2563eb",
    processing: "#f59e0b",
    delivered: "#16a34a",
    rejected: "#dc2626"
  };

  let currentUser = null;
  let pages = [];
  let orders = [];
  let filteredOrders = [];
  let selectedOrderId = null;

  function money(value) {
    const number = Number(value || 0);
    return number.toLocaleString("en-US");
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function showAlert(message) {
    alert(message);
  }

  function getMainContainer() {
    return document.querySelector("main") || document.body;
  }

  function getPageNetProfit(order, page) {
    const price = Number(page?.price || 0);
    const productCost = Number(page?.product_cost || 0);
    const deliveryCost = Number(page?.delivery_cost || 0);

    if (order.status !== "delivered") return 0;
    return price - productCost - deliveryCost;
  }

  function ensureFinanceLayout() {
    const main = getMainContainer();

    if (!document.getElementById("financeSection")) {
      const wrapper = document.createElement("section");
      wrapper.id = "financeSection";
      wrapper.style.marginTop = "16px";
      wrapper.style.padding = "0";
      wrapper.style.boxSizing = "border-box";

      wrapper.innerHTML = `
        <section class="hero-box" style="padding:16px; margin-bottom:14px; text-align:right;">
          <h2 style="margin:0 0 6px; font-size:1.1rem;">القسم المالي</h2>
          <p style="margin:0; font-size:12px; color:rgba(255,255,255,.92);">
            متابعة عدد الطلبات، الإيرادات، التكاليف، وصافي الربح لكل صفحة.
          </p>
        </section>

        <section id="financialStatsCards" class="grid grid-3" style="gap:10px; margin-bottom:14px;"></section>

        <section class="card" style="padding:12px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            <div>
              <h2 style="margin:0 0 4px; font-size:1rem;">فلترة الطلبات</h2>
              <p style="margin:0; font-size:11px; color:var(--muted);">فلتر حسب الصفحة أو الحالة</p>
            </div>
          </div>

          <div class="grid grid-2" style="gap:10px;">
            <select id="financePageFilter">
              <option value="all">كل الصفحات</option>
            </select>

            <select id="financeStatusFilter">
              <option value="all">كل الحالات</option>
              <option value="new">جديد</option>
              <option value="processing">قيد المعالجة</option>
              <option value="delivered">تم التسليم</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
        </section>

        <section class="card" style="padding:12px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            <div>
              <h2 style="margin:0 0 4px; font-size:1rem;">ملخص الصفحات</h2>
              <p style="margin:0; font-size:11px; color:var(--muted);">أرباح كل صفحة وعدد طلباتها</p>
            </div>
          </div>
          <div id="pagesFinanceSummary"></div>
        </section>

        <section class="card" style="padding:12px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            <div>
              <h2 style="margin:0 0 4px; font-size:1rem;">إدارة الطلبات</h2>
              <p style="margin:0; font-size:11px; color:var(--muted);">متابعة الطلبات وتعديل حالتها</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button
                id="deleteFakeOrdersBtn"
                type="button"
                class="secondary"
                style="min-height:30px; padding:6px 10px; font-size:11px;"
              >
                حذف الطلبات الوهمية
              </button>
              <span id="ordersCountBadge" class="badge">0 طلب</span>
            </div>
          </div>
          <div id="ordersListWrap"></div>
        </section>

        <div id="statusModalOverlay" style="
          display:none;
          position:fixed;
          inset:0;
          background:rgba(15,23,42,.35);
          z-index:1000;
        "></div>

        <div id="statusModal" style="
          display:none;
          position:fixed;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          width:min(92vw,520px);
          background:#fff;
          border-radius:18px;
          padding:16px;
          box-shadow:0 18px 50px rgba(15,23,42,.2);
          z-index:1001;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
            <div>
              <h3 style="margin:0 0 4px; font-size:1.05rem;">تعديل حالة الطلب</h3>
              <p style="margin:0; font-size:11px; color:var(--muted);">اختر الحالة المناسبة ثم احفظ</p>
            </div>
            <button id="closeStatusModalBtn" type="button" class="secondary" style="min-height:30px; padding:6px 10px;">إغلاق</button>
          </div>

          <div class="grid" style="gap:10px;">
            <select id="statusModalSelect">
              <option value="new">جديد</option>
              <option value="processing">قيد المعالجة</option>
              <option value="delivered">تم التسليم</option>
              <option value="rejected">مرفوض</option>
            </select>

            <div style="display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
              <button id="cancelStatusModalBtn" type="button" class="secondary">إلغاء</button>
              <button id="saveStatusModalBtn" type="button">حفظ الحالة</button>
            </div>
          </div>
        </div>
      `;

      main.appendChild(wrapper);
    }
  }

  function getElements() {
    return {
      statsWrap: document.getElementById("financialStatsCards"),
      pageFilter: document.getElementById("financePageFilter"),
      statusFilter: document.getElementById("financeStatusFilter"),
      pagesFinanceSummary: document.getElementById("pagesFinanceSummary"),
      ordersListWrap: document.getElementById("ordersListWrap"),
      ordersCountBadge: document.getElementById("ordersCountBadge"),
      pagesContainer: document.getElementById("pagesContainer"),
      pagesCountBadge: document.getElementById("pagesCountBadge"),
      totalPagesStat: document.getElementById("totalPagesStat"),
      activePagesStat: document.getElementById("activePagesStat"),
      dashboardStatusStat: document.getElementById("dashboardStatusStat"),
      statusModal: document.getElementById("statusModal"),
      statusModalOverlay: document.getElementById("statusModalOverlay"),
      statusModalSelect: document.getElementById("statusModalSelect"),
      closeStatusModalBtn: document.getElementById("closeStatusModalBtn"),
      cancelStatusModalBtn: document.getElementById("cancelStatusModalBtn"),
      saveStatusModalBtn: document.getElementById("saveStatusModalBtn"),
      deleteFakeOrdersBtn: document.getElementById("deleteFakeOrdersBtn"),
      addPageBtn: document.getElementById("addPageBtn"),
      logoutBtn: document.getElementById("logoutBtn"),
      addFormWrapper: document.getElementById("addFormWrapper"),
      addForm: document.getElementById("addForm"),
      formMessage: document.getElementById("formMessage"),
      editingId: document.getElementById("editingId"),
      formTitle: document.getElementById("formTitle"),
      formModeBadge: document.getElementById("formModeBadge"),
      titleInput: document.getElementById("title"),
      descriptionInput: document.getElementById("description"),
      priceInput: document.getElementById("price"),
      productCostInput: document.getElementById("productCost"),
      deliveryCostInput: document.getElementById("deliveryCost"),
      slugInput: document.getElementById("slug"),
      templateInput: document.getElementById("template"),
      telegramTokenInput: document.getElementById("telegramToken"),
      telegramChatIdInput: document.getElementById("telegramChatId"),
      verifyBotBtn: document.getElementById("verifyBotBtn"),
      fetchChatIdBtn: document.getElementById("fetchChatIdBtn"),
      cancelAddBtn: document.getElementById("cancelAddBtn"),
      saveBtn: document.getElementById("saveBtn")
    };
  }

  function normalizeSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
  }

  function setFormMessage(message, type = "error") {
    const { formMessage } = getElements();
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.className = type;
    formMessage.style.display = message ? "block" : "none";
  }

  function resetPageForm() {
    const {
      addForm,
      editingId,
      titleInput,
      descriptionInput,
      priceInput,
      productCostInput,
      deliveryCostInput,
      slugInput,
      templateInput,
      telegramTokenInput,
      telegramChatIdInput
    } = getElements();

    addForm?.reset();
    if (editingId) editingId.value = "";
    if (titleInput) titleInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (priceInput) priceInput.value = "";
    if (productCostInput) productCostInput.value = "";
    if (deliveryCostInput) deliveryCostInput.value = "";
    if (slugInput) slugInput.value = "";
    if (templateInput) templateInput.value = "classic";
    if (telegramTokenInput) telegramTokenInput.value = "";
    if (telegramChatIdInput) telegramChatIdInput.value = "";
    setFormMessage("");
  }

  function openPageForm(mode = "create", page = null) {
    const {
      addFormWrapper,
      editingId,
      formTitle,
      formModeBadge,
      titleInput,
      descriptionInput,
      priceInput,
      productCostInput,
      deliveryCostInput,
      slugInput,
      templateInput,
      telegramTokenInput,
      telegramChatIdInput
    } = getElements();

    if (!addFormWrapper) return;

    addFormWrapper.style.display = "block";

    if (mode === "edit" && page) {
      if (formTitle) formTitle.textContent = "تعديل الصفحة";
      if (formModeBadge) formModeBadge.textContent = "تعديل";
      if (editingId) editingId.value = String(page.id);
      if (titleInput) titleInput.value = page.title || "";
      if (descriptionInput) descriptionInput.value = page.description || "";
      if (priceInput) priceInput.value = page.price ?? "";
      if (productCostInput) productCostInput.value = page.product_cost ?? "";
      if (deliveryCostInput) deliveryCostInput.value = page.delivery_cost ?? "";
      if (slugInput) slugInput.value = page.slug || "";
      if (templateInput) templateInput.value = page.template || "classic";
      if (telegramTokenInput) telegramTokenInput.value = page.telegram_token || "";
      if (telegramChatIdInput) telegramChatIdInput.value = page.telegram_chat_id || "";
    } else {
      resetPageForm();
      if (formTitle) formTitle.textContent = "إنشاء صفحة";
      if (formModeBadge) formModeBadge.textContent = "إضافة";
    }

    setFormMessage("");
    addFormWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closePageForm() {
    const { addFormWrapper } = getElements();
    if (addFormWrapper) addFormWrapper.style.display = "none";
    resetPageForm();
  }

  function getPageFormPayload() {
    const {
      titleInput,
      descriptionInput,
      priceInput,
      productCostInput,
      deliveryCostInput,
      slugInput,
      templateInput,
      telegramTokenInput,
      telegramChatIdInput
    } = getElements();

    const title = String(titleInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();
    const slug = normalizeSlug(slugInput?.value);
    const price = Number(priceInput?.value || 0);
    const productCost = Number(productCostInput?.value || 0);
    const deliveryCost = Number(deliveryCostInput?.value || 0);
    const template = String(templateInput?.value || "classic").trim();
    const telegramToken = String(telegramTokenInput?.value || "").trim();
    const telegramChatId = String(telegramChatIdInput?.value || "").trim();

    if (
      !title ||
      !description ||
      !slug ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(productCost) ||
      productCost < 0 ||
      !Number.isFinite(deliveryCost) ||
      deliveryCost < 0
    ) {
      return { error: "يرجى تعبئة الحقول المطلوبة بشكل صحيح" };
    }

    return {
      payload: {
        title,
        description,
        slug,
        price,
        product_cost: productCost,
        delivery_cost: deliveryCost,
        template,
        telegram_token: telegramToken || null,
        telegram_chat_id: telegramChatId || null
      }
    };
  }

  function looksFakeOrder(order) {
    const fields = [
      order.name,
      order.phone,
      order.province,
      order.district,
      order.area
    ]
      .map((value) => String(value || ""))
      .join(" ")
      .trim()
      .toLowerCase();

    if (!fields) return true;
    if (FAKE_ORDER_PATTERNS.some((pattern) => pattern.test(fields))) return true;

    const phoneDigits = String(order.phone || "").replace(/\D/g, "");
    if (!phoneDigits) return true;
    if (/^(.)\1{6,}$/.test(phoneDigits)) return true;

    const knownFakePhones = new Set([
      "0000000000",
      "1111111111",
      "1234567890",
      "1231231234",
      "9999999999"
    ]);

    return knownFakePhones.has(phoneDigits);
  }

  function openStatusModal(orderId, currentStatus) {
    const { statusModal, statusModalOverlay, statusModalSelect } = getElements();
    selectedOrderId = orderId;

    if (statusModalSelect) {
      statusModalSelect.value = STATUS_OPTIONS.includes(currentStatus) ? currentStatus : "new";
    }

    if (statusModal) statusModal.style.display = "block";
    if (statusModalOverlay) statusModalOverlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  function closeStatusModal() {
    const { statusModal, statusModalOverlay } = getElements();
    selectedOrderId = null;

    if (statusModal) statusModal.style.display = "none";
    if (statusModalOverlay) statusModalOverlay.style.display = "none";
    document.body.style.overflow = "";
  }

  function buildPagesMap() {
    const map = new Map();
    pages.forEach((page) => map.set(String(page.id), page));
    return map;
  }

  function computeGlobalStats(sourceOrders) {
    let totalOrders = sourceOrders.length;
    let deliveredOrders = 0;
    let rejectedOrders = 0;
    let processingOrders = 0;
    let newOrders = 0;

    let totalRevenue = 0;
    let totalProductCost = 0;
    let totalDeliveryCost = 0;
    let totalNetProfit = 0;

    const pagesMap = buildPagesMap();

    sourceOrders.forEach((order) => {
      const page = pagesMap.get(String(order.landing_id));
      if (!page) return;

      const price = Number(page.price || 0);
      const productCost = Number(page.product_cost || 0);
      const deliveryCost = Number(page.delivery_cost || 0);

      if (order.status === "delivered") {
        deliveredOrders += 1;
        totalRevenue += price;
        totalProductCost += productCost;
        totalDeliveryCost += deliveryCost;
        totalNetProfit += price - productCost - deliveryCost;
      } else if (order.status === "rejected") {
        rejectedOrders += 1;
      } else if (order.status === "processing") {
        processingOrders += 1;
      } else {
        newOrders += 1;
      }
    });

    return {
      totalOrders,
      deliveredOrders,
      rejectedOrders,
      processingOrders,
      newOrders,
      totalRevenue,
      totalProductCost,
      totalDeliveryCost,
      totalNetProfit
    };
  }

  function computePageSummary(page, sourceOrders) {
    const pageOrders = sourceOrders.filter((order) => String(order.landing_id) === String(page.id));

    const totalOrders = pageOrders.length;
    const deliveredOrders = pageOrders.filter((o) => o.status === "delivered").length;
    const rejectedOrders = pageOrders.filter((o) => o.status === "rejected").length;
    const processingOrders = pageOrders.filter((o) => o.status === "processing").length;
    const newOrders = pageOrders.filter((o) => o.status === "new").length;

    const sellingPrice = Number(page.price || 0);
    const productCost = Number(page.product_cost || 0);
    const deliveryCost = Number(page.delivery_cost || 0);

    const revenue = deliveredOrders * sellingPrice;
    const productsTotal = deliveredOrders * productCost;
    const deliveryTotal = deliveredOrders * deliveryCost;
    const netProfit = revenue - productsTotal - deliveryTotal;

    return {
      totalOrders,
      deliveredOrders,
      rejectedOrders,
      processingOrders,
      newOrders,
      revenue,
      productsTotal,
      deliveryTotal,
      netProfit
    };
  }

  function renderStatsCards() {
    const { statsWrap } = getElements();
    if (!statsWrap) return;

    const stats = computeGlobalStats(filteredOrders);

    statsWrap.innerHTML = `
      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px;">الطلبات</div>
        <h3 style="margin:0 0 6px; font-size:12px;">إجمالي الطلبات</h3>
        <p style="margin:0; font-size:1.35rem; font-weight:800;">${money(stats.totalOrders)}</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px; background:#ecfdf5; color:#16a34a;">التسليم</div>
        <h3 style="margin:0 0 6px; font-size:12px;">الطلبات المسلمة</h3>
        <p style="margin:0; font-size:1.35rem; font-weight:800; color:#16a34a;">${money(stats.deliveredOrders)}</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px; background:#fef2f2; color:#dc2626;">الرفض</div>
        <h3 style="margin:0 0 6px; font-size:12px;">الطلبات المرفوضة</h3>
        <p style="margin:0; font-size:1.35rem; font-weight:800; color:#dc2626;">${money(stats.rejectedOrders)}</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px;">الإيرادات</div>
        <h3 style="margin:0 0 6px; font-size:12px;">إجمالي الإيرادات</h3>
        <p style="margin:0; font-size:1.25rem; font-weight:800; color:#1d4ed8;">${money(stats.totalRevenue)} دينار</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px;">تكلفة المنتج</div>
        <h3 style="margin:0 0 6px; font-size:12px;">مجموع تكلفة المنتجات</h3>
        <p style="margin:0; font-size:1.25rem; font-weight:800;">${money(stats.totalProductCost)} دينار</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px;">التوصيل</div>
        <h3 style="margin:0 0 6px; font-size:12px;">مجموع تكلفة التوصيل</h3>
        <p style="margin:0; font-size:1.25rem; font-weight:800;">${money(stats.totalDeliveryCost)} دينار</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px; background:#ecfdf5; color:#15803d;">الربح</div>
        <h3 style="margin:0 0 6px; font-size:12px;">صافي الربح</h3>
        <p style="margin:0; font-size:1.35rem; font-weight:800; color:#15803d;">${money(stats.totalNetProfit)} دينار</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px; background:#eff6ff; color:#2563eb;">جديد</div>
        <h3 style="margin:0 0 6px; font-size:12px;">طلبات جديدة</h3>
        <p style="margin:0; font-size:1.25rem; font-weight:800; color:#2563eb;">${money(stats.newOrders)}</p>
      </div>

      <div class="card" style="padding:12px;">
        <div class="badge" style="margin-bottom:6px; background:#fff7ed; color:#ea580c;">المعالجة</div>
        <h3 style="margin:0 0 6px; font-size:12px;">قيد المعالجة</h3>
        <p style="margin:0; font-size:1.25rem; font-weight:800; color:#ea580c;">${money(stats.processingOrders)}</p>
      </div>
    `;
  }

  function renderPageFilterOptions() {
    const { pageFilter } = getElements();
    if (!pageFilter) return;

    const currentValue = pageFilter.value || "all";
    pageFilter.innerHTML = `<option value="all">كل الصفحات</option>`;

    pages.forEach((page) => {
      const option = document.createElement("option");
      option.value = String(page.id);
      option.textContent = page.title || "بدون عنوان";
      pageFilter.appendChild(option);
    });

    pageFilter.value = Array.from(pageFilter.options).some((opt) => opt.value === currentValue)
      ? currentValue
      : "all";
  }

  function renderPagesSummary() {
    const { pagesFinanceSummary } = getElements();
    if (!pagesFinanceSummary) return;

    if (!pages.length) {
      pagesFinanceSummary.innerHTML = `<div class="empty-state">لا توجد صفحات</div>`;
      return;
    }

    const cards = pages.map((page) => {
      const summary = computePageSummary(page, filteredOrders);

      return `
        <div class="page-card" style="padding:12px; border-radius:12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            <div>
              <h3 style="margin:0 0 4px; font-size:14px;">${escapeHtml(page.title || "")}</h3>
              <p style="margin:0; font-size:10px; color:var(--muted);">slug: ${escapeHtml(page.slug || "-")}</p>
            </div>
            <span class="badge">${page.is_active === false ? "موقفة" : "نشطة"}</span>
          </div>

          <div class="grid grid-3" style="gap:8px;">
            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">كل الطلبات</div>
              <div style="font-size:16px; font-weight:800;">${money(summary.totalOrders)}</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:#16a34a; margin-bottom:4px;">تم التسليم</div>
              <div style="font-size:16px; font-weight:800; color:#16a34a;">${money(summary.deliveredOrders)}</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:#dc2626; margin-bottom:4px;">مرفوض</div>
              <div style="font-size:16px; font-weight:800; color:#dc2626;">${money(summary.rejectedOrders)}</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">سعر البيع</div>
              <div style="font-size:15px; font-weight:800;">${money(page.price)} د.ع</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">تكلفة المنتج</div>
              <div style="font-size:15px; font-weight:800;">${money(page.product_cost)} د.ع</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">تكلفة التوصيل</div>
              <div style="font-size:15px; font-weight:800;">${money(page.delivery_cost)} د.ع</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:#1d4ed8; margin-bottom:4px;">الإيرادات</div>
              <div style="font-size:16px; font-weight:800; color:#1d4ed8;">${money(summary.revenue)} د.ع</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">مبلغ المنتجات</div>
              <div style="font-size:16px; font-weight:800;">${money(summary.productsTotal)} د.ع</div>
            </div>

            <div class="card" style="padding:8px;">
              <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">مبلغ التوصيل</div>
              <div style="font-size:16px; font-weight:800;">${money(summary.deliveryTotal)} د.ع</div>
            </div>
          </div>

          <div style="margin-top:8px; padding:10px; border-radius:10px; background:#f0fdf4; border:1px solid #dcfce7;">
            <div style="font-size:11px; color:#166534; margin-bottom:4px;">صافي الربح</div>
            <div style="font-size:18px; font-weight:900; color:#166534;">${money(summary.netProfit)} د.ع</div>
          </div>
        </div>
      `;
    });

    pagesFinanceSummary.innerHTML = cards.join("");
  }

  function renderOrders() {
    const { ordersListWrap, ordersCountBadge } = getElements();
    if (!ordersListWrap) return;

    if (ordersCountBadge) {
      ordersCountBadge.textContent = `${filteredOrders.length} طلب`;
    }

    if (!filteredOrders.length) {
      ordersListWrap.innerHTML = `<div class="empty-state">لا توجد طلبات مطابقة للفلاتر</div>`;
      return;
    }

    const pagesMap = buildPagesMap();

    const html = filteredOrders
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .map((order) => {
        const page = pagesMap.get(String(order.landing_id));
        const price = Number(page?.price || 0);
        const productCost = Number(page?.product_cost || 0);
        const deliveryCost = Number(page?.delivery_cost || 0);
        const netProfit = getPageNetProfit(order, page);

        return `
          <div class="page-card" style="padding:12px; border-radius:12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
              <div>
                <h3 style="margin:0 0 4px; font-size:14px;">طلب من: ${escapeHtml(page?.title || "بدون صفحة")}</h3>
                <p style="margin:0; font-size:10px; color:var(--muted);">
                  تاريخ الطلب: ${escapeHtml(order.created_at ? new Date(order.created_at).toLocaleString("en-GB") : "-")}
                </p>
              </div>

              <span style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                padding:4px 10px;
                border-radius:999px;
                font-size:11px;
                font-weight:800;
                color:#fff;
                background:${STATUS_COLORS[order.status] || "#64748b"};
              ">
                الحالة: ${STATUS_LABELS[order.status] || order.status}
              </span>
            </div>

            <div style="font-size:12px; line-height:1.8; margin-bottom:8px;">
              <div><strong>الاسم:</strong> ${escapeHtml(order.name)}</div>
              <div><strong>الهاتف:</strong> ${escapeHtml(order.phone)}</div>
              <div><strong>المحافظة:</strong> ${escapeHtml(order.province)}</div>
              <div><strong>القضاء / الحي:</strong> ${escapeHtml(order.district)}</div>
              <div><strong>المنطقة:</strong> ${escapeHtml(order.area)}</div>
            </div>

            <div class="grid grid-2" style="gap:8px; margin-bottom:8px;">
              <div class="card" style="padding:8px;">
                <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">سعر الطلب</div>
                <div style="font-size:15px; font-weight:800;">${money(price)} دينار</div>
              </div>

              <div class="card" style="padding:8px;">
                <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">تكلفة المنتج</div>
                <div style="font-size:15px; font-weight:800;">${money(productCost)} دينار</div>
              </div>

              <div class="card" style="padding:8px;">
                <div style="font-size:10px; color:var(--muted); margin-bottom:4px;">سعر التوصيل</div>
                <div style="font-size:15px; font-weight:800;">${money(deliveryCost)} دينار</div>
              </div>

              <div class="card" style="padding:8px;">
                <div style="font-size:10px; color:${order.status === "delivered" ? "#15803d" : "#64748b"}; margin-bottom:4px;">الربح الصافي</div>
                <div style="font-size:15px; font-weight:900; color:${order.status === "delivered" ? "#15803d" : "#64748b"};">
                  ${money(netProfit)} دينار
                </div>
              </div>
            </div>

            <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
              <button
                type="button"
                class="secondary change-status-btn"
                data-id="${escapeHtml(String(order.id))}"
                data-status="${escapeHtml(order.status)}"
                style="min-height:30px; padding:6px 10px; font-size:11px;"
              >
                تعديل الحالة
              </button>
              <button
                type="button"
                class="secondary delete-order-btn"
                data-id="${escapeHtml(String(order.id))}"
                style="min-height:30px; padding:6px 10px; font-size:11px; background:#fef2f2; color:#b91c1c;"
              >
                حذف الطلب
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    ordersListWrap.innerHTML = html;

    document.querySelectorAll(".change-status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openStatusModal(btn.dataset.id, btn.dataset.status);
      });
    });

    document.querySelectorAll(".delete-order-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await deleteOrder(btn.dataset.id);
      });
    });
  }

  function renderPagesOverview() {
    const {
      pagesContainer,
      pagesCountBadge,
      totalPagesStat,
      activePagesStat,
      dashboardStatusStat
    } = getElements();

    const totalPages = pages.length;
    const activePages = pages.filter((page) => page.is_active !== false).length;

    if (totalPagesStat) totalPagesStat.textContent = money(totalPages);
    if (activePagesStat) activePagesStat.textContent = money(activePages);
    if (pagesCountBadge) pagesCountBadge.textContent = `${money(totalPages)} صفحة`;
    if (dashboardStatusStat) dashboardStatusStat.textContent = "جاهز";

    if (!pagesContainer) return;

    if (!pages.length) {
      pagesContainer.innerHTML = `<div class="empty-state" style="padding:12px 8px;">لا توجد صفحات بعد</div>`;
      return;
    }

    pagesContainer.innerHTML = pages
      .map((page) => {
        const pageTitle = escapeHtml(page.title || "بدون عنوان");
        const pageSlug = escapeHtml(page.slug || "-");
        const createdAt = page.created_at
          ? new Date(page.created_at).toLocaleString("en-GB")
          : "-";

        return `
          <article class="page-card" style="padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
              <div>
                <h3 style="margin:0 0 4px; font-size:13px;">${pageTitle}</h3>
                <p style="margin:0; font-size:10px; color:var(--muted);">slug: ${pageSlug}</p>
                <p style="margin:2px 0 0; font-size:10px; color:var(--muted);">${escapeHtml(createdAt)}</p>
              </div>
              <span class="badge" style="background:${page.is_active === false ? "#fef2f2" : "#ecfdf5"}; color:${page.is_active === false ? "#dc2626" : "#15803d"};">
                ${page.is_active === false ? "موقفة" : "نشطة"}
              </span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; flex-direction:column; gap:2px;">
                <strong style="font-size:13px;">${money(page.price)} د.ع</strong>
                <span style="font-size:10px; color:var(--muted);">
                  جملة: ${money(page.product_cost)} د.ع | توصيل: ${money(page.delivery_cost)} د.ع
                </span>
              </div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <button
                  type="button"
                  class="secondary edit-page-btn"
                  data-id="${escapeHtml(String(page.id))}"
                  style="min-height:30px; padding:6px 10px; font-size:11px;"
                >
                  تعديل الصفحة
                </button>
                <button
                  type="button"
                  class="secondary delete-page-orders-btn"
                  data-id="${escapeHtml(String(page.id))}"
                  style="min-height:30px; padding:6px 10px; font-size:11px; background:#fef2f2; color:#b91c1c;"
                >
                  حذف كل الطلبات
                </button>
                <button
                  type="button"
                  class="secondary delete-page-btn"
                  data-id="${escapeHtml(String(page.id))}"
                  style="min-height:30px; padding:6px 10px; font-size:11px; background:#fee2e2; color:#991b1b;"
                >
                  حذف الصفحة
                </button>
                <a href="landing.html?slug=${encodeURIComponent(page.slug || "")}" class="btn" style="min-height:30px; padding:6px 10px; font-size:11px; text-decoration:none;">
                  فتح الصفحة
                </a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    document.querySelectorAll(".edit-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = pages.find((item) => String(item.id) === String(btn.dataset.id));
        if (!page) {
          showAlert("تعذر العثور على الصفحة");
          return;
        }
        openPageForm("edit", page);
      });
    });

    document.querySelectorAll(".delete-page-orders-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await deleteAllOrdersForPage(btn.dataset.id);
      });
    });

    document.querySelectorAll(".delete-page-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await deletePage(btn.dataset.id);
      });
    });
  }

  function applyFilters() {
    const { pageFilter, statusFilter } = getElements();
    const selectedPage = pageFilter?.value || "all";
    const selectedStatus = statusFilter?.value || "all";

    filteredOrders = orders.filter((order) => {
      const pageMatch = selectedPage === "all" ? true : String(order.landing_id) === String(selectedPage);
      const statusMatch = selectedStatus === "all" ? true : order.status === selectedStatus;
      return pageMatch && statusMatch;
    });

    renderStatsCards();
    renderPagesSummary();
    renderOrders();
  }

  async function loadPages() {
    const { data, error } = await supabaseClient
      .from("landing_pages")
      .select("id,title,description,slug,price,template,telegram_token,telegram_chat_id,product_cost,delivery_cost,is_active,created_at,user_id")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadPages error:", error);
      throw new Error("تعذر جلب الصفحات");
    }

    pages = data || [];
  }

  async function loadOrders() {
    if (!pages.length) {
      orders = [];
      return;
    }

    const landingIds = pages.map((page) => page.id);

    const { data, error } = await supabaseClient
      .from("orders")
      .select("id,landing_id,name,phone,province,district,area,status,created_at,updated_at")
      .in("landing_id", landingIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadOrders error:", error);
      throw new Error("تعذر جلب الطلبات");
    }

    orders = (data || []).map((order) => ({
      ...order,
      status: STATUS_OPTIONS.includes(order.status) ? order.status : "new"
    }));
  }

  async function deleteOrder(orderId) {
    if (!orderId) return;

    const target = orders.find((order) => String(order.id) === String(orderId));
    const orderName = target?.name ? ` (${target.name})` : "";
    const confirmed = window.confirm(`حذف هذا الطلب${orderName}؟ لا يمكن التراجع.`);
    if (!confirmed) return;

    const { error } = await supabaseClient
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      console.error("deleteOrder error:", error);
      showAlert("فشل حذف الطلب: " + (error.message || "خطأ غير معروف"));
      return;
    }

    orders = orders.filter((order) => String(order.id) !== String(orderId));
    if (String(selectedOrderId) === String(orderId)) closeStatusModal();
    applyFilters();
    showAlert("تم حذف الطلب");
  }

  async function deleteFakeOrders() {
    const fakeOrders = orders.filter((order) => looksFakeOrder(order));

    if (!fakeOrders.length) {
      showAlert("لا توجد طلبات وهمية مطابقة للمعايير");
      return;
    }

    const fakeIds = fakeOrders.map((order) => order.id);
    const confirmed = window.confirm(
      `تم العثور على ${fakeIds.length} طلب وهمي. هل تريد حذفها الآن؟`
    );
    if (!confirmed) return;

    const { error } = await supabaseClient
      .from("orders")
      .delete()
      .in("id", fakeIds);

    if (error) {
      console.error("deleteFakeOrders error:", error);
      showAlert("فشل حذف الطلبات الوهمية: " + (error.message || "خطأ غير معروف"));
      return;
    }

    const fakeIdSet = new Set(fakeIds.map((id) => String(id)));
    orders = orders.filter((order) => !fakeIdSet.has(String(order.id)));
    closeStatusModal();
    applyFilters();
    showAlert(`تم حذف ${fakeIds.length} طلب وهمي`);
  }

  async function deleteAllOrdersForPage(pageId) {
    if (!pageId) return;

    const page = pages.find((item) => String(item.id) === String(pageId));
    if (!page) {
      showAlert("تعذر العثور على الصفحة");
      return;
    }

    const pageOrders = orders.filter((order) => String(order.landing_id) === String(pageId));
    if (!pageOrders.length) {
      showAlert("لا توجد طلبات لهذه الصفحة");
      return;
    }

    const confirmed = window.confirm(
      `سيتم حذف ${pageOrders.length} طلب من صفحة "${page.title || "بدون عنوان"}" نهائيًا من قاعدة البيانات. هل تريد المتابعة؟`
    );
    if (!confirmed) return;

    const { error } = await supabaseClient
      .from("orders")
      .delete()
      .eq("landing_id", pageId);

    if (error) {
      console.error("deleteAllOrdersForPage error:", error);
      showAlert("فشل حذف طلبات الصفحة: " + (error.message || "خطأ غير معروف"));
      return;
    }

    orders = orders.filter((order) => String(order.landing_id) !== String(pageId));
    if (selectedOrderId && !orders.some((order) => String(order.id) === String(selectedOrderId))) {
      closeStatusModal();
    }
    applyFilters();
    showAlert(`تم حذف كل طلبات صفحة "${page.title || "بدون عنوان"}"`);
  }

  async function deletePage(pageId) {
    if (!pageId) return;

    const page = pages.find((item) => String(item.id) === String(pageId));
    if (!page) {
      showAlert("تعذر العثور على الصفحة");
      return;
    }

    const pageOrdersCount = orders.filter((order) => String(order.landing_id) === String(pageId)).length;
    const confirmed = window.confirm(
      pageOrdersCount > 0
        ? `سيتم حذف صفحة "${page.title || "بدون عنوان"}" مع ${pageOrdersCount} طلب مرتبط بها نهائيًا من قاعدة البيانات. هل تريد المتابعة؟`
        : `سيتم حذف صفحة "${page.title || "بدون عنوان"}" نهائيًا من قاعدة البيانات. هل تريد المتابعة؟`
    );
    if (!confirmed) return;

    const { error: ordersError } = await supabaseClient
      .from("orders")
      .delete()
      .eq("landing_id", pageId);

    if (ordersError) {
      console.error("deletePage orders error:", ordersError);
      showAlert("فشل حذف طلبات الصفحة: " + (ordersError.message || "خطأ غير معروف"));
      return;
    }

    const { error: pageError } = await supabaseClient
      .from("landing_pages")
      .delete()
      .eq("id", pageId)
      .eq("user_id", currentUser.id);

    if (pageError) {
      console.error("deletePage page error:", pageError);
      showAlert("فشل حذف الصفحة: " + (pageError.message || "خطأ غير معروف"));
      return;
    }

    pages = pages.filter((item) => String(item.id) !== String(pageId));
    orders = orders.filter((order) => String(order.landing_id) !== String(pageId));

    const { editingId } = getElements();
    if (String(editingId?.value || "") === String(pageId)) {
      closePageForm();
    }

    if (selectedOrderId && !orders.some((order) => String(order.id) === String(selectedOrderId))) {
      closeStatusModal();
    }

    renderPagesOverview();
    renderPageFilterOptions();
    applyFilters();
    showAlert(`تم حذف صفحة "${page.title || "بدون عنوان"}" بنجاح`);
  }

  async function savePage(event) {
    event.preventDefault();

    const { editingId, saveBtn } = getElements();
    const { payload, error: payloadError } = getPageFormPayload();
    if (payloadError) {
      setFormMessage(payloadError, "error");
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "جاري الحفظ...";
    }

    try {
      setFormMessage("", "error");
      const pageId = String(editingId?.value || "").trim();
      let query;

      if (pageId) {
        query = supabaseClient
          .from("landing_pages")
          .update(payload)
          .eq("id", pageId)
          .eq("user_id", currentUser.id)
          .select("id")
          .single();
      } else {
        query = supabaseClient
          .from("landing_pages")
          .insert([
            {
              ...payload,
              user_id: currentUser.id,
              is_active: true
            }
          ])
          .select("id")
          .single();
      }

      const { error } = await query;

      if (error) {
        console.error("savePage error:", error);
        setFormMessage("فشل حفظ الصفحة: " + (error.message || "خطأ غير معروف"), "error");
        return;
      }

      await loadPages();
      renderPagesOverview();
      renderPageFilterOptions();
      await loadOrders();
      applyFilters();
      closePageForm();
      showAlert(pageId ? "تم تعديل الصفحة بنجاح" : "تم إنشاء الصفحة بنجاح");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "حفظ";
      }
    }
  }

  async function verifyTelegramBot() {
    const { telegramTokenInput, verifyBotBtn } = getElements();
    const token = String(telegramTokenInput?.value || "").trim();
    if (!token) {
      setFormMessage("أدخل Bot Token أولاً", "error");
      return;
    }

    if (verifyBotBtn) {
      verifyBotBtn.disabled = true;
      verifyBotBtn.textContent = "جاري الفحص...";
    }

    try {
      const response = await fetch("/.netlify/functions/telegram-get-chat-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          mode: "verify"
        })
      });
      const data = await response.json();
      if (!data.ok) {
        setFormMessage(data.error || "فشل التحقق من البوت", "error");
        return;
      }
      setFormMessage(`تم التحقق من البوت: ${data.bot_name || "Bot"}`, "success");
    } catch (error) {
      setFormMessage("تعذر التحقق من البوت", "error");
    } finally {
      if (verifyBotBtn) {
        verifyBotBtn.disabled = false;
        verifyBotBtn.textContent = "فحص البوت";
      }
    }
  }

  async function fetchTelegramChatId() {
    const { telegramTokenInput, telegramChatIdInput, fetchChatIdBtn } = getElements();
    const token = String(telegramTokenInput?.value || "").trim();
    if (!token) {
      setFormMessage("أدخل Bot Token أولاً", "error");
      return;
    }

    if (fetchChatIdBtn) {
      fetchChatIdBtn.disabled = true;
      fetchChatIdBtn.textContent = "جاري الجلب...";
    }

    try {
      const response = await fetch("/.netlify/functions/telegram-get-chat-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (!data.ok || !data.chat_id) {
        setFormMessage(data.error || "تعذر جلب Chat ID", "error");
        return;
      }
      if (telegramChatIdInput) telegramChatIdInput.value = data.chat_id;
      setFormMessage("تم جلب Chat ID بنجاح", "success");
    } catch (error) {
      setFormMessage("تعذر جلب Chat ID", "error");
    } finally {
      if (fetchChatIdBtn) {
        fetchChatIdBtn.disabled = false;
        fetchChatIdBtn.textContent = "جلب Chat ID";
      }
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
    if (!STATUS_OPTIONS.includes(newStatus)) {
      showAlert("الحالة غير صالحة");
      return;
    }

    const { error } = await supabaseClient
      .from("orders")
      .update({
        status: newStatus
      })
      .eq("id", orderId);

    if (error) {
      console.error("updateOrderStatus error:", error);
      showAlert("خطأ: " + (error.message || "فشل تحديث الحالة"));
      return;
    }

    const target = orders.find((o) => String(o.id) === String(orderId));
    if (target) target.status = newStatus;

    closeStatusModal();
    applyFilters();
    showAlert("تم تحديث الحالة بنجاح");
  }

  async function ensureSession() {
    const {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();

    if (error || !session) {
      window.location.href = "login.html";
      return false;
    }

    currentUser = session.user;
    return true;
  }

  function bindEvents() {
    const {
      pageFilter,
      statusFilter,
      closeStatusModalBtn,
      cancelStatusModalBtn,
      saveStatusModalBtn,
      statusModalOverlay,
      statusModalSelect,
      deleteFakeOrdersBtn,
      addPageBtn,
      logoutBtn,
      addForm,
      cancelAddBtn,
      verifyBotBtn,
      fetchChatIdBtn
    } = getElements();

    pageFilter?.addEventListener("change", applyFilters);
    statusFilter?.addEventListener("change", applyFilters);

    closeStatusModalBtn?.addEventListener("click", closeStatusModal);
    cancelStatusModalBtn?.addEventListener("click", closeStatusModal);
    statusModalOverlay?.addEventListener("click", closeStatusModal);

    saveStatusModalBtn?.addEventListener("click", async () => {
      if (!selectedOrderId) return;
      const selectedStatus = statusModalSelect?.value || "new";
      await updateOrderStatus(selectedOrderId, selectedStatus);
    });

    deleteFakeOrdersBtn?.addEventListener("click", async () => {
      await deleteFakeOrders();
    });

    addPageBtn?.addEventListener("click", () => {
      openPageForm("create");
    });

    cancelAddBtn?.addEventListener("click", closePageForm);
    addForm?.addEventListener("submit", savePage);

    verifyBotBtn?.addEventListener("click", async () => {
      await verifyTelegramBot();
    });

    fetchChatIdBtn?.addEventListener("click", async () => {
      await fetchTelegramChatId();
    });

    logoutBtn?.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
    });
  }

  async function init() {
    try {
      ensureFinanceLayout();

      const hasSession = await ensureSession();
      if (!hasSession) return;

      const { dashboardStatusStat } = getElements();
      if (dashboardStatusStat) dashboardStatusStat.textContent = "جاري التحميل";

      bindEvents();

      await loadPages();
      renderPagesOverview();
      await loadOrders();

      renderPageFilterOptions();
      applyFilters();
    } catch (error) {
      console.error(error);
      const main = getMainContainer();
      const { pagesContainer, dashboardStatusStat } = getElements();

      if (dashboardStatusStat) dashboardStatusStat.textContent = "حدث خطأ";
      if (pagesContainer) {
        pagesContainer.innerHTML = `
          <div class="error" style="padding:12px 8px;">
            ${escapeHtml(error.message || "تعذر تحميل الصفحات")}
          </div>
        `;
      }

      main.innerHTML += `
        <div class="error" style="margin-top:12px;">
          ${escapeHtml(error.message || "حدث خطأ أثناء تحميل القسم المالي")}
        </div>
      `;
    }
  }

  await init();
});

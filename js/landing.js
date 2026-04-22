document.addEventListener("DOMContentLoaded", async () => {
  const pageTitle = document.getElementById("pageTitle");
  const landingContainer = document.getElementById("landingContainer");
  const orderForm = document.getElementById("orderForm");
  const messageBox = document.getElementById("message");
  const stickyPrice = document.getElementById("stickyPrice");
  const openOrderFormBtn = document.getElementById("openOrderFormBtn");
  const closeOrderFormBtn = document.getElementById("closeOrderFormBtn");
  const orderModal = document.getElementById("orderModal");
  const orderModalOverlay = document.getElementById("orderModalOverlay");

  let currentLandingId = null;
  const STATUS_CONSTRAINT_NAME = "orders_status_check";
  const STATUS_FALLBACK_VALUES = ["new", "pending", "submitted", "created", "open"];

  async function insertOrder(payload) {
    return supabaseClient
      .from("orders")
      .insert([payload]);
  }

  function isStatusConstraintError(error) {
    if (!error) return false;

    const text = [
      error.message,
      error.details,
      error.hint,
      error.code
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(STATUS_CONSTRAINT_NAME) || text.includes("status_check");
  }

  async function insertOrderWithStatusFallback(payload) {
    let result = await insertOrder(payload);

    if (!isStatusConstraintError(result.error)) {
      return result;
    }

    for (const status of STATUS_FALLBACK_VALUES) {
      result = await insertOrder({
        ...payload,
        status
      });

      if (!result.error) {
        return result;
      }
    }

    return result;
  }

  function showMessage(text, type = "error") {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = type;
    messageBox.style.display = text ? "block" : "none";
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function openOrderModal() {
    if (orderModal) orderModal.style.display = "block";
    if (orderModalOverlay) orderModalOverlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  function closeOrderModal() {
    if (orderModal) orderModal.style.display = "none";
    if (orderModalOverlay) orderModalOverlay.style.display = "none";
    document.body.style.overflow = "";
  }

  function renderGallery(images) {
    if (!images.length) {
      return `
        <div class="card" style="padding:12px; margin-bottom:10px;">
          <div class="empty-state">لا توجد صور مضافة لهذه الصفحة</div>
        </div>
      `;
    }

    const mainImage = images[0];

    return `
      <div class="card" style="padding:8px; margin-bottom:10px;">
        <img
          id="mainProductImage"
          src="${mainImage}"
          alt="صورة المنتج"
          style="
            width:100%;
            height:260px;
            object-fit:cover;
            border-radius:10px;
            display:block;
            margin-bottom:${images.length > 1 ? "8px" : "0"};
            background:#f1f5f9;
          "
        />

        ${
          images.length > 1
            ? `
          <div
            style="
              display:flex;
              gap:6px;
              overflow:auto;
              padding-bottom:2px;
              scrollbar-width:none;
            "
          >
            ${images
              .map(
                (img, index) => `
              <img
                src="${img}"
                alt="صورة ${index + 1}"
                class="gallery-thumb"
                style="
                  width:74px;
                  height:74px;
                  object-fit:cover;
                  border-radius:8px;
                  border:1px solid #dbe4f0;
                  flex:0 0 auto;
                  cursor:pointer;
                  background:#f1f5f9;
                "
              />
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  function renderTemplate(page) {
    const images =
      Array.isArray(page.image_urls) && page.image_urls.length
        ? page.image_urls.filter(Boolean)
        : page.image_url
        ? [page.image_url]
        : [];

    return `
      ${renderGallery(images)}

      <section class="card" style="padding:10px;">
        <h2 style="font-size:16px; margin:0 0 6px; line-height:1.5;">
          ${escapeHtml(page.title)}
        </h2>

        <div style="font-size: 24px; font-weight: bold; color: #b91c1c; margin-bottom: 12px; background: #fee2e2; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #fecaca;">
          ${Number(page.price ?? 0).toLocaleString('en-US')} دينار عراقي
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          <span class="badge">طلب سريع</span>
        </div>

        <p style="font-size:11px; color:#475569; line-height:1.75; margin:0;">
          ${escapeHtml(page.description || "")}
        </p>
      </section>
    `;
  }

  function bindGalleryClicks() {
    const mainImage = document.getElementById("mainProductImage");
    const thumbs = document.querySelectorAll(".gallery-thumb");

    if (!mainImage || !thumbs.length) return;

    thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        mainImage.src = thumb.src;
      });
    });
  }

  openOrderFormBtn?.addEventListener("click", openOrderModal);
  closeOrderFormBtn?.addEventListener("click", closeOrderModal);
  orderModalOverlay?.addEventListener("click", closeOrderModal);

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    pageTitle.textContent = "الصفحة غير موجودة";
    landingContainer.innerHTML = `<div class="empty-state">لا يوجد slug في الرابط</div>`;
    return;
  }

  const { data: page, error } = await supabaseClient
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !page) {
    pageTitle.textContent = "الصفحة غير موجودة";
    landingContainer.innerHTML = `<div class="empty-state">تعذر العثور على الصفحة</div>`;
    return;
  }

  currentLandingId = page.id;
  pageTitle.textContent = page.title || "صفحة المنتج";
  if (stickyPrice) {
    stickyPrice.textContent = `${Number(page.price ?? 0).toLocaleString('en-US')} دينار عراقي`;
  }

  landingContainer.innerHTML = renderTemplate(page);
  bindGalleryClicks();

  try {
    await supabaseClient.rpc("increment_landing_views", {
      page_slug: slug
    });
  } catch (rpcError) {
    console.warn("increment_landing_views failed:", rpcError);
  }

  orderForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
    const province = document.getElementById("province")?.value.trim() || "";
    const district = document.getElementById("district")?.value.trim() || "";
    const area = document.getElementById("area")?.value.trim() || "";

    if (!name || !phone || !province || !district || !area) {
      showMessage("املأ كل الحقول");
      return;
    }

    showMessage("جاري إرسال الطلب...", "success");

    const { error: orderError } = await insertOrderWithStatusFallback({
      landing_id: currentLandingId,
      name,
      phone,
      province,
      district,
      area
    });

    if (orderError) {
      console.error("Order insert error:", orderError);
      showMessage("فشل حفظ الطلب: " + (orderError.message || "خطأ غير معروف"));
      return;
    }

    try {
      const res = await fetch("/.netlify/functions/telegram-send-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          landing_id: currentLandingId,
          name,
          phone,
          province,
          district,
          area
        })
      });

      const data = await res.json();
      console.log("telegram response:", data);

      if (!data.ok) {
        showMessage("تم حفظ الطلب لكن فشل إرسال البوت: " + (data.error || "خطأ غير معروف"));
        orderForm.reset();
        return;
      }

      showMessage("تم إرسال الطلب بنجاح", "success");
      orderForm.reset();

      setTimeout(() => {
        closeOrderModal();
      }, 500);
    } catch (telegramError) {
      console.error("Telegram function error:", telegramError);
      showMessage("تم حفظ الطلب لكن فشل استدعاء البوت");
    }
  });
});

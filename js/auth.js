document.addEventListener("DOMContentLoaded", () => {
  const messageBox = document.getElementById("message");

  function showMessage(text, type = "error") {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = type;
  }

  // =========================
  // Login
  // =========================
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");

      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value.trim() : "";

      showMessage("", "error");

      if (!email || !password) {
        showMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور", "error");
        return;
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        showMessage("فشل تسجيل الدخول: " + error.message, "error");
        return;
      }

      if (data.user) {
        showMessage("تم تسجيل الدخول بنجاح", "success");

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 800);
      }
    });
  }

  // =========================
  // Register
  // =========================
  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullNameInput = document.getElementById("fullName");
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");

      const fullName = fullNameInput ? fullNameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value.trim() : "";

      showMessage("", "error");

      if (!fullName || !email || !password) {
        showMessage("يرجى ملء جميع الحقول", "error");
        return;
      }

      if (password.length < 6) {
        showMessage("كلمة المرور يجب أن تكون 6 أحرف أو أكثر", "error");
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        showMessage("فشل إنشاء الحساب: " + error.message, "error");
        return;
      }

      if (data.user) {
        showMessage("تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن", "success");

        setTimeout(() => {
          window.location.href = "login.html";
        }, 1200);
      }
    });
  }
});
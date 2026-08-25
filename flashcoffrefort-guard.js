/* ============================================================
   FLASHCOFFREFORT GUARD — protège flashcoffrefort-app.html
   Même mécanique que flashtools-guard.js : vérifie l'accès réel
   via api/verify.js?product=flashcoffrefort, qui interroge
   Systeme.io pour les tags flashcoffrefort-unique / -famille / -pro.
   La fenêtre d'accès (7j / 30j / durée abo) est gérée en amont
   par un workflow Systeme.io qui retire le tag au bon moment —
   ce script se contente de vérifier si le tag est encore présent.
   ============================================================ */
(function () {
  var VERIFY_API = "https://flashtools.vercel.app/api/verify";
  var REDIRECT_URL = "https://coffrefort.flashtools.fr/coffre-fort-numerique-sans-mot-de-passe?status=blocked";
  var STORAGE_KEY = "flashcoffrefort_email";

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function block() {
    window.location.replace(REDIRECT_URL);
  }
  function reveal() {
    document.documentElement.style.visibility = "visible";
  }
  function getStoredEmail() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch (e) {
      return "";
    }
  }
  function storeEmail(email) {
    try {
      window.localStorage.setItem(STORAGE_KEY, email);
    } catch (e) {
      // localStorage indisponible (mode privé strict) : on continue
      // sans mémorisation, l'email sera redemandé à chaque visite.
    }
  }
  function publishStatus(data) {
    window.flashCoffreFortStatus = data;
    try {
      document.dispatchEvent(new CustomEvent("flashcoffrefort:status", { detail: data }));
    } catch (e) {
      // CustomEvent non supporté : ignoré, window.flashCoffreFortStatus reste consultable.
    }
  }
  function checkAccess(email) {
    var url = VERIFY_API + "?product=flashcoffrefort&email=" + encodeURIComponent(email);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        publishStatus(data || { access: false, status: "aucun" });
        if (data && data.access === true) {
          reveal();
        } else {
          block();
        }
      })
      .catch(function () {
        publishStatus({ access: false, status: "erreur" });
        block();
      });
  }

  // ── Fenêtre email maison (identique au guard FlashTools) ──
  function showEmailModal(onSubmit) {
    var style = document.createElement("style");
    style.textContent =
      "#fcf-guard-overlay{position:fixed;inset:0;z-index:999999;display:flex;" +
      "align-items:center;justify-content:center;padding:20px;visibility:visible!important;" +
      "background:rgba(7,8,15,0.92);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}" +
      "#fcf-guard-box{width:100%;max-width:380px;background:#11131c;border:1px solid #252d42;" +
      "border-radius:16px;padding:28px 24px;box-sizing:border-box;visibility:visible!important;}" +
      "#fcf-guard-title{font-size:17px;font-weight:700;color:#F1F5F9;margin:0 0 8px;}" +
      "#fcf-guard-sub{font-size:13px;color:#94A3B8;margin:0 0 18px;line-height:1.5;}" +
      "#fcf-guard-input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:9px;" +
      "border:1.5px solid #252d42;background:#07080f;color:#F1F5F9;font-size:15px;outline:none;" +
      "margin-bottom:10px;}" +
      "#fcf-guard-input:focus{border-color:#06B6D4;}" +
      "#fcf-guard-error{font-size:12.5px;color:#F87171;margin:0 0 10px;display:none;}" +
      "#fcf-guard-submit{width:100%;padding:12px;border:none;border-radius:9px;cursor:pointer;" +
      "font-size:14.5px;font-weight:600;color:#fff;" +
      "background:linear-gradient(135deg,#06B6D4,#8B5CF6);}" +
      "#fcf-guard-submit:active{opacity:0.85;}";
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.id = "fcf-guard-overlay";
    overlay.innerHTML =
      '<div id="fcf-guard-box">' +
      '<p id="fcf-guard-title">Accès à votre coffre</p>' +
      '<p id="fcf-guard-sub">Entrez l\'email utilisé lors de votre achat pour accéder à l\'outil de création.</p>' +
      '<input id="fcf-guard-input" type="email" inputmode="email" autocomplete="email" placeholder="vous@exemple.fr">' +
      '<p id="fcf-guard-error">Merci d\'entrer un email valide.</p>' +
      '<button id="fcf-guard-submit" type="button">Continuer</button>' +
      "</div>";
    document.body.appendChild(overlay);

    var input = overlay.querySelector("#fcf-guard-input");
    var errorEl = overlay.querySelector("#fcf-guard-error");
    var submitBtn = overlay.querySelector("#fcf-guard-submit");

    function submit() {
      var value = (input.value || "").trim();
      if (!isValidEmail(value)) {
        errorEl.style.display = "block";
        input.focus();
        return;
      }
      overlay.remove();
      style.remove();
      onSubmit(value);
    }

    submitBtn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });
    setTimeout(function () { input.focus(); }, 50);
  }

  function promptForEmail() {
    showEmailModal(function (email) {
      storeEmail(email);
      checkAccess(email);
    });
  }

  var storedEmail = getStoredEmail();
  if (storedEmail && isValidEmail(storedEmail)) {
    checkAccess(storedEmail);
  } else {
    promptForEmail();
  }
})();

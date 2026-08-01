/* ============================================================
   FLASHTOOLS GUARD — fichier unique, partagé par les 26 apps
   Vérifie l'abonnement réel via l'API Vercel (api/verify.js),
   qui interroge Systeme.io pour les tags acces_actif / acces_essai.
   Pas de contrainte iframe/referrer : un lien direct d'une app
   vers une autre (ex. Charges Micro → Agenda Fiscal) doit rester
   fonctionnel. La vérification email/API suffit à protéger l'accès
   quel que soit le mode de chargement de la page.
   v3 : expose en plus le statut détaillé (actif / essai / expire /
   aucun) et, en essai, le nombre de jours restants, via
   window.flashToolsStatus et l'événement "flashtools:status" —
   utilisé par exemple pour afficher un badge sur /lesoutils.
   Le comportement de blocage/révélation est inchangé.
   v4 : remplace window.prompt() par une fenêtre HTML maison —
   window.prompt() est fréquemment bloqué ou supprimé silencieusement
   par les navigateurs mobiles quand il est déclenché automatiquement
   au chargement (surtout en navigation privée), ce qui laissait la
   page bloquée indéfiniment sans aucun retour visible pour la personne.
   REDIRECT_URL mise à jour vers la page Systeme.io actuelle.
   ============================================================ */
(function () {
  var VERIFY_API = "https://flashtools.vercel.app/api/verify";
  var REDIRECT_URL = "https://www.flashtools.fr/flash-offre?status=blocked";
  var STORAGE_KEY = "flashtools_email";

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
    window.flashToolsStatus = data;
    try {
      document.dispatchEvent(new CustomEvent("flashtools:status", { detail: data }));
    } catch (e) {
      // CustomEvent non supporté sur de très vieux navigateurs : on ignore,
      // window.flashToolsStatus reste consultable directement.
    }
  }
  function checkAccess(email) {
    var url = VERIFY_API + "?email=" + encodeURIComponent(email);
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

  // ── Fenêtre email maison (remplace window.prompt) ──
  function showEmailModal(onSubmit) {
    var style = document.createElement("style");
    style.textContent =
      "#ft-guard-overlay{position:fixed;inset:0;z-index:999999;display:flex;" +
      "align-items:center;justify-content:center;padding:20px;visibility:visible!important;" +
      "background:rgba(7,8,15,0.92);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}" +
      "#ft-guard-box{width:100%;max-width:380px;background:#11131c;border:1px solid #252d42;" +
      "border-radius:16px;padding:28px 24px;box-sizing:border-box;visibility:visible!important;}" +
      "#ft-guard-title{font-size:17px;font-weight:700;color:#F1F5F9;margin:0 0 8px;}" +
      "#ft-guard-sub{font-size:13px;color:#94A3B8;margin:0 0 18px;line-height:1.5;}" +
      "#ft-guard-input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:9px;" +
      "border:1.5px solid #252d42;background:#07080f;color:#F1F5F9;font-size:15px;outline:none;" +
      "margin-bottom:10px;}" +
      "#ft-guard-input:focus{border-color:#06B6D4;}" +
      "#ft-guard-error{font-size:12.5px;color:#F87171;margin:0 0 10px;display:none;}" +
      "#ft-guard-submit{width:100%;padding:12px;border:none;border-radius:9px;cursor:pointer;" +
      "font-size:14.5px;font-weight:600;color:#fff;" +
      "background:linear-gradient(135deg,#06B6D4,#8B5CF6);}" +
      "#ft-guard-submit:active{opacity:0.85;}";
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.id = "ft-guard-overlay";
    overlay.innerHTML =
      '<div id="ft-guard-box">' +
      '<p id="ft-guard-title">Accès FlashTools</p>' +
      '<p id="ft-guard-sub">Entrez l\'email associé à votre compte pour accéder à cet outil.</p>' +
      '<input id="ft-guard-input" type="email" inputmode="email" autocomplete="email" placeholder="vous@exemple.fr">' +
      '<p id="ft-guard-error">Merci d\'entrer un email valide.</p>' +
      '<button id="ft-guard-submit" type="button">Continuer</button>' +
      "</div>";
    document.body.appendChild(overlay);

    var input = overlay.querySelector("#ft-guard-input");
    var errorEl = overlay.querySelector("#ft-guard-error");
    var submitBtn = overlay.querySelector("#ft-guard-submit");

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
    // Petit délai avant le focus : certains navigateurs mobiles ignorent
    // un focus() déclenché dans la même frame que l'insertion du DOM.
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

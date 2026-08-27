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
   v5 : ne redirige plus automatiquement et silencieusement vers
   REDIRECT_URL en cas d'échec (email en mémoire sans accès valide).
   À la place, réaffiche la fenêtre de saisie avec un message d'erreur
   et la possibilité de retaper une autre adresse. La redirection vers
   la page d'offre ne se déclenche plus que si la personne clique
   explicitement sur le lien "Pas encore abonné ? Voir les offres"
   à l'intérieur de cette même fenêtre. Corrige le cas où une adresse
   de test restée en mémoire redirigeait sans jamais laisser la
   personne corriger l'adresse saisie.
   ============================================================ */
(function () {
  var VERIFY_API = "https://flashtools.vercel.app/api/verify";
  var REDIRECT_URL = "https://www.flashtools.fr/flash-offre";
  var STORAGE_KEY = "flashtools_email";

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  function clearStoredEmail() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
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
  function checkAccess(email, onDenied) {
    var url = VERIFY_API + "?email=" + encodeURIComponent(email);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        publishStatus(data || { access: false, status: "aucun" });
        if (data && data.access === true) {
          reveal();
        } else {
          onDenied();
        }
      })
      .catch(function () {
        publishStatus({ access: false, status: "erreur" });
        onDenied();
      });
  }

  // ── Fenêtre email maison ──
  function showEmailModal(prefillEmail, errorMessage, onSubmit) {
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
      "#ft-guard-error.show{display:block;}" +
      "#ft-guard-submit{width:100%;padding:12px;border:none;border-radius:9px;cursor:pointer;" +
      "font-size:14.5px;font-weight:600;color:#fff;" +
      "background:linear-gradient(135deg,#06B6D4,#8B5CF6);margin-bottom:14px;}" +
      "#ft-guard-submit:active{opacity:0.85;}" +
      "#ft-guard-offer{display:block;text-align:center;font-size:12.5px;color:#94A3B8;" +
      "text-decoration:none;border-top:1px solid #252d42;padding-top:14px;}" +
      "#ft-guard-offer:hover{color:#06B6D4;}";
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.id = "ft-guard-overlay";
    overlay.innerHTML =
      '<div id="ft-guard-box">' +
      '<p id="ft-guard-title">Accès FlashTools</p>' +
      '<p id="ft-guard-sub">Entrez l\'email associé à votre compte pour accéder à cet outil.</p>' +
      '<input id="ft-guard-input" type="email" inputmode="email" autocomplete="email" placeholder="vous@exemple.fr" value="' + (prefillEmail || "").replace(/"/g, "&quot;") + '">' +
      '<p id="ft-guard-error">' + (errorMessage || "Merci d'entrer un email valide.") + '</p>' +
      '<button id="ft-guard-submit" type="button">Continuer</button>' +
      '<a id="ft-guard-offer" href="' + REDIRECT_URL + '">Pas encore abonné ? Voir les offres →</a>' +
      "</div>";
    document.body.appendChild(overlay);

    var input = overlay.querySelector("#ft-guard-input");
    var errorEl = overlay.querySelector("#ft-guard-error");
    var submitBtn = overlay.querySelector("#ft-guard-submit");

    if (errorMessage) errorEl.classList.add("show");

    function submit() {
      var value = (input.value || "").trim();
      if (!isValidEmail(value)) {
        errorEl.textContent = "Merci d'entrer un email valide.";
        errorEl.classList.add("show");
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

  function promptForEmail(prefillEmail, errorMessage) {
    showEmailModal(prefillEmail, errorMessage, function (email) {
      storeEmail(email);
      checkAccess(email, function () {
        // Accès refusé pour cette adresse : on réaffiche la fenêtre
        // avec un message clair, jamais de redirection automatique.
        promptForEmail(email, "Aucun accès actif trouvé pour cette adresse. Vérifiez l'orthographe, ou essayez une autre adresse.");
      });
    });
  }

  var storedEmail = getStoredEmail();
  if (storedEmail && isValidEmail(storedEmail)) {
    checkAccess(storedEmail, function () {
      // L'email en mémoire n'a plus d'accès valide : on la vide et on
      // redemande, plutôt que de rediriger silencieusement.
      clearStoredEmail();
      promptForEmail(storedEmail, "L'accès associé à cette adresse a expiré, ou ne correspond pas à un compte actif. Vérifiez l'adresse, ou essayez-en une autre.");
    });
  } else {
    promptForEmail();
  }
})();

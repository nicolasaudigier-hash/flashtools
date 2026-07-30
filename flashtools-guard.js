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
   ============================================================ */
(function () {
  var VERIFY_API = "https://flashtools.vercel.app/api/verify";
  var REDIRECT_URL = "https://nicolasaudigier-hash.github.io/flashtools/flash-offre.html?status=blocked";
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
    // Rendu disponible pour tout script de la page (ex. badge sur /lesoutils),
    // sans rien changer au comportement de blocage lui-même.
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
        // Panne API : on bloque par prudence plutôt que de laisser
        // passer un accès non vérifié.
        publishStatus({ access: false, status: "erreur" });
        block();
      });
  }
  function promptForEmail() {
    var email = window.prompt(
      "Entrez l'email associé à votre compte FlashTools pour accéder à cet outil :"
    );
    if (!email || !isValidEmail(email.trim())) {
      block();
      return;
    }
    email = email.trim();
    storeEmail(email);
    checkAccess(email);
  }
  var storedEmail = getStoredEmail();
  if (storedEmail && isValidEmail(storedEmail)) {
    checkAccess(storedEmail);
  } else {
    promptForEmail();
  }
})();

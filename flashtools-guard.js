/* ============================================================
   FLASHTOOLS GUARD — fichier unique, partagé par les 26 apps
   Vérifie l'abonnement réel via l'API Vercel (api/verify.js),
   qui interroge Systeme.io pour les tags acces_actif / acces_essai.
   Garde aussi la protection iframe + referrer en complément.
   ============================================================ */
(function () {
  var VERIFY_API = "https://flashtools.vercel.app/api/verify";
  var REDIRECT_URL = "https://nicolasaudigier-hash.github.io/flashtools/flash-offre.html?status=blocked";
  var STORAGE_KEY = "flashtools_email";

  var ALLOWED_REFERRER_HOSTS = [
    "flashtools.fr",
    "www.flashtools.fr",
    "nicolas-audigier.systeme.io"
  ];

  function isEmbeddedProperly() {
    var inIframe = window.self !== window.top;
    if (!inIframe) return false;
    var ref = document.referrer || "";
    return ALLOWED_REFERRER_HOSTS.some(function (host) {
      return ref.indexOf(host) !== -1;
    });
  }

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

  function checkAccess(email) {
    var url = VERIFY_API + "?email=" + encodeURIComponent(email);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.access === true) {
          reveal();
        } else {
          block();
        }
      })
      .catch(function () {
        // Panne API : on bloque par prudence plutôt que de laisser
        // passer un accès non vérifié.
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

  // 1. Blocage immédiat si l'outil n'est pas chargé correctement en iframe.
  if (!isEmbeddedProperly()) {
    block();
    return;
  }

  // 2. Vérification réelle de l'accès via l'API.
  var storedEmail = getStoredEmail();
  if (storedEmail && isValidEmail(storedEmail)) {
    checkAccess(storedEmail);
  } else {
    promptForEmail();
  }
})();

/* ============================================================
   FLASHTOOLS GUARD — fichier unique, partagé par les 26 apps
   Rôle réel : empêcher l'accès direct à l'URL GitHub brute.
   La vérification d'abonnement elle-même est déjà faite par
   Systeme.io en amont (page espace membre protégée).
   ============================================================ */
(function () {

  // Domaine(s) autorisé(s) à embarquer les outils en iframe.
  // ⚠️ À vérifier : si Systeme.io sert tes pages membres sous un
  // sous-domaine *.systeme.io en plus de flashtools.fr, ajoute-le ici.
  var ALLOWED_REFERRER_HOSTS = [
    "flashtools.fr",
    "www.flashtools.fr"
  ];

  // Page vers laquelle on redirige en cas de blocage.
  var REDIRECT_URL = "https://nicolasaudigier-hash.github.io/flashtools/flash-offre.html?status=blocked";

  function isAllowed() {
    // 1. L'outil doit être chargé dans un iframe, jamais en accès plein écran direct.
    var inIframe = window.self !== window.top;
    if (!inIframe) return false;

    // 2. Le referrer doit pointer vers un domaine FlashTools autorisé.
    var ref = document.referrer || "";
    return ALLOWED_REFERRER_HOSTS.some(function (host) {
      return ref.indexOf(host) !== -1;
    });
  }

  if (isAllowed()) {
    // Accès légitime : on réaffiche le contenu (masqué par défaut via le <style> du <head>).
    document.documentElement.style.visibility = "visible";
  } else {
    // Accès refusé : on reste masqué (déjà le cas par défaut) et on redirige.
    window.location.replace(REDIRECT_URL);
  }

})();

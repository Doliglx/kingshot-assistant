// Textes de l'interface, par langue.
// Le vocabulaire du jeu reste cohérent : « rally », « leader », « Start »,
// « Exact UTC » et « Quick Sync » sont gardés tels quels.

import type { Lang } from "./messages"

export interface UiText {
  subtitle: string
  targetName: string
  appLanguage: string
  messageLanguage: string
  prepNote: string
  leaders: string
  marchHelp: string
  invalid: string
  remove: string
  addLeader: string
  me: string
  none: string
  utcTime: string
  resync: string
  syncing: string
  resyncing: string
  synced: (ms: number) => string
  resyncFailed: string
  notSynced: string
  sourceTip: (source: string, samples: number) => string
  arrivalTitle: string
  arrivalAria: string
  arrivalFormat: string
  now: string
  impactIn: (d: string) => string
  arrivalPassed: (d: string) => string
  meCard: (name: string) => string
  departAt: (time: string) => string
  precSynced: (ms: number) => string
  precPhone: string
  departures: string
  emptyUtc: string
  passed: (n: number) => string
  duplicates: string
  passedBy: (d: string) => string
  inTime: (d: string) => string
  march: (d: string) => string
  quickTitle: string
  emptyQuick: string
  /** Suite de la phrase après le pseudo du premier leader (affiché en gras). */
  firstExplain: (d: string) => string
  startBtn: (first: string) => string
  reset: string
  startHelp: (first: string) => string
  firstBadge: string
  go: string
  inSec: (n: number) => string
  meFirst: string
  meOffset: (offset: string, first: string) => string
  floatTitle: (mode: string) => string
  floatUtcHelp: string
  floatQuickHelp: string
  alertsHelp: string
  overlayMissing: string
  allowOverlay: string
  stopBubble: string
  launchBubble: (name: string | null) => string
  chooseMe: string
  ownPassed: string
  bubbleOn: string
  notifFallback: string
  error: (m: string) => string
  bubbleFirst: string
  bubbleAfter: (offset: string, first: string) => string
  precQuick: string
  copyTitle: string
  copy: string
  copied: string
  castle: string
  turret: string
  turretDir: { n: string; s: string; e: string; w: string }
  guideTitle: string
  /** Steps shown next to the annotated game screenshot. */
  guideSteps: string[]
  guideHide: string
  guideShow: string
  guideAlt: string
  /** Textes de la bulle et de la notification Android. */
  native: {
    start: string
    launchIn: string
    go: string
    goNotif: string
    tapStart: string
    stop: string
    me: string
    channel: string
  }
}

/** Pluriel russe : 1 / 2-4 / 5+ (21 → 1, 22 → 2-4, 11-14 → 5+). */
function ruPlural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const UI: Record<Lang, UiText> = {
  // ------------------------------------------------------------------ EN
  en: {
    castle: "Castle",
    turret: "Turret",
    turretDir: {"n": "North", "s": "South", "e": "East", "w": "West"},
    guideTitle: "Launching at the exact second",
    guideSteps: ["In the game, prepare your rally: heroes, troops and rally time (5 min or another).", "Stay on the rally screen. Tap the clock icon (pink circle) to show the game's UTC time.", "The time under Deploy (yellow circle) is your march time: that is the value to enter here.", "Press Deploy at your launch time shown here. Every rally leader must pick the same rally time in the game (usually 5 min) so that all rallies land together: check it before each Deploy.", "Go by the game's UTC clock, not your phone's: the server counts with the game's clock."],
    guideHide: "Hide the guide",
    guideShow: "How to launch at the exact second",
    guideAlt: "Rally screen in the game: the clock icon showing UTC time is circled in pink, the march time under Deploy in yellow.",
    subtitle: "Land every rally on target at the same time",
    targetName: "Target name",
    appLanguage: "App language",
    messageLanguage: "Message language",
    prepNote: "All rally leaders must pick the same rally time in the game (usually 5 min) so that everyone lands together. Check it in the game before every Deploy.",
    leaders: "Rally leaders",
    marchHelp:
      "March time shown in game when you tap the target (buffs included): “125”, “2:05” or “2m5s”.",
    invalid: "invalid",
    remove: "Remove this leader",
    addLeader: "Add a leader",
    me: "Me:",
    none: "— (none)",
    utcTime: "UTC time",
    resync: "Resync",
    syncing: "Syncing…",
    resyncing: "Resyncing…",
    synced: (ms) => `Synced ± ${ms} ms`,
    resyncFailed: " · last resync failed",
    notSynced: "Not synced: phone clock, unreliable",
    sourceTip: (s, n) => `Source: ${s} · ${n} samples`,
    arrivalTitle: "Arrival time on target (UTC)",
    arrivalAria: "UTC arrival time",
    arrivalFormat: "Expected format: HH:MM:SS (e.g. 12:30:00)",
    now: "Now",
    impactIn: (d) => `Impact in ${d}`,
    arrivalPassed: (d) => `Arrival time passed ${d} ago`,
    meCard: (n) => `Me: ${n}`,
    departAt: (t) => `Launch at ${t} UTC`,
    precSynced: (ms) => `synced ± ${ms} ms`,
    precPhone: "phone clock (not synced)",
    departures: "Launch times",
    emptyUtc: "Enter an arrival time and at least one march time.",
    passed: (n) =>
      n === 1
        ? "1 launch time has already passed: move the arrival time later."
        : `${n} launch times have already passed: move the arrival time later.`,
    duplicates: "Duplicate names: they are numbered in the message.",
    passedBy: (d) => `passed ${d} ago`,
    inTime: (d) => `in ${d}`,
    march: (d) => `march ${d}`,
    quickTitle: "Offsets from the first launch",
    emptyQuick: "Enter at least one march time.",
    firstExplain: (d) =>
      ` launches first (longest march: ${d}). The others launch their rally after, at the offset shown.`,
    startBtn: (n) => `Start (${n} launches)`,
    reset: "Reset",
    startHelp: (n) =>
      `Tap Start the moment ${n} launches: each card lights up at its offset. Accuracy ± 1 s (reaction time).`,
    firstBadge: "1st",
    go: "GO!",
    inSec: (n) => `in ${n}s`,
    meFirst: "You launch first: the others count from your launch.",
    meOffset: (o, f) => `Offset ${o} after ${f} · accuracy ± 1 s`,
    floatTitle: (m) => `Floating mode (${m})`,
    floatUtcHelp: "A bubble shows your countdown over the game until your launch time.",
    floatQuickHelp:
      "A bubble with a Start button stays over the game: tap it as soon as the first leader launches.",
    alertsHelp:
      "Sound and vibration alerts at T−3, T−2 and T−1, then at zero. The bubble never interacts with the game.",
    overlayMissing:
      "“Display over other apps” permission not granted: without it, the countdown runs in a persistent notification.",
    allowOverlay: "Allow display",
    stopBubble: "Close the bubble",
    launchBubble: (n) => (n ? `Open the bubble (${n})` : "Open the bubble"),
    chooseMe: "Pick “Me” in the leader list.",
    ownPassed: "Your launch time has already passed.",
    bubbleOn: "Bubble active: switch to the game.",
    notifFallback:
      "No display permission: the countdown runs in the persistent notification (and here).",
    error: (m) => `Error: ${m}`,
    bubbleFirst: "You launch first",
    bubbleAfter: (o, f) => `${o} after ${f}'s launch`,
    precQuick: "accuracy ± 1 s (reaction time)",
    copyTitle: "Message to copy",
    copy: "Copy message",
    copied: "Copied!",
    native: {
      start: "START (1st launches)",
      launchIn: "Launch in",
      go: "GO!",
      goNotif: "GO! Launch your rally",
      tapStart: "Tap Start as soon as the 1st leader launches",
      stop: "Stop",
      me: "Me",
      channel: "Rally countdown",
    },
  },

  // ------------------------------------------------------------------ FR
  fr: {
    castle: "Château",
    turret: "Tourelle",
    turretDir: {"n": "Nord", "s": "Sud", "e": "Est", "w": "Ouest"},
    guideTitle: "Lancer à la seconde près",
    guideSteps: ["Dans le jeu, préparez votre ralliement : héros, troupes et durée de ralliement (5 min ou autre).", "Restez sur l'écran de ralliement. Appuyez sur l'icône horloge (cercle rose) pour afficher l'heure UTC du jeu.", "Le temps sous Deploy (cercle jaune) est votre temps de marche : c'est la valeur à saisir ici.", "Appuyez sur Deploy à votre heure de départ affichée ici. Tous les rally leaders doivent choisir la même durée de ralliement dans le jeu (généralement 5 min) pour arriver ensemble : vérifiez-la avant chaque Deploy.", "Fiez-vous à l'horloge UTC du jeu plutôt qu'à celle du téléphone : c'est elle que le serveur utilise."],
    guideHide: "Masquer le guide",
    guideShow: "Comment lancer à la seconde près",
    guideAlt: "Écran de ralliement du jeu : l'icône horloge affichant l'heure UTC est entourée en rose, le temps de marche sous Deploy en jaune.",
    subtitle: "Faites atterrir tous vos rallies en même temps",
    targetName: "Nom de la cible",
    appLanguage: "Langue de l'application",
    messageLanguage: "Langue du message",
    prepNote: "Tous les rally leaders doivent choisir la même durée de ralliement dans le jeu (généralement 5 min) pour arriver ensemble. Vérifiez-la en jeu avant chaque Deploy.",
    leaders: "Rally leaders",
    marchHelp:
      "Temps de marche affiché en jeu sur l'objectif (buffs inclus) : « 125 », « 2:05 » ou « 2m5s ».",
    invalid: "invalide",
    remove: "Supprimer ce leader",
    addLeader: "Ajouter un leader",
    me: "Moi :",
    none: "— (aucun)",
    utcTime: "Heure UTC",
    resync: "Resynchroniser",
    syncing: "Synchronisation…",
    resyncing: "Resynchronisation…",
    synced: (ms) => `Synchronisé ± ${ms} ms`,
    resyncFailed: " · dernière resynchro échouée",
    notSynced: "Non synchronisé : heure du téléphone, non fiable",
    sourceTip: (s, n) => `Source : ${s} · ${n} échantillons`,
    arrivalTitle: "Heure d'arrivée sur la cible (UTC)",
    arrivalAria: "Heure d'arrivée UTC",
    arrivalFormat: "Format attendu : HH:MM:SS (ex. 12:30:00)",
    now: "Maint.",
    impactIn: (d) => `Impact dans ${d}`,
    arrivalPassed: (d) => `Heure d'arrivée passée depuis ${d}`,
    meCard: (n) => `Moi : ${n}`,
    departAt: (t) => `Départ ${t} UTC`,
    precSynced: (ms) => `synchronisé ± ${ms} ms`,
    precPhone: "horloge du téléphone (non synchronisée)",
    departures: "Heures de départ",
    emptyUtc: "Saisissez une heure d'arrivée et au moins un temps de marche.",
    passed: (n) =>
      n === 1
        ? "1 départ est déjà passé : décalez l'heure d'arrivée."
        : `${n} départs sont déjà passés : décalez l'heure d'arrivée.`,
    duplicates: "Pseudos en double : ils sont numérotés dans le message.",
    passedBy: (d) => `passé de ${d}`,
    inTime: (d) => `dans ${d}`,
    march: (d) => `marche ${d}`,
    quickTitle: "Décalages depuis le 1er lancement",
    emptyQuick: "Saisissez au moins un temps de marche.",
    firstExplain: (d) =>
      ` lance en premier (marche la plus longue : ${d}). Les autres lancent leur rally après lui, au décalage indiqué.`,
    startBtn: (n) => `Start (${n} lance)`,
    reset: "Reset",
    startHelp: (n) =>
      `Appuyez sur Start au moment où ${n} lance : chaque carte s'illumine à son décalage. Précision ± 1 s (délai de réaction).`,
    firstBadge: "1er",
    go: "GO !",
    inSec: (n) => `dans ${n}s`,
    meFirst: "Vous lancez en premier : les autres comptent depuis votre lancement.",
    meOffset: (o, f) => `Décalage ${o} après ${f} · précision ± 1 s`,
    floatTitle: (m) => `Mode flottant (${m})`,
    floatUtcHelp:
      "Une bulle affiche votre compte à rebours par-dessus le jeu, jusqu'à votre heure de départ.",
    floatQuickHelp:
      "Une bulle avec un bouton Start reste par-dessus le jeu : appuyez dès que le premier leader lance.",
    alertsHelp:
      "Alertes son + vibration à T−3, T−2, T−1 puis GO. La bulle n'interagit pas avec le jeu.",
    overlayMissing:
      "Permission « affichage par-dessus d'autres apps » non accordée : sans elle, le compte à rebours passe par une notification persistante.",
    allowOverlay: "Autoriser l'affichage",
    stopBubble: "Arrêter la bulle",
    launchBubble: (n) => (n ? `Lancer la bulle (${n})` : "Lancer la bulle"),
    chooseMe: "Choisissez « Moi » dans la liste des leaders.",
    ownPassed: "Votre départ est déjà passé.",
    bubbleOn: "Bulle active : passez sur le jeu.",
    notifFallback:
      "Sans permission d'affichage : compte à rebours dans la notification persistante (et ici).",
    error: (m) => `Erreur : ${m}`,
    bubbleFirst: "Vous lancez en premier",
    bubbleAfter: (o, f) => `${o} après le lancement de ${f}`,
    precQuick: "précision ± 1 s (délai de réaction)",
    copyTitle: "Message à copier",
    copy: "Copier le message",
    copied: "Copié !",
    native: {
      start: "START (le 1er lance)",
      launchIn: "Lancement dans",
      go: "GO !",
      goNotif: "GO ! Lancez votre rally",
      tapStart: "Appuyez sur Start dès que le 1er leader lance",
      stop: "Arrêter",
      me: "Moi",
      channel: "Compte à rebours rally",
    },
  },

  // ------------------------------------------------------------------ DE

  // ------------------------------------------------------------------ ES

  // ------------------------------------------------------------------ PT (BR)

  // ------------------------------------------------------------------ IT

  // ------------------------------------------------------------------ TR

  // ------------------------------------------------------------------ RU
}

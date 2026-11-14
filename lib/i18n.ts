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
    subtitle: "Land every rally on target at the same time",
    targetName: "Target name",
    appLanguage: "App language",
    messageLanguage: "Message language",
    prepNote: "Rally preparation time isn't included: each leader adds it on their own.",
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
    subtitle: "Faites atterrir tous vos rallies en même temps",
    targetName: "Nom de la cible",
    appLanguage: "Langue de l'application",
    messageLanguage: "Langue du message",
    prepNote:
      "Le temps de préparation du ralliement n'est pas compté : chaque leader l'intègre de son côté.",
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
  de: {
    subtitle: "Alle Rallys gleichzeitig ins Ziel bringen",
    targetName: "Name des Ziels",
    appLanguage: "App-Sprache",
    messageLanguage: "Sprache der Nachricht",
    prepNote:
      "Die Vorbereitungszeit des Rallys ist nicht eingerechnet: Jeder Leader plant sie selbst ein.",
    leaders: "Rally-Leader",
    marchHelp:
      "Marschzeit, die das Spiel beim Antippen des Ziels anzeigt (inkl. Buffs): „125“, „2:05“ oder „2m5s“.",
    invalid: "ungültig",
    remove: "Diesen Leader entfernen",
    addLeader: "Leader hinzufügen",
    me: "Ich:",
    none: "— (keiner)",
    utcTime: "UTC-Zeit",
    resync: "Neu synchronisieren",
    syncing: "Synchronisiere…",
    resyncing: "Synchronisiere neu…",
    synced: (ms) => `Synchronisiert ± ${ms} ms`,
    resyncFailed: " · letzte Synchronisierung fehlgeschlagen",
    notSynced: "Nicht synchronisiert: Handyuhr, unzuverlässig",
    sourceTip: (s, n) => `Quelle: ${s} · ${n} Messungen`,
    arrivalTitle: "Ankunftszeit am Ziel (UTC)",
    arrivalAria: "Ankunftszeit UTC",
    arrivalFormat: "Erwartetes Format: HH:MM:SS (z. B. 12:30:00)",
    now: "Jetzt",
    impactIn: (d) => `Ankunft in ${d}`,
    arrivalPassed: (d) => `Ankunftszeit seit ${d} vorbei`,
    meCard: (n) => `Ich: ${n}`,
    departAt: (t) => `Start um ${t} UTC`,
    precSynced: (ms) => `synchronisiert ± ${ms} ms`,
    precPhone: "Handyuhr (nicht synchronisiert)",
    departures: "Startzeiten",
    emptyUtc: "Gib eine Ankunftszeit und mindestens eine Marschzeit ein.",
    passed: (n) =>
      n === 1
        ? "1 Startzeit ist bereits vorbei: Verschiebe die Ankunftszeit nach hinten."
        : `${n} Startzeiten sind bereits vorbei: Verschiebe die Ankunftszeit nach hinten.`,
    duplicates: "Doppelte Namen: Sie werden in der Nachricht nummeriert.",
    passedBy: (d) => `seit ${d} vorbei`,
    inTime: (d) => `in ${d}`,
    march: (d) => `Marsch ${d}`,
    quickTitle: "Versatz ab dem ersten Start",
    emptyQuick: "Gib mindestens eine Marschzeit ein.",
    firstExplain: (d) =>
      ` startet zuerst (längster Marsch: ${d}). Die anderen starten danach mit dem angezeigten Versatz.`,
    startBtn: (n) => `Start (${n} startet)`,
    reset: "Zurücksetzen",
    startHelp: (n) =>
      `Tippe auf Start, sobald ${n} startet: Jede Karte leuchtet bei ihrem Versatz auf. Genauigkeit ± 1 s (Reaktionszeit).`,
    firstBadge: "1.",
    go: "LOS!",
    inSec: (n) => `in ${n}s`,
    meFirst: "Du startest zuerst: Die anderen zählen ab deinem Start.",
    meOffset: (o, f) => `Versatz ${o} nach ${f} · Genauigkeit ± 1 s`,
    floatTitle: (m) => `Schwebemodus (${m})`,
    floatUtcHelp: "Eine Blase zeigt deinen Countdown über dem Spiel bis zu deiner Startzeit.",
    floatQuickHelp:
      "Eine Blase mit Start-Taste bleibt über dem Spiel: Tippe darauf, sobald der erste Leader startet.",
    alertsHelp:
      "Ton- und Vibrationsalarm bei T−3, T−2 und T−1, dann bei null. Die Blase interagiert nie mit dem Spiel.",
    overlayMissing:
      "Berechtigung „Über anderen Apps einblenden“ nicht erteilt: Ohne sie läuft der Countdown in einer dauerhaften Benachrichtigung.",
    allowOverlay: "Einblenden erlauben",
    stopBubble: "Blase schließen",
    launchBubble: (n) => (n ? `Blase öffnen (${n})` : "Blase öffnen"),
    chooseMe: "Wähle „Ich“ in der Leader-Liste.",
    ownPassed: "Deine Startzeit ist bereits vorbei.",
    bubbleOn: "Blase aktiv: Wechsle ins Spiel.",
    notifFallback:
      "Ohne Einblende-Berechtigung: Der Countdown läuft in der dauerhaften Benachrichtigung (und hier).",
    error: (m) => `Fehler: ${m}`,
    bubbleFirst: "Du startest zuerst",
    bubbleAfter: (o, f) => `${o} nach dem Start von ${f}`,
    precQuick: "Genauigkeit ± 1 s (Reaktionszeit)",
    copyTitle: "Nachricht zum Kopieren",
    copy: "Nachricht kopieren",
    copied: "Kopiert!",
    native: {
      start: "START (1. startet)",
      launchIn: "Start in",
      go: "LOS!",
      goNotif: "LOS! Starte deinen Rally",
      tapStart: "Tippe auf Start, sobald der 1. Leader startet",
      stop: "Beenden",
      me: "Ich",
      channel: "Rally-Countdown",
    },
  },

  // ------------------------------------------------------------------ ES
  es: {
    subtitle: "Haz que todos tus rallies lleguen a la vez",
    targetName: "Nombre del objetivo",
    appLanguage: "Idioma de la app",
    messageLanguage: "Idioma del mensaje",
    prepNote:
      "No se cuenta el tiempo de preparación del rally: cada líder lo añade por su cuenta.",
    leaders: "Líderes de rally",
    marchHelp:
      "Tiempo de marcha que muestra el juego al tocar el objetivo (con bonificaciones): «125», «2:05» o «2m5s».",
    invalid: "no válido",
    remove: "Quitar este líder",
    addLeader: "Añadir un líder",
    me: "Yo:",
    none: "— (ninguno)",
    utcTime: "Hora UTC",
    resync: "Resincronizar",
    syncing: "Sincronizando…",
    resyncing: "Resincronizando…",
    synced: (ms) => `Sincronizado ± ${ms} ms`,
    resyncFailed: " · falló la última resincronización",
    notSynced: "Sin sincronizar: reloj del móvil, poco fiable",
    sourceTip: (s, n) => `Fuente: ${s} · ${n} muestras`,
    arrivalTitle: "Hora de llegada al objetivo (UTC)",
    arrivalAria: "Hora de llegada UTC",
    arrivalFormat: "Formato esperado: HH:MM:SS (p. ej. 12:30:00)",
    now: "Ahora",
    impactIn: (d) => `Impacto en ${d}`,
    arrivalPassed: (d) => `La hora de llegada pasó hace ${d}`,
    meCard: (n) => `Yo: ${n}`,
    departAt: (t) => `Salida a las ${t} UTC`,
    precSynced: (ms) => `sincronizado ± ${ms} ms`,
    precPhone: "reloj del móvil (sin sincronizar)",
    departures: "Horas de salida",
    emptyUtc: "Introduce una hora de llegada y al menos un tiempo de marcha.",
    passed: (n) =>
      n === 1
        ? "1 salida ya ha pasado: retrasa la hora de llegada."
        : `${n} salidas ya han pasado: retrasa la hora de llegada.`,
    duplicates: "Nombres repetidos: se numeran en el mensaje.",
    passedBy: (d) => `pasó hace ${d}`,
    inTime: (d) => `en ${d}`,
    march: (d) => `marcha ${d}`,
    quickTitle: "Desfases desde el primer lanzamiento",
    emptyQuick: "Introduce al menos un tiempo de marcha.",
    firstExplain: (d) =>
      ` lanza primero (marcha más larga: ${d}). Los demás lanzan su rally después, con el desfase indicado.`,
    startBtn: (n) => `Start (lanza ${n})`,
    reset: "Reiniciar",
    startHelp: (n) =>
      `Pulsa Start en cuanto ${n} lance: cada tarjeta se ilumina en su desfase. Precisión ± 1 s (tiempo de reacción).`,
    firstBadge: "1.º",
    go: "¡YA!",
    inSec: (n) => `en ${n}s`,
    meFirst: "Lanzas primero: los demás cuentan desde tu lanzamiento.",
    meOffset: (o, f) => `Desfase ${o} después de ${f} · precisión ± 1 s`,
    floatTitle: (m) => `Modo flotante (${m})`,
    floatUtcHelp: "Una burbuja muestra tu cuenta atrás sobre el juego hasta tu hora de salida.",
    floatQuickHelp:
      "Una burbuja con botón Start se queda sobre el juego: púlsalo en cuanto lance el primer líder.",
    alertsHelp:
      "Avisos con sonido y vibración en T−3, T−2 y T−1, y al llegar a cero. La burbuja nunca interactúa con el juego.",
    overlayMissing:
      "Permiso «Mostrar sobre otras apps» no concedido: sin él, la cuenta atrás aparece en una notificación persistente.",
    allowOverlay: "Permitir",
    stopBubble: "Cerrar la burbuja",
    launchBubble: (n) => (n ? `Abrir la burbuja (${n})` : "Abrir la burbuja"),
    chooseMe: "Elige «Yo» en la lista de líderes.",
    ownPassed: "Tu hora de salida ya ha pasado.",
    bubbleOn: "Burbuja activa: vuelve al juego.",
    notifFallback:
      "Sin permiso de superposición: la cuenta atrás aparece en la notificación persistente (y aquí).",
    error: (m) => `Error: ${m}`,
    bubbleFirst: "Lanzas primero",
    bubbleAfter: (o, f) => `${o} después del lanzamiento de ${f}`,
    precQuick: "precisión ± 1 s (tiempo de reacción)",
    copyTitle: "Mensaje para copiar",
    copy: "Copiar mensaje",
    copied: "¡Copiado!",
    native: {
      start: "START (lanza el 1.º)",
      launchIn: "Salida en",
      go: "¡YA!",
      goNotif: "¡YA! Lanza tu rally",
      tapStart: "Pulsa Start en cuanto lance el 1.er líder",
      stop: "Detener",
      me: "Yo",
      channel: "Cuenta atrás del rally",
    },
  },

  // ------------------------------------------------------------------ PT (BR)
  pt: {
    subtitle: "Faça todos os seus rallies chegarem ao mesmo tempo",
    targetName: "Nome do alvo",
    appLanguage: "Idioma do app",
    messageLanguage: "Idioma da mensagem",
    prepNote:
      "O tempo de preparação do rally não é contado: cada líder considera isso por conta própria.",
    leaders: "Líderes de rally",
    marchHelp:
      "Tempo de marcha mostrado no jogo ao tocar no alvo (com bônus): “125”, “2:05” ou “2m5s”.",
    invalid: "inválido",
    remove: "Remover este líder",
    addLeader: "Adicionar líder",
    me: "Eu:",
    none: "— (nenhum)",
    utcTime: "Hora UTC",
    resync: "Ressincronizar",
    syncing: "Sincronizando…",
    resyncing: "Ressincronizando…",
    synced: (ms) => `Sincronizado ± ${ms} ms`,
    resyncFailed: " · a última ressincronização falhou",
    notSynced: "Não sincronizado: relógio do celular, pouco confiável",
    sourceTip: (s, n) => `Fonte: ${s} · ${n} amostras`,
    arrivalTitle: "Hora de chegada no alvo (UTC)",
    arrivalAria: "Hora de chegada UTC",
    arrivalFormat: "Formato esperado: HH:MM:SS (ex.: 12:30:00)",
    now: "Agora",
    impactIn: (d) => `Impacto em ${d}`,
    arrivalPassed: (d) => `A hora de chegada passou há ${d}`,
    meCard: (n) => `Eu: ${n}`,
    departAt: (t) => `Saída às ${t} UTC`,
    precSynced: (ms) => `sincronizado ± ${ms} ms`,
    precPhone: "relógio do celular (não sincronizado)",
    departures: "Horários de saída",
    emptyUtc: "Informe uma hora de chegada e pelo menos um tempo de marcha.",
    passed: (n) =>
      n === 1
        ? "1 saída já passou: adie a hora de chegada."
        : `${n} saídas já passaram: adie a hora de chegada.`,
    duplicates: "Nomes repetidos: eles são numerados na mensagem.",
    passedBy: (d) => `passou há ${d}`,
    inTime: (d) => `em ${d}`,
    march: (d) => `marcha ${d}`,
    quickTitle: "Intervalos após o primeiro lançamento",
    emptyQuick: "Informe pelo menos um tempo de marcha.",
    firstExplain: (d) =>
      ` lança primeiro (marcha mais longa: ${d}). Os outros lançam o rally depois, no intervalo indicado.`,
    startBtn: (n) => `Start (${n} lança)`,
    reset: "Reiniciar",
    startHelp: (n) =>
      `Toque em Start assim que ${n} lançar: cada cartão acende no seu intervalo. Precisão ± 1 s (tempo de reação).`,
    firstBadge: "1º",
    go: "JÁ!",
    inSec: (n) => `em ${n}s`,
    meFirst: "Você lança primeiro: os outros contam a partir do seu lançamento.",
    meOffset: (o, f) => `Intervalo de ${o} após ${f} · precisão ± 1 s`,
    floatTitle: (m) => `Modo flutuante (${m})`,
    floatUtcHelp:
      "Uma bolha mostra sua contagem regressiva sobre o jogo até a sua hora de saída.",
    floatQuickHelp:
      "Uma bolha com botão Start fica sobre o jogo: toque nele assim que o primeiro líder lançar.",
    alertsHelp:
      "Alertas com som e vibração em T−3, T−2 e T−1, e ao chegar a zero. A bolha nunca interage com o jogo.",
    overlayMissing:
      "Permissão “Sobrepor a outros apps” não concedida: sem ela, a contagem aparece numa notificação fixa.",
    allowOverlay: "Permitir sobreposição",
    stopBubble: "Fechar a bolha",
    launchBubble: (n) => (n ? `Abrir a bolha (${n})` : "Abrir a bolha"),
    chooseMe: "Escolha “Eu” na lista de líderes.",
    ownPassed: "Sua hora de saída já passou.",
    bubbleOn: "Bolha ativa: volte para o jogo.",
    notifFallback:
      "Sem permissão de sobreposição: a contagem aparece na notificação fixa (e aqui).",
    error: (m) => `Erro: ${m}`,
    bubbleFirst: "Você lança primeiro",
    bubbleAfter: (o, f) => `${o} após o lançamento de ${f}`,
    precQuick: "precisão ± 1 s (tempo de reação)",
    copyTitle: "Mensagem para copiar",
    copy: "Copiar mensagem",
    copied: "Copiado!",
    native: {
      start: "START (1º lança)",
      launchIn: "Saída em",
      go: "JÁ!",
      goNotif: "JÁ! Lance seu rally",
      tapStart: "Toque em Start assim que o 1º líder lançar",
      stop: "Parar",
      me: "Eu",
      channel: "Contagem do rally",
    },
  },

  // ------------------------------------------------------------------ IT
  it: {
    subtitle: "Fai arrivare tutti i tuoi rally nello stesso istante",
    targetName: "Nome del bersaglio",
    appLanguage: "Lingua dell'app",
    messageLanguage: "Lingua del messaggio",
    prepNote:
      "Il tempo di preparazione del rally non è incluso: ogni leader lo aggiunge per conto suo.",
    leaders: "Leader dei rally",
    marchHelp:
      "Tempo di marcia mostrato nel gioco toccando il bersaglio (bonus inclusi): «125», «2:05» o «2m5s».",
    invalid: "non valido",
    remove: "Rimuovi questo leader",
    addLeader: "Aggiungi un leader",
    me: "Io:",
    none: "— (nessuno)",
    utcTime: "Ora UTC",
    resync: "Risincronizza",
    syncing: "Sincronizzazione…",
    resyncing: "Risincronizzazione…",
    synced: (ms) => `Sincronizzato ± ${ms} ms`,
    resyncFailed: " · ultima risincronizzazione non riuscita",
    notSynced: "Non sincronizzato: orologio del telefono, poco affidabile",
    sourceTip: (s, n) => `Fonte: ${s} · ${n} campioni`,
    arrivalTitle: "Ora di arrivo sul bersaglio (UTC)",
    arrivalAria: "Ora di arrivo UTC",
    arrivalFormat: "Formato atteso: HH:MM:SS (es. 12:30:00)",
    now: "Adesso",
    impactIn: (d) => `Impatto tra ${d}`,
    arrivalPassed: (d) => `Ora di arrivo passata da ${d}`,
    meCard: (n) => `Io: ${n}`,
    departAt: (t) => `Partenza alle ${t} UTC`,
    precSynced: (ms) => `sincronizzato ± ${ms} ms`,
    precPhone: "orologio del telefono (non sincronizzato)",
    departures: "Orari di partenza",
    emptyUtc: "Inserisci un'ora di arrivo e almeno un tempo di marcia.",
    passed: (n) =>
      n === 1
        ? "1 partenza è già passata: sposta più avanti l'ora di arrivo."
        : `${n} partenze sono già passate: sposta più avanti l'ora di arrivo.`,
    duplicates: "Nomi duplicati: vengono numerati nel messaggio.",
    passedBy: (d) => `passata da ${d}`,
    inTime: (d) => `tra ${d}`,
    march: (d) => `marcia ${d}`,
    quickTitle: "Ritardi dal primo lancio",
    emptyQuick: "Inserisci almeno un tempo di marcia.",
    firstExplain: (d) =>
      ` lancia per primo (marcia più lunga: ${d}). Gli altri lanciano il loro rally dopo, con il ritardo indicato.`,
    startBtn: (n) => `Start (lancia ${n})`,
    reset: "Azzera",
    startHelp: (n) =>
      `Premi Start appena ${n} lancia: ogni scheda si illumina al suo ritardo. Precisione ± 1 s (tempo di reazione).`,
    firstBadge: "1°",
    go: "VIA!",
    inSec: (n) => `tra ${n}s`,
    meFirst: "Lanci per primo: gli altri contano dal tuo lancio.",
    meOffset: (o, f) => `Ritardo ${o} dopo ${f} · precisione ± 1 s`,
    floatTitle: (m) => `Modalità fluttuante (${m})`,
    floatUtcHelp:
      "Una bolla mostra il tuo conto alla rovescia sopra il gioco fino all'ora di partenza.",
    floatQuickHelp:
      "Una bolla con il pulsante Start resta sopra il gioco: premilo appena il primo leader lancia.",
    alertsHelp:
      "Avvisi con suono e vibrazione a T−3, T−2 e T−1, poi allo zero. La bolla non interagisce mai con il gioco.",
    overlayMissing:
      "Permesso «Mostra sopra altre app» non concesso: senza, il conto alla rovescia appare in una notifica fissa.",
    allowOverlay: "Consenti",
    stopBubble: "Chiudi la bolla",
    launchBubble: (n) => (n ? `Apri la bolla (${n})` : "Apri la bolla"),
    chooseMe: "Scegli «Io» nella lista dei leader.",
    ownPassed: "La tua ora di partenza è già passata.",
    bubbleOn: "Bolla attiva: torna al gioco.",
    notifFallback:
      "Senza permesso di sovrapposizione: il conto alla rovescia appare nella notifica fissa (e qui).",
    error: (m) => `Errore: ${m}`,
    bubbleFirst: "Lanci per primo",
    bubbleAfter: (o, f) => `${o} dopo il lancio di ${f}`,
    precQuick: "precisione ± 1 s (tempo di reazione)",
    copyTitle: "Messaggio da copiare",
    copy: "Copia messaggio",
    copied: "Copiato!",
    native: {
      start: "START (lancia il 1°)",
      launchIn: "Partenza tra",
      go: "VIA!",
      goNotif: "VIA! Lancia il tuo rally",
      tapStart: "Premi Start appena il 1° leader lancia",
      stop: "Ferma",
      me: "Io",
      channel: "Conto alla rovescia rally",
    },
  },

  // ------------------------------------------------------------------ TR
  tr: {
    subtitle: "Tüm rally'lerini hedefe aynı anda ulaştır",
    targetName: "Hedef adı",
    appLanguage: "Uygulama dili",
    messageLanguage: "Mesaj dili",
    prepNote: "Rally hazırlık süresi hesaba katılmaz: her lider bunu kendisi ekler.",
    leaders: "Rally liderleri",
    marchHelp:
      "Hedefe dokununca oyunda görünen yürüyüş süresi (bonuslar dahil): \"125\", \"2:05\" veya \"2m5s\".",
    invalid: "geçersiz",
    remove: "Bu lideri kaldır",
    addLeader: "Lider ekle",
    me: "Ben:",
    none: "— (yok)",
    utcTime: "UTC saati",
    resync: "Yeniden eşitle",
    syncing: "Eşitleniyor…",
    resyncing: "Yeniden eşitleniyor…",
    synced: (ms) => `Eşitlendi ± ${ms} ms`,
    resyncFailed: " · son eşitleme başarısız",
    notSynced: "Eşitlenmedi: telefon saati, güvenilir değil",
    sourceTip: (s, n) => `Kaynak: ${s} · ${n} ölçüm`,
    arrivalTitle: "Hedefe varış saati (UTC)",
    arrivalAria: "UTC varış saati",
    arrivalFormat: "Beklenen biçim: HH:MM:SS (ör. 12:30:00)",
    now: "Şimdi",
    impactIn: (d) => `Varışa ${d} kaldı`,
    arrivalPassed: (d) => `Varış saati ${d} önce geçti`,
    meCard: (n) => `Ben: ${n}`,
    departAt: (t) => `Başlatma: ${t} UTC`,
    precSynced: (ms) => `eşitlendi ± ${ms} ms`,
    precPhone: "telefon saati (eşitlenmedi)",
    departures: "Başlatma saatleri",
    emptyUtc: "Bir varış saati ve en az bir yürüyüş süresi gir.",
    passed: (n) => `${n} başlatma saati geçti: varış saatini ileri al.`,
    duplicates: "Aynı isimler: mesajda numaralandırılır.",
    passedBy: (d) => `${d} önce geçti`,
    inTime: (d) => `${d} sonra`,
    march: (d) => `yürüyüş ${d}`,
    quickTitle: "İlk başlatmadan itibaren gecikmeler",
    emptyQuick: "En az bir yürüyüş süresi gir.",
    firstExplain: (d) =>
      ` ilk başlatır (en uzun yürüyüş: ${d}). Diğerleri rally'lerini gösterilen gecikmeyle ardından başlatır.`,
    startBtn: (n) => `Start (${n} başlatınca)`,
    reset: "Sıfırla",
    startHelp: (n) =>
      `${n} başlatır başlatmaz Start'a dokun: her kart kendi gecikmesinde yanar. Hassasiyet ± 1 sn (tepki süresi).`,
    firstBadge: "1.",
    go: "BAŞLAT!",
    inSec: (n) => `${n} sn sonra`,
    meFirst: "İlk sen başlatıyorsun: diğerleri senin başlatmandan itibaren sayar.",
    meOffset: (o, f) => `${f} başlattıktan ${o} sonra · hassasiyet ± 1 sn`,
    floatTitle: (m) => `Yüzen mod (${m})`,
    floatUtcHelp:
      "Bir baloncuk, başlatma saatine kadar geri sayımını oyunun üzerinde gösterir.",
    floatQuickHelp:
      "Start düğmeli bir baloncuk oyunun üzerinde kalır: ilk lider başlatır başlatmaz dokun.",
    alertsHelp:
      "T−3, T−2 ve T−1'de, ardından sıfırda sesli ve titreşimli uyarı. Baloncuk oyunla asla etkileşime girmez.",
    overlayMissing:
      "\"Diğer uygulamaların üzerinde göster\" izni verilmedi: bu izin olmadan geri sayım kalıcı bir bildirimde görünür.",
    allowOverlay: "İzin ver",
    stopBubble: "Baloncuğu kapat",
    launchBubble: (n) => (n ? `Baloncuğu aç (${n})` : "Baloncuğu aç"),
    chooseMe: "Lider listesinden \"Ben\" seçeneğini seç.",
    ownPassed: "Başlatma saatin geçti.",
    bubbleOn: "Baloncuk etkin: oyuna geç.",
    notifFallback:
      "Üstte gösterme izni yok: geri sayım kalıcı bildirimde (ve burada) görünür.",
    error: (m) => `Hata: ${m}`,
    bubbleFirst: "İlk sen başlatıyorsun",
    bubbleAfter: (o, f) => `${f} başlattıktan ${o} sonra`,
    precQuick: "hassasiyet ± 1 sn (tepki süresi)",
    copyTitle: "Kopyalanacak mesaj",
    copy: "Mesajı kopyala",
    copied: "Kopyalandı!",
    native: {
      start: "START (1. başlatınca)",
      launchIn: "Başlatmaya kalan",
      go: "BAŞLAT!",
      goNotif: "BAŞLAT! Rally'ni başlat",
      tapStart: "1. lider başlatır başlatmaz Start'a dokun",
      stop: "Durdur",
      me: "Ben",
      channel: "Rally geri sayımı",
    },
  },

  // ------------------------------------------------------------------ RU
  ru: {
    subtitle: "Все ралли — в цель одновременно",
    targetName: "Название цели",
    appLanguage: "Язык приложения",
    messageLanguage: "Язык сообщения",
    prepNote: "Время сбора ралли не учитывается: каждый лидер добавляет его сам.",
    leaders: "Лидеры ралли",
    marchHelp:
      "Время марша, которое игра показывает при нажатии на цель (с бонусами): «125», «2:05» или «2m5s».",
    invalid: "неверно",
    remove: "Удалить лидера",
    addLeader: "Добавить лидера",
    me: "Я:",
    none: "— (нет)",
    utcTime: "Время UTC",
    resync: "Синхронизировать",
    syncing: "Синхронизация…",
    resyncing: "Повторная синхронизация…",
    synced: (ms) => `Синхронизировано ± ${ms} мс`,
    resyncFailed: " · последняя синхронизация не удалась",
    notSynced: "Нет синхронизации: часы телефона, ненадёжно",
    sourceTip: (s, n) => `Источник: ${s} · замеров: ${n}`,
    arrivalTitle: "Время прибытия к цели (UTC)",
    arrivalAria: "Время прибытия UTC",
    arrivalFormat: "Формат: ЧЧ:ММ:СС (например, 12:30:00)",
    now: "Сейчас",
    impactIn: (d) => `Удар через ${d}`,
    arrivalPassed: (d) => `Время прибытия прошло ${d} назад`,
    meCard: (n) => `Я: ${n}`,
    departAt: (t) => `Запуск в ${t} UTC`,
    precSynced: (ms) => `синхронизировано ± ${ms} мс`,
    precPhone: "часы телефона (без синхронизации)",
    departures: "Время запуска",
    emptyUtc: "Укажи время прибытия и хотя бы одно время марша.",
    passed: (n) =>
      `${n} ${ruPlural(n, "запуск уже прошёл", "запуска уже прошли", "запусков уже прошли")}: сдвинь время прибытия на позже.`,
    duplicates: "Повторяющиеся имена: в сообщении они пронумерованы.",
    passedBy: (d) => `просрочено на ${d}`,
    inTime: (d) => `через ${d}`,
    march: (d) => `марш ${d}`,
    quickTitle: "Задержки от первого запуска",
    emptyQuick: "Укажи хотя бы одно время марша.",
    firstExplain: (d) =>
      ` запускает первым (самый долгий марш: ${d}). Остальные запускают ралли после него с указанной задержкой.`,
    startBtn: (n) => `Start (запускает ${n})`,
    reset: "Сброс",
    startHelp: (n) =>
      `Нажми Start, как только ${n} запустит ралли: каждая карточка загорится в свой момент. Точность ± 1 с (время реакции).`,
    firstBadge: "1-й",
    go: "ПУСК!",
    inSec: (n) => `через ${n} с`,
    meFirst: "Ты запускаешь первым: остальные считают от твоего запуска.",
    meOffset: (o, f) => `Задержка ${o} после ${f} · точность ± 1 с`,
    floatTitle: (m) => `Плавающее окно (${m})`,
    floatUtcHelp: "Плавающее окно показывает обратный отсчёт поверх игры до твоего времени запуска.",
    floatQuickHelp:
      "Плавающее окно с кнопкой Start остаётся поверх игры: нажми, как только первый лидер запустит ралли.",
    alertsHelp:
      "Звук и вибрация на T−3, T−2, T−1 и в момент запуска. Окно никак не взаимодействует с игрой.",
    overlayMissing:
      "Нет разрешения «Поверх других приложений»: без него отсчёт идёт в постоянном уведомлении.",
    allowOverlay: "Разрешить",
    stopBubble: "Закрыть окно",
    launchBubble: (n) => (n ? `Открыть окно (${n})` : "Открыть окно"),
    chooseMe: "Выбери «Я» в списке лидеров.",
    ownPassed: "Твоё время запуска уже прошло.",
    bubbleOn: "Окно активно: переходи в игру.",
    notifFallback: "Без разрешения на наложение: отсчёт идёт в постоянном уведомлении (и здесь).",
    error: (m) => `Ошибка: ${m}`,
    bubbleFirst: "Ты запускаешь первым",
    bubbleAfter: (o, f) => `${o} после запуска ${f}`,
    precQuick: "точность ± 1 с (время реакции)",
    copyTitle: "Сообщение для копирования",
    copy: "Скопировать сообщение",
    copied: "Скопировано!",
    native: {
      start: "START (запуск 1-го)",
      launchIn: "Запуск через",
      go: "ПУСК!",
      goNotif: "ПУСК! Запускай ралли",
      tapStart: "Нажми Start, как только 1-й лидер запустит ралли",
      stop: "Стоп",
      me: "Я",
      channel: "Отсчёт ралли",
    },
  },
}

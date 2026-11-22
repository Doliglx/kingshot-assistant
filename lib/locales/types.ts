// Shape of the app-wide translations. Every locale file must satisfy it,
// so a missing or misspelled key is a compile error.

export interface ModuleLabel {
  name: string
  desc: string
}

export interface AppText {
  common: {
    back: string
    settings: string
    close: string
    total: string
    duration: string
    configuration: string
    results: string
    infantry: string
    cavalry: string
    archers: string
    saved: string
    clear: string
  }
  home: {
    tagline: string
    reorder: string
    reorderHint: string
    reorderDone: string
    reorderReset: string
    /** "{name}" is replaced by the module name. */
    moveEarlier: string
    moveLater: string
    modules: {
      rss: ModuleLabel
      fraki: ModuleLabel
      ratio: ModuleLabel
      buff: ModuleLabel
      gather: ModuleLabel
      rally: ModuleLabel
      clicker: ModuleLabel
      textart: ModuleLabel
    }
  }
  settings: {
    language: string
    accent: string
    custom: string
    reset: string
    autoSaved: string
  }
  rss: {
    inventory: string
    level: (n: number) => string
    balance: string
    bread: string
    wood: string
    stone: string
    iron: string
    projection: string
  }
  frak: {
    stats: string
    attack: string
    lethality: string
    tier: string
    enabled: string
    disabled: string
    optimize: string
    optimum: string
    score: string
    hintClick: string
    hintResults: string
    badge: string
    how: string
    hide: string
    bear: string
    source: string
    limits: string
    credit: string
    discord: string
    chartNote: (inf: number) => string
  }
  ratio: {
    totalTroops: string
    presets: string
    mustBe100: (n: number) => string
    auto: string
    split: string
    ofTotal: (n: number) => string
    verified: string
  }
  buff: {
    initial: string
    modType: string
    buffOpt: string
    debuffOpt: string
    modValue: string
    quick: string
    formula: string
    statInitial: string
    startValue: string
    buffApplied: string
    debuffApplied: string
    modifier: string
    variation: string
    variationDesc: string
    finalStat: string
  }
  gather: {
    shown: string
    hours: string
    minutes: string
    seconds: string
    currentSpeed: string
    bonus: string
    targetDate: string
    hintTarget: string
    hintEmpty: string
    standard: string
    boosted: string
    launchTime: string
    finishTime: string
    timeSaved: string
  }
  ac: {
    intro: string
    tosWarning: string
    privacy: string
    androidOnly: string
    serviceOff: string
    enableService: string
    serviceOn: string
    configs: string
    newSingle: string
    newMulti: string
    healTemplate: string
    healName: string
    healStep1: string
    healStep2: string
    noConfig: string
    name: string
    mode: string
    single: string
    multi: string
    interval: string
    cyclePause: string
    startDelay: string
    stopWhen: string
    infinite: string
    afterCycles: string
    afterDuration: string
    cycles: string
    seconds: string
    targets: string
    addTarget: string
    target: (n: number) => string
    label: string
    type: string
    tap: string
    hold: string
    swipe: string
    tapMs: string
    holdMs: string
    swipeMs: string
    delayAfter: string
    repeat: string
    notPlaced: string
    placedAt: (x: number, y: number) => string
    duplicate: string
    remove: string
    showPanel: string
    hidePanel: string
    panelHelp: string
    safety: string
    speedNote: string
    sync: string
    sequence: string
    syncHelp: string
    appearance: string
    markerSize: string
    small: string
    medium: string
    large: string
    opacity: string
    hideWhileRunning: string
    yes: string
    no: string
    share: string
    exportBtn: string
    exported: string
    importBtn: string
    importPlaceholder: string
    importError: string
    positionsNote: string
    compactHelp: string
    tabMacros: string
    tabEdit: string
    tabLook: string
    tabShare: string
    general: string
    templates: string
    healHelp: string
    terrorTemplate: string
    terrorName: string
    terrorHelp: string
    about: string
    editHint: string
    unitMs: string
    unitS: string
    unitMin: string
    waitShort: string
    targetsCount: string
    /** Short texts shown on the native floating panel. */
    native: {
      ready: string
      running: string
      startsIn: string
      done: string
    }
  }
  art: {
    intro: string
    search: string
    all: string
    noFolder: string
    newFolder: string
    folderName: string
    rename: string
    deleteFolder: string
    deleteFolderConfirm: string
    newArt: string
    untitled: string
    empty: string
    copy: string
    copied: string
    copyFailed: string
    edit: string
    name: string
    folder: string
    textPlaceholder: string
    paste: string
    previous: string
    next: string
    preview: string
    previewNote: string
    measured: string
    showSpaces: string
    broken: string
    delete: string
    deleteConfirm: string
    duplicate: string
    sortRecent: string
    sortName: string
    exampleName: string
    exampleFolder: string
    storageFull: string
    saved: string
    bubbleWidth: (n: number) => string
    stats: (chars: number, lines: number) => string
    spacesInfo: (ideo: number, plain: number) => string
  }
}

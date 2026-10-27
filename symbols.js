/* VoltCE schematic symbols. Small inline SVGs drawn on a 48x48 grid, stroke only, so they pick up the page colour.
   VCSYM.svg(key) returns markup; VCSYM.forLabel(text) picks the symbol for a topic name. */
(function () {
  const P = {
    ground: '<path d="M24 5v17M9 22h30M15 29h18M21 36h6"/>',
    motor: '<circle cx="24" cy="24" r="15"/><path d="M16 32V16l8 10 8-10v16"/><path d="M3 24h6M39 24h6"/>',
    transformer: '<path d="M6 6h12M6 42h12M42 6H30M42 42H30M18 6a5 5 0 0 1 0 9a5 5 0 0 1 0 9a5 5 0 0 1 0 9a5 5 0 0 1 0 9M30 6a5 5 0 0 0 0 9a5 5 0 0 0 0 9a5 5 0 0 0 0 9a5 5 0 0 0 0 9M23 6v36M25 6v36"/>',
    resistor: '<path d="M2 24h9l3-9 6 18 6-18 6 18 3-9h11"/>',
    capacitor: '<path d="M2 24h16M30 24h16M18 10v28M30 10v28"/>',
    inductor: '<path d="M2 30h6a6 6 0 0 1 12 0a6 6 0 0 1 12 0a6 6 0 0 1 12 0h2"/>',
    battery: '<path d="M2 24h10M36 24h10M12 10v28M20 16v16M28 10v28M36 16v16"/>',
    switch: '<circle cx="14" cy="32" r="2.5"/><circle cx="34" cy="32" r="2.5"/><path d="M2 32h9.5M36.5 32H46M14 30L32 14"/>',
    breaker: '<circle cx="14" cy="32" r="2.5"/><circle cx="34" cy="32" r="2.5"/><path d="M2 32h9.5M36.5 32H46M14 30L32 14M26 11a9 9 0 0 1 9 9"/>',
    fuse: '<path d="M2 24h12M34 24h12"/><rect x="14" y="17" width="20" height="14" rx="2"/><path d="M14 24h20"/>',
    receptacle: '<circle cx="24" cy="24" r="16"/><path d="M18 15v10M30 15v10M19 34a5 5 0 0 1 10 0"/>',
    lamp: '<circle cx="24" cy="24" r="13"/><path d="M15 15l18 18M33 15L15 33M2 24h9M37 24h9"/>',
    appliance: '<rect x="6" y="8" width="36" height="32" rx="3"/><path d="M12 28h5l2-7 4 14 4-14 3 7h6"/><circle cx="15" cy="15" r="2"/><circle cx="24" cy="15" r="2"/><circle cx="33" cy="15" r="2"/>',
    hvac: '<path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19M19 8l5 4 5-4M19 40l5-4 5 4M9 19l6 1-1-6M39 29l-6-1 1 6M39 19l-6 1 1-6M9 29l6-1-1 6"/>',
    generator: '<circle cx="24" cy="24" r="16"/><path d="M32 18a9 9 0 1 0 0 12v-5h-7"/>',
    meter: '<circle cx="24" cy="26" r="17"/><path d="M12 36a15 15 0 0 1 24 0M24 26l8-9M24 11v3M12 17l2 2M36 17l-2 2"/>',
    conduit: '<rect x="3" y="15" width="42" height="18" rx="9"/><path d="M12 24h24M12 20h24M12 28h24"/>',
    wire: '<path d="M2 14c6-8 10 8 14 0s8 8 14 0 10 8 16 0M2 26c6-8 10 8 14 0s8 8 14 0 10 8 16 0M2 38c6-8 10 8 14 0s8 8 14 0 10 8 16 0"/>',
    junction: '<rect x="8" y="8" width="32" height="32" rx="2"/><circle cx="24" cy="24" r="4"/><path d="M8 24h12M28 24h12M24 8v12M24 28v12"/>',
    panel: '<rect x="9" y="4" width="30" height="40" rx="2"/><path d="M15 12h8M15 20h8M15 28h8M15 36h8M25 12h8M25 20h8M25 28h8M25 36h8M24 10v30"/>',
    tray: '<path d="M4 14h40M4 34h40M10 14v20M18 14v20M26 14v20M34 14v20M42 14v20"/>',
    plug: '<path d="M16 5v10M32 5v10M24 33v5c0 5 6 5 6 10"/><rect x="11" y="15" width="26" height="18" rx="5"/>',
    ev: '<path d="M4 31h40v6H4zM8 31l4-10h18l6 10"/><circle cx="14" cy="38" r="3.5"/><circle cx="34" cy="38" r="3.5"/><path d="M22 6l-6 9h5l-2 7 8-10h-5z"/>',
    solar: '<circle cx="12" cy="11" r="4.5"/><path d="M12 2v3M3 11h3M5.5 4.5l2 2M18.5 4.5l-2 2"/><path d="M8 42l6-17h30l-6 17zM12 33h30M27 25l-4 17M38 25l-4 17"/>',
    wind: '<path d="M24 22V44M18 44h12M24 22L24 4M24 22l-15 9M24 22l15 9"/><circle cx="24" cy="22" r="2.5"/>',
    pump: '<circle cx="24" cy="26" r="14"/><path d="M19 19l14 7-14 7zM24 12V5h12M2 40h7M39 40h7"/>',
    bell: '<path d="M10 34c0-3 3-5 3-12a11 11 0 0 1 22 0c0 7 3 9 3 12zM19 38a5 5 0 0 0 10 0M24 7v4"/>',
    speaker: '<path d="M6 19h8l11-9v28l-11-9H6zM31 18a9 9 0 0 1 0 12M36 13a16 16 0 0 1 0 22"/>',
    antenna: '<path d="M24 25v18M18 43h12"/><circle cx="24" cy="21" r="2.5"/><path d="M17 14a10 10 0 0 0 0 14M31 14a10 10 0 0 1 0 14M11 8a19 19 0 0 0 0 26M37 8a19 19 0 0 1 0 26"/>',
    fiber: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="2" fill="currentColor"/>',
    pool: '<path d="M4 34c5-5 9-5 14 0s9 5 14 0 9-5 12 0M4 42c5-5 9-5 14 0s9 5 14 0 9-5 12 0M16 24V8a5 5 0 0 1 10 0M24 24V8M16 14h8M16 20h8"/>',
    boat: '<path d="M5 30h38l-6 10H11zM24 30V6M24 6l14 20H24M20 14L10 26h10"/>',
    health: '<circle cx="24" cy="24" r="19"/><path d="M20 12h8v8h8v8h-8v8h-8v-8h-8v-8h8z"/>',
    flame: '<path d="M24 4c2 9 11 11 11 22a11 11 0 0 1-22 0c0-7 4-9 5-14 2 2 4 4 4 8 3-4 4-9 2-16z"/>',
    fuel: '<rect x="9" y="6" width="19" height="36" rx="2"/><rect x="13" y="11" width="11" height="9"/><path d="M5 42h27M28 16h6v16a4 4 0 0 0 8 0V20l-5-5"/>',
    people: '<circle cx="12" cy="16" r="4.5"/><circle cx="24" cy="13" r="4.5"/><circle cx="36" cy="16" r="4.5"/><path d="M4 36a8 8 0 0 1 16 0M16 34a8 8 0 0 1 16 0M28 36a8 8 0 0 1 16 0"/>',
    sign: '<rect x="5" y="8" width="38" height="20" rx="3"/><path d="M11 15h26M11 21h18M16 28v14M32 28v14"/>',
    crane: '<path d="M8 44V8h30M8 14l22-6M38 8v18M38 26a4 4 0 1 1-4 4M4 44h10"/>',
    elevator: '<rect x="8" y="5" width="32" height="38" rx="2"/><path d="M24 5v38M14 20l4-5 4 5M14 29l4 5 4-5M30 20l4-5M30 15l4 5M30 29l4 5 4-5"/>',
    weld: '<path d="M8 40L28 20M28 20l6-6M10 42h30M30 8v5M40 14h-5M38 8l-4 4M42 20l-5-1"/>',
    exit: '<rect x="4" y="14" width="40" height="20" rx="2"/><path d="M12 24h18M25 18l7 6-7 6"/>',
    spd: '<path d="M2 24h10M36 24h10"/><rect x="12" y="17" width="24" height="14"/><path d="M8 40L40 8M40 8l-8 1M40 8l-1 8"/>',
    lowv: '<path d="M2 24c4-14 8-14 12 0s8 14 12 0 8-14 12 0 4 14 8 0"/><path d="M4 40h40"/>',
    inverter: '<rect x="5" y="9" width="38" height="30" rx="2"/><path d="M5 39L43 9M11 17h12M11 22h12M28 33c2-4 4-4 6 0s4 4 6 0"/>',
    wye: '<circle cx="24" cy="24" r="2"/><path d="M24 24V6M24 24L9 33M24 24l15 9M24 41v-5M7 38l4-3M41 38l-4-3"/>',
    pole: '<path d="M24 4v40M10 12h28M14 20h20M3 18l7-6M45 18l-7-6M3 26l11-6M45 26l-11-6"/>',
    book: '<path d="M24 12c-5-4-12-5-19-4v30c7-1 14 0 19 4 5-4 12-5 19-4V8c-7-1-14 0-19 4zM24 12v30"/>',
    ac: '<path d="M2 24c5-18 9-18 14 0s9 18 14 0 9-18 14 0"/><path d="M2 24h44" stroke-dasharray="2 4"/>',
    ohm: '<path d="M6 38h12v-4C11 31 9 25 9 20a15 15 0 0 1 30 0c0 5-2 11-9 14v4h12"/>',
    bolt: '<path d="M28 4L10 28h13l-3 16 18-26H25z"/>',
    therm: '<path d="M20 6a4 4 0 0 1 8 0v22a8 8 0 1 1-8 0zM24 14v20"/><circle cx="24" cy="36" r="3" fill="currentColor"/>',
    shield: '<path d="M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10zM26 14l-7 11h6l-2 9 7-12h-6z"/>',
    node: '<circle cx="24" cy="24" r="3.5" fill="currentColor"/><path d="M4 24h16.5M27.5 24H44M24 4v16.5M24 27.5V44M10 21l-5 3 5 3M34 21l5 3-5 3"/>',
    parallel: '<path d="M2 24h8M38 24h8M10 12v24M38 12v24M10 12h6l2-4 4 8 4-8 4 8 2-4h6M10 36h6l2-4 4 8 4-8 4 8 2-4h6"/>',
    vdrop: '<path d="M2 14h8l2-6 4 12 4-12 4 12 4-12 2 6h6M38 22v18M32 34l6 7 6-7"/>',
    house: '<path d="M5 24L24 7l19 17M10 21v21h28V21M20 42V30h8v12"/>',
    building: '<rect x="9" y="4" width="30" height="40" rx="1"/><path d="M15 11h4M22 11h4M29 11h4M15 19h4M22 19h4M29 19h4M15 27h4M22 27h4M29 27h4M20 44V36h8v8"/>',
    cable: '<path d="M4 20h40M4 28h40"/><path d="M10 20c4 0 4 8 8 8s4-8 8-8 4 8 8 8 4-8 8-8" opacity=".6"/>',
    server: '<rect x="8" y="6" width="32" height="10" rx="2"/><rect x="8" y="19" width="32" height="10" rx="2"/><rect x="8" y="32" width="32" height="10" rx="2"/><path d="M14 11h.01M14 24h.01M14 37h.01M22 11h12M22 24h12M22 37h12"/>',
    barn: '<path d="M6 20L24 6l18 14v22H6zM16 42V28h16v14M16 28l16 14M32 28L16 42"/>',
    plane: '<path d="M24 4c2 0 3 2 3 5v10l16 10v4l-16-4v8l5 4v3l-8-2-8 2v-3l5-4v-8L5 33v-4l16-10V9c0-3 1-5 3-5z"/>',
    surge: '<path d="M2 24h12M34 24h12"/><circle cx="24" cy="24" r="10"/><path d="M27 15l-7 10h5l-2 8"/>'
  };
  const RULES = [
    [/energy management|power control/i, 'meter'], [/knob-and-tube|messenger|open wiring/i, 'wire'], [/multioutlet/i, 'receptacle'], [/over 1000 volts|\b490\b/i, 'panel'], [/cannabis|\b512\b/i, 'lamp'],
    [/wiring method|\b300\b/i, 'conduit'],
    [/(?<!under)ground|bonding/i, 'ground'], [/motor fuel|garage|\b511\b|\b514\b|fuel dispens/i, 'fuel'], [/motor|\b430\b|controller|industrial machinery|\b670\b|\b675\b|\b685\b/i, 'motor'],
    [/transformer|\b450\b/i, 'transformer'], [/emergency|\b700\b|exit/i, 'exit'], [/solar|photovoltaic|\b690\b|\b691\b|PV\b/i, 'solar'], [/fuel cell|wind|\b692\b|\b694\b/i, 'wind'],
    [/energy storage|\b706\b|batter|\b480\b/i, 'battery'], [/generator|\b445\b|standby|\b701\b|\b702\b|legally required|critical operations|\b708\b/i, 'generator'],
    [/interconnected|\b705\b|power production|inverter|stand-alone|microgrid|\b710\b|\b712\b/i, 'inverter'], [/electric vehicle|\b625\b|\b624\b|\b626\b|truck parking|EVSE|\bEV\b/i, 'ev'],
    [/swimming|pool|\b680\b|\b682\b|fountain|\bspas?\b|natural and artificially/i, 'pool'], [/marina|\b555\b|boatyard|shore power|floating/i, 'boat'], [/health|\b517\b|patient|x-ray|\b660\b/i, 'health'],
    [/aircraft|hangar|\b513\b/i, 'plane'], [/hazardous|class i\b|class ii\b|class iii\b|zone|\b50[0-6]\b|\b510\b|\b515\b|\b516\b|intrinsically|explosion|spray/i, 'flame'],
    [/assembly occupanc|\b518\b|theater|\b520\b|studio|\b530\b|carnival|\b525\b|audience|\b650\b|pipe organ/i, 'people'], [/\bsigns?\b|\b600\b|outline lighting/i, 'sign'], [/crane|hoist|\b610\b/i, 'crane'],
    [/elevator|escalator|\b620\b/i, 'elevator'], [/weld|\b630\b/i, 'weld'], [/audio|\b640\b|\bsound\b/i, 'speaker'], [/fire pump|\b695\b/i, 'pump'], [/fire alarm|\b760\b/i, 'bell'], [/fiber|optical|\b770\b/i, 'fiber'],
    [/communication|catv|antenna|\b80\d\b|\b82\d\b|\b83\d\b|\b84\d\b|broadband|radio/i, 'antenna'], [/information technology|data center|\b645\b|\b646\b|\b647\b|sensitive electronic/i, 'server'],
    [/surge|\b242\b|\b285\b|overvoltage|spd/i, 'surge'], [/class 1|class 2|class 3|class 4|\b72\d\b|limited.energy|power.limited|low.voltage|\b411\b/i, 'lowv'],
    [/air.condition|refriger|hvac|\b440\b|heat pump/i, 'hvac'], [/agricultur|\b547\b/i, 'barn'], [/mobile home|recreational vehicle|park trailer|\b55[0-3]\b|dwelling unit/i, 'house'],
    [/appliance|\b422\b|space.heat|\b424\b|\b426\b|\b427\b|deic|heating|induction|electrolytic|electroplat|\b66\d\b|cooking|range|dryer/i, 'appliance'],
    [/receptacle|\b406\b/i, 'receptacle'], [/luminaire|lamp|\b410\b|lighting/i, 'lamp'], [/switch(?!board|gear)|\b404\b/i, 'switch'], [/capacitor|\b460\b/i, 'capacitor'], [/resistor|reactor|\b470\b/i, 'resistor'],
    [/switchboard|panelboard|switchgear|\b408\b|\b409\b|control panel|cabinet|\b312\b|service equipment/i, 'panel'],
    [/feeder|\b215\b|outside|\b225\b|overhead|pole/i, 'pole'], [/overcurrent|\b240\b|circuit breaker|branch.circuit|\b210\b|\b120\b/i, 'breaker'], [/fuse/i, 'fuse'],
    [/conduit fill|raceway fill|conduit|tubing|raceway|\b3(4|5|6)\d\b|\b384\b|\b386\b|\b390\b|\b382\b/i, 'conduit'], [/wireway|busway|bus pipe|flexible bus|cablebus|gutter|cable tray|tray|\b36[689]\b|\b37[0-8]\b|\b392\b/i, 'tray'],
    [/flexible cord|\b400\b|\bcords?\b|plug/i, 'plug'], [/box fill|\bbox|\b314\b|junction|pull/i, 'junction'], [/cable|\b3(2|3)\d\b|\bNM\b|\bMC\b|\bSE\b|\bUF\b/i, 'cable'],
    [/service|\b230\b|\b220\b|load|demand|standard method|optional method/i, 'meter'], [/commercial/i, 'building'],
    [/parallel/i, 'parallel'], [/conductor|ampacity|\b310\b|\b311\b|wire|resistance|sizing/i, 'wire'], [/voltage drop/i, 'vdrop'], [/ohm/i, 'ohm'], [/kirchhoff/i, 'node'], [/three.phase|wye|delta/i, 'wye'],
    [/AC theory|alternating|frequency|reactance|impedance|power factor/i, 'ac'], [/capacit/i, 'capacitor'], [/induct/i, 'inductor'], [/component/i, 'resistor'], [/meter|measure/i, 'meter'],
    [/temperature|thermal/i, 'therm'], [/safety|osha|ppe|lockout|arc flash|70e/i, 'shield'], [/power|energy|cost|watt|kwh/i, 'bolt'],
    [/definition|general|scope|introduction|\b110\b|\b100\b|\b90\b|code|edition|change|chapter|annex|terminology|temporary|nec\b|wisconsin|transition/i, 'book']
  ];
  function svg(key, size) {
    const body = P[key] || P.book, s = size || 56;
    return '<svg class="vcsym" width="' + s + '" height="' + s + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  function keyFor(label) {
    const t = String(label || '');
    for (const [re, k] of RULES) if (re.test(t)) return k;
    return 'bolt';
  }
  window.VCSYM = { svg, keyFor, forLabel: (l, s) => svg(keyFor(l), s), keys: Object.keys(P) };
})();

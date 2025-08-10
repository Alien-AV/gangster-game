// Declarative action registry for card UI
// Each action: { id, label, stat, base, handler(game, gangster, progressEl, durationMs) }

export const ACTIONS = [
  { id: 'actRecruitEnforcer', label: 'Recruit Enforcer (Fist)', stat: 'fist', base: 2000,
    handler: (game, g, progEl, dur) => game._actRecruitEnforcer(g, progEl, dur) },
  { id: 'actBuyBusiness', label: 'Buy Business (Brain)', stat: 'brain', base: 5000,
    handler: (game, g, progEl, dur) => game._actBuyBusiness(g, progEl, dur) },
  { id: 'actLaunder', label: 'Launder $100 (Brain)', stat: 'brain', base: 4000,
    handler: (game, g, progEl, dur) => game._actLaunder(g, progEl, dur) },
  { id: 'actPromo', label: 'Promotional Campaign (Face)', stat: 'face', base: 3000,
    handler: (game, g, progEl, dur) => game._actPromo(g, progEl, dur) },
  { id: 'actVigilante', label: 'Vigilante Patrol (Fist)', stat: 'fist', base: 3000,
    handler: (game, g, progEl, dur) => game._actVigilante(g, progEl, dur) },
  { id: 'actRaid', label: 'Raid Business (Fist)', stat: 'fist', base: 3500,
    handler: (game, g, progEl, dur) => game._actRaid(g, progEl, dur) },
  { id: 'actExtort', label: 'Extort (Face)', stat: 'face', base: 4000,
    handler: (game, g, progEl, dur) => game._actExtort(g, progEl, dur) },
  { id: 'actBuildIllicit', label: 'Build Illicit (Brain)', stat: 'brain', base: 4000,
    handler: (game, g, progEl, dur) => game._actBuildIllicit(g, progEl, dur) },
  { id: 'actHireGangster', label: 'Hire Gangster (Face)', stat: 'face', base: 3000,
    handler: (game, g, progEl, dur) => game._actHireGangster(g, progEl, dur) },
  { id: 'actPayCops', label: 'Pay Cops -$50', stat: 'brain', base: 3000,
    handler: (game, g, progEl, dur) => game._actPayCops(g, progEl, dur) },
  { id: 'actDonate', label: 'Donate to Soup Kitchen (Brain)', stat: 'brain', base: 4000,
    handler: (game, g, progEl, dur) => game._actDonate(g, progEl, dur) },
  { id: 'actIntimidate', label: 'Intimidate (Fist)', stat: 'fist', base: 3000,
    handler: (game, g, progEl, dur) => game._actIntimidate(g, progEl, dur) },
];

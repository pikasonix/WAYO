// Icon mapping for maneuvers (SVGs live in src/components/icon/map)
const ICONS: Record<string, string> = {
    'turn_left': new URL('../icon/map/turn_left.svg', import.meta.url).href,
    'turn_right': new URL('../icon/map/turn_right.svg', import.meta.url).href,
    'turn_straight': new URL('../icon/map/turn_straight.svg', import.meta.url).href,
    'turn_slight_left': new URL('../icon/map/turn_slight_left.svg', import.meta.url).href,
    'turn_slight_right': new URL('../icon/map/turn_slight_right.svg', import.meta.url).href,
    'turn_sharp_left': new URL('../icon/map/turn_sharp_left.svg', import.meta.url).href,
    'turn_sharp_right': new URL('../icon/map/turn_sharp_right.svg', import.meta.url).href,
    'continue_straight': new URL('../icon/map/continue_straight.svg', import.meta.url).href,
    'continue_left': new URL('../icon/map/continue_left.svg', import.meta.url).href,
    'continue_right': new URL('../icon/map/continue_right.svg', import.meta.url).href,
    'depart': new URL('../icon/map/depart.svg', import.meta.url).href,
    'arrive': new URL('../icon/map/arrive.svg', import.meta.url).href,
    'roundabout': new URL('../icon/map/roundabout.svg', import.meta.url).href,
    'rotary': new URL('../icon/map/rotary.svg', import.meta.url).href,
    'uturn': new URL('../icon/map/uturn.svg', import.meta.url).href,
    'flag': new URL('../icon/map/flag.svg', import.meta.url).href,
    'notification_straight': new URL('../icon/map/notification_straight.svg', import.meta.url).href,
};

const modifierToDeg = (modifier?: string): number => {
    const m = (modifier || '').toLowerCase();
    switch (m) {
        case 'slight right': return 45;
        case 'right': return 90;
        case 'sharp right': return 135;
        case 'uturn': return 180;
        case 'sharp left': return -135;
        case 'left': return -90;
        case 'slight left': return -45;
        case 'straight':
        default: return 0;
    }
};

export const pickManeuverIcon = (step: any): { src?: string; rotate: number } => {
    const type = (step?.maneuver?.type || '').toLowerCase();
    const modifier = (step?.maneuver?.modifier || '').toLowerCase();
    const parts = [] as string[];
    if (type) parts.push(type.replace(/\s+/g, '_'));
    if (modifier) parts.push(modifier.replace(/\s+/g, '_'));
    const candidates: string[] = [];
    if (parts.length === 2) candidates.push(`${parts[0]}_${parts[1]}`);
    if (parts.length >= 1) candidates.push(parts[0]);
    if (type === 'turn' && !modifier) candidates.push('turn_straight');
    for (const k of candidates) {
        if (ICONS[k]) return { src: ICONS[k], rotate: modifierToDeg(modifier) };
    }
    return { src: undefined, rotate: modifierToDeg(modifier) };
};

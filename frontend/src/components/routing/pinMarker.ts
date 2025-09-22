// Helper that creates a simple circular white marker with a colored stroke.
// Returns an HTMLDivElement that can be passed to Mapbox Marker({ element })
export function createPinElement(color: string = '#ef4444'): HTMLDivElement {
    const size = 18; // px
    const strokeWidth = 3; // px
    const container = document.createElement('div');
    container.style.width = `${size + strokeWidth * 2}px`;
    container.style.height = `${size + strokeWidth * 2}px`;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.pointerEvents = 'auto';
    container.title = 'Pin';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size + strokeWidth * 2} ${size + strokeWidth * 2}`);
    svg.setAttribute('width', `${size + strokeWidth * 2}`);
    svg.setAttribute('height', `${size + strokeWidth * 2}`);

    const cx = (size + strokeWidth * 2) / 2;
    const cy = (size + strokeWidth * 2) / 2;
    const r = size / 2;

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', `${cx}`);
    circle.setAttribute('cy', `${cy}`);
    circle.setAttribute('r', `${r}`);
    circle.setAttribute('fill', 'white');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', `${strokeWidth}`);
    circle.setAttribute('stroke-linecap', 'round');

    svg.appendChild(circle);
    container.appendChild(svg);
    return container;
}

import { createContext, type RefObject } from 'react';

export const SvgContext = createContext<RefObject<SVGSVGElement | null>>({ current: null });

import { createContext, useContext } from 'react';
export const CourtlyContext = createContext(null);
export const useCourtly = () => useContext(CourtlyContext);

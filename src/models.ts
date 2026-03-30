export class RivtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RivtError";
  }
}

export interface Violation {
  ruleId: string;
  path: string;
  line: number;
  col: number;
  message: string;
}

export interface Layer {
  name: string;
  paths: string[];
  canImport: string[];
}

export interface LibraryRestriction {
  allowedIn: string[];
}

export interface RivtConfig {
  httpClient?: string;
  configModule: string[];
  exclude: string[];
  disable: string[];
  plugins: string[];
  layers: Record<string, Layer>;
  libraries: Record<string, LibraryRestriction>;
}
